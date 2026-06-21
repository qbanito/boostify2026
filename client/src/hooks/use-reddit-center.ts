import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

/**
 * use-reddit-center — drives the Reddit Artist Intelligence Center.
 * READ-ONLY market intelligence: the artist connects nothing. Boostify queries
 * Reddit at the platform level (app OAuth) and this hook reads the latest scan
 * snapshot (trends, communities, fan leads, competitors, opportunities,
 * keywords, audience, analytics) plus drives the scan + AI-strategy mutations.
 * Every call goes through `/api/reddit/*`.
 */

export interface RedditConfig {
  genre: string;
  keywords: string[];
  similarArtists: string[];
  autoScan: boolean;
  updatedAt: number;
}
export interface RedditTrend {
  id: string; title: string; subreddit: string; author: string; permalink: string;
  score: number; numComments: number; createdUtc: number;
  trendingScore: number; velocity: number; engagement: number; viralProbability: number; sentiment: string;
}
export interface RedditCommunity {
  name: string; title: string; subscribers: number; activeUsers: number;
  matchScore: number; fanPotential: 'High' | 'Medium' | 'Low'; competitionLevel: 'Low' | 'Medium' | 'High';
  url: string; description: string;
}
export interface RedditOpportunity {
  id: string; title: string; subreddit: string; permalink: string;
  viralProbability: number; engagement: number; velocity: number; score: number; numComments: number; reason: string;
}
export interface RedditKeyword {
  keyword: string; mentions: number; growth: number; sentiment: string;
  topSubreddits: Array<{ subreddit: string; count: number }>;
}
export interface RedditCompetitor {
  artistName: string; mentions: number; growth: number; sentiment: string; sentimentScore: number;
  avgViral: number; topSubreddits: Array<{ subreddit: string; count: number }>;
}
export interface RedditFanLead {
  id: string; title: string; subreddit: string; author: string; permalink: string;
  matchScore: number; potential: 'High' | 'Medium' | 'Low'; numComments: number; createdUtc: number;
}
export interface RedditSentiment { score: number; label: string; positive: number; neutral: number; negative: number; }
export interface RedditAudience {
  sentiment: RedditSentiment; totalReach: number; communityCount: number;
  timeline: Array<{ day: string; mentions: number }>;
  heatmap: Array<{ day: number; hour: number; value: number }>;
}
export interface RedditAnalytics {
  totalCommunities: number; totalReach: number; avgMatchScore: number;
  trendsTracked: number; opportunitiesFound: number; fanLeads: number;
  sentiment: RedditSentiment; timeline: Array<{ day: string; mentions: number }>; avgViral: number;
}
export interface ContentIdea { title: string; subreddit: string; angle: string; format: string; }
export interface RedditReport {
  id: string; summary: string; recommendations: string[]; contentIdeas: ContentIdea[];
  targetCommunities: string[]; dailyPlan: string[]; source: 'llm' | 'heuristic'; reportType: string; createdAt: number;
}

interface Args { artistId: string; artistName: string; }

export function useRedditCenter({ artistId, artistName }: Args) {
  const qc = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ['rd-overview', artistId], enabled: !!artistId,
    queryFn: async () => (await apiRequest({ url: `/api/reddit/overview/${artistId}`, method: 'GET' })) || null,
  });

  const configQuery = useQuery({
    queryKey: ['rd-config', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/config/${artistId}`, method: 'GET' }))?.config || null) as RedditConfig | null,
  });

  const trendsQuery = useQuery({
    queryKey: ['rd-trends', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/trends/${artistId}`, method: 'GET' }))?.trends || []) as RedditTrend[],
  });
  const communitiesQuery = useQuery({
    queryKey: ['rd-communities', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/communities/${artistId}`, method: 'GET' }))?.communities || []) as RedditCommunity[],
  });
  const opportunitiesQuery = useQuery({
    queryKey: ['rd-opportunities', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/opportunities/${artistId}`, method: 'GET' }))?.opportunities || []) as RedditOpportunity[],
  });
  const competitorsQuery = useQuery({
    queryKey: ['rd-competitors', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/competitors/${artistId}`, method: 'GET' }))?.competitors || []) as RedditCompetitor[],
  });
  const keywordsQuery = useQuery({
    queryKey: ['rd-keywords', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/keywords/${artistId}`, method: 'GET' }))?.keywords || []) as RedditKeyword[],
  });
  const fansQuery = useQuery({
    queryKey: ['rd-fans', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/fans/${artistId}`, method: 'GET' }))?.fanLeads || []) as RedditFanLead[],
  });
  const audienceQuery = useQuery({
    queryKey: ['rd-audience', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/audience/${artistId}`, method: 'GET' }))?.audience || null) as RedditAudience | null,
  });
  const analyticsQuery = useQuery({
    queryKey: ['rd-analytics', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/analytics/${artistId}`, method: 'GET' }))?.analytics || null) as RedditAnalytics | null,
  });
  const reportsQuery = useQuery({
    queryKey: ['rd-reports', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/reddit/reports/${artistId}`, method: 'GET' }))?.reports || []) as RedditReport[],
  });

  const invalidateAll = () => {
    ['rd-overview', 'rd-trends', 'rd-communities', 'rd-opportunities', 'rd-competitors', 'rd-keywords', 'rd-fans', 'rd-audience', 'rd-analytics']
      .forEach((k) => qc.invalidateQueries({ queryKey: [k, artistId] }));
  };

  const scan = useMutation({
    mutationFn: async (v?: { genre?: string }) =>
      apiRequest({ url: `/api/reddit/scan/${artistId}`, method: 'POST', data: { artistName, genre: v?.genre } }),
    onSuccess: () => invalidateAll(),
  });

  const saveConfig = useMutation({
    mutationFn: async (v: Partial<RedditConfig>) =>
      apiRequest({ url: `/api/reddit/config/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rd-config', artistId] }),
  });

  const addKeyword = useMutation({
    mutationFn: async (keyword: string) =>
      apiRequest({ url: `/api/reddit/keywords/${artistId}`, method: 'POST', data: { keyword } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rd-config', artistId] }),
  });

  const addCompetitor = useMutation({
    mutationFn: async (name: string) =>
      apiRequest({ url: `/api/reddit/competitors/${artistId}`, method: 'POST', data: { artistName: name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rd-config', artistId] }),
  });

  const generateStrategy = useMutation({
    mutationFn: async (v?: { genre?: string }) => {
      const res = await apiRequest({ url: `/api/reddit/generate-strategy/${artistId}`, method: 'POST', data: { artistName, genre: v?.genre } });
      return res as { success: boolean; report: RedditReport };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rd-reports', artistId] }),
  });

  const audienceSummary = useMutation({
    mutationFn: async (v?: { genre?: string }) => {
      const res = await apiRequest({ url: `/api/reddit/audience-summary/${artistId}`, method: 'POST', data: { artistName, genre: v?.genre } });
      return res as { success: boolean; summary: string };
    },
  });

  const config = configQuery.data || null;
  const analytics = analyticsQuery.data || null;
  const hasData = !!(overviewQuery.data?.hasData);
  const configured = !!(overviewQuery.data?.configured);
  const simulated = overviewQuery.data?.simulated ?? !configured;
  const scannedAt: number | null = overviewQuery.data?.scannedAt ?? null;

  const topCommunities = useMemo(() => (communitiesQuery.data || []).slice(0, 6), [communitiesQuery.data]);

  return {
    artistId, artistName,
    config, configured, simulated, hasData, scannedAt,
    trends: trendsQuery.data || [],
    communities: communitiesQuery.data || [],
    topCommunities,
    opportunities: opportunitiesQuery.data || [],
    competitors: competitorsQuery.data || [],
    keywords: keywordsQuery.data || [],
    fanLeads: fansQuery.data || [],
    audience: audienceQuery.data || null,
    analytics,
    reports: reportsQuery.data || [],
    isLoading: overviewQuery.isLoading,
    scan, saveConfig, addKeyword, addCompetitor, generateStrategy, audienceSummary,
    refetchAll: invalidateAll,
  };
}

export type RedditCenter = ReturnType<typeof useRedditCenter>;
