import { Loader2, ImageIcon } from 'lucide-react';
import { TOKENS } from '../../artist-acquisition/shared/tokens';
import { SectionCard } from '../../artist-acquisition/shared/SectionCard';
import { ImageEnrichmentBanner } from '../ImageEnrichmentBanner';
import { useAssets } from '../hooks/useAlliancesApi';

interface AssetsSectionProps {
  onSelect: (id: number) => void;
  selectedContactId: number | null;
}

export function AssetsSection({ onSelect, selectedContactId }: AssetsSectionProps) {
  const { data, isLoading } = useAssets();
  const assets: Array<{
    id: number; name: string; initials: string; gradient: [string, string];
    profileImageUrl?: string | null; boostifyImageUrl?: string | null; heroImageUrl?: string | null;
    moodKeywords: string[]; referenceCount: number;
  }> = data?.assets || [];
  const counts = data?.counts || { total: 0, withProfile: 0, withBoostify: 0, withReferences: 0 };

  return (
    <div className="space-y-4">
      <ImageEnrichmentBanner />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total artists', value: counts.total },
          { label: 'With profile image', value: counts.withProfile },
          { label: 'Boostify-styled', value: counts.withBoostify },
          { label: 'Reference boards', value: counts.withReferences },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl p-3"
            style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}` }}
          >
            <div className="text-[10.5px] font-semibold tracking-widest" style={{ color: TOKENS.MUTED_2 }}>
              {kpi.label.toUpperCase()}
            </div>
            <div className="text-[22px] font-black mt-1" style={{ color: TOKENS.TEXT }}>
              {kpi.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <SectionCard title="VISUAL ASSETS LIBRARY" bodyClassName="p-3">
        {isLoading && assets.length === 0 ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 size={14} className="animate-spin" style={{ color: TOKENS.MUTED }} />
          </div>
        ) : assets.length === 0 ? (
          <div className="p-8 text-center text-[12px]" style={{ color: TOKENS.MUTED }}>
            No visual assets yet. Run image enrichment above to fetch artist photos from Spotify.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {assets.map((a) => {
              const url = a.boostifyImageUrl || a.heroImageUrl || a.profileImageUrl;
              const isSelected = a.id === selectedContactId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a.id)}
                  className="group relative aspect-square rounded-xl overflow-hidden text-left"
                  data-testid={`alliances-asset-${a.id}`}
                  style={{
                    background: `linear-gradient(135deg, ${a.gradient[0]}, ${a.gradient[1]})`,
                    border: `1px solid ${isSelected ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                    boxShadow: isSelected ? '0 0 14px rgba(255,138,31,0.35)' : 'none',
                  }}
                >
                  {url ? (
                    <img
                      src={url}
                      alt={a.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
                      <span className="absolute bottom-2 left-2 right-2 text-[11px] font-bold" style={{ color: '#fff' }}>
                        {a.initials}
                      </span>
                    </div>
                  )}
                  <div
                    className="absolute inset-x-0 bottom-0 px-2 py-1.5"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}
                  >
                    <div className="text-[10.5px] font-semibold truncate" style={{ color: '#fff' }}>
                      {a.name}
                    </div>
                    {a.referenceCount > 0 && (
                      <div className="text-[9px]" style={{ color: TOKENS.ORANGE_GLOW }}>
                        {a.referenceCount} refs
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
