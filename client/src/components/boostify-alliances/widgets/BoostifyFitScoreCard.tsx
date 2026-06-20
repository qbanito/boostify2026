import { CheckCircle2, Loader2 } from 'lucide-react';
import { TOKENS } from '../../artist-acquisition/shared/tokens';
import { SectionCard } from '../../artist-acquisition/shared/SectionCard';
import { useFitScore } from '../hooks/useAlliancesApi';

interface BoostifyFitScoreCardProps {
  contactId: number | null;
  onViewAnalysis: () => void;
}

export function BoostifyFitScoreCard({ contactId, onViewAnalysis }: BoostifyFitScoreCardProps) {
  const { data, isLoading } = useFitScore(contactId);
  const score = Number(data?.score || 0);
  const verdict = data?.verdict || '—';
  const breakdown: Array<{ label: string; value: number; icon: string }> = data?.breakdown || [];

  const circ = 2 * Math.PI * 42;
  const offset = circ - (score / 100) * circ;

  return (
    <SectionCard title="BOOSTIFY FIT SCORE">
      {isLoading && !data ? (
        <div className="p-6 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin" style={{ color: TOKENS.MUTED }} />
        </div>
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-[120px] relative">
              <svg viewBox="0 0 100 100" className="w-full h-auto">
                <defs>
                  <linearGradient id="fit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffb14d" />
                    <stop offset="100%" stopColor="#ff7a00" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#fit-grad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  transform="rotate(-90 50 50)"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(255,138,31,0.6))' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[28px] font-black leading-none" style={{ color: TOKENS.TEXT }}>
                  {score}
                </div>
                <div className="text-[9px] font-semibold tracking-widest mt-1" style={{ color: TOKENS.ORANGE_GLOW }}>
                  {verdict}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              {breakdown.map((b) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-[11.5px] mb-1">
                    <span className="flex items-center gap-1.5 truncate" style={{ color: TOKENS.MUTED }}>
                      <span style={{ fontSize: 10 }}>{b.icon}</span>
                      {b.label}
                    </span>
                    <span className="font-semibold tabular-nums" style={{ color: TOKENS.TEXT }}>
                      {b.value}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${b.value}%`,
                        background: `linear-gradient(90deg, ${TOKENS.ORANGE}, ${TOKENS.ORANGE_GLOW})`,
                        boxShadow: '0 0 8px rgba(255,138,31,0.4)',
                      }}
                    />
                  </div>
                </div>
              ))}
              {breakdown.length === 0 && (
                <div className="text-[11px] text-center py-4" style={{ color: TOKENS.MUTED }}>
                  Select an artist to see the fit analysis.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onViewAnalysis}
            disabled={!contactId}
            className="mt-4 w-full h-10 rounded-xl flex items-center justify-center gap-2 text-[12.5px] font-semibold disabled:opacity-50"
            style={{
              background: `linear-gradient(90deg, ${TOKENS.ORANGE}, ${TOKENS.ORANGE_GLOW})`,
              color: '#0a0a0a',
              boxShadow: '0 0 24px rgba(255,138,31,0.45)',
            }}
            data-testid="alliances-fit-view-analysis"
          >
            <CheckCircle2 size={13} />
            View Full Analysis
          </button>
        </>
      )}
    </SectionCard>
  );
}
