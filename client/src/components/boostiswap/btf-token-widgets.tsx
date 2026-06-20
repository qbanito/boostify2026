import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useBTFToken } from '../../hooks/use-btf-token';
import { useWeb3 } from '../../hooks/use-web3';
import { STAKING_TIERS, BTF_TOKEN_ADDRESS, BTF_TOKEN_META } from '../../lib/btf-token-config';
import { Shield, Flame, TrendingUp, ArrowRight, ExternalLink, Zap, ShoppingCart } from 'lucide-react';
import { Link } from 'wouter';

const BTF_IMG = BTF_TOKEN_META.image;

function fmt(n: string | number, d = 2): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(d) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(d) + 'K';
  return num.toFixed(d);
}

/** Compact BTF balance + stats bar for BoostiSwap header */
export function BTFTokenBanner() {
  const { isConnected } = useWeb3();
  const { balance, tokenStats, userDashboard, vaultStats } = useBTFToken();

  const tier = userDashboard?.tier || 'None';
  const tierInfo = STAKING_TIERS[tier];

  if (!isConnected) {
    return (
      <div className="bg-gradient-to-r from-orange-500/10 via-purple-500/10 to-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={BTF_IMG} alt="BTF" className="w-10 h-10 rounded-lg object-contain" />
          <div>
            <p className="text-white font-semibold text-sm">BTF Token — Ecosystem Currency</p>
            <p className="text-xs text-gray-400">Connect wallet to see your BTF balance & tier</p>
          </div>
        </div>
        <Link href="/btf-wallet">
          <span className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors cursor-pointer">
            Learn More <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-orange-500/10 via-purple-500/10 to-orange-500/10 border border-orange-500/20 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Balance + Tier */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <img src={BTF_IMG} alt="BTF" className="w-8 h-8 rounded-lg object-contain" />
            <div>
              <p className="text-white font-bold text-lg leading-none">{fmt(balance)} <span className="text-orange-400 text-sm font-normal">BTF</span></p>
              <p className="text-xs text-gray-500">Your Balance</p>
            </div>
          </div>

          <div className={`flex items-center gap-1.5 bg-gradient-to-r ${tierInfo.gradient} px-3 py-1 rounded-full`}>
            <span className="text-sm">{tierInfo.icon}</span>
            <span className="text-white text-xs font-semibold">{tier}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1 text-gray-400">
            <Flame className="h-3 w-3 text-red-400" />
            <span>{tokenStats ? fmt(tokenStats.totalBurned) : '...'} burned</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Shield className="h-3 w-3 text-purple-400" />
            <span>{vaultStats ? fmt(vaultStats.totalStaked) : '...'} staked</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <TrendingUp className="h-3 w-3 text-green-400" />
            <span>{tokenStats ? fmt(tokenStats.circulatingSupply) : '...'} supply</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href="/btf-wallet">
            <span className="flex items-center gap-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer">
              <img src={BTF_IMG} alt="BTF" className="h-3 w-3" /> Wallet
            </span>
          </Link>
          <Link href="/btf-staking">
            <span className="flex items-center gap-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer">
              <Shield className="h-3 w-3" /> Stake
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Sidebar widget for BTF Token — used in Social Network */
export function BTFTokenWidget() {
  const { isConnected } = useWeb3();
  const { balance, tokenStats, userDashboard } = useBTFToken();

  const tier = userDashboard?.tier || 'None';
  const tierInfo = STAKING_TIERS[tier];

  return (
    <Card className="bg-gradient-to-br from-orange-950/40 to-slate-900/80 border-orange-500/20 backdrop-blur-sm overflow-hidden relative">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      <CardHeader className="pb-3 relative">
        <CardTitle className="flex items-center text-lg gap-2">
          <img src={BTF_IMG} alt="BTF" className="w-7 h-7 rounded-lg object-contain" />
          <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            BTF Token
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        {!isConnected ? (
          <div className="text-center py-2">
            <p className="text-xs text-gray-400 mb-3">Connect wallet to view BTF balance</p>
            <Link href="/btf-wallet">
              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:from-orange-600 hover:to-orange-700 transition-all cursor-pointer">
                <img src={BTF_IMG} alt="BTF" className="h-3 w-3" /> Open BTF Wallet
              </span>
            </Link>
          </div>
        ) : (
          <>
            {/* Balance */}
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-xs text-gray-500 mb-1">Your Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{fmt(balance)}</span>
                <span className="text-sm text-orange-400">BTF</span>
              </div>
            </div>

            {/* Tier Badge */}
            <div className={`flex items-center justify-between bg-gradient-to-r ${tierInfo.gradient} bg-opacity-20 rounded-lg p-3`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{tierInfo.icon}</span>
                <div>
                  <p className="text-white text-sm font-semibold">{tier} Tier</p>
                  <p className="text-white/60 text-[10px]">{tier === 'None' ? 'Stake to unlock' : tierInfo.benefits[0]}</p>
                </div>
              </div>
              {tier !== 'None' && (
                <Shield className="h-5 w-5 text-white/40" />
              )}
            </div>

            {/* Token Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50">
                <p className="text-[10px] text-gray-500">Burned</p>
                <p className="text-sm font-semibold text-red-400">{tokenStats ? fmt(tokenStats.totalBurned) : '...'}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50">
                <p className="text-[10px] text-gray-500">Staked</p>
                <p className="text-sm font-semibold text-purple-400">{userDashboard ? fmt(userDashboard.totalStaked) : '0'}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Link href="/boostiswap" className="flex-1">
                <span className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500/25 to-amber-500/25 hover:from-orange-500/35 hover:to-amber-500/35 border border-orange-500/30 text-orange-400 py-2 rounded-lg text-xs transition-colors cursor-pointer font-semibold w-full">
                  <ShoppingCart className="h-3 w-3" /> Buy
                </span>
              </Link>
              <Link href="/btf-wallet" className="flex-1">
                <span className="flex items-center justify-center gap-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 py-2 rounded-lg text-xs transition-colors cursor-pointer w-full">
                  <img src={BTF_IMG} alt="BTF" className="h-3 w-3" /> Wallet
                </span>
              </Link>
              <Link href="/btf-staking" className="flex-1">
                <span className="flex items-center justify-center gap-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 py-2 rounded-lg text-xs transition-colors cursor-pointer w-full">
                  <Shield className="h-3 w-3" /> Stake
                </span>
              </Link>
            </div>

            {/* Polygonscan Link */}
            <a
              href={`https://polygonscan.com/token/${BTF_TOKEN_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> View on Polygonscan
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
