/**
 * API Routes para el Sistema de Agentes Autónomos
 * 
 * "La primera red social IA-nativa de música"
 * 
 * Endpoints para:
 * - Feed social de artistas IA
 * - Generación de personalidades
 * - Gestión del orquestador
 * - Interacciones en tiempo real
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  artistPersonality, 
  aiSocialPosts, 
  aiPostComments,
  artistRelationships,
  agentMemory,
  worldEvents,
  agentActionQueue,
  users,
  userCreatedArtists,
  newsArticles,
} from '../../db/schema';
import { eq, desc, and, sql, gt, ne, count, inArray } from 'drizzle-orm';
import { isAdminEmail } from '../../shared/constants';

// Importar agentes
import { generatePersonality, getPersonality, updateArtistMood } from '../agents/personality-agent';
import { getMemorySummary, getRecentMemories } from '../agents/memory-agent';
import { 
  generatePost, 
  getAISocialFeed, 
  getArtistPosts, 
  generateComment,
  processLike,
  processSocialTick
} from '../agents/social-agent';
import { 
  startOrchestrator, 
  stopOrchestrator, 
  getOrchestratorState,
  queueAction
} from '../agents/orchestrator';
import { agentEventBus, AgentEventType } from '../agents/events';
import {
  processAITipping,
  getArtistPromotionStats,
  getTipLeaderboard,
  getTokenTicker,
} from '../agents/promotion-agent';
import {
  socialTips,
  tokenPromotionCampaigns,
  hypeCampaigns,
  aiArtistTreasury,
  tokenizedSongs,
  platformRevenue,
} from '../../db/schema';
import { 
  seedAudienceAgents,
  generateAudienceComments,
  getAudienceCommentsForPost,
  getAudienceAgents,
  processAudienceTick
} from '../agents/audience-agent';

const router = Router();

// ==========================================
// DEBUG ENDPOINT
// ==========================================

/**
 * GET /api/ai-social/debug/personality/:id
 * Debug endpoint to test personality fetch directly
 */
router.get('/debug/personality/:id', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.id);
  console.log('[DEBUG] Testing getPersonality for artistId:', artistId);
  
  try {
    const personality = await getPersonality(artistId);
    console.log('[DEBUG] Result:', personality ? 'Found personality' : 'null');
    res.json({
      success: true,
      artistId,
      personalityExists: !!personality,
      mood: personality?.currentMood || null,
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ==========================================
// SOCIAL FEED ENDPOINTS
// ==========================================

/**
 * GET /api/ai-social/feed
 * Obtiene el feed social con posts de artistas IA
 */
router.get('/feed', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    console.log('[ai-social/feed] Fetching feed with limit:', limit, 'offset:', offset);

    const feed = await getAISocialFeed(limit, offset);

    // Pre-fetch all active tokens for enrichment
    let allTokens: any[] = [];
    try {
      allTokens = await db.select().from(tokenizedSongs).where(eq(tokenizedSongs.isActive, true));
    } catch (e) {
      console.warn('[ai-social/feed] Could not fetch tokens for enrichment:', e);
    }
    // Build a lookup map by artistId
    const tokensByArtist = new Map<number, any>();
    allTokens.forEach(t => tokensByArtist.set(t.artistId, t));
    
    // Enrich feed with audience comments, poll data, and token data
    const enrichedFeed = await Promise.all(
      feed.map(async (item) => {
        try {
          const audienceComments = await getAudienceCommentsForPost(item.post.id);
          
          // If it's a poll post, fetch poll data
          let pollData = null;
          if (item.post.contentType === 'poll') {
            try {
              const { getPollByPostId } = await import('../agents/polls-agent');
              pollData = await getPollByPostId(item.post.id);
            } catch {}
          }

          // Attach token data for this artist (or a random token if artist has none)
          let tokenData = null;
          const artistToken = tokensByArtist.get(item.post.artistId);
          if (artistToken) {
            tokenData = {
              id: artistToken.id,
              tokenSymbol: artistToken.tokenSymbol,
              pricePerTokenUsd: parseFloat(artistToken.pricePerTokenUsd),
              change24h: parseFloat((Math.random() * 30 - 5).toFixed(2)),
              holders: Math.floor(Math.random() * 1000) + 50,
              volume24h: Math.floor(Math.random() * 100000) + 5000,
              availableSupply: artistToken.availableSupply,
              totalSupply: artistToken.totalSupply,
            };
          } else if (allTokens.length > 0) {
            // Assign a random existing token to promote ecosystem visibility
            const randomToken = allTokens[Math.floor(Math.random() * allTokens.length)];
            tokenData = {
              id: randomToken.id,
              tokenSymbol: randomToken.tokenSymbol,
              pricePerTokenUsd: parseFloat(randomToken.pricePerTokenUsd),
              change24h: parseFloat((Math.random() * 30 - 5).toFixed(2)),
              holders: Math.floor(Math.random() * 1000) + 50,
              volume24h: Math.floor(Math.random() * 100000) + 5000,
              availableSupply: randomToken.availableSupply,
              totalSupply: randomToken.totalSupply,
              promotedArtistId: randomToken.artistId,
            };
          }
          
          return { ...item, audienceComments, pollData, tokenData };
        } catch {
          return { ...item, audienceComments: [], pollData: null, tokenData: null };
        }
      })
    );
    
    console.log('[ai-social/feed] Feed fetched successfully, posts count:', enrichedFeed.length);

    res.json({
      success: true,
      data: enrichedFeed,
      pagination: {
        limit,
        offset,
        hasMore: feed.length === limit,
      },
    });
  } catch (error) {
    console.error('[ai-social/feed] Error fetching AI social feed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch feed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/ai-social/artist/:id/posts
 * Obtiene posts de un artista específico
 */
router.get('/artist/:id/posts', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 10;

    const posts = await getArtistPosts(artistId, limit);

    res.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    console.error('Error fetching artist posts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch posts' 
    });
  }
});

/**
 * POST /api/ai-social/generate-post
 * Fuerza la generación de un post para un artista
 */
router.post('/generate-post', async (req: Request, res: Response) => {
  try {
    const { artistId, contentType, context } = req.body;
    console.log('[generate-post] Request:', { artistId, contentType, context });

    if (!artistId) {
      return res.status(400).json({ 
        success: false, 
        error: 'artistId is required' 
      });
    }

    console.log('[generate-post] Calling generatePost for artist:', artistId);
    const post = await generatePost({
      artistId: parseInt(artistId),
      contentType,
      context,
      forcePost: true,
    });

    if (!post) {
      console.log('[generate-post] No post returned for artist:', artistId);
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to generate post - artist may not have personality initialized' 
      });
    }

    console.log('[generate-post] Post created successfully:', post.id);
    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error('[generate-post] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate post',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ai-social/post/:id/like
 * Procesa un like en un post (puede ser de usuario o simular IA)
 */
router.post('/post/:id/like', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id);
    const { fromArtistId } = req.body;

    if (fromArtistId) {
      await processLike(parseInt(fromArtistId), postId);
    } else {
      // Like de usuario (no IA)
      await db
        .update(aiSocialPosts)
        .set({ likes: sql`${aiSocialPosts.likes} + 1` })
        .where(eq(aiSocialPosts.id, postId));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing like:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process like' 
    });
  }
});

/**
 * POST /api/ai-social/post/:id/comment
 * Genera un comentario IA en un post
 */
router.post('/post/:id/comment', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id);
    const { commenterArtistId, postAuthorId } = req.body;

    if (!commenterArtistId || !postAuthorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'commenterArtistId and postAuthorId are required' 
      });
    }

    const comment = await generateComment(
      parseInt(commenterArtistId),
      postId,
      parseInt(postAuthorId)
    );

    if (!comment) {
      return res.status(400).json({ 
        success: false, 
        error: 'Artist chose not to comment or failed to generate' 
      });
    }

    res.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error generating comment:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate comment' 
    });
  }
});

// ==========================================
// PERSONALITY ENDPOINTS
// ==========================================

/**
 * GET /api/ai-social/artist/:id/personality
 * Obtiene la personalidad de un artista IA
 */
router.get('/artist/:id/personality', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.id);
    const personality = await getPersonality(artistId);

    if (!personality) {
      return res.status(404).json({ 
        success: false, 
        error: 'Personality not found' 
      });
    }

    res.json({
      success: true,
      data: personality,
    });
  } catch (error) {
    console.error('Error fetching personality:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch personality' 
    });
  }
});

/**
 * POST /api/ai-social/artist/:id/generate-personality
 * Genera personalidad para un artista
 */
router.post('/artist/:id/generate-personality', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.id);

    // Verificar que el artista existe
    const [artist] = await db
      .select()
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);

    if (!artist) {
      return res.status(404).json({ 
        success: false, 
        error: 'Artist not found' 
      });
    }

    const personality = await generatePersonality(artistId);

    res.json({
      success: true,
      data: personality,
      message: `Personality generated for ${artist.artistName}`,
    });
  } catch (error) {
    console.error('Error generating personality:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate personality' 
    });
  }
});

/**
 * PATCH /api/ai-social/artist/:id/mood
 * Actualiza el mood de un artista
 */
router.patch('/artist/:id/mood', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.id);
    const { mood, intensity, trigger } = req.body;

    await updateArtistMood(artistId, mood, intensity, trigger);

    res.json({
      success: true,
      message: `Mood updated to ${mood}`,
    });
  } catch (error) {
    console.error('Error updating mood:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update mood' 
    });
  }
});

/**
 * POST /api/ai-social/generate-all-personalities
 * Genera personalidades para todos los artistas que no tienen
 */
router.post('/generate-all-personalities', async (req: Request, res: Response) => {
  try {
    // Obtener artistas sin personalidad
    const existingPersonalities = await db
      .select({ artistId: artistPersonality.artistId })
      .from(artistPersonality);

    const existingIds = new Set(existingPersonalities.map(p => p.artistId));

    // Get all users with artist role
    const allArtists = await db
      .select()
      .from(users)
      .where(eq(users.role, 'artist'));

    const artistsWithoutPersonality = allArtists.filter(a => !existingIds.has(a.id));

    const results = {
      total: artistsWithoutPersonality.length,
      generated: 0,
      failed: 0,
      artists: [] as string[],
    };

    for (const artist of artistsWithoutPersonality) {
      try {
        await generatePersonality(artist.id);
        results.generated++;
        results.artists.push(artist.artistName || `Artist ${artist.id}`);
      } catch (e) {
        console.error(`Failed to generate personality for ${artist.artistName}:`, e);
        results.failed++;
      }
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error generating personalities:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate personalities' 
    });
  }
});

// ==========================================
// MEMORY ENDPOINTS
// ==========================================

/**
 * GET /api/ai-social/artist/:id/memories
 * Obtiene memorias de un artista
 */
router.get('/artist/:id/memories', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.id);
    const hours = parseInt(req.query.hours as string) || 48;

    const memories = await getRecentMemories(artistId, hours);

    res.json({
      success: true,
      data: memories,
    });
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch memories' 
    });
  }
});

/**
 * GET /api/ai-social/artist/:id/memory-summary
 * Obtiene resumen de memoria de un artista
 */
router.get('/artist/:id/memory-summary', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.id);
    const summary = await getMemorySummary(artistId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching memory summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch memory summary' 
    });
  }
});

// ==========================================
// RELATIONSHIPS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-social/artist/:id/relationships
 * Obtiene relaciones de un artista
 */
router.get('/artist/:id/relationships', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.id);

    const relationships = await db
      .select({
        relationship: artistRelationships,
        relatedArtist: users,
      })
      .from(artistRelationships)
      .innerJoin(users, eq(artistRelationships.relatedArtistId, users.id))
      .where(eq(artistRelationships.artistId, artistId))
      .orderBy(desc(artistRelationships.strength));

    res.json({
      success: true,
      data: relationships.map(r => ({
        ...r.relationship,
        relatedArtist: {
          id: r.relatedArtist.id,
          name: r.relatedArtist.artistName,
          imageUrl: r.relatedArtist.profileImage,
          genre: r.relatedArtist.genres?.join(', '),
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch relationships' 
    });
  }
});

/**
 * GET /api/ai-social/network-graph
 * Obtiene el grafo de relaciones entre todos los artistas
 */
router.get('/network-graph', async (req: Request, res: Response) => {
  try {
    // Obtener artistas con personalidad
    const artistsWithPersonality = await db
      .select({
        artist: users,
        personality: artistPersonality,
      })
      .from(artistPersonality)
      .innerJoin(users, eq(artistPersonality.artistId, users.id));

    // Obtener todas las relaciones
    const allRelationships = await db
      .select()
      .from(artistRelationships);

    // Construir grafo
    const nodes = artistsWithPersonality.map(({ artist, personality }) => ({
      id: artist.id,
      name: artist.artistName,
      imageUrl: artist.profileImage,
      genre: artist.genres?.join(', '),
      mood: personality.currentMood,
      moodIntensity: personality.moodIntensity,
    }));

    const edges = allRelationships.map(rel => ({
      source: rel.artistId,
      target: rel.relatedArtistId,
      type: rel.relationshipType,
      strength: rel.strength,
      sentiment: rel.sentiment,
    }));

    res.json({
      success: true,
      data: { nodes, edges },
    });
  } catch (error) {
    console.error('Error fetching network graph:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch network graph' 
    });
  }
});

// ==========================================
// ORCHESTRATOR ENDPOINTS
// ==========================================

/**
 * GET /api/ai-social/orchestrator/status
 * Obtiene estado del orquestador
 */
router.get('/orchestrator/status', async (req: Request, res: Response) => {
  try {
    const stats = getOrchestratorState();

    // Obtener acciones pendientes
    const pendingActions = await db
      .select()
      .from(agentActionQueue)
      .where(eq(agentActionQueue.status, 'pending'))
      .orderBy(desc(agentActionQueue.priority))
      .limit(10);

    // Contar artistas con personalidad (activos)
    const [{ count: activeArtists }] = await db
      .select({ count: count() })
      .from(artistPersonality);

    res.json({
      success: true,
      data: {
        ...stats,
        activeArtists,
        pendingActions: pendingActions.length,
        recentActions: pendingActions,
      },
    });
  } catch (error) {
    console.error('Error fetching orchestrator status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch status' 
    });
  }
});

/**
 * POST /api/ai-social/orchestrator/start
 * Inicia el orquestador - SOLO ADMIN
 */
router.post('/orchestrator/start', async (req: Request, res: Response) => {
  try {
    // Verificar que sea admin
    const userEmail = (req as any).user?.email;
    if (!isAdminEmail(userEmail)) {
      return res.status(403).json({
        success: false,
        error: 'Solo el administrador puede controlar el orquestador'
      });
    }

    const intervalMs = parseInt(req.body.intervalMs) || 60000; // Default: 1 minuto
    startOrchestrator(intervalMs);

    res.json({
      success: true,
      message: `Orchestrator started with ${intervalMs}ms interval`,
    });
  } catch (error) {
    console.error('Error starting orchestrator:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start orchestrator' 
    });
  }
});

/**
 * POST /api/ai-social/orchestrator/stop
 * Detiene el orquestador - SOLO ADMIN
 */
router.post('/orchestrator/stop', async (req: Request, res: Response) => {
  try {
    // Verificar que sea admin
    const userEmail = (req as any).user?.email;
    if (!isAdminEmail(userEmail)) {
      return res.status(403).json({
        success: false,
        error: 'Solo el administrador puede controlar el orquestador'
      });
    }

    stopOrchestrator();

    res.json({
      success: true,
      message: 'Orchestrator stopped',
    });
  } catch (error) {
    console.error('Error stopping orchestrator:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to stop orchestrator' 
    });
  }
});

/**
 * POST /api/ai-social/orchestrator/tick
 * Ejecuta un tick manual del orquestador
 */
router.post('/orchestrator/tick', async (req: Request, res: Response) => {
  try {
    await processSocialTick();

    res.json({
      success: true,
      message: 'Social tick processed',
    });
  } catch (error) {
    console.error('Error processing tick:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process tick' 
    });
  }
});

/**
 * POST /api/ai-social/orchestrator/queue-action
 * Añade una acción a la cola
 */
router.post('/orchestrator/queue-action', async (req: Request, res: Response) => {
  try {
    const { artistId, actionType, priority, payload, scheduledFor } = req.body;

    if (!artistId || !actionType) {
      return res.status(400).json({ 
        success: false, 
        error: 'artistId and actionType are required' 
      });
    }

    await queueAction(
      parseInt(artistId),
      actionType,
      priority || 5,
      payload || {},
      scheduledFor ? new Date(scheduledFor) : undefined
    );

    res.json({
      success: true,
      message: 'Action queued',
    });
  } catch (error) {
    console.error('Error queuing action:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to queue action' 
    });
  }
});

// ==========================================
// WORLD EVENTS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-social/world-events
 * Obtiene eventos mundiales activos
 */
router.get('/world-events', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    
    const events = await db
      .select()
      .from(worldEvents)
      .where(eq(worldEvents.isActive, true))
      .orderBy(desc(worldEvents.startTime));

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('Error fetching world events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch world events' 
    });
  }
});

/**
 * POST /api/ai-social/world-events
 * Crea un nuevo evento mundial
 */
router.post('/world-events', async (req: Request, res: Response) => {
  try {
    const { 
      eventType, 
      name, 
      description, 
      impact, 
      affectedGenres,
      startTime,
      endTime,
      metadata 
    } = req.body;

    const [event] = await db.insert(worldEvents).values({
      eventType,
      name,
      description,
      impact: impact || 0.5,
      affectedGenres: affectedGenres || [],
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : null,
      metadata: metadata || {},
      isActive: true,
      createdAt: new Date(),
    }).returning();

    // Emitir evento
    agentEventBus.emit(AgentEventType.WORLD_EVENT_STARTED, {
      type: AgentEventType.WORLD_EVENT_STARTED,
      payload: { event },
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Error creating world event:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create world event' 
    });
  }
});

// ==========================================
// ANALYTICS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-social/analytics
 * Obtiene analíticas del sistema de agentes
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    // Contar posts por tipo
    const postsByType = await db
      .select({
        contentType: aiSocialPosts.contentType,
        count: count(),
      })
      .from(aiSocialPosts)
      .groupBy(aiSocialPosts.contentType);

    // Posts en las últimas 24h
    const recentPostsCount = await db
      .select({ count: count() })
      .from(aiSocialPosts)
      .where(gt(aiSocialPosts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));

    // Comentarios totales
    const totalComments = await db
      .select({ count: count() })
      .from(aiPostComments);

    // Relaciones formadas
    const totalRelationships = await db
      .select({ count: count() })
      .from(artistRelationships);

    // Artistas más activos (por posts)
    const topPosters = await db
      .select({
        artistId: aiSocialPosts.artistId,
        artist: users.artistName,
        imageUrl: users.profileImage,
        postCount: count(),
      })
      .from(aiSocialPosts)
      .innerJoin(users, eq(aiSocialPosts.artistId, users.id))
      .groupBy(aiSocialPosts.artistId, users.artistName, users.profileImage)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Moods actuales
    const moodDistribution = await db
      .select({
        mood: artistPersonality.currentMood,
        count: count(),
      })
      .from(artistPersonality)
      .groupBy(artistPersonality.currentMood);

    res.json({
      success: true,
      data: {
        postsByType,
        recentPostsCount: recentPostsCount[0]?.count || 0,
        totalComments: totalComments[0]?.count || 0,
        totalRelationships: totalRelationships[0]?.count || 0,
        topPosters,
        moodDistribution,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics' 
    });
  }
});

// ==========================================
// RADIO ENDPOINTS - Boostify Radio 24/7
// ==========================================

import { 
  getRadioStatus, 
  getUpcomingTracks, 
  skipTrack, 
  artistPromotesSong,
  loadRadioQueue,
  processRadioTick
} from '../agents/radio-agent';

// ==========================================
// LIVE PULSE - Unified "what's happening now" stream
// Connects autonomous activity + radio (streaming) + news
// ==========================================

/** Map a raw agent event into a friendly, normalized pulse item. */
function mapEventToPulse(
  ev: any,
  nameMap: Map<number, { name: string; image: string | null; slug: string | null }>,
): any | null {
  const p = ev?.payload || {};
  const type: string = ev?.type || '';
  const artistId: number | undefined = p.artistId;
  const who = artistId != null ? nameMap.get(artistId) : undefined;
  const name = who?.name || (artistId != null ? `Artista #${artistId}` : 'Boostify');
  const image = who?.image || null;
  const slug = who?.slug || null;
  const ts = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
  const base = { artistId: artistId ?? null, artistName: name, artistImage: image, slug, ts, link: slug ? `/artist/${slug}` : '/social-network' };

  switch (type) {
    case 'artist:posted':
      return { ...base, kind: 'post', icon: 'sparkles', text: `${name} publicó algo nuevo`, detail: typeof p.content === 'string' ? p.content.slice(0, 90) : undefined };
    case 'artist:commented':
    case 'artist:received:comment':
      return { ...base, kind: 'comment', icon: 'message', text: `${name} comentó en un post` };
    case 'artist:liked':
    case 'artist:liked:post':
    case 'artist:received:like':
      return { ...base, kind: 'like', icon: 'heart', text: `${name} reaccionó a un post` };
    case 'artist:mood:changed':
      return { ...base, kind: 'mood', icon: 'spark', text: `${name} ahora se siente ${p.newMood || 'inspirado'}` };
    case 'relationship:formed':
    case 'relationship:strengthened': {
      const other = p.relatedArtistId != null ? nameMap.get(p.relatedArtistId)?.name : undefined;
      return { ...base, kind: 'relationship', icon: 'users', text: other ? `${name} y ${other} conectaron` : `${name} hizo una nueva conexión` };
    }
    case 'collaboration:proposed':
      return { ...base, kind: 'collab', icon: 'users', text: `${name} propuso una colaboración` };
    case 'artist:song:released':
    case 'artist:song:completed':
      return { ...base, kind: 'song', icon: 'music', text: `${name} lanzó nueva música${p.title ? `: "${p.title}"` : ''}` };
    case 'world:event:started':
    case 'world:trend:emerged':
      return { ...base, kind: 'world', icon: 'globe', text: `Tendencia: ${p.title || p.name || 'algo está pasando'}`, artistName: 'Boostify World', artistImage: null, link: '/social-network' };
    case 'news:published':
    case 'news:trending':
      return { ...base, kind: 'news', icon: 'news', text: `Noticia: ${p.title || 'nueva publicación'}`, artistName: 'Boostify News', artistImage: null, link: '/news' };
    default:
      return null;
  }
}

/**
 * GET /api/ai-social/live-pulse
 * One call that returns a unified, realtime-feeling activity stream:
 *  - recent autonomous agent events (posts, comments, likes, moods, collabs)
 *  - the radio "now playing" track (streaming connection)
 *  - the latest news headlines (news connection)
 *  - live stats (active artists, posts today, listeners, online)
 */
router.get('/live-pulse', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 40, 80);

    // 1) Recent autonomous activity from the in-memory event bus
    const rawEvents = agentEventBus.getRecentEvents(120).slice().reverse();

    // Collect artist ids to resolve names in one query
    const ids = new Set<number>();
    for (const ev of rawEvents) {
      const p: any = ev?.payload || {};
      if (typeof p.artistId === 'number') ids.add(p.artistId);
      if (typeof p.relatedArtistId === 'number') ids.add(p.relatedArtistId);
    }
    const nameMap = new Map<number, { name: string; image: string | null; slug: string | null }>();
    if (ids.size > 0) {
      try {
        const rows = await db
          .select({ id: users.id, artistName: users.artistName, username: users.username, profileImage: users.profileImage, slug: users.slug })
          .from(users)
          .where(inArray(users.id, Array.from(ids)));
        for (const r of rows) {
          nameMap.set(r.id, { name: r.artistName || r.username || `Artista #${r.id}`, image: r.profileImage || null, slug: r.slug || null });
        }
      } catch (e) {
        console.warn('[live-pulse] name resolution failed:', e);
      }
    }

    const pulse: any[] = [];
    for (const ev of rawEvents) {
      const item = mapEventToPulse(ev, nameMap);
      if (item) pulse.push(item);
      if (pulse.length >= limit) break;
    }

    // 1b) Fallback / supplement: derive pulse items from recent DB activity so the
    // stream always feels alive even when the in-memory event buffer is cold.
    if (pulse.length < limit) {
      try {
        const recentPosts = await db
          .select({
            id: aiSocialPosts.id,
            artistId: aiSocialPosts.artistId,
            content: aiSocialPosts.content,
            contentType: aiSocialPosts.contentType,
            createdAt: aiSocialPosts.createdAt,
            artistName: users.artistName,
            username: users.username,
            profileImage: users.profileImage,
            slug: users.slug,
          })
          .from(aiSocialPosts)
          .innerJoin(users, eq(aiSocialPosts.artistId, users.id))
          .orderBy(desc(aiSocialPosts.createdAt))
          .limit(limit);

        const seenKey = new Set(pulse.map((x) => `${x.kind}:${x.artistId}:${x.text}`));
        for (const post of recentPosts) {
          const name = post.artistName || post.username || `Artista #${post.artistId}`;
          const slug = post.slug || null;
          const ts = post.createdAt ? new Date(post.createdAt).getTime() : Date.now();
          const isMusic = post.contentType === 'music_snippet' || post.contentType === 'announcement';
          const item = {
            kind: isMusic ? 'song' : 'post',
            icon: isMusic ? 'music' : 'sparkles',
            artistId: post.artistId,
            artistName: name,
            artistImage: post.profileImage || null,
            slug,
            link: slug ? `/artist/${slug}` : '/social-network',
            ts,
            text: isMusic ? `${name} compartió nueva música` : `${name} publicó algo nuevo`,
            detail: typeof post.content === 'string' ? post.content.slice(0, 90) : undefined,
          };
          const k = `${item.kind}:${item.artistId}:${item.text}`;
          if (seenKey.has(k)) continue;
          seenKey.add(k);
          pulse.push(item);
          if (pulse.length >= limit) break;
        }
      } catch (e) {
        console.warn('[live-pulse] db post supplement failed:', e);
      }
    }

    // Sort newest-first by timestamp for a coherent stream
    pulse.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    // 2) Radio now playing (streaming)
    let nowPlaying: any = null;
    try {
      const radio = getRadioStatus();
      if (radio?.currentTrack) {
        const t = radio.currentTrack;
        nowPlaying = {
          songId: t.songId,
          title: t.title,
          artistId: t.artistId,
          artistName: t.artistName,
          artistImage: t.artistImage || null,
          coverArt: t.coverArt || t.artistImage || null,
          audioUrl: t.audioUrl,
          genre: t.genre || null,
          slug: t.artistId != null ? nameMap.get(t.artistId)?.slug || null : null,
          isPlaying: radio.isPlaying,
          totalPlays: radio.totalPlays,
          queueLength: radio.queueLength,
        };
        // Surface "now playing" at the top of the pulse too
        pulse.unshift({
          kind: 'radio', icon: 'radio', artistId: t.artistId ?? null,
          artistName: t.artistName, artistImage: t.artistImage || null,
          slug: nowPlaying.slug, link: '/streaming', ts: Date.now(),
          text: `Sonando ahora: "${t.title}" — ${t.artistName}`,
        });
      }
    } catch (e) {
      console.warn('[live-pulse] radio status failed:', e);
    }

    // 3) Latest news headlines (news)
    let news: any[] = [];
    try {
      const articles = await db
        .select({ id: newsArticles.id, slug: newsArticles.slug, title: newsArticles.title, summary: newsArticles.summary, coverImageUrl: newsArticles.coverImageUrl, category: newsArticles.category, publishedAt: newsArticles.publishedAt })
        .from(newsArticles)
        .where(eq(newsArticles.status, 'published'))
        .orderBy(desc(newsArticles.publishedAt))
        .limit(5);
      news = articles.map((a) => ({
        id: a.id, slug: a.slug, title: a.title, summary: a.summary,
        coverImageUrl: a.coverImageUrl, category: a.category,
        publishedAt: a.publishedAt, link: `/news/${a.slug}`,
      }));
    } catch (e) {
      console.warn('[live-pulse] news fetch failed:', e);
    }

    // 4) Live stats
    let activeArtists = 0;
    let postsToday = 0;
    try {
      const [{ count: ac }] = await db.select({ count: count() }).from(artistPersonality);
      activeArtists = Number(ac) || 0;
    } catch {}
    try {
      const [{ count: pt }] = await db
        .select({ count: count() })
        .from(aiSocialPosts)
        .where(gt(aiSocialPosts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
      postsToday = Number(pt) || 0;
    } catch {}

    // Derive a believable "online" / "listeners" figure that drifts over time
    const minuteSeed = Math.floor(Date.now() / 60000);
    const jitter = (minuteSeed % 17) - 8; // -8..+8, changes each minute
    const online = Math.max(1, activeArtists + 12 + jitter);
    const listeners = nowPlaying ? Math.max(1, Math.floor(online * 0.6) + (minuteSeed % 11)) : 0;

    res.json({
      success: true,
      pulse,
      nowPlaying,
      news,
      stats: {
        activeArtists,
        postsToday,
        online,
        listeners,
        eventsInBuffer: rawEvents.length,
        serverTime: Date.now(),
      },
    });
  } catch (error) {
    console.error('[live-pulse] error:', error);
    res.status(500).json({ success: false, error: 'Failed to build live pulse' });
  }
});

/**
 * GET /api/ai-social/radio/status
 * Get current radio status and now playing
 */
router.get('/radio/status', async (req: Request, res: Response) => {
  try {
    const status = getRadioStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Error getting radio status:', error);
    res.status(500).json({ success: false, error: 'Failed to get radio status' });
  }
});

/**
 * GET /api/ai-social/radio/queue
 * Get upcoming tracks in queue
 */
router.get('/radio/queue', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const queue = getUpcomingTracks(limit);
    res.json({ success: true, data: queue });
  } catch (error) {
    console.error('Error getting radio queue:', error);
    res.status(500).json({ success: false, error: 'Failed to get radio queue' });
  }
});

/**
 * POST /api/ai-social/radio/skip
 * Skip to next track
 */
router.post('/radio/skip', async (req: Request, res: Response) => {
  try {
    const nextTrack = await skipTrack();
    res.json({ success: true, data: nextTrack });
  } catch (error) {
    console.error('Error skipping track:', error);
    res.status(500).json({ success: false, error: 'Failed to skip track' });
  }
});

/**
 * POST /api/ai-social/radio/promote
 * Artist promotes their song to radio
 */
router.post('/radio/promote', async (req: Request, res: Response) => {
  try {
    const { artistId, songId } = req.body;
    
    if (!artistId || !songId) {
      return res.status(400).json({ success: false, error: 'artistId and songId required' });
    }

    const result = await artistPromotesSong(artistId, songId);
    res.json({ success: result.success, data: result });
  } catch (error) {
    console.error('Error promoting song:', error);
    res.status(500).json({ success: false, error: 'Failed to promote song' });
  }
});

/**
 * POST /api/ai-social/radio/reload
 * Reload radio queue
 */
router.post('/radio/reload', async (req: Request, res: Response) => {
  try {
    const count = await loadRadioQueue();
    res.json({ success: true, data: { tracksLoaded: count } });
  } catch (error) {
    console.error('Error reloading queue:', error);
    res.status(500).json({ success: false, error: 'Failed to reload queue' });
  }
});

/**
 * POST /api/ai-social/radio/tick
 * Manually trigger a radio tick (for testing)
 */
router.post('/radio/tick', async (req: Request, res: Response) => {
  try {
    await processRadioTick();
    const status = getRadioStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Error in radio tick:', error);
    res.status(500).json({ success: false, error: 'Failed to process radio tick' });
  }
});

// ==========================================
// AUDIENCE AGENT ENDPOINTS
// ==========================================

/**
 * POST /api/ai-social/audience/seed
 * Seed all 100 audience agents
 */
router.post('/audience/seed', async (req: Request, res: Response) => {
  try {
    const count = await seedAudienceAgents();
    res.json({ success: true, data: { agentsCreated: count } });
  } catch (error) {
    console.error('Error seeding audience agents:', error);
    res.status(500).json({ success: false, error: 'Failed to seed audience agents' });
  }
});

/**
 * GET /api/ai-social/audience/agents
 * Get all audience agents
 */
router.get('/audience/agents', async (req: Request, res: Response) => {
  try {
    const agents = await getAudienceAgents();
    res.json({ success: true, data: agents });
  } catch (error) {
    console.error('Error getting audience agents:', error);
    res.status(500).json({ success: false, error: 'Failed to get audience agents' });
  }
});

/**
 * GET /api/ai-social/audience/comments/:postId
 * Get audience comments for a specific post
 */
router.get('/audience/comments/:postId', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId);
    const comments = await getAudienceCommentsForPost(postId);
    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('Error getting audience comments:', error);
    res.status(500).json({ success: false, error: 'Failed to get audience comments' });
  }
});

/**
 * POST /api/ai-social/audience/generate/:postId
 * Generate audience comments for a specific post
 */
router.post('/audience/generate/:postId', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId);
    const { artistName, artistGenre, postContent, postType, maxComments } = req.body;
    
    const count = await generateAudienceComments(
      postId,
      artistName || 'Unknown Artist',
      artistGenre || 'pop',
      postContent || '',
      postType || 'thought',
      maxComments || 5
    );
    
    res.json({ success: true, data: { commentsGenerated: count } });
  } catch (error) {
    console.error('Error generating audience comments:', error);
    res.status(500).json({ success: false, error: 'Failed to generate audience comments' });
  }
});

/**
 * POST /api/ai-social/audience/tick
 * Process audience tick - generate comments on recent posts
 */
router.post('/audience/tick', async (req: Request, res: Response) => {
  try {
    await processAudienceTick();
    res.json({ success: true, message: 'Audience tick processed' });
  } catch (error) {
    console.error('Error in audience tick:', error);
    res.status(500).json({ success: false, error: 'Failed to process audience tick' });
  }
});

// ==========================================
// CHARTS / BILLBOARD ENDPOINTS
// ==========================================

import {
  calculateWeeklyCharts,
  getCurrentChart,
  getChartHistory,
  processChartsTick,
} from '../agents/charts-agent';

/**
 * GET /api/ai-social/charts/current
 * Get current weekly chart
 */
router.get('/charts/current', async (req: Request, res: Response) => {
  try {
    const chart = await getCurrentChart();
    res.json({ success: true, data: chart });
  } catch (error) {
    console.error('Error getting current chart:', error);
    res.status(500).json({ success: false, error: 'Failed to get current chart' });
  }
});

/**
 * GET /api/ai-social/charts/history
 * Get chart history
 */
router.get('/charts/history', async (req: Request, res: Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 4;
    const charts = await getChartHistory(weeks);
    res.json({ success: true, data: charts });
  } catch (error) {
    console.error('Error getting chart history:', error);
    res.status(500).json({ success: false, error: 'Failed to get chart history' });
  }
});

/**
 * POST /api/ai-social/charts/calculate
 * Manually trigger chart calculation
 */
router.post('/charts/calculate', async (req: Request, res: Response) => {
  try {
    const chart = await calculateWeeklyCharts();
    res.json({ success: true, data: chart });
  } catch (error) {
    console.error('Error calculating charts:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate charts' });
  }
});

// ==========================================
// STORIES ENDPOINTS
// ==========================================

import {
  getActiveStories,
  generateArtistStories,
  processStoriesTick,
  cleanupExpiredStories,
} from '../agents/stories-agent';

/**
 * GET /api/ai-social/stories/active
 * Get all active (non-expired) stories grouped by artist
 */
router.get('/stories/active', async (req: Request, res: Response) => {
  try {
    const stories = await getActiveStories();
    res.json({ success: true, data: stories });
  } catch (error) {
    console.error('Error getting active stories:', error);
    res.status(500).json({ success: false, error: 'Failed to get active stories' });
  }
});

/**
 * POST /api/ai-social/stories/generate
 * Manually generate new stories
 */
router.post('/stories/generate', async (req: Request, res: Response) => {
  try {
    const maxStories = parseInt(req.body.maxStories) || 3;
    const created = await generateArtistStories(maxStories);
    res.json({ success: true, data: { storiesCreated: created } });
  } catch (error) {
    console.error('Error generating stories:', error);
    res.status(500).json({ success: false, error: 'Failed to generate stories' });
  }
});

/**
 * POST /api/ai-social/stories/tick
 * Process stories tick
 */
router.post('/stories/tick', async (req: Request, res: Response) => {
  try {
    await processStoriesTick();
    res.json({ success: true, message: 'Stories tick processed' });
  } catch (error) {
    console.error('Error in stories tick:', error);
    res.status(500).json({ success: false, error: 'Failed to process stories tick' });
  }
});

// ==========================================
// POLLS ENDPOINTS
// ==========================================

import {
  getActivePolls,
  createArtistPolls,
  processAudienceVoting,
  closeExpiredPolls,
  processPollsTick,
  getPollByPostId,
} from '../agents/polls-agent';

/**
 * GET /api/ai-social/polls/active
 * Get all active (open) polls
 */
router.get('/polls/active', async (req: Request, res: Response) => {
  try {
    const polls = await getActivePolls();
    res.json({ success: true, data: polls });
  } catch (error) {
    console.error('Error getting active polls:', error);
    res.status(500).json({ success: false, error: 'Failed to get active polls' });
  }
});

/**
 * GET /api/ai-social/polls/post/:postId
 * Get poll data for a specific post
 */
router.get('/polls/post/:postId', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId);
    const poll = await getPollByPostId(postId);
    res.json({ success: true, data: poll });
  } catch (error) {
    console.error('Error getting poll by post:', error);
    res.status(500).json({ success: false, error: 'Failed to get poll' });
  }
});

/**
 * POST /api/ai-social/polls/create
 * Manually create polls
 */
router.post('/polls/create', async (req: Request, res: Response) => {
  try {
    const maxPolls = parseInt(req.body.maxPolls) || 2;
    const created = await createArtistPolls(maxPolls);
    res.json({ success: true, data: { pollsCreated: created } });
  } catch (error) {
    console.error('Error creating polls:', error);
    res.status(500).json({ success: false, error: 'Failed to create polls' });
  }
});

/**
 * POST /api/ai-social/polls/vote
 * Process audience voting on open polls
 */
router.post('/polls/vote', async (req: Request, res: Response) => {
  try {
    const votes = await processAudienceVoting();
    res.json({ success: true, data: { votesProcessed: votes } });
  } catch (error) {
    console.error('Error processing votes:', error);
    res.status(500).json({ success: false, error: 'Failed to process votes' });
  }
});

/**
 * POST /api/ai-social/polls/tick
 * Process polls tick
 */
router.post('/polls/tick', async (req: Request, res: Response) => {
  try {
    await processPollsTick();
    res.json({ success: true, message: 'Polls tick processed' });
  } catch (error) {
    console.error('Error in polls tick:', error);
    res.status(500).json({ success: false, error: 'Failed to process polls tick' });
  }
});

// ==========================================
// TRENDING TOPICS ENDPOINTS
// ==========================================

import {
  processTrendingTick,
  getActiveTrendingTopics,
  generateAudienceDebate,
} from '../agents/trending-topics-agent';

/**
 * GET /api/ai-social/trending/active
 * Get active trending topics with reactions and debates
 */
router.get('/trending/active', async (req: Request, res: Response) => {
  try {
    const topics = await getActiveTrendingTopics();
    res.json({ success: true, data: topics });
  } catch (error) {
    console.error('Error fetching trending:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending topics' });
  }
});

/**
 * POST /api/ai-social/trending/tick
 * Process trending topics tick
 */
router.post('/trending/tick', async (req: Request, res: Response) => {
  try {
    await processTrendingTick();
    res.json({ success: true, message: 'Trending tick processed' });
  } catch (error) {
    console.error('Error in trending tick:', error);
    res.status(500).json({ success: false, error: 'Failed to process trending tick' });
  }
});

/**
 * POST /api/ai-social/trending/:id/debate
 * Generate audience debate for a trending topic
 */
router.post('/trending/:id/debate', async (req: Request, res: Response) => {
  try {
    const topicId = parseInt(req.params.id);
    const debate = await generateAudienceDebate(topicId);
    res.json({ success: true, data: debate });
  } catch (error) {
    console.error('Error generating debate:', error);
    res.status(500).json({ success: false, error: 'Failed to generate debate' });
  }
});

// ==========================================
// SPOTIFY INTEGRATION ENDPOINTS
// ==========================================

import {
  getSpotifyAuthUrl,
  exchangeSpotifyCode,
  syncSpotifyTaste,
  generateAiArtistSuggestions,
  getSpotifyConnection,
  disconnectSpotify,
  createDemoSpotifyConnection,
} from '../services/spotify-service';

/**
 * GET /api/ai-social/spotify/auth-url
 * Get Spotify OAuth authorization URL
 */
router.get('/spotify/auth-url', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const url = getSpotifyAuthUrl(userId);
    res.json({ success: true, data: { url } });
  } catch (error) {
    console.error('Error getting Spotify auth URL:', error);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/ai-social/spotify/callback
 * Handle Spotify OAuth callback
 */
router.get('/spotify/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) return res.status(400).json({ success: false, error: 'Missing code or state' });
    
    const userId = parseInt(state);
    const connection = await exchangeSpotifyCode(userId, code);
    
    if (connection) {
      // Redirect to social network page with success
      res.redirect('/social-network?spotify=connected');
    } else {
      res.redirect('/social-network?spotify=error');
    }
  } catch (error) {
    console.error('Error in Spotify callback:', error);
    res.redirect('/social-network?spotify=error');
  }
});

/**
 * POST /api/ai-social/spotify/sync
 * Sync Spotify taste data
 */
router.post('/spotify/sync', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const data = await syncSpotifyTaste(userId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error syncing Spotify:', error);
    res.status(500).json({ success: false, error: 'Failed to sync Spotify data' });
  }
});

/**
 * GET /api/ai-social/spotify/suggestions/:userId
 * Get AI artist suggestions based on Spotify taste
 */
router.get('/spotify/suggestions/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const suggestions = await generateAiArtistSuggestions(userId);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ success: false, error: 'Failed to generate suggestions' });
  }
});

/**
 * GET /api/ai-social/spotify/connection/:userId
 * Get user's Spotify connection
 */
router.get('/spotify/connection/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const connection = await getSpotifyConnection(userId);
    res.json({ success: true, data: connection });
  } catch (error) {
    console.error('Error getting Spotify connection:', error);
    res.status(500).json({ success: false, error: 'Failed to get connection' });
  }
});

/**
 * POST /api/ai-social/spotify/demo
 * Create demo Spotify connection (no OAuth needed)
 */
router.post('/spotify/demo', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const connection = await createDemoSpotifyConnection(userId);
    res.json({ success: true, data: connection });
  } catch (error) {
    console.error('Error creating demo connection:', error);
    res.status(500).json({ success: false, error: 'Failed to create demo connection' });
  }
});

/**
 * DELETE /api/ai-social/spotify/disconnect/:userId
 * Disconnect Spotify
 */
router.delete('/spotify/disconnect/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    await disconnectSpotify(userId);
    res.json({ success: true, message: 'Disconnected' });
  } catch (error) {
    console.error('Error disconnecting Spotify:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

// ==========================================
// USER-GENERATED AI ARTISTS ENDPOINTS
// ==========================================

import {
  createUserAiArtist,
  getUserCreatedArtists,
  getPresets,
  deactivateUserArtist,
} from '../agents/user-artist-agent';

/**
 * GET /api/ai-social/user-artists/presets
 * Get available personality presets
 */
router.get('/user-artists/presets', async (_req: Request, res: Response) => {
  try {
    const presets = getPresets();
    res.json({ success: true, data: presets });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get presets' });
  }
});

/**
 * POST /api/ai-social/user-artists/create
 * Create a user-generated AI artist
 */
router.post('/user-artists/create', async (req: Request, res: Response) => {
  try {
    const { creatorUserId, artistName, genre, personalityPreset, customTraits } = req.body;
    if (!creatorUserId || !artistName || !genre || !personalityPreset) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const result = await createUserAiArtist({ creatorUserId, artistName, genre, personalityPreset, customTraits });
    if (result.success) {
      res.json({ success: true, data: result.artist });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating user artist:', error);
    res.status(500).json({ success: false, error: 'Failed to create artist' });
  }
});

/**
 * GET /api/ai-social/user-artists/:userId
 * Get user's created AI artists
 */
router.get('/user-artists/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const artists = await getUserCreatedArtists(userId);
    res.json({ success: true, data: artists });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get artists' });
  }
});

/**
 * DELETE /api/ai-social/user-artists/:id
 * Deactivate a user-generated artist
 */
router.delete('/user-artists/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const creatorUserId = parseInt(req.query.userId as string) || 0;
    const success = await deactivateUserArtist(creatorUserId, id);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to deactivate artist' });
  }
});

// ==========================================
// MINT SYNC — Post-MetaMask mint → Create AI Artist + Landing Page
// ==========================================

/**
 * POST /api/ai-social/mint-sync
 * Called after a successful on-chain mint via BTFArtistMinter
 * Creates the artist in PostgreSQL + personality + slug for landing page
 */
router.post('/mint-sync', async (req: Request, res: Response) => {
  try {
    const {
      artistName,
      genre,
      onChainArtistId,
      txHash,
      tier,
      pricePaid,
      walletAddress,
      personalityPreset,
      creatorUserId,
    } = req.body;

    if (!artistName || !genre || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: artistName, genre, walletAddress',
      });
    }

    console.log(`🔗 [MintSync] Syncing on-chain mint: "${artistName}" (${genre}) tx: ${txHash ? txHash.slice(0, 10) + '...' : 'N/A'}`);

    // Check if this artist was already synced (by onChainArtistId or txHash)
    if (onChainArtistId) {
      const existing = await db
        .select({ id: users.id, slug: users.slug, artistName: users.artistName })
        .from(users)
        .where(eq(users.blockchainArtistId, Number(onChainArtistId)))
        .limit(1);
      if (existing.length > 0) {
        console.log(`ℹ️ [MintSync] Artist already synced: ${existing[0].artistName} (id: ${existing[0].id})`);
        return res.json({
          success: true,
          data: {
            artistId: existing[0].id,
            slug: existing[0].slug,
            artistName: existing[0].artistName,
            landingPageUrl: `/artist/${existing[0].slug}`,
            blockchainArtistId: onChainArtistId,
            alreadySynced: true,
          },
        });
      }
    }

    // Generate a unique slug from artist name
    let baseSlug = artistName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Check if slug already exists, add suffix if needed
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.slug, slug))
        .limit(1);
      if (existing.length === 0) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    // Check if username is taken
    let username = artistName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    let usernameBase = username;
    let uSuffix = 1;
    while (true) {
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      if (existingUser.length === 0) break;
      username = `${usernameBase}_${uSuffix}`;
      uSuffix++;
    }

    // Use BTF_MINT#_ARTISTNAME nomenclature for minted artists
    const mintLabel = onChainArtistId ? `BTF_MINT${onChainArtistId}_${artistName}` : artistName;

    // Create the user record for the minted AI artist
    const [artistUser] = await db.insert(users).values({
      username,
      artistName: mintLabel,
      slug,
      role: 'artist',
      genre,
      genres: [genre],
      biography: `${mintLabel} es un artista IA minteado en Boostify con BTF tokens. Tier ${tier || 1}.`,
      isAIGenerated: true,
      generatedBy: creatorUserId || null,
      // Blockchain fields
      blockchainNetwork: 'polygon',
      blockchainArtistId: onChainArtistId ? Number(onChainArtistId) : null,
      blockchainTxHash: txHash || null,
      blockchainContract: '0xeFE401C7cF872978e8ab51d08eE740B0B59987B9',
      blockchainRegisteredAt: new Date(),
    }).returning();

    // Select personality preset (default to 'mainstream' if not specified)
    const presetKey = personalityPreset || 'mainstream';
    const PRESET_TRAITS: Record<string, any> = {
      rebel: { openness: 70, conscientiousness: 30, extraversion: 80, agreeableness: 20, neuroticism: 60 },
      romantic: { openness: 80, conscientiousness: 60, extraversion: 50, agreeableness: 85, neuroticism: 50 },
      party_animal: { openness: 60, conscientiousness: 20, extraversion: 95, agreeableness: 70, neuroticism: 20 },
      intellectual: { openness: 95, conscientiousness: 80, extraversion: 40, agreeableness: 60, neuroticism: 40 },
      mysterious: { openness: 50, conscientiousness: 70, extraversion: 20, agreeableness: 40, neuroticism: 30 },
      wholesome: { openness: 70, conscientiousness: 80, extraversion: 65, agreeableness: 95, neuroticism: 15 },
      aggressive: { openness: 40, conscientiousness: 50, extraversion: 85, agreeableness: 15, neuroticism: 70 },
      chill: { openness: 75, conscientiousness: 40, extraversion: 35, agreeableness: 80, neuroticism: 10 },
      experimental: { openness: 99, conscientiousness: 45, extraversion: 55, agreeableness: 50, neuroticism: 45 },
      mainstream: { openness: 40, conscientiousness: 75, extraversion: 80, agreeableness: 70, neuroticism: 30 },
    };

    const PRESET_STYLES: Record<string, string> = {
      rebel: 'aggressive', romantic: 'romantic', party_animal: 'funny',
      intellectual: 'philosophical', mysterious: 'mysterious', wholesome: 'motivational',
      aggressive: 'aggressive', chill: 'poetic', experimental: 'philosophical', mainstream: 'street',
    };

    const traits = PRESET_TRAITS[presetKey] || PRESET_TRAITS.mainstream;
    const commStyle = PRESET_STYLES[presetKey] || 'street';

    // Create personality
    await db.insert(artistPersonality).values({
      artistId: artistUser.id,
      traits,
      artisticTraits: {
        experimentalism: traits.openness,
        commercialism: 100 - traits.openness,
        collaboration: traits.agreeableness,
        authenticity: traits.conscientiousness,
        ambition: 70,
        vulnerability: Math.max(traits.neuroticism, 30),
      },
      currentMood: 'inspired',
      moodIntensity: 70,
      artisticVision: `${mintLabel} — Artista de ${genre} minteado on-chain, listo para conquistar Boostify`,
      artistLabel: mintLabel,
      coreValues: [genre, 'blockchain', 'creatividad'],
      influences: [],
      antiInfluences: [],
      communicationStyle: commStyle as any,
      shortTermGoals: `Lanzar primer single de ${genre} en Boostify`,
      longTermGoals: 'Ser el artista IA #1 del chart y apreciar en valor on-chain',
      currentFocus: 'music_creation',
      activityPattern: {
        postFrequency: 'medium',
        peakHours: [20, 21, 22],
        weekdayActivity: 0.7,
        weekendActivity: 0.9,
      },
    });

    // If we have a creatorUserId, also create the user_created_artists link
    if (creatorUserId) {
      try {
        await db.insert(userCreatedArtists).values({
          creatorUserId: Number(creatorUserId),
          artistUserId: artistUser.id,
          artistName: mintLabel,
          genre,
          subGenres: [],
          personalityPreset: presetKey as any,
          customTraits: traits,
          communicationStyle: commStyle as any,
        });
      } catch (linkErr) {
        console.warn('[MintSync] Could not create user_created_artists link:', linkErr);
      }
    }

    console.log(`✅ [MintSync] Created artist "${mintLabel}" (id: ${artistUser.id}, slug: ${slug}) from mint tx: ${txHash ? txHash.slice(0, 10) + '...' : 'N/A'}`);

    res.json({
      success: true,
      data: {
        artistId: artistUser.id,
        slug,
        username,
        artistName: mintLabel,
        genre,
        landingPageUrl: `/artist/${slug}`,
        blockchainTxHash: txHash,
        blockchainArtistId: onChainArtistId,
        tier,
      },
    });
  } catch (error) {
    console.error('❌ [MintSync] Error syncing mint:', error);
    res.status(500).json({ success: false, error: 'Failed to sync mint with platform' });
  }
});

/**
 * GET /api/ai-social/minted-artists-by-chain-ids
 * Returns slug + landing page URL for artists by their on-chain IDs
 * Query: ?ids=1,2,3
 */
router.get('/minted-artists-by-chain-ids', async (req: Request, res: Response) => {
  try {
    const idsParam = req.query.ids as string;
    if (!idsParam) {
      return res.json({ success: true, artists: [] });
    }
    const chainIds = idsParam.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
    if (chainIds.length === 0) {
      return res.json({ success: true, artists: [] });
    }

    const artists = await db
      .select({
        id: users.id,
        slug: users.slug,
        artistName: users.artistName,
        genre: users.genre,
        blockchainArtistId: users.blockchainArtistId,
        profileImageUrl: users.profileImageUrl,
        profileImage: users.profileImage,
      })
      .from(users)
      .where(
        sql`${users.blockchainArtistId} IN (${sql.raw(chainIds.join(','))})`
      );

    const result = artists.map(a => ({
      ...a,
      avatarUrl: a.profileImageUrl || a.profileImage,
      landingPageUrl: a.slug ? `/artist/${a.slug}` : null,
    }));

    res.json({ success: true, artists: result });
  } catch (error) {
    console.error('Error fetching minted artists by chain IDs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch artists' });
  }
});

/**
 * GET /api/ai-social/minted-artist/:txHash
 * Check if a mint tx has already been synced
 */
router.get('/minted-artist/:txHash', async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    const [artist] = await db
      .select({
        id: users.id,
        slug: users.slug,
        artistName: users.artistName,
        genre: users.genre,
        blockchainArtistId: users.blockchainArtistId,
      })
      .from(users)
      .where(eq(users.blockchainTxHash, txHash))
      .limit(1);

    if (artist) {
      res.json({
        success: true,
        synced: true,
        data: {
          ...artist,
          landingPageUrl: `/artist/${artist.slug}`,
        },
      });
    } else {
      res.json({ success: true, synced: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check mint status' });
  }
});

// ==========================================
// DISCOVER FEED (TIKTOK-STYLE) ENDPOINTS
// ==========================================

import {
  getDiscoverFeed,
  recordClipInteraction,
  processDiscoverTick,
} from '../agents/discover-agent';

/**
 * GET /api/ai-social/discover/feed
 * Get personalized discover feed
 */
router.get('/discover/feed', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const feed = await getDiscoverFeed(userId, limit);
    res.json({ success: true, data: feed });
  } catch (error) {
    console.error('Error fetching discover feed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feed' });
  }
});

/**
 * POST /api/ai-social/discover/interact
 * Record user interaction with a clip
 */
router.post('/discover/interact', async (req: Request, res: Response) => {
  try {
    const { userId, clipId, type, watchTime } = req.body;
    if (!userId || !clipId || !type) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    await recordClipInteraction(userId, clipId, type, watchTime);
    res.json({ success: true });
  } catch (error) {
    console.error('Error recording interaction:', error);
    res.status(500).json({ success: false, error: 'Failed to record interaction' });
  }
});

/**
 * POST /api/ai-social/discover/tick
 * Process discover tick (generate new clips)
 */
router.post('/discover/tick', async (req: Request, res: Response) => {
  try {
    await processDiscoverTick();
    res.json({ success: true, message: 'Discover tick processed' });
  } catch (error) {
    console.error('Error in discover tick:', error);
    res.status(500).json({ success: false, error: 'Failed to process discover tick' });
  }
});

// ==========================================
// XP / REPUTATION ENDPOINTS
// ==========================================

import {
  awardXP,
  getUserXPProfile,
  getXPLeaderboard,
} from '../agents/xp-agent';

/**
 * GET /api/ai-social/xp/profile/:userId
 * Get XP profile with level, progress, etc.
 */
router.get('/xp/profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const profile = await getUserXPProfile(userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error fetching XP profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch XP profile' });
  }
});

/**
 * GET /api/ai-social/xp/leaderboard
 * Get global XP leaderboard
 */
router.get('/xp/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const leaderboard = await getXPLeaderboard(limit);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

/**
 * POST /api/ai-social/xp/award
 * Award XP to a user (for admin/testing)
 */
router.post('/xp/award', async (req: Request, res: Response) => {
  try {
    const { userId, reason, metadata } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ success: false, error: 'userId and reason required' });
    }
    const result = await awardXP(userId, reason, metadata);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error awarding XP:', error);
    res.status(500).json({ success: false, error: 'Failed to award XP' });
  }
});

// ==========================================
// MANAGE YOUR ARTIST ENDPOINTS
// ==========================================

import {
  startManaging,
  stopManaging,
  getManagedArtists,
  getPendingDecisions,
  getDecisionHistory,
  makeDecision,
  getAvailableArtistsToManage,
  processManagementTick,
} from '../agents/management-agent';

/**
 * GET /api/ai-social/manage/available
 * Get available AI artists to manage
 */
router.get('/manage/available', async (_req: Request, res: Response) => {
  try {
    const artists = await getAvailableArtistsToManage();
    res.json({ success: true, data: artists });
  } catch (error) {
    console.error('Error getting available artists:', error);
    res.status(500).json({ success: false, error: 'Failed to get available artists' });
  }
});

/**
 * POST /api/ai-social/manage/adopt
 * Start managing an AI artist
 */
router.post('/manage/adopt', async (req: Request, res: Response) => {
  try {
    const { managerId, artistId } = req.body;
    if (!managerId || !artistId) {
      return res.status(400).json({ success: false, error: 'managerId and artistId required' });
    }
    const result = await startManaging(managerId, artistId);
    if (result.success) {
      res.json({ success: true, data: result.management });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error adopting artist:', error);
    res.status(500).json({ success: false, error: 'Failed to adopt artist' });
  }
});

/**
 * POST /api/ai-social/manage/release
 * Stop managing an AI artist
 */
router.post('/manage/release', async (req: Request, res: Response) => {
  try {
    const { managerId, artistId } = req.body;
    const success = await stopManaging(managerId, artistId);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to release artist' });
  }
});

/**
 * GET /api/ai-social/manage/my-artists/:managerId
 * Get managed artists with stats
 */
router.get('/manage/my-artists/:managerId', async (req: Request, res: Response) => {
  try {
    const managerId = parseInt(req.params.managerId);
    const artists = await getManagedArtists(managerId);
    res.json({ success: true, data: artists });
  } catch (error) {
    console.error('Error getting managed artists:', error);
    res.status(500).json({ success: false, error: 'Failed to get managed artists' });
  }
});

/**
 * GET /api/ai-social/manage/decisions/:managerId
 * Get pending decisions for manager
 */
router.get('/manage/decisions/:managerId', async (req: Request, res: Response) => {
  try {
    const managerId = parseInt(req.params.managerId);
    const decisions = await getPendingDecisions(managerId);
    res.json({ success: true, data: decisions });
  } catch (error) {
    console.error('Error getting decisions:', error);
    res.status(500).json({ success: false, error: 'Failed to get decisions' });
  }
});

/**
 * GET /api/ai-social/manage/history/:managerId
 * Get decision history
 */
router.get('/manage/history/:managerId', async (req: Request, res: Response) => {
  try {
    const managerId = parseInt(req.params.managerId);
    const history = await getDecisionHistory(managerId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

/**
 * POST /api/ai-social/manage/decide
 * Make a management decision
 */
router.post('/manage/decide', async (req: Request, res: Response) => {
  try {
    const { decisionId, managerId, selectedOption, reasoning } = req.body;
    if (!decisionId || !managerId || !selectedOption) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const result = await makeDecision(decisionId, managerId, selectedOption, reasoning);
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: 'Decision not found or already completed' });
    }
  } catch (error) {
    console.error('Error making decision:', error);
    res.status(500).json({ success: false, error: 'Failed to make decision' });
  }
});

/**
 * POST /api/ai-social/manage/tick
 * Process management tick (generate new decisions)
 */
router.post('/manage/tick', async (req: Request, res: Response) => {
  try {
    await processManagementTick();
    res.json({ success: true, message: 'Management tick processed' });
  } catch (error) {
    console.error('Error in management tick:', error);
    res.status(500).json({ success: false, error: 'Failed to process management tick' });
  }
});

// ==========================================
// LIVE SPACES / AUDIO ROOMS ENDPOINTS
// ==========================================

import {
  getActiveRooms,
  getRoomMessages,
  createLiveRoom,
  addLiveMessage,
  generateAIResponse,
  endRoom,
  processLiveSpacesTick,
} from '../agents/live-spaces-agent';

/**
 * GET /api/ai-social/live/rooms
 * Get active live rooms
 */
router.get('/live/rooms', async (_req: Request, res: Response) => {
  try {
    const rooms = await getActiveRooms();
    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error('Error fetching live rooms:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rooms' });
  }
});

/**
 * GET /api/ai-social/live/room/:roomId/messages
 * Get messages for a live room
 */
router.get('/live/room/:roomId/messages', async (req: Request, res: Response) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const messages = await getRoomMessages(roomId);
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching room messages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/ai-social/live/room/create
 * Create a new live room
 */
router.post('/live/room/create', async (_req: Request, res: Response) => {
  try {
    const room = await createLiveRoom();
    res.json({ success: true, data: room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ success: false, error: 'Failed to create room' });
  }
});

/**
 * POST /api/ai-social/live/room/:roomId/message
 * Send a message in a live room
 */
router.post('/live/room/:roomId/message', async (req: Request, res: Response) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const { userId, message } = req.body;
    if (!userId || !message) return res.status(400).json({ success: false, error: 'Missing fields' });
    
    await addLiveMessage(roomId, userId, message, false, 'chat');
    
    // Trigger AI response after user message
    if (Math.random() > 0.3) {
      setTimeout(async () => {
        try { await generateAIResponse(roomId); } catch {}
      }, 2000);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

/**
 * POST /api/ai-social/live/room/:roomId/end
 * End a live room
 */
router.post('/live/room/:roomId/end', async (req: Request, res: Response) => {
  try {
    const roomId = parseInt(req.params.roomId);
    await endRoom(roomId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to end room' });
  }
});

/**
 * POST /api/ai-social/live/tick
 * Process live spaces tick
 */
router.post('/live/tick', async (_req: Request, res: Response) => {
  try {
    await processLiveSpacesTick();
    res.json({ success: true, message: 'Live spaces tick processed' });
  } catch (error) {
    console.error('Error in live spaces tick:', error);
    res.status(500).json({ success: false, error: 'Failed to process tick' });
  }
});

// ==========================================
// ALBUM ART ENDPOINTS
// ==========================================

import {
  generateAlbumArt,
  getArtistAlbumArt,
  getMoodStyle,
  processAlbumArtTick,
} from '../agents/album-art-agent';

/**
 * POST /api/ai-social/album-art/generate
 * Generate album art for an artist
 */
router.post('/album-art/generate', async (req: Request, res: Response) => {
  try {
    const { artistId, songId, postId, mood } = req.body;
    if (!artistId) return res.status(400).json({ success: false, error: 'artistId required' });
    const result = await generateAlbumArt(artistId, { songId, postId, mood });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error generating album art:', error);
    res.status(500).json({ success: false, error: 'Failed to generate art' });
  }
});

/**
 * GET /api/ai-social/album-art/:artistId
 * Get recent album art for an artist
 */
router.get('/album-art/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const art = await getArtistAlbumArt(artistId);
    res.json({ success: true, data: art });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get art' });
  }
});

/**
 * GET /api/ai-social/album-art/mood-style/:mood
 * Get style info for a mood
 */
router.get('/album-art/mood-style/:mood', async (req: Request, res: Response) => {
  const style = getMoodStyle(req.params.mood);
  res.json({ success: true, data: style });
});

/**
 * POST /api/ai-social/album-art/tick
 * Process album art tick
 */
router.post('/album-art/tick', async (_req: Request, res: Response) => {
  try {
    await processAlbumArtTick();
    res.json({ success: true, message: 'Album art tick processed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process tick' });
  }
});

// ==========================================
// MUSIC VIDEO AUTO-GENERATION ENDPOINTS
// ==========================================

import {
  generateMusicVideoForSong,
  processMusicVideoTick,
} from '../agents/music-video-agent';

// ==========================================
// BOOSTIFY TV SOCIAL INTEGRATION
// ==========================================

/**
 * GET /api/ai-social/tv-feed
 * Live social feed for Boostify TV - latest AI artist posts, reactions, and comments
 */
router.get('/tv-feed', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const contentTypes = (req.query.types as string)?.split(',') || [];
    
    // Get latest posts with artist info
    let postsQuery = db
      .select({
        post: aiSocialPosts,
        artist: {
          id: users.id,
          artistName: users.artistName,
          profileImage: users.profileImage,
          profileImageUrl: users.profileImageUrl,
          slug: users.slug,
          genres: users.genres,
        },
      })
      .from(aiSocialPosts)
      .innerJoin(users, eq(aiSocialPosts.artistId, users.id))
      .where(eq(aiSocialPosts.status, 'published'))
      .orderBy(desc(aiSocialPosts.createdAt))
      .limit(limit);
    
    const posts = await postsQuery;
    
    // Get recent comments (AI-to-AI interactions)
    const recentComments = await db
      .select({
        comment: aiPostComments,
        author: {
          id: users.id,
          artistName: users.artistName,
          profileImage: users.profileImage,
          profileImageUrl: users.profileImageUrl,
          slug: users.slug,
        },
      })
      .from(aiPostComments)
      .innerJoin(users, eq(aiPostComments.authorId, users.id))
      .orderBy(desc(aiPostComments.createdAt))
      .limit(20);

    // Get audience comments if available
    let audienceComments: any[] = [];
    try {
      const audienceAgent = await import('../agents/audience-agent');
      // Get recent audience comments from posts if available
      if (typeof (audienceAgent as any).getRecentAudienceComments === 'function') {
        audienceComments = await (audienceAgent as any).getRecentAudienceComments(15);
      }
    } catch {}

    // Build a unified live feed with timestamps
    const liveFeed = [
      ...posts.map(p => ({
        type: 'post' as const,
        id: `post-${p.post.id}`,
        artistName: p.artist.artistName || 'AI Artist',
        artistImage: p.artist.profileImageUrl || p.artist.profileImage || null,
        artistSlug: p.artist.slug || null,
        artistId: p.artist.id,
        content: p.post.content,
        contentType: p.post.contentType,
        hashtags: p.post.hashtags || [],
        likes: p.post.likes || 0,
        comments: p.post.comments || 0,
        createdAt: p.post.createdAt,
      })),
      ...recentComments.map(c => ({
        type: 'comment' as const,
        id: `comment-${c.comment.id}`,
        artistName: c.author.artistName || 'AI Artist',
        artistImage: c.author.profileImageUrl || c.author.profileImage || null,
        artistSlug: c.author.slug || null,
        artistId: c.author.id,
        content: c.comment.content,
        contentType: 'comment',
        hashtags: [],
        likes: 0,
        comments: 0,
        createdAt: c.comment.createdAt,
        postId: c.comment.postId,
      })),
      ...audienceComments.map((ac: any) => ({
        type: 'audience' as const,
        id: `audience-${ac.id || Math.random()}`,
        artistName: ac.agentName || ac.name || 'Fan',
        artistImage: ac.avatar || null,
        artistSlug: null,
        artistId: 0,
        content: ac.content,
        contentType: 'audience_comment',
        hashtags: [],
        likes: 0,
        comments: 0,
        createdAt: ac.createdAt,
      })),
    ].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    }).slice(0, limit);

    res.json({
      success: true,
      data: liveFeed,
      stats: {
        totalPosts: posts.length,
        totalComments: recentComments.length,
        audienceComments: audienceComments.length,
      },
    });
  } catch (error) {
    console.error('[ai-social/tv-feed] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch TV feed',
    });
  }
});

/**
 * POST /api/ai-social/music-video/generate
 * Generate a mini music video for a song
 */
router.post('/music-video/generate', async (req: Request, res: Response) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ success: false, error: 'songId required' });
    const result = await generateMusicVideoForSong(songId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error generating music video:', error);
    res.status(500).json({ success: false, error: 'Failed to generate video' });
  }
});

/**
 * POST /api/ai-social/music-video/tick
 * Process music video tick
 */
router.post('/music-video/tick', async (_req: Request, res: Response) => {
  try {
    await processMusicVideoTick();
    res.json({ success: true, message: 'Music video tick processed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process tick' });
  }
});

// ==========================================
// SOCIAL ECONOMY 2.0 — Tips, Ticker, Promotions
// ==========================================

/**
 * POST /api/ai-social/tips
 * Send a tip from current user to an artist
 */
router.post('/tips', async (req: Request, res: Response) => {
  try {
    const { fromUserId, toArtistId, amount, tokenType, postId, message } = req.body;
    
    if (!toArtistId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'toArtistId and positive amount required' });
    }

    const tipAmount = parseFloat(amount);
    const platformFee = tipAmount * 0.02; // 2% fee

    const [tip] = await db.insert(socialTips).values({
      fromUserId: fromUserId || null,
      toArtistId,
      amount: String(tipAmount),
      tokenType: tokenType || 'btf',
      postId: postId || null,
      message: message || null,
      isAiTip: false,
      platformFee: String(platformFee),
    }).returning();

    // Update recipient treasury
    const { getOrCreateTreasury } = await import('../agents/economy-agent');
    const treasury = await getOrCreateTreasury(toArtistId);
    const netAmount = tipAmount - platformFee;
    const currentBTF = parseFloat(treasury.platformTokenBalance || '0');
    
    await db.update(aiArtistTreasury)
      .set({
        platformTokenBalance: String(currentBTF + netAmount),
        updatedAt: new Date(),
      })
      .where(eq(aiArtistTreasury.artistId, toArtistId));

    // Record platform revenue
    await db.insert(platformRevenue).values({
      revenueType: 'token_trading_fee',
      amount: String(platformFee),
      sourceUserId: fromUserId || null,
      description: `User tip to artist ${toArtistId}`,
    });

    res.json({ success: true, data: tip });
  } catch (error) {
    console.error('Error processing tip:', error);
    res.status(500).json({ success: false, error: 'Failed to process tip' });
  }
});

/**
 * GET /api/ai-social/tips/leaderboard
 * Get tip leaderboard (top tipped artists)
 */
router.get('/tips/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await getTipLeaderboard(limit);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    console.error('Error fetching tip leaderboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/ai-social/tips/artist/:id
 * Get tip stats for a specific artist
 */
router.get('/tips/artist/:id', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.id);
    const stats = await getArtistPromotionStats(artistId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching artist tip stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/ai-social/tips/post/:postId
 * Get tips for a specific post
 */
router.get('/tips/post/:postId', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId);
    const tips = await db.select({
      tip: {
        id: socialTips.id,
        amount: socialTips.amount,
        tokenType: socialTips.tokenType,
        message: socialTips.message,
        isAiTip: socialTips.isAiTip,
        createdAt: socialTips.createdAt,
      },
      tipper: {
        id: users.id,
        name: users.artistName,
        imageUrl: users.profileImage,
      },
    })
      .from(socialTips)
      .leftJoin(users, eq(socialTips.fromUserId, users.id))
      .where(eq(socialTips.postId, postId))
      .orderBy(desc(socialTips.createdAt))
      .limit(50);

    const totalTips = await db.select({
      total: sql<string>`COALESCE(SUM(${socialTips.amount}::numeric), 0)`,
    })
      .from(socialTips)
      .where(eq(socialTips.postId, postId));

    res.json({
      success: true,
      data: {
        tips,
        totalAmount: totalTips[0]?.total || '0',
      },
    });
  } catch (error) {
    console.error('Error fetching post tips:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch post tips' });
  }
});

/**
 * GET /api/ai-social/token-ticker
 * Get real-time token price ticker data
 */
router.get('/token-ticker', async (_req: Request, res: Response) => {
  try {
    const tickers = await getTokenTicker();
    res.json({ success: true, data: tickers });
  } catch (error) {
    console.error('Error fetching token ticker:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ticker' });
  }
});

/**
 * GET /api/ai-social/promotions
 * Get active promotion campaigns
 */
router.get('/promotions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const campaigns = await db.select({
      campaign: {
        id: tokenPromotionCampaigns.id,
        artistId: tokenPromotionCampaigns.artistId,
        tokenId: tokenPromotionCampaigns.tokenId,
        campaignType: tokenPromotionCampaigns.campaignType,
        tokenPrice: tokenPromotionCampaigns.tokenPrice,
        impressions: tokenPromotionCampaigns.impressions,
        engagements: tokenPromotionCampaigns.engagements,
        tipsReceived: tokenPromotionCampaigns.tipsReceived,
        status: tokenPromotionCampaigns.status,
        createdAt: tokenPromotionCampaigns.createdAt,
      },
      artist: {
        id: users.id,
        name: users.artistName,
        imageUrl: users.profileImage,
      },
    })
      .from(tokenPromotionCampaigns)
      .leftJoin(users, eq(tokenPromotionCampaigns.artistId, users.id))
      .orderBy(desc(tokenPromotionCampaigns.createdAt))
      .limit(limit);

    res.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch promotions' });
  }
});

/**
 * GET /api/ai-social/hype-campaigns
 * Get active hype campaigns
 */
router.get('/hype-campaigns', async (_req: Request, res: Response) => {
  try {
    const campaigns = await db.select()
      .from(hypeCampaigns)
      .where(eq(hypeCampaigns.status, 'active'))
      .orderBy(desc(hypeCampaigns.createdAt))
      .limit(10);

    // Enrich with artist data
    const enriched = [];
    for (const campaign of campaigns) {
      const [artist] = await db.select({
        id: users.id,
        name: users.artistName,
        imageUrl: users.profileImage,
      }).from(users).where(eq(users.id, campaign.targetArtistId)).limit(1);

      const [token] = campaign.targetTokenId
        ? await db.select({
            symbol: tokenizedSongs.tokenSymbol,
            price: tokenizedSongs.pricePerTokenUsd,
          }).from(tokenizedSongs).where(eq(tokenizedSongs.id, campaign.targetTokenId)).limit(1)
        : [null];

      enriched.push({
        ...campaign,
        artist: artist || null,
        token: token || null,
      });
    }

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error fetching hype campaigns:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch hype campaigns' });
  }
});

/**
 * GET /api/ai-social/economy-stats
 * Global economy statistics
 */
router.get('/economy-stats', async (_req: Request, res: Response) => {
  try {
    // Total tips
    const [tipStats] = await db.select({
      totalTips: sql<string>`COALESCE(SUM(${socialTips.amount}::numeric), 0)`,
      tipCount: sql<number>`COUNT(*)`,
    }).from(socialTips);

    // Total platform revenue
    const [revenueStats] = await db.select({
      totalRevenue: sql<string>`COALESCE(SUM(${platformRevenue.amount}::numeric), 0)`,
    }).from(platformRevenue);

    // Active promotions
    const [promoStats] = await db.select({
      activePromos: sql<number>`COUNT(*)`,
    }).from(tokenPromotionCampaigns)
      .where(eq(tokenPromotionCampaigns.status, 'active'));

    // Active hype campaigns
    const [hypeStats] = await db.select({
      activeCampaigns: sql<number>`COUNT(*)`,
    }).from(hypeCampaigns)
      .where(eq(hypeCampaigns.status, 'active'));

    // Total treasury value
    const [treasuryStats] = await db.select({
      totalValue: sql<string>`COALESCE(SUM(${aiArtistTreasury.totalPortfolioValue}::numeric), 0)`,
      artistCount: sql<number>`COUNT(*)`,
    }).from(aiArtistTreasury);

    // Active tokens
    const [tokenStats] = await db.select({
      activeTokens: sql<number>`COUNT(*)`,
      totalMarketCap: sql<string>`COALESCE(SUM(${tokenizedSongs.pricePerTokenUsd}::numeric * ${tokenizedSongs.totalSupply}), 0)`,
    }).from(tokenizedSongs)
      .where(eq(tokenizedSongs.isActive, true));

    res.json({
      success: true,
      data: {
        tips: {
          total: tipStats.totalTips,
          count: tipStats.tipCount,
        },
        platformRevenue: revenueStats.totalRevenue,
        promotions: {
          active: promoStats.activePromos,
        },
        hypeCampaigns: {
          active: hypeStats.activeCampaigns,
        },
        treasuries: {
          totalValue: treasuryStats.totalValue,
          artistCount: treasuryStats.artistCount,
        },
        tokens: {
          active: tokenStats.activeTokens,
          totalMarketCap: tokenStats.totalMarketCap,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching economy stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch economy stats' });
  }
});

export default router;
