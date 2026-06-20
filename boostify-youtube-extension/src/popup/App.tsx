import React, { useEffect } from 'react';
import { usePopupStore } from './store';
import { ConnectionStatus } from './components/ConnectionStatus';
import { QuickStats } from './components/QuickStats';
import { PendingActions } from './components/PendingActions';
import { SyncButton } from './components/SyncButton';

export default function App() {
  const { init, loading, error } = usePopupStore();

  useEffect(() => { init(); }, []);

  if (loading) {
    return (
      <div className="w-[360px] h-[480px] flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="w-[360px] h-[480px] bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-gradient-to-r from-orange-600 to-orange-500">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">🚀</span>
          <span className="text-lg font-bold text-white tracking-tight">Boostify</span>
        </div>
        <span className="text-xs text-orange-100 opacity-80">YouTube Tools</span>
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <ConnectionStatus />
        <QuickStats />
        <PendingActions />
      </div>

      {/* Footer */}
      <div className="border-t border-[#2a2a2a] p-3">
        <SyncButton />
      </div>
    </div>
  );
}
