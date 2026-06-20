/**
 * TikTok Artist Discovery
 * Uses Google Search via Apify to find independent music artists on TikTok.
 * Strategy: Search for artist profiles with email/contact in bio.
 */

import type { RawArtistLead } from './ingestion-pipeline';
import { runActorAndGetItems, getPoolStats } from './apify-client-pool';

const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';

// ─── Search Queries ──────────────────────────────────────────────

const TIKTOK_QUERIES = [
  // English — email-focused
  'site:tiktok.com "@gmail.com" independent artist music',
  'site:tiktok.com "booking" "email" unsigned rapper',
  'site:tiktok.com "contact" "unsigned" singer songwriter',
  'site:tiktok.com "for bookings" email hip hop artist',
  'site:tiktok.com "@gmail.com" "official audio" unsigned musician',
  'site:tiktok.com "independent artist" email new music',
  'site:tiktok.com "unsigned" "email" artist lo-fi OR trap OR drill',
  'site:tiktok.com "bedroom producer" email beats',
  'site:tiktok.com "management" "@" rapper 2025',
  'site:tiktok.com "new single" OR "new release" unsigned artist "@gmail"',
  'site:tiktok.com "indie artist" "booking inquiries" "@"',
  'site:tiktok.com "@outlook" OR "@protonmail" artist musician',

  // Spanish
  'site:tiktok.com "@gmail.com" artista independiente música',
  'site:tiktok.com "contacto" "artista urbano" correo',
  'site:tiktok.com "booking" email cantante latino',

  // Genre-specific
  'site:tiktok.com "afrobeats" artist email unsigned',
  'site:tiktok.com "amapiano" artist email contact',
  'site:tiktok.com "K-pop" OR "K-indie" independent email',
  'site:tiktok.com "UK drill" OR "grime" artist email',
  'site:tiktok.com "Latin trap" OR "reggaeton" artista email',
  'site:tiktok.com "phonk" producer email',
  'site:tiktok.com "hyperpop" OR "pluggnb" artist email',
  'site:tiktok.com "neo soul" OR "R&B" independent artist email',
];

// ─── Config ──────────────────────────────────────────────────────

export interface TikTokDiscoveryConfig {
  maxQueries?: number;
  maxResultsPerQuery?: number;
}

// ─── Main Discovery ──────────────────────────────────────────────

export async function discoverTikTokArtists(config: TikTokDiscoveryConfig = {}): Promise<RawArtistLead[]> {
  const {
    maxQueries = 15,
    maxResultsPerQuery = 40,
  } = config;

  const poolInfo = getPoolStats();
  if (!poolInfo.hasBackup && poolInfo.activeKey === 'primary' && poolInfo.primaryErrors > 3) {
    console.warn('[ArtistDiscovery:TikTok] Pool appears exhausted, skipping');
    return [];
  }

  const allLeads: RawArtistLead[] = [];
  const queries = shuffleArray(TIKTOK_QUERIES).slice(0, maxQueries);

  console.log(`[ArtistDiscovery:TikTok] Running ${queries.length} queries`);

  const batches = chunkArray(queries, 10);

  for (const batch of batches) {
    try {
      const items = await runActorAndGetItems(GOOGLE_SEARCH_ACTOR, {
        queries: batch.join('\n'),
        maxPagesPerQuery: 2,
        resultsPerPage: maxResultsPerQuery,
        languageCode: '',
        mobileResults: false,
      }, { waitSecs: 120 });

      for (const item of items) {
        const lead = extractTikTokArtist(item);
        if (lead) allLeads.push(lead);
      }
    } catch (err: any) {
      console.error(`[ArtistDiscovery:TikTok] Batch error:`, err.message?.slice(0, 200));
    }

    await sleep(2000);
  }

  // Deduplicate by email
  const seen = new Set<string>();
  const unique = allLeads.filter(l => {
    if (!l.email || seen.has(l.email)) return false;
    seen.add(l.email);
    return true;
  });

  console.log(`[ArtistDiscovery:TikTok] Found ${unique.length} unique leads (${allLeads.length} raw)`);
  return unique;
}

// ─── Extract Artist from Search Result ───────────────────────────

function extractTikTokArtist(result: any): RawArtistLead | null {
  const title = result.title || '';
  const description = result.description || '';
  const url = result.url || '';
  const text = `${title} ${description}`;

  // Must have email
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (!emailMatch) return null;

  const email = emailMatch[0].toLowerCase();

  // Skip platform emails
  if (email.includes('tiktok.com') || email.includes('bytedance') || email.includes('example.com')) {
    return null;
  }

  // Extract name from TikTok URL or title
  let name = '';

  // Try URL pattern: tiktok.com/@username
  const tiktokMatch = url.match(/tiktok\.com\/@([^/?&\s]+)/);
  if (tiktokMatch) {
    name = tiktokMatch[1]
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  // Fallback to title
  if (!name || name.length < 2) {
    name = title
      .replace(/\s*[-–—|·•]\s*TikTok.*$/i, '')
      .replace(/\(@[^)]+\)/i, '')
      .replace(/on TikTok$/i, '')
      .replace(/\s*\|.*$/, '')
      .trim();
  }

  if (!name || name.length < 2 || name.length > 80) return null;

  // Detect genre
  const genreMatch = description.match(
    /\b(hip[\s-]?hop|rap|trap|r&b|rnb|pop|rock|indie|electronic|lo[\s-]?fi|drill|afrobeats|reggaeton|amapiano|soul|jazz|folk|punk|metal|country|k[\s-]?pop|latin|reggae|dancehall|phonk|synthwave|grime|hyperpop|pluggnb)\b/i
  );

  // Extract TikTok handle
  let tiktokHandle: string | undefined;
  if (tiktokMatch) {
    tiktokHandle = tiktokMatch[1];
  }

  return {
    fullName: name,
    email,
    industry: 'Music',
    genre: genreMatch?.[1],
    tiktokHandle,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const c: T[][] = [];
  for (let i = 0; i < arr.length; i += size) c.push(arr.slice(i, i + size));
  return c;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
