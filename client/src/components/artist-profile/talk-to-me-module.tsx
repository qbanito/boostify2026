/**
 * BOOSTIFY — Talk To Me / Call Me Module
 *
 * Lets fans & journalists have a real-time voice conversation with an
 * AI double of the artist, powered by ElevenLabs Conversational AI.
 *
 * Owner view  : configuration panel (voice, persona, topics, language, on/off)
 * Fan view    : immersive "CALL" UI — phone ring, animated waveform, live transcript
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Conversation as ElevenConversation } from '@elevenlabs/client';
import type { Conversation as ElevenConversationSession } from '@elevenlabs/client';
import { getTalkToMeAudioErrorMessage, getTalkToMeSessionTransport, prepareTalkToMeAudioSession } from '@/lib/talk-to-me-audio';
import type { TalkToMeAudioSessionOptions } from '@/lib/talk-to-me-audio';
import { useAuth } from '@/hooks/use-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Colors {
  hexAccent:  string;
  hexPrimary: string;
  hexBorder:  string;
  textMuted:  string;
  bgGradient: string;
  shadow:     string;
}

interface SongEntry {
  id:          number;
  title:       string;
  genre?:      string;
  description?: string;
}

interface Props {
  userId:      number;
  artistId?:   number | string;
  artistSlug?: string;
  artistName:  string;
  isOwner:     boolean;
  colors:      Colors;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  songs?:      SongEntry[];
  avatarUrl?:  string;
}

type CallStatus =
  | 'idle'
  | 'requesting_mic'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'ended'
  | 'error';

interface TranscriptLine {
  role: 'user' | 'artist';
  text: string;
  ts:   number;
}

interface CallAnalytics {
  totalCalls:    number;
  avgDuration:   number;
  totalDuration: number;
  lastCallAt:    string | null;
  sentiment: {
    overall:  'positive' | 'neutral' | 'negative';
    positive: number;
    neutral:  number;
    negative: number;
  };
  topTopics:   Array<{ topic: string; count: number }>;
  recentCalls: Array<{
    durationSeconds: number;
    messageCount:    number;
    sentiment:       'positive' | 'neutral' | 'negative' | null;
    language:        string | null;
    createdAt:       string;
  }>;
}

interface VoiceOption {
  id:          string;
  name:        string;
  category?:   string;
  description?: string;
  previewUrl?: string;
}

interface TalkToMePricing {
  usdPerMinute:    number;
  creditsPerMinute: number;
  freeTrialSeconds: number;
  creditsPerDollar: number;
}

interface TtmBillingState {
  callSessionId:    string | null;
  creditsPerMinute: number;
  freeTrialSeconds: number;
  usdPerMinute:     number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PERSONA_PRESETS: { label: string; value: string; emoji: string }[] = [
  {
    label: 'Fan Chat',
    emoji: '💬',
    value: 'warm, funny, spontaneous, authentic — loves talking to fans, uses casual language and humor',
  },
  {
    label: 'Radio Interview',
    emoji: '🎙️',
    value: 'charismatic, eloquent, gives quotable answers, references music milestones, speaks with authority and excitement',
  },
  {
    label: 'Deep Dive',
    emoji: '🎨',
    value: 'introspective, poetic, loves to dive into the creative process, references influences and artistic vision',
  },
  {
    label: 'Hype Mode',
    emoji: '🔥',
    value: 'high energy, confident, talks about upcoming releases, new projects, collaborations — always building anticipation',
  },
];

const TOPIC_PRESETS = [
  'songwriting process', 'touring experiences', 'collaborations', 'upcoming releases',
  'music influences', 'artistic vision', 'life behind the scenes', 'mental health in music',
];

const DEFAULT_TOPICS = ['songwriting process', 'music influences', 'upcoming releases'];

const EMPTY_ANALYTICS: CallAnalytics = {
  totalCalls:    0,
  avgDuration:   0,
  totalDuration: 0,
  lastCallAt:    null,
  sentiment:     { overall: 'neutral', positive: 0, neutral: 0, negative: 0 },
  topTopics:     [],
  recentCalls:   [],
};

// Cost guard: hard cap a single call so a forgotten/open session cannot keep
// burning ElevenLabs per-minute voice credits. Mirror of the server-side
// max_duration_seconds; kept slightly higher so the server limit wins first.
const MAX_CALL_DURATION_SECONDS = 330;

// How often (seconds) the client reports elapsed time to the server so credits
// are metered while the call is open. The server only charges seconds beyond the
// free trial window.
const BILLING_TICK_SECONDS = 8;

function getDisconnectMessage(details: unknown): string {
  if (!details || typeof details !== 'object') return '';
  const value = details as any;
  return String(
    value.message ||
    value.closeReason ||
    value.context?.reason ||
    value.context?.message ||
    value.context?.closeReason ||
    value.error ||
    ''
  );
}

// A quota/credit exhaustion or auth failure from ElevenLabs is not recoverable by
// retrying another transport — both WebRTC and WebSocket draw on the same account.
function isUnrecoverableElevenError(signal: string): boolean {
  return /quota|exceeds your quota|credit|insufficient|payment required|unauthorized|401|403|429|too many requests/i.test(signal);
}

// ─── TalkToMeModule ───────────────────────────────────────────────────────────

export function TalkToMeModule({
  userId,
  artistId,
  artistSlug,
  artistName,
  isOwner,
  colors,
  isExpanded,
  onToggleExpand,
  songs = [],
  avatarUrl,
}: Props): JSX.Element | null {
  // ── Tab state ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'call' | 'config' | 'stats'>('call');
  const queryClient = useQueryClient();

  // ── Config state (owner) ───────────────────────────────────────────────────
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [selectedPersona, setSelectedPersona] = useState<string>(PERSONA_PRESETS[0].value);
  const [customPersona, setCustomPersona] = useState<string>('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(DEFAULT_TOPICS);
  const [customTopic, setCustomTopic] = useState<string>('');
  const [language, setLanguage] = useState<string>('english');
  const [isEnabled, setIsEnabled] = useState<boolean>(true);

  // ── New: API key & voice setup state ──────────────────────────────────────
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState<string>('');
  const [apiKeySaved, setApiKeySaved] = useState<boolean>(false);
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified'>('unspecified');
  const [savedVoiceName, setSavedVoiceName] = useState<string>('');
  const [savedVoiceId, setSavedVoiceId] = useState<string>('');
  // Voice clone
  const [voiceSetupTab, setVoiceSetupTab] = useState<'select' | 'clone' | 'generate'>('select');
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloneVoiceName, setCloneVoiceName] = useState<string>('');
  const [cloneStatus, setCloneStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [cloneError, setCloneError] = useState<string>('');
  // Voice design
  const [voiceDescription, setVoiceDescription] = useState<string>('');
  const [voicePreviews, setVoicePreviews] = useState<Array<{ generatedVoiceId: string; audioBase64: string; mediaType: string }>>([]);
  const [designStatus, setDesignStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [designError, setDesignError] = useState<string>('');
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>('');
  const cloneInputRef = useRef<HTMLInputElement | null>(null);

  // ── Call state ─────────────────────────────────────────────────────────────
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isRinging, setIsRinging] = useState<boolean>(false);

  // ── Billing / credits state ──────────────────────────────────────────────────
  const { user: authUser, isAdmin } = useAuth();
  const userEmail = authUser?.email || '';
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [outOfCredits, setOutOfCredits] = useState<boolean>(false);
  const billingRef = useRef<TtmBillingState | null>(null);
  const billingTickBusyRef = useRef<boolean>(false);


  // ── Refs ───────────────────────────────────────────────────────────────────
  const conversationRef    = useRef<ElevenConversationSession | null>(null);
  const endingCallRef      = useRef<boolean>(false);
  const startingCallRef    = useRef<boolean>(false);
  const fallbackTriedRef   = useRef<boolean>(false);
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef   = useRef<HTMLDivElement | null>(null);
  // Live mirrors of call state so endCall() can log the final call without
  // depending on stale closures (endCall is a stable useCallback).
  const transcriptRef      = useRef<TranscriptLine[]>([]);
  const callDurationRef    = useRef<number>(0);
  const callLoggedRef      = useRef<boolean>(false);

  // ── Fetch artist config ────────────────────────────────────────────────────
  const effectiveId = artistId || userId;
  const { data: configData } = useQuery({
    queryKey: ['ttm-config', effectiveId],
    queryFn: async () => {
      const r = await fetch(`/api/talk-to-me/config/${effectiveId}`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!effectiveId,
  });

  useEffect(() => {
    if (configData?.config) {
      const c = configData.config;
      if (c.voice_id)          setSelectedVoice(c.voice_id);
      if (c.persona)           setSelectedPersona(c.persona);
      if (c.topics)            setSelectedTopics(Array.isArray(c.topics) ? c.topics : JSON.parse(c.topics || '[]'));
      if (c.language)          setLanguage(c.language);
      if (typeof c.is_enabled === 'boolean') setIsEnabled(c.is_enabled);
      if (c.gender)            setGender(c.gender as any);
      if (c.elevenlabs_api_key_hint) setApiKeySaved(true);
      if (c.voice_name)        setSavedVoiceName(c.voice_name);
      if (c.cloned_voice_id)   setSavedVoiceId(c.cloned_voice_id);
    }
  }, [configData]);

  // ── Fetch pricing + caller credit balance ──────────────────────────────────
  const { data: pricingData, refetch: refetchPricing } = useQuery<{
    success: boolean;
    pricing: TalkToMePricing;
    balance: number | null;
    isAdmin: boolean;
  }>({
    queryKey: ['ttm-pricing', userEmail],
    queryFn: async () => {
      const r = await fetch('/api/talk-to-me/pricing', { credentials: 'include' });
      if (!r.ok) return { success: false, pricing: { usdPerMinute: 5, creditsPerMinute: 500, freeTrialSeconds: 15, creditsPerDollar: 100 }, balance: null, isAdmin: false };
      return r.json();
    },
    staleTime: 60 * 1000,
  });
  const pricing: TalkToMePricing = pricingData?.pricing ?? { usdPerMinute: 5, creditsPerMinute: 500, freeTrialSeconds: 15, creditsPerDollar: 100 };

  useEffect(() => {
    if (pricingData && typeof pricingData.balance === 'number') {
      setCreditBalance(pricingData.balance);
    }
  }, [pricingData]);


  // ── Fetch voices (owner only) ──────────────────────────────────────────────
  const { data: voicesData } = useQuery<{ voices: VoiceOption[] }>({    queryKey: ['el-voices', effectiveId],
    queryFn: async () => {
      const r = await fetch(`/api/talk-to-me/voices?artistId=${effectiveId}`, { credentials: 'include' });
      if (!r.ok) return { voices: [] };
      return r.json();
    },
    enabled: isOwner && tab === 'config' && voiceSetupTab === 'select',
    staleTime: 5 * 60 * 1000,
  });

  // ── Fetch call analytics (owner only, stats tab) ───────────────────────────
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<{ analytics: CallAnalytics }>({
    queryKey: ['ttm-analytics', effectiveId],
    queryFn: async () => {
      const r = await fetch(`/api/talk-to-me/analytics/${effectiveId}`, { credentials: 'include' });
      if (!r.ok) return { analytics: EMPTY_ANALYTICS };
      return r.json();
    },
    enabled: isOwner && tab === 'stats' && !!effectiveId,
    staleTime: 30 * 1000,
  });

  // ── Save config ────────────────────────────────────────────────────────────
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/talk-to-me/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          artistId:          effectiveId,
          voiceId:           selectedVoice,
          persona:           customPersona || selectedPersona,
          topics:            selectedTopics,
          language,
          isEnabled,
          gender,
          elevenlabsApiKey:  elevenlabsApiKey.trim() || undefined,
        }),
      });
      if (!r.ok) throw new Error('Failed to save config');
      return r.json();
    },
    onSuccess: () => {
      if (elevenlabsApiKey.trim()) {
        setApiKeySaved(true);
        setElevenlabsApiKey(''); // clear from state after saving
      }
    },
  });

  // ── Voice clone ────────────────────────────────────────────────────────────
  const handleVoiceClone = async () => {
    if (!cloneFiles.length) return;
    setCloneStatus('loading');
    setCloneError('');
    try {
      const form = new FormData();
      form.append('artistId', String(effectiveId));
      form.append('voiceName', cloneVoiceName || `${artistName} Voice`);
      cloneFiles.forEach(f => form.append('file', f));
      const r = await fetch('/api/talk-to-me/voice-clone', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await r.json();
      if (!r.ok || !data.voiceId) throw new Error(data.error || 'Clone failed');
      setSavedVoiceId(data.voiceId);
      setSavedVoiceName(data.voiceName || cloneVoiceName);
      setCloneStatus('done');
      setCloneFiles([]);
    } catch (e: any) {
      setCloneError(e.message);
      setCloneStatus('error');
    }
  };

  // ── Voice design ───────────────────────────────────────────────────────────
  const handleVoiceDesignPreview = async () => {
    if (!voiceDescription.trim()) return;
    setDesignStatus('loading');
    setDesignError('');
    setVoicePreviews([]);
    try {
      const r = await fetch('/api/talk-to-me/voice-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ artistId: effectiveId, voiceDescription, saveVoice: false }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Design failed');
      setVoicePreviews(data.previews || []);
      setDesignStatus('done');
    } catch (e: any) {
      setDesignError(e.message);
      setDesignStatus('error');
    }
  };

  const handleVoiceDesignSave = async (previewId: string) => {
    setDesignStatus('loading');
    try {
      const r = await fetch('/api/talk-to-me/voice-design/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          artistId: effectiveId,
          generatedVoiceId: previewId,
          voiceName: `${artistName} AI Voice`,
          voiceDescription,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Save failed');
      setSavedVoiceId(data.voiceId);
      setSavedVoiceName(data.voiceName);
      setDesignStatus('done');
      setVoicePreviews([]);
    } catch (e: any) {
      setDesignError(e.message);
      setDesignStatus('error');
    }
  };

  const handleDeleteVoice = async () => {
    if (!savedVoiceId) return;
    try {
      await fetch(`/api/talk-to-me/voice/${savedVoiceId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ artistId: effectiveId }),
      });
      setSavedVoiceId('');
      setSavedVoiceName('');
    } catch { /* ignore */ }
  };

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (callStatus === 'connected' || callStatus === 'listening' || callStatus === 'speaking') {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  // Keep a ref mirror of the duration for logging on call end.
  useEffect(() => { callDurationRef.current = callDuration; }, [callDuration]);

  // ── Cost guard: auto-end runaway calls ───────────────────────────────────────
  // ElevenLabs Conversational AI bills per minute of open session (even during
  // silence). This client-side cap is a safety net in case the server-side
  // max_duration_seconds limit does not fire (e.g. older agent config).
  useEffect(() => {
    const inCall = callStatus === 'connected' || callStatus === 'listening' || callStatus === 'speaking';
    if (inCall && callDuration >= MAX_CALL_DURATION_SECONDS) {
      console.warn(`[TTM] Max call duration (${MAX_CALL_DURATION_SECONDS}s) reached — auto-ending to protect voice credits.`);
      endCall();
    }
  }, [callStatus, callDuration]); // eslint-disable-line

  // ── Auto-scroll transcript ─────────────────────────────────────────────────
  useEffect(() => {
    transcriptRef.current = transcript;
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const toElevenOverrides = (override: any) => {
    if (!override) return undefined;
    const agent: Record<string, unknown> = {};
    const tts: Record<string, unknown> = {};

    if (override.agent?.prompt) agent.prompt = override.agent.prompt;
    if (override.agent?.language) agent.language = override.agent.language;
    if (override.tts?.voice_id) tts.voiceId = override.tts.voice_id;

    const next: Record<string, unknown> = {};
    if (Object.keys(agent).length > 0) next.agent = agent;
    if (Object.keys(tts).length > 0) next.tts = tts;
    return Object.keys(next).length > 0 ? next : undefined;
  };

  // ── Start call ─────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (startingCallRef.current || conversationRef.current) return;
    startingCallRef.current = true;
    setErrorMsg('');
    setTranscript([]);
    setCallDuration(0);
    setIsMuted(false);
    setIsRinging(true);
    setCallStatus('requesting_mic');
    transcriptRef.current = [];
    callDurationRef.current = 0;
    callLoggedRef.current = false;

    let audioSessionOptions: TalkToMeAudioSessionOptions;
    try {
      audioSessionOptions = await prepareTalkToMeAudioSession();
    } catch (e: any) {
      startingCallRef.current = false;
      setCallStatus('error');
      setIsRinging(false);
      setErrorMsg(getTalkToMeAudioErrorMessage(e));
      return;
    }

    // The official ElevenLabs browser client owns microphone capture and audio playback.
    // This avoids the previous manual PCM/WebAudio path that was browser-policy fragile.
    setCallStatus('connecting');
    let signedUrl: string;
    let conversationToken: string | undefined;
    let conversationConfigOverride: any = null;
    try {
      const res = await fetch('/api/talk-to-me/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          artistId:  effectiveId,
          artistName,
          persona:   customPersona || selectedPersona,
          topics:    selectedTopics,
          language,
          voiceId:   selectedVoice || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.signedUrl) {
        throw new Error(data.error || 'Could not connect to artist AI');
      }
      signedUrl = data.signedUrl;
      conversationToken = data.conversationToken;
      conversationConfigOverride = data.conversationConfigOverride ?? null;
      // Capture the billing session so the metered $/min ticker can charge credits.
      const b = data.billing || {};
      billingRef.current = {
        callSessionId:    data.callSessionId || null,
        creditsPerMinute: typeof b.creditsPerMinute === 'number' ? b.creditsPerMinute : pricing.creditsPerMinute,
        freeTrialSeconds: typeof b.freeTrialSeconds === 'number' ? b.freeTrialSeconds : pricing.freeTrialSeconds,
        usdPerMinute:     typeof b.usdPerMinute === 'number' ? b.usdPerMinute : pricing.usdPerMinute,
      };
      setOutOfCredits(false);
    } catch (e: any) {
      startingCallRef.current = false;
      setCallStatus('error');
      setIsRinging(false);
      setErrorMsg(e.message || 'Failed to connect');
      return;
    }

    try {
      endingCallRef.current = false;
      fallbackTriedRef.current = false;

      // Establish the realtime session. On mobile the SDK prefers WebRTC; if that
      // transport drops or fails before the call stabilises, we fall back ONCE to
      // the signed WebSocket URL (already returned by /start and proven reliable).
      const connect = async (forceWebsocket = false): Promise<void> => {
        const transport = forceWebsocket && signedUrl
          ? ({ connectionType: 'websocket', signedUrl } as const)
          : getTalkToMeSessionTransport({
              signedUrl,
              conversationToken,
              preferWebRtcForMobileDevices: audioSessionOptions.preferWebRtcForMobileDevices,
            });
        const activeTransport = transport.connectionType;
        console.log('[TTM] Starting session transport:', activeTransport);

        // Returns true when a websocket fallback was triggered, so the caller skips
        // showing the error screen.
        const tryWebsocketFallback = (reason: string): boolean => {
          if (
            endingCallRef.current ||
            fallbackTriedRef.current ||
            activeTransport === 'websocket' ||
            !signedUrl ||
            isUnrecoverableElevenError(reason)
          ) {
            return false;
          }
          fallbackTriedRef.current = true;
          console.warn(`[TTM] ${activeTransport} transport dropped — falling back to websocket. Reason:`, reason);
          conversationRef.current = null;
          setIsRinging(true);
          setCallStatus('connecting');
          void connect(true).catch(err => {
            console.warn('[TTM] Websocket fallback failed:', err);
            startingCallRef.current = false;
            conversationRef.current = null;
            setIsRinging(false);
            setCallStatus('error');
            setErrorMsg(getTalkToMeAudioErrorMessage(err));
          });
          return true;
        };

        const conversation = await ElevenConversation.startSession({
          ...transport,
          preferHeadphonesForIosDevices: audioSessionOptions.preferHeadphonesForIosDevices,
          useWakeLock: true,
          overrides: toElevenOverrides(conversationConfigOverride),
          onDebug: info => console.log('[TTM] SDK debug:', info),
          onConnect: ({ conversationId }) => {
            console.log('[TTM] SDK connected:', conversationId);
            setIsRinging(false);
            setCallStatus('connected');
            window.setTimeout(() => setCallStatus(s => (s === 'connected' ? 'listening' : s)), 250);
          },
          onDisconnect: details => {
            console.log('[TTM] SDK disconnected:', details);
            setIsRinging(false);
            conversationRef.current = null;
            startingCallRef.current = false;
            if (endingCallRef.current) return;
            const message = getDisconnectMessage(details) || 'Voice session closed before audio could start. Please try again.';
            if (tryWebsocketFallback(message)) return;
            setErrorMsg(getTalkToMeAudioErrorMessage(message));
            setCallStatus('error');
          },
          onError: (message, context) => {
            console.warn('[TTM] SDK error:', message, context);
            setIsRinging(false);
            conversationRef.current = null;
            startingCallRef.current = false;
            if (tryWebsocketFallback(String(message ?? 'error'))) return;
            setCallStatus('error');
            setErrorMsg(getTalkToMeAudioErrorMessage(message || 'Connection lost. Please try again.'));
          },
          onMessage: message => {
            if (!message?.message) return;
            const role = message.role === 'user' || message.source === 'user' ? 'user' : 'artist';
            setTranscript(prev => [...prev, { role, text: message.message, ts: Date.now() }]);
          },
          onModeChange: ({ mode }) => {
            setCallStatus(mode === 'speaking' ? 'speaking' : 'listening');
          },
          onStatusChange: ({ status }) => {
            console.log('[TTM] SDK status:', status);
          },
          onConversationMetadata: metadata => {
            console.log('[TTM] SDK metadata:', metadata);
          },
        });
        conversationRef.current = conversation;
        conversation.setVolume({ volume: 1 });
        startingCallRef.current = false;
      };

      await connect();
    } catch (e: any) {
      console.warn('[TTM] SDK start failed:', e);
      // The initial (typically WebRTC) attempt threw synchronously. Try the proven
      // websocket transport once before surfacing an error to the listener.
      if (!endingCallRef.current && !fallbackTriedRef.current && signedUrl) {
        fallbackTriedRef.current = true;
        try {
          setIsRinging(true);
          setCallStatus('connecting');
          const transport = { connectionType: 'websocket', signedUrl } as const;
          console.log('[TTM] Starting session transport:', transport.connectionType, '(sync fallback)');
          const conversation = await ElevenConversation.startSession({
            ...transport,
            preferHeadphonesForIosDevices: audioSessionOptions.preferHeadphonesForIosDevices,
            useWakeLock: true,
            overrides: toElevenOverrides(conversationConfigOverride),
            onDebug: info => console.log('[TTM] SDK debug:', info),
            onConnect: ({ conversationId }) => {
              console.log('[TTM] SDK connected:', conversationId);
              setIsRinging(false);
              setCallStatus('connected');
              window.setTimeout(() => setCallStatus(s => (s === 'connected' ? 'listening' : s)), 250);
            },
            onDisconnect: details => {
              console.log('[TTM] SDK disconnected:', details);
              setIsRinging(false);
              conversationRef.current = null;
              startingCallRef.current = false;
              if (endingCallRef.current) return;
              const message = getDisconnectMessage(details) || 'Voice session closed before audio could start. Please try again.';
              setErrorMsg(getTalkToMeAudioErrorMessage(message));
              setCallStatus('error');
            },
            onError: (message, context) => {
              console.warn('[TTM] SDK error:', message, context);
              setIsRinging(false);
              conversationRef.current = null;
              startingCallRef.current = false;
              setCallStatus('error');
              setErrorMsg(getTalkToMeAudioErrorMessage(message || 'Connection lost. Please try again.'));
            },
            onMessage: message => {
              if (!message?.message) return;
              const role = message.role === 'user' || message.source === 'user' ? 'user' : 'artist';
              setTranscript(prev => [...prev, { role, text: message.message, ts: Date.now() }]);
            },
            onModeChange: ({ mode }) => {
              setCallStatus(mode === 'speaking' ? 'speaking' : 'listening');
            },
            onStatusChange: ({ status }) => {
              console.log('[TTM] SDK status:', status);
            },
            onConversationMetadata: metadata => {
              console.log('[TTM] SDK metadata:', metadata);
            },
          });
          conversationRef.current = conversation;
          conversation.setVolume({ volume: 1 });
          startingCallRef.current = false;
          return;
        } catch (e2: any) {
          console.warn('[TTM] Websocket fallback failed:', e2);
        }
      }
      conversationRef.current = null;
      startingCallRef.current = false;
      setCallStatus('error');
      setIsRinging(false);
      setErrorMsg(getTalkToMeAudioErrorMessage(e));
    }
  }, [
    effectiveId, artistName, customPersona, selectedPersona,
    selectedTopics, language, selectedVoice,
    pricing.creditsPerMinute, pricing.freeTrialSeconds, pricing.usdPerMinute,
  ]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      conversationRef.current?.setMicMuted(next);
      return next;
    });
  }, []);

  // ── Log a completed call for analytics (zero extra AI cost) ──────────────────
  // Fire-and-forget; the backend computes sentiment/topics from the transcript.
  const logCallRecord = useCallback(() => {
    if (callLoggedRef.current) return;
    const lines = transcriptRef.current;
    const duration = callDurationRef.current;
    // Skip empty/aborted connections so analytics stay meaningful.
    if (duration < 3 && lines.length === 0) return;
    callLoggedRef.current = true;
    try {
      const payload = JSON.stringify({
        artistId: effectiveId,
        durationSeconds: duration,
        language,
        transcript: lines,
      });
      // Use sendBeacon when available so the log survives page unload/navigation.
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/talk-to-me/log-call', new Blob([payload], { type: 'application/json' }));
      } else {
        void fetch('/api/talk-to-me/log-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: true,
          body: payload,
        }).catch(() => { /* best-effort */ });
      }
      // Refresh the owner analytics view after a short delay (let the row commit).
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['ttm-analytics', effectiveId] });
      }, 1200);
    } catch { /* best-effort, never block call teardown */ }
  }, [effectiveId, language, queryClient]);

  // ── End call ───────────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    endingCallRef.current = true;
    startingCallRef.current = false;
    logCallRecord();
    const conversation = conversationRef.current;
    conversationRef.current = null;
    void conversation?.endSession().catch(err => console.warn('[TTM] SDK end failed:', err));
    setIsRinging(false);
    setCallStatus('ended');
  }, [logCallRecord]);

  // Cleanup on unmount
  useEffect(() => () => { endCall(); }, []); // eslint-disable-line

  // ── Metered billing: charge the fan's credits while the call is open ─────────
  // The free trial (first N seconds) is never billed. Once the trial elapses we
  // report cumulative elapsed time to the server, which charges only the new
  // seconds. If the fan runs out of credits the call ends and we prompt a top-up.
  const runBillingTick = useCallback(async () => {
    const billing = billingRef.current;
    if (!billing?.callSessionId) return;
    if (isAdmin) return; // platform owner is never billed
    const elapsed = callDurationRef.current;
    if (elapsed <= billing.freeTrialSeconds) return; // still inside free trial
    if (billingTickBusyRef.current) return;
    billingTickBusyRef.current = true;
    try {
      const r = await fetch('/api/talk-to-me/billing-tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          callSessionId: billing.callSessionId,
          artistId: effectiveId,
          elapsedSeconds: elapsed,
        }),
      });
      const data = await r.json().catch(() => null);
      if (!data) return;
      if (data.ok === false && data.reason === 'insufficient_credits') {
        setOutOfCredits(true);
        if (typeof data.balance === 'number') setCreditBalance(data.balance);
        endCall();
        return;
      }
      if (typeof data.balance === 'number') setCreditBalance(data.balance);
    } catch { /* best-effort; retried on next tick */ }
    finally { billingTickBusyRef.current = false; }
  }, [effectiveId, isAdmin, endCall]);

  useEffect(() => {
    const inCall = callStatus === 'connected' || callStatus === 'listening' || callStatus === 'speaking';
    if (!inCall) return;
    const id = window.setInterval(() => { void runBillingTick(); }, BILLING_TICK_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [callStatus, runBillingTick]); // eslint-disable-line

  // ── Format duration ────────────────────────────────────────────────────────
  const fmtDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const isInCall = ['connected', 'listening', 'speaking'].includes(callStatus);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colors.hexPrimary}18, ${colors.hexAccent}0d)`,
        border:     `1px solid ${colors.hexBorder}`,
        boxShadow:  colors.shadow,
      }}
      className="rounded-2xl overflow-hidden"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-3">
          {/* mini avatar or mic icon */}
          {avatarUrl ? (
            <div className="relative shrink-0">
              <img
                src={avatarUrl}
                alt={artistName}
                className="w-10 h-10 rounded-full object-cover object-top"
                style={{ border: `2px solid ${colors.hexAccent}55` }}
              />
              {isEnabled && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-black" />
              )}
            </div>
          ) : (
            <span className="text-2xl">📞</span>
          )}
          <div className="text-left">
            <p className="font-bold text-white text-sm tracking-wide">Talk To Me</p>
            <p className="text-xs" style={{ color: colors.textMuted }}>
              {isEnabled
                ? `Talk with ${artistName}'s AI`
                : 'Available later'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEnabled && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#10b98122', color: '#10b981' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              LIVE
            </span>
          )}
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="text-gray-400 text-xs"
          >▼</motion.span>
        </div>
      </button>

      {/* ── Expanded content ────────────────────────────────────────────── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Tabs */}
            {isOwner && (
              <div className="flex gap-1 px-4 pb-2">
                {(['call', 'config', 'stats'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-all"
                    style={
                      tab === t
                        ? { background: colors.hexAccent, color: '#fff' }
                        : { background: '#ffffff10', color: colors.textMuted }
                    }
                  >
                    {t === 'call' ? '📞 Call' : t === 'config' ? '⚙️ Config' : '📊 Stats'}
                  </button>
                ))}
              </div>
            )}

            {/* ─── CALL TAB ─────────────────────────────────────────────── */}
            {tab === 'call' && (
              <div className="px-4 pb-5">
                {!isEnabled ? (
                  <div className="flex flex-col items-center py-8 gap-4 text-center">
                    <span className="text-4xl">🎵</span>
                    <p className="text-white font-semibold">I'll be available later</p>
                    <p className="text-xs px-4" style={{ color: colors.textMuted }}>
                      Check back soon to have a conversation with me.
                    </p>
                  </div>
                ) : callStatus === 'idle' || callStatus === 'ended' ? (
                  <IdleCallScreen
                    artistName={artistName}
                    colors={colors}
                    onCall={startCall}
                    wasEnded={callStatus === 'ended'}
                    lastDuration={callDuration}
                    transcript={transcript}
                    avatarUrl={avatarUrl}
                    topics={selectedTopics}
                    pricing={pricing}
                    creditBalance={creditBalance}
                    isAdmin={isAdmin}
                    outOfCredits={outOfCredits}
                  />
                ) : callStatus === 'requesting_mic' || callStatus === 'connecting' ? (
                  <ConnectingScreen artistName={artistName} colors={colors} isRinging={isRinging} status={callStatus} avatarUrl={avatarUrl} />
                ) : callStatus === 'error' ? (
                  <ErrorScreen msg={errorMsg} onRetry={() => setCallStatus('idle')} colors={colors} />
                ) : (
                  <ActiveCallScreen
                    artistName={artistName}
                    colors={colors}
                    status={callStatus}
                    duration={callDuration}
                    transcript={transcript}
                    isMuted={isMuted}
                    transcriptEndRef={transcriptEndRef}
                    onMute={toggleMute}
                    onEnd={endCall}
                    fmtDuration={fmtDuration}
                    pricing={pricing}
                    creditBalance={creditBalance}
                    isAdmin={isAdmin}
                  />
                )}
              </div>
            )}

            {/* ─── CONFIG TAB (owner only) ───────────────────────────────── */}
            {tab === 'config' && isOwner && (
              <div className="px-4 pb-5 space-y-5">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium">Enable Talk To Me</span>
                  <button
                    onClick={() => setIsEnabled(e => !e)}
                    className="w-12 h-6 rounded-full transition-colors relative"
                    style={{ background: isEnabled ? colors.hexAccent : '#374151' }}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow"
                      style={{ left: isEnabled ? '28px' : '4px' }}
                    />
                  </button>
                </div>

                {/* Persona presets */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Personality Preset</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PERSONA_PRESETS.map(p => (
                      <button
                        key={p.value}
                        onClick={() => { setSelectedPersona(p.value); setCustomPersona(''); }}
                        className="text-left px-3 py-2 rounded-xl text-xs border transition-all"
                        style={
                          selectedPersona === p.value && !customPersona
                            ? { borderColor: colors.hexAccent, background: `${colors.hexAccent}22`, color: '#fff' }
                            : { borderColor: colors.hexBorder, background: '#ffffff05', color: colors.textMuted }
                        }
                      >
                        <span className="block text-base mb-0.5">{p.emoji}</span>
                        <span className="font-semibold">{p.label}</span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={customPersona}
                    onChange={e => setCustomPersona(e.target.value)}
                    placeholder="Or describe a custom personality…"
                    className="mt-2 w-full bg-white/5 border rounded-xl px-3 py-2 text-xs text-white resize-none focus:outline-none"
                    style={{ borderColor: colors.hexBorder }}
                  />
                </div>

                {/* Topics */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Topics to Discuss</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TOPIC_PRESETS.map(t => (
                      <button
                        key={t}
                        onClick={() =>
                          setSelectedTopics(prev =>
                            prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                          )
                        }
                        className="px-2 py-1 rounded-full text-xs border transition-all"
                        style={
                          selectedTopics.includes(t)
                            ? { borderColor: colors.hexAccent, background: `${colors.hexAccent}22`, color: '#fff' }
                            : { borderColor: colors.hexBorder, background: '#ffffff05', color: colors.textMuted }
                        }
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customTopic.trim()) {
                          setSelectedTopics(prev => [...prev, customTopic.trim()]);
                          setCustomTopic('');
                        }
                      }}
                      placeholder="Add custom topic… (Enter)"
                      className="flex-1 bg-white/5 border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                      style={{ borderColor: colors.hexBorder }}
                    />
                  </div>
                </div>

                {/* Voice selection */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">AI Voice</p>
                  <select
                    value={selectedVoice}
                    onChange={e => setSelectedVoice(e.target.value)}
                    className="w-full bg-white/5 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    style={{ borderColor: colors.hexBorder }}
                  >
                    <option value="">— Default Voice —</option>
                    {(voicesData?.voices || []).map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* Language */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Language</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['english', 'español', 'português', 'français', 'deutsch'].map(l => (
                      <button
                        key={l}
                        onClick={() => setLanguage(l)}
                        className="px-3 py-1 rounded-full text-xs border transition-all capitalize"
                        style={
                          language === l
                            ? { borderColor: colors.hexAccent, background: `${colors.hexAccent}22`, color: '#fff' }
                            : { borderColor: colors.hexBorder, background: '#ffffff05', color: colors.textMuted }
                        }
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save */}
                <button
                  onClick={() => saveConfigMutation.mutate()}
                  disabled={saveConfigMutation.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${colors.hexAccent}, ${colors.hexPrimary})` }}
                >
                  {saveConfigMutation.isPending ? 'Saving…' : saveConfigMutation.isSuccess ? '✓ Saved!' : 'Save Configuration'}
                </button>
              </div>
            )}

            {/* ─── STATS TAB (owner only) ────────────────────────────────── */}
            {tab === 'stats' && isOwner && (
              <StatsScreen
                analytics={analyticsData?.analytics ?? EMPTY_ANALYTICS}
                isLoading={analyticsLoading}
                colors={colors}
                fmtDuration={fmtDuration}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatsScreen({
  analytics, isLoading, colors, fmtDuration,
}: {
  analytics: CallAnalytics;
  isLoading: boolean;
  colors: Colors;
  fmtDuration: (s: number) => string;
}) {
  const { totalCalls, avgDuration, sentiment, topTopics, recentCalls, lastCallAt } = analytics;

  const sentimentMeta: Record<'positive' | 'neutral' | 'negative', { emoji: string; label: string; color: string }> = {
    positive: { emoji: '😊', label: 'Positive', color: '#34d399' },
    neutral:  { emoji: '😐', label: 'Neutral',  color: '#fbbf24' },
    negative: { emoji: '😔', label: 'Negative', color: '#f87171' },
  };
  const overall = sentimentMeta[sentiment.overall];
  const sentimentTotal = sentiment.positive + sentiment.neutral + sentiment.negative;
  const pct = (n: number) => (sentimentTotal === 0 ? 0 : Math.round((n / sentimentTotal) * 100));
  const maxTopic = topTopics.reduce((m, t) => Math.max(m, t.count), 0);

  const fmtWhen = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="px-4 pb-5">
        <div className="rounded-xl p-6 text-center" style={{ background: '#ffffff08' }}>
          <p className="text-xs animate-pulse" style={{ color: colors.textMuted }}>Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (totalCalls === 0) {
    return (
      <div className="px-4 pb-5">
        <div className="rounded-xl p-6 text-center" style={{ background: '#ffffff08' }}>
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm font-semibold text-white">No calls yet</p>
          <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
            Once fans start calling your AI, you'll see total calls, average duration,
            top conversation topics, and fan sentiment here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-5 space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3" style={{ background: '#ffffff08', border: `1px solid ${colors.hexBorder}` }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: colors.textMuted }}>Total Calls</p>
          <p className="text-2xl font-bold text-white mt-0.5">{totalCalls}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: '#ffffff08', border: `1px solid ${colors.hexBorder}` }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: colors.textMuted }}>Avg Duration</p>
          <p className="text-2xl font-bold text-white mt-0.5">{fmtDuration(avgDuration)}</p>
        </div>
      </div>

      {/* Fan sentiment */}
      <div className="rounded-xl p-3" style={{ background: '#ffffff08', border: `1px solid ${colors.hexBorder}` }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: colors.textMuted }}>Fan Sentiment</p>
          <span className="text-xs font-semibold" style={{ color: overall.color }}>
            {overall.emoji} {overall.label}
          </span>
        </div>
        {/* Stacked bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: '#ffffff12' }}>
          {sentiment.positive > 0 && (
            <div style={{ width: `${pct(sentiment.positive)}%`, background: sentimentMeta.positive.color }} />
          )}
          {sentiment.neutral > 0 && (
            <div style={{ width: `${pct(sentiment.neutral)}%`, background: sentimentMeta.neutral.color }} />
          )}
          {sentiment.negative > 0 && (
            <div style={{ width: `${pct(sentiment.negative)}%`, background: sentimentMeta.negative.color }} />
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px]" style={{ color: colors.textMuted }}>
          <span>😊 {sentiment.positive} ({pct(sentiment.positive)}%)</span>
          <span>😐 {sentiment.neutral} ({pct(sentiment.neutral)}%)</span>
          <span>😔 {sentiment.negative} ({pct(sentiment.negative)}%)</span>
        </div>
      </div>

      {/* Top topics */}
      <div className="rounded-xl p-3" style={{ background: '#ffffff08', border: `1px solid ${colors.hexBorder}` }}>
        <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: colors.textMuted }}>Top Topics</p>
        {topTopics.length === 0 ? (
          <p className="text-xs" style={{ color: colors.textMuted }}>Not enough conversation data yet.</p>
        ) : (
          <div className="space-y-1.5">
            {topTopics.map(t => (
              <div key={t.topic} className="flex items-center gap-2">
                <span className="text-xs text-white capitalize w-28 truncate">{t.topic}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#ffffff12' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${maxTopic === 0 ? 0 : Math.round((t.count / maxTopic) * 100)}%`,
                      background: `linear-gradient(90deg, ${colors.hexAccent}, ${colors.hexPrimary})`,
                    }}
                  />
                </div>
                <span className="text-[10px] tabular-nums" style={{ color: colors.textMuted }}>{t.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent calls */}
      {recentCalls.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: '#ffffff08', border: `1px solid ${colors.hexBorder}` }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wide" style={{ color: colors.textMuted }}>Recent Calls</p>
            <span className="text-[10px]" style={{ color: colors.textMuted }}>Last: {fmtWhen(lastCallAt)}</span>
          </div>
          <div className="space-y-1">
            {recentCalls.map((c, i) => {
              const meta = c.sentiment ? sentimentMeta[c.sentiment] : sentimentMeta.neutral;
              return (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0" style={{ borderColor: '#ffffff0a' }}>
                  <span style={{ color: meta.color }}>{meta.emoji}</span>
                  <span className="text-white tabular-nums">{fmtDuration(c.durationSeconds)}</span>
                  <span style={{ color: colors.textMuted }}>{c.messageCount} msgs</span>
                  <span style={{ color: colors.textMuted }}>{fmtWhen(c.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-center pt-1" style={{ color: colors.textMuted }}>
        Sentiment & topics are derived on-device from call transcripts — no extra AI cost.
      </p>
    </div>
  );
}

function IdleCallScreen({
  artistName, colors, onCall, wasEnded, lastDuration, transcript, avatarUrl, topics,
  pricing, creditBalance, isAdmin, outOfCredits,
}: {
  artistName: string; colors: Colors; onCall: () => void;
  wasEnded: boolean; lastDuration: number;
  transcript: TranscriptLine[];
  avatarUrl?: string;
  topics?: string[];
  pricing: TalkToMePricing;
  creditBalance: number | null;
  isAdmin: boolean;
  outOfCredits: boolean;
}) {
  const fmtDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return (
    <div className="flex flex-col items-center py-6 gap-5">
      {wasEnded && lastDuration > 0 && (
        <div className="w-full rounded-xl p-3 text-xs text-center" style={{ background: '#10b98115', border: '1px solid #10b98133', color: '#10b981' }}>
          Call ended — {fmtDuration(lastDuration)}
        </div>
      )}

      {/* ─── Artist rondel ─── */}
      <div className="relative flex items-center justify-center" style={{ width: '128px', height: '128px' }}>
        {/* outer glow */}
        <div className="absolute inset-0 rounded-full opacity-20 animate-pulse"
          style={{ background: `radial-gradient(circle, ${colors.hexAccent}, transparent 70%)` }} />
        {/* rotating dashed ring */}
        <svg className="absolute inset-0 w-full h-full" style={{ animation: 'spin 14s linear infinite' }} viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="60" fill="none"
            stroke={`${colors.hexAccent}66`} strokeWidth="1.5"
            strokeDasharray="5 9" strokeLinecap="round" />
        </svg>
        {/* solid inner ring */}
        <div className="absolute inset-[7px] rounded-full" style={{ border: `1.5px solid ${colors.hexAccent}33` }} />
        {/* photo or fallback */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={artistName}
            className="absolute rounded-full object-cover object-top shadow-2xl"
            style={{
              inset: '11px',
              width: 'calc(100% - 22px)',
              height: 'calc(100% - 22px)',
              border: `2px solid ${colors.hexAccent}55`,
            }}
          />
        ) : (
          <div
            className="absolute rounded-full flex items-center justify-center text-3xl shadow-2xl"
            style={{
              inset: '11px',
              width: 'calc(100% - 22px)',
              height: 'calc(100% - 22px)',
              background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
            }}
          >
            🎤
          </div>
        )}
        {/* live badge */}
        <span
          className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold"
          style={{ bottom: '6px', right: '4px', background: '#10b981', color: '#fff', fontSize: '8px' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Name + subtitle */}
      <div className="text-center">
        <p className="text-white font-bold text-lg leading-tight">{artistName}</p>
        <p className="text-xs mt-0.5" style={{ color: colors.hexAccent }}>AI Artist · Available now</p>
      </div>

      {/* Topics hint */}
      {topics && topics.length > 0 && (
        <div className="w-full px-2 text-center">
          <p className="text-[11px] mb-2" style={{ color: colors.textMuted }}>You can ask me about…</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {topics.slice(0, 6).map(t => (
              <span
                key={t}
                className="px-2.5 py-0.5 rounded-full text-[10px]"
                style={{
                  background: `${colors.hexAccent}14`,
                  border: `1px solid ${colors.hexAccent}30`,
                  color: colors.textMuted,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Call CTA */}
      <button
        onClick={onCall}
        className="relative overflow-hidden px-10 py-3.5 rounded-full text-white font-bold text-sm shadow-xl transition-all active:scale-95 hover:scale-[1.03]"
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 28px #10b98155' }}
      >
        <span className="flex items-center gap-2">
          <span className="text-base">📞</span>
          Call {artistName}
        </span>
      </button>

      {/* Pricing + credits */}
      {!isAdmin && (
        <div className="w-full px-2">
          <div
            className="rounded-xl p-3 flex flex-col items-center gap-1.5"
            style={{ background: `${colors.hexAccent}0d`, border: `1px solid ${colors.hexAccent}26` }}
          >
            <div className="flex items-center gap-2 text-xs">
              <span
                className="px-2 py-0.5 rounded-full font-bold"
                style={{ background: '#10b98122', color: '#10b981' }}
              >
                ✦ {pricing.freeTrialSeconds}s gratis
              </span>
              <span className="text-white font-semibold">
                luego ${pricing.usdPerMinute.toFixed(2)}/min
              </span>
            </div>
            <p className="text-[10px]" style={{ color: colors.textMuted }}>
              {pricing.creditsPerMinute} créditos por minuto
              {creditBalance !== null && (
                <> · saldo: <span style={{ color: colors.hexAccent }}>{creditBalance} créditos</span></>
              )}
            </p>
            {outOfCredits && (
              <p className="text-[11px] font-semibold text-center" style={{ color: '#ef4444' }}>
                Te quedaste sin créditos. Compra créditos para seguir hablando.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-center px-6 leading-relaxed" style={{ color: colors.textMuted }}>
        A real conversation with my AI. Ask me anything about my music, life, and upcoming projects.
      </p>

      {wasEnded && transcript.length > 0 && (
        <div className="w-full mt-1">
          <p className="text-xs text-center mb-2" style={{ color: colors.textMuted }}>Last conversation</p>
          <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl p-3" style={{ background: '#ffffff08' }}>
            {transcript.map((line, i) => (
              <div key={i} className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] px-3 py-1.5 rounded-2xl text-xs"
                  style={
                    line.role === 'user'
                      ? { background: '#10b98122', color: '#fff' }
                      : { background: '#ffffff12', color: '#e5e7eb' }
                  }
                >
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectingScreen({
  artistName, colors, isRinging, status, avatarUrl,
}: {
  artistName: string; colors: Colors; isRinging: boolean; status: CallStatus; avatarUrl?: string;
}) {
  return (
    <div className="flex flex-col items-center py-8 gap-4">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: `${colors.hexAccent}44` }} />
        <div className="absolute inset-[-3px] rounded-full" style={{ border: `1.5px solid ${colors.hexAccent}44` }} />
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={artistName}
            className="relative w-full h-full rounded-full object-cover object-top shadow-xl"
            style={{ border: `2px solid ${colors.hexAccent}55` }}
          />
        ) : (
          <div
            className="relative w-full h-full rounded-full flex items-center justify-center text-3xl"
            style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
          >
            📞
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-white font-semibold">
          {status === 'requesting_mic' ? 'Enabling microphone…' : `Calling ${artistName}…`}
        </p>
        <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
          {isRinging ? 'Ringing…' : 'Connecting to AI…'}
        </p>
      </div>
    </div>
  );
}

function ErrorScreen({
  msg, onRetry, colors,
}: {
  msg: string; onRetry: () => void; colors: Colors;
}) {
  const lowerMsg = msg.toLowerCase();
  const isSecureContextIssue = /https|secure connection|secure boostify|secure context|only secure origins/.test(lowerMsg);
  const isNoMic = /no microphone|no mic|not found|no audio capture devices/.test(lowerMsg);
  const isMicBusy = /busy|unavailable|in use|could not start audio source/.test(lowerMsg);
  const isAudioStartIssue = /audio session|playback|media volume|browser tab/.test(lowerMsg);
  const isMicDenied = !isSecureContextIssue && /permission|denied|blocked|notallowed/.test(lowerMsg) && /microphone|mic|site/.test(lowerMsg);
  const isQuotaIssue = /quota|credits|voice plan|billing|authorization issue|too many calls/.test(lowerMsg);
  const title = isSecureContextIssue
    ? 'Secure connection required'
    : isNoMic
    ? 'No microphone found'
    : isMicBusy
    ? 'Microphone is busy'
    : isAudioStartIssue
    ? 'Audio session blocked'
    : isMicDenied
    ? 'Microphone access blocked'
    : isQuotaIssue
    ? 'Voice calls temporarily paused'
    : 'Call could not start';
  const help = msg || 'Please try again from your browser tab.';
  return (
    <div className="flex flex-col items-center py-8 gap-4 text-center px-4">
      {isMicDenied || isSecureContextIssue || isNoMic || isMicBusy || isAudioStartIssue ? (
        <>
          <span className="text-4xl">🎤</span>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            {help}
          </p>
        </>
      ) : isQuotaIssue ? (
        <>
          <span className="text-4xl">💳</span>
          <p className="text-white font-semibold text-base">{title}</p>
          <p className="text-sm" style={{ color: colors.textMuted }}>
            {help}
          </p>
        </>
      ) : (
        <>
          <span className="text-4xl">🎵</span>
          <p className="text-white font-semibold text-base">I'll be available later</p>
          <p className="text-sm" style={{ color: colors.textMuted }}>
            My AI isn't available right now. Check back soon to chat.
          </p>
        </>
      )}
      <button
        onClick={onRetry}
        className="px-6 py-2 rounded-full text-sm text-white mt-1 transition-opacity hover:opacity-80"
        style={{ background: `${colors.hexAccent}cc` }}
      >
        Try again
      </button>
    </div>
  );
}

function ActiveCallScreen({
  artistName, colors, status, duration, transcript, isMuted,
  transcriptEndRef, onMute, onEnd, fmtDuration,
  pricing, creditBalance, isAdmin,
}: {
  artistName: string; colors: Colors; status: CallStatus; duration: number;
  transcript: TranscriptLine[]; isMuted: boolean;
  transcriptEndRef: React.RefObject<HTMLDivElement>;
  onMute: () => void; onEnd: () => void;
  fmtDuration: (s: number) => string;
  pricing: TalkToMePricing;
  creditBalance: number | null;
  isAdmin: boolean;
}) {
  const trialLeft = Math.max(0, pricing.freeTrialSeconds - duration);
  const inTrial = trialLeft > 0;
  const statusLabel: Record<CallStatus, string> = {
    idle:           '',
    requesting_mic: '',
    connecting:     'Connecting…',
    connected:      'Connected',
    listening:      'Listening…',
    speaking:       `${artistName} is speaking…`,
    ended:          'Call ended',
    error:          'Error',
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs"
        style={{ background: '#ffffff08' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: status === 'speaking' ? colors.hexAccent : '#10b981' }}
          />
          <span style={{ color: status === 'speaking' ? colors.hexAccent : '#10b981' }}>
            {statusLabel[status]}
          </span>
        </div>
        <span className="font-mono text-gray-400">{fmtDuration(duration)}</span>
      </div>

      {/* Billing bar */}
      {!isAdmin && (
        <div
          className="flex items-center justify-center px-3 py-1.5 rounded-lg text-[11px] gap-2"
          style={{
            background: inTrial ? '#10b98112' : `${colors.hexAccent}10`,
            border: `1px solid ${inTrial ? '#10b98133' : `${colors.hexAccent}26`}`,
          }}
        >
          {inTrial ? (
            <span style={{ color: '#10b981' }}>
              ✦ Prueba gratis · {trialLeft}s restantes
            </span>
          ) : (
            <span style={{ color: colors.hexAccent }}>
              ${pricing.usdPerMinute.toFixed(2)}/min
              {creditBalance !== null && <> · {creditBalance} créditos</>}
            </span>
          )}
        </div>
      )}

      {/* Waveform visualiser */}
      <div className="flex items-end justify-center gap-0.5 h-10 px-4">
        {Array.from({ length: 28 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-1.5 rounded-full"
            style={{ background: colors.hexAccent, opacity: 0.7 }}
            animate={{
              height: status === 'speaking'
                ? `${Math.random() * 32 + 4}px`
                : status === 'listening'
                ? `${Math.random() * 12 + 4}px`
                : '4px',
            }}
            transition={{ duration: 0.15, repeat: Infinity, repeatType: 'mirror', delay: i * 0.04 }}
          />
        ))}
      </div>

      {/* Transcript */}
      <div
        className="max-h-48 overflow-y-auto rounded-xl p-3 space-y-2"
        style={{ background: '#ffffff06' }}
      >
        {transcript.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: colors.textMuted }}>
            Conversation will appear here…
          </p>
        ) : (
          transcript.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[80%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed"
                style={
                  line.role === 'user'
                    ? { background: '#10b98122', color: '#fff', borderRadius: '16px 16px 4px 16px' }
                    : { background: '#ffffff12', color: '#e5e7eb', borderRadius: '4px 16px 16px 16px' }
                }
              >
                {line.text}
              </div>
            </motion.div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-2">
        {/* Mute */}
        <button
          onClick={onMute}
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all active:scale-90"
          style={{ background: isMuted ? '#ef444433' : '#ffffff12', border: `1px solid ${isMuted ? '#ef4444' : '#ffffff20'}` }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎙️'}
        </button>

        {/* End call */}
        <button
          onClick={onEnd}
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all active:scale-90"
          style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', boxShadow: '0 0 20px #ef444466' }}
          title="End call"
        >
          📵
        </button>
      </div>
    </div>
  );
}
