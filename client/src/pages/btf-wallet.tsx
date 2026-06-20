import React, { useState } from 'react';
import { Link } from 'wouter';
import { useBTFToken } from '../hooks/use-btf-token';
import { useWeb3 } from '../hooks/use-web3';
import { WalletConnectButton } from '../components/boostiswap/wallet-connect-button';
import { STAKING_TIERS, BTF_TOKEN_ADDRESS, BTF_TOKEN_META } from '../lib/btf-token-config';
import {
  Flame, TrendingUp, Shield, Send, Copy, ExternalLink,
  RefreshCw, ArrowRight, Wallet, BarChart3, Zap, AlertCircle, Award, ShoppingCart, Rocket, Music
} from 'lucide-react';
import { SongBoostWidget } from '../components/btf/song-boost-widget';
import { PayWithBTFButton, ServicePriceTag } from '../components/btf/btf-payment-modal';
import { BTF_SERVICE_PRICES, getServicesByCategory } from '../lib/btf-service-pricing';
import { useBTFPayment } from '../hooks/use-btf-payment';

const BTF_IMG = BTF_TOKEN_META.image;

function formatNumber(n: string | number, decimals = 2): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(decimals) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(decimals) + 'K';
  return num.toFixed(decimals);
}

export default function BTFWalletPage() {
  const { isConnected, address, balanceFormatted, symbol } = useWeb3();
  const {
    balance, tokenStats, userDashboard, vaultStats,
    isLoading, transferBTF, refreshAll, isPolygon,
  } = useBTFToken();

  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [showSend, setShowSend] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(BTF_TOKEN_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!sendTo || !sendAmount) return;
    const hash = await transferBTF(sendTo, sendAmount);
    if (hash) { setSendTo(''); setSendAmount(''); setShowSend(false); }
  };

  const tier = userDashboard?.tier || 'None';
  const tierInfo = STAKING_TIERS[tier];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900/20 to-slate-900">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <img src={BTF_IMG} alt="BTF Token" className="w-12 h-12 rounded-xl object-contain" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">BTF Wallet</h1>
              <p className="text-sm text-orange-400">Boostify Token — Ecosystem Currency</p>
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
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-6 text-center">
            <img src={BTF_IMG} alt="BTF Token" className="h-16 w-16 mx-auto mb-3 opacity-70" />
            <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-amber-400/70 text-sm mb-4">Connect MetaMask or WalletConnect to view your BTF balance</p>
            <WalletConnectButton />
          </div>
        )}

        {/* Wrong Network */}
        {isConnected && !isPolygon && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-400 text-sm">Switch to <strong>Polygon Mainnet</strong> to use BTF Token</p>
          </div>
        )}

        {isConnected && (
          <>
            {/* Main Balance Card */}
            <div className="bg-gradient-to-br from-orange-500/20 to-purple-500/20 border border-orange-500/30 rounded-2xl p-4 sm:p-8 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                  <img src={BTF_IMG} alt="BTF" className="w-12 h-12 sm:w-20 sm:h-20 rounded-2xl object-contain flex-shrink-0 drop-shadow-[0_0_12px_rgba(249,115,22,0.4)]" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-orange-400 mb-1">Your BTF Balance</p>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl sm:text-5xl font-bold text-white truncate">
                        {formatNumber(balance)}
                      </span>
                      <span className="text-lg sm:text-xl text-orange-400">BTF</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-2 font-mono">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
                  {/* Tier Badge */}
                  <div className={`bg-gradient-to-r ${tierInfo.gradient} px-3 sm:px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-2`}>
                    <span className="text-base sm:text-lg">{tierInfo.icon}</span>
                    <span className="text-white font-bold text-xs sm:text-sm">{tier} Tier</span>
                  </div>
                  {/* MATIC Balance */}
                  <p className="text-[10px] sm:text-xs text-gray-400">
                    {balanceFormatted} {symbol}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mt-4 sm:mt-6">
                <Link href="/boostiswap">
                  <span
                    className="flex items-center justify-center gap-1.5 sm:gap-2 bg-gradient-to-r from-orange-500/25 to-amber-500/25 hover:from-orange-500/35 hover:to-amber-500/35 border border-orange-500/40 text-orange-400 px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors font-semibold cursor-pointer w-full"
                  >
                    <ShoppingCart className="h-4 w-4 flex-shrink-0" /> Buy BTF
                  </span>
                </Link>
                <button
                  onClick={() => setShowSend(!showSend)}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-400 px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors"
                >
                  <Send className="h-4 w-4 flex-shrink-0" /> Send
                </button>
                <a
                  href="/btf-staking"
                  className="flex items-center justify-center gap-1.5 sm:gap-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-400 px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors"
                >
                  <Shield className="h-4 w-4 flex-shrink-0" /> Stake
                </a>
                <button
                  onClick={copyAddress}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors"
                >
                  <Copy className="h-4 w-4 flex-shrink-0" /> {copied ? 'Copied!' : 'Contract'}
                </button>
                <a
                  href={`https://polygonscan.com/token/${BTF_TOKEN_ADDRESS}?a=${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 sm:gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors"
                >
                  <ExternalLink className="h-4 w-4 flex-shrink-0" /> Explorer
                </a>
              </div>
            </div>

            {/* Send Form */}
            {showSend && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 mb-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Send className="h-4 w-4 text-orange-400" /> Send BTF
                </h3>
                <p className="text-xs text-amber-400/70 mb-4">2% burn tax will be applied to the transfer</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Recipient address (0x...)"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Amount"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      onClick={() => setSendAmount(balance)}
                      className="px-3 py-2 bg-orange-500/20 text-orange-400 text-xs rounded-lg hover:bg-orange-500/30"
                    >
                      MAX
                    </button>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !sendTo || !sendAmount}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-lg font-semibold text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isLoading ? 'Sending...' : `Send ${sendAmount || '0'} BTF`}
                  </button>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6">
              <StatCard
                icon={<BarChart3 className="h-5 w-5 text-blue-400" />}
                label="Circulating Supply"
                value={tokenStats ? formatNumber(tokenStats.circulatingSupply) : '...'}
                sub="BTF"
              />
              <StatCard
                icon={<Flame className="h-5 w-5 text-red-400" />}
                label="Total Burned"
                value={tokenStats ? formatNumber(tokenStats.totalBurned) : '...'}
                sub="BTF 🔥"
              />
              <StatCard
                icon={<Award className="h-5 w-5 text-green-400" />}
                label="Ecosystem Rewards"
                value={tokenStats ? formatNumber(tokenStats.ecosystemRemaining) : '...'}
                sub="BTF remaining"
              />
              <StatCard
                icon={<Shield className="h-5 w-5 text-purple-400" />}
                label="Total Staked"
                value={vaultStats ? formatNumber(vaultStats.totalStaked) : '...'}
                sub={`${vaultStats?.totalStakers || 0} stakers`}
              />
            </div>

            {/* Staking Summary + Tier Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* My Staking */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-400" /> My Staking
                </h3>
                {userDashboard && parseFloat(userDashboard.totalStaked) > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Total Staked</span>
                      <span className="text-white font-medium">{formatNumber(userDashboard.totalStaked)} BTF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Pending Rewards</span>
                      <span className="text-green-400 font-medium">+{formatNumber(userDashboard.totalPendingRewards)} BTF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Active Stakes</span>
                      <span className="text-white">{userDashboard.stakes.filter(s => s.active).length}</span>
                    </div>
                    <a
                      href="/btf-staking"
                      className="flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-400 py-2 rounded-lg text-sm mt-3 transition-colors"
                    >
                      Manage Stakes <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-sm mb-3">No active stakes</p>
                    <a
                      href="/btf-staking"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:from-purple-600 hover:to-purple-700 transition-all"
                    >
                      Start Staking <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Tier Benefits */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Award className="h-4 w-4 text-yellow-400" /> {tier} Tier Benefits
                </h3>
                {tier === 'None' ? (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-sm mb-2">Stake BTF to unlock tier benefits</p>
                    <p className="text-xs text-gray-500">Minimum: 100 BTF = Bronze</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {tierInfo.benefits.map((b, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                        <Zap className="h-3 w-3 text-orange-400 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Tokenomics Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-400" /> Tokenomics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Max Supply</p>
                  <p className="text-white font-medium">100,000,000 BTF</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Transfer Burn</p>
                  <p className="text-red-400 font-medium">{tokenStats ? (tokenStats.transferBurnBps / 100).toFixed(1) : '2'}%</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Service Burn</p>
                  <p className="text-red-400 font-medium">{tokenStats ? (tokenStats.serviceBurnBps / 100).toFixed(1) : '50'}%</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Ecosystem (4yr)</p>
                  <p className="text-green-400 font-medium">40% (40M BTF)</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Anti-Whale</p>
                  <p className="text-amber-400 font-medium">2% max/wallet</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Network</p>
                  <p className="text-purple-400 font-medium">Polygon (137)</p>
                </div>
              </div>
            </div>

            {/* BTF Economy — Service Pricing */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 mt-6">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Rocket className="h-4 w-4 text-purple-400" /> BTF Economy — Pay with BTF
              </h3>
              <p className="text-xs text-gray-400 mb-4">Use BTF to access all platform services. 50% of every payment is burned permanently.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(BTF_SERVICE_PRICES)
                  .filter(s => s.id !== 'fan_tip')
                  .map((service) => (
                    <div key={service.id} className="bg-white/5 rounded-lg p-3 flex items-start gap-3 hover:bg-white/10 transition-colors">
                      <span className="text-2xl">{service.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{service.name}</p>
                        <p className="text-xs text-gray-400 line-clamp-1">{service.description}</p>
                        <div className="mt-1.5">
                          <ServicePriceTag serviceId={service.id} />
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>

              {tier !== 'None' && (
                <p className="text-xs text-center text-emerald-400 mt-4">
                  ✨ Your {tier} tier gives you discounts on all services above
                </p>
              )}
            </div>

            {/* Song Boost Section */}
            <div className="mt-6">
              <SongBoostWidget songName="Select a song to boost" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
        {icon}
        <span className="text-[10px] sm:text-xs text-gray-400 leading-tight">{label}</span>
      </div>
      <p className="text-lg sm:text-2xl font-bold text-white truncate">{value}</p>
      <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">{sub}</p>
    </div>
  );
}
