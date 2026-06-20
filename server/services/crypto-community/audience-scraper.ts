/**
 * CRYPTO COMMUNITY — Apify Audience Scraper
 * Extracts crypto/music audiences from Instagram, Twitter, TikTok via Apify actors
 * Deduplicates and stores in crypto_outreach_contacts table
 */

import { ApifyClient } from 'apify-client';
import crypto from 'crypto';
import { db } from '../../db';
import { eq, and, sql } from 'drizzle-orm';
import { cryptoOutreachContacts } from '../../../db/crypto-community-schema';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || '';
const apifyClient = APIFY_TOKEN ? new ApifyClient({ token: APIFY_TOKEN }) : null;

// ── Dedup ──

function dedupeHash(platform: string, username: string): string {
  return crypto.createHash('sha256')
    .update(`${platform}|${username.toLowerCase().trim()}`)
    .digest('hex');
}

// ── Tag Detection ──

const CRYPTO_KEYWORDS = [
  'crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'nft', 'web3', 'defi',
  'blockchain', 'token', 'dao', 'degen', 'hodl', 'altcoin', 'solana', 'polygon',
  'metaverse', 'wallet', 'mint', 'airdrop', 'staking',
];
const MUSIC_KEYWORDS = [
  'music', 'artist', 'producer', 'rapper', 'singer', 'dj', 'beatmaker',
  'hiphop', 'trap', 'reggaeton', 'latin', 'pop', 'rock', 'rnb', 'edm',
  'songwriter', 'vocalist', 'band', 'album', 'ep', 'single',
];

function detectTags(bio: string): string[] {
  const lower = (bio || '').toLowerCase();
  const tags: string[] = [];
  for (const kw of CRYPTO_KEYWORDS) {
    if (lower.includes(kw)) { tags.push(kw); break; } // at least one crypto tag
  }
  for (const kw of MUSIC_KEYWORDS) {
    if (lower.includes(kw)) { tags.push(kw); break; }
  }
  // Finer tags
  if (lower.includes('nft')) tags.push('nft');
  if (lower.includes('defi')) tags.push('defi');
  if (lower.includes('dao')) tags.push('dao');
  if (lower.includes('collector')) tags.push('collector');
  if (lower.includes('trader')) tags.push('trader');
  return [...new Set(tags)];
}

function detectAudienceType(followerCount: number, bio: string): string {
  const lower = (bio || '').toLowerCase();
  if (followerCount > 50000) return 'influencer';
  if (lower.includes('founder') || lower.includes('ceo') || lower.includes('community')) return 'community_leader';
  if (lower.includes('trader') || lower.includes('trading') || lower.includes('degen')) return 'active_trader';
  if (lower.includes('collector') || lower.includes('nft')) return 'collector';
  return 'fan';
}

function relevanceScore(tags: string[], followers: number): number {
  let score = 0;
  if (tags.includes('crypto') || tags.includes('nft') || tags.includes('web3')) score += 30;
  if (tags.includes('music') || tags.includes('artist')) score += 25;
  if (tags.length > 2) score += 15;
  // Follower weight (sweet spot 1k-100k)
  if (followers >= 1000 && followers <= 100000) score += 20;
  else if (followers > 100000) score += 10;
  else if (followers >= 500) score += 5;
  return Math.min(score, 100);
}

// ── Instagram Scraping ──

interface InstagramScrapedProfile {
  username: string;
  userId?: string;
  fullName?: string;
  biography?: string;
  profilePicUrl?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  email?: string;
  externalUrl?: string;
}

export interface ScrapeResult {
  total: number;
  saved: number;
  duplicates: number;
  platform: string;
  query: string;
}

export class CryptoAudienceScraper {

  /** Scrape Instagram profiles by hashtag search */
  async scrapeInstagramByHashtag(artistId: number, hashtags: string[], maxProfiles = 100): Promise<ScrapeResult> {
    if (!apifyClient) throw new Error('Apify not configured — missing APIFY_API_TOKEN');

    console.log(`🔍 [CryptoAudienceScraper] Scraping Instagram hashtags: ${hashtags.join(', ')}`);

    const run = await apifyClient.actor('apify/instagram-scraper').call({
      search: hashtags.join(' '),
      searchType: 'user',
      resultsLimit: maxProfiles,
      addParentData: false,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    return this.processInstagramResults(artistId, items as any[], hashtags.join(','), run.id);
  }

  /** Scrape followers of a specific Instagram crypto/music account */
  async scrapeInstagramFollowers(artistId: number, targetUsername: string, maxProfiles = 200): Promise<ScrapeResult> {
    if (!apifyClient) throw new Error('Apify not configured');

    console.log(`🔍 [CryptoAudienceScraper] Scraping followers of @${targetUsername}`);

    const run = await apifyClient.actor('apify/instagram-scraper').call({
      directUrls: [`https://www.instagram.com/${targetUsername}/`],
      resultsType: 'followers',
      resultsLimit: maxProfiles,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    return this.processInstagramResults(artistId, items as any[], `followers:${targetUsername}`, run.id);
  }

  /** Scrape Twitter/X profiles using keyword search */
  async scrapeTwitterByKeywords(artistId: number, keywords: string[], maxProfiles = 100): Promise<ScrapeResult> {
    if (!apifyClient) throw new Error('Apify not configured');

    console.log(`🔍 [CryptoAudienceScraper] Scraping Twitter for: ${keywords.join(', ')}`);

    // Using Twitter search actor
    const run = await apifyClient.actor('apify/twitter-scraper').call({
      searchTerms: keywords,
      searchMode: 'people',
      maxItems: maxProfiles,
      addUserInfo: true,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    let saved = 0, duplicates = 0;
    for (const item of items) {
      const profile = item as any;
      const username = profile.username || profile.screen_name || profile.user?.screen_name;
      if (!username) continue;

      const hash = dedupeHash('twitter', username);
      const bio = profile.description || profile.bio || '';
      const followers = profile.followers_count || profile.followersCount || 0;
      const tags = detectTags(bio);

      try {
        await db.insert(cryptoOutreachContacts).values({
          artistId,
          platform: 'twitter',
          platformUsername: username,
          platformUserId: profile.id_str || profile.userId || null,
          displayName: profile.name || profile.fullName || username,
          bio,
          profileUrl: `https://x.com/${username}`,
          profileImageUrl: profile.profile_image_url_https || profile.profileImageUrl || null,
          followerCount: followers,
          followingCount: profile.friends_count || profile.followingCount || 0,
          postsCount: profile.statuses_count || profile.tweetsCount || 0,
          tags,
          audienceType: detectAudienceType(followers, bio),
          relevanceScore: String(relevanceScore(tags, followers)),
          dedupeHash: hash,
          apifyActorId: 'apify/twitter-scraper',
          apifyRunId: run.id,
          sourceQuery: keywords.join(','),
        }).onConflictDoNothing();
        saved++;
      } catch (e: any) {
        if (e.message?.includes('duplicate') || e.code === '23505') duplicates++;
        else console.error(`⚠️ [CryptoAudienceScraper] Twitter save error:`, e.message);
      }
    }

    console.log(`✅ [CryptoAudienceScraper] Twitter: ${saved} saved, ${duplicates} dupes from ${items.length} results`);
    return { total: items.length, saved, duplicates, platform: 'twitter', query: keywords.join(',') };
  }

  /** Scrape TikTok users via keyword */
  async scrapeTikTokByKeywords(artistId: number, keywords: string[], maxProfiles = 50): Promise<ScrapeResult> {
    if (!apifyClient) throw new Error('Apify not configured');

    console.log(`🔍 [CryptoAudienceScraper] Scraping TikTok for: ${keywords.join(', ')}`);

    const run = await apifyClient.actor('clockworks/tiktok-scraper').call({
      searchQueries: keywords,
      resultsPerPage: maxProfiles,
      searchSection: 'users',
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    let saved = 0, duplicates = 0;
    for (const item of items) {
      const profile = item as any;
      const username = profile.uniqueId || profile.authorMeta?.name;
      if (!username) continue;

      const hash = dedupeHash('tiktok', username);
      const bio = profile.signature || profile.authorMeta?.signature || '';
      const followers = profile.fans || profile.authorMeta?.fans || 0;
      const tags = detectTags(bio);

      try {
        await db.insert(cryptoOutreachContacts).values({
          artistId,
          platform: 'tiktok',
          platformUsername: username,
          platformUserId: profile.id || null,
          displayName: profile.nickname || profile.authorMeta?.nickName || username,
          bio,
          profileUrl: `https://tiktok.com/@${username}`,
          profileImageUrl: profile.avatarThumb || null,
          followerCount: followers,
          followingCount: profile.following || 0,
          postsCount: profile.video || 0,
          tags,
          audienceType: detectAudienceType(followers, bio),
          relevanceScore: String(relevanceScore(tags, followers)),
          dedupeHash: hash,
          apifyActorId: 'clockworks/tiktok-scraper',
          apifyRunId: run.id,
          sourceQuery: keywords.join(','),
        }).onConflictDoNothing();
        saved++;
      } catch (e: any) {
        if (e.message?.includes('duplicate') || e.code === '23505') duplicates++;
      }
    }

    console.log(`✅ [CryptoAudienceScraper] TikTok: ${saved} saved, ${duplicates} dupes from ${items.length}`);
    return { total: items.length, saved, duplicates, platform: 'tiktok', query: keywords.join(',') };
  }

  /** Multi-platform scrape with smart keyword generation */
  async scrapeAudience(artistId: number, params: {
    platforms: string[];
    keywords?: string[];
    hashtags?: string[];
    targetAccounts?: string[];
    maxPerPlatform?: number;
  }): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    const max = params.maxPerPlatform || 100;

    // Build keywords from artist context if not provided
    let keywords = params.keywords || [];
    if (keywords.length === 0) {
      keywords = ['crypto music', 'nft music', 'web3 artist', 'music token', 'blockchain music'];
    }
    const hashtags = params.hashtags || keywords.map(k => k.replace(/\s+/g, ''));

    for (const platform of params.platforms) {
      try {
        switch (platform) {
          case 'instagram':
            if (params.targetAccounts?.length) {
              for (const account of params.targetAccounts) {
                results.push(await this.scrapeInstagramFollowers(artistId, account, max));
              }
            } else {
              results.push(await this.scrapeInstagramByHashtag(artistId, hashtags, max));
            }
            break;
          case 'twitter':
            results.push(await this.scrapeTwitterByKeywords(artistId, keywords, max));
            break;
          case 'tiktok':
            results.push(await this.scrapeTikTokByKeywords(artistId, keywords, max));
            break;
          default:
            console.warn(`⚠️ [CryptoAudienceScraper] Unsupported platform: ${platform}`);
        }
      } catch (e: any) {
        console.error(`❌ [CryptoAudienceScraper] ${platform} scrape failed:`, e.message);
        results.push({ total: 0, saved: 0, duplicates: 0, platform, query: keywords.join(',') });
      }
    }

    return results;
  }

  /** Get contacts for an artist with filters */
  async getContacts(artistId: number, filters?: {
    platform?: string;
    audienceType?: string;
    minFollowers?: number;
    maxFollowers?: number;
    tags?: string[];
    outreachStatus?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select().from(cryptoOutreachContacts)
      .where(eq(cryptoOutreachContacts.artistId, artistId))
      .$dynamic();

    // Apply filters via additional where clauses
    const conditions = [eq(cryptoOutreachContacts.artistId, artistId)];

    if (filters?.platform) {
      conditions.push(eq(cryptoOutreachContacts.platform, filters.platform));
    }
    if (filters?.audienceType) {
      conditions.push(eq(cryptoOutreachContacts.audienceType, filters.audienceType));
    }
    if (filters?.outreachStatus) {
      conditions.push(eq(cryptoOutreachContacts.outreachStatus, filters.outreachStatus));
    }

    return db.select()
      .from(cryptoOutreachContacts)
      .where(and(...conditions))
      .orderBy(sql`${cryptoOutreachContacts.relevanceScore} DESC`)
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
  }

  /** Get scraping stats for an artist */
  async getStats(artistId: number) {
    const [total] = await db.select({ count: sql<number>`count(*)` })
      .from(cryptoOutreachContacts)
      .where(eq(cryptoOutreachContacts.artistId, artistId));

    const byPlatform = await db.select({
      platform: cryptoOutreachContacts.platform,
      count: sql<number>`count(*)`,
    })
      .from(cryptoOutreachContacts)
      .where(eq(cryptoOutreachContacts.artistId, artistId))
      .groupBy(cryptoOutreachContacts.platform);

    const byStatus = await db.select({
      status: cryptoOutreachContacts.outreachStatus,
      count: sql<number>`count(*)`,
    })
      .from(cryptoOutreachContacts)
      .where(eq(cryptoOutreachContacts.artistId, artistId))
      .groupBy(cryptoOutreachContacts.outreachStatus);

    const byType = await db.select({
      type: cryptoOutreachContacts.audienceType,
      count: sql<number>`count(*)`,
    })
      .from(cryptoOutreachContacts)
      .where(eq(cryptoOutreachContacts.artistId, artistId))
      .groupBy(cryptoOutreachContacts.audienceType);

    return {
      totalContacts: Number(total?.count || 0),
      byPlatform: Object.fromEntries(byPlatform.map(r => [r.platform, Number(r.count)])),
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, Number(r.count)])),
      byAudienceType: Object.fromEntries(byType.map(r => [r.type, Number(r.count)])),
    };
  }

  // ── Private: Process Instagram Results ──

  private async processInstagramResults(
    artistId: number,
    items: any[],
    sourceQuery: string,
    runId: string,
  ): Promise<ScrapeResult> {
    let saved = 0, duplicates = 0;

    for (const item of items) {
      const profile: InstagramScrapedProfile = {
        username: item.username || item.ownerUsername,
        userId: item.id || item.ownerId,
        fullName: item.fullName,
        biography: item.biography || item.bio,
        profilePicUrl: item.profilePicUrl || item.profilePicUrlHd,
        followersCount: item.followersCount,
        followsCount: item.followsCount,
        postsCount: item.postsCount || item.mediaCount,
        email: item.businessEmail || item.publicEmail,
        externalUrl: item.externalUrl,
      };

      if (!profile.username) continue;
      const hash = dedupeHash('instagram', profile.username);
      const bio = profile.biography || '';
      const followers = profile.followersCount || 0;
      const tags = detectTags(bio);

      try {
        await db.insert(cryptoOutreachContacts).values({
          artistId,
          platform: 'instagram',
          platformUsername: profile.username,
          platformUserId: profile.userId || null,
          displayName: profile.fullName || profile.username,
          email: profile.email || null,
          bio,
          profileUrl: `https://instagram.com/${profile.username}`,
          profileImageUrl: profile.profilePicUrl || null,
          followerCount: followers,
          followingCount: profile.followsCount || 0,
          postsCount: profile.postsCount || 0,
          tags,
          audienceType: detectAudienceType(followers, bio),
          relevanceScore: String(relevanceScore(tags, followers)),
          dedupeHash: hash,
          apifyActorId: 'apify/instagram-scraper',
          apifyRunId: runId,
          sourceQuery,
        }).onConflictDoNothing();
        saved++;
      } catch (e: any) {
        if (e.message?.includes('duplicate') || e.code === '23505') duplicates++;
        else console.error(`⚠️ [CryptoAudienceScraper] IG save error:`, e.message);
      }
    }

    console.log(`✅ [CryptoAudienceScraper] Instagram: ${saved} saved, ${duplicates} dupes from ${items.length}`);
    return { total: items.length, saved, duplicates, platform: 'instagram', query: sourceQuery };
  }
}

// Singleton
let _scraper: CryptoAudienceScraper | null = null;
export function getCryptoAudienceScraper(): CryptoAudienceScraper {
  if (!_scraper) _scraper = new CryptoAudienceScraper();
  return _scraper;
}
