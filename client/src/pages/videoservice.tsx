import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Link } from 'wouter';
import {
  Play, Pause, Upload, FileText, CheckCircle2, Film, Sparkles, Star,
  ChevronDown, ChevronUp, Globe, ArrowRight, Music2, Video as VideoIcon,
  Zap, Shield, Clock, Users, MapPin, Camera, Maximize, Minimize, Volume2, VolumeX,
  Cpu, Rocket, DollarSign, Layout, Monitor, Headphones, Quote, Heart,
  MessageCircle, ExternalLink, Check, X, Target, Mic2, Building2, Palette,
  GraduationCap, BookOpen, PlayCircle, Lock, Wand2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Footer } from '../components/layout/footer';
import { t, type Lang } from '../lib/videoservice-i18n';
import { VideoIntakeForm } from '../components/videoservice/video-intake-form';
import { VideoDemoShowcase } from '../components/videoservice/video-demo-showcase';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } };

const HERO_VIDEOS = [
  { src: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/artist-profiles%2F105%2Fbanner_1771315378913_PATO%20JUVE%20CORTE%201.mp4?alt=media&token=51331fd1-f0a4-46f6-b7a5-9ae3b82a15b3', song: 'Pa To', artist: 'JUVENTINO' },
  { src: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/videos%2F105%2F1771752506412_MI%20CORAZON%20RENDER%201.mp4?alt=media', song: 'Mi Corazón', artist: 'JUVENTINO' },
  { src: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/artist-profiles%2F88%2Fbanner_1770875644053_kling_20260212_Image_to_Video_quiero_que_3297_0.mp4?alt=media&token=18addf51-5b48-4393-8a93-c879a8f480bf', song: 'Penisilina', artist: 'SOLO FRANK' },
  { src: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/artist-profiles%2F145%2Fbanner_1774039568010_preview.mp4?alt=media&token=3b8ae8c8-962e-45f5-9e01-1f22aa56ab2c', song: 'Sencilla Conexión', artist: 'Sencilla Conexion' },
];

/* ── Artist Showcase Card (fetches profile image) ───────────── */
type ShowcaseArtist = { name: string; slug: string; genre: string; gradient: string; bgGradient: string };
function ArtistShowcaseCard({ artist, ctaLabel }: { artist: ShowcaseArtist; ctaLabel: string }) {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/artist/by-slug/${artist.slug}`);
        if (!res.ok) return;
        const data = await res.json();
        const img = data?.artist?.profileImage || data?.artist?.photoURL || null;
        if (!cancelled && img) setProfileImage(img);
      } catch {
        /* silently fall back to initial */
      }
    })();
    return () => { cancelled = true; };
  }, [artist.slug]);

  return (
    <div className="group relative rounded-2xl border border-white/[0.08] overflow-hidden hover:border-white/20 transition-all duration-500 cursor-pointer">
      <div className={`aspect-[4/5] bg-gradient-to-b ${artist.bgGradient} relative flex flex-col items-center justify-center p-6`}>
        {/* Avatar: real profile image or initial fallback */}
        {profileImage && !failed ? (
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden ring-2 ring-white/20 mb-4 group-hover:scale-110 transition-transform duration-500 shadow-lg">
            <img
              src={profileImage}
              alt={artist.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setFailed(true)}
            />
          </div>
        ) : (
          <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${artist.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
            <span className="text-2xl md:text-3xl font-black text-white">{artist.name.charAt(0)}</span>
          </div>
        )}
        <h3 className="text-lg md:text-xl font-bold text-white mb-1 text-center">{artist.name}</h3>
        <p className="text-sm text-gray-400 mb-4">{artist.genre}</p>
        <div className="w-full space-y-2 px-4">
          <div className="h-2 bg-white/[0.06] rounded-full w-3/4 mx-auto" />
          <div className="h-2 bg-white/[0.04] rounded-full w-1/2 mx-auto" />
          <div className="flex gap-2 justify-center mt-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
            <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
            <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
          </div>
        </div>
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2.5 text-sm font-bold text-white">
            <ExternalLink className="w-4 h-4" /> {ctaLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── HeyGen Avatar Embed (vertical 9:16 with centered play + bottom blur) ── */
function HeyGenAvatarEmbed() {
  const [showOverlay, setShowOverlay] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePlay = () => {
    // Hide overlay and let the user interact with HeyGen's native controls
    // (which will play the video with sound since there's now a user gesture
    // on the iframe region).
    setShowOverlay(false);
    // Send a simulated click to the iframe area by focusing it. Users will
    // still need to click once more on HeyGen's play button, but the video
    // will have sound because the click is now within the iframe's origin.
    iframeRef.current?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative mx-auto rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-orange-500/10 bg-black"
      style={{ maxWidth: '360px' }}
    >
      <div className="relative w-full" style={{ aspectRatio: '9 / 16' }}>
        <iframe
          ref={iframeRef}
          src="https://app.heygen.com/embeds/cb713759140e4f3cbe4838ca1ca6d10b"
          title="Boostify — Avatar Video"
          className="absolute inset-0 w-full h-full"
          frameBorder={0}
          allow="autoplay; encrypted-media; fullscreen;"
          allowFullScreen
        />

        {/* Bottom gradient + blur to hide HeyGen watermark */}
        <div
          className="pointer-events-none absolute left-0 right-0 bottom-0 h-36"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 35%, rgba(0,0,0,0.7) 65%, rgba(0,0,0,0) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            maskImage: 'linear-gradient(to top, #000 65%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, #000 65%, transparent 100%)',
          }}
        />

        {/* Centered play overlay (shown until user clicks) */}
        {showOverlay && (
          <button
            type="button"
            onClick={handlePlay}
            aria-label="Play video"
            className="absolute inset-0 flex items-center justify-center group cursor-pointer bg-black/10 hover:bg-black/20 transition-colors"
          >
            <span className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-2xl shadow-orange-500/40 group-hover:scale-110 transition-transform duration-300 ring-4 ring-white/20">
              <Play className="w-9 h-9 md:w-11 md:h-11 text-white ml-1" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ── Boostify Promo Reel Component ─────────────────────────── */
function PromoReel({ lang }: { lang: Lang }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.5 });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isInView) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, [isInView]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  };

  return (
    <section ref={containerRef} className="py-16 md:py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950/50 to-black" />
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-orange-500/[0.06] rounded-full blur-[150px]" />

      <div className="relative max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-orange-400 font-bold mb-4 border border-orange-500/20">
            <Film className="w-3.5 h-3.5" /> SHOWREEL
          </div>
          <h2 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-white via-white to-orange-400 bg-clip-text text-transparent">
            {lang === 'es' ? 'Esto es lo que hacemos' : 'This is what we do'}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden cursor-pointer group"
          style={{
            boxShadow: '0 0 60px 8px rgba(249,115,22,0.15), 0 0 120px 20px rgba(249,115,22,0.05)',
          }}
          onClick={togglePlay}
        >
          {/* Animated border */}
          <div className="absolute inset-0 rounded-3xl border border-orange-500/20 group-hover:border-orange-500/40 transition-all duration-500 z-20 pointer-events-none" />

          <div className="aspect-video relative bg-black">
            <video
              ref={videoRef}
              src="/assets/promos/boostify-2025-profile-v2.mp4"
              className="w-full h-full object-cover"
              muted={isMuted}
              playsInline
              loop
              preload="metadata"
            />

            {/* Overlay */}
            <div className={`absolute inset-0 bg-black/30 transition-opacity duration-500 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`} />

            {/* Play/pause center */}
            <div className={`absolute inset-0 flex items-center justify-center z-10 transition-all duration-500 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-24 h-24 rounded-full bg-black/40 backdrop-blur-xl border-2 border-orange-500/60 flex items-center justify-center shadow-2xl shadow-orange-500/30"
              >
                {isPlaying
                  ? <Pause className="w-10 h-10 text-orange-400" />
                  : <Play className="w-10 h-10 text-orange-400 ml-1" />}
              </motion.div>
            </div>

            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

            {/* Mute button */}
            <button
              onClick={e => {
                e.stopPropagation();
                const v = videoRef.current;
                if (v) { v.muted = !v.muted; setIsMuted(v.muted); }
              }}
              className="absolute bottom-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>

            {/* Badge */}
            <div className="absolute top-4 left-4 z-20">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full font-bold backdrop-blur-md bg-gradient-to-r from-orange-500/40 to-red-500/40 text-white border border-orange-400/30">
                <Sparkles className="w-3.5 h-3.5" /> Boostify Showreel
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function VideoServicePage() {
  // Default to English; persist user preference in localStorage. Only auto-switch to Spanish
  // if the browser is Spanish AND the user has not made an explicit choice before.
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      const saved = window.localStorage.getItem('videoservice_lang');
      if (saved === 'es' || saved === 'en') return saved;
    } catch {}
    const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
    return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
  });

  // Persist language preference
  useEffect(() => {
    try { window.localStorage.setItem('videoservice_lang', lang); } catch {}
  }, [lang]);

  const formRef = useRef<HTMLDivElement>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' });
  const openFormModal = () => setShowFormModal(true);

  // Auto-open form modal after 10 s (once per 24 h per browser)
  useEffect(() => {
    const KEY = 'boostify_video_popup_ts';
    try {
      const last = window.localStorage.getItem(KEY);
      if (last && Date.now() - Number(last) < 86_400_000) return;
    } catch {}
    const timer = setTimeout(() => {
      setShowFormModal(true);
      try { window.localStorage.setItem(KEY, String(Date.now())); } catch {}
    }, 10_000);
    return () => clearTimeout(timer);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      const el = heroContainerRef.current;
      if (el?.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any)?.webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  }, [isFullscreen]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  // Auto-rotate hero videos
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIdx(prev => (prev + 1) % HERO_VIDEOS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const currentHero = HERO_VIDEOS[heroIdx];

  return (
    <div className="min-h-screen bg-black text-white pb-16 md:pb-0">
      {/* ── Sticky language toggle ─────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 flex items-center bg-black/60 backdrop-blur-md border border-white/15 rounded-full p-1 shadow-lg shadow-black/40">
        <button
          onClick={() => setLang('en')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
            lang === 'en'
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
          aria-pressed={lang === 'en'}
          aria-label="Switch to English"
        >
          EN
        </button>
        <button
          onClick={() => setLang('es')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
            lang === 'es'
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
          aria-pressed={lang === 'es'}
          aria-label="Cambiar a Español"
        >
          ES
        </button>
      </div>

      {/* ── HERO with Video Background ─────────────────────────────── */}
      <section ref={heroContainerRef} className="relative overflow-hidden min-h-[100svh] flex items-center px-4">
        {/* Video background carousel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={heroIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 z-0"
          >
            <video
              ref={videoRef}
              src={currentHero.src}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted={isMuted}
              loop
              playsInline
              preload="metadata"
            />
          </motion.div>
        </AnimatePresence>

        {/* Dark overlays for readability */}
        <div className="absolute inset-0 bg-black/50 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-[1]" />

        {/* Video controls - bottom right */}
        <div className="absolute bottom-6 right-4 z-20 flex gap-2">
          <button onClick={toggleMute}
            className="w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 transition-colors">
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button onClick={toggleFullscreen}
            className="w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 transition-colors">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>

        {/* Content */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="relative z-10 max-w-5xl mx-auto text-center w-full py-16 md:py-20">
          <motion.div variants={fadeUp}>
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 mb-4 md:mb-6 text-xs px-3 py-1 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 mr-1" /> Boostify Video Service
            </Badge>
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4 md:mb-6 bg-gradient-to-r from-white via-white to-orange-400 bg-clip-text text-transparent drop-shadow-2xl px-2">
            {t('heroTitle', lang)}
          </motion.h1>

          <motion.p variants={fadeUp} className="text-base md:text-xl text-gray-200 max-w-2xl mx-auto mb-8 md:mb-10 drop-shadow-lg px-4">
            {t('heroSub', lang)}
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 md:mb-12 px-4">
            <Button size="xl" className="bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/30 text-base py-4" onClick={openFormModal}>
              <Film className="w-5 h-5 mr-2" /> {t('heroCta', lang)}
            </Button>
            <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm text-base py-4" asChild>
              <a href="#pricing">{t('pricingTitle', lang)} <ArrowRight className="w-4 h-4 ml-2" /></a>
            </Button>
          </motion.div>

          {/* Now playing indicator */}
          <motion.div variants={fadeUp} className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-4 py-2">
              <Music2 className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-gray-300">
                <span className="text-white font-medium">{currentHero.song}</span>
                <span className="text-gray-500 mx-1.5">—</span>
                <span className="text-orange-400">{currentHero.artist}</span>
              </span>
            </div>
          </motion.div>

          {/* Video dots */}
          <div className="flex justify-center gap-2 mt-6">
            {HERO_VIDEOS.map((v, i) => (
              <button
                key={i}
                onClick={() => setHeroIdx(i)}
                className={`transition-all duration-300 rounded-full ${
                  i === heroIdx
                    ? 'w-8 h-2 bg-orange-500'
                    : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                }`}
                aria-label={v.song}
              />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── URGENCY BANNER ─────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-red-600/20 via-orange-500/20 to-red-600/20 border-y border-orange-500/20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-center gap-3 text-center">
          <span className="text-sm md:text-base font-bold text-orange-300 animate-pulse">{t('urgencyBadge', lang)}</span>
          <span className="hidden sm:inline text-gray-500">|</span>
          <span className="hidden sm:inline text-xs md:text-sm text-gray-400">{t('urgencyTimer', lang)}</span>
        </div>
      </div>

      {/* ── BOOSTIFY PROMO REEL ────────────────────────────────── */}
      <PromoReel lang={lang} />

      {/* ── HEYGEN AVATAR INTRO ────────────────────────────────── */}
      <section className="py-12 md:py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-orange-500/[0.05] rounded-full blur-[140px]" />
        <div className="relative max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-6 md:mb-8"
          >
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-orange-400 font-bold mb-4 border border-orange-500/20">
              <Sparkles className="w-3.5 h-3.5" /> {lang === 'es' ? 'MIRA CÓMO FUNCIONA' : 'SEE HOW IT WORKS'}
            </div>
            <h2 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-white via-white to-orange-400 bg-clip-text text-transparent">
              {lang === 'es'
                ? 'Conoce Boostify en 45 segundos'
                : 'Meet Boostify in 45 seconds'}
            </h2>
          </motion.div>

          <HeyGenAvatarEmbed />
        </div>
      </section>

      {/* ── DEMO SHOWCASE ──────────────────────────────────────────── */}
      <VideoDemoShowcase lang={lang} />

      {/* ── SOCIAL PROOF – Animated Counters ──────────────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        {/* Decorative bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950/50 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.06),transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto">
          <motion.h3 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-xl md:text-2xl font-bold mb-12 md:mb-16 bg-gradient-to-r from-gray-300 to-white bg-clip-text text-transparent">
            {t('proofTitle', lang)}
          </motion.h3>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {([
              { value: '150+', label: t('proofVideos', lang), icon: Film, color: 'from-orange-500 to-red-500' },
              { value: '80+', label: t('proofArtists', lang), icon: Users, color: 'from-blue-500 to-cyan-500' },
              { value: '12+', label: t('proofCountries', lang), icon: Globe, color: 'from-green-500 to-emerald-500' },
              { value: '99%', label: t('proofSatisfaction', lang), icon: Heart, color: 'from-pink-500 to-rose-500' },
            ]).map((s, i) => (
              <motion.div key={i} variants={fadeUp}
                className="group relative text-center p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 hover:bg-white/[0.05] transition-all duration-500">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} mb-4 group-hover:scale-110 transition-transform`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-3xl md:text-5xl font-black bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">{s.value}</div>
                <div className="text-xs md:text-sm text-gray-500 mt-2 font-medium">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS – Timeline ────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-950" />
        <div className="relative max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12 md:mb-20">
            <motion.div variants={fadeUp}>
              <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 mb-4 text-xs px-3 py-1">
                <Zap className="w-3 h-3 mr-1" /> {lang === 'es' ? 'PROCESO SIMPLE' : 'SIMPLE PROCESS'}
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold">{t('howTitle', lang)}</motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-[52px] left-[12.5%] right-[12.5%] h-[2px] bg-gradient-to-r from-orange-500/0 via-orange-500/40 to-orange-500/0" />
            {([
              { icon: Upload, key: 'howStep1' as const, dk: 'howStep1d' as const, color: 'from-orange-500 to-amber-500', num: '01' },
              { icon: FileText, key: 'howStep2' as const, dk: 'howStep2d' as const, color: 'from-blue-500 to-indigo-500', num: '02' },
              { icon: CheckCircle2, key: 'howStep3' as const, dk: 'howStep3d' as const, color: 'from-green-500 to-emerald-500', num: '03' },
              { icon: Play, key: 'howStep4' as const, dk: 'howStep4d' as const, color: 'from-purple-500 to-pink-500', num: '04' },
            ]).map((s, i) => (
              <motion.div key={i} variants={fadeUp}
                className="group relative text-center p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 hover:bg-white/[0.04] transition-all duration-500">
                <div className={`relative z-10 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${s.color} mb-5 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                  <s.icon className="w-8 h-8 text-white" />
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-black border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white">{s.num}</div>
                </div>
                <h3 className="text-lg font-bold mb-2">{t(s.key, lang)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(s.dk, lang)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── WHY BOOSTIFY – Feature Grid ────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 to-black" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/[0.03] rounded-full blur-[120px]" />
        <div className="relative max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12 md:mb-16">
            <motion.div variants={fadeUp}>
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 mb-4 text-xs px-3 py-1">
                <Sparkles className="w-3 h-3 mr-1" /> {lang === 'es' ? 'VENTAJAS' : 'ADVANTAGES'}
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">{t('whyTitle', lang)}</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 max-w-2xl mx-auto">{t('whySub', lang)}</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {([
              { icon: Cpu, key: 'whyFeature1' as const, dk: 'whyFeature1d' as const, gradient: 'from-orange-500/20 to-red-500/20', border: 'hover:border-orange-500/30', iconColor: 'text-orange-400' },
              { icon: Rocket, key: 'whyFeature2' as const, dk: 'whyFeature2d' as const, gradient: 'from-blue-500/20 to-cyan-500/20', border: 'hover:border-blue-500/30', iconColor: 'text-blue-400' },
              { icon: DollarSign, key: 'whyFeature3' as const, dk: 'whyFeature3d' as const, gradient: 'from-green-500/20 to-emerald-500/20', border: 'hover:border-green-500/30', iconColor: 'text-green-400' },
              { icon: Layout, key: 'whyFeature4' as const, dk: 'whyFeature4d' as const, gradient: 'from-purple-500/20 to-pink-500/20', border: 'hover:border-purple-500/30', iconColor: 'text-purple-400' },
              { icon: Monitor, key: 'whyFeature5' as const, dk: 'whyFeature5d' as const, gradient: 'from-cyan-500/20 to-teal-500/20', border: 'hover:border-cyan-500/30', iconColor: 'text-cyan-400' },
              { icon: Headphones, key: 'whyFeature6' as const, dk: 'whyFeature6d' as const, gradient: 'from-amber-500/20 to-yellow-500/20', border: 'hover:border-amber-500/30', iconColor: 'text-amber-400' },
            ]).map((f, i) => (
              <motion.div key={i} variants={fadeUp}
                className={`group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] ${f.border} transition-all duration-500 hover:bg-white/[0.04]`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold mb-2">{t(f.key, lang)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(f.dk, lang)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── COMPARISON TABLE: Boostify vs Traditional ─────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-950" />
        <div className="relative max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10 md:mb-14">
            <motion.div variants={fadeUp}>
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 mb-4 text-xs px-3 py-1">
                <Zap className="w-3 h-3 mr-1" /> VS
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">{t('compTitle', lang)}</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400">{t('compSub', lang)}</motion.p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="rounded-2xl border border-white/[0.08] overflow-hidden backdrop-blur-sm">
            {/* Header */}
            <div className="grid grid-cols-3 bg-white/[0.04]">
              <div className="p-4 text-sm font-bold text-gray-400 border-r border-white/[0.06]">{t('compFeature', lang)}</div>
              <div className="p-4 text-sm font-bold text-orange-400 text-center border-r border-white/[0.06] bg-orange-500/[0.06]">{t('compBoostify', lang)}</div>
              <div className="p-4 text-sm font-bold text-gray-500 text-center">{t('compTraditional', lang)}</div>
            </div>
            {/* Rows */}
            {([
              { label: 'compPrice' as const, b: 'compPriceB' as const, tr: 'compPriceT' as const },
              { label: 'compTime' as const, b: 'compTimeB' as const, tr: 'compTimeT' as const },
              { label: 'compRevisions' as const, b: 'compRevisionsB' as const, tr: 'compRevisionsT' as const },
              { label: 'compLanding' as const, b: 'compLandingB' as const, tr: 'compLandingT' as const },
              { label: 'compFormats' as const, b: 'compFormatsB' as const, tr: 'compFormatsT' as const },
              { label: 'compAI' as const, b: 'compAIB' as const, tr: 'compAIT' as const },
            ]).map((row, i) => (
              <div key={i} className={`grid grid-cols-3 border-t border-white/[0.06] ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                <div className="p-3 md:p-4 text-xs md:text-sm text-gray-300 font-medium border-r border-white/[0.06] flex items-center">{t(row.label, lang)}</div>
                <div className="p-3 md:p-4 text-xs md:text-sm text-center border-r border-white/[0.06] bg-orange-500/[0.03] flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-green-300 font-medium">{t(row.b, lang)}</span>
                </div>
                <div className="p-3 md:p-4 text-xs md:text-sm text-center flex items-center justify-center gap-1.5">
                  <X className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0" />
                  <span className="text-gray-500">{t(row.tr, lang)}</span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── ARTIST PAGE SHOWCASE ───────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 to-black" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/[0.04] rounded-full blur-[120px]" />
        <div className="relative max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10 md:mb-14">
            <motion.div variants={fadeUp}>
              <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 mb-4 text-xs px-3 py-1">
                <Layout className="w-3 h-3 mr-1" /> LANDING PAGES
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">{t('artistShowcaseTitle', lang)}</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 max-w-2xl mx-auto">{t('artistShowcaseSub', lang)}</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {([
              { name: 'JUVENTINO', slug: 'juventino', genre: lang === 'es' ? 'Artista Urbano' : 'Urban Artist', gradient: 'from-orange-500 to-red-500', bgGradient: 'from-orange-500/10 to-red-500/5' },
              { name: 'RAUL DEL SOL', slug: 'raul-del-sol', genre: lang === 'es' ? 'Cantante' : 'Singer', gradient: 'from-amber-500 to-orange-500', bgGradient: 'from-amber-500/10 to-orange-500/5' },
              { name: 'Sencilla Conexion', slug: 'sencilla-conexion', genre: lang === 'es' ? 'Banda Indie' : 'Indie Band', gradient: 'from-cyan-500 to-blue-500', bgGradient: 'from-cyan-500/10 to-blue-500/5' },
            ]).map((artist, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Link href={`/artist/${artist.slug}`}>
                  <ArtistShowcaseCard artist={artist} ctaLabel={t('artistShowcaseCta', lang)} />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── WHO IS THIS FOR ────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-950" />
        <div className="relative max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10 md:mb-14">
            <motion.div variants={fadeUp}>
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 mb-4 text-xs px-3 py-1">
                <Target className="w-3 h-3 mr-1" /> {lang === 'es' ? 'PARA TI' : 'FOR YOU'}
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">{t('whoTitle', lang)}</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400">{t('whoSub', lang)}</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { icon: Mic2, key: 'who1' as const, color: 'text-orange-400', bg: 'from-orange-500/20 to-red-500/20' },
              { icon: DollarSign, key: 'who2' as const, color: 'text-green-400', bg: 'from-green-500/20 to-emerald-500/20' },
              { icon: Building2, key: 'who3' as const, color: 'text-blue-400', bg: 'from-blue-500/20 to-cyan-500/20' },
              { icon: Palette, key: 'who4' as const, color: 'text-purple-400', bg: 'from-purple-500/20 to-pink-500/20' },
            ]).map((item, i) => (
              <motion.div key={i} variants={fadeUp}
                className="flex items-start gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.bg} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <p className="text-sm md:text-base text-gray-300 font-medium leading-relaxed pt-2">{t(item.key, lang)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PRICING CARDS ──────────────────────────────────────────── */}
      <section id="pricing" className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-950" />
        <div className="relative max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12 md:mb-16">
            <motion.div variants={fadeUp}>
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20 mb-4 text-xs px-3 py-1">
                <DollarSign className="w-3 h-3 mr-1" /> {lang === 'es' ? 'PRECIOS TRANSPARENTES' : 'TRANSPARENT PRICING'}
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">{t('pricingTitle', lang)}</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400">{t('pricingSub', lang)}</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* AI Card */}
            <motion.div variants={fadeUp}
              className="group relative bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 rounded-3xl p-8 hover:border-orange-500/40 transition-all duration-500 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <Badge className="absolute -top-1 right-0 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 shadow-lg shadow-orange-500/30">{t('popular', lang)}</Badge>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{t('aiCardTitle', lang)}</h3>
                    <p className="text-xs text-gray-500">{t('aiCardDeposit', lang)}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-6">{t('aiCardDesc', lang)}</p>
                <div className="mb-8 flex items-baseline gap-1 flex-wrap">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{t('aiCardPrice', lang)}</span>
                  <span className="text-5xl font-black bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent ml-2">$5,999</span>
                  <span className="text-sm text-gray-500 ml-1">+</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {(['aiFeature1', 'aiFeature2', 'aiFeature3', 'aiFeature4', 'aiFeature5'] as const).map(k => (
                    <li key={k} className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />
                      </div>
                      {t(k, lang)}
                    </li>
                  ))}
                </ul>
                <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/20 py-3 text-base font-bold" onClick={openFormModal}>
                  {t('selectPlan', lang)} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>

            {/* Premium Card */}
            <motion.div variants={fadeUp}
              className="group relative bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 rounded-3xl p-8 hover:border-purple-500/40 transition-all duration-500 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{t('premiumCardTitle', lang)}</h3>
                    <p className="text-xs text-gray-500">{t('premiumCardDeposit', lang)}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-6">{t('premiumCardDesc', lang)}</p>
                <div className="mb-8 flex items-baseline gap-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{t('premiumCardPrice', lang)}</span>
                  <span className="text-5xl font-black bg-gradient-to-b from-purple-400 to-purple-600 bg-clip-text text-transparent ml-2">$15,000</span>
                  <span className="text-sm text-gray-500 ml-1">+</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {(['premiumFeature1', 'premiumFeature2', 'premiumFeature3', 'premiumFeature4', 'premiumFeature5'] as const).map(k => (
                    <li key={k} className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                      {t(k, lang)}
                    </li>
                  ))}
                </ul>
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/20 py-3 text-base font-bold" onClick={openFormModal}>
                  {t('selectPlan', lang)} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 to-black" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
        <div className="relative max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12 md:mb-16">
            <motion.div variants={fadeUp}>
              <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20 mb-4 text-xs px-3 py-1">
                <Heart className="w-3 h-3 mr-1" /> {lang === 'es' ? 'TESTIMONIOS' : 'TESTIMONIALS'}
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">{t('testimonialsTitle', lang)}</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400">{t('testimonialsSub', lang)}</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {([
              { text: 'testimonial1' as const, author: 'testimonial1Author' as const, role: 'testimonial1Role' as const, gradient: 'from-orange-500 to-red-500', initial: 'J' },
              { text: 'testimonial2' as const, author: 'testimonial2Author' as const, role: 'testimonial2Role' as const, gradient: 'from-blue-500 to-purple-500', initial: 'S' },
              { text: 'testimonial3' as const, author: 'testimonial3Author' as const, role: 'testimonial3Role' as const, gradient: 'from-green-500 to-teal-500', initial: 'SC' },
            ]).map((tm, i) => (
              <motion.div key={i} variants={fadeUp}
                className="group relative p-6 md:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 hover:bg-white/[0.04] transition-all duration-500">
                {/* Quote icon */}
                <Quote className="w-8 h-8 text-white/[0.06] absolute top-6 right-6" />
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className="w-4 h-4 fill-orange-400 text-orange-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">"{t(tm.text, lang)}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${tm.gradient} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {tm.initial}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{t(tm.author, lang)}</div>
                    <div className="text-xs text-gray-500">{t(tm.role, lang)}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW TO MAKE AI VIDEOS – Tutorial Section ───────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-cyan-500/[0.03] rounded-full blur-[150px]" />
        <div className="relative max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12 md:mb-16">
            <motion.div variants={fadeUp}>
              <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 mb-4 text-xs px-3 py-1">
                <Wand2 className="w-3 h-3 mr-1" /> {t('aiTutorialBadge', lang)}
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">{t('aiTutorialTitle', lang)}</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 max-w-2xl mx-auto">{t('aiTutorialSub', lang)}</motion.p>
          </motion.div>

          {/* Steps grid */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {([
              { num: '01', icon: Sparkles, title: t('aiTutStep1', lang), desc: t('aiTutStep1d', lang), color: 'from-cyan-500 to-blue-600', iconColor: 'text-cyan-400', border: 'hover:border-cyan-500/30' },
              { num: '02', icon: Cpu, title: t('aiTutStep2', lang), desc: t('aiTutStep2d', lang), color: 'from-purple-500 to-pink-600', iconColor: 'text-purple-400', border: 'hover:border-purple-500/30' },
              { num: '03', icon: Film, title: t('aiTutStep3', lang), desc: t('aiTutStep3d', lang), color: 'from-orange-500 to-red-600', iconColor: 'text-orange-400', border: 'hover:border-orange-500/30' },
            ]).map((step, i) => (
              <motion.div key={i} variants={fadeUp}
                className={`group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] ${step.border} transition-all duration-500 hover:bg-white/[0.04]`}>
                <div className="absolute top-4 right-4 text-4xl font-black text-white/[0.04] group-hover:text-white/[0.08] transition-colors">{step.num}</div>
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Tools used */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">{t('aiTutToolsLabel', lang)}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {(
                [
                  // Boostify native tools (highlighted)
                  { name: 'Boostify Video Editor', boostify: true, href: '/timeline' },
                  { name: 'Boostify Image Generator', boostify: true, href: '/image-generator' },
                  { name: 'Boostify Music Generator', boostify: true, href: '/music-generator' },
                  { name: 'Boostify TV', boostify: true, href: '/boostify-tv' },
                  { name: 'Boostify Artist Studio', boostify: true, href: '/my-artists' },
                ] as Array<{ name: string; boostify: boolean; href: string }>
              ).map((tool) => (
                tool.boostify ? (
                  <Link key={tool.name} href={tool.href}>
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/15 to-red-500/10 border border-orange-500/30 text-sm text-orange-200 font-semibold hover:from-orange-500/25 hover:to-red-500/20 hover:border-orange-400/50 transition-all duration-300 cursor-pointer">
                      <Sparkles className="w-3.5 h-3.5 text-orange-400" /> {tool.name}
                    </span>
                  </Link>
                ) : (
                  <span key={tool.name} className="px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm text-gray-300 font-medium hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300">
                    {tool.name}
                  </span>
                )
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── AI VIDEO COURSE – PRESALE ──────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-black to-zinc-950" />
        <div className="absolute top-1/2 right-1/4 w-[600px] h-[600px] bg-emerald-500/[0.04] rounded-full blur-[150px]" />
        <div className="relative max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              {/* Left: Course info */}
              <motion.div variants={fadeUp}>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-5 text-xs px-3 py-1">
                  <GraduationCap className="w-3 h-3 mr-1" /> {t('coursePresaleBadge', lang)}
                </Badge>
                <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
                  <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">{t('courseTitle', lang)}</span>
                </h2>
                <p className="text-gray-400 mb-6 text-sm md:text-base leading-relaxed">{t('courseDesc', lang)}</p>

                {/* Module list */}
                <div className="space-y-3 mb-8">
                  {([
                    { icon: BookOpen, text: t('courseMod1', lang) },
                    { icon: Wand2, text: t('courseMod2', lang) },
                    { icon: Film, text: t('courseMod3', lang) },
                    { icon: PlayCircle, text: t('courseMod4', lang) },
                    { icon: Rocket, text: t('courseMod5', lang) },
                    { icon: DollarSign, text: t('courseMod6', lang) },
                  ]).map((mod, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <mod.icon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-sm text-gray-300">{mod.text}</span>
                    </div>
                  ))}
                </div>

                {/* What you get */}
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 mb-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t('courseIncludes', lang)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([t('courseIncl1', lang), t('courseIncl2', lang), t('courseIncl3', lang), t('courseIncl4', lang)] as string[]).map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="text-xs text-gray-400">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Right: Pricing card */}
              <motion.div variants={fadeUp}>
                <div className="relative group">
                  {/* Glow */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-3xl p-8 md:p-10 overflow-hidden">
                    {/* Corner badge */}
                    <div className="absolute -top-px -right-px">
                      <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-xl rounded-tr-3xl uppercase tracking-wider">
                        {t('coursePresaleTag', lang)}
                      </div>
                    </div>

                    <div className="text-center mb-8">
                      <p className="text-sm text-gray-500 mb-1">{t('coursePresaleLabel', lang)}</p>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-lg text-gray-500 line-through">$599</span>
                        <span className="text-6xl font-black bg-gradient-to-b from-emerald-400 to-emerald-600 bg-clip-text text-transparent">$299</span>
                      </div>
                      <p className="text-xs text-emerald-400 mt-2 font-medium">{t('courseSaveLabel', lang)}</p>
                    </div>

                    {/* Presale perks */}
                    <div className="space-y-3 mb-8">
                      {([t('coursePerk1', lang), t('coursePerk2', lang), t('coursePerk3', lang), t('coursePerk4', lang)] as string[]).map((perk, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-sm text-gray-300">{perk}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <Button
                      size="xl"
                      className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold text-base py-5 shadow-lg shadow-emerald-500/20"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/stripe/create-course-checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ courseId: 'ai_video_course', amount: 29900 }),
                          });
                          const data = await res.json();
                          if (data.url) window.location.href = data.url;
                        } catch (err) {
                          console.error('Checkout error:', err);
                        }
                      }}
                    >
                      <Lock className="w-4 h-4 mr-2" /> {t('courseBuyCta', lang)}
                    </Button>

                    <p className="text-center text-[10px] text-gray-500 mt-4">{t('courseGuarantee', lang)}</p>

                    {/* Limited spots */}
                    <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
                      <p className="text-xs text-orange-400 font-bold animate-pulse">{t('courseLimited', lang)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── VALUE-ADD BANNER ────────────────────────────────────────── */}
      <section className="py-16 md:py-20 px-4">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600/30 via-orange-500/20 to-purple-600/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(249,115,22,0.3),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.2),transparent_50%)]" />
          <div className="absolute inset-0 border border-orange-500/20 rounded-3xl" />
          <div className="relative p-8 md:p-14 text-center">
            <div className="inline-flex items-center gap-2 bg-orange-500/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-orange-300 font-bold mb-6 border border-orange-500/30">
              <Zap className="w-3.5 h-3.5" /> BONUS
            </div>
            <h3 className="text-2xl md:text-4xl font-black mb-4">{t('valueBannerTitle', lang)}</h3>
            <p className="text-gray-300 max-w-2xl mx-auto mb-8 text-sm md:text-base">{t('valueBannerDesc', lang)}</p>
            <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/30 font-bold text-base px-8" onClick={openFormModal}>
              {t('valueBannerCta', lang)} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ── INTAKE FORM ────────────────────────────────────────────── */}
      <section ref={formRef} className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/[0.03] rounded-full blur-[150px]" />
        <div className="relative max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10 md:mb-14">
            <motion.div variants={fadeUp}>
              <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 mb-4 text-xs px-3 py-1">
                <Film className="w-3 h-3 mr-1" /> {lang === 'es' ? 'SOLICITUD GRATUITA' : 'FREE REQUEST'}
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">{t('formTitle', lang)}</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 text-sm md:text-base">{t('formSub', lang)}</motion.p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}>
            <VideoIntakeForm lang={lang} />
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-950" />
        <div className="relative max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10 md:mb-14">
            <motion.div variants={fadeUp}>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 mb-4 text-xs px-3 py-1">
                <Shield className="w-3 h-3 mr-1" /> FAQ
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold">{t('faqTitle', lang)}</motion.h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-3">
            {(t('faq', lang) as Array<{ q: string; a: string }>).map((item, i) => (
              <motion.div key={i} variants={fadeUp}>
                <FaqItem q={item.q} a={item.a} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.08),transparent_60%)]" />
        <div className="relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl md:text-4xl font-black mb-4">{t('footerCta', lang)}</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 mb-8 text-sm md:text-base">{t('footerCtaSub', lang)}</motion.p>
            <motion.div variants={fadeUp}>
              <Button size="xl" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 font-bold text-base py-5 px-10 shadow-lg shadow-orange-500/30" onClick={openFormModal}>
                {t('heroCta', lang)} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── WHATSAPP FLOATING BUTTON ──────────────────────────── */}
      <a
        href={`https://wa.me/17865432478?text=${encodeURIComponent(t('whatsappText', lang) as string)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 md:bottom-6 right-4 z-50 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 hover:scale-110 transition-all duration-300 group"
        aria-label="WhatsApp"
      >
        <MessageCircle className="w-7 h-7 text-white" />
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-green-500/40 animate-ping opacity-75 pointer-events-none" />
      </a>

      {/* ── STICKY MOBILE CTA BAR ──────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-black/90 backdrop-blur-lg border-t border-white/10 px-4 py-3 flex items-center justify-between gap-3 safe-area-bottom">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{t('stickyFrom', lang)}</span>
          <span className="text-xl font-black bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">$5,999</span>
        </div>
        <Button
          size="lg"
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-orange-500/30 flex-shrink-0"
          onClick={openFormModal}
        >
          {t('stickyCta', lang)} <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <Footer />

      {/* ── VIDEO REQUEST FORM MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {showFormModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-5"
            style={{ backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', background: 'rgba(0,0,0,0.86)' }}
            onClick={() => setShowFormModal(false)}
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0, y: 28 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 28 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340, mass: 0.75 }}
              className="relative w-full max-w-2xl rounded-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #18212f 0%, #0f172a 100%)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(249,115,22,0.12), 0 0 60px rgba(249,115,22,0.08)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Orange top accent bar */}
              <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg,#f97316,#ef4444,#f97316)' }} />

              {/* Scrollable content */}
              <div className="max-h-[88vh] overflow-y-auto overscroll-contain scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {/* Sticky header */}
                <div
                  className="sticky top-0 z-10 flex items-start justify-between px-5 sm:px-7 pt-5 sm:pt-6 pb-4"
                  style={{ background: 'linear-gradient(to bottom, #18212f 85%, transparent)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md shadow-orange-500/30">
                        <Film className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[11px] font-bold text-orange-400 tracking-[0.18em] uppercase">
                        {lang === 'es' ? 'Solicitud Gratuita' : 'Free Request'}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      {t('formTitle', lang)}
                    </h2>
                    <p className="text-[13px] text-gray-400 mt-1 leading-relaxed">{t('formSub', lang)}</p>
                  </div>
                  <button
                    onClick={() => setShowFormModal(false)}
                    className="flex-shrink-0 ml-3 mt-0.5 w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 group"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4 text-gray-400 group-hover:text-red-400 transition-colors" />
                  </button>
                </div>

                {/* Thin divider */}
                <div className="mx-5 sm:mx-7 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(249,115,22,0.2),transparent)' }} />

                {/* Form */}
                <div className="px-5 sm:px-7 pt-4 pb-8">
                  <VideoIntakeForm lang={lang} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-300 ${open ? 'border-orange-500/30 bg-white/[0.03]' : 'border-white/[0.06] hover:border-white/10'}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-white/[0.02] transition-colors">
        <span className="font-semibold pr-4 text-sm md:text-base">{q}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${open ? 'bg-orange-500/20 rotate-180' : 'bg-white/5'}`}>
          <ChevronDown className={`w-4 h-4 transition-colors ${open ? 'text-orange-400' : 'text-gray-500'}`} />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 md:px-6 pb-5 md:pb-6 text-sm text-gray-400 leading-relaxed">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
