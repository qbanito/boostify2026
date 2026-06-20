/**
 * SongBoostWidget — Pay BTF to boost your songs on the Boostify platform
 * 
 * 4 Tiers:
 *   Mini (25 BTF)   → 1K+ reach, 24h
 *   Radio (100 BTF) → 10K+ reach, 7 days
 *   Homepage (250 BTF) → 50K+ impressions, 3 days 
 *   Viral (500 BTF) → 100K+ impressions, 14 days
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Flame, Zap, Radio, Home, Rocket, CheckCircle, TrendingUp, Music, Users } from 'lucide-react';
import { BTFPaymentModal, ServicePriceTag } from './btf-payment-modal';
import { useBTFPayment, type PaymentResult } from '@/hooks/use-btf-payment';
import { SONG_BOOST_TIERS, type BTFServiceId } from '@/lib/btf-service-pricing';

interface SongBoostWidgetProps {
  songId?: string;
  songName?: string;
  artistName?: string;
  onBoostSuccess?: (boostTier: string, result: PaymentResult) => void;
  compact?: boolean;
}

const TIER_ICONS = {
  song_boost_mini: Zap,
  song_boost_radio: Radio,
  song_boost_homepage: Home,
  song_boost_viral: Rocket,
};

export function SongBoostWidget({
  songId,
  songName = 'Your Song',
  artistName,
  onBoostSuccess,
  compact = false,
}: SongBoostWidgetProps) {
  const [selectedBoost, setSelectedBoost] = useState<BTFServiceId | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [boosted, setBoosted] = useState<string | null>(null);
  const { userTier, getPrice } = useBTFPayment();

  const handleBoostSuccess = (result: PaymentResult) => {
    const tier = SONG_BOOST_TIERS.find(t => t.id === selectedBoost);
    setBoosted(tier?.name || 'Boosted');
    setShowModal(false);
    onBoostSuccess?.(tier?.name || '', result);
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Flame className="w-4 h-4 text-orange-400" />
          Boost Song
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SONG_BOOST_TIERS.map((tier) => {
            const pricing = getPrice(tier.id);
            const Icon = TIER_ICONS[tier.id as keyof typeof TIER_ICONS] || Zap;
            return (
              <button
                key={tier.id}
                onClick={() => { setSelectedBoost(tier.id); setShowModal(true); }}
                className={`bg-gradient-to-r ${tier.color} rounded-lg p-2 text-left text-xs hover:brightness-110 transition-all`}
              >
                <div className="flex items-center gap-1 font-bold text-white">
                  <Icon className="w-3 h-3" /> {tier.name}
                </div>
                <div className="text-white/70 mt-0.5">
                  {pricing.isFree ? 'FREE' : `${tier.priceBTF} BTF`}
                </div>
              </button>
            );
          })}
        </div>

        {selectedBoost && (
          <BTFPaymentModal
            serviceId={selectedBoost}
            open={showModal}
            onClose={() => setShowModal(false)}
            onSuccess={handleBoostSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-black/90 to-purple-900/20 border-orange-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <Flame className="w-5 h-5 text-orange-400" />
          Boost Your Song
        </CardTitle>
        {songName && (
          <p className="text-sm text-gray-400">
            <Music className="w-3 h-3 inline mr-1" />
            {songName} {artistName && <span>by {artistName}</span>}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Boosted Badge */}
        {boosted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-400">Song Boosted!</p>
              <p className="text-xs text-gray-400">{boosted} active</p>
            </div>
          </motion.div>
        )}

        {/* Boost Tiers */}
        <div className="space-y-2">
          {SONG_BOOST_TIERS.map((tier, i) => {
            const pricing = getPrice(tier.id);
            const Icon = TIER_ICONS[tier.id as keyof typeof TIER_ICONS] || Zap;
            const isSelected = selectedBoost === tier.id;

            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <button
                  onClick={() => { setSelectedBoost(tier.id); setShowModal(true); }}
                  className={`w-full bg-gradient-to-r ${tier.color} rounded-xl p-3 text-left hover:brightness-110 transition-all group`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{tier.name}</p>
                        <p className="text-white/60 text-xs">{tier.reach} • {tier.duration}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {pricing.isFree ? (
                        <span className="text-sm font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">FREE</span>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-white">{tier.priceBTF} BTF</p>
                          {pricing.discountPercent > 0 && (
                            <p className="text-xs text-white/50 line-through">{pricing.basePrice} BTF</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tier.features.map((f, j) => (
                      <span key={j} className="text-[10px] bg-white/10 text-white/80 px-1.5 py-0.5 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-purple-400 mb-1" />
            <p className="text-xs text-gray-400">Avg. Reach</p>
            <p className="text-sm font-bold text-white">+340%</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <Users className="w-4 h-4 mx-auto text-blue-400 mb-1" />
            <p className="text-xs text-gray-400">New Fans</p>
            <p className="text-sm font-bold text-white">+2.1K avg</p>
          </div>
        </div>

        {/* Tier discount notice */}
        {userTier !== 'None' && (
          <p className="text-xs text-center text-emerald-400">
            ✨ {userTier} tier — {userTier === 'Platinum' ? 'Mini & Radio boosts are FREE' : `${getPrice('song_boost_mini').discountPercent}% discount applied`}
          </p>
        )}
      </CardContent>

      {selectedBoost && (
        <BTFPaymentModal
          serviceId={selectedBoost}
          open={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleBoostSuccess}
        />
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SongBoostBadge — Small badge showing active boost
// ═══════════════════════════════════════════════════════

interface SongBoostBadgeProps {
  boostTier: 'mini' | 'radio' | 'homepage' | 'viral';
  className?: string;
}

export function SongBoostBadge({ boostTier, className = '' }: SongBoostBadgeProps) {
  const config = {
    mini: { icon: '⚡', label: 'Boosted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    radio: { icon: '📻', label: 'On Radio', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    homepage: { icon: '🏠', label: 'Featured', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    viral: { icon: '🚀', label: 'Viral', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  };

  const c = config[boostTier];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${c.color} ${className}`}>
      {c.icon} {c.label}
    </span>
  );
}
