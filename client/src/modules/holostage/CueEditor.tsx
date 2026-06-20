// ─── CueEditor ────────────────────────────────────────────────────────────────
// Editor for individual timeline cue properties.

import React, { useState } from 'react';
import { Zap, Clock, Lock, Unlock, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useHoloLang } from './holoLangContext';
import type { TimelineCue, CueType } from '../../schemas/holostage/timelineCue.schema';
import { CUE_TYPE_COLORS, CUE_TYPE_LABELS } from '../../schemas/holostage/timelineCue.schema';
import { formatTime } from '../../services/holostage/audioSyncEngine';
import type { DMXScene } from '../../schemas/holostage/dmx.schema';
import type { ShowSong } from '../../schemas/holostage/showPackage.schema';

interface CueEditorProps {
  cue: TimelineCue | null;
  songTitle?: string;
  dmxScenes?: DMXScene[];
  animations?: string[];
  songs?: ShowSong[];
  onUpdate: (cue: TimelineCue) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const DEFAULT_ANIMATIONS = ['idle', 'dance_hiphop', 'dance_wave', 'jump', 'bow', 'walk', 'run', 'pose_a', 'pose_t'];

export function CueEditor({ cue, songTitle, dmxScenes, animations, songs, onUpdate, onDelete, onClose }: CueEditorProps) {
  const { t } = useHoloLang();
  const ANIM_LIST = (animations && animations.length > 0) ? animations : DEFAULT_ANIMATIONS;
  if (!cue) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center gap-3 rounded-xl border"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}
      >
        <Zap className="w-8 h-8 text-gray-700" />
        <p className="text-sm text-gray-600">{t('cue_select_hint')}</p>
        <p className="text-xs text-gray-700">{t('cue_click_hint')}</p>
      </div>
    );
  }

  const color = CUE_TYPE_COLORS[cue.type];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}60` }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{CUE_TYPE_LABELS[cue.type]}</p>
          <p className="text-xs text-gray-500">{songTitle ?? ''} @ {formatTime(cue.timestamp)}</p>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={() => onUpdate({ ...cue, enabled: !cue.enabled })}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
          style={{
            background: cue.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: cue.enabled ? '#10b981' : '#ef4444',
            border: `1px solid ${cue.enabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          {cue.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {cue.enabled ? t('cue_active') : t('cue_inactive')}
        </button>
        <button
          onClick={() => onUpdate({ ...cue, locked: !cue.locked })}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
          style={{
            background: cue.locked ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
            color: cue.locked ? '#f59e0b' : '#6b7280',
            border: `1px solid ${cue.locked ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {cue.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          {cue.locked ? t('cue_locked') : t('cue_free')}
        </button>
        <button
          onClick={() => { onDelete(cue.id); onClose(); }}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs text-red-500 hover:text-red-400 transition-colors"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <Trash2 className="w-3 h-3" /> {t('cue_delete')}
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('cue_name_label')}</label>
        <input
          value={cue.name}
          onChange={e => onUpdate({ ...cue, name: e.target.value })}
          className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        />
      </div>

      {/* Timestamp */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('cue_ts_label')}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="0"
            value={cue.timestamp}
            onChange={e => onUpdate({ ...cue, timestamp: Math.max(0, parseFloat(e.target.value) || 0) })}
            disabled={cue.locked}
            className="flex-1 bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500 disabled:opacity-50"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          />
          <span className="text-xs text-gray-500 w-14">{formatTime(cue.timestamp)}</span>
        </div>
      </div>

      {/* Type-specific data */}
      {cue.type === 'animation' && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('cue_anim_label')}</label>
          <select
            value={(cue.data as { animationName?: string }).animationName ?? 'idle'}
            onChange={e => onUpdate({ ...cue, data: { ...cue.data, animationName: e.target.value } })}
            className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            {ANIM_LIST.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex items-center gap-3 mt-2">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={(cue.data as { looping?: boolean }).looping ?? false}
                onChange={e => onUpdate({ ...cue, data: { ...cue.data, looping: e.target.checked } })}
                className="accent-orange-400"
              />
              Loop
            </label>
            <div className="flex-1">
              <label className="text-xs text-gray-600 block mb-1">{t('cue_speed_label')}</label>
              <input
                type="range" min="0.5" max="2" step="0.1"
                value={(cue.data as { speed?: number }).speed ?? 1}
                onChange={e => onUpdate({ ...cue, data: { ...cue.data, speed: parseFloat(e.target.value) } })}
                className="w-full accent-orange-400"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="text-xs text-gray-600 block mb-1">Blend Duration (s)</label>
            <input
              type="number" min="0" max="5" step="0.1"
              value={(cue.data as { blendDuration?: number }).blendDuration ?? 0.3}
              onChange={e => onUpdate({ ...cue, data: { ...cue.data, blendDuration: parseFloat(e.target.value) || 0 } })}
              className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>
      )}

      {cue.type === 'dmx' && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('cue_dmx_label')}</label>
          <select
            value={(cue.data as { sceneId?: string }).sceneId ?? ''}
            onChange={e => onUpdate({ ...cue, data: { ...cue.data, sceneId: e.target.value } })}
            className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <option value="">{t('cue_no_scene')}</option>
            {(dmxScenes && dmxScenes.length > 0)
              ? dmxScenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
              : [t('dmx_blue_intro'), t('dmx_orange_chorus'), t('dmx_purple_verse'), t('dmx_blackout')].map(s => (
                  <option key={s} value={s.toLowerCase().replace(' ', '_')}>{s}</option>
                ))
            }
          </select>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {['fadeIn', 'fadeOut'].map(field => (
              <div key={field}>
                <label className="text-xs text-gray-600 block mb-1">{field === 'fadeIn' ? 'Fade In (ms)' : 'Fade Out (ms)'}</label>
                <input
                  type="number" step="100" min="0"
                  value={(cue.data as Record<string, number>)[field] ?? 1000}
                  onChange={e => onUpdate({ ...cue, data: { ...cue.data, [field]: parseInt(e.target.value) || 0 } })}
                  className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {cue.type === 'effect' && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">{t('cue_effect_type')}</label>
          <div className="grid grid-cols-2 gap-1">
            {['scanlines', 'glitch', 'vignette', 'hologram_flicker', 'color_shift'].map(et => (
              <button
                key={et}
                onClick={() => onUpdate({ ...cue, data: { ...cue.data, type: et } })}
                className="px-2 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: (cue.data as { type?: string }).type === et ? color + '30' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${(cue.data as { type?: string }).type === et ? color + '60' : 'rgba(255,255,255,0.08)'}`,
                  color: (cue.data as { type?: string }).type === et ? '#fff' : '#6b7280',
                }}
              >
                {et.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">{t('cue_intensity')}</label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={(cue.data as { intensity?: number }).intensity ?? 0.5}
              onChange={e => onUpdate({ ...cue, data: { ...cue.data, intensity: parseFloat(e.target.value) } })}
              className="w-full accent-orange-400"
            />
          </div>
        </div>
      )}

      {cue.type === 'camera' && (
        <div className="space-y-3">
          {/* Camera angle presets */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ángulo de Cámara</label>
            <div className="grid grid-cols-4 gap-1">
              {['front', 'side', 'top', 'custom'].map(angle => (
                <button
                  key={angle}
                  onClick={() => onUpdate({ ...cue, data: { ...cue.data, angle } })}
                  className="px-2 py-1.5 rounded text-xs font-medium capitalize transition-all"
                  style={{
                    background: (cue.data as { angle?: string }).angle === angle ? color + '30' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${(cue.data as { angle?: string }).angle === angle ? color + '60' : 'rgba(255,255,255,0.08)'}`,
                    color: (cue.data as { angle?: string }).angle === angle ? '#fff' : '#6b7280',
                  }}
                >
                  {angle}
                </button>
              ))}
            </div>
          </div>
          {/* FOV */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">
              FOV: {(cue.data as { fov?: number }).fov ?? 60}°
            </label>
            <input
              type="range" min="10" max="120" step="1"
              value={(cue.data as { fov?: number }).fov ?? 60}
              onChange={e => onUpdate({ ...cue, data: { ...cue.data, fov: parseInt(e.target.value) } })}
              className="w-full accent-blue-400"
            />
          </div>
          {/* Tilt / Pan */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'tilt', label: 'Tilt', min: -90, max: 90 },
              { key: 'pan',  label: 'Pan',  min: -90, max: 90 },
            ].map(({ key, label, min, max }) => (
              <div key={key}>
                <label className="text-xs text-gray-600 block mb-1">
                  {label}: {(cue.data as Record<string, number>)[key] ?? 0}°
                </label>
                <input
                  type="range" min={min} max={max} step="1"
                  value={(cue.data as Record<string, number>)[key] ?? 0}
                  onChange={e => onUpdate({ ...cue, data: { ...cue.data, [key]: parseInt(e.target.value) } })}
                  className="w-full accent-blue-400"
                />
              </div>
            ))}
          </div>
          {/* Zoom */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Zoom: {((cue.data as { zoom?: number }).zoom ?? 1).toFixed(2)}x
            </label>
            <input
              type="range" min="0.5" max="3" step="0.05"
              value={(cue.data as { zoom?: number }).zoom ?? 1}
              onChange={e => onUpdate({ ...cue, data: { ...cue.data, zoom: parseFloat(e.target.value) } })}
              className="w-full accent-blue-400"
            />
          </div>
        </div>
      )}

      {cue.type === 'transition' && (
        <div className="space-y-3">
          {/* Transition type */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo de Transición</label>
            <div className="grid grid-cols-2 gap-1">
              {['fade', 'wipe', 'dissolve', 'slide'].map(tt => (
                <button
                  key={tt}
                  onClick={() => onUpdate({ ...cue, data: { ...cue.data, type: tt } })}
                  className="px-2 py-1.5 rounded text-xs font-medium capitalize transition-all"
                  style={{
                    background: (cue.data as { type?: string }).type === tt ? color + '30' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${(cue.data as { type?: string }).type === tt ? color + '60' : 'rgba(255,255,255,0.08)'}`,
                    color: (cue.data as { type?: string }).type === tt ? '#fff' : '#6b7280',
                  }}
                >
                  {tt}
                </button>
              ))}
            </div>
          </div>
          {/* Duration */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">Duración (ms)</label>
            <input
              type="number" min="100" max="5000" step="100"
              value={(cue.data as { duration?: number }).duration ?? 1000}
              onChange={e => onUpdate({ ...cue, data: { ...cue.data, duration: parseInt(e.target.value) || 1000 } })}
              className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </div>
          {/* Target song */}
          {songs && songs.length > 0 && (
            <div>
              <label className="text-xs text-gray-600 block mb-1">Canción de Destino (opcional)</label>
              <select
                value={(cue.data as { toSongId?: string }).toSongId ?? ''}
                onChange={e => onUpdate({ ...cue, data: { ...cue.data, toSongId: e.target.value || undefined } })}
                className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <option value="">— siguiente automático —</option>
                {songs.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {cue.type === 'blackout' && (
        <div className="p-3 rounded-lg text-xs text-gray-500" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          El cue de Blackout apaga el renderer inmediatamente cuando el timeline llega a este punto.
        </div>
      )}

      {cue.type === 'fallback' && (
        <div className="p-3 rounded-lg text-xs text-gray-500" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          El cue de Fallback activa una animación de seguridad predefinida. Útil si falla el tracking de HoloSuit.
        </div>
      )}
    </div>
  );
}
