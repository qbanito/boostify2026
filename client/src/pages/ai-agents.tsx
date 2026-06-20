import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { logger } from "../lib/logger";
import { Header } from "../components/layout/header";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { PlanTierGuard } from "../components/youtube-views/plan-tier-guard";
import { ArtistLandingPage } from "../components/artist/artist-landing-page";
import { isAdminEmail } from "../../../shared/constants";
import { useUser } from "@clerk/clerk-react";
import { 
  Brain, 
  Database, 
  Music2, 
  Video, 
  BarChart2, 
  ShoppingBag, 
  Users, 
  Briefcase,
  Camera,
  Search,
  HelpCircle,
  ChevronRight,
  Sparkles,
  Star,
  History,
  Bookmark,
  Info,
  Lightbulb,
  TrendingUp,
  Calendar,
  Clock,
  Award,
  CheckCircle2,
  Zap,
  ArrowRight,
  Play,
  ExternalLink,
  MessageSquare,
  Store
} from "lucide-react";
import { agentUsageService } from "../lib/services/agent-usage-service";
import { ComposerAgent } from "../components/ai/composer-agent";
import { VideoDirectorAgent } from "../components/ai/video-director-agent";
import { MarketingAgent } from "../components/ai/marketing-agent";
import { SocialMediaAgent } from "../components/ai/social-media-agent";
import { MerchandiseAgent } from "../components/ai/merchandise-agent";
import { ManagerAgent } from "../components/ai/manager-agent";
import { PhotographerAgent } from "../components/ai/photographer-agent";
import { ArtistSelector } from "../components/ai/artist-selector";
import { AgentCard, AgentCardCompact } from "../components/ai/agent-card";
import { ModernAgentCard } from "../components/ai/modern-agent-card";
// Lazy-load heavy tab dashboards so they're only fetched when their tab opens.
const AIDataManager = lazy(() => import("../components/ai/ai-data-manager").then(m => ({ default: m.AIDataManager })));
const AgentSDKChat = lazy(() => import("../components/ai/agent-sdk-chat").then(m => ({ default: m.AgentSDKChat })));
const AgentAnalyticsDashboard = lazy(() => import("../components/ai/agent-analytics-dashboard").then(m => ({ default: m.AgentAnalyticsDashboard })));
const AgentPerformanceDashboard = lazy(() => import("../components/ai/agent-performance-dashboard").then(m => ({ default: m.AgentPerformanceDashboard })));
const AgentMarketplace = lazy(() => import("../components/ai/agent-marketplace").then(m => ({ default: m.AgentMarketplace })));
import { QuickActionsPanel } from "../components/ai/quick-actions-panel";
import { useArtistContext } from "../hooks/use-artist-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "../components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { Badge } from "../components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Link } from "wouter";
import { useAuth } from "../hooks/use-auth";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.2 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

// Agentes con información mejorada y metadatos adicionales
const agentInfo = [
  {
    id: "composer",
    name: "AI Music Composer",
    description: "Your creative companion for musical composition",
    longDescription: "Create original songs, generate professional lyrics, and experiment with new genres. This AI understands music theory and can adapt to any style.",
    icon: Music2,
    color: "from-purple-600 to-blue-600",
    category: "creative",
    component: ComposerAgent,
    trending: true,
    isNew: false,
    linkedPage: "/music-video-creator",
    linkedPageLabel: "Create Video",
    useCases: [
      "Create original songs matching your style",
      "Generate lyrics for specific themes",
      "Experiment with new music genres",
      "Get chord progressions and melodies"
    ],
    quickTip: "Include references to similar artists for better results",
    benefits: [
      "Save time in creative processes",
      "Overcome writer's block",
      "Explore new musical possibilities",
      "Professional quality output"
    ],
    recommendedWith: ["video-director", "marketing"]
  },
  {
    id: "video-director",
    name: "Video Director AI",
    description: "Create stunning music videos with AI assistance",
    longDescription: "From concept to storyboard, get complete video direction assistance. Generate scene-by-scene scripts with camera angles, lighting, and visual effects.",
    icon: Video,
    color: "from-rose-500 to-pink-600",
    category: "visual",
    component: VideoDirectorAgent,
    trending: true,
    isNew: false,
    linkedPage: "/music-video-creator",
    linkedPageLabel: "Video Creator",
    useCases: [
      "Conceptualize innovative music videos",
      "Create detailed scene-by-scene scripts",
      "Get visual ideas that complement your music",
      "Plan camera movements and transitions"
    ],
    quickTip: "Include the emotional tone you want to convey for better concepts",
    benefits: [
      "Reduce pre-production planning time",
      "Find unique visual concepts",
      "Better align visuals with your music",
      "Professional storyboards"
    ],
    recommendedWith: ["composer", "social-media"]
  },
  {
    id: "photographer",
    name: "AI Photographer",
    description: "Generate professional album covers and promotional images",
    longDescription: "Create stunning cover art and promotional photos using AI. Upload reference images to maintain consistency with your artistic vision.",
    icon: Camera,
    color: "from-cyan-500 to-blue-600",
    category: "visual",
    component: PhotographerAgent,
    trending: true,
    isNew: true,
    linkedPage: "/my-artists",
    linkedPageLabel: "My Artists",
    useCases: [
      "Create stunning album/single cover art",
      "Generate promotional images with different styles",
      "Use reference images to inspire AI-generated photos",
      "Create consistent visual branding"
    ],
    quickTip: "Upload reference images for better style matching",
    benefits: [
      "Professional studio-quality images",
      "Multiple artistic styles available",
      "Save time and costs on photoshoots",
      "Unlimited creative iterations"
    ],
    recommendedWith: ["composer", "video-director"]
  },
  {
    id: "marketing",
    name: "Strategic Marketing AI",
    description: "Develop effective marketing strategies for your music",
    longDescription: "Get data-driven marketing strategies tailored to your music and audience. Plan launches, optimize campaigns, and maximize your reach.",
    icon: BarChart2,
    color: "from-blue-500 to-indigo-600",
    category: "marketing",
    component: MarketingAgent,
    trending: false,
    isNew: false,
    linkedPage: "/youtube-views",
    linkedPageLabel: "Growth Tools",
    useCases: [
      "Create launch plans for singles and albums",
      "Develop optimized social media campaigns",
      "Analyze metrics and improve existing strategies",
      "Budget allocation recommendations"
    ],
    quickTip: "Clearly define your target audience for more effective strategies",
    benefits: [
      "Increase audience reach",
      "Optimize marketing budget",
      "Personalize promotion for different platforms",
      "Track and measure results"
    ],
    recommendedWith: ["social-media", "manager"]
  },
  {
    id: "social-media",
    name: "Social Media Agent",
    description: "Optimize your presence across social platforms",
    longDescription: "Master every platform with AI-powered content strategies. Get posting schedules, content ideas, and engagement tactics tailored to your audience.",
    icon: Users,
    color: "from-green-500 to-emerald-600",
    category: "marketing",
    component: SocialMediaAgent,
    trending: true,
    isNew: false,
    linkedPage: "/dashboard",
    linkedPageLabel: "Dashboard",
    useCases: [
      "Develop optimized content calendars",
      "Generate post ideas to increase engagement",
      "Create platform-specific strategies",
      "Hashtag and trend optimization"
    ],
    quickTip: "Share examples of successful previous posts for better recommendations",
    benefits: [
      "Save time on content planning",
      "Maintain consistent posting schedule",
      "Increase follower engagement",
      "Cross-platform optimization"
    ],
    recommendedWith: ["marketing", "video-director"]
  },
  {
    id: "merchandise",
    name: "Merchandise Designer",
    description: "Create custom merch designs for your brand",
    longDescription: "Design unique merchandise that represents your brand. From t-shirts to accessories, get AI-generated designs that resonate with your fans.",
    icon: ShoppingBag,
    color: "from-amber-500 to-orange-600",
    category: "visual",
    component: MerchandiseAgent,
    trending: false,
    isNew: false,
    linkedPage: "/merch",
    linkedPageLabel: "Merch Store",
    useCases: [
      "Design unique merch based on your artistic identity",
      "Create themed collections for events and releases",
      "Get suggestions to maximize revenue with merchandise"
    ],
    quickTip: "Provide visual elements of your brand for consistent designs",
    benefits: [
      "Create multiple design concepts quickly",
      "Align merchandise with your brand identity",
      "Expand revenue streams beyond music",
      "Production-ready designs for your store"
    ],
    recommendedWith: ["marketing", "manager"]
  },
  {
    id: "manager",
    name: "Career Manager AI",
    description: "Strategic career planning and management assistance",
    longDescription: "Get personalized career advice based on your goals. From contract negotiations to strategic decisions, your AI manager is always available.",
    icon: Briefcase,
    color: "from-cyan-500 to-blue-600",
    category: "business",
    component: ManagerAgent,
    trending: false,
    isNew: false,
    linkedPage: "/dashboard",
    linkedPageLabel: "Dashboard",
    useCases: [
      "Plan and optimize your music career path",
      "Receive guidance on strategic decisions",
      "Get help with contracts and negotiations",
      "Industry networking strategies"
    ],
    quickTip: "Be specific about your short and long-term goals for better advice",
    benefits: [
      "Make more informed business decisions",
      "Develop a structured career plan",
      "Optimize resources and opportunities",
      "24/7 career guidance"
    ],
    recommendedWith: ["marketing", "social-media"]
  }
];

// Definir las categorías de agentes
const agentCategories = [
  { id: "all", name: "Todos los agentes", icon: Brain },
  { id: "creative", name: "Creatividad", icon: Music2 },
  { id: "marketing", name: "Marketing", icon: BarChart2 },
  { id: "visual", name: "Visual", icon: Video },
  { id: "business", name: "Negocios", icon: Briefcase }
];

export default function AIAgentsPage() {
  const { user } = useAuth();
  const { user: clerkUser } = useUser();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [recentAgents, setRecentAgents] = useState<string[]>([]);
  const [bookmarkedAgents, setBookmarkedAgents] = useState<string[]>([]);

  // Artist context for agents
  const { 
    artists, 
    selectedArtist, 
    setSelectedArtistId, 
    isLoading: isLoadingArtists 
  } = useArtistContext();

  // Check if user is admin
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || "";
  const isAdmin = isAdminEmail(userEmail);
  
  // Cargar historial reciente y agentes favoritos
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        // Usar el servicio de agentes para obtener los datos del usuario
        const userId = user?.uid || 'anonymous';
        logger.info(`Loading user data for ${userId}`);
        
        // Obtener agentes favoritos usando el servicio
        const savedBookmarks = await agentUsageService.getBookmarkedAgents(userId);
        
        // Verificar si tenemos datos válidos
        if (savedBookmarks && Array.isArray(savedBookmarks) && savedBookmarks.length > 0) {
          setBookmarkedAgents(savedBookmarks);
          logger.info("Bookmarked agents loaded from service:", savedBookmarks);
        } else {
          // Si no hay datos en el servicio, intentar con localStorage como fallback
          try {
            const storedBookmarked = localStorage.getItem('bookmarkedAgents');
            const parsedBookmarked = storedBookmarked ? JSON.parse(storedBookmarked) : null;
            
            if (Array.isArray(parsedBookmarked) && parsedBookmarked.length > 0) {
              setBookmarkedAgents(parsedBookmarked);
              logger.info("Bookmarked agents loaded from localStorage:", parsedBookmarked);
            } else {
              // Si no hay datos en localStorage, usar valores predeterminados
              setBookmarkedAgents(["composer", "manager"]);
              logger.info("Using default bookmarked agents");
            }
          } catch (localError) {
            logger.error("Error loading bookmarks from localStorage:", localError);
            setBookmarkedAgents(["composer", "manager"]);
          }
        }
        
        // Obtener agentes recientes usando el servicio
        const savedRecentAgents = await agentUsageService.getRecentAgents(userId);
        
        // Verificar si tenemos datos válidos
        if (savedRecentAgents && Array.isArray(savedRecentAgents) && savedRecentAgents.length > 0) {
          setRecentAgents(savedRecentAgents);
          logger.info("Recent agents loaded from service:", savedRecentAgents);
          return; // Si ya tenemos datos válidos, no es necesario seguir
        } 
        
        // Si no hay datos en el servicio, intentar con localStorage como fallback
        try {
          const storedRecent = localStorage.getItem('recentAgents');
          const parsedRecent = storedRecent ? JSON.parse(storedRecent) : null;
          
          if (Array.isArray(parsedRecent) && parsedRecent.length > 0) {
            setRecentAgents(parsedRecent);
            logger.info("Recent agents loaded from localStorage:", parsedRecent);
            return; // Si ya obtuvimos datos, no es necesario seguir
          }
        } catch (localError) {
          logger.error("Error loading recent agents from localStorage:", localError);
        }
        
        // Si todavía no tenemos datos, buscar en las colecciones
        logger.info("No stored interactions found, checking collections...");
        
        try {
          // Importamos las funciones de Firebase aquí para evitar problemas 
          const { db } = await import("../firebase");
          const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
          const { AGENT_COLLECTIONS } = await import("../lib/api/openrouteraiagents");
          
          // Consultar historial reciente basado en las últimas interacciones
          // — paralelizado con Promise.allSettled para no bloquear secuencialmente.
          const agentTypes = Object.keys(AGENT_COLLECTIONS);
          const results = await Promise.allSettled(
            agentTypes.map(async (agentType) => {
              const collectionName = AGENT_COLLECTIONS[agentType];
              const recentQuery = query(
                collection(db, collectionName),
                where('userId', '==', userId),
                orderBy('timestamp', 'desc'),
                limit(1) // 1 doc is enough to know whether the agent was used
              );
              const snap = await getDocs(recentQuery);
              return { agentType, hasRecent: !snap.empty };
            })
          );

          const recentAgentTypes: string[] = [];
          for (const r of results) {
            if (r.status === 'fulfilled' && r.value.hasRecent) {
              recentAgentTypes.push(r.value.agentType);
            } else if (r.status === 'rejected') {
              logger.error('Error querying agent collection:', r.reason);
            }
          }

          if (recentAgentTypes.length > 0) {
            logger.info("Setting recent agents from Firestore:", recentAgentTypes);
            setRecentAgents(recentAgentTypes);
          } else {
            // Usar valores predeterminados si no hay interacciones recientes
            logger.info("No recent agent interactions found, using defaults");
            setRecentAgents(["composer", "marketing", "video-director"]);
          }
        } catch (firebaseError) {
          logger.error("Error querying Firestore collections:", firebaseError);
          // Usar valores predeterminados en caso de error
          setRecentAgents(["composer", "marketing", "video-director"]);
        }
        
      } catch (error) {
        logger.error("Error loading user preferences:", error);
        // Usar valores predeterminados en caso de error
        setRecentAgents(["composer", "marketing", "video-director"]);
        setBookmarkedAgents(["composer", "manager"]);
      }
    };
    
    loadUserPreferences();
  }, [user]);

  // Filtrar agentes según búsqueda y categoría (memoizado para evitar
  // recomputarlo en cada render no relacionado).
  const filteredAgents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return agentInfo.filter(agent => {
      const matchesSearch = q === "" ||
        agent.name.toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === "all" || agent.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Función para alternar un agente en favoritos
  const toggleBookmark = async (agentId: string) => {
    // Asegurarse de que el agentId sea válido
    if (!agentId || typeof agentId !== 'string') {
      logger.error('Invalid agent ID provided to toggleBookmark');
      return;
    }

    try {
      // Primero intentamos usar el servicio de agentes que maneja
      // tanto Firestore como localStorage de manera centralizada
      const userId = user?.uid || 'anonymous';
      logger.info(`Toggling bookmark for agent ${agentId} for user ${userId}`);
      
      // El servicio devuelve true si se añadió, false si se quitó
      const isNowBookmarked = await agentUsageService.toggleBookmark(agentId, userId);
      
      // Luego obtenemos la lista actualizada 
      const updatedBookmarks = await agentUsageService.getBookmarkedAgents(userId);
      
      // Si el servicio nos devuelve datos válidos, actualizamos la UI
      if (updatedBookmarks) {
        setBookmarkedAgents(updatedBookmarks);
        logger.info(`Agent ${agentId} ${isNowBookmarked ? 'added to' : 'removed from'} bookmarks via service`);
        return;
      }
    } catch (error) {
      logger.error('Error using agent usage service for bookmarks:', error);
    }
    
    // Si el servicio falló o devolvió datos vacíos, usamos el enfoque anterior
    logger.info("Using fallback method for bookmarks");
    
    let newBookmarked: string[] = [];
    
    if (bookmarkedAgents.includes(agentId)) {
      // Quitar de favoritos
      newBookmarked = bookmarkedAgents.filter(id => id !== agentId);
      logger.info(`Removing ${agentId} from bookmarks (fallback)`);
    } else {
      // Añadir a favoritos
      newBookmarked = [...bookmarkedAgents, agentId];
      logger.info(`Adding ${agentId} to bookmarks (fallback)`);
    }
    
    // Actualizar estado local inmediatamente para mejor UX
    setBookmarkedAgents(newBookmarked);
    
    // Guardar siempre en localStorage como respaldo
    try {
      localStorage.setItem('bookmarkedAgents', JSON.stringify(newBookmarked));
      logger.info('Bookmarks saved to localStorage:', newBookmarked);
    } catch (error) {
      logger.error('Error saving bookmarks to localStorage:', error);
    }
    
    // Si no hay usuario autenticado, terminamos aquí
    if (!user) return;
    
    try {
      // Guardar en Firestore para usuarios autenticados
      const { doc, setDoc, getDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import("../firebase");
      
      const userPrefsRef = doc(db, 'userPreferences', user.uid);
      
      // Verificar si el documento existe
      const userPrefsSnap = await getDoc(userPrefsRef);
      
      if (userPrefsSnap.exists()) {
        // Actualizar documento existente
        await setDoc(userPrefsRef, {
          ...userPrefsSnap.data(),
          bookmarkedAgents: newBookmarked,
          updatedAt: serverTimestamp()
        }, { merge: true });
        logger.info('Bookmarks updated in existing Firestore document');
      } else {
        // Crear nuevo documento
        await setDoc(userPrefsRef, {
          userId: user.uid,
          recentAgents: recentAgents, // Guardar también los agentes recientes actuales
          bookmarkedAgents: newBookmarked,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        logger.info('New preferences document created in Firestore with bookmarks');
      }
    } catch (error) {
      logger.error('Error saving bookmarks to Firestore:', error);
    }
  };

  // Función para actualizar el historial de agentes recientes cuando se selecciona uno
  const updateRecentAgents = async (agentId: string) => {
    // Asegurarse de que el agentId sea válido
    if (!agentId || typeof agentId !== 'string') {
      logger.error('Invalid agent ID provided to updateRecentAgents');
      return;
    }
    
    try {
      // Primero, registrar el uso del agente en nuestro servicio
      // Esto manejará tanto usuarios autenticados como anónimos
      const userId = user?.uid || 'anonymous';
      logger.info(`Recording usage of agent ${agentId} for user ${userId}`);
      
      await agentUsageService.recordAgentUsage(agentId, userId);
      
      // Luego obtener la lista actualizada de agentes recientes
      const updatedRecentAgents = await agentUsageService.getRecentAgents(userId);
      
      // Actualizar el estado local para la UI
      if (updatedRecentAgents && updatedRecentAgents.length > 0) {
        setRecentAgents(updatedRecentAgents);
        logger.info('Recent agents updated from service:', updatedRecentAgents);
        return;
      }
    } catch (error) {
      logger.error('Error using agent usage service:', error);
    }
    
    // Si llegamos aquí, el servicio falló o devolvió datos vacíos
    // Usamos el enfoque anterior como respaldo
    logger.info("Using fallback method for recent agents");
    
    // Evitar duplicados moviendo el agentId al principio si ya existe
    let updatedRecentAgents: string[] = [];
    if (recentAgents.includes(agentId)) {
      updatedRecentAgents = [
        agentId,
        ...recentAgents.filter(id => id !== agentId)
      ];
      logger.info(`Repositioning ${agentId} at the top of recent agents`);
    } else {
      // Agregar al principio, manteniendo sólo los 3 más recientes
      updatedRecentAgents = [
        agentId,
        ...recentAgents.slice(0, 2)
      ];
      logger.info(`Adding ${agentId} to recent agents`);
    }
    
    // Actualizar estado local inmediatamente para mejor UX
    setRecentAgents(updatedRecentAgents);
    
    // Guardar en localStorage para usuarios no autenticados
    if (!user) {
      try {
        localStorage.setItem('recentAgents', JSON.stringify(updatedRecentAgents));
        logger.info('Recent agents saved to localStorage:', updatedRecentAgents);
      } catch (error) {
        logger.error('Error saving recent agents to localStorage:', error);
      }
      return;
    }
    
    try {
      // Guardar en Firestore para usuarios autenticados
      const { doc, setDoc, getDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import("../firebase");
      
      // Asegurarnos de tener un ID de usuario válido, usando 'anonymous' como fallback
      const userId = user?.uid || 'anonymous';
      logger.info(`Saving recent agents for user ${userId}`);
      
      const userPrefsRef = doc(db, 'userPreferences', userId);
      
      // Verificar si el documento existe
      const userPrefsSnap = await getDoc(userPrefsRef);
      
      if (userPrefsSnap.exists()) {
        // Actualizar documento existente
        await setDoc(userPrefsRef, {
          ...userPrefsSnap.data(),
          recentAgents: updatedRecentAgents,
          updatedAt: serverTimestamp()
        }, { merge: true });
        logger.info('Recent agents updated in existing Firestore document');
      } else {
        // Crear nuevo documento
        await setDoc(userPrefsRef, {
          userId: userId,
          recentAgents: updatedRecentAgents,
          bookmarkedAgents: bookmarkedAgents, // Guardar también los favoritos actuales
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        logger.info('New preferences document created in Firestore with recent agents');
      }
      
      logger.info('Recent agents saved to Firestore:', updatedRecentAgents);
    } catch (error) {
      logger.error('Error saving recent agents to Firestore:', error);
      
      // Guardar en localStorage como fallback si falla Firestore
      try {
        localStorage.setItem('recentAgents', JSON.stringify(updatedRecentAgents));
        logger.info('Recent agents saved to localStorage as fallback');
      } catch (localError) {
        logger.error('Error saving recent agents to localStorage:', localError);
      }
    }
  };

  // Obtener el componente del agente seleccionado
  const SelectedAgentComponent = selectedAgent 
    ? agentInfo.find(a => a.id === selectedAgent)?.component
    : null;
    
  // Actualizar historial reciente cuando se selecciona un agente
  useEffect(() => {
    if (selectedAgent) {
      updateRecentAgents(selectedAgent);
    }
  }, [selectedAgent]);

  const pageContent = (
    <div className="min-h-screen flex flex-col bg-[#0A0A0F] relative overflow-hidden">
      <Header />
      <main className="flex-1 pt-16 relative z-10">
        {/* === Modern animated background === */}
        <div className="fixed inset-0 pointer-events-none z-0">
          {/* Mesh gradient base */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.08),transparent_50%),radial-gradient(circle_at_80%_60%,rgba(168,85,247,0.08),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(59,130,246,0.06),transparent_50%)]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.025]"
               style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
          {/* Floating orbs */}
          <motion.div
            className="absolute top-20 left-[10%] w-72 h-72 rounded-full bg-orange-500/10 blur-[80px]"
            animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/3 right-[15%] w-96 h-96 rounded-full bg-purple-500/10 blur-[100px]"
            animate={{ x: [0, -80, 0], y: [0, 60, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-20 left-[40%] w-80 h-80 rounded-full bg-blue-500/10 blur-[90px]"
            animate={{ x: [0, 50, 0], y: [0, -40, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Subtle particles */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white/40"
              style={{
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
              animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: Math.random() * 6 + 4, repeat: Infinity, delay: Math.random() * 3 }}
            />
          ))}
        </div>
        
        <div className="container mx-auto px-4 py-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            {/* === Modern Hero === */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 backdrop-blur-xl mb-8 group">
              {/* Animated conic border */}
              <div className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden opacity-30">
                <motion.div
                  className="absolute -inset-[150%] bg-[conic-gradient(from_0deg,rgba(249,115,22,0.3),rgba(168,85,247,0.3),rgba(59,130,246,0.3),rgba(249,115,22,0.3))]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                />
              </div>

              {/* Inner glass surface */}
              <div className="relative bg-gradient-to-br from-[#15151B]/95 via-[#1A1A22]/95 to-[#0F0F13]/95 rounded-3xl p-6 md:p-10 backdrop-blur-xl">
                {/* Background accent glows */}
                <motion.div
                  className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/15 rounded-full blur-[120px]"
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
                <motion.div
                  className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/15 rounded-full blur-[100px]"
                  animate={{ opacity: [0.7, 0.4, 0.7] }}
                  transition={{ duration: 4, repeat: Infinity }}
                />

                <div className="relative z-10">
                  <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
                    <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6 flex-1">
                      {/* Animated brain orb */}
                      <motion.div
                        className="relative shrink-0"
                        whileHover={{ scale: 1.05 }}
                      >
                        <motion.div
                          className="p-5 rounded-3xl bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 shadow-2xl"
                          animate={{
                            boxShadow: [
                              '0 20px 60px rgba(249,115,22,0.4)',
                              '0 20px 60px rgba(168,85,247,0.4)',
                              '0 20px 60px rgba(59,130,246,0.4)',
                              '0 20px 60px rgba(249,115,22,0.4)',
                            ],
                          }}
                          transition={{ duration: 6, repeat: Infinity }}
                        >
                          <Brain className="h-12 w-12 md:h-14 md:w-14 text-white" />
                        </motion.div>
                        {/* Orbiting dots */}
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-orange-400"
                            style={{ marginLeft: -4, marginTop: -4 }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4 + i, repeat: Infinity, ease: 'linear', delay: i * 0.5 }}
                          >
                            <motion.div
                              className="absolute w-2 h-2 rounded-full"
                              style={{
                                background: i === 0 ? '#f97316' : i === 1 ? '#a855f7' : '#3b82f6',
                                left: 50 + i * 10,
                                boxShadow: '0 0 12px currentColor',
                              }}
                            />
                          </motion.div>
                        ))}
                      </motion.div>

                      <div className="flex-1 min-w-0">
                        <motion.div
                          className="flex items-center gap-2 mb-2"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <Badge className="bg-gradient-to-r from-orange-500/20 to-purple-500/20 text-orange-300 border border-orange-500/30 backdrop-blur-sm">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI POWERED · {agentInfo.length} AGENTS
                          </Badge>
                          <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                            LIVE
                          </Badge>
                        </motion.div>

                        <motion.h1
                          className="text-3xl md:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <span className="block bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-400">
                            AI Agents
                          </span>
                          <span className="block bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500">
                            Orchestra
                          </span>
                        </motion.h1>

                        <motion.p
                          className="text-base md:text-lg text-gray-400 mt-3 max-w-2xl leading-relaxed"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                        >
                          Your personal team of AI specialists — composers, directors, marketers and managers.
                          They learn your style and ship in seconds.
                        </motion.p>

                        {/* Stats grid */}
                        <motion.div
                          className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                        >
                          {[
                            { icon: Zap, label: 'Specialized', value: `${agentInfo.length}`, sub: 'AI agents', color: 'from-orange-500 to-amber-500' },
                            { icon: Sparkles, label: 'Generations', value: '∞', sub: 'unlimited', color: 'from-purple-500 to-pink-500' },
                            { icon: TrendingUp, label: 'Avg accuracy', value: '94%', sub: 'last 30d', color: 'from-blue-500 to-cyan-500' },
                            { icon: CheckCircle2, label: 'Connected', value: artists?.length ?? 0, sub: 'your artists', color: 'from-emerald-500 to-teal-500' },
                          ].map((s, i) => {
                            const SIco = s.icon;
                            return (
                              <motion.div
                                key={s.label}
                                whileHover={{ y: -2, scale: 1.02 }}
                                className="relative bg-white/[0.03] border border-white/10 rounded-xl p-3 backdrop-blur-sm overflow-hidden group/stat"
                              >
                                <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-0 group-hover/stat:opacity-10 transition-opacity`} />
                                <div className="relative">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <SIco className={`h-3.5 w-3.5 bg-clip-text text-transparent bg-gradient-to-r ${s.color}`} style={{ color: 'currentColor' }} />
                                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{s.label}</span>
                                  </div>
                                  <div className={`text-2xl md:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br ${s.color}`}>
                                    {s.value}
                                  </div>
                                  <div className="text-[10px] text-gray-500">{s.sub}</div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full xl:w-auto xl:min-w-[300px]">
                      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 backdrop-blur-sm">
                        <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 block font-medium">Working with</label>
                        <ArtistSelector
                          artists={artists}
                          selectedArtist={selectedArtist}
                          onSelect={(id) => setSelectedArtistId(id)}
                          isLoading={isLoadingArtists}
                          className="w-full"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Link href="/ai-advisors">
                          <Button variant="outline" className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10 backdrop-blur-sm">
                            <HelpCircle className="h-4 w-4 mr-2" />
                            Advisors
                          </Button>
                        </Link>
                        <Button
                          className="w-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white border-0 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow"
                          onClick={() => setActiveTab("data")}
                        >
                          <Database className="h-4 w-4 mr-2" />
                          Analytics
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions Panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <QuickActionsPanel
              onSelectAgent={(agentId) => {
                setSelectedAgent(agentId);
                setActiveTab("agents");
              }}
            />
          </motion.div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full gap-1.5 p-1.5 bg-white/[0.03] rounded-2xl border border-white/10 backdrop-blur-xl h-auto">
              {[
                { value: 'overview', label: 'Explore', icon: Sparkles },
                { value: 'ai-chat', label: 'AI Chat', icon: MessageSquare },
                { value: 'agents', label: 'Agents', icon: Brain },
                { value: 'performance', label: 'Performance', icon: TrendingUp },
                { value: 'marketplace', label: 'Marketplace', icon: Store },
                { value: 'data', label: 'Analytics', icon: Database },
              ].map(t => {
                const TIco = t.icon;
                return (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="gap-2 text-sm py-2.5 rounded-xl transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:via-pink-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 text-gray-400 hover:text-white"
                  >
                    <TIco className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Overview Tab - New dashboard style view */}
            <TabsContent value="overview">
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-8"
              >
                {/* Search and filters */}
                <motion.div
                  variants={item}
                  className="flex flex-col md:flex-row gap-3"
                >
                  <div className="relative flex-1 group">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/20 via-purple-500/20 to-blue-500/20 opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-orange-400 transition-colors" />
                      <Input
                        type="text"
                        placeholder="Search agents by name or skill…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white/[0.03] border-white/10 h-11 placeholder:text-gray-500 backdrop-blur-sm focus-visible:ring-orange-500/50 focus-visible:border-orange-500/50"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    {agentCategories.map(category => {
                      const CIco = category.icon;
                      const active = selectedCategory === category.id;
                      return (
                        <motion.button
                          key={category.id}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setSelectedCategory(category.id)}
                          className={`shrink-0 flex items-center gap-1.5 h-11 px-4 rounded-xl text-sm font-medium transition-all border backdrop-blur-sm ${
                            active
                              ? 'bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white border-transparent shadow-lg shadow-purple-500/25'
                              : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.06] hover:border-white/20'
                          }`}
                        >
                          <CIco className="h-4 w-4" />
                          {category.name}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
                
                {/* Recently used */}
                {recentAgents.length > 0 && (
                  <motion.div variants={item} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30">
                        <History className="h-4 w-4 text-orange-400" />
                      </div>
                      <h2 className="text-xl font-bold text-white">Recently used</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-orange-500/30 via-white/5 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recentAgents.map(agentId => {
                        const agent = agentInfo.find(a => a.id === agentId);
                        if (!agent) return null;
                        return (
                          <ModernAgentCard
                            key={agent.id}
                            agent={agent}
                            bookmarked={bookmarkedAgents.includes(agent.id)}
                            onSelect={() => { setSelectedAgent(agent.id); setActiveTab("agents"); }}
                            onToggleBookmark={() => toggleBookmark(agent.id)}
                          />
                        );
                      })}
                    </div>
                  </motion.div>
                )}
                
                {/* Recommended based on history */}
                {recentAgents.length > 0 && (
                  <motion.div variants={item} className="space-y-4 mt-8">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                        <Award className="h-4 w-4 text-purple-400" />
                      </div>
                      <h2 className="text-xl font-bold text-white">Personalized recommendations</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 via-white/5 to-transparent" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/20">
                              <Info className="h-3.5 w-3.5 text-purple-400" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p>Suggestions based on your previous interactions and preferences.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recentAgents.slice(0, 1).map(recentAgentId => {
                        const recentAgent = agentInfo.find(a => a.id === recentAgentId);
                        if (!recentAgent || !recentAgent.recommendedWith) return null;
                        return recentAgent.recommendedWith.map(recommendedId => {
                          const recommendedAgent = agentInfo.find(a => a.id === recommendedId);
                          if (!recommendedAgent) return null;
                          return (
                            <ModernAgentCard
                              key={`recommendation-${recommendedAgent.id}`}
                              agent={recommendedAgent}
                              bookmarked={bookmarkedAgents.includes(recommendedAgent.id)}
                              onSelect={() => { setSelectedAgent(recommendedAgent.id); setActiveTab("agents"); }}
                              onToggleBookmark={() => toggleBookmark(recommendedAgent.id)}
                              ribbon={`Because you used ${recentAgent.name}`}
                            />
                          );
                        });
                      })}
                    </div>
                  </motion.div>
                )}
                
                {/* All agents grid or filtered results */}
                <motion.div variants={item} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                      <Brain className="h-4 w-4 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">
                      {searchQuery || selectedCategory !== "all"
                        ? `Results · ${filteredAgents.length}`
                        : "All agents"}
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-blue-500/30 via-white/5 to-transparent" />
                    {(searchQuery || selectedCategory !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}
                        className="text-xs text-gray-400 hover:text-white h-7"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAgents.map(agent => (
                      <ModernAgentCard
                        key={agent.id}
                        agent={agent}
                        bookmarked={bookmarkedAgents.includes(agent.id)}
                        onSelect={() => { setSelectedAgent(agent.id); setActiveTab("agents"); }}
                        onToggleBookmark={() => toggleBookmark(agent.id)}
                      />
                    ))}
                  </div>

                  {filteredAgents.length === 0 && (
                    <div className="text-center py-12 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-sm">
                      <Search className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No agents match your filters</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}
                        className="mt-3 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                      >
                        Clear filters
                      </Button>
                    </div>
                  )}
                </motion.div>
                
                {/* Bookmarked agents */}
                {bookmarkedAgents.length > 0 && (
                  <motion.div variants={item} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
                        <Bookmark className="h-4 w-4 text-yellow-400" />
                      </div>
                      <h2 className="text-xl font-bold text-white">Bookmarked agents</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/30 via-white/5 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bookmarkedAgents.map(agentId => {
                        const agent = agentInfo.find(a => a.id === agentId);
                        if (!agent) return null;
                        return (
                          <ModernAgentCard
                            key={agent.id}
                            agent={agent}
                            bookmarked={true}
                            onSelect={() => { setSelectedAgent(agent.id); setActiveTab("agents"); }}
                            onToggleBookmark={() => toggleBookmark(agent.id)}
                          />
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </TabsContent>

            {/* AI SDK Chat Tab */}
            <TabsContent value="ai-chat">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-[#1C1C24] border-[#27272A] p-4 md:p-6">
                  <Suspense fallback={<div className="text-center text-gray-400 py-8">Cargando chat…</div>}>
                    <AgentSDKChat />
                  </Suspense>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Main Agents Tab Content */}
            <TabsContent value="agents">
              <AnimatePresence mode="wait">
                {selectedAgent ? (
                  <motion.div
                    key="agent-details"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="relative"
                  >
                    <Button
                      variant="ghost"
                      className="absolute top-0 left-0 text-sm text-gray-400 hover:text-white z-10 mb-4"
                      onClick={() => setSelectedAgent(null)}
                    >
                      ← Volver a todos los agentes
                    </Button>
                    
                    <div className="pt-12 max-w-7xl mx-auto">
                      {SelectedAgentComponent && <SelectedAgentComponent />}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="agents-grid"
                    variants={container}
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-7xl mx-auto"
                  >
                    <motion.div variants={item}><ComposerAgent /></motion.div>
                    <motion.div variants={item}><VideoDirectorAgent /></motion.div>
                    <motion.div variants={item}><MarketingAgent /></motion.div>
                    <motion.div variants={item}><SocialMediaAgent /></motion.div>
                    <motion.div variants={item}><MerchandiseAgent /></motion.div>
                    <motion.div variants={item}><ManagerAgent /></motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            {/* Performance Dashboard Tab */}
            <TabsContent value="performance">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Suspense fallback={<div className="text-center text-gray-400 py-12">Cargando dashboard…</div>}>
                  <AgentPerformanceDashboard />
                </Suspense>
              </motion.div>
            </TabsContent>

            {/* Marketplace Tab */}
            <TabsContent value="marketplace">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Suspense fallback={<div className="text-center text-gray-400 py-12">Cargando marketplace…</div>}>
                  <AgentMarketplace />
                </Suspense>
              </motion.div>
            </TabsContent>

            {/* Data & Analytics Tab */}
            <TabsContent value="data">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8"
              >
                {/* Agent Analytics Dashboard */}
                <Suspense fallback={<div className="text-center text-gray-400 py-12">Cargando analytics…</div>}>
                  <AgentAnalyticsDashboard />
                </Suspense>
                
                {/* Data Manager section below */}
                <div className="pt-6 border-t border-[#27272A]">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Database className="h-5 w-5 text-orange-500" />
                    Data Management
                  </h3>
                  <Suspense fallback={<div className="text-center text-gray-400 py-8">Cargando data manager…</div>}>
                    <AIDataManager />
                  </Suspense>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );

  // If not logged in, show landing page
  if (!user) {
    return <ArtistLandingPage />;
  }

  // If admin, return content directly; otherwise wrap with PlanTierGuard
  if (isAdmin) {
    return pageContent;
  }

  return (
    <PlanTierGuard requiredPlan="Premium">
      {pageContent}
    </PlanTierGuard>
  );
}