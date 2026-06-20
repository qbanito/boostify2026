/**
 * AAS Engine Panel — Artist Profile Module
 * 
 * Displays survival score, daily plan, deal pipeline,
 * pending approvals, metrics history, and AAS toggle.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../ui/button";
import {
  Zap, ChevronDown, ChevronUp, Play, CheckCircle, XCircle,
  TrendingUp, TrendingDown, DollarSign, Target, Shield,
  Clock, AlertTriangle, BarChart3, Activity, Loader2,
  RefreshCw, ListChecks, Radio, Landmark, Share2, Link,
  Info, X, Bot, Brain, Handshake, Users, ShieldCheck, Calculator,
  Palette, Megaphone, Workflow, Sparkles, HelpCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid,
} from "recharts";

interface AASEnginePanelProps {
  artistId: string;
  pgId?: number;
  isOwnProfile: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  colors: any;
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
  artistName: string;
}

// Score color based on status
function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-yellow-400";
  if (score >= 20) return "text-orange-400";
  return "text-red-400";
}

function statusLabel(score: number): string {
  if (score >= 80) return "Thriving";
  if (score >= 60) return "Healthy";
  if (score >= 40) return "Surviving";
  if (score >= 20) return "At Risk";
  return "Critical";
}

function statusBg(score: number): string {
  if (score >= 80) return "bg-green-500/20 border-green-500/30";
  if (score >= 60) return "bg-blue-500/20 border-blue-500/30";
  if (score >= 40) return "bg-yellow-500/20 border-yellow-500/30";
  if (score >= 20) return "bg-orange-500/20 border-orange-500/30";
  return "bg-red-500/20 border-red-500/30";
}

export function AASEnginePanel({
  artistId,
  pgId,
  isOwnProfile,
  isExpanded,
  onToggleExpand,
  colors,
  cardStyles,
  cardStyleInline,
  artistName,
}: AASEnginePanelProps) {
  const { toast } = useToast();
  const numericId = pgId || parseInt(artistId, 10);
  const [activeTab, setActiveTab] = useState<"overview" | "goals" | "plan" | "deals" | "approvals" | "metrics">("overview");
  const [showGuide, setShowGuide] = useState(false);

  // --- Queries ---
  const { data: statusData, isLoading: statusLoading } = useQuery<any>({
    queryKey: ["/api/aas/status", numericId],
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/aas/status/${numericId}`, method: "GET" });
      return res;
    },
    enabled: !!numericId && isOwnProfile,
  });

  const { data: scoreData, isLoading: scoreLoading } = useQuery<any>({
    queryKey: ["/api/aas/score", numericId],
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/aas/score/${numericId}`, method: "GET" });
      return res;
    },
    enabled: !!numericId && isOwnProfile && statusData?.enabled,
  });

  const { data: planData } = useQuery<any>({
    queryKey: ["/api/aas/plan", numericId, "today"],
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/aas/plan/${numericId}/today`, method: "GET" });
      return res;
    },
    enabled: !!numericId && isOwnProfile && statusData?.enabled && activeTab === "plan",
  });

  const { data: dealsData } = useQuery<any>({
    queryKey: ["/api/aas/deals", numericId],
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/aas/deals/${numericId}`, method: "GET" });
      return res;
    },
    enabled: !!numericId && isOwnProfile && statusData?.enabled && activeTab === "deals",
  });

  const { data: approvalsData } = useQuery<any>({
    queryKey: ["/api/aas/approvals", numericId],
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/aas/approvals/${numericId}/pending`, method: "GET" });
      return res;
    },
    enabled: !!numericId && isOwnProfile && statusData?.enabled && activeTab === "approvals",
  });

  const { data: metricsData } = useQuery<any>({
    queryKey: ["/api/aas/metrics", numericId],
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/aas/metrics/${numericId}`, method: "GET" });
      return res;
    },
    enabled: !!numericId && isOwnProfile && statusData?.enabled && activeTab === "metrics",
  });

  const { data: goalsData } = useQuery<any>({
    queryKey: ["/api/aas/goals", numericId],
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/aas/goals/${numericId}`, method: "GET" });
      return res;
    },
    enabled: !!numericId && isOwnProfile && statusData?.enabled && (activeTab === "goals" || activeTab === "overview"),
  });

  // --- Mutations ---
  const toggleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest({ url: `/api/aas/toggle/${numericId}`, method: "POST" });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/aas/status", numericId] });
      toast({
        title: data.enabled ? "⚡ AAS Activated" : "AAS Deactivated",
        description: data.enabled ? "Autonomous engine is now running" : "Engine stopped",
      });
    },
  });

  const runCycleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest({ url: `/api/aas/run-cycle/${numericId}`, method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aas/score", numericId] });
      queryClient.invalidateQueries({ queryKey: ["/api/aas/plan", numericId, "today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/aas/metrics", numericId] });
      toast({ title: "Cycle Complete", description: "Daily AAS cycle executed successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Cycle Failed", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: "approve" | "reject" }) => {
      return await apiRequest({ url: `/api/aas/approvals/${id}/${decision}`, method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aas/approvals", numericId] });
      toast({ title: "Decision saved" });
    },
  });

  if (!isOwnProfile) return null;

  const enabled = statusData?.enabled || false;
  const score = scoreData?.score?.total ?? 0;
  const financial = scoreData?.financial;
  const plan = planData?.plan;
  const deals = dealsData?.deals || [];
  const approvals = approvalsData?.approvals || [];
  const metrics = metricsData?.metrics || [];
  const goals = goalsData?.goals || [];

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Activity },
    { id: "goals" as const, label: `Goals${goals.length ? ` (${goals.filter((g: any) => g.status === 'completed').length}/${goals.length})` : ""}`, icon: ListChecks },
    { id: "plan" as const, label: "Today's Plan", icon: Target },
    { id: "deals" as const, label: "Deals", icon: DollarSign },
    { id: "approvals" as const, label: `Approvals${approvals.length ? ` (${approvals.length})` : ""}`, icon: Shield },
    { id: "metrics" as const, label: "Metrics", icon: BarChart3 },
  ];

  return (
    <div className={`${cardStyles} overflow-hidden`} style={cardStyleInline}>

      {/* ── GUIDE OVERLAY ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            key="aas-guide-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              initial={{ y: 64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 64, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10"
              style={{ background: 'linear-gradient(145deg,#0d0d12,#191924)' }}
              onClick={e => e.stopPropagation()}
            >
              <AASGuideContent onClose={() => setShowGuide(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full flex items-center p-3 sm:p-4 gap-2">
        <button
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-3 hover:opacity-80 transition-opacity text-left min-w-0"
        >
          <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${enabled ? "bg-yellow-500/20" : "bg-gray-800"}`}>
            <Zap className={`h-4 w-4 sm:h-5 sm:w-5 ${enabled ? "text-yellow-400" : "text-gray-500"}`} />
          </div>
          <div className="text-left min-w-0">
            <h3 className="font-semibold text-sm sm:text-base text-white flex items-center gap-2 flex-wrap">
              AAS Engine
              {enabled && (
                <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  ACTIVE
                </span>
              )}
            </h3>
            <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed truncate">
              {enabled
                ? `Score: ${score} — ${statusLabel(score)}`
                : "Autonomous Artist Survival System"}
            </p>
          </div>
          <div className="flex-shrink-0 ml-2">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            )}
          </div>
        </button>
        <button
          onClick={e => { e.stopPropagation(); setShowGuide(true); }}
          className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-yellow-400 hover:opacity-80 transition-colors"
          title="What is AAS?"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-4 space-y-4">
          {/* Toggle + Run Cycle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
            <Button
              size="sm"
              variant={enabled ? "default" : "outline"}
              className={`w-full sm:w-auto ${enabled
                ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                : "border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
              }`}
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
            >
              {toggleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Zap className="h-4 w-4 mr-1" />
              )}
              {enabled ? "Deactivate" : "Activate AAS"}
            </Button>
            {enabled && (
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                onClick={() => runCycleMutation.mutate()}
                disabled={runCycleMutation.isPending}
              >
                {runCycleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                Run Cycle Now
              </Button>
            )}
            {statusData?.lastCycleAt && (
              <span className="text-[11px] sm:text-xs text-gray-500 flex items-center gap-1 sm:ml-1">
                <Clock className="h-3 w-3" />
                Last: {new Date(statusData.lastCycleAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {enabled && (
            <>
              {/* Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === tab.id ? "text-black shadow-sm" : "text-gray-400 hover:text-gray-200"
                    }`}
                    style={activeTab === tab.id ? { backgroundColor: '#eab308' } : undefined}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="min-h-[200px]">
                {activeTab === "overview" && <OverviewTab score={score} financial={financial} loading={scoreLoading} goals={goals} />}
                {activeTab === "goals" && <GoalsTab goals={goals} />}
                {activeTab === "plan" && <PlanTab plan={plan} />}
                {activeTab === "deals" && <DealsTab deals={deals} />}
                {activeTab === "approvals" && <ApprovalsTab approvals={approvals} onDecide={(id, d) => approveMutation.mutate({ id, decision: d })} />}
                {activeTab === "metrics" && <MetricsTab metrics={metrics} />}
              </div>
            </>
          )}

          {/* Not enabled hint */}
          {!enabled && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden text-center py-10 px-4 rounded-2xl border border-yellow-500/10"
              style={{ background: 'linear-gradient(145deg, rgba(234,179,8,0.06), rgba(0,0,0,0.2))' }}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-36 h-36 rounded-full blur-[60px]" style={{ backgroundColor: 'rgba(234,179,8,0.12)' }} />
              </div>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 inline-flex p-4 rounded-2xl mb-4"
                style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.2)' }}
              >
                <Zap className="h-8 w-8 text-yellow-400" />
              </motion.div>
              <p className="relative z-10 text-sm font-semibold text-white leading-relaxed">Activate AAS to unlock the autonomous survival engine</p>
              <p className="relative z-10 text-xs text-gray-500 mt-1 leading-relaxed">Manages revenue, deals, growth, community &amp; compliance automatically</p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

// === Tab Components ===

function OverviewTab({ score, financial, loading, goals }: { score: number; financial: any; loading: boolean; goals: any[] }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  const completedGoals = goals.filter((g: any) => g.status === 'completed').length;
  const totalGoals = goals.length;
  const circ = 2 * Math.PI * 28;
  const arcColor = score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#eab308' : score >= 20 ? '#f97316' : '#ef4444';

  return (
    <div className="space-y-4">
      {/* Survival Score */}
      <div className={`rounded-xl border p-3 sm:p-4 ${statusBg(score)}`}>
        <div className="flex items-center gap-4">
          {/* Animated Arc */}
          <div className="relative flex-shrink-0 w-[72px] h-[72px]">
            <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
              <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              <motion.circle
                cx="36" cy="36" r="28" fill="none" strokeWidth="6" strokeLinecap="round"
                style={{ stroke: arcColor }}
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ * (1 - score / 100) }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span
                className={`text-xl font-black ${scoreColor(score)}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {score}
              </motion.span>
            </div>
          </div>
          {/* Label + bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm font-bold text-white">{statusLabel(score)}</span>
              <span className="text-[11px] text-gray-500">/ 100</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">Survival Score</p>
            <div className="w-full h-1.5 bg-gray-800/80 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: arcColor }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, score)}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Daily Goals Mini Summary */}
      {totalGoals > 0 && (
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <ListChecks className="h-4 w-4 text-purple-400" />
              Daily Goals
            </span>
            <span className="text-sm font-bold text-purple-400">{completedGoals}/{totalGoals}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-purple-500 transition-all duration-500"
              style={{ width: `${totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {goals.slice(0, 6).map((g: any) => (
              <span key={g.id} className={`text-[10px] px-2 py-0.5 rounded-full ${
                g.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                g.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                g.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-700/50 text-gray-400'
              }`}>
                {goalCategoryIcon(g.category)} {g.category.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Financial Snapshot */}
      {financial && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <StatCard label="Balance" value={`$${Number(financial.currentBalance || 0).toFixed(0)}`} icon={DollarSign} />
          <StatCard label="Runway" value={`${financial.runwayDays || 0}d`} icon={Clock} warning={financial.runwayDays < 30} />
          <StatCard label="Burn/day" value={`$${Number(financial.dailyBurnRate || 0).toFixed(1)}`} icon={TrendingDown} />
          <StatCard
            label="Revenue 7d"
            value={`$${Object.values(financial.revenueByChannel || {}).reduce((a: number, b: any) => a + Number(b || 0), 0).toFixed(0)}`}
            icon={TrendingUp}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, warning }: { label: string; value: string; icon: any; warning?: boolean }) {
  const accent = warning ? '#f97316' : '#eab308';
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative overflow-hidden rounded-xl border p-2.5 sm:p-3"
      style={{ borderColor: accent + '30', background: `linear-gradient(145deg,${accent}10,rgba(0,0,0,0.25))` }}
    >
      <div className="absolute top-0 right-0 w-10 h-10 rounded-full blur-[18px] opacity-25" style={{ backgroundColor: accent }} />
      <div className="relative z-10">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
          <span className="text-[11px] sm:text-xs text-gray-400">{label}</span>
        </div>
        <p className="text-base sm:text-lg font-bold text-white">{value}</p>
      </div>
    </motion.div>
  );
}

function PlanTab({ plan }: { plan: any }) {
  if (!plan) {
    return <div className="text-center py-8 text-gray-500 text-sm">No plan executed today. Run a cycle to generate.</div>;
  }

  const actions = plan.plannedActions || [];
  return (
    <div className="space-y-3">
      {/* Objectives */}
      {plan.objectives && plan.objectives.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1.5">Objectives</p>
          <ul className="space-y-1">
            {plan.objectives.map((obj: string, i: number) => (
              <li key={i} className="text-xs sm:text-sm text-gray-300 flex items-start gap-2 leading-relaxed">
                <Target className="h-3.5 w-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-gray-400">Actions ({actions.length})</p>
          <div className="flex gap-2 text-[10px]">
            <span className="text-green-400">{plan.actionsCompleted || 0} done</span>
            <span className="text-red-400">{plan.actionsFailed || 0} failed</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {actions.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs sm:text-sm p-2 rounded-lg bg-gray-800/50 border border-gray-700/50">
              {a.status === "completed" ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
              ) : a.status === "failed" ? (
                <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
              )}
              <span className="text-gray-300 flex-1 truncate">{a.action}</span>
              <span className="text-[10px] sm:text-[11px] text-gray-500">{a.agent}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Score Delta */}
      {plan.survivalScoreBefore != null && plan.survivalScoreAfter != null && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-gray-400 pt-2 border-t border-gray-700/50">
          <span>Score: {Number(plan.survivalScoreBefore).toFixed(0)}</span>
          <span>→</span>
          <span className={Number(plan.survivalScoreAfter) >= Number(plan.survivalScoreBefore) ? "text-green-400" : "text-red-400"}>
            {Number(plan.survivalScoreAfter).toFixed(0)}
          </span>
          <span className="sm:ml-auto w-full sm:w-auto">Spent: ${Number(plan.totalSpent || 0).toFixed(2)} | Earned: ${Number(plan.totalEarned || 0).toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

function DealsTab({ deals }: { deals: any[] }) {
  if (deals.length === 0) {
    return <div className="text-center py-8 text-gray-500 text-sm">No deals in pipeline yet</div>;
  }

  const stageColors: Record<string, string> = {
    identified: "bg-gray-500", qualified: "bg-blue-500", contacted: "bg-cyan-500",
    responded: "bg-teal-500", negotiation: "bg-yellow-500", proposal_sent: "bg-orange-500",
    contract_review: "bg-purple-500", signed: "bg-green-500", active: "bg-green-400",
    completed: "bg-emerald-500", lost: "bg-red-500",
  };

  return (
    <div className="space-y-2">
      {deals.slice(0, 15).map((deal: any) => (
        <div key={deal.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
          <div className={`w-2 h-2 rounded-full ${stageColors[deal.stage] || "bg-gray-500"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-white truncate">{deal.entityName || "Unknown"}</p>
            <p className="text-[10px] text-gray-500">{deal.dealType} — {deal.stage}</p>
          </div>
          {deal.estimatedValue && (
            <span className="text-[11px] sm:text-xs text-green-400">${Number(deal.estimatedValue).toLocaleString()}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ApprovalsTab({ approvals, onDecide }: { approvals: any[]; onDecide: (id: number, d: "approve" | "reject") => void }) {
  if (approvals.length === 0) {
    return <div className="text-center py-8 text-gray-500 text-sm">No pending approvals</div>;
  }

  return (
    <div className="space-y-3">
      {approvals.map((a: any) => (
        <div key={a.id} className="p-3 rounded-lg bg-gray-800/50 border border-yellow-500/20">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-xs sm:text-sm text-white font-medium leading-relaxed">{a.actionType}</p>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 leading-relaxed">{a.description}</p>
            </div>
            <span className={`text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${
              a.riskLevel === "critical" ? "bg-red-500/20 text-red-400" :
              a.riskLevel === "high" ? "bg-orange-500/20 text-orange-400" :
              "bg-yellow-500/20 text-yellow-400"
            }`}>
              {a.riskLevel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] text-gray-500 mb-2">
            <span>Agent: {a.agent}</span>
            {a.estimatedCost && <span>Cost: ${Number(a.estimatedCost).toFixed(2)}</span>}
            {a.estimatedRevenue && <span>Rev: ${Number(a.estimatedRevenue).toFixed(2)}</span>}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => onDecide(a.id, "approve")}>
              <CheckCircle className="h-3 w-3 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/20" onClick={() => onDecide(a.id, "reject")}>
              <XCircle className="h-3 w-3 mr-1" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// === Goal Helpers ===

function goalCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    radio_outreach: '📻',
    label_deal: '🏷️',
    social_post: '📱',
    social_engage: '💬',
    blockchain_register: '⛓️',
    blockchain_tokenize: '🪙',
    blockchain_trade: '📈',
    sponsor_outreach: '🤝',
    venue_booking: '🎪',
    content_create: '🎨',
    fan_engage: '❤️',
    email_campaign: '📧',
    music_release: '🎵',
    merch_launch: '👕',
  };
  return icons[category] || '📌';
}

function goalStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400';
    case 'in_progress': return 'text-blue-400';
    case 'failed': return 'text-red-400';
    case 'skipped': return 'text-gray-500';
    default: return 'text-gray-400';
  }
}

function GoalsTab({ goals }: { goals: any[] }) {
  if (goals.length === 0) {
    return <div className="text-center py-8 text-gray-500 text-sm">No goals set today. Run a cycle to generate daily goals.</div>;
  }

  const completed = goals.filter((g: any) => g.status === 'completed').length;
  const inProgress = goals.filter((g: any) => g.status === 'in_progress').length;
  const failed = goals.filter((g: any) => g.status === 'failed').length;
  const pending = goals.filter((g: any) => g.status === 'pending').length;

  return (
    <div className="space-y-3">
      {/* Summary Bar */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs">
        <span className="text-green-400">✓ {completed}</span>
        <span className="text-blue-400">⟳ {inProgress}</span>
        <span className="text-red-400">✗ {failed}</span>
        <span className="text-gray-500">○ {pending}</span>
        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500" style={{ width: `${(completed / goals.length) * 100}%` }} />
          <div className="h-full bg-blue-500" style={{ width: `${(inProgress / goals.length) * 100}%` }} />
          <div className="h-full bg-red-500" style={{ width: `${(failed / goals.length) * 100}%` }} />
        </div>
      </div>

      {/* Goals List */}
      <div className="space-y-2">
        {goals.sort((a: any, b: any) => (a.priority || 3) - (b.priority || 3)).map((goal: any) => (
          <div
            key={goal.id}
            className={`p-3 rounded-lg border ${
              goal.status === 'completed' ? 'border-green-500/20 bg-green-500/5' :
              goal.status === 'in_progress' ? 'border-blue-500/20 bg-blue-500/5' :
              goal.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
              'border-gray-700/50 bg-gray-800/50'
            }`}
          >
            <div className="flex items-start gap-2">
              {/* Status icon */}
              <span className="text-lg flex-shrink-0 mt-0.5">
                {goal.status === 'completed' ? '✅' :
                 goal.status === 'in_progress' ? '🔄' :
                 goal.status === 'failed' ? '❌' : '⏳'}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm">{goalCategoryIcon(goal.category)}</span>
                  <p className="text-sm text-white font-medium truncate">{goal.title}</p>
                </div>

                {goal.description && (
                  <p className="text-[11px] sm:text-xs text-gray-400 mb-1 leading-relaxed">{goal.description}</p>
                )}

                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        goal.status === 'completed' ? 'bg-green-500' :
                        goal.status === 'failed' ? 'bg-red-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${goal.targetCount > 0 ? Math.min(100, (goal.completedCount / goal.targetCount) * 100) : 0}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-mono ${goalStatusColor(goal.status)}`}>
                    {goal.completedCount}/{goal.targetCount}
                  </span>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-[10px] sm:text-[11px] text-gray-500">
                  <span>{goal.category.replace(/_/g, ' ')}</span>
                  {goal.agent && <span>→ {goal.agent}</span>}
                  {goal.channel && <span>via {goal.channel}</span>}
                </div>

                {goal.result && (
                  <p className="text-[10px] text-gray-400 mt-1 italic">{goal.result}</p>
                )}
              </div>

              {/* Priority badge */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                goal.priority === 1 ? 'bg-red-500/20 text-red-400' :
                goal.priority === 2 ? 'bg-orange-500/20 text-orange-400' :
                goal.priority === 3 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-gray-700/50 text-gray-500'
              }`}>
                P{goal.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsTab({ metrics }: { metrics: any[] }) {
  if (metrics.length === 0) {
    return <div className="text-center py-8 text-gray-500 text-sm">No metrics history yet. Run cycles to build data.</div>;
  }

  const chartData = [...metrics].slice(0, 14).reverse().map((m: any) => ({
    period: m.period,
    score: parseFloat(Number(m.survivalScore).toFixed(1)),
    profit: parseFloat(Number(m.netProfit || 0).toFixed(0)),
  }));

  const latestScore = Number(metrics[0]?.survivalScore || 0);
  const lineColor = latestScore >= 80 ? '#22c55e' : latestScore >= 60 ? '#3b82f6' : latestScore >= 40 ? '#eab308' : '#f97316';

  const ttStyle = {
    contentStyle: { background: '#0d0d12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 },
    labelStyle: { color: '#9ca3af' },
  };

  return (
    <div className="space-y-4">
      {/* Score Trend */}
      <div>
        <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-yellow-400" /> Survival Score Trend
        </p>
        <div className="rounded-xl border border-yellow-500/15 p-3" style={{ background: 'rgba(234,179,8,0.04)' }}>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="aasScoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <RTooltip {...ttStyle} itemStyle={{ color: lineColor }} />
              <Area type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2} fill="url(#aasScoreGrad)" dot={{ fill: lineColor, r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Net Profit */}
      <div>
        <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-green-400" /> Net Profit per Cycle
        </p>
        <div className="rounded-xl border border-green-500/15 p-3" style={{ background: 'rgba(34,197,94,0.04)' }}>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <RTooltip {...ttStyle} formatter={(v: any) => [`$${v}`, 'Net Profit']} />
              <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
                {chartData.map((_: any, idx: number) => (
                  <Cell key={idx} fill={chartData[idx].profit >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── AAS Guide Content ────────────────────────────────────
function AASGuideContent({ onClose }: { onClose: () => void }) {
  const agents = [
    { icon: Brain, name: "Survival Strategist", color: "text-purple-400", desc: "Analyzes your survival score, financial health, and market position to create a prioritized daily plan of action." },
    { icon: DollarSign, name: "Revenue Operator", color: "text-green-400", desc: "Generates income through merch drops, stream campaigns, and fan monetization strategies." },
    { icon: Handshake, name: "Deal Closer", color: "text-blue-400", desc: "Contacts radio stations, pitches to record labels, negotiates sponsorships, and books venue gigs automatically." },
    { icon: TrendingUp, name: "Growth Operator", color: "text-cyan-400", desc: "Creates AI-generated images, videos, and album art using FAL AI to boost your brand visibility." },
    { icon: Users, name: "Community Operator", color: "text-pink-400", desc: "Nurtures superfans, sends newsletters via Brevo, and drives engagement with polls and Q&As." },
    { icon: ShieldCheck, name: "Risk & Compliance", color: "text-yellow-400", desc: "Reviews every planned action for budget risk, legal concerns, and brand safety before execution." },
    { icon: Calculator, name: "Finance Controller", color: "text-emerald-400", desc: "Tracks spending vs. earnings, calculates ROI per channel, and manages your burn rate." },
    { icon: Share2, name: "Social Operator", color: "text-orange-400", desc: "Posts on Boostify's social network, likes and comments on other artists' content, and promotes your releases." },
    { icon: Link, name: "Blockchain Operator", color: "text-indigo-400", desc: "Registers your identity on Polygon, tokenizes your songs as BTF-2300 NFTs, and monitors on-chain activity." },
  ];

  const phases = [
    { num: 1, name: "Diagnose", desc: "Calculates your survival score and financial snapshot" },
    { num: 2, name: "Prioritize", desc: "Selects the optimal strategy mode for today" },
    { num: 3, name: "Set Goals", desc: "Generates daily goals (radio, social, blockchain, etc.)" },
    { num: 4, name: "Validate", desc: "Risk agent reviews every action before execution" },
    { num: 5, name: "Execute", desc: "Routes approved actions to the 9 specialized agents" },
    { num: 6, name: "Update Goals", desc: "Maps results to goals and tracks progress" },
    { num: 7, name: "Learn", desc: "Saves strategic memories for continuous improvement" },
  ];

  return (
    <>
      {/* Guide Header */}
      <div
        className="sticky top-0 z-10 border-b border-white/8 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-2xl"
        style={{ background: 'rgba(13,13,18,0.96)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-yellow-500/20">
            <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400" />
          </div>
          <div>
            <p className="text-[11px] font-black tracking-widest uppercase text-yellow-400">How it works</p>
            <h2 className="text-base sm:text-lg font-bold text-white leading-tight">AAS Engine Guide</h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6">
          {/* Intro */}
          <div className="space-y-3">
            <p className="text-gray-300 text-[13px] sm:text-sm leading-relaxed">
              The <strong className="text-yellow-400">AAS Engine</strong> is an autonomous AI system that manages your entire music career 24/7.
              It runs daily cycles where 9 specialized AI agents work together to grow your revenue, expand your audience,
              close deals, and keep your brand alive — all while staying within budget.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Zero manual work", "AI-powered decisions", "Real budget control", "Multi-channel", "Blockchain-ready"].map((tag) => (
                <span key={tag} className="text-[10px] sm:text-[11px] px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* How it Works */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Workflow className="h-4 w-4 text-yellow-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">How It Works — 7-Phase Daily Cycle</h3>
            </div>
            <div className="space-y-1.5">
              {phases.map((p) => (
                <div key={p.num} className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center">
                    {p.num}
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-white">{p.name}</span>
                    <span className="block sm:inline text-[11px] sm:text-xs text-gray-400 sm:ml-2 leading-relaxed">{p.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 9 Agents */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bot className="h-4 w-4 text-yellow-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">9 AI Agents</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agents.map((agent) => (
                <div key={agent.name} className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <agent.icon className={`h-4 w-4 ${agent.color}`} />
                    <span className="text-sm font-semibold text-white leading-snug">{agent.name}</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed">{agent.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Goals */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-yellow-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">Daily Goals System</h3>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed mb-3">
              Every cycle generates measurable daily goals across 14 categories. The engine tracks progress in real-time and adapts strategy based on results.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "📻 Radio Outreach", "🏢 Label Deals", "📱 Social Posts", "💬 Social Engagement",
                "⛓️ Blockchain Register", "🎵 Song Tokenization", "💰 Blockchain Trade",
                "🤝 Sponsor Outreach", "🎤 Venue Booking", "🎨 Content Creation",
                "❤️ Fan Engagement", "📧 Email Campaigns", "🎶 Music Release", "👕 Merch Launch"
              ].map((cat) => (
                <span key={cat} className="text-[10px] sm:text-[11px] px-2 py-1 rounded-md bg-gray-800 text-gray-300 border border-gray-700/50">
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Integrations */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">Powered By</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                { name: "FAL AI", desc: "Images & Video" },
                { name: "Brevo", desc: "Email Marketing" },
                { name: "Polygon", desc: "Blockchain" },
                { name: "Printful", desc: "Merch Production" },
                { name: "OpenAI", desc: "Agent Intelligence" },
                { name: "Chrome Ext.", desc: "YT & IG Boost" },
                { name: "Boostify Social", desc: "Social Network" },
                { name: "4 Contact DBs", desc: "Industry Leads" },
              ].map((s) => (
                <div key={s.name} className="p-2.5 rounded-lg bg-gray-800/30 border border-gray-700/40">
                  <div className="text-[11px] sm:text-xs font-semibold text-white">{s.name}</div>
                  <div className="text-[10px] text-gray-500">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-2 pb-1">
            <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">
              AAS Engine v2.1 — Built for artists who want their career to run on autopilot.
            </p>
          </div>
        </div>
    </>
  );
}
