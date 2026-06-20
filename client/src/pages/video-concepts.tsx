import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
  Sparkles, Crown, Camera, Heart, Building2, Film, Wand2,
  ChevronDown, Globe, ArrowRight, Check, Layers, Palette,
  Music2, Lock, Star, Image as ImageIcon, ChevronLeft, ChevronRight,
  Clapperboard, Mic2, Award, BookOpen, ShoppingBag, Mail, Smartphone,
  Plane, MapPin, X as XIcon, Ticket,
} from 'lucide-react';
import { Footer } from '../components/layout/footer';
import { t, type Lang } from '../lib/video-concepts-i18n';
import { EventIntakeForm } from '../components/video-concepts/event-intake-form';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };

const IMG = (slug: string) => `/video-concepts/${slug}.jpg`;

/* ── 12 specialised creative roles (label per language) ───────── */
const AGENTS: Array<{ icon: React.ReactNode; es: { name: string; desc: string }; en: { name: string; desc: string } }> = [
  { icon: <Clapperboard />, es: { name: 'Director Creativo', desc: 'Define concepto, mood y narrativa.' }, en: { name: 'Creative Director', desc: 'Defines concept, mood and narrative.' } },
  { icon: <Wand2 />, es: { name: 'Storyteller', desc: 'Diseña actos, escenas y emociones.' }, en: { name: 'Storyteller', desc: 'Designs acts, scenes and emotions.' } },
  { icon: <Camera />, es: { name: 'Director de Foto', desc: 'Encuadre, luz y lenguaje visual.' }, en: { name: 'Director of Photography', desc: 'Framing, light and visual language.' } },
  { icon: <Palette />, es: { name: 'Director de Arte', desc: 'Paleta, estética y dirección visual.' }, en: { name: 'Art Director', desc: 'Palette, aesthetics and visual direction.' } },
  { icon: <ImageIcon />, es: { name: 'Stylist Editorial', desc: 'Imagen editorial premium del evento.' }, en: { name: 'Editorial Stylist', desc: 'Premium editorial imagery for your event.' } },
  { icon: <Film />, es: { name: 'Editor Principal', desc: 'Edita la película con ritmo cinematográfico.' }, en: { name: 'Lead Editor', desc: 'Edits the film with cinematic pacing.' } },
  { icon: <Music2 />, es: { name: 'Music Supervisor', desc: 'Selecciona y sincroniza la música.' }, en: { name: 'Music Supervisor', desc: 'Selects and syncs the score.' } },
  { icon: <Mic2 />, es: { name: 'Sound Designer', desc: 'Diseño de sonido y mezcla premium.' }, en: { name: 'Sound Designer', desc: 'Premium sound design and mix.' } },
  { icon: <Sparkles />, es: { name: 'Colorista', desc: 'Color-grading editorial premium.' }, en: { name: 'Colourist', desc: 'Premium editorial colour grading.' } },
  { icon: <Heart />, es: { name: 'Emotion Curator', desc: 'Dirige el ritmo emocional del film.' }, en: { name: 'Emotion Curator', desc: 'Directs the emotional pacing.' } },
  { icon: <Lock />, es: { name: 'Gallery Builder', desc: 'Construye la galería privada del evento.' }, en: { name: 'Gallery Builder', desc: 'Builds the private event gallery.' } },
  { icon: <Award />, es: { name: 'Quality Guardian', desc: 'Auditoría final premium del entregable.' }, en: { name: 'Quality Guardian', desc: 'Premium final audit of every deliverable.' } },
];

/* ── Deliverables list ────────────────────────────────────────── */
const DELIVERABLES = [
  { es: 'Película principal del evento (hasta 15 min)', en: 'Main event film (up to 15 min)' },
  { es: 'Trailer cinematográfico de 60s', en: '60s cinematic trailer' },
  { es: 'Reels verticales 9:16 listos para redes', en: 'Vertical 9:16 reels ready for social' },
  { es: 'Galería privada interactiva', en: 'Private interactive gallery' },
  { es: 'Imagen editorial premium', en: 'Premium editorial imagery' },
  { es: 'Color-grading editorial', en: 'Editorial colour grading' },
  { es: 'Música y diseño sonoro premium', en: 'Premium music and sound design' },
  { es: 'Treatment y guion visual', en: 'Treatment and visual script' },
];

const PKG_FEATURES_ES = [
  ['Película principal hasta 6 min', 'Trailer 60s', '1 reel vertical', 'Galería privada', 'Treatment visual'],
  ['Película hasta 12 min', 'Trailer 90s', '3 reels verticales', 'Imágenes editoriales premium', 'Galería + análisis'],
  ['Película extendida hasta 20 min', 'Trailer cinematográfico', '6+ reels', 'Locación + equipo dedicado', 'Cobertura multi-cámara'],
];
const PKG_FEATURES_EN = [
  ['Main film up to 6 min', '60s trailer', '1 vertical reel', 'Private gallery', 'Visual treatment'],
  ['Film up to 12 min', '90s trailer', '3 vertical reels', 'Premium editorial imagery', 'Gallery + analytics'],
  ['Extended film up to 20 min', 'Cinematic trailer', '6+ reels', 'On-location dedicated crew', 'Multi-camera coverage'],
];

const FAQ_KEYS: Array<['faq1Q', 'faq1A'] | ['faq2Q', 'faq2A'] | ['faq3Q', 'faq3A'] | ['faq4Q', 'faq4A']> = [
  ['faq1Q', 'faq1A'],
  ['faq2Q', 'faq2A'],
  ['faq3Q', 'faq3A'],
  ['faq4Q', 'faq4A'],
];

/* ============================================================
   Hero carousel slides
   ============================================================ */
const HERO_SLIDES: Array<{ img: string; titleKey: 'heroSlide1' | 'heroSlide2' | 'heroSlide3' | 'heroSlide4'; tint: string }> = [
  { img: IMG('cat-wedding'), titleKey: 'heroSlide1', tint: 'from-rose-900/50 via-black/55 to-black' },
  { img: IMG('cat-quinceanera'), titleKey: 'heroSlide2', tint: 'from-amber-900/45 via-black/55 to-black' },
  { img: IMG('cat-corporate'), titleKey: 'heroSlide3', tint: 'from-sky-900/45 via-black/55 to-black' },
  { img: IMG('cat-legacy'), titleKey: 'heroSlide4', tint: 'from-violet-900/50 via-black/55 to-black' },
];

/* ============================================================
   Page
   ============================================================ */
export default function VideoConceptsPage() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'es';
    return (window.localStorage.getItem('video_concepts_lang') as Lang) || 'es';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('video_concepts_lang', lang);
  }, [lang]);

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroIdx, setHeroIdx] = useState(0);

  // Auto-rotate hero slides every 6s
  useEffect(() => {
    const id = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(id);
  }, []);

  const cats = useMemo(
    () => [
      { titleKey: 'cat1Title', descKey: 'cat1Desc', img: IMG('cat-quinceanera'), icon: <Crown /> },
      { titleKey: 'cat2Title', descKey: 'cat2Desc', img: IMG('cat-wedding'), icon: <Heart /> },
      { titleKey: 'cat3Title', descKey: 'cat3Desc', img: IMG('cat-corporate'), icon: <Building2 /> },
      { titleKey: 'cat4Title', descKey: 'cat4Desc', img: IMG('cat-legacy'), icon: <Film /> },
      { titleKey: 'cat5Title', descKey: 'cat5Desc', img: IMG('cat-premiere'), icon: <Sparkles />, badge: 'NEW', href: '/event-creator' } as any,
    ] as const,
    [],
  );

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Top nav strip with language toggle */}
      <div className="sticky top-0 z-40 backdrop-blur-md bg-black/60 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-[0.18em] text-white/80 hover:text-white">
            BOOSTIFY <span className="text-amber-400">VIDEO CONCEPTS</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/event-creator"
              className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold hover:opacity-90 transition-opacity"
            >
              <Clapperboard className="w-3.5 h-3.5" /> {lang === 'es' ? 'Crear evento' : 'Event Creator'}
            </Link>
            <button
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-white/10 hover:border-white/30 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" /> {t('langToggle', lang)}
            </button>
          </div>
        </div>
      </div>

      {/* ── Hero (dynamic carousel) ──────────────────────────── */}
      <section className="relative overflow-hidden min-h-[100svh] flex items-center">
        {/* Slide background carousel with Ken Burns zoom */}
        <AnimatePresence mode="sync">
          {HERO_SLIDES.map((s, i) =>
            i === heroIdx ? (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1 }}
                transition={{ opacity: { duration: 1.2 }, scale: { duration: 7, ease: 'easeOut' } }}
                className="absolute inset-0 z-0"
              >
                <img src={s.img} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
                <div className={`absolute inset-0 bg-gradient-to-b ${s.tint}`} />
              </motion.div>
            ) : null,
          )}
        </AnimatePresence>

        {/* Vignette + bottom fade */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.7)_100%)] z-[1]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent z-[1]" />

        {/* Floating amber glows */}
        <div className="absolute top-1/3 left-1/4 w-[420px] h-[420px] bg-amber-500/[0.08] rounded-full blur-[140px] z-[1] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] bg-orange-500/[0.06] rounded-full blur-[120px] z-[1] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 md:py-28 w-full">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 backdrop-blur-md text-[11px] uppercase tracking-[0.2em] text-amber-300 mb-8 shadow-lg shadow-amber-500/10">
              <Sparkles className="w-3.5 h-3.5" /> {t('heroEyebrow', lang)}
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[1.02] tracking-tight bg-gradient-to-br from-white via-white to-amber-200 bg-clip-text text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]"
            >
              {t('heroTitle', lang)}
            </motion.h1>

            {/* Animated rotating subtitle for current slide */}
            <div className="mt-6 h-7 md:h-8">
              <AnimatePresence mode="wait">
                <motion.p
                  key={heroIdx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.55 }}
                  className="text-amber-300/90 text-sm md:text-base font-medium tracking-[0.15em] uppercase"
                >
                  ✦ {t(HERO_SLIDES[heroIdx].titleKey, lang)} ✦
                </motion.p>
              </AnimatePresence>
            </div>

            <motion.p variants={fadeUp} className="mt-6 text-base md:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed drop-shadow-lg">
              {t('heroSub', lang)}
            </motion.p>

            <motion.p variants={fadeUp} className="mt-5 inline-flex items-center gap-2 text-amber-300 font-semibold tracking-wide">
              <Star className="w-4 h-4 fill-amber-300" /> {t('heroPrice', lang)}
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#intake"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold tracking-wide hover:scale-[1.04] transition-all duration-300 shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50"
              >
                {t('heroCtaPrimary', lang)}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#packages"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-white/20 backdrop-blur-md bg-white/[0.04] text-white hover:bg-white/[0.10] hover:border-white/30 transition-all duration-300"
              >
                {t('heroCtaSecondary', lang)}
              </a>
            </motion.div>
          </motion.div>

          {/* Slide controls */}
          <div className="mt-14 flex items-center justify-center gap-3">
            <button
              onClick={() => setHeroIdx((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-md text-white/70 hover:text-white hover:border-amber-500/40 transition-all"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              {HERO_SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIdx(i)}
                  className={`transition-all duration-500 rounded-full ${
                    i === heroIdx ? 'w-10 h-2 bg-gradient-to-r from-amber-400 to-orange-500' : 'w-2 h-2 bg-white/25 hover:bg-white/45'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={() => setHeroIdx((i) => (i + 1) % HERO_SLIDES.length)}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-md text-white/70 hover:text-white hover:border-amber-500/40 transition-all"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Scroll cue */}
          <motion.div
            animate={{ y: [0, 8, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="mt-10 flex flex-col items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-white/50"
          >
            <span>{t('heroScroll', lang)}</span>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </section>

      {/* ── What is it ───────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-3xl md:text-5xl font-bold text-center">
          {t('whatTitle', lang)}
        </motion.h2>
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-6 text-white/70 text-lg max-w-3xl mx-auto text-center leading-relaxed">
          {t('whatBody', lang)}
        </motion.p>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-14 grid md:grid-cols-3 gap-6">
          {[
            { t: 'whatBullet1Title', d: 'whatBullet1Desc', i: <Palette /> },
            { t: 'whatBullet2Title', d: 'whatBullet2Desc', i: <Clapperboard /> },
            { t: 'whatBullet3Title', d: 'whatBullet3Desc', i: <Lock /> },
          ].map((b, i) => (
            <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-white/[0.08] p-7 bg-white/[0.02]">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-black mb-5">
                {b.i}
              </div>
              <h3 className="font-semibold text-lg mb-2">{t(b.t as any, lang)}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{t(b.d as any, lang)}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Categories ───────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-3xl md:text-5xl font-bold text-center">
          {t('catsTitle', lang)}
        </motion.h2>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-14 grid md:grid-cols-2 gap-6">
          {cats.map((c: any, i: number) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className={`group relative rounded-3xl overflow-hidden border transition-colors ${
                c.badge
                  ? 'border-amber-500/40 hover:border-amber-400/70'
                  : 'border-white/[0.08]'
              }`}
            >
              <div className="aspect-[16/10] overflow-hidden">
                <img src={c.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
              </div>
              <div className={`absolute inset-0 ${c.badge ? 'bg-gradient-to-t from-[#1a0533] via-black/60 to-transparent' : 'bg-gradient-to-t from-black via-black/50 to-transparent'}`} />
              <div className="absolute bottom-0 left-0 right-0 p-7">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${c.badge ? 'bg-amber-500/25 border-amber-400/60 text-amber-300' : 'bg-amber-500/15 border-amber-500/40 text-amber-300'}`}>
                    {c.icon}
                  </div>
                  <h3 className="text-2xl font-bold">{t(c.titleKey, lang)}</h3>
                  {c.badge && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-black">
                      {c.badge}
                    </span>
                  )}
                </div>
                <p className="text-white/75 leading-relaxed">{t(c.descKey, lang)}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-3xl md:text-5xl font-bold text-center mb-14">
          {t('howTitle', lang)}
        </motion.h2>
        <motion.ol variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid md:grid-cols-2 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <motion.li key={n} variants={fadeUp} className="rounded-2xl border border-white/[0.08] p-6 bg-white/[0.02] flex gap-5">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-black font-bold flex items-center justify-center text-lg">
                {n}
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">{t(`step${n}Title` as any, lang)}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{t(`step${n}Desc` as any, lang)}</p>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </section>

      {/* ── AI agents ────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden">
        <img src={IMG('agents-bg')} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/85 to-black" />
        <div className="relative max-w-7xl mx-auto px-6">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-3xl md:text-5xl font-bold text-center">
            {t('agentsTitle', lang)}
          </motion.h2>
          <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-white/60 mt-4 text-center max-w-2xl mx-auto">
            {t('agentsSub', lang)}
          </motion.p>
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {AGENTS.map((a, i) => (
              <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur p-5 hover:border-amber-500/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mb-4">
                  {a.icon}
                </div>
                <h4 className="font-semibold text-sm mb-1">{a[lang].name}</h4>
                <p className="text-xs text-white/55 leading-relaxed">{a[lang].desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Deliverables ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-3xl md:text-5xl font-bold text-center mb-14">
          {t('deliverablesTitle', lang)}
        </motion.h2>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid md:grid-cols-2 gap-3">
          {DELIVERABLES.map((d, i) => (
            <motion.div key={i} variants={fadeUp} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
              <Check className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-white/85">{d[lang]}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Signature Experience (value-added universe) ────── */}
      <section className="relative py-28 overflow-hidden">
        {/* Animated radial backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.10),transparent_55%)] pointer-events-none" />
        <div className="absolute top-1/3 left-10 w-[420px] h-[420px] bg-amber-500/[0.06] rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-10 w-[380px] h-[380px] bg-orange-500/[0.05] rounded-full blur-[140px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[11px] uppercase tracking-[0.22em] text-amber-300 mb-7">
              <Sparkles className="w-3.5 h-3.5" /> {t('sigEyebrow', lang)}
            </span>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight bg-gradient-to-br from-white via-white to-amber-200 bg-clip-text text-transparent">
              {t('sigTitle', lang)}
            </h2>
            <p className="mt-6 text-white/65 text-base md:text-lg leading-relaxed">
              {t('sigSub', lang)}
            </p>
          </motion.div>

          {/* 6 pillars: Book, Store, Invitations, Film, App, Music */}
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {([
              { icon: <BookOpen />, t: 'sigBookTitle', d: 'sigBookDesc', img: IMG('cat-legacy'), grad: 'from-amber-500/20 to-orange-500/10' },
              { icon: <ShoppingBag />, t: 'sigStoreTitle', d: 'sigStoreDesc', img: IMG('cat-quinceanera'), grad: 'from-rose-500/20 to-amber-500/10' },
              { icon: <Mail />, t: 'sigInviteTitle', d: 'sigInviteDesc', img: IMG('cat-corporate'), grad: 'from-sky-500/20 to-violet-500/10' },
              { icon: <Film />, t: 'sigFilmTitle', d: 'sigFilmDesc', img: IMG('cat-wedding'), grad: 'from-violet-500/20 to-rose-500/10' },
              { icon: <Smartphone />, t: 'sigAppTitle', d: 'sigAppDesc', img: IMG('agents-bg'), grad: 'from-emerald-500/20 to-sky-500/10' },
              { icon: <Music2 />, t: 'sigMusicTitle', d: 'sigMusicDesc', img: IMG('hero'), grad: 'from-orange-500/20 to-rose-500/10' },
            ] as const).map((it, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md hover:border-amber-500/40 transition-colors"
              >
                {/* Image header */}
                <div className="relative h-44 overflow-hidden">
                  <img src={it.img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700" loading="lazy" />
                  <div className={`absolute inset-0 bg-gradient-to-br ${it.grad} mix-blend-overlay`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  {/* Floating icon */}
                  <div className="absolute bottom-4 left-4 w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 backdrop-blur-md text-amber-300 flex items-center justify-center shadow-xl shadow-amber-500/20 group-hover:scale-110 transition-transform">
                    {it.icon}
                  </div>
                  {/* Number badge */}
                  <div className="absolute top-4 right-4 text-xs font-mono text-white/40 tracking-widest">
                    0{i + 1}
                  </div>
                </div>
                {/* Body */}
                <div className="p-6">
                  <h3 className="text-lg md:text-xl font-bold text-white group-hover:text-amber-200 transition-colors">
                    {t(it.t, lang)}
                  </h3>
                  <p className="mt-3 text-sm text-white/60 leading-relaxed">
                    {t(it.d, lang)}
                  </p>
                </div>
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-3xl ring-1 ring-amber-500/0 group-hover:ring-amber-500/30 transition-all pointer-events-none" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Why we are different ─────────────────────────────── */}
      <section className="relative py-28 overflow-hidden border-t border-white/[0.05]">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-amber-950/[0.08] to-black pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[11px] uppercase tracking-[0.22em] text-amber-300 mb-7">
              <Star className="w-3.5 h-3.5 fill-amber-300" /> {t('whyEyebrow', lang)}
            </span>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
              {t('whyTitle', lang)}
            </h2>
            <p className="mt-6 text-white/65 text-base md:text-lg leading-relaxed">
              {t('whySub', lang)}
            </p>
          </motion.div>

          {/* Comparison grid */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Traditional */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="relative rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 md:p-10"
            >
              <div className="flex items-center gap-3 mb-7">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 text-white/40 flex items-center justify-center">
                  <XIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white/60">{t('whyTradTitle', lang)}</h3>
              </div>
              <ul className="space-y-3">
                {(['whyTrad1', 'whyTrad2', 'whyTrad3', 'whyTrad4', 'whyTrad5', 'whyTrad6'] as const).map((k) => (
                  <li key={k} className="flex items-start gap-3 text-white/50 line-through decoration-white/20">
                    <XIcon className="w-4 h-4 mt-0.5 text-white/30 shrink-0" />
                    <span className="text-sm">{t(k, lang)}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Boostify */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="relative rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] via-orange-500/[0.04] to-transparent p-8 md:p-10 shadow-xl shadow-amber-500/10"
            >
              {/* Badge */}
              <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-[10px] font-bold tracking-[0.2em] uppercase">
                {lang === 'es' ? 'Nuestra forma' : 'Our way'}
              </div>
              <div className="flex items-center gap-3 mb-7">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center">
                  <Crown className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">{t('whyUsTitle', lang)}</h3>
              </div>
              <ul className="space-y-3">
                {(['whyUs1', 'whyUs2', 'whyUs3', 'whyUs4', 'whyUs5', 'whyUs6'] as const).map((k) => (
                  <li key={k} className="flex items-start gap-3 text-white">
                    <Check className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                    <span className="text-sm leading-relaxed">{t(k, lang)}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── World tour / global crew ─────────────────────────── */}
      <section className="relative py-28 overflow-hidden">
        <img src={IMG('agents-bg')} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/85 to-black" />

        {/* Floating travel pins (decorative) */}
        {[
          { top: '22%', left: '12%', delay: 0 },
          { top: '34%', left: '78%', delay: 0.6 },
          { top: '58%', left: '24%', delay: 1.2 },
          { top: '68%', left: '70%', delay: 1.8 },
          { top: '40%', left: '46%', delay: 2.4 },
        ].map((p, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0.85] }}
            transition={{ duration: 1.4, delay: p.delay, repeat: Infinity, repeatDelay: 4 }}
            className="absolute hidden md:block z-[1]"
            style={{ top: p.top, left: p.left }}
          >
            <div className="relative">
              <MapPin className="w-5 h-5 text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
              <span className="absolute -inset-3 rounded-full bg-amber-400/20 blur-md animate-pulse" />
            </div>
          </motion.div>
        ))}

        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 backdrop-blur-md text-[11px] uppercase tracking-[0.22em] text-amber-300 mb-7">
              <Plane className="w-3.5 h-3.5" /> {t('worldEyebrow', lang)}
            </span>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight bg-gradient-to-br from-white via-white to-amber-200 bg-clip-text text-transparent">
              {t('worldTitle', lang)}
            </h2>
            <p className="mt-6 text-white/70 text-base md:text-lg leading-relaxed">
              {t('worldSub', lang)}
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { num: 'worldStat1Num', lbl: 'worldStat1Lbl', icon: <Globe /> },
              { num: 'worldStat2Num', lbl: 'worldStat2Lbl', icon: <Camera /> },
              { num: 'worldStat3Num', lbl: 'worldStat3Lbl', icon: <Plane /> },
              { num: 'worldStat4Num', lbl: 'worldStat4Lbl', icon: <Ticket /> },
            ] as const).map((s, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="rounded-2xl border border-white/[0.08] bg-black/50 backdrop-blur-md p-6 text-center hover:border-amber-500/40 transition-colors"
              >
                <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mb-4">
                  {s.icon}
                </div>
                <div className="text-2xl md:text-3xl font-bold bg-gradient-to-br from-white to-amber-200 bg-clip-text text-transparent">
                  {t(s.num, lang)}
                </div>
                <div className="text-xs text-white/55 mt-2 uppercase tracking-wider">
                  {t(s.lbl, lang)}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Gallery preview ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="rounded-3xl overflow-hidden border border-white/[0.08] grid md:grid-cols-2 items-center bg-gradient-to-br from-amber-500/10 via-black to-black">
          <img src={IMG('gallery-preview')} alt="" className="w-full h-full object-cover" loading="lazy" />
          <div className="p-10 md:p-14">
            <h3 className="text-2xl md:text-4xl font-bold leading-tight">
              {lang === 'es'
                ? 'Tu evento. Tu galería privada. Tu legado.'
                : 'Your event. Your private gallery. Your legacy.'}
            </h3>
            <p className="text-white/65 mt-5 leading-relaxed">
              {lang === 'es'
                ? 'Cada cliente recibe una galería privada interactiva con película principal, trailer, reels, fotografía editorial, comentarios, aprobación, descargas y compartir.'
                : 'Every client receives a private interactive gallery with the main film, trailer, reels, editorial photography, comments, approval, downloads and sharing.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {(lang === 'es'
                ? ['Privado', 'Comentarios', 'Aprobación', 'Descargas']
                : ['Private', 'Comments', 'Approvals', 'Downloads']
              ).map((tag) => (
                <span key={tag} className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-white/70 bg-white/[0.04]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Packages ─────────────────────────────────────────── */}
      <section id="packages" className="max-w-7xl mx-auto px-6 py-24">
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-3xl md:text-5xl font-bold text-center">
          {t('pkgTitle', lang)}
        </motion.h2>
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-4 text-white/60 text-center max-w-2xl mx-auto">
          {t('pkgSub', lang)}
        </motion.p>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-14 grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n, i) => {
            const features = (lang === 'es' ? PKG_FEATURES_ES : PKG_FEATURES_EN)[i];
            const featured = i === 1;
            return (
              <motion.div
                key={n}
                variants={fadeUp}
                className={`rounded-3xl p-8 border ${
                  featured ? 'border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-orange-500/5' : 'border-white/[0.08] bg-white/[0.02]'
                }`}
              >
                {featured && (
                  <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 mb-4">
                    <Star className="w-3 h-3" /> {lang === 'es' ? 'Más popular' : 'Most popular'}
                  </div>
                )}
                <h3 className="text-2xl font-bold">{t(`pkg${n}Name` as any, lang)}</h3>
                <p className="mt-2 text-amber-300 font-semibold">{t(`pkg${n}From` as any, lang)}</p>
                <ul className="mt-7 space-y-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                      <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <a href="#intake" className="mt-8 inline-flex w-full items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/15 hover:border-amber-500/50 transition-colors">
                  {lang === 'es' ? 'Solicitar' : 'Request'} <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            );
          })}
        </motion.div>
        <p className="mt-10 text-center text-xs text-white/45 max-w-3xl mx-auto leading-relaxed">{t('pkgNote', lang)}</p>
      </section>

      {/* ── Intake form ──────────────────────────────────────── */}
      <section id="intake" className="max-w-4xl mx-auto px-6 py-24">
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-3xl md:text-5xl font-bold text-center">
          {t('formTitle', lang)}
        </motion.h2>
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-4 text-white/60 text-center">
          {t('formSub', lang)}
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-12">
          <EventIntakeForm lang={lang} />
        </motion.div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-3xl md:text-5xl font-bold text-center mb-12">
          {t('faqTitle', lang)}
        </motion.h2>
        <div className="space-y-3">
          {FAQ_KEYS.map(([qK, aK], i) => (
            <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="font-semibold">{t(qK as any, lang)}</span>
                <ChevronDown className={`w-5 h-5 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5 text-white/65 leading-relaxed">{t(aK as any, lang)}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-black" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-3xl md:text-5xl font-bold leading-tight">
            {t('finalCtaTitle', lang)}
          </motion.h2>
          <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-5 text-white/70">
            {t('finalCtaSub', lang)}
          </motion.p>
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-9">
            <a href="#intake" className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold tracking-wide hover:scale-[1.03] transition-transform">
              {t('heroCtaPrimary', lang)} <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
