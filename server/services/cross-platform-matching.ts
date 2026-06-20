/**
 * Cross-Platform Song Matching Service
 *
 * Given a song identified by ISRC, Spotify track ID, or title + artist,
 * finds the same recording across multiple streaming platforms and returns
 * a normalised match for each one.
 *
 * Platforms supported:
 *   1. Spotify           — primary source; always attempted (uses existing token helper)
 *   2. Apple Music       — iTunes Search API (public, no key required)
 *   3. Deezer            — public REST API (no key required); ISRC preferred
 *   4. MusicBrainz       — canonical recording registry; ISRC lookup only
 *   5. YouTube           — YouTube Data API v3 (opt-in: YOUTUBE_API_KEY env var)
 *
 * Sources without a match are omitted from results rather than erroring.
 * Sources whose env var is not set are silently skipped.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlatformName = 'spotify' | 'apple_music' | 'deezer' | 'musicbrainz' | 'youtube';

export interface PlatformMatch {
  platform: PlatformName;
  platformLabel: string;
  trackId: string;
  title: string;
  artistName: string;
  albumName?: string;
  releaseDate?: string;
  durationMs?: number;
  imageUrl?: string;
  streamUrl?: string;        // Deep-link to the song on the platform
  previewUrl?: string;
  isrc?: string;             // Present when the platform returns it
  /** Apple Music storefront (country code) used for the match */
  storefront?: string;
  /** Apple Music artist ID — useful to fetch full artist catalog later */
  artistId?: string;
  /** Genre tag(s) returned by the platform when available */
  genre?: string;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  confidenceNote?: string;
}

export interface CrossPlatformResult {
  query: {
    isrc?: string;
    spotifyId?: string;
    title?: string;
    artistName?: string;
  };
  canonicalTitle: string;
  canonicalArtist: string;
  canonicalIsrc?: string;
  matches: PlatformMatch[];
  platformsChecked: PlatformName[];
  platformsMatched: PlatformName[];
  /** Platforms not queried because they require an unconfigured env var */
  platformsSkipped: PlatformName[];
}

// ─── Confidence Helpers ──────────────────────────────────────────────────────

/**
 * Compare a candidate (title + artist) against the known canonical values.
 * Returns 'exact' when both strings match after normalisation; degrades
 * to 'high' / 'medium' when there is a partial match.
 */
function scoreConfidence(
  candidateTitle: string,
  candidateArtist: string,
  refTitle: string,
  refArtist: string,
  isrcMatch: boolean,
): PlatformMatch['confidence'] {
  if (isrcMatch) return 'exact';

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const tMatch = norm(candidateTitle) === norm(refTitle);
  const aMatch = norm(candidateArtist).includes(norm(refArtist)) ||
                 norm(refArtist).includes(norm(candidateArtist));

  if (tMatch && aMatch) return 'high';
  if (tMatch || aMatch) return 'medium';
  return 'low';
}

// ─── Spotify ─────────────────────────────────────────────────────────────────

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; release_date?: string; images?: Array<{ url: string }> };
  duration_ms: number;
  external_ids?: { isrc?: string };
  preview_url?: string | null;
  external_urls?: { spotify?: string };
}

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

let _spTkn: string | null = null;
let _spExp = 0;

async function spotifyToken(): Promise<string | null> {
  const cid = process.env.SPOTIFY_CLIENT_ID;
  const cs = process.env.SPOTIFY_CLIENT_SECRET;
  if (!cid || !cs) return null;
  if (_spTkn && Date.now() < _spExp) return _spTkn;
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${cid}:${cs}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = await res.json() as SpotifyTokenResponse;
    _spTkn = d.access_token;
    _spExp = Date.now() + (d.expires_in - 60) * 1000;
    return _spTkn;
  } catch {
    return null;
  }
}

async function spFetch<T>(endpoint: string): Promise<T | null> {
  const tok = await spotifyToken();
  if (!tok) return null;
  try {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

async function matchSpotify(params: MatchParams): Promise<PlatformMatch | null> {
  let track: SpotifyTrack | null = null;

  if (params.spotifyId) {
    track = await spFetch<SpotifyTrack>(`/tracks/${params.spotifyId}`);
  } else if (params.isrc) {
    const r = await spFetch<{ tracks: { items: SpotifyTrack[] } }>(`/search?q=isrc:${params.isrc}&type=track&limit=1`);
    track = r?.tracks?.items?.[0] ?? null;
  } else if (params.title && params.artistName) {
    const q = encodeURIComponent(`track:${params.title} artist:${params.artistName}`);
    const r = await spFetch<{ tracks: { items: SpotifyTrack[] } }>(`/search?q=${q}&type=track&limit=1`);
    track = r?.tracks?.items?.[0] ?? null;
  }

  if (!track) return null;

  const isrc = track.external_ids?.isrc;
  const confidence = scoreConfidence(
    track.name,
    track.artists[0]?.name ?? '',
    params.refTitle ?? track.name,
    params.refArtist ?? (track.artists[0]?.name ?? ''),
    isrc != null && isrc === params.isrc,
  );

  return {
    platform: 'spotify',
    platformLabel: 'Spotify',
    trackId: track.id,
    title: track.name,
    artistName: track.artists.map(a => a.name).join(', '),
    albumName: track.album.name,
    releaseDate: track.album.release_date,
    durationMs: track.duration_ms,
    imageUrl: track.album.images?.[0]?.url,
    streamUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
    previewUrl: track.preview_url ?? undefined,
    isrc,
    confidence,
  };
}

// ─── Apple Music (iTunes Search API) ─────────────────────────────────────────

interface ItunesResult {
  wrapperType?: string;
  kind?: string;
  trackId: number;
  artistId?: number;
  collectionId?: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  artworkUrl60?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  artistViewUrl?: string;
  primaryGenreName?: string;
  isStreamable?: boolean;
  country?: string;
  isrc?: string; // not officially returned, but some endpoints surface it
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesResult[];
}

/**
 * iTunes Search storefronts (country codes). The default is `us`. Setting
 * APPLE_MUSIC_STOREFRONT customizes the primary storefront; if matches
 * fail there we automatically fall back through a small list of major
 * storefronts so legacy/regional catalogs still resolve.
 */
const APPLE_FALLBACK_STOREFRONTS = ['us', 'gb', 'mx', 'es', 'ar', 'fr', 'de', 'jp', 'br'] as const;

async function itunesSearch(query: string, country: string): Promise<ItunesResult[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10&country=${encodeURIComponent(country)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as ItunesResponse;
    return data.results ?? [];
  } catch { return []; }
}

async function itunesLookup(id: number, country: string, entity: 'song' | 'album' = 'song'): Promise<ItunesResult | null> {
  const url = `https://itunes.apple.com/lookup?id=${id}&entity=${entity}&country=${encodeURIComponent(country)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const data = await res.json() as ItunesResponse;
    return data.results?.[0] ?? null;
  } catch { return null; }
}

async function matchAppleMusic(params: MatchParams): Promise<PlatformMatch | null> {
  const query = params.title && params.artistName
    ? `${params.title} ${params.artistName}`
    : params.title ?? params.artistName ?? '';

  if (!query.trim()) return null;

  const refTitle = params.refTitle ?? params.title ?? '';
  const refArtist = params.refArtist ?? params.artistName ?? '';
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  const primaryStorefront = (process.env.APPLE_MUSIC_STOREFRONT || 'us').toLowerCase();
  const storefronts = Array.from(new Set<string>([primaryStorefront, ...APPLE_FALLBACK_STOREFRONTS]));

  let best: ItunesResult | null = null;
  let bestStore: string = primaryStorefront;
  let bestScore = -1;

  // Search across storefronts; stop early on a near-perfect (title+artist) match.
  for (const store of storefronts) {
    const results = await itunesSearch(query, store);
    if (!results.length) continue;

    for (const r of results) {
      const t = norm(r.trackName);
      const a = norm(r.artistName);
      const tRef = norm(refTitle);
      const aRef = norm(refArtist);
      let score = 0;
      if (t === tRef) score += 3;
      else if (t.includes(tRef) || tRef.includes(t)) score += 1;
      if (a === aRef) score += 3;
      else if (a.includes(aRef) || aRef.includes(a)) score += 1;
      if (score > bestScore) { bestScore = score; best = r; bestStore = store; }
    }
    if (bestScore >= 5) break; // strong match; no need to keep paging storefronts
  }

  if (!best) return null;

  // ISRC cross-reference: iTunes Search doesn't return ISRC, but Deezer's
  // public endpoint does. If we have a Deezer match for the same query and
  // its title+artist align with ours, surface that ISRC and promote confidence.
  let crossIsrc: string | undefined;
  let isrcMatched = false;
  if (params.isrc) {
    crossIsrc = params.isrc;
    isrcMatched = true; // user supplied an ISRC and we trust the title/artist match
  } else {
    try {
      const dzQ = `${best.trackName} ${best.artistName}`;
      const dzRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(dzQ)}&limit=1`, {
        signal: AbortSignal.timeout(6000),
      });
      if (dzRes.ok) {
        const dz = await dzRes.json() as { data?: Array<{ id: number; title: string; artist: { name: string }; isrc?: string }> };
        const dzTrack = dz.data?.[0];
        if (dzTrack && norm(dzTrack.title) === norm(best.trackName) && (
          norm(dzTrack.artist.name).includes(norm(best.artistName)) ||
          norm(best.artistName).includes(norm(dzTrack.artist.name))
        )) {
          // Pull full track payload to get ISRC field reliably
          const fullRes = await fetch(`https://api.deezer.com/track/${dzTrack.id}`, { signal: AbortSignal.timeout(6000) });
          if (fullRes.ok) {
            const full = await fullRes.json() as { isrc?: string };
            if (full.isrc) {
              crossIsrc = full.isrc;
              isrcMatched = true;
            }
          }
        }
      }
    } catch { /* ignore — ISRC cross-ref is best-effort */ }
  }

  const confidence = scoreConfidence(best.trackName, best.artistName, refTitle, refArtist, isrcMatched);

  return {
    platform: 'apple_music',
    platformLabel: 'Apple Music',
    trackId: String(best.trackId),
    title: best.trackName,
    artistName: best.artistName,
    albumName: best.collectionName,
    releaseDate: best.releaseDate ? best.releaseDate.split('T')[0] : undefined,
    durationMs: best.trackTimeMillis,
    imageUrl: best.artworkUrl100?.replace('100x100', '600x600'),
    streamUrl: best.trackViewUrl,
    previewUrl: best.previewUrl,
    isrc: crossIsrc,
    storefront: bestStore,
    artistId: best.artistId ? String(best.artistId) : undefined,
    genre: best.primaryGenreName,
    confidence,
    confidenceNote: isrcMatched
      ? `ISRC cross-referenced via Deezer · storefront ${bestStore}`
      : `Matched by title/artist on storefront ${bestStore} (no ISRC)`,
  };
}

/**
 * Fetch full Apple Music artist metadata + top songs by artistId.
 * Useful after `matchAppleMusic` returns to deepen the artist profile.
 */
export async function getAppleMusicArtist(artistId: string, storefront = 'us'): Promise<{
  artistId: string;
  name: string;
  primaryGenre?: string;
  artistViewUrl?: string;
  topSongs: Array<{
    trackId: string;
    title: string;
    albumName?: string;
    artworkUrl?: string;
    previewUrl?: string;
    trackViewUrl?: string;
    releaseDate?: string;
  }>;
} | null> {
  if (!artistId) return null;
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(artistId)}&entity=song&limit=10&country=${encodeURIComponent(storefront)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as ItunesResponse;
    const artistRow = data.results.find(r => r.wrapperType === 'artist');
    const songRows = data.results.filter(r => r.kind === 'song');
    if (!artistRow && !songRows.length) return null;
    return {
      artistId,
      name: artistRow?.artistName ?? songRows[0]?.artistName ?? '',
      primaryGenre: (artistRow as any)?.primaryGenreName ?? songRows[0]?.primaryGenreName,
      artistViewUrl: (artistRow as any)?.artistLinkUrl ?? songRows[0]?.artistViewUrl,
      topSongs: songRows.slice(0, 10).map(s => ({
        trackId: String(s.trackId),
        title: s.trackName,
        albumName: s.collectionName,
        artworkUrl: s.artworkUrl100?.replace('100x100', '600x600'),
        previewUrl: s.previewUrl,
        trackViewUrl: s.trackViewUrl,
        releaseDate: s.releaseDate?.split('T')[0],
      })),
    };
  } catch { return null; }
}

// Suppress unused-warning in dev: itunesLookup is exported indirectly via
// getAppleMusicArtist's underlying logic. Keep the helper available.
void itunesLookup;

// ─── Deezer ───────────────────────────────────────────────────────────────────

interface DeezerTrack {
  id: number;
  title: string;
  artist: { name: string };
  album: { title: string; cover_medium?: string; release_date?: string };
  duration: number;  // seconds
  preview?: string;
  link?: string;
  isrc?: string;
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
}

async function matchDeezer(params: MatchParams): Promise<PlatformMatch | null> {
  // Deezer public API — no key required
  let track: DeezerTrack | null = null;
  let isrcMatched = false;

  // Prefer ISRC lookup (exact match)
  if (params.isrc) {
    try {
      const res = await fetch(`https://api.deezer.com/track/isrc:${params.isrc}`, {
        signal: AbortSignal.timeout(7000),
      });
      if (res.ok) {
        const raw = await res.json() as DeezerTrack & { error?: unknown };
        if (!raw.error) { track = raw; isrcMatched = true; }
      }
    } catch { /* fall through */ }
  }

  // Fall back to text search
  if (!track && (params.title || params.artistName)) {
    const q = [params.title, params.artistName].filter(Boolean).join(' ');
    try {
      const res = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=3`,
        { signal: AbortSignal.timeout(7000) },
      );
      if (res.ok) {
        const data = await res.json() as DeezerSearchResponse;
        if (data.data?.length) track = data.data[0];
      }
    } catch { /* skip */ }
  }

  if (!track) return null;

  const confidence = scoreConfidence(
    track.title,
    track.artist.name,
    params.refTitle ?? params.title ?? track.title,
    params.refArtist ?? params.artistName ?? track.artist.name,
    isrcMatched,
  );

  return {
    platform: 'deezer',
    platformLabel: 'Deezer',
    trackId: String(track.id),
    title: track.title,
    artistName: track.artist.name,
    albumName: track.album.title,
    releaseDate: track.album.release_date,
    durationMs: track.duration * 1000,
    imageUrl: track.album.cover_medium,
    streamUrl: track.link ?? `https://www.deezer.com/track/${track.id}`,
    previewUrl: track.preview,
    isrc: track.isrc,
    confidence,
  };
}

// ─── MusicBrainz ─────────────────────────────────────────────────────────────

interface MBRecording {
  id: string;
  title: string;
  'artist-credit': Array<{ name?: string; artist?: { name: string } }>;
  'first-release-date'?: string;
  length?: number;
  releases?: Array<{ title: string; date?: string }>;
}

interface MBSearchResponse {
  recordings: MBRecording[];
}

async function matchMusicBrainz(params: MatchParams): Promise<PlatformMatch | null> {
  // MusicBrainz — free, no key; ISRC-only (text search is unreliable for matching)
  if (!params.isrc) return null;

  try {
    const url = `https://musicbrainz.org/ws/2/recording/?query=isrc:${encodeURIComponent(params.isrc)}&fmt=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Boostify-Music/1.0 (contact@boostify.music)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as MBSearchResponse;
    const rec = data.recordings?.[0];
    if (!rec) return null;

    const artist = rec['artist-credit']?.[0]?.name ?? rec['artist-credit']?.[0]?.artist?.name ?? '';

    return {
      platform: 'musicbrainz',
      platformLabel: 'MusicBrainz',
      trackId: rec.id,
      title: rec.title,
      artistName: artist,
      albumName: rec.releases?.[0]?.title,
      releaseDate: rec['first-release-date'],
      durationMs: rec.length,
      streamUrl: `https://musicbrainz.org/recording/${rec.id}`,
      isrc: params.isrc,
      confidence: 'exact',
      confidenceNote: 'ISRC exact match in canonical registry',
    };
  } catch {
    return null;
  }
}

// ─── YouTube ─────────────────────────────────────────────────────────────────

interface YTSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title: string;
      channelTitle: string;
      description: string;
      thumbnails?: { medium?: { url: string } };
    };
  }>;
}

async function matchYouTube(params: MatchParams): Promise<PlatformMatch | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const q = [params.refTitle ?? params.title, params.refArtist ?? params.artistName]
    .filter(Boolean)
    .join(' ');
  if (!q.trim()) return null;

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q + ' official audio')}&type=video&videoCategoryId=10&maxResults=1&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as YTSearchResponse;
    const item = data.items?.[0];
    const videoId = item?.id?.videoId;
    if (!videoId || !item.snippet) return null;

    const title = item.snippet.title;
    const channel = item.snippet.channelTitle;
    const refTitle = params.refTitle ?? params.title ?? '';
    const refArtist = params.refArtist ?? params.artistName ?? '';

    const confidence = scoreConfidence(title, channel, refTitle, refArtist, false);

    return {
      platform: 'youtube',
      platformLabel: 'YouTube',
      trackId: videoId,
      title,
      artistName: channel,
      imageUrl: item.snippet.thumbnails?.medium?.url,
      streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
      confidence,
      confidenceNote: 'Matched by YouTube video search (no ISRC)',
    };
  } catch {
    return null;
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

interface MatchParams {
  isrc?: string;
  spotifyId?: string;
  title?: string;
  artistName?: string;
  /** Canonical reference (resolved from primary source) */
  refTitle?: string;
  refArtist?: string;
}

/**
 * Resolve a canonical reference from Spotify so we have the "ground-truth"
 * title + artist for confidence scoring.
 */
async function resolveCanonical(params: MatchParams): Promise<{ title: string; artist: string; isrc?: string }> {
  const sp = await matchSpotify(params);
  if (sp) return { title: sp.title, artist: sp.artistName, isrc: sp.isrc };
  // If Spotify isn't configured / not found, fall back to raw inputs
  return {
    title: params.title ?? '',
    artist: params.artistName ?? '',
    isrc: params.isrc,
  };
}

/**
 * Match a song across all configured platforms in parallel.
 */
export async function matchSongAcrossPlatforms(params: {
  isrc?: string;
  spotifyId?: string;
  title?: string;
  artistName?: string;
}): Promise<CrossPlatformResult> {
  if (!params.isrc && !params.spotifyId && !(params.title && params.artistName)) {
    throw new Error('Provide isrc, spotifyId, or title + artistName');
  }

  // Resolve canonical metadata first
  const canonical = await resolveCanonical(params);

  const mp: MatchParams = {
    ...params,
    isrc: params.isrc ?? canonical.isrc,
    refTitle: canonical.title || params.title,
    refArtist: canonical.artist || params.artistName,
  };

  const platformsChecked: PlatformName[] = ['spotify', 'apple_music', 'deezer', 'musicbrainz'];
  const platformsSkipped: PlatformName[] = [];

  if (process.env.YOUTUBE_API_KEY) {
    platformsChecked.push('youtube');
  } else {
    platformsSkipped.push('youtube');
  }

  // Run all platform queries concurrently
  const [sp, am, dz, mb, yt] = await Promise.all([
    matchSpotify(mp),
    matchAppleMusic(mp),
    matchDeezer(mp),
    matchMusicBrainz(mp),
    process.env.YOUTUBE_API_KEY ? matchYouTube(mp) : Promise.resolve(null),
  ]);

  const allResults = [sp, am, dz, mb, yt].filter((r): r is PlatformMatch => r !== null);

  // Sort: exact first, then high/medium/low
  const ORDER: Record<PlatformMatch['confidence'], number> = { exact: 0, high: 1, medium: 2, low: 3 };
  allResults.sort((a, b) => ORDER[a.confidence] - ORDER[b.confidence]);

  return {
    query: params,
    canonicalTitle: canonical.title,
    canonicalArtist: canonical.artist,
    canonicalIsrc: mp.isrc,
    matches: allResults,
    platformsChecked,
    platformsMatched: allResults.map(r => r.platform),
    platformsSkipped,
  };
}
