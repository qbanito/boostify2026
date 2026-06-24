/**
 * PromoStyleSelector
 * Cinematic visual styles with AI-generated preview images (fal.ai flux kontext pro).
 * Includes a featured set of "studio singing" styles (artist singing into a vintage
 * ribbon microphone) for the per-song vertical promo shorts, plus general cinematic styles.
 * Each card shows: style name, mood description, and a generated preview from the artist's photo
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, Loader2, RefreshCw, Palette } from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';

export interface VisualStyle {
  id: string;
  name: string;
  mood: string;
  keyword: string;
  promptSuffix: string;
  colorHints: string[];
  icon: string;
  accent: string;
  bg: string;
}

export const VISUAL_STYLES: VisualStyle[] = [
  // ─────────────────────────────────────────────────────────────
  // 🎙️ STUDIO SINGING STYLES — el artista cantando frente a un
  // micrófono de cinta vintage. Pensados para los promo-shorts
  // verticales "el artista canta un trozo de la canción" (YouTube Shorts).
  // ─────────────────────────────────────────────────────────────
  {
    id: 'studio-classic-crooner',
    name: 'Crooner Clásico',
    mood: 'Elegante, atemporal, terciopelo',
    keyword: 'crooner',
    promptSuffix: 'wearing a sharp black tuxedo with a bow tie, singing with eyes half-closed into a vintage silver ribbon microphone on a chrome stand, warm tungsten lamp-lit recording studio, soft amber key light, Sinatra-era film-noir session, classy timeless crooner atmosphere, cinematic vertical portrait, photorealistic',
    colorHints: ['#140a02', '#3a2207', '#d9b96a'],
    icon: '🎙️',
    accent: '#d9b96a',
    bg: 'linear-gradient(135deg, #140a02, #2e1c06)',
  },
  {
    id: 'studio-cozy-hoodie',
    name: 'Sesión Íntima',
    mood: 'Cercano, cálido, lo-fi acústico',
    keyword: 'cozy',
    promptSuffix: 'wearing a cozy cream beige hoodie, singing softly into a vintage ribbon microphone with a foam pop filter, intimate retro home studio with vintage radios and warm glowing lamps, relaxed lo-fi acoustic session, warm cozy lighting, gentle bokeh of studio gear, cinematic vertical portrait, photorealistic',
    colorHints: ['#1a120a', '#3d2e1a', '#e8c79a'],
    icon: '🎧',
    accent: '#e8c79a',
    bg: 'linear-gradient(135deg, #1a120a, #2e2114)',
  },
  {
    id: 'studio-red-leather',
    name: 'Fuego Rojo',
    mood: 'Rock, intenso, dramático',
    keyword: 'red',
    promptSuffix: 'wearing a black leather jacket, singing passionately into a vintage ribbon microphone, dramatic deep red neon lighting, smoky atmospheric rock recording booth, high-contrast crimson rim light, edgy moody intensity, cinematic vertical portrait, photorealistic',
    colorHints: ['#1a0303', '#5c0a0a', '#ff3b3b'],
    icon: '🔥',
    accent: '#ff3b3b',
    bg: 'linear-gradient(135deg, #1a0303, #3a0808)',
  },
  {
    id: 'studio-glam-sequin',
    name: 'Glam Reflector',
    mood: 'Showbiz, brillo, espectáculo',
    keyword: 'glam',
    promptSuffix: 'wearing a black sequined jacket with gold chains, singing into a golden vintage ribbon microphone, backdrop of film reels and old Hollywood studio decor, glamorous showbiz lighting with sparkle and shimmer, retro glam spotlight, cinematic vertical portrait, photorealistic',
    colorHints: ['#120d02', '#3d2e0a', '#f2cd5a'],
    icon: '✨',
    accent: '#f2cd5a',
    bg: 'linear-gradient(135deg, #120d02, #2e2208)',
  },
  {
    id: 'studio-soul-raw',
    name: 'Soul Crudo',
    mood: 'Emotivo, R&B, luz de ventana',
    keyword: 'soul',
    promptSuffix: 'wearing a black sleeveless top with a single gold chain, singing soulfully into a vintage ribbon microphone, warm natural window light streaming across the studio, intimate raw emotional R&B session, golden-hour interior glow, cinematic vertical portrait, photorealistic',
    colorHints: ['#160d05', '#43260f', '#f0a64f'],
    icon: '🎵',
    accent: '#f0a64f',
    bg: 'linear-gradient(135deg, #160d05, #33200f)',
  },
  {
    id: 'studio-control-room',
    name: 'Sala de Control',
    mood: 'Sofisticado, productor, pro',
    keyword: 'studio',
    promptSuffix: 'wearing a black blazer and turtleneck, singing into a vintage ribbon microphone, professional mixing console and studio monitors glowing in the background, sophisticated producer-artist control-room session, cool balanced studio lighting, cinematic vertical portrait, photorealistic',
    colorHints: ['#060a0f', '#16242e', '#7fd0e8'],
    icon: '🎚️',
    accent: '#7fd0e8',
    bg: 'linear-gradient(135deg, #060a0f, #12202e)',
  },
  {
    id: 'studio-white-elegance',
    name: 'Elegancia Blanca',
    mood: 'Refinado, clase, soul-singer',
    keyword: 'white',
    promptSuffix: 'wearing a sharp elegant white suit, singing into a vintage ribbon microphone, warm luxurious recording studio with soft golden lighting, refined classy soul-singer presence, clean bright editorial glow, cinematic vertical portrait, photorealistic',
    colorHints: ['#1f1a12', '#4a3f2c', '#f5ead0'],
    icon: '🤍',
    accent: '#f5ead0',
    bg: 'linear-gradient(135deg, #1f1a12, #332b1e)',
  },
  {
    id: 'studio-denim-songwriter',
    name: 'Cantautor Denim',
    mood: 'Orgánico, unplugged, sincero',
    keyword: 'denim',
    promptSuffix: 'wearing a denim jacket, singing heartfeltly into a vintage ribbon microphone, warm acoustic studio with wood textures and soft lamps, intimate singer-songwriter unplugged session, natural warm light, organic honest mood, cinematic vertical portrait, photorealistic',
    colorHints: ['#0d1018', '#27384f', '#cf9b63'],
    icon: '🎸',
    accent: '#cf9b63',
    bg: 'linear-gradient(135deg, #0d1018, #1d2a3a)',
  },
  {
    id: 'studio-smoke-glitter',
    name: 'Humo y Brillo',
    mood: 'Cinematográfico, moody, final',
    keyword: 'smoke',
    promptSuffix: 'wearing a glittery black jacket, singing into a vintage ribbon microphone, smoky atmospheric stage with hazy beams of light, moody cinematic finale performance, dramatic spotlight cutting through the fog, glamorous dark ambiance, cinematic vertical portrait, photorealistic',
    colorHints: ['#0a0a0d', '#1c1c26', '#b9a6e0'],
    icon: '🌫️',
    accent: '#b9a6e0',
    bg: 'linear-gradient(135deg, #0a0a0d, #18181f)',
  },
  {
    id: 'cinematic-noir',
    name: 'Cinematic Noir',
    mood: 'Dark, mysterious, film grain',
    keyword: 'noir',
    promptSuffix: 'cinematic noir, dramatic low-key lighting, black and white with amber tones, 35mm film grain, deep shadows, moody atmosphere, detective magazine poster',
    colorHints: ['#1a0a00', '#3d2b0a', '#c9a857'],
    icon: '🎬',
    accent: '#c9a857',
    bg: 'linear-gradient(135deg, #1a0a00, #3d2b0a)',
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    mood: 'Futuristic, electric, cyberpunk',
    keyword: 'cyberpunk',
    promptSuffix: 'cyberpunk neon, electric magenta and cyan lighting, rain-soaked streets, holographic reflections, ultra-sharp lens, sci-fi megacity backdrop, cinematic still',
    colorHints: ['#0d0020', '#ff00ff', '#00f5ff'],
    icon: '⚡',
    accent: '#ff00ff',
    bg: 'linear-gradient(135deg, #0d0020, #1a003d)',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    mood: 'Warm, glowing, aspirational',
    keyword: 'golden',
    promptSuffix: 'golden hour sunlight, warm amber lens flare, bokeh background, cinematic color grade, editorial fashion photography, soft directional light, stunning glow',
    colorHints: ['#3d1f00', '#c97a00', '#ffe066'],
    icon: '🌅',
    accent: '#f5c518',
    bg: 'linear-gradient(135deg, #3d1f00, #7a3d00)',
  },
  {
    id: 'hyper-realistic',
    name: 'Hyper Realistic',
    mood: 'Ultra-detailed, lifelike, raw',
    keyword: 'realistic',
    promptSuffix: 'hyperrealistic photograph, 8k ultra sharp, studio lighting with rim light, skin detail and texture, professional portrait lens, celebrity magazine cover quality',
    colorHints: ['#0a0a0a', '#2d2d2d', '#e0d8d0'],
    icon: '📸',
    accent: '#e0d8d0',
    bg: 'linear-gradient(135deg, #0a0a0a, #1a1a1a)',
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    mood: 'Retro, dreamy, pastel nostalgia',
    keyword: 'vaporwave',
    promptSuffix: 'vaporwave aesthetic, pastel pink and lavender palette, 80s retro-futurism, CRT scanlines glow, sunset grid floor, tropical neon palm trees, dreamy surreal atmosphere',
    colorHints: ['#200040', '#ff6ec7', '#a78bfa'],
    icon: '🌺',
    accent: '#ff6ec7',
    bg: 'linear-gradient(135deg, #200040, #400060)',
  },
  {
    id: 'epic-fantasy',
    name: 'Epic Fantasy',
    mood: 'Mythic, powerful, magical',
    keyword: 'fantasy',
    promptSuffix: 'epic fantasy cinematic, magical particles and light rays, ancient stone setting, dramatic god-ray lighting, hero pose, Lord of the Rings production quality, awe-inspiring',
    colorHints: ['#001a2e', '#1a3d00', '#d4af37'],
    icon: '⚔️',
    accent: '#d4af37',
    bg: 'linear-gradient(135deg, #001a2e, #0a1a00)',
  },
  {
    id: 'street-grunge',
    name: 'Street Grunge',
    mood: 'Raw, urban, authentic',
    keyword: 'grunge',
    promptSuffix: 'street photography grunge, urban night environment, graffiti walls, rain puddle reflections, harsh flash photography, authentic documentary style, raw gritty urban energy',
    colorHints: ['#0d0d0d', '#1a0a00', '#ff4500'],
    icon: '🏙️',
    accent: '#ff4500',
    bg: 'linear-gradient(135deg, #0d0d0d, #1a0a00)',
  },
  {
    id: 'ethereal-dreamy',
    name: 'Ethereal Dreamy',
    mood: 'Soft, cosmic, otherworldly',
    keyword: 'ethereal',
    promptSuffix: 'ethereal dreamy portrait, soft diffused light, floating petals and particles, soft pastel galaxy background, celestial glow, impressionistic soft focus, surreal beauty',
    colorHints: ['#0a0020', '#3d1a5c', '#c084fc'],
    icon: '✨',
    accent: '#c084fc',
    bg: 'linear-gradient(135deg, #0a0020, #1a0040)',
  },
  {
    id: 'pop-art',
    name: 'Pop Art',
    mood: 'Bold, graphic, iconic',
    keyword: 'pop art',
    promptSuffix: 'pop art inspired portrait, bold flat colors, halftone dot texture, Andy Warhol style graphic intensity, high contrast, iconic graphic novel aesthetic, vibrant saturated palette',
    colorHints: ['#ff0050', '#ffee00', '#00aaff'],
    icon: '🎨',
    accent: '#ff0050',
    bg: 'linear-gradient(135deg, #1a0010, #1a1a00)',
  },
  {
    id: 'cinematic-epic',
    name: 'Hollywood Epic',
    mood: 'Blockbuster, grand, powerful',
    keyword: 'hollywood',
    promptSuffix: 'Hollywood blockbuster still frame, epic cinematic composition, drone aerial angle, Dolby Vision HDR grade, IMAX quality, action hero lighting, dramatic motion blur, Marvel Studios aesthetic',
    colorHints: ['#000d1a', '#003366', '#e8b400'],
    icon: '🏆',
    accent: '#e8b400',
    bg: 'linear-gradient(135deg, #000d1a, #001133)',
  },
];

interface StylePreview {
  styleId: string;
  imageUrl?: string;
  status: 'idle' | 'loading' | 'done' | 'error';
}

interface PromoStyleSelectorProps {
  artistId: string;
  referenceImageUrl?: string;
  selectedStyleId?: string;
  onSelectStyle: (style: VisualStyle, previewUrl?: string) => void;
  accent?: string;
}

export function PromoStyleSelector({
  artistId,
  referenceImageUrl,
  selectedStyleId,
  onSelectStyle,
  accent = '#ec4899',
}: PromoStyleSelectorProps) {
  const [previews, setPreviews] = useState<Record<string, StylePreview>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Load cached global style preview images from Firestore on mount
  useEffect(() => {
    let cancelled = false;
    apiRequest({ url: `/api/promo-clips/previews/styles`, method: 'GET' })
      .then((data: any) => {
        if (cancelled || !data?.previews) return;
        const loaded: Record<string, StylePreview> = {};
        Object.entries(data.previews).forEach(([styleId, imageUrl]) => {
          loaded[styleId] = { styleId, imageUrl: imageUrl as string, status: 'done' };
        });
        setPreviews(prev => ({ ...loaded, ...prev }));
        // Auto-generate any missing global examples in the background
        const missing = VISUAL_STYLES.filter(s => !loaded[s.id]);
        if (missing.length > 0) {
          (async () => {
            for (let i = 0; i < missing.length; i++) {
              if (cancelled) break;
              const style = missing[i];
              // Use empty referenceImageUrl so it generates a generic global example
              setPreviews(p => ({ ...p, [style.id]: { styleId: style.id, status: 'loading' } }));
              try {
                const res: any = await apiRequest({
                  url: `/api/promo-clips/${artistId}/generate-style-preview`,
                  method: 'POST',
                  data: { styleId: style.id, styleName: style.name, promptSuffix: style.promptSuffix, referenceImageUrl: '' },
                });
                if (!cancelled && res?.imageUrl) {
                  setPreviews(p => ({ ...p, [style.id]: { styleId: style.id, imageUrl: res.imageUrl, status: 'done' } }));
                } else if (!cancelled) {
                  setPreviews(p => ({ ...p, [style.id]: { styleId: style.id, status: 'error' } }));
                }
              } catch {
                if (!cancelled) setPreviews(p => ({ ...p, [style.id]: { styleId: style.id, status: 'error' } }));
              }
              // Stagger to avoid rate limiting
              if (i < missing.length - 1) await new Promise(r => setTimeout(r, 800));
            }
          })();
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [artistId]);

  const generatePreviewForStyle = async (style: VisualStyle) => {
    setPreviews(prev => ({ ...prev, [style.id]: { styleId: style.id, status: 'loading' } }));
    try {
      const data: any = await apiRequest({
        url: `/api/promo-clips/${artistId}/generate-style-preview`,
        method: 'POST',
        data: {
          styleId: style.id,
          styleName: style.name,
          promptSuffix: style.promptSuffix,
          referenceImageUrl: referenceImageUrl || '',
        },
      });
      if (data.imageUrl) {
        setPreviews(prev => ({ ...prev, [style.id]: { styleId: style.id, imageUrl: data.imageUrl, status: 'done' } }));
      } else {
        setPreviews(prev => ({ ...prev, [style.id]: { styleId: style.id, status: 'error' } }));
      }
    } catch {
      setPreviews(prev => ({ ...prev, [style.id]: { styleId: style.id, status: 'error' } }));
    }
  };

  const generateAllPreviews = async () => {
    if (!referenceImageUrl) return;
    setGeneratingAll(true);
    // Generate in batches of 3 to avoid rate limiting
    for (let i = 0; i < VISUAL_STYLES.length; i += 3) {
      const batch = VISUAL_STYLES.slice(i, i + 3);
      await Promise.all(batch.map(s => generatePreviewForStyle(s)));
    }
    setGeneratingAll(false);
  };

  const anyLoading = Object.values(previews).some(p => p.status === 'loading');

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4" style={{ color: accent }} />
          <span className="text-sm font-semibold text-white">Visual Style</span>
          {selectedStyleId && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}>
              {VISUAL_STYLES.find(s => s.id === selectedStyleId)?.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {referenceImageUrl && !generatingAll && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={generateAllPreviews}
              disabled={anyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(236,72,153,0.15))',
                border: '1px solid rgba(168,85,247,0.3)',
                color: '#d8b4fe',
              }}
            >
              <Sparkles className="w-3 h-3" />
              Preview All
            </motion.button>
          )}
          {generatingAll && (
            <div className="flex items-center gap-1.5 text-purple-300 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating...
            </div>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Style grid */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2"
          >
            {VISUAL_STYLES.map((style, idx) => {
              const preview = previews[style.id];
              const isSelected = selectedStyleId === style.id;
              const isLoading = preview?.status === 'loading';

              return (
                <motion.button
                  key={style.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3 }}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSelectStyle(style, preview?.imageUrl)}
                  className="relative group rounded-xl overflow-hidden text-left"
                  style={{
                    aspectRatio: '2/3',
                    border: isSelected
                      ? `2px solid ${style.accent}`
                      : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: isSelected ? `0 0 20px ${style.accent}55` : 'none',
                  }}
                >
                  {/* Background / Preview image */}
                  <div className="absolute inset-0">
                    {preview?.imageUrl ? (
                      <img
                        src={preview.imageUrl}
                        alt={style.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center gap-2"
                        style={{ background: style.bg }}
                      >
                        {isLoading ? (
                          <Loader2 className="w-6 h-6 animate-spin" style={{ color: style.accent }} />
                        ) : (
                          <p className="text-white font-bold text-xs text-center px-2 opacity-70 leading-tight">{style.name}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Gradient overlay */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
                    }}
                  />

                  {/* Generate preview button (hover) */}
                  {!preview?.imageUrl && !isLoading && referenceImageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); generatePreviewForStyle(style); }}
                        className="p-1.5 rounded-lg bg-black/60 border border-white/20"
                        title="Generate preview"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-white/70" />
                      </button>
                    </div>
                  )}

                  {/* Labels */}
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white font-bold text-xs leading-tight">{style.name}</p>
                    <p className="text-white/50 text-[9px] leading-tight mt-0.5 hidden sm:block">{style.mood}</p>
                  </div>

                  {/* Selected check */}
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5">
                      <CheckCircle2 className="w-4 h-4" style={{ color: style.accent }} />
                    </div>
                  )}

                  {/* Shimmer border on hover */}
                  <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ border: `1px solid ${style.accent}66` }}
                  />
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No reference image notice */}
      {!referenceImageUrl && (
        <p className="text-xs text-white/30 text-center">
          Upload a reference photo to generate personalized style previews
        </p>
      )}
    </div>
  );
}
