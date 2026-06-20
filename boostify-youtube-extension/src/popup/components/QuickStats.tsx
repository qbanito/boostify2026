import React from 'react';
import { usePopupStore } from '../store';

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

export function QuickStats() {
  const { connected, channelData, lastSync } = usePopupStore();

  if (!connected) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#666] text-sm">Connect to see your YouTube stats</p>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Channel Stats</h3>
        {lastSync && (
          <span className="text-[10px] text-[#666]">
            Synced {timeAgo(lastSync)}
          </span>
        )}
      </div>

      {channelData ? (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Subscribers"
            value={formatNumber(channelData.subscriberCount)}
            icon="👥"
          />
          <StatCard
            label="Total Views"
            value={formatNumber(channelData.totalViews)}
            icon="👁"
          />
          <StatCard
            label="Videos"
            value={formatNumber(channelData.videoCount)}
            icon="🎬"
          />
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-xs text-[#666]">
            Visit your YouTube channel to populate stats
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-[#141414] rounded-lg p-3 text-center border border-[#2a2a2a]">
      <span className="text-lg">{icon}</span>
      <p className="text-base font-bold text-white mt-1">{value}</p>
      <p className="text-[10px] text-[#888] mt-0.5">{label}</p>
    </div>
  );
}
