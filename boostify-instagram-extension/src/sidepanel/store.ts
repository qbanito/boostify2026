import { create } from 'zustand';
import type { ConnectionInfo, ProfileSnapshot, PendingAction, PostData } from '../shared/types';
import { getConnectionInfo, getCachedActions } from '../shared/storage';

interface PanelState {
  activeTab: string;
  connection: ConnectionInfo | null;
  snapshot: ProfileSnapshot | null;
  pendingActions: PendingAction[];
  recentPosts: PostData[];
  loading: boolean;
  setActiveTab: (tab: string) => void;
  loadState: () => Promise<void>;
  setSnapshot: (s: ProfileSnapshot) => void;
  setRecentPosts: (p: PostData[]) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  activeTab: 'overview',
  connection: null,
  snapshot: null,
  pendingActions: [],
  recentPosts: [],
  loading: true,

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadState: async () => {
    set({ loading: true });
    try {
      const connection = await getConnectionInfo();
      const pendingActions = await getCachedActions();
      
      // Get cached snapshot from chrome.storage
      const data = await chrome.storage.local.get(['ig_cached_snapshot', 'ig_cached_posts']);
      
      set({
        connection,
        pendingActions,
        snapshot: data.ig_cached_snapshot || null,
        recentPosts: data.ig_cached_posts || [],
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  setSnapshot: (snapshot) => set({ snapshot }),
  setRecentPosts: (recentPosts) => set({ recentPosts }),
}));
