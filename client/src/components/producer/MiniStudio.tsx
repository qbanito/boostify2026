/**
 * MiniStudio — Boostify Premium DAW Console
 * ─────────────────────────────────────────────────────────────
 * Pixel-faithful recreation of the Mini Studio production console
 * (see attached UI mock). Layout:
 *
 *   ┌─ Sidebar nav ─┬─ TopBar ─────────────────────────────────┐
 *   │               ├──────────────────────────────────────────┤
 *   │   STUDIO      │  Tracks   │   Timeline   │  AI Agents    │
 *   │   AI LAB      │  panel    │   + clips    │  + Quick      │
 *   │   VOCAL       │           │   + sections │    Actions    │
 *   │   MIX/MASTER  ├──────────────────────────────────────────┤
 *   │   RELEASE     │ VOCAL BOOTH │ PLUGIN RACK │  AI LAB      │
 *   │               ├──────────────────────────────────────────┤
 *   │               │ MASTER ROOM │ LOUDNESS │ COMPARAR │ EXPORT │ RELEASE
 *   └───────────────┴──────────────────────────────────────────┘
 *
 * Backed by `/api/mini-studio/*` (projects, generation, mastering,
 * stem-separation, export, release). Visual aesthetic: dark glass +
 * Boostify orange/amber accents.
 */

import { ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../../hooks/use-auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Disc3, Mic2, Square, Play, Pause, SkipBack, SkipForward, Save, Upload, Plus,
  Sparkles, Activity, Settings2, FolderOpen, Store, ShoppingBag, Music,
  Wand2, Scissors, Tv2, Image as ImageIcon, Share2, Globe, Tag, Layers, Maximize2, Loader2,
  Repeat, Zap, AudioLines, CircleDot, Sliders, Gauge, Power, ChevronDown, ChevronUp,
  Megaphone, Stethoscope, GitBranch, ArrowLeftRight, Hash, BookText, Workflow,
  Menu, X, FileAudio, Volume2, VolumeX, ChevronLeft, ChevronRight,
  Clock, Keyboard, Headphones, RefreshCw, AlertCircle, Music2, AlignLeft,
  Copy, Trash2, Pencil, GripVertical, PanelLeft,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { ChannelStrip, LoudnessMeter, decodePeaks, renderUrlToWav, type PluginLike } from './miniStudioAudio';

/* ============================================================
   Constants — matches the reference mock 1:1
============================================================ */

const PROJECT = {
  name: 'Lluvia de Oro',
  bpm: 122,
  key: 'A min',
  user: { name: 'Romy Álvarez', tier: 'Artista Premium' },
  status: 'Guardado',
  time: '01:24.850',
  bars: '45.2.3',
};

const KEYS = [
  'C maj', 'C min', 'C# maj', 'C# min', 'D maj', 'D min',
  'D# maj', 'D# min', 'E maj', 'E min', 'F maj', 'F min',
  'F# maj', 'F# min', 'G maj', 'G min', 'G# maj', 'G# min',
  'A maj', 'A min', 'A# maj', 'A# min', 'B maj', 'B min',
];

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

interface Track {
  id: string;
  name: string;
  type: string;
  color: string;
  initial: string;
  iconBg: string;
  vol: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  rec: boolean;
  audioUrl?: string;
}

interface ArtistLibrarySong {
  id: string;
  title?: string;
  name?: string;
  audioUrl?: string;
  coverArt?: string;
  duration?: string;
  genre?: string;
  lyrics?: string;
  artistId?: string;
  userId?: string;
  miniStudioProjectId?: string;
  releaseStatus?: string;
}

interface ArtistLibraryArtist {
  id: string;
  firestoreId?: string;
  pgId?: string | number | null;
  name: string;
  genre?: string | null;
  image?: string | null;
  songs: ArtistLibrarySong[];
}

const TRACKS: Track[] = [
  { id: 't1', name: 'VOCAL PRINCIPAL', type: 'Vocal',  color: '#f97316', initial: 'M', iconBg: 'bg-orange-500',  vol: 80, pan: 0,  mute: false, solo: false, rec: true  },
  { id: 't2', name: 'COROS',           type: 'Vocal',  color: '#a855f7', initial: 'C', iconBg: 'bg-purple-500',  vol: 65, pan: -10, mute: false, solo: false, rec: false },
  { id: 't3', name: 'BEAT',            type: 'Drums',  color: '#ef4444', initial: 'B', iconBg: 'bg-rose-500',    vol: 75, pan: 0,  mute: false, solo: false, rec: false },
  { id: 't4', name: 'BAJO',            type: 'Bass',   color: '#eab308', initial: 'B', iconBg: 'bg-yellow-500',  vol: 70, pan: 0,  mute: false, solo: false, rec: false },
  { id: 't5', name: 'SYNTH PAD',       type: 'Atmos',  color: '#22c55e', initial: 'S', iconBg: 'bg-emerald-500', vol: 55, pan: 5,  mute: false, solo: false, rec: false },
  { id: 't6', name: 'PIANO',           type: 'Keys',   color: '#06b6d4', initial: 'P', iconBg: 'bg-cyan-500',    vol: 60, pan: -5, mute: false, solo: false, rec: false },
  { id: 't7', name: 'FX ATMOS',        type: 'FX',     color: '#ec4899', initial: 'F', iconBg: 'bg-pink-500',    vol: 45, pan: 0,  mute: false, solo: false, rec: false },
  { id: 't8', name: 'REFERENCE',       type: 'Ref',    color: '#71717a', initial: 'R', iconBg: 'bg-zinc-500',    vol: 50, pan: 0,  mute: true,  solo: false, rec: false },
];

interface Section { id: string; label: string; start: number; width: number; active?: boolean; }
const SECTIONS: Section[] = [
  { id: 'intro',    label: 'INTRO',    start: 0,  width: 12 },
  { id: 'verse1',   label: 'VERSO 1',  start: 12, width: 12 },
  { id: 'precoro',  label: 'PRE CORO', start: 24, width: 8  },
  { id: 'coro1',    label: 'CORO',     start: 32, width: 14, active: true },
  { id: 'verse2',   label: 'VERSO 2',  start: 46, width: 12 },
  { id: 'coro2',    label: 'CORO',     start: 58, width: 14 },
  { id: 'puente',   label: 'PUENTE',   start: 72, width: 10 },
  { id: 'outro',    label: 'OUTRO',    start: 82, width: 18 },
];

interface Clip {
  id: string;
  trackId: string;
  name: string;
  start: number;
  width: number;
  audioUrl?: string;
  muted?: boolean;
  gain?: number;
  fadeIn?: number;
  fadeOut?: number;
  stemType?: string;
  sourceSongId?: string;
}

interface StemFile { type: string; name?: string; audioUrl: string; }

interface TrackContextMenuState { trackId: string; x: number; y: number; }

type PluginType = 'eq' | 'compressor' | 'reverb' | 'delay' | 'pitch' | 'noise' | 'saturation' | 'limiter';

interface PluginState {
  id: string;
  type: PluginType;
  name: string;
  enabled: boolean;
  params: Record<string, number | string>;
}

interface VocalBoothSettings {
  metronome: boolean;
  tuning: boolean;
  noise: boolean;
  monitoring: boolean;
  inputGain: number;
  takeMode: 'manual' | 'smart';
}

interface MasterChainState {
  width: number;
  glue: number;
  limiter: number;
  targetLufs: number;
}
const INITIAL_CLIPS: Clip[] = [
  { id: 'clip-vocal-1', trackId: 't1', name: 'Vocal Principal_01', start: 1,  width: 35 },
  { id: 'clip-vocal-2', trackId: 't1', name: 'Vocal Principal_02', start: 38, width: 30 },
  { id: 'clip-coros-1', trackId: 't2', name: 'Coros_01',           start: 16, width: 25 },
  { id: 'clip-beat-1', trackId: 't3', name: 'Beat_DeepHouse_122bpm', start: 1, width: 95 },
  { id: 'clip-bass-1', trackId: 't4', name: 'Bass_Main',          start: 4,  width: 90 },
  { id: 'clip-synth-1', trackId: 't5', name: 'Synth Pad_Atmos',    start: 8,  width: 78 },
  { id: 'clip-piano-1', trackId: 't6', name: 'Piano_Chords',       start: 14, width: 56 },
  { id: 'clip-fx-1', trackId: 't7', name: 'FX Atmosphere',      start: 22, width: 60 },
  { id: 'clip-ref-1', trackId: 't8', name: 'Ocean Waves',        start: 0,  width: 96 },
];

const SIDEBAR_NAV: Array<{ id: string; label: string; icon: any; active: boolean; href?: string }> = [
  { id: 'studio',     label: 'Studio',       icon: Disc3,        active: true },
  { id: 'ai-lab',     label: 'AI Lab',       icon: Sparkles,     active: false },
  { id: 'vocal',      label: 'Vocal Booth',  icon: Mic2,         active: false },
  { id: 'mix',        label: 'Mix Room',     icon: Sliders,      active: false },
  { id: 'master',     label: 'Master Room',  icon: Gauge,        active: false },
  { id: 'release',    label: 'Release Room', icon: Megaphone,    active: false },
  { id: 'explore',    label: 'Explorar',     icon: Globe,        active: false, href: '/explore' },
  { id: 'projects',   label: 'Proyectos',    icon: FolderOpen,   active: false },
  { id: 'market',     label: 'Marketplace',  icon: Store,        active: false, href: '/marketplace' },
  { id: 'settings',   label: 'Ajustes',      icon: Settings2,    active: false },
];

interface Agent {
  id: string; name: string; desc: string; icon: any; chip: string;
  cta: string; ctaColor: string; agentSlug: string;
}
const AGENTS: Agent[] = [
  { id: 'producer',   name: 'AI Producer',          desc: 'Estructura, arreglos y dirección musical', icon: Workflow,   chip: 'bg-orange-500/15 text-orange-300',
    cta: 'Analizar',  ctaColor: 'bg-orange-500 hover:bg-orange-600 text-white', agentSlug: 'producer' },
  { id: 'songwriter', name: 'AI Songwriter',        desc: 'Letras, hooks y adaptaciones',              icon: BookText,   chip: 'bg-amber-500/15 text-amber-300',
    cta: 'Escribir',  ctaColor: 'bg-orange-500 hover:bg-orange-600 text-white', agentSlug: 'songwriter' },
  { id: 'beatmaker',  name: 'AI Beatmaker',         desc: 'Beats y loops personalizados',              icon: Zap,        chip: 'bg-rose-500/15 text-rose-300',
    cta: 'Generar',   ctaColor: 'bg-rose-500 hover:bg-rose-600 text-white',     agentSlug: 'beatmaker' },
  { id: 'vocoach',    name: 'AI Vocal Coach',       desc: 'Afinación, emoción y técnica vocal',        icon: Stethoscope,chip: 'bg-orange-500/15 text-orange-300',
    cta: 'Mejorar',   ctaColor: 'bg-orange-500 hover:bg-orange-600 text-white', agentSlug: 'vocal-coach' },
  { id: 'mix',        name: 'AI Mix Engineer',      desc: 'Mezcla automática profesional',             icon: Sliders,    chip: 'bg-orange-500/15 text-orange-300',
    cta: 'Mezclar',   ctaColor: 'bg-orange-500 hover:bg-orange-600 text-white', agentSlug: 'mix-engineer' },
  { id: 'master',     name: 'AI Mastering Engineer',desc: 'Master final para todas las plataformas',   icon: Gauge,      chip: 'bg-violet-500/15 text-violet-300',
    cta: 'Masterizar',ctaColor: 'bg-violet-500 hover:bg-violet-600 text-white', agentSlug: 'mastering-engineer' },
  { id: 'stems',      name: 'AI Stem Separator',    desc: 'Separa stems de cualquier canción',         icon: GitBranch,  chip: 'bg-emerald-500/15 text-emerald-300',
    cta: 'Separar',   ctaColor: 'bg-emerald-500 hover:bg-emerald-600 text-white', agentSlug: 'stem-separator' },
  { id: 'release',    name: 'AI Release Assistant', desc: 'Prepara y lanza tu música al mundo',         icon: Megaphone,  chip: 'bg-orange-500/15 text-orange-300',
    cta: 'Lanzar',    ctaColor: 'bg-orange-500 hover:bg-orange-600 text-white', agentSlug: 'release-assistant' },
];

const QUICK_ACTIONS = [
  { id: 'gen-beat',     label: 'Generate Beat',          icon: Zap,       kind: 'beat',    color: 'text-orange-400' },
  { id: 'write-lyrics', label: 'Write Lyrics',           icon: BookText,  kind: 'lyrics',  color: 'text-amber-400' },
  { id: 'imp-vocal',    label: 'Improve Vocal',          icon: Mic2,      kind: 'vocal',   color: 'text-orange-400' },
  { id: 'sep-stems',    label: 'Separate Stems',         icon: GitBranch, kind: 'stems',   color: 'text-emerald-400' },
  { id: 'mix-song',     label: 'Mix Song',               icon: Sliders,   kind: 'mix',     color: 'text-orange-400' },
  { id: 'master-track', label: 'Master Track',           icon: Gauge,     kind: 'master',  color: 'text-violet-400' },
  { id: 'tiktok',       label: 'Create TikTok\nVersion', icon: Tv2,       kind: 'tiktok',  color: 'text-rose-400' },
  { id: 'release',      label: 'Prepare Release',        icon: Megaphone, kind: 'release', color: 'text-orange-400' },
];

type AILabKind = 'beat' | 'bassline' | 'synth' | 'pad' | 'vocal' | 'hook' | 'fx' | 'intro' | 'outro' | 'remix';
type AILabTargetMode = 'auto' | 'selected' | 'new';
type AILabInsertMode = 'arrangement' | 'playhead' | 'after-selected';

interface AILabItem { id: string; title: string; subtitle: string; kind: AILabKind; color: string; }
interface AILabSessionState {
  targetMode: AILabTargetMode;
  insertMode: AILabInsertMode;
  targetTrackId: string | null;
  applyMix: boolean;
  prompt: string;
}
interface AILabGenerateRequest extends Partial<AILabSessionState> { kind: AILabKind; }
interface AILabLastResult { kind: AILabKind; trackId: string; clipId: string; provider?: string; audioUrl: string; }

const AI_LAB_ITEMS: AILabItem[] = [
  { id: 'lab-beat',    title: 'Beat',     subtitle: 'Deep House 122 BPM', kind: 'beat',     color: 'from-orange-500/20 to-amber-500/10' },
  { id: 'lab-bass',    title: 'Bassline', subtitle: 'Sub Bass',           kind: 'bassline', color: 'from-yellow-500/20 to-orange-500/10' },
  { id: 'lab-synth',   title: 'Synth',    subtitle: 'Atmos Pad',          kind: 'synth',    color: 'from-emerald-500/20 to-cyan-500/10' },
  { id: 'lab-pad',     title: 'Pad',      subtitle: 'Lush Layer',         kind: 'pad',      color: 'from-cyan-500/20 to-blue-500/10' },
  { id: 'lab-vocal',   title: 'Vocal',    subtitle: 'Female Angelic',     kind: 'vocal',    color: 'from-pink-500/20 to-orange-500/10' },
  { id: 'lab-hook',    title: 'Hook',     subtitle: 'Melodic Hook',       kind: 'hook',     color: 'from-amber-500/20 to-rose-500/10' },
  { id: 'lab-fx',      title: 'FX',       subtitle: 'Whoosh Impact',      kind: 'fx',       color: 'from-violet-500/20 to-pink-500/10' },
  { id: 'lab-intro',   title: 'Intro',    subtitle: '16 Bars',            kind: 'intro',    color: 'from-cyan-500/20 to-emerald-500/10' },
  { id: 'lab-outro',   title: 'Outro',    subtitle: '16 Bars',            kind: 'outro',    color: 'from-orange-500/20 to-rose-500/10' },
  { id: 'lab-remix',   title: 'Remix',    subtitle: 'Club Version',       kind: 'remix',    color: 'from-rose-500/20 to-violet-500/10' },
];

const DEFAULT_AI_LAB_SETTINGS: AILabSessionState = {
  targetMode: 'auto',
  insertMode: 'arrangement',
  targetTrackId: null,
  applyMix: true,
  prompt: '',
};

const AI_KIND_CONFIG: Record<AILabKind, { trackId: string; name: string; type: string; color: string; initial: string; iconBg: string; width: number; vol: number; pan: number; durationSec: number; bars?: number }> = {
  beat: { trackId: 't3', name: 'BEAT AI', type: 'Drums', color: '#ef4444', initial: 'B', iconBg: 'bg-rose-500', width: 34, vol: 78, pan: 0, durationSec: 18, bars: 8 },
  bassline: { trackId: 't4', name: 'BASSLINE AI', type: 'Bass', color: '#eab308', initial: 'B', iconBg: 'bg-yellow-500', width: 28, vol: 72, pan: 0, durationSec: 16, bars: 8 },
  synth: { trackId: 't5', name: 'SYNTH AI', type: 'Atmos', color: '#22c55e', initial: 'S', iconBg: 'bg-emerald-500', width: 30, vol: 58, pan: 8, durationSec: 18, bars: 8 },
  pad: { trackId: 't5', name: 'PAD AI', type: 'Atmos', color: '#06b6d4', initial: 'P', iconBg: 'bg-cyan-500', width: 36, vol: 54, pan: -6, durationSec: 24, bars: 8 },
  vocal: { trackId: 't1', name: 'VOCAL AI', type: 'Vocal', color: '#f97316', initial: 'V', iconBg: 'bg-orange-500', width: 18, vol: 82, pan: 0, durationSec: 14, bars: 4 },
  hook: { trackId: 't1', name: 'HOOK AI', type: 'Vocal', color: '#f97316', initial: 'H', iconBg: 'bg-orange-500', width: 14, vol: 84, pan: 0, durationSec: 10, bars: 4 },
  fx: { trackId: 't7', name: 'FX AI', type: 'FX', color: '#ec4899', initial: 'F', iconBg: 'bg-pink-500', width: 6, vol: 52, pan: 0, durationSec: 5 },
  intro: { trackId: 't3', name: 'INTRO AI', type: 'Music', color: '#06b6d4', initial: 'I', iconBg: 'bg-cyan-500', width: 18, vol: 70, pan: 0, durationSec: 24, bars: 16 },
  outro: { trackId: 't3', name: 'OUTRO AI', type: 'Music', color: '#f97316', initial: 'O', iconBg: 'bg-orange-500', width: 18, vol: 68, pan: 0, durationSec: 24, bars: 16 },
  remix: { trackId: 't3', name: 'REMIX AI', type: 'Music', color: '#a855f7', initial: 'R', iconBg: 'bg-purple-500', width: 44, vol: 76, pan: 0, durationSec: 32, bars: 16 },
};

const RELEASE_TILES = [
  { id: 'cover',    label: 'Portada',          icon: ImageIcon },
  { id: 'video',    label: 'Video',            icon: Tv2 },
  { id: 'viz',      label: 'Visualizer',       icon: AudioLines },
  { id: 'distro',   label: 'Distribución',     icon: Share2 },
  { id: 'social',   label: 'Redes Sociales',   icon: Hash },
  { id: 'merch',    label: 'Merch',            icon: ShoppingBag },
  { id: 'license',  label: 'Licensing',        icon: Tag },
  { id: 'page',     label: 'Página del Single',icon: Globe },
];

const EXPORT_FORMATS = [
  { id: 'wav',     label: 'WAV 24bit',     active: true },
  { id: 'mp3',     label: 'MP3 320kbps',   active: false },
  { id: 'stems',   label: 'STEMS',         active: true },
  { id: 'acapella',label: 'ACAPELLA',      active: false },
  { id: 'club',    label: 'eClub',         active: false },
  { id: 'radio',   label: 'eRadio',        active: false },
  { id: 'instr',   label: 'INSTRUMENTAL',  active: false },
];

/* ============================================================
   Helpers
============================================================ */

const apiFetch = async <T,>(url: string, opts: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

function waveBars(seed: number, n: number): number[] {
  const out: number[] = [];
  let s = seed || 1;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push(0.25 + (s / 233280) * 0.7);
  }
  return out;
}

interface WaveformPeak { min: number; max: number; rms: number; transient: number; }

const waveformCache = new Map<string, WaveformPeak[]>();

function fallbackWaveformPeaks(seed: number, bins: number): WaveformPeak[] {
  const bars = waveBars(seed, bins);
  return bars.map((bar, index) => {
    const asymmetry = 0.76 + ((index * 19 + seed) % 23) / 100;
    const max = Math.min(1, bar * (0.82 + ((index + seed) % 7) / 28));
    const min = -Math.min(1, bar * asymmetry);
    const rms = Math.min(1, Math.max(0.1, bar * 0.58));
    const previous = bars[Math.max(0, index - 1)] || bar;
    const transient = Math.max(0, bar - previous);
    return { min, max, rms, transient };
  });
}

const makeClipId = () => `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ensureClipIds = (items: Partial<Clip>[]): Clip[] => items.map((clip, index) => ({
  id: clip.id || `clip-${clip.trackId || 'track'}-${index}-${Date.now()}`,
  trackId: clip.trackId || 't1',
  name: clip.name || 'Audio Clip',
  start: typeof clip.start === 'number' ? clip.start : 0,
  width: typeof clip.width === 'number' ? clip.width : 16,
  audioUrl: clip.audioUrl,
  muted: clip.muted,
  gain: clip.gain,
  fadeIn: clip.fadeIn,
  fadeOut: clip.fadeOut,
  stemType: clip.stemType,
  sourceSongId: clip.sourceSongId,
}));

const clampTimelinePct = (value: number) => Math.max(0, Math.min(100, value));

const quantizeStepPct = (quantize: string) => {
  if (quantize === '1/16') return 1;
  if (quantize === '1/8') return 2;
  return 4;
};

const snapTimelinePct = (value: number, snapOn: boolean, quantize: string) => {
  if (!snapOn) return value;
  const step = quantizeStepPct(quantize);
  return Math.round(value / step) * step;
};

const isEditableShortcutTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable || !!element.closest('[contenteditable="true"]');
};

const STEM_TRACK_CONFIG: Record<string, { trackId: string; name: string; type: string; color: string; initial: string; iconBg: string }> = {
  vocals: { trackId: 't1', name: 'VOCALS STEM', type: 'Vocal', color: '#f97316', initial: 'V', iconBg: 'bg-orange-500' },
  drums: { trackId: 't3', name: 'DRUMS STEM', type: 'Drums', color: '#ef4444', initial: 'D', iconBg: 'bg-rose-500' },
  bass: { trackId: 't4', name: 'BASS STEM', type: 'Bass', color: '#eab308', initial: 'B', iconBg: 'bg-yellow-500' },
  other: { trackId: 't5', name: 'MUSIC STEM', type: 'Music', color: '#22c55e', initial: 'M', iconBg: 'bg-emerald-500' },
  instrumental: { trackId: 't6', name: 'INSTRUMENTAL STEM', type: 'Music', color: '#06b6d4', initial: 'I', iconBg: 'bg-cyan-500' },
};

const normalizeStemType = (type: string) => {
  const key = String(type || '').toLowerCase();
  if (key.includes('vocal')) return 'vocals';
  if (key.includes('drum')) return 'drums';
  if (key.includes('bass')) return 'bass';
  if (key.includes('instrument')) return 'instrumental';
  return key || 'other';
};

const DEFAULT_VOCAL_SETTINGS: VocalBoothSettings = {
  metronome: false,
  tuning: true,
  noise: false,
  monitoring: false,
  inputGain: 75,
  takeMode: 'manual',
};

const DEFAULT_MASTER_CHAIN: MasterChainState = { width: 54, glue: 32, limiter: -1, targetLufs: -14 };

const PLUGIN_LIBRARY: Record<PluginType, Omit<PluginState, 'id'>> = {
  eq: { type: 'eq', name: 'EQ', enabled: true, params: { low: 0, mid: 1.5, high: 2.5, hp: 80 } },
  compressor: { type: 'compressor', name: 'Compressor', enabled: true, params: { threshold: -16, ratio: 3, attack: 10, release: 120, makeup: 2 } },
  reverb: { type: 'reverb', name: 'Reverb', enabled: false, params: { size: 65, decay: 2.4, mix: 24 } },
  delay: { type: 'delay', name: 'Delay', enabled: false, params: { feedback: 30, mix: 18, time: '1/4' } },
  pitch: { type: 'pitch', name: 'Pitch Correction', enabled: true, params: { strength: 65, speed: 45 } },
  noise: { type: 'noise', name: 'Noise Remover', enabled: false, params: { threshold: -40, reduction: 70 } },
  saturation: { type: 'saturation', name: 'Saturation', enabled: false, params: { drive: 15, warmth: 40, mix: 45 } },
  limiter: { type: 'limiter', name: 'Limiter', enabled: true, params: { threshold: -1, output: -0.1, release: 80 } },
};

const AI_PLUGIN_PRESETS: Partial<Record<AILabKind, Partial<Record<PluginType, { enabled?: boolean; params?: Record<string, number | string> }>>>> = {
  beat: { eq: { enabled: true, params: { low: 2, mid: -1, high: 2 } }, compressor: { enabled: true, params: { threshold: -18, ratio: 4, makeup: 3 } }, saturation: { enabled: true, params: { drive: 22, warmth: 32, mix: 42 } }, limiter: { enabled: true, params: { threshold: -1.2, output: -0.2 } } },
  bassline: { eq: { enabled: true, params: { low: 4, mid: -2, high: -1 } }, compressor: { enabled: true, params: { threshold: -20, ratio: 5, makeup: 2.5 } }, saturation: { enabled: true, params: { drive: 18, warmth: 55, mix: 50 } }, limiter: { enabled: true, params: { threshold: -1, output: -0.2 } } },
  synth: { eq: { enabled: true, params: { low: -2, mid: 1, high: 3 } }, reverb: { enabled: true, params: { size: 72, decay: 3.4, mix: 32 } }, delay: { enabled: true, params: { feedback: 28, mix: 18 } } },
  pad: { eq: { enabled: true, params: { low: -3, mid: 0, high: 2 } }, reverb: { enabled: true, params: { size: 84, decay: 4.8, mix: 38 } }, delay: { enabled: true, params: { feedback: 22, mix: 14 } } },
  vocal: { eq: { enabled: true, params: { low: -2, mid: 1.5, high: 3 } }, compressor: { enabled: true, params: { threshold: -16, ratio: 3.2, makeup: 2.2 } }, pitch: { enabled: true, params: { strength: 66, speed: 45 } }, noise: { enabled: true, params: { threshold: -42, reduction: 72 } }, reverb: { enabled: true, params: { size: 56, decay: 2.6, mix: 24 } } },
  hook: { eq: { enabled: true, params: { low: -1, mid: 2, high: 3.5 } }, compressor: { enabled: true, params: { threshold: -15, ratio: 3.5, makeup: 2.8 } }, pitch: { enabled: true, params: { strength: 72, speed: 50 } }, delay: { enabled: true, params: { feedback: 32, mix: 20 } }, reverb: { enabled: true, params: { size: 62, decay: 2.8, mix: 28 } } },
  fx: { eq: { enabled: true, params: { low: -1, mid: 0, high: 4 } }, reverb: { enabled: true, params: { size: 88, decay: 5.2, mix: 44 } }, delay: { enabled: true, params: { feedback: 40, mix: 24 } } },
  intro: { eq: { enabled: true, params: { low: 0, mid: 1, high: 2 } }, reverb: { enabled: true, params: { size: 76, decay: 3.6, mix: 30 } }, compressor: { enabled: true, params: { threshold: -18, ratio: 2.5, makeup: 1.5 } } },
  outro: { eq: { enabled: true, params: { low: -1, mid: 0, high: 1.5 } }, reverb: { enabled: true, params: { size: 82, decay: 4.2, mix: 36 } }, delay: { enabled: true, params: { feedback: 35, mix: 26 } } },
  remix: { eq: { enabled: true, params: { low: 2, mid: -1, high: 2 } }, compressor: { enabled: true, params: { threshold: -17, ratio: 4.2, makeup: 3 } }, saturation: { enabled: true, params: { drive: 20, warmth: 36, mix: 46 } }, limiter: { enabled: true, params: { threshold: -0.7, output: -0.1 } } },
};

const AI_MASTER_PRESETS: Partial<Record<AILabKind, Partial<MasterChainState>>> = {
  beat: { glue: 38 },
  bassline: { glue: 36 },
  hook: { width: 58, glue: 34 },
  vocal: { width: 52, glue: 30 },
  remix: { width: 68, glue: 48, targetLufs: -10, limiter: -0.8 },
};

const createPlugin = (type: PluginType): PluginState => ({
  ...PLUGIN_LIBRARY[type],
  id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
  params: { ...PLUGIN_LIBRARY[type].params },
});

const defaultPluginsForTrack = (track?: Track): PluginState[] => {
  const type = String(track?.type || '').toLowerCase();
  if (type.includes('vocal')) return ['eq', 'compressor', 'pitch', 'noise', 'reverb', 'delay', 'limiter'].map(createPlugin);
  if (type.includes('bass')) return ['eq', 'compressor', 'saturation', 'limiter'].map(createPlugin);
  if (type.includes('drum')) return ['eq', 'compressor', 'saturation', 'limiter'].map(createPlugin);
  return ['eq', 'compressor', 'reverb', 'limiter'].map(createPlugin);
};

const normalizePluginsForTracks = (tracks: Track[], existing: Record<string, PluginState[]> = {}) => {
  const next: Record<string, PluginState[]> = {};
  tracks.forEach((track) => {
    const chain = existing[track.id];
    next[track.id] = Array.isArray(chain) && chain.length ? chain.map((plugin) => ({ ...plugin, params: { ...plugin.params } })) : defaultPluginsForTrack(track);
  });
  return next;
};

const applyAiPluginPresetToChain = (chain: PluginState[], kind: AILabKind, track?: Track) => {
  const preset = AI_PLUGIN_PRESETS[kind] || {};
  const base = chain.length ? chain.map((plugin) => ({ ...plugin, params: { ...plugin.params } })) : defaultPluginsForTrack(track);
  const next = base.map((plugin) => {
    const pluginPreset = preset[plugin.type];
    if (!pluginPreset) return plugin;
    return { ...plugin, enabled: pluginPreset.enabled ?? plugin.enabled, params: { ...plugin.params, ...(pluginPreset.params || {}) } };
  });
  (Object.keys(preset) as PluginType[]).forEach((type) => {
    if (next.some((plugin) => plugin.type === type)) return;
    const plugin = createPlugin(type);
    const pluginPreset = preset[type];
    next.push({ ...plugin, enabled: pluginPreset?.enabled ?? plugin.enabled, params: { ...plugin.params, ...(pluginPreset?.params || {}) } });
  });
  return next;
};

async function extractWaveformPeaks(audioUrl: string, bins = 120): Promise<WaveformPeak[]> {
  const cacheKey = `${audioUrl}::${bins}`;
  const cached = waveformCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(audioUrl);
  const buffer = await response.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextCtor();
  const decoded = await ctx.decodeAudioData(buffer.slice(0));
  const channels = Array.from({ length: Math.max(1, decoded.numberOfChannels) }, (_, index) => decoded.getChannelData(index));
  const blockSize = Math.max(1, Math.floor(decoded.length / bins));
  let previousRms = 0;
  const peaks = Array.from({ length: bins }, (_, index) => {
    let min = 0;
    let max = 0;
    let sumSquares = 0;
    const start = index * blockSize;
    const end = Math.min(decoded.length, start + blockSize);
    for (let i = start; i < end; i++) {
      const sample = channels.reduce((sum, channel) => sum + channel[i], 0) / channels.length;
      if (sample < min) min = sample;
      if (sample > max) max = sample;
      sumSquares += sample * sample;
    }
    const rms = Math.min(1, Math.max(0.025, Math.sqrt(sumSquares / Math.max(1, end - start)) * 2.8));
    const transient = Math.max(0, rms - previousRms);
    previousRms = rms;
    return {
      min: Math.max(-1, Math.min(-0.025, min)),
      max: Math.min(1, Math.max(0.025, max)),
      rms,
      transient,
    };
  });
  waveformCache.set(cacheKey, peaks);
  ctx.close?.();
  return peaks;
}

/* ============================================================
   Sub-components
============================================================ */

function Sidebar({ activeSection, onSelect }: { activeSection: string; onSelect: (id: string) => void }) {
  return (
    <aside className="w-[60px] h-full min-h-0 shrink-0 bg-[#0d0d10] border-r border-white/5 flex flex-col items-center py-3 gap-1 overflow-y-auto overflow-x-hidden">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center mb-2 shadow-lg shadow-orange-500/30">
        <Disc3 className="w-5 h-5 text-white" />
      </div>
      {SIDEBAR_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        return (
          <button key={item.id} onClick={() => onSelect(item.id)} className={`relative flex flex-col items-center gap-0.5 w-full py-2 cursor-pointer transition-colors ${isActive ? 'text-orange-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-orange-500 rounded-r" />}
            <Icon className="w-4 h-4" />
            <span className="max-w-full px-0.5 text-center text-[9px] font-medium leading-[1.05] tracking-wide break-words">{item.label}</span>
          </button>
        );
      })}
    </aside>
  );
}

interface TopBarProps {
  projectName: string; artistName: string; songTitle?: string;
  isPlaying: boolean; isRecording: boolean;
  onPlay: () => void; onStop: () => void; onRecord: () => void;
  onRewind: () => void; onForward: () => void; onNew: () => void; onMaximize: () => void;
  onSave: () => void; onExport: () => void; onRelease: () => void;
  saving: boolean; releasing: boolean;
  currentTime: number; bpm: number; keyName: string;
  onBpmChange: (bpm: number) => void; onKeyChange: () => void;
  onProjectNameChange: (name: string) => void;
  onShowShortcuts: () => void;
  sidebarOpen: boolean; onToggleSidebar: () => void;
  userTier?: string; userInitials?: string;
}
function TopBar(p: TopBarProps) {
  const [editBpm, setEditBpm] = useState(false);
  const [bpmInput, setBpmInput] = useState(String(p.bpm));
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState(p.projectName);

  const commitBpm = () => {
    const v = parseInt(bpmInput, 10);
    if (!isNaN(v) && v >= 40 && v <= 280) p.onBpmChange(v);
    else setBpmInput(String(p.bpm));
    setEditBpm(false);
  };
  const commitName = () => {
    if (nameInput.trim()) p.onProjectNameChange(nameInput.trim());
    setEditName(false);
  };

  return (
    <>
      {/* ─── MOBILE TopBar (2 rows) ─────────────────────────────── */}
      <div className="xl:hidden bg-[#101015] border-b border-white/5 shrink-0">
        {/* Row 1: hamburger + project name + save/release */}
        <div className="h-12 flex items-center px-3 gap-2">
          <button onClick={p.onToggleSidebar} className="w-10 h-10 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 flex items-center justify-center shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shrink-0">
            <Disc3 className="w-4 h-4 text-white" />
          </div>
          {editName ? (
            <input
              autoFocus value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditName(false); }}
              className="flex-1 bg-black/30 border border-white/10 rounded-md px-2 h-8 text-sm text-white outline-none min-w-0"
            />
          ) : (
            <button onClick={() => { setEditName(true); setNameInput(p.projectName); }} className="flex-1 text-sm font-semibold text-white text-left truncate min-w-0">
              {p.projectName}
            </button>
          )}
          <CircleDot className="w-3 h-3 fill-emerald-500 text-emerald-500 shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={p.onSave} disabled={p.saving} className="w-10 h-10 rounded-md bg-white/5 hover:bg-white/10 text-zinc-200 flex items-center justify-center">
              {p.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
            <button onClick={p.onRelease} disabled={p.releasing} className="h-10 px-3 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-500/30">
              {p.releasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
              <span>Release</span>
            </button>
          </div>
        </div>
        {/* Row 2: transport + time + BPM + key */}
        <div className="h-11 flex items-center px-3 gap-2 bg-black/20 border-t border-white/[0.04]">
          <button onClick={p.onRewind} className="w-9 h-9 rounded-md bg-white/5 text-zinc-300 flex items-center justify-center shrink-0"><SkipBack className="w-4 h-4" /></button>
          <button onClick={p.onPlay} className="w-9 h-9 rounded-md bg-white/5 text-zinc-200 flex items-center justify-center shrink-0">
            {p.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button onClick={p.onRecord} className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 transition-colors ${p.isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-red-500/90 text-white'}`}>
            <CircleDot className="w-4 h-4" />
          </button>
          <button onClick={p.onStop} className="w-9 h-9 rounded-md bg-white/5 text-zinc-300 flex items-center justify-center shrink-0"><Square className="w-4 h-4" /></button>
          <button onClick={p.onForward} className="w-9 h-9 rounded-md bg-white/5 text-zinc-300 flex items-center justify-center shrink-0"><SkipForward className="w-4 h-4" /></button>
          <div className="h-7 w-px bg-white/10 shrink-0 mx-0.5" />
          <div className="text-base font-mono font-bold text-white tabular-nums leading-none shrink-0">{formatTime(p.currentTime)}</div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-center cursor-pointer" onClick={() => !editBpm && setEditBpm(true)}>
              {editBpm ? (
                <input autoFocus value={bpmInput}
                  onChange={(e) => setBpmInput(e.target.value)}
                  onBlur={commitBpm}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitBpm(); if (e.key === 'Escape') setEditBpm(false); }}
                  className="w-10 text-sm font-bold text-white bg-transparent outline-none text-center leading-none"
                />
              ) : (
                <div className="text-sm font-bold text-white leading-none">{p.bpm}</div>
              )}
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider">BPM</div>
            </div>
            <div className="flex flex-col items-center">
              <button onClick={p.onKeyChange} className="text-sm font-bold text-white leading-none">{p.keyName}</button>
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Key</div>
            </div>
            <button onClick={p.onNew} className="w-9 h-9 rounded-md bg-white/5 text-zinc-400 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* ─── DESKTOP TopBar (single row) ──────────────────────────── */}
      <div className="hidden xl:flex h-14 bg-[#101015] border-b border-white/5 items-center px-2 gap-2 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center">
            <Disc3 className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white tracking-tight">MINI STUDIO</div>
            <div className="text-[8px] text-zinc-500 uppercase tracking-widest">by Boostify Music</div>
          </div>
        </div>
        <div className="h-8 w-px bg-white/10 mx-1 shrink-0" />
        <div className="flex items-center gap-2 bg-white/5 rounded-md px-3 h-8 border border-white/5 shrink-0">
          {editName ? (
            <input autoFocus value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditName(false); }}
              className="bg-transparent text-sm text-white font-medium outline-none w-36"
            />
          ) : (
            <button onClick={() => { setEditName(true); setNameInput(p.projectName); }} className="text-sm text-white font-medium text-left max-w-[160px] truncate">
              {p.projectName}
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        </div>
        {p.songTitle && <div className="hidden 2xl:block text-[10px] text-zinc-500 max-w-[180px] truncate shrink-0">Canción: {p.songTitle}</div>}
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs shrink-0">
          <CircleDot className="w-3 h-3 fill-emerald-500 text-emerald-500" />
          <span>{PROJECT.status}</span>
        </div>
        <div className="h-8 w-px bg-white/10 mx-1 shrink-0" />
        <div className="flex flex-col items-center px-1 shrink-0 cursor-pointer" onClick={() => !editBpm && setEditBpm(true)}>
          {editBpm ? (
            <input autoFocus value={bpmInput}
              onChange={(e) => setBpmInput(e.target.value)}
              onBlur={commitBpm}
              onKeyDown={(e) => { if (e.key === 'Enter') commitBpm(); if (e.key === 'Escape') setEditBpm(false); }}
              className="w-10 text-base font-bold text-white bg-transparent outline-none text-center leading-none"
            />
          ) : (
            <div className="text-base font-bold text-white leading-none hover:text-orange-400">{p.bpm}</div>
          )}
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">BPM</div>
        </div>
        <div className="flex flex-col items-center px-1 shrink-0">
          <button onClick={p.onKeyChange} className="text-base font-bold text-white leading-none hover:text-orange-400">{p.keyName}</button>
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Key</div>
        </div>
        <div className="h-8 w-px bg-white/10 mx-1 shrink-0" />
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={p.onRewind} className="w-9 h-9 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center"><SkipBack className="w-4 h-4" /></button>
          <button onClick={p.onPlay} className="w-9 h-9 rounded-md bg-white/5 hover:bg-white/10 text-zinc-200 flex items-center justify-center">
            {p.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button onClick={p.onRecord} className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${p.isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-red-500/90 hover:bg-red-500 text-white'}`}>
            <CircleDot className="w-4 h-4" />
          </button>
          <button onClick={p.onStop} className="w-9 h-9 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center"><Square className="w-4 h-4" /></button>
          <button onClick={p.onForward} className="w-9 h-9 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center"><SkipForward className="w-4 h-4" /></button>
        </div>
        <div className="h-8 w-px bg-white/10 mx-1 shrink-0" />
        <div className="flex items-baseline gap-2 shrink-0">
          <div className="text-xl font-mono font-bold text-white tabular-nums leading-none">{formatTime(p.currentTime)}</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button onClick={p.onShowShortcuts} className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 flex items-center justify-center" title="Atajos de teclado"><Keyboard className="w-3.5 h-3.5" /></button>
          <button onClick={p.onMaximize} className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 flex items-center justify-center"><Maximize2 className="w-3.5 h-3.5" /></button>
          <button onClick={p.onNew} className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
          <button onClick={p.onSave} disabled={p.saving} className="h-8 px-3 rounded-md bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-medium flex items-center gap-1.5">
            {p.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} <span>Guardar</span>
          </button>
          <button onClick={p.onExport} className="h-8 px-3 rounded-md bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-medium flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Exportar
          </button>
          <button onClick={p.onRelease} disabled={p.releasing} className="h-8 px-4 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-500/30">
            {p.releasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Megaphone className="w-3.5 h-3.5" />} Release
          </button>
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-white/10 h-8">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-[10px] font-bold text-white">{p.userInitials || 'RA'}</div>
            <div className="text-right leading-tight hidden lg:block">
              <div className="text-xs text-white font-medium">{p.artistName || PROJECT.user.name}</div>
              <div className="text-[9px] text-amber-400">{p.userTier ? `${p.userTier.charAt(0).toUpperCase()}${p.userTier.slice(1)} Plan` : PROJECT.user.tier}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TrackRow({ t, level = 0, selected, onSelect, onRename, onContextMenu, onToggle, onVolChange, onPanChange, onMoveTrack }: {
  t: Track;
  level?: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onContextMenu: (menu: TrackContextMenuState) => void;
  onToggle: (id: string, k: 'mute'|'solo'|'rec') => void;
  onVolChange: (id: string, vol: number) => void;
  onPanChange: (id: string, pan: number) => void;
  onMoveTrack: (fromId: string, toId: string) => void;
}) {
  const [showPan, setShowPan] = useState(false);
  const isMuted = t.mute;
  const levelPct = isMuted ? 0 : Math.min(100, level * 100);
  const levelColor = levelPct > 85 ? '#ef4444' : levelPct > 65 ? '#eab308' : t.color;

  return (
    <div
      draggable
      onClick={() => onSelect(t.id)}
      onDoubleClick={() => onRename(t.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect(t.id);
        onContextMenu({ trackId: t.id, x: e.clientX, y: e.clientY });
      }}
      onDragStart={(e) => { e.dataTransfer.setData('application/x-mini-track', t.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData('application/x-mini-track');
        if (fromId && fromId !== t.id) onMoveTrack(fromId, t.id);
      }}
      className={`px-1 xl:px-2 py-1.5 border-b flex items-center gap-1 xl:gap-2 group hover:bg-white/[0.02] cursor-grab active:cursor-grabbing ${selected ? 'bg-orange-500/10 border-orange-500/35' : 'border-white/5'}`}
    >
      <GripVertical className="hidden xl:block w-3 h-3 text-zinc-700 group-hover:text-zinc-500 shrink-0" />
      <div className="flex items-center gap-1 xl:gap-2 w-[76px] xl:w-[108px] shrink-0">
        <div className="w-7 h-7 rounded flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: t.color }}>
          {t.initial}
        </div>
        <div className="leading-tight overflow-hidden">
          <div className="text-[10px] font-bold text-white truncate">{t.name}</div>
          <div className="text-[9px] text-zinc-500">{t.type}{selected ? ' · SEL' : ''}</div>
        </div>
      </div>

      {/* M/S/R buttons */}
      <div className="flex items-center gap-0.5">
        <button onClick={(e) => { e.stopPropagation(); onToggle(t.id, 'mute'); }} className={`w-5 h-5 rounded text-[9px] font-bold ${t.mute ? 'bg-zinc-200 text-zinc-900' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>M</button>
        <button onClick={(e) => { e.stopPropagation(); onToggle(t.id, 'solo'); }} className={`w-5 h-5 rounded text-[9px] font-bold ${t.solo ? 'bg-amber-400 text-zinc-900' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`} title="Solo — solo este canal">S</button>
        <button onClick={(e) => { e.stopPropagation(); onToggle(t.id, 'rec'); }} className={`w-5 h-5 rounded text-[9px] font-bold ${t.rec ? 'bg-rose-500 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>R</button>
      </div>

      {/* Volume slider — hidden on mobile */}
      <div className="hidden xl:flex flex-1 flex-col gap-0.5 ml-1">
        {/* Level meter bar */}
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-75" style={{ width: `${levelPct}%`, background: levelColor }} />
        </div>
        {/* Volume input */}
        <div className="flex items-center gap-1">
          <input
            type="range" min={0} max={100} step={1} value={t.vol}
            onChange={(e) => onVolChange(t.id, Number(e.target.value))}
            className="flex-1 h-1 accent-orange-500 cursor-pointer"
            style={{ accentColor: t.color }}
          />
          <span className="text-[9px] text-zinc-500 w-6 tabular-nums">{t.vol}</span>
        </div>
      </div>

      {/* Pan button — hidden on mobile */}
      <button
        onClick={() => setShowPan((v) => !v)}
        className="hidden xl:block shrink-0 text-[8px] text-zinc-500 hover:text-zinc-200 px-1"
        title="Pan"
      >
        {showPan ? (
          <input
            type="range" min={-50} max={50} step={1} value={t.pan}
            onChange={(e) => onPanChange(t.id, Number(e.target.value))}
            className="w-12 h-1 accent-orange-500 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`font-mono ${t.pan < 0 ? 'text-blue-300' : t.pan > 0 ? 'text-orange-300' : 'text-zinc-500'}`}>
            {t.pan === 0 ? 'C' : t.pan < 0 ? `L${Math.abs(t.pan)}` : `R${t.pan}`}
          </span>
        )}
      </button>
    </div>
  );
}

function TracksPanel({ tracks, levels, setTracks, onAddTrack, selectedTrackId, onSelectTrack, onRenameTrack, onTrackContextMenu }: {
  tracks: Track[];
  levels: number[];
  setTracks: (t: Track[]) => void;
  onAddTrack: () => void;
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  onRenameTrack: (trackId: string) => void;
  onTrackContextMenu: (menu: TrackContextMenuState) => void;
}) {
  const handleMoveTrack = (fromId: string, toId: string) => {
    const fromIndex = tracks.findIndex((track) => track.id === fromId);
    const toIndex = tracks.findIndex((track) => track.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...tracks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setTracks(next);
  };

  return (
    <div className="bg-[#0e0e12] border-r border-white/5 w-full h-full flex flex-col">
      <div className="h-7 flex items-center justify-between px-3 border-b border-white/5 shrink-0">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Pistas</span>
        <button onClick={onAddTrack} className="text-zinc-500 hover:text-orange-400"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tracks.map((t, i) => (
          <TrackRow
            key={t.id}
            t={t}
            level={levels[i] || 0}
            selected={selectedTrackId === t.id}
            onSelect={onSelectTrack}
            onRename={onRenameTrack}
            onContextMenu={onTrackContextMenu}
            onToggle={(id, k) => setTracks(tracks.map((x) => (x.id === id ? { ...x, [k]: !x[k as keyof Track] } as Track : x)))}
            onVolChange={(id, vol) => setTracks(tracks.map((x) => x.id === id ? { ...x, vol } : x))}
            onPanChange={(id, pan) => setTracks(tracks.map((x) => x.id === id ? { ...x, pan } : x))}
            onMoveTrack={handleMoveTrack}
          />
        ))}
        <div className="px-2 py-2 border-t border-white/10 bg-white/[0.02] flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-zinc-200 text-zinc-900 flex items-center justify-center text-[11px] font-bold">M</div>
          <div className="flex-1 leading-tight">
            <div className="text-[10px] font-bold text-white">MASTER BUS</div>
            <div className="text-[9px] text-zinc-500">Stereo Out</div>
          </div>
          <span className="text-[9px] text-zinc-400 font-mono">0.0 dB</span>
        </div>
      </div>
    </div>
  );
}

function ArtistLibraryPanel({
  artists,
  songs,
  projects,
  currentProjectId,
  selectedArtistId,
  selectedSongId,
  loading,
  onArtistChange,
  onSongLoad,
  onProjectLoad,
  onRefresh,
  onImportFiles,
}: {
  artists: ArtistLibraryArtist[];
  songs: ArtistLibrarySong[];
  projects: any[];
  currentProjectId: string | null;
  selectedArtistId: string | null;
  selectedSongId: string | null;
  loading: boolean;
  onArtistChange: (id: string) => void;
  onSongLoad: (song: ArtistLibrarySong) => void | Promise<void>;
  onProjectLoad: (project: any) => void;
  onRefresh: () => void;
  onImportFiles: (files: FileList) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [librarySearch, setLibrarySearch] = useState('');
  const selectedArtist = artists.find((artist) => artist.id === selectedArtistId || artist.firestoreId === selectedArtistId || String(artist.pgId || '') === String(selectedArtistId || '')) || artists[0];
  const visibleSongs = selectedArtist ? selectedArtist.songs : songs;
  const selectedArtistIds = new Set([selectedArtist?.id, selectedArtist?.firestoreId, selectedArtist?.pgId && String(selectedArtist.pgId)].filter(Boolean).map(String));
  const visibleSongIds = new Set(visibleSongs.map((song) => String(song.id)));
  const visibleProjects = projects.filter((project: any) => selectedArtistIds.has(String(project.artistId || '')) || visibleSongIds.has(String(project.songId || '')));
  const filteredSongs = visibleSongs.filter((song) => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) return true;
    return [song.title, song.name, song.genre, song.duration].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
  });
  const projectForSong = (song: ArtistLibrarySong) => projects.find((project: any) => project.id === song.miniStudioProjectId || String(project.songId || '') === String(song.id));
  const projectCountForArtist = (artist: ArtistLibraryArtist) => {
    const ids = new Set([artist.id, artist.firestoreId, artist.pgId && String(artist.pgId)].filter(Boolean).map(String));
    const songIds = new Set((artist.songs || []).map((song) => String(song.id)));
    return projects.filter((project: any) => ids.has(String(project.artistId || '')) || songIds.has(String(project.songId || ''))).length;
  };
  const songCount = songs.length || artists.reduce((total, artist) => total + (artist.songs?.length || 0), 0);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) onImportFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`${expanded ? 'xl:h-[214px]' : ''} h-auto xl:h-14 bg-[#0d0d10] border-b border-white/5 shrink-0 xl:transition-[height] xl:duration-200 overflow-hidden`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* ─── MOBILE: compact 2-row header ────────────────────────── */}
      <div className="xl:hidden">
        {/* Row 1: artist select + song count + actions */}
        <div className="h-11 flex items-center gap-2 px-3">
          <div className="w-7 h-7 rounded-md bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
            <FolderOpen className="w-3.5 h-3.5 text-orange-300" />
          </div>
          <select
            value={selectedArtist?.id || ''}
            onChange={(e) => onArtistChange(e.target.value)}
            className="h-8 flex-1 min-w-0 rounded-md bg-white/5 border border-white/10 px-2 text-xs text-white outline-none"
          >
            {artists.length === 0 && <option value="">Sin artistas</option>}
            {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
          </select>
          <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => e.target.files && onImportFiles(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} className="w-9 h-9 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center shrink-0" title="Importar audio">
            <Upload className="w-4 h-4 text-orange-400" />
          </button>
          <button onClick={onRefresh} className="w-9 h-9 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center shrink-0" title="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {/* Row 2: song chips */}
        <div className="h-10 flex items-center gap-1.5 px-3 overflow-x-auto pb-1">
          {loading && <div className="text-[10px] text-zinc-500 flex items-center gap-1 shrink-0"><Loader2 className="w-3 h-3 animate-spin" /> Cargando...</div>}
          {!loading && filteredSongs.length === 0 && <div className="text-[10px] text-zinc-500 shrink-0">Sin canciones. Importa un archivo.</div>}
          {!loading && filteredSongs.slice(0, 10).map((song) => {
            const active = selectedSongId === song.id;
            return (
              <button
                key={song.id}
                onClick={() => void onSongLoad(song)}
                className={`h-8 px-2.5 rounded-md border text-left shrink-0 ${active ? 'bg-orange-500/20 border-orange-500/40 text-orange-200' : 'bg-white/[0.03] border-white/5 text-zinc-300'}`}
              >
                <div className="text-[10px] font-bold truncate max-w-[110px]">{song.title || song.name || 'Sin título'}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── DESKTOP: original single-row header ─────────────────── */}
      <div className="hidden xl:flex h-14 items-center gap-2 px-3">
        <div className="w-8 h-8 rounded-md bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
          <FolderOpen className="w-4 h-4 text-orange-300" />
        </div>
        <div className="leading-tight min-w-[118px] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">My Artists</div>
          <div className="text-[10px] text-zinc-300 font-semibold truncate">{artists.length} artistas · {songCount} canciones</div>
        </div>
        <select
          value={selectedArtist?.id || ''}
          onChange={(e) => onArtistChange(e.target.value)}
          className="h-8 w-[170px] rounded-md bg-white/5 border border-white/10 px-2 text-xs text-white outline-none shrink-0"
        >
          {artists.length === 0 && <option value="">Sin artistas</option>}
          {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
        </select>
        <div className="flex-1 flex items-center gap-1 overflow-x-auto min-w-0">
          {loading && <div className="text-[10px] text-zinc-500 flex items-center gap-1 shrink-0"><Loader2 className="w-3 h-3 animate-spin" /> Cargando...</div>}
          {!loading && filteredSongs.length === 0 && <div className="text-[10px] text-zinc-500 shrink-0">Sin canciones en este artista.</div>}
          {!loading && filteredSongs.slice(0, 8).map((song) => {
            const active = selectedSongId === song.id;
            const hasProject = !!projectForSong(song);
            return (
              <button
                key={song.id}
                onClick={() => void onSongLoad(song)}
                className={`h-8 max-w-[155px] px-2 rounded-md border text-left shrink-0 ${active ? 'bg-orange-500/20 border-orange-500/40 text-orange-200' : 'bg-white/[0.03] border-white/5 text-zinc-300 hover:bg-white/10'}`}
                title={hasProject ? 'Abrir proyecto de esta canción' : 'Crear proyecto para esta canción'}
              >
                <div className="text-[10px] font-bold truncate">{song.title || song.name || 'Sin título'}</div>
                <div className="text-[8px] text-zinc-500 truncate">{hasProject ? 'Proyecto guardado' : 'Nuevo proyecto'} · {song.genre || 'Studio'}</div>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setExpanded((value) => !value)}
          className="h-8 w-8 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center shrink-0"
          title={expanded ? 'Contraer librería' : 'Abrir librería'}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onImportFiles(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="h-8 px-2.5 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-zinc-300 font-bold flex items-center gap-1.5 shrink-0"
          title="Importar archivo de audio"
        >
          <Upload className="w-3.5 h-3.5 text-orange-400" /> <span className="hidden sm:inline">Archivo</span>
        </button>
        <button onClick={onRefresh} className="h-8 px-2 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-zinc-300 font-bold shrink-0 flex items-center gap-1" title="Actualizar librería">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>{/* end desktop header */}

      {expanded && (
        <div className="hidden xl:grid px-3 pb-3 grid-cols-[240px_minmax(0,1fr)_240px] gap-2 h-[160px]">
          <div className="rounded-md border border-white/5 bg-white/[0.025] overflow-hidden">
            <div className="h-7 px-2 flex items-center justify-between border-b border-white/5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Artistas</span>
              <span className="text-[9px] text-zinc-600">{artists.length}</span>
            </div>
            <div className="h-[132px] overflow-y-auto p-1.5 space-y-1">
              {!loading && artists.length === 0 && <div className="text-[10px] text-zinc-500 px-1 py-2">My Artists vacío.</div>}
              {artists.map((artist) => {
                const active = selectedArtist?.id === artist.id;
                return (
                  <button
                    key={artist.id}
                    onClick={() => onArtistChange(artist.id)}
                    className={`w-full h-9 rounded-md px-2 flex items-center gap-2 text-left border ${active ? 'bg-orange-500/15 border-orange-500/35' : 'bg-white/[0.03] border-transparent hover:bg-white/10'}`}
                  >
                    {artist.image ? (
                      <img src={artist.image} alt={artist.name} className="w-6 h-6 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-zinc-800 text-zinc-300 flex items-center justify-center text-[10px] font-bold shrink-0">{artist.name?.[0]?.toUpperCase() || 'A'}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-white truncate">{artist.name}</div>
                      <div className="text-[8px] text-zinc-500 truncate">{artist.songs?.length || 0} canciones · {projectCountForArtist(artist)} proyectos</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-white/5 bg-white/[0.025] overflow-hidden min-w-0">
            <div className="h-7 px-2 flex items-center gap-2 border-b border-white/5">
              <Music2 className="w-3.5 h-3.5 text-orange-300 shrink-0" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide truncate">Canciones en base de datos</span>
              <input
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Buscar"
                className="ml-auto h-5 w-[150px] rounded bg-black/30 border border-white/10 px-2 text-[10px] text-white outline-none"
              />
            </div>
            <div className="h-[132px] overflow-y-auto p-1.5 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-1.5">
              {!loading && filteredSongs.length === 0 && <div className="text-[10px] text-zinc-500 px-1 py-2">No hay canciones para importar.</div>}
              {filteredSongs.map((song) => {
                const active = selectedSongId === song.id;
                const linkedProject = projectForSong(song);
                return (
                  <button
                    key={song.id}
                    onClick={() => void onSongLoad(song)}
                    className={`min-h-10 rounded-md px-2 py-1.5 flex items-center gap-2 text-left border ${active ? 'bg-orange-500/15 border-orange-500/35' : 'bg-white/[0.03] border-white/5 hover:bg-white/10'}`}
                    title={linkedProject ? 'Abrir proyecto de esta canción' : 'Crear proyecto separado para esta canción'}
                  >
                    <FileAudio className="w-4 h-4 text-orange-300 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-white truncate">{song.title || song.name || 'Sin título'}</div>
                      <div className="text-[8px] text-zinc-500 truncate">{song.genre || 'Studio'} · {linkedProject ? 'Proyecto guardado' : 'Sin proyecto'}</div>
                    </div>
                    <span className={`text-[9px] font-bold shrink-0 ${linkedProject ? 'text-emerald-300' : 'text-orange-200'}`}>{linkedProject ? 'Abrir' : 'Crear'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-white/5 bg-white/[0.025] overflow-hidden min-w-0">
            <div className="h-7 px-2 flex items-center justify-between border-b border-white/5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide truncate">Proyectos del artista</span>
              <span className="text-[9px] text-zinc-600">{visibleProjects.length}</span>
            </div>
            <div className="h-[132px] overflow-y-auto p-1.5 space-y-1">
              {!loading && visibleProjects.length === 0 && <div className="text-[10px] text-zinc-500 px-1 py-2">Cada canción abrirá su propio proyecto al cargarla.</div>}
              {visibleProjects.map((project: any) => {
                const active = currentProjectId === project.id;
                const projectSong = visibleSongs.find((song) => String(song.id) === String(project.songId || ''));
                return (
                  <button
                    key={project.id}
                    onClick={() => onProjectLoad(project)}
                    className={`w-full min-h-10 rounded-md px-2 py-1.5 text-left border ${active ? 'bg-orange-500/15 border-orange-500/35' : 'bg-white/[0.03] border-white/5 hover:bg-white/10'}`}
                  >
                    <div className="text-[10px] font-bold text-white truncate">{project.name || projectSong?.title || projectSong?.name || 'Proyecto sin título'}</div>
                    <div className="text-[8px] text-zinc-500 truncate">{projectSong?.title || projectSong?.name || 'Sesión'} · {project.tracks?.length || 0} pistas</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AudioPlayer({ audioUrl, songTitle, artistName, isPlaying, onSeek, onVolumeChange, audioRef }: {
  audioUrl: string; songTitle: string; artistName: string;
  isPlaying: boolean; onSeek: (pct: number) => void; onVolumeChange: (v: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const onTime = () => {
      if (audioEl.duration) setProgress(audioEl.currentTime / audioEl.duration);
    };
    const onMeta = () => setDuration(audioEl.duration || 0);
    audioEl.addEventListener('timeupdate', onTime);
    audioEl.addEventListener('loadedmetadata', onMeta);
    return () => { audioEl.removeEventListener('timeupdate', onTime); audioEl.removeEventListener('loadedmetadata', onMeta); };
  }, [audioRef, audioUrl]);

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, pct)));
  };

  const handleVol = (v: number) => {
    setVolume(v);
    onVolumeChange(v / 100);
    if (v === 0) setMuted(true);
    else setMuted(false);
  };

  return (
    <div className="h-11 bg-[#0b0b0f] border-b border-white/5 flex items-center gap-2 xl:gap-3 px-3 shrink-0">
      <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shrink-0">
        <Music2 className="w-3 h-3 text-white" />
      </div>
      <div className="min-w-0 w-[130px] shrink-0">
        <div className="text-[10px] font-bold text-white truncate">{songTitle}</div>
        <div className="text-[8px] text-zinc-500 truncate">{artistName}</div>
      </div>
      {/* Seekbar */}
      <div
        ref={barRef}
        onClick={handleBarClick}
        className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer relative overflow-hidden"
      >
        <div className="absolute inset-y-0 left-0 bg-orange-500 rounded-full transition-none" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-[9px] font-mono text-zinc-400 shrink-0">
        {formatTime(progress * duration)} / {formatTime(duration)}
      </span>
      {/* Volume */}
      <button onClick={() => { setMuted(m => !m); onVolumeChange(muted ? volume / 100 : 0); }} className="text-zinc-400 hover:text-white shrink-0">
        {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>
      <input
        type="range" min={0} max={100} value={volume}
        onChange={(e) => handleVol(Number(e.target.value))}
        className="hidden xl:block w-16 h-1 accent-orange-500"
      />
    </div>
  );
}

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ['Space', 'Play / Pause'],
    ['R', 'Grabar / Detener grabación'],
    ['Escape', 'Stop todo'],
    ['Ctrl+S', 'Guardar proyecto'],
    ['A', 'Agregar pista'],
    ['Delete / Backspace', 'Borrar clip seleccionado'],
    ['Shift+Delete', 'Borrar pista seleccionada'],
    ['Ctrl+D', 'Duplicar clip seleccionado'],
    ['Ctrl+Shift+D', 'Duplicar pista seleccionada'],
    ['F2', 'Renombrar clip o pista'],
    ['S', 'Cortar clip en el playhead'],
    ['Shift+← / Shift+→', 'Mover clip en el timeline'],
    ['Shift+↑ / Shift+↓', 'Mover clip entre pistas'],
    ['Home / 0', 'Rebobinar al inicio'],
    ['← / →', 'Mover playhead'],
    ['G', 'Toggle Grid'],
    ['Q', 'Toggle Snap'],
    ['?', 'Abrir estos atajos'],
  ];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#13131a] border border-white/10 rounded-xl p-5 w-[420px] max-w-[calc(100vw-32px)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white font-bold"><Keyboard className="w-4 h-4 text-orange-400" /> Atajos de teclado</div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1.5">
          {shortcuts.map(([key, desc]) => (
            <div key={key} className="grid grid-cols-[128px_minmax(0,1fr)] items-center gap-3 text-xs">
              <kbd className="px-2 py-0.5 bg-white/10 rounded text-zinc-200 font-mono text-[10px] truncate">{key}</kbd>
              <span className="text-zinc-400 min-w-0">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RenameDialog({ dialog, onClose, onSubmit }: {
  dialog: RenameDialogState;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(dialog.initialValue);

  useEffect(() => {
    setValue(dialog.initialValue);
  }, [dialog.id, dialog.initialValue]);

  const commit = () => {
    const nextValue = value.trim();
    if (!nextValue) return;
    onSubmit(nextValue);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <form
        className="w-[340px] rounded-xl border border-white/10 bg-[#13131a] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); commit(); }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Pencil className="w-4 h-4 text-orange-400" /> {dialog.title}
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{dialog.label}</label>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-sm text-white outline-none focus:border-orange-500/60"
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-md bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-300">Cancelar</button>
          <button type="submit" disabled={!value.trim()} className="h-8 px-3 rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-xs font-bold text-white">Guardar</button>
        </div>
      </form>
    </div>
  );
}

type ClipEditTool = 'select' | 'cut';
type ClipDragMode = 'move' | 'trim-start' | 'trim-end';
interface ClipContextMenuState { clipId: string; x: number; y: number; splitAt: number; }
interface RenameDialogState { target: 'clip' | 'track'; id: string; title: string; label: string; initialValue: string; }

function WaveformStrip({ seed, color = '#f97316' }: { seed: number; color?: string }) {
  const peaks = useMemo(() => fallbackWaveformPeaks(seed, 220), [seed]);
  const path = useMemo(() => {
    const pointX = (index: number) => (index / Math.max(1, peaks.length - 1)) * 100;
    const top = peaks.map((peak, index) => `${pointX(index).toFixed(2)},${(50 - Math.max(0.04, peak.max) * 42).toFixed(2)}`);
    const bottom = [...peaks].reverse().map((peak, reverseIndex) => {
      const index = peaks.length - 1 - reverseIndex;
      return `${pointX(index).toFixed(2)},${(50 + Math.max(0.04, Math.abs(peak.min)) * 42).toFixed(2)}`;
    });
    return `M ${top.join(' L ')} L ${bottom.join(' L ')} Z`;
  }, [peaks]);

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="100" y1="50" y2="50" stroke="rgba(255,255,255,0.28)" strokeWidth="0.45" vectorEffect="non-scaling-stroke" />
      <path d={path} fill={color} opacity="0.46" />
      <path d={path} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TimelineClip({ clip, color, selected, editorTool, onSelect, onSplit, onContextMenu, onPointerDown, onPointerMove, onPointerUp }: {
  clip: Clip;
  color: string;
  selected: boolean;
  editorTool: ClipEditTool;
  onSelect: () => void;
  onSplit: (absolutePct: number) => void;
  onContextMenu: (x: number, y: number, absolutePct: number) => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, mode: ClipDragMode) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const fallbackPeaks = useMemo(() => fallbackWaveformPeaks(clip.name.length * 17 + Math.round(clip.start * 10), 120), [clip.id, clip.name, clip.start]);
  const [decodedPeaks, setDecodedPeaks] = useState<WaveformPeak[] | null>(null);
  const peaks = decodedPeaks || fallbackPeaks;
  const gain = clip.gain ?? 1;
  const opacity = clip.muted ? 0.32 : Math.max(0.35, Math.min(1, gain));
  const waveFillId = useMemo(() => `waveFill-${clip.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`, [clip.id]);
  const waveCoreId = useMemo(() => `waveCore-${clip.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`, [clip.id]);

  const waveform = useMemo(() => {
    const visualGain = Math.max(0.35, Math.min(1.6, gain));
    const pointX = (index: number) => (peaks.length <= 1 ? 0 : (index / (peaks.length - 1)) * 100);
    const top = peaks.map((peak, index) => {
      const amp = Math.min(1, Math.max(0.025, peak.max * visualGain));
      return `${pointX(index).toFixed(2)},${(50 - amp * 44).toFixed(2)}`;
    });
    const bottom = [...peaks].reverse().map((peak, reverseIndex) => {
      const index = peaks.length - 1 - reverseIndex;
      const amp = Math.min(1, Math.max(0.025, Math.abs(peak.min) * visualGain));
      return `${pointX(index).toFixed(2)},${(50 + amp * 44).toFixed(2)}`;
    });
    const rmsTop = peaks.map((peak, index) => {
      const amp = Math.min(1, Math.max(0.018, peak.rms * visualGain * 0.68));
      return `${pointX(index).toFixed(2)},${(50 - amp * 34).toFixed(2)}`;
    });
    const rmsBottom = [...peaks].reverse().map((peak, reverseIndex) => {
      const index = peaks.length - 1 - reverseIndex;
      const amp = Math.min(1, Math.max(0.018, peak.rms * visualGain * 0.68));
      return `${pointX(index).toFixed(2)},${(50 + amp * 34).toFixed(2)}`;
    });
    const transientMarks = peaks
      .map((peak, index) => ({ x: pointX(index), strength: peak.transient }))
      .filter((mark) => mark.strength > 0.13)
      .slice(0, 24);
    return {
      peakPath: `M ${top.join(' L ')} L ${bottom.join(' L ')} Z`,
      rmsPath: `M ${rmsTop.join(' L ')} L ${rmsBottom.join(' L ')} Z`,
      transientMarks,
    };
  }, [gain, peaks]);

  useEffect(() => {
    let mounted = true;
    if (!clip.audioUrl || clip.audioUrl.includes('placeholder')) {
      setDecodedPeaks(null);
      return () => { mounted = false; };
    }
    extractWaveformPeaks(clip.audioUrl, 120)
      .then((peaks) => { if (mounted) setDecodedPeaks(peaks); })
      .catch(() => { if (mounted) setDecodedPeaks(null); });
    return () => { mounted = false; };
  }, [clip.audioUrl]);

  const pctFromEvent = (clientX: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const relative = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return clip.start + clip.width * relative;
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (editorTool === 'cut') onSplit(pctFromEvent(e.clientX, e.currentTarget));
        else onSelect();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e.clientX, e.clientY, pctFromEvent(e.clientX, e.currentTarget));
      }}
      onPointerDown={(e) => onPointerDown(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute top-0.5 bottom-0.5 rounded-md overflow-hidden border group select-none ${editorTool === 'cut' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'} ${selected ? 'border-orange-300 shadow-[0_0_0_1px_rgba(251,146,60,0.65)]' : 'border-white/10'}`}
      style={{
        left: `${clip.start}%`,
        width: `${clip.width}%`,
        background: `linear-gradient(180deg, ${color}30, ${color}18)`,
        opacity,
      }}
    >
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '12.5% 100%' }} />
      <div
        onPointerDown={(e) => onPointerDown(e, 'trim-start')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 bg-white/0 hover:bg-white/20"
      />
      <div
        onPointerDown={(e) => onPointerDown(e, 'trim-end')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 bg-white/0 hover:bg-white/20"
      />
      <div className="absolute inset-x-0 top-0 h-3 bg-black/45 flex items-center gap-1 px-1.5">
        {decodedPeaks && <AudioLines className="w-2.5 h-2.5 text-white/60 shrink-0" />}
        <span className="text-[8px] text-white/85 font-medium truncate">{clip.name}</span>
      </div>
      <div className="absolute inset-x-1 bottom-0.5 top-3 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={waveFillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.98" />
              <stop offset="48%" stopColor={color} stopOpacity="0.72" />
              <stop offset="52%" stopColor={color} stopOpacity="0.72" />
              <stop offset="100%" stopColor={color} stopOpacity="0.98" />
            </linearGradient>
            <linearGradient id={waveCoreId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <line x1="0" x2="100" y1="50" y2="50" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          <path d={waveform.peakPath} fill={`url(#${waveFillId})`} stroke="rgba(255,255,255,0.16)" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
          <path d={waveform.rmsPath} fill={`url(#${waveCoreId})`} opacity="0.62" />
          {waveform.transientMarks.map((mark, index) => (
            <line key={`${mark.x}-${index}`} x1={mark.x} x2={mark.x} y1={10} y2={90} stroke="rgba(255,255,255,0.28)" strokeWidth={0.32 + Math.min(0.9, mark.strength * 2.5)} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      {(clip.fadeIn || 0) > 0 && <div className="absolute left-0 top-3 bottom-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" style={{ width: `${Math.min(35, clip.fadeIn || 0)}%` }} />}
      {(clip.fadeOut || 0) > 0 && <div className="absolute right-0 top-3 bottom-0 bg-gradient-to-l from-black/60 to-transparent pointer-events-none" style={{ width: `${Math.min(35, clip.fadeOut || 0)}%` }} />}
    </div>
  );
}

function Timeline({ tracks, clips, selectedClipId, editorTool, playhead, gridOn, snapOn, quantize, onTool, onSeekClick, onClipSelect, onClipUpdate, onClipSplit, onClipContextMenu, onClipDuplicate, onClipDelete, onClipRename }: {
  tracks: Track[]; clips: Clip[]; playhead: number; gridOn: boolean; snapOn: boolean; quantize: string;
  selectedClipId: string | null; editorTool: ClipEditTool;
  onTool: (tool: string) => void; onSeekClick: (pct: number) => void;
  onClipSelect: (clipId: string | null) => void;
  onClipUpdate: (clipId: string, patch: Partial<Clip>) => void;
  onClipSplit: (clipId: string, absolutePct: number) => void;
  onClipContextMenu: (menu: ClipContextMenuState) => void;
  onClipDuplicate: (clipId: string) => void;
  onClipDelete: (clipId: string) => void;
  onClipRename: (clipId: string) => void;
}) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    clipId: string;
    mode: ClipDragMode;
    startX: number;
    startY: number;
    originalStart: number;
    originalWidth: number;
    originalTrackId: string;
  } | null>(null);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || null;
  const selectedTrack = selectedClip ? tracks.find((track) => track.id === selectedClip.trackId) : null;

  const trackIdFromY = (clientY: number) => {
    if (!timelineRef.current) return tracks[0]?.id || 't1';
    const rect = timelineRef.current.getBoundingClientRect();
    const y = clientY - rect.top + timelineRef.current.scrollTop;
    const index = Math.max(0, Math.min(tracks.length - 1, Math.floor(y / 44)));
    return tracks[index]?.id || tracks[0]?.id || 't1';
  };

  const handleClipPointerDown = (e: React.PointerEvent<HTMLDivElement>, clip: Clip, mode: ClipDragMode) => {
    if (editorTool === 'cut' && mode === 'move') return;
    e.stopPropagation();
    onClipSelect(clip.id);
    dragRef.current = { clipId: clip.id, mode, startX: e.clientX, startY: e.clientY, originalStart: clip.start, originalWidth: clip.width, originalTrackId: clip.trackId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleClipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !timelineRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const drag = dragRef.current;
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaPct = ((e.clientX - drag.startX) / rect.width) * 100;

    if (drag.mode === 'move') {
      const nextStart = Math.min(100 - drag.originalWidth, Math.max(0, snapTimelinePct(drag.originalStart + deltaPct, snapOn, quantize)));
      onClipUpdate(drag.clipId, { start: nextStart, trackId: trackIdFromY(e.clientY) });
      return;
    }

    if (drag.mode === 'trim-start') {
      const rawStart = snapTimelinePct(drag.originalStart + deltaPct, snapOn, quantize);
      const nextStart = Math.max(0, Math.min(drag.originalStart + drag.originalWidth - 2, rawStart));
      onClipUpdate(drag.clipId, { start: nextStart, width: drag.originalWidth + (drag.originalStart - nextStart) });
      return;
    }

    const rawWidth = snapTimelinePct(drag.originalWidth + deltaPct, snapOn, quantize);
    const nextWidth = Math.max(2, Math.min(100 - drag.originalStart, rawWidth));
    onClipUpdate(drag.clipId, { width: nextWidth });
  };

  const handleClipPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    onClipSelect(null);
    onSeekClick(Math.max(0, Math.min(99, pct)));
  };

  return (
    <div className="flex-1 bg-[#0a0a0d] flex flex-col min-w-0">
      <div className="h-7 border-b border-white/5 flex relative bg-[#101015]">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSeekClick(s.start)}
            className={`absolute top-0 bottom-0 border-r border-white/10 px-2 flex items-center text-[9px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity ${
              s.active ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-white'
            }`}
            style={{ left: `${s.start}%`, width: `${s.width}%` }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="h-5 border-b border-white/5 flex relative text-[9px] text-zinc-500 font-mono px-1">
        {Array.from({ length: 23 }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-white/5 px-1">{i * 4 + 1}</div>
        ))}
      </div>
      <div ref={timelineRef} className="flex-1 relative overflow-y-auto cursor-pointer" onClick={handleTimelineClick}>
        {tracks.map((t) => {
          const trackClips = clips.filter((c) => c.trackId === t.id);
          const opacity = t.mute ? 0.25 : 1;
          return (
            <div key={t.id} className="h-[44px] border-b border-white/5 relative bg-gradient-to-r from-transparent to-white/[0.01]" style={{ opacity }}>
              {trackClips.map((c, i) => (
                <TimelineClip
                  key={c.id || `${c.trackId}-${i}`}
                  clip={c}
                  color={t.color}
                  selected={selectedClipId === c.id}
                  editorTool={editorTool}
                  onSelect={() => onClipSelect(c.id)}
                  onSplit={(absolutePct) => onClipSplit(c.id, absolutePct)}
                  onContextMenu={(x, y, absolutePct) => onClipContextMenu({ clipId: c.id, x, y, splitAt: absolutePct })}
                  onPointerDown={(e, mode) => handleClipPointerDown(e, c, mode)}
                  onPointerMove={handleClipPointerMove}
                  onPointerUp={handleClipPointerUp}
                />
              ))}
            </div>
          );
        })}
        <div className="absolute top-0 bottom-0 w-px bg-orange-400 z-10 pointer-events-none" style={{ left: `${playhead}%` }}>
          <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-orange-400 rotate-45" />
        </div>
      </div>
      <div className="h-12 border-t border-white/10 bg-[#0d0d10] relative cursor-pointer overflow-hidden" onClick={handleTimelineClick}>
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '4.35% 100%' }} />
        <WaveformStrip seed={42} color="#f97316" />
        <div className="absolute top-0 bottom-0 w-px bg-orange-400" style={{ left: `${playhead}%` }} />
      </div>
      <div className="h-7 border-t border-white/5 flex items-center px-2 gap-2 text-[10px] text-zinc-400 bg-[#101015]">
        <button onClick={() => onTool('grid')} className={gridOn ? 'text-orange-400 font-bold' : 'hover:text-white'}>GRID</button>
        <button onClick={() => onTool('snap')} className={snapOn ? 'text-orange-400 font-bold' : 'hover:text-white'}>SNAP</button>
        <button onClick={() => onTool('quantize')} className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10">{quantize} ▾</button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => onTool('select')} className={editorTool === 'select' ? 'text-orange-400' : 'hover:text-white'} title="Mover clips"><ArrowLeftRight className="w-3.5 h-3.5" /></button>
          <button onClick={() => onTool('cut')} className={editorTool === 'cut' ? 'text-orange-400' : 'hover:text-white'} title="Cortar clips"><Scissors className="w-3.5 h-3.5" /></button>
          <button onClick={() => onTool('loop')} className="hover:text-white"><Repeat className="w-3.5 h-3.5" /></button>
          <button onClick={() => onTool('layers')} className="hover:text-white"><Layers className="w-3.5 h-3.5" /></button>
          <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden ml-2">
            <div className="h-full bg-orange-500 w-1/3" />
          </div>
          <span className="text-zinc-500">100%</span>
        </div>
      </div>
      {selectedClip && (
        <div className="h-10 border-t border-white/5 bg-[#0b0b10] flex items-center gap-2 px-2 text-[10px] text-zinc-400">
          <div className="min-w-0 w-40">
            <div className="text-white font-bold truncate">{selectedClip.name}</div>
            <div className="text-[8px] text-zinc-500 truncate">{selectedTrack?.name || selectedClip.trackId} · {selectedClip.start.toFixed(1)}% / {selectedClip.width.toFixed(1)}%</div>
          </div>
          <button onClick={() => onClipSplit(selectedClip.id, playhead)} className="h-7 px-2 rounded bg-white/5 hover:bg-white/10 text-zinc-200 flex items-center gap-1"><Scissors className="w-3 h-3" /> Cortar</button>
          <button onClick={() => onClipRename(selectedClip.id)} className="h-7 px-2 rounded bg-white/5 hover:bg-white/10 text-zinc-200 flex items-center gap-1"><Pencil className="w-3 h-3" /> Nombre</button>
          <button onClick={() => onClipDuplicate(selectedClip.id)} className="h-7 px-2 rounded bg-white/5 hover:bg-white/10 text-zinc-200 flex items-center gap-1"><Copy className="w-3 h-3" /> Duplicar</button>
          <label className="flex items-center gap-1 min-w-[110px]">Gain
            <input type="range" min={0} max={1.5} step={0.05} value={selectedClip.gain ?? 1} onChange={(e) => onClipUpdate(selectedClip.id, { gain: Number(e.target.value) })} className="w-20 h-1 accent-orange-500" />
          </label>
          <label className="flex items-center gap-1 min-w-[105px]">Fade In
            <input type="range" min={0} max={35} step={1} value={selectedClip.fadeIn ?? 0} onChange={(e) => onClipUpdate(selectedClip.id, { fadeIn: Number(e.target.value) })} className="w-16 h-1 accent-orange-500" />
          </label>
          <label className="flex items-center gap-1 min-w-[105px]">Fade Out
            <input type="range" min={0} max={35} step={1} value={selectedClip.fadeOut ?? 0} onChange={(e) => onClipUpdate(selectedClip.id, { fadeOut: Number(e.target.value) })} className="w-16 h-1 accent-orange-500" />
          </label>
          <button onClick={() => onClipDelete(selectedClip.id)} className="ml-auto h-7 px-2 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Eliminar</button>
        </div>
      )}
    </div>
  );
}

function ClipContextMenu({ menu, clip, tracks, selectedTrackId, playhead, onClose, onSplit, onDuplicate, onDelete, onRename, onToggleMute, onMoveToTrack, onSetTool, onAlignToPlayhead }: {
  menu: ClipContextMenuState;
  clip: Clip | null;
  tracks: Track[];
  selectedTrackId: string | null;
  playhead: number;
  onClose: () => void;
  onSplit: (clipId: string, absolutePct: number) => void;
  onDuplicate: (clipId: string) => void;
  onDelete: (clipId: string) => void;
  onRename: (clipId: string) => void;
  onToggleMute: (clipId: string) => void;
  onMoveToTrack: (clipId: string, trackId: string) => void;
  onSetTool: (tool: ClipEditTool) => void;
  onAlignToPlayhead: (clipId: string, playhead: number) => void;
}) {
  if (!clip) return null;
  const run = (fn: () => void) => { fn(); onClose(); };
  return (
    <div className="fixed inset-0 z-[120]" onClick={onClose}>
      <div
        className="absolute w-56 rounded-lg border border-white/10 bg-[#111117] shadow-2xl p-1 text-xs text-zinc-200"
        style={{ left: Math.min(menu.x, window.innerWidth - 236), top: Math.min(menu.y, window.innerHeight - 260) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 border-b border-white/10 mb-1">
          <div className="text-[10px] font-bold text-white truncate">{clip.name}</div>
          <div className="text-[9px] text-zinc-500">Editar clip</div>
        </div>
        <div className="grid grid-cols-2 gap-1 mb-1">
          <button onClick={() => run(() => onSetTool('select'))} className="h-8 px-2 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center gap-1"><ArrowLeftRight className="w-3.5 h-3.5 text-zinc-300" /> Mover</button>
          <button onClick={() => run(() => onSetTool('cut'))} className="h-8 px-2 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center gap-1"><Scissors className="w-3.5 h-3.5 text-orange-300" /> Cortar</button>
        </div>
        <button onClick={() => run(() => onSplit(clip.id, menu.splitAt))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><Scissors className="w-3.5 h-3.5 text-orange-300" /> Cortar aquí</button>
        <button onClick={() => run(() => onAlignToPlayhead(clip.id, playhead))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><Clock className="w-3.5 h-3.5 text-zinc-300" /> Mover al playhead</button>
        <button onClick={() => run(() => onRename(clip.id))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><Pencil className="w-3.5 h-3.5 text-zinc-300" /> Renombrar</button>
        <button onClick={() => run(() => onDuplicate(clip.id))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><Copy className="w-3.5 h-3.5 text-zinc-300" /> Duplicar</button>
        <button onClick={() => run(() => onToggleMute(clip.id))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><VolumeX className="w-3.5 h-3.5 text-zinc-300" /> {clip.muted ? 'Activar audio' : 'Silenciar clip'}</button>
        {selectedTrackId && selectedTrackId !== clip.trackId && (
          <button onClick={() => run(() => onMoveToTrack(clip.id, selectedTrackId))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><ArrowLeftRight className="w-3.5 h-3.5 text-zinc-300" /> Mover a pista seleccionada</button>
        )}
        <div className="px-2 py-1.5 text-[9px] uppercase tracking-widest text-zinc-500">Mover a pista</div>
        <select
          value={clip.trackId}
          onChange={(e) => run(() => onMoveToTrack(clip.id, e.target.value))}
          className="w-full h-8 rounded bg-white/5 border border-white/10 px-2 text-[10px] text-white outline-none"
        >
          {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
        </select>
        <button onClick={() => run(() => onDelete(clip.id))} className="mt-1 w-full h-8 px-2 rounded hover:bg-rose-500/15 text-rose-300 flex items-center gap-2 text-left"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
      </div>
    </div>
  );
}

function TrackContextMenu({ menu, track, onClose, onRename, onArm, onMute, onSolo, onRecordHere, onDuplicate, onDelete }: {
  menu: TrackContextMenuState;
  track: Track | null;
  onClose: () => void;
  onRename: (trackId: string) => void;
  onArm: (trackId: string) => void;
  onMute: (trackId: string) => void;
  onSolo: (trackId: string) => void;
  onRecordHere: (trackId: string) => void;
  onDuplicate: (trackId: string) => void;
  onDelete: (trackId: string) => void;
}) {
  if (!track) return null;
  const run = (fn: () => void) => { fn(); onClose(); };
  return (
    <div className="fixed inset-0 z-[120]" onClick={onClose}>
      <div
        className="absolute w-56 rounded-lg border border-white/10 bg-[#111117] shadow-2xl p-1 text-xs text-zinc-200"
        style={{ left: Math.min(menu.x, window.innerWidth - 236), top: Math.min(menu.y, window.innerHeight - 260) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 border-b border-white/10 mb-1">
          <div className="text-[10px] font-bold text-white truncate">{track.name}</div>
          <div className="text-[9px] text-zinc-500">Canal / pista</div>
        </div>
        <button onClick={() => run(() => onRecordHere(track.id))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><CircleDot className="w-3.5 h-3.5 text-rose-400" /> Grabar aquí</button>
        <button onClick={() => run(() => onRename(track.id))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><Pencil className="w-3.5 h-3.5 text-zinc-300" /> Renombrar pista</button>
        <button onClick={() => run(() => onArm(track.id))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><Mic2 className="w-3.5 h-3.5 text-zinc-300" /> {track.rec ? 'Desarmar REC' : 'Armar REC'}</button>
        <button onClick={() => run(() => onMute(track.id))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><VolumeX className="w-3.5 h-3.5 text-zinc-300" /> {track.mute ? 'Quitar mute' : 'Mute'}</button>
        <button onClick={() => run(() => onSolo(track.id))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><Headphones className="w-3.5 h-3.5 text-zinc-300" /> {track.solo ? 'Quitar solo' : 'Solo'}</button>
        <button onClick={() => run(() => onDuplicate(track.id))} className="w-full h-8 px-2 rounded hover:bg-white/10 flex items-center gap-2 text-left"><Copy className="w-3.5 h-3.5 text-zinc-300" /> Duplicar pista</button>
        <button onClick={() => run(() => onDelete(track.id))} className="mt-1 w-full h-8 px-2 rounded hover:bg-rose-500/15 text-rose-300 flex items-center gap-2 text-left"><Trash2 className="w-3.5 h-3.5" /> Eliminar pista</button>
      </div>
    </div>
  );
}

function AgentsPanel({ onAgentRun, onQuickAction, runningAgent, runningAction }:
  { onAgentRun: (slug: string) => void; onQuickAction: (kind: string) => void;
    runningAgent: string | null; runningAction: string | null }) {
  return (
    <aside className="w-full xl:w-[300px] xl:shrink-0 bg-[#0e0e12] xl:border-l border-white/5 flex flex-col">
      <div className="h-7 flex items-center justify-between px-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Agentes de IA</span>
          <span className="text-[8px] font-bold text-amber-400 px-1 py-0.5 bg-amber-500/10 rounded">BETA</span>
        </div>
        <Power className="w-3 h-3 text-zinc-600" />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {AGENTS.map((a) => {
          const Icon = a.icon;
          const running = runningAgent === a.agentSlug;
          return (
            <div key={a.id} className="bg-white/[0.02] hover:bg-white/[0.04] rounded-lg p-2 border border-white/5 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${a.chip} flex items-center justify-center shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-xs font-bold text-white truncate">{a.name}</div>
                <div className="text-[9px] text-zinc-500 truncate">{a.desc}</div>
              </div>
              <button
                onClick={() => onAgentRun(a.agentSlug)}
                disabled={running}
                className={`text-[10px] font-bold px-2.5 py-1 rounded ${a.ctaColor} disabled:opacity-50 flex items-center gap-1`}
              >
                {running && <Loader2 className="w-3 h-3 animate-spin" />}
                {a.cta}
              </button>
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/5 px-2 py-2">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 px-1">Acciones Rápidas</div>
        <div className="grid grid-cols-4 gap-1">
          {QUICK_ACTIONS.map((q) => {
            const Icon = q.icon;
            const running = runningAction === q.kind;
            return (
              <button
                key={q.id}
                onClick={() => onQuickAction(q.kind)}
                disabled={running}
                className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-white/5 text-center disabled:opacity-50"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> : <Icon className={`w-4 h-4 ${q.color}`} />}
                <span className="text-[8px] text-zinc-300 leading-tight whitespace-pre-line">{q.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function VocalBooth({ tracks = [], clips = [], track, selectedClipId, settings, onSettingsChange, onTool, isRecording, onStartRecording, onStopRecording, recordingTime, recordedUrl, lyrics, onShowLyrics, onTrackSelect, onArmTrack, onTakeSelect, onTakeMute, onTakeDuplicate, onTakeDelete, onTakeRename, onSaveSession, plugins = [], levels = [], bpm, keyName, projectName }: {
  tracks: Track[];
  clips: Clip[];
  track: Track | null;
  selectedClipId: string | null;
  settings: VocalBoothSettings;
  onSettingsChange: (patch: Partial<VocalBoothSettings>) => void;
  onTool: (tool: string) => void;
  isRecording: boolean;
  onStartRecording: (trackId?: string) => void;
  onStopRecording: () => void;
  recordingTime: number;
  recordedUrl: string | null;
  lyrics: string;
  onShowLyrics: () => void;
  onTrackSelect: (trackId: string) => void;
  onArmTrack: (trackId: string) => void;
  onTakeSelect: (clipId: string) => void;
  onTakeMute: (clipId: string) => void;
  onTakeDuplicate: (clipId: string) => void;
  onTakeDelete: (clipId: string) => void;
  onTakeRename: (clipId: string) => void;
  onSaveSession: () => void;
  plugins: PluginState[];
  levels: number[];
  bpm: number;
  keyName: string;
  projectName: string;
}) {
  const vocalTracks = tracks.filter((item) => item.type.toLowerCase().includes('vocal') || item.name.toLowerCase().includes('vocal') || item.rec);
  const activeTrack = track || vocalTracks[0] || tracks[0] || null;
  const activeTrackIndex = activeTrack ? Math.max(0, tracks.findIndex((item) => item.id === activeTrack.id)) : 0;
  const activeLevel = Math.min(1, Math.max(levels[activeTrackIndex] || 0, isRecording ? 0.56 : 0));
  const takeClips = activeTrack ? clips.filter((clip) => clip.trackId === activeTrack.id).sort((a, b) => a.start - b.start) : [];
  const selectedTake = takeClips.find((clip) => clip.id === selectedClipId) || [...takeClips].reverse().find((clip) => clip.audioUrl) || takeClips[0] || null;
  const savedTakeCount = takeClips.filter((clip) => clip.audioUrl && !clip.audioUrl.startsWith('blob:')).length;
  const lyricsLines = lyrics ? lyrics.split('\n').filter(Boolean) : ['Verso listo para grabar', 'Respira antes de entrar', 'Mantén el hook al frente', 'Doble al final del compás'];
  const levelSeed = isRecording ? Date.now() % 9999 : settings.inputGain + takeClips.length * 13;
  const pitchOffset = Math.round(((settings.inputGain + takeClips.length * 9) % 25) - 12);
  const enabledChain = plugins.filter((plugin) => plugin.enabled);
  const inputPercent = Math.min(100, Math.max(8, Math.round((activeLevel * 100) || settings.inputGain)));

  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3 flex flex-col min-h-[330px] overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <Mic2 className="w-3 h-3 text-orange-400" /> Vocal Booth
          </div>
          <div className="text-sm font-bold text-white truncate">{projectName} · {activeTrack?.name || 'Selecciona pista vocal'}</div>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <select
            value={activeTrack?.id || ''}
            onChange={(event) => onTrackSelect(event.target.value)}
            className="min-w-0 w-36 h-8 rounded bg-black/40 border border-white/10 text-[10px] text-zinc-200 px-2 outline-none focus:border-orange-500/60"
          >
            {tracks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {activeTrack && (
            <button
              onClick={() => onArmTrack(activeTrack.id)}
              className={`h-8 px-2 rounded text-[9px] font-bold border ${activeTrack.rec ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'}`}
              title="Armar pista para grabar"
            >
              REC
            </button>
          )}
          <button onClick={onSaveSession} className="h-8 w-8 rounded bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center" title="Guardar sesión vocal">
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.82fr_0.98fr] gap-2 flex-1 min-h-0 pt-2">
        <div className="rounded-lg bg-black/25 border border-white/5 p-2 flex flex-col min-h-[250px]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <CircleDot className={`w-3.5 h-3.5 ${isRecording ? 'text-rose-500 fill-rose-500 animate-pulse' : activeTrack?.rec ? 'text-rose-400' : 'text-zinc-600'}`} />
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-white truncate">{isRecording ? 'GRABANDO TOMA' : activeTrack?.rec ? 'PISTA ARMADA' : 'STAND BY'}</div>
                <div className="text-[8px] text-zinc-500 truncate">{bpm} BPM · {keyName} · {takeClips.length} takes</div>
              </div>
            </div>
            <div className={`font-mono text-[11px] ${isRecording ? 'text-rose-300 animate-pulse' : 'text-zinc-400'}`}>{formatTime(recordingTime)}</div>
          </div>

          <div className="h-20 rounded bg-black/40 border border-white/5 p-1.5 flex items-center gap-px overflow-hidden">
            {waveBars(levelSeed, 104).map((bar, index) => (
              <div
                key={index}
                className={`flex-1 rounded-sm ${isRecording ? 'bg-rose-500' : selectedTake ? 'bg-orange-400/70' : 'bg-zinc-700'}`}
                style={{ height: `${Math.max(6, bar * (isRecording ? 92 : 72))}%`, opacity: isRecording ? 0.95 : 0.45 + bar * 0.45 }}
              />
            ))}
          </div>

          <div className="grid grid-cols-[1fr_54px] gap-2 mt-2">
            <div className="rounded bg-black/30 border border-white/5 p-2">
              <div className="flex items-center justify-between text-[8px] text-zinc-400 mb-1">
                <span>Input</span><span className="font-mono text-zinc-200">{inputPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className={`h-full ${inputPercent > 86 ? 'bg-rose-500' : inputPercent > 58 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${inputPercent}%` }} />
              </div>
              <input type="range" min={0} max={100} value={settings.inputGain} onChange={(e) => onSettingsChange({ inputGain: Number(e.target.value) })} className="w-full h-1 accent-orange-500 mt-2" />
            </div>
            <div className="rounded bg-black/30 border border-white/5 p-2 text-center">
              <div className="text-[8px] text-zinc-500 uppercase tracking-wider">Pitch</div>
              <div className={`text-sm font-mono font-bold ${Math.abs(pitchOffset) < 5 ? 'text-emerald-300' : 'text-orange-300'}`}>{pitchOffset > 0 ? '+' : ''}{pitchOffset}</div>
              <div className="text-[7px] text-zinc-500">cents</div>
            </div>
          </div>

          {recordedUrl && (
            <audio controls src={recordedUrl} className="w-full mt-2 h-8 [&::-webkit-media-controls]:rounded-lg" />
          )}

          <div className="grid grid-cols-4 gap-1.5 mt-2">
            <button onClick={() => { onSettingsChange({ metronome: !settings.metronome }); onTool('metronome'); }} className={`h-10 rounded flex flex-col items-center justify-center gap-0.5 ${settings.metronome ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`} title="Click de tempo">
              <Music className="w-4 h-4" /><span className="text-[8px] font-bold">Click</span>
            </button>
            <button onClick={() => { onSettingsChange({ tuning: !settings.tuning }); onTool('tuning'); }} className={`h-10 rounded flex flex-col items-center justify-center gap-0.5 ${settings.tuning ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`} title="Afinación automática">
              <Wand2 className="w-4 h-4" /><span className="text-[8px] font-bold">Tune</span>
            </button>
            <button onClick={() => { onSettingsChange({ noise: !settings.noise }); onTool('noise'); }} className={`h-10 rounded flex flex-col items-center justify-center gap-0.5 ${settings.noise ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`} title="Reducción de ruido">
              <Activity className="w-4 h-4" /><span className="text-[8px] font-bold">Clean</span>
            </button>
            <button onClick={() => { onSettingsChange({ monitoring: !settings.monitoring }); onTool('monitoring'); }} className={`h-10 rounded flex flex-col items-center justify-center gap-0.5 ${settings.monitoring ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`} title="Monitoreo">
              <Headphones className="w-4 h-4" /><span className="text-[8px] font-bold">Mon</span>
            </button>
          </div>

          {isRecording ? (
            <button onClick={onStopRecording} className="mt-2 h-10 rounded bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center gap-2 text-[11px] font-bold">
              <Square className="w-4 h-4" /> PARAR Y GUARDAR TOMA
            </button>
          ) : (
            <button onClick={() => onStartRecording(activeTrack?.id)} className="mt-2 h-10 rounded bg-rose-500/90 hover:bg-rose-500 text-white flex items-center justify-center gap-2 text-[11px] font-bold">
              <CircleDot className="w-4 h-4" /> GRABAR EN PISTA SELECCIONADA
            </button>
          )}
        </div>

        <div className="rounded-lg bg-black/25 border border-white/5 p-2 flex flex-col min-h-[250px]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><AlignLeft className="w-3 h-3" /> Lyrics & Cue</div>
            <button onClick={onShowLyrics} className="h-7 w-7 rounded bg-white/5 hover:bg-white/10 text-orange-300 flex items-center justify-center" title="Editar letras"><Pencil className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
            {lyricsLines.map((line, index) => (
              <button
                key={`${line}-${index}`}
                onClick={() => onTool('cue-line')}
                className={`w-full text-left rounded px-2 py-1.5 text-[11px] leading-snug ${index === 2 ? 'bg-orange-500/10 text-orange-200 border border-orange-500/20' : 'bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'}`}
              >
                <span className="text-[8px] text-zinc-500 mr-2 font-mono">{String(index + 1).padStart(2, '0')}</span>{line}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-white/5">
            <button onClick={() => { onSettingsChange({ takeMode: settings.takeMode === 'smart' ? 'manual' : 'smart' }); onTool('smart-take'); }} className={`h-8 rounded text-[9px] font-bold ${settings.takeMode === 'smart' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 'bg-white/5 hover:bg-white/10 text-zinc-300'}`}>Smart Take</button>
            <button onClick={() => onTool('harmonies')} className="h-8 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/20 text-[9px] font-bold">Harmonies</button>
            <button onClick={() => onTool('vocal-doubler')} className="h-8 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-[9px] font-bold">Doubler</button>
          </div>
        </div>

        <div className="rounded-lg bg-black/25 border border-white/5 p-2 flex flex-col min-h-[250px]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><FileAudio className="w-3 h-3" /> Takes</div>
            <span className="text-[8px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">{savedTakeCount} DB</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
            {takeClips.length === 0 && (
              <div className="h-full min-h-[140px] rounded border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-center px-4">
                <Mic2 className="w-6 h-6 text-zinc-600 mb-2" />
                <div className="text-[11px] font-bold text-zinc-300">Sin tomas todavía</div>
                <div className="text-[9px] text-zinc-500 mt-1">Arma una pista vocal y graba para crear clips en el timeline.</div>
              </div>
            )}
            {takeClips.map((clip, index) => {
              const selected = clip.id === selectedTake?.id;
              const permanent = !!clip.audioUrl && !clip.audioUrl.startsWith('blob:');
              return (
                <div key={clip.id} className={`rounded border p-1.5 ${selected ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/[0.03] border-white/5'}`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button onClick={() => onTakeSelect(clip.id)} className="min-w-0 flex-1 text-left">
                      <div className="text-[10px] font-bold text-white truncate">{index + 1}. {clip.name}</div>
                      <div className="text-[8px] text-zinc-500 font-mono">bar {clip.start.toFixed(1)} · {clip.width.toFixed(1)}% · {permanent ? 'guardada' : clip.audioUrl ? 'local' : 'clip'}</div>
                    </button>
                    <button onClick={() => onTakeMute(clip.id)} className={`w-6 h-6 rounded flex items-center justify-center ${clip.muted ? 'bg-rose-500/15 text-rose-300' : 'bg-white/5 text-zinc-400 hover:text-zinc-200'}`} title={clip.muted ? 'Activar toma' : 'Silenciar toma'}>{clip.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}</button>
                    <button onClick={() => onTakeRename(clip.id)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-zinc-400 flex items-center justify-center" title="Renombrar toma"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => onTakeDuplicate(clip.id)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-zinc-400 flex items-center justify-center" title="Duplicar toma"><Copy className="w-3 h-3" /></button>
                    <button onClick={() => onTakeDelete(clip.id)} className="w-6 h-6 rounded bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-zinc-400 flex items-center justify-center" title="Borrar toma"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  <div className="h-5 mt-1 flex items-center gap-px bg-black/30 rounded p-0.5 overflow-hidden">
                    {waveBars(clip.name.length + Math.round(clip.start * 10), 48).map((bar, barIndex) => (
                      <div key={barIndex} className={`flex-1 rounded-sm ${clip.muted ? 'bg-zinc-700/60' : 'bg-orange-400/70'}`} style={{ height: `${Math.max(8, bar * 92)}%` }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-2 gap-1.5">
            <button onClick={() => onTool('vocal-chain')} className="h-8 rounded bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-300 text-[9px] font-bold">Vocal Chain</button>
            <button onClick={() => onTool('comp-best')} className="h-8 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-[9px] font-bold">Comp Best</button>
          </div>
          <div className="mt-2 rounded bg-black/30 border border-white/5 p-2">
            <div className="flex items-center justify-between text-[8px] text-zinc-400 uppercase tracking-wider mb-1"><span>Cadena activa</span><span>{enabledChain.length}/{plugins.length}</span></div>
            <div className="flex flex-wrap gap-1">
              {(enabledChain.length ? enabledChain : plugins.slice(0, 3)).map((plugin) => (
                <span key={plugin.id} className={`px-1.5 py-0.5 rounded text-[8px] border ${plugin.enabled ? 'bg-orange-500/10 text-orange-300 border-orange-500/20' : 'bg-white/5 text-zinc-500 border-white/5'}`}>{plugin.name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Knob({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  const v = typeof value === 'string' ? parseFloat(value) : value;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 relative">
        <div
          className="absolute top-1/2 left-1/2 w-[2px] h-3 bg-orange-400 origin-bottom"
          style={{ transform: `translate(-50%, -100%) rotate(${(v || 0) * 0.3 - 45}deg)` }}
        />
      </div>
      <div className="text-[8px] text-zinc-300 font-mono">{value}{unit ? ` ${unit}` : ''}</div>
      <div className="text-[7px] text-zinc-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function LegacyPluginCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className={`bg-black/30 border rounded p-1.5 ${enabled ? 'border-white/5' : 'border-white/[0.02] opacity-50'}`}>
      <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
        <span>{title}</span>
        <button onClick={() => setEnabled((value) => !value)} className="hover:scale-110 transition-transform">
          <Power className={`w-2.5 h-2.5 ${enabled ? 'text-emerald-400' : 'text-zinc-600'}`} />
        </button>
      </div>
      {children}
    </div>
  );
}

function LegacyPluginRack() {
  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3 flex flex-col">
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
        Plugin Rack — <span className="text-orange-400">Vocal Principal</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1.5">
        <LegacyPluginCard title="EQ">
          <div className="h-12 bg-black/40 rounded relative overflow-hidden">
            <svg viewBox="0 0 80 30" className="absolute inset-0 w-full h-full">
              <path d="M0 20 Q15 10 30 18 T60 12 L80 16" stroke="#f97316" strokeWidth="1.5" fill="none" />
              <path d="M0 20 Q15 10 30 18 T60 12 L80 16 L80 30 L0 30 Z" fill="#f9731620" />
            </svg>
          </div>
          <div className="flex justify-around mt-1 text-[7px] text-zinc-500">
            <span>LOW</span><span>MID</span><span>HIGH</span>
          </div>
          <div className="flex justify-around text-[7px] text-zinc-400 font-mono">
            <span>80Hz</span><span>2.5k</span><span>10k</span>
          </div>
        </LegacyPluginCard>

        <LegacyPluginCard title="Compressor">
          <div className="space-y-0.5 text-[8px]">
            <div className="flex justify-between text-zinc-300"><span>Threshold</span><span className="font-mono text-orange-400">-16.2 dB</span></div>
            <div className="flex justify-between text-zinc-300"><span>Ratio</span><span className="font-mono">3.2:1</span></div>
            <div className="flex justify-between text-zinc-300"><span>Attack</span><span className="font-mono">10 ms</span></div>
            <div className="flex justify-between text-zinc-300"><span>Release</span><span className="font-mono">120 ms</span></div>
            <div className="flex justify-between text-zinc-300"><span>Makeup</span><span className="font-mono">2.1 dB</span></div>
          </div>
        </LegacyPluginCard>

        <LegacyPluginCard title="Reverb">
          <div className="text-[8px] mb-1 px-1 py-0.5 bg-white/5 rounded text-center text-zinc-300">Plate ▾</div>
          <div className="flex justify-around"><Knob label="Size" value="65" unit="%" /><Knob label="Decay" value="2.4" unit="s" /><Knob label="Mix" value="28" unit="%" /></div>
        </LegacyPluginCard>

        <LegacyPluginCard title="Delay">
          <div className="text-[8px] mb-1 px-1 py-0.5 bg-white/5 rounded text-center text-zinc-300">1/4 ▾</div>
          <div className="flex justify-around"><Knob label="Feedback" value="35" unit="%" /><Knob label="Mix" value="22" unit="%" /></div>
        </LegacyPluginCard>

        <LegacyPluginCard title="Pitch Correction">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[8px] text-zinc-400">Key</span>
            <div className="text-[8px] px-1 bg-white/5 rounded text-zinc-300">A ▾</div>
            <div className="text-[8px] px-1 bg-white/5 rounded text-zinc-300">Minor ▾</div>
          </div>
          <div className="text-[8px] text-zinc-400">Strength <span className="text-orange-400 font-mono float-right">65%</span></div>
          <div className="h-1 mt-0.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-orange-500 w-[65%]" /></div>
          <div className="h-5 mt-1 flex items-end gap-px">
            {[3, 5, 4, 7, 6, 8, 5, 9, 7, 6, 8, 5, 4, 7, 9, 6].map((h, i) => (
              <div key={i} className="flex-1 bg-orange-400/60" style={{ height: `${h * 10}%` }} />
            ))}
          </div>
        </LegacyPluginCard>

        <LegacyPluginCard title="Noise Remover">
          <div className="text-[8px] text-zinc-300 flex justify-between">Threshold <span className="font-mono text-orange-400">-40 dB</span></div>
          <div className="text-[8px] text-zinc-300 flex justify-between mt-0.5">Reduction <span className="font-mono text-orange-400">70%</span></div>
          <div className="h-6 mt-1 flex items-end gap-px bg-black/40 rounded p-0.5">
            {waveBars(31, 24).map((b, i) => (
              <div key={i} className="flex-1 bg-emerald-400/60" style={{ height: `${b * 90}%` }} />
            ))}
          </div>
        </LegacyPluginCard>

        <LegacyPluginCard title="Saturation">
          <div className="space-y-0.5 text-[8px]">
            <div className="flex justify-between text-zinc-300"><span>Drive</span><span className="font-mono text-orange-400">15%</span></div>
            <div className="flex justify-between text-zinc-300"><span>Warmth</span><span className="font-mono text-orange-400">40%</span></div>
            <div className="flex justify-between text-zinc-300"><span>Mix</span><span className="font-mono text-orange-400">60%</span></div>
          </div>
          <div className="mt-1 h-6 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded relative">
            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] font-mono text-black font-bold">VU</div>
          </div>
        </LegacyPluginCard>

        <LegacyPluginCard title="Limiter">
          <div className="space-y-0.5 text-[8px]">
            <div className="flex justify-between text-zinc-300"><span>Threshold</span><span className="font-mono text-orange-400">-1.0 dB</span></div>
            <div className="flex justify-between text-zinc-300"><span>Output</span><span className="font-mono">-0.1 dB</span></div>
            <div className="flex justify-between text-zinc-300"><span>Ceiling</span><span className="font-mono">-0.1 dB</span></div>
          </div>
          <div className="mt-1 h-6 flex gap-px items-end">
            {[20, 35, 50, 65, 80, 70, 60, 75].map((h, i) => (
              <div key={i} className="flex-1 bg-orange-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </LegacyPluginCard>
      </div>
    </div>
  );
}

function MixerConsole({ tracks, levels, selectedTrackId, pluginsByTrack, masterChain, onSelectTrack, onUpdateTrack, onToggleTrack, onRenameTrack, onAddTrack, onMasterChange }: {
  tracks: Track[];
  levels: number[];
  selectedTrackId: string | null;
  pluginsByTrack: Record<string, PluginState[]>;
  masterChain: MasterChainState;
  onSelectTrack: (trackId: string) => void;
  onUpdateTrack: (trackId: string, patch: Partial<Track>) => void;
  onToggleTrack: (trackId: string, key: 'mute' | 'solo' | 'rec') => void;
  onRenameTrack: (trackId: string) => void;
  onAddTrack: () => void;
  onMasterChange: (patch: Partial<MasterChainState>) => void;
}) {
  const soloActive = tracks.some((track) => track.solo);
  const masterLevel = Math.min(1, tracks.reduce((sum, track, index) => {
    const audible = !track.mute && (!soloActive || track.solo);
    return sum + (audible ? (levels[index] || 0.08 + (index % 5) * 0.035) * (track.vol / 100) : 0);
  }, 0) / Math.max(1, tracks.length / 2));

  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3 flex flex-col min-h-[180px]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <Sliders className="w-3 h-3 text-orange-400" /> Mix Console
        </div>
        <button onClick={onAddTrack} className="h-6 px-2 rounded bg-white/5 hover:bg-white/10 text-[9px] text-zinc-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Track</button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tracks.map((track, index) => {
          const selected = selectedTrackId === track.id;
          const pluginCount = (pluginsByTrack[track.id] || []).filter((plugin) => plugin.enabled).length;
          const level = track.mute ? 0 : Math.min(1, (levels[index] || 0.08 + (index % 4) * 0.04) * (track.vol / 100));
          const peak = Math.min(100, Math.round(level * 120));
          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
              onDoubleClick={() => onRenameTrack(track.id)}
              className={`w-[86px] shrink-0 rounded-lg border p-2 bg-black/25 ${selected ? 'border-orange-500/60 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]' : 'border-white/5 hover:border-white/15'}`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="w-5 h-5 rounded text-[9px] font-bold text-white flex items-center justify-center" style={{ background: track.color }}>{track.initial}</div>
                <span className="text-[8px] text-emerald-300 font-mono">{pluginCount} FX</span>
              </div>
              <div className="h-7 text-[9px] font-bold text-white leading-tight truncate" title={track.name}>{track.name}</div>
              <div className="h-20 flex items-end gap-1 my-1.5">
                {[1, 0.84].map((scale, meterIndex) => (
                  <div key={meterIndex} className="flex-1 h-full bg-white/5 rounded-sm overflow-hidden flex items-end">
                    <div className={`w-full ${peak > 90 ? 'bg-rose-500' : peak > 70 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ height: `${Math.min(100, peak * scale + (meterIndex ? 6 : 0))}%` }} />
                  </div>
                ))}
              </div>
              <div className="text-[8px] text-zinc-500 flex justify-between"><span>-60</span><span>{Math.round((level * 36) - 36)} dB</span></div>
              <input type="range" min={0} max={100} value={track.vol} onChange={(e) => onUpdateTrack(track.id, { vol: Number(e.target.value) })} className="w-full h-1 mt-1" style={{ accentColor: track.color }} />
              <input type="range" min={-50} max={50} value={track.pan} onChange={(e) => onUpdateTrack(track.id, { pan: Number(e.target.value) })} className="w-full h-1 accent-orange-500 mt-2" />
              <div className="text-[8px] text-zinc-500 text-center mt-0.5">{track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.abs(track.pan)}` : `R${track.pan}`}</div>
              <div className="grid grid-cols-3 gap-0.5 mt-1">
                {(['mute','solo','rec'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={(e) => { e.stopPropagation(); onToggleTrack(track.id, key); }}
                    className={`h-5 rounded text-[8px] font-bold ${key === 'mute' && track.mute ? 'bg-zinc-200 text-zinc-900' : key === 'solo' && track.solo ? 'bg-amber-400 text-zinc-900' : key === 'rec' && track.rec ? 'bg-rose-500 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {key === 'mute' ? 'M' : key === 'solo' ? 'S' : 'R'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="w-[112px] shrink-0 rounded-lg border border-orange-500/25 p-2 bg-orange-500/5">
          <div className="text-[9px] font-bold text-orange-300 uppercase tracking-widest mb-1">Master</div>
          <div className="h-20 flex items-end gap-1 my-2">
            {[0.86, 1].map((scale, index) => (
              <div key={index} className="flex-1 h-full bg-black/40 rounded-sm overflow-hidden flex items-end">
                <div className="w-full bg-gradient-to-t from-emerald-400 via-amber-400 to-rose-500" style={{ height: `${Math.min(100, masterLevel * 100 * scale)}%` }} />
              </div>
            ))}
          </div>
          <div className="text-[8px] text-zinc-300 flex justify-between"><span>LUFS</span><span className="font-mono text-orange-300">{masterChain.targetLufs}</span></div>
          <label className="text-[8px] text-zinc-500 block mt-1">Width</label>
          <input type="range" min={0} max={100} value={masterChain.width} onChange={(e) => onMasterChange({ width: Number(e.target.value) })} className="w-full h-1 accent-orange-500" />
          <label className="text-[8px] text-zinc-500 block mt-1">Glue</label>
          <input type="range" min={0} max={100} value={masterChain.glue} onChange={(e) => onMasterChange({ glue: Number(e.target.value) })} className="w-full h-1 accent-orange-500" />
          <div className="text-[8px] text-zinc-500 mt-1">Ceiling <span className="text-zinc-300 font-mono">{masterChain.limiter} dB</span></div>
        </div>
      </div>
    </div>
  );
}

function PluginCard({ plugin, onToggle, onParamChange }: {
  plugin: PluginState;
  onToggle: () => void;
  onParamChange: (key: string, value: number | string) => void;
}) {
  const param = (key: string, fallback = 0) => Number(plugin.params[key] ?? fallback);
  const slider = (key: string, min: number, max: number, step = 1) => (
    <input type="range" min={min} max={max} step={step} value={param(key)} onChange={(e) => onParamChange(key, Number(e.target.value))} className="w-full h-1 accent-orange-500" />
  );

  return (
    <div className={`bg-black/30 border rounded p-1.5 ${plugin.enabled ? 'border-white/5' : 'border-white/[0.02] opacity-50'}`}>
      <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
        <span>{plugin.name}</span>
        <button onClick={onToggle} className="hover:scale-110 transition-transform"><Power className={`w-2.5 h-2.5 ${plugin.enabled ? 'text-emerald-400' : 'text-zinc-600'}`} /></button>
      </div>
      {plugin.type === 'eq' && (
        <>
          <div className="h-12 bg-black/40 rounded relative overflow-hidden">
            <svg viewBox="0 0 80 30" className="absolute inset-0 w-full h-full">
              <path d={`M0 ${20 - param('low')} Q18 ${16 - param('mid')} 35 ${18 - param('mid')} T80 ${15 - param('high')}`} stroke="#f97316" strokeWidth="1.5" fill="none" />
              <path d={`M0 ${20 - param('low')} Q18 ${16 - param('mid')} 35 ${18 - param('mid')} T80 ${15 - param('high')} L80 30 L0 30 Z`} fill="#f9731620" />
            </svg>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-1 text-[7px] text-zinc-500"><span>LOW</span><span>MID</span><span>HIGH</span></div>
          <div className="grid grid-cols-3 gap-1">{slider('low', -12, 12, 0.5)}{slider('mid', -12, 12, 0.5)}{slider('high', -12, 12, 0.5)}</div>
        </>
      )}
      {plugin.type === 'compressor' && (
        <div className="space-y-0.5 text-[8px]">
          <div className="flex justify-between text-zinc-300"><span>Threshold</span><span className="font-mono text-orange-400">{param('threshold')} dB</span></div>{slider('threshold', -40, 0)}
          <div className="flex justify-between text-zinc-300"><span>Ratio</span><span className="font-mono">{param('ratio', 3).toFixed(1)}:1</span></div>{slider('ratio', 1, 10, 0.1)}
          <div className="flex justify-between text-zinc-300"><span>Makeup</span><span className="font-mono">{param('makeup', 2).toFixed(1)} dB</span></div>{slider('makeup', 0, 12, 0.1)}
        </div>
      )}
      {(plugin.type === 'reverb' || plugin.type === 'delay' || plugin.type === 'saturation') && (
        <div className="space-y-1 text-[8px]">
          {Object.keys(plugin.params).filter((key) => typeof plugin.params[key] === 'number').map((key) => (
            <div key={key}>
              <div className="flex justify-between text-zinc-300"><span className="capitalize">{key}</span><span className="font-mono text-orange-400">{param(key).toFixed(key === 'decay' ? 1 : 0)}</span></div>
              {slider(key, key === 'decay' ? 0.2 : 0, key === 'decay' ? 8 : 100, key === 'decay' ? 0.1 : 1)}
            </div>
          ))}
          <div className="h-6 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded opacity-70" />
        </div>
      )}
      {plugin.type === 'pitch' && (
        <>
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[8px] text-zinc-400">Key</span>
            <div className="text-[8px] px-1 bg-white/5 rounded text-zinc-300">A ▾</div>
            <div className="text-[8px] px-1 bg-white/5 rounded text-zinc-300">Minor ▾</div>
          </div>
          <div className="text-[8px] text-zinc-400">Strength <span className="text-orange-400 font-mono float-right">{param('strength')}%</span></div>
          {slider('strength', 0, 100)}
          <div className="h-5 mt-1 flex items-end gap-px">
            {waveBars(param('strength', 65), 16).map((h, i) => <div key={i} className="flex-1 bg-orange-400/60" style={{ height: `${h * 10}%` }} />)}
          </div>
        </>
      )}
      {plugin.type === 'noise' && (
        <>
          <div className="text-[8px] text-zinc-300 flex justify-between">Threshold <span className="font-mono text-orange-400">{param('threshold')} dB</span></div>{slider('threshold', -80, -10)}
          <div className="text-[8px] text-zinc-300 flex justify-between mt-0.5">Reduction <span className="font-mono text-orange-400">{param('reduction')}%</span></div>{slider('reduction', 0, 100)}
          <div className="h-6 mt-1 flex items-end gap-px bg-black/40 rounded p-0.5">
            {waveBars(param('reduction', 70), 24).map((b, i) => <div key={i} className="flex-1 bg-emerald-400/60" style={{ height: `${b * 90}%` }} />)}
          </div>
        </>
      )}
      {plugin.type === 'limiter' && (
        <div className="space-y-0.5 text-[8px]">
          <div className="flex justify-between text-zinc-300"><span>Threshold</span><span className="font-mono text-orange-400">{param('threshold')} dB</span></div>{slider('threshold', -12, 0, 0.1)}
          <div className="flex justify-between text-zinc-300"><span>Output</span><span className="font-mono">{param('output', -0.1)} dB</span></div>{slider('output', -6, 0, 0.1)}
        </div>
      )}
    </div>
  );
}

function PluginRack({ track, plugins, onTogglePlugin, onParamChange, onAddPlugin }: {
  track: Track | null;
  plugins: PluginState[];
  onTogglePlugin: (pluginId: string) => void;
  onParamChange: (pluginId: string, key: string, value: number | string) => void;
  onAddPlugin: (type: PluginType) => void;
}) {
  const [newPlugin, setNewPlugin] = useState<PluginType>('eq');
  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3 flex flex-col">
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center justify-between gap-2">
        <span>Plugin Rack - <span className="text-orange-400">{track?.name || 'Sin pista'}</span></span>
        <div className="flex items-center gap-1">
          <select value={newPlugin} onChange={(e) => setNewPlugin(e.target.value as PluginType)} className="h-6 rounded bg-white/5 border border-white/10 px-1 text-[9px] text-zinc-200 outline-none">
            {(Object.keys(PLUGIN_LIBRARY) as PluginType[]).map((type) => <option key={type} value={type}>{PLUGIN_LIBRARY[type].name}</option>)}
          </select>
          <button onClick={() => onAddPlugin(newPlugin)} className="h-6 px-2 rounded bg-orange-500/15 hover:bg-orange-500/25 text-[9px] text-orange-300">Add</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1.5">
        {plugins.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} onToggle={() => onTogglePlugin(plugin.id)} onParamChange={(key, value) => onParamChange(plugin.id, key, value)} />
        ))}
        {plugins.length === 0 && <div className="col-span-4 text-xs text-zinc-500 p-3 border border-white/5 rounded-lg">Selecciona una pista para cargar su cadena de plugins.</div>}
      </div>
    </div>
  );
}

function AILabPanel({ tracks, selectedTrackId, selectedClip, projectName, bpm, keyName, settings, lastResult, onSettingsChange, onGenerate, generating, generatedUrl }: {
  tracks: Track[];
  selectedTrackId: string | null;
  selectedClip: Clip | null;
  projectName: string;
  bpm: number;
  keyName: string;
  settings: AILabSessionState;
  lastResult: AILabLastResult | null;
  onSettingsChange: (patch: Partial<AILabSessionState>) => void;
  onGenerate: (request: AILabGenerateRequest) => void;
  generating: string | null;
  generatedUrl: string | null;
}) {
  const [tab, setTab] = useState<'GENERAR'|'INSTRUMENTOS'|'VOCES'|'EFECTOS'|'REMIX'>('GENERAR');
  const activeTargetTrackId = settings.targetTrackId || selectedTrackId || tracks[0]?.id || '';
  const activeTargetTrack = tracks.find((track) => track.id === activeTargetTrackId) || null;

  const TAB_KINDS: Record<string, string[]> = {
    GENERAR: ['beat', 'bassline', 'synth', 'pad', 'vocal', 'hook', 'fx', 'intro', 'outro', 'remix'],
    INSTRUMENTOS: ['beat', 'bassline', 'synth', 'pad'],
    VOCES: ['vocal', 'hook'],
    EFECTOS: ['fx', 'intro', 'outro'],
    REMIX: ['remix', 'bassline', 'synth', 'hook'],
  };

  const visibleItems = AI_LAB_ITEMS.filter((it) => TAB_KINDS[tab]?.includes(it.kind));

  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-orange-400" /> AI Lab
        </div>
        <div className="flex items-center gap-2 text-[8px] text-zinc-500">
          <span className="font-mono text-zinc-300">{bpm} BPM</span>
          <span className="font-mono text-zinc-300">{keyName}</span>
          <Power className="w-3 h-3 text-emerald-400" />
        </div>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5 mb-2">
        <select value={settings.targetMode} onChange={(e) => onSettingsChange({ targetMode: e.target.value as AILabTargetMode })} className="h-7 rounded bg-white/5 border border-white/10 px-2 text-[9px] text-zinc-200 outline-none">
          <option value="auto">Auto</option>
          <option value="selected">Pista activa</option>
          <option value="new">Nueva pista</option>
        </select>
        <select value={activeTargetTrackId} onChange={(e) => onSettingsChange({ targetTrackId: e.target.value, targetMode: 'selected' })} className="h-7 rounded bg-white/5 border border-white/10 px-2 text-[9px] text-zinc-200 outline-none">
          {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
        </select>
        <select value={settings.insertMode} onChange={(e) => onSettingsChange({ insertMode: e.target.value as AILabInsertMode })} className="h-7 rounded bg-white/5 border border-white/10 px-2 text-[9px] text-zinc-200 outline-none">
          <option value="arrangement">Arreglo</option>
          <option value="playhead">Playhead</option>
          <option value="after-selected">Después clip</option>
        </select>
        <button onClick={() => onSettingsChange({ applyMix: !settings.applyMix })} className={`h-7 rounded border text-[9px] font-bold ${settings.applyMix ? 'bg-orange-500/15 border-orange-500/25 text-orange-300' : 'bg-white/5 border-white/10 text-zinc-400'}`}>Mix FX</button>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <input value={settings.prompt} onChange={(e) => onSettingsChange({ prompt: e.target.value })} placeholder={`${projectName} · ${activeTargetTrack?.name || 'AUTO'}`} className="flex-1 h-7 rounded bg-black/30 border border-white/10 px-2 text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600" />
        {lastResult && <span className="shrink-0 text-[8px] px-1.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{lastResult.kind.toUpperCase()}</span>}
        {selectedClip && <span className="hidden sm:inline shrink-0 text-[8px] px-1.5 py-1 rounded bg-white/5 text-zinc-400 border border-white/10 truncate max-w-[96px]">{selectedClip.name}</span>}
      </div>
      <div className="flex gap-2 mb-2 text-[9px] font-bold uppercase tracking-wider overflow-x-auto">
        {(['GENERAR','INSTRUMENTOS','VOCES','EFECTOS','REMIX'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 ${tab === t ? 'text-white border-b-2 border-orange-500 pb-0.5' : 'text-zinc-500 hover:text-zinc-300 pb-0.5'}`}>{t}</button>
        ))}
      </div>
      {generatedUrl && (
        <div className="mb-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
          <AudioLines className="w-3 h-3 text-emerald-400 shrink-0" />
          <audio controls src={generatedUrl} className="flex-1 h-6" />
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5 flex-1">
        {visibleItems.map((it) => {
          const isGen = generating === it.kind;
          return (
            <div key={it.id} className={`bg-gradient-to-br ${it.color} border border-white/5 rounded p-1.5 flex flex-col`}>
              <div className="text-[10px] font-bold text-white">{it.title}</div>
              <div className="text-[8px] text-zinc-300">{it.subtitle}</div>
              <div className="h-7 mt-1 flex items-end gap-px">
                {waveBars(it.id.length * 7, 30).map((b, i) => (
                  <div key={i} className="flex-1 bg-white/40" style={{ height: `${b * 90}%` }} />
                ))}
              </div>
              <button
                onClick={() => onGenerate({ kind: it.kind, targetMode: settings.targetMode, insertMode: settings.insertMode, targetTrackId: activeTargetTrackId || null, applyMix: settings.applyMix, prompt: settings.prompt })}
                disabled={!!generating}
                className="mt-1 text-[9px] py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {isGen ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {isGen ? '...' : 'Generar'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MasterRoom({ peaks, durationLabel }: { peaks?: number[]; durationLabel?: string }) {
  const bars = peaks && peaks.length ? peaks : waveBars(81, 200);
  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3 flex items-center gap-3">
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest shrink-0">Master Room</div>
      <div className="flex-1 leading-tight">
        <div className="text-[9px] text-zinc-400">{peaks && peaks.length ? 'Final Master · forma de onda real' : 'Final Master'}</div>
        <div className="h-8 flex items-end gap-px">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 bg-orange-500" style={{ height: `${Math.max(2, b * 90)}%` }} />
          ))}
        </div>
      </div>
      <div className="text-[10px] font-mono text-zinc-400 ml-2">{durationLabel || '--:--'}</div>
    </div>
  );
}

function Loudness({ meter }: { meter?: { integratedLufs: number; truePeakDb: number } }) {
  const lufs = meter && meter.integratedLufs > -70 ? meter.integratedLufs.toFixed(1) : '—';
  const peak = meter && meter.truePeakDb > -70 ? meter.truePeakDb.toFixed(1) : '—';
  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3 flex items-center gap-4">
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Loudness</div>
      <div className="leading-tight">
        <div className="text-xl font-bold text-orange-400 leading-none">{lufs} <span className="text-xs text-zinc-400">LUFS</span></div>
        <div className="text-[9px] text-zinc-500">INTEGRATED</div>
      </div>
      <div className="leading-tight">
        <div className="text-xl font-bold text-white leading-none">{peak} <span className="text-xs text-zinc-400">dB</span></div>
        <div className="text-[9px] text-zinc-500">TRUE PEAK</div>
      </div>
    </div>
  );
}

function Comparar({ peaks }: { peaks?: number[] }) {
  const after = peaks && peaks.length ? peaks.slice(0, 40) : waveBars(13, 40);
  // "Before" = a flattened/quieter render of the same source for an A/B feel.
  const before = peaks && peaks.length ? peaks.slice(0, 40).map((p) => p * 0.6) : waveBars(11, 40);
  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3 flex flex-col">
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Comparar</div>
      <div className="flex items-center gap-1 text-[9px] text-zinc-400">
        <span>Antes</span>
        <div className="flex-1 h-3 flex items-end gap-px">
          {before.map((b, i) => (
            <div key={i} className="flex-1 bg-zinc-500" style={{ height: `${Math.max(2, b * 90)}%` }} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 text-[9px] text-orange-400 mt-1">
        <ArrowLeftRight className="w-2.5 h-2.5" />
        <div className="flex-1 h-3 flex items-end gap-px">
          {after.map((b, i) => (
            <div key={i} className="flex-1 bg-orange-500" style={{ height: `${Math.max(2, b * 90)}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportarPanel({ formats, onToggleFormat, onExportAll, exporting }: { formats: Array<{ id: string; label: string; active: boolean }>; onToggleFormat: (id: string) => void; onExportAll: () => void; exporting: boolean }) {
  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3 flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Exportar</div>
        <button onClick={() => formats.filter((f) => f.active).forEach((f) => onToggleFormat(f.id))} className="text-zinc-500 hover:text-white"><Square className="w-2.5 h-2.5" /></button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {formats.map((f) => (
          <button key={f.id} onClick={() => onToggleFormat(f.id)} className={`text-[8px] py-1 px-1.5 rounded text-center font-medium ${f.active ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
            {f.label}
          </button>
        ))}
      </div>
      <button
        onClick={onExportAll}
        disabled={exporting}
        className="mt-1.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
      >
        {exporting && <Loader2 className="w-3 h-3 animate-spin" />}
        Exportar Todo
      </button>
    </div>
  );
}

function ReleaseRoom({ onTile }: { onTile: (id: string) => void }) {
  return (
    <div className="bg-[#101015] border border-white/5 rounded-lg p-3">
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Release Room</div>
      <div className="grid grid-cols-8 gap-1.5">
        {RELEASE_TILES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onTile(t.id)}
              className="flex flex-col items-center gap-1 p-1.5 rounded bg-white/[0.03] hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/30 transition-colors"
            >
              <Icon className="w-4 h-4 text-orange-400" />
              <span className="text-[8px] text-zinc-300 text-center leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   ProjectsPanel — list + load saved projects
============================================================ */

function ProjectsPanel({ projects, loading, contextLabel = 'Mis Proyectos', currentProjectId, onLoad, onNew, onClose }: {
  projects: any[];
  loading: boolean;
  contextLabel?: string;
  currentProjectId?: string | null;
  onLoad: (project: any) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'tracks'>('date');

  const formatRelDate = (val?: string | number) => {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Hace un momento';
    if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)} h`;
    if (diff < 7 * 86_400_000) return `Hace ${Math.floor(diff / 86_400_000)} días`;
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const filtered = projects
    .filter((p: any) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [p.name, p.key, p.bpm, p.status].filter(Boolean).some((v: any) => String(v).toLowerCase().includes(q));
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'tracks') return (b.tracks?.length || 0) - (a.tracks?.length || 0);
      // date: most recent first
      const da = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const db = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return db - da;
    });

  const statusChip = (status?: string) => {
    if (status === 'release-queued') return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25';
    if (status === 'export-queued') return 'bg-blue-500/15 text-blue-400 border border-blue-500/25';
    if (status === 'release') return 'bg-violet-500/15 text-violet-400 border border-violet-500/25';
    return 'bg-white/5 text-zinc-500';
  };

  return (
    <div className="flex-1 bg-[#0e0e12] flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5">
        <div className="h-11 flex items-center gap-2 px-4">
          <FolderOpen className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="text-xs font-bold text-zinc-200 uppercase tracking-widest truncate">{contextLabel}</span>
          <span className="text-[10px] text-zinc-600 ml-1">({filtered.length})</span>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button onClick={onNew} className="h-7 px-3 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />Nueva sesión
            </button>
            <button onClick={onClose} className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {/* Search + sort toolbar */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sesión…"
            className="flex-1 h-7 rounded-md bg-white/5 border border-white/10 px-2.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-orange-500/50"
          />
          <div className="flex items-center gap-1 shrink-0">
            {(['date', 'name', 'tracks'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                className={`h-7 px-2 rounded-md text-[10px] font-bold transition-colors ${sortBy === k ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}
              >
                {k === 'date' ? 'Reciente' : k === 'name' ? 'A-Z' : 'Pistas'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> Cargando sesiones…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600 gap-3">
            <FolderOpen className="w-12 h-12 opacity-20" />
            <p className="text-sm font-medium">{search ? 'Sin resultados' : 'Sin sesiones guardadas'}</p>
            <p className="text-xs text-center max-w-xs">
              {search ? 'Prueba con otro término' : 'Carga una canción del artista o guarda tu primera sesión con Ctrl+S'}
            </p>
            {!search && (
              <button onClick={onNew} className="mt-1 h-8 px-4 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Crear sesión
              </button>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filtered.map((p: any) => {
            const isActive = currentProjectId && String(p.id) === String(currentProjectId);
            const date = formatRelDate(p.updatedAt || p.createdAt);
            return (
              <button
                key={p.id}
                onClick={() => onLoad(p)}
                className={`text-left rounded-xl p-3 transition-all group border ${
                  isActive
                    ? 'bg-orange-500/15 border-orange-500/50 shadow-lg shadow-orange-500/10'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-start gap-2.5 mb-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-orange-500/30' : 'bg-white/5'}`}>
                    <Disc3 className={`w-4.5 h-4.5 ${isActive ? 'text-orange-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold truncate ${isActive ? 'text-orange-300' : 'text-white group-hover:text-zinc-100'}`}>
                      {p.name || 'Sin título'}
                    </div>
                    <div className="text-[9px] text-zinc-500 truncate mt-0.5">
                      {[p.key, p.bpm ? `${p.bpm} BPM` : null].filter(Boolean).join(' · ') || 'Sin tono/BPM'}
                    </div>
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0 mt-1 animate-pulse" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${statusChip(p.status)}`}>
                    {p.status === 'release-queued' ? 'Release' : p.status === 'export-queued' ? 'Export' : p.status === 'release' ? 'Publicado' : 'Borrador'}
                  </span>
                  <div className="flex items-center gap-2 text-[9px] text-zinc-600 ml-auto">
                    <span>{p.tracks?.length || 0} pistas</span>
                    {date && <span>· {date}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   LyricsPanel — generate + edit lyrics inline
============================================================ */

function LyricsPanel({ lyrics, generating, projectName, onClose, onGenerate, onRewrite, onApply }: {
  lyrics: string;
  generating: boolean;
  projectName: string;
  onClose: () => void;
  onGenerate: (opts: { topic: string; genre: string; mood: string; language: string }) => void;
  onRewrite: (instruction: string) => void;
  onApply: (text: string) => void;
}) {
  const [editText, setEditText] = useState(lyrics);
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState('uplifting');
  const [language, setLanguage] = useState('es');
  const [rewriteInstr, setRewriteInstr] = useState('');
  useEffect(() => { setEditText(lyrics); }, [lyrics]);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#13131a] border border-white/10 rounded-xl shadow-2xl w-[90vw] max-w-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 text-white font-bold text-sm"><AlignLeft className="w-4 h-4 text-orange-400" /> Editor de Letras</div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Generator controls */}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider">Género</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="h-7 rounded bg-white/5 border border-white/10 text-xs text-white px-2 outline-none">
                {['pop','reggaeton','trap','cumbia','salsa','rock','balada','urbano','r&b','rap'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider">Estado de ánimo</label>
              <select value={mood} onChange={(e) => setMood(e.target.value)} className="h-7 rounded bg-white/5 border border-white/10 text-xs text-white px-2 outline-none">
                {['uplifting','melancholic','energetic','romantic','aggressive','chill','spiritual','angry','happy','sad'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider">Idioma</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-7 rounded bg-white/5 border border-white/10 text-xs text-white px-2 outline-none">
                <option value="es">Español</option><option value="en">English</option><option value="pt">Português</option>
              </select>
            </div>
            <button
              onClick={() => onGenerate({ topic: projectName, genre, mood, language })}
              disabled={generating}
              className="h-7 px-3 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 ml-auto"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {generating ? 'Generando…' : 'Generar con AI'}
            </button>
          </div>
          {/* Text editor */}
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Escribe o genera letras aquí…&#10;&#10;[Verso 1]&#10;...&#10;&#10;[Coro]&#10;..."
            className="flex-1 min-h-[280px] bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-zinc-200 resize-none outline-none focus:border-orange-500/50 font-mono leading-relaxed"
          />
          {/* Rewrite instructions */}
          <div className="flex gap-2">
            <input
              value={rewriteInstr}
              onChange={(e) => setRewriteInstr(e.target.value)}
              placeholder="Instrucción para reescribir (ej: hazlo más energético)"
              className="flex-1 h-8 bg-white/5 border border-white/10 rounded px-3 text-xs text-white outline-none focus:border-orange-500/50"
            />
            <button
              onClick={() => { if (rewriteInstr.trim()) onRewrite(rewriteInstr); }}
              disabled={generating || !rewriteInstr.trim() || !editText.trim()}
              className="h-8 px-3 rounded bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium flex items-center gap-1 disabled:opacity-40"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Reescribir
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10 shrink-0">
          <button onClick={onClose} className="h-8 px-4 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium">Cancelar</button>
          <button onClick={() => { onApply(editText); onClose(); }} className="h-8 px-4 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold">Aplicar letras</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SettingsPanel — project & audio settings
============================================================ */

function SettingsPanel({ bpm, keyName, projectName, artistName, userTier, onClose }: {
  bpm: number; keyName: string; projectName: string; artistName: string; userTier: string; onClose: () => void;
}) {
  return (
    <div className="flex-1 bg-[#0e0e12] flex flex-col min-w-0 overflow-hidden">
      <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-widest flex items-center gap-2"><Settings2 className="w-4 h-4 text-orange-400" /> Ajustes del Proyecto</span>
        <button onClick={onClose} className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4 space-y-3">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Sesión Actual</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex flex-col gap-0.5"><span className="text-zinc-500">Proyecto</span><span className="text-white font-medium">{projectName}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-zinc-500">Artista</span><span className="text-white font-medium">{artistName || '—'}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-zinc-500">BPM</span><span className="text-orange-400 font-mono font-bold">{bpm}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-zinc-500">Tonalidad</span><span className="text-orange-400 font-mono font-bold">{keyName}</span></div>
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4 space-y-3">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Plan & Cuenta</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-sm font-bold text-white">{(artistName || '?').charAt(0).toUpperCase()}</div>
            <div>
              <div className="text-sm font-bold text-white">{artistName || 'Usuario'}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${userTier === 'premium' ? 'bg-amber-500/20 text-amber-400' : userTier === 'pro' ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-zinc-400'}`}>
                  {userTier ? userTier.toUpperCase() : 'FREE'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Atajos Rápidos</div>
          <div className="space-y-1 text-xs text-zinc-400">
            <div className="flex justify-between"><span>Guardar</span><kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">Ctrl+S</kbd></div>
            <div className="flex justify-between"><span>Play/Pause</span><kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">Space</kbd></div>
            <div className="flex justify-between"><span>Grabar</span><kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">R</kbd></div>
            <div className="flex justify-between"><span>Stop</span><kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">Escape</kbd></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Root component
============================================================ */

// ── Floating Window System ─────────────────────────────────────
interface FloatWin { x: number; y: number; w: number; h: number; minimized: boolean; z: number; }

const FLOAT_WIN_DEFAULTS: Record<string, FloatWin> = {
  tracks:   { x: 0,    y: 0,   w: 230, h: 430, minimized: false, z: 1 },
  timeline: { x: 214,  y: 0,   w: 580, h: 290, minimized: false, z: 2 },
  agents:   { x: 798,  y: 0,   w: 290, h: 290, minimized: false, z: 3 },
  vocal:    { x: 0,    y: 294, w: 300, h: 210, minimized: false, z: 4 },
  plugin:   { x: 304,  y: 294, w: 270, h: 210, minimized: false, z: 5 },
  ai:       { x: 578,  y: 294, w: 350, h: 210, minimized: false, z: 6 },
  mixer:    { x: 0,    y: 508, w: 800, h: 190, minimized: false, z: 7 },
  master:   { x: 0,    y: 702, w: 920, h: 170, minimized: false, z: 8 },
};

const FLOAT_WIN_DEFS = [
  { id: 'tracks',   title: 'Pistas',      Icon: Layers,    color: '#f97316', minW: 160, minH: 150 },
  { id: 'timeline', title: 'Timeline',    Icon: AudioLines, color: '#818cf8', minW: 280, minH: 150 },
  { id: 'agents',   title: 'Agentes AI',  Icon: Workflow,  color: '#22c55e', minW: 200, minH: 150 },
  { id: 'vocal',    title: 'Vocal Booth', Icon: Mic2,      color: '#f97316', minW: 240, minH: 140 },
  { id: 'plugin',   title: 'Plugins',     Icon: Sliders,   color: '#a855f7', minW: 200, minH: 140 },
  { id: 'ai',       title: 'AI Lab',      Icon: Sparkles,  color: '#22c55e', minW: 260, minH: 160 },
  { id: 'mixer',    title: 'Mixer',       Icon: Activity,  color: '#3b82f6', minW: 380, minH: 150 },
  { id: 'master',   title: 'Master / Export', Icon: Gauge, color: '#f59e0b', minW: 300, minH: 140 },
] as const;

function FloatingPanel({
  id, title, Icon, color = '#f97316', config,
  onFocus, onDragStart, onResizeStart, onToggleMinimize,
  children, minW = 160,
}: {
  id: string; title: string; Icon: ComponentType<{ className?: string }>; color?: string;
  config: FloatWin;
  onFocus: (id: string) => void;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  onResizeStart: (e: React.MouseEvent, id: string, edge: string) => void;
  onToggleMinimize: (id: string) => void;
  children: React.ReactNode;
  minW?: number;
}) {
  return (
    <div
      className="absolute rounded-xl border border-white/10 bg-[#0d0d12] shadow-2xl shadow-black/60 flex flex-col"
      style={{ left: config.x, top: config.y, width: config.w, height: config.minimized ? 30 : config.h, zIndex: config.z, minWidth: minW }}
      onMouseDown={() => onFocus(id)}
    >
      {/* Title bar — drag here */}
      <div
        className="flex items-center gap-1.5 px-2 shrink-0 rounded-t-xl cursor-grab active:cursor-grabbing select-none border-b"
        style={{ height: 30, background: `${color}18`, borderColor: `${color}28` }}
        onMouseDown={e => { if (!(e.target as HTMLElement).closest('button')) onDragStart(e, id); }}
      >
        <Icon className="w-3 h-3 shrink-0" style={{ color }} />
        <span className="text-[10px] font-bold uppercase tracking-widest truncate flex-1" style={{ color }}>{title}</span>
        <button
          className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors text-zinc-400"
          onClick={e => { e.stopPropagation(); onToggleMinimize(id); }}
          title={config.minimized ? 'Restaurar' : 'Minimizar'}
        >
          {config.minimized ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* Content */}
      {!config.minimized && (
        <div className="flex-1 min-h-0 overflow-auto relative">
          {children}
          {/* Resize handles — all 4 edges + corners */}
          {/* bottom edge */}
          <div className="absolute bottom-0 left-3 right-3 h-1.5 cursor-s-resize" onMouseDown={e => { e.stopPropagation(); onResizeStart(e, id, 's'); }} />
          {/* right edge */}
          <div className="absolute right-0 top-3 bottom-3 w-1.5 cursor-e-resize" onMouseDown={e => { e.stopPropagation(); onResizeStart(e, id, 'e'); }} />
          {/* left edge */}
          <div className="absolute left-0 top-3 bottom-3 w-1.5 cursor-w-resize" onMouseDown={e => { e.stopPropagation(); onResizeStart(e, id, 'w'); }} />
          {/* top edge (below title bar) is the title bar drag already */}
          {/* bottom-right corner */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end pb-0.5 pr-0.5"
            onMouseDown={e => { e.stopPropagation(); onResizeStart(e, id, 'se'); }}
          >
            <GripVertical className="w-3 h-3 text-zinc-400 rotate-45" />
          </div>
          {/* bottom-left corner */}
          <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize" onMouseDown={e => { e.stopPropagation(); onResizeStart(e, id, 'sw'); }} />
          {/* top-right corner */}
          <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize" onMouseDown={e => { e.stopPropagation(); onResizeStart(e, id, 'ne'); }} />
        </div>
      )}
    </div>
  );
}

export function MiniStudio() {
  const { toast } = useToast();
  const { user, userSubscription } = useAuth();
  const [location, navigate] = useLocation();
  const [tracks, setTracks] = useState<Track[]>(TRACKS);
  const [pluginsByTrack, setPluginsByTrack] = useState<Record<string, PluginState[]>>(() => normalizePluginsForTracks(TRACKS));
  const [vocalSettings, setVocalSettings] = useState<VocalBoothSettings>(DEFAULT_VOCAL_SETTINGS);
  const [masterChain, setMasterChain] = useState<MasterChainState>(DEFAULT_MASTER_CHAIN);
  const [aiLabSettings, setAiLabSettings] = useState<AILabSessionState>(DEFAULT_AI_LAB_SETTINGS);
  const [lastAiResult, setLastAiResult] = useState<AILabLastResult | null>(null);
  const [clips, setClips] = useState<Clip[]>(() => {
    try {
      const saved = localStorage.getItem('ms-clips-v1');
      if (saved) return JSON.parse(saved) as Clip[];
    } catch {}
    return INITIAL_CLIPS;
  });
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>('t1');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [editorTool, setEditorTool] = useState<ClipEditTool>('select');
  const [clipMenu, setClipMenu] = useState<ClipContextMenuState | null>(null);
  const [trackMenu, setTrackMenu] = useState<TrackContextMenuState | null>(null);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [lyrics, setLyrics] = useState('');
  const [lyricsGenerating, setLyricsGenerating] = useState(false);
  const [showLyricsPanel, setShowLyricsPanel] = useState(false);
  const [projectName, setProjectName] = useState(PROJECT.name);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [libraryArtistId, setLibraryArtistId] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>(() => {
    try { return localStorage.getItem('ms-section') || 'studio'; } catch { return 'studio'; }
  });
  const [gridOn, setGridOn] = useState<boolean>(() => {
    try { return localStorage.getItem('ms-grid') !== 'false'; } catch { return true; }
  });
  const [snapOn, setSnapOn] = useState<boolean>(() => {
    try { return localStorage.getItem('ms-snap') !== 'false'; } catch { return true; }
  });
  const [quantize, setQuantize] = useState<string>(() => {
    try { return localStorage.getItem('ms-quantize') || '1/4'; } catch { return '1/4'; }
  });
  const [exportFormats, setExportFormats] = useState(EXPORT_FORMATS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [levels, setLevels] = useState<number[]>(new Array(TRACKS.length).fill(0));
  const [meter, setMeter] = useState<{ integratedLufs: number; truePeakDb: number; momentaryLufs: number }>({ integratedLufs: -70, truePeakDb: -70, momentaryLufs: -70 });
  const [masterPeaks, setMasterPeaks] = useState<number[]>([]);
  const [masterDuration, setMasterDuration] = useState(0);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [bpm, setBpm] = useState(PROJECT.bpm);
  const [keyName, setKeyName] = useState(PROJECT.key);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'timeline'|'vocal'|'mixer'|'ai'|'release'>('timeline');
  const [releasingText, setReleasingText] = useState('');

  // ── Layout / panel resize state ──────────────────────────────
  const [msLeftW, setMsLeftW] = useState<number>(() => {
    try { const v = parseInt(localStorage.getItem('ms-left-w') || ''); return isNaN(v) ? 200 : Math.max(120, Math.min(420, v)); } catch { return 200; }
  });
  const [msRightW, setMsRightW] = useState<number>(() => {
    try { const v = parseInt(localStorage.getItem('ms-right-w') || ''); return isNaN(v) ? 300 : Math.max(0, Math.min(480, v)); } catch { return 300; }
  });
  const [msBottomOpen, setMsBottomOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('ms-bottom') !== 'closed'; } catch { return true; }
  });
  const [msActivePanels, setMsActivePanels] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ms-active-panels') || 'null');
      return new Set(Array.isArray(saved) ? saved : ['vocal', 'plugin', 'ai', 'mixer']);
    } catch { return new Set(['vocal', 'plugin', 'ai', 'mixer']); }
  });
  const msDragRef = useRef<{ side: 'left' | 'right'; startX: number; startW: number } | null>(null);

  // ── Floating window manager ───────────────────────────────────
  const [floatWins, setFloatWins] = useState<Record<string, FloatWin>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ms-float-wins-v1') || 'null');
      if (saved && typeof saved === 'object') return { ...FLOAT_WIN_DEFAULTS, ...saved };
    } catch {}
    return { ...FLOAT_WIN_DEFAULTS };
  });
  const floatZTopRef = useRef(10);
  const studioContainerRef = useRef<HTMLDivElement>(null);
  const floatDragRef = useRef<{
    id: string;
    type: 'move' | 'resize';
    edge: string;
    startX: number; startY: number;
    startVal: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // ── Professional multitrack audio engine ─────────────────────────────
  // Master transport element (the mixed song / primary timeline clock).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);          // master bus (transport volume)
  const masterStripRef = useRef<ChannelStrip | null>(null);     // master source DSP strip (EQ/comp/pan/...)
  const loudnessRef = useRef<LoudnessMeter | null>(null);       // integrated loudness / true-peak meter
  const masterSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const masterConnectedElRef = useRef<HTMLAudioElement | null>(null);
  const masterVolumeRef = useRef(1);
  // When the source is CORS-tainted we cannot route through Web Audio without
  // muting it, so we fall back to direct element playback (sound, but no meters).
  const webAudioBypassRef = useRef(false);
  // Per-track stem layer: trackId → { element, DSP strip, url }.
  const stemPartsRef = useRef<Map<string, { el: HTMLAudioElement; strip: ChannelStrip | null; url: string }>>(new Map());
  const currentMasterUrlRef = useRef<string | undefined>(undefined);
  const animFrameRef = useRef<number>(0);
  const recTimerRef = useRef<number>(0);
  const deepLinkLoadedRef = useRef(false);
  const autoLoadedRef = useRef(false);
  const autosaveTimerRef = useRef<number>(0);

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  // Initialize (or reuse) the shared AudioContext + master bus.
  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const bus = ctx.createGain();           // transport master volume
      bus.gain.value = masterVolumeRef.current;
      const loudness = new LoudnessMeter(ctx);
      bus.connect(analyser);
      analyser.connect(ctx.destination);
      bus.connect(loudness.analyser);          // metering tap (sink, not routed onward)
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      masterGainRef.current = bus;
      loudnessRef.current = loudness;
    }
    return audioCtxRef.current;
  }, []);

  // Route the master <audio> element into the Web Audio graph exactly once,
  // through a full DSP channel strip. A MediaElementSource can only be created a
  // single time per element, so we guard with masterConnectedElRef.
  const connectMaster = useCallback((el: HTMLAudioElement) => {
    if (webAudioBypassRef.current) return;
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') void ctx.resume();
    if (masterConnectedElRef.current === el && masterSourceRef.current) return;
    if (masterConnectedElRef.current && masterConnectedElRef.current !== el) {
      try { masterSourceRef.current?.disconnect(); } catch {}
      masterSourceRef.current = null;
    }
    try {
      const src = ctx.createMediaElementSource(el);
      const strip = new ChannelStrip(ctx, { bpm });
      strip.output.connect(masterGainRef.current!);
      src.connect(strip.input);
      masterSourceRef.current = src;
      masterStripRef.current = strip;
      masterConnectedElRef.current = el;
      el.volume = 1; // gain is handled by the Web Audio master strip + bus
    } catch {
      // Already bound to a source from a prior mount — nothing to reconnect.
    }
  }, [getAudioCtx, bpm]);

  // CORS fallback: if the master fails to load (typically a cross-origin file
  // without CORS headers), retry once in direct-playback mode so the producer
  // still hears audio even though the spectrum meters are unavailable.
  const handleMasterError = useCallback(() => {
    const el = audioRef.current;
    if (!el || webAudioBypassRef.current || !el.src) return;
    if (masterConnectedElRef.current === el) return; // already routed, can't bypass
    webAudioBypassRef.current = true;
    try { el.removeAttribute('crossorigin'); } catch {}
    el.volume = masterVolumeRef.current;
    el.load();
    if (isPlaying) el.play().catch(() => {});
  }, [isPlaying]);

  // Keep every stem aligned to the master transport clock.
  const syncStemsTo = useCallback((time: number, alsoPlay: boolean) => {
    stemPartsRef.current.forEach(({ el }) => {
      try {
        if (Number.isFinite(time) && Math.abs(el.currentTime - time) > 0.12) el.currentTime = time;
        if (alsoPlay) { void el.play().catch(() => {}); } else { el.pause(); }
      } catch {}
    });
  }, []);

  // Playback control
  const handlePlay = useCallback(() => {
    const master = audioRef.current;
    const hasMaster = !!(master && master.src);
    const hasStems = stemPartsRef.current.size > 0;
    if (!hasMaster && !hasStems) {
      toast({ title: 'Sin audio', description: 'Carga una canción o proyecto primero para reproducir.', variant: 'destructive' });
      return;
    }
    const ctx = getAudioCtx();
    const doPlay = async () => {
      if (ctx.state === 'suspended') await ctx.resume();
      if (master) connectMaster(master);
      if (isPlaying) {
        master?.pause();
        syncStemsTo(master?.currentTime ?? 0, false);
        cancelAnimationFrame(animFrameRef.current);
        setIsPlaying(false);
      } else {
        if (master) {
          master.play().catch((err) => {
            console.warn('[mini-studio] play error:', err);
            toast({ title: 'No se pudo reproducir', description: 'El navegador bloqueó la reproducción automática. Haz clic de nuevo.', variant: 'destructive' });
          });
        }
        syncStemsTo(master?.currentTime ?? 0, true);
        setIsPlaying(true);
      }
    };
    void doPlay();
  }, [isPlaying, connectMaster, getAudioCtx, syncStemsTo, toast]);

  const handleStop = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    syncStemsTo(0, false);
    cancelAnimationFrame(animFrameRef.current);
    setIsPlaying(false);
    setIsRecording(false);
    setPlayhead(0);
    setCurrentTime(0);
  }, [syncStemsTo]);

  const handleRewind = useCallback(() => {
    if (audioRef.current) audioRef.current.currentTime = 0;
    syncStemsTo(0, false);
    setPlayhead(0);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [syncStemsTo]);

  const handleForward = useCallback(() => {
    if (audioRef.current && audioRef.current.duration) {
      const next = Math.min(audioRef.current.duration, audioRef.current.currentTime + (audioRef.current.duration * 0.08));
      audioRef.current.currentTime = next;
      syncStemsTo(next, isPlaying);
    } else {
      setPlayhead((p) => Math.min(99, p + 8));
    }
  }, [isPlaying, syncStemsTo]);

  const handleSeek = useCallback((pct: number) => {
    const raw = pct / 100;
    setPlayhead(pct);
    if (audioRef.current && audioRef.current.duration) {
      const t = raw * audioRef.current.duration;
      audioRef.current.currentTime = t;
      syncStemsTo(t, isPlaying);
      setCurrentTime(t);
    }
  }, [isPlaying, syncStemsTo]);

  const handleSeekByFraction = useCallback((frac: number) => {
    handleSeek(frac * 100);
  }, [handleSeek]);

  const handleVolumeChange = useCallback((v: number) => {
    masterVolumeRef.current = v;
    if (masterGainRef.current && !webAudioBypassRef.current) {
      masterGainRef.current.gain.value = v;
    } else if (audioRef.current) {
      audioRef.current.volume = v;
    }
  }, []);

  // Animation frame for playhead + per-channel metering + loudness
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animFrameRef.current);
      setLevels(new Array(tracks.length).fill(0));
      return;
    }
    let loudFrame = 0;
    const tick = () => {
      // Update time from audio element
      if (audioRef.current && audioRef.current.duration) {
        const t = audioRef.current.currentTime;
        setCurrentTime(t);
        setPlayhead((t / audioRef.current.duration) * 100);
      } else {
        setCurrentTime((prev) => prev + 0.1);
        setPlayhead((p) => p >= 99 ? 0 : p + 0.15);
      }
      // Real per-channel levels from each strip's analyser; tracks without their
      // own stem reflect the master strip's level.
      const masterLevel = masterStripRef.current?.getLevel() ?? 0;
      setLevels(tracks.map((t) => {
        const part = stemPartsRef.current.get(t.id);
        if (part?.strip) return part.strip.getLevel();
        return t.audioUrl === currentMasterUrlRef.current ? masterLevel : masterLevel * 0.4;
      }));
      // Integrated loudness / true-peak (throttled to ~6fps)
      loudFrame += 1;
      if (loudnessRef.current && loudFrame % 10 === 0) {
        setMeter(loudnessRef.current.sample());
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, tracks]);

  // Recording engine
  const handleStartRecording = useCallback(async (overrideTrackId?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const mr = new MediaRecorder(stream, { mimeType });
      recordingChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const localUrl = URL.createObjectURL(blob);
        setRecordedUrl(localUrl);
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recTimerRef.current);

        // Add local clip to timeline immediately on the selected/armed track
        const targetTrackId = overrideTrackId || selectedTrackId || tracks.find((track) => track.rec)?.id || 't1';
        const targetTrack = tracks.find((track) => track.id === targetTrackId) || tracks[0];
        const takeName = `${targetTrack?.name || 'Audio'} Take ${new Date().toLocaleTimeString()}`;
        const takeClipId = makeClipId();
        const maxEnd = clips.filter(c => c.trackId === targetTrackId).reduce((mx, c) => Math.max(mx, c.start + c.width), 0);
        const takeClip: Clip = { id: takeClipId, trackId: targetTrackId, name: takeName, start: Math.min(maxEnd, 85), width: 15, audioUrl: localUrl };
        const nextClipsLocal = [...clips, takeClip];
        const nextTracksLocal = tracks.map((track) => track.id === targetTrackId ? { ...track, audioUrl: localUrl, rec: true } : track);
        setClips(nextClipsLocal);
        setTracks(nextTracksLocal);
        setSelectedClipId(takeClipId);

        // Upload to server in background
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const artistId = selectedArtistId;
            const r: any = await apiFetch('/api/mini-studio/upload-recording', {
              method: 'POST',
              body: JSON.stringify({ base64Audio: base64, mimeType, projectId: currentProjectId, artistId, title: takeName }),
            });
            if (r?.audioUrl && r.audioUrl !== localUrl) {
              // Replace blob URL with permanent URL in clips
              const nextClipsPermanent = nextClipsLocal.map(c => c.id === takeClipId ? { ...c, audioUrl: r.audioUrl } : c);
              const nextTracksPermanent = nextTracksLocal.map((track) => track.id === targetTrackId && track.audioUrl === localUrl ? { ...track, audioUrl: r.audioUrl } : track);
              setClips(nextClipsPermanent);
              setTracks(nextTracksPermanent);
              setRecordedUrl(r.audioUrl);
              if (r.songId) setSelectedSongId(r.songId);
              const saved: any = await persistProjectSnapshot({
                ...currentSnapshot(),
                songId: r.songId || selectedSongId,
                tracks: nextTracksPermanent,
                clips: nextClipsPermanent,
                sessionState: {
                  selectedTrackId: targetTrackId,
                  selectedClipId: takeClipId,
                  editorTool,
                  gridOn,
                  snapOn,
                  quantize,
                  vocalSettings,
                  aiLabSettings,
                  generatedUrl,
                  lastAiResult,
                },
              });
              if (saved?.project?.id) setCurrentProjectId(saved.project.id);
            }
            libraryQuery.refetch();
            projectsQuery.refetch();
          };
          reader.readAsDataURL(blob);
        } catch {
          /* upload failed — local URL still works in current session */
        }

        toast({ title: 'Grabación completa', description: 'Toma guardada en timeline y subida al servidor.' });
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingTime(0);
      recTimerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err: any) {
      toast({ title: 'Micrófono no disponible', description: err.message || 'Permite acceso al micrófono.', variant: 'destructive' });
    }
  }, [toast, selectedArtistId, currentProjectId, selectedSongId, selectedTrackId, tracks, clips, editorTool, gridOn, snapOn, quantize, vocalSettings, aiLabSettings, generatedUrl, lastAiResult]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    clearInterval(recTimerRef.current);
    setIsRecording(false);
  }, []);

  const handleRecord = useCallback(() => {
    if (isRecording) handleStopRecording();
    else handleStartRecording();
  }, [isRecording, handleStartRecording, handleStopRecording]);

  // Key cycle
  const handleKeyChange = useCallback(() => {
    setKeyName((current) => {
      const idx = KEYS.indexOf(current);
      return KEYS[(idx + 1) % KEYS.length];
    });
  }, []);

  const projectsQuery = useQuery({
    queryKey: ['mini-studio-projects'],
    queryFn: () => apiFetch<{ success: boolean; projects: any[] }>('/api/mini-studio/projects'),
    staleTime: 60_000,
    retry: false,
  });

  const libraryQuery = useQuery({
    queryKey: ['mini-studio-library'],
    queryFn: () => apiFetch<{ success: boolean; artists: ArtistLibraryArtist[]; songs: ArtistLibrarySong[] }>('/api/mini-studio/library'),
    staleTime: 30_000,
    retry: false,
  });

  const artists = libraryQuery.data?.artists || [];
  const allSongs = libraryQuery.data?.songs || [];
  const projects = projectsQuery.data?.projects || [];
  const findArtistById = (id: string | null) => artists.find((artist) => artist.id === id || artist.firestoreId === id || String(artist.pgId || '') === String(id || '')) || null;
  const projectArtist = findArtistById(selectedArtistId);
  const libraryArtist = findArtistById(libraryArtistId) || projectArtist || artists[0] || null;
  const selectedArtist = projectArtist || libraryArtist;
  const selectedSong = allSongs.find((song) => song.id === selectedSongId) || selectedArtist?.songs?.find((song) => song.id === selectedSongId) || null;
  const libraryArtistSongs = libraryArtist?.songs || [];
  const libraryArtistIds = new Set([libraryArtist?.id, libraryArtist?.firestoreId, libraryArtist?.pgId && String(libraryArtist.pgId)].filter(Boolean).map(String));
  const libraryArtistSongIds = new Set(libraryArtistSongs.map((song) => String(song.id)));
  const libraryArtistProjects = projects.filter((project: any) => libraryArtistIds.has(String(project.artistId || '')) || libraryArtistSongIds.has(String(project.songId || '')));
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) || tracks[0] || null;
  const selectedClip = selectedClipId ? clips.find((clip) => clip.id === selectedClipId) || null : null;
  const selectedTrackPlugins = selectedTrack ? (pluginsByTrack[selectedTrack.id] || []) : [];
  const trackIdsKey = tracks.map((track) => track.id).join('|');

  useEffect(() => {
    setPluginsByTrack((current) => normalizePluginsForTracks(tracks, current));
  }, [trackIdsKey]);

  useEffect(() => {
    if (!libraryArtistId && artists[0]?.id) setLibraryArtistId(projectArtist?.id || artists[0].id);
    if (!selectedArtistId && !currentProjectId && artists[0]?.id) setSelectedArtistId(projectArtist?.id || libraryArtist?.id || artists[0].id);
  }, [artists, currentProjectId, libraryArtist?.id, libraryArtistId, projectArtist?.id, selectedArtistId]);

  const currentSnapshot = () => ({
    name: projectName,
    bpm,
    key: keyName,
    artistId: selectedArtistId || selectedArtist?.id,
    songId: selectedSong?.id || selectedSongId,
    tracks,
    clips: clips,
    plugins: pluginsByTrack,
    masterChain,
    lyrics,
    sessionState: { selectedTrackId, selectedClipId, editorTool, gridOn, snapOn, quantize, vocalSettings, aiLabSettings, generatedUrl, lastAiResult },
  });

  const persistProjectSnapshot = async (snapshot = currentSnapshot(), projectIdOverride: string | null = currentProjectId) => {
    let songId = snapshot.songId;
    const artistId = snapshot.artistId;
    if (!songId && artistId) {
      const createdSong: any = await apiFetch('/api/mini-studio/songs', {
        method: 'POST',
        body: JSON.stringify({ artistId, title: snapshot.name, name: snapshot.name, genre: selectedArtist?.genre || 'Studio', source: 'mini-studio-project' }),
      });
      songId = createdSong?.song?.id || null;
      setSelectedSongId(songId);
    }
    const finalSnapshot = { ...snapshot, songId };
    const existingProject = projectIdOverride ? projects.find((project: any) => project.id === projectIdOverride) : null;
    const sameSongProject = !existingProject?.songId || !songId || String(existingProject.songId) === String(songId);
    const sameArtistProject = !existingProject?.artistId || !artistId || String(existingProject.artistId) === String(artistId);
    const projectIdForWrite = existingProject && (!sameSongProject || !sameArtistProject) ? null : projectIdOverride;
    return apiFetch(projectIdForWrite ? `/api/mini-studio/projects/${projectIdForWrite}` : '/api/mini-studio/projects', {
      method: projectIdForWrite ? 'PUT' : 'POST',
      body: JSON.stringify(finalSnapshot),
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => persistProjectSnapshot(),
    onSuccess: (res: any) => {
      if (res?.project?.id) {
        setCurrentProjectId(res.project.id);
        try { localStorage.setItem('ms-last-project-id', String(res.project.id)); } catch {}
      }
      projectsQuery.refetch();
      libraryQuery.refetch();
      toast({ title: 'Proyecto guardado', description: `${res?.project?.name || projectName} sincronizado.` });
    },
    onError: (e: any) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
  });

  useEffect(() => {
    if (!currentProjectId) return;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      persistProjectSnapshot().catch((err) => console.warn('[mini-studio] autosave failed:', err?.message || err));
    }, 1400);
    return () => clearTimeout(autosaveTimerRef.current);
  }, [tracks, clips, pluginsByTrack, masterChain, vocalSettings, aiLabSettings, generatedUrl, lastAiResult, lyrics, bpm, keyName, projectName, selectedTrackId, selectedClipId, editorTool, gridOn, snapOn, quantize, currentProjectId]);

  // Persist layout preferences
  useEffect(() => { try { localStorage.setItem('ms-grid', String(gridOn)); } catch {} }, [gridOn]);
  useEffect(() => { try { localStorage.setItem('ms-snap', String(snapOn)); } catch {} }, [snapOn]);
  useEffect(() => { try { localStorage.setItem('ms-quantize', quantize); } catch {} }, [quantize]);

  // Persist clips to localStorage so session survives reloads
  useEffect(() => {
    try { localStorage.setItem('ms-clips-v1', JSON.stringify(clips)); } catch {}
  }, [clips]);

  // Drag-to-resize panel widths (left tracks panel, right agents panel) — for non-studio sections
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!msDragRef.current) return;
      const delta = e.clientX - msDragRef.current.startX;
      if (msDragRef.current.side === 'left') {
        const next = Math.max(120, Math.min(420, msDragRef.current.startW + delta));
        setMsLeftW(next);
        try { localStorage.setItem('ms-left-w', String(next)); } catch {}
      } else {
        const next = Math.max(0, Math.min(480, msDragRef.current.startW - delta));
        setMsRightW(next);
        try { localStorage.setItem('ms-right-w', String(next)); } catch {}
      }
    };
    const onUp = () => { msDragRef.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Snap position to a 10-px grid to keep modules aligned
  const snapGrid = (v: number, grid = 10) => Math.round(v / grid) * grid;

  // Global floating window drag + resize handler
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const fd = floatDragRef.current;
      if (!fd) return;
      const dx = e.clientX - fd.startX;
      const dy = e.clientY - fd.startY;
      const { x, y, w, h } = fd.startVal;
      const win = floatWins[fd.id];
      if (!win) return;
      const minW = FLOAT_WIN_DEFS.find(d => d.id === fd.id)?.minW ?? 160;
      const minH = FLOAT_WIN_DEFS.find(d => d.id === fd.id)?.minH ?? 100;
      if (fd.type === 'move') {
        // Snap to 10-px grid so modules stay aligned
        const nx = snapGrid(Math.max(0, x + dx));
        const ny = snapGrid(Math.max(0, y + dy));
        setFloatWins(prev => ({ ...prev, [fd.id]: { ...prev[fd.id], x: nx, y: ny } }));
      } else {
        const edge = fd.edge;
        let nx = x, ny = y, nw = w, nh = h;
        if (edge.includes('e')) nw = Math.max(minW, snapGrid(w + dx));
        if (edge.includes('s')) nh = Math.max(minH, snapGrid(h + dy));
        if (edge.includes('w')) { nw = Math.max(minW, snapGrid(w - dx)); nx = x + (w - nw); }
        if (edge.includes('n')) { nh = Math.max(minH, snapGrid(h - dy)); ny = y + (h - nh); }
        setFloatWins(prev => ({ ...prev, [fd.id]: { ...prev[fd.id], x: nx, y: ny, w: nw, h: nh } }));
      }
    };
    const onUp = () => {
      if (floatDragRef.current) {
        document.body.style.cursor = '';
        // Persist on mouseup (not on every move — too many writes)
        setFloatWins(prev => {
          try { localStorage.setItem('ms-float-wins-v1', JSON.stringify(prev)); } catch {}
          return prev;
        });
        floatDragRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [floatWins]);

  // Auto-load the most recent project when the component mounts and no project is active
  useEffect(() => {
    if (projectsQuery.isLoading || projectsQuery.isError) return;
    if (autoLoadedRef.current || currentProjectId || deepLinkLoadedRef.current) return;
    const pList: any[] = projectsQuery.data?.projects || [];
    if (!pList.length) return;
    autoLoadedRef.current = true;
    const savedId = (() => { try { return localStorage.getItem('ms-last-project-id'); } catch { return null; } })();
    const target = (savedId ? pList.find((p: any) => String(p.id) === savedId) : null) || pList[0];
    if (target) handleLoadProject(target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsQuery.isLoading, projectsQuery.isError, projectsQuery.data, currentProjectId]);

  // Save state before the user navigates away
  useEffect(() => {
    const onBeforeUnload = () => { if (currentProjectId) persistProjectSnapshot().catch(() => {}); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  const createSongMut = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/mini-studio/songs', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (res: any) => {
      setSelectedSongId(res?.song?.id || null);
      libraryQuery.refetch();
      toast({ title: 'Canción guardada', description: `${res?.song?.title || 'Nueva canción'} en la base de datos del artista.` });
    },
    onError: (e: any) => toast({ title: 'No se pudo guardar canción', description: e.message, variant: 'destructive' }),
  });

  const releaseMut = useMutation({
    mutationFn: async () => {
      const created: any = await apiFetch(currentProjectId ? `/api/mini-studio/projects/${currentProjectId}` : '/api/mini-studio/projects', {
        method: currentProjectId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...currentSnapshot(), status: 'release' }),
      });
      const projectId = created?.project?.id || currentProjectId;
      if (!projectId) throw new Error('No project id returned');
      setCurrentProjectId(projectId);
      return apiFetch('/api/mini-studio/release', {
        method: 'POST',
        body: JSON.stringify({ projectId, songId: selectedSong?.id || selectedSongId, channels: ['distrokid', 'spotify-for-artists'] }),
      });
    },
    onSuccess: () => {
      libraryQuery.refetch();
      toast({ title: 'Release encolado', description: 'Canción y proyecto marcados para distribución.' });
    },
    onError: (e: any) => toast({ title: 'Release falló', description: e.message, variant: 'destructive' }),
  });

  const applyAiGenerationToSession = async (kind: AILabKind, result: any, options: Partial<AILabSessionState> = {}) => {
    const audioUrl = result?.audioUrl;
    if (!audioUrl) return null;

    const config = AI_KIND_CONFIG[kind] || AI_KIND_CONFIG.beat;
    const targetMode = options.targetMode || aiLabSettings.targetMode;
    const insertMode = options.insertMode || aiLabSettings.insertMode;
    const applyMix = options.applyMix ?? aiLabSettings.applyMix;
    const requestedTrackId = options.targetTrackId || aiLabSettings.targetTrackId || selectedTrackId || tracks[0]?.id || config.trackId;
    const shouldUseSelected = targetMode === 'selected' || (targetMode === 'auto' && kind === 'remix');
    let targetTrackId = shouldUseSelected ? requestedTrackId : config.trackId;
    const shouldCreateTrack = targetMode === 'new' || !tracks.some((track) => track.id === targetTrackId);
    if (shouldCreateTrack) targetTrackId = `ai-${kind}-${Date.now()}`;

    const existingTarget = tracks.find((track) => track.id === targetTrackId);
    const targetTrack: Track = existingTarget || {
      id: targetTrackId,
      name: config.name,
      type: config.type,
      color: config.color,
      initial: config.initial,
      iconBg: config.iconBg,
      vol: config.vol,
      pan: config.pan,
      mute: false,
      solo: false,
      rec: kind === 'vocal' || kind === 'hook',
      audioUrl,
    };

    const width = Math.min(96, Math.max(4, config.width));
    const trackClips = clips.filter((clip) => clip.trackId === targetTrackId);
    const maxEnd = trackClips.reduce((max, clip) => Math.max(max, clip.start + clip.width), 0);
    const selectedClipEnd = selectedClip ? selectedClip.start + selectedClip.width : null;
    const rawStart = insertMode === 'playhead'
      ? playhead
      : insertMode === 'after-selected' && selectedClipEnd !== null
        ? selectedClipEnd
        : kind === 'intro'
          ? 0
          : kind === 'outro'
            ? Math.max(maxEnd, 100 - width)
            : kind === 'fx'
              ? playhead
              : maxEnd;
    const start = Math.min(100 - width, Math.max(0, snapTimelinePct(rawStart, snapOn, quantize)));
    const generatedClipId = makeClipId();
    const generatedClip: Clip = {
      id: generatedClipId,
      trackId: targetTrackId,
      name: `${config.name.replace(/ AI$/, '')} ${result?.provider ? result.provider.toUpperCase() : 'AI'}`,
      start,
      width,
      audioUrl,
      gain: 1,
      sourceSongId: selectedSong?.id || selectedSongId || currentProjectId || undefined,
    };

    const nextTracks = shouldCreateTrack
      ? [...tracks, targetTrack]
      : tracks.map((track) => track.id === targetTrackId ? {
          ...track,
          audioUrl,
          mute: false,
          vol: applyMix ? config.vol : track.vol,
          pan: applyMix ? config.pan : track.pan,
          rec: kind === 'vocal' || kind === 'hook' ? true : track.rec,
        } : track);
    const nextClips = [...clips, generatedClip];
    const nextPlugins = normalizePluginsForTracks(nextTracks, pluginsByTrack);
    if (applyMix) nextPlugins[targetTrackId] = applyAiPluginPresetToChain(nextPlugins[targetTrackId] || [], kind, targetTrack);
    const nextMasterChain = applyMix ? { ...masterChain, ...(AI_MASTER_PRESETS[kind] || {}) } : masterChain;
    const nextVocalSettings = applyMix && (kind === 'vocal' || kind === 'hook') ? { ...vocalSettings, tuning: true, noise: true } : vocalSettings;
    const nextAiLabSettings: AILabSessionState = {
      ...aiLabSettings,
      ...options,
      targetTrackId,
      prompt: options.prompt ?? aiLabSettings.prompt,
    };
    const nextLastResult: AILabLastResult = { kind, trackId: targetTrackId, clipId: generatedClipId, provider: result?.provider, audioUrl };

    setTracks(nextTracks);
    setClips(nextClips);
    setPluginsByTrack(nextPlugins);
    setMasterChain(nextMasterChain);
    setVocalSettings(nextVocalSettings);
    setAiLabSettings(nextAiLabSettings);
    setLastAiResult(nextLastResult);
    setGeneratedUrl(audioUrl);
    setSelectedTrackId(targetTrackId);
    setSelectedClipId(generatedClipId);
    setActiveSection('studio');

    const saved: any = await persistProjectSnapshot({
      ...currentSnapshot(),
      tracks: nextTracks,
      clips: nextClips,
      plugins: nextPlugins,
      masterChain: nextMasterChain,
      sessionState: {
        selectedTrackId: targetTrackId,
        selectedClipId: generatedClipId,
        editorTool,
        gridOn,
        snapOn,
        quantize,
        vocalSettings: nextVocalSettings,
        aiLabSettings: nextAiLabSettings,
        generatedUrl: audioUrl,
        lastAiResult: nextLastResult,
      },
    });
    if (saved?.project?.id) setCurrentProjectId(saved.project.id);
    projectsQuery.refetch();
    libraryQuery.refetch();
    return nextLastResult;
  };

  const handleAgent = async (slug: string) => {
    setRunningAgent(slug);
    try {
      const res: any = await apiFetch(`/api/mini-studio/agents/${slug}/run`, {
        method: 'POST',
        body: JSON.stringify({ bpm, key: keyName, artistId: selectedArtistId || selectedArtist?.id, songId: selectedSong?.id, songTitle: selectedSong?.title || selectedSong?.name, project: currentSnapshot(), selectedTrack, selectedClip }),
      });
      if (res?.starter?.audioUrl) await applyAiGenerationToSession(res.starter.kind || 'beat', res.starter, { targetMode: 'auto', insertMode: 'arrangement', applyMix: true });
      if (res?.result?.audioUrl) await applyAiGenerationToSession(res.result.kind || 'beat', res.result, { targetMode: 'auto', insertMode: 'arrangement', applyMix: true });
      if (slug === 'mix-engineer' && selectedTrack) {
        const inferredKind: AILabKind = selectedTrack.type.toLowerCase().includes('vocal') ? 'vocal' : selectedTrack.type.toLowerCase().includes('bass') ? 'bassline' : selectedTrack.type.toLowerCase().includes('drum') ? 'beat' : 'synth';
        setPluginsByTrack((prev) => ({ ...prev, [selectedTrack.id]: applyAiPluginPresetToChain(prev[selectedTrack.id] || defaultPluginsForTrack(selectedTrack), inferredKind, selectedTrack) }));
        setMasterChain((current) => ({ ...current, glue: Math.max(current.glue, 38) }));
      }
      if (slug === 'mastering-engineer') setMasterChain((current) => ({ ...current, width: 62, glue: 44, targetLufs: -14, limiter: -1 }));
      if (slug === 'vocal-coach') setVocalSettings((current) => ({ ...current, tuning: true, noise: true, monitoring: true }));
      toast({ title: `Agente ${slug}`, description: res?.message || res?.plan?.[0] || 'Listo' });
    } catch (e: any) {
      toast({ title: 'Agente falló', description: e.message, variant: 'destructive' });
    } finally {
      setRunningAgent(null);
    }
  };

  const stemsFromResponse = (response: any): StemFile[] => {
    const fromArray = Array.isArray(response?.stems) ? response.stems : [];
    const fallback: StemFile[] = [
      { type: 'vocals', name: 'Vocals Stem', audioUrl: response?.vocalsUrl },
      { type: 'drums', name: 'Drums Stem', audioUrl: response?.drumsUrl },
      { type: 'bass', name: 'Bass Stem', audioUrl: response?.bassUrl },
      { type: 'other', name: 'Music Stem', audioUrl: response?.otherUrl },
      { type: 'instrumental', name: 'Instrumental Stem', audioUrl: response?.instrumentalUrl },
    ].filter((stem) => !!stem.audioUrl);
    const combined = [...fromArray, ...fallback]
      .map((stem) => ({ type: normalizeStemType(stem.type || stem.name), name: stem.name, audioUrl: stem.audioUrl }))
      .filter((stem) => !!stem.audioUrl);
    const seen = new Set<string>();
    return combined.filter((stem) => {
      const key = `${stem.type}:${stem.audioUrl}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const applyStemsToSession = async (stems: StemFile[], sourceAudioUrl: string) => {
    const sourceId = selectedSong?.id || selectedClipId || sourceAudioUrl;
    const stemTracks = new Map(tracks.map((track) => [track.id, { ...track }]));
    const stemClips: Clip[] = [];

    stems.forEach((stem, index) => {
      const type = normalizeStemType(stem.type);
      const preset = STEM_TRACK_CONFIG[type] || STEM_TRACK_CONFIG.other;
      const trackId = preset.trackId || `stem-${type}`;
      const existing = stemTracks.get(trackId);
      stemTracks.set(trackId, {
        ...(existing || { id: trackId, vol: 75, pan: 0, mute: false, solo: false, rec: false }),
        id: trackId,
        name: (stem.name || preset.name).toUpperCase().slice(0, 28),
        type: preset.type,
        color: preset.color,
        initial: preset.initial,
        iconBg: preset.iconBg,
        vol: existing?.vol ?? 75,
        pan: existing?.pan ?? 0,
        mute: false,
        solo: false,
        rec: type === 'vocals',
        audioUrl: stem.audioUrl,
      });
      stemClips.push({
        id: `stem-${type}-${Date.now()}-${index}`,
        trackId,
        name: (stem.name || preset.name).replace(/\s+Stem$/i, ''),
        start: 0,
        width: 96,
        audioUrl: stem.audioUrl,
        stemType: type,
        sourceSongId: sourceId,
        gain: 1,
      });
    });

    const nextTracks = Array.from(stemTracks.values());
    const nextClips = [
      ...clips.filter((clip) => !(clip.sourceSongId === sourceId && clip.stemType)),
      ...stemClips,
    ];
    const nextPlugins = normalizePluginsForTracks(nextTracks, pluginsByTrack);

    setTracks(nextTracks);
    setClips(nextClips);
    setPluginsByTrack(nextPlugins);
    setSelectedTrackId(stemClips[0]?.trackId || selectedTrackId || 't1');
    setSelectedClipId(stemClips[0]?.id || null);
    setActiveSection('studio');

    const saved: any = await persistProjectSnapshot({
      ...currentSnapshot(),
      tracks: nextTracks,
      clips: nextClips,
      plugins: nextPlugins,
      sessionState: {
        selectedTrackId: stemClips[0]?.trackId || selectedTrackId || 't1',
        selectedClipId: stemClips[0]?.id || null,
        editorTool,
        gridOn,
        snapOn,
        quantize,
        vocalSettings,
        aiLabSettings,
        generatedUrl,
        lastAiResult,
      },
    });
    if (saved?.project?.id) setCurrentProjectId(saved.project.id);
    projectsQuery.refetch();
    libraryQuery.refetch();
    toast({ title: 'Stems cargados', description: `${stemClips.length} canales independientes creados y guardados.` });
  };

  const handleSeparateStems = async () => {
    const selectedClip = selectedClipId ? clips.find((clip) => clip.id === selectedClipId) : null;
    const sourceAudioUrl = selectedClip?.audioUrl || selectedSong?.audioUrl || tracks.find((track) => track.audioUrl && !track.mute)?.audioUrl;
    if (!sourceAudioUrl) throw new Error('Carga una canción o selecciona un clip con audio antes de separar stems.');
    const r: any = await apiFetch('/api/mini-studio/separate-stems', {
      method: 'POST',
      body: JSON.stringify({ audioUrl: sourceAudioUrl, songId: selectedSong?.id || selectedSongId, projectId: currentProjectId }),
    });
    const stems = stemsFromResponse(r);
    if (!stems.length) {
      toast({ title: 'Stem separator', description: r?.message || 'Separación en cola. Cuando termine, vuelve a cargar la sesión.' });
      return;
    }
    await applyStemsToSession(stems, sourceAudioUrl);
  };

  const handleQuick = async (kind: string) => {
    setRunningAction(kind);
    try {
      if (kind === 'lyrics') {
        const r: any = await apiFetch('/api/mini-studio/lyrics/generate', {
          method: 'POST',
          body: JSON.stringify({ topic: projectName, genre: 'pop', mood: 'uplifting', language: 'es' }),
        });
        if (r?.lyrics) {
          setLyrics(r.lyrics);
          setShowLyricsPanel(true);
        }
        toast({ title: 'Letra generada', description: '¡Letras listas! Se abrió el editor para revisar.' });
      } else if (kind === 'stems') {
        await handleSeparateStems();
      } else if (kind === 'release') {
        releaseMut.mutate();
      } else if (kind === 'master') {
        const r: any = await apiFetch('/api/mini-studio/master', {
          method: 'POST',
          body: JSON.stringify({
            presetId: 'spotify',
            songId: selectedSong?.id,
            projectId: currentProjectId,
            measured: meter.integratedLufs > -70 ? { integratedLufs: meter.integratedLufs, truePeakDb: meter.truePeakDb } : undefined,
          }),
        });
        setMasterChain((current) => ({ ...current, targetLufs: r?.measured?.integratedLufs ?? -14, limiter: r?.measured?.truePeakDb ?? -1, glue: Math.max(current.glue, 40) }));
        toast({ title: 'Master listo', description: `${r?.preset?.name} · ${r?.measured?.integratedLufs} LUFS` });
      } else {
        const mappedKind = kind === 'mix' ? 'beat' : kind === 'tiktok' ? 'hook' : kind;
        const r: any = await apiFetch('/api/mini-studio/generate', {
          method: 'POST',
          body: JSON.stringify({ kind: mappedKind, bpm, key: keyName, reference: selectedClip?.audioUrl || selectedSong?.audioUrl, project: currentSnapshot(), timeline: { playhead, selectedClipId }, mixer: { selectedTrack, plugins: selectedTrackPlugins } }),
        });
        if (r?.audioUrl) await applyAiGenerationToSession(mappedKind as AILabKind, r, { targetMode: 'auto', insertMode: kind === 'tiktok' ? 'playhead' : 'arrangement', applyMix: true });
        toast({ title: `${kind} listo`, description: `Provider: ${r?.provider || 'studio'}` });
      }
    } catch (e: any) {
      toast({ title: 'Acción falló', description: e.message, variant: 'destructive' });
    } finally {
      setRunningAction(null);
    }
  };

  const handleGenerate = async (request: AILabKind | AILabGenerateRequest) => {
    const options: AILabGenerateRequest = typeof request === 'string' ? { kind: request, ...aiLabSettings } : { ...aiLabSettings, ...request };
    const kind = options.kind;
    setGenerating(kind);
    try {
      const referenceClip = selectedClip?.audioUrl ? selectedClip : [...clips].reverse().find((clip) => clip.audioUrl && !clip.muted);
      const r: any = await apiFetch('/api/mini-studio/generate', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          bpm,
          key: keyName,
          bars: AI_KIND_CONFIG[kind]?.bars,
          durationSec: AI_KIND_CONFIG[kind]?.durationSec,
          prompt: options.prompt?.trim() || undefined,
          reference: referenceClip?.audioUrl || selectedSong?.audioUrl || tracks.find((track) => track.audioUrl && !track.mute)?.audioUrl,
          styleTags: [selectedArtist?.genre, selectedSong?.genre, projectName, selectedTrack?.type, kind].filter(Boolean),
          project: { name: projectName, bpm, key: keyName, trackCount: tracks.length, selectedTrack: selectedTrack?.name, selectedClip: selectedClip?.name },
          mixer: { targetMode: options.targetMode, targetTrackId: options.targetTrackId, masterChain, plugins: selectedTrackPlugins },
          timeline: { playhead, insertMode: options.insertMode, selectedClipId },
        }),
      });
      const applied = await applyAiGenerationToSession(kind, r, options);
      toast({ title: `${kind} generado`, description: applied ? `${AI_KIND_CONFIG[kind].name} en timeline · ${r?.provider}` : `Provider: ${r?.provider || 'studio'}` });
    } catch (e: any) {
      toast({ title: 'Generación falló', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const handleTile = (id: string) => {
    const routes: Record<string, string> = {
      cover: '/music-video-creator', video: '/music-video-creator',
      viz: '/music-video-creator', distro: '/producer-tools',
      social: '/social-media', merch: '/merchandise',
      license: '/marketplace', page: '/explore',
    };
    const dest = routes[id];
    if (dest) navigate(dest);
    else toast({ title: id, description: 'Módulo de release activado.' });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const activeFormats = exportFormats.filter((f) => f.active).map((f) => f.id);
      if (activeFormats.length === 0) throw new Error('Selecciona al menos un formato de exportación.');
      const created: any = await apiFetch(currentProjectId ? `/api/mini-studio/projects/${currentProjectId}` : '/api/mini-studio/projects', {
        method: currentProjectId ? 'PUT' : 'POST',
        body: JSON.stringify(currentSnapshot()),
      });
      const projectId = created?.project?.id || currentProjectId;
      if (projectId) setCurrentProjectId(projectId);

      // Real, client-side WAV render of the loaded master through its DSP chain.
      // Delivers a downloadable file immediately without a backend render worker.
      const wantsWav = activeFormats.some((f) => f.toLowerCase().includes('wav'));
      if (wantsWav && currentAudioUrl) {
        try {
          const masterTrack = tracks.find((t) => t.audioUrl && t.audioUrl === currentAudioUrl);
          const blob = await renderUrlToWav(currentAudioUrl, {
            plugins: masterTrack ? (pluginsByTrack[masterTrack.id] || []) as PluginLike[] : [],
            gain: masterVolumeRef.current,
            bpm,
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(projectName || 'mini-studio').replace(/[^\w.-]+/g, '_')}.wav`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          toast({ title: 'WAV exportado', description: 'Render local renderizado y descargado.' });
        } catch (renderErr: any) {
          console.warn('[mini-studio] local WAV render failed:', renderErr?.message);
          toast({ title: 'Render local no disponible', description: 'El archivo es cross-origin sin CORS; se encoló en el servidor.', variant: 'destructive' });
        }
      }

      const r: any = await apiFetch('/api/mini-studio/export', {
        method: 'POST',
        body: JSON.stringify({ projectId, songId: selectedSong?.id || selectedSongId, formats: activeFormats }),
      });
      toast({ title: 'Export encolado', description: `${r?.exports?.length || activeFormats.length} formatos en cola.` });
    } catch (e: any) {
      toast({ title: 'Export falló', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleLoadSong = async (song: ArtistLibrarySong) => {
    try {
      const songTitle = song.title || song.name || PROJECT.name;
      const audioUrl = song.audioUrl || (song as any).audioURL || (song as any).fileUrl || (song as any).url || (song as any).streamUrl || '';
      let linkedProject = projects.find((project: any) => project.id === song.miniStudioProjectId || String(project.songId || '') === String(song.id));
      if (!linkedProject && song.miniStudioProjectId) {
        try {
          const linked: any = await apiFetch(`/api/mini-studio/projects/${song.miniStudioProjectId}`);
          linkedProject = linked?.project || null;
        } catch {
          linkedProject = null;
        }
      }
      if (!audioUrl && !linkedProject?.clips?.length) throw new Error('Esta canción no tiene audio guardado en la base de datos.');

      const baseTracks = linkedProject?.tracks?.length ? linkedProject.tracks : TRACKS;
      const baseClips = linkedProject?.clips?.length ? ensureClipIds(linkedProject.clips) : [];
      const basePlugins = linkedProject?.tracks?.length ? normalizePluginsForTracks(linkedProject.tracks, linkedProject.plugins || {}) : normalizePluginsForTracks(TRACKS);
      const nextMasterChain = linkedProject?.masterChain ? { ...DEFAULT_MASTER_CHAIN, ...linkedProject.masterChain } : DEFAULT_MASTER_CHAIN;
      const nextLyrics = linkedProject?.lyrics || song.lyrics || '';
      const nextVocalSettings = linkedProject?.sessionState?.vocalSettings ? { ...DEFAULT_VOCAL_SETTINGS, ...linkedProject.sessionState.vocalSettings } : DEFAULT_VOCAL_SETTINGS;
      const nextAiLabSettings = linkedProject?.sessionState?.aiLabSettings ? { ...DEFAULT_AI_LAB_SETTINGS, ...linkedProject.sessionState.aiLabSettings } : DEFAULT_AI_LAB_SETTINGS;
      const nextGeneratedUrl = linkedProject?.sessionState?.generatedUrl || null;
      const nextLastAiResult = linkedProject?.sessionState?.lastAiResult || null;
      const usableTrackIds = new Set(baseTracks.map((track: Track) => track.id));
      const fallbackTrackId = usableTrackIds.has('t1') ? 't1' : baseTracks[0]?.id || 't1';
      const targetTrackId = selectedTrackId && selectedTrackId !== 't8' && usableTrackIds.has(selectedTrackId) ? selectedTrackId : fallbackTrackId;
      const importClipId = `db-song-${song.id}`;

      const nextTracks = (baseTracks.length ? baseTracks : TRACKS).map((track: Track) => {
        if (track.id !== targetTrackId) return track;
        return {
          ...track,
          name: songTitle.toUpperCase().slice(0, 18),
          type: track.type === 'Ref' ? 'Audio' : track.type,
          mute: false,
          solo: false,
          audioUrl: audioUrl || track.audioUrl,
        };
      });
      const nextClips = audioUrl
        ? (() => {
            const reusableClip = baseClips.find((clip) => clip.id === importClipId || clip.sourceSongId === song.id);
            const filteredClips = baseClips.filter((clip) => clip.id !== importClipId && clip.sourceSongId !== song.id);
            const importedClip: Clip = {
              ...(reusableClip || {}),
              id: importClipId,
              trackId: targetTrackId,
              name: songTitle,
              start: reusableClip?.start ?? 0,
              width: reusableClip?.width ?? 96,
              audioUrl,
              sourceSongId: song.id,
              gain: reusableClip?.gain ?? 1,
            };
            return [...filteredClips, importedClip];
          })()
        : baseClips;
      const artistId = song.artistId || libraryArtist?.id || selectedArtist?.id || selectedArtistId;
      const projectIdForSave = linkedProject?.id || null;
      const snapshot = {
        name: songTitle,
        bpm: linkedProject?.bpm || bpm,
        key: linkedProject?.key || keyName,
        artistId,
        songId: song.id,
        tracks: nextTracks,
        clips: nextClips,
        plugins: normalizePluginsForTracks(nextTracks, basePlugins),
        masterChain: nextMasterChain,
        lyrics: nextLyrics,
        sessionState: {
          selectedTrackId: targetTrackId,
          selectedClipId: audioUrl ? importClipId : selectedClipId,
          editorTool,
          gridOn,
          snapOn,
          quantize,
          vocalSettings: nextVocalSettings,
          aiLabSettings: nextAiLabSettings,
          generatedUrl: nextGeneratedUrl,
          lastAiResult: nextLastAiResult,
        },
      };

      setSelectedSongId(song.id);
      setSelectedArtistId(artistId || null);
      setLibraryArtistId(artistId || null);
      setProjectName(songTitle);
      setBpm(snapshot.bpm);
      setKeyName(snapshot.key);
      setTracks(nextTracks);
      setClips(nextClips);
      setPluginsByTrack(snapshot.plugins);
      setMasterChain(nextMasterChain);
      setLyrics(nextLyrics);
      setVocalSettings(nextVocalSettings);
      setAiLabSettings(nextAiLabSettings);
      setGeneratedUrl(nextGeneratedUrl);
      setLastAiResult(nextLastAiResult);
      setSelectedTrackId(targetTrackId);
      setSelectedClipId(audioUrl ? importClipId : selectedClipId);
      setPlayhead(0);
      setCurrentTime(0);
      if (audioUrl && audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
      }

      const saved: any = await persistProjectSnapshot(snapshot, projectIdForSave || null);
      if (saved?.project?.id) setCurrentProjectId(saved.project.id);
      projectsQuery.refetch();
      libraryQuery.refetch();
      toast({ title: linkedProject ? 'Proyecto de canción abierto' : 'Proyecto de canción creado', description: `${songTitle} está conectado a ${libraryArtist?.name || selectedArtist?.name || 'este artista'}.` });
    } catch (error: any) {
      toast({ title: 'No se pudo importar', description: error.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (deepLinkLoadedRef.current || libraryQuery.isLoading) return;
    const query = window.location.search || (location.includes('?') ? `?${location.split('?')[1]}` : '');
    const params = new URLSearchParams(query);
    const artistParam = params.get('artistId');
    const songId = params.get('songId');
    const audioUrl = params.get('audioUrl') || undefined;
    const songTitle = params.get('song') || params.get('title') || undefined;
    if (!artistParam && !songId && !audioUrl) return;

    const artistMatch = artists.find((artist) => [artist.id, artist.firestoreId, artist.pgId ? String(artist.pgId) : null].filter(Boolean).map(String).includes(String(artistParam)));
    if (artistMatch?.id) { setSelectedArtistId(artistMatch.id); setLibraryArtistId(artistMatch.id); }

    const librarySong = [...allSongs, ...(artistMatch?.songs || [])].find((song) => String(song.id) === String(songId));
    if (librarySong) {
      deepLinkLoadedRef.current = true;
      void handleLoadSong(librarySong);
      return;
    }

    if (audioUrl) {
      deepLinkLoadedRef.current = true;
      void handleLoadSong({
        id: songId || `external-${Date.now()}`,
        title: songTitle || 'Canción importada',
        name: songTitle || 'Canción importada',
        audioUrl,
        artistId: artistMatch?.id || artistParam || undefined,
      });
    }
  }, [allSongs, artists, libraryQuery.isLoading, location]);

  const handleImportFiles = async (files: FileList) => {
    const artistId = selectedArtistId || libraryArtist?.id || selectedArtist?.id;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) continue;
      const blobUrl = URL.createObjectURL(file);
      const songName = file.name.replace(/\.[^/.]+$/, '');
      if (artistId) {
        createSongMut.mutate({ artistId, title: songName, name: songName, source: 'import', audioUrl: blobUrl });
      } else {
        // No artist yet — just load into session
        setProjectName(songName);
        if (audioRef.current) { audioRef.current.src = blobUrl; audioRef.current.load(); }
        setTracks((tks) => tks.map((t, i) => i === 0 ? { ...t, name: songName.toUpperCase().slice(0, 18), audioUrl: blobUrl } : t));
        toast({ title: 'Archivo importado', description: `${songName} listo en la pista principal.` });
      }
      const importClipId = makeClipId();
      setClips((prev) => [...prev, { id: importClipId, trackId: artistId ? 't8' : 't1', name: songName, start: 0, width: 50, audioUrl: blobUrl }]);
      setSelectedClipId(importClipId);
    }
  };

  const handleNewProject = () => {
    try { localStorage.removeItem('ms-last-project-id'); } catch {}
    try { localStorage.removeItem('ms-clips-v1'); } catch {}
    autoLoadedRef.current = true; // prevent auto-load from overriding blank session
    setProjectName('Nuevo proyecto');
    setCurrentProjectId(null);
    if (libraryArtist?.id) setSelectedArtistId(libraryArtist.id);
    setSelectedSongId(null);
    setTracks(TRACKS);
    setPluginsByTrack(normalizePluginsForTracks(TRACKS));
    setVocalSettings(DEFAULT_VOCAL_SETTINGS);
    setMasterChain(DEFAULT_MASTER_CHAIN);
    setAiLabSettings(DEFAULT_AI_LAB_SETTINGS);
    setLastAiResult(null);
    setClips(INITIAL_CLIPS);
    setSelectedTrackId('t1');
    setSelectedClipId(null);
    setClipMenu(null);
    setTrackMenu(null);
    setLyrics('');
    setPlayhead(0);
    setCurrentTime(0);
    setRecordedUrl(null);
    setGeneratedUrl(null);
    if (audioRef.current) { audioRef.current.src = ''; }
    toast({ title: 'Nuevo proyecto', description: 'Sesión limpia lista para producir.' });
  };

  const handleLoadProject = (project: any) => {
    try { localStorage.setItem('ms-last-project-id', String(project.id)); } catch {}
    setProjectName(project.name || 'Sin título');
    setCurrentProjectId(project.id);
    setSelectedSongId(project.songId || null);
    setSelectedArtistId(project.artistId || null);
    setLibraryArtistId(project.artistId || null);
    if (project.bpm) setBpm(project.bpm);
    if (project.key) setKeyName(project.key);
    const nextProjectTracks = project.tracks?.length ? project.tracks : TRACKS;
    setTracks(nextProjectTracks);
    setPluginsByTrack(normalizePluginsForTracks(nextProjectTracks, project.plugins || {}));
    setClips(project.clips?.length ? ensureClipIds(project.clips) : []);
    if (project.masterChain) setMasterChain({ ...DEFAULT_MASTER_CHAIN, ...project.masterChain });
    else setMasterChain(DEFAULT_MASTER_CHAIN);
    if (project.sessionState?.vocalSettings) setVocalSettings({ ...DEFAULT_VOCAL_SETTINGS, ...project.sessionState.vocalSettings });
    else setVocalSettings(DEFAULT_VOCAL_SETTINGS);
    if (project.sessionState?.aiLabSettings) setAiLabSettings({ ...DEFAULT_AI_LAB_SETTINGS, ...project.sessionState.aiLabSettings });
    else setAiLabSettings(DEFAULT_AI_LAB_SETTINGS);
    setLastAiResult(project.sessionState?.lastAiResult || null);
    setGeneratedUrl(project.sessionState?.generatedUrl || null);
    setSelectedTrackId(project.sessionState?.selectedTrackId || nextProjectTracks?.[0]?.id || 't1');
    setSelectedClipId(project.sessionState?.selectedClipId || null);
    if (project.sessionState?.editorTool) setEditorTool(project.sessionState.editorTool);
    if (typeof project.sessionState?.gridOn === 'boolean') setGridOn(project.sessionState.gridOn);
    if (typeof project.sessionState?.snapOn === 'boolean') setSnapOn(project.sessionState.snapOn);
    if (project.sessionState?.quantize) setQuantize(project.sessionState.quantize);
    setClipMenu(null);
    setTrackMenu(null);
    setLyrics(project.lyrics || '');
    setPlayhead(0);
    setCurrentTime(0);
    setRecordedUrl(null);
    if (audioRef.current) { audioRef.current.src = ''; }
    setActiveSection('studio');
    toast({ title: 'Proyecto cargado', description: `${project.name} — ${project.tracks?.length || 0} pistas restauradas.` });
  };

  const handleGenerateLyrics = async (opts: { topic: string; genre: string; mood: string; language: string }) => {
    setLyricsGenerating(true);
    try {
      const r: any = await apiFetch('/api/mini-studio/lyrics/generate', {
        method: 'POST',
        body: JSON.stringify(opts),
      });
      if (r?.lyrics) setLyrics(r.lyrics);
    } catch (e: any) {
      toast({ title: 'Error al generar letras', description: e.message, variant: 'destructive' });
    } finally {
      setLyricsGenerating(false);
    }
  };

  const handleRewriteLyrics = async (instruction: string) => {
    if (!lyrics.trim()) return;
    setLyricsGenerating(true);
    try {
      const r: any = await apiFetch('/api/mini-studio/lyrics/rewrite', {
        method: 'POST',
        body: JSON.stringify({ lyrics, instruction }),
      });
      if (r?.lyrics) setLyrics(r.lyrics);
    } catch (e: any) {
      toast({ title: 'Error al reescribir', description: e.message, variant: 'destructive' });
    } finally {
      setLyricsGenerating(false);
    }
  };

  const handleClipUpdate = (clipId: string, patch: Partial<Clip>) => {
    setClips((prev) => prev.map((clip) => clip.id === clipId ? { ...clip, ...patch } : clip));
  };

  const handleSplitClip = (clipId: string, absolutePct: number) => {
    const clip = clips.find((item) => item.id === clipId);
    if (!clip) return;
    const rightClipId = makeClipId();
    const splitAt = clampTimelinePct(snapTimelinePct(absolutePct, snapOn, quantize));
    const clipEnd = clip.start + clip.width;
    if (splitAt <= clip.start + 1 || splitAt >= clipEnd - 1) {
      toast({ title: 'Corte no aplicado', description: 'El punto de corte está demasiado cerca del borde del clip.' });
      return;
    }
    setClips((prev) => prev.flatMap((clip) => {
      if (clip.id !== clipId) return [clip];
      return [
        { ...clip, width: splitAt - clip.start },
        { ...clip, id: rightClipId, name: `${clip.name}_cut`, start: splitAt, width: clipEnd - splitAt },
      ];
    }));
    setSelectedClipId(rightClipId);
    toast({ title: 'Clip cortado', description: 'El audio quedó dividido en dos regiones editables.' });
  };

  const handleDuplicateClip = (clipId: string) => {
    const duplicateId = makeClipId();
    setClips((prev) => {
      const clip = prev.find((item) => item.id === clipId);
      if (!clip) return prev;
      const start = Math.min(100 - clip.width, clip.start + Math.max(2, clip.width + 1));
      return [...prev, { ...clip, id: duplicateId, name: `${clip.name}_copy`, start }];
    });
    setSelectedClipId(duplicateId);
    toast({ title: 'Clip duplicado', description: 'La copia fue añadida a la misma pista.' });
  };

  const handleDeleteClip = (clipId: string) => {
    setClips((prev) => prev.filter((clip) => clip.id !== clipId));
    if (selectedClipId === clipId) setSelectedClipId(null);
    toast({ title: 'Clip eliminado', description: 'La región salió del timeline.' });
  };

  const handleRenameClip = (clipId: string) => {
    const clip = clips.find((item) => item.id === clipId);
    setRenameDialog({ target: 'clip', id: clipId, title: 'Renombrar clip', label: 'Nombre del clip', initialValue: clip?.name || 'Audio Clip' });
  };

  const handleToggleClipMute = (clipId: string) => {
    setClips((prev) => prev.map((clip) => clip.id === clipId ? { ...clip, muted: !clip.muted } : clip));
  };

  const handleMoveClipToTrack = (clipId: string, trackId: string) => {
    handleClipUpdate(clipId, { trackId });
  };

  const handleAlignClipToPlayhead = (clipId: string, playheadPct: number) => {
    const clip = clips.find((item) => item.id === clipId);
    if (!clip) return;
    handleClipUpdate(clipId, { start: Math.min(100 - clip.width, Math.max(0, snapTimelinePct(playheadPct, snapOn, quantize))) });
  };

  const handleRenameTrack = (trackId: string) => {
    const track = tracks.find((item) => item.id === trackId);
    setRenameDialog({ target: 'track', id: trackId, title: 'Renombrar pista', label: 'Nombre de la pista', initialValue: track?.name || 'PISTA' });
  };

  const handleRenameSubmit = (value: string) => {
    if (!renameDialog) return;
    const nextName = value.trim();
    if (!nextName) return;
    if (renameDialog.target === 'clip') {
      handleClipUpdate(renameDialog.id, { name: nextName });
    } else {
      setTracks((prev) => prev.map((item) => item.id === renameDialog.id ? { ...item, name: nextName.toUpperCase().slice(0, 28), initial: nextName.charAt(0).toUpperCase() || item.initial } : item));
    }
    setRenameDialog(null);
  };

  const handleArmTrack = (trackId: string) => {
    setSelectedTrackId(trackId);
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, rec: !track.rec } : track));
  };

  const handleMuteTrack = (trackId: string) => {
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, mute: !track.mute } : track));
  };

  const handleSoloTrack = (trackId: string) => {
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, solo: !track.solo } : track));
  };

  const handleRecordOnTrack = (trackId: string) => {
    setSelectedTrackId(trackId);
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, rec: true } : track));
    if (!isRecording) handleStartRecording(trackId);
  };

  const handleDuplicateTrack = (trackId: string) => {
    const track = tracks.find((item) => item.id === trackId);
    if (!track) return;
    const newTrackId = `t${Date.now()}`;
    const copyTrack = { ...track, id: newTrackId, name: `${track.name} COPY`.slice(0, 28), rec: false, solo: false };
    const trackIndex = tracks.findIndex((item) => item.id === trackId);
    const duplicateClips = clips
      .filter((clip) => clip.trackId === trackId)
      .map((clip) => ({ ...clip, id: makeClipId(), trackId: newTrackId, name: `${clip.name}_copy` }));
    setTracks((prev) => {
      const next = [...prev];
      next.splice(trackIndex + 1, 0, copyTrack);
      return next;
    });
    setClips((prev) => [...prev, ...duplicateClips]);
    setPluginsByTrack((prev) => ({
      ...prev,
      [newTrackId]: (prev[trackId] || defaultPluginsForTrack(track)).map((plugin) => ({ ...plugin, id: `${plugin.type}-${Math.random().toString(36).slice(2, 8)}`, params: { ...plugin.params } })),
    }));
    setSelectedTrackId(newTrackId);
  };

  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) {
      toast({ title: 'Pista protegida', description: 'El proyecto debe conservar al menos una pista.' });
      return;
    }
    const deletedTrack = tracks.find((track) => track.id === trackId);
    const nextSelected = tracks.find((track) => track.id !== trackId)?.id || null;
    setTracks((prev) => prev.filter((track) => track.id !== trackId));
    setClips((prev) => prev.filter((clip) => clip.trackId !== trackId));
    setPluginsByTrack((prev) => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    setSelectedTrackId(nextSelected);
    if (selectedClipId && clips.some((clip) => clip.id === selectedClipId && clip.trackId === trackId)) setSelectedClipId(null);
    toast({ title: 'Pista eliminada', description: `${deletedTrack?.name || 'La pista'} y sus clips salieron del proyecto.` });
  };

  const handleAddTrack = () => {
    let next = tracks.length + 1;
    while (tracks.some((track) => track.id === `t${next}`)) next += 1;
    const colors = ['#f97316','#a855f7','#ef4444','#eab308','#22c55e','#06b6d4','#ec4899','#71717a'];
    const color = colors[(next - 1) % colors.length];
    const id = `t${next}`;
    const newTrack: Track = { id, name: `PISTA ${next}`, type: 'Audio', color, initial: String(next), iconBg: 'bg-orange-500', vol: 60, pan: 0, mute: false, solo: false, rec: false };
    setTracks([...tracks, newTrack]);
    setPluginsByTrack((prev) => ({ ...prev, [id]: defaultPluginsForTrack(newTrack) }));
    setSelectedTrackId(id);
    toast({ title: 'Pista añadida', description: `PISTA ${next} agregada al proyecto.` });
  };

  const handleUpdateTrackMixer = (trackId: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, ...patch } : track));
  };

  const handleToggleTrackMixer = (trackId: string, key: 'mute' | 'solo' | 'rec') => {
    setSelectedTrackId(trackId);
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, [key]: !track[key] } : track));
  };

  const handleToggleSelectedPlugin = (pluginId: string) => {
    if (!selectedTrack) return;
    setPluginsByTrack((prev) => ({
      ...prev,
      [selectedTrack.id]: (prev[selectedTrack.id] || defaultPluginsForTrack(selectedTrack)).map((plugin) => plugin.id === pluginId ? { ...plugin, enabled: !plugin.enabled } : plugin),
    }));
  };

  const handlePluginParamChange = (pluginId: string, key: string, value: number | string) => {
    if (!selectedTrack) return;
    setPluginsByTrack((prev) => ({
      ...prev,
      [selectedTrack.id]: (prev[selectedTrack.id] || defaultPluginsForTrack(selectedTrack)).map((plugin) => plugin.id === pluginId ? { ...plugin, params: { ...plugin.params, [key]: value } } : plugin),
    }));
  };

  const handleAddPluginToSelectedTrack = (type: PluginType) => {
    if (!selectedTrack) return;
    setPluginsByTrack((prev) => ({ ...prev, [selectedTrack.id]: [...(prev[selectedTrack.id] || defaultPluginsForTrack(selectedTrack)), createPlugin(type)] }));
  };

  const setSelectedPluginEnabled = (type: PluginType, enabled: boolean) => {
    if (!selectedTrack) return;
    setPluginsByTrack((prev) => {
      const chain = [...(prev[selectedTrack.id] || defaultPluginsForTrack(selectedTrack))];
      const pluginIndex = chain.findIndex((plugin) => plugin.type === type);
      if (pluginIndex >= 0) chain[pluginIndex] = { ...chain[pluginIndex], enabled };
      else chain.push({ ...createPlugin(type), enabled });
      return { ...prev, [selectedTrack.id]: chain };
    });
  };

  const handleMaximize = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const handleSidebarSelect = (id: string) => {
    const item = SIDEBAR_NAV.find((navItem) => navItem.id === id);
    if (item?.href) {
      setSidebarOpen(false);
      navigate(item.href);
      toast({ title: item.label, description: id === 'explore' ? 'Abriendo Explorar.' : 'Abriendo Marketplace.' });
      return;
    }
    setActiveSection(id);
    try { localStorage.setItem('ms-section', id); } catch {};
    setSidebarOpen(false);
    const mobileMap: Record<string, typeof mobilePanel> = {
      studio: 'timeline',
      'ai-lab': 'ai',
      vocal: 'vocal',
      mix: 'mixer',
      master: 'release',
      release: 'release',
    };
    if (mobileMap[id]) setMobilePanel(mobileMap[id]);
    const labels: Record<string, string> = {
      studio: 'Studio abierto.',
      'ai-lab': 'AI Lab abierto.', vocal: 'Vocal Booth listo.',
      mix: 'Mixer activo.', master: 'Master Room activo.',
      release: 'Release Room listo.', projects: 'Proyectos cargados.', settings: 'Ajustes abiertos.',
    };
    toast({ title: SIDEBAR_NAV.find((item) => item.id === id)?.label || 'Mini Studio', description: labels[id] || 'Panel activado.' });
  };

  const handleTimelineTool = (tool: string) => {
    if (tool === 'grid') { setGridOn((v) => !v); return; }
    if (tool === 'snap') { setSnapOn((v) => !v); return; }
    if (tool === 'select') { setEditorTool('select'); return; }
    if (tool === 'cut') {
      if (selectedClipId) handleSplitClip(selectedClipId, playhead);
      setEditorTool((current) => current === 'cut' ? 'select' : 'cut');
      return;
    }
    if (tool === 'quantize') {
      const opts = ['1/4', '1/8', '1/16'];
      setQuantize((q) => opts[(opts.indexOf(q) + 1) % opts.length]);
      return;
    }
    toast({ title: 'Editor', description: `Herramienta ${tool} activada.` });
  };

  const handleVocalTool = (tool: string) => {
    if (tool === 'tuning') setSelectedPluginEnabled('pitch', !vocalSettings.tuning);
    if (tool === 'noise') setSelectedPluginEnabled('noise', !vocalSettings.noise);
    if (tool === 'smart-take' || tool === 'comp-best') {
      const targetTrackId = selectedTrack?.id || selectedTrackId || 't1';
      const latestTake = [...clips].reverse().find((clip) => clip.trackId === targetTrackId && clip.audioUrl && !clip.muted)
        || [...clips].reverse().find((clip) => clip.trackId === targetTrackId && clip.audioUrl)
        || [...clips].reverse().find((clip) => clip.trackId === targetTrackId);
      if (latestTake) setSelectedClipId(latestTake.id);
    }
    if (tool === 'vocal-chain' && selectedTrack) {
      setPluginsByTrack((prev) => ({
        ...prev,
        [selectedTrack.id]: applyAiPluginPresetToChain(prev[selectedTrack.id] || defaultPluginsForTrack(selectedTrack), 'vocal', selectedTrack),
      }));
      setVocalSettings((current) => ({ ...current, tuning: true, noise: true, monitoring: true, takeMode: 'smart' }));
    }
    if (tool === 'harmonies') void handleGenerate('hook');
    if (tool === 'vocal-doubler') {
      const baseClip = (selectedClipId ? clips.find((clip) => clip.id === selectedClipId) : null)
        || [...clips].reverse().find((clip) => clip.trackId === (selectedTrack?.id || selectedTrackId) && clip.audioUrl);
      if (baseClip) {
        const duplicateId = makeClipId();
        setClips((prev) => [...prev, { ...baseClip, id: duplicateId, name: `${baseClip.name} Doubler`, start: Math.min(100 - baseClip.width, baseClip.start + 1.2), gain: 0.72 }]);
        setSelectedClipId(duplicateId);
      }
    }
    const descs: Record<string, string> = {
      metronome: 'Click de tempo sincronizado.',
      tuning: 'Afinación automática alternada.',
      noise: 'Reducción de ruido alternada.',
      monitoring: 'Monitoreo vocal alternado.',
      'cue-line': 'Línea marcada para la toma actual.',
      'smart-take': 'Seleccionando mejor toma con AI.',
      'comp-best': 'Mejor toma enfocada en el timeline.',
      'vocal-chain': 'Cadena vocal aplicada al mixer.',
      harmonies: 'Generando armonías con AI.',
      'vocal-doubler': 'Doblador vocal insertado.',
    };
    toast({ title: 'Vocal Booth', description: descs[tool] || 'Control actualizado.' });
  };

  const handleDeleteSelectedClipCommand = () => {
    if (!selectedClipId) {
      toast({ title: 'Selecciona un clip', description: 'Haz clic en una región del timeline antes de borrar.' });
      return;
    }
    handleDeleteClip(selectedClipId);
  };

  const handleDeleteSelectedTrackCommand = () => {
    if (!selectedTrackId) {
      toast({ title: 'Selecciona una pista', description: 'Haz clic en una pista antes de borrar.' });
      return;
    }
    handleDeleteTrack(selectedTrackId);
  };

  const handleDuplicateSelectedClipCommand = () => {
    if (!selectedClipId) {
      toast({ title: 'Selecciona un clip', description: 'Haz clic en una región del timeline antes de duplicar.' });
      return;
    }
    handleDuplicateClip(selectedClipId);
  };

  const handleDuplicateSelectedTrackCommand = () => {
    if (!selectedTrackId) {
      toast({ title: 'Selecciona una pista', description: 'Haz clic en una pista antes de duplicar.' });
      return;
    }
    handleDuplicateTrack(selectedTrackId);
  };

  const handleRenameSelectionCommand = () => {
    if (selectedClipId) {
      handleRenameClip(selectedClipId);
      return;
    }
    if (selectedTrackId) handleRenameTrack(selectedTrackId);
  };

  const handleSplitSelectedClipCommand = () => {
    if (selectedClipId) {
      handleSplitClip(selectedClipId, playhead);
      return;
    }
    setEditorTool('cut');
    toast({ title: 'Herramienta cortar', description: 'Selecciona un clip o corta directamente en el timeline.' });
  };

  const handleNudgeSelectedClip = (direction: -1 | 1) => {
    const clip = selectedClipId ? clips.find((item) => item.id === selectedClipId) : null;
    if (!clip) {
      toast({ title: 'Selecciona un clip', description: 'Usa Shift + flechas para mover la región seleccionada.' });
      return;
    }
    const nextStart = Math.min(100 - clip.width, Math.max(0, snapTimelinePct(clip.start + (quantizeStepPct(quantize) * direction), snapOn, quantize)));
    handleClipUpdate(clip.id, { start: nextStart });
  };

  const handleMoveSelectedClipTrack = (direction: -1 | 1) => {
    const clip = selectedClipId ? clips.find((item) => item.id === selectedClipId) : null;
    if (!clip) {
      toast({ title: 'Selecciona un clip', description: 'Usa Shift + arriba/abajo para moverlo entre pistas.' });
      return;
    }
    const currentIndex = tracks.findIndex((track) => track.id === clip.trackId);
    const nextTrack = tracks[currentIndex + direction];
    if (!nextTrack) return;
    handleClipUpdate(clip.id, { trackId: nextTrack.id });
    setSelectedTrackId(nextTrack.id);
  };

  useEffect(() => {
    const closeActiveOverlay = () => {
      if (renameDialog) { setRenameDialog(null); return true; }
      if (showLyricsPanel) { setShowLyricsPanel(false); return true; }
      if (showShortcuts) { setShowShortcuts(false); return true; }
      return false;
    };

    const handleKey = (e: KeyboardEvent) => {
      const commandModifier = e.ctrlKey || e.metaKey;

      if (e.code === 'Escape') {
        e.preventDefault();
        if (!closeActiveOverlay()) handleStop();
        return;
      }

      if (isEditableShortcutTarget(e.target)) return;

      if (!commandModifier && (e.key === '?' || (e.code === 'Slash' && e.shiftKey))) { e.preventDefault(); setShowShortcuts(true); return; }
      if ((commandModifier && e.code === 'KeyS')) { e.preventDefault(); saveMut.mutate(); return; }
      if (commandModifier && e.code === 'KeyD') { e.preventDefault(); e.shiftKey ? handleDuplicateSelectedTrackCommand() : handleDuplicateSelectedClipCommand(); return; }
      if ((e.code === 'Delete' || e.code === 'Backspace') && (e.shiftKey || commandModifier)) { e.preventDefault(); handleDeleteSelectedTrackCommand(); return; }
      if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); handleDeleteSelectedClipCommand(); return; }
      if (e.code === 'F2') { e.preventDefault(); handleRenameSelectionCommand(); return; }
      if (!commandModifier && e.code === 'KeyA') { e.preventDefault(); handleAddTrack(); return; }
      if (!commandModifier && e.code === 'KeyS') { e.preventDefault(); handleSplitSelectedClipCommand(); return; }
      if (!commandModifier && e.shiftKey && e.code === 'ArrowLeft') { e.preventDefault(); handleNudgeSelectedClip(-1); return; }
      if (!commandModifier && e.shiftKey && e.code === 'ArrowRight') { e.preventDefault(); handleNudgeSelectedClip(1); return; }
      if (!commandModifier && e.shiftKey && e.code === 'ArrowUp') { e.preventDefault(); handleMoveSelectedClipTrack(-1); return; }
      if (!commandModifier && e.shiftKey && e.code === 'ArrowDown') { e.preventDefault(); handleMoveSelectedClipTrack(1); return; }
      if (e.code === 'Space') { e.preventDefault(); handlePlay(); return; }
      if (!commandModifier && e.code === 'KeyR') { e.preventDefault(); handleRecord(); return; }
      if (e.code === 'Home' || e.code === 'Numpad0' || e.code === 'Digit0') { e.preventDefault(); handleRewind(); return; }
      if (!commandModifier && e.code === 'ArrowLeft') { e.preventDefault(); handleSeek(Math.max(0, playhead - 8)); return; }
      if (!commandModifier && e.code === 'ArrowRight') { e.preventDefault(); handleForward(); return; }
      if (!commandModifier && e.code === 'KeyG') { e.preventDefault(); setGridOn((value) => !value); return; }
      if (!commandModifier && e.code === 'KeyQ') { e.preventDefault(); setSnapOn((value) => !value); }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handlePlay, handleRecord, handleStop, handleRewind, handleForward, handleSeek, handleAddTrack, handleDeleteSelectedClipCommand, handleDeleteSelectedTrackCommand, handleDuplicateSelectedClipCommand, handleDuplicateSelectedTrackCommand, handleRenameSelectionCommand, handleSplitSelectedClipCommand, handleNudgeSelectedClip, handleMoveSelectedClipTrack, playhead, renameDialog, saveMut, showLyricsPanel, showShortcuts]);

  const currentAudioUrl = selectedSong?.audioUrl || tracks.find((t) => t.audioUrl && !t.mute)?.audioUrl;
  const masterDurationLabel = masterDuration ? formatTime(masterDuration) : undefined;

  // Drive the master element's source from the active mix URL (single source of
  // truth). Keeping one persistent <audio> node means the Web Audio connection
  // survives source changes, so we never re-create the MediaElementSource.
  useEffect(() => {
    currentMasterUrlRef.current = currentAudioUrl;
    const el = audioRef.current;
    if (!el) return;
    const url = currentAudioUrl || '';
    if (url) {
      if (el.getAttribute('src') !== url) {
        // Re-arm the CORS fallback for a fresh source only if we never routed it.
        if (!masterConnectedElRef.current) {
          webAudioBypassRef.current = false;
          try { el.setAttribute('crossorigin', 'anonymous'); } catch {}
        }
        el.src = url;
        el.load();
      }
      el.volume = webAudioBypassRef.current ? masterVolumeRef.current : 1;
    } else if (el.getAttribute('src')) {
      try { el.removeAttribute('src'); el.load(); } catch {}
    }
  }, [currentAudioUrl]);

  // Decode real waveform peaks for the loaded master (used by Master Room /
  // Comparar instead of the synthetic placeholder bars).
  useEffect(() => {
    let cancelled = false;
    if (!currentAudioUrl) { setMasterPeaks([]); return; }
    const ctx = getAudioCtx();
    decodePeaks(ctx, currentAudioUrl, 200)
      .then((peaks) => { if (!cancelled) setMasterPeaks(peaks); })
      .catch(() => { if (!cancelled) setMasterPeaks([]); });
    return () => { cancelled = true; };
  }, [currentAudioUrl, getAudioCtx]);

  // Reset integrated loudness whenever the source changes.
  useEffect(() => {
    loudnessRef.current?.reset();
    setMeter({ integratedLufs: -70, truePeakDb: -70, momentaryLufs: -70 });
  }, [currentAudioUrl]);

  // Reconcile the per-track stem players (recorded takes, AI stems, imported
  // layers). Each stem gets its own DSP channel so per-track mute / solo /
  // volume / plugins affect real playback, mixed under the shared master bus.
  useEffect(() => {
    const parts = stemPartsRef.current;
    const desired = new Map<string, string>();
    for (const t of tracks) {
      if (t.audioUrl && t.audioUrl !== currentAudioUrl) desired.set(t.id, t.audioUrl);
    }
    // Ensure the audio graph exists before wiring stem channels.
    let ctx = audioCtxRef.current;
    if (!ctx && desired.size > 0) ctx = getAudioCtx();
    const bus = masterGainRef.current;

    // Drop stems that are gone or whose source changed.
    for (const [trackId, part] of Array.from(parts.entries())) {
      if (!desired.has(trackId) || desired.get(trackId) !== part.url) {
        try { part.el.pause(); } catch {}
        try { part.strip?.disconnect(); } catch {}
        try { part.el.removeAttribute('src'); part.el.load(); } catch {}
        parts.delete(trackId);
      }
    }

    // Add freshly introduced stems.
    for (const [trackId, url] of Array.from(desired.entries())) {
      if (parts.has(trackId)) continue;
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.src = url;
      let strip: ChannelStrip | null = null;
      if (ctx && bus) {
        try {
          const src = ctx.createMediaElementSource(el);
          strip = new ChannelStrip(ctx, { bpm });
          strip.output.connect(bus);
          src.connect(strip.input);
        } catch { strip = null; }
      }
      parts.set(trackId, { el, strip, url });
      if (isPlaying) {
        try { el.currentTime = audioRef.current?.currentTime ?? 0; void el.play().catch(() => {}); } catch {}
      }
    }
  }, [tracks, currentAudioUrl, isPlaying, getAudioCtx, bpm]);

  // Apply the live mix (mute / solo / volume / pan / plugins) to every channel.
  useEffect(() => {
    const soloActive = tracks.some((t) => t.solo);
    // Stem channels.
    for (const t of tracks) {
      const part = stemPartsRef.current.get(t.id);
      if (!part) continue;
      const audible = soloActive ? t.solo : !t.mute;
      const level = audible ? Math.max(0, Math.min(1, t.vol / 100)) : 0;
      if (part.strip) {
        part.strip.setBpm(bpm);
        part.strip.setPan((t.pan || 0) / 50);
        part.strip.setGain(level, true);
        part.strip.applyPlugins((pluginsByTrack[t.id] || []) as PluginLike[]);
      } else {
        part.el.volume = level;
      }
      part.el.muted = !audible && !part.strip;
    }
    // Master channel: honour the matching track's mute/solo (or dim when soloed
    // elsewhere) and apply that track's DSP chain to the mixed master.
    const masterTrack = tracks.find((t) => t.audioUrl && t.audioUrl === currentAudioUrl);
    let masterAudible = true;
    if (masterTrack) masterAudible = soloActive ? masterTrack.solo : !masterTrack.mute;
    else if (soloActive) masterAudible = false;
    const strip = masterStripRef.current;
    if (strip) {
      strip.setBpm(bpm);
      if (masterTrack) {
        strip.setPan((masterTrack.pan || 0) / 50);
        strip.setGain(masterAudible ? Math.max(0, Math.min(1, masterTrack.vol / 100)) : 0, true);
        strip.applyPlugins((pluginsByTrack[masterTrack.id] || []) as PluginLike[]);
      } else {
        strip.setGain(masterAudible ? 1 : 0, true);
      }
    }
    if (audioRef.current) audioRef.current.muted = !masterAudible && webAudioBypassRef.current;
  }, [tracks, currentAudioUrl, pluginsByTrack, bpm]);

  // Clean up the entire audio engine on unmount.
  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current);
    stemPartsRef.current.forEach(({ el, strip }) => {
      try { el.pause(); } catch {}
      try { strip?.disconnect(); } catch {}
    });
    stemPartsRef.current.clear();
    try { masterStripRef.current?.disconnect(); } catch {}
    try { masterSourceRef.current?.disconnect(); } catch {}
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
  }, []);

  // Mobile panel tabs
  const MOBILE_TABS = [
    { id: 'timeline', label: 'Timeline', icon: Layers },
    { id: 'vocal', label: 'Vocal', icon: Mic2 },
    { id: 'mixer', label: 'Mixer', icon: Sliders },
    { id: 'ai', label: 'AI Lab', icon: Sparkles },
    { id: 'release', label: 'Release', icon: Megaphone },
  ] as const;

  const renderTracksPanel = () => (
    <TracksPanel
      tracks={tracks}
      levels={levels}
      setTracks={setTracks}
      onAddTrack={handleAddTrack}
      selectedTrackId={selectedTrackId}
      onSelectTrack={setSelectedTrackId}
      onRenameTrack={handleRenameTrack}
      onTrackContextMenu={setTrackMenu}
    />
  );

  const renderTimeline = () => (
    <Timeline
      tracks={tracks}
      clips={clips}
      selectedClipId={selectedClipId}
      editorTool={editorTool}
      playhead={playhead}
      gridOn={gridOn}
      snapOn={snapOn}
      quantize={quantize}
      onTool={handleTimelineTool}
      onSeekClick={handleSeek}
      onClipSelect={setSelectedClipId}
      onClipUpdate={handleClipUpdate}
      onClipSplit={handleSplitClip}
      onClipContextMenu={setClipMenu}
      onClipDuplicate={handleDuplicateClip}
      onClipDelete={handleDeleteClip}
      onClipRename={handleRenameClip}
    />
  );

  const renderAgentsPanel = () => (
    <AgentsPanel
      onAgentRun={handleAgent}
      onQuickAction={handleQuick}
      runningAgent={runningAgent}
      runningAction={runningAction}
    />
  );

  const renderVocalBooth = () => (
    <VocalBooth
      tracks={tracks}
      clips={clips}
      track={selectedTrack}
      selectedClipId={selectedClipId}
      settings={vocalSettings}
      onSettingsChange={(patch) => setVocalSettings((current) => ({ ...current, ...patch }))}
      onTool={handleVocalTool}
      isRecording={isRecording}
      onStartRecording={handleStartRecording}
      onStopRecording={handleStopRecording}
      recordingTime={recordingTime}
      recordedUrl={recordedUrl}
      lyrics={lyrics}
      onShowLyrics={() => setShowLyricsPanel(true)}
      onTrackSelect={setSelectedTrackId}
      onArmTrack={handleArmTrack}
      onTakeSelect={setSelectedClipId}
      onTakeMute={handleToggleClipMute}
      onTakeDuplicate={handleDuplicateClip}
      onTakeDelete={handleDeleteClip}
      onTakeRename={handleRenameClip}
      onSaveSession={() => saveMut.mutate()}
      plugins={selectedTrackPlugins}
      levels={levels}
      bpm={bpm}
      keyName={keyName}
      projectName={projectName}
    />
  );

  const renderPluginRack = () => (
    <PluginRack
      track={selectedTrack}
      plugins={selectedTrackPlugins}
      onTogglePlugin={handleToggleSelectedPlugin}
      onParamChange={handlePluginParamChange}
      onAddPlugin={handleAddPluginToSelectedTrack}
    />
  );

  const renderMixerConsole = () => (
    <MixerConsole
      tracks={tracks}
      levels={levels}
      selectedTrackId={selectedTrackId}
      pluginsByTrack={pluginsByTrack}
      masterChain={masterChain}
      onSelectTrack={setSelectedTrackId}
      onUpdateTrack={handleUpdateTrackMixer}
      onToggleTrack={handleToggleTrackMixer}
      onRenameTrack={handleRenameTrack}
      onAddTrack={handleAddTrack}
      onMasterChange={(patch) => setMasterChain((current) => ({ ...current, ...patch }))}
    />
  );

  const renderAiLab = () => (
    <AILabPanel
      tracks={tracks}
      selectedTrackId={selectedTrackId}
      selectedClip={selectedClip}
      projectName={projectName}
      bpm={bpm}
      keyName={keyName}
      settings={aiLabSettings}
      lastResult={lastAiResult}
      onSettingsChange={(patch) => setAiLabSettings((current) => ({ ...current, ...patch }))}
      onGenerate={handleGenerate}
      generating={generating}
      generatedUrl={generatedUrl}
    />
  );

  const renderExportPanel = () => (
    <ExportarPanel formats={exportFormats} onToggleFormat={(id) => setExportFormats((f) => f.map((x) => x.id === id ? { ...x, active: !x.active } : x))} onExportAll={handleExport} exporting={exporting} />
  );

  const toggleMsPanel = (id: string) => {
    setMsActivePanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('ms-active-panels', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // ── Floating window callbacks ─────────────────────────────────
  const focusFloatWin = useCallback((id: string) => {
    floatZTopRef.current += 1;
    setFloatWins(prev => ({ ...prev, [id]: { ...prev[id], z: floatZTopRef.current } }));
  }, []);

  const toggleMinimizeWin = useCallback((id: string) => {
    setFloatWins(prev => {
      const next = { ...prev, [id]: { ...prev[id], minimized: !prev[id].minimized } };
      try { localStorage.setItem('ms-float-wins-v1', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const startFloatDrag = useCallback((e: React.MouseEvent, id: string) => {
    const win = floatWins[id];
    if (!win) return;
    floatDragRef.current = { id, type: 'move', edge: '', startX: e.clientX, startY: e.clientY, startVal: { x: win.x, y: win.y, w: win.w, h: win.h } };
    document.body.style.cursor = 'grabbing';
    e.preventDefault();
    focusFloatWin(id);
  }, [floatWins, focusFloatWin]);

  const startFloatResize = useCallback((e: React.MouseEvent, id: string, edge: string) => {
    const win = floatWins[id];
    if (!win) return;
    floatDragRef.current = { id, type: 'resize', edge, startX: e.clientX, startY: e.clientY, startVal: { x: win.x, y: win.y, w: win.w, h: win.h } };
    const cursorMap: Record<string, string> = { s: 's-resize', e: 'e-resize', w: 'w-resize', se: 'se-resize', sw: 'sw-resize', ne: 'ne-resize' };
    document.body.style.cursor = cursorMap[edge] || 'nwse-resize';
    e.preventDefault();
  }, [floatWins]);

  const tileFloatLayout = useCallback(() => {
    const rect = studioContainerRef.current?.getBoundingClientRect();
    const W = rect ? rect.width : 1280;
    const H = rect ? rect.height - 36 : 640; // minus control bar
    const trackW = Math.round(W * 0.16);
    const agentW = Math.round(W * 0.22);
    const centerW = W - trackW - agentW - 8;
    const topH = Math.round(H * 0.44);
    const midH = Math.round(H * 0.3);
    const botH = H - topH - midH - 8;
    const tiled: Record<string, FloatWin> = {
      tracks:   { x: 0,                     y: 0,         w: trackW,                     h: topH,  minimized: false, z: 1 },
      timeline: { x: trackW + 4,             y: 0,         w: centerW,                    h: topH,  minimized: false, z: 2 },
      agents:   { x: trackW + centerW + 8,   y: 0,         w: agentW,                     h: topH,  minimized: false, z: 3 },
      vocal:    { x: 0,                     y: topH + 4,  w: Math.round(W * 0.25),        h: midH,  minimized: false, z: 4 },
      plugin:   { x: Math.round(W * 0.25) + 4, y: topH + 4, w: Math.round(W * 0.22),     h: midH,  minimized: false, z: 5 },
      ai:       { x: Math.round(W * 0.47) + 4, y: topH + 4, w: W - Math.round(W * 0.47), h: midH,  minimized: false, z: 6 },
      mixer:    { x: 0,                     y: topH + midH + 8, w: Math.round(W * 0.62),  h: botH,  minimized: false, z: 7 },
      master:   { x: Math.round(W * 0.62) + 4, y: topH + midH + 8, w: W - Math.round(W * 0.62), h: botH, minimized: false, z: 8 },
    };
    setFloatWins(tiled);
    floatZTopRef.current = 8;
    try { localStorage.setItem('ms-float-wins-v1', JSON.stringify(tiled)); } catch {}
  }, []);

  const showAllFloatWins = useCallback(() => {
    setFloatWins(prev => {
      const next = Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, minimized: false }]));
      try { localStorage.setItem('ms-float-wins-v1', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetFloatLayout = useCallback(() => {
    setFloatWins({ ...FLOAT_WIN_DEFAULTS });
    floatZTopRef.current = 10;
    try { localStorage.removeItem('ms-float-wins-v1'); } catch {}
  }, []);

  // ── Auto-tile floating windows on first load (no saved layout) ─
  useEffect(() => {
    const hasSaved = (() => { try { return !!localStorage.getItem('ms-float-wins-v1'); } catch { return false; } })();
    if (!hasSaved) {
      const raf = requestAnimationFrame(() => tileFloatLayout());
      return () => cancelAnimationFrame(raf);
    }
  }, [tileFloatLayout]);

  // ── Auto-retile on window resize while in studio mode ──────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (studioContainerRef.current) {
          const rect = studioContainerRef.current.getBoundingClientRect();
          if (rect.width > 0) tileFloatLayout();
        }
      }, 300);
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(timer); };
  }, [tileFloatLayout]);

  const renderDesktopWorkspace = () => {
    if (activeSection === 'projects') {
      return <ProjectsPanel projects={libraryArtist ? libraryArtistProjects : projects} loading={projectsQuery.isLoading} contextLabel={libraryArtist ? `Proyectos de ${libraryArtist.name}` : 'Mis Proyectos'} currentProjectId={currentProjectId} onLoad={handleLoadProject} onNew={() => { handleNewProject(); setActiveSection('studio'); }} onClose={() => setActiveSection('studio')} />;
    }
    if (activeSection === 'settings') {
      return <SettingsPanel bpm={bpm} keyName={keyName} projectName={projectName} artistName={selectedArtist?.name || user?.firstName || '—'} userTier={userSubscription || 'free'} onClose={() => setActiveSection('studio')} />;
    }
    if (activeSection === 'ai-lab') {
      return (
        <div className="flex-1 min-w-0 bg-[#0a0a0d] grid grid-cols-[minmax(0,1fr)_300px] gap-2 p-2 overflow-hidden">
          <div className="min-w-0 min-h-0 flex flex-col gap-2 overflow-hidden">
            {renderAiLab()}
            <div className="flex-1 min-h-[260px] rounded-lg overflow-hidden border border-white/5">{renderTimeline()}</div>
          </div>
          {renderAgentsPanel()}
        </div>
      );
    }
    if (activeSection === 'vocal') {
      return (
        <div className="flex-1 min-w-0 bg-[#0a0a0d] flex overflow-hidden">
          <div className="w-[150px] md:w-[190px] xl:w-[280px] shrink-0 h-full">{renderTracksPanel()}</div>
          <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2 p-2 overflow-hidden">
            <div className="grid grid-cols-2 gap-2 shrink-0">{renderVocalBooth()}{renderPluginRack()}</div>
            <div className="flex-1 min-h-[260px] rounded-lg overflow-hidden border border-white/5">{renderTimeline()}</div>
          </div>
        </div>
      );
    }
    if (activeSection === 'mix') {
      return (
        <div className="flex-1 min-w-0 bg-[#0a0a0d] overflow-y-auto p-2 space-y-2">
          {renderMixerConsole()}
          <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-2">{renderPluginRack()}{renderVocalBooth()}</div>
        </div>
      );
    }
    if (activeSection === 'master') {
      return (
        <div className="flex-1 min-w-0 bg-[#0a0a0d] overflow-y-auto p-2 space-y-2">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2"><MasterRoom peaks={masterPeaks} durationLabel={masterDurationLabel} /><Loudness meter={meter} /><Comparar peaks={masterPeaks} />{renderExportPanel()}</div>
          {renderMixerConsole()}
          {renderPluginRack()}
        </div>
      );
    }
    if (activeSection === 'release') {
      return (
        <div className="flex-1 min-w-0 bg-[#0a0a0d] overflow-y-auto p-2 space-y-2">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2"><MasterRoom peaks={masterPeaks} durationLabel={masterDurationLabel} /><Loudness meter={meter} /><Comparar peaks={masterPeaks} />{renderExportPanel()}</div>
          <ReleaseRoom onTile={handleTile} />
          <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-2">{renderAiLab()}{renderAgentsPanel()}</div>
        </div>
      );
    }
    // Default: Studio — fully free-floating window layout
    return (
      <div ref={studioContainerRef} className="flex-1 min-w-0 relative overflow-hidden bg-[#080810] flex flex-col">

        {/* ── Floating window canvas ── */}
        <div className="flex-1 relative overflow-hidden">
          {FLOAT_WIN_DEFS.map(({ id, title, Icon, color, minW, minH }) => (
            <FloatingPanel
              key={id} id={id} title={title} Icon={Icon} color={color}
              config={floatWins[id] ?? FLOAT_WIN_DEFAULTS[id]}
              onFocus={focusFloatWin}
              onDragStart={startFloatDrag}
              onResizeStart={startFloatResize}
              onToggleMinimize={toggleMinimizeWin}
              minW={minW}
            >
              {id === 'tracks'   && renderTracksPanel()}
              {id === 'timeline' && renderTimeline()}
              {id === 'agents'   && renderAgentsPanel()}
              {id === 'vocal'    && renderVocalBooth()}
              {id === 'plugin'   && renderPluginRack()}
              {id === 'ai'       && renderAiLab()}
              {id === 'mixer'    && renderMixerConsole()}
              {id === 'master'   && (
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_2fr] gap-1.5 p-1.5">
                  <MasterRoom peaks={masterPeaks} durationLabel={masterDurationLabel} /><Loudness meter={meter} /><Comparar peaks={masterPeaks} />{renderExportPanel()}<ReleaseRoom onTile={handleTile} />
                </div>
              )}
            </FloatingPanel>
          ))}
        </div>

        {/* ── Control bar at bottom ── */}
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#0d0d10]/95 border-t border-white/5 flex-wrap backdrop-blur-sm" style={{ zIndex: 9999 }}>
          {/* Window toggle pills */}
          {FLOAT_WIN_DEFS.map(({ id, title, Icon, color }) => {
            const win = floatWins[id] ?? FLOAT_WIN_DEFAULTS[id];
            const active = !win.minimized;
            return (
              <button
                key={id}
                onClick={() => { toggleMinimizeWin(id); focusFloatWin(id); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all border"
                style={{
                  background: active ? `${color}14` : 'rgba(255,255,255,0.03)',
                  color: active ? color : '#374151',
                  borderColor: active ? `${color}35` : 'rgba(255,255,255,0.07)',
                }}
                title={active ? `Minimizar ${title}` : `Restaurar ${title}`}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{title}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          {/* Action buttons */}
          <button
            onClick={showAllFloatWins}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all hover:text-orange-300 hover:border-orange-400/30"
            style={{ color: '#6b7280', borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
            title="Mostrar todas las ventanas"
          >
            <ChevronDown className="w-3 h-3" /> Mostrar todo
          </button>
          <button
            onClick={tileFloatLayout}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all hover:text-purple-300 hover:border-purple-400/30"
            style={{ color: '#6b7280', borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
            title="Distribuir ventanas en cuadrícula"
          >
            <Layers className="w-3 h-3" /> Tile
          </button>
          <button
            onClick={resetFloatLayout}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all hover:text-red-300 hover:border-red-400/30"
            style={{ color: '#6b7280', borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
            title="Restaurar layout por defecto"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#0a0a0d] text-zinc-200 flex flex-col w-full h-[calc(100vh-80px)] xl:min-h-[600px] min-h-0 rounded-lg overflow-hidden border border-white/5 relative">
      {/* Persistent master audio element — always mounted so the Web Audio
          graph (and its MediaElementSource) survives source changes. */}
      <audio
        data-mini-studio="true"
        ref={audioRef}
        crossOrigin="anonymous"
        preload="auto"
        onError={handleMasterError}
        onLoadedMetadata={() => { if (audioRef.current) setMasterDuration(audioRef.current.duration || 0); }}
        onDurationChange={() => { if (audioRef.current) setMasterDuration(audioRef.current.duration || 0); }}
        onEnded={() => { setIsPlaying(false); setPlayhead(0); setCurrentTime(0); }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if (audioRef.current.duration) setPlayhead((audioRef.current.currentTime / audioRef.current.duration) * 100);
          }
        }}
        className="hidden"
      />

      {/* Keyboard shortcuts modal */}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {renameDialog && <RenameDialog dialog={renameDialog} onClose={() => setRenameDialog(null)} onSubmit={handleRenameSubmit} />}
      {/* Lyrics panel modal */}
      {showLyricsPanel && (
        <LyricsPanel
          lyrics={lyrics}
          generating={lyricsGenerating}
          projectName={projectName}
          onClose={() => setShowLyricsPanel(false)}
          onGenerate={handleGenerateLyrics}
          onRewrite={handleRewriteLyrics}
          onApply={(text) => setLyrics(text)}
        />
      )}
      {clipMenu && (
        <ClipContextMenu
          menu={clipMenu}
          clip={clips.find((clip) => clip.id === clipMenu.clipId) || null}
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          playhead={playhead}
          onClose={() => setClipMenu(null)}
          onSplit={handleSplitClip}
          onDuplicate={handleDuplicateClip}
          onDelete={handleDeleteClip}
          onRename={handleRenameClip}
          onToggleMute={handleToggleClipMute}
          onMoveToTrack={handleMoveClipToTrack}
          onSetTool={setEditorTool}
          onAlignToPlayhead={handleAlignClipToPlayhead}
        />
      )}
      {trackMenu && (
        <TrackContextMenu
          menu={trackMenu}
          track={tracks.find((track) => track.id === trackMenu.trackId) || null}
          onClose={() => setTrackMenu(null)}
          onRename={handleRenameTrack}
          onArm={handleArmTrack}
          onMute={handleMuteTrack}
          onSolo={handleSoloTrack}
          onRecordHere={handleRecordOnTrack}
          onDuplicate={handleDuplicateTrack}
          onDelete={handleDeleteTrack}
        />
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="absolute left-0 right-0 bottom-0 top-0 z-[80] flex xl:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative z-10 h-full shadow-2xl shadow-black/50"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              paddingLeft: 'env(safe-area-inset-left, 0px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar activeSection={activeSection} onSelect={handleSidebarSelect} />
          </div>
        </div>
      )}

      <TopBar
        projectName={projectName}
        artistName={selectedArtist?.name || PROJECT.user.name}
        songTitle={selectedSong?.title || selectedSong?.name}
        isPlaying={isPlaying}
        isRecording={isRecording}
        onPlay={handlePlay}
        onStop={handleStop}
        onRecord={handleRecord}
        onRewind={handleRewind}
        onForward={handleForward}
        onNew={handleNewProject}
        onMaximize={handleMaximize}
        onSave={() => saveMut.mutate()}
        onExport={handleExport}
        onRelease={() => releaseMut.mutate()}
        saving={saveMut.isPending}
        releasing={releaseMut.isPending}
        currentTime={currentTime}
        bpm={bpm}
        keyName={keyName}
        onBpmChange={setBpm}
        onKeyChange={handleKeyChange}
        onProjectNameChange={setProjectName}
        onShowShortcuts={() => setShowShortcuts(true)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        userTier={userSubscription || undefined}
        userInitials={(user?.firstName?.[0] || user?.username?.[0] || selectedArtist?.name?.[0] || 'A').toUpperCase()}
      />

      <ArtistLibraryPanel
        artists={artists}
        songs={allSongs}
        projects={projects}
        currentProjectId={currentProjectId}
        selectedArtistId={libraryArtist?.id || libraryArtistId}
        selectedSongId={selectedSong?.id || selectedSongId}
        loading={libraryQuery.isLoading}
        onArtistChange={(id) => { setLibraryArtistId(id); if (!currentProjectId) setSelectedArtistId(id); }}
        onSongLoad={handleLoadSong}
        onProjectLoad={handleLoadProject}
        onRefresh={() => libraryQuery.refetch()}
        onImportFiles={handleImportFiles}
      />

      {/* Audio player bar — shown when song loaded */}
      {currentAudioUrl && (
        <AudioPlayer
          audioUrl={currentAudioUrl}
          songTitle={selectedSong?.title || selectedSong?.name || projectName}
          artistName={selectedArtist?.name || '—'}
          isPlaying={isPlaying}
          onSeek={handleSeekByFraction}
          onVolumeChange={handleVolumeChange}
          audioRef={audioRef}
        />
      )}

      {/* Desktop layout */}
      <div className="hidden xl:flex flex-1 min-h-0">
        <Sidebar activeSection={activeSection} onSelect={handleSidebarSelect} />
        {renderDesktopWorkspace()}
      </div>

      {/* Mobile/tablet layout */}
      <div className="xl:hidden flex flex-1 min-h-0 flex-col overflow-hidden">
        {activeSection === 'projects' && (
          <ProjectsPanel
            projects={libraryArtist ? libraryArtistProjects : projects}
            loading={projectsQuery.isLoading}
            contextLabel={libraryArtist ? `Proyectos de ${libraryArtist.name}` : 'Mis Proyectos'}
            currentProjectId={currentProjectId}
            onLoad={handleLoadProject}
            onNew={() => { handleNewProject(); setActiveSection('studio'); setMobilePanel('timeline'); }}
            onClose={() => setActiveSection('studio')}
          />
        )}
        {activeSection === 'settings' && (
          <SettingsPanel
            bpm={bpm}
            keyName={keyName}
            projectName={projectName}
            artistName={selectedArtist?.name || user?.firstName || '—'}
            userTier={userSubscription || 'free'}
            onClose={() => setActiveSection('studio')}
          />
        )}

        {/* Timeline tab */}
        {!['projects','settings'].includes(activeSection) && mobilePanel === 'timeline' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="w-[150px] md:w-[190px] shrink-0 h-full">{renderTracksPanel()}</div>
            <div className="flex-1 min-w-0 overflow-hidden">{renderTimeline()}</div>
          </div>
        )}

        {/* Vocal Booth tab */}
        {!['projects','settings'].includes(activeSection) && mobilePanel === 'vocal' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {renderVocalBooth()}
            {renderPluginRack()}
          </div>
        )}

        {/* Mixer tab */}
        {!['projects','settings'].includes(activeSection) && mobilePanel === 'mixer' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {renderMixerConsole()}
          </div>
        )}

        {/* AI Lab tab */}
        {!['projects','settings'].includes(activeSection) && mobilePanel === 'ai' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {renderAiLab()}
            {renderAgentsPanel()}
          </div>
        )}

        {/* Release tab */}
        {!['projects','settings'].includes(activeSection) && mobilePanel === 'release' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <MasterRoom peaks={masterPeaks} durationLabel={masterDurationLabel} />
              <Loudness meter={meter} />
              <Comparar peaks={masterPeaks} />
              {renderExportPanel()}
              <div className="col-span-2"><ReleaseRoom onTile={handleTile} /></div>
            </div>
          </div>
        )}

        {/* Mobile tab bar */}
        <div
          className="bg-[#0d0d10] border-t border-white/10 flex items-center justify-around px-1 shrink-0"
          style={{ height: '56px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {MOBILE_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setMobilePanel(id as typeof mobilePanel);
                if (id === 'ai') setActiveSection('ai-lab');
                else if (id === 'mixer') setActiveSection('mix');
                else if (id === 'release') setActiveSection('release');
                else if (id === 'vocal') setActiveSection('vocal');
                else setActiveSection('studio');
              }}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[44px] ${mobilePanel === id ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-500'}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold leading-none">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop bottom panels are now managed inside renderDesktopWorkspace */}
    </div>
  );
}

export default MiniStudio;
