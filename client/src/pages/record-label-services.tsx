import { ScoreCreator } from "../components/manager/score-creator";
import { SoundDesigner } from "../components/manager/sound-designer";
import { TimelineEditor } from "../components/manager/timeline-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useState } from "react";
import { useLocation } from "wouter";
import { PlanTierGuard } from "../components/youtube-views/plan-tier-guard";
import { ArtistLandingPage } from "../components/artist/artist-landing-page";
import { isAdminEmail } from "../../../shared/constants";
import { useUser } from "@clerk/clerk-react";
import { Header } from "../components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ServiceDialog } from "../components/record-label/service-dialog";
import {
  Music2, Wand2, Video, Building2, ArrowRight, Shield, Banknote,
  Radio, Tv, Film, FileText, Brain, Play, Volume2, Pen, Clock,
  Mic2, Music4, Database, FilmIcon, TrendingUp, Calculator,
  MapPin, Calendar, ChartBar, Users, Sparkles, Star, 
  Music, Check, DollarSign, Globe, Award, BarChart, Zap,
  Headphones, Smartphone, Podcast, CreditCard, Layers,
  ChevronRight, ExternalLink, Loader2, Send
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { recordLabelService } from "../lib/services/record-label-service";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { RadioNetworksDialog } from "../components/record-label/radio-networks-dialog";
import { TVNetworksDialog } from "../components/record-label/tv-networks-dialog";
import { MovieNetworksDialog } from "../components/record-label/movie-networks-dialog";
import { VenuesCatalog } from "../components/manager/venues-catalog";
import { VenuesBooking } from "../components/manager/venues-booking";
import { VenuesReports } from "../components/manager/venues-reports";
import { motion } from "framer-motion";
import { 
  fadeIn, 
  slideInFromLeft, 
  slideInFromRight 
} from "../components/ui/motion";
import { ArtistRoster } from "../components/manager/artist-roster";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";

export default function RecordLabelServices() {
  const [selectedTab, setSelectedTab] = useState("radio-tv");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    companyName: "", contactName: "", email: "", phone: "",
    website: "", labelType: "Independent", message: "", terms: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // AI tab state
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Check if user is admin
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || "";
  const isAdmin = isAdminEmail(userEmail);

  const { data: services = [] } = useQuery({
    queryKey: ['record-label-services', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      return recordLabelService.getServices(user.uid);
    },
    enabled: !!user
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.terms) {
      toast({ title: "Please accept the terms", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      setSubmitted(true);
      toast({ title: "Registration submitted! 🎉", description: "We'll be in touch within 24 hours." });
    } catch {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAiQuery = async () => {
    if (!aiQuestion.trim()) return;
    setIsAiLoading(true);
    setAiResponse("");
    try {
      const res = await fetch("/api/ai/publishing-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: aiQuestion })
      });
      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.answer || data.response || "No response received.");
      } else {
        setAiResponse("Unable to get AI insights right now. Please try again shortly.");
      }
    } catch {
      setAiResponse("Connection error. Please check your internet and try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const pageContent = (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <div className="relative w-full min-h-[65vh] sm:min-h-[75vh] overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            src="/assets/Standard_Mode_Generated_Video (9).mp4"
          />
          {/* Dark gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/30" />
          <div className="absolute inset-0 bg-[url('/assets/noise.svg')] opacity-10" />

          <div className="relative z-10 container mx-auto px-4 h-full flex flex-col justify-center pt-24 pb-16">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="max-w-2xl"
            >
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="inline-flex items-center rounded-full bg-orange-500/15 px-3 py-1.5 text-xs sm:text-sm font-medium text-orange-400 ring-1 ring-inset ring-orange-500/30">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI-Powered Platform
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-500/15 px-3 py-1.5 text-xs sm:text-sm font-medium text-purple-400 ring-1 ring-inset ring-purple-500/30">
                  <Globe className="mr-1.5 h-3.5 w-3.5" /> 150+ Countries
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-5 leading-tight">
                Publishing &amp; Licensing{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-orange-300 to-yellow-300">
                  Reimagined
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-white/80 mb-8 font-light max-w-xl leading-relaxed">
                Transform your music rights management with our AI-powered platform. Unlock radio, TV, film, and global streaming opportunities — all from one dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/30 text-white font-semibold"
                  onClick={() => setSelectedTab("radio-tv")}
                >
                  Start Publishing
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10 backdrop-blur-sm">
                  <Play className="mr-2 h-4 w-4 fill-white" /> Watch Demo
                </Button>
              </div>
            </motion.div>

            {/* Stats row — responsive, no duplication */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-12 max-w-3xl">
              {[
                { label: "Active Artists", value: "2,500+" },
                { label: "Songs Published", value: "10,000+" },
                { label: "Revenue Generated", value: "$5M+" },
                { label: "Global Reach", value: "150+ Countries" }
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }}
                  className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 text-center"
                >
                  <p className="text-xl sm:text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/60 mt-1">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Key Benefits Section */}
        <section className="bg-gradient-to-b from-orange-500/5 to-background py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold">
                Why Choose Boostify <span className="text-orange-500">Record Label Services</span>
              </h2>
              <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
                Maximize your music's potential with our comprehensive suite of publishing and licensing services
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Globe className="h-10 w-10 text-orange-500" />,
                  title: "Global Distribution",
                  description: "Reach audiences in over 150 countries with our extensive distribution network"
                },
                {
                  icon: <BarChart className="h-10 w-10 text-orange-500" />,
                  title: "Real-time Analytics",
                  description: "Track your music's performance with detailed analytics and audience insights"
                },
                {
                  icon: <Shield className="h-10 w-10 text-orange-500" />,
                  title: "Rights Protection",
                  description: "Safeguard your intellectual property with our advanced rights management system"
                },
                {
                  icon: <DollarSign className="h-10 w-10 text-orange-500" />,
                  title: "Transparent Royalties",
                  description: "Receive clear, timely payments with our transparent royalty tracking system"
                },
                {
                  icon: <Zap className="h-10 w-10 text-orange-500" />,
                  title: "AI-Powered Matching",
                  description: "Match your music to the perfect licensing opportunities using our AI technology"
                },
                {
                  icon: <Award className="h-10 w-10 text-orange-500" />,
                  title: "Premium Placements",
                  description: "Get featured in high-profile media outlets, films, and TV productions"
                }
              ].map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex flex-col items-center text-center p-6 rounded-xl border border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all"
                >
                  <div className="p-4 rounded-full bg-orange-500/10 mb-4">
                    {benefit.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Services Tabs */}
        <div className="container mx-auto px-4 py-8">
          <Tabs
            defaultValue={selectedTab}
            value={selectedTab}
            onValueChange={setSelectedTab}
            className="space-y-6 sm:space-y-8"
          >
            <div className="flex justify-start sm:justify-center overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="inline-flex p-1 bg-muted/60 backdrop-blur-sm rounded-xl border border-border gap-0.5 min-w-max">
                <TabsTrigger value="radio-tv" className="rounded-lg px-3 sm:px-5 py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white whitespace-nowrap text-sm font-medium">
                  <Radio className="w-4 h-4 mr-1.5" /> Radio &amp; TV
                </TabsTrigger>
                <TabsTrigger value="movies" className="rounded-lg px-3 sm:px-5 py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white whitespace-nowrap text-sm font-medium">
                  <Film className="w-4 h-4 mr-1.5" /> Films
                </TabsTrigger>
                <TabsTrigger value="distribution" className="rounded-lg px-3 sm:px-5 py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white whitespace-nowrap text-sm font-medium">
                  <Layers className="w-4 h-4 mr-1.5" /> Distribution
                </TabsTrigger>
                <TabsTrigger value="creator" className="rounded-lg px-3 sm:px-5 py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white whitespace-nowrap text-sm font-medium">
                  <Music4 className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Creator </span>Tools
                </TabsTrigger>
                <TabsTrigger value="contracts" className="rounded-lg px-3 sm:px-5 py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white whitespace-nowrap text-sm font-medium">
                  <FileText className="w-4 h-4 mr-1.5" /> Contracts
                </TabsTrigger>
                <TabsTrigger value="ai" className="rounded-lg px-3 sm:px-5 py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white whitespace-nowrap text-sm font-medium">
                  <Brain className="w-4 h-4 mr-1.5" /> AI Advisor
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Radio & TV ── */}
            <TabsContent value="radio-tv">
              <div className="grid gap-6 md:grid-cols-2 mb-6">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                  <Card className="p-6 sm:p-8 hover:shadow-lg transition-all duration-300 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-orange-500/10 rounded-2xl"><Radio className="h-7 w-7 text-orange-500" /></div>
                      <div>
                        <h3 className="text-xl font-semibold">Radio Publishing</h3>
                        <p className="text-sm text-muted-foreground">Expand your reach through radio networks worldwide</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "National Networks", desc: "Top 100 stations in the US, UK, AU & EU", badge: "150+ Stations" },
                        { label: "Local Stations", desc: "Region-targeted placement campaigns", badge: "800+ Local" },
                        { label: "Internet Radio", desc: "Spotify Radio, iHeart, Pandora & more", badge: "Digital" },
                        { label: "Satellite Radio", desc: "SiriusXM, TuneIn Premium channels", badge: "Satellite" },
                      ].map((item) => (
                        <motion.div key={item.label} whileHover={{ x: 4 }} className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="secondary" className="text-xs hidden sm:flex">{item.badge}</Badge>
                              <RadioNetworksDialog>
                                <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-orange-500/10 hover:text-orange-500">
                                  Explore <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                              </RadioNetworksDialog>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
                  <Card className="p-6 sm:p-8 hover:shadow-lg transition-all duration-300 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-orange-500/10 rounded-2xl"><Tv className="h-7 w-7 text-orange-500" /></div>
                      <div>
                        <h3 className="text-xl font-semibold">TV Licensing</h3>
                        <p className="text-sm text-muted-foreground">License your music for television worldwide</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Shows & Series", desc: "Streaming platforms: Netflix, Disney+, Apple TV+", badge: "Premium" },
                        { label: "Commercials", desc: "Brand campaigns and global ad agencies", badge: "High Value" },
                        { label: "Network Promos", desc: "CBS, NBC, ABC, BBC and cable networks", badge: "Broadcast" },
                        { label: "Sports & Events", desc: "Live sports, reality TV and award shows", badge: "Live" },
                      ].map((item) => (
                        <motion.div key={item.label} whileHover={{ x: 4 }} className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="secondary" className="text-xs hidden sm:flex">{item.badge}</Badge>
                              <TVNetworksDialog>
                                <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-orange-500/10 hover:text-orange-500">
                                  Details <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                              </TVNetworksDialog>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              </div>

              {/* Radio/TV quick stats banner */}
              <Card className="bg-gradient-to-r from-orange-500/10 via-background to-purple-500/10 border-orange-500/20 p-5">
                <div className="flex flex-wrap items-center justify-around gap-4 text-center">
                  {[
                    { icon: <Radio className="w-5 h-5 text-orange-500 mx-auto mb-1" />, value: "1,200+", label: "Radio Stations" },
                    { icon: <Tv className="w-5 h-5 text-orange-500 mx-auto mb-1" />, value: "400+", label: "TV Networks" },
                    { icon: <Globe className="w-5 h-5 text-orange-500 mx-auto mb-1" />, value: "85", label: "Countries" },
                    { icon: <DollarSign className="w-5 h-5 text-orange-500 mx-auto mb-1" />, value: "$2.8M", label: "Royalties Paid (YTD)" },
                  ].map((s) => (
                    <div key={s.label} className="min-w-[80px]">
                      {s.icon}
                      <p className="text-xl font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* ── Films ── */}
            <TabsContent value="movies">
              <div className="grid gap-6 md:grid-cols-2 mb-6">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                  <Card className="p-6 sm:p-8 hover:shadow-lg transition-all duration-300 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-orange-500/10 rounded-2xl"><FilmIcon className="h-7 w-7 text-orange-500" /></div>
                      <div>
                        <h3 className="text-xl font-semibold">Movie Sync Licensing</h3>
                        <p className="text-sm text-muted-foreground">Place your music in films, series and documentaries</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Feature Films", desc: "Hollywood & international productions", badge: "Premium" },
                        { label: "Independent Movies", desc: "Sundance, A24 and indie festivals", badge: "Indie" },
                        { label: "Documentaries", desc: "Netflix docs, NatGeo, Vice and more", badge: "Streaming" },
                        { label: "Short Films", desc: "Festival circuit and online distribution", badge: "Festival" },
                        { label: "Video Games", desc: "AAA and indie game soundtracks", badge: "Interactive" },
                      ].map((item) => (
                        <motion.div key={item.label} whileHover={{ x: 4 }} className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="secondary" className="text-xs hidden sm:flex">{item.badge}</Badge>
                              <MovieNetworksDialog>
                                <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-orange-500/10 hover:text-orange-500">
                                  Browse <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                              </MovieNetworksDialog>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
                  <Card className="p-6 sm:p-8 hover:shadow-lg transition-all duration-300 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-orange-500/10 rounded-2xl"><Database className="h-7 w-7 text-orange-500" /></div>
                      <div>
                        <h3 className="text-xl font-semibold">Music Library</h3>
                        <p className="text-sm text-muted-foreground">Manage and pitch your movie-ready catalog</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Upload Movie-Ready Tracks", desc: "Add your best sync candidates with metadata", action: "Upload" },
                        { label: "Mood & Genre Tags", desc: "Tag tracks for precise placement matching", action: "Tag Catalog" },
                        { label: "Stems & Alternates", desc: "Upload stems for flexible licensing deals", action: "Add Stems" },
                        { label: "Licensing History", desc: "View past placements and revenue earned", action: "View History" },
                      ].map((item) => (
                        <motion.div key={item.label} whileHover={{ x: 4 }} className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-orange-500/10 hover:text-orange-500 shrink-0">
                              {item.action} <ChevronRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              </div>
            </TabsContent>

            {/* ── Distribution ── */}
            <TabsContent value="distribution">
              <div className="grid gap-6 md:grid-cols-3 mb-6">
                {[
                  {
                    icon: <Smartphone className="h-7 w-7 text-orange-500" />,
                    title: "Streaming Platforms",
                    desc: "Distribute to Spotify, Apple Music, Amazon Music, TIDAL, YouTube Music and 50+ platforms simultaneously.",
                    items: ["Spotify", "Apple Music", "Amazon Music", "TIDAL", "Deezer", "YouTube Music", "50+ more"],
                    badge: "Global"
                  },
                  {
                    icon: <Headphones className="h-7 w-7 text-orange-500" />,
                    title: "Podcast & Audio",
                    desc: "Monetize your music on podcast platforms and audio content networks with automated ISRC registration.",
                    items: ["Audible", "Spotify Podcasts", "Apple Podcasts", "iHeart Radio", "SoundCloud"],
                    badge: "Audio"
                  },
                  {
                    icon: <Globe className="h-7 w-7 text-orange-500" />,
                    title: "International Markets",
                    desc: "Break into key global markets with localized distribution strategies and regional PRO registration.",
                    items: ["Latin America", "Europe", "Asia Pacific", "Middle East & Africa", "CIS"],
                    badge: "150+ Countries"
                  }
                ].map((card, i) => (
                  <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }}>
                    <Card className="p-6 hover:shadow-lg transition-all h-full flex flex-col">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-orange-500/10 rounded-xl">{card.icon}</div>
                        <div>
                          <h3 className="font-semibold">{card.title}</h3>
                          <Badge variant="outline" className="text-xs mt-0.5 border-orange-500/30 text-orange-500">{card.badge}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 flex-1">{card.desc}</p>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {card.items.map(p => (
                          <span key={p} className="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">{p}</span>
                        ))}
                      </div>
                      <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-auto">
                        Set Up Distribution <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Card>
                  </motion.div>
                ))}
              </div>
              <Card className="bg-gradient-to-r from-purple-500/10 via-background to-orange-500/10 border-purple-500/20 p-6">
                <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                  <div>
                    <h4 className="font-bold text-lg">ISRC & UPC Codes — Auto-registered</h4>
                    <p className="text-sm text-muted-foreground mt-1">Every release gets automatic ISRC, UPC, and metadata registration across all PROs worldwide.</p>
                  </div>
                  <Button className="bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-700 hover:to-orange-600 text-white shrink-0">
                    Start Distributing <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </TabsContent>


            {/* ── Creator Tools ── */}
            <TabsContent value="creator">
              <div className="grid gap-4 sm:gap-6 md:gap-8 md:grid-cols-3">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                  <ScoreCreator />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                  <SoundDesigner />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                  <TimelineEditor />
                </motion.div>
              </div>
            </TabsContent>

            {/* ── Contracts ── */}
            <TabsContent value="contracts">
              <div className="grid gap-6 md:grid-cols-2">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                  <Card className="p-6 sm:p-8 hover:shadow-lg transition-all h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-orange-500/10 rounded-2xl"><FileText className="h-7 w-7 text-orange-500" /></div>
                      <div>
                        <h3 className="text-xl font-semibold">Publishing Contracts</h3>
                        <p className="text-sm text-muted-foreground">Ready-to-use templates for every deal type</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { type: "TV Licensing Agreement", desc: "One-time sync or series license", status: "Template" },
                        { type: "Movie Sync License", desc: "Feature film & trailer usage rights", status: "Template" },
                        { type: "Radio Broadcasting", desc: "AM/FM/Internet broadcast rights", status: "Template" },
                        { type: "Co-Publishing Deal", desc: "Split administration & royalties", status: "Template" },
                        { type: "Distribution Agreement", desc: "Digital platform distribution rights", status: "Template" },
                      ].map((item) => (
                        <motion.div key={item.type} whileHover={{ x: 4 }} className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.type}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-500">{item.status}</Badge>
                              <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-orange-500/10 hover:text-orange-500">
                                Use <ChevronRight className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
                  <Card className="p-6 sm:p-8 hover:shadow-lg transition-all h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-orange-500/10 rounded-2xl"><Pen className="h-7 w-7 text-orange-500" /></div>
                      <div>
                        <h3 className="text-xl font-semibold">Active Contracts</h3>
                        <p className="text-sm text-muted-foreground">Monitor and manage your live agreements</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { name: "Netflix Series License", expires: "8 months", status: "Active", color: "text-green-500 bg-green-500/10 border-green-500/30" },
                        { name: "Universal Pictures Sync", expires: "14 months", status: "Active", color: "text-green-500 bg-green-500/10 border-green-500/30" },
                        { name: "BBC Radio License", expires: "3 months", status: "Expiring Soon", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" },
                        { name: "Spotify Editorial Promo", expires: "1 month", status: "Expiring Soon", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" },
                        { name: "EA Sports Game Sync", expires: "22 months", status: "Active", color: "text-green-500 bg-green-500/10 border-green-500/30" },
                      ].map((contract) => (
                        <motion.div key={contract.name} whileHover={{ x: 4 }} className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{contract.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Expires in {contract.expires}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-xs shrink-0 ${contract.color}`}>{contract.status}</Badge>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <Button className="w-full mt-4 bg-orange-500 hover:bg-orange-600">
                      View All Contracts <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </Card>
                </motion.div>
              </div>
            </TabsContent>

            {/* ── AI Publishing Advisor ── */}
            <TabsContent value="ai">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Card className="p-6 sm:p-8 hover:shadow-lg transition-all">
                  <CardHeader className="px-0 pt-0 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-orange-500/10 rounded-2xl"><Brain className="h-7 w-7 text-orange-500" /></div>
                      <div>
                        <CardTitle className="text-xl sm:text-2xl">AI Publishing Advisor</CardTitle>
                        <CardDescription>Get GPT-4o insights tailored to your music publishing strategy</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Left: Ask AI */}
                      <div className="space-y-5">
                        <div className="p-5 rounded-xl border border-orange-500/20 hover:border-orange-500/40 transition-all">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Wand2 className="h-4 w-4 text-orange-500" /> Ask the AI Advisor
                          </h4>
                          <Textarea
                            className="mb-4 min-h-[110px] resize-none focus-visible:ring-orange-500 text-sm"
                            placeholder="E.g. How do I maximize sync licensing revenue for my indie catalog? What's the best strategy for pitching to Netflix?"
                            rows={4}
                            value={aiQuestion}
                            onChange={e => setAiQuestion(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiQuery(); }}
                          />
                          <div className="flex items-center gap-3">
                            <Button
                              className="flex-1 bg-orange-500 hover:bg-orange-600"
                              onClick={handleAiQuery}
                              disabled={isAiLoading || !aiQuestion.trim()}
                            >
                              {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                              {isAiLoading ? "Analyzing..." : "Get Insights"}
                            </Button>
                            <Button variant="outline" size="icon" title="Voice input (coming soon)" disabled>
                              <Mic2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* AI Response */}
                        {(aiResponse || isAiLoading) && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl border border-purple-500/30 bg-purple-500/5">
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                              <Brain className="h-4 w-4 text-purple-500" /> AI Response
                            </h4>
                            {isAiLoading ? (
                              <div className="space-y-2">
                                <div className="h-3 bg-purple-500/20 rounded animate-pulse w-full" />
                                <div className="h-3 bg-purple-500/20 rounded animate-pulse w-4/5" />
                                <div className="h-3 bg-purple-500/20 rounded animate-pulse w-3/5" />
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                            )}
                          </motion.div>
                        )}

                        {/* Quick Actions */}
                        <div className="p-5 rounded-xl border border-orange-500/20 hover:border-orange-500/40 transition-all">
                          <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                            <TrendingUp className="h-4 w-4 text-orange-500" /> Quick Analysis
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { icon: FileText, text: "Analyze Contract", q: "Analyze this contract and flag any red flags or missing clauses for a sync licensing deal." },
                              { icon: TrendingUp, text: "Market Analysis", q: "Give me a current music licensing market analysis and the top 3 opportunities for indie artists in 2025." },
                              { icon: Calculator, text: "Royalty Estimator", q: "How do I estimate expected royalties from a TV sync placement on a mid-size streaming platform?" },
                              { icon: Sparkles, text: "Find Opportunities", q: "What are the most underserved sync licensing niches right now and how can I target them?" },
                            ].map((action) => (
                              <Button
                                key={action.text}
                                variant="outline"
                                size="sm"
                                className="justify-start h-auto py-2.5 px-3 text-left hover:bg-orange-500/10 border-orange-500/20 hover:border-orange-500/40"
                                onClick={() => { setAiQuestion(action.q); }}
                              >
                                <action.icon className="mr-2 h-3.5 w-3.5 text-orange-500 shrink-0" />
                                <span className="text-xs">{action.text}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: AI Insights */}
                      <div className="space-y-5">
                        <div className="p-5 rounded-xl border border-orange-500/20 bg-orange-500/5">
                          <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                            <Star className="h-4 w-4 text-orange-500" /> AI Insights &amp; Recommendations
                          </h4>
                          <Accordion type="single" collapsible className="w-full space-y-1">
                            {[
                              {
                                key: "opportunities",
                                icon: <Sparkles className="h-3.5 w-3.5 text-orange-500" />,
                                title: "Publishing Opportunities",
                                content: (
                                  <div className="space-y-2">
                                    {[
                                      { title: "TV Commercial Licensing", desc: "Your catalog shows strong potential for TV commercial licensing based on current ad trends." },
                                      { title: "Documentary Film Scoring", desc: "Recent streaming growth in documentary content creates high demand for your style." },
                                      { title: "Podcast Background Music", desc: "Podcast platforms are actively licensing curated background tracks — high volume, low friction." },
                                    ].map(op => (
                                      <div key={op.title} className="p-3 rounded-lg bg-orange-500/10">
                                        <p className="font-medium text-xs">{op.title}</p>
                                        <p className="text-muted-foreground text-xs mt-0.5">{op.desc}</p>
                                      </div>
                                    ))}
                                  </div>
                                )
                              },
                              {
                                key: "strategies",
                                icon: <TrendingUp className="h-3.5 w-3.5 text-orange-500" />,
                                title: "Market Strategies",
                                content: (
                                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                                    <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" /> Focus on sync licensing opportunities in streaming platforms</li>
                                    <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" /> Target podcast and short-form video creators</li>
                                    <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" /> Utilize AI-matched placement for niche market targeting</li>
                                    <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" /> Register with multiple international PROs</li>
                                  </ul>
                                )
                              },
                              {
                                key: "revenue",
                                icon: <Banknote className="h-3.5 w-3.5 text-orange-500" />,
                                title: "Revenue Optimization",
                                content: (
                                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                                    <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" /> Register with ASCAP, BMI, and SOCAN for maximum PRO coverage</li>
                                    <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" /> Leverage micro-licensing for TikTok, Reels, and Shorts</li>
                                    <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" /> Bundle deals for commercial and editorial use</li>
                                    <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" /> Pursue mechanical royalties from streaming services</li>
                                  </ul>
                                )
                              }
                            ].map(item => (
                              <AccordionItem key={item.key} value={item.key} className="border border-orange-500/20 rounded-lg px-3 overflow-hidden">
                                <AccordionTrigger className="text-xs font-semibold hover:no-underline py-3">
                                  <div className="flex items-center gap-2">{item.icon}{item.title}</div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-3">{item.content}</AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>

                        <Button className="w-full bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 h-auto py-3">
                          <div className="text-left">
                            <div className="font-semibold">Generate Custom Publishing Plan</div>
                            <div className="text-xs opacity-80">Tailored analysis of your full catalog</div>
                          </div>
                          <FileText className="ml-3 h-5 w-5 shrink-0" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Royalty Importance Section */}
        <div className="bg-background py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <Banknote className="h-10 md:h-12 w-10 md:w-12 text-orange-500 mx-auto mb-6" />
              <h2 className="text-2xl md:text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600">
                The Power of Perpetual Royalties
              </h2>
              <div className="prose prose-lg mx-auto dark:prose-invert">
                <p className="text-sm md:text-base text-muted-foreground/90 leading-relaxed">
                  In today's digital age, classic music represents an untapped goldmine of potential revenue.
                  Many timeless tracks have stopped generating royalties simply because they haven't been
                  adapted for modern audiences and platforms.
                </p>
                <p className="text-sm md:text-base text-muted-foreground/90 leading-relaxed">
                  By reviving these classics through AI-powered remixes, modern mastering, and compelling
                  video content, we can:
                </p>
                <ul className="text-left list-disc pl-6 space-y-2 mb-6 text-sm md:text-base text-muted-foreground/90">
                  <li>Introduce iconic music to new generations</li>
                  <li>Create additional revenue streams from existing catalogs</li>
                  <li>Preserve musical heritage while making it relevant for today's market</li>
                  <li>Enable continuous monetization across multiple platforms</li>
                  <li>Generate new licensing and sync opportunities</li>
                </ul>
                <p className="text-sm md:text-base text-muted-foreground/90 leading-relaxed">
                  Our platform provides the tools and technology needed to transform your dormant catalog
                  into an active revenue-generating asset, ensuring your music continues to earn and
                  resonate with audiences for years to come.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid with Modern Cards */}
        <div className="container mx-auto px-4 py-16 bg-gradient-to-b from-background via-orange-500/5 to-background">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600">
                Comprehensive Revival Tools
              </h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to bring your music into the modern era
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Music2,
                title: "AI Music Generation",
                description: "Create modern remixes while preserving the original essence",
                route: "/music-generator",
              },
              {
                icon: Wand2,
                title: "Professional Mastering",
                description: "State-of-the-art AI mastering for perfect sound",
                route: "/music-mastering",
              },
              {
                icon: Video,
                title: "Video Generation",
                description: "Create compelling music videos with AI",
                route: "/music-video-creator",
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="p-4 sm:p-6 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5 border-orange-500/20 hover:border-orange-500/40">
                  <feature.icon className="h-12 w-12 text-orange-500 mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {feature.description}
                  </p>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => navigate(feature.route)}>
                    Try Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Manager Tools Section */}
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600">
              Manager Tools
            </h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Essential tools for managing your artists and venues
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <VenuesCatalog />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <VenuesBooking />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <VenuesReports />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <ArtistRoster />
            </motion.div>
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge variant="outline" className="mb-4 border-orange-500/40 text-orange-500">Transparent Pricing</Badge>
              <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600">
                Choose Your Plan
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">Start free and scale as your catalog grows. No hidden fees.</p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "Free",
                sub: "Forever",
                desc: "Perfect for independent artists getting started with publishing",
                features: ["5 songs in catalog", "Basic metadata management", "1 streaming platform", "Community support"],
                cta: "Get Started",
                highlight: false,
              },
              {
                name: "Professional",
                price: "$29",
                sub: "per month",
                desc: "For serious artists and small labels ready to grow",
                features: ["Unlimited catalog", "All streaming platforms", "Radio & TV pitching", "Sync licensing access", "ISRC/UPC auto-registration", "Priority support"],
                cta: "Start Pro",
                highlight: true,
              },
              {
                name: "Enterprise",
                price: "$99",
                sub: "per month",
                desc: "Full-suite solution for record labels and publishers",
                features: ["Everything in Pro", "Multi-artist roster", "Contract management", "AI Publishing Advisor", "Dedicated account manager", "Custom royalty splits", "White-label options"],
                cta: "Contact Sales",
                highlight: false,
              },
            ].map((plan, i) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }}>
                <Card className={`p-6 h-full flex flex-col transition-all ${plan.highlight ? "border-orange-500 shadow-lg shadow-orange-500/10 relative overflow-hidden" : "hover:border-orange-500/40"}`}>
                  {plan.highlight && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-purple-600" />
                  )}
                  {plan.highlight && (
                    <Badge className="absolute top-4 right-4 bg-orange-500 text-white text-xs">Most Popular</Badge>
                  )}
                  <div className="mb-5">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground text-sm mb-1">/{plan.sub}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.desc}</p>
                  </div>
                  <ul className="space-y-2 flex-1 mb-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-orange-500 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className={`w-full ${plan.highlight ? "bg-orange-500 hover:bg-orange-600 text-white" : "variant-outline"}`} onClick={() => setSelectedTab("ai")}>
                    {plan.cta} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Record Label Registration */}
        <div className="bg-gradient-to-b from-background to-orange-500/5 py-16 md:py-24 -mx-4 px-4">
          <div className="container mx-auto">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Building2 className="h-12 md:h-16 w-12 md:w-16 text-orange-500 mx-auto mb-4" />
                  <h2 className="text-2xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600">
                    Record Label Registration
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
                    Join our network of forward-thinking record labels and get exclusive access to our suite of AI-powered music revival tools
                  </p>
                </motion.div>
              </div>

              <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
                {/* Left Column - Benefits */}
                <motion.div 
                  className="lg:col-span-2 space-y-6"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div className="rounded-xl border border-orange-500/20 p-6 bg-gradient-to-br from-background to-orange-500/5">
                    <h3 className="text-xl font-semibold mb-4 flex items-center">
                      <Check className="mr-2 h-5 w-5 text-orange-500" />
                      Membership Benefits
                    </h3>
                    <ul className="space-y-3">
                      {[
                        "Early access to new AI tools and features",
                        "Dedicated account manager for your label",
                        "Priority processing for AI-generated content",
                        "Exclusive industry insights and reports",
                        "Networking opportunities with other labels"
                      ].map((benefit, i) => (
                        <li key={i} className="flex items-start">
                          <Check className="mr-2 h-4 w-4 text-orange-500 mt-1 shrink-0" />
                          <span className="text-sm">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="rounded-xl border border-orange-500/20 p-6 bg-gradient-to-br from-background to-orange-500/5">
                    <h3 className="text-xl font-semibold mb-4 flex items-center">
                      <Star className="mr-2 h-5 w-5 text-orange-500" />
                      Success Stories
                    </h3>
                    <div className="space-y-4">
                      {[
                        {
                          name: "Horizon Records",
                          quote: "Increased our catalog value by 65% in just 6 months using AI revival tools.",
                        },
                        {
                          name: "Pulse Entertainment",
                          quote: "Generated over $180k in additional revenue from reviving our classic recordings.",
                        }
                      ].map((testimonial, i) => (
                        <div key={i} className="p-3 rounded-lg bg-orange-500/10">
                          <p className="text-xs italic mb-1">{testimonial.quote}</p>
                          <p className="text-xs font-semibold">— {testimonial.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Right Column - Registration Form */}
                <motion.div 
                  className="lg:col-span-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Card className="p-6 md:p-8 border-orange-500/20 hover:border-orange-500/40 transition-all shadow-lg">
                    <CardHeader className="p-0 pb-6">
                      <CardTitle className="text-xl font-semibold">Create Your Account</CardTitle>
                      <CardDescription>
                        Fill in your details below to register your record label
                      </CardDescription>
                    </CardHeader>

                    {submitted ? (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                          <Check className="h-8 w-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold">Registration Submitted!</h3>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                          Thank you, <strong>{formData.contactName || "there"}</strong>! Our team will review your application and reach out within 24 hours.
                        </p>
                        <Button variant="outline" className="border-orange-500/30 hover:bg-orange-500/10" onClick={() => setSubmitted(false)}>
                          Submit Another Application
                        </Button>
                      </motion.div>
                    ) : (
                    <form className="space-y-5" onSubmit={handleFormSubmit}>
                      <div className="grid md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label htmlFor="companyName" className="text-sm font-medium">
                            Company Name <span className="text-orange-500">*</span>
                          </Label>
                          <Input
                            id="companyName"
                            type="text"
                            required
                            className="bg-background focus-visible:ring-orange-500"
                            placeholder="Your label name"
                            value={formData.companyName}
                            onChange={e => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactName" className="text-sm font-medium">
                            Contact Name <span className="text-orange-500">*</span>
                          </Label>
                          <Input
                            id="contactName"
                            type="text"
                            required
                            className="bg-background focus-visible:ring-orange-500"
                            placeholder="Full name"
                            value={formData.contactName}
                            onChange={e => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-medium">
                            Business Email <span className="text-orange-500">*</span>
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            required
                            className="bg-background focus-visible:ring-orange-500"
                            placeholder="email@yourlabel.com"
                            value={formData.email}
                            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm font-medium">
                            Phone Number
                          </Label>
                          <Input
                            id="phone"
                            type="tel"
                            className="bg-background focus-visible:ring-orange-500"
                            placeholder="+1 (555) 000-0000"
                            value={formData.phone}
                            onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="website" className="text-sm font-medium">
                          Company Website
                        </Label>
                        <Input
                          id="website"
                          type="url"
                          className="bg-background focus-visible:ring-orange-500"
                          placeholder="https://www.yourlabel.com"
                          value={formData.website}
                          onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Label Type <span className="text-orange-500">*</span>
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {["Independent", "Major", "Distribution", "Publishing"].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, labelType: type }))}
                              className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm cursor-pointer transition-all ${formData.labelType === type ? "border-orange-500 bg-orange-500/10 text-orange-500 font-medium" : "border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/5"}`}
                            >
                              {formData.labelType === type && <Check className="h-3.5 w-3.5 shrink-0" />}
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message" className="text-sm font-medium">
                          Tell us about your catalog and goals
                        </Label>
                        <Textarea
                          id="message"
                          placeholder="Share details about your music catalog, artists, and what you hope to achieve with our platform..."
                          className="bg-background min-h-[100px] focus-visible:ring-orange-500"
                          rows={4}
                          value={formData.message}
                          onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        />
                      </div>

                      <div
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.terms ? "border-orange-500/50 bg-orange-500/5" : "border-orange-500/20 hover:border-orange-500/40"}`}
                        onClick={() => setFormData(prev => ({ ...prev, terms: !prev.terms }))}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${formData.terms ? "border-orange-500 bg-orange-500" : "border-muted-foreground"}`}>
                          {formData.terms && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <Label className="text-xs cursor-pointer select-none">
                          I agree to the <span className="text-orange-500 underline">Terms of Service</span> and <span className="text-orange-500 underline">Privacy Policy</span>
                        </Label>
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 h-12 mt-4"
                        disabled={isSubmitting || !formData.terms}
                      >
                        {isSubmitting ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                        ) : (
                          <><span className="font-medium">Submit Registration</span><ArrowRight className="ml-2 h-5 w-5" /></>
                        )}
                      </Button>

                      <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Shield className="h-4 w-4 text-orange-500" />
                        <span>Your information is secure and will never be shared</span>
                      </div>
                    </form>
                    )}
                  </Card>
                </motion.div>
              </div>
            </div>
          </div>
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