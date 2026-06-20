/**
 * XP Profile - Sistema de Reputación / XP
 * 
 * "Gana XP por cada acción y sube de nivel"
 * 
 * Shows user's XP level, progress bar, badges, streak,
 * and global leaderboard.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, Star, Crown, Zap, TrendingUp, Medal, ChevronDown, ChevronUp } from 'lucide-react';

interface XPProfile {
  userId: number;
  totalXP: number;
  level: string;
  levelEmoji: string;
  levelName: string;
  currentLevelXP: number;
  nextLevelXP: number;
  progress: number;
  currentStreak: number;
  longestStreak: number;
  canInfluenceBudgets: boolean;
  rank: number;
}

interface LeaderboardEntry {
  userId: number;
  username: string;
  totalXP: number;
  level: string;
  currentStreak: number;
  rank: number;
}

const levelStyles: Record<string, { bg: string; text: string; glow: string }> = {
  listener: { bg: 'from-gray-500/20 to-gray-600/20', text: 'text-gray-300', glow: 'shadow-gray-500/20' },
  fan: { bg: 'from-blue-500/20 to-blue-600/20', text: 'text-blue-300', glow: 'shadow-blue-500/20' },
  tastemaker: { bg: 'from-orange-500/20 to-red-500/20', text: 'text-orange-300', glow: 'shadow-orange-500/20' },
  curator: { bg: 'from-purple-500/20 to-violet-500/20', text: 'text-purple-300', glow: 'shadow-purple-500/20' },
  mogul: { bg: 'from-yellow-500/20 to-amber-500/20', text: 'text-yellow-300', glow: 'shadow-yellow-500/20' },
};

const levelEmojis: Record<string, string> = {
  listener: '🎧',
  fan: '⭐',
  tastemaker: '🔥',
  curator: '💎',
  mogul: '👑',
};

interface XPProfileProps {
  userId?: number;
}

export function XPProfileWidget({ userId }: XPProfileProps) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const { data: profile, isLoading } = useQuery<XPProfile>({
    queryKey: ['/api/ai-social/xp/profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await apiRequest('GET', `/api/ai-social/xp/profile/${userId}`);
      const json = await res.json();
      return json.data;
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/ai-social/xp/leaderboard'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/ai-social/xp/leaderboard?limit=10');
      const json = await res.json();
      return json.data || [];
    },
    enabled: showLeaderboard,
  });

  if (!userId) return null;

  if (isLoading) {
    return <div className="h-24 bg-white/5 rounded-xl animate-pulse" />;
  }

  if (!profile) {
    return (
      <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardContent className="p-4 text-center">
          <Star className="h-6 w-6 text-blue-400 mx-auto mb-2" />
          <p className="text-white/70 text-sm">¡Empieza a ganar XP!</p>
          <p className="text-[10px] text-white/40 mt-1">Comenta, vota, descubre música - cada acción suma</p>
        </CardContent>
      </Card>
    );
  }

  const style = levelStyles[profile.level] || levelStyles.listener;
  const emoji = levelEmojis[profile.level] || '🎧';

  return (
    <div className="space-y-3">
      {/* Main XP Card */}
      <Card className={cn(`bg-gradient-to-br ${style.bg} border-white/10`, style.glow)}>
        <CardContent className="p-4">
          {/* Level & XP */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <motion.span 
                className="text-2xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {emoji}
              </motion.span>
              <div>
                <h4 className={cn("font-bold text-sm", style.text)}>
                  {profile.levelName || profile.level.charAt(0).toUpperCase() + profile.level.slice(1)}
                </h4>
                <p className="text-[10px] text-white/40">
                  {profile.totalXP.toLocaleString()} XP total
                </p>
              </div>
            </div>
            <div className="text-right">
              {profile.rank > 0 && (
                <Badge className="bg-white/10 text-white/60 text-[10px]">
                  <Medal className="h-3 w-3 mr-0.5" />
                  #{profile.rank}
                </Badge>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-[9px] text-white/30 mb-1">
              <span>{profile.currentLevelXP} XP</span>
              <span>{profile.nextLevelXP} XP</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", 
                  profile.level === 'mogul' ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                  profile.level === 'curator' ? 'bg-gradient-to-r from-purple-400 to-violet-500' :
                  profile.level === 'tastemaker' ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                  profile.level === 'fan' ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                  'bg-gradient-to-r from-gray-400 to-gray-500'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(profile.progress, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[9px] text-white/30 text-center mt-1">
              {Math.round(profile.progress)}% hacia el siguiente nivel
            </p>
          </div>

          {/* Streak & Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {profile.currentStreak > 0 && (
                <div className="flex items-center gap-1">
                  <Flame className={cn("h-4 w-4", profile.currentStreak >= 7 ? "text-orange-400" : "text-orange-300/60")} />
                  <span className="text-xs font-bold text-white">{profile.currentStreak}</span>
                  <span className="text-[9px] text-white/30">días</span>
                </div>
              )}
              {profile.canInfluenceBudgets && (
                <Badge className="bg-yellow-500/15 text-yellow-300 text-[9px] border-yellow-500/20">
                  <Crown className="h-2.5 w-2.5 mr-0.5" />
                  Influencer
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[9px] text-white/40 hover:text-white"
              onClick={() => setShowLeaderboard(!showLeaderboard)}
            >
              <Trophy className="h-3 w-3 mr-1" />
              Ranking
              {showLeaderboard ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-2">
                  <Trophy className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="text-xs font-bold text-white">Top Boostifiers</span>
                </div>
                <div className="space-y-1.5">
                  {leaderboard?.map((entry, i) => {
                    const isMe = entry.userId === userId;
                    const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                    return (
                      <motion.div
                        key={entry.userId}
                        className={cn(
                          "flex items-center gap-2 rounded-lg p-1.5 text-xs",
                          isMe ? "bg-purple-500/15 ring-1 ring-purple-500/30" : "bg-white/5"
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <span className="w-5 text-center text-white/40 text-[10px]">
                          {medalEmoji || `#${entry.rank}`}
                        </span>
                        <span className="text-sm">{levelEmojis[entry.level] || '🎧'}</span>
                        <span className={cn("flex-1 truncate", isMe ? "text-purple-300 font-bold" : "text-white/70")}>
                          {entry.username || `User ${entry.userId}`}
                          {isMe && ' (tú)'}
                        </span>
                        <span className="text-[10px] text-white/40">{entry.totalXP.toLocaleString()} XP</span>
                        {entry.currentStreak > 0 && (
                          <span className="flex items-center gap-0.5 text-[9px] text-orange-400">
                            <Flame className="h-2.5 w-2.5" />{entry.currentStreak}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                  {(!leaderboard || leaderboard.length === 0) && (
                    <p className="text-[10px] text-white/30 text-center py-2">Aún no hay datos</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
