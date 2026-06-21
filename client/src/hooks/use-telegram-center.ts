import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

/**
 * use-telegram-center — drives the Telegram Artist Command Center.
 * Owns the bot lifecycle (paste @BotFather token → validate → connected) plus
 * all data queries (subscribers, campaigns, messages, communities, AI commands,
 * analytics) and the mutations used by the dashboard panels. Every call goes
 * through the Boostify backend (`/api/telegram/*`) — bot tokens never reach the
 * client (they are AES-encrypted at rest on the server).
 */

export type TgBotState = 'idle' | 'initializing' | 'connected' | 'disconnected' | 'invalid' | 'error';

export interface TgContact {
  id: string; name: string; chatId: string; telegramUserId?: string; username?: string | null;
  tags?: string[]; source?: string; consentStatus?: 'opted_in' | 'opted_out' | 'pending';
  city?: string | null; isVip?: boolean; totalSpent?: number; lastMessageAt?: number | null;
}
export interface TgCampaign {
  id: string; name: string; segment: string; message: string; mediaUrl?: string | null;
  status: string; sentCount: number; deliveredCount: number; responseCount: number;
  conversionCount: number; revenue: number; targetCount?: number; createdAt: number;
}
export interface TgMessage {
  id: string; direction: 'in' | 'out'; from: string; to: string; body: string;
  mediaUrl?: string | null; messageType: string; status: string; timestamp: number; campaignId?: string | null;
}
export interface TgCommunity {
  id: string; type: 'channel' | 'group'; name: string; description?: string | null;
  chatId?: string | null; inviteLink?: string | null; memberCount?: number;
  status: string; note?: string | null; createdAt: number;
}
export interface TgCommand {
  id: string; rawText: string; intent: string; moduleTarget: string; params: any;
  confidence: number; result?: string; from?: string; channel?: string; createdAt: number;
}
export interface TgAnalytics {
  messagesSent: number; messagesResponded: number; activeFans: number; totalContacts: number;
  conversionRate: number; revenue: number; ticketsSold: number; merchSold: number;
  campaignsCount: number; communitiesCount: number; topCommands: Array<{ intent: string; count: number }>;
}

interface Args { artistId: string; artistName: string; }

export function useTelegramCenter({ artistId, artistName }: Args) {
  const qc = useQueryClient();
  const botId = `tg_${artistId}`;
  const [botStarted, setBotStarted] = useState(false);

  // ── Bot connect (token-based) ───────────────────────────────────────────────
  const connectBot = useMutation({
    mutationFn: async (botToken: string) => {
      const res = await apiRequest({
        url: '/api/telegram/bot/connect', method: 'POST',
        data: { artistId, artistName, botToken },
      });
      return res as { success: boolean; botId: string; status: TgBotState; botUsername?: string | null; botName?: string | null; simulated?: boolean; error?: string | null };
    },
    onSuccess: () => { setBotStarted(true); statusQuery.refetch(); },
  });

  // ── Bot status (polls while connecting) ─────────────────────────────────────
  const statusQuery = useQuery({
    queryKey: ['tg-status', botId],
    enabled: botStarted,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status as TgBotState | undefined;
      return s === 'connected' ? 20000 : 5000;
    },
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/telegram/bot/${botId}/status`, method: 'GET' });
      return res as { success: boolean; status: TgBotState; botUsername?: string | null; botName?: string | null; simulated?: boolean };
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => apiRequest({ url: `/api/telegram/bot/${botId}/disconnect`, method: 'POST', data: {} }),
    onSuccess: () => { setBotStarted(false); statusQuery.refetch(); },
  });

  const status: TgBotState = (statusQuery.data?.status as TgBotState) || (connectBot.data?.status as TgBotState) || 'idle';
  const isConnected = status === 'connected';
  const botUsername = statusQuery.data?.botUsername || connectBot.data?.botUsername || null;
  const botName = statusQuery.data?.botName || connectBot.data?.botName || null;
  const simulated = !!(statusQuery.data?.simulated || connectBot.data?.simulated);

  // ── Data queries (inlined to satisfy React rules-of-hooks) ──────────────────
  const contactsQuery = useQuery({
    queryKey: ['tg-contacts', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/telegram/contacts/${artistId}`, method: 'GET' }))?.contacts || []) as TgContact[],
  });
  const campaignsQuery = useQuery({
    queryKey: ['tg-campaigns', artistId], enabled: !!artistId, refetchInterval: 8000,
    queryFn: async () => ((await apiRequest({ url: `/api/telegram/campaigns/${artistId}`, method: 'GET' }))?.campaigns || []) as TgCampaign[],
  });
  const messagesQuery = useQuery({
    queryKey: ['tg-messages', artistId], enabled: !!artistId, refetchInterval: 6000,
    queryFn: async () => ((await apiRequest({ url: `/api/telegram/messages/${artistId}`, method: 'GET' }))?.messages || []) as TgMessage[],
  });
  const communitiesQuery = useQuery({
    queryKey: ['tg-communities', artistId], enabled: !!artistId, refetchInterval: 12000,
    queryFn: async () => ((await apiRequest({ url: `/api/telegram/communities/${artistId}`, method: 'GET' }))?.communities || []) as TgCommunity[],
  });
  const commandsQuery = useQuery({
    queryKey: ['tg-commands', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/telegram/ai-commands/${artistId}`, method: 'GET' }))?.commands || []) as TgCommand[],
  });
  const analyticsQuery = useQuery({
    queryKey: ['tg-analytics', artistId], enabled: !!artistId, refetchInterval: 15000,
    queryFn: async () => ((await apiRequest({ url: `/api/telegram/analytics/${artistId}`, method: 'GET' }))?.analytics || null) as TgAnalytics | null,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const sendMessage = useMutation({
    mutationFn: async (v: { chatId: string; message: string; buttons?: Array<{ text: string; url: string }> }) =>
      apiRequest({ url: '/api/telegram/message/send', method: 'POST', data: { artistId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tg-messages', artistId] }),
  });

  const sendMedia = useMutation({
    mutationFn: async (v: { chatId: string; mediaUrl: string; caption?: string }) =>
      apiRequest({ url: '/api/telegram/media/send', method: 'POST', data: { artistId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tg-messages', artistId] }),
  });

  const sendCampaign = useMutation({
    mutationFn: async (v: { name: string; segment: string; message: string; mediaUrl?: string; city?: string; buttons?: Array<{ text: string; url: string }> }) =>
      apiRequest({ url: '/api/telegram/campaign/send', method: 'POST', data: { artistId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tg-campaigns', artistId] }),
  });

  const importContacts = useMutation({
    mutationFn: async (contacts: Partial<TgContact>[]) =>
      apiRequest({ url: `/api/telegram/contacts/${artistId}`, method: 'POST', data: { contacts } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tg-contacts', artistId] }),
  });

  const createCommunity = useMutation({
    mutationFn: async (v: { type: 'channel' | 'group'; name: string; chatId?: string; description?: string }) => {
      const res = await apiRequest({ url: '/api/telegram/community/create', method: 'POST', data: { artistId, ...v } });
      return res as { success: boolean; communityId: string; inviteLink?: string | null; note?: string | null };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tg-communities', artistId] }),
  });

  const createInvite = useMutation({
    mutationFn: async (v: { chatId: string; name?: string }) => {
      const res = await apiRequest({ url: '/api/telegram/invite/create', method: 'POST', data: { artistId, ...v } });
      return res as { success: boolean; inviteLink?: string | null; simulated?: boolean };
    },
  });

  const runCommand = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest({ url: '/api/telegram/ai-command', method: 'POST', data: { artistId, artistName, text } });
      return res as { success: boolean; commandId: string; classification: any; reply: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tg-commands', artistId] }),
  });

  const contacts = contactsQuery.data || [];
  const segments = useMemo(() => ({
    all: contacts.length,
    vip: contacts.filter((c) => c.isVip).length,
    buyers: contacts.filter((c) => (c.totalSpent || 0) > 0).length,
    new: contacts.filter((c) => !c.lastMessageAt).length,
  }), [contacts]);

  const reset = useCallback(() => { setBotStarted(false); }, []);

  return {
    botId, status, isConnected, botUsername, botName, simulated,
    connectBot, disconnect, statusQuery,
    contacts, segments,
    campaigns: campaignsQuery.data || [],
    messages: messagesQuery.data || [],
    communities: communitiesQuery.data || [],
    commands: commandsQuery.data || [],
    analytics: analyticsQuery.data || null,
    sendMessage, sendMedia, sendCampaign, importContacts, createCommunity, createInvite, runCommand,
    reset,
  };
}

export type TelegramCenter = ReturnType<typeof useTelegramCenter>;
