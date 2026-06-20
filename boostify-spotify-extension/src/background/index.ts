import { loadToken, syncStats, updateUsername, saveExtraction } from '../shared/api-client';
import type { SpotifyProfile } from '../shared/types';

let cachedProfile: SpotifyProfile | null = null;
let loggedInUser: { username: string; displayName: string; profilePicUrl: string } | null = null;

// Auto-detect Spotify user from cookies
async function autoDetectUser() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: '.spotify.com' });
    const spDc = cookies.find(c => c.name === 'sp_dc');
    if (!spDc) { console.log('[Boostify SP] No sp_dc cookie — user not logged in'); return; }

    // Try to get user info from Spotify's internal API
    try {
      const r = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${spDc.value}` }
      });
      if (r.ok) {
        const data = await r.json();
        loggedInUser = {
          username: data.id || data.display_name,
          displayName: data.display_name || data.id,
          profilePicUrl: data.images?.[0]?.url || '',
        };
      }
    } catch {}

    // Fallback: try web player internal endpoint
    if (!loggedInUser) {
      try {
        // Get access token from web player
        const tokenRes = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player');
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.accessToken) {
            const meRes = await fetch('https://api.spotify.com/v1/me', {
              headers: { 'Authorization': `Bearer ${tokenData.accessToken}` }
            });
            if (meRes.ok) {
              const data = await meRes.json();
              loggedInUser = {
                username: data.id,
                displayName: data.display_name || data.id,
                profilePicUrl: data.images?.[0]?.url || '',
              };
              // Fetch extended profile
              await fetchProfileWithToken(tokenData.accessToken, data.id);
            }
          }
        }
      } catch (e) {
        console.log('[Boostify SP] Token fetch failed:', e);
      }
    }

    if (loggedInUser) {
      console.log(`[Boostify SP] Detected: @${loggedInUser.username}`);
      await chrome.storage.local.set({ detectedUser: loggedInUser });
      await updateUsername({
        spotifyUsername: loggedInUser.username,
        displayName: loggedInUser.displayName,
        spotifyImageUrl: loggedInUser.profilePicUrl,
      }).catch(() => {});
      
      // Trigger sync if we have profile data
      if (cachedProfile) await performSync();
    }
  } catch (e) {
    console.log('[Boostify SP] Auto-detect error:', e);
  }
}

async function fetchProfileWithToken(token: string, userId: string) {
  try {
    // Get artist profile (for artists) or user profile
    const [artistRes, playlistRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`https://api.spotify.com/v1/me/playlists?limit=1`, { headers: { 'Authorization': `Bearer ${token}` } }),
    ]);

    const plData = playlistRes.ok ? await playlistRes.json() : null;

    cachedProfile = {
      username: userId,
      displayName: loggedInUser?.displayName || userId,
      profilePicUrl: loggedInUser?.profilePicUrl || '',
      monthlyListeners: 0, // Only available for artist accounts
      followers: 0,
      playlistCount: plData?.total || 0,
      totalStreams: 0,
      topCities: [],
      isVerified: false,
      genres: [],
    };

    // Try to get follower count
    try {
      const followRes = await fetch(`https://api.spotify.com/v1/users/${userId}/followers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (followRes.ok) {
        const fData = await followRes.json();
        cachedProfile.followers = fData.total || 0;
      }
    } catch {}

    console.log(`[Boostify SP] Profile loaded: ${cachedProfile.followers} followers, ${cachedProfile.playlistCount} playlists`);
  } catch (e) {
    console.log('[Boostify SP] Profile fetch error:', e);
  }
}

async function performSync() {
  try {
    await loadToken();
    if (!cachedProfile && !loggedInUser) return;

    const data = {
      monthlyListeners: cachedProfile?.monthlyListeners || 0,
      followers: cachedProfile?.followers || 0,
      playlistCount: cachedProfile?.playlistCount || 0,
      totalStreams: cachedProfile?.totalStreams || 0,
      topCities: cachedProfile?.topCities || [],
      spotifyUsername: loggedInUser?.username || cachedProfile?.username,
      displayName: loggedInUser?.displayName || cachedProfile?.displayName,
      spotifyImageUrl: loggedInUser?.profilePicUrl || cachedProfile?.profilePicUrl,
    };

    await syncStats(data);
    console.log('[Boostify SP] Sync complete');
  } catch (e) {
    console.log('[Boostify SP] Sync error:', e);
  }
}

// Install handler
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Boostify SP] Extension installed');
  chrome.alarms.create('spotify-sync', { periodInMinutes: 5 });
  autoDetectUser();
});

// Startup handler
chrome.runtime.onStartup?.addListener(() => {
  autoDetectUser();
});

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'spotify-sync') {
    autoDetectUser().then(() => performSync());
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case 'CONNECT': {
        const { token } = message;
        const { saveToken } = await import('../shared/api-client');
        await saveToken(token);
        await autoDetectUser();
        return { success: true };
      }

      case 'SYNC_NOW': {
        await autoDetectUser();
        await performSync();
        return { success: true };
      }

      case 'GET_STATUS': {
        const data = await chrome.storage.local.get(['syncToken', 'detectedUser']);
        return {
          connected: !!data.syncToken,
          user: data.detectedUser || null,
          profile: cachedProfile,
        };
      }

      case 'GET_LOGGED_IN_USER': {
        if (!loggedInUser) await autoDetectUser();
        return { user: loggedInUser };
      }

      case 'PROFILE_DETECTED': {
        cachedProfile = message.profile;
        if (message.username) {
          loggedInUser = {
            username: message.username,
            displayName: message.displayName || message.username,
            profilePicUrl: message.profilePicUrl || '',
          };
          await chrome.storage.local.set({ detectedUser: loggedInUser });
        }
        await performSync();
        return { success: true };
      }

      case 'PING': {
        return { pong: true };
      }

      case 'START_EXTRACTION': {
        // Find Spotify tab and relay extraction command
        const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });
        if (tabs.length === 0) return { error: 'No Spotify tab open' };
        
        const tab = tabs[0];
        if (!tab.id) return { error: 'Invalid tab' };

        chrome.tabs.sendMessage(tab.id, {
          type: 'START_EXTRACTION',
          extractType: message.extractType,
          query: message.query,
          maxResults: message.maxResults || 100,
        });
        return { success: true, tabId: tab.id };
      }

      case 'EXTRACTION_COMPLETE': {
        // Save to server
        if (message.results?.length > 0) {
          try {
            await saveExtraction({
              profiles: message.results,
              extractType: message.extractType,
              extractQuery: message.query,
            });
            console.log(`[Boostify SP] Saved ${message.results.length} extracted profiles`);
          } catch (e) {
            console.log('[Boostify SP] Save extraction error:', e);
          }
        }
        return { success: true };
      }

      default:
        return { error: 'Unknown message type' };
    }
  };

  handle().then(sendResponse).catch(e => sendResponse({ error: e.message }));
  return true; // Keep channel open for async response
});

console.log('[Boostify SP] Background service worker loaded');
