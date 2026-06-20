// ─────────────────────────────────────────────────────────────────────────
// SeatMapEditor — owner venue & seat-map builder (Live Ticketing Engine)
// ─────────────────────────────────────────────────────────────────────────
// Lets an artist/promoter build a reusable VENUE with pricing SECTIONS (blocks
// of seats, groups of tables, or general-admission areas), auto-generate seat
// grids, preview the layout, save it, and attach it to an event to turn that
// event into Ticketmaster-style reserved seating.
//
// Phase 1 is form-driven (rows × columns auto-layout + per-section position)
// with a live SVG preview, which is fast to use and avoids a heavy drag editor.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, Trash2, Grid3x3, Save, MapPin, Link2, Unlink, Upload, FileDown, X,
} from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';
import { parseSeatMapImport, CSV_TEMPLATE, JSON_TEMPLATE, type ImportResult } from './importSeatMap';

type SectionKind = 'seats' | 'tables' | 'ga';
interface DraftSection {
  tempId: string;
  id?: number;
  name: string;
  kind: SectionKind;
  color: string;
  defaultPrice: number;
  gaCapacity: number;
  tableSeats: number;
  x: number;
  y: number;
  // builder-only grid params
  rows: number;
  cols: number;
  startRow: string;   // "A"
  startNumber: number;
}
interface DraftSeat {
  sectionTempId: string;
  kind: 'seat' | 'table';
  rowLabel?: string;
  seatNumber?: string;
  label: string;
  capacity: number;
  x: number;
  y: number;
  priceOverride?: number | null;
  isBlocked?: boolean;
}
interface VenueSummary {
  id: number;
  name: string;
  city?: string | null;
  sections: number;
  seats: number;
  capacity: number;
}
interface EventLite { id: number; title: string; seatingMode?: string; venueId?: number | null }

const PALETTE = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#a855f7'];
const SPACING_X = 28;
const SPACING_Y = 30;

function uid() { return Math.random().toString(36).slice(2, 9); }
function letterFor(start: string, offset: number): string {
  const base = (start || 'A').toUpperCase().charCodeAt(0) - 65;
  const idx = base + offset;
  if (idx < 26) return String.fromCharCode(65 + idx);
  return String.fromCharCode(65 + Math.floor(idx / 26) - 1) + String.fromCharCode(65 + (idx % 26));
}
function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function hexToRgba(h: string, a: number) {
  const c = (h || '#7c3aed').replace('#', '');
  const f = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  return `rgba(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)},${a})`;
}

/** Generate the seats for one section using its grid params + position. */
function generateSeats(section: DraftSection): DraftSeat[] {
  if (section.kind === 'ga') return [];
  const out: DraftSeat[] = [];
  const rows = Math.max(1, Math.min(40, section.rows));
  const cols = Math.max(1, Math.min(40, section.cols));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (section.kind === 'tables') {
        const n = r * cols + c + 1;
        out.push({
          sectionTempId: section.tempId, kind: 'table',
          label: `${section.name} T${n}`, seatNumber: String(n), capacity: section.tableSeats,
          x: section.x + c * (SPACING_X + 12), y: section.y + 14 + r * (SPACING_Y + 12),
        });
      } else {
        const rowLabel = letterFor(section.startRow, r);
        const seatNumber = String(section.startNumber + c);
        out.push({
          sectionTempId: section.tempId, kind: 'seat',
          rowLabel, seatNumber, label: `${rowLabel}${seatNumber}`, capacity: 1,
          x: section.x + c * SPACING_X, y: section.y + 14 + r * SPACING_Y,
        });
      }
    }
  }
  return out;
}

export function SeatMapEditor({
  artistId,
  primary,
  accent,
  events = [],
}: {
  artistId: number;
  primary: string;
  accent: string;
  events?: EventLite[];
}) {
  const qc = useQueryClient();
  const [activeVenueId, setActiveVenueId] = useState<number | null>(null);
  const [draftMeta, setDraftMeta] = useState({ name: '', address: '', city: '', country: '', stageLabel: 'STAGE', canvasWidth: 1000, canvasHeight: 700 });
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [seatsBySection, setSeatsBySection] = useState<Record<string, DraftSeat[]>>({});
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [attachEventId, setAttachEventId] = useState<number | ''>('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const flash = (ok: boolean, msg: string) => { (ok ? setNote : setError)(msg); (ok ? setError : setNote)(''); setTimeout(() => { setNote(''); setError(''); }, 4000); };

  // Import a venue from a JSON or CSV theater export → fills the draft (the user
  // reviews the preview, then Saves through the existing validated PUT path).
  const applyImport = (text: string) => {
    try {
      const r: ImportResult = parseSeatMapImport(text);
      setActiveVenueId(null); // imported maps save as a NEW venue
      setDraftMeta((m) => ({
        ...m,
        name: r.meta.name || m.name || 'Imported venue',
        city: r.meta.city || m.city,
        country: r.meta.country || m.country,
        address: r.meta.address || m.address,
        stageLabel: r.meta.stageLabel || m.stageLabel,
        canvasWidth: r.meta.canvasWidth,
        canvasHeight: r.meta.canvasHeight,
      }));
      setSections(r.sections as unknown as DraftSection[]);
      setSeatsBySection(r.seatsBySection as unknown as Record<string, DraftSeat[]>);
      setShowImport(false);
      setImportText('');
      flash(true, `Imported ${r.stats.seats} seats across ${r.stats.sections} section${r.stats.sections !== 1 ? 's' : ''}. Review and Save.`);
    } catch (e: any) {
      flash(false, e?.message || 'Could not parse that file');
    }
  };

  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => applyImport(String(reader.result || ''));
    reader.onerror = () => flash(false, 'Could not read the file');
    reader.readAsText(file);
  };

  const downloadTemplate = (kind: 'csv' | 'json') => {
    const blob = new Blob([kind === 'csv' ? CSV_TEMPLATE : JSON_TEMPLATE], { type: kind === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `boostify-seatmap-template.${kind}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };


  // Venues list
  const venuesQ = useQuery({
    queryKey: ['seatmap-venues', artistId],
    queryFn: async () => {
      const data: any = await apiRequest('GET', `/api/seat-map/${artistId}/venues`);
      return (data?.venues || []) as VenueSummary[];
    },
  });

  const loadVenue = useCallback(async (venueId: number) => {
    setError(''); setNote('');
    try {
      const data: any = await apiRequest('GET', `/api/seat-map/${artistId}/venues/${venueId}`);
      const v = data.venue;
      setActiveVenueId(venueId);
      setDraftMeta({
        name: v.name || '', address: v.address || '', city: v.city || '', country: v.country || '',
        stageLabel: v.stageLabel || 'STAGE', canvasWidth: v.canvasWidth || 1000, canvasHeight: v.canvasHeight || 700,
      });
      // Rebuild draft sections + seats from persisted rows.
      const secs: DraftSection[] = (data.sections || []).map((s: any) => ({
        tempId: `db${s.id}`, id: s.id, name: s.name, kind: s.kind, color: s.color,
        defaultPrice: Number(s.defaultPrice) || 0, gaCapacity: s.gaCapacity || 0, tableSeats: s.tableSeats || 4,
        x: s.x || 60, y: s.y || 70, rows: 1, cols: 1, startRow: 'A', startNumber: 1,
      }));
      const byId = new Map(secs.map((s) => [s.id, s.tempId]));
      const seatMap: Record<string, DraftSeat[]> = {};
      for (const seat of (data.seats || [])) {
        const tempId = byId.get(seat.sectionId);
        if (!tempId) continue;
        (seatMap[tempId] ||= []).push({
          sectionTempId: tempId, kind: seat.kind, rowLabel: seat.rowLabel, seatNumber: seat.seatNumber,
          label: seat.label, capacity: seat.capacity, x: seat.x, y: seat.y,
          priceOverride: seat.priceOverride != null ? Number(seat.priceOverride) : null, isBlocked: seat.isBlocked,
        });
      }
      setSections(secs);
      setSeatsBySection(seatMap);
    } catch (e: any) {
      flash(false, e?.message || 'Failed to load venue');
    }
  }, [artistId]);

  const newVenue = () => {
    setActiveVenueId(null);
    setDraftMeta({ name: '', address: '', city: '', country: '', stageLabel: 'STAGE', canvasWidth: 1000, canvasHeight: 700 });
    setSections([]);
    setSeatsBySection({});
  };

  const createVenueMut = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/seat-map/${artistId}/venues`, { name: draftMeta.name.trim() || 'New venue', ...draftMeta }),
    onSuccess: (data: any) => {
      if (data?.venue?.id) {
        qc.invalidateQueries({ queryKey: ['seatmap-venues', artistId] });
        loadVenue(data.venue.id);
        flash(true, 'Venue created — now add sections and seats.');
      }
    },
    onError: (e: any) => flash(false, e?.message || 'Could not create venue'),
  });

  const allSeats = useMemo(() => Object.values(seatsBySection).flat(), [seatsBySection]);
  const totalCapacity = useMemo(() =>
    sections.reduce((sum, s) => sum + (s.kind === 'ga' ? s.gaCapacity : (seatsBySection[s.tempId] || []).reduce((a, x) => a + (x.capacity || 1), 0)), 0),
    [sections, seatsBySection]);
  const sectionByTemp = useMemo(() => new Map(sections.map((s) => [s.tempId, s])), [sections]);

  const saveMut = useMutation({
    mutationFn: async () => {
      let venueId = activeVenueId;
      if (!venueId) {
        const created: any = await apiRequest('POST', `/api/seat-map/${artistId}/venues`, { name: draftMeta.name.trim() || 'New venue', ...draftMeta });
        venueId = created?.venue?.id;
        if (!venueId) throw new Error('Could not create venue');
        setActiveVenueId(venueId);
      }
      const payloadSections = sections.map((s, i) => ({
        tempId: s.tempId, name: s.name, kind: s.kind, color: s.color, defaultPrice: s.defaultPrice,
        gaCapacity: s.gaCapacity, tableSeats: s.tableSeats, x: s.x, y: s.y, sortOrder: i,
      }));
      const payloadSeats = allSeats.map((st) => ({
        sectionTempId: st.sectionTempId, kind: st.kind, rowLabel: st.rowLabel, seatNumber: st.seatNumber,
        label: st.label, capacity: st.capacity, x: st.x, y: st.y, priceOverride: st.priceOverride ?? null, isBlocked: st.isBlocked ?? false,
      }));
      return apiRequest('PUT', `/api/seat-map/${artistId}/venues/${venueId}`, { venue: draftMeta, sections: payloadSections, seats: payloadSeats });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seatmap-venues', artistId] }); flash(true, 'Seat map saved.'); },
    onError: (e: any) => flash(false, e?.message || 'Could not save the seat map'),
  });

  const attachMut = useMutation({
    mutationFn: async () => {
      if (!activeVenueId || !attachEventId) throw new Error('Pick an event and save the venue first');
      return apiRequest('POST', `/api/seat-map/${artistId}/events/${attachEventId}/attach-venue`, { venueId: activeVenueId });
    },
    onSuccess: (data: any) => flash(true, `Reserved seating enabled — ${data?.seatsInitialized || 0} seats on sale.`),
    onError: (e: any) => flash(false, e?.message || 'Could not attach the venue'),
  });

  const detachMut = useMutation({
    mutationFn: async (eventId: number) => apiRequest('POST', `/api/seat-map/${artistId}/events/${eventId}/detach-venue`, {}),
    onSuccess: () => flash(true, 'Event reverted to general admission.'),
    onError: (e: any) => flash(false, e?.message || 'Could not detach'),
  });

  // ── section helpers ────────────────────────────────────────────────────────
  const addSection = () => {
    const i = sections.length;
    const sec: DraftSection = {
      tempId: uid(), name: `Section ${i + 1}`, kind: 'seats', color: PALETTE[i % PALETTE.length],
      defaultPrice: 50, gaCapacity: 100, tableSeats: 4,
      x: 60, y: 80 + i * 180, rows: 4, cols: 8, startRow: 'A', startNumber: 1,
    };
    setSections((p) => [...p, sec]);
    setSeatsBySection((p) => ({ ...p, [sec.tempId]: generateSeats(sec) }));
  };
  const updateSection = (tempId: string, patch: Partial<DraftSection>) => {
    setSections((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)));
  };
  const regenSeats = (tempId: string) => {
    const sec = sections.find((s) => s.tempId === tempId);
    if (!sec) return;
    setSeatsBySection((p) => ({ ...p, [tempId]: generateSeats(sec) }));
    flash(true, sec.kind === 'ga' ? 'General-admission area updated.' : 'Seats generated for this section.');
  };
  const removeSection = (tempId: string) => {
    setSections((prev) => prev.filter((s) => s.tempId !== tempId));
    setSeatsBySection((p) => { const n = { ...p }; delete n[tempId]; return n; });
  };

  useEffect(() => {
    if (!activeVenueId && (venuesQ.data?.length || 0) > 0) {
      // auto-open the most recent venue for convenience
      loadVenue(venuesQ.data![0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venuesQ.data]);

  const reservedEvents = events.filter((e) => e.seatingMode === 'reserved');

  return (
    <div className="space-y-4">
      {/* Venue switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <MapPin className="h-4 w-4" style={{ color: accent }} />
        <select
          value={activeVenueId ?? ''}
          onChange={(e) => { const v = e.target.value; v ? loadVenue(Number(v)) : newVenue(); }}
          className="px-2 py-1.5 rounded-lg text-sm bg-gray-900 border text-white"
          style={{ borderColor: 'rgba(255,255,255,0.15)' }}
        >
          <option value="">+ New venue…</option>
          {(venuesQ.data || []).map((v) => (
            <option key={v.id} value={v.id}>{v.name} — {v.seats} seats</option>
          ))}
        </select>
        {venuesQ.isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        <span className="text-[11px] text-gray-400 ml-auto">Capacity: <span className="font-bold text-white">{totalCapacity}</span></span>
      </div>

      {/* Import from any theater (JSON / CSV) */}
      <div className="rounded-xl border" style={{ borderColor: showImport ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)', background: 'rgba(124,58,237,0.04)' }}>
        <button
          type="button"
          onClick={() => setShowImport((s) => !s)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-white"
        >
          <span className="flex items-center gap-2"><Upload className="h-4 w-4" style={{ color: accent }} /> Import a theater map (JSON / CSV)</span>
          <span className="text-[11px] text-gray-400">{showImport ? 'Hide' : 'Sync any venue'}</span>
        </button>
        {showImport && (
          <div className="px-3 pb-3 space-y-2.5">
            <p className="text-[11px] text-gray-400">
              Paste or upload an export from your box-office system. Sections are detected automatically; if no x/y coordinates are present, seats are laid out for you.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5" style={{ background: hexToRgba(primary, 0.15), color: accent }}>
                <Upload className="h-3.5 w-3.5" /> Upload file
                <input type="file" accept=".json,.csv,.txt,text/csv,application/json" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.currentTarget.value = ''; }} />
              </label>
              <button type="button" onClick={() => downloadTemplate('csv')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-gray-300 hover:text-white border" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                <FileDown className="h-3.5 w-3.5" /> CSV template
              </button>
              <button type="button" onClick={() => downloadTemplate('json')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-gray-300 hover:text-white border" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                <FileDown className="h-3.5 w-3.5" /> JSON template
              </button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'Paste JSON or CSV here…\nsection,row,seat,price\nOrchestra,A,1,150'}
              rows={5}
              className="w-full px-2.5 py-2 rounded-lg text-xs font-mono bg-gray-900 border text-white placeholder-gray-600 resize-y"
              style={{ borderColor: 'rgba(255,255,255,0.15)' }}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => applyImport(importText)} disabled={!importText.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, color: 'white' }}>
                <Upload className="h-3.5 w-3.5" /> Import & preview
              </button>
              {importText && (
                <button type="button" onClick={() => setImportText('')} className="px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white flex items-center gap-1">
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Venue meta */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <input value={draftMeta.name} onChange={(e) => setDraftMeta((m) => ({ ...m, name: e.target.value }))} placeholder="Venue name *"
          className="col-span-2 sm:col-span-1 px-2.5 py-1.5 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <input value={draftMeta.city} onChange={(e) => setDraftMeta((m) => ({ ...m, city: e.target.value }))} placeholder="City"
          className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <input value={draftMeta.address} onChange={(e) => setDraftMeta((m) => ({ ...m, address: e.target.value }))} placeholder="Address"
          className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <input value={draftMeta.stageLabel} onChange={(e) => setDraftMeta((m) => ({ ...m, stageLabel: e.target.value }))} placeholder="Stage label"
          className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-900 border text-white placeholder-gray-500" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
      </div>

      {/* Live preview */}
      <div className="rounded-xl border overflow-auto bg-black/40" style={{ borderColor: 'rgba(255,255,255,0.08)', maxHeight: 320 }}>
        <svg viewBox={`0 0 ${draftMeta.canvasWidth} ${draftMeta.canvasHeight}`} style={{ width: '100%', minHeight: 220, display: 'block' }}>
          <rect x={draftMeta.canvasWidth * 0.25} y={14} width={draftMeta.canvasWidth * 0.5} height={28} rx={8} fill="rgba(255,255,255,0.08)" />
          <text x={draftMeta.canvasWidth / 2} y={33} textAnchor="middle" fill="#a1a1aa" fontSize={15} fontWeight={700} letterSpacing={4}>{draftMeta.stageLabel}</text>
          {sections.map((s) => (
            <text key={`l-${s.tempId}`} x={s.x} y={s.y} fill={s.color} fontSize={12} fontWeight={700}>{s.name}{s.kind === 'ga' ? ` (GA ${s.gaCapacity})` : ''}</text>
          ))}
          {allSeats.map((seat, i) => {
            const color = sectionByTemp.get(seat.sectionTempId)?.color || primary;
            return seat.kind === 'table'
              ? <rect key={i} x={seat.x - 14} y={seat.y - 14} width={28} height={28} rx={8} fill={color} opacity={seat.isBlocked ? 0.3 : 0.9} />
              : <circle key={i} cx={seat.x} cy={seat.y} r={8} fill={color} opacity={seat.isBlocked ? 0.3 : 0.9} />;
          })}
        </svg>
      </div>

      {/* Sections builder */}
      <div className="space-y-2">
        {sections.map((s) => (
          <div key={s.tempId} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-2">
              <input type="color" value={s.color} onChange={(e) => updateSection(s.tempId, { color: e.target.value })} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0" />
              <input value={s.name} onChange={(e) => updateSection(s.tempId, { name: e.target.value })} className="flex-1 px-2 py-1 rounded-md text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
              <select value={s.kind} onChange={(e) => updateSection(s.tempId, { kind: e.target.value as SectionKind })} className="px-2 py-1 rounded-md text-xs bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                <option value="seats">Seats</option>
                <option value="tables">Tables</option>
                <option value="ga">General</option>
              </select>
              <button type="button" onClick={() => removeSection(s.tempId)} className="text-gray-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="text-[10px] text-gray-400">Price $
                <input type="number" min={0} value={s.defaultPrice} onChange={(e) => updateSection(s.tempId, { defaultPrice: Number(e.target.value) })} className="w-full px-2 py-1 rounded-md text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
              </label>
              {s.kind === 'ga' ? (
                <label className="text-[10px] text-gray-400">Capacity
                  <input type="number" min={1} value={s.gaCapacity} onChange={(e) => updateSection(s.tempId, { gaCapacity: Number(e.target.value) })} className="w-full px-2 py-1 rounded-md text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
                </label>
              ) : (
                <>
                  <label className="text-[10px] text-gray-400">Rows
                    <input type="number" min={1} max={40} value={s.rows} onChange={(e) => updateSection(s.tempId, { rows: Number(e.target.value) })} className="w-full px-2 py-1 rounded-md text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
                  </label>
                  <label className="text-[10px] text-gray-400">{s.kind === 'tables' ? 'Per row' : 'Cols'}
                    <input type="number" min={1} max={40} value={s.cols} onChange={(e) => updateSection(s.tempId, { cols: Number(e.target.value) })} className="w-full px-2 py-1 rounded-md text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
                  </label>
                  {s.kind === 'tables' ? (
                    <label className="text-[10px] text-gray-400">Seats/table
                      <input type="number" min={1} max={50} value={s.tableSeats} onChange={(e) => updateSection(s.tempId, { tableSeats: Number(e.target.value) })} className="w-full px-2 py-1 rounded-md text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
                    </label>
                  ) : (
                    <label className="text-[10px] text-gray-400">Start row
                      <input value={s.startRow} maxLength={1} onChange={(e) => updateSection(s.tempId, { startRow: e.target.value.toUpperCase() })} className="w-full px-2 py-1 rounded-md text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
                    </label>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 items-end">
              <label className="text-[10px] text-gray-400">Pos X
                <input type="number" value={s.x} onChange={(e) => updateSection(s.tempId, { x: Number(e.target.value) })} className="w-full px-2 py-1 rounded-md text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
              </label>
              <label className="text-[10px] text-gray-400">Pos Y
                <input type="number" value={s.y} onChange={(e) => updateSection(s.tempId, { y: Number(e.target.value) })} className="w-full px-2 py-1 rounded-md text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
              </label>
              <button type="button" onClick={() => regenSeats(s.tempId)} className="px-2 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1" style={{ background: 'rgba(255,255,255,0.08)', color: '#e5e7eb' }}>
                <Grid3x3 className="h-3.5 w-3.5" /> Generate
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              {s.kind === 'ga' ? `${s.gaCapacity} general-admission spots` : `${(seatsBySection[s.tempId] || []).length} ${s.kind === 'tables' ? 'tables' : 'seats'} · ${fmtUSD(s.defaultPrice)} each`}
            </p>
          </div>
        ))}

        <button type="button" onClick={addSection} className="w-full py-2 rounded-xl border border-dashed text-sm text-gray-300 flex items-center justify-center gap-2 hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
          <Plus className="h-4 w-4" /> Add a section / zone
        </button>
      </div>

      {note && <p className="text-xs text-emerald-400">{note}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Save + attach */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !sections.length}
          className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50" style={{ background: accent, color: '#0b0b12' }}>
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save seat map
        </button>

        {activeVenueId && events.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <select value={attachEventId} onChange={(e) => setAttachEventId(e.target.value ? Number(e.target.value) : '')}
              className="px-2 py-1.5 rounded-lg text-sm bg-gray-900 border text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              <option value="">Attach to event…</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <button type="button" onClick={() => attachMut.mutate()} disabled={attachMut.isPending || !attachEventId}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
              {attachMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Enable seating
            </button>
          </div>
        )}
      </div>

      {/* Reserved events — quick detach */}
      {reservedEvents.length > 0 && (
        <div className="pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] text-gray-500 mt-2 mb-1 uppercase tracking-wide">Events with reserved seating</p>
          <div className="space-y-1">
            {reservedEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-xs text-gray-300">
                <span>{e.title}</span>
                <button type="button" onClick={() => detachMut.mutate(e.id)} className="text-gray-500 hover:text-red-400 flex items-center gap-1">
                  <Unlink className="h-3.5 w-3.5" /> Detach
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SeatMapEditor;
