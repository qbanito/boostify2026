/**
 * Deterministic pseudo-random helpers (FNV-1a hash → [0,1)).
 *
 * BoostiSwap market widgets need varied-but-STABLE display metrics
 * (APY, reserves, chart points…). Using Math.random() made every value
 * change on each render/refresh, which looked broken. Seeding by a stable
 * key (token id/symbol) keeps values consistent everywhere.
 */
export function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Deterministic value in [min, max) for a seed. */
export function seededRange(seed: string, min: number, max: number): number {
  return min + seededUnit(seed) * (max - min);
}
