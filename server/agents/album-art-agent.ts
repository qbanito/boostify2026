/**
 * BOOSTIFY - Album Art Agent
 * 
 * "Los artistas IA generan artwork único para cada post/single"
 * "El estilo visual evoluciona con el mood del artista"
 * 
 * Uses FAL AI's Nano Banana Pro for image generation.
 * Generates mood-driven album art automatically.
 */

import { db } from '../db';
import {
  dynamicAlbumArt,
  users,
  artistPersonality,
  aiSocialPosts,
  songs,
} from '../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';

// Mood → visual style mapping
const moodStyleMap: Record<string, {
  style: string;
  colorPalette: string[];
  promptModifiers: string;
}> = {
  happy: {
    style: 'neon',
    colorPalette: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'],
    promptModifiers: 'bright colors, vibrant, energetic, golden light, joyful atmosphere',
  },
  sad: {
    style: 'dark',
    colorPalette: ['#1a1a2e', '#16213e', '#0f3460', '#533483'],
    promptModifiers: 'melancholic, blue tones, rain, shadows, emotional depth, moody lighting',
  },
  angry: {
    style: 'abstract',
    colorPalette: ['#FF0000', '#8B0000', '#FF4500', '#2D1B2E'],
    promptModifiers: 'aggressive, red and black, shattered glass, fire, intense, chaotic energy',
  },
  romantic: {
    style: 'portrait',
    colorPalette: ['#FF69B4', '#C71585', '#FF1493', '#FFB6C1'],
    promptModifiers: 'romantic, soft pink, roses, intimate, warm candlelight, dreamy',
  },
  hype: {
    style: 'psychedelic',
    colorPalette: ['#FF00FF', '#00FFFF', '#FFFF00', '#FF6600'],
    promptModifiers: 'explosive, neon lights, party vibes, confetti, bass drop, electric',
  },
  chill: {
    style: 'minimal',
    colorPalette: ['#A8D8EA', '#AA96DA', '#FCBAD3', '#FFFFD2'],
    promptModifiers: 'lo-fi, pastel colors, minimal, sunset, calm ocean, relaxed vibes',
  },
  mysterious: {
    style: 'futuristic',
    colorPalette: ['#0D0628', '#1B0751', '#3B0D8B', '#7209B7'],
    promptModifiers: 'mysterious, dark purple, fog, silhouette, cyberpunk, enigmatic',
  },
  aggressive: {
    style: 'collage',
    colorPalette: ['#1A1A1A', '#FF2D2D', '#FFD700', '#FFFFFF'],
    promptModifiers: 'raw, grunge, distorted, punk aesthetic, torn paper, bold typography',
  },
  reflective: {
    style: 'landscape',
    colorPalette: ['#2C3E50', '#3498DB', '#E74C3C', '#ECF0F1'],
    promptModifiers: 'contemplative, city at night, reflection in water, cinematic, philosophical',
  },
  confident: {
    style: 'retro',
    colorPalette: ['#FFD700', '#000000', '#C0392B', '#FFFFFF'],
    promptModifiers: 'bold, gold chains, luxury, confident pose, retro 80s, powerful',
  },
};

const DEFAULT_MOOD = 'hype';

/**
 * Generate album art for a song or post based on artist mood
 */
export async function generateAlbumArt(
  artistId: number,
  options?: {
    songId?: number;
    postId?: number;
    customPrompt?: string;
    mood?: string;
  }
): Promise<{ imageUrl: string; style: string; colorPalette: string[] } | null> {
  try {
    // Get artist info
    const [artist] = await db
      .select({ id: users.id, artistName: users.artistName, genre: users.genre })
      .from(users)
      .where(eq(users.id, artistId));

    const [personality] = await db
      .select()
      .from(artistPersonality)
      .where(eq(artistPersonality.artistId, artistId));

    if (!artist) return null;

    const artistName = artist.artistName || `Artist_${artistId}`;
    const genre = artist.genre || 'urban';
    const mood = options?.mood || personality?.currentMood || DEFAULT_MOOD;
    const moodStyle = moodStyleMap[mood] || moodStyleMap[DEFAULT_MOOD];

    // Build prompt
    let prompt = options?.customPrompt || '';
    if (!prompt) {
      prompt = `Album cover art for ${artistName}, ${genre} music artist. ${moodStyle.promptModifiers}. 
Style: modern music album cover, professional, high quality, square format.
No text, no letters, no words on the image.`;
    }

    // Try using FAL service
    let imageUrl = '';
    try {
      const { generateImageWithNanoBanana } = await import('../services/fal-service');
      const result = await generateImageWithNanoBanana(prompt, {
        image_size: 'square_hd',
        num_images: 1,
      });
      imageUrl = result?.images?.[0]?.url || '';
    } catch (falError) {
      console.log('⚠️ [AlbumArt] FAL unavailable, using placeholder');
      // Fallback: gradient placeholder based on mood
      const colors = moodStyle.colorPalette;
      imageUrl = `https://placehold.co/500x500/${colors[0].replace('#', '')}/${colors[1].replace('#', '')}?text=${encodeURIComponent(artistName)}`;
    }

    if (!imageUrl) return null;

    // Save to DB
    await db.insert(dynamicAlbumArt).values({
      artistId,
      songId: options?.songId || null,
      postId: options?.postId || null,
      imageUrl,
      prompt,
      style: moodStyle.style as any,
      mood,
      colorPalette: moodStyle.colorPalette,
    });

    console.log(`🎨 [AlbumArt] Generated ${moodStyle.style} art for ${artistName} (mood: ${mood})`);
    return { imageUrl, style: moodStyle.style, colorPalette: moodStyle.colorPalette };
  } catch (error) {
    console.error('❌ [AlbumArt] Error generating:', error);
    return null;
  }
}

/**
 * Generate album art for recent posts that don't have images
 */
export async function generateArtForRecentPosts(maxPosts: number = 3): Promise<number> {
  try {
    // Find recent posts without images
    const postsWithoutArt = await db
      .select({ id: aiSocialPosts.id, artistId: aiSocialPosts.artistId })
      .from(aiSocialPosts)
      .where(sql`${aiSocialPosts.imageUrl} IS NULL`)
      .orderBy(desc(aiSocialPosts.createdAt))
      .limit(maxPosts);

    let generated = 0;
    for (const post of postsWithoutArt) {
      const result = await generateAlbumArt(post.artistId, { postId: post.id });
      if (result) {
        // Update the post with the generated image
        await db.update(aiSocialPosts)
          .set({ imageUrl: result.imageUrl })
          .where(eq(aiSocialPosts.id, post.id));
        generated++;
      }
    }

    return generated;
  } catch (error) {
    console.error('❌ [AlbumArt] Error batch generating:', error);
    return 0;
  }
}

/**
 * Get mood-style info for an artist (for frontend display)
 */
export function getMoodStyle(mood: string): {
  style: string;
  colorPalette: string[];
  promptModifiers: string;
} {
  return moodStyleMap[mood] || moodStyleMap[DEFAULT_MOOD];
}

/**
 * Get recent album art for an artist
 */
export async function getArtistAlbumArt(artistId: number, limit: number = 10): Promise<any[]> {
  try {
    return await db
      .select()
      .from(dynamicAlbumArt)
      .where(eq(dynamicAlbumArt.artistId, artistId))
      .orderBy(desc(dynamicAlbumArt.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function processAlbumArtTick(): Promise<void> {
  console.log('🎨 [AlbumArt] Processing album art tick...');
  const generated = await generateArtForRecentPosts(2);
  console.log(`🎨 [AlbumArt] Generated ${generated} new artworks`);
}
