// ============================================================================
// Investor Offer Engine — time-based dynamic SAFE terms
// ----------------------------------------------------------------------------
// The funding offer gets progressively more expensive as time passes, rewarding
// early investors. Each tranche has a start date; between two tranches the
// numbers interpolate smoothly (continuously), so the live counter shows
// decimals ticking in real time:
//   - minTicketUsd  rises   (entry gets pricier)
//   - equityPct     falls   (less equity offered for the same money)
//   - postMoneyUsd  rises   (valuation climbs)
//
// IMPORTANT (legal): the binding terms are those captured in the executed SAFE
// at signature time. This engine drives the *displayed* / marketing terms and
// the snapshot that should be frozen onto an investor record when they sign.
// ============================================================================

export interface OfferTier {
  id: string;
  label: string;
  startsAt: string; // ISO date — when this tranche becomes effective
  minTicketUsd: number;
  equityPct: number;
  postMoneyUsd: number;
  instrument: string;
}

// Source of truth for the tranches. Edit dates/values here (Phase 1 = frontend).
export const OFFER_TIERS: OfferTier[] = [
  {
    id: "founder",
    label: "Founder Round",
    startsAt: "2026-06-20T00:00:00.000Z",
    minTicketUsd: 1_500_000,
    equityPct: 3.5,
    postMoneyUsd: 42_900_000,
    instrument: "SAFE",
  },
  {
    id: "q4-2026",
    label: "Q4 2026 Tranche",
    startsAt: "2026-10-01T00:00:00.000Z",
    minTicketUsd: 2_000_000,
    equityPct: 3.0,
    postMoneyUsd: 57_000_000,
    instrument: "SAFE",
  },
  {
    id: "2027",
    label: "2027 Tranche",
    startsAt: "2027-06-20T00:00:00.000Z",
    minTicketUsd: 2_500_000,
    equityPct: 2.5,
    postMoneyUsd: 80_000_000,
    instrument: "SAFE",
  },
  {
    id: "2028",
    label: "2028 Tranche",
    startsAt: "2028-06-20T00:00:00.000Z",
    minTicketUsd: 3_500_000,
    equityPct: 2.0,
    postMoneyUsd: 120_000_000,
    instrument: "SAFE",
  },
];

export interface LiveOfferTerms {
  /** The tranche currently in effect. */
  current: OfferTier;
  /** The next tranche (null if on the last one). */
  next: OfferTier | null;
  /** 0..1 progress between current.startsAt and next.startsAt. */
  progress: number;
  /** Smoothly interpolated values for *right now* (with decimals). */
  minTicketUsd: number;
  equityPct: number;
  postMoneyUsd: number;
  instrument: string;
  /** Milliseconds until the next tranche (0 if none / already there). */
  msToNext: number;
}

function ts(iso: string): number {
  return new Date(iso).getTime();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Compute the live, interpolated offer terms for a given moment.
 * @param now milliseconds since epoch (defaults to Date.now()).
 * @param interpolate when false, values "step" at each tranche date instead of
 *        sliding continuously. Default true (decimals tick in real time).
 */
export function getLiveOfferTerms(
  now: number = Date.now(),
  interpolate: boolean = true,
): LiveOfferTerms {
  const tiers = [...OFFER_TIERS].sort((a, b) => ts(a.startsAt) - ts(b.startsAt));

  // Before the first tranche opens, clamp to the first tranche.
  if (now <= ts(tiers[0].startsAt)) {
    const first = tiers[0];
    const next = tiers[1] ?? null;
    return {
      current: first,
      next,
      progress: 0,
      minTicketUsd: first.minTicketUsd,
      equityPct: first.equityPct,
      postMoneyUsd: first.postMoneyUsd,
      instrument: first.instrument,
      msToNext: next ? ts(next.startsAt) - now : 0,
    };
  }

  // Find the active tranche (last one whose start <= now).
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (ts(tiers[i].startsAt) <= now) idx = i;
  }
  const current = tiers[idx];
  const next = tiers[idx + 1] ?? null;

  // Last tranche — values are static.
  if (!next) {
    return {
      current,
      next: null,
      progress: 1,
      minTicketUsd: current.minTicketUsd,
      equityPct: current.equityPct,
      postMoneyUsd: current.postMoneyUsd,
      instrument: current.instrument,
      msToNext: 0,
    };
  }

  const startMs = ts(current.startsAt);
  const endMs = ts(next.startsAt);
  const span = Math.max(1, endMs - startMs);
  const progress = Math.min(1, Math.max(0, (now - startMs) / span));
  const t = interpolate ? progress : 0;

  return {
    current,
    next,
    progress,
    minTicketUsd: lerp(current.minTicketUsd, next.minTicketUsd, t),
    equityPct: lerp(current.equityPct, next.equityPct, t),
    postMoneyUsd: lerp(current.postMoneyUsd, next.postMoneyUsd, t),
    instrument: current.instrument,
    msToNext: endMs - now,
  };
}

/** Snapshot to freeze onto an investor record at signature time. */
export function snapshotOfferTerms(now: number = Date.now()) {
  const live = getLiveOfferTerms(now, true);
  return {
    tierId: live.current.id,
    tierLabel: live.current.label,
    minTicketUsd: Math.round(live.minTicketUsd),
    equityPct: Number(live.equityPct.toFixed(4)),
    postMoneyUsd: Math.round(live.postMoneyUsd),
    instrument: live.instrument,
    capturedAt: new Date(now).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** $1,502,347.82 — full dollars with cents (for the live ticking ticket). */
export function fmtUsdCents(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** $42.913M — compact millions with 3 decimals (live valuation). */
export function fmtUsdMillions(n: number): string {
  return `$${(n / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}M`;
}

/** 3.4928% — equity with 4 decimals (live dilution). */
export function fmtPct(n: number, decimals = 4): string {
  return `${n.toFixed(decimals)}%`;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Fractional seconds (e.g. 0.382) for sub-second decimal display. */
  fraction: number;
}

export function countdownParts(ms: number): CountdownParts {
  const clamped = Math.max(0, ms);
  const totalSeconds = clamped / 1000;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const fraction = totalSeconds - Math.floor(totalSeconds);
  return { days, hours, minutes, seconds, fraction };
}
