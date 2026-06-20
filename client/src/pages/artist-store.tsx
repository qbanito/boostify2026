/**
 * Artist Store Page — Tienda completa del artista con 100+ productos
 * 
 * Ruta: /artist/:slug/store
 * Acceso: Público (cualquier visitante puede ver la tienda)
 */

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, Search, ShoppingBag, Star, 
  Package, Loader2, ChevronRight, Truck, Shield, Sparkles,
  Zap, Heart, Award, Music, Copy, Download, X, Instagram, Facebook, Box
} from 'lucide-react';

// Experiencia 3D inmersiva (lazy — solo se carga al abrirla)
const Virtual3DStore = lazy(() => import('@/components/store/Virtual3DStore'));

interface BrandColors {
  primary?: string;
  secondary?: string;
  accent?: string;
}
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/contexts/cart-context';

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
  'Apparel': '👕',
  'Hoodies & Sweatshirts': '🧥',
  'Hats & Beanies': '🧢',
  'Accessories': '🧣',
  'Phone Cases': '📱',
  'Bags': '🎒',
  'Shoes': '👟',
  'Home & Living': '🏠',
  'Wall Art': '🖼️',
  'Drinkware': '☕',
  'Stickers & Pins': '✨',
  'Kids & Baby': '👶',
};

interface CatalogProduct {
  printfulId: number;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  retailPrice: number;
  tags: string[];
  gender: string;
  featured: boolean;
  isAllOverPrint: boolean;
  artistName: string;
  displayName: string;
  designUrl: string;
  productImageUrl: string;
  /** When present, a high-quality Printful Mockup Generator render with the artist design baked in */
  mockupUrl?: string;
  /** 'front' | 'back' | 'default' — used to position the client-side design overlay when no mockupUrl */
  placement?: string;
}

interface ArtistProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  productType: string;
  sizes: string[];
  isCustom: boolean;
  aiGenerated: boolean;
  salesCount: number;
}

interface StoreData {
  artist: {
    name: string;
    slug: string;
    imageUrl: string;
    genre: string;
    masterDesignUrl: string;
    pgId?: number;
  };
  catalog: {
    products: CatalogProduct[];
    total: number;
    totalCatalog: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  categories: Array<{ category: string; count: number }>;
  featured: CatalogProduct[];
  artistProducts: ArtistProduct[];
}

type PromoTemplate = 'agresivo' | 'elegante' | 'urbano';
type PromoPlatform = 'instagram' | 'facebook';

interface PromoProductInput {
  name: string;
  price: number;
  category?: string;
  imageUrl?: string;
  displayName?: string;
  productImageUrl?: string;
  mockupUrl?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPromoHtml(params: {
  artistName: string;
  artistGenre?: string;
  storeUrl: string;
  productName: string;
  productPrice: number;
  productImageUrl: string;
  category?: string;
  tagLine?: string;
  template: PromoTemplate;
  platform: PromoPlatform;
}) {
  const artistName = escapeHtml(params.artistName || 'Artist');
  const artistGenre = escapeHtml(params.artistGenre || 'Music');
  const productName = escapeHtml(params.productName || 'Official Product');
  const category = escapeHtml(params.category || 'Official Drop');
  const tagLine = escapeHtml(params.tagLine || `Limited drop from ${artistName}`);
  const storeUrl = escapeHtml(params.storeUrl);
  const imageUrl = escapeHtml(params.productImageUrl || '');
  const priceLabel = Number.isFinite(params.productPrice) ? `$${params.productPrice.toFixed(2)}` : '';

  const templateStyles: Record<PromoTemplate, { bgA: string; bgB: string; accentA: string; accentB: string; bannerLabel: string; ctaLabel: string; }> = {
    agresivo: {
      bgA: '#210a0a',
      bgB: '#0b0b1a',
      accentA: '#ef4444',
      accentB: '#f97316',
      bannerLabel: 'Hot Drop',
      ctaLabel: 'Shop now',
    },
    elegante: {
      bgA: '#121212',
      bgB: '#1f1a12',
      accentA: '#d4a017',
      accentB: '#fbbf24',
      bannerLabel: 'Signature Collection',
      ctaLabel: 'Discover collection',
    },
    urbano: {
      bgA: '#0f172a',
      bgB: '#111827',
      accentA: '#22d3ee',
      accentB: '#3b82f6',
      bannerLabel: 'Street Capsule',
      ctaLabel: 'Cop this drop',
    },
  };
  const style = templateStyles[params.template];
  const platformLabel = params.platform === 'instagram' ? 'Instagram Ready' : 'Facebook Ready';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${productName} · ${artistName}</title>
    <style>
      :root {
        --bg-a: ${style.bgA};
        --bg-b: ${style.bgB};
        --accent-a: ${style.accentA};
        --accent-b: ${style.accentB};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        color: #fff;
        background: radial-gradient(1200px 700px at 15% 15%, #fb923c26 0%, transparent 60%), linear-gradient(135deg, var(--bg-a), var(--bg-b));
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
      }
      .card {
        width: min(920px, 100%);
        border: 1px solid #ffffff22;
        border-radius: 28px;
        overflow: hidden;
        background: linear-gradient(160deg, #ffffff0f, #ffffff05);
        box-shadow: 0 24px 70px #0008;
      }
      .banner {
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        background: linear-gradient(90deg, var(--accent-a), var(--accent-b));
      }
      .badge {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .main {
        display: grid;
        grid-template-columns: 1.1fr 1fr;
      }
      .media {
        min-height: 320px;
        background: #090909;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .media img {
        max-width: 100%;
        max-height: 420px;
        object-fit: contain;
        border-radius: 16px;
      }
      .content {
        padding: 26px 24px;
        background: linear-gradient(180deg, #0b0b0b, #131313);
      }
      h1 {
        margin: 0;
        font-size: clamp(22px, 4vw, 34px);
        line-height: 1.05;
      }
      .subtitle {
        margin: 10px 0 18px;
        color: #d4d4d8;
        font-size: 14px;
      }
      .meta {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        font-size: 12px;
        color: #f4f4f5;
        background: #ffffff14;
        border: 1px solid #ffffff1f;
        padding: 7px 10px;
        border-radius: 999px;
      }
      .price {
        margin-top: 16px;
        font-size: 34px;
        font-weight: 900;
        color: #fdba74;
      }
      .cta {
        margin-top: 16px;
        display: inline-block;
        text-decoration: none;
        color: #111;
        font-weight: 800;
        background: linear-gradient(135deg, #fb923c, #f59e0b);
        padding: 11px 16px;
        border-radius: 999px;
      }
      .small {
        margin-top: 12px;
        color: #a1a1aa;
        font-size: 11px;
      }
      @media (max-width: 780px) {
        .main { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <article class="card">
      <div class="banner">
        <span class="badge">${style.bannerLabel} · ${platformLabel}</span>
        <span class="badge">${category}</span>
      </div>
      <section class="main">
        <div class="media">${imageUrl ? `<img src="${imageUrl}" alt="${productName}" />` : ''}</div>
        <div class="content">
          <h1>${productName}</h1>
          <p class="subtitle">${tagLine}</p>
          <div class="meta">${artistName} · ${artistGenre}</div>
          <div class="price">${priceLabel}</div>
          <a class="cta" href="${storeUrl}" target="_blank" rel="noopener noreferrer">${style.ctaLabel}</a>
          <div class="small">Powered by Boostify Official Store</div>
        </div>
      </section>
    </article>
  </body>
</html>`;
}

export default function ArtistStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [optionsProduct, setOptionsProduct] = useState<CatalogProduct | null>(null);
  const [optionsAction, setOptionsAction] = useState<'buy' | 'cart'>('buy');
  const [promoProduct, setPromoProduct] = useState<PromoProductInput | null>(null);
  const [promoTemplate, setPromoTemplate] = useState<PromoTemplate>('agresivo');
  const [promoPlatform, setPromoPlatform] = useState<PromoPlatform>('instagram');
  const [show3D, setShow3D] = useState(false);
  const { toast } = useToast();
  const cart = useCart();

  const buildPlatformCopy = (platform: PromoPlatform, template: PromoTemplate, product: PromoProductInput, artistName: string, storeUrl: string) => {
    const productName = product.displayName || product.name;
    const priceText = Number.isFinite(product.price) ? `$${product.price.toFixed(2)}` : '';

    const copyMap: Record<PromoPlatform, Record<PromoTemplate, string>> = {
      instagram: {
        agresivo: `NEW DROP ALERT\n${productName} just landed at ${priceText}. Limited units. No restock promises.\n\nTap the link, move fast, and secure yours now.\n\n${storeUrl}\n#boostify #officialstore #artistdrop #limitededition`,
        elegante: `${artistName} presents: ${productName}.\nA refined statement piece now available for true supporters.\nPrice: ${priceText}\n\nExplore the collection: ${storeUrl}\n#officialstore #signaturecollection #artistbrand`,
        urbano: `${productName} in the building.\nStreet-ready, fan-approved, artist-certified.\nPrice: ${priceText}\n\nGet yours here: ${storeUrl}\n#streetwear #artistmerch #urbanstyle #boostify`,
      },
      facebook: {
        agresivo: `Hot drop from ${artistName}: ${productName} (${priceText}). Limited stock. First come, first served. Shop now: ${storeUrl}`,
        elegante: `${artistName} Official Store introduces ${productName} (${priceText}) as part of the signature collection. Discover and shop here: ${storeUrl}`,
        urbano: `${artistName} just dropped ${productName} (${priceText}). Urban energy, premium quality. Grab it now: ${storeUrl}`,
      },
    };

    return copyMap[platform][template];
  };

  const copyPromoText = async () => {
    if (!promoProduct || !storeData) return;
    const storeUrl = `${window.location.origin}/artist/${slug}/store`;
    const text = buildPlatformCopy(promoPlatform, promoTemplate, promoProduct, storeData.artist.name, storeUrl);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copy ready', description: 'Promo copy copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not access clipboard.', variant: 'destructive' });
    }
  };

  const downloadPromoHtml = () => {
    if (!promoProduct || !storeData) return;
    const storeUrl = `${window.location.origin}/artist/${slug}/store`;
    const html = buildPromoHtml({
      artistName: storeData.artist.name,
      artistGenre: storeData.artist.genre,
      storeUrl,
      productName: promoProduct.displayName || promoProduct.name,
      productPrice: promoProduct.price,
      productImageUrl: promoProduct.mockupUrl || promoProduct.imageUrl || promoProduct.productImageUrl || storeData.artist.masterDesignUrl || '',
      category: promoProduct.category,
      tagLine: `${storeData.artist.name} official drop. Limited stock, premium quality.`,
      template: promoTemplate,
      platform: promoPlatform,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const fileName = `${(promoProduct.displayName || promoProduct.name).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${promoTemplate}-${promoPlatform}.html`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePublishPromo = async () => {
    if (!promoProduct || !storeData) return;
    const storeUrl = `${window.location.origin}/artist/${slug}/store`;
    const promoHtml = buildPromoHtml({
      artistName: storeData.artist.name,
      artistGenre: storeData.artist.genre,
      storeUrl,
      productName: promoProduct.displayName || promoProduct.name,
      productPrice: promoProduct.price,
      productImageUrl: promoProduct.mockupUrl || promoProduct.imageUrl || promoProduct.productImageUrl || storeData.artist.masterDesignUrl || '',
      category: promoProduct.category,
      tagLine: `${storeData.artist.name} official drop. Limited stock, premium quality.`,
      template: promoTemplate,
      platform: promoPlatform,
    });

    const shareCopy = buildPlatformCopy(promoPlatform, promoTemplate, promoProduct, storeData.artist.name, storeUrl);
    try {
      await navigator.clipboard.writeText(shareCopy);
    } catch {
      // no-op; user can still continue without clipboard
    }

    const blob = new Blob([promoHtml], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(blob);
    window.open(htmlUrl, '_blank', 'noopener,noreferrer');

    if (promoPlatform === 'facebook') {
      const shareUrl = encodeURIComponent(storeUrl);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, '_blank', 'noopener,noreferrer');
    } else {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    }

    toast({
      title: `${promoPlatform === 'instagram' ? 'Instagram' : 'Facebook'} publish flow ready`,
      description: 'Template page opened and platform copy copied to clipboard.',
    });

    setTimeout(() => URL.revokeObjectURL(htmlUrl), 15_000);
  };

  const handleCreateSocialPromo = (
    product: PromoProductInput
  ) => {
    setPromoProduct(product);
  };

  const { data: storeData, isLoading, error } = useQuery<StoreData>({
    queryKey: ['artist-store', slug, selectedCategory, searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);
      params.set('page', String(page));
      params.set('limit', '24');
      
      const res = await fetch(`/api/artist-store/${slug}/catalog?${params}`);
      if (!res.ok) throw new Error('Failed to load store');
      return res.json();
    },
    enabled: !!slug,
  });

  // Paleta de marca del artista para tematizar la experiencia 3D
  const artistPgId = storeData?.artist?.pgId;
  const { data: brandColors } = useQuery<BrandColors | undefined>({
    queryKey: ['artist-brand-colors', artistPgId],
    queryFn: async () => {
      const res = await fetch(`/api/artist-profile/brand-profile/${artistPgId}`);
      if (!res.ok) return undefined;
      const json = await res.json();
      return json?.profile?.brandColors as BrandColors | undefined;
    },
    enabled: !!artistPgId,
    staleTime: 10 * 60 * 1000,
  });

  // Avatar 3D del artista (si existe) para colocarlo dentro de la boutique 3D
  const { data: avatar3D } = useQuery<{ glbUrl?: string; animatedGlbUrl?: string; animatedUrl?: string; animatedFormat?: string } | null>({
    queryKey: ['artist-avatar-3d', artistPgId],
    queryFn: async () => {
      const res = await fetch(`/api/hologram-gallery/${artistPgId}/character-3d`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json?.character as any) || null;
    },
    enabled: !!artistPgId,
    staleTime: 10 * 60 * 1000,
  });

  // Decoración (arte mural + texturas de entorno OpenAI) de la boutique 3D
  const { data: boutiquePieces } = useQuery<Array<{ role?: string; imageUrl: string }>>({
    queryKey: ['artist-boutique-decor', slug],
    queryFn: async () => {
      const res = await fetch(`/api/artist-store/${slug}/boutique-decor`);
      if (!res.ok) return [];
      const json = await res.json();
      const pieces = json?.decor?.pieces as Array<{ role?: string; imageUrl: string }> | undefined;
      return (pieces || []).filter((p) => !!p?.imageUrl);
    },
    enabled: !!slug,
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
    queryKey: ['artist-boutique-props', slug],
    queryFn: async () => {
      const res = await fetch(`/api/artist-store/${slug}/boutique-props`);
      if (!res.ok) return [];
      const json = await res.json();
      const props = json?.props?.props as Array<{ key?: string; glbUrl: string }> | undefined;
      return (props || []).filter((p) => !!p?.glbUrl);
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });

  // ── Hero media: video de fondo + imágenes premium del artista (desde la DB) ──
  const { data: heroMedia } = useQuery<{ video: { url: string; poster?: string } | null; gallery: string[] }>({
    queryKey: ['artist-hero-media', slug],
    queryFn: async () => {
      const res = await fetch(`/api/artist-store/${slug}/hero-media`);
      if (!res.ok) return { video: null, gallery: [] };
      const json = await res.json();
      return {
        video: json?.video ?? null,
        gallery: Array.isArray(json?.gallery) ? json.gallery : [],
      };
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });

  // Conjunto de imágenes para el fondo del hero (galería DB + arte 3D + branding)
  const heroImages = useMemo(() => {
    const imgs = [
      ...(heroMedia?.gallery || []),
      ...boutiqueDecor,
      storeData?.artist?.masterDesignUrl,
      storeData?.artist?.imageUrl,
    ].filter((u): u is string => !!u);
    return Array.from(new Set(imgs)).slice(0, 10);
  }, [heroMedia, boutiqueDecor, storeData]);

  // Slideshow cross-fade del fondo (solo cuando no hay video y hay >1 imagen)
  const [heroBgIndex, setHeroBgIndex] = useState(0);
  useEffect(() => {
    if (heroMedia?.video || heroImages.length <= 1) return;
    const id = setInterval(() => setHeroBgIndex((i) => (i + 1) % heroImages.length), 5000);
    return () => clearInterval(id);
  }, [heroMedia?.video, heroImages.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setSelectedCategory('');
    setPage(1);
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(prev => prev === category ? '' : category);
    setSearchQuery('');
    setSearchInput('');
    setPage(1);
  };

  const handleBuy = async (product: CatalogProduct, opts?: { variantId?: number; size?: string; color?: string }) => {
    try {
      const res = await fetch('/api/artist-profile/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistSlug: slug || '',
          productName: product.displayName,
          productPrice: product.retailPrice,
          productImage: product.productImageUrl || product.designUrl,
          printFileUrl: product.designUrl || '',
          artistName: product.artistName,
          productType: product.name,
          size: opts?.size || '',
          color: opts?.color || '',
          printfulVariantId: opts?.variantId ? String(opts.variantId) : '',
          printfulProductId: product.printfulId,
        }),
      });
      const result = await res.json();
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result.error || 'Checkout failed');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Buy handler para productos del artista (Firestore docs)
  const handleBuyArtistProduct = async (product: ArtistProduct, size?: string) => {
    try {
      const res = await fetch('/api/artist-profile/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistSlug: slug || '',
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          productImage: product.imageUrl,
          artistName: storeData?.artist.name || '',
          productType: product.productType || product.category,
          size: size || product.sizes[0] || '',
        }),
      });
      const result = await res.json();
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result.error || 'Checkout failed');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Add-to-cart handler for artist products
  const handleAddArtistProductToCart = (product: ArtistProduct, size?: string) => {
    cart.addItem({
      source: 'firestore',
      productId: product.id,
      artistSlug: slug || '',
      artistName: storeData?.artist.name || '',
      artistUserId: typeof storeData?.artist.pgId === 'number' ? storeData.artist.pgId : undefined,
      name: product.name,
      imageUrl: product.imageUrl,
      price: product.price,
      size: size || product.sizes[0] || '',
      productType: product.productType || product.category,
      isCustomProduct: !!product.isCustom || product.aiGenerated === false,
    });
    toast({ title: 'Added to cart', description: product.name });
  };

  // Add-to-cart handler for catalog (Printful) products
  const handleAddCatalogToCart = (product: CatalogProduct, opts?: { variantId?: number; size?: string; color?: string }) => {
    cart.addItem({
      source: 'printful',
      printfulId: product.printfulId,
      artistSlug: slug || '',
      artistName: product.artistName,
      name: product.displayName + (opts?.size ? ` (${opts.size}${opts.color ? `, ${opts.color}` : ''})` : ''),
      imageUrl: product.productImageUrl || product.designUrl || '',
      printFileUrl: product.designUrl || '',
      price: product.retailPrice,
      size: opts?.size || '',
      productType: product.name,
      printfulVariantId: opts?.variantId ? String(opts.variantId) : undefined,
    });
    toast({ title: 'Added to cart', description: product.displayName });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-white/50 text-sm">Loading store...</p>
        </div>
      </div>
    );
  }

  if (error || !storeData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <p className="text-white/60 mb-4">Store not available</p>
          <Link href={`/artist/${slug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Profile
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { artist, catalog, categories, featured, artistProducts = [] } = storeData;
  const aiDrops = artistProducts.filter(p => p.aiGenerated);
  const customDrops = artistProducts.filter(p => p.isCustom);

  // ── Productos para la experiencia 3D ──
  // Prioriza los drops del artista (con su identidad/logo incrustado),
  // completa con destacados del catálogo. Imagen, nombre y precio.
  const products3D = (() => {
    const fromArtist = artistProducts
      .filter(p => !!p.imageUrl)
      .map(p => ({ id: `artist-${p.id}`, name: p.name, price: Number(p.price) || 0, imageUrl: p.imageUrl }));
    const fromCatalog = (featured?.length ? featured : catalog.products)
      .filter(p => !!(p.mockupUrl || p.productImageUrl || p.designUrl))
      .map(p => ({
        id: `catalog-${p.printfulId}`,
        name: p.displayName || p.name,
        price: Number(p.retailPrice) || 0,
        imageUrl: (p.mockupUrl || p.productImageUrl || p.designUrl) as string,
      }));
    return [...fromArtist, ...fromCatalog].slice(0, 16);
  })();

  return (
    <div className="min-h-screen bg-black">
      {/* ═══ EXPERIENCIA VIRTUAL 3D ═══ */}
      {show3D && (
        <div className="fixed inset-0 z-[100] bg-black">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-orange-500" />
                  <p className="text-sm text-white/60">Building {artist.name}'s 3D universe…</p>
                </div>
              </div>
            }
          >
            <Virtual3DStore
              products={products3D}
              artistName={artist.name}
              genre={artist.genre}
              brandColors={brandColors}
              logoUrl={artist.masterDesignUrl || undefined}
              avatarUrl={avatar3D?.animatedUrl || avatar3D?.animatedGlbUrl || avatar3D?.glbUrl || undefined}
              avatarFormat={(avatar3D?.animatedFormat as 'glb' | 'fbx') || 'glb'}
              decorImages={boutiqueDecor}
              wallTextureUrl={wallTextureUrl}
              floorTextureUrl={floorTextureUrl}
              propModels={boutiqueProps}
              storeSlug={slug}
              onProductClick={() => {
                setShow3D(false);
              }}
            />
          </Suspense>
          <button
            onClick={() => setShow3D(false)}
            className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" /> Exit 3D
          </button>
          <div className="absolute left-4 top-4 z-10 rounded-full border border-orange-500/30 bg-black/50 px-3 py-1.5 text-xs font-semibold text-orange-400 backdrop-blur-md">
            <Sparkles className="mr-1 inline h-3 w-3" />
            {artist.name} · 3D STORE
          </div>
        </div>
      )}

      {/* ═══ HERO SECTION ═══ */}
      <div className="relative h-[340px] md:h-[420px] overflow-hidden">
        {/* Background — artist image blurred */}
        <div className="absolute inset-0">
          <img 
            src={artist.imageUrl} 
            alt="" 
            className="w-full h-full object-cover scale-110 blur-xl opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-orange-900/20 via-transparent to-purple-900/20" />
        </div>

        {/* Top nav bar */}
        <div className="relative z-10 flex items-center justify-between px-4 md:px-8 pt-4">
          <Link href={`/artist/${slug}`}>
            <button className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </Link>
          <Badge className="bg-black/40 backdrop-blur-md text-orange-400 border border-orange-500/30 text-xs">
            <ShoppingBag className="w-3 h-3 mr-1" />
            {catalog.totalCatalog} Products
          </Badge>
        </div>

        {/* Hero content*/}
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 h-full px-4 -mt-4">
          {/* Artist image */}
          <div className="relative flex-shrink-0">
            <div className="w-28 h-28 md:w-40 md:h-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl shadow-orange-500/20">
              <img 
                src={artist.imageUrl} 
                alt={artist.name} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-orange-500 rounded-full p-1.5 shadow-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* Text */}
          <div className="text-center md:text-left">
            <p className="text-orange-400 text-xs font-semibold tracking-widest uppercase mb-1">Official Store</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-2">
              {artist.name}
            </h1>
            {artist.genre && (
              <p className="text-white/40 text-sm mb-4">{artist.genre} Artist</p>
            )}
            <div className="flex items-center justify-center md:justify-start gap-5 text-[11px] text-white/50">
              <span className="flex items-center gap-1"><Star className="w-3 h-3 text-orange-400" /> Premium Quality</span>
              <span className="flex items-center gap-1"><Truck className="w-3 h-3 text-orange-400" /> Worldwide Shipping</span>
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-orange-400" /> Secure Checkout</span>
            </div>

            {products3D.length > 0 && (
              <button
                onClick={() => setShow3D(true)}
                className="group relative mt-5 inline-flex items-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition-transform hover:scale-105"
                style={{ background: 'linear-gradient(90deg,#ff7b00,#ff2d95,#7c5cff)' }}
              >
                <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-700 group-hover:translate-x-full" />
                <Box className="w-4 h-4" />
                Enter 3D Experience
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ SEARCH BAR ═══ */}
      <div className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <form onSubmit={handleSearch} className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={`Search ${catalog.totalCatalog} products...`}
              className="pl-11 pr-20 h-10 bg-white/5 border-white/10 text-white text-sm rounded-full placeholder:text-white/30 focus:border-orange-500/50 focus:ring-orange-500/20"
            />
            {searchInput && (
              <Button 
                type="submit" 
                size="sm" 
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-white rounded-full h-7 px-3 text-xs"
              >
                Search
              </Button>
            )}
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6 pb-24">
        {/* ═══ ARTIST DROPS — productos del artista (AI + custom) ═══ */}
        {!selectedCategory && !searchQuery && page === 1 && artistProducts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-14"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white">{artist.name}'s Drops</h2>
                  <p className="text-[12px] text-white/40">
                    {customDrops.length > 0 && `${customDrops.length} exclusive · `}
                    {aiDrops.length > 0 && `${aiDrops.length} signature designs`}
                  </p>
                </div>
              </div>
              {customDrops.length > 0 && (
                <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[10px] border-0">
                  <Heart className="w-3 h-3 mr-1" /> Limited
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {artistProducts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4) }}
                >
                  <ArtistProductCard
                    product={p}
                    onBuy={handleBuyArtistProduct}
                    onAddToCart={handleAddArtistProductToCart}
                    onCreatePromo={handleCreateSocialPromo}
                  />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ═══ TRUST STRIP ═══ */}
        {!selectedCategory && !searchQuery && page === 1 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-10">
            {[
              { icon: Truck, label: 'Worldwide Shipping', sub: '50+ countries' },
              { icon: Shield, label: 'Secure Checkout', sub: 'Stripe encrypted' },
              { icon: Award, label: 'Premium Quality', sub: 'Print-on-demand' },
              { icon: Zap, label: 'Fast Production', sub: '3-5 business days' },
            ].map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-white truncate">{label}</p>
                  <p className="text-[10px] text-white/30 truncate">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ CATEGORIES — Styled cards ═══ */}
        <div className="mb-8">
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
            <button
              onClick={() => handleCategoryClick('')}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                selectedCategory === ''
                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/25'
                  : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:bg-white/[0.06] hover:text-white/70 hover:border-white/10'
              }`}
            >
              <span className="text-base">🔥</span>
              <span>All</span>
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                selectedCategory === '' ? 'bg-white/20' : 'bg-white/[0.06]'
              }`}>{catalog.totalCatalog}</span>
            </button>
            {categories.map(({ category, count }) => (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                  selectedCategory === category
                    ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/25'
                    : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:bg-white/[0.06] hover:text-white/70 hover:border-white/10'
                }`}
              >
                <span className="text-base">{CATEGORY_ICONS[category] || '📦'}</span>
                <span>{category}</span>
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  selectedCategory === category ? 'bg-white/20' : 'bg-white/[0.06]'
                }`}>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ FEATURED PRODUCTS — only on main view, page 1 ═══ */}
        {!selectedCategory && !searchQuery && page === 1 && featured.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Star className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Featured Products</h3>
                <p className="text-[11px] text-white/30">Hand-picked best sellers</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {featured.map(product => (
                <ProductCard
                  key={product.printfulId}
                  product={product}
                  onBuy={handleBuy}
                  onAddToCart={handleAddCatalogToCart}
                  onCreatePromo={handleCreateSocialPromo}
                  onOpenOptions={(p, action) => { setOptionsProduct(p); setOptionsAction(action); }}
                  variant="featured"
                />
              ))}
            </div>
          </div>
        )}

        {/* ═══ RESULTS INFO ═══ */}
        {(searchQuery || selectedCategory) && (
          <div className="flex items-center gap-2 mb-4">
            {selectedCategory && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-lg">{CATEGORY_ICONS[selectedCategory]}</span>
                <span className="text-white font-semibold">{selectedCategory}</span>
                <span className="text-white/30">·</span>
                <span className="text-white/40">{catalog.total} products</span>
              </div>
            )}
            {searchQuery && (
              <p className="text-sm text-white/40">
                Results for "<span className="text-orange-400">{searchQuery}</span>" · {catalog.total} products
              </p>
            )}
          </div>
        )}

        {/* ═══ PRODUCT GRID ═══ */}
        {catalog.products.length === 0 ? (
          <div className="text-center py-24">
            <Package className="w-14 h-14 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-sm">No products found</p>
            <button 
              onClick={() => { setSelectedCategory(''); setSearchQuery(''); setSearchInput(''); setPage(1); }}
              className="mt-3 text-orange-400 text-xs hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* All Products heading (only on main view) */}
            {!selectedCategory && !searchQuery && (
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-white/40" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">All Products</h3>
                  <p className="text-[11px] text-white/30">{catalog.total} items in store</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {catalog.products.map(product => (
                <ProductCard
                  key={product.printfulId}
                  product={product}
                  onBuy={handleBuy}
                  onAddToCart={handleAddCatalogToCart}
                  onCreatePromo={handleCreateSocialPromo}
                  onOpenOptions={(p, action) => { setOptionsProduct(p); setOptionsAction(action); }}
                  variant="default"
                />
              ))}
            </div>
          </>
        )}

        {/* ═══ PAGINATION ═══ */}
        {catalog.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-12">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="text-white border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-full px-5"
            >
              ← Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(catalog.totalPages, 5) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p > catalog.totalPages || p < 1) return null;
                return (
                  <button
                    key={p}
                    onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      p === page
                        ? 'bg-orange-500 text-white'
                        : 'text-white/40 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= catalog.totalPages}
              onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="text-white border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-full px-5"
            >
              Next →
            </Button>
          </div>
        )}

        {/* ═══ ARTIST STORY — usa imagen del artista ═══ */}
        {!selectedCategory && !searchQuery && page === 1 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="mt-20 rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-white/[0.06]"
          >
            <div className="grid md:grid-cols-2">
              <div className="relative h-64 md:h-auto min-h-[320px]">
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r md:from-transparent md:to-zinc-950 from-zinc-950/40 to-zinc-950/80" />
              </div>
              <div className="p-8 md:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-4">
                  <Music className="w-4 h-4 text-orange-400" />
                  <p className="text-orange-400 text-[11px] font-semibold tracking-widest uppercase">About the Artist</p>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
                  Every piece tells {artist.name}'s story
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-6">
                  Each design in this collection is crafted to reflect the unique artistic vision of {artist.name}.
                  {artist.genre && ` Rooted in ${artist.genre.toLowerCase()}, `}
                  every product is produced on-demand with premium materials and shipped directly to fans worldwide.
                </p>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                  <div>
                    <p className="text-2xl font-black text-white">{artistProducts.length || catalog.totalCatalog}+</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Products</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-white">100%</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Official</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-white">50+</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Countries</p>
                  </div>
                </div>
                <Link href={`/artist/${slug}`}>
                  <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full self-start">
                    Visit Artist Profile <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.section>
        )}

        {/* ═══ FOOTER PROMISE ═══ */}
        {!selectedCategory && !searchQuery && page === 1 && (
          <div className="mt-12 text-center">
            <p className="text-white/30 text-xs">Powered by Boostify Music · Print-on-demand · Ships worldwide</p>
          </div>
        )}
      </div>

      {/* ═══ PRODUCT OPTIONS MODAL — size/color picker for catalog products ═══ */}
      {promoProduct && storeData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setPromoProduct(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-orange-400 font-semibold tracking-wide uppercase">Social Publish</p>
                <h3 className="text-white font-bold text-lg mt-1">{promoProduct.displayName || promoProduct.name}</h3>
                <p className="text-white/50 text-xs mt-1">Choose platform, template and copy style.</p>
              </div>
              <button onClick={() => setPromoProduct(null)} className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center text-white/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] text-white/50 mb-2 uppercase tracking-wide">Platform</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPromoPlatform('instagram')}
                      className={`h-10 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${promoPlatform === 'instagram' ? 'border-pink-400 bg-pink-500/15 text-pink-200' : 'border-white/15 text-white/70 hover:bg-white/5'}`}
                    >
                      <Instagram className="w-3.5 h-3.5" /> Instagram
                    </button>
                    <button
                      onClick={() => setPromoPlatform('facebook')}
                      className={`h-10 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${promoPlatform === 'facebook' ? 'border-blue-400 bg-blue-500/15 text-blue-200' : 'border-white/15 text-white/70 hover:bg-white/5'}`}
                    >
                      <Facebook className="w-3.5 h-3.5" /> Facebook
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-white/50 mb-2 uppercase tracking-wide">HTML template</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['agresivo', 'elegante', 'urbano'] as PromoTemplate[]).map((tpl) => (
                      <button
                        key={tpl}
                        onClick={() => setPromoTemplate(tpl)}
                        className={`h-10 rounded-xl border text-xs font-semibold capitalize ${promoTemplate === tpl ? 'border-orange-400 bg-orange-500/15 text-orange-100' : 'border-white/15 text-white/70 hover:bg-white/5'}`}
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={copyPromoText} variant="outline" className="text-xs border-white/20 bg-white/5 text-white">
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy text
                  </Button>
                  <Button size="sm" onClick={downloadPromoHtml} variant="outline" className="text-xs border-white/20 bg-white/5 text-white">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download HTML
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[11px] text-white/50 uppercase tracking-wide mb-2">Generated copy preview</p>
                <pre className="text-[12px] text-white/85 whitespace-pre-wrap font-sans leading-relaxed max-h-[240px] overflow-y-auto">{buildPlatformCopy(promoPlatform, promoTemplate, promoProduct, storeData.artist.name, `${window.location.origin}/artist/${slug}/store`)}</pre>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setPromoProduct(null)} className="border-white/20 text-white">Cancel</Button>
              <Button onClick={handlePublishPromo} className="bg-orange-500 hover:bg-orange-600 text-white">
                Publish to {promoPlatform === 'instagram' ? 'Instagram' : 'Facebook'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {optionsProduct && (
        <ProductOptionsModal
          product={optionsProduct}
          action={optionsAction}
          onClose={() => setOptionsProduct(null)}
          onConfirm={(opts) => {
            const target = optionsProduct;
            const wasAction = optionsAction;
            setOptionsProduct(null);
            if (wasAction === 'buy') handleBuy(target, opts);
            else handleAddCatalogToCart(target, opts);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ARTIST PRODUCT CARD — para productos Firestore (AI + custom)
// ═══════════════════════════════════════════════════════════════

function ArtistProductCard({
  product,
  onBuy,
  onAddToCart,
  onCreatePromo,
}: {
  product: ArtistProduct;
  onBuy: (p: ArtistProduct, size?: string) => void;
  onAddToCart: (p: ArtistProduct, size?: string) => void;
  onCreatePromo: (p: { name: string; price: number; category?: string; imageUrl?: string; }) => void;
}) {
  const [selectedSize, setSelectedSize] = useState<string>(product.sizes[0] || '');
  const hasMultipleSizes = product.sizes.length > 1;

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/[0.06] hover:border-orange-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1">
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package className="w-10 h-10 text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none bg-black/25" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isCustom && (
            <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-lg">
              <Heart className="w-2.5 h-2.5" /> EXCLUSIVE
            </span>
          )}
          {product.aiGenerated && !product.isCustom && (
            <span className="inline-flex items-center gap-0.5 bg-orange-500/90 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
              <Sparkles className="w-2.5 h-2.5" /> SIGNATURE
            </span>
          )}
          {product.salesCount > 5 && (
            <span className="inline-flex items-center gap-0.5 bg-black/70 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
              <Star className="w-2.5 h-2.5 text-amber-400" /> {product.salesCount} sold
            </span>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onCreatePromo(product); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 border border-white/20 flex items-center justify-center text-white transition-colors"
          title="Create social promo"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3 gap-2">
          {hasMultipleSizes && (
            <div className="flex flex-wrap gap-1">
              {product.sizes.slice(0, 5).map(sz => (
                <button
                  key={sz}
                  onClick={(e) => { e.stopPropagation(); setSelectedSize(sz); }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${
                    selectedSize === sz
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <button
              onClick={() => onAddToCart(product, selectedSize)}
              className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-white/20"
              title="Add to cart"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Add
            </button>
            <button
              onClick={() => onBuy(product, selectedSize)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-lg"
            >
              Buy ${product.price.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      <div className="p-3">
        <p className="text-white font-semibold leading-tight line-clamp-1 text-xs md:text-sm">
          {product.name}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="font-bold text-orange-400 text-sm">
            ${product.price.toFixed(2)}
          </span>
          <span className="text-[10px] text-white/30">{product.category}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT IMAGE WITH DESIGN OVERLAY
// ═══════════════════════════════════════════════════════════════
//
// Strategy:
//  1. If `mockupUrl` exists → use it (Printful Mockup Generator render with
//     the artist's design already baked into the product photo).
//  2. Else if `productImageUrl` + `designUrl` → render the blank product
//     photo and overlay the design at a category-aware position. Instant,
//     free, gives a "design on product" feel for all 91 catalog products
//     without any API calls.
//  3. Else if only `designUrl` → show the design alone.
//  4. Otherwise → emoji placeholder.
//
// Per-category overlay geometry (top%, width%) for the design image, tuned
// to roughly match where the print would land on the real product.
// Logo-style brand marks generated on white BG — `mix-blend-multiply`
// drops the white out so only the design remains. Sizes kept SMALL so
// it reads as a printed logo, not as a photo glued onto the product.
const OVERLAY_GEOMETRY: Record<string, { top: string; width: string; opacity?: number }> = {
  'Apparel':              { top: '30%', width: '26%' },
  'Hoodies & Sweatshirts':{ top: '34%', width: '26%' },
  'Hats & Beanies':       { top: '42%', width: '20%' },
  'Bags':                 { top: '40%', width: '32%' },
  'Phone Cases':          { top: '24%', width: '46%' },
  'Drinkware':            { top: '34%', width: '28%' },
  'Home & Living':        { top: '32%', width: '34%' },
  'Accessories':          { top: '40%', width: '28%' },
  'Kids & Baby':          { top: '30%', width: '24%' },
  'Shoes':                { top: '46%', width: '22%' },
};
// Categories where the design IS the product → no overlay, design fills the card
const DESIGN_FILLS_PRODUCT = new Set(['Wall Art', 'Stickers & Pins']);

function ProductImageWithDesign({ product }: { product: CatalogProduct }) {
  // Tier 1 — pre-rendered Printful mockup
  if (product.mockupUrl) {
    return (
      <img
        src={product.mockupUrl}
        alt={product.displayName}
        className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
    );
  }

  // Tier 2 — design fills product (poster, sticker)
  if (DESIGN_FILLS_PRODUCT.has(product.category) && product.designUrl) {
    return (
      <img
        src={product.designUrl}
        alt={product.displayName}
        className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
    );
  }

  // Tier 3 — blank product photo + design overlay
  if (product.productImageUrl) {
    const geo = OVERLAY_GEOMETRY[product.category];
    return (
      <>
        <img
          src={product.productImageUrl}
          alt={product.displayName}
          className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {product.designUrl && geo && (
          <img
            src={product.designUrl}
            alt=""
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 object-contain pointer-events-none mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
            style={{ top: geo.top, width: geo.width, opacity: geo.opacity ?? 0.92 }}
            loading="lazy"
          />
        )}
      </>
    );
  }

  // Tier 4 — design only
  if (product.designUrl) {
    return (
      <img
        src={product.designUrl}
        alt={product.displayName}
        className="w-full h-full object-cover opacity-60"
        loading="lazy"
      />
    );
  }

  // Tier 5 — placeholder
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <span className="text-3xl mb-2">{CATEGORY_ICONS[product.category] || '📦'}</span>
      <span className="text-[10px] text-white/20 text-center">{product.name}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT CARD
// ═══════════════════════════════════════════════════════════════

function ProductCard({ 
  product, 
  onBuy, 
  onAddToCart,
  onCreatePromo,
  onOpenOptions,
  variant = 'default',
}: { 
  product: CatalogProduct; 
  onBuy: (p: CatalogProduct, opts?: { variantId?: number; size?: string; color?: string }) => void;
  onAddToCart: (p: CatalogProduct, opts?: { variantId?: number; size?: string; color?: string }) => void;
  onCreatePromo: (p: { name: string; displayName?: string; price: number; category?: string; productImageUrl?: string; mockupUrl?: string; imageUrl?: string; }) => void;
  onOpenOptions?: (p: CatalogProduct, action: 'buy' | 'cart') => void;
  variant?: 'default' | 'featured';
}) {
  const isFeatured = variant === 'featured';

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-zinc-900/80 border border-white/[0.06] hover:border-orange-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/5 hover:-translate-y-0.5">
      {/* Product Image — uses pre-rendered Printful mockup when available, else live design overlay */}
      <div className={`relative bg-gradient-to-br from-zinc-800 to-zinc-900 overflow-hidden ${isFeatured ? 'aspect-square' : 'aspect-[4/5]'}`}>
        <ProductImageWithDesign product={product} />
        <div className="absolute inset-0 pointer-events-none bg-black/25" />

        {/* Category emoji top-right */}
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreatePromo({
                  name: product.name,
                  displayName: product.displayName,
                  price: product.retailPrice,
                  category: product.category,
                  productImageUrl: product.productImageUrl,
                  mockupUrl: product.mockupUrl,
                });
              }}
              className="w-7 h-7 flex items-center justify-center bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg border border-white/20 text-white"
              title="Create social promo"
            >
              <Sparkles className="w-3 h-3" />
            </button>
            <span className="w-7 h-7 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-lg text-sm" title={product.category}>
              {CATEGORY_ICONS[product.category] || '📦'}
            </span>
          </div>
        </div>

        {/* Badges top-left */}
        {product.featured && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-0.5 bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
              <Star className="w-2.5 h-2.5" /> TOP
            </span>
          </div>
        )}

        {/* Hover overlay with Buy button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end p-3">
          <div className="w-full flex gap-1.5">
            <button
              onClick={() => onOpenOptions ? onOpenOptions(product, 'cart') : onAddToCart(product)}
              className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              title="Add to cart"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Add
            </button>
            <button 
              onClick={() => onOpenOptions ? onOpenOptions(product, 'buy') : onBuy(product)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-lg"
            >
              Buy ${product.retailPrice.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      {/* Product Info */}
      <div className={`p-3 ${isFeatured ? 'p-2.5' : ''}`}>
        <p className={`text-white font-semibold leading-tight line-clamp-1 ${isFeatured ? 'text-[11px]' : 'text-xs md:text-sm'}`}>
          {product.displayName}
        </p>
        {!isFeatured && (
          <p className="text-white/30 text-[11px] mt-0.5 line-clamp-1">{product.subcategory}</p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className={`font-bold text-orange-400 ${isFeatured ? 'text-xs' : 'text-sm'}`}>
            ${product.retailPrice.toFixed(2)}
          </span>
          {!isFeatured && (
            <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-orange-400 transition-colors" />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT OPTIONS MODAL — size + color picker for catalog products
// Fetches /api/artist-store/catalog/:printfulId/variants and lets the
// customer pick before checkout/cart, so we can pass the right
// printfulVariantId to Stripe → webhook → Printful.
// ═══════════════════════════════════════════════════════════════

interface VariantsResponse {
  printfulId: number;
  sizes: string[];
  colors: Array<{ color: string; colorCode?: string; image?: string }>;
  variants: Array<{
    variantId: number;
    size: string;
    color: string;
    colorCode: string;
    image: string;
    price: number;
    inStock: boolean;
  }>;
  total: number;
}

function ProductOptionsModal({
  product,
  action,
  onClose,
  onConfirm,
}: {
  product: CatalogProduct;
  action: 'buy' | 'cart';
  onClose: () => void;
  onConfirm: (opts: { variantId?: number; size?: string; color?: string }) => void;
}) {
  const { data, isLoading, error } = useQuery<VariantsResponse>({
    queryKey: ['catalog-variants', product.printfulId],
    queryFn: async () => {
      const res = await fetch(`/api/artist-store/catalog/${product.printfulId}/variants`);
      if (!res.ok) throw new Error('Failed to load variants');
      return res.json();
    },
  });

  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');

  // Initialize defaults when variants arrive
  useEffect(() => {
    if (!data || selectedSize || selectedColor) return;
    const firstInStock = data.variants.find(v => v.inStock) || data.variants[0];
    if (firstInStock) {
      if (firstInStock.size) setSelectedSize(firstInStock.size);
      if (firstInStock.color) setSelectedColor(firstInStock.color);
    }
  }, [data, selectedSize, selectedColor]);

  // Pick first in-stock variant matching current size/color, or first overall
  const matchedVariant = (() => {
    if (!data) return null;
    const available = data.variants.filter(v =>
      (!selectedSize || v.size === selectedSize) &&
      (!selectedColor || v.color === selectedColor)
    );
    return available.find(v => v.inStock) || available[0] || data.variants[0] || null;
  })();

  const handleConfirm = () => {
    onConfirm({
      variantId: matchedVariant?.variantId,
      size: selectedSize,
      color: selectedColor,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-start gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0">
            {(matchedVariant?.image || product.productImageUrl) && (
              <img
                src={matchedVariant?.image || product.productImageUrl}
                alt={product.displayName}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-base leading-tight">{product.displayName}</h3>
            <p className="text-white/40 text-xs mt-0.5 line-clamp-1">{product.subcategory}</p>
            <p className="text-orange-400 font-bold text-lg mt-1">${product.retailPrice.toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-3" />
              <p className="text-white/40 text-xs">Loading sizes & colors…</p>
            </div>
          )}

          {error && (
            <div className="py-8 text-center">
              <p className="text-red-400 text-sm mb-2">Couldn't load options</p>
              <p className="text-white/30 text-xs">You can still buy with default options.</p>
            </div>
          )}

          {data && (
            <>
              {/* Sizes */}
              {data.sizes.length > 0 && (
                <div>
                  <p className="text-white text-xs font-semibold mb-2 uppercase tracking-wider">Size</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.sizes.map((s) => {
                      const isAvailable = data.variants.some(v =>
                        v.size === s && (!selectedColor || v.color === selectedColor) && v.inStock
                      );
                      const isSelected = selectedSize === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setSelectedSize(s)}
                          disabled={!isAvailable && data.colors.length === 0}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-orange-500 text-white border-orange-500'
                              : isAvailable
                              ? 'bg-white/5 text-white border-white/10 hover:border-orange-500/50'
                              : 'bg-white/[0.02] text-white/30 border-white/5 line-through cursor-not-allowed'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Colors */}
              {data.colors.length > 0 && (
                <div>
                  <p className="text-white text-xs font-semibold mb-2 uppercase tracking-wider">
                    Color {selectedColor && <span className="text-white/40 normal-case font-normal">· {selectedColor}</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.colors.map((c) => {
                      const isAvailable = data.variants.some(v =>
                        v.color === c.color && (!selectedSize || v.size === selectedSize) && v.inStock
                      );
                      const isSelected = selectedColor === c.color;
                      return (
                        <button
                          key={c.color}
                          onClick={() => setSelectedColor(c.color)}
                          disabled={!isAvailable && data.sizes.length === 0}
                          title={c.color}
                          className={`w-9 h-9 rounded-full border-2 transition-all ${
                            isSelected ? 'border-orange-500 scale-110' : 'border-white/10 hover:border-white/30'
                          } ${!isAvailable ? 'opacity-30' : ''}`}
                          style={{ background: c.colorCode || '#888' }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {!matchedVariant?.inStock && matchedVariant && (
                <p className="text-yellow-400 text-xs">⚠ This combination may be out of stock</p>
              )}

              {/* Stock + variant info */}
              <div className="flex items-center justify-between text-[11px] text-white/40 pt-1 border-t border-white/5">
                <span>Variant #{matchedVariant?.variantId || '—'}</span>
                <span>{data.total} options available</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 flex gap-2">
          <Button variant="outline" onClick={onClose} className="text-white border-white/10 bg-white/5">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (!!data && !matchedVariant)}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            {action === 'buy' ? (
              <><ShoppingBag className="w-4 h-4 mr-2" /> Buy ${product.retailPrice.toFixed(2)}</>
            ) : (
              <><ShoppingBag className="w-4 h-4 mr-2" /> Add to cart</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
