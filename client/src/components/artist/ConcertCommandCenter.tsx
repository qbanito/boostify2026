/**
 * Concert Command Center Widget
 * ===============================
 * Right-column widget for the artist profile. Unifies:
 *   - Upcoming concerts + ticket sales (Stripe)
 *   - Linked merch / streaming / fan club discounts
 *   - Buyer ↔ artist messaging
 *   - Owner management dashboard (create events, set tiers, see revenue)
 *
 * Props match the standard widget pattern used across the profile column.
 */
import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music2, Calendar, MapPin, Ticket, DollarSign, MessageSquare,
  Plus, ChevronRight, Loader2, CheckCircle2, ExternalLink,
  Globe, Wifi, Users, Send, X, Edit2, Eye,
  QrCode, ScanLine, Camera, ShoppingBag, ShieldCheck, AlertTriangle, Search,
  Tag, BarChart3, Info, LayoutGrid,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { apiRequest } from '../../lib/queryClient';
import { useAuth } from '../../hooks/use-auth';

// Owner venue & seat-map builder (heavy — lazy-loaded only when the owner opens it)
const SeatMapEditor = lazy(() => import('../seatmap/SeatMapEditor').then((m) => ({ default: m.SeatMapEditor })));

// ─── Types ─────────────────────────────────────────────────────────────────

interface ConcertColors {
  hexPrimary?: string;
  hexAccent?: string;
  hexBorder?: string;
}

interface ConcertCommandCenterProps {
  artistId: number;
  artistName: string;
  artistSlug?: string;
  colors?: ConcertColors;
  /** Owner override from the parent profile (handles AI-generated artists). */
  isOwner?: boolean;
}

interface TicketTier {
  id: number;
  name: string;
  description?: string;
  priceUsd: number;
  quantityTotal?: number;
  remaining?: number;
  perks?: string[];
}

interface ConcertAddon {
  id: string;
  label: string;
  priceUsd: number;
  imageUrl?: string;
}

interface ConcertEvent {
  id: number;
  title: string;
  description?: string;
  type: 'in_person' | 'online' | 'hybrid';
  status: 'draft' | 'published' | 'live' | 'ended' | 'cancelled';
  startsAt?: string;
  venue?: string;
  location?: string;
  posterUrl?: string;
  tiers: TicketTier[];
  linkedModules?: { addons?: ConcertAddon[]; [k: string]: any } | null;
  refundPolicy?: string | null;
  refundPolicyType?: string;
}

interface TicketPass {
  id: number;
  passCode: string;
  token: string;
  tierName?: string;
  buyerName?: string;
  status: 'valid' | 'checked_in' | 'void' | 'transferred';
  seat?: string;
  checkedInAt?: string;
  event?: { id?: number; title?: string; startsAt?: string; venue?: string; location?: string } | null;
}

interface ManageDashboard {
  events: ConcertEvent[];
  commissionRate: number;
  revenue: { completedOrders: number; grossRevenue: number; netEarnings: number };
  messages: { unread: number; threads: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const FALLBACK_PRIMARY = '#9333ea';
const FALLBACK_ACCENT = '#a855f7';

function hex(value: string | undefined, fallback: string) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}
function hexToRgba(h: string, a: number) {
  const c = h.replace('#', '');
  return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${a})`;
}

const TYPE_ICON: Record<string, any> = {
  in_person: MapPin,
  online: Globe,
  hybrid: Wifi,
};
const TYPE_LABEL: Record<string, string> = {
  in_person: 'Presencial',
  online: 'Online',
  hybrid: 'Híbrido',
};

function fmtDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function dateTile(iso?: string): { month: string; day: string; weekday: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return {
    month: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').toUpperCase(),
    day: d.toLocaleDateString('es-ES', { day: '2-digit' }),
    weekday: d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').toUpperCase(),
  };
}

// Renders modal content into document.body so it always sits above the profile
// section frames (which create CSS stacking contexts via transform/parallax).
function ModalPortal({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

// ─── Sub-components ──────────────────────────────────────────────────────

function EventCard({
  event,
  primary,
  accent,
  border,
  onBuy,
  isOwner,
}: {
  event: ConcertEvent;
  primary: string;
  accent: string;
  border: string;
  onBuy: (event: ConcertEvent) => void;
  isOwner: boolean;
}) {
  const TypeIcon = TYPE_ICON[event.type] || MapPin;
  const isLive = event.status === 'live';
  const activeTiers = event.tiers.filter((t) => t.priceUsd > 0);
  const minPrice = activeTiers.length ? Math.min(...activeTiers.map((t) => t.priceUsd)) : 0;
  const tile = dateTile(event.startsAt);
  const poster = (event as any).posterUrl as string | undefined;
  const totalRemaining = activeTiers.reduce((s, t) => s + (t.remaining ?? 0), 0);
  const lowStock = activeTiers.length > 0 && activeTiers.every((t) => t.remaining != null) && totalRemaining > 0 && totalRemaining <= 10;
  const soldOut = activeTiers.length > 0 && activeTiers.every((t) => t.remaining === 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="group relative rounded-2xl border overflow-hidden"
      style={{
        borderColor: hexToRgba(accent, 0.28),
        background: `linear-gradient(180deg, ${hexToRgba(primary, 0.1)}, rgba(12,12,16,0.6))`,
        boxShadow: `0 10px 34px -16px ${hexToRgba(accent, 0.6)}`,
      }}
    >
      {/* Poster banner */}
      {poster && (
        <div className="relative h-28 overflow-hidden">
          <img src={poster} alt={event.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, ${hexToRgba('#0b0b10', 0.9)})` }} />
          {isLive && (
            <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-sm" style={{ background: hexToRgba('#ef4444', 0.35), color: '#fff' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
            </span>
          )}
          {isOwner && (
            <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full border backdrop-blur-sm capitalize" style={{
              borderColor: hexToRgba(accent, 0.5), background: 'rgba(0,0,0,0.4)',
              color: event.status === 'published' || event.status === 'live' ? '#4ade80' : '#cbd5e1',
            }}>{event.status}</span>
          )}
        </div>
      )}

      <div className="p-3 space-y-2.5">
        {/* Header row with date tile */}
        <div className="flex items-start gap-3">
          {tile && (
            <div
              className="flex flex-col items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 leading-none"
              style={{ background: `linear-gradient(160deg, ${hexToRgba(accent, 0.28)}, ${hexToRgba(primary, 0.12)})`, border: `1px solid ${hexToRgba(accent, 0.35)}` }}
            >
              <span className="text-[9px] font-bold tracking-wider" style={{ color: accent }}>{tile.month}</span>
              <span className="text-lg font-extrabold text-white -mt-0.5">{tile.day}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              {!poster && isLive && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: hexToRgba('#ef4444', 0.2), color: '#f87171' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: hexToRgba(primary, 0.16), color: '#cbd5e1' }}>
                <TypeIcon className="h-3 w-3" /> {TYPE_LABEL[event.type]}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white leading-tight truncate">{event.title}</h4>
            {event.venue && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate"><MapPin className="h-3 w-3 flex-shrink-0" />{event.venue}{event.location ? ` · ${event.location}` : ''}</p>}
            {event.startsAt && <p className="text-[11px] text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3 flex-shrink-0" />{fmtDate(event.startsAt)}</p>}
          </div>
          {!poster && isOwner && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 capitalize" style={{
              borderColor: hexToRgba(accent, 0.4),
              color: event.status === 'published' || event.status === 'live' ? '#4ade80' : '#9ca3af',
            }}>{event.status}</span>
          )}
        </div>

        {/* Tiers */}
        {activeTiers.length > 0 && (
          <div className="space-y-1">
            {activeTiers.slice(0, 3).map((tier) => (
              <div key={tier.id} className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5" style={{ background: hexToRgba(primary, 0.1), border: `1px solid ${hexToRgba(accent, 0.14)}` }}>
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-white font-medium truncate">{tier.name}</span>
                  {tier.remaining != null && tier.remaining <= 10 && tier.remaining > 0 && (
                    <span className="text-[10px] text-orange-400 font-semibold flex-shrink-0">¡Solo {tier.remaining}!</span>
                  )}
                  {tier.remaining === 0 && <span className="text-[10px] text-red-400 font-semibold flex-shrink-0">Agotado</span>}
                </div>
                <span className="font-bold flex-shrink-0" style={{ color: accent }}>{fmtUSD(tier.priceUsd)}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        {(event.status === 'published' || event.status === 'live') && activeTiers.length > 0 && !isOwner && (
          <button
            onClick={() => onBuy(event)}
            disabled={soldOut}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: soldOut ? hexToRgba('#6b7280', 0.3) : `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
          >
            <Ticket className="h-4 w-4" />
            {soldOut ? 'Agotado' : minPrice > 0 ? `Comprar · desde ${fmtUSD(minPrice)}` : 'Comprar Tickets'}
          </button>
        )}
        {lowStock && !soldOut && !isOwner && (
          <p className="text-[10px] text-center text-orange-400 font-medium -mt-0.5">🔥 Quedan pocas entradas</p>
        )}
      </div>
    </motion.div>
  );
}

function BuyTicketModal({
  event,
  artistId,
  artistSlug,
  artistName,
  primary,
  accent,
  border,
  onClose,
}: {
  event: ConcertEvent;
  artistId: number;
  artistSlug?: string;
  artistName?: string;
  primary: string;
  accent: string;
  border: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState('');

  const activeTiers = event.tiers.filter((t) => t.priceUsd > 0 && t.remaining !== 0);
  const addons = (event.linkedModules?.addons || []).filter((a) => a && a.id && Number(a.priceUsd) > 0);
  const ticketsSubtotal = activeTiers.reduce((s, t) => s + (t.priceUsd * (quantities[t.id] || 0)), 0);
  const addonsSubtotal = addons.reduce((s, a) => s + (Number(a.priceUsd) * (addonQty[a.id] || 0)), 0);
  const subtotal = ticketsSubtotal + addonsSubtotal;
  const ticketCount = Object.values(quantities).reduce((s, n) => s + (n || 0), 0);
  const discount = promo ? Math.min(subtotal, promo.discount) : 0;
  const total = Math.max(0, subtotal - discount);

  const validatePromo = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/concerts/event/${event.id}/validate-code`, {
      code: promoInput.trim(),
      subtotal,
    }),
    onSuccess: (data: any) => {
      if (data?.valid) {
        setPromo({ code: data.code, discount: Number(data.discount) || 0 });
        setPromoError('');
      } else {
        setPromo(null);
        setPromoError(data?.error || 'Código no válido');
      }
    },
    onError: (err: any) => { setPromo(null); setPromoError(err?.message || 'Código no válido'); },
  });

  // Sold-out waitlist
  const [waitCity, setWaitCity] = useState('');
  const [waitJoined, setWaitJoined] = useState(false);
  const joinWaitlist = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/concerts/${artistId}/events/${event.id}/waitlist`, {
      email: email.trim(),
      name: name.trim() || undefined,
      city: waitCity.trim() || undefined,
    }),
    onSuccess: () => setWaitJoined(true),
    onError: (err: any) => setError(err?.message || 'No se pudo unir a la lista'),
  });
  const soldOut = activeTiers.length === 0;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([tierId, quantity]) => ({ tierId: parseInt(tierId, 10), quantity }));
      const addonItems = Object.entries(addonQty)
        .filter(([, qty]) => qty > 0)
        .map(([addonId, quantity]) => ({ addonId, quantity }));
      return apiRequest('POST', `/api/concerts/${artistId}/checkout`, {
        eventId: event.id,
        buyerEmail: email.trim(),
        buyerName: name.trim() || undefined,
        buyerPhone: phone.trim() || undefined,
        buyerCity: city.trim() || undefined,
        marketingOptIn,
        policyAccepted,
        items,
        addons: addonItems,
        discountCode: promo?.code || undefined,
      });
    },
    onSuccess: (data: any) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err: any) => setError(err?.message || 'Error al procesar el pago'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email válido requerido');
      return;
    }
    if (!name.trim()) { setError('Tu nombre es obligatorio'); return; }
    if (!phone.trim() || phone.trim().replace(/\D/g, '').length < 6) { setError('Un teléfono válido es obligatorio'); return; }
    if (ticketCount <= 0) { setError('Selecciona al menos un ticket'); return; }
    if (subtotal <= 0) { setError('Selecciona al menos un ticket'); return; }
    if (!policyAccepted) { setError('Debes aceptar la política de reembolso y los términos'); return; }
    checkoutMutation.mutate();
  };

  return (
    <ModalPortal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.78)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: '#0f0f12', borderColor: hexToRgba(accent, 0.4) }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-bold text-base">{event.title}</h3>
            {event.startsAt && <p className="text-xs text-gray-400">{fmtDate(event.startsAt)}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {soldOut && (
            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: hexToRgba(accent, 0.3), background: hexToRgba(primary, 0.08) }}>
              {waitJoined ? (
                <p className="text-sm text-center" style={{ color: '#4ade80' }}>✓ ¡Estás en la lista! Te avisaremos en cuanto liberemos entradas.</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" style={{ color: accent }} /> Entradas agotadas</p>
                  <p className="text-xs text-gray-400">Únete a la lista de espera y serás de los primeros en saberlo si se liberan entradas.</p>
                  <input type="email" placeholder="Tu email *" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500" style={{ borderColor: hexToRgba(accent, 0.3) }} />
                  <input type="text" placeholder="Tu ciudad (opcional)" value={waitCity} onChange={(e) => setWaitCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500" style={{ borderColor: hexToRgba(accent, 0.3) }} />
                  <button type="button"
                    onClick={() => { if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(''); joinWaitlist.mutate(); } else setError('Email válido requerido'); }}
                    disabled={joinWaitlist.isPending}
                    className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}>
                    {joinWaitlist.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Avísame cuando haya entradas
                  </button>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                </>
              )}
            </div>
          )}
          {activeTiers.map((tier) => (
            <div key={tier.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: hexToRgba(accent, 0.25), background: hexToRgba(primary, 0.08) }}>
              <div>
                <p className="text-sm text-white font-medium">{tier.name}</p>
                {tier.description && <p className="text-xs text-gray-400">{tier.description}</p>}
                <p className="text-xs font-bold mt-0.5" style={{ color: accent }}>{fmtUSD(tier.priceUsd)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setQuantities((p) => ({ ...p, [tier.id]: Math.max(0, (p[tier.id] || 0) - 1) }))}
                  className="w-7 h-7 rounded-full border text-white flex items-center justify-center" style={{ borderColor: hexToRgba(accent, 0.4) }}>
                  −
                </button>
                <span className="text-white text-sm w-5 text-center">{quantities[tier.id] || 0}</span>
                <button type="button" onClick={() => {
                  const max = tier.remaining ?? 99;
                  setQuantities((p) => ({ ...p, [tier.id]: Math.min(max, (p[tier.id] || 0) + 1) }));
                }}
                  className="w-7 h-7 rounded-full border text-white flex items-center justify-center" style={{ borderColor: hexToRgba(accent, 0.4) }}>
                  +
                </button>
              </div>
            </div>
          ))}

          {/* Merch / experience add-ons (upsell) */}
          {!soldOut && addons.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" style={{ color: accent }} />
                Añade merch al pedido
              </p>
              {addons.map((addon) => (
                <div key={addon.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: hexToRgba(accent, 0.25), background: hexToRgba(primary, 0.08) }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {addon.imageUrl && (
                      <img src={addon.imageUrl} alt={addon.label} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{addon.label}</p>
                      <p className="text-xs font-bold mt-0.5" style={{ color: accent }}>{fmtUSD(Number(addon.priceUsd))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={() => setAddonQty((p) => ({ ...p, [addon.id]: Math.max(0, (p[addon.id] || 0) - 1) }))}
                      className="w-7 h-7 rounded-full border text-white flex items-center justify-center" style={{ borderColor: hexToRgba(accent, 0.4) }}>
                      −
                    </button>
                    <span className="text-white text-sm w-5 text-center">{addonQty[addon.id] || 0}</span>
                    <button type="button" onClick={() => setAddonQty((p) => ({ ...p, [addon.id]: Math.min(20, (p[addon.id] || 0) + 1) }))}
                      className="w-7 h-7 rounded-full border text-white flex items-center justify-center" style={{ borderColor: hexToRgba(accent, 0.4) }}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!soldOut && (<>
          <input
            type="email"
            placeholder="Tu email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500"
            style={{ borderColor: hexToRgba(accent, 0.3) }}
          />
          <input
            type="text"
            placeholder="Tu nombre completo *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500"
            style={{ borderColor: hexToRgba(accent, 0.3) }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="tel"
              placeholder="Teléfono *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500"
              style={{ borderColor: hexToRgba(accent, 0.3) }}
            />
            <input
              type="text"
              placeholder="Ciudad (opcional)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500"
              style={{ borderColor: hexToRgba(accent, 0.3) }}
            />
          </div>

          {/* Refund / cancellation policy — buyer must accept before paying */}
          {event.refundPolicy && (
            <div className="rounded-lg border p-2.5 space-y-1" style={{ borderColor: hexToRgba(accent, 0.25), background: hexToRgba(primary, 0.06) }}>
              <p className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" style={{ color: accent }} /> Política de reembolso
              </p>
              <p className="text-[11px] text-gray-400 leading-relaxed">{event.refundPolicy}</p>
            </div>
          )}
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={policyAccepted} onChange={(e) => setPolicyAccepted(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded accent-current" style={{ accentColor: accent }} />
            <span className="text-[11px] text-gray-300 leading-snug">
              Acepto la política de reembolso{event.refundPolicy ? '' : ' del artista'} y los términos de compra. *
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded" style={{ accentColor: accent }} />
            <span className="text-[11px] text-gray-400 leading-snug">
              Quiero recibir noticias y novedades de {artistName || 'el artista'} por email.
            </span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Promo / presale code */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Código promocional"
                value={promoInput}
                onChange={(e) => { setPromoInput(e.target.value); setPromoError(''); }}
                disabled={!!promo}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500 disabled:opacity-60"
                style={{ borderColor: hexToRgba(accent, 0.3) }}
              />
              {promo ? (
                <button type="button" onClick={() => { setPromo(null); setPromoInput(''); setPromoError(''); }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border text-white" style={{ borderColor: hexToRgba(accent, 0.4) }}>
                  Quitar
                </button>
              ) : (
                <button type="button" onClick={() => promoInput.trim() && validatePromo.mutate()}
                  disabled={validatePromo.isPending || subtotal <= 0 || !promoInput.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: hexToRgba(accent, 0.2), color: accent }}>
                  {validatePromo.isPending ? '…' : 'Aplicar'}
                </button>
              )}
            </div>
            {promoError && <p className="text-xs text-red-400">{promoError}</p>}
            {promo && <p className="text-xs" style={{ color: '#4ade80' }}>✓ Código "{promo.code}" aplicado · −{fmtUSD(discount)}</p>}
          </div>

          {discount > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-300 pt-1">
              <span>Subtotal</span><span>{fmtUSD(subtotal)}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={checkoutMutation.isPending || subtotal <= 0}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
          >
            {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            {subtotal > 0 ? `Pagar ${fmtUSD(total)}` : 'Selecciona tickets'}
          </button>
          </>)}
        </form>
      </motion.div>
    </motion.div>
    </ModalPortal>
  );
}

// ─── Pass / ticket views ────────────────────────────────────────────────

const PASS_STATUS: Record<string, { label: string; color: string }> = {
  valid: { label: 'Válido', color: '#4ade80' },
  checked_in: { label: 'Usado', color: '#9ca3af' },
  void: { label: 'Anulado', color: '#f87171' },
  transferred: { label: 'Transferido', color: '#fbbf24' },
};

function PassCard({ pass, accent, primary }: { pass: TicketPass; accent: string; primary: string }) {
  const st = PASS_STATUS[pass.status] || PASS_STATUS.valid;
  const usable = pass.status === 'valid';
  return (
    <div className="rounded-xl border p-3 flex gap-3 items-center" style={{ borderColor: hexToRgba(accent, 0.3), background: hexToRgba(primary, 0.06) }}>
      <div className="bg-white rounded-lg p-1.5 flex-shrink-0" style={{ opacity: usable ? 1 : 0.4 }}>
        <QRCode value={pass.token} size={84} style={{ height: 84, width: 84 }} />
      </div>
      <div className="min-w-0 flex-1">
        {pass.event?.title && <p className="text-sm font-semibold text-white truncate">{pass.event.title}</p>}
        {pass.tierName && <p className="text-xs text-gray-300">{pass.tierName}</p>}
        {pass.event?.startsAt && <p className="text-[11px] text-gray-400">{fmtDate(pass.event.startsAt)}</p>}
        {pass.event?.venue && <p className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin className="h-3 w-3" />{pass.event.venue}</p>}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: hexToRgba(st.color, 0.18), color: st.color }}>
            {st.label}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">{pass.passCode}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Post-purchase + self-service ticket viewer. Opens automatically after a
 * successful Stripe redirect (session_id) to show the buyer their signed QR
 * passes, and also lets any fan re-download tickets by email.
 */
function MyTicketsModal({
  artistId, sessionId, primary, accent, onClose,
}: {
  artistId: number;
  sessionId?: string | null;
  primary: string;
  accent: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const pollAttempts = useRef(0);
  const [pollExhausted, setPollExhausted] = useState(false);

  const orderQ = useQuery<{ passes: TicketPass[]; event?: any; addons?: any[] }>({
    queryKey: ['concert-order-passes', sessionId],
    queryFn: async () => {
      pollAttempts.current += 1;
      const r = await apiRequest('GET', `/api/concerts/order/passes?session_id=${encodeURIComponent(sessionId!)}`);
      if (pollAttempts.current >= 12 && !(r?.passes?.length)) setPollExhausted(true);
      return r;
    },
    enabled: !!sessionId,
    // Poll until passes are minted. The /order/passes endpoint self-fulfils the
    // order against Stripe, so passes normally appear on the first poll; we cap
    // retries at ~30s so a stuck/unpaid order can never loop forever.
    refetchInterval: (q) =>
      (q.state.data?.passes?.length || 0) > 0 || (q.state.dataUpdateCount || 0) >= 12 ? false : 2500,
  });

  const lookupQ = useQuery<{ passes: TicketPass[] }>({
    queryKey: ['concert-my-tickets', artistId, lookupEmail],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/my-tickets?email=${encodeURIComponent(lookupEmail)}`),
    enabled: !!lookupEmail,
  });

  const orderPasses = orderQ.data?.passes || [];
  const orderAddons = orderQ.data?.addons || [];
  const lookupPasses = lookupQ.data?.passes || [];
  const waitingForPasses = !!sessionId && orderPasses.length === 0 && !pollExhausted;
  const passesTimedOut = !!sessionId && orderPasses.length === 0 && pollExhausted;

  return (
    <ModalPortal>
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.78)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl"
        style={{ background: '#0f0f12', borderColor: hexToRgba(accent, 0.4) }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5" style={{ color: accent }} />
            <h3 className="text-white font-bold text-base">Mis Tickets</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {/* Order result (after purchase) */}
        {sessionId && (
          <div className="space-y-2">
            {waitingForPasses ? (
              <div className="text-center py-6 space-y-2">
                <Loader2 className="h-7 w-7 animate-spin mx-auto" style={{ color: accent }} />
                <p className="text-sm text-white font-medium">¡Pago confirmado!</p>
                <p className="text-xs text-gray-400">Generando tus pases con QR seguro…</p>
              </div>
            ) : passesTimedOut ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="h-7 w-7 mx-auto text-green-400" />
                <p className="text-sm text-white font-medium">¡Pago recibido!</p>
                <p className="text-xs text-gray-400">
                  Te enviamos tus entradas con el código QR por email. Si no aparecen aquí,
                  recupéralas abajo con tu correo de compra.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle2 className="h-4 w-4" /> {orderPasses.length} pase{orderPasses.length !== 1 ? 's' : ''} emitido{orderPasses.length !== 1 ? 's' : ''}
                </div>
                {orderPasses.map((p) => <PassCard key={p.id} pass={p} accent={accent} primary={primary} />)}
                {orderAddons.length > 0 && (
                  <div className="rounded-lg border p-3 text-xs text-gray-300" style={{ borderColor: hexToRgba(accent, 0.25) }}>
                    <p className="font-semibold text-white mb-1 flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5" style={{ color: accent }} /> Merch en tu pedido</p>
                    {orderAddons.map((a: any, i: number) => (
                      <div key={i} className="flex justify-between"><span>{a.quantity}× {a.name}</span><span>{fmtUSD(Number(a.unitPrice) * a.quantity)}</span></div>
                    ))}
                    <p className="text-[11px] text-gray-500 mt-1">El artista coordinará la entrega por mensaje.</p>
                  </div>
                )}
                <p className="text-[11px] text-gray-500 text-center">Presenta cada QR en la entrada. Cada pase admite una sola persona.</p>
              </>
            )}
          </div>
        )}

        {/* Email lookup (re-download) */}
        <div className="space-y-2 pt-1 border-t" style={{ borderColor: hexToRgba(accent, 0.15) }}>
          <p className="text-xs font-semibold text-white pt-2">¿Compraste antes? Recupera tus tickets</p>
          <div className="flex gap-2">
            <input
              type="email" placeholder="Tu email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500"
              style={{ borderColor: hexToRgba(accent, 0.3) }}
            />
            <button
              onClick={() => { if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) setLookupEmail(email.trim()); }}
              className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1"
              style={{ background: hexToRgba(primary, 0.2), color: accent }}
            >
              {lookupQ.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          {lookupEmail && !lookupQ.isFetching && lookupPasses.length === 0 && (
            <p className="text-xs text-gray-400">No encontramos tickets para ese email.</p>
          )}
          {lookupPasses.map((p) => <PassCard key={p.id} pass={p} accent={accent} primary={primary} />)}
        </div>
      </motion.div>
    </motion.div>
    </ModalPortal>
  );
}

/**
 * Owner door check-in. Validates a scanned/pasted QR token against the signed
 * pass (atomic single-use on the server). Uses the native BarcodeDetector when
 * available for live camera scanning, with a manual paste fallback.
 */
function CheckInScanner({
  artistId, events, primary, accent,
}: {
  artistId: number;
  events: ConcertEvent[];
  primary: string;
  accent: string;
}) {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState<number | 0>(events[0]?.id || 0);
  const [token, setToken] = useState('');
  const [result, setResult] = useState<any>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  const supportsCamera = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices;

  const statsQ = useQuery<{ stats: { total: number; checkedIn: number; valid: number; void: number }; passes: any[] }>({
    queryKey: ['concert-pass-stats', artistId, eventId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/passes${eventId ? `?eventId=${eventId}` : ''}`),
    enabled: !!artistId,
  });

  // Security audit — every door scan (admitted or rejected) for fraud review.
  const [showSecurity, setShowSecurity] = useState(false);
  const logsQ = useQuery<{ stats: any; logs: any[] }>({
    queryKey: ['concert-scan-logs', artistId, eventId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/scan-logs${eventId ? `?eventId=${eventId}` : ''}`),
    enabled: !!artistId && showSecurity,
    refetchInterval: showSecurity ? 12000 : false,
  });

  // Client-side CSV export of the door manifest (uses the already-loaded passes,
  // so it works without attaching an auth token to an anchor download).
  const exportCsv = () => {
    const passes = statsQ.data?.passes || [];
    if (!passes.length) return;
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const header = ['pass_code', 'event_id', 'tier', 'buyer_name', 'buyer_email', 'status', 'checked_in_at'];
    const lines = [header.join(',')];
    for (const p of passes) {
      lines.push([esc(p.passCode), esc(p.concertId), esc(p.tierName), esc(p.buyerName), esc(p.buyerEmail), esc(p.status), esc(p.checkedInAt ? new Date(p.checkedInAt).toISOString() : '')].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `boostify-passes${eventId ? `-event-${eventId}` : ''}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const scanMutation = useMutation({
    mutationFn: (tok: string) =>
      apiRequest('POST', `/api/concerts/${artistId}/scan`, { token: tok, eventId: eventId || undefined }),
    onSuccess: (data: any) => {
      setResult(data);
      setToken('');
      qc.invalidateQueries({ queryKey: ['concert-pass-stats', artistId, eventId] });
    },
    onError: () => setResult({ ok: false, message: 'Error de red al validar' }),
  });

  const stopCamera = () => {
    scanningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    if (!supportsCamera) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // @ts-ignore - BarcodeDetector is not in the TS DOM lib yet
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      scanningRef.current = true;
      const tick = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length && codes[0].rawValue) {
            const value = codes[0].rawValue as string;
            stopCamera();
            scanMutation.mutate(value);
            return;
          }
        } catch { /* frame not ready */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setResult({ ok: false, message: 'No se pudo abrir la cámara' });
      stopCamera();
    }
  };

  useEffect(() => () => stopCamera(), []); // cleanup on unmount

  const stats = statsQ.data?.stats;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" style={{ color: accent }} />
        <p className="text-sm font-semibold text-white">Control de acceso (anti-fraude)</p>
      </div>
      <p className="text-[11px] text-gray-400 -mt-1">
        Escanea el QR de cada asistente. Cada pase está firmado y solo admite una entrada: un screenshot reenviado o un pase ya usado será rechazado.
      </p>

      {/* Event picker */}
      {events.length > 0 && (
        <select
          value={eventId}
          onChange={(e) => setEventId(parseInt(e.target.value, 10) || 0)}
          className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white"
          style={{ borderColor: hexToRgba(accent, 0.3) }}
        >
          <option value={0}>Todos los eventos</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </select>
      )}

      {/* Check-in stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Emitidos', value: stats.total },
            { label: 'Dentro', value: stats.checkedIn },
            { label: 'Pendientes', value: stats.valid },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg p-2 text-center" style={{ background: hexToRgba(primary, 0.06), border: `1px solid ${hexToRgba(accent, 0.25)}` }}>
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className="text-base font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Camera scanner */}
      {cameraOn && (
        <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: hexToRgba(accent, 0.4) }}>
          <video ref={videoRef} className="w-full h-48 object-cover bg-black" playsInline muted />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-32 border-2 rounded-lg" style={{ borderColor: accent }} />
          </div>
          <button onClick={stopCamera} className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white"><X className="h-4 w-4" /></button>
        </div>
      )}

      {supportsCamera && !cameraOn && (
        <button
          onClick={startCamera}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
        >
          <Camera className="h-4 w-4" /> Escanear con cámara
        </button>
      )}

      {/* Manual token */}
      <div className="flex gap-2">
        <input
          type="text" placeholder="Pega el código del ticket" value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500 font-mono"
          style={{ borderColor: hexToRgba(accent, 0.3) }}
        />
        <button
          onClick={() => token.trim() && scanMutation.mutate(token.trim())}
          disabled={!token.trim() || scanMutation.isPending}
          className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 disabled:opacity-50"
          style={{ background: hexToRgba(primary, 0.2), color: accent }}
        >
          {scanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
          Validar
        </button>
      </div>

      {/* Scan result */}
      {result && (
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="rounded-xl border p-3 flex items-center gap-3"
          style={{
            borderColor: result.ok ? hexToRgba('#4ade80', 0.5) : hexToRgba('#f87171', 0.5),
            background: result.ok ? hexToRgba('#4ade80', 0.1) : hexToRgba('#f87171', 0.1),
          }}
        >
          {result.ok
            ? <CheckCircle2 className="h-7 w-7 flex-shrink-0" style={{ color: '#4ade80' }} />
            : <AlertTriangle className="h-7 w-7 flex-shrink-0" style={{ color: '#f87171' }} />}
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: result.ok ? '#4ade80' : '#f87171' }}>{result.message}</p>
            {result.pass?.buyerName && <p className="text-xs text-gray-300">{result.pass.buyerName} · {result.pass.tierName || 'Ticket'}</p>}
            {result.checkedInAt && <p className="text-[11px] text-gray-400">Usado: {fmtDate(result.checkedInAt)}</p>}
          </div>
        </motion.div>
      )}

      {/* Security audit + CSV export */}
      <div className="pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSecurity((s) => !s)}
            className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: hexToRgba(primary, 0.08), border: `1px solid ${hexToRgba(accent, 0.2)}` }}
          >
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" style={{ color: accent }} /> Registro de seguridad</span>
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showSecurity ? 'rotate-90' : ''}`} />
          </button>
          <button
            onClick={exportCsv}
            disabled={!(statsQ.data?.passes || []).length}
            className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
            style={{ background: hexToRgba(primary, 0.08), border: `1px solid ${hexToRgba(accent, 0.2)}`, color: accent }}
            title="Exportar manifiesto (CSV)"
          >
            <ExternalLink className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {showSecurity && (
          <div className="mt-2 space-y-2">
            {logsQ.isLoading && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" style={{ color: accent }} /></div>}
            {logsQ.data?.stats && (
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Escaneos', value: logsQ.data.stats.totalScans },
                  { label: 'Admitidos', value: logsQ.data.stats.admitted },
                  { label: 'Duplicados', value: logsQ.data.stats.duplicateAttempts },
                  { label: 'Falsos', value: logsQ.data.stats.forged + logsQ.data.stats.wrong },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg p-1.5 text-center" style={{ background: hexToRgba(primary, 0.05), border: `1px solid ${hexToRgba(accent, 0.15)}` }}>
                    <p className="text-[9px] text-gray-400">{label}</p>
                    <p className="text-sm font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            )}
            {(logsQ.data?.logs || []).length === 0 && !logsQ.isLoading && (
              <p className="text-center text-[11px] text-gray-500 py-2">Sin escaneos registrados todavía.</p>
            )}
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {(logsQ.data?.logs || []).map((l: any) => {
                const good = l.result === 'valid';
                const dup = l.result === 'already_used' || l.result === 'race';
                const color = good ? '#4ade80' : dup ? '#fbbf24' : '#f87171';
                const labelMap: Record<string, string> = {
                  valid: 'Admitido', already_used: 'Ya usado', race: 'Doble puerta', bad_signature: 'Firma falsa',
                  malformed: 'Código inválido', not_found: 'No existe', wrong_artist: 'Otro artista',
                  wrong_event: 'Otro evento', void: 'Anulado', error: 'Error',
                };
                return (
                  <div key={l.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded" style={{ background: hexToRgba(color, 0.08) }}>
                    <span className="truncate text-gray-300">{l.buyerName || l.passCode || '—'}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-semibold" style={{ color }}>{labelMap[l.result] || l.result}</span>
                      <span className="text-gray-500">{fmtDate(l.createdAt)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main widget ────────────────────────────────────────────────────────────

export function ConcertCommandCenter({ artistId, artistName, artistSlug, colors, isOwner: isOwnerProp }: ConcertCommandCenterProps) {
  const primary = hex(colors?.hexPrimary, FALLBACK_PRIMARY);
  const accent = hex(colors?.hexAccent, FALLBACK_ACCENT);
  const border = colors?.hexBorder || hexToRgba(primary, 0.3);
  const qc = useQueryClient();

  const { user } = useAuth();
  const [buyEvent, setBuyEvent] = useState<ConcertEvent | null>(null);
  const [tab, setTab] = useState<'shows' | 'manage' | 'messages' | 'checkin'>('shows');
  const [showTickets, setShowTickets] = useState(false);
  const [successSessionId, setSuccessSessionId] = useState<string | null>(null);
  const [msgEmail, setMsgEmail] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSent, setMsgSent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [showNewEvent, setShowNewEvent] = useState(false);
  // Owner messaging: open thread + reply draft
  const [openThreadId, setOpenThreadId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  // Owner event editing: which event is expanded for tier/publish management
  const [editEventId, setEditEventId] = useState<number | null>(null);
  const [tierDraft, setTierDraft] = useState({ name: '', priceUsd: '', quantityTotal: '' });
  // Manage sub-view: events vs orders/payments
  const [manageView, setManageView] = useState<'events' | 'orders' | 'codes' | 'waitlist' | 'analytics' | 'seatmaps'>('events');
  // Owner discount-code draft
  const [codeDraft, setCodeDraft] = useState({ code: '', kind: 'percent' as 'percent' | 'fixed', amount: '', maxRedemptions: '' });

  // Resolve current user pgId to determine ownership (local heuristic).
  const localIsOwner = useMemo(() => {
    if (!user) return false;
    const userId = (user as any)?.pgId || (user as any)?.id;
    return typeof userId === 'number' ? userId === artistId : false;
  }, [user, artistId]);

  // Public events list (fan view). The backend also reports authoritative ownership.
  const eventsQ = useQuery<{ events: ConcertEvent[]; isOwner: boolean }>({
    queryKey: ['concert-events', artistId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/events`),
    enabled: !!artistId,
  });

  // Ownership = parent profile override OR server signal OR local heuristic.
  // The parent passes isOwnProfile (handles AI-generated artists); the server
  // confirms it on every owner request, so the UI and API stay in sync.
  const isOwner = isOwnerProp === true || eventsQ.data?.isOwner === true || localIsOwner;

  // Owner management dashboard
  const manageQ = useQuery<ManageDashboard>({
    queryKey: ['concert-manage', artistId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/manage`),
    enabled: isOwner && tab === 'manage',
  });

  // Owner threads
  const threadsQ = useQuery<{ threads: any[]; messages: any[] }>({
    queryKey: ['concert-threads', artistId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/threads`),
    enabled: isOwner && tab === 'messages',
  });

  // Owner thread detail (messages of the open thread) — auto-refreshes so the
  // artist sees buyer replies live while the thread is open.
  const threadDetailQ = useQuery<{ threads: any[]; messages: any[] }>({
    queryKey: ['concert-thread', artistId, openThreadId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/threads?threadId=${openThreadId}`),
    enabled: isOwner && tab === 'messages' && openThreadId != null,
    refetchInterval: (q: any) => (q?.state?.data ? 8000 : false),
  });

  // Owner orders / Stripe payments ledger
  const ordersQ = useQuery<{ orders: any[] }>({
    queryKey: ['concert-orders', artistId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/orders`),
    enabled: isOwner && tab === 'manage' && manageView === 'orders',
  });

  // Owner discount / presale codes
  const codesQ = useQuery<{ codes: any[] }>({
    queryKey: ['concert-codes', artistId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/discount-codes`),
    enabled: isOwner && tab === 'manage' && manageView === 'codes',
  });

  // Owner waitlist (sold-out demand)
  const waitlistQ = useQuery<{ total: number; totalDemand: number; byCity: any[]; entries: any[] }>({
    queryKey: ['concert-waitlist', artistId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/waitlist`),
    enabled: isOwner && tab === 'manage' && manageView === 'waitlist',
  });

  // Owner sales analytics
  const analyticsQ = useQuery<{ summary: any; byTier: any[]; byDay: any[]; byDevice: any[]; byCountry: any[] }>({
    queryKey: ['concert-analytics', artistId],
    queryFn: () => apiRequest('GET', `/api/concerts/${artistId}/analytics`),
    enabled: isOwner && tab === 'manage' && manageView === 'analytics',
  });

  // Create event mutation (owner)
  const createEventMutation = useMutation({
    mutationFn: (title: string) =>
      apiRequest('POST', `/api/concerts/${artistId}/events`, { title, status: 'draft' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concert-events', artistId] });
      qc.invalidateQueries({ queryKey: ['concert-manage', artistId] });
      setNewEventTitle('');
      setShowNewEvent(false);
    },
  });

  // Owner replies to a buyer thread
  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest('POST', `/api/concerts/${artistId}/threads/${openThreadId}/reply`, { body }),
    onSuccess: () => {
      setReplyBody('');
      qc.invalidateQueries({ queryKey: ['concert-thread', artistId, openThreadId] });
      qc.invalidateQueries({ queryKey: ['concert-threads', artistId] });
      qc.invalidateQueries({ queryKey: ['concert-manage', artistId] });
    },
  });

  // Publish / unpublish an event (controls whether tickets are on sale)
  const setStatusMutation = useMutation({
    mutationFn: ({ eventId, status }: { eventId: number; status: string }) =>
      apiRequest('PATCH', `/api/concerts/${artistId}/events/${eventId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concert-events', artistId] });
      qc.invalidateQueries({ queryKey: ['concert-manage', artistId] });
    },
  });

  // Add a ticket tier (price + quantity) to an event
  const addTierMutation = useMutation({
    mutationFn: ({ eventId, name, priceUsd, quantityTotal }: { eventId: number; name: string; priceUsd: number; quantityTotal: number | null }) =>
      apiRequest('POST', `/api/concerts/${artistId}/events/${eventId}/tiers`, { name, priceUsd, quantityTotal }),
    onSuccess: () => {
      setTierDraft({ name: '', priceUsd: '', quantityTotal: '' });
      qc.invalidateQueries({ queryKey: ['concert-events', artistId] });
      qc.invalidateQueries({ queryKey: ['concert-manage', artistId] });
    },
  });

  // Delete a ticket tier
  const deleteTierMutation = useMutation({
    mutationFn: (tierId: number) => apiRequest('DELETE', `/api/concerts/${artistId}/tiers/${tierId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concert-events', artistId] });
      qc.invalidateQueries({ queryKey: ['concert-manage', artistId] });
    },
  });

  // Delete an event entirely
  const deleteEventMutation = useMutation({
    mutationFn: (eventId: number) => apiRequest('DELETE', `/api/concerts/${artistId}/events/${eventId}`),
    onSuccess: () => {
      setEditEventId(null);
      qc.invalidateQueries({ queryKey: ['concert-events', artistId] });
      qc.invalidateQueries({ queryKey: ['concert-manage', artistId] });
    },
  });

  // Create a discount / presale code
  const createCodeMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/concerts/${artistId}/discount-codes`, payload),
    onSuccess: () => {
      setCodeDraft({ code: '', kind: 'percent', amount: '', maxRedemptions: '' });
      qc.invalidateQueries({ queryKey: ['concert-codes', artistId] });
    },
  });

  // Delete a discount code
  const deleteCodeMutation = useMutation({
    mutationFn: (codeId: number) => apiRequest('DELETE', `/api/concerts/${artistId}/discount-codes/${codeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['concert-codes', artistId] }),
  });

  // Toggle a discount code active flag
  const toggleCodeMutation = useMutation({
    mutationFn: ({ codeId, isActive }: { codeId: number; isActive: boolean }) =>
      apiRequest('PATCH', `/api/concerts/${artistId}/discount-codes/${codeId}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['concert-codes', artistId] }),
  });

  // Buyer message mutation
  const msgMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', `/api/concerts/${artistId}/messages`, {
        buyerEmail: msgEmail.trim(),
        body: msgBody.trim(),
      }),
    onSuccess: () => {
      setMsgSent(true);
      setMsgBody('');
      setTimeout(() => setMsgSent(false), 3000);
    },
  });

  // Detect the Stripe success redirect (?concert=success&session_id=...) and
  // open the ticket viewer so the buyer immediately sees their QR passes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('concert') === 'success') {
      const sid = params.get('session_id');
      setSuccessSessionId(sid);
      setShowTickets(true);
      // Clean the URL so a refresh doesn't re-trigger the modal.
      params.delete('concert');
      params.delete('session_id');
      const clean = window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
    }
  }, []);

  const events = eventsQ.data?.events || [];
  const publicEvents = events.filter((e) => ['published', 'live'].includes(e.status));
  const showEvents = isOwner ? events : publicEvents;

  const cardBg = hexToRgba(primary, 0.06);
  const cardBorder = hexToRgba(accent, 0.25);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div
        className="relative overflow-hidden rounded-2xl px-4 py-3.5 mb-1"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(primary, 0.22)}, ${hexToRgba(accent, 0.1)} 60%, rgba(10,10,14,0.4))`,
          border: `1px solid ${hexToRgba(accent, 0.28)}`,
        }}
      >
        <div
          className="pointer-events-none absolute -top-10 -right-8 w-40 h-40 rounded-full blur-3xl opacity-40"
          style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
        />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
            >
              <Music2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white leading-tight tracking-tight">Concert Center</h3>
              <p className="text-[11px] text-gray-300/80 truncate">
                {isOwner ? 'Gestiona tus shows, entradas y accesos' : 'Entradas oficiales · QR seguro'}
              </p>
            </div>
          </div>
          {publicEvents.length > 0 && (
            <span
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0 shadow"
              style={{ background: hexToRgba(accent, 0.22), color: accent, border: `1px solid ${hexToRgba(accent, 0.4)}` }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
              {publicEvents.length} {publicEvents.length !== 1 ? 'shows' : 'show'}
            </span>
          )}
        </div>
      </div>

      {/* Tab nav (owner sees extra tabs) */}
      {isOwner && (
        <div className="flex gap-1.5 flex-wrap p-1 rounded-xl" style={{ background: hexToRgba(primary, 0.06), border: `1px solid ${hexToRgba(accent, 0.15)}` }}>
          {(['shows', 'manage', 'checkin', 'messages'] as const).map((t) => {
            const labels: Record<string, string> = { shows: 'Shows', manage: 'Gestión', checkin: 'Puerta', messages: 'Mensajes' };
            const icons: Record<string, any> = { shows: Calendar, manage: DollarSign, checkin: ScanLine, messages: MessageSquare };
            const Icon = icons[t];
            const unread = manageQ.data?.messages?.unread || 0;
            const label = t === 'messages' && unread > 0 ? `Mensajes (${unread})` : labels[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 min-w-[68px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                style={tab === t
                  ? { background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white', boxShadow: `0 4px 14px -6px ${accent}` }
                  : { background: 'transparent', color: '#9ca3af' }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Shows tab (fan + owner) */}
      {(tab === 'shows' || !isOwner) && (
        <div className="space-y-2.5">
          {eventsQ.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: accent }} />
            </div>
          )}

          {!eventsQ.isLoading && showEvents.length === 0 && (
            <div
              className="text-center py-10 px-4 rounded-2xl relative overflow-hidden"
              style={{ background: `radial-gradient(120% 120% at 50% 0%, ${hexToRgba(accent, 0.12)}, rgba(10,10,14,0.5) 60%)`, border: `1px dashed ${hexToRgba(accent, 0.3)}` }}
            >
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: hexToRgba(accent, 0.14), border: `1px solid ${hexToRgba(accent, 0.3)}` }}>
                <Calendar className="h-7 w-7" style={{ color: accent }} />
              </div>
              <p className="text-sm text-white font-semibold">
                {isOwner ? 'Aún no has creado ningún concierto' : 'No hay shows próximos'}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                {isOwner ? 'Crea tu primer evento, define las entradas y empieza a vender con QR seguro.' : 'Vuelve pronto: el artista anunciará aquí sus próximas fechas.'}
              </p>
              {isOwner && (
                <button
                  onClick={() => setTab('manage')}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition-transform hover:scale-[1.03]"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
                >
                  <Plus className="h-4 w-4" /> Crear primer concierto
                </button>
              )}
            </div>
          )}

          {showEvents.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              primary={primary}
              accent={accent}
              border={border}
              onBuy={setBuyEvent}
              isOwner={isOwner}
            />
          ))}

          {/* Fan message button */}
          {!isOwner && publicEvents.length > 0 && (
            <button
              onClick={() => setTab('messages' as any)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-gray-400 border transition-colors hover:border-opacity-60"
              style={{ borderColor: hexToRgba(accent, 0.2) }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Contactar al artista
            </button>
          )}

          {/* Fan: retrieve / view my tickets */}
          {!isOwner && (
            <button
              onClick={() => { setSuccessSessionId(null); setShowTickets(true); }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-colors hover:border-opacity-60"
              style={{ borderColor: hexToRgba(accent, 0.25), color: accent }}
            >
              <QrCode className="h-3.5 w-3.5" />
              Ver mis tickets
            </button>
          )}
        </div>
      )}

      {/* Manage tab (owner) */}
      {tab === 'manage' && isOwner && (
        <div className="space-y-3">
          {/* Revenue KPIs */}
          {manageQ.data && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Órdenes', value: manageQ.data.revenue.completedOrders },
                { label: 'Bruto', value: fmtUSD(manageQ.data.revenue.grossRevenue) },
                { label: 'Neto tuyo', value: fmtUSD(manageQ.data.revenue.netEarnings) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg p-2 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          )}
          {manageQ.data && (
            <p className="text-[10px] text-gray-500 text-center">
              Comisión Boostify: <span style={{ color: accent }}>{manageQ.data.commissionRate}%</span> sobre cada venta · pagos seguros con Stripe
            </p>
          )}

          {/* Sub-view switch: Eventos vs Pagos */}
          <div className="flex gap-1.5 p-1 rounded-lg flex-wrap" style={{ background: hexToRgba(primary, 0.06), border: `1px solid ${hexToRgba(accent, 0.15)}` }}>
            {([['events', 'Eventos', Calendar], ['orders', 'Pagos', DollarSign], ['codes', 'Códigos', Tag], ['waitlist', 'Lista', Users], ['analytics', 'Analítica', BarChart3], ['seatmaps', 'Asientos', LayoutGrid]] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => setManageView(v)}
                className="flex-1 min-w-[64px] px-2 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                style={manageView === v
                  ? { background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }
                  : { background: 'transparent', color: '#9ca3af' }}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          {manageView === 'events' && (
            <>
              {/* New event form */}
              {showNewEvent ? (
                <div className="space-y-2 p-3 rounded-xl border" style={{ borderColor: cardBorder, background: cardBg }}>
                  <p className="text-xs font-semibold text-white">Nuevo concierto</p>
                  <input
                    type="text"
                    placeholder="Título del evento *"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500"
                    style={{ borderColor: hexToRgba(accent, 0.3) }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (newEventTitle.trim()) createEventMutation.mutate(newEventTitle.trim()); }}
                      disabled={!newEventTitle.trim() || createEventMutation.isPending}
                      className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
                    >
                      {createEventMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Crear
                    </button>
                    <button onClick={() => setShowNewEvent(false)} className="px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewEvent(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:opacity-90"
                  style={{
                    background: hexToRgba(primary, 0.12),
                    borderColor: hexToRgba(accent, 0.35),
                    color: accent,
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Nuevo concierto
                </button>
              )}

              {/* Owner events list — each expands to manage tiers + publishing */}
              {manageQ.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>}
              {(manageQ.data?.events || []).map((ev) => {
                const expanded = editEventId === ev.id;
                const onSale = ['published', 'live'].includes(ev.status);
                return (
                  <div key={ev.id} className="rounded-xl border overflow-hidden" style={{ borderColor: cardBorder, background: cardBg }}>
                    <button onClick={() => setEditEventId(expanded ? null : ev.id)} className="w-full flex items-start justify-between gap-2 p-3 text-left">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{ev.title}</p>
                        {ev.startsAt && <p className="text-xs text-gray-400">{fmtDate(ev.startsAt)}</p>}
                        <p className="text-xs text-gray-500">{ev.tiers.length} tier(s) · {ev.tiers.reduce((s: number, t: any) => s + (t.quantitySold || 0), 0)} vendidas</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full border capitalize"
                          style={{ borderColor: hexToRgba(accent, 0.4), color: onSale ? '#4ade80' : '#9ca3af' }}>
                          {ev.status}
                        </span>
                        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-3 pb-3 space-y-2.5 border-t" style={{ borderColor: cardBorder }}>
                        {/* Tier list */}
                        <div className="space-y-1.5 pt-2.5">
                          {ev.tiers.length === 0 && <p className="text-[11px] text-gray-500">Sin tiers. Añade uno con precio para vender entradas.</p>}
                          {ev.tiers.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ background: hexToRgba(primary, 0.08) }}>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{t.name}</p>
                                <p className="text-[10px] text-gray-400">{fmtUSD(t.priceUsd)}{t.quantityTotal != null ? ` · ${t.quantitySold || 0}/${t.quantityTotal}` : ''}</p>
                              </div>
                              <button
                                onClick={() => deleteTierMutation.mutate(t.id)}
                                disabled={deleteTierMutation.isPending}
                                className="p-1.5 rounded-md text-red-400 hover:bg-red-500/15 disabled:opacity-50"
                                title="Eliminar tier"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add tier */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <input
                            type="text"
                            placeholder="Tier"
                            value={tierDraft.name}
                            onChange={(e) => setTierDraft((d) => ({ ...d, name: e.target.value }))}
                            className="px-2 py-1.5 rounded-md text-xs bg-gray-900 border text-white placeholder-gray-500"
                            style={{ borderColor: hexToRgba(accent, 0.3) }}
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="$ USD"
                            value={tierDraft.priceUsd}
                            onChange={(e) => setTierDraft((d) => ({ ...d, priceUsd: e.target.value }))}
                            className="px-2 py-1.5 rounded-md text-xs bg-gray-900 border text-white placeholder-gray-500"
                            style={{ borderColor: hexToRgba(accent, 0.3) }}
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="Cant."
                            value={tierDraft.quantityTotal}
                            onChange={(e) => setTierDraft((d) => ({ ...d, quantityTotal: e.target.value }))}
                            className="px-2 py-1.5 rounded-md text-xs bg-gray-900 border text-white placeholder-gray-500"
                            style={{ borderColor: hexToRgba(accent, 0.3) }}
                          />
                        </div>
                        <button
                          onClick={() => {
                            const name = tierDraft.name.trim() || 'General';
                            const priceUsd = Math.max(0, Number(tierDraft.priceUsd) || 0);
                            const quantityTotal = tierDraft.quantityTotal ? parseInt(tierDraft.quantityTotal, 10) : null;
                            addTierMutation.mutate({ eventId: ev.id, name, priceUsd, quantityTotal });
                          }}
                          disabled={addTierMutation.isPending}
                          className="w-full py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                          style={{ background: hexToRgba(primary, 0.18), color: accent, border: `1px solid ${hexToRgba(accent, 0.3)}` }}
                        >
                          {addTierMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Añadir tier de entrada
                        </button>

                        {/* Publish + delete */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setStatusMutation.mutate({ eventId: ev.id, status: onSale ? 'draft' : 'published' })}
                            disabled={setStatusMutation.isPending}
                            className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                            style={onSale
                              ? { background: hexToRgba(primary, 0.1), color: '#9ca3af', border: `1px solid ${hexToRgba(accent, 0.25)}` }
                              : { background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
                          >
                            {setStatusMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : onSale ? <Eye className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            {onSale ? 'Despublicar' : 'Publicar y poner a la venta'}
                          </button>
                          <button
                            onClick={() => deleteEventMutation.mutate(ev.id)}
                            disabled={deleteEventMutation.isPending}
                            className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/15 disabled:opacity-50"
                            style={{ border: '1px solid rgba(248,113,113,0.35)' }}
                            title="Eliminar evento"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {manageView === 'orders' && (
            <div className="space-y-2">
              {ordersQ.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>}
              {!ordersQ.isLoading && (ordersQ.data?.orders || []).length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">Aún no hay pagos registrados.</p>
              )}
              {(ordersQ.data?.orders || []).map((o: any) => {
                const paid = o.status === 'completed';
                return (
                  <div key={o.id} className="rounded-xl border p-3" style={{ borderColor: cardBorder, background: cardBg }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{o.buyerName || o.buyerEmail}</p>
                        <p className="text-[11px] text-gray-400 truncate">{o.eventTitle || 'Evento'} · {o.quantity} entrada{o.quantity !== 1 ? 's' : ''}</p>
                        {o.createdAt && <p className="text-[10px] text-gray-500">{fmtDate(o.createdAt)}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-white">{fmtUSD(Number(o.subtotal) || 0)}</p>
                        <p className="text-[10px]" style={{ color: '#4ade80' }}>Neto {fmtUSD(Number(o.artistEarning) || 0)}</p>
                        <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border capitalize"
                          style={{ borderColor: hexToRgba(accent, 0.4), color: paid ? '#4ade80' : o.status === 'pending' ? '#fbbf24' : '#9ca3af' }}>
                          {paid ? 'Pagado' : o.status === 'pending' ? 'Pendiente' : o.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Discount / presale codes */}
          {manageView === 'codes' && (
            <div className="space-y-3">
              <div className="space-y-2 p-3 rounded-xl border" style={{ borderColor: cardBorder, background: cardBg }}>
                <p className="text-xs font-semibold text-white flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" style={{ color: accent }} /> Nuevo código promocional</p>
                <input
                  type="text" placeholder="Código (ej. VERANO20)" value={codeDraft.code}
                  onChange={(e) => setCodeDraft((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500"
                  style={{ borderColor: hexToRgba(accent, 0.3) }}
                />
                <div className="grid grid-cols-3 gap-2">
                  <select value={codeDraft.kind} onChange={(e) => setCodeDraft((p) => ({ ...p, kind: e.target.value as any }))}
                    className="px-2 py-2 rounded-lg text-xs bg-gray-900 border text-white" style={{ borderColor: hexToRgba(accent, 0.3) }}>
                    <option value="percent">%</option>
                    <option value="fixed">$ USD</option>
                  </select>
                  <input
                    type="number" placeholder={codeDraft.kind === 'percent' ? '% desc.' : '$ desc.'} value={codeDraft.amount}
                    onChange={(e) => setCodeDraft((p) => ({ ...p, amount: e.target.value }))}
                    className="px-2 py-2 rounded-lg text-xs bg-gray-900 border text-white placeholder-gray-500"
                    style={{ borderColor: hexToRgba(accent, 0.3) }}
                  />
                  <input
                    type="number" placeholder="Máx. usos" value={codeDraft.maxRedemptions}
                    onChange={(e) => setCodeDraft((p) => ({ ...p, maxRedemptions: e.target.value }))}
                    className="px-2 py-2 rounded-lg text-xs bg-gray-900 border text-white placeholder-gray-500"
                    style={{ borderColor: hexToRgba(accent, 0.3) }}
                  />
                </div>
                <button
                  onClick={() => {
                    const amount = parseFloat(codeDraft.amount);
                    if (!codeDraft.code.trim() || !amount || amount <= 0) return;
                    createCodeMutation.mutate({
                      code: codeDraft.code.trim(),
                      kind: codeDraft.kind,
                      amount,
                      maxRedemptions: codeDraft.maxRedemptions ? parseInt(codeDraft.maxRedemptions, 10) : undefined,
                    });
                  }}
                  disabled={createCodeMutation.isPending || !codeDraft.code.trim() || !codeDraft.amount}
                  className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
                >
                  {createCodeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Crear código
                </button>
                {createCodeMutation.isError && <p className="text-[11px] text-red-400">{(createCodeMutation.error as any)?.message || 'No se pudo crear el código'}</p>}
              </div>

              {codesQ.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>}
              {!codesQ.isLoading && (codesQ.data?.codes || []).length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">Aún no has creado códigos.</p>
              )}
              {(codesQ.data?.codes || []).map((c: any) => (
                <div key={c.id} className="rounded-xl border p-3 flex items-center justify-between gap-2" style={{ borderColor: cardBorder, background: cardBg }}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white font-mono truncate">{c.code}</p>
                    <p className="text-[11px] text-gray-400">
                      {c.kind === 'percent' ? `${Number(c.amount)}% de descuento` : `${fmtUSD(Number(c.amount))} de descuento`}
                      {c.maxRedemptions ? ` · ${c.timesRedeemed}/${c.maxRedemptions} usos` : ` · ${c.timesRedeemed} usos`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleCodeMutation.mutate({ codeId: c.id, isActive: !c.isActive })}
                      className="text-[10px] px-2 py-1 rounded-full border"
                      style={{ borderColor: hexToRgba(accent, 0.4), color: c.isActive ? '#4ade80' : '#9ca3af' }}>
                      {c.isActive ? 'Activo' : 'Pausado'}
                    </button>
                    <button onClick={() => deleteCodeMutation.mutate(c.id)} className="text-gray-500 hover:text-red-400">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Waitlist (sold-out demand) */}
          {manageView === 'waitlist' && (
            <div className="space-y-3">
              {waitlistQ.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>}
              {waitlistQ.data && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                      <p className="text-[10px] text-gray-400">En lista</p>
                      <p className="text-sm font-bold text-white">{waitlistQ.data.total}</p>
                    </div>
                    <div className="rounded-lg p-2 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                      <p className="text-[10px] text-gray-400">Entradas demandadas</p>
                      <p className="text-sm font-bold text-white">{waitlistQ.data.totalDemand}</p>
                    </div>
                  </div>
                  {(waitlistQ.data.byCity || []).length > 0 && (
                    <div className="rounded-xl border p-3" style={{ borderColor: cardBorder, background: cardBg }}>
                      <p className="text-xs font-semibold text-white mb-2">Demanda por ciudad</p>
                      {waitlistQ.data.byCity.map((c: any) => (
                        <div key={c.city} className="flex items-center justify-between text-xs text-gray-300 py-0.5">
                          <span className="truncate">{c.city}</span><span className="font-bold" style={{ color: accent }}>{c.demand}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(waitlistQ.data.entries || []).length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-4">Nadie en lista de espera todavía.</p>
                  )}
                  {(waitlistQ.data.entries || []).map((e: any) => (
                    <div key={e.id} className="rounded-lg border p-2.5 flex items-center justify-between gap-2" style={{ borderColor: cardBorder, background: cardBg }}>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{e.name || e.email}</p>
                        <p className="text-[11px] text-gray-400 truncate">{e.city || 'Sin ciudad'} · {e.quantity} entrada{e.quantity !== 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0" style={{ borderColor: hexToRgba(accent, 0.4), color: '#9ca3af' }}>{e.status}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Sales analytics */}
          {manageView === 'analytics' && (
            <div className="space-y-3">
              {analyticsQ.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>}
              {analyticsQ.data && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Entradas vendidas', value: analyticsQ.data.summary.ticketsSold },
                      { label: 'Ingreso bruto', value: fmtUSD(analyticsQ.data.summary.grossRevenue) },
                      { label: 'Neto tuyo', value: fmtUSD(analyticsQ.data.summary.netEarning) },
                      { label: 'Ticket medio', value: fmtUSD(analyticsQ.data.summary.avgOrderValue) },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg p-2 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                        <p className="text-[10px] text-gray-400">{label}</p>
                        <p className="text-sm font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                  {Number(analyticsQ.data.summary.discountTotal) > 0 && (
                    <p className="text-[11px] text-center text-gray-400">Descuentos aplicados: <span style={{ color: accent }}>{fmtUSD(analyticsQ.data.summary.discountTotal)}</span></p>
                  )}
                  {(analyticsQ.data.byTier || []).length > 0 && (
                    <div className="rounded-xl border p-3" style={{ borderColor: cardBorder, background: cardBg }}>
                      <p className="text-xs font-semibold text-white mb-2">Ventas por tipo de entrada</p>
                      {analyticsQ.data.byTier.map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs text-gray-300 py-0.5">
                          <span className="truncate">{t.name} · {t.tickets}</span><span className="font-bold" style={{ color: accent }}>{fmtUSD(t.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(analyticsQ.data.byDevice || []).length > 0 && (
                    <div className="rounded-xl border p-3" style={{ borderColor: cardBorder, background: cardBg }}>
                      <p className="text-xs font-semibold text-white mb-2">Por dispositivo</p>
                      {analyticsQ.data.byDevice.map((d: any) => (
                        <div key={d.device} className="flex items-center justify-between text-xs text-gray-300 py-0.5 capitalize">
                          <span>{d.device}</span><span className="font-bold" style={{ color: accent }}>{d.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {analyticsQ.data.summary.orders === 0 && (
                    <p className="text-center text-sm text-gray-400 py-2">Aún no hay ventas que analizar.</p>
                  )}
                </>
              )}
            </div>
          )}

          {manageView === 'seatmaps' && (
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>}>
              <SeatMapEditor
                artistId={artistId}
                primary={primary}
                accent={accent}
                events={(eventsQ.data?.events || []).map((e: any) => ({ id: e.id, title: e.title, seatingMode: e.seatingMode, venueId: e.venueId }))}
              />
            </Suspense>
          )}
        </div>
      )}

      {/* Messages tab */}
      {tab === 'messages' && (
        <div className="space-y-3">
          {isOwner ? (
            // Owner: thread list → open thread → reply
            openThreadId != null ? (
              <div className="space-y-2.5">
                <button onClick={() => setOpenThreadId(null)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Volver a la bandeja
                </button>
                {(() => {
                  const thread = (threadsQ.data?.threads || []).find((t: any) => t.id === openThreadId);
                  return (
                    <div className="rounded-xl border p-2.5" style={{ borderColor: cardBorder, background: cardBg }}>
                      <p className="text-sm font-semibold text-white truncate">{thread?.buyerName || thread?.buyerEmail || 'Comprador'}</p>
                      {thread?.buyerEmail && <p className="text-[11px] text-gray-400 truncate">{thread.buyerEmail}</p>}
                    </div>
                  );
                })()}
                {/* Message history */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {threadDetailQ.isLoading && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" style={{ color: accent }} /></div>}
                  {(threadDetailQ.data?.messages || []).map((m: any) => {
                    const fromArtist = m.role === 'artist';
                    return (
                      <div key={m.id} className={`flex ${fromArtist ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[80%] rounded-2xl px-3 py-2 text-xs"
                          style={fromArtist
                            ? { background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white', borderBottomRightRadius: 4 }
                            : { background: hexToRgba(primary, 0.1), color: '#e5e7eb', border: `1px solid ${cardBorder}`, borderBottomLeftRadius: 4 }}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          {m.createdAt && <p className="text-[9px] opacity-60 mt-1">{fmtDate(m.createdAt)}</p>}
                        </div>
                      </div>
                    );
                  })}
                  {!threadDetailQ.isLoading && (threadDetailQ.data?.messages || []).length === 0 && (
                    <p className="text-center text-xs text-gray-500 py-4">Sin mensajes.</p>
                  )}
                </div>
                {/* Reply box */}
                <div className="flex items-end gap-2">
                  <textarea
                    placeholder="Escribe tu respuesta..."
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500 resize-none"
                    style={{ borderColor: hexToRgba(accent, 0.3) }}
                  />
                  <button
                    onClick={() => { const b = replyBody.trim(); if (b) replyMutation.mutate(b); }}
                    disabled={replyMutation.isPending || !replyBody.trim()}
                    className="p-2.5 rounded-lg flex-shrink-0 disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
                    title="Enviar respuesta"
                  >
                    {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ) : threadsQ.isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>
            ) : (threadsQ.data?.threads || []).length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">No hay mensajes aún.</p>
            ) : (
              (threadsQ.data?.threads || []).map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setOpenThreadId(t.id)}
                  className="w-full text-left rounded-xl border p-3 space-y-1 transition-colors hover:border-opacity-70"
                  style={{ borderColor: cardBorder, background: cardBg }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-white font-medium truncate">{t.buyerName || t.buyerEmail}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {t.artistUnread > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: hexToRgba(accent, 0.25), color: accent }}>
                          {t.artistUnread} nuevo{t.artistUnread > 1 ? 's' : ''}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  {t.lastMessagePreview && <p className="text-xs text-gray-400 truncate">{t.lastMessagePreview}</p>}
                </button>
              ))
            )
          ) : (
            // Fan sends a message
            msgSent ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="h-8 w-8 mx-auto" style={{ color: '#4ade80' }} />
                <p className="text-sm text-white font-medium">¡Mensaje enviado!</p>
                <p className="text-xs text-gray-400">El artista recibirá tu consulta pronto.</p>
              </div>
            ) : (
              <div className="space-y-2 p-3 rounded-xl border" style={{ borderColor: cardBorder, background: cardBg }}>
                <p className="text-xs font-semibold text-white">Contacta a {artistName}</p>
                <input
                  type="email"
                  placeholder="Tu email *"
                  value={msgEmail}
                  onChange={(e) => setMsgEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500"
                  style={{ borderColor: hexToRgba(accent, 0.3) }}
                />
                <textarea
                  placeholder="Tu mensaje..."
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500 resize-none"
                  style={{ borderColor: hexToRgba(accent, 0.3) }}
                />
                <button
                  onClick={() => msgMutation.mutate()}
                  disabled={msgMutation.isPending || !msgEmail.trim() || !msgBody.trim()}
                  className="w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
                >
                  {msgMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Buy modal */}
      <AnimatePresence>
        {buyEvent && (
          <BuyTicketModal
            event={buyEvent}
            artistId={artistId}
            artistSlug={artistSlug}
            artistName={artistName}
            primary={primary}
            accent={accent}
            border={border}
            onClose={() => setBuyEvent(null)}
          />
        )}
      </AnimatePresence>

      {/* My tickets / post-purchase QR modal */}
      <AnimatePresence>
        {showTickets && (
          <MyTicketsModal
            artistId={artistId}
            sessionId={successSessionId}
            primary={primary}
            accent={accent}
            onClose={() => { setShowTickets(false); setSuccessSessionId(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default ConcertCommandCenter;
