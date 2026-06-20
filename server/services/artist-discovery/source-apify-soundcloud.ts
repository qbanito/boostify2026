/**
 * SoundCloud Artist Discovery
 * Uses Apify to find independent artists on SoundCloud with contact info.
 */

import type { RawArtistLead } from './ingestion-pipeline';
import { runActorAndGetItems, getPoolStats } from './apify-client-pool';

const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';

const SOUNDCLOUD_QUERIES = [
  'site:soundcloud.com "email" independent artist',
  'site:soundcloud.com "contact" "booking" musician',
  'site:soundcloud.com "@gmail.com" rapper hip hop',
  'site:soundcloud.com "@gmail.com" producer beats',
  'site:soundcloud.com "unsigned" artist email',
  'site:soundcloud.com "for bookings" email artist',
  'site:soundcloud.com "independent" "contact" music',
  'site:soundcloud.com "emerging" artist email',
  'site:soundcloud.com "new artist" "email" beats',
  'site:soundcloud.com "DM for collabs" email',
  'site:soundcloud.com "booking inquiries" "@" artist',
  'site:soundcloud.com "management" email rapper 2024 OR 2025',
  'site:soundcloud.com "send beats to" "@gmail" producer',
  'site:soundcloud.com "@outlook.com" OR "@proton" artist',
];

const GENRE_QUERIES = [
  'hip hop', 'trap', 'lo-fi', 'electronic', 'R&B', 'indie',
  'bedroom pop', 'cloud rap', 'drill', 'phonk', 'future bass',
  'afrobeats', 'reggaeton', 'amapiano', 'K-hip hop', 'UK drill',
  'Latin trap', 'neo soul', 'hyperpop', 'pluggnb',
];

export interface SoundCloudDiscoveryConfig {
  maxQueries?: number;
}

export async function discoverSoundCloudArtists(config: SoundCloudDiscoveryConfig = {}): Promise<RawArtistLead[]> {
  const { maxQueries = 15 } = config;

  const poolInfo = getPoolStats();
  if (!poolInfo.hasBackup && poolInfo.activeKey === 'primary' && poolInfo.primaryErrors > 3) {
    console.warn('[ArtistDiscovery:SoundCloud] Pool appears exhausted, skipping');
    return [];
  }

  const allLeads: RawArtistLead[] = [];

  // Mix generic + genre queries
  const genreQ = shuffleArray(GENRE_QUERIES).slice(0, 5).map(g =>
    `site:soundcloud.com "${g}" email artist independent`
  );
  const queries = shuffleArray([...SOUNDCLOUD_QUERIES, ...genreQ]).slice(0, maxQueries);

  console.log(`[ArtistDiscovery:SoundCloud] Running ${queries.length} queries`);

  const batches = chunkArray(queries, 10);

  for (const batch of batches) {
    try {
      const items = await runActorAndGetItems(GOOGLE_SEARCH_ACTOR, {
        queries: batch.join('\n'),
        maxPagesPerQuery: 2,
        resultsPerPage: 40,
        languageCode: '',
        mobileResults: false,
      }, { waitSecs: 120 });

      for (const item of items) {
        const lead = extractSoundCloudArtist(item);
        if (lead) allLeads.push(lead);
      }
    } catch (err: any) {
      console.error(`[ArtistDiscovery:SoundCloud] Batch error:`, err.message?.slice(0, 200));
    }

    await sleep(2000);
  }

  console.log(`[ArtistDiscovery:SoundCloud] Found ${allLeads.length} raw leads`);
  return allLeads;
}

function extractSoundCloudArtist(result: any): RawArtistLead | null {
  const title = result.title || '';
  const description = result.description || '';
  const url = result.url || '';
  const text = `${title} ${description}`;

  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (!emailMatch) return null;

  // Extract name from SoundCloud URL or title
  let name = '';
  const scMatch = url.match(/soundcloud\.com\/([^/?\s]+)/);
  if (scMatch && scMatch[1] !== 'tags' && scMatch[1] !== 'search' && scMatch[1] !== 'discover') {
    name = scMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  if (!name || name.length < 2) {
    name = title.replace(/\s*[-–—|·].*SoundCloud.*$/i, '').replace(/Stream .* by /, '').trim();
  }
  if (!name || name.length < 2) return null;

  return {
    fullName: name,
    email: emailMatch[0].toLowerCase(),
    soundcloudUrl: url.includes('soundcloud.com') ? url : undefined,
    industry: 'Music',
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
