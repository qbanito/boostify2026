/**
 * Apify Sponsor Scraper Service
 * Scrapes brand/sponsor data from Instagram, Google, and websites using Apify actors.
 * Deduplicates contacts and stores them in sponsor_contacts table.
 */

import { ApifyClient } from 'apify-client';
import crypto from 'crypto';
import { db } from '../db';
import { sponsorContacts, type InsertSponsorContact } from '../db/schema';
import { eq } from 'drizzle-orm';

// ─── API Key Validation ────────────────────────────────────────────
const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || '';

if (!APIFY_TOKEN) {
  console.warn('⚠️ APIFY_API_TOKEN/APIFY_API_KEY is not set — sponsor scraping will fail.');
}

const apifyClient = new ApifyClient({ token: APIFY_TOKEN });

// ─── Google Search Filtering ───────────────────────────────────────
const BLOCKED_DOMAINS = new Set([
  'wikipedia.org', 'youtube.com', 'facebook.com', 'twitter.com',
  'reddit.com', 'linkedin.com', 'pinterest.com', 'tiktok.com',
  'instagram.com', 'amazon.com', 'ebay.com', 'yelp.com',
  'indeed.com', 'glassdoor.com', 'bbb.org', 'crunchbase.com',
]);

function isLikelyCorporateDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    if (BLOCKED_DOMAINS.has(host)) return false;
    // Filter out social, aggregator, and news result pages
    if (/\.(gov|edu)$/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export interface ScrapedBrand {
  brandName: string;
  contactEmail?: string;
  contactName?: string;
  contactRole?: string;
  website?: string;
  instagramHandle?: string;
  linkedinUrl?: string;
  industry?: string;
  followerCount?: number;
  engagementRate?: number;
  description?: string;
  companySize?: string;
}

/**
 * Generate deduplication hash for a sponsor contact
 */
export function generateDedupeHash(email: string | undefined, brandName: string): string {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const normalizedBrand = brandName.toLowerCase().trim();
  return crypto.createHash('sha256').update(`${normalizedEmail}|${normalizedBrand}`).digest('hex');
}

/**
 * Map industry keywords to our enum
 */
function detectIndustry(text: string): InsertSponsorContact['industry'] {
  const lower = (text || '').toLowerCase();
  const map: Record<string, InsertSponsorContact['industry']> = {
    fashion: 'fashion', clothing: 'fashion', apparel: 'fashion', style: 'fashion',
    tech: 'tech', software: 'tech', saas: 'tech', app: 'tech', digital: 'tech',
    beverage: 'beverage', drink: 'beverage', alcohol: 'beverage', beer: 'beverage', wine: 'beverage', energy: 'beverage',
    beauty: 'cosmetics', cosmetic: 'cosmetics', skincare: 'cosmetics', makeup: 'cosmetics',
    car: 'automotive', auto: 'automotive', motor: 'automotive', vehicle: 'automotive',
    gaming: 'gaming', game: 'gaming', esport: 'gaming',
    food: 'food', restaurant: 'food', snack: 'food', nutrition: 'food',
    sport: 'sports', fitness: 'sports', athletic: 'sports', gym: 'sports',
    crypto: 'crypto', blockchain: 'crypto', web3: 'crypto', nft: 'crypto',
    finance: 'finance', bank: 'finance', investment: 'finance', insurance: 'finance',
    travel: 'travel', hotel: 'travel', airline: 'travel', tourism: 'travel',
    health: 'health', medical: 'health', wellness: 'health', pharma: 'health',
    media: 'media', news: 'media', magazine: 'media', publishing: 'media',
    entertainment: 'entertainment', music: 'entertainment', film: 'entertainment', streaming: 'entertainment',
    telecom: 'telecom', mobile: 'telecom', wireless: 'telecom',
  };
  for (const [keyword, industry] of Object.entries(map)) {
    if (lower.includes(keyword)) return industry;
  }
  return 'other';
}

export class ApifySponsorScraperService {

  /** Check whether Apify token is configured */
  isConfigured(): boolean {
    return !!APIFY_TOKEN;
  }

  /**
   * Search brands on Instagram by niche/hashtag
   * Uses apify/instagram-scraper to find brand accounts
   */
  async searchBrandsByNiche(niche: string, limit: number = 20): Promise<ScrapedBrand[]> {
    if (!this.isConfigured()) throw new Error('APIFY_API_TOKEN is not configured. Set it in your environment variables.');
    console.log(`🔍 Searching brands on Instagram for niche: ${niche}`);

    const run = await apifyClient.actor('apify/instagram-scraper').call({
      search: niche,
      searchType: 'user',
      resultsLimit: limit,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    if (!items?.length) return [];

    return items.map((item: any) => ({
      brandName: item.fullName || item.username || 'Unknown',
      instagramHandle: item.username,
      website: item.externalUrl || item.website || undefined,
      description: item.biography || item.bio || undefined,
      followerCount: item.followersCount || 0,
      engagementRate: item.engagementRate || undefined,
      contactEmail: this.extractEmailFromBio(item.biography || ''),
      industry: detectIndustry(`${item.biography || ''} ${item.fullName || ''} ${niche}`),
    }));
  }

  /**
   * Get detailed brand profile from Instagram
   */
  async scrapeBrandInstagram(username: string): Promise<ScrapedBrand | null> {
    if (!this.isConfigured()) throw new Error('APIFY_API_TOKEN is not configured. Set it in your environment variables.');
    console.log(`📱 Scraping brand Instagram: @${username}`);

    const run = await apifyClient.actor('apify/instagram-scraper').call({
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: 'profiles',
      resultsLimit: 1,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    if (!items?.length) return null;

    const profile = items[0];
    return {
      brandName: profile.fullName || username,
      instagramHandle: profile.username || username,
      website: profile.externalUrl || profile.website || undefined,
      description: profile.biography || undefined,
      followerCount: profile.followersCount || 0,
      contactEmail: this.extractEmailFromBio(profile.biography || ''),
      industry: detectIndustry(`${profile.biography || ''} ${profile.fullName || ''}`),
    };
  }

  /**
   * Search for potential sponsors via Google
   */
  async searchSponsorsOnGoogle(query: string, limit: number = 15): Promise<ScrapedBrand[]> {
    if (!this.isConfigured()) throw new Error('APIFY_API_TOKEN is not configured. Set it in your environment variables.');
    console.log(`🌐 Google search for sponsors: "${query}"`);

    const run = await apifyClient.actor('apify/google-search-scraper').call({
      queries: `${query} brand sponsorship collaboration music artist partnership`,
      maxPagesPerQuery: 2,
      resultsPerPage: limit,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    if (!items?.length) return [];

    const brands: ScrapedBrand[] = [];
    for (const item of items) {
      if (item.organicResults) {
        for (const result of item.organicResults.slice(0, limit * 2)) {
          const url = result.url || '';
          if (!url || !isLikelyCorporateDomain(url)) continue;

          const domain = this.extractDomain(url);
          if (!domain) continue;

          // Extract clean brand name: prefer title before separators, fallback to domain
          let brandName = (result.title || '').split(/\s[-–|·:]\s/)[0]?.trim();
          if (!brandName || brandName.length > 60) brandName = domain.split('.')[0];
          // Skip generic results (articles, lists)
          if (/top \d+|best \d+|\d+ brands|how to|guide|wiki/i.test(result.title || '')) continue;

          brands.push({
            brandName,
            website: url,
            description: result.description,
            industry: detectIndustry(`${result.title || ''} ${result.description || ''} ${query}`),
          });

          if (brands.length >= limit) break;
        }
      }
    }

    return brands;
  }

  /**
   * Crawl a brand's website for contact/partnership information
   */
  async enrichContactFromWebsite(websiteUrl: string): Promise<Partial<ScrapedBrand>> {
    if (!this.isConfigured()) throw new Error('APIFY_API_TOKEN is not configured. Set it in your environment variables.');
    console.log(`🕷️ Crawling website for contact info: ${websiteUrl}`);

    const run = await apifyClient.actor('apify/website-content-crawler').call({
      startUrls: [{ url: websiteUrl }],
      maxCrawlPages: 5,
      crawlerType: 'cheerio',
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    if (!items?.length) return {};

    let allText = '';
    for (const page of items) {
      allText += ` ${page.text || ''} ${page.title || ''}`;
    }

    // Extract emails from crawled content
    const emails = allText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [];
    const partnershipEmails = emails.filter(e =>
      /partner|sponsor|market|brand|collab|business|press|media/i.test(e)
    );

    return {
      contactEmail: partnershipEmails[0] || emails[0] || undefined,
      description: items[0]?.text?.slice(0, 500) || undefined,
    };
  }

  /**
   * Save scraped brands to database with deduplication
   */
  async saveContacts(brands: ScrapedBrand[], userId: number, importSource: InsertSponsorContact['importSource'] = 'manual'): Promise<{
    saved: number;
    duplicates: number;
    errors: number;
  }> {
    let saved = 0, duplicates = 0, errors = 0;

    for (const brand of brands) {
      try {
        const hash = generateDedupeHash(brand.contactEmail, brand.brandName);

        // Check for duplicates
        const existing = await db.select({ id: sponsorContacts.id })
          .from(sponsorContacts)
          .where(eq(sponsorContacts.dedupeHash, hash))
          .limit(1);

        if (existing.length > 0) {
          duplicates++;
          continue;
        }

        await db.insert(sponsorContacts).values({
          brandName: brand.brandName,
          contactName: brand.contactName || null,
          contactEmail: brand.contactEmail || null,
          contactPhone: brand.contactPhone || null,
          contactRole: brand.contactRole || null,
          website: brand.website || null,
          instagramHandle: brand.instagramHandle || null,
          linkedinUrl: brand.linkedinUrl || null,
          industry: (brand.industry as any) || 'other',
          companySize: brand.companySize || null,
          description: brand.description || null,
          followerCount: brand.followerCount || 0,
          engagementRate: brand.engagementRate || null,
          dedupeHash: hash,
          importSource,
          addedByUserId: userId,
          status: 'new',
        });
        saved++;
      } catch (err) {
        console.error(`❌ Error saving sponsor contact ${brand.brandName}:`, err);
        errors++;
      }
    }

    console.log(`✅ Sponsors saved: ${saved}, duplicates: ${duplicates}, errors: ${errors}`);
    return { saved, duplicates, errors };
  }

  /**
   * Extract email from Instagram bio text
   */
  private extractEmailFromBio(bio: string): string | undefined {
    const match = bio.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    return match ? match[0] : undefined;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string | undefined {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return undefined;
    }
  }
}

export const apifySponsorScraper = new ApifySponsorScraperService();
