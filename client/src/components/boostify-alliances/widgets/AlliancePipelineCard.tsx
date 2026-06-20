import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { TOKENS } from '../../artist-acquisition/shared/tokens';
import { SectionCard } from '../../artist-acquisition/shared/SectionCard';
import { usePipeline, movePipelineStage } from '../hooks/useAlliancesApi';

interface AlliancePipelineCardProps {
  onSelect: (id: number) => void;
  selectedContactId: number | null;
}

type StageId = 'discovered' | 'qualified' | 'meeting' | 'proposal' | 'won';
const STAGE_ORDER: StageId[] = ['discovered', 'qualified', 'meeting', 'proposal', 'won'];

export function AlliancePipelineCard({ onSelect, selectedContactId }: AlliancePipelineCardProps) {
  const { data, isLoading } = usePipeline();
  const qc = useQueryClient();
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);

  const stages: Array<{
    id: StageId;
    label: string;
    accent: string;
    count: number;
    cards: Array<{ id: number; name: string; score: number; initials: string; gradient: [string, string]; imageUrl?: string | null }>;
  }> = data?.stages || [];

  const handleMove = async (contactId: number, currentStage: StageId, direction: 1 | -1) => {
    const idx = STAGE_ORDER.indexOf(currentStage);
    const nextIdx = Math.max(0, Math.min(STAGE_ORDER.length - 1, idx + direction));
    if (nextIdx === idx) { setMenuFor(null); return; }
    setMoving(true);
    try {
      await movePipelineStage(contactId, STAGE_ORDER[nextIdx]);
      qc.invalidateQueries({ queryKey: ['/api/admin/boostify-alliances/pipeline'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/boostify-alliances/overview'] });
    } finally {
      setMoving(false);
      setMenuFor(null);
    }
  };

  return (
    <SectionCard
      title="ALLIANCE PIPELINE"
      action={
        <Link
          href="/admin/artist-acquisition"
          className="text-[11.5px] font-semibold flex items-center gap-1"
          style={{ color: TOKENS.ORANGE_GLOW }}
          data-testid="alliances-pipeline-view-full"
        >
          View Full Pipeline <ArrowRight size={12} />
        </Link>
      }
    >
      {isLoading && !data ? (
        <div className="p-6 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin" style={{ color: TOKENS.MUTED }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stages.map((stage) => (
            <div key={stage.id} className="flex flex-col min-w-0" data-testid={`alliances-pipeline-stage-${stage.id}`}>
              <div
                className="rounded-lg px-3 py-2 flex items-center justify-between mb-2"
                style={{
                  background: TOKENS.SURFACE_3,
                  border: `1px solid ${TOKENS.BORDER}`,
                  borderTop: `2px solid ${stage.accent}`,
                }}
              >
                <span className="text-[10.5px] font-bold tracking-[0.12em]" style={{ color: TOKENS.TEXT }}>
                  {stage.label}
                </span>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: stage.accent }}>
                  {stage.count}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {stage.cards.length === 0 && (
                  <div className="text-[10px] text-center py-4" style={{ color: TOKENS.MUTED_2 }}>
                    Empty
                  </div>
                )}
                {stage.cards.map((c) => {
                  const isSelected = c.id === selectedContactId;
                  return (
                    <div
                      key={c.id}
                      className="relative rounded-lg p-2.5 flex items-center gap-2 cursor-pointer"
                      style={{
                        background: TOKENS.SURFACE_3,
                        border: `1px solid ${isSelected ? TOKENS.ORANGE_RING : TOKENS.BORDER_SOFT}`,
                        boxShadow: isSelected ? '0 0 12px rgba(255,138,31,0.25)' : 'none',
                      }}
                      onClick={() => onSelect(c.id)}
                    >
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})`,
                          color: 'rgba(255,255,255,0.95)',
                        }}
                      >
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          c.initials
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold truncate" style={{ color: TOKENS.TEXT }}>
                          {c.name}
                        </div>
                        <div className="text-[9.5px] flex items-center gap-1.5" style={{ color: TOKENS.MUTED }}>
                          <span>Score {c.score}</span>
                          <span
                            className="flex-1 h-0.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.08)', position: 'relative' }}
                          >
                            <span
                              style={{
                                display: 'block',
                                height: '100%',
                                width: `${c.score}%`,
                                background: stage.accent,
                                borderRadius: 2,
                              }}
                            />
                          </span>
                        </div>
                      </div>
                      <button
                        className="shrink-0"
                        style={{ color: TOKENS.MUTED_2 }}
                        aria-label="More"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === c.id ? null : c.id);
                        }}
                        data-testid={`alliances-pipeline-more-${c.id}`}
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {menuFor === c.id && (
                        <div
                          className="absolute top-full right-0 mt-1 z-10 rounded-lg overflow-hidden min-w-[140px]"
                          style={{
                            background: TOKENS.SURFACE_2,
                            border: `1px solid ${TOKENS.BORDER}`,
                            boxShadow: '0 12px 24px rgba(0,0,0,0.6)',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="w-full text-left px-3 py-2 text-[11px] hover:bg-white/5"
                            style={{ color: TOKENS.TEXT }}
                            disabled={moving || stage.id === 'won'}
                            onClick={() => handleMove(c.id, stage.id, 1)}
                          >
                            Advance stage →
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-[11px] hover:bg-white/5"
                            style={{ color: TOKENS.TEXT }}
                            disabled={moving || stage.id === 'discovered'}
                            onClick={() => handleMove(c.id, stage.id, -1)}
                          >
                            ← Move back
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-[11px] hover:bg-white/5"
                            style={{ color: TOKENS.TEXT }}
                            onClick={() => {
                              onSelect(c.id);
                              setMenuFor(null);
                            }}
                          >
                            View profile
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
