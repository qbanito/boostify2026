// Boostify YouTube Extension — API Client

import { getConnectionInfo, getSettings } from './storage';
import { API_BASE_URL } from './constants';
import type { SyncResponse, PendingAction, ChannelSnapshot, YouTubeEvent } from './types';

/**
 * Get the API base URL (from settings or default constant)
 */
async function getApiUrl(): Promise<string> {
  try {
    const settings = await getSettings();
    if (settings.apiBaseUrl && settings.apiBaseUrl.trim() !== '') {
      return settings.apiBaseUrl.replace(/\/$/, '');
    }
  } catch (e) {
    // settings unavailable, use constant
  }
  return API_BASE_URL;
}

/**
 * Get auth headers for extension API calls
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const conn = await getConnectionInfo();
  if (!conn?.syncToken) throw new Error('Not connected');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${conn.syncToken}`,
  };
}

/**
 * Make an authenticated API call
 */
async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = await getApiUrl();
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${baseUrl}/api/youtube-ext${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API ${response.status}: ${errorBody}`);
  }

  return response.json();
}

/**
 * Make an unauthenticated API call (for connect flow)
 */
async function publicApiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = await getApiUrl();
  
  const response = await fetch(`${baseUrl}/api/youtube-ext${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API ${response.status}: ${errorBody}`);
  }

  return response.json();
}

// ============================================================
// API Methods
// ============================================================

/**
 * Connect the extension (register with Boostify)
 */
export async function connectExtension(data: {
  userId: number;
  extensionId: string;
  channelId: string;
  channelUrl?: string;
  channelName?: string;
}): Promise<{ success: boolean; connectionId: number; syncToken: string; channelName: string }> {
  return publicApiCall('/connect', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Validate a connect token from the web app
 */
export async function validateConnectToken(data: {
  connectToken: string;
  extensionId: string;
  channelId: string;
  channelUrl?: string;
  channelName?: string;
}): Promise<{ success: boolean; connectionId: number; syncToken: string; channelName: string; userId: number }> {
  return publicApiCall('/validate-connect-token', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Disconnect the extension
 */
export async function disconnectExtension(): Promise<{ success: boolean }> {
  return apiCall('/disconnect', { method: 'POST' });
}

/**
 * Sync channel stats to Boostify
 */
export async function syncStats(data: {
  subscribers: number;
  totalViews: number;
  videoCount: number;
  watchTimeHours?: number;
  avgViewDuration?: number;
  topVideos?: Array<{ videoId: string; title: string; views: number; ctr: number }>;
  recentUploads?: Array<{ videoId: string; title: string; publishedAt: string; views: number }>;
  trafficSources?: Record<string, number>;
  demographics?: Record<string, any>;
}): Promise<SyncResponse> {
  return apiCall('/sync-stats', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get pending actions for this extension
 */
export async function getPendingActions(): Promise<{ success: boolean; actions: PendingAction[] }> {
  return apiCall('/pending-actions');
}

/**
 * Report the result of an action
 */
export async function reportActionResult(data: {
  actionId: number;
  status: 'applied' | 'failed' | 'cancelled';
  resultMessage?: string;
}): Promise<{ success: boolean; action: PendingAction }> {
  return apiCall('/action-result', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Send a webhook event to Boostify
 */
export async function sendWebhookEvent(data: {
  eventType: string;
  eventData: Record<string, any>;
}): Promise<{ success: boolean; eventId: number }> {
  return apiCall('/webhook', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get channel snapshots (historical data)
 */
export async function getSnapshots(connectionId: number, limit = 50): Promise<{ success: boolean; snapshots: ChannelSnapshot[] }> {
  return apiCall(`/snapshots/${connectionId}?limit=${limit}`);
}

/**
 * Get recent events
 */
export async function getEvents(connectionId: number, limit = 20): Promise<{ success: boolean; events: YouTubeEvent[] }> {
  return apiCall(`/events/${connectionId}?limit=${limit}`);
}
