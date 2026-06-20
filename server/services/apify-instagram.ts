import { ApifyClient } from 'apify-client';

if (!process.env.APIFY_API_TOKEN && !process.env.APIFY_API_KEY) {
  console.warn('⚠️ APIFY_API_TOKEN not found. Apify Instagram features will not work.');
}

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || '',
});

export interface InstagramProfile {
  username: string;
  fullName: string;
  biography: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  profilePicUrl: string;
  isVerified: boolean;
  isPrivate: boolean;
  url: string;
}

export interface InstagramPost {
  id: string;
  caption: string;
  timestamp: string;
  likesCount: number;
  commentsCount: number;
  displayUrl: string;
  videoUrl?: string;
  type: 'image' | 'video' | 'carousel';
}

export interface InstagramInsights {
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  topPosts: InstagramPost[];
}

export class ApifyInstagramService {
  /**
   * Get Instagram profile data using apify/instagram-scraper
   */
  async getProfile(username: string): Promise<InstagramProfile> {
    try {
      console.log(`📱 Fetching Instagram profile: ${username}`);
      
      const run = await apifyClient.actor('apify/instagram-scraper').call({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: 'profiles',
        resultsLimit: 1,
      });

      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      
      if (!items || items.length === 0) {
        throw new Error(`Profile not found: ${username}`);
      }

      const profile = items[0];
      
      return {
        username: profile.username || username,
        fullName: profile.fullName || profile.name || username,
        biography: profile.biography || profile.bio || '',
        followersCount: profile.followersCount || 0,
        followingCount: profile.followsCount || profile.following || 0,
        postsCount: profile.postsCount || profile.mediaCount || 0,
        profilePicUrl: profile.profilePicUrl || profile.profilePic || '',
        isVerified: profile.verified || profile.isVerified || false,
        isPrivate: profile.private || profile.isPrivate || false,
        url: profile.url || `https://instagram.com/${username}`,
      };
    } catch (error) {
      console.error('❌ Error fetching Instagram profile:', error);
      throw error;
    }
  }

  /**
   * Get Instagram posts from a profile using apify/instagram-scraper
   */
  async getPosts(username: string, limit: number = 12): Promise<InstagramPost[]> {
    try {
      console.log(`📸 Fetching Instagram posts for: ${username}`);
      
      const run = await apifyClient.actor('apify/instagram-scraper').call({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: 'posts',
        resultsLimit: limit,
      });

      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      
      if (!items || items.length === 0) {
        return [];
      }

      return items.map((post: any) => ({
        id: post.id || post.shortCode || post.postId || String(Math.random()),
        caption: post.caption || post.text || '',
        timestamp: post.timestamp || post.takenAt || new Date().toISOString(),
        likesCount: post.likesCount || post.likes || 0,
        commentsCount: post.commentsCount || post.comments || 0,
        displayUrl: post.displayUrl || post.imageUrl || post.url || '',
        videoUrl: post.videoUrl || post.videoPlayUrl,
        type: post.type === 'Video' ? 'video' : post.type === 'Sidecar' ? 'carousel' : 'image',
      }));
    } catch (error) {
      console.error('❌ Error fetching Instagram posts:', error);
      throw error;
    }
  }

  /**
   * Search for Instagram profiles by keyword/hashtag using apify/instagram-scraper
   */
  async searchProfiles(keyword: string, limit: number = 20): Promise<InstagramProfile[]> {
    try {
      console.log(`🔍 Searching Instagram profiles by hashtag: ${keyword}`);
      
      const run = await apifyClient.actor('apify/instagram-scraper').call({
        hashtags: [keyword.replace('#', '')],
        resultsType: 'posts',
        resultsLimit: limit * 3, // Get more posts to extract unique users
      });

      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      
      if (!items || items.length === 0) {
        return [];
      }

      // Extract unique usernames from posts
      const usernames = [...new Set(items.map((item: any) => 
        item.ownerUsername || item.username
      ))].filter(Boolean).slice(0, limit);

      console.log(`Found ${usernames.length} unique users from hashtag #${keyword}`);

      // Fetch profiles for each username (with error handling)
      const profiles = await Promise.all(
        usernames.map((username) => 
          this.getProfile(username as string)
            .catch((err) => {
              console.warn(`Failed to fetch profile for ${username}:`, err.message);
              return null;
            })
        )
      );

      return profiles.filter((p): p is InstagramProfile => p !== null);
    } catch (error) {
      console.error('❌ Error searching Instagram profiles:', error);
      throw error;
    }
  }

  /**
   * Get insights and analytics for a profile
   */
  async getInsights(username: string): Promise<InstagramInsights> {
    try {
      const posts = await this.getPosts(username, 50);

      if (posts.length === 0) {
        return {
          avgLikes: 0,
          avgComments: 0,
          engagementRate: 0,
          topPosts: [],
        };
      }

      const totalLikes = posts.reduce((sum, post) => sum + post.likesCount, 0);
      const totalComments = posts.reduce((sum, post) => sum + post.commentsCount, 0);
      const avgLikes = totalLikes / posts.length;
      const avgComments = totalComments / posts.length;

      // Get profile to calculate engagement rate
      const profile = await this.getProfile(username);
      const avgEngagement = (avgLikes + avgComments) / 2;
      const engagementRate = profile.followersCount > 0 
        ? (avgEngagement / profile.followersCount) * 100 
        : 0;

      // Get top 10 posts by likes
      const topPosts = [...posts]
        .sort((a, b) => b.likesCount - a.likesCount)
        .slice(0, 10);

      return {
        avgLikes,
        avgComments,
        engagementRate,
        topPosts,
      };
    } catch (error) {
      console.error('Error fetching Instagram insights:', error);
      throw error;
    }
  }

  /**
   * Search influencers by niche with engagement metrics
   */
  async searchInfluencers(niche: string, minFollowers: number = 1000, limit: number = 20) {
    try {
      const profiles = await this.searchProfiles(niche, limit * 2);

      // Filter by follower count and get insights
      const influencersWithMetrics = await Promise.all(
        profiles
          .filter(p => p.followersCount >= minFollowers)
          .slice(0, limit)
          .map(async (profile) => {
            try {
              const insights = await this.getInsights(profile.username);
              return {
                ...profile,
                insights,
              };
            } catch (error) {
              return {
                ...profile,
                insights: {
                  avgLikes: 0,
                  avgComments: 0,
                  engagementRate: 0,
                  topPosts: [],
                },
              };
            }
          })
      );

      // Sort by engagement rate
      return influencersWithMetrics.sort((a, b) => 
        b.insights.engagementRate - a.insights.engagementRate
      );
    } catch (error) {
      console.error('Error searching influencers:', error);
      throw error;
    }
  }
}

export const apifyInstagram = new ApifyInstagramService();
