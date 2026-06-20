// ─── LiveShowController ───────────────────────────────────────────────────────
// Complete Live Show Command Center — transport, presets, DMX, FX, telemetry.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, Square, SkipForward, SkipBack, Zap, Moon, AlertTriangle,
  Music, ChevronRight, X, Battery, Signal, Radio, Activity, Layers,
  Cpu, Wifi, WifiOff, Eye, Sparkles, Lightbulb, Mic2, Star, Flame,
  Tv2, Sunset, Wind, Wand2, ZapOff, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useHoloLang } from './holoLangContext';
import type { TimelineState } from '../../services/holostage/showTimelineEngine';
import type { ShowSong } from '../../schemas/holostage/showPackage.schema';
import type { TimelineCue } from '../../schemas/holostage/timelineCue.schema';
import type { HoloSuitNotification } from '../../schemas/holostage/motionSource.schema';
import { CUE_TYPE_COLORS, CUE_TYPE_LABELS } from '../../schemas/holostage/timelineCue.schema';
import { formatTime } from '../../services/holostage/audioSyncEngine';
import { showTimelineEngine } from '../../services/holostage/showTimelineEngine';
import { holosuitBridge } from '../../services/holostage/holosuitBridge';
import { dmxEngine } from '../../services/holostage/dmxEngine';
import { visualFxEngine } from '../../services/holostage/visualFxEngine';
import { hologramOutputManager } from '../../services/holostage/hologramOutputManager';
import type { DMXScene } from '../../schemas/holostage/dmx.schema';
import type { FXEffectType } from '../../services/holostage/visualFxEngine';

// ─── Props ───────────────────────────────────────────────────────────────────

interface LiveShowControllerProps {
  timelineState: TimelineState;
  songs: ShowSong[];
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNextSong: () => void;
  onPrevSong: () => void;
  onBlackout: () => void;
  onFallback: () => void;
  onSeek: (seconds: number) => void;
}

// ─── Show Presets ─────────────────────────────────────────────────────────────

interface ShowPreset {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  tags: string[];
  dmxScene: DMXScene;
  masterDimmer: number;
  fxType: FXEffectType;
  fxColor: string;
  fxIntensity: number;
  outputBrightness: number;
  outputEffect: 'none' | 'scanlines' | 'crt' | 'holographic' | 'phosphor';
  bloomIntensity: number;
  holosuitIntensity: number;
  chromaticAberration: boolean;
}

function makeDMXScene(
  id: string, name: string, color: string,
  channels: Array<{ channel: number; value: number; label?: string }>,
  mood: DMXScene['mood'], fadeIn: number, intensity: number,
): DMXScene {
  return { id, name, description: '', channels, fixtures: [], color, fadeIn, fadeOut: fadeIn, intensity, mood };
}

const SHOW_PRESETS: ShowPreset[] = [
  {
    id: 'festival',
    name: 'Festival Stage',
    subtitle: 'High energy · Full production',
    icon: Flame,
    color: '#f97316',
    tags: ['FESTIVAL', 'HIGH ENERGY'],
    dmxScene: makeDMXScene('p-festival', 'Festival Stage', '#f97316',
      [{ channel: 1, value: 255, label: 'Red' }, { channel: 2, value: 60, label: 'Green' }, { channel: 3, value: 0, label: 'Blue' }, { channel: 4, value: 255, label: 'Dimmer' }, { channel: 5, value: 180, label: 'Strobe' }],
      'chorus', 300, 1.0),
    masterDimmer: 1.0, fxType: 'energy_wave', fxColor: '#f97316', fxIntensity: 1.0,
    outputBrightness: 1.4, outputEffect: 'holographic', bloomIntensity: 0.7,
    holosuitIntensity: 0.95, chromaticAberration: true,
  },
  {
    id: 'arena',
    name: 'Arena Concert',
    subtitle: 'Massive production · Full universe',
    icon: Star,
    color: '#eab308',
    tags: ['ARENA', 'FULL POWER'],
    dmxScene: makeDMXScene('p-arena', 'Arena Concert', '#eab308',
      [{ channel: 1, value: 255, label: 'Red' }, { channel: 2, value: 200, label: 'Green' }, { channel: 3, value: 0, label: 'Blue' }, { channel: 4, value: 255, label: 'Dimmer' }, { channel: 6, value: 220, label: 'Pan' }, { channel: 7, value: 180, label: 'Tilt' }],
      'chorus', 500, 1.0),
    masterDimmer: 1.0, fxType: 'particle_burst', fxColor: '#eab308', fxIntensity: 0.9,
    outputBrightness: 1.5, outputEffect: 'holographic', bloomIntensity: 0.8,
    holosuitIntensity: 1.0, chromaticAberration: true,
  },
  {
    id: 'club',
    name: 'Club Night',
    subtitle: 'Pulsating purple · Dance floor energy',
    icon: Zap,
    color: '#8b5cf6',
    tags: ['CLUB', 'DANCE'],
    dmxScene: makeDMXScene('p-club', 'Club Night', '#8b5cf6',
      [{ channel: 1, value: 140, label: 'Red' }, { channel: 2, value: 0, label: 'Green' }, { channel: 3, value: 255, label: 'Blue' }, { channel: 4, value: 220, label: 'Dimmer' }, { channel: 5, value: 100, label: 'Strobe' }],
      'verse', 400, 0.95),
    masterDimmer: 0.95, fxType: 'hologram_flicker', fxColor: '#8b5cf6', fxIntensity: 0.5,
    outputBrightness: 1.2, outputEffect: 'scanlines', bloomIntensity: 0.6,
    holosuitIntensity: 0.8, chromaticAberration: true,
  },
  {
    id: 'intimate',
    name: 'Intimate Venue',
    subtitle: 'Warm amber · Soft atmosphere',
    icon: Mic2,
    color: '#d97706',
    tags: ['INTIMATE', 'ACOUSTIC'],
    dmxScene: makeDMXScene('p-intimate', 'Intimate Venue', '#d97706',
      [{ channel: 1, value: 200, label: 'Red' }, { channel: 2, value: 120, label: 'Green' }, { channel: 3, value: 20, label: 'Blue' }, { channel: 4, value: 160, label: 'Dimmer' }],
      'verse', 2000, 0.65),
    masterDimmer: 0.7, fxType: 'vignette', fxColor: '#d97706', fxIntensity: 0.4,
    outputBrightness: 1.1, outputEffect: 'phosphor', bloomIntensity: 0.3,
    holosuitIntensity: 0.5, chromaticAberration: false,
  },
  {
    id: 'tv_studio',
    name: 'TV Studio',
    subtitle: 'Clean · Controlled · Broadcast ready',
    icon: Tv2,
    color: '#3b82f6',
    tags: ['BROADCAST', 'STUDIO'],
    dmxScene: makeDMXScene('p-tv', 'TV Studio', '#3b82f6',
      [{ channel: 1, value: 180, label: 'Red' }, { channel: 2, value: 180, label: 'Green' }, { channel: 3, value: 180, label: 'Blue' }, { channel: 4, value: 240, label: 'Dimmer' }],
      'custom', 1000, 0.8),
    masterDimmer: 0.85, fxType: 'fade_in_character', fxColor: '#3b82f6', fxIntensity: 0.7,
    outputBrightness: 1.3, outputEffect: 'none', bloomIntensity: 0.2,
    holosuitIntensity: 0.6, chromaticAberration: false,
  },
  {
    id: 'outdoor',
    name: 'Outdoor Concert',
    subtitle: 'Daylight-safe · High contrast',
    icon: Sunset,
    color: '#f59e0b',
    tags: ['OUTDOOR', 'DAYLIGHT'],
    dmxScene: makeDMXScene('p-outdoor', 'Outdoor Concert', '#f59e0b',
      [{ channel: 1, value: 255, label: 'Red' }, { channel: 2, value: 220, label: 'Green' }, { channel: 3, value: 100, label: 'Blue' }, { channel: 4, value: 255, label: 'Dimmer' }],
      'chorus', 800, 1.0),
    masterDimmer: 1.0, fxType: 'color_flash', fxColor: '#f59e0b', fxIntensity: 0.6,
    outputBrightness: 1.8, outputEffect: 'holographic', bloomIntensity: 0.5,
    holosuitIntensity: 0.8, chromaticAberration: false,
  },
  {
    id: 'opening',
    name: 'Opening Ceremony',
    subtitle: 'Dramatic intro · Blue fog atmosphere',
    icon: Sparkles,
    color: '#06b6d4',
    tags: ['OPENING', 'DRAMATIC'],
    dmxScene: makeDMXScene('p-opening', 'Opening Ceremony', '#06b6d4',
      [{ channel: 1, value: 0, label: 'Red' }, { channel: 2, value: 100, label: 'Green' }, { channel: 3, value: 255, label: 'Blue' }, { channel: 4, value: 80, label: 'Dimmer' }],
      'intro', 4000, 0.6),
    masterDimmer: 0.6, fxType: 'fade_in_character', fxColor: '#06b6d4', fxIntensity: 1.0,
    outputBrightness: 1.0, outputEffect: 'holographic', bloomIntensity: 0.9,
    holosuitIntensity: 0.4, chromaticAberration: true,
  },
  {
    id: 'encore',
    name: 'Encore Finale',
    subtitle: 'Maximum everything · Climactic',
    icon: Wand2,
    color: '#ec4899',
    tags: ['ENCORE', 'CLIMAX'],
    dmxScene: makeDMXScene('p-encore', 'Encore Finale', '#ec4899',
      [{ channel: 1, value: 255, label: 'Red' }, { channel: 2, value: 0, label: 'Green' }, { channel: 3, value: 200, label: 'Blue' }, { channel: 4, value: 255, label: 'Dimmer' }, { channel: 5, value: 255, label: 'Strobe' }],
      'outro', 200, 1.0),
    masterDimmer: 1.0, fxType: 'shockwave', fxColor: '#ec4899', fxIntensity: 1.0,
    outputBrightness: 1.6, outputEffect: 'holographic', bloomIntensity: 1.0,
    holosuitIntensity: 1.0, chromaticAberration: true,
  },
  {
    id: 'rehearsal',
    name: 'Rehearsal Mode',
    subtitle: 'Minimal FX · Full precision diagnostic',
    icon: Eye,
    color: '#6b7280',
    tags: ['REHEARSAL', 'TECH'],
    dmxScene: makeDMXScene('p-rehearsal', 'Rehearsal Mode', '#6b7280',
      [{ channel: 1, value: 160, label: 'Red' }, { channel: 2, value: 160, label: 'Green' }, { channel: 3, value: 160, label: 'Blue' }, { channel: 4, value: 200, label: 'Dimmer' }],
      'custom', 100, 0.7),
    masterDimmer: 0.8, fxType: 'none', fxColor: '#6b7280', fxIntensity: 0,
    outputBrightness: 1.0, outputEffect: 'none', bloomIntensity: 0.1,
    holosuitIntensity: 0.4, chromaticAberration: false,
  },
  {
    id: 'edm_drop',
    name: 'EDM Drop',
    subtitle: 'Full color explosion · Beat sync strobe',
    icon: Radio,
    color: '#14b8a6',
    tags: ['EDM', 'RAVE'],
    dmxScene: makeDMXScene('p-edm', 'EDM Drop', '#14b8a6',
      [{ channel: 1, value: 0, label: 'Red' }, { channel: 2, value: 255, label: 'Green' }, { channel: 3, value: 255, label: 'Blue' }, { channel: 4, value: 255, label: 'Dimmer' }, { channel: 5, value: 200, label: 'Strobe' }, { channel: 8, value: 255, label: 'FX' }],
      'chorus', 100, 1.0),
    masterDimmer: 1.0, fxType: 'energy_wave', fxColor: '#14b8a6', fxIntensity: 1.0,
    outputBrightness: 1.5, outputEffect: 'holographic', bloomIntensity: 0.9,
    holosuitIntensity: 0.9, chromaticAberration: true,
  },
  {
    id: 'hiphop',
    name: 'Hip-Hop Show',
    subtitle: 'Blue-purple sharp · Street energy',
    icon: Mic2,
    color: '#6366f1',
    tags: ['HIP-HOP', 'URBAN'],
    dmxScene: makeDMXScene('p-hiphop', 'Hip-Hop Show', '#6366f1',
      [{ channel: 1, value: 60, label: 'Red' }, { channel: 2, value: 0, label: 'Green' }, { channel: 3, value: 255, label: 'Blue' }, { channel: 4, value: 200, label: 'Dimmer' }, { channel: 6, value: 140, label: 'Pan' }],
      'verse', 600, 0.9),
    masterDimmer: 0.9, fxType: 'scan_lines', fxColor: '#6366f1', fxIntensity: 0.5,
    outputBrightness: 1.2, outputEffect: 'scanlines', bloomIntensity: 0.5,
    holosuitIntensity: 0.85, chromaticAberration: true,
  },
  {
    id: 'fog',
    name: 'Fog & Atmosphere',
    subtitle: 'Mysterious haze · Deep purple smoke',
    icon: Wind,
    color: '#7c3aed',
    tags: ['FOG', 'ATMOSPHERE'],
    dmxScene: makeDMXScene('p-fog', 'Fog & Atmosphere', '#7c3aed',
      [{ channel: 1, value: 80, label: 'Red' }, { channel: 2, value: 0, label: 'Green' }, { channel: 3, value: 180, label: 'Blue' }, { channel: 4, value: 120, label: 'Dimmer' }, { channel: 9, value: 200, label: 'Fog' }],
      'bridge', 3000, 0.65),
    masterDimmer: 0.65, fxType: 'chromatic_aberration', fxColor: '#7c3aed', fxIntensity: 0.6,
    outputBrightness: 0.9, outputEffect: 'crt', bloomIntensity: 0.7,
    holosuitIntensity: 0.5, chromaticAberration: true,
  },
];

// ─── Visual FX Quick Buttons ──────────────────────────────────────────────────

const FX_BUTTONS: Array<{ type: FXEffectType; label: string; color: string; icon: React.ElementType }> = [
  { type: 'energy_wave',       label: 'Energy Wave',   color: '#f97316', icon: Zap },
  { type: 'color_flash',       label: 'Color Flash',   color: '#eab308', icon: Flame },
  { type: 'particle_burst',    label: 'Particles',     color: '#ec4899', icon: Sparkles },
  { type: 'hologram_flicker',  label: 'HoloFlicker',  color: '#06b6d4', icon: Tv2 },
  { type: 'glitch',            label: 'Glitch',        color: '#ef4444', icon: Radio },
  { type: 'shockwave',         label: 'Shockwave',     color: '#8b5cf6', icon: Star },
  { type: 'scan_lines',        label: 'Scanlines',     color: '#6b7280', icon: Layers },
  { type: 'fade_in_character', label: 'Fade In',       color: '#22c55e', icon: Eye },
];

// ─── Apply preset to all engines ─────────────────────────────────────────────

function applyPreset(preset: ShowPreset) {
  dmxEngine.activateScene(preset.dmxScene);
  dmxEngine.setMasterDimmer(preset.masterDimmer);

  if (preset.fxType !== 'none' && preset.fxIntensity > 0) {
    visualFxEngine.triggerEffect(preset.fxType, {
      color:     preset.fxColor,
      intensity: preset.fxIntensity,
      duration:  2.5,
    });
  }

  hologramOutputManager.updateSettings({
    brightness:          preset.outputBrightness,
    hologramEffect:      preset.outputEffect,
    bloomIntensity:      preset.bloomIntensity,
    chromaticAberration: preset.chromaticAberration,
  });

  if (holosuitBridge.isConnected()) {
    holosuitBridge.startSimulation(60, preset.holosuitIntensity);
  }
}

// ─── TransportButton ──────────────────────────────────────────────────────────

function TransportButton({
  onClick, icon: Icon, label, variant = 'default', large = false, active = false,
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  variant?: 'default' | 'primary' | 'danger' | 'warning';
  large?: boolean;
  active?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
      color:      active ? '#fff' : '#6b7280',
      border:     `1px solid ${active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
    },
    primary: {
      background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.15))',
      color:      '#f97316',
      border:     '1px solid rgba(249,115,22,0.4)',
      boxShadow:  '0 0 14px rgba(249,115,22,0.2)',
    },
    danger: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' },
    warning: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' },
  };

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl transition-all hover:scale-105 active:scale-95"
      style={{ ...styles[variant], padding: large ? '12px 20px' : '8px 14px', minWidth: large ? 72 : 52 }}
      title={label}
    >
      <Icon size={large ? 22 : 16} />
      <span style={{ fontSize: 9, letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', opacity: 0.7 }}>
        {label}
      </span>
    </button>
  );
}

// ─── System Telemetry ─────────────────────────────────────────────────────────

function SystemTelemetry() {
  const [fps, setFps] = useState(0);
  const [suitConnected, setSuitConnected] = useState(false);
  const [dmxActive, setDmxActive] = useState(false);
  const [masterDimmer, setMasterDimmer] = useState(1);

  useEffect(() => {
    setSuitConnected(holosuitBridge.isConnected());
    const unsubSuit   = holosuitBridge.onFrame(() => setSuitConnected(true));
    const unsubOutput = hologramOutputManager.onChange(s => setFps(s.fps));
    const unsubDmx    = dmxEngine.onChange(s => {
      setDmxActive(!!s.activeScene);
      setMasterDimmer(s.masterDimmer);
    });
    return () => { unsubSuit(); unsubOutput(); unsubDmx(); };
  }, []);

  const items = [
    { label: 'HoloSuit', value: suitConnected ? 'ONLINE' : 'OFFLINE', color: suitConnected ? '#22c55e' : '#ef4444', icon: suitConnected ? Wifi : WifiOff },
    { label: 'DMX',      value: dmxActive ? 'ACTIVE' : 'STANDBY',      color: dmxActive ? '#a855f7' : '#52525b',   icon: Lightbulb },
    { label: 'RENDERER', value: fps > 0 ? `${fps}fps` : 'IDLE',         color: fps >= 50 ? '#22c55e' : fps >= 30 ? '#f59e0b' : '#52525b', icon: Cpu },
    { label: 'MASTER',   value: `${(masterDimmer * 100).toFixed(0)}%`,  color: '#f97316',                           icon: Activity },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ label, value, color, icon: Icon }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-1 p-2 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.45)', border: `1px solid ${color}18` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span className="font-mono font-black text-xs leading-none" style={{ color }}>{value}</span>
          <span className="font-bold uppercase tracking-widest leading-none" style={{ fontSize: 8, color: '#3f3f46' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Preset Card ─────────────────────────────────────────────────────────────

function PresetCard({ preset, isActive, onApply }: { preset: ShowPreset; isActive: boolean; onApply: () => void }) {
  const Icon = preset.icon;
  return (
    <button
      onClick={onApply}
      className="relative flex items-center gap-2.5 p-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden w-full"
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${preset.color}22, ${preset.color}08)`
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? preset.color + '50' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isActive ? `0 0 16px ${preset.color}22` : 'none',
      }}
    >
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{ background: `radial-gradient(circle at 20% 50%, ${preset.color}, transparent 70%)` }}
        />
      )}
      <div
        className="shrink-0 p-2 rounded-lg"
        style={{ background: `${preset.color}18`, border: `1px solid ${preset.color}25`, color: preset.color }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-black text-white leading-none truncate">{preset.name}</span>
          {isActive && <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: '#22c55e', boxShadow: '0 0 4px #22c55e' }} />}
        </div>
        <p className="leading-none truncate mb-1" style={{ fontSize: 10, color: '#52525b' }}>{preset.subtitle}</p>
        <div className="flex gap-1 flex-wrap">
          {preset.tags.map(tag => (
            <span
              key={tag}
              className="font-bold leading-none px-1 rounded"
              style={{ fontSize: 8, letterSpacing: '0.1em', background: `${preset.color}15`, color: preset.color }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

// ─── Visual FX Panel ─────────────────────────────────────────────────────────

function FXPanel() {
  const [lastFired, setLastFired] = useState<string | null>(null);

  const fire = useCallback((type: FXEffectType, color: string) => {
    visualFxEngine.triggerEffect(type, { color, intensity: 0.85, duration: 2 });
    setLastFired(type);
    setTimeout(() => setLastFired(null), 1200);
  }, []);

  return (
    <div
      className="rounded-2xl border p-3"
      style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#71717a' }}>Visual FX</span>
        {lastFired && (
          <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full animate-pulse" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', fontSize: 9 }}>
            FIRED
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {FX_BUTTONS.map(({ type, label, color, icon: Icon }) => (
          <button
            key={type}
            onClick={() => fire(type, color)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
            style={{
              background: lastFired === type ? `${color}22` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${lastFired === type ? color + '40' : 'rgba(255,255,255,0.07)'}`,
              boxShadow: lastFired === type ? `0 0 8px ${color}40` : 'none',
            }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <span className="font-bold text-center leading-none" style={{ fontSize: 8, color: '#52525b', letterSpacing: '0.05em' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Song Section Bar ─────────────────────────────────────────────────────────

function SongSectionBar({ song, position }: { song: ShowSong; position: number }) {
  if (!song.sections || song.sections.length === 0) return null;

  const activeSection = song.sections.find(s => position >= s.start && position <= s.end);
  const SECTION_COLORS: Record<string, string> = {
    intro: '#3b82f6', verse: '#8b5cf6', pre_chorus: '#a855f7',
    chorus: '#f97316', bridge: '#ec4899', outro: '#6b7280',
    solo: '#eab308', dance_break: '#14b8a6', crowd_interaction: '#22c55e', instrumental: '#64748b',
  };

  return (
    <div className="space-y-1">
      <div className="relative h-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {song.sections.map((section) => {
          const startPct = (section.start / song.duration) * 100;
          const widthPct = ((section.end - section.start) / song.duration) * 100;
          const color = SECTION_COLORS[section.name] ?? '#52525b';
          const isActive = activeSection?.start === section.start;
          return (
            <div
              key={`${section.name}-${section.start}`}
              className="absolute top-0 h-full flex items-center justify-center overflow-hidden"
              style={{
                left: `${startPct}%`, width: `${widthPct}%`,
                background: `${color}${isActive ? '55' : '22'}`,
                borderRight: '1px solid rgba(0,0,0,0.4)',
                transition: 'background 300ms',
              }}
            >
              <span className="font-bold uppercase truncate px-0.5" style={{ fontSize: 7, color: isActive ? color : `${color}70`, letterSpacing: '0.06em' }}>
                {(section.label ?? section.name).slice(0, 5)}
              </span>
            </div>
          );
        })}
        <div
          className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
          style={{ left: `${(position / song.duration) * 100}%`, background: '#f97316', boxShadow: '0 0 4px #f97316', transition: 'left 200ms linear' }}
        />
      </div>
      {activeSection && (
        <p className="font-black uppercase tracking-widest" style={{ fontSize: 9, color: SECTION_COLORS[activeSection.name] ?? '#52525b' }}>
          ► {activeSection.label ?? activeSection.name}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LiveShowController({
  timelineState, songs, onPlay, onPause, onStop,
  onNextSong, onPrevSong, onBlackout, onFallback, onSeek,
}: LiveShowControllerProps) {
  const { t } = useHoloLang();
  const { playbackState, currentSongIndex, currentSongId, position, nextCue } = timelineState;
  const isPlaying  = playbackState === 'playing';
  const isPaused   = playbackState === 'paused';
  const isStopped  = playbackState === 'stopped';
  const isBlackout = playbackState === 'blackout';

  const currentSong = songs[currentSongIndex] ?? null;
  const progress    = currentSong ? Math.min(1, position / currentSong.duration) : 0;

  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [firedCues, setFiredCues] = useState<TimelineCue[]>([]);
  const [suitAlerts, setSuitAlerts] = useState<HoloSuitNotification[]>([]);
  const [presetsExpanded, setPresetsExpanded] = useState(true);
  const [setlistExpanded, setSetlistExpanded] = useState(false);

  useEffect(() => {
    const unsub = showTimelineEngine.onCueFiredEvent((cue) => {
      setFiredCues(prev => [cue, ...prev].slice(0, 8));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = holosuitBridge.onNotification((notif) => {
      if (notif.type === 'battery_critical' || notif.type === 'sensor_lost') {
        setSuitAlerts(prev => [notif, ...prev].slice(0, 5));
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isStopped) setFiredCues([]);
  }, [isStopped]);

  const handleApplyPreset = useCallback((preset: ShowPreset) => {
    applyPreset(preset);
    setActivePresetId(preset.id);
  }, []);

  const handleBlackout = useCallback(() => {
    onBlackout();
    dmxEngine.blackoutOn();
  }, [onBlackout]);

  const handleRestore = useCallback(() => {
    onBlackout();
    dmxEngine.blackoutOff();
  }, [onBlackout]);

  return (
    <div className="space-y-3">

      {/* ── HoloSuit Alerts ── */}
      {suitAlerts.filter(a => !a.dismissed).length > 0 && (
        <div className="space-y-1">
          {suitAlerts.filter(a => !a.dismissed).map(alert => (
            <div
              key={alert.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background:   alert.type === 'battery_critical' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                borderLeft:   `3px solid ${alert.type === 'battery_critical' ? '#f59e0b' : '#ef4444'}`,
                border:       `1px solid ${alert.type === 'battery_critical' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              {alert.type === 'battery_critical'
                ? <Battery className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                : <Signal  className="w-3.5 h-3.5 shrink-0 text-red-400"  />
              }
              <p className="flex-1 text-xs" style={{ color: alert.type === 'battery_critical' ? '#fbbf24' : '#f87171' }}>
                {alert.message}
              </p>
              <button
                onClick={() => setSuitAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, dismissed: true } : a))}
                className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── System Telemetry ── */}
      <SystemTelemetry />

      {/* ── Status + Transport ── */}
      <div
        className="rounded-2xl border p-4 space-y-3"
        style={{
          background:   isBlackout ? 'rgba(10,0,0,0.85)' : isPlaying ? 'linear-gradient(135deg,rgba(249,115,22,0.08),rgba(0,0,0,0.5))' : 'rgba(0,0,0,0.4)',
          borderColor:  isBlackout ? 'rgba(239,68,68,0.35)' : isPlaying ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.06)',
        }}
      >
        {/* Status row */}
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full shrink-0 ${isPlaying ? 'animate-pulse' : ''}`}
            style={{
              background:  isBlackout ? '#1a1a1a' : isPlaying ? '#f97316' : isPaused ? '#f59e0b' : '#374151',
              boxShadow:   isPlaying ? '0 0 10px rgba(249,115,22,0.8)' : 'none',
            }}
          />
          <div className="flex-1">
            <p className="text-sm font-black text-white uppercase tracking-wider leading-none">
              {isBlackout ? '⚫ BLACKOUT' : isPlaying ? '● LIVE' : isPaused ? '⏸ PAUSED' : '■ STOPPED'}
            </p>
            {currentSong && !isBlackout && (
              <p className="text-xs mt-0.5 truncate" style={{ color: '#52525b' }}>
                {currentSong.title} — {currentSong.artist}
                {currentSong.bpm > 0 && <span className="ml-2" style={{ color: '#3f3f46' }}>{currentSong.bpm} BPM</span>}
              </p>
            )}
          </div>
          {currentSong && !isBlackout && (
            <div className="text-right shrink-0">
              <p className="text-xl font-mono font-black text-white leading-none">{formatTime(position)}</p>
              <p className="text-xs font-mono mt-0.5" style={{ color: '#3f3f46' }}>/ {formatTime(currentSong.duration)}</p>
            </div>
          )}
        </div>

        {/* Section bar + progress */}
        {currentSong && !isBlackout && (
          <div className="space-y-2">
            <SongSectionBar song={currentSong} position={position} />
            <div
              className="relative h-2 rounded-full overflow-hidden cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.07)' }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                onSeek(((e.clientX - rect.left) / rect.width) * currentSong.duration);
              }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg,#f97316,#fb923c)', transition: 'width 200ms linear' }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono" style={{ color: '#3f3f46' }}>
              <span>{formatTime(position)}</span>
              <span>{formatTime(currentSong.duration)}</span>
            </div>
          </div>
        )}

        {/* Main transport */}
        <div className="flex items-center justify-center gap-2">
          <TransportButton onClick={onPrevSong} icon={SkipBack}    label="Prev" />
          <TransportButton onClick={onStop}     icon={Square}      label="Stop" active={isStopped} />
          {isPlaying
            ? <TransportButton onClick={onPause} icon={Pause} label="Pause" variant="primary" large />
            : <TransportButton onClick={onPlay}  icon={Play}  label="Play"  variant="primary" large />
          }
          <TransportButton onClick={onNextSong} icon={SkipForward} label="Next" />
        </div>
      </div>

      {/* ── Emergency Controls ── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={isBlackout ? handleRestore : handleBlackout}
          className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:scale-105 active:scale-95"
          style={{
            background: isBlackout ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.05)',
            border: `1px solid ${isBlackout ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.15)'}`,
            color: '#ef4444',
            boxShadow: isBlackout ? '0 0 20px rgba(239,68,68,0.25)' : 'none',
          }}
        >
          {isBlackout ? <ZapOff size={20} /> : <Moon size={20} />}
          <span className="text-xs font-black tracking-widest uppercase">
            {isBlackout ? 'RESTORE' : 'BLACKOUT'}
          </span>
          <span className="text-xs opacity-40">{t('live_turn_off_proj')}</span>
        </button>
        <button
          onClick={onFallback}
          className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:scale-105 active:scale-95"
          style={{
            background: playbackState === 'fallback' ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.05)',
            border: `1px solid ${playbackState === 'fallback' ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.15)'}`,
            color: '#f59e0b',
            boxShadow: playbackState === 'fallback' ? '0 0 20px rgba(245,158,11,0.25)' : 'none',
          }}
        >
          <AlertTriangle size={20} />
          <span className="text-xs font-black tracking-widest uppercase">Fallback</span>
          <span className="text-xs opacity-40">{t('live_safety_anim')}</span>
        </button>
      </div>

      {/* ── Show Presets ── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
          onClick={() => setPresetsExpanded(!presetsExpanded)}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" style={{ color: '#f97316' }} />
            <span className="text-xs font-black uppercase tracking-widest text-white">Show Presets</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', fontSize: 9 }}>
              {SHOW_PRESETS.length}
            </span>
            {activePresetId && (
              <span className="text-xs truncate max-w-24" style={{ color: '#52525b' }}>
                · {SHOW_PRESETS.find(p => p.id === activePresetId)?.name}
              </span>
            )}
          </div>
          {presetsExpanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
        </button>

        {presetsExpanded && (
          <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
            {SHOW_PRESETS.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isActive={activePresetId === preset.id}
                onApply={() => handleApplyPreset(preset)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Visual FX ── */}
      <FXPanel />

      {/* ── Next cue preview ── */}
      {nextCue && isPlaying && (
        <div
          className="flex items-center gap-3 p-3 rounded-xl border"
          style={{ background: `${CUE_TYPE_COLORS[nextCue.type]}08`, borderColor: `${CUE_TYPE_COLORS[nextCue.type]}25` }}
        >
          <div className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: CUE_TYPE_COLORS[nextCue.type] }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{t('live_next_cue')} {nextCue.name}</p>
            <p className="text-xs" style={{ color: CUE_TYPE_COLORS[nextCue.type] }}>
              {CUE_TYPE_LABELS[nextCue.type]} @ {formatTime(nextCue.timestamp)}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0 text-gray-700" />
        </div>
      )}

      {/* ── Fired cues log ── */}
      {firedCues.length > 0 && (
        <div className="rounded-2xl border p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
            <Zap className="w-3 h-3" /> Fired Cues
          </p>
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            {firedCues.map((cue, i) => (
              <div
                key={`${cue.id}-${i}`}
                className="flex items-center gap-2 px-2 py-1 rounded-lg"
                style={{ background: i === 0 ? `${CUE_TYPE_COLORS[cue.type]}12` : 'transparent' }}
              >
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CUE_TYPE_COLORS[cue.type], opacity: i === 0 ? 1 : 0.3 }} />
                <span className="flex-1 text-xs text-white truncate" style={{ opacity: i === 0 ? 1 : 0.4 }}>{cue.name}</span>
                <span className="text-xs font-mono shrink-0" style={{ color: CUE_TYPE_COLORS[cue.type], opacity: i === 0 ? 1 : 0.35, fontSize: 10 }}>
                  {CUE_TYPE_LABELS[cue.type]} @ {formatTime(cue.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Setlist Navigator ── */}
      {songs.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
            onClick={() => setSetlistExpanded(!setlistExpanded)}
          >
            <div className="flex items-center gap-2">
              <Music className="w-3.5 h-3.5" style={{ color: '#71717a' }} />
              <span className="text-xs font-black uppercase tracking-widest text-white">{t('live_setlist')}</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#52525b', fontSize: 9 }}>
                {songs.length}
              </span>
            </div>
            {setlistExpanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
          </button>

          {setlistExpanded && (
            <div className="px-3 pb-3 space-y-1 max-h-52 overflow-y-auto">
              {songs.map((song, i) => {
                const isCurrent = song.id === currentSongId;
                return (
                  <div
                    key={song.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{
                      background: isCurrent ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isCurrent ? 'rgba(249,115,22,0.2)' : 'transparent'}`,
                    }}
                  >
                    <span className="text-xs font-mono w-4 shrink-0 text-center" style={{ color: isCurrent ? '#f97316' : '#3f3f46' }}>
                      {i + 1}
                    </span>
                    <Music className="w-3 h-3 shrink-0" style={{ color: isCurrent ? '#f97316' : '#374151' }} />
                    <span className="flex-1 text-xs text-white truncate font-medium">{song.title}</span>
                    {song.bpm > 0 && <span className="font-mono shrink-0" style={{ fontSize: 9, color: '#3f3f46' }}>{song.bpm}</span>}
                    <span className="text-xs font-mono shrink-0" style={{ color: '#52525b' }}>{formatTime(song.duration)}</span>
                    {isCurrent && isPlaying && <div className="w-2 h-2 rounded-full shrink-0 bg-orange-400 animate-pulse" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
