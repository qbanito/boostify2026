// Boostify YouTube Extension — Page Change Observer
// YouTube is a SPA, so we need MutationObserver to detect navigation

type PageType = 'home' | 'video' | 'channel' | 'search' | 'studio' | 'studio-video' | 'studio-content' | 'studio-analytics' | 'other';

interface PageInfo {
  url: string;
  pageType: PageType;
  videoId?: string;
  channelId?: string;
}

type PageChangeCallback = (pageInfo: PageInfo) => void;

/**
 * Observe YouTube SPA navigation and call the callback on page changes
 */
export function observePageChanges(callback: PageChangeCallback): () => void {
  let lastUrl = window.location.href;
  let lastPageInfo = getPageInfo(lastUrl);
  
  // Initial call
  callback(lastPageInfo);
  
  // Watch for URL changes (YouTube uses History API)
  const checkUrl = () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      lastPageInfo = getPageInfo(currentUrl);
      callback(lastPageInfo);
    }
  };
  
  // Use MutationObserver on the title (YouTube updates it on navigation)
  const titleObserver = new MutationObserver(checkUrl);
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver.observe(titleEl, { childList: true });
  }
  
  // Also use popstate and yt-navigate-finish events
  window.addEventListener('popstate', checkUrl);
  document.addEventListener('yt-navigate-finish', checkUrl);
  
  // Periodic check as fallback
  const interval = setInterval(checkUrl, 2000);
  
  // Return cleanup function
  return () => {
    titleObserver.disconnect();
    window.removeEventListener('popstate', checkUrl);
    document.removeEventListener('yt-navigate-finish', checkUrl);
    clearInterval(interval);
  };
}

/**
 * Determine the page type from a URL
 */
function getPageInfo(url: string): PageInfo {
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const host = urlObj.hostname;
  
  let pageType: PageType = 'other';
  let videoId: string | undefined;
  let channelId: string | undefined;
  
  if (host === 'studio.youtube.com') {
    if (path.includes('/video/')) {
      pageType = 'studio-video';
      videoId = path.match(/\/video\/([\w-]+)/)?.[1];
    } else if (path.includes('/videos') || path.includes('/content')) {
      pageType = 'studio-content';
    } else if (path.includes('/analytics')) {
      pageType = 'studio-analytics';
    } else {
      pageType = 'studio';
    }
  } else {
    // youtube.com
    if (path === '/' || path === '/feed/trending' || path === '/feed/subscriptions') {
      pageType = 'home';
    } else if (path === '/watch') {
      pageType = 'video';
      videoId = urlObj.searchParams.get('v') || undefined;
    } else if (path.startsWith('/@') || path.startsWith('/channel/') || path.startsWith('/c/')) {
      pageType = 'channel';
      channelId = path.match(/\/(channel|@|c)\/([\w.-]+)/)?.[2];
    } else if (path === '/results') {
      pageType = 'search';
    }
  }
  
  return { url, pageType, videoId, channelId };
}

/**
 * Wait for a specific element to appear in the DOM
 */
export function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    
    const observer = new MutationObserver((_, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}
