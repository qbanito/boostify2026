import { useState } from 'react';
import { Link } from 'wouter';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import {
  useAcquisitionOverview,
  type AcquisitionRange,
} from '../hooks/use-acquisition-overview';
import { apiRequest } from '../lib/queryClient';
import { AcquisitionSidebar } from '../components/artist-acquisition/AcquisitionSidebar';
import {
  AcquisitionTopbar,
  PageActions,
} from '../components/artist-acquisition/AcquisitionTopbar';
import { ArtistDiscoveryCard } from '../components/artist-acquisition/widgets/ArtistDiscoveryCard';
import { EcosystemGraphCard } from '../components/artist-acquisition/widgets/EcosystemGraphCard';
import { MasterJsonCard } from '../components/artist-acquisition/widgets/MasterJsonCard';
import { VisualAssetsCard } from '../components/artist-acquisition/widgets/VisualAssetsCard';
import { SmartSequencesCard } from '../components/artist-acquisition/widgets/SmartSequencesCard';
import { ConversionPipelineCard } from '../components/artist-acquisition/widgets/ConversionPipelineCard';
import { AnalyticsOverviewCard } from '../components/artist-acquisition/widgets/AnalyticsOverviewCard';
import { ActivityFeedCard } from '../components/artist-acquisition/widgets/ActivityFeedCard';
import { AgentConsoleCard } from '../components/artist-acquisition/widgets/AgentConsoleCard';
import { InboxCard } from '../components/artist-acquisition/widgets/InboxCard';
import { LandingForgeCard } from '../components/artist-acquisition/widgets/LandingForgeCard';
import { AutomationCard } from '../components/artist-acquisition/widgets/AutomationCard';
import { IntegrationsCard } from '../components/artist-acquisition/widgets/IntegrationsCard';
import { SettingsCard } from '../components/artist-acquisition/widgets/SettingsCard';
import { NewMatchModal } from '../components/artist-acquisition/shared/NewMatchModal';
import { TOKENS } from '../components/artist-acquisition/shared/tokens';
import { AdminCrossNav } from '../components/admin-shared/AdminCrossNav';

export default function ArtistAcquisitionDashboard() {
  const { isAdmin, isLoading } = useAuth();
  const [activeNav, setActiveNav] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [range, setRange] = useState<AcquisitionRange>('30D');
  const overviewQuery = useAcquisitionOverview(range);
  const overview = overviewQuery.data;
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [matchResult, setMatchResult] = useState<any | null>(null);
  const [featuredOverride, setFeaturedOverride] = useState<any | null>(null);
  const [seenArtistIds, setSeenArtistIds] = useState<string[]>([]);

  const handleRefresh = () => overviewQuery.refetch();
  const handleRunDiscovery = async () => {
    if (runningDiscovery) return;
    setRunningDiscovery(true);
    try {
      // Cycle through top candidates instead of always returning the same one.
      // Build the exclude list from the artist currently shown + all already surfaced.
      const currentId = featuredOverride?.id || overview?.featuredArtist?.id;
      const excludeList = Array.from(new Set([
        ...seenArtistIds,
        ...(currentId ? [currentId] : []),
      ]));
      const res: any = await apiRequest(
        'GET',
        `/api/admin/artist-acquisition/next-match?exclude=${encodeURIComponent(excludeList.join(','))}`
      );
      const next = res?.artist;
      if (next) {
        setMatchResult(next);
        setFeaturedOverride(next);
        // If rotation reset, start fresh with just this id; otherwise accumulate.
        setSeenArtistIds(res?.rotationReset ? [next.id] : [...excludeList, next.id]);
      } else {
        // No real candidates in DB — surface a toast-like message via modal.
        setMatchResult({ __empty: true } as any);
      }
    } catch (err) {
      console.error('[AAS] Next match failed:', err);
    } finally {
      setTimeout(() => setRunningDiscovery(false), 400);
    }
  };

  // Map sidebar nav id → anchor id on page. Some items (landing, automation, integrations, settings) don't have a widget — fallback to nearest section or dashboard top.
  const NAV_TO_ANCHOR: Record<string, string> = {
    discovery: 'aas-discovery',
    ecosystem: 'aas-ecosystem',
    'master-json': 'aas-master-json',
    'visual-assets': 'aas-visual-assets',
    landing: 'aas-landing',
    sequences: 'aas-sequences',
    pipeline: 'aas-pipeline',
    analytics: 'aas-analytics',
    inbox: 'aas-inbox',
    agents: 'aas-agents',
    automation: 'aas-automation',
    integrations: 'aas-integrations',
    settings: 'aas-settings',
  };

  // Scroll to widget section on sidebar nav
  const handleNavSelect = (id: string) => {
    setActiveNav(id);
    if (id === 'dashboard') {
      const main = document.querySelector('main.custom-scroll') as HTMLElement | null;
      main?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const anchor = NAV_TO_ANCHOR[id];
    if (!anchor) return;
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: TOKENS.BG_DEEP, color: TOKENS.MUTED }}
      >
        Loading…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center px-6"
        style={{ background: TOKENS.BG_DEEP, color: TOKENS.TEXT }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center"
          style={{
            background: TOKENS.SURFACE_2,
            border: `1px solid ${TOKENS.BORDER}`,
          }}
        >
          <div
            className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4"
            style={{
              background: TOKENS.ORANGE_SOFT,
              border: `1px solid ${TOKENS.ORANGE_RING}`,
            }}
          >
            <ShieldAlert size={20} style={{ color: TOKENS.ORANGE_GLOW }} />
          </div>
          <h1 className="text-lg font-semibold mb-1">Admin access required</h1>
          <p className="text-sm mb-5" style={{ color: TOKENS.MUTED }}>
            The Artist Acquisition System is restricted to Boostify admins.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}
          >
            Back to Boostify
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex overflow-hidden"
      style={{
        background: TOKENS.BG_DEEP,
        color: TOKENS.TEXT,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <AcquisitionSidebar
        active={activeNav}
        onSelect={handleNavSelect}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AcquisitionTopbar onMenu={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto custom-scroll">
          <div className="px-3 sm:px-5 md:px-7 py-4 sm:py-5 md:py-6">
            <div className="mb-4"><AdminCrossNav /></div>
            {/* Title row */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 sm:mb-5">
              <div>
                <h1
                  className="text-[22px] sm:text-[24px] md:text-[26px] font-bold leading-tight flex items-center gap-2"
                  style={{ color: TOKENS.TEXT }}
                >
                  Dashboard
                  {overviewQuery.isFetching && (
                    <Loader2
                      size={16}
                      className="animate-spin"
                      style={{ color: TOKENS.ORANGE_GLOW }}
                    />
                  )}
                </h1>
                <p
                  className="text-[12px] sm:text-[12.5px] mt-1"
                  style={{ color: TOKENS.MUTED }}
                >
                  AI-Powered Artist Acquisition. Discover. Engage. Convert.
                  {overview?.summary && (
                    <span className="ml-2" style={{ color: TOKENS.ORANGE_GLOW }}>
                      · {overview.summary.totalLeads.toLocaleString()} leads · {overview.summary.hotLeads} hot · avg score {overview.summary.avgScore}
                    </span>
                  )}
                </p>
              </div>
              <PageActions
                onRefresh={handleRefresh}
                onRunDiscovery={handleRunDiscovery}
                refreshing={overviewQuery.isFetching}
                running={runningDiscovery}
              />
            </div>

            {overviewQuery.isError && !overview && (
              <div
                className="mb-4 rounded-lg px-3 py-2 text-[12px] flex items-center justify-between gap-3"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                }}
              >
                <span>
                  Live data unavailable —{' '}
                  {(overviewQuery.error as Error)?.message?.includes('401')
                    ? 'authentication required'
                    : (overviewQuery.error as Error)?.message?.includes('404')
                      ? 'server route not registered yet (restart server)'
                      : 'check server logs'}
                  . Showing mock preview.
                </span>
                <button
                  onClick={handleRefresh}
                  className="px-2 py-0.5 rounded text-[11px] font-medium"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#fecaca' }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Top row: 01, 02, 03 */}
            <div id="aas-top-row" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              <div id="aas-discovery">
                <ArtistDiscoveryCard
                  data={featuredOverride || overview?.featuredArtist}
                  onNewMatch={handleRunDiscovery}
                  running={runningDiscovery}
                />
              </div>
              <div id="aas-ecosystem">
                <EcosystemGraphCard
                  nodes={overview?.ecosystem}
                  artist={featuredOverride || overview?.featuredArtist}
                />
              </div>
              <div id="aas-master-json" className="md:col-span-2 xl:col-span-1">
                <MasterJsonCard data={overview?.masterJson} />
              </div>
            </div>

            {/* Mid row: 04, 05, 06 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
              <div id="aas-visual-assets" className="md:col-span-2 xl:col-span-1">
                <VisualAssetsCard artistId={featuredOverride?.id || overview?.featuredArtist?.id} />
              </div>
              <div id="aas-sequences">
                <SmartSequencesCard data={overview?.sequences} />
              </div>
              <div id="aas-pipeline">
                <ConversionPipelineCard
                  data={overview?.pipeline}
                  range={range}
                  onRangeChange={setRange}
                />
              </div>
            </div>

            {/* Bottom row: 07 + activity feed */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4 pb-4">
              <div id="aas-analytics" className="xl:col-span-2">
                <AnalyticsOverviewCard
                  data={overview?.analytics}
                  range={range}
                  onRangeChange={setRange}
                />
              </div>
              <div id="aas-inbox" className="space-y-3 sm:space-y-4">
                <InboxCard />
                <ActivityFeedCard data={overview?.activity} />
              </div>
            </div>

            {/* Agent Console row */}
            <div id="aas-agents" className="mt-3 sm:mt-4">
              <AgentConsoleCard data={overview?.agents} />
            </div>

            {/* Landing Forge + Automation row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
              <div id="aas-landing">
                <LandingForgeCard />
              </div>
              <div id="aas-automation">
                <AutomationCard />
              </div>
            </div>

            {/* Integrations + Settings row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 pb-6">
              <div id="aas-integrations">
                <IntegrationsCard />
              </div>
              <div id="aas-settings">
                <SettingsCard />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* New match result modal */}
      <NewMatchModal
        artist={matchResult && !matchResult.__empty ? matchResult : null}
        open={!!matchResult}
        onClose={() => setMatchResult(null)}
        onViewFull={() => {
          const el = document.getElementById('aas-discovery');
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      {/* Scoped scrollbar styling */}
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: ${TOKENS.BORDER};
          border-radius: 8px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: ${TOKENS.ORANGE_RING};
        }
        @media (max-width: 640px) {
          .custom-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        }
      `}</style>
    </div>
  );
}
