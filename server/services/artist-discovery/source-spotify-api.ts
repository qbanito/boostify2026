/**
 * Spotify Web API — Direct Artist Discovery (no-Apify fallback)
 *
 * Uses the Client Credentials flow to search for artists by genre/market.
 * Returns reference artist images from Spotify's `images[]` array.
 *
 * NOTE: Spotify's search API does NOT expose artist emails — we only get
 * the name, genres, followers, and images. Email must be acquired later via
 * enrichment (site scrape, external provider, or manual import). These leads
 * still feed the image-stylizer agent so the landing page gets a Boostify
 * variant once outreach kicks in.
 *
 * Requires: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
 * Returns [] gracefully if either is missing.
 */

import type { RawArtistLead } from './ingestion-pipeline';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    console.warn('[SpotifyAPI] token request failed:', res.status);
    return null;
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

const GENRE_QUERIES = [
  'genre:indie', 'genre:hip-hop', 'genre:latin', 'genre:afrobeats',
  'genre:k-pop', 'genre:electronic', 'genre:rock', 'genre:pop',
  'genre:rnb', 'genre:reggaeton', 'genre:trap', 'genre:dancehall',
  'genre:amapiano', 'genre:phonk', 'genre:bedroom-pop', 'genre:hyperpop',
];

const MARKETS = ['US', 'GB', 'MX', 'ES', 'BR', 'AR', 'CO', 'NG', 'FR', 'DE', 'KR', 'JP'];

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  followers: { total: number };
  popularity: number;
  images: Array<{ url: string; width: number; height: number }>;
  external_urls: { spotify: string };
}

export interface SpotifyDiscoveryConfig {
  maxQueries?: number;
  maxResultsPerQuery?: number;
  minFollowers?: number;
  maxFollowers?: number;
}

export async function discoverSpotifyApiArtists(
  config: SpotifyDiscoveryConfig = {}
): Promise<RawArtistLead[]> {
  const token = await getAppToken();
  if (!token) {
    console.warn('[SpotifyAPI] credentials missing or auth failed — skipping');
    return [];
  }

  const maxQueries = Math.min(config.maxQueries || 8, GENRE_QUERIES.length);
  const maxResults = Math.min(config.maxResultsPerQuery || 30, 50);
  const minF = config.minFollowers ?? 500;
  const maxF = config.maxFollowers ?? 250_000;

  // Shuffle so each run explores different genres/markets
  const queries = [...GENRE_QUERIES].sort(() => Math.random() - 0.5).slice(0, maxQueries);
  const leads: RawArtistLead[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    const market = MARKETS[Math.floor(Math.random() * MARKETS.length)];
    try {
      const qs = new URLSearchParams({
        q,
        type: 'artist',
        market,
        limit: String(maxResults),
      }).toString();
      const res = await fetch(`https://api.spotify.com/v1/search?${qs}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        console.warn(`[SpotifyAPI] search "${q}" ${market} → ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { artists?: { items: SpotifyArtist[] } };
      for (const a of data.artists?.items || []) {
        if (seen.has(a.id)) continue;
        seen.add(a.id);
        const followers = a.followers?.total ?? 0;
        if (followers < minF || followers > maxF) continue;
        if (!a.images?.length) continue; // need image for stylization

        // Pick the largest image ≤ 640px (to keep FAL costs + bandwidth down)
        const sorted = [...a.images].sort((x, y) => y.width - x.width);
        const image = sorted.find((i) => i.width <= 640) || sorted[sorted.length - 1];

        leads.push({
          fullName: a.name,
          // Spotify does NOT expose emails — leave blank so enrichment picks it up later.
          // The ingestion pipeline will drop leads with no email; we log them for later.
          // TODO: hook into enrichment/data-collector to resolve email from website.
          email: undefined,
          genre: a.genres?.[0] || q.replace('genre:', ''),
          country: market === 'US' ? 'United States'
            : market === 'GB' ? 'United Kingdom'
            : market === 'MX' ? 'Mexico'
            : market === 'ES' ? 'Spain'
            : market === 'BR' ? 'Brazil'
            : market === 'AR' ? 'Argentina'
            : market === 'CO' ? 'Colombia'
            : market === 'NG' ? 'Nigeria'
            : market === 'FR' ? 'France'
            : market === 'DE' ? 'Germany'
            : market === 'KR' ? 'South Korea'
            : market === 'JP' ? 'Japan'
            : undefined,
          spotifyUrl: a.external_urls?.spotify,
          followers,
          profileImageUrl: image.url,
          headline: `${a.genres?.slice(0, 3).join(', ') || ''} · ${followers.toLocaleString()} followers`,
        });
      }
    } catch (err: any) {
      console.warn(`[SpotifyAPI] query "${q}" failed:`, err.message);
    }
  }

  const withEmail = leads.filter((l) => l.email).length;
  console.log(
    `[SpotifyAPI] ${leads.length} artist candidates (${withEmail} with email, ` +
    `${leads.length - withEmail} need enrichment) from ${queries.length} queries`
  );
  return leads;
}
