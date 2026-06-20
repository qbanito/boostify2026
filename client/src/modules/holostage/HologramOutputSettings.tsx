// ─── HologramOutputSettings ───────────────────────────────────────────────────
// Output settings panel wired to the hologram renderer in real-time.
// Every change is immediately reflected in the viewport.

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, Maximize2, Tv2, Radio, Layers,
  RotateCcw, Save, ChevronDown, ChevronUp, Zap, Eye, Sun,
  Contrast, Droplets, Palette, Sparkles, Activity,
  RefreshCw, Copy,
} from 'lucide-react';
import type {
  HologramOutputSettings as Settings,
  HologramEffect, BackgroundMode, OutputFormat, OutputType,
} from '../../schemas/holostage/hologramOutput.schema';
import { DEFAULT_OUTPUT_SETTINGS } from '../../schemas/holostage/hologramOutput.schema';
import { hologramOutputManager } from '../../services/holostage/hologramOutputManager';

// ─── Props ────────────────────────────────────────────────────────────────────

interface HologramOutputSettingsProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onRequestFullscreen: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toggle({ label, sublabel, value, onChange, accentColor = '#f97316' }: {
  label: string; sublabel?: string; value: boolean; accentColor?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer gap-3">
      <div className="min-w-0">
        <div className="text-xs text-gray-300 font-medium leading-tight">{label}</div>
        {sublabel && <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">{sublabel}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        className="w-10 h-5 rounded-full transition-all relative cursor-pointer flex-shrink-0"
        style={{ background: value ? accentColor : 'rgba(255,255,255,0.1)' }}
      >
        <motion.div
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
          animate={{ left: value ? 22 : 2 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        />
      </div>
    </label>
  );
}

function SliderField({
  label, value, min, max, step, onChange,
  format = (v: number) => v.toFixed(2),
  accentColor = '#f97316',
  icon,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
  accentColor?: string; icon?: React.ReactNode;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {icon && <span style={{ color: accentColor }}>{icon}</span>}
          <label className="text-xs text-gray-400">{label}</label>
        </div>
        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(255,255,255,0.06)', color: accentColor }}>{format(value)}</span>
      </div>
      <div className="relative h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accentColor}80, ${accentColor})` }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 bg-black transition-all"
          style={{ left: `calc(${pct}% - 6px)`, borderColor: accentColor }} />
      </div>
    </div>
  );
}

function SectionBox({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{title}</span>
        {open ? <ChevronUp className="w-3 h-3 text-gray-600" /> : <ChevronDown className="w-3 h-3 text-gray-600" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="pt-2 space-y-3">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipPicker<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(opt => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              background: active ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.04)',
              color: active ? '#f97316' : '#6b7280',
              border: `1px solid ${active ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {opt.icon && <span className="w-3 h-3">{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Live Filter Preview ──────────────────────────────────────────────────────

function FilterPreview({ settings }: { settings: Settings }) {
  const filterCSS = hologramOutputManager.buildFilterCSS(settings);
  const bgColors: Record<BackgroundMode, string> = {
    pure_black: '#000',
    grid: 'repeating-linear-gradient(0deg,transparent,transparent 6px,rgba(249,115,22,0.1) 6px,rgba(249,115,22,0.1) 7px),repeating-linear-gradient(90deg,transparent,transparent 6px,rgba(249,115,22,0.1) 6px,rgba(249,115,22,0.1) 7px)',
    stage: 'linear-gradient(to top, rgba(249,115,22,0.06), transparent)',
    transparent: 'repeating-conic-gradient(rgba(255,255,255,0.05) 0% 25%, transparent 0% 50%) 0 0 / 8px 8px',
  };
  const effectTints: Record<HologramEffect, string> = {
    holographic: 'rgba(0,212,255,0.15)',
    scanlines: 'rgba(0,255,180,0.1)',
    crt: 'rgba(0,160,255,0.1)',
    phosphor: 'rgba(0,255,100,0.1)',
    none: 'transparent',
  };

  return (
    <div className="relative w-full rounded-lg overflow-hidden" style={{ height: 56, background: bgColors[settings.background] }}>
      <div className="absolute inset-0" style={{ background: effectTints[settings.hologramEffect], filter: filterCSS, mixBlendMode: 'screen' }} />
      {(settings.hologramEffect === 'scanlines' || settings.hologramEffect === 'holographic') && (
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.25) 2px,rgba(0,0,0,0.25) 4px)',
          opacity: 0.5 * settings.effectIntensity,
        }} />
      )}
      {settings.vignetteEnabled && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${settings.vignetteStrength ?? 0.6}) 100%)`,
        }} />
      )}
      {settings.chromaticAberration && (
        <div className="absolute bottom-1 right-1 text-[9px] font-bold px-1 rounded"
          style={{ background: 'rgba(0,212,255,0.2)', color: '#00D4FF' }}>CA</div>
      )}
      {settings.mirrorMode && (
        <div className="absolute bottom-1 left-1 text-[9px] font-bold px-1 rounded"
          style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316' }}>⇔</div>
      )}
      <div className="absolute top-1 left-2 text-[9px] font-bold uppercase tracking-widest text-gray-600">Preview</div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-2xl opacity-30">👤</div>
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const OUTPUT_TYPE_OPTIONS: { id: OutputType; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'preview', label: 'Preview', icon: <Monitor className="w-3.5 h-3.5" />, desc: 'In-app monitor' },
  { id: 'fullscreen', label: 'Fullscreen', icon: <Maximize2 className="w-3.5 h-3.5" />, desc: 'Full display' },
  { id: 'peppers_ghost', label: "Pepper's", icon: <Tv2 className="w-3.5 h-3.5" />, desc: '45° projection' },
  { id: 'led_volume', label: 'LED Vol.', icon: <Layers className="w-3.5 h-3.5" />, desc: 'LED stage wall' },
  { id: 'ndi_streaming', label: 'NDI', icon: <Radio className="w-3.5 h-3.5" />, desc: 'Network stream' },
];

const EFFECT_OPTIONS: { id: HologramEffect; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'holographic', label: 'Holographic' },
  { id: 'scanlines', label: 'Scanlines' },
  { id: 'crt', label: 'CRT' },
  { id: 'phosphor', label: 'Phosphor' },
];

const BG_OPTIONS: { id: BackgroundMode; label: string }[] = [
  { id: 'pure_black', label: 'Pure Black' },
  { id: 'grid', label: 'Grid' },
  { id: 'stage', label: 'Stage' },
  { id: 'transparent', label: 'Transparent' },
];

const FORMAT_OPTIONS: { id: OutputFormat; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '4:3', label: '4:3' },
  { id: '1:1', label: '1:1' },
  { id: 'peppers_ghost', label: "Pepper's" },
];

const RESOLUTION_PRESETS = [
  { label: '720p', w: 1280, h: 720 },
  { label: '1080p', w: 1920, h: 1080 },
  { label: '1440p', w: 2560, h: 1440 },
  { label: '4K', w: 3840, h: 2160 },
];

const BUILT_IN_PRESETS: { name: string; icon: React.ReactNode; partial: Partial<Settings> }[] = [
  {
    name: 'Classic Hologram',
    icon: <Sparkles className="w-3 h-3" />,
    partial: {
      hologramEffect: 'holographic', effectIntensity: 0.7, brightness: 1.3, contrast: 1.2, saturation: 0.8,
      hueShift: 0, chromaticAberration: true, chromaticAberrationStrength: 2,
      bloomEnabled: true, bloomIntensity: 0.5, vignetteEnabled: true, vignetteStrength: 0.7,
    },
  },
  {
    name: 'CRT Retro',
    icon: <Tv2 className="w-3 h-3" />,
    partial: {
      hologramEffect: 'crt', effectIntensity: 0.8, brightness: 1.0, contrast: 1.3, saturation: 0.6,
      hueShift: 20, chromaticAberration: true, chromaticAberrationStrength: 3,
      bloomEnabled: false, bloomIntensity: 0, vignetteEnabled: true, vignetteStrength: 0.8,
    },
  },
  {
    name: 'Phosphor Green',
    icon: <Activity className="w-3 h-3" />,
    partial: {
      hologramEffect: 'phosphor', effectIntensity: 0.9, brightness: 1.1, contrast: 1.4, saturation: 0.0,
      hueShift: 90, chromaticAberration: false, bloomEnabled: true, bloomIntensity: 0.6,
      vignetteEnabled: true, vignetteStrength: 0.9,
    },
  },
  {
    name: 'LED Stage',
    icon: <Layers className="w-3 h-3" />,
    partial: {
      hologramEffect: 'none', effectIntensity: 0, brightness: 1.5, contrast: 1.0, saturation: 1.2,
      hueShift: 0, chromaticAberration: false, bloomEnabled: true, bloomIntensity: 0.3,
      vignetteEnabled: false, vignetteStrength: 0, background: 'stage',
    },
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function HologramOutputSettings({ settings, onChange, onRequestFullscreen }: HologramOutputSettingsProps) {
  const [savedMsg, setSavedMsg] = useState(false);

  const update = useCallback((partial: Partial<Settings>) => {
    onChange({ ...settings, ...partial });
    hologramOutputManager.updateSettings(partial);
  }, [settings, onChange]);

  const handleReset = () => onChange({ ...DEFAULT_OUTPUT_SETTINGS });

  const handleSavePreset = () => {
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const outputLabel = hologramOutputManager.getOutputLabel(settings);

  return (
    <div className="space-y-3 text-sm">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-black text-white tracking-wider uppercase">Output Settings</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSavePreset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ background: savedMsg ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', color: savedMsg ? '#22c55e' : '#6b7280', border: `1px solid ${savedMsg ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}` }}
          >
            <Save className="w-3 h-3" />
            {savedMsg ? 'Saved!' : 'Save'}
          </button>
          <button
            onClick={onRequestFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}
          >
            <Maximize2 className="w-3 h-3" /> Fullscreen
          </button>
        </div>
      </div>

      {/* ─── Live Preview ─────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Live Preview</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[10px] font-mono text-orange-400">{outputLabel} · {settings.resolution.width}×{settings.resolution.height} · {settings.fps}fps</span>
          </div>
        </div>
        <FilterPreview settings={settings} />
      </div>

      {/* ─── Output Destination ───────────────────────────────────────────── */}
      <SectionBox title="Output Destination">
        <div className="grid grid-cols-5 gap-1">
          {OUTPUT_TYPE_OPTIONS.map(opt => {
            const active = settings.outputType === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => update({ outputType: opt.id })}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
                style={{
                  background: active ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#f97316' : '#6b7280',
                  border: `1px solid ${active ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }}
                title={opt.desc}
              >
                {opt.icon}
                <span className="text-[9px] font-bold leading-tight text-center">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {(settings.outputType === 'fullscreen' || settings.outputType === 'peppers_ghost') && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={onRequestFullscreen}
              className="w-full py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316', border: '1px solid rgba(249,115,22,0.4)' }}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Launch on Display {(settings.outputDisplay ?? 0) + 1}
            </button>
          </motion.div>
        )}

        {settings.outputType === 'ndi_streaming' && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="p-2.5 rounded-xl flex items-start gap-2"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-bold text-emerald-400">NDI Stream Active</div>
              <div className="text-[10px] text-gray-600 mt-0.5">Visible to OBS, vMix, Resolume on local network</div>
            </div>
          </motion.div>
        )}

        <div>
          <label className="text-xs text-gray-600 block mb-1.5">Output Display (Monitor)</label>
          <div className="flex gap-1">
            {[0, 1, 2].map(idx => (
              <button
                key={idx}
                onClick={() => update({ outputDisplay: idx })}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: settings.outputDisplay === idx ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                  color: settings.outputDisplay === idx ? '#f97316' : '#4b5563',
                  border: `1px solid ${settings.outputDisplay === idx ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {idx === 0 ? 'Primary' : `Display ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      </SectionBox>

      {/* ─── Resolution & Format ──────────────────────────────────────────── */}
      <SectionBox title="Resolution & Format">
        <div>
          <div className="text-[10px] text-gray-600 mb-1.5">Quick Presets</div>
          <div className="grid grid-cols-4 gap-1">
            {RESOLUTION_PRESETS.map(p => {
              const active = settings.resolution.width === p.w && settings.resolution.height === p.h;
              return (
                <button
                  key={p.label}
                  onClick={() => update({ resolution: { width: p.w, height: p.h } })}
                  className="py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: active ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#f97316' : '#555',
                    border: `1px solid ${active ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Width', key: 'width' as const, options: [1280, 1920, 2560, 3840] },
            { label: 'Height', key: 'height' as const, options: [720, 1080, 1440, 2160] },
          ].map(field => (
            <div key={field.label}>
              <label className="text-[10px] text-gray-600 block mb-1">{field.label}</label>
              <select
                value={settings.resolution[field.key]}
                onChange={e => update({ resolution: { ...settings.resolution, [field.key]: parseInt(e.target.value) } })}
                className="w-full bg-black/50 border rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                {field.options.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="text-[10px] text-gray-600 block mb-1">FPS</label>
            <select
              value={settings.fps}
              onChange={e => update({ fps: parseInt(e.target.value) })}
              className="w-full bg-black/50 border rounded-lg px-2 py-1.5 text-xs text-white outline-none"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              {[24, 30, 60, 120].map(f => <option key={f} value={f}>{f} fps</option>)}
            </select>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-600 mb-1.5">Aspect / Format</div>
          <ChipPicker options={FORMAT_OPTIONS} value={settings.format} onChange={v => update({ format: v })} />
        </div>
      </SectionBox>

      {/* ─── Environment ──────────────────────────────────────────────────── */}
      <SectionBox title="Environment">
        <ChipPicker options={BG_OPTIONS} value={settings.background} onChange={v => update({ background: v })} />
      </SectionBox>

      {/* ─── Hologram Effect ──────────────────────────────────────────────── */}
      <SectionBox title="Hologram Effect">
        <ChipPicker options={EFFECT_OPTIONS} value={settings.hologramEffect} onChange={v => update({ hologramEffect: v })} />
        {settings.hologramEffect !== 'none' && (
          <SliderField
            label="Effect Intensity" value={settings.effectIntensity} min={0} max={1} step={0.05}
            onChange={v => update({ effectIntensity: v })} format={v => `${(v * 100).toFixed(0)}%`}
            accentColor="#f97316" icon={<Zap className="w-3 h-3" />}
          />
        )}
      </SectionBox>

      {/* ─── Color Grade ──────────────────────────────────────────────────── */}
      <SectionBox title="Color Grade">
        <SliderField label="Brightness" value={settings.brightness} min={0.5} max={2} step={0.05}
          onChange={v => update({ brightness: v })} icon={<Sun className="w-3 h-3" />} accentColor="#fbbf24" />
        <SliderField label="Contrast" value={settings.contrast} min={0.5} max={2} step={0.05}
          onChange={v => update({ contrast: v })} icon={<Contrast className="w-3 h-3" />} accentColor="#94a3b8" />
        <SliderField label="Saturation" value={settings.saturation} min={0} max={2} step={0.05}
          onChange={v => update({ saturation: v })} icon={<Droplets className="w-3 h-3" />} accentColor="#6366f1" />
        <SliderField label="Hue Shift" value={settings.hueShift} min={-180} max={180} step={1}
          onChange={v => update({ hueShift: v })} format={v => `${v}°`}
          icon={<Palette className="w-3 h-3" />} accentColor="#ec4899" />
        <button
          onClick={() => update({ brightness: 1, contrast: 1, saturation: 1, hueShift: 0 })}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
        >
          <RefreshCw className="w-2.5 h-2.5" /> Reset color grade
        </button>
      </SectionBox>

      {/* ─── Post-Process Effects ─────────────────────────────────────────── */}
      <SectionBox title="Post-Process Effects">
        <Toggle label="Chromatic Aberration" sublabel="RGB channel split at edges"
          value={settings.chromaticAberration} onChange={v => update({ chromaticAberration: v })} />
        {settings.chromaticAberration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SliderField label="CA Strength" value={settings.chromaticAberrationStrength ?? 2}
              min={0.5} max={8} step={0.5} onChange={v => update({ chromaticAberrationStrength: v })}
              format={v => `${v}px`} accentColor="#00D4FF" />
          </motion.div>
        )}
        <Toggle label="Bloom" sublabel="Glow around bright areas"
          value={settings.bloomEnabled} onChange={v => update({ bloomEnabled: v })} />
        {settings.bloomEnabled && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SliderField label="Bloom Intensity" value={settings.bloomIntensity} min={0} max={1} step={0.05}
              onChange={v => update({ bloomIntensity: v })} format={v => `${(v * 100).toFixed(0)}%`} accentColor="#f97316" />
          </motion.div>
        )}
        <Toggle label="Vignette" sublabel="Dark edges around frame"
          value={settings.vignetteEnabled} onChange={v => update({ vignetteEnabled: v })} />
        {settings.vignetteEnabled && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SliderField label="Vignette Strength" value={settings.vignetteStrength ?? 0.6} min={0} max={1} step={0.05}
              onChange={v => update({ vignetteStrength: v })} format={v => `${(v * 100).toFixed(0)}%`} accentColor="#8b5cf6" />
          </motion.div>
        )}
        <Toggle label="Mirror Mode" sublabel="Horizontal flip for Pepper's Ghost"
          value={settings.mirrorMode} onChange={v => update({ mirrorMode: v })} accentColor="#00D4FF" />
        <Toggle label="Glitch Effect" sublabel="Random digital distortion pulses"
          value={settings.glitchEnabled ?? false} onChange={v => update({ glitchEnabled: v })} accentColor="#ef4444" />
        {settings.glitchEnabled && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SliderField label="Glitch Intensity" value={settings.glitchIntensity ?? 0.3} min={0.1} max={1} step={0.1}
              onChange={v => update({ glitchIntensity: v })} format={v => `${(v * 100).toFixed(0)}%`} accentColor="#ef4444" />
          </motion.div>
        )}
      </SectionBox>

      {/* ─── Playback Behavior ────────────────────────────────────────────── */}
      <SectionBox title="Playback Behavior" defaultOpen={false}>
        <Toggle label="Fullscreen on Play" sublabel="Auto-fullscreen when show starts"
          value={settings.fullscreenOnPlay} onChange={v => update({ fullscreenOnPlay: v })} />
        <Toggle label="Loop Show" sublabel="Restart when last song ends"
          value={settings.loopShow} onChange={v => update({ loopShow: v })} />
      </SectionBox>

      {/* ─── Quick Presets ────────────────────────────────────────────────── */}
      <SectionBox title="Quick Presets" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-1.5">
          {BUILT_IN_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => update(preset.partial)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', color: '#f97316' }}
            >
              <span className="text-orange-400">{preset.icon}</span>
              <span className="text-xs font-semibold text-gray-300">{preset.name}</span>
            </button>
          ))}
        </div>
      </SectionBox>

      {/* ─── Footer Actions ───────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          onClick={handleReset}
          className="flex-1 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <RotateCcw className="w-3 h-3" /> Reset All
        </button>
        <button
          onClick={() => {
            const str = JSON.stringify(settings, null, 2);
            navigator.clipboard.writeText(str).catch(() => {});
          }}
          className="flex-1 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Copy className="w-3 h-3" /> Copy JSON
        </button>
      </div>
    </div>
  );
}
