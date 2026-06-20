import { useEffect, useRef, useState } from "react";
import {
  getLiveOfferTerms,
  countdownParts,
  fmtUsdCents,
  fmtUsdMillions,
  fmtPct,
  type LiveOfferTerms,
} from "../../lib/investor-offer";

/**
 * Real-time hook: recomputes the interpolated offer terms on a fast interval so
 * the decimals tick continuously. ~80ms ≈ 12 fps, smooth without thrashing.
 */
export function useLiveOfferTerms(intervalMs = 80): LiveOfferTerms {
  const [terms, setTerms] = useState<LiveOfferTerms>(() => getLiveOfferTerms());
  useEffect(() => {
    const id = window.setInterval(() => setTerms(getLiveOfferTerms()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return terms;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function StatCard({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="p-3 sm:p-4 bg-black/40 rounded-xl border border-orange-500/30">
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

/**
 * Drop-in replacement for the static 4-card offer grid + a live countdown to the
 * next tranche. All numbers move in real time (interpolated with decimals).
 */
export function DynamicOfferTerms() {
  const terms = useLiveOfferTerms();
  const { days, hours, minutes, seconds, fraction } = countdownParts(terms.msToNext);

  // Flash the cards briefly whenever the active tranche flips.
  const prevTier = useRef(terms.current.id);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prevTier.current !== terms.current.id) {
      prevTier.current = terms.current.id;
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 1200);
      return () => window.clearTimeout(t);
    }
  }, [terms.current.id]);

  return (
    <div className={flash ? "animate-pulse" : ""}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 max-w-3xl mx-auto mb-4 sm:mb-6">
        <StatCard value={fmtUsdCents(terms.minTicketUsd)} label="Min Ticket / Investor" color="text-orange-400" />
        <StatCard value={fmtUsdMillions(terms.postMoneyUsd)} label="Post-Money Valuation" color="text-yellow-400" />
        <StatCard value={fmtPct(terms.equityPct)} label="Total Equity Dilution" color="text-green-400" />
        <StatCard value={terms.instrument} label="Instrument Type" color="text-cyan-400" />
      </div>

      {terms.next && (
        <div className="max-w-3xl mx-auto mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 px-4 py-3 bg-black/40 rounded-xl border border-yellow-500/30">
            <span className="text-xs sm:text-sm font-semibold text-yellow-300">
              ⚡ Terms tighten to {fmtPct(terms.next.equityPct, 1)} equity ·{" "}
              {fmtUsdMillions(terms.next.minTicketUsd)} min ticket in
            </span>
            <span className="font-mono text-base sm:text-lg font-bold text-white tabular-nums">
              {days}d {pad(hours)}h {pad(minutes)}m {pad(seconds)}
              <span className="text-yellow-400">.{pad(Math.floor(fraction * 100))}</span>s
            </span>
          </div>
          <p className="text-center text-[10px] sm:text-xs text-gray-500 mt-2">
            Live terms reflect the {terms.current.label}. Pricing moves continuously until the next tranche. Binding
            terms are those in your executed SAFE at signature.
          </p>
        </div>
      )}
    </div>
  );
}
