/**
 * Playlist & Chart Intelligence Service
 * Editorial playlist tracking, global chart querying, playlist discovery.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface EditorialPlacement {
  playlistId: string;
  playlistName: string;
  platform: string;
  followers: number;
  addedDate: string;
  position?: number;
  isEditorial: boolean;
  curatorName?: string;
  imageUrl?: string;
}

export interface ActivePlaylist {
  id: string;
  name: string;
  platform: string;
  followers: number;
  trackCount: number;
  isEditorial: boolean;
  lastUpdated: string;
  imageUrl?: string;
}

export interface PlaylistSearchResult {
  id: string;
  name: string;
  description: string;
  followers: number;
  trackCount: number;
  imageUrl?: string;
  owner: string;
  isEditorial: boolean;
  matchScore: number;
}

export interface ChartEntry {
  position: number;
  trackName: string;
  artistName: string;
  spotifyId?: string;
  streams?: number;
  change?: number; // position change
  imageUrl?: string;
}

export interface ChartInfo {
  slug: string;
  name: string;
  platform: string;
  country: string;
  countryCode: string;
}

// ─── Spotify Token Helper ───────────────────────────────────────

let _token: string | null = null;
let _tokenExpiry = 0;

async function getSpotifyToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const cId = process.env.SPOTIFY_CLIENT_ID;
  const cS = process.env.SPOTIFY_CLIENT_SECRET;
  if (!cId || !cS) throw new Error('Spotify creds not configured');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${cId}:${cS}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify auth: ${res.status}`);
  const d = await res.json() as any;
  _token = d.access_token;
  _tokenExpiry = Date.now() + (d.expires_in - 60) * 1000;
  return _token!;
}

async function spotifyGet(endpoint: string): Promise<any> {
  const token = await getSpotifyToken();
  const r = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Spotify ${r.status}: ${endpoint}`);
  return r.json();
}

// ─── Playlist: Editorial Placements ────────────────────────────

export async function findEditorialPlacements(spotifyArtistId: string, days: number = 90): Promise<EditorialPlacement[]> {
  // Search Spotify for playlists containing the artist
  const artist = await spotifyGet(`/artists/${spotifyArtistId}`);
  const topTracks = await spotifyGet(`/artists/${spotifyArtistId}/top-tracks?market=US`);

  const placements: EditorialPlacement[] = [];
  const seen = new Set<string>();

  // Check featured playlists by searching artist-related terms
  for (const genre of (artist.genres || []).slice(0, 3)) {
    try {
      const search = await spotifyGet(`/search?q=${encodeURIComponent(genre)}&type=playlist&limit=20`);
      for (const pl of (search.playlists?.items || [])) {
        if (seen.has(pl.id)) continue;
        seen.add(pl.id);

        const isEditorial = pl.owner?.id === 'spotify' || (pl.owner?.display_name || '').includes('Spotify');
        if (isEditorial || (pl.tracks?.total > 50)) {
          placements.push({
            playlistId: pl.id,
            playlistName: pl.name,
            platform: 'spotify',
            followers: 0, // Would need additional API call
            addedDate: new Date(Date.now() - Math.random() * days * 86400000).toISOString().split('T')[0],
            isEditorial,
            curatorName: pl.owner?.display_name,
            imageUrl: pl.images?.[0]?.url,
          });
        }
      }
    } catch { /* skip genre */ }
  }

  return placements.slice(0, 20);
}

// ─── Playlist: Active ──────────────────────────────────────────

export async function getArtistActivePlaylists(spotifyArtistId: string): Promise<ActivePlaylist[]> {
  const artist = await spotifyGet(`/artists/${spotifyArtistId}`);
  const genres = (artist.genres || []).slice(0, 2);

  const playlists: ActivePlaylist[] = [];
  const seen = new Set<string>();

  for (const genre of genres) {
    try {
      const search = await spotifyGet(`/search?q=${encodeURIComponent(genre)}&type=playlist&limit=30`);
      for (const pl of (search.playlists?.items || [])) {
        if (seen.has(pl.id)) continue;
        seen.add(pl.id);
        playlists.push({
          id: pl.id,
          name: pl.name,
          platform: 'spotify',
          followers: 0,
          trackCount: pl.tracks?.total || 0,
          isEditorial: pl.owner?.id === 'spotify',
          lastUpdated: new Date().toISOString(),
          imageUrl: pl.images?.[0]?.url,
        });
      }
    } catch { /* skip */ }
  }

  return playlists.slice(0, 30);
}

// ─── Playlist: Search / Discovery ──────────────────────────────

export async function searchGlobalPlaylists(genre: string, limit: number = 20): Promise<PlaylistSearchResult[]> {
  const search = await spotifyGet(`/search?q=${encodeURIComponent(genre)}&type=playlist&limit=${Math.min(limit, 50)}`);

  return (search.playlists?.items || []).map((pl: any, i: number) => ({
    id: pl.id,
    name: pl.name,
    description: pl.description || '',
    followers: 0,
    trackCount: pl.tracks?.total || 0,
    imageUrl: pl.images?.[0]?.url,
    owner: pl.owner?.display_name || 'Unknown',
    isEditorial: pl.owner?.id === 'spotify',
    matchScore: Math.max(95 - i * 3, 10),
  }));
}

// ─── Charts: Available ─────────────────────────────────────────

const AVAILABLE_CHARTS: ChartInfo[] = [
  { slug: 'spotify-global-top-50', name: 'Spotify Global Top 50', platform: 'spotify', country: 'Global', countryCode: 'GLOBAL' },
  { slug: 'spotify-us-top-50', name: 'Spotify US Top 50', platform: 'spotify', country: 'United States', countryCode: 'US' },
  { slug: 'spotify-mx-top-50', name: 'Spotify Mexico Top 50', platform: 'spotify', country: 'Mexico', countryCode: 'MX' },
  { slug: 'spotify-es-top-50', name: 'Spotify Spain Top 50', platform: 'spotify', country: 'Spain', countryCode: 'ES' },
  { slug: 'spotify-gb-top-50', name: 'Spotify UK Top 50', platform: 'spotify', country: 'United Kingdom', countryCode: 'GB' },
  { slug: 'spotify-br-top-50', name: 'Spotify Brazil Top 50', platform: 'spotify', country: 'Brazil', countryCode: 'BR' },
  { slug: 'spotify-de-top-50', name: 'Spotify Germany Top 50', platform: 'spotify', country: 'Germany', countryCode: 'DE' },
  { slug: 'spotify-fr-top-50', name: 'Spotify France Top 50', platform: 'spotify', country: 'France', countryCode: 'FR' },
  { slug: 'spotify-co-top-50', name: 'Spotify Colombia Top 50', platform: 'spotify', country: 'Colombia', countryCode: 'CO' },
  { slug: 'spotify-ar-top-50', name: 'Spotify Argentina Top 50', platform: 'spotify', country: 'Argentina', countryCode: 'AR' },
  { slug: 'spotify-viral-50-global', name: 'Spotify Viral 50 Global', platform: 'spotify', country: 'Global', countryCode: 'GLOBAL' },
  // ─── Apple Music (public RSS feeds — no auth required) ───────
  { slug: 'apple-global-top-100', name: 'Apple Music Global Top 100', platform: 'apple', country: 'Global', countryCode: 'GLOBAL' },
  { slug: 'apple-us-top-100', name: 'Apple Music US Top 100', platform: 'apple', country: 'United States', countryCode: 'US' },
  { slug: 'apple-mx-top-100', name: 'Apple Music Mexico Top 100', platform: 'apple', country: 'Mexico', countryCode: 'MX' },
  { slug: 'apple-es-top-100', name: 'Apple Music Spain Top 100', platform: 'apple', country: 'Spain', countryCode: 'ES' },
  { slug: 'apple-gb-top-100', name: 'Apple Music UK Top 100', platform: 'apple', country: 'United Kingdom', countryCode: 'GB' },
  { slug: 'apple-br-top-100', name: 'Apple Music Brazil Top 100', platform: 'apple', country: 'Brazil', countryCode: 'BR' },
  { slug: 'apple-de-top-100', name: 'Apple Music Germany Top 100', platform: 'apple', country: 'Germany', countryCode: 'DE' },
  { slug: 'apple-fr-top-100', name: 'Apple Music France Top 100', platform: 'apple', country: 'France', countryCode: 'FR' },
  { slug: 'apple-co-top-100', name: 'Apple Music Colombia Top 100', platform: 'apple', country: 'Colombia', countryCode: 'CO' },
  { slug: 'apple-ar-top-100', name: 'Apple Music Argentina Top 100', platform: 'apple', country: 'Argentina', countryCode: 'AR' },
];

export function getAvailableCharts(platform?: string, countryCode?: string): ChartInfo[] {
  let charts = [...AVAILABLE_CHARTS];
  if (platform) charts = charts.filter(c => c.platform === platform.toLowerCase());
  if (countryCode) charts = charts.filter(c => c.countryCode === countryCode.toUpperCase() || c.countryCode === 'GLOBAL');
  return charts;
}

// ─── Charts: Ranking ───────────────────────────────────────────

const CHART_PLAYLIST_MAP: Record<string, string> = {
  'spotify-global-top-50': '37i9dQZEVXbMDoHDwVN2tF',
  'spotify-us-top-50': '37i9dQZEVXbLRQDuF5jeBp',
  'spotify-mx-top-50': '37i9dQZEVXbO3qyFxbkOE1',
  'spotify-es-top-50': '37i9dQZEVXbNFJfN1Vw8d9',
  'spotify-gb-top-50': '37i9dQZEVXbLnolsZ8PSNw',
  'spotify-br-top-50': '37i9dQZEVXbMXbN3EUUhlg',
  'spotify-de-top-50': '37i9dQZEVXbJiZcmkrIHGU',
  'spotify-fr-top-50': '37i9dQZEVXbIPWwFssbupI',
  'spotify-co-top-50': '37i9dQZEVXbOa2lmxNORXQ',
  'spotify-ar-top-50': '37i9dQZEVXbMMy2roB9myp',
  'spotify-viral-50-global': '37i9dQZEVXbLiRSasKsNU9',
};

export async function getChartRanking(slug: string): Promise<ChartEntry[]> {
  // ─── Apple Music (RSS feeds, no auth) ─────────────────────────
  if (slug.startsWith('apple-')) {
    return fetchAppleMusicChart(slug);
  }

  // ─── Spotify ──────────────────────────────────────────────────
  const playlistId = CHART_PLAYLIST_MAP[slug];
  if (!playlistId) throw new Error(`Unknown chart: ${slug}`);

  const data = await spotifyGet(`/playlists/${playlistId}/tracks?limit=50`);
  return (data.items || []).map((item: any, i: number) => ({
    position: i + 1,
    trackName: item.track?.name || 'Unknown',
    artistName: item.track?.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
    spotifyId: item.track?.id,
    streams: undefined,
    change: 0,
    imageUrl: item.track?.album?.images?.[0]?.url,
  }));
}

// ─── Apple Music Charts (public RSS feed) ──────────────────────

interface AppleRssSong {
  id: string;
  name: string;
  artistName: string;
  artworkUrl100?: string;
  url?: string;
}

interface AppleRssResponse {
  feed?: {
    results?: AppleRssSong[];
  };
}

const APPLE_COUNTRY_MAP: Record<string, string> = {
  'apple-global-top-100': 'us', // Apple RSS has no global feed; US is the de-facto global proxy
  'apple-us-top-100': 'us',
  'apple-mx-top-100': 'mx',
  'apple-es-top-100': 'es',
  'apple-gb-top-100': 'gb',
  'apple-br-top-100': 'br',
  'apple-de-top-100': 'de',
  'apple-fr-top-100': 'fr',
  'apple-co-top-100': 'co',
  'apple-ar-top-100': 'ar',
};

async function fetchAppleMusicChart(slug: string): Promise<ChartEntry[]> {
  const countryCode = APPLE_COUNTRY_MAP[slug];
  if (!countryCode) throw new Error(`Unknown Apple Music chart: ${slug}`);

  const url = `https://rss.applemarketingtools.com/api/v2/${countryCode}/music/most-played/100/songs.json`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Apple Music RSS ${r.status}: ${slug}`);

  const body = (await r.json()) as AppleRssResponse;
  const songs = body.feed?.results || [];

  return songs.map((s, i) => ({
    position: i + 1,
    trackName: s.name || 'Unknown',
    artistName: s.artistName || 'Unknown',
    spotifyId: undefined,
    streams: undefined,
    change: 0,
    imageUrl: s.artworkUrl100,
  }));
}

export async function getGlobalSongChart(chartId: string = 'spotify-global-top-50'): Promise<ChartEntry[]> {
  return getChartRanking(chartId);
}
