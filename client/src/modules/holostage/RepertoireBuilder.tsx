// ─── RepertoireBuilder ────────────────────────────────────────────────────────
// Professional setlist builder for HoloStage shows.
// Features:
//   • Add / edit / delete / duplicate songs
//   • Inline editing: title, artist, duration, BPM, key, audioUrl, coverUrl
//   • BPM tap tempo detector
//   • Musical key picker (all 12 keys × maj/min)
//   • Per-song performance mode (live / hybrid / playback)
//   • Song sections editor → populates waveform colour bands in SongTimelineEditor
//   • Cue count badge per song
//   • Move-up / move-down reorder
//   • Show stats: total time, avg BPM, cue count

import React, { useState, useRef, useCallback } from 'react';
import {
  Music, Plus, Trash2, Clock, Hash, ChevronUp, ChevronDown,
  Copy, Link, Mic2, Layers, Radio, ChevronRight, ChevronDown as ChevDown,
  Zap, X,
} from 'lucide-react';
import { useHoloLang } from './holoLangContext';
import type { ShowSong, SongSection, SectionType } from '../../schemas/holostage/showPackage.schema';
import type { TimelineCue } from '../../schemas/holostage/timelineCue.schema';
import { formatTime } from '../../services/holostage/audioSyncEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_TYPES: SectionType[] = [
  'intro', 'verse', 'pre_chorus', 'chorus', 'bridge',
  'outro', 'solo', 'dance_break', 'crowd_interaction', 'instrumental',
];

const SECTION_LABELS: Record<SectionType, string> = {
  intro:             'Intro',
  verse:             'Verse',
  pre_chorus:        'Pre-Chorus',
  chorus:            'Chorus',
  bridge:            'Bridge',
  outro:             'Outro',
  solo:              'Solo',
  dance_break:       'Dance Break',
  crowd_interaction: 'Crowd',
  instrumental:      'Instrumental',
};

const SECTION_COLORS: Record<SectionType, string> = {
  intro:             '#3b82f6',
  verse:             '#6b7280',
  pre_chorus:        '#a855f7',
  chorus:            '#f97316',
  bridge:            '#14b8a6',
  outro:             '#ef4444',
  solo:              '#eab308',
  dance_break:       '#ec4899',
  crowd_interaction: '#10b981',
  instrumental:      '#6366f1',
};

const MUSICAL_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
  'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
];

const PERFORMANCE_MODES = [
  { value: 'live',     label: 'Live',     desc: 'Full mocap' },
  { value: 'hybrid',   label: 'Hybrid',   desc: 'Mocap + playback' },
  { value: 'playback', label: 'Playback', desc: 'Pre-recorded' },
] as const;

const BPM_GRADIENT = (bpm: number) => {
  if (bpm < 80)  return '#3b82f6';
  if (bpm < 110) return '#10b981';
  if (bpm < 140) return '#f97316';
  return '#ef4444';
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface RepertoireBuilderProps {
  songs: ShowSong[];
  onChange: (songs: ShowSong[]) => void;
  cues?: TimelineCue[];
  currentSongId?: string | null;
  onSelectSong?: (songId: string) => void;
}

// ─── BPM Tap ─────────────────────────────────────────────────────────────────

function useBpmTap() {
  const taps = useRef<number[]>([]);
  const tap = useCallback((): number => {
    const now = performance.now();
    taps.current.push(now);
    if (taps.current.length > 8) taps.current.shift();
    if (taps.current.length < 2) return 0;
    const diffs = taps.current.slice(1).map((t, i) => t - taps.current[i]);
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return Math.round(60000 / avg);
  }, []);
  return { tap };
}

// ─── Sections Editor ─────────────────────────────────────────────────────────

function SectionsEditor({
  song,
  onUpdate,
}: {
  song: ShowSong;
  onUpdate: (s: ShowSong) => void;
}) {
  const sections = song.sections ?? [];

  const addSection = () => {
    const lastEnd = sections.length > 0 ? sections[sections.length - 1].end : 0;
    const newSection: SongSection = {
      name: 'verse',
      start: lastEnd,
      end: Math.min(lastEnd + 30, song.duration),
    };
    onUpdate({ ...song, sections: [...sections, newSection] });
  };

  const updateSection = (idx: number, patch: Partial<SongSection>) => {
    const next = sections.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onUpdate({ ...song, sections: next });
  };

  const removeSection = (idx: number) => {
    onUpdate({ ...song, sections: sections.filter((_, i) => i !== idx) });
  };

  const autoDistribute = () => {
    const flow: SectionType[] = ['intro', 'verse', 'pre_chorus', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro'];
    const seg = song.duration / flow.length;
    const auto: SongSection[] = flow.map((name, i) => ({
      name,
      start: Math.round(i * seg * 10) / 10,
      end: Math.round((i + 1) * seg * 10) / 10,
    }));
    onUpdate({ ...song, sections: auto });
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sections</span>
        <div className="flex gap-1">
          <button
            onClick={autoDistribute}
            className="text-xs px-2 py-0.5 rounded transition-colors"
            style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}
            title="Auto-distribute standard song structure"
          >
            Auto
          </button>
          <button
            onClick={addSection}
            className="text-xs px-2 py-0.5 rounded transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Visual section bar */}
      {sections.length > 0 && (
        <div className="relative h-5 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {sections.map((sec, i) => {
            const left = (sec.start / song.duration) * 100;
            const width = ((sec.end - sec.start) / song.duration) * 100;
            const col = SECTION_COLORS[sec.name as SectionType] ?? '#6b7280';
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 flex items-center justify-center"
                style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%`, background: col + '55', borderLeft: `1px solid ${col}88` }}
                title={`${sec.label ?? SECTION_LABELS[sec.name as SectionType] ?? String(sec.name)}: ${formatTime(sec.start)}–${formatTime(sec.end)}`}
              >
                <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                  {(sec.label ?? SECTION_LABELS[sec.name as SectionType] ?? String(sec.name)).substring(0, 4)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {sections.length === 0 && (
        <p className="text-xs text-gray-700 italic">Sin secciones — usa Auto o + Add</p>
      )}

      {/* Section rows */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {sections.map((sec, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SECTION_COLORS[sec.name as SectionType] ?? '#6b7280' }} />
            <select
              value={sec.name}
              onChange={e => updateSection(i, { name: e.target.value as SectionType })}
              className="bg-black/60 border rounded px-1 py-0.5 text-xs text-white outline-none shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.1)', minWidth: 86 }}
            >
              {SECTION_TYPES.map(st => (
                <option key={st} value={st}>{SECTION_LABELS[st]}</option>
              ))}
            </select>
            <input type="number" min="0" max={song.duration} step="0.5"
              value={sec.start}
              onChange={e => updateSection(i, { start: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-12 bg-black/60 border rounded px-1 py-0.5 text-xs text-white outline-none text-center"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }} title="Start (s)"
            />
            <span className="text-gray-700 text-xs">→</span>
            <input type="number" min="0" max={song.duration} step="0.5"
              value={sec.end}
              onChange={e => updateSection(i, { end: Math.min(song.duration, parseFloat(e.target.value) || 0) })}
              className="w-12 bg-black/60 border rounded px-1 py-0.5 text-xs text-white outline-none text-center"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }} title="End (s)"
            />
            <input type="text"
              value={sec.label ?? ''}
              onChange={e => updateSection(i, { label: e.target.value || undefined })}
              placeholder="Label…"
              className="flex-1 min-w-0 bg-black/60 border rounded px-1 py-0.5 text-xs text-white placeholder-gray-700 outline-none"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            />
            <button onClick={() => removeSection(i)} className="shrink-0 text-gray-700 hover:text-red-400 transition-colors">
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Song Row ─────────────────────────────────────────────────────────────────

function SongRow({
  song, index, total, isActive, cueCount,
  onRemove, onUpdate, onDuplicate, onMoveUp, onMoveDown, onClick,
}: {
  song: ShowSong; index: number; total: number; isActive: boolean; cueCount: number;
  onRemove: () => void; onUpdate: (s: ShowSong) => void; onDuplicate: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onClick: () => void;
}) {
  const { t } = useHoloLang();
  const [expanded, setExpanded] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const { tap: tapBpm } = useBpmTap();
  const bpmColor = BPM_GRADIENT(song.bpm);

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        background: isActive ? 'rgba(249,115,22,0.07)' : 'rgba(255,255,255,0.02)',
        borderColor: isActive ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Main row ── */}
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={onClick}>
        {/* Order */}
        <div className="flex flex-col items-center text-xs text-gray-700 shrink-0 w-6">
          <button onClick={e => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0} className="hover:text-gray-400 disabled:opacity-20 transition-colors"><ChevronUp className="w-3 h-3" /></button>
          <span className="font-mono text-gray-600">{index + 1}</span>
          <button onClick={e => { e.stopPropagation(); onMoveDown(); }} disabled={index === total - 1} className="hover:text-gray-400 disabled:opacity-20 transition-colors"><ChevronDown className="w-3 h-3" /></button>
        </div>

        {/* Cover / icon */}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ background: isActive ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.05)' }}>
          {song.coverUrl
            ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
            : <Music className="w-4 h-4" style={{ color: isActive ? '#f97316' : '#6b7280' }} />
          }
        </div>

        {/* Title / artist */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{song.title || t('rep_untitled')}</p>
          <p className="text-xs text-gray-500 truncate">{song.artist || '—'}{song.key ? ` · ${song.key}` : ''}</p>
        </div>

        {/* Stats */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3 h-3" />{formatTime(song.duration)}</span>
          <span className="flex items-center gap-1 text-xs font-mono" style={{ color: bpmColor }}><Hash className="w-3 h-3" />{song.bpm}</span>
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {cueCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: 9 }} title={`${cueCount} cues`}>{cueCount}Q</span>
          )}
          {(song.sections?.length ?? 0) > 0 && (
            <span className="px-1 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontSize: 9 }} title={`${song.sections!.length} sections`}>§{song.sections!.length}</span>
          )}
          {song.audioUrl && (
            <span className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: 9 }} title="Audio linked">♫</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => setExpanded(v => !v)} className="p-1 rounded text-gray-600 hover:text-white transition-colors" title="Edit">
            {expanded ? <ChevDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <button onClick={onDuplicate} className="p-1 rounded text-gray-700 hover:text-gray-300 transition-colors" title="Duplicate"><Copy className="w-3 h-3" /></button>
          <button onClick={onRemove} className="p-1 rounded text-gray-700 hover:text-red-400 transition-colors" title="Remove"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {/* ── Expanded edit form ── */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="col-span-2">
              <label className="text-xs text-gray-600 block mb-1">Título</label>
              <input value={song.title} onChange={e => onUpdate({ ...song, title: e.target.value })} placeholder={t('rep_title_req')}
                className="w-full bg-black/60 border rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Artista</label>
              <input value={song.artist} onChange={e => onUpdate({ ...song, artist: e.target.value })} placeholder="Artista"
                className="w-full bg-black/60 border rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Tonalidad</label>
              <select value={song.key ?? ''} onChange={e => onUpdate({ ...song, key: e.target.value || undefined })}
                className="w-full bg-black/60 border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <option value="">—</option>
                {MUSICAL_KEYS.flatMap(k => [
                  <option key={`${k}maj`} value={`${k} maj`}>{k} major</option>,
                  <option key={`${k}min`} value={`${k}m`}>{k} minor</option>,
                ])}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Duración (s)</label>
              <input type="number" min="1" value={song.duration}
                onChange={e => onUpdate({ ...song, duration: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full bg-black/60 border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">BPM</label>
              <div className="flex gap-1">
                <input type="number" min="40" max="300" value={song.bpm}
                  onChange={e => onUpdate({ ...song, bpm: Math.max(40, Math.min(300, parseInt(e.target.value) || 120)) })}
                  className="flex-1 bg-black/60 border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <button onClick={e => { e.stopPropagation(); const d = tapBpm(); if (d > 0) onUpdate({ ...song, bpm: d }); }}
                  className="px-2 rounded-lg text-xs transition-all active:scale-95" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }} title="Tap BPM (≥4 taps)">
                  <Zap size={12} />
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 block mb-1 flex items-center gap-1"><Link size={10} /> Audio URL</label>
              <input type="url" value={song.audioUrl ?? ''} onChange={e => onUpdate({ ...song, audioUrl: e.target.value || undefined })}
                placeholder="https://… o /audio/song.mp3"
                className="w-full bg-black/60 border rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-700 outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 block mb-1 flex items-center gap-1"><Mic2 size={10} /> Cover Art URL</label>
              <input type="url" value={song.coverUrl ?? ''} onChange={e => onUpdate({ ...song, coverUrl: e.target.value || undefined })}
                placeholder="https://… o /covers/image.jpg"
                className="w-full bg-black/60 border rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-700 outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 block mb-1 flex items-center gap-1"><Radio size={10} /> Performance Mode</label>
              <div className="flex gap-1">
                {PERFORMANCE_MODES.map(m => (
                  <button key={m.value} onClick={() => onUpdate({ ...song, performanceMode: m.value })}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all" title={m.desc}
                    style={{
                      background: song.performanceMode === m.value ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${song.performanceMode === m.value ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      color: song.performanceMode === m.value ? '#f97316' : '#6b7280',
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sections sub-panel */}
          <div>
            <button onClick={() => setShowSections(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold transition-colors w-full py-0.5"
              style={{ color: showSections ? '#f97316' : '#6b7280' }}>
              <Layers size={11} />
              Sections {song.sections?.length ? `(${song.sections.length})` : ''}
              {showSections ? <ChevDown size={10} className="ml-auto" /> : <ChevronRight size={10} className="ml-auto" />}
            </button>
            {showSections && <SectionsEditor song={song} onUpdate={onUpdate} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EMPTY_SONG: Omit<ShowSong, 'id' | 'order'> = {
  title: '', artist: '', duration: 210, bpm: 120, key: '',
};

export function RepertoireBuilder({ songs, onChange, cues = [], currentSongId, onSelectSong }: RepertoireBuilderProps) {
  const { t } = useHoloLang();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSong, setNewSong] = useState<Omit<ShowSong, 'id' | 'order'>>({ ...EMPTY_SONG });
  const { tap: tapNewBpm } = useBpmTap();

  const addSong = () => {
    if (!newSong.title.trim()) return;
    const song: ShowSong = { ...newSong, id: `song-${Date.now()}`, order: songs.length };
    onChange([...songs, song]);
    setNewSong({ ...EMPTY_SONG });
    setShowAddForm(false);
  };

  const removeSong = (id: string) =>
    onChange(songs.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })));

  const updateSong = (updated: ShowSong) =>
    onChange(songs.map(s => s.id === updated.id ? updated : s));

  const duplicateSong = (song: ShowSong) => {
    const copy: ShowSong = { ...song, id: `song-${Date.now()}`, title: `${song.title} (copy)`, order: songs.length };
    onChange([...songs, copy]);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...songs];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next.map((s, i) => ({ ...s, order: i })));
  };

  const moveDown = (index: number) => {
    if (index === songs.length - 1) return;
    const next = [...songs];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next.map((s, i) => ({ ...s, order: i })));
  };

  const totalDuration = songs.reduce((t, s) => t + s.duration, 0);
  const avgBpm = songs.length > 0 ? Math.round(songs.reduce((a, s) => a + s.bpm, 0) / songs.length) : 0;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white tracking-wider uppercase">Setlist</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {songs.length} canciones · {formatTime(totalDuration)}
            {avgBpm > 0 && <span> · avg {avgBpm} BPM</span>}
            {cues.length > 0 && <span className="text-orange-500"> · {cues.length} cues</span>}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all"
          style={{ background: showAddForm ? 'rgba(249,115,22,0.25)' : 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}
        >
          <Plus className="w-3 h-3" /> Add Song
        </button>
      </div>

      {/* ── Add form ── */}
      {showAddForm && (
        <div className="p-4 rounded-xl border space-y-3" style={{ background: 'rgba(249,115,22,0.04)', borderColor: 'rgba(249,115,22,0.2)' }}>
          <p className="text-xs font-bold text-orange-400 tracking-widest uppercase">{t('rep_new_song')}</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newSong.title}
              onChange={e => setNewSong(s => ({ ...s, title: e.target.value }))}
              placeholder={t('rep_title_req')}
              className="col-span-2 bg-black/40 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              onKeyDown={e => e.key === 'Enter' && addSong()}
              autoFocus
            />
            <input value={newSong.artist} onChange={e => setNewSong(s => ({ ...s, artist: e.target.value }))} placeholder={t('rep_artist')}
              className="bg-black/40 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <select value={newSong.key ?? ''} onChange={e => setNewSong(s => ({ ...s, key: e.target.value || undefined }))}
              className="bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <option value="">Tonalidad —</option>
              {MUSICAL_KEYS.flatMap(k => [
                <option key={`${k}maj`} value={`${k} maj`}>{k} major</option>,
                <option key={`${k}min`} value={`${k}m`}>{k} minor</option>,
              ])}
            </select>
            <div>
              <label className="text-xs text-gray-600 block mb-1">{t('rep_duration_sec')}</label>
              <input type="number" min="1" value={newSong.duration}
                onChange={e => setNewSong(s => ({ ...s, duration: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">BPM</label>
              <div className="flex gap-1">
                <input type="number" min="40" max="300" value={newSong.bpm}
                  onChange={e => setNewSong(s => ({ ...s, bpm: Math.max(40, Math.min(300, parseInt(e.target.value) || 120)) }))}
                  className="flex-1 bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <button onClick={() => { const d = tapNewBpm(); if (d > 0) setNewSong(s => ({ ...s, bpm: d })); }}
                  className="px-2 rounded-lg text-xs transition-all active:scale-95" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }} title="Tap BPM">
                  <Zap size={12} />
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 block mb-1">Audio URL (opcional)</label>
              <input type="url" value={(newSong as ShowSong).audioUrl ?? ''}
                onChange={e => setNewSong(s => ({ ...s, audioUrl: e.target.value || undefined }))}
                placeholder="https://… o /audio/song.mp3"
                className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 outline-none focus:border-orange-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addSong} disabled={!newSong.title.trim()}
              className="flex-1 py-2 rounded-lg text-sm font-bold tracking-wider uppercase transition-all disabled:opacity-40"
              style={{ background: '#f97316', color: '#000' }}>
              {t('rep_add')}
            </button>
            <button onClick={() => { setShowAddForm(false); setNewSong({ ...EMPTY_SONG }); }}
              className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors">
              {t('rep_cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── Song list ── */}
      {songs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 rounded-xl border border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Music className="w-10 h-10 text-gray-700" />
          <p className="text-sm text-gray-600">{t('rep_empty')}</p>
          <button onClick={() => setShowAddForm(true)} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
            {t('rep_add_first')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {songs.map((song, i) => (
            <SongRow
              key={song.id}
              song={song} index={i} total={songs.length}
              isActive={song.id === currentSongId}
              cueCount={cues.filter(c => c.songId === song.id).length}
              onRemove={() => removeSong(song.id)}
              onUpdate={updateSong}
              onDuplicate={() => duplicateSong(song)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
              onClick={() => onSelectSong?.(song.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
