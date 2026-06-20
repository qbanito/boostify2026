/**
 * BOOSTIFY LIVE STAGE — Artist Profile module
 * --------------------------------------------------
 * Premium live-streaming monetization module. Card view inside the profile
 * plus a full-screen immersive overlay (like the other profile modules).
 *
 * Artist side: start / schedule lives, control chat, gift goals, song-request
 * price, live analytics (StageRank + Quality Score), wallet & top fans.
 * Fan side: join, chat, send animated gifts paid with credits, buy credit
 * packs (Stripe), request songs, climb the fan ranking.
 *
 * The monetization + chat + ranking layers are fully wired to /api/live-stage.
 * Real multi-viewer WebRTC video (LiveKit / Amazon IVS) plugs into <StageVideo/>
 * — the owner's local camera preview already runs via getUserMedia.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, X, Maximize2, Send, Gift, Coins, Crown, Trophy, Users, Heart,
  Sparkles, Video, VideoOff, Mic, Settings, Play, Square, TrendingUp,
  Wallet, Music, Star, Zap, Flame, ShieldCheck, Loader2, Plus, Eye,
} from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';

/* ------------------------------- types --------------------------------- */
interface BrandColors { primary?: string; secondary?: string; accent?: string }

interface Props {
  artistId: string | number;
  artistName: string;
  artistSlug?: string;
  artistAvatar?: string;
  colors?: BrandColors;
  isOwner?: boolean;
}

interface GiftDef {
  id: string; name: string; emoji: string; tier: string; credits: number;
  rankValue: number; animation: string; color: string;
}
interface CreditPackage { id: string; name: string; credits: number; bonus: number; amount: number }
interface LiveType { id: string; name: string; emoji: string }
interface Catalog {
  gifts: GiftDef[]; creditPackages: CreditPackage[]; liveTypes: LiveType[];
  artistLevels: { id: string; name: string; minScore: number }[];
  fanLevels: { id: string; name: string; minPoints: number }[];
  creditUsdValue: number;
  economy: { artist: number; platform: number; rewardPool: number };
}
interface LiveSession {
  id: string; artistId: string; artistName: string; title: string; type: string;
  visibility: string; status: 'scheduled' | 'live' | 'ended';
  chatEnabled: boolean; giftGoalCredits: number; songRequestPriceCredits: number;
  viewers: number; stageRank: number; qualityScore: number;
  totals: any; pinnedMessage?: string; scheduledAt?: string | null;
}
interface ChatMessage {
  id: string; name: string; text: string; isOwner?: boolean; pinned?: boolean;
  badge?: string | null; type?: string;
}
interface GiftEvent {
  id: string; giftId: string; name: string; emoji: string; animation: string;
  color: string; quantity: number; credits: number; senderName: string;
}
interface FanRank { userId: string; name: string; points: number; gifts?: number }

/* ------------------------------ helpers -------------------------------- */
const DEFAULTS = { primary: '#a855f7', secondary: '#ec4899', accent: '#facc15' };

function useColors(c?: BrandColors) {
  return useMemo(() => ({
    primary: c?.primary || DEFAULTS.primary,
    secondary: c?.secondary || DEFAULTS.secondary,
    accent: c?.accent || DEFAULTS.accent,
  }), [c?.primary, c?.secondary, c?.accent]);
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n || 0));
}

/* ====================================================================== */
/*  MAIN MODULE                                                            */
/* ====================================================================== */
export function BoostifyLiveStage(props: Props) {
  const colors = useColors(props.colors);
  const [open, setOpen] = useState(false);
  const artistId = String(props.artistId);

  // Catalog (gifts, packages, levels)
  const { data: catalog } = useQuery<Catalog>({
    queryKey: ['live-stage-catalog'],
    queryFn: () => apiRequest('GET', '/api/live-stage/catalog'),
    staleTime: 30 * 60_000,
  });

  // Artist sessions (history + active)
  const sessionsQuery = useQuery<{ sessions: LiveSession[]; live: LiveSession | null }>({
    queryKey: ['live-stage-sessions', artistId],
    queryFn: () => apiRequest('GET', `/api/live-stage/artist/${artistId}/sessions`),
    refetchInterval: open ? 8000 : false,
    enabled: !!artistId,
  });
  const live = sessionsQuery.data?.live || null;

  return (
    <>
      {/* ---------------------- CARD (inside profile) ---------------------- */}
      <LiveStageCard
        colors={colors}
        artistName={props.artistName}
        isOwner={props.isOwner}
        live={live}
        onOpen={() => setOpen(true)}
      />

      {/* ---------------------- FULLSCREEN OVERLAY -------------------------
         Rendered through a portal into document.body so it escapes any
         transformed / parallax ancestor in the profile (a transformed
         ancestor would trap position:fixed and clip the overlay). */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[2147483000] flex flex-col bg-[#070509]/97 backdrop-blur-2xl"
              style={{ height: '100dvh' }}
            >
              <LiveStageExperience
                {...props}
                artistId={artistId}
                colors={colors}
                catalog={catalog}
                live={live}
                refetchSessions={() => sessionsQuery.refetch()}
                onClose={() => setOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/* ====================================================================== */
/*  CARD                                                                   */
/* ====================================================================== */
function LiveStageCard({
  colors, artistName, isOwner, live, onOpen,
}: {
  colors: ReturnType<typeof useColors>; artistName: string; isOwner?: boolean;
  live: LiveSession | null; onOpen: () => void;
}) {
  const isLive = live?.status === 'live';
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 sm:p-6"
      style={{
        borderColor: `${colors.primary}33`,
        background: `radial-gradient(140% 120% at 0% 0%, ${colors.primary}1f, transparent 55%), radial-gradient(120% 120% at 100% 100%, ${colors.secondary}1a, transparent 60%), #0c0a10`,
      }}
    >
      <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl opacity-30" style={{ background: colors.primary }} />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${colors.primary}22`, border: `1px solid ${colors.primary}55` }}>
              <Radio className="h-6 w-6" style={{ color: colors.accent }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Boostify Live Stage</h3>
              <p className="text-xs text-white/50">Lives, gifts, credits &amp; fan ranking</p>
            </div>
          </div>
          {isLive && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE
            </span>
          )}
        </div>

        {isLive ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-sm font-semibold text-white truncate">{live?.title}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-white/60">
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{fmt(live?.viewers || 0)}</span>
              <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" />{fmt(live?.totals?.giftsCredits || 0)}</span>
              <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />Rank {fmt(live?.stageRank || 0)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/60">
            {isOwner
              ? 'Go live on stage and receive gifts and credits from your fans in real time.'
              : `${artistName} isn't live yet. Join to follow and catch the next show.`}
          </p>
        )}

        <button
          onClick={onOpen}
          className="group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.02]"
          style={{ background: `linear-gradient(90deg, ${colors.accent}, ${colors.secondary})` }}
        >
          {isLive ? <Play className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isLive ? 'Join Live' : isOwner ? 'Open Live Stage Studio' : 'Open Live Stage'}
        </button>
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  FULLSCREEN EXPERIENCE                                                   */
/* ====================================================================== */
function LiveStageExperience({
  artistId, artistName, artistAvatar, artistSlug, isOwner, colors, catalog, live, refetchSessions, onClose,
}: Props & {
  artistId: string; colors: ReturnType<typeof useColors>; catalog?: Catalog;
  live: LiveSession | null; refetchSessions: () => void; onClose: () => void;
}) {
  const qc = useQueryClient();
  const isLive = live?.status === 'live';
  const [tab, setTab] = useState<'stage' | 'dashboard'>(isLive ? 'stage' : isOwner ? 'dashboard' : 'stage');

  return (
    <div className="flex h-full w-full flex-col">
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${colors.primary}22` }}>
            <Radio className="h-5 w-5" style={{ color: colors.accent }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Boostify Live Stage</h2>
            <p className="text-[11px] text-white/50">{artistName}</p>
          </div>
          {isLive && (
            <span className="ml-2 flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <div className="hidden rounded-lg bg-white/5 p-1 sm:flex">
              <TabBtn active={tab === 'stage'} onClick={() => setTab('stage')} colors={colors}>Stage</TabBtn>
              <TabBtn active={tab === 'dashboard'} onClick={() => setTab('dashboard')} colors={colors}>Studio</TabBtn>
            </div>
          )}
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* mobile tabs */}
      {isOwner && (
        <div className="flex gap-1 border-b border-white/10 p-2 sm:hidden">
          <TabBtn active={tab === 'stage'} onClick={() => setTab('stage')} colors={colors} full>Stage</TabBtn>
          <TabBtn active={tab === 'dashboard'} onClick={() => setTab('dashboard')} colors={colors} full>Studio</TabBtn>
        </div>
      )}

      {/* body */}
      <div className="flex-1 overflow-hidden">
        {tab === 'dashboard' && isOwner ? (
          <ArtistStudio
            artistId={artistId} artistName={artistName} artistAvatar={artistAvatar} artistSlug={artistSlug}
            colors={colors} catalog={catalog} live={live}
            onChange={() => { refetchSessions(); qc.invalidateQueries({ queryKey: ['live-stage-sessions', artistId] }); }}
          />
        ) : (
          <StageRoom
            artistId={artistId} artistName={artistName} artistAvatar={artistAvatar}
            isOwner={isOwner} colors={colors} catalog={catalog} live={live}
            onChange={refetchSessions}
          />
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, colors, children, full }: any) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${full ? 'flex-1' : ''} ${active ? 'text-black' : 'text-white/60 hover:text-white'}`}
      style={active ? { background: colors.accent } : undefined}
    >
      {children}
    </button>
  );
}

/* ====================================================================== */
/*  STAGE ROOM (live video + chat + gifts) — fan + owner viewing           */
/* ====================================================================== */
function StageRoom({
  artistId, artistName, artistAvatar, isOwner, colors, catalog, live, onChange,
}: {
  artistId: string; artistName: string; artistAvatar?: string; isOwner?: boolean;
  colors: ReturnType<typeof useColors>; catalog?: Catalog; live: LiveSession | null; onChange: () => void;
}) {
  const sessionId = live?.id;
  const isLive = live?.status === 'live';
  const [giftPanel, setGiftPanel] = useState(false);
  const [creditModal, setCreditModal] = useState(false);
  const [songModal, setSongModal] = useState(false);
  const [animQueue, setAnimQueue] = useState<GiftEvent[]>([]);
  const seenGifts = useRef<Set<string>>(new Set());

  // credit balance
  const balanceQuery = useQuery<{ balance: number; usd: number }>({
    queryKey: ['live-stage-balance'],
    queryFn: () => apiRequest('GET', '/api/live-stage/credits/balance'),
    refetchInterval: 15000,
  });
  const balance = balanceQuery.data?.balance ?? 0;

  // gifts polling → animation queue
  const giftsQuery = useQuery<{ gifts: GiftEvent[] }>({
    queryKey: ['live-stage-gifts', sessionId],
    queryFn: () => apiRequest('GET', `/api/live-stage/sessions/${sessionId}/gifts`),
    refetchInterval: isLive ? 3000 : false,
    enabled: !!sessionId && isLive,
  });
  useEffect(() => {
    const incoming = giftsQuery.data?.gifts || [];
    const fresh = incoming.filter((g) => !seenGifts.current.has(g.id));
    if (fresh.length) {
      fresh.forEach((g) => seenGifts.current.add(g.id));
      setAnimQueue((q) => [...q, ...fresh].slice(-6));
    }
  }, [giftsQuery.data]);

  // heartbeat (viewer presence + watch time)
  useEffect(() => {
    if (!sessionId || !isLive) return;
    let watched = 0;
    const tick = setInterval(() => {
      watched += 10;
      apiRequest('POST', `/api/live-stage/sessions/${sessionId}/heartbeat`, { watchedSeconds: 10, viewers: (live?.viewers || 0) + 1 }).catch(() => {});
    }, 10000);
    return () => clearInterval(tick);
  }, [sessionId, isLive]);

  if (!isLive) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `${colors.primary}1f` }}>
          <Radio className="h-10 w-10" style={{ color: colors.accent }} />
        </div>
        <h3 className="text-xl font-bold text-white">{artistName} isn't live</h3>
        <p className="max-w-md text-sm text-white/60">
          {isOwner ? 'Open the Studio to start or schedule your next live.' : 'Follow the artist to get notified when they go live.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-rows-[1fr_auto] lg:grid-cols-[1fr_360px] lg:grid-rows-1">
      {/* video / stage */}
      <div className="relative overflow-hidden bg-black">
        <StageVideo isOwner={isOwner} artistName={artistName} artistAvatar={artistAvatar} colors={colors} sessionId={sessionId!} />

        {/* gift goal bar */}
        {!!live?.giftGoalCredits && (
          <div className="absolute left-3 right-3 top-3 rounded-full bg-black/50 p-1 backdrop-blur">
            <div className="flex items-center gap-2 px-2">
              <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: colors.accent }} />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, ((live?.totals?.giftsCredits || 0) / live.giftGoalCredits) * 100)}%`, background: `linear-gradient(90deg, ${colors.accent}, ${colors.secondary})` }} />
              </div>
              <span className="text-[10px] font-bold text-white">{fmt(live?.totals?.giftsCredits || 0)}/{fmt(live.giftGoalCredits)}</span>
            </div>
          </div>
        )}

        {/* live stats */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"><Eye className="h-3 w-3" />{fmt(live?.viewers || 0)}</span>
          <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"><Star className="h-3 w-3" style={{ color: colors.accent }} />{fmt(live?.qualityScore || 0)}</span>
        </div>

        {/* floating gift animations */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <AnimatePresence>
            {animQueue.map((g) => <GiftAnimation key={g.id} gift={g} onDone={() => setAnimQueue((q) => q.filter((x) => x.id !== g.id))} />)}
          </AnimatePresence>
        </div>
      </div>

      {/* chat + actions */}
      <div className="flex min-h-0 flex-col border-t border-white/10 lg:border-l lg:border-t-0">
        <LiveChat sessionId={sessionId!} colors={colors} chatEnabled={live?.chatEnabled !== false} pinned={live?.pinnedMessage} />

        {/* action bar */}
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button onClick={() => setCreditModal(true)} className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
              <Coins className="h-3.5 w-3.5" style={{ color: colors.accent }} />{fmt(balance)} credits
            </button>
            <button onClick={() => setSongModal(true)} className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
              <Music className="h-3.5 w-3.5" />Request a song
            </button>
          </div>
          <button
            onClick={() => setGiftPanel(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black transition-transform hover:scale-[1.02]"
            style={{ background: `linear-gradient(90deg, ${colors.accent}, ${colors.secondary})` }}
          >
            <Gift className="h-4 w-4" /> Send a gift
          </button>
        </div>
      </div>

      {/* modals */}
      <AnimatePresence>
        {giftPanel && catalog && (
          <GiftPanel
            sessionId={sessionId!} colors={colors} gifts={catalog.gifts} balance={balance}
            onClose={() => setGiftPanel(false)}
            onSent={() => { balanceQuery.refetch(); }}
            onNeedCredits={() => { setGiftPanel(false); setCreditModal(true); }}
          />
        )}
        {creditModal && catalog && (
          <CreditModal packages={catalog.creditPackages} creditUsd={catalog.creditUsdValue} colors={colors} onClose={() => setCreditModal(false)} onGranted={() => balanceQuery.refetch()} />
        )}
        {songModal && (
          <SongRequestModal sessionId={sessionId!} price={live?.songRequestPriceCredits || 0} colors={colors} onClose={() => setSongModal(false)} onSent={() => balanceQuery.refetch()} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------- stage video ----------------------------- */
function StageVideo({ isOwner, artistName, artistAvatar, colors, sessionId }: {
  isOwner?: boolean; artistName: string; artistAvatar?: string; colors: ReturnType<typeof useColors>; sessionId: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  // Bind the active stream to the <video> element whenever either changes.
  useEffect(() => {
    const el = videoRef.current;
    if (el && camOn && streamRef.current) {
      el.srcObject = streamRef.current;
      el.muted = true;
      el.play().catch(() => {});
    }
  }, [camOn]);

  const startCam = useCallback(async () => {
    setCamError(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setCamOn(true);
    } catch (err: any) {
      const name = err?.name || '';
      let msg = 'Could not access the camera.';
      if (name === 'NotAllowedError' || name === 'SecurityError') msg = 'Camera permission denied. Allow access in your browser and try again.';
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') msg = 'No camera found on this device.';
      else if (name === 'NotReadableError') msg = 'Camera is already in use by another app or tab.';
      else if (err?.message === 'unsupported') msg = 'This browser does not support camera access.';
      setCamError(msg);
      setCamOn(false);
    } finally {
      setStarting(false);
    }
  }, []);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  // Owner broadcasting their own camera
  if (isOwner) {
    return (
      <div className="relative h-full w-full">
        <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
        {!camOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center">
            <Video className="h-10 w-10 text-white/40" />
            <button
              onClick={startCam}
              disabled={starting}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60"
              style={{ background: colors.accent }}
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
              {starting ? 'Starting…' : 'Turn on camera'}
            </button>
            {camError && (
              <p className="max-w-xs text-xs text-red-300">{camError}</p>
            )}
            {!camError && (
              <p className="max-w-xs text-[11px] text-white/40">Your browser will ask for camera &amp; microphone permission.</p>
            )}
          </div>
        )}
        {camOn && (
          <button onClick={stopCam} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white" title="Turn off camera">
            <VideoOff className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Viewer placeholder stage (real WebRTC/IVS stream plugs in here)
  return (
    <div className="relative flex h-full w-full items-center justify-center" style={{ background: `radial-gradient(circle at 50% 35%, ${colors.primary}33, #000 70%)` }}>
      <div className="flex flex-col items-center gap-4">
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2.4 }} className="relative">
          {artistAvatar ? (
            <img src={artistAvatar} alt={artistName} className="h-28 w-28 rounded-full object-cover ring-4" style={{ ['--tw-ring-color' as any]: colors.accent }} />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full text-3xl font-black text-black" style={{ background: colors.accent }}>
              {artistName.slice(0, 1)}
            </div>
          )}
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">LIVE</span>
        </motion.div>
        <p className="text-lg font-bold text-white">{artistName}</p>
        <p className="text-xs text-white/50">Live broadcast · Boostify stage</p>
      </div>
    </div>
  );
}

/* ---------------------------- gift animation --------------------------- */
function GiftAnimation({ gift, onDone }: { gift: GiftEvent; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  const x = useMemo(() => 10 + Math.random() * 70, []);
  return (
    <motion.div
      initial={{ y: '90%', opacity: 0, scale: 0.4 }}
      animate={{ y: '15%', opacity: 1, scale: 1.2 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ duration: 1.1, ease: 'easeOut' }}
      className="absolute flex flex-col items-center"
      style={{ left: `${x}%` }}
    >
      <span className="text-5xl drop-shadow-[0_0_12px_rgba(0,0,0,0.6)]">{gift.emoji}</span>
      <span className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-black" style={{ background: gift.color }}>
        {gift.senderName} ×{gift.quantity}
      </span>
    </motion.div>
  );
}

/* ------------------------------- chat ---------------------------------- */
function LiveChat({ sessionId, colors, chatEnabled, pinned }: {
  sessionId: string; colors: ReturnType<typeof useColors>; chatEnabled: boolean; pinned?: string;
}) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const chatQuery = useQuery<{ messages: ChatMessage[] }>({
    queryKey: ['live-stage-chat', sessionId],
    queryFn: () => apiRequest('GET', `/api/live-stage/sessions/${sessionId}/chat`),
    refetchInterval: 3000,
  });
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [chatQuery.data]);

  const send = useMutation({
    mutationFn: (t: string) => apiRequest('POST', `/api/live-stage/sessions/${sessionId}/chat`, { text: t }),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['live-stage-chat', sessionId] }); },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {pinned && (
        <div className="m-2 flex items-start gap-2 rounded-lg border p-2" style={{ borderColor: `${colors.accent}55`, background: `${colors.accent}12` }}>
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: colors.accent }} />
          <p className="text-xs text-white/90">{pinned}</p>
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {(chatQuery.data?.messages || []).map((m) => (
          <div key={m.id} className="flex flex-col">
            <div className="flex items-center gap-1.5">
              {m.isOwner && <Crown className="h-3 w-3" style={{ color: colors.accent }} />}
              <span className="text-[11px] font-bold" style={{ color: m.isOwner ? colors.accent : colors.primary }}>{m.name}</span>
              {m.badge && <span className="rounded-full bg-white/10 px-1.5 py-px text-[9px] text-white/60">{m.badge}</span>}
            </div>
            <p className="text-sm text-white/85">{m.text}</p>
          </div>
        ))}
        {!(chatQuery.data?.messages || []).length && (
          <p className="py-8 text-center text-xs text-white/40">Be the first to say hi 👋</p>
        )}
      </div>
      {chatEnabled ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(text.trim()); }}
          className="flex items-center gap-2 border-t border-white/10 p-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            maxLength={300}
            className="flex-1 rounded-full bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />
          <button type="submit" disabled={send.isPending} className="flex h-9 w-9 items-center justify-center rounded-full text-black" style={{ background: colors.accent }}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      ) : (
        <p className="border-t border-white/10 p-3 text-center text-xs text-white/40">Chat is disabled</p>
      )}
    </div>
  );
}

/* ----------------------------- gift panel ------------------------------ */
function GiftPanel({ sessionId, colors, gifts, balance, onClose, onSent, onNeedCredits }: {
  sessionId: string; colors: ReturnType<typeof useColors>; gifts: GiftDef[]; balance: number;
  onClose: () => void; onSent: () => void; onNeedCredits: () => void;
}) {
  const [sending, setSending] = useState<string | null>(null);
  const send = async (g: GiftDef) => {
    if (balance < g.credits) { onNeedCredits(); return; }
    setSending(g.id);
    try {
      await apiRequest('POST', `/api/live-stage/sessions/${sessionId}/gift`, { giftId: g.id, quantity: 1 });
      onSent();
    } catch { /* insufficient or error */ }
    setSending(null);
  };
  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28 }}
      className="absolute inset-x-0 bottom-0 z-10 max-h-[70%] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0c0a12] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-bold text-white"><Gift className="h-4 w-4" style={{ color: colors.accent }} />Gift catalog</h4>
        <button onClick={onClose} className="text-white/50 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="mb-3 flex items-center gap-1.5 text-xs text-white/60"><Coins className="h-3.5 w-3.5" style={{ color: colors.accent }} />{fmt(balance)} credits available</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {gifts.map((g) => (
          <button key={g.id} onClick={() => send(g)} disabled={!!sending}
            className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-3 transition-transform hover:scale-[1.03] disabled:opacity-50">
            <span className="text-3xl">{g.emoji}</span>
            <span className="text-[11px] font-semibold text-white">{g.name}</span>
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: colors.accent }}>
              {sending === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3" />}{g.credits}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* ----------------------------- credit modal ---------------------------- */
function CreditModal({ packages, creditUsd, colors, onClose, onGranted }: {
  packages: CreditPackage[]; creditUsd: number; colors: ReturnType<typeof useColors>; onClose: () => void; onGranted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const buy = async (p: CreditPackage) => {
    setBusy(p.id);
    try {
      const res = await apiRequest('POST', '/api/live-stage/credits/checkout', { packageId: p.id, returnTo: window.location.pathname });
      if (res?.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      if (res?.devGranted) { onGranted(); onClose(); }
    } catch { /* ignore */ }
    setBusy(null);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0a12] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-base font-bold text-white"><Coins className="h-5 w-5" style={{ color: colors.accent }} />Buy credits</h4>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2">
          {packages.map((p) => (
            <button key={p.id} onClick={() => buy(p)} disabled={!!busy}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 disabled:opacity-50">
              <div className="text-left">
                <p className="text-sm font-bold text-white">{p.name}</p>
                <p className="text-xs text-white/60">{fmt(p.credits + p.bonus)} credits {p.bonus > 0 && <span style={{ color: colors.accent }}>(+{fmt(p.bonus)} bonus)</span>}</p>
              </div>
              <span className="rounded-lg px-3 py-1.5 text-sm font-bold text-black" style={{ background: colors.accent }}>
                {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `$${(p.amount / 100).toFixed(2)}`}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[10px] text-white/40">1 credit ≈ ${creditUsd.toFixed(2)} · secure payments with Stripe</p>
      </motion.div>
    </motion.div>
  );
}

/* -------------------------- song request modal ------------------------- */
function SongRequestModal({ sessionId, price, colors, onClose, onSent }: {
  sessionId: string; price: number; colors: ReturnType<typeof useColors>; onClose: () => void; onSent: () => void;
}) {
  const [song, setSong] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!song.trim()) return;
    setBusy(true);
    try { await apiRequest('POST', `/api/live-stage/sessions/${sessionId}/song-request`, { song: song.trim() }); onSent(); onClose(); }
    catch { /* ignore */ }
    setBusy(false);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0a12] p-5">
        <h4 className="mb-3 flex items-center gap-2 text-base font-bold text-white"><Music className="h-5 w-5" style={{ color: colors.accent }} />Request a song</h4>
        <input value={song} onChange={(e) => setSong(e.target.value)} placeholder="Song name…" maxLength={120}
          className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30" />
        <button onClick={submit} disabled={busy || !song.trim()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-black disabled:opacity-50" style={{ background: colors.accent }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {price > 0 ? `Send (${price} credits)` : 'Send request'}
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ====================================================================== */
/*  ARTIST STUDIO (owner dashboard)                                        */
/* ====================================================================== */
function ArtistStudio({ artistId, artistName, artistAvatar, artistSlug, colors, catalog, live, onChange }: {
  artistId: string; artistName: string; artistAvatar?: string; artistSlug?: string;
  colors: ReturnType<typeof useColors>; catalog?: Catalog; live: LiveSession | null; onChange: () => void;
}) {
  const isLive = live?.status === 'live';

  // wallet
  const walletQuery = useQuery<{ wallet: any; transactions: any[] }>({
    queryKey: ['live-stage-wallet', artistId],
    queryFn: () => apiRequest('GET', `/api/live-stage/wallet/${artistId}`),
    refetchInterval: 12000,
  });
  // analytics for active live
  const analyticsQuery = useQuery<{ analytics: any }>({
    queryKey: ['live-stage-analytics', live?.id],
    queryFn: () => apiRequest('GET', `/api/live-stage/sessions/${live!.id}/analytics`),
    refetchInterval: isLive ? 6000 : false,
    enabled: !!live?.id,
  });
  const wallet = walletQuery.data?.wallet;
  const a = analyticsQuery.data?.analytics;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        {/* Go live / control */}
        {isLive ? (
          <LiveControlPanel artistId={artistId} colors={colors} live={live!} onChange={onChange} />
        ) : (
          <StartLivePanel artistId={artistId} artistName={artistName} artistAvatar={artistAvatar} artistSlug={artistSlug} colors={colors} catalog={catalog} onStarted={onChange} />
        )}

        {/* Wallet */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Wallet className="h-4 w-4" style={{ color: colors.accent }} />Artist wallet</h4>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-white">{fmt(wallet?.creditsBalance || 0)}</span>
            <span className="mb-1 text-xs text-white/50">credits · ${(wallet?.usdBalance || 0).toFixed(2)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-black" style={{ background: colors.accent }}>{wallet?.level?.name || 'New Stage'}</span>
            <span className="text-[11px] text-white/40">75% of every gift is yours</span>
          </div>
          <PayoutButton artistId={artistId} colors={colors} wallet={wallet} onDone={() => walletQuery.refetch()} />
          <div className="mt-3 max-h-32 space-y-1 overflow-y-auto">
            {(walletQuery.data?.transactions || []).slice(0, 8).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-[11px]">
                <span className="text-white/50">{t.type}</span>
                <span className="font-semibold" style={{ color: (t.artistCredits || t.credits) >= 0 ? colors.accent : '#f87171' }}>
                  {t.type === 'gift' ? `+${fmt(t.artistCredits || 0)}` : t.type === 'payout' ? `${fmt(t.credits)}` : `+${fmt(t.artistCredits || t.credits || 0)}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics + StageRank */}
        {isLive && a && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><TrendingUp className="h-4 w-4" style={{ color: colors.accent }} />Live analytics</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Viewers" value={fmt(a.viewers)} icon={Eye} colors={colors} />
              <Stat label="Peak" value={fmt(a.peakViewers)} icon={Users} colors={colors} />
              <Stat label="Messages" value={fmt(a.chatMessages)} icon={Send} colors={colors} />
              <Stat label="Gifts" value={fmt(a.giftsCount)} icon={Gift} colors={colors} />
              <Stat label="Credits" value={fmt(a.giftsCredits)} icon={Coins} colors={colors} />
              <Stat label="Gross revenue" value={`$${(a.grossUsd || 0).toFixed(2)}`} icon={Wallet} colors={colors} />
              <Stat label="Quality" value={`${a.qualityScore}`} icon={Star} colors={colors} />
              <Stat label="StageRank" value={fmt(a.stageRank)} icon={TrendingUp} colors={colors} />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border p-2 text-xs"
              style={{ borderColor: a.qualifiesForDiscovery ? `${colors.accent}55` : '#ffffff22', background: a.qualifiesForDiscovery ? `${colors.accent}12` : 'transparent' }}>
              <ShieldCheck className="h-4 w-4" style={{ color: a.qualifiesForDiscovery ? colors.accent : '#9ca3af' }} />
              <span className="text-white/80">{a.qualifiesForDiscovery ? 'Your live qualifies for Discovery and Trending.' : 'Improve quality/engagement to appear in Discovery (threshold 55).'}</span>
            </div>
            {/* Top fans */}
            {!!(a.topFans || []).length && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-white/60">Top fans</p>
                <div className="space-y-1">
                  {a.topFans.slice(0, 5).map((f: FanRank, i: number) => (
                    <div key={f.userId} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5">
                      <span className="flex items-center gap-2 text-xs text-white">
                        <span className="font-black" style={{ color: i === 0 ? colors.accent : 'white' }}>#{i + 1}</span>{f.name}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: colors.accent }}><Heart className="h-3 w-3" />{fmt(f.points)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Song requests for owner */}
        {isLive && <SongRequestQueue sessionId={live!.id} colors={colors} />}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, colors }: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <Icon className="mb-1 h-4 w-4" style={{ color: colors.accent }} />
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[10px] text-white/50">{label}</p>
    </div>
  );
}

/* --------------------------- start live panel -------------------------- */
function StartLivePanel({ artistId, artistName, artistAvatar, artistSlug, colors, catalog, onStarted }: {
  artistId: string; artistName: string; artistAvatar?: string; artistSlug?: string;
  colors: ReturnType<typeof useColors>; catalog?: Catalog; onStarted: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('performance');
  const [visibility, setVisibility] = useState('public');
  const [giftGoal, setGiftGoal] = useState(1000);
  const [songPrice, setSongPrice] = useState(25);
  const [busy, setBusy] = useState(false);

  const start = async (scheduled: boolean) => {
    setBusy(true);
    try {
      await apiRequest('POST', '/api/live-stage/sessions', {
        artistId, artistName, artistAvatar, artistSlug,
        title: title.trim() || `${artistName} Live`, type, visibility,
        giftGoalCredits: giftGoal, songRequestPriceCredits: songPrice,
        scheduledAt: scheduled ? new Date(Date.now() + 3600_000).toISOString() : undefined,
      });
      onStarted();
    } catch { /* ignore */ }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Radio className="h-4 w-4" style={{ color: colors.accent }} />Start a Live</h4>
      <div className="space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Live title…" maxLength={120}
          className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30" />
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-white/50">Live type</p>
          <div className="flex flex-wrap gap-1.5">
            {(catalog?.liveTypes || []).map((t) => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${type === t.id ? 'text-black' : 'bg-white/5 text-white/60 hover:text-white'}`}
                style={type === t.id ? { background: colors.accent } : undefined}>
                {t.emoji} {t.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-white/50">Visibility</p>
          <div className="flex gap-1.5">
            {[['public', 'Free'], ['ticketed', 'Ticketed'], ['vip', 'VIP room'], ['private', 'Private']].map(([v, l]) => (
              <button key={v} onClick={() => setVisibility(v)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${visibility === v ? 'text-black' : 'bg-white/5 text-white/60'}`}
                style={visibility === v ? { background: colors.accent } : undefined}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-white/50">Gift goal (credits)
            <input type="number" value={giftGoal} onChange={(e) => setGiftGoal(Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-white/5 px-2 py-1.5 text-sm text-white outline-none" />
          </label>
          <label className="text-[11px] text-white/50">Song request price
            <input type="number" value={songPrice} onChange={(e) => setSongPrice(Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-white/5 px-2 py-1.5 text-sm text-white outline-none" />
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={() => start(false)} disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black disabled:opacity-50"
            style={{ background: `linear-gradient(90deg, ${colors.accent}, ${colors.secondary})` }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Go live
          </button>
          <button onClick={() => start(true)} disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50">
            <Plus className="h-4 w-4" />Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- live control panel ------------------------- */
function LiveControlPanel({ artistId, colors, live, onChange }: {
  artistId: string; colors: ReturnType<typeof useColors>; live: LiveSession; onChange: () => void;
}) {
  const [announce, setAnnounce] = useState('');
  const [busy, setBusy] = useState(false);

  const endLive = async () => {
    setBusy(true);
    try { await apiRequest('PATCH', `/api/live-stage/sessions/${live.id}`, { action: 'end' }); onChange(); }
    catch { /* ignore */ }
    setBusy(false);
  };
  const toggleChat = async () => {
    try { await apiRequest('PATCH', `/api/live-stage/sessions/${live.id}`, { chatEnabled: !live.chatEnabled }); onChange(); } catch { /* ignore */ }
  };
  const sendAnnounce = async () => {
    if (!announce.trim()) return;
    try { await apiRequest('POST', `/api/live-stage/sessions/${live.id}/announce`, { text: announce.trim() }); setAnnounce(''); onChange(); } catch { /* ignore */ }
  };

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: '#ef444455', background: '#ef444410' }}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-bold text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />You're LIVE
        </h4>
        <span className="text-xs text-white/50">{live.title}</span>
      </div>
      <div className="mb-3 flex gap-2">
        <input value={announce} onChange={(e) => setAnnounce(e.target.value)} placeholder="Pinned announcement…" maxLength={280}
          className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30" />
        <button onClick={sendAnnounce} className="rounded-lg px-3 py-2 text-sm font-semibold text-black" style={{ background: colors.accent }}><Sparkles className="h-4 w-4" /></button>
      </div>
      <div className="flex gap-2">
        <button onClick={toggleChat} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
          <Settings className="h-4 w-4" />Chat: {live.chatEnabled ? 'ON' : 'OFF'}
        </button>
        <button onClick={endLive} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}End live
        </button>
      </div>
    </div>
  );
}

/* --------------------------- payout button ----------------------------- */
function PayoutButton({ artistId, colors, wallet, onDone }: {
  artistId: string; colors: ReturnType<typeof useColors>; wallet: any; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const request = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await apiRequest('POST', '/api/live-stage/payouts', { artistId, credits: wallet?.creditsBalance || 0 });
      if (res?.success) { setMsg('Payout requested'); onDone(); }
    } catch (e: any) {
      setMsg(e?.message?.includes('kyc') ? 'Verify your identity (KYC) to withdraw' : 'Not available');
    }
    setBusy(false);
  };
  return (
    <div className="mt-3">
      <button onClick={request} disabled={busy || !(wallet?.creditsBalance > 0)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 py-2 text-xs font-semibold text-white hover:bg-white/5 disabled:opacity-40">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" style={{ color: colors.accent }} />}
        Withdraw earnings
      </button>
      {msg && <p className="mt-1 text-center text-[10px] text-white/50">{msg}</p>}
    </div>
  );
}

/* ------------------------- song request queue -------------------------- */
function SongRequestQueue({ sessionId, colors }: { sessionId: string; colors: ReturnType<typeof useColors> }) {
  const qc = useQueryClient();
  const q = useQuery<{ requests: any[] }>({
    queryKey: ['live-stage-requests', sessionId],
    queryFn: () => apiRequest('GET', `/api/live-stage/sessions/${sessionId}/song-requests`),
    refetchInterval: 8000,
  });
  const fulfill = async (reqId: string, status: string) => {
    try { await apiRequest('PATCH', `/api/live-stage/sessions/${sessionId}/song-requests/${reqId}`, { status }); qc.invalidateQueries({ queryKey: ['live-stage-requests', sessionId] }); } catch { /* ignore */ }
  };
  const reqs = (q.data?.requests || []).filter((r) => r.status === 'pending');
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Music className="h-4 w-4" style={{ color: colors.accent }} />Song requests</h4>
      {!reqs.length && <p className="text-xs text-white/40">No requests yet.</p>}
      <div className="space-y-1.5">
        {reqs.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-white">{r.song}</p>
              <p className="text-[10px] text-white/50">{r.name} · {fmt(r.credits)} credits</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => fulfill(r.id, 'fulfilled')} className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-black" style={{ background: colors.accent }}>Played</button>
              <button onClick={() => fulfill(r.id, 'declined')} className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-white/70">Skip</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BoostifyLiveStage;
