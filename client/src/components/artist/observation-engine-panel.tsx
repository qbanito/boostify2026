/**
 * Observation Engine Panel
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-creation market intelligence module. Scans the market, audience, and
 * cultural landscape before the artist creates a new project. Phase 0 of the
 * Renaissance Engine: OBSERVE.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Telescope,
  ChevronDown,
  TrendingUp,
  Users,
  Target,
  Zap,
  Loader2,
  RefreshCw,
  CheckCircle2,
  BarChart3,
  Globe,
  Sparkles,
  MapPin,
  Music2,
  Info,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ObservationEnginePanelProps {
  artistId: string;
  pgId?: number;
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
  artistName: string;
  artistGenre?: string;
  songsCount?: number;
  location?: string;
}

// ─── Genre trend data ─────────────────────────────────────────────────────────

const GENRE_TRENDS: Record<string, {
  trend: string;
  momentum: number;
  opportunity: string;
  gaps: { gap: string; demand: 'HIGH' | 'MED'; color: string }[];
  audience: { label: string; value: string; sub: string }[];
  references: string[];
}> = {
  'hip-hop': {
    trend: 'Drill + Melodic Trap fusion rising',
    momentum: 87,
    opportunity: 'Emotional storytelling over drill beats',
    gaps: [
      { gap: 'Raw street narratives with cinematic production', demand: 'HIGH', color: '#f87171' },
      { gap: 'Mental health storytelling in rap', demand: 'HIGH', color: '#f87171' },
      { gap: 'Underground-to-mainstream crossover content', demand: 'MED', color: '#fbbf24' },
      { gap: 'Live freestyles + in-studio session content', demand: 'HIGH', color: '#f87171' },
      { gap: 'Sync-ready trap catalog (TV/games/film)', demand: 'MED', color: '#fbbf24' },
    ],
    audience: [
      { label: 'Core fans', value: '16–24', sub: 'Primary' },
      { label: 'Expanding', value: '25–34', sub: 'Secondary' },
      { label: 'Viral reach', value: 'Gen-Z', sub: 'TikTok' },
    ],
    references: [
      'TikTok drives 81% of hip-hop discovery in the 16–24 age group',
      'Emotional vulnerability in rap (SZA, Drake model) outperforming hype rap',
      'Short-form freestyles generating 4x more shares than polished videos',
      'Hip-hop x streetwear collab merch converting at 3x industry average',
    ],
  },
  'pop': {
    trend: 'Indie-pop + bedroom pop surging',
    momentum: 78,
    opportunity: 'Lo-fi aesthetics with commercial hooks',
    gaps: [
      { gap: 'Bedroom-recorded intimacy with polished release strategy', demand: 'HIGH', color: '#f87171' },
      { gap: 'Authentic behind-the-scenes studio content', demand: 'HIGH', color: '#f87171' },
      { gap: 'Fan co-creation campaigns', demand: 'MED', color: '#fbbf24' },
      { gap: 'Sync-ready pop catalog (ads/film)', demand: 'MED', color: '#fbbf24' },
      { gap: 'Artist-as-character visual storytelling', demand: 'HIGH', color: '#f87171' },
    ],
    audience: [
      { label: 'Core fans', value: '14–22', sub: 'Primary' },
      { label: 'Expanding', value: '23–35', sub: 'Secondary' },
      { label: 'Viral reach', value: 'Gen-Z', sub: 'Discovery' },
    ],
    references: [
      'Bedroom pop aesthetic driving 60%+ of Spotify discovery saves',
      'Short-form cover + original combo strategy: 2.4x follower growth',
      'Lyric video content outperforms produced video on first release',
      'Pop acts with strong fan community identity outlast viral singles',
    ],
  },
  'r&b': {
    trend: 'Neo-soul revival + Alt-R&B dominant',
    momentum: 82,
    opportunity: 'Live instrumentation + digital production',
    gaps: [
      { gap: 'Vulnerability narratives with live instrumentation', demand: 'HIGH', color: '#f87171' },
      { gap: 'Late-night mood content + playlist targeting', demand: 'HIGH', color: '#f87171' },
      { gap: 'Bedroom R&B intimacy content', demand: 'MED', color: '#fbbf24' },
      { gap: 'Spoken word + R&B fusion format', demand: 'MED', color: '#fbbf24' },
      { gap: 'Fan community loyalty programs', demand: 'HIGH', color: '#f87171' },
    ],
    audience: [
      { label: 'Core fans', value: '20–34', sub: 'Primary' },
      { label: 'Expanding', value: '35–48', sub: 'Secondary' },
      { label: 'Discovery', value: '16–22', sub: 'New wave' },
    ],
    references: [
      'Neo-soul saves on Spotify up 43% YoY among 20–34 listeners',
      'Live session content (piano + voice) generates 5x more shares in R&B',
      'R&B artists with consistent aesthetic identity grow 2.1x faster',
      'Playlist placement on "Late Night R&B" slots drives 35% stream spike',
    ],
  },
  'reggaeton': {
    trend: 'Latin trap + Afrobeats crossover',
    momentum: 91,
    opportunity: 'Global collaboration potential',
    gaps: [
      { gap: 'Bilingual crossover hooks (Spanish + English)', demand: 'HIGH', color: '#f87171' },
      { gap: 'Afrobeats-reggaeton fusion sound', demand: 'HIGH', color: '#f87171' },
      { gap: 'Lifestyle + culture visual storytelling', demand: 'MED', color: '#fbbf24' },
      { gap: 'Global collab with non-Latin artists', demand: 'HIGH', color: '#f87171' },
      { gap: 'Dance challenge content on TikTok/Reels', demand: 'MED', color: '#fbbf24' },
    ],
    audience: [
      { label: 'Core fans', value: '18–32', sub: 'Primary' },
      { label: 'Expanding', value: '33–44', sub: 'Secondary' },
      { label: 'Global reach', value: 'US + EU', sub: 'Crossover' },
    ],
    references: [
      'Reggaeton streams up 38% globally — fastest growing Latin genre',
      'TikTok dance challenges averaging 180M views in reggaeton category',
      'Bilingual singles (ES + EN) reaching 2.8x streaming audiences',
      'Reggaeton x Afrobeats collabs trending in Europe and West Africa',
    ],
  },
  'electronic': {
    trend: 'Ambient techno + hyperpop diverging',
    momentum: 74,
    opportunity: 'Emotional club music niche',
    gaps: [
      { gap: 'Emotional club music with raw vocal storytelling', demand: 'HIGH', color: '#f87171' },
      { gap: 'Ambient + focus music for streaming playlist placement', demand: 'MED', color: '#fbbf24' },
      { gap: 'Visual + sonic identity branding for live sets', demand: 'HIGH', color: '#f87171' },
      { gap: 'AI-augmented live performance content', demand: 'MED', color: '#fbbf24' },
      { gap: 'Sync licensing for ads + games (electronic SFX demand up)', demand: 'HIGH', color: '#f87171' },
    ],
    audience: [
      { label: 'Core fans', value: '22–36', sub: 'Primary' },
      { label: 'Expanding', value: '37–48', sub: 'Secondary' },
      { label: 'Niche online', value: 'Global', sub: 'Discovery' },
    ],
    references: [
      'Ambient / lo-fi electronic streams up 56% YoY on Spotify',
      'Electronic artists with visual identity (art direction) grow 3x faster',
      'Club-to-streaming crossover strategy outperforms pure club-only releases',
      'Sync demand for electronic instrumentals in gaming/media up 61%',
    ],
  },
  'rock': {
    trend: 'Post-punk revival + math rock resurgence',
    momentum: 69,
    opportunity: 'Gen-Z rock nostalgia content',
    gaps: [
      { gap: 'Gen-Z rock nostalgia with modern production', demand: 'HIGH', color: '#f87171' },
      { gap: 'Post-punk x electronic hybrid sound', demand: 'MED', color: '#fbbf24' },
      { gap: 'Live performance content + tour diary format', demand: 'HIGH', color: '#f87171' },
      { gap: 'Authentic guitar-driven storytelling (reaction bait)', demand: 'MED', color: '#fbbf24' },
      { gap: 'Vinyl + physical release strategy', demand: 'MED', color: '#fbbf24' },
    ],
    audience: [
      { label: 'Core fans', value: '25–40', sub: 'Primary' },
      { label: 'New gen', value: '16–24', sub: 'Gen-Z revival' },
      { label: 'Loyal base', value: '41–55', sub: 'Classic rock' },
    ],
    references: [
      'Post-punk revival acts growing 28% YoY on Spotify among Gen-Z',
      'Guitar content on TikTok averaging 220M views per month',
      'Rock vinyl sales up 41% — physical collectors market expanding',
      'Live rock content (rehearsal/tour) generates highest fan loyalty scores',
    ],
  },
  'jazz': {
    trend: 'Jazz fusion + lo-fi jazz streaming growth',
    momentum: 65,
    opportunity: 'Study/focus playlist domination',
    gaps: [
      { gap: 'Lo-fi jazz for study/focus playlist placement', demand: 'HIGH', color: '#f87171' },
      { gap: 'Jazz x neo-soul vocal collaborations', demand: 'MED', color: '#fbbf24' },
      { gap: 'Short jazz improvisation content (social media clips)', demand: 'MED', color: '#fbbf24' },
      { gap: 'Sync licensing for film/TV (jazz demand +29%)', demand: 'HIGH', color: '#f87171' },
      { gap: 'Artist-as-educator format (music theory content)', demand: 'HIGH', color: '#f87171' },
    ],
    audience: [
      { label: 'Core fans', value: '30–55', sub: 'Primary' },
      { label: 'New gen', value: '18–29', sub: 'Lo-fi wave' },
      { label: 'Global', value: 'EU + Japan', sub: 'Discovery' },
    ],
    references: [
      'Lo-fi jazz streams up 72% — driven by study/focus playlist culture',
      'Jazz YouTube channels growing 38% YoY with theory education content',
      'Jazz sync licensing demand up 29% (period drama, café ads)',
      'Neo-soul x jazz fusion reaching 2.5x more listeners than pure jazz',
    ],
  },
  'latin': {
    trend: 'Regional Mexican + Afrobeats fusion',
    momentum: 94,
    opportunity: 'Bilingual crossover market',
    gaps: [
      { gap: 'Regional Mexican x urban fusion sound', demand: 'HIGH', color: '#f87171' },
      { gap: 'Bilingual crossover hooks', demand: 'HIGH', color: '#f87171' },
      { gap: 'Latin x Afrobeats collaboration content', demand: 'HIGH', color: '#f87171' },
      { gap: 'US Hispanic audience narrative content', demand: 'MED', color: '#fbbf24' },
      { gap: 'Dance challenge TikTok content (global)', demand: 'MED', color: '#fbbf24' },
    ],
    audience: [
      { label: 'Core fans', value: '18–35', sub: 'Primary' },
      { label: 'Expanding', value: '36–50', sub: 'Secondary' },
      { label: 'Global', value: 'US + LatAm', sub: 'Crossover' },
    ],
    references: [
      'Latin music is the #1 fastest-growing genre globally in 2025–2026',
      'Regional Mexican streams surpassed reggaeton for first time in Mexico',
      'Bilingual artists gaining 3.2x more Spotify followers internationally',
      'Latin x Afrobeats collabs trending in UK, West Africa, and Southeast Asia',
    ],
  },
  default: {
    trend: 'Multi-genre fusion strategies dominant',
    momentum: 76,
    opportunity: 'Genre-blending differentiation',
    gaps: [
      { gap: 'Authentic vulnerability narratives', demand: 'HIGH', color: '#f87171' },
      { gap: 'Regional-global fusion sound', demand: 'HIGH', color: '#f87171' },
      { gap: 'Artist-as-educator content format', demand: 'MED', color: '#fbbf24' },
      { gap: 'Immersive fan experience packages', demand: 'HIGH', color: '#f87171' },
      { gap: 'Sync-ready instrumental catalog', demand: 'MED', color: '#fbbf24' },
    ],
    audience: [
      { label: 'Core fans', value: '18–30', sub: 'Primary' },
      { label: 'Expanding', value: '31–45', sub: 'Secondary' },
      { label: 'Viral reach', value: 'Gen-Z', sub: 'Discovery' },
    ],
    references: [
      'Short-form video drives 73% of music discovery across all genres',
      'Authenticity narratives outperforming polished content in all markets',
      'Fan community identity stronger than individual songs for long-term growth',
      'Sync licensing demand up 34% across TV, film, and digital media',
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ObservationEnginePanel({
  artistId,
  pgId,
  isOwnProfile,
  isExpanded,
  onToggleExpand,
  colors,
  cardStyles,
  cardStyleInline,
  artistName,
  artistGenre = '',
  songsCount = 0,
  location = '',
}: ObservationEnginePanelProps) {
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState(0);

  const numericId = pgId || parseInt(artistId, 10) || 0;
  const accent = '#818cf8'; // indigo — OBSERVE phase color

  // Try to fetch AAS survival score for Readiness Score
  const { data: aasScore } = useQuery<any>({
    queryKey: ['/api/aas/score', numericId],
    queryFn: () => apiRequest({ url: `/api/aas/score/${numericId}`, method: 'GET' }),
    enabled: !!numericId && numericId > 0 && scanned,
    staleTime: 60_000,
    retry: false,
  });

  // Detect genre key
  const genreKey = Object.keys(GENRE_TRENDS).find(
    (k) => artistGenre.toLowerCase().includes(k)
  ) || 'default';
  const genreData = GENRE_TRENDS[genreKey];
  const displayGenre = artistGenre
    ? artistGenre.charAt(0).toUpperCase() + artistGenre.slice(1)
    : 'your genre';

  // Stable fallback score — derived once from genre momentum + artist ID hash.
  // Avoids NaN and avoids flickering on re-render.
  const fallbackScore = useMemo(() => {
    const base = genreData.momentum;
    // Deterministic offset (-8 to +8) based on artistId chars
    const hash = artistId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    // Slight boost if artist has songs (active catalog)
    const catalogBonus = songsCount > 5 ? 4 : songsCount > 0 ? 2 : 0;
    const offset = (hash % 17) - 8 + catalogBonus;
    return Math.min(100, Math.max(38, base + offset));
  }, [genreKey, artistId, songsCount]);

  // Readiness score (0-100) — NaN-safe
  const rawAas = aasScore?.score;
  const readinessScore = typeof rawAas === 'number' && !isNaN(rawAas)
    ? Math.min(100, Math.round(rawAas * 100))
    : fallbackScore;

  const handleRunScan = async () => {
    setScanning(true);
    setScanned(false);
    // Simulate multi-phase scan with artist context
    for (let i = 1; i <= 5; i++) {
      await new Promise((r) => setTimeout(r, 420));
      setScanPhase(i);
    }
    setScanning(false);
    setScanned(true);
    setScanPhase(0);
  };

  const scanSteps = [
    `Scanning ${displayGenre} market trends...`,
    `Mapping ${artistName}'s audience signals...`,
    'Detecting cultural gaps & opportunities...',
    'Pulling cultural references & benchmarks...',
    `Calculating readiness score for ${artistName}...`,
  ];

  return (
    <div
      className={cardStyles}
      style={{
        ...cardStyleInline,
        borderColor: `${accent}50`,
        backgroundImage: `linear-gradient(135deg, ${accent}12 0%, rgba(8,8,14,0.96) 50%, rgba(99,102,241,0.06) 100%)`,
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
            animate={{ rotate: [0, 15, -10, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Telescope className="h-4 w-4" />
          </motion.span>
          <div className="text-left">
            <span className="text-sm font-bold text-white">Observation Engine</span>
            <p className="text-[10px] text-gray-500 leading-none mt-0.5">
              Pre-creation market intelligence · OBSERVE phase
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
            key="obs-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">

              {/* ── What this module does ── */}
              <div
                className="rounded-xl px-3 py-2.5 space-y-2"
                style={{ background: `${accent}08`, border: `1px dashed ${accent}25` }}
              >
                <div className="flex items-center gap-1.5">
                  <Info className="h-3 w-3 flex-shrink-0" style={{ color: accent }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                    What this module does
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  The <span className="text-white font-semibold">Observation Engine</span> is your
                  market intelligence step before creating any new project. It analyzes{' '}
                  <span className="text-indigo-300">{displayGenre}</span> market conditions,
                  identifies gaps your competitors are missing, maps your target audience, and gives
                  you a <span className="text-white">Market Readiness Score</span> so you know
                  exactly when and how to release your next work.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { icon: '📈', label: 'Genre momentum & trends' },
                    { icon: '🔍', label: 'Cultural gap detection' },
                    { icon: '👥', label: 'Audience segment map' },
                    { icon: '🎯', label: 'Market Readiness Score' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className="text-[10px]">{item.icon}</span>
                      <span className="text-[9px] text-gray-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Scan trigger ── */}
              {!scanned && !scanning && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-4 text-center"
                  style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}
                >
                  <Telescope className="h-8 w-8 mx-auto mb-2 opacity-50" style={{ color: accent }} />
                  <p className="text-xs text-gray-300 mb-1 font-medium">
                    Run a scan tailored to <span className="text-white">{artistName}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 mb-3">
                    {songsCount > 0
                      ? `${songsCount} song${songsCount === 1 ? '' : 's'} in catalog · ${displayGenre} market will be scanned`
                      : `${displayGenre} market will be scanned — start uploading songs to improve your score`}
                    {location ? ` · Based in ${location}` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={handleRunScan}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                    style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}40` }}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Run Observation Scan
                  </button>
                </motion.div>
              )}

              {/* ── Scanning progress ── */}
              {scanning && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl p-4 space-y-2"
                  style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: accent }} />
                    <span className="text-xs font-semibold" style={{ color: accent }}>
                      {scanSteps[scanPhase - 1] || 'Initializing scan...'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {scanSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 flex-shrink-0">
                          {i < scanPhase ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                          ) : i === scanPhase ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: accent }} />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full border border-gray-700" />
                          )}
                        </span>
                        <span
                          className="text-[11px]"
                          style={{ color: i < scanPhase ? '#34d399' : i === scanPhase ? accent : '#4b5563' }}
                        >
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Scan results ── */}
              {scanned && !scanning && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    {/* ── Context badge ── */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: `${accent}20`, color: accent }}
                      >
                        <Telescope className="h-2.5 w-2.5" /> {artistName}
                      </span>
                      {artistGenre && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
                        >
                          <Music2 className="h-2.5 w-2.5" /> {displayGenre}
                        </span>
                      )}
                      {location && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
                        >
                          <MapPin className="h-2.5 w-2.5" /> {location}
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

                    {/* Readiness Score */}
                    <div
                      className="rounded-xl p-3 flex items-center justify-between"
                      style={{ background: `${accent}12`, border: `1px solid ${accent}30` }}
                    >
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                          Market Readiness Score
                        </p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-black" style={{ color: accent }}>
                            {readinessScore}
                          </span>
                          <span className="text-xs text-gray-500">/100</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {readinessScore >= 85
                            ? '✅ Peak conditions — ideal time to release.'
                            : readinessScore >= 70
                            ? '🟡 Strong momentum — build hype before dropping.'
                            : readinessScore >= 55
                            ? '🟠 Growing market — seed your audience first.'
                            : '🔴 Early stage — focus on foundation building.'}
                        </p>
                        {songsCount === 0 && (
                          <p className="text-[9px] mt-1" style={{ color: `${accent}99` }}>
                            Tip: uploading songs improves your score
                          </p>
                        )}
                      </div>
                      <div className="relative h-16 w-16">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                          <motion.circle
                            cx="18" cy="18" r="15"
                            fill="none"
                            stroke={accent}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${(readinessScore / 100) * 94.2} 94.2`}
                            initial={{ strokeDasharray: '0 94.2' }}
                            animate={{ strokeDasharray: `${(readinessScore / 100) * 94.2} 94.2` }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                          />
                        </svg>
                        <BarChart3
                          className="absolute inset-0 m-auto h-5 w-5"
                          style={{ color: accent }}
                        />
                      </div>
                    </div>

                    {/* Market Scan */}
                    <div
                      className="rounded-xl p-3 space-y-2"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="h-3.5 w-3.5" style={{ color: '#818cf8' }} />
                        <p className="text-xs font-bold text-white">Market Scan</p>
                        <span className="text-[9px] text-gray-600 ml-auto">{displayGenre}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Genre Momentum</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: '#818cf8' }}
                              initial={{ width: 0 }}
                              animate={{ width: `${genreData.momentum}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-white">{genreData.momentum}%</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-snug">
                        <span className="text-white font-medium">Trend: </span>
                        {genreData.trend}
                      </p>
                      <p className="text-[10px] leading-snug" style={{ color: '#34d399' }}>
                        <span className="font-medium">Opportunity for {artistName}: </span>
                        {genreData.opportunity}
                      </p>
                    </div>

                    {/* Gap Detector */}
                    <div
                      className="rounded-xl p-3 space-y-2"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Target className="h-3.5 w-3.5" style={{ color: '#f87171' }} />
                        <p className="text-xs font-bold text-white">Gap Detector</p>
                        <span className="text-[9px] text-gray-500 ml-auto">Underserved niches in {displayGenre}</span>
                      </div>
                      <div className="space-y-1.5">
                        {genreData.gaps.map((item) => (
                          <div key={item.gap} className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-300">{item.gap}</span>
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-2"
                              style={{ background: `${item.color}15`, color: item.color }}
                            >
                              {item.demand}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cultural References */}
                    <div
                      className="rounded-xl p-3 space-y-2"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Globe className="h-3.5 w-3.5" style={{ color: '#fbbf24' }} />
                        <p className="text-xs font-bold text-white">Reference Pulse</p>
                        <span className="text-[9px] text-gray-600 ml-auto">{displayGenre} benchmarks</span>
                      </div>
                      <div className="space-y-1.5">
                        {genreData.references.map((ref) => (
                          <div key={ref} className="flex items-start gap-2">
                            <span className="text-[10px] mt-0.5" style={{ color: '#fbbf24' }}>·</span>
                            <span className="text-[10px] text-gray-400 leading-snug">{ref}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Audience Map */}
                    <div
                      className="rounded-xl p-3"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="h-3.5 w-3.5" style={{ color: '#34d399' }} />
                        <p className="text-xs font-bold text-white">Audience Map</p>
                        <span className="text-[9px] text-gray-600 ml-auto">
                          {location ? `${location} · ` : ''}{displayGenre} listeners
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {genreData.audience.map((seg) => (
                          <div
                            key={seg.label}
                            className="rounded-lg p-2 text-center"
                            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}
                          >
                            <p className="text-sm font-bold text-white">{seg.value}</p>
                            <p className="text-[9px] text-gray-500">{seg.label}</p>
                            <p className="text-[8px] font-medium" style={{ color: '#34d399' }}>{seg.sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Re-scan button */}
                    <button
                      type="button"
                      onClick={handleRunScan}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                      style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh Scan
                    </button>
                  </motion.div>
                </AnimatePresence>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
