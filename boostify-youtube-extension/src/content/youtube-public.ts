// Boostify YouTube Extension — Content Script for youtube.com
// Injected into all youtube.com pages. Extracts data and injects UI elements.

import { extractChannelData, extractChannelVideos } from './extractors/channel-stats';
import { extractVideoData, extractComments } from './extractors/video-data';
import { observePageChanges, waitForElement } from './observers/page-change';
import { injectAnalyzeButton, removeAllBoostifyElements } from './injectors/boostify-badge';

console.log('🚀 Boostify YouTube Extension loaded on youtube.com');

// ============================================================
// PAGE CHANGE HANDLER
// ============================================================
const cleanup = observePageChanges(async (pageInfo) => {
  console.log(`[Boostify] Page changed: ${pageInfo.pageType}`, pageInfo.url);
  
  // Clean up previous injections
  removeAllBoostifyElements();
  
  // Notify background worker
  chrome.runtime.sendMessage({
    type: 'PAGE_CHANGED',
    data: pageInfo,
  }).catch(() => {});
  
  // Wait for page content to load
  await new Promise(r => setTimeout(r, 2000));
  
  switch (pageInfo.pageType) {
    case 'video':
      await handleVideoPage(pageInfo.videoId!);
      break;
    case 'channel':
      await handleChannelPage();
      break;
  }
});

// ============================================================
// VIDEO PAGE — Extract data & inject Boostify button
// ============================================================
async function handleVideoPage(videoId: string) {
  // Wait for video info to render
  await waitForElement('h1.ytd-watch-metadata, h1.ytd-video-primary-info-renderer', 5000);
  
  const videoData = extractVideoData();
  if (videoData) {
    console.log('[Boostify] Video data extracted:', videoData.title, `(${videoData.views} views)`);
    
    // Inject "Analyze in Boostify" button
    await waitForElement('#top-level-buttons-computed, #menu-container', 3000);
    injectAnalyzeButton(videoId);
  }
}

// ============================================================
// CHANNEL PAGE — Extract channel data & video list
// ============================================================
async function handleChannelPage() {
  await waitForElement('#channel-header, ytd-c4-tabbed-header-renderer', 5000);
  
  const channelData = extractChannelData();
  if (channelData) {
    console.log('[Boostify] Channel data extracted:', channelData.channelName, `(${channelData.subscribers} subs)`);
  }
}

// ============================================================
// MESSAGE HANDLER — Respond to background worker requests
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'EXTRACT_STATS':
      handleExtractStats().then(sendResponse).catch(() => sendResponse(null));
      return true;
    
    case 'EXTRACT_VIDEO':
      const videoData = extractVideoData();
      sendResponse({ data: videoData });
      return false;
    
    case 'GET_COMMENTS':
      const comments = extractComments(message.limit || 20);
      sendResponse({ data: comments });
      return false;
  }
});

/**
 * Extract comprehensive stats for the sync operation
 */
async function handleExtractStats() {
  const channelData = extractChannelData();
  const videoData = extractVideoData();
  const channelVideos = extractChannelVideos();
  
  const topVideos = channelVideos.map(v => ({
    videoId: v.videoId,
    title: v.title,
    views: v.views,
    ctr: 0,
  }));
  
  const recentUploads = channelVideos.slice(0, 10).map(v => ({
    videoId: v.videoId,
    title: v.title,
    publishedAt: v.publishedAt,
    views: v.views,
  }));
  
  return {
    data: {
      subscribers: channelData?.subscribers || 0,
      totalViews: channelData?.totalViews || 0,
      videoCount: channelData?.videoCount || channelVideos.length,
      topVideos,
      recentUploads,
    },
  };
}
