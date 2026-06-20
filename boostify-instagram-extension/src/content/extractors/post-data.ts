// Boostify Instagram Extension — Post Data Extractor
// Extracts likes, comments, captions, hashtags from Instagram posts

import type { ExtractedPostData } from '../../shared/types';

/**
 * Extract data from visible posts on the profile grid
 */
export function extractPostsFromGrid(): ExtractedPostData[] {
  const posts: ExtractedPostData[] = [];

  try {
    // Instagram grid posts are in article elements or main content area
    const postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    
    for (const link of postLinks) {
      const href = (link as HTMLAnchorElement).href;
      const postId = extractPostIdFromUrl(href);
      if (!postId) continue;

      // Get image/video from the link
      const img = link.querySelector('img') as HTMLImageElement;
      const video = link.querySelector('video') as HTMLVideoElement;

      // Try to get engagement numbers from hover overlay
      const overlay = link.querySelector('[class*="overlay"], div[style*="opacity"]');
      let likes = 0, comments = 0;

      if (overlay) {
        const spans = overlay.querySelectorAll('span');
        spans.forEach((span, index) => {
          const num = parsePostNumber(span.textContent || '');
          if (index === 0) likes = num;
          if (index === 1) comments = num;
        });
      }

      const type = href.includes('/reel/') ? 'reel' as const : 
                   video ? 'video' as const : 'image' as const;

      posts.push({
        postId,
        caption: '',
        likes,
        comments,
        type,
        timestamp: '',
        imageUrl: img?.src || '',
        videoUrl: video?.src || '',
        hashtags: [],
      });
    }
  } catch (error) {
    console.error('[Boostify IG] Post grid extraction error:', error);
  }

  return posts;
}

/**
 * Extract data from a single post page (/p/xxx/)
 */
export function extractSinglePost(): ExtractedPostData | null {
  try {
    const path = window.location.pathname;
    const postId = extractPostIdFromUrl(path);
    if (!postId) return null;

    const caption = extractCaption();
    const likes = extractLikes();
    const comments = extractCommentCount();
    const hashtags = extractHashtags(caption);
    const timestamp = extractTimestamp();

    const video = document.querySelector('article video') as HTMLVideoElement;
    const img = document.querySelector('article img[style*="object-fit"]') as HTMLImageElement;

    // Detect carousel (multiple images)
    const carouselDots = document.querySelectorAll('article [class*="carousel"] div, article button[aria-label*="next"], article button[aria-label*="Next"]');
    const type = video ? 'video' as const :
                 carouselDots.length > 0 ? 'carousel' as const :
                 path.includes('/reel/') ? 'reel' as const : 'image' as const;

    return {
      postId,
      caption,
      likes,
      comments,
      type,
      timestamp,
      imageUrl: img?.src || '',
      videoUrl: video?.src || '',
      hashtags,
    };
  } catch (error) {
    console.error('[Boostify IG] Single post extraction error:', error);
    return null;
  }
}

function extractPostIdFromUrl(url: string): string | null {
  const match = url.match(/\/(p|reel)\/([\w-]+)/);
  return match ? match[2] : null;
}

function parsePostNumber(text: string): number {
  if (!text) return 0;
  const cleaned = text.trim().toLowerCase().replace(/,/g, '');
  if (cleaned.endsWith('k')) return Math.round(parseFloat(cleaned) * 1000);
  if (cleaned.endsWith('m')) return Math.round(parseFloat(cleaned) * 1000000);
  const num = parseInt(cleaned.replace(/\D/g, ''));
  return isNaN(num) ? 0 : num;
}

function extractCaption(): string {
  // Caption is in a span within the first comment (which is the post caption)
  const article = document.querySelector('article');
  if (!article) return '';

  // Look for the caption container
  const captionContainers = article.querySelectorAll('div > span, ul > div span, h1');
  for (const el of captionContainers) {
    const text = el.textContent?.trim() || '';
    if (text.length > 20 && text.length < 2500) {
      return text;
    }
  }
  return '';
}

function extractLikes(): number {
  const article = document.querySelector('article');
  if (!article) return 0;

  // "X likes" or "Liked by X and Y others"
  const likeElements = article.querySelectorAll('a[href*="liked_by"], span, button');
  for (const el of likeElements) {
    const text = el.textContent?.toLowerCase() || '';
    if (text.includes('like') || text.includes('me gusta')) {
      const match = text.match(/([\d,.]+[kmb]?)/i);
      if (match) return parsePostNumber(match[1]);
    }
  }
  return 0;
}

function extractCommentCount(): number {
  const article = document.querySelector('article');
  if (!article) return 0;

  // "View all X comments"
  const commentLinks = article.querySelectorAll('a, span, button');
  for (const el of commentLinks) {
    const text = el.textContent?.toLowerCase() || '';
    if ((text.includes('comment') || text.includes('comentario')) && /\d/.test(text)) {
      const match = text.match(/([\d,.]+[kmb]?)/i);
      if (match) return parsePostNumber(match[1]);
    }
  }
  return 0;
}

function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? [...new Set(matches.map(h => h.toLowerCase()))] : [];
}

function extractTimestamp(): string {
  // Look for time element
  const time = document.querySelector('article time');
  const datetime = time?.getAttribute('datetime');
  if (datetime) return datetime;

  // Fallback: look for relative time text
  const timeText = time?.textContent?.trim();
  if (timeText) return timeText;

  return new Date().toISOString();
}

/**
 * Check if current page is a post page
 */
export function isPostPage(): boolean {
  return /^\/(p|reel)\/[\w-]+/.test(window.location.pathname);
}
