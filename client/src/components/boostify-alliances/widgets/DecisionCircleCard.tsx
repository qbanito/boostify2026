import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { TOKENS } from '../../artist-acquisition/shared/tokens';
import { SectionCard } from '../../artist-acquisition/shared/SectionCard';
import { useDecisionCircle } from '../hooks/useAlliancesApi';

interface DecisionCircleCardProps {
  contactId: number | null;
}

export function DecisionCircleCard({ contactId }: DecisionCircleCardProps) {
  const { data, isLoading } = useDecisionCircle(contactId);
  const [showFullMap, setShowFullMap] = useState(false);

  const center = data?.center || null;
  const nodes: Array<{ id: string; label: string; role: string; person: string; sub: string; angle: number }> =
    data?.nodes || [];

  const svgCenter = { x: 50, y: 50 };
  const radius = 32;

  return (
    <SectionCard
      title="DECISION CIRCLE"
      action={
        <button
          className="text-[11.5px] font-semibold"
          style={{ color: TOKENS.ORANGE_GLOW }}
          onClick={() => setShowFullMap((v) => !v)}
          data-testid="alliances-circle-view-map"
        >
          {showFullMap ? 'Collapse' : 'View full map'}
        </button>
      }
      bodyClassName="p-4"
    >
      {isLoading && !data ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin" style={{ color: TOKENS.MUTED }} />
        </div>
      ) : !center ? (
        <div className="p-6 text-center text-[12px]" style={{ color: TOKENS.MUTED }}>
          Select an artist from the radar to see their decision circle.
        </div>
      ) : (
        <div className={`relative w-full aspect-square mx-auto ${showFullMap ? 'max-w-[560px]' : 'max-w-[460px]'}`}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="dc-center-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,138,31,0.25)" />
                <stop offset="60%" stopColor="rgba(255,138,31,0.06)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <linearGradient id="dc-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,138,31,0.1)" />
                <stop offset="50%" stopColor="rgba(255,138,31,0.6)" />
                <stop offset="100%" stopColor="rgba(255,138,31,0.1)" />
              </linearGradient>
            </defs>

            <circle cx="50" cy="50" r="46" fill="url(#dc-center-grad)" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="1 2" />
            <circle cx="50" cy="50" r="26" fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="1 2" />

            {nodes.map((n) => {
              const rad = (n.angle * Math.PI) / 180;
              const x = svgCenter.x + radius * Math.cos(rad);
              const y = svgCenter.y - radius * Math.sin(rad);
              return (
                <line
                  key={n.id}
                  x1={svgCenter.x}
                  y1={svgCenter.y}
                  x2={x}
                  y2={y}
                  stroke="url(#dc-line)"
                  strokeWidth="0.4"
                />
              );
            })}
          </svg>

          {/* Center artist */}
          <div
            className="absolute rounded-full flex flex-col items-center justify-center text-center"
            style={{
              left: '50%',
              top: '50%',
              width: '30%',
              height: '30%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle at 35% 30%, #3a2a22, #0e0e12)',
              border: `2px solid ${TOKENS.ORANGE_RING}`,
              boxShadow: '0 0 40px rgba(255,138,31,0.35)',
            }}
          >
            <div
              className="w-[60%] h-[60%] rounded-full flex items-center justify-center text-white font-bold text-[18px]"
              style={{
                background: `linear-gradient(135deg, ${center.gradient?.[0] || '#2a1f1a'}, ${center.gradient?.[1] || '#5a3620'})`,
                border: `1px solid ${TOKENS.BORDER}`,
              }}
            >
              {center.initials || '??'}
            </div>
            <div className="text-[10px] font-semibold mt-1 truncate max-w-[90%]" style={{ color: TOKENS.TEXT }}>
              {center.name}
            </div>
          </div>

          {nodes.map((n) => {
            const rad = (n.angle * Math.PI) / 180;
            const x = 50 + radius * Math.cos(rad);
            const y = 50 - radius * Math.sin(rad);
            return (
              <div
                key={n.id}
                className="absolute"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '32%',
                  textAlign: 'center',
                }}
                data-testid={`alliances-circle-node-${n.id}`}
              >
                <div
                  className="mx-auto w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: TOKENS.SURFACE_3,
                    border: `1px solid ${TOKENS.ORANGE_RING}`,
                    color: TOKENS.ORANGE_GLOW,
                    boxShadow: '0 0 18px rgba(255,138,31,0.25)',
                  }}
                >
                  {n.role.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-[8.5px] font-semibold tracking-widest mt-1" style={{ color: TOKENS.MUTED_2 }}>
                  {n.label}
                </div>
                <div className="text-[10.5px] font-semibold truncate" style={{ color: TOKENS.TEXT }}>
                  {n.person}
                </div>
                <div className="text-[9px] truncate" style={{ color: TOKENS.MUTED }}>
                  {n.sub}
                </div>
              </div>
            );
          })}

          <div
            className="absolute"
            style={{ left: '50%', bottom: 0, transform: 'translate(-50%, 50%)', textAlign: 'center' }}
          >
            <a
              href={`/admin/artist-acquisition${contactId ? `?contactId=${contactId}` : ''}`}
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: TOKENS.SURFACE_3,
                border: `1px dashed ${TOKENS.ORANGE_RING}`,
                color: TOKENS.ORANGE_GLOW,
              }}
              aria-label="Add connection"
              title="Manage connections in Artist Acquisition"
              data-testid="alliances-circle-add-connection"
            >
              <Plus size={14} />
            </a>
            <div className="text-[9.5px] mt-1" style={{ color: TOKENS.MUTED }}>
              Add Connection
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
