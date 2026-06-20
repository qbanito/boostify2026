/**
 * BOOSTIFY AUTONOMOUS AGENTS - Type Definitions
 * The first AI-native music social network
 */

// ============================================
// PERSONALITY TYPES
// ============================================

export interface PersonalityTraits {
  // Big Five (0-100)
  openness: number;          // Creativity, curiosity
  conscientiousness: number; // Discipline, organization
  extraversion: number;      // Sociability, energy
  agreeableness: number;     // Cooperation, empathy
  neuroticism: number;       // Emotional instability
}

export interface ArtisticTraits {
  experimentalism: number;   // 0=Traditional, 100=Avant-garde
  commercialism: number;     // 0=Underground, 100=Mainstream
  collaboration: number;     // 0=Solo, 100=Collaborative
  authenticity: number;      // 0=Trend-follower, 100=Trendsetter
  ambition: number;          // 0=Content, 100=Ambitious
  vulnerability: number;     // 0=Private, 100=Open
}

export type MoodType = 
  | 'inspired' 
  | 'reflective' 
  | 'energetic' 
  | 'melancholic' 
  | 'rebellious' 
  | 'peaceful' 
  | 'anxious' 
  | 'confident' 
  | 'frustrated' 
  | 'euphoric';

export type CommunicationStyle = 
  | 'poetic' 
  | 'direct' 
  | 'mysterious' 
  | 'humorous' 
  | 'philosophical' 
  | 'provocative' 
  | 'gentle' 
  | 'intense';

export interface ArtistPersonality {
  artistId: number;
  traits: PersonalityTraits;
  artisticTraits: ArtisticTraits;
  currentMood: MoodType;
  moodIntensity: number;
  artisticVision: string;
  coreValues: string[];
  influences: string[];
  antiInfluences: string[];
  communicationStyle: CommunicationStyle;
  shortTermGoals: string[];
  longTermGoals: string[];
  currentFocus: string;
  activityPattern: {
    peakCreativityHours: number[];
    socialActivityLevel: 'low' | 'medium' | 'high';
    collaborationFrequency: 'rarely' | 'sometimes' | 'often';
    postingFrequency: 'daily' | 'few_times_week' | 'weekly' | 'sporadic';
  };
}

// ============================================
// MEMORY TYPES
// ============================================

export type MemoryType = 'short_term' | 'long_term' | 'episodic' | 'semantic' | 'procedural';

export type MemoryCategory = 
  | 'interaction' 
  | 'creation' 
  | 'collaboration' 
  | 'achievement' 
  | 'failure' 
  | 'insight' 
  | 'relationship' 
  | 'event' 
  | 'decision';

export interface Memory {
  id: number;
  artistId: number;
  memoryType: MemoryType;
  category: MemoryCategory;
  content: string;
  context: {
    relatedArtists?: number[];
    relatedSongs?: number[];
    relatedPosts?: number[];
    emotions?: string[];
    trigger?: string;
  };
  importance: number;
  emotionalWeight: number;
  accessCount: number;
  linkedMemories: number[];
  tags: string[];
  createdAt: Date;
  expiresAt?: Date;
}

// ============================================
// RELATIONSHIP TYPES
// ============================================

export type RelationshipType = 
  | 'friend' 
  | 'rival' 
  | 'mentor' 
  | 'mentee' 
  | 'collaborator' 
  | 'admirer' 
  | 'fan' 
  | 'acquaintance' 
  | 'competitor';

export interface ArtistRelationship {
  artistId: number;
  relatedArtistId: number;
  relationshipType: RelationshipType;
  strength: number;      // 0-100
  trust: number;         // 0-100
  respect: number;       // 0-100
  affinity: number;      // 0-100
  interactionCount: number;
  collaborationCount: number;
  lastInteraction?: Date;
  history: Array<{
    date: string;
    event: string;
    impact: number; // -100 to +100
  }>;
  isMutual: boolean;
}

// ============================================
// ACTION TYPES
// ============================================

export type ActionType = 
  | 'create_song' 
  | 'create_post' 
  | 'respond_comment' 
  | 'comment_on_post'
  | 'follow_artist' 
  | 'like_post' 
  | 'collaborate' 
  | 'update_mood' 
  | 'generate_content' 
  | 'schedule_release' 
  | 'engage_trend'
  // Collaboration actions
  | 'propose_collaboration'
  | 'respond_collaboration'
  | 'progress_collaboration'
  // Economic actions
  | 'buy_token'
  | 'sell_token'
  | 'stake_tokens'
  | 'sponsor_collab'
  | 'invest_in_artist'
  // Beef/Drama actions
  | 'start_beef'
  | 'respond_beef'
  | 'create_diss_track'
  | 'resolve_beef'
  // Music actions
  | 'generate_music'
  | 'publish_song'
  | 'tokenize_song';

export type ActionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface AgentAction {
  id?: number;
  artistId: number;
  actionType: ActionType;
  priority: number;
  payload: Record<string, any>;
  scheduledFor: Date;
  status: ActionStatus;
  attempts: number;
  triggeredBy?: string;
  relatedEventId?: number;
}

// ============================================
// WORLD EVENT TYPES
// ============================================

export type WorldEventType = 
  | 'trend' 
  | 'challenge' 
  | 'award' 
  | 'festival' 
  | 'controversy' 
  | 'collaboration_call' 
  | 'milestone' 
  | 'news' 
  | 'competition';

export interface WorldEvent {
  id?: number;
  eventType: WorldEventType;
  title: string;
  description: string;
  scope: 'global' | 'genre_specific' | 'regional' | 'exclusive';
  targetGenres?: string[];
  impact: {
    moodEffect?: { mood: MoodType; intensity: number };
    creativityBoost?: number;
    collaborationChance?: number;
    visibilityMultiplier?: number;
  };
  participantIds: number[];
  maxParticipants?: number;
  rewards?: {
    visibility?: number;
    followers?: number;
    credibility?: number;
    tokens?: number;
  };
  startsAt: Date;
  endsAt?: Date;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

// ============================================
// SOCIAL POST TYPES
// ============================================

// Extended PostContentType for social agent
export type PostContentType = 
  | 'thought' 
  | 'creative_process'
  | 'music_snippet'
  | 'behind_the_scenes'
  | 'announcement'
  | 'collaboration_call'
  | 'inspiration'
  | 'personal_story'
  | 'text' 
  | 'image' 
  | 'video' 
  | 'song_release' 
  | 'collaboration' 
  | 'behind_scenes' 
  | 'reaction';

export type PostSentiment = 
  | 'positive' 
  | 'negative' 
  | 'neutral' 
  | 'supportive' 
  | 'critical' 
  | 'curious' 
  | 'excited';

export interface AiSocialPost {
  id?: number;
  artistId: number;
  contentType: PostContentType;
  content: string;
  mediaUrls?: string[];
  generatedFromMood?: MoodType;
  generatedFromEvent?: number;
  likes: number;
  comments: number;
  shares: number;
  aiLikes: number;
  aiComments: number;
  hashtags?: string[];
  mentions?: number[];
  visibility: 'public' | 'followers' | 'collaborators' | 'private';
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  publishedAt?: Date;
}

// ============================================
// AGENT CONTEXT
// ============================================

export interface AgentContext {
  artist: {
    id: number;
    name: string;
    genre: string[];
    personality: ArtistPersonality;
    recentMemories: Memory[];
    relationships: ArtistRelationship[];
    recentPosts: AiSocialPost[];
    stats: {
      followers: number;
      following: number;
      totalPosts: number;
      totalSongs: number;
      engagement: number;
    };
  };
  world: {
    currentTrends: string[];
    activeEvents: WorldEvent[];
    recentGlobalPosts: AiSocialPost[];
  };
  timestamp: Date;
}

// ============================================
// AGENT DECISION
// ============================================

export interface AgentDecision {
  action: ActionType;
  reasoning: string;
  confidence: number; // 0-100
  payload: Record<string, any>;
  alternatives?: Array<{
    action: ActionType;
    reasoning: string;
    confidence: number;
  }>;
}

// ============================================
// ADDITIONAL TYPES FOR AGENTS
// ============================================

export type MemoryImportance = 'trivial' | 'low' | 'medium' | 'high' | 'critical' | 'core_identity';

export interface EmotionalContext {
  valence: number;    // 0-1: negative to positive
  arousal: number;    // 0-1: calm to excited
  dominance: number;  // 0-1: submissive to dominant
}

export type MemoryCategory = 'interaction' | 'creation' | 'collaboration' | 'achievement' | 'failure' | 'insight' | 'relationship' | 'event' | 'decision';

export interface ArtistMemory {
  id: number;
  artistId: number;
  memoryType: MemoryType;
  category: MemoryCategory;
  content: string;
  context?: {
    relatedArtists?: number[];
    relatedSongs?: number[];
    relatedPosts?: number[];
    emotions?: string[];
    location?: string;
    trigger?: string;
  };
  importance: number;  // 0-100
  emotionalWeight?: number;  // 0-100
  accessCount?: number;
  expiresAt?: Date;
  lastAccessedAt?: Date;
  linkedMemories?: number[];
  tags?: string[];
  createdAt: Date;
}

export interface SocialPost {
  id: number;
  artistId: number;
  contentType: string;
  content: string;
  hashtags: string[];
  moodWhenPosted: string;
  visualDescription?: string;
  engagementScore: number;
  likes: number;
  comments: number;
  shares: number;
  isVisible: boolean;
  createdAt: Date;
}

export interface PostComment {
  id: number;
  postId: number;
  artistId: number;
  content: string;
  sentiment: string;
  createdAt: Date;
}
