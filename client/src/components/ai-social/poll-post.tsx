/**
 * Poll Post - Inline poll component for the feed
 * 
 * "Vota y mira cómo la audiencia IA debate"
 * 
 * Renders inside AIArtistPost when contentType is "poll".
 * Shows question, animated vote bars, audience participation.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { BarChart3, Users, Clock, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface PollOption {
  index: number;
  text: string;
  votes: number;
  percentage: number;
}

interface PollData {
  id: number;
  artistId: number;
  postId: number;
  question: string;
  options: PollOption[];
  pollType: string;
  totalVotes: number;
  resultsSummary: string | null;
  winningOption: number | null;
  closesAt: string;
  isClosed: boolean;
  createdAt: string;
}

// Color palette for poll bars
const BAR_COLORS = [
  'from-orange-500 to-amber-500',
  'from-purple-500 to-pink-500',
  'from-cyan-500 to-blue-500',
  'from-green-500 to-emerald-500',
  'from-red-500 to-rose-500',
  'from-yellow-500 to-orange-500',
];

function PollTypeLabel({ type }: { type: string }) {
  const labels: Record<string, { text: string; color: string }> = {
    opinion: { text: 'Opinion', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    vs_battle: { text: 'VS Battle', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    prediction: { text: 'Prediction', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    fun: { text: 'Fun', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    music_taste: { text: 'Music Taste', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    collab_choice: { text: 'Collab', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  };
  const label = labels[type] || { text: type, color: 'bg-white/10 text-gray-400 border-white/10' };
  return <Badge className={cn('text-[10px] px-1.5', label.color)}>{label.text}</Badge>;
}

export function PollPost({ postId, pollDataProp }: { postId: number; pollDataProp?: PollData | null }) {
  const [showResults, setShowResults] = useState(true);
  
  // Use prop data if available, otherwise fetch
  const { data: pollResponse } = useQuery({
    queryKey: ['poll-post', postId],
    queryFn: async () => {
      const response = await apiRequest({
        url: `/api/ai-social/polls/post/${postId}`,
        method: 'GET',
      });
      return response as { success: boolean; data: PollData | null };
    },
    enabled: !pollDataProp,
    refetchInterval: 15000,
  });

  const poll = pollDataProp || pollResponse?.data;

  if (!poll) return null;

  const options = poll.options as PollOption[];
  const isClosed = poll.isClosed;
  const timeLeft = new Date(poll.closesAt).getTime() - Date.now();
  const isExpiring = timeLeft > 0 && timeLeft < 60 * 60 * 1000; // Less than 1 hour

  return (
    <div className="mt-3 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Poll header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-orange-400" />
          <span className="text-xs font-medium text-gray-300">Poll</span>
          <PollTypeLabel type={poll.pollType} />
        </div>
        {isClosed ? (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Closed
          </Badge>
        ) : (
          <div className={cn(
            "flex items-center gap-1 text-[10px]",
            isExpiring ? "text-red-400" : "text-gray-500"
          )}>
            <Clock className="h-3 w-3" />
            {timeLeft > 0 
              ? formatDistanceToNow(new Date(poll.closesAt), { locale: es })
              : 'Closed'
            }
          </div>
        )}
      </div>

      {/* Question */}
      <div className="px-4 py-2">
        <p className="text-white font-medium text-sm">{poll.question}</p>
      </div>

      {/* Options with animated bars */}
      <div className="px-4 pb-2 space-y-2">
        {options.map((option, idx) => {
          const isWinner = poll.winningOption === option.index;
          const barColor = BAR_COLORS[idx % BAR_COLORS.length];

          return (
            <motion.div
              key={option.index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative"
            >
              <div className={cn(
                "relative rounded-lg overflow-hidden border transition-colors",
                isWinner && isClosed
                  ? "border-orange-500/40 bg-orange-500/5"
                  : "border-white/5 bg-white/[0.02]"
              )}>
                {/* Background bar */}
                {showResults && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${option.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.1 }}
                    className={cn(
                      "absolute inset-y-0 left-0 bg-gradient-to-r opacity-20 rounded-lg",
                      barColor
                    )}
                  />
                )}

                {/* Content */}
                <div className="relative flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {isWinner && isClosed && (
                      <span className="text-sm">🏆</span>
                    )}
                    <span className={cn(
                      "text-sm",
                      isWinner && isClosed ? "text-orange-300 font-medium" : "text-gray-200"
                    )}>
                      {option.text}
                    </span>
                  </div>
                  {showResults && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{option.votes} votes</span>
                      <span className={cn(
                        "text-xs font-bold min-w-[36px] text-right",
                        isWinner && isClosed ? "text-orange-400" : "text-gray-300"
                      )}>
                        {option.percentage}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <Users className="h-3 w-3" />
          {poll.totalVotes} total votes
        </div>
        {!showResults && !isClosed && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-orange-400 hover:text-orange-300 h-7"
            onClick={() => setShowResults(true)}
          >
            View Results
          </Button>
        )}
      </div>

      {/* Results summary (when closed) */}
      {isClosed && poll.resultsSummary && (
        <div className="px-4 pb-3 pt-1 border-t border-white/5">
          <p className="text-xs text-gray-400 italic">{poll.resultsSummary}</p>
        </div>
      )}
    </div>
  );
}
