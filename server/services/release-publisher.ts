/**
 * Release Publisher Worker
 *
 * Runs on a periodic interval to auto-publish songs whose releaseDate has arrived,
 * generate a press article per release, and update the launch plan in Firestore.
 */

import { db as pgDb } from '../../db';
import { songs, users, artistNews } from '../../db/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { db as firestore } from '../firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { generateSocialMediaContent } from './social-media-service';
import { triggerSongMonetizationPipeline } from './song-monetization-pipeline';
import { enqueueNewsEvent, publishScheduledArticles } from './news-event-orchestrator';

let tickTimer: ReturnType<typeof setInterval> | null = null;

const INTERVAL_MS = 15 * 60 * 1000; // Every 15 minutes

/**
 * Core tick: find unpublished songs whose releaseDate <= now and publish them.
 */
async function releasePublisherTick() {
  try {
    const now = new Date();

    // Find songs that should be released: releaseDate <= now AND still unpublished
    const dueSongs = await pgDb
      .select({
        id: songs.id,
        userId: songs.userId,
        title: songs.title,
        genre: songs.genre,
        mood: songs.mood,
        releaseDate: songs.releaseDate,
      })
      .from(songs)
      .where(
        and(
          eq(songs.isPublished, false),
          eq(songs.generatedWithAI, true),
          lte(songs.releaseDate, now),
        ),
      );

    if (dueSongs.length === 0) return;

    console.log(`🎵 [Release-Publisher] ${dueSongs.length} song(s) due for release`);

    for (const song of dueSongs) {
      try {
        // 1. Publish the song
        await pgDb
          .update(songs)
          .set({ isPublished: true, updatedAt: new Date() })
          .where(eq(songs.id, song.id));

        console.log(`✅ [Release-Publisher] Published song #${song.id}: "${song.title}"`);

        // 2. Get artist info for press/social
        const artistRows = await pgDb
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            biography: users.biography,
            slug: users.slug,
          })
          .from(users)
          .where(eq(users.id, song.userId))
          .limit(1);

        const artist = artistRows[0];
        if (!artist) continue;

        const artistName = artist.displayName || artist.username || 'Unknown Artist';

        // 3. Generate a full news article via event-driven orchestrator
        try {
          enqueueNewsEvent({
            type: 'song_released',
            artistId: song.userId,
            artistName,
            artistBio: artist.biography || undefined,
            genre: song.genre || undefined,
            songId: song.id,
            songTitle: song.title,
          });
          console.log(`📰 [Release-Publisher] News event queued for "${song.title}"`);
        } catch (newsErr) {
          console.warn(`⚠️ [Release-Publisher] News event queue failed for song ${song.id}:`, newsErr);
        }

        // 4. Update Firestore song document isPublished flag
        try {
          const firestoreSongQuery = await firestore
            .collection('songs')
            .where('songId', '==', song.id)
            .limit(1)
            .get();

          if (!firestoreSongQuery.empty) {
            await firestoreSongQuery.docs[0].ref.update({
              isPublished: true,
              publishedAt: Timestamp.now(),
            });
          }
        } catch (fsErr) {
          console.warn(`⚠️ [Release-Publisher] Firestore song update failed for song ${song.id}:`, fsErr);
        }

        // 5. Update launch plan in artist Firestore doc
        try {
          // Find artist's generated_artists doc by postgresId
          const artistDocs = await firestore
            .collection('generated_artists')
            .where('postgresId', '==', song.userId)
            .limit(1)
            .get();

          if (!artistDocs.empty) {
            const artistDocRef = artistDocs.docs[0].ref;
            const artistData = artistDocs.docs[0].data();
            const launchSongs: Array<{ songId: number; isPublished: boolean; releaseDate: string }> =
              artistData?.launchPlan?.songs || [];

            const updatedSongs = launchSongs.map((s) =>
              s.songId === song.id ? { ...s, isPublished: true } : s,
            );

            const nextUnpublished = updatedSongs.find((s) => !s.isPublished);

            await artistDocRef.update({
              'launchPlan.songs': updatedSongs,
              'launchPlan.nextReleaseAt': nextUnpublished?.releaseDate || null,
              'releaseCalendar.songs': updatedSongs,
              [`releaseCalendar.publishedEvents.song_${song.id}`]: {
                publishedAt: new Date().toISOString(),
                title: song.title,
              },
            });
          }
        } catch (lpErr) {
          console.warn(`⚠️ [Release-Publisher] Launch plan update failed for song ${song.id}:`, lpErr);
        }

        // 6. Trigger monetization pipeline (distribution, tokenization, sync, outreach)
        try {
          const pipelineResult = await triggerSongMonetizationPipeline(song.id);
          console.log(`💰 [Release-Publisher] Monetization pipeline complete for "${song.title}":`,
            Object.entries(pipelineResult.results).map(([k, v]) => `${k}=${v.status}`).join(', '));
        } catch (pipeErr) {
          console.warn(`⚠️ [Release-Publisher] Monetization pipeline failed for song ${song.id}:`, pipeErr);
        }
      } catch (songErr) {
        console.error(`❌ [Release-Publisher] Failed to process song ${song.id}:`, songErr);
      }
    }

    console.log(`🎵 [Release-Publisher] Tick complete — ${dueSongs.length} song(s) processed`);
  } catch (err) {
    console.error('[Release-Publisher] Tick error:', err);
  }
}

/**
 * Start the release publisher scheduler.
 * Called once at server startup from routes.ts.
 */
export function startReleasePublisher() {
  if (tickTimer) return;

  console.log('[Release-Publisher] 🎵 Scheduled release publisher started (every 15 min)');

  // Run first tick after a short delay to let server finish booting
  setTimeout(() => {
    releasePublisherTick();
  }, 20_000);

  // Also publish scheduled news articles every 15 min
  setInterval(async () => {
    try {
      const count = await publishScheduledArticles();
      if (count > 0) console.log(`📰 [Release-Publisher] Published ${count} scheduled news article(s)`);
    } catch (err: any) {
      console.warn('[Release-Publisher] Scheduled news publish error:', err.message);
    }
  }, INTERVAL_MS);

  tickTimer = setInterval(releasePublisherTick, INTERVAL_MS);
}
