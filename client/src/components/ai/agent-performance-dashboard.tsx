import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  Briefcase,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  Megaphone,
  Music,
  RefreshCw,
  Share2,
  ShoppingBag,
  Star,
  TrendingUp,
  Video,
  XCircle,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/use-auth';

// ---------- types ----------

interface AgentPerf {
  agentType: string;
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  successRate: number;
  totalTokens: number;
  avgTokens: number;
  totalCost: number;
  avgResponseTimeSec: number;
  avgRating: number;
  ratedSessions: number;
  lastUsed: string | null;
}

interface DailyTrend {
  day: string;
  total: number;
  completed: number;
  failed: number;
  tokens: number;
}

interface RecentError {
  id: number;
  agentType: string;
  sessionName: string | null;
  createdAt: string;
  error: string;
}

interface PerformanceData {
  agents: AgentPerf[];
  dailyTrend: DailyTrend[];
  recentErrors: RecentError[];
  summary: {
    totalSessions: number;
    completedSessions: number;
    failedSessions: number;
    overallSuccessRate: number;
    totalTokens: number;
    totalCost: number;
    avgCostPerSession: number;
  };
}

// ---------- constants ----------

const agentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  composer: Music,
  'video-director': Video,
  photographer: Camera,
  marketing: Megaphone,
  'social-media': Share2,
  merchandise: ShoppingBag,
  manager: Briefcase,
};

const agentColors: Record<string, string> = {
  composer: 'from-orange-500 to-yellow-500',
  'video-director': 'from-purple-500 to-pink-500',
  photographer: 'from-blue-500 to-cyan-500',
  marketing: 'from-green-500 to-emerald-500',
  'social-media': 'from-pink-500 to-rose-500',
  merchandise: 'from-amber-500 to-orange-500',
  manager: 'from-indigo-500 to-purple-500',
};

const agentLabels: Record<string, string> = {
  composer: 'Composer',
  'video-director': 'Video Director',
  photographer: 'Photographer',
  marketing: 'Marketing',
  'social-media': 'Social Media',
  merchandise: 'Merchandise',
  manager: 'Manager',
};

// ---------- helpers ----------

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function rateColor(rate: number): string {
  if (rate >= 90) return 'text-green-400';
  if (rate >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

function rateBadge(rate: number): string {
  if (rate >= 90) return 'bg-green-500/10 text-green-400 border-0';
  if (rate >= 70) return 'bg-yellow-500/10 text-yellow-400 border-0';
  return 'bg-red-500/10 text-red-400 border-0';
}

// ---------- component ----------

export function AgentPerformanceDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');

  const { data, isLoading, refetch } = useQuery<PerformanceData>({
    queryKey: ['agent-performance', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/agents/performance?range=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch performance');
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 120_000,
  });

  const cardAnim = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.4 },
    }),
  };

  const perf = data ?? {
    agents: [],
    dailyTrend: [],
    recentErrors: [],
    summary: {
      totalSessions: 0,
      completedSessions: 0,
      failedSessions: 0,
      overallSuccessRate: 0,
      totalTokens: 0,
      totalCost: 0,
      avgCostPerSession: 0,
    },
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-orange-500" />
            Agent Performance
          </h2>
          <p className="text-gray-400 mt-1">Success rates, response times &amp; cost breakdown</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <TabsList className="bg-[#1C1C24] border border-[#27272A]">
              <TabsTrigger value="week" className="text-sm">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-sm">Month</TabsTrigger>
              <TabsTrigger value="all" className="text-sm">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="border-[#27272A] hover:bg-[#27272A]"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Success Rate */}
        <motion.div custom={0} variants={cardAnim} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/30 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Success Rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className={cn('text-3xl font-bold', rateColor(perf.summary.overallSuccessRate))}>
                  {perf.summary.overallSuccessRate}%
                </span>
                <Badge className={rateBadge(perf.summary.overallSuccessRate)}>
                  {perf.summary.completedSessions}/{perf.summary.totalSessions}
                </Badge>
              </div>
              <Progress
                value={perf.summary.overallSuccessRate}
                className="mt-3 h-1.5"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Sessions */}
        <motion.div custom={1} variants={cardAnim} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/30 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                Total Sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-white">{perf.summary.totalSessions}</span>
                {perf.summary.failedSessions > 0 && (
                  <Badge className="bg-red-500/10 text-red-400 border-0">
                    <XCircle className="h-3 w-3 mr-1" />
                    {perf.summary.failedSessions} failed
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tokens Used */}
        <motion.div custom={2} variants={cardAnim} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/30 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 flex items-center gap-1">
                <Zap className="h-4 w-4" />
                Tokens Consumed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-white">
                  {perf.summary.totalTokens > 1000
                    ? `${(perf.summary.totalTokens / 1000).toFixed(1)}K`
                    : perf.summary.totalTokens}
                </span>
                <Badge className="bg-orange-500/10 text-orange-400 border-0">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cost */}
        <motion.div custom={3} variants={cardAnim} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/30 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Total Cost
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-white">{formatCost(perf.summary.totalCost)}</span>
                <Badge className="bg-blue-500/10 text-blue-400 border-0">
                  ~{formatCost(perf.summary.avgCostPerSession)}/session
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Per-Agent Performance Table + Daily Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Per-agent cards — spans 2 cols */}
        <motion.div
          custom={4}
          variants={cardAnim}
          initial="hidden"
          animate="visible"
          className="xl:col-span-2"
        >
          <Card className="bg-[#1C1C24] border-[#27272A] h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-orange-500" />
                Per-Agent Performance
              </CardTitle>
              <CardDescription className="text-gray-400">
                Success rate, avg response time &amp; tokens per agent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {perf.agents.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">
                  No agent sessions found for this period. Start using agents to see performance data.
                </p>
              ) : (
                perf.agents
                  .sort((a, b) => b.totalSessions - a.totalSessions)
                  .map((agent, idx) => {
                    const Icon = agentIcons[agent.agentType] || Brain;
                    const color = agentColors[agent.agentType] || 'from-gray-500 to-gray-600';
                    const label = agentLabels[agent.agentType] || agent.agentType;

                    return (
                      <motion.div
                        key={agent.agentType}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + idx * 0.07 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-[#0F0F13] hover:bg-[#15151B] transition-colors"
                      >
                        {/* Icon */}
                        <div className={cn('p-2 rounded-lg bg-gradient-to-br shrink-0', color)}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>

                        {/* Name & sessions */}
                        <div className="min-w-[100px]">
                          <p className="text-sm font-medium text-white">{label}</p>
                          <p className="text-xs text-gray-500">{agent.totalSessions} sessions</p>
                        </div>

                        {/* Success rate bar */}
                        <div className="flex-1 min-w-[80px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">Success</span>
                            <span className={cn('text-xs font-medium', rateColor(agent.successRate))}>
                              {agent.successRate}%
                            </span>
                          </div>
                          <Progress value={agent.successRate} className="h-1.5" />
                        </div>

                        {/* Avg response time */}
                        <div className="hidden sm:flex flex-col items-center min-w-[60px]">
                          <Clock className="h-3 w-3 text-gray-500 mb-0.5" />
                          <span className="text-xs text-gray-300">{formatDuration(agent.avgResponseTimeSec)}</span>
                        </div>

                        {/* Avg tokens */}
                        <div className="hidden md:flex flex-col items-center min-w-[60px]">
                          <Zap className="h-3 w-3 text-gray-500 mb-0.5" />
                          <span className="text-xs text-gray-300">{agent.avgTokens.toLocaleString()}</span>
                        </div>

                        {/* Cost */}
                        <div className="hidden lg:flex flex-col items-center min-w-[50px]">
                          <DollarSign className="h-3 w-3 text-gray-500 mb-0.5" />
                          <span className="text-xs text-gray-300">{formatCost(agent.totalCost)}</span>
                        </div>

                        {/* Rating */}
                        {agent.ratedSessions > 0 && (
                          <div className="hidden lg:flex items-center gap-0.5">
                            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-xs text-yellow-400">{agent.avgRating}</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Daily Trend Chart */}
        <motion.div custom={5} variants={cardAnim} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A] h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                Daily Trend
              </CardTitle>
              <CardDescription className="text-gray-400">Sessions over the last 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              {perf.dailyTrend.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No trend data yet.</p>
              ) : (
                <div className="flex items-end justify-between h-44 gap-1">
                  {perf.dailyTrend.map((d, i) => {
                    const max = Math.max(...perf.dailyTrend.map((x) => x.total), 1);
                    const h = (d.total / max) * 100;
                    const failH = d.total > 0 ? (d.failed / d.total) * h : 0;
                    const successH = h - failH;
                    const dateStr = new Date(d.day).toLocaleDateString('en', { month: 'short', day: 'numeric' });
                    const isLast = i === perf.dailyTrend.length - 1;

                    return (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                        {/* Tooltip */}
                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0F0F13] border border-[#27272A] rounded px-2 py-1 text-[10px] text-gray-300 whitespace-nowrap z-10 pointer-events-none">
                          {d.total} sessions · {d.completed} ok · {d.failed} fail
                        </div>
                        <div className="w-full flex flex-col" style={{ height: `${Math.max(h, 4)}%` }}>
                          {failH > 0 && (
                            <motion.div
                              className="w-full rounded-t bg-red-500/60"
                              initial={{ height: 0 }}
                              animate={{ height: `${(failH / h) * 100}%` }}
                              transition={{ duration: 0.4, delay: i * 0.04 }}
                            />
                          )}
                          <motion.div
                            className={cn(
                              'w-full flex-1',
                              failH === 0 ? 'rounded-t-lg' : '',
                              isLast
                                ? 'bg-gradient-to-t from-orange-500 to-orange-400'
                                : 'bg-gradient-to-t from-[#27272A] to-[#3F3F46]'
                            )}
                            initial={{ height: 0 }}
                            animate={{ height: `${(successH / h) * 100}%` }}
                            transition={{ duration: 0.4, delay: i * 0.04 }}
                          />
                        </div>
                        <span
                          className={cn(
                            'text-[9px]',
                            isLast ? 'text-orange-500 font-medium' : 'text-gray-600'
                          )}
                        >
                          {dateStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 justify-center">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#3F3F46]" />
                  <span className="text-[10px] text-gray-500">Completed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm bg-red-500/60" />
                  <span className="text-[10px] text-gray-500">Failed</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Errors */}
      {perf.recentErrors.length > 0 && (
        <motion.div custom={6} variants={cardAnim} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                Recent Errors
              </CardTitle>
              <CardDescription className="text-gray-400">
                Last failed agent sessions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {perf.recentErrors.map((err) => {
                const Icon = agentIcons[err.agentType] || Brain;
                return (
                  <div
                    key={err.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10"
                  >
                    <Icon className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white capitalize">
                          {agentLabels[err.agentType] || err.agentType}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {err.createdAt ? new Date(err.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{err.error}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

export default AgentPerformanceDashboard;
