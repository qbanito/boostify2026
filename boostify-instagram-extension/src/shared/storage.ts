// Boostify Instagram Extension — chrome.storage helpers

import {
  STORAGE_SYNC_TOKEN, STORAGE_CONNECTION_ID, STORAGE_USER_ID,
  STORAGE_IG_USERNAME, STORAGE_IG_DISPLAY_NAME, STORAGE_LAST_SYNC,
  STORAGE_PENDING_ACTIONS, STORAGE_SETTINGS
} from './constants';
import { ConnectionInfo, PendingAction, ExtSettings, DEFAULT_SETTINGS } from './types';

export async function getStorage<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ?? null);
    });
  });
}

export async function setStorage(key: string, value: any): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export async function removeStorage(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve);
  });
}

export async function getConnectionInfo(): Promise<ConnectionInfo | null> {
  const syncToken = await getStorage<string>(STORAGE_SYNC_TOKEN);
  const connectionId = await getStorage<number>(STORAGE_CONNECTION_ID);
  const userId = await getStorage<number>(STORAGE_USER_ID);
  const instagramUsername = await getStorage<string>(STORAGE_IG_USERNAME);
  const displayName = await getStorage<string>(STORAGE_IG_DISPLAY_NAME);
  const lastSync = await getStorage<string>(STORAGE_LAST_SYNC);

  if (!syncToken || !connectionId || !userId || !instagramUsername) {
    return null;
  }

  return {
    syncToken,
    connectionId,
    userId,
    instagramUsername,
    displayName: displayName || instagramUsername,
    status: 'active',
    lastSyncAt: lastSync || undefined,
  };
}

export async function saveConnectionInfo(info: ConnectionInfo): Promise<void> {
  await setStorage(STORAGE_SYNC_TOKEN, info.syncToken);
  await setStorage(STORAGE_CONNECTION_ID, info.connectionId);
  await setStorage(STORAGE_USER_ID, info.userId);
  await setStorage(STORAGE_IG_USERNAME, info.instagramUsername);
  await setStorage(STORAGE_IG_DISPLAY_NAME, info.displayName);
}

export async function clearConnectionInfo(): Promise<void> {
  await removeStorage(STORAGE_SYNC_TOKEN);
  await removeStorage(STORAGE_CONNECTION_ID);
  await removeStorage(STORAGE_USER_ID);
  await removeStorage(STORAGE_IG_USERNAME);
  await removeStorage(STORAGE_IG_DISPLAY_NAME);
  await removeStorage(STORAGE_LAST_SYNC);
  await removeStorage(STORAGE_PENDING_ACTIONS);
}

export async function updateLastSync(): Promise<void> {
  await setStorage(STORAGE_LAST_SYNC, new Date().toISOString());
}

export async function getCachedActions(): Promise<PendingAction[]> {
  return (await getStorage<PendingAction[]>(STORAGE_PENDING_ACTIONS)) || [];
}

export async function saveCachedActions(actions: PendingAction[]): Promise<void> {
  await setStorage(STORAGE_PENDING_ACTIONS, actions);
}

export async function getSettings(): Promise<ExtSettings> {
  const saved = await getStorage<ExtSettings>(STORAGE_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(settings: Partial<ExtSettings>): Promise<void> {
  const current = await getSettings();
  await setStorage(STORAGE_SETTINGS, { ...current, ...settings });
}
