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
  X, ArrowLeft, Shirt, Sparkles, Globe, Bell, ShoppingBag,
  Play, Camera, Share2, Clock, ChevronRight, Star, Zap,
  Award, Users, Image as ImageIcon, Video, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

// ─── Countdown Hook ────────────────────────────────────────────────────────────

function useCountdown(targetDate?: string) {
  const getTimeLeft = useCallback(() => {
    const target = targetDate ? new Date(targetDate) : new Date(Date.now() + 12 * 24 * 3600 * 1000 + 7 * 3600 * 1000 + 32 * 60 * 1000 + 45 * 1000);
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
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, [getTimeLeft]);
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

function NavLink({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button className="flex flex-col items-center gap-1.5 group transition-all">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-105"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Icon className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
      </div>
      <span className="text-white/50 text-[10px] font-semibold group-hover:text-white/80 transition-colors">{label}</span>
    </button>
  );
}

function ProductCard({ product, accentColor }: { product: Product; accentColor: string }) {
  const [hovered, setHovered] = useState(false);
  const img = product.productImageUrls?.[0];

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
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white transition-transform"
            style={{ background: accentColor }}
          >
            <Camera className="w-3.5 h-3.5" /> Try On
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-white/80 font-bold text-xs tracking-wider truncate">{product.name}</p>
        <p className="text-white/40 text-[10px] mt-0.5 capitalize">{product.category}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-white font-black text-sm">${product.price}</span>
          <button
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
            style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}>
            <ShoppingBag className="w-3 h-3" />
          </button>
        </div>
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

export function FashionStoreLandingPage({ artistId, artistData, brand, isOwner, onClose }: Props) {
  const accentColor = '#8b5cf6';

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

  const products = productsData?.products || [];
  const collections = collectionsData?.collections || [];

  // Next drop
  const upcomingDrop = collections.find(c => c.status === 'upcoming' && c.dropDate) || collections[0];
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
  const wardrobeItems = products.slice(0, 3);

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
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Bell className="w-3.5 h-3.5 text-white/50" />
          </div>
          <button
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
                className="rounded-full font-bold text-sm text-white"
                style={{ background: accentColor, padding: '10px 24px' }}
              >
                Explore Brand <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="outline"
                className="rounded-full font-bold text-sm border-white/20 text-white/70 hover:text-white bg-transparent"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" /> Watch Story
              </Button>
            </div>
          </div>

          {/* Next Drop widget */}
          {(upcomingDrop || true) && (
            <div className="shrink-0 rounded-2xl p-5 min-w-[220px]"
              style={{ background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="flex items-center gap-2 mb-3">
                {heroImage2 && (
                  <img src={heroImage2} alt="drop" className="w-8 h-8 rounded-lg object-cover" />
                )}
                <div>
                  <p className="text-white/40 text-[9px] font-bold tracking-widest uppercase">Next Drop</p>
                  <p className="text-white font-bold text-xs tracking-wider">
                    {upcomingDrop?.name?.toUpperCase() || 'WORLD TOUR CAPSULE'}
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
        <NavLink icon={ImageIcon} label="Brand Story" />
        <NavLink icon={Shirt} label="Collections" />
        <NavLink icon={Camera} label="Virtual Try-On" />
        <NavLink icon={Video} label="Campaigns" />
        <NavLink icon={Users} label="Collabs" />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Featured Collection */}
          <div className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="relative h-56 bg-black/40">
              {collections[0]?.heroImageUrl ? (
                <img src={collections[0].heroImageUrl} alt={collections[0].name}
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
                  {collections[0]?.name?.toUpperCase() || 'ORIGIN COLLECTION'}
                </h3>
                {collections[0]?.year && (
                  <p className="font-semibold text-xs mt-1" style={{ color: accentColor }}>
                    ERA {collections[0].year}
                  </p>
                )}
              </div>
              {collections[0]?.isLimited && (
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
                {collections[0]?.theme || brand?.brandStory || manifesto}
              </p>
              <Button
                className="mt-4 rounded-full text-xs font-bold text-white w-full"
                style={{ background: `${accentColor}30`, color: accentColor, border: `1px solid ${accentColor}40` }}
              >
                Explore Collection
              </Button>
            </div>
          </div>

          {/* Featured Products */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm tracking-wide">FEATURED PRODUCTS</h3>
              <button className="text-xs font-semibold" style={{ color: accentColor }}>View all</button>
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
                  <ProductCard key={p.id} product={p} accentColor={accentColor} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Brand Timeline */}
        {collections.length > 0 && (
          <div>
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
              {collections.length === 0 && (
                [1,2,3,4].map(i => (
                  <div key={i} className="flex-none w-40 opacity-20">
                    <div className="w-3 h-3 rounded-full mb-3 mx-auto" style={{ background: accentColor }} />
                    <div className="w-full h-24 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Try-On + Wardrobe row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Try-On Experience — spans 2 cols */}
          <div className="lg:col-span-2 rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" style={{ color: accentColor }} />
                <h3 className="text-white font-bold text-sm tracking-wide">TRY-ON EXPERIENCE</h3>
                <button className="ml-auto text-xs font-semibold" style={{ color: accentColor }}>
                  See full experience
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {/* Upload slot */}
                <div className="aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:border-white/20"
                  style={{ border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2"
                    style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}>
                    <span className="text-white/60 text-lg font-thin">+</span>
                  </div>
                  <p className="text-white/30 text-[9px] text-center font-medium">Upload your photo<br />and try it on</p>
                </div>

                {/* Existing try-on scenes (from products) */}
                {products.slice(0, 2).map((p, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden relative group">
                    {p.productImageUrls?.[1] ? (
                      <img src={p.productImageUrls[1]} alt="tryon"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${accentColor}15, rgba(0,0,0,0.3))` }}>
                        <Shirt className="w-8 h-8 text-white/15" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.5)' }}>
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA row */}
              <div className="flex items-center gap-3">
                <button
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
                  <Camera className="w-3.5 h-3.5" /> Upload Photo & Try On
                </button>
                <button
                  className="py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Video className="w-3.5 h-3.5" /> Promo Video
                </button>
              </div>
            </div>
          </div>

          {/* Your Wardrobe */}
          <div className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm tracking-wide">YOUR WARDROBE</h3>
                <span className="text-white/30 text-xs">{wardrobeItems.length} items</span>
              </div>
            </div>

            <div className="p-3">
              {wardrobeItems.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2">
                  <ShoppingBag className="w-6 h-6 text-white/10" />
                  <p className="text-white/25 text-xs text-center">Save virtual items to your wardrobe</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {wardrobeItems.map((item, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden"
                      style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                      {item.productImageUrls?.[0] ? (
                        <img src={item.productImageUrls[0]} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/05">
                          <Shirt className="w-4 h-4 text-white/20" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                className="w-full py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Go to Wardrobe
              </button>
            </div>

            {/* Earn Rewards */}
            <div className="p-3 pt-0">
              <div className="rounded-xl p-3"
                style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20` }}>
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <p className="text-white font-semibold text-xs">EARN REWARDS</p>
                </div>
                <p className="text-white/40 text-[10px] leading-relaxed mb-2">
                  Compra, crea y participa para ganar Boostify Coins.
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: accentColor }}>
                    <Star className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-white font-black text-sm">2,450</span>
                  <button className="ml-auto text-[10px] font-bold" style={{ color: accentColor }}>
                    View Rewards
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign preview strip */}
        {brand && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm tracking-wide">LATEST CAMPAIGNS</h3>
              <button className="text-xs font-semibold flex items-center gap-1" style={{ color: accentColor }}>
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div
              className="rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[140px]"
              style={{
                background: `linear-gradient(135deg, ${accentColor}10, rgba(236,72,153,0.08), rgba(4,4,10,0.5))`,
                border: `1px solid ${accentColor}25`,
                backgroundImage: brand?.moodboardUrls?.[1] ? `url(${brand.moodboardUrls[1]})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {brand?.moodboardUrls?.[1] && (
                <div className="absolute inset-0" style={{ background: 'rgba(4,4,10,0.7)' }} />
              )}
              <div className="relative z-10">
                <p className="text-white/40 text-[10px] font-bold tracking-widest uppercase mb-1">Fashion Content</p>
                <p className="text-white font-black text-lg">{brandName}</p>
                <p className="text-white/50 text-xs mt-1 mb-4">{tagline}</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold text-white"
                    style={{ background: accentColor }}>
                    <Video className="w-3 h-3" /> Generate Campaign
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white/60"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <Download className="w-3 h-3" /> Download Assets
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── CLOSE BUTTON (FAB) ───────────────────────────────────────────── */}
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
