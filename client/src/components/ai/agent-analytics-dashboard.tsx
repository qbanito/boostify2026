// Dashboard de Analytics para AI Agents
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Zap, 
  Star, 
  Activity,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Brain,
  Music,
  Video,
  Camera,
  Megaphone,
  Share2,
  ShoppingBag,
  Briefcase,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/use-auth';

// Agent type icons mapping
const agentIcons: Record<string, any> = {
  'composer': Music,
  'video-director': Video,
  'photographer': Camera,
  'marketing': Megaphone,
  'social-media': Share2,
  'merchandise': ShoppingBag,
  'manager': Briefcase,
};

const agentColors: Record<string, string> = {
  'composer': 'from-orange-500 to-yellow-500',
  'video-director': 'from-purple-500 to-pink-500',
  'photographer': 'from-blue-500 to-cyan-500',
  'marketing': 'from-green-500 to-emerald-500',
  'social-media': 'from-pink-500 to-rose-500',
  'merchandise': 'from-amber-500 to-orange-500',
  'manager': 'from-indigo-500 to-purple-500',
};

interface AgentStat {
  agentType: string;
  totalSessions: number;
  successfulSessions: number;
  averageTokens: number;
  lastUsed: string;
  trend: number; // percentage change from last period
}

interface UsageSummary {
  totalSessions: number;
  totalTokensUsed: number;
  savedResults: number;
  favoriteAgents: string[];
  averageSessionDuration: number;
  topAgents: AgentStat[];
  weeklyActivity: number[];
}

export function AgentAnalyticsDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');

  // Fetch analytics data
  const { data: analytics, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-analytics', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/agents/analytics?range=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return response.json() as Promise<UsageSummary>;
    },
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });

  // Mock data for development/demo
  const mockData: UsageSummary = {
    totalSessions: 47,
    totalTokensUsed: 125000,
    savedResults: 12,
    favoriteAgents: ['composer', 'video-director', 'marketing'],
    averageSessionDuration: 4.5,
    topAgents: [
      { agentType: 'composer', totalSessions: 15, successfulSessions: 14, averageTokens: 2500, lastUsed: '2h ago', trend: 12 },
      { agentType: 'video-director', totalSessions: 10, successfulSessions: 9, averageTokens: 3200, lastUsed: '1d ago', trend: 8 },
      { agentType: 'marketing', totalSessions: 8, successfulSessions: 8, averageTokens: 1800, lastUsed: '3h ago', trend: -5 },
      { agentType: 'social-media', totalSessions: 7, successfulSessions: 6, averageTokens: 1500, lastUsed: '5h ago', trend: 25 },
      { agentType: 'photographer', totalSessions: 4, successfulSessions: 4, averageTokens: 2100, lastUsed: '2d ago', trend: 0 },
    ],
    weeklyActivity: [3, 5, 8, 4, 12, 9, 6],
  };

  const data = analytics || mockData;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
      }
    })
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-orange-500" />
            Agent Analytics
          </h2>
          <p className="text-gray-400 mt-1">
            Track your AI agent usage and performance
          </p>
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
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/30 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Total Sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-white">{data.totalSessions}</span>
                <Badge className="bg-green-500/10 text-green-400 border-0">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  +12%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/30 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 flex items-center gap-1">
                <Zap className="h-4 w-4" />
                Tokens Used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-white">
                  {(data.totalTokensUsed / 1000).toFixed(1)}K
                </span>
                <Badge className="bg-orange-500/10 text-orange-400 border-0">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/30 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 flex items-center gap-1">
                <Star className="h-4 w-4" />
                Saved Results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-white">{data.savedResults}</span>
                <Badge className="bg-purple-500/10 text-purple-400 border-0">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Growing
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/30 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Avg. Session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-white">{data.averageSessionDuration}m</span>
                <Badge className="bg-blue-500/10 text-blue-400 border-0">
                  <Clock className="h-3 w-3 mr-1" />
                  Efficient
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Activity Chart & Top Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <motion.div 
          custom={4} 
          variants={cardVariants} 
          initial="hidden" 
          animate="visible"
        >
          <Card className="bg-[#1C1C24] border-[#27272A] h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                Weekly Activity
              </CardTitle>
              <CardDescription className="text-gray-400">
                Sessions per day this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between h-40 gap-2">
                {data.weeklyActivity.map((value, index) => {
                  const maxValue = Math.max(...data.weeklyActivity);
                  const height = (value / maxValue) * 100;
                  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                  const isToday = index === new Date().getDay() - 1;
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <motion.div
                        className={cn(
                          "w-full rounded-t-lg",
                          isToday ? "bg-gradient-to-t from-orange-500 to-orange-400" : "bg-gradient-to-t from-[#27272A] to-[#3F3F46]"
                        )}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      />
                      <span className={cn(
                        "text-xs",
                        isToday ? "text-orange-500 font-medium" : "text-gray-500"
                      )}>
                        {days[index]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Agents */}
        <motion.div 
          custom={5} 
          variants={cardVariants} 
          initial="hidden" 
          animate="visible"
        >
          <Card className="bg-[#1C1C24] border-[#27272A] h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-orange-500" />
                Top Agents
              </CardTitle>
              <CardDescription className="text-gray-400">
                Your most used agents this period
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.topAgents.slice(0, 5).map((agent, index) => {
                const Icon = agentIcons[agent.agentType] || Brain;
                const color = agentColors[agent.agentType] || 'from-gray-500 to-gray-600';
                const successRate = Math.round((agent.successfulSessions / agent.totalSessions) * 100);
                
                return (
                  <motion.div 
                    key={agent.agentType}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className={cn("p-2 rounded-lg bg-gradient-to-br shrink-0", color)}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white capitalize">
                          {agent.agentType.replace('-', ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {agent.totalSessions} sessions
                          </span>
                          {agent.trend > 0 ? (
                            <ArrowUpRight className="h-3 w-3 text-green-400" />
                          ) : agent.trend < 0 ? (
                            <ArrowDownRight className="h-3 w-3 text-red-400" />
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={successRate} className="h-1.5 flex-1" />
                        <span className="text-xs text-gray-500">{successRate}%</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Favorite Agents Quick Access */}
      <motion.div 
        custom={6} 
        variants={cardVariants} 
        initial="hidden" 
        animate="visible"
      >
        <Card className="bg-[#1C1C24] border-[#27272A]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              Your Favorite Agents
            </CardTitle>
            <CardDescription className="text-gray-400">
              Quick access to your most loved agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {data.favoriteAgents.map((agentType) => {
                const Icon = agentIcons[agentType] || Brain;
                const color = agentColors[agentType] || 'from-gray-500 to-gray-600';
                
                return (
                  <motion.div
                    key={agentType}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="outline"
                      className="border-[#27272A] hover:border-orange-500/50 bg-[#0F0F13] gap-2"
                    >
                      <div className={cn("p-1.5 rounded-md bg-gradient-to-br", color)}>
                        <Icon className="h-3 w-3 text-white" />
                      </div>
                      <span className="capitalize">{agentType.replace('-', ' ')}</span>
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default AgentAnalyticsDashboard;
