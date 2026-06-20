/**
 * Username Engine — generates candidate handles and scores them.
 * Availability check is best-effort per platform (public HEAD requests).
 */
import { pool } from './db';

const SUFFIXES = ['', '.music', '_music', 'music', '_official', 'ofc', '.official', 'hq', 'world'];
const NUMERIC = ['', '01', '1', '2026', 'xo'];

function slug(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);
}

export function generateHandles(stageName: string): string[] {
  const base = slug(stageName);
  if (!base) return [];
  const out = new Set<string>();
  for (const suf of SUFFIXES) {
    for (const num of NUMERIC) {
      const handle = `${base}${suf}${num}`.slice(0, 30);
      if (handle.length >= 3) out.add(handle);
    }
  }
  return Array.from(out).slice(0, 24);
}

export function scoreHandle(handle: string, stageName: string): number {
  const base = slug(stageName);
  let score = 60;
  if (handle === base) score = 98;
  else if (handle === `${base}.music`) score = 96;
  else if (handle === `${base}_official`) score = 94;
  else if (handle.endsWith('ofc') || handle.endsWith('hq')) score = 88;
  else if (/[0-9]/.test(handle)) score = 72;

  if (handle.length <= 12) score += 2;
  if (handle.length > 20) score -= 6;
  if (/__|\.\.|_\./.test(handle)) score -= 10;
  return Math.max(0, Math.min(100, score));
}

/**
 * Best-effort availability probe via public URL HEAD.
 * We treat 404/4xx as available, 200 as taken. Network errors → unknown.
 * This is heuristic; platforms may require auth for accurate checks.
 */
export async function probeAvailability(
  handle: string,
  platform: string,
): Promise<'available' | 'taken' | 'unknown'> {
  const urls: Record<string, string> = {
    instagram: `https://www.instagram.com/${handle}/`,
    tiktok: `https://www.tiktok.com/@${handle}`,
    twitter: `https://x.com/${handle}`,
    x: `https://x.com/${handle}`,
    youtube: `https://www.youtube.com/@${handle}`,
    threads: `https://www.threads.net/@${handle}`,
  };
  const url = urls[platform];
  if (!url) return 'unknown';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'manual' });
    clearTimeout(t);
    if (resp.status === 404) return 'available';
    if (resp.status === 200) return 'taken';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function persistCandidates(
  artistId: string,
  candidates: Array<{ handle: string; score: number; platform?: string; availability?: string }>,
): Promise<number> {
  let inserted = 0;
  for (const c of candidates) {
    try {
      await pool.query(
        `INSERT INTO aiaps_username_candidates (artist_id, platform, handle, score, availability)
         VALUES ($1,$2,$3,$4,$5)`,
        [artistId, c.platform || null, c.handle, c.score, c.availability || 'unknown'],
      );
      inserted++;
    } catch {
      /* ignore duplicates */
    }
  }
  return inserted;
}
