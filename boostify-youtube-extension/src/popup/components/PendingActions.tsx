import React from 'react';
import { usePopupStore } from '../store';
import type { PendingAction } from '../../shared/types';

const TYPE_LABELS: Record<string, string> = {
  optimize_title: '📝 Optimize Title',
  optimize_description: '📄 Optimize Description',
  optimize_tags: '🏷 Optimize Tags',
  change_thumbnail: '🖼 Change Thumbnail',
  schedule_post: '📅 Schedule Post',
  seo_audit: '🔍 SEO Audit',
  promote_video: '📢 Promote Video',
  custom: '⚙ Custom Action',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-400 bg-red-500/10',
  medium: 'text-amber-400 bg-amber-500/10',
  low: 'text-green-400 bg-green-500/10',
};

export function PendingActions() {
  const { connected, actions } = usePopupStore();

  if (!connected) return null;

  const pending = actions.filter((a) => a.status === 'pending');

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider">
          Pending Actions
        </h3>
        {pending.length > 0 && (
          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-semibold">
            {pending.length}
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-xs text-[#666]">No pending actions</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[180px] overflow-y-auto">
          {pending.slice(0, 5).map((action) => (
            <ActionItem key={action.id} action={action} />
          ))}
          {pending.length > 5 && (
            <p className="text-[10px] text-[#666] text-center py-1">
              + {pending.length - 5} more in Studio
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ActionItem({ action }: { action: PendingAction }) {
  const openStudio = () => {
    const payload = action.payload as any;
    if (payload?.videoId) {
      chrome.tabs.create({
        url: `https://studio.youtube.com/video/${payload.videoId}/edit`,
      });
    } else {
      chrome.tabs.create({ url: 'https://studio.youtube.com' });
    }
  };

  return (
    <div
      className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-3 cursor-pointer hover:border-orange-500/30 transition-colors"
      onClick={openStudio}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white truncate">
            {TYPE_LABELS[action.actionType] || action.actionType}
          </p>
          {(action.payload as any)?.videoTitle && (
            <p className="text-[10px] text-[#888] truncate mt-0.5">
              {(action.payload as any).videoTitle}
            </p>
          )}
        </div>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
            PRIORITY_COLORS[action.priority] || PRIORITY_COLORS.low
          }`}
        >
          {action.priority.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
