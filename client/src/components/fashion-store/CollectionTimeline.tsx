/**
 * CollectionTimeline — Chronological brand history & narrative
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Layers } from 'lucide-react';
import type { FashionBrand } from './FashionVirtualStore';

interface Collection {
  id: number;
  name: string;
  season: string;
  year: number;
  theme?: string;
  inspiredBySong?: string;
  heroImageUrl?: string;
  lookbookUrls?: string[];
  status: string;
  dropDate?: string;
  isLimited: boolean;
  createdAt: string;
}

const SEASON_FULL: Record<string, string> = {
  spring_summer: 'Spring / Summer', fall_winter: 'Fall / Winter',
  limited: 'Limited Edition', capsule: 'Capsule', collab: 'Collaboration',
};

interface Props {
  artistId: number;
  brand: FashionBrand | null;
  isOwner: boolean;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
}

export function CollectionTimeline({ artistId, brand, isOwner, colors }: Props) {
  const { data, isLoading } = useQuery<{ collections: Collection[] }>({
    queryKey: ['fashion-collections', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/collections`),
    staleTime: 5 * 60 * 1000,
    enabled: !!brand,
  });

  const collections = [...(data?.collections || [])].sort(
    (a, b) => (b.year || 0) - (a.year || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (!brand) {
    return <p className="text-white/30 text-sm py-8 text-center">Create your fashion brand to see the timeline.</p>;
  }

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>;
  }

  if (collections.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center"
        style={{ border: `1px dashed ${colors.hexBorder}`, background: `${colors.hexPrimary}08` }}>
        <Layers className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-white/40 text-sm">No collections yet</p>
        <p className="text-white/20 text-xs mt-1">Add drops to build your brand timeline</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Brand founded header */}
      {brand.founded && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colors.hexAccent }} />
          <div className="h-px flex-1 opacity-20" style={{ background: colors.hexAccent }} />
          <span className="text-white/30 text-[11px] font-mono shrink-0">FOUNDED {brand.founded}</span>
        </div>
      )}

      {/* Timeline entries */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[5px] top-0 bottom-0 w-px"
          style={{ background: `linear-gradient(to bottom, ${colors.hexAccent}60, transparent)` }} />

        <div className="space-y-8 pl-7">
          {collections.map((col, idx) => (
            <div key={col.id} className="relative">
              {/* Dot */}
              <div className="absolute -left-7 top-1 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: '#050508', borderColor: colors.hexAccent }} />

              {/* Year badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/25 text-[11px] font-mono">{col.year || '—'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: `${colors.hexPrimary}20`, color: colors.hexAccent, border: `1px solid ${colors.hexBorder}` }}>
                  {SEASON_FULL[col.season] || col.season}
                </span>
                {col.isLimited && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300"
                    style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>LTD</span>
                )}
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${colors.hexBorder}` }}>
                {col.heroImageUrl && (
                  <img src={col.heroImageUrl} alt={col.name}
                    className="w-full h-32 object-cover" />
                )}
                <div className="p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <h3 className="text-white font-bold tracking-widest text-sm mb-1">{col.name}</h3>
                  {col.theme && <p className="text-white/50 text-xs leading-relaxed">{col.theme}</p>}
                  {col.inspiredBySong && (
                    <p className="text-white/30 text-[11px] mt-1.5 flex items-center gap-1">
                      🎵 <span className="italic">{col.inspiredBySong}</span>
                    </p>
                  )}

                  {/* Lookbook thumbs */}
                  {col.lookbookUrls && col.lookbookUrls.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {col.lookbookUrls.map((url, i) => (
                        <img key={i} src={url} alt={`Lookbook ${i + 1}`}
                          className="w-12 h-12 object-cover rounded-lg"
                          style={{ border: `1px solid ${colors.hexBorder}` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
