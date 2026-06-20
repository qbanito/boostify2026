import { create } from 'zustand';
import type { ConnectionInfo, PendingAction, ExtractedChannelData } from '../shared/types';
import { getConnectionInfo, getCachedActions } from '../shared/storage';

interface PopupState {
  connected: boolean;
  loading: boolean;
  connection: ConnectionInfo | null;
  actions: PendingAction[];
  channelData: ExtractedChannelData | null;
  lastSync: string | null;
  error: string | null;
  init: () => Promise<void>;
  setError: (err: string | null) => void;
}

export const usePopupStore = create<PopupState>((set) => ({
  connected: false,
  loading: true,
  connection: null,
  actions: [],
  channelData: null,
  lastSync: null,
  error: null,
  init: async () => {
    try {
      const conn = await getConnectionInfo();
      const actions = await getCachedActions();
      const data = await chrome.storage.local.get(['lastSync', 'channelData']);
      set({
        connected: !!conn,
        connection: conn,
        actions: actions || [],
        channelData: data.channelData || null,
        lastSync: data.lastSync || null,
        loading: false,
      });
    } catch {
      set({ loading: false, error: 'Failed to load state' });
    }
  },
  setError: (err) => set({ error: err }),
}));
