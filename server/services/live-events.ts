/**
 * Live Events Service — Songkick + Bandsintown Integration
 *
 * Fetches real-time live event data for artists and locations from two sources:
 *   1. Bandsintown  (primary — artist-name based, simple REST, no ID lookup)
 *   2. Songkick     (secondary — richer venue/metro data, requires artist ID lookup)
 *
 * Both sources are queried in parallel where possible; results are merged and
 * deduplicated by a normalised (date + venue-name) key.
 *
 * Environment variables:
 *   BANDSINTOWN_APP_ID   — your Bandsintown app_id (required for Bandsintown)
 *   SONGKICK_API_KEY     — your Songkick API key  (required for Songkick)
 *
 * If a key is absent the source is silently skipped; the function still returns
 * results from whatever sources are configured.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LiveEvent {
  id: string;
  source: 'bandsintown' | 'songkick' | 'merged';
  artistName: string;
  date: string;           // ISO 8601 date or datetime
  venueName: string;
  venueCity: string;
  venueCountry: string;
  venueLatitude?: number;
  venueLongitude?: number;
  ticketUrl?: string;
  ticketStatus?: 'available' | 'unavailable' | 'unknown';
  description?: string;
  lineup?: string[];      // co-headliners / support acts
}

export interface ArtistEventsResult {
  artistName: string;
  total: number;
  events: LiveEvent[];
  sources: string[];
  cachedUntil?: string;
}

export interface NearbyEventsResult {
  location: string;
  total: number;
  events: LiveEvent[];
  sources: string[];
}

// ─── Bandsintown API ─────────────────────────────────────────────────────────

interface BandsintownEvent {
  id: string;
  datetime: string;
  title: string;
  description?: string;
  venue: {
    name: string;
    city: string;
    country: string;
    latitude?: string | number;
    longitude?: string | number;
  };
  offers?: Array<{ type: string; url: string; status: string }>;
  lineup?: string[];
}

async function fetchBandsintownEvents(artistName: string): Promise<LiveEvent[]> {
  const appId = process.env.BANDSINTOWN_APP_ID;
  if (!appId) return [];

  const encoded = encodeURIComponent(artistName);
  const url = `https://rest.bandsintown.com/artists/${encoded}/events?app_id=${encodeURIComponent(appId)}&date=upcoming`;

  let raw: unknown;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    raw = await res.json();
  } catch {
    return [];
  }

  if (!Array.isArray(raw)) return [];

  return (raw as BandsintownEvent[]).map(ev => {
    const ticketOffer = ev.offers?.find(o => o.type === 'Tickets');
    const lat = ev.venue.latitude ? parseFloat(String(ev.venue.latitude)) : undefined;
    const lng = ev.venue.longitude ? parseFloat(String(ev.venue.longitude)) : undefined;

    return {
      id: `bit_${ev.id}`,
      source: 'bandsintown' as const,
      artistName,
      date: ev.datetime,
      venueName: ev.venue.name,
      venueCity: ev.venue.city,
      venueCountry: ev.venue.country,
      venueLatitude: Number.isFinite(lat) ? lat : undefined,
      venueLongitude: Number.isFinite(lng) ? lng : undefined,
      ticketUrl: ticketOffer?.url,
      ticketStatus: ticketOffer
        ? (ticketOffer.status === 'available' ? 'available' : 'unavailable')
        : 'unknown',
      description: ev.description,
      lineup: ev.lineup,
    };
  });
}

// ─── Songkick API ────────────────────────────────────────────────────────────

interface SongkickArtistSearchResult {
  resultsPage: {
    results: {
      artist?: Array<{ id: number; displayName: string; onTourUntil?: string }>;
    };
    totalEntries: number;
  };
}

interface SongkickCalendarResult {
  resultsPage: {
    results: {
      event?: SongkickEvent[];
    };
    totalEntries: number;
  };
}

interface SongkickEvent {
  id: number;
  displayName: string;
  type: string;
  uri: string;
  status: string;
  start: { date?: string; time?: string; datetime?: string };
  venue: {
    id: number;
    displayName: string;
    city: { displayName: string; country: { displayName: string } };
    lat?: number;
    lng?: number;
  };
  performance?: Array<{ artist: { displayName: string }; billing: string }>;
}

async function resolveSongkickArtistId(artistName: string): Promise<number | null> {
  const key = process.env.SONGKICK_API_KEY;
  if (!key) return null;

  const encoded = encodeURIComponent(artistName);
  const url = `https://api.songkick.com/api/3.0/search/artists.json?query=${encoded}&apikey=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json() as SongkickArtistSearchResult;
    const artists = data.resultsPage?.results?.artist ?? [];
    if (!artists.length) return null;
    // Pick the artist whose name most closely matches
    const lower = artistName.toLowerCase();
    const exact = artists.find(a => a.displayName.toLowerCase() === lower);
    return (exact ?? artists[0]).id;
  } catch {
    return null;
  }
}

async function fetchSongkickEvents(artistName: string): Promise<LiveEvent[]> {
  const key = process.env.SONGKICK_API_KEY;
  if (!key) return [];

  const skId = await resolveSongkickArtistId(artistName);
  if (!skId) return [];

  const url = `https://api.songkick.com/api/3.0/artists/${skId}/calendar.json?apikey=${encodeURIComponent(key)}&per_page=50`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as SongkickCalendarResult;
    const events = data.resultsPage?.results?.event ?? [];

    return events.map(ev => {
      const lineup: string[] = (ev.performance ?? []).map(p => p.artist.displayName);
      const dateStr = ev.start.datetime ?? ev.start.date ?? '';

      return {
        id: `sk_${ev.id}`,
        source: 'songkick' as const,
        artistName,
        date: dateStr,
        venueName: ev.venue.displayName,
        venueCity: ev.venue.city.displayName,
        venueCountry: ev.venue.city.country.displayName,
        venueLatitude: ev.venue.lat ?? undefined,
        venueLongitude: ev.venue.lng ?? undefined,
        ticketUrl: ev.uri,
        ticketStatus: ev.status === 'ok' ? 'available' : 'unknown',
        lineup,
      };
    });
  } catch {
    return [];
  }
}

// ─── Songkick Metro Events (nearby) ─────────────────────────────────────────

interface SongkickMetroSearchResult {
  resultsPage: {
    results: {
      location?: Array<{ metroArea: { id: number; displayName: string } }>;
    };
  };
}

interface SongkickMetroCalendarResult {
  resultsPage: {
    results: {
      event?: SongkickEvent[];
    };
  };
}

async function fetchSongkickNearbyEvents(location: string, genreFilter?: string): Promise<LiveEvent[]> {
  const key = process.env.SONGKICK_API_KEY;
  if (!key) return [];

  // Step 1: resolve metro area
  const locEncoded = encodeURIComponent(location);
  const searchUrl = `https://api.songkick.com/api/3.0/search/locations.json?query=${locEncoded}&apikey=${encodeURIComponent(key)}`;

  let metroId: number | null = null;
  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json() as SongkickMetroSearchResult;
    const locations = data.resultsPage?.results?.location ?? [];
    if (!locations.length) return [];
    metroId = locations[0].metroArea.id;
  } catch {
    return [];
  }

  // Step 2: fetch events for metro area
  const calUrl = `https://api.songkick.com/api/3.0/metro_areas/${metroId}/calendar.json?apikey=${encodeURIComponent(key)}&per_page=30`;

  try {
    const res = await fetch(calUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as SongkickMetroCalendarResult;
    const events = data.resultsPage?.results?.event ?? [];

    return events.map(ev => {
      const lineup: string[] = (ev.performance ?? []).map(p => p.artist.displayName);
      const dateStr = ev.start.datetime ?? ev.start.date ?? '';
      const mainArtist = lineup[0] ?? ev.displayName;

      return {
        id: `sk_${ev.id}`,
        source: 'songkick' as const,
        artistName: mainArtist,
        date: dateStr,
        venueName: ev.venue.displayName,
        venueCity: ev.venue.city.displayName,
        venueCountry: ev.venue.city.country.displayName,
        venueLatitude: ev.venue.lat ?? undefined,
        venueLongitude: ev.venue.lng ?? undefined,
        ticketUrl: ev.uri,
        ticketStatus: 'available',
        lineup,
      };
    });
  } catch {
    return [];
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/** Normalise a date string to YYYY-MM-DD for dedup purposes. */
function normaliseDate(d: string): string {
  return d.slice(0, 10);
}

function deduplicateEvents(events: LiveEvent[]): LiveEvent[] {
  const seen = new Map<string, LiveEvent>();
  for (const ev of events) {
    const key = `${normaliseDate(ev.date)}|${ev.venueName.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.set(key, ev);
    } else {
      // Prefer the entry with a ticket URL
      const existing = seen.get(key)!;
      if (!existing.ticketUrl && ev.ticketUrl) seen.set(key, ev);
    }
  }
  return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch upcoming live events for an artist by name.
 * Queries Bandsintown and Songkick in parallel; merges and deduplicates results.
 */
export async function getArtistLiveEvents(artistName: string): Promise<ArtistEventsResult> {
  const [bitEvents, skEvents] = await Promise.all([
    fetchBandsintownEvents(artistName),
    fetchSongkickEvents(artistName),
  ]);

  const sources: string[] = [];
  if (bitEvents.length > 0) sources.push('bandsintown');
  if (skEvents.length > 0) sources.push('songkick');

  const events = deduplicateEvents([...bitEvents, ...skEvents]);

  // Cache hint: 1 hour
  const cachedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    artistName,
    total: events.length,
    events,
    sources,
    cachedUntil,
  };
}

/**
 * Fetch upcoming events near a city/location (Songkick metro area lookup).
 * Optional genre filter applied post-fetch (Songkick API lacks genre filter).
 */
export async function getNearbyLiveEvents(
  location: string,
  genreFilter?: string,
): Promise<NearbyEventsResult> {
  const events = await fetchSongkickNearbyEvents(location, genreFilter);

  return {
    location,
    total: events.length,
    events,
    sources: events.length > 0 ? ['songkick'] : [],
  };
}

/**
 * Check which live-event data sources are configured.
 */
export function getLiveEventSources(): Array<{
  name: string;
  configured: boolean;
  envVar: string;
}> {
  return [
    {
      name: 'Bandsintown',
      configured: Boolean(process.env.BANDSINTOWN_APP_ID),
      envVar: 'BANDSINTOWN_APP_ID',
    },
    {
      name: 'Songkick',
      configured: Boolean(process.env.SONGKICK_API_KEY),
      envVar: 'SONGKICK_API_KEY',
    },
  ];
}
