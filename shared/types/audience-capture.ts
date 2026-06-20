// ─── Audience Capture Engine — Shared TypeScript types ───────────────────────

export type ContentPillar =
  | 'music'
  | 'character'
  | 'story'
  | 'lifestyle'
  | 'community'
  | 'product'
  | 'authority';

export type ContentType =
  | 'hook'
  | 'identity'
  | 'story'
  | 'song'
  | 'conversion'
  | 'community'
  | 'authority'
  | 'viral_format'
  | 'retargeting'
  | 'product';

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'twitter' | 'threads';

export interface AudienceProfile {
  id?: number;
  artistId: number;
  // Demographics
  primaryAgeRange: string;         // e.g. "18-35"
  languages: string[];             // e.g. ["es","en"]
  locations: string[];             // e.g. ["Miami","Mexico","Colombia"]
  // Psychographics
  interests: string[];
  emotionalTriggers: string[];
  // Platform behaviour
  platforms: Platform[];
  preferredFormats: string[];
  attentionSpanSeconds: string;    // e.g. "1-3 for hook, 15-45 for retention"
  // Artist positioning
  archetype: string;               // e.g. "caribbean luxury performer"
  promise: string;                 // core value proposition
  visualIdentity: string;         // e.g. "black, orange, gold, tropical"
  tone: string;                   // e.g. "confident, magnetic, aspirational"
  contentToAvoid: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentPillarConfig {
  id?: number;
  artistId: number;
  pillar: ContentPillar;
  isActive: boolean;
  weight: number;   // 1-10 priority weight
  notes: string;
}

export interface ContentCaptureScore {
  id?: number;
  artistId: number;
  contentRef: string;            // external ref (e.g. reel ID or temp UUID)
  hookStrength: number;          // 0-100
  retentionPotential: number;
  identityAlignment: number;
  sharePotential: number;
  commentTrigger: number;
  conversionIntent: number;
  platformFit: number;
  overallScore: number;          // weighted average
  platform: Platform;
  regeneratedCount: number;      // how many times auto-regenerated
  createdAt?: string;
}

export interface ContentMemoryEntry {
  id?: number;
  artistId: number;
  type: 'winning_hook' | 'losing_hook' | 'winning_format' | 'winning_cta' | 'audience_comment';
  value: string;
  platform: Platform;
  score?: number;
  tags: string[];
  createdAt?: string;
}

export interface ContentExperiment {
  id?: number;
  artistId: number;
  songId?: number;
  hypothesis: string;
  platform: Platform;
  budget: number;
  status: 'draft' | 'running' | 'completed';
  variations: ExperimentVariation[];
  results?: ExperimentResults;
  winnerId?: string;
  createdAt?: string;
}

export interface ExperimentVariation {
  id: string;
  hook: string;
  script: string;
  visualPrompt: string;
  caption: string;
  cta: string;
  score?: ContentCaptureScore;
}

export interface ExperimentResults {
  hookRate: number;
  retentionRate: number;
  completionRate: number;
  saveRate: number;
  shareRate: number;
  commentRate: number;
  profileVisitRate: number;
  landingClickRate: number;
  revenuePerContent: number;
  winnerVariationId: string;
}

export interface DailyContentPlan {
  id?: number;
  artistId: number;
  planDate: string;          // ISO date string
  hookTests: number;
  shortReels: number;
  stories: number;
  communityPosts: number;
  conversionPosts: number;
  adVariations: number;
  retargetingAssets: number;
  status: 'draft' | 'approved' | 'published';
  generatedItems?: GeneratedContentItem[];
}

export interface GeneratedContentItem {
  type: ContentType;
  pillar: ContentPillar;
  platform: Platform;
  hook: string;
  script: string;
  visualPrompt: string;
  caption: string;
  cta: string;
  hashtags: string[];
  score: ContentCaptureScore;
}

// ─── Request / Response shapes ────────────────────────────────────────────────

export interface AudienceCaptureGenerateRequest {
  artistId: number;
  platform: Platform;
  goal:
    | 'capture_new_audience'
    | 'build_identity'
    | 'push_song'
    | 'convert_followers'
    | 'activate_community'
    | 'monetize';
  contentType: ContentType;
  songId?: number;
  audienceSegment?: string;
  language?: string;
  duration?: string;
}

export interface AudienceCaptureGenerateResponse {
  hook: string;
  script: string;
  visualPrompt: string;
  caption: string;
  cta: string;
  hashtags: string[];
  score: {
    hookStrength: number;
    retentionPotential: number;
    identityAlignment: number;
    conversionIntent: number;
    overall: number;
  };
  wasRegenerated?: boolean;
}

export interface HookGenerationRequest {
  artistId: number;
  songId?: number;
  platform: Platform;
  count: number;  // typically 5-10
  hookType?: 'curiosity' | 'status' | 'emotional' | 'community' | 'mixed';
}

export interface HookGenerationResponse {
  hooks: Array<{
    id: string;
    text: string;
    type: 'curiosity' | 'status' | 'emotional' | 'community';
    score: number;
    platform: Platform;
  }>;
}

export interface WinningPatterns {
  artistId: number;
  bestHooks: string[];
  bestVisuals: string[];
  bestCtas: string[];
  losingHooks: string[];
  topPlatforms: Platform[];
}
