// ─────────────────────────────────────────────────────────────────────────
// TicketCheckoutModal — STANDALONE Ticketing / Shows module
// ─────────────────────────────────────────────────────────────────────────
// This is the independent ticket-sales module for an artist's shows.
// It sells ONLY event tickets: date, QR pass, secure Stripe payment and the
// admin-controlled platform commission (20% by default).
//
// IMPORTANT — keep this SEPARATE from the Concert Command Center:
//   • This module  = sell tickets for a show (entradas).
//   • Concert Command Center = a higher-level CONNECTOR that monetizes a full
//     event by linking ticket sales + merchandise + streaming + fan club.
// That is why this modal intentionally has NO merch / add-on upsell. The
// merchandise cross-sell lives in the Concert Command Center connector, not
// here. Both flows share the same hardened payment backend
// (/api/concerts/:artistId/checkout) but this module never sends `addons`.
// ─────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { X, Ticket, Loader2, Info } from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';
import { SeatMapViewer, type HeldSeat } from '../seatmap/SeatMapViewer';

export interface ShowTier {
  id: number;
  name: string;
  description?: string;
  priceUsd: number;
  quantityTotal?: number;
  remaining?: number;
  perks?: string[];
}

export interface ShowEvent {
  id: number;
  title: string;
  description?: string;
  type?: 'in_person' | 'online' | 'hybrid';
  status: 'draft' | 'published' | 'live' | 'ended' | 'cancelled';
  startsAt?: string;
  venue?: string;
  location?: string;
  posterUrl?: string;
  tiers: ShowTier[];
  seatingMode?: 'general' | 'reserved';
  refundPolicy?: string | null;
  refundPolicyType?: string;
  // The ticketing module only knows about an optional external ticket link.
  // Merch add-ons deliberately live in the Concert Command Center connector.
  linkedModules?: { externalTicketUrl?: string; [k: string]: any } | null;
}

function hexToRgba(h: string, a: number) {
  const c = (h || '#9333ea').replace('#', '');
  return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${a})`;
}
function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}
function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TicketCheckoutModal({
  event,
  artistId,
  artistName,
  primary,
  accent,
  onClose,
}: {
  event: ShowEvent;
  artistId: number;
  artistSlug?: string;
  artistName?: string;
  primary: string;
  accent: string;
  border?: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [error, setError] = useState('');
  // Reserved seating: null = still detecting, true = seat map, false = GA tiers.
  const [reservedMode, setReservedMode] = useState<boolean | null>(
    event.seatingMode === 'reserved' ? true : event.seatingMode === 'general' ? false : null,
  );
  const [seatHold, setSeatHold] = useState<{ holdToken: string; seats: HeldSeat[]; total: number; expiresAt: string } | null>(null);

  const activeTiers = (event.tiers || []).filter((t) => t.priceUsd > 0 && t.remaining !== 0);
  const tierSubtotal = activeTiers.reduce((s, t) => s + (t.priceUsd * (quantities[t.id] || 0)), 0);
  const tierCount = Object.values(quantities).reduce((s, n) => s + (n || 0), 0);
  const subtotal = seatHold ? seatHold.total : tierSubtotal;
  const ticketCount = seatHold ? seatHold.seats.length : tierCount;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      // Reserved seating: send the held seat ids + hold token instead of tiers.
      if (seatHold) {
        return apiRequest('POST', `/api/concerts/${artistId}/checkout`, {
          eventId: event.id,
          buyerEmail: email.trim(),
          buyerName: name.trim() || undefined,
          buyerPhone: phone.trim() || undefined,
          buyerCity: city.trim() || undefined,
          marketingOptIn,
          policyAccepted,
          seatIds: seatHold.seats.map((s) => s.seatId),
          holdToken: seatHold.holdToken,
        });
      }
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([tierId, quantity]) => ({ tierId: parseInt(tierId, 10), quantity }));
      // NOTE: no `addons` field — this is the ticketing module, not the connector.
      return apiRequest('POST', `/api/concerts/${artistId}/checkout`, {
        eventId: event.id,
        buyerEmail: email.trim(),
        buyerName: name.trim() || undefined,
        buyerPhone: phone.trim() || undefined,
        buyerCity: city.trim() || undefined,
        marketingOptIn,
        policyAccepted,
        items,
      });
    },
    onSuccess: (data: any) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err: any) => setError(err?.message || 'Error al procesar el pago'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email válido requerido');
      return;
    }
    if (!name.trim()) { setError('Tu nombre es obligatorio'); return; }
    if (!phone.trim() || phone.trim().replace(/\D/g, '').length < 6) { setError('Un teléfono válido es obligatorio'); return; }
    if (reservedMode && !seatHold) { setError('Reserva tus asientos antes de pagar'); return; }
    if (ticketCount <= 0 || subtotal <= 0) {
      setError('Selecciona al menos un ticket');
      return;
    }
    if (!policyAccepted) { setError('Debes aceptar la política de reembolso y los términos'); return; }
    checkoutMutation.mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border p-5 space-y-4"
        style={{ background: '#0f0f12', borderColor: hexToRgba(accent, 0.4) }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Ticket className="h-3.5 w-3.5" style={{ color: accent }} />
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
                Tickets · QR · pago seguro
              </span>
            </div>
            <h3 className="text-white font-bold text-base">{event.title}</h3>
            {event.startsAt && <p className="text-xs text-gray-400">{fmtDate(event.startsAt)}</p>}
            {(event.venue || event.location) && (
              <p className="text-xs text-gray-500">{[event.venue, event.location].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Tu email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500"
            style={{ borderColor: hexToRgba(accent, 0.3) }}
          />

          {reservedMode !== false ? (
            <SeatMapViewer
              eventId={event.id}
              email={email}
              primary={primary}
              accent={accent}
              onReserved={(d) => { setSeatHold(d); setReservedMode(true); }}
              onClear={() => setSeatHold(null)}
              onNotReserved={() => setReservedMode(false)}
            />
          ) : (
            <>
              {activeTiers.length === 0 && (
                <p className="text-xs text-gray-400">No hay entradas disponibles para este show ahora mismo.</p>
              )}

              {activeTiers.map((tier) => (
                <div key={tier.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: hexToRgba(accent, 0.25), background: hexToRgba(primary, 0.08) }}>
                  <div>
                    <p className="text-sm text-white font-medium">{tier.name}</p>
                    {tier.description && <p className="text-xs text-gray-400">{tier.description}</p>}
                    <p className="text-xs font-bold mt-0.5" style={{ color: accent }}>{fmtUSD(tier.priceUsd)}</p>
                    {typeof tier.remaining === 'number' && tier.remaining <= 10 && tier.remaining > 0 && (
                      <p className="text-[10px] text-amber-400 mt-0.5">Solo quedan {tier.remaining}</p>
                    )}
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
            </>
          )}

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
              className="mt-0.5 h-3.5 w-3.5 rounded" style={{ accentColor: accent }} />
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

          <button
            type="submit"
            disabled={checkoutMutation.isPending || subtotal <= 0}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}
          >
            {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            {subtotal > 0 ? `Pagar ${fmtUSD(subtotal)}` : 'Selecciona tickets'}
          </button>

          <p className="text-[10px] text-gray-500 text-center leading-snug">
            Recibirás tu entrada con código QR por email tras el pago seguro.
          </p>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default TicketCheckoutModal;
