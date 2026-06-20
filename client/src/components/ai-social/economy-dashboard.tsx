/**
 * Economy Dashboard — Global social economy stats panel
 * Shows tips, revenue, active promotions, hype campaigns, and market overview
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Coins, 
  Flame, 
  TrendingUp, 
  Zap, 
  Target,
  Crown,
  BarChart3,
  Rocket
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { TokenTickerPanel } from './trading-ticker';
import { TipLeaderboard } from './tip-button';

interface EconomyStats {
  tips: { total: string; count: number };
  platformRevenue: string;
  promotions: { active: number };
  hypeCampaigns: { active: number };
  treasuries: { totalValue: string; artistCount: number };
  tokens: { active: number; totalMarketCap: string };
}

interface HypeCampaign {
  id: number;
  targetArtistId: number;
  title: string;
  description: string | null;
  campaignGoal: string;
  totalParticipants: number;
  totalPosts: number;
  totalEngagement: number;
  status: string;
  artist: { id: number; name: string; imageUrl: string | null } | null;
  token: { symbol: string; price: string } | null;
}

function StatCard({ icon, label, value, subValue, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) {
  return (
    <div className={cn("rounded-xl p-3 bg-gradient-to-br border", color)}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      {subValue && <div className="text-[10px] text-gray-400">{subValue}</div>}
    </div>
  );
}

export function EconomyDashboard() {
  const { data: stats } = useQuery<EconomyStats>({
    queryKey: ['/api/ai-social/economy-stats'],
    queryFn: async () => {
      const res = await fetch('/api/ai-social/economy-stats');
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 30000,
  });

  const { data: hypeCampaigns } = useQuery<HypeCampaign[]>({
    queryKey: ['/api/ai-social/hype-campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/ai-social/hype-campaigns');
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={<Coins className="h-3.5 w-3.5 text-yellow-400" />}
            label="Tips"
            value={`${parseFloat(stats.tips.total).toFixed(0)} BTF`}
            subValue={`${stats.tips.count} tips`}
            color="from-yellow-500/10 to-orange-500/10 border-yellow-500/20"
          />
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5 text-green-400" />}
            label="Market Cap"
            value={`$${(parseFloat(stats.tokens.totalMarketCap) / 1000).toFixed(1)}k`}
            subValue={`${stats.tokens.active} tokens`}
            color="from-green-500/10 to-emerald-500/10 border-green-500/20"
          />
          <StatCard
            icon={<Target className="h-3.5 w-3.5 text-purple-400" />}
            label="Promotions"
            value={String(stats.promotions.active)}
            subValue="active campaigns"
            color="from-purple-500/10 to-pink-500/10 border-purple-500/20"
          />
          <StatCard
            icon={<Crown className="h-3.5 w-3.5 text-blue-400" />}
            label="Treasuries"
            value={`$${(parseFloat(stats.treasuries.totalValue) / 1000).toFixed(1)}k`}
            subValue={`${stats.treasuries.artistCount} artists`}
            color="from-blue-500/10 to-cyan-500/10 border-blue-500/20"
          />
        </div>
      )}

      {/* Active Hype Campaigns */}
      {hypeCampaigns && hypeCampaigns.length > 0 && (
        <div className="rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-orange-500/20">
            <Rocket className="h-4 w-4 text-orange-400 animate-pulse" />
            <span className="text-sm font-bold text-white">Hype Campaigns</span>
            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full ml-auto font-semibold">
              LIVE
            </span>
          </div>

          {hypeCampaigns.map((campaign) => (
            <div key={campaign.id} className="px-3 py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                <span className="text-xs font-bold text-white truncate">{campaign.title}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                <span>{campaign.totalParticipants} artists</span>
                <span>{campaign.totalPosts} posts</span>
                {campaign.token && (
                  <span className="text-orange-400 font-semibold">
                    ${campaign.token.symbol} @ ${parseFloat(campaign.token.price || '0').toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Token Market Panel */}
      <div className="rounded-xl bg-black/20 border border-white/10 overflow-hidden">
        <TokenTickerPanel />
      </div>

      {/* Tip Leaderboard */}
      <div className="rounded-xl bg-black/20 border border-white/10 overflow-hidden">
        <TipLeaderboard />
      </div>
    </div>
  );
}
