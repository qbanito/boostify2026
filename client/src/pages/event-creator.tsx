/**
 * event-creator.tsx
 * ------------------
 * Full CMS for managing Cinematic Event Landing pages.
 * Route: /event-creator  (wrapped in Boostify PageWrapper)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';
import {
  Sparkles, Plus, ExternalLink, Copy, Check, Calendar, Globe,
  Lock, List, Film, Crown, Star, Zap, ChevronRight, Eye,
  Settings2, X, Clapperboard, Users, MapPin, Palette,
  ToggleLeft, ToggleRight, ArrowUp, ArrowDown, Save,
  BookOpen, Clock, Shirt, Navigation, Gift, Mic2,
  ChevronDown, ChevronUp, User, Phone, Mail, StickyNote,
  Image, Music, Video, AlertCircle, Trash2, Upload, Wand2, Loader2,
  MessageSquare, GripVertical, CheckCircle2, Circle, Layers,
  QrCode, Share2, Download,
} from 'lucide-react';
import {
  createEvent, updateEvent, deleteEvent, fetchMyEvents,
  uploadEventMedia, improveEventText, generateEventDraft,
  fetchEventAdmin,
  type MyEventSummary, type EventRsvp, type EventAdminStats,
} from '../lib/event-api';
import { useToast } from '../hooks/use-toast';
import { storage } from '../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// --- Constants ----------------------------------------------------------------

const EVENT_TYPES = [
  { value: 'quinceanera', label: '🎀 Quinceañera' },
  { value: 'wedding',     label: '💍 Wedding' },
  { value: 'premiere',    label: '🎬 Premiere' },
  { value: 'corporate',   label: '🏢 Corporate' },
  { value: 'other',       label: '✨ Other' },
];

const TIERS = [
  { value: 'silver',   label: 'Silver',   icon: <Star className="w-4 h-4" />,  color: 'from-slate-400 to-slate-500',   desc: 'RSVP + Soundtrack' },
  { value: 'gold',     label: 'Gold',     icon: <Crown className="w-4 h-4" />, color: 'from-amber-400 to-yellow-500',  desc: 'Photo Booth + Gallery + Memory Book' },
  { value: 'premiere', label: 'Premiere', icon: <Zap className="w-4 h-4" />,   color: 'from-purple-400 to-fuchsia-500', desc: 'After Movie + AI Scenes + everything' },
];

const THEMES = [
  { value: 'dark_luxury', label: 'Dark Luxury', preview: 'bg-gradient-to-br from-[#1a0533] to-[#0a0215]' },
  { value: 'rose_gold',   label: 'Rose Gold',   preview: 'bg-gradient-to-br from-[#3d0a1a] to-[#1a0510]' },
  { value: 'midnight',    label: 'Midnight',    preview: 'bg-gradient-to-br from-[#05051a] to-[#0a0a2e]' },
  { value: 'champagne',   label: 'Champagne',   preview: 'bg-gradient-to-br from-[#1a1408] to-[#0a0804]' },
  { value: 'emerald',     label: 'Emerald',     preview: 'bg-gradient-to-br from-[#041a0a] to-[#020d05]' },
];

const ALL_MODULES: { id: string; label: string; icon: React.ReactNode; featureKey: string; desc: string }[] = [
  { id: 'hero',          label: 'Hero / Cover',         icon: <Film className="w-4 h-4" />,         featureKey: '',               desc: 'Cover with countdown and trailer' },
  { id: 'rsvp',          label: 'RSVP Confirmation',    icon: <Users className="w-4 h-4" />,        featureKey: 'feature_rsvp',   desc: 'Attendance form + QR' },
  { id: 'story',         label: 'Story',                icon: <BookOpen className="w-4 h-4" />,     featureKey: 'feature_story',  desc: 'Biography of the honoree' },
  { id: 'schedule',      label: 'Day Schedule',         icon: <Clock className="w-4 h-4" />,        featureKey: 'feature_schedule', desc: 'Timeline with times' },
  { id: 'photo_booth',   label: 'Photo Booth',          icon: <Image className="w-4 h-4" />,        featureKey: 'feature_photo_booth', desc: 'Camera + event frames' },
  { id: 'soundtrack',    label: 'Soundtrack',           icon: <Music className="w-4 h-4" />,        featureKey: 'feature_soundtrack', desc: 'Dedicate a song' },
  { id: 'dress_code',    label: 'Dress Code',           icon: <Shirt className="w-4 h-4" />,        featureKey: 'feature_dress_code', desc: 'Visual dress code' },
  { id: 'venue',         label: 'Venue / Map',          icon: <Navigation className="w-4 h-4" />,   featureKey: 'feature_venue',  desc: 'Address + directions' },
  { id: 'gallery',       label: 'Gallery',              icon: <Image className="w-4 h-4" />,        featureKey: 'feature_gallery', desc: 'Collaborative gallery' },
  { id: 'memory_book',   label: 'Memory Book',          icon: <BookOpen className="w-4 h-4" />,     featureKey: 'feature_memory_book', desc: 'Messages and signatures' },
  { id: 'vendors',       label: 'Vendors',              icon: <Mic2 className="w-4 h-4" />,         featureKey: 'feature_vendors', desc: 'DJ, florist, catering…' },
  { id: 'gift_registry', label: 'Gift Registry',        icon: <Gift className="w-4 h-4" />,         featureKey: 'feature_gift_registry', desc: 'Gift wishlist' },
  { id: 'messages',      label: 'Elegant Messages',     icon: <MessageSquare className="w-4 h-4" />, featureKey: 'feature_messages', desc: 'Styled text blocks & quotes' },
  { id: 'decorations',   label: 'Decorative Animations', icon: <Sparkles className="w-4 h-4" />,    featureKey: 'feature_decorations', desc: 'Animated ornaments over the page' },
  { id: 'ai_scenes',     label: 'AI Scenes',            icon: <Sparkles className="w-4 h-4" />,     featureKey: 'feature_ai_scenes', desc: 'AI-generated scenes' },
  { id: 'after_movie',   label: 'After Movie',          icon: <Video className="w-4 h-4" />,        featureKey: 'feature_after_movie', desc: 'Final post-event video' },
];

const DEFAULT_MODULE_ORDER = ALL_MODULES.map(m => m.id);

const TIER_RANK: Record<string, number> = { silver: 1, gold: 2, premiere: 3 };

// Lowest tier that unlocks each module + UI grouping category.
const MODULE_META: Record<string, { tier: 'silver' | 'gold' | 'premiere'; category: 'core' | 'interactive' | 'premium' }> = {
  hero:          { tier: 'silver',   category: 'core' },
  rsvp:          { tier: 'silver',   category: 'interactive' },
  soundtrack:    { tier: 'silver',   category: 'interactive' },
  story:         { tier: 'silver',   category: 'core' },
  venue:         { tier: 'silver',   category: 'core' },
  dress_code:    { tier: 'silver',   category: 'core' },
  schedule:      { tier: 'gold',     category: 'core' },
  photo_booth:   { tier: 'gold',     category: 'interactive' },
  gallery:       { tier: 'gold',     category: 'interactive' },
  memory_book:   { tier: 'gold',     category: 'interactive' },
  messages:      { tier: 'gold',     category: 'core' },
  decorations:   { tier: 'gold',     category: 'core' },
  vendors:       { tier: 'gold',     category: 'core' },
  gift_registry: { tier: 'gold',     category: 'core' },
  ai_scenes:     { tier: 'premiere', category: 'premium' },
  after_movie:   { tier: 'premiere', category: 'premium' },
};

const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  core:        { label: 'Core',        cls: 'bg-sky-500/15 text-sky-300 border-sky-400/20' },
  interactive: { label: 'Interactive', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20' },
  premium:     { label: 'Premium',     cls: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/20' },
};

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-zinc-700/60 text-zinc-300' },
  published: { label: 'Published', cls: 'bg-emerald-900/60 text-emerald-400 border border-emerald-500/40' },
  ended:     { label: 'Ended',     cls: 'bg-zinc-800 text-zinc-500' },
};

// --- Small helpers -------------------------------------------------------------

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function CopyBtn({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
      {ok ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {ok ? 'Copied' : 'Copy link'}
    </button>
  );
}

// --- Share panel: link + QR code + native share ------------------------------
// A premium, animated sharing card the host can use to spread the event link.
function ShareCard({ url, title }: { url: string; title: string }) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrWrapRef = useRef<HTMLDivElement>(null);

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, text: `You're invited: ${title}`, url }); }
      catch { /* user cancelled */ }
    } else {
      copy();
    }
  };

  // Convert the inline SVG QR into a downloadable PNG.
  const downloadQr = () => {
    const svg = qrWrapRef.current?.querySelector('svg');
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const img = new window.Image();
    const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const size = 720;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 40, 40, size - 80, size - 80);
        const a = document.createElement('a');
        a.download = `${title.replace(/[^\w-]+/g, '-').toLowerCase() || 'event'}-qr.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
      URL.revokeObjectURL(blobUrl);
    };
    img.src = blobUrl;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-white/[0.02] to-fuchsia-500/[0.05] p-4">
      {/* animated sheen */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-y-10 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ left: ['-33%', '130%'] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
      />
      <div className="relative">
        <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5" /> Share this event
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-white/60 font-mono truncate bg-black/20 rounded-lg px-3 py-2">{url}</code>
          <button onClick={copy}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button onClick={() => setShowQr(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition-colors">
            <QrCode className="w-3.5 h-3.5" /> {showQr ? 'Hide QR' : 'Show QR code'}
          </button>
          <button onClick={nativeShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-colors">
            <Share2 className="w-3.5 h-3.5" /> Share…
          </button>
        </div>

        {showQr && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex flex-col items-center gap-3">
              <motion.div
                ref={qrWrapRef}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                className="bg-white p-3 rounded-xl shadow-[0_10px_40px_-10px_rgba(201,168,76,0.5)]"
              >
                <QRCode value={url} size={160} bgColor="#ffffff" fgColor="#0c0c14" />
              </motion.div>
              <button onClick={downloadQr}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition-colors">
                <Download className="w-3.5 h-3.5" /> Download QR (PNG)
              </button>
              <p className="text-[11px] text-white/30 text-center">Guests scan this code to open the event page.</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// --- Tab types ----------------------------------------------------------------

type Tab = 'general' | 'modules' | 'content' | 'media' | 'guests' | 'client';

// --- Event Editor (all tabs) --------------------------------------------------

function EventEditor({
  event,
  getToken,
  onClose,
  onSaved,
  isNew,
}: {
  event: Partial<MyEventSummary> & { slug?: string };
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (ev: MyEventSummary) => void;
  isNew: boolean;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [slugManual, setSlugManual] = useState(!isNew);

  // -- form state --
  const [general, setGeneral] = useState({
    eventTitle:    event.event_title    ?? '',
    eventSubtitle: event.event_subtitle ?? '',
    eventType:     event.event_type     ?? 'quinceanera',
    eventDate:     event.event_date     ? new Date(event.event_date).toISOString().slice(0, 16) : '',
    eventLocation: event.event_location ?? '',
    honoreeName:   event.honoree_name   ?? '',
    tier:          event.tier           ?? 'gold',
    accessMode:    event.access_mode    ?? 'open',
    accessCode:    '',
    primaryColor:  event.primary_color  ?? '#1a0533',
    accentColor:   event.accent_color   ?? '#c9a84c',
    themePreset:   event.theme_preset   ?? 'dark_luxury',
    slug:          event.slug           ?? '',
  });

  // -- modules state --
  // Merge any saved order with the full module list so that modules added after
  // this event was created (e.g. messages, decorations) always remain editable.
  const [moduleOrder, setModuleOrder] = useState<string[]>(() => {
    const saved = Array.isArray(event.modules_config) ? event.modules_config : [];
    const known = saved.filter(id => DEFAULT_MODULE_ORDER.includes(id));
    const missing = DEFAULT_MODULE_ORDER.filter(id => !known.includes(id));
    const merged = [...known, ...missing];
    return merged.length ? merged : DEFAULT_MODULE_ORDER;
  });
  const [features, setFeatures] = useState<Record<string, boolean>>({
    feature_rsvp:          event.feature_rsvp          ?? true,
    feature_photo_booth:   event.feature_photo_booth   ?? true,
    feature_soundtrack:    event.feature_soundtrack    ?? true,
    feature_ai_scenes:     event.feature_ai_scenes     ?? false,
    feature_gallery:       event.feature_gallery       ?? true,
    feature_memory_book:   event.feature_memory_book   ?? true,
    feature_after_movie:   event.feature_after_movie   ?? false,
    feature_story:         event.feature_story         ?? false,
    feature_schedule:      event.feature_schedule      ?? false,
    feature_dress_code:    event.feature_dress_code    ?? false,
    feature_venue:         event.feature_venue         ?? false,
    feature_vendors:       event.feature_vendors       ?? false,
    feature_gift_registry: event.feature_gift_registry ?? false,
    feature_messages:      event.feature_messages      ?? false,
    feature_decorations:   event.feature_decorations   ?? false,
  });

  // -- content state --
  const [story, setStory] = useState<{ title: string; body: string; quote: string }>(() => {
    const s = event.story_json as any;
    return { title: s?.title ?? '', body: s?.body ?? '', quote: s?.quote ?? '' };
  });
  const [scheduleItems, setScheduleItems] = useState<Array<{ time: string; title: string; desc: string }>>(() =>
    (event.schedule_json as any[]) ?? []
  );
  const [dressCode, setDressCode] = useState<{ palette: string[]; note: string; forbid: string }>(() => {
    const d = event.dress_code_json as any;
    return { palette: d?.palette ?? ['#c9a84c', '#1a0533', '#ffffff'], note: d?.note ?? '', forbid: d?.forbid ?? '' };
  });
  const [venue, setVenue] = useState<{ address: string; mapUrl: string; parking: string; howToGet: string }>(() => {
    const v = event.venue_json as any;
    return { address: v?.address ?? general.eventLocation, mapUrl: v?.mapUrl ?? '', parking: v?.parking ?? '', howToGet: v?.howToGet ?? '' };
  });
  const [vendors, setVendors] = useState<Array<{ role: string; name: string; instagram: string }>>(() =>
    (event.vendors_json as any[]) ?? []
  );
  const [giftItems, setGiftItems] = useState<Array<{ item: string; store: string; url: string }>>(() =>
    (event.gift_registry_json as any[]) ?? []
  );
  const [afterMovieUrl, setAfterMovieUrl] = useState<string>(event.after_movie_url ?? '');

  const [messages, setMessages] = useState<Array<{ title: string; body: string; style: string; align: string }>>(() =>
    ((event.messages_json as any[]) ?? []).map(m => ({
      title: m?.title ?? '', body: m?.body ?? '', style: m?.style ?? 'serif', align: m?.align ?? 'center',
    }))
  );
  const [decorations, setDecorations] = useState<{ style: string; density: string }>(() => {
    const d = event.decorations_json as any;
    return { style: d?.style ?? 'sparkles', density: d?.density ?? 'medium' };
  });

  // -- interactive modules config (soundtrack / photo booth / gallery / memory book) --
  const [interactive, setInteractive] = useState<{
    soundtrack: { intro: string; playlist: Array<{ title: string; artist: string }> };
    photo_booth: { intro: string; hashtag: string; frames: Array<{ label: string; color: string }> };
    gallery: { intro: string };
    memory_book: { intro: string; prompt: string };
  }>(() => {
    const c = (event.interactive_config as any) ?? {};
    return {
      soundtrack: {
        intro: c?.soundtrack?.intro ?? '',
        playlist: Array.isArray(c?.soundtrack?.playlist) ? c.soundtrack.playlist : [],
      },
      photo_booth: {
        intro: c?.photo_booth?.intro ?? '',
        hashtag: c?.photo_booth?.hashtag ?? '',
        frames: Array.isArray(c?.photo_booth?.frames) ? c.photo_booth.frames : [],
      },
      gallery: { intro: c?.gallery?.intro ?? '' },
      memory_book: { intro: c?.memory_book?.intro ?? '', prompt: c?.memory_book?.prompt ?? '' },
    };
  });

  // -- media state --
  const [media, setMedia] = useState({
    heroImageUrl:       event.hero_image_url       ?? '',
    heroVideoUrl:       event.hero_video_url       ?? '',
    heroMediaType:      event.hero_media_type       ?? 'image',
    trailerUrl:         event.trailer_url          ?? '',
    posterUrl:          event.poster_url           ?? '',
    backgroundMusicUrl: event.background_music_url ?? '',
  });

  // -- cinematic styled posters/images with text overlays --
  const [cinematicPosters, setCinematicPosters] = useState<Array<{
    imageUrl: string; title?: string; subtitle?: string;
    align?: 'left' | 'center' | 'right'; height?: 'sm' | 'md' | 'lg';
  }>>(
    Array.isArray(event.cinematic_posters_json) ? event.cinematic_posters_json : []
  );

  // -- film book (cinematic photo album the parents can order later) --
  const [filmBook, setFilmBook] = useState<{
    images: string[]; title: string; subtitle: string;
    available: boolean; price: string; currency: string;
    orderUrl: string; comingSoonText: string;
  }>(() => {
    const fb = (event.film_book_json && typeof event.film_book_json === 'object') ? event.film_book_json as any : {};
    return {
      images: Array.isArray(fb.images) ? fb.images : [],
      title: fb.title ?? '',
      subtitle: fb.subtitle ?? '',
      available: fb.available ?? false,
      price: fb.price ?? '',
      currency: fb.currency ?? 'USD',
      orderUrl: fb.orderUrl ?? '',
      comingSoonText: fb.comingSoonText ?? '',
    };
  });

  // -- client state --
  const [clientInfo, setClientInfo] = useState({
    clientName:  event.client_name  ?? '',
    clientEmail: event.client_email ?? '',
    clientPhone: event.client_phone ?? '',
    clientNotes: event.client_notes ?? '',
  });

  // -- registered guests (RSVPs) — loaded on demand when the Guests tab opens --
  const [guests, setGuests] = useState<EventRsvp[]>([]);
  const [guestStats, setGuestStats] = useState<EventAdminStats | null>(null);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestsError, setGuestsError] = useState('');
  const [guestsLoaded, setGuestsLoaded] = useState(false);

  const loadGuests = useCallback(async () => {
    if (isNew || !event.slug) return;
    setGuestsLoading(true);
    setGuestsError('');
    try {
      const token = (await getToken()) ?? '';
      const data = await fetchEventAdmin(event.slug, token);
      setGuests(data.rsvps ?? []);
      setGuestStats(data.stats ?? null);
      setGuestsLoaded(true);
    } catch (err: any) {
      setGuestsError(err?.message ?? 'Failed to load guests');
    } finally {
      setGuestsLoading(false);
    }
  }, [isNew, event.slug, getToken]);

  // Auto-load the guest list the first time the Guests tab is opened.
  useEffect(() => {
    if (tab === 'guests' && !guestsLoaded && !guestsLoading) {
      loadGuests();
    }
  }, [tab, guestsLoaded, guestsLoading, loadGuests]);

  // -- linked artist profile (optional, read-only integration) --
  const [linkedArtistSlug, setLinkedArtistSlug] = useState<string>(
    event.linked_artist_slug ?? ''
  );

  // -- AI full-event generator --
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // -- unsaved-changes tracking --
  const [dirty, setDirty] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setDirty(true);
  }, [general, features, moduleOrder, story, scheduleItems, dressCode, venue,
      vendors, giftItems, afterMovieUrl, messages, decorations, interactive, media, clientInfo, linkedArtistSlug, cinematicPosters, filmBook]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleClose = () => {
    if (dirty && !window.confirm('You have unsaved changes. Discard them and close?')) return;
    onClose();
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) { toast({ title: 'Describe your event first', variant: 'destructive' }); return; }
    setAiGenerating(true);
    try {
      const token = (await getToken()) ?? '';
      const draft = await generateEventDraft(aiPrompt.trim(), token, general.eventType);
      setGeneral(p => ({
        ...p,
        eventTitle:    draft.eventTitle || p.eventTitle,
        eventSubtitle: draft.eventSubtitle || p.eventSubtitle,
        honoreeName:   draft.honoreeName || p.honoreeName,
        eventType:     draft.eventType || p.eventType,
        themePreset:   draft.themePreset || p.themePreset,
        primaryColor:  draft.primaryColor || p.primaryColor,
        accentColor:   draft.accentColor || p.accentColor,
        slug:          (isNew && !slugManual && draft.eventTitle) ? slugify(draft.eventTitle) : p.slug,
      }));
      if (draft.story && (draft.story.title || draft.story.body)) {
        setStory({ title: draft.story.title, body: draft.story.body, quote: draft.story.quote });
        setFeatures(p => ({ ...p, feature_story: true }));
      }
      if (Array.isArray(draft.schedule) && draft.schedule.length) {
        setScheduleItems(draft.schedule);
        setFeatures(p => ({ ...p, feature_schedule: true }));
      }
      if (draft.dressCode && (draft.dressCode.note || draft.dressCode.palette?.length)) {
        setDressCode(p => ({
          ...p,
          note: draft.dressCode.note || p.note,
          palette: draft.dressCode.palette?.length ? draft.dressCode.palette : p.palette,
        }));
        setFeatures(p => ({ ...p, feature_dress_code: true }));
      }
      toast({ title: 'Event generated with AI ✨', description: 'Review and adjust each tab.' });
    } catch (err: any) {
      toast({ title: err?.message ?? 'AI generation failed', variant: 'destructive' });
    } finally {
      setAiGenerating(false);
    }
  };

  // -- completeness score (guides the user before publishing) --
  const completeness = (() => {
    const checks = [
      !!general.eventTitle.trim(),
      !!general.eventDate,
      !!general.eventLocation.trim(),
      !!general.eventSubtitle.trim(),
      !!(media.heroImageUrl || media.heroVideoUrl),
      !features.feature_story || !!story.body.trim(),
      !features.feature_schedule || scheduleItems.length > 0,
      !features.feature_venue || !!venue.address.trim(),
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  })();

  const setG = (k: keyof typeof general, v: string) => setGeneral(p => ({ ...p, [k]: v }));

  const handleTitleChange = (v: string) => {
    setG('eventTitle', v);
    if (!slugManual) setG('slug', slugify(v));
  };

  const toggleFeature = (key: string) =>
    setFeatures(p => ({ ...p, [key]: !p[key] }));

  const moveModule = (idx: number, dir: -1 | 1) => {
    const arr = [...moduleOrder];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setModuleOrder(arr);
  };

  // -- drag & drop reorder --
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const reorderModule = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setModuleOrder(prev => {
      const arr = [...prev];
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return arr;
    });
  };

  // -- tier gating --
  const currentTierRank = TIER_RANK[general.tier] ?? 2;
  const isLocked = (id: string) => (TIER_RANK[MODULE_META[id]?.tier ?? 'silver'] ?? 1) > currentTierRank;

  // -- content completeness per module --
  const moduleContentState = (id: string): 'auto' | 'ready' | 'empty' => {
    switch (id) {
      case 'story':         return (story.title.trim() || story.body.trim()) ? 'ready' : 'empty';
      case 'schedule':      return scheduleItems.length ? 'ready' : 'empty';
      case 'dress_code':    return (dressCode.note.trim() || dressCode.palette.length) ? 'ready' : 'empty';
      case 'venue':         return (venue.address.trim() || venue.mapUrl.trim()) ? 'ready' : 'empty';
      case 'vendors':       return vendors.length ? 'ready' : 'empty';
      case 'gift_registry': return giftItems.length ? 'ready' : 'empty';
      case 'messages':      return messages.length ? 'ready' : 'empty';
      case 'after_movie':   return afterMovieUrl.trim() ? 'ready' : 'empty';
      case 'soundtrack':    return (interactive.soundtrack.intro.trim() || interactive.soundtrack.playlist.length) ? 'ready' : 'empty';
      case 'photo_booth':   return (interactive.photo_booth.hashtag.trim() || interactive.photo_booth.frames.length) ? 'ready' : 'auto';
      case 'gallery':       return interactive.gallery.intro.trim() ? 'ready' : 'auto';
      case 'memory_book':   return (interactive.memory_book.intro.trim() || interactive.memory_book.prompt.trim()) ? 'ready' : 'auto';
      default:              return 'auto'; // hero, rsvp, decorations, ai_scenes — no required setup
    }
  };

  // Jump to the Content tab to edit a module (enabling it first if needed).
  const configureModule = (mod: { id: string; featureKey: string }) => {
    if (mod.featureKey && !features[mod.featureKey]) {
      setFeatures(p => ({ ...p, [mod.featureKey]: true }));
    }
    setTab('content');
  };

  // Quick action: enable every module included in the current tier.
  const enableTierModules = () => {
    setFeatures(prev => {
      const next = { ...prev };
      ALL_MODULES.forEach(m => {
        if (m.featureKey && !isLocked(m.id)) next[m.featureKey] = true;
      });
      return next;
    });
  };

  const activeCount = ALL_MODULES.filter(m => m.featureKey === '' || features[m.featureKey]).length;

  const buildPayload = () => {
    const featureObj: Record<string, boolean> = {};
    ALL_MODULES.forEach(m => {
      if (m.featureKey) featureObj[m.featureKey] = features[m.featureKey] ?? false;
    });
    return {
      eventTitle:    general.eventTitle,
      eventSubtitle: general.eventSubtitle || undefined,
      eventType:     general.eventType,
      eventDate:     general.eventDate || undefined,
      eventLocation: general.eventLocation || undefined,
      honoreeName:   general.honoreeName || undefined,
      tier:          general.tier,
      accessMode:    general.accessMode,
      ...(general.accessMode === 'code' && general.accessCode.trim()
        ? { accessCode: general.accessCode.trim() }
        : {}),
      primaryColor:  general.primaryColor,
      accentColor:   general.accentColor,
      themePreset:   general.themePreset,
      modulesConfig: moduleOrder,
      ...featureObj,
      storyJson:         features.feature_story         ? story        : undefined,
      scheduleJson:      features.feature_schedule      ? scheduleItems : undefined,
      dressCodeJson:     features.feature_dress_code    ? dressCode    : undefined,
      venueJson:         features.feature_venue         ? venue        : undefined,
      vendorsJson:       features.feature_vendors       ? vendors      : undefined,
      giftRegistryJson:  features.feature_gift_registry ? giftItems    : undefined,
      afterMovieUrl:     features.feature_after_movie   ? (afterMovieUrl || undefined) : undefined,
      messagesJson:      features.feature_messages      ? messages     : undefined,
      decorationsJson:   features.feature_decorations   ? decorations  : undefined,
      interactiveConfig: {
        ...(features.feature_soundtrack   ? { soundtrack: interactive.soundtrack }   : {}),
        ...(features.feature_photo_booth  ? { photo_booth: interactive.photo_booth } : {}),
        ...(features.feature_gallery      ? { gallery: interactive.gallery }         : {}),
        ...(features.feature_memory_book  ? { memory_book: interactive.memory_book } : {}),
      },
      heroImageUrl:       media.heroImageUrl       || undefined,
      heroVideoUrl:       media.heroVideoUrl       || undefined,
      heroMediaType:      media.heroMediaType      || 'image',
      trailerUrl:         media.trailerUrl         || undefined,
      posterUrl:          media.posterUrl          || undefined,
      backgroundMusicUrl: media.backgroundMusicUrl || undefined,
      cinematicPostersJson: cinematicPosters.filter(p => p.imageUrl?.trim()),
      filmBookJson: {
        ...filmBook,
        images: filmBook.images.filter(u => u?.trim()),
      },
      linkedArtistSlug:   linkedArtistSlug.trim() ? linkedArtistSlug.trim() : null,
      clientName:  clientInfo.clientName  || undefined,
      clientEmail: clientInfo.clientEmail || undefined,
      clientPhone: clientInfo.clientPhone || undefined,
      clientNotes: clientInfo.clientNotes || undefined,
    };
  };

  const handleSave = async () => {
    if (!general.eventTitle.trim()) { setError('Title is required'); setTab('general'); return; }
    if (isNew && !general.slug.trim()) { setError('Slug is required'); setTab('general'); return; }
    if (general.accessMode === 'code' && isNew && general.accessCode.trim().length < 4) {
      setError('Access code must be at least 4 characters'); setTab('general'); return;
    }
    if (clientInfo.clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.clientEmail.trim())) {
      setError('Client email is not valid'); setTab('client'); return;
    }
    setSaving(true); setError('');
    try {
      // Always fetch a fresh Clerk token right before the request — Clerk session
      // tokens live ~60s and the editor may stay open for minutes, so a token
      // captured at mount would be expired by save time ("JWT is expired").
      const token = (await getToken()) ?? '';
      if (isNew) {
        const result = await createEvent({
          slug: general.slug,
          accessCode: general.accessMode === 'code' ? general.accessCode : undefined,
          ...buildPayload(),
        } as any, token);
        toast({ title: 'Event created!', description: `/${general.slug}` });
        onSaved({ ...event, ...result, slug: general.slug } as any);
      } else {
        await updateEvent(event.slug!, buildPayload(), token);
        toast({ title: 'Changes saved!' });
        onSaved({ ...event, ...buildPayload(), slug: event.slug } as any);
      }
      setDirty(false);
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general',  label: 'General',  icon: <Settings2 className="w-4 h-4" /> },
    { id: 'modules',  label: 'Modules',  icon: <ToggleRight className="w-4 h-4" /> },
    { id: 'content',  label: 'Content',  icon: <BookOpen className="w-4 h-4" /> },
    { id: 'media',    label: 'Media',    icon: <Image className="w-4 h-4" /> },
    // Guests (RSVPs) only make sense after the event exists and has a public page.
    ...(!isNew ? [{ id: 'guests' as Tab, label: 'Guests', icon: <Users className="w-4 h-4" /> }] : []),
    { id: 'client',   label: 'Client',   icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full sm:max-w-2xl h-[95vh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#0c0c14] border border-white/10 shadow-2xl overflow-hidden">

        {/* sticky header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-white text-sm">
              {isNew ? 'New event' : `Edit: ${event.event_title}`}
            </span>
            {dirty && <span className="text-[10px] font-semibold text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">Unsaved</span>}
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-0 px-4 border-b border-white/10 overflow-x-auto shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* completeness bar */}
        <div className="shrink-0 px-5 py-2 border-b border-white/10 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
              style={{ width: `${completeness}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-white/50 tabular-nums shrink-0">{completeness}% ready</span>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* -- TAB: General -- */}
          {tab === 'general' && (
            <>
              {/* AI full-event generator */}
              <div className="rounded-xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/[0.07] to-purple-500/[0.04] p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90 mb-1">
                  <Wand2 className="w-4 h-4 text-fuchsia-300" /> Generate with AI
                </h3>
                <p className="text-[11px] text-white/45 mb-2.5 leading-relaxed">
                  Describe your event in one line and let AI draft the title, subtitle, story, schedule,
                  dress code and color palette. You can edit everything afterwards.
                </p>
                <Textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="e.g. Sofia's elegant gold-themed Quinceañera, June 15th, royal ballroom, 120 guests"
                  rows={2}
                />
                <button type="button" onClick={generateWithAI} disabled={aiGenerating}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiGenerating ? 'Generating…' : 'Generate event with AI'}
                </button>
              </div>

              {/* Tier selector */}
              {isNew && (
                <div>
                  <Label>Experience plan</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {TIERS.map(t => (
                      <button key={t.value} onClick={() => setG('tier', t.value)}
                        className={`rounded-xl border p-3 text-left transition-all ${general.tier === t.value ? 'border-amber-500/60 bg-amber-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}`}>
                        <div className={`inline-flex items-center gap-1 text-xs font-bold bg-gradient-to-r ${t.color} bg-clip-text text-transparent`}>
                          {t.icon} {t.label}
                        </div>
                        <p className="text-[10px] text-white/40 mt-1 leading-tight">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <Field label="Event title *">
                  <Input value={general.eventTitle} onChange={e => handleTitleChange(e.target.value)} placeholder="Sofia's Sweet 15" />
                </Field>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>Subtitle</Label>
                    <AiImprove field="event subtitle" text={general.eventSubtitle} getToken={getToken}
                      eventContext={{ title: general.eventTitle, type: general.eventType }}
                      onImproved={v => setG('eventSubtitle', v)} />
                  </div>
                  <Input value={general.eventSubtitle} onChange={e => setG('eventSubtitle', e.target.value)} placeholder="A night that becomes a movie" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Honoree name">
                    <Input value={general.honoreeName} onChange={e => setG('honoreeName', e.target.value)} placeholder="Sofia Ramirez" />
                  </Field>
                  <Field label="Event type">
                    <Select value={general.eventType} onChange={e => setG('eventType', e.target.value)}>
                      {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date and time">
                    <Input type="datetime-local" value={general.eventDate} onChange={e => setG('eventDate', e.target.value)} />
                  </Field>
                  <Field label="Venue">
                    <Input value={general.eventLocation} onChange={e => setG('eventLocation', e.target.value)} placeholder="Grand Imperial Hall, NYC" />
                  </Field>
                </div>
              </div>

              {/* Slug (only new) */}
              {isNew && (
                <Field label="Page URL *">
                  <div className="flex items-center rounded-xl bg-white/5 border border-white/10 focus-within:border-amber-500/50 overflow-hidden">
                    <span className="px-3 py-2.5 text-white/30 text-sm shrink-0">/event/</span>
                    <input value={general.slug}
                      onChange={e => { setG('slug', slugify(e.target.value)); setSlugManual(true); }}
                      className="flex-1 bg-transparent py-2.5 pr-4 text-white placeholder-white/25 focus:outline-none text-sm font-mono"
                      placeholder="event-name" />
                  </div>
                </Field>
              )}

              {/* Access mode */}
              <div>
                <Label>Page access</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { v: 'open', l: 'Open',  i: <Globe className="w-4 h-4" /> },
                    { v: 'code', l: 'Code',  i: <Lock className="w-4 h-4" /> },
                    { v: 'list', l: 'List',  i: <List className="w-4 h-4" /> },
                  ].map(m => (
                    <button key={m.v} onClick={() => setG('accessMode', m.v)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all ${general.accessMode === m.v ? 'border-amber-500/50 bg-amber-500/5 text-amber-400' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
                      {m.i} {m.l}
                    </button>
                  ))}
                </div>
                {general.accessMode === 'code' && (
                  <div className="mt-3">
                    <Field label={isNew ? 'Access code' : 'Access code (leave blank to keep current)'}>
                      <Input value={general.accessCode} onChange={e => setG('accessCode', e.target.value)} placeholder="e.g. Sofia2026" />
                    </Field>
                  </div>
                )}
              </div>

              {/* Theme */}
              <div>
                <Label>Visual theme</Label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {THEMES.map(t => (
                    <button key={t.value} onClick={() => setG('themePreset', t.value)}
                      className={`rounded-xl border overflow-hidden transition-all ${general.themePreset === t.value ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-white/10'}`}>
                      <div className={`h-10 w-full ${t.preview}`} />
                      <p className="text-[10px] text-white/50 py-1 text-center">{t.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary color">
                  <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                    <input type="color" value={general.primaryColor} onChange={e => setG('primaryColor', e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <span className="font-mono text-xs text-white/60">{general.primaryColor}</span>
                  </div>
                </Field>
                <Field label="Accent color (gold)">
                  <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                    <input type="color" value={general.accentColor} onChange={e => setG('accentColor', e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <span className="font-mono text-xs text-white/60">{general.accentColor}</span>
                  </div>
                </Field>
              </div>
            </>
          )}

          {/* -- TAB: Modules -- */}
          {tab === 'modules' && (
            <div>
              {/* Summary header + quick actions */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-fuchsia-500/20 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {activeCount} <span className="text-white/40">of {ALL_MODULES.length} modules active</span>
                      </p>
                      <p className="text-[11px] text-white/40 capitalize">
                        {general.tier} plan · drag to reorder the public page
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={enableTierModules}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-400/25 hover:bg-amber-500/25 transition-colors">
                      Enable {general.tier} set
                    </button>
                    <button
                      onClick={() => setModuleOrder(DEFAULT_MODULE_ORDER)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors">
                      Reset order
                    </button>
                  </div>
                </div>
                {/* progress bar */}
                <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-fuchsia-500 transition-all"
                    style={{ width: `${Math.round((activeCount / ALL_MODULES.length) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {moduleOrder.map((modId, idx) => {
                  const mod = ALL_MODULES.find(m => m.id === modId);
                  if (!mod) return null;
                  const isOn = mod.featureKey === '' ? true : (features[mod.featureKey] ?? false);
                  const isHero = mod.id === 'hero';
                  const locked = !isHero && isLocked(mod.id) && !isOn;
                  const meta = MODULE_META[mod.id];
                  const cat = meta ? CATEGORY_META[meta.category] : null;
                  const content = moduleContentState(mod.id);
                  const showConfig = isOn && content !== 'auto';
                  const isDragOver = dragOverIndex === idx && dragIndex !== null && dragIndex !== idx;
                  return (
                    <div
                      key={modId}
                      draggable={!locked}
                      onDragStart={() => setDragIndex(idx)}
                      onDragEnter={() => setDragOverIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (dragIndex !== null) reorderModule(dragIndex, idx); setDragIndex(null); setDragOverIndex(null); }}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                        ${isDragOver ? 'border-amber-400/60 bg-amber-400/[0.06]' : isOn ? 'border-white/15 bg-white/[0.04]' : 'border-white/5 bg-white/[0.01]'}
                        ${!isOn && !locked ? 'opacity-60' : ''} ${locked ? 'opacity-50' : ''} ${dragIndex === idx ? 'ring-1 ring-amber-400/40' : ''}`}
                    >
                      {/* drag handle */}
                      <button
                        className={`shrink-0 text-white/25 ${locked ? 'cursor-not-allowed' : 'cursor-grab hover:text-white/50'}`}
                        title={locked ? 'Unlock with a higher plan' : 'Drag to reorder'}
                        disabled={locked}>
                        <GripVertical className="w-4 h-4" />
                      </button>

                      <div className="text-white/40 shrink-0">{mod.icon}</div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-white truncate">{mod.label}</p>
                          {cat && (
                            <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cat.cls}`}>
                              {cat.label}
                            </span>
                          )}
                          {locked && (
                            <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/10 text-amber-300">
                              <Lock className="w-2.5 h-2.5" /> {meta?.tier}
                            </span>
                          )}
                          {isOn && content === 'empty' && (
                            <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-orange-400/30 bg-orange-500/10 text-orange-300">
                              <Circle className="w-2.5 h-2.5" /> Empty
                            </span>
                          )}
                          {isOn && content === 'ready' && (
                            <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/35 truncate">{mod.desc}</p>
                      </div>

                      {/* configure */}
                      {showConfig && (
                        <button
                          onClick={() => configureModule(mod)}
                          className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 transition-colors">
                          Configure
                        </button>
                      )}

                      {/* toggle */}
                      {!isHero && (
                        <button
                          onClick={() => { if (!locked) toggleFeature(mod.featureKey); }}
                          disabled={locked}
                          title={locked ? `Upgrade to ${meta?.tier} to unlock` : ''}
                          className={`shrink-0 transition-colors ${locked ? 'text-white/15 cursor-not-allowed' : isOn ? 'text-amber-400' : 'text-white/25 hover:text-white/40'}`}>
                          {isOn
                            ? <ToggleRight className="w-6 h-6" />
                            : <ToggleLeft className="w-6 h-6" />}
                        </button>
                      )}
                      {isHero && <span className="text-[11px] text-white/30 italic px-2 shrink-0">always on</span>}

                      {/* order arrows (fallback to drag) */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button onClick={() => moveModule(idx, -1)} disabled={idx === 0}
                          className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-colors">
                          <ChevronUp className="w-3.5 h-3.5 text-white/50" />
                        </button>
                        <button onClick={() => moveModule(idx, 1)} disabled={idx === moduleOrder.length - 1}
                          className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-colors">
                          <ChevronDown className="w-3.5 h-3.5 text-white/50" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Linked artist profile (optional, read-only integration) */}
              <div className="mt-6 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-1">
                  <Mic2 className="w-4 h-4 text-fuchsia-300" /> Link an artist profile
                </h3>
                <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
                  Optionally connect this event to an existing artist profile. The public page will show an
                  elegant "Discover the artist" link to that profile — without changing the artist profile itself.
                </p>
                <Field label="Artist profile URL slug (optional)">
                  <Input
                    value={linkedArtistSlug}
                    onChange={e => setLinkedArtistSlug(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
                    placeholder="e.g. red-wine"
                  />
                  <p className="text-[11px] text-white/35 mt-1">
                    This is the handle from your public page URL: boostify.app/artist/<span className="text-fuchsia-300">your-slug</span>
                  </p>
                </Field>
              </div>
            </div>
          )}

          {/* -- TAB: Content -- */}
          {tab === 'content' && (
            <div className="space-y-6">
              {/* Story */}
              {features.feature_story && (
                <ContentSection title="Honoree's story" icon={<BookOpen className="w-4 h-4" />}>
                  <Field label="Section title">
                    <Input value={story.title} onChange={e => setStory(p => ({ ...p, title: e.target.value }))} placeholder="Sofia's story" />
                  </Field>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label>Story / Biography</Label>
                      <AiImprove field="event story / biography" text={story.body} getToken={getToken}
                        eventContext={{ title: general.eventTitle, honoree: general.honoreeName, type: general.eventType }}
                        onImproved={v => setStory(p => ({ ...p, body: v }))} />
                    </div>
                    <Textarea value={story.body} onChange={e => setStory(p => ({ ...p, body: e.target.value }))} placeholder="Ever since she was little, Sofia dreamed of this moment..." rows={4} />
                  </div>
                  <Field label="Special quote (optional)">
                    <Input value={story.quote} onChange={e => setStory(p => ({ ...p, quote: e.target.value }))} placeholder='"Life is a gift…"' />
                  </Field>
                </ContentSection>
              )}

              {/* Schedule */}
              {features.feature_schedule && (
                <ContentSection title="Day schedule" icon={<Clock className="w-4 h-4" />}>
                  {scheduleItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input value={item.time} onChange={e => setScheduleItems(p => p.map((x, j) => j === i ? { ...x, time: e.target.value } : x))}
                        className="w-20 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50" placeholder="20:00" />
                      <input value={item.title} onChange={e => setScheduleItems(p => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                        className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" placeholder="Guests arrive" />
                      <button onClick={() => setScheduleItems(p => p.filter((_, j) => j !== i))} className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setScheduleItems(p => [...p, { time: '', title: '', desc: '' }])}
                    className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add time slot
                  </button>
                </ContentSection>
              )}

              {/* Dress Code */}
              {features.feature_dress_code && (
                <ContentSection title="Dress Code" icon={<Shirt className="w-4 h-4" />}>
                  <Field label="Note / instruction">
                    <Input value={dressCode.note} onChange={e => setDressCode(p => ({ ...p, note: e.target.value }))} placeholder="Formal. Long dress for ladies." />
                  </Field>
                  <Field label="Suggested colors (hex, comma separated)">
                    <Input value={dressCode.palette.join(', ')} onChange={e => setDressCode(p => ({ ...p, palette: e.target.value.split(',').map(s => s.trim()) }))} placeholder="#c9a84c, #1a0533, #ffffff" />
                  </Field>
                  <Field label="Forbidden colors / restrictions">
                    <Input value={dressCode.forbid} onChange={e => setDressCode(p => ({ ...p, forbid: e.target.value }))} placeholder="White reserved for the honoree" />
                  </Field>
                </ContentSection>
              )}

              {/* Venue */}
              {features.feature_venue && (
                <ContentSection title="Venue / Directions" icon={<Navigation className="w-4 h-4" />}>
                  <Field label="Full address">
                    <Input value={venue.address} onChange={e => setVenue(p => ({ ...p, address: e.target.value }))} placeholder="1234 Sunset Blvd, Los Angeles" />
                  </Field>
                  <Field label="Google Maps link">
                    <Input value={venue.mapUrl} onChange={e => setVenue(p => ({ ...p, mapUrl: e.target.value }))} placeholder="https://maps.google.com/..." />
                  </Field>
                  <Field label="Parking">
                    <Input value={venue.parking} onChange={e => setVenue(p => ({ ...p, parking: e.target.value }))} placeholder="Valet parking available, $10" />
                  </Field>
                  <Field label="How to get there (directions)">
                    <Textarea value={venue.howToGet} onChange={e => setVenue(p => ({ ...p, howToGet: e.target.value }))} placeholder="From the subway station, walk 5 minutes..." rows={2} />
                  </Field>
                </ContentSection>
              )}

              {/* Vendors */}
              {features.feature_vendors && (
                <ContentSection title="Vendors / Credits" icon={<Mic2 className="w-4 h-4" />}>
                  {vendors.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={v.role} onChange={e => setVendors(p => p.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}
                        className="w-28 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50" placeholder="DJ" />
                      <input value={v.name} onChange={e => setVendors(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" placeholder="DJ Valentine" />
                      <input value={v.instagram} onChange={e => setVendors(p => p.map((x, j) => j === i ? { ...x, instagram: e.target.value } : x))}
                        className="w-32 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50" placeholder="@djvalentin" />
                      <button onClick={() => setVendors(p => p.filter((_, j) => j !== i))} className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setVendors(p => [...p, { role: '', name: '', instagram: '' }])}
                    className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add vendor
                  </button>
                </ContentSection>
              )}

              {/* Gift Registry */}
              {features.feature_gift_registry && (
                <ContentSection title="Gift registry" icon={<Gift className="w-4 h-4" />}>
                  {giftItems.map((g, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={g.item} onChange={e => setGiftItems(p => p.map((x, j) => j === i ? { ...x, item: e.target.value } : x))}
                        className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" placeholder="Gift name" />
                      <input value={g.store} onChange={e => setGiftItems(p => p.map((x, j) => j === i ? { ...x, store: e.target.value } : x))}
                        className="w-28 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50" placeholder="Store" />
                      <button onClick={() => setGiftItems(p => p.filter((_, j) => j !== i))} className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setGiftItems(p => [...p, { item: '', store: '', url: '' }])}
                    className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add gift
                  </button>
                </ContentSection>
              )}

              {/* After Movie */}
              {features.feature_after_movie && (
                <ContentSection title="After Movie" icon={<Video className="w-4 h-4" />}>
                  <Field label="After movie video URL">
                    <Input value={afterMovieUrl} onChange={e => setAfterMovieUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…" />
                  </Field>
                  <p className="text-xs text-white/30">
                    Paste a YouTube or Vimeo link to the final post-event video. The module only appears on the page once a URL is set.
                  </p>
                </ContentSection>
              )}

              {/* Elegant Messages */}
              {features.feature_messages && (
                <ContentSection title="Elegant messages" icon={<MessageSquare className="w-4 h-4" />}>
                  <p className="text-xs text-white/30 -mt-1">Beautiful styled text blocks shown on the page. Pick a typographic style for each.</p>
                  {messages.map((m, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                      <div className="flex gap-2 items-center">
                        <input value={m.title} onChange={e => setMessages(p => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50" placeholder="Label (optional, e.g. Para ti)" />
                        <button onClick={() => setMessages(p => p.filter((_, j) => j !== i))} className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <Textarea value={m.body} onChange={e => setMessages(p => p.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                        placeholder="Write your elegant message…" rows={2} />
                      <div className="flex gap-2">
                        <select value={m.style} onChange={e => setMessages(p => p.map((x, j) => j === i ? { ...x, style: e.target.value } : x))}
                          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50">
                          <option value="serif">Serif elegante</option>
                          <option value="quote">Cita / Quote</option>
                          <option value="script">Caligrafía</option>
                          <option value="uppercase">Mayúsculas espaciadas</option>
                          <option value="gradient">Degradado dorado</option>
                        </select>
                        <select value={m.align} onChange={e => setMessages(p => p.map((x, j) => j === i ? { ...x, align: e.target.value } : x))}
                          className="w-32 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50">
                          <option value="center">Centrado</option>
                          <option value="left">Izquierda</option>
                          <option value="right">Derecha</option>
                        </select>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setMessages(p => [...p, { title: '', body: '', style: 'serif', align: 'center' }])}
                    className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add message
                  </button>
                </ContentSection>
              )}

              {/* Decorative Animations */}
              {features.feature_decorations && (
                <ContentSection title="Decorative animations" icon={<Sparkles className="w-4 h-4" />}>
                  <p className="text-xs text-white/30 -mt-1">Gentle animated ornaments float across the whole page.</p>
                  <Field label="Animation style">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v: 'sparkles', l: '✦ Destellos' },
                        { v: 'petals', l: '🌸 Pétalos' },
                        { v: 'confetti', l: '◆ Confeti' },
                        { v: 'hearts', l: '❤ Corazones' },
                        { v: 'snow', l: '❄ Nieve' },
                        { v: 'bubbles', l: '○ Burbujas' },
                      ].map(o => (
                        <button key={o.v} type="button" onClick={() => setDecorations(p => ({ ...p, style: o.v }))}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${decorations.style === o.v ? 'border-amber-500/50 bg-amber-500/5 text-amber-400' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Density">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v: 'low', l: 'Sutil' },
                        { v: 'medium', l: 'Media' },
                        { v: 'high', l: 'Intensa' },
                      ].map(o => (
                        <button key={o.v} type="button" onClick={() => setDecorations(p => ({ ...p, density: o.v }))}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${decorations.density === o.v ? 'border-amber-500/50 bg-amber-500/5 text-amber-400' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </Field>
                </ContentSection>
              )}

              {/* Interactive / auto modules — guidance so every enabled module is represented */}
              {features.feature_rsvp && (
                <ModuleInfoCard title="RSVP Confirmation" icon={<Users className="w-4 h-4" />}
                  text="Guests confirm attendance directly on the page and receive a QR. There is nothing to fill in here — responses appear in your guest list." />
              )}
              {features.feature_soundtrack && (
                <ContentSection title="Soundtrack" icon={<Music className="w-4 h-4" />}>
                  <Field label="Intro / instructions for guests">
                    <Input value={interactive.soundtrack.intro}
                      onChange={e => setInteractive(p => ({ ...p, soundtrack: { ...p.soundtrack, intro: e.target.value } }))}
                      placeholder="Dedica una canción especial" />
                  </Field>
                  <Label>Suggested playlist (optional)</Label>
                  {interactive.soundtrack.playlist.map((s, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input value={s.title}
                        onChange={e => setInteractive(p => ({ ...p, soundtrack: { ...p.soundtrack, playlist: p.soundtrack.playlist.map((x, j) => j === i ? { ...x, title: e.target.value } : x) } }))}
                        className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" placeholder="Song title" />
                      <input value={s.artist}
                        onChange={e => setInteractive(p => ({ ...p, soundtrack: { ...p.soundtrack, playlist: p.soundtrack.playlist.map((x, j) => j === i ? { ...x, artist: e.target.value } : x) } }))}
                        className="w-32 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" placeholder="Artist" />
                      <button onClick={() => setInteractive(p => ({ ...p, soundtrack: { ...p.soundtrack, playlist: p.soundtrack.playlist.filter((_, j) => j !== i) } }))}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setInteractive(p => ({ ...p, soundtrack: { ...p.soundtrack, playlist: [...p.soundtrack.playlist, { title: '', artist: '' }] } }))}
                    className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add song
                  </button>
                </ContentSection>
              )}
              {features.feature_photo_booth && (
                <ContentSection title="Photo Booth" icon={<Image className="w-4 h-4" />}>
                  <Field label="Intro / instructions for guests">
                    <Input value={interactive.photo_booth.intro}
                      onChange={e => setInteractive(p => ({ ...p, photo_booth: { ...p.photo_booth, intro: e.target.value } }))}
                      placeholder="Toma fotos con el marco del evento" />
                  </Field>
                  <Field label="Hashtag (optional)">
                    <Input value={interactive.photo_booth.hashtag}
                      onChange={e => setInteractive(p => ({ ...p, photo_booth: { ...p.photo_booth, hashtag: e.target.value.replace(/\s/g, '') } }))}
                      placeholder="#Sofia2026" />
                  </Field>
                  <Label>Custom frames (optional — defaults are used if empty)</Label>
                  {interactive.photo_booth.frames.map((f, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={f.label}
                        onChange={e => setInteractive(p => ({ ...p, photo_booth: { ...p.photo_booth, frames: p.photo_booth.frames.map((x, j) => j === i ? { ...x, label: e.target.value } : x) } }))}
                        className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" placeholder="Frame name" />
                      <input type="color" value={f.color || '#c9a84c'}
                        onChange={e => setInteractive(p => ({ ...p, photo_booth: { ...p.photo_booth, frames: p.photo_booth.frames.map((x, j) => j === i ? { ...x, color: e.target.value } : x) } }))}
                        className="w-9 h-9 rounded cursor-pointer bg-transparent border border-white/10" />
                      <button onClick={() => setInteractive(p => ({ ...p, photo_booth: { ...p.photo_booth, frames: p.photo_booth.frames.filter((_, j) => j !== i) } }))}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setInteractive(p => ({ ...p, photo_booth: { ...p.photo_booth, frames: [...p.photo_booth.frames, { label: '', color: '#c9a84c' }] } }))}
                    className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add frame
                  </button>
                </ContentSection>
              )}
              {features.feature_gallery && (
                <ContentSection title="Gallery" icon={<Image className="w-4 h-4" />}>
                  <Field label="Intro / instructions for guests">
                    <Input value={interactive.gallery.intro}
                      onChange={e => setInteractive(p => ({ ...p, gallery: { intro: e.target.value } }))}
                      placeholder="Comparte tus mejores momentos de la noche" />
                  </Field>
                  <p className="text-[11px] text-white/35 leading-relaxed">
                    Guests upload their own photos and videos during the event. They appear here automatically.
                  </p>
                </ContentSection>
              )}
              {features.feature_memory_book && (
                <ContentSection title="Memory Book" icon={<BookOpen className="w-4 h-4" />}>
                  <Field label="Intro / instructions for guests">
                    <Input value={interactive.memory_book.intro}
                      onChange={e => setInteractive(p => ({ ...p, memory_book: { ...p.memory_book, intro: e.target.value } }))}
                      placeholder="Deja un mensaje que perdure para siempre" />
                  </Field>
                  <Field label="Prompt question (optional)">
                    <Input value={interactive.memory_book.prompt}
                      onChange={e => setInteractive(p => ({ ...p, memory_book: { ...p.memory_book, prompt: e.target.value } }))}
                      placeholder="¿Qué le deseas a Sofia en este día?" />
                  </Field>
                </ContentSection>
              )}
              {features.feature_ai_scenes && (
                <ModuleInfoCard title="AI Scenes" icon={<Sparkles className="w-4 h-4" />}
                  text="AI-generated cinematic scenes. Generate them from the event AI tools; they appear once created." />
              )}

              {!Object.values(features).some(Boolean) && (
                <div className="text-center py-10 text-white/30 text-sm">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Enable modules in the "Modules" tab to configure them here.
                </div>
              )}
            </div>
          )}

          {/* -- TAB: Media -- */}
          {tab === 'media' && (
            <div className="space-y-5">
              <p className="text-xs text-white/40">Upload elegant photos or videos from your device (saved permanently) or paste an existing URL.</p>

              {/* Hero media type selector */}
              <div>
                <Label>Hero cover type</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {[
                    { v: 'image', l: 'Photo', i: <Image className="w-4 h-4" /> },
                    { v: 'video', l: 'Video', i: <Video className="w-4 h-4" /> },
                  ].map(m => (
                    <button key={m.v} type="button" onClick={() => setMedia(p => ({ ...p, heroMediaType: m.v }))}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${media.heroMediaType === m.v ? 'border-amber-500/50 bg-amber-500/5 text-amber-400' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
                      {m.i} {m.l}
                    </button>
                  ))}
                </div>
              </div>

              {media.heroMediaType === 'video' ? (
                <MediaUpload
                  label="Hero video (elegant, autoplay loop)"
                  hint="A short cinematic clip plays muted on a loop behind the cover."
                  value={media.heroVideoUrl}
                  onChange={url => setMedia(p => ({ ...p, heroVideoUrl: url }))}
                  accept="video/*"
                  kind="video"
                  getToken={getToken}
                />
              ) : (
                <MediaUpload
                  label="Hero photo (cover)"
                  value={media.heroImageUrl}
                  onChange={url => setMedia(p => ({ ...p, heroImageUrl: url }))}
                  accept="image/*"
                  kind="image"
                  getToken={getToken}
                />
              )}

              <MediaUpload
                label="Trailer / intro video"
                hint="Shown in the trailer module. Upload a file or paste a YouTube/Vimeo URL."
                value={media.trailerUrl}
                onChange={url => setMedia(p => ({ ...p, trailerUrl: url }))}
                accept="video/*"
                kind="video"
                getToken={getToken}
              />

              <MediaUpload
                label="Background music (ambient loop)"
                value={media.backgroundMusicUrl}
                onChange={url => setMedia(p => ({ ...p, backgroundMusicUrl: url }))}
                accept="audio/*"
                kind="audio"
                getToken={getToken}
              />

              {/* Cinematic poster (single hero poster, like a movie poster) */}
              <div className="pt-2 border-t border-white/5">
                <MediaUpload
                  label="Cinematic poster"
                  hint="A vertical movie-style poster shown as a striking, framed feature on the page."
                  value={media.posterUrl}
                  onChange={url => setMedia(p => ({ ...p, posterUrl: url }))}
                  accept="image/*"
                  kind="image"
                  getToken={getToken}
                />
              </div>

              {/* Styled banner images with text overlays */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Cinematic images (with text overlay)</Label>
                    <p className="text-xs text-white/40 mt-0.5">Insert styled banner images anywhere to give the page a richer look. Add a title/subtitle overlay.</p>
                  </div>
                  <button type="button"
                    onClick={() => setCinematicPosters(p => [...p, { imageUrl: '', title: '', subtitle: '', align: 'center', height: 'md' }])}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/10">
                    <Plus className="w-4 h-4" /> Add image
                  </button>
                </div>

                {cinematicPosters.map((p, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/60">Image {i + 1}</span>
                      <button type="button"
                        onClick={() => setCinematicPosters(arr => arr.filter((_, j) => j !== i))}
                        className="text-rose-400/70 hover:text-rose-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <MediaUpload
                      label="Image"
                      value={p.imageUrl}
                      onChange={url => setCinematicPosters(arr => arr.map((x, j) => j === i ? { ...x, imageUrl: url } : x))}
                      accept="image/*"
                      kind="image"
                      getToken={getToken}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Overlay title"
                        value={p.title ?? ''}
                        onChange={e => setCinematicPosters(arr => arr.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                      <Input placeholder="Overlay subtitle"
                        value={p.subtitle ?? ''}
                        onChange={e => setCinematicPosters(arr => arr.map((x, j) => j === i ? { ...x, subtitle: e.target.value } : x))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={p.align ?? 'center'}
                        onChange={e => setCinematicPosters(arr => arr.map((x, j) => j === i ? { ...x, align: e.target.value as any } : x))}
                        className="w-full rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs px-2 py-2">
                        <option value="left">Text left</option>
                        <option value="center">Text center</option>
                        <option value="right">Text right</option>
                      </select>
                      <select value={p.height ?? 'md'}
                        onChange={e => setCinematicPosters(arr => arr.map((x, j) => j === i ? { ...x, height: e.target.value as any } : x))}
                        className="w-full rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs px-2 py-2">
                        <option value="sm">Short</option>
                        <option value="md">Medium</option>
                        <option value="lg">Tall</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Film book — cinematic photo album the parents can order later */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <div>
                    <Label>Libro de la película (Film Book)</Label>
                    <p className="text-xs text-white/40 mt-0.5">Sube las imágenes del libro. Se muestra como un libro animado que los padres pueden ordenar después del evento.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Título del libro"
                    value={filmBook.title}
                    onChange={e => setFilmBook(p => ({ ...p, title: e.target.value }))} />
                  <Input placeholder="Subtítulo"
                    value={filmBook.subtitle}
                    onChange={e => setFilmBook(p => ({ ...p, subtitle: e.target.value }))} />
                </div>

                {/* availability toggle */}
                <button type="button"
                  onClick={() => setFilmBook(p => ({ ...p, available: !p.available }))}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${filmBook.available ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
                  <span>{filmBook.available ? 'Disponible para ordenar' : 'Coming soon (no disponible aún)'}</span>
                  {filmBook.available ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>

                {filmBook.available ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Precio (49)"
                      value={filmBook.price}
                      onChange={e => setFilmBook(p => ({ ...p, price: e.target.value }))} />
                    <Input placeholder="USD"
                      value={filmBook.currency}
                      onChange={e => setFilmBook(p => ({ ...p, currency: e.target.value }))} />
                    <Input placeholder="Link de orden"
                      value={filmBook.orderUrl}
                      onChange={e => setFilmBook(p => ({ ...p, orderUrl: e.target.value }))} />
                  </div>
                ) : (
                  <Input placeholder='Texto "Coming soon" (opcional)'
                    value={filmBook.comingSoonText}
                    onChange={e => setFilmBook(p => ({ ...p, comingSoonText: e.target.value }))} />
                )}

                {/* page images */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/60">Páginas del libro ({filmBook.images.length})</span>
                  <button type="button"
                    onClick={() => setFilmBook(p => ({ ...p, images: [...p.images, ''] }))}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/10">
                    <Plus className="w-4 h-4" /> Agregar página
                  </button>
                </div>

                {filmBook.images.map((img, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/60">Página {i + 1}</span>
                      <button type="button"
                        onClick={() => setFilmBook(p => ({ ...p, images: p.images.filter((_, j) => j !== i) }))}
                        className="text-rose-400/70 hover:text-rose-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <MediaUpload
                      label="Imagen"
                      value={img}
                      onChange={url => setFilmBook(p => ({ ...p, images: p.images.map((x, j) => j === i ? url : x) }))}
                      accept="image/*"
                      kind="image"
                      getToken={getToken}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -- TAB: Guests (RSVPs) -- */}
          {tab === 'guests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">
                  Guests who registered on your public event page. Updated in real time.
                </p>
                <button
                  onClick={loadGuests}
                  disabled={guestsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50"
                >
                  {guestsLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <ArrowDown className="w-3.5 h-3.5" />}
                  Refresh
                </button>
              </div>

              {/* stats summary */}
              {guestStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatCard label="Confirmed" value={guestStats.confirmed_guests} />
                  <StatCard label="Visitors" value={guestStats.total_visitors} />
                  <StatCard label="Memories" value={guestStats.memory_count} />
                  <StatCard label="Gallery" value={guestStats.gallery_count} />
                </div>
              )}

              {guestsError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {guestsError}
                </div>
              )}

              {guestsLoading && guests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/40">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-xs">Loading guests…</span>
                </div>
              ) : !guestsLoading && guests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-white/40">
                  <Users className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium text-white/60">No registrations yet</p>
                  <p className="text-xs mt-1 max-w-xs">
                    When guests confirm on your event page, they'll appear here with their details.
                  </p>
                  {event.slug && (
                    <a href={`/event/${event.slug}`} target="_blank" rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Open public page
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {guests.map(g => (
                    <div key={g.id}
                      className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">{g.guest_name}</span>
                            {g.attending ? (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                Attending
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                                Can't attend
                              </span>
                            )}
                            {g.guest_count > 1 && (
                              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                +{g.guest_count - 1} guest{g.guest_count - 1 > 1 ? 's' : ''}
                              </span>
                            )}
                            {g.meal_preference && g.meal_preference !== 'none' && (
                              <span className="text-[10px] font-medium text-sky-300 bg-sky-500/10 border border-sky-400/20 px-2 py-0.5 rounded-full capitalize">
                                {g.meal_preference}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-col gap-1 text-[11px] text-white/50">
                            {g.guest_email && (
                              <a href={`mailto:${g.guest_email}`} className="flex items-center gap-1.5 hover:text-amber-300 transition-colors w-fit">
                                <Mail className="w-3 h-3" /> {g.guest_email}
                              </a>
                            )}
                            {g.guest_phone && (
                              <a href={`tel:${g.guest_phone}`} className="flex items-center gap-1.5 hover:text-amber-300 transition-colors w-fit">
                                <Phone className="w-3 h-3" /> {g.guest_phone}
                              </a>
                            )}
                            {g.message && (
                              <span className="flex items-start gap-1.5 text-white/40 italic">
                                <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" /> “{g.message}”
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-white/30 whitespace-nowrap shrink-0">
                          {new Date(g.confirmed_at || g.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* -- TAB: Client -- */}
          {tab === 'client' && (
            <div className="space-y-4">
              <p className="text-xs text-white/40">
                Internal client details. Visible only to you — they never appear on the public page.
              </p>
              <Field label="Client name">
                <Input value={clientInfo.clientName} onChange={e => setClientInfo(p => ({ ...p, clientName: e.target.value }))} placeholder="Mrs. Garcia Martinez" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <Input type="email" value={clientInfo.clientEmail} onChange={e => setClientInfo(p => ({ ...p, clientEmail: e.target.value }))} placeholder="client@email.com" />
                </Field>
                <Field label="Phone / WhatsApp">
                  <Input value={clientInfo.clientPhone} onChange={e => setClientInfo(p => ({ ...p, clientPhone: e.target.value }))} placeholder="+1 555 …" />
                </Field>
              </div>
              <Field label="Internal notes">
                <Textarea value={clientInfo.clientNotes} onChange={e => setClientInfo(p => ({ ...p, clientNotes: e.target.value }))} placeholder="Notes about the event, agreements, reminders…" rows={4} />
              </Field>
              {/* shareable link */}
              {!isNew && event.slug && (
                <ShareCard url={`${window.location.origin}/event/${event.slug}`} title={general.eventTitle || event.event_title || 'Event'} />
              )}
            </div>
          )}

        </div>

        {/* sticky footer */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-white/10 bg-[#0c0c14]">
          {error && <p className="text-xs text-red-400 flex-1">{error}</p>}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {!isNew && event.slug && (
              <a href={`/event/${event.slug}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-amber-400 hover:bg-white/5 border border-white/10 transition-colors">
                <Eye className="w-4 h-4" /> <span className="hidden sm:inline">Preview</span>
              </a>
            )}
            <button onClick={handleClose} className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : isNew ? 'Create event' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Tiny shared UI ------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">{children}</label>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-center">
      <div className="text-lg font-bold text-amber-400 tabular-nums">{value ?? 0}</div>
      <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-amber-500/50 text-sm [color-scheme:dark] ${className}`} />;
}
function Select({ children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return <select {...props} className={`w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50 text-sm ${className}`}>{children}</select>;
}
function Textarea({ className = '', rows = 3, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={rows} className={`w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-amber-500/50 text-sm resize-none ${className}`} />;
}
function ContentSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white/80">
        <span className="text-amber-400">{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function ModuleInfoCard({ title, icon, text }: { title: string; icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white/80">
        <span className="text-amber-400">{icon}</span> {title}
        <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full">Active</span>
      </h3>
      <p className="mt-2 text-xs text-white/40 leading-relaxed">{text}</p>
    </div>
  );
}

/**
 * MediaUpload — lets the user either upload a file (image/video/audio) from
 * their device (stored permanently in Firebase Storage) or paste an existing URL.
 */
function MediaUpload({
  label, value, onChange, accept, kind, hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept: string;
  kind: 'image' | 'video' | 'audio';
  getToken?: () => Promise<string | null>;
  hint?: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputId = `upload-${kind}-${label.replace(/\s+/g, '-').toLowerCase()}`;

  const handleFile = async (file: File) => {
    // Generous caps: 2GB video / 25MB image / 50MB audio.
    // Files upload DIRECTLY to Firebase Storage (resumable), bypassing the
    // server body limit — same approach as the Artist Profile video module.
    const capMb = kind === 'video' ? 2048 : kind === 'audio' ? 50 : 25;
    if (file.size > capMb * 1024 * 1024) {
      toast({ title: `File too large (max ${capMb}MB)`, variant: 'destructive' });
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || kind;
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 60) || 'media';
      const path = `event-media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}.${ext}`;
      const fileRef = storageRef(storage, path);
      const task = uploadBytesResumable(fileRef, file, { contentType: file.type });

      const url: string = await new Promise((resolve, reject) => {
        task.on(
          'state_changed',
          snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          err => reject(err),
          async () => {
            try { resolve(await getDownloadURL(task.snapshot.ref)); }
            catch (e) { reject(e); }
          },
        );
      });

      onChange(url);
      toast({ title: 'File uploaded' });
    } catch (err: any) {
      toast({ title: err?.message ?? 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="text-[11px] text-white/30 mb-1.5 -mt-1">{hint}</p>}
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Paste a URL or upload a file →"
          className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-amber-500/50 text-sm"
        />
        <input id={inputId} type="file" accept={accept} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ''; }} />
        <label htmlFor={inputId}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${uploading ? 'border-white/10 text-white/30' : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? (progress > 0 ? `${progress}%` : 'Uploading…') : 'Upload'}
        </label>
      </div>
      {uploading && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
            style={{ width: `${progress}%` }} />
        </div>
      )}
      {value && kind === 'image' && (
        <img src={value} alt="preview" className="mt-2 h-28 w-full object-cover rounded-lg opacity-80" onError={e => (e.currentTarget.style.display = 'none')} />
      )}
      {value && kind === 'video' && (
        <video src={value} className="mt-2 h-32 w-full object-cover rounded-lg opacity-80 bg-black/40" muted controls playsInline preload="metadata" />
      )}
      {value && kind === 'audio' && (
        <audio src={value} className="mt-2 w-full" controls />
      )}
      {!value && (
        <p className="mt-2 text-[11px] text-white/25 italic">
          {kind === 'video' ? 'Aún no hay video — sube un archivo o pega una URL.' :
           kind === 'audio' ? 'Aún no hay audio — sube un archivo o pega una URL.' :
           'Aún no hay imagen — sube un archivo o pega una URL.'}
        </p>
      )}
    </div>
  );
}

/** AiImprove — small button that rewrites a text field with AI. */
function AiImprove({
  field, text, onImproved, getToken, eventContext, disabled,
}: {
  field: string;
  text: string;
  onImproved: (improved: string) => void;
  getToken: () => Promise<string | null>;
  eventContext?: Record<string, any>;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const run = async () => {
    if (!text.trim()) { toast({ title: 'Write something first', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const token = (await getToken()) ?? '';
      const improved = await improveEventText(field, text, token, eventContext);
      onImproved(improved);
      toast({ title: 'Improved with AI ✨' });
    } catch (err: any) {
      toast({ title: err?.message ?? 'AI failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  return (
    <button type="button" onClick={run} disabled={loading || disabled}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/25 disabled:opacity-40 transition-colors">
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
      {loading ? 'Improving…' : 'Improve with AI'}
    </button>
  );
}

// --- Event Card (list view) ---------------------------------------------------

function EventCard({ event, onEdit, onTogglePublish, onDelete }: {
  event: MyEventSummary;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const origin = window.location.origin;
  const url = `${origin}/event/${event.slug}`;
  const [showShare, setShowShare] = useState(false);
  const badge = STATUS_BADGES[event.status] ?? STATUS_BADGES.draft;
  const tier = TIERS.find(t => t.value === event.tier) ?? TIERS[0];
  const typeLabel = EVENT_TYPES.find(t => t.value === event.event_type)?.label ?? event.event_type;
  const dateStr = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r ${tier.color} text-black/80`}>{tier.icon} {tier.label}</span>
          </div>
          <h3 className="font-semibold text-white truncate">{event.event_title}</h3>
          <p className="text-xs text-white/40 mt-0.5">{typeLabel}</p>
          {event.client_name && <p className="text-xs text-amber-400/60 mt-0.5">👤 {event.client_name}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onEdit} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors" title="Configure">
            <Settings2 className="w-4 h-4 text-white/60" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 transition-colors" title="Delete event">
            <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-white/45">
        <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 shrink-0" />{dateStr}</div>
        {event.event_location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{event.event_location}</div>}
        <div className="flex items-center gap-1.5 font-mono"><Globe className="w-3.5 h-3.5 shrink-0" />/event/{event.slug}</div>
      </div>

      {/* active modules chips */}
      <div className="flex flex-wrap gap-1">
        {ALL_MODULES.filter(m => m.featureKey && (event as any)[m.featureKey]).map(m => (
          <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/40 border border-white/8">
            {m.icon} {m.label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        <CopyBtn url={url} />
        <button onClick={() => setShowShare(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 transition-colors" title="Share / QR">
          <QrCode className="w-3.5 h-3.5" /> Share
        </button>
        <Link href={`/event/${event.slug}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors">
          <Eye className="w-3.5 h-3.5" /> View
        </Link>
        <button onClick={onTogglePublish}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            event.status === 'published'
              ? 'border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
              : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
          }`}>
          {event.status === 'published' ? '● Published' : '○ Publish'}
        </button>
      </div>

      {showShare && (
        <ShareCard url={url} title={event.event_title || 'Event'} />
      )}
    </div>
  );
}

// --- Main Page ----------------------------------------------------------------

export default function EventCreatorPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editEvent, setEditEvent] = useState<MyEventSummary | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [clerkToken, setClerkToken] = useState('');

  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then(t => setClerkToken(t ?? ''));
  }, [getToken, isSignedIn]);

  // Ensure we always have a fresh token before opening the editor so the
  // "New event" / "Create my first event" buttons never fail silently.
  const openNew = useCallback(async () => {
    let token = clerkToken;
    if (!token) {
      token = (await getToken()) ?? '';
      setClerkToken(token);
    }
    if (!token) {
      toast({ title: 'Sign in to create an event', variant: 'destructive' });
      return;
    }
    setShowNew(true);
  }, [clerkToken, getToken, toast]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['my-cinematic-events'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return fetchMyEvents(token);
    },
    enabled: !!isSignedIn,
    staleTime: 30_000,
  });

  const handleTogglePublish = useCallback(async (ev: MyEventSummary) => {
    const token = await getToken();
    if (!token) return;
    const next = ev.status === 'published' ? 'draft' : 'published';
    try {
      await updateEvent(ev.slug, { status: next }, token);
      qc.invalidateQueries({ queryKey: ['my-cinematic-events'] });
      toast({ title: next === 'published' ? 'Event published!' : 'Event unpublished' });
    } catch {
      toast({ title: 'Failed to change status', variant: 'destructive' });
    }
  }, [getToken, qc, toast]);

  const handleDelete = useCallback(async (ev: MyEventSummary) => {
    const confirmed = window.confirm(
      `Delete "${ev.event_title}"?\n\nThis action is permanent and removes the event along with all its RSVPs, memories, gallery and dedications.`
    );
    if (!confirmed) return;
    const token = await getToken();
    if (!token) return;
    try {
      await deleteEvent(ev.slug, token);
      qc.invalidateQueries({ queryKey: ['my-cinematic-events'] });
      toast({ title: 'Event deleted' });
    } catch {
      toast({ title: 'Failed to delete the event', variant: 'destructive' });
    }
  }, [getToken, qc, toast]);

  // --- Auth gate: only signed-in users can access / create events -------------
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#070711] text-white flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#070711] text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center rounded-2xl border border-white/10 bg-white/[0.02] p-10">
          <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Sign in to continue</h1>
          <p className="text-sm text-white/50 mb-7 leading-relaxed">
            Only registered users can create and manage cinematic events.
          </p>
          <Link href="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold text-sm hover:opacity-90 transition-opacity">
            Sign in <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070711] text-white px-4 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Film className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400/70">Boostify Event Premiere</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">My cinematic events</h1>
          <p className="text-sm text-white/40 mt-1">Create and configure luxury invitation pages for your clients.</p>
        </div>
        <button onClick={openNew}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New event
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 mb-8">
        <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" /> How does it work?
        </h2>
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { n: '1', t: 'Create',    d: 'Fill out the form: title, date, venue, type and plan.' },
            { n: '2', t: 'Configure', d: 'Enable modules and add content (story, schedule, dress code…).' },
            { n: '3', t: 'Share',     d: 'Send the /event/your-event link to your guests.' },
            { n: '4', t: 'Live it',   d: 'RSVP, Photo Booth, Soundtrack, Gallery – all in one place.' },
          ].map(s => (
            <div key={s.n} className="flex gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold flex items-center justify-center">{s.n}</span>
              <div><p className="text-sm font-medium text-white">{s.t}</p><p className="text-xs text-white/40 mt-0.5 leading-relaxed">{s.d}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* Event list */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-52 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center">
          <Clapperboard className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm mb-4">You don't have any events yet.</p>
          <button onClick={openNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Create my first event
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {events.map(ev => (
            <EventCard key={ev.id} event={ev}
              onEdit={() => setEditEvent(ev)}
              onTogglePublish={() => handleTogglePublish(ev)}
              onDelete={() => handleDelete(ev)} />
          ))}
        </div>
      )}

      {/* Demo hint */}
      <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.02] p-5 flex items-center gap-4">
        <Eye className="w-8 h-8 text-amber-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-white">View the demo page</p>
          <p className="text-xs text-white/40 mt-0.5">See how the full guest experience looks.</p>
        </div>
        <Link href="/event/sofia-quince-2026"
          className="ml-auto shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-sm font-medium transition-colors whitespace-nowrap">
          Demo <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Editor modal — NEW */}
      {showNew && clerkToken && (
        <EventEditor
          event={{}}
          getToken={getToken}
          onClose={() => setShowNew(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['my-cinematic-events'] })}
          isNew
        />
      )}

      {/* Editor modal — EDIT */}
      {editEvent && clerkToken && (
        <EventEditor
          event={editEvent}
          getToken={getToken}
          onClose={() => setEditEvent(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['my-cinematic-events'] })}
          isNew={false}
        />
      )}
    </div>
  );
}

