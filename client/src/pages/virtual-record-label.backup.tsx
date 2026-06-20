import { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { PlanTierGuard } from "../components/youtube-views/plan-tier-guard";
import { useQuery } from "@tanstack/react-query";
import { doc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { v4 as uuidv4 } from "uuid";

// UI Components
import { Header } from "../components/layout/header";
import { HeroSection } from "../components/hero-section";
import ProgressOverlay from "../components/ProgressOverlay";
import UnderReviewScreen from "../components/UnderReviewScreen";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";

// Icons
import {
  Building2,
  Music2,
  ChevronRight,
  Globe,
  Users,
  Sparkles,
  Calendar,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Home,
  Check,
  Image,
  Wand2,
  Loader2,
  BarChart2,
  MessageSquare,
  CloudUpload,
  Shield,
  Zap,
  Database,
  Music,
  Award,
  Megaphone,
  Radio,
  Mail,
  Film,
  Bot,
  Settings
} from "lucide-react";
import { SiSpotify, SiApplemusic, SiYoutube, SiTiktok, SiInstagram } from "react-icons/si";

// Types
interface RecordLabelConfig {
  id: string;
  name: string;
  type: string;
  genre: string;
  platforms: string[];
  artistCount: number;
  artists: ArtistPreview[];
  logoUrl?: string;
  userId: string;
  createdAt: Date;
}

interface ArtistPreview {
  id: string;
  name: string;
  imagePrompt?: string;
  genre?: string;
  style?: string;
}

interface PlatformOption {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface GenreOption {
  id: string;
  name: string;
}

interface LabelTypeOption {
  id: string;
  name: string;
  description: string;
}

interface PlanOption {
  id: string;
  name: string;
  artistCount: number;
  price: number;
  features: string[];
  popular?: boolean;
}

// useEffect para simular la actualización periódica del estado
const useUpdateEffect = (callbackFn: () => void, delay: number) => {
  useEffect(() => {
    const interval = setInterval(() => {
      callbackFn();
    }, delay);
    
    return () => clearInterval(interval);
  }, [callbackFn, delay]);
};

export default function VirtualRecordLabelPage() {
  const { user, userSubscription } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  
  // Progress simulation states
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState(0);
  // Estado para pantalla de revisión (solo debe mostrarse después del envío)
  const [isUnderReview, setIsUnderReview] = useState(false);
  
  // Virtual Artists state
  const [showMyArtists, setShowMyArtists] = useState(false);
  
  // Query para cargar artistas virtuales del usuario
  const { data: myVirtualArtists, isLoading: loadingArtists, refetch: refetchArtists } = useQuery<any[]>({
    queryKey: ['/api/virtual-label/my-artists'],
    enabled: !!user
  });

  // Log de artistas para debugging
  useEffect(() => {
    if (Array.isArray(myVirtualArtists) && myVirtualArtists.length > 0) {
      logger.info('👥 Artistas virtuales cargados:', myVirtualArtists);
      myVirtualArtists.forEach((artist: any, index: number) => {
        logger.info(`Artista ${index + 1}:`, {
          name: artist.artistName,
          profileImage: artist.profileImage,
          hasImage: !!artist.profileImage
        });
      });
    }
  }, [myVirtualArtists]);
  
  // Console log para depuración
  useEffect(() => {
    logger.info("isUnderReview state:", isUnderReview);
  }, [isUnderReview]);
  
  // Stages for creation process
  const creationStages = [
    { 
      title: "Setup AI Music Engine", 
      description: "Configuring AI algorithms for music composition and audio mastering",
      icon: <CloudUpload className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Video Generation Framework", 
      description: "Setting up AI-powered video creation for artists through PiAPI",
      icon: <Film className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "AI Artist Generation", 
      description: "Creating virtual artists with GPT-based personalities and backstories",
      icon: <Users className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "CRM Integration", 
      description: "Configuring contact management system for industry professionals",
      icon: <Megaphone className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Analytics Dashboard", 
      description: "Setting up performance tracking and insights for your label",
      icon: <BarChart2 className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Digital Rights Management", 
      description: "Implementing protection systems for your intellectual property",
      icon: <Shield className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Distribution Network", 
      description: "Connecting to global streaming platforms and music marketplaces",
      icon: <DollarSign className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Finalizing Launch", 
      description: "Last touches before your virtual record label goes live",
      icon: <Zap className="h-5 w-5 text-orange-500" />
    }
  ];

  // Configuration state
  const [config, setConfig] = useState<Partial<RecordLabelConfig>>({
    name: "",
    type: "",
    genre: "",
    platforms: [],
    artistCount: 3,
    artists: [],
  });

  // Platform options
  const platforms: PlatformOption[] = [
    { id: "spotify", name: "Spotify", icon: <SiSpotify className="h-4 w-4" /> },
    { id: "apple", name: "Apple Music", icon: <SiApplemusic className="h-4 w-4" /> },
    { id: "youtube", name: "YouTube", icon: <SiYoutube className="h-4 w-4" /> },
    { id: "tiktok", name: "TikTok", icon: <SiTiktok className="h-4 w-4" /> },
    { id: "instagram", name: "Instagram", icon: <SiInstagram className="h-4 w-4" /> },
  ];

  // Genre options
  const genres: GenreOption[] = [
    { id: "pop", name: "Pop" },
    { id: "rock", name: "Rock" },
    { id: "hiphop", name: "Hip-Hop" },
    { id: "electronic", name: "Electronic" },
    { id: "rnb", name: "R&B" },
    { id: "jazz", name: "Jazz" },
    { id: "classical", name: "Classical" },
    { id: "country", name: "Country" },
    { id: "latin", name: "Latin" }
  ];

  // Label type options
  const labelTypes: LabelTypeOption[] = [
    { 
      id: "indie", 
      name: "Indie Label", 
      description: "Focus on niche genres and emerging artists with authentic creative direction"
    },
    { 
      id: "major", 
      name: "Major Label", 
      description: "Mainstream commercial approach with wide distribution and high-budget productions"
    },
    { 
      id: "personal", 
      name: "Personal Label", 
      description: "Dedicated to your own projects with complete creative control"
    }
  ];

  // Pricing plans
  const plans: PlanOption[] = [
    {
      id: "starter",
      name: "Starter",
      artistCount: 3,
      price: 49.99,
      features: [
        "3 AI-generated artists",
        "Basic strategic planning",
        "Standard distribution",
        "Simple analytics"
      ]
    },
    {
      id: "professional",
      name: "Professional",
      artistCount: 5,
      price: 99.99,
      popular: true,
      features: [
        "5 AI-generated artists",
        "Advanced release strategies",
        "Priority distribution",
        "Comprehensive analytics",
        "AI marketing assistant"
      ]
    },
    {
      id: "enterprise",
      name: "Enterprise",
      artistCount: 10,
      price: 199.99,
      features: [
        "10 AI-generated artists",
        "Custom release strategies",
        "Premium distribution",
        "Advanced analytics dashboard",
        "AI marketing campaigns",
        "Custom branding",
        "24/7 support"
      ]
    }
  ];

  // Testimonials
  const testimonials = [
    {
      name: "Sarah Johnson",
      label: "Cosmic Beats Records",
      quote: "Creating my Virtual Record Label has been transformative. With 5 AI artists, I've been able to expand into multiple genres and build a real audience.",
      image: "https://randomuser.me/api/portraits/women/32.jpg"
    },
    {
      name: "Michael Rodriguez",
      label: "Future Sound",
      quote: "The automation and AI features take care of the tedious parts of running a label. I'm now focusing on the creative direction while the platform handles the rest.",
      image: "https://randomuser.me/api/portraits/men/54.jpg"
    },
    {
      name: "Jasmine Chen",
      label: "Nebula Music Group",
      quote: "From zero music business experience to running a profitable label with multiple AI artists in just three months. The platform made it all possible.",
      image: "https://randomuser.me/api/portraits/women/68.jpg"
    }
  ];

  // FAQs
  const faqs = [
    {
      question: "How does the Virtual Record Label work?",
      answer: "Our platform uses AI to generate complete artist profiles including music, promotional content, and release strategies. You control the creative direction, genre, and marketing approach while our AI handles content creation and promotional tasks."
    },
    {
      question: "Can I customize my AI artists?",
      answer: "Yes, you can customize the name, style, genre, and visual appearance of each AI artist in your label. You can also direct their musical style and creative direction."
    },
    {
      question: "How is the music distributed?",
      answer: "We integrate with major distribution platforms including Spotify, Apple Music, YouTube Music, and more. The distribution process is automated once you approve releases."
    },
    {
      question: "Do I own the rights to the music?",
      answer: "Yes, all content created through your Virtual Record Label is owned by you, including full commercial rights."
    },
    {
      question: "Can I upgrade my plan later?",
      answer: "Absolutely! You can upgrade your plan at any time to access more AI artists and additional features."
    }
  ];

  // Step navigation
  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Generate random artist names based on genre
  const generateArtistNames = (genre: string, count: number) => {
    const prefixes = {
      pop: ["Crystal", "Echo", "Stellar", "Neon", "Pulse", "Nova", "Aura", "Luna"],
      rock: ["Thunder", "Raven", "Midnight", "Storm", "Savage", "Rebel", "Chaos", "Vortex"],
      hiphop: ["Young", "Lil", "MC", "DJ", "King", "Queen", "Dr.", "Professor"],
      electronic: ["Cyber", "Digital", "Binary", "Circuit", "Synth", "Pixel", "Vector", "Quantum"],
      rnb: ["Silk", "Velvet", "Soul", "Rhythm", "Harmony", "Melody", "Divine", "Royal"],
      jazz: ["Blue", "Smooth", "Midnight", "Brass", "Sax", "Rhythm", "Cool", "Mellow"],
      classical: ["Maestro", "Virtuoso", "Aria", "Symphony", "Opus", "Concerto", "Harmony", "Allegro"],
      country: ["Whiskey", "Dusty", "Desert", "Texas", "Wild", "Southern", "Ranch", "Prairie"],
      latin: ["Ritmo", "Fuego", "Salsa", "Latino", "Sol", "Alma", "Corazón", "Vida"]
    };

    const suffixes = {
      pop: ["Star", "Wave", "Glow", "Dream", "Heart", "Voice", "Shine", "Spark"],
      rock: ["Blade", "Fury", "Rage", "Fist", "Axe", "Fire", "Wolf", "Riff"],
      hiphop: ["Money", "Cash", "Flow", "Beats", "Hustler", "Lyric", "Rhyme", "Style"],
      electronic: ["Pulse", "Wave", "Byte", "Code", "Matrix", "Grid", "Glitch", "Techno"],
      rnb: ["Love", "Groove", "Vibe", "Feel", "Smooth", "Heartbreak", "Passion", "Mood"],
      jazz: ["Notes", "Tone", "Groove", "Soul", "Blues", "Rhythm", "Swing", "Improv"],
      classical: ["Sonata", "Quartet", "Ensemble", "Philharmonic", "Orchestra", "Chamber", "Strings", "Piano"],
      country: ["Road", "Trail", "Heart", "Boots", "Sunset", "Horizon", "Creek", "Valley"],
      latin: ["Caliente", "Ritmo", "Noche", "Estrella", "Sabor", "Pasión", "Fiesta", "Sol"]
    };

    const randomNames = [];
    const genreKey = genre as keyof typeof prefixes || "pop";
    const genrePrefixes = prefixes[genreKey] || prefixes.pop;
    const genreSuffixes = suffixes[genreKey] || suffixes.pop;

    for (let i = 0; i < count; i++) {
      const prefix = genrePrefixes[Math.floor(Math.random() * genrePrefixes.length)];
      const suffix = genreSuffixes[Math.floor(Math.random() * genreSuffixes.length)];
      const useSuffix = Math.random() > 0.3; // Sometimes don't use a suffix
      
      const name = useSuffix ? `${prefix} ${suffix}` : prefix;
      randomNames.push({ 
        id: uuidv4(),
        name,
        genre: genre,
        imagePrompt: `${genre} music artist ${name} professional portrait, high quality`
      });
    }

    return randomNames;
  };

  // Update artist count when plan changes
  const handlePlanChange = (planId: string) => {
    const selectedPlan = plans.find(plan => plan.id === planId);
    if (selectedPlan) {
      // PREMIUM plan users limited to 10 artists max
      const maxArtists = userSubscription?.plan === 'premium' ? 10 : selectedPlan.artistCount;
      setConfig({
        ...config,
        artistCount: Math.min(selectedPlan.artistCount, maxArtists)
      });
    }
  };

  // Update artists when genre changes
  const handleGenreChange = (genre: string) => {
    setConfig(prev => {
      const artistCount = prev.artistCount || 3;
      return {
        ...prev,
        genre,
        artists: generateArtistNames(genre, artistCount)
      };
    });
  };

  // Generate logo for the record label usando Gemini Nano Banana
  const generateLogo = async () => {
    if (!config.name || !config.genre) {
      toast({
        title: "Missing information",
        description: "Please fill in your label name and genre first.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingLogo(true);

    try {
      // Generar logo usando Gemini Nano Banana con prompt optimizado
      const logoPrompt = `Create a professional record label logo for "${config.name}", a ${config.genre} music label. Modern, minimalist design with music elements. High quality, clean vector style, professional branding.`;
      
      const response = await fetch('/api/ai/nano-banana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: logoPrompt,
          aspectRatio: '1:1'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate logo');
      }

      const data = await response.json();
      const logoUrl = data.imageUrl || data.url;
      
      if (!logoUrl) {
        throw new Error('No logo URL returned');
      }
      
      setConfig({
        ...config,
        logoUrl
      });
      
      toast({
        title: "Logo generated",
        description: "Your professional record label logo has been created with AI."
      });
    } catch (error) {
      logger.error("Error generating logo:", error);
      toast({
        title: "Error",
        description: "Could not generate logo with AI. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingLogo(false);
    }
  };

  // Create the virtual record label with real AI artists generation
  const createRecordLabel = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to create your record label.",
        variant: "destructive"
      });
      return;
    }

    if (!config.name || !config.type || !config.genre || !config.platforms || config.platforms.length === 0) {
      toast({
        title: "Missing information",
        description: "Please complete all required fields before creating your label.",
        variant: "destructive"
      });
      return;
    }

    setIsCreatingLabel(true);
    setShowProgress(true);
    setProgress(0);
    setProgressStage(0);

    try {
      // Create record label ID
      const recordLabelId = uuidv4();
      
      // Create a complete record label object
      const recordLabel: RecordLabelConfig = {
        id: recordLabelId,
        name: config.name || "",
        type: config.type || "",
        genre: config.genre || "",
        platforms: config.platforms || [],
        artistCount: config.artistCount || 3,
        artists: config.artists || [],
        logoUrl: config.logoUrl,
        userId: user.uid,
        createdAt: new Date()
      };
      
      // Function to update progress with animation
      const updateProgress = (stage: number, progressValue: number) => {
        return new Promise<void>(resolve => {
          setProgressStage(stage);
          const interval = setInterval(() => {
            setProgress(prev => {
              if (prev >= progressValue) {
                clearInterval(interval);
                resolve();
                return prev;
              }
              return prev + 1;
            });
          }, 30);
        });
      };
      
      // Stage 0-3: Setup and preparation
      for (let i = 0; i < 4; i++) {
        await updateProgress(i, Math.round(((i + 1) / creationStages.length) * 40));
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // Stage 4: Generate AI Artists (this is the real work)
      setProgressStage(4);
      const generatedArtistIds: number[] = [];
      
      // Generate each artist using the backend API
      for (let i = 0; i < config.artistCount; i++) {
        const artistConfig = config.artists?.[i];
        if (artistConfig) {
          try {
            const response = await fetch('/api/artist-generator/generate-artist/secure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: artistConfig.name,
                genre: config.genre,
                imagePrompt: artistConfig.imagePrompt,
                recordLabelId: recordLabelId
              })
            });
            
            if (response.ok) {
              const artistData = await response.json();
              generatedArtistIds.push(artistData.postgresId);
              logger.info(`✅ Generated artist: ${artistConfig.name}`, artistData);
            }
          } catch (error) {
            logger.error(`Error generating artist ${artistConfig.name}:`, error);
          }
        }
        
        // Update progress as we generate each artist
        const artistProgress = 40 + Math.round((i + 1) / config.artistCount * 30);
        setProgress(artistProgress);
      }
      
      // Stage 5-7: Final setup
      for (let i = 5; i < creationStages.length; i++) {
        await updateProgress(i, Math.round(((i + 1) / creationStages.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // Save record label to Firestore with generated artist data
      const recordLabelWithArtists = {
        ...recordLabel,
        generatedArtistIds,
        generatedAt: new Date().toISOString()
      };
      
      const docRef = doc(collection(db, "record_labels"), recordLabelId);
      await setDoc(docRef, recordLabelWithArtists);
      
      // Refresh the artists list
      await refetchArtists();
      
      // Show success toast
      toast({
        title: "Record Label Created!",
        description: `Successfully created ${generatedArtistIds.length} AI artists for your label!`,
      });
      
      // Show "Under Review" screen
      setIsUnderReview(true);
      
    } catch (error) {
      logger.error("Error creating record label:", error);
      toast({
        title: "Error",
        description: "Could not create your record label. Please try again.",
        variant: "destructive"
      });
      setShowProgress(false);
    } finally {
      setIsCreatingLabel(false);
    }
  };

  // Toggle platform selection
  const togglePlatform = (platformId: string) => {
    setConfig(prev => {
      const currentPlatforms = prev.platforms || [];
      if (currentPlatforms.includes(platformId)) {
        return {
          ...prev,
          platforms: currentPlatforms.filter(id => id !== platformId)
        };
      } else {
        return {
          ...prev,
          platforms: [...currentPlatforms, platformId]
        };
      }
    });
  };

  // Show progress overlay over normal content - Improved design with animation and better mobile support
  const ProgressOverlay = () => (
    <motion.div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-gradient-to-b from-background to-background/95 w-full max-w-md rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl border border-orange-500/10"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, type: "spring" }}
      >
        <div className="text-center space-y-3 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500/20 to-orange-500/5 rounded-full mx-auto flex items-center justify-center mb-4 shadow-inner">
            <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600">Creating Your Record Label</h2>
          <p className="text-muted-foreground">Please wait while we set up your professional music platform.</p>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Progress</p>
              <motion.p 
                key={progress}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600"
              >{progress}%</motion.p>
            </div>
            <div className="relative h-3 rounded-full bg-orange-500/10 overflow-hidden">
              <motion.div 
                className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-600"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          
          <motion.div 
            key={progressStage}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl p-5 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/10 shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-orange-500/10 rounded-full">
                {creationStages[progressStage].icon}
              </div>
              <div>
                <h3 className="font-semibold text-base sm:text-lg">{creationStages[progressStage].title}</h3>
                <p className="text-sm text-muted-foreground/80">{creationStages[progressStage].description}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
  
  // Under Review Screen - Improved design with modern elements and better mobile support
  const UnderReviewScreen = () => (
    <motion.div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center overflow-y-auto py-4 sm:py-6 md:py-10 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-gradient-to-b from-background to-background/95 w-full max-w-3xl rounded-2xl p-6 sm:p-8 my-auto shadow-2xl border border-orange-500/10"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, type: "spring" }}
      >
        <div className="text-center space-y-4 mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500/20 to-orange-500/5 rounded-full mx-auto flex items-center justify-center mb-4 shadow-inner relative">
            <Shield className="h-12 w-12 text-orange-500" />
            <div className="absolute inset-0 rounded-full border border-orange-500/20 animate-ping opacity-70"></div>
          </div>
          <motion.h2 
            className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Your Record Label is Under Review
          </motion.h2>
          <motion.p 
            className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Thank you for creating your virtual record label! Our team is reviewing your submission. 
            You'll receive an email at <span className="font-medium text-orange-500/90">{user?.email}</span> once it's approved.
          </motion.p>
        </div>

        {/* Review Process Steps - Enhanced with animations and styling */}
        <div className="mb-8 sm:mb-10">
          <motion.h3 
            className="text-lg sm:text-xl font-semibold mb-5 text-center bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Review Process
          </motion.h3>
          <div className="space-y-3 sm:space-y-4">
            <motion.div 
              className="flex items-start gap-3 p-4 rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-transparent shadow-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="mt-0.5 flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-orange-500/20 rounded-full flex items-center justify-center">
                <Check className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h4 className="font-semibold text-base sm:text-lg">Label Creation Complete</h4>
                <p className="text-sm text-muted-foreground/90">Your record label configuration has been successfully submitted</p>
              </div>
            </motion.div>
            
            <motion.div 
              className="flex items-start gap-3 p-4 rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-transparent shadow-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="mt-0.5 flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-orange-500/20 rounded-full flex items-center justify-center relative">
                <Loader2 className="h-5 w-5 text-orange-500 animate-spin" />
                <div className="absolute inset-0 rounded-full border border-orange-500/30 animate-pulse"></div>
              </div>
              <div>
                <h4 className="font-semibold text-base sm:text-lg">Quality Check <span className="text-orange-500 text-sm">(In Progress)</span></h4>
                <p className="text-sm text-muted-foreground/90">Our system is verifying your label details and preparing resources</p>
              </div>
            </motion.div>
            
            <motion.div 
              className="flex items-start gap-3 p-4 rounded-xl border border-muted bg-background/50"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 0.7, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <div className="mt-0.5 flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-muted/80 rounded-full flex items-center justify-center">
                <Database className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-semibold text-base sm:text-lg">AI Artist Generation</h4>
                <p className="text-sm text-muted-foreground/90">Creation of AI-powered artists based on your label's genre and style</p>
              </div>
            </motion.div>
            
            <motion.div 
              className="flex items-start gap-3 p-4 rounded-xl border border-muted bg-background/50"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 0.7, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="mt-0.5 flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-muted/80 rounded-full flex items-center justify-center">
                <Award className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-semibold text-base sm:text-lg">Label Activation</h4>
                <p className="text-sm text-muted-foreground/90">Final verification and dashboard access activation</p>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* What to Expect Cards - Enhanced grid with hover effects */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="p-5 space-y-3 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20 rounded-xl shadow-md hover:shadow-lg transition-shadow group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 transition-colors">
                <Calendar className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="font-semibold">Review Timeline</h3>
            </div>
            <p className="text-sm text-muted-foreground/90">Your label will be ready within 24-48 hours</p>
          </Card>
          
          <Card className="p-5 space-y-3 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20 rounded-xl shadow-md hover:shadow-lg transition-shadow group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 transition-colors">
                <Mail className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="font-semibold">Confirmation Email</h3>
            </div>
            <p className="text-sm text-muted-foreground/90">Detailed activation instructions will be sent to you</p>
          </Card>
          
          <Card className="p-5 space-y-3 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20 rounded-xl shadow-md hover:shadow-lg transition-shadow group sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 transition-colors">
                <Music className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="font-semibold">Content Creation</h3>
            </div>
            <p className="text-sm text-muted-foreground/90">AI-generated artists, tracks, and visual assets</p>
          </Card>
        </motion.div>
        
        {/* Call to Action Buttons - Enhanced buttons with animation */}
        <motion.div 
          className="text-center space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <p className="text-sm sm:text-base text-muted-foreground">
            While you wait, explore our resources for record label management or check out our educational content.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="outline" size="sm" className="flex gap-2 text-xs sm:text-sm border-orange-500/20 hover:bg-orange-500/5 hover:border-orange-500/30 transition-colors">
              <Music2 className="h-4 w-4 text-orange-500" />
              Industry Resources
            </Button>
            <Button variant="outline" size="sm" className="flex gap-2 text-xs sm:text-sm border-orange-500/20 hover:bg-orange-500/5 hover:border-orange-500/30 transition-colors">
              <Megaphone className="h-4 w-4 text-orange-500" />
              Marketing Tips
            </Button>
            <Button 
              onClick={() => setIsUnderReview(false)} 
              className="flex gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs sm:text-sm transition-colors"
              size="sm"
            >
              <Home className="h-4 w-4" />
              Return Home
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );

  return (
    <PlanTierGuard 
      requiredPlan="premium" 
      userSubscription={userSubscription} 
      featureName="Virtual Record Label"
    >
      <div className="min-h-screen bg-background">
        <Header />
      
      {/* Progress Overlay */}
      {showProgress && <ProgressOverlay />}
      
      {/* Under Review Screen */}
      {isUnderReview && <UnderReviewScreen />}
      
      {/* Enhanced Hero Section con video y animaciones */}
      <HeroSection handleCreateLabel={() => setCurrentStep(1)} />
      
      {/* My Virtual Artists Section - Solo si el usuario tiene artistas */}
      {user && Array.isArray(myVirtualArtists) && myVirtualArtists.length > 0 && (
        <section className="py-8 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 border-b">
          <div className="container">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Bot className="h-6 w-6 text-orange-500" />
                  Mis Artistas Virtuales
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {myVirtualArtists.length} {myVirtualArtists.length === 1 ? 'artista creado' : 'artistas creados'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      toast({
                        title: "Generando imágenes...",
                        description: "Esto puede tardar unos minutos"
                      });
                      
                      const res = await fetch('/api/artist-generator/regenerate-artist-images', {
                        method: 'POST'
                      });
                      const data = await res.json();
                      
                      if (data.success) {
                        toast({
                          title: "¡Imágenes generadas!",
                          description: data.message
                        });
                        refetchArtists();
                      } else {
                        throw new Error(data.error);
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: error instanceof Error ? error.message : "No se pudieron generar las imágenes",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  ✨ Generar Imágenes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMyArtists(!showMyArtists)}
                  data-testid="toggle-my-artists"
                >
                  {showMyArtists ? 'Ocultar' : 'Ver Todos'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {showMyArtists && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {myVirtualArtists.map((artist: any) => (
                  <Link
                    key={artist.id}
                    href={`/profile/${artist.slug}`}
                    data-testid={`artist-card-${artist.slug}`}
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                      <div className="aspect-square relative bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900">
                        {artist.profileImage ? (
                          <img
                            src={artist.profileImage}
                            alt={artist.artistName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music2 className="h-16 w-16 text-slate-400" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          IA
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold truncate">{artist.artistName}</h3>
                        {artist.genres && artist.genres.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {artist.genres.slice(0, 2).join(', ')}
                          </p>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
            
            {!showMyArtists && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {myVirtualArtists.slice(0, 6).map((artist: any) => (
                  <Link
                    key={artist.id}
                    href={`/profile/${artist.slug}`}
                    data-testid={`artist-preview-${artist.slug}`}
                  >
                    <div className="flex-shrink-0 w-24 cursor-pointer group">
                      <div className="aspect-square relative rounded-lg overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900">
                        {artist.profileImage ? (
                          <img
                            src={artist.profileImage}
                            alt={artist.artistName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music2 className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium mt-2 truncate text-center">{artist.artistName}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Configuration Steps */}
      <section className="container py-16 mb-8">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <div className="relative">
              {/* Progress Bar */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-2 rounded-full bg-gray-200/50 dark:bg-gray-700/30 backdrop-blur-sm">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentStep - 1) * 25}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600"
                />
              </div>
              
              {/* Step Indicators */}
              <div className="relative flex justify-between">
                {[1, 2, 3, 4, 5].map((step) => (
                  <motion.div 
                    key={step}
                    initial={{ scale: 0.9, opacity: 0.7 }}
                    animate={{ 
                      scale: currentStep >= step ? 1 : 0.9,
                      opacity: currentStep >= step ? 1 : 0.7
                    }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                    className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                      currentStep >= step 
                        ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {currentStep > step ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="font-semibold">{step}</span>
                    )}
                    
                    {/* Efecto de resplandor para el paso actual */}
                    {currentStep === step && (
                      <span className="absolute inset-0 rounded-full animate-pulse-slow bg-orange-400/20 -z-10 blur-sm"></span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between mt-3 text-sm">
              <motion.span 
                animate={{ 
                  opacity: currentStep >= 1 ? 1 : 0.5,
                  color: currentStep >= 1 ? 'rgb(245, 120, 63)' : 'rgb(156, 163, 175)'
                }}
                className="font-medium max-w-[80px] text-center"
              >
                Tipo de Sello
              </motion.span>
              <motion.span 
                animate={{ 
                  opacity: currentStep >= 2 ? 1 : 0.5,
                  color: currentStep >= 2 ? 'rgb(245, 120, 63)' : 'rgb(156, 163, 175)'
                }}
                className="font-medium max-w-[80px] text-center"
              >
                Género y Plataformas
              </motion.span>
              <motion.span 
                animate={{ 
                  opacity: currentStep >= 3 ? 1 : 0.5,
                  color: currentStep >= 3 ? 'rgb(245, 120, 63)' : 'rgb(156, 163, 175)'
                }}
                className="font-medium max-w-[80px] text-center"
              >
                Artistas
              </motion.span>
              <motion.span 
                animate={{ 
                  opacity: currentStep >= 4 ? 1 : 0.5,
                  color: currentStep >= 4 ? 'rgb(245, 120, 63)' : 'rgb(156, 163, 175)'
                }}
                className="font-medium max-w-[80px] text-center"
              >
                Resumen
              </motion.span>
              <motion.span 
                animate={{ 
                  opacity: currentStep >= 5 ? 1 : 0.5,
                  color: currentStep >= 5 ? 'rgb(245, 120, 63)' : 'rgb(156, 163, 175)'
                }}
                className="font-medium max-w-[80px] text-center"
              >
                Finalizar
              </motion.span>
            </div>
          </motion.div>

          {/* Step 1: Label Type */}
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Step 1: Choose Your Label Type</h2>
                <p className="text-muted-foreground">Select the type of record label you want to create</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {labelTypes.map((type) => (
                  <Card 
                    key={type.id}
                    className={`p-6 cursor-pointer transition-all hover:shadow-md ${
                      config.type === type.id ? 'border-[#121212] bg-[#121212]/5' : ''
                    }`}
                    onClick={() => setConfig({ ...config, type: type.id })}
                  >
                    <div className="flex flex-col h-full">
                      <div className="mb-4">
                        <Building2 className="h-8 w-8 text-[#121212] mb-2" />
                        <h3 className="text-xl font-bold">{type.name}</h3>
                      </div>
                      <p className="text-muted-foreground flex-grow">{type.description}</p>
                      {config.type === type.id && (
                        <div className="mt-4 flex justify-end">
                          <div className="bg-[#121212] text-white rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label htmlFor="label-name">Record Label Name</Label>
                  <Input 
                    id="label-name" 
                    placeholder="Enter your label name"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  />
                </div>
                
                <div className="flex items-end">
                  <Button 
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
                    disabled={!config.type || !config.name}
                    onClick={nextStep}
                  >
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Genre & Platform */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Step 2: Select Genre & Platforms</h2>
                <p className="text-muted-foreground">Choose your music genre and distribution platforms</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Genre Selection */}
                <div className="space-y-4">
                  <Label>Music Genre</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {genres.map((genre) => (
                      <Button
                        key={genre.id}
                        variant="outline"
                        className={`border h-10 py-2 px-4 rounded-md transition-all ${
                          config.genre === genre.id 
                            ? 'bg-[#121212] text-white hover:bg-[#202020]' 
                            : 'hover:bg-[#121212]/10 hover:text-[#121212]'
                        }`}
                        onClick={() => handleGenreChange(genre.id)}
                      >
                        {genre.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Platform Selection */}
                <div className="space-y-4">
                  <Label>Distribution Platforms</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {platforms.map((platform) => (
                      <Button
                        key={platform.id}
                        variant="outline"
                        className={`border h-10 py-2 px-4 rounded-md transition-all flex items-center gap-2 ${
                          (config.platforms || []).includes(platform.id)
                            ? 'bg-[#121212] text-white hover:bg-[#202020]'
                            : 'hover:bg-[#121212]/10 hover:text-[#121212]'
                        }`}
                        onClick={() => togglePlatform(platform.id)}
                      >
                        {platform.icon}
                        {platform.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button 
                  variant="outline"
                  onClick={prevStep}
                  className="border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 transition-all"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
                  disabled={!config.genre || !(config.platforms || []).length}
                  onClick={nextStep}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Artist Count / Plan Selection */}
          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Step 3: Choose Your Plan</h2>
                <p className="text-muted-foreground">Select the number of AI artists for your label</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`relative overflow-hidden transition-all ${
                      config.artistCount === plan.artistCount 
                        ? 'border-[#121212] bg-[#121212]/5' 
                        : ''
                    } ${
                      plan.popular ? 'shadow-lg' : ''
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0 bg-[#121212] text-white px-3 py-1 text-xs font-medium rounded-bl-lg">
                        Popular
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                      <div className="flex items-baseline mb-4">
                        <span className="text-3xl font-bold">${plan.price}</span>
                        <span className="text-muted-foreground text-sm ml-2">/month</span>
                      </div>
                      <div className="border-t border-border pt-4 mb-6">
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <Users className="h-4 w-4 text-[#121212]" />
                          <span className="font-semibold">{plan.artistCount} AI Artists</span>
                        </div>
                        <ul className="space-y-2 mb-6">
                          {plan.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Check className="h-4 w-4 text-[#121212] mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button
                        className={`w-full ${
                          plan.popular 
                            ? 'bg-[#121212] hover:bg-[#202020] text-white' 
                            : 'bg-[#121212]/10 hover:bg-[#121212]/20 text-[#121212]'
                        }`}
                        onClick={() => handlePlanChange(plan.id)}
                      >
                        {config.artistCount === plan.artistCount ? 'Selected' : 'Select Plan'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between">
                <Button 
                  variant="outline"
                  onClick={prevStep}
                  className="border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 transition-all"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
                  disabled={!config.artistCount}
                  onClick={nextStep}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Summary & Confirmation */}
          {currentStep === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Step 4: Review & Confirm</h2>
                <p className="text-muted-foreground">Review your Virtual Record Label details</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Label Preview */}
                <div className="md:col-span-2">
                  <Card className="p-6 overflow-hidden">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      {/* Logo */}
                      <div className="flex-shrink-0">
                        {config.logoUrl ? (
                          <img 
                            src={config.logoUrl} 
                            alt={config.name} 
                            className="w-32 h-32 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-32 h-32 bg-[#121212]/10 rounded-lg flex items-center justify-center">
                            <Building2 className="h-12 w-12 text-[#121212]" />
                          </div>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="mt-2 w-full"
                          onClick={generateLogo}
                          disabled={isGeneratingLogo}
                        >
                          {isGeneratingLogo ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Image className="mr-2 h-4 w-4" />
                              Generate Logo
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {/* Label Details */}
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold mb-1">{config.name || "Your Record Label"}</h3>
                        <p className="text-muted-foreground mb-4">
                          {labelTypes.find(t => t.id === config.type)?.name || "Record Label"}
                        </p>
                        
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm text-muted-foreground">Genre</Label>
                            <p className="font-medium">{genres.find(g => g.id === config.genre)?.name || "Not selected"}</p>
                          </div>
                          
                          <div>
                            <Label className="text-sm text-muted-foreground">Distribution Platforms</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {(config.platforms || []).map(platform => {
                                const plat = platforms.find(p => p.id === platform);
                                return (
                                  <div 
                                    key={platform}
                                    className="bg-[#121212]/10 text-[#121212] px-2 py-1 rounded-md text-sm flex items-center gap-1"
                                  >
                                    {plat?.icon}
                                    {plat?.name}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-sm text-muted-foreground">AI Artists</Label>
                            <p className="font-medium">{config.artistCount} artists</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Artists Preview */}
                    <div className="mt-6 border-t pt-4">
                      <h4 className="font-semibold mb-3">Generated Artists</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {(config.artists || []).map((artist, index) => (
                          <div key={artist.id} className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-[#121212]/10 rounded-full flex items-center justify-center">
                              <Music2 className="h-5 w-5 text-[#121212]" />
                            </div>
                            <span>{artist.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
                
                {/* Integrations */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Label Integrations</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#121212]/10 rounded-full flex items-center justify-center">
                        <Wand2 className="h-5 w-5 text-[#121212]" />
                      </div>
                      <div>
                        <p className="font-medium">AI Marketing Assistant</p>
                        <p className="text-sm text-muted-foreground">Personalized strategies</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#121212]/10 rounded-full flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-[#121212]" />
                      </div>
                      <div>
                        <p className="font-medium">Release Automation</p>
                        <p className="text-sm text-muted-foreground">Scheduled publishing</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#121212]/10 rounded-full flex items-center justify-center">
                        <BarChart2 className="h-5 w-5 text-[#121212]" />
                      </div>
                      <div>
                        <p className="font-medium">Analytics Dashboard</p>
                        <p className="text-sm text-muted-foreground">Performance tracking</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#121212]/10 rounded-full flex items-center justify-center">
                        <Globe className="h-5 w-5 text-[#121212]" />
                      </div>
                      <div>
                        <p className="font-medium">Global Distribution</p>
                        <p className="text-sm text-muted-foreground">Multi-platform support</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t">
                    <Button 
                      className="w-full bg-[#121212] hover:bg-[#202020]"
                      onClick={createRecordLabel}
                      disabled={isCreatingLabel}
                    >
                      {isCreatingLabel ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Building2 className="mr-2 h-4 w-4" />
                          Create My Virtual Record Label
                          <Bot className="ml-2 h-4 w-4 text-orange-500" />
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="flex justify-between">
                <Button 
                  variant="outline"
                  onClick={prevStep}
                  className="border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 transition-all"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
                  onClick={createRecordLabel}
                  disabled={isCreatingLabel}
                >
                  {isCreatingLabel ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Building2 className="mr-2 h-4 w-4" />
                      Create My Virtual Record Label
                      <Bot className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 5: Success */}
          {currentStep === 5 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-6"
            >
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold mb-2">Your Virtual Record Label is Ready!</h2>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                  Congratulations! You've successfully created your AI-powered record label. 
                  You can now manage your artists, releases, and marketing from your dashboard.
                </p>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 justify-center">
                <Button 
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
                  size="lg"
                >
                  <Building2 className="mr-2 h-5 w-5" />
                  Go to Label Dashboard
                </Button>
                <Button 
                  variant="outline"
                  size="lg"
                  className="border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 transition-all"
                >
                  <ArrowRight className="mr-2 h-5 w-5" />
                  Explore Label Tools
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      {/* Key Features Section */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Key Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our Virtual Record Label platform provides everything you need to succeed in the music industry
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            {/* Music Generation Feature */}
            <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-full bg-[#121212]/10 flex items-center justify-center mb-4">
                <Music className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Advanced Music Generation</h3>
              <p className="text-muted-foreground text-sm">
                Create professional-quality tracks with our AI-powered music generation system. Control genre, mood, and style.
              </p>
            </div>
            
            {/* Video Creation Feature */}
            <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-full bg-[#121212]/10 flex items-center justify-center mb-4">
                <Film className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Professional Video Creation</h3>
              <p className="text-muted-foreground text-sm">
                Generate high-quality music videos and promotional content using state-of-the-art AI video technology.
              </p>
            </div>
            
            {/* Virtual Artists Feature */}
            <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-full bg-[#121212]/10 flex items-center justify-center mb-4">
                <Bot className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Virtual Artists</h3>
              <p className="text-muted-foreground text-sm">
                Create and manage AI-powered artists with unique personalities, styles, and visual identities.
              </p>
            </div>
            
            {/* CRM System Feature */}
            <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-full bg-[#121212]/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Industry CRM System</h3>
              <p className="text-muted-foreground text-sm">
                Connect with music industry professionals, venues, and promoters through our integrated contact management system.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Success Stories Section */}
      <section className="bg-muted py-16">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Success Stories</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Join hundreds of creators who are building successful music businesses with Virtual Record Labels
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className="p-6 h-full">
                  <div className="mb-4 flex items-center gap-4">
                    <img 
                      src={testimonial.image} 
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="font-semibold">{testimonial.name}</h3>
                      <p className="text-sm text-orange-500">{testimonial.label}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground italic">"{testimonial.quote}"</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about Virtual Record Labels and AI artists
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto space-y-6">
          {faqs.map((faq, index) => (
            <Card key={index} className="p-6">
              <h3 className="text-xl font-semibold mb-2">{faq.question}</h3>
              <p className="text-muted-foreground">{faq.answer}</p>
            </Card>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-6">Still have questions?</p>
          <Button 
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
            size="lg"
          >
            <MessageSquare className="mr-2 h-5 w-5" />
            Contact Support
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-[#121212] to-[#303030] text-white py-16">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Launch Your Virtual Record Label?</h2>
          <p className="max-w-2xl mx-auto mb-8 text-white/90">
            Start your journey today and join the future of music creation and distribution.
          </p>
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
            onClick={() => setCurrentStep(1)}
          >
            <Building2 className="mr-2 h-5 w-5" />
            Create Your Label Now
          </Button>
        </div>
      </section>
      </div>
    </PlanTierGuard>
  );
}