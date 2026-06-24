/**
 * Official Store Section — Enhanced with AI recommendations, quick view,
 * wishlist, social proof, mini-dashboard, filter chips, skeleton loaders, etc.
 *
 * Replaces the inline merchandise block in artist-profile-card.tsx.
 */
import { useState, useEffect, useMemo, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, ShoppingCart, Sparkles, Store, Heart, Eye, Share2,
  TrendingUp, Flame, Crown, Package, X, Loader2, DollarSign,
  Users, BarChart3, Tag, Shirt, Music, Gift, Clock, Wand2, Calendar,
  Layers, Zap, AlertCircle, Box,
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCart } from '@/contexts/cart-context';
import { OrdersPanel } from './orders-panel';
import { ManageProductsPanel } from './manage-products-panel';

// Experiencia virtual 3D inmersiva (lazy)
const Virtual3DStore = lazy(() => import('@/components/store/Virtual3DStore'));

// ───────────────────────── Types ─────────────────────────
export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category?: string;
  userId: string;
  sizes?: string[];
  createdAt?: any;
  // Enhanced fields (optional, gracefully fall back when missing)
  productStatus?: 'active' | 'pre_order' | 'limited' | 'sold_out' | 'archived';
  expiresAt?: string | Date | null;
  preOrderReleaseDate?: string | Date | null;
  preOrderMinimumOrders?: number;
  preOrderCurrentOrders?: number;
  seasonalCollection?: string | null;
  aiGeneratedDesign?: boolean;
  viewCount?: number;
  type?: string;
}

interface Colors {
  hexAccent: string;
  hexPrimary: string;
  hexBorder: string;
}

interface StoreBundle {
  id: number;
  name: string;
  description?: string | null;
  productIds: string[] | number[];
  originalPrice: string | number;
  bundlePrice: string | number;
  discountPercent: number;
  imageUrl?: string | null;
  isActive?: boolean;
  aiGenerated?: boolean;
  expiresAt?: string | Date | null;
}

interface HeatmapEntry {
  merchandiseId: string;
  name: string;
  imageUrl?: string | null;
  views: number;
  sales: number;
  conversionRate: number;
}

interface SeasonalInfo {
  name: string;
  theme: string;
  discount: number;
  icon?: string;
}

interface OfficialStoreSectionProps {
  products: StoreProduct[];
  artist: {
    pgId: number;
    name: string;
    slug?: string;
    profileImage?: string;
  };
  colors: Colors;
  isOwnProfile: boolean;
  hasContract: boolean;
  artistRevenueShare?: string | number;
  masterJson?: any;
  onBuyClick: (product: StoreProduct) => void;
}

// ───────────────────────── Helpers ─────────────────────────

// SVG placeholder generator — uses artist color instead of generic Unsplash
const makePlaceholderSvg = (color: string, label: string = 'Merch') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.3"/><stop offset="1" stop-color="${color}" stop-opacity="0.05"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="210" font-family="system-ui, sans-serif" font-weight="bold" font-size="28" fill="${color}" text-anchor="middle" opacity="0.6">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Responsive srcset helper for Printful / generic CDN images
const makeSrcSet = (url: string | null | undefined, widths: number[] = [200, 400, 800]): string | undefined => {
  if (!url) return undefined;
  // Printful supports ?size=W for on-the-fly resizing; fall back to original URL if not
  if (/printful|files\.cdn\.printful/.test(url)) {
    return widths.map(w => `${url}${url.includes('?') ? '&' : '?'}size=${w} ${w}w`).join(', ');
  }
  return undefined;
};

// Error boundary — keeps the rest of the profile alive if the store crashes
class StoreErrorBoundary extends Component<
  { children: ReactNode; colors: Colors; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  state: { hasError: boolean; error?: Error } = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[OfficialStore ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div
          className="p-6 rounded-xl border text-center"
          style={{ background: `${this.props.colors.hexPrimary}08`, borderColor: this.props.colors.hexBorder }}
        >
          <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-60" style={{ color: this.props.colors.hexAccent }} />
          <p className="text-sm text-gray-400">Store temporarily unavailable. Please refresh.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// LocalStorage wishlist hook
const useWishlist = (userId: number) => {
  const key = `boostify_wishlist_${userId}`;
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setItems(JSON.parse(raw));
    } catch {/* ignore */}
  }, [key]);

  const toggle = useCallback((id: string) => {
    setItems(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {/* ignore */}
      return next;
    });
  }, [key]);

  return { items, toggle, has: (id: string) => items.includes(id) };
};

// Smart sort using masterJson context (client-side AI-style sort)
const sortByRelevance = (products: StoreProduct[], masterJson: any): StoreProduct[] => {
  if (!masterJson || !products.length) return products;

  const genre = (masterJson?.musical_dna?.genre || masterJson?.canonical?.genre || '').toLowerCase();
  const aesthetic = (masterJson?.visual_dna?.aesthetic || '').toLowerCase();
  const ageRange = masterJson?.audience?.demographics?.ageRange || '';

  // Young audience prefers apparel, hats, phone cases
  const youngBias = /teen|18|19|20|21|22|23|24|25/.test(ageRange);
  // Darker aesthetics → hoodies/apparel; lighter → stickers/drinkware
  const darkBias = /dark|black|gothic|noir|shadow|underground/.test(aesthetic + ' ' + genre);

  return [...products].sort((a, b) => {
    const scoreA = getRelevanceScore(a, { youngBias, darkBias });
    const scoreB = getRelevanceScore(b, { youngBias, darkBias });
    return scoreB - scoreA;
  });
};

const getRelevanceScore = (p: StoreProduct, opts: { youngBias: boolean; darkBias: boolean }): number => {
  const cat = (p.category || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  let score = 0;

  if (opts.youngBias) {
    if (/apparel|hoodie|tee|t-shirt|hat|beanie|phone/.test(cat + name)) score += 10;
  }
  if (opts.darkBias) {
    if (/hoodie|jacket|sweatshirt|black|dark/.test(cat + name)) score += 8;
  }
  // Universally strong categories
  if (/apparel|hoodie/.test(cat + name)) score += 5;
  // Price sweet spot $20-$45
  if (p.price >= 20 && p.price <= 45) score += 3;

  return score;
};

// Mock "currently viewing" counter — real implementation would be WebSocket
const useLiveViewers = (productId: string): number => {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    // Deterministic pseudo-random based on product ID so it's stable per product
    const seed = productId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const base = (seed % 12) + 3; // 3–14 viewers
    setCount(base);
    const interval = setInterval(() => {
      setCount(c => Math.max(2, c + (Math.random() > 0.5 ? 1 : -1)));
    }, 8000);
    return () => clearInterval(interval);
  }, [productId]);
  return count;
};

// ───────────────────────── Component ─────────────────────────

export function OfficialStoreSection(props: OfficialStoreSectionProps) {
  // Error boundary wrapper — if anything in the store breaks, show a fallback
  return (
    <StoreErrorBoundary colors={props.colors}>
      <OfficialStoreSectionInner {...props} />
    </StoreErrorBoundary>
  );
}

function OfficialStoreSectionInner({
  products,
  artist,
  colors,
  isOwnProfile,
  hasContract,
  artistRevenueShare = '70',
  masterJson,
  onBuyClick,
}: OfficialStoreSectionProps) {
  const { toast } = useToast();
  const cart = useCart();
  const queryClient = useQueryClient();
  const wishlist = useWishlist(artist.pgId);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [quickView, setQuickView] = useState<StoreProduct | null>(null);
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(6); // Infinite-scroll pagination
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch live sales stats (owner only)
  const { data: ownerStats } = useQuery<{
    salesToday: number;
    totalSales: number;
    topProduct?: { name: string; sales: number };
    monthlyEarnings: number;
    conversionRate: number;
  }>({
    queryKey: ['/api/merch/stats', artist.pgId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/merch/stats/${artist.pgId}`);
        if (!res.ok) throw new Error('No stats');
        return res.json();
      } catch {
        // Graceful fallback so mini-dashboard still renders
        return { salesToday: 0, totalSales: 0, monthlyEarnings: 0, conversionRate: 0 };
      }
    },
    enabled: isOwnProfile && hasContract,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch bundles (public)
  const { data: bundlesData } = useQuery<{ bundles: StoreBundle[] }>({
    queryKey: ['/api/store/bundles', artist.pgId],
    queryFn: async () => {
      const res = await fetch(`/api/store/bundles/${artist.pgId}`);
      if (!res.ok) return { bundles: [] };
      return res.json();
    },
    enabled: !!artist.pgId,
    staleTime: 5 * 60 * 1000,
  });
  const bundles = bundlesData?.bundles || [];

  // Heat map (owner only, on-demand)
  const { data: heatmapData, refetch: refetchHeatmap } = useQuery<{ heatmap: HeatmapEntry[] }>({
    queryKey: ['/api/store/views/heatmap', artist.pgId],
    queryFn: async () => {
      const res = await fetch(`/api/store/views/heatmap/${artist.pgId}`);
      if (!res.ok) return { heatmap: [] };
      return res.json();
    },
    enabled: isOwnProfile && showHeatmap,
    staleTime: 2 * 60 * 1000,
  });

  // Current seasonal drop
  const { data: seasonalData } = useQuery<{ seasonal: SeasonalInfo; products: StoreProduct[] }>({
    queryKey: ['/api/store/seasonal/current', artist.pgId],
    queryFn: async () => {
      const res = await fetch(`/api/store/seasonal/current/${artist.pgId}`);
      if (!res.ok) return { seasonal: { name: '', theme: '', discount: 0 }, products: [] };
      return res.json();
    },
    enabled: !!artist.pgId,
    staleTime: 10 * 60 * 1000,
  });

  // AI mutations (owner only)
  const generateBundlesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/bundles/ai-generate/${artist.pgId}`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/store/bundles', artist.pgId] });
      toast({ title: `✨ ${data.count} bundles created!`, description: 'AI-generated combo deals for your fans.' });
    },
    onError: (e: any) => toast({ title: 'Bundle generation failed', description: e.message, variant: 'destructive' }),
  });

  const generateDesignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/ai/generate-design/${artist.pgId}`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || json.error || 'Failed');
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['merchandise'] });
      toast({
        title: `🎨 ${data.count || 6} draft products created!`,
        description: 'Review and publish each product from your store dashboard. They are currently in draft mode.',
      });
    },
    onError: (e: any) => {
      const isNoBlueprint = e.message?.includes('no_blueprint') || e.message?.includes('Blueprint');
      toast({
        title: isNoBlueprint ? '🎯 Superstar Blueprint Required' : 'Product generation failed',
        description: isNoBlueprint
          ? 'Generate your Superstar Blueprint first — it defines your visual identity for coherent merchandise.'
          : e.message,
        variant: 'destructive',
      });
    },
  });

  const createSeasonalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/seasonal/create-drop/${artist.pgId}`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      return json;
    },
    onSuccess: (data) => {
      toast({ title: `🗓️ ${data.seasonal.name} drop created!`, description: `${data.productsTagged} products tagged as limited edition.` });
      queryClient.invalidateQueries({ queryKey: ['merchandise'] });
    },
    onError: (e: any) => toast({ title: 'Seasonal drop failed', description: e.message, variant: 'destructive' }),
  });

  // Compute categories from products
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      const cat = p.category || 'Other';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [products]);

  // Tanda 5 — visitantes solo ven productos disponibles; el owner los ve todos.
  const availableProducts = useMemo(
    () => isOwnProfile ? products : products.filter((p: any) => p?.isAvailable !== false),
    [products, isOwnProfile]
  );

  // AI-sorted products (using masterJson)
  const sortedProducts = useMemo(() => sortByRelevance(availableProducts, masterJson), [availableProducts, masterJson]);

  // Filter by category
  const visibleProducts = useMemo(() => {
    const base = activeCategory
      ? sortedProducts.filter(p => (p.category || 'Other') === activeCategory)
      : sortedProducts;
    return base.slice(0, visibleCount);
  }, [sortedProducts, activeCategory, visibleCount]);

  const totalFiltered = useMemo(() => (
    activeCategory
      ? sortedProducts.filter(p => (p.category || 'Other') === activeCategory).length
      : sortedProducts.length
  ), [sortedProducts, activeCategory]);

  // ── Datos para la experiencia virtual 3D ──
  const products3D = useMemo(
    () =>
      sortedProducts
        .filter(p => !!p.imageUrl && !p.imageUrl.startsWith('data:'))
        .slice(0, 16)
        .map(p => ({ id: p.id, name: p.name, price: Number(p.price) || 0, imageUrl: p.imageUrl })),
    [sortedProducts]
  );
  const brand3DColors = useMemo(
    () => ({ primary: colors.hexPrimary, secondary: colors.hexBorder, accent: colors.hexAccent }),
    [colors]
  );
  const genre3D: string | undefined =
    masterJson?.genre || masterJson?.brandColors ? (masterJson?.genre as string | undefined) : undefined;
  const logo3D: string | undefined =
    masterJson?.referenceImages?.masterLogo || masterJson?.masterLogo || undefined;

  // Avatar 3D del artista (si existe) para colocarlo dentro de la boutique 3D
  const { data: avatar3D } = useQuery<{ glbUrl?: string; animatedGlbUrl?: string; animatedUrl?: string; animatedFormat?: string } | null>({
    queryKey: ['artist-avatar-3d', artist.pgId],
    queryFn: async () => {
      const res = await fetch(`/api/hologram-gallery/${artist.pgId}/character-3d`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json?.character as any) || null;
    },
    enabled: !!artist.pgId,
    staleTime: 10 * 60 * 1000,
  });

  // Decoración (arte mural + texturas de entorno OpenAI) de la boutique 3D
  const store3DSlug = artist.slug || artist.name.toLowerCase().replace(/\s+/g, '-');
  const { data: boutiquePieces } = useQuery<Array<{ role?: string; imageUrl: string }>>({
    queryKey: ['artist-boutique-decor', store3DSlug],
    queryFn: async () => {
      const res = await fetch(`/api/artist-store/${store3DSlug}/boutique-decor`);
      if (!res.ok) return [];
      const json = await res.json();
      const pieces = json?.decor?.pieces as Array<{ role?: string; imageUrl: string }> | undefined;
      return (pieces || []).filter((p) => !!p?.imageUrl);
    },
    enabled: !!store3DSlug,
    staleTime: 10 * 60 * 1000,
  });
  const boutiqueDecor = useMemo(
    () => (boutiquePieces || []).filter((p) => p.role !== 'wall-texture' && p.role !== 'floor-texture').map((p) => p.imageUrl),
    [boutiquePieces]
  );
  const wallTextureUrl = useMemo(() => (boutiquePieces || []).find((p) => p.role === 'wall-texture')?.imageUrl, [boutiquePieces]);
  const floorTextureUrl = useMemo(() => (boutiquePieces || []).find((p) => p.role === 'floor-texture')?.imageUrl, [boutiquePieces]);

  // Props 3D (Meshy) de la boutique — candelabro, esculturas
  const { data: boutiqueProps } = useQuery<Array<{ key?: string; glbUrl: string }>>({
    queryKey: ['artist-boutique-props', store3DSlug],
    queryFn: async () => {
      const res = await fetch(`/api/artist-store/${store3DSlug}/boutique-props`);
      if (!res.ok) return [];
      const json = await res.json();
      const props = json?.props?.props as Array<{ key?: string; glbUrl: string }> | undefined;
      return (props || []).filter((p) => !!p?.glbUrl);
    },
    enabled: !!store3DSlug,
    staleTime: 10 * 60 * 1000,
  });

  // Infinite scroll — load more when sentinel is visible
  useEffect(() => {
    if (!loadMoreRef.current || visibleCount >= totalFiltered) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(c => Math.min(c + 6, totalFiltered));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [visibleCount, totalFiltered]);

  // Reset visible count when category changes
  useEffect(() => {
    setVisibleCount(6);
  }, [activeCategory]);

  const realProductCount = products.length;
  const countBadge = realProductCount >= 100
    ? `${Math.floor(realProductCount / 10) * 10}+ Products`
    : `${realProductCount} Products`;

  // Best-seller / new badges — first item = top pick, newest = new
  const topPickId = sortedProducts[0]?.id;
  const newestId = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    return sorted[0]?.id;
  }, [products]);

  const handleShareProduct = (product: StoreProduct) => {
    const url = `${window.location.origin}/artist/${artist.slug || artist.name.toLowerCase().replace(/\s+/g, '-')}/store?product=${product.id}`;
    if (navigator.share) {
      navigator.share({ title: product.name, text: `Check out ${product.name} by ${artist.name}`, url }).catch(() => {/* ignore */});
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: '🔗 Link copied!', description: 'Share & earn commission on every sale.' });
    }
  };

  const handleAddToCart = (product: StoreProduct, preferredSize?: string) => {
    const selectedSize = preferredSize || product.sizes?.[0] || '';
    cart.addItem({
      source: 'firestore',
      productId: product.id,
      artistSlug: artist.slug || artist.name.toLowerCase().replace(/\s+/g, '-'),
      artistName: artist.name,
      artistUserId: artist.pgId,
      name: product.name,
      imageUrl: product.imageUrl || '',
      price: Number(product.price) || 0,
      size: selectedSize,
      productType: product.type || product.category || 'Merch',
      isCustomProduct: product.aiGeneratedDesign === false,
    });
    toast({
      title: 'Added to cart',
      description: `${product.name}${selectedSize ? ` (${selectedSize})` : ''}`,
    });
  };

  const toggleWishlist = (product: StoreProduct) => {
    wishlist.toggle(product.id);
    const added = !wishlist.has(product.id);
    toast({
      title: added ? '❤️ Added to wishlist' : '💔 Removed from wishlist',
      description: added ? `We'll notify you about ${product.name}` : undefined,
    });
  };

  // Track a product view (fire-and-forget)
  const trackView = useCallback((product: StoreProduct, source: string = 'card') => {
    if (!artist.pgId || !Number.isFinite(Number(artist.pgId))) return;
    if (!product?.id) return;
    try {
      fetch('/api/store/views/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchandiseId: product.id,
          artistId: artist.pgId,
          source,
          sessionId: (window as any).__bfySessionId || undefined,
        }),
      }).catch(() => {/* silent */});
    } catch {/* silent */}
  }, [artist.pgId]);

  const openQuickView = (product: StoreProduct) => {
    setQuickView(product);
    trackView(product, 'quick_view');
  };

  return (
    <>
      <style>{`
        @keyframes store3dLoaderSpin { to { transform: rotate(360deg); } }
        @keyframes store3dLoaderSpinRev { to { transform: rotate(-360deg); } }
        @keyframes store3dPortalHalo { 0%,100% { opacity: 0.35; } 50% { opacity: 0.85; } }
        .store3d-loader-ring { animation: store3dLoaderSpin 1.1s linear infinite; }
        .store3d-loader-ring-rev { animation: store3dLoaderSpinRev 1.6s linear infinite; }
        .store3d-portal-halo { animation: store3dPortalHalo 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .store3d-loader-ring, .store3d-loader-ring-rev, .store3d-portal-halo { animation: none !important; }
        }
      `}</style>
      {/* Experiencia virtual 3D inmersiva */}
      {show3D && (
        <div className="fixed inset-0 z-[100] bg-black">
          <Suspense
            fallback={
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
                <div
                  className="pointer-events-none absolute inset-0 opacity-50"
                  style={{ background: `radial-gradient(circle at 50% 45%, ${colors.hexAccent}33, transparent 60%)` }}
                />
                <div className="relative text-center">
                  <div className="relative mx-auto mb-5 h-20 w-20">
                    <span
                      className="store3d-loader-ring absolute inset-0 rounded-full motion-reduce:animate-none"
                      style={{ border: '2px solid transparent', borderTopColor: colors.hexPrimary, borderRightColor: colors.hexAccent }}
                    />
                    <span
                      className="store3d-loader-ring-rev absolute inset-1.5 rounded-full motion-reduce:animate-none"
                      style={{ border: '2px solid transparent', borderBottomColor: colors.hexAccent }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Box className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold tracking-wide text-white">Building {artist.name}'s 3D universe…</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-white/40">Immersive boutique</p>
                </div>
              </div>
            }
          >
            <Virtual3DStore
              products={products3D}
              artistName={artist.name}
              genre={genre3D}
              brandColors={brand3DColors}
              logoUrl={logo3D}
              avatarUrl={avatar3D?.animatedUrl || avatar3D?.animatedGlbUrl || avatar3D?.glbUrl || undefined}
              avatarFormat={(avatar3D?.animatedFormat as 'glb' | 'fbx') || 'glb'}
              decorImages={boutiqueDecor}
              wallTextureUrl={wallTextureUrl}
              floorTextureUrl={floorTextureUrl}
              propModels={boutiqueProps}
              storeSlug={store3DSlug}
              onProductClick={() => setShow3D(false)}
            />
          </Suspense>
          <button
            onClick={() => setShow3D(false)}
            className="absolute right-4 top-4 z-10 flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white outline-none backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Exit 3D experience"
          >
            <X className="h-4 w-4" /> Exit 3D
          </button>
          <div
            className="absolute left-4 top-4 z-10 rounded-full border bg-black/50 px-3 py-1.5 text-xs font-semibold backdrop-blur-md"
            style={{ borderColor: `${colors.hexAccent}50`, color: colors.hexAccent }}
          >
            <Sparkles className="mr-1 inline h-3 w-3" />
            {artist.name} · 3D STORE
          </div>
        </div>
      )}

      {/* Owner mini-dashboard */}
      {isOwnProfile && hasContract && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2"
        >
          <StatCard
            icon={<DollarSign className="w-3.5 h-3.5" />}
            label="Sales Today"
            value={`${ownerStats?.salesToday ?? 0}`}
            color={colors.hexAccent}
          />
          <StatCard
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="Month"
            value={`$${(ownerStats?.monthlyEarnings ?? 0).toFixed(0)}`}
            color={colors.hexAccent}
          />
          <StatCard
            icon={<Package className="w-3.5 h-3.5" />}
            label="Total Sold"
            value={`${ownerStats?.totalSales ?? 0}`}
            color={colors.hexAccent}
          />
          <StatCard
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            label="Conv. Rate"
            value={`${(ownerStats?.conversionRate ?? 0).toFixed(1)}%`}
            color={colors.hexAccent}
          />
        </motion.div>
      )}

      {/* Owner: manual fulfillment dashboard for custom drops */}
      {isOwnProfile && hasContract && artist.pgId && (
        <OrdersPanel artistPgId={artist.pgId} colors={colors} />
      )}

      {/* Owner: manage products (AI generate, custom upload, edit, delete) */}
      {isOwnProfile && hasContract && artist.pgId && (
        <ManageProductsPanel
          artistPgId={artist.pgId}
          artistName={artist.name}
          artistSlug={artist.slug || artist.name.toLowerCase().replace(/\s+/g, '-')}
          brandImage={artist.profileImage || ''}
          colors={colors}
        />
      )}

      {/* Owner AI actions + heatmap toggle */}
      {isOwnProfile && hasContract && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => generateDesignMutation.mutate()}
            disabled={generateDesignMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 disabled:opacity-60"
            style={{ borderColor: `${colors.hexAccent}50`, background: `${colors.hexAccent}10`, color: colors.hexAccent }}
            data-testid="button-ai-generate-design"
          >
            {generateDesignMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            AI Design
          </button>
          <button
            onClick={() => generateBundlesMutation.mutate()}
            disabled={generateBundlesMutation.isPending || products.length < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 disabled:opacity-40"
            style={{ borderColor: `${colors.hexAccent}50`, background: `${colors.hexAccent}10`, color: colors.hexAccent }}
            data-testid="button-ai-generate-bundles"
          >
            {generateBundlesMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
            AI Bundles
          </button>
          <button
            onClick={() => createSeasonalMutation.mutate()}
            disabled={createSeasonalMutation.isPending || products.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 disabled:opacity-40"
            style={{ borderColor: `${colors.hexAccent}50`, background: `${colors.hexAccent}10`, color: colors.hexAccent }}
            data-testid="button-create-seasonal"
          >
            {createSeasonalMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
            Seasonal Drop
          </button>
          <button
            onClick={() => { setShowHeatmap(v => !v); if (!showHeatmap) refetchHeatmap(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105"
            style={{ borderColor: `${colors.hexAccent}50`, background: showHeatmap ? `${colors.hexAccent}25` : `${colors.hexAccent}10`, color: colors.hexAccent }}
            data-testid="button-toggle-heatmap"
          >
            <Zap className="w-3 h-3" />
            {showHeatmap ? 'Hide Heatmap' : 'Heatmap'}
          </button>
        </div>
      )}

      {/* Heatmap panel */}
      {isOwnProfile && showHeatmap && (
        <HeatmapPanel data={heatmapData?.heatmap || []} colors={colors} />
      )}

      {/* Seasonal drop banner */}
      {seasonalData?.seasonal?.name && seasonalData.products.length > 0 && (
        <SeasonalDropBanner
          seasonal={seasonalData.seasonal}
          productCount={seasonalData.products.length}
          colors={colors}
        />
      )}

      {/* Category filter chips (inline, no need to go to full store) */}
      {categories.length > 1 && (
        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <CategoryChip
            active={!activeCategory}
            onClick={() => setActiveCategory('')}
            color={colors.hexAccent}
            label="All"
            count={products.length}
          />
          {categories.slice(0, 8).map(cat => (
            <CategoryChip
              key={cat.name}
              active={activeCategory === cat.name}
              onClick={() => setActiveCategory(cat.name)}
              color={colors.hexAccent}
              label={cat.name}
              count={cat.count}
            />
          ))}
        </div>
      )}

      {/* Product grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {visibleProducts.length === 0 && (
          // Skeleton loaders while empty
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="rounded-lg overflow-hidden animate-pulse"
              style={{ background: `${colors.hexPrimary}10`, border: `1px solid ${colors.hexBorder}` }}
            >
              <div className="aspect-square" style={{ background: `${colors.hexPrimary}15` }} />
              <div className="p-3 space-y-2">
                <div className="h-3 rounded" style={{ background: `${colors.hexPrimary}20` }} />
                <div className="h-2 w-2/3 rounded" style={{ background: `${colors.hexPrimary}15` }} />
              </div>
            </div>
          ))
        )}

        {visibleProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            colors={colors}
            isTopPick={product.id === topPickId && index === 0}
            isNew={product.id === newestId}
            isWishlisted={wishlist.has(product.id)}
            onWishlistToggle={() => toggleWishlist(product)}
            onQuickView={() => openQuickView(product)}
            onShare={() => handleShareProduct(product)}
            onBuy={() => onBuyClick(product)}
            onAddToCart={() => handleAddToCart(product)}
            placeholderSrc={makePlaceholderSvg(colors.hexAccent, artist.name)}
            imgLoading={loadingImages[product.id] ?? true}
            onImgLoaded={() => setLoadingImages(p => ({ ...p, [product.id]: false }))}
          />
        ))}
      </div>

      {/* Load more sentinel (infinite scroll) */}
      {visibleCount < totalFiltered && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading more products…
          </div>
        </div>
      )}

      {/* Bundles section */}
      {bundles.length > 0 && (
        <BundlesSection bundles={bundles} products={products} colors={colors} onBuy={onBuyClick} />
      )}

      {/* View Full Store */}
      <div className="mt-5">
        {products3D.length > 0 && (
          <button
            onClick={() => setShow3D(true)}
            className="store3d-portal-cta motion-reduce:transform-none group relative mb-3 flex w-full cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-2xl py-4 px-6 text-sm font-bold text-white outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            style={{
              background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
              boxShadow: `0 14px 44px -10px ${colors.hexAccent}99, inset 0 1px 0 0 #ffffff33`,
            }}
            data-testid="button-enter-3d-store"
            aria-label={`Enter the immersive 3D store of ${artist.name}`}
          >
            <span className="store3d-portal-shine pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden" />
            <span
              className="store3d-portal-halo pointer-events-none absolute -inset-px rounded-2xl motion-reduce:hidden"
              style={{ boxShadow: `0 0 0 1px ${colors.hexAccent}55` }}
            />
            <Box className="relative h-5 w-5" />
            <span className="relative tracking-wide">Enter 3D Experience</span>
            <Sparkles className="relative h-4 w-4 transition-transform duration-500 group-hover:rotate-90" />
          </button>
        )}
        <Link href={`/artist/${artist.slug || artist.name.toLowerCase().replace(/\s+/g, '-')}/store`}>
          <button
            className="w-full py-4 px-6 rounded-2xl text-sm font-bold transition-all duration-300 transform hover:scale-[1.02] shadow-xl flex items-center justify-center gap-3 border"
            style={{
              background: `linear-gradient(135deg, ${colors.hexPrimary}15, ${colors.hexAccent}10)`,
              borderColor: colors.hexPrimary,
              color: 'white',
            }}
          >
            <Store className="h-5 w-5" style={{ color: colors.hexAccent }} />
            <span>View Full Store — {countBadge}</span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                color: 'white',
              }}
            >
              NEW
            </span>
          </button>
        </Link>
        <p className="text-center text-xs text-gray-500 mt-2">
          👕 Apparel · 🧢 Hats · 📱 Phone Cases · 👟 Shoes · 🖼️ Wall Art · ☕ Drinkware &amp; more
        </p>
      </div>

      {/* Manage store — owner only */}
      {isOwnProfile && hasContract && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.hexBorder }}>
          <Link href="/merchandise">
            <button
              className="w-full py-4 px-6 rounded-2xl text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                color: 'white',
              }}
              data-testid="button-manage-store"
            >
              <ShoppingCart className="h-5 w-5" />
              <span>Manage Your Store</span>
              <Sparkles className="h-5 w-5" />
            </button>
          </Link>
          <p className="text-center text-xs text-gray-400 mt-2">
            Upload designs, manage products & track earnings · {artistRevenueShare}% revenue share
          </p>
        </div>
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickView}
        open={!!quickView}
        onClose={() => setQuickView(null)}
        colors={colors}
        artistName={artist.name}
        onBuy={(p) => { setQuickView(null); onBuyClick(p); }}
        onAddToCart={(p, size) => { setQuickView(null); handleAddToCart(p, size); }}
        isWishlisted={quickView ? wishlist.has(quickView.id) : false}
        onWishlistToggle={() => quickView && toggleWishlist(quickView)}
        onShare={() => quickView && handleShareProduct(quickView)}
        placeholderSrc={makePlaceholderSvg(colors.hexAccent, artist.name)}
        isOwner={isOwnProfile && hasContract}
      />
    </>
  );
}

// ───────────────────────── Subcomponents ─────────────────────────

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-lg p-2.5 border"
      style={{ background: `${color}08`, borderColor: `${color}25` }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <div className="text-base font-bold text-white leading-tight">{value}</div>
    </div>
  );
}

function CategoryChip({
  active, onClick, color, label, count,
}: { active: boolean; onClick: () => void; color: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
      style={{
        background: active ? color : `${color}12`,
        color: active ? 'white' : color,
        border: `1px solid ${active ? color : `${color}30`}`,
      }}
    >
      {label}
      <span className="ml-1.5 opacity-70">{count}</span>
    </button>
  );
}

interface ProductCardProps {
  product: StoreProduct;
  index: number;
  colors: Colors;
  isTopPick: boolean;
  isNew: boolean;
  isWishlisted: boolean;
  onWishlistToggle: () => void;
  onQuickView: () => void;
  onShare: () => void;
  onBuy: () => void;
  onAddToCart: () => void;
  placeholderSrc: string;
  imgLoading: boolean;
  onImgLoaded: () => void;
}

function ProductCard({
  product, index, colors, isTopPick, isNew,
  isWishlisted, onWishlistToggle, onQuickView, onShare, onBuy, onAddToCart,
  placeholderSrc, onImgLoaded,
}: ProductCardProps) {
  const viewers = useLiveViewers(product.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative rounded-lg md:rounded-xl overflow-hidden bg-black/50 hover:bg-gray-900/50 transition-all duration-200 border group cursor-pointer"
      style={{ borderColor: colors.hexBorder }}
      data-testid={`card-product-${index}`}
      onClick={onQuickView}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.imageUrl || placeholderSrc}
          srcSet={makeSrcSet(product.imageUrl)}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onLoad={onImgLoaded}
          onError={(e) => { e.currentTarget.src = placeholderSrc; }}
        />

        {/* Top badges */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
          {isTopPick && (
            <span
              className="text-[9px] font-bold py-0.5 px-1.5 rounded-full flex items-center gap-1 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: 'white' }}
            >
              <Crown className="w-2.5 h-2.5" /> TOP PICK
            </span>
          )}
          {isNew && !isTopPick && (
            <span
              className="text-[9px] font-bold py-0.5 px-1.5 rounded-full flex items-center gap-1 shadow-lg bg-green-500 text-white"
            >
              <Sparkles className="w-2.5 h-2.5" /> NEW
            </span>
          )}
          {product.productStatus === 'limited' && (
            <span className="text-[9px] font-bold py-0.5 px-1.5 rounded-full flex items-center gap-1 shadow-lg bg-amber-500 text-white">
              <Flame className="w-2.5 h-2.5" /> LIMITED
            </span>
          )}
          {product.productStatus === 'pre_order' && (
            <span className="text-[9px] font-bold py-0.5 px-1.5 rounded-full flex items-center gap-1 shadow-lg bg-blue-500 text-white">
              <Clock className="w-2.5 h-2.5" /> PRE-ORDER
            </span>
          )}
          {product.productStatus === 'sold_out' && (
            <span className="text-[9px] font-bold py-0.5 px-1.5 rounded-full flex items-center gap-1 shadow-lg bg-gray-600 text-white">
              SOLD OUT
            </span>
          )}
          {product.aiGeneratedDesign && (
            <span
              className="text-[9px] font-bold py-0.5 px-1.5 rounded-full flex items-center gap-1 shadow-lg"
              style={{ background: `${colors.hexAccent}dd`, color: 'white' }}
            >
              <Wand2 className="w-2.5 h-2.5" /> AI
            </span>
          )}
        </div>

        {/* Wishlist heart */}
        <button
          onClick={(e) => { e.stopPropagation(); onWishlistToggle(); }}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform z-10"
          aria-label="Toggle wishlist"
        >
          <Heart
            className="w-3.5 h-3.5"
            fill={isWishlisted ? '#ef4444' : 'transparent'}
            color={isWishlisted ? '#ef4444' : 'white'}
          />
        </button>

        {/* Price badge */}
        <div className="absolute bottom-1.5 right-1.5">
          <span
            className="text-xs font-bold py-0.5 px-1.5 md:py-1 md:px-2 rounded-full text-white shadow-lg"
            style={{ backgroundColor: colors.hexPrimary }}
          >
            ${product.price}
          </span>
        </div>

        {/* Hover overlay actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
          <button
            onClick={(e) => { e.stopPropagation(); onQuickView(); }}
            className="pointer-events-auto w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white"
            aria-label="Quick view"
          >
            <Eye className="w-4 h-4 text-black" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="pointer-events-auto w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white"
            aria-label="Share & earn"
          >
            <Share2 className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Live viewers micro-social-proof */}
        {viewers >= 5 && (
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur flex items-center gap-1">
            <Flame className="w-2.5 h-2.5 text-orange-400" />
            <span className="text-[9px] font-bold text-white">{viewers}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 md:p-3">
        <h3 className="font-medium text-white text-xs md:text-sm truncate">{product.name}</h3>
        {product.category && (
          <p className="text-[10px] text-gray-500 mt-0.5 truncate">{product.category}</p>
        )}

        {/* Size swatches preview */}
        {product.sizes && product.sizes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {product.sizes.slice(0, 5).map(size => (
              <span
                key={size}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                style={{ borderColor: `${colors.hexAccent}40`, color: colors.hexAccent }}
              >
                {size}
              </span>
            ))}
            {product.sizes.length > 5 && (
              <span className="text-[9px] text-gray-500 px-1">+{product.sizes.length - 5}</span>
            )}
          </div>
        )}

        {/* Countdown for limited editions */}
        {product.productStatus === 'limited' && product.expiresAt && (
          <CountdownTimer expiresAt={product.expiresAt} color={colors.hexAccent} />
        )}

        {/* Pre-order progress */}
        {product.productStatus === 'pre_order' && (
          <PreOrderBadge
            current={product.preOrderCurrentOrders || 0}
            minimum={product.preOrderMinimumOrders || 25}
            releaseDate={product.preOrderReleaseDate}
            color={colors.hexAccent}
          />
        )}

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
            size="sm"
            variant="outline"
            className="h-8 text-xs font-bold"
            style={{ borderColor: `${colors.hexAccent}60`, color: colors.hexAccent }}
            data-testid={`button-add-cart-product-${index}`}
          >
            <ShoppingBag className="w-3 h-3 mr-1" />
            Add
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); onBuy(); }}
            size="sm"
            className="h-8 text-xs font-bold"
            style={{
              background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
              color: 'white',
            }}
            data-testid={`button-buy-product-${index}`}
          >
            <ShoppingCart className="w-3 h-3 mr-1" />
            Buy
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────── Quick View Modal ───────
interface QuickViewProps {
  product: StoreProduct | null;
  open: boolean;
  onClose: () => void;
  colors: Colors;
  artistName: string;
  onBuy: (p: StoreProduct) => void;
  onAddToCart: (p: StoreProduct, size?: string) => void;
  isWishlisted: boolean;
  onWishlistToggle: () => void;
  onShare: () => void;
  placeholderSrc: string;
  isOwner?: boolean;
}

function QuickViewModal({
  product, open, onClose, colors, artistName, onBuy, onAddToCart,
  isWishlisted, onWishlistToggle, onShare, placeholderSrc, isOwner,
}: QuickViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [liveDescription, setLiveDescription] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>(product?.sizes?.[0] || '');

  // Reset selected size whenever the product changes
  useEffect(() => {
    setSelectedSize(product?.sizes?.[0] || '');
  }, [product?.id]);

  const rewriteMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error('No product');
      const res = await fetch(`/api/store/ai/rewrite-description/${product.id}`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Rewrite failed');
      return json as { newDescription: string };
    },
    onSuccess: (data) => {
      setLiveDescription(data.newDescription);
      queryClient.invalidateQueries({ queryKey: ['merchandise'] });
      toast({ title: '✨ Description rewritten', description: 'Saved to product.' });
    },
    onError: (e: any) => toast({ title: 'Rewrite failed', description: e.message, variant: 'destructive' }),
  });

  if (!product) return null;
  const displayDescription = liveDescription || product.description || 'Premium official merchandise. Produced on-demand, shipped worldwide.';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden border-2"
        style={{ borderColor: colors.hexBorder, background: 'black' }}
      >
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Image side */}
          <div className="relative aspect-square" style={{ background: `${colors.hexPrimary}10` }}>
            <img
              src={product.imageUrl || placeholderSrc}
              srcSet={makeSrcSet(product.imageUrl, [400, 800, 1200])}
              sizes="(max-width: 768px) 100vw, 50vw"
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = placeholderSrc; }}
            />
            {/* Product status overlay */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {product.productStatus === 'limited' && product.expiresAt && (
                <div className="px-2 py-1 rounded-md bg-amber-500/90 text-white text-[10px] font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3" /> LIMITED
                </div>
              )}
              {product.productStatus === 'pre_order' && (
                <div className="px-2 py-1 rounded-md bg-blue-500/90 text-white text-[10px] font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> PRE-ORDER
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Info side */}
          <div className="p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: colors.hexAccent }}>
                  {artistName} · {product.category || 'Official Merch'}
                </p>
                <h2 className="text-xl font-bold text-white leading-tight">{product.name}</h2>
              </div>
              <div
                className="flex-shrink-0 px-3 py-1 rounded-full text-sm font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
              >
                ${product.price}
              </div>
            </div>

            <p className="text-sm text-gray-300 my-3 line-clamp-5">{displayDescription}</p>

            {/* AI rewrite (owner only) */}
            {isOwner && (
              <button
                onClick={() => rewriteMutation.mutate()}
                disabled={rewriteMutation.isPending}
                className="self-start mb-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:scale-105 disabled:opacity-60"
                style={{ borderColor: `${colors.hexAccent}50`, background: `${colors.hexAccent}10`, color: colors.hexAccent }}
                data-testid="button-ai-rewrite-description"
              >
                {rewriteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Rewrite with AI
              </button>
            )}

            {/* Countdown / pre-order inside modal */}
            {product.productStatus === 'limited' && product.expiresAt && (
              <div className="mb-3">
                <CountdownTimer expiresAt={product.expiresAt} color={colors.hexAccent} large />
              </div>
            )}
            {product.productStatus === 'pre_order' && (
              <div className="mb-3">
                <PreOrderBadge
                  current={product.preOrderCurrentOrders || 0}
                  minimum={product.preOrderMinimumOrders || 25}
                  releaseDate={product.preOrderReleaseDate}
                  color={colors.hexAccent}
                  large
                />
              </div>
            )}

            {/* Sizes — clickable selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1.5">
                  Size: <span className="font-bold" style={{ color: colors.hexAccent }}>{selectedSize || product.sizes[0]}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {product.sizes.map(size => {
                    const isSelected = (selectedSize || product.sizes![0]) === size;
                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className="px-2.5 py-1 rounded-md text-xs font-bold border transition-all hover:scale-105"
                        style={{
                          borderColor: isSelected ? colors.hexPrimary : `${colors.hexAccent}60`,
                          background: isSelected ? colors.hexPrimary : 'transparent',
                          color: isSelected ? 'white' : colors.hexAccent,
                          boxShadow: isSelected ? `0 0 8px ${colors.hexPrimary}60` : 'none',
                        }}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trust signals */}
            <div className="mt-auto space-y-1.5 mb-4">
              <TrustLine icon={<Package className="w-3 h-3" />} text="Zero inventory — produced on demand" />
              <TrustLine icon={<Users className="w-3 h-3" />} text="Ships worldwide in 5–7 days" />
              <TrustLine icon={<Tag className="w-3 h-3" />} text="100% official — artist collaboration" />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const chosenSize = selectedSize || product.sizes?.[0] || '';
                  onAddToCart(product, chosenSize);
                }}
                className="font-bold"
                style={{ borderColor: `${colors.hexAccent}60`, color: colors.hexAccent }}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Add to cart
              </Button>
              <Button
                onClick={() => {
                  const chosenSize = selectedSize || product.sizes?.[0] || '';
                  // Put the chosen size first so parent's sizes[0] = selected size
                  const productWithSize = chosenSize
                    ? { ...product, sizes: [chosenSize, ...(product.sizes || []).filter(s => s !== chosenSize)] }
                    : product;
                  onBuy(productWithSize);
                }}
                className="flex-1 font-bold"
                style={{
                  background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                  color: 'white',
                }}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Buy Now — ${product.price}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onWishlistToggle}
                style={{ borderColor: colors.hexBorder }}
                aria-label="Toggle wishlist"
              >
                <Heart className="w-4 h-4" fill={isWishlisted ? '#ef4444' : 'transparent'} color={isWishlisted ? '#ef4444' : 'white'} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onShare}
                style={{ borderColor: colors.hexBorder }}
                aria-label="Share & earn"
              >
                <Share2 className="w-4 h-4 text-white" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TrustLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-gray-400">
      <span className="text-green-400">{icon}</span>
      {text}
    </div>
  );
}

// ─────── Countdown Timer (limited editions) ───────
function CountdownTimer({
  expiresAt, color, large = false,
}: { expiresAt: string | Date; color: string; large?: boolean }) {
  const [remaining, setRemaining] = useState(() => getRemaining(expiresAt));
  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (remaining.expired) {
    return (
      <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
        <Clock className="w-3 h-3" /> Expired
      </div>
    );
  }

  const cellCls = large
    ? 'text-base font-bold px-2 py-1 rounded'
    : 'text-[11px] font-bold px-1.5 py-0.5 rounded';

  return (
    <div className={`mt-2 flex items-center gap-1.5 ${large ? 'text-xs' : 'text-[10px]'} text-gray-400`}>
      <Clock className={large ? 'w-3.5 h-3.5' : 'w-3 h-3'} style={{ color }} />
      <span>Ends in</span>
      <div className="flex items-center gap-1">
        {remaining.days > 0 && (
          <span className={cellCls} style={{ background: `${color}20`, color }}>{remaining.days}d</span>
        )}
        <span className={cellCls} style={{ background: `${color}20`, color }}>{pad(remaining.hours)}h</span>
        <span className={cellCls} style={{ background: `${color}20`, color }}>{pad(remaining.minutes)}m</span>
        {!large && remaining.days === 0 && (
          <span className={cellCls} style={{ background: `${color}20`, color }}>{pad(remaining.seconds)}s</span>
        )}
      </div>
    </div>
  );
}

function getRemaining(expiresAt: string | Date) {
  const end = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
  const diff = end - Date.now();
  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { expired: false, days, hours, minutes, seconds };
}

const pad = (n: number) => n.toString().padStart(2, '0');

// ─────── Pre-Order Badge ───────
function PreOrderBadge({
  current, minimum, releaseDate, color, large = false,
}: { current: number; minimum: number; releaseDate?: string | Date | null; color: string; large?: boolean }) {
  const pct = Math.min(100, Math.round((current / Math.max(1, minimum)) * 100));
  const releaseStr = releaseDate
    ? new Date(releaseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  return (
    <div className={`mt-2 ${large ? 'space-y-2' : 'space-y-1'}`}>
      <div className={`flex items-center justify-between ${large ? 'text-xs' : 'text-[10px]'}`}>
        <span className="text-gray-400 flex items-center gap-1">
          <Clock className={large ? 'w-3.5 h-3.5' : 'w-3 h-3'} style={{ color }} />
          {current} / {minimum} committed
        </span>
        {releaseStr && <span className="text-gray-500">Ships {releaseStr}</span>}
      </div>
      <div className={`w-full ${large ? 'h-2' : 'h-1'} rounded-full overflow-hidden`} style={{ background: `${color}15` }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
        />
      </div>
      {pct >= 100 && (
        <p className={`${large ? 'text-xs' : 'text-[10px]'} font-semibold`} style={{ color }}>
          ✓ Goal reached — releasing soon
        </p>
      )}
    </div>
  );
}

// ─────── Bundles Section ───────
function BundlesSection({
  bundles, products, colors, onBuy,
}: {
  bundles: StoreBundle[];
  products: StoreProduct[];
  colors: Colors;
  onBuy: (p: StoreProduct) => void;
}) {
  const productMap = useMemo(() => {
    const m = new Map<string, StoreProduct>();
    products.forEach(p => m.set(String(p.id), p));
    return m;
  }, [products]);

  return (
    <div className="mt-5 pt-5 border-t" style={{ borderColor: colors.hexBorder }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4" style={{ color: colors.hexAccent }} />
          <h3 className="text-sm font-bold text-white">Bundle Deals</h3>
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={{ background: `${colors.hexAccent}20`, color: colors.hexAccent }}
          >
            SAVE UP TO {Math.max(...bundles.map(b => b.discountPercent || 0))}%
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {bundles.slice(0, 6).map((bundle) => {
          const items = (bundle.productIds as any[])
            .map(id => productMap.get(String(id)))
            .filter(Boolean) as StoreProduct[];
          const originalPrice = Number(bundle.originalPrice);
          const bundlePrice = Number(bundle.bundlePrice);
          return (
            <motion.div
              key={bundle.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border overflow-hidden bg-black/40 hover:bg-gray-900/50 transition-all"
              style={{ borderColor: colors.hexBorder }}
              data-testid={`bundle-${bundle.id}`}
            >
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-sm font-bold text-white leading-tight flex items-center gap-1">
                    {bundle.aiGenerated && <Wand2 className="w-3 h-3" style={{ color: colors.hexAccent }} />}
                    {bundle.name}
                  </h4>
                  <span
                    className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: 'white' }}
                  >
                    -{bundle.discountPercent}%
                  </span>
                </div>
                {bundle.description && (
                  <p className="text-[11px] text-gray-400 mb-2 line-clamp-2">{bundle.description}</p>
                )}
                {/* Mini preview of items */}
                {items.length > 0 && (
                  <div className="flex -space-x-2 mb-3">
                    {items.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="w-10 h-10 rounded-md border-2 overflow-hidden bg-gray-800"
                        style={{ borderColor: colors.hexBorder }}
                        title={item.name}
                      >
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {items.length > 4 && (
                      <div
                        className="w-10 h-10 rounded-md border-2 flex items-center justify-center text-[10px] font-bold text-white bg-black"
                        style={{ borderColor: colors.hexBorder }}
                      >
                        +{items.length - 4}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] text-gray-500 line-through">${originalPrice.toFixed(2)}</div>
                    <div className="text-lg font-bold" style={{ color: colors.hexAccent }}>${bundlePrice.toFixed(2)}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => items[0] && onBuy(items[0])}
                    className="h-7 text-[11px] font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                      color: 'white',
                    }}
                  >
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    Get Bundle
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─────── Seasonal Drop Banner ───────
function SeasonalDropBanner({
  seasonal, productCount, colors,
}: { seasonal: SeasonalInfo; productCount: number; colors: Colors }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-xl p-3 border flex items-center gap-3"
      style={{
        background: `linear-gradient(135deg, ${colors.hexPrimary}20, ${colors.hexAccent}10)`,
        borderColor: `${colors.hexAccent}40`,
      }}
      data-testid="seasonal-banner"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: `${colors.hexAccent}25` }}
      >
        <Gift className="w-5 h-5" style={{ color: colors.hexAccent }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-white truncate">{seasonal.name}</h4>
          {seasonal.discount > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: colors.hexAccent, color: 'white' }}
            >
              -{seasonal.discount}% OFF
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {productCount} limited-edition {productCount === 1 ? 'product' : 'products'} · {seasonal.theme}
        </p>
      </div>
    </motion.div>
  );
}

// ─────── Heatmap Panel (owner only) ───────
function HeatmapPanel({ data, colors }: { data: HeatmapEntry[]; colors: Colors }) {
  if (!data.length) {
    return (
      <div
        className="mb-4 p-4 rounded-lg border text-center text-xs text-gray-500"
        style={{ background: `${colors.hexPrimary}08`, borderColor: colors.hexBorder }}
      >
        No view data yet — fans haven't browsed your store in the last 30 days.
      </div>
    );
  }

  const maxViews = Math.max(...data.map(d => d.views), 1);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mb-4 rounded-lg border overflow-hidden"
      style={{ background: `${colors.hexPrimary}08`, borderColor: colors.hexBorder }}
    >
      <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: colors.hexBorder }}>
        <Zap className="w-4 h-4" style={{ color: colors.hexAccent }} />
        <h4 className="text-sm font-bold text-white">Views → Sales Heatmap</h4>
        <span className="text-[10px] text-gray-500 ml-auto">Last 30 days</span>
      </div>
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {data.slice(0, 10).map((entry) => {
          const pct = Math.round((entry.views / maxViews) * 100);
          return (
            <div key={entry.merchandiseId} className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0 bg-gray-800"
                style={{ border: `1px solid ${colors.hexBorder}` }}
              >
                {entry.imageUrl && (
                  <img src={entry.imageUrl} alt={entry.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="text-white truncate pr-2">{entry.name}</span>
                  <span className="text-gray-400 flex-shrink-0 font-mono tabular-nums">
                    {entry.views}v · {entry.sales}s · {entry.conversionRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: `${colors.hexPrimary}15` }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
