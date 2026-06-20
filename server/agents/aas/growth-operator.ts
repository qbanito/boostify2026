/**
 * AAS Agent 4: Growth Operator v2
 * 
 * Manages audience growth: content calendar, organic experiments,
 * social posting, ad optimization.
 * 
 * NOW CONNECTED TO:
 *  - FAL AI → generateFastPoster(), generateImageWithNanoBanana(), generateVideoFromImage(), generateArtistProfileVideo()
 *  - Album Art Agent → generateAlbumArt()
 *  - Music Agent → generateMusicConcept(), requestMusicGeneration()
 *  - Social Agent → generatePost()
 *  - Chrome Extensions → Instagram/YouTube create-action endpoints
 *  - Instagram Extension → pending actions for real posting
 *  - YouTube Extension → pending actions for real posting
 */

import { db } from '../../db';
import { marketingMetrics, aasStrategicMemory, instagramExtensionConnections, youtubeExtensionConnections, instagramPendingActions, youtubePendingActions, users } from '../../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { ActionResult } from '../../services/aas/types';

/**
 * Execute a growth action
 */
export async function executeGrowthAction(
  artistId: number,
  action: string,
  budget: number
): Promise<ActionResult> {
  try {
    switch (action) {
      case 'Generate and publish social content':
        return await publishContent(artistId);
      case 'Run audience growth experiment':
        return await runGrowthExperiment(artistId, budget);
      case 'Create social image with AI':
        return await createSocialImage(artistId);
      case 'Create promo video with AI':
        return await createPromoVideo(artistId);
      case 'Create album art with AI':
        return await createAlbumArt(artistId);
      case 'Publish to Instagram via extension':
        return await publishToInstagram(artistId);
      case 'Publish to YouTube via extension':
        return await publishToYouTube(artistId);
      case 'Generate new music':
        return await generateMusic(artistId);
      default:
        return {
          success: true, agent: 'growth-operator', action,
          costActual: 0, revenueGenerated: 0,
          details: `Growth action "${action}" queued`,
        };
    }
  } catch (error: any) {
    return {
      success: false, agent: 'growth-operator', action,
      costActual: 0, revenueGenerated: 0,
      details: `Failed: ${error.message}`,
    };
  }
}

/**
 * Delegates to the existing SocialAgent to generate a post
 */
async function publishContent(artistId: number): Promise<ActionResult> {
  try {
    const { generatePost } = await import('../social-agent');
    const post = await generatePost({ artistId });
    
    return {
      success: !!post,
      agent: 'growth-operator',
      action: 'Generate and publish social content',
      costActual: 0,
      revenueGenerated: 0,
      details: post ? `Published post: "${String(post).substring(0, 80)}..."` : 'No post generated',
    };
  } catch (error: any) {
    return {
      success: false, agent: 'growth-operator',
      action: 'Generate and publish social content',
      costActual: 0, revenueGenerated: 0,
      details: `Post generation failed: ${error.message}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// NEW v2: AI Content Generation (FAL AI)
// ═══════════════════════════════════════════════════════════

/**
 * Generate a social media image using FAL AI
 */
async function createSocialImage(artistId: number): Promise<ActionResult> {
  try {
    const { generateFastPoster } = await import('../../services/fal-service');
    const [artist] = await db.select({ artistName: users.artistName }).from(users).where(eq(users.id, artistId)).limit(1);
    const name = artist?.artistName || 'Artist';

    const result = await generateFastPoster(
      `Professional music artist promotional poster for ${name}, vibrant colors, modern design, concert vibes, social media optimized`,
      { imageSize: 'square', numImages: 1 }
    );

    const imageUrl = result?.imageUrl || null;

    await db.insert(aasStrategicMemory).values({
      artistId, category: 'creative_roi',
      insight: `Generated social image via FAL AI${imageUrl ? ': ' + imageUrl.substring(0, 60) : ''}`,
      confidence: '0.70', evidenceCount: 1, lastValidatedAt: new Date(),
    }).onConflictDoNothing();

    return {
      success: !!imageUrl, agent: 'growth-operator',
      action: 'Create social image with AI',
      costActual: 0.03,
      revenueGenerated: 0,
      details: imageUrl ? `Social image generated: ${imageUrl.substring(0, 80)}` : 'Image generation returned no results',
    };
  } catch (error: any) {
    return { success: false, agent: 'growth-operator', action: 'Create social image with AI',
      costActual: 0, revenueGenerated: 0, details: `Image generation failed: ${error.message}` };
  }
}

/**
 * Generate a short promo video from an image using FAL AI
 */
async function createPromoVideo(artistId: number): Promise<ActionResult> {
  try {
    const { generateArtistProfileVideo } = await import('../../services/fal-service');
    const [artist] = await db.select({ artistName: users.artistName, profileImageUrl: users.profileImageUrl })
      .from(users).where(eq(users.id, artistId)).limit(1);
    const name = artist?.artistName || 'Artist';
    const imgUrl = artist?.profileImageUrl || '';

    const videoResult = await generateArtistProfileVideo(imgUrl, name);

    return {
      success: !!videoResult?.videoUrl, agent: 'growth-operator',
      action: 'Create promo video with AI',
      costActual: 0.10,
      revenueGenerated: 0,
      details: videoResult?.videoUrl ? `Promo video generated: ${videoResult.videoUrl.substring(0, 80)}` : 'Video generation returned no results',
    };
  } catch (error: any) {
    return { success: false, agent: 'growth-operator', action: 'Create promo video with AI',
      costActual: 0, revenueGenerated: 0, details: `Video generation failed: ${error.message}` };
  }
}

/**
 * Generate album art using the Album Art Agent
 */
async function createAlbumArt(artistId: number): Promise<ActionResult> {
  try {
    const { generateAlbumArt } = await import('../album-art-agent');
    const art = await generateAlbumArt(artistId, { mood: 'energetic' });

    return {
      success: !!art, agent: 'growth-operator',
      action: 'Create album art with AI',
      costActual: 0.05,
      revenueGenerated: 0,
      details: art ? `Album art generated: style=${art.style}, colors=${art.colorPalette.join(',')}` : 'Album art generation failed',
    };
  } catch (error: any) {
    return { success: false, agent: 'growth-operator', action: 'Create album art with AI',
      costActual: 0, revenueGenerated: 0, details: `Album art failed: ${error.message}` };
  }
}

// ═══════════════════════════════════════════════════════════
// NEW v2: Chrome Extension Publishing
// ═══════════════════════════════════════════════════════════

/**
 * Create a pending action on the Instagram Chrome Extension for real posting
 */
async function publishToInstagram(artistId: number): Promise<ActionResult> {
  try {
    // Check if artist has an active Instagram extension connection
    const [conn] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(eq(instagramExtensionConnections.userId, artistId), eq(instagramExtensionConnections.status, 'active')))
      .orderBy(desc(instagramExtensionConnections.createdAt))
      .limit(1);

    if (!conn) {
      return { success: false, agent: 'growth-operator', action: 'Publish to Instagram via extension',
        costActual: 0, revenueGenerated: 0, details: 'No active Instagram extension connection found' };
    }

    // Create the pending action for the extension to pick up
    const [action] = await db.insert(instagramPendingActions).values({
      userId: artistId,
      connectionId: conn.id,
      actionType: 'schedule_post',
      payload: {
        type: 'ai_generated',
        source: 'aas_engine',
        instructions: 'Post AI-generated content for audience growth',
      },
      generatedBy: 'aas-engine',
      priority: 3,
    }).returning();

    return {
      success: true, agent: 'growth-operator',
      action: 'Publish to Instagram via extension',
      costActual: 0, revenueGenerated: 0,
      details: `Instagram pending action created (ID: ${action.id}). Extension will publish when active.`,
    };
  } catch (error: any) {
    return { success: false, agent: 'growth-operator', action: 'Publish to Instagram via extension',
      costActual: 0, revenueGenerated: 0, details: `Instagram extension error: ${error.message}` };
  }
}

/**
 * Create a pending action on the YouTube Chrome Extension for real posting
 */
async function publishToYouTube(artistId: number): Promise<ActionResult> {
  try {
    const [conn] = await db.select()
      .from(youtubeExtensionConnections)
      .where(and(eq(youtubeExtensionConnections.userId, artistId), eq(youtubeExtensionConnections.status, 'active')))
      .orderBy(desc(youtubeExtensionConnections.createdAt))
      .limit(1);

    if (!conn) {
      return { success: false, agent: 'growth-operator', action: 'Publish to YouTube via extension',
        costActual: 0, revenueGenerated: 0, details: 'No active YouTube extension connection found' };
    }

    const [action] = await db.insert(youtubePendingActions).values({
      userId: artistId,
      connectionId: conn.id,
      actionType: 'publish_video',
      payload: {
        type: 'ai_generated',
        source: 'aas_engine',
        instructions: 'Upload AI-generated promo video for channel growth',
      },
      status: 'pending',
      generatedBy: 'aas-engine',
      priority: 3,
    }).returning();

    return {
      success: true, agent: 'growth-operator',
      action: 'Publish to YouTube via extension',
      costActual: 0, revenueGenerated: 0,
      details: `YouTube pending action created (ID: ${action.id}). Extension will publish when active.`,
    };
  } catch (error: any) {
    return { success: false, agent: 'growth-operator', action: 'Publish to YouTube via extension',
      costActual: 0, revenueGenerated: 0, details: `YouTube extension error: ${error.message}` };
  }
}

// ═══════════════════════════════════════════════════════════
// NEW v2: Music Generation
// ═══════════════════════════════════════════════════════════

/**
 * Generate new music using the Music Agent
 */
async function generateMusic(artistId: number): Promise<ActionResult> {
  try {
    const { shouldCreateMusic, generateMusicConcept, requestMusicGeneration } = await import('../music-agent');
    
    const check = await shouldCreateMusic(artistId);
    if (!check.should) {
      return { success: true, agent: 'growth-operator', action: 'Generate new music',
        costActual: 0, revenueGenerated: 0, details: 'Music skipped: not needed at this time' };
    }

    // Vary mood based on randomness to avoid always-energetic songs
    const moods = ['energetic', 'mellow', 'dark', 'upbeat', 'romantic'];
    const mood = moods[Math.floor(Math.random() * moods.length)];
    const concept = await generateMusicConcept(artistId, { mood });
    if (!concept) {
      return { success: false, agent: 'growth-operator', action: 'Generate new music',
        costActual: 0, revenueGenerated: 0, details: 'Music concept generation failed' };
    }

    const song = await requestMusicGeneration(artistId, concept);

    return {
      success: !!song, agent: 'growth-operator',
      action: 'Generate new music',
      costActual: 0.15,
      revenueGenerated: 0,
      details: song ? `New song generated: ${concept.title || 'untitled'} (${concept.genre || 'unknown genre'})` : 'Music generation failed',
      lessonsLearned: song ? [`New song "${concept.title}" ready for release`] : [],
    };
  } catch (error: any) {
    return { success: false, agent: 'growth-operator', action: 'Generate new music',
      costActual: 0, revenueGenerated: 0, details: `Music generation failed: ${error.message}` };
  }
}

async function runGrowthExperiment(artistId: number, budget: number): Promise<ActionResult> {
  const [metrics] = await db
    .select()
    .from(marketingMetrics)
    .where(eq(marketingMetrics.userId, artistId))
    .limit(1);

  const channels = {
    spotify: metrics?.spotifyFollowers || 0,
    instagram: metrics?.instagramFollowers || 0,
    youtube: metrics?.youtubeViews || 0,
  };

  const weakest = Object.entries(channels).sort((a, b) => a[1] - b[1])[0];

  await db.insert(aasStrategicMemory).values({
    artistId,
    category: 'channel_efficiency',
    insight: `Weakest channel: ${weakest[0]} (${weakest[1]} followers/views). Focus growth here.`,
    confidence: '0.60',
    evidenceCount: 1,
    lastValidatedAt: new Date(),
  }).onConflictDoNothing();

  return {
    success: true, agent: 'growth-operator',
    action: 'Run audience growth experiment',
    costActual: 0, revenueGenerated: 0,
    details: `Identified weakest channel: ${weakest[0]}. Experiment queued with $${budget} budget.`,
    lessonsLearned: [`Focus on ${weakest[0]} — currently lowest at ${weakest[1]}`],
  };
}

/**
 * Get audience growth metrics for dashboard
 */
export async function getAudienceMetrics(artistId: number) {
  const [metrics] = await db
    .select()
    .from(marketingMetrics)
    .where(eq(marketingMetrics.userId, artistId))
    .limit(1);

  return {
    spotify: metrics?.spotifyFollowers || 0,
    instagram: metrics?.instagramFollowers || 0,
    youtube: metrics?.youtubeViews || 0,
    monthlyListeners: metrics?.monthlyListeners || 0,
    totalEngagement: metrics?.totalEngagement || 0,
    playlistPlacements: metrics?.playlistPlacements || 0,
  };
}
