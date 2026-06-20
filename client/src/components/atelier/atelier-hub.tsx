/**
 * AtelierHub — Premium Fashion Atelier UI
 *
 * Replaces the legacy DashboardView in artist-image-advisor.tsx with:
 *  - Cinematic hero with parallax mood board
 *  - Style preset gallery (8 curated moods)
 *  - Quick "Style Studio" generator (fal-ai → OpenAI → Replicate fallback)
 *  - Tool grid for try-on / video / advisor / lookgen / gallery
 *  - Floating Messenger drawer for influencer & collaborator chat
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Shirt, Video, Wand2, Camera, Grid, Sparkles, ArrowRight, Loader2, Send,
  MessageCircle, X, ImageIcon, Download, Heart, Wand, Zap, Palette, ChevronRight,
  Bot, Star, Flame, Crown, Layers, Brush, User as UserIcon,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';

// ============================================================
// Types
// ============================================================
type ViewMode = 'dashboard' | 'tryon' | 'video' | 'advisor' | 'gallery' | 'lookgen';

interface Artist {
  id: number;
  name: string;
  artistName?: string;
  profileImage?: string;
  coverImage?: string;
  biography?: string;
  genres?: string[];
  country?: string;
  isAIGenerated?: boolean;
}

interface AtelierHubProps {
  artists: Artist[];
  selectedArtist?: Artist;
  selectedArtistId: number | null;
  setSelectedArtistId: (id: number) => void;
  onSelectMode: (mode: ViewMode) => void;
  onCreateSession: (sessionId: number) => void;
}

// ============================================================
// Style Presets (mirrors backend STYLE_PRESETS keys)
// ============================================================
const PRESETS: { id: string; label: string; emoji: string; gradient: string; preview: string; tone: string }[] = [
  { id: 'editorial',    label: 'Vogue Editorial',  emoji: '📸', gradient: 'from-rose-500 via-pink-500 to-fuchsia-600',  preview: 'linear-gradient(135deg,#fb7185,#a855f7)', tone: 'magazine cover' },
  { id: 'streetwear',   label: 'Streetwear',       emoji: '🛹', gradient: 'from-amber-500 via-orange-500 to-red-500',   preview: 'linear-gradient(135deg,#f59e0b,#ef4444)', tone: 'Tokyo / NYC' },
  { id: 'glam',         label: 'Red Carpet Glam',  emoji: '✨', gradient: 'from-yellow-400 via-amber-500 to-rose-500',   preview: 'linear-gradient(135deg,#facc15,#fb7185)', tone: 'Hollywood couture' },
  { id: 'ycoded',       label: 'Y2K / Cyber',      emoji: '🪩', gradient: 'from-cyan-400 via-fuchsia-500 to-indigo-600', preview: 'linear-gradient(135deg,#22d3ee,#6366f1)', tone: 'neon futurism' },
  { id: 'minimal',      label: 'Quiet Luxury',     emoji: '🤍', gradient: 'from-stone-300 via-amber-200 to-stone-500',  preview: 'linear-gradient(135deg,#e7e5e4,#a8a29e)', tone: 'beige minimal' },
  { id: 'afrofuturist', label: 'Afrofuturist',     emoji: '👑', gradient: 'from-amber-400 via-orange-500 to-purple-700', preview: 'linear-gradient(135deg,#f59e0b,#7c3aed)', tone: 'metallic regal' },
  { id: 'grunge',       label: 'Grunge Rock',      emoji: '🎸', gradient: 'from-zinc-700 via-red-700 to-zinc-900',      preview: 'linear-gradient(135deg,#52525b,#7f1d1d)', tone: '90s leather' },
  { id: 'athleisure',   label: 'Sport Luxe',       emoji: '⚡', gradient: 'from-emerald-500 via-teal-500 to-blue-600',   preview: 'linear-gradient(135deg,#10b981,#2563eb)', tone: 'performance lux' },
];

const ASPECT_RATIOS = [
  { id: '3:4',  label: 'Portrait',  w: 27, h: 36 },
  { id: '1:1',  label: 'Square',    w: 32, h: 32 },
  { id: '9:16', label: 'Story',     w: 22, h: 40 },
  { id: '16:9', label: 'Landscape', w: 40, h: 22 },
];

// ============================================================
// Tilt card helper hook
// ============================================================
function useTilt(intensity = 8) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotX = useSpring(useTransform(y, [-0.5, 0.5], [intensity, -intensity]), { stiffness: 200, damping: 20 });
  const rotY = useSpring(useTransform(x, [-0.5, 0.5], [-intensity, intensity]), { stiffness: 200, damping: 20 });
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { x.set(0); y.set(0); };
  return { rotX, rotY, onMove, onLeave };
}

// ============================================================
// Component
// ============================================================
export default function AtelierHub({
  artists,
  selectedArtist,
  selectedArtistId,
  setSelectedArtistId,
  onSelectMode,
  onCreateSession,
}: AtelierHubProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [activePreset, setActivePreset] = useState<string>('editorial');
  const [aspectRatio, setAspectRatio] = useState<string>('3:4');
  const [generated, setGenerated] = useState<{ imageUrl: string; provider: string; prompt: string }[]>([]);
  const [messengerOpen, setMessengerOpen] = useState(false);

  const artistName = selectedArtist?.artistName || selectedArtist?.name || '';

  // ── Auto-select preset and seed prompt from artist genre ─
  useEffect(() => {
    if (!selectedArtist?.genres?.length) return;
    const GENRE_PRESET_MAP: Record<string, string> = {
      'hip-hop': 'streetwear', 'hip hop': 'streetwear', 'rap': 'streetwear', 'trap': 'streetwear', 'drill': 'streetwear',
      'pop': 'editorial', 'k-pop': 'editorial',
      'r&b': 'glam', 'rnb': 'glam', 'soul': 'glam', 'latin pop': 'glam',
      'reggaeton': 'streetwear', 'latin': 'afrofuturist', 'salsa': 'afrofuturist', 'afrobeats': 'afrofuturist', 'afro': 'afrofuturist',
      'rock': 'grunge', 'metal': 'grunge', 'punk': 'grunge', 'alternative': 'grunge',
      'electronic': 'ycoded', 'edm': 'ycoded', 'techno': 'ycoded', 'synthpop': 'ycoded', 'cyber': 'ycoded',
      'jazz': 'minimal', 'classical': 'minimal', 'indie': 'minimal',
      'sport': 'athleisure', 'fitness': 'athleisure',
    };
    const genre = selectedArtist.genres[0].toLowerCase();
    const matchedPreset = Object.entries(GENRE_PRESET_MAP).find(([key]) => genre.includes(key))?.[1];
    if (matchedPreset) setActivePreset(matchedPreset);
    // Only seed prompt if currently empty
    setPrompt(prev => prev.trim() ? prev : `${selectedArtist.genres![0]} artist editorial look, high fashion, ${selectedArtist.artistName || selectedArtist.name}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArtistId]);

  // ── Fetch past generated looks from DB ─────────────────
  const { data: pastResultsData } = useQuery<{ success: boolean; results: any[] }>({   
    queryKey: ['/api/fashion/results', selectedArtistId],
    queryFn: () => apiRequest({ url: `/api/fashion/results?limit=12`, method: 'GET' }) as any,
    enabled: !!selectedArtistId,
    staleTime: 30000,
  });
  const pastResults = pastResultsData?.results ?? [];

  // ── Fetch session stats ─────────────────────────────────
  const { data: sessionsData } = useQuery<{ success: boolean; sessions: any[] }>({   
    queryKey: ['/api/fashion/sessions'],
    queryFn: () => apiRequest({ url: '/api/fashion/sessions', method: 'GET' }) as any,
    enabled: !!selectedArtistId,
    staleTime: 60000,
  });
  const sessionCount = sessionsData?.sessions?.length ?? 0;

  // ── Generate session helper ──────────────────────────────
  const createSession = useMutation({
    mutationFn: async (sessionType: string) => {
      return await apiRequest({
        url: '/api/fashion/sessions',
        method: 'POST',
        body: {
          sessionType,
          metadata: {
            artistId: selectedArtistId,
            artistName,
            genre: selectedArtist?.genres?.[0],
            genres: selectedArtist?.genres,
          },
        },
      });
    },
  });

  const handleStartMode = async (mode: ViewMode) => {
    if (!selectedArtistId) {
      toast({ title: 'Select an artist first', variant: 'destructive' });
      return;
    }
    const map: Record<ViewMode, string> = {
      dashboard: 'portfolio', tryon: 'tryon', video: 'video',
      advisor: 'analysis', gallery: 'portfolio', lookgen: 'generation',
    };
    try {
      const data: any = await createSession.mutateAsync(map[mode]);
      if (data?.session?.id) onCreateSession(data.session.id);
      onSelectMode(mode);
    } catch (e: any) {
      toast({ title: 'Could not start session', description: e.message, variant: 'destructive' });
    }
  };

  // ── Generate image (fallback chain backend) ─────────────
  const generate = useMutation({
    mutationFn: async (input: { prompt: string; preset: string; aspect: string }) => {
      const artistGenre = selectedArtist?.genres?.[0] ?? '';
      const artistBio = selectedArtist?.biography ?? '';
      return await apiRequest<{ success: boolean; imageUrl: string; provider: string; enhancedPrompt: string }>({
        url: '/api/fashion/atelier/generate',
        method: 'POST',
        body: {
          prompt: input.prompt,
          stylePreset: input.preset,
          aspectRatio: input.aspect,
          artistName,
          artistId: selectedArtistId,
          artistGenre,
          artistBio: artistBio.slice(0, 200),
        },
      });
    },
    onSuccess: (data) => {
      if (data?.success) {
        setGenerated(prev => [{ imageUrl: data.imageUrl, provider: data.provider, prompt: data.enhancedPrompt }, ...prev].slice(0, 12));
        toast({ title: '✨ Look generated', description: `via ${data.provider}` });
      } else {
        toast({ title: 'Generation failed', variant: 'destructive' });
      }
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.message, variant: 'destructive' }),
  });

  const onGenerate = () => {
    if (!prompt.trim()) {
      toast({ title: 'Describe the look you want', variant: 'destructive' });
      return;
    }
    generate.mutate({ prompt: prompt.trim(), preset: activePreset, aspect: aspectRatio });
  };

  return (
    <div className="relative space-y-10">
      {/* ====================================================
          🌌 Cinematic Hero
       ==================================================== */}
      <CinematicHero
        artists={artists}
        selectedArtist={selectedArtist}
        selectedArtistId={selectedArtistId}
        setSelectedArtistId={setSelectedArtistId}
      />

      {/* ====================================================
          🎨 STYLE STUDIO — Quick generator
       ==================================================== */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0F0B1A] via-[#15121F] to-[#0A0815] p-6 md:p-10"
      >
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-fuchsia-500/15 blur-[120px]" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-[120px]" />

        <div className="relative z-10 space-y-6">
          {/* Section header */}
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <Badge className="bg-gradient-to-r from-fuchsia-500/20 to-amber-500/20 text-fuchsia-200 border border-fuchsia-500/30 mb-2">
                <Brush className="h-3 w-3 mr-1" /> STYLE STUDIO · FAL AI + OpenAI fallback
              </Badge>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-rose-100 to-amber-200">Compose a</span>{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-pink-400 to-amber-300">signature look</span>
              </h2>
              <p className="text-gray-400 mt-1.5 max-w-xl">
                Describe a vibe, pick a mood, and the atelier crafts an editorial-grade image. Falls back across providers automatically.
              </p>
            </div>

            <div className="flex gap-2">
              {ASPECT_RATIOS.map(ar => (
                <button
                  key={ar.id}
                  onClick={() => setAspectRatio(ar.id)}
                  title={ar.label}
                  className={`group flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
                    aspectRatio === ar.id
                      ? 'bg-white/10 border-fuchsia-500/50 shadow-lg shadow-fuchsia-500/20'
                      : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05]'
                  }`}
                >
                  <div
                    className={`rounded ${aspectRatio === ar.id ? 'bg-gradient-to-br from-fuchsia-500 to-amber-400' : 'bg-white/30'} transition-colors`}
                    style={{ width: ar.w / 2, height: ar.h / 2 }}
                  />
                  <span className="text-[9px] uppercase tracking-wider text-gray-400">{ar.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preset gallery */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {PRESETS.map((p, i) => {
              const active = activePreset === p.id;
              return (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -3, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActivePreset(p.id)}
                  className={`relative group rounded-2xl overflow-hidden border transition-all ${
                    active ? 'border-white/40 ring-2 ring-fuchsia-500/40' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="aspect-square w-full" style={{ background: p.preview }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-between p-2.5 text-left">
                    <span className="text-xl drop-shadow">{p.emoji}</span>
                    <div>
                      <div className="text-[11px] font-bold text-white truncate leading-tight">{p.label}</div>
                      <div className="text-[9px] text-white/60 truncate">{p.tone}</div>
                    </div>
                  </div>
                  {active && (
                    <motion.div
                      layoutId="preset-pulse"
                      className="absolute inset-0 ring-2 ring-inset ring-fuchsia-400 rounded-2xl pointer-events-none"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Prompt input */}
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-400 opacity-30 blur group-focus-within:opacity-60 transition-opacity" />
            <div className="relative flex flex-col md:flex-row gap-3 bg-[#15121F]/90 backdrop-blur-xl rounded-2xl border border-white/10 p-3">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`e.g. "Oversized cropped leather jacket, silver chain belt, micro mini skirt, futuristic visor, smoky purple lighting"`}
                className="flex-1 min-h-[60px] resize-none bg-transparent border-0 focus-visible:ring-0 text-base placeholder:text-gray-500"
                rows={2}
              />
              <Button
                onClick={onGenerate}
                disabled={generate.isPending || !prompt.trim()}
                className="md:w-44 h-auto bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-400 hover:opacity-90 text-white border-0 shadow-lg shadow-fuchsia-500/30"
              >
                {generate.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Crafting…</>
                ) : (
                  <><Wand className="h-4 w-4 mr-2" /> Generate look</>
                )}
              </Button>
            </div>
          </div>

          {/* Generated gallery */}
          <AnimatePresence>
            {generated.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-fuchsia-300" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Latest looks</h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-fuchsia-500/30 via-white/5 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {generated.map((g, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="group relative rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] aspect-[3/4]"
                    >
                      <img src={g.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-black/60 text-white border-white/20 text-[9px] backdrop-blur-sm">{g.provider}</Badge>
                          <a href={g.imageUrl} target="_blank" rel="noopener noreferrer" download>
                            <Button size="icon" variant="ghost" className="h-7 w-7 bg-black/60 hover:bg-black/80 backdrop-blur-sm">
                              <Download className="h-3.5 w-3.5 text-white" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.section>

      {/* ====================================================
          � YOUR WARDROBE — Past Looks from DB + Artist Stats
       ==================================================== */}
      {(pastResults.length > 0 || sessionCount > 0 || selectedArtist) && (
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-5"
        >
          {/* Stats bar */}
          {selectedArtist && (
            <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10">
              {selectedArtist.profileImage && (
                <img src={selectedArtist.profileImage} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-fuchsia-500/30" />
              )}
              <div>
                <p className="text-white font-semibold text-sm">{selectedArtist.artistName || selectedArtist.name}</p>
                {selectedArtist.genres && selectedArtist.genres.length > 0 && (
                  <p className="text-gray-400 text-xs">{selectedArtist.genres.join(' · ')}</p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-4">
                <div className="text-center">
                  <p className="text-white font-bold text-lg">{pastResults.length}</p>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider">Looks</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">{sessionCount}</p>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider">Sessions</p>
                </div>
                {selectedArtist.country && (
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">{selectedArtist.country}</p>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider">Origin</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Past looks gallery */}
          {pastResults.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500/20 to-fuchsia-500/20 border border-rose-500/30">
                  <Heart className="h-4 w-4 text-rose-300" />
                </div>
                <h2 className="text-2xl font-bold text-white">Your Wardrobe</h2>
                <Badge className="bg-white/10 border-white/20 text-gray-300 text-xs">{pastResults.length} looks</Badge>
                <div className="flex-1 h-px bg-gradient-to-r from-rose-500/30 via-white/5 to-transparent" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {pastResults.map((r: any, i: number) => (
                  <motion.div
                    key={r.id ?? i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="group relative rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] aspect-[3/4]"
                  >
                    {(r.imageUrl || r.image_url) ? (
                      <img src={r.imageUrl || r.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-500/10 to-amber-500/10">
                        <ImageIcon className="h-8 w-8 text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between gap-1">
                        <Badge className="bg-black/60 text-white border-white/20 text-[9px] backdrop-blur-sm capitalize">
                          {r.resultType || r.result_type || 'look'}
                        </Badge>
                        {(r.imageUrl || r.image_url) && (
                          <a href={r.imageUrl || r.image_url} target="_blank" rel="noopener noreferrer" download>
                            <Button size="icon" variant="ghost" className="h-7 w-7 bg-black/60 hover:bg-black/80 backdrop-blur-sm">
                              <Download className="h-3.5 w-3.5 text-white" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </motion.section>
      )}

      {/* ====================================================
          �🛠 Atelier Tools — premium tool grid
       ==================================================== */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="space-y-5"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-fuchsia-500/20 border border-amber-500/30">
            <Crown className="h-4 w-4 text-amber-300" />
          </div>
          <h2 className="text-2xl font-bold text-white">Atelier Tools</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-amber-500/30 via-white/5 to-transparent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <ToolCard
            title="Virtual Try-On" subtitle="Dress your artist in seconds" icon={Shirt}
            gradient="from-orange-500 to-rose-500" tag="FAL Try-On"
            onClick={() => handleStartMode('tryon')}
            disabled={!selectedArtistId || createSession.isPending}
          />
          <ToolCard
            title="Fashion Video" subtitle="Animate the look (Kling)" icon={Video}
            gradient="from-purple-500 to-fuchsia-600" tag="Kling AI"
            onClick={() => handleStartMode('video')}
            disabled={!selectedArtistId || createSession.isPending}
          />
          <ToolCard
            title="AI Stylist" subtitle="Color analysis · suggestions" icon={Wand2}
            gradient="from-blue-500 to-cyan-500" tag="GPT-4o Vision"
            onClick={() => handleStartMode('advisor')}
            disabled={!selectedArtistId || createSession.isPending}
          />
          <ToolCard
            title="Look Generator" subtitle="Full editorial in 1 click" icon={Sparkles}
            gradient="from-fuchsia-500 to-amber-400" tag="4-image set"
            onClick={() => handleStartMode('lookgen')}
            disabled={!selectedArtistId || createSession.isPending}
            featured
          />
          <ToolCard
            title="Portfolio" subtitle="Browse generated wardrobe" icon={Grid}
            gradient="from-emerald-500 to-teal-500" tag="Gallery"
            onClick={() => handleStartMode('gallery')}
            disabled={!selectedArtistId}
          />
        </div>
      </motion.section>

      {/* ====================================================
          💬 Floating messenger button
       ==================================================== */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setMessengerOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-400 text-white font-semibold shadow-2xl shadow-fuchsia-500/40"
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <MessageCircle className="h-5 w-5" />
        </motion.div>
        <span className="hidden sm:inline">Atelier chat</span>
        <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] rounded-full bg-white/25 backdrop-blur">AI</span>
      </motion.button>

      {/* Messenger drawer */}
      <AtelierMessenger
        open={messengerOpen}
        onClose={() => setMessengerOpen(false)}
        artistId={selectedArtistId}
        artistName={artistName}
      />
    </div>
  );
}

// ============================================================
// 🎬 CINEMATIC HERO
// ============================================================
function CinematicHero({
  artists, selectedArtist, selectedArtistId, setSelectedArtistId,
}: {
  artists: Artist[];
  selectedArtist?: Artist;
  selectedArtistId: number | null;
  setSelectedArtistId: (id: number) => void;
}) {
  const tilt = useTilt(4);
  const [parallaxIdx, setParallaxIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setParallaxIdx(i => (i + 1) % PRESETS.length), 4500);
    return () => clearInterval(t);
  }, []);

  const moodLayer = PRESETS[parallaxIdx];

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl border border-white/10"
      style={{ rotateX: tilt.rotX as any, rotateY: tilt.rotY as any, transformPerspective: 1400 }}
      onMouseMove={tilt.onMove}
      onMouseLeave={tilt.onLeave}
    >
      {/* Animated mood backdrop */}
      <div className="relative h-[440px] md:h-[520px] w-full">          {/* Artist cover image as base layer (if available) */}
          {selectedArtist?.coverImage && (
            <motion.div
              key={`cover-${selectedArtistId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.25 }}
              transition={{ duration: 1.8 }}
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${selectedArtist.coverImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          )}        <AnimatePresence mode="sync">
          <motion.div
            key={moodLayer.id}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
            className="absolute inset-0"
            style={{ background: moodLayer.preview }}
          />
        </AnimatePresence>

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_70%,rgba(0,0,0,0.85)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />

        {/* Animated grain */}
        <div
          className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Floating orbs */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full mix-blend-screen pointer-events-none"
            style={{
              width: 220 + i * 60, height: 220 + i * 60,
              top: `${15 + i * 22}%`, left: `${10 + i * 28}%`,
              background: i === 0 ? 'rgba(244,63,94,0.35)' : i === 1 ? 'rgba(217,70,239,0.3)' : 'rgba(245,158,11,0.3)',
              filter: 'blur(80px)',
            }}
            animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
            transition={{ duration: 14 + i * 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {/* Content */}
        <div className="relative z-10 h-full p-6 md:p-12 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/10 backdrop-blur-md border border-white/20 text-white">
                <Crown className="h-3 w-3 mr-1.5 text-amber-300" /> ATELIER · PREMIUM
              </Badge>
              <Badge className="bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" /> LIVE
              </Badge>
              <Badge className="bg-fuchsia-500/20 backdrop-blur-md border border-fuchsia-400/30 text-fuchsia-200">
                <Bot className="h-3 w-3 mr-1.5" /> Multi-provider AI
              </Badge>
            </div>

            {/* Mood indicator */}
            <div className="flex items-center gap-1.5">
              {PRESETS.slice(0, 8).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setParallaxIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    parallaxIdx === i ? 'w-8 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <p className="text-xs uppercase tracking-[0.4em] text-white/70 font-light mb-2">
                Boostify · Fashion atelier
              </p>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight">
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-white via-rose-50 to-amber-100">
                  Where artists
                </span>
                <span className="block italic font-serif bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-rose-300 to-fuchsia-300">
                  become icons.
                </span>
              </h1>
            </motion.div>

            {/* Artist selector pill */}
            {artists.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap items-center gap-3"
              >
                <span className="text-sm uppercase tracking-wider text-white/60">Working with</span>
                <div className="flex flex-wrap gap-2">
                  {artists.slice(0, 6).map(a => {
                    const active = a.id === selectedArtistId;
                    return (
                      <motion.button
                        key={a.id}
                        whileHover={{ y: -2 }}
                        onClick={() => setSelectedArtistId(a.id)}
                        className={`group flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border backdrop-blur-md transition-all ${
                          active
                            ? 'bg-white/95 border-white text-black shadow-2xl'
                            : 'bg-black/30 border-white/20 text-white hover:bg-black/50'
                        }`}
                      >
                        {a.profileImage ? (
                          <img src={a.profileImage} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white/40" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center text-xs font-bold text-white">
                            {(a.artistName || a.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-semibold whitespace-nowrap">
                          {a.artistName || a.name || `Artist ${a.id}`}
                        </span>
                        {active && <Star className="h-3 w-3 fill-current" />}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// 🛠 TOOL CARD
// ============================================================
function ToolCard({
  title, subtitle, icon: Icon, gradient, tag, onClick, disabled, featured,
}: {
  title: string; subtitle: string; icon: any; gradient: string; tag?: string;
  onClick: () => void; disabled?: boolean; featured?: boolean;
}) {
  const tilt = useTilt(6);
  return (
    <motion.button
      whileHover={!disabled ? { y: -4 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      onMouseMove={tilt.onMove}
      onMouseLeave={tilt.onLeave}
      disabled={disabled}
      style={{ rotateX: tilt.rotX as any, rotateY: tilt.rotY as any, transformPerspective: 900 }}
      className={`relative group text-left rounded-2xl border overflow-hidden transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed border-white/10' : 'border-white/10 hover:border-white/20 cursor-pointer'
      } bg-gradient-to-br from-[#15121F] to-[#0A0815]`}
    >
      {featured && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-gradient-to-r from-amber-400 to-rose-500 text-white border-0 text-[9px] shadow-lg">
            <Flame className="h-2.5 w-2.5 mr-1" /> RECOMMENDED
          </Badge>
        </div>
      )}

      {/* Animated gradient sheen */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-15 transition-opacity duration-500`} />

      <div className="relative p-5 space-y-3">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          {tag && <span className="text-[9px] uppercase tracking-wider text-gray-500">{tag}</span>}
          <ArrowRight className={`h-4 w-4 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all`} />
        </div>
      </div>
    </motion.button>
  );
}

// ============================================================
// 💬 ATELIER MESSENGER (drawer)
// ============================================================
type MessengerMessage = {
  id: string;
  from: 'me' | 'collaborator' | 'ai-stylist';
  authorName?: string;
  body: string;
  createdAt: string;
};

function AtelierMessenger({
  open, onClose, artistId, artistName,
}: {
  open: boolean; onClose: () => void; artistId: number | null; artistName?: string;
}) {
  const [draft, setDraft] = useState('');
  const [thread] = useState('default');
  const listRef = useRef<HTMLDivElement>(null);

  const { data, refetch } = useQuery<{ success: boolean; messages: MessengerMessage[] }>({
    queryKey: ['/api/fashion/atelier/messages', thread],
    queryFn: async () => apiRequest({ url: `/api/fashion/atelier/messages?threadId=${thread}`, method: 'GET' }) as any,
    enabled: open,
    refetchInterval: open ? 6000 : false,
  });

  const send = useMutation({
    mutationFn: async (body: string) => {
      return await apiRequest<{ success: boolean }>({
        url: '/api/fashion/atelier/messages',
        method: 'POST',
        body: { threadId: thread, body, artistId, replyAsAI: true },
      });
    },
    onSuccess: () => { setDraft(''); refetch(); },
  });

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [data?.messages?.length]);

  const messages = data?.messages || [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-50 bg-gradient-to-b from-[#15121F] via-[#0F0B1A] to-[#0A0815] border-l border-white/10 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#15121F] animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Atelier Chat</h3>
                  <p className="text-[11px] text-gray-400">
                    AI Stylist {artistName ? `· ${artistName}` : ''}
                  </p>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8 hover:bg-white/10">
                <X className="h-4 w-4 text-gray-400" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-12 px-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-amber-500/20 border border-fuchsia-500/30 flex items-center justify-center">
                    <Sparkles className="h-7 w-7 text-fuchsia-300" />
                  </div>
                  <h4 className="text-white font-semibold mb-1">Start the conversation</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Ask the atelier AI for styling tips, share images with your collaborators, or coordinate looks with influencers in real time.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    {[
                      '✨ Suggest a streetwear palette for my next single',
                      '👗 Outfit ideas for a Y2K music video',
                      '👑 What jewelry pairs with this look?',
                    ].map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setDraft(s.replace(/^[^\s]+\s/, ''))}
                        className="text-left text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 text-gray-300 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(m => (
                <MessageBubble key={m.id} msg={m} />
              ))}

              {send.isPending && (
                <div className="flex items-center gap-2 text-xs text-gray-400 pl-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Atelier is typing…
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 bg-black/30 backdrop-blur-xl">
              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (draft.trim()) send.mutate(draft.trim());
                    }
                  }}
                  placeholder="Message the atelier…"
                  rows={1}
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none bg-white/[0.04] border-white/10 focus-visible:ring-fuchsia-500/40"
                />
                <Button
                  size="icon"
                  disabled={!draft.trim() || send.isPending}
                  onClick={() => draft.trim() && send.mutate(draft.trim())}
                  className="h-10 w-10 bg-gradient-to-r from-fuchsia-500 to-amber-400 hover:opacity-90 border-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-gray-500 mt-2 text-center">
                Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px]">Enter</kbd> to send · <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px]">Shift+Enter</kbd> for new line
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MessageBubble({ msg }: { msg: MessengerMessage }) {
  const isMe = msg.from === 'me';
  const isAI = msg.from === 'ai-stylist';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
    >
      {!isMe && (
        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isAI ? 'bg-gradient-to-br from-fuchsia-500 to-amber-400' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
        }`}>
          {isAI ? <Bot className="h-3.5 w-3.5 text-white" /> : <UserIcon className="h-3.5 w-3.5 text-white" />}
        </div>
      )}
      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isMe && msg.authorName && (
          <span className="text-[10px] text-gray-500 px-1">{msg.authorName}</span>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isMe
              ? 'bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white rounded-br-md'
              : isAI
              ? 'bg-white/[0.06] text-gray-100 border border-fuchsia-500/20 rounded-bl-md'
              : 'bg-white/[0.04] text-gray-100 rounded-bl-md'
          }`}
        >
          {msg.body}
        </div>
        <span className="text-[9px] text-gray-600 px-1">
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}
