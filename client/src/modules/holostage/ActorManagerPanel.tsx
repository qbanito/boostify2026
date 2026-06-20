// ─── ActorManagerPanel ────────────────────────────────────────────────────────
// Full actor management: list, add, configure, capture channel toggles.
// Wired to holosuitBridge — add/remove/select/update actors in real time.
// Actor colors stored locally (bridge only tracks motion data, not display prefs).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, User, Check, ChevronDown, ChevronRight,
  Radio, Activity, CheckCircle, AlertCircle, Settings,
  Eye, Zap, ZapOff, RefreshCw,
} from 'lucide-react';
import { holosuitBridge } from '../../services/holostage/holosuitBridge';
import type { HoloSuitActorInfo } from '../../schemas/holostage/motionSource.schema';

// ─── Color palette (mirrors HoloSuit Studio swatches) ────────────────────────

const ACTOR_COLORS = [
  '#f97316', '#3b82f6', '#22c55e', '#ec4899',
  '#a855f7', '#06b6d4', '#eab308', '#ef4444',
  '#14b8a6', '#f43f5e', '#84cc16', '#6366f1',
];

// ─── Measurement fields ───────────────────────────────────────────────────────

const MEASUREMENT_FIELDS = [
  { key: 'inseamLength',   label: 'Inseam Length' },
  { key: 'shoulderWidth',  label: 'Shoulder Width' },
  { key: 'armLength',      label: 'Arm Length' },
  { key: 'upperArmCirc',   label: 'Upper Arm Circ.' },
  { key: 'lowerArmCirc',   label: 'Lower Arm Circ.' },
  { key: 'chestCirc',      label: 'Chest Circ.' },
  { key: 'hipCirc',        label: 'Hip Circ.' },
  { key: 'thighCirc',      label: 'Thigh Circ.' },
  { key: 'calfCirc',       label: 'Calf Circ.' },
  { key: 'footLength',     label: 'Foot Length' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActorMeasurements {
  totalHeight: number;
  [key: string]: number;
}

interface ActorDraft {
  name: string;
  color: string;
  measurements: ActorMeasurements;
  showMeasurements: boolean;
  hasBody: boolean;
  hasFace: boolean;
  hasHands: boolean;
}

// Local actor metadata (colors + measurements — not in bridge schema)
interface ActorMeta {
  color: string;
  measurements: ActorMeasurements;
}

const DEFAULT_DRAFT: ActorDraft = {
  name: '',
  color: ACTOR_COLORS[0],
  measurements: { totalHeight: 175 },
  showMeasurements: false,
  hasBody: true,
  hasFace: false,
  hasHands: false,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Dot({ active, pulse }: { active: boolean; pulse?: boolean }) {
  return (
    <div className={`w-2 h-2 rounded-full shrink-0 ${pulse && active ? 'animate-pulse' : ''}`}
      style={{
        background: active ? '#22c55e' : 'rgba(255,255,255,0.12)',
        boxShadow: active ? '0 0 4px #22c55e' : 'none',
      }} />
  );
}

function ToggleChip({
  active, label, color, onClick,
}: { active: boolean; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-all"
      style={{
        background: active ? `${color}20` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? color + '50' : 'rgba(255,255,255,0.08)'}`,
        color: active ? color : 'rgba(255,255,255,0.2)',
      }}>
      {label}
    </button>
  );
}

function FrameAge({ lastFrameMs }: { lastFrameMs: number }) {
  const [age, setAge] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAge(Date.now() - lastFrameMs), 500);
    return () => clearInterval(id);
  }, [lastFrameMs]);
  const secs = Math.floor(age / 1000);
  if (secs < 2) return <span className="text-[9px] font-mono" style={{ color: '#22c55e' }}>live</span>;
  if (secs < 10) return <span className="text-[9px] font-mono" style={{ color: '#f59e0b' }}>{secs}s ago</span>;
  return <span className="text-[9px] font-mono" style={{ color: '#ef4444' }}>stale</span>;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ActorManagerPanelProps {
  onActorSelected?: (actorName: string | null) => void;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ActorManagerPanel({ onActorSelected }: ActorManagerPanelProps) {
  const [tab, setTab] = useState<'actors' | 'add' | 'configure'>('actors');

  // ── Bridge state ─────────────────────────────────────────────────────────
  const [actors,   setActors]   = useState<HoloSuitActorInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  // ── Local metadata (colors + measurements per actor) ─────────────────────
  const [meta, setMeta] = useState<Record<string, ActorMeta>>({
    'C2J':     { color: ACTOR_COLORS[0], measurements: { totalHeight: 175 } },
    'Demo_02': { color: ACTOR_COLORS[1], measurements: { totalHeight: 180 } },
  });

  // ── Add form ─────────────────────────────────────────────────────────────
  const [draft,     setDraft]     = useState<ActorDraft>({ ...DEFAULT_DRAFT });
  const [nameError, setNameError] = useState('');

  // ── Configure panel ──────────────────────────────────────────────────────
  const [editMeasOpen, setEditMeasOpen] = useState(false);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const refresh = () => setActors(holosuitBridge.getActors());
    refresh();
    const id = setInterval(refresh, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    holosuitBridge.selectActor(selected);
    onActorSelected?.(selected);
  }, [selected, onActorSelected]);

  // Auto-select first actor if none selected and actors exist
  useEffect(() => {
    if (!selected && actors.length > 0) {
      setSelected(actors[0].actorName);
    }
  }, [actors, selected]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAddActor = useCallback(() => {
    const name = draft.name.trim();
    if (!name) { setNameError('Actor name is required'); return; }
    if (actors.some(a => a.actorName === name)) {
      setNameError('An actor with this name already exists');
      return;
    }
    holosuitBridge.addActor({
      actorName: name,
      hasBody:    draft.hasBody,
      hasFace:    draft.hasFace,
      hasHands:   draft.hasHands,
      lastFrameMs: Date.now(),
      frameRate:  0,
      isActive:   false,
    });
    setMeta(m => ({ ...m, [name]: { color: draft.color, measurements: { ...draft.measurements } } }));
    setActors(holosuitBridge.getActors());
    setDraft({ ...DEFAULT_DRAFT });
    setNameError('');
    setTab('actors');
    setSelected(name);
  }, [draft, actors]);

  const handleRemoveActor = useCallback((name: string) => {
    holosuitBridge.removeActor(name);
    setActors(holosuitBridge.getActors());
    if (selected === name) {
      const remaining = holosuitBridge.getActors();
      setSelected(remaining.length > 0 ? remaining[0].actorName : null);
    }
    setMeta(m => { const copy = { ...m }; delete copy[name]; return copy; });
  }, [selected]);

  const toggleCapture = useCallback((name: string, channel: 'hasBody' | 'hasFace' | 'hasHands') => {
    const actor = actors.find(a => a.actorName === name);
    if (!actor) return;
    holosuitBridge.updateActor(name, { [channel]: !actor[channel] });
    setActors(holosuitBridge.getActors());
  }, [actors]);

  const setMeasurement = (key: string, val: string) => {
    const num = parseFloat(val);
    setDraft(d => ({ ...d, measurements: { ...d.measurements, [key]: isNaN(num) ? 0 : num } }));
  };

  const setConfigMeasurement = (name: string, key: string, val: string) => {
    const num = parseFloat(val);
    setMeta(m => ({
      ...m,
      [name]: {
        ...m[name],
        measurements: { ...(m[name]?.measurements ?? { totalHeight: 175 }), [key]: isNaN(num) ? 0 : num },
      },
    }));
  };

  const selectedActor = actors.find(a => a.actorName === selected);
  const selectedMeta  = selected ? meta[selected] : undefined;

  const TABS = [
    { id: 'actors'    as const, label: 'Actors',    count: actors.length },
    { id: 'add'       as const, label: 'Add New',   count: null },
    { id: 'configure' as const, label: 'Configure', count: null },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto"
      style={{ background: '#0a0a0a', color: 'white' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-orange-400" />
          <div>
            <h3 className="text-base font-bold text-white">Actor Manager</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {actors.filter(a => a.isActive).length} live · {actors.length} total
            </p>
          </div>
        </div>
        <button onClick={() => setTab('add')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-0.5 mx-4 mb-4 p-1 rounded-lg shrink-0"
        style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(({ id, label, count }) => (
          <button key={id} onClick={() => setTab(id)}
            className="relative flex items-center justify-center gap-1 py-2 rounded text-[10px] font-medium transition-colors"
            style={{
              background: tab === id ? 'rgba(249,115,22,0.18)' : 'transparent',
              color: tab === id ? '#f97316' : 'rgba(255,255,255,0.35)',
            }}>
            {label}
            {count !== null && count > 0 && (
              <span className="text-[9px] font-black px-1 rounded"
                style={{ background: tab === id ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.1)', color: tab === id ? '#f97316' : 'rgba(255,255,255,0.4)' }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ ACTORS tab ═════════════════════════════════════════════════════ */}
      {tab === 'actors' && (
        <div className="px-4 pb-6 space-y-2">
          {actors.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12"
              style={{ color: 'rgba(255,255,255,0.18)' }}>
              <User className="w-10 h-10" />
              <div className="text-center">
                <p className="text-xs font-bold mb-1">No actors configured</p>
                <p className="text-[10px]">Add an actor to start capture routing</p>
              </div>
              <button onClick={() => setTab('add')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
                <Plus className="w-3 h-3" /> Add First Actor
              </button>
            </div>
          ) : (
            actors.map(actor => {
              const acMeta = meta[actor.actorName];
              const acColor = acMeta?.color ?? ACTOR_COLORS[0];
              const isSelected = selected === actor.actorName;
              return (
                <div key={actor.actorName}
                  onClick={() => setSelected(actor.actorName)}
                  className="p-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: isSelected ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${isSelected ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  {/* Top row */}
                  <div className="flex items-center gap-2.5 mb-2">
                    {/* Color avatar */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-black text-xs"
                      style={{ background: acColor, color: '#000', opacity: 0.9 }}>
                      {actor.actorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{actor.actorName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Dot active={actor.isActive} pulse />
                        <span className="text-[9px]"
                          style={{ color: actor.isActive ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                          {actor.isActive ? 'LIVE' : 'IDLE'}
                        </span>
                        {actor.frameRate > 0 && (
                          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            · {actor.frameRate}fps
                          </span>
                        )}
                        {actor.lastFrameMs > 0 && (
                          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                        )}
                        {actor.lastFrameMs > 0 && <FrameAge lastFrameMs={actor.lastFrameMs} />}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setSelected(actor.actorName); setTab('configure'); }}
                        className="p-1 rounded transition-opacity hover:opacity-80"
                        style={{ color: isSelected ? '#f97316' : 'rgba(255,255,255,0.25)' }}
                        title="Configure">
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleRemoveActor(actor.actorName); }}
                        className="p-1 rounded transition-opacity hover:opacity-80"
                        style={{ color: 'rgba(239,68,68,0.5)' }}
                        title="Remove actor">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Capture channel toggles */}
                  <div className="flex items-center gap-1.5">
                    <ToggleChip
                      active={actor.hasBody} label="BODY" color="#22c55e"
                      onClick={() => toggleCapture(actor.actorName, 'hasBody')} />
                    <ToggleChip
                      active={actor.hasFace} label="FACE" color="#60a5fa"
                      onClick={() => toggleCapture(actor.actorName, 'hasFace')} />
                    <ToggleChip
                      active={actor.hasHands} label="HANDS" color="#a855f7"
                      onClick={() => toggleCapture(actor.actorName, 'hasHands')} />
                    {isSelected && (
                      <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316' }}>
                        SELECTED
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Multi-actor note */}
          {actors.length > 1 && (
            <div className="pt-2">
              <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Multi-actor streaming requires HoloSuit Teamsharing in Studio.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══ ADD tab ════════════════════════════════════════════════════════ */}
      {tab === 'add' && (
        <div className="px-4 pb-6 space-y-4">
          <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Add new Actor</p>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.3)' }}>Actor Name</label>
            <input
              value={draft.name}
              onChange={e => { setDraft(d => ({ ...d, name: e.target.value })); setNameError(''); }}
              placeholder="e.g. C2J"
              className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-600 outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${nameError ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
              }}
            />
            {nameError && (
              <p className="text-[10px] text-red-400">{nameError}</p>
            )}
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.3)' }}>Color</label>
            <div className="grid grid-cols-6 gap-1.5">
              {ACTOR_COLORS.map(c => (
                <button key={c} onClick={() => setDraft(d => ({ ...d, color: c }))}
                  className="aspect-square rounded-lg relative transition-transform hover:scale-110"
                  style={{
                    background: c,
                    outline: draft.color === c ? '2px solid white' : '2px solid transparent',
                    outlineOffset: 2,
                  }}>
                  {draft.color === c && (
                    <Check className="absolute inset-0 m-auto w-3 h-3 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Capture channels */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.3)' }}>Capture Channels</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: 'hasBody' as const,  label: 'Body',  color: '#22c55e' },
                { key: 'hasFace' as const,  label: 'Face',  color: '#60a5fa' },
                { key: 'hasHands' as const, label: 'Hands', color: '#a855f7' },
              ]).map(({ key, label, color }) => (
                <button key={key}
                  onClick={() => setDraft(d => ({ ...d, [key]: !d[key] }))}
                  className="py-2 rounded-lg text-[10px] font-bold transition-all"
                  style={{
                    background: draft[key] ? `${color}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${draft[key] ? color + '40' : 'rgba(255,255,255,0.08)'}`,
                    color: draft[key] ? color : 'rgba(255,255,255,0.3)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Height */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.3)' }}>Total Height (cm)</label>
            <input
              type="number" min={100} max={250}
              value={draft.measurements.totalHeight}
              onChange={e => setMeasurement('totalHeight', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Additional measurements */}
          <button onClick={() => setDraft(d => ({ ...d, showMeasurements: !d.showMeasurements }))}
            className="flex items-center gap-1.5 text-[10px] font-bold transition-opacity hover:opacity-80"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0 }}>
            {draft.showMeasurements
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />
            }
            Additional Measurements
          </button>

          {draft.showMeasurements && (
            <div className="p-3 rounded-lg space-y-2"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {MEASUREMENT_FIELDS.map(f => (
                <div key={f.key} className="flex items-center gap-3">
                  <label className="flex-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {f.label}
                  </label>
                  <input
                    type="number" placeholder="—"
                    value={draft.measurements[f.key] || ''}
                    onChange={e => setMeasurement(f.key, e.target.value)}
                    className="w-16 px-2 py-1 rounded text-[11px] text-right text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <span className="text-[9px] w-5 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>cm</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setTab('actors'); setDraft({ ...DEFAULT_DRAFT }); setNameError(''); }}
              className="py-2.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
            <button onClick={handleAddActor}
              className="py-2.5 rounded-lg text-xs font-bold"
              style={{ background: '#f97316', color: '#000', border: 'none' }}>
              Add Actor
            </button>
          </div>
        </div>
      )}

      {/* ══ CONFIGURE tab ══════════════════════════════════════════════════ */}
      {tab === 'configure' && (
        <div className="px-4 pb-6 space-y-4">
          {!selectedActor ? (
            <div className="flex flex-col items-center gap-3 py-12"
              style={{ color: 'rgba(255,255,255,0.18)' }}>
              <Settings className="w-8 h-8" />
              <p className="text-xs text-center">Select an actor from the Actors tab to configure it.</p>
            </div>
          ) : (
            <>
              {/* Actor identity card */}
              <div className="p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-base"
                    style={{ background: selectedMeta?.color ?? ACTOR_COLORS[0], color: '#000' }}>
                    {selectedActor.actorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{selectedActor.actorName}</p>
                    <div className="flex items-center gap-1.5">
                      <Dot active={selectedActor.isActive} pulse />
                      <span className="text-[10px]"
                        style={{ color: selectedActor.isActive ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                        {selectedActor.isActive ? 'Live' : 'Idle'}
                      </span>
                      {selectedActor.frameRate > 0 && (
                        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          · {selectedActor.frameRate}fps
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Color</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {ACTOR_COLORS.map(c => (
                    <button key={c}
                      onClick={() => setMeta(m => ({ ...m, [selectedActor.actorName]: { ...m[selectedActor.actorName], color: c } }))}
                      className="aspect-square rounded-lg relative transition-transform hover:scale-110"
                      style={{
                        background: c,
                        outline: (selectedMeta?.color ?? ACTOR_COLORS[0]) === c ? '2px solid white' : '2px solid transparent',
                        outlineOffset: 2,
                      }}>
                      {(selectedMeta?.color ?? ACTOR_COLORS[0]) === c && (
                        <Check className="absolute inset-0 m-auto w-3 h-3 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Capture channels */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Capture Channels</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: 'hasBody'  as const, label: 'Body',  color: '#22c55e' },
                    { key: 'hasFace'  as const, label: 'Face',  color: '#60a5fa' },
                    { key: 'hasHands' as const, label: 'Hands', color: '#a855f7' },
                  ]).map(({ key, label, color }) => (
                    <button key={key}
                      onClick={() => toggleCapture(selectedActor.actorName, key)}
                      className="py-2.5 rounded-lg text-[10px] font-bold transition-all"
                      style={{
                        background: selectedActor[key] ? `${color}18` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${selectedActor[key] ? color + '40' : 'rgba(255,255,255,0.08)'}`,
                        color: selectedActor[key] ? color : 'rgba(255,255,255,0.3)',
                      }}>
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{label}</span>
                        <span style={{ color: selectedActor[key] ? color : 'rgba(255,255,255,0.2)', opacity: 0.7 }}>
                          {selectedActor[key] ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Measurements */}
              <div>
                <button onClick={() => setEditMeasOpen(v => !v)}
                  className="flex items-center justify-between w-full text-left mb-2"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <label className="text-[10px] font-bold tracking-widest uppercase cursor-pointer"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Body Measurements</label>
                  {editMeasOpen
                    ? <ChevronDown className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    : <ChevronRight className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  }
                </button>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Height</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {selectedMeta?.measurements.totalHeight ?? 175} cm
                  </span>
                </div>
                {editMeasOpen && (
                  <div className="mt-2 p-3 rounded-lg space-y-2"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Total Height
                      </label>
                      <input
                        type="number" min={100} max={250}
                        value={selectedMeta?.measurements.totalHeight ?? 175}
                        onChange={e => setConfigMeasurement(selectedActor.actorName, 'totalHeight', e.target.value)}
                        className="w-16 px-2 py-1 rounded text-[11px] text-right text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                      <span className="text-[9px] w-5" style={{ color: 'rgba(255,255,255,0.25)' }}>cm</span>
                    </div>
                    {MEASUREMENT_FIELDS.map(f => (
                      <div key={f.key} className="flex items-center gap-3">
                        <label className="flex-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {f.label}
                        </label>
                        <input
                          type="number" placeholder="—"
                          value={selectedMeta?.measurements[f.key] || ''}
                          onChange={e => setConfigMeasurement(selectedActor.actorName, f.key, e.target.value)}
                          className="w-16 px-2 py-1 rounded text-[11px] text-right text-white outline-none"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                        <span className="text-[9px] w-5" style={{ color: 'rgba(255,255,255,0.25)' }}>cm</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div className="pt-2">
                <button
                  onClick={() => { handleRemoveActor(selectedActor.actorName); setTab('actors'); }}
                  className="w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove {selectedActor.actorName}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
