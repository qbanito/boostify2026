/**
 * Renaissance Studio Section
 * ─────────────────────────────────────────────────────────────────────────────
 * The Boostify Renaissance Engine hub. Shows the 6 Da Vinci phases with
 * connected modules and progress indicators. Lives as a collapsible artist
 * profile section.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Telescope,
  Lightbulb,
  Hammer,
  Theater,
  BookOpen,
  Gem,
  ChevronDown,
  ChevronUp,
  Zap,
  Brain,
  BookMarked,
  Target,
  TrendingUp,
  Cpu,
  Handshake,
  ShoppingBag,
  Briefcase,
  Radio,
  Shield,
  Megaphone,
  Flame,
  FileText,
  Coins,
  Sparkles,
  Quote,
  Info,
  Music2,
  CheckCircle2,
  MapPin,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RenaissanceStudioSectionProps {
  isOwnProfile: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder: string;
    textMuted: string;
    bgGradient: string;
    shadow: string;
  };
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
  artistName?: string;
  artistGenre?: string;
  songsCount?: number;
}

interface PhaseModule {
  label: string;
  icon: React.ElementType;
}

interface Phase {
  id: string;
  icon: React.ElementType;
  label: string;
  color: string;
  gradient: string;
  description: string;
  modules: PhaseModule[];
}

// ─── Phase definitions ────────────────────────────────────────────────────────

const PHASES: Phase[] = [
  {
    id: 'observe',
    icon: Telescope,
    label: 'OBSERVE',
    color: '#818cf8',
    gradient: 'from-indigo-900/30 to-transparent',
    description: 'Market intelligence before creation. Know before you create.',
    modules: [
      { label: 'Signal Pulse', icon: Target },
      { label: 'Observatory', icon: TrendingUp },
      { label: 'Superstar Blueprint', icon: Briefcase },
      { label: 'Observation Engine', icon: Telescope },
    ],
  },
  {
    id: 'imagine',
    icon: Lightbulb,
    label: 'IMAGINE',
    color: '#fbbf24',
    gradient: 'from-amber-900/30 to-transparent',
    description: 'Deep creative ideation. Interview your vision before executing it.',
    modules: [
      { label: 'The Atelier', icon: Brain },
      { label: 'The Codex', icon: BookMarked },
      { label: 'Deep Brief', icon: Lightbulb },
    ],
  },
  {
    id: 'build',
    icon: Hammer,
    label: 'BUILD',
    color: '#fb923c',
    gradient: 'from-orange-900/30 to-transparent',
    description: 'Forge the complete artistic ecosystem from a single idea.',
    modules: [
      { label: 'Genesis Engine', icon: Zap },
      { label: 'Broadcast Studio', icon: Radio },
      { label: 'The Gateway', icon: Shield },
    ],
  },
  {
    id: 'perform',
    icon: Theater,
    label: 'PERFORM',
    color: '#c084fc',
    gradient: 'from-purple-900/30 to-transparent',
    description: 'Show the world what you built. Every channel, every stage.',
    modules: [
      { label: 'HoloStage Live', icon: Cpu },
      { label: 'Press Room', icon: FileText },
      { label: 'Amplify Network', icon: Megaphone },
    ],
  },
  {
    id: 'learn',
    icon: BookOpen,
    label: 'LEARN',
    color: '#34d399',
    gradient: 'from-emerald-900/30 to-transparent',
    description: 'Every release teaches you. Every reaction fuels the next cycle.',
    modules: [
      { label: 'Observatory', icon: TrendingUp },
      { label: 'Creative Ledger', icon: BookMarked },
      { label: 'Genesis Feedback', icon: Zap },
    ],
  },
  {
    id: 'monetize',
    icon: Gem,
    label: 'MONETIZE',
    color: '#2dd4bf',
    gradient: 'from-teal-900/30 to-transparent',
    description: 'Turn art into a living economy. Songs become systems.',
    modules: [
      { label: 'Commerce Blueprint', icon: Briefcase },
      { label: 'The Forge', icon: Handshake },
      { label: 'Ecosystem Drops', icon: ShoppingBag },
      { label: 'Token Assets', icon: Coins },
      { label: 'Inner Circle', icon: Flame },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function RenaissanceStudioSection({
  isOwnProfile,
  isExpanded,
  onToggleExpand,
  colors,
  cardStyles,
  cardStyleInline,
  artistName = 'Artist',
  artistGenre = '',
  songsCount = 0,
}: RenaissanceStudioSectionProps) {
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const accent = colors.hexAccent || '#818cf8';

  const displayGenre = artistGenre
    ? artistGenre.charAt(0).toUpperCase() + artistGenre.slice(1)
    : '';

  // Derive which Renaissance phase the artist is likely in based on their catalog
  const currentPhaseId = useMemo(() => {
    if (songsCount === 0) return 'observe';
    if (songsCount < 3) return 'imagine';
    if (songsCount < 8) return 'build';
    if (songsCount < 15) return 'perform';
    if (songsCount < 25) return 'learn';
    return 'monetize';
  }, [songsCount]);

  const currentPhase = PHASES.find((p) => p.id === currentPhaseId);

  return (
    <div
      className={cardStyles}
      style={{
        ...cardStyleInline,
        borderColor: `${accent}50`,
        backgroundImage: `linear-gradient(135deg, ${accent}12 0%, rgba(8,8,14,0.96) 50%, rgba(129,140,248,0.08) 100%)`,
      }}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 group"
      >
        <div className="flex items-center gap-2.5">
          <motion.span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: `${accent}20`, color: accent }}
            animate={{ rotate: isExpanded ? 15 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <Sparkles className="h-4 w-4" />
          </motion.span>
          <div className="text-left">
            <span className="text-sm font-bold text-white tracking-wide">Renaissance Studio</span>
            <p className="text-[10px] text-gray-500 font-normal leading-none mt-0.5">
              Boostify Renaissance Engine · 6 Phases
            </p>
          </div>
        </div>
        <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-gray-500 group-hover:text-gray-300" />
        </motion.span>
      </button>

      {/* ── Body ── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="renaissance-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">

              {/* ── What this module does ── */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 }}
                className="rounded-xl px-3 py-2.5 space-y-2"
                style={{ background: `${accent}08`, border: `1px dashed ${accent}25` }}
              >
                <div className="flex items-center gap-1.5">
                  <Info className="h-3 w-3 flex-shrink-0" style={{ color: accent }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                    What is the Renaissance Studio?
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  The <span className="text-white font-semibold">Renaissance Studio</span> is your
                  complete artist journey map — powered by the{' '}
                  <span style={{ color: accent }}>6-phase Boostify Renaissance Engine</span>.
                  Inspired by Leonardo Da Vinci's creative process, it guides{' '}
                  <span className="text-white">{artistName}</span> through every stage:
                  observing the market, imagining the concept, building the project, performing it
                  to the world, learning from it, and monetizing the full ecosystem.
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {['📡 Observe the market', '💡 Imagine the idea', '🔨 Build the project',
                    '🎭 Perform & release', '📚 Learn & iterate', '💎 Monetize everything'].map((item) => (
                    <div key={item} className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-500 leading-tight">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── Artist context strip ── */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Your Journey</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: `${accent}20`, color: accent }}
                      >
                        <Sparkles className="h-2.5 w-2.5" /> {artistName}
                      </span>
                      {displayGenre && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
                        >
                          <Music2 className="h-2.5 w-2.5" /> {displayGenre}
                        </span>
                      )}
                      {songsCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{ background: 'rgba(156,163,175,0.1)', color: '#9ca3af' }}
                        >
                          🎵 {songsCount} song{songsCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    {currentPhase && (
                      <div className="flex items-center gap-2">
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                          style={{ background: `${currentPhase.color}20`, color: currentPhase.color, border: `1px solid ${currentPhase.color}30` }}
                        >
                          <currentPhase.icon className="h-3 w-3" />
                          Current phase: {currentPhase.label}
                        </div>
                      </div>
                    )}
                    <p className="text-[9px] text-gray-600 mt-1">
                      {songsCount === 0
                        ? 'Start by uploading your first song to begin your Renaissance journey'
                        : songsCount < 3
                        ? 'Keep creating — your creative foundation is forming'
                        : songsCount < 8
                        ? 'Solid catalog building. Time to structure your release strategy'
                        : songsCount < 15
                        ? 'Strong catalog. Focus on promotion and performance'
                        : songsCount < 25
                        ? 'Learning from your releases. Refine your sound and brand'
                        : 'Mature catalog. Build your full monetization ecosystem'}
                    </p>
                  </div>
                  {/* Phase progress dots */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {PHASES.map((p) => (
                      <div
                        key={p.id}
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: p.id === currentPhaseId
                            ? p.color
                            : PHASES.findIndex((x) => x.id === p.id) < PHASES.findIndex((x) => x.id === currentPhaseId)
                            ? `${p.color}60`
                            : 'rgba(255,255,255,0.08)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* ── Manifesto Quote ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl p-4 text-center relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${accent}15 0%, rgba(8,8,14,0.8) 100%)`,
                  border: `1px solid ${accent}30`,
                }}
              >
                <Quote className="h-4 w-4 mx-auto mb-2 opacity-40" style={{ color: accent }} />
                <p className="text-sm font-medium text-white/90 leading-relaxed italic">
                  "{artistName} is not just releasing music.
                  <br />
                  <span style={{ color: accent }}>They're building a living artistic system.</span>"
                </p>
                <p className="text-[10px] text-gray-600 mt-2 font-mono uppercase tracking-widest">
                  The Boostify Renaissance Engine
                </p>
              </motion.div>

              {/* ── Phase Grid ── */}
              <div className="grid grid-cols-2 gap-2.5">
                {PHASES.map((phase, i) => {
                  const PhaseIcon = phase.icon;
                  const isActive = activePhase === phase.id;
                  const isCurrent = phase.id === currentPhaseId;
                  const isPast = PHASES.findIndex((p) => p.id === phase.id) < PHASES.findIndex((p) => p.id === currentPhaseId);
                  return (
                    <motion.button
                      key={phase.id}
                      type="button"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 + 0.1 }}
                      onClick={() => setActivePhase(isActive ? null : phase.id)}
                      className="relative rounded-xl p-3 text-left transition-all overflow-hidden"
                      style={{
                        background: isActive ? `${phase.color}20` : isCurrent ? `${phase.color}12` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isActive ? phase.color + '50' : isCurrent ? phase.color + '40' : 'rgba(255,255,255,0.06)'}`,
                        opacity: isPast && !isActive ? 0.65 : 1,
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Phase gradient bg */}
                      <div
                        className="absolute inset-0 opacity-20 rounded-xl"
                        style={{
                          background: `radial-gradient(circle at top left, ${phase.color}30 0%, transparent 70%)`,
                        }}
                      />

                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1.5">
                          <PhaseIcon className="h-4 w-4 flex-shrink-0" style={{ color: phase.color }} />
                          <span
                            className="text-[10px] font-bold tracking-widest uppercase"
                            style={{ color: phase.color }}
                          >
                            {phase.label}
                          </span>
                          {isCurrent && (
                            <span
                              className="ml-auto text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                              style={{ background: `${phase.color}30`, color: phase.color }}
                            >
                              YOU ARE HERE
                            </span>
                          )}
                          {isPast && !isActive && (
                            <CheckCircle2 className="ml-auto h-3 w-3 flex-shrink-0 opacity-50" style={{ color: phase.color }} />
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 leading-snug">
                          {phase.description}
                        </p>

                        {/* Modules (visible on expand) */}
                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden mt-2"
                            >
                              <div className="flex flex-wrap gap-1">
                                {phase.modules.map((mod) => {
                                  const ModIcon = mod.icon;
                                  return (
                                    <span
                                      key={mod.label}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium"
                                      style={{
                                        background: `${phase.color}15`,
                                        color: phase.color,
                                        border: `1px solid ${phase.color}25`,
                                      }}
                                    >
                                      <ModIcon className="h-2.5 w-2.5" />
                                      {mod.label}
                                    </span>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Expand indicator */}
                      <motion.div
                        className="absolute top-2 right-2"
                        animate={{ rotate: isActive ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown
                          className="h-3 w-3"
                          style={{ color: isActive ? phase.color : 'rgba(255,255,255,0.2)' }}
                        />
                      </motion.div>
                    </motion.button>
                  );
                })}
              </div>

              {/* ── Da Vinci Principles strip ── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="rounded-xl px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Da Vinci Principles Active
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {[
                    'Curiosità', 'Dimostrazione', 'Sensazione', 'Sfumato',
                    'Arte/Scienza', 'Corporalità', 'Connessione',
                  ].map((principle) => (
                    <span key={principle} className="text-[10px] text-gray-500 flex items-center gap-1">
                      <span style={{ color: accent }}>·</span>
                      {principle}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* ── Footer note ── */}
              <p className="text-center text-[9px] text-gray-600 font-mono">
                RENAISSANCE ENGINE v1.0 · BOOSTIFY MUSIC
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
