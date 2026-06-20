/**
 * Tip Button — Send BTF tips to artists on their posts
 * Shows tip button, quick amounts, and tip animation
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { 
  Coins, 
  Flame, 
  Heart, 
  Sparkles,
  ChevronDown,
  Check,
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface TipButtonProps {
  postId: number;
  artistId: number;
  artistName: string;
  compact?: boolean;
}

interface TipData {
  tip: {
    id: number;
    amount: string;
    tokenType: string;
    message: string | null;
    isAiTip: boolean;
    createdAt: string;
  };
  tipper: {
    id: number;
    name: string;
    imageUrl: string | null;
  } | null;
}

const TIP_AMOUNTS = [1, 5, 10, 25, 50];

export function TipButton({ postId, artistId, artistName, compact = false }: TipButtonProps) {
  const [showTipPanel, setShowTipPanel] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [tipSent, setTipSent] = useState(false);
  const [totalTips, setTotalTips] = useState(0);
  const queryClient = useQueryClient();

  // Fetch tips for this post
  const { data: tipData } = useQuery({
    queryKey: [`/api/ai-social/tips/post/${postId}`],
    queryFn: async () => {
      const res = await fetch(`/api/ai-social/tips/post/${postId}`);
      const json = await res.json();
      if (json.success) {
        setTotalTips(parseFloat(json.data.totalAmount || '0'));
      }
      return json.data;
    },
    enabled: showTipPanel,
  });

  const tipMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch('/api/ai-social/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toArtistId: artistId,
          amount,
          tokenType: 'btf',
          postId,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setTipSent(true);
        setTotalTips(prev => prev + (selectedAmount || 0));
        queryClient.invalidateQueries({ queryKey: [`/api/ai-social/tips/post/${postId}`] });
        setTimeout(() => {
          setTipSent(false);
          setShowTipPanel(false);
          setSelectedAmount(null);
        }, 2000);
      }
    },
  });

  const handleSendTip = () => {
    if (selectedAmount && selectedAmount > 0) {
      tipMutation.mutate(selectedAmount);
    }
  };

  if (compact) {
    return (
      <button
        onClick={() => setShowTipPanel(!showTipPanel)}
        className={cn(
          "flex items-center gap-1.5 text-xs transition-all duration-200",
          totalTips > 0 
            ? "text-yellow-400 hover:text-yellow-300" 
            : "text-gray-400 hover:text-yellow-400"
        )}
      >
        <Coins className="h-3.5 w-3.5" />
        {totalTips > 0 ? (
          <span className="font-semibold">{totalTips.toFixed(0)} BTF</span>
        ) : (
          <span>Tip</span>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Main tip button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowTipPanel(!showTipPanel)}
        className={cn(
          "gap-1.5 transition-all duration-200",
          showTipPanel && "bg-yellow-500/20 text-yellow-400",
          totalTips > 0 && !showTipPanel && "text-yellow-400"
        )}
      >
        <Coins className="h-4 w-4" />
        {totalTips > 0 ? (
          <span className="text-xs font-semibold">{totalTips.toFixed(0)} BTF</span>
        ) : (
          <span className="text-xs">Tip</span>
        )}
      </Button>

      {/* Tip panel dropdown */}
      {showTipPanel && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900/95 border border-orange-500/30 rounded-xl p-3 shadow-2xl backdrop-blur-sm z-50">
          {tipSent ? (
            // Success state
            <div className="text-center py-3">
              <div className="flex items-center justify-center gap-2 text-green-400 mb-1">
                <Check className="h-5 w-5" />
                <span className="font-bold">Tip Sent!</span>
              </div>
              <p className="text-xs text-gray-400">
                {selectedAmount} BTF sent to {artistName}
              </p>
              <Sparkles className="h-4 w-4 text-yellow-400 mx-auto mt-2 animate-pulse" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-bold text-white">Tip {artistName}</span>
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {TIP_AMOUNTS.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setSelectedAmount(amount)}
                    className={cn(
                      "py-1.5 rounded-lg text-xs font-bold transition-all duration-150",
                      selectedAmount === amount
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                    )}
                  >
                    {amount}
                  </button>
                ))}
              </div>

              {/* Send button */}
              <Button
                size="sm"
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold"
                disabled={!selectedAmount || tipMutation.isPending}
                onClick={handleSendTip}
              >
                {tipMutation.isPending ? (
                  <span className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 animate-pulse" /> Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5" />
                    Send {selectedAmount || '...'} BTF
                  </span>
                )}
              </Button>

              {/* Recent tips on this post */}
              {tipData?.tips && tipData.tips.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="text-[10px] text-gray-500 mb-1">Recent tips</div>
                  {tipData.tips.slice(0, 3).map((t: TipData) => (
                    <div key={t.tip.id} className="flex items-center gap-1.5 text-[10px] text-gray-400 py-0.5">
                      <span className={t.tip.isAiTip ? 'text-purple-400' : 'text-blue-400'}>
                        {t.tipper?.name || 'Anonymous'}
                      </span>
                      <span>→</span>
                      <span className="text-yellow-400 font-semibold">{parseFloat(t.tip.amount).toFixed(0)} BTF</span>
                      {t.tip.isAiTip && (
                        <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded">AI</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-[10px] text-gray-500 mt-2 text-center">
                2% platform fee • Powered by BTF
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tip Leaderboard Widget — Shows top tipped artists
 */
export function TipLeaderboard() {
  const { data: leaderboard } = useQuery({
    queryKey: ['/api/ai-social/tips/leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/ai-social/tips/leaderboard?limit=5');
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 60000, // Every minute
  });

  if (!leaderboard || leaderboard.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-2">
        <Flame className="h-4 w-4 text-orange-400" />
        <span className="text-sm font-bold text-white">Top Tipped</span>
      </div>

      {leaderboard.map((entry: any, idx: number) => (
        <div key={entry.artistId} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded transition-colors">
          <span className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
            idx === 0 && "bg-yellow-500 text-black",
            idx === 1 && "bg-gray-300 text-black",
            idx === 2 && "bg-orange-600 text-white",
            idx > 2 && "bg-white/10 text-gray-400"
          )}>
            {idx + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {entry.artist?.name || 'Unknown'}
            </div>
            <div className="text-[10px] text-gray-400">
              {entry.uniqueTippers} tippers
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs font-bold text-yellow-400">
              {parseFloat(entry.totalReceived).toFixed(0)} BTF
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
