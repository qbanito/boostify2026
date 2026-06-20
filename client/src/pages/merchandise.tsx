import { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAuth } from "../hooks/use-auth";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { ArtistLandingPage } from "../components/artist/artist-landing-page";
import { db } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Skeleton } from "../components/ui/skeleton";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { useToast } from "../hooks/use-toast";
import {
  ShoppingBag,
  Users,
  Palette,
  Share2,
  Shirt,
  Coffee,
  BackpackIcon,
  Smartphone,
  Sticker,
  Book,
  Watch,
  Headphones,
  Badge as BadgeIcon,
  Package,
  ArrowRight,
  Printer,
  LineChart,
  ShoppingCart,
  Building2,
  Settings,
  ImageIcon,
  Music,
  BarChart2,
  Sparkles,
  User,
  Edit,
  Save,
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  AlertTriangle,
  ClipboardList
} from "lucide-react";
// import { SiShopify } from "react-icons/si"; // Hidden - Boostify is our own marketplace
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { Download, Video } from "lucide-react";
import { PrintfulDashboard } from "../components/merchandise/printful-dashboard";
// import { ShopifyIntegration } from "../components/merchandise/shopify-integration"; // Hidden - Boostify is our own marketplace
import { AnalyticsDashboard } from "../components/merchandise/analytics-dashboard";
import { OrderTrackingDashboard } from "../components/merchandise/order-tracking-dashboard";

// Product type definition from original code
interface Product {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  image: string;
  icon: JSX.Element;
  description: string;
  customizationOptions: string[];
}

// Products data from original code and edited snippet
const products: Product[] = [
  {
    id: "1",
    name: "Custom T-Shirt",
    category: "Apparel",
    basePrice: 19.99,
    image: "/assets/products/tshirt.jpg",
    icon: <Shirt className="h-8 w-8" />,
    description: "High-quality cotton t-shirts with custom designs",
    customizationOptions: ["Print Location", "Size", "Color", "Material"]
  },
  {
    id: "2",
    name: "Coffee Mug",
    category: "Accessories",
    basePrice: 14.99,
    image: "/assets/products/mug.jpg",
    icon: <Coffee className="h-8 w-8" />,
    description: "Ceramic mugs perfect for merchandise",
    customizationOptions: ["Print Type", "Size", "Handle Color"]
  },
  {
    id: "3",
    name: "Snapback Cap",
    category: "Apparel",
    basePrice: 24.99,
    image: "/assets/products/cap.jpg",
    icon: <BackpackIcon className="h-8 w-8" />,
    description: "Adjustable snapback caps with embroidered designs",
    customizationOptions: ["Embroidery Location", "Color", "Size"]
  },
  {
    id: "4",
    name: "Phone Case",
    category: "Accessories",
    basePrice: 19.99,
    image: "/assets/products/phone-case.jpg",
    icon: <Smartphone className="h-8 w-8" />,
    description: "Custom phone cases for various models",
    customizationOptions: ["Phone Model", "Case Type", "Design Placement"]
  },
  {
    id: "5",
    name: "Sticker Pack",
    category: "Accessories",
    basePrice: 9.99,
    image: "/assets/products/stickers.jpg",
    icon: <Sticker className="h-8 w-8" />,
    description: "Die-cut stickers with custom artwork",
    customizationOptions: ["Size", "Material", "Shape"]
  },
  {
    id: "6",
    name: "Tour Book",
    category: "Print",
    basePrice: 29.99,
    image: "/assets/products/book.jpg",
    icon: <Book className="h-8 w-8" />,
    description: "High-quality photo books and tour programs",
    customizationOptions: ["Page Count", "Size", "Paper Type", "Cover Style"]
  },
  {
    id: "7",
    name: "Wristband",
    category: "Accessories",
    basePrice: 7.99,
    image: "/assets/products/wristband.jpg",
    icon: <Watch className="h-8 w-8" />,
    description: "Silicone wristbands with custom text",
    customizationOptions: ["Color", "Size", "Text Style"]
  },
  {
    id: "8",
    name: "Headphones",
    category: "Electronics",
    basePrice: 59.99,
    image: "/assets/products/headphones.jpg",
    icon: <Headphones className="h-8 w-8" />,
    description: "Branded wireless headphones",
    customizationOptions: ["Color Scheme", "Logo Placement", "Packaging"]
  },
  {
    id: "9",
    name: "Enamel Pin",
    category: "Accessories",
    basePrice: 12.99,
    image: "/assets/products/pin.jpg",
    icon: <BadgeIcon className="h-8 w-8" />,
    description: "Custom enamel pins with your designs",
    customizationOptions: ["Size", "Backing Type", "Finish"]
  },
  {
    id: "10",
    name: "Merch Bundle",
    category: "Bundles",
    basePrice: 79.99,
    image: "/assets/products/bundle.jpg",
    icon: <Package className="h-8 w-8" />,
    description: "Curated merchandise bundles",
    customizationOptions: ["Bundle Items", "Packaging", "Price Tier"]
  },
  {
    id: "11",
    name: "Limited Edition Vinyl Box Set",
    category: "Music",
    basePrice: 149.99,
    image: "/assets/products/vinyl-box.jpg",
    icon: <Music className="h-8 w-8" />,
    description: "Collector's edition vinyl box set with exclusive artwork",
    customizationOptions: ["Box Design", "Vinyl Color", "Artwork Style", "Packaging"]
  },
  {
    id: "12",
    name: "Artist Signature Guitar Pick",
    category: "Accessories",
    basePrice: 15.99,
    image: "/assets/products/pick.jpg",
    icon: <Music className="h-8 w-8" />,
    description: "Custom guitar picks with artist signature and design",
    customizationOptions: ["Material", "Thickness", "Design", "Finish"]
  },
  {
    id: "13",
    name: "Tour Photo Book",
    category: "Print",
    basePrice: 39.99,
    image: "/assets/products/photobook.jpg",
    icon: <ImageIcon className="h-8 w-8" />,
    description: "High-quality photo book featuring tour moments",
    customizationOptions: ["Size", "Cover Type", "Paper Quality", "Layout"]
  },
  {
    id: "14",
    name: "Premium Leather Jacket",
    category: "Apparel",
    basePrice: 199.99,
    image: "/assets/products/jacket.jpg",
    icon: <Shirt className="h-8 w-8" />,
    description: "Custom leather jacket with embroidered artist logo",
    customizationOptions: ["Size", "Color", "Logo Placement", "Hardware Finish"]
  },
  {
    id: "15",
    name: "Digital Music Bundle",
    category: "Digital",
    basePrice: 24.99,
    image: "/assets/products/digital-bundle.jpg",
    icon: <Download className="h-8 w-8" />,
    description: "Exclusive digital content package with unreleased tracks",
    customizationOptions: ["Format", "Bonus Content", "Artwork", "Resolution"]
  },
  {
    id: "16",
    name: "Concert Photography Print",
    category: "Print",
    basePrice: 29.99,
    image: "/assets/products/concert-print.jpg",
    icon: <ImageIcon className="h-8 w-8" />,
    description: "Limited edition concert photography prints",
    customizationOptions: ["Size", "Frame", "Paper Type", "Finish"]
  },
  {
    id: "17",
    name: "Artist Collection Backpack",
    category: "Accessories",
    basePrice: 69.99,
    image: "/assets/products/backpack.jpg",
    icon: <BackpackIcon className="h-8 w-8" />,
    description: "Premium backpack with custom artist designs",
    customizationOptions: ["Style", "Color", "Size", "Pattern"]
  },
  {
    id: "18",
    name: "Premium Sound Pack",
    category: "Digital",
    basePrice: 49.99,
    image: "/assets/products/sound-pack.jpg",
    icon: <Music className="h-8 w-8" />,
    description: "Exclusive sound samples and production elements",
    customizationOptions: ["Format", "Genre", "Sample Rate", "Pack Size"]
  },
  {
    id: "19",
    name: "Artist Documentary",
    category: "Digital",
    basePrice: 19.99,
    image: "/assets/products/documentary.jpg",
    icon: <Video className="h-8 w-8" />,
    description: "Behind-the-scenes documentary with exclusive footage",
    customizationOptions: ["Format", "Resolution", "Subtitles", "Extras"]
  },
  {
    id: "20",
    name: "VIP Meet & Greet Package",
    category: "Experience",
    basePrice: 299.99,
    image: "/assets/products/vip-package.jpg",
    icon: <Users className="h-8 w-8" />,
    description: "Exclusive VIP experience with merchandise bundle",
    customizationOptions: ["Event Date", "Package Tier", "Merchandise", "Experience Type"]
  }
];

const salesData = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 5000 },
  { name: 'Apr', value: 2780 },
  { name: 'May', value: 1890 },
  { name: 'Jun', value: 2390 },
];

interface UserProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  userId: string;
  createdAt?: any;
}

// Artist interface for my-artists merchandise
interface MyArtist {
  id: number;
  name: string | null;
  slug: string | null;
  profileImage: string | null;
  genres: string[] | null;
  isAIGenerated: boolean;
}

// Merchandise from Firestore
interface ArtistMerchandise {
  id: string;
  userId: number;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  category: string;
  stock: number;
  isAvailable: boolean;
  artistName: string | null;
  createdAt: string | Date;
}

interface MerchandiseByArtist {
  artist: MyArtist;
  products: ArtistMerchandise[];
}

interface MyArtistsMerchandiseResponse {
  artists: MyArtist[];
  merchandiseByArtist: MerchandiseByArtist[];
  totalProducts: number;
}

// Marketing Stats Interface
interface MarketingStats {
  emailMarketing: {
    isActive: boolean;
    totalCampaigns: number;
    activeCampaigns: number;
    completedCampaigns: number;
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalReplied: number;
    openRate: number;
    clickRate: number;
  };
  socialMedia: {
    isConnected: boolean;
    spotifyFollowers: number;
    instagramFollowers: number;
    youtubeViews: number;
    totalEngagement: number;
  };
  plugins: {
    abandonedCartRecovery: { enabled: boolean; recoveredCarts: number; revenue: number };
    customerReviews: { enabled: boolean; totalReviews: number; averageRating: number };
    loyaltyProgram: { enabled: boolean; activeMembers: number; pointsIssued: number };
    seoOptimizer: { enabled: boolean; score: number; improvements: number };
  };
}

export default function MerchandisePage() {
  const [selectedTab, setSelectedTab] = useState("products");
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const [userProducts, setUserProducts] = useState<UserProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [userSlug, setUserSlug] = useState<string>("");
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ArtistMerchandise | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    isAvailable: true
  });
  
  // Add product modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    description: '',
    price: 29.99,
    stock: 100,
    category: 'clothing',
    imageUrl: '',
    productType: ''
  });
  const [selectedArtistForAdd, setSelectedArtistForAdd] = useState<number | null>(null);
  
  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ArtistMerchandise | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string; updates: typeof editForm }) => {
      const token = await getToken();
      const res = await fetch(`/api/merch/firestore/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data.updates)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update product');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Product Updated",
        description: "Changes saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['my-artists-merchandise'] });
      setEditModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Sync to Boostify-Prints mutation
  const syncPrintsMutation = useMutation({
    mutationFn: async (product: ArtistMerchandise) => {
      const token = await getToken();
      const res = await fetch('/api/merch/sync-printful', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          imageUrl: product.images?.[0] || '',
          variantId: 4012, // Default t-shirt variant
          retailPrice: product.price.toString()
        })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to sync with Boostify-Prints');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Synced with Boostify-Prints",
        description: "Product sent to production queue",
      });
      queryClient.invalidateQueries({ queryKey: ['my-artists-merchandise'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const token = await getToken();
      const res = await fetch(`/api/merch/firestore/${productId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete product');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Product Deleted",
        description: "The product has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['my-artists-merchandise'] });
      setDeleteModalOpen(false);
      setProductToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: typeof addForm & { artistId: number; artistName: string }) => {
      const token = await getToken();
      const res = await fetch('/api/merch/firestore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create product');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Product Created",
        description: "New product added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['my-artists-merchandise'] });
      setAddModalOpen(false);
      setAddForm({
        name: '',
        description: '',
        price: 29.99,
        stock: 100,
        category: 'clothing',
        imageUrl: '',
        productType: ''
      });
      setSelectedArtistForAdd(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Create Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Open delete confirmation
  const openDeleteModal = (product: ArtistMerchandise) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  // Handle delete
  const handleDeleteProduct = () => {
    if (productToDelete) {
      deleteProductMutation.mutate(productToDelete.id);
    }
  };

  // Handle add product
  const handleAddProduct = () => {
    if (!selectedArtistForAdd) {
      toast({
        title: "Select Artist",
        description: "Please select an artist for this product",
        variant: "destructive"
      });
      return;
    }
    const artist = myArtistsMerch?.artists.find(a => a.id === selectedArtistForAdd);
    createProductMutation.mutate({
      ...addForm,
      artistId: selectedArtistForAdd,
      artistName: artist?.name || 'Unknown Artist'
    });
  };

  // Product types for Boostify-Prints catalog
  const productTypes = [
    { id: 'tshirt', name: 'T-Shirt', category: 'clothing' },
    { id: 'hoodie', name: 'Hoodie', category: 'clothing' },
    { id: 'tank', name: 'Tank Top', category: 'clothing' },
    { id: 'longsleeve', name: 'Long Sleeve', category: 'clothing' },
    { id: 'mug', name: 'Mug', category: 'accessories' },
    { id: 'poster', name: 'Poster', category: 'art' },
    { id: 'canvas', name: 'Canvas Print', category: 'art' },
    { id: 'phonecase', name: 'Phone Case', category: 'accessories' },
    { id: 'tote', name: 'Tote Bag', category: 'accessories' },
    { id: 'hat', name: 'Hat / Cap', category: 'clothing' },
  ];

  // Open edit modal
  const openEditModal = (product: ArtistMerchandise) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      isAvailable: product.isAvailable
    });
    setEditModalOpen(true);
  };

  // Handle save
  const handleSaveProduct = () => {
    if (editingProduct) {
      updateProductMutation.mutate({
        id: editingProduct.id,
        updates: editForm
      });
    }
  };

  // Fetch merchandise from my artists (Firestore)
  const { data: myArtistsMerch, isLoading: loadingArtistsMerch, error: merchError } = useQuery<MyArtistsMerchandiseResponse>({
    queryKey: ['my-artists-merchandise'],
    queryFn: async () => {
      console.log('[MERCH PAGE] Fetching my artists merchandise...');
      const token = await getToken();
      console.log('[MERCH PAGE] Token obtained:', token ? 'yes' : 'no');
      const res = await fetch('/api/merch/my-artists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('[MERCH PAGE] Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[MERCH PAGE] Error:', errorText);
        throw new Error('Failed to fetch merchandise');
      }
      const data = await res.json();
      console.log('[MERCH PAGE] Data received:', data);
      return data;
    },
    enabled: !!user
  });

  // Log errors
  if (merchError) {
    console.error('[MERCH PAGE] Query error:', merchError);
  }

  // Fetch marketing stats from database
  const { data: marketingStats, isLoading: loadingMarketing } = useQuery<MarketingStats>({
    queryKey: ['marketing-stats'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch('/api/marketing/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch marketing stats');
      }
      return res.json();
    },
    enabled: !!user
  });

  // Create social post mutation
  const socialPostMutation = useMutation({
    mutationFn: async (data: { content: string; platforms: string[]; scheduledAt?: string }) => {
      const token = await getToken();
      const res = await fetch('/api/marketing/social/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        throw new Error('Failed to create social post');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Post Created",
        description: "Your social media post has been scheduled",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Filter merchandise by selected artist
  const filteredMerchandise = selectedArtistId
    ? myArtistsMerch?.merchandiseByArtist.filter(m => m.artist.id === selectedArtistId) || []
    : myArtistsMerch?.merchandiseByArtist || [];

  // Cargar perfil del usuario y productos desde Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) {
        setLoadingProducts(false);
        return;
      }

      try {
        // Obtener el slug del usuario
        const userQuery = query(collection(db, "users"), where("uid", "==", String(user.id)));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          setUserSlug(userData.slug || String(user.id));
        } else {
          setUserSlug(String(user.id));
        }

        // Obtener productos del usuario
        const merchRef = collection(db, "merchandise");
        const q = query(merchRef, where("userId", "==", String(user.id)));
        const querySnapshot = await getDocs(q);
        
        const productsData: UserProduct[] = [];
        querySnapshot.forEach((doc) => {
          productsData.push({
            id: doc.id,
            ...doc.data()
          } as UserProduct);
        });
        
        setUserProducts(productsData);
        logger.info('📦 Productos cargados desde Firestore:', productsData.length);
      } catch (error) {
        logger.error('Error loading user data:', error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchUserData();
  }, [user?.id]);

  // Calculator state
  const [calcPrice, setCalcPrice] = useState(29.99);
  const productionBaseCost = 12.95; // Base cost for t-shirt (Boostify-Prints)
  const boostifyFee = 0.10; // 10% platform fee
  const artistShare = 0.30; // 30% for artist

  const calculateProfit = (retailPrice: number) => {
    const grossProfit = retailPrice - productionBaseCost;
    const platformFee = grossProfit * boostifyFee;
    const artistEarnings = grossProfit * artistShare;
    const boostifyEarnings = grossProfit - artistEarnings - platformFee;
    return {
      grossProfit: grossProfit.toFixed(2),
      artistEarnings: artistEarnings.toFixed(2),
      boostifyEarnings: boostifyEarnings.toFixed(2),
      platformFee: platformFee.toFixed(2)
    };
  };

  const profits = calculateProfit(calcPrice);

  // If not logged in, show landing page
  if (!user) {
    return <ArtistLandingPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <Header />

      {/* Hero Section with Video Background */}
      <div className="relative w-full min-h-[55vh] md:min-h-[65vh] overflow-hidden">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          poster="/assets/cover.jpg"
        >
          <source src="/assets/hero-video.mp4" type="video/mp4" />
        </video>
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/80" />
        
        {/* Animated Elements */}
        <div className="absolute inset-0">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 -right-20 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.15, 0.3, 0.15]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-20 -left-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"
          />
        </div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(249,115,22,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        <div className="relative container mx-auto px-4 md:px-8 h-full flex flex-col justify-center py-12 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Badge className="mb-6 bg-orange-500/20 text-orange-400 border-orange-500/30 px-4 py-1.5">
              <Sparkles className="w-4 h-4 mr-2" />
              Boostify Store & E-Commerce
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight">
              <span className="block">Your Artist</span>
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-pink-500 bg-clip-text text-transparent">
                Merchandise Store
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mb-8 leading-relaxed">
              Create, customize, and sell exclusive products from your artists. 
              Powered by Boostify-Prints for automatic production and shipping.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-lg px-8 h-14 shadow-xl shadow-orange-500/25"
                onClick={() => setSelectedTab("products")}
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                View Products
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 text-lg px-8 h-14"
                onClick={() => setSelectedTab("providers")}
              >
                <Printer className="mr-2 h-5 w-5" />
                Boostify-Prints
              </Button>
            </div>
          </motion.div>
          
          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-12 md:mt-16"
          >
            {[
              { label: "Products", value: myArtistsMerch?.totalProducts || 0, icon: Package },
              { label: "Artists", value: myArtistsMerch?.artists.length || 0, icon: Users },
              { label: "Categories", value: "12+", icon: Palette },
              { label: "Integrations", value: "5", icon: Share2 }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 md:p-6"
              >
                <stat.icon className="w-6 h-6 text-orange-500 mb-2" />
                <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-white/60">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Artist Collaboration Banner */}
      <div className="relative py-12 md:py-16 bg-gradient-to-r from-orange-500/10 via-purple-500/10 to-orange-500/10 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/assets/pattern.png')] opacity-5" />
        <div className="container mx-auto px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-4xl mx-auto"
          >
            <Badge className="mb-4 bg-gradient-to-r from-orange-500 to-purple-500 text-white border-0 px-6 py-2 text-lg">
              Boostify × Artist Collaboration
            </Badge>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              <span className="text-orange-500">30%</span> for You
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              These products are an exclusive collaboration between Boostify and you. 
              Artists earn <span className="text-orange-500 font-bold">30% of each sale</span>, no upfront investment or inventory. 
              We handle production, shipping and customer service.
            </p>
            
            {/* Mini Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-500">$0</p>
                <p className="text-sm text-muted-foreground">Upfront Cost</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">30%</p>
                <p className="text-sm text-muted-foreground">Your Earnings</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-500">0</p>
                <p className="text-sm text-muted-foreground">Inventory Risk</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Profit Calculator Section */}
      <div className="relative py-16 md:py-24 bg-gradient-to-b from-background to-black/50 overflow-hidden">
        <div className="container mx-auto px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Profit <span className="text-orange-500">Calculator</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              See how much you can earn from each sale
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <Card className="p-6 md:p-8 bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Price Slider */}
                <div>
                  <label className="block text-sm font-medium mb-4">Set Your Retail Price</label>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl font-bold text-orange-500">${calcPrice.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="100"
                      step="0.5"
                      value={calcPrice}
                      onChange={(e) => setCalcPrice(parseFloat(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>$15</span>
                      <span>$100</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-black/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-2">Base Production Cost (Boostify-Prints)</p>
                    <p className="text-2xl font-bold text-white">${productionBaseCost.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Includes printing, materials & fulfillment</p>
                  </div>
                </div>

                {/* Profit Breakdown */}
                <div className="space-y-4">
                  <h3 className="font-bold text-lg mb-4">Profit Breakdown</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-green-500/5 border border-green-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">Your Earnings (30%)</p>
                          <p className="text-xs text-muted-foreground">Artist revenue share</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-green-500">${profits.artistEarnings}</p>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="font-medium">Boostify Share</p>
                          <p className="text-xs text-muted-foreground">Platform & marketing</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-orange-500">${profits.boostifyEarnings}</p>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Printer className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium">Production Cost</p>
                          <p className="text-xs text-muted-foreground">Boostify-Prints production</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-purple-500">${productionBaseCost.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-gradient-to-r from-orange-500/20 to-purple-500/20 rounded-xl border border-orange-500/30">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">Gross Profit per Sale</p>
                      <p className="text-xl font-bold">${profits.grossProfit}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Process Steps Animation */}
      <div className="relative py-16 md:py-24 bg-gradient-to-b from-black/50 to-background overflow-hidden">
        <div className="container mx-auto px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 md:mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It <span className="text-orange-500">Works</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From your design to your fans' doorstep in a few simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { 
                step: 1, 
                title: "Design", 
                desc: "Create or upload your unique designs for your products",
                icon: Palette,
                color: "from-orange-500 to-orange-600"
              },
              { 
                step: 2, 
                title: "Configure", 
                desc: "Choose products, set prices and manage inventory",
                icon: Settings,
                color: "from-pink-500 to-purple-600"
              },
              { 
                step: 3, 
                title: "Sync", 
                desc: "Connect with Boostify-Prints for automatic production",
                icon: RefreshCw,
                color: "from-blue-500 to-cyan-600"
              },
              { 
                step: 4, 
                title: "Sell", 
                desc: "Your fans buy and receive products at their door",
                icon: ShoppingCart,
                color: "from-green-500 to-emerald-600"
              }
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                <div className="relative group">
                  {/* Connection Line */}
                  {index < 3 && (
                    <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-orange-500/50 to-transparent z-0" />
                  )}
                  
                  <Card className="relative z-10 p-6 h-full bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 hover:border-orange-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-orange-500/10">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-lg`}
                    >
                      <item.icon className="w-8 h-8 text-white" />
                    </motion.div>
                    
                    <div className="absolute top-4 right-4 text-4xl font-black text-white/5 group-hover:text-orange-500/10 transition-colors">
                      0{item.step}
                    </div>
                    
                    <h3 className="text-xl font-bold mb-2 group-hover:text-orange-500 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-3 sm:px-4 md:px-8 py-6 md:py-12 pb-20 sm:pb-6">
        <Tabs defaultValue="products" value={selectedTab} onValueChange={setSelectedTab} className="space-y-6 md:space-y-8">
          {/* Tabs Navigation - Mobile Optimized */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-14 sm:top-16 z-40 bg-background/80 backdrop-blur-xl py-3 -mx-3 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0 md:relative md:top-0 md:bg-transparent md:backdrop-blur-none"
          >
            <TabsList className="w-full flex overflow-x-auto gap-2 p-2 bg-white/5 border border-white/10 rounded-2xl scrollbar-hide">
              {[
                { value: "products",  label: "Products",         icon: ShoppingBag },
                { value: "orders",    label: "Orders",           icon: ClipboardList },
                // { value: "shopify", label: "Shopify", icon: SiShopify }, // Hidden - Boostify is our own marketplace
                { value: "analytics", label: "Analytics",        icon: LineChart },
                { value: "marketing", label: "Marketing",        icon: Share2 },
                { value: "providers", label: "Boostify-Prints",  icon: Printer }
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="flex-1 min-w-[100px] px-4 py-3 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
                >
                  <tab.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-nowrap text-sm">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </motion.div>

          {/* Products Tab */}
          <TabsContent value="products">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-8"
            >
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    Products from <span className="text-orange-500">My Artists</span>
                  </h2>
                  <p className="text-muted-foreground">
                    {myArtistsMerch?.totalProducts || 0} products ready to sell
                  </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <Button 
                    className="flex-1 md:flex-none bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    onClick={() => setAddModalOpen(true)}
                    disabled={!myArtistsMerch?.artists?.length}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 md:flex-none border-orange-500/30 hover:bg-orange-500 hover:text-white"
                    onClick={() => setSelectedTab("providers")}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Artist Filter - Mobile Optimized */}
            {myArtistsMerch && myArtistsMerch.artists.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="mb-8"
              >
                <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Filter by artist
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-hide">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      variant={selectedArtistId === null ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedArtistId(null)}
                      className={`flex-shrink-0 ${selectedArtistId === null 
                        ? "bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg shadow-orange-500/25" 
                        : "border-white/20 hover:border-orange-500"}`}
                    >
                      <Package className="w-4 h-4 mr-2" />
                      All
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {myArtistsMerch.totalProducts}
                      </Badge>
                    </Button>
                  </motion.div>
                  
                  {myArtistsMerch.artists.map((artist, index) => {
                    const artistProducts = myArtistsMerch.merchandiseByArtist.find(m => m.artist.id === artist.id)?.products.length || 0;
                    return (
                      <motion.div 
                        key={artist.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        whileHover={{ scale: 1.03 }} 
                        whileTap={{ scale: 0.97 }}
                      >
                        <Button
                          variant={selectedArtistId === artist.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedArtistId(artist.id)}
                          className={`flex-shrink-0 ${selectedArtistId === artist.id 
                            ? "bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg shadow-orange-500/25" 
                            : "border-white/20 hover:border-orange-500"}`}
                        >
                          <Avatar className="w-5 h-5 mr-2 border border-orange-500/30">
                            <AvatarImage src={artist.profileImage || undefined} />
                            <AvatarFallback className="text-[10px] bg-orange-500/20">
                              {artist.name?.charAt(0) || 'A'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="max-w-[80px] truncate">{artist.name || 'Artist'}</span>
                          {artistProducts > 0 && (
                            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                              {artistProducts}
                            </Badge>
                          )}
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {loadingArtistsMerch ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="overflow-hidden bg-white/5">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : !myArtistsMerch || myArtistsMerch.artists.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="p-8 md:p-12 text-center bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <User className="h-20 w-20 mx-auto mb-6 text-orange-500/50" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-3">You don't have any artists yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Create your artist profile or generate AI artists to start selling exclusive merchandise
                  </p>
                  <Link href="/virtual-record-label">
                    <Button size="lg" className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl shadow-orange-500/25">
                      <Sparkles className="mr-2 h-5 w-5" />
                      Create Artist
                    </Button>
                  </Link>
                </Card>
              </motion.div>
            ) : myArtistsMerch.totalProducts === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="p-8 md:p-12 text-center bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <ShoppingBag className="h-20 w-20 mx-auto mb-6 text-orange-500/50" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-3">No products yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Visit any artist profile to create exclusive merchandise
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {myArtistsMerch.artists.slice(0, 3).map((artist) => (
                      <Link key={artist.id} href={`/artist/${artist.slug || artist.id}`}>
                        <Button variant="outline" className="border-white/20 hover:border-orange-500 hover:bg-orange-500/10">
                          <Avatar className="w-5 h-5 mr-2">
                            <AvatarImage src={artist.profileImage || undefined} />
                            <AvatarFallback className="text-xs bg-orange-500/20">
                              {artist.name?.charAt(0) || 'A'}
                            </AvatarFallback>
                          </Avatar>
                          {artist.name || 'Artist'}
                        </Button>
                      </Link>
                    ))}
                  </div>
                </Card>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div 
                  className="space-y-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {filteredMerchandise.map((artistMerch, artistIndex) => (
                    artistMerch.products.length > 0 && (
                      <motion.div 
                        key={artistMerch.artist.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: artistIndex * 0.1, duration: 0.4 }}
                      >
                        {/* Artist Header - Mobile Optimized */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border border-white/5">
                          <div className="flex items-center gap-3 flex-1">
                            <Avatar className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-orange-500 shadow-lg shadow-orange-500/20 flex-shrink-0">
                              <AvatarImage src={artistMerch.artist.profileImage || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-lg sm:text-xl">
                                {artistMerch.artist.name?.charAt(0) || 'A'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg sm:text-xl font-bold truncate">{artistMerch.artist.name || 'Unknown'}</h3>
                                {artistMerch.artist.isAIGenerated && (
                                  <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-400/50 text-[10px] sm:text-xs flex-shrink-0">
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    AI
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {artistMerch.products.length} product{artistMerch.products.length !== 1 ? 's' : ''}
                                {artistMerch.artist.genres && artistMerch.artist.genres.length > 0 && (
                                  <span className="hidden sm:inline ml-2 text-orange-400">• {artistMerch.artist.genres.slice(0, 2).join(', ')}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <Link href={`/artist/${artistMerch.artist.slug || artistMerch.artist.id}`}>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all">
                              View Profile
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                        </div>

                        {/* Products Grid - Responsive */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                          {artistMerch.products.map((product, productIndex) => (
                            <motion.div
                              key={product.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: productIndex * 0.03 + artistIndex * 0.05, duration: 0.3 }}
                              whileHover={{ y: -4, transition: { duration: 0.2 } }}
                            >
                              <Card className="overflow-hidden group hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 border-white/10 h-full bg-gradient-to-br from-white/5 to-white/[0.02]">
                                <div className="aspect-square relative overflow-hidden">
                                  {product.images && product.images.length > 0 ? (
                                    <img
                                      src={product.images[0]}
                                      alt={product.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                      onError={(e) => {
                                        e.currentTarget.src = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400';
                                      }}
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-500/10 to-purple-500/10">
                                      <ShoppingBag className="h-10 w-10 sm:h-16 sm:w-16 text-orange-500/40" />
                                    </div>
                                  )}
                                  {/* Price Badge */}
                                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                                    <Badge className="bg-black/70 backdrop-blur-sm text-white font-bold text-xs sm:text-sm px-2 py-0.5 sm:px-3 sm:py-1">
                                      ${typeof product.price === 'number' ? product.price.toFixed(2) : parseFloat(product.price || '0').toFixed(2)}
                                    </Badge>
                                  </div>
                                  {/* Out of Stock Overlay */}
                                  {!product.isAvailable && (
                                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
                                      <Badge variant="destructive" className="text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-4">Sold Out</Badge>
                                    </div>
                                  )}
                                  {/* Hover Overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                                    <div className="w-full flex flex-col gap-1.5">
                                      <div className="flex gap-1.5">
                                        <Button
                                          size="sm"
                                          className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600"
                                          onClick={(e) => { e.stopPropagation(); openEditModal(product); }}
                                        >
                                          <Edit className="w-3 h-3 mr-1" />
                                          Edit
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="flex-1 h-8 text-xs bg-purple-500 hover:bg-purple-600"
                                          onClick={(e) => { e.stopPropagation(); syncPrintsMutation.mutate(product); }}
                                          disabled={syncPrintsMutation.isPending}
                                        >
                                          {syncPrintsMutation.isPending ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Printer className="w-3 h-3 mr-1" />
                                              Sync
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="w-full h-7 text-xs"
                                        onClick={(e) => { e.stopPropagation(); openDeleteModal(product); }}
                                      >
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <div className="p-3 sm:p-4">
                                  <h4 className="font-semibold text-sm sm:text-base group-hover:text-orange-500 transition-colors line-clamp-1 mb-1">
                                    {product.name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2 sm:mb-3 min-h-[28px] sm:min-h-[32px]">
                                    {product.description || 'Exclusive product'}
                                  </p>
                                  <div className="flex items-center justify-between gap-2">
                                    <Badge variant="secondary" className="capitalize text-[10px] sm:text-xs px-1.5 sm:px-2 bg-orange-500/10 text-orange-400 truncate max-w-[60%]">
                                      {product.category}
                                    </Badge>
                                    <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                                      <Package className="w-3 h-3" />
                                      {product.stock}
                                    </span>
                                  </div>
                                </div>
                              </Card>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Info Banner - Improved */}
            {myArtistsMerch && myArtistsMerch.totalProducts > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="mt-8 p-4 sm:p-6 bg-gradient-to-r from-orange-500/5 via-purple-500/5 to-orange-500/5 border-white/10">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-xl">
                      <Printer className="h-6 w-6 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-lg mb-1">Sync with Boostify-Prints</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Connect your products with Boostify-Prints for automatic production. 
                        When a fan buys, the product is printed and shipped automatically.
                      </p>
                      <Button 
                        size="sm" 
                        className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                        onClick={() => setSelectedTab("providers")}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Configure Boostify-Prints
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* Shopify Integration Tab - Hidden: Boostify is our own marketplace
          <TabsContent value="shopify">
            <ShopifyIntegration />
            <div className="grid gap-6 md:grid-cols-2 mt-6">
              <Card className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-orange-500/10 rounded-lg">
                    <SiShopify className="h-8 w-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">Shopify Integration</h3>
                    <p className="text-muted-foreground">
                      Connect and manage your Shopify store
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-orange-500/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="font-medium">Store Status</p>
                        <p className="text-sm text-muted-foreground">mystore.shopify.com</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">Connected</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button className="justify-start" variant="outline">
                      <Settings className="mr-2 h-4 w-4" />
                      Store Settings
                    </Button>
                    <Button className="justify-start" variant="outline">
                      <Package className="mr-2 h-4 w-4" />
                      Products
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-orange-500/10 rounded-lg">
                    <Share2 className="h-8 w-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">Available Plugins</h3>
                    <p className="text-muted-foreground">
                      Enhance your store with powerful plugins
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Print on Demand</h4>
                      <Badge>Popular</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Automatically fulfill print on demand orders
                    </p>
                    <Button variant="outline" size="sm">Install</Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Order Tracking</h4>
                      <Badge>Essential</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Real-time order tracking and notifications
                    </p>
                    <Button variant="outline" size="sm">Install</Button>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
          */}

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsDashboard />
            <div className="grid gap-6 md:grid-cols-2 mt-6">
              <Card className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-orange-500/10 rounded-lg">
                    <BarChart2 className="h-8 w-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">Sales Analytics</h3>
                    <p className="text-muted-foreground">
                      Track your merchandise performance
                    </p>
                  </div>
                </div>

                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesData}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="rgb(249, 115, 22)" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="rgb(249, 115, 22)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="rgb(249, 115, 22)"
                        fillOpacity={1}
                        fill="url(#colorSales)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-orange-500/10 rounded-lg">
                    <Package className="h-8 w-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">Top Products</h3>
                    <p className="text-muted-foreground">
                      Best selling merchandise items
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shirt className="h-5 w-5 text-orange-500" />
                        <div>
                          <p className="font-medium">Band T-Shirt</p>
                          <p className="text-sm text-muted-foreground">Black, All Sizes</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">$1,234</p>
                        <p className="text-sm text-green-500">+12%</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Music className="h-5 w-5 text-orange-500" />
                        <div>
                          <p className="font-medium">Limited Vinyl</p>
                          <p className="text-sm text-muted-foreground">Special Edition</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">$987</p>
                        <p className="text-sm text-green-500">+8%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Marketing Tab - Fully Connected to Database */}
          <TabsContent value="marketing">
            {loadingMarketing ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <Share2 className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{marketingStats?.emailMarketing.totalCampaigns || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Campaigns</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <Users className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{marketingStats?.emailMarketing.totalSent || 0}</p>
                        <p className="text-xs text-muted-foreground">Emails Sent</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <BarChart2 className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{marketingStats?.emailMarketing.openRate || 0}%</p>
                        <p className="text-xs text-muted-foreground">Open Rate</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{marketingStats?.socialMedia.totalEngagement || 0}</p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Email Marketing Card */}
                  <Card className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-orange-500/10 rounded-xl">
                        <Share2 className="h-7 w-7 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">Email Marketing</h3>
                        <p className="text-sm text-muted-foreground">
                          Promote your merchandise to customers
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg bg-gradient-to-r from-orange-500/5 to-transparent">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            Email Campaigns
                            <Badge className={marketingStats?.emailMarketing.activeCampaigns ? "bg-green-500" : "bg-gray-500"}>
                              {marketingStats?.emailMarketing.activeCampaigns ? 'Active' : 'Inactive'}
                            </Badge>
                          </h4>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                          <div className="text-center p-2 bg-white/5 rounded">
                            <p className="font-bold text-orange-500">{marketingStats?.emailMarketing.totalSent || 0}</p>
                            <p className="text-xs text-muted-foreground">Sent</p>
                          </div>
                          <div className="text-center p-2 bg-white/5 rounded">
                            <p className="font-bold text-green-500">{marketingStats?.emailMarketing.totalOpened || 0}</p>
                            <p className="text-xs text-muted-foreground">Opened</p>
                          </div>
                          <div className="text-center p-2 bg-white/5 rounded">
                            <p className="font-bold text-blue-500">{marketingStats?.emailMarketing.totalClicked || 0}</p>
                            <p className="text-xs text-muted-foreground">Clicked</p>
                          </div>
                        </div>
                        <Progress value={marketingStats?.emailMarketing.openRate || 0} className="mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {marketingStats?.emailMarketing.openRate || 0}% open rate • {marketingStats?.emailMarketing.clickRate || 0}% click rate
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            Social Media
                            <Badge className="bg-green-500">Connected</Badge>
                          </h4>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                          <div className="text-center p-2 bg-white/5 rounded">
                            <p className="font-bold text-green-500">{marketingStats?.socialMedia.spotifyFollowers?.toLocaleString() || 0}</p>
                            <p className="text-xs text-muted-foreground">Spotify</p>
                          </div>
                          <div className="text-center p-2 bg-white/5 rounded">
                            <p className="font-bold text-pink-500">{marketingStats?.socialMedia.instagramFollowers?.toLocaleString() || 0}</p>
                            <p className="text-xs text-muted-foreground">Instagram</p>
                          </div>
                          <div className="text-center p-2 bg-white/5 rounded">
                            <p className="font-bold text-red-500">{marketingStats?.socialMedia.youtubeViews?.toLocaleString() || 0}</p>
                            <p className="text-xs text-muted-foreground">YouTube</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => {
                              socialPostMutation.mutate({
                                content: 'Check out our latest merch! 🎵',
                                platforms: ['instagram', 'twitter']
                              });
                            }}
                            disabled={socialPostMutation.isPending}
                          >
                            {socialPostMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Update'}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => {
                              toast({
                                title: "Schedule Post",
                                description: "Post scheduling coming soon!",
                              });
                            }}
                          >
                            Schedule
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Marketing Plugins Card */}
                  <Card className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-purple-500/10 rounded-xl">
                        <Settings className="h-7 w-7 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">Marketing Plugins</h3>
                        <p className="text-sm text-muted-foreground">
                          Enhance your marketing capabilities
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Abandoned Cart Recovery */}
                      <div className="p-4 border rounded-lg hover:border-orange-500/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                              <ShoppingCart className="h-4 w-4 text-orange-500" />
                            </div>
                            <div>
                              <h4 className="font-medium">Abandoned Cart Recovery</h4>
                              <p className="text-xs text-muted-foreground">
                                {marketingStats?.plugins.abandonedCartRecovery.recoveredCarts || 0} carts recovered • ${marketingStats?.plugins.abandonedCartRecovery.revenue || 0} revenue
                              </p>
                            </div>
                          </div>
                          <Badge className={marketingStats?.plugins.abandonedCartRecovery.enabled ? "bg-green-500" : "bg-gray-500"}>
                            {marketingStats?.plugins.abandonedCartRecovery.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>

                      {/* Customer Reviews */}
                      <div className="p-4 border rounded-lg hover:border-orange-500/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/10 rounded-lg">
                              <Sparkles className="h-4 w-4 text-yellow-500" />
                            </div>
                            <div>
                              <h4 className="font-medium">Customer Reviews</h4>
                              <p className="text-xs text-muted-foreground">
                                {marketingStats?.plugins.customerReviews.totalReviews || 0} reviews • ⭐ {marketingStats?.plugins.customerReviews.averageRating || 0} average
                              </p>
                            </div>
                          </div>
                          <Badge className={marketingStats?.plugins.customerReviews.enabled ? "bg-green-500" : "bg-gray-500"}>
                            {marketingStats?.plugins.customerReviews.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>

                      {/* Loyalty Program */}
                      <div className="p-4 border rounded-lg hover:border-orange-500/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                              <Users className="h-4 w-4 text-purple-500" />
                            </div>
                            <div>
                              <h4 className="font-medium">Loyalty Program</h4>
                              <p className="text-xs text-muted-foreground">
                                {marketingStats?.plugins.loyaltyProgram.activeMembers || 0} members • {marketingStats?.plugins.loyaltyProgram.pointsIssued?.toLocaleString() || 0} points issued
                              </p>
                            </div>
                          </div>
                          <Badge className={marketingStats?.plugins.loyaltyProgram.enabled ? "bg-green-500" : "bg-gray-500"}>
                            {marketingStats?.plugins.loyaltyProgram.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>

                      {/* SEO Optimizer */}
                      <div className="p-4 border rounded-lg hover:border-orange-500/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                              <BarChart2 className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                              <h4 className="font-medium">SEO Optimizer</h4>
                              <p className="text-xs text-muted-foreground">
                                Score: {marketingStats?.plugins.seoOptimizer.score || 0}/100 • {marketingStats?.plugins.seoOptimizer.improvements || 0} improvements available
                              </p>
                            </div>
                          </div>
                          <Badge className={marketingStats?.plugins.seoOptimizer.enabled ? "bg-green-500" : "bg-gray-500"}>
                            {marketingStats?.plugins.seoOptimizer.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Providers Tab - Production Integration */}
          <TabsContent value="providers">
            <PrintfulDashboard />
          </TabsContent>

          {/* Orders Tab - Order Tracking Dashboard */}
          <TabsContent value="orders">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  Order <span className="text-orange-500">Tracking</span>
                </h2>
                <p className="text-muted-foreground">
                  Track every sale and monitor fulfilment status in real time.
                </p>
              </div>
              <OrderTrackingDashboard />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Product Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="w-[95vw] max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-orange-500" />
              Edit Product
            </DialogTitle>
            <DialogDescription>
              Modify product details. Changes will sync automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Product name"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Product description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={editForm.stock}
                  onChange={(e) => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="available">Available for Sale</Label>
                <p className="text-sm text-muted-foreground">
                  Enable or disable product visibility
                </p>
              </div>
              <Switch
                id="available"
                checked={editForm.isAvailable}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isAvailable: checked })}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={updateProductMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={updateProductMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {updateProductMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Product
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteProductMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProduct}
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="w-[95vw] max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-500" />
              Add New Product
            </DialogTitle>
            <DialogDescription>
              Create a new product for your artist. Choose from Boostify-Prints catalog types.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Artist Selection */}
            <div className="grid gap-2">
              <Label>Select Artist *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedArtistForAdd || ''}
                onChange={(e) => setSelectedArtistForAdd(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Choose an artist...</option>
                {myArtistsMerch?.artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Type Selection */}
            <div className="grid gap-2">
              <Label>Product Type *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={addForm.productType}
                onChange={(e) => {
                  const selectedType = productTypes.find(t => t.id === e.target.value);
                  setAddForm({
                    ...addForm,
                    productType: e.target.value,
                    category: selectedType?.category || 'clothing'
                  });
                }}
              >
                <option value="">Choose a product type...</option>
                {productTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-name">Product Name *</Label>
              <Input
                id="add-name"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="e.g., Artist Name Tour T-Shirt"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="add-description">Description</Label>
              <Input
                id="add-description"
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                placeholder="Product description"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="add-image">Image URL</Label>
              <Input
                id="add-image"
                value={addForm.imageUrl}
                onChange={(e) => setAddForm({ ...addForm, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
              {addForm.imageUrl && (
                <img 
                  src={addForm.imageUrl} 
                  alt="Preview" 
                  className="h-20 w-20 object-cover rounded-md border"
                  onError={(e) => e.currentTarget.style.display = 'none'}
                />
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-price">Price ($)</Label>
                <Input
                  id="add-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={addForm.price}
                  onChange={(e) => setAddForm({ ...addForm, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="add-stock">Stock</Label>
                <Input
                  id="add-stock"
                  type="number"
                  min="0"
                  value={addForm.stock}
                  onChange={(e) => setAddForm({ ...addForm, stock: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAddModalOpen(false)}
              disabled={createProductMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={createProductMutation.isPending || !selectedArtistForAdd || !addForm.name || !addForm.productType}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {createProductMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Product
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}