/**
 * Google AI Search Agent — Artist Discovery
 * Uses OpenAI + Apify Google Search to intelligently find independent artists.
 * The AI generates targeted queries, rotates by country/genre, and extracts contacts.
 */

import { createTrackedOpenAI } from '../../utils/tracked-openai';
import { ApifyClient } from 'apify-client';
import type { RawArtistLead } from './ingestion-pipeline';
import { PRIMARY_MODEL } from '../../utils/ai-config';
import { isApifyExhausted, isApifyExhaustionError, markApifyExhausted } from './apify-client-pool';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || '';
const apifyClient = new ApifyClient({ token: APIFY_TOKEN });
const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Target countries with music scenes — aggressive coverage
const TARGET_COUNTRIES = [
  'United States', 'United Kingdom', 'Mexico', 'Spain', 'Colombia', 'Brazil',
  'France', 'Germany', 'Nigeria', 'Argentina', 'Canada', 'South Korea',
  'Japan', 'Australia', 'Italy', 'Chile', 'South Africa', 'Ghana', 'Kenya',
  'India', 'Peru', 'Sweden', 'Netherlands', 'Portugal', 'Dominican Republic',
  'Puerto Rico', 'Cuba', 'Ecuador', 'Venezuela', 'Bolivia', 'Paraguay',
  'Uruguay', 'Costa Rica', 'Panama', 'Guatemala', 'Honduras', 'El Salvador',
  'Jamaica', 'Trinidad and Tobago', 'Philippines', 'Indonesia', 'Thailand',
  'Vietnam', 'Egypt', 'Morocco', 'Tunisia', 'Senegal', 'Tanzania',
  'Ethiopia', 'Democratic Republic of Congo', 'Cameroon', 'Ivory Coast',
  'Poland', 'Czech Republic', 'Romania', 'Hungary', 'Greece', 'Turkey',
  'Israel', 'Lebanon', 'UAE', 'Saudi Arabia', 'New Zealand', 'Ireland',
  'Belgium', 'Switzerland', 'Austria', 'Norway', 'Denmark', 'Finland',
  'Croatia', 'Serbia', 'Ukraine', 'Russia',
];

const GENRE_KEYWORDS = [
  'hip hop', 'rap', 'trap', 'drill', 'R&B', 'soul', 'pop', 'indie pop',
  'rock', 'indie rock', 'alternative', 'electronic', 'EDM', 'house', 'techno',
  'reggaeton', 'latin trap', 'urbano', 'cumbia', 'salsa', 'bachata',
  'afrobeats', 'amapiano', 'afropop', 'gengetone', 'bongo flava',
  'K-pop', 'J-pop', 'city pop', 'K-hip hop', 'Bollywood', 'desi hip hop',
  'country', 'folk', 'bluegrass', 'jazz', 'neo-soul', 'funk',
  'metal', 'punk', 'hardcore', 'emo', 'post-punk',
  'reggae', 'dancehall', 'soca', 'calypso',
  'lo-fi', 'synthwave', 'vaporwave', 'ambient', 'experimental',
];

export interface GoogleAIDiscoveryConfig {
  maxCountries?: number;
  maxQueriesPerCountry?: number;
  useAI?: boolean;
}

/**
 * Generate smart search queries using OpenAI
 */
async function generateSmartQueries(country: string, existingCount: number): Promise<string[]> {
  try {
    const genres = shuffleArray(GENRE_KEYWORDS).slice(0, 5).join(', ');
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{
        role: 'system',
        content: 'You generate Google search queries to find independent/unsigned musicians with email contact info. Return ONLY the queries, one per line. Be creative and specific. Target artists who have their email publicly available on websites, social media bios, or music platforms.'
      }, {
        role: 'user',
        content: `Generate 6 Google search queries to find independent/unsigned music artists from ${country}.
Focus on genres: ${genres}.
Target: artists with contact emails visible on their pages.
Include queries for:
1. Linktree/bio link pages with emails
2. Music platform profiles (Spotify, SoundCloud, Bandcamp)
3. Social media bios with email
4. Artist websites with contact forms/emails
5. Music blogs featuring independent artists from ${country}
6. Festival lineups of unsigned artists

Return ONLY search queries, one per line, no numbering or explanation.`
      }],
      temperature: 0.9,
      max_tokens: 500,
    });

    const text = response.choices[0]?.message?.content || '';
    return text.split('\n').map(q => q.trim()).filter(q => q.length > 10);
  } catch (err: any) {
    console.error(`[ArtistDiscovery:GoogleAI] AI query gen error:`, err.message?.slice(0, 100));
    // Fallback queries
    return [
      `independent artist ${country} email contact`,
      `unsigned musician ${country} booking email`,
      `"contact me" independent artist ${country} music`,
      `site:linktr.ee artist ${country} music email`,
    ];
  }
}

/**
 * AI-powered extraction from search results
 */
async function aiExtractArtists(results: any[]): Promise<RawArtistLead[]> {
  if (results.length === 0) return [];

  const summaries = results.slice(0, 30).map(r => ({
    title: (r.title || '').slice(0, 100),
    desc: (r.description || '').slice(0, 200),
    url: (r.url || '').slice(0, 150),
  }));

  try {
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{
        role: 'system',
        content: `You extract music industry contact information from Google search results. Return a JSON object with an "artists" array. Each object should have: fullName, email, genre, country, city, spotifyUrl, bandcampUrl, instagramHandle, entityType (one of: "artist", "record-label", "producer", "dj", "band", "podcast", "venue", "festival", "management", "media"), companyDescription (short description if it's a business entity). Only include entries where you can identify a real name AND an email. Be strict about email validity.`
      }, {
        role: 'user',
        content: `Extract music industry contacts from these search results:\n${JSON.stringify(summaries)}\n\nReturn JSON object with "artists" array only.`
      }],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{"artists":[]}');
    const artists = parsed.artists || parsed.results || parsed || [];

    if (!Array.isArray(artists)) return [];

    return artists
      .filter((a: any) => a.fullName && a.email)
      .map((a: any) => ({
        fullName: a.fullName,
        email: a.email?.toLowerCase()?.trim(),
        genre: a.genre,
        country: a.country,
        city: a.city,
        spotifyUrl: a.spotifyUrl,
        bandcampUrl: a.bandcampUrl,
        instagramHandle: a.instagramHandle,
        companyDescription: a.companyDescription || null,
        industry: 'Music',
      }));
  } catch (err: any) {
    console.error(`[ArtistDiscovery:GoogleAI] AI extraction error:`, err.message?.slice(0, 100));
    // Fallback: regex extraction
    return results
      .map(r => {
        const text = `${r.title || ''} ${r.description || ''}`;
        const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
        if (!emailMatch) return null;
        const name = (r.title || '').replace(/\s*[-–—|·].*$/, '').trim();
        if (!name || name.length < 2) return null;
        return { fullName: name, email: emailMatch[0].toLowerCase(), industry: 'Music' };
      })
      .filter(Boolean) as RawArtistLead[];
  }
}

/**
 * Main Google AI discovery function
 */
export async function discoverGoogleAIArtists(config: GoogleAIDiscoveryConfig = {}): Promise<RawArtistLead[]> {
  const {
    maxCountries = 15,
    maxQueriesPerCountry = 6,
    useAI = true,
  } = config;

  if (!APIFY_TOKEN) {
    console.error('[ArtistDiscovery:GoogleAI] No APIFY_API_TOKEN set');
    return [];
  }

  // This source scrapes Google via Apify. If Apify is exhausted there is no
  // point generating AI queries (which burns OpenAI tokens) — skip entirely.
  if (isApifyExhausted()) {
    console.log('[ArtistDiscovery:GoogleAI] Apify exhausted — skipping to save OpenAI tokens');
    return [];
  }

  const allLeads: RawArtistLead[] = [];
  const countries = shuffleArray(TARGET_COUNTRIES).slice(0, maxCountries);

  console.log(`[ArtistDiscovery:GoogleAI] Targeting ${countries.length} countries: ${countries.join(', ')}`);

  for (const country of countries) {
    try {
      // Generate queries (AI or fallback)
      const queries = useAI
        ? await generateSmartQueries(country, allLeads.length)
        : [`independent artist ${country} email contact`, `unsigned musician ${country} booking`];

      const limitedQueries = queries.slice(0, maxQueriesPerCountry);

      console.log(`[ArtistDiscovery:GoogleAI] ${country}: ${limitedQueries.length} queries`);

      const run = await apifyClient.actor(GOOGLE_SEARCH_ACTOR).call({
        queries: limitedQueries.join('\n'),
        maxPagesPerQuery: 2,
        resultsPerPage: 30,
        languageCode: '',
        mobileResults: false,
      }, {
        waitSecs: 120,

      });

      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

      // AI extraction or regex fallback
      const leads = useAI
        ? await aiExtractArtists(items)
        : regexExtractArtists(items);

      // Add country to all leads from this batch
      for (const lead of leads) {
        if (!lead.country) lead.country = country;
        allLeads.push(lead);
      }

      console.log(`[ArtistDiscovery:GoogleAI] ${country}: found ${leads.length} leads`);
    } catch (err: any) {
      console.error(`[ArtistDiscovery:GoogleAI] ${country} error:`, err.message?.slice(0, 200));
      // If Apify hit its quota, stop iterating countries (every call will fail
      // and AI query generation just wastes tokens).
      if (isApifyExhaustionError(err)) {
        markApifyExhausted(err.message);
        console.log('[ArtistDiscovery:GoogleAI] Apify quota exhausted — aborting remaining countries');
        break;
      }
    }

    // Rate limiting
    await sleep(3000);
  }

  console.log(`[ArtistDiscovery:GoogleAI] Total: ${allLeads.length} raw leads from ${countries.length} countries`);
  return allLeads;
}

function regexExtractArtists(items: any[]): RawArtistLead[] {
  return items
    .map(r => {
      const text = `${r.title || ''} ${r.description || ''}`;
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
      if (!emailMatch) return null;
      const name = (r.title || '').replace(/\s*[-–—|·].*$/, '').trim();
      if (!name || name.length < 2) return null;
      return { fullName: name, email: emailMatch[0].toLowerCase(), jobTitle: 'Independent Artist', industry: 'Music' };
    })
    .filter(Boolean) as RawArtistLead[];
}

function shuffleArray<T>(arr: T[]): T[] {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
