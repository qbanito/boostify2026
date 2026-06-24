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
import { db as firestoreDb } from '../firebase';
import {
  isLambdaConfigured,
  startLambdaRender,
  getLambdaRenderProgress,
  downloadLambdaRender,
} from '../services/remotion-lambda';
import type { LambdaRenderHandle } from '../services/remotion-lambda';

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
      lambda_handle_json JSONB,
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
  // Persist the Lambda render handle so an in-progress render can be RESUMED
  // after a server restart instead of being lost (the poll loop is in-memory).
  await pool.query(`ALTER TABLE lyrics_video_jobs ADD COLUMN IF NOT EXISTS lambda_handle_json JSONB`);
  // Dedicated cinematic YouTube thumbnail (Netflix-style poster), kept separate
  // from cover_art_url so regenerating it never alters the video background.
  await pool.query(`ALTER TABLE lyrics_video_jobs ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`);
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

/**
 * Strip Remotion's noisy "Version mismatch" warning block from captured render
 * output. That block is only a WARNING (zod 3 vs the version Remotion prefers) —
 * it does NOT block the render. But because it is verbose and printed at the
 * very start (before bundling), it used to be the only thing left in the output
 * tail whenever a render was cut short (e.g. the dev server restarted mid-render),
 * so every interrupted job was mis-reported as a "zod" failure. Removing it lets
 * the REAL error (or interruption) surface in error_msg.
 */
function cleanRenderOutput(text: string): string {
  return text
    .replace(/-{3,}\s*Version mismatch:[\s\S]*?-{3,}/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * On every server start, any job still marked 'rendering' is potentially an
 * orphan: the poll loop that downloads + finalizes the MP4 runs in-process, so a
 * server restart (tsx watch in dev, redeploy/OOM in prod) kills it.
 *
 * For LAMBDA renders we persist the render handle (lambda_handle_json), so we can
 * RESUME: re-attach to the AWS render, and if it already finished, download the
 * MP4 from S3 and finalize the job — NO work is lost. Only jobs WITHOUT a Lambda
 * handle (local spawn renders, which truly die with the process) are marked
 * failed with a clear, retryable message.
 */
async function resumeLambdaJob(jobId: number, handle: LambdaRenderHandle): Promise<void> {
  try {
    renderProgress.set(jobId, { progress: 0, status: 'rendering', log: 'resuming lambda render' });
    await pollAndFinalizeLambda(jobId, handle);
    console.log(`[LyricsVideo] Resumed + finalized Lambda render job ${jobId} after restart`);
  } catch (err: any) {
    const msg = (err?.message || 'Lambda render failed after resume').slice(0, 1500);
    console.error(`[LyricsVideo] Resume of Lambda render job ${jobId} failed:`, msg);
    await pool.query(
      `UPDATE lyrics_video_jobs SET status='failed', error_msg=$2, updated_at=NOW() WHERE id=$1`,
      [jobId, msg]
    ).catch(() => {});
    renderProgress.set(jobId, { progress: 0, status: 'failed', log: msg });
  }
}

async function reconcileOrphanedRenders(): Promise<void> {
  try {
    await ensureLyricsVideoJobsTable();
    const lambdaConfigured = isLambdaConfigured();
    const { rows } = await pool.query<{ id: number; lambda_handle_json: LambdaRenderHandle | null }>(
      `SELECT id, lambda_handle_json FROM lyrics_video_jobs WHERE status='rendering'`
    );
    let resumed = 0;
    const failIds: number[] = [];
    for (const row of rows) {
      const handle = row.lambda_handle_json;
      if (lambdaConfigured && handle && handle.renderId && handle.bucketName) {
        resumed++;
        void resumeLambdaJob(row.id, handle); // fire-and-forget; finalizes if S3 render is done
      } else {
        failIds.push(row.id);
      }
    }
    if (resumed) console.log(`[LyricsVideo] Resuming ${resumed} in-progress Lambda render(s) after restart`);
    if (failIds.length) {
      await pool.query(
        `UPDATE lyrics_video_jobs
           SET status='failed',
               error_msg=$2,
               updated_at=NOW()
         WHERE id = ANY($1)`,
        [failIds, 'Render interrumpido \u2014 el servidor se reinici\u00f3 antes de terminar. Vuelve a intentar el render.']
      );
      console.log(`[LyricsVideo] Reconciled ${failIds.length} orphaned (non-Lambda) 'rendering' job(s) on boot`);
    }
  } catch {
    /* table may not exist yet on a brand-new DB — ignore */
  }
}
void reconcileOrphanedRenders();

/**
 * Upload a finished MP4 (rendered locally OR downloaded from Lambda/S3) to
 * Firebase Storage and finalize the job row. Shared by both render paths.
 */
async function finalizeRenderedVideo(jobId: number, outFile: string): Promise<void> {
  try {
    const { getStorage } = await import('firebase-admin/storage');
    const bucket = getStorage().bucket();
    const destPath = `lyrics-videos/${jobId}/lyrics-video-${jobId}.mp4`;
    await bucket.upload(outFile, {
      destination: destPath,
      metadata: { contentType: 'video/mp4' },
    });
    const [downloadUrl] = await bucket.file(destPath).getSignedUrl({
      action: 'read',
      expires: '03-01-2030',
    });
    await pool.query(
      `UPDATE lyrics_video_jobs SET status='done', progress=100, output_url=$2, updated_at=NOW() WHERE id=$1`,
      [jobId, downloadUrl]
    );
    renderProgress.set(jobId, { progress: 100, status: 'done', log: 'Upload complete' });
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
  } catch (uploadErr) {
    // Save local path as fallback so the render isn't lost.
    await pool.query(
      `UPDATE lyrics_video_jobs SET status='done', progress=100, output_url=$2, updated_at=NOW() WHERE id=$1`,
      [jobId, `/out/lyrics-videos/lyrics-video-${jobId}.mp4`]
    );
    renderProgress.set(jobId, { progress: 100, status: 'done', log: 'Render complete (local)' });
  }
}

// True for transient AWS Lambda concurrency/rate-limit errors that are worth
// retrying after a backoff (vs. real fatal render errors).
function isLambdaRateLimitError(msg: string): boolean {
  const m = (msg || '').toLowerCase();
  return (
    m.includes('rate exceeded') ||
    m.includes('concurrency limit') ||
    m.includes('toomanyrequests') ||
    m.includes('throttl') ||
    m.includes('reservedfunctionconcurrency')
  );
}

/**
 * Render the lyrics video on AWS Lambda (massively parallel) and finalize the
 * job. Used when REMOTION_LAMBDA_* env vars are configured. This avoids spawning
 * a single CPU-bound local process — critical on memory-constrained hosts like
 * Render.com where a full local render OOM-crashes or takes ~1h.
 */
async function runLambdaRender(params: {
  jobId: number;
  inputProps: Record<string, unknown>;
  durationFrames: number;
}): Promise<void> {
  const { jobId, inputProps, durationFrames } = params;

  // Default to 720p on Lambda too: fewer pixels/frame = faster per-frame render,
  // which matters because each lambda renders a big frame chunk (~1300+ frames
  // for long songs) and must finish within the function timeout. Set
  // LYRICS_RENDER_SCALE=1 for native 1080p.
  const scaleEnv = Number(process.env.LYRICS_RENDER_SCALE);
  const scale = Number.isFinite(scaleEnv) && scaleEnv > 0 && scaleEnv <= 1 ? scaleEnv : 0.6667;

  // Bound the number of parallel Lambda invocations. Brand-new AWS accounts
  // have a Lambda concurrency quota of just 10, so firing the default (many)
  // parallel functions throws "AWS Concurrency limit reached (Rate Exceeded)".
  // We cap the function count via framesPerLambda = ceil(frames / maxFns) so
  // the render stays under the quota (default 5 = 5 renderer + 1 main = 6, well
  // under 10 with burst headroom). Raise REMOTION_LAMBDA_MAX_FUNCTIONS once the
  // account's concurrency limit is increased for full parallel speed.
  const maxFunctions = Math.max(1, Number(process.env.REMOTION_LAMBDA_MAX_FUNCTIONS) || 5);
  const framesPerLambda = Math.max(20, Math.ceil(durationFrames / maxFunctions));

  // Retry the whole render on transient concurrency/rate-limit errors with
  // exponential backoff. This is what makes album batches survive the 10-lambda
  // account quota: a song that momentarily can't get capacity waits and retries
  // instead of failing permanently.
  const maxAttempts = Math.max(1, Number(process.env.REMOTION_LAMBDA_RETRY_ATTEMPTS) || 5);
  let lastErr: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const handle = await startLambdaRender({
        composition: 'LyricsVideoHorizontal',
        inputProps: { ...inputProps, durationFrames },
        jpegQuality: 80,
        scale,
        framesPerLambda,
      });

      // Persist the handle IMMEDIATELY so that if the server restarts mid-render
      // (tsx watch in dev, redeploy/OOM in prod), the render isn't lost: on boot
      // reconcileOrphanedRenders() re-attaches to this handle and finalizes the
      // already-rendered MP4 from S3 instead of marking the job failed.
      await pool.query(
        `UPDATE lyrics_video_jobs SET lambda_handle_json=$2, updated_at=NOW() WHERE id=$1`,
        [jobId, JSON.stringify(handle)]
      ).catch(() => {});

      await pollAndFinalizeLambda(jobId, handle);
      return; // success
    } catch (err: any) {
      lastErr = err;
      const msg = (err?.message || 'Lambda render failed').slice(0, 1500);
      const retryable = isLambdaRateLimitError(msg);
      if (retryable && attempt < maxAttempts) {
        // Exponential backoff with jitter: 20s, 40s, 80s, 160s (+0-5s jitter).
        const waitMs = Math.min(20_000 * 2 ** (attempt - 1), 180_000) + Math.floor(Math.random() * 5000);
        console.warn(`[LyricsVideo] job ${jobId} hit AWS rate/concurrency limit (attempt ${attempt}/${maxAttempts}); retrying in ${Math.round(waitMs / 1000)}s`);
        renderProgress.set(jobId, { progress: 0, status: 'rendering', log: `esperando capacidad de AWS (reintento ${attempt}/${maxAttempts})` });
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      break; // non-retryable, or out of attempts
    }
  }

  const finalMsg = (lastErr?.message || 'Lambda render failed').slice(0, 1500);
  const friendly = isLambdaRateLimitError(finalMsg)
    ? 'Límite de concurrencia de AWS Lambda alcanzado tras varios reintentos. Aumenta la cuota de Lambda (Service Quotas L-B99A9384) o reintenta más tarde.'
    : finalMsg;
  console.error(`[LyricsVideo] Lambda render job ${jobId} failed:`, finalMsg);
  await pool.query(
    `UPDATE lyrics_video_jobs SET status='failed', error_msg=$2, updated_at=NOW() WHERE id=$1`,
    [jobId, friendly]
  ).catch(() => {});
  renderProgress.set(jobId, { progress: 0, status: 'failed', log: friendly });
}

/**
 * Poll a Lambda render to completion, then download + finalize. Extracted so it
 * can be reused both by a fresh render (runLambdaRender) and by the boot-time
 * resume path (reconcileOrphanedRenders) after a server restart.
 */
async function pollAndFinalizeLambda(jobId: number, handle: LambdaRenderHandle): Promise<void> {
  const outDir = path.join(process.cwd(), 'out', 'lyrics-videos');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `lyrics-video-${jobId}.mp4`);

  // Poll progress until done. Lambda renders in parallel chunks so this is
  // usually a few minutes even for long songs.
  const deadline = Date.now() + 30 * 60 * 1000; // 30 min hard cap
  let consecutiveErrors = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    let prog;
    try {
      prog = await getLambdaRenderProgress(handle);
      consecutiveErrors = 0;
    } catch {
      // Transient AWS hiccup — retry a few times before giving up.
      if (++consecutiveErrors > 10) throw new Error('Lambda progress polling failed repeatedly');
      continue;
    }
    if (prog.fatalError) throw new Error(prog.fatalError);
    renderProgress.set(jobId, { progress: prog.progress, status: 'rendering', log: `lambda ${prog.progress}%` });
    pool.query(
      `UPDATE lyrics_video_jobs SET progress=$2, updated_at=NOW() WHERE id=$1`,
      [jobId, prog.progress]
    ).catch(() => {});
    if (prog.done) break;
    if (Date.now() > deadline) throw new Error('Lambda render timed out (30 min limit)');
  }

  // Download the stitched MP4 from S3, then re-upload to Firebase so the
  // output URL is consistent with the local-render path.
  await downloadLambdaRender(handle, outFile);
  await finalizeRenderedVideo(jobId, outFile);
  // Render is finalized — clear the saved handle so it isn't re-resumed.
  await pool.query(
    `UPDATE lyrics_video_jobs SET lambda_handle_json=NULL, updated_at=NOW() WHERE id=$1`,
    [jobId]
  ).catch(() => {});
}

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
    // Resolver el nombre del artista del PERFIL que se está viendo.
    // El cliente manda el nombre del perfil (p.ej. "REDWINE CONTROL"), que es
    // la fuente correcta — el usuario logueado (userId) puede ser un row distinto
    // sin artist_name. Si el cliente no lo manda, lo buscamos por el id de perfil
    // (bodyArtistId) y por último por userId.
    const resolvedArtistName = await resolveProfileArtistName(artistName, bodyArtistId, userId);
    // Los videos pertenecen al PERFIL del artista que se está viendo (bodyArtistId,
    // p.ej. un artista creado por IA con id distinto al del usuario logueado), no
    // a la cuenta que los crea. Guardamos bajo el id del perfil SOLO si el usuario
    // es su dueño; si no, bajo su propio id. Así la galería pública del perfil y la
    // del dueño encuentran los videos de forma consistente.
    let storeArtistId = userId;
    if (bodyArtistId && bodyArtistId !== userId && await userOwnsArtist(userId, bodyArtistId)) {
      storeArtistId = bodyArtistId;
    }
    const { rows: [row] } = await pool.query<{ id: number }>(`
      INSERT INTO lyrics_video_jobs
        (artist_id, song_id, firestore_song_id, status, segments_json, words_json, duration_secs,
         song_title, artist_name, cover_art_url, audio_url)
      VALUES ($1,$2,$3,'transcribed',$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `, [
      storeArtistId,
      pgSongId,
      firestoreSongId,
      JSON.stringify(result.segments),
      JSON.stringify(result.words),
      result.duration ?? null,
      songTitle ?? null,
      resolvedArtistName,
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
  lyricStyle: z.enum(['glow', 'kinetic', 'neon', 'elegant', 'bold', 'clean', 'auto']).default('auto'),
  layout: z.enum(['center', 'side']).default('center'),
  showProgressBar: z.boolean().default(true),
  showWatermark: z.boolean().default(true),
});

// Map an artist genre to the best-fitting modern lyric style (mirrors
// remotion/lyric-fonts.ts lyricStyleForGenre — kept inline so the server never
// imports the Remotion font module, which calls delayRender on load).
function lyricStyleForGenre(genre?: string): 'glow' | 'kinetic' | 'neon' | 'elegant' | 'bold' | 'clean' {
  const g = (genre || '').toLowerCase();
  if (/(trap|rap|hip|drill|reggaeton|urbano|urban)/.test(g)) return 'bold';
  if (/(edm|electro|house|techno|dance|club|dubstep|hyperpop)/.test(g)) return 'neon';
  if (/(pop|k-?pop|indie|synth)/.test(g)) return 'kinetic';
  if (/(ballad|bolero|jazz|soul|r&b|rnb|acoustic|classical|folk|blues)/.test(g)) return 'elegant';
  return 'glow';
}

// Gather a small pool of background images for the lyric video: the song cover
// first, then the artist's image-gallery photos (Firestore image_galleries) and
// profile photo. These rotate (cross-fade) behind the lyrics. Best-effort: any
// failure just yields [coverArt].
async function gatherBackgroundImages(userId: number, coverArt?: string): Promise<string[]> {
  const out: string[] = [];
  const push = (u?: string | null) => {
    if (typeof u === 'string' && /^https?:\/\//.test(u) && !out.includes(u)) out.push(u);
  };
  push(coverArt);

  // Profile image (cheap, from the marketing context helper).
  try {
    const ctx = await getArtistMarketingContext(userId);
    push(ctx.profileImageUrl);
  } catch { /* optional */ }

  // Artist gallery photos from Firestore image_galleries (skip our own
  // hologram output and any video entries).
  if (firestoreDb) {
    try {
      const ref = firestoreDb.collection('image_galleries');
      const snaps = await Promise.all([
        ref.where('userId', '==', String(userId)).get(),
        ref.where('userId', '==', userId).get(),
      ]);
      const seen = new Set<string>();
      for (const snap of snaps) {
        snap.forEach((doc: any) => {
          if (seen.has(doc.id)) return;
          seen.add(doc.id);
          const data = doc.data() as any;
          if (data?.source === 'hologram') return;
          const imgs = Array.isArray(data?.generatedImages) ? data.generatedImages : [];
          for (const img of imgs) {
            if (!img || img.isVideo) continue;
            push(typeof img === 'string' ? img : img?.url);
          }
        });
      }
    } catch (e: any) {
      console.warn('[LyricsVideo] gallery bg images fetch failed:', e?.message);
    }
  }

  return out.slice(0, 6);
}

router.post('/render', authenticate, async (req, res) => {
  try {
    await ensureLyricsVideoJobsTable();
    const { jobId, theme, accentColor, fontFamily, lyricStyle: lyricStyleInput, layout, showProgressBar, showWatermark } =
      renderSchema.parse(req.body);
    const userId = (req as any).user?.id as number;

    // Load job
    const ownedIds = await getOwnedArtistIds(userId);
    const { rows } = await pool.query(
      `SELECT * FROM lyrics_video_jobs WHERE id=$1 AND artist_id = ANY($2)`, [jobId, ownedIds]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    const job = rows[0];

    const segments = job.segments_json as any[];
    if (!segments?.length) {
      return res.status(400).json({ error: 'No transcription data — run /transcribe first' });
    }

    // Resolve the lyric style: explicit choice wins, else auto from genre.
    // Also resolve the real artist name: the job already stored the profile name
    // at transcribe time; fall back to a profile lookup only if it's missing.
    const ctx = await getArtistMarketingContext(job.artist_id || userId);
    const resolvedArtistName = await resolveProfileArtistName(job.artist_name, job.artist_id, userId);
    let lyricStyle = lyricStyleInput;
    if (lyricStyle === 'auto') {
      lyricStyle = lyricStyleForGenre(ctx.genre || '');
    }

    const durationSecs = Number(job.duration_secs) || 180;
    const durationFrames = Math.ceil(durationSecs * 30) + 30; // +1 s buffer

    // Rotating background pool: cover + artist gallery photos.
    const backgroundImages = await gatherBackgroundImages(userId, job.cover_art_url ?? undefined);

    const inputProps = {
      audioUrl: job.audio_url,
      coverArt: job.cover_art_url ?? undefined,
      artistName: resolvedArtistName,
      songTitle: job.song_title ?? 'Lyrics Video',
      segments,
      theme,
      accentColor,
      fontFamily,
      lyricStyle,
      layout,
      backgroundImages,
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

    // ── Fast path: render on AWS Lambda (massively parallel) when configured ──
    // Set REMOTION_LAMBDA_FUNCTION_NAME / REMOTION_LAMBDA_SERVE_URL + AWS creds
    // (see scripts/deploy-remotion-lambda.ts). Falls through to the local spawn
    // render below when Lambda is not configured.
    if (isLambdaConfigured()) {
      void runLambdaRender({ jobId, inputProps, durationFrames });
      return res.json({ jobId, status: 'rendering', message: 'Render started (lambda)' });
    }

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

    // Adaptive concurrency. CRITICAL production gotcha: on containerized hosts
    // like Render.com, os.cpus() reports the HOST machine's core count, NOT the
    // small slice allocated to the container. Using (cores - 1) there would spin
    // up far more headless-Chrome workers than the container's RAM can hold and
    // OOM-crash the render. So:
    //   - In production (Render) default to a conservative fixed concurrency (2)
    //     that is safe for a 512MB–2GB instance.
    //   - In local dev use (cores - 1) for maximum speed.
    // Either way LYRICS_RENDER_CONCURRENCY overrides it (e.g. set it higher on a
    // beefy paid Render plan).
    const isProd = !!process.env.RENDER || process.env.NODE_ENV === 'production';
    const cpuCount = Math.max(1, os.cpus()?.length ?? 2);
    const defaultConcurrency = isProd ? 2 : Math.max(2, cpuCount - 1);
    const renderConcurrency = Math.max(
      1,
      Math.min(
        Number(process.env.LYRICS_RENDER_CONCURRENCY) || defaultConcurrency,
        16,
      ),
    );

    // Render scale: the composition is authored at 1920x1080. Rendering at a
    // lower scale (e.g. 0.6667 -> 1280x720) has ~2.25x fewer pixels per frame,
    // which roughly halves the per-frame Chrome screenshot + JPEG encode time
    // AND cuts per-worker RAM — a double win on memory-constrained Render
    // instances. Stays perfectly sharp for social / YouTube. Default 0.6667
    // (720p); set LYRICS_RENDER_SCALE=1 for native 1080p.
    const renderScale = (() => {
      const s = Number(process.env.LYRICS_RENDER_SCALE);
      return Number.isFinite(s) && s > 0 && s <= 1 ? s : 0.6667;
    })();

    // x264 preset trades encode CPU for file size. 'faster' is a good balance
    // that noticeably speeds up the ffmpeg encode without bloating the file.
    const x264Preset = process.env.LYRICS_X264_PRESET || 'faster';

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
        '--scale', String(renderScale),
        '--x264-preset', x264Preset,
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
    let renderTimedOut = false;
    const renderTimeoutId = setTimeout(async () => {
      if (!child.exitCode && !child.killed) {
        renderTimedOut = true;
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

    child.on('close', async (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(renderTimeoutId); // Cancel watchdog timer
      // Clean up the temp props file regardless of outcome.
      try { fs.unlinkSync(propsFile); } catch { /* ignore */ }
      if (code === 0 && fs.existsSync(outFile)) {
        // Upload to Firebase Storage + finalize (shared with the Lambda path).
        await finalizeRenderedVideo(jobId, outFile);
      } else if (signal) {
        // The render was terminated by a signal (SIGTERM/SIGKILL). If our own
        // watchdog fired, it already wrote the precise "timed out" message —
        // don't clobber it. Otherwise the server restarted (tsx watch on a
        // backend file change in dev, or a redeploy/OOM in prod) and killed the
        // in-process render child. This is NOT a render bug — surface a clear,
        // retryable message instead of the misleading start-up version warning
        // that happens to be the only thing left in the output tail.
        if (renderTimedOut) return;
        const msg = `Render interrumpido (${signal}) — el servidor se reinici\u00f3 durante el render. Vuelve a intentar.`;
        console.error(`[LyricsVideo] Render job ${jobId} killed by ${signal} (likely a server restart)`);
        await pool.query(
          `UPDATE lyrics_video_jobs SET status='failed', error_msg=$2, updated_at=NOW() WHERE id=$1`,
          [jobId, msg]
        );
        renderProgress.set(jobId, { progress: 0, status: 'failed', log: msg });
      } else {
        // Prefer the full accumulated output (real error) over the last
        // progress-chunk tail, with the harmless zod version-mismatch warning
        // stripped so the ACTUAL failure line is what gets persisted.
        const errLog = cleanRenderOutput(
          renderOutputTail || renderProgress.get(jobId)?.log || 'Unknown render error'
        ) || 'Unknown render error';
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

    const ownedIds = await getOwnedArtistIds(userId);
    const { rows } = await pool.query(
      `SELECT id, status, progress, output_url, youtube_url, error_msg, duration_secs,
              song_title, artist_name, cover_art_url, theme, accent_color, created_at
       FROM lyrics_video_jobs WHERE id=$1 AND artist_id = ANY($2)`,
      [jobId, ownedIds]
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
    if (!artistId || isNaN(artistId)) return res.json({ jobs: [], channel: null });
    const { rows } = await pool.query(
      `SELECT id, status, output_url, youtube_url, song_title, artist_name, cover_art_url, thumbnail_url, created_at
       FROM lyrics_video_jobs WHERE artist_id=$1 AND status='done' AND output_url IS NOT NULL
       ORDER BY created_at DESC LIMIT 20`,
      [artistId]
    );

    // Resolve the artist's YouTube channel + lyric playlist so the visitor view can
    // link out to the channel/playlist instead of stacking embedded players.
    let channel: {
      id: string | null; title: string | null; thumbnailUrl: string | null;
      url: string | null; playlistUrl: string | null;
    } | null = null;
    try {
      const { rows: connRows } = await pool.query(
        `SELECT yc.channel_id, yc.channel_title, yc.thumbnail_url, yc.lyric_playlist_id
           FROM youtube_connections yc
          WHERE yc.user_id = $1
             OR yc.user_id = (SELECT generated_by FROM users WHERE id = $1)
          ORDER BY (yc.user_id = $1) DESC
          LIMIT 1`,
        [artistId]
      );
      const c = connRows[0];
      if (c && (c.channel_id || c.lyric_playlist_id)) {
        channel = {
          id: c.channel_id || null,
          title: c.channel_title || null,
          thumbnailUrl: c.thumbnail_url || null,
          url: c.channel_id ? `https://www.youtube.com/channel/${c.channel_id}` : null,
          playlistUrl: c.lyric_playlist_id ? `https://www.youtube.com/playlist?list=${c.lyric_playlist_id}` : null,
        };
      }
    } catch { /* best-effort: channel stays null */ }

    return res.json({ jobs: rows, channel });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/lyrics-video/my-jobs  — list all jobs for user
// ─────────────────────────────────────────────────────────────────────────────

router.get('/my-jobs', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id as number;
    // Si el cliente pasa el id del perfil que se está viendo y el usuario lo
    // controla, listamos ese perfil; si no, todos los perfiles que controla.
    const profileId = req.query.artistId ? parseInt(String(req.query.artistId), 10) : 0;
    let scopeIds: number[];
    if (profileId && await userOwnsArtist(userId, profileId)) {
      scopeIds = [profileId];
    } else {
      scopeIds = await getOwnedArtistIds(userId);
    }
    const { rows } = await pool.query(
      `SELECT id, status, progress, output_url, youtube_url, duration_secs,
              song_title, artist_name, cover_art_url, thumbnail_url, theme, accent_color, created_at
       FROM lyrics_video_jobs WHERE artist_id = ANY($1) ORDER BY created_at DESC LIMIT 20`,
      [scopeIds]
    );
    return res.json({ jobs: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/lyrics-video/search-trends — detecta tendencias de búsqueda REALES
// (autocompletado de YouTube/Google) para el artista/canción/género. Sirve para
// ver por qué frases busca la gente antes de publicar y elegir keywords.
// Query: ?artistName=&songTitle=&genre=  (o ?jobId= para tomarlos del job)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/search-trends', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id as number;
    let artistName = String(req.query.artistName || '').trim();
    let songTitle = String(req.query.songTitle || '').trim();
    let genre = String(req.query.genre || '').trim();

    const jobId = req.query.jobId ? parseInt(String(req.query.jobId), 10) : 0;
    if (jobId) {
      const ownedIds = await getOwnedArtistIds(userId);
      const { rows } = await pool.query(
        `SELECT artist_id, song_title, artist_name FROM lyrics_video_jobs WHERE id=$1 AND artist_id = ANY($2)`,
        [jobId, ownedIds]
      );
      if (rows[0]) {
        songTitle = songTitle || rows[0].song_title || '';
        artistName = artistName || (await resolveProfileArtistName(rows[0].artist_name, rows[0].artist_id, userId));
      }
    }
    if (!artistName && !songTitle && !genre) {
      const ctx = await getArtistMarketingContext(userId);
      artistName = ctx.artistName;
      genre = genre || ctx.genre;
    }
    const year = new Date().getFullYear();
    const trends = await fetchSearchTrends([
      artistName,
      songTitle,
      artistName && songTitle ? `${artistName} ${songTitle}` : '',
      genre ? `${genre} ${year}` : '',
      genre ? `${genre} music` : '',
      genre ? `nuevas canciones ${genre}` : '',
    ]);
    return res.json({ success: true, artistName, songTitle, genre, trends });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


router.post('/:jobId/thumbnail', authenticate, async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const userId = (req as any).user?.id as number;
    if (!jobId || isNaN(jobId)) return res.status(400).json({ error: 'Invalid job id' });

    const ownedIds = await getOwnedArtistIds(userId);
    const { rows } = await pool.query(
      `SELECT * FROM lyrics_video_jobs WHERE id=$1 AND artist_id = ANY($2)`,
      [jobId, ownedIds]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    const job = rows[0];

    const ctx = await getArtistMarketingContext(job.artist_id || userId);
    const songTitle = job.song_title || 'Lyric Video';
    const artistName = await resolveProfileArtistName(job.artist_name, job.artist_id, userId);

    const thumbnailUrl = await generateYoutubeThumbnail({
      artistName,
      songTitle,
      genre: ctx.genre,
      profileImageUrl: ctx.profileImageUrl,
      coverArt: job.cover_art_url || undefined,
      lyrics: extractLyricsFromJob(job),
    });
    if (!thumbnailUrl) {
      return res.status(502).json({ error: 'Could not generate the thumbnail. Try again.' });
    }
    await pool.query(
      `UPDATE lyrics_video_jobs SET thumbnail_url=$2, updated_at=NOW() WHERE id=$1`,
      [jobId, thumbnailUrl]
    );
    return res.json({ success: true, thumbnailUrl });
  } catch (err: any) {
    console.error('[LyricsVideo] /thumbnail error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/lyrics-video/:jobId — delete a rendered video (DB row + best-effort
// storage cleanup). Scoped to the owner artist.
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:jobId', authenticate, async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const userId = (req as any).user?.id as number;
    if (!jobId || isNaN(jobId)) return res.status(400).json({ error: 'Invalid job id' });

    const ownedIds = await getOwnedArtistIds(userId);
    const { rows } = await pool.query(
      `SELECT id FROM lyrics_video_jobs WHERE id=$1 AND artist_id = ANY($2)`,
      [jobId, ownedIds]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });

    // Best-effort: remove the rendered MP4 folder from Firebase Storage.
    try {
      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage().bucket();
      await bucket.deleteFiles({ prefix: `lyrics-videos/${jobId}/` });
    } catch (e: any) {
      console.warn('[LyricsVideo] storage cleanup failed (non-fatal):', e?.message);
    }

    await pool.query(`DELETE FROM lyrics_video_jobs WHERE id=$1 AND artist_id = ANY($2)`, [jobId, ownedIds]);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[LyricsVideo] DELETE error:', err);
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
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  privacyStatus: z.enum(['public', 'unlisted', 'private']).default('public'),
  // Cuando true (o cuando faltan title/description), el servidor genera metadata
  // SEO avanzada con GLM-5.2 (links al perfil, CTA a productos, letra, keywords).
  auto: z.boolean().default(false),
  // Genera una miniatura con IA usando la foto del artista como referencia.
  generateThumbnail: z.boolean().default(true),
  // Optional: a Google OAuth2 access token from a client-side Google Sign-In.
  // When omitted, the server uses the token the artist stored via
  // /api/auth/youtube/connect (server-side OAuth flow).
  accessToken: z.string().min(1).optional(),
});

router.post('/:jobId/upload-youtube', authenticate, async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const userId = (req as any).user?.id as number;
    const body = ytUploadSchema.parse(req.body);
    const { privacyStatus, accessToken, auto, generateThumbnail } = body;

    const ownedIds = await getOwnedArtistIds(userId);
    const { rows } = await pool.query(
      `SELECT * FROM lyrics_video_jobs WHERE id=$1 AND artist_id = ANY($2) AND status='done'`,
      [jobId, ownedIds]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found or not ready' });
    const job = rows[0];
    if (!job.output_url) {
      return res.status(400).json({ error: 'No rendered video available for this job' });
    }

    // Contexto del artista para SEO competitivo + CTA a su perfil/tienda.
    const ctx = await getArtistMarketingContext(job.artist_id || userId);
    const songTitle = job.song_title || 'Lyric Video';
    const artistName = await resolveProfileArtistName(job.artist_name, job.artist_id, userId);

    // Resolver metadata: si faltan campos o auto=true → SEO avanzado con GLM-5.2.
    let title = body.title;
    let description = body.description;
    let tags = body.tags;
    if (auto || !title || !description || !tags || !tags.length) {
      const lyrics = extractLyricsFromJob(job);
      const seo = await generateVideoSeoAdvanced({
        songTitle,
        artistName,
        genre: ctx.genre,
        lyrics,
        artistUrl: ctx.artistUrl,
        storeUrl: ctx.storeUrl,
        products: ctx.products,
        productItems: ctx.productItems,
        events: ctx.events,
        videoTag: `lv${jobId}`,
      });
      title = title || seo.title;
      description = description || seo.description;
      tags = tags && tags.length ? tags : seo.tags;
    }
    title = (title || `${songTitle} - ${artistName} (Official Lyric Video)`).slice(0, 100);
    description = (description || '').slice(0, 4900);
    tags = (tags || []).slice(0, 30);

    // Miniatura IA cinematográfica (póster estilo cartel) con la foto del artista.
    // Reutiliza la ya generada si existe; si no, crea una nueva basada en la letra.
    let thumbnailUrl: string | undefined = job.thumbnail_url || job.cover_art_url || undefined;
    if (generateThumbnail && !job.thumbnail_url) {
      thumbnailUrl = await generateYoutubeThumbnail({
        artistName,
        songTitle,
        genre: ctx.genre,
        profileImageUrl: ctx.profileImageUrl,
        coverArt: job.cover_art_url || undefined,
        lyrics: extractLyricsFromJob(job),
      });
      if (thumbnailUrl) {
        await pool.query(
          `UPDATE lyrics_video_jobs SET thumbnail_url=$2, updated_at=NOW() WHERE id=$1`,
          [jobId, thumbnailUrl]
        );
      }
    }

    // Ruta A (común): sin token explícito → usar el servicio con la conexión
    // del artista (refresca token + sube la miniatura automáticamente).
    if (!accessToken) {
      let token: string | undefined;
      try {
        const { getValidAccessToken } = await import('../services/youtube-service');
        token = (await getValidAccessToken(userId)) || undefined;
      } catch (e: any) {
        console.warn('[LyricsVideo] stored YouTube token lookup failed:', e?.message);
      }
      if (!token) {
        return res.status(412).json({
          error: 'YouTube account not connected',
          needsConnect: true,
          instructions: 'Conecta tu canal de YouTube en /api/auth/youtube/connect y reintenta.',
        });
      }
      const { uploadVideoToYoutube } = await import('../services/youtube-service');
      const up = await uploadVideoToYoutube({
        userId,
        videoUrl: job.output_url,
        title,
        description,
        tags,
        privacyStatus,
        thumbnailUrl,
        // Cada artista tiene UN playlist con todas sus canciones.
        playlistTitle: artistName,
        playlistDescription: `Todas las canciones de ${artistName}. ${ctx.artistUrl}`,
      });
      await pool.query(
        `UPDATE lyrics_video_jobs SET youtube_url=$2, thumbnail_url=COALESCE($3, thumbnail_url), updated_at=NOW() WHERE id=$1`,
        [jobId, up.url, thumbnailUrl || null]
      );
      // Comentario "SHOP THIS VIDEO" con productos + próximos shows (best-effort).
      // La API de YouTube no permite FIJAR por código: el artista lo fija una vez
      // en YouTube Studio; aun así los links quedan visibles para los fans.
      let shopCommentPosted = false;
      try {
        const shopComment = buildShopComment(ctx, `lv${jobId}`);
        if (shopComment && up.videoId) {
          const { insertVideoComment } = await import('../services/youtube-service');
          shopCommentPosted = !!(await insertVideoComment(userId, up.videoId, shopComment));
        }
      } catch (e: any) {
        console.warn('[LyricsVideo] shop comment falló:', e?.message);
      }
      return res.json({
        youtubeUrl: up.url,
        videoId: up.videoId,
        thumbnailSet: up.thumbnailSet,
        thumbnailError: up.thumbnailError || null,
        playlistUrl: up.playlistUrl || null,
        shopCommentPosted,
        title,
        description,
        tags,
        thumbnailUrl: thumbnailUrl || null,
      });
    }

    // Ruta B (legacy): token explícito de un Google Sign-In del cliente.
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

    const videoResponse = await fetch(job.output_url);
    if (!videoResponse.ok) throw new Error(`Cannot fetch video: ${videoResponse.status}`);
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const tempVideoPath = path.join(process.cwd(), 'uploads', `yt_upload_${jobId}.mp4`);
    fs.writeFileSync(tempVideoPath, videoBuffer);

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const youtube = google.youtube({ version: 'v3', auth });

      const { sanitizeYoutubeTags, sanitizeYoutubeText } = await import('../services/youtube-service');
      const uploadResponse = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: sanitizeYoutubeText(title, 100) || 'Lyric Video',
            description: sanitizeYoutubeText(description, 4900),
            tags: sanitizeYoutubeTags(tags),
            categoryId: '10',
          },
          status: { privacyStatus },
        },
        media: { body: fs.createReadStream(tempVideoPath) },
      });

      const videoId = uploadResponse.data.id;
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

      // Miniatura (best-effort; YouTube limita a 2MB y exige canal verificado).
      let thumbnailSet = false;
      let thumbnailError: string | null = null;
      if (thumbnailUrl && videoId) {
        try {
          const thumbResp = await fetch(thumbnailUrl);
          if (thumbResp.ok) {
            const thumbBuf = Buffer.from(await thumbResp.arrayBuffer());
            const tmpThumb = path.join(process.cwd(), 'uploads', `yt_thumb_${jobId}.jpg`);
            // Re-encode a JPEG 1280x720 (<2MB) — los PNG de gpt-image-1 suelen pasar el límite.
            try {
              const sharp = (await import('sharp')).default;
              await sharp(thumbBuf).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(tmpThumb);
            } catch {
              fs.writeFileSync(tmpThumb, thumbBuf);
            }
            try {
              await youtube.thumbnails.set({ videoId, media: { mimeType: 'image/jpeg', body: fs.createReadStream(tmpThumb) } });
              thumbnailSet = true;
            } finally {
              if (fs.existsSync(tmpThumb)) fs.unlinkSync(tmpThumb);
            }
          }
        } catch (e: any) {
          const apiErr = e?.response?.data?.error;
          thumbnailError = apiErr?.errors?.[0]?.reason ? `${apiErr.errors[0].reason}: ${apiErr.message}` : (e?.message || 'thumbnail failed');
          console.warn('[LyricsVideo] thumbnail set (legacy) falló:', thumbnailError);
        }
      }

      // Playlist del artista (todas sus canciones en uno).
      let playlistUrl: string | null = null;
      try {
        const { ensureArtistPlaylist, addVideoToPlaylist } = await import('../services/youtube-service');
        const plId = await ensureArtistPlaylist(userId, artistName, `Todas las canciones de ${artistName}. ${ctx.artistUrl}`);
        if (plId && videoId) {
          await addVideoToPlaylist(userId, plId, videoId);
          playlistUrl = `https://www.youtube.com/playlist?list=${plId}`;
        }
      } catch (e: any) {
        console.warn('[LyricsVideo] playlist (legacy) falló:', e?.message);
      }

      await pool.query(
        `UPDATE lyrics_video_jobs SET youtube_url=$2, cover_art_url=COALESCE($3, cover_art_url), updated_at=NOW() WHERE id=$1`,
        [jobId, youtubeUrl, thumbnailUrl || null]
      );

      // Comentario "SHOP THIS VIDEO" con productos + próximos shows (best-effort).
      let shopCommentPosted = false;
      try {
        const shopComment = buildShopComment(ctx, `lv${jobId}`);
        if (shopComment && videoId) {
          await youtube.commentThreads.insert({
            part: ['snippet'],
            requestBody: {
              snippet: {
                videoId,
                topLevelComment: { snippet: { textOriginal: sanitizeYoutubeText(shopComment, 9900) } },
              },
            },
          });
          shopCommentPosted = true;
        }
      } catch (e: any) {
        console.warn('[LyricsVideo] shop comment (legacy) falló:', e?.message);
      }

      return res.json({ youtubeUrl, videoId, thumbnailSet, thumbnailError, playlistUrl, shopCommentPosted, title, description, tags, thumbnailUrl: thumbnailUrl || null });
    } finally {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    }
  } catch (err: any) {
    console.error('[LyricsVideo] /upload-youtube error:', err);
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SYNC STORE — actualiza los videos YA SUBIDOS a YouTube con los productos de la
// tienda + próximos shows: reescribe la sección de tienda en la descripción
// (idempotente) y publica el comentario "SHOP THIS VIDEO" si aún no existe.
// ════════════════════════════════════════════════════════════════════════════
const syncStoreSchema = z.object({
  artistId: z.number().int().positive().optional(),
  updateDescription: z.boolean().optional().default(true),
  postComment: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(200).optional().default(100),
});
router.post('/youtube/sync-store', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id as number;
    const { artistId, updateDescription, postComment, limit } = syncStoreSchema.parse(req.body || {});

    const ownedIds = await getOwnedArtistIds(userId);
    let targetIds = ownedIds;
    if (artistId) {
      if (!ownedIds.includes(artistId)) {
        return res.status(403).json({ error: 'No autorizado para este artista' });
      }
      targetIds = [artistId];
    }

    const { rows: jobs } = await pool.query(
      `SELECT id, artist_id, song_title, youtube_url FROM lyrics_video_jobs
       WHERE artist_id = ANY($1) AND youtube_url IS NOT NULL AND youtube_url <> ''
       ORDER BY updated_at DESC LIMIT $2`,
      [targetIds, limit]
    );
    if (!jobs.length) {
      return res.json({ total: 0, updated: 0, commented: 0, skipped: 0, results: [], message: 'No hay videos publicados en YouTube para este artista.' });
    }

    const { getValidAccessToken, updateVideoDescription, ensureVideoShopComment } =
      await import('../services/youtube-service');
    const ctxCache = new Map<number, ArtistMarketingContext>();
    const connCache = new Map<string, number | null>();
    const resolveConn = async (ids: number[]): Promise<number | null> => {
      const key = ids.join(',');
      if (connCache.has(key)) return connCache.get(key)!;
      let found: number | null = null;
      for (const id of ids) {
        if (!id) continue;
        try {
          if (await getValidAccessToken(id)) { found = id; break; }
        } catch { /* sin conexión para ese id */ }
      }
      connCache.set(key, found);
      return found;
    };

    let updated = 0, commented = 0, skipped = 0;
    const results: any[] = [];
    for (const job of jobs) {
      const videoId = String(job.youtube_url).match(/[?&]v=([\w-]{6,})/)?.[1];
      if (!videoId) { skipped++; results.push({ jobId: job.id, videoId: null, skipped: 'no_video_id' }); continue; }

      let ctx = ctxCache.get(job.artist_id);
      if (!ctx) { ctx = await getArtistMarketingContext(job.artist_id); ctxCache.set(job.artist_id, ctx); }
      if (!ctx.productItems.length && !ctx.events.length) {
        skipped++; results.push({ jobId: job.id, videoId, skipped: 'no_products_or_events' }); continue;
      }

      const connUser = await resolveConn([job.artist_id, userId]);
      if (!connUser) { skipped++; results.push({ jobId: job.id, videoId, skipped: 'youtube_not_connected' }); continue; }

      const videoTag = `lv${job.id}`;
      const row: any = { jobId: job.id, videoId, title: job.song_title || null };

      if (updateDescription) {
        const lines = buildCommerceLines({
          artistName: ctx.artistName,
          artistUrl: ctx.artistUrl,
          storeUrl: ctx.storeUrl,
          productItems: ctx.productItems,
          events: ctx.events,
          videoTag,
          includeHeader: false,
        });
        const out = await updateVideoDescription(connUser, videoId, (cur) => applyShopSection(cur, lines));
        row.description = out.updated ? 'updated' : (out.reason || 'unchanged');
        if (out.updated) updated++;
      }

      if (postComment) {
        const comment = buildShopComment(ctx, videoTag);
        const out = await ensureVideoShopComment(connUser, videoId, comment, SHOP_COMMENT_MARKER, LEGACY_COMMENT_MARKERS);
        row.comment = out.posted ? 'posted' : (out.reason || 'skipped');
        if (out.posted) commented++;
      }

      results.push(row);
    }

    return res.json({ total: jobs.length, updated, commented, skipped, results });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error('[LyricsVideo] /youtube/sync-store error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ALBUM AUTOPILOT — genera lyric videos de TODO el álbum en 2do plano, uno a
// uno, los deja listos para YouTube y envía un email de confirmación (Resend)
// cuando termina. Reanudable tras reinicios del servidor.
// ════════════════════════════════════════════════════════════════════════════

interface AlbumSongEntry {
  songId: string | number | null;
  title: string;
  audioUrl: string;
  coverArt?: string | null;
  status: 'pending' | 'transcribing' | 'rendering' | 'done' | 'failed';
  jobId?: number;
  outputUrl?: string;
  youtubeUrl?: string;
  uploadError?: string;
  error?: string;
}

async function ensureLyricsVideoAlbumsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lyrics_video_albums (
      id              SERIAL PRIMARY KEY,
      artist_id       INTEGER,
      artist_name     TEXT,
      email           TEXT,
      status          TEXT DEFAULT 'processing',
      theme           TEXT DEFAULT 'blur',
      accent_color    TEXT DEFAULT '#7c3aed',
      font_family     TEXT DEFAULT 'Inter',
      total_songs     INTEGER DEFAULT 0,
      completed_songs INTEGER DEFAULT 0,
      songs_json      JSONB DEFAULT '[]'::jsonb,
      auto_upload     BOOLEAN DEFAULT true,
      privacy_status  TEXT DEFAULT 'public',
      email_sent      BOOLEAN DEFAULT false,
      error_msg       TEXT,
      created_at      TIMESTAMPTZ DEFAULT now(),
      updated_at      TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE lyrics_video_albums ADD COLUMN IF NOT EXISTS auto_upload BOOLEAN DEFAULT true`).catch(() => {});
  await pool.query(`ALTER TABLE lyrics_video_albums ADD COLUMN IF NOT EXISTS privacy_status TEXT DEFAULT 'public'`).catch(() => {});
}

// ── Global single-flight queue (one album & one render at a time → respeta la
//    cuota de 8 lambdas concurrentes; cada canción usa hasta 8 lambdas) ──
const albumQueue: number[] = [];
let albumWorkerBusy = false;

function enqueueAlbum(albumId: number): void {
  if (!albumQueue.includes(albumId)) albumQueue.push(albumId);
  void runAlbumWorker();
}

async function runAlbumWorker(): Promise<void> {
  if (albumWorkerBusy) return;
  albumWorkerBusy = true;
  try {
    while (albumQueue.length) {
      const albumId = albumQueue.shift()!;
      try {
        await processAlbum(albumId);
      } catch (e: any) {
        console.error(`[LyricsAlbum] album ${albumId} crashed:`, e?.message || e);
      }
    }
  } finally {
    albumWorkerBusy = false;
  }
}

async function persistAlbumSongs(albumId: number, songs: AlbumSongEntry[]): Promise<void> {
  const completed = songs.filter((s) => s.status === 'done').length;
  await pool.query(
    `UPDATE lyrics_video_albums SET songs_json=$2, completed_songs=$3, updated_at=NOW() WHERE id=$1`,
    [albumId, JSON.stringify(songs), completed]
  ).catch(() => {});
}

// Awaitable render of a single job — usa Lambda si está configurado, si no hace
// un spawn local. En ambos casos finaliza el job (status done/failed en DB).
async function renderJobToCompletion(
  jobId: number,
  inputProps: any,
  durationFrames: number
): Promise<{ ok: boolean; outputUrl?: string; error?: string }> {
  try {
    if (isLambdaConfigured()) {
      await runLambdaRender({ jobId, inputProps, durationFrames });
    } else {
      await spawnLocalRenderAndWait(jobId, inputProps, durationFrames);
    }
  } catch (e: any) {
    console.error(`[LyricsAlbum] render job ${jobId} error:`, e?.message || e);
  }
  const { rows } = await pool.query(
    `SELECT status, output_url, error_msg FROM lyrics_video_jobs WHERE id=$1`,
    [jobId]
  );
  const r = rows[0] || {};
  return { ok: r.status === 'done', outputUrl: r.output_url || undefined, error: r.error_msg || undefined };
}

// Compact awaitable local render (fallback cuando no hay Lambda). Reusa
// finalizeRenderedVideo para subir a Firebase + marcar done.
function spawnLocalRenderAndWait(jobId: number, inputProps: any, durationFrames: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const outDir = path.join(process.cwd(), 'out', 'lyrics-videos');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `lyrics-video-${jobId}.mp4`);
    const propsFile = path.join(outDir, `props-${jobId}.json`);
    fs.writeFileSync(propsFile, JSON.stringify({ ...inputProps, durationFrames }), 'utf-8');
    const emptyPublicDir = path.join(outDir, '.empty-public');
    fs.mkdirSync(emptyPublicDir, { recursive: true });

    const scaleEnv = Number(process.env.LYRICS_RENDER_SCALE);
    const renderScale = Number.isFinite(scaleEnv) && scaleEnv > 0 && scaleEnv <= 1 ? scaleEnv : 0.6667;
    const isProd = !!process.env.RENDER || process.env.NODE_ENV === 'production';
    const cpuCount = Math.max(1, os.cpus()?.length ?? 2);
    const renderConcurrency = Math.max(
      1,
      Math.min(Number(process.env.LYRICS_RENDER_CONCURRENCY) || (isProd ? 2 : Math.max(2, cpuCount - 1)), 16)
    );
    const x264Preset = process.env.LYRICS_X264_PRESET || 'faster';

    const child = spawn(
      'npx',
      [
        'remotion', 'render', 'remotion/index.ts', 'LyricsVideoHorizontal', outFile,
        '--props', propsFile, '--public-dir', emptyPublicDir,
        '--frames', `0-${durationFrames - 1}`, '--codec', 'h264',
        '--image-format', 'jpeg', '--jpeg-quality', '80', '--scale', String(renderScale),
        '--x264-preset', x264Preset, '--concurrency', String(renderConcurrency),
      ],
      { cwd: process.cwd(), shell: true, env: { ...process.env } }
    );

    let tail = '';
    const onData = (chunk: Buffer) => {
      const t = chunk.toString();
      tail = (tail + t).slice(-4000);
      const frac = t.match(/(\d+)\s*\/\s*(\d+)/);
      if (frac) {
        const cur = +frac[1];
        const tot = +frac[2];
        if (tot > 0 && cur <= tot) {
          const pct = Math.floor((cur / tot) * 100);
          const existing = renderProgress.get(jobId);
          const np = Math.max(pct, existing?.progress ?? 0);
          renderProgress.set(jobId, { progress: np, status: 'rendering', log: t.slice(-200) });
          pool.query(`UPDATE lyrics_video_jobs SET progress=$2, updated_at=NOW() WHERE id=$1`, [jobId, np]).catch(() => {});
        }
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);

    const timeoutMs = Math.min(90 * 60 * 1000, Math.max(20 * 60 * 1000, durationFrames * 1200));
    let timedOut = false;
    const to = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        timedOut = true;
        child.kill('SIGTERM');
      }
    }, timeoutMs);

    child.on('close', async (code, signal) => {
      clearTimeout(to);
      try { fs.unlinkSync(propsFile); } catch {}
      if (code === 0 && fs.existsSync(outFile)) {
        await finalizeRenderedVideo(jobId, outFile);
      } else {
        const msg = timedOut
          ? 'Render timed out'
          : signal
          ? `Render interrumpido (${signal})`
          : (cleanRenderOutput(tail) || 'Render failed').slice(-500);
        await pool.query(
          `UPDATE lyrics_video_jobs SET status='failed', error_msg=$2, updated_at=NOW() WHERE id=$1`,
          [jobId, msg]
        ).catch(() => {});
        renderProgress.set(jobId, { progress: 0, status: 'failed', log: msg });
      }
      resolve();
    });
    child.on('error', async (e: any) => {
      clearTimeout(to);
      await pool.query(
        `UPDATE lyrics_video_jobs SET status='failed', error_msg=$2, updated_at=NOW() WHERE id=$1`,
        [jobId, (e?.message || 'spawn error').slice(0, 300)]
      ).catch(() => {});
      resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SEO / Marketing avanzado para YouTube
// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_ARTIST_BASE_URL = (() => {
  let base = (process.env.PUBLIC_ARTIST_BASE_URL || process.env.APP_URL || 'https://www.boostifymusic.com').replace(
    /\/+$/,
    ''
  );
  // Los enlaces públicos del artista deben usar el dominio con www (p.ej.
  // https://www.boostifymusic.com/artist/control). Forzamos el prefijo www.
  base = base.replace(/^https?:\/\/boostifymusic\.com/i, 'https://www.boostifymusic.com');
  return base;
})();

// Convierte un nombre/identificador en un slug usable como último recurso si la
// fila del artista no tiene slug guardado en la base de datos.
function slugifyArtist(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Parser tolerante: GLM-5.2 (supportsJSON:false) suele devolver el JSON envuelto
// en ```json ... ``` o con texto alrededor. Extraemos el primer objeto válido.
function parseLooseJson(txt: string): any | null {
  if (!txt) return null;
  let s = String(txt).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Llama al modelo más avanzado disponible para texto: GLM-5.2 (flagship de z.ai)
// como primario y OpenAI como fallback. Devuelve JSON parseado (o {}).
async function callAdvancedJson(prompt: string): Promise<any> {
  // 1) GLM-5.2 (z.ai) — el modelo más avanzado de Z
  try {
    const { ZAI_API_KEY, ZAI_BASE_URL, isZaiConfigured } = await import('../utils/ai-config');
    if (isZaiConfigured()) {
      const OpenAI = (await import('openai')).default;
      const zai = new OpenAI({ apiKey: ZAI_API_KEY, baseURL: ZAI_BASE_URL });
      const resp = await zai.chat.completions.create({
        model: 'glm-5.2',
        messages: [
          { role: 'system', content: 'Eres un experto en marketing musical y SEO de YouTube. Responde SOLO con JSON válido, sin markdown ni texto adicional.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.75,
      });
      const parsed = parseLooseJson(resp.choices?.[0]?.message?.content || '');
      if (parsed) return parsed;
    }
  } catch (e: any) {
    console.warn('[LyricsVideo] GLM-5.2 SEO falló, usando OpenAI:', e?.message);
  }
  // 2) Fallback OpenAI
  try {
    if (process.env.OPENAI_API_KEY) {
      const { createTrackedOpenAI } = await import('../utils/tracked-openai');
      const { PRIMARY_MODEL } = await import('../utils/ai-config');
      const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const resp = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });
      return parseLooseJson(resp.choices?.[0]?.message?.content || '') || {};
    }
  } catch (e: any) {
    console.warn('[LyricsVideo] OpenAI SEO fallback falló:', e?.message);
  }
  return {};
}

// Resuelve el contexto de marketing del artista (slug, género, productos, foto…)
// para enriquecer SEO, links y CTA.
interface CommerceProduct {
  id: number;
  title: string;
  price?: string | number | null;
  currency?: string;
}
interface CommerceEvent {
  id: number;
  title: string;
  startsAt?: string | Date | null;
  venue?: string;
  location?: string;
}

// Añade parámetros UTM a una URL para atribuir el tráfico/ventas que llegan desde
// YouTube (visible en el dashboard de ventas del artista).
function withYoutubeUtm(url: string, content?: string): string {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  let u = `${url}${sep}utm_source=youtube&utm_medium=lyric_video&utm_campaign=shop_this_video`;
  if (content) u += `&utm_content=${encodeURIComponent(content)}`;
  return u;
}
function fmtCommercePrice(price: any, currency = 'usd'): string {
  const n = Number(price);
  if (!isFinite(n) || n <= 0) return '';
  const sym = String(currency || 'usd').toLowerCase() === 'usd' ? '$' : '';
  return `${sym}${n.toFixed(2)}`;
}
function fmtEventDate(iso: any): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}
// Construye el bloque "SHOP THIS VIDEO" (productos + shows) con deep-links y UTM.
// Se reutiliza tanto en la descripción del video como en el comentario fijable.
function buildCommerceLines(o: {
  artistName: string;
  artistUrl: string;
  storeUrl: string;
  productItems?: CommerceProduct[];
  events?: CommerceEvent[];
  videoTag?: string;
  includeHeader?: boolean;
}): string[] {
  const { artistName, artistUrl, storeUrl, productItems = [], events = [], videoTag, includeHeader = true } = o;
  const lines: string[] = [];
  lines.push(
    includeHeader
      ? `� TIENDA OFICIAL de ${artistName} — merch, shows y música: ${withYoutubeUtm(storeUrl, videoTag)}`
      : `🛒 Tienda oficial de ${artistName}: ${withYoutubeUtm(storeUrl, videoTag)}`
  );
  if (productItems.length) {
    lines.push('');
    lines.push('🛍️ PRODUCTOS:');
    for (const p of productItems.slice(0, 4)) {
      const price = fmtCommercePrice(p.price, p.currency);
      const link = withYoutubeUtm(`${storeUrl}?product=${p.id}`, videoTag);
      lines.push(`• ${p.title}${price ? ` — ${price}` : ''}: ${link}`);
    }
  }
  if (events.length) {
    lines.push('');
    lines.push(`🎫 PRÓXIMOS SHOWS de ${artistName}:`);
    for (const e of events.slice(0, 4)) {
      const date = fmtEventDate(e.startsAt);
      const place = [e.venue, e.location].filter(Boolean).join(', ');
      const link = withYoutubeUtm(`${artistUrl}?event=${e.id}`, videoTag);
      lines.push(`• ${date ? `${date} · ` : ''}${e.title}${place ? ` (${place})` : ''} → Entradas: ${link}`);
    }
  }
  lines.push('');
  lines.push(`🎵 Escucha y consigue su música: ${withYoutubeUtm(artistUrl, videoTag)}`);
  return lines;
}

// Sentinelas para la sección de tienda añadida a videos YA subidos (backfill).
// Permiten re-ejecutar el sync de forma IDEMPOTENTE: si la sección ya existe se
// reemplaza por una fresca (con los productos/precios actuales) en vez de duplicarse.
const SHOP_SECTION_START = '� ───── TIENDA OFICIAL ─────';
const SHOP_SECTION_END = '───── Apoya a tu artista · Boostify ─────';
const SHOP_COMMENT_MARKER = 'TIENDA OFICIAL';
// Marcadores de versiones anteriores (para reemplazar/limpiar sin duplicar).
const LEGACY_SECTION_STARTS = ['🛍️ ───── COMPRA EN ESTE VIDEO ─────'];
const LEGACY_COMMENT_MARKERS = ['COMPRA EN ESTE VIDEO'];
function stripShopSection(text: string): string {
  let t = text;
  for (const startMark of [SHOP_SECTION_START, ...LEGACY_SECTION_STARTS]) {
    const start = t.indexOf(startMark);
    if (start >= 0) {
      const endPos = t.indexOf(SHOP_SECTION_END, start);
      t = (t.slice(0, start) + (endPos >= 0 ? t.slice(endPos + SHOP_SECTION_END.length) : '')).trimEnd();
    }
  }
  return t;
}
function applyShopSection(current: string, lines: string[]): string {
  const MAX = 4900;
  let base = stripShopSection(current).trimEnd();
  const section = [SHOP_SECTION_START, ...lines, SHOP_SECTION_END].join('\n');
  let next = base ? `${base}\n\n${section}` : section;
  if (next.length > MAX) {
    // Recorta la parte original (letra) para conservar la sección de tienda completa.
    const room = MAX - section.length - 2;
    base = room > 0 ? base.slice(0, room).trimEnd() : '';
    next = base ? `${base}\n\n${section}` : section.slice(0, MAX);
  }
  return next;
}
// Texto del comentario auto-publicado tras subir el video (links de compra).
function buildShopComment(ctx: ArtistMarketingContext, videoTag?: string): string {
  const hasProducts = ctx.productItems && ctx.productItems.length > 0;
  const hasEvents = ctx.events && ctx.events.length > 0;
  if (!hasProducts && !hasEvents) return '';
  const head = `� Tienda oficial de ${ctx.artistName} — productos, shows y música 👇`;
  const body = buildCommerceLines({
    artistName: ctx.artistName,
    artistUrl: ctx.artistUrl,
    storeUrl: ctx.storeUrl,
    productItems: ctx.productItems,
    events: ctx.events,
    videoTag,
  });
  return [head, '', ...body].join('\n').slice(0, 9000);
}

interface ArtistMarketingContext {
  artistName: string;
  slug: string;
  genre: string;
  bio: string;
  profileImageUrl: string;
  products: string[];
  productItems: CommerceProduct[];
  events: CommerceEvent[];
  artistUrl: string;
  storeUrl: string;
}
async function getArtistMarketingContext(userId: number): Promise<ArtistMarketingContext> {
  let artistName = 'Artist';
  let slug = '';
  let genre = '';
  let bio = '';
  let profileImageUrl = '';
  try {
    const { rows } = await pool.query(
      `SELECT artist_name, username, slug, genre, biography, profile_image_url, profile_image
       FROM users WHERE id=$1`,
      [userId]
    );
    if (rows[0]) {
      artistName = rows[0].artist_name || rows[0].username || artistName;
      slug = rows[0].slug || '';
      genre = rows[0].genre || '';
      bio = (rows[0].biography || '').slice(0, 400);
      profileImageUrl = rows[0].profile_image_url || rows[0].profile_image || '';
    }
  } catch (e: any) {
    console.warn('[LyricsVideo] getArtistMarketingContext users lookup:', e?.message);
  }
  let products: string[] = [];
  let productItems: CommerceProduct[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT id, title, presale_price, currency FROM smart_merch_products
       WHERE artist_id=$1 AND is_published=true AND status<>'archived'
       ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );
    productItems = rows
      .filter((r) => r.title)
      .map((r) => ({
        id: Number(r.id),
        title: String(r.title),
        price: r.presale_price,
        currency: r.currency || 'usd',
      }));
    products = productItems.map((p) => p.title);
  } catch {
    /* tabla de merch opcional */
  }
  // Próximos shows publicados (futuros) para enlazar entradas desde el video.
  let events: CommerceEvent[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT id, title, starts_at, venue, location FROM concert_events
       WHERE artist_id=$1 AND status IN ('published','live','on_sale')
         AND (starts_at IS NULL OR starts_at >= NOW())
       ORDER BY starts_at ASC NULLS LAST LIMIT 4`,
      [userId]
    );
    events = rows
      .filter((r) => r.title)
      .map((r) => ({
        id: Number(r.id),
        title: String(r.title),
        startsAt: r.starts_at,
        venue: r.venue || '',
        location: r.location || '',
      }));
  } catch {
    /* módulo de conciertos opcional */
  }
  // Si la fila no tiene slug guardado, derivamos uno como último recurso para no
  // dejar el enlace del artista apuntando solo al dominio raíz.
  if (!slug) slug = slugifyArtist(artistName);
  const artistUrl = slug ? `${PUBLIC_ARTIST_BASE_URL}/artist/${slug}` : PUBLIC_ARTIST_BASE_URL;
  const storeUrl = slug ? `${PUBLIC_ARTIST_BASE_URL}/artist/${slug}/store` : PUBLIC_ARTIST_BASE_URL;
  return { artistName, slug, genre, bio, profileImageUrl, products, productItems, events, artistUrl, storeUrl };
}

// Resuelve el nombre del artista del PERFIL que se está editando.
// Prioridad: (1) el nombre que manda el cliente (refleja el perfil visto, p.ej.
// "REDWINE CONTROL"); (2) el perfil identificado por profileId (pgId del perfil);
// (3) el usuario logueado; (4) "Artist". Esto evita usar un row de usuario
// distinto (sin artist_name) cuando el id logueado ≠ id del perfil.
async function resolveProfileArtistName(
  clientName?: string,
  profileId?: number,
  fallbackUserId?: number,
): Promise<string> {
  const fromClient = (clientName || '').trim();
  if (fromClient && fromClient !== 'Artist') return fromClient;
  for (const id of [profileId, fallbackUserId]) {
    if (!id) continue;
    try {
      const ctx = await getArtistMarketingContext(id);
      if (ctx.artistName && ctx.artistName !== 'Artist') return ctx.artistName;
    } catch { /* perfil opcional */ }
  }
  return fromClient || 'Artist';
}

// Devuelve TODOS los ids de artista que controla un usuario: su propio id +
// los perfiles de artista que generó (users.generated_by = userId, p.ej. artistas
// creados por IA). Los videos de lyrics pertenecen al PERFIL (no al usuario que
// lo creó), así que la propiedad de un job se valida contra este conjunto.
async function getOwnedArtistIds(userId: number): Promise<number[]> {
  const ids = new Set<number>();
  if (userId) ids.add(userId);
  try {
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE generated_by = $1`,
      [userId]
    );
    for (const r of rows) if (r.id) ids.add(r.id);
  } catch { /* tabla users opcional */ }
  return Array.from(ids);
}

// ¿El usuario controla este perfil de artista? (su propio id o un perfil que generó)
async function userOwnsArtist(userId: number, artistId: number): Promise<boolean> {
  if (!userId || !artistId) return false;
  if (userId === artistId) return true;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM users WHERE id = $1 AND (id = $2 OR generated_by = $2) LIMIT 1`,
      [artistId, userId]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// Reconstruye la letra a partir de los segmentos/palabras almacenados en el job.
function extractLyricsFromJob(job: any, maxChars = 1500): string {
  try {
    const segs = Array.isArray(job?.segments_json) ? job.segments_json : [];
    let text = segs
      .map((s: any) => String(s?.text || '').trim())
      .filter(Boolean)
      .join('\n');
    if (!text && Array.isArray(job?.words_json)) {
      text = job.words_json.map((w: any) => String(w?.word || w?.text || '')).join(' ').replace(/\s+/g, ' ').trim();
    }
    return text.slice(0, maxChars);
  } catch {
    return '';
  }
}

// Detecta TENDENCIAS DE BÚSQUEDA reales: consulta el autocompletado público de
// YouTube (ds=yt) y Google (web) — las frases EXACTAS que la gente teclea ahora
// mismo. Es gratis y sin API key. Best-effort: timeouts cortos y nunca lanza.
async function fetchSearchTrends(seeds: string[], max = 24): Promise<string[]> {
  const out = new Set<string>();
  const clean = Array.from(new Set(seeds.map((s) => (s || '').trim()).filter(Boolean))).slice(0, 6);
  await Promise.all(
    clean.map(async (seed) => {
      for (const ds of ['yt', '']) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 2500);
          const url =
            `https://suggestqueries.google.com/complete/search?client=firefox&hl=es` +
            (ds ? `&ds=${ds}` : '') + `&q=${encodeURIComponent(seed)}`;
          const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
          clearTimeout(timer);
          if (!r.ok) continue;
          const data: any = await r.json();
          const arr: any[] = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
          for (const s of arr) {
            const v = String(s).trim();
            if (v && v.length <= 60) out.add(v);
          }
        } catch {
          /* best-effort: red/timeout/parsing → ignorar */
        }
      }
    })
  );
  return Array.from(out).slice(0, max);
}

// SEO avanzado y competitivo: usa GLM-5.2 para generar título/descripcion/keywords
// virales y añade de forma DETERMINISTA links al perfil del artista, CTA a sus
// productos, la letra (si existe) y hashtags. Siempre devuelve algo válido.
async function generateVideoSeoAdvanced(opts: {
  songTitle: string;
  artistName: string;
  genre?: string;
  lyrics?: string;
  artistUrl: string;
  storeUrl: string;
  products?: string[];
  productItems?: CommerceProduct[];
  events?: CommerceEvent[];
  videoTag?: string;
}): Promise<{ title: string; description: string; tags: string[] }> {
  const { songTitle, artistName, genre = '', lyrics = '', artistUrl, storeUrl, products = [], productItems = [], events = [], videoTag } = opts;
  const cleanTag = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '');

  const year = new Date().getFullYear();
  // Tendencias de búsqueda REALES (lo que la gente teclea hoy) para guiar las
  // keywords del título/tags y posicionar el video por demanda real.
  const searchTrends = await fetchSearchTrends([
    artistName,
    songTitle,
    `${artistName} ${songTitle}`,
    genre ? `${genre} ${year}` : '',
    genre ? `${genre} music` : '',
    genre ? `nuevas canciones ${genre}` : '',
  ]);
  let aiTitle = '';
  let aiDescription = '';
  let aiTags: string[] = [];
  let aiHook = '';
  try {
    const prompt =
      `Eres el mejor estratega de SEO y marketing viral de YouTube para música` +
      (genre ? ` del género ${genre}` : '') + `. ` +
      `Crea metadata IRRESISTIBLE y COMPETITIVA para el LYRIC VIDEO OFICIAL de "${songTitle}" del artista "${artistName}". ` +
      `Objetivo: posicionar el video en la búsqueda de YouTube/Google, competir con los mejores artistas del género ${genre || 'urbano'} y maximizar CTR y retención. ` +
      (searchTrends.length
        ? `TENDENCIAS DE BÚSQUEDA REALES ahora mismo (autocompletado de YouTube/Google) — prioriza e incorpora de forma natural estas frases que la gente busca:\n${searchTrends.slice(0, 18).map((t) => `- ${t}`).join('\n')}\n`
        : '') +
      (lyrics ? `Fragmento de la letra para inspirar el tono y las keywords:\n"""${lyrics.slice(0, 800)}"""\n` : '') +
      `Reglas del título: empieza con "${artistName} - ${songTitle}", añade un gancho emocional corto entre paréntesis y termina con "(Official Lyric Video)"; máximo 90 caracteres; las keywords más buscadas van al principio. ` +
      `Devuelve SOLO JSON con esta forma exacta: ` +
      `{"title":"título <=90 caracteres siguiendo las reglas",` +
      `"hook":"1 línea de máximo 100 caracteres, rica en keywords de búsqueda (nombre del artista, título, '${genre} ${year}', letra/lyrics) para los primeros resultados",` +
      `"description":"3-5 líneas en español que enganchen y describan la emoción de la canción, SIN links ni hashtags (los añado yo)",` +
      `"tags":["20-28 keywords potentes mezclando español e inglés: nombre del artista, título, '${artistName} ${songTitle}', género ${genre}, long-tail como 'mejores canciones ${genre}', 'canciones para...', y términos por los que la gente busca este estilo de música, SIN #"]}`;
    const parsed = await callAdvancedJson(prompt);
    aiTitle = String(parsed?.title || '').slice(0, 95);
    aiHook = String(parsed?.hook || '').replace(/\s+/g, ' ').trim().slice(0, 110);
    aiDescription = String(parsed?.description || '').trim();
    if (Array.isArray(parsed?.tags)) aiTags = parsed.tags.map((t: any) => String(t).trim()).filter(Boolean);
  } catch (e: any) {
    console.warn('[LyricsVideo] SEO avanzado fallback:', e?.message);
  }

  const title = (aiTitle || `${songTitle} - ${artistName} (Official Lyric Video)`).slice(0, 100);

  const baseTags = [
    artistName,
    songTitle,
    `${artistName} ${songTitle}`,
    `${songTitle} ${artistName}`,
    `${songTitle} letra`,
    `${songTitle} lyrics`,
    `${artistName} letra`,
    `${artistName} ${year}`,
    `${artistName} nueva canción`,
    `${artistName} official`,
    genre,
    genre ? `${genre} music` : '',
    genre ? `música ${genre}` : '',
    genre ? `mejores canciones ${genre}` : '',
    genre ? `${genre} nuevo ${year}` : '',
    genre ? `nueva música ${genre} ${year}` : '',
    'official lyric video',
    'lyric video oficial',
    'lyric video',
    'letra',
    'lyrics',
    'video con letra',
    'music',
    'nueva canción',
    `música nueva ${year}`,
    `canciones ${year}`,
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);
  const { sanitizeYoutubeTags } = await import('../services/youtube-service');
  // Las tendencias de búsqueda reales van PRIMERO (más peso) + IA + base.
  const trendTags = searchTrends.filter((t) => t.length >= 3 && t.length <= 60);
  const tags = sanitizeYoutubeTags([...trendTags, ...aiTags, ...baseTags]);

  const lines: string[] = [];
  // Las 2 PRIMERAS líneas y los primeros ~150 caracteres son los que más pesan
  // para posicionar en la búsqueda: cabecera rica en keywords + gancho de IA.
  lines.push(`${artistName} - ${songTitle} | Official Lyric Video (Letra/Lyrics)${genre ? ` | ${genre} ${year}` : ` ${year}`}`);
  lines.push(aiHook || `Escucha "${songTitle}" de ${artistName}, el nuevo lyric video oficial${genre ? ` de ${genre}` : ''} ${year}. Letra completa, dale play y compártelo.`);
  lines.push('');
  // Descripción emocional generada por IA (o un fallback con nombre + título).
  if (aiDescription) {
    lines.push(aiDescription);
  } else {
    lines.push(`▶️ "${songTitle}" es el nuevo lyric video oficial de ${artistName}. Dale play, súbele el volumen y vívelo.`);
  }
  lines.push('');
  // Llamado a la acción + enlace DIRECTO a la página oficial del artista.
  lines.push(`👉 Página oficial de ${artistName}: ${withYoutubeUtm(artistUrl, videoTag)}`);
  // Bloque comercial: tienda + productos con deep-link/precio + próximos shows.
  if (productItems.length || events.length) {
    lines.push('');
    lines.push(...buildCommerceLines({ artistName, artistUrl, storeUrl, productItems, events, videoTag }));
  } else {
    lines.push(`🛍️ Tienda oficial y merch de ${artistName}: ${withYoutubeUtm(storeUrl, videoTag)}`);
    if (products.length) {
      lines.push(`✨ No te pierdas: ${products.slice(0, 3).join(' · ')} → ${withYoutubeUtm(storeUrl, videoTag)}`);
    }
  }
  lines.push(`🔔 Suscríbete y activa la campana para no perderte ningún lanzamiento de ${artistName}.`);
  if (lyrics) {
    lines.push('');
    lines.push('📝 Letra / Lyrics:');
    lines.push(lyrics.slice(0, 1200));
  }
  lines.push('');
  const hashtags = Array.from(
    new Set([cleanTag(artistName), cleanTag(songTitle), cleanTag(genre), 'lyricvideo', 'music', 'lyrics', 'letra'])
  )
    .filter(Boolean)
    .map((h) => `#${h}`)
    .slice(0, 10)
    .join(' ');
  lines.push(hashtags);

  const description = lines.join('\n').slice(0, 4900);
  return { title, description, tags };
}

// ─────────────────────────────────────────────────────────────────────────────
// Higgsfield Soul — generación de portadas/miniaturas que conservan el PARECIDO
// real del artista. Implementado en ../services/higgsfield-service (gated en
// HIGGSFIELD_API_KEY + HIGGSFIELD_API_SECRET; persiste el resultado a Firebase).
// ─────────────────────────────────────────────────────────────────────────────
async function higgsfieldGenerateImage(opts: {
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio?: string;
  folder: string;
}): Promise<string | undefined> {
  const { generateHiggsfieldImage } = await import('../services/higgsfield-service');
  return generateHiggsfieldImage(opts);
}

// Genera una MINIATURA (thumbnail) de YouTube. Intenta primero Higgsfield Soul
// (si está configurado) para conservar el parecido real del artista, luego cae a
// OpenAI gpt-image-1 (edición con la foto de perfil → text-to-image) y, si todo
// falla, a la carátula de la canción.
async function generateYoutubeThumbnail(opts: {
  artistName: string;
  songTitle: string;
  genre?: string;
  profileImageUrl?: string;
  coverArt?: string;
  lyrics?: string;
}): Promise<string | undefined> {
  const { artistName, songTitle, genre = '', profileImageUrl, coverArt, lyrics = '' } = opts;
  const refs = [profileImageUrl, coverArt].filter((u): u is string => !!u && /^https?:\/\//.test(u));
  // Distill the lyrics into a short visual brief so the poster tells the song's story.
  const story = lyrics.replace(/\s+/g, ' ').trim().slice(0, 600);
  const prompt =
    `Diseña un PÓSTER CINEMATOGRÁFICO estilo cartel de película / serie premium (formato horizontal 16:9) ` +
    `para el lyric video "${songTitle}" del artista musical` + (genre ? ` de ${genre}` : '') + ` "${artistName}". ` +
    `Es un THUMBNAIL ganador para YouTube: cine de alto presupuesto, iluminación dramática, alto contraste, ` +
    `colores intensos y atmósfera épica que detenga el scroll. ` +
    (refs.length
      ? `Usa la imagen de referencia del artista para conservar su PARECIDO y rostro real como protagonista de la escena. `
      : `El artista aparece como protagonista heroico de la escena. `) +
    (story
      ? `La escena debe contar visualmente la HISTORIA de la canción inspirada en esta letra: "${story}". `
      : `Construye una escena cinematográfica evocadora acorde al título. `) +
    `Integra el TÍTULO "${songTitle}" como un TRATAMIENTO TIPOGRÁFICO de título de película grande, dramático y legible (estilo cartel de blockbuster). ` +
    `Incluye la palabra "BOOSTIFY" como wordmark limpio, pequeño y elegante (créditos superiores o inferiores del cartel). ` +
    `NO incluyas ningún logo de marca, NO menciones ni representes Netflix ni ninguna plataforma de streaming, ` +
    `NO añadas marcas de agua. Solo el título de la canción y la palabra BOOSTIFY como texto.`;
  try {
    // 1) Higgsfield Soul (preserva el parecido real del artista) si está configurado.
    const higgs = await higgsfieldGenerateImage({
      prompt,
      referenceImageUrl: refs[0],
      aspectRatio: '16:9',
      folder: 'youtube-thumbnails',
    });
    if (higgs) return higgs;

    // 2) OpenAI gpt-image-1 con la foto del artista como referencia.
    if (refs.length) {
      const { editImageWithGPTImage1 } = await import('../services/fal-service');
      const img = await editImageWithGPTImage1(refs, prompt, {
        size: '1536x1024',
        quality: 'high',
        outputFolder: 'youtube-thumbnails',
      });
      if (img?.success && img.imageUrl) return img.imageUrl;
    }
    const { generateImageWithGPTImage1 } = await import('../services/fal-service');
    const img2 = await generateImageWithGPTImage1(prompt, { size: '1536x1024', quality: 'high' });
    if (img2?.success && img2.imageUrl) return img2.imageUrl;
  } catch (e: any) {
    console.warn('[LyricsVideo] generación de miniatura falló:', e?.message);
  }
  return coverArt || undefined;
}

// Genera metadata SEO (título, descripción, tags/keywords) para el lyric video.
// Usa OpenAI; si falla cae a un template seguro.
async function generateVideoSeo(
  songTitle: string,
  artistName: string
): Promise<{ title: string; description: string; tags: string[] }> {
  const cleanTag = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '');
  const fallback = {
    title: `${songTitle} - ${artistName} (Official Lyric Video)`.slice(0, 100),
    description:
      `${songTitle} — ${artistName}. Official lyric video.\n\n` +
      `#${cleanTag(artistName)} #${cleanTag(songTitle)} #lyricvideo #music #lyrics`,
    tags: [artistName, songTitle, 'lyric video', 'official lyric video', 'music', 'lyrics', 'official audio'].filter(Boolean),
  };
  try {
    if (!process.env.OPENAI_API_KEY) return fallback;
    const { createTrackedOpenAI } = await import('../utils/tracked-openai');
    const { PRIMARY_MODEL } = await import('../utils/ai-config');
    const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt =
      `Eres experto en SEO de YouTube para música. Genera metadata para el LYRIC VIDEO OFICIAL de la canción ` +
      `"${songTitle}" del artista "${artistName}". Devuelve SOLO JSON válido con esta forma: ` +
      `{"title":"<=100 chars, atractivo, incluye (Official Lyric Video)","description":"2-4 líneas describiendo la canción + una línea final con 6-8 hashtags","tags":["12-18 keywords relevantes mezclando español e inglés, sin #"]}`;
    const resp = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    const txt = resp.choices[0]?.message?.content || '';
    const parsed = JSON.parse(txt);
    return {
      title: String(parsed.title || fallback.title).slice(0, 100),
      description: String(parsed.description || fallback.description).slice(0, 4900),
      tags:
        Array.isArray(parsed.tags) && parsed.tags.length
          ? parsed.tags.map((t: any) => String(t)).slice(0, 18)
          : fallback.tags,
    };
  } catch (e: any) {
    console.warn('[LyricsAlbum] SEO gen fallback:', e?.message);
    return fallback;
  }
}

async function processAlbum(albumId: number): Promise<void> {
  await ensureLyricsVideoAlbumsTable();
  const { rows } = await pool.query(`SELECT * FROM lyrics_video_albums WHERE id=$1`, [albumId]);
  if (!rows.length) return;
  const album = rows[0];
  if (album.status === 'done') return;

  const songs: AlbumSongEntry[] = Array.isArray(album.songs_json) ? album.songs_json : [];
  const theme = album.theme || 'blur';
  const accentColor = album.accent_color || '#7c3aed';
  const fontFamily = album.font_family || 'Inter';
  let artistName: string = album.artist_name || 'Artist';
  const artistId: number = album.artist_id;
  const autoUpload: boolean = album.auto_upload !== false;
  const privacyStatus: 'public' | 'unlisted' | 'private' = album.privacy_status || 'public';

  // Resolve modern lyric style (by genre) + the artist gallery photo pool once
  // for the whole album. Each song's cover is prepended per-render below.
  let albumLyricStyle: 'glow' | 'kinetic' | 'neon' | 'elegant' | 'bold' | 'clean' = 'glow';
  let galleryImages: string[] = [];
  try {
    const ctx = await getArtistMarketingContext(artistId);
    albumLyricStyle = lyricStyleForGenre(ctx.genre);
    galleryImages = await gatherBackgroundImages(artistId);
  } catch { /* optional */ }
  // Profile name is the source of truth; prefer the stored album name, then a
  // profile lookup, falling back to "Artist".
  artistName = await resolveProfileArtistName(album.artist_name, artistId, artistId);

  console.log(`[LyricsAlbum] ▶ procesando álbum ${albumId} (${songs.length} canciones) para "${artistName}"`);

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    if (song.status === 'done') continue;
    if (!song.audioUrl) {
      song.status = 'failed';
      song.error = 'No audio URL';
      await persistAlbumSongs(albumId, songs);
      continue;
    }
    try {
      // 1) Transcribir
      song.status = 'transcribing';
      song.error = undefined;
      await persistAlbumSongs(albumId, songs);
      console.log(`[LyricsAlbum] album ${albumId} (${i + 1}/${songs.length}) transcribiendo "${song.title}"`);
      const result = await transcribeWithWords(song.audioUrl);
      if (!result || !result.segments?.length) throw new Error('Transcription failed — sin segmentos');

      // 2) Crear job row
      const { pgSongId, firestoreSongId } = await resolveSongIds(song.songId ?? undefined);
      const { rows: jrows } = await pool.query<{ id: number }>(
        `INSERT INTO lyrics_video_jobs
           (artist_id, song_id, firestore_song_id, status, segments_json, words_json, duration_secs,
            song_title, artist_name, cover_art_url, audio_url)
         VALUES ($1,$2,$3,'transcribed',$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          artistId, pgSongId, firestoreSongId,
          JSON.stringify(result.segments), JSON.stringify(result.words), result.duration ?? null,
          song.title || null, artistName, song.coverArt || null, song.audioUrl,
        ]
      );
      song.jobId = jrows[0].id;

      // 3) Renderizar (espera a que termine)
      song.status = 'rendering';
      await persistAlbumSongs(albumId, songs);
      const durationSecs = Number(result.duration) || 180;
      const durationFrames = Math.ceil(durationSecs * 30) + 30;
      const songBackgrounds = Array.from(
        new Set([song.coverArt, ...galleryImages].filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)))
      ).slice(0, 6);
      const inputProps = {
        audioUrl: song.audioUrl,
        coverArt: song.coverArt ?? undefined,
        artistName,
        songTitle: song.title || 'Lyrics Video',
        segments: result.segments,
        theme,
        accentColor,
        fontFamily,
        lyricStyle: albumLyricStyle,
        layout: 'center',
        backgroundImages: songBackgrounds,
        showProgressBar: true,
        showWatermark: true,
        durationSecs,
      };
      await pool.query(
        `UPDATE lyrics_video_jobs SET status='rendering', progress=0, theme=$2, accent_color=$3,
         font_family=$4, input_props_json=$5, updated_at=NOW() WHERE id=$1`,
        [song.jobId, theme, accentColor, fontFamily, JSON.stringify(inputProps)]
      );
      renderProgress.set(song.jobId, { progress: 0, status: 'rendering', log: '' });

      const outcome = await renderJobToCompletion(song.jobId, inputProps, durationFrames);
      if (!outcome.ok) throw new Error(outcome.error || 'Render failed');
      song.status = 'done';
      song.outputUrl = outcome.outputUrl;
      song.error = undefined;
      console.log(`[LyricsAlbum] album ${albumId} ✓ "${song.title}" listo`);

      // 4) Auto-subida a YouTube (best-effort, no rompe el álbum si falla)
      if (autoUpload && outcome.outputUrl) {
        try {
          const { getValidAccessToken, uploadVideoToYoutube } = await import('../services/youtube-service');
          const token = await getValidAccessToken(artistId);
          if (token) {
            // Contexto del artista + letra para SEO competitivo y CTA a su perfil/tienda.
            const ctx = await getArtistMarketingContext(artistId);
            let lyrics = '';
            try {
              const { rows: jr } = await pool.query(
                `SELECT segments_json, words_json FROM lyrics_video_jobs WHERE id=$1`,
                [song.jobId]
              );
              if (jr[0]) lyrics = extractLyricsFromJob(jr[0]);
            } catch {}
            const seo = await generateVideoSeoAdvanced({
              songTitle: song.title,
              artistName: ctx.artistName || artistName,
              genre: ctx.genre,
              lyrics,
              artistUrl: ctx.artistUrl,
              storeUrl: ctx.storeUrl,
              products: ctx.products,
              productItems: ctx.productItems,
              events: ctx.events,
              videoTag: `lv${song.jobId}`,
            });
            // Miniatura IA cinematográfica (póster con título + BOOSTIFY) basada en la letra.
            const thumbnailUrl = await generateYoutubeThumbnail({
              artistName: ctx.artistName || artistName,
              songTitle: song.title,
              genre: ctx.genre,
              profileImageUrl: ctx.profileImageUrl,
              coverArt: song.coverArt || undefined,
              lyrics,
            });
            const up = await uploadVideoToYoutube({
              userId: artistId,
              videoUrl: outcome.outputUrl,
              title: seo.title,
              description: seo.description,
              tags: seo.tags,
              privacyStatus,
              thumbnailUrl,
              // Cada artista tiene UN playlist con todas sus canciones.
              playlistTitle: ctx.artistName || artistName,
              playlistDescription: `Todas las canciones de ${ctx.artistName || artistName}. ${ctx.artistUrl}`,
            });
            song.youtubeUrl = up.url;
            song.uploadError = undefined;
            await pool.query(`UPDATE lyrics_video_jobs SET youtube_url=$2, thumbnail_url=COALESCE($3, thumbnail_url), updated_at=NOW() WHERE id=$1`, [song.jobId, up.url, thumbnailUrl || null]);
            // Comentario "SHOP THIS VIDEO" con productos + shows (best-effort).
            try {
              const shopComment = buildShopComment(ctx, `lv${song.jobId}`);
              if (shopComment && up.videoId) {
                const { insertVideoComment } = await import('../services/youtube-service');
                await insertVideoComment(artistId, up.videoId, shopComment);
              }
            } catch (ce: any) {
              console.warn(`[LyricsAlbum] shop comment "${song.title}" falló:`, ce?.message);
            }
            console.log(`[LyricsAlbum] ↑ "${song.title}" subido a YouTube: ${up.url}`);
          } else {
            song.uploadError = 'YouTube no conectado';
            console.log(`[LyricsAlbum] auto-upload omitido (artista ${artistId} sin YouTube conectado)`);
          }
        } catch (e: any) {
          song.uploadError = (e?.message || 'upload failed').slice(0, 200);
          console.error(`[LyricsAlbum] auto-upload "${song.title}" falló:`, song.uploadError);
        }
      }
    } catch (e: any) {
      song.status = 'failed';
      song.error = (e?.message || 'failed').slice(0, 300);
      console.error(`[LyricsAlbum] album ${albumId} ✗ "${song.title}":`, song.error);
    }
    await persistAlbumSongs(albumId, songs);

    // Pausa de drenaje entre canciones: deja que las lambdas de la canción que
    // acaba de terminar se liberen antes de lanzar la siguiente, para no chocar
    // contra la cuota de concurrencia de AWS (10) en cuentas nuevas.
    const hasMore = songs.slice(i + 1).some((s) => s.status !== 'done');
    if (hasMore && isLambdaConfigured()) {
      const drainMs = Math.max(0, Number(process.env.LYRICS_ALBUM_DRAIN_MS) || 12_000);
      if (drainMs > 0) await new Promise((r) => setTimeout(r, drainMs));
    }
  }

  const doneCount = songs.filter((s) => s.status === 'done').length;
  const finalStatus = doneCount > 0 ? 'done' : 'failed';
  await pool.query(
    `UPDATE lyrics_video_albums SET status=$2, completed_songs=$3, updated_at=NOW() WHERE id=$1`,
    [albumId, finalStatus, doneCount]
  );
  console.log(`[LyricsAlbum] ■ álbum ${albumId} ${finalStatus} (${doneCount}/${songs.length})`);
  await sendAlbumCompletionEmail(albumId);
}

async function sendAlbumCompletionEmail(albumId: number): Promise<void> {
  try {
    const { rows } = await pool.query(`SELECT * FROM lyrics_video_albums WHERE id=$1`, [albumId]);
    if (!rows.length) return;
    const album = rows[0];
    if (album.email_sent) return;

    let to = String(album.email || '').trim();
    if (!to && album.artist_id) {
      const { rows: u } = await pool.query(`SELECT email FROM users WHERE id=$1`, [album.artist_id]);
      to = String(u[0]?.email || '').trim();
    }
    if (!to) {
      console.warn(`[LyricsAlbum] album ${albumId}: sin email de destino, no se envía confirmación`);
      return;
    }

    const songs: AlbumSongEntry[] = Array.isArray(album.songs_json) ? album.songs_json : [];
    const done = songs.filter((s) => s.status === 'done');
    const failed = songs.filter((s) => s.status === 'failed');
    const uploaded = done.filter((s) => s.youtubeUrl);
    const list = done
      .map((s) => (s.youtubeUrl ? `• <a href="${s.youtubeUrl}">${s.title}</a> (en YouTube)` : `• ${s.title}`))
      .join('<br/>') || '—';
    const subject = `🎬 Tus lyric videos están listos (${done.length}/${songs.length})`;
    const title = 'Tu álbum de lyric videos está listo';
    const message =
      `Hola ${album.artist_name || 'artista'}, generamos <b>${done.length}</b> lyric video(s) ` +
      (uploaded.length ? `y subimos <b>${uploaded.length}</b> a tu canal de YouTube. ` : `listos para subir a YouTube. `) +
      `<br/><br/><b>Videos:</b><br/>${list}` +
      (failed.length ? `<br/><br/>⚠️ ${failed.length} no se pudieron generar; puedes reintentarlos desde el estudio.` : '');

    const { sendNotificationEmail } = await import('../services/resend-email-service');
    const appUrl = process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://boostifymusic.com';
    await sendNotificationEmail(to, subject, title, message, 'Ver mis videos', appUrl);

    await pool.query(`UPDATE lyrics_video_albums SET email_sent=true, updated_at=NOW() WHERE id=$1`, [albumId]);
    console.log(`[LyricsAlbum] album ${albumId}: email de confirmación enviado a ${to}`);
  } catch (e: any) {
    console.error(`[LyricsAlbum] album ${albumId} email error:`, e?.message || e);
  }
}

// Reanuda álbumes 'processing' tras un reinicio del servidor (tsx watch / deploy)
async function resumeProcessingAlbums(): Promise<void> {
  try {
    await ensureLyricsVideoAlbumsTable();
    const { rows } = await pool.query(`SELECT id FROM lyrics_video_albums WHERE status='processing' ORDER BY id ASC`);
    for (const r of rows) enqueueAlbum(r.id);
    if (rows.length) console.log(`[LyricsAlbum] reanudando ${rows.length} álbum(es) en proceso tras el arranque`);
  } catch (e: any) {
    console.error('[LyricsAlbum] resume on boot error:', e?.message || e);
  }
}
void resumeProcessingAlbums();

// ── Endpoints ───────────────────────────────────────────────────────────────

const albumStartSchema = z.object({
  songs: z
    .array(
      z.object({
        songId: z.union([z.number(), z.string()]).nullish(),
        title: z.string().min(1).default('Untitled'),
        audioUrl: z.string().url(),
        coverArt: z.string().url().nullish(),
      })
    )
    .min(1)
    .max(50),
  theme: z.enum(['dark', 'light', 'gradient', 'blur']).default('blur'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7c3aed'),
  fontFamily: z.string().default('Inter'),
  autoUpload: z.boolean().default(true),
  privacyStatus: z.enum(['public', 'unlisted', 'private']).default('public'),
  email: z.string().email().optional(),
});

// POST /api/lyrics-video/album/start — arranca la generación del álbum completo
router.post('/album/start', authenticate, async (req, res) => {
  try {
    await ensureLyricsVideoJobsTable();
    await ensureLyricsVideoAlbumsTable();
    const body = albumStartSchema.parse(req.body);
    const userId = (req as any).user?.id as number;
    if (!userId) return res.status(400).json({ error: 'Could not resolve artist — please reload' });

    let artistName = 'Artist';
    let email = body.email || '';
    try {
      const { rows } = await pool.query(`SELECT email, artist_name, username FROM users WHERE id=$1`, [userId]);
      if (rows[0]) {
        artistName = rows[0].artist_name || rows[0].username || 'Artist';
        if (!email) email = rows[0].email || '';
      }
    } catch {}

    const songs: AlbumSongEntry[] = body.songs.map((s) => ({
      songId: s.songId ?? null,
      title: s.title,
      audioUrl: s.audioUrl,
      coverArt: s.coverArt ?? null,
      status: 'pending',
    }));

    const { rows: arows } = await pool.query<{ id: number }>(
      `INSERT INTO lyrics_video_albums
         (artist_id, artist_name, email, status, theme, accent_color, font_family, auto_upload, privacy_status, total_songs, completed_songs, songs_json)
       VALUES ($1,$2,$3,'processing',$4,$5,$6,$7,$8,$9,0,$10)
       RETURNING id`,
      [userId, artistName, email || null, body.theme, body.accentColor, body.fontFamily, body.autoUpload, body.privacyStatus, songs.length, JSON.stringify(songs)]
    );
    const albumId = arows[0].id;
    enqueueAlbum(albumId);

    return res.json({ albumId, status: 'processing', totalSongs: songs.length });
  } catch (err: any) {
    console.error('[LyricsVideo] /album/start error:', err);
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/lyrics-video/album/:albumId/status — progreso por canción
router.get('/album/:albumId/status', authenticate, async (req, res) => {
  try {
    await ensureLyricsVideoAlbumsTable();
    const albumId = parseInt(req.params.albumId, 10);
    const userId = (req as any).user?.id as number;
    if (!Number.isFinite(albumId)) return res.status(400).json({ error: 'Invalid album id' });
    const { rows } = await pool.query(
      `SELECT id, status, theme, accent_color, font_family, total_songs, completed_songs,
              songs_json, email, email_sent, created_at, updated_at
       FROM lyrics_video_albums WHERE id=$1 AND artist_id=$2`,
      [albumId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Album not found' });
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/lyrics-video/albums — últimos álbumes del artista
router.get('/albums', authenticate, async (req, res) => {
  try {
    await ensureLyricsVideoAlbumsTable();
    const userId = (req as any).user?.id as number;
    const { rows } = await pool.query(
      `SELECT id, status, total_songs, completed_songs, email_sent, created_at, updated_at
       FROM lyrics_video_albums WHERE artist_id=$1 ORDER BY id DESC LIMIT 10`,
      [userId]
    );
    return res.json({ albums: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/lyrics-video/album/:albumId/retry — reintenta SOLO las canciones que
// fallaron (p.ej. por límite de concurrencia de AWS Lambda). Las marca 'pending',
// reabre el álbum como 'processing' y lo re-encola; el worker omite las que ya
// están 'done' y vuelve a renderizar el resto con el reintento+backoff.
router.post('/album/:albumId/retry', authenticate, async (req, res) => {
  try {
    await ensureLyricsVideoAlbumsTable();
    const albumId = parseInt(req.params.albumId, 10);
    const userId = (req as any).user?.id as number;
    if (!Number.isFinite(albumId)) return res.status(400).json({ error: 'Invalid album id' });

    const { rows } = await pool.query(
      `SELECT * FROM lyrics_video_albums WHERE id=$1 AND artist_id=$2`,
      [albumId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Album not found' });
    const album = rows[0];
    if (album.status === 'processing') {
      return res.json({ success: true, alreadyProcessing: true, albumId });
    }

    const songs: AlbumSongEntry[] = Array.isArray(album.songs_json) ? album.songs_json : [];
    let retryCount = 0;
    for (const s of songs) {
      if (s.status !== 'done') {
        s.status = 'pending';
        s.error = undefined;
        s.jobId = undefined;
        retryCount++;
      }
    }
    if (retryCount === 0) {
      return res.json({ success: true, retryCount: 0, message: 'No hay canciones pendientes' });
    }

    const completed = songs.filter((s) => s.status === 'done').length;
    await pool.query(
      `UPDATE lyrics_video_albums
       SET status='processing', completed_songs=$2, songs_json=$3, email_sent=false, error_msg=NULL, updated_at=NOW()
       WHERE id=$1`,
      [albumId, completed, JSON.stringify(songs)]
    );
    enqueueAlbum(albumId);
    return res.json({ success: true, retryCount, albumId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// (portada/banner + descripción + keywords generados con IA). Requiere el scope
// de gestión de canal (reconectar YouTube si solo se concedió subida).
router.post('/youtube/setup-channel', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id as number;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { getYoutubeManageState, setChannelBranding } = await import('../services/youtube-service');
    const state = await getYoutubeManageState(userId);
    if (!state.connected) {
      return res.status(412).json({ error: 'YouTube no conectado', needsConnect: true });
    }
    if (!state.canManageChannel) {
      return res.status(412).json({
        error: 'Permiso insuficiente para gestionar el canal',
        needsReconnect: true,
        instructions: 'Reconecta tu cuenta de YouTube para conceder el permiso de gestión del canal.',
      });
    }

    // Datos del artista para los prompts
    const ctx = await getArtistMarketingContext(userId);
    const artistName = ctx.artistName || state.channelTitle || 'Artist';
    const genre = ctx.genre;
    const bio = ctx.bio;

    // 1) Descripción + keywords del canal (GLM-5.2 con fallback OpenAI/template)
    const channelFooter =
      `👉 Página oficial de ${artistName}: ${ctx.artistUrl}\n` +
      `🛍️ Tienda y merch: ${ctx.storeUrl}\n` +
      `🔔 Suscríbete y activa la campana para no perderte ningún lanzamiento.`;
    const channelHeader = `🎤 ${artistName} — Canal Oficial${genre ? ` · ${genre}` : ''}`;
    let description = `${channelHeader}\n\nMúsica oficial, lyric videos y lanzamientos de ${artistName}.\n\n${channelFooter}`.slice(
      0,
      1000
    );
    let keywords: string[] = [artistName, genre, genre ? `${genre} music` : '', 'music', 'official', 'lyric video', 'artist']
      .map((s) => String(s).trim())
      .filter(Boolean);
    try {
      const prompt =
        `Eres experto en branding y SEO de canales de YouTube para artistas musicales que quieren COMPETIR y posicionarse en su género. ` +
        `Para el artista "${artistName}"` +
        (genre ? ` (género: ${genre})` : '') +
        (bio ? `. Bio: ${bio}` : '') +
        `. Devuelve SOLO JSON: {"description":"descripción de canal atractiva y profesional, 2-4 líneas en español que mencionen al artista por su nombre, sin links ni hashtags (los añado yo)",` +
        `"keywords":["12-18 keywords competitivas mezclando español e inglés para posicionar al artista en su género, sin #"]}`;
      const parsed = await callAdvancedJson(prompt);
      const aiDesc = String(parsed?.description || '').trim();
      if (aiDesc) {
        description = `${channelHeader}\n\n${aiDesc.slice(0, 600)}\n\n${channelFooter}`.slice(0, 1000);
      }
      if (Array.isArray(parsed?.keywords) && parsed.keywords.length) {
        keywords = Array.from(
          new Set([...parsed.keywords.map((k: any) => String(k).trim()).filter(Boolean), artistName, genre].filter(Boolean))
        ).slice(0, 18);
      }
    } catch (e: any) {
      console.warn('[LyricsVideo] channel SEO fallback:', e?.message);
    }

    // 2) Banner / portada del canal (OpenAI gpt-image-1, 16:9, con la foto del artista)
    let bannerImageUrl: string | undefined;
    try {
      const bannerPrompt =
        `Cinematic, premium YouTube channel banner (wide 16:9) for the music artist "${artistName}"` +
        (genre ? `, ${genre} genre` : '') +
        `. Use the reference image to keep the artist's real likeness as the hero. ` +
        `Modern, high-contrast, atmospheric lighting, brand-forward, leaving the center clear for the channel title. ` +
        `NO text, NO words, NO letters, NO logos in the image.`;
      // 1) Higgsfield Soul (conserva el parecido real del artista) si está configurado.
      bannerImageUrl = await higgsfieldGenerateImage({
        prompt: bannerPrompt,
        referenceImageUrl: ctx.profileImageUrl,
        aspectRatio: '16:9',
        folder: 'youtube-channel-banners',
      });
      if (!bannerImageUrl && ctx.profileImageUrl && /^https?:\/\//.test(ctx.profileImageUrl)) {
        const { editImageWithGPTImage1 } = await import('../services/fal-service');
        const img = await editImageWithGPTImage1(ctx.profileImageUrl, bannerPrompt, {
          size: '1536x1024',
          quality: 'high',
          outputFolder: 'youtube-channel-banners',
        });
        if (img?.success && img.imageUrl) bannerImageUrl = img.imageUrl;
      }
      if (!bannerImageUrl) {
        const { generateImageWithGPTImage1 } = await import('../services/fal-service');
        const img = await generateImageWithGPTImage1(bannerPrompt, { size: '1536x1024', quality: 'high' });
        if (img?.success && img.imageUrl) bannerImageUrl = img.imageUrl;
      }
    } catch (e: any) {
      console.warn('[LyricsVideo] banner gen failed:', e?.message);
    }

    const result = await setChannelBranding({ userId, description, keywords, bannerImageUrl });
    return res.json({
      success: true,
      ...result,
      channelTitle: state.channelTitle,
      description,
      keywords,
      bannerImageUrl: bannerImageUrl || null,
    });
  } catch (err: any) {
    console.error('[LyricsVideo] /youtube/setup-channel error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
