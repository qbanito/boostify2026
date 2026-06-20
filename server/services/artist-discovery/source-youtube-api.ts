/**
 * YouTube Data API v3 — Direct Artist Discovery (no-Apify fallback)
 *
 * Searches for independent artist channels using the official YouTube Data API,
 * then fetches channel details including snippet.thumbnails for reference images.
 *
 * Requires: YOUTUBE_API_KEY
 * Quota: 10,000 units/day (search = 100 units, channels = 1 unit)
 *
 * Strategy: One query per run ~= 100 + 5 (channels batch) = 105 units.
 * With default 20 queries/run we use ~2,100 units → 4-5 runs/day max.
 */

import type { RawArtistLead } from './ingestion-pipeline';

const API_KEY = process.env.YOUTUBE_API_KEY || '';
const BASE = 'https://www.googleapis.com/youtube/v3';

// Curated queries targeting independent / emerging artists globally
const QUERIES = [
  'independent artist official music video 2025',
  'unsigned rapper official audio',
  'indie singer songwriter new single 2025',
  'bedroom producer lofi beats 2025',
  'afrobeats emerging artist',
  'latin trap artista independiente',
  'reggaeton nuevo artista 2025',
  'kpop indie debut',
  'amapiano new artist 2025',
  'uk drill new artist',
  'hyperpop new artist 2025',
  'neo soul indie singer',
  'phonk producer 2025',
  'dancehall unsigned artist',
  'city pop japan new artist',
  'alt rock independent band 2025',
  'hip hop emerging artist new mixtape',
  'indie pop new artist 2025',
  'electronic producer new single 2025',
  'rnb emerging artist 2025',
];

// Country code → display name for ingestion normalization
const COUNTRY_HINTS: Array<{ match: RegExp; country: string }> = [
  { match: /\blatin|reggaeton|trap latino|bachata|regional mexicano/i, country: 'Mexico' },
  { match: /\bafro|afrobeats|amapiano/i, country: 'Nigeria' },
  { match: /\bdrill|uk /i, country: 'United Kingdom' },
  { match: /\bkpop|k-indie|korean/i, country: 'South Korea' },
  { match: /\bcity pop|japan|jpop/i, country: 'Japan' },
  { match: /\bbrasil|funk br|portuguese/i, country: 'Brazil' },
];

interface YTSearchItem {
  id: { channelId?: string };
  snippet: { channelId: string; title: string; description: string };
}

interface YTChannel {
  id: string;
  snippet: {
    title: string;
    description: string;
    country?: string;
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
    customUrl?: string;
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
  };
  brandingSettings?: {
    channel?: { keywords?: string; country?: string };
  };
}

// Extract first valid email from description text, ignoring junk domains.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JUNK_EMAIL_DOMAINS = new Set([
  'example.com', 'youtube.com', 'gmail', 'email.com', 'noemail.com',
]);
function extractEmail(text: string): string | undefined {
  if (!text) return undefined;
  const matches = text.match(EMAIL_RE);
  if (!matches) return undefined;
  for (const m of matches) {
    const domain = m.split('@')[1]?.toLowerCase();
    if (!domain || JUNK_EMAIL_DOMAINS.has(domain)) continue;
    return m.toLowerCase();
  }
  return undefined;
}

function inferCountry(text: string, ytCountry?: string): string | undefined {
  if (ytCountry) return ytCountry;
  for (const hint of COUNTRY_HINTS) {
    if (hint.match.test(text)) return hint.country;
  }
  return undefined;
}

async function youtubeFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ key: API_KEY, ...params }).toString();
  const res = await fetch(`${BASE}/${path}?${qs}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`YouTube API ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export interface YouTubeDiscoveryConfig {
  maxQueries?: number;
  maxResultsPerQuery?: number;
}

export async function discoverYouTubeApiArtists(
  config: YouTubeDiscoveryConfig = {}
): Promise<RawArtistLead[]> {
  if (!API_KEY) {
    console.warn('[YouTubeAPI] YOUTUBE_API_KEY not configured — skipping');
    return [];
  }
  const maxQueries = Math.min(config.maxQueries || 10, QUERIES.length);
  const maxResults = Math.min(config.maxResultsPerQuery || 25, 50);

  // Shuffle queries to avoid hitting the same ones every run
  const pool = [...QUERIES].sort(() => Math.random() - 0.5).slice(0, maxQueries);
  const channelIds = new Set<string>();

  for (const q of pool) {
    try {
      const data = await youtubeFetch<{ items: YTSearchItem[] }>('search', {
        part: 'snippet',
        q,
        type: 'channel',
        maxResults: String(maxResults),
        order: 'relevance',
      });
      for (const item of data.items || []) {
        const id = item.id?.channelId || item.snippet?.channelId;
        if (id) channelIds.add(id);
      }
    } catch (err: any) {
      console.warn(`[YouTubeAPI] search "${q}" failed:`, err.message);
    }
  }

  if (channelIds.size === 0) {
    console.log('[YouTubeAPI] No channels found from search');
    return [];
  }

  // Batch channel lookup (max 50 per call)
  const ids = Array.from(channelIds);
  const leads: RawArtistLead[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    try {
      const data = await youtubeFetch<{ items: YTChannel[] }>('channels', {
        part: 'snippet,statistics,brandingSettings',
        id: batch.join(','),
      });
      for (const ch of data.items || []) {
        const name = ch.snippet.title?.trim();
        if (!name) continue;
        const description = ch.snippet.description || '';
        const email = extractEmail(description);
        if (!email) continue; // require email for outreach

        const subs = Number(ch.statistics?.subscriberCount || 0);
        // Skip mega-stars (likely already signed) and empty channels
        if (subs > 500_000 || subs < 100) continue;

        const keywords = ch.brandingSettings?.channel?.keywords || '';
        const country =
          ch.snippet.country ||
          ch.brandingSettings?.channel?.country ||
          inferCountry(`${name} ${description} ${keywords}`);

        const thumbnail =
          ch.snippet.thumbnails?.high?.url ||
          ch.snippet.thumbnails?.medium?.url ||
          ch.snippet.thumbnails?.default?.url;

        const customUrl = ch.snippet.customUrl ? `https://youtube.com/${ch.snippet.customUrl}` : undefined;
        const channelUrl = customUrl || `https://youtube.com/channel/${ch.id}`;

        leads.push({
          fullName: name,
          email,
          country,
          headline: description.slice(0, 280),
          companyDescription: description.slice(0, 500),
          youtubeUrl: channelUrl,
          followers: subs,
          profileImageUrl: thumbnail,
          genre: keywords.split(',')[0]?.trim() || undefined,
        });
      }
    } catch (err: any) {
      console.warn('[YouTubeAPI] channel batch failed:', err.message);
    }
  }

  console.log(`[YouTubeAPI] ${channelIds.size} channels found → ${leads.length} leads with emails + images`);
  return leads;
}
