/**
 * BrandArchive — Complete collection grid with stats
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Archive, Package } from 'lucide-react';
import type { FashionBrand } from './FashionVirtualStore';

interface Collection {
  id: number;
  name: string;
  season: string;
  year: number;
  theme?: string;
  heroImageUrl?: string;
  status: string;
  isLimited: boolean;
  productCount?: number;
}

interface Props {
  artistId: number;
  brand: FashionBrand | null;
  isOwner: boolean;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
}

const STATUS_OPTIONS = ['all', 'draft', 'upcoming', 'active', 'archived'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'rgba(255,255,255,0.2)',
  upcoming: 'rgba(59,130,246,0.5)',
  active: 'rgba(34,197,94,0.5)',
  archived: 'rgba(156,163,175,0.3)',
};

export function BrandArchive({ artistId, brand, isOwner, colors }: Props) {
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: colData, isLoading: colLoading } = useQuery<{ collections: Collection[] }>({
    queryKey: ['fashion-collections', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/collections`),
    staleTime: 5 * 60 * 1000,
    enabled: !!brand,
  });

  const { data: prodData } = useQuery<{ products: any[] }>({
    queryKey: ['fashion-products', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/products`),
    staleTime: 5 * 60 * 1000,
    enabled: !!brand,
  });

  const allCollections = colData?.collections || [];
  const totalProducts = prodData?.products?.length || 0;
  const filtered = statusFilter === 'all' ? allCollections : allCollections.filter(c => c.status === statusFilter);

  if (!brand) {
    return <p className="text-white/30 text-sm py-8 text-center">Create your fashion brand first.</p>;
  }

  if (colLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Collections', value: allCollections.length },
          { label: 'Products', value: totalProducts },
          { label: 'Limited Drops', value: allCollections.filter(c => c.isLimited).length },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-3 text-center"
            style={{ background: `${colors.hexPrimary}10`, border: `1px solid ${colors.hexBorder}` }}>
            <p className="text-white font-bold text-xl">{stat.value}</p>
            <p className="text-white/30 text-[10px]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
            style={statusFilter === s
              ? { background: colors.hexPrimary, color: 'white' }
              : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center"
          style={{ border: `1px dashed ${colors.hexBorder}`, background: `${colors.hexPrimary}08` }}>
          <Archive className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-white/40 text-sm">No collections found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(col => (
            <div key={col.id} className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${colors.hexBorder}` }}>
              <div className="relative h-28 bg-zinc-900">
                {col.heroImageUrl ? (
                  <img src={col.heroImageUrl} alt={col.name}
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-white/10" />
                  </div>
                )}
                {/* Status chip */}
                <div className="absolute top-2 right-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize"
                    style={{ background: STATUS_COLORS[col.status] || 'rgba(255,255,255,0.2)', color: 'white' }}>
                    {col.status}
                  </span>
                </div>
                {col.isLimited && (
                  <div className="absolute top-2 left-2">
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-amber-300"
                      style={{ background: 'rgba(245,158,11,0.3)' }}>LTD</span>
                  </div>
                )}
              </div>
              <div className="p-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-white text-xs font-bold truncate tracking-wider">{col.name}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{col.year} · {col.season}</p>
                {col.theme && <p className="text-white/20 text-[10px] mt-1 line-clamp-2 leading-relaxed">{col.theme}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
