/**
 * YouTube Artist Discovery
 * Uses Apify Google Search to find independent artists with YouTube channels.
 * Strategy: Search for artist channels with email/contact info in descriptions.
 */

import type { RawArtistLead } from './ingestion-pipeline';
import { runActorAndGetItems, getPoolStats } from './apify-client-pool';

const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';

// ─── Search Queries ──────────────────────────────────────────────

const YOUTUBE_QUERIES_EN = [
  'site:youtube.com "official music video" independent artist email',
  'site:youtube.com "@gmail.com" unsigned artist music video',
  'site:youtube.com "booking" "email" independent rapper',
  'site:youtube.com "contact" "unsigned" singer songwriter',
  'site:youtube.com "for bookings" email hip hop artist',
  'site:youtube.com "independent artist" "email" new music 2025',
  'site:youtube.com "@gmail.com" "official audio" unsigned',
  'site:youtube.com "bedroom producer" email beats',
  'site:youtube.com "unsigned" "contact" "artist" lofi OR trap OR drill',
  'site:youtube.com "indie artist" "booking inquiries" email',
  'site:youtube.com "emerging artist" "email" music video',
  'site:youtube.com "management" "@" new rapper 2025',
  'site:youtube.com/channel independent musician email contact',
  'site:youtube.com "first single" OR "debut" unsigned artist "@gmail"',
];

const YOUTUBE_QUERIES_ES = [
  'site:youtube.com "artista independiente" email video musical',
  'site:youtube.com "@gmail.com" rapero independiente video oficial',
  'site:youtube.com "contacto" "artista urbano" sin sello',
  'site:youtube.com "nuevo artista" email reggaeton OR trap latino',
  'site:youtube.com "artista independiente" "correo" contacto música',
  'site:youtube.com "booking" email cantante latino independiente',
];

const YOUTUBE_QUERIES_PT = [
  'site:youtube.com "artista independente" email Brasil',
  'site:youtube.com "@gmail.com" rapper brasileiro video clipe',
  'site:youtube.com "contato" "artista" independente funk OR rap',
];

const YOUTUBE_QUERIES_FR = [
  'site:youtube.com "artiste indépendant" email clip officiel',
  'site:youtube.com "@gmail.com" rappeur français unsigned',
];

const YOUTUBE_QUERIES_GENRE = [
  'site:youtube.com "afrobeats" unsigned artist email official video',
  'site:youtube.com "amapiano" artist email contact 2025',
  'site:youtube.com "K-indie" OR "Korean indie" artist email',
  'site:youtube.com "UK drill" unsigned artist email',
  'site:youtube.com "Latin trap" artista email video',
  'site:youtube.com "phonk" producer email official audio',
  'site:youtube.com "hyperpop" OR "pluggnb" artist email',
  'site:youtube.com "neo soul" independent artist email',
  'site:youtube.com "reggae" OR "dancehall" unsigned artist email',
  'site:youtube.com "synthwave" OR "retrowave" producer email',
];

const ALL_QUERIES = [
  ...YOUTUBE_QUERIES_EN,
  ...YOUTUBE_QUERIES_ES,
  ...YOUTUBE_QUERIES_PT,
  ...YOUTUBE_QUERIES_FR,
  ...YOUTUBE_QUERIES_GENRE,
];

// ─── Config ──────────────────────────────────────────────────────

export interface YouTubeDiscoveryConfig {
  maxQueries?: number;
  maxResultsPerQuery?: number;
}

// ─── Main Discovery ──────────────────────────────────────────────

export async function discoverYouTubeArtists(config: YouTubeDiscoveryConfig = {}): Promise<RawArtistLead[]> {
  const {
    maxQueries = 20,
    maxResultsPerQuery = 40,
  } = config;

  const poolInfo = getPoolStats();
  if (!poolInfo.hasBackup && poolInfo.activeKey === 'primary' && poolInfo.primaryErrors > 3) {
    console.warn('[ArtistDiscovery:YouTube] Pool appears exhausted, skipping');
    return [];
  }

  const allLeads: RawArtistLead[] = [];

  // Shuffle and select queries for this run
  const queries = shuffleArray(ALL_QUERIES).slice(0, maxQueries);

  console.log(`[ArtistDiscovery:YouTube] Running ${queries.length} queries`);

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
        const lead = extractYouTubeArtist(item);
        if (lead) allLeads.push(lead);
      }
    } catch (err: any) {
      console.error(`[ArtistDiscovery:YouTube] Batch error:`, err.message?.slice(0, 200));
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

  console.log(`[ArtistDiscovery:YouTube] Found ${unique.length} unique leads (${allLeads.length} raw)`);
  return unique;
}

// ─── Extract Artist from Search Result ───────────────────────────

function extractYouTubeArtist(result: any): RawArtistLead | null {
  const title = result.title || '';
  const description = result.description || '';
  const url = result.url || '';
  const text = `${title} ${description}`;

  // Must have an email to be useful
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (!emailMatch) return null;

  const email = emailMatch[0].toLowerCase();

  // Skip obvious non-artist emails
  if (email.includes('youtube.com') || email.includes('google.com') || email.includes('example.com')) {
    return null;
  }

  // Extract artist name from title
  let name = title
    // Remove common YouTube suffixes
    .replace(/\s*[-–—|·•]\s*YouTube.*$/i, '')
    .replace(/\s*\(Official\s*(Music\s*)?Video\).*$/i, '')
    .replace(/\s*\(Official\s*Audio\).*$/i, '')
    .replace(/\s*\(Lyric\s*Video\).*$/i, '')
    .replace(/\s*\[Official\s*(Music\s*)?Video\].*$/i, '')
    .replace(/\s*\[Official\s*Audio\].*$/i, '')
    .replace(/\s*-\s*Topic$/i, '')
    // Common patterns: "Artist - Song Title"
    .replace(/\s*[-–—]\s*.+$/, '')
    .trim();

  if (!name || name.length < 2 || name.length > 80) return null;

  // Try to extract genre from description/title
  const genreMatch = description.match(
    /\b(hip[\s-]?hop|rap|trap|r&b|rnb|pop|rock|indie|electronic|lo[\s-]?fi|drill|afrobeats|reggaeton|amapiano|soul|jazz|folk|punk|metal|country|k[\s-]?pop|latin|reggae|dancehall|phonk|synthwave|grime)\b/i
  );

  // Extract YouTube channel/video URL
  let youtubeUrl: string | undefined;
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    youtubeUrl = url;
  }

  // Try to extract location from description
  const locationMatch = description.match(/(?:from|based in|located in|born in)\s+([\w\s,]+?)(?:\.|,\s*\w|$)/i);

  const lead: RawArtistLead = {
    fullName: name,
    email,
    industry: 'Music',
    genre: genreMatch?.[1],
    youtubeUrl,
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
