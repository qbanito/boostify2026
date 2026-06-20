/**
 * BTF AI Artist Mint Page V2 — Continuous Activation + Utility Demand
 *
 * V2 features:
 * - Continuous activation curve (cost rises per mint based on demand)
 * - Platform reserve stats (200 Boostify artists)
 * - Artist activity score display in gallery
 * - 4-way credit distribution (burn/service tier/treasury/reserve)
 * - Next activation cost prediction
 * - Global activity score dashboard
 */

import React, { useState, useMemo } from 'react';
import { useBTFArtistMint, type ArtistRecord, type MintSyncResult } from '../hooks/use-btf-artist-mint';
import { useWeb3 } from '../hooks/use-web3';
import { useLocation } from 'wouter';
import { WalletConnectButton } from '../components/boostiswap/wallet-connect-button';
import {
  MINT_TIERS, PUBLIC_SUPPLY, PLATFORM_RESERVE, MAX_ARTISTS,
  DISTRIBUTION, getPriceForMint, ACTIVITY_VALUES, type MintTier,
} from '../lib/btf-artist-mint-config';
import { BTF_TOKEN_META } from '../lib/btf-token-config';
import {
  Flame, TrendingUp, Shield, Sparkles, RefreshCw, AlertCircle,
  Lock, ChevronRight, Zap, Users, Crown, Star, Music, Check, Loader2,
  Activity, Award, Video, Handshake, ExternalLink, Globe
} from 'lucide-react';

const BTF_IMG = BTF_TOKEN_META.image;

function formatNumber(n: string | number, decimals = 2): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(decimals) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(decimals) + 'K';
  return num.toFixed(decimals);
}

// ═══════════════════════════════════════════════════════
//  Genre Options
// ═══════════════════════════════════════════════════════

const GENRE_OPTIONS = [
  { value: 'reggaeton', label: 'Reggaeton', emoji: '🎤' },
  { value: 'trap', label: 'Trap', emoji: '💀' },
  { value: 'pop', label: 'Pop', emoji: '⭐' },
  { value: 'hip-hop', label: 'Hip-Hop', emoji: '🎧' },
  { value: 'r&b', label: 'R&B', emoji: '💜' },
  { value: 'electronic', label: 'Electronic', emoji: '🎹' },
  { value: 'rock', label: 'Rock', emoji: '🎸' },
  { value: 'latin-pop', label: 'Latin Pop', emoji: '🌴' },
  { value: 'afrobeats', label: 'Afrobeats', emoji: '🥁' },
  { value: 'corridos', label: 'Corridos', emoji: '🤠' },
  { value: 'dembow', label: 'Dembow', emoji: '🔊' },
  { value: 'indie', label: 'Indie', emoji: '🌻' },
];

// ═══════════════════════════════════════════════════════
//  CONTINUOUS BONDING CURVE VISUALIZATION
// ═══════════════════════════════════════════════════════

function BondingCurveChart({ publicMinted }: { publicMinted: number }) {
  // Show continuous price line across all 800 public mints
  const samplePoints = 40; // sample points across the curve
  const maxPrice = MINT_TIERS[4].maxPriceBTF;

  return (
    <div className="relative">
      {/* SVG Continuous Curve */}
      <svg viewBox="0 0 400 160" className="w-full h-40" preserveAspectRatio="none">
        {/* Background tier regions */}
        {MINT_TIERS.map((tier, i) => {
          const x1 = ((tier.startId - 1) / PUBLIC_SUPPLY) * 400;
          const x2 = (tier.endId / PUBLIC_SUPPLY) * 400;
          return (
            <rect
              key={i}
              x={x1} y={0} width={x2 - x1} height={160}
              fill={tier.color} opacity={0.08}
            />
          );
        })}

        {/* Price curve line */}
        <polyline
          fill="none"
          stroke="url(#curveGradient)"
          strokeWidth="2.5"
          points={Array.from({ length: samplePoints + 1 }, (_, i) => {
            const mintNum = Math.max(1, Math.round((i / samplePoints) * PUBLIC_SUPPLY));
            const price = getPriceForMint(Math.min(mintNum, PUBLIC_SUPPLY));
            const x = (mintNum / PUBLIC_SUPPLY) * 400;
            const y = 155 - (price / maxPrice) * 145;
            return `${x},${y}`;
          }).join(' ')}
        />

        {/* Fill under curve */}
        <polygon
          fill="url(#curveGradient)"
          opacity="0.15"
          points={[
            `0,160`,
            ...Array.from({ length: samplePoints + 1 }, (_, i) => {
              const mintNum = Math.max(1, Math.round((i / samplePoints) * PUBLIC_SUPPLY));
              const price = getPriceForMint(Math.min(mintNum, PUBLIC_SUPPLY));
              const x = (mintNum / PUBLIC_SUPPLY) * 400;
              const y = 155 - (price / maxPrice) * 145;
              return `${x},${y}`;
            }),
            `400,160`,
          ].join(' ')}
        />

        {/* Current position marker */}
        {publicMinted > 0 && publicMinted < PUBLIC_SUPPLY && (
          <>
            <line
              x1={(publicMinted / PUBLIC_SUPPLY) * 400}
              y1={0}
              x2={(publicMinted / PUBLIC_SUPPLY) * 400}
              y2={160}
              stroke="#fff"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.4"
            />
            <circle
              cx={(publicMinted / PUBLIC_SUPPLY) * 400}
              cy={155 - (getPriceForMint(publicMinted) / maxPrice) * 145}
              r="5"
              fill="#A855F7"
              stroke="#fff"
              strokeWidth="2"
            >
              <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
            </circle>
          </>
        )}

        <defs>
          <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="30%" stopColor="#22C55E" />
            <stop offset="55%" stopColor="#3B82F6" />
            <stop offset="80%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
      </svg>

      {/* Tier labels below */}
      <div className="flex mt-1">
        {MINT_TIERS.map((tier) => {
          const width = (tier.count / PUBLIC_SUPPLY) * 100;
          return (
            <div key={tier.tier} className="text-center" style={{ width: `${width}%` }}>
              <span className={`text-[9px] font-bold`} style={{ color: tier.color }}>
                {tier.emoji} {tier.name}
              </span>
              <div className="text-[8px] text-gray-500">
                {formatNumber(tier.basePriceBTF, 0)}-{formatNumber(tier.maxPriceBTF, 0)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Axis */}
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-gray-600">#1</span>
        <span className="text-[9px] text-gray-600">#400</span>
        <span className="text-[9px] text-gray-600">#800</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  SUPPLY PROGRESS BAR (V2 — shows public + reserve)
// ═══════════════════════════════════════════════════════

function SupplyProgressBar({ publicMinted, platformMinted }: { publicMinted: number; platformMinted: number }) {
  const publicPercent = (publicMinted / PUBLIC_SUPPLY) * 100;
  const totalAll = publicMinted + platformMinted;

  return (
    <div className="relative">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-400">
          <span className="font-bold text-white">{publicMinted}</span>/{PUBLIC_SUPPLY} Public
          {platformMinted > 0 && (
            <span className="ml-2 text-amber-400">+ {platformMinted} Platform</span>
          )}
        </span>
        <span className="text-xs font-bold" style={{ color: publicPercent > 80 ? '#EF4444' : publicPercent > 50 ? '#F59E0B' : '#22C55E' }}>
          {PUBLIC_SUPPLY - publicMinted} Remaining
        </span>
      </div>
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full flex">
          {MINT_TIERS.map((tier) => {
            const segmentWidth = (tier.count / PUBLIC_SUPPLY) * 100;
            const segmentMinted = Math.min(Math.max(publicMinted - tier.startId + 1, 0), tier.count);
            const segmentPercent = (segmentMinted / tier.count) * 100;

            return (
              <div key={tier.tier} className="relative" style={{ width: `${segmentWidth}%` }}>
                <div
                  className={`h-full bg-gradient-to-r ${tier.gradient} transition-all duration-500`}
                  style={{ width: `${segmentPercent}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  4-WAY DISTRIBUTION VISUALIZATION
// ═══════════════════════════════════════════════════════

function TokenDistribution({ price }: { price: string }) {
  const priceNum = parseFloat(price) || 0;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Token Distribution per Mint</h4>
      {Object.entries(DISTRIBUTION).map(([key, dist]) => (
        <div key={key} className="flex items-center gap-3">
          <div className="w-32 text-xs text-gray-300">{dist.label}</div>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${dist.percent}%`, backgroundColor: dist.color }}
            />
          </div>
          <span className="text-xs font-mono text-gray-300 w-20 text-right">
            {formatNumber(priceNum * dist.percent / 100, 0)} BTF
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  ARTIST CARD V2 (with Value Score)
// ═══════════════════════════════════════════════════════

function ArtistCard({ artist, onSynced }: { artist: ArtistRecord; onSynced?: () => void }) {
  const [, navigate] = useLocation();
  const [syncing, setSyncing] = useState(false);
  
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/ai-social/mint-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: artist.artistName,
          genre: artist.genre,
          onChainArtistId: artist.id,
          txHash: null,
          tier: artist.tier,
          personalityPreset: 'mainstream',
          walletAddress: artist.owner,
        }),
      });
      if (res.ok) {
        onSynced?.();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };
  
  return (
    <div className={`relative p-4 rounded-xl border ${artist.isActive ? 'border-gray-700/50 bg-gray-800/50' : 'border-red-900/30 bg-red-950/20 opacity-60'}`}>
      {/* Tier badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {artist.isPlatformReserve && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
            PLATFORM
          </span>
        )}
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: artist.tierInfo.color + '20', color: artist.tierInfo.color }}
        >
          {artist.tierInfo.emoji} {artist.tierInfo.name}
        </span>
      </div>

      {/* MINT Badge */}
      <div className="absolute top-2 left-2">
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
          <Zap className="w-2.5 h-2.5" /> MINT
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3 mt-2">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${artist.tierInfo.color}80, ${artist.tierInfo.color})` }}
        >
          {artist.avatarUrl ? (
            <img src={artist.avatarUrl} alt={artist.artistName} className="w-full h-full object-cover" />
          ) : (
            <>#{artist.id}</>
          )}
          {artist.valueScore > 0 && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
              <Activity className="w-3 h-3 text-black" />
            </div>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-white text-sm">
            BTF_MINT{artist.id}_{artist.artistName}
          </h4>
          <span className="text-xs text-gray-400">{artist.genre}</span>
        </div>
      </div>

      {/* Value Score Bar */}
      {artist.valueScore > 0 && (
        <div className="mb-3 p-2 rounded-lg bg-gradient-to-r from-amber-900/20 to-purple-900/20 border border-amber-500/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Award className="w-3 h-3" /> Value Score
            </span>
            <span className="text-sm font-black text-amber-400">{artist.valueScore.toLocaleString()}</span>
          </div>
          {/* Activity breakdown */}
          <div className="grid grid-cols-4 gap-1 mt-1">
            {artist.totalSongs > 0 && (
              <div className="flex items-center gap-0.5 text-[9px] text-gray-400">
                <Music className="w-2.5 h-2.5" /> {artist.totalSongs}
              </div>
            )}
            {artist.totalVideos > 0 && (
              <div className="flex items-center gap-0.5 text-[9px] text-gray-400">
                <Video className="w-2.5 h-2.5" /> {artist.totalVideos}
              </div>
            )}
            {artist.totalCollabs > 0 && (
              <div className="flex items-center gap-0.5 text-[9px] text-gray-400">
                <Handshake className="w-2.5 h-2.5" /> {artist.totalCollabs}
              </div>
            )}
            {artist.totalInteractions > 0 && (
              <div className="flex items-center gap-0.5 text-[9px] text-gray-400">
                <Users className="w-2.5 h-2.5" /> {artist.totalInteractions}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between text-xs text-gray-500 mb-3">
        <span>
          {artist.isPlatformReserve ? 'Platform Reserve' : `Paid: ${formatNumber(artist.pricePaid, 0)} BTF`}
        </span>
        <span>{artist.mintedAt.toLocaleDateString()}</span>
      </div>

      {/* Landing Page & Social Links */}
      {artist.landingPageUrl ? (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(artist.landingPageUrl!)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white text-xs font-semibold transition-all"
          >
            <Globe className="w-3.5 h-3.5" />
            Landing Page
          </button>
          <button
            onClick={() => navigate('/social')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 text-xs font-medium transition-all border border-gray-600/30"
          >
            <Users className="w-3.5 h-3.5" />
            Social Network
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 py-2 px-3 rounded-lg bg-yellow-900/20 border border-yellow-500/10">
          <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
          <span className="text-[10px] text-yellow-400">Syncing landing page...</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN PAGE V2
// ═══════════════════════════════════════════════════════

export default function BTFArtistMintPage() {
  const { isConnected, address } = useWeb3();
  const {
    mintStats, userInfo, userArtists, loading, minting, approving,
    isCorrectChain, approveBTF, mintArtist, refresh,
    MAX_PER_WALLET: maxWallet,
  } = useBTFArtistMint();

  const [artistName, setArtistName] = useState('');
  const [genre, setGenre] = useState('reggaeton');
  const [tab, setTab] = useState<'mint' | 'gallery' | 'curve'>('mint');
  const [mintSuccess, setMintSuccess] = useState<MintSyncResult | null>(null);
  const [personalityPreset, setPersonalityPreset] = useState('mainstream');
  const [, navigate] = useLocation();

  const canAfford = useMemo(() => {
    if (!mintStats || !userInfo) return false;
    return userInfo.btfBalanceRaw >= mintStats.currentPriceRaw;
  }, [mintStats, userInfo]);

  const needsApproval = useMemo(() => {
    if (!mintStats || !userInfo) return true;
    return userInfo.btfAllowanceRaw < mintStats.currentPriceRaw;
  }, [mintStats, userInfo]);

  // Calculate next mint price for the "price after yours" preview
  const nextMintPrice = useMemo(() => {
    if (!mintStats || mintStats.isSoldOut) return null;
    const nextNum = mintStats.publicMinted + 2; // the one AFTER current
    if (nextNum > PUBLIC_SUPPLY) return null;
    return getPriceForMint(nextNum);
  }, [mintStats]);

  const handleMint = async () => {
    if (!artistName.trim()) return;
    const result = await mintArtist(artistName, genre, personalityPreset);
    if (result) {
      if (result.syncResult) {
        setMintSuccess(result.syncResult);
      }
      setArtistName('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-amber-900/10" />
        <div className="relative max-w-4xl mx-auto px-4 pt-8 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={BTF_IMG} alt="BTF" className="w-12 h-12 rounded-full" style={{ filter: 'drop-shadow(0 0 12px rgba(168,85,247,0.5))' }} />
                <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-400 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">AI Artist Mint <span className="text-xs text-purple-400 font-mono">V2</span></h1>
                <p className="text-xs text-gray-400">800 public + 200 Boostify reserved. Price increases with EVERY mint.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={refresh} className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition">
                <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <WalletConnectButton />
            </div>
          </div>

          {/* Supply Progress */}
          {mintStats && (
            <SupplyProgressBar
              publicMinted={mintStats.publicMinted}
              platformMinted={mintStats.platformMinted}
            />
          )}

          {/* Global Value Score banner */}
          {mintStats && mintStats.globalValueScore > 0 && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-amber-900/10 border border-amber-500/10">
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400">
                Global Value Score: <strong>{mintStats.globalValueScore.toLocaleString()}</strong> pts
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex gap-1 bg-gray-800/30 p-1 rounded-xl mb-6">
          {[
            { id: 'mint' as const, label: 'Mint Artist', icon: Sparkles },
            { id: 'gallery' as const, label: 'My Artists', icon: Users, count: userArtists.length },
            { id: 'curve' as const, label: 'Bonding Curve', icon: TrendingUp },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.id ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/*  MINT TAB */}
        {/* ═══════════════════════════════════════════════ */}
        {tab === 'mint' && (
          <div className="space-y-6">
            {/* Current Price Card */}
            {mintStats && (
              <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-900/20 to-gray-900/80 p-6">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -translate-y-8 translate-x-8" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Mint Price</p>
                    <div className="flex items-center gap-2">
                      <img src={BTF_IMG} alt="BTF" className="w-8 h-8 rounded-full" />
                      <span className="text-4xl font-black bg-gradient-to-r from-purple-400 to-amber-400 bg-clip-text text-transparent">
                        {formatNumber(mintStats.currentPrice, 0)}
                      </span>
                      <span className="text-lg text-gray-400 font-semibold">BTF</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {mintStats.currentTierInfo.usdEstimate} USD est.
                    </p>
                  </div>

                  <div className="text-right">
                    <span
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold"
                      style={{
                        backgroundColor: mintStats.currentTierInfo.color + '20',
                        color: mintStats.currentTierInfo.color
                      }}
                    >
                      {mintStats.currentTierInfo.emoji} {mintStats.currentTierInfo.label}
                    </span>
                    <p className="text-xs text-gray-500 mt-2">
                      Public #{mintStats.publicMinted + 1} of {PUBLIC_SUPPLY}
                    </p>
                  </div>
                </div>

                {/* Continuous price increase notice */}
                <div className="mt-4 flex gap-3">
                  {nextMintPrice && (
                    <div className="flex-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <TrendingUp className="w-3 h-3" />
                        <span>
                          Next mint: <strong>{formatNumber(nextMintPrice, 0)} BTF</strong>
                          {' '}(+{mintStats.currentTierInfo.stepIncrease} BTF)
                        </span>
                      </div>
                    </div>
                  )}
                  {mintStats.currentTier < 5 && (
                    <div className="flex-1 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center gap-2 text-xs text-purple-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>
                          {mintStats.currentTierInfo.endId - mintStats.publicMinted} left in {mintStats.currentTierInfo.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mint Form */}
            {mintSuccess ? (
              /* ═══ SUCCESS STATE — Artist Minted! ═══ */
              <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-900/20 to-gray-900/80 p-8 text-center space-y-6">
                <div className="relative inline-block">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-pulse" />
                </div>

                <div>
                  <h3 className="text-2xl font-black text-green-400 mb-2">
                    🎉 Artist Minted Successfully!
                  </h3>
                  <p className="text-gray-400">
                    <strong className="text-white">{mintSuccess.artistName}</strong> is live on-chain and on the platform
                  </p>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                  <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30">
                    <Globe className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500">Landing Page</p>
                    <p className="text-xs font-bold text-purple-400 truncate">/artist/{mintSuccess.slug}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30">
                    <Activity className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500">On-Chain ID</p>
                    <p className="text-xs font-bold text-amber-400">#{mintSuccess.blockchainArtistId || 'N/A'}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 max-w-md mx-auto">
                  <button
                    onClick={() => navigate(`/artist/${mintSuccess.slug}`)}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-black text-lg flex items-center justify-center gap-2 hover:from-purple-500 hover:to-purple-600 transition shadow-lg shadow-purple-900/30"
                  >
                    <Globe className="w-5 h-5" />
                    View Artist Landing Page
                    <ExternalLink className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => navigate('/social-network')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white font-bold flex items-center justify-center gap-2 hover:from-green-500 hover:to-emerald-600 transition"
                  >
                    <Users className="w-5 h-5" />
                    View in Social Network
                  </button>

                  <button
                    onClick={() => {
                      setMintSuccess(null);
                      setTab('gallery');
                    }}
                    className="w-full py-2.5 rounded-xl bg-gray-800/50 text-gray-300 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-700/50 transition border border-gray-700/30"
                  >
                    <Star className="w-4 h-4" />
                    View My Artists
                  </button>

                  <button
                    onClick={() => setMintSuccess(null)}
                    className="text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    Mint another artist
                  </button>
                </div>

                {/* Tx Hash */}
                <div className="flex items-center justify-center gap-2 text-[10px] text-gray-600">
                  <span>Tx: {mintSuccess.blockchainTxHash?.slice(0, 20)}...</span>
                  <a
                    href={`https://polygonscan.com/tx/${mintSuccess.blockchainTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-500 hover:text-purple-400 flex items-center gap-0.5"
                  >
                    PolygonScan <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ) : !isConnected ? (
              <div className="text-center py-12 rounded-2xl border border-gray-800 bg-gray-900/50">
                <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">Connect Wallet to Mint</h3>
                <p className="text-sm text-gray-400 mb-4">You need BTF tokens on Polygon to mint an AI Artist</p>
                <WalletConnectButton />
              </div>
            ) : mintStats?.isSoldOut ? (
              <div className="text-center py-12 rounded-2xl border border-amber-500/20 bg-amber-900/10">
                <Crown className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                <h3 className="text-xl font-black text-amber-400">PUBLIC MINT SOLD OUT</h3>
                <p className="text-sm text-gray-400 mt-2">All 800 public AI Artists have been minted!</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-700/50 bg-gray-800/30 p-6 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Create Your AI Artist
                </h3>

                {/* Artist Name */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Artist Name</label>
                  <input
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="Enter your AI artist's name..."
                    maxLength={50}
                    className="w-full px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
                  />
                </div>

                {/* Genre Selection */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Genre</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {GENRE_OPTIONS.map(g => (
                      <button
                        key={g.value}
                        onClick={() => setGenre(g.value)}
                        className={`px-2 py-2 rounded-lg text-xs font-medium transition flex flex-col items-center gap-1 ${
                          genre === g.value
                            ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        <span className="text-base">{g.emoji}</span>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personality Preset */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">AI Artist Personality</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { id: 'mainstream', emoji: '🎯', label: 'Mainstream' },
                      { id: 'rebel', emoji: '🔥', label: 'Rebel' },
                      { id: 'romantic', emoji: '💖', label: 'Romantic' },
                      { id: 'party_animal', emoji: '🎉', label: 'Party Animal' },
                      { id: 'intellectual', emoji: '🧠', label: 'Intellectual' },
                      { id: 'mysterious', emoji: '🌙', label: 'Mysterious' },
                      { id: 'aggressive', emoji: '💀', label: 'Aggressive' },
                      { id: 'chill', emoji: '☮️', label: 'Chill' },
                      { id: 'experimental', emoji: '🔬', label: 'Experimental' },
                      { id: 'wholesome', emoji: '☀️', label: 'Positive' },
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => setPersonalityPreset(p.id)}
                        className={`px-2 py-2 rounded-lg text-xs font-medium transition flex flex-col items-center gap-1 ${
                          personalityPreset === p.id
                            ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        <span className="text-base">{p.emoji}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Balance Info */}
                {userInfo && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50">
                    <div className="flex items-center gap-2">
                      <img src={BTF_IMG} alt="BTF" className="w-5 h-5 rounded-full" />
                      <span className="text-sm text-gray-300">Your Balance:</span>
                      <span className={`text-sm font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                        {formatNumber(userInfo.btfBalance)} BTF
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {userInfo.mintCount}/{maxWallet} minted
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {!canAfford && userInfo && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-xs text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      Not enough BTF. You need {mintStats ? formatNumber(mintStats.currentPrice, 0) : '?'} BTF.
                      Buy on BoostiSwap!
                    </div>
                  )}

                  {!userInfo?.canMint && userInfo && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-500/20 text-xs text-amber-400">
                      <Lock className="w-4 h-4 flex-shrink-0" />
                      You've reached the max of {maxWallet} artists per wallet
                    </div>
                  )}

                  {needsApproval && canAfford && userInfo?.canMint && (
                    <button
                      onClick={() => approveBTF(mintStats?.currentPriceRaw ? mintStats.currentPriceRaw * BigInt(10) : undefined)}
                      disabled={approving}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 transition"
                    >
                      {approving ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Approving BTF...</>
                      ) : (
                        <><Check className="w-5 h-5" /> Step 1: Approve BTF Tokens</>
                      )}
                    </button>
                  )}

                  <button
                    onClick={handleMint}
                    disabled={minting || needsApproval || !canAfford || !userInfo?.canMint || !artistName.trim() || mintStats?.isSoldOut}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 via-purple-700 to-amber-600 text-white font-black text-lg flex items-center justify-center gap-2 hover:from-purple-500 hover:via-purple-600 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-purple-900/30"
                  >
                    {minting ? (
                      <><Loader2 className="w-6 h-6 animate-spin" /> Minting on Polygon...</>
                    ) : (
                      <>
                        <Sparkles className="w-6 h-6" />
                        Mint AI Artist — {mintStats ? formatNumber(mintStats.currentPrice, 0) : '?'} BTF
                        <Zap className="w-5 h-5 text-amber-300" />
                      </>
                    )}
                  </button>
                </div>

                {/* Distribution Preview */}
                {mintStats && (
                  <div className="pt-4 border-t border-gray-800">
                    <TokenDistribution price={mintStats.currentPrice} />
                  </div>
                )}
              </div>
            )}

            {/* Stats Grid V2 */}
            {mintStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Collected', value: formatNumber(mintStats.totalCollected) + ' BTF', icon: TrendingUp, color: 'text-purple-400' },
                  { label: 'Burned (40%)', value: formatNumber(mintStats.totalBurned) + ' BTF', icon: Flame, color: 'text-red-400' },
                  { label: 'Staking (30%)', value: formatNumber(mintStats.totalToStaking) + ' BTF', icon: Shield, color: 'text-green-400' },
                  { label: 'Treasury (20%)', value: formatNumber(mintStats.totalToTreasury) + ' BTF', icon: Lock, color: 'text-blue-400' },
                ].map((stat, i) => (
                  <div key={i} className="p-3 rounded-xl bg-gray-800/30 border border-gray-700/30">
                    <stat.icon className={`w-4 h-4 ${stat.color} mb-1`} />
                    <p className="text-xs text-gray-500">{stat.label}</p>
                    <p className="text-sm font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reserve Fund + Platform Stats */}
            {mintStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-amber-900/10 border border-amber-500/10">
                  <Zap className="w-4 h-4 text-amber-400 mb-1" />
                  <p className="text-xs text-gray-500">Reserve Fund (10%)</p>
                  <p className="text-sm font-bold text-amber-400">{formatNumber(mintStats.totalToReserve)} BTF</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-900/10 border border-purple-500/10">
                  <Crown className="w-4 h-4 text-purple-400 mb-1" />
                  <p className="text-xs text-gray-500">Platform Artists</p>
                  <p className="text-sm font-bold text-purple-400">{mintStats.platformMinted}/{PLATFORM_RESERVE}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-900/10 border border-green-500/10">
                  <Activity className="w-4 h-4 text-green-400 mb-1" />
                  <p className="text-xs text-gray-500">Global Value Score</p>
                  <p className="text-sm font-bold text-green-400">{mintStats.globalValueScore.toLocaleString()} pts</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  GALLERY TAB */}
        {/* ═══════════════════════════════════════════════ */}
        {tab === 'gallery' && (
          <div className="space-y-4">
            {!isConnected ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Connect wallet to see your AI Artists</p>
              </div>
            ) : userArtists.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-gray-800 bg-gray-900/30">
                <Music className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <h3 className="font-bold text-gray-300 mb-1">No AI Artists Yet</h3>
                <p className="text-sm text-gray-500 mb-4">Mint your first AI Artist to get started!</p>
                <button onClick={() => setTab('mint')} className="px-6 py-2 rounded-lg bg-purple-600 text-white font-medium text-sm">
                  Go to Mint
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">My AI Artists ({userArtists.length})</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{userInfo?.remainingMints} mints remaining</span>
                    {userArtists.some(a => a.valueScore > 0) && (
                      <span className="text-xs text-amber-400 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        Total: {userArtists.reduce((s, a) => s + a.valueScore, 0).toLocaleString()} pts
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userArtists.map(artist => (
                    <ArtistCard key={artist.id} artist={artist} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  BONDING CURVE TAB */}
        {/* ═══════════════════════════════════════════════ */}
        {tab === 'curve' && (
          <div className="space-y-6">
            {/* Continuous Curve Chart */}
            <div className="rounded-2xl border border-gray-700/50 bg-gray-800/30 p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Continuous Bonding Curve — Price per Mint
              </h3>
              <BondingCurveChart publicMinted={mintStats?.publicMinted || 0} />
              <p className="text-xs text-gray-500 mt-3 text-center">
                Each mint increases the next price. The earlier you mint, the cheaper your AI Artist.
              </p>
            </div>

            {/* Tier Details V2 */}
            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Pricing Tiers (Continuous)
              </h3>
              {MINT_TIERS.map(tier => {
                const isCurrent = mintStats ? (mintStats.publicMinted >= tier.startId - 1 && mintStats.publicMinted < tier.endId) : false;
                const isPast = mintStats ? mintStats.publicMinted >= tier.endId : false;
                const mintedInTier = mintStats ? Math.min(Math.max(mintStats.publicMinted - tier.startId + 1, 0), tier.count) : 0;

                return (
                  <div
                    key={tier.tier}
                    className={`p-4 rounded-xl border transition ${
                      isCurrent ? 'border-purple-500/50 bg-purple-900/20 ring-1 ring-purple-500/30' :
                      isPast ? 'border-gray-800 bg-gray-900/30 opacity-60' :
                      'border-gray-700/30 bg-gray-800/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{tier.emoji}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold" style={{ color: tier.color }}>{tier.label}</span>
                            {isCurrent && <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">ACTIVE</span>}
                            {isPast && <span className="text-[10px] bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full">SOLD</span>}
                          </div>
                          <p className="text-xs text-gray-500">Public #{tier.startId} — #{tier.endId} ({tier.count} artists)</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5">
                          <img src={BTF_IMG} alt="BTF" className="w-4 h-4 rounded-full" />
                          <span className="font-bold text-lg" style={{ color: tier.color }}>
                            {formatNumber(tier.basePriceBTF, 0)}
                          </span>
                          <span className="text-xs text-gray-400">BTF</span>
                        </div>
                        <p className="text-[10px] text-amber-400 font-mono">+{tier.stepIncrease} BTF/mint</p>
                        <p className="text-[10px] text-gray-500">Max: {formatNumber(tier.maxPriceBTF, 0)} BTF</p>
                      </div>
                    </div>

                    {(isCurrent || isPast) && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${tier.gradient}`}
                            style={{ width: `${(mintedInTier / tier.count) * 100}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">{mintedInTier}/{tier.count} minted</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Activity Score Info */}
            <div className="rounded-2xl border border-green-500/20 bg-green-900/10 p-6">
              <h3 className="font-bold text-green-400 mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Artist Activity Score
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Each AI Artist earns activity points on-chain as it creates content. More activity = higher engagement score.
                This reflects creative output, not financial value.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(ACTIVITY_VALUES).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50">
                    <span className="text-lg">{val.emoji}</span>
                    <div>
                      <span className="text-xs font-semibold text-white">{val.label}</span>
                      <p className="text-[10px] text-green-400 font-mono">+{val.points} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* How This Model Works V2 */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-900/10 p-6">
              <h3 className="font-bold text-amber-400 mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                How the Activation System Works
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: 'Demand-Based Activation Cost', desc: 'Each activation slightly increases the next cost — reflects platform demand, not investment' },
                  { title: '40% Credits Burned', desc: '40% permanently consumed → reduces circulating supply with each service use' },
                  { title: 'Boostify Reserve', desc: '200 reserved artists → Boostify actively uses and supports the system' },
                  { title: '4-Way Credit Split', desc: '40% burn + 30% service tier + 20% treasury + 10% reserve fund' },
                  { title: 'Activity Score', desc: 'Artists earn engagement points as they create music, videos, and collabs' },
                  { title: 'Real Scarcity', desc: 'Only 800 public activations — first cost 2,000 BTF Credits, last cost 31,850 BTF Credits' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-semibold text-white">{item.title}</span>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4 border-t border-gray-700/40 pt-3">
                BTF Credits are used only to access and activate digital services inside Boostify.
                They do not represent equity, royalties, revenue share, dividends, or investment returns.
              </p>
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="h-24" />
      </div>
    </div>
  );
}
