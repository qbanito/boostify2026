/**
 * Soundboard — Pro Edition
 * Powered by Tone.js (synthesized FX, zero file payload) + Howler (uploaded audio).
 * Features: 28 broadcast-quality effects, master reverb/limiter chain, auto-ducking,
 * 6 categories with filter, search, keyboard shortcuts (1-9), upload custom jingle,
 * waveform-style "playing" indicator, sync via Socket.io.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Slider } from '../ui/slider';
import { Input } from '../ui/input';
import { Volume2, VolumeX, Search, Upload, Sparkles, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { podcastSFX, SFX_CATALOG, type SFXCategory, type SFXDefinition } from '../../lib/podcast-sfx-engine';

interface SoundboardProps {
  onPlaySound: (soundId: string, soundName: string) => void;
  incomingSound?: { soundId: string; soundName: string; playedBy: string } | null;
  /** Called when SFX is playing (true) and when it ends (false). For sidechain ducking. */
  onDuckingChange?: (ducked: boolean) => void;
}

const CATEGORY_META: Record<SFXCategory | 'all', { label: string; emoji: string; color: string }> = {
  all:        { label: 'All',        emoji: '🎛️', color: 'from-purple-500 to-pink-500' },
  transition: { label: 'Transition', emoji: '🌀', color: 'from-blue-500 to-cyan-500' },
  reaction:   { label: 'Reaction',   emoji: '🎉', color: 'from-pink-500 to-rose-500' },
  comedy:     { label: 'Comedy',     emoji: '🤡', color: 'from-yellow-500 to-orange-500' },
  stinger:    { label: 'Stinger',    emoji: '✨', color: 'from-emerald-500 to-teal-500' },
  ambient:    { label: 'Ambient',    emoji: '🌌', color: 'from-indigo-500 to-purple-500' },
  musical:    { label: 'Musical',    emoji: '🎼', color: 'from-fuchsia-500 to-pink-500' },
};

export function Soundboard({ onPlaySound, incomingSound, onDuckingChange }: SoundboardProps) {
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SFXCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [customJingles, setCustomJingles] = useState<{ id: string; name: string; url: string }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    podcastSFX.onDuckingChange((d) => onDuckingChange?.(d));
  }, [onDuckingChange]);

  useEffect(() => { podcastSFX.setVolume(volume); }, [volume]);
  useEffect(() => { podcastSFX.setMuted(isMuted); }, [isMuted]);

  const playSound = useCallback(async (sound: SFXDefinition) => {
    setPlayingId(sound.id);
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    playTimerRef.current = setTimeout(() => setPlayingId(null), Math.max(500, sound.duration * 1000));
    await podcastSFX.play(sound.id);
    onPlaySound(sound.id, sound.name);
  }, [onPlaySound]);

  const playCustom = useCallback(async (j: { id: string; name: string; url: string }) => {
    setPlayingId(j.id);
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    playTimerRef.current = setTimeout(() => setPlayingId(null), 3000);
    await podcastSFX.playUrl(j.url, 3);
    onPlaySound(j.id, j.name);
  }, [onPlaySound]);

  // Play remote-triggered sounds for all participants
  useEffect(() => {
    if (!incomingSound) return;
    const def = SFX_CATALOG.find(s => s.id === incomingSound.soundId);
    if (def) {
      podcastSFX.play(def.id);
      setPlayingId(def.id);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      playTimerRef.current = setTimeout(() => setPlayingId(null), Math.max(500, def.duration * 1000));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSound?.soundId]);

  const filtered = useMemo(() => {
    let list: SFXDefinition[] = filter === 'all' ? SFX_CATALOG : SFX_CATALOG.filter(s => s.category === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q) || s.category.includes(q));
    }
    return list;
  }, [filter, search]);

  // Keyboard shortcuts: 1-9 → first 9 visible sounds
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= 9 && filtered[n - 1]) {
        playSound(filtered[n - 1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, playSound]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) return;
    if (file.size > 5 * 1024 * 1024) return;
    const url = URL.createObjectURL(file);
    const id = `custom-${Date.now()}`;
    setCustomJingles(prev => [...prev, { id, name: file.name.replace(/\.[^/.]+$/, '').slice(0, 18), url }]);
    e.target.value = '';
  };

  const categories: (SFXCategory | 'all')[] = ['all', 'transition', 'reaction', 'comedy', 'stinger', 'ambient', 'musical'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            Pro Soundboard
          </h4>
          <span className="text-[9px] text-purple-400/70 font-mono">v2 · Tone.js</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAdvanced(s => !s)}
            className={`text-gray-400 hover:text-white p-1 rounded ${showAdvanced ? 'text-purple-400' : ''}`}
            title="Advanced controls"
          >
            <Sliders className="w-3 h-3" />
          </button>
          <button onClick={() => setIsMuted(!isMuted)} className="text-gray-400 hover:text-white">
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            onValueChange={([v]) => { setVolume(v / 100); if (isMuted) setIsMuted(false); }}
            max={100}
            step={1}
            className="w-16"
          />
        </div>
      </div>

      <div className="relative">
        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search effects…"
          className="h-7 text-[11px] pl-7 bg-gray-900/60 border-gray-700"
        />
      </div>

      <div className="flex gap-1 flex-wrap">
        {categories.map(cat => {
          const meta = CATEGORY_META[cat];
          const active = cat === filter;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-all flex items-center gap-1 ${
                active
                  ? `bg-gradient-to-r ${meta.color} text-white shadow-md`
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
        {filtered.map((sound, idx) => {
          const isPlaying = playingId === sound.id;
          const meta = CATEGORY_META[sound.category];
          const shortcut = idx < 9 ? idx + 1 : null;
          return (
            <motion.button
              key={sound.id}
              whileTap={{ scale: 0.9 }}
              whileHover={{ y: -1 }}
              onClick={() => playSound(sound)}
              title={sound.description || `${sound.name} · ${sound.duration}s`}
              className={`relative flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-all text-center overflow-hidden ${
                isPlaying
                  ? `bg-gradient-to-br ${meta.color} border-white/40 shadow-lg shadow-purple-500/30`
                  : 'bg-gray-800/50 border-gray-700 hover:border-gray-500 hover:bg-gray-800'
              }`}
            >
              {shortcut && (
                <span className="absolute top-0.5 left-1 text-[8px] text-gray-500 font-mono">{shortcut}</span>
              )}
              <span className={`text-lg ${isPlaying ? 'animate-bounce' : ''}`}>{sound.emoji}</span>
              <span className={`text-[9px] leading-tight ${isPlaying ? 'text-white font-semibold' : 'text-gray-300'}`}>
                {sound.name}
              </span>
              {isPlaying && (
                <div className="absolute bottom-0 left-0 right-0 h-1 flex items-end justify-center gap-0.5 px-1 pb-0.5">
                  {[0, 1, 2, 3, 4].map(i => (
                    <motion.span
                      key={i}
                      className="w-0.5 bg-white rounded-full"
                      animate={{ height: ['20%', '90%', '40%', '70%', '20%'] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08 }}
                    />
                  ))}
                </div>
              )}
            </motion.button>
          );
        })}

        {customJingles.map(j => (
          <motion.button
            key={j.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => playCustom(j)}
            className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 border-dashed transition-all text-center ${
              playingId === j.id
                ? 'bg-amber-500/20 border-amber-400'
                : 'bg-amber-900/10 border-amber-700/40 hover:border-amber-500/60'
            }`}
            title={`Custom · ${j.name}`}
          >
            <span className="text-lg">🎙️</span>
            <span className="text-[9px] text-amber-200 leading-tight truncate max-w-full">{j.name}</span>
          </motion.button>
        ))}

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg border-2 border-dashed border-gray-700 hover:border-purple-500/60 hover:bg-purple-900/10 transition-all"
          title="Upload your own jingle (max 5MB)"
        >
          <Upload className="w-4 h-4 text-gray-500" />
          <span className="text-[9px] text-gray-400 leading-tight">Add jingle</span>
        </motion.button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {filtered.length === 0 && search && (
        <p className="text-[10px] text-center text-gray-500 py-2">No effects match "{search}"</p>
      )}

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[10px] text-gray-400 bg-gray-900/40 rounded p-2 space-y-1 border border-gray-800"
          >
            <p>🎚️ Master chain: <span className="text-purple-300">Reverb → Comp → Limiter</span></p>
            <p>🦆 Auto-ducking: <span className="text-emerald-300">enabled</span> during SFX playback</p>
            <p>⌨️ Shortcuts: <span className="font-mono text-amber-300">1-9</span> trigger first 9 visible effects</p>
            <p>📡 Sync: all participants hear effects via Socket.io</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {incomingSound && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-[10px] text-center text-purple-300 bg-purple-600/10 rounded p-1 border border-purple-500/20"
          >
            🔊 {incomingSound.playedBy} played <span className="font-semibold">{incomingSound.soundName}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
