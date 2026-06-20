import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, Music, Video, Bot, LineChart, Share2, Globe, LucideIcon, Crown, Rocket, Shield, Headphones, Mic2, Radio, Users, TrendingUp } from "lucide-react";
import { Header } from "../components/layout/header";
import { Footer } from "../components/layout/footer";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Link } from "wouter";

// Interfaces
interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
  category: "music" | "video" | "ai" | "analytics" | "social" | "all";
  isPremium?: boolean;
}

interface CategoryTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

// Category tabs
const categoryTabs: CategoryTab[] = [
  { id: "all", label: "All Features", icon: Sparkles },
  { id: "music", label: "Music", icon: Music },
  { id: "video", label: "Video", icon: Video },
  { id: "ai", label: "AI Tools", icon: Bot },
  { id: "analytics", label: "Analytics", icon: LineChart },
  { id: "social", label: "Social", icon: Share2 },
];

// Features list
const features: Feature[] = [
  {
    title: "AI Music Generation",
    description: "Create complete music tracks with our advanced AI. Customize style, genre, mood, and instruments.",
    icon: Music,
    category: "music",
    isPremium: true,
  },
  {
    title: "Music Video Creator",
    description: "Transform your songs into professional music videos with AI-powered visuals and templates.",
    icon: Video,
    category: "video",
    isPremium: true,
  },
  {
    title: "AI Music Advisors",
    description: "Get personalized advice from AI-powered industry experts for your music career.",
    icon: Bot,
    category: "ai",
    isPremium: true,
  },
  {
    title: "Audience Analytics",
    description: "Understand your audience with detailed analytics on demographics, behavior, and preferences.",
    icon: LineChart,
    category: "analytics",
  },
  {
    title: "Global Distribution",
    description: "Distribute your music to Spotify, Apple Music, and 150+ platforms with one click.",
    icon: Globe,
    category: "music",
  },
  {
    title: "Artist Network",
    description: "Connect with other artists, producers, and fans on our music-focused social platform.",
    icon: Share2,
    category: "social",
  },
  {
    title: "Auto Mastering",
    description: "Professional-quality mastering powered by AI. Make your tracks radio-ready instantly.",
    icon: Zap,
    category: "music",
  },
  {
    title: "AI Image Generator",
    description: "Create album covers, promotional photos, and visual art with our AI image tools.",
    icon: Bot,
    category: "ai",
    isPremium: true,
  },
  {
    title: "Advanced Analytics",
    description: "Track streams, revenue, playlist placements, and marketing campaign performance.",
    icon: LineChart,
    category: "analytics",
    isPremium: true,
  },
  {
    title: "Text-to-Video AI",
    description: "Turn text descriptions into high-quality music videos automatically.",
    icon: Video,
    category: "video",
    isPremium: true,
  },
  {
    title: "Collaboration Tools",
    description: "Work in real-time with artists and producers from anywhere in the world.",
    icon: Share2,
    category: "social",
  },
  {
    title: "Virtual Record Label",
    description: "Access complete label services: promotion, distribution, sync licensing, and more.",
    icon: Music,
    category: "music",
    isPremium: true,
  },
];

// Stats
const stats = [
  { value: "10,000+", label: "Active Artists" },
  { value: "5M+", label: "Streams Generated" },
  { value: "500K+", label: "Videos Created" },
  { value: "150+", label: "Distribution Platforms" },
];

export default function FeaturesPage() {
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  
  // Filter features by category
  const filteredFeatures = features.filter(
    feature => selectedCategory === "all" || feature.category === selectedCategory
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-28 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 via-transparent to-transparent z-0"></div>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-500/10 rounded-full blur-3xl"></div>
          
          <div className="max-w-7xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-4xl mx-auto"
            >
              <Badge className="mb-6 bg-orange-500/10 text-orange-500 border-orange-500/30 px-4 py-1.5">
                <Sparkles className="w-4 h-4 mr-2" />
                All-in-One Music Platform
              </Badge>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-white leading-tight">
                Everything You Need to{" "}
                <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                  Grow Your Music Career
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                Discover the powerful tools that help artists create, promote, and monetize their music. All powered by AI.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth">
                  <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-8 h-12">
                    <Rocket className="w-5 h-5 mr-2" />
                    Get Started Free
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="border-gray-700 text-white hover:bg-gray-800 h-12 px-8">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 border-y border-gray-800/50 bg-gray-900/30">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <motion.div 
                  key={index} 
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="text-3xl md:text-4xl font-bold text-orange-500 mb-2">{stat.value}</div>
                  <div className="text-gray-400 text-sm">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Powerful Features</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Explore our complete toolkit designed for every aspect of your music career
              </p>
            </div>
            
            <Tabs defaultValue="all" className="w-full" onValueChange={setSelectedCategory}>
              <div className="flex justify-center mb-10">
                <TabsList className="bg-gray-900/80 border border-gray-800 p-1 rounded-xl">
                  {categoryTabs.map((tab) => (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id} 
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
                    >
                      <tab.icon className="h-4 w-4" />
                      <span className="hidden md:inline">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              
              <TabsContent value={selectedCategory} className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFeatures.map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ y: -6 }}
                    >
                      <Card className="h-full bg-zinc-900/60 backdrop-blur-xl border-white/10 hover:border-orange-500/40 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-orange-500/10 group rounded-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        <CardHeader className="pb-3 relative">
                          <div className="flex justify-between items-start">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center group-hover:from-orange-500/30 group-hover:to-red-500/30 transition-all shadow-md shadow-orange-500/10">
                              <feature.icon className="h-6 w-6 text-orange-500" />
                            </div>
                            {feature.isPremium && (
                              <Badge className="bg-gradient-to-r from-orange-500/15 to-red-500/15 text-orange-400 border-orange-500/30">
                                <Crown className="w-3 h-3 mr-1" />
                                Premium
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="mt-4 text-white text-lg">{feature.title}</CardTitle>
                          <CardDescription className="text-white/50">{feature.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="relative">
                          <Button variant="ghost" className="p-0 h-auto text-orange-500 hover:text-orange-400 group-hover:translate-x-1 transition-transform">
                            Learn more →
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-20 md:py-28 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 via-transparent to-transparent z-0"></div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full text-orange-500 text-sm font-medium mb-6">
                <Rocket className="w-4 h-4" />
                Ready to Start?
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Take Your Music to the Next Level
              </h2>
              <p className="text-lg text-gray-400 mb-10">
                Join thousands of artists already growing their careers with Boostify. Start for free today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth">
                  <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-8 h-14 text-lg">
                    Get Started Free
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="border-gray-700 text-white hover:bg-gray-800 h-14 px-8 text-lg">
                    View Plans
                  </Button>
                </Link>
              </div>
              <p className="text-gray-500 text-sm mt-6">
                No credit card required • Free forever on Discover plan
              </p>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}