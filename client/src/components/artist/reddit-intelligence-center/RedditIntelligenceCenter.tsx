import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, TrendingUp, Users, UserPlus, Radar, Zap, Hash, Globe, Sparkles,
  FileText, BarChart3, ChevronDown, ShieldAlert, RefreshCw, Loader2,
} from 'lucide-react';
import { useRedditCenter } from '../../../hooks/use-reddit-center';
import { StatusDot } from './shared';
import { TrendScanner } from './TrendScanner';
import { SubredditExplorer } from './SubredditExplorer';
import { FanDiscovery } from './FanDiscovery';
import { CompetitorRadar } from './CompetitorRadar';
import { ViralOpportunities } from './ViralOpportunities';
import { KeywordMonitor } from './KeywordMonitor';
import { AudienceMap } from './AudienceMap';
import { AIStrategy } from './AIStrategy';
import { Reports } from './Reports';
import { RedditAnalytics } from './RedditAnalytics';

interface Props {
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
}

const TABS = [
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'communities', label: 'Comunidades', icon: Users },
  { key: 'fans', label: 'Fan Discovery', icon: UserPlus },
  { key: 'competitors', label: 'Competidores', icon: Radar },
  { key: 'opportunities', label: 'Oportunidades', icon: Zap },
  { key: 'keywords', label: 'Keywords', icon: Hash },
  { key: 'audience', label: 'Audiencia', icon: Globe },
  { key: 'strategy', label: 'AI Strategy', icon: Sparkles },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * Reddit Artist Intelligence Center — premium dark, glassmorphism dashboard that
 * turns Reddit into a READ-ONLY market-intelligence engine: trend scanning, fan
 * discovery, community & competitor analysis, viral opportunities, keyword
 * monitoring, audience mapping and AI growth strategy. Owner-only; mounted inside
 * the Artist Profile. It never posts, comments or votes — only listens & advises.
 */
export function RedditIntelligenceCenter({ artistId, artistName }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('trends');
  const [genre, setGenre] = useState('');
  const center = useRedditCenter({ artistId, artistName });

  const scanning = center.scan.isPending;
  const effectiveGenre = genre || center.config?.genre || '';

  const onScan = () => center.scan.mutate({ genre: genre.trim() || undefined });

  return (
    <section id="reddit-intelligence-center" className="scroll-mt-24">
      <div className="overflow-hidden rounded-3xl border border-orange-500/15 bg-gradient-to-b from-[#160c06] to-[#0a0705] shadow-[0_20px_80px_rgba(255,69,0,0.10)]">
        {/* Header */}
        <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-5 text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 text-white shadow-[0_0_24px_rgba(255,69,0,0.5)]">
            <Flame className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-white">Reddit Intelligence Center</h2>
              <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300">Premium</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-white/55">
              <StatusDot active={center.hasData} />
              {center.hasData ? `${center.analytics?.totalCommunities ?? 0} comunidades · ${center.analytics?.opportunitiesFound ?? 0} oportunidades` : 'Sin escanear'}
              {center.simulated && <span className="text-amber-300/70">· simulación</span>}
            </div>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }}><ChevronDown className="h-5 w-5 text-white/50" /></motion.div>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
              {/* Control bar: genre + scan */}
              <div className="flex flex-wrap items-center gap-2 border-y border-white/5 px-4 py-3">
                <input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onScan()}
                  placeholder={center.config?.genre ? `Género: ${center.config.genre}` : 'Tu género (ej. blues, hip hop)'}
                  className="min-w-[180px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-orange-400/50 focus:outline-none"
                />
                <button onClick={onScan} disabled={scanning}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50">
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {scanning ? 'Escaneando…' : center.hasData ? 'Re-escanear' : 'Escanear Reddit'}
                </button>
                {center.scannedAt && (
                  <span className="text-[11px] text-white/40">Último: {new Date(center.scannedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                )}
              </div>

              {/* Tab bar */}
              <div className="flex gap-1.5 overflow-x-auto border-b border-white/5 px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                      tab === key ? 'bg-orange-500/15 text-orange-200' : 'text-white/55 hover:bg-white/5 hover:text-white'
                    }`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 border-b border-white/5 bg-orange-400/[0.04] px-5 py-2.5 text-[11px] text-orange-200/70">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Inteligencia de mercado de solo lectura. Descubre fans, detecta trends y analiza comunidades/competidores — Boostify nunca publica, comenta ni vota por ti. Participa siempre aportando valor (regla 9:1 de Reddit).
                </span>
              </div>

              {/* Panel */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    {tab === 'trends' && <TrendScanner center={center} />}
                    {tab === 'communities' && <SubredditExplorer center={center} />}
                    {tab === 'fans' && <FanDiscovery center={center} />}
                    {tab === 'competitors' && <CompetitorRadar center={center} />}
                    {tab === 'opportunities' && <ViralOpportunities center={center} />}
                    {tab === 'keywords' && <KeywordMonitor center={center} />}
                    {tab === 'audience' && <AudienceMap center={center} />}
                    {tab === 'strategy' && <AIStrategy center={center} />}
                    {tab === 'reports' && <Reports center={center} />}
                    {tab === 'analytics' && <RedditAnalytics center={center} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

export default RedditIntelligenceCenter;
