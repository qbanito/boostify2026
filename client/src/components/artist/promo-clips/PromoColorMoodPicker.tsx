/**
 * PromoColorMoodPicker
 * Mood-based color palette selector — shows cinematic music video scene images
 * generated with Flux Kontext Pro for each color mood
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';

export interface ColorPalette {
  id: string;
  name: string;
  mood: string;
  emoji: string;
  colors: string[]; // 5 hex colors
  gradient: string;
  description: string;
  promptHint: string; // injected into FAL prompt
}

export const COLOR_MOODS: ColorPalette[] = [
  {
    id: 'midnight-soul',
    name: 'Midnight Soul',
    mood: 'Dark & Emotional',
    emoji: '🌑',
    colors: ['#050510', '#0d0d2b', '#1a1040', '#6c3483', '#c471ed'],
    gradient: 'linear-gradient(135deg, #050510, #6c3483)',
    description: 'Deep purples and navy for intense emotional content',
    promptHint: 'midnight palette, deep indigo and royal purple tones, mystical dark atmosphere',
  },
  {
    id: 'golden-prestige',
    name: 'Golden Prestige',
    mood: 'Luxury & Power',
    emoji: '👑',
    colors: ['#1a1000', '#3d2b00', '#7a5500', '#c9960c', '#f5d060'],
    gradient: 'linear-gradient(135deg, #1a1000, #c9960c)',
    description: 'Warm golds and ambers for success and aspiration',
    promptHint: 'luxury gold color palette, warm amber and champagne tones, prestige aesthetic',
  },
  {
    id: 'electric-storm',
    name: 'Electric Storm',
    mood: 'Energetic & Intense',
    emoji: '⚡',
    colors: ['#000a1a', '#001433', '#0047ab', '#0080ff', '#00f5ff'],
    gradient: 'linear-gradient(135deg, #000a1a, #0080ff)',
    description: 'Electric blues and cyan for high-energy performances',
    promptHint: 'electric blue and cyan palette, high voltage neon lightning atmosphere',
  },
  {
    id: 'rose-bloom',
    name: 'Rose Bloom',
    mood: 'Romantic & Soft',
    emoji: '🌹',
    colors: ['#1a000d', '#3d001a', '#8b0040', '#e91e8c', '#ffb3d1'],
    gradient: 'linear-gradient(135deg, #1a000d, #e91e8c)',
    description: 'Deep roses and blush pinks for emotional ballads',
    promptHint: 'rose and blush pink palette, romantic warm pinks, soft feminine energy',
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    mood: 'Natural & Grounded',
    emoji: '🌿',
    colors: ['#001a08', '#003314', '#006b2b', '#00a86b', '#7fff8c'],
    gradient: 'linear-gradient(135deg, #001a08, #00a86b)',
    description: 'Rich greens for organic, earthy vibes',
    promptHint: 'emerald and forest green palette, organic natural atmosphere, lush tones',
  },
  {
    id: 'desert-heat',
    name: 'Desert Heat',
    mood: 'Raw & Authentic',
    emoji: '🏜️',
    colors: ['#1a0a00', '#3d1c00', '#8b4500', '#d2691e', '#f4a460'],
    gradient: 'linear-gradient(135deg, #1a0a00, #d2691e)',
    description: 'Warm terracottas and sand for rootsy, authentic feel',
    promptHint: 'desert earth tones, terracotta and sand palette, warm sun-baked atmosphere',
  },
  {
    id: 'arctic-chrome',
    name: 'Arctic Chrome',
    mood: 'Clean & Futuristic',
    emoji: '❄️',
    colors: ['#050510', '#0a0a1a', '#1a1a2e', '#4a4a6a', '#c8c8e8'],
    gradient: 'linear-gradient(135deg, #050510, #4a4a6a)',
    description: 'Ice whites and cool grays for minimal, futuristic look',
    promptHint: 'arctic chrome palette, cool silver and ice white tones, minimal futuristic aesthetic',
  },
  {
    id: 'fire-rage',
    name: 'Fire Rage',
    mood: 'Aggressive & Bold',
    emoji: '🔥',
    colors: ['#1a0000', '#3d0000', '#8b0000', '#ff2200', '#ff9500'],
    gradient: 'linear-gradient(135deg, #1a0000, #ff2200)',
    description: 'Deep reds and fire oranges for intense, passionate energy',
    promptHint: 'fire and flame palette, intense crimson and ember orange, burning passionate energy',
  },
  {
    id: 'cosmic-dream',
    name: 'Cosmic Dream',
    mood: 'Dreamy & Spiritual',
    emoji: '🌌',
    colors: ['#000010', '#08001a', '#200040', '#7b2fff', '#e040fb'],
    gradient: 'linear-gradient(135deg, #000010, #7b2fff)',
    description: 'Cosmic purples and star-blues for spiritual, dreamy content',
    promptHint: 'cosmic nebula palette, deep space purple and magenta, ethereal galaxy tones',
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    mood: 'Party & Vibrant',
    emoji: '🪩',
    colors: ['#050005', '#0d000d', '#660066', '#ff00ff', '#ff66ff'],
    gradient: 'linear-gradient(135deg, #050005, #cc00cc)',
    description: 'Hot magentas and electric pinks for club, pop vibes',
    promptHint: 'neon magenta and hot pink palette, electric nightclub atmosphere, vibrant party energy',
  },
  {
    id: 'monochrome-power',
    name: 'Monochrome Power',
    mood: 'Bold & Timeless',
    emoji: '⬛',
    colors: ['#000000', '#1a1a1a', '#3d3d3d', '#808080', '#f0f0f0'],
    gradient: 'linear-gradient(135deg, #000000, #606060)',
    description: 'Pure black and white for iconic, timeless imagery',
    promptHint: 'high contrast monochrome palette, pure black and white, dramatic tonal range',
  },
  {
    id: 'tropical-heat',
    name: 'Tropical Heat',
    mood: 'Fun & Sunny',
    emoji: '🌴',
    colors: ['#001a00', '#006633', '#00aa55', '#ffcc00', '#ff6600'],
    gradient: 'linear-gradient(135deg, #001a00, #ff6600)',
    description: 'Vibrant greens and warm yellows for tropical, festive energy',
    promptHint: 'tropical color palette, vibrant green and warm citrus yellow-orange, festive sunny atmosphere',
  },
];

interface MoodPreview {
  moodId: string;
  imageUrl?: string;
  status: 'idle' | 'loading' | 'done' | 'error';
}

interface PromoColorMoodPickerProps {
  artistId: string;
  selectedPaletteId?: string;
  onSelectPalette: (palette: ColorPalette) => void;
  accent?: string;
}

export function PromoColorMoodPicker({ artistId, selectedPaletteId, onSelectPalette, accent = '#ec4899' }: PromoColorMoodPickerProps) {
  const [previews, setPreviews] = useState<Record<string, MoodPreview>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const selected = COLOR_MOODS.find(p => p.id === selectedPaletteId);

  // Load cached global mood preview images from Firestore on mount
  useEffect(() => {
    let cancelled = false;
    apiRequest({ url: '/api/promo-clips/previews/moods', method: 'GET' })
      .then((data: any) => {
        if (cancelled || !data?.previews) return;
        const loaded: Record<string, MoodPreview> = {};
        Object.entries(data.previews).forEach(([moodId, imageUrl]) => {
          loaded[moodId] = { moodId, imageUrl: imageUrl as string, status: 'done' };
        });
        setPreviews(prev => ({ ...loaded, ...prev }));
        // Auto-generate any missing mood scenes in the background
        const missing = COLOR_MOODS.filter(p => !loaded[p.id]);
        if (missing.length > 0) {
          (async () => {
            for (let i = 0; i < missing.length; i++) {
              if (cancelled) break;
              const palette = missing[i];
              setPreviews(p => ({ ...p, [palette.id]: { moodId: palette.id, status: 'loading' } }));
              try {
                const res: any = await apiRequest({
                  url: `/api/promo-clips/${artistId}/generate-mood-preview`,
                  method: 'POST',
                  data: { moodId: palette.id, moodName: palette.name, promptHint: palette.promptHint },
                });
                if (!cancelled && res?.imageUrl) {
                  setPreviews(p => ({ ...p, [palette.id]: { moodId: palette.id, imageUrl: res.imageUrl, status: 'done' } }));
                } else if (!cancelled) {
                  setPreviews(p => ({ ...p, [palette.id]: { moodId: palette.id, status: 'error' } }));
                }
              } catch {
                if (!cancelled) setPreviews(p => ({ ...p, [palette.id]: { moodId: palette.id, status: 'error' } }));
              }
              if (i < missing.length - 1) await new Promise(r => setTimeout(r, 800));
            }
          })();
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [artistId]);

  const generateMoodPreview = useCallback(async (palette: ColorPalette) => {
    setPreviews(prev => ({ ...prev, [palette.id]: { moodId: palette.id, status: 'loading' } }));
    try {
      const data: any = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-mood-preview`, {
        moodId: palette.id,
        moodName: palette.name,
        promptHint: palette.promptHint,
      });
      if (data.imageUrl) {
        setPreviews(prev => ({ ...prev, [palette.id]: { moodId: palette.id, imageUrl: data.imageUrl, status: 'done' } }));
      } else {
        setPreviews(prev => ({ ...prev, [palette.id]: { moodId: palette.id, status: 'error' } }));
      }
    } catch {
      setPreviews(prev => ({ ...prev, [palette.id]: { moodId: palette.id, status: 'error' } }));
    }
  }, [artistId]);

  const generateAllMoodPreviews = async () => {
    setGeneratingAll(true);
    for (let i = 0; i < COLOR_MOODS.length; i += 3) {
      const batch = COLOR_MOODS.slice(i, i + 3);
      await Promise.all(batch.map(p => generateMoodPreview(p)));
    }
    setGeneratingAll(false);
  };

  const anyLoading = Object.values(previews).some(p => p.status === 'loading');

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Color Mood</span>
          {selected && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: `${selected.colors[3]}22`, color: selected.colors[3], border: `1px solid ${selected.colors[3]}44` }}
            >
              {selected.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {generatingAll ? (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: accent }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating scenes...
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={generateAllMoodPreviews}
              disabled={anyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, rgba(236,72,153,0.18), rgba(124,58,237,0.15))',
                border: '1px solid rgba(236,72,153,0.3)',
                color: '#f9a8d4',
              }}
            >
              <Sparkles className="w-3 h-3" />
              Scene All
            </motion.button>
          )}
        </div>
      </div>

      {/* Cinematic mood scene image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {COLOR_MOODS.map((palette, idx) => {
          const preview = previews[palette.id];
          const isSelected = selectedPaletteId === palette.id;
          const isLoading = preview?.status === 'loading';

          return (
            <motion.button
              key={palette.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.025, duration: 0.28 }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelectPalette(palette)}
              className="relative group rounded-xl overflow-hidden text-left focus:outline-none"
              style={{
                aspectRatio: '2/3',
                border: isSelected
                  ? `2px solid ${palette.colors[3]}`
                  : '1px solid rgba(255,255,255,0.08)',
                boxShadow: isSelected ? `0 0 22px ${palette.colors[3]}55` : 'none',
              }}
            >
              {/* Background: generated scene image or gradient fallback */}
              <div className="absolute inset-0">
                {preview?.imageUrl ? (
                  <img
                    src={preview.imageUrl}
                    alt={palette.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full" style={{ background: palette.gradient }} />
                )}
              </div>

              {/* Bottom gradient for text readability */}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.25) 55%, transparent 100%)' }}
              />

              {/* Loading spinner */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 className="w-6 h-6 animate-spin text-white/80" />
                </div>
              )}

              {/* Generate scene button on hover (when no image yet) */}
              {!preview?.imageUrl && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <button
                    onClick={e => { e.stopPropagation(); generateMoodPreview(palette); }}
                    className="p-2 rounded-xl bg-black/70 border border-white/25 hover:border-white/50 transition-colors"
                    title="Generate scene"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-white/80" />
                  </button>
                </div>
              )}

              {/* Labels */}
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-white font-bold text-[10px] leading-tight">{palette.name}</p>
                <p className="text-white/45 text-[9px] leading-tight mt-0.5">{palette.mood}</p>
              </div>

              {/* Selected checkmark */}
              {isSelected && (
                <div
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: palette.colors[3] }}
                >
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Hover accent border */}
              <motion.div
                className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ border: `1px solid ${palette.colors[3]}55` }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Selected mood detail bar */}
      {selected && (
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{
            background: `${selected.colors[3]}0e`,
            border: `1px solid ${selected.colors[3]}33`,
          }}
        >
          {previews[selected.id]?.imageUrl ? (
            <img
              src={previews[selected.id].imageUrl}
              alt={selected.name}
              className="w-10 h-14 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-14 rounded-lg flex-shrink-0" style={{ background: selected.gradient }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">{selected.name}</p>
            <p className="text-white/50 text-xs mt-0.5">{selected.mood}</p>
            <p className="text-white/35 text-[10px] mt-1 leading-snug">{selected.description}</p>
          </div>
          <div className="flex flex-col gap-1">
            {selected.colors.map(c => (
              <div key={c} className="w-4 h-4 rounded-md" style={{ background: c }} title={c} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
