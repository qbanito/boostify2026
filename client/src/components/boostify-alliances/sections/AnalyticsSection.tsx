import { Loader2, Mail, Eye, MousePointerClick, Handshake, Trophy, AlertCircle } from 'lucide-react';
import { TOKENS } from '../../artist-acquisition/shared/tokens';
import { SectionCard } from '../../artist-acquisition/shared/SectionCard';
import { Sparkline } from '../../artist-acquisition/shared/Sparkline';
import { useAnalytics } from '../hooks/useAlliancesApi';

const STATUS_COLORS: Record<string, string> = {
  new: '#4a90ff',
  queued: '#4a90ff',
  contacted: '#6a8eff',
  opened: '#8fa7ff',
  clicked: '#b26dff',
  responded: '#ff8a1f',
  deal_in_progress: '#ff7a00',
  won: '#22c55e',
  not_interested: '#ef4444',
  unsubscribed: '#6b7280',
  bounced: '#ef4444',
  unknown: '#6b7280',
};

export function AnalyticsSection() {
  const { data, isLoading } = useAnalytics();
  const s = data?.summary;
  const byStatus: Array<{ status: string; count: number }> = data?.byStatus || [];
  const daily: Array<{ day: string; count: number }> = data?.daily || [];
  const topGenres: Array<{ genre: string; count: number }> = data?.topGenres || [];

  const maxStatus = byStatus.reduce((m, r) => Math.max(m, r.count), 1);
  const maxGenre = topGenres.reduce((m, r) => Math.max(m, r.count), 1);
  const sparkData = daily.map((d, i) => ({ x: i, y: d.count }));

  if (isLoading || !s) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 size={14} className="animate-spin" style={{ color: TOKENS.MUTED }} />
      </div>
    );
  }

  const cards = [
    { icon: Mail, label: 'Emails sent', value: s.totalEmailsSent, accent: TOKENS.ORANGE_GLOW },
    { icon: Eye, label: 'Open rate', value: `${s.openRate}%`, accent: TOKENS.POSITIVE },
    { icon: MousePointerClick, label: 'Click rate', value: `${s.clickRate}%`, accent: '#b26dff' },
    { icon: Handshake, label: 'In deal', value: s.inDeal, accent: TOKENS.ORANGE },
    { icon: Trophy, label: 'Won', value: s.won, accent: TOKENS.POSITIVE },
    { icon: AlertCircle, label: 'Lost', value: s.lost, accent: TOKENS.DANGER },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-xl p-3"
              style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}` }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={13} style={{ color: c.accent }} />
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: TOKENS.MUTED_2 }}>
                  {c.label}
                </span>
              </div>
              <div className="text-[22px] font-black" style={{ color: TOKENS.TEXT }}>
                {typeof c.value === 'number' ? c.value.toLocaleString() : c.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="NEW CONTACTS · LAST 30 DAYS"
          action={
            <span className="text-[11.5px]" style={{ color: TOKENS.MUTED }}>
              {daily.reduce((t, d) => t + d.count, 0)} added
            </span>
          }
        >
          {sparkData.length === 0 ? (
            <div className="py-4 text-center text-[11px]" style={{ color: TOKENS.MUTED }}>
              No activity in the last 30 days.
            </div>
          ) : (
            <Sparkline data={sparkData} color={TOKENS.ORANGE_GLOW} height={120} />
          )}
        </SectionCard>

        <SectionCard title="STATUS DISTRIBUTION">
          <div className="space-y-2">
            {byStatus.map((r) => (
              <div key={r.status}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span style={{ color: TOKENS.MUTED }}>{r.status}</span>
                  <span className="font-semibold tabular-nums" style={{ color: TOKENS.TEXT }}>
                    {r.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(r.count / maxStatus) * 100}%`,
                      background: STATUS_COLORS[r.status] || '#6b7280',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="TOP GENRES">
        {topGenres.length === 0 ? (
          <div className="py-4 text-center text-[11px]" style={{ color: TOKENS.MUTED }}>
            No genre data yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {topGenres.map((g) => (
              <div key={g.genre}>
                <div className="flex items-center justify-between text-[11.5px] mb-1">
                  <span className="truncate" style={{ color: TOKENS.TEXT }}>{g.genre}</span>
                  <span className="font-semibold tabular-nums" style={{ color: TOKENS.MUTED }}>
                    {g.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(g.count / maxGenre) * 100}%`,
                      background: `linear-gradient(90deg, ${TOKENS.ORANGE}, ${TOKENS.ORANGE_GLOW})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div
        className="rounded-xl px-4 py-3 text-[11.5px] flex items-center justify-between"
        style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.MUTED }}
      >
        <span>Avg lead score across {s.totalContacts.toLocaleString()} contacts</span>
        <span className="text-[18px] font-black" style={{ color: TOKENS.ORANGE_GLOW }}>
          {s.avgLeadScore}
        </span>
      </div>
    </div>
  );
}
