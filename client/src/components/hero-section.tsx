import { motion } from "framer-motion";
import { SiSpotify, SiApplemusic, SiYoutube, SiTiktok, SiInstagram } from "react-icons/si";
import { ArrowRight, Sparkles, Bot, Music, Globe, Building2, ChevronRight, Play, TrendingUp } from "lucide-react";
import { Button } from "./ui/button";

interface HeroSectionProps {
  handleCreateLabel?: () => void;
}

export function HeroSection({ handleCreateLabel }: HeroSectionProps) {
  // Animation for fade-in elements
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };
  
  // Animation for scale-in elements
  const scaleIn = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { type: "spring", stiffness: 200, damping: 15, delay: 0.2 }
    }
  };
  
  // Supported platforms
  const platforms = [
    { icon: <SiSpotify className="h-5 w-5" />, name: "Spotify" },
    { icon: <SiApplemusic className="h-5 w-5" />, name: "Apple Music" },
    { icon: <SiYoutube className="h-5 w-5" />, name: "YouTube" },
    { icon: <SiTiktok className="h-5 w-5" />, name: "TikTok" },
    { icon: <SiInstagram className="h-5 w-5" />, name: "Instagram" }
  ];
  
  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-50"
      >
        <source src="/assets/Standard_Mode_Generated_Video (9).mp4" type="video/mp4" />
      </video>
      
      {/* Gradient and noise overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-[#121212]/80 z-0" />
      <div 
        className="absolute inset-0 bg-repeat opacity-20 z-0 mix-blend-overlay" 
        style={{ 
          backgroundImage: "url('/noise-pattern.png')", 
          backgroundSize: "200px 200px" 
        }} 
      />
      
      {/* Decorative glowing circles */}
      <div className="absolute top-[20%] right-[10%] w-[350px] h-[350px] rounded-full bg-orange-500/10 blur-[100px] animate-pulse-slow"></div>
      <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] rounded-full bg-purple-500/10 blur-[100px] animate-pulse-slow delay-1000"></div>
      
      <div className="container relative z-10 py-16 sm:py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Main content */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            className="flex flex-col gap-6"
          >
            <motion.div 
              variants={fadeIn} 
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-purple-500/20 border border-orange-500/30 text-orange-400 text-sm font-medium max-w-max"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Advanced AI Technology</span>
            </motion.div>
            
            <motion.h1 
              variants={fadeIn} 
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gray-300"
            >
              Create Your AI-Powered Virtual Record Label
            </motion.h1>
            
            <motion.p variants={fadeIn} className="text-lg text-gray-300 max-w-xl">
              Launch AI-generated virtual artists, distribute original music, and generate revenue from scratch without any prior music experience.
            </motion.p>
            
            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
              <Button 
                size="lg" 
                onClick={handleCreateLabel}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full px-8 hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
              >
                <Building2 className="mr-2 h-5 w-5" />
                <span>Get Started Now</span>
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="border-gray-700 text-white hover:bg-gray-800/50 rounded-full px-6 backdrop-blur-sm"
              >
                <Play className="mr-2 h-4 w-4" />
                Watch Demo
              </Button>
            </motion.div>
            
            {/* Stats Banner */}
            <motion.div 
              variants={fadeIn} 
              className="mt-10 grid grid-cols-3 gap-4 max-w-lg bg-black/30 backdrop-blur-md p-4 rounded-xl border border-gray-800"
            >
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white">100%</h3>
                <p className="text-xs text-gray-400">Copyright Ownership</p>
              </div>
              <div className="text-center border-x border-gray-700">
                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                  <TrendingUp className="inline h-5 w-5 mr-1 text-orange-400" />
                  80%
                </h3>
                <p className="text-xs text-gray-400">Faster Launch</p>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white">+10</h3>
                <p className="text-xs text-gray-400">Platforms</p>
              </div>
            </motion.div>
            
            {/* Supported Platforms */}
            <motion.div variants={fadeIn} className="mt-8">
              <p className="text-sm text-gray-400 mb-4">Distribution to all major platforms:</p>
              <div className="flex flex-wrap gap-6 items-center">
                {platforms.map((platform, index) => (
                  <motion.div 
                    key={platform.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + (index * 0.1) }}
                    className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {platform.icon}
                    <span className="text-sm font-medium">{platform.name}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
          
          {/* Right column - Feature cards */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={scaleIn}
            className="relative backdrop-blur-sm bg-black/20 p-6 rounded-2xl border border-gray-800/50"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FeatureCard 
                icon={<Bot className="h-5 w-5 text-orange-400" />}
                title="AI Virtual Artists"
                description="Create virtual artists with unique personalities and defined styles."
                delay={0.3}
              />
              
              <FeatureCard 
                icon={<Music className="h-5 w-5 text-orange-400" />}
                title="Music Generation"
                description="Produce high-quality music using advanced AI engines."
                delay={0.4}
              />
              
              <FeatureCard 
                icon={<Globe className="h-5 w-5 text-orange-400" />}
                title="Global Distribution"
                description="Publish automatically to Spotify, Apple Music and other platforms."
                delay={0.5}
              />
              
              <FeatureCard 
                icon={<Sparkles className="h-5 w-5 text-orange-400" />}
                title="AI Marketing"
                description="Promote your music with AI-generated marketing campaigns."
                delay={0.6}
              />
            </div>
            
            {/* Glow effect */}
            <div className="absolute -top-10 right-10 w-32 h-32 rounded-full bg-orange-500/20 blur-[80px] animate-pulse-slow"></div>
            <div className="absolute -bottom-10 left-10 w-32 h-32 rounded-full bg-purple-500/20 blur-[80px] animate-pulse-slow delay-700"></div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Component for feature cards
function FeatureCard({ 
  icon, 
  title, 
  description, 
  delay = 0 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-gradient-to-br from-gray-900/40 to-gray-900/20 backdrop-blur-sm rounded-xl p-5 border border-gray-700/30 hover:border-orange-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/5"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-2 rounded-lg bg-gray-800/50">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-gray-100 mb-1">{title}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}