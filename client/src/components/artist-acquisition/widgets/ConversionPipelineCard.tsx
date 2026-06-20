import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, TrendingUp } from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { TOKENS } from '../shared/tokens';
import { pipeline as mockPipeline } from '../../../data/mockArtistAcquisition';
import type { AcquisitionPipeline } from '../../../hooks/use-acquisition-overview';

const SOURCE_COLORS: Record<string, string> = {
  Spotify: '#22c55e',
  TikTok: '#f5f5f5',
  Instagram: '#ff7a00',
  Other: '#6b7280',
};

const RANGE_OPTIONS = ['7D', '30D', '90D', '12M'];

export function ConversionPipelineCard({
  data,
  range: controlledRange,
  onRangeChange,
}: {
  data?: AcquisitionPipeline;
  range?: string;
  onRangeChange?: (r: any) => void;
}) {
  const pipeline = data || mockPipeline;
  const [internalRange, setInternalRange] = useState<string>(pipeline.range || '30D');
  const range = controlledRange ?? internalRange;
  const setRange = (r: string) => {
    if (onRangeChange) onRangeChange(r);
    else setInternalRange(r);
  };
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <SectionCard
      number="06"
      title="Conversion Pipeline"
      action={
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md transition-colors hover:bg-white/5"
            style={{
              color: TOKENS.MUTED,
              background: TOKENS.SURFACE_3,
              border: `1px solid ${TOKENS.BORDER}`,
            }}
          >
            {range}
            <ChevronDown
              size={11}
              style={{
                transform: open ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.15s',
              }}
            />
          </button>
          {open && (
            <div
              className="absolute right-0 top-full mt-1 min-w-[140px] rounded-lg py-1 z-20"
              style={{
                background: TOKENS.SURFACE_2,
                border: `1px solid ${TOKENS.BORDER}`,
                boxShadow: '0 12px 24px rgba(0,0,0,0.35)',
              }}
            >
              {RANGE_OPTIONS.map((r) => {
                const isActive = r === range;
                return (
                  <button
                    key={r}
                    onClick={() => {
                      setRange(r);
                      setOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[11.5px] text-left transition-colors hover:bg-white/5"
                    style={{
                      color: isActive ? TOKENS.ORANGE_GLOW : TOKENS.TEXT,
                    }}
                  >
                    <span>{r}</span>
                    {isActive && <Check size={11} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-4">
        {/* Funnel */}
        <div className="flex flex-col gap-1.5">
          {pipeline.stages.map((s, i) => (
            <div
              key={s.label}
              className="relative h-9 flex items-center mx-auto"
              style={{ width: `${s.width}%` }}
            >
              <div
                className="absolute inset-0 rounded-md"
                style={{
                  background: `linear-gradient(90deg, rgba(255,122,0,${
                    0.55 - i * 0.08
                  }) 0%, rgba(255,138,31,${0.18 - i * 0.025}) 100%)`,
                  border: `1px solid rgba(255,122,0,${0.4 - i * 0.05})`,
                }}
              />
              <div className="relative flex items-center justify-between w-full px-3 text-[11.5px]">
                <span style={{ color: TOKENS.TEXT, fontWeight: 500 }}>
                  {s.label}
                </span>
                <span
                  className="font-semibold"
                  style={{ color: TOKENS.TEXT }}
                >
                  {s.value}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Stats + sources */}
        <div className="flex flex-col gap-3">
          <div
            className="rounded-lg p-3"
            style={{
              background: TOKENS.SURFACE_3,
              border: `1px solid ${TOKENS.BORDER}`,
            }}
          >
            <div
              className="text-[10.5px] uppercase tracking-wider"
              style={{ color: TOKENS.MUTED }}
            >
              Conversion Rate
            </div>
            <div
              className="text-[22px] font-bold mt-0.5"
              style={{ color: TOKENS.TEXT }}
            >
              {pipeline.conversionRate}
            </div>
            <div
              className="text-[11px] flex items-center gap-1 mt-0.5"
              style={{ color: TOKENS.POSITIVE }}
            >
              <TrendingUp size={11} />
              {pipeline.delta}
            </div>
          </div>

          <div
            className="rounded-lg p-3 flex-1"
            style={{
              background: TOKENS.SURFACE_3,
              border: `1px solid ${TOKENS.BORDER}`,
            }}
          >
            <div
              className="text-[10.5px] uppercase tracking-wider mb-2"
              style={{ color: TOKENS.MUTED }}
            >
              Top Sources
            </div>
            <div className="space-y-1.5">
              {pipeline.sources.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: SOURCE_COLORS[s.label] || SOURCE_COLORS.Other }}
                  />
                  <span className="flex-1" style={{ color: TOKENS.MUTED }}>
                    {s.label}
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: TOKENS.TEXT }}
                  >
                    {s.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
