import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Monitor,
  Music2,
  Cpu,
  Radio,
  Play,
  Shield,
  Layers,
  Mic2,
  Users,
  Building2,
  Star,
  ArrowRight,
  ChevronRight,
  Zap,
  Activity,
  Video,
  SlidersHorizontal,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HologauzeImages {
  hero_concert?: string;
  control_dashboard?: string;
  tech_pipeline?: string;
  stage_setup?: string;
  premium_venue?: string;
  control_room?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  {
    number: '01',
    title: 'Virtual Artist Creation',
    description:
      "Boostify creates or imports the artist's 3D character, including identity, wardrobe, visual style, rigging, materials, facial expressions, and stage-ready optimization.",
    icon: Cpu,
  },
  {
    number: '02',
    title: 'Performance Capture',
    description:
      'Movements, gestures, choreography, facial expressions, and hand motion can be captured using motion capture systems or prepared through pre-rendered animation workflows.',
    icon: Activity,
  },
  {
    number: '03',
    title: 'Concert Repertory',
    description:
      'The show is organized inside Boostify with setlists, songs, transitions, intros, outros, visual scenes, performance timing, and special moments.',
    icon: Music2,
  },
  {
    number: '04',
    title: 'Hologauze Projection Preparation',
    description:
      'Boostify prepares the artist video output for Hologauze using black-background rendering, correct contrast, stage scale, projection alignment, and visual separation from the environment.',
    icon: Layers,
  },
  {
    number: '05',
    title: 'Live Show Control',
    description:
      'From the Boostify control system, operators can trigger songs, holographic scenes, visual backgrounds, artist entrances, transitions, emergency stops, and performance cues.',
    icon: SlidersHorizontal,
  },
  {
    number: '06',
    title: 'Real Stage Experience',
    description:
      'The virtual artist appears on a physical stage through Hologauze, creating an immersive concert experience for audiences, venues, labels, brands, and live entertainment partners.',
    icon: Star,
  },
];

const CONSOLE_CARDS = [
  {
    icon: Music2,
    title: 'Setlist Control',
    description:
      'Organize the full concert repertory, trigger each song, manage transitions, and control the order of the holographic performance.',
    color: '#f97316',
  },
  {
    icon: Video,
    title: 'Artist Projection Output',
    description:
      'Send the optimized virtual artist feed to the projection system prepared specifically for Hologauze stage environments.',
    color: '#38bdf8',
  },
  {
    icon: Layers,
    title: 'Scene & Visual Sync',
    description:
      'Synchronize background visuals, cinematic environments, stage moments, and visual cues with each part of the performance.',
    color: '#a78bfa',
  },
  {
    icon: Mic2,
    title: 'Audio Synchronization',
    description:
      "Align the artist's body movement, lip sync, track playback, live audio feed, and timing cues inside one show timeline.",
    color: '#34d399',
  },
  {
    icon: Activity,
    title: 'Motion Capture Integration',
    description:
      "Connect pre-recorded or live motion capture data to control the artist's movements, gestures, body language, and emotional performance.",
    color: '#fb7185',
  },
  {
    icon: Shield,
    title: 'Show Safety & Backup',
    description:
      'Include emergency stop, fallback video, timing correction, scene reset, operator controls, and show continuity tools.',
    color: '#fbbf24',
  },
];

const BENEFITS = [
  'Transform digital artists into stage-ready holographic performers.',
  'Prepare reusable concerts for multiple venues.',
  'Reduce dependency on traditional touring limitations.',
  'Build premium experiences for hotels, casinos, festivals and private events.',
  'Create new monetization opportunities from virtual artist performances.',
  'Control the show from one centralized Boostify system.',
];

const USE_CASES = [
  {
    icon: Mic2,
    title: 'Virtual Artist Concerts',
    description: 'Original Boostify artists performing live through Hologauze in physical venues.',
  },
  {
    icon: Music2,
    title: 'Music Label Activations',
    description:
      'Labels can present new digital artists, catalog experiences, tribute concepts, or immersive music showcases.',
  },
  {
    icon: Building2,
    title: 'Hotels, Casinos & Venues',
    description:
      'Entertainment spaces can host repeatable premium holographic shows without traditional touring limitations.',
  },
  {
    icon: Star,
    title: 'Brand Experiences',
    description:
      'Brands can launch products, campaigns, and immersive events using virtual artists and holographic stage moments.',
  },
];

const PIPELINE_STAGES = [
  { label: 'Boostify Artist Engine', icon: Cpu },
  { label: '3D Character / Rig', icon: Users },
  { label: 'Motion Capture', icon: Activity },
  { label: 'Show Timeline', icon: Music2 },
  { label: 'Rendered Artist Feed', icon: Video },
  { label: 'Projection System', icon: Monitor },
  { label: 'Hologauze Screen', icon: Layers },
  { label: 'Live Audience', icon: Users },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionEyebrow({ text }: { text: string }) {
  return (
    <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3"
      style={{ color: '#f97316' }}>
      {text}
    </p>
  );
}

function ImageSlot({
  src,
  alt,
  className = '',
  style = {},
}: {
  src?: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover ${className}`}
        style={{ filter: 'brightness(1.18) contrast(1.05)', ...style }}
        loading="lazy"
      />
    );
  }
  // Placeholder gradient while image is loading or not yet generated
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 40%, #111111 100%)',
        ...style,
      }}
    >
      <div className="text-center opacity-20">
        <Layers className="w-10 h-10 mx-auto mb-2" style={{ color: '#f97316' }} />
        <p className="text-xs text-gray-600 tracking-widest uppercase">Loading visual</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HologauzeConcertSection() {
  const [images, setImages] = useState<HologauzeImages>({});
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<string | null>(null);

  // Fetch cached images on mount
  useEffect(() => {
    fetch('/api/hologauze/images')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.images) setImages(data.images);
      })
      .catch(() => {/* silently fail — placeholders shown */});
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenStatus('Generating cinematic visuals with Flux Pro Kontext… this may take 2–3 minutes.');
    try {
      const res = await fetch('/api/hologauze/images/generate', { method: 'POST' });
      const data = await res.json();
      if (data.images) setImages(data.images);
      setGenStatus(
        `Done — ${data.generated} image${data.generated !== 1 ? 's' : ''} generated${data.failed ? `, ${data.failed} failed` : ''}.`
      );
    } catch {
      setGenStatus('Generation failed — check server logs.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section
      id="hologauze-concert-system"
      className="relative overflow-hidden"
      style={{ background: '#080808' }}
    >
      {/* ── Global ambient glow ── */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(249,115,22,0.06) 0%, transparent 70%)' }} />

      {/* ══════════════════════════════════════════════════════════════════════
          1. HERO
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        <div className="relative overflow-hidden" style={{ minHeight: 520 }}>
          {/* Hero image */}
          <div className="absolute inset-0">
            <ImageSlot src={images.hero_concert} alt="Hologauze live holographic concert" />
            {/* Dark overlay for text legibility */}
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, rgba(8,8,8,0.72) 0%, rgba(8,8,8,0.45) 55%, rgba(8,8,8,0.1) 100%)' }} />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 sm:py-32 flex flex-col justify-center"
            style={{ minHeight: 520 }}>
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={stagger}
              className="max-w-2xl"
            >
              <motion.div variants={fadeUp}>
                <SectionEyebrow text="Boostify Hologauze Live Concert System" />
              </motion.div>
              <motion.h1
                variants={fadeUp}
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight"
              >
                Hologauze-Powered<br />
                <span style={{ color: '#f97316' }}>Live Holographic</span><br />
                Concerts
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-5 text-lg text-gray-300 leading-relaxed max-w-xl">
                Boostify integrates Hologauze into its live concert system to project virtual artists on real stages,
                synchronize performances, control repertories, and deliver immersive holographic shows from one centralized platform.
              </motion.p>
              <motion.p variants={fadeUp} className="mt-3 text-sm font-medium" style={{ color: '#f97316' }}>
                Hologauze becomes the stage surface.{' '}
                <span className="text-white">Boostify becomes the control system.</span>
              </motion.p>
              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#hologauze-pipeline"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 hover:scale-105"
                  style={{ background: '#f97316', color: '#000' }}
                >
                  Explore the System <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#request-demo"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border transition-all hover:border-orange-500 hover:text-orange-400"
                  style={{ borderColor: 'rgba(249,115,22,0.4)', color: '#d1d5db' }}
                >
                  Request a Live Demo
                </a>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. WHAT HOLOGAUZE ADDS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={stagger}
          className="grid lg:grid-cols-2 gap-16 items-center"
        >
          <motion.div variants={fadeUp}>
            <SectionEyebrow text="The Technology" />
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              What Hologauze Adds to Boostify
            </h2>
            <p className="mt-5 text-gray-400 leading-relaxed">
              Hologauze allows Boostify to bring virtual artists into physical venues using a professional
              transparent projection surface designed for large-scale stage illusions. Instead of showing
              the artist on a normal screen, Boostify prepares the digital performer to appear as a
              life-size or larger-than-life holographic presence inside the concert environment.
            </p>
            <div className="mt-8 space-y-3">
              {[
                'Transparent projection surface — no visible screen frame',
                'Stage-scale illusion for real venues and live audiences',
                'Black-background rendering for seamless visual integration',
                'Repeatable setup for multiple venues and events',
              ].map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#f97316' }} />
                  <p className="text-sm text-gray-300">{point}</p>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div variants={fadeUp}>
            <div className="rounded-2xl overflow-hidden border"
              style={{ borderColor: 'rgba(249,115,22,0.15)', aspectRatio: '16/9' }}>
              <ImageSlot src={images.stage_setup} alt="Hologauze stage setup" />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          3. HOW IT WORKS — 6 STEPS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="border-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <SectionEyebrow text="System Workflow" />
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                How It Works
              </h2>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {WORKFLOW_STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.number}
                    variants={fadeUp}
                    className="relative rounded-2xl border p-6 transition-all hover:border-orange-500/30 group"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderColor: 'rgba(255,255,255,0.07)',
                    }}
                  >
                    {/* Connector line (horizontal, desktop only) */}
                    {i < 5 && (i + 1) % 3 !== 0 && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-6 border-t hidden lg:block"
                        style={{ borderColor: 'rgba(249,115,22,0.25)', zIndex: 10 }} />
                    )}
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}>
                        <Icon className="w-5 h-5" style={{ color: '#f97316' }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold tabular-nums mb-1" style={{ color: '#f97316' }}>{step.number}</p>
                        <h3 className="text-sm font-bold text-white mb-2">{step.title}</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          4. LIVE CONSOLE — 6 CONTROL CARDS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.div variants={fadeUp} className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <SectionEyebrow text="Live Show Control" />
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Controlled From the<br />
                <span style={{ color: '#f97316' }}>Boostify Live Console</span>
              </h2>
              <p className="mt-5 text-gray-400 leading-relaxed">
                Every aspect of the holographic show runs from a single centralized Boostify console.
                Operators trigger songs, manage visual scenes, synchronize audio, and maintain full
                control over the live holographic performance.
              </p>

              {/* Dashboard image */}
              <div className="mt-8 rounded-2xl overflow-hidden border"
                style={{ borderColor: 'rgba(249,115,22,0.15)', aspectRatio: '16/9' }}>
                <ImageSlot src={images.control_dashboard} alt="Boostify live show control dashboard" />
              </div>
            </div>

            <div className="grid gap-4">
              {CONSOLE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="flex gap-4 rounded-xl border p-4 transition-all hover:border-white/10 group"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderColor: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
                      style={{ background: `${card.color}18`, border: `1px solid ${card.color}30` }}>
                      <Icon className="w-4 h-4" style={{ color: card.color }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">{card.title}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{card.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          5. TECHNICAL PIPELINE
          ══════════════════════════════════════════════════════════════════════ */}
      <div
        id="hologauze-pipeline"
        className="border-y"
        style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(249,115,22,0.02)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <SectionEyebrow text="Technical Overview" />
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                The Hologauze Stage Pipeline
              </h2>
            </motion.div>

            {/* Pipeline flow */}
            <motion.div variants={fadeUp}>
              <div className="flex flex-wrap justify-center items-center gap-2 mb-12">
                {PIPELINE_STAGES.map((stage, i) => {
                  const Icon = stage.icon;
                  return (
                    <React.Fragment key={stage.label}>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            background: i === PIPELINE_STAGES.length - 1
                              ? 'rgba(249,115,22,0.2)'
                              : 'rgba(255,255,255,0.05)',
                            border: i === PIPELINE_STAGES.length - 1
                              ? '1px solid rgba(249,115,22,0.4)'
                              : '1px solid rgba(255,255,255,0.08)',
                          }}>
                          <Icon className="w-5 h-5"
                            style={{ color: i === PIPELINE_STAGES.length - 1 ? '#f97316' : '#9ca3af' }} />
                        </div>
                        <p className="text-xs text-center text-gray-500 max-w-16 leading-tight">{stage.label}</p>
                      </div>
                      {i < PIPELINE_STAGES.length - 1 && (
                        <ChevronRight className="w-4 h-4 shrink-0 mt-0 -mb-4" style={{ color: 'rgba(249,115,22,0.4)' }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="rounded-2xl overflow-hidden border"
                style={{ borderColor: 'rgba(249,115,22,0.15)', aspectRatio: '16/9' }}>
                <ImageSlot src={images.tech_pipeline} alt="Hologauze concert pipeline visualization" />
              </div>
              <div>
                <p className="text-gray-400 leading-relaxed">
                  Boostify prepares the digital artist for stage projection while Hologauze provides the
                  transparent surface that creates the live holographic illusion. Together, they form a
                  repeatable concert system that can be used for original virtual artists, licensed artists,
                  branded shows, catalog activations, and immersive venue experiences.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          6. COMMERCIAL — BENEFITS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.div variants={fadeUp} className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="rounded-2xl overflow-hidden border"
                style={{ borderColor: 'rgba(249,115,22,0.15)', aspectRatio: '16/9' }}>
                <ImageSlot src={images.premium_venue} alt="Premium luxury venue with Hologauze holographic concert" />
              </div>
            </div>
            <div>
              <SectionEyebrow text="Commercial Value" />
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Built for Venues, Labels,<br />
                <span style={{ color: '#f97316' }}>Brands and Immersive Shows</span>
              </h2>
              <p className="mt-5 text-gray-400 leading-relaxed">
                With Hologauze integrated into Boostify, virtual artists become deployable live entertainment assets.
                A venue can host a holographic concert, a label can activate a digital performer, a brand can launch
                a campaign with a virtual artist, and a catalog can be transformed into an immersive stage experience.
              </p>
              <ul className="mt-6 space-y-3">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <Zap className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#f97316' }} />
                    <span className="text-sm text-gray-300">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          7. USE CASES — 4 CARDS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="border-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <SectionEyebrow text="Use Cases" />
              <h2 className="text-3xl sm:text-4xl font-black text-white">Who It's Built For</h2>
            </motion.div>

            <motion.div variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {USE_CASES.map((uc) => {
                const Icon = uc.icon;
                return (
                  <motion.div
                    key={uc.title}
                    variants={fadeUp}
                    className="rounded-2xl border p-6 transition-all hover:border-orange-500/30 hover:-translate-y-1 group"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderColor: 'rgba(255,255,255,0.07)',
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}>
                      <Icon className="w-5 h-5" style={{ color: '#f97316' }} />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">{uc.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{uc.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CONTROL ROOM IMAGE BANNER
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <div className="rounded-3xl overflow-hidden border relative"
            style={{ borderColor: 'rgba(249,115,22,0.15)', aspectRatio: '21/9' }}>
            <ImageSlot src={images.control_room} alt="Boostify Hologauze backstage control room" />
            <div className="absolute inset-0 flex flex-col justify-end p-8"
              style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.9) 0%, transparent 60%)' }}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#f97316' }}>
                Backstage Control
              </p>
              <p className="text-xl sm:text-2xl font-black text-white max-w-lg">
                Every holographic moment — triggered, timed, and controlled from one system.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          8. CTA FINAL
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28 text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.div variants={fadeUp}>
            <SectionEyebrow text="Get Started" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
              Turn a Digital Artist Into a<br />
              <span style={{ color: '#f97316' }}>Live Holographic Show</span>
            </h2>
            <p className="mt-5 text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Boostify's Hologauze Live Concert System connects the digital artist, the show timeline,
              the projection output, and the live stage into one controlled experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <a
                href="#request-demo"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 hover:scale-105"
                style={{ background: '#f97316', color: '#000' }}
              >
                Book a Hologauze Demo <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#request-demo"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm border transition-all hover:border-orange-500 hover:text-orange-400"
                style={{ borderColor: 'rgba(249,115,22,0.35)', color: '#d1d5db' }}
              >
                Build a Virtual Concert
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ─── Admin: Generate images ───────────────────────────────────────── */}
      {import.meta.env.DEV && (
        <div className="border-t py-6 px-6 flex flex-col sm:flex-row items-center gap-4"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-50"
            style={{
              background: 'rgba(249,115,22,0.1)',
              borderColor: 'rgba(249,115,22,0.3)',
              color: '#f97316',
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            {generating ? 'Generating…' : 'Generate AI Images (Dev)'}
          </button>
          {genStatus && <p className="text-xs text-gray-600">{genStatus}</p>}
        </div>
      )}
    </section>
  );
}
