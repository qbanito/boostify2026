/**
 * Tour Intelligence Service
 * Opening act discovery, festival database, strategic tour routing.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface OpeningAct {
  id: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  followers: number;
  popularity: number;
  careerStage: string;
  growthPotential: 'very-high' | 'high' | 'medium' | 'low';
  matchScore: number;
  reason: string;
  city?: string;
  country?: string;
}

export interface Festival {
  id: string;
  name: string;
  location: string;
  country: string;
  countryCode: string;
  date: string;
  genres: string[];
  estimatedAttendance: number;
  website?: string;
  status: 'confirmed' | 'tentative' | 'past';
  tier: 'major' | 'mid-level' | 'emerging';
}

export interface VenueResult {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  genres: string[];
  type: 'club' | 'theater' | 'arena' | 'outdoor' | 'festival-ground';
  rating?: number;
}

// ─── Spotify Helper ─────────────────────────────────────────────

let _t: string | null = null; let _e = 0;
async function sToken() {
  if (_t && Date.now() < _e) return _t;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const d = await r.json() as any;
  _t = d.access_token; _e = Date.now() + (d.expires_in - 60) * 1000;
  return _t!;
}
async function sGet(ep: string) {
  const t = await sToken();
  const r = await fetch(`https://api.spotify.com/v1${ep}`, { headers: { 'Authorization': `Bearer ${t}` } });
  if (!r.ok) throw new Error(`Spotify ${r.status}`);
  return r.json();
}

// ─── Career Stage Classifier ────────────────────────────────────

function classifyStage(pop: number, fol: number): string {
  if (pop >= 85 || fol >= 10_000_000) return 'Superstar';
  if (pop >= 70 || fol >= 1_000_000) return 'Mainstream';
  if (pop >= 50 || fol >= 100_000) return 'Mid-Level';
  if (pop >= 30 || fol >= 10_000) return 'Developing';
  if (pop >= 15 || fol >= 1_000) return 'Emerging';
  return 'Long-Tail';
}

// ─── Opening Acts: Local ────────────────────────────────────────

export async function findLocalOpeningActs(
  referenceArtistId: string, countryCode: string, cityKey?: string
): Promise<OpeningAct[]> {
  const [artist, related] = await Promise.all([
    sGet(`/artists/${referenceArtistId}`),
    sGet(`/artists/${referenceArtistId}/related-artists`),
  ]);

  const refPop = artist.popularity || 0;
  const refFollowers = artist.followers?.total || 0;

  return (related.artists || [])
    .filter((a: any) => {
      const pop = a.popularity || 0;
      const fol = a.followers?.total || 0;
      return pop < refPop && fol < refFollowers * 0.5; // Smaller artists
    })
    .slice(0, 10)
    .map((a: any, i: number) => {
      const pop = a.popularity || 0;
      const fol = a.followers?.total || 0;
      let growth: OpeningAct['growthPotential'] = 'medium';
      if (pop > 40) growth = 'very-high';
      else if (pop > 25) growth = 'high';
      else if (pop < 15) growth = 'low';

      return {
        id: a.id,
        name: a.name,
        imageUrl: a.images?.[0]?.url,
        genres: a.genres || [],
        followers: fol,
        popularity: pop,
        careerStage: classifyStage(pop, fol),
        growthPotential: growth,
        matchScore: Math.max(90 - i * 6, 20),
        reason: `Local opening act candidate — smaller audience with genre overlap`,
        city: cityKey,
        country: countryCode,
      };
    });
}

// ─── Opening Acts: Strategic (high growth) ─────────────────────

export async function findStrategicOpeningActs(referenceArtistId: string): Promise<OpeningAct[]> {
  const [artist, related] = await Promise.all([
    sGet(`/artists/${referenceArtistId}`),
    sGet(`/artists/${referenceArtistId}/related-artists`),
  ]);

  const refPop = artist.popularity || 0;

  return (related.artists || [])
    .filter((a: any) => {
      const pop = a.popularity || 0;
      return pop < refPop && pop >= 20; // Emerging but with momentum
    })
    .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 8)
    .map((a: any, i: number) => {
      const pop = a.popularity || 0;
      const fol = a.followers?.total || 0;
      return {
        id: a.id,
        name: a.name,
        imageUrl: a.images?.[0]?.url,
        genres: a.genres || [],
        followers: fol,
        popularity: pop,
        careerStage: classifyStage(pop, fol),
        growthPotential: 'very-high' as const,
        matchScore: Math.max(95 - i * 8, 30),
        reason: `High-growth emerging artist — dedicated, engaged audience in same genre`,
      };
    });
}

// ─── Festivals Database ────────────────────────────────────────

const FESTIVAL_DB: Festival[] = [
  // Major
  { id: 'coachella', name: 'Coachella Valley Music and Arts Festival', location: 'Indio, California', country: 'United States', countryCode: 'US', date: '2026-04-10', genres: ['pop', 'electronic', 'hip hop', 'indie'], estimatedAttendance: 250000, website: 'https://www.coachella.com', status: 'confirmed', tier: 'major' },
  { id: 'lollapalooza', name: 'Lollapalooza', location: 'Chicago, Illinois', country: 'United States', countryCode: 'US', date: '2026-07-30', genres: ['rock', 'pop', 'hip hop', 'electronic'], estimatedAttendance: 400000, status: 'confirmed', tier: 'major' },
  { id: 'glastonbury', name: 'Glastonbury Festival', location: 'Somerset', country: 'United Kingdom', countryCode: 'GB', date: '2026-06-24', genres: ['rock', 'pop', 'electronic', 'world'], estimatedAttendance: 200000, status: 'confirmed', tier: 'major' },
  { id: 'tomorrowland', name: 'Tomorrowland', location: 'Boom', country: 'Belgium', countryCode: 'BE', date: '2026-07-17', genres: ['electronic', 'edm', 'house', 'techno'], estimatedAttendance: 400000, status: 'confirmed', tier: 'major' },
  { id: 'primavera', name: 'Primavera Sound', location: 'Barcelona', country: 'Spain', countryCode: 'ES', date: '2026-06-03', genres: ['indie', 'electronic', 'pop', 'rock'], estimatedAttendance: 200000, status: 'confirmed', tier: 'major' },
  { id: 'rock-in-rio', name: 'Rock in Rio', location: 'Rio de Janeiro', country: 'Brazil', countryCode: 'BR', date: '2026-09-18', genres: ['rock', 'pop', 'hip hop', 'electronic'], estimatedAttendance: 700000, status: 'confirmed', tier: 'major' },
  { id: 'vive-latino', name: 'Vive Latino', location: 'Mexico City', country: 'Mexico', countryCode: 'MX', date: '2026-03-14', genres: ['rock', 'latin', 'alternative', 'hip hop'], estimatedAttendance: 200000, status: 'confirmed', tier: 'major' },
  { id: 'sonar', name: 'Sónar', location: 'Barcelona', country: 'Spain', countryCode: 'ES', date: '2026-06-18', genres: ['electronic', 'experimental', 'techno'], estimatedAttendance: 120000, status: 'confirmed', tier: 'major' },
  { id: 'bonnaroo', name: 'Bonnaroo', location: 'Manchester, Tennessee', country: 'United States', countryCode: 'US', date: '2026-06-11', genres: ['rock', 'electronic', 'hip hop', 'folk'], estimatedAttendance: 80000, status: 'confirmed', tier: 'major' },
  { id: 'fuji-rock', name: 'Fuji Rock Festival', location: 'Naeba', country: 'Japan', countryCode: 'JP', date: '2026-07-24', genres: ['rock', 'electronic', 'world'], estimatedAttendance: 120000, status: 'confirmed', tier: 'major' },
  // Mid-Level
  { id: 'pa-l-norte', name: "Pa'l Norte", location: 'Monterrey', country: 'Mexico', countryCode: 'MX', date: '2026-03-27', genres: ['latin', 'rock', 'electronic', 'reggaeton'], estimatedAttendance: 150000, status: 'confirmed', tier: 'mid-level' },
  { id: 'estereo-picnic', name: 'Festival Estéreo Picnic', location: 'Bogota', country: 'Colombia', countryCode: 'CO', date: '2026-03-26', genres: ['rock', 'electronic', 'latin', 'indie'], estimatedAttendance: 100000, status: 'confirmed', tier: 'mid-level' },
  { id: 'mad-cool', name: 'Mad Cool', location: 'Madrid', country: 'Spain', countryCode: 'ES', date: '2026-07-08', genres: ['rock', 'pop', 'electronic'], estimatedAttendance: 80000, status: 'confirmed', tier: 'mid-level' },
  { id: 'lollapalooza-ar', name: 'Lollapalooza Argentina', location: 'Buenos Aires', country: 'Argentina', countryCode: 'AR', date: '2026-03-20', genres: ['rock', 'pop', 'electronic', 'hip hop'], estimatedAttendance: 100000, status: 'confirmed', tier: 'mid-level' },
  { id: 'wireless', name: 'Wireless Festival', location: 'London', country: 'United Kingdom', countryCode: 'GB', date: '2026-07-10', genres: ['hip hop', 'r&b', 'grime', 'afrobeats'], estimatedAttendance: 50000, status: 'confirmed', tier: 'mid-level' },
  // Emerging
  { id: 'ceremonia', name: 'Festival Ceremonia', location: 'Mexico City', country: 'Mexico', countryCode: 'MX', date: '2026-04-25', genres: ['electronic', 'indie', 'experimental'], estimatedAttendance: 30000, status: 'tentative', tier: 'emerging' },
  { id: 'bahidora', name: 'Festival Bahidorá', location: 'Las Estacas, Morelos', country: 'Mexico', countryCode: 'MX', date: '2026-02-20', genres: ['electronic', 'world', 'experimental'], estimatedAttendance: 8000, status: 'confirmed', tier: 'emerging' },
  { id: 'bpm', name: 'The BPM Festival', location: 'Various', country: 'Costa Rica', countryCode: 'CR', date: '2026-01-14', genres: ['techno', 'house', 'electronic'], estimatedAttendance: 15000, status: 'confirmed', tier: 'emerging' },
];

export function searchFestivals(params: {
  name?: string;
  genre?: string;
  countryCode?: string;
}): Festival[] {
  let results = [...FESTIVAL_DB];
  if (params.name) {
    const q = params.name.toLowerCase();
    results = results.filter(f => f.name.toLowerCase().includes(q));
  }
  if (params.genre) {
    const g = params.genre.toLowerCase();
    results = results.filter(f => f.genres.some(fg => fg.includes(g)));
  }
  if (params.countryCode) {
    const cc = params.countryCode!.toUpperCase();
    results = results.filter(f => f.countryCode === cc);
  }
  return results;
}

export function getUpcomingFestivals(genre?: string, limit: number = 20): Festival[] {
  const now = new Date().toISOString().split('T')[0];
  let fests = FESTIVAL_DB.filter(f => f.date >= now && f.status !== 'past');
  if (genre) {
    const g = genre.toLowerCase();
    fests = fests.filter(f => f.genres.some(fg => fg.includes(g)));
  }
  return fests.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

// ─── Venue Search (integrated with existing venue-outreach) ────

export function searchVenuesByGenre(city: string, genre: string, minCapacity: number = 100): VenueResult[] {
  // This augments the existing venue-outreach system with structured results
  // In production, would query from the venueContacts table
  const sampleVenues: VenueResult[] = [
    { id: 'v1', name: `${city} Live`, city, country: 'US', capacity: 500, genres: [genre], type: 'club' as const, rating: 4.5 },
    { id: 'v2', name: `The ${genre.charAt(0).toUpperCase() + genre.slice(1)} Room`, city, country: 'US', capacity: 300, genres: [genre, 'indie'], type: 'club' as const, rating: 4.2 },
    { id: 'v3', name: `${city} Theater`, city, country: 'US', capacity: 1200, genres: [genre, 'pop', 'rock'], type: 'theater' as const, rating: 4.7 },
  ].filter(v => v.capacity >= minCapacity);

  return sampleVenues;
}
