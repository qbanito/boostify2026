import { Router, Request, Response } from 'express';
import { db, pool } from '../db';
import { songKaraoke, songs, users } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuth as getClerkAuth } from '@clerk/express';
import { authenticate } from '../middleware/auth';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { ensurePgSongFromFirestore } from '../services/firestore-song-sync';
import { separateAudio } from '../services/voice-ai-service';
import { chargeCredits } from '../services/credit-engine';
import { storage } from '../firebase';
import { fal } from '@fal-ai/client';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { promisify } from 'util';

const nodeRequire = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

// Resolve FAL credentials. This deployment provides the key under FAL_API_KEY
// (with FAL_KEY_BACKUP for failover); fall back across the known env var names so
// karaoke uses FAL wizper (no 25MB limit) instead of the size-limited Whisper path.
const FAL_KARAOKE_KEY =
  process.env.FAL_KEY ||
  process.env.FAL_AI_KEY ||
  process.env.FAL_API_KEY ||
  process.env.FAL_KEY_BACKUP ||
  '';

// Configure FAL if key available
if (FAL_KARAOKE_KEY) {
  fal.config({ credentials: FAL_KARAOKE_KEY });
}

/**
 * Downloads the song audio and transcodes it to a compact mono 16 kHz MP3 using
 * the bundled ffmpeg binary. A full song compresses to ~2-3 MB — far below
 * Whisper's 25 MB limit — so the OpenAI Whisper path works regardless of the
 * source file's size or format (wav/flac/etc.). Returns the temp file path.
 */
async function downloadAndCompressForWhisper(audioUrl: string, songId: number): Promise<string> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
  }
  const inputBuffer = Buffer.from(await response.arrayBuffer());

  const rawPath = path.join(os.tmpdir(), `karaoke-src-${songId}-${Date.now()}`);
  const outPath = path.join(os.tmpdir(), `karaoke-${songId}-${Date.now()}.mp3`);
  fs.writeFileSync(rawPath, inputBuffer);

  try {
    const ffmpegPath = nodeRequire('@ffmpeg-installer/ffmpeg').path as string;
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-i', rawPath,
        '-ac', '1',       // mono
        '-ar', '16000',   // 16 kHz (Whisper's internal sample rate)
        '-b:a', '64k',    // 64 kbps MP3
        '-map', 'a',      // audio stream only
        outPath,
      ],
      { timeout: 180_000, maxBuffer: 1024 * 1024 * 64 },
    );
    return outPath;
  } finally {
    try { fs.unlinkSync(rawPath); } catch { /* best-effort cleanup */ }
  }
}

const router = Router();

/**
 * Interpolate word-level timing within each segment.
 * When GPT generates line-level timing only (no words array), this distributes
 * each word evenly across the segment duration so the KaraokePlayer can
 * highlight word-by-word for a dynamic, karaoke-style display.
 */
function interpolateWordTimings(segments: any[]): any[] {
  return segments.map((seg: any) => {
    // Skip if segment already has valid word-level timing from Whisper
    if (seg.words && Array.isArray(seg.words) && seg.words.length > 0) return seg;
    const text = (seg.text || '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return seg;
    const startTime = seg.startTime ?? seg.start ?? 0;
    const endTime = seg.endTime ?? seg.end ?? startTime + 2;
    const duration = endTime - startTime;
    const wordDuration = duration / words.length;
    return {
      ...seg,
      words: words.map((word: string, i: number) => ({
        word,
        start: +(startTime + i * wordDuration).toFixed(3),
        end: +(startTime + (i + 1) * wordDuration).toFixed(3),
      })),
    };
  });
}

/**
 * Split overly long karaoke segments into short, readable sing-along lines.
 *
 * Some providers (notably FAL wizper with chunk_level 'segment') return a whole
 * paragraph — or even an entire intro monologue — as ONE segment. A single line
 * with dozens of words cannot fit on a karaoke screen or a 1920×1080 lyric
 * video frame, so the text renders incorrectly (overflows / unreadable).
 *
 * This breaks any segment longer than `maxWords` into multiple sub-segments on
 * word boundaries, using the per-word timings (added by interpolateWordTimings)
 * so each new line keeps accurate start/end times for highlighting. Segments
 * already short enough are returned unchanged.
 */
function splitLongSegments(segments: any[], maxWords = 8): any[] {
  const out: any[] = [];
  for (const seg of segments) {
    const segStart = seg.startTime ?? seg.start ?? 0;
    const segEnd = seg.endTime ?? seg.end ?? segStart + 2;
    const words: any[] = Array.isArray(seg.words) ? seg.words : [];
    const textWordCount = (seg.text || '').trim().split(/\s+/).filter(Boolean).length;

    // Short enough already — keep as-is.
    if (textWordCount <= maxWords) {
      out.push(seg);
      continue;
    }

    // Prefer splitting on the word-timing array (accurate per-line timing).
    if (words.length > maxWords) {
      for (let i = 0; i < words.length; i += maxWords) {
        const chunk = words.slice(i, i + maxWords);
        if (chunk.length === 0) continue;
        const start = chunk[0].start ?? segStart;
        const end = chunk[chunk.length - 1].end ?? segEnd;
        out.push({
          text: chunk.map((w: any) => w.word).join(' ').replace(/\s+/g, ' ').trim(),
          startTime: start,
          endTime: end,
          start,
          end,
          words: chunk,
        });
      }
      continue;
    }

    // No usable word timings — split the raw text evenly across the duration.
    const allWords = (seg.text || '').trim().split(/\s+/).filter(Boolean);
    const lineCount = Math.ceil(allWords.length / maxWords);
    const lineDur = (segEnd - segStart) / lineCount;
    for (let i = 0; i < lineCount; i++) {
      const chunk = allWords.slice(i * maxWords, (i + 1) * maxWords);
      if (chunk.length === 0) continue;
      const start = +(segStart + i * lineDur).toFixed(3);
      const end = +(segStart + (i + 1) * lineDur).toFixed(3);
      out.push({ text: chunk.join(' '), startTime: start, endTime: end, start, end });
    }
  }
  return out;
}

/** Parse "M:SS", plain seconds string, or number → seconds (default 180) */
function parseDurationSeconds(duration?: string | null): number {
  if (!duration) return 180;
  const mmss = duration.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  const num = parseFloat(duration);
  return !isNaN(num) && num > 0 ? num : 180;
}

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '',
});

/**
 * Resolve a songId param that might be:
 *  - a numeric string  → parse as PG primary key
 *  - a Firestore doc ID → look up PG row by firestoreId column
 * Returns the numeric PG song id, or null if not resolvable.
 */
async function resolveSongId(raw: string): Promise<number | null> {
  const numeric = parseInt(raw, 10);
  // Strict check: the ENTIRE string must be a valid integer (no leading-digit
  // Firestore IDs like "8h06XgOY..." being wrongly parsed as 8).
  if (!isNaN(numeric) && String(numeric) === raw) return numeric;
  // Firestore ID path
  const [row] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(eq(songs.firestoreId, raw))
    .limit(1);
  return row ? row.id : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/karaoke/:songId
// Returns the karaoke record for a song (if it exists and is ready)
// Public: any visitor can fetch karaoke to display for public songs
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:songId', async (req: Request, res: Response) => {
  try {
    const songId = await resolveSongId(req.params.songId);
    if (!songId) {
      // Song not synced to postgres yet — return unknown, not an error
      return res.json({ success: true, exists: false });
    }

    const [record] = await db
      .select()
      .from(songKaraoke)
      .where(eq(songKaraoke.songId, songId))
      .limit(1);

    if (!record) {
      return res.json({ success: true, exists: false });
    }

    // On-the-fly: enrich existing records that were generated without word-level timing
    const enrichedRecord = {
      ...record,
      syncedLyrics: record.syncedLyrics
        ? interpolateWordTimings(record.syncedLyrics as any[])
        : record.syncedLyrics,
    };

    return res.json({ success: true, exists: true, karaoke: enrichedRecord });
  } catch (error: any) {
    console.error('❌ [karaoke] GET error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/karaoke/:songId/generate
// Generates synced lyrics via Whisper and persists them — runs once per song.
// Public: any visitor (even logged out) can trigger karaoke generation.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:songId/generate', async (req: Request, res: Response) => {
  // Optional auth — resolve the Clerk-authenticated user's PG id so
  // ensurePgSongFromFirestore can use it as fallback owner.
  let reqUserId: number | undefined = (req as any).user?.id;
  if (!reqUserId) {
    try {
      const clerkAuth = getClerkAuth(req);
      if (clerkAuth?.userId) {
        const [dbUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkId, clerkAuth.userId))
          .limit(1);
        if (dbUser) reqUserId = dbUser.id;
      }
    } catch { /* unauthenticated — reqUserId stays undefined */ }
  }

  const rawId = req.params.songId;
  let resolvedSongId = await resolveSongId(rawId);

  // Auto-sync Firestore-only songs to PG on first karaoke generate.
  // Trigger when resolveSongId returned null AND the raw param is not a pure
  // integer (pure integers that don't exist in PG are user errors, not Firestore IDs).
  if (!resolvedSongId && !/^\d+$/.test(rawId)) {
    try {
      const { pgId } = await ensurePgSongFromFirestore({
        firestoreId: rawId,
        requesterUserId: reqUserId,
      });
      resolvedSongId = pgId;
    } catch (syncErr: any) {
      console.error('❌ [karaoke] Firestore sync failed:', syncErr.message);
      return res.status(404).json({ success: false, message: `Song not found: ${syncErr.message}` });
    }
  }

  const songId = resolvedSongId;
  if (!songId) {
    return res.status(404).json({ success: false, message: 'Song not found in database. Upload the song first.' });
  }

  // userId is optional for karaoke — use authenticated user or fall back to song owner
  const userId: number | undefined = (req as any).user?.id;
  let tempPath: string | null = null;

  try {
    // 1. Verify the song exists (ownership not required — karaoke is a listening feature
    //    accessible to any authenticated user, e.g. fans viewing an artist's profile.
    //    Firestore-synced songs may be owned by a different PG user than the requester.)
    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);

    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found in database.' });
    }

    // 2. Return cached result if already ready
    const [existing] = await db
      .select()
      .from(songKaraoke)
      .where(eq(songKaraoke.songId, songId))
      .limit(1);

    if (existing?.status === 'ready') {
      return res.json({ success: true, karaoke: existing, cached: true });
    }

    // 3. Upsert record as "processing"
    const now = new Date();
    let karaokeRecord: typeof existing;

    if (existing) {
      const [updated] = await db
        .update(songKaraoke)
        .set({ status: 'processing', errorMessage: null, updatedAt: now })
        .where(eq(songKaraoke.id, existing.id))
        .returning();
      karaokeRecord = updated;
    } else {
      const [inserted] = await db
        .insert(songKaraoke)
        .values({ songId, userId: song.userId, status: 'processing', provider: 'whisper' })
        .returning();
      karaokeRecord = inserted;
    }

    // 4a. GPT-based lyrics sync (fast path — no audio download needed)
    if (song.lyrics && song.lyrics.trim().length > 20) {
      console.log(`🤖 [karaoke] Using GPT lyrics sync for song ${songId}`);
      const durationSec = parseDurationSeconds((song as any).duration);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a karaoke timing expert. Given song lyrics and a total duration in seconds, return ONLY valid JSON with this exact shape: {"segments":[{"text":"lyrics line","startTime":0.0,"endTime":0.0}]}. Rules: split lyrics into natural sing-along lines (max ~8 words per line); distribute timing across the full duration accounting for verse/chorus/bridge structure and typical intro/outro silence; never return an empty segments array; the last segment's endTime must equal the total duration.`,
          },
          {
            role: 'user',
            content: `Song: "${song.title}"\nDuration: ${durationSec} seconds\n\nLyrics:\n${song.lyrics.trim()}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.2,
      });

      const raw = completion.choices[0]?.message?.content ?? '{"segments":[]}';
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch { parsed = { segments: [] }; }

      const syncedLyrics: any[] = Array.isArray(parsed)
        ? parsed
        : (parsed.segments ?? parsed.lyrics ?? []);

      if (syncedLyrics.length === 0) {
        throw new Error('GPT returned empty segments — please add more complete lyrics and retry');
      }

      // Enrich with word-level timing for dynamic karaoke word-by-word highlighting
      const syncedLyricsWithWords = interpolateWordTimings(syncedLyrics);

      const [final] = await db
        .update(songKaraoke)
        .set({
          syncedLyrics: syncedLyricsWithWords,
          rawTranscript: song.lyrics,
          status: 'ready',
          provider: 'gpt',
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(songKaraoke.id, karaokeRecord.id))
        .returning();

      console.log(`✅ [karaoke] GPT sync done for song ${songId}, lines: ${syncedLyricsWithWords.length}`);
      return res.json({ success: true, karaoke: final, cached: false });
    }

    // 4b. Audio transcription.
    // Primary provider: OpenAI Whisper. The source audio is downloaded and
    // transcoded to a compact mono 16 kHz MP3 first, so any file size/format
    // fits well under Whisper's 25 MB limit. FAL wizper is used only as a
    // fallback if OpenAI is unavailable or fails.
    let finalLyrics: any[] = [];
    let usedProvider: 'whisper' | 'fal-wizper' = 'whisper';

    const openaiKey = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY;

    if (openaiKey) {
      try {
        console.log(`🎤 [karaoke] Transcribing with OpenAI Whisper for song ${songId}: ${song.audioUrl}`);
        tempPath = await downloadAndCompressForWhisper(song.audioUrl, songId);
        const sizeMB = fs.statSync(tempPath).size / (1024 * 1024);
        console.log(`🎤 [karaoke] Compressed audio ready: ${tempPath} (${sizeMB.toFixed(1)} MB)`);

        const fileStream = fs.createReadStream(tempPath);
        const whisperResult = await openai.audio.transcriptions.create(
          {
            file: fileStream,
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment', 'word'],
          } as any,
          { timeout: 300_000, maxRetries: 0 },
        );

        console.log(`✅ [karaoke] Whisper done for song ${songId}, segments: ${(whisperResult as any).segments?.length ?? 0}`);

        const rawSegments: any[] = (whisperResult as any).segments ?? [];
        const rawWords: any[] = (whisperResult as any).words ?? [];

        const syncedLyrics = rawSegments.map((seg: any) => {
          const segWords = rawWords
            .filter((w: any) => w.start >= seg.start - 0.01 && w.end <= seg.end + 0.01)
            .map((w: any) => ({ word: w.word, start: w.start, end: w.end }));
          return {
            text: seg.text.trim(),
            startTime: seg.start,
            endTime: seg.end,
            words: segWords.length > 0 ? segWords : undefined,
          };
        });

        const fallbackLyrics = syncedLyrics.length === 0 && song.lyrics
          ? song.lyrics.split('\n').filter((l: string) => l.trim())
              .map((l: string, i: number) => ({ text: l.trim(), startTime: i * 3, endTime: (i + 1) * 3 }))
          : syncedLyrics;

        finalLyrics = interpolateWordTimings(splitLongSegments(fallbackLyrics, 8));
        usedProvider = 'whisper';
      } catch (whisperErr: any) {
        console.warn(`⚠️ [karaoke] OpenAI Whisper failed: ${whisperErr.message}${FAL_KARAOKE_KEY ? ' — falling back to FAL wizper' : ''}`);
      }
    }

    if (finalLyrics.length === 0 && FAL_KARAOKE_KEY) {
      // ── FAL fal-ai/wizper fallback (URL-based, no download needed) ─────────
      console.log(`🎤 [karaoke] Using FAL wizper fallback for song ${songId}: ${song.audioUrl}`);
      try {
        const falResult: any = await fal.subscribe('fal-ai/wizper', {
          input: {
            audio_url: song.audioUrl,
            task: 'transcribe',
            chunk_level: 'segment',
          },
          logs: false,
        });

        const falData = falResult?.data ?? falResult;
        const chunks: any[] = falData?.chunks ?? falData?.segments ?? [];
        console.log(`✅ [karaoke] FAL wizper done for song ${songId}, chunks: ${chunks.length}`);

        const falLyrics = chunks.map((c: any) => ({
          text: (c.text ?? '').trim(),
          startTime: c.timestamp?.[0] ?? c.start ?? 0,
          endTime: c.timestamp?.[1] ?? c.end ?? (c.timestamp?.[0] ?? 0) + 3,
        }));

        const fallback = falLyrics.length === 0 && song.lyrics
          ? song.lyrics.split('\n').filter((l: string) => l.trim())
              .map((l: string, i: number) => ({ text: l.trim(), startTime: i * 3, endTime: (i + 1) * 3 }))
          : falLyrics;

        // wizper 'segment' chunks can be whole paragraphs — split into short
        // sing-along lines before interpolating per-word timings.
        finalLyrics = interpolateWordTimings(splitLongSegments(fallback, 8));
        usedProvider = 'fal-wizper';
      } catch (falErr: any) {
        console.warn(`⚠️ [karaoke] FAL wizper failed: ${falErr.message}`);
      }
    }

    if (finalLyrics.length === 0) {
      throw new Error('No transcription provider succeeded. Ensure OPENAI_API_KEY (or a FAL key) is configured and the audio URL is reachable.');
    }

    // 7. Persist the result
    const provider = usedProvider;
    const [final] = await db
      .update(songKaraoke)
      .set({
        syncedLyrics: finalLyrics,
        rawTranscript: finalLyrics.map((l: any) => l.text).join(' '),
        status: 'ready',
        provider,
        generatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(songKaraoke.id, karaokeRecord.id))
      .returning();

    return res.json({ success: true, karaoke: final, cached: false });
  } catch (error: any) {
    console.error(`❌ [karaoke] Generate error for song ${songId}:`, error.message);

    // Mark as failed
    try {
      await db
        .update(songKaraoke)
        .set({ status: 'failed', errorMessage: error.message, updatedAt: new Date() })
        .where(eq(songKaraoke.songId, songId));
    } catch (_) {}

    return res.status(500).json({ success: false, message: error.message });
  } finally {
    // Always clean up temp file
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Instrumental (karaoke backing-track) helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download a freshly-separated instrumental and re-upload it to Firebase
 * Storage. The provider URLs (FAL / Replicate) expire within minutes, so we
 * cache a permanent copy — mirroring how synced lyrics are cached once.
 */
async function persistInstrumentalToFirebase(sourceUrl: string, songId: number): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download instrumental: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  const ext = contentType.includes('wav') ? 'wav' : contentType.includes('ogg') ? 'ogg' : 'mp3';
  const fileName = `karaoke-instrumental/${songId}/instrumental-${Date.now()}.${ext}`;
  const file = storage.bucket().file(fileName);
  await file.save(buffer, { contentType, public: true });
  return `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
}

/**
 * Best-effort, non-blocking credit metering for an instrumental generation.
 * Charged to the song owner since the result is cached forever for the artist.
 * Never blocks the feature: a karaoke listener can be any visitor.
 */
async function chargeInstrumentalCredits(ownerUserId: number, songId: number): Promise<void> {
  try {
    const [owner] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, ownerUserId))
      .limit(1);
    if (owner?.email) {
      await chargeCredits(owner.email, 'voice.separate', {
        description: `Karaoke instrumental (song ${songId})`,
        metadata: { feature: 'karaoke-instrumental', songId },
      });
    }
  } catch (err: any) {
    console.warn(`⚠️ [karaoke] instrumental credit charge skipped: ${err?.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/karaoke/:songId/instrumental
// Generates (once) and caches a vocals-removed instrumental backing track for
// karaoke mode, then re-uploads it to Firebase Storage for a permanent URL.
// Returns the cached URL on subsequent calls. Public: any visitor can request
// the instrumental for a public song.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:songId/instrumental', async (req: Request, res: Response) => {
  try {
    const songId = await resolveSongId(req.params.songId);
    if (!songId) {
      return res.status(404).json({ success: false, message: 'Song not found' });
    }

    // Load the song — need audioUrl (source) + owner (for crediting).
    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song || !song.audioUrl) {
      return res.status(404).json({ success: false, message: 'Song audio not available' });
    }

    // The instrumental shares the song_karaoke record. Ensure one exists.
    let [record] = await db
      .select()
      .from(songKaraoke)
      .where(eq(songKaraoke.songId, songId))
      .limit(1);
    if (!record) {
      [record] = await db
        .insert(songKaraoke)
        .values({ songId, userId: song.userId, status: 'pending', instrumentalStatus: 'idle' })
        .returning();
    }

    // 1. Cached and ready → return immediately (no cost).
    if (record.instrumentalStatus === 'ready' && record.instrumentalUrl) {
      return res.json({
        success: true,
        cached: true,
        instrumentalStatus: 'ready',
        instrumentalUrl: record.instrumentalUrl,
        provider: record.instrumentalProvider,
      });
    }

    // 2. A concurrent request is already generating it → tell the client to poll.
    if (record.instrumentalStatus === 'processing') {
      return res.json({ success: true, cached: false, instrumentalStatus: 'processing' });
    }

    // 3. Claim the job (prevents duplicate concurrent separations).
    await db
      .update(songKaraoke)
      .set({ instrumentalStatus: 'processing', instrumentalError: null, updatedAt: new Date() })
      .where(eq(songKaraoke.id, record.id));

    // Separate vocals from the mix → instrumental.
    // (voice-ai-service: FAL SAM Audio → Replicate Demucs → Kits.ai fallback)
    const separation = await separateAudio(song.audioUrl, 'vocals');
    if (!separation.success || !separation.instrumentalUrl) {
      await db
        .update(songKaraoke)
        .set({
          instrumentalStatus: 'failed',
          instrumentalError: separation.error || 'separation failed',
          updatedAt: new Date(),
        })
        .where(eq(songKaraoke.id, record.id));
      return res.status(502).json({
        success: false,
        instrumentalStatus: 'failed',
        message: separation.error || 'Could not generate instrumental',
      });
    }

    // Re-upload to Firebase so the URL is permanent (provider URLs expire fast).
    const permanentUrl = await persistInstrumentalToFirebase(separation.instrumentalUrl, songId);

    const [updated] = await db
      .update(songKaraoke)
      .set({
        instrumentalUrl: permanentUrl,
        instrumentalStatus: 'ready',
        instrumentalProvider: separation.provider || 'fal',
        instrumentalError: null,
        instrumentalGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(songKaraoke.id, record.id))
      .returning();

    // Best-effort metering (charged to the artist; never blocks playback).
    void chargeInstrumentalCredits(song.userId, songId);

    return res.json({
      success: true,
      cached: false,
      instrumentalStatus: 'ready',
      instrumentalUrl: updated.instrumentalUrl,
      provider: updated.instrumentalProvider,
    });
  } catch (error: any) {
    console.error('❌ [karaoke] instrumental error:', error.message);
    // Reset the record so a later attempt can retry instead of being stuck.
    try {
      const sid = await resolveSongId(req.params.songId);
      if (sid) {
        await db
          .update(songKaraoke)
          .set({ instrumentalStatus: 'failed', instrumentalError: error.message, updatedAt: new Date() })
          .where(eq(songKaraoke.songId, sid));
      }
    } catch (_) {}
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/karaoke/:songId  — owner can reset to regenerate
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:songId', authenticate, async (req: Request, res: Response) => {
  try {
    const songId = parseInt(req.params.songId, 10);
    if (isNaN(songId)) {
      return res.status(400).json({ success: false, message: 'Invalid songId' });
    }

    const userId = req.user!.id;

    await db
      .delete(songKaraoke)
      .where(and(eq(songKaraoke.songId, songId), eq(songKaraoke.userId, userId)));

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Lyric-video bridge
// Creates a lyrics_video_jobs row directly from a song's already-synced karaoke
// lyrics (no re-transcription). The existing /api/lyrics-video pipeline then
// renders it with Remotion and can upload it to YouTube. This lets the karaoke
// module produce a full lyric video without duplicating the transcription work.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Idempotently ensure the lyrics_video_jobs table exists. The lyrics-video
 * module relies on this table via raw SQL; this guard makes the karaoke bridge
 * self-sufficient and is a no-op when the table already exists (e.g. in prod).
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
}

// POST /api/karaoke/:songId/create-lyric-video  (requires sign-in)
router.post('/:songId/create-lyric-video', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const songId = await resolveSongId(req.params.songId);
    if (!songId) {
      return res.status(404).json({ success: false, message: 'Song not found.' });
    }

    // 1. Load the song + its ready karaoke record (with synced lyrics).
    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) {
      return res.status(404).json({ success: false, message: 'Song not found.' });
    }

    const [karaoke] = await db
      .select()
      .from(songKaraoke)
      .where(eq(songKaraoke.songId, songId))
      .limit(1);

    if (!karaoke || karaoke.status !== 'ready' || !karaoke.syncedLyrics) {
      return res.status(409).json({
        success: false,
        message: 'Karaoke lyrics are not ready yet. Generate the synced lyrics first.',
      });
    }

    // 2. Map karaoke lines → lyric-video segments. The Remotion composition
    //    expects { start, end, text, words?: [{ word, start, end }] }.
    //    Long provider segments (e.g. a whole wizper paragraph) are split into
    //    short readable lines first so the on-screen text doesn't overflow.
    const lines = splitLongSegments(interpolateWordTimings(karaoke.syncedLyrics as any[]), 8);
    const segments = lines
      .map((l: any) => {
        const start = l.start ?? l.startTime ?? 0;
        const end = l.end ?? l.endTime ?? start + 2;
        return {
          start,
          end,
          text: (l.text || '').trim(),
          words: Array.isArray(l.words) ? l.words : undefined,
        };
      })
      .filter((s: any) => s.text.length > 0);

    if (segments.length === 0) {
      return res.status(422).json({ success: false, message: 'No lyric lines available to render.' });
    }

    // 3. Resolve metadata. Body overrides win (the player knows the display name
    //    + can override cover art / theme); otherwise fall back to song data.
    const body = req.body || {};
    const lastEnd = segments[segments.length - 1].end || 0;
    const durationSecs = Math.max(
      parseDurationSeconds(song.duration),
      Math.ceil(lastEnd) + 1,
    );
    const artistName = (body.artistName || '').trim() || song.title || 'Artist';
    const coverArtUrl = (body.coverArt || '').trim() || song.coverArt || '';
    const theme = ['dark', 'light', 'gradient', 'blur'].includes(body.theme) ? body.theme : 'blur';
    const accentColor = /^#[0-9a-fA-F]{6}$/.test(body.accentColor || '') ? body.accentColor : '#7c3aed';

    await ensureLyricsVideoJobsTable();

    // 4. Insert the job (status 'transcribed' so /render can pick it up directly).
    const insert = await pool.query(
      `INSERT INTO lyrics_video_jobs
         (artist_id, song_id, status, segments_json, words_json, duration_secs,
          song_title, artist_name, cover_art_url, audio_url, theme, accent_color)
       VALUES ($1, $2, 'transcribed', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        userId,
        songId,
        JSON.stringify(segments),
        JSON.stringify([]),
        durationSecs,
        song.title,
        artistName,
        coverArtUrl,
        song.audioUrl,
        theme,
        accentColor,
      ],
    );

    const jobId = insert.rows[0]?.id;
    return res.json({ success: true, jobId, durationSecs, segments: segments.length, theme, accentColor });
  } catch (error: any) {
    console.error('❌ [karaoke] create-lyric-video error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
