// Boostify Instagram Extension — Background Service Worker

import { ALARM_SYNC_STATS, ALARM_CHECK_TRENDS, SYNC_INTERVAL_MINUTES, BADGE_COLOR_CONNECTED, BADGE_COLOR_SYNCING, BADGE_COLOR_ERROR, BADGE_COLOR_PENDING } from '../shared/constants';
import { getConnectionInfo, updateLastSync, saveCachedActions, getSettings, setStorage, getStorage } from '../shared/storage';
import { syncStats, getPendingActions, sendWebhookEvent } from '../shared/api-client';
import type { ExtractedProfileData, ExtractedPostData, MessageType, ExtractionJob, ExtractedUser } from '../shared/types';

// ============================================================
// Cookie-based Instagram user detection (MOST RELIABLE METHOD)
// Uses chrome.cookies API — does NOT depend on DOM parsing
// ============================================================
async function detectUserViaCookies(): Promise<{ userId: string; username: string; sessionId: string } | null> {
  try {
    // Get all Instagram cookies  
    const cookies = await chrome.cookies.getAll({ domain: '.instagram.com' });
    
    let userId = '';
    let sessionId = '';
    let username = '';
    
    for (const cookie of cookies) {
      if (cookie.name === 'ds_user_id') userId = cookie.value;
      if (cookie.name === 'sessionid') sessionId = cookie.value;
      if (cookie.name === 'ds_user') username = cookie.value;
    }
    
    if (!userId && !sessionId) {
      console.log('[Boostify IG] No Instagram session cookies found — user not logged in?');
      return null;
    }
    
    console.log('[Boostify IG] Cookies found: userId=' + userId + ', username=' + (username || '(not in cookie)') + ', hasSession=' + !!sessionId);
    
    // If we have username from cookie, we're done
    if (username && userId) {
      return { userId, username, sessionId };
    }
    
    // If we have userId but no username, fetch it from Instagram's API
    if (userId && sessionId) {
      try {
        const resp = await fetch(`https://i.instagram.com/api/v1/users/${userId}/info/`, {
          headers: {
            'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B)',
            'X-IG-App-ID': '936619743392459',
          },
        });
        if (resp.ok) {
          const json = await resp.json();
          const user = json?.user;
          if (user?.username) {
            console.log('[Boostify IG] Got username from API: @' + user.username);
            return { userId, username: user.username, sessionId };
          }
        }
      } catch (e) {
        console.log('[Boostify IG] User info API failed:', e);
      }
    }
    
    return userId ? { userId, username: username || '', sessionId } : null;
  } catch (e) {
    console.warn('[Boostify IG] Cookie detection failed:', e);
    return null;
  }
}

/**
 * Auto-detect and sync the Instagram user on extension startup/install.
 * Runs completely in the background — no content script needed.
 */
async function autoDetectAndSync() {
  console.log('[Boostify IG] Running cookie-based auto-detection...');
  
  const cookieUser = await detectUserViaCookies();
  if (!cookieUser?.username) {
    console.log('[Boostify IG] No username from cookies, will retry when content script loads');
    return;
  }
  
  const username = cookieUser.username;
  console.log('[Boostify IG] Auto-detected: @' + username);
  
  // Store for popup to read
  await setStorage('boostify_ig_logged_in_user', { username, profilePicUrl: '' });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_CONNECTED });
  chrome.action.setBadgeText({ text: '✓' });
  
  // Update server with the real username
  try {
    const conn = await getConnectionInfo();
    if (conn?.syncToken) {
      const { updateConnectionUsername } = await import('../shared/api-client');
      await updateConnectionUsername(username, '');
      console.log('[Boostify IG] Server username updated to @' + username);
    }
  } catch {}
  
  // Fetch full profile data
  if (!cachedProfile || cachedProfile.followers === 0) {
    const profile = await fetchProfileFromBackground(username);
    if (profile) {
      cachedProfile = profile;
      // Also store the profile pic URL
      await setStorage('boostify_ig_logged_in_user', { username, profilePicUrl: profile.profilePicUrl || '' });
      console.log('[Boostify IG] Profile fetched: @' + username + ' | ' + profile.followers + ' followers');
      // Trigger sync
      await performSync().catch(() => {});
    }
  }
}

// ============================================================
// Installation & Startup
// ============================================================
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Boostify IG] Extension installed:', details.reason);

  // Set up alarms
  chrome.alarms.create(ALARM_SYNC_STATS, { periodInMinutes: SYNC_INTERVAL_MINUTES });
  chrome.alarms.create(ALARM_CHECK_TRENDS, { periodInMinutes: 360 }); // 6 hours

  // Set default badge
  chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
  chrome.action.setBadgeText({ text: '' });
  
  // Auto-detect user from Instagram cookies
  setTimeout(() => autoDetectAndSync(), 2000);
});

// Also run on service worker startup (not just install)
autoDetectAndSync();

// ============================================================
// Alarm handlers
// ============================================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_SYNC_STATS) {
    // Try cookie-based detection before each sync in case the user changed
    if (!cachedProfile || cachedProfile.followers === 0) {
      await autoDetectAndSync().catch(() => {});
    }
    await performSync();
  } else if (alarm.name === ALARM_CHECK_TRENDS) {
    await checkTrends();
  } else if (alarm.name === 'boostify_scheduled_extraction') {
    // Run the scheduled extraction
    const config = await getStorage<any>('boostify_scheduled_config');
    if (config) {
      console.log('[Boostify IG] Running scheduled extraction:', config.extractType);
      await startExtraction({
        ...config,
        enrichProfiles: config.enrichProfiles || false,
      });
    }
  }
});

// ============================================================
// Message handling from content scripts / popup / sidepanel
// ============================================================
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    console.error('[Boostify IG] Message error:', err);
    sendResponse({ error: err.message });
  });
  return true; // async response
});

async function handleMessage(message: MessageType, _sender: chrome.runtime.MessageSender): Promise<any> {
  switch (message.type) {
    case 'GET_CONNECTION_STATUS': {
      const conn = await getConnectionInfo();
      return { connected: !!conn, connection: conn };
    }

    case 'SYNC_NOW': {
      return performSync();
    }

    case 'PROFILE_DATA_EXTRACTED': {
      return handleProfileExtracted(message.data);
    }

    case 'POST_DATA_EXTRACTED': {
      return handlePostsExtracted(message.data);
    }

    case 'DISCONNECT': {
      const { clearConnectionInfo } = await import('../shared/storage');
      const { disconnectExtension } = await import('../shared/api-client');
      try { await disconnectExtension(); } catch { /* ignore */ }
      await clearConnectionInfo();
      chrome.action.setBadgeText({ text: '' });
      return { success: true };
    }

    case 'GET_PENDING_ACTIONS': {
      const conn = await getConnectionInfo();
      if (!conn) return { actions: [] };
      const result = await getPendingActions();
      return result;
    }

    case 'LOGGED_IN_USER_DETECTED': {
      const detectedUsername = message.data?.username || message.username;
      const detectedPic = message.data?.profilePic || message.profilePicUrl || '';
      // Cache the detected logged-in Instagram user
      await setStorage('boostify_ig_logged_in_user', { username: detectedUsername, profilePicUrl: detectedPic });
      // Update badge to show connected
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_CONNECTED });
      chrome.action.setBadgeText({ text: '✓' });
      console.log('[Boostify IG] Logged-in user detected:', detectedUsername);
      
      // Update the server connection record with the real username
      try {
        const conn = await getConnectionInfo();
        if (conn?.syncToken && detectedUsername && detectedUsername !== 'unknown') {
          const { updateConnectionUsername } = await import('../shared/api-client');
          await updateConnectionUsername(detectedUsername, detectedPic);
          console.log('[Boostify IG] Server username updated to @' + detectedUsername);
          
          // Immediately fetch profile data from background and sync
          // This is the KEY step — background fetch is reliable even when content script fails
          if (!cachedProfile || cachedProfile.followers === 0) {
            const bgProfile = await fetchProfileFromBackground(detectedUsername);
            if (bgProfile) {
              cachedProfile = bgProfile;
              console.log('[Boostify IG] Background profile fetch on detection: @' + bgProfile.username,
                '| Followers:', bgProfile.followers, '| Following:', bgProfile.following);
              // Trigger immediate sync with the fresh data
              performSync().catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('[Boostify IG] Failed to update username on server:', err);
      }
      return { success: true };
    }

    case 'GET_LOGGED_IN_USER': {
      let user = await getStorage<{ username: string; profilePicUrl: string }>('boostify_ig_logged_in_user');
      // If no user in storage, try cookie detection on-demand
      if (!user?.username || user.username === 'unknown') {
        const cookieUser = await detectUserViaCookies();
        if (cookieUser?.username) {
          user = { username: cookieUser.username, profilePicUrl: '' };
          await setStorage('boostify_ig_logged_in_user', user);
          // Also trigger full profile fetch in background
          autoDetectAndSync().catch(() => {});
        }
      }
      return { user };
    }

    case 'OPEN_SIDE_PANEL': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && chrome.sidePanel?.open) {
        try {
          chrome.sidePanel.open({ tabId: tab.id });
        } catch (e) {
          console.warn('[Boostify IG] sidePanel not supported:', e);
        }
      }
      return { success: true };
    }

    case 'START_EXTRACTION': {
      return startExtraction(message);
    }

    case 'CANCEL_EXTRACTION': {
      return cancelExtraction();
    }

    case 'GET_EXTRACTION_STATUS': {
      const job = await getStorage<ExtractionJob>('boostify_extraction_job');
      return { job };
    }

    case 'EXTRACTION_PROGRESS': {
      const currentJob = await getStorage<ExtractionJob>('boostify_extraction_job');
      if (currentJob && (currentJob.status === 'running' || currentJob.status === 'enriching')) {
        if (message.phase === 'enriching') {
          currentJob.status = 'enriching';
          currentJob.enrichProgress = message.count;
        } else {
          currentJob.progress = message.count;
          currentJob.total = message.total;
        }
        if (message.currentUser) {
          (currentJob as any).currentUser = message.currentUser;
        }
        await setStorage('boostify_extraction_job', currentJob);
      }
      return { success: true };
    }

    case 'EXTRACTION_COMPLETE': {
      const completedJob = await getStorage<ExtractionJob>('boostify_extraction_job');
      if (completedJob) {
        completedJob.status = 'completed';
        completedJob.results = message.results;
        completedJob.progress = message.results.length;
        completedJob.completedAt = new Date().toISOString();
        await setStorage('boostify_extraction_job', completedJob);
        // Also save to extraction history
        const history = (await getStorage<ExtractionJob[]>('boostify_extraction_history')) || [];
        history.unshift(completedJob);
        await setStorage('boostify_extraction_history', history.slice(0, 20));

        // Check if this was a scheduled job — schedule the next run
        if (completedJob.isScheduled && completedJob.intervalMinutes) {
          scheduleNextExtraction(completedJob);
        }
      }
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
      chrome.action.setBadgeText({ text: String(message.results.length) });

      // Auto-save extraction to server database (new profiles table)
      try {
        const { saveExtractedProfiles } = await import('../shared/api-client');
        await saveExtractedProfiles({
          extractType: completedJob?.type || 'followers',
          query: completedJob?.query,
          users: message.results || [],
          jobId: completedJob?.id,
        });
        console.log('[Boostify IG] Extracted profiles saved to server DB');
      } catch (err) {
        console.warn('[Boostify IG] Failed to save profiles to server:', err);
      }
      return { success: true };
    }

    case 'EXTRACTION_ERROR': {
      const failedJob = await getStorage<ExtractionJob>('boostify_extraction_job');
      if (failedJob) {
        failedJob.status = 'failed';
        failedJob.error = message.error;
        failedJob.completedAt = new Date().toISOString();
        await setStorage('boostify_extraction_job', failedJob);
      }
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_ERROR });
      chrome.action.setBadgeText({ text: '!' });
      return { success: true };
    }

    case 'SCHEDULE_EXTRACTION': {
      return scheduleExtraction(message);
    }

    case 'STOP_SCHEDULED_EXTRACTION': {
      chrome.alarms.clear('boostify_scheduled_extraction');
      const scheduledJob = await getStorage<ExtractionJob>('boostify_extraction_job');
      if (scheduledJob) {
        scheduledJob.isScheduled = false;
        scheduledJob.nextRunAt = undefined;
        await setStorage('boostify_extraction_job', scheduledJob);
      }
      return { success: true, message: 'Scheduled extraction stopped' };
    }

    case 'GET_EXTRACTION_RESULTS': {
      const results = await getStorage<ExtractionJob>('boostify_extraction_job');
      const history = (await getStorage<ExtractionJob[]>('boostify_extraction_history')) || [];
      return { current: results, history };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// ============================================================
// Extraction management
// ============================================================

async function startExtraction(message: any): Promise<any> {
  const job: ExtractionJob = {
    id: `ext_${Date.now()}`,
    type: message.extractType,
    query: message.query,
    sortMode: message.sortMode,
    maxUsers: message.maxUsers || 500,
    enrichProfiles: message.enrichProfiles || false,
    status: 'running',
    progress: 0,
    total: message.maxUsers || 500,
    enrichProgress: 0,
    results: [],
    startedAt: new Date().toISOString(),
    isScheduled: false,
    warningsCount: 0,
    sessionProfileCount: 0,
  };

  await setStorage('boostify_extraction_job', job);
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_SYNCING });
  chrome.action.setBadgeText({ text: '⟳' });

  // Find ANY Instagram tab
  let igTabs = await chrome.tabs.query({ url: '*://www.instagram.com/*' });
  if (!igTabs.length) {
    job.status = 'failed';
    job.error = 'No Instagram tab found. Open instagram.com first.';
    await setStorage('boostify_extraction_job', job);
    return { success: false, error: job.error };
  }

  const preferredTabId = message.tabId;
  let tab = preferredTabId ? igTabs.find(t => t.id === preferredTabId) : null;
  if (!tab) tab = igTabs[0];
  const tabId = tab.id!;

  // Wait for content script to be ready (retry up to 10 times)
  let contentScriptReady = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const pong = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (pong?.pong) { contentScriptReady = true; break; }
    } catch {}
    console.log(`[Boostify IG] Waiting for content script... attempt ${attempt + 1}`);
    await new Promise(r => setTimeout(r, 1500));
  }

  if (!contentScriptReady) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['assets/instagram-main.ts-D3XTF_R1.js'],
      });
      await new Promise(r => setTimeout(r, 2000));
    } catch (injectErr) {
      console.warn('[Boostify IG] Could not inject content script:', injectErr);
    }
    try {
      const pong = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (pong?.pong) contentScriptReady = true;
    } catch {}
  }

  if (!contentScriptReady) {
    job.status = 'failed';
    job.error = 'Content script not loaded. Please refresh the Instagram tab and try again.';
    await setStorage('boostify_extraction_job', job);
    return { success: false, error: job.error };
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'START_EXTRACTION',
      extractType: message.extractType,
      query: message.query,
      sortMode: message.sortMode,
      maxUsers: message.maxUsers || 500,
      enrichProfiles: message.enrichProfiles || false,
      banProtection: message.banProtection,
    });
    return { success: true, jobId: job.id };
  } catch (err: any) {
    job.status = 'failed';
    job.error = err.message;
    await setStorage('boostify_extraction_job', job);
    return { success: false, error: err.message };
  }
}

// Schedule an extraction to run at intervals
async function scheduleExtraction(message: any): Promise<any> {
  const intervalMinutes = message.intervalMinutes || 5;
  
  // Store the scheduled job config
  const scheduledConfig = {
    extractType: message.extractType,
    query: message.query,
    sortMode: message.sortMode,
    maxUsers: message.maxUsers || 100,
    enrichProfiles: message.enrichProfiles || false,
    banProtection: message.banProtection,
    intervalMinutes,
  };
  await setStorage('boostify_scheduled_config', scheduledConfig);

  // Create Chrome alarm
  chrome.alarms.create('boostify_scheduled_extraction', {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes,
  });

  // Update job status
  const job = await getStorage<ExtractionJob>('boostify_extraction_job');
  if (job) {
    job.isScheduled = true;
    job.intervalMinutes = intervalMinutes;
    job.nextRunAt = new Date(Date.now() + intervalMinutes * 60000).toISOString();
    await setStorage('boostify_extraction_job', job);
  }

  console.log(`[Boostify IG] Scheduled extraction every ${intervalMinutes} min`);
  return { success: true, intervalMinutes, nextRunAt: new Date(Date.now() + intervalMinutes * 60000).toISOString() };
}

// Schedule next run after completion
function scheduleNextExtraction(completedJob: ExtractionJob) {
  if (!completedJob.intervalMinutes) return;
  chrome.alarms.create('boostify_scheduled_extraction', {
    delayInMinutes: completedJob.intervalMinutes,
  });
  console.log(`[Boostify IG] Next extraction in ${completedJob.intervalMinutes} min`);
}

async function cancelExtraction(): Promise<any> {
  const job = await getStorage<ExtractionJob>('boostify_extraction_job');
  if (job && (job.status === 'running' || job.status === 'enriching')) {
    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    await setStorage('boostify_extraction_job', job);
  }

  // Send cancel to content script
  const igTabs = await chrome.tabs.query({ url: '*://www.instagram.com/*' });
  for (const tab of igTabs) {
    if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'CANCEL_EXTRACTION' }).catch(() => {});
  }

  chrome.action.setBadgeText({ text: '' });
  return { success: true };
}

// ============================================================
// Core sync logic
// ============================================================

// Cached profile data from content script
let cachedProfile: ExtractedProfileData | null = null;
let cachedPosts: ExtractedPostData[] = [];

async function handleProfileExtracted(data: ExtractedProfileData) {
  cachedProfile = data;
  console.log('[Boostify IG] Profile data cached:', data.username, 'Followers:', data.followers);
  return { success: true };
}

async function handlePostsExtracted(data: ExtractedPostData[]) {
  cachedPosts = data;
  console.log('[Boostify IG] Posts data cached:', data.length, 'posts');
  return { success: true };
}

/**
 * Fetch profile data directly from the background service worker.
 * The service worker can fetch instagram.com/username/ and parse the response.
 * This is the MOST RELIABLE method because:
 * - No content script needed
 * - No SPA rendering issues
 * - Instagram serves meta tags for SEO regardless of JS execution
 * - Service worker has no same-origin restrictions for reading responses
 */
async function fetchProfileFromBackground(username: string): Promise<ExtractedProfileData | null> {
  if (!username || username === 'unknown') return null;
  console.log('[Boostify IG] Background fetching profile for @' + username);
  
  try {
    // Method 1: Instagram's GraphQL API (most complete data)
    try {
      const apiResp = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
        headers: {
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });
      if (apiResp.ok) {
        const json = await apiResp.json();
        const user = json?.data?.user;
        if (user) {
          const data: ExtractedProfileData = {
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
          console.log('[Boostify IG] GraphQL API success:', data.followers, 'followers');
          return data;
        }
      }
    } catch (e) {
      console.log('[Boostify IG] GraphQL API failed, trying HTML...');
    }

    // Method 2: Fetch profile HTML page and parse meta/embedded data
    const resp = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!resp.ok) {
      console.log('[Boostify IG] Profile page fetch failed:', resp.status);
      return null;
    }
    const html = await resp.text();

    // Try embedded JSON data first (most reliable when present)
    const jsonPatterns = [
      /window\.__additionalDataLoaded\([^,]+,\s*(\{.*?\})\s*\);/s,
      /window\._sharedData\s*=\s*(\{.*?\});\s*<\/script>/s,
      /"user"\s*:\s*(\{"[^}]*"edge_followed_by"[^}]*\})/s,
    ];
    for (const pattern of jsonPatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const user = data?.graphql?.user || data?.user || data?.entry_data?.ProfilePage?.[0]?.graphql?.user || data;
          if (user && (user.edge_followed_by || user.follower_count)) {
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
        } catch { /* continue */ }
      }
    }

    // Try regex for individual fields in embedded JSON
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
        displayName: nameMatch?.[1]?.replace(/\\u[\da-fA-F]{4}/g, m => String.fromCharCode(parseInt(m.slice(2), 16))) || username,
        bio: bioMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\u[\da-fA-F]{4}/g, m => String.fromCharCode(parseInt(m.slice(2), 16))) || '',
        profileUrl: `https://www.instagram.com/${username}/`,
        profilePicUrl: picMatch?.[1]?.replace(/\\u0026/g, '&') || '',
        followers: parseInt(followersMatch[1]) || 0,
        following: parseInt(followingMatch?.[1] || '0') || 0,
        postsCount: parseInt(postsMatch?.[1] || '0') || 0,
        isVerified: verifiedMatch?.[1] === 'true',
        isPrivate: false,
        externalUrl: '',
        category: '',
      };
    }

    // Fallback: Parse meta description tag (Instagram ALWAYS includes this for SEO)
    // Format: "1,234 Followers, 567 Following, 89 Posts - See Instagram photos and videos from Name (@user)"
    const descMatch = html.match(/<meta\s+(?:name|property)="description"\s+content="([^"]+)"/i) 
      || html.match(/<meta\s+content="([^"]+)"\s+(?:name|property)="description"/i);
    if (descMatch) {
      const desc = descMatch[1];
      console.log('[Boostify IG] Meta description found:', desc.substring(0, 100));
      const statsMatch = desc.match(/([\d,.KkMm]+)\s*Followers?.*([\d,.KkMm]+)\s*Following.*([\d,.KkMm]+)\s*Posts?/i);
      if (statsMatch) {
        const parseNum = (s: string) => {
          const clean = s.replace(/,/g, '');
          const n = parseFloat(clean);
          if (/[Mm]/i.test(clean)) return Math.round(n * 1_000_000);
          if (/[Kk]/i.test(clean)) return Math.round(n * 1_000);
          return Math.round(n) || 0;
        };
        const nameFromDesc = desc.match(/from\s+(.+?)\s*\(@/)?.[1] || username;
        return {
          username,
          displayName: nameFromDesc,
          bio: '',
          profileUrl: `https://www.instagram.com/${username}/`,
          profilePicUrl: '',
          followers: parseNum(statsMatch[1]),
          following: parseNum(statsMatch[2]),
          postsCount: parseNum(statsMatch[3]),
          isVerified: false,
          isPrivate: false,
          externalUrl: '',
          category: '',
        };
      }
    }

    // Try og:description as last resort
    const ogDesc = html.match(/<meta\s+(?:property)="og:description"\s+content="([^"]+)"/i);
    if (ogDesc) {
      const desc = ogDesc[1];
      const statsMatch = desc.match(/([\d,.KkMm]+)\s*Followers?.*([\d,.KkMm]+)\s*Following.*([\d,.KkMm]+)\s*Posts?/i);
      if (statsMatch) {
        const parseNum = (s: string) => {
          const clean = s.replace(/,/g, '');
          const n = parseFloat(clean);
          if (/[Mm]/i.test(clean)) return Math.round(n * 1_000_000);
          if (/[Kk]/i.test(clean)) return Math.round(n * 1_000);
          return Math.round(n) || 0;
        };
        return {
          username,
          displayName: username,
          bio: '',
          profileUrl: `https://www.instagram.com/${username}/`,
          profilePicUrl: '',
          followers: parseNum(statsMatch[1]),
          following: parseNum(statsMatch[2]),
          postsCount: parseNum(statsMatch[3]),
          isVerified: false,
          isPrivate: false,
          externalUrl: '',
          category: '',
        };
      }
    }

    console.log('[Boostify IG] Could not parse profile data from HTML');
    return null;
  } catch (err) {
    console.error('[Boostify IG] Background profile fetch error:', err);
    return null;
  }
}

async function performSync(): Promise<any> {
  const conn = await getConnectionInfo();
  if (!conn) {
    console.log('[Boostify IG] Not connected, skipping sync');
    return { success: false, reason: 'not_connected' };
  }

  const settings = await getSettings();
  if (!settings.syncEnabled) {
    return { success: false, reason: 'sync_disabled' };
  }

  try {
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_SYNCING });
    chrome.action.setBadgeText({ text: '⟳' });

    // Get the detected username
    const loggedInUser = await getStorage<{ username: string; profilePicUrl: string }>('boostify_ig_logged_in_user');
    const username = loggedInUser?.username || cachedProfile?.username;

    // If cachedProfile is empty or has zero followers, try fetching from background
    if (username && username !== 'unknown' && (!cachedProfile || cachedProfile.followers === 0)) {
      console.log('[Boostify IG] No cached profile data, fetching from background...');
      const bgProfile = await fetchProfileFromBackground(username);
      if (bgProfile) {
        cachedProfile = bgProfile;
        console.log('[Boostify IG] Background fetch SUCCESS: @' + bgProfile.username, 
          'Followers:', bgProfile.followers, 'Following:', bgProfile.following, 'Posts:', bgProfile.postsCount);
      }
    }

    // Compute engagement metrics
    let avgLikes = 0, avgComments = 0, engagementRate = 0;
    if (cachedPosts.length > 0) {
      avgLikes = cachedPosts.reduce((sum, p) => sum + p.likes, 0) / cachedPosts.length;
      avgComments = cachedPosts.reduce((sum, p) => sum + p.comments, 0) / cachedPosts.length;
      if (cachedProfile && cachedProfile.followers > 0) {
        engagementRate = ((avgLikes + avgComments) / cachedProfile.followers) * 100;
      }
    }

    // Extract top hashtags
    const hashtagCounts: Record<string, number> = {};
    cachedPosts.forEach(p => {
      p.hashtags.forEach(h => { hashtagCounts[h] = (hashtagCounts[h] || 0) + 1; });
    });
    const topHashtags = Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag]) => tag);

    const syncPayload = {
      followers: cachedProfile?.followers || 0,
      following: cachedProfile?.following || 0,
      postsCount: cachedProfile?.postsCount || 0,
      bio: cachedProfile?.bio || '',
      isVerified: cachedProfile?.isVerified || false,
      instagramUsername: username || undefined,
      avgLikes,
      avgComments,
      engagementRate,
      recentPosts: cachedPosts.slice(0, 12).map(p => ({
        postId: p.postId,
        caption: p.caption.substring(0, 200),
        likes: p.likes,
        comments: p.comments,
        type: p.type,
        timestamp: p.timestamp,
      })),
      topHashtags,
    };

    console.log('[Boostify IG] Syncing to server:', {
      username: syncPayload.instagramUsername,
      followers: syncPayload.followers,
      following: syncPayload.following,
      posts: syncPayload.postsCount,
    });

    const result = await syncStats(syncPayload);

    // Cache pending actions
    if (result.pendingActions?.length > 0) {
      await saveCachedActions(result.pendingActions);
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_PENDING });
      chrome.action.setBadgeText({ text: String(result.pendingActions.length) });
    } else {
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_CONNECTED });
      chrome.action.setBadgeText({ text: '✓' });
    }

    await updateLastSync();
    console.log('[Boostify IG] Sync complete. Snapshot:', result.snapshotId,
      '| Followers sent:', syncPayload.followers);
    return { success: true, ...result };

  } catch (error: any) {
    console.error('[Boostify IG] Sync failed:', error);
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_ERROR });
    chrome.action.setBadgeText({ text: '!' });
    return { success: false, error: error.message };
  }
}

async function checkTrends(): Promise<void> {
  const conn = await getConnectionInfo();
  if (!conn) return;

  const settings = await getSettings();
  if (!settings.showNotifications) return;

  try {
    // Send a trend check event
    await sendWebhookEvent({
      eventType: 'profile_update',
      eventData: { type: 'trend_check', timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[Boostify IG] Trend check failed:', error);
  }
}

// ============================================================
// Side panel handling
// ============================================================
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('instagram.com')) {
    // Enable side panel on Instagram tabs (only if API available)
    if (chrome.sidePanel?.setOptions) {
      try {
        chrome.sidePanel.setOptions({
          tabId,
          path: 'sidepanel.html',
          enabled: true,
        });
      } catch (e) {
        console.warn('[Boostify IG] sidePanel not supported:', e);
      }
    }
  }
});
