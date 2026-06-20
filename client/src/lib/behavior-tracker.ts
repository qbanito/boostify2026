/**
 * Behavior Tracker — Passive UI interaction observer
 * 
 * Detects usage patterns to suggest a visual style preset.
 * - Click speed (fast/moderate/slow)
 * - Navigation frequency (explorer/focused/power-user)
 * - Session duration (short/medium/long)
 * - Time of day
 * 
 * Only active when user opts in (autoAdapt: true in settings).
 * Stores only aggregated metrics, never content or PII.
 */

import { useEffect, useRef, useCallback } from "react";
import { useSettingsStore } from "../store/settings-store";
import type { PresetId } from "./theme-presets";

interface BehaviorMetrics {
  clickTimestamps: number[];      // last 50 click times
  pageChanges: number;            // page navigations this session
  sessionStart: number;           // when this session started
  scrollDepths: number[];         // scroll % on pages (last 20)
}

const STORAGE_KEY = "boostify-behavior-metrics";

function getStoredMetrics(): BehaviorMetrics {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    clickTimestamps: [],
    pageChanges: 0,
    sessionStart: Date.now(),
    scrollDepths: [],
  };
}

function storeMetrics(m: BehaviorMetrics) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {}
}

/** Analyze metrics and suggest a preset */
export function analyzeAndSuggest(metrics: BehaviorMetrics): PresetId | null {
  const sessionMinutes = (Date.now() - metrics.sessionStart) / 60000;
  const hour = new Date().getHours();

  // Click speed analysis
  let avgClickGap = 0;
  if (metrics.clickTimestamps.length > 2) {
    const gaps: number[] = [];
    for (let i = 1; i < metrics.clickTimestamps.length; i++) {
      gaps.push(metrics.clickTimestamps[i] - metrics.clickTimestamps[i - 1]);
    }
    avgClickGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  const clickSpeed: "fast" | "moderate" | "slow" =
    avgClickGap < 1500 ? "fast" : avgClickGap < 4000 ? "moderate" : "slow";

  // Navigation pattern
  const navRate = metrics.pageChanges / Math.max(sessionMinutes, 1);
  const navPattern: "explorer" | "focused" | "power-user" =
    navRate > 3 ? "power-user" : navRate > 1 ? "explorer" : "focused";

  // Session duration
  const sessionType: "short" | "medium" | "long" =
    sessionMinutes < 5 ? "short" : sessionMinutes < 20 ? "medium" : "long";

  // Not enough data yet
  if (metrics.clickTimestamps.length < 10 || sessionMinutes < 3) {
    return null;
  }

  // Scoring: each preset gets a score based on user behavior
  const scores: Record<PresetId, number> = {
    default: 5, // baseline
    minimal: 0,
    vibrant: 0,
    neon: 0,
    earth: 0,
    monochrome: 0,
    moon: 0,
  };

  // Fast clickers → neon or monochrome (power users)
  if (clickSpeed === "fast") {
    scores.neon += 4;
    scores.monochrome += 3;
  }
  // Slow, deliberate → minimal or earth
  if (clickSpeed === "slow") {
    scores.minimal += 4;
    scores.earth += 3;
  }
  // Moderate → vibrant
  if (clickSpeed === "moderate") {
    scores.vibrant += 3;
    scores.default += 2;
  }

  // Explorers → vibrant (more visual cues help)
  if (navPattern === "explorer") {
    scores.vibrant += 3;
    scores.default += 2;
  }
  // Focused users → minimal (less distractions)
  if (navPattern === "focused") {
    scores.minimal += 3;
    scores.earth += 2;
  }
  // Power users → neon/monochrome (information dense)
  if (navPattern === "power-user") {
    scores.neon += 3;
    scores.monochrome += 2;
  }

  // Long sessions → earth or minimal (less eye strain)
  if (sessionType === "long") {
    scores.earth += 4;
    scores.minimal += 3;
  }
  // Short sessions → vibrant (engagement)
  if (sessionType === "short") {
    scores.vibrant += 2;
  }

  // Night time → darker themes
  if (hour >= 21 || hour < 6) {
    scores.neon += 2;
    scores.earth += 1;
    scores.moon += 3;
  }
  // Daytime → lighter options
  if (hour >= 9 && hour < 17) {
    scores.minimal += 1;
  }

  // Find the highest scoring preset
  let best: PresetId = "default";
  let bestScore = scores.default;
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = id as PresetId;
      bestScore = score;
    }
  }

  // Only suggest if significantly better than default
  if (bestScore <= scores.default + 2) return null;

  return best;
}

/**
 * Hook to passively track user behavior.
 * Mount once in the app layout. Only collects data when autoAdapt is enabled.
 */
export function useBehaviorTracker() {
  const autoAdapt = useSettingsStore((s) => s.style?.autoAdapt ?? false);
  const metricsRef = useRef<BehaviorMetrics>(getStoredMetrics());

  // Track clicks
  useEffect(() => {
    if (!autoAdapt) return;

    const handler = () => {
      const m = metricsRef.current;
      m.clickTimestamps.push(Date.now());
      if (m.clickTimestamps.length > 50) m.clickTimestamps.shift();
      storeMetrics(m);
    };

    document.addEventListener("click", handler, { passive: true });
    return () => document.removeEventListener("click", handler);
  }, [autoAdapt]);

  // Track scroll depth
  useEffect(() => {
    if (!autoAdapt) return;

    const handler = () => {
      const depth = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      if (!isNaN(depth) && isFinite(depth)) {
        const m = metricsRef.current;
        m.scrollDepths.push(depth);
        if (m.scrollDepths.length > 20) m.scrollDepths.shift();
        storeMetrics(m);
      }
    };

    // Debounced scroll
    let timeout: ReturnType<typeof setTimeout>;
    const debounced = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handler, 500);
    };

    window.addEventListener("scroll", debounced, { passive: true });
    return () => {
      window.removeEventListener("scroll", debounced);
      clearTimeout(timeout);
    };
  }, [autoAdapt]);

  // Track page navigation (listen for popstate + pushState)
  useEffect(() => {
    if (!autoAdapt) return;

    const handler = () => {
      const m = metricsRef.current;
      m.pageChanges++;
      storeMetrics(m);
    };

    window.addEventListener("popstate", handler);
    // Intercept pushState
    const origPush = history.pushState.bind(history);
    history.pushState = function (...args) {
      origPush(...args);
      handler();
    };

    return () => {
      window.removeEventListener("popstate", handler);
      history.pushState = origPush;
    };
  }, [autoAdapt]);

  /** Get the current suggested preset (or null if not enough data) */
  const getSuggestion = useCallback((): PresetId | null => {
    if (!autoAdapt) return null;
    return analyzeAndSuggest(metricsRef.current);
  }, [autoAdapt]);

  return { getSuggestion };
}
