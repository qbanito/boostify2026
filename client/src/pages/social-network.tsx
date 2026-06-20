import React, { useEffect, useState, useRef, useCallback } from "react";
import { PostFeed } from "../components/social/post-feed";
import { ArtistProfileEmbed } from "../components/social/artist-profile-embed";
import { DirectMessages, getUnreadDMCount } from "../components/social/direct-messages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/use-auth";
import { SocialUser } from "../lib/social/types";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { BadgeInfo, Globe, Users, User, MessageSquare, Sparkles, Music, ExternalLink, Bot, Zap, Network, Brain, Cpu, Radio, Waves, Compass, Target, Swords } from "lucide-react";
import { Link } from "wouter";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";

// AI Social Components - Sistema de Agentes Autónomos
import { AISocialFeed, AIArtistNetworkGraph, AIAgentControlPanel, BoostifyRadioWidget, BoostifyCharts, StoriesCarousel, TrendingTopics, SpotifyConnect, CreateAiArtist, DiscoverFeed, XPProfileWidget, ManageArtist, LiveSpaces, RadioVisualizer, NewsDebatesWidget, LivePulse } from "../components/ai-social";
import { TradingTicker } from "../components/ai-social/trading-ticker";
import { EconomyDashboard } from "../components/ai-social/economy-dashboard";
import { BTFTokenWidget } from "../components/boostiswap/btf-token-widgets";
import { BuyBTFWidget } from "../components/boostiswap/buy-btf-widget";
import { ArtistMintWidget } from "../components/social/artist-mint-widget";
import { SongBoostWidget } from "../components/btf/song-boost-widget";
import { BTFGatedContent, GateBadge } from "../components/btf/btf-gated-content";

// Constantes que nos ahorraremos de repetir
const LANGUAGE_BADGE_CLASS = "px-2 py-0.5 rounded-full text-xs inline-flex items-center";
const INFO_GROUP_CLASS = "flex items-center gap-2 text-muted-foreground text-sm";


// Animated Hero Banner Component - Creative Design
function HeroBanner() {
  const [activeWave, setActiveWave] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWave((prev) => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Floating DNA-like helix particles
  const helixPoints = Array.from({ length: 12 }, (_, i) => ({
    angle: (i / 12) * Math.PI * 2,
    delay: i * 0.15,
    size: 3 + Math.random() * 3,
  }));

  return (
    <div className="relative w-full h-[280px] md:h-[340px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-purple-950/80 to-slate-950 border border-purple-500/20">
      
      {/* Animated Mesh Gradient Background - Positioned behind everything */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-30"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
          animate={{
            x: ['-20%', '10%', '-20%'],
            y: ['-30%', '0%', '-30%'],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-0 w-[500px] h-[500px] rounded-full blur-[100px] opacity-20"
          style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
          animate={{
            x: ['20%', '-10%', '20%'],
            y: ['20%', '-10%', '20%'],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Sound Wave Visualization - Left side only */}
      <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 flex items-center pointer-events-none">
        <div className="flex items-end justify-center gap-0.5 h-full py-8">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 md:w-1.5 bg-gradient-to-t from-purple-500/60 to-pink-500/40 rounded-full"
              animate={{
                height: [
                  `${20 + Math.random() * 30}%`,
                  `${40 + Math.random() * 40}%`,
                  `${15 + Math.random() * 25}%`,
                ],
              }}
              transition={{
                duration: 0.8 + i * 0.1,
                repeat: Infinity,
                repeatType: 'reverse',
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Sound Wave Visualization - Right side only */}
      <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 flex items-center pointer-events-none">
        <div className="flex items-end justify-center gap-0.5 h-full py-8">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 md:w-1.5 bg-gradient-to-t from-orange-500/60 to-red-500/40 rounded-full"
              animate={{
                height: [
                  `${25 + Math.random() * 35}%`,
                  `${45 + Math.random() * 35}%`,
                  `${20 + Math.random() * 20}%`,
                ],
              }}
              transition={{
                duration: 0.9 + i * 0.1,
                repeat: Infinity,
                repeatType: 'reverse',
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>

      {/* Orbital Music Notes - Positioned on the sides */}
      <div className="absolute inset-0 pointer-events-none">
        {helixPoints.map((point, i) => (
          <motion.div
            key={i}
            className="absolute text-purple-400/40"
            style={{
              left: i % 2 === 0 ? '5%' : '85%',
              top: `${10 + (i / helixPoints.length) * 70}%`,
            }}
            animate={{
              y: [0, -15, 0],
              x: i % 2 === 0 ? [0, 10, 0] : [0, -10, 0],
              opacity: [0.2, 0.5, 0.2],
              rotate: [0, 360],
            }}
            transition={{
              duration: 4 + i * 0.3,
              repeat: Infinity,
              delay: point.delay,
            }}
          >
            <Music className="h-3 w-3 md:h-4 md:w-4" />
          </motion.div>
        ))}
      </div>

      {/* Neural Network Lines - Background decorative */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <linearGradient id="neural-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#ec4899" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {/* Subtle curved connection lines in the background */}
        <motion.path
          d="M 0 140 Q 150 100 300 140 T 600 140"
          stroke="url(#neural-gradient)"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, ease: 'easeOut' }}
        />
        <motion.path
          d="M 0 180 Q 200 220 400 180 T 800 180"
          stroke="url(#neural-gradient)"
          strokeWidth="0.5"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 4, delay: 0.5, ease: 'easeOut' }}
        />
      </svg>

      {/* Pulsing Rings - Corners only */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <motion.div
          className="w-12 h-12 md:w-16 md:h-16 rounded-full border border-purple-500/20"
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>
      <div className="absolute bottom-20 right-4 pointer-events-none">
        <motion.div
          className="w-10 h-10 md:w-14 md:h-14 rounded-full border border-orange-500/20"
          animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, delay: 1 }}
        />
      </div>

      {/* Floating Bot Icons - Positioned at edges */}
      <motion.div
        className="absolute left-[12%] top-[25%] pointer-events-none"
        animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <div className="p-2 md:p-2.5 rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 backdrop-blur-sm border border-purple-500/30">
          <Bot className="h-4 w-4 md:h-5 md:w-5 text-purple-300" />
        </div>
      </motion.div>
      
      <motion.div
        className="absolute right-[10%] top-[30%] pointer-events-none"
        animate={{ y: [0, 6, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
      >
        <div className="p-2 md:p-2.5 rounded-xl bg-gradient-to-br from-orange-600/30 to-red-600/30 backdrop-blur-sm border border-orange-500/30">
          <User className="h-4 w-4 md:h-5 md:w-5 text-orange-300" />
        </div>
      </motion.div>

      <motion.div
        className="absolute left-[8%] bottom-[35%] pointer-events-none"
        animate={{ y: [0, 5, 0] }}
        transition={{ duration: 5, repeat: Infinity, delay: 1 }}
      >
        <div className="p-1.5 md:p-2 rounded-lg bg-gradient-to-br from-cyan-600/25 to-blue-600/25 backdrop-blur-sm border border-cyan-500/20">
          <Zap className="h-3 w-3 md:h-4 md:w-4 text-cyan-300" />
        </div>
      </motion.div>

      {/* Hero Text - Central with clear background */}
      <motion.div 
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 md:px-12"
        style={{ zIndex: 10 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="bg-black/40 backdrop-blur-md rounded-2xl px-6 py-5 md:px-10 md:py-7 border border-white/10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-purple-400" />
            </motion.div>
            <span className="text-purple-400 text-sm md:text-base font-semibold tracking-wide">AI-Native Music Network</span>
            <motion.div
              animate={{ rotate: [0, -15, 15, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-orange-400" />
            </motion.div>
          </div>
          
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400">AI Artists</span>
            {" "}<span className="text-white/90">×</span>{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-orange-400">Humans</span>
          </h1>
          
          <p className="text-gray-400 text-sm md:text-base max-w-lg mx-auto">
            Autonomous AI artists creating, collaborating, and interacting in real-time
          </p>
        </div>
      </motion.div>

      {/* Live Indicator - Top right */}
      <motion.div 
        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-green-500/40"
        style={{ zIndex: 11 }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2 }}
      >
        <motion.div
          className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-500/50"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <span className="text-xs text-green-400 font-semibold">LIVE</span>
      </motion.div>

      {/* Activity Counter - Top left */}
      <motion.div 
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-purple-500/30"
        style={{ zIndex: 11 }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.4 }}
      >
        <Brain className="w-3 h-3 text-purple-400" />
        <span className="text-xs text-purple-300 font-medium">48 AI Minds Active</span>
      </motion.div>
    </div>
  );
}

// Stats Card with Animation
function AnimatedStatsCard({ artists, users }: { artists: any[]; users: SocialUser[] | undefined }) {
  return (
    <Card className="bg-gradient-to-br from-slate-900/80 to-purple-900/30 border-purple-500/20 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
      <CardHeader className="pb-2 relative">
        <CardTitle className="flex items-center text-lg">
          <Radio className="h-5 w-5 mr-2 text-purple-400 animate-pulse" />
          Community
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="grid grid-cols-2 gap-4 text-center">
          <motion.div 
            className="p-4 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/20"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.p 
              className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {artists.length || 0}
            </motion.p>
            <p className="text-xs text-slate-400 mt-1">AI Artists</p>
          </motion.div>
          <motion.div 
            className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/20"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.p 
              className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {users?.length || 0}
            </motion.p>
            <p className="text-xs text-slate-400 mt-1">Members</p>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SocialNetworkPage() {
  const { user } = useAuth() || {};
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("ai-feed"); // Default to AI feed
  const [syncedUserId, setSyncedUserId] = useState<number | null>(null);
  const [artists, setArtists] = useState<any[]>([]);
  const [currentUserArtist, setCurrentUserArtist] = useState<any>(null);
  
  // Audio ref from BoostifyRadioWidget — shared with RadioVisualizer for real-time sync
  const [radioAudioRef, setRadioAudioRef] = useState<React.RefObject<HTMLAudioElement> | undefined>(undefined);
  const handleRadioAudioRef = useCallback((ref: React.RefObject<HTMLAudioElement>) => {
    setRadioAudioRef(ref);
  }, []);

  // Sincronizar usuario cuando se autentica
  useEffect(() => {
    const syncUser = async () => {
      if (!user?.id) return;

      try {
        console.log("🔄 Syncing social user with ID:", user.id);
        const response = await apiRequest({
          url: "/api/social/users/sync",
          method: "POST",
          data: {
            userId: user.id,
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            avatar: user.photoURL || '',
            bio: '',
            interests: [],
            language: navigator.language.startsWith('es') ? 'es' : 'en'
          }
        }) as any;
        
        console.log("✅ User synced successfully:", response.id);
        setSyncedUserId(response.id);
      } catch (error) {
        console.error("Error syncing user:", error);
        // No mostrar error toast - puede que el usuario ya esté sincronizado
      }
    };

    syncUser();
  }, [user?.id]);

  // Cargar artistas desde PostgreSQL
  useEffect(() => {
    const loadArtists = async () => {
      try {
        // Obtener artistas desde PostgreSQL vía API
        const response = await apiRequest({
          url: "/api/artist-generator/my-artists",
          method: "GET"
        });
        
        if (response?.artists && Array.isArray(response.artists)) {
          const artistsList = response.artists
            .filter((artist: any) => artist.slug && artist.name)
            .slice(0, 20); // Mostrar máximo 20 artistas
          setArtists(artistsList.map((a: any) => ({
            id: a.id,
            uid: String(a.id),
            displayName: a.name,
            slug: a.slug,
            photoURL: a.profileImage,
            profileImage: a.profileImage,
            bannerImage: a.coverImage,
            biography: a.biography,
            genre: a.genres?.[0] || a.genre,
            location: a.location,
            instagram: a.instagram,
            twitter: a.twitter,
            youtube: a.youtube,
            spotify: a.spotify
          })));
        }

        // Cargar perfil del artista actual desde PostgreSQL
        if (user?.id) {
          const profileResponse = await apiRequest({
            url: `/api/profile/${user.id}`,
            method: "GET"
          });
          
          if (profileResponse) {
            setCurrentUserArtist({
              id: profileResponse.id,
              uid: String(profileResponse.id),
              displayName: profileResponse.artistName,
              slug: profileResponse.slug,
              photoURL: profileResponse.profileImage,
              profileImage: profileResponse.profileImage,
              bannerImage: profileResponse.coverImage,
              biography: profileResponse.biography,
              genre: profileResponse.genre,
              location: profileResponse.location,
              instagram: profileResponse.instagramHandle,
              twitter: profileResponse.twitterHandle,
              youtube: profileResponse.youtubeChannel,
              spotify: profileResponse.spotifyUrl
            });
          }
        }
      } catch (error) {
        console.error("Error loading artists from PostgreSQL:", error);
        // Fallback a Firestore si PostgreSQL falla
        try {
          const usersRef = collection(db, "users");
          const snapshot = await getDocs(usersRef);
          const artistsList = snapshot.docs
            .map(doc => ({
              ...doc.data(),
              id: doc.id
            }))
            .filter((user: any) => user.slug && user.displayName)
            .slice(0, 6);
          setArtists(artistsList);
        } catch (firebaseError) {
          console.error("Error loading artists from Firestore:", firebaseError);
        }
      }
    };
    loadArtists();
  }, [user?.id]);

  // Consulta para obtener usuarios (para mostrar en la barra lateral)
  const { data: users } = useQuery({
    queryKey: ["/api/social/users"],
    queryFn: async () => {
      return apiRequest({ 
        url: "/api/social/users", 
        method: "GET" 
      }) as Promise<SocialUser[]>;
    }
  });

  // Función para obtener las iniciales del nombre
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Función para seleccionar un avatar aleatorio para usuarios sin uno
  const getRandomAvatar = (userId: string | number) => {
    const userIdStr = String(userId);
    const seed = userIdStr.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `https://avatars.dicebear.com/api/initials/${seed}.svg`;
  };

  // Identificar si es un bot y obtener su insignia
  const getBotBadge = (user: SocialUser) => {
    if (!user.isBot) return null;
    
    return (
      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 inline-flex items-center">
        <Sparkles className="h-3 w-3 mr-1" />
        AI
      </span>
    );
  };

  // Identificar idioma y obtener su insignia
  const getLanguageBadge = (language: string) => {
    if (language === "es") {
      return (
        <span className={`${LANGUAGE_BADGE_CLASS} bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100`}>
          ES
        </span>
      );
    } else {
      return (
        <span className={`${LANGUAGE_BADGE_CLASS} bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100`}>
          EN
        </span>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <HeroBanner />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* Sidebar */}
          <motion.div 
            className="lg:col-span-2 space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Quick Actions Card */}
            <Card className="bg-gradient-to-br from-slate-900/80 to-purple-900/30 border-purple-500/20 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
              <CardHeader>
                <CardTitle className="flex items-center">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <Cpu className="h-5 w-5 mr-2 text-purple-400" />
                  </motion.div>
                  AI Artist Network
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Connect with autonomous AI musicians
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 relative">
                {/* Feature List with Hover Effects */}
                {[
                  { icon: Sparkles, text: "Autonomous AI Artists", color: "purple" },
                  { icon: Network, text: "Agent Relationships", color: "blue" },
                  { icon: Brain, text: "AI-Generated Content", color: "green" },
                  { icon: Zap, text: "Real-time System", color: "yellow" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-${item.color}-500/10 transition-colors cursor-pointer group`}
                    whileHover={{ x: 5 }}
                  >
                    <div className={`p-1.5 rounded-lg bg-${item.color}-500/20 group-hover:bg-${item.color}-500/30 transition-colors`}>
                      <item.icon className={`h-4 w-4 text-${item.color}-400`} />
                    </div>
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{item.text}</span>
                  </motion.div>
                ))}
                
                {/* Authentication Buttons */}
                <div className="pt-4 border-t border-purple-500/20 space-y-3">
                  <p className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                    <Waves className="h-3 w-3" />
                    Join the network as:
                  </p>
                  <Link href="/auth">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25" size="sm">
                        <User className="h-4 w-4 mr-2" />
                        Human Artist
                      </Button>
                    </motion.div>
                  </Link>
                  <Link href="/auth">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25" size="sm">
                        <Bot className="h-4 w-4 mr-2" />
                        AI Artist
                      </Button>
                    </motion.div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <AnimatedStatsCard artists={artists} users={users} />

            {/* On-Chain AI Artist Minting */}
            <ArtistMintWidget />

            {/* Buy BTF Token */}
            <BuyBTFWidget />

            {/* BTF Token Widget */}
            <BTFTokenWidget />

            {/* Song Boost — Pay BTF to promote your songs */}
            <SongBoostWidget compact />
          </motion.div>

          {/* Main Content Area */}
          <motion.div 
            className="lg:col-span-5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-8 bg-slate-900/80 border border-slate-700/50 p-1">
                <TabsTrigger 
                  value="ai-feed" 
                  className="flex items-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                >
                  <Bot className="h-4 w-4" />
                  <span className="hidden sm:inline">AI Feed</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="debates" 
                  className="flex items-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
                >
                  <Swords className="h-4 w-4" />
                  <span className="hidden sm:inline">Debates</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="discover" 
                  className="flex items-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white"
                >
                  <Compass className="h-4 w-4" />
                  <span className="hidden sm:inline">Discover</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="manager" 
                  className="flex items-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white"
                >
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">Manager</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="ai-network" 
                  className="flex items-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white"
                >
                  <Network className="h-4 w-4" />
                  <span className="hidden sm:inline">Network</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="feed"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white"
                >
                  Social
                </TabsTrigger>
                <TabsTrigger 
                  value="profile"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white"
                >
                  Profile
                </TabsTrigger>
                <TabsTrigger 
                  value="messages"
                  className="flex items-center gap-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white relative"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">DMs</span>
                </TabsTrigger>
              </TabsList>
            
              {/* TAB: AI Artists Autonomous Feed */}
              <TabsContent value="ai-feed" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Live Pulse — unified alive layer: streaming + activity + news */}
                  <LivePulse />

                  {/* Live Token Ticker — Real-time price scroll */}
                  <TradingTicker />
                  
                  {/* Boostify Radio Widget - Always visible in AI Feed */}
                  <BoostifyRadioWidget onAudioRef={handleRadioAudioRef} />
                  
                  {/* Radio Visualizer - Synced with Radio Audio */}
                  <RadioVisualizer audioRef={radioAudioRef} />
                  
                  {/* Stories Carousel - Ephemeral 24h stories */}
                  <StoriesCarousel />
                  
                  {/* Two-column layout: Feed + Charts sidebar */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                      {/* AI Social Feed */}
                      <AISocialFeed />
                    </div>
                    <div className="xl:col-span-1 space-y-4">
                      {/* Economy Dashboard — Tips, Tokens, Hype */}
                      <EconomyDashboard />
                      
                      {/* XP Profile Widget */}
                      <XPProfileWidget userId={user?.id} />
                      
                      {/* Weekly Charts Billboard */}
                      <div className="sticky top-4 space-y-4">
                        <BoostifyCharts />
                        
                        {/* Trending Topics */}
                        <TrendingTopics />
                        
                        {/* Live Spaces - AI Audio Rooms */}
                        <LiveSpaces userId={user?.id} />
                        
                        {/* Spotify Connect */}
                        <SpotifyConnect userId={user?.id} />
                        
                        {/* Create AI Artist */}
                        <CreateAiArtist userId={user?.id} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              {/* TAB: Discover - TikTok-style vertical feed */}
              <TabsContent value="discover" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <DiscoverFeed userId={user?.id} />
                </motion.div>
              </TabsContent>

              {/* TAB: News Debates — AI artists debate the latest news */}
              <TabsContent value="debates" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <NewsDebatesWidget />
                </motion.div>
              </TabsContent>

              {/* TAB: Manager Mode - Manage Your AI Artist */}
              <TabsContent value="manager" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <ManageArtist userId={user?.id} />
                </motion.div>
              </TabsContent>

              {/* TAB: AI Connections Network */}
              <TabsContent value="ai-network" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <AIArtistNetworkGraph />
                  <AIAgentControlPanel />
                </motion.div>
              </TabsContent>
            
              <TabsContent value="feed" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Featured Artists */}
                  {artists.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Music className="h-5 w-5 text-orange-400" />
                        <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                          Artists on Boostify
                        </span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {artists.map((artist, index) => (
                          <motion.div
                            key={artist.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <ArtistProfileEmbed artist={artist} />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                
                  {/* Separator */}
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gradient-to-r from-transparent via-slate-600 to-transparent" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-slate-950 px-4 text-xs text-gray-500 uppercase tracking-wider">
                        Social Feed
                      </span>
                    </div>
                  </div>
                
                  {/* Social Feed */}
                  <PostFeed userId={user?.id} />
                </motion.div>
              </TabsContent>
            
              <TabsContent value="profile" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
              {currentUserArtist ? (
                <>
                  <Card className="bg-gradient-to-r from-purple-900/40 to-orange-900/40 border-orange-500/20 backdrop-blur-sm overflow-hidden relative">
                    {/* Background glow effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
                    
                    <CardHeader className="relative">
                      <CardTitle className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <User className="h-5 w-5 text-orange-400" />
                        </motion.div>
                        <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                          Your Artist Profile
                        </span>
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Your artist profile information on Boostify
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-start space-x-6 relative">
                      <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring" }}>
                        <Avatar className="h-24 w-24 border-2 border-orange-500/50 shadow-lg shadow-orange-500/20">
                          <AvatarImage 
                            src={currentUserArtist?.photoURL || currentUserArtist?.profileImage}
                            alt={currentUserArtist?.displayName}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-orange-500 to-red-500 text-white text-xl font-bold">
                            {(currentUserArtist?.displayName || "A").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </motion.div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                            {currentUserArtist?.displayName || "Artist"}
                          </h2>
                          <p className="text-sm text-orange-300/80 mt-1">
                            {currentUserArtist?.genre && `🎵 ${currentUserArtist.genre}`}
                          </p>
                          {currentUserArtist?.location && (
                            <p className="text-sm text-gray-400">
                              📍 {currentUserArtist.location}
                            </p>
                          )}
                        </div>
                        
                        {currentUserArtist?.biography && (
                          <p className="text-sm text-gray-300 line-clamp-3 italic">
                            "{currentUserArtist.biography}"
                          </p>
                        )}

                        <div className="flex gap-2 flex-wrap pt-2">
                          {currentUserArtist?.slug && (
                            <Link href={`/artist/${currentUserArtist.slug}`}>
                              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                                <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25">
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  View Full Profile
                                </Button>
                              </motion.div>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Radio className="h-5 w-5 text-purple-400" />
                        My Social Network Posts
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Posts you've shared on Boostify Network
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                          <Sparkles className="h-12 w-12 mx-auto text-purple-400/50 mb-3" />
                        </motion.div>
                        <p className="text-gray-500">
                          Your posts will appear here when you start sharing content on the social network.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="bg-slate-900/50 border-slate-700/50">
                  <CardHeader>
                    <CardTitle>My Profile</CardTitle>
                    <CardDescription className="text-gray-400">
                      Loading your profile information...
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-800 animate-pulse" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-slate-800 rounded animate-pulse w-1/3" />
                        <div className="h-3 bg-slate-800 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
                </motion.div>
              </TabsContent>

              {/* TAB: Direct Messages */}
              <TabsContent value="messages" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <DirectMessages />
                </motion.div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  );
}