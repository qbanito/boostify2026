import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { TOKENS } from '../../artist-acquisition/shared/tokens';
import { SectionCard } from '../../artist-acquisition/shared/SectionCard';
import { useArtistRadar } from '../hooks/useAlliancesApi';

interface RadarArtist {
  id: number;
  name: string;
  verified?: boolean;
  location: string;
  label: string;
  genres: string[];
  leadScore: number;
  avatarInitials: string;
  avatarGradient: [string, string];
  imageUrl?: string | null;
}

interface ArtistRadarCardProps {
  searchQuery: string;
  selectedContactId: number | null;
  onSelect: (id: number) => void;
}

export function ArtistRadarCard({ searchQuery, selectedContactId, onSelect }: ArtistRadarCardProps) {
  const { data, isLoading } = useArtistRadar(searchQuery);
  const artists: RadarArtist[] = data?.artists || [];
  const [page, setPage] = useState(0);

  // Auto-select first artist when data loads
  useEffect(() => {
    if (!selectedContactId && artists.length > 0) {
      onSelect(artists[0].id);
    }
  }, [artists, selectedContactId, onSelect]);

  // Reset page on search change
  useEffect(() => { setPage(0); }, [searchQuery]);

  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(artists.length / pageSize));
  const visible = artists.slice(page * pageSize, (page + 1) * pageSize);

  const handleViewAll = () => setPage(0);

  return (
    <SectionCard
      title="ARTIST RADAR"
      action={
        <div className="flex items-center gap-2">
          <button
            className="text-[11.5px] font-semibold"
            style={{ color: TOKENS.ORANGE_GLOW }}
            onClick={handleViewAll}
            data-testid="alliances-radar-view-all"
          >
            View all ({artists.length})
          </button>
          <div className="flex items-center gap-1">
            <button
              className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-40"
              style={{ border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.MUTED }}
              aria-label="Previous"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              data-testid="alliances-radar-prev"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-40"
              style={{ border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.MUTED }}
              aria-label="Next"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              data-testid="alliances-radar-next"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      }
      bodyClassName="p-0"
    >
      {isLoading && artists.length === 0 ? (
        <div className="p-6 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin" style={{ color: TOKENS.MUTED }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="p-6 text-center text-[12px]" style={{ color: TOKENS.MUTED }}>
          No artists found.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: TOKENS.BORDER_SOFT }}>
          {visible.map((a) => {
            const isSelected = a.id === selectedContactId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                data-testid={`alliances-radar-${a.id}`}
                style={{
                  borderBottom: `1px solid ${TOKENS.BORDER_SOFT}`,
                  background: isSelected ? 'rgba(255,122,0,0.08)' : 'transparent',
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-[14px] shrink-0 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${a.avatarGradient[0]}, ${a.avatarGradient[1]})`,
                    color: 'rgba(255,255,255,0.95)',
                    border: `1px solid ${isSelected ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                  }}
                >
                  {a.imageUrl ? (
                    <img src={a.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    a.avatarInitials
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13.5px] font-semibold truncate" style={{ color: TOKENS.TEXT }}>
                      {a.name}
                    </span>
                    {a.verified && <CheckCircle2 size={12} style={{ color: TOKENS.ORANGE_GLOW }} />}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: TOKENS.MUTED }}>
                    {a.location} · {a.label}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {a.genres.slice(0, 3).map((g) => (
                      <span
                        key={g}
                        className="text-[9.5px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          color: TOKENS.MUTED,
                          border: `1px solid ${TOKENS.BORDER_SOFT}`,
                        }}
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[9.5px] font-semibold tracking-widest" style={{ color: TOKENS.MUTED_2 }}>
                    LEAD SCORE
                  </div>
                  <div
                    className="text-[26px] font-black leading-none mt-0.5"
                    style={{ color: TOKENS.ORANGE_GLOW, textShadow: '0 0 14px rgba(255,138,31,0.5)' }}
                  >
                    {a.leadScore}
                  </div>
                  <div className="mt-1 w-[60px] h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${a.leadScore}%`,
                        background: `linear-gradient(90deg, ${TOKENS.ORANGE}, ${TOKENS.ORANGE_GLOW})`,
                        boxShadow: '0 0 10px rgba(255,138,31,0.5)',
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div
        className="w-full flex items-center justify-between gap-1.5 py-3 px-4 text-[11px]"
        style={{ color: TOKENS.MUTED_2, borderTop: `1px solid ${TOKENS.BORDER_SOFT}` }}
      >
        <span>
          Page {page + 1} / {totalPages}
        </span>
        <span>{artists.length} artists ranked</span>
      </div>
    </SectionCard>
  );
}
