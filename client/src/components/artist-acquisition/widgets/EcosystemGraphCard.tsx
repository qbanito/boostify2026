import { useEffect, useState } from 'react';
import { Maximize2, User, Mic2, Users, ListMusic, Heart, Building2, Loader2 } from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { Modal } from '../shared/Modal';
import { TOKENS } from '../shared/tokens';
import { apiRequest } from '../../../lib/queryClient';
import { ecosystemNodes, featuredArtist } from '../../../data/mockArtistAcquisition';
import type { AcquisitionEcosystemNode, AcquisitionFeaturedArtist } from '../../../hooks/use-acquisition-overview';

const ICONS: Record<string, any> = {
  manager: User,
  producer: Mic2,
  collaborators: Users,
  playlists: ListMusic,
  fans: Heart,
  labels: Building2,
  artist: User,
  peer: Users,
};

interface EcosystemPerson {
  id: string;
  name: string;
  role: string;
  country?: string;
  genre?: string;
  source?: string;
  weight: number;
  score?: number;
}

export function EcosystemGraphCard({
  nodes,
  artist,
}: {
  nodes?: AcquisitionEcosystemNode[];
  artist?: AcquisitionFeaturedArtist | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [people, setPeople] = useState<EcosystemPerson[] | null>(null);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const nodesToUse = nodes && nodes.length ? nodes : ecosystemNodes;
  const artistToUse = artist || featuredArtist;

  // Fetch real ecosystem persons the first time the modal opens for this artist.
  useEffect(() => {
    if (!expanded || !artistToUse?.id || people !== null) return;
    setLoadingPeople(true);
    apiRequest('GET', `/api/admin/artist-acquisition/ecosystem/${encodeURIComponent(artistToUse.id)}`)
      .then((res: any) => setPeople(res?.nodes || []))
      .catch(() => setPeople([]))
      .finally(() => setLoadingPeople(false));
  }, [expanded, artistToUse?.id, people]);

  // Reset people when artist changes.
  useEffect(() => {
    setPeople(null);
  }, [artistToUse?.id]);

  const W = 360;
  const H = 270;
  const cx = W / 2;
  const cy = H / 2;
  const radius = 100;

  const positions = nodesToUse.map((n, i) => {
    const angle = typeof n.angle === 'number' ? n.angle : (i * 360) / Math.max(nodesToUse.length, 1) - 90;
    const rad = (angle * Math.PI) / 180;
    return {
      ...n,
      x: cx + Math.cos(rad) * radius,
      y: cy + Math.sin(rad) * radius * 0.85,
    };
  });

  return (
    <SectionCard
      number="02"
      title="Ecosystem Graph"
      action={
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-md transition-colors hover:bg-white/5"
          style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}
        >
          <Maximize2 size={11} />
          Expand
        </button>
      }
      bodyClassName="flex items-center justify-center relative"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxHeight: 280 }}
      >
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={TOKENS.ORANGE} stopOpacity={0.5} />
            <stop offset="100%" stopColor={TOKENS.ORANGE} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={TOKENS.ORANGE} stopOpacity={0.7} />
            <stop offset="100%" stopColor={TOKENS.ORANGE} stopOpacity={0.15} />
          </linearGradient>
        </defs>

        {/* Glow under center */}
        <circle cx={cx} cy={cy} r={48} fill="url(#centerGlow)" />

        {/* Connection lines */}
        {positions.map((p) => {
          const mx = (cx + p.x) / 2;
          const my = (cy + p.y) / 2 - 8;
          return (
            <path
              key={'line-' + p.id}
              d={`M${cx},${cy} Q${mx},${my} ${p.x},${p.y}`}
              stroke="url(#lineGrad)"
              strokeWidth={1}
              fill="none"
              opacity={0.85}
            />
          );
        })}

        {/* Center artist node */}
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={26}
            fill={TOKENS.SURFACE_3}
            stroke={TOKENS.ORANGE}
            strokeWidth={1.5}
          />
          <clipPath id="clip-center">
            <circle cx={cx} cy={cy} r={24} />
          </clipPath>
          <image
            href={artistToUse.avatar}
            x={cx - 24}
            y={cy - 24}
            width={48}
            height={48}
            clipPath="url(#clip-center)"
            preserveAspectRatio="xMidYMid slice"
          />
        </g>

        {/* Ring nodes */}
        {positions.map((p) => (
          <circle
            key={'dot-' + p.id}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={TOKENS.ORANGE_GLOW}
            stroke={TOKENS.SURFACE_2}
            strokeWidth={2}
          />
        ))}
      </svg>

      {/* Labels overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {positions.map((p) => {
          const Icon = ICONS[p.id];
          const leftPct = (p.x / W) * 100;
          const topPct = (p.y / H) * 100;
          // Offset labels outward from center
          const dxSign = p.x > cx ? 1 : -1;
          const dySign = p.y > cy ? 1 : p.y < cy - 20 ? -1 : 0;
          return (
            <div
              key={'lbl-' + p.id}
              className="absolute text-[10.5px] leading-tight"
              style={{
                left: `calc(${leftPct}% + ${dxSign * 14}px)`,
                top: `calc(${topPct}% + ${dySign * 22}px)`,
                transform: `translate(${dxSign < 0 ? '-100%' : '0'}, -50%)`,
                whiteSpace: 'nowrap',
                textAlign: dxSign < 0 ? 'right' : 'left',
              }}
            >
              <div
                className="flex items-center gap-1"
                style={{ color: TOKENS.MUTED, justifyContent: dxSign < 0 ? 'flex-end' : 'flex-start' }}
              >
                {Icon && <Icon size={10} />}
                <span>{p.label}</span>
              </div>
              <div
                className="font-semibold"
                style={{ color: TOKENS.TEXT, fontSize: 11 }}
              >
                {p.value}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={expanded}
        onClose={() => setExpanded(false)}
        title={`${artistToUse.name} · Ecosystem`}
        subtitle="Manager, producer, collaborators, playlists, fans and labels connected to this artist."
        size="lg"
      >
        <div
          className="rounded-xl p-4 sm:p-6"
          style={{
            background: TOKENS.SURFACE_3,
            border: `1px solid ${TOKENS.BORDER}`,
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {nodesToUse.map((n) => {
              const Icon = ICONS[n.id] || User;
              return (
                <div
                  key={n.id}
                  className="rounded-lg p-3 flex items-center gap-3"
                  style={{
                    background: TOKENS.SURFACE_2,
                    border: `1px solid ${TOKENS.BORDER}`,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: TOKENS.ORANGE_SOFT,
                      border: `1px solid ${TOKENS.ORANGE_RING}`,
                    }}
                  >
                    <Icon size={14} style={{ color: TOKENS.ORANGE_GLOW }} />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-[10.5px] uppercase tracking-wider"
                      style={{ color: TOKENS.MUTED }}
                    >
                      {n.label}
                    </div>
                    <div
                      className="text-[13px] font-semibold truncate"
                      style={{ color: TOKENS.TEXT }}
                    >
                      {n.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real persons around the artist */}
          <div className="mt-4">
            <div
              className="text-[10.5px] uppercase tracking-wider mb-2"
              style={{ color: TOKENS.MUTED }}
            >
              Related people (derived from shared country / genre / source)
            </div>
            {loadingPeople && (
              <div className="flex items-center gap-2 text-[12px]" style={{ color: TOKENS.MUTED }}>
                <Loader2 size={12} className="animate-spin" /> Loading ecosystem…
              </div>
            )}
            {!loadingPeople && people && people.length === 0 && (
              <div className="text-[12px]" style={{ color: TOKENS.MUTED }}>
                No related people found yet for {artistToUse?.name}.
              </div>
            )}
            {!loadingPeople && people && people.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {people.map((p) => {
                  const Icon = ICONS[p.role] || User;
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg p-2.5 flex items-center gap-2.5"
                      style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}` }}
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
                      >
                        <Icon size={12} style={{ color: TOKENS.ORANGE_GLOW }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold truncate" style={{ color: TOKENS.TEXT }}>
                          {p.name}
                        </div>
                        <div className="text-[10.5px] truncate" style={{ color: TOKENS.MUTED }}>
                          {p.role}{p.country ? ` • ${p.country}` : ''}{p.genre ? ` • ${p.genre}` : ''}
                        </div>
                      </div>
                      {typeof p.score === 'number' && (
                        <span className="text-[10.5px] font-mono" style={{ color: TOKENS.ORANGE_GLOW }}>
                          {p.score}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </SectionCard>
  );
}
