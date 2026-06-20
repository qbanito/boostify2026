/**
 * Lyrics Video Routes — /api/lyrics-video
 * 
 * POST   /transcribe          — Whisper word-level transcription
 * POST   /render              — Kick off Remotion render job (async)
 * GET    /:jobId/status       — Poll render progress
 * POST   /:jobId/upload-youtube — Upload rendered MP4 to YouTube (OAuth2)
 */

import { Router } from 'express';
import { z } from 'zod';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { transcribeWithWords } from '../agents/whisper-agent';
import type { WordTranscriptionResult } from '../agents/whisper-agent';

const router = Router();

/**
 * Keep lyrics-video endpoints self-healing in environments where the migration
 * has not been applied yet (common in dev/staging). This prevents runtime 500s
 * like "relation lyrics_video_jobs does not exist".
 */
async function ensureLyricsVideoJobsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lyrics_video_jobs (
      id            SERIAL PRIMARY KEY,
      artist_id     INTEGER,
      song_id       INTEGER,
      status        TEXT DEFAULT 'transcribed',
      segments_json JSONB,
      words_json    JSONB,
      duration_secs INTEGER,
      song_title    TEXT,
      artist_name   TEXT,
      cover_art_url TEXT,
      audio_url     TEXT,
      progress      INTEGER DEFAULT 0,
      theme         TEXT,
      accent_color  TEXT,
      font_family   TEXT,
      input_props_json JSONB,
      output_url    TEXT,
      youtube_url   TEXT,
      error_msg     TEXT,
      created_at    TIMESTAMPTZ DEFAULT now(),
      updated_at    TIMESTAMPTZ DEFAULT now()
    )
  `);
  // Self-heal older DBs created by the migration: the song_id FK to songs(id) is
  // too fragile because the song picker is sourced from Firestore (string ids),
  // so song_id may not map to a Postgres songs.id. We drop the FK and keep the
  // original Firestore id in a separate text column for reference.
  await pool.query(`ALTER TABLE lyrics_video_jobs DROP CONSTRAINT IF EXISTS lyrics_video_jobs_song_id_fkey`);
  await pool.query(`ALTER TABLE lyrics_video_jobs ADD COLUMN IF NOT EXISTS firestore_song_id TEXT`);
}

/**
 * Resolves the raw songId coming from the client (which may be a Postgres
 * integer id OR a Firestore document id string) into a safe pair:
 *   - pgSongId: a valid songs.id that actually exists in Postgres, else null
 *   - firestoreSongId: the original non-numeric id (Firestore doc id), else null
 * This prevents foreign-key / type violations on lyrics_video_jobs.song_id.
 */
async function resolveSongIds(raw: unknown): Promise<{ pgSongId: number | null; firestoreSongId: string | null }> {
  let pgSongId: number | null = null;
  let firestoreSongId: string | null = null;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    pgSongId = Math.trunc(raw);
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      pgSongId = parseInt(trimmed, 10);
    } else if (trimmed) {
      firestoreSongId = trimmed;
    }
  }

  // Verify the numeric id really exists in Postgres; if not, treat it as a
  // reference id (store as firestore_song_id) and null out song_id.
  if (pgSongId != null) {
    try {
      const { rows } = await pool.query('SELECT 1 FROM songs WHERE id = $1 LIMIT 1', [pgSongId]);
      if (rows.length === 0) {
        if (!firestoreSongId) firestoreSongId = String(pgSongId);
        pgSongId = null;
      }
    } catch {
      // If the lookup fails for any reason, don't risk an FK violation.
      if (!firestoreSongId && pgSongId != null) firestoreSongId = String(pgSongId);
      pgSongId = null;
    }
  }

  return { pgSongId, firestoreSongId };
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory job progress store (persisted to DB)
// ─────────────────────────────────────────────────────────────────────────────

const renderProgress: Map<number, { progress: number; status: string; log: string }> = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/lyrics-video/transcribe
// ─────────────────────────────────────────────────────────────────────────────

const transcribeSchema = z.object({
  audioUrl: z.string().url(),
  // May arrive as a Postgres integer id OR a Firestore document id string —
  // kept raw here and normalized via resolveSongIds() before insert.
  songId: z.union([z.number(), z.string()]).optional(),
  songTitle: z.string().optional(),
  artistName: z.string().optional(),
  coverArtUrl: z.string().url().optional(),
  artistId: z.union([z.number().int(), z.string().transform(v => parseInt(v, 10))]).optional(),
});

router.post('/transcribe', authenticate, async (req, res) => {
  try {
    await ensureLyricsVideoJobsTable();
    const { audioUrl, songId, songTitle, artistName, coverArtUrl, artistId: bodyArtistId } = transcribeSchema.parse(req.body);
    const userId: number = ((req as any).user?.id as number) || bodyArtistId as number;

    if (!userId) {
      return res.status(400).json({ error: 'Could not resolve artist — please reload and try again' });
    }

    console.log(`🎙️ [LyricsVideo] Transcribing: ${audioUrl}`);
    const result = await transcribeWithWords(audioUrl);

    if (!result) {
      return res.status(500).json({ error: 'Transcription failed — check audio URL' });
    }

    // Create job row
    const { pgSongId, firestoreSongId } = await resolveSongIds(songId);
    const { rows: [row] } = await pool.query<{ id: number }>(`
      INSERT INTO lyrics_video_jobs
        (artist_id, song_id, firestore_song_id, status, segments_json, words_json, duration_secs,
         song_title, artist_name, cover_art_url, audio_url)
      VALUES ($1,$2,$3,'transcribed',$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `, [
      userId,
      pgSongId,
      firestoreSongId,
      JSON.stringify(result.segments),
      JSON.stringify(result.words),
      result.duration ?? null,
      songTitle ?? null,
      artistName ?? null,
      coverArtUrl ?? null,
      audioUrl,
    ]);

    const jobId: number = row.id;

    return res.json({
      jobId,
      text: result.text,
      language: result.language,
      duration: result.duration,
      segments: result.segments,
      words: result.words,
    });
  } catch (err: any) {
    console.error('[LyricsVideo] /transcribe error:', err);
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/lyrics-video/render
// ─────────────────────────────────────────────────────────────────────────────

const renderSchema = z.object({
  jobId: z.number().int(),
  theme: z.enum(['dark', 'light', 'gradient', 'blur']).default('dark'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7c3aed'),
  fontFamily: z.string().default('Inter'),
  showProgressBar: z.boolean().default(true),
  showWatermark: z.boolean().default(true),
});

router.post('/render', authenticate, async (req, res) => {
  try {
    await ensureLyricsVideoJobsTable();
    const { jobId, theme, accentColor, fontFamily, showProgressBar, showWatermark } =
      renderSchema.parse(req.body);
    const userId = (req as any).user?.id as number;

    // Load job
    const { rows } = await pool.query(
      `SELECT * FROM lyrics_video_jobs WHERE id=$1 AND artist_id=$2`, [jobId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    const job = rows[0];

    const segments = job.segments_json as any[];
    if (!segments?.length) {
      return res.status(400).json({ error: 'No transcription data — run /transcribe first' });
    }

    const durationSecs = Number(job.duration_secs) || 180;
    const durationFrames = Math.ceil(durationSecs * 30) + 30; // +1 s buffer

    const inputProps = {
      audioUrl: job.audio_url,
      coverArt: job.cover_art_url ?? undefined,
      artistName: job.artist_name ?? 'Artist',
      songTitle: job.song_title ?? 'Lyrics Video',
      segments,
      theme,
      accentColor,
      fontFamily,
      showProgressBar,
      showWatermark,
      durationSecs,
    };

    // Update job status
    await pool.query(
      `UPDATE lyrics_video_jobs SET status='rendering', progress=0, theme=$2, accent_color=$3,
       font_family=$4, input_props_json=$5, updated_at=NOW() WHERE id=$1`,
      [jobId, theme, accentColor, fontFamily, JSON.stringify(inputProps)]
    );
    renderProgress.set(jobId, { progress: 0, status: 'rendering', log: '' });

    // Kick off render asynchronously
    const outDir = path.join(process.cwd(), 'out', 'lyrics-videos');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `lyrics-video-${jobId}.mp4`);
    const propsJson = JSON.stringify({ ...inputProps, durationFrames });

    // Write props to a temp file instead of passing inline on the command line.
    // Inline JSON breaks the shell parser because audio/cover URLs contain '&',
    // spaces and quotes (e.g. Firebase "?alt=media&token=..."), which corrupts
    // the argument and makes Remotion fail with "input is parseable using JSON.parse".
    const propsFile = path.join(outDir, `props-${jobId}.json`);
    fs.writeFileSync(propsFile, propsJson, 'utf-8');

    // The lyrics-video composition only uses remote URLs (audio/cover art) and
    // never calls staticFile(), so it does NOT need the project's public/ folder.
    // By default Remotion copies the ENTIRE public/ dir (~440 MB here) into the
    // bundle on every render — on a resource-constrained host (Render.com) that
    // fills the ephemeral disk and makes the render crash/time out. Point
    // --public-dir at a tiny empty directory to skip the copy entirely.
    const emptyPublicDir = path.join(outDir, '.empty-public');
    fs.mkdirSync(emptyPublicDir, { recursive: true });

    // Adaptive concurrency: a fixed concurrency of 2 made long songs take hours
    // (e.g. 11k frames ≈ 2h20m). Scale with the host's core count so multi-core
    // machines render far faster, while still leaving a core free for the Node
    // event loop / dev server so /status polls stay responsive. Override with
    // LYRICS_RENDER_CONCURRENCY when needed.
    const cpuCount = Math.max(1, os.cpus()?.length ?? 2);
    const renderConcurrency = Math.max(
      2,
      Math.min(
        Number(process.env.LYRICS_RENDER_CONCURRENCY) || Math.floor(cpuCount * 0.6),
        8,
      ),
    );

    // Spawn remotion render.
    // Concurrency is now adaptive (see above). `nice` keeps the workers at a
    // lower OS priority so headless Chrome + ffmpeg don't fully starve the Node
    // event loop, keeping the dev server / progress polling responsive.
    const child = spawn(
      'nice',
      [
        '-n', '15',
        'npx', 'remotion', 'render',
        'remotion/index.ts',
        'LyricsVideoHorizontal',
        outFile,
        '--props', propsFile,
        '--public-dir', emptyPublicDir,
        '--frames', `0-${durationFrames - 1}`,
        '--codec', 'h264',
        '--image-format', 'jpeg',
        '--jpeg-quality', '80',
        '--concurrency', String(renderConcurrency),
      ],
      {
        cwd: process.cwd(),
        shell: true,
        env: { ...process.env },
      }
    );

    // Accumulate the full render output so we can persist the REAL failure
    // reason. Previously only the last 200 chars of the *last* stream chunk
    // were stored, which captured the stack-trace tail and threw away the
    // actual error line (e.g. "Could not launch browser" / disk full), making
    // production failures impossible to diagnose.
    let renderOutputTail = '';
    const appendOutput = (chunk: Buffer) => {
      renderOutputTail = (renderOutputTail + chunk.toString()).slice(-4000);
    };

    // Kill the render process if it runs too long (prevents stuck jobs). The
    // limit scales with the clip length so long songs (10k+ frames) aren't
    // killed mid-render, while short clips still fail fast. ~1.2s/frame budget,
    // clamped to 20–90 min.
    const RENDER_TIMEOUT_MS = Math.min(
      90 * 60 * 1000,
      Math.max(20 * 60 * 1000, durationFrames * 1200),
    );
    const renderTimeoutId = setTimeout(async () => {
      if (!child.exitCode && !child.killed) {
        child.kill('SIGTERM');
        const limitMin = Math.round(RENDER_TIMEOUT_MS / 60000);
        await pool.query(
          `UPDATE lyrics_video_jobs SET status='failed', error_msg=$2, updated_at=NOW() WHERE id=$1`,
          [jobId, `Render timed out (${limitMin} min limit)`]
        );
        renderProgress.set(jobId, { progress: 0, status: 'failed', log: `Render timed out after ${limitMin} minutes` });
      }
    }, RENDER_TIMEOUT_MS);

    // Parse Remotion progress from a stream chunk. Remotion writes progress to
    // BOTH stdout and stderr depending on phase/TTY, and the wording varies by
    // version ("Rendering frame 12/120", "Rendered 12/120", "12/120 frames",
    // bare "12/120", or "45%"). Parse all of them so the bar actually advances.
    const handleProgressChunk = (chunk: Buffer) => {
      appendOutput(chunk);
      const text = chunk.toString();
      let pct: number | null = null;
      const frac = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (frac) {
        const cur = parseInt(frac[1], 10);
        const total = parseInt(frac[2], 10);
        if (total > 0 && cur <= total) pct = Math.floor((cur / total) * 100);
      }
      if (pct === null) {
        const pctMatch = text.match(/(\d{1,3})\s*%/);
        if (pctMatch) {
          const p = parseInt(pctMatch[1], 10);
          if (p >= 0 && p <= 100) pct = p;
        }
      }
      const existing = renderProgress.get(jobId);
      const log = text.replace(/[\r\n]+/g, ' ').slice(-200);
      if (pct !== null) {
        // Never let the reported progress go backwards (encoding phase resets counters).
        const nextPct = Math.max(pct, existing?.progress ?? 0);
        renderProgress.set(jobId, { progress: nextPct, status: 'rendering', log });
        pool.query(`UPDATE lyrics_video_jobs SET progress=$2, updated_at=NOW() WHERE id=$1`, [jobId, nextPct]).catch(() => {});
      } else {
        renderProgress.set(jobId, { ...(existing ?? { progress: 0, status: 'rendering' }), log });
      }
    };

    child.stdout?.on('data', handleProgressChunk);
    child.stderr?.on('data', handleProgressChunk);

    child.on('close', async (code: number) => {
      clearTimeout(renderTimeoutId); // Cancel watchdog timer
      // Clean up the temp props file regardless of outcome.
      try { fs.unlinkSync(propsFile); } catch { /* ignore */ }
      if (code === 0 && fs.existsSync(outFile)) {
        // Upload to Firebase Storage
        try {
          const { getStorage } = await import('firebase-admin/storage');
          const adminStorage = getStorage();
          const bucket = adminStorage.bucket();
          const destPath = `lyrics-videos/${jobId}/lyrics-video-${jobId}.mp4`;
          await bucket.upload(outFile, {
            destination: destPath,
            metadata: { contentType: 'video/mp4' },
          });
          const [file] = await bucket.file(destPath).getSignedUrl({
            action: 'read',
            expires: '03-01-2030',
          });
          const downloadUrl = file;
          await pool.query(
            `UPDATE lyrics_video_jobs SET status='done', progress=100, output_url=$2, updated_at=NOW() WHERE id=$1`,
            [jobId, downloadUrl]
          );
          renderProgress.set(jobId, { progress: 100, status: 'done', log: 'Upload complete' });
          fs.unlinkSync(outFile);
        } catch (uploadErr: any) {
          // Save local path as fallback
          await pool.query(
            `UPDATE lyrics_video_jobs SET status='done', progress=100, output_url=$2, updated_at=NOW() WHERE id=$1`,
            [jobId, `/out/lyrics-videos/lyrics-video-${jobId}.mp4`]
          );
          renderProgress.set(jobId, { progress: 100, status: 'done', log: 'Render complete (local)' });
        }
      } else {
        // Prefer the full accumulated output (real error) over the last
        // progress-chunk tail, which only held the stack-trace end.
        const errLog = (renderOutputTail || renderProgress.get(jobId)?.log || 'Unknown render error')
          .replace(/[\r\n]+/g, ' ')
          .trim();
        console.error(`[LyricsVideo] Render job ${jobId} failed (exit ${code}):`, errLog.slice(-1500));
        await pool.query(
          `UPDATE lyrics_video_jobs SET status='failed', error_msg=$2, updated_at=NOW() WHERE id=$1`,
          [jobId, errLog.slice(-1500)]
        );
        renderProgress.set(jobId, { progress: 0, status: 'failed', log: errLog.slice(-500) });
      }
    });

    return res.json({ jobId, status: 'rendering', message: 'Render started' });
  } catch (err: any) {
    console.error('[LyricsVideo] /render error:', err);
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/lyrics-video/:jobId/status
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:jobId/status', authenticate, async (req, res) => {
  try {
    await ensureLyricsVideoJobsTable();
    const jobId = parseInt(req.params.jobId, 10);
    const userId = (req as any).user?.id as number;

    const { rows } = await pool.query(
      `SELECT id, status, progress, output_url, youtube_url, error_msg, duration_secs,
              song_title, artist_name, cover_art_url, theme, accent_color, created_at
       FROM lyrics_video_jobs WHERE id=$1 AND artist_id=$2`,
      [jobId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });

    const job = rows[0];
    // Merge in-memory progress (more up-to-date during active render)
    const mem = renderProgress.get(jobId);

    return res.json({
      ...job,
      progress: mem?.progress ?? job.progress,
      status: mem?.status ?? job.status,
      log: mem?.log,
    });
  } catch (err: any) {
    console.error('[LyricsVideo] /status error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/lyrics-video/public-videos?artistId=X — public: list completed videos for an artist
// ─────────────────────────────────────────────────────────────────────────────

router.get('/public-videos', async (req, res) => {
  try {
    await ensureLyricsVideoJobsTable();
    const artistId = parseInt(req.query.artistId as string, 10);
    if (!artistId || isNaN(artistId)) return res.json({ jobs: [] });
    const { rows } = await pool.query(
      `SELECT id, status, output_url, youtube_url, song_title, artist_name, cover_art_url, created_at
       FROM lyrics_video_jobs WHERE artist_id=$1 AND status='done' AND output_url IS NOT NULL
       ORDER BY created_at DESC LIMIT 20`,
      [artistId]
    );
    return res.json({ jobs: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/lyrics-video/my-jobs  — list all jobs for user
// ─────────────────────────────────────────────────────────────────────────────

router.get('/my-jobs', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id as number;
    const { rows } = await pool.query(
      `SELECT id, status, progress, output_url, youtube_url, duration_secs,
              song_title, artist_name, cover_art_url, theme, accent_color, created_at
       FROM lyrics_video_jobs WHERE artist_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    return res.json({ jobs: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/lyrics-video/:jobId/upload-youtube
// Requires the artist to have connected their YouTube channel via OAuth2.
// The frontend should obtain an OAuth2 access token through Google Sign-In
// and pass it in the Authorization header as "Bearer <access_token>".
// ─────────────────────────────────────────────────────────────────────────────

const ytUploadSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  privacyStatus: z.enum(['public', 'unlisted', 'private']).default('public'),
  // Optional: a Google OAuth2 access token from a client-side Google Sign-In.
  // When omitted, the server uses the token the artist stored via
  // /api/auth/youtube/connect (server-side OAuth flow).
  accessToken: z.string().min(1).optional(),
});

router.post('/:jobId/upload-youtube', authenticate, async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const userId = (req as any).user?.id as number;
    const { title, description, tags, privacyStatus, accessToken } = ytUploadSchema.parse(req.body);

    // Resolve the access token: explicit body token wins, otherwise fall back to
    // the artist's server-stored YouTube connection.
    let resolvedToken = accessToken;
    if (!resolvedToken) {
      try {
        const { getValidAccessToken } = await import('../services/youtube-service');
        resolvedToken = (await getValidAccessToken(userId)) || undefined;
      } catch (e: any) {
        console.warn('[LyricsVideo] stored YouTube token lookup failed:', e?.message);
      }
    }
    if (!resolvedToken) {
      return res.status(412).json({
        error: 'YouTube account not connected',
        needsConnect: true,
        instructions: 'Connect your YouTube channel via /api/auth/youtube/connect, then retry.',
      });
    }

    const { rows } = await pool.query(
      `SELECT * FROM lyrics_video_jobs WHERE id=$1 AND artist_id=$2 AND status='done'`,
      [jobId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found or not ready' });
    const job = rows[0];

    if (!job.output_url) {
      return res.status(400).json({ error: 'No rendered video available for this job' });
    }

    // Dynamic import of googleapis (may not be installed)
    let google: any;
    try {
      // @ts-ignore - optional dependency, gracefully handled below
      ({ google } = await import('googleapis'));
    } catch {
      return res.status(501).json({
        error: 'googleapis package not installed',
        instructions: 'Run: npm install googleapis',
      });
    }

    // Download video from Firebase/output URL
    const videoResponse = await fetch(job.output_url);
    if (!videoResponse.ok) throw new Error(`Cannot fetch video: ${videoResponse.status}`);
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const tempVideoPath = path.join(process.cwd(), 'uploads', `yt_upload_${jobId}.mp4`);
    fs.writeFileSync(tempVideoPath, videoBuffer);

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: resolvedToken });

      const youtube = google.youtube({ version: 'v3', auth });

      const uploadResponse = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            tags,
            categoryId: '10', // Music
          },
          status: {
            privacyStatus,
          },
        },
        media: {
          body: fs.createReadStream(tempVideoPath),
        },
      });

      const youtubeUrl = `https://www.youtube.com/watch?v=${uploadResponse.data.id}`;

      await pool.query(
        `UPDATE lyrics_video_jobs SET youtube_url=$2, updated_at=NOW() WHERE id=$1`,
        [jobId, youtubeUrl]
      );

      return res.json({ youtubeUrl, videoId: uploadResponse.data.id });
    } finally {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    }
  } catch (err: any) {
    console.error('[LyricsVideo] /upload-youtube error:', err);
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

export default router;
