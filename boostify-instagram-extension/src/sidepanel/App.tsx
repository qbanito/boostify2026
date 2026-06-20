import { useEffect } from 'react';
import { usePanelStore } from './store';
import OverviewTab from './tabs/OverviewTab';
import CaptionsTab from './tabs/CaptionsTab';
import HashtagsTab from './tabs/HashtagsTab';
import IdeasTab from './tabs/IdeasTab';
import TimingTab from './tabs/TimingTab';
import BioTab from './tabs/BioTab';
import ActionsTab from './tabs/ActionsTab';

const tabs = [
  { id: 'overview', label: '📊', title: 'Overview' },
  { id: 'captions', label: '✍️', title: 'Captions' },
  { id: 'hashtags', label: '#️⃣', title: 'Hashtags' },
  { id: 'ideas', label: '💡', title: 'Ideas' },
  { id: 'timing', label: '⏰', title: 'Timing' },
  { id: 'bio', label: '✨', title: 'Bio' },
  { id: 'actions', label: '📋', title: 'Acciones' },
];

export default function App() {
  const { activeTab, setActiveTab, loading, loadState, connection } = usePanelStore();

  useEffect(() => {
    loadState();

    // Listen for updates from background
    const listener = (message: any) => {
      if (message.type === 'SYNC_COMPLETE' || message.type === 'CONNECTION_UPDATED') {
        loadState();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const TabContent = {
    overview: OverviewTab,
    captions: CaptionsTab,
    hashtags: HashtagsTab,
    ideas: IdeasTab,
    timing: TimingTab,
    bio: BioTab,
    actions: ActionsTab,
  }[activeTab] || OverviewTab;

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex-shrink-0 p-3 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-orange-600/10 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold">Boostify Instagram</h1>
            {connection && (
              <p className="text-[10px] text-white/40">@{connection.instagramUsername}</p>
            )}
          </div>
          {connection && (
            <div className="ml-auto flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] text-green-400/70">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 flex border-b border-white/[0.06] bg-white/[0.01]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-center transition-all relative group ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-white/30 hover:text-white/60'
            }`}
            title={tab.title}
          >
            <span className="text-sm">{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
            )}
            {/* Tooltip */}
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {tab.title}
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <TabContent />
      </div>
    </div>
  );
}
