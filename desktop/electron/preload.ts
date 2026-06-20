/**
 * Boostify Music Desktop — Preload Script
 *
 * Exposes a safe bridge (window.electronAPI) from main → renderer.
 * The renderer (React app) can use these APIs without node access.
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  /** Runtime config (apiBaseUrl, platform, version) */
  getConfig: () => Promise<{
    isDev: boolean;
    apiBaseUrl: string;
    platform: string;
    version: string;
  }>;

  /** Open a native file picker and return selected file paths */
  openFiles: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string[]>;

  /** Open a native save dialog and return the chosen path */
  saveFile: (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;

  /** Listen to menu actions from the native menu bar */
  onMenuAction: (channel: string, callback: () => void) => () => void;

  /** Auto-updater */
  onUpdaterEvent: (channel: string, callback: (data: any) => void) => () => void;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

const electronAPI: ElectronAPI = {
  getConfig: () => ipcRenderer.invoke('app:getConfig'),

  openFiles: (options) => ipcRenderer.invoke('dialog:openFiles', options),

  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  onMenuAction: (channel: string, callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  onUpdaterEvent: (channel: string, callback: (data: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
