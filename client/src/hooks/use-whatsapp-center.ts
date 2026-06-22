import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

/**
 * use-whatsapp-center — drives the WhatsApp Artist Command Center.
 * Owns the session lifecycle (create → QR → connected) plus all data queries
 * (contacts, campaigns, messages, AI commands, analytics) and the mutations
 * used by the dashboard panels. Every call goes through the Boostify backend
 * (`/api/whatsapp/*`) — OpenWA tokens never reach the client.
 */

export type WaSessionState = 'idle' | 'initializing' | 'qr' | 'connected' | 'disconnected' | 'expired' | 'error';
export type WaProvider = 'cloud' | 'openwa' | 'simulated';

export interface WaContact {
  id: string; name: string; phone: string; tags?: string[]; source?: string;
  consentStatus?: 'opted_in' | 'opted_out' | 'pending'; city?: string | null;
  isVip?: boolean; totalSpent?: number; lastMessageAt?: number | null;
}
export interface WaCampaign {
  id: string; name: string; segment: string; message: string; mediaUrl?: string | null;
  status: string; sentCount: number; deliveredCount: number; responseCount: number;
  conversionCount: number; revenue: number; targetCount?: number; createdAt: number;
}
export interface WaMessage {
  id: string; direction: 'in' | 'out'; from: string; to: string; body: string;
  mediaUrl?: string | null; messageType: string; status: string; timestamp: number; campaignId?: string | null;
}
export interface WaCommand {
  id: string; rawText: string; intent: string; moduleTarget: string; params: any;
  confidence: number; result?: string; from?: string; channel?: string; createdAt: number;
}
export interface WaAnalytics {
  messagesSent: number; messagesResponded: number; activeFans: number; totalContacts: number;
  conversionRate: number; revenue: number; ticketsSold: number; merchSold: number;
  campaignsCount: number; topCommands: Array<{ intent: string; count: number }>;
}

interface Args { artistId: string; artistName: string; }

export function useWhatsAppCenter({ artistId, artistName }: Args) {
  const qc = useQueryClient();
  const sessionId = `boostify_${artistId}`;
  const [sessionStarted, setSessionStarted] = useState(false);

  // ── Session create ─────────────────────────────────────────────────────────
  const createSession = useMutation({
    mutationFn: async (phoneNumber?: string) => {
      const res = await apiRequest({
        url: '/api/whatsapp/session/create', method: 'POST',
        data: { artistId, artistName, phoneNumber },
      });
      return res as { success: boolean; sessionId: string; status: WaSessionState; qrCode?: string | null; simulated?: boolean; provider?: WaProvider };
    },
    onSuccess: () => setSessionStarted(true),
  });

  // ── Session status (polls until connected) ──────────────────────────────────
  const statusQuery = useQuery({
    queryKey: ['wa-status', sessionId],
    enabled: sessionStarted,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status as WaSessionState | undefined;
      return s === 'connected' ? 15000 : 3000;
    },
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/whatsapp/session/${sessionId}/status`, method: 'GET' });
      return res as { success: boolean; status: WaSessionState; qrCode?: string | null; phoneNumber?: string | null; provider?: WaProvider };
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => apiRequest({ url: `/api/whatsapp/session/${sessionId}/disconnect`, method: 'POST', data: {} }),
    onSuccess: () => { setSessionStarted(false); statusQuery.refetch(); },
  });

  const status: WaSessionState = (statusQuery.data?.status as WaSessionState) || (createSession.data?.status as WaSessionState) || 'idle';
  const isConnected = status === 'connected';
  const qrCode = statusQuery.data?.qrCode || createSession.data?.qrCode || null;
  const provider: WaProvider = (statusQuery.data?.provider as WaProvider) || (createSession.data?.provider as WaProvider) || 'simulated';

  // ── Data queries (inlined to satisfy React rules-of-hooks) ──────────────────
  const contactsQuery = useQuery({
    queryKey: ['wa-contacts', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/whatsapp/contacts/${artistId}`, method: 'GET' }))?.contacts || []) as WaContact[],
  });
  const campaignsQuery = useQuery({
    queryKey: ['wa-campaigns', artistId], enabled: !!artistId, refetchInterval: 8000,
    queryFn: async () => ((await apiRequest({ url: `/api/whatsapp/campaigns/${artistId}`, method: 'GET' }))?.campaigns || []) as WaCampaign[],
  });
  const messagesQuery = useQuery({
    queryKey: ['wa-messages', artistId], enabled: !!artistId, refetchInterval: 6000,
    queryFn: async () => ((await apiRequest({ url: `/api/whatsapp/messages/${artistId}`, method: 'GET' }))?.messages || []) as WaMessage[],
  });
  const commandsQuery = useQuery({
    queryKey: ['wa-commands', artistId], enabled: !!artistId,
    queryFn: async () => ((await apiRequest({ url: `/api/whatsapp/ai-commands/${artistId}`, method: 'GET' }))?.commands || []) as WaCommand[],
  });
  const analyticsQuery = useQuery({
    queryKey: ['wa-analytics', artistId], enabled: !!artistId, refetchInterval: 15000,
    queryFn: async () => ((await apiRequest({ url: `/api/whatsapp/analytics/${artistId}`, method: 'GET' }))?.analytics || null) as WaAnalytics | null,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const sendMessage = useMutation({
    mutationFn: async (v: { to: string; message: string }) =>
      apiRequest({ url: '/api/whatsapp/message/send', method: 'POST', data: { sessionId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-messages', artistId] }),
  });

  const sendMedia = useMutation({
    mutationFn: async (v: { to: string; mediaUrl: string; caption?: string }) =>
      apiRequest({ url: '/api/whatsapp/media/send', method: 'POST', data: { sessionId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-messages', artistId] }),
  });

  const sendCampaign = useMutation({
    mutationFn: async (v: { name: string; segment: string; message: string; mediaUrl?: string; city?: string }) =>
      apiRequest({ url: '/api/whatsapp/campaign/send', method: 'POST', data: { artistId, sessionId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-campaigns', artistId] }),
  });

  const importContacts = useMutation({
    mutationFn: async (contacts: Partial<WaContact>[]) =>
      apiRequest({ url: `/api/whatsapp/contacts/${artistId}`, method: 'POST', data: { contacts } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-contacts', artistId] }),
  });

  const runCommand = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest({ url: '/api/whatsapp/ai-command', method: 'POST', data: { artistId, artistName, text } });
      return res as { success: boolean; commandId: string; classification: any; reply: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-commands', artistId] }),
  });

  const contacts = contactsQuery.data || [];
  const segments = useMemo(() => ({
    all: contacts.length,
    vip: contacts.filter((c) => c.isVip).length,
    buyers: contacts.filter((c) => (c.totalSpent || 0) > 0).length,
    new: contacts.filter((c) => !c.lastMessageAt).length,
  }), [contacts]);

  const reset = useCallback(() => { setSessionStarted(false); }, []);

  // Auto-connect once on mount: the official Cloud API has no QR step, so the
  // session resolves to 'connected' immediately and the panel unlocks without
  // the owner having to click. For OpenWA it surfaces the QR right away.
  useEffect(() => {
    if (!sessionStarted && !createSession.isPending) {
      createSession.mutate(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sessionId, status, isConnected, qrCode, provider, simulated: !!createSession.data?.simulated,
    createSession, disconnect, statusQuery,
    contacts, segments,
    campaigns: campaignsQuery.data || [],
    messages: messagesQuery.data || [],
    commands: commandsQuery.data || [],
    analytics: analyticsQuery.data || null,
    sendMessage, sendMedia, sendCampaign, importContacts, runCommand,
    reset,
  };
}

export type WhatsAppCenter = ReturnType<typeof useWhatsAppCenter>;
