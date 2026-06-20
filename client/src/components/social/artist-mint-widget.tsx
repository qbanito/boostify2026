/**
 * ArtistMintWidget — Compact on-chain AI Artist Minting widget
 * Embedded in the Social Network sidebar for seamless integration.
 *
 * Features:
 * - Live bonding curve mini-chart
 * - Current price + tier display
 * - Quick mint form (name + genre)
 * - Approve → Mint flow
 * - On-chain stats (minted, remaining, burned)
 * - Link to full /btf-artist-mint page
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useBTFArtistMint, type ArtistRecord } from '../../hooks/use-btf-artist-mint';
import { useWeb3 } from '../../hooks/use-web3';
import {
  MINT_TIERS, PUBLIC_SUPPLY, MAX_PER_WALLET,
  getPriceForMint, DISTRIBUTION, type MintTier,
} from '../../lib/btf-artist-mint-config';
import { BTF_TOKEN_META } from '../../lib/btf-token-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { BuyBTFButton, NeedBTFBanner } from '../boostiswap/buy-btf-widget';
import {
  Flame, TrendingUp, Sparkles, Zap, Lock, Shield, Music,
  Loader2, ChevronRight, Crown, Star, Check, AlertCircle,
  Hexagon, ArrowRight
} from 'lucide-react';

const BTF_IMG = BTF_TOKEN_META.image;

function fmt(n: string | number, d = 1): string {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '0';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(d) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(d) + 'K';
  return v.toFixed(d);
}

// ── Genre options (compact) ──
const GENRES = [
  { value: 'reggaeton', emoji: '🎤' },
  { value: 'trap', emoji: '💀' },
  { value: 'pop', emoji: '⭐' },
  { value: 'hip-hop', emoji: '🎧' },
  { value: 'r&b', emoji: '💜' },
  { value: 'electronic', emoji: '🎹' },
  { value: 'rock', emoji: '🎸' },
  { value: 'latin-pop', emoji: '🌴' },
  { value: 'afrobeats', emoji: '🥁' },
  { value: 'indie', emoji: '🌻' },
];

// ── Mini Bonding Curve ──
function MiniBondingCurve({ publicMinted }: { publicMinted: number }) {
  const points = useMemo(() => {
    const pts: string[] = [];
    const samples = 20;
    const maxP = MINT_TIERS[4].maxPriceBTF;
    for (let i = 0; i <= samples; i++) {
      const mintNum = Math.max(1, Math.round((i / samples) * PUBLIC_SUPPLY));
      const price = getPriceForMint(Math.min(mintNum, PUBLIC_SUPPLY));
      const x = (i / samples) * 100;
      const y = 100 - (price / maxP) * 90;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, []);

  const progressX = (publicMinted / PUBLIC_SUPPLY) * 100;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-16" preserveAspectRatio="none">
      {/* Tier regions */}
      {MINT_TIERS.map((tier, i) => {
        const x1 = ((tier.startId - 1) / PUBLIC_SUPPLY) * 100;
        const x2 = (tier.endId / PUBLIC_SUPPLY) * 100;
        return (
          <rect key={i} x={x1} y={0} width={x2 - x1} height={100} fill={tier.color} opacity={0.06} />
        );
      })}
      {/* Progress fill */}
      <rect x={0} y={0} width={progressX} height={100} fill="url(#miniGrad)" opacity={0.15} />
      {/* Curve line */}
      <polyline points={points} fill="none" stroke="url(#miniGrad)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {/* Current position */}
      {publicMinted > 0 && (
        <circle cx={progressX} cy={100 - (getPriceForMint(publicMinted) / MINT_TIERS[4].maxPriceBTF) * 90} r="3" fill="#f97316" stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      )}
      <defs>
        <linearGradient id="miniGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Minted Artist Mini Card (appears after mint) ──
function MintedArtistMiniCard({ artist }: { artist: ArtistRecord }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r ${artist.tierInfo.gradient} bg-opacity-10 border border-white/10`}
    >
      <div className="relative">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${artist.tierInfo.gradient} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
          {artist.artistName.charAt(0).toUpperCase()}
        </div>
        <span className="absolute -top-1 -right-1 text-xs">{artist.tierInfo.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{artist.artistName}</p>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span>{artist.tierInfo.name}</span>
          <span>•</span>
          <span>{artist.genre}</span>
          {artist.valueScore > 0 && (
            <>
              <span>•</span>
              <span className="text-yellow-400">⚡ {artist.valueScore}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-[10px] text-green-400 font-medium">
          <Check className="h-2.5 w-2.5" /> On-chain
        </span>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN WIDGET
// ═══════════════════════════════════════════════════════

export function ArtistMintWidget() {
  const { isConnected } = useWeb3();
  const {
    mintStats, userInfo, userArtists,
    approveBTF, mintArtist,
    minting, approving, refresh,
  } = useBTFArtistMint();

  const [showMintForm, setShowMintForm] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [genre, setGenre] = useState('reggaeton');
  const [justMinted, setJustMinted] = useState(false);
  const [lastMintResult, setLastMintResult] = useState<{ slug?: string; artistName?: string } | null>(null);

  const pm = mintStats?.publicMinted || 0;
  const price = mintStats?.currentPrice || '0';
  const tierInfo = mintStats?.currentTierInfo || MINT_TIERS[0];
  const isSoldOut = mintStats?.isSoldOut || false;
  const canMint = userInfo?.canMint && !isSoldOut;
  const needsApproval = userInfo && !userInfo.hasApproved;

  const handleMint = async () => {
    if (!artistName.trim()) return;
    const result = await mintArtist(artistName, genre);
    if (result) {
      setJustMinted(true);
      if (result.syncResult) {
        setLastMintResult({ slug: result.syncResult.slug, artistName: result.syncResult.artistName });
      }
      setArtistName('');
      setShowMintForm(false);
      setTimeout(() => setJustMinted(false), 10000);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-950/50 via-slate-900/80 to-orange-950/30 border-purple-500/20 backdrop-blur-sm overflow-hidden relative">
      {/* Animated glow */}
      <motion.div
        className="absolute top-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"
        animate={{ x: [-20, 20, -20], y: [-10, 10, -10] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-32 h-32 bg-orange-500/8 rounded-full blur-3xl pointer-events-none"
        animate={{ x: [10, -10, 10] }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      <CardHeader className="pb-2 relative">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            >
              <Hexagon className="h-5 w-5 text-purple-400" />
            </motion.div>
            <span className="bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-transparent text-base font-bold">
              Mint AI Artist
            </span>
          </div>
          {!isSoldOut && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              LIVE
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-gray-500 text-xs">
          On-chain AI Artists with BTF tokens
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 relative">
        {/* Mini Bonding Curve */}
        <div className="bg-slate-900/50 rounded-xl p-2 border border-slate-700/30">
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1 px-1">
            <span>Bonding Curve</span>
            <span>{pm}/{PUBLIC_SUPPLY} minted</span>
          </div>
          <MiniBondingCurve publicMinted={pm} />
          {/* Tier labels */}
          <div className="flex justify-between mt-1">
            {MINT_TIERS.map((t, i) => (
              <span key={i} className="text-[8px]" style={{ color: t.color, opacity: t.tier === tierInfo.tier ? 1 : 0.4 }}>
                {t.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* Current Price + Tier */}
        <div className="flex items-center justify-between bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Next Mint Price</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <img src={BTF_IMG} alt="BTF" className="w-4 h-4 rounded" />
              <span className="text-xl font-bold text-white">{fmt(price)}</span>
              <span className="text-xs text-orange-400">BTF</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r ${tierInfo.gradient} text-white text-xs font-semibold`}>
              {tierInfo.emoji} {tierInfo.name}
            </span>
            <p className="text-[10px] text-gray-500 mt-1">
              Tier {tierInfo.tier}/5
            </p>
          </div>
        </div>

        {/* Distribution mini-bar */}
        <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
          <div className="bg-red-500" style={{ width: `${DISTRIBUTION.burn.percent}%` }} title="Burn 40%" />
          <div className="bg-green-500" style={{ width: `${DISTRIBUTION.staking.percent}%` }} title="Staking 30%" />
          <div className="bg-blue-500" style={{ width: `${DISTRIBUTION.treasury.percent}%` }} title="Treasury 20%" />
          <div className="bg-yellow-500" style={{ width: `${DISTRIBUTION.reserve.percent}%` }} title="Reserve 10%" />
        </div>
        <div className="flex justify-between text-[8px] text-gray-600 -mt-2">
          <span>🔥40%</span><span>💰30%</span><span>🏦20%</span><span>🏗️10%</span>
        </div>

        {/* User's Minted Artists */}
        {userArtists.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Your AI Artists</p>
            {userArtists.slice(0, 3).map(a => (
              <MintedArtistMiniCard key={a.id} artist={a} />
            ))}
            {userArtists.length > 3 && (
              <p className="text-[10px] text-gray-500 text-center">+{userArtists.length - 3} more</p>
            )}
          </div>
        )}

        {/* Success flash */}
        <AnimatePresence>
          {justMinted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-green-500/20 border border-green-500/30 rounded-xl p-3 text-center space-y-2"
            >
              <Sparkles className="h-5 w-5 mx-auto text-green-400 mb-1" />
              <p className="text-sm font-semibold text-green-400">
                {lastMintResult?.artistName ? `${lastMintResult.artistName} Minted!` : 'Artist Minted!'}
              </p>
              <p className="text-[10px] text-gray-400">On-chain on Polygon + AI active</p>
              {lastMintResult?.slug && (
                <Link href={`/artist/${lastMintResult.slug}`}>
                  <span className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 cursor-pointer mt-1">
                    🌐 View Landing Page →
                  </span>
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mint Actions */}
        {!isConnected ? (
          <div className="text-center space-y-2 py-2">
            <p className="text-xs text-gray-400">Connect wallet to mint AI Artists</p>
            <Link href="/btf-wallet">
              <motion.span
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-orange-500 text-white px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
              >
                <img src={BTF_IMG} alt="BTF" className="h-3 w-3" />
                Connect Wallet
              </motion.span>
            </Link>
          </div>
        ) : isSoldOut ? (
          <div className="text-center py-2">
            <Crown className="h-6 w-6 mx-auto text-yellow-400 mb-1" />
            <p className="text-sm font-semibold text-yellow-400">All {PUBLIC_SUPPLY} Artists Minted!</p>
            <p className="text-[10px] text-gray-500">Public supply is sold out</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Toggle mint form */}
            {!showMintForm ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setShowMintForm(true)}
                  disabled={!canMint}
                  className="w-full bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 text-white shadow-lg shadow-purple-500/20 font-semibold text-sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Mint AI Artist ({fmt(price)} BTF)
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {/* Artist Name */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Artist Name</label>
                  <input
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="Enter AI artist name..."
                    className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50"
                    maxLength={32}
                    disabled={minting}
                  />
                </div>

                {/* Genre Selector */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Genre</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {GENRES.map(g => (
                      <button
                        key={g.value}
                        onClick={() => setGenre(g.value)}
                        className={`p-1.5 rounded-lg text-center text-xs transition-all ${
                          genre === g.value
                            ? 'bg-purple-500/30 border border-purple-500/50 text-white'
                            : 'bg-slate-800/50 border border-slate-700/30 text-gray-500 hover:bg-slate-800 hover:text-gray-300'
                        }`}
                        disabled={minting}
                        title={g.value}
                      >
                        <span className="text-sm">{g.emoji}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 capitalize">{genre}</p>
                </div>

                {/* Approve / Mint buttons */}
                {needsApproval ? (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={() => approveBTF()}
                      disabled={approving}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm"
                    >
                      {approving ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Approving...</>
                      ) : (
                        <><Lock className="h-4 w-4 mr-2" /> Approve BTF</>
                      )}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={handleMint}
                      disabled={minting || !artistName.trim()}
                      className="w-full bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 text-white shadow-lg shadow-purple-500/20 text-sm font-semibold"
                    >
                      {minting ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Minting on Polygon...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> Mint for {fmt(price)} BTF</>
                      )}
                    </Button>
                  </motion.div>
                )}

                {/* Cancel */}
                <button
                  onClick={() => setShowMintForm(false)}
                  className="w-full text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            )}

            {/* Need BTF? */}
            {userInfo && parseFloat(userInfo.btfBalance) < parseFloat(price) && (
              <NeedBTFBanner
                requiredAmount={fmt(price)}
                currentBalance={fmt(userInfo.btfBalance)}
              />
            )}

            {/* User mint count */}
            {userInfo && (
              <p className="text-[10px] text-gray-500 text-center">
                {userInfo.mintCount}/{MAX_PER_WALLET} minted • Balance: {fmt(userInfo.btfBalance)} BTF
              </p>
            )}
          </div>
        )}

        {/* Burned stats */}
        {mintStats && (
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-slate-900/50 rounded-lg p-2 text-center border border-slate-700/20">
              <Flame className="h-3 w-3 mx-auto text-red-400 mb-0.5" />
              <p className="text-xs font-semibold text-white">{fmt(mintStats.totalBurned)}</p>
              <p className="text-[8px] text-gray-600">Burned</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2 text-center border border-slate-700/20">
              <TrendingUp className="h-3 w-3 mx-auto text-green-400 mb-0.5" />
              <p className="text-xs font-semibold text-white">{fmt(mintStats.totalToStaking)}</p>
              <p className="text-[8px] text-gray-600">Staking</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2 text-center border border-slate-700/20">
              <Zap className="h-3 w-3 mx-auto text-yellow-400 mb-0.5" />
              <p className="text-xs font-semibold text-white">{mintStats.globalValueScore}</p>
              <p className="text-[8px] text-gray-600">Value Score</p>
            </div>
          </div>
        )}

        {/* Link to full page */}
        <Link href="/btf-artist-mint">
          <motion.div
            whileHover={{ x: 3 }}
            className="flex items-center justify-between text-xs text-purple-400 hover:text-purple-300 transition-colors cursor-pointer pt-1"
          >
            <span className="flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3" />
              Full Minting Dashboard
            </span>
            <ChevronRight className="h-3 w-3" />
          </motion.div>
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * MintedArtistBadge — Small badge to indicate an artist is minted on-chain
 * Use in artist profile cards across the social network.
 */
export function MintedArtistBadge({ tier, valueScore }: { tier?: MintTier; valueScore?: number }) {
  if (!tier) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gradient-to-r ${tier.gradient} text-white shadow-sm`}>
      {tier.emoji} {tier.name}
      {(valueScore != null && valueScore > 0) && (
        <span className="opacity-80">⚡{valueScore}</span>
      )}
    </span>
  );
}
