import { useState, useRef, useEffect } from "react";
import { logger } from "../lib/logger";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/use-auth";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Header } from "../components/layout/header";
import { useToast } from "../hooks/use-toast";
import {
  FileText,
  Coffee,
  DollarSign,
  Truck,
  Users2,
  Brain,
  Calendar as CalendarIcon,
  ChevronRight,
  Play,
  ArrowRight,
  Sparkles,
  Zap,
  CheckCircle2,
  Music
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { motion } from "framer-motion";
import { TechnicalRiderSection } from "../components/manager/technical-rider";
import { RequirementsSection } from "../components/manager/requirements";
import { BudgetSection } from "../components/manager/budget";
import { LogisticsSection } from "../components/manager/logistics";
import { HiringSection } from "../components/manager/hiring";
import { AIToolsSection } from "../components/manager/ai-tools";
import { CalendarSection } from "../components/manager/calendar";

// Served from client/public/assets/videos/ in dev,
// redirected to Firebase Storage CDN in production (see server/middleware/asset-cdn.ts)
const concertVideo = "/assets/videos/concert-video.mp4";

export default function ManagerToolsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const { userSubscription } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState("technical");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Redirect to auth if not signed in or not on a paid plan
  const PAID_PLANS = ['creator', 'professional', 'enterprise', 'artist', 'premium'];
  const isPaidUser = userSubscription && PAID_PLANS.includes(userSubscription);
  useEffect(() => {
    if (isLoaded && (!isSignedIn || (isSignedIn && userSubscription !== undefined && !isPaidUser))) {
      setLocation("/auth");
    }
  }, [isLoaded, isSignedIn, isPaidUser, setLocation]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        logger.info("Video autoplay prevented:", error);
      });
    }
  }, []);

  const tools = [
    { 
      value: "technical", 
      icon: FileText, 
      label: "Technical Rider",
      description: "Professional technical specifications",
      color: "from-orange-500 to-red-500"
    },
    { 
      value: "requirements", 
      icon: Coffee, 
      label: "Requirements",
      description: "Complete requirements list",
      color: "from-purple-500 to-pink-500"
    },
    { 
      value: "budget", 
      icon: DollarSign, 
      label: "Budget",
      description: "Detailed budget planning",
      color: "from-blue-500 to-cyan-500"
    },
    { 
      value: "logistics", 
      icon: Truck, 
      label: "Logistics",
      description: "Transportation & scheduling",
      color: "from-green-500 to-emerald-500"
    },
    { 
      value: "hiring", 
      icon: Users2, 
      label: "Hiring",
      description: "Job descriptions & recruitment",
      color: "from-yellow-500 to-amber-500"
    },
    { 
      value: "ai", 
      icon: Brain, 
      label: "AI Assistant",
      description: "Expert AI consulting",
      color: "from-violet-500 to-purple-500"
    },
    { 
      value: "calendar", 
      icon: CalendarIcon, 
      label: "Calendar",
      description: "Event scheduling & planning",
      color: "from-pink-500 to-rose-500"
    }
  ];

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Don't render if not signed in (redirect in progress)
  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <ScrollArea className="h-[calc(100vh-4rem)]">
          {/* Hero Section with Video */}
          <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
            {/* Video Background */}
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src={concertVideo} type="video/mp4" />
            </video>

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-orange-900/60" />
            
            {/* Content */}
            <div className="relative h-full flex items-center justify-center">
              <div className="container mx-auto px-4">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="max-w-4xl mx-auto text-center"
                >
                  {/* Badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 border border-orange-500/30 backdrop-blur-sm mb-6"
                  >
                    <Sparkles className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-medium text-orange-100">Powered by Gemini AI</span>
                  </motion.div>

                  {/* Main Heading */}
                  <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-white">
                    Professional{" "}
                    <span className="bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
                      Manager Tools
                    </span>
                  </h1>

                  {/* Description */}
                  <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto mb-8 leading-relaxed">
                    Generate professional documents with AI in seconds. From technical riders to budgets, 
                    we've got everything you need to manage artists and productions like a pro.
                  </p>

                  {/* Features Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20"
                    >
                      <Zap className="h-5 w-5 text-orange-400 flex-shrink-0" />
                      <span className="text-sm text-white font-medium">AI-Powered Generation</span>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20"
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                      <span className="text-sm text-white font-medium">Professional Quality</span>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20"
                    >
                      <Music className="h-5 w-5 text-purple-400 flex-shrink-0" />
                      <span className="text-sm text-white font-medium">Industry Standard</span>
                    </motion.div>
                  </div>

                  {/* CTA Buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center"
                  >
                    <Button 
                      size="lg" 
                      className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg shadow-orange-500/30"
                      onClick={() => {
                        const mainContent = document.getElementById('tools-section');
                        mainContent?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Start Creating
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Watch Demo
                    </Button>
                  </motion.div>
                </motion.div>
              </div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 1 }}
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
            >
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-sm text-white/70">Scroll to explore</span>
                <ChevronRight className="h-5 w-5 text-white/70 rotate-90" />
              </motion.div>
            </motion.div>
          </section>

          {/* Tools Section */}
          <div id="tools-section" className="container mx-auto px-4 py-12">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Choose Your Tool
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Select a tool below to generate professional documents powered by Gemini AI
              </p>
            </motion.div>

            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-8">
              {/* Tool Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tools.map(({ value, icon: Icon, label, description, color }, index) => (
                  <motion.div
                    key={value}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card
                      className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                        selectedTab === value
                          ? 'ring-2 ring-orange-500 shadow-lg shadow-orange-500/20'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedTab(value)}
                      data-testid={`tool-card-${value}`}
                    >
                      <div className="p-6">
                        {/* Icon with gradient background */}
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-4`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-lg mb-2">{label}</h3>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground">{description}</p>

                        {/* Active Indicator */}
                        {selectedTab === value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="mt-4 flex items-center gap-2 text-orange-500"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm font-medium">Active</span>
                          </motion.div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Tool Content */}
              <div className="mt-8">
                <TabsContent value="technical" className="mt-0">
                  <TechnicalRiderSection />
                </TabsContent>
                <TabsContent value="requirements" className="mt-0">
                  <RequirementsSection />
                </TabsContent>
                <TabsContent value="budget" className="mt-0">
                  <BudgetSection />
                </TabsContent>
                <TabsContent value="logistics" className="mt-0">
                  <LogisticsSection />
                </TabsContent>
                <TabsContent value="hiring" className="mt-0">
                  <HiringSection />
                </TabsContent>
                <TabsContent value="ai" className="mt-0">
                  <AIToolsSection />
                </TabsContent>
                <TabsContent value="calendar" className="mt-0">
                  <CalendarSection />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
