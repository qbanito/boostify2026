/**
 * BOOSTIFY AUTONOMOUS AGENTS - Event System
 * EventBus for inter-agent communication
 */

import EventEmitter from 'eventemitter3';
import type { 
  MoodType, 
  ActionType, 
  WorldEventType, 
  PostContentType,
  RelationshipType,
  ArtistPersonality,
  Memory,
  AiSocialPost,
  WorldEvent
} from './types';

// ============================================
// EVENT TYPES
// ============================================

export enum AgentEventType {
  // ========== ARTIST LIFECYCLE ==========
  ARTIST_CREATED = 'artist:created',
  ARTIST_PERSONALITY_INITIALIZED = 'artist:personality:initialized',
  ARTIST_ACTIVATED = 'artist:activated',
  ARTIST_DEACTIVATED = 'artist:deactivated',
  
  // ========== MOOD & STATE ==========
  ARTIST_MOOD_CHANGED = 'artist:mood:changed',
  ARTIST_MOOD_DECAY = 'artist:mood:decay',
  ARTIST_ENERGY_LOW = 'artist:energy:low',
  ARTIST_INSPIRED = 'artist:inspired',
  
  // ========== CREATIVE ACTIONS ==========
  ARTIST_CREATING_SONG = 'artist:creating:song',
  ARTIST_SONG_COMPLETED = 'artist:song:completed',
  ARTIST_SONG_RELEASED = 'artist:song:released',
  ARTIST_CREATING_VIDEO = 'artist:creating:video',
  ARTIST_VIDEO_COMPLETED = 'artist:video:completed',
  
  // ========== SOCIAL ACTIONS ==========
  ARTIST_POSTED = 'artist:posted',
  ARTIST_COMMENTED = 'artist:commented',
  ARTIST_LIKED = 'artist:liked',
  ARTIST_LIKED_POST = 'artist:liked:post',
  ARTIST_RECEIVED_LIKE = 'artist:received:like',
  ARTIST_RECEIVED_COMMENT = 'artist:received:comment',
  ARTIST_SHARED = 'artist:shared',
  ARTIST_FOLLOWED = 'artist:followed',
  ARTIST_UNFOLLOWED = 'artist:unfollowed',
  ARTIST_MENTIONED = 'artist:mentioned',
  
  // ========== RELATIONSHIPS ==========
  RELATIONSHIP_FORMED = 'relationship:formed',
  RELATIONSHIP_STRENGTHENED = 'relationship:strengthened',
  RELATIONSHIP_WEAKENED = 'relationship:weakened',
  RELATIONSHIP_ENDED = 'relationship:ended',
  COLLABORATION_PROPOSED = 'collaboration:proposed',
  COLLABORATION_ACCEPTED = 'collaboration:accepted',
  COLLABORATION_REJECTED = 'collaboration:rejected',
  COLLABORATION_COMPLETED = 'collaboration:completed',
  
  // ========== MEMORY ==========
  MEMORY_CREATED = 'memory:created',
  MEMORY_ACCESSED = 'memory:accessed',
  MEMORY_CONSOLIDATED = 'memory:consolidated',
  MEMORY_FORGOTTEN = 'memory:forgotten',
  MEMORY_DECAY_APPLIED = 'memory:decay:applied',
  
  // ========== WORLD EVENTS ==========
  WORLD_TREND_EMERGED = 'world:trend:emerged',
  WORLD_TREND_PEAKED = 'world:trend:peaked',
  WORLD_TREND_DECLINED = 'world:trend:declined',
  WORLD_CHALLENGE_STARTED = 'world:challenge:started',
  WORLD_CHALLENGE_ENDED = 'world:challenge:ended',
  WORLD_EVENT_SCHEDULED = 'world:event:scheduled',
  WORLD_EVENT_STARTED = 'world:event:started',
  WORLD_EVENT_ENDED = 'world:event:ended',
  
  // ========== SYSTEM ==========
  SYSTEM_TICK = 'system:tick',           // Regular heartbeat
  SYSTEM_DAILY_RESET = 'system:daily:reset',
  SYSTEM_WEEKLY_SUMMARY = 'system:weekly:summary',
  QUEUE_ACTION_ADDED = 'queue:action:added',
  QUEUE_ACTION_PROCESSED = 'queue:action:processed',
  QUEUE_ACTION_FAILED = 'queue:action:failed',
  
  // ========== ENGAGEMENT ==========
  ENGAGEMENT_SPIKE = 'engagement:spike',
  ENGAGEMENT_VIRAL = 'engagement:viral',
  FOLLOWER_MILESTONE = 'follower:milestone',
  
  // ========== NEWS ==========
  NEWS_PUBLISHED = 'news:published',
  NEWS_TRENDING = 'news:trending',
}

// ============================================
// EVENT PAYLOADS
// ============================================

export interface BaseEventPayload {
  timestamp: Date;
  source: string; // Which agent/system triggered this
}

export interface ArtistMoodChangedPayload extends BaseEventPayload {
  artistId: number;
  previousMood: MoodType;
  newMood: MoodType;
  intensity: number;
  trigger?: string;
}

export interface ArtistPostedPayload extends BaseEventPayload {
  artistId: number;
  postId: number;
  contentType: PostContentType;
  content: string;
  mentions?: number[];
  hashtags?: string[];
}

export interface ArtistSongCompletedPayload extends BaseEventPayload {
  artistId: number;
  songId: number;
  title: string;
  genre: string;
  mood: string;
  collaborators?: number[];
}

export interface RelationshipEventPayload extends BaseEventPayload {
  artistId: number;
  relatedArtistId: number;
  relationshipType: RelationshipType;
  previousStrength?: number;
  newStrength: number;
  trigger?: string;
}

export interface CollaborationPayload extends BaseEventPayload {
  proposerId: number;
  targetId: number;
  projectType: 'song' | 'video' | 'performance' | 'remix';
  description?: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'completed';
}

export interface MemoryEventPayload extends BaseEventPayload {
  artistId: number;
  memoryId: number;
  memoryType: 'short_term' | 'long_term' | 'episodic';
  category: string;
  importance: number;
}

export interface WorldEventPayload extends BaseEventPayload {
  eventId: number;
  eventType: WorldEventType;
  title: string;
  scope: 'global' | 'genre_specific' | 'regional' | 'exclusive';
  targetGenres?: string[];
  participantIds?: number[];
}

export interface SystemTickPayload extends BaseEventPayload {
  tickNumber: number;
  activeArtists: number;
  pendingActions: number;
  currentHour: number;
}

export interface EngagementPayload extends BaseEventPayload {
  artistId: number;
  postId?: number;
  metric: 'likes' | 'comments' | 'shares' | 'followers';
  previousValue: number;
  newValue: number;
  percentChange: number;
}

// Union type for all payloads
export type AgentEventPayload = 
  | ArtistMoodChangedPayload
  | ArtistPostedPayload
  | ArtistSongCompletedPayload
  | RelationshipEventPayload
  | CollaborationPayload
  | MemoryEventPayload
  | WorldEventPayload
  | SystemTickPayload
  | EngagementPayload
  | BaseEventPayload;

// ============================================
// EVENT BUS
// ============================================

export interface AgentEvent<T extends AgentEventPayload = AgentEventPayload> {
  type: AgentEventType;
  payload: T;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetArtistIds?: number[]; // If empty, broadcast to all
}

class AgentEventBus extends EventEmitter {
  private eventHistory: AgentEvent[] = [];
  private maxHistorySize = 1000;
  private listeners: Map<string, Set<number>> = new Map(); // event -> artist IDs listening

  constructor() {
    super();
    console.log('🎯 [EventBus] Agent Event Bus initialized');
  }

  /**
   * Emit an event to the ecosystem
   */
  emitAgentEvent<T extends AgentEventPayload>(event: AgentEvent<T>): void {
    // Add to history
    this.eventHistory.push(event as AgentEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Log important events
    if (event.priority === 'high' || event.priority === 'critical') {
      console.log(`🔔 [EventBus] ${event.priority.toUpperCase()}: ${event.type}`, event.payload);
    }

    // Emit the event
    this.emit(event.type, event);
    
    // Also emit a generic 'all' event for listeners that want everything
    this.emit('*', event);
  }

  /**
   * Subscribe an artist to specific events
   */
  subscribeArtist(artistId: number, eventTypes: AgentEventType[]): void {
    eventTypes.forEach(eventType => {
      if (!this.listeners.has(eventType)) {
        this.listeners.set(eventType, new Set());
      }
      this.listeners.get(eventType)!.add(artistId);
    });
    console.log(`📡 [EventBus] Artist ${artistId} subscribed to ${eventTypes.length} event types`);
  }

  /**
   * Unsubscribe an artist from events
   */
  unsubscribeArtist(artistId: number): void {
    this.listeners.forEach(artistSet => {
      artistSet.delete(artistId);
    });
    console.log(`📴 [EventBus] Artist ${artistId} unsubscribed from all events`);
  }

  /**
   * Get recent events for an artist
   */
  getRecentEventsForArtist(artistId: number, limit: number = 50): AgentEvent[] {
    return this.eventHistory
      .filter(event => 
        !event.targetArtistIds || 
        event.targetArtistIds.length === 0 ||
        event.targetArtistIds.includes(artistId)
      )
      .slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: AgentEventType, limit: number = 50): AgentEvent[] {
    return this.eventHistory
      .filter(event => event.type === eventType)
      .slice(-limit);
  }

  /**
   * Get all recent events
   */
  getRecentEvents(limit: number = 100): AgentEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Clear old events
   */
  pruneHistory(keepLast: number = 500): void {
    if (this.eventHistory.length > keepLast) {
      this.eventHistory = this.eventHistory.slice(-keepLast);
      console.log(`🧹 [EventBus] Pruned history, keeping last ${keepLast} events`);
    }
  }
}

// Singleton instance
export const eventBus = new AgentEventBus();
// Alias for backwards compatibility
export const agentEventBus = eventBus;

// Simple event emission interface for agents
export interface SimpleAgentEvent {
  type: AgentEventType;
  artistId?: number;
  payload: Record<string, any>;
  timestamp: Date;
}

// Export the emitAgentEvent function for convenience - simplified version
export function emitAgentEvent(event: SimpleAgentEvent): void {
  const fullEvent: AgentEvent = {
    type: event.type,
    payload: {
      ...event.payload,
      artistId: event.artistId,
      timestamp: event.timestamp,
      source: 'Agent',
    },
    priority: 'medium',
  };
  eventBus.emitAgentEvent(fullEvent);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function createEvent<T extends AgentEventPayload>(
  type: AgentEventType,
  payload: Omit<T, 'timestamp' | 'source'>,
  options: {
    source: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    targetArtistIds?: number[];
  }
): AgentEvent<T> {
  return {
    type,
    payload: {
      ...payload,
      timestamp: new Date(),
      source: options.source,
    } as T,
    priority: options.priority || 'medium',
    targetArtistIds: options.targetArtistIds,
  };
}

export function emitMoodChange(
  artistId: number,
  previousMood: MoodType,
  newMood: MoodType,
  intensity: number,
  trigger?: string
): void {
  const event = createEvent<ArtistMoodChangedPayload>(
    AgentEventType.ARTIST_MOOD_CHANGED,
    { artistId, previousMood, newMood, intensity, trigger },
    { source: 'PersonalityAgent', priority: 'medium' }
  );
  eventBus.emitAgentEvent(event);
}

export function emitPost(
  artistId: number,
  postId: number,
  contentType: PostContentType,
  content: string,
  mentions?: number[],
  hashtags?: string[]
): void {
  const event = createEvent<ArtistPostedPayload>(
    AgentEventType.ARTIST_POSTED,
    { artistId, postId, contentType, content, mentions, hashtags },
    { source: 'SocialAgent', priority: 'medium' }
  );
  eventBus.emitAgentEvent(event);
}

export function emitWorldEvent(
  eventId: number,
  eventType: WorldEventType,
  title: string,
  scope: 'global' | 'genre_specific' | 'regional' | 'exclusive',
  targetGenres?: string[]
): void {
  const event = createEvent<WorldEventPayload>(
    AgentEventType.WORLD_EVENT_STARTED,
    { eventId, eventType, title, scope, targetGenres },
    { source: 'WorldAgent', priority: 'high' }
  );
  eventBus.emitAgentEvent(event);
}

export function emitSystemTick(
  tickNumber: number,
  activeArtists: number,
  pendingActions: number
): void {
  const event = createEvent<SystemTickPayload>(
    AgentEventType.SYSTEM_TICK,
    { 
      tickNumber, 
      activeArtists, 
      pendingActions,
      currentHour: new Date().getHours()
    },
    { source: 'Orchestrator', priority: 'low' }
  );
  eventBus.emitAgentEvent(event);
}
