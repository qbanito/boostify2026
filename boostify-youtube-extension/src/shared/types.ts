// Boostify YouTube Extension — Type Definitions

export interface ConnectionInfo {
  connectionId: number;
  userId: number;
  syncToken: string;
  channelId: string;
  channelName: string;
  channelUrl?: string;
  status: 'active' | 'paused' | 'revoked';
  lastSyncAt?: string;
}

export interface ChannelSnapshot {
  id: number;
  connectionId: number;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  watchTimeHours: number;
  avgViewDuration: number;
  topVideos: VideoStat[];
  recentUploads: RecentUpload[];
  trafficSources: Record<string, number>;
  demographics: Record<string, any>;
  snapshotAt: string;
}

export interface VideoStat {
  videoId: string;
  title: string;
  views: number;
  ctr: number;
}

export interface RecentUpload {
  videoId: string;
  title: string;
  publishedAt: string;
  views: number;
}

export interface PendingAction {
  id: number;
  userId: number;
  connectionId: number;
  actionType: ActionType;
  targetVideoId?: string;
  targetVideoTitle?: string;
  payload: Record<string, any>;
  status: 'pending' | 'sent' | 'applied' | 'failed' | 'cancelled';
  generatedBy?: string;
  priority: number;
  createdAt: string;
  sentAt?: string;
  appliedAt?: string;
  resultMessage?: string;
}

export type ActionType = 
  | 'update_title' 
  | 'update_tags' 
  | 'update_description' 
  | 'update_thumbnail'
  | 'schedule_video' 
  | 'publish_video'
  | 'add_end_screen'
  | 'add_cards';

export interface YouTubeEvent {
  id: number;
  connectionId: number;
  eventType: EventType;
  eventData: Record<string, any>;
  processed: boolean;
  processedAt?: string;
  createdAt: string;
}

export type EventType = 
  | 'video_published'
  | 'comment_received'
  | 'subscriber_milestone'
  | 'ranking_change'
  | 'revenue_update'
  | 'strike_received'
  | 'video_deleted'
  | 'channel_update';

export interface SyncResponse {
  success: boolean;
  snapshotId: number;
  pendingActions: PendingAction[];
  nextSyncInMinutes: number;
}

export interface ExtractedChannelData {
  channelId: string;
  channelName: string;
  channelUrl: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface ExtractedVideoData {
  videoId: string;
  title: string;
  description: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  duration: string;
  tags: string[];
  thumbnailUrl: string;
  channelName: string;
  channelId: string;
}

export interface ExtractedStudioAnalytics {
  views: number;
  watchTimeMinutes: number;
  subscribers: number;
  revenue?: number;
  ctr?: number;
  avgViewDuration?: number;
  topVideos: VideoStat[];
  trafficSources: Record<string, number>;
  demographics: Record<string, any>;
}

// Messages between extension components
export interface ExtMessage {
  type: string;
  data?: any;
}

export interface SyncStatsMessage extends ExtMessage {
  type: 'SYNC_STATS';
  data: {
    subscribers: number;
    totalViews: number;
    videoCount: number;
    watchTimeHours?: number;
    avgViewDuration?: number;
    topVideos?: VideoStat[];
    recentUploads?: RecentUpload[];
    trafficSources?: Record<string, number>;
    demographics?: Record<string, any>;
  };
}

export interface ActionAppliedMessage extends ExtMessage {
  type: 'ACTION_APPLIED';
  data: {
    actionId: number;
    status: 'applied' | 'failed' | 'cancelled';
    resultMessage?: string;
  };
}

export interface NewVideoDetectedMessage extends ExtMessage {
  type: 'NEW_VIDEO_DETECTED';
  data: ExtractedVideoData;
}

export interface PageChangedMessage extends ExtMessage {
  type: 'PAGE_CHANGED';
  data: {
    url: string;
    pageType: 'home' | 'video' | 'channel' | 'search' | 'studio' | 'studio-video' | 'other';
    videoId?: string;
    channelId?: string;
  };
}

export interface ExtSettings {
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  notificationsEnabled: boolean;
  autoOptimizeEnabled: boolean;
  showOverlays: boolean;
  showSeoHints: boolean;
  apiBaseUrl: string;
}

export const DEFAULT_SETTINGS: ExtSettings = {
  syncEnabled: true,
  syncIntervalMinutes: 5,
  notificationsEnabled: true,
  autoOptimizeEnabled: false,
  showOverlays: true,
  showSeoHints: true,
  apiBaseUrl: '',
};
