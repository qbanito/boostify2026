/**
 * AAS Dashboard Module — Autonomous Artist Survival System
 * Lives inside the artist profile as a collapsible section.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { Button } from "../ui/button";
import { useToast } from "../../hooks/use-toast";
import {
  Zap,
  Play,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Shield,
  Target,
  Users,
  BarChart3,
  Music,
  Film,
  Megaphone,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Copy,
} from "lucide-react";

interface AASDashboardProps {
  artistId: number;
  artistName: string;
}

export function AASDashboard({ artistId, artistName }: AASDashboardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"overview" | "plan" | "deals" | "approvals" | "metrics" | "ecosystem">("overview");

  // Fetch AAS status
  const { data: statusData, isLoading: statusLoading } = useQuery<any>({
    queryKey: [`/api/aas/status/${artistId}`],
    enabled: !!artistId,
    refetchInterval: 30000,
  });

  // Fetch survival score
  const { data: scoreData, isLoading: scoreLoading } = useQuery<any>({
    queryKey: [`/api/aas/score/${artistId}`],
    enabled: !!artistId && statusData?.enabled,
  });

  // Fetch today's plan
  const { data: planData } = useQuery<any>({
    queryKey: [`/api/aas/plan/${artistId}/today`],
    enabled: !!artistId && statusData?.enabled,
  });

  // Fetch pending approvals
  const { data: approvalsData } = useQuery<any>({
    queryKey: [`/api/aas/approvals/${artistId}/pending`],
    enabled: !!artistId && statusData?.enabled,
  });

  // Fetch deals pipeline
  const { data: dealsData } = useQuery<any>({
    queryKey: [`/api/aas/deals/${artistId}`],
    enabled: !!artistId && statusData?.enabled,
  });

  // Fetch metrics history
  const { data: metricsData } = useQuery<any>({
    queryKey: [`/api/aas/metrics/${artistId}`],
    enabled: !!artistId && statusData?.enabled,
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest({ url: `/api/aas/toggle/${artistId}`, method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/aas/status/${artistId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/aas/score/${artistId}`] });
      toast({ title: "⚡ AAS Updated", description: "Engine status changed" });
    },
  });

  // Run cycle mutation
  const runCycleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest({ url: `/api/aas/run-cycle/${artistId}`, method: "POST" });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/aas/score/${artistId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/aas/plan/${artistId}/today`] });
      queryClient.invalidateQueries({ queryKey: [`/api/aas/metrics/${artistId}`] });
      toast({
        title: "⚡ Cycle Complete",
        description: data?.summary?.skipped
          ? data.summary.reason
          : `Score: ${data?.summary?.scoreBefore} → ${data?.summary?.scoreAfter} | Earned: $${data?.summary?.totalEarned?.toFixed(2)}`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Approve/reject mutation
  const decisionMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: "approve" | "reject" }) => {
      return await apiRequest({ url: `/api/aas/approvals/${id}/${decision}`, method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/aas/approvals/${artistId}/pending`] });
      toast({ title: "Decision saved" });
    },
  });

  const isEnabled = statusData?.enabled;
  const score = scoreData?.score;
  const financial = scoreData?.financial;
  const plan = planData?.plan;
  const approvals = approvalsData?.approvals || [];
  const deals = dealsData?.deals || [];
  const metrics = metricsData?.metrics || [];

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading AAS...
      </div>
    );
  }

  // Not enabled — show activation CTA
  if (!isEnabled) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-400/10 mb-4">
          <Zap className="h-8 w-8 text-yellow-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">AAS Engine</h3>
        <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
          Activate the Autonomous Artist Survival System to enable AI-powered monetization, 
          deal management, audience growth and strategic planning for {artistName}.
        </p>
        <Button
          onClick={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
        >
          {toggleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          Activate AAS Engine
        </Button>
      </div>
    );
  }

  // Get score color
  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-400";
    if (s >= 60) return "text-blue-400";
    if (s >= 40) return "text-yellow-400";
    if (s >= 20) return "text-orange-400";
    return "text-red-400";
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      thriving: "🚀 Thriving",
      healthy: "✅ Healthy",
      surviving: "⚠️ Surviving",
      at_risk: "🔴 At Risk",
      critical: "💀 Critical",
    };
    return map[status] || status;
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "plan", label: "Today's Plan", icon: Target },
    { id: "approvals", label: `Approvals${approvals.length > 0 ? ` (${approvals.length})` : ""}`, icon: Shield },
    { id: "deals", label: `Deals (${deals.length})`, icon: DollarSign },
    { id: "metrics", label: "History", icon: TrendingUp },
    { id: "ecosystem", label: "Ecosystem", icon: Sparkles },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/20 text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Active
          </span>
          {statusData?.lastCycleAt && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last cycle: {new Date(statusData.lastCycleAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runCycleMutation.mutate()}
            disabled={runCycleMutation.isPending}
            className="border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/10 text-xs"
          >
            {runCycleMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            Run Cycle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleMutation.mutate()}
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs"
          >
            Deactivate
          </Button>
        </div>
      </div>

      {/* Score Card */}
      {score && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${getScoreColor(score.total)}`}>{score.total}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Survival Score</div>
            <div className="text-xs mt-1">{getStatusLabel(score.status)}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{financial?.runwayDays || 0}<span className="text-sm text-gray-400">d</span></div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Runway</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">${financial?.totalRevenue30d?.toFixed(0) || "0"}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Revenue 30d</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">${financial?.dailyBurnRate?.toFixed(1) || "0"}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Daily Burn</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-yellow-400/20 text-yellow-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && score && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-300">Score Breakdown</h4>
            <div className="space-y-2">
              {[
                { label: "Revenue Health", value: score.components?.revenueHealth, weight: "30%" },
                { label: "Audience Momentum", value: score.components?.audienceMomentum, weight: "20%" },
                { label: "Deal Velocity", value: score.components?.dealVelocity, weight: "20%" },
                { label: "Pipeline Strength", value: score.components?.pipelineStrength, weight: "15%" },
                { label: "Brand Relevance", value: score.components?.brandRelevance, weight: "15%" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-36">{item.label} ({item.weight})</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400"
                      style={{ width: `${Math.min(100, item.value || 0)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-300 w-8 text-right">{item.value || 0}</span>
                </div>
              ))}
            </div>

            <h4 className="text-sm font-semibold text-gray-300 mt-4">Penalties</h4>
            <div className="space-y-2">
              {[
                { label: "Burn Rate", value: score.components?.burnRate },
                { label: "Churn Rate", value: score.components?.churnRate },
                { label: "Content Fatigue", value: score.components?.contentFatigue },
                { label: "Legal Risk", value: score.components?.legalRisk },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-36">{item.label}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-red-400 to-red-600"
                      style={{ width: `${Math.min(100, item.value || 0)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-300 w-8 text-right">{item.value || 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "overview" && !score && !scoreLoading && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No score data yet. Run a cycle to generate the first survival score.
          </div>
        )}

        {/* PLAN TAB */}
        {activeTab === "plan" && (
          <div className="space-y-3">
            {plan ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                    {plan.cycleDate}
                  </span>
                  <span className="text-xs text-gray-400">
                    {plan.actionsCompleted} completed · {plan.actionsFailed} failed
                  </span>
                </div>

                {plan.objectives && plan.objectives.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Objectives</h4>
                    <ul className="space-y-1">
                      {plan.objectives.map((obj: string, i: number) => (
                        <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                          <Target className="h-3.5 w-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {plan.plannedActions && plan.plannedActions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Actions</h4>
                    <div className="space-y-2">
                      {plan.plannedActions.map((a: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-gray-800/50">
                          {a.status === "completed" ? (
                            <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                          ) : a.status === "failed" ? (
                            <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white truncate">{a.action}</div>
                            <div className="text-[10px] text-gray-500">{a.agent} · {a.channel || "general"}</div>
                            {a.result && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{a.result}</div>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            {(a.revenueGenerated ?? 0) > 0 && (
                              <div className="text-[10px] text-green-400">+${a.revenueGenerated.toFixed(2)}</div>
                            )}
                            {(a.costActual ?? 0) > 0 && (
                              <div className="text-[10px] text-red-400">-${a.costActual.toFixed(2)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {plan.lessonsLearned && plan.lessonsLearned.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Lessons Learned</h4>
                    <ul className="space-y-1">
                      {plan.lessonsLearned.map((l: string, i: number) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                          <span className="text-yellow-400">•</span> {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-4 pt-2 text-xs text-gray-500">
                  <span>Score: {plan.survivalScoreBefore} → {plan.survivalScoreAfter}</span>
                  <span>Spent: ${plan.totalSpent}</span>
                  <span>Earned: ${plan.totalEarned}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                No plan for today yet. Click "Run Cycle" to generate one.
              </div>
            )}
          </div>
        )}

        {/* APPROVALS TAB */}
        {activeTab === "approvals" && (
          <div className="space-y-3">
            {approvals.length > 0 ? (
              approvals.map((a: any) => (
                <div key={a.id} className="p-3 rounded-lg bg-gray-800/50 border border-yellow-400/20">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-white">{a.actionType}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{a.description}</div>
                      <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
                        <span>Agent: {a.agent}</span>
                        {a.estimatedCost && <span>Cost: ${a.estimatedCost}</span>}
                        <span className={`${a.riskLevel === "high" || a.riskLevel === "critical" ? "text-red-400" : "text-yellow-400"}`}>
                          Risk: {a.riskLevel}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => decisionMutation.mutate({ id: a.id, decision: "approve" })}
                        disabled={decisionMutation.isPending}
                        className="bg-green-500 hover:bg-green-600 text-white text-xs h-7 px-2"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decisionMutation.mutate({ id: a.id, decision: "reject" })}
                        disabled={decisionMutation.isPending}
                        className="border-red-500 text-red-400 text-xs h-7 px-2"
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No pending approvals
              </div>
            )}
          </div>
        )}

        {/* DEALS TAB */}
        {activeTab === "deals" && (
          <div className="space-y-2">
            {deals.length > 0 ? (
              deals.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{d.entityName}</div>
                    <div className="text-[10px] text-gray-500">{d.dealType} · {d.channel}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    d.stage === "closed_won" ? "bg-green-500/20 text-green-400" :
                    d.stage === "closed_lost" ? "bg-red-500/20 text-red-400" :
                    d.stage === "negotiation" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-700 text-gray-300"
                  }`}>
                    {d.stage?.replace("_", " ")}
                  </span>
                  {d.estimatedValue && (
                    <span className="text-xs text-gray-400">${Number(d.estimatedValue).toLocaleString()}</span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No deals in pipeline yet
              </div>
            )}
          </div>
        )}

        {/* METRICS TAB */}
        {activeTab === "metrics" && (
          <div className="space-y-2">
            {metrics.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-1.5 pr-3">Period</th>
                      <th className="text-right py-1.5 px-2">Score</th>
                      <th className="text-right py-1.5 px-2">Revenue</th>
                      <th className="text-right py-1.5 px-2">Costs</th>
                      <th className="text-right py-1.5 px-2">Net</th>
                      <th className="text-right py-1.5 px-2">Runway</th>
                      <th className="text-right py-1.5 pl-2">Fan Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.slice(0, 15).map((m: any) => (
                      <tr key={m.id} className="border-b border-gray-800/50 text-gray-300">
                        <td className="py-1.5 pr-3">{m.period}</td>
                        <td className={`text-right py-1.5 px-2 font-medium ${getScoreColor(Number(m.survivalScore))}`}>
                          {Number(m.survivalScore).toFixed(0)}
                        </td>
                        <td className="text-right py-1.5 px-2 text-green-400">${Number(m.totalRevenue || 0).toFixed(0)}</td>
                        <td className="text-right py-1.5 px-2 text-red-400">${Number(m.totalCosts || 0).toFixed(0)}</td>
                        <td className={`text-right py-1.5 px-2 ${Number(m.netProfit) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          ${Number(m.netProfit || 0).toFixed(0)}
                        </td>
                        <td className="text-right py-1.5 px-2">{m.runwayDays}d</td>
                        <td className={`text-right py-1.5 pl-2 ${(m.netFanGrowth || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {(m.netFanGrowth || 0) >= 0 ? "+" : ""}{m.netFanGrowth || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No metrics history yet. Data appears after the first cycle.
              </div>
            )}
          </div>
        )}

        {/* ECOSYSTEM TAB */}
        {activeTab === "ecosystem" && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Song-to-Ecosystem Generator · One song, infinite assets
            </p>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Every song you release should activate a complete ecosystem. Genesis Engine
              auto-proposes the full asset chain so nothing is left behind.
            </p>
            {[
              {
                icon: Music, color: '#818cf8', label: 'Master Track',
                assets: ['Final mix + master', 'Stems pack (vocals / drums / bass / FX)', 'Instrumental version', 'A cappella version'],
              },
              {
                icon: Film, color: '#c084fc', label: 'Visual Package',
                assets: ['AI cover art (4 variants)', '3 short-form clips (15s / 30s / 60s)', 'Official video concept brief', 'Lyric video assets'],
              },
              {
                icon: Megaphone, color: '#f59e0b', label: 'Campaign Brief',
                assets: ['Pre-save landing page', '30-day rollout calendar', 'Press release draft', 'Playlist pitch targets'],
              },
              {
                icon: ShoppingBag, color: '#fb923c', label: 'Merch Concepts',
                assets: ['T-shirt graphic concept', 'Limited vinyl concept', 'Digital download bundle', 'Fan collectible idea'],
              },
              {
                icon: Target, color: '#34d399', label: 'Viral Strategy',
                assets: ['TikTok challenge hook', 'Instagram Reel cut', 'Twitter/X thread angle', 'Community challenge idea'],
              },
              {
                icon: DollarSign, color: '#2dd4bf', label: 'Monetization Layer',
                assets: ['Sync licensing pitch list', 'Brand partnership brief', 'Fan subscription tier idea', 'Tokenization concept'],
              },
            ].map(({ icon: Icon, color, label, assets }) => (
              <div
                key={label}
                className="rounded-xl p-3"
                style={{ background: `${color}0c`, border: `1px solid ${color}20` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-lg"
                    style={{ background: `${color}20`, color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-bold text-white">{label}</span>
                  <span
                    className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: `${color}20`, color }}
                  >
                    {assets.length} assets
                  </span>
                </div>
                <div className="space-y-1">
                  {assets.map((asset) => (
                    <div key={asset} className="flex items-center gap-1.5">
                      <span className="text-[10px]" style={{ color }}>·</span>
                      <span className="text-[10px] text-gray-400">{asset}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}
            >
              <Sparkles className="h-4 w-4 mx-auto mb-1" style={{ color: '#fbbf24' }} />
              <p className="text-[10px] text-gray-400">
                When Genesis Engine runs its next cycle, it will auto-generate this ecosystem
                based on your next scheduled release.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
