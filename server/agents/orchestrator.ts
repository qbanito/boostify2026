/**
 * BOOSTIFY AUTONOMOUS AGENTS - Orchestrator
 * The central brain that coordinates all agents
 */

import { db } from '../db';
import { 
  artistPersonality, 
  agentMemory, 
  artistRelationships, 
  worldEvents, 
  agentActionQueue,
  aiSocialPosts,
  users
} from '../../db/schema';
import { eq, and, desc, lt, gte, isNull, sql } from 'drizzle-orm';
import { eventBus, AgentEventType, emitSystemTick, createEvent, SystemTickPayload } from './events';
import type { ArtistPersonality, AgentAction, WorldEvent, ActionType } from './types';

// ============================================
// ORCHESTRATOR STATE
// ============================================

interface OrchestratorState {
  isRunning: boolean;
  tickCount: number;
  activeArtists: Set<number>;
  lastTickTime: Date | null;
  tickInterval: number; // milliseconds between ticks
}

const state: OrchestratorState = {
  isRunning: false,
  tickCount: 0,
  activeArtists: new Set(),
  lastTickTime: null,
  tickInterval: 60000, // 1 minute default
};

let tickTimer: NodeJS.Timeout | null = null;

// ============================================
// ORCHESTRATOR CORE
// ============================================

/**
 * Initialize the Agent Orchestrator
 */
export async function initializeOrchestrator(): Promise<void> {
  console.log('🎼 [Orchestrator] Initializing Autonomous Agent Orchestrator...');
  
  // Load active artists with personalities
  await loadActiveArtists();
  
  // Setup event listeners
  setupEventListeners();
  
  console.log(`🎼 [Orchestrator] Ready with ${state.activeArtists.size} active AI artists`);
}

/**
 * Start the orchestrator tick cycle
 */
export function startOrchestrator(intervalMs: number = 60000): void {
  if (state.isRunning) {
    console.log('⚠️ [Orchestrator] Already running');
    return;
  }

  state.isRunning = true;
  state.tickInterval = intervalMs;
  
  console.log(`🚀 [Orchestrator] Starting with ${intervalMs}ms tick interval`);
  
  // Run first tick immediately
  orchestratorTick();
  
  // Schedule subsequent ticks
  tickTimer = setInterval(orchestratorTick, intervalMs);
}

/**
 * Stop the orchestrator
 */
export function stopOrchestrator(): void {
  if (!state.isRunning) {
    console.log('⚠️ [Orchestrator] Not running');
    return;
  }

  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }

  state.isRunning = false;
  console.log('🛑 [Orchestrator] Stopped');
}

/**
 * Main tick function - runs every interval
 */
async function orchestratorTick(): Promise<void> {
  state.tickCount++;
  state.lastTickTime = new Date();
  
  const pendingActionsCount = await processPendingActions();
  
  // Emit system tick event
  emitSystemTick(state.tickCount, state.activeArtists.size, pendingActionsCount);
  
  // Every 5 ticks, run social tick to decide interactions
  if (state.tickCount % 5 === 0) {
    try {
      const { processSocialTick } = await import('./social-agent');
      await processSocialTick();
      console.log('🔄 [Orchestrator] Social tick processed - checking for interactions');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in social tick:', error);
    }
  }

  // Every 3 ticks, process collaborations
  if (state.tickCount % 3 === 0) {
    try {
      const { processCollaborationTick } = await import('./collaboration-agent');
      await processCollaborationTick();
      console.log('🤝 [Orchestrator] Collaboration tick processed');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in collaboration tick:', error);
    }
  }

  // Every 6 ticks, process economy
  if (state.tickCount % 6 === 0) {
    try {
      const { processEconomyTick } = await import('./economy-agent');
      await processEconomyTick();
      console.log('💰 [Orchestrator] Economy tick processed');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in economy tick:', error);
    }
  }

  // Every 8 ticks, process beefs/drama
  if (state.tickCount % 8 === 0) {
    try {
      const { processBeefTick } = await import('./beef-agent');
      await processBeefTick();
      console.log('🔥 [Orchestrator] Beef tick processed');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in beef tick:', error);
    }
  }

  // Every 4 ticks, process promotions (token promos, AI tipping, hype campaigns)
  if (state.tickCount % 4 === 0) {
    try {
      const { processPromotionTick } = await import('./promotion-agent');
      await processPromotionTick();
      console.log('📣 [Orchestrator] Promotion tick processed - token promos & tips');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in promotion tick:', error);
    }
  }

  // Every 4 ticks, process music creation
  if (state.tickCount % 4 === 0) {
    try {
      const { processMusicTick } = await import('./music-agent');
      await processMusicTick();
      console.log('🎵 [Orchestrator] Music tick processed');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in music tick:', error);
    }
  }

  // Every 7 ticks, process blockchain/trading activity
  if (state.tickCount % 7 === 0) {
    try {
      const { blockchainAgentTick } = await import('./blockchain-agent');
      await blockchainAgentTick();
      console.log('⛓️ [Orchestrator] Blockchain tick processed - trading activity');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in blockchain tick:', error);
    }
  }

  // Every 10 ticks, process Economic Engine cycles (Layer 3 — Hidden Motor)
  if (state.tickCount % 10 === 0) {
    try {
      const { processEconomicEngineTick } = await import('../services/economic-engine/economic-brain');
      await processEconomicEngineTick();
      console.log('💰 [Orchestrator] Economic Engine tick processed - treasury & DeFi agents');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in economic engine tick:', error);
    }
  }

  // Every 15 ticks, process news and generate reactions
  if (state.tickCount % 15 === 0) {
    try {
      const { processNewsTick } = await import('./news-agent');
      await processNewsTick();
      console.log('📰 [Orchestrator] News tick processed - artists reacting to world events');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in news tick:', error);
    }
  }

  // Every 30 ticks, generate debate follow-ups on news posts
  if (state.tickCount % 30 === 0) {
    try {
      const { generateDebateFollowups } = await import('./news-agent');
      const followups = await generateDebateFollowups();
      console.log(`💬 [Orchestrator] Debate follow-ups generated: ${followups} replies`);
    } catch (error) {
      console.error('❌ [Orchestrator] Error in debate follow-ups:', error);
    }
  }

  // Every 120 ticks (2 hours at 1min), process outreach
  if (state.tickCount % 120 === 0) {
    try {
      const { processOutreachTick } = await import('./outreach-agent');
      await processOutreachTick();
      console.log('📧 [Orchestrator] Outreach tick processed - industry emails');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in outreach tick:', error);
    }
  }

  // Every 2 ticks, process radio - Boostify Radio 24/7
  if (state.tickCount % 2 === 0) {
    try {
      const { processRadioTick } = await import('./radio-agent');
      await processRadioTick();
      console.log('📻 [Orchestrator] Radio tick processed - now playing updates');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in radio tick:', error);
    }
  }

  // Every 4 ticks, process audience comments & debates
  if (state.tickCount % 4 === 0) {
    try {
      const { processAudienceTick } = await import('./audience-agent');
      await processAudienceTick();
      console.log('👥 [Orchestrator] Audience tick processed - comments & debates');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in audience tick:', error);
    }
  }

  // Every 10 ticks, process Boostify TV interactions (AI artists commenting on videos)
  if (state.tickCount % 10 === 0) {
    try {
      const { processTVInteractionTick } = await import('./tv-interaction-agent');
      await processTVInteractionTick();
      console.log('📺 [Orchestrator] TV interaction tick processed - AI artist video comments');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in TV interaction tick:', error);
    }
  }

  // Every 6 ticks, process stories (create new, expire old, audience reactions)
  if (state.tickCount % 6 === 0) {
    try {
      const { processStoriesTick } = await import('./stories-agent');
      await processStoriesTick();
      console.log('📸 [Orchestrator] Stories tick processed - ephemeral content');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in stories tick:', error);
    }
  }

  // Every 8 ticks, process polls (create polls, audience votes)
  if (state.tickCount % 8 === 0) {
    try {
      const { processPollsTick } = await import('./polls-agent');
      await processPollsTick();
      console.log('📊 [Orchestrator] Polls tick processed - votes & new polls');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in polls tick:', error);
    }
  }

  // Every 60 ticks (~1 hour), calculate weekly charts
  if (state.tickCount % 60 === 0) {
    try {
      const { processChartsTick } = await import('./charts-agent');
      await processChartsTick();
      console.log('📊 [Orchestrator] Charts tick processed - weekly billboard');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in charts tick:', error);
    }
  }

  // Every 12 ticks, process trending topics (news reactions, audience debates)
  if (state.tickCount % 12 === 0) {
    try {
      const { processTrendingTick } = await import('./trending-topics-agent');
      await processTrendingTick();
      console.log('🔥 [Orchestrator] Trending tick processed - topics & debates');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in trending tick:', error);
    }
  }

  // Every 10 ticks, process discover clips (TikTok feed)
  if (state.tickCount % 10 === 0) {
    try {
      const { processDiscoverTick } = await import('./discover-agent');
      await processDiscoverTick();
      console.log('📱 [Orchestrator] Discover tick processed - new clips');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in discover tick:', error);
    }
  }

  // Every 15 ticks, process management decisions
  if (state.tickCount % 15 === 0) {
    try {
      const { processManagementTick } = await import('./management-agent');
      await processManagementTick();
      console.log('🎯 [Orchestrator] Management tick processed - new decisions');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in management tick:', error);
    }
  }

  // Every 8 ticks, process live spaces (AI audio rooms, chat)
  if (state.tickCount % 8 === 0) {
    try {
      const { processLiveSpacesTick } = await import('./live-spaces-agent');
      await processLiveSpacesTick();
      console.log('🎙️ [Orchestrator] Live spaces tick processed - rooms & chat');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in live spaces tick:', error);
    }
  }

  // Every 20 ticks, process album art generation
  if (state.tickCount % 20 === 0) {
    try {
      const { processAlbumArtTick } = await import('./album-art-agent');
      await processAlbumArtTick();
      console.log('🎨 [Orchestrator] Album art tick processed - dynamic covers');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in album art tick:', error);
    }
  }

  // Every 30 ticks, process music video auto-generation
  if (state.tickCount % 30 === 0) {
    try {
      const { processMusicVideoTick } = await import('./music-video-agent');
      await processMusicVideoTick();
      console.log('🎬 [Orchestrator] Music video tick processed - auto clips');
    } catch (error) {
      console.error('❌ [Orchestrator] Error in music video tick:', error);
    }
  }

  // Every 10 ticks, do maintenance
  if (state.tickCount % 10 === 0) {
    await performMaintenance();
  }
  
  // Every hour (60 ticks at 1min interval), trigger mood decay
  if (state.tickCount % 60 === 0) {
    await triggerMoodDecay();
  }

  // Every 1440 ticks (~24 hours at 1min), run AAS daily cycles for all enabled artists
  if (state.tickCount % 1440 === 0) {
    try {
      const { runAllAASCycles } = await import('../services/aas/daily-cycle');
      const summaries = await runAllAASCycles();
      console.log(`⚡ [Orchestrator] AAS daily cycles complete: ${summaries.filter(s => !s.skipped).length} artists processed`);
    } catch (error) {
      console.error('❌ [Orchestrator] Error in AAS daily cycles:', error);
    }
  }
  
  console.log(`⏰ [Orchestrator] Tick ${state.tickCount} - ${state.activeArtists.size} artists, ${pendingActionsCount} pending actions`);
}

// ============================================
// ARTIST MANAGEMENT
// ============================================

/**
 * Load all artists that have personalities (active AI artists)
 */
async function loadActiveArtists(): Promise<void> {
  try {
    const artistsWithPersonality = await db
      .select({ artistId: artistPersonality.artistId })
      .from(artistPersonality);
    
    state.activeArtists.clear();
    artistsWithPersonality.forEach(a => state.activeArtists.add(a.artistId));
    
    console.log(`📋 [Orchestrator] Loaded ${state.activeArtists.size} active AI artists`);
  } catch (error) {
    console.error('❌ [Orchestrator] Error loading active artists:', error);
  }
}

/**
 * Activate a new AI artist
 */
export async function activateArtist(artistId: number): Promise<boolean> {
  try {
    // Check if artist already has personality
    const existing = await db
      .select()
      .from(artistPersonality)
      .where(eq(artistPersonality.artistId, artistId))
      .limit(1);
    
    if (existing.length > 0) {
      state.activeArtists.add(artistId);
      console.log(`✅ [Orchestrator] Artist ${artistId} activated (existing personality)`);
      return true;
    }
    
    console.log(`⚠️ [Orchestrator] Artist ${artistId} has no personality - generate one first`);
    return false;
  } catch (error) {
    console.error(`❌ [Orchestrator] Error activating artist ${artistId}:`, error);
    return false;
  }
}

/**
 * Deactivate an AI artist
 */
export function deactivateArtist(artistId: number): void {
  state.activeArtists.delete(artistId);
  eventBus.unsubscribeArtist(artistId);
  console.log(`📴 [Orchestrator] Artist ${artistId} deactivated`);
}

/**
 * Check if an artist is active
 */
export function isArtistActive(artistId: number): boolean {
  return state.activeArtists.has(artistId);
}

/**
 * Get all active artist IDs
 */
export function getActiveArtistIds(): number[] {
  return Array.from(state.activeArtists);
}

// ============================================
// ACTION QUEUE MANAGEMENT
// ============================================

/**
 * Queue an action for an artist
 */
export async function queueAction(action: Omit<AgentAction, 'id' | 'status' | 'attempts'>): Promise<number> {
  try {
    const [inserted] = await db
      .insert(agentActionQueue)
      .values({
        artistId: action.artistId,
        actionType: action.actionType,
        priority: action.priority,
        payload: action.payload,
        scheduledFor: action.scheduledFor,
        triggeredBy: action.triggeredBy,
        relatedEventId: action.relatedEventId,
        status: 'pending',
        attempts: 0,
      })
      .returning({ id: agentActionQueue.id });
    
    // Emit event
    eventBus.emitAgentEvent({
      type: AgentEventType.QUEUE_ACTION_ADDED,
      payload: {
        timestamp: new Date(),
        source: 'Orchestrator',
        artistId: action.artistId,
        actionType: action.actionType,
        actionId: inserted.id,
      },
      priority: 'low',
    });
    
    console.log(`📥 [Orchestrator] Queued action ${action.actionType} for artist ${action.artistId}`);
    return inserted.id;
  } catch (error) {
    console.error('❌ [Orchestrator] Error queueing action:', error);
    throw error;
  }
}

/**
 * Process pending actions
 */
async function processPendingActions(): Promise<number> {
  try {
    const now = new Date();
    
    // Get pending actions that are due
    const pendingActions = await db
      .select()
      .from(agentActionQueue)
      .where(
        and(
          eq(agentActionQueue.status, 'pending'),
          lt(agentActionQueue.scheduledFor, now)
        )
      )
      .orderBy(desc(agentActionQueue.priority))
      .limit(10); // Process up to 10 per tick
    
    for (const action of pendingActions) {
      await executeAction(action);
    }
    
    // Return total pending count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentActionQueue)
      .where(eq(agentActionQueue.status, 'pending'));
    
    return Number(count) || 0;
  } catch (error) {
    console.error('❌ [Orchestrator] Error processing actions:', error);
    return 0;
  }
}

/**
 * Execute a single action
 */
async function executeAction(action: typeof agentActionQueue.$inferSelect): Promise<void> {
  try {
    // Mark as processing
    await db
      .update(agentActionQueue)
      .set({ 
        status: 'processing',
        attempts: (action.attempts || 0) + 1,
      })
      .where(eq(agentActionQueue.id, action.id));
    
    // Execute based on action type
    let result: { success: boolean; output?: any; error?: string };
    
    switch (action.actionType) {
      case 'create_post':
        result = await executeCreatePost(action);
        break;
      case 'update_mood':
        result = await executeUpdateMood(action);
        break;
      case 'like_post':
        result = await executeLikePost(action);
        break;
      case 'comment_on_post':
        result = await executeCommentOnPost(action);
        break;
      case 'follow_artist':
        result = await executeFollowArtist(action);
        break;
      default:
        result = { success: true, output: { message: 'Action type not implemented yet' } };
    }
    
    // Update action status
    await db
      .update(agentActionQueue)
      .set({
        status: result.success ? 'completed' : 'failed',
        executedAt: new Date(),
        result,
      })
      .where(eq(agentActionQueue.id, action.id));
    
    // Emit event
    eventBus.emitAgentEvent({
      type: result.success ? AgentEventType.QUEUE_ACTION_PROCESSED : AgentEventType.QUEUE_ACTION_FAILED,
      payload: {
        timestamp: new Date(),
        source: 'Orchestrator',
        artistId: action.artistId,
        actionType: action.actionType,
        actionId: action.id,
        result,
      },
      priority: result.success ? 'low' : 'medium',
    });
    
  } catch (error) {
    console.error(`❌ [Orchestrator] Error executing action ${action.id}:`, error);
    
    // Mark as failed
    await db
      .update(agentActionQueue)
      .set({
        status: 'failed',
        result: { success: false, error: String(error) },
      })
      .where(eq(agentActionQueue.id, action.id));
  }
}

// ============================================
// ACTION EXECUTORS
// ============================================

async function executeCreatePost(action: typeof agentActionQueue.$inferSelect): Promise<{ success: boolean; output?: any; error?: string }> {
  const payload = action.payload as { content?: string; contentType?: string; mood?: string };
  
  try {
    // Import SocialAgent to generate post
    const { generatePost } = await import('./social-agent');
    const post = await generatePost({
      artistId: action.artistId,
      contentType: (payload.contentType || 'thought') as any,
      forcePost: true,
    });
    
    if (!post) {
      return { success: false, error: 'generatePost returned null' };
    }
    
    return { success: true, output: { postId: post.id } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function executeUpdateMood(action: typeof agentActionQueue.$inferSelect): Promise<{ success: boolean; output?: any; error?: string }> {
  const payload = action.payload as { newMood?: string; intensity?: number };
  
  try {
    const { updateArtistMood } = await import('./personality-agent');
    await updateArtistMood(action.artistId, payload.newMood as any, payload.intensity);
    return { success: true, output: { newMood: payload.newMood } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function executeLikePost(action: typeof agentActionQueue.$inferSelect): Promise<{ success: boolean; output?: any; error?: string }> {
  const payload = action.payload as { postId?: number };
  
  if (!payload.postId) {
    return { success: false, error: 'No postId provided' };
  }
  
  try {
    // Increment AI likes on the post
    await db
      .update(aiSocialPosts)
      .set({ aiLikes: sql`${aiSocialPosts.aiLikes} + 1` })
      .where(eq(aiSocialPosts.id, payload.postId));
    
    console.log(`❤️ [Orchestrator] Artist ${action.artistId} liked post ${payload.postId}`);
    return { success: true, output: { postId: payload.postId } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function executeCommentOnPost(action: typeof agentActionQueue.$inferSelect): Promise<{ success: boolean; output?: any; error?: string }> {
  const payload = action.payload as { postId?: number; authorId?: number };
  
  if (!payload.postId || !payload.authorId) {
    return { success: false, error: 'No postId or authorId provided' };
  }
  
  try {
    // Import and use generateComment from social-agent
    const { generateComment } = await import('./social-agent');
    const comment = await generateComment(action.artistId, payload.postId, payload.authorId);
    
    if (comment) {
      console.log(`💬 [Orchestrator] Artist ${action.artistId} commented on post ${payload.postId}`);
      return { success: true, output: { commentId: comment.id, postId: payload.postId } };
    } else {
      return { success: false, error: 'Comment generation returned null' };
    }
  } catch (error) {
    console.error(`❌ [Orchestrator] Error generating comment:`, error);
    return { success: false, error: String(error) };
  }
}

async function executeFollowArtist(action: typeof agentActionQueue.$inferSelect): Promise<{ success: boolean; output?: any; error?: string }> {
  const payload = action.payload as { targetArtistId?: number };
  
  if (!payload.targetArtistId) {
    return { success: false, error: 'No targetArtistId provided' };
  }
  
  try {
    // Create or strengthen relationship
    const existing = await db
      .select()
      .from(artistRelationships)
      .where(
        and(
          eq(artistRelationships.artistId, action.artistId),
          eq(artistRelationships.relatedArtistId, payload.targetArtistId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Strengthen existing relationship
      await db
        .update(artistRelationships)
        .set({ 
          strength: sql`LEAST(${artistRelationships.strength} + 5, 100)`,
          interactionCount: sql`${artistRelationships.interactionCount} + 1`,
          lastInteraction: new Date(),
        })
        .where(eq(artistRelationships.id, existing[0].id));
    } else {
      // Create new relationship
      await db
        .insert(artistRelationships)
        .values({
          artistId: action.artistId,
          relatedArtistId: payload.targetArtistId,
          relationshipType: 'fan',
          strength: 20,
          trust: 30,
          respect: 40,
          affinity: 50,
          interactionCount: 1,
          lastInteraction: new Date(),
        });
    }
    
    return { success: true, output: { targetArtistId: payload.targetArtistId } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================
// MAINTENANCE & UTILITIES
// ============================================

async function performMaintenance(): Promise<void> {
  console.log('🧹 [Orchestrator] Running maintenance...');
  
  // Prune event history
  eventBus.pruneHistory(500);
  
  // Clean up old short-term memories (older than 24h)
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);
  
  await db
    .delete(agentMemory)
    .where(
      and(
        eq(agentMemory.memoryType, 'short_term'),
        lt(agentMemory.createdAt, yesterday)
      )
    );
  
  // Clean up old completed actions (older than 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  await db
    .delete(agentActionQueue)
    .where(
      and(
        eq(agentActionQueue.status, 'completed'),
        lt(agentActionQueue.createdAt, weekAgo)
      )
    );
  
  console.log('✅ [Orchestrator] Maintenance completed');
}

async function triggerMoodDecay(): Promise<void> {
  console.log('😌 [Orchestrator] Triggering mood intensity decay...');
  
  // Decay mood intensity towards 50 (neutral)
  await db
    .update(artistPersonality)
    .set({
      moodIntensity: sql`GREATEST(50, ${artistPersonality.moodIntensity} - 5)`,
      updatedAt: new Date(),
    })
    .where(gte(artistPersonality.moodIntensity, 55));
  
  await db
    .update(artistPersonality)
    .set({
      moodIntensity: sql`LEAST(50, ${artistPersonality.moodIntensity} + 5)`,
      updatedAt: new Date(),
    })
    .where(lt(artistPersonality.moodIntensity, 45));
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners(): void {
  // Listen for all events and log critical ones
  eventBus.on('*', (event) => {
    if (event.priority === 'critical') {
      console.log(`🚨 [Orchestrator] CRITICAL EVENT: ${event.type}`);
    }
  });
  
  // Listen for new posts to trigger reactions from other artists
  eventBus.on(AgentEventType.ARTIST_POSTED, async (event) => {
    const { artistId, postId } = event.payload;
    
    // Schedule reactions from other artists
    for (const otherArtistId of state.activeArtists) {
      if (otherArtistId !== artistId) {
        // Random chance to react (based on relationship)
        if (Math.random() < 0.3) { // 30% chance to react
          await queueAction({
            artistId: otherArtistId,
            actionType: 'like_post',
            priority: 30,
            payload: { postId },
            scheduledFor: new Date(Date.now() + Math.random() * 3600000), // Within 1 hour
            triggeredBy: `reaction_to_post_${postId}`,
          });
        }
      }
    }
  });
  
  // Listen for world events to trigger artist participation
  eventBus.on(AgentEventType.WORLD_EVENT_STARTED, async (event) => {
    const { eventId, eventType, title } = event.payload;
    console.log(`🌍 [Orchestrator] World event started: ${title}`);
    
    // TODO: Implement artist reaction to world events
  });
  
  console.log('👂 [Orchestrator] Event listeners configured');
}

// ============================================
// EXPORTS
// ============================================

export function getOrchestratorState() {
  return {
    isRunning: state.isRunning,
    tickCount: state.tickCount,
    activeArtistsCount: state.activeArtists.size,
    lastTickTime: state.lastTickTime,
    tickInterval: state.tickInterval,
  };
}
