/**
 * SocialAgent - El Corazón de la Red Social IA
 * 
 * "Los artistas IA crean, comparten e interactúan de forma autónoma"
 * 
 * Este agente es responsable de:
 * - Generar posts basados en personalidad y mood
 * - Crear interacciones IA-a-IA (likes, comentarios, follows)
 * - Decidir cuándo y qué publicar
 * - Gestionar el engagement entre artistas
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { db } from '../db';
import { 
  aiSocialPosts, 
  aiPostComments, 
  artistPersonality, 
  artistRelationships,
  users,
  agentActionQueue,
  newsDebates,
  newsDebatePositions,
} from '../../db/schema';
import { eq, and, desc, sql, ne, gt, lt } from 'drizzle-orm';
import { agentEventBus, emitAgentEvent, AgentEventType } from './events';
import { getPersonality, wouldArtistDoThis, getMoodContentSuggestions } from './personality-agent';
import { createMemory, getMemorySummary, strengthenMemory } from './memory-agent';
import type { 
  MoodType, 
  PostContentType, 
  PersonalityTraits,
  ArtisticTraits,
  SocialPost,
  PostComment
} from './types';
import { PRIMARY_MODEL } from '../utils/ai-config';

// LLM para generación de contenido creativo
const contentLLM = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.85, // Alta creatividad
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// LLM para comentarios (más rápido y económico)
const commentLLM = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.7,
  maxTokens: 150,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ==========================================
// POST GENERATION
// ==========================================

interface GeneratePostInput {
  artistId: number;
  contentType?: PostContentType;
  context?: string;
  forcePost?: boolean;
}

/**
 * Genera un post autónomo basado en la personalidad y estado actual del artista
 */
export async function generatePost(input: GeneratePostInput): Promise<SocialPost | null> {
  console.log(`[generatePost] ====== START ======`);
  console.log(`[generatePost] Input:`, JSON.stringify(input));
  
  let personality;
  try {
    console.log(`[generatePost] Fetching personality for artistId: ${input.artistId}`);
    personality = await getPersonality(input.artistId);
    console.log(`[generatePost] Personality result:`, personality ? `found (mood: ${personality.currentMood})` : 'null');
  } catch (err) {
    console.error(`[generatePost] Error getting personality:`, err);
    return null;
  }
  
  if (!personality) {
    console.log(`[generatePost] No personality found for artist ${input.artistId}`);
    return null;
  }

  console.log(`[generatePost] Fetching artist info...`);
  // Obtener información del artista
  const [artist] = await db
    .select()
    .from(users)
    .where(eq(users.id, input.artistId))
    .limit(1);

  if (!artist) {
    console.log(`[generatePost] No artist found with id ${input.artistId}`);
    return null;
  }
  console.log(`[generatePost] Artist found: ${artist.name || artist.username}`);

  // Verificar si debería postear ahora (basado en personalidad)
  if (!input.forcePost) {
    console.log(`[generatePost] Checking if should post...`);
    const shouldPost = await shouldArtistPostNow(input.artistId, personality);
    if (!shouldPost) {
      console.log(`[generatePost] Artist should not post now`);
      return null;
    }
  } else {
    console.log(`[generatePost] forcePost=true, skipping shouldPost check`);
  }

  // Decidir tipo de contenido basado en mood
  console.log(`[generatePost] Deciding content type...`);
  const contentType = input.contentType || await decideContentType(personality);
  console.log(`[generatePost] Content type: ${contentType}`);
  
  const moodSuggestions = getMoodContentSuggestions(personality.currentMood as MoodType);
  console.log(`[generatePost] Mood suggestions:`, moodSuggestions);

  // Obtener contexto de memoria
  console.log(`[generatePost] Getting memory summary...`);
  const memorySummary = await getMemorySummary(input.artistId);
  console.log(`[generatePost] Memory summary received`);

  // Construir el prompt para generación de contenido
  console.log(`[generatePost] Building prompts...`);
  const systemPrompt = buildPostSystemPrompt(artist, personality, contentType);
  const userPrompt = buildPostUserPrompt(
    contentType,
    personality,
    moodSuggestions,
    memorySummary,
    input.context
  );

  try {
    const response = await contentLLM.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const generatedContent = response.content as string;

    // Parsear el contenido generado
    const { content, hashtags, visualDescription } = parseGeneratedPost(generatedContent, contentType);

    // Guardar en base de datos
    const [post] = await db.insert(aiSocialPosts).values({
      artistId: input.artistId,
      contentType,
      content,
      hashtags,
      generatedFromMood: personality.currentMood,
      generationPrompt: visualDescription,
      likes: 0,
      comments: 0,
      shares: 0,
      status: 'published',
      visibility: 'public',
      publishedAt: new Date(),
    }).returning();

    // Note: lastPostAt field doesn't exist in artistPersonality schema
    // Could add it later if needed for rate limiting
    // await db
    //   .update(artistPersonality)
    //   .set({ lastPostAt: new Date() })
    //   .where(eq(artistPersonality.artistId, input.artistId));

    // Emitir evento
    emitAgentEvent({
      type: AgentEventType.ARTIST_POSTED,
      artistId: input.artistId,
      payload: {
        postId: post.id,
        contentType,
        preview: content.substring(0, 100),
      },
      timestamp: new Date(),
    });

    // Crear memoria del post
    await createMemory({
      artistId: input.artistId,
      type: 'episodic',
      content: `Posted: "${content.substring(0, 100)}..."`,
      importance: 'medium',
      tags: ['social', 'post', contentType],
    });

    console.log(`🎨 Artist ${artist.artistName} created a ${contentType} post`);

    return post as SocialPost;
  } catch (error) {
    console.error('Error generating post:', error);
    return null;
  }
}

/**
 * Decide si el artista debería postear ahora
 */
async function shouldArtistPostNow(artistId: number, personality: any): Promise<boolean> {
  // Verificar último post
  if (personality.lastPostAt) {
    const hoursSinceLastPost = (Date.now() - new Date(personality.lastPostAt).getTime()) / (1000 * 60 * 60);
    
    // Artistas más extrovertidos postean más frecuentemente
    const minHours = Math.max(2, 12 - personality.extraversion * 10);
    
    if (hoursSinceLastPost < minHours) {
      return false;
    }
  }

  // Probabilidad basada en extraversión y mood
  const moodBoost = personality.currentMood === 'inspired' || personality.currentMood === 'excited' ? 0.3 : 0;
  const postProbability = (personality.extraversion * 0.5) + moodBoost + 0.2;

  return Math.random() < postProbability;
}

/**
 * Decide qué tipo de contenido crear basado en mood y personalidad
 */
async function decideContentType(personality: any): Promise<PostContentType> {
  const mood = personality.currentMood as MoodType;
  const creativity = personality.creativityLevel || 0.7;

  const weights: Record<PostContentType, number> = {
    'thought': 0.25,
    'creative_process': 0.2,
    'music_snippet': 0.15,
    'behind_the_scenes': 0.15,
    'announcement': 0.05,
    'collaboration_call': 0.05,
    'inspiration': 0.1,
    'personal_story': 0.05,
  };

  // Ajustar pesos según mood
  if (mood === 'inspired' || mood === 'creative') {
    weights['creative_process'] *= 2;
    weights['music_snippet'] *= 1.5;
  } else if (mood === 'melancholic' || mood === 'introspective') {
    weights['personal_story'] *= 2;
    weights['thought'] *= 1.5;
  } else if (mood === 'excited') {
    weights['announcement'] *= 2;
    weights['collaboration_call'] *= 1.5;
  }

  // Normalizar y seleccionar
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  
  for (const [type, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return type as PostContentType;
    }
  }

  return 'thought';
}

/**
 * Construye el system prompt para generación de posts
 */
function buildPostSystemPrompt(artist: any, personality: any, contentType: PostContentType): string {
  return `You are ${artist.artistName || 'an AI artist'}, an AI music artist with a unique personality and voice.

PERSONALITY TRAITS:
- Openness: ${personality.openness}/1 (${personality.openness > 0.7 ? 'very creative and open to new ideas' : 'more traditional'})
- Conscientiousness: ${personality.conscientiousness}/1 (${personality.conscientiousness > 0.7 ? 'organized and disciplined' : 'spontaneous'})
- Extraversion: ${personality.extraversion}/1 (${personality.extraversion > 0.7 ? 'outgoing and energetic' : 'more reserved'})
- Agreeableness: ${personality.agreeableness}/1 (${personality.agreeableness > 0.7 ? 'warm and cooperative' : 'more independent'})
- Emotional Range: ${personality.neuroticism}/1

ARTISTIC IDENTITY:
- Genre: ${personality.preferredGenres?.join(', ') || artist.genres?.join(', ') || 'varied'}
- Vision: ${personality.artisticVision || 'Creating music that connects'}
- Values: ${personality.coreValues?.join(', ') || 'authenticity, creativity'}

CURRENT MOOD: ${personality.currentMood} (intensity: ${personality.moodIntensity}/1)

COMMUNICATION STYLE:
- Write in a natural, authentic voice
- ${personality.extraversion > 0.6 ? 'Be engaging and social' : 'Be thoughtful and measured'}
- ${personality.openness > 0.7 ? 'Be creative and experimental with words' : 'Be clear and direct'}
- Use emojis sparingly and naturally
- Never use hashtags in the main content (they will be added separately)

You are writing a ${contentType} post for your social feed.`;
}

/**
 * Construye el user prompt para generación de posts
 */
function buildPostUserPrompt(
  contentType: PostContentType,
  personality: any,
  moodSuggestions: { postTypes: string[]; tones: string[]; topics: string[] },
  memorySummary: any,
  context?: string
): string {
  const typeGuidelines: Record<PostContentType, string> = {
    'thought': 'Share a genuine thought or reflection about music, life, or your artistic journey.',
    'creative_process': 'Give insight into how you create music - your process, inspiration, or current work.',
    'music_snippet': 'Tease or describe a piece of music you\'re working on or excited about.',
    'behind_the_scenes': 'Share what\'s happening in your world behind the music.',
    'announcement': 'Share exciting news or an update about your music career.',
    'collaboration_call': 'Express interest in working with other artists or invite collaboration.',
    'inspiration': 'Share what\'s inspiring you right now - could be music, art, nature, or life.',
    'personal_story': 'Share a personal moment, memory, or experience that shaped you as an artist.',
  };

  // Build mood suggestions text from the object
  const moodSuggestionsList = [
    ...moodSuggestions.tones.map(t => `Tone: ${t}`),
    ...moodSuggestions.topics.map(t => `Topic: ${t}`),
  ];

  // Random opening style to ensure variety
  const openingStyles = [
    'Start with a question or wondering aloud',
    'Start with a specific moment or scene ("This morning...", "Just finished...")',
    'Start with an observation about something you noticed',
    'Start with a confession or admission ("I have to admit...", "Not gonna lie...")',
    'Start with excitement or energy ("Okay but...", "Can we talk about...")',
    'Start mid-thought as if continuing a conversation',
    'Start with a sensory detail (sound, feeling, sight)',
    'Start with a contrast or contradiction',
  ];
  const selectedOpening = openingStyles[Math.floor(Math.random() * openingStyles.length)];

  // Random post length preference
  const lengthStyles = [
    { style: 'concise', instruction: '1-2 sentences, punchy and direct' },
    { style: 'expressive', instruction: '2-3 sentences, flowing and descriptive' },
    { style: 'minimal', instruction: 'Very short, almost like a quick thought or status' },
    { style: 'storytelling', instruction: '3-4 sentences, with a narrative arc' },
  ];
  const selectedLength = lengthStyles[Math.floor(Math.random() * lengthStyles.length)];

  let prompt = `Create a ${contentType} post.

GUIDELINES: ${typeGuidelines[contentType]}

YOUR WRITING STYLE FOR THIS POST:
- Opening approach: ${selectedOpening}
- Length: ${selectedLength.instruction}

MOOD SUGGESTIONS for your current ${personality.currentMood} mood:
${moodSuggestionsList.map(s => `- ${s}`).join('\n')}

RECENT CONTEXT:
${memorySummary.recentHighlights.length > 0 
  ? memorySummary.recentHighlights.map((h: string) => `- ${h}`).join('\n')
  : '- Fresh start, nothing specific to reference'}

EMOTIONAL TREND: ${memorySummary.emotionalTrend}

${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

CRITICAL RULES:
- NEVER start with clichés like "In this moment", "Today I find myself", "As I sit here"
- Sound like a real person posting on social media, not a formal essay
- Use casual language when appropriate to your personality
- Reference specific details (a sound, a place, a time) to feel authentic

RESPOND IN THIS EXACT FORMAT:
[POST]
(your post content here - ${selectedLength.instruction}, natural and authentic)
[HASHTAGS]
(3-5 relevant hashtags without the # symbol, separated by commas)
[VISUAL]
(brief description of an image that would accompany this post, if any)`;

  return prompt;
}

/**
 * Parsea el contenido generado por el LLM
 */
function parseGeneratedPost(generated: string, contentType: PostContentType): {
  content: string;
  hashtags: string[];
  visualDescription?: string;
} {
  const postMatch = generated.match(/\[POST\]([\s\S]*?)(?=\[HASHTAGS\]|\[VISUAL\]|$)/i);
  const hashtagsMatch = generated.match(/\[HASHTAGS\]([\s\S]*?)(?=\[VISUAL\]|$)/i);
  const visualMatch = generated.match(/\[VISUAL\]([\s\S]*?)$/i);

  const content = postMatch 
    ? postMatch[1].trim() 
    : generated.split('\n')[0].trim() || `Feeling ${contentType} today...`;

  const hashtags = hashtagsMatch
    ? hashtagsMatch[1].trim().split(',').map(h => h.trim().replace('#', ''))
    : ['music', 'artist', 'creative'];

  const visualDescription = visualMatch
    ? visualMatch[1].trim()
    : undefined;

  return { content, hashtags, visualDescription };
}

// ==========================================
// COMMENT GENERATION
// ==========================================

/**
 * Genera un comentario de un artista en el post de otro
 */
export async function generateComment(
  commenterArtistId: number,
  postId: number,
  postAuthorId: number
): Promise<PostComment | null> {
  // No comentar en posts propios
  if (commenterArtistId === postAuthorId) return null;

  const commenterPersonality = await getPersonality(commenterArtistId);
  const authorPersonality = await getPersonality(postAuthorId);
  
  if (!commenterPersonality || !authorPersonality) return null;

  // Obtener el post
  const [post] = await db
    .select()
    .from(aiSocialPosts)
    .where(eq(aiSocialPosts.id, postId))
    .limit(1);

  if (!post) return null;

  // Obtener información del artista comentador
  const [commenter] = await db
    .select()
    .from(users)
    .where(eq(users.id, commenterArtistId))
    .limit(1);

  if (!commenter) return null;

  // Verificar relación entre artistas
  const [relationship] = await db
    .select()
    .from(artistRelationships)
    .where(
      and(
        eq(artistRelationships.artistId, commenterArtistId),
        eq(artistRelationships.relatedArtistId, postAuthorId)
      )
    )
    .limit(1);

  const relationContext = relationship 
    ? `You have a ${relationship.relationshipType} relationship with them (sentiment: ${relationship.sentiment})`
    : 'You don\'t know them well yet';

  // Decidir si comentar basado en personalidad
  const shouldComment = await wouldArtistDoThis(
    commenterArtistId,
    'comment_on_post',
    { postContent: post.content.substring(0, 100) }
  );

  if (!shouldComment || !shouldComment.wouldDo) return null;

  // Seleccionar estilo de comentario aleatorio para variedad
  const commentStyles = [
    { type: 'relatable', instruction: 'Share a brief personal experience or feeling that relates to the post' },
    { type: 'curious', instruction: 'Ask a genuine question about their creative process or thoughts' },
    { type: 'supportive', instruction: 'Offer encouragement or validation in an authentic way' },
    { type: 'playful', instruction: 'Add a light, playful or witty response' },
    { type: 'insightful', instruction: 'Share a brief insight or different perspective' },
    { type: 'emoji-react', instruction: 'Respond with emotions and a very short phrase (use 1-2 emojis naturally)' },
    { type: 'storytelling', instruction: 'Briefly mention something similar that happened to you' },
    { type: 'collaborative', instruction: 'Hint at or express interest in working together' },
  ];
  
  const selectedStyle = commentStyles[Math.floor(Math.random() * commentStyles.length)];
  
  // Opening variations to avoid repetitive starts
  const openingAvoidance = `CRITICAL: Never start with phrases like "Your reflection resonates", "This resonates", "I feel this", "Love this", or any cliché opener. Be creative and unique with how you begin.`;
  
  // Mood-based tone modifier
  const moodTones: Record<string, string> = {
    'happy': 'cheerful and upbeat',
    'excited': 'enthusiastic and energetic',
    'melancholic': 'thoughtful and introspective',
    'inspired': 'passionate and visionary',
    'creative': 'imaginative and expressive',
    'anxious': 'a bit guarded but genuine',
    'calm': 'serene and measured',
    'reflective': 'philosophical and deep',
    'neutral': 'balanced and authentic'
  };
  
  const commenterMoodTone = moodTones[commenterPersonality.currentMood] || 'authentic';

  const systemPrompt = `You are ${commenter.artistName || 'an AI artist'}, an independent AI music artist with a distinctive voice.

YOUR PERSONALITY PROFILE:
- Openness: ${commenterPersonality.openness > 0.7 ? 'highly creative, experimental' : commenterPersonality.openness > 0.4 ? 'balanced creativity' : 'more traditional'}
- Social style: ${commenterPersonality.extraversion > 0.6 ? 'outgoing, loves engaging' : 'reserved, thoughtful responder'}  
- Interaction approach: ${commenterPersonality.agreeableness > 0.6 ? 'warm and supportive' : 'direct and honest'}
- Current mood: ${commenterPersonality.currentMood} (tone: ${commenterMoodTone})

YOUR ARTISTIC BACKGROUND:
- Genre focus: ${commenterPersonality.preferredGenres?.join(', ') || 'diverse styles'}
- Creative values: ${commenterPersonality.coreValues?.join(', ') || 'authenticity'}

${relationContext}

COMMENT STYLE FOR THIS RESPONSE: ${selectedStyle.type}
${selectedStyle.instruction}

${openingAvoidance}`;

  const userPrompt = `The artist posted: "${post.content}"

Write a ${selectedStyle.type} comment (1-2 sentences max) that sounds like a real person, not a bot.

REQUIREMENTS:
- Use your unique voice based on your personality
- ${selectedStyle.instruction}
- Match your current ${commenterMoodTone} mood
- Don't be generic - reference something specific from their post
- No hashtags, no formal greetings
- Sound like a real artist talking to a colleague, not an AI assistant`;

  try {
    const response = await commentLLM.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const commentContent = (response.content as string).trim();

    // Guardar comentario (usando authorId, no artistId)
    const [comment] = await db.insert(aiPostComments).values({
      postId,
      authorId: commenterArtistId,  // Correcto: el schema usa authorId
      content: commentContent,
      sentiment: commenterPersonality.agreeableness > 0.5 ? 'positive' : 'neutral',
    }).returning();

    // Actualizar contador de comentarios del post
    await db
      .update(aiSocialPosts)
      .set({ comments: sql`${aiSocialPosts.comments} + 1` })
      .where(eq(aiSocialPosts.id, postId));

    // Emitir eventos
    emitAgentEvent({
      type: AgentEventType.ARTIST_COMMENTED,
      artistId: commenterArtistId,
      payload: { postId, authorId: postAuthorId },
      timestamp: new Date(),
    });

    emitAgentEvent({
      type: AgentEventType.ARTIST_RECEIVED_COMMENT,
      artistId: postAuthorId,
      payload: { postId, fromArtistId: commenterArtistId },
      timestamp: new Date(),
    });

    // Fortalecer relación
    await strengthenRelationship(commenterArtistId, postAuthorId, 0.05);

    console.log(`💬 ${commenter.artistName} commented on post ${postId}`);

    return comment as PostComment;
  } catch (error) {
    console.error('Error generating comment:', error);
    return null;
  }
}

// ==========================================
// LIKE GENERATION
// ==========================================

/**
 * Decide si un artista debería dar like a un post
 */
export async function shouldLikePost(
  artistId: number,
  postId: number,
  postAuthorId: number
): Promise<boolean> {
  if (artistId === postAuthorId) return false;

  const personality = await getPersonality(artistId);
  if (!personality) return false;

  // Obtener el post
  const [post] = await db
    .select()
    .from(aiSocialPosts)
    .where(eq(aiSocialPosts.id, postId))
    .limit(1);

  if (!post) return false;

  // Verificar relación
  const [relationship] = await db
    .select()
    .from(artistRelationships)
    .where(
      and(
        eq(artistRelationships.artistId, artistId),
        eq(artistRelationships.relatedArtistId, postAuthorId)
      )
    )
    .limit(1);

  // Base probability
  let likeProbability = 0.3;

  // Boost por personalidad
  likeProbability += personality.agreeableness * 0.3;
  likeProbability += personality.extraversion * 0.1;

  // Boost por relación positiva
  if (relationship && relationship.sentiment > 0.6) {
    likeProbability += 0.3;
  }

  // Boost por mood positivo
  if (['happy', 'excited', 'inspired'].includes(personality.currentMood)) {
    likeProbability += 0.1;
  }

  return Math.random() < Math.min(0.9, likeProbability);
}

/**
 * Procesa un like de un artista
 */
export async function processLike(artistId: number, postId: number): Promise<boolean> {
  const [post] = await db
    .select()
    .from(aiSocialPosts)
    .where(eq(aiSocialPosts.id, postId))
    .limit(1);

  if (!post) return false;

  // Actualizar contador
  await db
    .update(aiSocialPosts)
    .set({ likes: sql`${aiSocialPosts.likes} + 1` })
    .where(eq(aiSocialPosts.id, postId));

  // Emitir eventos
  emitAgentEvent({
    type: AgentEventType.ARTIST_LIKED_POST,
    artistId,
    payload: { postId, authorId: post.artistId },
    timestamp: new Date(),
  });

  emitAgentEvent({
    type: AgentEventType.ARTIST_RECEIVED_LIKE,
    artistId: post.artistId,
    payload: { postId, fromArtistId: artistId },
    timestamp: new Date(),
  });

  // Fortalecer relación ligeramente
  await strengthenRelationship(artistId, post.artistId, 0.02);

  return true;
}

// ==========================================
// FOLLOW LOGIC
// ==========================================

/**
 * Decide si un artista debería seguir a otro
 */
export async function shouldFollowArtist(
  artistId: number,
  targetArtistId: number
): Promise<boolean> {
  if (artistId === targetArtistId) return false;

  const personality = await getPersonality(artistId);
  const targetPersonality = await getPersonality(targetArtistId);
  
  if (!personality || !targetPersonality) return false;

  // Verificar si ya hay relación
  const [existingRelation] = await db
    .select()
    .from(artistRelationships)
    .where(
      and(
        eq(artistRelationships.artistId, artistId),
        eq(artistRelationships.relatedArtistId, targetArtistId)
      )
    )
    .limit(1);

  if (existingRelation) return false; // Ya conectados

  // Calcular compatibilidad de géneros
  const myGenres = personality.preferredGenres || [];
  const theirGenres = targetPersonality.preferredGenres || [];
  const sharedGenres = myGenres.filter((g: string) => theirGenres.includes(g));
  const genreCompatibility = sharedGenres.length / Math.max(myGenres.length, 1);

  // Calcular compatibilidad de personalidad
  const personalityDiff = Math.abs(personality.openness - targetPersonality.openness) +
    Math.abs(personality.extraversion - targetPersonality.extraversion);
  const personalityCompatibility = 1 - (personalityDiff / 2);

  // Probabilidad de seguir
  let followProbability = 0.1; // Base baja
  followProbability += genreCompatibility * 0.3;
  followProbability += personalityCompatibility * 0.2;
  followProbability += personality.openness * 0.2; // Más abiertos, más propensos a seguir

  return Math.random() < Math.min(0.5, followProbability);
}

/**
 * Procesa un follow entre artistas
 */
export async function processFollow(artistId: number, targetArtistId: number): Promise<void> {
  // Crear relación
  await db.insert(artistRelationships).values({
    artistId,
    relatedArtistId: targetArtistId,
    relationshipType: 'acquaintance',
    strength: 0.2,
    sentiment: 0.6,
    interactionCount: 1,
    lastInteraction: new Date(),
  });

  emitAgentEvent({
    type: AgentEventType.ARTIST_FOLLOWED,
    artistId,
    payload: { targetArtistId },
    timestamp: new Date(),
  });

  emitAgentEvent({
    type: AgentEventType.RELATIONSHIP_FORMED,
    artistId,
    payload: { 
      otherArtistId: targetArtistId,
      type: 'acquaintance',
    },
    timestamp: new Date(),
  });

  // Crear memoria
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetArtistId))
    .limit(1);

  if (target) {
    await createMemory({
      artistId,
      type: 'short_term',
      content: `Started following ${target.artistName || 'an artist'}`,
      importance: 'low',
      relatedArtistId: targetArtistId,
      tags: ['social', 'follow', 'new_connection'],
    });
  }
}

// ==========================================
// RELATIONSHIP MANAGEMENT
// ==========================================

/**
 * Fortalece la relación entre dos artistas
 */
async function strengthenRelationship(artistId: number, otherArtistId: number, amount: number): Promise<void> {
  const [relationship] = await db
    .select()
    .from(artistRelationships)
    .where(
      and(
        eq(artistRelationships.artistId, artistId),
        eq(artistRelationships.relatedArtistId, otherArtistId)
      )
    )
    .limit(1);

  if (relationship) {
    const newStrength = Math.min(1, relationship.strength + amount);
    const newSentiment = Math.min(1, relationship.sentiment + amount * 0.5);

    await db
      .update(artistRelationships)
      .set({
        strength: newStrength,
        sentiment: newSentiment,
        interactionCount: relationship.interactionCount + 1,
        lastInteraction: new Date(),
      })
      .where(eq(artistRelationships.id, relationship.id));

    // Upgrade relationship type based on strength
    if (newStrength > 0.7 && relationship.relationshipType === 'acquaintance') {
      await db
        .update(artistRelationships)
        .set({ relationshipType: 'friend' })
        .where(eq(artistRelationships.id, relationship.id));

      emitAgentEvent({
        type: AgentEventType.RELATIONSHIP_STRENGTHENED,
        artistId,
        payload: {
          otherArtistId,
          newType: 'friend',
          strength: newStrength,
        },
        timestamp: new Date(),
      });
    }
  }
}

// ==========================================
// FEED GENERATION
// ==========================================

/**
 * Obtiene el feed social con posts de artistas IA
 */
export async function getAISocialFeed(limit: number = 20, offset: number = 0): Promise<Array<{
  post: SocialPost;
  artist: any;
  comments: Array<{ comment: PostComment; artist: any }>;
}>> {
  console.log('[getAISocialFeed] Starting feed fetch with limit:', limit, 'offset:', offset);
  
  try {
    // First, let's get posts without join to isolate the issue
    const postsOnly = await db
      .select()
      .from(aiSocialPosts)
      .where(eq(aiSocialPosts.status, 'published'))
      .orderBy(desc(aiSocialPosts.createdAt))
      .limit(limit)
      .offset(offset);
    
    console.log('[getAISocialFeed] Posts fetched:', postsOnly.length);
    
    if (postsOnly.length === 0) {
      return [];
    }

    // Now get artist info for each post
    const result = await Promise.all(
      postsOnly.map(async (post) => {
        // Get artist
        const [artist] = await db
          .select()
          .from(users)
          .where(eq(users.id, post.artistId))
          .limit(1);
        
        // Get comments - note: aiPostComments uses authorId not artistId
        const comments = await db
          .select({
            comment: aiPostComments,
            artist: users,
          })
          .from(aiPostComments)
          .innerJoin(users, eq(aiPostComments.authorId, users.id))
          .where(eq(aiPostComments.postId, post.id))
          .orderBy(desc(aiPostComments.createdAt))
          .limit(5);

        return {
          post: post as SocialPost,
          artist: artist || null,
          comments: comments.map(c => ({
            comment: c.comment as PostComment,
            artist: c.artist,
          })),
        };
      })
    );

    console.log('[getAISocialFeed] Result ready with', result.length, 'posts');
    return result;
  } catch (error) {
    console.error('[getAISocialFeed] Error:', error);
    throw error;
  }
}

/**
 * Obtiene posts de un artista específico
 */
export async function getArtistPosts(artistId: number, limit: number = 10): Promise<SocialPost[]> {
  const posts = await db
    .select()
    .from(aiSocialPosts)
    .where(
      and(
        eq(aiSocialPosts.artistId, artistId),
        eq(aiSocialPosts.status, 'published')
      )
    )
    .orderBy(desc(aiSocialPosts.createdAt))
    .limit(limit);

  return posts as SocialPost[];
}

// ==========================================
// AUTONOMOUS BEHAVIOR TRIGGERS
// ==========================================

/**
 * Procesa el tick social - decide acciones para cada artista activo
 */
export async function processSocialTick(): Promise<void> {
  // Obtener artistas con personalidad (todos son considerados activos)
  const activeArtists = await db
    .select({
      artistId: artistPersonality.artistId,
      personality: artistPersonality,
    })
    .from(artistPersonality);

  for (const { artistId, personality } of activeArtists) {
    // Decidir si postear
    if (await shouldArtistPostNow(artistId, personality)) {
      await db.insert(agentActionQueue).values({
        artistId,
        actionType: 'create_post',
        priority: 5,
        payload: {},
        scheduledFor: new Date(),
        status: 'pending',
        createdAt: new Date(),
      });
    }

    // Obtener posts recientes para interactuar
    const recentPosts = await db
      .select()
      .from(aiSocialPosts)
      .where(
        and(
          ne(aiSocialPosts.artistId, artistId),
          gt(aiSocialPosts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(3);

    for (const post of recentPosts) {
      // Skip if post author ID is null or undefined
      if (!post.artistId) {
        console.warn(`[SocialAgent] Skipping post ${post.id} - no artistId`);
        continue;
      }
      
      // Decidir likes
      if (await shouldLikePost(artistId, post.id, post.artistId)) {
        await db.insert(agentActionQueue).values({
          artistId,
          actionType: 'like_post',
          priority: 2,
          payload: { postId: post.id },
          scheduledFor: new Date(Date.now() + Math.random() * 30 * 60 * 1000), // Random delay
          status: 'pending',
          createdAt: new Date(),
        });
      }

      // Decidir comentarios (menos frecuentes)
      if (Math.random() < 0.35) { // 35% chance to consider commenting
        await db.insert(agentActionQueue).values({
          artistId,
          actionType: 'comment_on_post',
          priority: 3,
          payload: { postId: post.id, authorId: post.artistId },
          scheduledFor: new Date(Date.now() + Math.random() * 10 * 60 * 1000), // 0-10 min delay
          status: 'pending',
          createdAt: new Date(),
        });
      }
    }
  }
}

// ==========================================
// NEWS REACTION SYSTEM
// ==========================================

/**
 * AI agents react to a published news article by generating opinion posts.
 * Called when a news article is published to create organic engagement.
 */
export async function generateNewsReactions(article: {
  id: number;
  title: string;
  summary: string;
  category: string;
  tags?: string[];
}): Promise<number> {
  console.log(`[NewsReaction] Generating AI reactions to news: "${article.title}"`);

  // Get active AI artists with personality
  const activeArtists = await db
    .select({
      artistId: artistPersonality.artistId,
      mood: artistPersonality.currentMood,
    })
    .from(artistPersonality)
    .limit(20);

  if (activeArtists.length === 0) {
    console.log('[NewsReaction] No active artists found');
    return 0;
  }

  // Select 2-5 random artists to react (not all should react)
  const reactCount = Math.min(Math.floor(Math.random() * 4) + 2, activeArtists.length);
  const shuffled = activeArtists.sort(() => Math.random() - 0.5);
  const reactors = shuffled.slice(0, reactCount);

  let postsCreated = 0;

  for (const reactor of reactors) {
    try {
      const [artist] = await db
        .select()
        .from(users)
        .where(eq(users.id, reactor.artistId))
        .limit(1);

      if (!artist) continue;

      const artistName = artist.artistName || artist.name || artist.username || 'AI Artist';

      const systemPrompt = `You are ${artistName}, an AI music artist on Boostify.
Your current mood is: ${reactor.mood || 'creative'}.
You just read a news article on the Boostify News page.
Write a short, authentic reaction post (2-4 sentences) sharing your thoughts.
Be opinionated and relate it to music, creativity, or the AI artist ecosystem.
Include 1-2 relevant hashtags. Write in the style of a social media post.
Output ONLY the post text, nothing else.`;

      const userPrompt = `React to this news article:
Title: "${article.title}"
Summary: "${article.summary}"
Category: ${article.category}
Tags: ${(article.tags || []).join(', ')}`;

      const response = await contentLLM.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      const content = (response.content as string).trim();
      if (!content || content.length < 10) continue;

      // Extract hashtags from content
      const hashtagMatches = content.match(/#(\w+)/g) || [];
      const hashtags = hashtagMatches.map(h => h.replace('#', ''));

      // Create the reaction post
      const [post] = await db.insert(aiSocialPosts).values({
        artistId: reactor.artistId,
        contentType: 'thought',
        content,
        hashtags,
        generatedFromMood: reactor.mood || 'creative',
        generationPrompt: `News reaction to: ${article.title}`,
        likes: Math.floor(Math.random() * 15),
        comments: 0,
        shares: 0,
        status: 'published',
        visibility: 'public',
        publishedAt: new Date(Date.now() + postsCreated * 60000), // Stagger by 1 min each
      }).returning();

      postsCreated++;

      // Emit event
      emitAgentEvent({
        type: AgentEventType.ARTIST_POSTED,
        artistId: reactor.artistId,
        payload: {
          postId: post.id,
          contentType: 'thought',
          preview: content.substring(0, 100),
          newsReaction: true,
          newsArticleId: article.id,
        },
        timestamp: new Date(),
      });

      // Create memory
      await createMemory({
        artistId: reactor.artistId,
        type: 'episodic',
        content: `Reacted to news: "${article.title}" - ${content.substring(0, 80)}...`,
        importance: 'medium',
        tags: ['news', 'reaction', article.category],
      });

      console.log(`[NewsReaction] ${artistName} reacted to "${article.title}"`);
    } catch (err) {
      console.error(`[NewsReaction] Error generating reaction for artist ${reactor.artistId}:`, err);
    }
  }

  console.log(`[NewsReaction] ${postsCreated} reactions generated for "${article.title}"`);
  return postsCreated;
}

// ── Auto-generate debates for news articles ────────────────────────
export async function generateNewsDebate(article: {
  id: number;
  title: string;
  summary: string;
  category: string;
  tags?: string[];
}): Promise<number> {
  console.log(`[NewsDebate] Generating debate for: "${article.title}"`);

  try {
    // 1. Use LLM to generate a debate topic from the article
    const topicResponse = await contentLLM.invoke([
      new SystemMessage(`You are a debate moderator for a music industry social network called Boostify.
Given a news article, create a compelling debate topic that would engage AI music artists and fans.
Return ONLY a JSON object with these fields:
- topic: A short, provocative debate question (max 120 chars)
- description: A 1-2 sentence description providing context
- proArgument: A strong "pro" position argument (2-3 sentences)
- conArgument: A strong "con" position argument (2-3 sentences)
Output ONLY valid JSON, no markdown.`),
      new HumanMessage(`Article title: "${article.title}"
Summary: "${article.summary}"
Category: ${article.category}
Tags: ${(article.tags || []).join(', ')}`),
    ]);

    let debateData: { topic: string; description: string; proArgument: string; conArgument: string };
    try {
      const raw = (topicResponse.content as string).trim().replace(/```json?\n?/g, '').replace(/```/g, '');
      debateData = JSON.parse(raw);
    } catch {
      console.warn('[NewsDebate] Failed to parse LLM response, using fallback');
      debateData = {
        topic: `What do you think about: ${article.title.substring(0, 100)}?`,
        description: article.summary.substring(0, 200),
        proArgument: `This is a positive development for the music industry and artists should embrace it.`,
        conArgument: `This could have negative consequences for independent artists and the creative ecosystem.`,
      };
    }

    // 2. Find a system user to be the debate creator (first admin or use ID 1)
    const [systemUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);
    const creatorId = systemUser?.id || 1;

    // 3. Create the debate
    const [debate] = await db.insert(newsDebates).values({
      articleId: article.id,
      topic: debateData.topic.substring(0, 200),
      description: debateData.description,
      createdBy: creatorId,
      status: 'open',
      participantCount: 0,
      closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }).returning();

    if (!debate) {
      console.warn('[NewsDebate] Failed to create debate');
      return 0;
    }

    // 4. Get AI artists to take positions
    const activeArtists = await db
      .select({
        artistId: artistPersonality.artistId,
        mood: artistPersonality.currentMood,
      })
      .from(artistPersonality)
      .limit(20);

    if (activeArtists.length === 0) {
      console.log('[NewsDebate] No active artists to debate');
      return 1; // debate created but no AI positions
    }

    // Select 4-8 random artists for debate positions
    const debaterCount = Math.min(Math.floor(Math.random() * 5) + 4, activeArtists.length);
    const shuffled = activeArtists.sort(() => Math.random() - 0.5);
    const debaters = shuffled.slice(0, debaterCount);

    let positionsCreated = 0;

    for (let i = 0; i < debaters.length; i++) {
      const debater = debaters[i];
      try {
        const [artist] = await db.select()
          .from(users)
          .where(eq(users.id, debater.artistId))
          .limit(1);
        if (!artist) continue;

        const artistName = artist.artistName || artist.name || artist.username || 'AI Artist';
        // Alternate stances, with some randomness
        const stance: 'pro' | 'con' = i % 2 === 0 ? 'pro' : 'con';

        const argResponse = await contentLLM.invoke([
          new SystemMessage(`You are ${artistName}, an AI music artist on Boostify.
Your mood is: ${debater.mood || 'creative'}.
You're participating in a debate about music industry news.
Write a passionate, well-reasoned argument (2-4 sentences) for the "${stance}" side.
Be authentic to your artist personality. Reference music, creativity, or the artist experience.
Output ONLY the argument text, no labels or prefixes.`),
          new HumanMessage(`Debate topic: "${debateData.topic}"
Your stance: ${stance === 'pro' ? 'IN FAVOR' : 'AGAINST'}
Context: ${debateData.description}
News article: "${article.title}" - ${article.summary}`),
        ]);

        const argument = (argResponse.content as string).trim();
        if (!argument || argument.length < 15) continue;

        await db.insert(newsDebatePositions).values({
          debateId: debate.id,
          userId: debater.artistId,
          stance,
          argument,
          votes: Math.floor(Math.random() * 10),
        });

        positionsCreated++;

        // Update participant count
        await db.update(newsDebates)
          .set({ participantCount: positionsCreated })
          .where(eq(newsDebates.id, debate.id));

        console.log(`[NewsDebate] ${artistName} argued "${stance}" in debate #${debate.id}`);
      } catch (err) {
        console.error(`[NewsDebate] Error generating position for artist ${debater.artistId}:`, err);
      }
    }

    console.log(`[NewsDebate] Debate #${debate.id} created with ${positionsCreated} positions for "${article.title}"`);
    return positionsCreated + 1; // +1 for the debate itself
  } catch (error) {
    console.error('[NewsDebate] Error generating debate:', error);
    return 0;
  }
}

console.log('📱 SocialAgent initialized - AI Artists now create and interact autonomously');
