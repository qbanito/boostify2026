import { create } from 'zustand';
import type { ConnectionInfo, PendingAction, ExtractedChannelData } from '../shared/types';
import { getConnectionInfo, getCachedActions, getSettings } from '../shared/storage';
import { getSnapshots, getEvents } from '../shared/api-client';
import type { ExtSettings } from '../shared/types';

interface SidePanelState {
  activeTab: string;
  connected: boolean;
  loading: boolean;
  connection: ConnectionInfo | null;
  actions: PendingAction[];
  channelData: ExtractedChannelData | null;
  snapshots: any[];
  events: any[];
  settings: ExtSettings | null;
  lastSync: string | null;
  init: () => Promise<void>;
  setTab: (tab: string) => void;
  loadSnapshots: () => Promise<void>;
  loadEvents: () => Promise<void>;
}

export const useSidePanelStore = create<SidePanelState>((set, get) => ({
  activeTab: 'overview',
  connected: false,
  loading: true,
  connection: null,
  actions: [],
  channelData: null,
  snapshots: [],
  events: [],
  settings: null,
  lastSync: null,

  init: async () => {
    try {
      const conn = await getConnectionInfo();
      const actions = await getCachedActions();
      const settings = await getSettings();
      const data = await chrome.storage.local.get(['lastSync', 'channelData']);
      set({
        connected: !!conn,
        connection: conn,
        actions: actions || [],
        channelData: data.channelData || null,
        lastSync: data.lastSync || null,
        settings,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  setTab: (tab) => set({ activeTab: tab }),

  loadSnapshots: async () => {
    const { connection } = get();
    if (!connection) return;
    try {
      const snaps = await getSnapshots(connection.syncToken);
      set({ snapshots: snaps });
    } catch { /* ignore */ }
  },

  loadEvents: async () => {
    const { connection } = get();
    if (!connection) return;
    try {
      const evts = await getEvents(connection.syncToken);
      set({ events: evts });
    } catch { /* ignore */ }
  },
}));
