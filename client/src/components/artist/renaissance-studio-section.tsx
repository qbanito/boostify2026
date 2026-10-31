/**
 * Release Growth Roadmap: a practical release-to-growth roadmap for an artist.
 * The selected focus is a planning aid; progress is never inferred from catalog size.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  Gem,
  Hammer,
  Lightbulb,
  Map,
  Megaphone,
  Music2,
  Telescope,
  Theater,
  TrendingUp,
} from 'lucide-react';

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
  availableModuleIds?: string[];
  onOpenTool?: (moduleId: string) => void;
}

const PHASES = [
  {
    id: 'observe',
    label: 'Observe',
    icon: Telescope,
    color: '#a5b4fc',
    description: 'Find the audience, cultural moment, and angle that make this release matter.',
    outcome: 'A clear audience and positioning brief.',
    firstMove: 'Compare three artists in your lane. Note what their audience responds to, then choose one distinct angle for your next release.',
    tools: [{ id: 'observation-engine', label: 'Music Market Research' }, { id: 'analytics', label: 'Artist Analytics' }, { id: 'audience-engine', label: 'Audience Growth' }],
  },
  {
    id: 'imagine',
    label: 'Imagine',
    icon: Lightbulb,
    color: '#fcd34d',
    description: 'Turn the strongest idea into a recognizable story and creative direction.',
    outcome: 'A release concept your collaborators can act on.',
    firstMove: 'Write the one-sentence story behind the song, the feeling fans should leave with, and the visual world that carries it.',
    tools: [{ id: 'deep-brief', label: 'Project Brief' }, { id: 'career-suite', label: 'Artist Career Support' }],
  },
  {
    id: 'build',
    label: 'Build',
    icon: Hammer,
    color: '#fdba74',
    description: 'Shape the song, visuals, and rollout into one cohesive release system.',
    outcome: 'A usable set of release assets and a rollout sequence.',
    firstMove: 'Choose one lead visual, prepare short-form moments, and map each asset to a channel and date.',
    tools: [{ id: 'ai-video-studio', label: 'AI Video Studio' }, { id: 'social-posts', label: 'Social Posts' }, { id: 'promo-clips', label: 'Promo Video Clips' }],
  },
  {
    id: 'perform',
    label: 'Perform',
    icon: Theater,
    color: '#d8b4fe',
    description: 'Bring the release to people through live moments, stories, and conversation.',
    outcome: 'A repeatable way for fans to experience and share the release.',
    firstMove: 'Pick one live or spoken format that fits the song, then make it easy for fans to join in and pass along.',
    tools: [{ id: 'world-tour', label: 'Tour Videos' }, { id: 'podcast-clips', label: 'Podcast Studio' }, { id: 'hologram', label: 'Hologram Shows' }],
  },
  {
    id: 'learn',
    label: 'Learn',
    icon: BookOpen,
    color: '#6ee7b7',
    description: 'Use real audience response to decide what deserves another iteration.',
    outcome: 'One evidence-based adjustment for the next cycle.',
    firstMove: 'Review saves, shares, comments, and watch-through together. Keep the strongest signal and change one weak point.',
    tools: [{ id: 'analytics', label: 'Artist Analytics' }, { id: 'social-hub', label: 'Social Hub' }],
  },
  {
    id: 'monetize',
    label: 'Monetize',
    icon: Gem,
    color: '#5eead4',
    description: 'Build sustainable income around the music and the community it creates.',
    outcome: 'A fan offer that feels connected to the artist, not bolted on.',
    firstMove: 'Choose one valuable fan experience or product that extends the release, then make its next step simple.',
    tools: [{ id: 'merchandise', label: 'Merchandise' }, { id: 'earnings', label: 'Earnings' }, { id: 'business-plan', label: 'Artist Business Plan' }],
  },
] as const;

const OWNER_ONLY_TOOL_IDS = new Set([
  'observation-engine',
  'analytics',
  'audience-engine',
  'deep-brief',
  'career-suite',
  'ai-video-studio',
  'promo-clips',
  'earnings',
]);

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
  availableModuleIds = [],
  onOpenTool,
}: RenaissanceStudioSectionProps) {
  const [focusId, setFocusId] = useState<string>('observe');
  const accent = colors.hexAccent || '#a78bfa';
  const focus = PHASES.find((phase) => phase.id === focusId) ?? PHASES[0];
  const FocusIcon = focus.icon;
  const genre = artistGenre.trim()
    ? artistGenre.trim().replace(/\b\w/g, (letter) => letter.toUpperCase())
    : '';
  const availableTools = focus.tools.filter((tool) =>
    availableModuleIds.includes(tool.id) && (isOwnProfile || !OWNER_ONLY_TOOL_IDS.has(tool.id)),
  );

  return (
    <section
      className={cardStyles}
      style={{
        ...cardStyleInline,
        borderColor: `${accent}50`,
        backgroundImage: `linear-gradient(135deg, ${accent}12 0%, rgba(8,8,14,0.97) 48%, rgba(129,140,248,0.07) 100%)`,
      }}
      aria-label="Release Growth Roadmap"
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="group flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={isExpanded}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${accent}20`, color: accent }}>
            <Compass className="h-[18px] w-[18px]" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-wide text-white">Release Growth Roadmap</span>
            <span className="mt-0.5 block text-[11px] text-white/50">A release-to-growth roadmap for {artistName}</span>
          </span>
        </span>
        <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-white/40 transition-colors group-hover:text-white/80" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="renaissance-roadmap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-4">
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 p-4 sm:p-5">
                <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full blur-3xl" style={{ background: `${accent}17` }} />
                <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div className="max-w-xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">A connected artist journey</p>
                    <h3 className="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
                      Turn the next release into a bigger moment.
                    </h3>
                    <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/60 sm:text-sm">
                      Move from audience insight to a creative brief, a coordinated rollout, fan connection, learning, and sustainable income.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-white/55">
                    {genre && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1"><Music2 className="h-3 w-3" />{genre}</span>}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1"><TrendingUp className="h-3 w-3" />{songsCount} {songsCount === 1 ? 'song' : 'songs'} on profile</span>
                  </div>
                </div>
                <p className="relative mt-4 border-t border-white/[0.08] pt-3 text-[11px] leading-relaxed text-white/45">
                  {isOwnProfile ? 'Choose the phase that matches your priority today. Your catalog size does not determine your progress.' : 'Explore the six phases behind a connected artist growth cycle.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PHASES.map((phase, index) => {
                  const PhaseIcon = phase.icon;
                  const selected = focus.id === phase.id;
                  return (
                    <motion.button
                      key={phase.id}
                      type="button"
                      onClick={() => setFocusId(phase.id)}
                      whileTap={{ scale: 0.985 }}
                      className="relative min-h-[92px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      style={{
                        borderColor: selected ? `${phase.color}75` : 'rgba(255,255,255,0.08)',
                        background: selected ? `${phase.color}12` : 'rgba(255,255,255,0.02)',
                      }}
                      aria-pressed={selected}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <PhaseIcon className="h-4 w-4" style={{ color: phase.color }} />
                          <span className="text-xs font-semibold text-white">{phase.label}</span>
                        </span>
                        <span className="text-[10px] tabular-nums text-white/30">0{index + 1}</span>
                      </span>
                      <span className="mt-2 block text-[10px] leading-snug text-white/50">{phase.description}</span>
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={focus.id}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.16 }}
                  className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)] sm:p-5"
                  style={{ borderColor: `${focus.color}35`, background: `linear-gradient(130deg, ${focus.color}0c, rgba(0,0,0,0.22))` }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <FocusIcon className="h-4 w-4" style={{ color: focus.color }} />
                      <h4 className="text-sm font-semibold text-white">
                        {isOwnProfile ? `Your ${focus.label.toLowerCase()} focus` : `${focus.label} phase`}
                      </h4>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-white/65">{focus.firstMove}</p>
                    <p className="mt-3 flex items-start gap-2 text-[11px] font-medium text-white/80">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: focus.color }} />
                      <span><span className="text-white/45">{isOwnProfile ? 'Outcome: ' : 'Intended outcome: '}</span>{focus.outcome}</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                      <Map className="h-3.5 w-3.5" /> Related profile tools
                    </div>
                    {availableTools.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {availableTools.map((tool) => (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => onOpenTool?.(tool.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-medium text-white/75 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                          >
                            {tool.label}<ArrowRight className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] leading-relaxed text-white/45">
                        {isOwnProfile ? 'Activate a related tool in Customize Profile Layout to open it from here.' : 'Related tools appear here when they are included in this profile.'}
                      </p>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between gap-3 px-1 text-[10px] text-white/30">
                <span className="inline-flex items-center gap-1.5"><Megaphone className="h-3 w-3" /> One connected cycle, shaped by the artist</span>
                <span className="hidden sm:inline">Select a phase to plan your next move</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
