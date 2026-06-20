import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

export type SparkPoint = { x: number; y: number };

export type AcquisitionRange = '7D' | '30D' | '90D' | '12M';

export interface AcquisitionScoreDimensions {
  talent: number;
  branding: number;
  readiness: number;
  monetization: number;
  reach: number;
  virality: number;
  ecosystem: number;
}

export interface AcquisitionFeaturedArtist {
  id: string;
  name: string;
  verified: boolean;
  genres: string[];
  location: string;
  avatar: string;
  growthScore: number;
  growthSpark: SparkPoint[];
  metrics: {
    monthlyListeners: string;
    followers: string;
    engagement: string;
    saveRatio: string;
  };
  scoreDimensions?: AcquisitionScoreDimensions;
}

export interface AcquisitionEcosystemNode {
  id: string;
  label: string;
  value: string;
  angle: number;
}

export interface AcquisitionSequences {
  steps: { id: string; label: string; day: string; active?: boolean }[];
  performance: {
    delivered: string;
    openRate: string;
    replyRate: string;
    positiveReply: string;
    spark: SparkPoint[];
  };
  meta: {
    activeSequences: number;
    completedSequences: number;
    emailsSentThisWeek: number;
  };
}

export interface AcquisitionPipeline {
  range: string;
  stages: { label: string; value: string; width: number }[];
  conversionRate: string;
  delta: string;
  sources: { label: string; pct: number }[];
}

export interface AcquisitionAnalytics {
  range?: AcquisitionRange;
  ranges: string[];
  active: string;
  kpis: { label: string; value: string; delta: string; spark: SparkPoint[] }[];
}

export interface AcquisitionActivity {
  icon: string;
  text: string;
  time: string;
}

export type AcquisitionAgentStatus =
  | 'running'
  | 'idle'
  | 'waiting'
  | 'not_configured'
  | 'planned'
  | 'error';

export interface AcquisitionAgent {
  id: string;
  name: string;
  icon: string;
  status: AcquisitionAgentStatus;
  kpi: string;
  description: string;
  lastRun?: string | null;
}

export interface AcquisitionOverview {
  ok: boolean;
  updatedAt: string;
  range?: AcquisitionRange;
  featuredArtist: AcquisitionFeaturedArtist | null;
  ecosystem: AcquisitionEcosystemNode[];
  masterJson: Record<string, any> | null;
  sequences: AcquisitionSequences;
  pipeline: AcquisitionPipeline;
  analytics: AcquisitionAnalytics;
  activity: AcquisitionActivity[];
  agents?: AcquisitionAgent[];
  summary: {
    totalLeads: number;
    hotLeads: number;
    avgScore: number;
    activeSequences: number;
    conversionRate: string;
    goalPerformance: number | null;
    goalTrend: string | null;
  };
}

export function useAcquisitionOverview(range: AcquisitionRange = '30D') {
  return useQuery<AcquisitionOverview>({
    queryKey: ['admin', 'artist-acquisition', 'overview', range],
    queryFn: async () =>
      apiRequest(
        'GET',
        `/api/admin/artist-acquisition/overview?range=${encodeURIComponent(range)}`
      ) as Promise<AcquisitionOverview>,
    refetchInterval: 60_000, // auto-refresh every 60s
    staleTime: 30_000,
  });
}
