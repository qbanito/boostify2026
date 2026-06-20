import { useMemo, useState } from 'react';
import { Mail, Users, Music, Sparkles, ChevronRight } from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { TOKENS } from '../shared/tokens';
import { activity as mockActivity } from '../../../data/mockArtistAcquisition';
import type { AcquisitionActivity } from '../../../hooks/use-acquisition-overview';

const ICONS: Record<string, any> = {
  mail: Mail,
  users: Users,
  music: Music,
  spark: Sparkles,
};

const TABS: Array<{ id: string; label: string; match: (a: AcquisitionActivity) => boolean }> = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'replies', label: 'Replies', match: (a) => a.icon === 'mail' },
  { id: 'conversions', label: 'Conversions', match: (a) => a.icon === 'users' || /upgrad|paid|signed/i.test(a.text) },
  { id: 'bounces', label: 'Bounces', match: (a) => /bounc|unsubscribe|fail/i.test(a.text) },
  { id: 'system', label: 'System', match: (a) => a.icon === 'spark' || a.icon === 'music' },
];

export function ActivityFeedCard({ data }: { data?: AcquisitionActivity[] }) {
  const activity = data && data.length ? data : mockActivity;
  const [tab, setTab] = useState('all');
  const filtered = useMemo(() => {
    const t = TABS.find((x) => x.id === tab) || TABS[0];
    return activity.filter(t.match);
  }, [activity, tab]);

  return (
    <SectionCard
      title="Activity Feed"
      action={
        <button
          className="flex items-center gap-1 text-[11.5px] transition-colors hover:text-white"
          style={{ color: TOKENS.MUTED }}
        >
          View All
          <ChevronRight size={11} />
        </button>
      }
      bodyClassName="!py-3"
    >
      <div className="flex gap-1.5 mb-2 overflow-x-auto custom-scroll -mx-1 px-1">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-2.5 py-1 rounded-full text-[10.5px] font-medium whitespace-nowrap transition-colors"
              style={
                active
                  ? { background: TOKENS.ORANGE_SOFT, color: TOKENS.ORANGE_GLOW, border: `1px solid ${TOKENS.ORANGE_RING}` }
                  : { background: 'transparent', color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="space-y-1">
        {filtered.length === 0 && (
          <div className="text-[11.5px] py-2" style={{ color: TOKENS.MUTED }}>
            No activity in this group.
          </div>
        )}
        {filtered.map((a, i) => {
          const Icon = ICONS[a.icon] || Sparkles;
          return (
            <div
              key={i}
              className="flex items-start gap-3 p-2 rounded-md transition-colors hover:bg-white/[0.03]"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: TOKENS.ORANGE_SOFT,
                  border: `1px solid ${TOKENS.ORANGE_RING}`,
                }}
              >
                <Icon size={12} style={{ color: TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12px] leading-snug"
                  style={{ color: TOKENS.TEXT }}
                >
                  {a.text}
                </div>
                <div
                  className="text-[10.5px] mt-0.5"
                  style={{ color: TOKENS.MUTED }}
                >
                  {a.time}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
