import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, X, Timer, Zap, PartyPopper } from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useSpotifyBoostLimits } from "../../hooks/use-spotify-boost-limits";

interface Props { onUpgrade: () => void; }

export function SpotifySubscriptionBanner({ onUpgrade }: Props) {
  const { plan, totalUsed, totalLimit } = useSpotifyBoostLimits();
  const [dismissed, setDismissed] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (plan !== "free") return;
    const t = setInterval(() => setCountdown(c => (c <= 1 ? 60 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [plan]);

  if (plan !== "free" || dismissed) return null;

  const pct = Math.min((totalUsed / totalLimit) * 100, 100);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
        className="relative rounded-xl border border-green-500/30 bg-gradient-to-r from-green-950/60 via-emerald-950/40 to-green-950/60 p-4 mb-4">
        <button onClick={() => setDismissed(true)} className="absolute top-2 right-2 text-muted-foreground hover:text-white">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center">
              <SiSpotify className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> Spotify Boost Pro
              </p>
              <p className="text-[11px] text-green-300/70">Standalone tool — no full suite required</p>
            </div>
          </div>

          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/20 text-[10px] gap-1">
            <PartyPopper className="w-3 h-3" /> Limited Time Offer
          </Badge>

          <div className="flex-1 min-w-[120px]">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Daily usage</span>
              <span>{totalUsed}/{totalLimit}</span>
            </div>
            <div className="h-1.5 bg-green-950 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all bg-gradient-to-r from-green-500 to-emerald-400"
                style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-green-300/60">
              <Timer className="w-3 h-3" />{countdown}s
            </div>
            <Button size="sm" onClick={onUpgrade}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs h-8 gap-1">
              <Zap className="w-3 h-3" /> Upgrade — $12/mo
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
