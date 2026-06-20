// Boostify YouTube Extension — Video Data Extractor
// Extracts video information from the current YouTube video page

import type { ExtractedVideoData } from '../../shared/types';

/**
 * Extract data from the currently playing video page
 */
export function extractVideoData(): ExtractedVideoData | null {
  try {
    if (!window.location.pathname.includes('/watch')) return null;
    
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    if (!videoId) return null;
    
    // Title
    const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer yt-formatted-string');
    const title = titleEl?.textContent?.trim() || '';
    
    // Description
    const descEl = document.querySelector('#description-inner, ytd-text-inline-expander #plain-snippet-text, #snippet-text');
    const description = descEl?.textContent?.trim() || '';
    
    // View count
    const viewEl = document.querySelector('#count .ytd-video-view-count-renderer, ytd-video-view-count-renderer span');
    const viewsText = viewEl?.textContent?.trim() || '0';
    const views = parseInt(viewsText.replace(/\D/g, '')) || 0;
    
    // Likes
    const likeEl = document.querySelector('#top-level-buttons-computed ytd-toggle-button-renderer:first-child #text, like-button-view-model button .yt-spec-button-shape-next__button-text-content');
    const likesText = likeEl?.textContent?.trim() || '0';
    const likes = parseCompactNumber(likesText);
    
    // Comments count
    const commentsEl = document.querySelector('#count.ytd-comments-header-renderer yt-formatted-string span');
    const commentsText = commentsEl?.textContent?.trim() || '0';
    const comments = parseInt(commentsText.replace(/\D/g, '')) || 0;
    
    // Published date
    const dateEl = document.querySelector('#info-strings yt-formatted-string, .ytd-video-primary-info-renderer .date');
    const publishedAt = dateEl?.textContent?.trim() || '';
    
    // Duration from video player
    const durationEl = document.querySelector('.ytp-time-duration');
    const duration = durationEl?.textContent?.trim() || '';
    
    // Tags from meta tags
    const metaKeywords = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
    const tags = metaKeywords?.content?.split(',').map(t => t.trim()).filter(Boolean) || [];
    
    // Thumbnail
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    
    // Channel info
    const channelNameEl = document.querySelector('#owner #channel-name a, ytd-video-owner-renderer #channel-name a');
    const channelName = channelNameEl?.textContent?.trim() || '';
    const channelUrl = (channelNameEl as HTMLAnchorElement)?.href || '';
    const channelId = channelUrl.match(/\/(channel|@)([\w.-]+)/)?.[2] || '';
    
    return {
      videoId,
      title,
      description: description.substring(0, 500),
      views,
      likes,
      comments,
      publishedAt,
      duration,
      tags,
      thumbnailUrl,
      channelName,
      channelId,
    };
  } catch (error) {
    console.error('[Boostify] Error extracting video data:', error);
    return null;
  }
}

/**
 * Extract data from the video's comment section
 */
export function extractComments(limit = 20): Array<{ author: string; text: string; likes: number; isHearted: boolean }> {
  const comments: Array<{ author: string; text: string; likes: number; isHearted: boolean }> = [];
  
  const commentRenderers = document.querySelectorAll('ytd-comment-thread-renderer');
  
  commentRenderers.forEach((renderer) => {
    if (comments.length >= limit) return;
    
    try {
      const authorEl = renderer.querySelector('#author-text');
      const author = authorEl?.textContent?.trim() || '';
      
      const textEl = renderer.querySelector('#content-text');
      const text = textEl?.textContent?.trim() || '';
      
      const likesEl = renderer.querySelector('#vote-count-middle');
      const likesText = likesEl?.textContent?.trim() || '0';
      const likes = parseCompactNumber(likesText);
      
      const isHearted = !!renderer.querySelector('#creator-heart');
      
      if (author && text) {
        comments.push({ author, text: text.substring(0, 300), likes, isHearted });
      }
    } catch {}
  });
  
  return comments;
}

/**
 * Parse compact number format (1.2K, 5M, etc.)
 */
function parseCompactNumber(text: string): number {
  const cleaned = text.toLowerCase().trim();
  
  const multipliers: Record<string, number> = {
    'k': 1000,
    'm': 1000000,
    'b': 1000000000,
  };
  
  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.endsWith(suffix)) {
      const num = parseFloat(cleaned.replace(suffix, ''));
      return Math.round(num * multiplier);
    }
  }
  
  return parseInt(cleaned.replace(/\D/g, '')) || 0;
}
