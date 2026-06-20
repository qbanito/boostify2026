import React, { useEffect } from 'react';
import { useSidePanelStore } from '../store';

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

const EVENT_ICONS: Record<string, string> = {
  video_published: '🎬',
  stats_synced: '📊',
  action_applied: '✅',
  action_skipped: '⏭',
  connected: '🔗',
  disconnected: '🔌',
  error: '❌',
  milestone: '🏆',
};

export function HistoryTab() {
  const { events, snapshots, loadEvents, loadSnapshots } = useSidePanelStore();

  useEffect(() => {
    loadEvents();
    loadSnapshots();
  }, []);

  return (
    <div className="p-4 space-y-4">
      {/* Snapshots */}
      <div className="bg-[#141414] rounded-xl border border-[#2a2a2a] overflow-hidden">
        <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider p-3 border-b border-[#2a2a2a]">
          📈 Growth Snapshots
        </h3>
        <div className="p-3">
          {snapshots.length === 0 ? (
            <p className="text-[11px] text-[#666] text-center py-3">
              No snapshots yet — stats are recorded on each sync
            </p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {snapshots.slice(0, 10).map((snap: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-[#0a0a0a] rounded-lg p-2.5 border border-[#1a1a1a]">
                  <div>
                    <p className="text-xs text-[#ccc]">
                      👥 {formatNumber(snap.subscribers || 0)} · 👁 {formatNumber(snap.totalViews || 0)}
                    </p>
                    <p className="text-[10px] text-[#555]">{snap.videoCount || 0} videos</p>
                  </div>
                  <span className="text-[10px] text-[#666]">{timeAgo(snap.snapshotAt || snap.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Events */}
      <div className="bg-[#141414] rounded-xl border border-[#2a2a2a] overflow-hidden">
        <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider p-3 border-b border-[#2a2a2a]">
          📜 Activity Log
        </h3>
        <div className="p-3">
          {events.length === 0 ? (
            <p className="text-[11px] text-[#666] text-center py-3">No events recorded yet</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {events.slice(0, 20).map((evt: any, i: number) => (
                <div key={i} className="flex items-start gap-2 bg-[#0a0a0a] rounded-lg p-2.5 border border-[#1a1a1a]">
                  <span className="text-sm mt-0.5">{EVENT_ICONS[evt.eventType] || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#ccc] capitalize">
                      {(evt.eventType || '').replace(/_/g, ' ')}
                    </p>
                    {evt.eventData?.message && (
                      <p className="text-[10px] text-[#888] truncate">{evt.eventData.message}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-[#666] shrink-0">
                    {timeAgo(evt.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
