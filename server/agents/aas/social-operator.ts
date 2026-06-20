/**
 * AAS Agent: Social Operator
 * 
 * Handles all interactions with the Boostify internal social network:
 * - Generate and publish posts as the artist
 * - Like and comment on other artists' posts
 * - Build social presence autonomously
 * 
 * CONNECTED TO:
 * - Social Agent (generatePost, generateComment, processLike)
 * - Postgres Social Network Service (createPost, getPostsWithDetails)
 * - AI Social Posts table (aiSocialPosts)
 */

import { db } from '../../db';
import { users, aiSocialPosts, aiPostComments } from '../../../db/schema';
import { eq, desc, ne, sql } from 'drizzle-orm';
import type { ActionResult } from '../../services/aas/types';
import { generatePost, generateComment, processLike, shouldLikePost } from '../social-agent';
import { postgresSocialNetworkService } from '../../services/postgres-social-network';

/**
 * Execute a social network action
 */
export async function executeSocialAction(
  artistId: number,
  action: string,
  budget: number = 0,
): Promise<ActionResult> {
  try {
    switch (action) {
      case 'Post on Boostify social network':
        return await createSocialPost(artistId);
      case 'Engage with posts on social network':
        return await engageWithPosts(artistId);
      case 'Comment on trending posts':
        return await commentOnTrending(artistId);
      case 'Promote token sales on social network':
        return await promoteOnSocial(artistId, 'token');
      case 'Promote new release on social network':
        return await promoteOnSocial(artistId, 'release');
      case 'Share radio milestone on social':
        return await promoteOnSocial(artistId, 'radio');
      default:
        return await createSocialPost(artistId);
    }
  } catch (error: any) {
    return {
      success: false,
      agent: 'social-operator',
      action,
      costActual: 0,
      revenueGenerated: 0,
      details: `Social action failed: ${error.message}`,
    };
  }
}

// ── Create a social network post ──────────────────────────
async function createSocialPost(artistId: number): Promise<ActionResult> {
  const post = await generatePost({
    artistId,
    forcePost: true,
  });

  if (!post) {
    return {
      success: false,
      agent: 'social-operator',
      action: 'Post on Boostify social network',
      costActual: 0,
      revenueGenerated: 0,
      details: 'Failed to generate social post',
    };
  }

  return {
    success: true,
    agent: 'social-operator',
    action: 'Post on Boostify social network',
    costActual: 0.001, // GPT-4o-mini cost
    revenueGenerated: 0,
    details: `Published social post: "${(post.content || '').substring(0, 80)}..."`,
    lessonsLearned: ['Social post published successfully on Boostify network'],
  };
}

// ── Engage with other artists' posts (like + comment) ─────
async function engageWithPosts(artistId: number): Promise<ActionResult> {
  // Get recent posts from other artists
  const recentPosts = await db.select({
    id: aiSocialPosts.id,
    artistId: aiSocialPosts.artistId,
  })
    .from(aiSocialPosts)
    .where(ne(aiSocialPosts.artistId, artistId))
    .orderBy(desc(aiSocialPosts.createdAt))
    .limit(10);

  let liked = 0;
  let commented = 0;

  for (const post of recentPosts.slice(0, 5)) {
    // Try to like
    const shouldLike = await shouldLikePost(artistId, post.id, post.artistId);
    if (shouldLike) {
      const didLike = await processLike(artistId, post.id);
      if (didLike) liked++;
    }

    // Try to comment (limit to 2)
    if (commented < 2) {
      const comment = await generateComment(artistId, post.id, post.artistId);
      if (comment) commented++;
    }
  }

  return {
    success: liked > 0 || commented > 0,
    agent: 'social-operator',
    action: 'Engage with posts on social network',
    costActual: commented * 0.001,
    revenueGenerated: 0,
    details: `Engaged: ${liked} likes, ${commented} comments on Boostify social`,
    lessonsLearned: liked + commented > 3
      ? ['High engagement day — community building active']
      : undefined,
  };
}

// ── Comment on trending / popular posts ───────────────────
async function commentOnTrending(artistId: number): Promise<ActionResult> {
  const trendingPosts = await db.select({
    id: aiSocialPosts.id,
    artistId: aiSocialPosts.artistId,
    likes: aiSocialPosts.likes,
  })
    .from(aiSocialPosts)
    .where(ne(aiSocialPosts.artistId, artistId))
    .orderBy(desc(aiSocialPosts.likes))
    .limit(5);

  let commented = 0;
  for (const post of trendingPosts) {
    if (commented >= 3) break;
    const comment = await generateComment(artistId, post.id, post.artistId);
    if (comment) commented++;
  }

  return {
    success: commented > 0,
    agent: 'social-operator',
    action: 'Comment on trending posts',
    costActual: commented * 0.001,
    revenueGenerated: 0,
    details: `Commented on ${commented} trending posts`,
  };
}

// ── Promote something on the social network ───────────────
async function promoteOnSocial(
  artistId: number,
  type: 'token' | 'release' | 'radio',
): Promise<ActionResult> {
  const contextMap = {
    token: 'My music is now on the blockchain! Fans can own a piece of my art through BTF-2300 tokens on Polygon.',
    release: 'New music just dropped! Listen now and let me know what you think.',
    radio: 'My music is getting radio airplay! Thank you for all the support.',
  };

  const post = await generatePost({
    artistId,
    context: contextMap[type],
    forcePost: true,
  });

  return {
    success: !!post,
    agent: 'social-operator',
    action: `Promote ${type} on social network`,
    costActual: 0.001,
    revenueGenerated: 0,
    details: post
      ? `Promoted ${type} on social: "${(post.content || '').substring(0, 60)}..."`
      : `Failed to create ${type} promotion post`,
  };
}
