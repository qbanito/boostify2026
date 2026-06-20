/**
 * Amazon Product Advertising API 5 Client
 *
 * Implements AWS Signature V4 signing for the PA-API 5 SearchItems / GetItems
 * operations. No SDK is used — we build the request, sign it, and POST it.
 *
 * Compliance:
 *  - Throttled to 1 TPS (Amazon default per associate account).
 *  - Default daily budget: 8,640 calls.
 *  - Caller is responsible for caching (TTL ≤ 24h is mandatory per Amazon TOS).
 *
 * Required env:
 *  - PAAPI_ACCESS_KEY
 *  - PAAPI_SECRET_KEY
 *  - PAAPI_PARTNER_TAG     (default platform tag, used as fallback)
 *  - PAAPI_HOST            (default: webservices.amazon.com)
 *  - PAAPI_REGION          (default: us-east-1)
 *  - PAAPI_MARKETPLACE     (default: www.amazon.com)
 */

import crypto from 'crypto';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type PaapiSearchIndex =
  | 'All'
  | 'Apparel'
  | 'Books'
  | 'Electronics'
  | 'HomeAndKitchen'
  | 'MusicalInstruments'
  | 'Music'
  | 'OfficeProducts'
  | 'Beauty'
  | 'Toys'
  | 'VideoGames'
  | 'Jewelry'
  | 'Software'
  | 'GardenAndOutdoor'
  | 'ArtsAndCrafts';

export interface PaapiSearchOptions {
  keywords: string;
  searchIndex?: PaapiSearchIndex;
  itemCount?: number; // 1..10
  minReviewsRating?: number; // 1..5
  minPrice?: number; // cents
  maxPrice?: number; // cents
  partnerTag?: string; // override per call (per-artist tag)
  marketplace?: string;
}

export interface PaapiItem {
  asin: string;
  title: string;
  detailPageUrl: string;
  imageUrl: string | null;
  price: { amount: number; currency: string; display: string } | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  brand: string | null;
}

export interface PaapiError extends Error {
  statusCode?: number;
  retryable?: boolean;
  code?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Throttle: 1 TPS across the whole process
// ────────────────────────────────────────────────────────────────────────────

class TpsThrottle {
  private queue: Array<() => void> = [];
  private lastDispatch = 0;
  private readonly minSpacingMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(tps: number) {
    this.minSpacingMs = Math.ceil(1000 / tps) + 50; // small safety buffer
  }

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.schedule();
    });
  }

  private schedule() {
    if (this.timer) return;
    const now = Date.now();
    const wait = Math.max(0, this.lastDispatch + this.minSpacingMs - now);
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.queue.shift();
      if (next) {
        this.lastDispatch = Date.now();
        next();
      }
      if (this.queue.length > 0) this.schedule();
    }, wait);
  }
}

const throttle = new TpsThrottle(1);

// ────────────────────────────────────────────────────────────────────────────
// AWS Signature V4
// ────────────────────────────────────────────────────────────────────────────

const SERVICE = 'ProductAdvertisingAPI';

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

function deriveSigningKey(secret: string, dateStamp: string, region: string): Buffer {
  const kDate = hmacSha256('AWS4' + secret, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, SERVICE);
  return hmacSha256(kService, 'aws4_request');
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function buildSignedRequest(opts: {
  host: string;
  region: string;
  accessKey: string;
  secretKey: string;
  target: string; // 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems' | '...GetItems'
  path: string; // '/paapi5/searchitems' | '/paapi5/getitems'
  payload: object;
}): SignedRequest {
  const { host, region, accessKey, secretKey, target, path, payload } = opts;

  const body = JSON.stringify(payload);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host,
    'x-amz-date': amzDate,
    'x-amz-target': target,
  };

  // Canonical request
  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${headers[k].trim()}\n`)
    .join('');
  const signedHeaders = sortedHeaderKeys.join(';');
  const payloadHash = sha256Hex(body);

  const canonicalRequest = [
    'POST',
    path,
    '', // canonical query string (empty)
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // String to sign
  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  // Signature
  const signingKey = deriveSigningKey(secretKey, dateStamp, region);
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${host}${path}`,
    headers: { ...headers, Authorization: authHeader },
    body,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Client
// ────────────────────────────────────────────────────────────────────────────

function getConfig() {
  const accessKey = process.env.PAAPI_ACCESS_KEY;
  const secretKey = process.env.PAAPI_SECRET_KEY;
  const partnerTag = process.env.PAAPI_PARTNER_TAG;
  const host = process.env.PAAPI_HOST || 'webservices.amazon.com';
  const region = process.env.PAAPI_REGION || 'us-east-1';
  const marketplace = process.env.PAAPI_MARKETPLACE || 'www.amazon.com';

  if (!accessKey || !secretKey || !partnerTag) {
    throw new Error(
      '[paapi] Missing env: PAAPI_ACCESS_KEY / PAAPI_SECRET_KEY / PAAPI_PARTNER_TAG',
    );
  }
  return { accessKey, secretKey, partnerTag, host, region, marketplace };
}

export function isPaapiConfigured(): boolean {
  return !!(
    process.env.PAAPI_ACCESS_KEY &&
    process.env.PAAPI_SECRET_KEY &&
    process.env.PAAPI_PARTNER_TAG
  );
}

const SEARCH_RESOURCES = [
  'Images.Primary.Large',
  'Images.Primary.Medium',
  'ItemInfo.Title',
  'ItemInfo.ByLineInfo',
  'ItemInfo.Classifications',
  'Offers.Listings.Price',
  'CustomerReviews.StarRating',
  'CustomerReviews.Count',
  'BrowseNodeInfo.BrowseNodes',
];

function mapItem(raw: any): PaapiItem | null {
  if (!raw?.ASIN) return null;
  const title: string = raw.ItemInfo?.Title?.DisplayValue ?? '';
  const detailPageUrl: string = raw.DetailPageURL ?? '';
  const imageUrl: string | null =
    raw.Images?.Primary?.Large?.URL ?? raw.Images?.Primary?.Medium?.URL ?? null;

  const listing = raw.Offers?.Listings?.[0];
  const price = listing?.Price
    ? {
        amount: Number(listing.Price.Amount ?? 0),
        currency: String(listing.Price.Currency ?? 'USD'),
        display: String(listing.Price.DisplayAmount ?? ''),
      }
    : null;

  const reviews = raw.CustomerReviews;
  const rating = typeof reviews?.StarRating?.Value === 'number'
    ? reviews.StarRating.Value
    : null;
  const reviewCount = typeof reviews?.Count === 'number' ? reviews.Count : null;

  const browseNode = raw.BrowseNodeInfo?.BrowseNodes?.[0];
  const category = browseNode?.DisplayName ?? null;
  const brand = raw.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ?? null;

  return {
    asin: String(raw.ASIN),
    title,
    detailPageUrl,
    imageUrl,
    price,
    rating,
    reviewCount,
    category,
    brand,
  };
}

async function postSigned(target: string, path: string, payload: object): Promise<any> {
  const cfg = getConfig();

  await throttle.acquire();

  const signed = buildSignedRequest({
    host: cfg.host,
    region: cfg.region,
    accessKey: cfg.accessKey,
    secretKey: cfg.secretKey,
    target,
    path,
    payload,
  });

  const res = await fetch(signed.url, {
    method: 'POST',
    headers: signed.headers,
    body: signed.body,
  });

  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const errType = data?.__type ?? data?.Errors?.[0]?.Code ?? `HTTP_${res.status}`;
    const errMsg = data?.message ?? data?.Errors?.[0]?.Message ?? text.slice(0, 500);
    const err: PaapiError = new Error(`[paapi] ${errType}: ${errMsg}`);
    err.statusCode = res.status;
    err.code = errType;
    err.retryable = res.status === 429 || res.status === 503 || res.status >= 500;
    throw err;
  }

  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export async function searchItems(opts: PaapiSearchOptions): Promise<PaapiItem[]> {
  const cfg = getConfig();

  const payload: Record<string, unknown> = {
    Keywords: opts.keywords,
    SearchIndex: opts.searchIndex ?? 'All',
    ItemCount: Math.min(Math.max(opts.itemCount ?? 10, 1), 10),
    PartnerTag: opts.partnerTag || cfg.partnerTag,
    PartnerType: 'Associates',
    Marketplace: opts.marketplace || cfg.marketplace,
    Resources: SEARCH_RESOURCES,
  };
  if (opts.minReviewsRating) payload.MinReviewsRating = opts.minReviewsRating;
  if (opts.minPrice) payload.MinPrice = opts.minPrice;
  if (opts.maxPrice) payload.MaxPrice = opts.maxPrice;

  const data = await postSigned(
    'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
    '/paapi5/searchitems',
    payload,
  );

  const items: any[] = data?.SearchResult?.Items ?? [];
  return items.map(mapItem).filter((x): x is PaapiItem => x !== null);
}

export async function getItems(
  asins: string[],
  partnerTag?: string,
): Promise<PaapiItem[]> {
  if (asins.length === 0) return [];
  const cfg = getConfig();

  const payload = {
    ItemIds: asins.slice(0, 10),
    PartnerTag: partnerTag || cfg.partnerTag,
    PartnerType: 'Associates',
    Marketplace: cfg.marketplace,
    Resources: SEARCH_RESOURCES,
  };

  const data = await postSigned(
    'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
    '/paapi5/getitems',
    payload,
  );

  const items: any[] = data?.ItemsResult?.Items ?? [];
  return items.map(mapItem).filter((x): x is PaapiItem => x !== null);
}

/**
 * Inject affiliate tag into an Amazon URL. Replaces or appends ?tag=... param.
 */
export function withAffiliateTag(url: string, tag: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('tag', tag);
    u.searchParams.set('linkCode', 'll1');
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}tag=${encodeURIComponent(tag)}&linkCode=ll1`;
  }
}
