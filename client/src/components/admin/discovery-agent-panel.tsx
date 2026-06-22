import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  RefreshCw, Play, Pause, Zap, Globe, TrendingUp, Database, Wrench,
  Search, Users, Target, BarChart3, ArrowUpRight, Star, Filter,
  ChevronLeft, ChevronRight, Award, Crosshair, Flame, Mail, UserPlus, Rocket,
  Brain, CheckCircle2, AlertTriangle, ArrowUp, ArrowDown, Minus, Shield, Activity, FlaskConical,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';

// ─── Types ───────────────────────────────────────────────────────

interface HunterStats {
  totalLeads: number;
  scoredLeads: number;
  unscoredLeads: number;
  byTier: { tier: string; count: number }[];
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
  byCountry: { country: string; count: number }[];
  weeklyGrowth: { week: string; count: number }[];
  goalProgress: { current: number; target: number; percent: number };
  avgScore: number;
  hotLeads: number;
}

interface DiscoveryStatus {
  ok: boolean;
  schedulerRunning: boolean;
  discoveryInProgress: boolean;
  autoGenRunning: boolean;
  totalContacts: number;
  addedThisWeek: number;
  bySource: { import_source: string; cnt: string }[];
  byCountry: { country: string; cnt: string }[];
  lastRun: any;
  runHistory: any[];
  hunter: HunterStats;
  dbRuns: any[];
  pipeline: PipelineStats;
  goals?: GoalsDashboard;
  brain?: { totalDecisions: number; decisionsToday: number; aiScoredLeads: number; avgTokensPerDecision: number };
  autonomy?: AutonomyData | null;
  apifyExhausted?: boolean;
}

interface AutonomyData {
  abTests: { active: number; completed: number; tests: ABTestInfo[] };
  health: { status: string; recentChecks: HealthCheckInfo[] };
  predictiveModel: { trained: boolean; trainedAt: string | null; sampleSize: number; sourceWeights: Record<string, number>; countryWeights: Record<string, number> } | null;
  optimizedSources: { sources: string[]; reasoning: string };
}

interface ABTestInfo {
  id: number;
  name: string;
  status: string;
  sequenceType: string;
  step: number;
  variantASubject: string;
  variantBSubject: string;
  variantASent: number;
  variantBSent: number;
  variantAOpened: number;
  variantBOpened: number;
  variantAClicked: number;
  variantBClicked: number;
  winnerVariant: string | null;
  liftPercent: number | null;
  createdAt: string;
}

interface HealthCheckInfo {
  checkType: string;
  status: string;
  details: any;
  action: string | null;
  createdAt: string;
}

interface PipelineStats {
  totalContacts: number;
  totalArtistPages: number;
  convertedContacts: number;
  pendingConversion: number;
  conversionRate: number;
  byTier: { tier: string; total: number; converted: number }[];
  recentConversions: { id: number; artistName: string; slug: string; createdAt: string }[];
  goalProgress: { current: number; target: number; percent: number };
}

interface GoalsDashboard {
  currentGoal: WeeklyGoal | null;
  recentGoals: WeeklyGoal[];
  sourceROI: SourceROIEntry[];
  overallPerformance: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface WeeklyGoal {
  id: number;
  weekStart: string;
  weekEnd: string;
  status: string;
  targets: GoalKPIs;
  actuals: GoalKPIs;
  performanceScore: number | null;
  aiReflection: string | null;
  aiStrategyNext: string | null;
  sourceAllocation: Record<string, number> | null;
}

interface GoalKPIs {
  leadsDiscovered: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  conversions: number;
  hotLeads: number;
}

interface SourceROIEntry {
  source: string;
  leadsDiscovered: number;
  leadsEmailed: number;
  emailsOpened: number;
  emailsClicked: number;
  conversions: number;
  avgScore: number;
  roiScore: number | null;
}

interface ScoredLead {
  id: number;
  fullName: string;
  email: string | null;
  country: string | null;
  genre: string | null;
  score: number;
  tier: string;
  status: string;
  importSource: string | null;
  createdAt: string;
  opportunity: string;
  channel: string;
}

// ─── Mini Bar Chart ──────────────────────────────────────────────

function SparkBars({ data, color = 'bg-violet-400', h = 36 }: { data: number[]; color?: string; h?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height: h }}>
      {data.map((v, i) => (
        <div key={i} className={`${color} rounded-t-sm opacity-70 hover:opacity-100 transition-opacity flex-1 min-w-[4px]`}
          style={{ height: `${Math.max(2, (v / max) * h)}px` }} title={v.toLocaleString()} />
      ))}
    </div>
  );
}

// ─── Tier Badge Component ────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    S: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    A: 'bg-green-500/20 text-green-300 border-green-500/40',
    B: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    C: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    D: 'bg-red-500/20 text-red-300 border-red-500/40',
  };
  return <Badge variant="outline" className={`text-xs font-bold ${styles[tier] || styles.D}`}>{tier}</Badge>;
}

// ─── Tab System ──────────────────────────────────────────────────

type PanelTab = 'dashboard' | 'leads' | 'pipeline' | 'runs' | 'goals' | 'autonomy';

// '⚡' sources (youtube_api / spotify_api) work without Apify — resilient when Apify quota is exhausted.
const ALL_SOURCES = ['spotify', 'bandcamp', 'google_ai', 'instagram', 'soundcloud', 'youtube_api', 'spotify_api'];
const SOURCE_LABELS: Record<string, string> = {
  google_ai: 'Google AI',
  youtube_api: 'YouTube API ⚡',
  spotify_api: 'Spotify API ⚡',
};
const sourceLabel = (src: string) => SOURCE_LABELS[src] || src.replace(/^./, c => c.toUpperCase());

export function DiscoveryAgentPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [fixingNames, setFixingNames] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<PanelTab>('dashboard');

  // Leads state
  const [leads, setLeads] = useState<ScoredLead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage] = useState(0);
  const [leadsQuery, setLeadsQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [leadsTier, setLeadsTier] = useState('all');
  const [leadsStatus, setLeadsStatus] = useState('all');
  const [leadsSort, setLeadsSort] = useState('created_at');
  const [leadsLoading, setLeadsLoading] = useState(false);

  const LEADS_LIMIT = 30;

  // Debounce search input (300ms) to avoid firing a new request on each keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(leadsQuery), 300);
    return () => clearTimeout(t);
  }, [leadsQuery]);

  // Reset pagination when filters/search change so we don't fetch empty pages
  useEffect(() => { setLeadsPage(0); }, [debouncedQuery, leadsTier, leadsStatus, leadsSort]);

  // ─── Data Loading ───────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiRequest('/api/admin/artist-discovery/status');
      setStatus(data);
    } catch { console.error('Failed to load discovery status'); }
    finally { setLoading(false); }
  }, []);

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (leadsTier !== 'all') params.set('tier', leadsTier);
      if (leadsStatus !== 'all') params.set('status', leadsStatus);
      params.set('sortBy', leadsSort);
      params.set('sortDir', 'desc');
      params.set('limit', String(LEADS_LIMIT));
      params.set('offset', String(leadsPage * LEADS_LIMIT));

      const data = await apiRequest(`/api/admin/artist-discovery/leads?${params}`);
      setLeads(data.leads || []);
      setLeadsTotal(data.total || 0);
    } catch { console.error('Failed to load leads'); }
    finally { setLeadsLoading(false); }
  }, [debouncedQuery, leadsTier, leadsStatus, leadsSort, leadsPage]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (tab === 'leads') loadLeads(); }, [tab, loadLeads]);

  // Adaptive polling: tighter (15s) while discovery is running, relaxed (60s) when idle.
  // Also pause entirely when the tab is hidden to save bandwidth / quota.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') loadStatus(); };
    const delay = status?.discoveryInProgress || status?.autoGenRunning ? 15_000 : 60_000;
    const iv = setInterval(tick, delay);
    return () => clearInterval(iv);
  }, [loadStatus, status?.discoveryInProgress, status?.autoGenRunning]);

  // ─── Actions ────────────────────────────────────────────────────

  const handleManualRun = async () => {
    setRunning(true);
    try {
      const body: any = {};
      if (selectedSources.length > 0) body.sources = selectedSources;
      await apiRequest('/api/admin/artist-discovery/run', { method: 'POST', data: body });
      toast({ title: 'Discovery Started', description: 'Finding artists across sources. Results in a few minutes.' });
      setTimeout(loadStatus, 15000);
      setTimeout(loadStatus, 60000);
      setTimeout(loadStatus, 180000);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed', variant: 'destructive' });
    } finally { setRunning(false); }
  };

  const handleToggleScheduler = async (start: boolean) => {
    try {
      await apiRequest(`/api/admin/artist-discovery/scheduler/${start ? 'start' : 'stop'}`, { method: 'POST' });
      toast({ title: start ? 'Scheduler ON' : 'Scheduler OFF', description: start ? 'Auto-discovery every 6h' : 'Paused' });
      loadStatus();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const handleScore = async () => {
    setScoring(true);
    try {
      const res = await apiRequest('/api/admin/artist-discovery/score', { method: 'POST', data: { batchSize: 2000 } });
      toast({ title: `Scored ${res.scored} leads`, description: `Avg score: ${res.avgScore}` });
      loadStatus();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setScoring(false); }
  };

  const handleFixNames = async () => {
    setFixingNames(true);
    try {
      const res = await apiRequest('/api/admin/artist-discovery/fix-names', { method: 'POST', data: { dryRun: false } });
      toast({ title: `Names Fixed: ${res.fixed}`, description: `${res.badNames} bad names found, ${res.fixed} updated` });
      loadStatus();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setFixingNames(false); }
  };

  const handleGenerateArtists = async () => {
    setGenerating(true);
    try {
      const res = await apiRequest('/api/admin/artist-discovery/generate-artists', { method: 'POST', data: { minScore: 30, batchSize: 500 } });
      toast({ title: `${res.created} Artist Pages Created`, description: `Processed: ${res.processed}, Skipped: ${res.skipped}, Errors: ${res.errors}` });
      loadStatus();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setGenerating(false); }
  };

  const handleToggleAutoGen = async (start: boolean) => {
    try {
      await apiRequest(`/api/admin/artist-discovery/auto-gen/${start ? 'start' : 'stop'}`, { method: 'POST' });
      toast({ title: start ? 'Auto-Gen ON' : 'Auto-Gen OFF', description: start ? 'Auto-generating artist pages every 4h' : 'Paused' });
      loadStatus();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await apiRequest(`/api/admin/artist-discovery/leads/${id}/status`, { method: 'PATCH', data: { status: newStatus } });
      loadLeads();
    } catch {}
  };

  // ─── Render Helpers ─────────────────────────────────────────────

  const h = status?.hunter;
  const p = status?.pipeline;

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-violet-900/30 to-indigo-900/20 border-violet-500/20">
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-violet-400 mb-3" />
          <div className="text-slate-400">Loading Artist Hunter Agent...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
            <Crosshair className="h-5 w-5 sm:h-6 sm:w-6 text-violet-400" />
            Artist Hunter Agent
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Automated discovery, scoring & lead management
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {status?.discoveryInProgress && (
            <Badge className="bg-amber-500/20 text-amber-300 animate-pulse">Hunting...</Badge>
          )}
          {status?.schedulerRunning ? (
            <Badge className="bg-green-500/20 text-green-300">Discovery: ON (6h)</Badge>
          ) : (
            <Badge className="bg-red-500/20 text-red-300">Discovery: OFF</Badge>
          )}
          {status?.autoGenRunning ? (
            <Badge className="bg-emerald-500/20 text-emerald-300">Auto-Gen: ON</Badge>
          ) : (
            <Badge className="bg-slate-500/20 text-slate-400">Auto-Gen: OFF</Badge>
          )}
        </div>
      </div>

      {/* ═══ 50K GOAL PROGRESS ═══ */}
      <Card className="bg-gradient-to-r from-violet-900/40 via-indigo-900/30 to-purple-900/40 border-violet-500/30">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
              <span className="text-xs sm:text-sm font-medium text-white">50K Artist Pages Goal</span>
            </div>
            <span className="text-sm sm:text-lg font-bold text-violet-300">
              {(p?.totalArtistPages || 0).toLocaleString()} / 50,000
            </span>
          </div>
          {/* Artist pages bar (primary) */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(p?.goalProgress?.percent || 0, 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between mt-2 gap-1 text-[10px] sm:text-xs text-slate-400">
            <span>{p?.goalProgress?.percent || 0}%</span>
            <span className="flex items-center gap-1 sm:gap-3 flex-wrap">
              <span className="text-cyan-400">{(h?.totalLeads || 0).toLocaleString()} leads</span>
              <span>→</span>
              <span className="text-violet-300">{(p?.totalArtistPages || 0).toLocaleString()} pages</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ═══ TAB NAVIGATION ═══ */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-violet-500/30 scrollbar-track-transparent pb-1">
        <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1 border border-slate-700/50 w-max min-w-full">
          {([
            { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { key: 'leads', label: 'Lead Explorer', icon: Users },
            { key: 'pipeline', label: 'Artist Pipeline', icon: Rocket },
            { key: 'runs', label: 'Run History', icon: Zap },
            { key: 'goals', label: 'Goals & ROI', icon: Brain },
            { key: 'autonomy', label: 'Autonomy', icon: Shield },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                tab === t.key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}>
              <t.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: DASHBOARD                                                */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === 'dashboard' && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            <StatCard icon={Database} label="Total Leads" value={(h?.totalLeads || 0).toLocaleString()} color="text-cyan-400" />
            <StatCard icon={TrendingUp} label="This Week" value={`+${(status?.addedThisWeek || 0).toLocaleString()}`} color="text-green-400" />
            <StatCard icon={Star} label="Avg Score" value={String(h?.avgScore || 0)} color="text-yellow-400" />
            <StatCard icon={Flame} label="Hot Leads" value={(h?.hotLeads || 0).toLocaleString()} color="text-orange-400" sub="score ≥ 60" />
            <StatCard icon={Award} label="Scored" value={(h?.scoredLeads || 0).toLocaleString()} color="text-purple-400" sub={`${h?.unscoredLeads || 0} pending`} />
            <StatCard icon={Globe} label="Countries" value={String(h?.byCountry?.length || 0)} color="text-indigo-400" />
          </div>

          {/* Weekly Growth Chart */}
          {h?.weeklyGrowth && h.weeklyGrowth.length > 1 && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-violet-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Weekly Lead Growth (12 weeks)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SparkBars data={h.weeklyGrowth.map(w => w.count)} color="bg-violet-400" h={50} />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>{h.weeklyGrowth[0]?.week?.slice(0, 10)}</span>
                  <span>{h.weeklyGrowth[h.weeklyGrowth.length - 1]?.week?.slice(0, 10)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tier Distribution + Sources */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tier */}
            {h?.byTier && h.byTier.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-400" /> Lead Tier Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {h.byTier.map(t => {
                    const pct = h.scoredLeads > 0 ? Math.round((t.count / h.scoredLeads) * 100) : 0;
                    return (
                      <div key={t.tier} className="flex items-center gap-3">
                        <TierBadge tier={t.tier} />
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${
                            t.tier === 'S' ? 'bg-yellow-400' : t.tier === 'A' ? 'bg-green-400' :
                            t.tier === 'B' ? 'bg-blue-400' : t.tier === 'C' ? 'bg-slate-400' : 'bg-red-400'
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-20 text-right">{t.count.toLocaleString()} ({pct}%)</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Sources */}
            {h?.bySource && h.bySource.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Database className="h-4 w-4 text-cyan-400" /> Leads by Source
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {h.bySource.map(s => (
                    <div key={s.source} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 capitalize truncate">{(s.source || 'unknown').replace(/_/g, ' ')}</span>
                      <span className="text-white font-medium">{s.count.toLocaleString()}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top Countries */}
          {h?.byCountry && h.byCountry.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-indigo-400" /> Top Countries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {h.byCountry.map(c => (
                    <Badge key={c.country} variant="outline" className="text-xs border-slate-600">
                      {c.country}: {c.count.toLocaleString()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300">Agent Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Source Selector */}
              <div>
                <div className="text-xs text-slate-500 mb-2">Sources for manual run (empty = auto-rotate):</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_SOURCES.map(src => (
                    <button key={src} onClick={() => setSelectedSources(prev =>
                      prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
                    )} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedSources.includes(src) ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>{sourceLabel(src)}</button>
                  ))}
                </div>
                {status?.apifyExhausted && (
                  <div className="mt-2 text-[11px] text-amber-300/90 bg-amber-900/20 border border-amber-500/30 rounded-md px-2.5 py-1.5">
                    ⚠️ Apify quota exhausted — Apify-based sources return 0 leads right now.
                    Use the ⚡ direct-API sources (YouTube API / Spotify API), which keep working.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleManualRun} disabled={running || status?.discoveryInProgress}
                  className="bg-violet-600 hover:bg-violet-500 text-white">
                  {status?.discoveryInProgress ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Hunting...</>
                    : <><Play className="w-4 h-4 mr-2" />Run Discovery</>}
                </Button>

                {status?.schedulerRunning ? (
                  <Button onClick={() => handleToggleScheduler(false)} variant="outline"
                    className="border-red-500/40 text-red-300 hover:bg-red-900/30">
                    <Pause className="w-4 h-4 mr-2" />Stop Auto
                  </Button>
                ) : (
                  <Button onClick={() => handleToggleScheduler(true)} variant="outline"
                    className="border-green-500/40 text-green-300 hover:bg-green-900/30">
                    <Play className="w-4 h-4 mr-2" />Start Auto (6h)
                  </Button>
                )}

                <Button onClick={handleScore} disabled={scoring} variant="outline"
                  className="border-yellow-500/40 text-yellow-300 hover:bg-yellow-900/30">
                  {scoring ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Scoring...</>
                    : <><Star className="w-4 h-4 mr-2" />Score Leads</>}
                </Button>

                <Button onClick={handleFixNames} disabled={fixingNames} variant="outline"
                  className="border-amber-500/40 text-amber-300 hover:bg-amber-900/30">
                  {fixingNames ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Fixing...</>
                    : <><Wrench className="w-4 h-4 mr-2" />Fix Names</>}
                </Button>

                <Button onClick={loadStatus} variant="ghost" size="sm" className="text-slate-400">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: LEADS EXPLORER                                           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === 'leads' && (
        <>
          {/* Filters */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search name, email..."
                      value={leadsQuery} onChange={e => { setLeadsQuery(e.target.value); setLeadsPage(0); }}
                      className="pl-10 bg-slate-800 border-slate-700" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:flex gap-2">
                  <Select value={leadsTier} onValueChange={v => { setLeadsTier(v); setLeadsPage(0); }}>
                    <SelectTrigger className="w-full sm:w-28 bg-slate-800 border-slate-700 text-xs sm:text-sm"><SelectValue placeholder="Tier" /></SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="S">S Tier</SelectItem>
                    <SelectItem value="A">A Tier</SelectItem>
                    <SelectItem value="B">B Tier</SelectItem>
                    <SelectItem value="C">C Tier</SelectItem>
                    <SelectItem value="D">D Tier</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={leadsStatus} onValueChange={v => { setLeadsStatus(v); setLeadsPage(0); }}>
                  <SelectTrigger className="w-full sm:w-36 bg-slate-800 border-slate-700 text-xs sm:text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="responded">Responded</SelectItem>
                    <SelectItem value="deal_in_progress">Deal</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={leadsSort} onValueChange={v => { setLeadsSort(v); setLeadsPage(0); }}>
                  <SelectTrigger className="w-full sm:w-32 bg-slate-800 border-slate-700 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Newest</SelectItem>
                    <SelectItem value="score">Score</SelectItem>
                    <SelectItem value="full_name">Name</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                  </SelectContent>
                </Select>
                </div>
                <Button onClick={loadLeads} variant="ghost" size="icon" className="shrink-0 hidden sm:flex">
                  <RefreshCw className={`h-4 w-4 ${leadsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Leads Table */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-3 pb-2">
              <div className="text-xs text-slate-500 mb-2">{leadsTotal.toLocaleString()} leads found</div>
              <div className="space-y-1">
                {leads.map(lead => (
                  <div key={lead.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition text-xs sm:text-sm">
                    <TierBadge tier={lead.tier} />
                    <div className="w-8 sm:w-10 text-center">
                      <span className={`text-[10px] sm:text-xs font-bold ${
                        lead.score >= 60 ? 'text-green-400' : lead.score >= 40 ? 'text-blue-400' :
                        lead.score >= 20 ? 'text-slate-300' : 'text-slate-500'
                      }`}>{lead.score}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs sm:text-sm truncate">{lead.fullName || '—'}</p>
                      <p className="text-slate-500 text-[10px] sm:text-xs truncate">{lead.email || '—'}</p>
                    </div>
                    <div className="hidden md:block w-24 text-xs text-slate-400 truncate">{lead.country || '—'}</div>
                    <div className="hidden lg:block w-20 text-xs text-slate-400 capitalize">{lead.genre || '—'}</div>
                    <div className="hidden lg:block w-24 text-xs text-slate-500 capitalize">{(lead.importSource || '').replace(/_/g, ' ')}</div>
                    <Select value={lead.status} onValueChange={v => handleStatusChange(lead.id, v)}>
                      <SelectTrigger className="w-24 sm:w-28 h-7 text-[10px] sm:text-xs bg-transparent border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['new','queued','contacted','responded','deal_in_progress','not_interested','bounced'].map(s => (
                          <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {!leadsLoading && leads.length === 0 && (
                  <div className="text-center py-8 text-slate-500">No leads match your filters</div>
                )}
              </div>

              {/* Pagination */}
              {leadsTotal > LEADS_LIMIT && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
                  <Button onClick={() => setLeadsPage(p => Math.max(0, p - 1))} disabled={leadsPage === 0}
                    variant="ghost" size="sm" className="text-slate-400 h-8">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <span className="text-xs text-slate-500">
                    Page {leadsPage + 1} of {Math.ceil(leadsTotal / LEADS_LIMIT)}
                  </span>
                  <Button onClick={() => setLeadsPage(p => p + 1)}
                    disabled={(leadsPage + 1) * LEADS_LIMIT >= leadsTotal}
                    variant="ghost" size="sm" className="text-slate-400 h-8">
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: ARTIST PIPELINE                                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === 'pipeline' && (
        <>
          {/* Pipeline KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Database} label="Total Leads" value={(p?.totalContacts || 0).toLocaleString()} color="text-cyan-400" />
            <StatCard icon={UserPlus} label="Artist Pages" value={(p?.totalArtistPages || 0).toLocaleString()} color="text-violet-400" />
            <StatCard icon={TrendingUp} label="Conversion Rate" value={`${p?.conversionRate || 0}%`} color="text-green-400" />
            <StatCard icon={Flame} label="Pending" value={(p?.pendingConversion || 0).toLocaleString()} color="text-orange-400" sub="scored leads awaiting conversion" />
          </div>

          {/* Conversion by Tier */}
          {p?.byTier && p.byTier.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <Award className="h-4 w-4 text-yellow-400" /> Conversion by Tier
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.byTier.map(t => {
                  const convPct = t.total > 0 ? Math.round((t.converted / t.total) * 100) : 0;
                  return (
                    <div key={t.tier} className="flex items-center gap-3">
                      <TierBadge tier={t.tier} />
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 bg-slate-700 rounded-full" style={{ width: '100%' }} />
                        <div className={`absolute inset-y-0 left-0 rounded-full ${
                          t.tier === 'S' ? 'bg-yellow-400' : t.tier === 'A' ? 'bg-green-400' :
                          t.tier === 'B' ? 'bg-blue-400' : t.tier === 'C' ? 'bg-slate-400' : 'bg-red-400'
                        }`} style={{ width: `${convPct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-32 text-right">
                        {t.converted.toLocaleString()} / {t.total.toLocaleString()} ({convPct}%)
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300">Pipeline Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">
                Generate artist pages from scored contacts (score ≥ 30). Each run processes up to 500 contacts.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleGenerateArtists} disabled={generating}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {generating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                    : <><UserPlus className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Generate Artist Pages (500)</span><span className="sm:hidden">Generate Pages</span></>}
                </Button>

                {status?.autoGenRunning ? (
                  <Button onClick={() => handleToggleAutoGen(false)} variant="outline"
                    className="border-red-500/40 text-red-300 hover:bg-red-900/30">
                    <Pause className="w-4 h-4 mr-2" />Stop Auto-Gen
                  </Button>
                ) : (
                  <Button onClick={() => handleToggleAutoGen(true)} variant="outline"
                    className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/30">
                    <Play className="w-4 h-4 mr-2" />Start Auto-Gen (4h)
                  </Button>
                )}

                <Button
                  onClick={() => {
                    // Cross-nav to Leads CRM tab without a full page reload
                    window.dispatchEvent(new CustomEvent('admin:navigate', { detail: { tab: 'artists' } }));
                  }}
                  variant="outline"
                  className="border-violet-500/40 text-violet-300 hover:bg-violet-900/30"
                  title="Open the Leads CRM where generated artist pages appear"
                >
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Open in Leads CRM
                </Button>

                <Button onClick={loadStatus} variant="ghost" size="sm" className="text-slate-400">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Conversions */}
          {p?.recentConversions && p.recentConversions.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-emerald-400" /> Recent Artist Pages Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {p.recentConversions.map((conv: any) => (
                    <div key={conv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-slate-800/40 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm">
                      <div className="truncate">
                        <span className="text-white font-medium">{conv.artistName}</span>
                        <span className="text-slate-500 text-xs ml-2">/{conv.slug}</span>
                      </div>
                      <span className="text-[10px] sm:text-xs text-slate-500">{new Date(conv.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: RUN HISTORY                                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === 'runs' && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-400" /> Discovery Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* DB runs */}
            {status?.dbRuns && status.dbRuns.length > 0 ? (
              <div className="space-y-2">
                {status.dbRuns.map((run: any, i: number) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-800/40 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-xs">
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                      <Badge className={run.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                        run.status === 'running' ? 'bg-amber-500/20 text-amber-300 animate-pulse' :
                        'bg-red-500/20 text-red-300'}>{run.status}</Badge>
                      <span className="text-slate-400 text-[10px] sm:text-xs">{new Date(run.started_at).toLocaleString()}</span>
                      <span className="text-slate-500 hidden md:inline">
                        {(run.sources || []).join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <span className="text-green-400 font-medium">+{run.inserted || 0}</span>
                      <span className="text-yellow-400">{run.scored || 0} scored</span>
                      <span className="text-slate-500">{run.duplicates || 0} dupes</span>
                      <span className="text-slate-600">{run.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback to in-memory history */
              status?.runHistory && status.runHistory.length > 0 ? (
                <div className="space-y-2">
                  {status.runHistory.map((run: any, i: number) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-800/40 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-xs gap-1 sm:gap-3">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
                        <span className="text-slate-400 shrink-0">{new Date(run.startedAt).toLocaleString()}</span>
                        <span className="text-slate-500 truncate">{run.sources?.map((s: any) => s.source).join(', ')}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-green-400">+{run.totals?.inserted || 0}</span>
                        <span className="text-slate-500">{run.totals?.duplicates || 0} dupes</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">No run history yet. Run a discovery to start!</div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: GOALS & ROI                                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === 'goals' && (() => {
        const g = status?.goals;
        const cg = g?.currentGoal;
        const roi = g?.sourceROI || [];

        const kpiRows = cg ? [
          { label: 'Leads Discovered', target: cg.targets.leadsDiscovered, actual: cg.actuals.leadsDiscovered, icon: Database, color: 'text-cyan-400' },
          { label: 'Emails Sent', target: cg.targets.emailsSent, actual: cg.actuals.emailsSent, icon: Mail, color: 'text-blue-400' },
          { label: 'Emails Opened', target: cg.targets.emailsOpened, actual: cg.actuals.emailsOpened, icon: Target, color: 'text-violet-400' },
          { label: 'Emails Clicked', target: cg.targets.emailsClicked, actual: cg.actuals.emailsClicked, icon: Crosshair, color: 'text-amber-400' },
          { label: 'Conversions', target: cg.targets.conversions, actual: cg.actuals.conversions, icon: UserPlus, color: 'text-green-400' },
          { label: 'Hot Leads', target: cg.targets.hotLeads, actual: cg.actuals.hotLeads, icon: Flame, color: 'text-orange-400' },
        ] : [];

        return (
          <>
            {/* Performance Header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Target} label="Week Score"
                value={cg?.performanceScore != null ? `${cg.performanceScore}/100` : 'Active'}
                color={cg?.performanceScore != null ? (cg.performanceScore >= 70 ? 'text-green-400' : cg.performanceScore >= 40 ? 'text-amber-400' : 'text-red-400') : 'text-cyan-400'}
                sub={cg ? `${new Date(cg.weekStart).toLocaleDateString()} — ${new Date(cg.weekEnd).toLocaleDateString()}` : undefined} />
              <StatCard icon={BarChart3} label="Overall Avg"
                value={g?.overallPerformance ? `${g.overallPerformance}/100` : '—'}
                color="text-violet-400" sub="Last 4 weeks" />
              <StatCard icon={g?.trend === 'improving' ? ArrowUp : g?.trend === 'declining' ? ArrowDown : Minus}
                label="Trend" value={g?.trend === 'improving' ? 'Improving' : g?.trend === 'declining' ? 'Declining' : 'Stable'}
                color={g?.trend === 'improving' ? 'text-green-400' : g?.trend === 'declining' ? 'text-red-400' : 'text-slate-400'} />
              <StatCard icon={Brain} label="AI Decisions"
                value={status?.brain?.decisionsToday?.toString() || '0'}
                color="text-pink-400" sub="Today" />
            </div>

            {/* Weekly KPI Progress */}
            {cg && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Target className="h-4 w-4 text-cyan-400" /> Weekly KPIs
                    <Badge className={cg.status === 'active' ? 'bg-cyan-500/20 text-cyan-300' :
                      cg.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}>{cg.status}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {kpiRows.map(kpi => {
                    const pct = kpi.target > 0 ? Math.min(100, Math.round((kpi.actual / kpi.target) * 100)) : 0;
                    const Icon = kpi.icon;
                    return (
                      <div key={kpi.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 text-slate-300">
                            <Icon className={`h-3.5 w-3.5 ${kpi.color}`} /> {kpi.label}
                          </span>
                          <span className="text-slate-400">
                            <span className={pct >= 100 ? 'text-green-400 font-bold' : pct >= 60 ? 'text-amber-400' : 'text-slate-300'}>
                              {kpi.actual.toLocaleString()}
                            </span> / {kpi.target.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-cyan-500'
                          }`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Source ROI */}
            {roi.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-400" /> Source ROI (This Week)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700/50">
                          <th className="text-left py-2 px-2 whitespace-nowrap">Source</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Leads</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Emailed</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Opens</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Clicks</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Conv.</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Avg Score</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...roi].sort((a, b) => (b.roiScore || 0) - (a.roiScore || 0)).map(r => (
                          <tr key={r.source} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="py-2 px-2 font-medium text-white capitalize">{r.source.replace('_', ' ')}</td>
                            <td className="py-2 px-2 text-right text-cyan-400">{r.leadsDiscovered}</td>
                            <td className="py-2 px-2 text-right text-blue-400">{r.leadsEmailed}</td>
                            <td className="py-2 px-2 text-right text-violet-400">{r.emailsOpened}</td>
                            <td className="py-2 px-2 text-right text-amber-400">{r.emailsClicked}</td>
                            <td className="py-2 px-2 text-right text-green-400 font-bold">{r.conversions}</td>
                            <td className="py-2 px-2 text-right text-slate-300">{r.avgScore}</td>
                            <td className="py-2 px-2 text-right">
                              <Badge className={
                                (r.roiScore || 0) >= 60 ? 'bg-green-500/20 text-green-300' :
                                (r.roiScore || 0) >= 30 ? 'bg-amber-500/20 text-amber-300' :
                                'bg-red-500/20 text-red-300'
                              }>{r.roiScore ?? '—'}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Source Allocation */}
            {cg?.sourceAllocation && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-400" /> Source Allocation (This Week)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(cg.sourceAllocation).sort((a, b) => b[1] - a[1]).map(([src, pct]) => (
                    <div key={src} className="flex items-center gap-3">
                      <span className="text-xs text-slate-300 capitalize w-24">{src.replace('_', ' ')}</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* AI Reflection */}
            {(cg?.aiReflection || cg?.aiStrategyNext) && (
              <Card className="bg-slate-900/50 border-violet-700/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-violet-300 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-violet-400" /> Agent Reflection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-300">
                  {cg.aiReflection && (
                    <div>
                      <span className="text-slate-500 font-medium">Last evaluation:</span>
                      <p className="mt-1 leading-relaxed">{cg.aiReflection}</p>
                    </div>
                  )}
                  {cg.aiStrategyNext && (
                    <div>
                      <span className="text-cyan-500 font-medium">Strategy for this week:</span>
                      <p className="mt-1 leading-relaxed">{cg.aiStrategyNext}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Past Weeks */}
            {g?.recentGoals && g.recentGoals.length > 1 && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-400" /> Performance History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {g.recentGoals.map((goal) => {
                      const score = goal.performanceScore;
                      return (
                        <div key={goal.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-800/40 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-xs">
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <Badge className={
                              goal.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                              goal.status === 'active' ? 'bg-cyan-500/20 text-cyan-300' :
                              'bg-red-500/20 text-red-300'
                            }>{goal.status}</Badge>
                            <span className="text-slate-400 text-[10px] sm:text-xs">
                              {new Date(goal.weekStart).toLocaleDateString()} — {new Date(goal.weekEnd).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-4">
                            <span className="text-cyan-400">{goal.actuals.leadsDiscovered} leads</span>
                            <span className="text-green-400">{goal.actuals.conversions} conv</span>
                            <span className={`font-bold ${
                              score != null && score >= 70 ? 'text-green-400' :
                              score != null && score >= 40 ? 'text-amber-400' :
                              score != null ? 'text-red-400' : 'text-slate-500'
                            }`}>{score != null ? `${score}/100` : '—'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {!cg && (
              <div className="text-center py-12 text-slate-500">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No goals yet. The agent will create its first weekly goals on the next tick.</p>
              </div>
            )}
          </>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: AUTONOMY                                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === 'autonomy' && (() => {
        const a = status?.autonomy;

        if (!a) return (
          <div className="text-center py-12 text-slate-500">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Autonomy data not available yet. The engine runs every 12 hours.</p>
          </div>
        );

        return (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={FlaskConical} label="A/B Tests Active" value={String(a.abTests?.active ?? 0)} color="text-violet-400" sub={`${a.abTests?.completed ?? 0} completed`} />
              <StatCard icon={Activity} label="Health Status" value={a.health?.status ?? 'unknown'} color={a.health?.status === 'healthy' ? 'text-green-400' : a.health?.status === 'warning' ? 'text-amber-400' : 'text-red-400'} />
              <StatCard icon={Brain} label="Predictive Model" value={a.predictiveModel?.trained ? 'Trained' : 'Pending'} color={a.predictiveModel?.trained ? 'text-cyan-400' : 'text-slate-400'} sub={a.predictiveModel?.sampleSize ? `${a.predictiveModel.sampleSize} samples` : undefined} />
              <StatCard icon={Globe} label="Optimized Sources" value={String(a.optimizedSources?.sources?.length ?? 0)} color="text-blue-400" sub={a.optimizedSources?.sources?.join(', ')} />
            </div>

            {/* A/B Tests Table */}
            {a.abTests.tests.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-violet-300 flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-violet-400" /> A/B Tests — Subject Lines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700/50">
                          <th className="text-left py-2 px-2 whitespace-nowrap">Sequence</th>
                          <th className="text-left py-2 px-2 whitespace-nowrap">Status</th>
                          <th className="text-left py-2 px-2 whitespace-nowrap">Variant A</th>
                          <th className="text-left py-2 px-2 whitespace-nowrap">Variant B</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">A Sent</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">A Opens</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">B Sent</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">B Opens</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Winner</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Lift</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(a.abTests?.tests ?? []).map(t => (
                          <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="py-2 px-2 text-white">{t.sequenceType} #{t.step}</td>
                            <td className="py-2 px-2">
                              <Badge className={
                                t.status === 'running' ? 'bg-cyan-500/20 text-cyan-300' :
                                t.status?.startsWith?.('winner') ? 'bg-green-500/20 text-green-300' :
                                'bg-slate-500/20 text-slate-300'
                              }>{t.status}</Badge>
                            </td>
                            <td className="py-2 px-2 text-slate-300 max-w-[150px] truncate" title={t.variantASubject}>{t.variantASubject}</td>
                            <td className="py-2 px-2 text-slate-300 max-w-[150px] truncate" title={t.variantBSubject}>{t.variantBSubject}</td>
                            <td className="py-2 px-2 text-right text-cyan-400">{t.variantASent}</td>
                            <td className="py-2 px-2 text-right text-violet-400">{t.variantAOpened}</td>
                            <td className="py-2 px-2 text-right text-cyan-400">{t.variantBSent}</td>
                            <td className="py-2 px-2 text-right text-violet-400">{t.variantBOpened}</td>
                            <td className="py-2 px-2 text-right font-bold text-green-400">{t.winnerVariant || '—'}</td>
                            <td className="py-2 px-2 text-right text-amber-400">{t.liftPercent != null ? `+${t.liftPercent.toFixed(1)}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Health Checks */}
            {(a.health?.recentChecks?.length ?? 0) > 0 && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-400" /> Self-Healing Health Checks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(a.health?.recentChecks ?? []).map((c, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-800/40 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-xs">
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <Badge className={
                            c.status === 'healthy' ? 'bg-green-500/20 text-green-300' :
                            c.status === 'warning' ? 'bg-amber-500/20 text-amber-300' :
                            c.status === 'critical' ? 'bg-red-500/20 text-red-300' :
                            'bg-blue-500/20 text-blue-300'
                          }>{c.status}</Badge>
                          <span className="text-white font-medium capitalize">{c.checkType.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 text-slate-400 text-[10px] sm:text-xs">
                          {c.action && <span className="text-amber-300">{c.action}</span>}
                          <span>{new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Predictive Model */}
            {a.predictiveModel?.trained && (
              <Card className="bg-slate-900/50 border-violet-700/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-cyan-300 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-cyan-400" /> Predictive Model — Conversion Weights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Source Weights (higher = better conversion rate)</p>
                    <div className="space-y-1">
                      {Object.entries(a.predictiveModel.sourceWeights).sort((a, b) => b[1] - a[1]).map(([src, w]) => (
                        <div key={src} className="flex items-center gap-3">
                          <span className="text-xs text-slate-300 capitalize w-24">{src.replace('_', ' ')}</span>
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, (w as number) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-slate-400 w-12 text-right">{(w as number).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {Object.keys(a.predictiveModel.countryWeights).length > 0 && (
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Top Country Weights</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(a.predictiveModel.countryWeights).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([country, w]) => (
                          <Badge key={country} variant="outline" className="text-[10px] text-cyan-300 border-cyan-500/30">
                            {country}: {(w as number).toFixed(2)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500">
                    Trained: {a.predictiveModel.trainedAt ? new Date(a.predictiveModel.trainedAt).toLocaleString() : '—'} •
                    Samples: {a.predictiveModel.sampleSize}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Optimized Source Rotation */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-300 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-400" /> Dynamic Source Rotation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  {a.optimizedSources.sources.map(src => (
                    <Badge key={src} className="bg-blue-500/20 text-blue-300 capitalize">{src.replace('_', ' ')}</Badge>
                  ))}
                </div>
                <p className="text-xs text-slate-400">{a.optimizedSources.reasoning}</p>
              </CardContent>
            </Card>
          </>
        );
      })()}
    </div>
  );
}

// ─── Stat Card Component ─────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: string; color: string; sub?: string;
}) {
  return (
    <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className={`text-lg sm:text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
