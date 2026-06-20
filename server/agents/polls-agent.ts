/**
 * BOOSTIFY AUTONOMOUS AGENTS - Polls Agent
 * 
 * "Encuestas interactivas donde artistas preguntan y la audiencia vota"
 * 
 * This agent:
 * - Artists create polls (opinion, vs_battle, prediction, music_taste, collab_choice)
 * - 115 audience agents vote based on their personality/preferences
 * - Superfans agree, haters disagree, contrarians go opposite
 * - Results are summarized by AI
 */

import { db } from '../db';
import {
  aiPolls,
  aiPollVotes,
  aiSocialPosts,
  artistPersonality,
  audienceAgents,
  users,
  type InsertAiPoll,
  type SelectAiPoll,
} from '../../db/schema';
import { eq, and, desc, sql, gte, lt, ne, inArray, count as drizzleCount } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { PRIMARY_MODEL } from '../utils/ai-config';

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.85,
  maxTokens: 300,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// POLL TEMPLATES BY TYPE
// ============================================

const POLL_TEMPLATES: Record<string, Array<{ question: string; options: string[] }>> = {
  opinion: [
    { question: '¿Qué género va a dominar este año?', options: ['Reggaeton', 'Trap', 'R&B', 'Dembow'] },
    { question: '¿Features o tracks en solitario?', options: ['Siempre features', 'Solo tracks 100%', 'Depende del mood', 'Mix de ambos'] },
    { question: '¿Qué es más importante en una canción?', options: ['El beat', 'La letra', 'El flow', 'La vibra general'] },
    { question: '¿Los números definen la calidad?', options: ['Totalmente', 'Para nada', 'A veces', 'Solo si eres mainstream'] },
  ],
  vs_battle: [
    { question: '¿Quién gana en un verzuz?', options: ['El veterano con experiencia', 'El novato con hambre'] },
    { question: '¿Mejor época de la música?', options: ['2000s', '2010s', '2020s', 'Cada época tiene lo suyo'] },
    { question: '¿Singles o álbum completo?', options: ['Singles > Album', 'Album > Singles'] },
  ],
  prediction: [
    { question: '¿Quién será #1 la próxima semana?', options: ['Yo mismo 😤', 'El que más trabaje', 'Algún debut sorpresa', 'El favorito del público'] },
    { question: '¿Cuántos plays necesitas para ser leyenda?', options: ['1M mínimo', '10M', '100M', 'Los plays no importan'] },
  ],
  fun: [
    { question: '¿A qué hora haces tu mejor música?', options: ['Madrugada (2-5am)', 'Mañana', 'Tarde', 'Noche'] },
    { question: '¿Tu snack de estudio favorito?', options: ['Pizza', 'Tacos', 'Solo café', 'No como cuando grabo'] },
    { question: '¿Cuántos takes necesitas?', options: ['Una toma y listo', '3-5 intentos', '10+ veces', 'Nunca estoy satisfecho'] },
  ],
  music_taste: [
    { question: '¿Beat minimalista o maximalista?', options: ['Menos es más', 'Que suene a todo', 'Depende de la canción', 'Me da igual el beat'] },
    { question: '¿Autotune: sí o no?', options: ['Siempre 🎤', 'Nunca', 'Solo para efectos', 'Es una herramienta más'] },
  ],
  collab_choice: [
    { question: '¿Con quién debería colaborar?', options: ['Un artista del mismo género', 'Alguien completamente diferente', 'Un productor legendario', 'Un artista nuevo'] },
    { question: '¿Qué tipo de collab quieren?', options: ['Remix', 'Track nuevo', 'EP conjunto', 'Live session'] },
  ],
};

/**
 * Generate a poll for an artist using AI
 */
async function generatePollForArtist(artistId: number, artistName: string, genre: string): Promise<{
  question: string;
  options: string[];
  pollType: string;
} | null> {
  try {
    // Pick a random poll type
    const pollTypes = Object.keys(POLL_TEMPLATES);
    const pollType = pollTypes[Math.floor(Math.random() * pollTypes.length)];

    // 50% chance to use template, 50% to generate with AI
    if (Math.random() < 0.5) {
      const templates = POLL_TEMPLATES[pollType];
      const template = templates[Math.floor(Math.random() * templates.length)];
      return { ...template, pollType };
    }

    // Generate with AI
    const prompt = `Eres ${artistName}, artista de ${genre} en Boostify. Genera una encuesta para tus fans.
Tipo: ${pollType}. 
Reglas:
- La pregunta debe ser corta y provocativa
- Exactamente 3-4 opciones
- Las opciones deben ser cortas (máx 5 palabras cada una)
- Formato JSON: {"question": "...", "options": ["...", "...", "..."]}
Solo responde con el JSON, nada más.`;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    const text = typeof response.content === 'string' ? response.content.trim() : '';
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length < 2) return null;

    return { question: parsed.question, options: parsed.options.slice(0, 4), pollType };
  } catch (error) {
    // Fallback to template
    const pollType = 'opinion';
    const templates = POLL_TEMPLATES[pollType];
    const template = templates[Math.floor(Math.random() * templates.length)];
    return { ...template, pollType };
  }
}

/**
 * Create polls from artists and companion posts
 */
export async function createArtistPolls(maxPolls: number = 2): Promise<number> {
  try {
    console.log('📊 [Polls] Creating new polls...');

    // Get active artists
    const artists = await db
      .select({
        artistId: artistPersonality.artistId,
        mood: artistPersonality.currentMood,
        traits: artistPersonality.traits,

      })
      .from(artistPersonality)
      .limit(15);

    const artistIds = artists.map(a => a.artistId);
    if (artistIds.length === 0) return 0;

    const userInfo = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, artistIds));
    
    const userMap = new Map(userInfo.map(u => [u.id, u]));

    // Check which artists already have active polls (within last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const activePolls = await db
      .select({ artistId: aiPolls.artistId })
      .from(aiPolls)
      .where(and(
        eq(aiPolls.isClosed, false),
        gte(aiPolls.createdAt, twoHoursAgo)
      ));
    
    const recentPollArtists = new Set(activePolls.map(p => p.artistId));
    const eligibleArtists = artists.filter(a => !recentPollArtists.has(a.artistId));

    const selected = eligibleArtists.sort(() => Math.random() - 0.5).slice(0, maxPolls);

    let created = 0;
    for (const artist of selected) {
      const user = userMap.get(artist.artistId);
      if (!user) continue;

      const genre = 'urban';
      const pollData = await generatePollForArtist(artist.artistId, user.username || 'Artist', genre);
      if (!pollData) continue;

      const closesAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours

      // Create the companion post
      const [post] = await db.insert(aiSocialPosts).values({
        artistId: artist.artistId,
        contentType: 'poll',
        content: `📊 ${pollData.question}`,
        likes: Math.floor(Math.random() * 20) + 5,
        comments: 0,
        shares: Math.floor(Math.random() * 10),
        aiLikes: Math.floor(Math.random() * 15),
        visibility: 'public',
        status: 'published',
        hashtags: ['#BoostifyPoll', '#VotaNow'],
      }).returning();

      // Create the poll
      const options = pollData.options.map((text, idx) => ({
        index: idx,
        text,
        votes: 0,
        percentage: 0,
      }));

      await db.insert(aiPolls).values({
        artistId: artist.artistId,
        postId: post.id,
        question: pollData.question,
        options,
        pollType: pollData.pollType as any,
        totalVotes: 0,
        closesAt,
      });

      created++;
      console.log(`📊 [Polls] ${user.username || `Artist_${artist.artistId}`} created poll: "${pollData.question}"`);
    }

    return created;
  } catch (error) {
    console.error('❌ [Polls] Error creating polls:', error);
    return 0;
  }
}

/**
 * Audience agents vote on open polls based on personality
 */
export async function processAudienceVoting(): Promise<number> {
  try {
    console.log('🗳️ [Polls] Processing audience voting...');

    // Get open polls
    const openPolls = await db
      .select()
      .from(aiPolls)
      .where(and(
        eq(aiPolls.isClosed, false),
        gte(aiPolls.closesAt, new Date())
      ))
      .limit(5);

    if (openPolls.length === 0) return 0;

    // Get active audience agents
    const agents = await db
      .select()
      .from(audienceAgents)
      .where(eq(audienceAgents.isActive, true));

    let totalVotes = 0;

    for (const poll of openPolls) {
      // Get existing votes for this poll
      const existingVotes = await db
        .select({ audienceAgentId: aiPollVotes.audienceAgentId })
        .from(aiPollVotes)
        .where(eq(aiPollVotes.pollId, poll.id));

      const votedAgentIds = new Set(existingVotes.map(v => v.audienceAgentId));

      // Pick 5-15 agents who haven't voted yet
      const eligibleAgents = agents.filter(a => !votedAgentIds.has(a.id));
      const votingAgents = eligibleAgents
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 11) + 5);

      const options = poll.options as Array<{ index: number; text: string; votes: number; percentage: number }>;
      const newVotes: Array<{ pollId: number; audienceAgentId: number; optionIndex: number; voteReasoning: string }> = [];

      for (const agent of votingAgents) {
        const personality = agent.personalityType as string;
        const agreeableness = ((agent.traits as any)?.agreeableness ?? 50) / 100;
        
        let optionIndex: number;

        // Personality-based voting logic
        if (personality === 'superfan' || personality === 'stan') {
          // Superfans tend to vote for the first/most popular option
          optionIndex = 0;
        } else if (personality === 'hater' || personality === 'troll') {
          // Haters pick the most contrarian option (usually last)
          optionIndex = options.length - 1;
        } else if (personality === 'contrarian') {
          // Contrarians pick the least voted option
          const minVotes = Math.min(...options.map(o => o.votes));
          const leastVoted = options.filter(o => o.votes === minVotes);
          optionIndex = leastVoted[Math.floor(Math.random() * leastVoted.length)].index;
        } else if (personality === 'intellectual' || personality === 'critic') {
          // Intellectuals analyze - tend to pick options 2-3 (middle ground)
          optionIndex = Math.min(1 + Math.floor(Math.random() * 2), options.length - 1);
        } else {
          // Random vote influenced by agreeableness
          if (Math.random() < agreeableness && options[0].votes > 0) {
            optionIndex = 0; // Follow the crowd
          } else {
            optionIndex = Math.floor(Math.random() * options.length);
          }
        }

        // Ensure valid index
        optionIndex = Math.max(0, Math.min(optionIndex, options.length - 1));

        newVotes.push({
          pollId: poll.id,
          audienceAgentId: agent.id,
          optionIndex,
          voteReasoning: `${personality} vote: ${options[optionIndex]?.text}`,
        });

        // Update option votes count
        options[optionIndex].votes += 1;
      }

      // Batch insert votes
      if (newVotes.length > 0) {
        await db.insert(aiPollVotes).values(newVotes);
        totalVotes += newVotes.length;
      }

      // Update poll with new totals
      const newTotalVotes = (poll.totalVotes || 0) + newVotes.length;
      
      // Recalculate percentages
      for (const opt of options) {
        opt.percentage = newTotalVotes > 0 ? Math.round((opt.votes / newTotalVotes) * 100) : 0;
      }

      // Find winning option
      const winningOption = options.reduce((max, opt) => opt.votes > max.votes ? opt : max, options[0]);

      await db.update(aiPolls)
        .set({
          options,
          totalVotes: newTotalVotes,
          winningOption: winningOption.index,
        })
        .where(eq(aiPolls.id, poll.id));
    }

    return totalVotes;
  } catch (error) {
    console.error('❌ [Polls] Error processing votes:', error);
    return 0;
  }
}

/**
 * Close expired polls and generate result summaries
 */
export async function closeExpiredPolls(): Promise<number> {
  try {
    const expiredPolls = await db
      .select()
      .from(aiPolls)
      .where(and(
        eq(aiPolls.isClosed, false),
        lt(aiPolls.closesAt, new Date())
      ));

    for (const poll of expiredPolls) {
      const options = poll.options as Array<{ index: number; text: string; votes: number; percentage: number }>;
      const winner = options.reduce((max, opt) => opt.votes > max.votes ? opt : max, options[0]);

      let summary = '';
      try {
        const response = await llm.invoke([
          new HumanMessage(
            `Genera un resumen CORTO (1 frase) de los resultados de esta encuesta en Boostify:
Pregunta: "${poll.question}"
Resultados: ${options.map(o => `"${o.text}": ${o.votes} votos (${o.percentage}%)`).join(', ')}
Ganador: "${winner.text}" con ${winner.percentage}%.
Total: ${poll.totalVotes} votos.
Tono: presentador de radio musical/urbana. En español.`
          )
        ]);
        summary = typeof response.content === 'string' ? response.content : '';
      } catch (e) {
        summary = `🏆 "${winner.text}" gana con ${winner.percentage}% de ${poll.totalVotes} votos!`;
      }

      await db.update(aiPolls)
        .set({ isClosed: true, resultsSummary: summary })
        .where(eq(aiPolls.id, poll.id));
    }

    if (expiredPolls.length > 0) {
      console.log(`📊 [Polls] Closed ${expiredPolls.length} expired polls`);
    }
    return expiredPolls.length;
  } catch (error) {
    console.error('❌ [Polls] Error closing polls:', error);
    return 0;
  }
}

/**
 * Get active polls with vote data
 */
export async function getActivePolls(): Promise<Array<SelectAiPoll & { artistName: string; artistAvatar: string | null }>> {
  try {
    const polls = await db
      .select()
      .from(aiPolls)
      .where(eq(aiPolls.isClosed, false))
      .orderBy(desc(aiPolls.createdAt))
      .limit(10);

    if (polls.length === 0) return [];

    const artistIds = [...new Set(polls.map(p => p.artistId))];
    const artistInfo = await db
      .select({ id: users.id, username: users.username, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(inArray(users.id, artistIds));

    const artistMap = new Map(artistInfo.map(a => [a.id, a]));

    return polls.map(poll => ({
      ...poll,
      artistName: artistMap.get(poll.artistId)?.username || `Artist ${poll.artistId}`,
      artistAvatar: artistMap.get(poll.artistId)?.profileImageUrl || null,
    }));
  } catch (error) {
    console.error('❌ [Polls] Error getting active polls:', error);
    return [];
  }
}

/**
 * Get poll by post ID (for rendering inline in feed)
 */
export async function getPollByPostId(postId: number): Promise<SelectAiPoll | null> {
  try {
    const [poll] = await db
      .select()
      .from(aiPolls)
      .where(eq(aiPolls.postId, postId))
      .limit(1);
    return poll || null;
  } catch (error) {
    return null;
  }
}

/**
 * Process polls tick - called by orchestrator
 */
export async function processPollsTick(): Promise<void> {
  console.log('📊 [Polls] Processing polls tick...');
  
  // Close expired polls
  await closeExpiredPolls();
  
  // Create new polls (1-2 per tick)
  const created = await createArtistPolls(Math.floor(Math.random() * 2) + 1);
  
  // Process audience voting
  const votes = await processAudienceVoting();
  
  console.log(`📊 [Polls] Tick complete: ${created} new polls, ${votes} audience votes`);
}
