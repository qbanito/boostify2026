/**
 * Image dimensions probe — measures the REAL width/height of a design/logo
 * from its URL so Printful placement boxes match the actual image aspect
 * ratio (prevents stretched/misplaced logos on products).
 *
 * Uses sharp metadata (fast, reads header only from buffer). Cached per URL.
 */
import sharp from 'sharp';

export interface ImageDimensions {
  width: number;
  height: number;
  /** width / height */
  ratio: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h
const cache = new Map<string, { at: number; dims: ImageDimensions }>();

/**
 * Fetches the image and reads its intrinsic dimensions.
 * Returns null on any failure (caller should fall back to a sane default).
 */
export async function getImageDimensions(url: string | undefined | null): Promise<ImageDimensions | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.dims;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: 'image/*' },
    });
    if (!res.ok) {
      console.warn(`[image-dims] HTTP ${res.status} for ${url.slice(0, 120)}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return null;

    const dims: ImageDimensions = {
      width: meta.width,
      height: meta.height,
      ratio: meta.width / meta.height,
    };
    cache.set(url, { at: Date.now(), dims });
    return dims;
  } catch (err: any) {
    console.warn(`[image-dims] Failed to measure ${url.slice(0, 120)}:`, err?.message);
    return null;
  }
}

/**
 * Convenience: returns the real aspect ratio of an image URL,
 * or the provided fallback when it can't be measured.
 */
export async function getImageAspectRatio(url: string | undefined | null, fallback = 1): Promise<number> {
  const dims = await getImageDimensions(url);
  return dims?.ratio ?? fallback;
}
