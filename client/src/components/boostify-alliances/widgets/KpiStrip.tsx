import { Target, Users, Handshake, CalendarClock, TrendingUp, Loader2 } from 'lucide-react';
import { TOKENS } from '../../artist-acquisition/shared/tokens';
import { Sparkline } from '../../artist-acquisition/shared/Sparkline';
import { useOverview } from '../hooks/useAlliancesApi';

const ICONS: Record<string, any> = {
  'total-targets': Target,
  'warm-leads': Users,
  'active-deals': Handshake,
  'meetings': CalendarClock,
};

export function KpiStrip() {
  const { data, isLoading } = useOverview();
  const kpis: Array<{
    id: string; label: string; value: string; delta: string; deltaPositive?: boolean; spark: number[];
  }> = data?.kpis || [];

  if (isLoading && kpis.length === 0) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-4 h-[120px] flex items-center justify-center"
            style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}` }}
          >
            <Loader2 size={14} className="animate-spin" style={{ color: TOKENS.MUTED }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((k) => {
        const Icon = ICONS[k.id] || Target;
        return (
          <div
            key={k.id}
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{
              background: TOKENS.SURFACE_2,
              border: `1px solid ${TOKENS.BORDER}`,
              boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset, 0 8px 32px rgba(0,0,0,0.4)',
            }}
            data-testid={`alliances-kpi-${k.id}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: TOKENS.ORANGE_SOFT,
                  border: `1px solid ${TOKENS.ORANGE_RING}`,
                  color: TOKENS.ORANGE_GLOW,
                  boxShadow: '0 0 18px rgba(255,138,31,0.25)',
                }}
              >
                <Icon size={16} />
              </div>
              <div className="text-[10.5px] font-semibold tracking-[0.12em]" style={{ color: TOKENS.MUTED_2 }}>
                {k.label}
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[34px] font-black leading-none tracking-tight" style={{ color: TOKENS.TEXT }}>
                  {k.value}
                </div>
                <div
                  className="mt-1.5 text-[10.5px] flex items-center gap-1"
                  style={{ color: k.deltaPositive ? TOKENS.POSITIVE : TOKENS.DANGER }}
                >
                  <TrendingUp size={10} />
                  {k.delta}
                </div>
              </div>
              <div className="shrink-0 w-[90px] h-[38px]">
                <Sparkline
                  data={(k.spark || []).map((y, x) => ({ x, y }))}
                  color={TOKENS.ORANGE_GLOW}
                  height={38}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
