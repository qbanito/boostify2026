/**
 * BOOSTIFY - Discover Feed Agent (TikTok-style)
 * 
 * "Feed vertical de clips de 15s con scroll infinito"
 * 
 * This agent:
 * - Creates discover clips from songs and posts
 * - Manages the algorithm for personalized feeds
 * - Tracks user interactions (view, like, skip, replay)
 * - Learns from user behavior
 */

import { db } from '../db';
import {
  discoverClips,
  clipInteractions,
  songs,
  users,
  aiSocialPosts,
  artistPersonality,
  type InsertDiscoverClip,
  type SelectDiscoverClip,
} from '../../db/schema';
import { eq, and, desc, sql, gte, inArray, ne, notInArray } from 'drizzle-orm';

// ============================================
// VISUAL EFFECTS & COLORS
// ============================================

const VISUAL_EFFECTS = ['waveform', 'particles', 'gradient', 'album_art', 'lyrics', 'visualizer'] as const;

const COLOR_THEMES = [
  'from-purple-600 to-pink-600',
  'from-blue-600 to-cyan-500',
  'from-orange-500 to-red-600',
  'from-green-500 to-emerald-600',
  'from-indigo-600 to-violet-500',
  'from-yellow-500 to-orange-500',
  'from-pink-500 to-rose-600',
  'from-teal-500 to-blue-600',
];

const MOODS = ['energetic', 'chill', 'dark', 'happy', 'melancholic', 'aggressive', 'dreamy', 'party'];

// ============================================
// CLIP GENERATION
// ============================================

/**
 * Generate discover clips from existing songs
 */
export async function generateClipsFromSongs(maxClips: number = 5): Promise<number> {
  try {
    console.log('🎬 [Discover] Generating clips from songs...');

    // Get songs that don't have clips yet
    const existingClipSongIds = await db
      .select({ songId: discoverClips.songId })
      .from(discoverClips)
      .where(sql`${discoverClips.songId} IS NOT NULL`);

    const usedSongIds = existingClipSongIds.map(c => c.songId).filter(Boolean) as number[];

    let songsQuery = db
      .select({
        id: songs.id,
        title: songs.title,
        artistId: songs.artistId,
        genre: songs.genre,
        coverUrl: songs.coverUrl,
        audioUrl: songs.audioUrl,
      })
      .from(songs)
      .limit(maxClips * 2);

    const availableSongs = await songsQuery;

    // Filter out already-clipped songs
    const newSongs = usedSongIds.length > 0
      ? availableSongs.filter(s => !usedSongIds.includes(s.id))
      : availableSongs;

    const selected = newSongs.slice(0, maxClips);

    let created = 0;
    for (const song of selected) {
      const effect = VISUAL_EFFECTS[Math.floor(Math.random() * VISUAL_EFFECTS.length)];
      const colorTheme = COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)];
      const mood = MOODS[Math.floor(Math.random() * MOODS.length)];

      await db.insert(discoverClips).values({
        artistId: song.artistId,
        songId: song.id,
        title: song.title,
        description: `🎵 Escucha "${song.title}" - descubre nuevos sonidos`,
        audioUrl: song.audioUrl,
        thumbnailUrl: song.coverUrl,
        clipDuration: 15,
        visualEffect: effect,
        colorTheme,
        genres: song.genre ? [song.genre] : ['urban'],
        mood,
        energy: Math.floor(Math.random() * 60) + 40,
        views: Math.floor(Math.random() * 200) + 50,
        likes: Math.floor(Math.random() * 50) + 10,
        algorithmScore: Math.floor(Math.random() * 50) + 50,
      });
      created++;
    }

    console.log(`🎬 [Discover] Created ${created} clips from songs`);
    return created;
  } catch (error) {
    console.error('❌ [Discover] Error generating clips from songs:', error);
    return 0;
  }
}

/**
 * Generate discover clips from social posts
 */
export async function generateClipsFromPosts(maxClips: number = 3): Promise<number> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentPosts = await db
      .select({
        id: aiSocialPosts.id,
        artistId: aiSocialPosts.artistId,
        content: aiSocialPosts.content,
        contentType: aiSocialPosts.contentType,
        likes: aiSocialPosts.likes,
        aiLikes: aiSocialPosts.aiLikes,
        mediaUrls: aiSocialPosts.mediaUrls,
      })
      .from(aiSocialPosts)
      .where(and(
        gte(aiSocialPosts.createdAt, oneDayAgo),
        eq(aiSocialPosts.status, 'published'),
      ))
      .orderBy(desc(sql`${aiSocialPosts.likes} + ${aiSocialPosts.aiLikes}`))
      .limit(maxClips * 2);

    let created = 0;
    for (const post of recentPosts.slice(0, maxClips)) {
      // Check if clip already exists for this post
      const existing = await db
        .select({ id: discoverClips.id })
        .from(discoverClips)
        .where(eq(discoverClips.postId, post.id))
        .limit(1);

      if (existing.length > 0) continue;

      const effect = VISUAL_EFFECTS[Math.floor(Math.random() * VISUAL_EFFECTS.length)];
      const colorTheme = COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)];

      await db.insert(discoverClips).values({
        artistId: post.artistId,
        postId: post.id,
        title: post.content.substring(0, 60) + (post.content.length > 60 ? '...' : ''),
        description: post.content.substring(0, 140),
        thumbnailUrl: (post.mediaUrls as string[])?.[0] || null,
        clipDuration: 15,
        visualEffect: effect,
        colorTheme,
        views: Math.floor(Math.random() * 100) + 20,
        likes: (post.likes || 0) + (post.aiLikes || 0),
        algorithmScore: Math.min(((post.likes || 0) + (post.aiLikes || 0)) * 3, 100),
      });
      created++;
    }

    return created;
  } catch (error) {
    console.error('❌ [Discover] Error generating clips from posts:', error);
    return 0;
  }
}

// ============================================
// PERSONALIZED FEED ALGORITHM
// ============================================

/**
 * Get personalized discover feed for a user
 */
export async function getDiscoverFeed(userId: number | null, offset: number = 0, limit: number = 10): Promise<Array<{
  clip: SelectDiscoverClip;
  artist: { id: number; username: string | null; artistName: string | null; profileImageUrl: string | null };
}>> {
  try {
    let userPreferences: { likedGenres: string[]; likedArtists: number[] } = { likedGenres: [], likedArtists: [] };

    // Learn from user's interactions
    if (userId) {
      const interactions = await db
        .select({
          clipId: clipInteractions.clipId,
          action: clipInteractions.action,
        })
        .from(clipInteractions)
        .where(eq(clipInteractions.userId, userId))
        .orderBy(desc(clipInteractions.createdAt))
        .limit(50);

      const likedClipIds = interactions
        .filter(i => i.action === 'like' || i.action === 'replay' || i.action === 'save')
        .map(i => i.clipId);
      
      const skippedClipIds = interactions
        .filter(i => i.action === 'skip')
        .map(i => i.clipId);

      if (likedClipIds.length > 0) {
        const likedClips = await db
          .select({ genres: discoverClips.genres, artistId: discoverClips.artistId })
          .from(discoverClips)
          .where(inArray(discoverClips.id, likedClipIds));

        const genreCount = new Map<string, number>();
        for (const clip of likedClips) {
          const genres = clip.genres as string[] || [];
          for (const g of genres) {
            genreCount.set(g, (genreCount.get(g) || 0) + 1);
          }
          userPreferences.likedArtists.push(clip.artistId);
        }
        userPreferences.likedGenres = Array.from(genreCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([g]) => g);
      }
    }

    // Fetch clips with algorithm scoring
    const clips = await db
      .select()
      .from(discoverClips)
      .where(eq(discoverClips.isActive, true))
      .orderBy(desc(discoverClips.algorithmScore), desc(discoverClips.createdAt))
      .offset(offset)
      .limit(limit);

    // Get artist info
    const artistIds = [...new Set(clips.map(c => c.artistId))];
    if (artistIds.length === 0) return [];

    const artistInfo = await db
      .select({ id: users.id, username: users.username, artistName: users.artistName, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(inArray(users.id, artistIds));

    const artistMap = new Map(artistInfo.map(a => [a.id, a]));

    // Score and sort
    const results = clips.map(clip => {
      let personalScore = clip.algorithmScore || 0;

      // Boost if user likes this genre
      const clipGenres = clip.genres as string[] || [];
      for (const g of clipGenres) {
        if (userPreferences.likedGenres.includes(g)) {
          personalScore += 20;
        }
      }
      // Boost if user likes this artist
      if (userPreferences.likedArtists.includes(clip.artistId)) {
        personalScore += 15;
      }

      return {
        clip: { ...clip, algorithmScore: personalScore },
        artist: artistMap.get(clip.artistId) || { id: clip.artistId, username: null, artistName: null, profileImageUrl: null },
      };
    });

    // Sort by personal score
    results.sort((a, b) => (b.clip.algorithmScore || 0) - (a.clip.algorithmScore || 0));

    return results;
  } catch (error) {
    console.error('❌ [Discover] Error getting feed:', error);
    return [];
  }
}

// ============================================
// INTERACTIONS
// ============================================

/**
 * Record a user interaction with a clip
 */
export async function recordClipInteraction(userId: number, clipId: number, action: string, watchDuration?: number): Promise<void> {
  try {
    await db.insert(clipInteractions).values({
      userId,
      clipId,
      action: action as any,
      watchDuration,
    });

    // Update clip stats
    if (action === 'view') {
      await db.update(discoverClips)
        .set({ views: sql`${discoverClips.views} + 1` })
        .where(eq(discoverClips.id, clipId));
    } else if (action === 'like') {
      await db.update(discoverClips)
        .set({ 
          likes: sql`${discoverClips.likes} + 1`,
          algorithmScore: sql`${discoverClips.algorithmScore} + 3`,
        })
        .where(eq(discoverClips.id, clipId));
    } else if (action === 'skip') {
      await db.update(discoverClips)
        .set({ 
          skips: sql`${discoverClips.skips} + 1`,
          algorithmScore: sql`GREATEST(${discoverClips.algorithmScore} - 1, 0)`,
        })
        .where(eq(discoverClips.id, clipId));
    } else if (action === 'share') {
      await db.update(discoverClips)
        .set({ 
          shares: sql`${discoverClips.shares} + 1`,
          algorithmScore: sql`${discoverClips.algorithmScore} + 5`,
        })
        .where(eq(discoverClips.id, clipId));
    }
  } catch (error) {
    console.error('❌ [Discover] Error recording interaction:', error);
  }
}

// ============================================
// TICK - Generate new clips periodically
// ============================================

export async function processDiscoverTick(): Promise<void> {
  console.log('🎬 [Discover] Processing discover tick...');
  
  const songClips = await generateClipsFromSongs(3);
  const postClips = await generateClipsFromPosts(2);
  
  console.log(`🎬 [Discover] Tick complete: ${songClips} song clips, ${postClips} post clips`);
}
