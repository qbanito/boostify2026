// ─── VenueOSDashboard v2 ──────────────────────────────────────────────────────
// HoloStage VenueOS — scan, configure and deploy a hologram show to any venue.
// Tabs: Setup | Hologram | DMX | Audio | Budget | Crew | Show Template | Rider | Export
// Improvements v2:
//   - Auto-recalc on mount
//   - initialVenue prop (persisted from show package)
//   - onSendToStageOS wired (saves back to Dashboard/ShowPackage)
//   - Import JSON from file
//   - Audio tab (VenueAudio config)
//   - Show Template tab (slot timeline view)
//   - Hologram: blackBackgroundRequired, throwRatio display, artistScaleFactor
//   - DMX: inline universe/address/channels editing
//   - Budget: currency selector, editable contingency %
//   - Setup: address, notes, scan source, venue date
//   - Feasibility auto-calculated on every recalcAll + on mount

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Building2, Projector, Zap, Users, DollarSign, FileText,
  Download, CheckCircle2, AlertTriangle, AlertCircle,
  ChevronDown, ChevronRight, RefreshCw, Plus, Trash2, Send,
  Music2, Volume2, Upload, Copy, SlidersHorizontal,
} from 'lucide-react';
import type {
  VenueMaster, StageDimensions, HologramSetupSpec, VenueDMXProfile,
  VenueFixture, FixtureCategory, ShowTemplateType, EventType, BudgetEstimate,
  VenueAudio,
} from '../../schemas/venueos/venueMaster.schema';
import {
  buildEmptyVenueMaster, DEFAULT_VENUE_AUDIO,
} from '../../schemas/venueos/venueMaster.schema';
import {
  calcHologramFeasibility, calcRequiredLumens, autoBuildDMXProfile,
  calcBudgetEstimate, buildShowTemplate, buildCrewPlan, generateTechnicalRider,
} from '../../services/venueos/venueCalculator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-orange-500 transition-colors";
const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' };

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
      style={inputStyle}
    />
  );
}

function NumInput({
  value, onChange, min = 0, max = 99999, step = 0.5, unit,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={inputCls}
        style={inputStyle}
      />
      {unit && <span className="text-xs text-gray-500 shrink-0 w-6">{unit}</span>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className="relative w-8 h-4 rounded-full transition-colors cursor-pointer shrink-0"
        style={{ background: checked ? '#f97316' : 'rgba(255,255,255,0.15)' }}
      >
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </label>
  );
}

function Select<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className={inputCls}
      style={{ ...inputStyle, background: 'rgba(20,20,20,0.95)' }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>{o.label}</option>
      ))}
    </select>
  );
}

function SectionBox({ title, children, collapsible = false, defaultOpen = true }: {
  title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        style={{ background: 'rgba(255,255,255,0.03)' }}
        onClick={() => collapsible && setOpen(o => !o)}
      >
        {collapsible && (open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />)}
        <span className="text-xs font-bold text-white uppercase tracking-widest">{title}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Toast notification (tiny) ────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-xl pointer-events-none"
      style={{ background: '#f97316', boxShadow: '0 4px 24px rgba(249,115,22,0.4)' }}
    >
      {msg}
    </div>
  );
}

// ─── Tab IDs ──────────────────────────────────────────────────────────────────

type VenueTab = 'setup' | 'hologram' | 'dmx' | 'audio' | 'budget' | 'crew' | 'template' | 'rider' | 'export';

const TABS: { id: VenueTab; label: string; icon: React.ElementType }[] = [
  { id: 'setup',    label: 'Venue Setup',    icon: Building2         },
  { id: 'hologram', label: 'Hologram',        icon: Projector         },
  { id: 'dmx',      label: 'DMX',             icon: Zap               },
  { id: 'audio',    label: 'Audio',           icon: Volume2           },
  { id: 'budget',   label: 'Budget',          icon: DollarSign        },
  { id: 'crew',     label: 'Crew',            icon: Users             },
  { id: 'template', label: 'Show Template',   icon: Music2            },
  { id: 'rider',    label: 'Tech Rider',      icon: FileText          },
  { id: 'export',   label: 'Export',          icon: Download          },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VenueOSDashboardProps {
  initialVenue?: VenueMaster;
  onSendToStageOS?: (venue: VenueMaster) => void;
}

// ─── Slot type colors ─────────────────────────────────────────────────────────

const SLOT_COLORS: Record<string, string> = {
  blackout:    '#111',
  intro:       '#3b82f6',
  song:        '#f97316',
  transition:  '#6b7280',
  interlude:   '#8b5cf6',
  finale:      '#f59e0b',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function VenueOSDashboard({ initialVenue, onSendToStageOS }: VenueOSDashboardProps) {
  const [tab, setTab] = useState<VenueTab>('setup');
  const [venue, setVenue] = useState<VenueMaster>(() => initialVenue ?? buildEmptyVenueMaster());
  const [budgetTier, setBudgetTier] = useState<'minimal' | 'standard' | 'premium'>('standard');
  const [hasLiveMoCap, setHasLiveMoCap] = useState(false);
  const [riderText, setRiderText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [budgetCurrency, setBudgetCurrency] = useState<BudgetEstimate['currency']>('USD');
  const [contingencyPct, setContingencyPct] = useState(15);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Auto-recalc on mount ──────────────────────────────────────────────────
  useEffect(() => {
    recalcAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Updater helpers ──────────────────────────────────────────────────────

  const setDims = (patch: Partial<StageDimensions>) =>
    setVenue(v => ({ ...v, dimensions: { ...v.dimensions, ...patch } }));

  const setSetup = (patch: Partial<HologramSetupSpec>) =>
    setVenue(v => ({ ...v, hologramSetup: { ...v.hologramSetup, ...patch } }));

  const setDmx = (patch: Partial<VenueDMXProfile>) =>
    setVenue(v => ({ ...v, dmx: { ...v.dmx, ...patch } }));

  const setAudio = (patch: Partial<VenueAudio>) =>
    setVenue(v => ({ ...v, audio: { ...v.audio, ...patch } }));

  // ─── Computed data ────────────────────────────────────────────────────────

  const recalcAll = useCallback(() => {
    setVenue(prev => {
      const feasibility = calcHologramFeasibility(prev.dimensions, prev.hologramSetup);
      const dmx = autoBuildDMXProfile({
        stageWidthM: prev.dimensions.stageWidthM,
        hasRigging: prev.dimensions.ceilingHeightM >= 5,
        budget: budgetTier,
      });
      const budget = calcBudgetEstimate(
        prev.dimensions, prev.hologramSetup,
        prev.showTemplate.templateType, prev.crew.recommendedCrew, budgetTier,
      );
      const showTemplate = buildShowTemplate(prev.showTemplate.templateType);
      const crew = buildCrewPlan(hasLiveMoCap, true, prev.dimensions.roomWidthM > 25);
      const suggestedLumens = calcRequiredLumens(
        prev.hologramSetup.screenWidthM, prev.hologramSetup.screenHeightM,
        prev.dimensions.audienceDistanceM + 2, prev.hologramSetup.ambientLightLimit,
      );
      const updated: VenueMaster = {
        ...prev,
        feasibility,
        dmx,
        budget: { ...budget, currency: budgetCurrency, contingencyPercent: contingencyPct },
        showTemplate,
        crew,
        hologramSetup: { ...prev.hologramSetup, projectorLumensRequired: suggestedLumens },
      };
      setRiderText(generateTechnicalRider(updated));
      return updated;
    });
  }, [budgetTier, hasLiveMoCap, budgetCurrency, contingencyPct]);

  const feasibility = venue.feasibility;

  // ─── Fixture editor ───────────────────────────────────────────────────────

  const addFixture = () => {
    const lastAddr = venue.dmx.fixtures.reduce((max, f) => Math.max(max, f.address + f.channels), 1);
    const fx: VenueFixture = {
      id: `fx-${Date.now()}`,
      label: 'New Fixture',
      category: 'moving_head',
      position: 'front_truss',
      universe: lastAddr + 16 > 512 ? 1 : 0,
      address: lastAddr > 512 ? 1 : lastAddr,
      channels: 16,
    };
    setDmx({ fixtures: [...venue.dmx.fixtures, fx] });
  };

  const removeFixture = (id: string) =>
    setDmx({ fixtures: venue.dmx.fixtures.filter(f => f.id !== id) });

  const updateFixture = (id: string, patch: Partial<VenueFixture>) =>
    setDmx({ fixtures: venue.dmx.fixtures.map(f => f.id === id ? { ...f, ...patch } : f) });

  // ─── Import JSON ──────────────────────────────────────────────────────────

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target?.result as string) as VenueMaster;
        if (!parsed.venueId || !parsed.venueName) throw new Error('Invalid VenueMaster JSON');
        setVenue(parsed);
        setRiderText(generateTechnicalRider(parsed));
        setToast(`✓ Venue loaded: ${parsed.venueName}`);
      } catch {
        setToast('Error: Invalid venue JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ─── Feasibility badge ────────────────────────────────────────────────────

  const fColor = feasibility
    ? feasibility.grade === 'A' || feasibility.grade === 'B' ? '#22c55e'
      : feasibility.grade === 'C' ? '#f59e0b' : '#ef4444'
    : '#6b7280';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 relative">
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black tracking-widest uppercase text-white">
            HoloStage <span style={{ color: '#f97316' }}>VenueOS</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {venue.venueName}{venue.city ? ` · ${venue.city}` : ''} · {venue.eventType.replace(/_/g,' ')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {feasibility && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: `${fColor}18`, border: `1px solid ${fColor}40` }}>
              {feasibility.viable
                ? <CheckCircle2 size={12} style={{ color: fColor }} />
                : <AlertCircle  size={12} style={{ color: fColor }} />}
              <span className="text-xs font-bold" style={{ color: fColor }}>
                {feasibility.score}/100 · {feasibility.grade}
              </span>
            </div>
          )}
          <button
            onClick={recalcAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}
          >
            <RefreshCw size={11} /> Recalculate
          </button>
          {onSendToStageOS && (
            <button
              onClick={() => { onSendToStageOS(venue); setToast('✓ Venue sent to HoloStage!'); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <Send size={11} /> Send to HoloStage
            </button>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div
        className="flex gap-1 overflow-x-auto p-1 rounded-xl"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0"
              style={{
                background: active ? '#f97316' : 'transparent',
                color: active ? '#fff' : '#6b7280',
              }}
            >
              <Icon size={11} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═════════════════════════════════════════════════════════════════
          TAB: SETUP
      ═════════════════════════════════════════════════════════════════ */}
      {tab === 'setup' && (
        <div className="space-y-4">
          <SectionBox title="Venue Info">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Venue Name">
                <TextInput value={venue.venueName} onChange={v => setVenue(prev => ({ ...prev, venueName: v }))} />
              </Field>
              <Field label="Event Type">
                <Select<EventType>
                  value={venue.eventType}
                  onChange={v => setVenue(prev => ({ ...prev, eventType: v }))}
                  options={[
                    { value: 'hologram_concert',     label: 'Hologram Concert' },
                    { value: 'hologram_brand_event',  label: 'Brand Event' },
                    { value: 'hologram_theater',      label: 'Theater' },
                    { value: 'hologram_festival',     label: 'Festival' },
                    { value: 'hologram_private',      label: 'Private Event' },
                    { value: 'hologram_corporate',    label: 'Corporate' },
                  ]}
                />
              </Field>
              <Field label="City">
                <TextInput value={venue.city ?? ''} onChange={v => setVenue(prev => ({ ...prev, city: v }))} />
              </Field>
              <Field label="Country">
                <TextInput value={venue.country ?? ''} onChange={v => setVenue(prev => ({ ...prev, country: v }))} />
              </Field>
              <Field label="Address">
                <TextInput value={venue.address ?? ''} onChange={v => setVenue(prev => ({ ...prev, address: v }))} />
              </Field>
              <Field label="Scan Source">
                <Select
                  value={venue.scanSource}
                  onChange={v => setVenue(prev => ({ ...prev, scanSource: v }))}
                  options={[
                    { value: 'manual',                   label: 'Manual Entry' },
                    { value: 'mobile_photo',             label: 'Mobile Photo Scan' },
                    { value: 'mobile_lidar',             label: 'Mobile LiDAR Scan' },
                    { value: 'mobile_lidar_plus_manual', label: 'LiDAR + Manual' },
                    { value: 'blueprint',                label: 'Blueprint / Floor Plan' },
                  ]}
                />
              </Field>
            </div>
          </SectionBox>

          <SectionBox title="Stage Dimensions">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stage Width"><NumInput value={venue.dimensions.stageWidthM} onChange={v => setDims({ stageWidthM: v })} unit="m" /></Field>
              <Field label="Stage Depth"><NumInput value={venue.dimensions.stageDepthM} onChange={v => setDims({ stageDepthM: v })} unit="m" /></Field>
              <Field label="Stage Height (platform)"><NumInput value={venue.dimensions.stageHeightM} onChange={v => setDims({ stageHeightM: v })} step={0.1} unit="m" /></Field>
              <Field label="Ceiling Height"><NumInput value={venue.dimensions.ceilingHeightM} onChange={v => setDims({ ceilingHeightM: v })} unit="m" /></Field>
              <Field label="Audience Distance" hint="from stage front"><NumInput value={venue.dimensions.audienceDistanceM} onChange={v => setDims({ audienceDistanceM: v })} unit="m" /></Field>
              <Field label="Room Width"><NumInput value={venue.dimensions.roomWidthM} onChange={v => setDims({ roomWidthM: v })} unit="m" /></Field>
              <Field label="Room Depth"><NumInput value={venue.dimensions.roomDepthM} onChange={v => setDims({ roomDepthM: v })} unit="m" /></Field>
            </div>
          </SectionBox>

          <SectionBox title="Show Template">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Show Type">
                <Select<ShowTemplateType>
                  value={venue.showTemplate.templateType}
                  onChange={v => setVenue(prev => ({ ...prev, showTemplate: { ...prev.showTemplate, templateType: v } }))}
                  options={[
                    { value: 'showcase_15min',      label: '15-min Showcase' },
                    { value: 'mini_concert_30min',  label: '30-min Mini Concert' },
                    { value: 'full_show_45min',     label: '45-min Full Show' },
                    { value: 'premium_show_60min',  label: '60-min Premium Show' },
                    { value: 'corporate',           label: 'Corporate Event' },
                    { value: 'club',                label: 'Club Performance' },
                    { value: 'festival',            label: 'Festival Set' },
                    { value: 'theater',             label: 'Theater Show' },
                    { value: 'private_event',       label: 'Private Event' },
                  ]}
                />
              </Field>
              <Field label="Budget Tier">
                <Select<typeof budgetTier>
                  value={budgetTier}
                  onChange={setBudgetTier}
                  options={[
                    { value: 'minimal',  label: 'Minimal (DIY)' },
                    { value: 'standard', label: 'Standard Production' },
                    { value: 'premium',  label: 'Premium / Touring' },
                  ]}
                />
              </Field>
              <Field label="Live MoCap">
                <Toggle checked={hasLiveMoCap} onChange={setHasLiveMoCap} label="HoloSuit or phone capture" />
              </Field>
            </div>
          </SectionBox>

          <SectionBox title="Notes" collapsible defaultOpen={false}>
            <textarea
              value={venue.notes ?? ''}
              onChange={e => setVenue(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Technical notes, access requirements, special instructions…"
              rows={4}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
              style={inputStyle}
            />
          </SectionBox>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          TAB: HOLOGRAM
      ═════════════════════════════════════════════════════════════════ */}
      {tab === 'hologram' && (
        <div className="space-y-4">
          {feasibility && (
            <div
              className="rounded-xl p-4 space-y-2"
              style={{
                border: `1px solid ${feasibility.viable ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                background: feasibility.viable ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
              }}
            >
              <div className="flex items-center gap-2">
                {feasibility.viable ? <CheckCircle2 size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
                <span className="text-sm font-bold text-white">
                  Feasibility: {feasibility.score}/100 · Grade {feasibility.grade}
                  <span className="ml-2 text-xs font-normal text-gray-400">{feasibility.viable ? '— Viable ✓' : '— NOT viable ✗'}</span>
                </span>
              </div>
              {feasibility.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-300">{w}</p>
                </div>
              ))}
              <div className="pt-1">
                <p className="text-xs font-semibold text-gray-400 mb-1">Required Equipment:</p>
                {feasibility.requiredEquipment.map((e, i) => (
                  <p key={i} className="text-xs text-gray-400">✓ {e}</p>
                ))}
              </div>
            </div>
          )}

          <SectionBox title="Hologram Surface">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Surface Type">
                <Select value={venue.hologramSetup.surfaceType} onChange={v => setSetup({ surfaceType: v as HologramSetupSpec['surfaceType'] })}
                  options={[
                    { value: 'holo_gauze',        label: 'Holo Gauze' },
                    { value: 'peppers_ghost_foil', label: "Pepper's Ghost Foil" },
                    { value: 'rear_projection',   label: 'Rear Projection Screen' },
                    { value: 'led_transparent',   label: 'Transparent LED' },
                    { value: 'holofan',           label: 'HoloFan' },
                    { value: 'mirror_45',         label: '45° Mirror' },
                  ]}
                />
              </Field>
              <Field label="Projection Mode">
                <Select value={venue.hologramSetup.projectionMode} onChange={v => setSetup({ projectionMode: v as HologramSetupSpec['projectionMode'] })}
                  options={[
                    { value: 'front_projection', label: 'Front Projection' },
                    { value: 'rear_projection',  label: 'Rear Projection' },
                    { value: 'top_down',         label: 'Top Down' },
                    { value: 'bottom_up',        label: 'Bottom Up' },
                  ]}
                />
              </Field>
              <Field label="Screen Width"><NumInput value={venue.hologramSetup.screenWidthM} onChange={v => setSetup({ screenWidthM: v })} unit="m" /></Field>
              <Field label="Screen Height"><NumInput value={venue.hologramSetup.screenHeightM} onChange={v => setSetup({ screenHeightM: v })} unit="m" /></Field>
              <Field label="Ambient Light">
                <Select value={venue.hologramSetup.ambientLightLimit} onChange={v => setSetup({ ambientLightLimit: v as HologramSetupSpec['ambientLightLimit'] })}
                  options={[
                    { value: 'none',   label: 'None (full blackout)' },
                    { value: 'low',    label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                  ]}
                />
              </Field>
              <Field label="Black Background Required">
                <Toggle
                  checked={venue.hologramSetup.blackBackgroundRequired}
                  onChange={v => setSetup({ blackBackgroundRequired: v })}
                  label="Stage must be fully draped"
                />
              </Field>
            </div>
          </SectionBox>

          <SectionBox title="Projector">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lumens Required (auto-calculated)">
                <NumInput value={venue.hologramSetup.projectorLumensRequired} onChange={v => setSetup({ projectorLumensRequired: v })} step={1000} unit="lm" />
              </Field>
              <Field label="Artist Scale">
                <Select value={venue.hologramSetup.artistScale} onChange={v => setSetup({ artistScale: v as HologramSetupSpec['artistScale'] })}
                  options={[
                    { value: 'life_size',    label: 'Life Size (1×)' },
                    { value: 'half_size',    label: 'Half Size (0.5×)' },
                    { value: 'double_size',  label: 'Double (2×)' },
                    { value: 'custom',       label: 'Custom' },
                  ]}
                />
              </Field>
              {venue.hologramSetup.artistScale === 'custom' && (
                <Field label="Custom Scale Factor">
                  <NumInput value={venue.hologramSetup.artistScaleFactor ?? 1} onChange={v => setSetup({ artistScaleFactor: v })} step={0.1} min={0.1} max={5} />
                </Field>
              )}
              <Field label="Throw Ratio (auto)">
                <div
                  className="rounded-lg px-3 py-1.5 text-sm font-mono"
                  style={inputStyle}
                >
                  {((venue.dimensions.audienceDistanceM + 1.5) / venue.hologramSetup.screenWidthM).toFixed(2)}:1
                </div>
              </Field>
              <Field label="Projector X (from center)"><NumInput value={venue.hologramSetup.projectorPosition.x} onChange={v => setSetup({ projectorPosition: { ...venue.hologramSetup.projectorPosition, x: v } })} step={0.1} unit="m" /></Field>
              <Field label="Projector Y (height)"><NumInput value={venue.hologramSetup.projectorPosition.y} onChange={v => setSetup({ projectorPosition: { ...venue.hologramSetup.projectorPosition, y: v } })} step={0.1} unit="m" /></Field>
              <Field label="Projector Z (depth from stage)"><NumInput value={venue.hologramSetup.projectorPosition.z} onChange={v => setSetup({ projectorPosition: { ...venue.hologramSetup.projectorPosition, z: v } })} step={0.1} unit="m" /></Field>
            </div>
          </SectionBox>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          TAB: DMX
      ═════════════════════════════════════════════════════════════════ */}
      {tab === 'dmx' && (
        <div className="space-y-4">
          <SectionBox title="DMX Protocol">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Protocol">
                <Select value={venue.dmx.protocol} onChange={v => setDmx({ protocol: v as VenueDMXProfile['protocol'] })}
                  options={[
                    { value: 'artnet',     label: 'Art-Net' },
                    { value: 'sacn',       label: 'sACN (E1.31)' },
                    { value: 'dmx',        label: 'DMX 512' },
                    { value: 'simulation', label: 'Simulation' },
                  ]}
                />
              </Field>
              <Field label="Controller IP">
                <TextInput
                  value={venue.dmx.ip ?? ''}
                  onChange={v => setDmx({ ip: v })}
                  placeholder="2.0.0.1"
                />
              </Field>
              <Field label="Universes Used">
                <div className="rounded-lg px-3 py-1.5 text-sm font-mono text-white" style={inputStyle}>
                  {venue.dmx.universesRequired}
                </div>
              </Field>
            </div>
          </SectionBox>

          <SectionBox title={`Fixtures (${venue.dmx.fixtures.length})`}>
            {/* Header row */}
            <div className="grid text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1" style={{ gridTemplateColumns: '2fr 1.5fr 1.5fr auto auto auto auto' }}>
              <span>Label</span>
              <span>Category</span>
              <span>Position</span>
              <span className="text-center">Univ</span>
              <span className="text-center">Addr</span>
              <span className="text-center">Ch</span>
              <span />
            </div>
            <div className="space-y-1.5">
              {venue.dmx.fixtures.map(fx => (
                <div key={fx.id} className="grid items-center gap-1.5" style={{ gridTemplateColumns: '2fr 1.5fr 1.5fr auto auto auto auto' }}>
                  <input
                    value={fx.label}
                    onChange={e => updateFixture(fx.id, { label: e.target.value })}
                    className="rounded px-2 py-1 text-xs text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <select
                    value={fx.category}
                    onChange={e => updateFixture(fx.id, { category: e.target.value as FixtureCategory })}
                    className="rounded px-1.5 py-1 text-xs text-white outline-none"
                    style={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {(['moving_head','wash','spot','strobe','haze','fog','led_bar','follow_spot','blinder','pixel'] as FixtureCategory[]).map(c => (
                      <option key={c} value={c} style={{ background: '#1a1a1a' }}>{c.replace(/_/g,' ')}</option>
                    ))}
                  </select>
                  <input
                    value={fx.position}
                    onChange={e => updateFixture(fx.id, { position: e.target.value })}
                    placeholder="position"
                    className="rounded px-2 py-1 text-xs text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <input
                    type="number" min={0} max={9} value={fx.universe}
                    onChange={e => updateFixture(fx.id, { universe: parseInt(e.target.value) || 0 })}
                    className="w-10 rounded px-1.5 py-1 text-xs text-center text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <input
                    type="number" min={1} max={512} value={fx.address}
                    onChange={e => updateFixture(fx.id, { address: parseInt(e.target.value) || 1 })}
                    className="w-14 rounded px-1.5 py-1 text-xs text-center text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <input
                    type="number" min={1} max={64} value={fx.channels}
                    onChange={e => updateFixture(fx.id, { channels: parseInt(e.target.value) || 1 })}
                    className="w-10 rounded px-1.5 py-1 text-xs text-center text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <button onClick={() => removeFixture(fx.id)} className="text-red-500 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={addFixture}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                <Plus size={12} /> Add Fixture
              </button>
              <button
                onClick={() => {
                  const autoDmx = autoBuildDMXProfile({
                    stageWidthM: venue.dimensions.stageWidthM,
                    hasRigging: venue.dimensions.ceilingHeightM >= 5,
                    budget: budgetTier,
                  });
                  setDmx(autoDmx);
                  setToast('DMX auto-configured ✓');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}>
                <SlidersHorizontal size={12} /> Auto-Configure
              </button>
            </div>
          </SectionBox>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          TAB: AUDIO
      ═════════════════════════════════════════════════════════════════ */}
      {tab === 'audio' && (
        <div className="space-y-4">
          <SectionBox title="PA System">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Audio System Type">
                <Select value={venue.audio.systemType} onChange={v => setAudio({ systemType: v as VenueAudio['systemType'] })}
                  options={[
                    { value: 'venue_pa', label: 'Venue PA System' },
                    { value: 'touring',  label: 'Touring PA (own)' },
                    { value: 'rental',   label: 'Rental System' },
                    { value: 'none',     label: 'No PA / Playback only' },
                  ]}
                />
              </Field>
              <Field label="FOH Position">
                <TextInput value={venue.audio.fohPosition} onChange={v => setAudio({ fohPosition: v })} placeholder="center_back" />
              </Field>
              <Field label="Sample Rate">
                <Select value={String(venue.audio.sampleRate ?? 48000)} onChange={v => setAudio({ sampleRate: parseInt(v) as VenueAudio['sampleRate'] })}
                  options={[
                    { value: '44100', label: '44.1 kHz' },
                    { value: '48000', label: '48 kHz (recommended)' },
                    { value: '96000', label: '96 kHz' },
                  ]}
                />
              </Field>
            </div>
          </SectionBox>

          <SectionBox title="Show Audio Requirements">
            <div className="space-y-3">
              <Toggle
                checked={venue.audio.stemsSupported}
                onChange={v => setAudio({ stemsSupported: v })}
                label="Stems playback supported (multi-track audio)"
              />
              <Toggle
                checked={venue.audio.timecodeRequired}
                onChange={v => setAudio({ timecodeRequired: v })}
                label="LTC Timecode required (sync timeline to audio)"
              />
              <Toggle
                checked={venue.audio.monitoringRequired}
                onChange={v => setAudio({ monitoringRequired: v })}
                label="Stage monitoring required"
              />
            </div>
          </SectionBox>

          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}
          >
            <p className="text-orange-400 text-xs font-bold uppercase tracking-wider">HoloStage Audio Notes</p>
            <p className="text-xs text-gray-400">
              For hologram shows, stems-based audio is strongly recommended. HoloStage can sync timeline cues to LTC timecode from the audio console.
              All audio stems must be at the same sample rate. The timecode track should be on a dedicated send to the StageOS operator.
            </p>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          TAB: BUDGET
      ═════════════════════════════════════════════════════════════════ */}
      {tab === 'budget' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const b = calcBudgetEstimate(venue.dimensions, venue.hologramSetup, venue.showTemplate.templateType, venue.crew.recommendedCrew, budgetTier);
                  setVenue(v => ({ ...v, budget: { ...b, currency: budgetCurrency, contingencyPercent: contingencyPct } }));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}
              >
                <RefreshCw size={12} /> Recalculate Budget
              </button>
              <div className="flex items-center gap-1">
                <Select<BudgetEstimate['currency']>
                  value={budgetCurrency}
                  onChange={setBudgetCurrency}
                  options={[
                    { value: 'USD', label: 'USD $' },
                    { value: 'EUR', label: 'EUR €' },
                    { value: 'GBP', label: 'GBP £' },
                    { value: 'MXN', label: 'MXN $' },
                  ]}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">Contingency</span>
                <input
                  type="number" min={0} max={50} step={5} value={contingencyPct}
                  onChange={e => setContingencyPct(parseInt(e.target.value) || 0)}
                  className="w-14 rounded px-2 py-1 text-xs text-white outline-none text-center"
                  style={inputStyle}
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total Estimated</p>
              <p className="text-xl font-black" style={{ color: '#f97316' }}>
                {budgetCurrency} {venue.budget.totalEstimated.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <th className="text-left px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold" style={{ fontSize: 9 }}>Category</th>
                  <th className="text-left px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold" style={{ fontSize: 9 }}>Item</th>
                  <th className="text-right px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold" style={{ fontSize: 9 }}>{budgetCurrency}</th>
                </tr>
              </thead>
              <tbody>
                {venue.budget.items.map((item, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <td className="px-3 py-2 text-gray-500 capitalize">{item.category}</td>
                    <td className="px-3 py-2 text-white">{item.label}</td>
                    <td className="px-3 py-2 text-right text-orange-300 font-mono">{item.estimatedUSD.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(249,115,22,0.08)', borderTop: '1px solid rgba(249,115,22,0.3)' }}>
                  <td className="px-3 py-2 text-orange-400 font-bold" colSpan={2}>TOTAL ({budgetCurrency})</td>
                  <td className="px-3 py-2 text-right text-orange-400 font-black font-mono text-sm">{venue.budget.totalEstimated.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          TAB: CREW
      ═════════════════════════════════════════════════════════════════ */}
      {tab === 'crew' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="rounded-xl p-4 flex-1 text-center" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-3xl font-black text-orange-400">{venue.crew.minimumCrew}</p>
              <p className="text-xs text-gray-400 mt-1">Minimum Crew</p>
            </div>
            <div className="rounded-xl p-4 flex-1 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-3xl font-black text-white">{venue.crew.recommendedCrew}</p>
              <p className="text-xs text-gray-400 mt-1">Recommended Crew</p>
            </div>
          </div>

          <div className="space-y-2">
            {venue.crew.roles.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${r.optional ? 'bg-gray-600' : 'bg-orange-400'}`} />
                <div>
                  <p className="text-xs font-semibold text-white">
                    {r.role} {r.optional && <span className="text-gray-600 font-normal">(optional)</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.responsibility}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const crew = buildCrewPlan(hasLiveMoCap, true, venue.dimensions.roomWidthM > 25);
              setVenue(v => ({ ...v, crew }));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
            <RefreshCw size={12} /> Rebuild Crew Plan
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          TAB: SHOW TEMPLATE
      ═════════════════════════════════════════════════════════════════ */}
      {tab === 'template' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">{venue.showTemplate.templateType.replace(/_/g,' ')}</p>
              <p className="text-gray-500 text-xs">
                {Math.round(venue.showTemplate.totalDurationSec / 60)} min · {venue.showTemplate.songSlots} songs · {venue.showTemplate.slots.length} slots
              </p>
            </div>
            <button
              onClick={() => {
                const t = buildShowTemplate(venue.showTemplate.templateType);
                setVenue(v => ({ ...v, showTemplate: t }));
                setToast('Show template rebuilt ✓');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}
            >
              <RefreshCw size={12} /> Rebuild Template
            </button>
          </div>

          {/* Visual timeline */}
          <div className="space-y-1">
            {venue.showTemplate.slots.map((slot, i) => {
              const totalSec = venue.showTemplate.totalDurationSec || 1;
              const widthPct = Math.max(2, (slot.durationSec / totalSec) * 100);
              const color = SLOT_COLORS[slot.type] ?? '#6b7280';
              const mins = Math.floor(slot.offsetSec / 60);
              const secs = slot.offsetSec % 60;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-mono w-10 shrink-0 text-right">
                    {mins}:{String(secs).padStart(2,'0')}
                  </span>
                  <div
                    className="h-6 rounded flex items-center px-2 overflow-hidden"
                    style={{
                      width: `${widthPct}%`,
                      background: color === '#111' ? '#222' : `${color}30`,
                      border: `1px solid ${color}60`,
                      minWidth: 40,
                    }}
                  >
                    <span className="text-xs font-medium text-white truncate" style={{ fontSize: 10 }}>{slot.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 ml-auto shrink-0">
                    <span
                      className="px-1.5 py-0.5 rounded capitalize"
                      style={{
                        background: `${SLOT_COLORS[slot.type] ?? '#6b7280'}20`,
                        color: SLOT_COLORS[slot.type] ?? '#6b7280',
                        fontSize: 9,
                      }}
                    >
                      {slot.type}
                    </span>
                    <span>{slot.durationSec}s</span>
                    {slot.lightingPreset && <span className="text-gray-700">{slot.lightingPreset}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-3 flex-wrap pt-1">
            {Object.entries(SLOT_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color === '#111' ? '#222' : `${color}50`, border: `1px solid ${color}` }} />
                <span className="text-xs text-gray-500 capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          TAB: RIDER
      ═════════════════════════════════════════════════════════════════ */}
      {tab === 'rider' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setRiderText(generateTechnicalRider(venue))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
              <RefreshCw size={12} /> Generate Rider
            </button>
            <button
              onClick={() => {
                const blob = new Blob([riderText], { type: 'text/plain' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${venue.venueName.replace(/\s+/g,'-')}_TechRider.txt`;
                a.click();
              }}
              disabled={!riderText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
              <Download size={12} /> Download .txt
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(riderText); setToast('Rider copied to clipboard ✓'); }}
              disabled={!riderText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Copy size={12} /> Copy
            </button>
          </div>
          <pre
            className="rounded-xl p-4 text-xs font-mono overflow-auto text-gray-300 whitespace-pre-wrap"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.07)', maxHeight: '60vh' }}>
            {riderText || 'Click "Generate Rider" to create the technical rider document.'}
          </pre>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          TAB: EXPORT
      ═════════════════════════════════════════════════════════════════ */}
      {tab === 'export' && (
        <div className="space-y-4">
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />

          <SectionBox title="Venue Master JSON">
            <p className="text-xs text-gray-500">
              Export the complete Venue Master JSON to use with HoloStage, share with production teams, or store for future shows at this venue.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  const json = JSON.stringify(venue, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `${venue.venueId}_VenueMaster.json`;
                  a.click();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                <Download size={12} /> Export JSON
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(JSON.stringify(venue, null, 2)); setToast('JSON copied ✓'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Copy size={12} /> Copy JSON
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>
                <Upload size={12} /> Import JSON
              </button>
              {onSendToStageOS && (
                <button
                  onClick={() => { onSendToStageOS(venue); setToast('✓ Venue sent to HoloStage — saved in Show Package!'); }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <Send size={12} /> Send to HoloStage
                </button>
              )}
            </div>
          </SectionBox>

          <SectionBox title="JSON Preview" collapsible defaultOpen={false}>
            <pre className="text-xs text-gray-400 font-mono overflow-auto whitespace-pre-wrap" style={{ maxHeight: '50vh', fontSize: 10 }}>
              {JSON.stringify(venue, null, 2)}
            </pre>
          </SectionBox>
        </div>
      )}
    </div>
  );
}
