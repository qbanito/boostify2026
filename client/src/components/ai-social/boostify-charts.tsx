/**
 * Boostify Charts - Billboard-style Weekly Rankings
 * 
 * "El chart semanal más hot del universo musical IA"
 * 
 * Animated weekly chart with position changes, fire emojis for risers,
 * and AI-generated weekly summaries.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Loader2,
  BarChart3,
  Flame,
  Star,
  ChevronUp,
  ChevronDown,
  RefreshCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Generate deterministic avatar for artists without cover images
function getArtistAvatar(artistId: number, coverUrl?: string): string {
  if (coverUrl) return coverUrl;
  const gender = artistId % 2 === 0 ? 'women' : 'men';
  const index = (artistId * 7 + 13) % 80;
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
}

interface ChartRanking {
  position: number;
  artistId: number;
  artistName: string;
  songTitle?: string;
  coverUrl?: string;
  score: number;
  plays: number;
  likes: number;
  comments: number;
  previousPosition: number | null;
  change: 'up' | 'down' | 'same' | 'new';
}

interface ChartData {
  id: number;
  weekNumber: number;
  year: number;
  chartType: string;
  rankings: ChartRanking[];
  weekSummary: string;
  biggestMover: string | null;
  calculatedAt: string;
}

function PositionChange({ change, previous, current }: { change: string; previous: number | null; current: number }) {
  if (change === 'new') {
    return (
      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] px-1.5">
        NEW
      </Badge>
    );
  }
  if (change === 'up' && previous !== null) {
    const diff = previous - current;
    return (
      <div className="flex items-center gap-0.5 text-green-400">
        <ChevronUp className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">+{diff}</span>
      </div>
    );
  }
  if (change === 'down' && previous !== null) {
    const diff = current - previous;
    return (
      <div className="flex items-center gap-0.5 text-red-400">
        <ChevronDown className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">-{diff}</span>
      </div>
    );
  }
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-black font-black text-sm shadow-lg shadow-yellow-500/30">
        1
      </div>
    );
  }
  if (position === 2) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-black font-black text-sm">
        2
      </div>
    );
  }
  if (position === 3) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-700 flex items-center justify-center text-white font-black text-sm">
        3
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300 font-bold text-sm">
      {position}
    </div>
  );
}

export function BoostifyCharts() {
  const { data: chartResponse, isLoading, refetch } = useQuery({
    queryKey: ['boostify-charts'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/ai-social/charts/current',
        method: 'GET',
      });
      return response as { success: boolean; data: ChartData | null };
    },
    refetchInterval: 120000, // 2 minutes
  });

  const chart = chartResponse?.data;

  if (isLoading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading chart...</p>
        </CardContent>
      </Card>
    );
  }

  if (!chart || !chart.rankings || chart.rankings.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-orange-950/40 via-purple-950/30 to-indigo-950/40 border-orange-500/20">
        <CardContent className="py-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 text-orange-500/50" />
          <h3 className="text-gray-300 font-medium mb-2">Weekly Chart</h3>
          <p className="text-gray-500 text-sm mb-4">Rankings are calculated automatically every hour</p>
          <Button 
            variant="outline" 
            size="sm"
            className="border-orange-500/30 text-orange-400"
            onClick={() => {
              apiRequest({ url: '/api/ai-social/charts/calculate', method: 'POST' })
                .then(() => refetch());
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Calculate now
          </Button>
        </CardContent>
      </Card>
    );
  }

  const rankings = chart.rankings as ChartRanking[];

  return (
    <Card className="bg-gradient-to-br from-orange-950/40 via-purple-950/30 to-indigo-950/40 border-orange-500/20 overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-yellow-400" />
              Boostify Charts
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">
                Week {chart.weekNumber}
              </Badge>
            </CardTitle>
            <CardDescription className="text-gray-400 text-xs mt-1">
              Top artists of the week
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-white"
            onClick={() => refetch()}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* AI Summary */}
      {chart.weekSummary && (
        <div className="px-6 pb-3">
          <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 rounded-lg p-3 border border-orange-500/10">
            <p className="text-sm text-gray-200 italic leading-relaxed">
              {chart.weekSummary}
            </p>
          </div>
        </div>
      )}

      {/* Rankings */}
      <CardContent className="pt-0">
        <div className="space-y-1">
          <AnimatePresence>
            {rankings.map((entry, idx) => (
              <motion.div
                key={entry.artistId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "flex items-center gap-3 py-2 px-2 rounded-lg transition-colors hover:bg-white/5",
                  entry.position <= 3 && "bg-white/[0.03]"
                )}
              >
                {/* Position */}
                <PositionBadge position={entry.position} />

                {/* Change indicator */}
                <div className="w-10 flex justify-center">
                  <PositionChange 
                    change={entry.change} 
                    previous={entry.previousPosition} 
                    current={entry.position} 
                  />
                </div>

                {/* Artist avatar */}
                <Avatar className="h-9 w-9 border border-white/10">
                  <AvatarImage src={getArtistAvatar(entry.artistId, entry.coverUrl)} />
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-purple-500 text-white text-xs font-bold">
                    {entry.artistName?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>

                {/* Artist name */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium text-sm truncate",
                    entry.position === 1 ? "text-yellow-300" : "text-white"
                  )}>
                    {entry.artistName}
                    {entry.change === 'up' && entry.previousPosition && (entry.previousPosition - entry.position) >= 3 && (
                      <span className="ml-1">🔥</span>
                    )}
                    {entry.position === 1 && <span className="ml-1">👑</span>}
                  </p>
                  {entry.songTitle && (
                    <p className="text-[11px] text-gray-500 truncate">{entry.songTitle}</p>
                  )}
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className="text-xs font-bold text-orange-400">{entry.score}</p>
                  <p className="text-[10px] text-gray-500">pts</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Biggest Mover */}
        {chart.biggestMover && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span className="font-medium text-orange-300">Mayor salto:</span>
              <span>{chart.biggestMover}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
