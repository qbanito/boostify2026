/**
 * Viral Product Content Generator
 * Fetches trending TikTok products and generates AI promotional content
 * (promo images + video ads) for artists to promote on TikTok
 * Session-persistent gallery of generated content
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../ui/button";
import {
  TrendingUp,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  Download,
  Loader2,
  Play,
  Image as ImageIcon,
  Film,
  ExternalLink,
  RefreshCw,
  Share2,
  Trash2,
  Tag,
  Sparkles,
  Filter,
  HelpCircle,
  X,
  Zap,
  Brain,
  Star,
  Crown,
  Globe,
  Target,
  CheckCircle,
  Pencil,
  DollarSign,
  Check,
  Package,
  Percent,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../../hooks/use-toast";

interface TikTokProduct {
  rank: number;
  product_id: string;
  name: string;
  price_display: string;
  units_sold: number;
  gmv: number;
  creator_count: number;
  product_img_url: string;
  product_url: string;
  engagement_rate: number;
  region: string;
  categories?: string[];
}

interface GeneratedContent {
  id: string;
  productId: string;
  productName: string;
  productPrice: string;
  productUrl: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: number;
}

interface ProductConfig {
  customPrice?: string;
  commissionTarget?: string;
  promoCode?: string;
  notes?: string;
}

interface ViralProductGeneratorProps {
  artistId: string;
  pgId?: number;
  isOwnProfile: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  colors: {
    hexPrimary: string;
    hexAccent: string;
    hexBorder?: string;
    textMuted?: string;
    cardBg?: string;
    hexBg?: string;
    hexText?: string;
    [key: string]: string | undefined;
  };
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
  artistName: string;
  artistImageUrl?: string;
  artistGenre?: string;
  artistGender?: 'male' | 'female' | 'unspecified' | string;
}

// ─── Gender coherence: keywords strongly associated with one gender ───────────
// Products whose names/categories contain these are penalised for the opposite gender.
const FEMALE_ONLY_KEYWORDS = [
  'womens', "women's", 'woman', 'ladies', 'ladys', 'girl', 'girls',
  'bra', 'bikini', 'swimsuit', 'lingerie', 'panties', 'thong', 'lace underwear',
  'pregnancy', 'maternity', 'menstrual', 'period', 'tampon', 'pad',
  'blush', 'mascara', 'eyeliner', 'lipstick', 'lip gloss', 'eyeshadow', 'foundation',
  'concealer', 'blush brush', 'contour', 'highlighter makeup',
  'nail polish', 'acrylic nail', 'press on nail', 'lash', 'false lash',
  'hair extension', 'wig', 'weave', 'clip in hair',
  'push up', 'crop top women', 'bodysuit women', 'leggings women', 'skirt', 'dress',
  'heels', 'high heels', 'stiletto', 'pumps shoes',
  'period cramp', 'yoni', 'feminine wash',
];

const MALE_ONLY_KEYWORDS = [
  'mens', "men's", 'man', 'guys', 'boys',
  'beard', 'shaving cream', 'razor men', 'beard oil', 'beard balm', 'beard trimmer',
  'jockstrap', 'boxer brief', 'men underwear',
  'suit men', 'tie', 'cufflink',
];

/**
 * Returns a gender penalty score for a product.
 * Negative = incompatible with artist gender.
 * 0 = neutral / acceptable.
 */
function getGenderPenalty(product: TikTokProduct, gender: string): number {
  if (!gender || gender === 'unspecified') return 0;
  const text = `${product.name} ${(product.categories || []).join(' ')}`.toLowerCase();
  const isMale = gender === 'male';
  const isFemale = gender === 'female';

  if (isMale) {
    for (const kw of FEMALE_ONLY_KEYWORDS) {
      if (text.includes(kw)) return -50; // strongly penalise
    }
  }
  if (isFemale) {
    for (const kw of MALE_ONLY_KEYWORDS) {
      if (text.includes(kw)) return -50;
    }
  }
  return 0;
}

// Genre → product keyword mapping for smart filtering
const GENRE_PRODUCT_KEYWORDS: Record<string, string[]> = {
  'hip-hop': ['chain', 'jewelry', 'sneakers', 'cap', 'headphones', 'speaker', 'watch', 'sunglasses', 'hoodie', 'backpack', 'microphone', 'led', 'phone'],
  'rap': ['chain', 'jewelry', 'sneakers', 'cap', 'headphones', 'speaker', 'watch', 'sunglasses', 'hoodie', 'microphone', 'phone', 'led'],
  'trap': ['chain', 'led', 'speaker', 'headphones', 'watch', 'hoodie', 'mask', 'sneakers', 'phone', 'light'],
  'pop': ['phone', 'makeup', 'light', 'ring light', 'headphones', 'speaker', 'camera', 'microphone', 'skincare', 'fashion', 'bag', 'watch'],
  'k-pop': ['skincare', 'makeup', 'light stick', 'phone', 'camera', 'fashion', 'bag', 'headphones', 'plush', 'sticker'],
  'rock': ['guitar', 'amp', 'headphones', 'leather', 'jacket', 'boots', 'band', 'speaker', 'microphone', 'sticker', 'patch', 'vinyl'],
  'indie': ['vinyl', 'camera', 'journal', 'tote', 'candle', 'book', 'headphones', 'sticker', 'plant', 'art'],
  'electronic': ['headphones', 'speaker', 'led', 'light', 'controller', 'midi', 'phone', 'gadget', 'usb', 'cable'],
  'edm': ['led', 'light', 'speaker', 'headphones', 'water bottle', 'fan', 'bracelet', 'phone', 'gadget'],
  'r&b': ['candle', 'perfume', 'jewelry', 'watch', 'headphones', 'skincare', 'fashion', 'speaker', 'phone'],
  'jazz': ['vinyl', 'book', 'candle', 'wine', 'speaker', 'headphones', 'watch', 'pen', 'leather'],
  'reggaeton': ['speaker', 'sunglasses', 'chain', 'watch', 'phone', 'led', 'headphones', 'sneakers', 'fashion'],
  'latin': ['speaker', 'headphones', 'sunglasses', 'jewelry', 'fashion', 'phone', 'dance', 'shoes'],
  'country': ['boots', 'hat', 'guitar', 'leather', 'flask', 'belt', 'outdoor', 'camp', 'knife'],
  'folk': ['guitar', 'candle', 'journal', 'book', 'tote', 'hat', 'camping', 'mug', 'blanket'],
  'classical': ['book', 'pen', 'watch', 'candle', 'wine', 'speaker', 'vinyl', 'headphones'],
  'reggae': ['bracelet', 'speaker', 'incense', 'tapestry', 'sunglasses', 'hat', 'plant', 'tea'],
  'metal': ['leather', 'boots', 'chain', 'ring', 'patch', 'speaker', 'headphones', 'skull', 'band'],
  'soul': ['candle', 'perfume', 'vinyl', 'jewelry', 'headphones', 'speaker', 'fashion', 'book'],
  'lofi': ['headphones', 'desk', 'plant', 'lamp', 'mug', 'sticker', 'keyboard', 'mouse pad', 'art print'],
};

// Archetype → product keyword mapping
const ARCHETYPE_KEYWORDS: Record<string, string[]> = {
  'rebel': ['leather', 'chain', 'skull', 'boots', 'ring', 'band', 'jacket', 'patch'],
  'creator': ['camera', 'journal', 'art', 'canvas', 'sketchbook', 'tablet', 'pen', 'lamp'],
  'hero': ['watch', 'gym', 'fitness', 'sneakers', 'backpack', 'gear', 'shaker', 'band'],
  'lover': ['perfume', 'candle', 'jewelry', 'rose', 'silk', 'skincare', 'plush', 'heart'],
  'outlaw': ['chain', 'tattoo', 'lighter', 'boots', 'bandana', 'skull', 'ring', 'leather'],
  'sage': ['book', 'tea', 'candle', 'incense', 'journal', 'vinyl', 'plant', 'headphones'],
  'jester': ['led', 'gadget', 'toy', 'light', 'phone', 'game', 'sticker', 'hoodie'],
  'magician': ['led', 'projection', 'light', 'gadget', 'smoke', 'crystal', 'art'],
  'ruler': ['watch', 'suit', 'pen', 'briefcase', 'leather', 'wallet', 'ring'],
  'innocent': ['plush', 'sticker', 'bag', 'phone case', 'candle', 'mug', 'journal'],
  'caregiver': ['mug', 'blanket', 'plant', 'candle', 'tea', 'journal', 'skincare'],
  'explorer': ['backpack', 'outdoor', 'camera', 'boots', 'hat', 'flask', 'tent', 'knife'],
};

const GUIDE_ITEMS = [
  {
    icon: TrendingUp,
    color: '#f97316',
    title: 'What are Viral Product Ads?',
    body: 'This module pulls the top 500 trending products from TikTok Shop and generates AI-powered promotional content (images + videos) featuring YOU as the face of those products — ready to post and earn commissions.',
  },
  {
    icon: Brain,
    color: '#8b5cf6',
    title: 'Blueprint Intelligence',
    body: 'When your Superstar Blueprint is generated, this module reads your genre, brand archetype, visual aesthetic, fashion keywords, and mood profile to intelligently rank which products best fit your artist brand.',
  },
  {
    icon: ShoppingBag,
    color: '#3b82f6',
    title: 'Smart Product Matching',
    body: 'Products are scored against your genre (e.g. Hip-Hop → chains, sneakers) and Blueprint signals (e.g. Rebel archetype → leather, boots). Enable the genre filter to see your best matches at the top.',
  },
  {
    icon: ImageIcon,
    color: '#ec4899',
    title: 'Step 1 — Promo Image',
    body: 'Select a product and click "Generate Promo Image". Our AI composites your profile photo with the product using FAL AI to create a professional promotional visual in seconds.',
  },
  {
    icon: Film,
    color: '#10b981',
    title: 'Step 2 — TikTok Video',
    body: 'After generating the promo image, click "Generate TikTok Video" to animate it into a short vertical video optimized for TikTok format. Takes ~60 seconds.',
  },
  {
    icon: Share2,
    color: '#f59e0b',
    title: 'Posting to TikTok',
    body: 'Click "Post" to open the product link on TikTok Shop and automatically copy a caption with your artist hashtag. Download the video and upload it manually to TikTok — the affiliate commission is tied to your link.',
  },
  {
    icon: Star,
    color: '#06b6d4',
    title: 'Session Gallery',
    body: 'All generated content is saved in a gallery that persists for the current session. You can browse, download, or re-post any previously generated image or video without regenerating.',
  },
  {
    icon: Crown,
    color: '#a855f7',
    title: 'Tips for Success',
    body: 'Pick products priced $10–$50 with 100K+ sales — these convert best on TikTok. Use your genre filter to find on-brand products. Generate 3–5 posts per week for consistent affiliate income.',
  },
  {
    icon: Package,
    color: '#f59e0b',
    title: 'Custom Pricing & Bids',
    body: 'Click the price on any selected product to set your own promo price. Use the "My Package / Bid" section to define a commission target %, add a promo code (included automatically in captions), write offer notes, and preview the final TikTok caption before posting.',
  },
];

function getSessionStorageKey(artistId: string) {
  return `viral-promo-gallery-${artistId}`;
}

export function ViralProductGenerator({
  artistId,
  pgId,
  isOwnProfile,
  isExpanded,
  onToggleExpand,
  colors,
  cardStyles,
  cardStyleInline,
  artistName,
  artistImageUrl,
  artistGenre,
  artistGender = 'unspecified',
}: ViralProductGeneratorProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<TikTokProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<TikTokProduct | null>(null);
  const [showGenreFilter, setShowGenreFilter] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  // Blueprint data for smart product matching
  const { data: blueprintData } = useQuery<any>({
    queryKey: [`/api/artist-blueprint/${pgId}`],
    enabled: !!pgId && isExpanded,
    staleTime: 10 * 60 * 1000,
  });

  // Extract blueprint signals for enhanced product scoring
  const blueprintSignals = (() => {
    const bp = blueprintData?.blueprint as Record<string, any> | undefined;
    if (!bp) return null;
    const dna = bp.artist_dna as Record<string, any> | undefined;
    const identity = bp.identity as Record<string, any> | undefined;
    const visual = bp.visual_universe as Record<string, any> | undefined;
    const sound = bp.sound as Record<string, any> | undefined;
    return {
      genre: (dna?.primary_genre as string || '').toLowerCase(),
      secondaryGenres: (Array.isArray(dna?.secondary_genres) ? dna!.secondary_genres : []) as string[],
      archetype: (identity?.brand_archetype as string || '').toLowerCase(),
      traits: (Array.isArray(identity?.personality_traits) ? identity!.personality_traits : []) as string[],
      fashionKeywords: (Array.isArray(visual?.fashion_keywords) ? visual!.fashion_keywords : []) as string[],
      aesthetic: (visual?.aesthetic as string || '').toLowerCase(),
      moodKeywords: (Array.isArray(sound?.mood_keywords) ? sound!.mood_keywords : []) as string[],
    };
  })();

  // Product configuration (custom prices, bids, promo codes)
  const [productConfigs, setProductConfigs] = useState<Record<string, ProductConfig>>({});
  const [showPackageEditor, setShowPackageEditor] = useState(false);
  const [priceEditMode, setPriceEditMode] = useState(false);

  const getProductConfig = (productId: string): ProductConfig =>
    productConfigs[productId] || {};

  const updateProductConfig = (productId: string, patch: Partial<ProductConfig>) =>
    setProductConfigs(prev => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));

  const getDisplayPrice = (productId: string, defaultPrice: string) =>
    productConfigs[productId]?.customPrice?.trim() || defaultPrice;

  // Generation state
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [promoImageUrl, setPromoImageUrl] = useState<string | null>(null);
  const [promoVideoUrl, setPromoVideoUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Session gallery — persists across product switches
  const [gallery, setGallery] = useState<GeneratedContent[]>(() => {
    try {
      const saved = sessionStorage.getItem(getSessionStorageKey(artistId));
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Persist gallery to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(getSessionStorageKey(artistId), JSON.stringify(gallery));
    } catch {}
  }, [gallery, artistId]);

  // Detect gender from blueprint if not provided via prop
  const resolvedGender: string = (() => {
    if (artistGender && artistGender !== 'unspecified') return artistGender;
    const bp = blueprintData?.blueprint as Record<string, any> | undefined;
    const bpGender = bp?.artist_dna?.gender || bp?.gender || '';
    if (bpGender) return (bpGender as string).toLowerCase();
    return 'unspecified';
  })();

  // Smart product scoring based on artist genre + blueprint signals + gender
  const scoreProductForGenre = useCallback((product: TikTokProduct, genre: string): number => {
    const normalizedGenre = genre.toLowerCase().trim();
    const keywords = GENRE_PRODUCT_KEYWORDS[normalizedGenre] || GENRE_PRODUCT_KEYWORDS['pop'] || [];
    const productText = product.name.toLowerCase();
    const categoryText = (product.categories || []).join(' ').toLowerCase();
    const searchText = `${productText} ${categoryText}`;

    // Apply gender penalty first — if it returns -50, the product is incompatible
    const genderScore = getGenderPenalty(product, resolvedGender);
    if (genderScore < 0) return genderScore;

    let score = 0;
    // Genre keyword matching
    for (const kw of keywords) {
      if (searchText.includes(kw)) score += 10;
    }
    // Blueprint signal boosts
    if (blueprintSignals) {
      // Secondary genres
      for (const g of blueprintSignals.secondaryGenres) {
        const kws2 = GENRE_PRODUCT_KEYWORDS[g.toLowerCase()] || [];
        for (const kw of kws2) {
          if (searchText.includes(kw)) score += 4;
        }
      }
      // Brand archetype keywords
      const archetypeKey = Object.keys(ARCHETYPE_KEYWORDS).find(k => blueprintSignals.archetype.includes(k));
      if (archetypeKey) {
        for (const kw of ARCHETYPE_KEYWORDS[archetypeKey]) {
          if (searchText.includes(kw)) score += 6;
        }
      }
      // Fashion keywords from visual universe
      for (const kw of blueprintSignals.fashionKeywords) {
        if (searchText.includes(kw.toLowerCase())) score += 8;
      }
      // Aesthetic keywords
      const aestheticWords = blueprintSignals.aesthetic.split(/[\s,]+/);
      for (const w of aestheticWords) {
        if (w.length > 3 && searchText.includes(w)) score += 3;
      }
      // Mood keywords
      for (const mood of blueprintSignals.moodKeywords) {
        if (searchText.includes(mood.toLowerCase())) score += 2;
      }
    }
    // Boost high-selling products
    if (product.units_sold > 100000) score += 5;
    if (product.units_sold > 500000) score += 5;
    if (product.engagement_rate > 5) score += 3;
    return score;
  }, [blueprintSignals, resolvedGender]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/viral-products?limit=500');
      const data = await res.json();
      if (data.success && data.products) {
        let sorted = data.products as TikTokProduct[];
        // Always filter out gender-incompatible products
        sorted = sorted.filter(p => getGenderPenalty(p, resolvedGender) >= 0);
        // Sort by genre relevance if genre is available
        if (artistGenre && showGenreFilter) {
          sorted = [...sorted].sort((a, b) => {
            const sa = scoreProductForGenre(a, artistGenre);
            const sb = scoreProductForGenre(b, artistGenre);
            return sb - sa; // highest score first
          });
        }
        setProducts(sorted);
      }
    } catch (err) {
      console.error('Error fetching viral products:', err);
      toast({ title: "Error", description: "Could not load viral products", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded && products.length === 0 && !loading) {
      fetchProducts();
    }
  }, [isExpanded]);

  // Re-sort when filter toggles
  useEffect(() => {
    if (products.length > 0 && artistGenre) {
      // Re-apply gender filter + genre sort
      const genderFiltered = products.filter(p => getGenderPenalty(p, resolvedGender) >= 0);
      const sorted = [...genderFiltered].sort((a, b) => {
        if (!showGenreFilter) return 0;
        return scoreProductForGenre(b, artistGenre) - scoreProductForGenre(a, artistGenre);
      });
      setProducts(sorted);
    }
  }, [showGenreFilter]);

  const handleSelectProduct = (product: TikTokProduct) => {
    setSelectedProduct(product);
    // Check if we already generated content for this product in this session
    const existing = gallery.find(g => g.productId === product.product_id);
    if (existing) {
      setPromoImageUrl(existing.imageUrl || null);
      setPromoVideoUrl(existing.videoUrl || null);
      setImageLoaded(!!existing.imageUrl);
    } else {
      setPromoImageUrl(null);
      setPromoVideoUrl(null);
      setImageLoaded(false);
    }
    setImageLoadError(false);
  };

  const addToGallery = (productId: string, productName: string, productPrice: string, productUrl: string, imageUrl?: string, videoUrl?: string) => {
    setGallery(prev => {
      const existing = prev.find(g => g.productId === productId);
      if (existing) {
        return prev.map(g => g.productId === productId ? {
          ...g,
          imageUrl: imageUrl || g.imageUrl,
          videoUrl: videoUrl || g.videoUrl,
        } : g);
      }
      return [...prev, {
        id: `${productId}-${Date.now()}`,
        productId,
        productName,
        productPrice,
        productUrl,
        imageUrl,
        videoUrl,
        createdAt: Date.now(),
      }];
    });
  };

  const removeFromGallery = (productId: string) => {
    setGallery(prev => prev.filter(g => g.productId !== productId));
  };

  const handleGenerateImage = async () => {
    if (!selectedProduct || !artistImageUrl) {
      toast({ title: "Missing data", description: "Artist image and product selection required", variant: "destructive" });
      return;
    }
    setGeneratingImage(true);
    setImageLoadError(false);
    setImageLoaded(false);
    try {
      const res = await fetch('/api/viral-products/generate-promo-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistImageUrl,
          productId: selectedProduct.product_id,
          artistName,
        }),
      });
      const data = await res.json();
      if (data.success && data.promoImageUrl) {
        setPromoImageUrl(data.promoImageUrl);
        addToGallery(selectedProduct.product_id, selectedProduct.name, getDisplayPrice(selectedProduct.product_id, selectedProduct.price_display), selectedProduct.product_url, data.promoImageUrl);
        toast({ title: "🖼️ Promo Image Ready!", description: "Saved to your session gallery" });
      } else {
        toast({ title: "Error", description: data.error || "Image generation failed", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!promoImageUrl || !selectedProduct) {
      toast({ title: "Generate image first", description: "You need a promo image before creating the video", variant: "destructive" });
      return;
    }
    setGeneratingVideo(true);
    try {
      const res = await fetch('/api/viral-products/generate-promo-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promoImageUrl,
          productId: selectedProduct.product_id,
          artistName,
          artistGenre: artistGenre || 'pop',
        }),
      });
      const data = await res.json();
      if (data.success && data.promoVideoUrl) {
        setPromoVideoUrl(data.promoVideoUrl);
        addToGallery(selectedProduct.product_id, selectedProduct.name, selectedProduct.price_display, selectedProduct.product_url, promoImageUrl || undefined, data.promoVideoUrl);
        toast({ title: "🎬 Promo Video Ready!", description: "Saved to your session gallery" });
      } else {
        toast({ title: "Error", description: data.error || "Video generation failed", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingVideo(false);
    }
  };

  const handlePostToTikTok = (content: GeneratedContent) => {
    const cfg = getProductConfig(content.productId);
    const displayPrice = cfg.customPrice?.trim() || content.productPrice;
    const promoCodePart = cfg.promoCode?.trim() ? ` 🏷️ Code: ${cfg.promoCode.trim()}` : '';
    const text = `🔥 Check out this ${content.productName}!${promoCodePart} → $${displayPrice} 🛒 #TikTokShop #ad #${artistName.replace(/\s+/g, '')}`;
    window.open(content.productUrl, '_blank');
    navigator.clipboard?.writeText(text).then(() => {
      toast({ title: "📋 Caption Copied!", description: "Product link opened. Paste the caption in your TikTok post!" });
    }).catch(() => {
      toast({ title: "🔗 Product Link Opened", description: "Download the video/image and post it on TikTok" });
    });
  };

  const formatSales = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const genreRelevanceTag = (product: TikTokProduct) => {
    if (!artistGenre || !showGenreFilter) return null;
    const score = scoreProductForGenre(product, artistGenre);
    if (score >= 10) return <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-500/90 text-white">🎯 Match</span>;
    return null;
  };

  const resolvedHexText = colors.hexText || colors.textMuted || '#e2e8f0';

  return (
    <div className={cardStyles} style={cardStyleInline}>

      {/* ── GUIDE OVERLAY ─────────────────────────────────────── */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            key="viral-guide-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              initial={{ y: 64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 64, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10"
              style={{ background: 'linear-gradient(145deg,#0d0d12,#191924)' }}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/8 rounded-t-2xl"
                style={{ background: 'rgba(13,13,18,0.96)', backdropFilter: 'blur(12px)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${colors.hexAccent}25` }}>
                    <HelpCircle className="w-4 h-4" style={{ color: colors.hexAccent }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black tracking-widest uppercase" style={{ color: colors.hexAccent }}>How it works</p>
                    <h3 className="text-base font-bold text-white leading-tight">Viral Product Ads Guide</h3>
                  </div>
                </div>
                <button onClick={() => setShowGuide(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 sm:px-6 py-4 space-y-3">
                {GUIDE_ITEMS.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3 p-3 rounded-xl border border-white/6"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: `${item.color}20` }}>
                      <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                      <p className="text-xs text-gray-400 leading-relaxed">{item.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="px-4 sm:px-6 py-4 border-t border-white/8">
                <p className="text-[10px] text-gray-500 text-center">AI generation via FAL AI · Products from TikTok Shop · Session gallery persists until tab close</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECTION HEADER ────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={onToggleExpand}
          className="flex-1 text-left flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
        >
          <div className="text-base font-semibold flex items-center gap-2 min-w-0" style={{ color: colors.hexAccent }}>
            {isExpanded ? <ChevronDown className="h-5 w-5 flex-shrink-0" /> : <ChevronRight className="h-5 w-5 flex-shrink-0" />}
            <TrendingUp className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">🔥 Viral Product Ads</span>
            {gallery.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0" style={{ background: colors.hexAccent, color: '#fff' }}>
                {gallery.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={e => { e.stopPropagation(); setShowGuide(true); }}
          className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center hover:opacity-80 transition-colors"
          style={{ color: colors.hexAccent }}
          title="How it works"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">

          {/* Blueprint Intelligence banner */}
          {blueprintSignals && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8"
              style={{ background: 'rgba(139,92,246,0.08)' }}
            >
              <Brain className="h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
              <p className="text-[11px] text-gray-400 flex-1 min-w-0">
                <span className="text-purple-300 font-semibold">Blueprint Active</span>
                {' — '}
                {[
                  blueprintSignals.genre && `${blueprintSignals.genre}`,
                  blueprintSignals.archetype && `${blueprintSignals.archetype.split(' ').slice(-1)[0]} archetype`,
                  blueprintSignals.fashionKeywords.length > 0 && `${blueprintSignals.fashionKeywords.slice(0, 2).join(', ')}`,
                ].filter(Boolean).join(' · ')}
              </p>
              <span className="text-[10px] text-purple-400 font-semibold flex-shrink-0">AI Match</span>
            </motion.div>
          )}

          {/* Controls bar */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: resolvedHexText }}>
              <ShoppingBag className="h-3.5 w-3.5" style={{ color: colors.hexAccent }} />
              Trending Products
              <span className="text-[10px] opacity-40">({products.length})</span>
            </h3>
            <div className="flex items-center gap-1.5">
              {(artistGenre || blueprintSignals?.genre) && (
                <button
                  onClick={() => setShowGenreFilter(f => !f)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border"
                  style={showGenreFilter
                    ? { background: colors.hexAccent, color: '#fff', borderColor: colors.hexAccent }
                    : { background: 'transparent', color: resolvedHexText, borderColor: `${resolvedHexText}30` }
                  }
                  title={`Filter products matching ${artistGenre || blueprintSignals?.genre}`}
                >
                  <Sparkles className="h-3 w-3" />
                  {artistGenre || blueprintSignals?.genre}
                </button>
              )}
              <button
                onClick={fetchProducts}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all hover:opacity-80"
                style={{ borderColor: `${resolvedHexText}25`, color: resolvedHexText }}
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {loading && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: `${colors.hexAccent}20` }}
              >
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: colors.hexAccent }} />
              </motion.div>
              <span className="text-sm text-gray-400">Loading viral products...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
              {products.map((product, idx) => {
                const isSelected = selectedProduct?.product_id === product.product_id;
                const hasContent = gallery.some(g => g.productId === product.product_id);
                const score = (artistGenre || blueprintSignals?.genre)
                  ? scoreProductForGenre(product, artistGenre || blueprintSignals?.genre || '')
                  : 0;
                const isMatch = score >= 10;
                return (
                  <motion.button
                    key={product.product_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => handleSelectProduct(product)}
                    className="relative rounded-xl border p-2 text-left transition-all cursor-pointer overflow-hidden"
                    style={{
                      borderColor: isSelected ? colors.hexAccent : `${resolvedHexText}18`,
                      background: isSelected
                        ? `${colors.hexAccent}18`
                        : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    {/* Badges */}
                    {isMatch && showGenreFilter && (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold z-10" style={{ background: colors.hexAccent, color: '#fff' }}>
                        🎯
                      </span>
                    )}
                    {hasContent && (
                      <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center z-10">
                        <CheckCircle className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${colors.hexAccent}` }} />
                    )}
                    <div className="aspect-square rounded-lg overflow-hidden mb-1.5 bg-black/20">
                      <img
                        src={product.product_img_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23666" font-size="12">No img</text></svg>'; }}
                      />
                    </div>
                    <p className="text-xs font-semibold line-clamp-2 leading-tight mb-1 text-white">
                      {product.name.length > 50 ? product.name.substring(0, 50) + '…' : product.name}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: colors.hexAccent }}>
                        ${product.price_display}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {formatSales(product.units_sold)} sold
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Selected product + generation controls */}
          {selectedProduct && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-4 space-y-4"
              style={{
                borderColor: `${colors.hexAccent}35`,
                background: `linear-gradient(145deg, ${colors.hexAccent}08, rgba(0,0,0,0.3))`,
              }}
            >
              {/* Product summary */}
              <div className="flex gap-3 items-start">
                <img
                  src={selectedProduct.product_img_url}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white line-clamp-2 leading-snug">
                    {selectedProduct.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {/* Inline price editor */}
                    <div className="flex items-center gap-1">
                      {priceEditMode ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">$</span>
                          <input
                            type="text"
                            autoFocus
                            value={getProductConfig(selectedProduct.product_id).customPrice ?? selectedProduct.price_display}
                            onChange={e => updateProductConfig(selectedProduct.product_id, { customPrice: e.target.value })}
                            onBlur={() => setPriceEditMode(false)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setPriceEditMode(false); }}
                            className="w-20 rounded px-1.5 py-0.5 text-sm font-bold text-white outline-none border"
                            style={{ background: 'rgba(0,0,0,0.5)', borderColor: colors.hexAccent }}
                          />
                          <button onClick={() => setPriceEditMode(false)} className="text-green-400 hover:text-green-300">
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPriceEditMode(true)}
                          className="flex items-center gap-1 group"
                          title="Click to set your custom promo price"
                        >
                          <span className="text-sm font-bold" style={{ color: colors.hexAccent }}>
                            ${getDisplayPrice(selectedProduct.product_id, selectedProduct.price_display)}
                          </span>
                          {getProductConfig(selectedProduct.product_id).customPrice?.trim() &&
                            getProductConfig(selectedProduct.product_id).customPrice !== selectedProduct.price_display && (
                            <span className="text-[10px] text-gray-600 line-through">${selectedProduct.price_display}</span>
                          )}
                          <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" style={{ color: colors.hexAccent }} />
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500">{formatSales(selectedProduct.units_sold)} sold</span>
                    <span className="text-[11px] text-gray-500">Rank #{selectedProduct.rank}</span>
                  </div>
                  <a
                    href={selectedProduct.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] mt-1 hover:opacity-80 transition-opacity"
                    style={{ color: colors.hexAccent }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    View on TikTok Shop
                  </a>
                </div>
              </div>

              {/* ── PACKAGE / BID EDITOR ──────────────────────── */}
              {(() => {
                const cfg = getProductConfig(selectedProduct.product_id);
                const isConfigured = !!(cfg.customPrice?.trim() || cfg.promoCode?.trim() || cfg.commissionTarget?.trim());
                const captionArtist = artistName.replace(/\s+/g, '');
                return (
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <button
                      onClick={() => setShowPackageEditor(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/3 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5" style={{ color: colors.hexAccent }} />
                        <span className="text-xs font-semibold text-white">My Package / Bid</span>
                        {isConfigured && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${colors.hexAccent}25`, color: colors.hexAccent }}>
                            Configured
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${showPackageEditor ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {showPackageEditor && (
                        <motion.div
                          key="pkg-editor"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-2 space-y-3 border-t border-white/8" style={{ background: 'rgba(0,0,0,0.2)' }}>

                            {/* Custom promo price */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5">
                                <DollarSign className="h-3 w-3" style={{ color: colors.hexAccent }} />
                                My Promo Price
                                <span className="font-normal text-gray-600">(default: ${selectedProduct.price_display})</span>
                              </label>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-400 font-bold">$</span>
                                <input
                                  type="text"
                                  placeholder={selectedProduct.price_display}
                                  value={cfg.customPrice || ''}
                                  onChange={e => updateProductConfig(selectedProduct.product_id, { customPrice: e.target.value })}
                                  className="flex-1 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none border border-white/12 focus:border-opacity-80 transition-colors"
                                  style={{ background: 'rgba(0,0,0,0.4)', '--tw-ring-color': colors.hexAccent } as React.CSSProperties}
                                  onFocus={e => (e.target.style.borderColor = colors.hexAccent)}
                                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                                />
                              </div>
                            </div>

                            {/* Commission target */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5">
                                <Percent className="h-3 w-3 text-green-400" />
                                Commission Goal (%)
                                <span className="font-normal text-gray-600">— your target from TikTok affiliate</span>
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="e.g. 20"
                                  min="1"
                                  max="80"
                                  value={cfg.commissionTarget || ''}
                                  onChange={e => updateProductConfig(selectedProduct.product_id, { commissionTarget: e.target.value })}
                                  className="w-24 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none border border-white/12 transition-colors"
                                  style={{ background: 'rgba(0,0,0,0.4)' }}
                                  onFocus={e => (e.target.style.borderColor = '#4ade80')}
                                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                                />
                                <span className="text-sm text-gray-500 font-semibold">%</span>
                                {cfg.commissionTarget && (
                                  <span className="text-[11px] text-green-400">
                                    ≈ ${(parseFloat(getDisplayPrice(selectedProduct.product_id, selectedProduct.price_display) || '0') * parseFloat(cfg.commissionTarget) / 100).toFixed(2)} per sale
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Promo code */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5">
                                <Tag className="h-3 w-3 text-yellow-400" />
                                Promo Code
                                <span className="font-normal text-gray-600">(optional — included in caption)</span>
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. ARTIST10"
                                value={cfg.promoCode || ''}
                                onChange={e => updateProductConfig(selectedProduct.product_id, { promoCode: e.target.value.toUpperCase() })}
                                className="w-full rounded-lg px-3 py-1.5 text-sm font-mono text-white placeholder-gray-600 outline-none border border-white/12 transition-colors"
                                style={{ background: 'rgba(0,0,0,0.4)' }}
                                onFocus={e => (e.target.style.borderColor = '#fbbf24')}
                                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                              />
                            </div>

                            {/* Notes */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-gray-400">Bid / Offer Notes</label>
                              <textarea
                                placeholder="e.g. Exclusive collab rate, limited-time offer, bundle deal..."
                                value={cfg.notes || ''}
                                onChange={e => updateProductConfig(selectedProduct.product_id, { notes: e.target.value })}
                                className="w-full rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none border border-white/12 transition-colors resize-none"
                                style={{ background: 'rgba(0,0,0,0.4)' }}
                                rows={2}
                                onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.25)')}
                                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                              />
                            </div>

                            {/* Caption preview */}
                            {(cfg.customPrice?.trim() || cfg.promoCode?.trim()) && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-lg px-3 py-2.5 border border-white/8"
                                style={{ background: `${colors.hexAccent}08` }}
                              >
                                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-1.5">Caption Preview</p>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                  🔥 {selectedProduct.name.substring(0, 40)}…{' '}
                                  {cfg.promoCode?.trim() && (
                                    <span className="font-bold text-yellow-400">🏷️ Code: {cfg.promoCode} → </span>
                                  )}
                                  <span className="font-bold" style={{ color: colors.hexAccent }}>
                                    ${cfg.customPrice?.trim() || selectedProduct.price_display}
                                  </span>
                                  {' '}🛒 #TikTokShop #ad #{captionArtist}
                                </p>
                              </motion.div>
                            )}

                            {/* Clear config button */}
                            {isConfigured && (
                              <button
                                onClick={() => setProductConfigs(prev => {
                                  const next = { ...prev };
                                  delete next[selectedProduct.product_id];
                                  return next;
                                })}
                                className="text-[11px] text-gray-600 hover:text-red-400 transition-colors flex items-center gap-1"
                              >
                                <X className="h-3 w-3" /> Reset to defaults
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}

              {/* Step 1 */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black" style={{ background: colors.hexAccent }}>1</span>
                  <span className="text-xs font-semibold text-white">Generate Promo Image</span>
                </div>
                <Button
                  onClick={handleGenerateImage}
                  disabled={generatingImage || !artistImageUrl}
                  className="w-full h-9 text-sm font-bold"
                  style={{ background: `linear-gradient(135deg, ${colors.hexAccent}, ${colors.hexAccent}bb)`, color: '#fff' }}
                >
                  {generatingImage ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating Image...</>
                  ) : (
                    <><ImageIcon className="h-4 w-4 mr-2" /> Generate Promo Image</>
                  )}
                </Button>

                {promoImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: '#0a0a0f' }}>
                    {!imageLoaded && !imageLoadError && (
                      <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Loading image...</span>
                      </div>
                    )}
                    {imageLoadError && (
                      <div className="p-4 text-center">
                        <p className="text-sm text-gray-400 mb-2">Image failed to load.</p>
                        <a href={promoImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline break-all" style={{ color: colors.hexAccent }}>
                          {promoImageUrl}
                        </a>
                      </div>
                    )}
                    <img
                      src={promoImageUrl}
                      alt="Promo"
                      className="w-full object-contain"
                      style={{ maxHeight: '400px', display: imageLoaded ? 'block' : 'none' }}
                      onLoad={() => { setImageLoaded(true); setImageLoadError(false); }}
                      onError={() => { setImageLoadError(true); setImageLoaded(false); }}
                    />
                    {imageLoaded && (
                      <div className="px-3 py-2 flex items-center gap-2 border-t border-white/8">
                        <Tag className="h-3.5 w-3.5 flex-shrink-0" style={{ color: colors.hexAccent }} />
                        <span className="text-xs text-gray-300 truncate">{selectedProduct.name.substring(0, 60)}</span>
                        <span className="text-xs font-bold ml-auto flex-shrink-0" style={{ color: colors.hexAccent }}>${selectedProduct.price_display}</span>
                      </div>
                    )}
                    <div className="p-2.5 flex gap-2 border-t border-white/8">
                      <a href={promoImageUrl} download target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="outline" size="sm" className="w-full h-7 text-xs border-white/15 hover:border-white/30">
                          <Download className="h-3 w-3 mr-1" /> Download
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-3 border-white/15 hover:border-white/30"
                        onClick={() => handlePostToTikTok({
                          id: '', productId: selectedProduct.product_id,
                          productName: selectedProduct.name, productPrice: selectedProduct.price_display,
                          productUrl: selectedProduct.product_url, imageUrl: promoImageUrl || undefined,
                          createdAt: Date.now(),
                        })}
                      >
                        <Share2 className="h-3 w-3 mr-1" /> Post
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2 */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black" style={{
                    background: promoImageUrl ? colors.hexPrimary : 'rgba(255,255,255,0.1)',
                    color: promoImageUrl ? '#fff' : '#666',
                  }}>2</span>
                  <span className="text-xs font-semibold text-white">Generate TikTok Video</span>
                  {!promoImageUrl && <span className="text-[10px] text-gray-500">(generate image first)</span>}
                </div>
                <Button
                  onClick={handleGenerateVideo}
                  disabled={generatingVideo || !promoImageUrl}
                  className="w-full h-9 text-sm font-bold"
                  style={{
                    background: promoImageUrl
                      ? `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexPrimary}bb)`
                      : 'rgba(255,255,255,0.06)',
                    color: promoImageUrl ? '#fff' : '#666',
                  }}
                >
                  {generatingVideo ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating Video (~60s)...</>
                  ) : (
                    <><Film className="h-4 w-4 mr-2" /> Generate TikTok Video</>
                  )}
                </Button>

                {promoVideoUrl && (
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <video src={promoVideoUrl} controls className="w-full max-h-[400px]" style={{ background: '#000' }} />
                    <div className="px-3 py-2 flex items-center gap-2 border-t border-white/8">
                      <Tag className="h-3.5 w-3.5 flex-shrink-0" style={{ color: colors.hexAccent }} />
                      <span className="text-xs text-gray-300 truncate">{selectedProduct.name.substring(0, 60)}</span>
                      <span className="text-xs font-bold ml-auto flex-shrink-0" style={{ color: colors.hexAccent }}>${selectedProduct.price_display}</span>
                    </div>
                    <div className="p-2.5 flex gap-2 border-t border-white/8">
                      <a href={promoVideoUrl} download target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="outline" size="sm" className="w-full h-7 text-xs border-white/15">
                          <Download className="h-3 w-3 mr-1" /> Download
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-3 border-white/15"
                        onClick={() => handlePostToTikTok({
                          id: '', productId: selectedProduct.product_id,
                          productName: selectedProduct.name, productPrice: selectedProduct.price_display,
                          productUrl: selectedProduct.product_url, videoUrl: promoVideoUrl || undefined,
                          imageUrl: promoImageUrl || undefined, createdAt: Date.now(),
                        })}
                      >
                        <Share2 className="h-3 w-3 mr-1" /> Post
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {/* ═══ SESSION GALLERY ═══ */}
          {gallery.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${colors.hexAccent}25` }}>
                  <Film className="h-3 w-3" style={{ color: colors.hexAccent }} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: colors.hexAccent }}>
                  Generated Content
                </h3>
                <span className="text-[11px] text-gray-500">({gallery.length})</span>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {gallery.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-xl border p-3 flex gap-3 items-start"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                  >
                    {/* Thumbnail */}
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/8" style={{ background: `${colors.hexAccent}12` }}>
                        <ImageIcon className="h-5 w-5 opacity-40" style={{ color: colors.hexAccent }} />
                      </div>
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white line-clamp-1">
                        {item.productName.substring(0, 55)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-bold" style={{ color: colors.hexAccent }}>${item.productPrice}</span>
                        {item.videoUrl && <span className="text-[10px] text-blue-400 font-medium">🎬 Video</span>}
                        {item.imageUrl && <span className="text-[10px] text-purple-400 font-medium">🖼️ Image</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.videoUrl && (
                          <a href={item.videoUrl} download target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] border-white/15">
                              <Download className="h-2.5 w-2.5 mr-0.5" /> Video
                            </Button>
                          </a>
                        )}
                        {item.imageUrl && (
                          <a href={item.imageUrl} download target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] border-white/15">
                              <Download className="h-2.5 w-2.5 mr-0.5" /> Image
                            </Button>
                          </a>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] border-white/15"
                          onClick={() => handlePostToTikTok(item)}
                        >
                          <Share2 className="h-2.5 w-2.5 mr-0.5" /> Post
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10px] opacity-40 hover:opacity-80"
                          onClick={() => removeFromGallery(item.productId)}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {!artistImageUrl && isOwnProfile && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-yellow-500/20" style={{ background: 'rgba(234,179,8,0.06)' }}>
              <Zap className="h-4 w-4 flex-shrink-0 text-yellow-400" />
              <p className="text-xs text-gray-400">Upload a profile photo to generate product promo content</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
