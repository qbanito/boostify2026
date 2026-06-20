// API Routes for AI Agents System
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  agentSessions, 
  agentSavedResults, 
  agentUsageStats,
  users,
  insertAgentSessionSchema,
  insertAgentSavedResultSchema,
  artistPersonality,
  artistRelationships,
  worldEvents,
  agentActionQueue,
} from '../../db/schema';
import { eq, desc, and, sql, count, gte } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { agentsService } from '../services/openai-agents-service';
import { getToolsForAgent } from '../services/agent-tool-registry';

const router = Router();

// Middleware to ensure user is authenticated
router.use(authenticate);

// ============================================
// AGENT SESSIONS
// ============================================

/**
 * Create a new agent session
 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { agentType, artistId, sessionName, inputParams } = req.body;

    const [session] = await db.insert(agentSessions).values({
      userId,
      artistId: artistId || null,
      agentType,
      sessionName,
      inputParams,
      status: 'pending',
    }).returning();

    res.json(session);
  } catch (error) {
    console.error('Error creating agent session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * Update session with output
 */
router.patch('/session/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const sessionId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { outputContent, outputMetadata, status, tokensUsed, costUsd } = req.body;

    const [session] = await db.update(agentSessions)
      .set({
        outputContent,
        outputMetadata,
        status,
        tokensUsed,
        costUsd,
        updatedAt: new Date(),
        completedAt: status === 'completed' ? new Date() : undefined,
      })
      .where(and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.userId, userId)
      ))
      .returning();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update usage stats
    await updateUsageStats(userId, session.agentType, tokensUsed || 0);

    res.json(session);
  } catch (error) {
    console.error('Error updating agent session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

/**
 * Get session history for a user
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { agentType, artistId, limit = 20, offset = 0 } = req.query;

    let query = db.select()
      .from(agentSessions)
      .where(eq(agentSessions.userId, userId))
      .orderBy(desc(agentSessions.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const sessions = await query;
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * Get sessions for a specific artist
 */
router.get('/history/:artistId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const artistId = parseInt(req.params.artistId);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const sessions = await db.select()
      .from(agentSessions)
      .where(and(
        eq(agentSessions.userId, userId),
        eq(agentSessions.artistId, artistId)
      ))
      .orderBy(desc(agentSessions.createdAt))
      .limit(50);

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching artist history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ============================================
// SAVED RESULTS
// ============================================

/**
 * Save a result from an agent
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { 
      artistId, 
      sessionId, 
      agentType, 
      title, 
      content, 
      contentType, 
      metadata, 
      attachedFiles,
      tags 
    } = req.body;

    const [result] = await db.insert(agentSavedResults).values({
      userId,
      artistId: artistId || null,
      sessionId: sessionId || null,
      agentType,
      title,
      content,
      contentType,
      metadata,
      attachedFiles,
      tags,
    }).returning();

    res.json(result);
  } catch (error) {
    console.error('Error saving result:', error);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

/**
 * Get saved results
 */
router.get('/saved', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { agentType, artistId, favorites, limit = 50 } = req.query;

    const conditions = [eq(agentSavedResults.userId, userId)];
    
    if (agentType) {
      conditions.push(eq(agentSavedResults.agentType, agentType as any));
    }
    if (artistId) {
      conditions.push(eq(agentSavedResults.artistId, Number(artistId)));
    }
    if (favorites === 'true') {
      conditions.push(eq(agentSavedResults.isFavorite, true));
    }

    const results = await db.select()
      .from(agentSavedResults)
      .where(and(...conditions))
      .orderBy(desc(agentSavedResults.createdAt))
      .limit(Number(limit));

    res.json(results);
  } catch (error) {
    console.error('Error fetching saved results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

/**
 * Toggle favorite status
 */
router.patch('/saved/:id/favorite', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const resultId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get current state
    const [current] = await db.select()
      .from(agentSavedResults)
      .where(and(
        eq(agentSavedResults.id, resultId),
        eq(agentSavedResults.userId, userId)
      ));

    if (!current) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Toggle
    const [updated] = await db.update(agentSavedResults)
      .set({ 
        isFavorite: !current.isFavorite,
        updatedAt: new Date()
      })
      .where(eq(agentSavedResults.id, resultId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

/**
 * Delete a saved result
 */
router.delete('/saved/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const resultId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await db.delete(agentSavedResults)
      .where(and(
        eq(agentSavedResults.id, resultId),
        eq(agentSavedResults.userId, userId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting result:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ============================================
// ANALYTICS
// ============================================

/**
 * Get usage analytics for the user
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get stats per agent type
    const stats = await db.select({
      agentType: agentSessions.agentType,
      totalSessions: count(agentSessions.id),
      totalTokens: sql<number>`COALESCE(SUM(${agentSessions.tokensUsed}), 0)`,
    })
    .from(agentSessions)
    .where(eq(agentSessions.userId, userId))
    .groupBy(agentSessions.agentType);

    // Get recent activity
    const recentSessions = await db.select({
      agentType: agentSessions.agentType,
      createdAt: agentSessions.createdAt,
      status: agentSessions.status,
    })
    .from(agentSessions)
    .where(eq(agentSessions.userId, userId))
    .orderBy(desc(agentSessions.createdAt))
    .limit(10);

    // Get saved results count
    const savedCounts = await db.select({
      agentType: agentSavedResults.agentType,
      count: count(agentSavedResults.id),
    })
    .from(agentSavedResults)
    .where(eq(agentSavedResults.userId, userId))
    .groupBy(agentSavedResults.agentType);

    res.json({
      stats,
      recentSessions,
      savedCounts,
      summary: {
        totalSessions: stats.reduce((acc, s) => acc + Number(s.totalSessions), 0),
        totalTokens: stats.reduce((acc, s) => acc + Number(s.totalTokens), 0),
        totalSaved: savedCounts.reduce((acc, s) => acc + Number(s.count), 0),
        mostUsedAgent: stats.sort((a, b) => Number(b.totalSessions) - Number(a.totalSessions))[0]?.agentType || null,
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/agents/performance
 * Detailed performance metrics per agent — success rate, avg response time, cost, error breakdown
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const range = (req.query.range as string) || 'month';
    let dateFilter: Date;
    const now = new Date();
    if (range === 'week') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === 'month') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      dateFilter = new Date(0); // all time
    }

    // Per-agent performance metrics
    const agentPerformance = await db.select({
      agentType: agentSessions.agentType,
      totalSessions: count(agentSessions.id),
      completedSessions: sql<number>`COUNT(CASE WHEN ${agentSessions.status} = 'completed' THEN 1 END)`,
      failedSessions: sql<number>`COUNT(CASE WHEN ${agentSessions.status} = 'failed' THEN 1 END)`,
      totalTokens: sql<number>`COALESCE(SUM(${agentSessions.tokensUsed}), 0)`,
      avgTokens: sql<number>`COALESCE(AVG(${agentSessions.tokensUsed}), 0)`,
      totalCost: sql<string>`COALESCE(SUM(${agentSessions.costUsd}), 0)`,
      avgResponseTimeSec: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${agentSessions.completedAt} - ${agentSessions.createdAt}))), 0)`,
      avgRating: sql<number>`COALESCE(AVG(${agentSessions.userRating}), 0)`,
      ratedSessions: sql<number>`COUNT(${agentSessions.userRating})`,
      lastUsed: sql<string>`MAX(${agentSessions.createdAt})`,
    })
    .from(agentSessions)
    .where(and(
      eq(agentSessions.userId, userId),
      sql`${agentSessions.createdAt} >= ${dateFilter}`
    ))
    .groupBy(agentSessions.agentType);

    // Daily session counts for trend chart (last 14 days)
    const dailyTrend = await db.select({
      day: sql<string>`DATE(${agentSessions.createdAt})`,
      total: count(agentSessions.id),
      completed: sql<number>`COUNT(CASE WHEN ${agentSessions.status} = 'completed' THEN 1 END)`,
      failed: sql<number>`COUNT(CASE WHEN ${agentSessions.status} = 'failed' THEN 1 END)`,
      tokens: sql<number>`COALESCE(SUM(${agentSessions.tokensUsed}), 0)`,
    })
    .from(agentSessions)
    .where(and(
      eq(agentSessions.userId, userId),
      sql`${agentSessions.createdAt} >= ${new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)}`
    ))
    .groupBy(sql`DATE(${agentSessions.createdAt})`)
    .orderBy(sql`DATE(${agentSessions.createdAt})`);

    // Recent errors (last 10 failed sessions)
    const recentErrors = await db.select({
      id: agentSessions.id,
      agentType: agentSessions.agentType,
      sessionName: agentSessions.sessionName,
      createdAt: agentSessions.createdAt,
      outputContent: agentSessions.outputContent,
    })
    .from(agentSessions)
    .where(and(
      eq(agentSessions.userId, userId),
      eq(agentSessions.status, 'failed')
    ))
    .orderBy(desc(agentSessions.createdAt))
    .limit(10);

    // Compute aggregated summary
    const totalAll = agentPerformance.reduce((a, p) => a + Number(p.totalSessions), 0);
    const completedAll = agentPerformance.reduce((a, p) => a + Number(p.completedSessions), 0);
    const failedAll = agentPerformance.reduce((a, p) => a + Number(p.failedSessions), 0);
    const tokensAll = agentPerformance.reduce((a, p) => a + Number(p.totalTokens), 0);
    const costAll = agentPerformance.reduce((a, p) => a + Number(p.totalCost), 0);

    res.json({
      agents: agentPerformance.map(a => ({
        agentType: a.agentType,
        totalSessions: Number(a.totalSessions),
        completedSessions: Number(a.completedSessions),
        failedSessions: Number(a.failedSessions),
        successRate: Number(a.totalSessions) > 0 ? Math.round((Number(a.completedSessions) / Number(a.totalSessions)) * 100) : 0,
        totalTokens: Number(a.totalTokens),
        avgTokens: Math.round(Number(a.avgTokens)),
        totalCost: Number(Number(a.totalCost).toFixed(4)),
        avgResponseTimeSec: Math.round(Number(a.avgResponseTimeSec)),
        avgRating: Number(Number(a.avgRating).toFixed(1)),
        ratedSessions: Number(a.ratedSessions),
        lastUsed: a.lastUsed,
      })),
      dailyTrend: dailyTrend.map(d => ({
        day: d.day,
        total: Number(d.total),
        completed: Number(d.completed),
        failed: Number(d.failed),
        tokens: Number(d.tokens),
      })),
      recentErrors: recentErrors.map(e => ({
        id: e.id,
        agentType: e.agentType,
        sessionName: e.sessionName,
        createdAt: e.createdAt,
        error: e.outputContent?.substring(0, 200) || 'Unknown error',
      })),
      summary: {
        totalSessions: totalAll,
        completedSessions: completedAll,
        failedSessions: failedAll,
        overallSuccessRate: totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0,
        totalTokens: tokensAll,
        totalCost: Number(costAll.toFixed(4)),
        avgCostPerSession: totalAll > 0 ? Number((costAll / totalAll).toFixed(6)) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching agent performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// Helper function to update usage stats
async function updateUsageStats(userId: number, agentType: string, tokensUsed: number) {
  try {
    // Upsert usage stats
    await db.execute(sql`
      INSERT INTO agent_usage_stats (user_id, agent_type, total_sessions, total_tokens_used, last_used_at, created_at, updated_at)
      VALUES (${userId}, ${agentType}, 1, ${tokensUsed}, NOW(), NOW(), NOW())
      ON CONFLICT (user_id, agent_type) 
      DO UPDATE SET 
        total_sessions = agent_usage_stats.total_sessions + 1,
        total_tokens_used = agent_usage_stats.total_tokens_used + ${tokensUsed},
        last_used_at = NOW(),
        updated_at = NOW()
    `);
  } catch (error) {
    console.error('Error updating usage stats:', error);
  }
}

// ============================================
// ENHANCED AGENT EXECUTION (Function Calling)
// ============================================

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  composer: "You are an expert songwriter and music composer. You write professional lyrics, create melodies, and help artists develop their sound. When asked to create lyrics or music, USE the save_lyrics and generate_music_audio tools to actually save the work.",
  marketing: "You are a music marketing strategist with expertise in digital marketing, social media growth, and artist development. When creating campaigns or posts, USE the tools to save campaigns, schedule posts, and analyze audiences — don't just describe them.",
  'social-media': "You are a social media expert specializing in music artist promotion. When creating content plans, USE the tools to create content calendars, generate post packs, and build hashtag strategies — actually save them.",
  'video-director': "You are an experienced music video director. When planning videos, USE the create_storyboard and generate_scene_image tools to save storyboards and generate actual concept images.",
  photographer: "You are a professional photographer and visual artist. When creating promotional visuals, USE the generate_promo_images tool to actually generate real images.",
  merchandise: "You are a merchandise designer and brand strategist. When designing merch, USE the create_merch_designs tool to save actual design concepts.",
  manager: "You are an experienced music industry career manager. When planning career paths, USE the create_career_roadmap and generate_pitch_deck tools to create actual saved plans.",
};

/**
 * Execute an agent with Function Calling — the agent can invoke real tools
 * This replaces the old text-only generation with actual action execution
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { agentType, prompt, artistId, artistName, sessionId } = req.body;

    if (!agentType || !prompt) {
      return res.status(400).json({ error: 'agentType and prompt are required' });
    }

    // Validate agentType
    const validAgents = ['composer', 'marketing', 'social-media', 'video-director', 'photographer', 'merchandise', 'manager'];
    if (!validAgents.includes(agentType)) {
      return res.status(400).json({ error: `Invalid agent type. Valid: ${validAgents.join(', ')}` });
    }

    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentType] || `You are an AI assistant specialized in ${agentType}.`;

    // Create or use existing session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const [session] = await db.insert(agentSessions).values({
        userId,
        artistId: artistId || null,
        agentType,
        sessionName: `${agentType} - ${new Date().toLocaleDateString()}`,
        inputParams: { prompt },
        status: 'processing',
      }).returning();
      currentSessionId = session.id;
    }

    // Execute with Function Calling
    const result = await agentsService.executeWithTools(agentType, prompt, {
      systemInstruction: systemPrompt,
      userId,
      artistId,
      sessionId: currentSessionId,
      artistName,
    });

    // Update session with output
    await db.update(agentSessions)
      .set({
        outputContent: result.text,
        outputMetadata: {
          toolResults: result.toolResults,
          toolsAvailable: getToolsForAgent(agentType).map(t => t.function.name),
        },
        status: 'completed',
        tokensUsed: result.tokensUsed,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSessions.id, currentSessionId));

    // Update usage stats
    await updateUsageStats(userId, agentType, result.tokensUsed);

    res.json({
      sessionId: currentSessionId,
      text: result.text,
      toolResults: result.toolResults,
      tokensUsed: result.tokensUsed,
      model: result.model,
      hasActions: result.toolResults.some(r => r.actions && r.actions.length > 0),
    });
  } catch (error) {
    console.error('Error executing agent:', error);
    res.status(500).json({ error: 'Failed to execute agent' });
  }
});

/**
 * Get available tools for an agent type
 */
router.get('/tools/:agentType', async (req: Request, res: Response) => {
  try {
    const { agentType } = req.params;
    const tools = getToolsForAgent(agentType);
    res.json({
      agentType,
      tools: tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tools' });
  }
});

// ============================================
// ECOSYSTEM NODES (Agent Network Visualization)
// ============================================

/**
 * Get live stats and recent events for the Agent Network visualization
 */
router.get('/ecosystem-nodes', async (req: Request, res: Response) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Count active AI artists (those with personality profiles)
    const [personalityCountRow] = await db
      .select({ count: count() })
      .from(artistPersonality);
    const activeAiArtists = Number(personalityCountRow?.count ?? 0);

    // Count relationships
    const [relCountRow] = await db
      .select({ count: count() })
      .from(artistRelationships);
    const totalRelationships = Number(relCountRow?.count ?? 0);

    // Recent world events (last 24h)
    const recentWorldEvents = await db
      .select({
        id: worldEvents.id,
        title: worldEvents.title,
        eventType: worldEvents.eventType,
        status: worldEvents.status,
        createdAt: worldEvents.createdAt,
      })
      .from(worldEvents)
      .orderBy(desc(worldEvents.createdAt))
      .limit(10);

    // Recent agent actions (last 24h)
    const recentActions = await db
      .select({
        id: agentActionQueue.id,
        actionType: agentActionQueue.actionType,
        status: agentActionQueue.status,
        executedAt: agentActionQueue.executedAt,
        createdAt: agentActionQueue.createdAt,
      })
      .from(agentActionQueue)
      .orderBy(desc(agentActionQueue.createdAt))
      .limit(20);

    // Agent session counts per type (last 24h usage)
    const sessionsByType = await db
      .select({
        agentType: agentSessions.agentType,
        count: count(),
      })
      .from(agentSessions)
      .where(gte(agentSessions.createdAt, since24h))
      .groupBy(agentSessions.agentType);

    const usageMap: Record<string, number> = {};
    for (const row of sessionsByType) {
      usageMap[row.agentType] = Number(row.count);
    }

    // Recent agent sessions for activity log
    const recentSessions = await db
      .select({
        id: agentSessions.id,
        agentType: agentSessions.agentType,
        status: agentSessions.status,
        sessionName: agentSessions.sessionName,
        createdAt: agentSessions.createdAt,
      })
      .from(agentSessions)
      .orderBy(desc(agentSessions.createdAt))
      .limit(15);

    res.json({
      stats: {
        activeAiArtists,
        totalRelationships,
        eventsToday: recentWorldEvents.length,
        tasksToday: recentActions.filter(a => a.executedAt).length,
        agentUsageToday: sessionsByType.reduce((sum, r) => sum + Number(r.count), 0),
      },
      agentUsage: usageMap,
      recentWorldEvents,
      recentActions,
      recentSessions: recentSessions.map(s => ({
        ...s,
        label: `${s.agentType}${s.sessionName ? ` — ${s.sessionName}` : ''}`,
      })),
    });
  } catch (error) {
    console.error('[ecosystem-nodes] Error:', error);
    res.status(500).json({ error: 'Failed to fetch ecosystem data' });
  }
});

export default router;
