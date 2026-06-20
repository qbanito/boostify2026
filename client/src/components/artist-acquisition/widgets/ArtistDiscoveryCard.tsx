import { useState } from 'react';
import { BadgeCheck, MapPin, Sparkles, Loader2 } from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import { SectionCard } from '../shared/SectionCard';
import { Sparkline } from '../shared/Sparkline';
import { Modal } from '../shared/Modal';
import { TOKENS } from '../shared/tokens';
import { featuredArtist } from '../../../data/mockArtistAcquisition';
import type { AcquisitionFeaturedArtist } from '../../../hooks/use-acquisition-overview';
import { formatLocation } from '../../../lib/formatLocation';

// What each dimension actually measures (surface to admin via drill-down).
const DIMENSION_EXPLAINERS: Record<string, { title: string; inputs: string[] }> = {
  talent: { title: 'Talent', inputs: ['Base hunter score', 'Tier boost (S/A/B)', 'Audio / catalog signals'] },
  branding: { title: 'Branding', inputs: ['Has declared genre', 'Has country/locale', 'Base score signal'] },
  readiness: { title: 'Readiness', inputs: ['Funnel status (new → deal)', 'Recent opens/clicks', 'Status map'] },
  monetization: { title: 'Monetization', inputs: ['Funnel conversion rate', 'Paying vs discovered', 'Plan signals'] },
  reach: { title: 'Reach', inputs: ['Base score * 0.9', 'Has email', 'Channel breadth'] },
  virality: { title: 'Virality', inputs: ['Base score * 0.75', 'Tier boost * 0.8', 'Engagement proxies'] },
  ecosystem: { title: 'Ecosystem', inputs: ['Base score * 0.6', 'Country weight', 'Genre weight'] },
};

export function ArtistDiscoveryCard({
  data,
  onNewMatch,
  running,
}: {
  data?: AcquisitionFeaturedArtist | null;
  onNewMatch?: () => void;
  running?: boolean;
}) {
  const a = data || featuredArtist;
  const [dimension, setDimension] = useState<string | null>(null);
  return (
    <SectionCard
      number="01"
      title="Artist Discovery"
      action={
        <button
          onClick={onNewMatch}
          disabled={running}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all hover:brightness-125 disabled:opacity-60"
          style={{
            color: TOKENS.ORANGE_GLOW,
            background: TOKENS.ORANGE_SOFT,
            border: `1px solid ${TOKENS.ORANGE_RING}`,
            boxShadow: running ? 'none' : '0 0 14px rgba(255,138,31,0.25)',
          }}
          title="Run discovery to find a new matching artist"
        >
          {running ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Sparkles size={11} />
          )}
          {running ? 'Matching…' : 'New Match'}
        </button>
      }
    >
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: '0 0 28px 4px rgba(255,122,0,0.35)',
            }}
          />
          <div
            className="relative w-[88px] h-[88px] rounded-full overflow-hidden"
            style={{
              border: `2px solid ${TOKENS.ORANGE}`,
              padding: 2,
              background: TOKENS.SURFACE,
            }}
          >
            <img
              src={a.avatar}
              alt={a.name}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: TOKENS.SURFACE_2,
              border: `1px solid ${TOKENS.BORDER}`,
            }}
          >
            <Waveform />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
            <h4
              className="text-[18px] font-semibold leading-tight"
              style={{ color: TOKENS.TEXT }}
            >
              {a.name}
            </h4>
            <BadgeCheck
              size={16}
              style={{ color: TOKENS.ORANGE_GLOW }}
              fill="rgba(255,138,31,0.15)"
            />
          </div>
          <div
            className="text-[12px] mt-1 flex items-center gap-1.5 justify-center sm:justify-start"
            style={{ color: TOKENS.MUTED }}
          >
            <span className="inline-block w-1 h-1 rounded-full bg-current" />
            {a.genres.join(' • ')}
          </div>
          <div
            className="text-[12px] mt-1 flex items-center gap-1.5 justify-center sm:justify-start"
            style={{ color: TOKENS.MUTED }}
          >
            <MapPin size={11} />
            {formatLocation(a.location)}
          </div>

          {/* Score */}
          <div
            className="mt-3 rounded-lg px-3.5 py-2.5 flex items-center gap-3"
            style={{
              background: TOKENS.SURFACE_3,
              border: `1px solid ${TOKENS.BORDER}`,
            }}
          >
            <div>
              <div
                className="text-[10.5px] uppercase tracking-wider"
                style={{ color: TOKENS.MUTED }}
              >
                Growth Score
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className="text-[24px] font-bold leading-none"
                  style={{ color: TOKENS.ORANGE_GLOW }}
                >
                  {a.growthScore}
                </span>
                <span
                  className="text-[12px]"
                  style={{ color: TOKENS.MUTED }}
                >
                  /100
                </span>
              </div>
            </div>
            <div className="flex-1 h-9">
              <Sparkline data={a.growthSpark} height={36} />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-3">
        <Metric label="Monthly Listeners" value={a.metrics.monthlyListeners} />
        <Metric label="Followers" value={a.metrics.followers} />
        <Metric label="Engagement" value={a.metrics.engagement} />
        <Metric label="Save Ratio" value={a.metrics.saveRatio} />
      </div>

      {/* Multidimensional score radar */}
      {a.scoreDimensions && (
        <div
          className="mt-4 rounded-lg px-3 pt-2 pb-1"
          style={{
            background: TOKENS.SURFACE_3,
            border: `1px solid ${TOKENS.BORDER}`,
          }}
        >
          <div
            className="text-[10.5px] uppercase tracking-wider mb-1"
            style={{ color: TOKENS.MUTED }}
          >
            Multidimensional Score
          </div>
          <div className="h-[180px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={[
                  { axis: 'Talent', value: a.scoreDimensions.talent },
                  { axis: 'Branding', value: a.scoreDimensions.branding },
                  { axis: 'Readiness', value: a.scoreDimensions.readiness },
                  { axis: 'Monetize', value: a.scoreDimensions.monetization },
                  { axis: 'Reach', value: a.scoreDimensions.reach },
                  { axis: 'Virality', value: a.scoreDimensions.virality },
                  { axis: 'Ecosystem', value: a.scoreDimensions.ecosystem },
                ]}
                outerRadius="75%"
              >
                <PolarGrid stroke={TOKENS.BORDER} />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={(props: any) => {
                    const { x, y, payload, textAnchor } = props;
                    const label: string = payload.value;
                    const key = label.toLowerCase();
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor={textAnchor}
                        fill={TOKENS.MUTED}
                        fontSize={10}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setDimension(key)}
                      >
                        {label}
                      </text>
                    );
                  }}
                />
                <Radar
                  dataKey="value"
                  stroke={TOKENS.ORANGE_GLOW}
                  fill={TOKENS.ORANGE_GLOW}
                  fillOpacity={0.25}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] mt-1 px-1" style={{ color: TOKENS.MUTED }}>
            Tip: click an axis label to see how that dimension is calculated.
          </div>
        </div>
      )}

      {/* Dimension drill-down */}
      <Modal
        open={!!dimension}
        onClose={() => setDimension(null)}
        title={dimension ? `${DIMENSION_EXPLAINERS[dimension]?.title || dimension} score` : undefined}
        subtitle="How this dimension is composed"
        size="sm"
      >
        {dimension && (
          <div>
            <div
              className="rounded-lg px-3 py-2 mb-3 flex items-center justify-between"
              style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
            >
              <div className="text-[11.5px]" style={{ color: TOKENS.MUTED }}>
                Current value for {a.name}
              </div>
              <div className="text-[20px] font-bold" style={{ color: TOKENS.ORANGE_GLOW }}>
                {(a.scoreDimensions as any)?.[dimension] ?? 0}
              </div>
            </div>
            <div className="text-[11.5px] mb-1.5" style={{ color: TOKENS.MUTED }}>
              Inputs feeding this dimension:
            </div>
            <ul className="space-y-1.5">
              {(DIMENSION_EXPLAINERS[dimension]?.inputs || []).map((inp) => (
                <li
                  key={inp}
                  className="rounded-md px-2.5 py-1.5 text-[12px]"
                  style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.TEXT }}
                >
                  • {inp}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[10.5px] uppercase tracking-wider"
        style={{ color: TOKENS.MUTED }}
      >
        {label}
      </div>
      <div
        className="text-[15px] font-semibold mt-0.5"
        style={{ color: TOKENS.TEXT }}
      >
        {value}
      </div>
    </div>
  );
}

function Waveform() {
  const bars = [3, 6, 4, 8, 5, 3];
  return (
    <div className="flex items-end gap-[1.5px] h-3">
      {bars.map((h, i) => (
        <span
          key={i}
          style={{
            width: 1.5,
            height: h,
            background: TOKENS.ORANGE_GLOW,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}
