/**
 * Artist Enrichment — Data Collector
 * Gathers data from multiple sources: Spotify, Instagram, YouTube, Google Search
 * Uses progressive enrichment: cheap/free sources first, expensive ones only if needed
 */

import { ApifyClient } from 'apify-client';
import { searchArtist, getArtistStats } from '../artist-intelligence';

// ─── Types ──────────────────────────────────────────────────────

export interface SpotifyData {
  id: string;
  name: string;
  genres: string[];
  followers: number;
  popularity: number;
  imageUrl?: string;
  topTracks?: Array<{ name: string; popularity: number }>;
}

export interface InstagramData {
  username: string;
  fullName: string;
  biography: string;
  followersCount: number;
  postsCount: number;
  profilePicUrl: string;
  isVerified: boolean;
  engagementRate?: number;
  topPosts?: Array<{ displayUrl: string; likesCount: number; caption: string }>;
}

export interface YouTubeData {
  channelId: string;
  channelName: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  thumbnailUrl?: string;
}

export interface GoogleResult {
  title: string;
  url: string;
  description: string;
}

export interface WebsiteData {
  url: string;
  title: string;
  bio?: string;
  socialLinks?: Record<string, string>;
  photos?: string[];
}

export interface CollectedArtistData {
  spotify?: SpotifyData;
  instagram?: InstagramData;
  youtube?: YouTubeData;
  google?: GoogleResult[];
  website?: WebsiteData;
  sourcesChecked: string[];
  sourcesFound: string[];
  collectionDurationMs: number;
}

// ─── Apify Client ───────────────────────────────────────────────

function getApifyClient(): ApifyClient | null {
  const token = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY;
  if (!token) return null;
  return new ApifyClient({ token });
}

// ─── Spotify Search (FREE) ──────────────────────────────────────

export async function collectSpotifyData(artistName: string): Promise<SpotifyData | null> {
  try {
    const results = await searchArtist(artistName);
    if (!results || results.length === 0) return null;

    // Pick best match — first result with highest score
    const best = results[0];
    if (best.matchScore < 40) return null;

    // Get detailed stats
    const stats = await getArtistStats(best.id);

    const followersStat = stats.platforms.find(p => p.metric === 'followers');
    const popularityStat = stats.platforms.find(p => p.metric === 'popularity');

    return {
      id: best.id,
      name: best.name,
      genres: best.genres,
      followers: followersStat?.value || 0,
      popularity: popularityStat?.value || 0,
      imageUrl: best.imageUrl,
      topTracks: stats.platforms
        .filter(p => p.metric === 'avg_track_popularity')
        .map(p => ({ name: 'Top Track', popularity: p.value })),
    };
  } catch (err) {
    console.error('[Enrichment] Spotify search error:', err);
    return null;
  }
}

// ─── Google Search via Apify (~$0.002) ──────────────────────────

export async function collectGoogleData(artistName: string, genre?: string): Promise<{ results: GoogleResult[]; socialLinks: Record<string, string> }> {
  const client = getApifyClient();
  if (!client) return { results: [], socialLinks: {} };

  try {
    const query = genre
      ? `"${artistName}" ${genre} musician artist`
      : `"${artistName}" musician artist official`;

    const run = await client.actor('apify/google-search-scraper').call({
      queries: query,
      maxPagesPerQuery: 1,
      resultsPerPage: 15,
    }, { waitForFinishSecs: 60 });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items?.length) return { results: [], socialLinks: {} };

    const results: GoogleResult[] = [];
    const socialLinks: Record<string, string> = {};

    for (const item of items) {
      const organicResults = (item as any).organicResults || [];
      for (const result of organicResults) {
        const url = (result.url || '').toLowerCase();
        const title = result.title || '';
        const description = result.description || '';

        // Extract social media links
        if (url.includes('instagram.com/') && !url.includes('/p/') && !url.includes('/reel/')) {
          const match = url.match(/instagram\.com\/([^/?#]+)/);
          if (match && match[1] !== 'explore' && match[1] !== 'accounts') {
            socialLinks.instagram = match[1];
          }
        } else if (url.includes('youtube.com/') && (url.includes('/channel/') || url.includes('/@') || url.includes('/c/'))) {
          socialLinks.youtube = result.url;
        } else if (url.includes('open.spotify.com/artist/')) {
          const match = url.match(/artist\/([a-zA-Z0-9]+)/);
          if (match) socialLinks.spotify = match[1];
        } else if (url.includes('tiktok.com/@')) {
          const match = url.match(/tiktok\.com\/@([^/?#]+)/);
          if (match) socialLinks.tiktok = match[1];
        } else if (url.includes('facebook.com/')) {
          const match = url.match(/facebook\.com\/([^/?#]+)/);
          if (match && !['watch', 'groups', 'events', 'pages'].includes(match[1])) {
            socialLinks.facebook = result.url;
          }
        }

        // Store as general result (skip social media pages themselves)
        if (!url.includes('instagram.com') && !url.includes('facebook.com') && !url.includes('twitter.com')) {
          results.push({ title, url: result.url, description });
        }
      }
    }

    return { results: results.slice(0, 10), socialLinks };
  } catch (err) {
    console.error('[Enrichment] Google search error:', err);
    return { results: [], socialLinks: {} };
  }
}

// ─── Instagram via Apify (~$0.001) ──────────────────────────────

export async function collectInstagramData(username: string): Promise<InstagramData | null> {
  const client = getApifyClient();
  if (!client) return null;

  try {
    console.log(`[Enrichment] 📱 Scraping Instagram: @${username}`);

    const run = await client.actor('apify/instagram-scraper').call({
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: 'profiles',
      resultsLimit: 1,
    }, { waitForFinishSecs: 60 });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) return null;

    const profile = items[0] as any;

    // Also get top posts for photos
    let topPosts: InstagramData['topPosts'] = [];
    try {
      const postsRun = await client.actor('apify/instagram-scraper').call({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: 'posts',
        resultsLimit: 6,
      }, { waitForFinishSecs: 60 });

      const postsData = await client.dataset(postsRun.defaultDatasetId).listItems();
      topPosts = (postsData.items || []).slice(0, 6).map((p: any) => ({
        displayUrl: p.displayUrl || p.imageUrl || '',
        likesCount: p.likesCount || 0,
        caption: (p.caption || '').substring(0, 200),
      }));
    } catch {
      // Posts scraping is optional
    }

    const followersCount = profile.followersCount || 0;
    const postsCount = profile.postsCount || profile.mediaCount || 0;

    // Calculate engagement rate from top posts
    let engagementRate: number | undefined;
    if (topPosts.length > 0 && followersCount > 0) {
      const avgLikes = topPosts.reduce((s, p) => s + p.likesCount, 0) / topPosts.length;
      engagementRate = Math.round((avgLikes / followersCount) * 10000) / 100; // percentage
    }

    return {
      username: profile.username || username,
      fullName: profile.fullName || profile.name || username,
      biography: profile.biography || profile.bio || '',
      followersCount,
      postsCount,
      profilePicUrl: profile.profilePicUrl || profile.profilePic || '',
      isVerified: profile.verified || profile.isVerified || false,
      engagementRate,
      topPosts,
    };
  } catch (err) {
    console.error('[Enrichment] Instagram scrape error:', err);
    return null;
  }
}

// ─── YouTube via API (FREE, quota-based) ────────────────────────

export async function collectYouTubeData(artistName: string): Promise<YouTubeData | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    // Search for artist channel
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(artistName + ' official')}&type=channel&maxResults=3&key=${apiKey}`
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json() as any;

    const channels = searchData.items || [];
    if (channels.length === 0) return null;

    // Pick best match — first result
    const channelId = channels[0].snippet?.channelId || channels[0].id?.channelId;
    if (!channelId) return null;

    // Get channel statistics
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`
    );
    if (!statsRes.ok) return null;
    const statsData = await statsRes.json() as any;

    const channel = statsData.items?.[0];
    if (!channel) return null;

    return {
      channelId,
      channelName: channel.snippet?.title || artistName,
      subscribers: parseInt(channel.statistics?.subscriberCount || '0'),
      totalViews: parseInt(channel.statistics?.viewCount || '0'),
      videoCount: parseInt(channel.statistics?.videoCount || '0'),
      thumbnailUrl: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.default?.url,
    };
  } catch (err) {
    console.error('[Enrichment] YouTube search error:', err);
    return null;
  }
}

// ─── Master Collection Function ─────────────────────────────────

export async function collectArtistData(
  artistName: string,
  options: {
    email?: string;
    genre?: string;
    existingInstagram?: string;
    existingSpotify?: string;
    existingYouTube?: string;
  } = {}
): Promise<CollectedArtistData> {
  const startTime = Date.now();
  const sourcesChecked: string[] = [];
  const sourcesFound: string[] = [];
  const result: CollectedArtistData = {
    sourcesChecked: [],
    sourcesFound: [],
    collectionDurationMs: 0,
  };

  console.log(`[Enrichment] 🔍 Starting data collection for: ${artistName}`);

  // STEP 1: Spotify (FREE) — always check first
  sourcesChecked.push('spotify');
  if (options.existingSpotify) {
    try {
      const stats = await getArtistStats(options.existingSpotify);
      const followersStat = stats.platforms.find(p => p.metric === 'followers');
      const popularityStat = stats.platforms.find(p => p.metric === 'popularity');
      result.spotify = {
        id: options.existingSpotify,
        name: stats.name,
        genres: [],
        followers: followersStat?.value || 0,
        popularity: popularityStat?.value || 0,
      };
      sourcesFound.push('spotify');
    } catch { /* skip */ }
  } else {
    result.spotify = await collectSpotifyData(artistName) || undefined;
    if (result.spotify) sourcesFound.push('spotify');
  }

  // STEP 2: Google Search (~$0.002) — finds website, social links
  sourcesChecked.push('google');
  const genre = options.genre || result.spotify?.genres?.[0];
  const { results: googleResults, socialLinks } = await collectGoogleData(artistName, genre);
  if (googleResults.length > 0) {
    result.google = googleResults;
    sourcesFound.push('google');
  }

  // Extract website from Google results
  if (googleResults.length > 0) {
    const websiteResult = googleResults.find(r => {
      const url = r.url.toLowerCase();
      return !url.includes('wikipedia.org') &&
        !url.includes('discogs.com') &&
        !url.includes('allmusic.com') &&
        !url.includes('genius.com') &&
        (url.includes(artistName.toLowerCase().replace(/\s+/g, '')) ||
         url.includes('.com') || url.includes('.io') || url.includes('.music'));
    });
    if (websiteResult) {
      result.website = {
        url: websiteResult.url,
        title: websiteResult.title,
        bio: websiteResult.description,
        socialLinks,
      };
    }
  }

  // STEP 3: Instagram (~$0.001) — only if we found a handle
  sourcesChecked.push('instagram');
  const igHandle = options.existingInstagram || socialLinks.instagram;
  if (igHandle) {
    result.instagram = await collectInstagramData(igHandle) || undefined;
    if (result.instagram) sourcesFound.push('instagram');
  }

  // STEP 4: YouTube (FREE) — channel stats
  sourcesChecked.push('youtube');
  if (options.existingYouTube) {
    // Try to extract channel data from existing URL
    result.youtube = await collectYouTubeData(artistName) || undefined;
  } else {
    result.youtube = await collectYouTubeData(artistName) || undefined;
  }
  if (result.youtube) sourcesFound.push('youtube');

  result.sourcesChecked = sourcesChecked;
  result.sourcesFound = sourcesFound;
  result.collectionDurationMs = Date.now() - startTime;

  console.log(`[Enrichment] ✅ Collection done for ${artistName}: found ${sourcesFound.join(', ') || 'nothing'} (${result.collectionDurationMs}ms)`);

  return result;
}
