/**
 * Apify Bandcamp Artist Scraper
 * Discovers independent artists on Bandcamp with contact emails.
 */

import type { RawArtistLead } from './ingestion-pipeline';
import { runActorAndGetItems, getPoolStats } from './apify-client-pool';

const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';

// Bandcamp genre tags to search by — high volume of independent artists
const BANDCAMP_GENRES = [
  'hip-hop', 'rap', 'electronic', 'indie', 'rock', 'pop', 'r-n-b-soul',
  'ambient', 'experimental', 'jazz', 'folk', 'metal', 'punk', 'world',
  'latin', 'afrobeat', 'reggae', 'dancehall', 'trap', 'lo-fi',
  'synthwave', 'drill', 'alternative', 'country', 'classical',
  'neo-soul', 'garage', 'grime', 'drum-and-bass', 'house', 'techno',
  'soul', 'funk', 'shoegaze', 'post-punk', 'emo',
];

// Search queries for Bandcamp artists
const BANDCAMP_QUERIES = [
  'site:bandcamp.com email contact independent artist',
  'site:bandcamp.com "contact me" musician',
  'site:bandcamp.com "booking" independent',
  'site:bandcamp.com "email" "independent artist"',
  'site:*.bandcamp.com "for booking" email',
  'site:*.bandcamp.com "@gmail.com" artist',
  'site:*.bandcamp.com "@hotmail.com" musician',
  'site:*.bandcamp.com "@yahoo.com" artist',
  'site:*.bandcamp.com "contact" "producer"',
  'site:*.bandcamp.com "management" email music',
  'site:*.bandcamp.com "inquiries" email artist 2024 OR 2025',
  'site:*.bandcamp.com "send beats" email producer',
  'site:*.bandcamp.com "collab" email independent',
];

export interface BandcampDiscoveryConfig {
  genres?: string[];
  maxResultsPerQuery?: number;
}

export async function discoverBandcampArtists(config: BandcampDiscoveryConfig = {}): Promise<RawArtistLead[]> {
  const {
    genres = BANDCAMP_GENRES,
    maxResultsPerQuery = 50,
  } = config;

  const poolInfo = getPoolStats();
  if (!poolInfo.hasBackup && poolInfo.activeKey === 'primary' && poolInfo.primaryErrors > 3) {
    console.warn('[ArtistDiscovery:Bandcamp] Pool appears exhausted, skipping');
    return [];
  }

  const allLeads: RawArtistLead[] = [];

  // Build queries: generic + genre-specific
  const queries: string[] = [...BANDCAMP_QUERIES];
  // Pick 8 random genres per run
  const selectedGenres = shuffleArray(genres).slice(0, 8);
  for (const genre of selectedGenres) {
    queries.push(`site:bandcamp.com/tag/${genre} email artist`);
    queries.push(`site:*.bandcamp.com ${genre} "contact" "booking"`);
  }

  console.log(`[ArtistDiscovery:Bandcamp] Running ${queries.length} queries across ${selectedGenres.length} genres`);

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
        const lead = extractBandcampArtist(item);
        if (lead) allLeads.push(lead);
      }
    } catch (err: any) {
      console.error(`[ArtistDiscovery:Bandcamp] Batch error:`, err.message?.slice(0, 200));
    }

    await sleep(2000);
  }

  console.log(`[ArtistDiscovery:Bandcamp] Found ${allLeads.length} raw leads`);
  return allLeads;
}

function extractBandcampArtist(result: any): RawArtistLead | null {
  const title = result.title || '';
  const description = result.description || '';
  const url = result.url || '';
  const text = `${title} ${description}`;

  // Extract email
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (!emailMatch) return null;

  // Extract artist name from Bandcamp URL or title
  let name = '';
  const bandcampMatch = url.match(/https?:\/\/([^.]+)\.bandcamp\.com/);
  if (bandcampMatch) {
    name = bandcampMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  if (!name || name.length < 2) {
    name = title.replace(/\s*\|.*$/, '').replace(/\s*[-–—].*bandcamp.*$/i, '').trim();
  }
  if (!name || name.length < 2) return null;

  // Detect genre from URL tags
  const genreMatch = url.match(/\/tag\/([\w-]+)/);

  return {
    fullName: name,
    email: emailMatch[0].toLowerCase(),
    industry: 'Music',
    genre: genreMatch?.[1]?.replace(/-/g, ' '),
    bandcampUrl: url.includes('bandcamp.com') ? url : undefined,
  };
}

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
