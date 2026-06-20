/**
 * Motion Extraction Service
 * ─────────────────────────
 * Turns a short performance VIDEO (e.g. an AI-generated clip of the artist
 * singing) into a compact, high-level MOTION TIMELINE that a 3D avatar can
 * replay — WITHOUT any heavy pose-estimation / mocap dependency.
 *
 * How it works (cheap, dependency-free beyond the bundled ffmpeg):
 *   1. ffmpeg decodes the video into a sequence of tiny grayscale frames
 *      (GRAY_W × GRAY_H) at a fixed sample rate (SAMPLE_FPS).
 *   2. For each consecutive pair of frames we compute per-region motion energy
 *      (frame differencing) over a left/center/right × top/mid/bottom grid.
 *   3. Those region energies are reduced into intuitive performance signals:
 *        • energy   — overall body motion (drives bob/scale)
 *        • headBob  — vertical motion concentrated in the head region
 *        • swayX    — horizontal balance shift (left vs right motion)
 *        • armLift  — motion in the upper-side regions (arm gestures)
 *        • leanX    — forward/back proxy from top-vs-bottom motion balance
 *      plus a global motion centroid (cx, cy) used to bias sway/lean.
 *   4. The result is a normalized, time-stamped timeline that the viewer maps
 *      onto the avatar's body, layered over the song's own audio reactivity.
 *
 * This is intentionally a *motion-style* transfer (the recommended approach):
 * it captures the performance's rhythm, energy and gesture timing rather than
 * exact joint angles, so it works on ANY rigged or unrigged GLB and never
 * fights the avatar's proportions.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const nodeRequire = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

// Tiny analysis resolution — enough to localize head/torso/arm motion, cheap to
// process. Keep even so the 3×3 region grid divides cleanly.
const GRAY_W = 96;
const GRAY_H = 96;
const SAMPLE_FPS = 12; // frames sampled per second of video
const MAX_FRAMES = 240; // hard cap (~20s @ 12fps) to bound memory/CPU

export interface MotionFrame {
  /** Seconds from the start of the clip. */
  t: number;
  /** Overall body motion 0..1. */
  energy: number;
  /** Vertical head motion 0..1 (bob / nod intensity). */
  headBob: number;
  /** Left/right weight shift -1..1 (negative = left). */
  swayX: number;
  /** Upper-side (arm) gesture motion 0..1. */
  armLift: number;
  /** Forward/back lean proxy -1..1 (positive = forward/down emphasis). */
  leanX: number;
}

export interface MotionTimeline {
  fps: number;
  duration: number;
  frameCount: number;
  /** Average overall energy across the clip (for quick UI summaries). */
  avgEnergy: number;
  frames: MotionFrame[];
}

/** Download a remote video to a temp file and return its path. */
async function downloadToTemp(url: string): Promise<string> {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 120_000 });
  const buf = Buffer.from(res.data);
  const ext = (res.headers['content-type'] || '').includes('webm') ? 'webm' : 'mp4';
  const p = path.join(os.tmpdir(), `perf-src-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  fs.writeFileSync(p, buf);
  return p;
}

/**
 * Decode the video into raw grayscale frames using ffmpeg's rawvideo gray
 * pixel format. Returns a flat list of Uint8 frame buffers (length GRAY_W*GRAY_H
 * each) plus the detected duration.
 */
async function decodeGrayFrames(
  videoPath: string,
): Promise<{ frames: Uint8Array[]; duration: number }> {
  const ffmpegPath = nodeRequire('@ffmpeg-installer/ffmpeg').path as string;
  const rawPath = path.join(os.tmpdir(), `perf-gray-${Date.now()}-${Math.random().toString(36).slice(2)}.raw`);

  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-i', videoPath,
        '-vf', `fps=${SAMPLE_FPS},scale=${GRAY_W}:${GRAY_H}`,
        '-pix_fmt', 'gray',
        '-f', 'rawvideo',
        '-frames:v', String(MAX_FRAMES),
        rawPath,
      ],
      { timeout: 180_000, maxBuffer: 1024 * 1024 * 256 },
    );

    const raw = fs.readFileSync(rawPath);
    const frameSize = GRAY_W * GRAY_H;
    const count = Math.floor(raw.length / frameSize);
    const frames: Uint8Array[] = [];
    for (let i = 0; i < count; i++) {
      frames.push(new Uint8Array(raw.buffer, raw.byteOffset + i * frameSize, frameSize));
    }
    return { frames, duration: count / SAMPLE_FPS };
  } finally {
    try { fs.unlinkSync(rawPath); } catch { /* best-effort */ }
  }
}

/**
 * Reduce a pair of consecutive grayscale frames into per-region motion energy.
 * The frame is split into a 3 (cols: L/C/R) × 3 (rows: top/mid/bottom) grid.
 * Returns the 9 region energies plus the motion centroid.
 */
function regionMotion(prev: Uint8Array, cur: Uint8Array) {
  const colW = GRAY_W / 3;
  const rowH = GRAY_H / 3;
  // region[row][col] accumulated absolute difference
  const region = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let total = 0;
  let mx = 0; // motion-weighted x sum
  let my = 0; // motion-weighted y sum
  for (let y = 0; y < GRAY_H; y++) {
    const row = y < rowH ? 0 : y < rowH * 2 ? 1 : 2;
    for (let x = 0; x < GRAY_W; x++) {
      const i = y * GRAY_W + x;
      const d = Math.abs(cur[i] - prev[i]);
      if (d < 12) continue; // ignore compression/noise jitter
      const col = x < colW ? 0 : x < colW * 2 ? 1 : 2;
      region[row][col] += d;
      total += d;
      mx += d * x;
      my += d * y;
    }
  }
  const cx = total > 0 ? mx / total / GRAY_W : 0.5; // 0..1
  const cy = total > 0 ? my / total / GRAY_H : 0.5; // 0..1
  return { region, total, cx, cy };
}

/** Clamp helper. */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Extract a normalized motion timeline from a performance video URL.
 * Returns null if the video can't be decoded (caller should fall back to the
 * built-in procedural singing motion).
 */
export async function extractMotionTimeline(videoUrl: string): Promise<MotionTimeline | null> {
  let videoPath: string | null = null;
  try {
    videoPath = await downloadToTemp(videoUrl);
    const { frames, duration } = await decodeGrayFrames(videoPath);
    if (frames.length < 4) {
      console.warn('[MotionExtract] too few frames decoded:', frames.length);
      return null;
    }

    // First pass: raw per-frame signals + global max for normalization.
    type Raw = { total: number; head: number; arms: number; cx: number; topVsBottom: number };
    const raw: Raw[] = [];
    let maxTotal = 1e-6;
    for (let i = 1; i < frames.length; i++) {
      const { region, total, cx, cy } = regionMotion(frames[i - 1], frames[i]);
      // Head = top-center; arms = top-left + top-right + mid-left + mid-right.
      const head = region[0][1];
      const arms = region[0][0] + region[0][2] + region[1][0] + region[1][2];
      const top = region[0][0] + region[0][1] + region[0][2];
      const bottom = region[2][0] + region[2][1] + region[2][2];
      const topVsBottom = top - bottom;
      raw.push({ total, head, arms, cx, topVsBottom });
      if (total > maxTotal) maxTotal = total;
      void cy;
    }

    // Smoothing (EMA) so the avatar moves organically, not jittery per-frame.
    const ema = (prev: number, next: number, a = 0.4) => prev + (next - prev) * a;
    let sEnergy = 0, sHead = 0, sArms = 0, sSway = 0, sLean = 0;
    const out: MotionFrame[] = [];
    let energySum = 0;

    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      const energy = clamp(r.total / maxTotal, 0, 1);
      const headBob = clamp(r.head / (maxTotal * 0.25), 0, 1);
      const armLift = clamp(r.arms / (maxTotal * 0.6), 0, 1);
      // Centroid maps 0..1 → -1..1 sway (0.5 = centered).
      const swayX = clamp((r.cx - 0.5) * 2, -1, 1);
      // top-heavy motion → forward/expressive lean.
      const leanX = clamp(r.topVsBottom / (maxTotal * 0.5), -1, 1);

      sEnergy = ema(sEnergy, energy);
      sHead = ema(sHead, headBob);
      sArms = ema(sArms, armLift);
      sSway = ema(sSway, swayX, 0.25);
      sLean = ema(sLean, leanX, 0.3);

      energySum += sEnergy;
      out.push({
        t: +((i + 1) / SAMPLE_FPS).toFixed(3),
        energy: +sEnergy.toFixed(3),
        headBob: +sHead.toFixed(3),
        swayX: +sSway.toFixed(3),
        armLift: +sArms.toFixed(3),
        leanX: +sLean.toFixed(3),
      });
    }

    return {
      fps: SAMPLE_FPS,
      duration: +duration.toFixed(2),
      frameCount: out.length,
      avgEnergy: +(energySum / Math.max(1, out.length)).toFixed(3),
      frames: out,
    };
  } catch (err) {
    console.error('[MotionExtract] failed:', (err as Error)?.message);
    return null;
  } finally {
    if (videoPath) {
      try { fs.unlinkSync(videoPath); } catch { /* best-effort */ }
    }
  }
}

export interface AudioClip {
  /** Re-encoded mp3 buffer ready to upload. */
  buffer: Buffer;
  /** Clip duration in seconds (after trimming). */
  duration: number;
  /** Offset (seconds) into the source song where the clip starts. */
  startSec: number;
}

/**
 * Download a song and extract a short, OmniHuman-ready audio clip.
 *
 * OmniHuman accepts at most 30s of audio and bills per second, so we trim the
 * song to a focused segment (default the first 20s) and re-encode to a clean
 * mono-friendly mp3. The returned clip is what BOTH the video generator and the
 * viewer must use, so the avatar motion stays perfectly in sync with the song.
 *
 * @param songUrl   Source audio URL (mp3/m4a/wav/…).
 * @param startSec  Offset into the song to start the clip (default 0).
 * @param maxSec    Clip length, hard-capped at 30s (OmniHuman limit).
 */
export async function prepareAudioClip(
  songUrl: string,
  startSec = 0,
  maxSec = 20,
): Promise<AudioClip | null> {
  const duration = Math.max(2, Math.min(30, maxSec));
  const offset = Math.max(0, startSec || 0);
  let srcPath: string | null = null;
  const outPath = path.join(
    os.tmpdir(),
    `perf-audio-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
  );

  try {
    const res = await axios.get(songUrl, { responseType: 'arraybuffer', timeout: 120_000 });
    const ct = String(res.headers['content-type'] || '');
    const ext = ct.includes('wav') ? 'wav' : ct.includes('mp4') || ct.includes('m4a') ? 'm4a' : 'mp3';
    srcPath = path.join(
      os.tmpdir(),
      `perf-song-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
    );
    fs.writeFileSync(srcPath, Buffer.from(res.data));

    const ffmpegPath = nodeRequire('@ffmpeg-installer/ffmpeg').path as string;
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-ss', String(offset),
        '-i', srcPath,
        '-t', String(duration),
        '-ac', '2',
        '-ar', '44100',
        '-b:a', '128k',
        '-vn',
        outPath,
      ],
      { timeout: 120_000, maxBuffer: 1024 * 1024 * 64 },
    );

    const buffer = fs.readFileSync(outPath);
    if (!buffer.length) return null;
    return { buffer, duration, startSec: offset };
  } catch (err) {
    console.error('[MotionExtract] prepareAudioClip failed:', (err as Error)?.message);
    return null;
  } finally {
    if (srcPath) { try { fs.unlinkSync(srcPath); } catch { /* best-effort */ } }
    try { fs.unlinkSync(outPath); } catch { /* best-effort */ }
  }
}
