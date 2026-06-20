/**
 * Apify Instagram Artist Discovery
 * Finds independent artists via music-related Instagram hashtags.
 */

import type { RawArtistLead } from './ingestion-pipeline';
import { runActorWithFailover, getDatasetItems, getPoolStats } from './apify-client-pool';

const INSTAGRAM_SCRAPER_ACTOR = 'apify/instagram-scraper';

// Music hashtags with high volume of independent artists
const MUSIC_HASHTAGS = [
  'independentartist', 'unsignedartist', 'newmusic', 'indieartist',
  'newmusicfriday', 'unsignedhype', 'undergroundhiphop', 'indiemusic',
  'emergingartist', 'upcomingartist', 'bedroomproducer', 'soundcloudrapper',
  'singersongwriter', 'musicproducer', 'rapperlife', 'indierap',
  'latinmusic', 'musicaindependiente', 'artistaindependiente',
  'afrobeats', 'africanmusic', 'gengetone', 'amapiano',
  'kpopindependent', 'jindie', 'koreanindiemusic',
  'ukmusic', 'grime', 'ukdrill', 'frenchrap', 'deutschrap',
  'trapmusic', 'lofi', 'synthwave', 'indierock', 'altrnb',
  'diymusician', 'independentmusic', 'unsigned', 'newartistalert',
  'musicislife', 'newrelease', 'debutalbum', 'firstsingle',
  'bookinginfo', 'needadistributor', 'musicbusiness',
  'indieartists2025', 'rapperswanted', 'submitmusic',
  'unsignedtalent', 'musicemaildrop', 'collabswanted',
  'undergroundrap', 'indiepop', 'neosoul', 'pluggnb',
];

export interface InstagramDiscoveryConfig {
  hashtags?: string[];
  maxPostsPerHashtag?: number;
  maxHashtags?: number;
}

export async function discoverInstagramArtists(config: InstagramDiscoveryConfig = {}): Promise<RawArtistLead[]> {
  const {
    hashtags = MUSIC_HASHTAGS,
    maxPostsPerHashtag = 30,
    maxHashtags = 10,
  } = config;

  const poolInfo = getPoolStats();
  if (!poolInfo.hasBackup && poolInfo.activeKey === 'primary' && poolInfo.primaryErrors > 3) {
    console.warn('[ArtistDiscovery:Instagram] Pool appears exhausted, skipping');
    return [];
  }

  const allLeads: RawArtistLead[] = [];
  const selectedHashtags = shuffleArray(hashtags).slice(0, maxHashtags);
  const urls = selectedHashtags.map(h => `https://www.instagram.com/explore/tags/${h}/`);

  console.log(`[ArtistDiscovery:Instagram] Scraping ${selectedHashtags.length} hashtags`);

  try {
    const { defaultDatasetId, client } = await runActorWithFailover(INSTAGRAM_SCRAPER_ACTOR, {
      directUrls: urls,
      resultsType: 'posts',
      resultsLimit: maxPostsPerHashtag,
      searchType: 'hashtag',
      searchLimit: maxPostsPerHashtag,
    }, { waitSecs: 300 });

    const items = await getDatasetItems(client, defaultDatasetId);
    const seenUsernames = new Set<string>();

    for (const post of items) {
      const ownerAny = (post.owner || {}) as any;
      const username = (post.ownerUsername || ownerAny.username) as string | undefined;
      if (!username || seenUsernames.has(username)) continue;
      seenUsernames.add(username);

      // Extract email from bio or caption
      const bio = (post.ownerBiography || ownerAny.biography || '') as string;
      const caption = (post.caption || '') as string;
      const text = `${bio} ${caption}`;
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);

      if (!emailMatch) continue;

      const fullName = (post.ownerFullName || ownerAny.fullName || username) as string;

      allLeads.push({
        fullName,
        email: emailMatch[0].toLowerCase(),
        instagramHandle: username,
        industry: 'Music',
        followers: (post.ownerFollowers || ownerAny.followersCount) as number | undefined,
      });
    }
  } catch (err: any) {
    console.error(`[ArtistDiscovery:Instagram] Error:`, err.message?.slice(0, 200));
  }

  console.log(`[ArtistDiscovery:Instagram] Found ${allLeads.length} raw leads`);
  return allLeads;
}

function shuffleArray<T>(arr: T[]): T[] {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}
