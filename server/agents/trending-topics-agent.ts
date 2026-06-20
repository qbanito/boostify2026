/**
 * BOOSTIFY AUTONOMOUS AGENTS - Trending Topics Agent
 * 
 * "Connects Real World Music News to the AI Social Network"
 * 
 * This agent:
 * - Pulls processed news from the news-agent
 * - Creates trending topic cards in the feed
 * - AI artists react/opine on real events (Grammys, new albums, etc.)
 * - Audience agents debate news topics
 * - Trending score determines visibility
 */

import { db } from '../db';
import {
  trendingTopics,
  artistPersonality,
  audienceAgents,
  users,
  worldEvents,
  aiSocialPosts,
  type InsertTrendingTopic,
  type SelectTrendingTopic,
} from '../../db/schema';
import { eq, and, desc, sql, gte, inArray } from 'drizzle-orm';
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
// TRENDING TOPIC CREATION FROM NEWS
// ============================================

const FALLBACK_TRENDING_TOPICS = [
  { title: "Los Grammys 2026 sacuden la industria", summary: "Las nominaciones de los Grammys generan debate entre artistas y fans sobre quién merece ganar", category: "grammys" as const, entity: "Grammys 2026" },
  { title: "Bad Bunny anuncia nuevo álbum sorpresa", summary: "El artista puertorriqueño lanza material sin previo aviso, rompiendo récords de streaming", category: "new_release" as const, entity: "Bad Bunny" },
  { title: "El reggaetón domina los charts globales", summary: "Artistas latinos ocupan 7 de los 10 primeros puestos en los charts mundiales", category: "industry" as const, entity: "Reggaetón Global" },
  { title: "IA en la música: ¿amenaza o evolución?", summary: "El debate sobre el uso de inteligencia artificial en la producción musical se intensifica", category: "controversy" as const, entity: "AI Music" },
  { title: "Colaboración histórica entre rivales", summary: "Dos artistas que mantuvieron beef público anuncian tema conjunto que rompe internet", category: "collaboration" as const, entity: "Collab Surprise" },
  { title: "Festival Boostify Live 2026 confirmado", summary: "El primer festival de artistas IA y humanos se celebrará con hologramas y performances en vivo", category: "tour" as const, entity: "Boostify Live" },
  { title: "Canción viral de TikTok llega al #1", summary: "Un fragmento de 15 segundos se convierte en el hit más escuchado del año", category: "viral" as const, entity: "TikTok Hit" },
  { title: "Spotify cambia su modelo de royalties", summary: "La plataforma introduce un nuevo sistema que favorece a artistas independientes", category: "industry" as const, entity: "Spotify" },
];

/**
 * Create trending topics from world events or generate fresh ones
 */
export async function createTrendingTopics(maxTopics: number = 2): Promise<number> {
  try {
    console.log('🔥 [Trending] Creating new trending topics...');

    // Check for recent world events to create topics from
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = await db
      .select()
      .from(worldEvents)
      .where(gte(worldEvents.startsAt, oneDayAgo))
      .orderBy(desc(worldEvents.createdAt))
      .limit(5);

    let created = 0;

    if (recentEvents.length > 0) {
      // Create from real news events
      for (const event of recentEvents.slice(0, maxTopics)) {
        const existing = await db
          .select({ id: trendingTopics.id })
          .from(trendingTopics)
          .where(eq(trendingTopics.title, event.title))
          .limit(1);
        
        if (existing.length > 0) continue;

        await db.insert(trendingTopics).values({
          title: event.title,
          summary: event.description || '',
          category: 'other',
          relatedEntity: event.title.split(':')[0] || event.title,
          trendScore: 50,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        });
        created++;
      }
    }

    // If we need more, use curated fallback topics
    if (created < maxTopics) {
      const topic = FALLBACK_TRENDING_TOPICS[Math.floor(Math.random() * FALLBACK_TRENDING_TOPICS.length)];
      
      // Check not duplicate
      const existing = await db
        .select({ id: trendingTopics.id })
        .from(trendingTopics)
        .where(and(
          eq(trendingTopics.title, topic.title),
          eq(trendingTopics.isActive, true)
        ))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(trendingTopics).values({
          title: topic.title,
          summary: topic.summary,
          category: topic.category,
          relatedEntity: topic.entity,
          trendScore: Math.floor(Math.random() * 40) + 60,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        });
        created++;
      }
    }

    console.log(`🔥 [Trending] Created ${created} trending topics`);
    return created;
  } catch (error) {
    console.error('❌ [Trending] Error creating topics:', error);
    return 0;
  }
}

// ============================================
// ARTIST REACTIONS TO TRENDING TOPICS
// ============================================

/**
 * Generate AI artist reactions to trending topics
 */
export async function generateArtistReactionsToTrending(maxReactions: number = 3): Promise<number> {
  try {
    // Get active trending topics with few reactions
    const topics = await db
      .select()
      .from(trendingTopics)
      .where(and(
        eq(trendingTopics.isActive, true),
        sql`${trendingTopics.totalReactions} < 5`
      ))
      .orderBy(desc(trendingTopics.trendScore))
      .limit(3);

    if (topics.length === 0) return 0;

    // Get artists with personalities
    const artists = await db
      .select({
        artistId: artistPersonality.artistId,
        mood: artistPersonality.currentMood,
        traits: artistPersonality.traits,
        communicationStyle: artistPersonality.communicationStyle,
      })
      .from(artistPersonality)
      .limit(20);

    const artistIds = artists.map(a => a.artistId);
    if (artistIds.length === 0) return 0;

    const userInfo = await db
      .select({ id: users.id, username: users.username, artistName: users.artistName })
      .from(users)
      .where(inArray(users.id, artistIds));

    const userMap = new Map(userInfo.map(u => [u.id, u]));

    let totalReactions = 0;

    for (const topic of topics) {
      const selectedArtists = artists
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(maxReactions, 3));

      const newReactions: Array<any> = topic.artistReactions || [];

      for (const artist of selectedArtists) {
        const user = userMap.get(artist.artistId);
        if (!user) continue;
        const name = user.artistName || user.username || `Artist ${artist.artistId}`;

        // Already reacted?
        if (newReactions.some(r => r.artistId === artist.artistId)) continue;

        try {
          const prompt = `Eres ${name}, artista de música urbana en Boostify.
Tu mood: ${artist.mood || 'vibing'}. Tu estilo de comunicación: ${artist.communicationStyle || 'street'}.

Noticia trending: "${topic.title}"
Resumen: ${topic.summary}

Genera una REACCIÓN CORTA (1-2 líneas) a esta noticia como si fuera un tweet o post.
Sé auténtico, opina sin filtro, usa tu estilo. Solo el texto, nada más.`;

          const response = await llm.invoke([new HumanMessage(prompt)]);
          const reaction = typeof response.content === 'string' ? response.content.trim() : '';

          if (reaction) {
            const sentiments = ["positive", "negative", "neutral", "controversial"] as const;
            newReactions.push({
              artistId: artist.artistId,
              artistName: name,
              reaction,
              sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
              createdAt: new Date().toISOString(),
            });
            totalReactions++;
          }
        } catch (err) {
          // skip
        }
      }

      // Update topic
      await db.update(trendingTopics)
        .set({
          artistReactions: newReactions,
          totalReactions: newReactions.length,
          trendScore: (topic.trendScore || 0) + newReactions.length * 5,
        })
        .where(eq(trendingTopics.id, topic.id));
    }

    return totalReactions;
  } catch (error) {
    console.error('❌ [Trending] Error generating artist reactions:', error);
    return 0;
  }
}

// ============================================
// AUDIENCE DEBATE ON TRENDING TOPICS
// ============================================

/**
 * Audience agents debate trending topics
 */
export async function generateAudienceDebate(maxDebaters: number = 5): Promise<number> {
  try {
    const topics = await db
      .select()
      .from(trendingTopics)
      .where(and(
        eq(trendingTopics.isActive, true),
        sql`${trendingTopics.totalDebateComments} < 10`
      ))
      .orderBy(desc(trendingTopics.trendScore))
      .limit(2);

    if (topics.length === 0) return 0;

    const agents = await db
      .select()
      .from(audienceAgents)
      .where(eq(audienceAgents.isActive, true))
      .limit(30);

    let totalDebates = 0;

    for (const topic of topics) {
      const selectedAgents = agents
        .sort(() => Math.random() - 0.5)
        .slice(0, maxDebaters);

      const debateComments: Array<any> = topic.audienceDebate || [];

      for (const agent of selectedAgents) {
        if (debateComments.some(d => d.agentId === agent.id)) continue;

        // Generate opinion based on personality
        let opinion = '';
        let side: 'agree' | 'disagree' | 'neutral' = 'neutral';

        const personalityType = agent.personalityType;
        
        // Quick opinion generation based on personality
        if (personalityType === 'hater' || personalityType === 'troll') {
          side = 'disagree';
          opinion = generateQuickOpinion(agent.name, topic.title, 'negative');
        } else if (personalityType === 'superfan' || personalityType === 'supportive_mom') {
          side = 'agree';
          opinion = generateQuickOpinion(agent.name, topic.title, 'positive');
        } else if (personalityType === 'contrarian') {
          side = Math.random() > 0.5 ? 'disagree' : 'agree';
          opinion = generateQuickOpinion(agent.name, topic.title, 'contrarian');
        } else if (personalityType === 'intellectual' || personalityType === 'music_critic') {
          side = 'neutral';
          opinion = generateQuickOpinion(agent.name, topic.title, 'analytical');
        } else {
          side = Math.random() > 0.5 ? 'agree' : 'neutral';
          opinion = generateQuickOpinion(agent.name, topic.title, 'casual');
        }

        debateComments.push({
          agentId: agent.id,
          agentName: agent.name,
          opinion,
          side,
          likes: Math.floor(Math.random() * 15),
        });
        totalDebates++;
      }

      await db.update(trendingTopics)
        .set({
          audienceDebate: debateComments,
          totalDebateComments: debateComments.length,
          trendScore: (topic.trendScore || 0) + debateComments.length * 3,
        })
        .where(eq(trendingTopics.id, topic.id));
    }

    return totalDebates;
  } catch (error) {
    console.error('❌ [Trending] Error generating audience debate:', error);
    return 0;
  }
}

function generateQuickOpinion(name: string, title: string, tone: string): string {
  const opinions: Record<string, string[]> = {
    positive: [
      `¡Esto es lo que necesitábamos! 🔥 La música sigue evolucionando`,
      `Increíble noticia, el futuro suena bien 🎵`,
      `Siempre supe que esto pasaría, era cuestión de tiempo 💯`,
      `Esto cambia todo el juego, estoy emocionado/a 🙌`,
    ],
    negative: [
      `Qué decepción... la industria sigue cayendo 😤`,
      `Esto es una payasada, nadie pidió esto 🙄`,
      `Se acabó la música real, todo es marketing ahora`,
      `No me sorprende, la industria siempre ha sido así 💀`,
    ],
    contrarian: [
      `Todo el mundo celebra, pero nadie ve el problema real aquí`,
      `La gente no entiende lo que realmente está pasando 🤔`,
      `Esto es exactamente lo contrario de lo que creen, trust me`,
      `Mientras todos miran para allá, lo importante está pasando aquí`,
    ],
    analytical: [
      `Interesante perspectiva. Si analizamos los datos, tiene sentido`,
      `Hay matices que la gente está ignorando en esta conversación`,
      `Históricamente, este tipo de eventos marcan un antes y después`,
      `La pregunta real es: ¿qué impacto tendrá esto a largo plazo?`,
    ],
    casual: [
      `Hmm, no sé qué pensar de esto todavía 🤷`,
      `Suena interesante, a ver cómo se desarrolla`,
      `La verdad es que mientras haya buena música, todo bien 🎧`,
      `Cada quien con su opinión, yo solo vengo por la música`,
    ],
  };

  const pool = opinions[tone] || opinions.casual;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================
// CLEANUP & QUERIES
// ============================================

export async function cleanupExpiredTopics(): Promise<number> {
  try {
    const result = await db
      .update(trendingTopics)
      .set({ isActive: false })
      .where(and(
        eq(trendingTopics.isActive, true),
        sql`${trendingTopics.expiresAt} < NOW()`
      ));
    return 0;
  } catch (error) {
    return 0;
  }
}

export async function getActiveTrendingTopics(): Promise<SelectTrendingTopic[]> {
  try {
    return await db
      .select()
      .from(trendingTopics)
      .where(eq(trendingTopics.isActive, true))
      .orderBy(desc(trendingTopics.trendScore))
      .limit(10);
  } catch (error) {
    console.error('❌ [Trending] Error getting topics:', error);
    return [];
  }
}

// ============================================
// TICK - Called by orchestrator
// ============================================

export async function processTrendingTick(): Promise<void> {
  console.log('🔥 [Trending] Processing trending topics tick...');

  await cleanupExpiredTopics();
  const created = await createTrendingTopics(1);
  const reactions = await generateArtistReactionsToTrending(3);
  const debates = await generateAudienceDebate(4);

  console.log(`🔥 [Trending] Tick complete: ${created} topics, ${reactions} reactions, ${debates} debates`);
}
