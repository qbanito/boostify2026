import React, { useState } from 'react';
import { usePopupStore } from '../store';

export function SyncButton() {
  const { connected } = usePopupStore();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (syncing || !connected) return;
    setSyncing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
      // Re-init after short delay to get updated data
      setTimeout(() => {
        usePopupStore.getState().init();
        setSyncing(false);
      }, 3000);
    } catch {
      setSyncing(false);
    }
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: 'https://boostifymusic.com/youtube-views' });
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleSync}
        disabled={!connected || syncing}
        className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:border-orange-500/50 transition-all flex items-center justify-center gap-2"
      >
        {syncing ? (
          <>
            <span className="animate-spin">⟳</span>
            Syncing…
          </>
        ) : (
          <>
            🔄 Sync Now
          </>
        )}
      </button>
      <button
        onClick={openDashboard}
        className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all"
        title="Open Boostify Dashboard"
      >
        📊
      </button>
    </div>
  );
}
