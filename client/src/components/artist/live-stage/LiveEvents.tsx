/**
 * BOOSTIFY LIVE STAGE — Paid Live Events
 * --------------------------------------------------
 * Creators publish ticketed live events (live courses, podcasts, masterclasses,
 * workshops, Q&As, exclusive performances), set their own price and sell them
 * on the platform through a shareable promo link. Revenue splits 70% creator /
 * 30% Boostify and is settled with Stripe (dev fallback grants instantly).
 * Ticket holders get a private messaging / Q&A room for each event.
 *
 *   <LiveEventsManager/>   creator dashboard (create / publish / go live / sales)
 *   <LiveEventsShowcase/>  fan-facing rail that sells tickets on the profile
 *   <EventRoomModal/>      ticket-gated room with live messaging
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Loader2, Calendar, Clock, Users, Coins, Share2, Check, Send,
  Radio, Square, Ticket, Sparkles, DollarSign, Lock, ArrowRight, MessageCircle,
} from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';

type LC = { primary: string; secondary: string; accent: string };

export interface LiveEvent {
  id: string; ownerId: string; artistId: string; artistName?: string | null;
  title: string; type: string; description?: string | null; coverImage?: string | null;
  priceUsd: number; currency?: string; scheduledAt?: string | null; durationMinutes?: number | null;
  maxSeats?: number | null; soldCount?: number; revenueUsd?: number; creatorEarnedUsd?: number;
  status: 'draft' | 'published' | 'live' | 'ended' | 'cancelled'; shareSlug?: string; sessionId?: string | null;
}
interface EventType { id: string; name: string; emoji: string; desc: string }

const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: 'rgba(255,255,255,0.08)', fg: '#cbd5e1' },
  published: { label: 'On sale', bg: 'rgba(16,185,129,0.18)', fg: '#6ee7b7' },
  live: { label: 'LIVE', bg: 'rgba(239,68,68,0.2)', fg: '#fca5a5' },
  ended: { label: 'Ended', bg: 'rgba(255,255,255,0.06)', fg: '#94a3b8' },
  cancelled: { label: 'Cancelled', bg: 'rgba(255,255,255,0.06)', fg: '#94a3b8' },
};

function money(n?: number | null): string {
  const v = Number(n || 0);
  return v <= 0 ? 'Free' : `$${v.toFixed(2)}`;
}
function dateLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function typeEmoji(types: EventType[], id: string): string {
  return types.find((t) => t.id === id)?.emoji || '🎬';
}

function useEventTypes() {
  const { data } = useQuery<{ types: EventType[] }>({
    queryKey: ['live-stage-event-types'],
    queryFn: () => apiRequest('GET', '/api/live-stage/events/types'),
    staleTime: 60 * 60_000,
  });
  return data?.types || [];
}

/* ====================================================================== */
/*  CREATOR — manage paid events                                           */
/* ====================================================================== */
export function LiveEventsManager({ artistId, artistName, artistSlug, colors }: {
  artistId: string; artistName: string; artistSlug?: string; colors: LC;
}) {
  const qc = useQueryClient();
  const types = useEventTypes();
  const [creating, setCreating] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ events: LiveEvent[] }>({
    queryKey: ['live-stage-events-mine', artistId],
    queryFn: () => apiRequest('GET', '/api/live-stage/events/mine'),
  });
  const events = data?.events || [];

  const refresh = () => qc.invalidateQueries({ queryKey: ['live-stage-events-mine', artistId] });

  const patch = useMutation({
    mutationFn: (v: { id: string; body: any }) => apiRequest('PATCH', `/api/live-stage/events/${v.id}`, v.body),
    onSuccess: refresh,
  });
  const goLive = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/live-stage/events/${id}/start`, {}),
    onSuccess: refresh,
  });
  const endEvent = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/live-stage/events/${id}/end`, {}),
    onSuccess: refresh,
  });

  const promoLink = useCallback((ev: LiveEvent) => {
    const handle = artistSlug || ev.artistId;
    return `${window.location.origin}/artist/${handle}#live-stage`;
  }, [artistSlug]);

  const copyPromo = useCallback(async (ev: LiveEvent) => {
    try {
      await navigator.clipboard.writeText(promoLink(ev));
      setCopied(ev.id);
      setTimeout(() => setCopied((c) => (c === ev.id ? null : c)), 1800);
    } catch { /* ignore */ }
  }, [promoLink]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold text-white">
          <Ticket className="h-4 w-4" style={{ color: colors.accent }} /> Paid live events
        </h4>
        <button
          onClick={() => setCreating((c) => !c)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-black"
          style={{ background: colors.accent }}
        >
          {creating ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {creating ? 'Close' : 'New event'}
        </button>
      </div>
      <p className="mb-3 text-[11px] text-white/45">Sell live courses, podcasts &amp; classes. You keep 70% of every ticket.</p>

      <AnimatePresence>
        {creating && (
          <CreateEventForm
            artistId={artistId} artistName={artistName} colors={colors} types={types}
            onCreated={() => { setCreating(false); refresh(); }}
          />
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
      ) : events.length === 0 ? (
        !creating && <p className="py-6 text-center text-xs text-white/40">No events yet — create your first paid live class or show.</p>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const st = STATUS_STYLE[ev.status] || STATUS_STYLE.draft;
            return (
              <div key={ev.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xl" style={{ background: `${colors.primary}22` }}>
                    {ev.coverImage ? <img src={ev.coverImage} alt="" className="h-full w-full object-cover" /> : typeEmoji(types, ev.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-white">{ev.title}</p>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-white/50">
                      <span className="font-semibold" style={{ color: colors.accent }}>{money(ev.priceUsd)}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{ev.soldCount || 0}{ev.maxSeats ? `/${ev.maxSeats}` : ''} sold</span>
                      <span className="flex items-center gap-1"><Coins className="h-3 w-3" />${(ev.creatorEarnedUsd || 0).toFixed(2)} earned</span>
                      {dateLabel(ev.scheduledAt) && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dateLabel(ev.scheduledAt)}</span>}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {ev.status === 'draft' && (
                    <ActBtn onClick={() => patch.mutate({ id: ev.id, body: { status: 'published' } })} colors={colors} primary>Publish</ActBtn>
                  )}
                  {ev.status === 'published' && (
                    <>
                      <ActBtn onClick={() => goLive.mutate(ev.id)} colors={colors} primary><Radio className="h-3 w-3" /> Go live</ActBtn>
                      <ActBtn onClick={() => patch.mutate({ id: ev.id, body: { status: 'draft' } })} colors={colors}>Unpublish</ActBtn>
                    </>
                  )}
                  {ev.status === 'live' && (
                    <ActBtn onClick={() => endEvent.mutate(ev.id)} colors={colors}><Square className="h-3 w-3" /> End</ActBtn>
                  )}
                  <ActBtn onClick={() => copyPromo(ev)} colors={colors}>
                    {copied === ev.id ? <><Check className="h-3 w-3 text-emerald-400" /> Copied</> : <><Share2 className="h-3 w-3" /> Promo link</>}
                  </ActBtn>
                  <ActBtn onClick={() => setRoomId(ev.id)} colors={colors}><MessageCircle className="h-3 w-3" /> Room</ActBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {roomId && <EventRoomModal eventId={roomId} colors={colors} onClose={() => setRoomId(null)} />}
    </div>
  );
}

function ActBtn({ children, onClick, colors, primary }: { children: any; onClick: () => void; colors: LC; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${primary ? 'text-black' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
      style={primary ? { background: colors.accent } : undefined}
    >
      {children}
    </button>
  );
}

function CreateEventForm({ artistId, artistName, colors, types, onCreated }: {
  artistId: string; artistName: string; colors: LC; types: EventType[]; onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('live_course');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('19.99');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState('60');
  const [maxSeats, setMaxSeats] = useState('');
  const [coverImage, setCoverImage] = useState('');

  const create = useMutation({
    mutationFn: () => apiRequest('POST', '/api/live-stage/events', {
      artistId, artistName, title: title.trim(), type, description: description.trim() || undefined,
      priceUsd: Number(price) || 0, scheduledAt: scheduledAt || undefined,
      durationMinutes: duration ? Number(duration) : undefined,
      maxSeats: maxSeats ? Number(maxSeats) : undefined,
      coverImage: coverImage.trim() || undefined,
    }),
    onSuccess: onCreated,
  });

  const inputCls = 'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none';

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="mb-3 overflow-hidden"
    >
      <div className="space-y-2.5 rounded-xl border border-white/10 bg-black/30 p-3">
        <input className={inputCls} placeholder="Event title (e.g. Songwriting Masterclass)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
        <div className="grid grid-cols-2 gap-2">
          {types.map((t) => (
            <button
              key={t.id} onClick={() => setType(t.id)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${type === t.id ? 'border-transparent text-white' : 'border-white/10 text-white/60 hover:text-white'}`}
              style={type === t.id ? { background: `${colors.accent}22`, borderColor: colors.accent } : undefined}
            >
              <span className="text-base">{t.emoji}</span>
              <span className="min-w-0"><span className="block truncate font-semibold">{t.name}</span></span>
            </button>
          ))}
        </div>
        <textarea className={`${inputCls} min-h-[64px] resize-none`} placeholder="What will attendees get? (description)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/40">Price (USD)</span>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input className={`${inputCls} pl-8`} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/40">Duration (min)</span>
            <input className={inputCls} type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/40">Date &amp; time</span>
            <input className={inputCls} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/40">Max seats (optional)</span>
            <input className={inputCls} type="number" min="0" placeholder="Unlimited" value={maxSeats} onChange={(e) => setMaxSeats(e.target.value)} />
          </label>
        </div>
        <input className={inputCls} placeholder="Cover image URL (optional)" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} />
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-white/45">You keep <span className="font-bold" style={{ color: colors.accent }}>70%</span> · {money(Number(price))} ticket</span>
          <button
            onClick={() => title.trim() && create.mutate()}
            disabled={!title.trim() || create.isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
            style={{ background: colors.accent }}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create event
          </button>
        </div>
        {create.isError && <p className="text-xs text-red-300">Could not create the event. Please try again.</p>}
      </div>
    </motion.div>
  );
}

/* ====================================================================== */
/*  FAN — discover & buy tickets                                           */
/* ====================================================================== */
export function LiveEventsShowcase({ artistId, colors }: { artistId: string; colors: LC }) {
  const types = useEventTypes();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data } = useQuery<{ events: LiveEvent[] }>({
    queryKey: ['live-stage-events-public', artistId],
    queryFn: () => apiRequest('GET', `/api/live-stage/artist/${artistId}/events`),
    staleTime: 2 * 60_000,
    enabled: !!artistId,
  });
  const events = data?.events || [];

  const buy = useCallback(async (ev: LiveEvent) => {
    setBusyId(ev.id);
    try {
      const res: any = await apiRequest('POST', `/api/live-stage/events/${ev.id}/checkout`, {
        returnTo: window.location.pathname + window.location.search,
      });
      if (res?.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      if (res?.success) { setRoomId(ev.id); } // free / dev / already purchased → open the room
    } catch (e: any) {
      // 401 (not logged in) etc. — open the room view which shows the access CTA
      setRoomId(ev.id);
    } finally {
      setBusyId(null);
    }
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Ticket className="h-4 w-4" style={{ color: colors.accent }} />
        <h3 className="text-sm font-bold text-white">Live events &amp; classes</h3>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">{events.length}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((ev) => (
          <div key={ev.id} className="relative w-60 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <button onClick={() => setRoomId(ev.id)} className="relative block aspect-[16/10] w-full overflow-hidden">
              {ev.coverImage ? (
                <img src={ev.coverImage} alt={ev.title} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl" style={{ background: `linear-gradient(135deg, ${colors.primary}55, ${colors.secondary}55)` }}>
                  {typeEmoji(types, ev.type)}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
              {ev.status === 'live' && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                <p className="line-clamp-2 text-sm font-bold leading-tight text-white">{ev.title}</p>
                {dateLabel(ev.scheduledAt) && (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/70"><Clock className="h-3 w-3" />{dateLabel(ev.scheduledAt)}</p>
                )}
              </div>
            </button>
            <div className="flex items-center justify-between gap-2 p-3">
              <span className="text-base font-black" style={{ color: colors.accent }}>{money(ev.priceUsd)}</span>
              <button
                onClick={() => buy(ev)}
                disabled={busyId === ev.id}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-black disabled:opacity-60"
                style={{ background: `linear-gradient(90deg, ${colors.accent}, ${colors.secondary})` }}
              >
                {busyId === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5" />}
                {ev.priceUsd > 0 ? 'Get ticket' : 'Join free'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {roomId && <EventRoomModal eventId={roomId} colors={colors} onClose={() => setRoomId(null)} />}
    </div>
  );
}

/* ====================================================================== */
/*  EVENT ROOM — ticket-gated detail + live messaging                      */
/* ====================================================================== */
export function EventRoomModal({ eventId, colors, onClose }: { eventId: string; colors: LC; onClose: () => void }) {
  const types = useEventTypes();
  const qc = useQueryClient();
  const [buying, setBuying] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ event: LiveEvent; myTicket: any; isOwner: boolean; hasAccess: boolean }>({
    queryKey: ['live-stage-event', eventId],
    queryFn: () => apiRequest('GET', `/api/live-stage/events/${eventId}`),
  });
  const ev = data?.event;
  const hasAccess = !!data?.hasAccess;
  const isOwner = !!data?.isOwner;

  const buy = async () => {
    if (!ev) return;
    setBuying(true);
    try {
      const res: any = await apiRequest('POST', `/api/live-stage/events/${ev.id}/checkout`, {
        returnTo: window.location.pathname + window.location.search,
      });
      if (res?.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      await refetch();
    } catch { /* not logged in / error */ } finally { setBuying(false); }
  };

  const body = (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2147483100] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0c0c14] sm:h-[80vh] sm:rounded-3xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* header */}
        <div className="relative shrink-0">
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            {ev?.coverImage ? (
              <img src={ev.coverImage} alt={ev.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-6xl" style={{ background: `linear-gradient(135deg, ${colors.primary}66, ${colors.secondary}66)` }}>
                {ev ? typeEmoji(types, ev.type) : '🎬'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c14] via-transparent to-black/30" />
            <button onClick={onClose} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70">
              <X className="h-4 w-4" />
            </button>
            {ev?.status === 'live' && (
              <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE NOW
              </span>
            )}
          </div>
          <div className="px-4 pb-3 pt-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-black leading-tight text-white">{ev?.title || '…'}</h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-white/55">
                  {ev && <span>{typeEmoji(types, ev.type)} {types.find((t) => t.id === ev.type)?.name || 'Live event'}</span>}
                  {dateLabel(ev?.scheduledAt) && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dateLabel(ev?.scheduledAt)}</span>}
                  {ev?.durationMinutes ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ev.durationMinutes} min</span> : null}
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{ev?.soldCount || 0} attending</span>
                </p>
              </div>
              <span className="shrink-0 text-lg font-black" style={{ color: colors.accent }}>{money(ev?.priceUsd)}</span>
            </div>
          </div>
        </div>

        {/* body */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
        ) : hasAccess ? (
          <EventMessaging eventId={eventId} isOwner={isOwner} colors={colors} event={ev!} onChanged={() => { refetch(); qc.invalidateQueries({ queryKey: ['live-stage-events-mine'] }); }} />
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            {ev?.description && <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{ev.description}</p>}
            <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <Lock className="mx-auto mb-2 h-6 w-6" style={{ color: colors.accent }} />
              <p className="text-sm font-semibold text-white">Get your ticket to join</p>
              <p className="mb-3 mt-1 text-xs text-white/55">Unlock the live session and the private Q&amp;A room.</p>
              <button
                onClick={buy}
                disabled={buying}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black disabled:opacity-60"
                style={{ background: `linear-gradient(90deg, ${colors.accent}, ${colors.secondary})` }}
              >
                {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                {(ev?.priceUsd || 0) > 0 ? `Get ticket · ${money(ev?.priceUsd)}` : 'Join for free'} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  return createPortal(<AnimatePresence>{body}</AnimatePresence>, document.body);
}

function EventMessaging({ eventId, isOwner, colors, event, onChanged }: {
  eventId: string; isOwner: boolean; colors: LC; event: LiveEvent; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const { data } = useQuery<{ messages: any[] }>({
    queryKey: ['live-stage-event-messages', eventId],
    queryFn: () => apiRequest('GET', `/api/live-stage/events/${eventId}/messages`),
    refetchInterval: 4000,
  });
  const messages = data?.messages || [];

  const send = useMutation({
    mutationFn: (t: string) => apiRequest('POST', `/api/live-stage/events/${eventId}/messages`, { text: t }),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['live-stage-event-messages', eventId] }); },
  });
  const goLive = useMutation({
    mutationFn: () => apiRequest('POST', `/api/live-stage/events/${eventId}/start`, {}),
    onSuccess: onChanged,
  });
  const endEvent = useMutation({
    mutationFn: () => apiRequest('POST', `/api/live-stage/events/${eventId}/end`, {}),
    onSuccess: onChanged,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isOwner && (
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          {event.status !== 'live' ? (
            <button onClick={() => goLive.mutate()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-black" style={{ background: colors.accent }}>
              <Radio className="h-3.5 w-3.5" /> Go live
            </button>
          ) : (
            <button onClick={() => endEvent.mutate()} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
              <Square className="h-3.5 w-3.5" /> End event
            </button>
          )}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-white/50"><Users className="h-3 w-3" />{event.soldCount || 0} attendees</span>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
        <div className="mb-1 flex items-center justify-center">
          <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] text-white/40">Private room · attendees only</span>
        </div>
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col">
            <div className="flex items-center gap-1.5">
              {m.isOwner && <Sparkles className="h-3 w-3" style={{ color: colors.accent }} />}
              <span className="text-[11px] font-bold" style={{ color: m.isOwner ? colors.accent : colors.primary }}>{m.name}</span>
            </div>
            <p className="text-sm text-white/85">{m.text}</p>
          </div>
        ))}
        {messages.length === 0 && <p className="py-8 text-center text-xs text-white/40">Say hello and ask your questions 👋</p>}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(text.trim()); }}
        className="flex items-center gap-2 border-t border-white/10 p-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <input
          value={text} onChange={(e) => setText(e.target.value)} maxLength={500}
          placeholder="Message the room…"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
        />
        <button type="submit" disabled={!text.trim() || send.isPending} className="flex h-9 w-9 items-center justify-center rounded-full text-black disabled:opacity-50" style={{ background: colors.accent }}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
