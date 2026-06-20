/**
 * Apify TikTok Viral Products Service
 * Fetches trending products from TikTok Shop via a pre-populated Apify dataset.
 * Dataset ID: z1IbLcE3hHaD5h8um (1000 products)
 */

import axios from 'axios';

const APIFY_DATASET_ID = process.env.APIFY_DATASET_ID || 'z1IbLcE3hHaD5h8um';
const APIFY_TOKEN = process.env.APIFY_TIKTOK_TOKEN || process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || '';
const DATASET_URL = `https://api.apify.com/v2/datasets/${APIFY_DATASET_ID}/items`;

export interface TikTokProduct {
  rank: number;
  product_id: string;
  name: string;
  price_display: string;
  units_sold: number;
  gmv: number;
  creator_count: number;
  product_img_url: string;
  product_url: string;
  categories: string[];
  region: string;
  days_period: number;
  scraped_at: string;
  engagement_rate: number;
}

// In-memory cache
let cachedProducts: TikTokProduct[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch viral products from the Apify dataset
 */
export async function fetchViralProducts(options: {
  limit?: number;
  offset?: number;
  minUnitsSold?: number;
} = {}): Promise<TikTokProduct[]> {
  const { limit = 100, offset = 0, minUnitsSold = 0 } = options;

  // Return from cache if fresh
  if (cachedProducts.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    let filtered = cachedProducts;
    if (minUnitsSold > 0) {
      filtered = filtered.filter(p => p.units_sold >= minUnitsSold);
    }
    return filtered.slice(offset, offset + limit);
  }

  try {
    const response = await axios.get(DATASET_URL, {
      params: {
        token: APIFY_TOKEN,
        format: 'json',
        limit: 1000,
      },
      timeout: 15000,
    });

    const items: TikTokProduct[] = Array.isArray(response.data) ? response.data : [];
    
    // Update cache
    cachedProducts = items;
    cacheTimestamp = Date.now();
    console.log(`✅ [Apify TikTok] Fetched ${items.length} viral products`);

    let filtered = items;
    if (minUnitsSold > 0) {
      filtered = filtered.filter(p => p.units_sold >= minUnitsSold);
    }
    return filtered.slice(offset, offset + limit);
  } catch (error: any) {
    console.error('❌ [Apify TikTok] Error fetching products:', error.message);
    // Return stale cache if available
    if (cachedProducts.length > 0) {
      return cachedProducts.slice(offset, offset + limit);
    }
    throw new Error(`Failed to fetch TikTok products: ${error.message}`);
  }
}

/**
 * Get a single product by its product_id
 */
export async function getProductById(productId: string): Promise<TikTokProduct | null> {
  // Ensure cache is populated
  if (cachedProducts.length === 0 || Date.now() - cacheTimestamp >= CACHE_TTL) {
    await fetchViralProducts({ limit: 1000 });
  }
  return cachedProducts.find(p => p.product_id === productId) || null;
}
