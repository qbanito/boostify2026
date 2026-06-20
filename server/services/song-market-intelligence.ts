/**
 * Song Intelligence & Market Analysis Service
 * Song identity resolution, audio features DNA, performance tracking,
 * audience demographics, and market potential analysis.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface SongIdentity {
  songUuid: string;
  title: string;
  artistName: string;
  albumName?: string;
  isrc?: string;
  spotifyId?: string;
  releaseDate?: string;
  imageUrl?: string;
  previewUrl?: string;
  durationMs?: number;
  explicit?: boolean;
  label?: string;
}

export interface AudioFeaturesDNA {
  danceability: number;   // 0-1
  energy: number;         // 0-1
  valence: number;        // 0-1 (happiness)
  acousticness: number;   // 0-1
  instrumentalness: number; // 0-1
  liveness: number;       // 0-1
  speechiness: number;    // 0-1
  tempo: number;          // BPM
  key: number;            // 0-11 (pitch class)
  mode: number;           // 0=minor, 1=major
  loudness: number;       // dB
  timeSignature: number;
  keyName: string;        // "C Major", "A Minor", etc.
}

export interface SongPerformance {
  spotifyPopularity: number;
  trackPosition?: number;
  chartHistory: { chart: string; peakPosition: number; weeksOnChart: number }[];
  estimatedStreams?: number;
}

export interface SongMetadata extends SongIdentity {
  audioFeatures?: AudioFeaturesDNA;
  genres: string[];
  mood?: string;
}

export interface DemographicProfile {
  platform: string;
  ageGroups: { range: string; percentage: number }[];
  genderSplit: { male: number; female: number; other: number };
  topCountries: { country: string; countryCode: string; percentage: number }[];
  topCities: { city: string; country: string; percentage: number }[];
  interests: string[];
}

export interface MarketPotential {
  city: string;
  country: string;
  currentListeners: number;
  totalAddressableMarket: number;
  penetrationRate: number;
  growthGap: number;
  recommendation: string;
}

// ─── Spotify Token Helper ───────────────────────────────────────

let _tkn: string | null = null;
let _exp = 0;
async function spotifyToken(): Promise<string> {
  if (_tkn && Date.now() < _exp) return _tkn;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const d = await r.json() as any;
  _tkn = d.access_token; _exp = Date.now() + (d.expires_in - 60) * 1000;
  return _tkn!;
}
async function sGet(ep: string) {
  const t = await spotifyToken();
  const r = await fetch(`https://api.spotify.com/v1${ep}`, { headers: { 'Authorization': `Bearer ${t}` } });
  if (!r.ok) throw new Error(`Spotify ${r.status}`);
  return r.json();
}

// ─── Key Name Mapping ───────────────────────────────────────────

const KEY_NAMES = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];

// ─── Song Identity Resolver ─────────────────────────────────────

export async function resolveSongIdentity(params: {
  isrc?: string;
  spotifyId?: string;
  title?: string;
  artistName?: string;
}): Promise<SongIdentity | null> {
  try {
    let track: any;

    if (params.spotifyId) {
      track = await sGet(`/tracks/${params.spotifyId}`);
    } else if (params.isrc) {
      const search = await sGet(`/search?q=isrc:${params.isrc}&type=track&limit=1`);
      track = search.tracks?.items?.[0];
    } else if (params.title && params.artistName) {
      const q = encodeURIComponent(`track:${params.title} artist:${params.artistName}`);
      const search = await sGet(`/search?q=${q}&type=track&limit=1`);
      track = search.tracks?.items?.[0];
    }

    if (!track) return null;

    return {
      songUuid: track.id,
      title: track.name,
      artistName: track.artists?.map((a: any) => a.name).join(', ') || '',
      albumName: track.album?.name,
      isrc: track.external_ids?.isrc,
      spotifyId: track.id,
      releaseDate: track.album?.release_date,
      imageUrl: track.album?.images?.[0]?.url,
      previewUrl: track.preview_url,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      label: track.album?.label,
    };
  } catch (err) {
    console.error('[SongIntel] Resolve error:', err);
    return null;
  }
}

// ─── Song Metadata + Audio Features ─────────────────────────────

export async function getSongMetadata(spotifyTrackId: string): Promise<SongMetadata | null> {
  try {
    const [track, features] = await Promise.all([
      sGet(`/tracks/${spotifyTrackId}`),
      sGet(`/audio-features/${spotifyTrackId}`).catch(() => null),
    ]);

    const artist = track.artists?.[0];
    let genres: string[] = [];
    if (artist?.id) {
      try {
        const artistData = await sGet(`/artists/${artist.id}`);
        genres = artistData.genres || [];
      } catch { /* skip */ }
    }

    let audioFeatures: AudioFeaturesDNA | undefined;
    if (features) {
      const keyIdx = features.key ?? -1;
      const mode = features.mode ?? 0;
      audioFeatures = {
        danceability: features.danceability,
        energy: features.energy,
        valence: features.valence,
        acousticness: features.acousticness,
        instrumentalness: features.instrumentalness,
        liveness: features.liveness,
        speechiness: features.speechiness,
        tempo: features.tempo,
        key: keyIdx,
        mode,
        loudness: features.loudness,
        timeSignature: features.time_signature,
        keyName: keyIdx >= 0 ? `${KEY_NAMES[keyIdx]} ${mode === 1 ? 'Major' : 'Minor'}` : 'Unknown',
      };
    }

    // Determine mood from audio features
    let mood: string | undefined;
    if (audioFeatures) {
      if (audioFeatures.valence > 0.7 && audioFeatures.energy > 0.7) mood = 'Euphoric';
      else if (audioFeatures.valence > 0.6) mood = 'Happy';
      else if (audioFeatures.energy > 0.7) mood = 'Energetic';
      else if (audioFeatures.valence < 0.3 && audioFeatures.energy < 0.4) mood = 'Melancholic';
      else if (audioFeatures.valence < 0.4) mood = 'Dark';
      else if (audioFeatures.danceability > 0.7) mood = 'Groovy';
      else mood = 'Neutral';
    }

    return {
      songUuid: track.id,
      title: track.name,
      artistName: track.artists?.map((a: any) => a.name).join(', ') || '',
      albumName: track.album?.name,
      isrc: track.external_ids?.isrc,
      spotifyId: track.id,
      releaseDate: track.album?.release_date,
      imageUrl: track.album?.images?.[0]?.url,
      previewUrl: track.preview_url,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      label: track.album?.label,
      audioFeatures,
      genres,
      mood,
    };
  } catch (err) {
    console.error('[SongIntel] Metadata error:', err);
    return null;
  }
}

// ─── Song Performance ───────────────────────────────────────────

export async function getSongPerformance(spotifyTrackId: string): Promise<SongPerformance> {
  const track = await sGet(`/tracks/${spotifyTrackId}`);
  return {
    spotifyPopularity: track.popularity || 0,
    estimatedStreams: Math.round((track.popularity || 0) ** 2 * 1000),
    chartHistory: [], // Would need Songstats/Chartmetric for real chart data
  };
}

// ─── Audio Features (standalone) ────────────────────────────────

export async function getAudioFeatures(spotifyTrackId: string): Promise<AudioFeaturesDNA> {
  const f = await sGet(`/audio-features/${spotifyTrackId}`);
  const keyIdx = f.key ?? -1;
  return {
    danceability: f.danceability,
    energy: f.energy,
    valence: f.valence,
    acousticness: f.acousticness,
    instrumentalness: f.instrumentalness,
    liveness: f.liveness,
    speechiness: f.speechiness,
    tempo: f.tempo,
    key: keyIdx,
    mode: f.mode,
    loudness: f.loudness,
    timeSignature: f.time_signature,
    keyName: keyIdx >= 0 ? `${KEY_NAMES[keyIdx]} ${f.mode === 1 ? 'Major' : 'Minor'}` : 'Unknown',
  };
}

// ─── Audience Demographics ─────────────────────────────────────

export async function getAudienceDemographics(
  spotifyArtistId: string, platform: string = 'spotify'
): Promise<DemographicProfile> {
  // Demographics require Spotify for Artists API (OAuth)
  // Using intelligent estimation based on genre + popularity
  const artist = await sGet(`/artists/${spotifyArtistId}`);
  const genres = (artist.genres || []) as string[];
  const pop = artist.popularity || 0;

  // Genre-based demographic patterns
  const isLatin = genres.some((g: string) => g.includes('latin') || g.includes('reggaeton') || g.includes('salsa'));
  const isHipHop = genres.some((g: string) => g.includes('hip hop') || g.includes('rap') || g.includes('trap'));
  const isPop = genres.some((g: string) => g.includes('pop'));
  const isRock = genres.some((g: string) => g.includes('rock') || g.includes('metal') || g.includes('punk'));
  const isElectronic = genres.some((g: string) => g.includes('edm') || g.includes('electronic') || g.includes('house'));

  let ageGroups = [
    { range: '13-17', percentage: 8 },
    { range: '18-24', percentage: 30 },
    { range: '25-34', percentage: 35 },
    { range: '35-44', percentage: 15 },
    { range: '45-54', percentage: 8 },
    { range: '55+', percentage: 4 },
  ];

  if (isHipHop || isElectronic) {
    ageGroups = [
      { range: '13-17', percentage: 15 },
      { range: '18-24', percentage: 38 },
      { range: '25-34', percentage: 30 },
      { range: '35-44', percentage: 10 },
      { range: '45-54', percentage: 5 },
      { range: '55+', percentage: 2 },
    ];
  } else if (isRock) {
    ageGroups = [
      { range: '13-17', percentage: 5 },
      { range: '18-24', percentage: 20 },
      { range: '25-34', percentage: 30 },
      { range: '35-44', percentage: 25 },
      { range: '45-54', percentage: 13 },
      { range: '55+', percentage: 7 },
    ];
  }

  const genderSplit = isLatin || isHipHop
    ? { male: 58, female: 40, other: 2 }
    : isPop ? { male: 35, female: 62, other: 3 }
    : { male: 52, female: 45, other: 3 };

  const topCountries = isLatin
    ? [
        { country: 'Mexico', countryCode: 'MX', percentage: 25 },
        { country: 'United States', countryCode: 'US', percentage: 20 },
        { country: 'Colombia', countryCode: 'CO', percentage: 12 },
        { country: 'Argentina', countryCode: 'AR', percentage: 10 },
        { country: 'Spain', countryCode: 'ES', percentage: 8 },
      ]
    : [
        { country: 'United States', countryCode: 'US', percentage: 30 },
        { country: 'United Kingdom', countryCode: 'GB', percentage: 15 },
        { country: 'Germany', countryCode: 'DE', percentage: 8 },
        { country: 'Canada', countryCode: 'CA', percentage: 7 },
        { country: 'Australia', countryCode: 'AU', percentage: 6 },
      ];

  const interests = [
    'Music', 'Concerts', 'Fashion',
    ...(isLatin ? ['Latin Culture', 'Dance', 'Nightlife'] : []),
    ...(isHipHop ? ['Streetwear', 'Sneakers', 'Sports'] : []),
    ...(isPop ? ['Social Media', 'Beauty', 'Travel'] : []),
    ...(isRock ? ['Festivals', 'Vinyl', 'Art'] : []),
    ...(isElectronic ? ['Nightlife', 'Technology', 'Gaming'] : []),
  ];

  return {
    platform,
    ageGroups,
    genderSplit,
    topCountries,
    topCities: topCountries.map(c => ({ city: c.country === 'United States' ? 'New York' : c.country === 'Mexico' ? 'Mexico City' : c.country, country: c.country, percentage: c.percentage })),
    interests: [...new Set(interests)],
  };
}

// ─── Market Potential ──────────────────────────────────────────

export async function analyzeMarketPotential(
  spotifyArtistId: string, city: string, country: string
): Promise<MarketPotential> {
  const artist = await sGet(`/artists/${spotifyArtistId}`);
  const followers = artist.followers?.total || 0;
  const pop = artist.popularity || 0;

  // City population estimates for TAM
  const cityPopulations: Record<string, number> = {
    'mexico-city': 21_000_000, 'new-york': 8_300_000, 'los-angeles': 3_900_000,
    'london': 9_000_000, 'tokyo': 13_900_000, 'buenos-aires': 15_000_000,
    'sao-paulo': 12_300_000, 'bogota': 7_400_000, 'madrid': 3_200_000,
    'miami': 450_000, 'toronto': 2_800_000, 'berlin': 3_600_000,
    'paris': 2_100_000, 'sydney': 5_300_000, 'seoul': 9_700_000,
  };

  const cityKey = city.toLowerCase().replace(/\s+/g, '-');
  const cityPop = cityPopulations[cityKey] || 2_000_000;
  
  // Music streaming penetration rate
  const streamingPenetration = 0.35;
  const tam = Math.round(cityPop * streamingPenetration);
  const currentListeners = Math.round(followers * (pop / 100) * 0.01 * (Math.random() * 0.5 + 0.3));
  const penetration = tam > 0 ? Math.round((currentListeners / tam) * 10000) / 100 : 0;
  const gap = tam - currentListeners;

  let recommendation: string;
  if (penetration < 1) recommendation = 'Massive untapped market — high priority for targeted ads and playlist placement';
  else if (penetration < 5) recommendation = 'Significant growth opportunity — consider local collaborations and geo-targeted campaigns';
  else if (penetration < 15) recommendation = 'Moderate penetration — focus on retention and deepening engagement';
  else recommendation = 'Well-established market — optimize monetization (merch, touring, exclusive content)';

  return {
    city, country,
    currentListeners,
    totalAddressableMarket: tam,
    penetrationRate: penetration,
    growthGap: gap,
    recommendation,
  };
}

// ─── Hit Potential Scoring ─────────────────────────────────────────────────

export interface HitFactor {
  name: string;
  /** Raw score for this factor (0–100) */
  score: number;
  /** Weight applied to this factor (all weights sum to 1) */
  weight: number;
  /** Weighted contribution to the overall score */
  contribution: number;
  /** Human-readable explanation */
  note: string;
}

export interface HitPotentialScore {
  /** Overall hit potential score 0–100 */
  overallScore: number;
  /** Letter grade: S / A / B / C / D */
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  /** Short verdict label */
  verdict: string;
  /** Detailed per-factor breakdown */
  factors: HitFactor[];
  /** Actionable recommendations */
  recommendations: string[];
  /** Top tracks from same artist as benchmark */
  comparableSongs: Array<{ id: string; title: string; artistName: string; popularity: number }>;
  /** Genre-based trend signal */
  trendSignal: 'rising' | 'stable' | 'declining';
  /** Confidence in the prediction */
  confidence: 'high' | 'medium' | 'low';
}

// ── Genre trend signals ────────────────────────────────────────────────────

const RISING_GENRES = new Set([
  'afrobeats', 'afropop', 'amapiano', 'hyperpop', 'phonk', 'drill',
  'regional mexican', 'corridos tumbados', 'regional', 'banda',
  'latin trap', 'latin pop', 'reggaeton', 'dembow',
  'k-pop', 'j-pop', 'city pop',
  'bedroom pop', 'lo-fi', 'indie pop', 'alternative',
]);

const DECLINING_GENRES = new Set([
  'classic rock', 'traditional country', 'bluegrass', 'adult standards',
  'trance', 'dubstep', 'deathcore', 'nu-metal',
]);

function genreTrendSignal(genres: string[]): 'rising' | 'stable' | 'declining' {
  const lower = genres.map(g => g.toLowerCase());
  const riseCnt = lower.filter(g => [...RISING_GENRES].some(r => g.includes(r))).length;
  const decCnt  = lower.filter(g => [...DECLINING_GENRES].some(d => g.includes(d))).length;
  if (riseCnt > decCnt) return 'rising';
  if (decCnt  > riseCnt) return 'declining';
  return 'stable';
}

// ── Factor scorers ─────────────────────────────────────────────────────────

function scoreDanceabilityEnergy(af: AudioFeaturesDNA): HitFactor {
  const de = (af.danceability + af.energy) / 2;
  let raw: number;
  if (de >= 0.62 && de <= 0.88) {
    raw = 85 + (1 - Math.abs(de - 0.75) / 0.13) * 15;
  } else {
    raw = Math.max(0, 85 - Math.abs(de - 0.75) * 200);
  }
  const score = Math.round(Math.min(100, raw));
  return {
    name: 'Danceability & Energy',
    score,
    weight: 0.18,
    contribution: Math.round(score * 0.18 * 10) / 10,
    note: de >= 0.62 && de <= 0.88
      ? `Combined DE ${(de * 100).toFixed(0)}% sits in the commercial sweet spot (62–88%)`
      : `Combined DE ${(de * 100).toFixed(0)}% is outside the chart-friendly range`,
  };
}

function scoreValence(af: AudioFeaturesDNA): HitFactor {
  const v = af.valence;
  let score: number;
  if (v >= 0.5 && v <= 0.85) score = 75 + (1 - Math.abs(v - 0.67) / 0.18) * 25;
  else if (v >= 0.3) score = 50 + v * 40;
  else score = 30 + v * 50;
  score = Math.round(Math.min(100, score));
  return {
    name: 'Emotional Tone (Valence)',
    score,
    weight: 0.12,
    contribution: Math.round(score * 0.12 * 10) / 10,
    note: v >= 0.5
      ? `Positive tone (${(v * 100).toFixed(0)}%) aligns with mainstream listener preference`
      : `Low valence (${(v * 100).toFixed(0)}%) — niche appeal; strong in sad/dark genres`,
  };
}

function scoreTempo(af: AudioFeaturesDNA): HitFactor {
  const t = af.tempo;
  let score: number;
  if (t >= 90 && t <= 135) score = 75 + (1 - Math.abs(t - 112) / 23) * 25;
  else if (t >= 70 && t <= 155) score = 55 + (1 - Math.abs(t - 112) / 40) * 30;
  else score = Math.max(20, 55 - Math.abs(t - 112) / 5);
  score = Math.round(Math.min(100, score));
  return {
    name: 'Tempo',
    score,
    weight: 0.10,
    contribution: Math.round(score * 0.10 * 10) / 10,
    note: t >= 90 && t <= 135
      ? `${Math.round(t)} BPM sits in the streaming-friendly range (90–135 BPM)`
      : `${Math.round(t)} BPM is outside the 90–135 BPM sweet spot`,
  };
}

function scoreAcousticness(af: AudioFeaturesDNA, genres: string[]): HitFactor {
  const isAcousticGenre = genres.some(g =>
    ['folk', 'country', 'acoustic', 'singer-songwriter', 'americana'].some(k => g.toLowerCase().includes(k)));
  const a = af.acousticness;
  let score: number;
  if (isAcousticGenre) {
    score = a >= 0.5 ? 80 + (a - 0.5) * 40 : 50 + a * 60;
  } else {
    score = a <= 0.3 ? 80 + (0.3 - a) * 50 : Math.max(30, 80 - (a - 0.3) * 90);
  }
  score = Math.round(Math.min(100, score));
  return {
    name: 'Production Style (Acousticness)',
    score,
    weight: 0.08,
    contribution: Math.round(score * 0.08 * 10) / 10,
    note: isAcousticGenre
      ? `Acoustic profile (${(a * 100).toFixed(0)}%) fits the genre expectation`
      : a <= 0.3
        ? `Low acousticness (${(a * 100).toFixed(0)}%) — fully produced, radio-ready`
        : `High acousticness (${(a * 100).toFixed(0)}%) may limit mainstream radio reach`,
  };
}

function scoreInstrumentalness(af: AudioFeaturesDNA): HitFactor {
  const ins = af.instrumentalness;
  const score = Math.round(Math.max(0, 100 - ins * 110));
  return {
    name: 'Vocal Presence',
    score,
    weight: 0.07,
    contribution: Math.round(score * 0.07 * 10) / 10,
    note: ins < 0.05
      ? 'Strong vocal presence — essential for mainstream charting'
      : ins < 0.3
        ? `Mostly vocal (instrumentalness ${(ins * 100).toFixed(0)}%) — acceptable`
        : `High instrumentalness (${(ins * 100).toFixed(0)}%) significantly reduces chart potential`,
  };
}

function scoreArtistMomentum(popularity: number, followers: number): HitFactor {
  const followerBonus =
    followers >= 10_000_000 ? 12 :
    followers >= 1_000_000  ? 8  :
    followers >= 100_000    ? 5  :
    followers >= 10_000     ? 2  : 0;
  const score = Math.round(Math.min(100, popularity + followerBonus));
  return {
    name: 'Artist Momentum',
    score,
    weight: 0.20,
    contribution: Math.round(score * 0.20 * 10) / 10,
    note: `Spotify popularity ${popularity}/100 + ${followers.toLocaleString()} followers — ${
      score >= 75 ? 'strong platform presence' : score >= 50 ? 'growing momentum' : 'early-stage — boost with playlist campaigns'
    }`,
  };
}

function scoreGenreTrend(genres: string[]): HitFactor {
  const signal = genreTrendSignal(genres);
  const score = signal === 'rising' ? 85 : signal === 'stable' ? 65 : 40;
  return {
    name: 'Genre Trend',
    score,
    weight: 0.12,
    contribution: Math.round(score * 0.12 * 10) / 10,
    note: signal === 'rising'
      ? `Genre (${genres.slice(0, 2).join(', ')}) is trending upward — strong tailwind`
      : signal === 'stable'
        ? `Genre (${genres.slice(0, 2).join(', ')}) is stable — no major headwinds`
        : `Genre (${genres.slice(0, 2).join(', ')}) shows declining listener growth`,
  };
}

function scoreDuration(durationMs?: number): HitFactor {
  if (!durationMs) {
    return {
      name: 'Song Duration', score: 65, weight: 0.05,
      contribution: Math.round(65 * 0.05 * 10) / 10, note: 'Duration unknown — neutral score',
    };
  }
  const sec = durationMs / 1000;
  let score: number;
  if (sec >= 150 && sec <= 225) score = 90 + (1 - Math.abs(sec - 195) / 30) * 10;
  else if (sec >= 120 && sec <= 270) score = 70 + (1 - Math.abs(sec - 195) / 75) * 25;
  else score = Math.max(30, 70 - Math.abs(sec - 195) / 10);
  score = Math.round(Math.min(100, score));
  const mm = Math.floor(sec / 60);
  const ss = Math.round(sec % 60);
  return {
    name: 'Song Duration',
    score,
    weight: 0.05,
    contribution: Math.round(score * 0.05 * 10) / 10,
    note: sec >= 150 && sec <= 225
      ? `${mm}:${String(ss).padStart(2, '0')} is in the optimal streaming window (2:30–3:45)`
      : `${mm}:${String(ss).padStart(2, '0')} is outside the optimal streaming window`,
  };
}

function scoreLoudness(af: AudioFeaturesDNA): HitFactor {
  const db = af.loudness;
  let score: number;
  if (db >= -8 && db <= -4) score = 90 + (1 - Math.abs(db + 6) / 2) * 10;
  else if (db >= -12 && db <= -2) score = 65 + (1 - Math.abs(db + 6) / 5) * 30;
  else score = Math.max(20, 65 - Math.abs(db + 6) * 5);
  score = Math.round(Math.min(100, score));
  return {
    name: 'Loudness / Mastering',
    score,
    weight: 0.08,
    contribution: Math.round(score * 0.08 * 10) / 10,
    note: db >= -8 && db <= -4
      ? `${db.toFixed(1)} dBFS — competitive loudness level for streaming`
      : db < -12
        ? `${db.toFixed(1)} dBFS — too quiet; consider re-mastering for streaming`
        : `${db.toFixed(1)} dBFS — slightly over-compressed`,
  };
}

// ── Grade & verdict ───────────────────────────────────────────────────────

function gradeFromScore(score: number): { grade: HitPotentialScore['grade']; verdict: string } {
  if (score >= 85) return { grade: 'S', verdict: 'Exceptional Hit Potential' };
  if (score >= 72) return { grade: 'A', verdict: 'Strong Hit Potential' };
  if (score >= 58) return { grade: 'B', verdict: 'Good Commercial Viability' };
  if (score >= 42) return { grade: 'C', verdict: 'Moderate Potential' };
  return { grade: 'D', verdict: 'Limited Commercial Potential' };
}

// ── Recommendations ───────────────────────────────────────────────────────

function buildRecommendations(factors: HitFactor[], trendSignal: string): string[] {
  const recs: string[] = [];
  const sorted = [...factors].sort((a, b) => a.score - b.score);

  for (const f of sorted.slice(0, 3)) {
    if (f.score >= 50) continue;
    switch (f.name) {
      case 'Danceability & Energy':
        recs.push('Boost energy and groove — consider a stronger drum arrangement or bassline');
        break;
      case 'Emotional Tone (Valence)':
        recs.push('Add a more uplifting hook or melodic lift to improve mainstream emotional appeal');
        break;
      case 'Tempo':
        recs.push('Consider remixing to 100–120 BPM for wider playlist compatibility');
        break;
      case 'Production Style (Acousticness)':
        recs.push('Add modern production elements (synths, programmed drums) to increase radio viability');
        break;
      case 'Vocal Presence':
        recs.push('Consider adding a vocal topline — instrumental tracks rarely break onto mainstream charts');
        break;
      case 'Artist Momentum':
        recs.push('Run targeted playlist pitching campaigns to build Spotify popularity before wider release');
        break;
      case 'Genre Trend':
        recs.push('The genre is cooling — consider blending with a trending sound (e.g., Afrobeats or Latin rhythms)');
        break;
      case 'Song Duration':
        recs.push('Edit to 2:30–3:45 for optimal streaming completion rate and playlist consideration');
        break;
      case 'Loudness / Mastering':
        recs.push('Re-master to −7 to −5 dBFS — current levels may cause volume normalization penalties on DSPs');
        break;
    }
  }

  if (trendSignal === 'rising') recs.push('Leverage rising genre momentum — pitch to genre-specific editorial playlists now');
  if (recs.length === 0) recs.push('Strong overall profile — focus on release timing (Friday drops) and pre-save campaigns');

  return recs.slice(0, 4);
}

// ── Spotify API helper for internal use ──────────────────────────────────
// sGet is defined earlier in this file (Spotify client-credentials GET)

/**
 * Predict the hit potential of a Spotify track.
 * Fetches audio features + artist data in parallel, runs multi-factor scoring.
 */
export async function scoreHitPotential(spotifyTrackId: string): Promise<HitPotentialScore> {
  type SpotifyTrack = {
    id: string; name: string; popularity: number; duration_ms: number; explicit: boolean;
    artists: Array<{ id: string; name: string }>;
    album: { release_date?: string };
  };
  type SpotifyAudioFeatures = {
    danceability: number; energy: number; valence: number; acousticness: number;
    instrumentalness: number; liveness: number; speechiness: number;
    tempo: number; key: number; mode: number; loudness: number; time_signature: number;
  };
  type SpotifyArtist = { popularity: number; followers: { total: number }; genres: string[] };
  type SpotifyTopTracks = { tracks: Array<{ id: string; name: string; popularity: number; artists: Array<{ name: string }> }> };

  const [track, afRaw] = await Promise.all([
    sGet(`/tracks/${spotifyTrackId}`) as Promise<SpotifyTrack>,
    (sGet(`/audio-features/${spotifyTrackId}`) as Promise<SpotifyAudioFeatures>).catch(() => null),
  ]);

  const artistId = track.artists[0]?.id ?? '';
  const [artistData, topTracksData] = await Promise.all([
    artistId ? (sGet(`/artists/${artistId}`) as Promise<SpotifyArtist>) : Promise.resolve(null),
    artistId
      ? (sGet(`/artists/${artistId}/top-tracks?market=US`) as Promise<SpotifyTopTracks>).catch(() => null)
      : Promise.resolve(null),
  ]);

  const popularity = track.popularity ?? 0;
  const followers  = artistData?.followers?.total ?? 0;
  const genres: string[] = artistData?.genres ?? [];

  const af: AudioFeaturesDNA = afRaw
    ? {
        danceability:    afRaw.danceability,
        energy:          afRaw.energy,
        valence:         afRaw.valence,
        acousticness:    afRaw.acousticness,
        instrumentalness: afRaw.instrumentalness,
        liveness:        afRaw.liveness,
        speechiness:     afRaw.speechiness,
        tempo:           afRaw.tempo,
        key:             afRaw.key,
        mode:            afRaw.mode,
        loudness:        afRaw.loudness,
        timeSignature:   afRaw.time_signature,
        keyName:         '',
      }
    : {
        danceability: 0.60, energy: 0.65, valence: 0.55, acousticness: 0.20,
        instrumentalness: 0.05, liveness: 0.15, speechiness: 0.08,
        tempo: 112, key: 0, mode: 1, loudness: -6, timeSignature: 4, keyName: '',
      };

  const factors: HitFactor[] = [
    scoreDanceabilityEnergy(af),
    scoreValence(af),
    scoreTempo(af),
    scoreAcousticness(af, genres),
    scoreInstrumentalness(af),
    scoreArtistMomentum(popularity, followers),
    scoreGenreTrend(genres),
    scoreDuration(track.duration_ms),
    scoreLoudness(af),
  ];

  // Weights: 0.18+0.12+0.10+0.08+0.07+0.20+0.12+0.05+0.08 = 1.00
  const overallScore = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
  const trendSignal  = genreTrendSignal(genres);
  const { grade, verdict } = gradeFromScore(overallScore);
  const recommendations = buildRecommendations(factors, trendSignal);

  const comparableSongs = (topTracksData?.tracks ?? [])
    .filter(t => t.id !== spotifyTrackId)
    .slice(0, 5)
    .map(t => ({ id: t.id, title: t.name, artistName: t.artists[0]?.name ?? '', popularity: t.popularity }));

  return {
    overallScore,
    grade,
    verdict,
    factors,
    recommendations,
    comparableSongs,
    trendSignal,
    confidence: afRaw ? 'high' : 'medium',
  };
}
