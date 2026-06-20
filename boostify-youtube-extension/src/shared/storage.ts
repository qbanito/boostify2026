// Boostify YouTube Extension — chrome.storage helpers

import { STORAGE_SYNC_TOKEN, STORAGE_CONNECTION_ID, STORAGE_USER_ID, STORAGE_CHANNEL_ID, STORAGE_CHANNEL_NAME, STORAGE_LAST_SYNC, STORAGE_PENDING_ACTIONS, STORAGE_SETTINGS } from './constants';
import { ConnectionInfo, PendingAction, ExtSettings, DEFAULT_SETTINGS } from './types';

/**
 * Get a value from chrome.storage.local
 */
export async function getStorage<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ?? null);
    });
  });
}

/**
 * Set a value in chrome.storage.local
 */
export async function setStorage(key: string, value: any): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

/**
 * Remove a key from chrome.storage.local
 */
export async function removeStorage(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve);
  });
}

/**
 * Get connection info from storage
 */
export async function getConnectionInfo(): Promise<ConnectionInfo | null> {
  const syncToken = await getStorage<string>(STORAGE_SYNC_TOKEN);
  const connectionId = await getStorage<number>(STORAGE_CONNECTION_ID);
  const userId = await getStorage<number>(STORAGE_USER_ID);
  const channelId = await getStorage<string>(STORAGE_CHANNEL_ID);
  const channelName = await getStorage<string>(STORAGE_CHANNEL_NAME);
  const lastSync = await getStorage<string>(STORAGE_LAST_SYNC);

  if (!syncToken || !connectionId || !userId || !channelId) {
    return null;
  }

  return {
    syncToken,
    connectionId,
    userId,
    channelId,
    channelName: channelName || channelId,
    status: 'active',
    lastSyncAt: lastSync || undefined,
  };
}

/**
 * Save connection info to storage
 */
export async function saveConnectionInfo(info: ConnectionInfo): Promise<void> {
  await setStorage(STORAGE_SYNC_TOKEN, info.syncToken);
  await setStorage(STORAGE_CONNECTION_ID, info.connectionId);
  await setStorage(STORAGE_USER_ID, info.userId);
  await setStorage(STORAGE_CHANNEL_ID, info.channelId);
  await setStorage(STORAGE_CHANNEL_NAME, info.channelName);
}

/**
 * Clear all connection data (disconnect)
 */
export async function clearConnectionInfo(): Promise<void> {
  await removeStorage(STORAGE_SYNC_TOKEN);
  await removeStorage(STORAGE_CONNECTION_ID);
  await removeStorage(STORAGE_USER_ID);
  await removeStorage(STORAGE_CHANNEL_ID);
  await removeStorage(STORAGE_CHANNEL_NAME);
  await removeStorage(STORAGE_LAST_SYNC);
  await removeStorage(STORAGE_PENDING_ACTIONS);
}

/**
 * Update last sync timestamp
 */
export async function updateLastSync(): Promise<void> {
  await setStorage(STORAGE_LAST_SYNC, new Date().toISOString());
}

/**
 * Get pending actions from local cache
 */
export async function getCachedActions(): Promise<PendingAction[]> {
  return (await getStorage<PendingAction[]>(STORAGE_PENDING_ACTIONS)) || [];
}

/**
 * Save pending actions to local cache
 */
export async function saveCachedActions(actions: PendingAction[]): Promise<void> {
  await setStorage(STORAGE_PENDING_ACTIONS, actions);
}

/**
 * Get extension settings
 */
export async function getSettings(): Promise<ExtSettings> {
  const saved = await getStorage<ExtSettings>(STORAGE_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...saved };
}

/**
 * Save extension settings
 */
export async function saveSettings(settings: Partial<ExtSettings>): Promise<void> {
  const current = await getSettings();
  await setStorage(STORAGE_SETTINGS, { ...current, ...settings });
}
