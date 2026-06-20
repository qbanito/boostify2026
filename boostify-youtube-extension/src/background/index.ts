// Boostify YouTube Extension — Background Service Worker
// This is the brain of the extension. It runs permanently and orchestrates:
// - Periodic channel stats sync
// - Action queue processing
// - Notifications
// - Communication between popup, content scripts, and Boostify API

import { ALARM_SYNC_STATS, ALARM_CHECK_TRENDS, BADGE_COLOR_CONNECTED, BADGE_COLOR_SYNCING, BADGE_COLOR_ERROR, BADGE_COLOR_PENDING, SYNC_INTERVAL_MINUTES, TREND_CHECK_HOURS } from '../shared/constants';
import { getConnectionInfo, updateLastSync, saveCachedActions, getCachedActions } from '../shared/storage';
import { syncStats, getPendingActions, reportActionResult, sendWebhookEvent } from '../shared/api-client';
import type { PendingAction, ExtMessage, SyncStatsMessage, ActionAppliedMessage, NewVideoDetectedMessage } from '../shared/types';

console.log('🚀 Boostify YouTube Extension — Background Service Worker started');

// ============================================================
// ALARM SETUP — Periodic tasks
// ============================================================
chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 Extension installed/updated');
  
  // Set up periodic sync alarm
  chrome.alarms.create(ALARM_SYNC_STATS, {
    delayInMinutes: 1,
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  
  // Set up trend check alarm
  chrome.alarms.create(ALARM_CHECK_TRENDS, {
    delayInMinutes: 10,
    periodInMinutes: TREND_CHECK_HOURS * 60,
  });
  
  // Set badge
  updateBadge();
});

// ============================================================
// ALARM HANDLER — Execute periodic tasks
// ============================================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`⏰ Alarm fired: ${alarm.name}`);
  
  switch (alarm.name) {
    case ALARM_SYNC_STATS:
      await performSync();
      break;
    case ALARM_CHECK_TRENDS:
      await checkTrends();
      break;
  }
});

// ============================================================
// MESSAGE HANDLER — Communication with popup & content scripts
// ============================================================
chrome.runtime.onMessage.addListener((message: ExtMessage, sender, sendResponse) => {
  console.log(`📨 Message received: ${message.type}`, message.data);
  
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
    });
  
  return true; // Keep channel open for async response
});

async function handleMessage(message: ExtMessage, sender: chrome.runtime.MessageSender): Promise<any> {
  switch (message.type) {
    case 'SYNC_STATS':
      return handleSyncStats(message as SyncStatsMessage);
    
    case 'ACTION_APPLIED':
      return handleActionApplied(message as ActionAppliedMessage);
    
    case 'NEW_VIDEO_DETECTED':
      return handleNewVideoDetected(message as NewVideoDetectedMessage);
    
    case 'GET_STATUS':
      return getExtensionStatus();
    
    case 'FORCE_SYNC':
      return performSync();
    
    case 'GET_CACHED_ACTIONS':
      return getCachedActions();
    
    case 'PAGE_CHANGED':
      // Content script is telling us the page changed
      return { received: true };
    
    default:
      console.log(`Unknown message type: ${message.type}`);
      return { error: 'Unknown message type' };
  }
}

// ============================================================
// SYNC — Send channel stats to Boostify
// ============================================================
async function performSync(): Promise<SyncResponse | null> {
  const conn = await getConnectionInfo();
  if (!conn) {
    console.log('⏭️ Sync skipped: not connected');
    return null;
  }
  
  try {
    setBadgeState('syncing');
    
    // Try to get stats from an open YouTube tab
    const stats = await getStatsFromContentScript();
    
    if (stats) {
      const response = await syncStats(stats);
      
      // Cache pending actions
      if (response.pendingActions?.length > 0) {
        await saveCachedActions(response.pendingActions);
        setBadgeState('pending', response.pendingActions.length);
        
        // Notify popup if open
        chrome.runtime.sendMessage({
          type: 'ACTIONS_UPDATED',
          data: response.pendingActions,
        }).catch(() => {}); // Popup might not be open
      } else {
        setBadgeState('connected');
      }
      
      await updateLastSync();
      console.log(`✅ Sync complete: snapshot #${response.snapshotId}, ${response.pendingActions?.length || 0} pending actions`);
      return response;
    } else {
      // No YouTube tab open — sync with minimal data
      console.log('ℹ️ No YouTube tab open, skipping data extraction');
      setBadgeState('connected');
      return null;
    }
  } catch (error) {
    console.error('❌ Sync failed:', error);
    setBadgeState('error');
    return null;
  }
}

interface SyncResponse {
  success: boolean;
  snapshotId: number;
  pendingActions: PendingAction[];
  nextSyncInMinutes: number;
}

/**
 * Try to get stats from a content script in an open YouTube tab
 */
async function getStatsFromContentScript(): Promise<any | null> {
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://www.youtube.com/*', 'https://studio.youtube.com/*'],
    });
    
    if (tabs.length === 0) return null;
    
    // Try studio first (has better data)
    const studioTab = tabs.find(t => t.url?.includes('studio.youtube.com'));
    const targetTab = studioTab || tabs[0];
    
    if (!targetTab.id) return null;
    
    const response = await chrome.tabs.sendMessage(targetTab.id, {
      type: 'EXTRACT_STATS',
    });
    
    return response?.data || null;
  } catch {
    return null;
  }
}

// ============================================================
// HANDLERS — Process specific message types
// ============================================================

async function handleSyncStats(message: SyncStatsMessage) {
  try {
    const response = await syncStats(message.data);
    if (response.pendingActions?.length > 0) {
      await saveCachedActions(response.pendingActions);
      setBadgeState('pending', response.pendingActions.length);
    }
    await updateLastSync();
    return { success: true, ...response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleActionApplied(message: ActionAppliedMessage) {
  try {
    const result = await reportActionResult(message.data);
    
    // Remove from cached actions
    const cached = await getCachedActions();
    const updated = cached.filter(a => a.id !== message.data.actionId);
    await saveCachedActions(updated);
    
    if (updated.length > 0) {
      setBadgeState('pending', updated.length);
    } else {
      setBadgeState('connected');
    }
    
    return { success: true, ...result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleNewVideoDetected(message: NewVideoDetectedMessage) {
  try {
    // Send event to Boostify API
    await sendWebhookEvent({
      eventType: 'video_published',
      eventData: message.data,
    });
    
    // Show notification
    const conn = await getConnectionInfo();
    if (conn) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icon-128.png'),
        title: 'New Video Detected!',
        message: `"${message.data.title}" — Boostify is generating optimization suggestions...`,
      });
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// TRENDS — Check for trending topics
// ============================================================
async function checkTrends(): Promise<void> {
  const conn = await getConnectionInfo();
  if (!conn) return;
  
  // This would call the Boostify API to check trends
  // For now, just log that we checked
  console.log('🔥 Trend check performed');
}

// ============================================================
// STATUS — Get current extension status
// ============================================================
async function getExtensionStatus() {
  const conn = await getConnectionInfo();
  const actions = await getCachedActions();
  
  return {
    connected: !!conn,
    connection: conn,
    pendingActionsCount: actions.length,
    pendingActions: actions.slice(0, 5), // Return top 5
  };
}

// ============================================================
// BADGE — Visual indicator on the extension icon
// ============================================================
function setBadgeState(state: 'connected' | 'syncing' | 'error' | 'pending', count?: number) {
  switch (state) {
    case 'connected':
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_CONNECTED });
      chrome.action.setBadgeText({ text: '✓' });
      break;
    case 'syncing':
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_SYNCING });
      chrome.action.setBadgeText({ text: '...' });
      break;
    case 'error':
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_ERROR });
      chrome.action.setBadgeText({ text: '!' });
      break;
    case 'pending':
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_PENDING });
      chrome.action.setBadgeText({ text: String(count || '') });
      break;
  }
}

async function updateBadge() {
  const conn = await getConnectionInfo();
  if (!conn) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  
  const actions = await getCachedActions();
  if (actions.length > 0) {
    setBadgeState('pending', actions.length);
  } else {
    setBadgeState('connected');
  }
}

// ============================================================
// NOTIFICATION CLICK HANDLER
// ============================================================
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open Boostify dashboard in a new tab
  chrome.tabs.create({ url: 'https://boostifymusic.com/youtube-views' });
});

// ============================================================
// TAB UPDATE LISTENER — Detect YouTube navigation
// ============================================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('youtube.com') || tab.url.includes('studio.youtube.com')) {
      // Side panel available on YouTube pages
      chrome.sidePanel.setOptions({
        tabId,
        path: 'sidepanel.html',
        enabled: true,
      }).catch(() => {});
    }
  }
});
