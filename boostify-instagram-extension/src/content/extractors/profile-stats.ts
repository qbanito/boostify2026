// Boostify Instagram Extension — Profile Stats Extractor
// Extracts follower count, following, posts count, bio, verified status from Instagram profile pages

import type { ExtractedProfileData } from '../../shared/types';

/**
 * Check if the current page is an Instagram profile page
 */
export function isProfilePage(): boolean {
  const path = window.location.pathname;
  // Profile pages: /username/ (not /p/, /reel/, /explore/, /direct/, /stories/)
  const nonProfilePaths = ['/p/', '/reel/', '/reels/', '/explore/', '/direct/', '/stories/', '/accounts/', '/nametag/', '/ar/'];
  if (nonProfilePaths.some(p => path.startsWith(p))) return false;
  // Must have at least one path segment
  const segments = path.split('/').filter(Boolean);
  return segments.length === 1;
}

/**
 * Extract profile data from the current Instagram profile page
 */
export function extractProfileData(): ExtractedProfileData | null {
  try {
    const username = extractUsername();
    if (!username) return null;

    return {
      username,
      displayName: extractDisplayName() || username,
      bio: extractBio(),
      profileUrl: window.location.href,
      profilePicUrl: extractProfilePic(),
      followers: extractFollowers(),
      following: extractFollowing(),
      postsCount: extractPostsCount(),
      isVerified: extractVerified(),
      isPrivate: extractIsPrivate(),
      externalUrl: extractExternalUrl(),
      category: extractCategory(),
    };
  } catch (error) {
    console.error('[Boostify IG] Profile extraction error:', error);
    return null;
  }
}

function extractUsername(): string | null {
  // From URL
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  if (pathSegments.length >= 1) return pathSegments[0];
  return null;
}

function extractDisplayName(): string {
  // Try the header's h2 or span with the display name
  const headerSection = document.querySelector('header section');
  if (headerSection) {
    const spans = headerSection.querySelectorAll('span');
    for (const span of spans) {
      if (span.textContent && !span.closest('a') && span.textContent.trim().length > 0) {
        const text = span.textContent.trim();
        // Skip numbers and links
        if (!/^\d/.test(text) && !text.startsWith('@') && text.length < 50) {
          return text;
        }
      }
    }
  }
  return '';
}

function extractBio(): string {
  // Bio is typically in a div within the header section
  const bioSection = document.querySelector('header section div > span');
  if (bioSection?.textContent) return bioSection.textContent.trim();

  // Alternative: look for the bio container
  const headerDivs = document.querySelectorAll('header section > div');
  for (const div of headerDivs) {
    const spans = div.querySelectorAll(':scope > span, :scope > div > span');
    for (const span of spans) {
      const text = span.textContent?.trim();
      if (text && text.length > 10 && text.length < 500 && !/^\d/.test(text)) {
        return text;
      }
    }
  }
  return '';
}

function extractProfilePic(): string {
  const img = document.querySelector('header img[alt*="profile" i], header img[data-testid="user-avatar"]') as HTMLImageElement;
  return img?.src || '';
}

function parseInstagramNumber(text: string): number {
  if (!text) return 0;
  const cleaned = text.trim().toLowerCase().replace(/,/g, '');
  
  if (cleaned.endsWith('k')) return Math.round(parseFloat(cleaned) * 1000);
  if (cleaned.endsWith('m')) return Math.round(parseFloat(cleaned) * 1000000);
  if (cleaned.endsWith('b')) return Math.round(parseFloat(cleaned) * 1000000000);
  
  const num = parseInt(cleaned.replace(/\D/g, ''));
  return isNaN(num) ? 0 : num;
}

function extractStatByLabel(label: string): number {
  // Instagram stats are in links or spans with text like "123 followers"
  const elements = document.querySelectorAll('header a, header li, header span, header button');
  for (const el of elements) {
    const text = el.textContent?.toLowerCase() || '';
    if (text.includes(label) || text.includes(label.replace('s', ''))) {
      // Find the number part
      const numberSpan = el.querySelector('span span, span');
      if (numberSpan?.textContent) {
        return parseInstagramNumber(numberSpan.textContent);
      }
      // Try extracting number from the text itself
      const match = text.match(/([\d,.]+[kmb]?)/i);
      if (match) return parseInstagramNumber(match[1]);
    }
  }
  return 0;
}

function extractFollowers(): number {
  return extractStatByLabel('followers') || extractStatByLabel('seguidores');
}

function extractFollowing(): number {
  return extractStatByLabel('following') || extractStatByLabel('seguidos');
}

function extractPostsCount(): number {
  return extractStatByLabel('posts') || extractStatByLabel('publicaciones');
}

function extractVerified(): boolean {
  // Verified badge is an svg with title="Verified"
  const badge = document.querySelector('header svg[aria-label="Verified"], header span[title="Verified"]');
  return !!badge;
}

function extractIsPrivate(): boolean {
  const privateText = document.querySelector('[role="main"]')?.textContent?.toLowerCase() || '';
  return privateText.includes('this account is private') || privateText.includes('esta cuenta es privada');
}

function extractExternalUrl(): string {
  const link = document.querySelector('header a[rel="me nofollow noopener noreferrer"], header a[target="_blank"]') as HTMLAnchorElement;
  return link?.href || '';
}

function extractCategory(): string {
  // Category appears below the name for business accounts
  const headerSection = document.querySelector('header section');
  if (headerSection) {
    const divs = headerSection.querySelectorAll('div');
    for (const div of divs) {
      const text = div.textContent?.trim() || '';
      // Common Instagram categories
      const categories = ['Musician', 'Artist', 'Music', 'Producer', 'DJ', 'Singer', 'Rapper', 'Band', 'Entertainment', 'Personal Blog', 'Public Figure'];
      for (const cat of categories) {
        if (text.toLowerCase().includes(cat.toLowerCase())) return cat;
      }
    }
  }
  return '';
}
