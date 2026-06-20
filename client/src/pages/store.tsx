import React, { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { motion } from "framer-motion";
import { SiInstagram, SiFacebook, SiTelegram, SiTiktok, SiYoutube, SiX, SiPinterest, SiAndroid, SiApple } from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";
import axios from "axios";
import {
  Download,
  Zap,
  Shield,
  Bot,
  Users,
  Settings,
  MessageCircle,
  Activity,
  ChevronRight,
  CheckCircle2,
  Video,
  Music,
  Image,
  Sparkles,
  Tv,
  Camera,
  Scissors,
  MusicIcon,
  Brush,
  FileVideo,
  Palette,
  Star,
  Shirt,
  Mic2,
  Wand2
} from "lucide-react";

// Aplicaciones móviles para el AppStore
const mobileApps = [
  {
    id: 1,
    name: "VirtualFit Pro",
    description: "Try on clothing virtually with AI-powered precision",
    price: 4.99,
    type: "Virtual Try-On",
    features: [
      "Real-time garment fitting",
      "Size recommendation",
      "Share outfit previews",
      "Store favorite styles",
      "Retailer integration"
    ],
    icon: Shirt,
    platforms: ["iOS", "Android"],
    popular: true,
    beta: true
  },
  {
    id: 2,
    name: "LipSyncMaster",
    description: "Professional lip syncing app for musicians and creators",
    price: 5.99,
    type: "Lipsync",
    features: [
      "Real-time lip synchronization",
      "Multiple language support",
      "Text-to-lip animation",
      "Audio track importing",
      "Video exporting in HD"
    ],
    icon: Mic2,
    platforms: ["iOS", "Android"],
    premium: true,
    beta: true
  },
  {
    id: 3,
    name: "EffectStudio",
    description: "Create stunning visual effects for your photos and videos",
    price: 3.99,
    type: "Effects",
    features: [
      "100+ premium effects",
      "Real-time preview",
      "Custom effect creation",
      "Batch processing",
      "Social media sharing"
    ],
    icon: Sparkles,
    platforms: ["iOS", "Android"],
    popular: true,
    beta: true
  },
  {
    id: 4,
    name: "MusicVisualizerPro",
    description: "Transform your music into stunning visual experiences",
    price: 4.99,
    type: "Music Visualization",
    features: [
      "Real-time audio analysis",
      "Custom visual themes",
      "Beat-synced animations",
      "Export as video",
      "Live streaming support"
    ],
    icon: MusicIcon,
    platforms: ["iOS", "Android"]
  },
  {
    id: 5,
    name: "ArtistAI",
    description: "AI-powered drawing and design assistant for musicians",
    price: 6.99,
    type: "AI Creation",
    features: [
      "Album cover generation",
      "Merchandise design",
      "Poster creation",
      "Style customization",
      "One-tap export"
    ],
    icon: Palette,
    platforms: ["iOS", "Android"],
    premium: true
  },
  {
    id: 6,
    name: "StageCraft",
    description: "Virtual stage designer for planning performances",
    price: 7.99,
    type: "Performance",
    features: [
      "3D stage modeling",
      "Lighting simulation",
      "Equipment placement",
      "Virtual walkthrough",
      "Shareable plans"
    ],
    icon: Tv,
    platforms: ["iOS", "Android"]
  },
  {
    id: 7,
    name: "VideoDirector",
    description: "Professional music video creation and editing suite",
    price: 8.99,
    type: "Video Production",
    features: [
      "Multi-track editing",
      "AI scene detection",
      "Effect templates",
      "Auto-sync to music",
      "4K export"
    ],
    icon: FileVideo,
    platforms: ["iOS", "Android"],
    premium: true
  },
  {
    id: 8,
    name: "SoundScape",
    description: "Advanced audio mixing and mastering on your mobile device",
    price: 6.99,
    type: "Audio Production",
    features: [
      "Multi-track mixing",
      "Pro-grade effects",
      "Mastering presets",
      "Spectrum analysis",
      "Cloud project sync"
    ],
    icon: Music,
    platforms: ["iOS", "Android"]
  },
  {
    id: 9,
    name: "FanConnect",
    description: "Engage with fans through interactive experiences",
    price: 3.99,
    type: "Fan Engagement",
    features: [
      "Live polls and Q&A",
      "Virtual meet-and-greets",
      "Exclusive content sharing",
      "Fan analytics",
      "Ticket integration"
    ],
    icon: Users,
    platforms: ["iOS", "Android"],
    popular: true
  },
  {
    id: 10,
    name: "MagicMotion",
    description: "Transform still images into dynamic animations",
    price: 5.99,
    type: "Animation",
    features: [
      "Photo animation",
      "Custom motion paths",
      "Character rigging",
      "Export as GIF or video",
      "Social sharing integration"
    ],
    icon: Wand2,
    platforms: ["iOS", "Android"]
  }
];

const products = [
  {
    id: 1,
    name: "InstagramPro Bot",
    description: "Advanced automation bot for organic Instagram growth",
    price: 49.99,
    platform: "instagram",
    features: [
      "Automated follow/unfollow",
      "Comment management",
      "Post scheduling",
      "Engagement analysis",
      "Custom audience filters"
    ],
    icon: SiInstagram,
    popular: true
  },
  {
    id: 2,
    name: "Facebook Growth Engine",
    description: "Complete automation for Facebook pages and groups",
    price: 59.99,
    platform: "facebook",
    features: [
      "Multi-page management",
      "Group automation",
      "Auto-responses",
      "Content scheduling",
      "Performance analytics"
    ],
    icon: SiFacebook
  },
  {
    id: 3,
    name: "TelegramMaster Bot",
    description: "Multi-purpose bot for Telegram management and growth",
    price: 39.99,
    platform: "telegram",
    features: [
      "Channel management",
      "Auto-responses",
      "Member analytics",
      "Spam filtering",
      "Message scheduling"
    ],
    icon: SiTelegram
  },
  {
    id: 4,
    name: "Instagram Engagement Pro",
    description: "Specialized bot for maximizing Instagram engagement",
    price: 44.99,
    platform: "instagram",
    features: [
      "AI comment management",
      "Smart auto-liking",
      "Hashtag analysis",
      "Detailed reporting",
      "Custom engagement"
    ],
    icon: SiInstagram
  },
  {
    id: 5,
    name: "Facebook Ads Assistant",
    description: "Bot for Facebook ad optimization and management",
    price: 69.99,
    platform: "facebook",
    features: [
      "Campaign optimization",
      "Audience analysis",
      "Automated A/B testing",
      "ROI reporting",
      "Budget adjustment"
    ],
    icon: SiFacebook
  },
  {
    id: 6,
    name: "Telegram Business Bot",
    description: "Advanced business bot for Telegram",
    price: 49.99,
    platform: "telegram",
    features: [
      "Integrated CRM",
      "AI chatbot",
      "Sales automation",
      "Conversion tracking",
      "Payment integration"
    ],
    icon: SiTelegram
  },
  {
    id: 7,
    name: "Instagram Story Pro",
    description: "Specialized bot for Story automation",
    price: 34.99,
    platform: "instagram",
    features: [
      "Story scheduling",
      "View analytics",
      "Auto-responses",
      "Auto highlights",
      "Advanced statistics"
    ],
    icon: SiInstagram
  },
  {
    id: 8,
    name: "Social Media Suite",
    description: "Complete bot suite for all platforms",
    price: 99.99,
    platform: "all",
    features: [
      "Multi-platform management",
      "Unified dashboard",
      "Cross-platform automation",
      "Integrated analytics",
      "Priority support"
    ],
    icon: Bot,
    premium: true
  },
  {
    id: 9,
    name: "TikTok Growth Pro",
    description: "Advanced automation for TikTok growth and engagement",
    price: 54.99,
    platform: "tiktok",
    features: [
      "Trend analysis",
      "Content scheduling",
      "Hashtag optimization",
      "Engagement automation",
      "Performance tracking"
    ],
    icon: SiTiktok,
    popular: true
  },
  {
    id: 10,
    name: "YouTube Channel Manager",
    description: "Comprehensive bot for YouTube channel growth",
    price: 64.99,
    platform: "youtube",
    features: [
      "Comment management",
      "Video optimization",
      "Subscriber growth",
      "Analytics dashboard",
      "SEO automation"
    ],
    icon: SiYoutube
  },
  {
    id: 11,
    name: "X Engagement Bot",
    description: "Smart automation for X (formerly Twitter) growth and engagement",
    price: 44.99,
    platform: "x",
    features: [
      "Tweet scheduling",
      "Auto-engagement",
      "Follower growth",
      "Analytics tools",
      "Content curation"
    ],
    icon: SiX
  },
  {
    id: 12,
    name: "LinkedIn Business Pro",
    description: "Professional automation for LinkedIn growth",
    price: 79.99,
    platform: "linkedin",
    features: [
      "Connection automation",
      "Content scheduling",
      "Lead generation",
      "Profile optimization",
      "Business analytics"
    ],
    icon: FaLinkedin,
    premium: true
  },
  {
    id: 13,
    name: "Pinterest Growth Engine",
    description: "Automated Pinterest marketing and management",
    price: 49.99,
    platform: "pinterest",
    features: [
      "Pin scheduling",
      "Board management",
      "Traffic analysis",
      "SEO optimization",
      "Engagement tracking"
    ],
    icon: SiPinterest
  },
  {
    id: 14,
    name: "Cross-Platform Analytics",
    description: "Unified analytics for all social media platforms",
    price: 89.99,
    platform: "all",
    features: [
      "Multi-platform tracking",
      "Performance comparison",
      "ROI calculation",
      "Custom reporting",
      "Trend analysis"
    ],
    icon: Activity
  },
  {
    id: 15,
    name: "Social CRM Pro",
    description: "Advanced CRM system for social media management",
    price: 74.99,
    platform: "all",
    features: [
      "Lead tracking",
      "Customer segmentation",
      "Automated responses",
      "Campaign management",
      "Integration APIs"
    ],
    icon: Users
  },
  {
    id: 16,
    name: "Enterprise Social Suite",
    description: "Complete enterprise solution for social media automation",
    price: 149.99,
    platform: "all",
    features: [
      "Full platform access",
      "Priority support",
      "Custom development",
      "Advanced security",
      "Team collaboration"
    ],
    icon: Shield,
    premium: true
  }
];

export default function StorePage() {
  const [loadingProducts, setLoadingProducts] = useState<Record<number, boolean>>({});
  const [loadingApps, setLoadingApps] = useState<Record<number, boolean>>({});
  const [purchasedProducts, setPurchasedProducts] = useState<Record<number, boolean>>({});
  const [purchasedApps, setPurchasedApps] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const auth = useAuth();
  const user = auth?.user;
  const isAuthenticated = !!user;
  
  // Cargar el estado de compra de los productos cuando el usuario está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      // Verificar productos comprados
      const checkPurchasedProducts = async () => {
        try {
          const purchasedStatusMap: Record<number, boolean> = {};
          
          // Verificar cada producto en paralelo
          const productPromises = products.map(async (product) => {
            try {
              const response = await axios.get(`/api/stripe/product-purchase-status/${product.id}`);
              if (response.data.success && response.data.isPurchased) {
                purchasedStatusMap[product.id] = true;
              }
            } catch (error) {
              logger.error(`Error checking purchase status for product ${product.id}:`, error);
            }
          });
          
          await Promise.all(productPromises);
          setPurchasedProducts(purchasedStatusMap);
        } catch (error) {
          logger.error("Error checking purchased products:", error);
        }
      };
      
      // Verificar aplicaciones compradas
      const checkPurchasedApps = async () => {
        try {
          const purchasedStatusMap: Record<number, boolean> = {};
          
          // Verificar cada aplicación en paralelo
          const appPromises = mobileApps.map(async (app) => {
            try {
              const response = await axios.get(`/api/stripe/product-purchase-status/app_${app.id}`);
              if (response.data.success && response.data.isPurchased) {
                purchasedStatusMap[app.id] = true;
              }
            } catch (error) {
              logger.error(`Error checking purchase status for app ${app.id}:`, error);
            }
          });
          
          await Promise.all(appPromises);
          setPurchasedApps(purchasedStatusMap);
        } catch (error) {
          logger.error("Error checking purchased apps:", error);
        }
      };
      
      checkPurchasedProducts();
      checkPurchasedApps();
    }
  }, [isAuthenticated]);

  // Iniciar el proceso de pago para un producto (bot)
  const handlePurchaseProduct = async (product: typeof products[0]) => {
    // Eliminamos la verificación previa para permitir flujo público

    try {
      // Establecer el producto como cargando
      setLoadingProducts(prev => ({ ...prev, [product.id]: true }));

      // Enviar la solicitud al servidor
      const response = await axios.post('/api/stripe/create-product-payment', {
        productId: product.id.toString(),
        productType: product.platform,
        amount: product.price,
        name: product.name
      });

      // Verificar si el producto ya ha sido comprado
      if (response.data.alreadyPurchased) {
        toast({
          title: "Producto ya adquirido",
          description: "Ya has comprado este producto anteriormente",
          variant: "default"
        });
        setPurchasedProducts(prev => ({ ...prev, [product.id]: true }));
        setLoadingProducts(prev => ({ ...prev, [product.id]: false }));
        return;
      }
      
      // Verificar si se requiere autenticación y el usuario NO está autenticado
      if (response.data.requiresAuth && !isAuthenticated) {
        toast({
          title: "Autenticación necesaria",
          description: response.data.message || "Por favor inicia sesión para completar la compra",
          variant: "default"
        });
        setLoadingProducts(prev => ({ ...prev, [product.id]: false }));
        
        // Redirigir a iniciar sesión
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      // Verificar si hay una URL de pago válida
      if (response.data.success && response.data.url) {
        // Redirigir al usuario a la página de pago de Stripe
        window.location.href = response.data.url;
      } else {
        throw new Error("No se pudo iniciar el proceso de pago");
      }
    } catch (error) {
      logger.error("Error al iniciar el pago:", error);
      toast({
        title: "Error de pago",
        description: "No se pudo iniciar el proceso de pago. Inténtalo nuevamente.",
        variant: "destructive"
      });
      setLoadingProducts(prev => ({ ...prev, [product.id]: false }));
    }
  };

  // Iniciar el proceso de pago para una app móvil
  const handlePurchaseApp = async (app: typeof mobileApps[0]) => {
    // Eliminamos la verificación previa para permitir flujo público

    try {
      // Establecer la app como cargando
      setLoadingApps(prev => ({ ...prev, [app.id]: true }));

      // Enviar la solicitud al servidor
      const response = await axios.post('/api/stripe/create-product-payment', {
        productId: `app_${app.id}`,
        productType: 'mobile_app',
        amount: app.price,
        name: app.name
      });

      // Verificar si la app ya ha sido comprada
      if (response.data.alreadyPurchased) {
        toast({
          title: "Aplicación ya adquirida",
          description: "Ya has comprado esta aplicación anteriormente",
          variant: "default"
        });
        setPurchasedApps(prev => ({ ...prev, [app.id]: true }));
        setLoadingApps(prev => ({ ...prev, [app.id]: false }));
        return;
      }
      
      // Verificar si se requiere autenticación y el usuario NO está autenticado
      if (response.data.requiresAuth && !isAuthenticated) {
        toast({
          title: "Autenticación necesaria",
          description: response.data.message || "Por favor inicia sesión para completar la compra",
          variant: "default"
        });
        setLoadingApps(prev => ({ ...prev, [app.id]: false }));
        
        // Redirigir a iniciar sesión
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      // Verificar si hay una URL de pago válida
      if (response.data.success && response.data.url) {
        // Redirigir al usuario a la página de pago de Stripe
        window.location.href = response.data.url;
      } else {
        throw new Error("No se pudo iniciar el proceso de pago");
      }
    } catch (error) {
      logger.error("Error al iniciar el pago:", error);
      toast({
        title: "Error de pago",
        description: "No se pudo iniciar el proceso de pago. Inténtalo nuevamente.",
        variant: "destructive"
      });
      setLoadingApps(prev => ({ ...prev, [app.id]: false }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Boostify{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600">
                  Store
                </span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Power up your music career with our suite of professional tools, bots, and mobile applications
              </p>
            </motion.div>
          </div>

          {/* Store Tabs */}
          <Tabs defaultValue="bots" className="w-full mb-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="bots">Automation Bots</TabsTrigger>
              <TabsTrigger value="apps">Mobile Apps</TabsTrigger>
            </TabsList>
            
            {/* Bots Tab Content */}
            <TabsContent value="bots">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">
                  Social Media{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600">
                    Automation Bots
                  </span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Optimize your social media presence with our professional automation tools
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <Card className="relative p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5 border-orange-500/20 hover:border-orange-500/40">
                      {product.popular && (
                        <Badge className="absolute top-4 right-4 bg-orange-500">Popular</Badge>
                      )}
                      {product.premium && (
                        <Badge className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-purple-500">Premium</Badge>
                      )}

                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-orange-500/10 rounded-xl">
                          {product.icon && React.createElement(product.icon, {
                            className: "h-8 w-8 text-orange-500"
                          })}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold">{product.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {product.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 mb-6">
                        {product.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-orange-500 flex-shrink-0" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 pt-6 border-t border-orange-500/20">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">${product.price}</span>
                            <span className="text-sm text-muted-foreground">/month</span>
                          </div>
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
                            {product.platform === 'all' ? 'All platforms' :
                              product.platform.charAt(0).toUpperCase() + product.platform.slice(1)}
                          </Badge>
                        </div>
                        <Button 
                          className="w-full bg-orange-500 hover:bg-orange-600" 
                          onClick={() => handlePurchaseProduct(product)}
                          disabled={loadingProducts[product.id] || purchasedProducts[product.id]}
                        >
                          {purchasedProducts[product.id] ? (
                            <>
                              Purchased
                              <CheckCircle2 className="ml-2 h-4 w-4" />
                            </>
                          ) : loadingProducts[product.id] ? (
                            <>
                              Processing...
                              <span className="ml-2 animate-spin">⚙️</span>
                            </>
                          ) : (
                            <>
                              Purchase Now
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
            
            {/* Mobile Apps Tab Content */}
            <TabsContent value="apps">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">
                  Mobile{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600">
                    Apps
                  </span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Boost your creativity with our professional mobile applications for musicians and content creators
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {mobileApps.map((app, index) => (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <Card className="relative p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5 border-orange-500/20 hover:border-orange-500/40">
                      {app.beta && (
                        <Badge className="absolute top-4 right-4 bg-blue-500">Beta</Badge>
                      )}
                      {app.popular && !app.beta && (
                        <Badge className="absolute top-4 right-4 bg-orange-500">Popular</Badge>
                      )}
                      {app.premium && !app.beta && (
                        <Badge className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-purple-500">Premium</Badge>
                      )}

                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-orange-500/10 rounded-xl">
                          {app.icon && React.createElement(app.icon, {
                            className: "h-8 w-8 text-orange-500"
                          })}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold">{app.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {app.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 mb-6">
                        {app.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-orange-500 flex-shrink-0" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 pt-6 border-t border-orange-500/20">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">${app.price}</span>
                            <span className="text-sm text-muted-foreground">/once</span>
                          </div>
                          <div className="flex space-x-1">
                            {app.platforms && Array.isArray(app.platforms) && app.platforms.includes("iOS") && (
                              <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
                                <SiApple className="mr-1 h-3 w-3" /> iOS
                              </Badge>
                            )}
                            {app.platforms && Array.isArray(app.platforms) && app.platforms.includes("Android") && (
                              <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
                                <SiAndroid className="mr-1 h-3 w-3" /> Android
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button 
                          className="w-full bg-orange-500 hover:bg-orange-600"
                          onClick={() => handlePurchaseApp(app)}
                          disabled={loadingApps[app.id] || purchasedApps[app.id]}
                        >
                          {purchasedApps[app.id] ? (
                            <>
                              {app.beta ? "Beta Access" : "Download"}
                              <Download className="ml-2 h-4 w-4" />
                            </>
                          ) : loadingApps[app.id] ? (
                            <>
                              Processing...
                              <span className="ml-2 animate-spin">⚙️</span>
                            </>
                          ) : (
                            <>
                              {app.beta ? "Join Beta" : "Download"}
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Features Section */}
          <div className="mt-16 text-center">
            <h2 className="text-3xl font-bold mb-10">
              Why Choose Our{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600">
                Products
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Zap, title: "High Performance", description: "Optimized for maximum efficiency" },
                { icon: Shield, title: "100% Secure", description: "Compliant with all regulations" },
                { icon: Users, title: "24/7 Support", description: "Technical team always available" },
                { icon: Activity, title: "Regular Updates", description: "Continuous improvements guaranteed" }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-6 rounded-xl bg-orange-500/5 border border-orange-500/20"
                >
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-orange-500/10 rounded-xl">
                      {feature.icon && React.createElement(feature.icon, {
                        className: "h-6 w-6 text-orange-500"
                      })}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}