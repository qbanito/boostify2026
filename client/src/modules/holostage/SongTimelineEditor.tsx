// ─── SongTimelineEditor ───────────────────────────────────────────────────────
// Professional DAW-style timeline for HoloStage show cues.
// Features:
//   • Multi-track rows — one row per CueType (7 tracks)
//   • Waveform display — canvas drawn from ShowSong.waveformData or generated mock
//   • Song sections — colored bands (intro/verse/chorus/bridge/outro…)
//   • Drag-to-move cues — pointer capture API
//   • Playhead across all tracks
//   • Click-to-add cue on the correct track (no popup needed)

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, ChevronDown, ChevronRight, Zap, Lock } from 'lucide-react';
import { useHoloLang } from './holoLangContext';
import type { ShowSong, SongSection } from '../../schemas/holostage/showPackage.schema';
import type { TimelineCue, CueType } from '../../schemas/holostage/timelineCue.schema';
import { CUE_TYPE_COLORS, CUE_TYPE_LABELS } from '../../schemas/holostage/timelineCue.schema';
import { formatTime } from '../../services/holostage/audioSyncEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACK_HEIGHT = 28;     // px per cue-type track row
const RULER_H     = 22;      // px for time ruler
const WAVE_H      = 36;      // px for waveform + sections row
const LABEL_W     = 136;     // px for the left label column

const CUE_TYPES: CueType[] = ['animation', 'dmx', 'camera', 'effect', 'transition', 'blackout', 'fallback'];

const SECTION_COLORS: Record<string, string> = {
  intro:            'rgba(59,130,246,0.30)',
  verse:            'rgba(107,114,128,0.20)',
  pre_chorus:       'rgba(168,85,247,0.22)',
  chorus:           'rgba(249,115,22,0.30)',
  bridge:           'rgba(20,184,166,0.25)',
  outro:            'rgba(239,68,68,0.22)',
  solo:             'rgba(234,179,8,0.25)',
  dance_break:      'rgba(236,72,153,0.22)',
  crowd_interaction:'rgba(16,185,129,0.20)',
  instrumental:     'rgba(99,102,241,0.20)',
};

// ─── Waveform Canvas ──────────────────────────────────────────────────────────

function WaveformCanvas({
  data, width, height, color = '#f97316', dimmed = false,
}: { data: number[]; width: number; height: number; color?: string; dimmed?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const mid = height / 2;
    const barW = Math.max(1, width / data.length);
    ctx.fillStyle = dimmed ? 'rgba(107,114,128,0.35)' : color + 'aa';

    data.forEach((v, i) => {
      const amp = Math.abs(v) * mid * 0.9;
      ctx.fillRect(i * barW, mid - amp, barW - 0.5, amp * 2);
    });
  }, [data, width, height, color, dimmed]);

  return <canvas ref={ref} style={{ display: 'block', width, height }} />;
}

/** Generate a mock waveform if none is stored. */
function mockWaveform(duration: number, bpm: number): number[] {
  const bars = Math.round(duration * 4);
  return Array.from({ length: bars }, (_, i) => {
    const beat = Math.sin((i * bpm * Math.PI) / 120);
    const sub  = Math.sin(i * 0.37) * 0.4;
    return Math.min(1, Math.abs(beat + sub) * 0.85 + 0.1);
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SongTimelineEditorProps {
  songs: ShowSong[];
  cues: TimelineCue[];
  onCuesChange: (cues: TimelineCue[]) => void;
  currentSongId: string | null;
  currentPosition: number;
  onSongSelect: (songId: string) => void;
  onCueSelect?: (cue: TimelineCue) => void;
  onSeek?: (seconds: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SongTimelineEditor({
  songs,
  cues,
  onCuesChange,
  currentSongId,
  currentPosition,
  onSongSelect,
  onCueSelect,
  onSeek,
}: SongTimelineEditorProps) {
  const { t } = useHoloLang();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(50);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [snapToBPM, setSnapToBPM] = useState(false);
  const [dragging, setDragging] = useState<{ cueId: string; startX: number; startTs: number; songDuration: number } | null>(null);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getCuesForSong = (songId: string) =>
    cues.filter(c => c.songId === songId).sort((a, b) => a.timestamp - b.timestamp);

  const getCuesForTrack = (songId: string, type: CueType) =>
    cues.filter(c => c.songId === songId && c.type === type);

  const toggleCollapsed = (songId: string) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(songId) ? n.delete(songId) : n.add(songId);
      return n;
    });
  };

  // ─── Add cue by clicking a specific track row ─────────────────────────────

  const snapTimestamp = useCallback((ts: number, bpm: number) => {
    if (!snapToBPM || !bpm) return ts;
    const beatDuration = 60 / bpm;
    return Math.round(ts / beatDuration) * beatDuration;
  }, [snapToBPM]);

  const handleTrackClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    songId: string,
    type: CueType,
    duration: number,
    bpm: number,
  ) => {
    if (dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const rawTs = Math.max(0, Math.min(duration, x / zoom));
    const timestamp = Math.round(snapTimestamp(rawTs, bpm) * 10) / 10;
    const newCue: TimelineCue = {
      id: `cue-${Date.now()}`,
      songId,
      timestamp,
      type,
      name: `${CUE_TYPE_LABELS[type]} @ ${formatTime(timestamp)}`,
      data: {},
      enabled: true,
      color: CUE_TYPE_COLORS[type],
      locked: false,
    };
    onCuesChange([...cues, newCue]);
    onCueSelect?.(newCue);
  }, [zoom, cues, onCuesChange, onCueSelect, dragging, snapTimestamp]);

  const removeCue = (id: string) => onCuesChange(cues.filter(c => c.id !== id));

  // ─── Drag-to-move cues ────────────────────────────────────────────────────

  const startDrag = (e: React.PointerEvent, cue: TimelineCue, songDuration: number) => {
    if (cue.locked) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({ cueId: cue.id, startX: e.clientX, startTs: cue.timestamp, songDuration });
  };

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dt = dx / zoom;
    const newTs = Math.round(Math.max(0, Math.min(dragging.songDuration, dragging.startTs + dt)) * 10) / 10;
    onCuesChange(cues.map(c =>
      c.id === dragging.cueId ? { ...c, timestamp: newTs, name: c.name.replace(/@.*$/, `@ ${formatTime(newTs)}`) } : c,
    ));
  }, [dragging, zoom, cues, onCuesChange]);

  const onPointerUp = useCallback(() => setDragging(null), []);

  // ─── Time ruler ───────────────────────────────────────────────────────────

  const renderRuler = (duration: number, width: number) => {
    const step = zoom >= 80 ? 5 : zoom >= 40 ? 10 : 30;
    const ticks = [];
    for (let s = 0; s <= duration; s += step) {
      ticks.push(
        <div key={s} className="absolute top-0 flex flex-col items-start" style={{ left: s * zoom }}>
          <div style={{ width: 1, height: 8, background: 'rgba(255,255,255,0.18)' }} />
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 1, marginLeft: 2, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
            {formatTime(s)}
          </span>
        </div>,
      );
    }
    return <div className="relative" style={{ width, height: RULER_H }}>{ticks}</div>;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="space-y-3"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white tracking-wider uppercase">{t('tl_header')}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t('tl_hint', { n: cues.length })}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Snap-to-BPM toggle */}
          <button
            onClick={() => setSnapToBPM(v => !v)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: snapToBPM ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${snapToBPM ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color: snapToBPM ? '#f97316' : '#6b7280',
            }}
            title="Snap cue placement to nearest beat"
          >
            <Zap size={11} />
            Snap BPM
          </button>
          <button onClick={() => setZoom(z => Math.max(15, z - 10))} className="p-1 text-gray-500 hover:text-white"><ZoomOut size={14} /></button>
          <input
            type="range" min="15" max="180" value={zoom}
            onChange={e => setZoom(parseInt(e.target.value))}
            className="w-24 accent-orange-400"
          />
          <button onClick={() => setZoom(z => Math.min(180, z + 10))} className="p-1 text-gray-500 hover:text-white"><ZoomIn size={14} /></button>
          <span className="text-xs text-gray-600 w-10 text-right">{zoom}px/s</span>
        </div>
      </div>

      {/* ── Timeline shell ── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: '#080808', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        {songs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
            {t('tl_add_songs_first')}
          </div>
        ) : (
          <div ref={scrollRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '72vh' }}>
            {songs.map((song, songIdx) => {
              const isActive   = song.id === currentSongId;
              const isCollapsed = collapsed.has(song.id);
              const tWidth     = song.duration * zoom;
              const waveData   = song.waveformData?.length ? song.waveformData : mockWaveform(song.duration, song.bpm || 120);
              const sections: SongSection[] = song.sections ?? [];
              const trackCues  = getCuesForSong(song.id);

              return (
                <div
                  key={song.id}
                  className="border-b"
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  {/* ── Song header row ── */}
                  <div
                    className="flex items-stretch sticky left-0 z-10"
                    style={{ background: isActive ? 'rgba(249,115,22,0.07)' : '#0c0c0c' }}
                  >
                    {/* Label */}
                    <div
                      className="flex items-center gap-1.5 px-2 cursor-pointer select-none shrink-0 border-r"
                      style={{ width: LABEL_W, borderColor: 'rgba(255,255,255,0.07)' }}
                      onClick={() => { onSongSelect(song.id); toggleCollapsed(song.id); }}
                    >
                      {isCollapsed
                        ? <ChevronRight size={11} className="text-gray-600 shrink-0" />
                        : <ChevronDown  size={11} className="text-gray-600 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{song.title || t('tl_untitled')}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 9 }}>
                          {formatTime(song.duration)} · {song.bpm}bpm
                          {isActive && <span className="text-orange-400 font-bold ml-1">▶</span>}
                        </p>
                      </div>
                    </div>

                    {/* Waveform + sections */}
                    <div
                      className="relative flex-1 overflow-hidden"
                      style={{ height: WAVE_H, cursor: onSeek ? 'col-resize' : 'default' }}
                      onClick={e => {
                        if (!onSeek) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const t = Math.max(0, Math.min(song.duration, x / zoom));
                        onSongSelect(song.id);
                        onSeek(t);
                      }}
                    >
                      {/* Waveform */}
                      <WaveformCanvas
                        data={waveData}
                        width={tWidth}
                        height={WAVE_H}
                        color={isActive ? '#f97316' : '#6b7280'}
                        dimmed={!isActive}
                      />
                      {/* Section bands */}
                      {sections.map((sec, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 pointer-events-none"
                          style={{
                            left: sec.start * zoom,
                            width: (sec.end - sec.start) * zoom,
                            background: SECTION_COLORS[sec.name] ?? 'rgba(255,255,255,0.08)',
                            borderLeft: '1px solid rgba(255,255,255,0.12)',
                          }}
                          title={sec.label ?? String(sec.name)}
                        >
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginLeft: 3, lineHeight: `${WAVE_H}px`, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
                            {sec.label ?? String(sec.name)}
                          </span>
                        </div>
                      ))}
                      {/* Ruler — always visible */}
                      <div className="absolute bottom-0 left-0 pointer-events-none" style={{ width: tWidth }}>
                        {renderRuler(song.duration, tWidth)}
                      </div>
                      {/* Playhead in waveform row */}
                      {isActive && (
                        <div
                          className="absolute top-0 bottom-0 pointer-events-none z-20"
                          style={{ left: currentPosition * zoom, width: 2, background: '#f97316', boxShadow: '0 0 6px rgba(249,115,22,0.7)' }}
                        />
                      )}
                    </div>
                  </div>

                  {/* ── Track rows (one per CueType) ── */}
                  {!isCollapsed && CUE_TYPES.map(cueType => {
                    const trackCuesFiltered = getCuesForTrack(song.id, cueType);
                    const color = CUE_TYPE_COLORS[cueType];

                    return (
                      <div key={cueType} className="flex items-stretch" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        {/* Track label */}
                        <div
                          className="shrink-0 flex items-center px-2 gap-1.5 border-r select-none"
                          style={{ width: LABEL_W, height: TRACK_HEIGHT, borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}
                        >
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {CUE_TYPE_LABELS[cueType].split(' ')[0]}
                          </span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', marginLeft: 'auto' }}>
                            {trackCuesFiltered.length > 0 ? trackCuesFiltered.length : ''}
                          </span>
                        </div>

                        {/* Track area — click to add, drag markers to move */}
                        <div
                          className="relative flex-1 cursor-crosshair"
                          style={{
                            height: TRACK_HEIGHT,
                            width: tWidth,
                            background: isActive
                              ? `${color}08`
                              : 'transparent',
                            borderLeft: `2px solid ${color}22`,
                          }}
                          onClick={e => handleTrackClick(e, song.id, cueType, song.duration, song.bpm || 120)}
                        >
                          {/* Playhead line */}
                          {isActive && (
                            <div
                              className="absolute top-0 bottom-0 pointer-events-none z-20"
                              style={{ left: currentPosition * zoom, width: 1, background: 'rgba(249,115,22,0.5)' }}
                            />
                          )}

                          {/* Cue markers */}
                          {trackCuesFiltered.map(cue => (
                            <div
                              key={cue.id}
                              className="absolute top-0 bottom-0 z-10 group"
                              style={{
                                left: cue.timestamp * zoom - 6,
                                width: 12,
                                cursor: cue.locked ? 'not-allowed' : 'grab',
                                opacity: cue.enabled ? 1 : 0.35,
                              }}
                              onPointerDown={e => startDrag(e, cue, song.duration)}
                              onClick={e => { e.stopPropagation(); onCueSelect?.(cue); }}
                              title={`${cue.name} @ ${formatTime(cue.timestamp)}`}
                            >
                              {/* Marker stem */}
                              <div
                                className="absolute inset-x-1/2 top-0 bottom-0"
                                style={{ width: 2, background: cue.enabled ? color : 'rgba(255,255,255,0.15)', transform: 'translateX(-50%)' }}
                              />
                              {/* Marker head (diamond) */}
                              <div
                                className="absolute top-1 inset-x-0 flex justify-center"
                                style={{ zIndex: 2 }}
                              >
                                <div
                                  className="w-3 h-3 rotate-45 border"
                                  style={{ background: cue.enabled ? color : 'rgba(255,255,255,0.2)', borderColor: '#000' }}
                                />
                              </div>
                              {/* Lock icon */}
                              {cue.locked && (
                                <div className="absolute bottom-0.5 inset-x-0 flex justify-center">
                                  <Lock size={8} className="text-amber-400" />
                                </div>
                              )}
                              {/* Floating label on hover */}
                              <div
                                className="absolute opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-40"
                                style={{
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  marginBottom: 4,
                                  whiteSpace: 'nowrap',
                                  background: 'rgba(10,10,10,0.92)',
                                  border: `1px solid ${color}44`,
                                  borderRadius: 4,
                                  padding: '2px 5px',
                                  fontSize: 9,
                                  color: '#e5e7eb',
                                  fontFamily: 'monospace',
                                  boxShadow: `0 0 6px ${color}33`,
                                }}
                              >
                                {cue.name}
                              </div>
                              {/* Delete on hover */}
                              <button
                                className="absolute top-0 -right-3 opacity-0 group-hover:opacity-100 transition-opacity z-30 text-red-500 hover:text-red-400"
                                style={{ fontSize: 9, lineHeight: 1 }}
                                onClick={e => { e.stopPropagation(); removeCue(cue.id); }}
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {CUE_TYPES.map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CUE_TYPE_COLORS[type] }} />
            <span className="text-xs text-gray-600">{CUE_TYPE_LABELS[type]}</span>
          </div>
        ))}
        <span className="text-xs text-gray-700 ml-2">← click track to add · drag to move</span>
      </div>
    </div>
  );
}
