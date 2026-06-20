import axios from 'axios';

const INSTAGRAM_API_VERSION = 'v22.0';
const GRAPH_API_URL = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}`;

export interface InstagramProfile {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramInsight {
  name: string;
  period: string;
  values: Array<{ value: number }>;
  title?: string;
  description?: string;
}

export interface InstagramAccountInsights {
  impressions?: number;
  reach?: number;
  profile_views?: number;
  follower_count?: number;
  website_clicks?: number;
}

export class InstagramGraphAPI {
  private accessToken: string;
  private instagramUserId: string;

  constructor(accessToken: string, instagramUserId: string) {
    this.accessToken = accessToken;
    this.instagramUserId = instagramUserId;
  }

  /**
   * Get user profile information
   */
  async getProfile(): Promise<InstagramProfile> {
    const response = await axios.get(`${GRAPH_API_URL}/${this.instagramUserId}`, {
      params: {
        fields: 'id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count',
        access_token: this.accessToken
      }
    });
    return response.data;
  }

  /**
   * Get user media (posts)
   */
  async getMedia(limit: number = 25): Promise<InstagramMedia[]> {
    const response = await axios.get(`${GRAPH_API_URL}/${this.instagramUserId}/media`, {
      params: {
        fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
        limit,
        access_token: this.accessToken
      }
    });
    return response.data.data || [];
  }

  /**
   * Get insights for a specific media post
   */
  async getMediaInsights(mediaId: string): Promise<InstagramInsight[]> {
    const response = await axios.get(`${GRAPH_API_URL}/${mediaId}/insights`, {
      params: {
        metric: 'engagement,reach,saved,views',
        access_token: this.accessToken
      }
    });
    return response.data.data || [];
  }

  /**
   * Get account-level insights
   */
  async getAccountInsights(period: 'day' | 'week' | 'days_28' = 'day'): Promise<InstagramAccountInsights> {
    const response = await axios.get(`${GRAPH_API_URL}/${this.instagramUserId}/insights`, {
      params: {
        metric: 'impressions,reach,profile_views,follower_count,website_clicks',
        period,
        access_token: this.accessToken
      }
    });

    const data = response.data.data || [];
    const insights: InstagramAccountInsights = {};

    data.forEach((metric: InstagramInsight) => {
      const value = metric.values[0]?.value || 0;
      insights[metric.name as keyof InstagramAccountInsights] = value;
    });

    return insights;
  }

  /**
   * Get top performing posts
   */
  async getTopPosts(limit: number = 10): Promise<Array<InstagramMedia & { engagement: number; reach: number }>> {
    const media = await this.getMedia(50);
    const topPosts = [];

    for (const post of media.slice(0, limit)) {
      try {
        const insights = await this.getMediaInsights(post.id);
        const engagement = insights.find(i => i.name === 'engagement')?.values[0]?.value || 0;
        const reach = insights.find(i => i.name === 'reach')?.values[0]?.value || 0;

        topPosts.push({
          ...post,
          engagement,
          reach
        });
      } catch (error) {
        console.error(`Error fetching insights for post ${post.id}:`, error);
      }
    }

    return topPosts.sort((a, b) => b.engagement - a.engagement);
  }

  /**
   * Get analytics for a date range
   */
  async getAnalytics(days: number = 7): Promise<{
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    avgEngagement: number;
    topPosts: InstagramMedia[];
    insights: InstagramAccountInsights;
  }> {
    const media = await this.getMedia(50);
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - days);

    const recentPosts = media.filter(post => 
      new Date(post.timestamp) >= recentDate
    );

    const totalLikes = recentPosts.reduce((sum, post) => sum + (post.like_count || 0), 0);
    const totalComments = recentPosts.reduce((sum, post) => sum + (post.comments_count || 0), 0);
    const avgEngagement = recentPosts.length > 0 
      ? (totalLikes + totalComments) / recentPosts.length 
      : 0;

    const insights = await this.getAccountInsights(
      days <= 1 ? 'day' : days <= 7 ? 'week' : 'days_28'
    );

    const topPosts = await this.getTopPosts(5);

    return {
      totalPosts: recentPosts.length,
      totalLikes,
      totalComments,
      avgEngagement,
      topPosts,
      insights
    };
  }

  /**
   * Get content calendar - scheduled posts
   * Note: Instagram Graph API doesn't support scheduled posts directly
   * This returns recent posts that can be used as content calendar items
   */
  async getContentCalendar(): Promise<Array<{
    id: string;
    title: string;
    type: 'post' | 'story' | 'reel';
    date: string;
    status: 'published';
  }>> {
    const media = await this.getMedia(10);
    
    return media.map(post => ({
      id: post.id,
      title: post.caption?.substring(0, 50) || 'Untitled Post',
      type: post.media_type === 'VIDEO' ? 'reel' : 'post',
      date: post.timestamp,
      status: 'published' as const
    }));
  }

  /**
   * Get engagement statistics
   */
  async getEngagementStats(): Promise<{
    commentsToReply: number;
    pendingMessages: number;
    newMentions: number;
    activeFollowers: number;
  }> {
    const insights = await this.getAccountInsights('day');
    const media = await this.getMedia(10);
    
    const totalComments = media.reduce((sum, post) => sum + (post.comments_count || 0), 0);

    return {
      commentsToReply: Math.floor(totalComments * 0.3),
      pendingMessages: 0,
      newMentions: 0,
      activeFollowers: insights.follower_count || 0
    };
  }
}

/**
 * OAuth Helper Functions
 */

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string }> {
  const response = await axios.get(`${GRAPH_API_URL}/oauth/access_token`, {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code
    }
  });
  return response.data;
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const response = await axios.get(`${GRAPH_API_URL}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: shortLivedToken
    }
  });
  return response.data;
}

export async function getInstagramBusinessAccount(
  pageAccessToken: string
): Promise<{ instagram_business_account: { id: string } }[]> {
  const response = await axios.get(`${GRAPH_API_URL}/me/accounts`, {
    params: {
      access_token: pageAccessToken
    }
  });
  
  const pages = response.data.data || [];
  const pagesWithIG = [];

  for (const page of pages) {
    try {
      const pageData = await axios.get(`${GRAPH_API_URL}/${page.id}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: page.access_token
        }
      });

      if (pageData.data.instagram_business_account) {
        pagesWithIG.push({
          ...page,
          instagram_business_account: pageData.data.instagram_business_account
        });
      }
    } catch (error) {
      console.error(`Page ${page.id} doesn't have Instagram Business account`);
    }
  }

  return pagesWithIG;
}

export async function refreshLongLivedToken(
  currentToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  return exchangeForLongLivedToken(currentToken, clientId, clientSecret);
}
