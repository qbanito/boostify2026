/**
 * Apify Spotify Artist Scraper
 * Uses Apify to find independent artists on Spotify by genre and country.
 * Targets: artists with emails in bio, social links, and contact info.
 */

import type { RawArtistLead } from './ingestion-pipeline';
import { runActorAndGetItems, getPoolStats } from './apify-client-pool';

// Aggressive search queries — rotated by country and genre
const SEARCH_QUERIES_BY_COUNTRY: Record<string, string[]> = {
  'United States': [
    'independent artist email', 'unsigned rapper contact', 'indie singer songwriter',
    'emerging hip hop artist', 'underground R&B artist', 'new pop artist unsigned',
    'indie rock band contact', 'electronic producer email', 'lo-fi artist booking',
    'DIY musician contact', 'bedroom producer', 'independent rapper SoundCloud',
    'indie artist "@gmail.com"', 'unsigned artist booking inquiry',
    'artist manager contact hip hop', 'new music 2025 unsigned artist email',
  ],
  'United Kingdom': [
    'UK indie artist email', 'unsigned UK rapper', 'London underground artist',
    'UK drill artist contact', 'British indie band', 'UK grime artist unsigned',
  ],
  'Mexico': [
    'artista independiente México email', 'rapero mexicano independiente',
    'cantante urbano México contacto', 'artista indie México',
  ],
  'Spain': [
    'artista independiente España email', 'rapero español unsigned',
    'cantante urbano España contacto', 'artista indie España',
  ],
  'Colombia': [
    'artista independiente Colombia email', 'rapero colombiano unsigned',
    'reggaeton artista nuevo Colombia', 'cantante urbano Colombia',
  ],
  'Brazil': [
    'artista independente Brasil email', 'rapper brasileiro independente',
    'cantor urbano Brasil contato', 'funk artista novo Brasil',
  ],
  'France': [
    'artiste indépendant France email', 'rappeur français unsigned',
    'chanteur indépendant France contact',
  ],
  'Germany': [
    'independent Künstler Deutschland email', 'unsigned rapper Germany',
    'indie artist Berlin contact',
  ],
  'Nigeria': [
    'Afrobeats artist unsigned email', 'Nigerian artist independent',
    'Afropop artist contact Nigeria', 'Amapiano artist unsigned',
  ],
  'Argentina': [
    'artista independiente Argentina email', 'rapero argentino unsigned',
    'trap artista Argentina contacto',
  ],
  'Canada': [
    'independent artist Canada email', 'unsigned rapper Toronto',
    'indie artist Montreal contact', 'Canadian hip hop unsigned',
  ],
  'South Korea': [
    'K-indie artist email', 'Korean independent artist contact',
    'unsigned K-pop trainee', 'Korean hip hop artist independent',
  ],
  'Japan': [
    'Japanese indie artist email', 'J-hip hop artist unsigned',
    'independent musician Japan contact',
  ],
  'Australia': [
    'Australian indie artist email', 'unsigned rapper Australia',
    'Melbourne indie artist contact', 'Australian hip hop unsigned',
  ],
  'Italy': [
    'artista indipendente Italia email', 'rapper italiano unsigned',
    'cantante indie Italia contatto',
  ],
  'Chile': [
    'artista independiente Chile email', 'rapero chileno unsigned',
    'trap artista Chile contacto',
  ],
  'South Africa': [
    'South African artist unsigned email', 'Amapiano artist contact',
    'SA hip hop artist independent',
  ],
  'Ghana': [
    'Ghanaian artist email unsigned', 'Afrobeats artist Ghana contact',
  ],
  'Kenya': [
    'Kenyan artist email unsigned', 'Gengetone artist contact',
  ],
  'India': [
    'Indian independent artist email', 'indie hip hop artist India',
    'Bollywood singer unsigned contact',
  ],
  'Peru': [
    'artista independiente Perú email', 'rapero peruano unsigned',
  ],
  'Sweden': [
    'Swedish indie artist email', 'unsigned artist Stockholm',
  ],
  'Netherlands': [
    'Dutch indie artist email', 'unsigned rapper Netherlands',
  ],
  'Portugal': [
    'artista independente Portugal email', 'rapper português unsigned',
  ],
  'Puerto Rico': [
    'artista independiente Puerto Rico email', 'reggaetonero nuevo Puerto Rico',
    'trap latino Puerto Rico contacto', 'artista urbano PR unsigned',
  ],
  'Dominican Republic': [
    'artista dominicano independiente email', 'dembow artista contacto',
    'cantante urbano dominicano unsigned',
  ],
  'Ecuador': [
    'artista independiente Ecuador email', 'rapero ecuatoriano unsigned',
  ],
  'Philippines': [
    'Filipino independent artist email', 'OPM indie artist contact',
    'Pinoy rapper unsigned email',
  ],
};

// Spotify-focused Apify actor for email extraction
const SPOTIFY_SCRAPER_ACTOR = 'tri_angle/spotify-scraper';
const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';

export interface SpotifyDiscoveryConfig {
  countries?: string[];
  maxResultsPerQuery?: number;
  maxConcurrency?: number;
}

/**
 * Run Spotify-based artist discovery via Apify Google Search
 * Strategy: Search Google for "[query] site:open.spotify.com/artist" to find artist profiles,
 * then extract emails from the results pages.
 */
export async function discoverSpotifyArtists(config: SpotifyDiscoveryConfig = {}): Promise<RawArtistLead[]> {
  const {
    countries = Object.keys(SEARCH_QUERIES_BY_COUNTRY),
    maxResultsPerQuery = 50,
  } = config;

  const poolInfo = getPoolStats();
  if (!poolInfo.hasBackup && poolInfo.activeKey === 'primary' && poolInfo.primaryErrors > 3) {
    console.warn('[ArtistDiscovery:Spotify] Pool appears exhausted, skipping');
    return [];
  }

  const allLeads: RawArtistLead[] = [];
  const queries: string[] = [];

  // Build search queries for Google — target Spotify artist pages + emails
  for (const country of countries) {
    const countryQueries = SEARCH_QUERIES_BY_COUNTRY[country] || [];
    // Pick 2-3 random queries per country each run to stay varied
    const selected = shuffleArray(countryQueries).slice(0, 3);
    for (const q of selected) {
      queries.push(`${q} site:open.spotify.com/artist`);
      queries.push(`"${q}" email contact`);
    }
  }

  console.log(`[ArtistDiscovery:Spotify] Running ${queries.length} search queries across ${countries.length} countries`);

  // Run Google Search actor in batches
  const queryBatches = chunkArray(queries, 10);

  for (const batch of queryBatches) {
    try {
      const items = await runActorAndGetItems(GOOGLE_SEARCH_ACTOR, {
        queries: batch.join('\n'),
        maxPagesPerQuery: 2,
        resultsPerPage: maxResultsPerQuery,
        languageCode: '',
        mobileResults: false,
      }, { waitSecs: 120 });

      for (const item of items) {
        const lead = extractArtistFromSearchResult(item);
        if (lead) allLeads.push(lead);
      }
    } catch (err: any) {
      console.error(`[ArtistDiscovery:Spotify] Batch error:`, err.message?.slice(0, 200));
    }

    // Rate limiting between batches
    await sleep(2000);
  }

  console.log(`[ArtistDiscovery:Spotify] Found ${allLeads.length} raw leads`);
  return allLeads;
}

/**
 * Extract artist info from a Google search result
 */
function extractArtistFromSearchResult(result: any): RawArtistLead | null {
  const title = result.title || '';
  const description = result.description || '';
  const url = result.url || '';
  const text = `${title} ${description}`;

  // Extract email from description/title
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (!emailMatch && !url.includes('spotify.com/artist')) return null;

  // Extract name — clean up Spotify-style titles
  let name = title
    .replace(/\s*[-–—|·•]\s*Spotify.*$/i, '')
    .replace(/\s*[-–—|·•]\s*Listen.*$/i, '')
    .replace(/\s*[-–—|·•]\s*Artist.*$/i, '')
    .replace(/\s*on\s+Spotify$/i, '')
    .trim();

  if (!name || name.length < 2) return null;

  // Try to extract genre/location from description
  const genreMatch = description.match(/(?:genre|style|music)[:\s]*([\w\s-]+)/i);
  const locationMatch = description.match(/(?:from|based in|located in)\s+([\w\s,]+)/i);

  const lead: RawArtistLead = {
    fullName: name,
    email: emailMatch?.[0]?.toLowerCase(),
    industry: 'Music',
    genre: genreMatch?.[1]?.trim(),
    spotifyUrl: url.includes('spotify.com') ? url : undefined,
  };

  if (locationMatch) {
    const parts = locationMatch[1].split(',').map((s: string) => s.trim());
    lead.city = parts[0];
    lead.country = parts[1] || parts[0];
  }

  return lead;
}

// ─── Helpers ─────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
