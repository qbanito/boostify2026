import React, { useEffect } from 'react';
import { useSidePanelStore } from './store';
import { OverviewTab } from './tabs/OverviewTab';
import { ActionsTab } from './tabs/ActionsTab';
import { HistoryTab } from './tabs/HistoryTab';
import { SettingsTab } from './tabs/SettingsTab';

const TABS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'actions', label: '⚡ Actions' },
  { id: 'history', label: '📜 History' },
  { id: 'settings', label: '⚙ Settings' },
];

export default function SidePanelApp() {
  const { init, loading, activeTab, setTab, connected } = useSidePanelStore();

  useEffect(() => { init(); }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-600 to-orange-500 shrink-0">
        <span className="text-lg font-bold text-white">🚀 Boostify</span>
        <span className="ml-auto text-xs text-orange-100 opacity-80">Side Panel</span>
      </header>

      {/* Tab Bar */}
      <nav className="flex border-b border-[#2a2a2a] bg-[#0a0a0a] shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-orange-400 border-b-2 border-orange-500 bg-orange-500/5'
                : 'text-[#888] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="flex-1 overflow-y-auto">
        {!connected ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <span className="text-4xl mb-4">🔗</span>
            <p className="text-sm text-[#888] mb-2">Not connected</p>
            <p className="text-xs text-[#666]">
              Open the popup and connect with your Boostify token to start syncing.
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'actions' && <ActionsTab />}
            {activeTab === 'history' && <HistoryTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </>
        )}
      </main>
    </div>
  );
}
