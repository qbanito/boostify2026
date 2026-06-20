// Boostify Instagram Extension — API Client

import { getConnectionInfo, getSettings } from './storage';
import { API_BASE_URL } from './constants';
import type { SyncResponse, PendingAction, ProfileSnapshot, InstagramEvent } from './types';

async function getApiUrl(): Promise<string> {
  try {
    const settings = await getSettings();
    if (settings.apiBaseUrl && settings.apiBaseUrl.trim() !== '') {
      return settings.apiBaseUrl.replace(/\/$/, '');
    }
  } catch { /* use default */ }
  return API_BASE_URL;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const conn = await getConnectionInfo();
  if (!conn?.syncToken) throw new Error('Not connected');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${conn.syncToken}`,
  };
}

async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = await getApiUrl();
  const headers = await getAuthHeaders();
  const response = await fetch(`${baseUrl}/api/instagram-ext${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API ${response.status}: ${errorBody}`);
  }
  return response.json();
}

async function publicApiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/api/instagram-ext${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API ${response.status}: ${errorBody}`);
  }
  return response.json();
}

// --- AI Tool Calls (use main instagram API endpoints) ---
// These require authentication via the sync token

async function aiToolCall<T>(path: string, body: Record<string, any>): Promise<T> {
  const baseUrl = await getApiUrl();
  const headers = await getAuthHeaders();
  const response = await fetch(`${baseUrl}/api/instagram${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`AI Tool ${response.status}: ${await response.text()}`);
  return response.json();
}

// ============================================================
// Connection API
// ============================================================

export async function connectExtension(data: {
  userId: number;
  extensionId: string;
  instagramUsername: string;
  profileUrl?: string;
  displayName?: string;
}): Promise<{ success: boolean; connectionId: number; syncToken: string; instagramUsername: string }> {
  return publicApiCall('/connect', { method: 'POST', body: JSON.stringify(data) });
}

export async function validateConnectToken(data: {
  connectToken: string;
  extensionId: string;
  instagramUsername: string;
  profileUrl?: string;
  displayName?: string;
}): Promise<{ success: boolean; connectionId: number; syncToken: string; instagramUsername: string; userId: number }> {
  return publicApiCall('/validate-connect-token', { method: 'POST', body: JSON.stringify(data) });
}

export async function disconnectExtension(): Promise<{ success: boolean }> {
  return apiCall('/disconnect', { method: 'POST' });
}

// ============================================================
// Sync API
// ============================================================

export async function syncStats(data: {
  followers: number;
  following: number;
  postsCount: number;
  bio?: string;
  isVerified?: boolean;
  avgLikes?: number;
  avgComments?: number;
  engagementRate?: number;
  recentPosts?: Array<{ postId: string; caption: string; likes: number; comments: number; type: string; timestamp: string }>;
  topHashtags?: string[];
  instagramUsername?: string;
}): Promise<SyncResponse> {
  return apiCall('/sync-stats', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateConnectionUsername(username: string, profilePicUrl?: string): Promise<{ success: boolean }> {
  return apiCall('/update-username', { method: 'POST', body: JSON.stringify({ username, profilePicUrl }) });
}

export async function getPendingActions(): Promise<{ success: boolean; actions: PendingAction[] }> {
  return apiCall('/pending-actions');
}

export async function reportActionResult(data: {
  actionId: number;
  status: 'applied' | 'failed' | 'cancelled';
  resultMessage?: string;
}): Promise<{ success: boolean; action: PendingAction }> {
  return apiCall('/action-result', { method: 'POST', body: JSON.stringify(data) });
}

export async function sendWebhookEvent(data: {
  eventType: string;
  eventData: Record<string, any>;
}): Promise<{ success: boolean; eventId: number }> {
  return apiCall('/webhook', { method: 'POST', body: JSON.stringify(data) });
}

export async function getSnapshots(connectionId: number, limit = 50): Promise<{ success: boolean; snapshots: ProfileSnapshot[] }> {
  return apiCall(`/snapshots/${connectionId}?limit=${limit}`);
}

export async function getEvents(connectionId: number, limit = 20): Promise<{ success: boolean; events: InstagramEvent[] }> {
  return apiCall(`/events/${connectionId}?limit=${limit}`);
}

// ============================================================
// AI Tools API (proxy to existing /api/instagram/* endpoints)
// ============================================================

export async function generateCaptions(data: {
  topic: string;
  tone: string;
  audience: string;
  includeEmojis?: boolean;
  includeHashtags?: boolean;
  artistName?: string;
}): Promise<any> {
  return aiToolCall('/caption-generator', data);
}

export async function generateHashtags(data: {
  topic: string;
  niche: string;
  postType?: string;
  artistName?: string;
}): Promise<any> {
  return aiToolCall('/hashtag-generator', data);
}

export async function generateContentIdeas(data: {
  niche: string;
  audience: string;
  contentType?: string;
  artistName?: string;
}): Promise<any> {
  return aiToolCall('/content-ideas', data);
}

export async function analyzeBestTime(data: {
  niche: string;
  audience: string;
  timezone?: string;
  artistName?: string;
}): Promise<any> {
  return aiToolCall('/best-time-analyzer', data);
}

export async function optimizeBio(data: {
  currentBio: string;
  niche: string;
  goals?: string;
  artistName?: string;
}): Promise<any> {
  return aiToolCall('/bio-optimizer', data);
}

// ============================================================
// Extraction API
// ============================================================

export async function saveExtraction(data: {
  extractType: string;
  query?: string;
  sortMode?: string;
  users: Array<{
    username: string;
    displayName?: string;
    profilePicUrl?: string;
    isVerified?: boolean;
    isPrivate?: boolean;
  }>;
  totalCount: number;
}): Promise<{ success: boolean; eventId: number; savedCount: number }> {
  return apiCall('/save-extraction', { method: 'POST', body: JSON.stringify(data) });
}

// Save extracted profiles with full detail (email, phone, bio, etc.)
export async function saveExtractedProfiles(data: {
  extractType: string;
  query?: string;
  jobId?: string;
  users: Array<{
    username: string;
    displayName?: string;
    bio?: string;
    email?: string;
    phone?: string;
    website?: string;
    profilePicUrl?: string;
    followers?: number;
    following?: number;
    postsCount?: number;
    isVerified?: boolean;
    isPrivate?: boolean;
    isBusiness?: boolean;
    category?: string;
    enriched?: boolean;
  }>;
}): Promise<{ success: boolean; savedCount: number }> {
  return apiCall('/save-extracted-profiles', { method: 'POST', body: JSON.stringify(data) });
}

export async function getExtractedProfiles(connectionId: number, params?: {
  extractType?: string;
  hasEmail?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ profiles: any[]; total: number; stats: any }> {
  const query = new URLSearchParams();
  if (params?.extractType) query.set('extractType', params.extractType);
  if (params?.hasEmail) query.set('hasEmail', 'true');
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  return apiCall(`/extracted-profiles/${connectionId}?${query.toString()}`);
}

export async function getExtractions(connectionId: number): Promise<{ success: boolean; extractions: any[] }> {
  return apiCall(`/extractions/${connectionId}`);
}
