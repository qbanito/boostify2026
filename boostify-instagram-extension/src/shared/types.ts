// Boostify Instagram Extension — Type Definitions

export interface ConnectionInfo {
  connectionId: number;
  userId: number;
  syncToken: string;
  instagramUsername: string;
  displayName: string;
  profileUrl?: string;
  status: 'active' | 'paused' | 'revoked';
  lastSyncAt?: string;
}

export interface ProfileSnapshot {
  id: number;
  connectionId: number;
  followers: number;
  following: number;
  postsCount: number;
  bio: string;
  isVerified: boolean;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  recentPosts: PostData[];
  topHashtags: string[];
  audienceDemographics: Record<string, any>;
  snapshotAt: string;
}

export interface PostData {
  postId: string;
  caption: string;
  likes: number;
  comments: number;
  type: 'image' | 'video' | 'carousel' | 'reel' | 'story';
  timestamp: string;
  imageUrl?: string;
}

export interface PendingAction {
  id: number;
  userId: number;
  connectionId: number;
  actionType: IGActionType;
  targetPostId?: string;
  targetPostCaption?: string;
  payload: Record<string, any>;
  status: 'pending' | 'sent' | 'applied' | 'failed' | 'cancelled';
  generatedBy?: string;
  priority: number;
  createdAt: string;
  sentAt?: string;
  appliedAt?: string;
  resultMessage?: string;
}

export type IGActionType =
  | 'post_caption'
  | 'update_bio'
  | 'schedule_post'
  | 'reply_comment'
  | 'follow_user'
  | 'use_hashtags'
  | 'post_story'
  | 'post_reel';

export interface InstagramEvent {
  id: number;
  connectionId: number;
  eventType: IGEventType;
  eventData: Record<string, any>;
  processed: boolean;
  processedAt?: string;
  createdAt: string;
}

export type IGEventType =
  | 'post_published'
  | 'story_published'
  | 'reel_published'
  | 'follower_milestone'
  | 'comment_received'
  | 'mention_received'
  | 'dm_received'
  | 'profile_update'
  | 'engagement_spike';

export interface SyncResponse {
  success: boolean;
  snapshotId: number;
  pendingActions: PendingAction[];
  nextSyncInMinutes: number;
}

export interface ExtractedProfileData {
  username: string;
  displayName: string;
  bio: string;
  profileUrl: string;
  profilePicUrl: string;
  followers: number;
  following: number;
  postsCount: number;
  isVerified: boolean;
  isPrivate: boolean;
  externalUrl?: string;
  category?: string;
}

export interface ExtractedPostData {
  postId: string;
  caption: string;
  likes: number;
  comments: number;
  type: 'image' | 'video' | 'carousel' | 'reel';
  timestamp: string;
  imageUrl?: string;
  videoUrl?: string;
  location?: string;
  hashtags: string[];
}

export interface ExtSettings {
  syncEnabled: boolean;
  syncInterval: number;
  showOverlays: boolean;
  showNotifications: boolean;
  autoHashtags: boolean;
  autoCaptions: boolean;
  apiBaseUrl: string;
}

export const DEFAULT_SETTINGS: ExtSettings = {
  syncEnabled: true,
  syncInterval: 5,
  showOverlays: true,
  showNotifications: true,
  autoHashtags: false,
  autoCaptions: false,
  apiBaseUrl: '',
};

// Extraction types
export type ExtractType = 'followers' | 'following' | 'hashtag' | 'location' | 'commenters' | 'likers' | 'custom';
export type SortMode = 'recent' | 'rank';

export interface ExtractedUser {
  username: string;
  displayName: string;
  profilePicUrl: string;
  isVerified: boolean;
  isPrivate: boolean;
  bio?: string;
  email?: string;
  phone?: string;
  website?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  category?: string;
  isBusiness?: boolean;
  source: ExtractType;
  sourceQuery?: string;
  extractedAt: string;
  enriched?: boolean;
}

export interface BanProtectionConfig {
  delayBetweenProfilesMs: number;
  maxProfilesPerSession: number;
  cooldownMinutes: number;
  jitterPercent: number;
  pauseOnWarning: boolean;
}

export interface ExtractionJob {
  id: string;
  type: ExtractType;
  query?: string;
  sortMode?: SortMode;
  maxUsers: number;
  enrichProfiles: boolean;
  status: 'pending' | 'running' | 'enriching' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  total: number;
  enrichProgress: number;
  results: ExtractedUser[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
  // Scheduler
  isScheduled: boolean;
  intervalMinutes?: number;
  nextRunAt?: string;
  // Ban protection stats
  warningsCount: number;
  sessionProfileCount: number;
}

// Message types for chrome.runtime messaging
export type MessageType =
  | { type: 'GET_CONNECTION_STATUS' }
  | { type: 'SYNC_NOW' }
  | { type: 'PROFILE_DATA_EXTRACTED'; data: ExtractedProfileData }
  | { type: 'POST_DATA_EXTRACTED'; data: ExtractedPostData[] }
  | { type: 'CONNECT'; token: string }
  | { type: 'DISCONNECT' }
  | { type: 'GET_PENDING_ACTIONS' }
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'START_EXTRACTION'; extractType: ExtractType; query?: string; sortMode?: SortMode; maxUsers?: number; enrichProfiles?: boolean; banProtection?: Partial<BanProtectionConfig> }
  | { type: 'SCHEDULE_EXTRACTION'; extractType: ExtractType; query?: string; sortMode?: SortMode; maxUsers?: number; enrichProfiles?: boolean; intervalMinutes: number; banProtection?: Partial<BanProtectionConfig> }
  | { type: 'STOP_SCHEDULED_EXTRACTION' }
  | { type: 'CANCEL_EXTRACTION' }
  | { type: 'GET_EXTRACTION_STATUS' }
  | { type: 'EXTRACTION_PROGRESS'; jobId: string; count: number; total: number; phase?: 'extracting' | 'enriching'; currentUser?: string }
  | { type: 'EXTRACTION_COMPLETE'; jobId: string; results: ExtractedUser[] }
  | { type: 'EXTRACTION_ERROR'; jobId: string; error: string }
  | { type: 'GET_EXTRACTION_RESULTS' }
  | { type: 'PING' }
  | { type: 'RUN_BOOSTIFY_TOOL'; tool: string }
  | { type: 'GET_PAGE_INFO' }
  | { type: 'GET_LOGGED_IN_USER' }
  | { type: 'LOGGED_IN_USER_DETECTED'; username: string; profilePicUrl?: string };
