import { API_BASE } from './types';

let syncToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  const data = await chrome.storage.local.get('syncToken');
  syncToken = data.syncToken || null;
  return syncToken;
}

export async function saveToken(token: string) {
  syncToken = token;
  await chrome.storage.local.set({ syncToken: token });
}

async function apiCall(path: string, options: RequestInit = {}) {
  if (!syncToken) await loadToken();
  const headers: any = { 'Content-Type': 'application/json', ...options.headers };
  if (syncToken) headers['x-sync-token'] = syncToken;
  
  const res = await fetch(`${API_BASE}/api/spotify-ext${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function syncStats(data: any) {
  return apiCall('/sync-stats', { method: 'POST', body: JSON.stringify({ ...data, syncToken }) });
}

export async function updateUsername(data: { spotifyUsername?: string; displayName?: string; spotifyImageUrl?: string }) {
  return apiCall('/update-username', { method: 'POST', body: JSON.stringify({ ...data, syncToken }) });
}

export async function getPendingActions(connectionId: number) {
  return apiCall(`/pending-actions/${connectionId}`);
}

export async function saveExtraction(data: any) {
  return apiCall('/save-extraction', { method: 'POST', body: JSON.stringify({ ...data, syncToken }) });
}
