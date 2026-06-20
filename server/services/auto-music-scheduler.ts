/**
 * Music Auto-Pilot Scheduler
 *
 * Turns music generation from PASSIVE into ACTIVE: artists configure a
 * cadence (weekly single, monthly album, etc.) and the platform keeps
 * generating new music automatically, using their EXISTING songs as
 * creative references (genre, mood, themes, lyrical style).
 *
 * Pipeline per run:
 *   1. Load reference songs (artist-selected or latest published)
 *   2. Build a style profile from metadata + analysis insights + lyrics
 *   3. GPT generates N song concepts (title, genre, mood, language, lyrics)
 *      that evolve the artist's existing sound
 *   4. Each concept is rendered with the Smart Music Router (Lyria3 → MiniMax → Stable Audio)
 *   5. Songs are saved to the artist profile (+ cover art, analysis, monetization)
 *   6. EP/Album runs also create a `releases` package with tracklist
 */

import { db } from '../../db';
import {
  songs,
  users,
  releases,
  releaseTracks,
  musicAutoSchedules,
  musicAutoRuns,
} from '../../db/schema';
import { eq, and, desc, lte, inArray } from 'drizzle-orm';
import { generateOriginalSong } from './smart-music-router';
import { triggerSongAnalysis } from './song-analysis-pipeline';
import { triggerSongMonetizationPipeline } from './song-monetization-pipeline';
import { generateSongCover } from './song-cover-generator';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
});

const INTERVAL_MS = 10 * 60 * 1000; // tick every 10 minutes
const MAX_SONGS_PER_RUN = 10;

let tickTimer: ReturnType<typeof setInterval> | null = null;
/** Guards against double-running the same schedule concurrently */
const runningSchedules = new Set<number>();

// ── Cadence helpers ────────────────────────────────────────────────────────────

export type AutoCadence = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export function computeNextRun(cadence: AutoCadence, from: Date = new Date()): Date {
  const next = new Date(from);
  switch (cadence) {
    case 'daily': next.setDate(next.getDate() + 1); break;
    case 'weekly': next.setDate(next.getDate() + 7); break;
    case 'biweekly': next.setDate(next.getDate() + 14); break;
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
  }
  return next;
}

export function defaultSongsForType(releaseType: string): number {
  if (releaseType === 'album') return 8;
  if (releaseType === 'ep') return 4;
  return 1;
}

// ── Style profile from existing songs ─────────────────────────────────────────

interface ReferenceSongRow {
  id: number;
  title: string;
  genre: string | null;
  mood: string | null;
  lyrics: string | null;
  analysisJson: unknown;
}

interface StyleProfile {
  referenceSongIds: number[];
  references: Array<{
    title: string;
    genre?: string;
    mood?: string;
    themes?: string[];
    summary?: string;
    lyricsExcerpt?: string;
  }>;
}

function buildStyleProfile(refSongs: ReferenceSongRow[]): StyleProfile {
  return {
    referenceSongIds: refSongs.map(s => s.id),
    references: refSongs.map(s => {
      const insights: any = (s.analysisJson as any)?.insights || {};
      return {
        title: s.title,
        genre: s.genre || undefined,
        mood: s.mood || undefined,
        themes: Array.isArray(insights.themes) ? insights.themes.slice(0, 6) : undefined,
        summary: typeof insights.summary === 'string' ? insights.summary.slice(0, 300) : undefined,
        lyricsExcerpt: s.lyrics ? s.lyrics.slice(0, 400) : undefined,
      };
    }),
  };
}

// ── Concept generation (GPT) ───────────────────────────────────────────────────

export interface SongConcept {
  title: string;
  genre: string;
  mood: string;
  language: string;
  lyrics: string;
  description?: string;
}

interface ConceptSet {
  collectionTitle: string;
  songs: SongConcept[];
}

async function generateSongConcepts(
  profile: StyleProfile,
  count: number,
  releaseType: string,
  artistName: string,
  styleNotes?: string | null,
): Promise<ConceptSet> {
  const prompt = `You are an elite A&R + songwriter team for the artist "${artistName}".
Below are the artist's EXISTING songs (their established sound). Create ${count} BRAND-NEW song concept(s) for a new ${releaseType} that clearly belong to the same artistic universe — same sonic identity, vocal language and lyrical DNA — but are FRESH evolutions, never copies. Avoid reusing existing titles, hooks or full lines.

EXISTING SONGS (style references):
${JSON.stringify(profile.references, null, 1)}

${styleNotes ? `EXTRA CREATIVE DIRECTION FROM THE ARTIST: ${styleNotes}\n` : ''}
Rules:
- Keep the dominant genre/mood family of the references (allow tasteful evolution).
- Write lyrics in the SAME language as the reference lyrics.
- Full lyrics per song: verse 1, chorus, verse 2, chorus, bridge, final chorus. Radio-quality, memorable hook, no clichés.
- ${releaseType !== 'single' ? `Also invent a cohesive ${releaseType} title ("collectionTitle") that ties the tracks together conceptually.` : 'collectionTitle can equal the song title.'}

Respond ONLY with JSON:
{"collectionTitle": "...", "songs": [{"title": "...", "genre": "...", "mood": "...", "language": "Spanish|English|...", "lyrics": "...", "description": "1-line pitch"}]}`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8192,
    temperature: 0.85,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const list: SongConcept[] = Array.isArray(parsed.songs) ? parsed.songs : [];
  if (list.length === 0) throw new Error('Concept generation returned no songs');

  return {
    collectionTitle: parsed.collectionTitle || list[0].title || 'New Release',
    songs: list.slice(0, count).map(c => ({
      title: String(c.title || 'Untitled').slice(0, 120),
      genre: String(c.genre || 'Pop'),
      mood: String(c.mood || 'energetic'),
      language: String(c.language || 'English'),
      lyrics: String(c.lyrics || ''),
      description: c.description ? String(c.description).slice(0, 300) : undefined,
    })),
  };
}

// ── Run executor ───────────────────────────────────────────────────────────────

export async function runAutoMusicJob(scheduleId: number): Promise<void> {
  if (runningSchedules.has(scheduleId)) {
    console.log(`⏭️ [Auto-Music] Schedule #${scheduleId} already running — skipped`);
    return;
  }
  runningSchedules.add(scheduleId);

  let runId: number | null = null;
  try {
    const [schedule] = await db
      .select()
      .from(musicAutoSchedules)
      .where(eq(musicAutoSchedules.id, scheduleId))
      .limit(1);
    if (!schedule) throw new Error(`Schedule #${scheduleId} not found`);

    const [artist] = await db
      .select({ id: users.id, artistName: users.artistName, displayName: users.displayName, username: users.username })
      .from(users)
      .where(eq(users.id, schedule.userId))
      .limit(1);
    const artistName = artist?.artistName || artist?.displayName || artist?.username || 'the artist';

    // 1. Load reference songs
    let refSongs: ReferenceSongRow[] = [];
    const refCols = {
      id: songs.id, title: songs.title, genre: songs.genre,
      mood: songs.mood, lyrics: songs.lyrics, analysisJson: songs.analysisJson,
    };
    if (schedule.referenceSongIds && schedule.referenceSongIds.length > 0) {
      refSongs = await db.select(refCols).from(songs).where(
        and(eq(songs.userId, schedule.userId), inArray(songs.id, schedule.referenceSongIds)),
      );
    }
    if (refSongs.length === 0) {
      refSongs = await db.select(refCols).from(songs)
        .where(and(eq(songs.userId, schedule.userId), eq(songs.isPublished, true)))
        .orderBy(desc(songs.createdAt))
        .limit(5);
    }
    if (refSongs.length === 0) {
      throw new Error('No existing songs to use as references — upload or generate at least one song first');
    }

    const count = Math.max(1, Math.min(MAX_SONGS_PER_RUN, schedule.songsPerRun || defaultSongsForType(schedule.releaseType)));

    console.log(`🤖 [Auto-Music] Run start — schedule #${scheduleId} ${schedule.releaseType} x${count} for "${artistName}" (${refSongs.length} refs)`);

    await db.update(musicAutoSchedules)
      .set({ lastRunStatus: 'running', lastError: null, updatedAt: new Date() })
      .where(eq(musicAutoSchedules.id, scheduleId));

    // 2-3. Style profile + concepts
    const profile = buildStyleProfile(refSongs);
    const concepts = await generateSongConcepts(profile, count, schedule.releaseType, artistName, schedule.styleNotes);

    const [run] = await db.insert(musicAutoRuns).values({
      scheduleId,
      userId: schedule.userId,
      status: 'running',
      releaseType: schedule.releaseType,
      conceptJson: { profile, concepts } as any,
    }).returning();
    runId = run.id;

    // 4-5. Render each concept and save to profile
    const createdSongIds: number[] = [];
    const errors: string[] = [];

    for (const concept of concepts.songs) {
      try {
        const result = await generateOriginalSong({
          title: concept.title,
          genre: concept.genre,
          mood: concept.mood,
          language: concept.language,
          isInstrumental: false,
          customLyrics: concept.lyrics || undefined,
        });
        if (!result.success || !result.audioUrl) {
          throw new Error(result.error || 'Generation failed');
        }

        // Optional cover art (non-fatal)
        let coverArt: string | null = null;
        if (schedule.generateCover) {
          try {
            const cover = await generateSongCover({
              songTitle: concept.title,
              artistName,
              genre: concept.genre,
              mood: concept.mood,
              description: concept.description || null,
              artistId: schedule.userId,
            });
            coverArt = cover?.url || null;
          } catch (coverErr: any) {
            console.warn(`⚠️ [Auto-Music] Cover art failed for "${concept.title}":`, coverErr?.message);
          }
        }

        const [newSong] = await db.insert(songs).values({
          userId: schedule.userId,
          title: concept.title,
          description: concept.description || `Auto-generated ${schedule.releaseType} track inspired by ${artistName}'s catalog`,
          audioUrl: result.audioUrl,
          genre: concept.genre,
          mood: concept.mood,
          lyrics: result.lyrics || concept.lyrics || null,
          coverArt,
          generatedWithAI: true,
          aiProvider: `auto-pilot/${result.modelUsed}`,
          releaseDate: new Date(),
          isPublished: schedule.autoPublish,
          plays: 0,
          analysisStatus: 'pending',
        }).returning();

        createdSongIds.push(newSong.id);
        console.log(`✅ [Auto-Music] Song #${newSong.id} "${newSong.title}" (${result.modelUsed})`);

        triggerSongAnalysis(newSong.id);
        if (schedule.autoPublish) {
          triggerSongMonetizationPipeline(newSong.id).catch((err: any) =>
            console.warn(`⚠️ [Auto-Music] Monetization pipeline error for #${newSong.id}:`, err?.message),
          );
        }
      } catch (songErr: any) {
        console.error(`❌ [Auto-Music] Failed concept "${concept.title}":`, songErr?.message);
        errors.push(`${concept.title}: ${songErr?.message}`);
      }
    }

    if (createdSongIds.length === 0) {
      throw new Error(`All ${concepts.songs.length} generations failed: ${errors.join(' | ')}`);
    }

    // 6. Package EP/Album as a release
    let releaseId: number | null = null;
    if (schedule.releaseType !== 'single' && createdSongIds.length > 1) {
      try {
        const [release] = await db.insert(releases).values({
          userId: schedule.userId,
          title: concepts.collectionTitle,
          type: schedule.releaseType as 'ep' | 'album',
          genre: concepts.songs[0]?.genre || null,
          releaseDate: new Date(),
          description: `Auto-Pilot ${schedule.releaseType} generated from ${artistName}'s catalog references`,
          status: 'draft',
        }).returning();
        releaseId = release.id;

        const createdRows = await db.select({ id: songs.id, title: songs.title })
          .from(songs).where(inArray(songs.id, createdSongIds));
        const titleById = new Map(createdRows.map(r => [r.id, r.title]));

        await db.insert(releaseTracks).values(
          createdSongIds.map((songId, i) => ({
            releaseId: release.id,
            songId,
            trackNumber: i + 1,
            title: titleById.get(songId) || `Track ${i + 1}`,
            artists: [{ name: artistName, role: 'primary' }],
          })),
        );
        console.log(`💿 [Auto-Music] Release #${release.id} "${concepts.collectionTitle}" (${createdSongIds.length} tracks)`);
      } catch (relErr: any) {
        console.warn('⚠️ [Auto-Music] Release packaging failed:', relErr?.message);
      }
    }

    const status = errors.length > 0 ? 'partial' : 'completed';
    const now = new Date();

    await db.update(musicAutoRuns).set({
      status,
      songIds: createdSongIds,
      releaseId,
      error: errors.length > 0 ? errors.join(' | ').slice(0, 2000) : null,
      finishedAt: now,
    }).where(eq(musicAutoRuns.id, runId));

    await db.update(musicAutoSchedules).set({
      lastRunAt: now,
      nextRunAt: computeNextRun(schedule.cadence as AutoCadence, now),
      lastRunStatus: status,
      lastError: errors.length > 0 ? errors.join(' | ').slice(0, 2000) : null,
      updatedAt: now,
    }).where(eq(musicAutoSchedules.id, scheduleId));

    console.log(`🤖 [Auto-Music] Run ${status} — schedule #${scheduleId}: ${createdSongIds.length}/${concepts.songs.length} songs`);
  } catch (err: any) {
    console.error(`❌ [Auto-Music] Run failed for schedule #${scheduleId}:`, err?.message);
    const now = new Date();
    try {
      if (runId) {
        await db.update(musicAutoRuns)
          .set({ status: 'failed', error: String(err?.message || err).slice(0, 2000), finishedAt: now })
          .where(eq(musicAutoRuns.id, runId));
      }
      // Re-read cadence to push nextRunAt forward so a broken schedule doesn't loop every tick
      const [sched] = await db.select({ cadence: musicAutoSchedules.cadence })
        .from(musicAutoSchedules).where(eq(musicAutoSchedules.id, scheduleId)).limit(1);
      await db.update(musicAutoSchedules).set({
        lastRunAt: now,
        nextRunAt: computeNextRun((sched?.cadence as AutoCadence) || 'weekly', now),
        lastRunStatus: 'failed',
        lastError: String(err?.message || err).slice(0, 2000),
        updatedAt: now,
      }).where(eq(musicAutoSchedules.id, scheduleId));
    } catch (updateErr: any) {
      console.error('[Auto-Music] Failed to record run failure:', updateErr?.message);
    }
  } finally {
    runningSchedules.delete(scheduleId);
  }
}

// ── Scheduler loop ─────────────────────────────────────────────────────────────

async function autoMusicTick() {
  try {
    const now = new Date();
    const due = await db
      .select({ id: musicAutoSchedules.id })
      .from(musicAutoSchedules)
      .where(and(eq(musicAutoSchedules.enabled, true), lte(musicAutoSchedules.nextRunAt, now)))
      .limit(10);

    if (due.length === 0) return;
    console.log(`🤖 [Auto-Music] ${due.length} schedule(s) due`);

    // Sequential to keep generation load predictable
    for (const { id } of due) {
      await runAutoMusicJob(id);
    }
  } catch (err: any) {
    console.error('[Auto-Music] Tick error:', err?.message);
  }
}

/**
 * Start the auto-music scheduler. Called once at server startup from routes.ts.
 */
export function startAutoMusicScheduler() {
  if (tickTimer) return;
  console.log('[Auto-Music] 🤖 Music Auto-Pilot scheduler started (every 10 min)');
  setTimeout(() => { autoMusicTick(); }, 30_000); // first tick after boot settles
  tickTimer = setInterval(autoMusicTick, INTERVAL_MS);
}
