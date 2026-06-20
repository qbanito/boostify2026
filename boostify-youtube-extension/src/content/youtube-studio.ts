// Boostify YouTube Extension — Content Script for studio.youtube.com
// Injected into YouTube Studio. Extracts analytics, handles auto-fill actions.

import { extractStudioAnalytics, extractStudioVideoList, extractStudioVideoDetails } from './extractors/analytics';
import { autoFillTitle, autoFillDescription, autoFillTags, showApplyConfirmation } from './injectors/auto-fill';
import { observePageChanges, waitForElement } from './observers/page-change';
import type { PendingAction } from '../shared/types';

console.log('🚀 Boostify YouTube Extension loaded on YouTube Studio');

// ============================================================
// PAGE CHANGE HANDLER
// ============================================================
const cleanup = observePageChanges(async (pageInfo) => {
  console.log(`[Boostify Studio] Page changed: ${pageInfo.pageType}`, pageInfo.url);
  
  chrome.runtime.sendMessage({
    type: 'PAGE_CHANGED',
    data: pageInfo,
  }).catch(() => {});
  
  await new Promise(r => setTimeout(r, 2000));
  
  switch (pageInfo.pageType) {
    case 'studio':
      await handleStudioDashboard();
      break;
    case 'studio-video':
      await handleStudioVideoEdit(pageInfo.videoId!);
      break;
    case 'studio-content':
      await handleStudioContentList();
      break;
    case 'studio-analytics':
      await handleStudioAnalytics();
      break;
  }
});

// ============================================================
// STUDIO DASHBOARD
// ============================================================
async function handleStudioDashboard() {
  const analytics = extractStudioAnalytics();
  if (analytics) {
    console.log('[Boostify Studio] Dashboard analytics extracted:', analytics);
  }
}

// ============================================================
// VIDEO EDIT PAGE — Check for pending actions
// ============================================================
async function handleStudioVideoEdit(videoId: string) {
  await waitForElement('#title-textarea, #textbox[aria-label*="title"]', 5000);
  
  const details = extractStudioVideoDetails();
  if (details) {
    console.log(`[Boostify Studio] Editing video: "${details.title}" (${details.tags?.length || 0} tags)`);
  }
  
  // Check if there are pending actions for this video
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CACHED_ACTIONS' });
    const actions: PendingAction[] = response || [];
    const videoActions = actions.filter(a => a.targetVideoId === videoId);
    
    if (videoActions.length > 0) {
      console.log(`[Boostify Studio] ${videoActions.length} pending actions for this video`);
      showPendingActionsPanel(videoActions);
    }
  } catch {}
}

// ============================================================
// CONTENT LIST — Extract all videos
// ============================================================
async function handleStudioContentList() {
  await waitForElement('ytcp-video-row, [class*="video-list"]', 5000);
  
  const videos = extractStudioVideoList();
  console.log(`[Boostify Studio] Content list: ${videos.length} videos found`);
}

// ============================================================
// ANALYTICS PAGE — Extract analytics data for sync
// ============================================================
async function handleStudioAnalytics() {
  const analytics = extractStudioAnalytics();
  if (analytics) {
    console.log('[Boostify Studio] Analytics extracted:', analytics);
    
    // Sync analytics to Boostify
    chrome.runtime.sendMessage({
      type: 'SYNC_STATS',
      data: {
        subscribers: analytics.subscribers,
        totalViews: analytics.views,
        videoCount: 0,
        watchTimeHours: analytics.watchTimeMinutes / 60,
        avgViewDuration: analytics.avgViewDuration,
        topVideos: analytics.topVideos,
        trafficSources: analytics.trafficSources,
        demographics: analytics.demographics,
      },
    }).catch(() => {});
  }
}

// ============================================================
// PENDING ACTIONS PANEL — Show in Studio sidebar
// ============================================================
function showPendingActionsPanel(actions: PendingAction[]) {
  // Remove existing panel
  document.querySelector('#boostify-studio-panel')?.remove();
  
  const panel = document.createElement('div');
  panel.id = 'boostify-studio-panel';
  panel.className = 'boostify-studio-panel';
  
  const actionItems = actions.map(action => `
    <div class="boostify-action-item" data-action-id="${action.id}">
      <div class="boostify-action-type">${getActionIcon(action.actionType)} ${getActionLabel(action.actionType)}</div>
      <div class="boostify-action-detail">${getActionDetail(action)}</div>
      <div class="boostify-action-buttons">
        <button class="boostify-btn-sm boostify-btn-apply" data-action-id="${action.id}" data-action-type="${action.actionType}">Apply</button>
        <button class="boostify-btn-sm boostify-btn-skip" data-action-id="${action.id}">Skip</button>
      </div>
    </div>
  `).join('');
  
  panel.innerHTML = `
    <div class="boostify-panel-header">
      <span>🚀 Boostify Optimizations</span>
      <button class="boostify-panel-close" id="boostify-panel-close">✕</button>
    </div>
    <div class="boostify-panel-body">
      ${actionItems}
    </div>
  `;
  
  document.body.appendChild(panel);
  
  // Close button
  document.getElementById('boostify-panel-close')?.addEventListener('click', () => {
    panel.remove();
  });
  
  // Apply buttons
  panel.querySelectorAll('.boostify-btn-apply').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const actionId = parseInt((e.target as HTMLElement).getAttribute('data-action-id') || '0');
      const actionType = (e.target as HTMLElement).getAttribute('data-action-type') || '';
      const action = actions.find(a => a.id === actionId);
      if (!action) return;
      
      await applyAction(action);
    });
  });
  
  // Skip buttons
  panel.querySelectorAll('.boostify-btn-skip').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const actionId = parseInt((e.target as HTMLElement).getAttribute('data-action-id') || '0');
      
      chrome.runtime.sendMessage({
        type: 'ACTION_APPLIED',
        data: { actionId, status: 'cancelled', resultMessage: 'Skipped by user' },
      });
      
      (e.target as HTMLElement).closest('.boostify-action-item')?.remove();
    });
  });
}

// ============================================================
// APPLY ACTION — Execute an optimization action
// ============================================================
async function applyAction(action: PendingAction) {
  const payload = action.payload;
  let success = false;
  let message = '';
  
  switch (action.actionType) {
    case 'update_title':
      if (payload.newTitle) {
        showApplyConfirmation(
          'Update Video Title',
          `Change title to: "${payload.newTitle}"`,
          async () => {
            success = await autoFillTitle(payload.newTitle);
            reportResult(action.id, success);
          },
          () => reportResult(action.id, false, 'cancelled')
        );
        return;
      }
      break;
    
    case 'update_description':
      if (payload.newDescription) {
        success = await autoFillDescription(payload.newDescription);
        message = success ? 'Description updated' : 'Failed to update description';
      }
      break;
    
    case 'update_tags':
      if (payload.tags && Array.isArray(payload.tags)) {
        showApplyConfirmation(
          'Apply SEO Tags',
          `Add ${payload.tags.length} tags: ${payload.tags.slice(0, 5).join(', ')}${payload.tags.length > 5 ? '...' : ''}`,
          async () => {
            success = await autoFillTags(payload.tags);
            reportResult(action.id, success);
          },
          () => reportResult(action.id, false, 'cancelled')
        );
        return;
      }
      break;
    
    default:
      message = `Action type "${action.actionType}" not yet supported in auto-apply`;
  }
  
  reportResult(action.id, success, message);
}

function reportResult(actionId: number, success: boolean, message?: string) {
  chrome.runtime.sendMessage({
    type: 'ACTION_APPLIED',
    data: {
      actionId,
      status: success ? 'applied' : (message === 'cancelled' ? 'cancelled' : 'failed'),
      resultMessage: message || (success ? 'Applied successfully' : 'Failed to apply'),
    },
  }).catch(() => {});
}

// ============================================================
// HELPERS
// ============================================================
function getActionIcon(type: string): string {
  const icons: Record<string, string> = {
    update_title: '📝',
    update_tags: '🏷️',
    update_description: '📄',
    update_thumbnail: '🖼️',
    schedule_video: '📅',
    publish_video: '🚀',
    add_end_screen: '🎬',
    add_cards: '🃏',
  };
  return icons[type] || '⚡';
}

function getActionLabel(type: string): string {
  const labels: Record<string, string> = {
    update_title: 'Optimize Title',
    update_tags: 'Add SEO Tags',
    update_description: 'Update Description',
    update_thumbnail: 'New Thumbnail',
    schedule_video: 'Schedule Video',
    publish_video: 'Publish Video',
    add_end_screen: 'Add End Screen',
    add_cards: 'Add Cards',
  };
  return labels[type] || type;
}

function getActionDetail(action: PendingAction): string {
  const p = action.payload;
  switch (action.actionType) {
    case 'update_title': return `→ "${p.newTitle || 'Analyze & suggest'}"`;
    case 'update_tags': return `${(p.tags as string[])?.length || 0} tags to add`;
    case 'update_description': return 'AI-optimized description';
    default: return action.generatedBy || '';
  }
}

// ============================================================
// MESSAGE HANDLER
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'EXTRACT_STATS':
      const analytics = extractStudioAnalytics();
      sendResponse({
        data: analytics ? {
          subscribers: analytics.subscribers,
          totalViews: analytics.views,
          videoCount: 0,
          watchTimeHours: analytics.watchTimeMinutes / 60,
          avgViewDuration: analytics.avgViewDuration,
          topVideos: analytics.topVideos,
          trafficSources: analytics.trafficSources,
          demographics: analytics.demographics,
        } : null,
      });
      return false;
    
    case 'APPLY_ACTION':
      const action = message.action as PendingAction;
      applyAction(action);
      sendResponse({ received: true });
      return false;
    
    case 'GET_VIDEO_DETAILS':
      const details = extractStudioVideoDetails();
      sendResponse({ data: details });
      return false;
  }
});
