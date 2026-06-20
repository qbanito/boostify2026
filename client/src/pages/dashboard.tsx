import { TrendChart } from "../components/analytics/trend-chart";
import { StatsCard } from "../components/marketing/stats-card";
import { PlaylistManager } from "../components/spotify/playlist-manager";
import { InstagramConnect } from "../components/instagram/instagram-connect";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
import {
  Music2,
  TrendingUp,
  Activity,
  Users,
  Calendar,
  Globe,
  Youtube,
  FileText,
  Megaphone,
  Building2,
  Store,
  Video,
  Bot,
  Phone,
  Palette,
  GraduationCap,
  ShoppingBag,
  Sparkles,
  Tv,
  Music,
  User,
  CreditCard,
  Puzzle,
  Layers
} from "lucide-react";
import { SiInstagram, SiSpotify, SiYoutube } from "react-icons/si";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/use-auth";
import { Card } from "../components/ui/card";
import { Link, useLocation } from "wouter";
import { useToast } from "../hooks/use-toast";
import { motion } from 'framer-motion';
import EcosystemDashboard from "../components/dashboard/ecosystem-dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Header } from "../components/layout/header";
import { ensureFirebaseAuth } from "../lib/firebase-auth";
import { logger } from "../lib/logger";
import { HowBoostifyWorks } from "../components/modals/how-boostify-works";


export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [metrics, setMetrics] = useState({
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
  const [initialized, setInitialized] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    // Solo ejecutar una vez
    if (initialized) return;
    setInitialized(true);

    // No redirigir - ProtectedRoute ya maneja esto
    if (!user) {
      logger.warn('Usuario no autenticado en Dashboard');
      return;
    }

    // Initialize metrics with default values
    // TODO: Implement PostgreSQL metrics table
    // Metrics ya están inicializados en useState, no necesitamos setMetrics aquí

    // No need to process pending plans - checkout is done directly from pricing page
  }, [user, initialized]);

  const services = [
    {
      name: "AI Agents",
      description: "Smart AI assistants",
      icon: Bot,
      route: "/ai-agents",
      stats: metrics.aiAgentsUsed,
      statsLabel: "Active Agents",
      color: "text-purple-500",
      highlight: true
    },
    {
      name: "Education Hub",
      description: "Learn music industry skills",
      icon: GraduationCap,
      route: "/education",
      stats: metrics.coursesEnrolled,
      statsLabel: "Courses",
      color: "text-blue-500",
      highlight: true
    },
    {
      name: "Music Generator",
      description: "Create AI-powered music",
      icon: Music2,
      route: "/music-generator",
      stats: metrics.musicGenerated,
      statsLabel: "Tracks",
      color: "text-orange-500",
      highlight: true
    },
    {
      name: "Merchandise Store",
      description: "Create custom merchandise",
      icon: ShoppingBag,
      route: "/merchandise",
      stats: metrics.merchandiseSold,
      statsLabel: "Products",
      color: "text-green-500",
      highlight: true
    },
    {
      name: "Artist Image",
      description: "Style recommendations",
      icon: Palette,
      route: "/artist-image-advisor",
      stats: metrics.styleRecommendations,
      statsLabel: "Styles",
      color: "text-pink-500",
      highlight: false
    },
    {
      name: "Music Videos",
      description: "Create and manage music videos",
      icon: Video,
      route: "/music-video-creator",
      stats: metrics.musicVideos,
      statsLabel: "Videos",
      color: "text-purple-600"
    },
    {
      name: "Record Label Services",
      description: "Professional music services",
      icon: Building2,
      route: "/record-label-services",
      stats: metrics.totalEngagement,
      statsLabel: "Engagement",
      color: "text-indigo-500"
    },
    {
      name: "Contacts",
      description: "Manage your network",
      icon: Phone,
      route: "/contacts",
      stats: metrics.contacts,
      statsLabel: "Contacts",
      color: "text-emerald-500"
    },
    {
      name: "Instagram Boost",
      description: "Increase Instagram reach",
      icon: SiInstagram,
      route: "/instagram-boost",
      stats: metrics.instagramFollowers,
      statsLabel: "Followers",
      color: "text-pink-500"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-end mb-3">
            <Button
              onClick={() => setShowHowItWorks(true)}
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs"
            >
              <Layers className="w-3.5 h-3.5" />
              How Boostify Works
            </Button>
          </div>

          <HowBoostifyWorks open={showHowItWorks} onOpenChange={setShowHowItWorks} />

          <div className="mb-6">
            <EcosystemDashboard />
          </div>
        </div>
      </main>
    </div>
  );
}
