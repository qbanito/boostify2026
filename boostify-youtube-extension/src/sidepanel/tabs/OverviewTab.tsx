import React, { useState } from 'react';
import { useSidePanelStore } from '../store';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function OverviewTab() {
  const { channelData, lastSync, connection, actions } = useSidePanelStore();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
      setTimeout(() => {
        useSidePanelStore.getState().init();
        setSyncing(false);
      }, 3000);
    } catch {
      setSyncing(false);
    }
  };

  const pendingCount = actions.filter((a) => a.status === 'pending').length;

  return (
    <div className="p-4 space-y-4">
      {/* Connection Info */}
      <div className="bg-[#141414] rounded-xl p-4 border border-[#2a2a2a]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-green-400">Connected</span>
          {lastSync && (
            <span className="ml-auto text-[10px] text-[#666]">
              Last sync: {timeAgo(lastSync)}
            </span>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-xs font-semibold text-[#ccc] hover:border-orange-500/50 transition-all disabled:opacity-40"
        >
          {syncing ? '⟳ Syncing…' : '🔄 Force Sync Now'}
        </button>
      </div>

      {/* Stats Grid */}
      {channelData && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider">
            Channel Overview
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon="👥" label="Subscribers" value={formatNumber(channelData.subscriberCount)} />
            <StatCard icon="👁" label="Total Views" value={formatNumber(channelData.totalViews)} />
            <StatCard icon="🎬" label="Videos" value={formatNumber(channelData.videoCount)} />
            <StatCard icon="⚡" label="Pending" value={pendingCount.toString()} highlight={pendingCount > 0} />
          </div>

          {channelData.channelName && (
            <div className="bg-[#141414] rounded-lg p-3 border border-[#2a2a2a]">
              <p className="text-xs text-[#888] mb-1">Channel</p>
              <p className="text-sm font-semibold text-white">{channelData.channelName}</p>
              {channelData.channelId && (
                <p className="text-[10px] text-[#555] mt-0.5 font-mono">{channelData.channelId}</p>
              )}
            </div>
          )}
        </div>
      )}

      {!channelData && (
        <div className="text-center py-8">
          <span className="text-3xl">📡</span>
          <p className="text-xs text-[#666] mt-2">
            Navigate to your YouTube channel or Studio to populate stats
          </p>
        </div>
      )}

      {/* Quick Links */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Quick Links</h3>
        <div className="grid grid-cols-2 gap-2">
          <QuickLink label="YouTube Studio" url="https://studio.youtube.com" icon="🎬" />
          <QuickLink label="Boostify Dash" url="https://boostifymusic.com/youtube-views" icon="📊" />
          <QuickLink label="Analytics" url="https://studio.youtube.com/channel/UC/analytics" icon="📈" />
          <QuickLink label="Your Channel" url="https://www.youtube.com/channel/UC" icon="📺" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-[#141414] rounded-lg p-3 text-center border ${highlight ? 'border-orange-500/40' : 'border-[#2a2a2a]'}`}>
      <span className="text-lg">{icon}</span>
      <p className={`text-lg font-bold mt-1 ${highlight ? 'text-orange-400' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-[#888]">{label}</p>
    </div>
  );
}

function QuickLink({ label, url, icon }: { label: string; url: string; icon: string }) {
  return (
    <button
      onClick={() => chrome.tabs.create({ url })}
      className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-2.5 text-left hover:border-orange-500/30 transition-colors"
    >
      <span className="text-sm">{icon}</span>
      <p className="text-[11px] text-[#ccc] mt-1">{label}</p>
    </button>
  );
}
