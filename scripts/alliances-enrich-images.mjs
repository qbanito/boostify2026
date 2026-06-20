#!/usr/bin/env node
/**
 * Bulk-enrich music_industry_contacts with profile images using a
 * no-auth fallback chain: Deezer → iTunes → MusicBrainz/CoverArt → Last.fm.
 *
 * Usage:
 *   node scripts/alliances-enrich-images.mjs [--limit=200] [--dry]
 *
 * Skips obvious junk names (domain tokens, SEO/tracker strings, empty parens).
 */
import pg from 'pg';
import 'dotenv/config';

const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || 150;
const DRY = process.argv.includes('--dry');
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || null;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

// ── junk-name filter ─────────────────────────────────────────────
const JUNK_TOKENS = [
  'google', 'adsense', 'analytics', 'ssl', 'certificate', 'cloudflare',
  'amazon', 'aws', 'facebook pixel', 'pixel', 'gtag', 'gtm', 'hotjar',
  'doubleclick', 'recaptcha', 'cookie', 'privacy policy', 'terms of service',
  'wordpress', 'shopify', 'wix', 'squarespace', 'mailchimp', 'paypal',
  'stripe', 'klaviyo', 'hubspot', 'typeform', 'calendly',
];

function cleanName(raw) {
  if (!raw) return '';
  let name = String(raw).trim();
  // remove trailing empty parens "Name ()"
  name = name.replace(/\s*\(\s*\)\s*$/g, '').trim();
  // strip trailing role segment after |  e.g. "Amy Rae | Singer-Songwriter"
  name = name.split('|')[0].trim();
  return name;
}

function isJunk(raw) {
  if (!raw) return true;
  const name = cleanName(raw).toLowerCase();
  if (name.length < 3) return true;
  if (/^https?:\/\//.test(name)) return true;
  if (/\.(com|net|org|io|co)\b/.test(name)) return true;
  for (const t of JUNK_TOKENS) {
    if (name.includes(t)) return true;
  }
  return false;
}

// ── provider fetchers ────────────────────────────────────────────
async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), opts.timeout || 8000);
  try {
    const resp = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function headOk(url) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 6000);
  try {
    const resp = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function deezer(name) {
  const data = await fetchJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`);
  const item = data?.data?.[0];
  if (!item) return null;
  const url = item.picture_xl || item.picture_big || item.picture_medium || item.picture;
  if (!url || /\/artist\/unknown\//i.test(url)) return null;
  return { provider: 'deezer', url, externalId: item.id ? String(item.id) : null };
}

async function itunes(name) {
  const search = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`);
  const artistId = search?.results?.[0]?.artistId;
  if (!artistId) return null;
  const albums = await fetchJson(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=1`);
  const album = (albums?.results || []).find((r) => r.wrapperType === 'collection');
  const raw = album?.artworkUrl100;
  if (!raw) return null;
  const url = raw.replace(/\/\d+x\d+bb\./, '/1200x1200bb.');
  return { provider: 'itunes', url, externalId: String(artistId) };
}

async function musicbrainz(name) {
  const ua = { 'User-Agent': 'Boostify/1.0 (alliances@boostify.app)' };
  const search = await fetchJson(
    `https://musicbrainz.org/ws/2/artist/?query=artist:"${encodeURIComponent(name)}"&fmt=json&limit=1`,
    { headers: ua },
  );
  const mbid = search?.artists?.[0]?.id;
  if (!mbid) return null;
  const rg = await fetchJson(
    `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&fmt=json&limit=1`,
    { headers: ua },
  );
  const rgId = rg?.['release-groups']?.[0]?.id;
  if (!rgId) return null;
  const url = `https://coverartarchive.org/release-group/${rgId}/front-500`;
  if (!(await headOk(url))) return null;
  return { provider: 'coverart', url, externalId: mbid };
}

async function lastfm(name) {
  if (!LASTFM_API_KEY) return null;
  const data = await fetchJson(
    `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(name)}&api_key=${LASTFM_API_KEY}&format=json`,
  );
  const images = data?.artist?.image || [];
  const url =
    images.find((i) => i.size === 'mega')?.['#text'] ||
    images.find((i) => i.size === 'extralarge')?.['#text'];
  if (!url || /2a96cbd8b46e442fc41c2b86b821562f/i.test(url)) return null;
  return { provider: 'lastfm', url, externalId: data?.artist?.mbid || null };
}

async function resolveImage(name) {
  const sources = [];
  let winner = null;
  for (const fn of [deezer, itunes, musicbrainz, lastfm]) {
    try {
      const hit = await fn(name);
      if (hit && hit.url) {
        sources.push(hit);
        if (!winner) winner = hit;
        if (winner) break; // first success wins
      }
    } catch (e) {
      // continue to next provider
    }
  }
  return { winner, sources };
}

// ── main ────────────────────────────────────────────────────────
async function main() {
  console.log(`[alliances-enrich] limit=${LIMIT} dry=${DRY} lastfm=${Boolean(LASTFM_API_KEY)}`);

  // Fetch candidates, ordered by lead score desc (same logic as endpoint)
  const { rows } = await pool.query(
    `SELECT id, full_name, master_json
       FROM music_industry_contacts
       WHERE (profile_image_url IS NULL OR profile_image_url = '')
         AND (full_name IS NOT NULL AND full_name <> '')
       ORDER BY COALESCE((master_json->'scoring'->>'leadScore')::numeric, 0) DESC,
                created_at DESC
       LIMIT $1`,
    [LIMIT * 3], // oversample; many will be filtered as junk
  );

  console.log(`[alliances-enrich] fetched ${rows.length} candidates, processing up to ${LIMIT}`);

  let processed = 0, updated = 0, notFound = 0, skipped = 0;
  const providerCounts = {};
  const samples = [];

  for (const row of rows) {
    if (processed >= LIMIT) break;
    const raw = row.master_json?.identity?.artistName || row.master_json?.identity?.stageName || row.full_name;
    if (isJunk(raw)) { skipped++; continue; }
    const name = cleanName(raw);
    processed++;

    const { winner, sources } = await resolveImage(name);

    if (!winner) {
      notFound++;
      process.stdout.write(`  [${row.id}] "${name}" → not-found\n`);
      continue;
    }

    providerCounts[winner.provider] = (providerCounts[winner.provider] || 0) + 1;

    if (!DRY) {
      const mj = row.master_json || {};
      mj.identity = { ...(mj.identity || {}), avatarUrl: winner.url };
      mj.visual = {
        ...(mj.visual || {}),
        sources: [
          ...((mj.visual || {}).sources || []).filter((s) => !sources.some((x) => x.provider === s.provider)),
          ...sources.map((s) => ({
            provider: s.provider, url: s.url, externalId: s.externalId || null,
            fetchedAt: new Date().toISOString(),
          })),
        ],
        primarySource: winner.provider,
      };
      await pool.query(
        `UPDATE music_industry_contacts
            SET profile_image_url = $1, master_json = $2, updated_at = NOW()
          WHERE id = $3`,
        [winner.url, JSON.stringify(mj), row.id],
      );
    }

    updated++;
    if (samples.length < 10) samples.push({ id: row.id, name, provider: winner.provider });
    process.stdout.write(`  [${row.id}] "${name}" ✓ ${winner.provider}\n`);

    // rate-limit friendliness across providers
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log('\n=== SUMMARY ===');
  console.log({ processed, updated, notFound, skipped, providerCounts });
  console.log('Samples:', samples);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
