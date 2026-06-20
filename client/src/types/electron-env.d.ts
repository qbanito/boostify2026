/**
 * Electron environment type declarations.
 * Makes window.electronAPI available in the React app when running inside Electron.
 */

export interface ElectronAPI {
  getConfig: () => Promise<{
    isDev: boolean;
    apiBaseUrl: string;
    platform: string;
    version: string;
  }>;
  openFiles: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string[]>;
  saveFile: (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
  onMenuAction: (channel: string, callback: () => void) => () => void;
  onUpdaterEvent: (channel: string, callback: (data: any) => void) => () => void;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
