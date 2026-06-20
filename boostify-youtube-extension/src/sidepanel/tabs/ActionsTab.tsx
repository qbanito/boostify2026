import React from 'react';
import { useSidePanelStore } from '../store';
import type { PendingAction } from '../../shared/types';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  optimize_title: { label: 'Title', color: 'bg-orange-500/10 text-orange-400' },
  optimize_description: { label: 'Description', color: 'bg-purple-500/10 text-purple-400' },
  optimize_tags: { label: 'Tags', color: 'bg-green-500/10 text-green-400' },
  change_thumbnail: { label: 'Thumbnail', color: 'bg-yellow-500/10 text-yellow-400' },
  schedule_post: { label: 'Schedule', color: 'bg-cyan-500/10 text-cyan-400' },
  seo_audit: { label: 'SEO', color: 'bg-blue-500/10 text-blue-400' },
  promote_video: { label: 'Promote', color: 'bg-pink-500/10 text-pink-400' },
  custom: { label: 'Custom', color: 'bg-gray-500/10 text-gray-400' },
};

export function ActionsTab() {
  const { actions } = useSidePanelStore();

  const pending = actions.filter((a) => a.status === 'pending');
  const completed = actions.filter((a) => a.status === 'completed' || a.status === 'applied');
  const skipped = actions.filter((a) => a.status === 'skipped' || a.status === 'failed');

  return (
    <div className="p-4 space-y-4">
      {/* Pending */}
      <Section title="⚡ Pending" count={pending.length} defaultOpen>
        {pending.length === 0 ? (
          <EmptyState text="No pending actions — you're all caught up!" />
        ) : (
          pending.map((a) => <ActionCard key={a.id} action={a} />)
        )}
      </Section>

      {/* Completed */}
      <Section title="✅ Completed" count={completed.length}>
        {completed.length === 0 ? (
          <EmptyState text="No completed actions yet" />
        ) : (
          completed.slice(0, 10).map((a) => <ActionCard key={a.id} action={a} muted />)
        )}
      </Section>

      {/* Skipped / Failed */}
      {skipped.length > 0 && (
        <Section title="⏭ Skipped" count={skipped.length}>
          {skipped.slice(0, 5).map((a) => <ActionCard key={a.id} action={a} muted />)}
        </Section>
      )}
    </div>
  );
}

function Section({
  title, count, children, defaultOpen = false,
}: {
  title: string; count: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="bg-[#141414] rounded-xl border border-[#2a2a2a] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-[#1a1a1a] transition-colors"
      >
        <span className="text-xs font-semibold text-[#ccc]">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-[#2a2a2a] text-[#999] px-1.5 py-0.5 rounded">{count}</span>
          <span className="text-[#666] text-xs">{open ? '▾' : '▸'}</span>
        </div>
      </button>
      {open && <div className="border-t border-[#2a2a2a] p-3 space-y-2">{children}</div>}
    </div>
  );
}

function ActionCard({ action, muted }: { action: PendingAction; muted?: boolean }) {
  const typeInfo = TYPE_LABELS[action.actionType] || TYPE_LABELS.custom;
  const payload = action.payload as any;

  const openInStudio = () => {
    if (payload?.videoId) {
      chrome.tabs.create({ url: `https://studio.youtube.com/video/${payload.videoId}/edit` });
    } else {
      chrome.tabs.create({ url: 'https://studio.youtube.com' });
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        muted
          ? 'bg-[#111] border-[#1a1a1a] opacity-60'
          : 'bg-[#0a0a0a] border-[#2a2a2a] hover:border-orange-500/30'
      }`}
      onClick={openInStudio}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeInfo.color}`}>
          {typeInfo.label}
        </span>
        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
          action.priority === 'high' ? 'bg-red-500/10 text-red-400' :
          action.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' :
          'bg-green-500/10 text-green-400'
        }`}>
          {action.priority}
        </span>
      </div>
      {payload?.videoTitle && (
        <p className="text-xs text-[#ccc] truncate">{payload.videoTitle}</p>
      )}
      {payload?.suggestedTitle && (
        <p className="text-[10px] text-orange-400/80 truncate mt-0.5">→ {payload.suggestedTitle}</p>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-[11px] text-[#666] text-center py-3">{text}</p>;
}
