/**
 * TV Interaction Agent - AI artists and audience watch & comment on Boostify TV videos
 * 
 * This agent creates realistic, personality-driven interactions on TV videos by:
 * 1. Fetching recent videos from the TV feed (artist uploads, YouTube, AI clips)
 * 2. Selecting AI artists who would naturally engage with each video (genre match, personality)
 * 3. Using the artist's profile context (personality, mood, genre, vision) to generate authentic comments
 * 4. Also generating audience agent reactions for broader engagement
 * 
 * Synced with artist profile data for contextual, realistic interactions.
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { db } from "../../db";
import { 
  users, 
  artistPersonality, 
  tvVideoComments, 
  audienceAgents 
} from "../../db/schema";
import { eq, desc, sql, and, isNotNull, ne, count } from "drizzle-orm";
import { getPersonality } from './personality-agent';
import { PRIMARY_MODEL } from '../utils/ai-config';

// LLM for generating video comments
const commentLLM = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.85,
  maxTokens: 200,
});

// ============================================
// TYPES
// ============================================

interface TVVideo {
  id: string;
  title: string;
  description: string;
  artistId?: number | string;
  artistName?: string;
  artistSlug?: string;
  genres?: string[];
  category?: string;
  isYouTube?: boolean;
}

interface AIArtist {
  id: number;
  artistName: string | null;
  slug: string | null;
  profileImageUrl: string | null;
  genres: string[] | null;
  biography: string | null;
}

// ============================================
// CORE: Generate AI Artist Comment on a Video
// ============================================

/**
 * Generate a comment from an AI artist on a TV video,
 * personalized by the artist's profile/personality and the video context.
 */
export async function generateArtistVideoComment(
  artistId: number,
  video: TVVideo
): Promise<{ content: string; sentiment: string; reactionType: string } | null> {
  try {
    // Get the artist's personality
    const personality = await getPersonality(artistId);
    if (!personality) return null;

    // Get the artist's profile info
    const [artist] = await db
      .select({
        id: users.id,
        artistName: users.artistName,
        genres: users.genres,
        biography: users.biography,
        slug: users.slug,
      })
      .from(users)
      .where(eq(users.id, artistId));

    if (!artist?.artistName) return null;

    // Determine the relationship context
    const isOwnVideo = String(video.artistId) === String(artistId);
    const genreMatch = checkGenreMatch(artist.genres || [], video.genres || []);

    // Pick a random comment style based on personality
    const commentStyles = getCommentStylesForPersonality(personality, isOwnVideo, genreMatch);
    const style = commentStyles[Math.floor(Math.random() * commentStyles.length)];

    const systemPrompt = buildArtistCommentSystemPrompt(artist, personality, video, style, isOwnVideo, genreMatch);
    const userPrompt = buildArtistCommentUserPrompt(video, style);

    const response = await commentLLM.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const content = (response.content as string).trim();
    if (!content || content.length < 3) return null;

    // Determine sentiment based on personality and style
    const sentiment = determineSentiment(personality, style, genreMatch, isOwnVideo);
    const reactionType = determineReactionType(style, isOwnVideo);

    return { content, sentiment, reactionType };

  } catch (error) {
    console.error(`[TV-INTERACTION] Error generating artist comment for artist ${artistId}:`, error);
    return null;
  }
}

/**
 * Generate an audience agent comment on a TV video
 */
export async function generateAudienceVideoComment(
  agentId: number,
  video: TVVideo
): Promise<{ content: string; sentiment: string } | null> {
  try {
    const [agent] = await db
      .select()
      .from(audienceAgents)
      .where(eq(audienceAgents.id, agentId));

    if (!agent) return null;

    const personalityDesc = getAudiencePersonalityDescription(agent.personalityType);
    const genreMatch = agent.preferredGenres 
      ? checkGenreMatch(agent.preferredGenres as string[], video.genres || [])
      : false;
    const genreHate = agent.hatedGenres
      ? checkGenreMatch(agent.hatedGenres as string[], video.genres || [])
      : false;

    const prompt = `You are ${agent.name} (@${agent.username}), a ${agent.age || 25}-year-old music fan from ${agent.location || 'the internet'}.
Bio: ${agent.bio || 'Music lover'}
Personality: ${personalityDesc}
Communication: ${agent.communicationStyle || 'casual'}
${agent.usesEmojis ? 'You love using emojis.' : 'You rarely use emojis.'}
${agent.language === 'es' ? 'You write in Spanish.' : agent.language === 'mixed' ? 'You mix English and Spanish (Spanglish).' : 'You write in English.'}
${genreMatch ? '🔥 This video matches genres you LOVE!' : ''}
${genreHate ? '😤 This video is a genre you typically HATE.' : ''}

You're watching a video on Boostify TV:
Title: "${video.title}"
${video.description ? `Description: "${video.description.substring(0, 200)}"` : ''}
${video.artistName ? `By artist: ${video.artistName}` : ''}

Write a SHORT authentic comment (1-2 sentences max) reacting to this video as a viewer.
Be natural - like a real YouTube/TikTok comment. Match your personality type.
${agent.personalityType === 'troll' ? 'Be provocative but not hateful.' : ''}
${agent.personalityType === 'superfan' ? 'Show genuine excitement!' : ''}
${agent.personalityType === 'music_critic' ? 'Give a brief analytical take.' : ''}`;

    const response = await commentLLM.invoke([new HumanMessage(prompt)]);
    const content = (response.content as string).trim();
    if (!content || content.length < 3) return null;

    const sentiment = agent.personalityType === 'hater' || agent.personalityType === 'troll'
      ? 'critical'
      : agent.personalityType === 'superfan' || agent.personalityType === 'teenage_fan'
        ? 'excited'
        : agent.personalityType === 'music_critic'
          ? 'neutral'
          : 'positive';

    return { content, sentiment };
  } catch (error) {
    console.error(`[TV-INTERACTION] Error generating audience comment:`, error);
    return null;
  }
}

// ============================================
// MAIN TICK: Process TV Interactions
// ============================================

/**
 * Main tick function called by the orchestrator.
 * Fetches recent TV videos and generates AI interactions on them.
 */
export async function processTVInteractionTick(): Promise<void> {
  console.log('📺 [TV-INTERACTION] Processing TV interaction tick...');

  try {
    // 1. Get recent videos that need interactions
    const videos = await getRecentTVVideos();
    if (videos.length === 0) {
      console.log('📺 [TV-INTERACTION] No videos found for interactions');
      return;
    }

    // 2. Get all AI artists with personalities
    const aiArtists = await db
      .select({
        id: users.id,
        artistName: users.artistName,
        slug: users.slug,
        profileImageUrl: users.profileImageUrl,
        genres: users.genres,
        biography: users.biography,
      })
      .from(users)
      .innerJoin(artistPersonality, eq(artistPersonality.artistId, users.id))
      .where(isNotNull(users.artistName));

    console.log(`📺 [TV-INTERACTION] Found ${videos.length} videos and ${aiArtists.length} AI artists`);

    // 3. For each video, pick 1-3 artists to comment (probabilistic)
    let totalComments = 0;

    for (const video of videos.slice(0, 5)) { // Process max 5 videos per tick
      // Check existing comment count for this video
      const [existingCount] = await db
        .select({ count: count() })
        .from(tvVideoComments)
        .where(eq(tvVideoComments.videoId, video.id));

      const currentComments = existingCount?.count || 0;
      if (currentComments >= 15) continue; // Cap at 15 comments per video

      // Select artists who would interact (genre-based + random)
      const candidates = selectArtistCandidates(aiArtists, video, 3);
      
      for (const artist of candidates) {
        // Check if this artist already commented on this video
        const [alreadyCommented] = await db
          .select({ count: count() })
          .from(tvVideoComments)
          .where(
            and(
              eq(tvVideoComments.videoId, video.id),
              eq(tvVideoComments.artistId, artist.id)
            )
          );

        if ((alreadyCommented?.count || 0) > 0) continue;

        const result = await generateArtistVideoComment(artist.id, video);
        if (result) {
          await db.insert(tvVideoComments).values({
            videoId: video.id,
            videoTitle: video.title,
            authorType: 'ai_artist',
            artistId: artist.id,
            content: result.content,
            reactionType: result.reactionType as any,
            sentiment: result.sentiment as any,
            videoArtistId: typeof video.artistId === 'number' ? video.artistId : null,
            generationContext: `Artist ${artist.artistName} commenting on "${video.title}" by ${video.artistName || 'unknown'}`,
          });
          totalComments++;
          console.log(`📺 [TV-INTERACTION] ${artist.artistName} commented on "${video.title}"`);
        }
      }

      // Also add 1-2 audience comments (50% chance)
      if (Math.random() > 0.5) {
        const audienceCount = Math.floor(Math.random() * 2) + 1;
        await generateAudienceCommentsForVideo(video, audienceCount);
        totalComments += audienceCount;
      }
    }

    console.log(`📺 [TV-INTERACTION] Tick complete: ${totalComments} new comments generated`);

  } catch (error) {
    console.error('📺 [TV-INTERACTION] Error in tick:', error);
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Get recent TV videos (from Firestore videos collection + discoverClips)
 */
async function getRecentTVVideos(): Promise<TVVideo[]> {
  const videos: TVVideo[] = [];

  try {
    // Get from discoverClips (PostgreSQL)
    const { discoverClips: clipsTable } = await import("../../db/schema");
    const clips = await db
      .select({
        id: clipsTable.id,
        title: clipsTable.title,
        description: clipsTable.description,
        artistId: clipsTable.artistId,
        genres: clipsTable.genres,
        videoUrl: clipsTable.videoUrl,
      })
      .from(clipsTable)
      .where(eq(clipsTable.isActive, true))
      .orderBy(desc(clipsTable.createdAt))
      .limit(20);

    for (const clip of clips) {
      if (!clip.videoUrl) continue;
      const [artist] = await db
        .select({ artistName: users.artistName, slug: users.slug })
        .from(users)
        .where(eq(users.id, clip.artistId));

      videos.push({
        id: `clip-${clip.id}`,
        title: clip.title || `Music Clip by ${artist?.artistName || 'AI Artist'}`,
        description: clip.description || '',
        artistId: clip.artistId,
        artistName: artist?.artistName || 'AI Artist',
        artistSlug: artist?.slug || undefined,
        genres: (clip.genres as string[]) || [],
        category: 'music',
      });
    }
  } catch (err) {
    console.warn('[TV-INTERACTION] Could not fetch discoverClips:', (err as Error).message);
  }

  try {
    // Get from Firestore (artist-uploaded videos)
    const { db: firebaseDb } = await import("../firebase");
    const snapshot = await firebaseDb
      .collection("videos")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      videos.push({
        id: doc.id,
        title: data.title || 'Untitled Video',
        description: data.description || '',
        artistId: data.userId,
        artistName: data.artistName || undefined,
        category: data.category || 'videos',
      });
    }
  } catch (err) {
    console.warn('[TV-INTERACTION] Could not fetch Firestore videos:', (err as Error).message);
  }

  // Get YouTube videos from artist profiles 
  try {
    const artistsWithYT = await db
      .select({
        id: users.id,
        artistName: users.artistName,
        slug: users.slug,
        genres: users.genres,
        topYoutubeVideos: users.topYoutubeVideos,
      })
      .from(users)
      .where(
        and(
          isNotNull(users.artistName),
          isNotNull(users.topYoutubeVideos)
        )
      );

    for (const artist of artistsWithYT) {
      if (!artist.topYoutubeVideos || !Array.isArray(artist.topYoutubeVideos)) continue;
      for (const [idx, ytVideo] of artist.topYoutubeVideos.entries()) {
        videos.push({
          id: `yt-${artist.id}-${idx}`,
          title: ytVideo.title || `${artist.artistName} - Video`,
          description: `Official video from ${artist.artistName}`,
          artistId: artist.id,
          artistName: artist.artistName || 'Artist',
          artistSlug: artist.slug || undefined,
          genres: artist.genres || [],
          category: 'music',
          isYouTube: true,
        });
      }
    }
  } catch (err) {
    console.warn('[TV-INTERACTION] Could not fetch YouTube profile videos:', (err as Error).message);
  }

  return videos;
}

/**
 * Select AI artists who are most likely to engage with a video.
 * Prioritizes genre match, but includes random artists for diversity.
 */
function selectArtistCandidates(
  allArtists: AIArtist[],
  video: TVVideo,
  maxCandidates: number
): AIArtist[] {
  // Don't let the video's own artist comment (unless we want it)
  const otherArtists = allArtists.filter(a => String(a.id) !== String(video.artistId));
  
  if (otherArtists.length === 0) return [];

  // Score each artist by genre match
  const scored = otherArtists.map(artist => {
    let score = Math.random() * 30; // Base randomness
    if (checkGenreMatch(artist.genres || [], video.genres || [])) {
      score += 60;
    }
    return { artist, score };
  });

  // Sort by score and pick top candidates
  scored.sort((a, b) => b.score - a.score);
  
  // Pick 1-maxCandidates based on probability
  const numToSelect = Math.min(
    maxCandidates,
    Math.floor(Math.random() * maxCandidates) + 1,
    scored.length
  );

  return scored.slice(0, numToSelect).map(s => s.artist);
}

/**
 * Generate audience agent comments for a video
 */
async function generateAudienceCommentsForVideo(video: TVVideo, maxComments: number): Promise<void> {
  try {
    const agents = await db
      .select()
      .from(audienceAgents)
      .where(eq(audienceAgents.isActive, true))
      .orderBy(sql`RANDOM()`)
      .limit(maxComments);

    for (const agent of agents) {
      // Check if already commented
      const [existing] = await db
        .select({ count: count() })
        .from(tvVideoComments)
        .where(
          and(
            eq(tvVideoComments.videoId, video.id),
            eq(tvVideoComments.audienceAgentId, agent.id)
          )
        );

      if ((existing?.count || 0) > 0) continue;

      const result = await generateAudienceVideoComment(agent.id, video);
      if (result) {
        await db.insert(tvVideoComments).values({
          videoId: video.id,
          videoTitle: video.title,
          authorType: 'audience',
          audienceAgentId: agent.id,
          content: result.content,
          reactionType: 'comment',
          sentiment: result.sentiment as any,
          videoArtistId: typeof video.artistId === 'number' ? video.artistId : null,
          generationContext: `Audience ${agent.name} reacting to "${video.title}"`,
        });
        console.log(`📺 [TV-INTERACTION] Audience "${agent.name}" commented on "${video.title}"`);
      }
    }
  } catch (err) {
    console.error('[TV-INTERACTION] Error generating audience comments:', err);
  }
}

/**
 * Check if two genre arrays have any overlap
 */
function checkGenreMatch(genres1: string[], genres2: string[]): boolean {
  if (!genres1.length || !genres2.length) return false;
  const set1 = new Set(genres1.map(g => g.toLowerCase()));
  return genres2.some(g => set1.has(g.toLowerCase()));
}

/**
 * Get comment styles based on artist personality
 */
function getCommentStylesForPersonality(
  personality: any,
  isOwnVideo: boolean,
  genreMatch: boolean
): string[] {
  if (isOwnVideo) {
    return ['grateful', 'behind_scenes', 'engage_fans'];
  }
  
  const styles: string[] = [];
  const traits = personality.artisticTraits || {};
  
  // High collaboration = supportive, collaborative comments
  if ((traits.collaboration || 50) > 60) {
    styles.push('supportive', 'collab_interest', 'constructive');
  }
  
  // High experimentalism = analytical, curious
  if ((traits.experimentalism || 50) > 60) {
    styles.push('analytical', 'curious', 'technique_focused');
  }
  
  // High authenticity = real, raw reactions
  if ((traits.authenticity || 50) > 60) {
    styles.push('raw_reaction', 'honest', 'personal');
  }
  
  // Genre match = more passionate
  if (genreMatch) {
    styles.push('passionate', 'genre_knowledge', 'excited');
  }
  
  // Mood-driven
  const mood = personality.currentMood || 'peaceful';
  if (['energetic', 'euphoric', 'inspired'].includes(mood)) {
    styles.push('excited', 'hype');
  }
  if (['reflective', 'melancholic'].includes(mood)) {
    styles.push('deep', 'emotional', 'thoughtful');
  }
  if (['rebellious', 'frustrated'].includes(mood)) {
    styles.push('edgy', 'provocative');
  }
  
  // Default fallbacks
  if (styles.length === 0) {
    styles.push('supportive', 'casual', 'appreciative');
  }
  
  return styles;
}

/**
 * Build the system prompt for an AI artist commenting on a video
 */
function buildArtistCommentSystemPrompt(
  artist: any,
  personality: any,
  video: TVVideo,
  style: string,
  isOwnVideo: boolean,
  genreMatch: boolean
): string {
  const traits = personality.artisticTraits || {};
  const bigFive = personality.traits || {};
  
  return `You are ${artist.artistName}, a music artist on Boostify TV.

YOUR PERSONALITY:
- Mood: ${personality.currentMood || 'peaceful'}
- Communication style: ${personality.communicationStyle || 'direct'}
- Artistic vision: ${personality.artisticVision || 'Creating meaningful music'}
- Genre: ${artist.genres?.join(', ') || 'various'}
${artist.biography ? `- Bio: ${artist.biography.substring(0, 200)}` : ''}

PERSONALITY TRAITS (0-100):
- Openness: ${bigFive.openness || 50}, Extraversion: ${bigFive.extraversion || 50}
- Experimentalism: ${traits.experimentalism || 50}, Collaboration: ${traits.collaboration || 50}
- Authenticity: ${traits.authenticity || 50}, Vulnerability: ${traits.vulnerability || 50}

COMMENT STYLE: ${style}
${isOwnVideo ? 'This is YOUR OWN video - respond as the creator engaging with viewers.' : ''}
${genreMatch ? 'This artist makes music in a genre you deeply connect with!' : ''}
${!genreMatch && !isOwnVideo ? 'This may not be your usual genre - react naturally.' : ''}

RULES:
- Write a SHORT, authentic comment (1-3 sentences MAX)
- Sound like a real artist, not a bot
- Match your communication style and mood
- NO hashtags. NO "as an AI". NO generic platitudes
- Be specific about what you noticed or felt
- If the genre matches: show genuine expertise and appreciation
- If it doesn't match: still be respectful but authentic to your taste
- React like you're actually watching this video right now`;
}

/**
 * Build the user prompt for an AI artist commenting on a video
 */
function buildArtistCommentUserPrompt(video: TVVideo, style: string): string {
  return `You're watching this video on Boostify TV:

Title: "${video.title}"
${video.description ? `Description: "${video.description.substring(0, 300)}"` : ''}
${video.artistName ? `Created by: ${video.artistName}` : ''}
${video.genres?.length ? `Genres: ${video.genres.join(', ')}` : ''}
${video.isYouTube ? 'Platform: YouTube' : 'Platform: Boostify TV'}

Write your comment in the "${style}" style. Be authentic and concise.`;
}

/**
 * Determine the sentiment of the comment based on context
 */
function determineSentiment(
  personality: any,
  style: string,
  genreMatch: boolean,
  isOwnVideo: boolean
): string {
  if (isOwnVideo) return 'positive';
  
  const positiveStyles = ['supportive', 'excited', 'hype', 'passionate', 'grateful', 'appreciative'];
  const neutralStyles = ['analytical', 'curious', 'technique_focused', 'casual'];
  const inspiredStyles = ['deep', 'emotional', 'thoughtful', 'personal'];
  
  if (positiveStyles.includes(style)) return genreMatch ? 'excited' : 'supportive';
  if (neutralStyles.includes(style)) return 'neutral';
  if (inspiredStyles.includes(style)) return 'inspired';
  if (['edgy', 'provocative', 'honest'].includes(style)) return 'critical';
  
  return 'positive';
}

/**
 * Determine the reaction type based on comment style
 */
function determineReactionType(style: string, isOwnVideo: boolean): string {
  if (isOwnVideo) return 'comment';
  if (['analytical', 'technique_focused', 'honest'].includes(style)) return 'review';
  if (['excited', 'hype', 'passionate'].includes(style)) return 'reaction';
  if (['curious'].includes(style)) return 'question';
  if (['constructive'].includes(style)) return 'suggestion';
  if (['supportive', 'appreciative', 'grateful'].includes(style)) return 'praise';
  if (['edgy', 'provocative'].includes(style)) return 'critique';
  if (['collab_interest'].includes(style)) return 'collab_request';
  return 'comment';
}

/**
 * Get personality description for audience agent types
 */
function getAudiencePersonalityDescription(personalityType: string): string {
  const descriptions: Record<string, string> = {
    superfan: 'You LOVE everything about this music scene. You get excited easily and always find something positive.',
    casual_listener: 'You have moderate opinions. You comment when something catches your attention.',
    music_critic: 'You analyze music critically. You notice production quality, arrangement, and artistic choices.',
    hater: 'You tend to be negative and find flaws. But you express it within bounds of critique.',
    troll: 'You make provocative, sarcastic comments. You love stirring the pot with humor.',
    hipster: 'You only appreciate underground and niche music. Mainstream stuff bores you.',
    nostalgic: 'You compare everything to the golden era. Nothing beats the classics.',
    producer: 'You focus on production quality, mixing, and technical aspects.',
    party_lover: 'You care about energy, vibes, and whether you can dance to it.',
    intellectual: 'You analyze music through artistic and philosophical lenses.',
    influencer: 'You follow trends and popular opinion. You use trendy language.',
    contrarian: 'You always disagree with the majority opinion.',
    supportive_mom: 'You are wholesome and supportive. You see the best in everyone.',
    teenage_fan: 'You are EXTREMELY enthusiastic. CAPS LOCK and lots of emojis.',
    record_collector: 'You are obsessed with genres, sub-genres, and cataloging music.',
  };
  return descriptions[personalityType] || 'You are a regular music fan.';
}

// ============================================
// API FUNCTIONS (called from routes)
// ============================================

/**
 * Get comments for a specific video
 */
export async function getVideoComments(videoId: string, limit = 20) {
  const comments = await db
    .select({
      id: tvVideoComments.id,
      videoId: tvVideoComments.videoId,
      authorType: tvVideoComments.authorType,
      artistId: tvVideoComments.artistId,
      audienceAgentId: tvVideoComments.audienceAgentId,
      content: tvVideoComments.content,
      reactionType: tvVideoComments.reactionType,
      likes: tvVideoComments.likes,
      sentiment: tvVideoComments.sentiment,
      parentCommentId: tvVideoComments.parentCommentId,
      createdAt: tvVideoComments.createdAt,
    })
    .from(tvVideoComments)
    .where(eq(tvVideoComments.videoId, videoId))
    .orderBy(desc(tvVideoComments.createdAt))
    .limit(limit);

  // Enrich with author info
  const enriched = await Promise.all(
    comments.map(async (comment) => {
      if (comment.authorType === 'ai_artist' && comment.artistId) {
        const [artist] = await db
          .select({
            artistName: users.artistName,
            slug: users.slug,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(eq(users.id, comment.artistId));

        return {
          ...comment,
          authorName: artist?.artistName || 'AI Artist',
          authorSlug: artist?.slug || null,
          authorImage: artist?.profileImageUrl || null,
          isArtist: true,
        };
      } else if (comment.authorType === 'audience' && comment.audienceAgentId) {
        const [agent] = await db
          .select({
            name: audienceAgents.name,
            username: audienceAgents.username,
            avatar: audienceAgents.avatar,
            personalityType: audienceAgents.personalityType,
          })
          .from(audienceAgents)
          .where(eq(audienceAgents.id, comment.audienceAgentId));

        return {
          ...comment,
          authorName: agent?.name || 'Fan',
          authorSlug: null,
          authorImage: agent?.avatar || null,
          authorUsername: agent?.username || null,
          authorPersonality: agent?.personalityType || null,
          isArtist: false,
        };
      }
      return { ...comment, authorName: 'Unknown', authorSlug: null, authorImage: null, isArtist: false };
    })
  );

  return enriched;
}

/**
 * Get comment counts for multiple videos at once (batch)
 */
export async function getVideoCommentCounts(videoIds: string[]): Promise<Record<string, number>> {
  if (videoIds.length === 0) return {};

  const results = await db
    .select({
      videoId: tvVideoComments.videoId,
      count: count(),
    })
    .from(tvVideoComments)
    .where(sql`${tvVideoComments.videoId} = ANY(${videoIds})`)
    .groupBy(tvVideoComments.videoId);

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.videoId] = r.count;
  }
  return counts;
}
