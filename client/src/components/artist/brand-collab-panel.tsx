/**
 * Brand Collaborations Panel v2 — Artist × Brand Content Module
 * 
 * UPGRADED:
 * ✅ Package cards with Stripe "Buy Now" checkout
 * ✅ Messaging inbox (brand ↔ artist real-time chat)
 * ✅ PixVerse viral video generation
 * ✅ Image gallery batch generation
 * ✅ Promotional dialogue scripts
 * ✅ Brand song player (Lyria 3 generated jingles)
 * ✅ Campaign lifecycle progress tracker
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "../ui/button";
import {
  Handshake,
  ChevronDown,
  ChevronRight,
  Building2,
  Package,
  Loader2,
  Image as ImageIcon,
  Film,
  Plus,
  Search,
  DollarSign,
  Check,
  Clock,
  Sparkles,
  X,
  Star,
  Zap,
  Crown,
  Globe,
  Eye,
  ArrowRight,
  MessageCircle,
  Music,
  Send,
  Mic,
  Images,
  CreditCard,
  TrendingUp,
  Shield,
  Rocket,
  PlayCircle,
  ExternalLink,
} from "lucide-react";
import { useToast } from "../../hooks/use-toast";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface Brand {
  id: number;
  name: string;
  slug: string | null;
  logo: string | null;
  website: string | null;
  industry: string;
  description: string | null;
  contactEmail: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  followerCount: number;
  heroProductUrl: string | null;
  heroProductName: string | null;
}

interface BrandProduct {
  id: number;
  brandId: number;
  name: string;
  description: string | null;
  imageUrl: string;
  price: string | null;
  category: string | null;
  productUrl: string | null;
}

interface InfluencerPackage {
  id: number;
  name: string;
  slug: string;
  tier: string;
  price: string;
  description: string | null;
  features: string[];
  promoImages: number;
  promoVideos: number;
  socialPosts: number;
  storyMentions: number;
  songMention: boolean;
  dedicatedSong: boolean;
  exclusivityDays: number;
  revisionRounds: number;
}

interface Campaign {
  campaign: {
    id: number;
    brandId: number;
    artistId: number;
    packageId: number | null;
    title: string;
    brief: string | null;
    productIds: number[];
    totalAmount: string;
    platformFee: string;
    artistEarning: string;
    status: string;
    createdAt: string;
  };
  brand: {
    id: number;
    name: string;
    logo: string | null;
    industry: string;
  } | null;
}

interface CampaignContentPiece {
  id: number;
  campaignId: number;
  productId: number | null;
  type: string;
  imageUrl: string | null;
  videoUrl: string | null;
  caption: string | null;
  hashtags: string[] | null;
  status: string;
  createdAt: string;
}

interface InfluencerStats {
  campaigns: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalRevenue: string;
    pendingRevenue: string;
  };
  content: {
    totalImages: number;
    totalVideos: number;
    totalContent: number;
  };
  songs?: { totalSongs: number };
  messages?: { unreadMessages: number };
}

interface BrandMessage {
  id: number;
  campaignId: number;
  senderType: 'brand' | 'artist' | 'system';
  senderUserId: number | null;
  message: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  isRead: boolean;
  createdAt: string;
}

interface CampaignSong {
  id: number;
  campaignId: number;
  title: string;
  audioUrl: string | null;
  lyrics: string | null;
  genre: string;
  mood: string;
  duration: number | null;
  aiModel: string | null;
  status: string;
  createdAt: string;
}

interface BrandCollabPanelProps {
  artistId: string;
  isOwnProfile: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  colors: {
    hexPrimary: string;
    hexAccent: string;
    hexBg: string;
    hexText: string;
  };
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
  artistName: string;
  artistImageUrl?: string;
  artistGenre?: string;
}

// ═══════════════════════════════════════════════════════════════
// TIER STYLING
// ═══════════════════════════════════════════════════════════════

const TIER_CONFIG: Record<string, { icon: any; gradient: string; badge: string }> = {
  starter:    { icon: Zap,   gradient: 'from-blue-500 to-cyan-500',    badge: 'bg-blue-500/20 text-blue-300' },
  growth:     { icon: Star,  gradient: 'from-purple-500 to-pink-500',  badge: 'bg-purple-500/20 text-purple-300' },
  premium:    { icon: Crown, gradient: 'from-amber-500 to-orange-500', badge: 'bg-amber-500/20 text-amber-300' },
  enterprise: { icon: Globe, gradient: 'from-emerald-500 to-teal-500', badge: 'bg-emerald-500/20 text-emerald-300' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  proposal:          { label: 'Proposal',          color: 'bg-slate-500/20 text-slate-300' },
  negotiating:       { label: 'Negotiating',       color: 'bg-yellow-500/20 text-yellow-300' },
  accepted:          { label: 'Accepted',          color: 'bg-green-500/20 text-green-300' },
  content_creation:  { label: 'Creating Content',  color: 'bg-blue-500/20 text-blue-300' },
  review:            { label: 'In Review',         color: 'bg-purple-500/20 text-purple-300' },
  revision:          { label: 'Revision',          color: 'bg-orange-500/20 text-orange-300' },
  approved:          { label: 'Approved',          color: 'bg-green-500/20 text-green-300' },
  delivered:         { label: 'Delivered',         color: 'bg-teal-500/20 text-teal-300' },
  payment_pending:   { label: 'Payment Pending',   color: 'bg-amber-500/20 text-amber-300' },
  paid:              { label: 'Paid',              color: 'bg-emerald-500/20 text-emerald-300' },
  completed:         { label: 'Completed',         color: 'bg-emerald-500/20 text-emerald-300' },
  cancelled:         { label: 'Cancelled',         color: 'bg-red-500/20 text-red-300' },
};

const INDUSTRY_ICONS: Record<string, string> = {
  fashion: '👗', tech: '💻', food_beverage: '🍔', fitness: '💪', beauty: '💄',
  automotive: '🚗', entertainment: '🎬', travel: '✈️', finance: '💰', education: '📚', 
  health: '🏥', sports: '⚽', gaming: '🎮', luxury: '💎', sustainability: '🌱',
  crypto: '₿', music: '🎵', lifestyle: '🌟', other: '📦',
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function BrandCollabPanel({
  artistId,
  isOwnProfile,
  isExpanded,
  onToggleExpand,
  colors,
  cardStyles,
  cardStyleInline,
  artistName,
  artistImageUrl,
  artistGenre,
}: BrandCollabPanelProps) {
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<'packages' | 'brands' | 'campaigns' | 'content'>('packages');

  // Data state
  const [packages, setPackages] = useState<InfluencerPackage[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<InfluencerStats | null>(null);
  const [brandProducts, setBrandProducts] = useState<BrandProduct[]>([]);
  const [messages, setMessages] = useState<BrandMessage[]>([]);
  const [songs, setSongs] = useState<CampaignSong[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<InfluencerPackage | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignContent, setCampaignContent] = useState<CampaignContentPiece[]>([]);
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [newCampaignTitle, setNewCampaignTitle] = useState('');
  const [newCampaignBrief, setNewCampaignBrief] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [showMessages, setShowMessages] = useState(false);
  const [showDialogue, setShowDialogue] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newBrand, setNewBrand] = useState({ name: '', industry: 'fashion', website: '', contactEmail: '', description: '', logo: '', instagram: '', tiktok: '' });
  const [newProduct, setNewProduct] = useState({ name: '', imageUrl: '', description: '', price: '', category: '', productUrl: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ═══════════════════════════════════════════════════════════
  // Data fetching
  // ═══════════════════════════════════════════════════════════

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch('/api/influencer/packages');
      const data = await res.json();
      if (data.success) setPackages(data.packages);
    } catch (err) {
      console.error('Failed to fetch packages:', err);
    }
  }, []);

  const fetchBrands = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/influencer/brands?${params}`);
      const data = await res.json();
      if (data.success) setBrands(data.brands);
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/influencer/campaigns');
      const data = await res.json();
      if (data.success) setCampaigns(data.campaigns);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/influencer/stats');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchBrandProducts = useCallback(async (brandId: number) => {
    try {
      const res = await fetch(`/api/influencer/brands/${brandId}/products`);
      const data = await res.json();
      if (data.success) setBrandProducts(data.products);
    } catch (err) {
      console.error('Failed to fetch brand products:', err);
    }
  }, []);

  const fetchCampaignContent = useCallback(async (campaignId: number) => {
    try {
      const res = await fetch(`/api/influencer/campaigns/${campaignId}/content`);
      const data = await res.json();
      if (data.success) setCampaignContent(data.content);
    } catch (err) {
      console.error('Failed to fetch campaign content:', err);
    }
  }, []);

  const fetchMessages = useCallback(async (campaignId: number) => {
    try {
      const res = await fetch(`/api/influencer/campaigns/${campaignId}/messages`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, []);

  const fetchSongs = useCallback(async (campaignId: number) => {
    try {
      const res = await fetch(`/api/influencer/campaigns/${campaignId}/songs`);
      const data = await res.json();
      if (data.success) setSongs(data.songs);
    } catch (err) {
      console.error('Failed to fetch songs:', err);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    if (isExpanded && isOwnProfile) {
      fetchPackages();
      fetchStats();
    }
  }, [isExpanded, isOwnProfile, fetchPackages, fetchStats]);

  useEffect(() => {
    if (activeTab === 'brands' && isExpanded) fetchBrands(searchQuery);
    if (activeTab === 'campaigns' && isExpanded) fetchCampaigns();
  }, [activeTab, isExpanded, fetchBrands, fetchCampaigns, searchQuery]);

  // ═══════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════

  const handleCreateCampaign = async () => {
    if (!selectedBrand || !selectedPackage || !newCampaignTitle.trim()) {
      toast({ title: 'Missing fields', description: 'Select a brand, package, and enter a title', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/influencer/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrand.id,
          packageId: selectedPackage.id,
          title: newCampaignTitle.trim(),
          brief: newCampaignBrief.trim() || undefined,
          totalAmount: selectedPackage.price,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Campaign created!', description: `${newCampaignTitle} is ready` });
        setShowNewCampaignDialog(false);
        setNewCampaignTitle('');
        setNewCampaignBrief('');
        setSelectedBrand(null);
        setSelectedPackage(null);
        fetchCampaigns();
        setActiveTab('campaigns');
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create campaign', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async (campaignId: number, product: BrandProduct) => {
    if (!artistImageUrl) {
      toast({ title: 'No artist image', description: 'Set a profile image first', variant: 'destructive' });
      return;
    }

    try {
      setGenerating(true);
      const res = await fetch(`/api/influencer/campaigns/${campaignId}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          artistImageUrl,
          productImageUrl: product.imageUrl,
          productName: product.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Promo image generated!', description: `${product.name} content ready` });
        if (selectedCampaign) fetchCampaignContent(selectedCampaign.campaign.id);
      } else {
        toast({ title: 'Generation failed', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Image generation failed', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateVideo = async (campaignId: number, imageUrl: string, product: BrandProduct) => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/influencer/campaigns/${campaignId}/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          promoImageUrl: imageUrl,
          productName: product.name,
          artistName,
          artistGenre: artistGenre || 'pop',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Viral video generated!', description: 'Ready for TikTok/Reels' });
        if (selectedCampaign) fetchCampaignContent(selectedCampaign.campaign.id);
      } else {
        toast({ title: 'Video generation failed', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Video generation failed', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Stripe Checkout
  const handleCheckout = async (pkg: InfluencerPackage, brand: Brand) => {
    try {
      setCheckingOut(true);
      const res = await fetch('/api/influencer/packages/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          brandId: brand.id,
          campaignTitle: `${artistName} × ${brand.name}`,
        }),
      });
      const data = await res.json();
      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: 'Checkout error', description: data.error || 'Failed to create checkout', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Checkout failed', variant: 'destructive' });
    } finally {
      setCheckingOut(false);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!selectedCampaign || !messageInput.trim()) return;
    try {
      const res = await fetch(`/api/influencer/campaigns/${selectedCampaign.campaign.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageInput.trim(), senderType: 'artist' }),
      });
      const data = await res.json();
      if (data.success) {
        setMessageInput('');
        fetchMessages(selectedCampaign.campaign.id);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    }
  };

  // Generate gallery
  const handleGenerateGallery = async (campaignId: number, product: BrandProduct, count: number) => {
    if (!artistImageUrl) return;
    try {
      setGenerating(true);
      const res = await fetch(`/api/influencer/campaigns/${campaignId}/generate-gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          artistImageUrl,
          productImageUrl: product.imageUrl,
          productName: product.name,
          count,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Gallery generated!', description: `${data.generated} images created` });
        fetchCampaignContent(campaignId);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Gallery generation failed', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Generate dialogue
  const handleGenerateDialogue = async (campaignId: number, product: BrandProduct) => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/influencer/campaigns/${campaignId}/generate-dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          productDescription: product.description || '',
          brandName: selectedCampaign?.brand?.name || 'Brand',
          artistName,
          artistGenre: artistGenre || 'pop',
          durationSeconds: 30,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowDialogue(data.script);
        toast({ title: 'Dialogue ready!', description: 'Promotional script generated' });
        fetchCampaignContent(campaignId);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Dialogue generation failed', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Generate brand song
  const handleGenerateSong = async (campaignId: number, product: BrandProduct) => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/influencer/campaigns/${campaignId}/generate-song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          brandName: selectedCampaign?.brand?.name || 'Brand',
          artistName,
          artistGenre: artistGenre || 'pop',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: '🎵 Brand song generated!', description: data.song?.title || 'Song ready' });
        fetchSongs(campaignId);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Song generation failed', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Create brand
  const handleCreateBrand = async () => {
    if (!newBrand.name.trim()) {
      toast({ title: 'Brand name required', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/influencer/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBrand.name.trim(),
          industry: newBrand.industry,
          website: newBrand.website.trim() || undefined,
          contactEmail: newBrand.contactEmail.trim() || undefined,
          description: newBrand.description.trim() || undefined,
          logo: newBrand.logo.trim() || undefined,
          instagramHandle: newBrand.instagram.trim() || undefined,
          tiktokHandle: newBrand.tiktok.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Brand created!', description: `${newBrand.name} added successfully` });
        setShowAddBrand(false);
        setNewBrand({ name: '', industry: 'fashion', website: '', contactEmail: '', description: '', logo: '', instagram: '', tiktok: '' });
        fetchBrands(searchQuery);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create brand', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Add product to brand
  const handleAddProduct = async () => {
    if (!selectedBrand || !newProduct.name.trim() || !newProduct.imageUrl.trim()) {
      toast({ title: 'Name and image URL required', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/influencer/brands/${selectedBrand.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name.trim(),
          imageUrl: newProduct.imageUrl.trim(),
          description: newProduct.description.trim() || undefined,
          price: newProduct.price.trim() || undefined,
          category: newProduct.category.trim() || undefined,
          productUrl: newProduct.productUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Product added!', description: `${newProduct.name} uploaded` });
        setShowAddProduct(false);
        setNewProduct({ name: '', imageUrl: '', description: '', price: '', category: '', productUrl: '' });
        fetchBrandProducts(selectedBrand.id);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add product', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // PUBLIC VIEW — What brands/visitors see
  // ═══════════════════════════════════════════════════════════

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingBrand, setBookingBrand] = useState({ name: '', industry: 'fashion', website: '', contactEmail: '', description: '', logo: '', instagram: '', tiktok: '' });
  const [bookingProduct, setBookingProduct] = useState({ name: '', imageUrl: '', description: '', price: '' });
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);
  const [bookingPackage, setBookingPackage] = useState<InfluencerPackage | null>(null);

  const handleBookingSubmit = async () => {
    if (!bookingBrand.name.trim() || !bookingBrand.contactEmail.trim()) {
      toast({ title: 'Brand name and email required', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const brandRes = await fetch('/api/influencer/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bookingBrand.name.trim(),
          industry: bookingBrand.industry,
          website: bookingBrand.website.trim() || undefined,
          contactEmail: bookingBrand.contactEmail.trim(),
          description: bookingBrand.description.trim() || undefined,
          logo: bookingBrand.logo.trim() || undefined,
          instagramHandle: bookingBrand.instagram.trim() || undefined,
          tiktokHandle: bookingBrand.tiktok.trim() || undefined,
        }),
      });
      const brandData = await brandRes.json();
      if (!brandData.success) {
        toast({ title: 'Error', description: brandData.error, variant: 'destructive' });
        return;
      }
      const createdBrandId = brandData.brand?.id;

      if (bookingProduct.name.trim() && bookingProduct.imageUrl.trim() && createdBrandId) {
        await fetch(`/api/influencer/brands/${createdBrandId}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: bookingProduct.name.trim(),
            imageUrl: bookingProduct.imageUrl.trim(),
            description: bookingProduct.description.trim() || undefined,
            price: bookingProduct.price.trim() || undefined,
          }),
        });
      }

      if (bookingPackage && createdBrandId) {
        const checkoutRes = await fetch('/api/influencer/packages/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: bookingPackage.id,
            brandId: createdBrandId,
            campaignTitle: `${artistName} × ${bookingBrand.name.trim()}`,
            customerEmail: bookingBrand.contactEmail.trim(),
          }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutData.success && checkoutData.checkoutUrl) {
          window.location.href = checkoutData.checkoutUrl;
          return;
        }
      }

      toast({ title: 'Request sent!', description: `${artistName} will review your collaboration request.` });
      setShowBookingForm(false);
      setBookingStep(1);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to submit booking', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded && !isOwnProfile) {
      fetchPackages();
    }
  }, [isExpanded, isOwnProfile, fetchPackages]);

  if (!isOwnProfile) {
    // ═══ PUBLIC VISITOR VIEW ═══
    return (
      <div className={cardStyles} style={cardStyleInline}>
        <button
          onClick={onToggleExpand}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: `${colors.hexPrimary}20` }}>
              <Handshake className="w-5 h-5" style={{ color: colors.hexPrimary }} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Brand Collaborations</h3>
              <p className="text-xs text-white/50">Partner with {artistName} — AI-powered content</p>
            </div>
          </div>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-white/40" /> : <ChevronRight className="w-5 h-5 text-white/40" />}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4">
            {/* ═══ HERO BANNER ═══ */}
            <div className="relative overflow-hidden rounded-xl border border-white/10 p-5" style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}15, ${colors.hexAccent}10, transparent)` }}>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Rocket className="w-4 h-4" style={{ color: colors.hexPrimary }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: colors.hexPrimary }}>AI-Powered Influencer Marketing</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  Partner with <span style={{ color: colors.hexPrimary }}>{artistName}</span>
                </h2>
                <p className="text-sm text-white/60 mt-2 max-w-md">
                  Get AI-generated promo images, viral TikTok/Reels videos, brand jingles, and social content — all featuring {artistName} showcasing your products.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {[
                    { icon: ImageIcon, label: 'AI Fusion Images' },
                    { icon: Film, label: 'PixVerse Videos' },
                    { icon: Music, label: 'Brand Jingles' },
                    { icon: Mic, label: 'Promo Scripts' },
                  ].map(({ icon: Icon, label }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[10px] text-white/70 font-medium">
                      <Icon className="w-3 h-3" style={{ color: colors.hexPrimary }} />
                      {label}
                    </span>
                  ))}
                </div>
                <Button
                  onClick={() => setShowBookingForm(true)}
                  className="mt-5 h-10 px-6 text-sm font-bold rounded-full shadow-lg transition-transform hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Book {artistName} Now
                </Button>
              </div>
              {artistImageUrl && (
                <div className="absolute right-3 top-3 w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 opacity-30 sm:opacity-50" style={{ borderColor: colors.hexPrimary }}>
                  <img src={artistImageUrl} alt={artistName} className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* ═══ HOW IT WORKS — STEPPER ═══ */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">How It Works</h4>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { step: 1, icon: Building2, label: 'Register Brand', desc: 'Tell us about your brand' },
                  { step: 2, icon: Package, label: 'Upload Product', desc: 'Add product images' },
                  { step: 3, icon: CreditCard, label: 'Choose Package', desc: '$300 – $3,000' },
                  { step: 4, icon: Sparkles, label: 'Get Content', desc: 'AI generates everything' },
                ].map(({ step, icon: Icon, label, desc }) => (
                  <div key={step} className="relative text-center p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="w-7 h-7 mx-auto rounded-full flex items-center justify-center mb-1.5" style={{ background: `${colors.hexPrimary}20` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: colors.hexPrimary }} />
                    </div>
                    <div className="text-[10px] font-bold text-white">{label}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">{desc}</div>
                    {step < 4 && <ArrowRight className="absolute right-[-10px] top-1/2 -translate-y-1/2 w-3 h-3 text-white/15 hidden sm:block" />}
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ PACKAGES — PUBLIC VIEW ═══ */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Collaboration Packages</h4>
              {packages.length === 0 ? (
                <div className="text-center py-6"><Loader2 className="w-5 h-5 mx-auto animate-spin text-white/20" /></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {packages.map((pkg) => {
                    const tier = TIER_CONFIG[pkg.tier] || TIER_CONFIG.starter;
                    const TierIcon = tier.icon;
                    const isPopular = pkg.tier === 'growth';
                    const isSelected = bookingPackage?.id === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setBookingPackage(isSelected ? null : pkg)}
                        className={`relative text-left p-4 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-white/30 bg-white/10 ring-1 ring-white/20'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                        }`}
                      >
                        {isPopular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
                              <TrendingUp className="w-2.5 h-2.5" /> Most Popular
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${tier.badge}`}>
                            <TierIcon className="w-3 h-3" /> {pkg.tier}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-green-400" />}
                        </div>
                        <h4 className="font-bold text-white text-sm">{pkg.name}</h4>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={`text-2xl font-black bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`}>
                            ${parseInt(pkg.price)}
                          </span>
                          <span className="text-[10px] text-white/40">USD</span>
                        </div>
                        <p className="text-[11px] text-white/50 mt-2 line-clamp-2">{pkg.description}</p>
                        <div className="mt-3 space-y-1">
                          {pkg.features.slice(0, 4).map((f, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[10px] text-white/60">
                              <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                              <span>{f}</span>
                            </div>
                          ))}
                          {pkg.features.length > 4 && <div className="text-[10px] text-white/40">+{pkg.features.length - 4} more...</div>}
                        </div>
                        <div className="flex gap-3 mt-3 pt-2 border-t border-white/5">
                          <span className="text-[10px] text-white/40">📸 {pkg.promoImages} images</span>
                          <span className="text-[10px] text-white/40">🎬 {pkg.promoVideos} videos</span>
                          {pkg.dedicatedSong && <span className="text-[10px] text-white/40">🎵 Song</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {bookingPackage && !showBookingForm && (
                <Button
                  onClick={() => setShowBookingForm(true)}
                  className="w-full h-10 text-sm font-bold rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Continue with {bookingPackage.name} — ${parseInt(bookingPackage.price)}
                </Button>
              )}
            </div>

            {/* ═══ DEMO SHOWCASE — AI Content Examples ═══ */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">What You'll Get</h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: '📸 AI Fusion Image', desc: 'Artist wearing/using your product', gradient: 'from-blue-500/20 to-cyan-500/10' },
                  { type: '🎬 PixVerse Video', desc: '15s viral clip for TikTok & Reels', gradient: 'from-purple-500/20 to-pink-500/10' },
                  { type: '🎵 Brand Jingle', desc: 'AI song mentioning your product', gradient: 'from-amber-500/20 to-orange-500/10' },
                ].map(({ type, desc, gradient }) => (
                  <div key={type} className={`relative rounded-xl border border-white/5 p-3 bg-gradient-to-br ${gradient} overflow-hidden`}>
                    <div className="relative z-10 text-center">
                      <div className="text-2xl mb-2">{type.split(' ')[0]}</div>
                      <div className="text-[10px] font-bold text-white">{type.slice(type.indexOf(' ') + 1)}</div>
                      <div className="text-[9px] text-white/50 mt-1">{desc}</div>
                    </div>
                    <PlayCircle className="absolute bottom-1 right-1 w-6 h-6 text-white/10" />
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ TRUST SIGNALS ═══ */}
            <div className="flex items-center justify-center gap-4 py-2">
              {[
                { icon: Shield, label: 'Secure Stripe Payments' },
                { icon: Clock, label: '48h–72h Delivery' },
                { icon: Star, label: '100% AI-Generated' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[10px] text-white/40">
                  <Icon className="w-3 h-3" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* ═══ BOOKING FORM (multi-step) ═══ */}
            {showBookingForm && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: colors.hexPrimary }} />
                    Book {artistName}
                  </h4>
                  <button onClick={() => { setShowBookingForm(false); setBookingStep(1); }} className="text-white/40 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex-1 flex items-center gap-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        bookingStep >= s ? 'text-white' : 'bg-white/10 text-white/30'
                      }`} style={bookingStep >= s ? { background: colors.hexPrimary } : {}}>
                        {bookingStep > s ? <Check className="w-3 h-3" /> : s}
                      </div>
                      <span className={`text-[10px] ${bookingStep >= s ? 'text-white/70' : 'text-white/30'}`}>
                        {s === 1 ? 'Your Brand' : s === 2 ? 'Product' : 'Confirm'}
                      </span>
                      {s < 3 && <div className={`flex-1 h-px ${bookingStep > s ? 'bg-white/30' : 'bg-white/10'}`} />}
                    </div>
                  ))}
                </div>

                {/* Step 1: Brand info */}
                {bookingStep === 1 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider">Brand Name *</label>
                        <input type="text" value={bookingBrand.name} onChange={(e) => setBookingBrand({ ...bookingBrand, name: e.target.value })}
                          placeholder="Your brand name" className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20" />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider">Contact Email *</label>
                        <input type="email" value={bookingBrand.contactEmail} onChange={(e) => setBookingBrand({ ...bookingBrand, contactEmail: e.target.value })}
                          placeholder="you@brand.com" className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20" />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider">Industry</label>
                        <select value={bookingBrand.industry} onChange={(e) => setBookingBrand({ ...bookingBrand, industry: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20 [&>option]:bg-zinc-900">
                          {Object.entries(INDUSTRY_ICONS).map(([key, icon]) => (
                            <option key={key} value={key}>{icon} {key.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider">Website</label>
                        <input type="url" value={bookingBrand.website} onChange={(e) => setBookingBrand({ ...bookingBrand, website: e.target.value })}
                          placeholder="https://yourbrand.com" className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20" />
                      </div>
                    </div>
                    <Button onClick={() => {
                        if (!bookingBrand.name.trim() || !bookingBrand.contactEmail.trim()) {
                          toast({ title: 'Brand name and email required', variant: 'destructive' }); return;
                        }
                        setBookingStep(2);
                      }} className="w-full" style={{ background: colors.hexPrimary }}>
                      Next: Upload Product <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}

                {/* Step 2: Product */}
                {bookingStep === 2 && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-white/50">Upload the product you want {artistName} to promote. You can add more later.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider">Product Name</label>
                        <input type="text" value={bookingProduct.name} onChange={(e) => setBookingProduct({ ...bookingProduct, name: e.target.value })}
                          placeholder="Air Max 90, iPhone Case..." className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20" />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider">Product Image URL</label>
                        <input type="url" value={bookingProduct.imageUrl} onChange={(e) => setBookingProduct({ ...bookingProduct, imageUrl: e.target.value })}
                          placeholder="https://cdn.brand.com/product.jpg" className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20" />
                      </div>
                    </div>
                    {bookingProduct.imageUrl && (
                      <div className="flex items-center gap-3">
                        <img src={bookingProduct.imageUrl} alt="Preview" className="w-14 h-14 rounded-lg object-cover border border-white/10"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-[10px] text-white/40">Preview</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setBookingStep(1)} className="flex-1 border-white/20 text-white/60">Back</Button>
                      <Button onClick={() => setBookingStep(3)} className="flex-1" style={{ background: colors.hexPrimary }}>
                        Next: Confirm <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Confirm + Pay */}
                {bookingStep === 3 && (
                  <div className="space-y-3">
                    <div className="bg-white/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Brand</span>
                        <span className="text-white font-medium">{bookingBrand.name} ({bookingBrand.industry})</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Contact</span>
                        <span className="text-white font-medium">{bookingBrand.contactEmail}</span>
                      </div>
                      {bookingProduct.name && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/50">Product</span>
                          <span className="text-white font-medium">{bookingProduct.name}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                        <span className="text-white/50">Package</span>
                        <span className="text-white font-bold">{bookingPackage?.name || 'No package selected'} {bookingPackage ? `— $${parseInt(bookingPackage.price)}` : ''}</span>
                      </div>
                    </div>
                    {!bookingPackage && (
                      <p className="text-[11px] text-amber-400/80 text-center">Select a package above to proceed to payment, or submit to send a collaboration request.</p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setBookingStep(2)} className="flex-1 border-white/20 text-white/60">Back</Button>
                      <Button onClick={handleBookingSubmit} disabled={loading} className="flex-1 font-bold"
                        style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}>
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : bookingPackage ? <CreditCard className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        {bookingPackage ? `Pay $${parseInt(bookingPackage.price)} with Stripe` : 'Submit Request'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // OWNER VIEW (artist's dashboard) — below
  // ═══════════════════════════════════════════════════════════

  return (
    <div className={cardStyles} style={cardStyleInline}>
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: `${colors.hexPrimary}20` }}>
            <Handshake className="w-5 h-5" style={{ color: colors.hexPrimary }} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-white">Brand Collaborations</h3>
            <p className="text-xs text-white/50">
              {stats ? `${stats.campaigns.totalCampaigns} campaigns · $${parseFloat(stats.campaigns.totalRevenue).toFixed(0)} earned` : 'Artist × Brand content partnerships'}
            </p>
          </div>
        </div>
        {isExpanded ? <ChevronDown className="w-5 h-5 text-white/40" /> : <ChevronRight className="w-5 h-5 text-white/40" />}
      </button>

      {!isExpanded ? null : (
        <div className="px-4 pb-4 space-y-4">
          {/* Stats bar — only show when there's real data */}
          {stats && stats.campaigns.totalCampaigns > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { label: 'Campaigns', value: stats.campaigns.totalCampaigns, icon: Building2 },
                { label: 'Active', value: stats.campaigns.activeCampaigns, icon: Clock },
                { label: 'Revenue', value: `$${parseFloat(stats.campaigns.totalRevenue).toFixed(0)}`, icon: DollarSign },
                { label: 'Content', value: stats.content.totalContent, icon: ImageIcon },
                { label: 'Messages', value: stats.messages?.unreadMessages || 0, icon: MessageCircle },
              ].map((s) => (
                <div key={s.label} className="bg-white/5 rounded-lg p-3 text-center">
                  <s.icon className="w-4 h-4 mx-auto mb-1 text-white/40" />
                  <div className="text-lg font-bold text-white">{s.value}</div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 p-4 text-center" style={{ background: `${colors.hexPrimary}08` }}>
              <Rocket className="w-6 h-6 mx-auto mb-2" style={{ color: colors.hexPrimary }} />
              <p className="text-xs text-white/60">Your Brand Collaborations module is live! Brands visiting your profile can now book you directly.</p>
              <p className="text-[10px] text-white/40 mt-1">Register brands, upload products, and launch your first campaign below.</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {(['packages', 'brands', 'campaigns', 'content'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/70'
                }`}
              >
                {tab === 'packages' ? '💎 Packages' : tab === 'brands' ? '🏢 Brands' : tab === 'campaigns' ? '📋 Campaigns' : '🎨 Content'}
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════
              TAB: PACKAGES ($300-$3000)
              ═══════════════════════════════════════════════ */}
          {activeTab === 'packages' && (
            <div className="space-y-3">
              <p className="text-xs text-white/50">Select a package for your brand collaboration. Prices range from $300 to $3,000 depending on deliverables.</p>
              {packages.length === 0 ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-white/30" />
                  <p className="text-xs text-white/40 mt-2">Loading packages...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {packages.map((pkg) => {
                    const tier = TIER_CONFIG[pkg.tier] || TIER_CONFIG.starter;
                    const TierIcon = tier.icon;
                    const isSelected = selectedPackage?.id === pkg.id;
                    const isPopular = pkg.tier === 'growth';
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPackage(isSelected ? null : pkg)}
                        className={`relative text-left p-4 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-white/30 bg-white/10 ring-1 ring-white/20'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                        }`}
                      >
                        {/* Most Popular badge */}
                        {isPopular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
                              <TrendingUp className="w-2.5 h-2.5" /> Most Popular
                            </span>
                          </div>
                        )}
                        {/* Tier badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${tier.badge}`}>
                            <TierIcon className="w-3 h-3" /> {pkg.tier}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-green-400" />}
                        </div>

                        {/* Name & Price */}
                        <h4 className="font-bold text-white text-sm">{pkg.name}</h4>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={`text-2xl font-black bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`}>
                            ${parseInt(pkg.price)}
                          </span>
                          <span className="text-[10px] text-white/40">USD</span>
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-white/50 mt-2 line-clamp-2">{pkg.description}</p>

                        {/* Deliverables */}
                        <div className="mt-3 space-y-1">
                          {pkg.features.slice(0, 4).map((f, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[10px] text-white/60">
                              <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                              <span>{f}</span>
                            </div>
                          ))}
                          {pkg.features.length > 4 && (
                            <div className="text-[10px] text-white/40">+{pkg.features.length - 4} more...</div>
                          )}
                        </div>

                        {/* Quick stats */}
                        <div className="flex gap-3 mt-3 pt-2 border-t border-white/5">
                          <span className="text-[10px] text-white/40">📸 {pkg.promoImages} images</span>
                          <span className="text-[10px] text-white/40">🎬 {pkg.promoVideos} videos</span>
                          {pkg.dedicatedSong && <span className="text-[10px] text-white/40">🎵 Song</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedPackage && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setActiveTab('brands');
                      fetchBrands();
                    }}
                    className="flex-1"
                    variant="outline"
                    style={{ borderColor: colors.hexPrimary, color: colors.hexPrimary }}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Select Brand
                  </Button>
                  {selectedBrand && (
                    <Button
                      onClick={() => handleCheckout(selectedPackage, selectedBrand)}
                      disabled={checkingOut}
                      className="flex-1"
                      style={{ background: colors.hexPrimary }}
                    >
                      {checkingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                      Pay ${parseInt(selectedPackage.price)} with Stripe
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              TAB: BRANDS DATABASE
              ═══════════════════════════════════════════════ */}
          {activeTab === 'brands' && (
            <div className="space-y-3">
              {/* Search + Add button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      fetchBrands(e.target.value);
                    }}
                    placeholder="Search brands by name..."
                    className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                  />
                </div>
                <Button
                  onClick={() => setShowAddBrand(!showAddBrand)}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  style={{ borderColor: colors.hexPrimary, color: colors.hexPrimary }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Brand
                </Button>
              </div>

              {/* ══ Add Brand Form ══ */}
              {showAddBrand && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Register New Brand
                    </h4>
                    <button onClick={() => setShowAddBrand(false)} className="text-white/40 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider">Brand Name *</label>
                      <input
                        type="text"
                        value={newBrand.name}
                        onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
                        placeholder="Nike, Adidas, Coca-Cola..."
                        className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider">Industry *</label>
                      <select
                        value={newBrand.industry}
                        onChange={(e) => setNewBrand({ ...newBrand, industry: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20 [&>option]:bg-zinc-900"
                      >
                        {Object.entries(INDUSTRY_ICONS).map(([key, icon]) => (
                          <option key={key} value={key}>{icon} {key.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider">Logo URL</label>
                      <input
                        type="url"
                        value={newBrand.logo}
                        onChange={(e) => setNewBrand({ ...newBrand, logo: e.target.value })}
                        placeholder="https://brand.com/logo.png"
                        className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider">Website</label>
                      <input
                        type="url"
                        value={newBrand.website}
                        onChange={(e) => setNewBrand({ ...newBrand, website: e.target.value })}
                        placeholder="https://brand.com"
                        className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider">Contact Email</label>
                      <input
                        type="email"
                        value={newBrand.contactEmail}
                        onChange={(e) => setNewBrand({ ...newBrand, contactEmail: e.target.value })}
                        placeholder="partnerships@brand.com"
                        className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider">Instagram</label>
                      <input
                        type="text"
                        value={newBrand.instagram}
                        onChange={(e) => setNewBrand({ ...newBrand, instagram: e.target.value })}
                        placeholder="@brand"
                        className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider">TikTok</label>
                      <input
                        type="text"
                        value={newBrand.tiktok}
                        onChange={(e) => setNewBrand({ ...newBrand, tiktok: e.target.value })}
                        placeholder="@brand"
                        className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider">Description</label>
                    <textarea
                      value={newBrand.description}
                      onChange={(e) => setNewBrand({ ...newBrand, description: e.target.value })}
                      placeholder="Brief description of the brand and what they're looking for..."
                      className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 h-16 resize-none"
                    />
                  </div>

                  <Button
                    onClick={handleCreateBrand}
                    disabled={loading || !newBrand.name.trim()}
                    className="w-full"
                    style={{ background: colors.hexPrimary }}
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Register Brand
                  </Button>
                </div>
              )}

              {/* Brand list */}
              {loading && !showAddBrand ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-white/30" />
                </div>
              ) : brands.length === 0 && !showAddBrand ? (
                <div className="text-center py-8">
                  <Building2 className="w-8 h-8 mx-auto text-white/20 mb-2" />
                  <p className="text-xs text-white/40">No brands found. Click "Add Brand" to register one.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {brands.map((brand) => {
                    const isSelected = selectedBrand?.id === brand.id;
                    return (
                      <button
                        key={brand.id}
                        onClick={() => {
                          setSelectedBrand(isSelected ? null : brand);
                          if (!isSelected) fetchBrandProducts(brand.id);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-white/30 bg-white/10'
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                        }`}
                      >
                        {/* Logo */}
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                          {brand.logo ? (
                            <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            INDUSTRY_ICONS[brand.industry] || '📦'
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white text-sm truncate">{brand.name}</h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{brand.industry.replace('_', ' ')}</span>
                          </div>
                          {brand.description && (
                            <p className="text-[11px] text-white/40 truncate">{brand.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {brand.instagramHandle && <span className="text-[9px] text-white/30">📷 {brand.instagramHandle}</span>}
                            {brand.tiktokHandle && <span className="text-[9px] text-white/30">🎵 {brand.tiktokHandle}</span>}
                            {brand.website && <span className="text-[9px] text-white/30">🌐 {new URL(brand.website).hostname}</span>}
                          </div>
                        </div>

                        {isSelected && <Check className="w-4 h-4 text-green-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected brand's products + Add Product */}
              {selectedBrand && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                      {selectedBrand.name}'s Products ({brandProducts.length})
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] border-white/20 text-white/60 hover:bg-white/10"
                      onClick={() => setShowAddProduct(!showAddProduct)}
                      style={{ borderColor: colors.hexPrimary, color: colors.hexPrimary }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Product
                    </Button>
                  </div>

                  {/* ══ Add Product Form ══ */}
                  {showAddProduct && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                          <Package className="w-4 h-4" /> Upload Product
                        </h4>
                        <button onClick={() => setShowAddProduct(false)} className="text-white/40 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-white/50 uppercase tracking-wider">Product Name *</label>
                          <input
                            type="text"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                            placeholder="Air Max 90, iPhone Case..."
                            className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/50 uppercase tracking-wider">Image URL *</label>
                          <input
                            type="url"
                            value={newProduct.imageUrl}
                            onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                            placeholder="https://cdn.brand.com/product.jpg"
                            className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/50 uppercase tracking-wider">Price (USD)</label>
                          <input
                            type="text"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                            placeholder="99.99"
                            className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/50 uppercase tracking-wider">Category</label>
                          <input
                            type="text"
                            value={newProduct.category}
                            onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                            placeholder="Shoes, Electronics, Drinks..."
                            className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-white/50 uppercase tracking-wider">Product URL</label>
                          <input
                            type="url"
                            value={newProduct.productUrl}
                            onChange={(e) => setNewProduct({ ...newProduct, productUrl: e.target.value })}
                            placeholder="https://brand.com/product/air-max-90"
                            className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-white/50 uppercase tracking-wider">Description</label>
                          <textarea
                            value={newProduct.description}
                            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                            placeholder="Product description, features, what to highlight in promo..."
                            className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 h-16 resize-none"
                          />
                        </div>
                      </div>

                      {/* Image preview */}
                      {newProduct.imageUrl && (
                        <div className="flex items-center gap-3">
                          <img
                            src={newProduct.imageUrl}
                            alt="Preview"
                            className="w-16 h-16 rounded-lg object-cover border border-white/10"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <span className="text-[10px] text-white/40">Image preview</span>
                        </div>
                      )}

                      <Button
                        onClick={handleAddProduct}
                        disabled={loading || !newProduct.name.trim() || !newProduct.imageUrl.trim()}
                        className="w-full"
                        style={{ background: colors.hexPrimary }}
                      >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Upload Product to {selectedBrand.name}
                      </Button>
                    </div>
                  )}

                  {brandProducts.length === 0 && !showAddProduct ? (
                    <p className="text-xs text-white/40">No products yet. Click "Add Product" to upload the brand's products.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {brandProducts.map((p) => (
                        <div key={p.id} className="bg-white/5 rounded-lg overflow-hidden border border-white/5">
                          <img src={p.imageUrl} alt={p.name} className="w-full h-24 object-cover" />
                          <div className="p-2">
                            <p className="text-[11px] font-medium text-white truncate">{p.name}</p>
                            {p.price && <p className="text-[10px] text-white/40">${p.price}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Create campaign button */}
              {selectedBrand && selectedPackage && (
                <Button
                  onClick={() => {
                    setNewCampaignTitle(`${artistName} × ${selectedBrand.name}`);
                    setShowNewCampaignDialog(true);
                  }}
                  className="w-full"
                  style={{ background: colors.hexPrimary }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign: {artistName} × {selectedBrand.name}
                </Button>
              )}

              {/* New campaign dialog */}
              {showNewCampaignDialog && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-white text-sm">New Campaign</h4>
                    <button onClick={() => setShowNewCampaignDialog(false)} className="text-white/40 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider">Campaign Title</label>
                    <input
                      type="text"
                      value={newCampaignTitle}
                      onChange={(e) => setNewCampaignTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider">Creative Brief (optional)</label>
                    <textarea
                      value={newCampaignBrief}
                      onChange={(e) => setNewCampaignBrief(e.target.value)}
                      placeholder="Describe the content direction, mood, specific product features to highlight..."
                      className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 h-20 resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>Package: <strong className="text-white">{selectedPackage?.name}</strong></span>
                    <span>Total: <strong className="text-white">${selectedPackage?.price}</strong></span>
                  </div>
                  <Button
                    onClick={handleCreateCampaign}
                    disabled={loading || !newCampaignTitle.trim()}
                    className="w-full"
                    style={{ background: colors.hexPrimary }}
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Launch Campaign — ${selectedPackage?.price}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              TAB: CAMPAIGNS
              ═══════════════════════════════════════════════ */}
          {activeTab === 'campaigns' && (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-white/30" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-8 h-8 mx-auto text-white/20 mb-2" />
                  <p className="text-xs text-white/40">No campaigns yet. Select a package and brand to create one.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 border-white/20 text-white/60 hover:bg-white/5"
                    onClick={() => setActiveTab('packages')}
                  >
                    Browse Packages
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((c) => {
                    const statusInfo = STATUS_LABELS[c.campaign.status] || STATUS_LABELS.proposal;
                    const isSelected = selectedCampaign?.campaign.id === c.campaign.id;
                    return (
                      <button
                        key={c.campaign.id}
                        onClick={() => {
                          setSelectedCampaign(isSelected ? null : c);
                          if (!isSelected) {
                            fetchCampaignContent(c.campaign.id);
                            fetchMessages(c.campaign.id);
                            fetchSongs(c.campaign.id);
                            if (c.brand) fetchBrandProducts(c.brand.id);
                            setActiveTab('content');
                          }
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected ? 'border-white/30 bg-white/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-white text-sm truncate">{c.campaign.title}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-white/40">
                            {INDUSTRY_ICONS[c.brand?.industry || 'other']} {c.brand?.name || 'Unknown'}
                          </span>
                          <span className="text-[11px] text-white/40">
                            💰 ${parseFloat(c.campaign.artistEarning).toFixed(0)} earning
                          </span>
                          <span className="text-[11px] text-white/40">
                            {new Date(c.campaign.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              TAB: CONTENT (campaign-specific)
              ═══════════════════════════════════════════════ */}
          {activeTab === 'content' && (
            <div className="space-y-3">
              {!selectedCampaign ? (
                <div className="text-center py-8">
                  <Eye className="w-8 h-8 mx-auto text-white/20 mb-2" />
                  <p className="text-xs text-white/40">Select a campaign from the Campaigns tab to view and generate content.</p>
                </div>
              ) : (
                <>
                  {/* Campaign header */}
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white text-sm">{selectedCampaign.campaign.title}</h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowMessages(!showMessages);
                            if (!showMessages) fetchMessages(selectedCampaign.campaign.id);
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                          title="Messages"
                        >
                          <MessageCircle className="w-4 h-4 text-white/60" />
                        </button>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(STATUS_LABELS[selectedCampaign.campaign.status] || STATUS_LABELS.proposal).color}`}>
                          {(STATUS_LABELS[selectedCampaign.campaign.status] || STATUS_LABELS.proposal).label}
                        </span>
                      </div>
                    </div>
                    {selectedCampaign.campaign.brief && (
                      <p className="text-[11px] text-white/50 mt-1">{selectedCampaign.campaign.brief}</p>
                    )}
                  </div>

                  {/* Messaging panel */}
                  {showMessages && (
                    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                      <div className="p-2 border-b border-white/5 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-white/50" />
                        <span className="text-xs font-medium text-white/70">Campaign Chat</span>
                      </div>
                      <div className="h-48 overflow-y-auto p-3 space-y-2">
                        {messages.length === 0 ? (
                          <p className="text-center text-[11px] text-white/30 py-8">No messages yet. Start the conversation!</p>
                        ) : messages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.senderType === 'artist' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                              msg.senderType === 'artist' ? 'bg-blue-500/20 text-blue-100' :
                              msg.senderType === 'system' ? 'bg-white/5 text-white/50 text-center w-full' :
                              'bg-white/10 text-white/80'
                            }`}>
                              {msg.senderType !== 'system' && (
                                <span className="text-[9px] text-white/40 uppercase">{msg.senderType}</span>
                              )}
                              <p className="text-[11px]">{msg.message}</p>
                              {msg.attachmentUrl && (
                                msg.attachmentType === 'image' ? (
                                  <img src={msg.attachmentUrl} alt="" className="mt-1 rounded max-h-24 object-cover" />
                                ) : msg.attachmentType === 'audio' ? (
                                  <audio src={msg.attachmentUrl} controls className="mt-1 w-full h-8" />
                                ) : null
                              )}
                              <span className="text-[9px] text-white/30 block mt-0.5">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                      <div className="p-2 border-t border-white/5 flex gap-2">
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Type a message..."
                          className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/25 focus:outline-none"
                        />
                        <Button
                          size="sm"
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim()}
                          className="h-8 px-3"
                          style={{ background: colors.hexPrimary }}
                        >
                          <Send className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Generate buttons */}
                  {brandProducts.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Generate Content</h5>
                      <div className="grid grid-cols-1 gap-2">
                        {brandProducts.slice(0, 4).map((product) => (
                          <div key={product.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                              <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded object-cover" />
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-medium text-white truncate block">{product.name}</span>
                                {product.price && <span className="text-[10px] text-white/40">${product.price}</span>}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] border-white/10 text-white/60 hover:bg-white/10"
                                disabled={generating}
                                onClick={() => handleGenerateImage(selectedCampaign.campaign.id, product)}
                              >
                                <ImageIcon className="w-3 h-3 mr-1" />
                                Image
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] border-white/10 text-white/60 hover:bg-white/10"
                                disabled={generating}
                                onClick={() => {
                                  const readyImage = campaignContent.find(c => c.productId === product.id && c.type === 'promo_image' && c.imageUrl);
                                  if (readyImage?.imageUrl) {
                                    handleGenerateVideo(selectedCampaign.campaign.id, readyImage.imageUrl, product);
                                  } else {
                                    toast({ title: 'Generate image first', description: 'A promo image is needed before generating video', variant: 'destructive' });
                                  }
                                }}
                              >
                                <Film className="w-3 h-3 mr-1" />
                                Video
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] border-white/10 text-white/60 hover:bg-white/10"
                                disabled={generating}
                                onClick={() => handleGenerateGallery(selectedCampaign.campaign.id, product, 3)}
                              >
                                <Images className="w-3 h-3 mr-1" />
                                Gallery
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] border-white/10 text-white/60 hover:bg-white/10"
                                disabled={generating}
                                onClick={() => handleGenerateDialogue(selectedCampaign.campaign.id, product)}
                              >
                                <Mic className="w-3 h-3 mr-1" />
                                Script
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] border-white/10 text-white/60 hover:bg-white/10"
                                disabled={generating}
                                onClick={() => handleGenerateSong(selectedCampaign.campaign.id, product)}
                              >
                                <Music className="w-3 h-3 mr-1" />
                                Song
                              </Button>
                            </div>
                            {generating && <div className="flex items-center gap-2 mt-2 text-[10px] text-white/40"><Loader2 className="w-3 h-3 animate-spin" /> Generating content...</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Promotional dialogue display */}
                  {showDialogue && (
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-semibold text-white/70 flex items-center gap-1.5"><Mic className="w-3.5 h-3.5" /> Promotional Script</h5>
                        <button onClick={() => setShowDialogue(null)} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <pre className="text-[11px] text-white/70 whitespace-pre-wrap font-sans leading-relaxed bg-white/5 rounded p-3">{showDialogue}</pre>
                    </div>
                  )}

                  {/* Campaign songs */}
                  {songs.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5"><Music className="w-3.5 h-3.5" /> Brand Songs ({songs.length})</h5>
                      {songs.map((song) => (
                        <div key={song.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <h6 className="text-[11px] font-semibold text-white">{song.title}</h6>
                              <span className="text-[9px] text-white/40">{song.genre} · {song.mood} · {song.aiModel}</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                              song.status === 'ready' ? 'bg-green-500/20 text-green-300' :
                              song.status === 'generating' ? 'bg-blue-500/20 text-blue-300' :
                              'bg-white/10 text-white/40'
                            }`}>{song.status}</span>
                          </div>
                          {song.audioUrl && (
                            <audio src={song.audioUrl} controls className="w-full mt-2 h-8" />
                          )}
                          {song.lyrics && (
                            <details className="mt-2">
                              <summary className="text-[10px] text-white/40 cursor-pointer hover:text-white/60">View lyrics</summary>
                              <pre className="text-[10px] text-white/50 whitespace-pre-wrap font-sans mt-1 bg-white/5 rounded p-2">{song.lyrics}</pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Content gallery */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                      Generated Content ({campaignContent.length})
                    </h5>
                    {campaignContent.length === 0 ? (
                      <p className="text-xs text-white/40 text-center py-4">No content generated yet. Use the buttons above to create promo images and videos.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {campaignContent.map((piece) => (
                          <div key={piece.id} className="bg-white/5 rounded-lg overflow-hidden border border-white/5">
                            {piece.type === 'promo_image' && piece.imageUrl ? (
                              <img src={piece.imageUrl} alt="Promo" className="w-full h-32 object-cover" />
                            ) : piece.type === 'promo_video' && piece.videoUrl ? (
                              <video src={piece.videoUrl} className="w-full h-32 object-cover" controls muted />
                            ) : (
                              <div className="w-full h-32 bg-white/5 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-white/20" />
                              </div>
                            )}
                            <div className="p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-white/50">
                                  {piece.type === 'promo_image' ? '📸 Image' : piece.type === 'promo_video' ? '🎬 Video' : '📝 Post'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                  piece.status === 'ready' ? 'bg-green-500/20 text-green-300' :
                                  piece.status === 'generating' ? 'bg-blue-500/20 text-blue-300' :
                                  'bg-white/10 text-white/40'
                                }`}>
                                  {piece.status}
                                </span>
                              </div>
                              {piece.caption && (
                                <p className="text-[10px] text-white/40 mt-1 line-clamp-2">{piece.caption}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
