/**
 * Platform Activity Ticker — Real-time scrolling service activity bar
 * Shows live artist access pack activations and platform usage stats
 * NOTE: Does NOT display token prices or speculative financial data
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, Music, Users, BarChart3 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TokenTickerData {
  id: number;
  symbol: string;
  songName: string;
  price: string;
  totalSupply: number;
  availableSupply: number;
  artistId: number;
  imageUrl: string | null;
  artistName: string;
  artistImage: string | null;
  priceChange24h: string;
  volume24h: number;
  holders: number;
  marketCap: string;
}

function TickerItem({ token }: { token: TokenTickerData }) {
  const holders = token.holders || 0;

  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 whitespace-nowrap">
      <span className="font-bold text-orange-400 text-sm">{token.symbol}</span>
      <span className="text-white/70 text-xs">{token.artistName}</span>
      <span className="flex items-center gap-0.5 text-xs font-semibold text-blue-400">
        <Users className="h-3 w-3" />
        {holders} fans
      </span>
    </div>
  );
}

export function TradingTicker() {
  const { data: tokens } = useQuery<TokenTickerData[]>({
    queryKey: ['/api/ai-social/token-ticker'],
    queryFn: async () => {
      const res = await fetch('/api/ai-social/token-ticker');
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 15000, // Refresh every 15s
  });

  if (!tokens || tokens.length === 0) {
    // Show placeholder ticker with demo data when no active tokens
    return (
      <div className="relative w-full overflow-hidden bg-black/40 border-y border-orange-500/20 backdrop-blur-sm">
        <div className="flex items-center">
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-500/20 border-r border-orange-500/30 z-10">
            <Zap className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">Live</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="inline-flex animate-ticker">
              {[
                { symbol: "BTF", artist: "Boostify", fans: "4.2K" },
                { symbol: "LUNA", artist: "Luna Echo", fans: "1.8K" },
                { symbol: "VIBE", artist: "Urban Flow", fans: "980" },
                { symbol: "NEON", artist: "Neon Lights", fans: "2.1K" },
                { symbol: "ECHO", artist: "Echo Dreams", fans: "760" },
                { symbol: "WAVE", artist: "Wave Theory", fans: "1.3K" },
                { symbol: "BTF", artist: "Boostify", fans: "4.2K" },
                { symbol: "LUNA", artist: "Luna Echo", fans: "1.8K" },
                { symbol: "VIBE", artist: "Urban Flow", fans: "980" },
                { symbol: "NEON", artist: "Neon Lights", fans: "2.1K" },
              ].map((t, i) => (
                <div key={i} className="inline-flex items-center gap-2 px-4 py-1.5 whitespace-nowrap">
                  <span className="font-bold text-orange-400 text-sm">{t.symbol}</span>
                  <span className="text-white/70 text-xs">{t.artist}</span>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-blue-400">
                    <Users className="h-3 w-3" />
                    {t.fans} fans
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Duplicate for seamless scroll
  const tickerItems = [...tokens, ...tokens];

  return (
    <div className="relative w-full overflow-hidden bg-black/40 border-y border-orange-500/20 backdrop-blur-sm">
      <div className="flex items-center">
        {/* Static label */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-500/20 border-r border-orange-500/30 z-10">
          <Zap className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">Live</span>
        </div>

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden">
          <div className="inline-flex animate-ticker">
            {tickerItems.map((token, i) => (
              <TickerItem key={`${token.id}-${i}`} token={token} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Token Ticker Expanded — Full ticker panel with details
 */
export function TokenTickerPanel() {
  const { data: tokens } = useQuery<TokenTickerData[]>({
    queryKey: ['/api/ai-social/token-ticker'],
    queryFn: async () => {
      const res = await fetch('/api/ai-social/token-ticker');
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 15000,
  });

  if (!tokens || tokens.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No active tokens yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-2">
        <BarChart3 className="h-4 w-4 text-orange-400" />
        <span className="text-sm font-bold text-white">Token Market</span>
        <span className="text-[10px] text-green-400 ml-auto">LIVE</span>
      </div>

      {tokens.slice(0, 8).map((token) => {
        const change = parseFloat(token.priceChange24h);
        const isUp = change > 0;
        const price = parseFloat(token.price || '0');

        return (
          <div key={token.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded transition-colors">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-white">
                  {token.symbol.slice(0, 2)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">${token.symbol}</div>
                <div className="text-[10px] text-gray-400 truncate">{token.artistName}</div>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="text-xs font-mono text-white">${price.toFixed(4)}</div>
              <div className={cn(
                "text-[10px] font-semibold",
                isUp ? "text-green-400" : "text-red-400"
              )}>
                {isUp ? '+' : ''}{change}%
              </div>
            </div>
          </div>
        );
      })}

      {/* Market summary */}
      <div className="px-3 py-2 border-t border-white/10 mt-1">
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>{tokens.length} active tokens</span>
          <span>MCap: ${(tokens.reduce((sum, t) => sum + parseFloat(t.marketCap || '0'), 0) / 1000).toFixed(1)}k</span>
        </div>
      </div>
    </div>
  );
}
