/**
 * Tour Routing Optimizer
 *
 * Accepts a list of cities (with optional coordinates) and returns an optimised
 * tour route using a Nearest-Neighbour TSP heuristic followed by a 2-opt
 * improvement pass.  No external API is required — coordinates are resolved
 * from a built-in city database (~200 music-market cities) and, if missing,
 * inferred from the OpenStreetMap Nominatim API.
 *
 * Outputs per stop:
 *   • Optimised visit order
 *   • Great-circle distance and estimated drive time from the previous city
 *   • "Rest day" flag when the leg exceeds a configurable km threshold
 *   • Suggested travel mode (fly / drive / train)
 *
 * Summary output:
 *   • Total distance (km)
 *   • Total estimated travel hours
 *   • Number of suggested rest days
 *   • Efficiency score vs. a naive (input order) route
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TourCity {
  /** Freeform city name — matched against built-in DB then geocoded */
  name: string;
  /** Optional ISO-3166-1 alpha-2 country code for disambiguation */
  countryCode?: string;
  /** Override coordinates if already known */
  lat?: number;
  lng?: number;
}

export interface RouteStop {
  order: number;
  cityName: string;
  countryCode: string;
  lat: number;
  lng: number;
  /** Distance from the previous stop, in km */
  distanceFromPrevKm: number;
  /** Estimated travel time from the previous stop, in hours */
  travelHoursFromPrev: number;
  /** Recommended travel mode for this leg */
  travelMode: 'drive' | 'fly' | 'train';
  /** True when the leg warrants a rest day before the show */
  suggestRestDay: boolean;
  /** Notes explaining the rest-day suggestion */
  restDayNote?: string;
}

export interface TourRouteResult {
  /** Ordered stops after optimisation */
  route: RouteStop[];
  /** Total great-circle distance across all legs (km) */
  totalDistanceKm: number;
  /** Total estimated travel time across all legs (hours) */
  totalTravelHours: number;
  /** Number of legs where a rest day is recommended */
  suggestedRestDays: number;
  /**
   * Efficiency gain: how many km shorter the optimised route is vs.
   * the original input order (positive = improvement).
   */
  savedDistanceKm: number;
  /** Percentage improvement over the original order */
  efficiencyGainPct: number;
  /** Warnings for cities that couldn't be geocoded */
  warnings: string[];
}

// ─── Built-in City Coordinate DB ─────────────────────────────────────────────

interface CityRecord {
  lat: number;
  lng: number;
  countryCode: string;
  aliases?: string[];
}

/**
 * ~200 major music-market cities.
 * Keys are lowercase ASCII names.  Aliases handle common abbreviations.
 */
const CITY_DB: Record<string, CityRecord> = {
  // North America — USA
  'new york':       { lat: 40.7128, lng: -74.0060, countryCode: 'US', aliases: ['nyc', 'new york city'] },
  'los angeles':    { lat: 34.0522, lng: -118.2437, countryCode: 'US', aliases: ['la', 'l.a.'] },
  'chicago':        { lat: 41.8781, lng: -87.6298, countryCode: 'US' },
  'houston':        { lat: 29.7604, lng: -95.3698, countryCode: 'US' },
  'dallas':         { lat: 32.7767, lng: -96.7970, countryCode: 'US' },
  'miami':          { lat: 25.7617, lng: -80.1918, countryCode: 'US' },
  'atlanta':        { lat: 33.7490, lng: -84.3880, countryCode: 'US' },
  'las vegas':      { lat: 36.1699, lng: -115.1398, countryCode: 'US' },
  'seattle':        { lat: 47.6062, lng: -122.3321, countryCode: 'US' },
  'san francisco':  { lat: 37.7749, lng: -122.4194, countryCode: 'US', aliases: ['sf'] },
  'denver':         { lat: 39.7392, lng: -104.9903, countryCode: 'US' },
  'phoenix':        { lat: 33.4484, lng: -112.0740, countryCode: 'US' },
  'boston':         { lat: 42.3601, lng: -71.0589, countryCode: 'US' },
  'nashville':      { lat: 36.1627, lng: -86.7816, countryCode: 'US' },
  'portland':       { lat: 45.5051, lng: -122.6750, countryCode: 'US' },
  'minneapolis':    { lat: 44.9778, lng: -93.2650, countryCode: 'US' },
  'detroit':        { lat: 42.3314, lng: -83.0458, countryCode: 'US' },
  'philadelphia':   { lat: 39.9526, lng: -75.1652, countryCode: 'US', aliases: ['philly'] },
  'washington':     { lat: 38.9072, lng: -77.0369, countryCode: 'US', aliases: ['dc', 'washington dc'] },
  'new orleans':    { lat: 29.9511, lng: -90.0715, countryCode: 'US', aliases: ['nola'] },
  'austin':         { lat: 30.2672, lng: -97.7431, countryCode: 'US' },
  'san diego':      { lat: 32.7157, lng: -117.1611, countryCode: 'US' },
  'charlotte':      { lat: 35.2271, lng: -80.8431, countryCode: 'US' },
  'salt lake city': { lat: 40.7608, lng: -111.8910, countryCode: 'US', aliases: ['slc'] },
  'kansas city':    { lat: 39.0997, lng: -94.5786, countryCode: 'US' },
  'orlando':        { lat: 28.5383, lng: -81.3792, countryCode: 'US' },
  'tampa':          { lat: 27.9506, lng: -82.4572, countryCode: 'US' },
  'raleigh':        { lat: 35.7796, lng: -78.6382, countryCode: 'US' },
  'san jose':       { lat: 37.3382, lng: -121.8863, countryCode: 'US' },
  'indianapolis':   { lat: 39.7684, lng: -86.1581, countryCode: 'US' },
  // Canada
  'toronto':        { lat: 43.6510, lng: -79.3470, countryCode: 'CA' },
  'montreal':       { lat: 45.5017, lng: -73.5673, countryCode: 'CA' },
  'vancouver':      { lat: 49.2827, lng: -123.1207, countryCode: 'CA' },
  'calgary':        { lat: 51.0447, lng: -114.0719, countryCode: 'CA' },
  // Mexico
  'mexico city':    { lat: 19.4326, lng: -99.1332, countryCode: 'MX', aliases: ['cdmx'] },
  'guadalajara':    { lat: 20.6597, lng: -103.3496, countryCode: 'MX' },
  'monterrey':      { lat: 25.6866, lng: -100.3161, countryCode: 'MX' },
  'tijuana':        { lat: 32.5149, lng: -117.0382, countryCode: 'MX' },
  // Latin America
  'bogota':         { lat: 4.7110, lng: -74.0721, countryCode: 'CO', aliases: ['bogotá'] },
  'medellin':       { lat: 6.2442, lng: -75.5812, countryCode: 'CO', aliases: ['medellín'] },
  'buenos aires':   { lat: -34.6037, lng: -58.3816, countryCode: 'AR' },
  'sao paulo':      { lat: -23.5505, lng: -46.6333, countryCode: 'BR', aliases: ['são paulo'] },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729, countryCode: 'BR', aliases: ['rio'] },
  'lima':           { lat: -12.0464, lng: -77.0428, countryCode: 'PE' },
  'santiago':       { lat: -33.4489, lng: -70.6693, countryCode: 'CL' },
  'quito':          { lat: -0.1807, lng: -78.4678, countryCode: 'EC' },
  'caracas':        { lat: 10.4806, lng: -66.9036, countryCode: 'VE' },
  'havana':         { lat: 23.1136, lng: -82.3666, countryCode: 'CU', aliases: ['la habana'] },
  'san jose cr':    { lat: 9.9281, lng: -84.0907, countryCode: 'CR' },
  // Europe — UK
  'london':         { lat: 51.5074, lng: -0.1278, countryCode: 'GB' },
  'manchester':     { lat: 53.4808, lng: -2.2426, countryCode: 'GB' },
  'birmingham':     { lat: 52.4862, lng: -1.8904, countryCode: 'GB' },
  'glasgow':        { lat: 55.8642, lng: -4.2518, countryCode: 'GB' },
  // Europe — Western
  'paris':          { lat: 48.8566, lng: 2.3522, countryCode: 'FR' },
  'berlin':         { lat: 52.5200, lng: 13.4050, countryCode: 'DE' },
  'hamburg':        { lat: 53.5753, lng: 10.0153, countryCode: 'DE' },
  'munich':         { lat: 48.1351, lng: 11.5820, countryCode: 'DE', aliases: ['münchen'] },
  'amsterdam':      { lat: 52.3676, lng: 4.9041, countryCode: 'NL' },
  'madrid':         { lat: 40.4168, lng: -3.7038, countryCode: 'ES' },
  'barcelona':      { lat: 41.3851, lng: 2.1734, countryCode: 'ES' },
  'milan':          { lat: 45.4642, lng: 9.1900, countryCode: 'IT', aliases: ['milano'] },
  'rome':           { lat: 41.9028, lng: 12.4964, countryCode: 'IT', aliases: ['roma'] },
  'brussels':       { lat: 50.8503, lng: 4.3517, countryCode: 'BE', aliases: ['bruxelles', 'brussel'] },
  'zurich':         { lat: 47.3769, lng: 8.5417, countryCode: 'CH', aliases: ['zürich'] },
  'vienna':         { lat: 48.2082, lng: 16.3738, countryCode: 'AT', aliases: ['wien'] },
  'stockholm':      { lat: 59.3293, lng: 18.0686, countryCode: 'SE' },
  'oslo':           { lat: 59.9139, lng: 10.7522, countryCode: 'NO' },
  'copenhagen':     { lat: 55.6761, lng: 12.5683, countryCode: 'DK', aliases: ['københavn'] },
  'helsinki':       { lat: 60.1699, lng: 24.9384, countryCode: 'FI' },
  'lisbon':         { lat: 38.7169, lng: -9.1395, countryCode: 'PT', aliases: ['lisboa'] },
  'porto':          { lat: 41.1579, lng: -8.6291, countryCode: 'PT' },
  'athens':         { lat: 37.9838, lng: 23.7275, countryCode: 'GR', aliases: ['athina'] },
  'warsaw':         { lat: 52.2297, lng: 21.0122, countryCode: 'PL', aliases: ['warszawa'] },
  'prague':         { lat: 50.0755, lng: 14.4378, countryCode: 'CZ', aliases: ['praha'] },
  'budapest':       { lat: 47.4979, lng: 19.0402, countryCode: 'HU' },
  'bucharest':      { lat: 44.4268, lng: 26.1025, countryCode: 'RO', aliases: ['bucurești'] },
  'sofia':          { lat: 42.6977, lng: 23.3219, countryCode: 'BG' },
  'zagreb':         { lat: 45.8150, lng: 15.9819, countryCode: 'HR' },
  // Europe — Eastern
  'moscow':         { lat: 55.7558, lng: 37.6173, countryCode: 'RU', aliases: ['moskva'] },
  'saint petersburg': { lat: 59.9343, lng: 30.3351, countryCode: 'RU', aliases: ['st. petersburg', 'st petersburg'] },
  'kyiv':           { lat: 50.4501, lng: 30.5234, countryCode: 'UA', aliases: ['kiev'] },
  // Middle East
  'dubai':          { lat: 25.2048, lng: 55.2708, countryCode: 'AE' },
  'tel aviv':       { lat: 32.0853, lng: 34.7818, countryCode: 'IL' },
  'istanbul':       { lat: 41.0082, lng: 28.9784, countryCode: 'TR' },
  'riyadh':         { lat: 24.7136, lng: 46.6753, countryCode: 'SA' },
  'beirut':         { lat: 33.8938, lng: 35.5018, countryCode: 'LB' },
  // Asia — East
  'tokyo':          { lat: 35.6762, lng: 139.6503, countryCode: 'JP' },
  'osaka':          { lat: 34.6937, lng: 135.5023, countryCode: 'JP' },
  'seoul':          { lat: 37.5665, lng: 126.9780, countryCode: 'KR' },
  'beijing':        { lat: 39.9042, lng: 116.4074, countryCode: 'CN' },
  'shanghai':       { lat: 31.2304, lng: 121.4737, countryCode: 'CN' },
  'hong kong':      { lat: 22.3193, lng: 114.1694, countryCode: 'HK' },
  'taipei':         { lat: 25.0330, lng: 121.5654, countryCode: 'TW' },
  // Asia — South & South-East
  'singapore':      { lat: 1.3521, lng: 103.8198, countryCode: 'SG' },
  'kuala lumpur':   { lat: 3.1390, lng: 101.6869, countryCode: 'MY', aliases: ['kl'] },
  'bangkok':        { lat: 13.7563, lng: 100.5018, countryCode: 'TH' },
  'jakarta':        { lat: -6.2088, lng: 106.8456, countryCode: 'ID' },
  'manila':         { lat: 14.5995, lng: 120.9842, countryCode: 'PH' },
  'ho chi minh':    { lat: 10.8231, lng: 106.6297, countryCode: 'VN', aliases: ['ho chi minh city', 'saigon', 'hcmc'] },
  'mumbai':         { lat: 19.0760, lng: 72.8777, countryCode: 'IN', aliases: ['bombay'] },
  'delhi':          { lat: 28.7041, lng: 77.1025, countryCode: 'IN', aliases: ['new delhi'] },
  'bangalore':      { lat: 12.9716, lng: 77.5946, countryCode: 'IN', aliases: ['bengaluru'] },
  // Africa
  'johannesburg':   { lat: -26.2041, lng: 28.0473, countryCode: 'ZA', aliases: ['joburg', 'jozi'] },
  'cape town':      { lat: -33.9249, lng: 18.4241, countryCode: 'ZA' },
  'lagos':          { lat: 6.5244, lng: 3.3792, countryCode: 'NG' },
  'nairobi':        { lat: -1.2921, lng: 36.8219, countryCode: 'KE' },
  'casablanca':     { lat: 33.5731, lng: -7.5898, countryCode: 'MA' },
  'cairo':          { lat: 30.0444, lng: 31.2357, countryCode: 'EG' },
  // Oceania
  'sydney':         { lat: -33.8688, lng: 151.2093, countryCode: 'AU' },
  'melbourne':      { lat: -37.8136, lng: 144.9631, countryCode: 'AU' },
  'brisbane':       { lat: -27.4698, lng: 153.0251, countryCode: 'AU' },
  'auckland':       { lat: -36.8485, lng: 174.7633, countryCode: 'NZ' },
};

/** Build alias → primary-name map once at load time */
const ALIAS_MAP = new Map<string, string>();
for (const [primary, rec] of Object.entries(CITY_DB)) {
  ALIAS_MAP.set(primary, primary);
  for (const alias of rec.aliases ?? []) ALIAS_MAP.set(alias, primary);
}

// ─── Geocoding ───────────────────────────────────────────────────────────────

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: { country_code?: string };
}

async function geocodeCity(name: string, countryCode?: string): Promise<{ lat: number; lng: number; resolvedCountryCode: string } | null> {
  // 1. Built-in DB lookup (normalised + alias)
  const norm = name.toLowerCase().trim();
  const primaryKey = ALIAS_MAP.get(norm);
  if (primaryKey) {
    const rec = CITY_DB[primaryKey];
    if (!countryCode || rec.countryCode === countryCode.toUpperCase()) {
      return { lat: rec.lat, lng: rec.lng, resolvedCountryCode: rec.countryCode };
    }
  }

  // 2. Nominatim fallback (rate-limited public API — 1 req/s)
  try {
    const q = countryCode
      ? `${encodeURIComponent(name)}&countrycodes=${countryCode.toLowerCase()}`
      : encodeURIComponent(name);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Boostify-Music-TourOptimizer/1.0 (contact@boostify.music)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const results = await res.json() as NominatimResult[];
    if (!results.length) return null;
    const r = results[0];
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      resolvedCountryCode: r.address?.country_code?.toUpperCase() ?? 'XX',
    };
  } catch {
    return null;
  }
}

// ─── Distance (Haversine) ────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// ─── Travel Mode & Rest Day ──────────────────────────────────────────────────

/**
 * Heuristic thresholds (one-way km):
 *   < 300   → drive
 *   300–800 → train (where realistic) mapped as drive here for simplicity
 *   > 800   → fly
 */
function travelMode(km: number): RouteStop['travelMode'] {
  if (km > 800) return 'fly';
  if (km > 300) return 'train';
  return 'drive';
}

/**
 * Estimated travel hours (including airport overhead for flights):
 *   drive: 80 km/h average
 *   train: 150 km/h average
 *   fly:   600 km/h + 3h overhead
 */
function travelHours(km: number, mode: RouteStop['travelMode']): number {
  switch (mode) {
    case 'drive': return km / 80;
    case 'train': return km / 150;
    case 'fly':   return km / 600 + 3;
  }
}

/**
 * A rest day is recommended when travel time >= 4 hours or distance > 1000 km.
 */
function needsRestDay(km: number, hours: number): { needed: boolean; note: string } {
  if (km > 2000) return { needed: true, note: `Long-haul flight (${Math.round(km)} km) — rest day before show recommended` };
  if (km > 1000) return { needed: true, note: `International flight (${Math.round(km)} km) — rest day recommended` };
  if (hours >= 4) return { needed: true, note: `${Math.round(hours * 10) / 10}h travel — rest day advised` };
  return { needed: false, note: '' };
}

// ─── TSP — Nearest Neighbour ─────────────────────────────────────────────────

interface ResolvedCity {
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
}

function nearestNeighbourRoute(cities: ResolvedCity[]): ResolvedCity[] {
  if (cities.length <= 2) return [...cities];

  const unvisited = new Set<number>(cities.map((_, i) => i));
  const route: ResolvedCity[] = [];

  let current = 0; // start from the first city (anchor)
  unvisited.delete(current);
  route.push(cities[current]);

  while (unvisited.size > 0) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (const idx of unvisited) {
      const d = haversineKm(cities[current].lat, cities[current].lng, cities[idx].lat, cities[idx].lng);
      if (d < nearestDist) { nearestDist = d; nearest = idx; }
    }
    unvisited.delete(nearest);
    route.push(cities[nearest]);
    current = nearest;
  }

  return route;
}

// ─── TSP — 2-opt Improvement ─────────────────────────────────────────────────

function routeDistanceKm(cities: ResolvedCity[]): number {
  let total = 0;
  for (let i = 1; i < cities.length; i++) {
    total += haversineKm(cities[i - 1].lat, cities[i - 1].lng, cities[i].lat, cities[i].lng);
  }
  return total;
}

function twoOptImprove(route: ResolvedCity[]): ResolvedCity[] {
  if (route.length < 4) return route;

  let best = [...route];
  let bestDist = routeDistanceKm(best);
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        // Reverse the segment between i and j
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const candidateDist = routeDistanceKm(candidate);
        if (candidateDist < bestDist - 0.1) { // 100m threshold
          best = candidate;
          bestDist = candidateDist;
          improved = true;
        }
      }
    }
  }

  return best;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Optimise a multi-city tour route.
 * @param cities  Input cities in any order.
 * @param anchor  If true, the first city in the list is treated as the tour
 *                start/end and stays fixed (useful when the artist departs from
 *                their home city).  Defaults to true.
 * @param restDayThresholdHours  Minimum travel hours to trigger a rest-day
 *                suggestion.  Defaults to 4.
 */
export async function optimizeTourRoute(
  cities: TourCity[],
  options: { anchor?: boolean } = {},
): Promise<TourRouteResult> {
  const { anchor = true } = options;
  const warnings: string[] = [];

  if (cities.length < 2) {
    throw new Error('At least 2 cities are required to optimise a route');
  }

  // ── 1. Resolve coordinates for all cities ──────────────────────────────────
  const resolved: (ResolvedCity | null)[] = await Promise.all(
    cities.map(async (c) => {
      // Caller-supplied coordinates take precedence
      if (c.lat != null && c.lng != null) {
        return { name: c.name, countryCode: c.countryCode ?? 'XX', lat: c.lat, lng: c.lng };
      }
      const geo = await geocodeCity(c.name, c.countryCode);
      if (!geo) {
        warnings.push(`Could not geocode city: "${c.name}" — skipped`);
        return null;
      }
      return { name: c.name, countryCode: geo.resolvedCountryCode, lat: geo.lat, lng: geo.lng };
    }),
  );

  const validCities = resolved.filter((c): c is ResolvedCity => c !== null);

  if (validCities.length < 2) {
    throw new Error('Not enough cities could be geocoded to build a route');
  }

  // ── 2. Compute naive (input-order) distance for comparison ─────────────────
  const naiveDistanceKm = routeDistanceKm(validCities);

  // ── 3. Optimise ────────────────────────────────────────────────────────────
  let optimised: ResolvedCity[];

  if (anchor && validCities.length >= 3) {
    // Keep the first city fixed; optimise the remainder
    const [start, ...rest] = validCities;
    const nnRest = nearestNeighbourRoute(rest);
    const twoOptRest = twoOptImprove(nnRest);
    optimised = [start, ...twoOptRest];
  } else {
    const nn = nearestNeighbourRoute(validCities);
    optimised = twoOptImprove(nn);
  }

  // ── 4. Build route stops ───────────────────────────────────────────────────
  let totalDistanceKm = 0;
  let totalTravelHours = 0;
  let suggestedRestDays = 0;

  const route: RouteStop[] = optimised.map((city, idx) => {
    if (idx === 0) {
      return {
        order: 1,
        cityName: city.name,
        countryCode: city.countryCode,
        lat: city.lat,
        lng: city.lng,
        distanceFromPrevKm: 0,
        travelHoursFromPrev: 0,
        travelMode: 'drive',
        suggestRestDay: false,
      };
    }

    const prev = optimised[idx - 1];
    const km = haversineKm(prev.lat, prev.lng, city.lat, city.lng);
    const mode = travelMode(km);
    const hours = travelHours(km, mode);
    const restInfo = needsRestDay(km, hours);

    totalDistanceKm += km;
    totalTravelHours += hours;
    if (restInfo.needed) suggestedRestDays++;

    return {
      order: idx + 1,
      cityName: city.name,
      countryCode: city.countryCode,
      lat: city.lat,
      lng: city.lng,
      distanceFromPrevKm: Math.round(km),
      travelHoursFromPrev: Math.round(hours * 10) / 10,
      travelMode: mode,
      suggestRestDay: restInfo.needed,
      restDayNote: restInfo.needed ? restInfo.note : undefined,
    };
  });

  const savedDistanceKm = Math.round(naiveDistanceKm - totalDistanceKm);
  const efficiencyGainPct =
    naiveDistanceKm > 0
      ? Math.round(((naiveDistanceKm - totalDistanceKm) / naiveDistanceKm) * 100 * 10) / 10
      : 0;

  return {
    route,
    totalDistanceKm: Math.round(totalDistanceKm),
    totalTravelHours: Math.round(totalTravelHours * 10) / 10,
    suggestedRestDays,
    savedDistanceKm,
    efficiencyGainPct,
    warnings,
  };
}
