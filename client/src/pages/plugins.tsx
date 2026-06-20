import { useState } from "react";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { motion } from "framer-motion";
import { 
  Puzzle, 
  Newspaper, 
  Zap, 
  Share, 
  Calendar, 
  Settings, 
  RefreshCcw,
  MessageSquare,
  Sparkles,
  BarChart,
  Radio,
  Music,
  Headphones,
  CreditCard,
  Code,
  Rocket
} from "lucide-react";

import { 
  BeatNewsPlugin, 
  ContentPulsePlugin, 
  SocialSyncPlugin,
  EventBeatPlugin,
  TuneMatchPlugin,
  TrendTrackerPlugin,
  StreamLinkPlugin,
  EchoChatPlugin,
  SEOPulsePlugin
} from "../components/plugins";
import { PluginPricingPlans } from "../components/plugins/plugin-pricing-plans";

export default function PluginsPage() {
  const [activePlugin, setActivePlugin] = useState<string>("beatnews");
  const [activeSection, setActiveSection] = useState<'plugins' | 'pricing'>('plugins');
  
  const plugins = [
    { 
      id: "beatnews", 
      name: "BeatNews", 
      description: "Automatic music news aggregation and publishing",
      icon: <Newspaper className="h-5 w-5 text-orange-500" />,
      component: <BeatNewsPlugin />
    },
    { 
      id: "contentpulse", 
      name: "ContentPulse", 
      description: "AI-powered content curation and generation",
      icon: <Zap className="h-5 w-5 text-orange-500" />,
      component: <ContentPulsePlugin />
    },
    { 
      id: "socialsync", 
      name: "SocialSync", 
      description: "Social media management and analytics",
      icon: <Share className="h-5 w-5 text-orange-500" />,
      component: <SocialSyncPlugin />
    },
    { 
      id: "eventbeat", 
      name: "EventBeat", 
      description: "Music event tracking and promotion",
      icon: <Calendar className="h-5 w-5 text-orange-500" />,
      component: <EventBeatPlugin />
    },
    { 
      id: "tunematch", 
      name: "TuneMatch", 
      description: "Personalized content recommendations based on user preferences",
      icon: <Headphones className="h-5 w-5 text-orange-500" />,
      component: <TuneMatchPlugin />
    },
    { 
      id: "trendtracker", 
      name: "TrendTracker", 
      description: "Analytics and visualization of content interaction trends",
      icon: <BarChart className="h-5 w-5 text-orange-500" />,
      component: <TrendTrackerPlugin />
    },
    { 
      id: "streamlink", 
      name: "StreamLink", 
      description: "Music streaming platform integration and analytics",
      icon: <Radio className="h-5 w-5 text-orange-500" />,
      component: <StreamLinkPlugin />
    },
    { 
      id: "echochat", 
      name: "EchoChat", 
      description: "User engagement through comments management across all platforms",
      icon: <MessageSquare className="h-5 w-5 text-orange-500" />,
      component: <EchoChatPlugin />
    },
    { 
      id: "seopulse", 
      name: "SEOPulse", 
      description: "Optimize content for search engines and improve visibility",
      icon: <Sparkles className="h-5 w-5 text-orange-500" />,
      component: <SEOPulsePlugin />
    }
  ];
  
  // Find active plugin
  const currentPlugin = plugins.find(p => p.id === activePlugin) || plugins[0];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <HeroSection />
      
      <div className="container mx-auto py-6 space-y-6">
        {/* Nav Tabs */}
        <div className="flex justify-center mt-4 mb-8">
          <Tabs defaultValue="plugins" className="w-full max-w-md">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger 
                value="plugins" 
                onClick={() => setActiveSection('plugins')}
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
              >
                <Puzzle className="h-4 w-4 mr-2" />
                Plugins
              </TabsTrigger>
              <TabsTrigger 
                value="pricing" 
                onClick={() => setActiveSection('pricing')}
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pricing Plans
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {activeSection === 'plugins' ? (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center">
                <Puzzle className="h-8 w-8 mr-3 text-orange-500" />
                <div>
                  <h1 className="text-2xl font-bold">Admin Plugins</h1>
                  <p className="text-muted-foreground">Extend your platform with powerful integrated tools</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Refresh All
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Plugin Settings
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <Card className="p-4">
                  <div className="space-y-1 mb-4">
                    <h3 className="font-medium">Active Plugins</h3>
                    <p className="text-xs text-muted-foreground">Select a plugin to configure</p>
                  </div>
                  
                  <div className="space-y-2">
                    {plugins.map(plugin => (
                      <Button
                        key={plugin.id}
                        variant={activePlugin === plugin.id ? "default" : "ghost"}
                        className={`w-full justify-start ${activePlugin === plugin.id ? "" : "text-muted-foreground"}`}
                        onClick={() => setActivePlugin(plugin.id)}
                      >
                        <div className="mr-2">
                          {plugin.icon}
                        </div>
                        <div className="text-left">
                          <div>{plugin.name}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </Card>
              </div>
              
              <div className="md:col-span-3">
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                    {currentPlugin.icon}
                    <div>
                      <h2 className="text-xl font-semibold">{currentPlugin.name}</h2>
                      <p className="text-muted-foreground">{currentPlugin.description}</p>
                    </div>
                  </div>
                  
                  {currentPlugin.component}
                </Card>
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Choose Your Plugin Plan</h2>
              <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
                Select the right plan for your needs with our flexible pricing options.
                Each plan includes a set of powerful plugins to boost your music career.
              </p>
            </div>
            <PluginPricingPlans />
          </div>
        )}
      </div>
    </div>
  );
}

// Hero section with background video similar to music-video-creator
const HeroSection = () => (
  <div className="relative w-full min-h-[50vh] overflow-hidden">
    <video
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover opacity-90"
    >
      <source src="/background-video.mp4" type="video/mp4" />
    </video>
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-background" />
    <div className="relative z-10 container mx-auto h-full flex flex-col justify-center items-center px-4 py-8 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/40 backdrop-blur-sm rounded-lg p-4 sm:p-6 w-full max-w-[95%] sm:max-w-md md:max-w-2xl text-center"
      >
        <motion.h1
          className="text-xl sm:text-3xl md:text-5xl font-bold text-orange-400 mb-2 sm:mb-4"
          style={{ textShadow: '0 4px 8px rgba(0,0,0,0.8)' }}
        >
          Powerful Admin Plugins
        </motion.h1>
        <motion.p
          transition={{ delay: 0.2 }}
          className="text-xs sm:text-base md:text-lg text-white/90 mb-4 sm:mb-6"
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
        >
          Extend your music platform with specialized tools to automate tasks, gain insights, and boost engagement
        </motion.p>
      </motion.div>
      <PluginFeatures />
    </div>
  </div>
);

const PluginFeatures = () => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 sm:mt-8 w-full max-w-[95%] sm:max-w-[90%] mx-auto">
    {featuresList.map((feature, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 + index * 0.1 }}
        className="bg-black/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20 hover:border-orange-500/50 transition-colors"
      >
        <div className="flex flex-col items-center text-center">
          <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500 mb-2 sm:mb-3" />
          <h3 className="text-sm sm:text-base font-semibold text-white mb-1 sm:mb-2">{feature.title}</h3>
          <p className="text-xs sm:text-sm text-white/90">{feature.description}</p>
        </div>
      </motion.div>
    ))}
  </div>
);

const featuresList = [
  {
    icon: Zap,
    title: "AI-Powered Tools",
    description: "Leverage artificial intelligence to automate content creation, curation, and optimization",
  },
  {
    icon: Code,
    title: "Easy Integration",
    description: "Seamlessly connect with all your music marketing platforms and social media accounts",
  },
  {
    icon: Rocket,
    title: "Boost Engagement",
    description: "Increase fan interaction and visibility with specialized engagement-focused plugins",
  },
];