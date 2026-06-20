import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "../../hooks/use-auth";
import { db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "../../hooks/use-toast";
import {
  Music2,
  Bot,
  GraduationCap,
  ShoppingBag,
  Palette,
  Video,
  Building2,
  Phone,
  User,
  TrendingUp,
  Activity,
  FileText,
  Tv,
  Music,
  CreditCard,
  Puzzle,
  PlusCircle,
  Zap,
  Sparkles,
  X,
  Headphones,
  Radio,
  Archive,
  Monitor,
  Layers,
  Glasses,
  Wand2,
  Calendar,
  Mic2,
  Newspaper,
  SlidersHorizontal,
  Users,
  Megaphone,
  Globe,
  ArrowLeftRight,
  Coins,
  RefreshCcw,
  Dna,
  Star,
  Store
} from "lucide-react";
import { SiInstagram, SiSpotify, SiYoutube } from "react-icons/si";
import "./ecosystem-dashboard.css";

// Tipo para las métricas del usuario
interface UserMetrics {
  spotifyFollowers: number;
  instagramFollowers: number;
  youtubeViews: number;
  contractsCreated: number;
  prCampaigns: number;
  totalEngagement: number;
  musicVideos: number;
  aiVideos: number;
  contacts: number;
  styleRecommendations: number;
  coursesEnrolled: number;
  merchandiseSold: number;
  aiAgentsUsed: number;
  musicGenerated: number;
}

// Tipo para las herramientas del ecosistema
interface EcosystemTool {
  id: string;
  name: string;
  description: string;
  icon: any;
  route: string;
  stats: number;
  statsLabel: string;
  color: string;
  orbit: 'inner' | 'middle' | 'outer' | 'live' | 'content' | 'extra';
  angle?: number; // Ángulo para posicionar en la órbita
  orbitSpeed?: number; // Velocidad de la órbita
  animationOffset?: number; // Desplazamiento de la animación
}

export default function EcosystemDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  // Estado para las métricas del usuario
  const [metrics, setMetrics] = useState<UserMetrics>({
    spotifyFollowers: 0,
    instagramFollowers: 0,
    youtubeViews: 0,
    contractsCreated: 0,
    prCampaigns: 0,
    totalEngagement: 0,
    musicVideos: 0,
    aiVideos: 0,
    contacts: 0,
    styleRecommendations: 0,
    coursesEnrolled: 0,
    merchandiseSold: 0,
    aiAgentsUsed: 0,
    musicGenerated: 0
  });

  // Estado para la herramienta seleccionada
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  
  // Estado para el ancho de la ventana (para responsividad)
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  // Efecto para manejar el redimensionamiento de la ventana
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Efecto para cargar las métricas del usuario
  useEffect(() => {
    if (!user) return;

    const fetchMetrics = async () => {
      try {
        const userMetricsRef = doc(db, `users/${user.uid}/metrics/current`);
        const metricsDoc = await getDoc(userMetricsRef);

        if (metricsDoc.exists()) {
          const data = metricsDoc.data() as UserMetrics;
          setMetrics(data);
        }
      } catch (error) {
        logger.error('Error fetching metrics:', error);
        toast({
          title: "Error Loading Metrics",
          description: "Please try refreshing the page.",
          variant: "destructive"
        });
      }
    };

    fetchMetrics();
  }, [user, toast]);

  // Definir las herramientas para las dos órbitas EXTERIORES
  const toolsData: EcosystemTool[] = [
    // Órbita media (segunda línea) - Herramientas principales
    {
      id: "music-generator",
      name: "Music Generator",
      description: "Create AI-powered music",
      icon: Music2,
      route: "/music-generator",
      stats: metrics.musicGenerated,
      statsLabel: "Tracks",
      color: "text-orange-500",
      orbit: 'middle'
    },
    {
      id: "music-videos",
      name: "Music Videos",
      description: "Create and manage music videos",
      icon: Video,
      route: "/music-video-creator",
      stats: metrics.musicVideos,
      statsLabel: "Videos",
      color: "text-purple-600",
      orbit: 'middle'
    },
    {
      id: "ai-agents",
      name: "AI Agents",
      description: "Smart AI assistants",
      icon: Bot,
      route: "/ai-agents",
      stats: metrics.aiAgentsUsed,
      statsLabel: "Active Agents",
      color: "text-purple-500",
      orbit: 'middle'
    },
    {
      id: "artist-image",
      name: "Artist Image",
      description: "Style recommendations",
      icon: Palette,
      route: "/artist-image-advisor",
      stats: metrics.styleRecommendations,
      statsLabel: "Styles",
      color: "text-pink-500",
      orbit: 'middle'
    },
    {
      id: "store",
      name: "Merchandise",
      description: "Create custom merchandise",
      icon: ShoppingBag,
      route: "/merchandise",
      stats: metrics.merchandiseSold,
      statsLabel: "Products",
      color: "text-green-500",
      orbit: 'middle'
    },
    {
      id: "education",
      name: "Education Hub",
      description: "Learn music industry skills",
      icon: GraduationCap,
      route: "/education",
      stats: metrics.coursesEnrolled,
      statsLabel: "Courses",
      color: "text-blue-500",
      orbit: 'middle'
    },
    {
      id: "analytics",
      name: "Analytics",
      description: "Track your performance",
      icon: TrendingUp,
      route: "/analytics",
      stats: metrics.totalEngagement,
      statsLabel: "Engagement",
      color: "text-blue-600",
      orbit: 'middle'
    },

    // Órbita externa (tercera línea) - Servicios y redes sociales
    {
      id: "youtube",
      name: "YouTube Boost",
      description: "Grow your channel",
      icon: SiYoutube,
      route: "/youtube-views",
      stats: metrics.youtubeViews,
      statsLabel: "Views",
      color: "text-red-500",
      orbit: 'outer'
    },
    {
      id: "instagram",
      name: "Instagram Boost",
      description: "Increase Instagram reach",
      icon: SiInstagram,
      route: "/instagram-boost",
      stats: metrics.instagramFollowers,
      statsLabel: "Followers",
      color: "text-pink-500",
      orbit: 'outer'
    },
    {
      id: "spotify",
      name: "Spotify Boost",
      description: "Increase streams",
      icon: SiSpotify,
      route: "/spotify",
      stats: metrics.spotifyFollowers,
      statsLabel: "Followers",
      color: "text-green-500",
      orbit: 'outer'
    },
    {
      id: "tv",
      name: "Boostify TV",
      description: "Watch content",
      icon: Tv,
      route: "/boostify-tv",
      stats: 24,
      statsLabel: "Videos",
      color: "text-red-500",
      orbit: 'outer'
    },
    {
      id: "contracts",
      name: "Contracts",
      description: "Legal documents",
      icon: FileText,
      route: "/contracts",
      stats: metrics.contractsCreated,
      statsLabel: "Documents",
      color: "text-indigo-500",
      orbit: 'outer'
    },
    {
      id: "record-label",
      name: "Record Label",
      description: "Professional music services",
      icon: Building2,
      route: "/record-label-services",
      stats: metrics.totalEngagement,
      statsLabel: "Services",
      color: "text-amber-500",
      orbit: 'outer'
    },
    {
      id: "contacts",
      name: "Contacts",
      description: "Manage your network",
      icon: Phone,
      route: "/contacts",
      stats: metrics.contacts,
      statsLabel: "Contacts",
      color: "text-emerald-500",
      orbit: 'outer'
    },
    {
      id: "profile",
      name: "Profile",
      description: "Manage your profile",
      icon: User,
      route: "/profile",
      stats: 1,
      statsLabel: "Profile",
      color: "text-violet-500",
      orbit: 'outer'    },

    // ── Live & Experience Tech ─────────────────────────────────────────────
    {
      id: "mini-studio",
      name: "Mini Studio",
      description: "DAW profesional en el navegador — graba, mezcla y produce",
      icon: Headphones,
      route: "/mini-studio",
      stats: 0,
      statsLabel: "Proyectos",
      color: "text-violet-400",
      orbit: 'live'
    },
    {
      id: "crowdsync-dj",
      name: "CrowdSync DJ",
      description: "DJ en vivo con sincronización de multitud e IA",
      icon: Radio,
      route: "/boostify-crowdsync-dj",
      stats: 0,
      statsLabel: "Sesiones",
      color: "text-orange-400",
      orbit: 'live'
    },
    {
      id: "hologram-show",
      name: "Hologram Show",
      description: "Motor de espectáculos holográficos interactivos",
      icon: Monitor,
      route: "/hologram-show-engine",
      stats: 0,
      statsLabel: "Shows",
      color: "text-cyan-400",
      orbit: 'live'
    },
    {
      id: "catalog-resurrection",
      name: "Catalog Resurrection",
      description: "Revive tu catálogo con masterización y distribución IA",
      icon: Archive,
      route: "/legacy-catalog-resurrection",
      stats: 0,
      statsLabel: "Canciones",
      color: "text-amber-400",
      orbit: 'live'
    },
    {
      id: "stage-sync",
      name: "Stage Sync",
      description: "Sincroniza todos los elementos de tu escenario",
      icon: Layers,
      route: "/stage-sync",
      stats: 0,
      statsLabel: "Escenas",
      color: "text-blue-400",
      orbit: 'live'
    },
    {
      id: "vr-studio",
      name: "VR Studio",
      description: "Crea experiencias musicales de realidad virtual",
      icon: Glasses,
      route: "/vr-studio",
      stats: 0,
      statsLabel: "Escenas VR",
      color: "text-purple-400",
      orbit: 'live'
    },
    {
      id: "motion-dna",
      name: "Motion DNA",
      description: "Coreografía e identidad de movimiento con IA",
      icon: Activity,
      route: "/motion-dna",
      stats: 0,
      statsLabel: "Animaciones",
      color: "text-green-400",
      orbit: 'live'
    },
    {
      id: "character-forge",
      name: "Character Forge",
      description: "Crea avatares y personajes artísticos únicos",
      icon: Wand2,
      route: "/character-forge",
      stats: 0,
      statsLabel: "Personajes",
      color: "text-pink-400",
      orbit: 'live'
    },

    // ── Content & Media ───────────────────────────────────────────────────
    {
      id: "events",
      name: "Event Videos",
      description: "Gestiona videos y transmisiones de eventos en vivo",
      icon: Calendar,
      route: "/events",
      stats: 0,
      statsLabel: "Eventos",
      color: "text-blue-400",
      orbit: 'content'
    },
    {
      id: "podcast",
      name: "Live Podcast",
      description: "Graba y distribuye episodios de podcast en vivo",
      icon: Mic2,
      route: "/live-podcast-studio",
      stats: 0,
      statsLabel: "Episodios",
      color: "text-red-400",
      orbit: 'content'
    },
    {
      id: "news",
      name: "Music News",
      description: "Noticias y tendencias de la industria musical",
      icon: Newspaper,
      route: "/news",
      stats: 0,
      statsLabel: "Artículos",
      color: "text-gray-400",
      orbit: 'content'
    },
    {
      id: "producer-tools",
      name: "Producer Tools",
      description: "Suite completa de herramientas de producción",
      icon: SlidersHorizontal,
      route: "/producer-tools",
      stats: 0,
      statsLabel: "Herramientas",
      color: "text-indigo-400",
      orbit: 'content'
    },
    {
      id: "boostify-explicit",
      name: "Boostify Explicit",
      description: "Plataforma de contenido exclusivo para artistas",
      icon: Star,
      route: "/boostify-explicit",
      stats: 0,
      statsLabel: "Contenidos",
      color: "text-rose-400",
      orbit: 'content'
    },
    {
      id: "social-media-gen",
      name: "Social Media Gen",
      description: "Genera contenido optimizado para redes sociales",
      icon: Sparkles,
      route: "/social-media-generator",
      stats: 0,
      statsLabel: "Posts",
      color: "text-yellow-400",
      orbit: 'content'
    },

    // ── Artist & Growth Tools ─────────────────────────────────────────────
    {
      id: "my-artists",
      name: "My Artists",
      description: "Gestiona y publica tus artistas del roster",
      icon: Users,
      route: "/my-artists",
      stats: 0,
      statsLabel: "Artistas",
      color: "text-purple-400",
      orbit: 'extra'
    },
    {
      id: "artist-generator",
      name: "Artist Generator",
      description: "Crea artistas virtuales con IA en segundos",
      icon: Wand2,
      route: "/artist-generator",
      stats: 0,
      statsLabel: "Artistas IA",
      color: "text-pink-400",
      orbit: 'extra'
    },
    {
      id: "promotion",
      name: "Promotion",
      description: "Campañas de promoción multicanal",
      icon: Megaphone,
      route: "/promotion",
      stats: 0,
      statsLabel: "Campañas",
      color: "text-orange-400",
      orbit: 'extra'
    },
    {
      id: "pr",
      name: "PR & Press",
      description: "Relaciones públicas y press kits profesionales",
      icon: Newspaper,
      route: "/pr",
      stats: 0,
      statsLabel: "Notas de prensa",
      color: "text-blue-400",
      orbit: 'extra'
    },
    {
      id: "tiktok-boost",
      name: "TikTok Boost",
      description: "Crece en TikTok con estrategias IA",
      icon: TrendingUp,
      route: "/tiktok-boost",
      stats: 0,
      statsLabel: "Seguidores",
      color: "text-red-400",
      orbit: 'extra'
    },
    {
      id: "social-network",
      name: "Social Network",
      description: "Red social exclusiva para artistas Boostify",
      icon: Globe,
      route: "/social-network",
      stats: 0,
      statsLabel: "Conexiones",
      color: "text-violet-400",
      orbit: 'extra'
    },
    {
      id: "mastering",
      name: "Music Mastering",
      description: "Masterización profesional con IA",
      icon: SlidersHorizontal,
      route: "/music-mastering",
      stats: 0,
      statsLabel: "Tracks",
      color: "text-green-400",
      orbit: 'extra'
    },
    {
      id: "boostiswap",
      name: "BoostiSwap",
      description: "Intercambia y gestiona tokens BTF",
      icon: ArrowLeftRight,
      route: "/boostiswap",
      stats: 0,
      statsLabel: "Transacciones",
      color: "text-amber-400",
      orbit: 'extra'
    },
    {
      id: "plugins",
      name: "Plugins",
      description: "Plugins VST y herramientas de audio",
      icon: Puzzle,
      route: "/plugins",
      stats: 0,
      statsLabel: "Plugins",
      color: "text-indigo-400",
      orbit: 'extra'
    },
    {
      id: "artist-store",
      name: "Artist Store",
      description: "Tu tienda oficial de merch y coleccionables",
      icon: Store,
      route: "/artist-store",
      stats: 0,
      statsLabel: "Productos",
      color: "text-emerald-400",
      orbit: 'extra'    }
  ];

  // Asignar ángulos a cada herramienta basado en su posición en la órbita
  const toolsWithAngles = [...toolsData].map((tool, i, arr) => {
    // Encontrar todas las herramientas en la misma órbita
    const orbitTools = arr.filter(t => t.orbit === tool.orbit);
    const orbitIndex = orbitTools.findIndex(t => t.id === tool.id);
    const angleStep = 360 / orbitTools.length;
    
    return {
      ...tool,
      angle: orbitIndex * angleStep,
      orbitSpeed: tool.orbit === 'middle' ? 80 : 120, // Velocidad más lenta (80, 120 segundos)
      animationOffset: 0 // Añadir para evitar errores
    };
  });

  // Estado para el seguimiento de la posición de cada herramienta (para efectos de tamaño)
  const [toolPositions, setToolPositions] = useState<{[key: string]: {angle: number, distanceFromCenter: number}}>({}); 

  // Función para calcular la posición en la órbita con soporte responsive
  // Los radios deben coincidir exactamente con el CSS de las órbitas (mitad del ancho/alto)
  const getPositionInOrbit = (orbit: string, angle: number) => {
    // Detectar el tamaño de la pantalla para ajustar radios
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    
    let innerRadius = 100;  // 200px / 2
    let middleRadius = 160; // 320px / 2
    let outerRadius = 220;  // 440px / 2
    
    // Ajustar radios según el tamaño de pantalla (debe coincidir con el CSS)
    if (width >= 1440) {
      innerRadius = 125;  // 250px / 2
      middleRadius = 200; // 400px / 2
      outerRadius = 275;  // 550px / 2
    } else if (width <= 480) {
      innerRadius = 60;   // 120px / 2
      middleRadius = 100; // 200px / 2
      outerRadius = 140;  // 280px / 2
    } else if (width <= 640) {
      innerRadius = 70;   // 140px / 2
      middleRadius = 120; // 240px / 2
      outerRadius = 170;  // 340px / 2
    } else if (width <= 768) {
      innerRadius = 80;   // 160px / 2
      middleRadius = 135; // 270px / 2
      outerRadius = 190;  // 380px / 2
    } else if (width <= 1024) {
      innerRadius = 90;   // 180px / 2
      middleRadius = 150; // 300px / 2
      outerRadius = 210;  // 420px / 2
    }
    
    const radius = orbit === 'inner' ? innerRadius : orbit === 'middle' ? middleRadius : outerRadius;
    const angleRad = (angle - 90) * Math.PI / 180;
    const x = Math.cos(angleRad) * radius;
    const y = Math.sin(angleRad) * radius;
    return { x, y, radius };
  };
  
  // Función para calcular si una herramienta está en la posición "cercana al centro"
  const isApproachingCenter = (toolId: string, currentAngle: number) => {
    // Consideramos "cercano al centro" cuando está en el rango de -45 a +45 grados
    // (es decir, en la parte frontal de la órbita, más cerca del usuario)
    const normalizedAngle = ((currentAngle % 360) + 360) % 360;
    return (normalizedAngle >= 315 || normalizedAngle <= 45);
  };

  // Mensajes motivacionales para artistas
  const motivationalMessages = [
    "Unleash your creativity",
    "Your sound matters",
    "Turn passion into success",
    "Connect with your audience",
    "Elevate your music career",
    "Transform your vision into reality",
    "Reach new audiences globally",
    "Create without limits",
    "Your art, amplified"
  ];

  // Estado para el mensaje actual
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [messageVisible, setMessageVisible] = useState(true);

  // Efecto para rotar los mensajes
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageVisible(false);
      
      setTimeout(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % motivationalMessages.length);
        setMessageVisible(true);
      }, 1000); // Tiempo para el fade out antes de cambiar mensaje
      
    }, 6000); // Cambia cada 6 segundos
    
    return () => clearInterval(messageInterval);
  }, []);

  return (
    <>
    {/* Título antes del contenedor de órbitas */}
    <motion.div 
      className="text-center px-4 mb-6 md:mb-8 lg:mb-10"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
        Your Complete Creator Suite
      </h2>
      <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
        Everything you need to create, grow, and monetize your content
      </p>
    </motion.div>

    <div className="ecosystem-container">
      {/* Fondo con degradado */}
      <div className="ecosystem-bg-gradient" />
      
      {/* Efecto de partículas o brillo */}
      <div className="ecosystem-bg-texture" style={{ backgroundImage: "url('/assets/noise.svg')" }} />
      
      {/* Centro - Video en loop difuminado con resplandor mejorado */}
      <motion.div 
        className="ecosystem-avatar"
        animate={{ 
          boxShadow: [
            "0 0 25px rgba(249, 115, 22, 0.3)", 
            "0 0 40px rgba(249, 115, 22, 0.5)", 
            "0 0 25px rgba(249, 115, 22, 0.3)"
          ],
          border: [
            "2px solid rgba(249, 115, 22, 0.4)",
            "2px solid rgba(249, 115, 22, 0.7)",
            "2px solid rgba(249, 115, 22, 0.4)"
          ]
        }}
        transition={{ 
          boxShadow: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          border: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }}
      >
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          poster={user?.photoURL || undefined}
        >
          <source src="/assets/Standard_Mode_Generated_Video (9).mp4" type="video/mp4" />
        </video>
      </motion.div>
      
      {/* Órbita interna - solo línea decorativa, sin iconos */}
      <div className="orbit inner-orbit"></div>
      
      {/* Órbita media - primera órbita con iconos */}
      <div className="orbit middle-orbit">
        {toolsWithAngles
          .filter(tool => tool.orbit === 'middle')
          .map((tool, index) => {
            const middleTools = toolsWithAngles.filter(t => t.orbit === 'middle');
            const angleInDegrees = index * (360 / middleTools.length);
            const position = getPositionInOrbit('middle', angleInDegrees);
            
            return (
              <div
                key={tool.id}
                className="orbit-item"
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${position.x}px)`,
                  top: `calc(50% + ${position.y}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="ecosystem-tool-icon">
                  <Link href={tool.route}>
                    <div 
                      className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-full bg-background/40 backdrop-blur-md border border-orange-500/30 shadow-lg flex items-center justify-center cursor-pointer tool-icon-wrapper"
                      data-testid={`tool-icon-${tool.id}`}
                    >
                      <tool.icon className={`h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 ${tool.color}`} />
                      
                      <div className="ecosystem-tool-label">
                        {tool.name}
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
      </div>
      
      {/* Órbita externa - segunda órbita con iconos */}
      <div className="orbit outer-orbit">
        {toolsWithAngles
          .filter(tool => tool.orbit === 'outer')
          .map((tool, index) => {
            const outerTools = toolsWithAngles.filter(t => t.orbit === 'outer');
            const angleInDegrees = index * (360 / outerTools.length);
            const position = getPositionInOrbit('outer', angleInDegrees);
            
            return (
              <div
                key={tool.id}
                className="orbit-item"
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${position.x}px)`,
                  top: `calc(50% + ${position.y}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="ecosystem-tool-icon">
                  <Link href={tool.route}>
                    <div 
                      className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-full bg-background/40 backdrop-blur-md border border-orange-500/30 shadow-lg flex items-center justify-center cursor-pointer tool-icon-wrapper"
                      data-testid={`tool-icon-${tool.id}`}
                    >
                      <tool.icon className={`h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 ${tool.color}`} />
                      
                      <div className="ecosystem-tool-label">
                        {tool.name}
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
      </div>
      
      {/* Añadir nueva herramienta - botón en la parte inferior */}
      <motion.div 
        className="ecosystem-add-button"
        whileHover={{ scale: 1.1, backgroundColor: "#f97316" }}
        whileTap={{ scale: 0.95 }}
      >
        <PlusCircle className="h-6 w-6 text-white" />
      </motion.div>
      
      {/* Panel de información (aparece cuando se selecciona una herramienta) */}
      <AnimatePresence>
        {selectedTool && (
          <motion.div 
            className="ecosystem-info-panel"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
          >
            {/* Contenido del panel basado en la herramienta seleccionada */}
            {(() => {
              const tool = toolsWithAngles.find(t => t.id === selectedTool);
              if (!tool) return null;
              
              return (
                <div className="relative">
                  <motion.button 
                    className="absolute -top-2 -right-2 p-1.5 rounded-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 z-10"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedTool(null)}
                    data-testid="button-close-tool-panel"
                  >
                    <X className="h-4 w-4 text-orange-500" />
                  </motion.button>
                  
                  <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                    <div className={`h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0`}>
                      <tool.icon className={`h-6 w-6 ${tool.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold truncate">{tool.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className={`text-xl sm:text-2xl font-bold ${tool.color}`}>
                          {typeof tool.stats === 'number' ? tool.stats.toLocaleString() : '0'}
                        </span>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {tool.statsLabel}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Link href={tool.route} className="flex-1 sm:flex-initial">
                        <motion.button 
                          className="w-full px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-md flex items-center justify-center gap-2 text-sm"
                          whileHover={{ scale: 1.05, backgroundColor: "#ea580c" }}
                          whileTap={{ scale: 0.95 }}
                          data-testid={`button-launch-${tool.id}`}
                        >
                          <Zap className="h-4 w-4" />
                          <span>Abrir</span>
                        </motion.button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* Sección de descripción de iconos - Fuera de la órbita */}
    <div className="w-full bg-background -mt-8 md:-mt-12 py-2 md:py-4">
      <motion.div 
        className="max-w-7xl mx-auto px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {/* Core Tools - Middle Orbit */}
        <div className="mb-8">
          <h3 className="text-lg md:text-xl font-semibold mb-4 text-center text-orange-500">
            Core Creation Tools
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {toolsData.filter(tool => tool.orbit === 'middle').map((tool) => (
              <Link key={tool.id} href={tool.route}>
                <motion.div
                  className="p-3 md:p-4 rounded-lg bg-card border border-border hover:border-orange-500/30 transition-all cursor-pointer"
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`h-8 w-8 md:h-10 md:w-10 rounded-lg bg-gradient-to-br from-orange-500/10 to-pink-500/10 flex items-center justify-center border border-orange-500/20`}>
                      <tool.icon className={`h-4 w-4 md:h-5 md:w-5 ${tool.color}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs md:text-sm mb-1">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Services - Outer Orbit */}
        <div className="mb-8">
          <h3 className="text-lg md:text-xl font-semibold mb-4 text-center text-pink-500">
            Growth & Business Services
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 md:gap-4">
            {toolsData.filter(tool => tool.orbit === 'outer').map((tool) => (
              <Link key={tool.id} href={tool.route}>
                <motion.div
                  className="p-3 md:p-4 rounded-lg bg-card border border-border hover:border-pink-500/30 transition-all cursor-pointer"
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-gradient-to-br from-orange-500/10 to-pink-500/10 flex items-center justify-center border border-pink-500/20">
                      <tool.icon className={`h-4 w-4 md:h-5 md:w-5 ${tool.color}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs md:text-sm mb-1">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Live & Experience Tech */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-500/40" />
            <h3 className="text-lg md:text-xl font-semibold text-center text-cyan-400 whitespace-nowrap px-2">
              🌐 Live & Experience Tech
            </h3>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-cyan-500/40" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 md:gap-4">
            {toolsData.filter(tool => tool.orbit === 'live').map((tool) => (
              <Link key={tool.id} href={tool.route}>
                <motion.div
                  className="p-3 md:p-4 rounded-lg bg-card border border-border hover:border-cyan-500/40 transition-all cursor-pointer group"
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center border border-cyan-500/20 group-hover:border-cyan-400/50 transition-colors">
                      <tool.icon className={`h-4 w-4 md:h-5 md:w-5 ${tool.color}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs md:text-sm mb-1">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Content & Media */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-blue-500/40" />
            <h3 className="text-lg md:text-xl font-semibold text-center text-blue-400 whitespace-nowrap px-2">
              📺 Content & Media
            </h3>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-blue-500/40" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {toolsData.filter(tool => tool.orbit === 'content').map((tool) => (
              <Link key={tool.id} href={tool.route}>
                <motion.div
                  className="p-3 md:p-4 rounded-lg bg-card border border-border hover:border-blue-500/40 transition-all cursor-pointer group"
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center border border-blue-500/20 group-hover:border-blue-400/50 transition-colors">
                      <tool.icon className={`h-4 w-4 md:h-5 md:w-5 ${tool.color}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs md:text-sm mb-1">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Artist & Growth Tools */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-purple-500/40" />
            <h3 className="text-lg md:text-xl font-semibold text-center text-purple-400 whitespace-nowrap px-2">
              🚀 Artist & Growth Tools
            </h3>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-purple-500/40" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {toolsData.filter(tool => tool.orbit === 'extra').map((tool) => (
              <Link key={tool.id} href={tool.route}>
                <motion.div
                  className="p-3 md:p-4 rounded-lg bg-card border border-border hover:border-purple-500/40 transition-all cursor-pointer group"
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center border border-purple-500/20 group-hover:border-purple-400/50 transition-colors">
                      <tool.icon className={`h-4 w-4 md:h-5 md:w-5 ${tool.color}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs md:text-sm mb-1">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

      </motion.div>
    </div>
    </>
  );
}