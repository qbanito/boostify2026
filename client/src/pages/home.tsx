import React from 'react';
import { logger } from "../lib/logger";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ScrollArea } from "../components/ui/scroll-area";
import { SiGoogle } from "react-icons/si";
import {
  Music2, Users2, TrendingUp, FileText, Star, Home, Youtube, Globe,
  MessageCircle, BarChart2, Calendar, UserCircle2, Video, Sparkles, Wand2, 
  Play, Volume2, ChevronRight, ArrowRight, Headphones, MoveRight, MousePointer,
  Zap, LucideIcon, Check, ExternalLink, CloudLightning, Pause, PlaySquare,
  DollarSign, Share2, Users, CheckCircle2, Coins, FileCode, X, Layers, Shield, Scale,
  User, Bot
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, useAnimation } from "framer-motion";
import { TokenCardVisual } from "../components/boostiswap/token-card-visual";
import { artistProfiles } from "../data/artist-profiles";
import { getArtistImage } from "../data/artist-images";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { Footer } from "../components/layout/footer";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useState, useEffect, useRef } from "react";
import { PricingPlans } from "../components/subscription/pricing-plans";
import { SiYoutube, SiInstagram, SiTiktok, SiSpotify, SiX, SiFacebook, SiSoundcloud, SiApplemusic, SiDiscord, SiTwitch } from "react-icons/si";
import { AsaasSection } from "../components/home/AsaasSection";
// Comentando los siguientes imports temporalmente ya que no son esenciales para la página inicial
// import { SuperAgent } from "../components/agents/super-agent";

/* =============================
   VARIANTES PARA ANIMACIONES
============================= */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } }
};

/* =============================
   HERO CREATIVE ANIMATIONS
============================= */

// Barras de Equalizer animadas en los bordes
const EqualizerBars = ({ position }: { position: 'left' | 'right' }) => {
  const barCount = 12;
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 ${position === 'left' ? 'left-4 md:left-8' : 'right-4 md:right-8'} flex gap-1 md:gap-1.5 items-end h-32 md:h-48`}>
      {[...Array(barCount)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 md:w-1.5 bg-gradient-to-t from-orange-500/60 via-red-500/40 to-transparent rounded-full"
          animate={{
            height: [
              `${20 + Math.random() * 30}%`,
              `${60 + Math.random() * 40}%`,
              `${30 + Math.random() * 40}%`,
              `${70 + Math.random() * 30}%`,
              `${20 + Math.random() * 30}%`
            ]
          }}
          transition={{
            duration: 0.8 + Math.random() * 0.4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.05
          }}
        />
      ))}
    </div>
  );
};

// Ondas de sonido circulares que se expanden
const SoundWaves = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[200px] md:w-[400px] h-[200px] md:h-[400px] border border-orange-500/20 rounded-full"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 2.5, opacity: [0, 0.3, 0] }}
          transition={{
            duration: 4,
            delay: i * 1,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      ))}
    </div>
  );
};

// Líneas de conexión de red neuronal
const NeuralNetwork = () => {
  const points = [
    { x: '10%', y: '20%' }, { x: '25%', y: '40%' }, { x: '15%', y: '70%' },
    { x: '85%', y: '25%' }, { x: '75%', y: '55%' }, { x: '90%', y: '80%' },
    { x: '40%', y: '15%' }, { x: '60%', y: '85%' }
  ];
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(249, 115, 22)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(249, 115, 22)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(249, 115, 22)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.map((point, i) => (
          points.slice(i + 1).map((target, j) => (
            <motion.line
              key={`${i}-${j}`}
              x1={point.x}
              y1={point.y}
              x2={target.x}
              y2={target.y}
              stroke="url(#lineGradient)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 0.5, 0] }}
              transition={{
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          ))
        ))}
      </svg>
      {points.map((point, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 md:w-3 md:h-3 bg-orange-500 rounded-full"
          style={{ left: point.x, top: point.y }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.8, 0.3],
            boxShadow: [
              '0 0 0px rgba(249,115,22,0)',
              '0 0 20px rgba(249,115,22,0.8)',
              '0 0 0px rgba(249,115,22,0)'
            ]
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: Math.random() * 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  );
};

// Orbes de gradiente mejorados con movimiento fluido
const EnhancedGradientOrbs = () => {
  return (
    <>
      <motion.div
        className="absolute w-[300px] md:w-[500px] h-[300px] md:h-[500px] rounded-full filter blur-[80px] md:blur-[120px]"
        style={{
          background: 'radial-gradient(circle, rgba(249,115,22,0.3) 0%, rgba(249,115,22,0) 70%)'
        }}
        animate={{
          x: ['-10%', '10%', '-5%', '15%', '-10%'],
          y: ['-10%', '15%', '-5%', '10%', '-10%'],
          scale: [1, 1.2, 0.9, 1.1, 1]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        initial={{ left: '10%', top: '20%' }}
      />
      <motion.div
        className="absolute w-[250px] md:w-[400px] h-[250px] md:h-[400px] rounded-full filter blur-[60px] md:blur-[100px]"
        style={{
          background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0) 70%)'
        }}
        animate={{
          x: ['10%', '-10%', '5%', '-15%', '10%'],
          y: ['10%', '-15%', '5%', '-10%', '10%'],
          scale: [1.1, 0.9, 1.2, 1, 1.1]
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        initial={{ right: '15%', bottom: '25%' }}
      />
      <motion.div
        className="absolute w-[200px] md:w-[350px] h-[200px] md:h-[350px] rounded-full filter blur-[70px] md:blur-[90px]"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, rgba(168,85,247,0) 70%)'
        }}
        animate={{
          x: ['-5%', '15%', '-10%', '5%', '-5%'],
          y: ['5%', '-10%', '15%', '-5%', '5%'],
          scale: [0.9, 1.1, 1, 1.2, 0.9]
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        initial={{ left: '50%', top: '60%', transform: 'translate(-50%, -50%)' }}
      />
    </>
  );
};

// Componente principal de animaciones del Hero
const HeroAnimations = () => {
  return (
    <>
      <EnhancedGradientOrbs />
      <NeuralNetwork />
      <SoundWaves />
      <EqualizerBars position="left" />
      <EqualizerBars position="right" />
    </>
  );
};

/* =============================
   TIPOS Y INTERFACES
============================= */
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}

interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
  bgColor: string;
}

interface FeatureHighlight {
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  image?: string;
}

/* =============================
   COMPONENTES
============================= */
const FeatureCard = ({ icon, title, description, delay = 0 }: FeatureCardProps) => (
  <motion.div
    variants={itemVariants}
    transition={{ delay }}
    whileHover={{ y: -6, scale: 1.02 }}
    className="relative group bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-orange-500/40 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-orange-500/10"
  >
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    <div className="relative">
      <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-3 inline-flex items-center justify-center mb-4 group-hover:from-orange-500/30 group-hover:to-red-500/30 transition-all shadow-md shadow-orange-500/10">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-white/60 leading-relaxed">{description}</p>
    </div>
  </motion.div>
);

const ToolCard = ({ icon, title, description, link, bgColor }: ToolCardProps) => (
  <Link href={link}>
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 h-full group flex flex-col shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-orange-500/10"
    >
      <div className={`absolute inset-0 ${bgColor} opacity-80`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/5" />
      <div className="absolute inset-0 border border-white/10 rounded-2xl group-hover:border-white/20 transition-colors" />
      <div className="relative p-6">
        <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 inline-flex items-center justify-center mb-4 shadow-md">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-white/75 mb-4 leading-relaxed">{description}</p>
        <div className="flex items-center text-white/60 group-hover:text-white transition-colors">
          <span className="mr-2 text-sm font-medium">Explore</span>
          <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  </Link>
);

/* =============================
   DATOS ESTÁTICOS
============================= */
const features = [
  {
    icon: <Youtube className="h-6 w-6 text-orange-500" />,
    title: "Strategic YouTube Promotion",
    description: "Boost your video visibility with targeted promotion and AI-powered audience engagement strategies"
  },
  {
    icon: <Music2 className="h-6 w-6 text-orange-500" />,
    title: "Advanced Spotify Growth",
    description: "Optimize your Spotify presence with data-driven insights and algorithmic playlist targeting"
  },
  {
    icon: <Users2 className="h-6 w-6 text-orange-500" />,
    title: "Professional PR Management",
    description: "Launch targeted PR campaigns and build your industry network with AI-assisted outreach"
  },
  {
    icon: <TrendingUp className="h-6 w-6 text-orange-500" />,
    title: "Comprehensive Analytics",
    description: "Track your growth across all platforms with detailed insights and predictive trends"
  },
  {
    icon: <Globe className="h-6 w-6 text-orange-500" />,
    title: "Global Audience Reach",
    description: "Expand your fanbase worldwide with smart targeting and localized promotion strategies"
  },
  {
    icon: <MessageCircle className="h-6 w-6 text-orange-500" />,
    title: "Artist Community Hub",
    description: "Connect with industry professionals and fellow artists in our exclusive networking platform"
  }
];

const educationFeatures = [
  {
    icon: <FileText className="h-6 w-6 text-orange-500" />,
    title: "Music Business Courses",
    description: "Comprehensive courses on music business, rights management, and industry navigation"
  },
  {
    icon: <Play className="h-6 w-6 text-orange-500" />,
    title: "Production Masterclasses",
    description: "Learn advanced music production techniques from industry professionals"
  },
  {
    icon: <Calendar className="h-6 w-6 text-orange-500" />,
    title: "Scheduled Mentoring",
    description: "One-on-one mentoring sessions with experienced music industry experts"
  },
  {
    icon: <UserCircle2 className="h-6 w-6 text-orange-500" />,
    title: "Creator Community",
    description: "Join a community of like-minded artists learning and growing together"
  }
];

const featureHighlights: FeatureHighlight[] = [
  {
    title: "AI-Powered Music Video Generator",
    description: "The most powerful automated music video creation platform on the market. Create professional music videos, promotional materials, and social content in minutes with our advanced AI tools",
    icon: Video,
    features: [
      "Automated Music Video Generation",
      "Advanced Lipsync Technology",
      "Virtual Try-On & Face Swap",
      "AI Image Creation & Enhancement",
      "Social Media Ready Assets"
    ],
    image: "/assets/kling_20251109_Image_to_Video__2315_0_1762701277247.mp4"
  },
  {
    title: "Cross-Platform Analytics",
    description: "Track your growth and engagement across all major platforms with our centralized analytics dashboard",
    icon: BarChart2,
    features: [
      "Spotify Growth Metrics",
      "YouTube Performance",
      "Social Media Engagement",
      "Audience Demographics",
      "Trending Analysis"
    ],
    image: "/assets/kling_20251109_Image_to_Video_dancing_sl_2309_0 (1)_1762701277248.mp4"
  },
  {
    title: "Smart Music Marketing",
    description: "Leverage data-driven strategies to reach your target audience and grow your fanbase effectively",
    icon: TrendingUp,
    features: [
      "Automated Campaigns",
      "Fan Growth Strategies",
      "Content Calendars",
      "Budget Optimization",
      "Performance Tracking"
    ],
    image: "/assets/kling_20251109_Image_to_Video_dancing_sl_2356_0_1762701277248.mp4"
  }
];

const tools = [
  {
    icon: <Video className="h-6 w-6 text-white" />,
    title: "Music Video Creator",
    description: "Generate professional music videos with AI in minutes",
    link: "/music-video-creator",
    bgColor: "bg-gradient-to-br from-purple-600 to-indigo-600"
  },
  {
    icon: <Headphones className="h-6 w-6 text-white" />,
    title: "Music Generator",
    description: "Create original tracks or enhance your existing music with AI",
    link: "/music-generator",
    bgColor: "bg-gradient-to-br from-blue-600 to-cyan-600"
  },
  {
    icon: <Globe className="h-6 w-6 text-white" />,
    title: "Promotion Tools",
    description: "Boost your reach with smart promotion strategies",
    link: "/spotify",
    bgColor: "bg-gradient-to-br from-orange-600 to-red-600"
  },
  {
    icon: <CloudLightning className="h-6 w-6 text-white" />,
    title: "AI Creative Suite",
    description: "Unleash creativity with our comprehensive AI toolset",
    link: "/ai-agents",
    bgColor: "bg-gradient-to-br from-green-600 to-emerald-600"
  }
];

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Independent Artist",
    content: "This platform has revolutionized how I manage my music career. The analytics are incredibly detailed and the AI tools have saved me countless hours!",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?u=sarah.johnson"
  },
  {
    name: "Michael Rodriguez",
    role: "Music Producer",
    content: "The Spotify integration and YouTube promotion tools are game-changing. I've seen a 200% increase in my monthly listeners since using this platform.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?u=michael.rodriguez"
  },
  {
    name: "Emma Thompson",
    role: "Band Manager",
    content: "Managing multiple artists has never been easier. The automated marketing tools and PR campaigns have helped us reach new audiences globally.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?u=emma.thompson"
  }
];

// Default stats (will be replaced with dynamic values)
const defaultStats = [
  { label: "Active Artists", value: 7500, icon: Users2 },
  { label: "Music Videos Created", value: 50000, icon: Video },
  { label: "Tracks Promoted", value: 250000, icon: Music2 },
  { label: "Monthly Views", value: 15000000, icon: TrendingUp }
];

/* =============================
   COMPONENTE ESTADÍSTICA SIMPLE
============================= */
function StatCard({ value, label, icon }: { value: number, label: string, icon: LucideIcon }) {
  const Icon = icon;
  
  // Formato simple para los números grandes
  const formattedValue = value >= 1000000 
    ? `${(value / 1000000).toFixed(1)}M+` 
    : value >= 1000 
      ? `${(value / 1000).toFixed(0)}K+` 
      : `${value}+`;

  return (
    <div className="relative group bg-zinc-900/60 backdrop-blur-xl rounded-2xl p-6 text-center border border-white/10 hover:border-orange-500/30 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="relative">
        <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-3 inline-flex items-center justify-center mb-4 shadow-md shadow-orange-500/10">
          <Icon className="h-6 w-6 text-orange-500" />
        </div>
        <h3 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-400">
          {formattedValue}
        </h3>
        <p className="text-white/60 text-sm">{label}</p>
      </div>
    </div>
  );
}

/* =============================
   COMPONENTE PRINCIPAL: HOME PAGE
============================= */
export default function HomePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if user is on home page - show landing if not logged in
  const isLoggedIn = !!user;
  const [, setLocation] = useLocation();
  const [viewCount, setViewCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showWhitepaperModal, setShowWhitepaperModal] = useState(false);
  const [showFounderModal, setShowFounderModal] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsControls = useAnimation();
  const introVideoRef = useRef<HTMLVideoElement>(null);
  
  // Dynamic platform stats
  const [stats, setStats] = useState(defaultStats);
  
  // Fetch dynamic stats from API
  useEffect(() => {
    fetch('/api/platform-stats')
      .then(res => res.json())
      .then(data => {
        setStats([
          { label: "Active Artists", value: data.activeArtists || 7500, icon: Users2 },
          { label: "Music Videos Created", value: data.musicVideosCreated || 50000, icon: Video },
          { label: "Tracks Promoted", value: data.tracksPromoted || 250000, icon: Music2 },
          { label: "Monthly Views", value: data.monthlyViews || 15000000, icon: TrendingUp }
        ]);
      })
      .catch(() => {
        // Keep default stats on error
      });
  }, []);

  useEffect(() => {
    const viewInterval = setInterval(() => {
      setViewCount(prev => {
        if (prev >= 100000) {
          return 0; // Reset to start the loop again
        }
        return prev + 1000;
      });
    }, 50);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) {
          return 0; // Reset to start the loop again
        }
        return prev + 1;
      });
    }, 30);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            statsControls.start({
              opacity: 1,
              y: 0,
              transition: { duration: 0.8, staggerChildren: 0.1 }
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => {
      clearInterval(viewInterval);
      clearInterval(progressInterval);
      observer.disconnect();
    };
  }, [statsControls]);

  // Ensure intro video plays automatically with IntersectionObserver
  useEffect(() => {
    const video = introVideoRef.current;
    if (!video) return;

    // Try to play immediately
    const attemptPlay = () => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            logger.info('Video playing successfully');
          })
          .catch(() => {
            logger.info('Autoplay blocked by browser');
          });
      }
    };

    // Observe when video enters viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            attemptPlay();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);

    // Also try on any user interaction
    const playOnInteraction = () => {
      attemptPlay();
      window.removeEventListener('click', playOnInteraction);
      window.removeEventListener('scroll', playOnInteraction);
      window.removeEventListener('touchstart', playOnInteraction);
    };

    window.addEventListener('click', playOnInteraction, { once: true });
    window.addEventListener('scroll', playOnInteraction, { once: true });
    window.addEventListener('touchstart', playOnInteraction, { once: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('click', playOnInteraction);
      window.removeEventListener('scroll', playOnInteraction);
      window.removeEventListener('touchstart', playOnInteraction);
    };
  }, []);

  const handleGoogleLogin = (redirectTo?: string) => {
    // Guardar el redirect path si se especifica
    if (redirectTo) {
      localStorage.setItem('auth_redirect_path', redirectTo);
    }
    // Redirigir a la página de signup que muestra los planes
    window.location.href = '/auth';
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section - Modern and Eye-catching */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background video with overlay */}
        <video
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/assets/promos/boostify-2025-profile-v2.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/70 to-black" />
        
        {/* Creative Animated Background Elements */}
        <HeroAnimations />
        
        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center space-y-6"
            >

              <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-red-500 to-orange-500 leading-tight">
                <motion.span
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="block"
                >
                  Boostify Music
                </motion.span>
              </h1>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed"
              >
                The ultimate AI-powered platform for artists to create, promote, and grow their music career
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 py-4"
              >
                {user ? (
                  // Mostrar botón de perfil cuando el usuario está logueado
                  <>
                    <Link href="/profile">
                      <Button
                        size="lg"
                        className="relative overflow-hidden group bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 hover:from-orange-600 hover:via-red-600 hover:to-orange-600 text-white h-14 px-8 shadow-xl transition-all duration-300 transform hover:scale-105"
                        data-testid="button-my-profile-hero"
                      >
                        <UserCircle2 className="w-5 h-5 mr-2" />
                        <span className="font-medium">My Profile</span>
                      </Button>
                    </Link>
                    <Link href="/dashboard">
                      <Button 
                        size="lg" 
                        variant="outline" 
                        className="h-14 px-8 border-white/30 text-white hover:bg-white/10 hover:text-white"
                      >
                        Dashboard
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  // Mostrar botones de login cuando no está logueado
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Human Artist Button */}
                    <Button
                      size="lg"
                      onClick={() => handleGoogleLogin()}
                      className="relative overflow-hidden group bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white h-14 px-8 shadow-xl transition-all duration-300 transform hover:scale-105 border-2 border-blue-400/30"
                      aria-label="Login as Human Artist"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <User className="w-5 h-5 mr-2" />
                      <span className="font-bold tracking-wide">HUMAN ARTIST</span>
                    </Button>
                    
                    {/* AI Artist Button */}
                    <Button
                      size="lg"
                      onClick={() => handleGoogleLogin('/my-artists')}
                      className="relative overflow-hidden group bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white h-14 px-8 shadow-xl transition-all duration-300 transform hover:scale-105 border-2 border-orange-400/30"
                      aria-label="Login as AI Artist"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-pink-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Bot className="w-5 h-5 mr-2" />
                      <span className="font-bold tracking-wide">AI ARTIST</span>
                      <Sparkles className="w-4 h-4 ml-2 animate-pulse" />
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
            
            {/* Feature highlights bar */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6"
            >
              <Card className="bg-zinc-900/60 backdrop-blur-xl border-white/10 hover:border-orange-500/30 p-5 text-center rounded-2xl shadow-lg shadow-black/20 hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-2.5 inline-flex items-center justify-center mb-2.5 shadow-sm shadow-orange-500/10">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-sm font-semibold">AI Video Creation</p>
              </Card>
              <Card className="bg-zinc-900/60 backdrop-blur-xl border-white/10 hover:border-orange-500/30 p-5 text-center rounded-2xl shadow-lg shadow-black/20 hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-2.5 inline-flex items-center justify-center mb-2.5 shadow-sm shadow-orange-500/10">
                  <Music2 className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-sm font-semibold">Music Promotion</p>
              </Card>
              <Card className="bg-zinc-900/60 backdrop-blur-xl border-white/10 hover:border-orange-500/30 p-5 text-center rounded-2xl shadow-lg shadow-black/20 hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-2.5 inline-flex items-center justify-center mb-2.5 shadow-sm shadow-orange-500/10">
                  <BarChart2 className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-sm font-semibold">Analytics Dashboard</p>
              </Card>
              <Card className="bg-zinc-900/60 backdrop-blur-xl border-white/10 hover:border-orange-500/30 p-5 text-center rounded-2xl shadow-lg shadow-black/20 hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-2.5 inline-flex items-center justify-center mb-2.5 shadow-sm shadow-orange-500/10">
                  <Globe className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-sm font-semibold">Global Distribution</p>
              </Card>
            </motion.div>
          </div>
        </div>
        
        {/* Navigation Buttons for logged-in users */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="fixed top-4 right-4 z-50 flex gap-2"
          >
            <Link href="/profile" aria-label="My Profile">
              <Button
                variant="outline"
                size="icon"
                className="bg-black/20 backdrop-blur-lg border-orange-500/20 hover:bg-orange-500/10"
                data-testid="button-profile-nav"
              >
                <UserCircle2 className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/dashboard" aria-label="Dashboard">
              <Button
                variant="outline"
                size="icon"
                className="bg-black/20 backdrop-blur-lg border-orange-500/20 hover:bg-orange-500/10"
              >
                <Home className="h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        )}
      </section>

      {/* ASAAS Section - Artist As A System */}
      <AsaasSection onGetStarted={handleGoogleLogin} />

      {/* Founder's Words Section */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-b from-black via-zinc-950 to-black">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-orange-500/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-orange-500/10" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex flex-col md:flex-row items-center gap-10 max-w-5xl mx-auto"
          >
            {/* Founder Image */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-br from-orange-500 via-red-500 to-orange-600 rounded-full blur-sm opacity-60" />
                <img
                  src="/images/founder.webp"
                  alt="Neiver Alvarez - Founder & CEO"
                  className="relative w-40 h-40 md:w-52 md:h-52 rounded-full object-cover border-2 border-orange-500/50"
                />
              </div>
            </div>
            {/* Founder Text */}
            <div className="text-center md:text-left flex-1">
              <Badge className="mb-3 bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs">
                <Star className="w-3 h-3 mr-1" /> Words from the Founder
              </Badge>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-1">
                Neiver Alvarez
              </h3>
              <p className="text-orange-400 font-medium mb-4 text-sm">Founder & CEO, Boostify Music</p>
              <p className="text-white/70 leading-relaxed text-base mb-5">
                &ldquo;Boostify Music was born with one clear mission: to empower independent artists with the tools they need to compete, grow, and thrive in a rapidly evolving music industry.&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setShowFounderModal(true)}
                className="inline-flex items-center bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-6 py-3 rounded-full shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 cursor-pointer"
              >
                Read Full Message <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Complete Ecosystem for Artists - Orbital Visualization */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-b from-zinc-950 to-black">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-orange-500/10 rounded-full filter blur-3xl animate-pulse" 
             style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-500/10 rounded-full filter blur-3xl animate-pulse" 
             style={{ animationDuration: '10s' }} />
        
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 max-w-5xl mx-auto"
          >
            <Badge 
              className="mb-6 bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border-orange-500/30 px-6 py-2 text-base font-semibold"
              variant="outline"
            >
              🎬 Complete Creator Suite
            </Badge>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-orange-200 to-white">
              Everything You Need in One Place
            </h2>
            <p className="text-xl md:text-2xl text-white/70 leading-relaxed mb-12">
              <span className="text-orange-400 font-semibold">The most powerful automated music video generator on the market.</span> Our suite of AI tools empowers artists to create stunning videos, promotional materials, and social media content without any technical skills
            </p>
            
            {/* Ecosystem Orbital - Using Dashboard Component Logic */}
            <div className="relative w-full max-w-2xl mx-auto mb-16" style={{ height: '500px' }}>
              {/* Central Circle with Video */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="relative w-56 h-56 md:w-64 md:h-64">
                  {/* Glow effect */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 to-red-500 animate-pulse opacity-50 blur-2xl"></div>
                  {/* Gradient border */}
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-orange-500 to-red-600 p-1">
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-orange-500/30 bg-gradient-to-br from-orange-900/50 via-black to-red-900/50 relative group">
                      {/* Intro Video */}
                      <video 
                        ref={introVideoRef}
                        className="absolute inset-0 w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        onError={(e) => {
                          logger.error('Error loading intro video:', e);
                        }}
                        onLoadedMetadata={() => {
                          logger.info('Video metadata loaded');
                          if (introVideoRef.current) {
                            introVideoRef.current.play().catch(e => {
                              logger.info('Autoplay prevented, will play on interaction');
                            });
                          }
                        }}
                        onCanPlay={() => {
                          logger.info('Video can play');
                          if (introVideoRef.current) {
                            introVideoRef.current.play().catch(e => {
                              logger.info('Play attempt failed:', e);
                            });
                          }
                        }}
                      >
                        <source src="/assets/hero-video.mp4" type="video/mp4" />
                      </video>
                      
                      {/* Video Controls Overlay */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="w-8 h-8 rounded-full bg-orange-500/90 backdrop-blur-sm flex items-center justify-center hover:bg-orange-600 transition-colors shadow-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            const video = e.currentTarget.closest('.group')?.querySelector('video') as HTMLVideoElement;
                            if (video) {
                              if (video.paused) {
                                video.play();
                              } else {
                                video.pause();
                              }
                            }
                          }}
                          data-testid="button-video-play"
                        >
                          <Play className="h-4 w-4 text-white" />
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="w-8 h-8 rounded-full bg-orange-500/90 backdrop-blur-sm flex items-center justify-center hover:bg-orange-600 transition-colors shadow-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            const video = e.currentTarget.closest('.group')?.querySelector('video') as HTMLVideoElement;
                            if (video) {
                              video.muted = !video.muted;
                            }
                          }}
                          data-testid="button-video-mute"
                        >
                          <Volume2 className="h-4 w-4 text-white" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orbit Rings */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] md:w-[360px] md:h-[360px] border border-orange-500/20 rounded-full"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] md:w-[500px] md:h-[500px] border border-orange-500/10 rounded-full"></div>

              {/* Inner Orbit Icons - Static positioned using dashboard logic */}
              {[
                { icon: SiYoutube, route: "/youtube-views", color: "text-red-500" },
                { icon: Music2, route: "/music-generator", color: "text-orange-400" },
                { icon: SiInstagram, route: "/instagram-boost", color: "text-pink-500" },
                { icon: Video, route: "/music-video-creator", color: "text-purple-500" },
                { icon: SiSpotify, route: "/spotify", color: "text-green-500" },
                { icon: BarChart2, route: "/admin", color: "text-blue-400" },
              ].map((tool, index, array) => {
                const angleInDegrees = index * (360 / array.length);
                const angleRad = (angleInDegrees - 90) * Math.PI / 180;
                
                // Mobile positions
                const radiusMobile = 120;
                const xMobile = Math.cos(angleRad) * radiusMobile;
                const yMobile = Math.sin(angleRad) * radiusMobile;
                
                // Desktop positions
                const radiusDesktop = 180;
                const xDesktop = Math.cos(angleRad) * radiusDesktop;
                const yDesktop = Math.sin(angleRad) * radiusDesktop;
                
                const Icon = tool.icon;
                
                return (
                  <Link key={index} href={tool.route}>
                    <div
                      className="absolute z-30 inner-orbit-icon"
                      style={{
                        '--x-mobile': `${xMobile}px`,
                        '--y-mobile': `${yMobile}px`,
                        '--x-desktop': `${xDesktop}px`,
                        '--y-desktop': `${yDesktop}px`,
                        left: `calc(50% + ${xMobile}px)`,
                        top: `calc(50% + ${yMobile}px)`,
                        transform: 'translate(-50%, -50%)',
                      } as React.CSSProperties}
                    >
                      <motion.div 
                        className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-black/60 backdrop-blur-md border-2 border-orange-500/50 shadow-lg flex items-center justify-center cursor-pointer hover:border-orange-500 hover:scale-110 transition-all"
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Icon className={`h-5 w-5 md:h-6 md:w-6 ${tool.color}`} />
                      </motion.div>
                    </div>
                  </Link>
                );
              })}

              {/* Outer Orbit Icons */}
              {[
                { icon: Globe, route: "/global", color: "text-cyan-400" },
                { icon: MessageCircle, route: "/messages", color: "text-yellow-500" },
                { icon: Users, route: "/spotify", color: "text-blue-500" },
                { icon: SiTiktok, route: "/social-network", color: "text-slate-300" },
                { icon: FileText, route: "/blog", color: "text-indigo-400" },
                { icon: Share2, route: "/spotify", color: "text-emerald-400" },
              ].map((tool, index, array) => {
                const angleInDegrees = index * (360 / array.length);
                const angleRad = (angleInDegrees - 90) * Math.PI / 180;
                
                // Mobile positions
                const radiusMobile = 170;
                const xMobile = Math.cos(angleRad) * radiusMobile;
                const yMobile = Math.sin(angleRad) * radiusMobile;
                
                // Desktop positions
                const radiusDesktop = 250;
                const xDesktop = Math.cos(angleRad) * radiusDesktop;
                const yDesktop = Math.sin(angleRad) * radiusDesktop;
                
                const Icon = tool.icon;
                
                return (
                  <Link key={index} href={tool.route}>
                    <div
                      className="absolute z-30 outer-orbit-icon"
                      style={{
                        '--x-mobile': `${xMobile}px`,
                        '--y-mobile': `${yMobile}px`,
                        '--x-desktop': `${xDesktop}px`,
                        '--y-desktop': `${yDesktop}px`,
                        left: `calc(50% + ${xMobile}px)`,
                        top: `calc(50% + ${yMobile}px)`,
                        transform: 'translate(-50%, -50%)',
                      } as React.CSSProperties}
                    >
                      <motion.div 
                        className="h-11 w-11 md:h-12 md:w-12 rounded-full bg-black/60 backdrop-blur-md border-2 border-orange-500/40 shadow-lg flex items-center justify-center cursor-pointer hover:border-orange-500 hover:scale-110 transition-all"
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Icon className={`h-4 w-4 md:h-5 md:w-5 ${tool.color}`} />
                      </motion.div>
                    </div>
                  </Link>
                );
              })}

              {/* Responsive positioning for desktop */}
              <style>{`
                @media (min-width: 768px) {
                  .inner-orbit-icon {
                    left: calc(50% + var(--x-desktop)) !important;
                    top: calc(50% + var(--y-desktop)) !important;
                  }
                  .outer-orbit-icon {
                    left: calc(50% + var(--x-desktop)) !important;
                    top: calc(50% + var(--y-desktop)) !important;
                  }
                }
              `}</style>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section - With Animated Counters */}
      <section 
        ref={statsRef}
        className="py-16 bg-gradient-to-b from-black to-zinc-950 relative overflow-hidden"
      >
        {/* Background elements */}
        <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-orange-500/10 rounded-full filter blur-3xl opacity-30" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-red-500/10 rounded-full filter blur-3xl opacity-30" />
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={statsControls}
          className="container mx-auto px-4"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">
            Platform Metrics
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {stats.map((stat, index) => (
              <StatCard
                key={index}
                value={stat.value}
                label={stat.label}
                icon={stat.icon}
              />
            ))}
          </div>
        </motion.div>
      </section>

      {/* Music Video Generator Showcase */}
      <section className="py-24 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-full filter blur-3xl"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge className="mb-6 bg-gradient-to-r from-orange-500/30 to-red-500/30 text-white border-orange-500/50 px-6 py-2 text-base font-bold">
              ⚡ MOST POWERFUL ON THE MARKET
            </Badge>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-red-500 to-orange-400">
                Automated AI Music Video Generator
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-white/70 max-w-4xl mx-auto leading-relaxed">
              Transform your music into stunning professional videos in minutes. Our AI handles everything - from concept to final render
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-7xl mx-auto"
          >
            <div className="relative rounded-3xl overflow-hidden border border-orange-500/20 shadow-2xl shadow-orange-500/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-orange-950/20">
              <video 
                src="/assets/kling_20251109_Image_to_Video__2315_0_1762701277247.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent"></div>
              
              {/* Elegant overlay content */}
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                  <div className="flex-1 space-y-4">
                    <div className="inline-block">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px w-8 bg-gradient-to-r from-orange-500 to-transparent"></div>
                        <span className="text-orange-400 text-sm font-semibold tracking-wider uppercase">Get Started</span>
                      </div>
                    </div>
                    <h3 className="text-3xl md:text-5xl font-bold text-white leading-tight">
                      Start Creating Today
                    </h3>
                    <p className="text-white/60 text-base md:text-lg max-w-xl leading-relaxed">
                      Join thousands of artists using AI to create professional music videos
                    </p>
                  </div>
                  
                  <div className="w-full md:w-auto">
                    <Link href="/music-video-creator">
                      <Button 
                        size="lg" 
                        className="w-full md:w-auto group bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold px-10 py-7 text-base md:text-lg shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 transition-all duration-300 hover:scale-105"
                      >
                        <Video className="mr-3 h-5 w-5 group-hover:rotate-12 transition-transform" />
                        Create Your Music Video
                        <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Decorative corner accents */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/10 to-transparent rounded-bl-full"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-500/10 to-transparent rounded-tr-full"></div>
            </div>

            {/* Feature Pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="group relative bg-zinc-900/60 backdrop-blur-xl border border-white/10 hover:border-orange-500/30 rounded-2xl p-5 text-center shadow-lg shadow-black/20 hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="relative">
                  <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-2.5 inline-flex items-center justify-center mb-2.5 shadow-sm shadow-orange-500/10">
                    <Sparkles className="h-5 w-5 text-orange-500" />
                  </div>
                  <p className="text-sm font-semibold">AI-Powered</p>
                  <p className="text-xs text-white/50 mt-1">Advanced algorithms</p>
                </div>
              </div>
              <div className="group relative bg-zinc-900/60 backdrop-blur-xl border border-white/10 hover:border-orange-500/30 rounded-2xl p-5 text-center shadow-lg shadow-black/20 hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="relative">
                  <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-2.5 inline-flex items-center justify-center mb-2.5 shadow-sm shadow-orange-500/10">
                    <Zap className="h-5 w-5 text-orange-500" />
                  </div>
                  <p className="text-sm font-semibold">Lightning Fast</p>
                  <p className="text-xs text-white/50 mt-1">Minutes, not days</p>
                </div>
              </div>
              <div className="group relative bg-zinc-900/60 backdrop-blur-xl border border-white/10 hover:border-orange-500/30 rounded-2xl p-5 text-center shadow-lg shadow-black/20 hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="relative">
                  <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-2.5 inline-flex items-center justify-center mb-2.5 shadow-sm shadow-orange-500/10">
                    <Wand2 className="h-5 w-5 text-orange-500" />
                  </div>
                  <p className="text-sm font-semibold">Full Automation</p>
                  <p className="text-xs text-white/50 mt-1">No skills needed</p>
                </div>
              </div>
              <div className="group relative bg-zinc-900/60 backdrop-blur-xl border border-white/10 hover:border-orange-500/30 rounded-2xl p-5 text-center shadow-lg shadow-black/20 hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="relative">
                  <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-2.5 inline-flex items-center justify-center mb-2.5 shadow-sm shadow-orange-500/10">
                    <CheckCircle2 className="h-5 w-5 text-orange-500" />
                  </div>
                  <p className="text-sm font-semibold">Pro Quality</p>
                  <p className="text-xs text-white/50 mt-1">Broadcast ready</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Web3 Music Tokenization & BoostiSwap Section */}
      <section className="py-24 bg-gradient-to-br from-black via-zinc-950 to-black relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]"></div>
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-r from-purple-600/20 to-orange-500/20 rounded-full filter blur-[120px] animate-pulse" style={{ animationDuration: '10s' }}></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-l from-orange-600/20 to-purple-500/20 rounded-full filter blur-[100px] animate-pulse" style={{ animationDuration: '14s' }}></div>
        
        <div className="container mx-auto px-4 relative z-10">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge className="mb-4 bg-gradient-to-r from-purple-500/20 to-orange-500/20 text-orange-400 border-orange-500/30 px-6 py-2 text-sm font-bold">
              🚀 WEB3 REVOLUTION
            </Badge>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-orange-400 to-red-500">
                Tokenize & Trade Your Music
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-white/70 max-w-4xl mx-auto leading-relaxed">
              Turn your songs into digital assets, earn royalties automatically, and let fans invest in your success through our revolutionary marketplace
            </p>
          </motion.div>
          
          {/* Two Cards Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            
            {/* Card 1: Tokenization */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="group"
            >
              <div className="relative h-full">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-orange-500/20 rounded-2xl p-8 h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20">
                      <Sparkles className="h-8 w-8 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Music Tokenization</h3>
                      <p className="text-orange-400 text-sm">Turn songs into digital assets</p>
                    </div>
                  </div>
                  
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center mt-0.5">
                        <DollarSign className="h-4 w-4 text-orange-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white">Direct Revenue</span>
                        <p className="text-white/60 text-sm">No intermediaries - 100% of your earnings go to you</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center mt-0.5">
                        <Share2 className="h-4 w-4 text-orange-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white">Automatic Royalties</span>
                        <p className="text-white/60 text-sm">Earn on every resale, forever</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center mt-0.5">
                        <Users className="h-4 w-4 text-orange-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white">Fan Investment</span>
                        <p className="text-white/60 text-sm">Fans become stakeholders in your success</p>
                      </div>
                    </li>
                  </ul>
                  
                  <Link href="/tokenization">
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-6 shadow-lg shadow-orange-500/20 group">
                      <Sparkles className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                      Tokenize Your Music
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Card 2: BoostiSwap */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="group"
            >
              <div className="relative h-full">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                      <Zap className="h-8 w-8 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">BoostiSwap</h3>
                      <p className="text-purple-400 text-sm">BTF-2300 Marketplace</p>
                    </div>
                    <Badge className="ml-auto bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                      NEW 🚀
                    </Badge>
                  </div>
                  
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                        <TrendingUp className="h-4 w-4 text-purple-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white">Trade BTF-2300 Tokens</span>
                        <p className="text-white/60 text-sm">Buy & sell artist smart contracts on our marketplace</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                        <BarChart2 className="h-4 w-4 text-purple-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white">Automated Royalties</span>
                        <p className="text-white/60 text-sm">Smart contract manages royalty distribution automatically</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                        <Globe className="h-4 w-4 text-purple-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white">Complete Artist Catalog</span>
                        <p className="text-white/60 text-sm">Music, videos, images — all in one token</p>
                      </div>
                    </li>
                  </ul>
                  
                  <div className="flex gap-3">
                    <Link href="/boostiswap" className="flex-1">
                      <Button className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-6 shadow-lg shadow-purple-500/20 group">
                        <Zap className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                        Explore BoostiSwap
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <Button 
                      onClick={() => setShowWhitepaperModal(true)}
                      variant="outline" 
                      className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500 py-6 px-4 group"
                    >
                      <FileCode className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Video Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative max-w-4xl mx-auto"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 via-orange-500/30 to-red-500/30 rounded-3xl blur-2xl"></div>
            <div className="relative bg-zinc-800/50 backdrop-blur border border-zinc-700/50 rounded-3xl p-4 overflow-hidden">
              <video 
                src="/assets/Standard_Mode_Generated_Video (7).mp4" 
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-full h-auto rounded-2xl shadow-2xl"
              />
              
              {/* Floating stats on video */}
              <div className="absolute bottom-8 left-8 right-8 flex justify-between">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10"
                >
                  <p className="text-xs text-white/60">Total Volume</p>
                  <p className="text-lg font-bold text-white">$2.5M+</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 }}
                  className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10"
                >
                  <p className="text-xs text-white/60">Artists</p>
                  <p className="text-lg font-bold text-white">5,000+</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 }}
                  className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10 hidden sm:block"
                >
                  <p className="text-xs text-white/60">BTF-2300 Tokens</p>
                  <p className="text-lg font-bold text-white">50K+</p>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* BTF-2300 3-Step Process */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-20"
          >
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30 px-4 py-1 text-sm">
                BTF-2300 STANDARD
              </Badge>
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                3-Step <span className="text-purple-400">Artist Tokenization</span>
              </h3>
              <p className="text-white/60 max-w-2xl mx-auto">
                Transform your entire creative catalog into a programmable digital entity with our revolutionary BTF-2300 smart contract
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Step 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-zinc-900/80 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 hover:border-purple-500/40 transition-all"
              >
                <div className="rounded-full bg-purple-500/20 w-14 h-14 flex items-center justify-center mb-5">
                  <Music2 className="w-7 h-7 text-purple-400" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">1. Upload Your Catalog</h4>
                <p className="text-white/60 text-sm mb-4">Upload your music, videos, images and more. All your creative assets in one place.</p>
                
                {/* Animation */}
                <div className="relative w-full h-24 bg-zinc-800 rounded-lg overflow-hidden">
                  <motion.div
                    initial={{ x: -100 }}
                    animate={{ x: 180 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute top-1/2 -translate-y-1/2 h-1 w-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                  />
                  <motion.div
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 1.5, repeatType: "reverse" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Play className="h-10 w-10 text-purple-400" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Step 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-zinc-900/80 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 hover:border-purple-500/40 transition-all"
              >
                <div className="rounded-full bg-purple-500/20 w-14 h-14 flex items-center justify-center mb-5">
                  <Coins className="w-7 h-7 text-purple-400" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">2. Deploy BTF-2300</h4>
                <p className="text-white/60 text-sm mb-4">One-click deployment of your artist smart contract on Polygon blockchain.</p>
                
                {/* Animation */}
                <div className="relative w-full h-24 bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 1, rotate: 0 }}
                    animate={{ scale: [1, 1.1, 1], rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-14 h-14 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center"
                  >
                    <Coins className="h-7 w-7 text-white" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: [0, 1, 0], scale: [0.8, 1.3, 1.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                    className="absolute inset-0 m-auto w-14 h-14 border-2 border-purple-500 rounded-full"
                  />
                </div>
              </motion.div>

              {/* Step 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="bg-zinc-900/80 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 hover:border-purple-500/40 transition-all"
              >
                <div className="rounded-full bg-purple-500/20 w-14 h-14 flex items-center justify-center mb-5">
                  <Zap className="w-7 h-7 text-purple-400" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">3. Earn & License</h4>
                <p className="text-white/60 text-sm mb-4">Automated royalties (80/20 split) and on-chain licensing for every transaction.</p>
                
                {/* Animation */}
                <div className="relative w-full h-24 bg-zinc-800 rounded-lg overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: [40, 0, -40], opacity: [0, 1, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      className="flex flex-col items-center"
                    >
                      <Star className="h-6 w-6 text-yellow-400 mb-1" />
                      <span className="text-white font-bold text-lg">+$150</span>
                    </motion.div>
                  </div>
                  <motion.div
                    initial={{ width: "10%" }}
                    animate={{ width: "90%" }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
                    className="absolute bottom-3 left-3 right-3 h-3 bg-gradient-to-r from-green-500 to-green-300 rounded-full"
                  />
                </div>
              </motion.div>
            </div>

            {/* Whitepaper CTA */}
            <div className="text-center mt-10">
              <Button 
                onClick={() => setShowWhitepaperModal(true)}
                variant="outline" 
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500 px-8 py-6 text-lg group"
              >
                <FileCode className="mr-2 h-5 w-5" />
                Read BTF-2300 Whitepaper
                <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>

          {/* Artist Tokens Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16"
          >
            <div className="text-center mb-8">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Artist Tokens</h3>
              <p className="text-white/60">Trade tokenized artist profiles on BoostiSwap</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {/* Artist Token Cards - Using real TokenCardVisual component */}
              {[1, 2, 3, 4].map((artistId, index) => {
                const profile = artistProfiles[artistId];
                const artistImage = getArtistImage(artistId);
                const prices = [2.45, 3.12, 1.89, 4.25];
                const changes = [24.5, 18.2, 31.7, 42.1];
                
                return (
                  <motion.div
                    key={artistId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * (index + 1) }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="group cursor-pointer"
                  >
                    <Link href="/boostiswap">
                      <TokenCardVisual
                        songName={profile?.name || `Artist ${artistId}`}
                        artistName={profile?.name || `Artist ${artistId}`}
                        tokenSymbol={profile?.name?.substring(0, 3).toUpperCase() || 'TKN'}
                        price={prices[index]}
                        artistImage={artistImage}
                        songImageUrl={artistImage}
                        change24h={changes[index]}
                        tracks={profile?.tracks || []}
                      />
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* View All CTA */}
            <div className="text-center mt-8">
              <Link href="/boostiswap">
                <Button variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500 px-8 py-6 text-lg group">
                  View All Artist Tokens
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Professional Artist Profile - FREE Section */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-br from-zinc-950 via-black to-zinc-950">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]"></div>
        <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-gradient-to-r from-orange-600/20 to-amber-500/10 rounded-full filter blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-l from-red-600/15 to-orange-500/10 rounded-full filter blur-[100px] animate-pulse" style={{ animationDuration: '12s' }}></div>
        
        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-orange-500/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-5xl mx-auto"
          >
            {/* Main content card */}
            <div className="relative">
              {/* Glowing border effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 rounded-3xl blur opacity-30 group-hover:opacity-100 animate-pulse" style={{ animationDuration: '4s' }}></div>
              
              <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-orange-500/20 rounded-3xl p-8 md:p-12 overflow-hidden">
                {/* Decorative corner elements */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-orange-500/20 to-transparent rounded-bl-full"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-500/10 to-transparent rounded-tr-full"></div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  {/* Left content */}
                  <div className="space-y-6">
                    <motion.div
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 }}
                    >
                      <Badge className="mb-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30 px-4 py-2 text-sm font-bold">
                        <Sparkles className="h-3.5 w-3.5 mr-2 inline" />
                        100% GRATIS
                      </Badge>
                      
                      <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
                        <span className="text-white">Create Your</span>
                        <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 animate-gradient">
                          Professional
                        </span>
                        <br />
                        <span className="text-white">Artist Website</span>
                      </h2>
                    </motion.div>
                    
                    <motion.p
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 }}
                      className="text-lg md:text-xl text-white/70 leading-relaxed"
                    >
                      Stand out with a stunning artist profile. Showcase your music, connect all your social platforms, and let fans discover everything about you in one place.
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 }}
                      className="space-y-3"
                    >
                      {[
                        { icon: Globe, text: "Custom boostify.com/yourname URL" },
                        { icon: Music2, text: "Embed Spotify, Apple Music & more" },
                        { icon: Video, text: "Showcase your music videos" },
                        { icon: Users2, text: "Link all your social profiles" },
                        { icon: BarChart2, text: "Track visitor analytics" },
                      ].map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          className="flex items-center gap-3"
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                            <item.icon className="h-4 w-4 text-orange-400" />
                          </div>
                          <span className="text-white/90">{item.text}</span>
                        </motion.div>
                      ))}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.8 }}
                      className="flex flex-col sm:flex-row gap-4 pt-4"
                    >
                      <Link href="/profile">
                        <Button 
                          size="lg"
                          className="group w-full sm:w-auto bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold px-8 py-6 text-lg shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105"
                        >
                          <UserCircle2 className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                          Create My Profile FREE
                          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                      <Link href="/profile">
                        <Button 
                          size="lg"
                          variant="outline"
                          className="w-full sm:w-auto border-white/20 hover:bg-white/10 px-8 py-6 text-lg"
                        >
                          <ExternalLink className="mr-2 h-5 w-5" />
                          See Examples
                        </Button>
                      </Link>
                    </motion.div>
                  </div>

                  {/* Right side - Profile preview mockup */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
                    whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="relative"
                  >
                    {/* Phone mockup frame */}
                    <div className="relative mx-auto max-w-[320px]">
                      {/* Glow effect behind phone */}
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/40 to-red-500/40 rounded-[3rem] blur-2xl transform scale-90"></div>
                      
                      {/* Phone frame */}
                      <div className="relative bg-zinc-800 rounded-[2.5rem] p-3 shadow-2xl border border-zinc-700">
                        {/* Phone screen */}
                        <div className="bg-gradient-to-b from-zinc-900 to-black rounded-[2rem] overflow-hidden aspect-[9/19]">
                          {/* Status bar */}
                          <div className="flex justify-between items-center px-6 py-2 text-xs text-white/60">
                            <span>9:41</span>
                            <div className="flex gap-1">
                              <div className="w-4 h-2 bg-white/60 rounded-sm"></div>
                            </div>
                          </div>
                          
                          {/* Profile content */}
                          <div className="px-4 py-6 space-y-4">
                            {/* Profile image */}
                            <motion.div 
                              className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-red-500 p-0.5"
                              animate={{ 
                                boxShadow: ['0 0 20px rgba(249,115,22,0.4)', '0 0 40px rgba(249,115,22,0.6)', '0 0 20px rgba(249,115,22,0.4)']
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                                <Music2 className="h-10 w-10 text-orange-400" />
                              </div>
                            </motion.div>
                            
                            {/* Artist name */}
                            <div className="text-center">
                              <h4 className="text-lg font-bold text-white">Your Artist Name</h4>
                              <p className="text-xs text-orange-400">@yourname</p>
                            </div>
                            
                            {/* Bio */}
                            <p className="text-center text-xs text-white/60 px-2">
                              "Your bio and story goes here..."
                            </p>
                            
                            {/* Social icons */}
                            <div className="flex justify-center gap-2">
                              {[SiSpotify, SiInstagram, SiYoutube, SiTiktok].map((Icon, i) => (
                                <motion.div
                                  key={i}
                                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                                  whileHover={{ scale: 1.2, backgroundColor: 'rgba(249,115,22,0.3)' }}
                                >
                                  <Icon className="h-4 w-4 text-white/80" />
                                </motion.div>
                              ))}
                            </div>
                            
                            {/* Music embed preview */}
                            <div className="bg-zinc-800/80 rounded-xl p-3 border border-zinc-700/50">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                                  <Play className="h-4 w-4 text-white fill-white" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-white truncate">Latest Release</p>
                                  <p className="text-[10px] text-white/50">Your Song Title</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-zinc-800/50 rounded-lg p-2">
                                <p className="text-xs font-bold text-orange-400">10K+</p>
                                <p className="text-[10px] text-white/50">Plays</p>
                              </div>
                              <div className="bg-zinc-800/50 rounded-lg p-2">
                                <p className="text-xs font-bold text-orange-400">500+</p>
                                <p className="text-[10px] text-white/50">Fans</p>
                              </div>
                              <div className="bg-zinc-800/50 rounded-lg p-2">
                                <p className="text-xs font-bold text-orange-400">25</p>
                                <p className="text-[10px] text-white/50">Tracks</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Floating elements around phone */}
                      <motion.div
                        className="absolute -top-4 -right-4 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        FREE!
                      </motion.div>
                      
                      <motion.div
                        className="absolute top-1/4 -left-8 bg-zinc-800 border border-orange-500/30 text-white text-xs px-3 py-2 rounded-lg shadow-lg"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 1 }}
                      >
                        <Sparkles className="h-3 w-3 text-orange-400 inline mr-1" />
                        AI-Powered
                      </motion.div>
                      
                      <motion.div
                        className="absolute bottom-1/4 -right-6 bg-zinc-800 border border-orange-500/30 text-white text-xs px-3 py-2 rounded-lg shadow-lg"
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 1.2 }}
                      >
                        <Globe className="h-3 w-3 text-orange-400 inline mr-1" />
                        Custom URL
                      </motion.div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Key Features Highlight Section */}
      {featureHighlights.map((feature, index) => (
        <section 
          key={index}
          className={`py-20 ${index % 2 === 0 ? 'bg-zinc-950' : 'bg-black'} relative overflow-hidden`}
        >
          <div className={`absolute ${index % 2 === 0 ? '-right-40' : '-left-40'} top-20 w-80 h-80 bg-orange-500/10 rounded-full filter blur-3xl`} />
          
          <div className="container mx-auto px-4">
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${index % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}>
              <motion.div
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-500/10 p-2 rounded-lg">
                    <feature.icon className="h-6 w-6 text-orange-500" />
                  </div>
                  <Badge className="bg-orange-500/20 text-orange-400 border-none">
                    Key Feature
                  </Badge>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  {feature.title}
                </h2>
                <p className="text-lg text-white/70 mb-8">
                  {feature.description}
                </p>
                
                <ul className="space-y-3 mb-8">
                  {feature.features.map((item, i) => (
                    <li key={i} className="flex items-center">
                      <div className="rounded-full bg-green-500/10 p-1 mr-3">
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                      <span className="text-white/90">{item}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="flex gap-4">
                  <Link href={index === 0 ? "/music-video-creator" : index === 1 ? "/analytics" : "/spotify"}>
                    <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/20">
                      {index === 0 ? "Create Music Video" : "Explore Now"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={index === 0 ? "/ai-video-creation" : "/features"}>
                    <Button variant="outline" className="border-white/20 hover:bg-white/10">
                      Learn More
                    </Button>
                  </Link>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: index % 2 === 0 ? 50 : -50 }}
                whileInView={{ opacity: 1, scale: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className={`rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/20 border-2 border-orange-500/20 hover:border-orange-500/40 transition-all duration-300`}
              >
                <div className="relative aspect-video bg-zinc-900">
                  {feature.image ? (
                    feature.image.endsWith('.mp4') ? (
                      <video 
                        src={feature.image}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img 
                        src={feature.image}
                        alt={feature.title}
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-zinc-900 to-zinc-800">
                      <feature.icon className="h-20 w-20 text-orange-500/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <Play className="h-16 w-16 text-orange-500" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      ))}


      {/* Pricing Section with Modern Design */}
      <section className="py-24 bg-gradient-to-b from-black to-zinc-950 relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500/10 rounded-full filter blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-red-500/10 rounded-full filter blur-3xl" />
        
        <div className="container relative mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge 
              className="mb-4 bg-orange-500/20 text-orange-400 border-orange-500/30 px-4 py-1 text-sm"
              variant="outline"
            >
              Flexible Plans
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Choose Your Plan</h2>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Subscription options designed to match your needs at every stage of your music career
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <PricingPlans simplified withAnimation />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-center mt-10"
          >
            <Link href="/pricing">
              <Button variant="link" className="text-orange-500 hover:text-orange-400">
                View all plans and features
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section with Modern Cards */}
      <section className="py-24 bg-zinc-950 relative overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full filter blur-3xl" />
        
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge 
              className="mb-4 bg-orange-500/20 text-orange-400 border-orange-500/30 px-4 py-1 text-sm"
              variant="outline"
            >
              Success Stories
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">What Artists Say</h2>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Join thousands of musicians who have transformed their careers with our platform
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          >
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -10 }}
                className="bg-black/40 backdrop-blur-sm border border-orange-500/10 rounded-xl p-8 hover:border-orange-500/30 transition-all duration-300 shadow-xl"
              >
                <div className="flex items-center mb-6">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-14 h-14 rounded-full mr-4 border-2 border-orange-500/30"
                  />
                  <div>
                    <h3 className="font-bold text-lg">{testimonial.name}</h3>
                    <p className="text-white/60">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-white/80 mb-6 text-lg italic">"{testimonial.content}"</p>
                <div className="flex">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-orange-400 fill-orange-400" />
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Modern CTA Section */}
      <section className="py-24 bg-gradient-to-r from-orange-500/20 to-red-500/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/assets/noise.svg')] opacity-[0.03] mix-blend-soft-light"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500/20 rounded-full filter blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-red-500/20 rounded-full filter blur-3xl animate-pulse" style={{ animationDuration: '14s' }} />
        
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
              Ready to Transform Your
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500 block">
                Music Career?
              </span>
            </h2>
            <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              Join thousands of artists who are using Boostify to reach new audiences, optimize their promotion, and grow their music careers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={handleGoogleLogin}
                className="relative overflow-hidden bg-white text-black hover:bg-white/90 shadow-xl px-8 py-6 text-lg font-medium transition-all duration-300"
              >
                Get Started Now
                <MoveRight className="ml-2 h-5 w-5" />
              </Button>
              <Link href="/pricing">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-white px-8 py-6 text-lg font-medium hover:bg-white/10"
                >
                  View Plans
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-white/60 text-sm">
              No credit card required for free tier • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* YouTube Growth Section with Animated Chart */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-b from-zinc-900 to-black">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl opacity-30" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full filter blur-3xl opacity-30" />
        
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-xl"
            >
              <Badge 
                className="mb-4 bg-blue-500/20 text-blue-400 border-blue-500/30 px-4 py-1 text-sm"
                variant="outline"
              >
                YouTube Promotion
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Boost Your Video Presence</h2>
              <p className="text-white/70 text-lg mb-8">
                Our advanced YouTube promotion strategies help you reach wider audiences and increase 
                engagement on your videos. Get real views, likes, and subscribers through our targeted 
                promotion campaigns.
              </p>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-1">500K+</h3>
                  <p className="text-white/70 text-sm">Monthly Views</p>
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-1">50K+</h3>
                  <p className="text-white/70 text-sm">New Subscribers</p>
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-1">90%</h3>
                  <p className="text-white/70 text-sm">Engagement Rate</p>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-4">Growth Analytics</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-white/70">Views Growth</span>
                    <span className="text-sm font-bold">80%</span>
                  </div>
                  <div className="bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <motion.div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full" 
                      initial={{ width: 0 }}
                      whileInView={{ width: "80%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, delay: 0.2 }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-white/70">Engagement Rate</span>
                    <span className="text-sm font-bold">90%</span>
                  </div>
                  <div className="bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <motion.div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full" 
                      initial={{ width: 0 }}
                      whileInView={{ width: "90%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, delay: 0.4 }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-white/70">Subscriber Growth</span>
                    <span className="text-sm font-bold">75%</span>
                  </div>
                  <div className="bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <motion.div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full" 
                      initial={{ width: 0 }}
                      whileInView={{ width: "75%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, delay: 0.6 }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600">
                  Promote Your Channel
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 50 }}
              whileInView={{ opacity: 1, scale: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-black/40 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 p-6"
            >
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4">Channel Growth</h3>
                <div className="relative h-64">
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10"></div>
                  <div className="absolute left-0 h-full w-1 bg-white/10"></div>
                  
                  {/* Chart Animation */}
                  <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
                      </linearGradient>
                    </defs>
                    
                    {/* Line graph */}
                    <motion.path
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                      d="M 0,180 C 40,160 80,140 120,100 S 160,40 200,30 S 280,20 320,50 S 360,90 400,20"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    
                    {/* Area under the line */}
                    <motion.path
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 2, delay: 1 }}
                      d="M 0,180 C 40,160 80,140 120,100 S 160,40 200,30 S 280,20 320,50 S 360,90 400,20 L 400,200 L 0,200 Z"
                      fill="url(#chartGradient)"
                    />
                    
                    {/* Dots for data points */}
                    {[
                      { x: 0, y: 180 },
                      { x: 80, y: 140 },
                      { x: 160, y: 40 },
                      { x: 240, y: 20 },
                      { x: 320, y: 50 },
                      { x: 400, y: 20 }
                    ].map((point, i) => (
                      <motion.circle
                        key={i}
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        fill="#3b82f6"
                        initial={{ opacity: 0, scale: 0 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.5 + (i * 0.2) }}
                      />
                    ))}
                  </svg>
                  
                  {/* Month labels */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-between px-2 text-xs text-white/50">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-bold mb-4">Views by Content Type</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                    <PlaySquare className="h-5 w-5 text-blue-400 mx-auto mb-2" />
                    <span className="text-sm text-white/70">Music Videos</span>
                    <p className="text-lg font-bold">45%</p>
                  </div>
                  <div className="rounded-lg bg-purple-500/10 p-3 text-center">
                    <Music2 className="h-5 w-5 text-purple-400 mx-auto mb-2" />
                    <span className="text-sm text-white/70">Live Performances</span>
                    <p className="text-lg font-bold">30%</p>
                  </div>
                  <div className="rounded-lg bg-pink-500/10 p-3 text-center">
                    <Users2 className="h-5 w-5 text-pink-400 mx-auto mb-2" />
                    <span className="text-sm text-white/70">Behind the Scenes</span>
                    <p className="text-lg font-bold">25%</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Nueva sección de educación musical con video de fondo */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-b from-zinc-950 to-black">
        <div className="absolute inset-0 z-0 opacity-50">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            className="w-full h-full object-cover"
            poster="/assets/education-poster.jpg"
          >
            <source src="/assets/hero-video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/70" />
        </div>
        
        <div className="container relative z-10 mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Intelligent <span className="text-gradient">Music Education</span>
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto text-lg">
              Transform your musical learning with interactive courses, real-time feedback, and an 
              AI-powered personalized approach that adapts to your learning style.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10 hover:border-white/20 transition"
            >
              <div className="rounded-full bg-orange-500/20 w-12 h-12 flex items-center justify-center mb-6">
                <Music2 className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Interactive Courses</h3>
              <p className="text-white/70">
                Learn at your own pace with interactive lessons that combine theory, practice, and real-time evaluation.
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10 hover:border-white/20 transition"
            >
              <div className="rounded-full bg-blue-500/20 w-12 h-12 flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Adaptive AI</h3>
              <p className="text-white/70">
                Our system adapts lessons to your level, identifying areas for improvement and suggesting personalized exercises.
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10 hover:border-white/20 transition"
            >
              <div className="rounded-full bg-green-500/20 w-12 h-12 flex items-center justify-center mb-6">
                <Users2 className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Global Community</h3>
              <p className="text-white/70">
                Connect with students and teachers from around the world, share projects, and participate in musical challenges.
              </p>
            </motion.div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <Link href="/education">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-6 text-lg font-medium hover:opacity-90"
              >
                Explore Courses <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
      
      {/* New AI music video creation section */}
      <section className="py-24 relative overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 z-0 opacity-80">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            className="w-full h-full object-cover"
          >
            <source src="/assets/Standard_Mode_Generated_Video (5).mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
        </div>
        
        <div className="container relative z-10 mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="md:w-1/2"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Create Music Videos with <span className="text-gradient">Artificial Intelligence</span>
              </h2>
              <p className="text-white/70 text-lg mb-8">
                Transform your songs into professional music videos in minutes, not weeks.
                Our AI technology generates videos that perfectly complement your musical style and artistic vision.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-purple-500/20 p-2 mt-1">
                    <Check className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Instant Generation</h3>
                    <p className="text-white/70">Create professional music videos in minutes, without the need for expensive equipment.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-purple-500/20 p-2 mt-1">
                    <Check className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Complete Creative Control</h3>
                    <p className="text-white/70">Customize every aspect of the video, from visual style to narrative and special effects.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-purple-500/20 p-2 mt-1">
                    <Check className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Music Integration</h3>
                    <p className="text-white/70">Our AI analyzes your song to create visuals that perfectly synchronize with the rhythm and energy.</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-10 flex flex-wrap gap-4">
                <Link href="/ai-video-creation">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-6 text-lg font-medium hover:opacity-90"
                    data-testid="button-create-music-video"
                  >
                    Create Music Video <Video className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                
                <Link href="/videos">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="border-white px-6 py-6 text-lg font-medium hover:bg-white/10"
                  >
                    View Examples
                  </Button>
                </Link>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
              className="md:w-1/2 aspect-video relative"
            >
              <div className="rounded-xl overflow-hidden border-2 border-purple-500/50 shadow-2xl shadow-purple-500/20">
                <video 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  disablePictureInPicture
                  disableRemotePlayback
                  className="w-full h-full object-cover"
                  poster="/assets/video-thumbnail.jpg"
                >
                  <source src="/assets/Standard_Mode_Generated_Video (6).mp4" type="video/mp4" />
                </video>
              </div>
              
              {/* Stylized playback controls as decoration */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 bg-black/50 backdrop-blur-sm rounded-lg p-3">
                <div className="w-2/3 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="w-1/2 h-full bg-purple-500 rounded-full"></div>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                    <div className="w-4 h-4 text-white flex items-center justify-center">⏸️</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured AI Music Video Example */}
      <section className="py-24 relative overflow-hidden bg-zinc-900">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Featured <span className="text-gradient">AI Music Video</span>
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto text-lg">
              Check out this example of a professionally generated music video created with our AI technology.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl shadow-orange-500/20 border-2 border-orange-500/30"
          >
            <div className="aspect-video relative bg-black">
              <video 
                className="w-full h-full object-cover"
                src="/assets/kling_20251109_Image_to_Video_dancing_sl_2309_0 (1)_1762701611874.mp4"
                autoPlay
                loop
                muted
                playsInline
              />
            </div>
            
            <div className="bg-zinc-800 p-6">
              <h3 className="text-xl font-bold text-white mb-2">Professional AI-Generated Music Video</h3>
              <p className="text-white/70">
                This video demonstrates the advanced capabilities of our AI technology in creating dynamic, 
                professional music videos that perfectly capture the energy and style of your music.
              </p>
              
              <div className="mt-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-orange-400" />
                  <span className="text-white/70">AI-Generated • Professional Quality</span>
                </div>
                
                <Link href="/music-video-creator">
                  <Button 
                    variant="ghost" 
                    className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                    data-testid="button-create-your-own"
                  >
                    Create Your Own <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Copyright / Legal protection trust band */}
      <section className="py-16 bg-gradient-to-b from-zinc-950 to-black relative overflow-hidden border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto rounded-3xl border border-orange-500/20 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center gap-8">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300 mb-4">
                  <Shield className="h-4 w-4" /> Legally protected platform
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  Your music and content, protected
                </h2>
                <p className="text-white/70 text-sm md:text-base leading-relaxed mb-5">
                  Every file you upload is registered with a digital fingerprint (SHA-256) and protected under our
                  DMCA-compliant copyright system. Artist verification, automatic content scanning and a legal team
                  that responds to any claim.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/legal">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2" data-testid="home-legal-center">
                      <Scale className="h-4 w-4" /> Legal Center
                    </Button>
                  </Link>
                  <Link href="/legal/dmca">
                    <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 gap-2">
                      DMCA Policy
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:w-80">
                {[
                  { emoji: "🔒", title: "SHA-256 fingerprint", desc: "On every upload" },
                  { emoji: "⚖️", title: "DMCA compliance", desc: "Notice & Takedown" },
                  { emoji: "🛡️", title: "Automatic scanning", desc: "Before publishing" },
                  { emoji: "🟢", title: "Verified artists", desc: "5 badge levels" },
                ].map((it) => (
                  <div key={it.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-2xl mb-1">{it.emoji}</div>
                    <div className="text-sm font-semibold text-white">{it.title}</div>
                    <div className="text-xs text-white/50">{it.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Founder Modal */}
      <Dialog open={showFounderModal} onOpenChange={setShowFounderModal}>
        <DialogContent className="max-w-2xl bg-zinc-950 border-orange-500/20 p-0 overflow-hidden">
          {/* Header with image */}
          <div className="relative bg-gradient-to-br from-orange-500/20 via-red-500/10 to-transparent p-8 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute -inset-1 bg-gradient-to-br from-orange-500 via-red-500 to-orange-600 rounded-full blur-sm opacity-60" />
              <img
                src="/images/founder.webp"
                alt="Neiver Alvarez - Founder & CEO"
                className="relative w-28 h-28 rounded-full object-cover border-2 border-orange-500/50"
              />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white">Neiver Alvarez</DialogTitle>
            </DialogHeader>
            <p className="text-orange-400 font-medium text-sm mt-1">Founder & CEO, Boostify Music</p>
          </div>
          {/* Body */}
          <ScrollArea className="max-h-[60vh]">
            <div className="px-8 pb-8 space-y-5">
              <p className="text-white/80 leading-relaxed text-[15px]">
                Boostify Music was born from a deep understanding of the challenges independent artists face every day. In an industry dominated by major labels with unlimited budgets, independent musicians often lack the tools, visibility, and resources needed to break through the noise. That&apos;s exactly why I created Boostify &mdash; to level the playing field. Our platform brings together AI-powered video creation, cross-platform analytics, smart promotion tools, music distribution, and even Web3 tokenization, all under one roof. Every feature we build is designed with one question in mind: <span className="text-orange-400 font-medium">&ldquo;How does this help an artist grow?&rdquo;</span> We believe that talent should never be limited by resources, and that every musician deserves professional-grade tools regardless of their budget or label status.
              </p>
              <p className="text-white/80 leading-relaxed text-[15px]">
                The future of the music industry belongs to creators who own their narrative, their data, and their art. Boostify Music is more than a platform &mdash; it&apos;s a movement to put power back in the hands of artists. From the emerging bedroom producer to the touring independent artist, we are building a complete ecosystem where creativity meets technology. Our vision is a world where any artist, anywhere, can access the same caliber of tools that were once exclusive to the top 1%. With features like our AI Artist generation system, the BoostiSwap token marketplace, and intelligent career advisors, we&apos;re not just keeping up with the industry &mdash; we&apos;re reshaping it. Thank you for believing in this mission. Together, we&apos;re building something unprecedented.
              </p>
              <div className="pt-3 border-t border-white/10 text-right">
                <p className="text-orange-400 font-semibold italic">&mdash; Neiver Alvarez</p>
                <p className="text-white/40 text-xs mt-1">Founder & CEO, Boostify Music</p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* BTF-2300 Whitepaper Modal */}
      <Dialog open={showWhitepaperModal} onOpenChange={setShowWhitepaperModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-zinc-900 border-purple-500/30">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <FileCode className="h-6 w-6 text-purple-400" />
              </div>
              BTF-2300 Whitepaper
              <Badge className="ml-2 bg-purple-500/20 text-purple-300 border-purple-500/30">
                NFT 3.0
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-8 text-white/80">
              {/* Header */}
              <div className="text-center py-6 border-b border-purple-500/20">
                <h1 className="text-3xl font-bold text-white mb-2">BTF-2300</h1>
                <p className="text-purple-400 text-lg">Boostify Token Framework 2300</p>
                <p className="text-white/60 italic mt-2">The Artist as a Programmable Digital Entity</p>
              </div>

              {/* Abstract */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-400" />
                  Abstract
                </h2>
                <p className="leading-relaxed">
                  BTF-2300 (Boostify Token Framework 2300) is a next-generation blockchain standard designed to represent a <strong className="text-purple-400">complete digital artist</strong> as a single programmable on-chain entity. Unlike traditional NFTs that encapsulate a single asset, BTF-2300 introduces a modular architecture where an artist's <strong className="text-white">identity, catalog, licenses, revenues, and legal permissions</strong> are unified under one interoperable framework.
                </p>
                <p className="mt-3 leading-relaxed">
                  This standard redefines digital ownership in the creative economy, enabling artists, platforms, and enterprises to operate at scale with <strong className="text-white">automation, transparency, and composability</strong>.
                </p>
                <p className="mt-3 text-purple-400 font-semibold">
                  BTF-2300 can be understood as the NFT 3.0 standard.
                </p>
              </div>

              {/* Problem Statement */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <X className="h-5 w-5 text-red-400" />
                  Problem Statement
                </h2>
                <p className="mb-3">The current NFT ecosystem suffers from structural limitations:</p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    NFTs represent <strong>individual assets</strong>, not creators
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    Fragmented ownership across multiple tokens
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    No native representation of <strong>artist identity</strong>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    Royalties depend on marketplace goodwill
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    Licensing is handled <strong>off-chain</strong>, legally weak, and unverifiable
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    No standard for managing an artist's full digital lifecycle
                  </li>
                </ul>
              </div>

              {/* Vision */}
              <div className="bg-purple-500/10 rounded-xl p-6 border border-purple-500/20">
                <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  Vision
                </h2>
                <blockquote className="text-xl text-center italic text-purple-300 my-4">
                  "An artist is not a file.<br/>
                  An artist is a programmable digital entity."
                </blockquote>
                <p className="leading-relaxed">
                  The framework transforms artists into <strong className="text-white">on-chain digital objects</strong> that can: Own assets, Issue licenses, Receive revenues, Enforce rules, and Interact with platforms autonomously.
                </p>
              </div>

              {/* Core Architecture */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-400" />
                  Core Architecture
                </h2>
                <p className="mb-4">BTF-2300 is a <strong>multi-contract standard</strong> composed of four core layers:</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800/50 rounded-lg p-4 border border-purple-500/10">
                    <h4 className="font-bold text-purple-400 mb-1">Identity Layer</h4>
                    <p className="text-sm">ERC-721 artist token - One token = One artist</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4 border border-purple-500/10">
                    <h4 className="font-bold text-purple-400 mb-1">Asset Layer</h4>
                    <p className="text-sm">ERC-1155 assets & licenses (music, videos, stems)</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4 border border-purple-500/10">
                    <h4 className="font-bold text-purple-400 mb-1">Revenue Layer</h4>
                    <p className="text-sm">Royalty splitter contracts (80% Artist / 20% Platform)</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4 border border-purple-500/10">
                    <h4 className="font-bold text-purple-400 mb-1">Legal Layer</h4>
                    <p className="text-sm">EIP-712 signed licensing - On-chain legal contracts</p>
                  </div>
                </div>
              </div>

              {/* Comparison Table */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-purple-400" />
                  Comparison with Traditional NFTs
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-purple-500/20">
                        <th className="text-left py-2 text-white">Feature</th>
                        <th className="text-center py-2 text-red-400">NFT (ERC-721)</th>
                        <th className="text-center py-2 text-green-400">BTF-2300</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/70">
                      <tr className="border-b border-zinc-800"><td className="py-2">Represents artist</td><td className="text-center">❌</td><td className="text-center">✅</td></tr>
                      <tr className="border-b border-zinc-800"><td className="py-2">Multiple assets</td><td className="text-center">❌</td><td className="text-center">✅</td></tr>
                      <tr className="border-b border-zinc-800"><td className="py-2">Native licensing</td><td className="text-center">❌</td><td className="text-center">✅</td></tr>
                      <tr className="border-b border-zinc-800"><td className="py-2">On-chain revenue split</td><td className="text-center">❌</td><td className="text-center">✅</td></tr>
                      <tr className="border-b border-zinc-800"><td className="py-2">Legal enforceability</td><td className="text-center">❌</td><td className="text-center">✅</td></tr>
                      <tr className="border-b border-zinc-800"><td className="py-2">One-click creation</td><td className="text-center">❌</td><td className="text-center">✅</td></tr>
                      <tr><td className="py-2">Platform automation</td><td className="text-center">❌</td><td className="text-center">✅</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Why Polygon */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-purple-400" />
                  Why Polygon
                </h2>
                <p className="mb-3">BTF-2300 is deployed on <strong className="text-purple-400">Polygon PoS</strong> because it offers:</p>
                <div className="grid grid-cols-3 gap-3">
                  {['Ultra-low gas fees', 'High throughput', 'Ethereum compatibility', 'Enterprise adoption', 'Marketplace support', 'Long-term scalability'].map((item, i) => (
                    <div key={i} className="bg-zinc-800/50 rounded-lg p-3 text-center text-sm border border-purple-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-400 mx-auto mb-1" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Security */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-400" />
                  Security Design
                </h2>
                <ul className="grid grid-cols-2 gap-2">
                  {['OpenZeppelin audited primitives', 'Role-based access control', 'Reentrancy protection', 'Anti-replay license enforcement', 'Explicit upgrade path', 'Emergency pause supported'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 bg-zinc-800/30 rounded-lg p-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Conclusion */}
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-purple-500/20">
                <h2 className="text-xl font-bold text-white mb-3">Conclusion</h2>
                <p className="mb-4">BTF-2300 is not just a smart contract. It is:</p>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-purple-400" /> A <strong>new digital standard</strong></li>
                  <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-purple-400" /> A <strong>creator operating system</strong></li>
                  <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-purple-400" /> A <strong>legal-financial bridge</strong></li>
                  <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-purple-400" /> A <strong>scalable artist economy engine</strong></li>
                </ul>
                <blockquote className="text-lg text-center italic text-purple-300 border-t border-purple-500/20 pt-4">
                  "NFTs represented files.<br/>
                  <strong>BTF-2300 represents creators.</strong>"
                </blockquote>
              </div>

              {/* Footer */}
              <div className="text-center text-white/50 text-sm border-t border-purple-500/20 pt-4">
                <p>BTF-2300 is an <strong className="text-white">original framework</strong> developed by Boostify.</p>
                <p className="mt-1">© 2025 Boostify. All rights reserved.</p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}