import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Sparkles, Film, Music2, Volume2, VolumeX, Cpu, Wand2, Eye } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { t, type Lang } from '../../lib/videoservice-i18n';

interface Props { lang: Lang }

interface DemoVideo {
  id: string;
  title: string;
  subtitle: string;
  type: 'ai' | 'real' | 'hybrid';
  genre?: string;
  gradient: string;
  glowColor: string;
  videoSrc: string;
  size: 'large' | 'medium' | 'small';
}

const LOCAL_BASE = '/assets/promos/MUSIC_VIDEOS_DEMOS';

const DEMOS: DemoVideo[] = [
  // -- Firebase-hosted (client real work) --
  {
    id: 'pato',
    title: 'Pa To',
    subtitle: 'JUVENTINO',
    type: 'hybrid',
    genre: 'Urban',
    gradient: 'from-orange-600 via-red-600 to-purple-900',
    glowColor: 'rgba(249,115,22,0.4)',
    videoSrc: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/artist-profiles%2F105%2Fbanner_1771315378913_PATO%20JUVE%20CORTE%201.mp4?alt=media&token=51331fd1-f0a4-46f6-b7a5-9ae3b82a15b3',
    size: 'large',
  },
  {
    id: 'reggaeton',
    title: 'Reggaeton',
    subtitle: 'AI Music Video',
    type: 'ai',
    genre: 'Reggaeton',
    gradient: 'from-pink-600 via-rose-500 to-red-600',
    glowColor: 'rgba(236,72,153,0.4)',
    videoSrc: `${LOCAL_BASE}/REGGAETON.mp4`,
    size: 'medium',
  },
  {
    id: 'rock',
    title: 'Rock',
    subtitle: 'AI Music Video',
    type: 'ai',
    genre: 'Rock',
    gradient: 'from-red-700 via-zinc-800 to-gray-900',
    glowColor: 'rgba(220,38,38,0.4)',
    videoSrc: `${LOCAL_BASE}/ROCK.mp4`,
    size: 'medium',
  },
  {
    id: 'corazon',
    title: 'Mi Corazón',
    subtitle: 'JUVENTINO',
    type: 'hybrid',
    genre: 'Latin Pop',
    gradient: 'from-purple-600 via-pink-600 to-blue-900',
    glowColor: 'rgba(168,85,247,0.4)',
    videoSrc: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/videos%2F105%2F1771752506412_MI%20CORAZON%20RENDER%201.mp4?alt=media',
    size: 'small',
  },
  {
    id: 'camara',
    title: 'La Cámara',
    subtitle: 'AI Generated',
    type: 'ai',
    genre: 'Cinematic',
    gradient: 'from-cyan-600 via-blue-700 to-indigo-900',
    glowColor: 'rgba(6,182,212,0.4)',
    videoSrc: `${LOCAL_BASE}/kling_la_camara_4142.mp4`,
    size: 'small',
  },
  {
    id: 'penisilina',
    title: 'Penisilina',
    subtitle: 'SOLO FRANK',
    type: 'ai',
    genre: 'Rap',
    gradient: 'from-red-600 via-rose-600 to-pink-900',
    glowColor: 'rgba(244,63,94,0.4)',
    videoSrc: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/artist-profiles%2F88%2Fbanner_1770875644053_kling_20260212_Image_to_Video_quiero_que_3297_0.mp4?alt=media&token=18addf51-5b48-4393-8a93-c879a8f480bf',
    size: 'small',
  },
  {
    id: 'shot661',
    title: 'Visual Concept',
    subtitle: 'AI Generated',
    type: 'ai',
    genre: 'Visual Art',
    gradient: 'from-emerald-600 via-teal-700 to-cyan-900',
    glowColor: 'rgba(16,185,129,0.4)',
    videoSrc: `${LOCAL_BASE}/kling_demo_661.mp4`,
    size: 'small',
  },
  {
    id: 'shot728',
    title: 'Motion Art',
    subtitle: 'AI Generated',
    type: 'ai',
    genre: 'Abstract',
    gradient: 'from-violet-600 via-purple-700 to-fuchsia-900',
    glowColor: 'rgba(139,92,246,0.4)',
    videoSrc: `${LOCAL_BASE}/kling_demo_728.mp4`,
    size: 'small',
  },
];

/* ── Hover video card ─────────────────────────────────────────── */
function VideoCard({ demo, onSelect, isExpanded }: { demo: DemoVideo; onSelect: () => void; isExpanded: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (hovering || isExpanded) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [hovering, isExpanded]);

  const typeBadge = demo.type === 'ai'
    ? { label: 'AI Generated', icon: Cpu, cls: 'bg-orange-500/50 text-orange-200 border-orange-400/40' }
    : demo.type === 'hybrid'
    ? { label: 'Real + AI', icon: Wand2, cls: 'bg-purple-500/50 text-purple-200 border-purple-400/40' }
    : { label: 'Professional', icon: Film, cls: 'bg-cyan-500/50 text-cyan-200 border-cyan-400/40' };
  const BadgeIcon = typeBadge.icon;

  return (
    <motion.div
      layout
      onClick={onSelect}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        boxShadow: hovering ? `0 0 40px 4px ${demo.glowColor}, 0 0 80px 8px ${demo.glowColor.replace('0.4', '0.15')}` : '0 0 0 0 transparent',
        transition: 'box-shadow 0.5s ease',
      }}
    >
      {/* Border glow */}
      <div className={`absolute inset-0 rounded-2xl border transition-all duration-500 z-20 pointer-events-none ${hovering ? 'border-white/30' : 'border-white/[0.08]'}`} />

      {/* Video */}
      <div className={`aspect-[9/16] md:aspect-video relative bg-gradient-to-br ${demo.gradient}`}>
        <video
          ref={ref}
          src={demo.videoSrc}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          muted
          playsInline
          loop
          preload="metadata"
        />
        {/* Gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 transition-opacity duration-500 ${hovering ? 'opacity-60' : ''}`} />
        {/* Top gradient for badge */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Animated scanlines on hover */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${hovering ? 'opacity-[0.03]' : 'opacity-0'}`}
          style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, white 2px, white 3px)' }} />

        {/* Play icon center */}
        <div className={`absolute inset-0 flex items-center justify-center z-10 transition-all duration-500 ${hovering ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            <Play className="w-6 h-6 text-white ml-0.5" />
          </div>
        </div>

        {/* Hover eye icon */}
        <motion.div
          initial={false}
          animate={{ opacity: hovering ? 1 : 0, scale: hovering ? 1 : 0.8 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center z-10"
        >
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-5 py-2.5">
            <Eye className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">Watch</span>
          </div>
        </motion.div>

        {/* Type badge top-left */}
        <div className="absolute top-3 left-3 z-20">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-full font-bold backdrop-blur-md border ${typeBadge.cls}`}>
            <BadgeIcon className="w-3 h-3" /> {typeBadge.label}
          </span>
        </div>

        {/* Genre badge top-right */}
        {demo.genre && (
          <div className="absolute top-3 right-3 z-20">
            <span className="px-2.5 py-1 text-[10px] rounded-full font-bold backdrop-blur-md bg-white/10 border border-white/20 text-white/80">
              {demo.genre}
            </span>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 inset-x-0 p-4 z-10">
          <motion.div
            initial={false}
            animate={{ y: hovering ? 0 : 4, opacity: hovering ? 1 : 0.8 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-base font-bold text-white drop-shadow-lg">{demo.title}</p>
            <p className="text-xs text-gray-300/80 mt-0.5">{demo.subtitle}</p>
          </motion.div>
          {/* Animated progress bar on hover */}
          <motion.div
            className="mt-3 h-[2px] rounded-full bg-gradient-to-r from-orange-500 to-pink-500"
            initial={{ width: '0%' }}
            animate={{ width: hovering ? '100%' : '0%' }}
            transition={{ duration: hovering ? 8 : 0.3, ease: 'linear' }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Expanded player modal ───────────────────────────────────── */
function ExpandedPlayer({ demo, onClose, lang }: { demo: DemoVideo; onClose: () => void; lang: Lang }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-5xl rounded-3xl overflow-hidden border border-white/10"
        style={{ boxShadow: `0 0 60px 10px ${demo.glowColor}, 0 0 120px 20px ${demo.glowColor.replace('0.4', '0.1')}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className={`aspect-video relative bg-gradient-to-br ${demo.gradient} cursor-pointer`} onClick={togglePlay}>
          <video
            ref={videoRef}
            src={demo.videoSrc}
            className="w-full h-full object-cover"
            muted={isMuted}
            playsInline
            loop
            autoPlay
          />
          {/* Overlay controls */}
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
            <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-md border-2 border-orange-500/60 flex items-center justify-center shadow-2xl shadow-orange-500/30">
              {isPlaying ? <Pause className="w-9 h-9 text-orange-400" /> : <Play className="w-9 h-9 text-orange-400 ml-1" />}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6 flex items-end justify-between">
            <div>
              <p className="text-xl font-bold text-white">{demo.title}</p>
              <p className="text-sm text-gray-300">{demo.subtitle}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={e => { e.stopPropagation(); setIsMuted(!isMuted); if (videoRef.current) videoRef.current.muted = !isMuted; }}
                className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Close hint */}
      <div className="absolute top-6 right-6 text-xs text-gray-500 cursor-pointer hover:text-white transition-colors" onClick={onClose}>
        ESC / Click to close
      </div>
    </motion.div>
  );
}

/* ── Main showcase ─────────────────────────────────────────── */
export function VideoDemoShowcase({ lang }: Props) {
  const [selectedDemo, setSelectedDemo] = useState<DemoVideo | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDemo(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Split into featured + grid
  const featured = DEMOS[0];
  const row1 = DEMOS.slice(1, 3); // 2 medium cards
  const row2 = DEMOS.slice(3);    // remaining small cards

  return (
    <section className="py-20 md:py-28 px-4 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-orange-500/[0.04] rounded-full blur-[150px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.04] rounded-full blur-[120px]" />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 bg-orange-500/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-orange-400 font-bold mb-5 border border-orange-500/20">
            <Sparkles className="w-3.5 h-3.5" /> {lang === 'es' ? 'NUESTRO TRABAJO' : 'OUR WORK'}
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-4 bg-gradient-to-r from-white via-white to-orange-400 bg-clip-text text-transparent">
            {t('demoTitle', lang)}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base">{t('demoSub', lang)}</p>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="space-y-4">
          {/* Featured large card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <VideoCard demo={featured} onSelect={() => setSelectedDemo(featured)} isExpanded={false} />
          </motion.div>

          {/* Row 1: 2 medium cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {row1.map((demo, i) => (
              <motion.div
                key={demo.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <VideoCard demo={demo} onSelect={() => setSelectedDemo(demo)} isExpanded={false} />
              </motion.div>
            ))}
          </div>

          {/* Row 2: smaller cards in a 4-col grid (or 2-col on mobile) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {row2.slice(0, 4).map((demo, i) => (
              <motion.div
                key={demo.id}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <VideoCard demo={demo} onSelect={() => setSelectedDemo(demo)} isExpanded={false} />
              </motion.div>
            ))}
          </div>

          {/* Extra row if more than 4 small */}
          {row2.length > 4 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {row2.slice(4).map((demo, i) => (
                <motion.div
                  key={demo.id}
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <VideoCard demo={demo} onSelect={() => setSelectedDemo(demo)} isExpanded={false} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Stats row under the grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-6 md:gap-10 mt-10 text-center"
        >
          {[
            { n: '8+', l: lang === 'es' ? 'Estilos' : 'Styles' },
            { n: 'AI', l: lang === 'es' ? 'Generado' : 'Powered' },
            { n: '4K', l: lang === 'es' ? 'Calidad' : 'Quality' },
            { n: '48h', l: lang === 'es' ? 'Entrega' : 'Delivery' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-2xl md:text-3xl font-black bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">{s.n}</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-medium mt-1 uppercase tracking-wider">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Expanded player modal */}
      <AnimatePresence>
        {selectedDemo && (
          <ExpandedPlayer demo={selectedDemo} onClose={() => setSelectedDemo(null)} lang={lang} />
        )}
      </AnimatePresence>
    </section>
  );
}
