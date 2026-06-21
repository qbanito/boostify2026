import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

/**
 * use-discord-nation — drives the Discord Fan Nation community hub.
 * Connect a server (OAuth2 + bot), run the setup wizard, manage roles, gate VIP
 * access with $BTF, run campaigns/events, reward fans and moderate with AI.
 * Every call goes through `/api/discord/*`. The bot token lives server-side only.
 * All queryFns default to []/null so React Query never receives undefined.
 */

export interface DiscordConfig {
  activeGuildId: string | null;
  tokenGate: { minBtf: number; requireVip: boolean; minSpent: number; roleId: string | null };
  autoRoles: boolean;
  updatedAt: number;
}
export interface DiscordGuild {
  guildId: string; guildName: string; botInstalled: boolean; status: string;
  memberCount?: number | null; iconUrl?: string | null; simulated?: boolean;
}
export interface DiscordChannel { channelId: string; name: string; type: string; description?: string; }
export interface DiscordRole {
  roleId: string; roleName: string; color: number; accessLevel: string; ruleType: string; ruleValue?: any;
}
export interface DiscordMember {
  discordUserId: string; username?: string | null; roles?: string[]; isVip?: boolean;
  btfBalance?: number; totalSpent?: number; messagesCount?: number;
  score?: number; tier?: string; active?: boolean; lastActiveAt?: number; joinedAt?: number;
}
export interface DiscordCampaign {
  id: string; name: string; channelId: string; message: string; status: string;
  clickCount?: number; conversionCount?: number; revenue?: number; sentAt?: number; simulated?: boolean;
}
export interface DiscordEvent {
  id: string; title: string; description?: string; startTime: string; endTime?: string | null;
  accessLevel: string; status: string; attendees?: string[]; revenue?: number;
}
export interface DiscordReward {
  id: string; name: string; type: string; trigger: string; value?: any; roleId?: string | null;
  status: string; claims?: number; createdAt: number;
}
export interface DiscordAICommand {
  id: string; rawText: string; intent: string; moduleTarget: string; reply: string;
  confidence: number; source: string; actionStatus: string; createdAt: number;
}
export interface DiscordModerationEntry {
  id: string; text: string; username?: string | null; flagged: boolean;
  categories: string[]; action: string; reason: string; source: string; createdAt: number;
}
export interface DiscordAnalytics {
  totalMembers: number; trackedMembers: number; activeMembers: number; newMembers: number;
  churnRate: number; activeRate: number; vipRetention: number;
  totalRevenue: number; memberRevenue: number; campaignRevenue: number; conversions: number; arpu: number;
  campaignsSent: number; eventsCreated: number; ticketsSold: number;
  timeline: Array<{ day: string; active: number; joined: number }>;
  topFans: DiscordMember[];
}

interface Args { artistId: string; artistName: string; }

export function useDiscordNation({ artistId, artistName }: Args) {
  const qc = useQueryClient();
  const base = '/api/discord';

  const overviewQuery = useQuery({
    queryKey: ['dc-overview', artistId], enabled: !!artistId,
    queryFn: async () => (await apiRequest({ url: `${base}/overview/${artistId}`, method: 'GET' })) || null,
  });
  const configQuery = useQuery({
    queryKey: ['dc-config', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/config/${artistId}`, method: 'GET' }))?.config || null) as DiscordConfig | null,
  });
  const guildStatusQuery = useQuery({
    queryKey: ['dc-guild-status', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/guild/${artistId}/status`, method: 'GET' }))?.status || null),
  });
  const channelsQuery = useQuery({
    queryKey: ['dc-channels', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/channels/${artistId}`, method: 'GET' }))?.channels || []) as DiscordChannel[],
  });
  const rolesQuery = useQuery({
    queryKey: ['dc-roles', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/roles/${artistId}`, method: 'GET' }))?.roles || []) as DiscordRole[],
  });
  const membersQuery = useQuery({
    queryKey: ['dc-members', artistId], enabled: !!artistId,
    queryFn: async () => {
      const r = await apiRequest({ url: `${base}/members/${artistId}`, method: 'GET' });
      return { members: (r?.members || []) as DiscordMember[], total: r?.total || 0 };
    },
  });
  const campaignsQuery = useQuery({
    queryKey: ['dc-campaigns', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/campaigns/${artistId}`, method: 'GET' }))?.campaigns || []) as DiscordCampaign[],
  });
  const eventsQuery = useQuery({
    queryKey: ['dc-events', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/events/${artistId}`, method: 'GET' }))?.events || []) as DiscordEvent[],
  });
  const rewardsQuery = useQuery({
    queryKey: ['dc-rewards', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/rewards/${artistId}`, method: 'GET' }))?.rewards || []) as DiscordReward[],
  });
  const aiCommandsQuery = useQuery({
    queryKey: ['dc-ai-commands', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/ai-commands/${artistId}`, method: 'GET' }))?.commands || []) as DiscordAICommand[],
  });
  const moderationQuery = useQuery({
    queryKey: ['dc-moderation', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/moderation/${artistId}`, method: 'GET' }))?.log || []) as DiscordModerationEntry[],
  });
  const analyticsQuery = useQuery({
    queryKey: ['dc-analytics', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `${base}/analytics/${artistId}`, method: 'GET' }))?.analytics || null) as DiscordAnalytics | null,
  });

  const invalidate = (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k, artistId] }));
  const invalidateAll = () => invalidate(
    'dc-overview', 'dc-config', 'dc-guild-status', 'dc-channels', 'dc-roles',
    'dc-members', 'dc-campaigns', 'dc-events', 'dc-rewards', 'dc-analytics',
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const getInstallUrl = useMutation({
    mutationFn: async () => apiRequest({ url: `${base}/oauth/url/${artistId}`, method: 'GET' }) as Promise<{ success: boolean; url: string; simulated: boolean }>,
  });
  const connectOAuth = useMutation({
    mutationFn: async (v: { code?: string; simulated?: boolean }) =>
      apiRequest({ url: `${base}/oauth/callback`, method: 'POST', data: { artistId, ...v } }),
    onSuccess: () => invalidate('dc-overview', 'dc-config'),
  });
  const connectGuild = useMutation({
    mutationFn: async (v: { guildId: string; guildName?: string }) =>
      apiRequest({ url: `${base}/guild/connect/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidateAll(),
  });
  const saveConfig = useMutation({
    mutationFn: async (v: Partial<DiscordConfig>) =>
      apiRequest({ url: `${base}/config/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidate('dc-config', 'dc-overview'),
  });
  const setupServer = useMutation({
    mutationFn: async (v?: { channels?: any[]; roles?: any[] }) =>
      apiRequest({ url: `${base}/setup-server/${artistId}`, method: 'POST', data: v || {} }),
    onSuccess: () => invalidate('dc-channels', 'dc-roles', 'dc-overview'),
  });
  const createChannel = useMutation({
    mutationFn: async (v: { name: string; type?: string; description?: string }) =>
      apiRequest({ url: `${base}/channel/create/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidate('dc-channels'),
  });
  const createRole = useMutation({
    mutationFn: async (v: { name: string; color?: number; accessLevel?: string; ruleType?: string; ruleValue?: any }) =>
      apiRequest({ url: `${base}/role/create/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidate('dc-roles'),
  });
  const assignRole = useMutation({
    mutationFn: async (v: { userId: string; roleId: string }) =>
      apiRequest({ url: `${base}/role/assign/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidate('dc-members'),
  });
  const sendCampaign = useMutation({
    mutationFn: async (v: { name?: string; channelId: string; message: string; mediaUrl?: string; buttons?: Array<{ label: string; url: string }> }) =>
      apiRequest({ url: `${base}/campaign/send/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidate('dc-campaigns', 'dc-analytics'),
  });
  const createEvent = useMutation({
    mutationFn: async (v: { title: string; description?: string; startTime: string; endTime?: string; channelId?: string; accessLevel?: string; location?: string }) =>
      apiRequest({ url: `${base}/event/create/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidate('dc-events', 'dc-analytics'),
  });
  const createReward = useMutation({
    mutationFn: async (v: { name: string; type: string; trigger?: string; value?: any; roleId?: string }) =>
      apiRequest({ url: `${base}/reward/create/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidate('dc-rewards'),
  });
  const rewardTopFans = useMutation({
    mutationFn: async (v: { count?: number; rewardName?: string; roleId?: string }) =>
      apiRequest({ url: `${base}/reward/top-fans/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidate('dc-rewards', 'dc-members'),
  });
  const verifyTokenGate = useMutation({
    mutationFn: async (v: { userId: string; btfBalance?: number; isVip?: boolean; totalSpent?: number }) =>
      apiRequest({ url: `${base}/token-gate/verify/${artistId}`, method: 'POST', data: v }),
    onSuccess: () => invalidate('dc-members'),
  });
  const runAICommand = useMutation({
    mutationFn: async (text: string) =>
      apiRequest({ url: `${base}/ai-command/${artistId}`, method: 'POST', data: { text, artistName } }) as Promise<{ success: boolean; command: DiscordAICommand }>,
    onSuccess: () => invalidate('dc-ai-commands'),
  });
  const checkModeration = useMutation({
    mutationFn: async (v: { text: string; username?: string }) =>
      apiRequest({ url: `${base}/moderation/check/${artistId}`, method: 'POST', data: v }) as Promise<{ success: boolean; result: DiscordModerationEntry }>,
    onSuccess: () => invalidate('dc-moderation'),
  });
  const importMembers = useMutation({
    mutationFn: async (members: any[]) =>
      apiRequest({ url: `${base}/members/${artistId}/import`, method: 'POST', data: { members } }),
    onSuccess: () => invalidate('dc-members', 'dc-analytics'),
  });

  const overview = overviewQuery.data || null;
  const configured = !!overview?.configured;
  const simulated = overview?.simulated ?? !configured;
  const connected = !!overview?.connected;
  const guild = (overview?.guild || null) as DiscordGuild | null;
  const members = membersQuery.data?.members || [];
  const topFans = useMemo(() => members.slice(0, 10), [members]);

  return {
    artistId, artistName,
    overview, configured, simulated, connected, guild,
    config: configQuery.data || null,
    guildStatus: guildStatusQuery.data || null,
    channels: channelsQuery.data || [],
    roles: rolesQuery.data || [],
    members, topFans, memberTotal: membersQuery.data?.total || 0,
    campaigns: campaignsQuery.data || [],
    events: eventsQuery.data || [],
    rewards: rewardsQuery.data || [],
    aiCommands: aiCommandsQuery.data || [],
    moderation: moderationQuery.data || [],
    analytics: analyticsQuery.data || null,
    isLoading: overviewQuery.isLoading,
    getInstallUrl, connectOAuth, connectGuild, saveConfig, setupServer,
    createChannel, createRole, assignRole, sendCampaign, createEvent,
    createReward, rewardTopFans, verifyTokenGate, runAICommand, checkModeration, importMembers,
    refetchAll: invalidateAll,
  };
}

export type DiscordCenter = ReturnType<typeof useDiscordNation>;
