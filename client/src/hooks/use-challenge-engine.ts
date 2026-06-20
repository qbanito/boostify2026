/**
 * 🔥 useChallengeEngine — hook for Challenge Engine operations
 *
 * Wraps all /api/promote-engine/song/:songId/challenge-* calls.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from "../lib/queryClient";
import { useToast } from "./use-toast";

export interface CampaignDay {
  day: number;
  platform: 'tiktok' | 'instagram' | 'youtube_shorts' | 'all';
  caption: string;
  hashtags: string[];
  contentType: 'launch' | 'repost' | 'challenge_cta' | 'reaction' | 'milestone' | 'winner';
  bestTime: string;
  engagementTip: string;
}

export interface ChallengeCampaign {
  id: number;
  songId: number;
  artistId: number;
  viralScore: number | null;
  bpm: number | null;
  energyLevel: number | null;
  danceability: number | null;
  viralAnalysisJson: Record<string, any> | null;
  challengeName: string;
  hashtag: string;
  hookText: string | null;
  challengeInstructions: string | null;
  hookAudioUrl: string | null;
  referenceVideoUrl: string | null;
  urbanVideoUrl: string | null;
  groupDanceVideoUrl: string | null;
  luxuryVideoUrl: string | null;
  urbanAssetId: number | null;
  groupDanceAssetId: number | null;
  luxuryAssetId: number | null;
  campaignCalendar: CampaignDay[] | null;
  campaignStatus: 'draft' | 'active' | 'completed';
  status: 'analyzing' | 'ready' | 'generating' | 'done' | 'failed';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useChallengeEngine(songId: number) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── List campaigns for this song ──
  const listQ = useQuery({
    queryKey: ['challenge-engine', 'list', songId],
    enabled: !!songId,
    throwOnError: false,
    retry: false,
    queryFn: async () =>
      (await apiRequest(`/api/promote-engine/song/${songId}/challenges`, {
        method: 'GET',
      })) as { ok: boolean; campaigns: ChallengeCampaign[] },
  });

  // ── Poll status of a specific campaign ──
  const useCampaignStatus = (campaignId: number | null) =>
    useQuery({
      queryKey: ['challenge-engine', 'status', songId, campaignId],
      enabled: !!campaignId,
      refetchInterval: (q) => {
        const data = q.state.data as { campaign?: ChallengeCampaign } | undefined;
        const s = data?.campaign?.status;
        return s === 'analyzing' || s === 'generating' ? 5_000 : false;
      },
      queryFn: async () =>
        (await apiRequest(
          `/api/promote-engine/song/${songId}/challenge-status/${campaignId}`,
          { method: 'GET' },
        )) as { ok: boolean; campaign: ChallengeCampaign },
    });

  // ── Analyze virality ──
  const analyzeMutation = useMutation({
    mutationFn: async () =>
      (await apiRequest(`/api/promote-engine/song/${songId}/challenge-analyze`, {
        method: 'POST',
      })) as { ok: boolean; campaignId: number; viralScore: number; challengeName: string; hashtag: string; hookText: string; challengeInstructions: string; bpm: number | null; energyLevel: number | null; danceability: number | null; analysis: any },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenge-engine', 'list', songId] });
    },
    onError: (err: any) => {
      toast({ title: 'Virality analysis failed', description: err?.message, variant: 'destructive' });
    },
  });

  // ── Generate 3 challenge videos ──
  const generateMutation = useMutation({
    mutationFn: async (args: { campaignId: number; referenceVideoUrl?: string }) =>
      (await apiRequest(`/api/promote-engine/song/${songId}/challenge-generate`, {
        method: 'POST',
        data: args,
      })) as { ok: boolean; campaignId: number; status: string },
    onSuccess: (data) => {
      toast({ title: '🎬 Generating videos…', description: 'Kling is processing 3 styles. This takes 3-5 minutes.' });
      qc.invalidateQueries({ queryKey: ['challenge-engine', 'status', songId, data.campaignId] });
    },
    onError: (err: any) => {
      toast({ title: 'Video generation failed', description: err?.message, variant: 'destructive' });
    },
  });

  // ── Build 15-day calendar ──
  const calendarMutation = useMutation({
    mutationFn: async (campaignId: number) =>
      (await apiRequest(`/api/promote-engine/song/${songId}/challenge-campaign`, {
        method: 'POST',
        data: { campaignId },
      })) as { ok: boolean; calendar: CampaignDay[] },
    onSuccess: (_, campaignId) => {
      toast({ title: '📅 Campaign calendar generated!' });
      qc.invalidateQueries({ queryKey: ['challenge-engine', 'status', songId, campaignId] });
      qc.invalidateQueries({ queryKey: ['challenge-engine', 'list', songId] });
    },
    onError: (err: any) => {
      toast({ title: 'Calendar generation failed', description: err?.message, variant: 'destructive' });
    },
  });

  return {
    listQ,
    useCampaignStatus,
    analyzeMutation,
    generateMutation,
    calendarMutation,
  };
}
