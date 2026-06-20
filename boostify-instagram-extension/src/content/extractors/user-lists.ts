// Boostify Instagram Extension — User List Extractors
// Extract followers, following, hashtag users, commenters, likers, location users
// With profile enrichment: visit each profile to get email, phone, bio, website

export interface ExtractedUser {
  username: string;
  displayName: string;
  profilePicUrl: string;
  isVerified: boolean;
  isPrivate: boolean;
  bio?: string;
  email?: string;
  phone?: string;
  website?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  category?: string;
  isBusiness?: boolean;
  source: ExtractType;
  sourceQuery?: string;
  extractedAt: string;
  enriched?: boolean;
}

export type ExtractType = 'followers' | 'following' | 'hashtag' | 'location' | 'commenters' | 'likers' | 'custom';

// ============================================================
// Ban Protection System — Anti-detection rate limiter
// ============================================================

export interface BanProtectionConfig {
  delayBetweenProfilesMs: number;  // delay between visiting profiles
  maxProfilesPerSession: number;   // max profiles before cooldown
  cooldownMinutes: number;         // cooldown after session limit
  jitterPercent: number;           // randomize delay ±%
  pauseOnWarning: boolean;         // pause if IG shows warning
}

const DEFAULT_BAN_PROTECTION: BanProtectionConfig = {
  delayBetweenProfilesMs: 3000,
  maxProfilesPerSession: 50,
  cooldownMinutes: 5,
  jitterPercent: 30,
  pauseOnWarning: true,
};

let banProtection: BanProtectionConfig = { ...DEFAULT_BAN_PROTECTION };
let sessionProfileCount = 0;
let sessionStartTime = Date.now();
let isPaused = false;
let isCancelled = false;

export function setBanProtection(config: Partial<BanProtectionConfig>) {
  banProtection = { ...banProtection, ...config };
}

export function cancelExtraction() {
  isCancelled = true;
}

export function resetExtraction() {
  isCancelled = false;
  isPaused = false;
  sessionProfileCount = 0;
  sessionStartTime = Date.now();
}

async function banSafeDelay(): Promise<void> {
  if (isCancelled) throw new Error('CANCELLED');

  // Check session limit
  sessionProfileCount++;
  if (sessionProfileCount >= banProtection.maxProfilesPerSession) {
    console.log(`[Boostify] Session limit reached (${sessionProfileCount}). Cooling down ${banProtection.cooldownMinutes}min...`);
    await sleep(banProtection.cooldownMinutes * 60 * 1000);
    sessionProfileCount = 0;
    sessionStartTime = Date.now();
  }

  // Random jitter delay
  const jitter = banProtection.delayBetweenProfilesMs * (banProtection.jitterPercent / 100);
  const delay = banProtection.delayBetweenProfilesMs + (Math.random() * 2 - 1) * jitter;
  await sleep(Math.max(1000, delay)); // Never less than 1s
}

function detectBanWarning(): boolean {
  // Check for Instagram's rate limit / suspicious activity signals
  const errorPages = document.querySelectorAll('[class*="error"], [class*="Error"]');
  for (const el of errorPages) {
    const text = el.textContent?.toLowerCase() || '';
    if (text.includes('try again later') || text.includes('action blocked') ||
        text.includes('suspicious activity') || text.includes('temporarily blocked') ||
        text.includes('inténtalo de nuevo') || text.includes('actividad sospechosa')) {
      return true;
    }
  }
  // Also check for login redirect
  if (window.location.pathname === '/accounts/login/') return true;
  return false;
}

// ============================================================
// Profile Enrichment — Visit a profile to extract detailed info
// ============================================================

export async function enrichProfile(
  user: ExtractedUser,
  onProgress?: (msg: string) => void
): Promise<ExtractedUser> {
  if (isCancelled) throw new Error('CANCELLED');
  
  const profileUrl = `https://www.instagram.com/${user.username}/`;
  
  try {
    // Navigate via fetch to avoid full page reload (using Instagram's JSON API)
    const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${user.username}`, {
      headers: {
        'X-IG-App-ID': '936619743392459', // Instagram's public web app ID
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
    });

    if (response.status === 429) {
      // Rate limited — pause
      console.warn('[Boostify] Rate limited by Instagram API. Cooling down...');
      onProgress?.('Rate limited — cooling down 2 min...');
      await sleep(120000);
      return user; // Return un-enriched
    }

    if (!response.ok) {
      return user; // Skip enrichment silently
    }

    const data = await response.json();
    const profileData = data?.data?.user;
    if (!profileData) return user;

    // Extract email and phone from bio text
    const bio = profileData.biography || '';
    const email = extractEmail(bio) || extractEmail(profileData.external_url || '');
    const phone = extractPhone(bio);

    return {
      ...user,
      displayName: profileData.full_name || user.displayName,
      bio: bio.substring(0, 500),
      email: email || undefined,
      phone: phone || undefined,
      website: profileData.external_url || profileData.bio_links?.[0]?.url || undefined,
      profilePicUrl: profileData.profile_pic_url_hd || profileData.profile_pic_url || user.profilePicUrl,
      followers: profileData.edge_followed_by?.count ?? user.followers,
      following: profileData.edge_follow?.count ?? user.following,
      postsCount: profileData.edge_owner_to_timeline_media?.count,
      isVerified: profileData.is_verified ?? user.isVerified,
      isPrivate: profileData.is_private ?? user.isPrivate,
      isBusiness: profileData.is_business_account || profileData.is_professional_account || false,
      category: profileData.category_name || profileData.business_category_name || user.category,
      enriched: true,
    };
  } catch (err: any) {
    if (err.message === 'CANCELLED') throw err;
    console.warn(`[Boostify] Failed to enrich ${user.username}:`, err.message);
    return user;
  }
}

/**
 * Enrich a batch of users with profile details (email, phone, bio, stats)
 * Respects ban protection: delays, session limits, warning detection
 */
export async function enrichProfiles(
  users: ExtractedUser[],
  onProgress?: (enriched: number, total: number, currentUser: string) => void
): Promise<ExtractedUser[]> {
  resetExtraction();
  const enriched: ExtractedUser[] = [];

  for (let i = 0; i < users.length; i++) {
    if (isCancelled) break;

    // Check for ban warnings
    if (banProtection.pauseOnWarning && detectBanWarning()) {
      console.warn('[Boostify] Ban warning detected! Pausing enrichment.');
      onProgress?.(enriched.length, users.length, '⚠️ Ban warning — pausing 5min');
      await sleep(300000); // 5 min pause
      if (detectBanWarning()) {
        console.error('[Boostify] Still blocked. Stopping enrichment.');
        break;
      }
    }

    onProgress?.(i, users.length, users[i].username);

    const enrichedUser = await enrichProfile(users[i], (msg) => {
      onProgress?.(i, users.length, msg);
    });
    enriched.push(enrichedUser);

    // Ban-safe delay between profiles
    if (i < users.length - 1) {
      await banSafeDelay();
    }
  }

  return enriched;
}

// Email regex — finds emails in bio text
function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

// Phone regex — finds phone numbers in bio text
function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{0,4}/);
  if (!match) return null;
  const cleaned = match[0].replace(/[^\d+]/g, '');
  return cleaned.length >= 7 ? match[0].trim() : null;
}

export type SortMode = 'recent' | 'rank';

// ============================================================
// Scroll-and-collect pattern for Instagram dialogs/lists
// ============================================================

async function scrollAndCollect(
  containerSelector: string,
  parseRow: (el: Element) => ExtractedUser | null,
  maxUsers: number,
  onProgress?: (count: number, total: number) => void
): Promise<ExtractedUser[]> {
  const users: Map<string, ExtractedUser> = new Map();
  let scrollAttempts = 0;
  const maxScrollAttempts = 200;
  let prevSize = 0;
  let staleCount = 0;

  const container = document.querySelector(containerSelector);
  if (!container) {
    // Try alternative selectors for Instagram dialogs
    const dialogs = document.querySelectorAll('[role="dialog"] div[style*="overflow"]');
    const scrollable = dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
    if (!scrollable) {
      console.warn('[Boostify Extract] No scrollable container found');
      return [];
    }
    return await scrollContainer(scrollable as HTMLElement, parseRow, maxUsers, onProgress);
  }

  return await scrollContainer(container as HTMLElement, parseRow, maxUsers, onProgress);
}

async function scrollContainer(
  container: HTMLElement,
  parseRow: (el: Element) => ExtractedUser | null,
  maxUsers: number,
  onProgress?: (count: number, total: number) => void
): Promise<ExtractedUser[]> {
  const users: Map<string, ExtractedUser> = new Map();
  let staleCount = 0;

  for (let i = 0; i < 500; i++) {
    // Parse all visible rows
    const rows = container.querySelectorAll('a[role="link"][href^="/"], div[role="button"] a[href^="/"]');
    for (const row of rows) {
      const parent = row.closest('li, div[class]') || row.parentElement;
      if (!parent) continue;
      const user = parseRow(parent);
      if (user && user.username && !users.has(user.username)) {
        users.set(user.username, user);
      }
    }

    onProgress?.(users.size, maxUsers);

    if (users.size >= maxUsers) break;

    // Scroll down
    const prevSize = users.size;
    container.scrollTop = container.scrollHeight;
    await sleep(800 + Math.random() * 400);

    // Check if we got new users
    if (users.size === prevSize) {
      staleCount++;
      if (staleCount >= 5) break; // No more users to load
    } else {
      staleCount = 0;
    }
  }

  return Array.from(users.values());
}

// ============================================================
// Parse a single user row from Instagram's list
// ============================================================

function parseUserRow(el: Element, source: ExtractType, sourceQuery?: string): ExtractedUser | null {
  try {
    const link = el.querySelector('a[href^="/"]') as HTMLAnchorElement;
    if (!link) return null;

    const href = link.getAttribute('href') || '';
    const username = href.replace(/\//g, '').trim();
    if (!username || username.includes('/') || username.length > 30) return null;

    // Display name — usually in a span inside or next to the link
    const nameSpan = el.querySelector('span[dir="auto"] span, span[class*="x1lliihq"]');
    const displayName = nameSpan?.textContent?.trim() || username;

    // Profile pic
    const img = el.querySelector('img') as HTMLImageElement;
    const profilePicUrl = img?.src || '';

    // Verified badge
    const verified = !!el.querySelector('svg[aria-label="Verified"], [title="Verified"]');

    return {
      username,
      displayName,
      profilePicUrl,
      isVerified: verified,
      isPrivate: false,
      source,
      sourceQuery,
      extractedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ============================================================
// EXTRACT: Followers list
// ============================================================

export async function extractFollowers(
  maxUsers = 1000,
  onProgress?: (count: number, total: number) => void
): Promise<ExtractedUser[]> {
  // Wait for Instagram to fully render
  await waitForInstagramReady();

  // Wait for the followers link to appear (Instagram SPA loads header late)
  const followersLink = await waitForElement(
    () => findStatLink('followers', 'seguidores'),
    10000
  );
  if (!followersLink) throw new Error('Followers link not found. Make sure you are on a profile page.');

  followersLink.click();
  await sleep(2500);

  // Wait for the dialog to open
  const dialog = await waitForElement(
    () => document.querySelector('[role="dialog"]') as HTMLElement,
    8000
  );
  if (!dialog) throw new Error('Followers dialog did not open. The account may be private.');

  const users = await extractFromDialog('followers', undefined, maxUsers, onProgress);

  closeDialog();
  return users;
}

// ============================================================
// EXTRACT: Following list
// ============================================================

export async function extractFollowing(
  maxUsers = 1000,
  onProgress?: (count: number, total: number) => void
): Promise<ExtractedUser[]> {
  await waitForInstagramReady();

  const followingLink = await waitForElement(
    () => findStatLink('following', 'seguidos', 'seguindo'),
    10000
  );
  if (!followingLink) throw new Error('Following link not found. Make sure you are on a profile page.');

  followingLink.click();
  await sleep(2500);

  const dialog = await waitForElement(
    () => document.querySelector('[role="dialog"]') as HTMLElement,
    8000
  );
  if (!dialog) throw new Error('Following dialog did not open. The account may be private.');

  const users = await extractFromDialog('following', undefined, maxUsers, onProgress);

  closeDialog();
  return users;
}

// ============================================================
// EXTRACT: Hashtag page users
// ============================================================

export async function extractHashtagUsers(
  hashtag: string,
  sortMode: SortMode = 'recent',
  maxUsers = 500,
  onProgress?: (count: number, total: number) => void
): Promise<ExtractedUser[]> {
  const cleanTag = hashtag.replace('#', '').trim().toLowerCase();
  if (!window.location.pathname.includes(`/tags/${cleanTag}`) &&
      !window.location.pathname.includes(`/explore/tags/${cleanTag}`)) {
    window.location.href = `https://www.instagram.com/explore/tags/${cleanTag}/`;
    await sleep(4000);
  }

  // Wait for page to render
  await waitForInstagramReady();

  // Select sort mode (Recent or Top)
  if (sortMode === 'recent') {
    const recentTab = Array.from(document.querySelectorAll('a, span, div[role="tab"]'))
      .find(el => /recent/i.test(el.textContent || ''));
    if (recentTab) (recentTab as HTMLElement).click();
    await sleep(1500);
  }

  // Wait for post grid to appear
  await waitForElement(
    () => document.querySelector('a[href*="/p/"], a[href*="/reel/"]') as HTMLElement,
    10000
  );

  // Extract users from post grid — get post links, open each and extract the author
  const users: Map<string, ExtractedUser> = new Map();
  const postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');

  for (const link of postLinks) {
    if (users.size >= maxUsers) break;

    (link as HTMLElement).click();
    await sleep(1500);

    // Extract author from the opened post
    const authorLink = document.querySelector('article header a[href^="/"]') as HTMLAnchorElement;
    if (authorLink) {
      const username = (authorLink.getAttribute('href') || '').replace(/\//g, '');
      if (username && !users.has(username)) {
        const img = document.querySelector('article header img') as HTMLImageElement;
        users.set(username, {
          username,
          displayName: authorLink.textContent?.trim() || username,
          profilePicUrl: img?.src || '',
          isVerified: !!document.querySelector('article header svg[aria-label="Verified"]'),
          isPrivate: false,
          source: 'hashtag',
          sourceQuery: `#${cleanTag}`,
          extractedAt: new Date().toISOString(),
        });
      }
    }

    onProgress?.(users.size, maxUsers);

    // Close the post modal
    const closeBtn = document.querySelector('svg[aria-label="Close"], button[aria-label="Close"]');
    if (closeBtn) (closeBtn as HTMLElement).click();
    await sleep(500);
  }

  return Array.from(users.values());
}

// ============================================================
// EXTRACT: Post likers
// ============================================================

export async function extractLikers(
  postUrl?: string,
  maxUsers = 500,
  onProgress?: (count: number, total: number) => void
): Promise<ExtractedUser[]> {
  if (postUrl && !window.location.href.includes(postUrl)) {
    window.location.href = postUrl;
    await sleep(4000);
  }

  await waitForInstagramReady();

  // Click the "liked by" link to open dialog
  const likedBy = await waitForElement(
    () => {
      // Try direct liked_by link
      const directLink = document.querySelector('a[href*="liked_by"]') as HTMLElement;
      if (directLink) return directLink;
      // Try clicking the likes count text
      const likesSection = Array.from(document.querySelectorAll('article section span, article section a, article a'))
        .find(el => /like|me gusta/i.test(el.textContent || '') && /\d/.test(el.textContent || ''));
      return likesSection as HTMLElement || null;
    },
    10000
  );

  if (!likedBy) throw new Error('Could not find likes section. Make sure you are on a post page.');

  likedBy.click();
  await sleep(2500);

  // Wait for the dialog
  const dialog = await waitForElement(
    () => document.querySelector('[role="dialog"]') as HTMLElement,
    8000
  );
  if (!dialog) throw new Error('Likers dialog did not open.');

  const users = await extractFromDialog('likers', undefined, maxUsers, onProgress);
  closeDialog();
  return users;
}

// ============================================================
// EXTRACT: Post commenters
// ============================================================

export async function extractCommenters(
  postUrl?: string,
  maxUsers = 500,
  onProgress?: (count: number, total: number) => void
): Promise<ExtractedUser[]> {
  if (postUrl && !window.location.href.includes(postUrl)) {
    window.location.href = postUrl;
    await sleep(4000);
  }

  await waitForInstagramReady();

  // Wait for article to appear
  const article = await waitForElement(
    () => document.querySelector('article') as HTMLElement,
    10000
  );
  if (!article) throw new Error('No post content found. Make sure you are on a post page.');

  const users: Map<string, ExtractedUser> = new Map();

  // Expand all comments first
  for (let i = 0; i < 20; i++) {
    const loadMore = article.querySelector('button[class*="load"], span[class*="load"], li button');
    const viewAll = Array.from(article.querySelectorAll('span, li'))
      .find(el => /view all|ver todos|load more/i.test(el.textContent || ''));
    if (viewAll) {
      (viewAll as HTMLElement).click();
      await sleep(1500);
    } else if (loadMore) {
      (loadMore as HTMLElement).click();
      await sleep(1500);
    } else {
      break;
    }
  }

  // Parse comment authors
  const commentLinks = article.querySelectorAll('ul a[href^="/"], div[role="button"] a[href^="/"]');
  for (const link of commentLinks) {
    if (users.size >= maxUsers) break;
    const href = (link as HTMLAnchorElement).getAttribute('href') || '';
    const username = href.replace(/\//g, '').trim();
    if (username && !users.has(username) && username.length < 30 && !username.includes('/')) {
      const img = link.querySelector('img') as HTMLImageElement;
      users.set(username, {
        username,
        displayName: link.textContent?.trim() || username,
        profilePicUrl: img?.src || '',
        isVerified: !!link.closest('li, div')?.querySelector('svg[aria-label="Verified"]'),
        isPrivate: false,
        source: 'commenters',
        sourceQuery: window.location.href,
        extractedAt: new Date().toISOString(),
      });
    }
    onProgress?.(users.size, maxUsers);
  }

  return Array.from(users.values());
}

// ============================================================
// EXTRACT: Location page users
// ============================================================

export async function extractLocationUsers(
  locationUrl: string,
  maxUsers = 500,
  onProgress?: (count: number, total: number) => void
): Promise<ExtractedUser[]> {
  if (!window.location.href.includes(locationUrl)) {
    window.location.href = locationUrl.startsWith('http') ? locationUrl : `https://www.instagram.com/explore/locations/${locationUrl}/`;
    await sleep(4000);
  }

  await waitForInstagramReady();

  // Wait for post grid
  await waitForElement(
    () => document.querySelector('a[href*="/p/"], a[href*="/reel/"]') as HTMLElement,
    10000
  );

  // Same as hashtag — extract from post grid
  const users: Map<string, ExtractedUser> = new Map();
  const postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');

  for (const link of postLinks) {
    if (users.size >= maxUsers) break;

    (link as HTMLElement).click();
    await sleep(1500);

    const authorLink = document.querySelector('article header a[href^="/"]') as HTMLAnchorElement;
    if (authorLink) {
      const username = (authorLink.getAttribute('href') || '').replace(/\//g, '');
      if (username && !users.has(username)) {
        const img = document.querySelector('article header img') as HTMLImageElement;
        users.set(username, {
          username,
          displayName: authorLink.textContent?.trim() || username,
          profilePicUrl: img?.src || '',
          isVerified: !!document.querySelector('article header svg[aria-label="Verified"]'),
          isPrivate: false,
          source: 'location',
          sourceQuery: window.location.href,
          extractedAt: new Date().toISOString(),
        });
      }
    }

    onProgress?.(users.size, maxUsers);

    const closeBtn = document.querySelector('svg[aria-label="Close"], button[aria-label="Close"]');
    if (closeBtn) (closeBtn as HTMLElement).click();
    await sleep(500);
  }

  return Array.from(users.values());
}

// ============================================================
// Helpers
// ============================================================

function findStatLink(...labels: string[]): HTMLElement | null {
  const links = document.querySelectorAll('header a, header li, header span[role="link"], a[href*="/followers"], a[href*="/following"]');
  for (const link of links) {
    const text = link.textContent?.toLowerCase() || '';
    const href = (link as HTMLAnchorElement).getAttribute('href') || '';
    if (labels.some(l => text.includes(l) || href.includes(l))) return link as HTMLElement;
  }
  return null;
}

/**
 * Wait for a specific element to appear in the DOM (Instagram SPA loads slowly)
 */
async function waitForElement(
  finder: () => HTMLElement | null,
  timeout = 15000,
  interval = 500
): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = finder();
    if (el) return el;
    await sleep(interval);
  }
  return null;
}

/**
 * Wait for Instagram page to be fully rendered (main content visible)
 */
async function waitForInstagramReady(timeout = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hasMain = document.querySelector('main, [role="main"], article, header section');
    if (hasMain) return true;
    await sleep(500);
  }
  return false;
}

async function extractFromDialog(
  source: ExtractType,
  sourceQuery: string | undefined,
  maxUsers: number,
  onProgress?: (count: number, total: number) => void
): Promise<ExtractedUser[]> {
  // Wait for the dialog to have content
  await sleep(1000);

  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return [];

  // Find the scrollable container — try multiple strategies
  let scrollContainer: HTMLElement | null = null;

  // Strategy 1: Find div with overflow-y auto/scroll inside dialog
  const allDivs = dialog.querySelectorAll('div');
  for (const div of allDivs) {
    const style = window.getComputedStyle(div);
    const hasOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll';
    const hasLinks = div.querySelectorAll('a[href^="/"]').length > 2;
    if (hasOverflow && hasLinks) {
      scrollContainer = div as HTMLElement;
      break;
    }
  }

  // Strategy 2: Find div with explicit style overflow
  if (!scrollContainer) {
    const scrollables = dialog.querySelectorAll('div[style*="overflow"], div[class*="scroll"]');
    for (const el of scrollables) {
      if (el.querySelectorAll('a[href^="/"]').length > 0) {
        scrollContainer = el as HTMLElement;
        break;
      }
    }
  }

  // Strategy 3: Use the dialog itself
  if (!scrollContainer) {
    scrollContainer = dialog as HTMLElement;
  }

  console.log('[Boostify Extract] Using scroll container:', scrollContainer.tagName, 'with', scrollContainer.querySelectorAll('a[href^="/"]').length, 'links');

  const users: Map<string, ExtractedUser> = new Map();
  let staleCount = 0;

  for (let i = 0; i < 500; i++) {
    // Parse all visible user rows
    const rows = scrollContainer.querySelectorAll('li, div[class] > div[class] > div[class]');
    for (const row of rows) {
      const user = parseUserRow(row, source, sourceQuery);
      if (user && !users.has(user.username)) {
        users.set(user.username, user);
      }
    }

    onProgress?.(users.size, maxUsers);
    if (users.size >= maxUsers) break;

    const prevSize = users.size;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await sleep(600 + Math.random() * 600);

    if (users.size === prevSize) {
      staleCount++;
      if (staleCount >= 8) break;
    } else {
      staleCount = 0;
    }
  }

  return Array.from(users.values());
}

function closeDialog() {
  const closeBtn = document.querySelector('[role="dialog"] button svg[aria-label="Close"], [role="dialog"] [aria-label="Close"]');
  if (closeBtn) {
    const btn = closeBtn.closest('button') || closeBtn;
    (btn as HTMLElement).click();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
