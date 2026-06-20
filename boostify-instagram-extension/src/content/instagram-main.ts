// Boostify Instagram Extension — Main Content Script
// Injected into instagram.com/* pages

import { isProfilePage, extractProfileData } from './extractors/profile-stats';
import { isPostPage, extractSinglePost, extractPostsFromGrid } from './extractors/post-data';
import {
  extractFollowers, extractFollowing, extractHashtagUsers,
  extractLikers, extractCommenters, extractLocationUsers,
  enrichProfiles, setBanProtection, cancelExtraction as cancelEnrichExtraction, resetExtraction,
  type ExtractedUser, type BanProtectionConfig,
} from './extractors/user-lists';

// Reference for cancellation from message handler
const extractorModule = {
  cancelExtraction: cancelEnrichExtraction,
};
import type { ExtractType, SortMode } from '../shared/types';

console.log('[Boostify IG] Content script loaded on:', window.location.href);

// Current extraction state
let currentExtraction: { cancelled: boolean } | null = null;

// Detected logged-in Instagram user
let loggedInUser: { username: string; profilePic: string } | null = null;

// Known Instagram navigation paths that are NOT usernames
const IG_RESERVED_PATHS = new Set([
  'explore', 'reels', 'direct', 'accounts', 'p', 'stories', 'nametag',
  'about', 'legal', 'api', 'developer', 'static', 'graphql', 'web',
  'emails', 'session', 'settings', 'ar', 'challenge', 'lite', 'topics',
  'directory', 'accounts', 'privacy', 'safety', 'terms', 'hc', '',
]);

function isLikelyUsername(s: string): boolean {
  if (!s || s.length < 1 || s.length > 30) return false;
  if (IG_RESERVED_PATHS.has(s.toLowerCase())) return false;
  // Instagram usernames: letters, numbers, periods, underscores
  return /^[a-zA-Z0-9._]+$/.test(s);
}

/**
 * Detect the logged-in Instagram user using 10+ strategies.
 * Instagram frequently changes their DOM structure, so we try every possible signal.
 */
function detectLoggedInUser(): { username: string; profilePic: string } | null {
  try {
    console.log('[Boostify IG] Running user detection...');

    // ---- Strategy 1: ALL links in nav/sidebar — find the one with a profile pic ----
    const allLinks = document.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const a = link as HTMLAnchorElement;
      const href = a.pathname || '';
      const segments = href.split('/').filter(Boolean);
      if (segments.length !== 1) continue;
      if (!isLikelyUsername(segments[0])) continue;

      // Must have a small circular profile pic (not a navigation icon)
      const img = a.querySelector('img') as HTMLImageElement;
      if (img?.src && img.src.includes('cdninstagram.com')) {
        console.log('[Boostify IG] Strategy 1 (nav link with pic): @' + segments[0]);
        return { username: segments[0], profilePic: img.src };
      }
    }

    // ---- Strategy 2: aria-label on links ----
    const ariaLabels = ['Profile', 'Perfil', 'Profil', 'プロフィール', '프로필', 'Профиль'];
    for (const label of ariaLabels) {
      const el = document.querySelector(`a[aria-label="${label}"]`) as HTMLAnchorElement;
      if (el) {
        const segs = el.pathname?.split('/').filter(Boolean);
        if (segs?.length === 1 && isLikelyUsername(segs[0])) {
          const img = el.querySelector('img') as HTMLImageElement;
          console.log('[Boostify IG] Strategy 2 (aria-label): @' + segs[0]);
          return { username: segs[0], profilePic: img?.src || '' };
        }
      }
    }

    // ---- Strategy 3: span/div with "Profile" as text, inside a link ----
    const spans = document.querySelectorAll('span, div');
    for (const span of spans) {
      const text = span.textContent?.trim();
      if (text === 'Profile' || text === 'Perfil') {
        const parent = span.closest('a[href]') as HTMLAnchorElement;
        if (parent) {
          const segs = parent.pathname.split('/').filter(Boolean);
          if (segs.length === 1 && isLikelyUsername(segs[0])) {
            const img = parent.querySelector('img') as HTMLImageElement;
            console.log('[Boostify IG] Strategy 3 (Profile text): @' + segs[0]);
            return { username: segs[0], profilePic: img?.src || '' };
          }
        }
      }
    }

    // ---- Strategy 4: The last link in nav that has a single-segment path and an img ----
    const navLinks = document.querySelectorAll('nav a[href], [role="navigation"] a[href], [role="banner"] a[href]');
    const candidates: { username: string; profilePic: string }[] = [];
    for (const link of navLinks) {
      const a = link as HTMLAnchorElement;
      const segs = a.pathname.split('/').filter(Boolean);
      if (segs.length === 1 && isLikelyUsername(segs[0])) {
        const img = a.querySelector('img') as HTMLImageElement;
        candidates.push({ username: segs[0], profilePic: img?.src || '' });
      }
    }
    // The profile link is typically the LAST one in the nav
    if (candidates.length > 0) {
      const pick = candidates[candidates.length - 1];
      console.log('[Boostify IG] Strategy 4 (last nav link): @' + pick.username);
      return pick;
    }

    // ---- Strategy 5: Find img elements on cdninstagram.com inside links with single-segment paths ----
    const igImages = document.querySelectorAll('img[src*="cdninstagram.com"]');
    for (const img of igImages) {
      const parent = (img as HTMLElement).closest('a[href]') as HTMLAnchorElement;
      if (!parent) continue;
      const segs = parent.pathname.split('/').filter(Boolean);
      if (segs.length === 1 && isLikelyUsername(segs[0])) {
        console.log('[Boostify IG] Strategy 5 (cdninstagram img in link): @' + segs[0]);
        return { username: segs[0], profilePic: (img as HTMLImageElement).src };
      }
    }

    // ---- Strategy 6: Find alt text containing username pattern on images ----
    const allImgs = document.querySelectorAll('img[alt]');
    for (const img of allImgs) {
      const alt = (img as HTMLImageElement).alt || '';
      const altMatch = alt.match(/@([a-zA-Z0-9._]+)/);
      if (altMatch && isLikelyUsername(altMatch[1])) {
        // Only if this image is in a navigation area
        if ((img as HTMLElement).closest('nav, [role="navigation"], [role="banner"]')) {
          console.log('[Boostify IG] Strategy 6 (alt text): @' + altMatch[1]);
          return { username: altMatch[1], profilePic: (img as HTMLImageElement).src || '' };
        }
      }
    }

    // ---- Strategy 7: Instagram cookie ----
    const cookies = document.cookie;
    const dsUserMatch = cookies.match(/ds_user_id=(\d+)/);
    const dsUserNameMatch = cookies.match(/ds_user=([^;]+)/);
    if (dsUserNameMatch) {
      console.log('[Boostify IG] Strategy 7 (ds_user cookie): @' + dsUserNameMatch[1]);
      return { username: dsUserNameMatch[1], profilePic: '' };
    }

    // ---- Strategy 8: localStorage ----
    try {
      const viewerId = localStorage.getItem('ig-viewerId');
      if (viewerId) {
        // We have the ID but need the username — check if any link matches
        console.log('[Boostify IG] Strategy 8: Found viewer ID:', viewerId, '(need username from other methods)');
      }
    } catch {}

    // ---- Strategy 9: Any single-segment link in the page that's not reserved ----
    // More aggressive — find links that go to /{username}/ without requiring an img
    for (const link of allLinks) {
      const a = link as HTMLAnchorElement;
      const segs = a.pathname.split('/').filter(Boolean);
      if (segs.length !== 1 || !isLikelyUsername(segs[0])) continue;
      // Must be in the sidebar/nav area (within first 300px from left or last 300px in bottom)
      const rect = a.getBoundingClientRect();
      if (rect.width > 0 && (rect.left < 300 || rect.top > window.innerHeight - 100)) {
        // Check if it's NOT a link to someone else's profile in the feed
        if (a.closest('nav, [role="navigation"], [role="banner"], [role="tablist"]')) {
          console.log('[Boostify IG] Strategy 9 (nav link no img): @' + segs[0]);
          return { username: segs[0], profilePic: '' };
        }
      }
    }

    // ---- Strategy 10: Scrape from settings page link ----
    const settingsLink = document.querySelector('a[href*="/accounts/edit/"], a[href*="/settings/"]') as HTMLAnchorElement;
    if (settingsLink) {
      // The username is often displayed near the settings link
      const container = settingsLink.closest('div');
      if (container) {
        const textContent = container.textContent || '';
        // Try to find a username pattern near settings
        const usernameMatch = textContent.match(/^([a-zA-Z0-9._]{1,30})$/m);
        if (usernameMatch && isLikelyUsername(usernameMatch[1])) {
          console.log('[Boostify IG] Strategy 10 (near settings): @' + usernameMatch[1]);
          return { username: usernameMatch[1], profilePic: '' };
        }
      }
    }

    console.warn('[Boostify IG] All 10 detection strategies failed');
    return null;
  } catch (e) {
    console.warn('[Boostify IG] Detection error:', e);
    return null;
  }
}

// Debounce helper
function debounce(fn: () => void, ms: number) {
  let timer: number;
  return () => { clearTimeout(timer); timer = window.setTimeout(fn, ms); };
}

// ============================================================
// Main extraction logic
// ============================================================

async function runExtraction() {
  // Wait for Instagram's SPA to fully render
  await waitForContent();

  if (isProfilePage()) {
    console.log('[Boostify IG] Profile page detected');
    const profileData = extractProfileData();
    if (profileData) {
      chrome.runtime.sendMessage({
        type: 'PROFILE_DATA_EXTRACTED',
        data: profileData,
      });
      console.log('[Boostify IG] Profile sent:', profileData.username, profileData.followers, 'followers');
    }

    // Also extract posts from grid
    const posts = extractPostsFromGrid();
    if (posts.length > 0) {
      chrome.runtime.sendMessage({
        type: 'POST_DATA_EXTRACTED',
        data: posts,
      });
      console.log('[Boostify IG] Grid posts sent:', posts.length);
    }
  }

  if (isPostPage()) {
    console.log('[Boostify IG] Post page detected');
    const postData = extractSinglePost();
    if (postData) {
      chrome.runtime.sendMessage({
        type: 'POST_DATA_EXTRACTED',
        data: [postData],
      });
      console.log('[Boostify IG] Post sent:', postData.postId, postData.likes, 'likes');
    }
  }
}

// Wait for Instagram content to load (SPA)
function waitForContent(): Promise<void> {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds max
    const check = () => {
      attempts++;
      const main = document.querySelector('main, [role="main"], article, section, div[class]');
      if (main || attempts >= maxAttempts) {
        if (!main) console.warn('[Boostify IG] waitForContent timed out after 10s, proceeding anyway');
        resolve();
      } else {
        setTimeout(check, 500);
      }
    };
    // Give initial page load some time
    setTimeout(check, 1500);
  });
}

// ============================================================
// MutationObserver — detect SPA navigation
// ============================================================

let lastUrl = window.location.href;
const debouncedExtract = debounce(runExtraction, 2000);

const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('[Boostify IG] Navigation detected:', lastUrl);
    debouncedExtract();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// ============================================================
// Tool overlay panel (in-page)
// ============================================================

let overlayOpen = false;

/**
 * Detect the current Instagram page context
 */
function getCurrentPageContext(): { type: string; label: string; detail: string } {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);

  if (isProfilePage() && segments.length === 1) {
    return { type: 'profile', label: `Viewing @${segments[0]}'s profile`, detail: `Profile: @${segments[0]}` };
  }
  if (path.startsWith('/p/')) {
    return { type: 'post', label: 'Viewing a post', detail: 'Post page' };
  }
  if (path.startsWith('/reel/') || path.startsWith('/reels/')) {
    return { type: 'reel', label: 'Viewing reels', detail: 'Reels' };
  }
  if (path.startsWith('/explore/')) {
    if (path.includes('/tags/')) {
      const tag = segments[2] || '';
      return { type: 'hashtag', label: `Exploring #${tag}`, detail: `Hashtag: #${tag}` };
    }
    return { type: 'explore', label: 'Explore page', detail: 'Explore' };
  }
  if (path.startsWith('/direct/')) {
    return { type: 'dms', label: 'Direct Messages', detail: 'DMs' };
  }
  if (path === '/' || path === '') {
    return { type: 'feed', label: 'Home Feed', detail: 'Feed' };
  }
  return { type: 'other', label: 'Instagram', detail: 'Instagram' };
}

/**
 * Update the overlay header with latest account info
 */
function updateOverlayAccount(overlay: HTMLElement) {
  if (!loggedInUser) loggedInUser = detectLoggedInUser();
  const titleEl = overlay.querySelector('#boostify-overlay-title');
  const subtitleEl = overlay.querySelector('#boostify-overlay-subtitle');
  const currentPage = getCurrentPageContext();
  if (titleEl && loggedInUser) titleEl.textContent = `@${loggedInUser.username}`;
  if (subtitleEl) subtitleEl.textContent = currentPage.label;
}

const toolDefs = [
  { id: 'captions', icon: '✍️', label: 'Captions', desc: 'Generate viral captions' },
  { id: 'hashtags', icon: '#️⃣', label: 'Hashtags', desc: 'Get 30 trending tags' },
  { id: 'ideas',    icon: '💡', label: 'Ideas', desc: 'Content ideas for you' },
  { id: 'bio',      icon: '✨', label: 'Bio', desc: 'Optimize your bio' },
  { id: 'timing',   icon: '⏰', label: 'Best Times', desc: 'When to post' },
  { id: 'audit',    icon: '📊', label: 'Audit', desc: 'Full profile review' },
];

function createOverlay(): HTMLDivElement {
  const existing = document.getElementById('boostify-ig-overlay') as HTMLDivElement | null;
  if (existing) {
    // Update account info on re-open
    updateOverlayAccount(existing);
    return existing;
  }

  // Try to detect user if not yet detected
  if (!loggedInUser) loggedInUser = detectLoggedInUser();

  const overlay = document.createElement('div');
  overlay.id = 'boostify-ig-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; right: -400px; width: 380px; height: 100vh;
    background: #0a0a0f; color: white; z-index: 999999; 
    box-shadow: -4px 0 24px rgba(0,0,0,0.5); transition: right 0.3s ease;
    font-family: -apple-system, system-ui, sans-serif; overflow-y: auto;
    border-left: 1px solid rgba(255,255,255,0.06);
  `;

  const currentPage = getCurrentPageContext();

  overlay.innerHTML = `
    <div style="padding:16px; background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.1),rgba(249,115,22,0.08))">
      <div style="display:flex; align-items:center; gap:10px">
        ${loggedInUser?.profilePic ? `
          <img id="boostify-overlay-avatar" src="${loggedInUser.profilePic}" style="width:40px;height:40px;border-radius:12px;border:2px solid rgba(236,72,153,0.4);object-fit:cover" />
        ` : `
          <div id="boostify-overlay-avatar" style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#a855f7,#ec4899,#f97316);display:flex;align-items:center;justify-content:center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
        `}
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px" id="boostify-overlay-title">${loggedInUser ? `@${loggedInUser.username}` : 'Boostify AI Tools'}</div>
          <div style="font-size:11px;opacity:0.5" id="boostify-overlay-subtitle">${currentPage.label}</div>
        </div>
        <button id="boostify-overlay-close" style="background:rgba(255,255,255,0.05);border:none;color:white;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center">✕</button>
      </div>
      ${currentPage.type !== 'other' ? `
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap" id="boostify-overlay-context">
          <span style="padding:3px 8px;border-radius:6px;background:rgba(168,85,247,0.15);font-size:10px;color:#c084fc">📍 ${currentPage.detail}</span>
          ${loggedInUser ? `<span style="padding:3px 8px;border-radius:6px;background:rgba(34,197,94,0.15);font-size:10px;color:#4ade80">✓ Connected</span>` : ''}
        </div>
      ` : ''}
    </div>
    <div style="padding:12px" id="boostify-overlay-content">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${toolDefs.map(t => `
          <button data-tool="${t.id}" class="boostify-tool-btn" style="
            background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06);
            border-radius:12px; padding:14px 10px; text-align:left; cursor:pointer; color:white;
            transition:all 0.15s;
          ">
            <span style="font-size:22px;display:block">${t.icon}</span>
            <div style="font-size:12px;font-weight:600;margin-top:6px">${t.label}</div>
            <div style="font-size:10px;opacity:0.4;margin-top:2px">${t.desc}</div>
          </button>
        `).join('')}
      </div>
      <div id="boostify-tool-result" style="margin-top:12px"></div>
    </div>
    <div style="padding:12px;border-top:1px solid rgba(255,255,255,0.06)">
      <button id="boostify-open-dashboard" style="
        width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);
        background:rgba(255,255,255,0.04);color:white;font-size:12px;cursor:pointer;font-weight:500
      ">📊 Open Full Dashboard</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close button
  overlay.querySelector('#boostify-overlay-close')?.addEventListener('click', () => {
    toggleOverlay(false);
  });

  // Dashboard button
  overlay.querySelector('#boostify-open-dashboard')?.addEventListener('click', () => {
    window.open('http://localhost:5000/instagram-boost', '_blank');
  });

  // Tool buttons
  overlay.querySelectorAll('.boostify-tool-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      (btn as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
      (btn as HTMLElement).style.borderColor = 'rgba(236,72,153,0.3)';
    });
    btn.addEventListener('mouseleave', () => {
      (btn as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
      (btn as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
    });
    btn.addEventListener('click', () => {
      const toolId = (btn as HTMLElement).dataset.tool;
      if (toolId) runToolFromOverlay(toolId);
    });
  });

  return overlay;
}

async function runToolFromOverlay(toolId: string) {
  const resultDiv = document.getElementById('boostify-tool-result');
  if (!resultDiv) return;

  // Show loading
  resultDiv.innerHTML = `
    <div style="padding:14px;border-radius:10px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.15);display:flex;align-items:center;gap:8px">
      <div style="width:16px;height:16px;border:2px solid #a855f7;border-top-color:transparent;border-radius:50%;animation:boostify-spin 0.8s linear infinite"></div>
      <span style="font-size:12px;color:#c084fc">Running ${toolId}...</span>
    </div>
    <style>@keyframes boostify-spin { to { transform: rotate(360deg) } }</style>
  `;

  // Highlight active tool
  document.querySelectorAll('.boostify-tool-btn').forEach(b => {
    const el = b as HTMLElement;
    if (el.dataset.tool === toolId) {
      el.style.background = 'rgba(236,72,153,0.08)';
      el.style.borderColor = 'rgba(236,72,153,0.3)';
    } else {
      el.style.background = 'rgba(255,255,255,0.02)';
      el.style.borderColor = 'rgba(255,255,255,0.06)';
    }
  });

  try {
    // Get current page context
    const pageUrl = window.location.href;
    const isProfile = isProfilePage();
    const username = isProfile ? window.location.pathname.split('/').filter(Boolean)[0] : '';

    // Call Boostify AI agent
    const response = await fetch('http://localhost:5000/api/instagram/ai-agent/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: toolId === 'audit' ? 'full-audit' : toolId === 'timing' ? 'best-times' : toolId,
        artistName: username || 'artist',
        genre: '',
        context: `Instagram page: ${pageUrl}`,
      }),
    });

    if (!response.ok) {
      // Fallback: open dashboard tab
      window.open(`http://localhost:5000/instagram-boost?tab=ai-tools&tool=${toolId}`, '_blank');
      resultDiv.innerHTML = `
        <div style="padding:12px;border-radius:10px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15)">
          <div style="font-size:12px;color:#93c5fd">🔗 Opened in Boostify Dashboard</div>
          <div style="font-size:10px;opacity:0.5;margin-top:4px">Sign in for AI-powered results</div>
        </div>
      `;
      return;
    }

    const data = await response.json();

    if (data.result) {
      const r = data.result;
      let html = '';

      if (r.captions) {
        html = r.captions.map((c: any, i: number) => `
          <div style="padding:10px;margin-bottom:6px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
            <div style="font-size:11px;font-weight:600;margin-bottom:4px">Caption ${i+1}</div>
            <div style="font-size:12px;opacity:0.8;line-height:1.4">${c.text || c}</div>
            <button onclick="navigator.clipboard.writeText('${(c.text || c).replace(/'/g, '\\\'').replace(/\n/g, '\\n')}')" style="
              margin-top:6px;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);
              background:rgba(255,255,255,0.04);color:white;font-size:10px;cursor:pointer
            ">📋 Copy</button>
          </div>
        `).join('');
      } else if (r.hashtags || r.groups) {
        const tags = r.hashtags || (r.groups ? Object.values(r.groups).flat() : []);
        html = `
          <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
            <div style="font-size:11px;font-weight:600;margin-bottom:6px">${tags.length} Hashtags</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${(tags as string[]).map((t: string) => `<span style="padding:3px 8px;border-radius:6px;background:rgba(236,72,153,0.1);font-size:10px;color:#f9a8d4">${t}</span>`).join('')}
            </div>
            <button onclick="navigator.clipboard.writeText('${(tags as string[]).join(' ').replace(/'/g, '\\\'')}')" style="
              margin-top:8px;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);
              background:rgba(255,255,255,0.04);color:white;font-size:10px;cursor:pointer
            ">📋 Copy All</button>
          </div>
        `;
      } else if (r.score !== undefined) {
        html = `
          <div style="padding:12px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
            <div style="text-align:center;margin-bottom:8px">
              <div style="font-size:28px;font-weight:700;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${r.score}/100</div>
              <div style="font-size:10px;opacity:0.4">Profile Score</div>
            </div>
            ${r.strengths ? `<div style="margin-top:6px"><div style="font-size:10px;color:#4ade80;font-weight:600">Strengths</div>${r.strengths.map((s: string) => `<div style="font-size:11px;opacity:0.7;padding:2px 0">✅ ${s}</div>`).join('')}</div>` : ''}
            ${r.weaknesses ? `<div style="margin-top:6px"><div style="font-size:10px;color:#f87171;font-weight:600">Needs Work</div>${r.weaknesses.map((w: string) => `<div style="font-size:11px;opacity:0.7;padding:2px 0">⚠️ ${w}</div>`).join('')}</div>` : ''}
            ${r.quickWins ? `<div style="margin-top:6px"><div style="font-size:10px;color:#60a5fa;font-weight:600">Quick Wins</div>${r.quickWins.map((q: string) => `<div style="font-size:11px;opacity:0.7;padding:2px 0">💡 ${q}</div>`).join('')}</div>` : ''}
          </div>
        `;
      } else if (r.ideas || r.bios || r.bestTimes) {
        // Generic structured result
        const items = r.ideas || r.bios || r.bestTimes || [];
        html = `
          <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
            ${Array.isArray(items) ? items.map((item: any, i: number) => `
              <div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;opacity:0.8">
                ${typeof item === 'string' ? item : JSON.stringify(item)}
              </div>
            `).join('') : `<div style="font-size:11px;opacity:0.8">${JSON.stringify(items, null, 2)}</div>`}
          </div>
        `;
      } else {
        html = `<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,0.03);font-size:11px;opacity:0.8;white-space:pre-wrap">${JSON.stringify(r, null, 2)}</div>`;
      }

      resultDiv.innerHTML = html;
    }
  } catch (err: any) {
    // Fallback: redirect to dashboard
    window.open(`http://localhost:5000/instagram-boost?tab=ai-tools&tool=${toolId}`, '_blank');
    resultDiv.innerHTML = `
      <div style="padding:12px;border-radius:10px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15)">
        <div style="font-size:12px;color:#93c5fd">🔗 Opened in Boostify Dashboard</div>
        <div style="font-size:10px;opacity:0.5;margin-top:4px">${err.message}</div>
      </div>
    `;
  }
}

function toggleOverlay(show?: boolean) {
  const overlay = createOverlay();
  overlayOpen = show !== undefined ? show : !overlayOpen;
  overlay.style.right = overlayOpen ? '0px' : '-400px';

  // Show/hide backdrop
  let backdrop = document.getElementById('boostify-ig-backdrop');
  if (overlayOpen) {
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'boostify-ig-backdrop';
      backdrop.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.3);z-index:999998;transition:opacity 0.3s`;
      backdrop.addEventListener('click', () => toggleOverlay(false));
      document.body.appendChild(backdrop);
    }
    backdrop.style.opacity = '1';
    backdrop.style.pointerEvents = 'auto';
  } else if (backdrop) {
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
  }
}

// ============================================================
// Inject Boostify floating button
// ============================================================

function injectBoostifyButton() {
  if (document.getElementById('boostify-ig-fab')) return;

  // First detect the logged-in user
  loggedInUser = detectLoggedInUser();
  if (loggedInUser) {
    console.log('[Boostify IG] Detected user:', loggedInUser.username);
    // Send to background for caching
    chrome.runtime.sendMessage({ type: 'LOGGED_IN_USER_DETECTED', data: loggedInUser }).catch(() => {});
  }

  const fab = document.createElement('div');
  fab.id = 'boostify-ig-fab';
  fab.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 999997;
    cursor: pointer; user-select: none;
  `;

  const hasUser = loggedInUser && loggedInUser.profilePic;

  fab.innerHTML = `
    <div style="
      display: flex; align-items: center; gap: 8px;
      padding: ${hasUser ? '6px 14px 6px 6px' : '12px'};
      border-radius: ${hasUser ? '50px' : '50%'};
      background: linear-gradient(135deg, #7c3aed, #ec4899, #f97316);
      box-shadow: 0 4px 20px rgba(236,72,153,0.4), 0 0 40px rgba(168,85,247,0.2);
      color: white; transition: all 0.3s ease;
      font-family: -apple-system, system-ui, sans-serif;
    " 
    onmouseenter="this.style.transform='scale(1.05)';this.style.boxShadow='0 6px 30px rgba(236,72,153,0.6)'"
    onmouseleave="this.style.transform='scale(1)';this.style.boxShadow='0 4px 20px rgba(236,72,153,0.4)'"
    >
      ${hasUser ? `
        <img src="${loggedInUser!.profilePic}" style="width:32px;height:32px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);object-fit:cover" />
        <div>
          <div style="font-size:12px;font-weight:700;line-height:1.2">Boostify</div>
          <div style="font-size:10px;opacity:0.8">@${loggedInUser!.username}</div>
        </div>
      ` : `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
      `}
    </div>
  `;

  fab.addEventListener('click', () => {
    // Re-detect on each click in case user changed
    if (!loggedInUser) loggedInUser = detectLoggedInUser();
    toggleOverlay();
  });

  document.body.appendChild(fab);

  // Retry detection multiple times as Instagram loads more content
  if (!loggedInUser) {
    const retryDelays = [3000, 6000, 10000, 15000, 25000];
    for (const delay of retryDelays) {
      setTimeout(() => {
        if (loggedInUser) return; // Already found
        loggedInUser = detectLoggedInUser();
        if (loggedInUser) {
          console.log('[Boostify IG] Late detection (after ' + delay + 'ms):', loggedInUser.username);
          chrome.runtime.sendMessage({ type: 'LOGGED_IN_USER_DETECTED', data: loggedInUser }).catch(() => {});
          // Rebuild the FAB with the detected user info
          const fabEl = document.getElementById('boostify-ig-fab');
          if (fabEl) { fabEl.remove(); injectBoostifyButton(); }
        }
      }, delay);
    }
  }
}

// ============================================================
// Initialize
// ============================================================

// Run initial extraction (profile/post page scraping)
runExtraction().catch(e => console.warn('[Boostify IG] runExtraction error:', e));

// Auto-fetch logged-in user's stats and sync to background
autoFetchAndSync().catch(e => console.warn('[Boostify IG] autoFetchAndSync error:', e));

// Inject button after a delay
setTimeout(() => {
  console.log('[Boostify IG] Injecting floating button...');
  injectBoostifyButton();
}, 3000);

/**
 * Auto-fetch the logged-in user's profile stats using Instagram's internal API.
 * Works from ANY page (feed, explore, reels, etc.) — no need to be on profile page.
 */
async function autoFetchAndSync() {
  try {
    // Wait for page to settle (Instagram SPA needs time)
    await new Promise(r => setTimeout(r, 4000));

    // Try to detect user — retry up to 5 times with increasing delays
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!loggedInUser) loggedInUser = detectLoggedInUser();
      if (loggedInUser?.username) break;
      console.log(`[Boostify IG] Auto-sync: detection attempt ${attempt + 1}/5 failed, waiting...`);
      await new Promise(r => setTimeout(r, 3000 + attempt * 2000));
    }

    if (!loggedInUser?.username) {
      console.warn('[Boostify IG] Could not detect user after 5 attempts.');
      // Last resort: ask background if it has a cached username
      try {
        const cached = await chrome.runtime.sendMessage({ type: 'GET_LOGGED_IN_USER' });
        if (cached?.user?.username && cached.user.username !== 'unknown') {
          loggedInUser = cached.user;
          console.log('[Boostify IG] Got cached user from background: @' + loggedInUser!.username);
        }
      } catch {}
    }

    if (!loggedInUser?.username) {
      console.warn('[Boostify IG] No user detected, skipping auto-sync');
      return;
    }

    const username = loggedInUser.username;
    console.log('[Boostify IG] Detected user: @' + username + ', fetching stats...');

    // Notify background immediately about the user
    chrome.runtime.sendMessage({
      type: 'LOGGED_IN_USER_DETECTED',
      data: { username, profilePic: loggedInUser.profilePic },
    }).catch(() => {});

    // Ask background to fetch the profile (background can fetch without CORS limits)
    try {
      const bgResult = await chrome.runtime.sendMessage({
        type: 'FETCH_PROFILE',
        username: username,
      });
      if (bgResult?.profileData && bgResult.profileData.followers > 0) {
        console.log('[Boostify IG] Background fetched profile: ' + bgResult.profileData.followers + ' followers');
        await chrome.runtime.sendMessage({
          type: 'PROFILE_DATA_EXTRACTED',
          data: bgResult.profileData,
        }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));
        await chrome.runtime.sendMessage({ type: 'SYNC_NOW' }).catch(() => {});
        console.log('[Boostify IG] Sync triggered via background fetch');
        return;
      }
    } catch (e) {
      console.log('[Boostify IG] Background fetch failed, trying content-side methods...');
    }

    // --- Fallback: Try content-script methods to get profile data ---
    let profileData: any = null;

    // Method 1: If we're ON the user's profile page, scrape DOM directly
    if (window.location.pathname === `/${username}/` || window.location.pathname === `/${username}`) {
      profileData = await scrapeProfileFromDOM(username);
      if (profileData) console.log('[Boostify IG] Method 1 (DOM scrape): SUCCESS');
    }

    // Method 2: Instagram GraphQL API (may be blocked)
    if (!profileData) {
      profileData = await fetchProfileViaApi(username);
      if (profileData) console.log('[Boostify IG] Method 2 (API): SUCCESS');
    }

    // Method 3: Navigate to profile in a hidden way (fetch HTML)
    if (!profileData) {
      profileData = await fetchProfileFromHTML(username);
      if (profileData) console.log('[Boostify IG] Method 3 (HTML parse): SUCCESS');
    }

    // Method 4: Open profile page briefly to scrape
    if (!profileData) {
      console.log('[Boostify IG] Method 4: Navigating to profile page to scrape...');
      profileData = await navigateAndScrape(username);
      if (profileData) console.log('[Boostify IG] Method 4 (navigate+scrape): SUCCESS');
    }

    if (profileData) {
      // Send to background for caching
      await chrome.runtime.sendMessage({
        type: 'PROFILE_DATA_EXTRACTED',
        data: profileData,
      }).catch(() => {});

      // Wait for background to cache, then trigger sync
      await new Promise(r => setTimeout(r, 1500));
      await chrome.runtime.sendMessage({ type: 'SYNC_NOW' }).catch(() => {});

      console.log('[Boostify IG] Sync complete: @' + profileData.username,
        '| Followers:', profileData.followers,
        '| Following:', profileData.following,
        '| Posts:', profileData.postsCount);
    } else {
      console.warn('[Boostify IG] All fetch methods failed. Try visiting your profile page.');
      // Still sync with just the username so at least that gets updated
      await chrome.runtime.sendMessage({ type: 'SYNC_NOW' }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Boostify IG] Auto-fetch failed:', err);
  }
}

/**
 * Method 1: Scrape profile stats directly from the current DOM
 * Only works when user is ON their own profile page
 */
async function scrapeProfileFromDOM(username: string): Promise<any | null> {
  try {
    // Wait for stats to render
    await new Promise(r => setTimeout(r, 2000));

    // Instagram profile stats: look for the header section with followers/following/posts
    const header = document.querySelector('header section, header > div > div');
    if (!header) return null;

    // Find all stat links/spans in the header
    const statElements = header.querySelectorAll('a[href*="followers"], a[href*="following"], span[title], li');
    let followers = 0, following = 0, postsCount = 0;

    // Try the clean method: links with /followers/ and /following/
    const followersLink = header.querySelector(`a[href="/${username}/followers/"]`);
    const followingLink = header.querySelector(`a[href="/${username}/following/"]`);

    if (followersLink) {
      const countEl = followersLink.querySelector('span[title], span');
      followers = parseStatNumber(countEl?.getAttribute('title') || countEl?.textContent || '0');
    }
    if (followingLink) {
      const countEl = followingLink.querySelector('span[title], span');
      following = parseStatNumber(countEl?.getAttribute('title') || countEl?.textContent || '0');
    }

    // Posts count: usually the first stat in the header
    const allLis = header.querySelectorAll('li, div > span');
    for (const li of allLis) {
      const text = li.textContent?.toLowerCase() || '';
      if (text.includes('post') || text.includes('publicaci')) {
        const numMatch = text.match(/([\d,.KkMm]+)/);
        if (numMatch) postsCount = parseStatNumber(numMatch[1]);
      }
    }

    // Fallback: just grab all numbers from the header section
    if (!followers && !following) {
      const headerText = header.textContent || '';
      const numbers = headerText.match(/[\d,.]+[KkMm]?\s*(followers?|seguidores?|following|siguiendo|posts?|publicaci)/gi);
      if (numbers) {
        for (const match of numbers) {
          const num = parseStatNumber(match);
          if (match.toLowerCase().includes('follower') || match.toLowerCase().includes('seguidor')) followers = num;
          else if (match.toLowerCase().includes('following') || match.toLowerCase().includes('siguiendo')) following = num;
          else if (match.toLowerCase().includes('post') || match.toLowerCase().includes('publicaci')) postsCount = num;
        }
      }
    }

    if (!followers && !following && !postsCount) return null;

    // Get bio
    const bioEl = document.querySelector('header + div span, div.-vDIg span, section > div > span, header ~ div span');
    const bio = bioEl?.textContent || '';

    // Get profile pic
    const profilePic = (document.querySelector('header img[alt*="profile" i], header img[data-testid="user-avatar"]') as HTMLImageElement)?.src || '';

    // Get display name
    const nameEl = document.querySelector('header h2, header span[dir="auto"]');
    const displayName = nameEl?.textContent || username;

    // Get verified status
    const isVerified = !!document.querySelector('header svg[aria-label*="Verified"], header span[title="Verified"]');

    return {
      username,
      displayName,
      bio,
      profileUrl: `https://www.instagram.com/${username}/`,
      profilePicUrl: profilePic,
      followers,
      following,
      postsCount,
      isVerified,
      isPrivate: false,
      externalUrl: '',
      category: '',
    };
  } catch {
    return null;
  }
}

/**
 * Method 3: Fetch profile HTML page and parse embedded data
 */
async function fetchProfileFromHTML(username: string): Promise<any | null> {
  try {
    const resp = await fetch(`/${username}/`, {
      credentials: 'include',
      headers: { 'Accept': 'text/html' },
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Try to find JSON data embedded in the page
    // Instagram embeds user data in several possible formats

    // Format 1: window.__additionalDataLoaded
    const additionalData = html.match(/window\.__additionalDataLoaded\([^,]+,\s*(\{.*?\})\s*\);/s);
    if (additionalData) {
      try {
        const data = JSON.parse(additionalData[1]);
        const user = data?.graphql?.user || data?.user;
        if (user) return extractUserFromJSON(user, username);
      } catch { /* continue */ }
    }

    // Format 2: window._sharedData
    const sharedData = html.match(/window\._sharedData\s*=\s*(\{.*?\});\s*<\/script>/s);
    if (sharedData) {
      try {
        const data = JSON.parse(sharedData[1]);
        const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
        if (user) return extractUserFromJSON(user, username);
      } catch { /* continue */ }
    }

    // Format 3: Embedded JSON in script tags (newer IG)
    const scriptTags = html.match(/<script[^>]*>(\{[^<]*"edge_followed_by"[^<]*)<\/script>/g);
    if (scriptTags) {
      for (const tag of scriptTags) {
        const jsonStr = tag.replace(/<\/?script[^>]*>/g, '');
        try {
          const data = JSON.parse(jsonStr);
          const user = findUserInObject(data);
          if (user) return extractUserFromJSON(user, username);
        } catch { /* continue */ }
      }
    }

    // Format 4: Regex fallback for individual fields
    const followersMatch = html.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
    const followingMatch = html.match(/"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
    const postsMatch = html.match(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);

    if (followersMatch) {
      const bioMatch = html.match(/"biography"\s*:\s*"([^"]*?)"/);
      const nameMatch = html.match(/"full_name"\s*:\s*"([^"]*?)"/);
      const picMatch = html.match(/"profile_pic_url_hd"\s*:\s*"([^"]*?)"/);
      const verifiedMatch = html.match(/"is_verified"\s*:\s*(true|false)/);

      return {
        username,
        displayName: nameMatch ? decodeUnicodeEscapes(nameMatch[1]) : username,
        bio: bioMatch ? decodeUnicodeEscapes(bioMatch[1]) : '',
        profileUrl: `https://www.instagram.com/${username}/`,
        profilePicUrl: picMatch ? picMatch[1].replace(/\\u0026/g, '&') : '',
        followers: parseInt(followersMatch[1]) || 0,
        following: parseInt(followingMatch?.[1] || '0') || 0,
        postsCount: parseInt(postsMatch?.[1] || '0') || 0,
        isVerified: verifiedMatch?.[1] === 'true',
        isPrivate: false,
        externalUrl: '',
        category: '',
      };
    }

    // Format 5: Meta tags
    const descMeta = html.match(/<meta\s+(?:name|property)="description"\s+content="([^"]+)"/i);
    if (descMeta) {
      // "1,234 Followers, 567 Following, 89 Posts - See Instagram photos and videos from Name (@user)"
      const desc = descMeta[1];
      const nums = desc.match(/([\d,]+)\s*Followers?.*([\d,]+)\s*Following.*([\d,]+)\s*Posts?/i);
      if (nums) {
        return {
          username,
          displayName: username,
          bio: '',
          profileUrl: `https://www.instagram.com/${username}/`,
          profilePicUrl: '',
          followers: parseInt(nums[1].replace(/,/g, '')) || 0,
          following: parseInt(nums[2].replace(/,/g, '')) || 0,
          postsCount: parseInt(nums[3].replace(/,/g, '')) || 0,
          isVerified: false,
          isPrivate: false,
          externalUrl: '',
          category: '',
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Method 4: Navigate to profile page, wait for render, scrape DOM, then go back
 */
async function navigateAndScrape(username: string): Promise<any | null> {
  try {
    const originalUrl = window.location.href;
    const profileUrl = `/${username}/`;

    // Only navigate if we're not already on the profile
    if (window.location.pathname !== profileUrl) {
      // Use history API to navigate without full reload
      window.history.pushState({}, '', profileUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));

      // Wait for Instagram SPA to load the profile
      await new Promise(r => setTimeout(r, 4000));
    }

    // Now scrape the DOM
    const data = await scrapeProfileFromDOM(username);

    // Navigate back
    if (window.location.href !== originalUrl) {
      window.history.pushState({}, '', originalUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }

    return data;
  } catch {
    return null;
  }
}

/** Parse stat numbers like "1,234", "1.2K", "3.5M" */
function parseStatNumber(text: string): number {
  if (!text) return 0;
  const clean = text.replace(/[^0-9.KkMm,]/g, '').replace(/,/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  if (/[Mm]/.test(clean)) return Math.round(num * 1_000_000);
  if (/[Kk]/.test(clean)) return Math.round(num * 1_000);
  return Math.round(num);
}

/** Decode unicode escape sequences from Instagram JSON */
function decodeUnicodeEscapes(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\\\\/g, '\\');
}

/** Extract user data from Instagram's JSON user object */
function extractUserFromJSON(user: any, username: string): any {
  return {
    username: user.username || username,
    displayName: user.full_name || username,
    bio: user.biography || '',
    profileUrl: `https://www.instagram.com/${username}/`,
    profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || '',
    followers: user.edge_followed_by?.count || user.follower_count || 0,
    following: user.edge_follow?.count || user.following_count || 0,
    postsCount: user.edge_owner_to_timeline_media?.count || user.media_count || 0,
    isVerified: user.is_verified || false,
    isPrivate: user.is_private || false,
    externalUrl: user.external_url || '',
    category: user.category_name || '',
  };
}

/** Recursively search for a user object with follower data in nested JSON */
function findUserInObject(obj: any, depth = 0): any | null {
  if (depth > 5 || !obj || typeof obj !== 'object') return null;
  if (obj.edge_followed_by && obj.username) return obj;
  if (obj.follower_count && obj.username) return obj;
  for (const key of Object.keys(obj)) {
    const result = findUserInObject(obj[key], depth + 1);
    if (result) return result;
  }
  return null;
}

/**
 * Fetch a user's profile data via Instagram's internal API (same-origin fetch).
 * This works from any Instagram page without navigation.
 */
async function fetchProfileViaApi(username: string): Promise<any | null> {
  try {
    const resp = await fetch(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      credentials: 'include',
      headers: {
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (resp.ok) {
      const json = await resp.json();
      const user = json?.data?.user;
      if (user) return extractUserFromJSON(user, username);
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Listen for messages from background/popup
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Ping — used by background to check if content script is alive
  if (message.type === 'PING') {
    sendResponse({ pong: true, url: window.location.href });
    return false;
  }

  if (message.type === 'START_EXTRACTION') {
    handleExtraction(message.extractType, message.query, message.sortMode, message.maxUsers, message.enrichProfiles, message.banProtection)
      .then(results => sendResponse({ success: true, results }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async
  }

  if (message.type === 'CANCEL_EXTRACTION') {
    if (currentExtraction) {
      currentExtraction.cancelled = true;
      currentExtraction = null;
    }
    // Also cancel enrichment
    const { cancelExtraction: cancelEnrich } = extractorModule;
    cancelEnrich();
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'GET_EXTRACTION_STATUS') {
    sendResponse({ extracting: !!currentExtraction });
    return false;
  }

  // Handle tool execution from popup
  if (message.type === 'RUN_BOOSTIFY_TOOL') {
    toggleOverlay(true);
    if (message.toolId) {
      setTimeout(() => runToolFromOverlay(message.toolId), 500);
    }
    sendResponse({ success: true });
    return false;
  }

  // Return page info + detected user to popup
  if (message.type === 'GET_PAGE_INFO') {
    if (!loggedInUser) loggedInUser = detectLoggedInUser();
    const pageContext = getCurrentPageContext();
    const profileData = isProfilePage() ? extractProfileData() : null;
    sendResponse({
      loggedInUser,
      pageContext,
      profileData,
      url: window.location.href,
    });
    return false;
  }
});

async function handleExtraction(
  extractType: ExtractType,
  query?: string,
  sortMode?: SortMode,
  maxUsers = 500,
  shouldEnrich = false,
  banProtectionConfig?: Partial<BanProtectionConfig>,
): Promise<ExtractedUser[]> {
  if (currentExtraction) {
    throw new Error('Extraction already in progress');
  }

  const state = { cancelled: false };
  currentExtraction = state;
  resetExtraction();

  // Apply ban protection settings
  if (banProtectionConfig) {
    setBanProtection(banProtectionConfig);
  }

  const jobId = `ext_${Date.now()}`;

  const onProgress = (count: number, total: number) => {
    if (state.cancelled) throw new Error('Cancelled');
    chrome.runtime.sendMessage({
      type: 'EXTRACTION_PROGRESS',
      jobId,
      count,
      total,
      phase: 'extracting',
    }).catch(() => {});
  };

  try {
    let results: ExtractedUser[];

    switch (extractType) {
      case 'followers':
        results = await extractFollowers(maxUsers, onProgress);
        break;
      case 'following':
        results = await extractFollowing(maxUsers, onProgress);
        break;
      case 'hashtag':
        if (!query) throw new Error('Hashtag query required');
        results = await extractHashtagUsers(query, sortMode || 'recent', maxUsers, onProgress);
        break;
      case 'likers':
        results = await extractLikers(query, maxUsers, onProgress);
        break;
      case 'commenters':
        results = await extractCommenters(query, maxUsers, onProgress);
        break;
      case 'location':
        if (!query) throw new Error('Location URL required');
        results = await extractLocationUsers(query, maxUsers, onProgress);
        break;
      default:
        throw new Error(`Unknown extract type: ${extractType}`);
    }

    // Phase 2: Enrich profiles if requested (visit each profile for email, phone, bio, etc.)
    if (shouldEnrich && results.length > 0) {
      chrome.runtime.sendMessage({
        type: 'EXTRACTION_PROGRESS',
        jobId,
        count: 0,
        total: results.length,
        phase: 'enriching',
        currentUser: 'Starting enrichment...',
      }).catch(() => {});

      results = await enrichProfiles(results, (enriched, total, currentUser) => {
        if (state.cancelled) throw new Error('Cancelled');
        chrome.runtime.sendMessage({
          type: 'EXTRACTION_PROGRESS',
          jobId,
          count: enriched,
          total,
          phase: 'enriching',
          currentUser,
        }).catch(() => {});
      });
    }

    chrome.runtime.sendMessage({
      type: 'EXTRACTION_COMPLETE',
      jobId,
      results,
    }).catch(() => {});

    return results;

  } catch (err: any) {
    if (err.message !== 'Cancelled') {
      chrome.runtime.sendMessage({
        type: 'EXTRACTION_ERROR',
        jobId,
        error: err.message,
      }).catch(() => {});
    }
    throw err;
  } finally {
    currentExtraction = null;
  }
}
