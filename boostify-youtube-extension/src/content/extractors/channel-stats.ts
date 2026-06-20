// Boostify YouTube Extension — Channel Stats Extractor
// Extracts channel information from youtube.com pages

import type { ExtractedChannelData } from '../../shared/types';

/**
 * Extract channel data from the current YouTube page
 */
export function extractChannelData(): ExtractedChannelData | null {
  try {
    // Try to extract from channel page
    const channelHeader = document.querySelector('#channel-header, #channel-header-container, ytd-c4-tabbed-header-renderer');
    
    if (channelHeader) {
      return extractFromChannelPage(channelHeader);
    }
    
    // Try to extract from video page (sidebar channel info)
    const videoPage = document.querySelector('ytd-video-owner-renderer, #owner');
    if (videoPage) {
      return extractFromVideoPage(videoPage);
    }
    
    return null;
  } catch (error) {
    console.error('[Boostify] Error extracting channel data:', error);
    return null;
  }
}

function extractFromChannelPage(header: Element): ExtractedChannelData | null {
  const nameEl = header.querySelector('#channel-name yt-formatted-string, #text.ytd-channel-name');
  const channelName = nameEl?.textContent?.trim() || '';
  
  const subsEl = header.querySelector('#subscriber-count, #subscribers');
  const subscriberText = subsEl?.textContent?.trim() || '0';
  const subscribers = parseSubscriberCount(subscriberText);
  
  // Get channel ID from canonical URL
  const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  const channelUrl = canonicalLink?.href || window.location.href;
  const channelId = extractChannelId(channelUrl);
  
  // Get video count from tabs
  const videosTab = document.querySelector('yt-tab-shape[tab-title="Videos"], tp-yt-paper-tab:nth-child(2)');
  const videoCountText = videosTab?.textContent?.trim() || '';
  const videoCount = parseInt(videoCountText.replace(/\D/g, '')) || 0;
  
  // Get avatar
  const avatarEl = header.querySelector('#avatar img, yt-img-shadow img') as HTMLImageElement;
  const avatarUrl = avatarEl?.src || '';
  
  // Get banner
  const bannerEl = document.querySelector('#banner img, ytd-c4-tabbed-header-renderer [id="banner"] img') as HTMLImageElement;
  const bannerUrl = bannerEl?.src || '';
  
  return {
    channelId: channelId || '',
    channelName,
    channelUrl,
    subscribers,
    totalViews: 0, // Not visible on channel page directly
    videoCount,
    avatarUrl,
    bannerUrl,
  };
}

function extractFromVideoPage(owner: Element): ExtractedChannelData | null {
  const nameEl = owner.querySelector('#channel-name a, a.yt-formatted-string');
  const channelName = nameEl?.textContent?.trim() || '';
  const channelUrl = (nameEl as HTMLAnchorElement)?.href || '';
  const channelId = extractChannelId(channelUrl);
  
  const subsEl = owner.querySelector('#owner-sub-count, yt-formatted-string#owner-sub-count');
  const subscriberText = subsEl?.textContent?.trim() || '0';
  const subscribers = parseSubscriberCount(subscriberText);
  
  return {
    channelId: channelId || '',
    channelName,
    channelUrl,
    subscribers,
    totalViews: 0,
    videoCount: 0,
  };
}

/**
 * Extract channel ID from a YouTube URL
 */
function extractChannelId(url: string): string | null {
  // Format: /channel/UCXXXXXXX
  const channelMatch = url.match(/\/channel\/(UC[\w-]+)/);
  if (channelMatch) return channelMatch[1];
  
  // Format: /@handle
  const handleMatch = url.match(/\/@([\w.-]+)/);
  if (handleMatch) return `@${handleMatch[1]}`;
  
  // Format: /c/customname
  const customMatch = url.match(/\/c\/([\w.-]+)/);
  if (customMatch) return customMatch[1];
  
  return null;
}

/**
 * Parse subscriber count text like "1.23M subscribers" → 1230000
 */
function parseSubscriberCount(text: string): number {
  const cleaned = text.toLowerCase().replace(/subscribers?|suscriptores?/gi, '').trim();
  
  const multipliers: Record<string, number> = {
    'k': 1000,
    'm': 1000000,
    'b': 1000000000,
    'mil': 1000,
  };
  
  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.includes(suffix)) {
      const num = parseFloat(cleaned.replace(suffix, '').trim());
      return Math.round(num * multiplier);
    }
  }
  
  return parseInt(cleaned.replace(/\D/g, '')) || 0;
}

/**
 * Extract a list of video stats from the channel videos tab
 */
export function extractChannelVideos(): Array<{ videoId: string; title: string; views: number; publishedAt: string }> {
  const videos: Array<{ videoId: string; title: string; views: number; publishedAt: string }> = [];
  
  const videoRenderers = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer');
  
  videoRenderers.forEach((renderer) => {
    try {
      const titleEl = renderer.querySelector('#video-title, a#video-title');
      const title = titleEl?.textContent?.trim() || '';
      const href = (titleEl as HTMLAnchorElement)?.href || '';
      const videoId = href.match(/[?&]v=([\w-]+)/)?.[1] || '';
      
      const metaEl = renderer.querySelector('#metadata-line span, .inline-metadata-item');
      const viewsText = metaEl?.textContent?.trim() || '0';
      const views = parseViewCount(viewsText);
      
      const timeEl = renderer.querySelectorAll('#metadata-line span, .inline-metadata-item')[1];
      const publishedAt = timeEl?.textContent?.trim() || '';
      
      if (videoId && title) {
        videos.push({ videoId, title, views, publishedAt });
      }
    } catch {}
  });
  
  return videos.slice(0, 20); // Top 20
}

function parseViewCount(text: string): number {
  const cleaned = text.toLowerCase().replace(/views?|visualizaciones?/gi, '').trim();
  
  const multipliers: Record<string, number> = {
    'k': 1000,
    'm': 1000000,
    'b': 1000000000,
  };
  
  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.includes(suffix)) {
      const num = parseFloat(cleaned.replace(suffix, '').trim());
      return Math.round(num * multiplier);
    }
  }
  
  return parseInt(cleaned.replace(/\D/g, '')) || 0;
}
