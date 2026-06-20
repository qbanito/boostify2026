// ─── DMXSceneBuilder ─────────────────────────────────────────────────────────
// Professional DMX Lighting Console — fully wired to dmxEngine.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lightbulb, Plus, Trash2, Play, Sliders, Zap, ZapOff,
  ChevronDown, ChevronUp, SlidersHorizontal, Radio, Circle,
  Layers, Copy, Eye, EyeOff, Move,
} from 'lucide-react';
import { useHoloLang } from './holoLangContext';
import type { DMXScene, DMXChannel, DMXFixture } from '../../schemas/holostage/dmx.schema';
import { PRESET_DMX_SCENES } from '../../schemas/holostage/dmx.schema';
import { dmxEngine, getScenePreviewColor } from '../../services/holostage/dmxEngine';
import type { DMXUniverseState } from '../../services/holostage/dmxEngine';

interface DMXSceneBuilderProps {
  scenes: DMXScene[];
  onChange: (scenes: DMXScene[]) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MOOD_COLORS: Record<DMXScene['mood'], string> = {
  intro:    '#3b82f6',
  verse:    '#8b5cf6',
  chorus:   '#f97316',
  bridge:   '#ec4899',
  outro:    '#6366f1',
  blackout: '#1a1a1a',
  custom:   '#14b8a6',
};

const MOOD_LABELS: Record<DMXScene['mood'], string> = {
  intro:    'INTRO',
  verse:    'VERSO',
  chorus:   'CORO',
  bridge:   'PUENTE',
  outro:    'OUTRO',
  blackout: 'BLACKOUT',
  custom:   'CUSTOM',
};

const FIXTURE_ICONS: Record<DMXFixture['type'], string> = {
  spot: '🔦', wash: '💡', led_bar: '▬', strobe: '⚡', fog: '🌫️', laser: '🔴',
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return [r, g, b];
}

function channelsToColor(channels: DMXChannel[]): string {
  const r = channels.find(c => c.channel === 1)?.value ?? 0;
  const g = channels.find(c => c.channel === 2)?.value ?? 0;
  const b = channels.find(c => c.channel === 3)?.value ?? 0;
  if (r + g + b === 0) return '#222';
  return `rgb(${r},${g},${b})`;
}

// ─── Universe Visualizer (16 channels live) ──────────────────────────────────

function UniverseVisualizer({ activeScene }: { activeScene: DMXScene | null }) {
  const [channels, setChannels] = useState<number[]>(Array(32).fill(0));
  const [fadeProgress, setFadeProgress] = useState(1);

  useEffect(() => {
    const unsub = dmxEngine.onChange((state: DMXUniverseState) => {
      setChannels(Array.from(state.channels.slice(0, 32)));
      setFadeProgress(state.fadeProgress);
    });
    return unsub;
  }, []);

  const sceneColor = activeScene ? hexToRgb(activeScene.color) : [249, 115, 22];

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(10,10,10,0.8) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5" style={{ color: '#f97316' }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#71717a' }}>
            DMX Universe · CH 1–32
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {fadeProgress < 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#52525b' }}>Fade</span>
              <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${fadeProgress * 100}%`,
                    background: `rgb(${sceneColor.join(',')})`,
                  }}
                />
              </div>
            </div>
          )}
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e' }}
          />
        </div>
      </div>

      {/* Channel bars */}
      <div className="flex gap-0.5 items-end" style={{ height: 52 }}>
        {channels.map((v, i) => {
          const pct = v / 255;
          const isRGB = i < 3;
          const color = isRGB
            ? ['#ef4444','#22c55e','#3b82f6'][i]
            : `rgba(${sceneColor[0]},${sceneColor[1]},${sceneColor[2]},0.85)`;
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: Math.max(2, pct * 44),
                  background: pct > 0 ? color : 'rgba(255,255,255,0.06)',
                  boxShadow: pct > 0.1 ? `0 0 4px ${color}80` : 'none',
                  transition: 'height 60ms linear, background 200ms',
                }}
              />
              <span
                className="font-mono leading-none"
                style={{ fontSize: 7, color: '#3f3f46' }}
              >
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active scene strip */}
      {activeScene && (
        <div
          className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: `${activeScene.color}15`,
            border: `1px solid ${activeScene.color}30`,
          }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: activeScene.color, boxShadow: `0 0 6px ${activeScene.color}` }}
          />
          <span className="text-xs font-medium" style={{ color: '#d4d4d8' }}>
            {activeScene.name}
          </span>
          <span
            className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: `${MOOD_COLORS[activeScene.mood]}20`,
              color: MOOD_COLORS[activeScene.mood],
              border: `1px solid ${MOOD_COLORS[activeScene.mood]}30`,
              fontSize: 9,
              letterSpacing: '0.12em',
            }}
          >
            {MOOD_LABELS[activeScene.mood]}
          </span>
          <span className="text-xs" style={{ color: '#52525b' }}>
            {(activeScene.intensity * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Master Controls ──────────────────────────────────────────────────────────

function MasterControls() {
  const [masterDimmer, setMasterDimmer] = useState(1);
  const [blackout, setBlackout] = useState(false);

  const handleDimmer = (v: number) => {
    setMasterDimmer(v);
    dmxEngine.setMasterDimmer(v);
  };

  const toggleBlackout = () => {
    const next = !blackout;
    setBlackout(next);
    next ? dmxEngine.blackoutOn() : dmxEngine.blackoutOff();
  };

  return (
    <div
      className="rounded-2xl border p-4 flex items-center gap-4"
      style={{
        background: blackout
          ? 'rgba(239,68,68,0.05)'
          : 'linear-gradient(135deg,rgba(0,0,0,0.5),rgba(10,10,10,0.7))',
        borderColor: blackout ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Master dimmer */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#71717a' }}>
            Master Dimmer
          </span>
          <span className="text-sm font-mono font-bold" style={{ color: '#f97316' }}>
            {(masterDimmer * 100).toFixed(0)}%
          </span>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{
              width: `${masterDimmer * 100}%`,
              background: blackout
                ? '#ef4444'
                : `linear-gradient(90deg, #f97316, #fb923c)`,
              boxShadow: blackout ? '0 0 8px #ef4444' : '0 0 8px rgba(249,115,22,0.5)',
            }}
          />
          <input
            type="range" min="0" max="1" step="0.01"
            value={masterDimmer}
            onChange={e => handleDimmer(parseFloat(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            disabled={blackout}
          />
        </div>
      </div>

      {/* Blackout button */}
      <button
        onClick={toggleBlackout}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
        style={{
          background: blackout ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
          color: blackout ? '#ef4444' : '#71717a',
          border: `1px solid ${blackout ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: blackout ? '0 0 12px rgba(239,68,68,0.3)' : 'none',
        }}
      >
        {blackout ? <ZapOff className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
        Blackout
      </button>
    </div>
  );
}

// ─── Channel Row ─────────────────────────────────────────────────────────────

function ChannelRow({ ch, onUpdate, onRemove }: {
  ch: DMXChannel;
  onUpdate: (c: DMXChannel) => void;
  onRemove: () => void;
}) {
  const pct = ch.value / 255;
  const RGB_COLORS = ['#ef4444', '#22c55e', '#3b82f6'];
  const barColor = ch.channel <= 3 ? RGB_COLORS[ch.channel - 1] : '#f97316';

  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2 rounded-lg group"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Channel badge */}
      <div
        className="flex items-center justify-center rounded font-mono font-bold shrink-0"
        style={{
          width: 28, height: 20, fontSize: 9,
          background: 'rgba(255,255,255,0.05)',
          color: barColor,
          border: `1px solid ${barColor}25`,
        }}
      >
        {ch.channel}
      </div>

      {/* Label */}
      <input
        value={ch.label || ''}
        onChange={e => onUpdate({ ...ch, label: e.target.value })}
        placeholder="Label"
        className="w-16 shrink-0 bg-transparent text-xs outline-none"
        style={{ color: '#71717a' }}
      />

      {/* Bar */}
      <div className="flex-1 relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-75"
          style={{
            width: `${pct * 100}%`,
            background: barColor,
            boxShadow: pct > 0.1 ? `0 0 4px ${barColor}80` : 'none',
          }}
        />
        <input
          type="range" min="0" max="255" step="1"
          value={ch.value}
          onChange={e => onUpdate({ ...ch, value: parseInt(e.target.value) })}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Value input */}
      <input
        type="number" min="0" max="255"
        value={ch.value}
        onChange={e => onUpdate({ ...ch, value: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) })}
        className="w-10 text-center font-mono text-xs font-bold outline-none rounded"
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: '#e4e4e7',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      />

      {/* Color swatch */}
      <div
        className="shrink-0 rounded-sm"
        style={{
          width: 12, height: 12,
          background: ch.channel <= 3
            ? `rgb(${ch.channel===1?ch.value:0},${ch.channel===2?ch.value:0},${ch.channel===3?ch.value:0})`
            : `rgba(255,255,255,${ch.value/255})`,
          boxShadow: ch.value > 10 ? `0 0 4px ${barColor}80` : 'none',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />

      {/* Remove */}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        style={{ color: '#ef444480' }}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Scene Card ───────────────────────────────────────────────────────────────

function SceneCard({
  scene, isActive, onUpdate, onRemove, onActivate, onDuplicate,
}: {
  scene: DMXScene;
  isActive: boolean;
  onUpdate: (s: DMXScene) => void;
  onRemove: () => void;
  onActivate: () => void;
  onDuplicate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const moodColor = MOOD_COLORS[scene.mood];
  const previewColor = channelsToColor(scene.channels);

  const addChannel = () => {
    const used = scene.channels.map(c => c.channel);
    let nextCh = 1;
    while (used.includes(nextCh) && nextCh <= 512) nextCh++;
    onUpdate({ ...scene, channels: [...scene.channels, { channel: nextCh, value: 0, label: '' }] });
  };

  const updateChannel = (i: number, ch: DMXChannel) => {
    const chs = [...scene.channels];
    chs[i] = ch;
    onUpdate({ ...scene, channels: chs });
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${scene.color}10 0%, rgba(0,0,0,0.5) 100%)`
          : 'rgba(255,255,255,0.02)',
        borderColor: isActive ? `${scene.color}40` : 'rgba(255,255,255,0.06)',
        boxShadow: isActive ? `0 0 20px ${scene.color}20` : 'none',
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 p-3">
        {/* Color preview orb */}
        <div className="relative shrink-0">
          <div
            className="w-10 h-10 rounded-xl"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${scene.color}cc, ${scene.color}55)`,
              boxShadow: isActive ? `0 0 16px ${scene.color}80` : `0 0 8px ${scene.color}30`,
              border: `1px solid ${scene.color}30`,
            }}
          />
          {isActive && (
            <div
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e' }}
            />
          )}
        </div>

        {/* Name + mood */}
        <div className="flex-1 min-w-0">
          <input
            value={scene.name}
            onChange={e => onUpdate({ ...scene, name: e.target.value })}
            className="w-full bg-transparent text-sm font-bold text-white outline-none truncate"
            onClick={e => e.stopPropagation()}
          />
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full leading-none"
              style={{
                background: `${moodColor}18`,
                color: moodColor,
                border: `1px solid ${moodColor}25`,
                fontSize: 9,
                letterSpacing: '0.12em',
              }}
            >
              {MOOD_LABELS[scene.mood]}
            </span>
            <span className="text-xs" style={{ color: '#52525b' }}>
              {scene.channels.length} ch · {(scene.intensity * 100).toFixed(0)}%
            </span>
            <span className="text-xs" style={{ color: '#3f3f46' }}>
              ↑{scene.fadeIn}ms ↓{scene.fadeOut}ms
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Duplicate */}
          <button
            onClick={onDuplicate}
            className="p-1.5 rounded-lg transition-all hover:scale-110"
            style={{ color: '#52525b' }}
            title="Duplicar"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Activate */}
          <button
            onClick={onActivate}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: isActive ? `${scene.color}25` : 'rgba(255,255,255,0.04)',
              color: isActive ? scene.color : '#71717a',
              border: `1px solid ${isActive ? scene.color + '40' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: isActive ? `0 0 8px ${scene.color}30` : 'none',
            }}
            title="Activar escena"
          >
            <Play className="w-3 h-3" />
            {isActive ? 'LIVE' : 'GO'}
          </button>

          {/* Expand */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: expanded ? '#f97316' : '#52525b' }}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Delete */}
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#3f3f46' }}
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Expanded ── */}
      {expanded && (
        <div
          className="border-t"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          {/* Channel preview strip */}
          <div className="px-3 pt-3">
            <div
              className="h-1.5 rounded-full w-full overflow-hidden mb-3"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              {scene.channels.slice(0, 8).map((ch, i) => {
                const segW = 100 / Math.max(scene.channels.length, 1);
                const segColor = ch.channel <= 3
                  ? ['#ef4444','#22c55e','#3b82f6'][ch.channel - 1]
                  : '#f97316';
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${i * segW}%`,
                      width: `${segW}%`,
                      height: '100%',
                      background: segColor,
                      opacity: ch.value / 255,
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="px-3 pb-4 grid grid-cols-2 gap-3">
            {/* Left col: settings */}
            <div className="space-y-3">
              {/* Display color */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: '#52525b' }}>
                  Color Display
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={scene.color}
                    onChange={e => onUpdate({ ...scene, color: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                    style={{ background: 'none' }}
                  />
                  <span className="text-xs font-mono" style={{ color: '#71717a' }}>{scene.color}</span>
                </div>
              </div>

              {/* Mood */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: '#52525b' }}>
                  Mood
                </label>
                <div className="flex flex-wrap gap-1">
                  {(['intro','verse','chorus','bridge','outro','blackout','custom'] as DMXScene['mood'][]).map(m => (
                    <button
                      key={m}
                      onClick={() => onUpdate({ ...scene, mood: m })}
                      className="px-2 py-0.5 rounded-full text-xs font-bold transition-all"
                      style={{
                        background: scene.mood === m ? `${MOOD_COLORS[m]}22` : 'rgba(255,255,255,0.03)',
                        color: scene.mood === m ? MOOD_COLORS[m] : '#52525b',
                        border: `1px solid ${scene.mood === m ? MOOD_COLORS[m] + '40' : 'rgba(255,255,255,0.06)'}`,
                        fontSize: 9,
                        letterSpacing: '0.1em',
                      }}
                    >
                      {MOOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master intensity */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest" style={{ color: '#52525b' }}>
                    Intensidad
                  </label>
                  <span className="text-xs font-mono font-bold" style={{ color: '#f97316' }}>
                    {(scene.intensity * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${scene.intensity * 100}%`,
                      background: `linear-gradient(90deg, ${scene.color}88, ${scene.color})`,
                    }}
                  />
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={scene.intensity}
                    onChange={e => onUpdate({ ...scene, intensity: parseFloat(e.target.value) })}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Fades */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1 block" style={{ color: '#52525b' }}>
                    Fade In
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" value={scene.fadeIn}
                      onChange={e => onUpdate({ ...scene, fadeIn: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full rounded-lg px-2 py-1 text-xs font-mono font-bold outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#e4e4e7',
                      }}
                    />
                    <span className="text-xs shrink-0" style={{ color: '#52525b' }}>ms</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1 block" style={{ color: '#52525b' }}>
                    Fade Out
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" value={scene.fadeOut}
                      onChange={e => onUpdate({ ...scene, fadeOut: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full rounded-lg px-2 py-1 text-xs font-mono font-bold outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#e4e4e7',
                      }}
                    />
                    <span className="text-xs shrink-0" style={{ color: '#52525b' }}>ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right col: channels */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#52525b' }}>
                  Canales DMX
                </span>
                <button
                  onClick={addChannel}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: 'rgba(249,115,22,0.1)',
                    color: '#f97316',
                    border: '1px solid rgba(249,115,22,0.2)',
                  }}
                >
                  <Plus className="w-3 h-3" /> CH
                </button>
              </div>
              <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {scene.channels
                  .slice()
                  .sort((a, b) => a.channel - b.channel)
                  .map((ch, i) => (
                    <ChannelRow
                      key={ch.channel}
                      ch={ch}
                      onUpdate={updated => updateChannel(
                        scene.channels.findIndex(c => c.channel === ch.channel),
                        updated,
                      )}
                      onRemove={() => onUpdate({
                        ...scene,
                        channels: scene.channels.filter(c => c.channel !== ch.channel),
                      })}
                    />
                  ))}
                {scene.channels.length === 0 && (
                  <p className="text-xs py-2 text-center" style={{ color: '#3f3f46' }}>
                    Sin canales — agrega uno
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick Launch Grid ────────────────────────────────────────────────────────

function QuickLaunchGrid({ scenes, activeSceneId, onActivate }: {
  scenes: DMXScene[];
  activeSceneId: string | null;
  onActivate: (id: string) => void;
}) {
  if (scenes.length === 0) return null;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-3.5 h-3.5" style={{ color: '#71717a' }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#71717a' }}>
          Quick Launch
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {scenes.map(scene => {
          const isActive = activeSceneId === scene.id;
          return (
            <button
              key={scene.id}
              onClick={() => onActivate(scene.id)}
              className="relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all text-center overflow-hidden"
              style={{
                background: isActive
                  ? `${scene.color}20`
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? scene.color + '50' : 'rgba(255,255,255,0.07)'}`,
                boxShadow: isActive ? `0 0 16px ${scene.color}25` : 'none',
              }}
            >
              {/* Glow layer */}
              {isActive && (
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 50% 30%, ${scene.color}, transparent 70%)` }}
                />
              )}
              {/* Color orb */}
              <div
                className="w-7 h-7 rounded-lg"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${scene.color}cc, ${scene.color}55)`,
                  boxShadow: isActive ? `0 0 12px ${scene.color}` : `0 0 5px ${scene.color}40`,
                }}
              />
              <span
                className="text-xs font-bold leading-tight line-clamp-1"
                style={{ color: isActive ? '#ffffff' : '#71717a', fontSize: 10 }}
              >
                {scene.name}
              </span>
              {isActive && (
                <div
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: '#22c55e', boxShadow: '0 0 4px #22c55e' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DMXSceneBuilder({ scenes, onChange }: DMXSceneBuilderProps) {
  const { t } = useHoloLang();
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

  // Sync active scene from dmxEngine
  useEffect(() => {
    const unsub = dmxEngine.onChange((state: DMXUniverseState) => {
      setActiveSceneId(state.activeScene?.id ?? null);
    });
    return unsub;
  }, []);

  const activateScene = useCallback((scene: DMXScene) => {
    dmxEngine.activateScene(scene);
    setActiveSceneId(scene.id);
  }, []);

  const addScene = () => {
    const scene: DMXScene = {
      id: `scene-${Date.now()}`,
      name: `Scene ${scenes.length + 1}`,
      description: '',
      channels: [
        { channel: 1, value: 255, label: 'Red' },
        { channel: 2, value: 100, label: 'Green' },
        { channel: 3, value: 0,   label: 'Blue' },
        { channel: 4, value: 200, label: 'Dimmer' },
      ],
      fixtures: [],
      color: '#f97316',
      fadeIn: 1000,
      fadeOut: 1000,
      intensity: 1.0,
      mood: 'custom',
    };
    onChange([...scenes, scene]);
  };

  const duplicateScene = (scene: DMXScene) => {
    const copy: DMXScene = {
      ...scene,
      id: `scene-${Date.now()}`,
      name: `${scene.name} (copia)`,
    };
    onChange([...scenes, copy]);
  };

  const loadPresets = () => {
    const newOnes = PRESET_DMX_SCENES.filter(p => !scenes.find(s => s.id === p.id));
    onChange([...scenes, ...newOnes]);
  };

  const activeScene = scenes.find(s => s.id === activeSceneId) ?? null;

  return (
    <div className="space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="p-2 rounded-xl"
            style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}
          >
            <Lightbulb className="w-4 h-4" style={{ color: '#f97316' }} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider leading-none">
              DMX Scenes
            </h3>
            <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
              {scenes.length} {scenes.length === 1 ? 'escena' : 'escenas'} · Universo 512 canales
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPresets}
            className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: '#71717a',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Presets
          </button>
          <button
            onClick={addScene}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.12))',
              color: '#f97316',
              border: '1px solid rgba(249,115,22,0.3)',
              boxShadow: '0 0 12px rgba(249,115,22,0.1)',
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Nueva Escena
          </button>
        </div>
      </div>

      {/* ── Universe Visualizer ── */}
      <UniverseVisualizer activeScene={activeScene} />

      {/* ── Master Controls ── */}
      <MasterControls />

      {/* ── Quick Launch Grid ── */}
      <QuickLaunchGrid
        scenes={scenes}
        activeSceneId={activeSceneId}
        onActivate={id => {
          const scene = scenes.find(s => s.id === id);
          if (scene) activateScene(scene);
        }}
      />

      {/* ── Scene List ── */}
      {scenes.length === 0 ? (
        <div
          className="flex flex-col items-center gap-4 py-12 rounded-2xl border border-dashed"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}
          >
            <Lightbulb className="w-8 h-8" style={{ color: '#f9731640' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-white mb-1">Sin escenas DMX</p>
            <p className="text-xs" style={{ color: '#52525b' }}>Crea una escena o carga los presets</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addScene}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(249,115,22,0.12)',
                color: '#f97316',
                border: '1px solid rgba(249,115,22,0.25)',
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Nueva Escena
            </button>
            <button
              onClick={loadPresets}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: '#71717a',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Cargar Presets
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {scenes.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              isActive={activeSceneId === scene.id}
              onUpdate={updated => onChange(scenes.map(s => s.id === updated.id ? updated : s))}
              onRemove={() => {
                if (activeSceneId === scene.id) dmxEngine.blackoutOn();
                onChange(scenes.filter(s => s.id !== scene.id));
              }}
              onActivate={() => activateScene(scene)}
              onDuplicate={() => duplicateScene(scene)}
            />
          ))}
        </div>
      )}

    </div>
  );
}
