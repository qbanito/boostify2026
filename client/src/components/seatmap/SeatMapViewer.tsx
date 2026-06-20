// ─────────────────────────────────────────────────────────────────────────
// SeatMapViewer — interactive buyer seat picker (Live Ticketing Engine)
// ─────────────────────────────────────────────────────────────────────────
// Renders an event's reserved-seating map as a zoomable SVG. The buyer taps
// available seats/tables, then reserves them for 10 minutes (a transactional
// server hold that prevents double-selling). On reserve, it reports the
// holdToken + selected seats up to the checkout modal, which then takes payment.
//
// Seat states (color-coded): available · selected · held (someone else) · sold ·
// blocked. Only available seats are clickable. Works on mobile (pinch-free zoom
// buttons + scrollable canvas) and desktop.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Loader2, ZoomIn, ZoomOut, Maximize2, Ticket, Clock, Sparkles, Check, Armchair } from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';

export interface SeatMapSeat {
  id: number;
  sectionId: number;
  kind: 'seat' | 'table';
  label: string;
  rowLabel?: string | null;
  seatNumber?: string | null;
  capacity: number;
  x: number;
  y: number;
  status: 'available' | 'held' | 'sold' | 'blocked';
  price: number;
}
export interface SeatMapSection {
  id: number;
  name: string;
  kind: 'seats' | 'tables' | 'ga';
  color: string;
  defaultPrice: number;
  x: number;
  y: number;
}
export interface HeldSeat { seatId: number; label: string; price: number }

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export function SeatMapViewer({
  eventId,
  email,
  primary,
  accent,
  maxSeats = 10,
  onReserved,
  onClear,
  onNotReserved,
}: {
  eventId: number;
  email: string;
  primary: string;
  accent: string;
  maxSeats?: number;
  onReserved: (data: { holdToken: string; seats: HeldSeat[]; total: number; expiresAt: string }) => void;
  onClear: () => void;
  onNotReserved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [reserved, setReserved] = useState(true);
  const [seats, setSeats] = useState<SeatMapSeat[]>([]);
  const [sections, setSections] = useState<SeatMapSection[]>([]);
  const [canvas, setCanvas] = useState({ width: 1000, height: 700, stageLabel: 'STAGE' });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [holding, setHolding] = useState(false);
  const [holdInfo, setHoldInfo] = useState<{ token: string; expiresAt: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hover, setHover] = useState<SeatMapSeat | null>(null);
  const [qty, setQty] = useState(2);

  // pan + zoom view state
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ active: boolean; moved: boolean; x: number; y: number; tx: number; ty: number }>({ active: false, moved: false, x: 0, y: 0, tx: 0, ty: 0 });
  const pinch = useRef<{ dist: number; z: number } | null>(null);

  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data: any = await apiRequest('GET', `/api/seat-map/events/${eventId}/seatmap`);
      if (!data?.reserved) { setReserved(false); onNotReserved?.(); return; }
      setReserved(true);
      setSeats(data.seats || []);
      setSections(data.sections || []);
      setCanvas({
        width: data.venue?.canvasWidth || 1000,
        height: data.venue?.canvasHeight || 700,
        stageLabel: data.venue?.stageLabel || 'STAGE',
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load the seat map');
    } finally {
      setLoading(false);
    }
  }, [eventId, onNotReserved]);

  useEffect(() => { load(); }, [load]);

  // Fit the map to the viewport once it loads.
  useEffect(() => {
    if (!seats.length || !wrapRef.current) return;
    const w = wrapRef.current.clientWidth || 600;
    const fit = clamp(w / canvas.width, 0.5, 1.4);
    setView({ z: fit, tx: (w - canvas.width * fit) / 2, ty: 0 });
  }, [seats.length, canvas.width]);

  // Hold countdown timer.
  useEffect(() => {
    if (!holdInfo) return;
    const tick = () => {
      const ms = new Date(holdInfo.expiresAt).getTime() - Date.now();
      const s = Math.max(0, Math.floor(ms / 1000));
      setSecondsLeft(s);
      if (s <= 0) { setHoldInfo(null); onClear(); load(); }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [holdInfo, onClear, load]);

  // ── section availability + price range (for the legend) ────────────────────
  const sectionStats = useMemo(() => {
    const m = new Map<number, { available: number; min: number; max: number }>();
    for (const s of seats) {
      const cur = m.get(s.sectionId) || { available: 0, min: Infinity, max: 0 };
      if (s.status === 'available') cur.available += 1;
      cur.min = Math.min(cur.min, s.price);
      cur.max = Math.max(cur.max, s.price);
      m.set(s.sectionId, cur);
    }
    return m;
  }, [seats]);

  const selectedSeats = useMemo(() => seats.filter((s) => selected.has(s.id)), [seats, selected]);
  const total = useMemo(() => selectedSeats.reduce((sum, s) => sum + s.price, 0), [selectedSeats]);

  const toggleSeat = (seat: SeatMapSeat) => {
    if (seat.status !== 'available' || holdInfo) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else {
        if (next.size >= maxSeats) { setError(`Up to ${maxSeats} seats per order`); return prev; }
        next.add(seat.id); setError('');
      }
      return next;
    });
  };

  // ── "Find best seats" — prefers contiguous seats near the stage/center ─────
  const findBestSeats = () => {
    if (holdInfo) return;
    const n = clamp(qty, 1, maxSeats);
    const avail = seats.filter((s) => s.status === 'available' && s.kind === 'seat');
    if (avail.length < n) {
      const cheap = [...seats.filter((s) => s.status === 'available')].sort((a, b) => a.price - b.price).slice(0, n);
      if (!cheap.length) { setError('No available seats right now'); return; }
      setSelected(new Set(cheap.map((s) => s.id))); setError('');
      return;
    }
    const centerX = canvas.width / 2;
    const rows = new Map<string, SeatMapSeat[]>();
    for (const s of avail) {
      const key = `${s.sectionId}|${s.rowLabel ?? Math.round(s.y / 24)}`;
      (rows.get(key) || rows.set(key, []).get(key)!).push(s);
    }
    let best: { seats: SeatMapSeat[]; score: number } | null = null;
    for (const list of rows.values()) {
      list.sort((a, b) => a.x - b.x);
      for (let i = 0; i + n <= list.length; i++) {
        const run = list.slice(i, i + n);
        const contiguous = run.every((s, k) => k === 0 || Math.abs(s.x - run[k - 1].x) < 44);
        if (!contiguous) continue;
        const avgY = run.reduce((a, s) => a + s.y, 0) / n;
        const avgX = run.reduce((a, s) => a + s.x, 0) / n;
        const score = avgY + Math.abs(avgX - centerX) * 0.4;
        if (!best || score < best.score) best = { seats: run, score };
      }
    }
    if (!best) {
      const ranked = [...avail].sort((a, b) => (a.y - b.y) || (Math.abs(a.x - centerX) - Math.abs(b.x - centerX))).slice(0, n);
      best = { seats: ranked, score: 0 };
    }
    setSelected(new Set(best.seats.map((s) => s.id)));
    setError('');
    const cx = best.seats.reduce((a, s) => a + s.x, 0) / best.seats.length;
    const cy = best.seats.reduce((a, s) => a + s.y, 0) / best.seats.length;
    const w = wrapRef.current?.clientWidth || 600;
    const h = 380;
    setView((v) => { const z = Math.max(v.z, 1); return { z, tx: w / 2 - cx * z, ty: h / 2 - cy * z }; });
  };

  const reserveSeats = async () => {
    if (!selected.size) { setError('Select at least one seat'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email above first'); return; }
    setHolding(true); setError('');
    try {
      const data: any = await apiRequest('POST', `/api/seat-map/events/${eventId}/hold`, { email: email.trim(), seatIds: Array.from(selected) });
      if (data?.success) {
        setHoldInfo({ token: data.holdToken, expiresAt: data.expiresAt });
        onReserved({ holdToken: data.holdToken, seats: data.seats, total: data.total, expiresAt: data.expiresAt });
      } else setError(data?.error || 'Could not reserve those seats');
    } catch (e: any) {
      setError(e?.message || 'Those seats were just taken — please pick again');
      await load(); setSelected(new Set());
    } finally { setHolding(false); }
  };

  const releaseHold = async () => {
    if (!holdInfo) return;
    try { await apiRequest('POST', `/api/seat-map/events/${eventId}/release`, { holdToken: holdInfo.token }); } catch { /* ignore */ }
    setHoldInfo(null); setSelected(new Set()); onClear(); await load();
  };

  // ── pan / zoom handlers ────────────────────────────────────────────────────
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const z = clamp(+(v.z * factor).toFixed(3), 0.4, 3);
      const rect = wrapRef.current?.getBoundingClientRect();
      const px = cx != null && rect ? cx - rect.left : (rect ? rect.width / 2 : 0);
      const py = cy != null && rect ? cy - rect.top : 190;
      const k = z / v.z;
      return { z, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
    });
  };
  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX, e.clientY); };
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset?.seat) return; // let seat clicks through
    drag.current = { active: true, moved: false, x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    setView((v) => ({ ...v, tx: drag.current.tx + dx, ty: drag.current.ty + dy }));
  };
  const onPointerUp = () => { drag.current.active = false; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch.current) {
        const factor = dist / pinch.current.dist;
        const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
        zoomAt(factor, mx, my);
        pinch.current.dist = dist;
      } else pinch.current = { dist, z: view.z };
    }
  };
  const onTouchEnd = () => { pinch.current = null; };

  const seatFill = (seat: SeatMapSeat): string => {
    if (selected.has(seat.id)) return accent;
    if (seat.status === 'sold') return '#2b2b31';
    if (seat.status === 'held') return '#4b4b55';
    if (seat.status === 'blocked') return '#1f1f24';
    return sectionById.get(seat.sectionId)?.color || primary;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading seat map…
      </div>
    );
  }
  if (!reserved) return null;
  if (!seats.length) return <p className="text-xs text-gray-400 py-4 text-center">This event has no seat map yet.</p>;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="space-y-3 select-none">
      {/* Header + best-seats */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>Choose your seats</span>
        {!holdInfo && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              <button type="button" onClick={() => setQty((q) => clamp(q - 1, 1, maxSeats))} className="w-6 h-7 text-gray-300 hover:text-white">−</button>
              <span className="w-5 text-center text-xs font-bold text-white">{qty}</span>
              <button type="button" onClick={() => setQty((q) => clamp(q + 1, 1, maxSeats))} className="w-6 h-7 text-gray-300 hover:text-white">+</button>
            </div>
            <button type="button" onClick={findBestSeats}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
              style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: '#fff' }}>
              <Sparkles className="h-3.5 w-3.5" /> Best seats
            </button>
          </div>
        )}
      </div>

      {/* Section price legend */}
      <div className="flex flex-wrap gap-1.5">
        {sections.filter((s) => s.kind !== 'ga').map((s) => {
          const st = sectionStats.get(s.id);
          const price = st && st.min !== Infinity ? (st.min === st.max ? fmtUSD(st.min) : `${fmtUSD(st.min)}–${fmtUSD(st.max)}`) : fmtUSD(s.defaultPrice);
          return (
            <div key={s.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-gray-200 font-semibold">{s.name}</span>
              <span className="text-gray-400">{price}</span>
              {st && <span className="text-gray-500">· {st.available} left</span>}
            </div>
          );
        })}
      </div>

      {/* Map canvas — drag to pan, wheel/pinch to zoom */}
      <div
        ref={wrapRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative rounded-2xl border overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          borderColor: 'rgba(255,255,255,0.08)', height: 380, touchAction: 'none',
          background: 'radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.05), rgba(0,0,0,0) 60%), #0a0a0f',
        }}
      >
        <svg width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="stageGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
              <stop offset="100%" stopColor={primary} stopOpacity="0.12" />
            </linearGradient>
            <radialGradient id="selGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform={`translate(${view.tx},${view.ty}) scale(${view.z})`}>
            {/* Stage */}
            <path d={`M ${canvas.width * 0.22} 44 Q ${canvas.width / 2} 6 ${canvas.width * 0.78} 44 L ${canvas.width * 0.74} 50 Q ${canvas.width / 2} 18 ${canvas.width * 0.26} 50 Z`} fill="url(#stageGrad)" />
            <text x={canvas.width / 2} y={38} textAnchor="middle" fill="#e9e9f1" fontSize={16} fontWeight={800} letterSpacing={6}>{canvas.stageLabel}</text>

            {/* GA areas */}
            {sections.filter((s) => s.kind === 'ga').map((s) => (
              <g key={`ga-${s.id}`}>
                <rect x={s.x} y={s.y} width={Math.min(360, canvas.width * 0.4)} height={70} rx={12} fill={s.color} opacity={0.16} stroke={s.color} strokeOpacity={0.4} />
                <text x={s.x + 12} y={s.y + 30} fill={s.color} fontSize={13} fontWeight={800}>{s.name}</text>
                <text x={s.x + 12} y={s.y + 48} fill="#cbd5e1" fontSize={11}>General admission · {fmtUSD(s.defaultPrice)}</text>
              </g>
            ))}

            {/* Section labels */}
            {sections.filter((s) => s.kind !== 'ga').map((s) => (
              <text key={`sec-${s.id}`} x={s.x} y={s.y} fill={s.color} fontSize={13} fontWeight={800} opacity={0.9}>{s.name}</text>
            ))}

            {/* Selected glow halos */}
            {selectedSeats.map((s) => <circle key={`g-${s.id}`} cx={s.x} cy={s.y} r={18} fill="url(#selGlow)" pointerEvents="none" />)}

            {/* Seats */}
            {seats.map((seat) => {
              const isSel = selected.has(seat.id);
              const clickable = seat.status === 'available' && !holdInfo;
              const fill = seatFill(seat);
              const common = {
                'data-seat': '1',
                onClick: () => clickable && toggleSeat(seat),
                onMouseEnter: () => setHover(seat),
                onMouseLeave: () => setHover((h) => (h?.id === seat.id ? null : h)),
                style: { cursor: clickable ? 'pointer' as const : 'not-allowed' as const, transition: 'opacity .12s' },
              };
              if (seat.kind === 'table') {
                return (
                  <g key={seat.id} {...common}>
                    <rect data-seat="1" x={seat.x - 16} y={seat.y - 16} width={32} height={32} rx={9} fill={fill}
                      stroke={isSel ? '#fff' : 'rgba(0,0,0,0.3)'} strokeWidth={isSel ? 2.5 : 1} opacity={seat.status === 'blocked' ? 0.5 : 1} />
                    <text data-seat="1" x={seat.x} y={seat.y + 4} textAnchor="middle" fill={isSel ? '#0b0b12' : 'rgba(0,0,0,0.7)'} fontSize={9} fontWeight={800}>
                      {seat.seatNumber || seat.label?.replace(/\D/g, '') || 'T'}
                    </text>
                  </g>
                );
              }
              return (
                <circle key={seat.id} data-seat="1" cx={seat.x} cy={seat.y} r={isSel ? 9.5 : 8} fill={fill}
                  stroke={isSel ? '#fff' : 'rgba(0,0,0,0.4)'} strokeWidth={isSel ? 2.5 : 1}
                  opacity={seat.status === 'sold' || seat.status === 'blocked' ? 0.55 : 1} {...common}>
                  <title>{`${seat.label} · ${fmtUSD(seat.price)} · ${seat.status}`}</title>
                </circle>
              );
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hover && (
          <div className="absolute top-2 left-2 px-2.5 py-1.5 rounded-lg text-[11px] pointer-events-none" style={{ background: 'rgba(0,0,0,0.85)', border: `1px solid ${hexToRgba(accent, 0.4)}` }}>
            <span className="font-bold text-white">{hover.label}</span>
            <span className="text-gray-300"> · {sectionById.get(hover.sectionId)?.name}</span>
            <span style={{ color: accent }}> · {fmtUSD(hover.price)}</span>
            {hover.status !== 'available' && <span className="text-red-300"> · {hover.status === 'sold' ? 'sold' : hover.status === 'held' ? 'taken' : 'n/a'}</span>}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <button type="button" onClick={() => zoomAt(1.2)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-200" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}><ZoomIn className="h-4 w-4" /></button>
          <button type="button" onClick={() => { const w = wrapRef.current?.clientWidth || 600; const fit = clamp(w / canvas.width, 0.5, 1.4); setView({ z: fit, tx: (w - canvas.width * fit) / 2, ty: 0 }); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-200" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}><Maximize2 className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => zoomAt(0.83)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-200" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}><ZoomOut className="h-4 w-4" /></button>
        </div>

        {/* status legend */}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-gray-400 pr-12">
          <Legend color={accent} label="Selected" />
          <Legend color="#4b4b55" label="Taken" />
          <Legend color="#2b2b31" label="Sold" />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Cart / hold summary */}
      {holdInfo ? (
        <div className="rounded-2xl border p-3" style={{ borderColor: hexToRgba(accent, 0.35), background: hexToRgba(accent, 0.06) }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" style={{ color: accent }} /> Seats held — {mm}:{ss}
            </span>
            <button type="button" onClick={releaseHold} className="text-[11px] text-gray-300 underline hover:text-white">Change seats</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedSeats.map((s) => (
              <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <Check className="h-2.5 w-2.5" />{s.label} · {fmtUSD(s.price)}
              </span>
            ))}
          </div>
          <p className="text-sm font-bold mt-2" style={{ color: accent }}>Total: {fmtUSD(total)} — continue below to pay</p>
        </div>
      ) : selected.size > 0 ? (
        <div className="rounded-2xl border p-3 flex items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1 mb-1">
              {selectedSeats.slice(0, 6).map((s) => (
                <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: hexToRgba(accent, 0.15), color: accent }}>{s.label}</span>
              ))}
              {selectedSeats.length > 6 && <span className="text-[10px] text-gray-400">+{selectedSeats.length - 6}</span>}
            </div>
            <span className="text-xs text-gray-300"><span className="font-bold text-white">{selected.size}</span> seat{selected.size > 1 ? 's' : ''} · <span className="font-bold" style={{ color: accent }}>{fmtUSD(total)}</span></span>
          </div>
          <button type="button" onClick={reserveSeats} disabled={holding}
            className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-60 flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: '#fff' }}>
            {holding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            Reserve {selected.size}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1.5">
          <Armchair className="h-3.5 w-3.5" /> Tap a seat or use <span style={{ color: accent }} className="font-semibold">Best seats</span> to auto-pick.
        </p>
      )}
    </div>
  );
}

function hexToRgba(h: string, a: number) {
  const c = (h || '#7c3aed').replace('#', '');
  const f = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  return `rgba(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)},${a})`;
}
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export default SeatMapViewer;
