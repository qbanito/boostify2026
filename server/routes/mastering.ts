/**
 * AI Audio Mastering Suite — FAL-powered + real ffmpeg mastering
 *
 * FAL models (verified against fal.ai schemas 2026-07):
 *   fal-ai/demucs                        — Stem separation. Default htdemucs_6s
 *                                          (vocals/drums/bass/other/guitar/piano).
 *                                          Output = TOP-LEVEL File field per stem.
 *   fal-ai/stable-audio-25/text-to-audio — Beat/music generation (≤190s, steps 4-8).
 *                                          Falls back to legacy fal-ai/stable-audio.
 *   fal-ai/f5-tts                        — Voice cloning (gen_text ≤5000, model_type required).
 *   fal-ai/wizper                        — Whisper v3 transcription with chunks.
 *
 * REAL MASTERING (no external API): POST /master runs a two-pass EBU R128
 * loudnorm chain with the bundled ffmpeg — measures the track's real LUFS /
 * true peak / LRA, normalizes to the selected preset target and uploads the
 * mastered file to Firebase Storage.
 *
 * POST /upload accepts multipart audio and returns a PUBLIC https URL —
 * required because FAL cannot fetch blob:/localhost URLs from the browser.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);

const router = Router();

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || '';

// ─── helpers ────────────────────────────────────────────────────────────────

function falHeaders() {
  return {
    Authorization: `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function falPost(model: string, body: Record<string, unknown>) {
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: falHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => 'unknown error');
    throw new Error(`FAL ${model} error ${res.status}: ${txt}`);
  }
  return res.json();
}

// ─── POST /api/mastering/upload ──────────────────────────────────────
// Multipart audio upload → public https URL that FAL can fetch (blob:/localhost
// URLs from the browser dev fallback are NOT reachable by FAL).

/** Firebase Admin storage bucket (initialized by app bootstrap), or null. */
function getBucket(): any | null {
  try {
    const admin = nodeRequire('firebase-admin');
    if (admin.apps.length > 0) return admin.storage().bucket();
  } catch {
    /* not initialized */
  }
  return null;
}

async function uploadBufferToStorage(buf: Buffer, mimeType: string, ext: string): Promise<string> {
  const bucket = getBucket();
  if (!bucket) throw new Error('Storage not available on server');
  const fileName = `mastering/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const file = bucket.file(fileName);
  await file.save(buf, { metadata: { contentType: mimeType }, validation: false });
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

router.post('/upload', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const f = (req as any).file as { buffer: Buffer; mimetype?: string; originalname?: string } | undefined;
    if (!f?.buffer?.length) return res.status(400).json({ error: 'No audio file provided' });
    const ext = (f.originalname?.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
    const url = await uploadBufferToStorage(f.buffer, f.mimetype || 'audio/mpeg', ext);
    res.json({ success: true, audioUrl: url });
  } catch (err: any) {
    console.error('❌ mastering upload error:', err.message);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// ─── POST /api/mastering/master — REAL two-pass EBU R128 mastering ──────────
const MASTERING_PRESETS: Record<string, { label: string; i: number; tp: number; lra: number }> = {
  streaming: { label: 'Streaming (Spotify/YouTube)', i: -14, tp: -1.0, lra: 11 },
  tiktok:    { label: 'TikTok / Social',             i: -10, tp: -1.0, lra: 9  },
  club:      { label: 'Club / DJ',                   i: -8,  tp: -0.3, lra: 7  },
  radio:     { label: 'Radio / Broadcast',           i: -16, tp: -2.0, lra: 9  },
  podcast:   { label: 'Podcast / Voice',             i: -16, tp: -1.5, lra: 11 },
};

/** Run ffmpeg with a loudnorm filter and return the JSON it prints to stderr. */
async function runLoudnorm(ffmpegPath: string, args: string[]): Promise<{ json: any }> {
  const { stderr } = await execFileAsync(ffmpegPath, args, {
    timeout: 300_000,
    maxBuffer: 1024 * 1024 * 64,
  });
  const m = String(stderr).match(/\{[\s\S]*\}/);
  return { json: m ? JSON.parse(m[0]) : null };
}

router.post('/master', async (req: Request, res: Response) => {
  const tmpFiles: string[] = [];
  try {
    const { audioUrl, preset = 'streaming' } = req.body;
    if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' });
    const p = MASTERING_PRESETS[preset] || MASTERING_PRESETS.streaming;

    console.log(`[mastering] Master (${preset}: ${p.i} LUFS): ${String(audioUrl).slice(0, 100)}`);

    const dl = await fetch(audioUrl);
    if (!dl.ok) throw new Error(`Cannot fetch audio: ${dl.status}`);
    const srcBuf = Buffer.from(await dl.arrayBuffer());
    const srcPath = path.join(os.tmpdir(), `master-src-${Date.now()}`);
    const outPath = path.join(os.tmpdir(), `master-out-${Date.now()}.mp3`);
    tmpFiles.push(srcPath, outPath);
    fs.writeFileSync(srcPath, srcBuf);

    const ffmpegPath = nodeRequire('@ffmpeg-installer/ffmpeg').path as string;

    // PASS 1 — measure the track's real loudness (EBU R128)
    const pass1 = await runLoudnorm(ffmpegPath, [
      '-hide_banner', '-i', srcPath,
      '-af', `loudnorm=I=${p.i}:TP=${p.tp}:LRA=${p.lra}:print_format=json`,
      '-f', 'null', '-',
    ]);
    const measured = pass1.json;
    if (!measured?.input_i) throw new Error('Could not measure loudness (is the file valid audio?)');

    // PASS 2 — linear normalization using measured values (highest quality)
    const ln = `loudnorm=I=${p.i}:TP=${p.tp}:LRA=${p.lra}` +
      `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
      `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
      `:offset=${measured.target_offset}:linear=true:print_format=json`;
    const pass2 = await runLoudnorm(ffmpegPath, [
      '-hide_banner', '-y', '-i', srcPath,
      '-af', ln,
      '-ar', '44100', '-b:a', '320k', '-map', 'a',
      outPath,
    ]);
    const after = pass2.json;

    const outBuf = fs.readFileSync(outPath);
    const url = await uploadBufferToStorage(outBuf, 'audio/mpeg', 'mp3');

    console.log(`✅ Mastered: ${measured.input_i} → ${after?.output_i ?? p.i} LUFS`);
    res.json({
      success: true,
      audioUrl: url,
      preset,
      presetLabel: p.label,
      stats: {
        inputLufs: Number(measured.input_i),
        inputTruePeak: Number(measured.input_tp),
        inputLra: Number(measured.input_lra),
        targetLufs: p.i,
        targetTruePeak: p.tp,
        outputLufs: after ? Number(after.output_i) : p.i,
        outputTruePeak: after ? Number(after.output_tp) : p.tp,
      },
    });
  } catch (err: any) {
    console.error('❌ master error:', err.message);
    res.status(500).json({ error: 'Mastering failed', details: err.message });
  } finally {
    for (const f of tmpFiles) { try { fs.unlinkSync(f); } catch { /* cleanup */ } }
  }
});

// ─── POST /api/mastering/separate-stems ──────────────────────────────────
// fal-ai/demucs (verified schema). Output = TOP-LEVEL File per stem
// (vocals/drums/bass/other + guitar/piano for the 6s model).
router.post('/separate-stems', async (req: Request, res: Response) => {
  try {
    const { audioUrl, model = 'htdemucs_6s' } = req.body;
    if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' });
    if (!FAL_KEY)  return res.status(500).json({ error: 'FAL_KEY not configured' });

    const validModels = ['htdemucs', 'htdemucs_ft', 'htdemucs_6s', 'hdemucs_mmi', 'mdx', 'mdx_extra', 'mdx_q', 'mdx_extra_q'];
    const safeModel = validModels.includes(model) ? model : 'htdemucs_6s';
    const sixStems = safeModel === 'htdemucs_6s';

    console.log(`[mastering] Stem separation started (${safeModel}): ${audioUrl}`);

    const data = await falPost('fal-ai/demucs', {
      audio_url: audioUrl,
      model: safeModel,
      stems: sixStems
        ? ['vocals', 'drums', 'bass', 'other', 'guitar', 'piano']
        : ['vocals', 'drums', 'bass', 'other'],
      output_format: 'mp3',
    });

    // Verified: each stem is a top-level File ({url}). Legacy `stems` fallback kept.
    const src = (data?.vocals || data?.drums) ? data : (data?.stems || {});
    const stemUrl = (s: any) => s?.url || (typeof s === 'string' ? s : null);
    console.log('✅ Stem separation done');
    res.json({
      success: true,
      model: safeModel,
      stems: {
        vocals: stemUrl(src?.vocals),
        drums:  stemUrl(src?.drums),
        bass:   stemUrl(src?.bass),
        other:  stemUrl(src?.other),
        guitar: stemUrl(src?.guitar),
        piano:  stemUrl(src?.piano),
      },
    });
  } catch (err: any) {
    console.error('❌ separate-stems error:', err.message);
    res.status(500).json({ error: 'Stem separation failed', details: err.message });
  }
});

// ─── POST /api/mastering/transcribe ──────────────────────────────────────────
// Uses fal-ai/wizper (Whisper Large v3) to transcribe audio with timestamps.
// Body: { audioUrl: string, language?: string, task?: "transcribe" | "translate" }
// Returns: { text, chunks: [{ text, timestamp: [start, end] }] }
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioUrl, language, task = 'transcribe' } = req.body;
    if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' });
    if (!FAL_KEY)  return res.status(500).json({ error: 'FAL_KEY not configured' });

    console.log(`📝 Transcribing audio: ${audioUrl}`);

    const body: Record<string, unknown> = { audio_url: audioUrl, task, chunk_level: 'segment' };
    if (language) body.language = language;

    const data = await falPost('fal-ai/wizper', body);

    console.log('✅ Transcription done');
    res.json({
      success: true,
      text:   data?.text   || '',
      chunks: data?.chunks || [],
      languages: data?.languages || [],
    });
  } catch (err: any) {
    console.error('❌ transcribe error:', err.message);
    res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

// ─── POST /api/mastering/generate-beat ──────────────────────────────────────
// Primary: fal-ai/stable-audio-25/text-to-audio (≤190s, steps 4-8, output
// { audio: File }). Fallback: legacy fal-ai/stable-audio.
router.post('/generate-beat', async (req: Request, res: Response) => {
  try {
    const { prompt, seconds = 30 } = req.body;
    if (!prompt)  return res.status(400).json({ error: 'prompt is required' });
    if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

    const safeSeconds = Math.max(5, Math.min(190, Number(seconds) || 30));

    console.log(`🥁 Generating beat: "${prompt.slice(0, 60)}…" (${safeSeconds}s)`);

    let audioUrl: string | null = null;
    let modelUsed = 'fal-ai/stable-audio-25';
    try {
      const data = await falPost('fal-ai/stable-audio-25/text-to-audio', {
        prompt,
        seconds_total: safeSeconds,
        num_inference_steps: 8,
        guidance_scale: 7,
      });
      audioUrl = data?.audio?.url || (typeof data?.audio === 'string' ? data.audio : null);
    } catch (e: any) {
      console.warn('⚠️ stable-audio-25 failed, falling back to legacy stable-audio:', e.message);
      modelUsed = 'fal-ai/stable-audio';
      const data = await falPost('fal-ai/stable-audio', {
        prompt,
        seconds_start: 0,
        seconds_total: Math.min(safeSeconds, 47),
        steps: 100,
      });
      audioUrl = data?.audio_file?.url || data?.audio?.url || data?.url || null;
    }
    if (!audioUrl) throw new Error('No audio URL in FAL response');

    console.log(`✅ Beat generated (${modelUsed}): ${audioUrl}`);
    res.json({ success: true, audioUrl, prompt, seconds: safeSeconds, model: modelUsed });
  } catch (err: any) {
    console.error('❌ generate-beat error:', err.message);
    res.status(500).json({ error: 'Beat generation failed', details: err.message });
  }
});

// ─── POST /api/mastering/clone-voice ─────────────────────────────────────────
// fal-ai/f5-tts (verified schema): gen_text ≤5000 chars, model_type REQUIRED
// (F5-TTS | E2-TTS), remove_silence default true. Output: { audio_url: File }.
router.post('/clone-voice', async (req: Request, res: Response) => {
  try {
    const { refAudioUrl, refText = '', genText, modelType = 'F5-TTS' } = req.body;
    if (!refAudioUrl) return res.status(400).json({ error: 'refAudioUrl is required' });
    if (!genText)     return res.status(400).json({ error: 'genText is required' });
    if (!FAL_KEY)     return res.status(500).json({ error: 'FAL_KEY not configured' });

    const safeText = String(genText).slice(0, 5000);
    const safeModel = ['F5-TTS', 'E2-TTS'].includes(modelType) ? modelType : 'F5-TTS';

    console.log(`🎤 Cloning voice for: "${safeText.slice(0, 60)}…"`);

    const data = await falPost('fal-ai/f5-tts', {
      gen_text:      safeText,
      ref_audio_url: refAudioUrl,
      ref_text:      refText,
      model_type:    safeModel,
      remove_silence: true,
    });

    // fal-ai/f5-tts returns { audio_url: { url } } or { audio: { url } }
    const audioUrl = data?.audio_url?.url || data?.audio?.url || data?.url || null;
    if (!audioUrl) throw new Error('No audio URL in FAL response');

    console.log(`✅ Voice cloned: ${audioUrl}`);
    res.json({ success: true, audioUrl });
  } catch (err: any) {
    console.error('❌ clone-voice error:', err.message);
    res.status(500).json({ error: 'Voice cloning failed', details: err.message });
  }
});

// ─── GET /api/mastering/status ───────────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    fal: { configured: !!FAL_KEY },
    mastering: { engine: 'ffmpeg loudnorm (EBU R128, two-pass)', presets: Object.keys(MASTERING_PRESETS) },
    models: {
      stemSeparation:  'fal-ai/demucs (htdemucs_6s)',
      transcription:   'fal-ai/wizper',
      beatGeneration:  'fal-ai/stable-audio-25/text-to-audio',
      voiceClone:      'fal-ai/f5-tts',
    },
  });
});

export default router;
