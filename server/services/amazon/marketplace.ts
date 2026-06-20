/**
 * Amazon Associates marketplace detection from tag suffix.
 *
 * Each Amazon locale has a fixed numeric suffix on the Associates tag.
 * Reference: https://webservices.amazon.com/paapi5/documentation/locale-reference.html
 *
 * Used both for:
 *  - Detail page URL hostname (where to send the customer)
 *  - Associates image widget host + MarketPlace param (legacy widgets, no PA-API needed)
 */

export interface MarketplaceInfo {
  /** Amazon storefront hostname (e.g. www.amazon.co.uk) */
  host: string;
  /** TLD (com, co.uk, de, ...) used for /dp/ links */
  tld: string;
  /** PA-API marketplace value */
  marketplace: string;
  /** PA-API host */
  paapiHost: string;
  /** PA-API region */
  paapiRegion: string;
  /** Image widget regional host segment: na | eu | fe */
  widgetRegion: 'na' | 'eu' | 'fe';
  /** MarketPlace param value for image widget */
  widgetMarketplace: string;
  /** ISO country code (for analytics) */
  country: string;
  /** Human-readable name */
  label: string;
}

const TAG_SUFFIX_MAP: Record<string, MarketplaceInfo> = {
  // -- North America -------------------------------------------------------
  '20': {
    host: 'www.amazon.com',
    tld: 'com',
    marketplace: 'www.amazon.com',
    paapiHost: 'webservices.amazon.com',
    paapiRegion: 'us-east-1',
    widgetRegion: 'na',
    widgetMarketplace: 'US',
    country: 'US',
    label: 'United States',
  },
  '01': {
    host: 'www.amazon.ca',
    tld: 'ca',
    marketplace: 'www.amazon.ca',
    paapiHost: 'webservices.amazon.ca',
    paapiRegion: 'us-east-1',
    widgetRegion: 'na',
    widgetMarketplace: 'CA',
    country: 'CA',
    label: 'Canada',
  },
  '12': {
    host: 'www.amazon.com.mx',
    tld: 'com.mx',
    marketplace: 'www.amazon.com.mx',
    paapiHost: 'webservices.amazon.com.mx',
    paapiRegion: 'us-east-1',
    widgetRegion: 'na',
    widgetMarketplace: 'MX',
    country: 'MX',
    label: 'Mexico',
  },
  // -- Europe ---------------------------------------------------------------
  '21': {
    host: 'www.amazon.co.uk',
    tld: 'co.uk',
    marketplace: 'www.amazon.co.uk',
    paapiHost: 'webservices.amazon.co.uk',
    paapiRegion: 'eu-west-1',
    widgetRegion: 'eu',
    widgetMarketplace: 'GB',
    country: 'GB',
    label: 'United Kingdom',
  },
  '05': {
    host: 'www.amazon.fr',
    tld: 'fr',
    marketplace: 'www.amazon.fr',
    paapiHost: 'webservices.amazon.fr',
    paapiRegion: 'eu-west-1',
    widgetRegion: 'eu',
    widgetMarketplace: 'FR',
    country: 'FR',
    label: 'France',
  },
  '21de': { // placeholder; .de uses suffix '-21' too in some accounts; rely on tld override below
    host: 'www.amazon.de',
    tld: 'de',
    marketplace: 'www.amazon.de',
    paapiHost: 'webservices.amazon.de',
    paapiRegion: 'eu-west-1',
    widgetRegion: 'eu',
    widgetMarketplace: 'DE',
    country: 'DE',
    label: 'Germany',
  },
  '15': {
    host: 'www.amazon.es',
    tld: 'es',
    marketplace: 'www.amazon.es',
    paapiHost: 'webservices.amazon.es',
    paapiRegion: 'eu-west-1',
    widgetRegion: 'eu',
    widgetMarketplace: 'ES',
    country: 'ES',
    label: 'Spain',
  },
  '11': {
    host: 'www.amazon.it',
    tld: 'it',
    marketplace: 'www.amazon.it',
    paapiHost: 'webservices.amazon.it',
    paapiRegion: 'eu-west-1',
    widgetRegion: 'eu',
    widgetMarketplace: 'IT',
    country: 'IT',
    label: 'Italy',
  },
  // -- Asia / Pacific -------------------------------------------------------
  '22': {
    host: 'www.amazon.co.jp',
    tld: 'co.jp',
    marketplace: 'www.amazon.co.jp',
    paapiHost: 'webservices.amazon.co.jp',
    paapiRegion: 'us-west-2',
    widgetRegion: 'fe',
    widgetMarketplace: 'JP',
    country: 'JP',
    label: 'Japan',
  },
  '21in': { // .in uses '-21' too in legacy accounts; same fallback strategy as .de
    host: 'www.amazon.in',
    tld: 'in',
    marketplace: 'www.amazon.in',
    paapiHost: 'webservices.amazon.in',
    paapiRegion: 'eu-west-1',
    widgetRegion: 'fe',
    widgetMarketplace: 'IN',
    country: 'IN',
    label: 'India',
  },
};

const DEFAULT_MARKETPLACE: MarketplaceInfo = TAG_SUFFIX_MAP['20'];

/** Country-code lookup (uppercased) -> MarketplaceInfo for explicit overrides. */
const COUNTRY_OVERRIDE_MAP: Record<string, MarketplaceInfo> = {
  US: TAG_SUFFIX_MAP['20'],
  CA: TAG_SUFFIX_MAP['01'],
  MX: TAG_SUFFIX_MAP['12'],
  UK: TAG_SUFFIX_MAP['21'],
  GB: TAG_SUFFIX_MAP['21'],
  FR: TAG_SUFFIX_MAP['05'],
  DE: TAG_SUFFIX_MAP['21de'],
  ES: TAG_SUFFIX_MAP['15'],
  IT: TAG_SUFFIX_MAP['11'],
  JP: TAG_SUFFIX_MAP['22'],
  IN: TAG_SUFFIX_MAP['21in'],
};

/** All supported marketplaces, for UI dropdowns. */
export const SUPPORTED_MARKETPLACES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'US', label: 'United States (amazon.com)' },
  { code: 'UK', label: 'United Kingdom (amazon.co.uk)' },
  { code: 'CA', label: 'Canada (amazon.ca)' },
  { code: 'MX', label: 'Mexico (amazon.com.mx)' },
  { code: 'FR', label: 'France (amazon.fr)' },
  { code: 'DE', label: 'Germany (amazon.de)' },
  { code: 'ES', label: 'Spain (amazon.es)' },
  { code: 'IT', label: 'Italy (amazon.it)' },
  { code: 'JP', label: 'Japan (amazon.co.jp)' },
  { code: 'IN', label: 'India (amazon.in)' },
];

/**
 * Best-effort detection of the marketplace from an Associates tag,
 * with optional manual override that takes precedence.
 *
 * @param tag      Associates tag (e.g. "myartist-20")
 * @param override Optional country-code override (e.g. "US", "UK")
 */
export function detectMarketplaceFromTag(
  tag: string | null | undefined,
  override?: string | null,
): MarketplaceInfo {
  // 1) Explicit override wins
  if (override) {
    const o = override.toUpperCase();
    if (COUNTRY_OVERRIDE_MAP[o]) return COUNTRY_OVERRIDE_MAP[o];
  }
  // 2) Tag suffix detection
  if (!tag) return resolveFromEnv();
  const m = tag.match(/-([0-9]{2})$/);
  if (!m) return resolveFromEnv();
  const suffix = m[1];
  return TAG_SUFFIX_MAP[suffix] ?? resolveFromEnv();
}

function resolveFromEnv(): MarketplaceInfo {
  const envMp = (process.env.PAAPI_MARKETPLACE || '').toLowerCase();
  if (envMp.includes('co.uk')) return TAG_SUFFIX_MAP['21'];
  if (envMp.includes('amazon.de')) return TAG_SUFFIX_MAP['21de'];
  if (envMp.includes('amazon.fr')) return TAG_SUFFIX_MAP['05'];
  if (envMp.includes('amazon.es')) return TAG_SUFFIX_MAP['15'];
  if (envMp.includes('amazon.it')) return TAG_SUFFIX_MAP['11'];
  if (envMp.includes('amazon.ca')) return TAG_SUFFIX_MAP['01'];
  if (envMp.includes('amazon.co.jp')) return TAG_SUFFIX_MAP['22'];
  if (envMp.includes('amazon.com.mx')) return TAG_SUFFIX_MAP['12'];
  if (envMp.includes('amazon.in')) return TAG_SUFFIX_MAP['21in'];
  return DEFAULT_MARKETPLACE;
}

/**
 * Build the canonical Amazon detail page URL with affiliate tag for a given ASIN.
 */
export function buildDetailPageUrl(
  asin: string,
  tag: string,
  mp?: MarketplaceInfo,
): string {
  const m = mp ?? detectMarketplaceFromTag(tag);
  return `https://${m.host}/dp/${encodeURIComponent(asin)}?tag=${encodeURIComponent(tag)}&linkCode=ll1&language=${m.country === 'GB' ? 'en_GB' : 'en_US'}`;
}

/**
 * Build the Amazon Associates image widget URL for an ASIN.
 * This works WITHOUT PA-API credentials — it's the legacy widget endpoint
 * that Associates have used since 2007.
 *
 * Returns a 250px image; clicks attribute commission to the tag.
 */
export function buildAssociatesImageUrl(
  asin: string,
  tag: string,
  mp?: MarketplaceInfo,
  size: 250 | 160 | 110 = 250,
): string {
  const m = mp ?? detectMarketplaceFromTag(tag);
  const host = `ws-${m.widgetRegion}.amazon-adsystem.com`;
  const params = new URLSearchParams({
    _encoding: 'UTF8',
    ASIN: asin,
    Format: `_SL${size}_`,
    ID: 'AsinImage',
    MarketPlace: m.widgetMarketplace,
    ServiceVersion: '20070822',
    WS: '1',
    tag,
  });
  return `https://${host}/widgets/q?${params.toString()}`;
}
