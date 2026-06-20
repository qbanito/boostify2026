// Boostify YouTube Extension — YouTube Studio Analytics Extractor
// Extracts analytics data from studio.youtube.com

import type { ExtractedStudioAnalytics, VideoStat } from '../../shared/types';

/**
 * Extract analytics from YouTube Studio dashboard
 */
export function extractStudioAnalytics(): ExtractedStudioAnalytics | null {
  try {
    // Studio uses Web Components extensively, data is harder to extract
    // We look for common patterns in the Studio DOM
    
    const analytics: ExtractedStudioAnalytics = {
      views: 0,
      watchTimeMinutes: 0,
      subscribers: 0,
      ctr: undefined,
      avgViewDuration: undefined,
      topVideos: [],
      trafficSources: {},
      demographics: {},
    };
    
    // Try to extract overview metrics cards
    const metricCards = document.querySelectorAll('ytcp-analytics-metric-card, .metric-card, [class*="metric"]');
    metricCards.forEach((card) => {
      const label = card.querySelector('.metric-label, .label, [class*="label"]')?.textContent?.trim().toLowerCase() || '';
      const value = card.querySelector('.metric-value, .value, [class*="value"]')?.textContent?.trim() || '0';
      
      if (label.includes('view')) {
        analytics.views = parseMetricValue(value);
      } else if (label.includes('watch time') || label.includes('tiempo')) {
        analytics.watchTimeMinutes = parseMetricValue(value);
      } else if (label.includes('subscriber') || label.includes('suscriptor')) {
        analytics.subscribers = parseMetricValue(value);
      } else if (label.includes('ctr') || label.includes('click')) {
        analytics.ctr = parseFloat(value.replace('%', '')) || undefined;
      } else if (label.includes('duration') || label.includes('duración')) {
        analytics.avgViewDuration = parseDurationToSeconds(value);
      } else if (label.includes('revenue') || label.includes('ingreso')) {
        analytics.revenue = parseMetricValue(value.replace(/[$€£]/g, ''));
      }
    });
    
    // Try to extract top videos table
    const videoRows = document.querySelectorAll('ytcp-video-row, [class*="video-row"], table tbody tr');
    videoRows.forEach((row) => {
      try {
        const titleEl = row.querySelector('.video-title, [class*="title"] a, td:first-child');
        const title = titleEl?.textContent?.trim() || '';
        
        const viewsEl = row.querySelector('[class*="views"], td:nth-child(2)');
        const views = parseMetricValue(viewsEl?.textContent?.trim() || '0');
        
        if (title) {
          analytics.topVideos.push({
            videoId: '', // Hard to extract from Studio DOM
            title,
            views,
            ctr: 0,
          });
        }
      } catch {}
    });
    
    return analytics;
  } catch (error) {
    console.error('[Boostify] Error extracting studio analytics:', error);
    return null;
  }
}

/**
 * Extract the list of videos from YouTube Studio Content page
 */
export function extractStudioVideoList(): Array<{
  videoId: string;
  title: string;
  status: string;
  views: number;
  comments: number;
  likes: number;
}> {
  const videos: Array<{
    videoId: string;
    title: string;
    status: string;
    views: number;
    comments: number;
    likes: number;
  }> = [];
  
  const rows = document.querySelectorAll('ytcp-video-row, [class*="video-list"] [class*="row"]');
  
  rows.forEach((row) => {
    try {
      const linkEl = row.querySelector('a[href*="/video/"]') as HTMLAnchorElement;
      const videoId = linkEl?.href?.match(/\/video\/([\w-]+)/)?.[1] || '';
      
      const titleEl = row.querySelector('#video-title, .video-title-text');
      const title = titleEl?.textContent?.trim() || '';
      
      const statusEl = row.querySelector('.video-visibility, [class*="visibility"]');
      const status = statusEl?.textContent?.trim() || 'unknown';
      
      // Metrics columns
      const metricCells = row.querySelectorAll('td, .cell, [class*="metric"]');
      const views = metricCells.length > 1 ? parseMetricValue(metricCells[1]?.textContent?.trim() || '0') : 0;
      const comments = metricCells.length > 2 ? parseMetricValue(metricCells[2]?.textContent?.trim() || '0') : 0;
      const likes = metricCells.length > 3 ? parseMetricValue(metricCells[3]?.textContent?.trim() || '0') : 0;
      
      if (videoId && title) {
        videos.push({ videoId, title, status, views, comments, likes });
      }
    } catch {}
  });
  
  return videos;
}

/**
 * Extract details from the video edit page in Studio
 */
export function extractStudioVideoDetails(): {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  visibility: string;
  scheduledAt?: string;
} | null {
  try {
    // Check if we're on a video edit page
    const urlMatch = window.location.href.match(/\/video\/([\w-]+)\/edit/);
    if (!urlMatch) return null;
    
    const videoId = urlMatch[1];
    
    // Title input
    const titleInput = document.querySelector('#title-textarea textarea, [name="title"]') as HTMLTextAreaElement;
    const title = titleInput?.value || '';
    
    // Description input
    const descInput = document.querySelector('#description-textarea textarea, [name="description"]') as HTMLTextAreaElement;
    const description = descInput?.value || '';
    
    // Tags
    const tagEls = document.querySelectorAll('.tag-chip, [class*="tag"] .chip-text');
    const tags: string[] = [];
    tagEls.forEach((el) => {
      const tag = el.textContent?.trim();
      if (tag) tags.push(tag);
    });
    
    // Visibility
    const visibilityEl = document.querySelector('[class*="visibility"] [class*="label"], .visibility-label');
    const visibility = visibilityEl?.textContent?.trim() || 'unknown';
    
    return { videoId, title, description, tags, visibility };
  } catch (error) {
    console.error('[Boostify] Error extracting studio video details:', error);
    return null;
  }
}

/**
 * Parse metric values like "1.2K", "5M", "$12.34"
 */
function parseMetricValue(text: string): number {
  const cleaned = text.replace(/[$€£,]/g, '').trim().toLowerCase();
  
  const multipliers: Record<string, number> = {
    'k': 1000,
    'm': 1000000,
    'b': 1000000000,
  };
  
  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.endsWith(suffix)) {
      return Math.round(parseFloat(cleaned.replace(suffix, '')) * multiplier);
    }
  }
  
  return parseInt(cleaned.replace(/\D/g, '')) || 0;
}

/**
 * Parse duration string like "5:23" or "1:05:23" to seconds
 */
function parseDurationToSeconds(text: string): number {
  const parts = text.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}
