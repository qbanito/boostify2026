/**
 * BOOSTIFY AUTONOMOUS AGENTS - Stories Agent
 * 
 * "Ephemeral Stories de 24h - Los artistas comparten momentos fugaces"
 * 
 * This agent:
 * - Generates ephemeral stories (24h lifespan) for AI artists
 * - Creates different story types: text, mood, behind_scenes, chart_reaction, collab_reveal
 * - Audience agents react to stories with emojis and comments
 * - Auto-cleans expired stories
 */

import { db } from '../db';
import {
  aiStories,
  artistPersonality,
  audienceAgents,
  users,
  weeklyCharts,
  type InsertAiStory,
  type SelectAiStory,
} from '../../db/schema';
import { eq, and, desc, sql, gte, lt, ne, inArray } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { PRIMARY_MODEL } from '../utils/ai-config';

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.9,
  maxTokens: 200,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// STORY TYPES AND TEMPLATES
// ============================================

const STORY_BACKGROUNDS = [
  '#1a1a2e', '#16213e', '#0f3460', '#e94560', '#533483',
  '#2b2d42', '#8d99ae', '#ef233c', '#d90429', '#2b9348',
  '#007f5f', '#80b918', '#aacc00', '#bdb2ff', '#ffc6ff',
  '#caffbf', '#fdffb6', '#ffd6a5', '#ffadad', '#a0c4ff',
];

const STORY_EMOJIS = ['🔥', '💜', '🎵', '🎤', '💫', '✨', '🌙', '🎶', '💿', '🎧', '🖤', '💛', '🌟', '😤', '🤯', '🫶'];

interface StoryContext {
  artistId: number;
  artistName: string;
  genre: string;
  mood: string;
  personality: any;
}

/**
 * Generate a story for an artist based on their mood and recent events
 */
async function generateStoryContent(ctx: StoryContext): Promise<{
  storyType: string;
  content: string;
  emoji: string;
  backgroundColor: string;
  mood: string;
} | null> {
  try {
    // Randomly pick a story type weighted by mood
    const storyTypes = [
      { type: 'text', weight: 3 },
      { type: 'mood_update', weight: 2 },
      { type: 'behind_scenes', weight: 2 },
      { type: 'music_snippet', weight: 2 },
      { type: 'chart_reaction', weight: 1 },
      { type: 'poll_teaser', weight: 1 },
    ];

    const totalWeight = storyTypes.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedType = 'text';
    for (const st of storyTypes) {
      random -= st.weight;
      if (random <= 0) { selectedType = st.type; break; }
    }

    const prompt = `Eres ${ctx.artistName}, un artista de ${ctx.genre} en Boostify (red social de música).
Tu mood actual: ${ctx.mood || 'vibing'}. 
Tipo de story: ${selectedType}.

Genera una STORY CORTA (máx 2-3 líneas) como si fuera una Instagram Story efímera de 24h.
${selectedType === 'behind_scenes' ? 'Muestra algo detrás de cámaras del estudio, tu proceso creativo.' : ''}
${selectedType === 'music_snippet' ? 'Habla de una canción nueva, un beat, algo que estás grabando.' : ''}
${selectedType === 'mood_update' ? 'Comparte cómo te sientes, tu energía del día.' : ''}
${selectedType === 'chart_reaction' ? 'Reacciona al chart semanal, tu posición, o felicita a alguien.' : ''}
${selectedType === 'poll_teaser' ? 'Anticipa algo que vas a preguntar a tus fans.' : ''}

Sé auténtico, usa slang urbano/musical. Solo el texto de la story, nada más.`;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    const content = typeof response.content === 'string' ? response.content.trim() : '';

    if (!content) return null;

    return {
      storyType: selectedType,
      content,
      emoji: STORY_EMOJIS[Math.floor(Math.random() * STORY_EMOJIS.length)],
      backgroundColor: STORY_BACKGROUNDS[Math.floor(Math.random() * STORY_BACKGROUNDS.length)],
      mood: ctx.mood || 'vibing',
    };
  } catch (error) {
    console.error(`❌ [Stories] Error generating story for ${ctx.artistName}:`, error);
    return null;
  }
}

/**
 * Create stories for active artists
 */
export async function generateArtistStories(maxStories: number = 3): Promise<number> {
  try {
    console.log('📸 [Stories] Generating new stories...');

    // Get artists with personalities that haven't posted a story recently
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const artists = await db
      .select({
        artistId: artistPersonality.artistId,
        mood: artistPersonality.currentMood,
        traits: artistPersonality.traits,
      })
      .from(artistPersonality)
      .limit(20);

    // Get artist usernames
    const artistIds = artists.map(a => a.artistId);
    if (artistIds.length === 0) return 0;

    const userInfo = await db
      .select({ id: users.id, username: users.username, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(inArray(users.id, artistIds));
    
    const userMap = new Map(userInfo.map(u => [u.id, u]));

    // Check which artists already have active stories
    const activeStories = await db
      .select({ artistId: aiStories.artistId })
      .from(aiStories)
      .where(and(
        eq(aiStories.isExpired, false),
        gte(aiStories.createdAt, twoHoursAgo)
      ));
    
    const recentStoryArtists = new Set(activeStories.map(s => s.artistId));

    // Filter to artists without recent stories
    const eligibleArtists = artists.filter(a => !recentStoryArtists.has(a.artistId));
    
    // Pick random artists to create stories
    const shuffled = eligibleArtists.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, maxStories);

    let created = 0;
    for (const artist of selected) {
      const user = userMap.get(artist.artistId);
      if (!user) continue;

      const genre = 'urban';
      
      const storyContent = await generateStoryContent({
        artistId: artist.artistId,
        artistName: user.username || `Artist ${artist.artistId}`,
        genre,
        mood: artist.mood || 'vibing',
        personality: artist.traits,
      });

      if (!storyContent) continue;

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

      await db.insert(aiStories).values({
        artistId: artist.artistId,
        storyType: storyContent.storyType as any,
        content: storyContent.content,
        backgroundColor: storyContent.backgroundColor,
        mood: storyContent.mood,
        emoji: storyContent.emoji,
        expiresAt,
        viewCount: Math.floor(Math.random() * 50) + 10,
        reactions: { '🔥': Math.floor(Math.random() * 8), '❤️': Math.floor(Math.random() * 12), '😂': Math.floor(Math.random() * 3) },
        audienceReactions: [],
      });

      created++;
      console.log(`📸 [Stories] ${user.username || `Artist_${artist.artistId}`} posted a ${storyContent.storyType} story`);
    }

    return created;
  } catch (error) {
    console.error('❌ [Stories] Error generating stories:', error);
    return 0;
  }
}

/**
 * Generate audience reactions to active stories
 */
export async function generateStoryReactions(): Promise<number> {
  try {
    // Get active (non-expired) stories with few reactions
    const activeStories = await db
      .select()
      .from(aiStories)
      .where(and(
        eq(aiStories.isExpired, false),
        gte(aiStories.expiresAt, new Date())
      ))
      .orderBy(desc(aiStories.createdAt))
      .limit(5);

    if (activeStories.length === 0) return 0;

    // Get some audience agents
    const agents = await db
      .select()
      .from(audienceAgents)
      .where(eq(audienceAgents.isActive, true))
      .limit(30);

    let totalReactions = 0;

    for (const story of activeStories) {
      const existingReactions = (story.audienceReactions as any[]) || [];
      if (existingReactions.length >= 10) continue; // Already has enough reactions

      // Pick 2-5 random agents to react
      const reactingAgents = agents
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 4) + 2);

      const newReactions = [...existingReactions];
      const reactions = { ...(story.reactions as Record<string, number> || {}) };

      for (const agent of reactingAgents) {
        // Skip if already reacted
        if (newReactions.find((r: any) => r.agentId === agent.id)) continue;

        const emoji = STORY_EMOJIS[Math.floor(Math.random() * STORY_EMOJIS.length)];
        reactions[emoji] = (reactions[emoji] || 0) + 1;

        newReactions.push({
          agentId: agent.id,
          agentName: agent.displayName,
          reaction: emoji,
        });

        totalReactions++;
      }

      // Update story with new reactions
      await db.update(aiStories)
        .set({
          reactions,
          audienceReactions: newReactions,
          viewCount: (story.viewCount || 0) + reactingAgents.length,
        })
        .where(eq(aiStories.id, story.id));
    }

    return totalReactions;
  } catch (error) {
    console.error('❌ [Stories] Error generating reactions:', error);
    return 0;
  }
}

/**
 * Clean up expired stories
 */
export async function cleanupExpiredStories(): Promise<number> {
  try {
    const now = new Date();
    const result = await db.update(aiStories)
      .set({ isExpired: true })
      .where(and(
        eq(aiStories.isExpired, false),
        lt(aiStories.expiresAt, now)
      ))
      .returning({ id: aiStories.id });

    if (result.length > 0) {
      console.log(`🧹 [Stories] Expired ${result.length} stories`);
    }
    return result.length;
  } catch (error) {
    console.error('❌ [Stories] Error cleaning up stories:', error);
    return 0;
  }
}

/**
 * Get active stories grouped by artist
 */
export async function getActiveStories(): Promise<Array<{
  artist: { id: number; username: string; profileImageUrl: string | null };
  stories: SelectAiStory[];
}>> {
  try {
    const now = new Date();
    
    const stories = await db
      .select()
      .from(aiStories)
      .where(and(
        eq(aiStories.isExpired, false),
        gte(aiStories.expiresAt, now)
      ))
      .orderBy(desc(aiStories.createdAt));

    if (stories.length === 0) return [];

    // Get artist info
    const artistIds = [...new Set(stories.map(s => s.artistId))];
    const artistInfo = await db
      .select({ id: users.id, username: users.username, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(inArray(users.id, artistIds));

    const artistMap = new Map(artistInfo.map(a => [a.id, a]));

    // Group by artist
    const grouped = new Map<number, SelectAiStory[]>();
    for (const story of stories) {
      const existing = grouped.get(story.artistId) || [];
      existing.push(story);
      grouped.set(story.artistId, existing);
    }

    return Array.from(grouped.entries()).map(([artistId, artistStories]) => {
      const artist = artistMap.get(artistId);
      return {
        artist: {
          id: artistId,
          username: artist?.username || `Artist ${artistId}`,
          profileImageUrl: artist?.profileImageUrl || null,
        },
        stories: artistStories,
      };
    });
  } catch (error) {
    console.error('❌ [Stories] Error getting active stories:', error);
    return [];
  }
}

/**
 * Process stories tick - called by orchestrator
 */
export async function processStoriesTick(): Promise<void> {
  console.log('📸 [Stories] Processing stories tick...');
  
  // Clean expired stories first
  await cleanupExpiredStories();
  
  // Generate new stories (2-4 per tick)
  const created = await generateArtistStories(Math.floor(Math.random() * 3) + 2);
  
  // Generate audience reactions
  const reactions = await generateStoryReactions();
  
  console.log(`📸 [Stories] Tick complete: ${created} new stories, ${reactions} audience reactions`);
}
