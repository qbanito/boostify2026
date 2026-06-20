import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { Sparkline } from '../shared/Sparkline';
import { TOKENS } from '../shared/tokens';
import { analytics as mockAnalytics } from '../../../data/mockArtistAcquisition';
import type { AcquisitionAnalytics } from '../../../hooks/use-acquisition-overview';

export function AnalyticsOverviewCard({
  data,
  range: controlledRange,
  onRangeChange,
}: {
  data?: AcquisitionAnalytics;
  range?: string;
  onRangeChange?: (r: any) => void;
}) {
  const analytics = data || mockAnalytics;
  const [internalActive, setInternalActive] = useState(analytics.active);
  const active = controlledRange ?? internalActive;
  const setActive = (r: string) => {
    if (onRangeChange) onRangeChange(r);
    else setInternalActive(r);
  };

  return (
    <SectionCard
      number="07"
      title="Analytics Overview"
      action={
        <div className="flex items-center gap-1">
          {analytics.ranges.map((r) => {
            const isActive = r === active;
            return (
              <button
                key={r}
                onClick={() => setActive(r)}
                className="px-2 py-1 rounded text-[10.5px] font-medium transition-colors"
                style={
                  isActive
                    ? {
                        background: TOKENS.ORANGE_SOFT,
                        color: TOKENS.ORANGE_GLOW,
                        border: `1px solid ${TOKENS.ORANGE_RING}`,
                      }
                    : {
                        background: 'transparent',
                        color: TOKENS.MUTED,
                        border: `1px solid transparent`,
                      }
                }
              >
                {r}
              </button>
            );
          })}
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {analytics.kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-lg p-3"
            style={{
              background: TOKENS.SURFACE_3,
              border: `1px solid ${TOKENS.BORDER}`,
            }}
          >
            <div
              className="text-[10.5px]"
              style={{ color: TOKENS.MUTED }}
            >
              {k.label}
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className="text-[18px] font-bold"
                style={{ color: TOKENS.TEXT }}
              >
                {k.value}
              </span>
              <span
                className="text-[10.5px] flex items-center gap-0.5"
                style={{ color: TOKENS.POSITIVE }}
              >
                <TrendingUp size={10} />
                {k.delta}
              </span>
            </div>
            <div className="mt-2" style={{ height: 28 }}>
              <Sparkline data={k.spark} height={28} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
