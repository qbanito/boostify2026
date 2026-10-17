/**
 * FashionStoreLandingPage
 * Full-screen cinematic landing page for the Artist's Fashion Virtual Universe.
 * Opened via a button in FashionVirtualStore.tsx.
 *
 * Concept: Virtual fashion — digital garments for AR try-on, promo videos,
 * and social media content. NOT physical merchandise.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  X, ArrowLeft, Shirt, Sparkles, Globe,
  Play, Camera, Share2, Clock, ChevronRight, Zap,
  Image as ImageIcon, Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { FashionBrand } from './FashionVirtualStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string;
  description?: string;
  category: string;
  price: string;
  productImageUrls?: string[];
  colorways?: string[];
  sizes?: string[];
  isAvailable: boolean;
}

interface Collection {
  id: number;
  name: string;
  season: string;
  year: number;
  theme?: string;
  heroImageUrl?: string;
  lookbookUrls?: string[];
  dropDate?: string;
  status: string;
  isLimited?: boolean;
}

interface Props {
  artistId: number;
  artistData?: any;
  brand: FashionBrand | null;
  isOwner: boolean;
  onClose: () => void;
  onTryOn: (productId?: number) => void;
  onOpenCampaigns: () => void;
}

// ─── Countdown Hook ────────────────────────────────────────────────────────────

function useCountdown(targetDate?: string) {
  const getTimeLeft = useCallback(() => {
    const target = targetDate ? new Date(targetDate) : null;
    if (!target || Number.isNaN(target.getTime())) return { days: 0, hrs: 0, min: 0, sec: 0 };
    const diff = Math.max(0, target.getTime() - Date.now());
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hrs: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      min: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      sec: Math.floor((diff % (1000 * 60)) / 1000),
    };
  }, [targetDate]);

  const [time, setTime] = useState(getTimeLeft);
  useEffect(() => {
    if (!targetDate || Number.isNaN(new Date(targetDate).getTime())) return;
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, [getTimeLeft, targetDate]);
  return time;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-white font-black text-2xl leading-none tabular-nums"
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-white/40 text-[9px] font-bold tracking-widest uppercase mt-1">{label}</div>
    </div>
  );
}

function VirtualBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
      style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
      <Zap className="w-2.5 h-2.5" /> VIRTUAL
    </span>
  );
}

function NavLink({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group transition-all">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-105"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Icon className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
      </div>
      <span className="text-white/50 text-[10px] font-semibold group-hover:text-white/80 transition-colors">{label}</span>
    </button>
  );
}

function ProductCard({ product, accentColor, onTryOn }: { product: Product; accentColor: string; onTryOn: (productId: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const img = product.productImageUrls?.[0];
  const canTryOn = Boolean(img) && product.isAvailable;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer group"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${hovered ? accentColor + '50' : 'rgba(255,255,255,0.08)'}`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-black/40">
        {img ? (
          <img src={img} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Shirt className="w-10 h-10 text-white/10" />
          </div>
        )}
        {/* Virtual overlay badge */}
        <div className="absolute top-2 left-2">
          <VirtualBadge />
        </div>
        {/* Try-on hover overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{
            background: 'rgba(0,0,0,0.5)',
            opacity: hovered ? 1 : 0,
          }}
        >
          <button
            type="button"
            onClick={() => onTryOn(product.id)}
            disabled={!canTryOn}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white transition-transform"
            style={{ background: canTryOn ? accentColor : '#52525b', cursor: canTryOn ? 'pointer' : 'not-allowed' }}
          >
            <Camera className="w-3.5 h-3.5" /> {canTryOn ? 'Try On' : 'Unavailable'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-white/80 font-bold text-xs tracking-wider truncate">{product.name}</p>
        <p className="text-white/40 text-[10px] mt-0.5 capitalize">{product.category}</p>
        <button type="button" disabled={!canTryOn} onClick={() => onTryOn(product.id)}
          className="mt-3 w-full rounded-lg py-2 text-[11px] font-bold text-white"
          style={{ background: canTryOn ? `${accentColor}30` : 'rgba(255,255,255,0.06)', border: `1px solid ${accentColor}50`, cursor: canTryOn ? 'pointer' : 'not-allowed' }}>
          {canTryOn ? 'Try on this look' : 'Try-on unavailable'}
        </button>
      </div>
    </div>
  );
}

function TimelineNode({ collection, accentColor }: { collection: Collection; accentColor: string }) {
  return (
    <div className="flex-none w-40">
      <div className="w-3 h-3 rounded-full mb-3 mx-auto" style={{ background: accentColor }} />
      <div className="rounded-xl overflow-hidden mb-2" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {collection.heroImageUrl ? (
          <img src={collection.heroImageUrl} alt={collection.name} className="w-full h-24 object-cover" />
        ) : (
          <div className="w-full h-24 bg-white/05 flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-white/15" />
          </div>
        )}
      </div>
      <p className="text-white/30 text-[9px] font-bold tracking-widest uppercase text-center">{collection.year}</p>
      <p className="text-white font-bold text-xs text-center tracking-wide mt-0.5">{collection.name}</p>
      {collection.theme && (
        <p className="text-white/40 text-[10px] text-center mt-1 line-clamp-2">{collection.theme}</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FashionStoreLandingPage({ artistId, artistData, brand, isOwner, onClose, onTryOn, onOpenCampaigns }: Props) {
  const accentColor = '#8b5cf6';
  const [storyOpen, setStoryOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const shareUniverse = async () => {
    const shareData = { title: `${brand?.brandName || 'Fashion Universe'} on Boostify`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
      }
    } catch {
      // The user may dismiss the native share dialog; no follow-up is needed.
    }
  };

  // Data
  const { data: productsData } = useQuery<{ success: boolean; products: Product[] }>({
    queryKey: ['fashion-products', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/products`),
    staleTime: 3 * 60 * 1000,
  });

  const { data: collectionsData } = useQuery<{ success: boolean; collections: Collection[] }>({
    queryKey: ['fashion-collections', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/collections`),
    staleTime: 3 * 60 * 1000,
  });

  const { data: campaignsData } = useQuery<{ success: boolean; campaigns: Array<{ id: number; title: string; campaignImages?: string[] }> }>({
    queryKey: ['fashion-campaigns', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/campaigns`),
    staleTime: 3 * 60 * 1000,
  });

  const products = (productsData?.products || []).filter(product => product.isAvailable);
  const collections = collectionsData?.collections || [];
  const campaigns = campaignsData?.campaigns || [];

  // Next drop
  const upcomingDrop = collections.find(c => c.status === 'upcoming' && c.dropDate && new Date(c.dropDate).getTime() > Date.now());
  const countdown = useCountdown(upcomingDrop?.dropDate);

  // Hero images
  const heroImage = brand?.moodboardUrls?.[0]
    || brand?.logoUrl
    || artistData?.profileImage
    || artistData?.image
    || null;

  const heroImage2 = brand?.moodboardUrls?.[1] || heroImage;

  const artistName = artistData?.artistName || artistData?.name || brand?.brandName || 'Artist';
  const brandName = brand?.brandName || `${artistName} STUDIO`;
  const tagline = brand?.tagline || 'Fashion beyond music';
  const manifesto = brand?.brandManifesto || brand?.aesthetic || 'A living fashion universe born from sound, culture, and identity.';

  // Wardrobe mock (3 saved items from products)
  const featuredCollection = collections.find(collection => collection.status === 'active')
    || collections.find(collection => collection.status === 'upcoming')
    || collections[0];

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto"
      style={{ background: '#04040a', fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── TOP NAV ──────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(4,4,10,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Artist Profile
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}30` }}>
            <Globe className="w-3.5 h-3.5" style={{ color: accentColor }} />
          </div>
          <button type="button" aria-label="Share fashion universe" onClick={shareUniverse}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Share2 className="w-3.5 h-3.5 text-white/60" />
          </button>
          <button
            onClick={() => scrollTo('fashion-products')}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: accentColor }}>
            <Sparkles className="w-3 h-3" /> Enter Universe
          </button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="relative min-h-[520px] flex items-end overflow-hidden">
        {/* BG image */}
        {heroImage && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})`, filter: 'brightness(0.35) saturate(1.2)' }}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(4,4,10,0.3) 0%, rgba(4,4,10,0.6) 60%, rgba(4,4,10,1) 100%)' }} />

        {/* Accent glow */}
        <div className="absolute top-1/2 left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)`, transform: 'translate(-50%,-50%)' }} />

        <div className="relative z-10 w-full px-8 pb-10 flex items-end justify-between gap-8">
          {/* Brand info */}
          <div className="flex-1 max-w-2xl">
            <VirtualBadge />
            <h1 className="text-white font-black text-4xl md:text-5xl tracking-tight leading-none mt-3 mb-1">
              FASHION VIRTUAL STORE
            </h1>
            <p className="font-bold tracking-[0.3em] text-sm mb-4" style={{ color: accentColor }}>
              {brandName.toUpperCase()}
            </p>
            <p className="text-white/60 text-sm leading-relaxed max-w-md mb-6">
              {manifesto}
            </p>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => scrollTo('fashion-collections')}
                className="rounded-full font-bold text-sm text-white"
                style={{ background: accentColor, padding: '10px 24px' }}
              >
                Explore Brand <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="outline" onClick={() => setStoryOpen(true)}
                className="rounded-full font-bold text-sm border-white/20 text-white/70 hover:text-white bg-transparent"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" /> Watch Story
              </Button>
            </div>
          </div>

          {/* Next Drop widget */}
          {upcomingDrop && (
            <div className="shrink-0 rounded-2xl p-5 min-w-[220px]"
              style={{ background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="flex items-center gap-2 mb-3">
                {heroImage2 && (
                  <img src={heroImage2} alt="drop" className="w-8 h-8 rounded-lg object-cover" />
                )}
                <div>
                  <p className="text-white/40 text-[9px] font-bold tracking-widest uppercase">Next Drop</p>
                  <p className="text-white font-bold text-xs tracking-wider">
                    {upcomingDrop.name.toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <CountdownUnit value={countdown.days} label="DAYS" />
                <span className="text-white/30 font-black text-lg">:</span>
                <CountdownUnit value={countdown.hrs} label="HRS" />
                <span className="text-white/30 font-black text-lg">:</span>
                <CountdownUnit value={countdown.min} label="MIN" />
                <span className="text-white/30 font-black text-lg">:</span>
                <CountdownUnit value={countdown.sec} label="SEC" />
              </div>
              <button
                onClick={() => scrollTo('fashion-collections')}
                className="w-full py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
                View Drop
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── NAV STRIP ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-8 py-5 px-8"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <NavLink icon={ImageIcon} label="Brand Story" onClick={() => setStoryOpen(true)} />
        <NavLink icon={Shirt} label="Collections" onClick={() => scrollTo('fashion-collections')} />
        <NavLink icon={Camera} label="Virtual Try-On" onClick={() => onTryOn()} />
        <NavLink icon={Video} label="Campaigns" onClick={onOpenCampaigns} />
      </div>

      {/* ── VIRTUAL CONCEPT BANNER ───────────────────────────────────────── */}
      <div
        className="mx-6 my-5 rounded-2xl p-4 flex items-center gap-4"
        style={{ background: `linear-gradient(135deg, ${accentColor}10, rgba(236,72,153,0.08))`, border: `1px solid ${accentColor}25` }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}20` }}>
          <Zap className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        <div>
          <p className="text-white font-bold text-sm">Virtual Fashion Universe</p>
          <p className="text-white/50 text-xs mt-0.5">
            Estos son looks digitales exclusivos de {artistName}. Pruébatelos en fotos y videos — úsalos en tus contenidos de promo, reels y stories.
          </p>
        </div>
        <div className="ml-auto shrink-0 flex items-center gap-2">
          <Camera className="w-4 h-4 text-white/30" />
          <Video className="w-4 h-4 text-white/30" />
          <Share2 className="w-4 h-4 text-white/30" />
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="px-6 pb-10 space-y-8">

        {/* Featured Collection + Products row */}
        <div id="fashion-collections" className="grid grid-cols-1 lg:grid-cols-2 gap-5 scroll-mt-24">

          {/* Featured Collection */}
          <div className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="relative h-56 bg-black/40">
              {featuredCollection?.heroImageUrl ? (
                <img src={featuredCollection.heroImageUrl} alt={featuredCollection.name}
                  className="w-full h-full object-cover" />
              ) : brand?.moodboardUrls?.[0] ? (
                <img src={brand.moodboardUrls[0]} alt="collection"
                  className="w-full h-full object-cover opacity-70" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${accentColor}15, rgba(0,0,0,0.3))` }}>
                  <Shirt className="w-16 h-16 text-white/10" />
                </div>
              )}
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(0deg, rgba(4,4,10,0.95) 0%, transparent 60%)' }} />
              <div className="absolute bottom-4 left-4">
                <p className="text-white/40 text-[9px] font-bold tracking-widest uppercase mb-1">Featured Collection</p>
                <h3 className="text-white font-black text-2xl tracking-tight leading-none">
                  {featuredCollection?.name?.toUpperCase() || 'NO COLLECTION PUBLISHED'}
                </h3>
                {featuredCollection?.year && (
                  <p className="font-semibold text-xs mt-1" style={{ color: accentColor }}>
                    ERA {featuredCollection.year}
                  </p>
                )}
              </div>
              {featuredCollection?.isLimited && (
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}>
                    LIMITED EDITION
                  </span>
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-white/50 text-xs leading-relaxed line-clamp-2">
                {featuredCollection?.theme || brand?.brandStory || manifesto}
              </p>
              <Button
                onClick={() => scrollTo('fashion-products')}
                className="mt-4 rounded-full text-xs font-bold text-white w-full"
                style={{ background: `${accentColor}30`, color: accentColor, border: `1px solid ${accentColor}40` }}
              >
                Explore Collection
              </Button>
            </div>
          </div>

          {/* Featured Products */}
          <div id="fashion-products" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm tracking-wide">FEATURED PRODUCTS</h3>
              <button onClick={() => scrollTo('fashion-products')} className="text-xs font-semibold" style={{ color: accentColor }}>View all</button>
            </div>
            {products.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center rounded-2xl"
                style={{ border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                <Shirt className="w-8 h-8 text-white/10 mb-2" />
                <p className="text-white/30 text-xs">Virtual items coming soon</p>
                {isOwner && (
                  <p className="text-white/20 text-[10px] mt-1">Generate products from the Store tab</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.slice(0, 4).map(p => (
                  <ProductCard key={p.id} product={p} accentColor={accentColor} onTryOn={onTryOn} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Brand Timeline */}
        {collections.length > 0 && (
          <div id="fashion-timeline" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm tracking-wide">BRAND TIMELINE</h3>
              <span className="text-white/30 text-xs">{collections.length} eras</span>
            </div>
            {/* Horizontal line */}
            <div className="relative mb-6">
              <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
            </div>
            <div className="flex gap-6 overflow-x-auto pb-4 -mx-2 px-2">
              {collections.map(col => (
                <TimelineNode key={col.id} collection={col} accentColor={accentColor} />
              ))}
            </div>
          </div>
        )}

        {/* Try-On + Wardrobe row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Try-On Experience — spans 2 cols */}
          <div id="fashion-try-on" className="lg:col-span-2 rounded-2xl overflow-hidden scroll-mt-24"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" style={{ color: accentColor }} />
                <h3 className="text-white font-bold text-sm tracking-wide">TRY-ON EXPERIENCE</h3>
                <button onClick={() => onTryOn()} className="ml-auto text-xs font-semibold" style={{ color: accentColor }}>
                  Open try-on studio
                </button>
              </div>
            </div>

            <div className="p-4">
              <p className="text-white/45 text-xs mb-4">
                Elige un look y abre el probador para subir tu foto y generar una vista personalizada.
              </p>

              {/* CTA row */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onTryOn(products[0]?.id)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
                  <Camera className="w-3.5 h-3.5" /> Open Virtual Try-On
                </button>
                <button onClick={onOpenCampaigns}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Video className="w-3.5 h-3.5" /> Campaign Studio
                </button>
              </div>
            </div>
          </div>

          {/* Brand details */}
          <div className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm tracking-wide">BRAND IDENTITY</h3>
              </div>
            </div>

            <div className="p-3">
              <p className="text-white/45 text-xs leading-relaxed">{brand?.brandStory || manifesto}</p>
              {brand?.colorPalette && brand.colorPalette.length > 0 && (
                <div className="flex items-center gap-2 mt-4" aria-label="Brand color palette">
                  {brand.colorPalette.slice(0, 6).map((color, index) => (
                    <span key={`${color}-${index}`} title={color} className="w-6 h-6 rounded-full border border-white/20"
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              )}
              <Button onClick={() => setStoryOpen(true)} variant="outline"
                className="w-full mt-4 rounded-xl text-xs border-white/10 text-white/70 bg-transparent">
                Read the brand story
              </Button>
            </div>
          </div>
        </div>

        {/* Campaign preview strip */}
        {brand && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm tracking-wide">LATEST CAMPAIGNS</h3>
              <button onClick={onOpenCampaigns} className="text-xs font-semibold flex items-center gap-1" style={{ color: accentColor }}>
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div
              className="rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[140px]"
              style={{
                background: `linear-gradient(135deg, ${accentColor}10, rgba(236,72,153,0.08), rgba(4,4,10,0.5))`,
                border: `1px solid ${accentColor}25`,
                backgroundImage: campaigns[0]?.campaignImages?.[0] ? `url(${campaigns[0].campaignImages[0]})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {campaigns[0]?.campaignImages?.[0] && (
                <div className="absolute inset-0" style={{ background: 'rgba(4,4,10,0.7)' }} />
              )}
              <div className="relative z-10">
                <p className="text-white/40 text-[10px] font-bold tracking-widest uppercase mb-1">Fashion Campaign</p>
                <p className="text-white font-black text-lg">{campaigns[0]?.title || brandName}</p>
                <p className="text-white/50 text-xs mt-1 mb-4">{campaigns.length ? tagline : 'No campaign assets yet.'}</p>
                <div className="flex items-center justify-center gap-3">
                  {isOwner && <button onClick={onOpenCampaigns}
                    className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold text-white"
                    style={{ background: accentColor }}>
                    <Video className="w-3 h-3" /> {campaigns.length ? 'Open Campaign Studio' : 'Generate Campaign'}
                  </button>}
                  {campaigns[0]?.campaignImages?.[0] && <a
                    href={campaigns[0].campaignImages[0]}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white/75"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    View Campaign Asset
                  </a>}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── CLOSE BUTTON (FAB) ───────────────────────────────────────────── */}
      <Dialog open={storyOpen} onOpenChange={setStoryOpen}>
        <DialogContent className="bg-[#08080f] border-white/10 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>{brand?.brandName || brandName}</DialogTitle>
            <DialogDescription className="text-white/45">{brand?.tagline || tagline}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-white/75">{brand?.brandStory || manifesto}</p>
            {brand?.brandManifesto && brand.brandManifesto !== brand.brandStory && (
              <p className="text-sm leading-relaxed text-white/50">{brand.brandManifesto}</p>
            )}
            {brand?.influences && brand.influences.length > 0 && (
              <p className="text-xs text-white/40">Influences: {brand.influences.join(' · ')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <button
        onClick={onClose}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110"
        style={{ background: accentColor, boxShadow: `0 4px 24px ${accentColor}60` }}
      >
        <X className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}
