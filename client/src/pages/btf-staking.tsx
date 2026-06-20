import React, { useState, useEffect } from 'react';
import { useBTFToken } from '../hooks/use-btf-token';
import { useWeb3 } from '../hooks/use-web3';
import { WalletConnectButton } from '../components/boostiswap/wallet-connect-button';
import { STAKING_TIERS, LOCK_PERIODS, getTierForAmount, BTF_TOKEN_META } from '../lib/btf-token-config';
import { UtilityDisclaimer } from '../components/btf/utility-disclaimer';
import {
  Shield, Lock, Unlock, Clock, TrendingUp, Gift, AlertCircle,
  Wallet, RefreshCw, Zap, Award, ChevronDown, ChevronUp, Info
} from 'lucide-react';

const BTF_IMG = BTF_TOKEN_META.image;

function fmt(n: string | number, d = 2): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(d) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(d) + 'K';
  return num.toFixed(d);
}

function daysLeft(endTimestamp: number): number {
  const now = Math.floor(Date.now() / 1000);
  if (endTimestamp <= now) return 0;
  return Math.ceil((endTimestamp - now) / 86400);
}

export default function BTFStakingPage() {
  const { isConnected, address } = useWeb3();
  const {
    balance, userDashboard, vaultStats, isLoading,
    stakeBTF, unstakeBTF, claimRewards, refreshAll, isPolygon
  } = useBTFToken();

  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<typeof LOCK_PERIODS[number]>(LOCK_PERIODS[0]);
  const [expandedStake, setExpandedStake] = useState<number | null>(null);
  const [tab, setTab] = useState<'stake' | 'positions'>('stake');

  const tier = userDashboard?.tier || 'None';
  const tierInfo = STAKING_TIERS[tier];

  // Calculate projected tier from new stake
  const projectedTotal = parseFloat(userDashboard?.totalStaked || '0') + parseFloat(stakeAmount || '0');
  const projectedTier = getTierForAmount(projectedTotal);
  const projectedTierInfo = STAKING_TIERS[projectedTier];
  const tierWillUpgrade = projectedTier !== tier && parseFloat(stakeAmount || '0') > 0;

  // Calculate estimated service credit bonuses (not investment returns)
  const estimatedYearlyRewards = (parseFloat(stakeAmount || '0') * selectedPeriod.apyBps) / 10000;
  const estimatedPeriodRewards = estimatedYearlyRewards * (selectedPeriod.days / 365);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    const hash = await stakeBTF(stakeAmount, selectedPeriod.seconds);
    if (hash) { setStakeAmount(''); await refreshAll(); }
  };

  const handleUnstake = async (index: number) => {
    const hash = await unstakeBTF(index);
    if (hash) await refreshAll();
  };

  const handleClaim = async (index: number) => {
    const hash = await claimRewards(index);
    if (hash) await refreshAll();
  };

  const activeStakes = userDashboard?.stakes.filter(s => s.active) || [];
  const totalPending = parseFloat(userDashboard?.totalPendingRewards || '0');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <img src={BTF_IMG} alt="BTF Token" className="w-12 h-12 rounded-xl object-contain" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">BTF Service Tiers</h1>
              <p className="text-sm text-purple-400">Lock credits to unlock service discounts and benefits</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshAll} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors" title="Refresh">
              <RefreshCw className={`h-4 w-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <WalletConnectButton />
          </div>
        </div>

        {/* Not Connected */}
        {!isConnected && (
          <div className="bg-purple-500/20 border border-purple-500/50 rounded-xl p-6 text-center">
            <Wallet className="h-12 w-12 text-purple-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-purple-400/70 text-sm mb-4">Connect to activate service tiers and unlock discounts on Boostify digital services</p>
            <WalletConnectButton />
          </div>
        )}

        {isConnected && !isPolygon && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-400 text-sm">Switch to <strong>Polygon Mainnet</strong> to stake BTF</p>
          </div>
        )}

        {isConnected && (
          <>
            {/* Vault Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Total Value Locked</p>
                <p className="text-xl font-bold text-white">{vaultStats ? fmt(vaultStats.totalStaked) : '...'} BTF</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Stakers</p>
                <p className="text-xl font-bold text-white">{vaultStats?.totalStakers || '...'}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Rewards Pool</p>
                <p className="text-xl font-bold text-green-400">{vaultStats ? fmt(vaultStats.rewardsPoolBalance) : '...'} BTF</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Your Tier</p>
                <div className={`flex items-center gap-2 bg-gradient-to-r ${tierInfo.gradient} bg-clip-text text-transparent`}>
                  <span className="text-lg">{tierInfo.icon}</span>
                  <span className="text-xl font-bold">{tier}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 mb-6">
              <button
                onClick={() => setTab('stake')}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  tab === 'stake' ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Lock className="h-4 w-4 inline mr-2" /> Stake BTF
              </button>
              <button
                onClick={() => setTab('positions')}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  tab === 'positions' ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40' : 'text-gray-400 hover:text-white'
                }`}
              >
                <TrendingUp className="h-4 w-4 inline mr-2" /> My Positions ({activeStakes.length})
              </button>
            </div>

            {/* STAKE TAB */}
            {tab === 'stake' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stake Form */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-purple-400" /> New Stake
                  </h3>

                  {/* Amount Input */}
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Amount to Stake</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg font-medium placeholder:text-gray-500 focus:border-purple-500 focus:outline-none"
                      />
                      <button
                        onClick={() => setStakeAmount(balance)}
                        className="px-3 py-2 bg-purple-500/20 text-purple-400 text-xs rounded-lg hover:bg-purple-500/30 border border-purple-500/30"
                      >
                        MAX
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Balance: {fmt(balance)} BTF</p>
                  </div>

                  {/* Lock Period Selection */}
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-2 block">Lock Period</label>
                    <div className="grid grid-cols-2 gap-2">
                      {LOCK_PERIODS.map((period) => (
                        <button
                          key={period.days}
                          onClick={() => setSelectedPeriod(period)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            selectedPeriod.days === period.days
                              ? 'bg-purple-500/20 border-purple-500/50 ring-1 ring-purple-500/30'
                              : 'bg-slate-900/50 border-slate-600 hover:border-slate-500'
                          }`}
                        >
                          <p className="text-white font-medium text-sm">{period.label}</p>
                          <p className="text-green-400 text-xs mt-1">+{(period.apyBps / 100).toFixed(0)}% service credit bonus</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Projections */}
                  {parseFloat(stakeAmount || '0') > 0 && (
                    <div className="bg-slate-900/50 rounded-lg p-4 mb-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Service credit bonus ({selectedPeriod.label})</span>
                        <span className="text-green-400">+{fmt(estimatedPeriodRewards)} BTF</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Yearly credit bonus</span>
                        <span className="text-green-400">+{fmt(estimatedYearlyRewards)} BTF</span>
                      </div>
                      {tierWillUpgrade && (
                        <div className="flex justify-between text-sm pt-1 border-t border-slate-700">
                          <span className="text-gray-400">Tier upgrade</span>
                          <span className="text-amber-400">{tier} → {projectedTier} {projectedTierInfo.icon}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Early Unstake Warning */}
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                    <Info className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-400/80">Early unstake incurs a 5% penalty. Rewards accrue linearly.</p>
                  </div>

                  <button
                    onClick={handleStake}
                    disabled={isLoading || !stakeAmount || parseFloat(stakeAmount) <= 0 || parseFloat(stakeAmount) > parseFloat(balance)}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold text-sm hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isLoading ? 'Staking...' : `Stake ${stakeAmount || '0'} BTF for ${selectedPeriod.label}`}
                  </button>
                </div>

                {/* Tier System */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-400" /> Tier System
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(STAKING_TIERS).filter(([k]) => k !== 'None').map(([name, t]) => {
                      const isCurrentTier = name === tier;
                      const isProjected = name === projectedTier && tierWillUpgrade;
                      return (
                        <div
                          key={name}
                          className={`p-4 rounded-lg border transition-all ${
                            isCurrentTier ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/20' :
                            isProjected ? 'bg-amber-500/10 border-amber-500/40' :
                            'bg-slate-900/50 border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{t.icon}</span>
                              <span className={`font-semibold text-sm ${isCurrentTier ? 'text-purple-300' : 'text-white'}`}>
                                {name}
                              </span>
                              {isCurrentTier && <span className="text-[10px] bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">Current</span>}
                              {isProjected && <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full">Projected</span>}
                            </div>
                            <span className="text-xs text-gray-400">≥ {fmt(t.threshold, 0)} BTF</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {t.benefits.map((b, i) => (
                              <span key={i} className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{b}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* POSITIONS TAB */}
            {tab === 'positions' && (
              <div>
                {/* Summary Bar */}
                {activeStakes.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-500/20 to-green-500/20 border border-purple-500/30 rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400">Total Staked</p>
                      <p className="text-xl font-bold text-white">{fmt(userDashboard?.totalStaked || 0)} BTF</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Pending Rewards</p>
                      <p className="text-xl font-bold text-green-400">+{fmt(totalPending)} BTF</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Active Stakes</p>
                      <p className="text-xl font-bold text-white">{activeStakes.length}</p>
                    </div>
                  </div>
                )}

                {activeStakes.length === 0 ? (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
                    <Shield className="h-12 w-12 text-purple-400/50 mx-auto mb-3" />
                    <p className="text-gray-400 mb-3">No active staking positions</p>
                    <button
                      onClick={() => setTab('stake')}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-2 rounded-lg text-sm font-medium"
                    >
                      <Lock className="h-4 w-4" /> Create First Stake
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeStakes.map((stake, i) => {
                      const remaining = stake.daysRemaining;
                      const isLocked = stake.isLocked;
                      const isExpanded = expandedStake === i;
                      const lockDays = Math.ceil(stake.lockPeriod / 86400);
                      const progress = lockDays > 0 ? Math.min(100, ((lockDays - remaining) / lockDays) * 100) : 100;

                      return (
                        <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                          {/* Stake Header */}
                          <button
                            onClick={() => setExpandedStake(isExpanded ? null : i)}
                            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                isLocked ? 'bg-amber-500/20' : 'bg-green-500/20'
                              }`}>
                                {isLocked ? <Lock className="h-5 w-5 text-amber-400" /> : <Unlock className="h-5 w-5 text-green-400" />}
                              </div>
                              <div className="text-left">
                                <p className="text-white font-medium">{fmt(stake.amount)} BTF</p>
                                <p className="text-xs text-gray-400">{lockDays} day lock</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-green-400 text-sm font-medium">+{fmt(stake.pendingReward)} BTF</p>
                                <p className="text-xs text-gray-500">{isLocked ? `${remaining}d left` : 'Unlocked ✓'}</p>
                              </div>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                            </div>
                          </button>

                          {/* Expanded Detail */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-slate-700 pt-4">
                              {/* Progress Bar */}
                              <div className="mb-4">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                  <span>Lock Progress</span>
                                  <span>{progress.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-2">
                                  <div
                                    className="bg-gradient-to-r from-purple-500 to-green-500 h-2 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                <div>
                                  <p className="text-gray-500 text-xs">Start</p>
                                  <p className="text-gray-300">{stake.stakedAt.toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs">Unlock</p>
                                  <p className="text-gray-300">{stake.lockEndsAt.toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs">Staked</p>
                                  <p className="text-white font-medium">{fmt(stake.amount)} BTF</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs">Rewards</p>
                                  <p className="text-green-400 font-medium">+{fmt(stake.pendingReward)} BTF</p>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleClaim(i)}
                                  disabled={isLoading || parseFloat(stake.pendingReward) === 0}
                                  className="flex-1 flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-400 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Gift className="h-4 w-4" /> Claim Rewards
                                </button>
                                <button
                                  onClick={() => handleUnstake(i)}
                                  disabled={isLoading}
                                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    isLocked
                                      ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400'
                                      : 'bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-400'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <Unlock className="h-4 w-4" /> {isLocked ? 'Unstake (5% penalty)' : 'Unstake'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {/* Legal Disclaimer */}
        <UtilityDisclaimer variant="short" size="sm" className="mt-8 mb-4" />
      </div>
    </div>
  );
}
