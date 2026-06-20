/**
 * useElectron — React hook to access Electron-specific APIs
 *
 * Returns null when running in the browser (web mode).
 * Returns the electronAPI bridge when running inside Electron.
 */

import { useEffect, useState } from 'react';

/** True when the app is running inside Electron */
export const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

interface ElectronConfig {
  isDev: boolean;
  apiBaseUrl: string;
  platform: string;
  version: string;
}

export function useElectron() {
  return window.electronAPI ?? null;
}

export function useElectronConfig() {
  const [config, setConfig] = useState<ElectronConfig | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getConfig().then(setConfig);
  }, []);

  return config;
}

/**
 * Listen to a native menu action dispatched from Electron main process.
 * Usage: useMenuAction('menu:undo', () => handleUndo())
 */
export function useMenuAction(channel: string, callback: () => void) {
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubscribe = window.electronAPI.onMenuAction(channel, callback);
    return unsubscribe;
  }, [channel, callback]);
}
