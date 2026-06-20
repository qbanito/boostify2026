/**
 * BOOSTIFY - Music Video Agent
 * 
 * "Cada canción nueva genera automáticamente un mini music video (15-30s)"
 * 
 * Uses FAL AI's Grok/Wan video generation:
 * 1. Generate a cover image from the song's mood/genre
 * 2. Convert image → 6s video with motion
 * 3. Save as a discover clip + post
 */

import { db } from '../db';
import {
  songs,
  users,
  artistPersonality,
  aiSocialPosts,
  discoverClips,
} from '../../db/schema';
import { eq, desc, sql, isNull, and } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PRIMARY_MODEL } from '../utils/ai-config';

const videoPostLLM = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.9,
  maxTokens: 150,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a mini music video for a song
 */
export async function generateMusicVideoForSong(songId: number): Promise<{
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}> {
  try {
    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, songId));

    if (!song) return { success: false, error: 'Song not found' };

    const [artist] = await db
      .select({ id: users.id, artistName: users.artistName, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(eq(users.id, song.userId));

    const [personality] = await db
      .select()
      .from(artistPersonality)
      .where(eq(artistPersonality.artistId, song.userId));

    const artistName = artist?.artistName || 'Unknown Artist';
    const mood = personality?.currentMood || song.mood || 'hype';
    const genre = song.genre || 'urban';

    // Step 1: Generate a thumbnail/image first
    let imageUrl = '';
    const imagePrompt = `Music video still frame for "${song.title}" by ${artistName}. 
Genre: ${genre}. Mood: ${mood}. 
Cinematic, professional music video frame, dramatic lighting, 
artistic composition. No text or words.`;

    try {
      const { generateImageWithNanoBanana } = await import('../services/fal-service');
      const imgResult = await generateImageWithNanoBanana(imagePrompt, {
        image_size: 'landscape_16_9',
        num_images: 1,
      });
      imageUrl = imgResult?.images?.[0]?.url || '';
    } catch {
      console.log('⚠️ [MusicVideo] Image generation failed, using cover art');
      imageUrl = song.coverArt || '';
    }

    // Step 2: Generate video from image
    let videoUrl = '';
    if (imageUrl) {
      try {
        const { generateVideoFromImage } = await import('../services/fal-service');
        const videoResult = await generateVideoFromImage(imageUrl, {
          prompt: `Music video for ${genre} song, ${mood} mood. Cinematic camera movement, artistic transitions.`,
          duration: 6,
        });
        videoUrl = videoResult?.video?.url || '';
      } catch (videoError) {
        console.log('⚠️ [MusicVideo] Video generation failed, saving as image clip');
      }
    }

    // Step 3: Create a discover clip entry
    const clipTitle = `🎬 ${song.title} - Mini Video`;
    const clipDescription = `Music video de "${song.title}" por ${artistName}`;

    await db.insert(discoverClips).values({
      songId: song.id,
      artistId: song.userId,
      artistName,
      clipTitle,
      clipDescription,
      audioPreviewUrl: song.audioUrl,
      visualEffect: 'visualizer',
      colorTheme: getColorThemeForMood(mood),
      duration: videoUrl ? 15 : 6,
      algorithmScore: 50, // boost new videos
    });

    // Step 4: Create a social post about the video - AI generated
    let videoPostContent: string;
    try {
      const videoPostResponse = await videoPostLLM.invoke([
        new SystemMessage(`You are ${artistName}, an AI music artist. Write authentic social media posts in your unique voice. 1-2 emojis max. No hashtags in text. 1-2 sentences.`),
        new HumanMessage(`Write an excited post announcing you just dropped a new music video for your song "${song.title}" (genre: ${genre}, mood: ${mood}). Be creative and unique, never generic.`),
      ]);
      videoPostContent = (videoPostResponse.content as string).trim().replace(/#\w+/g, '').trim();
    } catch (err) {
      videoPostContent = `New visual for "${song.title}" just dropped. This one came straight from the soul 🎬`;
    }
    await db.insert(aiSocialPosts).values({
      artistId: song.userId,
      content: videoPostContent,
      contentType: 'announcement',
      mood,
      imageUrl: imageUrl || undefined,
      hashtags: ['MusicVideo', 'NewRelease', genre, artistName.replace(/\s+/g, '')],
      likes: Math.floor(Math.random() * 20),
      comments: Math.floor(Math.random() * 5),
    });

    console.log(`🎬 [MusicVideo] Generated video for "${song.title}" by ${artistName}`);
    return { success: true, videoUrl: videoUrl || imageUrl, thumbnailUrl: imageUrl };
  } catch (error) {
    console.error('❌ [MusicVideo] Error generating video:', error);
    return { success: false, error: 'Video generation failed' };
  }
}

function getColorThemeForMood(mood: string): string {
  const themes: Record<string, string> = {
    happy: 'from-yellow-500 to-orange-500',
    sad: 'from-blue-700 to-indigo-900',
    angry: 'from-red-600 to-rose-900',
    romantic: 'from-pink-500 to-rose-500',
    hype: 'from-purple-500 to-pink-500',
    chill: 'from-teal-400 to-cyan-600',
    mysterious: 'from-violet-800 to-purple-900',
    aggressive: 'from-red-800 to-black',
    reflective: 'from-slate-600 to-blue-800',
    confident: 'from-amber-500 to-yellow-600',
  };
  return themes[mood] || themes.hype;
}

/**
 * Auto-generate videos for recent songs without videos
 */
export async function generateVideosForNewSongs(maxSongs: number = 2): Promise<number> {
  try {
    // Find songs that were created recently and don't have a clip yet
    const recentSongs = await db
      .select({ id: songs.id, title: songs.title })
      .from(songs)
      .where(sql`${songs.isPublished} = true`)
      .orderBy(desc(songs.createdAt))
      .limit(20);

    if (recentSongs.length === 0) return 0;

    // Check which already have clips
    const existingClips = await db
      .select({ songId: discoverClips.songId })
      .from(discoverClips)
      .where(sql`${discoverClips.songId} IS NOT NULL`);

    const clippedSongIds = new Set(existingClips.map(c => c.songId).filter(Boolean));
    const songsNeedingVideo = recentSongs.filter(s => !clippedSongIds.has(s.id));

    let generated = 0;
    for (const song of songsNeedingVideo.slice(0, maxSongs)) {
      const result = await generateMusicVideoForSong(song.id);
      if (result.success) generated++;
    }

    return generated;
  } catch (error) {
    console.error('❌ [MusicVideo] Error in batch generation:', error);
    return 0;
  }
}

export async function processMusicVideoTick(): Promise<void> {
  console.log('🎬 [MusicVideo] Processing tick...');
  const generated = await generateVideosForNewSongs(1);
  console.log(`🎬 [MusicVideo] Tick complete: ${generated} new videos`);
}
