/**
 * ECONOMIC ENGINE MANAGER — Admin Panel Component
 * Master controls for the Boostify Economic Engine (Layer 3)
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { 
  DollarSign, Shield, Zap, TrendingUp, AlertTriangle, Activity,
  Power, RefreshCw, Eye, Settings, ChevronDown, ChevronUp, Play,
  Lock, Unlock, BarChart3, Wallet, Target, Loader2, Clock, History,
  ExternalLink,
} from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';

interface GlobalConfig {
  id: number;
  isGloballyEnabled: boolean;
  defaultDistribution: { operation: number; reserve: number; growth: number; defi: number; boostifyFee: number };
  defaultDefiSplit: { capitalKeeper: number; flowMaker: number; alphaHunter: number; shieldNode: number };
  profitCascade: { reserve: number; growth: number; reinvestDefi: number; performanceFee: number };
  platformFeeRate: string;
  performanceFeeRate: string;
  minReserveMonths: number;
  maxDrawdownPct: string;
}

interface ArtistRow {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  engineEnabled: boolean | null;
  operatingMode: string | null;
  defiEnabled: boolean | null;
  enabledAt: string | null;
  lastCycleAt: string | null;
  operationBalance: string | null;
  reserveBalance: string | null;
  growthBalance: string | null;
  defiBalance: string | null;
  totalDeposited: string | null;
  totalDefiProfit: string | null;
  shieldVetoActive: boolean | null;
  healthScore: string | null;
}

interface AuditEntry {
  id: number;
  artistId: number | null;
  actorType: string;
  action: string;
  description: string | null;
  createdAt: string;
}

const MODE_COLORS: Record<string, string> = {
  survival: 'bg-red-500/20 text-red-300 border-red-500/30',
  stable: 'bg-green-500/20 text-green-300 border-green-500/30',
  expansion: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  aggressive: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  defense: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

const MODE_ICONS: Record<string, any> = {
  survival: AlertTriangle,
  stable: Activity,
  expansion: TrendingUp,
  aggressive: Zap,
  defense: Shield,
};

export function EconomicEngineManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<Set<number>>(new Set());
  const [expandedArtist, setExpandedArtist] = useState<number | null>(null);
  const [runningCycle, setRunningCycle] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'artists' | 'config' | 'audit'>('artists');
  const [simulateAmount, setSimulateAmount] = useState('10000');
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [configRes, artistsRes, auditRes] = await Promise.all([
        fetch('/api/economic-engine/admin/global-config', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/economic-engine/admin/artists', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/economic-engine/admin/audit-log?limit=30', { credentials: 'include' }).then(r => r.json()),
      ]);
      if (configRes.success) setConfig(configRes.config);
      if (artistsRes.success) setArtists(artistsRes.artists);
      if (auditRes.success) setAuditLog(auditRes.logs);
    } catch (err) {
      console.error('Failed to load economic engine data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 30s so the admin panel stays in sync with
  // artist-side mutations (same cadence as the artist dashboard's refetchInterval).
  useEffect(() => {
    const iv = setInterval(loadData, 30_000);
    return () => clearInterval(iv);
  }, [loadData]);

  const toggleGlobal = async () => {
    if (!config) return;
    try {
      const res = await apiRequest('PATCH', '/api/economic-engine/admin/global-config', {
        isGloballyEnabled: !config.isGloballyEnabled,
      });
      setConfig({ ...config, isGloballyEnabled: !config.isGloballyEnabled });
      toast({ title: `Engine ${!config.isGloballyEnabled ? 'ENABLED' : 'DISABLED'} globally` });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleArtist = async (artistId: number) => {
    try {
      const res = await apiRequest('POST', `/api/economic-engine/admin/toggle/${artistId}`, {});
      toast({ title: `Engine toggled for artist ${artistId}` });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const batchToggle = async (enable: boolean) => {
    const ids = Array.from(selectedArtists);
    if (ids.length === 0) return;
    try {
      await apiRequest('POST', '/api/economic-engine/admin/batch-toggle', { artistIds: ids, enable });
      toast({ title: `${enable ? 'Enabled' : 'Disabled'} engine for ${ids.length} artists` });
      setSelectedArtists(new Set());
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const changeMode = async (artistId: number, mode: string) => {
    try {
      await apiRequest('PATCH', `/api/economic-engine/admin/set-mode/${artistId}`, { mode, reason: 'Admin manual override' });
      toast({ title: `Mode set to ${mode} for artist ${artistId}` });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const runCycle = async (artistId: number) => {
    try {
      setRunningCycle(artistId);
      const res = await apiRequest('POST', `/api/economic-engine/run-cycle/${artistId}`, {});
      toast({ title: 'Cycle Complete', description: `Mode: ${res.result?.mode}, Actions: ${res.result?.agentActions?.length || 0}` });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRunningCycle(null);
    }
  };

  const clearVeto = async (artistId: number) => {
    try {
      await apiRequest('POST', `/api/economic-engine/admin/risk-override/${artistId}`, {});
      toast({ title: 'Shield veto cleared' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const runSimulation = async (artistId: number) => {
    try {
      const res = await apiRequest('POST', `/api/economic-engine/simulate/${artistId}`, { amount: parseFloat(simulateAmount) });
      setSimulationResult(res.simulation);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Stats
  const enabledCount = artists.filter(a => a.engineEnabled).length;
  const totalVaultValue = artists.reduce((sum, a) => {
    return sum + parseFloat(a.operationBalance || '0') + parseFloat(a.reserveBalance || '0') + 
           parseFloat(a.growthBalance || '0') + parseFloat(a.defiBalance || '0');
  }, 0);
  const totalDefiProfit = artists.reduce((sum, a) => sum + parseFloat(a.totalDefiProfit || '0'), 0);
  const vetoCount = artists.filter(a => a.shieldVetoActive).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-3 text-slate-400">Loading Economic Engine...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* MASTER CONTROL BAR */}
      <Card className="bg-gradient-to-r from-slate-900/90 to-orange-950/30 border border-orange-500/30">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 sm:p-3 rounded-xl ${config?.isGloballyEnabled ? 'bg-green-500/20 ring-2 ring-green-500/50' : 'bg-red-500/20 ring-2 ring-red-500/50'}`}>
                <Power className={`h-5 w-5 sm:h-6 sm:w-6 ${config?.isGloballyEnabled ? 'text-green-400' : 'text-red-400'}`} />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-bold text-white">Boostify Economic Engine</h2>
                <p className="text-xs sm:text-sm text-slate-400">Layer 3 — Autonomous Financial Motor</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-orange-400">{enabledCount}</p>
                <p className="text-[10px] sm:text-xs text-slate-400">Active</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-green-400">${totalVaultValue.toFixed(0)}</p>
                <p className="text-[10px] sm:text-xs text-slate-400">Vault</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-blue-400">${totalDefiProfit.toFixed(0)}</p>
                <p className="text-[10px] sm:text-xs text-slate-400">DeFi</p>
              </div>
              {vetoCount > 0 && (
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-red-400">{vetoCount}</p>
                  <p className="text-[10px] sm:text-xs text-slate-400">Vetos</p>
                </div>
              )}

              <Button
                variant={config?.isGloballyEnabled ? 'destructive' : 'default'}
                onClick={toggleGlobal}
                className={`w-full sm:w-auto ml-auto ${config?.isGloballyEnabled ? '' : 'bg-green-600 hover:bg-green-700'}`}
                size="sm"
              >
                <Power className="h-4 w-4 mr-2" />
                {config?.isGloballyEnabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABS */}
      <div className="flex gap-1 sm:gap-2 border-b border-slate-700 pb-2 overflow-x-auto">
        {[
          { id: 'artists', label: 'Artists', icon: Target },
          { id: 'config', label: 'Config', icon: Settings },
          { id: 'audit', label: 'Audit', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-t-lg text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ARTISTS TAB */}
      {activeTab === 'artists' && (
        <div className="space-y-4">
          {/* Batch actions */}
          {selectedArtists.size > 0 && (
            <Card className="bg-slate-800/50 border border-orange-500/20">
              <CardContent className="p-3 flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge className="bg-orange-500/20 text-orange-300">{selectedArtists.size} selected</Badge>
                <Button size="sm" onClick={() => batchToggle(true)} className="bg-green-600 hover:bg-green-700 text-xs">
                  <Power className="h-3 w-3 mr-1" /> Enable
                </Button>
                <Button size="sm" variant="destructive" onClick={() => batchToggle(false)} className="text-xs">
                  <Power className="h-3 w-3 mr-1" /> Disable
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedArtists(new Set())} className="text-xs">Clear</Button>
              </CardContent>
            </Card>
          )}

          {/* Artist list */}
          <div className="space-y-2">
            {artists.map(artist => {
              const mode = artist.operatingMode || 'stable';
              const ModeIcon = MODE_ICONS[mode] || Activity;
              const isExpanded = expandedArtist === artist.id;
              const vaultTotal = parseFloat(artist.operationBalance || '0') + parseFloat(artist.reserveBalance || '0') +
                                 parseFloat(artist.growthBalance || '0') + parseFloat(artist.defiBalance || '0');

              return (
                <Card key={artist.id} className={`bg-slate-900/60 border ${artist.shieldVetoActive ? 'border-red-500/50' : artist.engineEnabled ? 'border-green-500/20' : 'border-slate-700/50'}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedArtists.has(artist.id)}
                        onChange={e => {
                          const next = new Set(selectedArtists);
                          e.target.checked ? next.add(artist.id) : next.delete(artist.id);
                          setSelectedArtists(next);
                        }}
                        className="rounded border-slate-600"
                      />

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                        {artist.profileImageUrl ? (
                          <img src={artist.profileImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">
                            {(artist.firstName?.[0] || '?').toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {artist.firstName} {artist.lastName}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{artist.email}</p>
                      </div>

                      {/* Status badges */}
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap">
                        {artist.shieldVetoActive && (
                          <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] sm:text-xs">
                            <Lock className="h-3 w-3 mr-1" /> VETO
                          </Badge>
                        )}
                        <Badge className={`text-[10px] sm:text-xs border ${MODE_COLORS[mode]}`}>
                          <ModeIcon className="h-3 w-3 mr-1" />
                          {mode.toUpperCase()}
                        </Badge>
                        <div className="text-right">
                          <p className="text-xs sm:text-sm font-mono text-green-400">${vaultTotal.toFixed(0)}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500">vault</p>
                        </div>
                      </div>

                      {/* Toggle + expand */}
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <Switch
                          checked={artist.engineEnabled || false}
                          onCheckedChange={() => toggleArtist(artist.id)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Open artist profile with Economic Engine widget"
                          onClick={() => window.open(`/artist/${artist.id}?widget=economic-engine`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setExpandedArtist(isExpanded ? null : artist.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-4">
                        {/* Vault breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                          {[
                            { label: 'Operation', value: artist.operationBalance, color: 'text-blue-400' },
                            { label: 'Reserve', value: artist.reserveBalance, color: 'text-green-400' },
                            { label: 'Growth', value: artist.growthBalance, color: 'text-purple-400' },
                            { label: 'DeFi', value: artist.defiBalance, color: 'text-orange-400' },
                            { label: 'DeFi Profit', value: artist.totalDefiProfit, color: 'text-emerald-400' },
                          ].map(item => (
                            <div key={item.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
                              <p className="text-xs text-slate-400">{item.label}</p>
                              <p className={`text-lg font-mono font-bold ${item.color}`}>
                                ${parseFloat(item.value || '0').toFixed(0)}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Mode selector + actions */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span className="text-xs sm:text-sm text-slate-400">Mode:</span>
                          {['survival', 'stable', 'expansion', 'aggressive', 'defense'].map(m => (
                            <Button
                              key={m}
                              size="sm"
                              variant={mode === m ? 'default' : 'outline'}
                              className={`text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 ${mode === m ? 'bg-orange-600' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                              onClick={() => changeMode(artist.id, m)}
                            >
                              {m}
                            </Button>
                          ))}
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              size="sm"
                              onClick={() => runCycle(artist.id)}
                              disabled={runningCycle === artist.id || !artist.engineEnabled}
                              className="bg-orange-600 hover:bg-orange-700 text-xs"
                            >
                              {runningCycle === artist.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4 mr-1" />
                              )}
                              Run Cycle
                            </Button>

                            {artist.shieldVetoActive && (
                              <Button size="sm" variant="destructive" onClick={() => clearVeto(artist.id)} className="text-xs">
                                <Unlock className="h-4 w-4 mr-1" /> Clear Veto
                              </Button>
                            )}
                          </div>

                          <div className="flex items-center gap-2 sm:ml-auto">
                            <input
                              type="number"
                              value={simulateAmount}
                              onChange={e => setSimulateAmount(e.target.value)}
                              className="w-full sm:w-28 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                              placeholder="Amount"
                            />
                            <Button size="sm" variant="outline" onClick={() => runSimulation(artist.id)} className="border-slate-600 text-xs whitespace-nowrap">
                              <Eye className="h-4 w-4 mr-1" /> Simulate
                            </Button>
                          </div>
                        </div>

                        {/* Simulation result */}
                        {simulationResult && expandedArtist === artist.id && (
                          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                            <p className="text-sm font-medium text-orange-400 mb-2">Simulation: ${simulationResult.inputAmount.toLocaleString()}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-center text-xs">
                              <div><p className="text-slate-400">Operation</p><p className="text-blue-400 font-mono">${simulationResult.distribution.operation.toFixed(0)}</p></div>
                              <div><p className="text-slate-400">Reserve</p><p className="text-green-400 font-mono">${simulationResult.distribution.reserve.toFixed(0)}</p></div>
                              <div><p className="text-slate-400">Growth</p><p className="text-purple-400 font-mono">${simulationResult.distribution.growth.toFixed(0)}</p></div>
                              <div><p className="text-slate-400">DeFi</p><p className="text-orange-400 font-mono">${simulationResult.distribution.defi.toFixed(0)}</p></div>
                              <div><p className="text-slate-400">Fee</p><p className="text-slate-300 font-mono">${simulationResult.distribution.boostifyFee.toFixed(0)}</p></div>
                            </div>
                            <div className="mt-2 flex gap-4 text-xs">
                              <span className="text-slate-400">Monthly yield: <span className="text-green-400">${simulationResult.projectedMonthlyYield.toFixed(2)}</span></span>
                              <span className="text-slate-400">Annual ROI: <span className="text-green-400">{simulationResult.projectedAnnualROI.toFixed(1)}%</span></span>
                            </div>
                          </div>
                        )}

                        {/* Meta info */}
                        <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-slate-500">
                          {artist.enabledAt && <span><Clock className="h-3 w-3 inline mr-1" />Enabled: {new Date(artist.enabledAt).toLocaleDateString()}</span>}
                          {artist.lastCycleAt && <span><RefreshCw className="h-3 w-3 inline mr-1" />Last cycle: {new Date(artist.lastCycleAt).toLocaleString()}</span>}
                          <span><BarChart3 className="h-3 w-3 inline mr-1" />Health: {parseFloat(artist.healthScore || '0').toFixed(0)}/100</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {artists.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No artists found. Artists will appear here once registered.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIG TAB */}
      {activeTab === 'config' && config && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-slate-900/60 border border-slate-700">
            <CardHeader>
              <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Default Distribution (%)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(config.defaultDistribution).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-sm font-mono text-orange-400">{value}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border border-slate-700">
            <CardHeader>
              <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                DeFi Agent Split (%)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(config.defaultDefiSplit).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-sm font-mono text-blue-400">{value}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border border-slate-700">
            <CardHeader>
              <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Profit Cascade (%)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(config.profitCascade).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-sm font-mono text-green-400">{value}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border border-slate-700">
            <CardHeader>
              <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risk Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Platform Fee</span>
                <span className="text-sm font-mono text-orange-400">{(parseFloat(config.platformFeeRate) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Performance Fee</span>
                <span className="text-sm font-mono text-orange-400">{(parseFloat(config.performanceFeeRate) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Min Reserve Months</span>
                <span className="text-sm font-mono text-yellow-400">{config.minReserveMonths}mo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Max Drawdown</span>
                <span className="text-sm font-mono text-red-400">{config.maxDrawdownPct}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AUDIT TAB */}
      {activeTab === 'audit' && (
        <Card className="bg-slate-900/60 border border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Audit Trail
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {auditLog.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-800/30 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    entry.action.includes('enabled') ? 'bg-green-500' :
                    entry.action.includes('disabled') ? 'bg-red-500' :
                    entry.action.includes('veto') ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <Badge className="bg-slate-700 text-slate-300 text-[10px] sm:text-xs">{entry.actorType}</Badge>
                      <Badge className="bg-slate-700 text-slate-300 text-[10px] sm:text-xs">{entry.action}</Badge>
                      {entry.artistId && <span className="text-[10px] sm:text-xs text-slate-500">Artist #{entry.artistId}</span>}
                    </div>
                    {entry.description && <p className="text-xs text-slate-400 mt-1 truncate">{entry.description}</p>}
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
              ))}
              {auditLog.length === 0 && (
                <p className="text-center text-slate-500 py-6">No audit entries yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
