/**
 * FashionVirtualStore — Main container module for the Artist Profile
 * 
 * Tab layout:
 *  brand       → Brand Identity (generate + edit)
 *  timeline    → Collection Timeline (brand history)
 *  drops       → Seasonal Drops (active + upcoming)
 *  store       → Virtual Storefront (fan-facing grid)
 *  campaigns   → AI Campaign Generator
 *  tryon       → Virtual Try-On + Fan Scenes
 *  archive     → Brand Archive (past collections)
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Store,
  Image as ImageIcon,
  Megaphone,
  Shirt,
  Users,
  Archive,
  Clock,
  Loader2,
} from 'lucide-react';
import { BrandIdentityPanel } from './BrandIdentityPanel';
import { CollectionTimeline } from './CollectionTimeline';
import { SeasonalDropsPanel } from './SeasonalDropsPanel';
import { VirtualStorefront } from './VirtualStorefront';
import { FashionCampaignGenerator } from './FashionCampaignGenerator';
import { FashionTryOnPanel } from './FashionTryOnPanel';
import { BrandArchive } from './BrandArchive';
import { FashionStoreLandingPage } from './FashionStoreLandingPage';

export interface FashionBrand {
  id: number;
  userId: number;
  brandName: string;
  tagline?: string;
  aesthetic?: string;
  colorPalette?: string[];
  typographyStyle?: string;
  logoUrl?: string;
  moodboardUrls?: string[];
  brandManifesto?: string;
  brandStory?: string;
  founded?: string;
  influences?: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FashionVirtualStoreProps {
  artistId: number;
  artistData?: any;
  isOwner: boolean;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
}

const TABS = [
  { value: 'brand',     label: 'Brand',     icon: Sparkles },
  { value: 'drops',     label: 'Drops',     icon: Clock },
  { value: 'store',     label: 'Store',     icon: Store },
  { value: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { value: 'tryon',     label: 'Try-On',    icon: Shirt },
  { value: 'timeline',  label: 'Timeline',  icon: ImageIcon },
  { value: 'archive',   label: 'Archive',   icon: Archive },
];

export function FashionVirtualStore({
  artistId,
  artistData,
  isOwner,
  colors,
  cardStyles,
  cardStyleInline,
}: FashionVirtualStoreProps) {
  const [activeTab, setActiveTab] = useState('brand');
  const [landingOpen, setLandingOpen] = useState(false);

  const { data: brandData, isLoading, refetch: refetchBrand } = useQuery<{ success: boolean; brand: FashionBrand | null }>({
    queryKey: ['fashion-brand', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/brand`),
    staleTime: 5 * 60 * 1000,
  });

  const brand = brandData?.brand || null;

  const accentStyle = { color: colors.hexAccent };
  const borderStyle = { borderColor: colors.hexBorder };

  return (
    <div
      className={`${cardStyles} overflow-hidden`}
      style={{
        ...cardStyleInline,
        background: 'linear-gradient(135deg, rgba(5,5,10,0.97) 0%, rgba(10,8,18,0.99) 100%)',
        border: `1px solid ${colors.hexBorder}`,
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${colors.hexPrimary}25`, border: `1px solid ${colors.hexPrimary}40` }}
          >
            <Shirt className="w-5 h-5" style={accentStyle} />
          </div>
          <div>
            <h2 className="text-white font-bold text-base tracking-tight leading-tight">
              {brand?.brandName || 'Fashion Virtual Store'}
            </h2>
            <p className="text-white/40 text-xs mt-0.5">
              {brand?.tagline || 'Your living fashion universe'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {brand?.isPublished && (
              <div className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider"
                style={{ background: `${colors.hexAccent}20`, color: colors.hexAccent, border: `1px solid ${colors.hexAccent}30` }}>
                LIVE
              </div>
            )}
            <button
              onClick={() => setLandingOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-90"
              style={{ background: colors.hexPrimary, boxShadow: `0 2px 12px ${colors.hexPrimary}50` }}
            >
              <Sparkles className="w-3 h-3" />
              Open Fashion Universe
            </button>
          </div>
        </div>

        {/* Brand moodboard strip if available */}
        {brand?.moodboardUrls && brand.moodboardUrls.length > 0 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {brand.moodboardUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Moodboard ${i + 1}`}
                className="h-16 w-28 object-cover rounded-lg shrink-0 opacity-80"
                style={{ border: `1px solid ${colors.hexBorder}` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <ScrollArea className="w-full" type="scroll">
          <TabsList
            className="flex gap-0.5 h-auto p-1 mx-4 mb-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap rounded-lg text-white/40 data-[state=active]:text-white transition-all"
                  style={activeTab === tab.value ? { background: `${colors.hexPrimary}30`, color: colors.hexAccent } : undefined}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </ScrollArea>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        ) : (
          <>
            <TabsContent value="brand" className="mt-0 px-4 pb-5">
              <BrandIdentityPanel
                artistId={artistId}
                brand={brand}
                isOwner={isOwner}
                colors={colors}
                onBrandSaved={refetchBrand}
              />
            </TabsContent>

            <TabsContent value="timeline" className="mt-0 px-4 pb-5">
              <CollectionTimeline
                artistId={artistId}
                brand={brand}
                isOwner={isOwner}
                colors={colors}
              />
            </TabsContent>

            <TabsContent value="drops" className="mt-0 px-4 pb-5">
              <SeasonalDropsPanel
                artistId={artistId}
                brand={brand}
                isOwner={isOwner}
                colors={colors}
              />
            </TabsContent>

            <TabsContent value="store" className="mt-0 px-4 pb-5">
              <VirtualStorefront
                artistId={artistId}
                brand={brand}
                isOwner={isOwner}
                colors={colors}
              />
            </TabsContent>

            <TabsContent value="campaigns" className="mt-0 px-4 pb-5">
              <FashionCampaignGenerator
                artistId={artistId}
                brand={brand}
                isOwner={isOwner}
                colors={colors}
              />
            </TabsContent>

            <TabsContent value="tryon" className="mt-0 px-4 pb-5">
              <FashionTryOnPanel
                artistId={artistId}
                brand={brand}
                isOwner={isOwner}
                colors={colors}
              />
            </TabsContent>

            <TabsContent value="archive" className="mt-0 px-4 pb-5">
              <BrandArchive
                artistId={artistId}
                brand={brand}
                isOwner={isOwner}
                colors={colors}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Full-screen landing page */}
      {landingOpen && (
        <FashionStoreLandingPage
          artistId={artistId}
          artistData={artistData}
          brand={brand}
          isOwner={isOwner}
          onClose={() => setLandingOpen(false)}
        />
      )}
    </div>
  );
}
