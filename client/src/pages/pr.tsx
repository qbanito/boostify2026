import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";
import { Header } from "../components/layout/header";
import { apiRequest, queryClient } from "../lib/queryClient";
import { PlanTierGuard } from "../components/youtube-views/plan-tier-guard";
import { ArtistLandingPage } from "../components/artist/artist-landing-page";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Rocket,
  Radio,
  Tv,
  Mic,
  Globe,
  Mail,
  Phone,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  Pause,
  Play,
  Music,
  Video,
  Users,
  Megaphone,
  Target,
  ArrowRight,
  Loader2,
  Eye,
  MessageSquare,
  Star,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  User,
  Zap,
  Send
} from "lucide-react";

// Animation variants for staggered children
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" }
  },
  hover: { 
    scale: 1.02, 
    y: -5,
    boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
    transition: { duration: 0.2 }
  }
};

const heroTextVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const floatingIconVariants = {
  animate: {
    y: [0, -10, 0],
    rotate: [0, 5, -5, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

const pulseVariants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

const wizardStepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    transition: { duration: 0.3 }
  })
};

const statCounterVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      type: "spring",
      stiffness: 100
    }
  })
};

// Floating particles component for hero
const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-full bg-primary/30"
        initial={{ 
          x: Math.random() * 100 + "%", 
          y: "100%",
          opacity: 0 
        }}
        animate={{ 
          y: "-20%", 
          opacity: [0, 1, 0],
          x: `${Math.random() * 100}%`
        }}
        transition={{ 
          duration: Math.random() * 5 + 5,
          repeat: Infinity,
          delay: Math.random() * 5,
          ease: "linear"
        }}
      />
    ))}
  </div>
);

// Animated stat counter component
const AnimatedCounter = ({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (isInView) {
      const duration = 1500;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }
  }, [isInView, value]);
  
  return <span ref={ref}>{prefix}{count}{suffix}</span>;
};

// Professional Email Preview Component
interface EmailPreviewProps {
  artistName: string;
  artistImage: string | null;
  artistBio: string;
  genre: string;
  contentType: string;
  contentTitle: string;
  pitchMessage: string;
  landingUrl: string;
  templateType: string;
}

const EmailPreview = ({ 
  artistName, 
  artistImage, 
  artistBio, 
  genre, 
  contentType,
  contentTitle,
  pitchMessage, 
  landingUrl,
  templateType 
}: EmailPreviewProps) => {
  const getTemplateColors = () => {
    switch(templateType) {
      case 'sync_opportunity':
        return { primary: '#F59E0B', secondary: '#EF4444', gradient: 'from-amber-500 to-red-500' };
      case 'follow_up':
        return { primary: '#8B5CF6', secondary: '#EC4899', gradient: 'from-violet-500 to-pink-500' };
      default:
        return { primary: '#8B5CF6', secondary: '#EC4899', gradient: 'from-violet-500 to-pink-500' };
    }
  };
  
  const colors = getTemplateColors();
  
  return (
    <motion.div 
      className="bg-[#0a0a0a] rounded-xl overflow-hidden shadow-2xl border border-white/10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Email Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} p-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">BOOSTIFY MUSIC</h3>
            <p className="text-white/80 text-xs">Professional Artist Outreach</p>
          </div>
        </div>
      </div>
      
      {/* Email Subject */}
      <div className="bg-[#1a1a2e] px-6 py-3 border-b border-white/10">
        <p className="text-white/60 text-xs mb-1">Subject:</p>
        <p className="text-white font-medium">
          🎵 Introducing {artistName || '[Artist Name]'} - {contentType === 'single' ? 'New Single' : contentType === 'album' ? 'New Album' : 'New Release'}: {contentTitle || '[Content Title]'}
        </p>
      </div>
      
      {/* Email Body */}
      <div className="p-6 bg-gradient-to-b from-[#1a1a2e] to-[#16213e]">
        {/* Greeting */}
        <p className="text-white/70 mb-4">
          Hi <span className="text-white">[Contact Name]</span>,
        </p>
        
        {/* Pitch Message */}
        <div className="text-white/90 leading-relaxed mb-6 whitespace-pre-wrap">
          {pitchMessage || 'Your AI-generated pitch message will appear here...'}
        </div>
        
        {/* Artist Card */}
        <motion.div 
          className="rounded-xl overflow-hidden mb-6"
          style={{ background: `linear-gradient(135deg, ${colors.primary}15, ${colors.secondary}15)` }}
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-4 p-4">
            {/* Artist Image */}
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-white/20">
              {artistImage ? (
                <img 
                  src={artistImage} 
                  alt={artistName} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-purple-500/30 flex items-center justify-center">
                  <User className="w-8 h-8 text-white/50" />
                </div>
              )}
            </div>
            
            {/* Artist Info */}
            <div className="flex-1">
              <h4 className="text-white font-bold text-xl mb-1">{artistName || '[Artist Name]'}</h4>
              <p className="text-white/60 text-sm mb-2">{genre || '[Genre]'}</p>
              {artistBio && (
                <p className="text-white/50 text-xs line-clamp-2">{artistBio}</p>
              )}
            </div>
          </div>
          
          {/* Content Highlight */}
          <div className="px-4 pb-4">
            <div className="bg-black/30 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {contentType === 'single' && <Music className="w-4 h-4 text-primary" />}
                {contentType === 'album' && <Music className="w-4 h-4 text-purple-400" />}
                {contentType === 'video' && <Video className="w-4 h-4 text-pink-400" />}
                {contentType === 'tour' && <Users className="w-4 h-4 text-blue-400" />}
                {contentType === 'announcement' && <Megaphone className="w-4 h-4 text-amber-400" />}
                <span className="text-white text-sm font-medium">{contentTitle || '[Content Title]'}</span>
              </div>
              <Badge className="bg-white/10 text-white border-none text-xs">
                {contentType === 'single' ? 'Single' : 
                 contentType === 'album' ? 'Album' :
                 contentType === 'video' ? 'Music Video' :
                 contentType === 'tour' ? 'Tour' : 'Announcement'}
              </Badge>
            </div>
          </div>
        </motion.div>
        
        {/* CTA Button */}
        <div className="text-center mb-6">
          <motion.a
            href={landingUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-white bg-gradient-to-r ${colors.gradient} shadow-lg hover:shadow-xl transition-shadow`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Play className="w-5 h-5" />
            View Full Profile & Listen
            <ArrowRight className="w-4 h-4" />
          </motion.a>
        </div>
        
        {/* Landing Page Preview */}
        {landingUrl && (
          <div className="mb-6 bg-black/30 rounded-lg p-3">
            <p className="text-white/40 text-xs mb-2 flex items-center gap-2">
              <Globe className="w-3 h-3" />
              Artist Landing Page:
            </p>
            <p className="text-primary text-sm font-mono break-all">{landingUrl}</p>
          </div>
        )}
        
        {/* Closing */}
        <div className="border-t border-white/10 pt-4 mt-4">
          <p className="text-white/60 text-sm mb-2">
            I'd love to discuss potential opportunities for coverage or an interview.
          </p>
          <p className="text-white/80 text-sm">
            Best regards,<br/>
            <span className="text-white font-semibold">Boostify Music Team</span>
          </p>
        </div>
      </div>
      
      {/* Email Footer */}
      <div className="bg-[#0f0f1a] px-6 py-4 flex items-center justify-between border-t border-white/10">
        <p className="text-white/40 text-xs">
          © 2025 Boostify Music
        </p>
        <a href="#" className="text-white/40 text-xs hover:text-white/60 underline">
          Unsubscribe
        </a>
      </div>
    </motion.div>
  );
};

// Interface for artist data from my-artists
interface MyArtist {
  id: number;
  name: string;
  slug: string;
  profileImage: string | null;
  coverImage: string | null;
  genres: string | null;
  country: string | null;
  isAIGenerated: boolean;
  bio?: string;
}

interface PRCampaign {
  id: number;
  userId: number;
  title: string;
  artistName: string;
  artistProfileUrl: string;
  contentType: "single" | "album" | "video" | "tour" | "announcement";
  contentTitle: string;
  contentUrl: string;
  targetMediaTypes: string[];
  targetCountries: string[];
  targetGenres: string[];
  pitchMessage: string;
  contactEmail: string;
  contactPhone: string;
  status: "draft" | "active" | "paused" | "completed";
  mediaContacted: number;
  emailsOpened: number;
  mediaReplied: number;
  interviewsBooked: number;
  createdAt: string;
  updatedAt: string;
}

interface WebhookEvent {
  id: number;
  campaignId: number;
  eventType: "email_sent" | "email_opened" | "media_replied" | "interview_booked";
  mediaName: string;
  mediaEmail: string;
  notes: string;
  createdAt: string;
}

const CONTENT_TYPES = [
  { value: "single", label: "Single", icon: Music },
  { value: "album", label: "Álbum", icon: Music },
  { value: "video", label: "Video Musical", icon: Video },
  { value: "tour", label: "Tour/Concierto", icon: Users },
  { value: "announcement", label: "Anuncio", icon: Megaphone }
];

const MEDIA_TYPES = [
  { value: "radio", label: "Radio", icon: Radio },
  { value: "tv", label: "TV", icon: Tv },
  { value: "podcast", label: "Podcast", icon: Mic },
  { value: "blog", label: "Blog", icon: Globe },
  { value: "magazine", label: "Revista", icon: Globe }
];

const COUNTRIES = [
  "USA", "Mexico", "Colombia", "Argentina", "España", "Chile", 
  "Peru", "Ecuador", "Venezuela", "Puerto Rico", "República Dominicana"
];

const GENRES = [
  "Urban", "Latin Pop", "Reggaeton", "Trap", "Salsa", "Bachata",
  "Regional Mexicano", "Cumbia", "Dembow", "Electronic", "Hip Hop"
];

export default function PRPage() {
  const { toast } = useToast();
  const { user, userSubscription, isAdmin } = useAuth();
  const [activeView, setActiveView] = useState<"list" | "wizard" | "campaign">("list");
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardDirection, setWizardDirection] = useState(1);
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  const heroRef = useRef(null);
  const isHeroInView = useInView(heroRef, { once: true });
  
  const [formData, setFormData] = useState({
    title: "",
    artistName: "",
    artistProfileUrl: "",
    contentType: "single" as const,
    contentTitle: "",
    contentUrl: "",
    targetMediaTypes: [] as string[],
    targetCountries: [] as string[],
    targetGenres: [] as string[],
    pitchMessage: "",
    contactEmail: user?.email || "",
    contactPhone: "",
    artistBio: "",
    templateType: "artist_intro" as string
  });

  // Fetch PR AI configuration (to know if Apify is available)
  const { data: prConfig } = useQuery<{ success: boolean; openai: boolean; apify: boolean; templates: boolean }>({
    queryKey: ['/api/pr-ai/config'],
    queryFn: async () => {
      const res = await fetch('/api/pr-ai/config');
      if (!res.ok) return { success: false, openai: false, apify: false, templates: false };
      return res.json();
    },
    enabled: !!user
  });

  // Fetch available PR templates
  const { data: prTemplates } = useQuery<{ success: boolean; templates: Array<{ id: string; name: string; subject: string; type: string }> }>({
    queryKey: ['/api/pr-ai/templates'],
    queryFn: async () => {
      const res = await fetch('/api/pr-ai/templates');
      if (!res.ok) return { success: false, templates: [] };
      return res.json();
    },
    enabled: !!user
  });

  // Fetch user's artists from my-artists endpoint
  // userId is derived server-side from the authenticated Clerk token, so we
  // must call through apiRequest (which attaches the Bearer token).
  const { data: myArtists, isLoading: isLoadingArtists } = useQuery<MyArtist[]>({
    queryKey: ['/api/outreach/my-artists', user?.id],
    queryFn: async () => {
      return apiRequest('/api/outreach/my-artists', 'GET');
    },
    enabled: !!user?.id
  });

  // Auto-populate form when artist is selected
  useEffect(() => {
    if (selectedArtistId && myArtists) {
      const artist = myArtists.find(a => a.id === selectedArtistId);
      if (artist) {
        const artistGenres = artist.genres ? 
          (typeof artist.genres === 'string' ? JSON.parse(artist.genres) : artist.genres) : 
          [];
        
        setFormData(prev => ({
          ...prev,
          artistName: artist.name || "",
          artistProfileUrl: artist.slug ? `${window.location.origin}/artist/${artist.slug}` : "",
          targetGenres: Array.isArray(artistGenres) ? 
            artistGenres.filter((g: string) => GENRES.includes(g)) : 
            [],
          artistBio: artist.bio || ""
        }));
      }
    }
  }, [selectedArtistId, myArtists]);

  const { data: campaignsData, isLoading } = useQuery<{ success: boolean; campaigns: PRCampaign[] }>({
    queryKey: ['/api/pr/campaigns'],
    enabled: !!user
  });

  const { data: campaignDetails, isLoading: isLoadingDetails } = useQuery<{
    success: boolean;
    campaign: PRCampaign;
    events: WebhookEvent[];
  }>({
    queryKey: ['/api/pr/campaigns', selectedCampaign],
    enabled: !!selectedCampaign
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/pr/campaigns', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: "¡Campaña creada!",
        description: "Tu campaña PR ha sido creada exitosamente."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pr/campaigns'] });
      setActiveView("list");
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la campaña. Inténtalo de nuevo.",
        variant: "destructive"
      });
    }
  });

  const activateCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return apiRequest(`/api/pr/campaigns/${campaignId}/activate`, {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "¡Campaña activada!",
        description: `Se contactarán ${data.mediaCount || 0} medios automáticamente.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pr/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pr/campaigns', selectedCampaign] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo activar la campaña.",
        variant: "destructive"
      });
    }
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return apiRequest(`/api/pr/campaigns/${campaignId}/pause`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "Campaña pausada",
        description: "La campaña ha sido pausada exitosamente."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pr/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pr/campaigns', selectedCampaign] });
    }
  });

  const generatePitchMutation = useMutation({
    mutationFn: async () => {
      // Use artist bio from selected artist if available
      const selectedArtist = myArtists?.find(a => a.id === selectedArtistId);
      const artistBio = selectedArtist?.bio || formData.artistBio || user?.biography || '';
      
      return apiRequest('/api/pr-ai/generate-pitch', {
        method: 'POST',
        body: JSON.stringify({
          artistName: formData.artistName,
          contentType: formData.contentType,
          contentTitle: formData.contentTitle,
          genre: formData.targetGenres[0] || 'urban',
          biography: artistBio,
          artistProfileUrl: formData.artistProfileUrl,
          templateType: formData.templateType,
          mediaType: formData.targetMediaTypes[0] || 'general'
        })
      });
    },
    onSuccess: (data: any) => {
      if (data.pitch) {
        setFormData({ ...formData, pitchMessage: data.pitch });
        toast({
          title: "¡Pitch generado!",
          description: "El mensaje ha sido generado con IA."
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo generar el pitch. Inténtalo de nuevo.",
        variant: "destructive"
      });
    }
  });

  const improvePitchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/pr-ai/improve-text', {
        method: 'POST',
        body: JSON.stringify({
          text: formData.pitchMessage,
          context: 'comunicación con medios musicales'
        })
      });
    },
    onSuccess: (data: any) => {
      if (data.improvedText) {
        setFormData({ ...formData, pitchMessage: data.improvedText });
        toast({
          title: "¡Texto mejorado!",
          description: "El mensaje ha sido optimizado con IA."
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo mejorar el texto.",
        variant: "destructive"
      });
    }
  });

  const suggestTitleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/pr-ai/suggest-campaign-title', {
        method: 'POST',
        body: JSON.stringify({
          artistName: formData.artistName,
          contentType: formData.contentType,
          contentTitle: formData.contentTitle
        })
      });
    },
    onSuccess: (data: any) => {
      if (data.suggestions && data.suggestions.length > 0) {
        setFormData({ ...formData, title: data.suggestions[0] });
        toast({
          title: "¡Título sugerido!",
          description: "Puedes editarlo si lo deseas."
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo generar título.",
        variant: "destructive"
      });
    }
  });

  // State for matching contacts
  const [matchingContacts, setMatchingContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [isExtractingContacts, setIsExtractingContacts] = useState(false);

  // Find matching contacts from database
  const findContactsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/pr-ai/find-matching-contacts', {
        method: 'POST',
        body: JSON.stringify({
          genres: formData.targetGenres,
          countries: formData.targetCountries,
          mediaTypes: formData.targetMediaTypes,
          limit: 50
        })
      });
    },
    onSuccess: (data: any) => {
      if (data.contacts) {
        setMatchingContacts(data.contacts);
        toast({
          title: `${data.count} contactos encontrados`,
          description: "Contactos que coinciden con tu perfil de artista."
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron buscar contactos.",
        variant: "destructive"
      });
    }
  });

  // Extract new contacts using Apify
  const extractContactsMutation = useMutation({
    mutationFn: async (params: { searchQuery: string; country: string; mediaType: string }) => {
      return apiRequest('/api/pr-ai/extract-media-contacts', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          batchSize: 20
        })
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: `${data.saved} contactos nuevos`,
          description: data.message
        });
        // Refresh contacts after extraction
        findContactsMutation.mutate();
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron extraer contactos.",
        variant: "destructive"
      });
    }
  });

  // Extract contacts for current campaign targets
  const handleExtractContacts = async () => {
    setIsExtractingContacts(true);
    try {
      // Extract for each media type and country combination (limited batches)
      for (const mediaType of formData.targetMediaTypes.slice(0, 2)) {
        for (const country of formData.targetCountries.slice(0, 2)) {
          const genre = formData.targetGenres[0] || 'latin music';
          await extractContactsMutation.mutateAsync({
            searchQuery: `${mediaType} ${genre} industria musical`,
            country,
            mediaType
          });
        }
      }
    } finally {
      setIsExtractingContacts(false);
    }
  };

  // Toggle contact selection
  const toggleContactSelection = (contactId: number) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const resetForm = () => {
    setSelectedArtistId(null);
    setMatchingContacts([]);
    setSelectedContacts([]);
    setFormData({
      title: "",
      artistName: "",
      artistProfileUrl: "",
      contentType: "single",
      contentTitle: "",
      contentUrl: "",
      targetMediaTypes: [],
      targetCountries: [],
      targetGenres: [],
      pitchMessage: "",
      contactEmail: user?.email || "",
      contactPhone: "",
      artistBio: "",
      templateType: "artist_intro"
    });
    setWizardStep(1);
  };

  const handleWizardNext = () => {
    setWizardDirection(1);
    if (wizardStep < 5) {
      setWizardStep(wizardStep + 1);
    } else {
      createCampaignMutation.mutate(formData);
    }
  };

  const handleWizardBack = () => {
    setWizardDirection(-1);
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
    } else {
      setActiveView("list");
      resetForm();
    }
  };

  const toggleArrayValue = (array: string[], value: string, setter: (arr: string[]) => void) => {
    if (array.includes(value)) {
      setter(array.filter(v => v !== value));
    } else {
      setter([...array, value]);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Borrador", variant: "secondary" as const, icon: Clock },
      active: { label: "Activa", variant: "default" as const, icon: Play },
      paused: { label: "Pausada", variant: "outline" as const, icon: Pause },
      completed: { label: "Completada", variant: "default" as const, icon: CheckCircle }
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1" data-testid={`badge-status-${status}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getEventIcon = (eventType: string) => {
    const icons = {
      email_sent: Mail,
      email_opened: Eye,
      media_replied: MessageSquare,
      interview_booked: Star
    };
    return icons[eventType as keyof typeof icons] || Mail;
  };

  const getEventLabel = (eventType: string) => {
    const labels = {
      email_sent: "Email enviado",
      email_opened: "Email abierto",
      media_replied: "Medio respondió",
      interview_booked: "Entrevista agendada"
    };
    return labels[eventType as keyof typeof labels] || eventType;
  };

  if (!user) {
    return <ArtistLandingPage />;
  }

  return (
    <PlanTierGuard 
      requiredPlan="premium" 
      userSubscription={userSubscription} 
      featureName="PR Management Tools"
      isAdmin={isAdmin}
    >
      <div className="min-h-screen bg-background">
        <Header />
        
        <div className="container mx-auto px-4 py-8 max-w-7xl">
        <AnimatePresence mode="wait">
        {activeView === "list" && (
          <motion.div
            key="list-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Enhanced Hero Section with animations */}
            <motion.div 
              ref={heroRef}
              className="relative rounded-3xl overflow-hidden mb-10"
              initial={{ opacity: 0, y: 30 }}
              animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              {/* Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/90 to-slate-900" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-pink-500/20 via-transparent to-transparent" />
              
              {/* Floating Particles */}
              <FloatingParticles />
              
              {/* Animated Glow Effects */}
              <motion.div 
                className="absolute top-10 right-20 w-40 h-40 bg-primary/30 rounded-full blur-[80px]"
                variants={pulseVariants}
                animate="animate"
              />
              <motion.div 
                className="absolute bottom-10 left-1/3 w-60 h-60 bg-purple-500/20 rounded-full blur-[100px]"
                variants={pulseVariants}
                animate="animate"
                style={{ animationDelay: "1s" }}
              />
              
              {/* Grid Pattern Overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

              {/* Main Content */}
              <div className="relative z-10 px-8 md:px-12 py-12 md:py-16">
                <div className="grid lg:grid-cols-2 gap-8 items-center">
                  {/* Left: Text Content */}
                  <div className="text-white">
                    {/* Badge */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                    >
                      <Badge className="mb-4 bg-primary/90 text-white border-none px-4 py-1.5 text-sm font-medium">
                        <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                        AI-Powered PR Agent
                      </Badge>
                    </motion.div>

                    {/* Title */}
                    <motion.h1 
                      className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
                      variants={heroTextVariants}
                      initial="hidden"
                      animate="visible"
                      data-testid="text-hero-title"
                    >
                      Automated{" "}
                      <span className="relative inline-block">
                        <span className="relative z-10 bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                          PR Agent
                        </span>
                        <motion.span 
                          className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-pink-400 rounded-full"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
                        />
                      </span>
                    </motion.h1>

                    {/* Subtitle in English */}
                    <motion.p 
                      className="text-lg md:text-xl mb-6 text-white/80 leading-relaxed"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.6 }}
                      data-testid="text-hero-description"
                    >
                      Get your music featured on <span className="text-primary font-semibold">radio stations</span>, <span className="text-purple-400 font-semibold">podcasts</span>, <span className="text-pink-400 font-semibold">TV shows</span> and media outlets. Our AI agent handles outreach, follow-ups, and booking interviews automatically.
                    </motion.p>

                    {/* Feature List */}
                    <motion.div
                      className="mb-8 space-y-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6, duration: 0.5 }}
                    >
                      {[
                        "AI-generated personalized pitch emails",
                        "Automatic follow-ups & tracking",
                        "Direct access to 500+ media contacts"
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-white/70">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </motion.div>

                    {/* CTA Buttons - Fixed Layout */}
                    <motion.div 
                      className="flex flex-col sm:flex-row gap-3"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7, duration: 0.5 }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <Button 
                          size="lg" 
                          className="w-full sm:w-auto gap-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500 hover:opacity-90 text-white border-none shadow-lg shadow-primary/30 px-6"
                          onClick={() => setActiveView("wizard")}
                          data-testid="button-new-campaign"
                        >
                          <Rocket className="w-5 h-5" />
                          Start New Campaign
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <Button 
                          size="lg" 
                          variant="outline"
                          className="w-full sm:w-auto gap-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm px-6"
                        >
                          <Play className="w-4 h-4" />
                          Watch Demo
                        </Button>
                      </motion.div>
                    </motion.div>
                  </div>

                  {/* Right: Artists from Database */}
                  <motion.div
                    className="hidden lg:block"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                  >
                    <div className="relative">
                      {/* Artists Display */}
                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-2 mb-4">
                          <Users className="w-5 h-5 text-primary" />
                          <h3 className="text-white font-semibold">Your Artists</h3>
                          {myArtists && myArtists.length > 0 && (
                            <Badge variant="secondary" className="ml-auto bg-white/10 text-white">
                              {myArtists.length} artists
                            </Badge>
                          )}
                        </div>
                        
                        {isLoadingArtists ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : myArtists && myArtists.length > 0 ? (
                          <div className="space-y-3">
                            {myArtists.slice(0, 4).map((artist, index) => (
                              <motion.div
                                key={artist.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/20"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.7 + index * 0.1 }}
                                onClick={() => {
                                  setSelectedArtistId(artist.id);
                                  setActiveView("wizard");
                                }}
                                whileHover={{ x: 5 }}
                              >
                                <Avatar className="w-10 h-10 border-2 border-primary/30">
                                  <AvatarImage src={artist.profileImage || undefined} />
                                  <AvatarFallback className="bg-primary/20 text-primary">
                                    {artist.name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium truncate">{artist.name}</p>
                                  <p className="text-white/50 text-xs truncate">
                                    {artist.genres || "No genre set"}
                                  </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-white/40" />
                              </motion.div>
                            ))}
                            {myArtists.length > 4 && (
                              <p className="text-white/40 text-xs text-center pt-2">
                                +{myArtists.length - 4} more artists
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <User className="w-10 h-10 text-white/30 mx-auto mb-2" />
                            <p className="text-white/50 text-sm mb-3">No artists yet</p>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => setActiveView("wizard")}
                            >
                              Add Your First Artist
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Floating Media Icons */}
                      <div className="absolute -right-4 top-0 bottom-0 flex flex-col justify-center gap-4">
                        {[Radio, Tv, Mic, Globe].map((Icon, i) => (
                          <motion.div
                            key={i}
                            className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1 + i * 0.1 }}
                            whileHover={{ scale: 1.1 }}
                          >
                            <Icon className="w-4 h-4 text-white" />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Bottom Stats Bar */}
                <motion.div 
                  className="mt-10 pt-6 border-t border-white/10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { icon: Send, label: "Emails Sent", value: "10K+" },
                      { icon: Radio, label: "Active Media", value: "500+" },
                      { icon: Star, label: "Interviews Booked", value: "200+" },
                      { icon: Users, label: "Artists Helped", value: "1K+" }
                    ].map((stat, i) => (
                      <motion.div 
                        key={i}
                        className="text-center"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 + i * 0.1 }}
                      >
                        <div className="flex items-center gap-2 justify-center mb-1">
                          <stat.icon className="w-4 h-4 text-primary" />
                          <span className="text-xl md:text-2xl font-bold text-white">{stat.value}</span>
                        </div>
                        <span className="text-xs text-white/60">{stat.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>

            <div className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-between mb-6"
              >
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    Mis Campañas
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    Gestiona y monitorea tus campañas PR activas
                  </p>
                </div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    onClick={() => setActiveView("wizard")}
                    className="gap-2 bg-gradient-to-r from-primary to-purple-600 shadow-lg shadow-primary/20"
                  >
                    <Zap className="w-4 h-4" />
                    Crear Campaña
                  </Button>
                </motion.div>
              </motion.div>
              
              {isLoading ? (
                <motion.div 
                  className="flex flex-col items-center justify-center py-16"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-12 h-12 text-primary" />
                  </motion.div>
                  <p className="mt-4 text-muted-foreground">Cargando tus campañas...</p>
                </motion.div>
              ) : campaignsData?.campaigns && campaignsData.campaigns.length > 0 ? (
                <motion.div 
                  className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {campaignsData.campaigns.map((campaign, index) => (
                    <motion.div
                      key={campaign.id}
                      variants={cardVariants}
                      whileHover="hover"
                      custom={index}
                      layout
                    >
                      <Card 
                        className="overflow-hidden cursor-pointer bg-gradient-to-br from-card to-card/80 border-border/50 backdrop-blur-sm group"
                        onClick={() => {
                          setSelectedCampaign(campaign.id);
                          setActiveView("campaign");
                        }}
                        data-testid={`card-campaign-${campaign.id}`}
                      >
                        {/* Card Header with Status Indicator */}
                        <div className="h-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
                        
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between mb-2">
                            <CardTitle className="text-lg group-hover:text-primary transition-colors" data-testid={`text-campaign-title-${campaign.id}`}>
                              {campaign.title}
                            </CardTitle>
                            <motion.div
                              initial={{ scale: 0.8 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200 }}
                            >
                              {getStatusBadge(campaign.status)}
                            </motion.div>
                          </div>
                          <CardDescription className="flex items-center gap-2" data-testid={`text-campaign-content-${campaign.id}`}>
                            <Music className="w-4 h-4" />
                            {campaign.contentTitle}
                          </CardDescription>
                        </CardHeader>
                        
                        <CardContent>
                          {/* Animated Stats Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { label: "Enviados", value: campaign.mediaContacted, icon: Send, color: "text-blue-500" },
                              { label: "Abiertos", value: campaign.emailsOpened, icon: Eye, color: "text-green-500" },
                              { label: "Respuestas", value: campaign.mediaReplied, icon: MessageSquare, color: "text-yellow-500" },
                              { label: "Entrevistas", value: campaign.interviewsBooked, icon: Star, color: "text-primary" }
                            ].map((stat, i) => (
                              <motion.div
                                key={stat.label}
                                className="relative p-3 rounded-xl bg-muted/50 border border-border/30"
                                whileHover={{ scale: 1.02, backgroundColor: "rgba(var(--primary), 0.05)" }}
                              >
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                  <stat.icon className={`w-3 h-3 ${stat.color}`} />
                                  {stat.label}
                                </div>
                                <div className={`text-2xl font-bold ${i === 3 ? 'text-primary' : ''}`} data-testid={`text-${stat.label.toLowerCase()}-${campaign.id}`}>
                                  {stat.value}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                          
                          {/* Progress Bar */}
                          {campaign.status === "active" && campaign.mediaContacted > 0 && (
                            <motion.div 
                              className="mt-4"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 }}
                            >
                              <div className="flex justify-between text-xs mb-2">
                                <span className="text-muted-foreground">Tasa de apertura</span>
                                <span className="font-semibold text-primary">
                                  {Math.round((campaign.emailsOpened / campaign.mediaContacted) * 100)}%
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(campaign.emailsOpened / campaign.mediaContacted) * 100}%` }}
                                  transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                                />
                              </div>
                            </motion.div>
                          )}
                          
                          {/* Hover Arrow */}
                          <motion.div 
                            className="flex items-center justify-end mt-4 text-sm text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Ver detalles <ArrowRight className="w-4 h-4 ml-1" />
                          </motion.div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <Card className="border-dashed border-2 bg-gradient-to-br from-muted/30 to-muted/10">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <motion.div
                        animate={{ 
                          y: [0, -10, 0],
                          rotate: [0, -5, 5, 0]
                        }}
                        transition={{ 
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6">
                          <Megaphone className="w-12 h-12 text-primary" />
                        </div>
                      </motion.div>
                      
                      <h3 className="text-2xl font-bold mb-3 text-center">
                        ¡Comienza tu primera campaña PR!
                      </h3>
                      <p className="text-muted-foreground mb-8 text-center max-w-md">
                        Llega a radios, podcasts, TV y medios de todo el mundo con un solo clic. 
                        Nuestra IA te ayudará a crear el pitch perfecto.
                      </p>
                      
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button 
                          size="lg"
                          onClick={() => setActiveView("wizard")}
                          className="gap-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500 shadow-xl shadow-primary/30"
                          data-testid="button-create-first-campaign"
                        >
                          <Rocket className="w-5 h-5" />
                          Crear Primera Campaña
                          <Sparkles className="w-4 h-4 ml-1" />
                        </Button>
                      </motion.div>
                      
                      {/* Feature Pills */}
                      <div className="flex flex-wrap gap-2 mt-8 justify-center">
                        {["IA Generativa", "500+ Medios", "Emails Automáticos", "Analytics"].map((feature, i) => (
                          <motion.div
                            key={feature}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                          >
                            <Badge variant="secondary" className="px-3 py-1">
                              {feature}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {activeView === "wizard" && (
          <motion.div
            key="wizard-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="max-w-4xl mx-auto overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-card via-card to-card/90">
              {/* Wizard Header with Animated Progress */}
              <CardHeader className="relative pb-6 border-b border-border/50">
                {/* Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5" />
                
                <div className="relative z-10">
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 mb-2"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                      <Rocket className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Nueva Campaña PR</CardTitle>
                      <CardDescription className="mt-1">
                        Paso {wizardStep} de 5: {
                          wizardStep === 1 ? "Información Básica" :
                          wizardStep === 2 ? "Contenido a Promocionar" :
                          wizardStep === 3 ? "Target de Medios" :
                          wizardStep === 4 ? "Mensaje y Contacto" :
                          "Revisar y Lanzar"
                        }
                      </CardDescription>
                    </div>
                  </motion.div>
                  
                  {/* Animated Step Indicators */}
                  <div className="flex items-center gap-2 mt-6">
                    {[1, 2, 3, 4, 5].map((step) => (
                      <motion.div
                        key={step}
                        className="flex-1 relative"
                        initial={false}
                      >
                        <motion.div
                          className={`h-2 rounded-full ${
                            step < wizardStep 
                              ? "bg-gradient-to-r from-primary to-purple-500" 
                              : step === wizardStep 
                                ? "bg-gradient-to-r from-primary/50 to-purple-500/50"
                                : "bg-muted"
                          }`}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: step <= wizardStep ? 1 : 0.3 }}
                          transition={{ duration: 0.4, delay: step * 0.05 }}
                          style={{ originX: 0 }}
                        />
                        {step === wizardStep && (
                          <motion.div
                            className="absolute -top-1 right-0 w-4 h-4 rounded-full bg-primary shadow-lg shadow-primary/50"
                            layoutId="stepIndicator"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Step Labels */}
                  <div className="flex justify-between mt-3">
                    {["Básico", "Contenido", "Target", "Mensaje", "Lanzar"].map((label, i) => (
                      <motion.span
                        key={label}
                        className={`text-xs ${i + 1 <= wizardStep ? "text-primary font-medium" : "text-muted-foreground"}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        {label}
                      </motion.span>
                    ))}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 md:p-8">
                <AnimatePresence mode="wait" custom={wizardDirection}>
                  <motion.div
                    key={wizardStep}
                    custom={wizardDirection}
                    variants={wizardStepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="min-h-[400px]"
                  >
              {wizardStep === 1 && (
                <motion.div 
                  className="space-y-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {/* Artist Selection from My Artists */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <Label data-testid="label-select-artist" className="text-lg font-semibold">Selecciona un Artista</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Elige uno de tus artistas creados en My Artists
                    </p>
                    {isLoadingArtists ? (
                      <motion.div 
                        className="flex items-center gap-3 p-4 border rounded-xl bg-muted/30"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Cargando tus artistas...</span>
                      </motion.div>
                    ) : myArtists && myArtists.length > 0 ? (
                      <motion.div 
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {myArtists.map((artist, index) => {
                          const isSelected = selectedArtistId === artist.id;
                          return (
                            <motion.button
                              key={artist.id}
                              type="button"
                              onClick={() => setSelectedArtistId(artist.id)}
                              className={`p-4 border-2 rounded-xl flex items-center gap-4 transition-all text-left relative overflow-hidden ${
                                isSelected
                                  ? "border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 shadow-lg shadow-primary/20"
                                  : "border-border hover:border-primary/50 hover:bg-muted/50"
                              }`}
                              variants={itemVariants}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              data-testid={`button-select-artist-${artist.id}`}
                            >
                              {isSelected && (
                                <motion.div 
                                  className="absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] border-t-primary"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring" }}
                                >
                                  <CheckCircle className="absolute -top-9 -right-1 w-4 h-4 text-white" />
                                </motion.div>
                              )}
                              <Avatar className="h-14 w-14 ring-2 ring-border/50">
                                <AvatarImage src={artist.profileImage || undefined} alt={artist.name} />
                                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20">
                                  <User className="w-6 h-6 text-primary" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold truncate text-base">{artist.name}</span>
                                  {artist.isAIGenerated && (
                                    <Badge variant="outline" className="text-xs bg-gradient-to-r from-primary/10 to-purple-500/10">
                                      <Sparkles className="w-3 h-3 mr-1" />
                                      IA
                                    </Badge>
                                  )}
                                </div>
                                {artist.genres && (
                                  <p className="text-sm text-muted-foreground truncate mt-1">
                                    {typeof artist.genres === 'string' ? 
                                      JSON.parse(artist.genres).slice(0, 2).join(', ') : 
                                      artist.genres.slice(0, 2).join(', ')
                                    }
                                  </p>
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    ) : (
                      <motion.div 
                        className="p-6 border-2 border-dashed rounded-xl bg-muted/30 text-center"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        </motion.div>
                        <p className="text-muted-foreground mb-4">
                          No tienes artistas creados aún.
                        </p>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => window.location.href = '/my-artists'}
                          >
                            <Sparkles className="w-4 h-4" />
                            Crear Artista
                          </Button>
                        </motion.div>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Campaign Title */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                          <Rocket className="w-4 h-4 text-white" />
                        </div>
                        <Label htmlFor="title" data-testid="label-campaign-title" className="text-lg font-semibold">
                          Nombre de la Campaña
                        </Label>
                      </div>
                      {formData.artistName && formData.contentTitle && (
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => suggestTitleMutation.mutate()}
                            disabled={suggestTitleMutation.isPending}
                            className="gap-2 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/30 hover:border-primary"
                            data-testid="button-suggest-title-ai"
                          >
                            {suggestTitleMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-primary" />
                            )}
                            Generar con IA
                          </Button>
                        </motion.div>
                      )}
                    </div>
                    <Input
                      id="title"
                      placeholder="Ej: Lanzamiento Single Noviembre 2025"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="h-12 text-base border-2 focus:border-primary transition-colors"
                      data-testid="input-campaign-title"
                    />
                  </motion.div>

                  {/* Artist Name & Profile in a grid */}
                  <motion.div
                    className="grid md:grid-cols-2 gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    {/* Artist Name (auto-filled, editable) */}
                    <div className="space-y-2">
                      <Label htmlFor="artistName" data-testid="label-artist-name" className="flex items-center gap-2">
                        Nombre del Artista 
                        {selectedArtistId && (
                          <motion.span 
                            className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-1"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring" }}
                          >
                            <CheckCircle className="w-3 h-3" />
                            Auto-cargado
                          </motion.span>
                        )}
                      </Label>
                      <Input
                        id="artistName"
                        placeholder="Nombre artístico"
                        value={formData.artistName}
                        onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
                        data-testid="input-artist-name"
                        className={`h-12 text-base border-2 transition-all ${selectedArtistId ? "border-green-500/50 bg-green-500/5" : ""}`}
                      />
                    </div>

                    {/* Artist Profile URL (auto-filled, editable) */}
                    <div className="space-y-2">
                      <Label htmlFor="artistProfileUrl" data-testid="label-profile-url" className="flex items-center gap-2">
                        Link del Perfil
                        {selectedArtistId && (
                          <motion.span 
                            className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-1"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", delay: 0.1 }}
                          >
                            <CheckCircle className="w-3 h-3" />
                            Auto-cargado
                          </motion.span>
                        )}
                      </Label>
                      <Input
                        id="artistProfileUrl"
                        placeholder="https://boostifymusic.com/artist/tu-nombre"
                        value={formData.artistProfileUrl}
                        onChange={(e) => setFormData({ ...formData, artistProfileUrl: e.target.value })}
                        data-testid="input-profile-url"
                        className={`h-12 text-base border-2 transition-all ${selectedArtistId ? "border-green-500/50 bg-green-500/5" : ""}`}
                      />
                    </div>
                  </motion.div>
                  
                  {/* Helper text */}
                  <motion.p 
                    className="text-sm text-muted-foreground flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {selectedArtistId ? (
                      <>
                        <Sparkles className="w-4 h-4 text-green-500" />
                        La información del artista se ha cargado automáticamente desde My Artists.
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4 text-muted-foreground" />
                        Selecciona un artista arriba para cargar automáticamente su perfil.
                      </>
                    )}
                  </motion.p>
                </motion.div>
              )}

              {wizardStep === 2 && (
                <motion.div 
                  className="space-y-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                        <Music className="w-4 h-4 text-white" />
                      </div>
                      <Label data-testid="label-content-type" className="text-lg font-semibold">¿Qué estás promocionando?</Label>
                    </div>
                    <motion.div 
                      className="grid grid-cols-2 md:grid-cols-3 gap-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {CONTENT_TYPES.map((type, index) => {
                        const Icon = type.icon;
                        const isSelected = formData.contentType === type.value;
                        return (
                          <motion.button
                            key={type.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, contentType: type.value as any })}
                            className={`p-5 border-2 rounded-xl flex flex-col items-center gap-3 transition-all relative overflow-hidden ${
                              isSelected
                                ? "border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 shadow-lg shadow-primary/20"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                            variants={itemVariants}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            data-testid={`button-content-type-${type.value}`}
                          >
                            {isSelected && (
                              <motion.div 
                                className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                              />
                            )}
                            <motion.div 
                              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                isSelected 
                                  ? "bg-gradient-to-br from-primary to-purple-600" 
                                  : "bg-muted"
                              }`}
                              animate={isSelected ? { scale: [1, 1.1, 1] } : {}}
                              transition={{ duration: 0.3 }}
                            >
                              <Icon className={`w-6 h-6 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
                            </motion.div>
                            <span className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>
                              {type.label}
                            </span>
                            {isSelected && (
                              <motion.div
                                className="absolute top-2 right-2"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring" }}
                              >
                                <CheckCircle className="w-5 h-5 text-primary" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                  
                  <motion.div
                    className="grid md:grid-cols-2 gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="contentTitle" data-testid="label-content-title" className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-pink-500" />
                        Título del Contenido
                      </Label>
                      <Input
                        id="contentTitle"
                        placeholder="Ej: El Silencio Grita"
                        value={formData.contentTitle}
                        onChange={(e) => setFormData({ ...formData, contentTitle: e.target.value })}
                        className="h-12 text-base border-2 focus:border-primary transition-colors"
                        data-testid="input-content-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contentUrl" data-testid="label-content-url" className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        Link al Contenido
                      </Label>
                      <Input
                        id="contentUrl"
                        placeholder="https://open.spotify.com/track/..."
                        value={formData.contentUrl}
                        onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
                        className="h-12 text-base border-2 focus:border-primary transition-colors"
                        data-testid="input-content-url"
                      />
                    </div>
                  </motion.div>
                  
                  <motion.p 
                    className="text-sm text-muted-foreground flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Soportamos Spotify, YouTube, Apple Music, SoundCloud y más.
                  </motion.p>
                </motion.div>
              )}

              {wizardStep === 3 && (
                <motion.div 
                  className="space-y-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {/* Media Types */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <Radio className="w-4 h-4 text-white" />
                      </div>
                      <Label className="text-lg font-semibold" data-testid="label-media-types">Tipos de Medios</Label>
                      <Badge variant="secondary" className="ml-auto">
                        {formData.targetMediaTypes.length} seleccionados
                      </Badge>
                    </div>
                    <motion.div 
                      className="grid grid-cols-2 md:grid-cols-3 gap-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {MEDIA_TYPES.map((type, index) => {
                        const Icon = type.icon;
                        const isSelected = formData.targetMediaTypes.includes(type.value);
                        return (
                          <motion.button
                            key={type.value}
                            type="button"
                            onClick={() => toggleArrayValue(
                              formData.targetMediaTypes,
                              type.value,
                              (arr) => setFormData({ ...formData, targetMediaTypes: arr })
                            )}
                            className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                              isSelected
                                ? "border-primary bg-gradient-to-r from-primary/10 to-blue-500/10 shadow-md shadow-primary/10"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                            variants={itemVariants}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            data-testid={`button-media-type-${type.value}`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isSelected ? "bg-gradient-to-br from-primary to-blue-600" : "bg-muted"
                            }`}>
                              <Icon className={`w-5 h-5 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
                            </div>
                            <span className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>
                              {type.label}
                            </span>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="ml-auto"
                              >
                                <CheckCircle className="w-5 h-5 text-primary" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                  
                  {/* Countries */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-white" />
                      </div>
                      <Label className="text-lg font-semibold" data-testid="label-countries">Países</Label>
                      <Badge variant="secondary" className="ml-auto">
                        {formData.targetCountries.length} seleccionados
                      </Badge>
                    </div>
                    <motion.div 
                      className="flex flex-wrap gap-2"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {COUNTRIES.map((country, index) => {
                        const isSelected = formData.targetCountries.includes(country);
                        return (
                          <motion.button
                            key={country}
                            type="button"
                            onClick={() => toggleArrayValue(
                              formData.targetCountries,
                              country,
                              (arr) => setFormData({ ...formData, targetCountries: arr })
                            )}
                            className={`px-4 py-2 border-2 rounded-full text-sm transition-all ${
                              isSelected
                                ? "border-primary bg-primary text-white font-medium shadow-md shadow-primary/30"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                            variants={itemVariants}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            data-testid={`button-country-${country}`}
                          >
                            {country}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                  
                  {/* Genres */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
                        <Music className="w-4 h-4 text-white" />
                      </div>
                      <Label className="text-lg font-semibold" data-testid="label-genres">Géneros Musicales</Label>
                      <Badge variant="secondary" className="ml-auto">
                        {formData.targetGenres.length} seleccionados
                      </Badge>
                    </div>
                    <motion.div 
                      className="flex flex-wrap gap-2"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {GENRES.map((genre, index) => {
                        const isSelected = formData.targetGenres.includes(genre);
                        return (
                          <motion.button
                            key={genre}
                            type="button"
                            onClick={() => toggleArrayValue(
                              formData.targetGenres,
                              genre,
                              (arr) => setFormData({ ...formData, targetGenres: arr })
                            )}
                            className={`px-4 py-2 border-2 rounded-full text-sm transition-all ${
                              isSelected
                                ? "border-purple-500 bg-gradient-to-r from-purple-500 to-violet-500 text-white font-medium shadow-md shadow-purple-500/30"
                                : "border-border hover:border-purple-500/50 hover:bg-muted/50"
                            }`}
                            variants={itemVariants}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            data-testid={`button-genre-${genre}`}
                          >
                            {genre}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {wizardStep === 4 && (
                <motion.div 
                  className="space-y-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {/* Template Selector */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Wand2 className="w-4 h-4 text-white" />
                      </div>
                      <Label data-testid="label-template-type" className="text-lg font-semibold">Plantilla Base</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Selecciona una plantilla profesional para generar tu pitch con IA
                    </p>
                    <motion.div 
                      className="grid grid-cols-1 md:grid-cols-3 gap-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {[
                        { id: 'artist_intro', name: 'Introducción de Artista', icon: User, color: 'from-blue-500 to-cyan-500' },
                        { id: 'sync_opportunity', name: 'Oportunidad Sync', icon: Music, color: 'from-purple-500 to-violet-500' },
                        { id: 'follow_up', name: 'Seguimiento', icon: Mail, color: 'from-green-500 to-emerald-500' }
                      ].map((template, index) => {
                        const Icon = template.icon;
                        const isSelected = formData.templateType === template.id;
                        return (
                          <motion.button
                            key={template.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, templateType: template.id })}
                            className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all text-left relative overflow-hidden ${
                              isSelected
                                ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/10"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                            variants={itemVariants}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${template.color} flex items-center justify-center`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <span className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>{template.name}</span>
                            </div>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring" }}
                              >
                                <CheckCircle className="w-5 h-5 text-primary" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </motion.div>

                  {/* Pitch Message */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <Label htmlFor="pitchMessage" data-testid="label-pitch-message" className="text-lg font-semibold">
                          Mensaje para Medios
                        </Label>
                      </div>
                      <div className="flex gap-2">
                        {formData.pitchMessage && (
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => improvePitchMutation.mutate()}
                              disabled={improvePitchMutation.isPending}
                              className="gap-2 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/30"
                              data-testid="button-improve-pitch-ai"
                            >
                              {improvePitchMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Wand2 className="w-3 h-3 text-primary" />
                              )}
                              Mejorar
                            </Button>
                          </motion.div>
                        )}
                        {formData.artistName && formData.contentTitle && (
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => generatePitchMutation.mutate()}
                              disabled={generatePitchMutation.isPending}
                              className="gap-2 bg-gradient-to-r from-primary to-purple-600"
                              data-testid="button-generate-pitch-ai"
                            >
                              {generatePitchMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              Generar con IA
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </div>
                    <Textarea
                      id="pitchMessage"
                      placeholder="Ej: Redwine lanza su nuevo single 'El Silencio Grita', una fusión única de cine y música latina. Disponible ahora en todas las plataformas."
                      value={formData.pitchMessage}
                      onChange={(e) => setFormData({ ...formData, pitchMessage: e.target.value })}
                      rows={5}
                      className="text-base border-2 focus:border-primary transition-colors resize-none"
                      data-testid="input-pitch-message"
                    />
                    {!formData.pitchMessage && formData.artistName && formData.contentTitle && (
                      <motion.p 
                        className="text-sm text-muted-foreground mt-2 flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Sparkles className="w-4 h-4 text-primary" />
                        Tip: Usa "Generar con IA" para crear un mensaje profesional automáticamente
                      </motion.p>
                    )}
                  </motion.div>
                  
                  {/* Contact Info */}
                  <motion.div
                    className="grid md:grid-cols-2 gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail" data-testid="label-contact-email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-500" />
                        Email de Contacto
                      </Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="tu@email.com"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        className="h-12 text-base border-2 focus:border-primary transition-colors"
                        data-testid="input-contact-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone" data-testid="label-contact-phone" className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-green-500" />
                        Teléfono/WhatsApp (Opcional)
                      </Label>
                      <Input
                        id="contactPhone"
                        placeholder="+1 786 000 0000"
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        className="h-12 text-base border-2 focus:border-primary transition-colors"
                        data-testid="input-contact-phone"
                      />
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {wizardStep === 5 && (
                <motion.div 
                  className="space-y-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {/* Campaign Summary Card */}
                  <motion.div 
                    className="bg-gradient-to-br from-muted/50 to-muted/30 rounded-2xl p-6 border border-border/50"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-bold">Resumen de la Campaña</h3>
                    </div>
                    
                    <motion.div 
                      className="grid gap-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <motion.div 
                        className="flex items-center justify-between p-3 bg-background rounded-xl"
                        variants={itemVariants}
                      >
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Rocket className="w-4 h-4" />
                          Nombre:
                        </span>
                        <span className="font-semibold" data-testid="text-review-title">{formData.title}</span>
                      </motion.div>
                      <motion.div 
                        className="flex items-center justify-between p-3 bg-background rounded-xl"
                        variants={itemVariants}
                      >
                        <span className="text-muted-foreground flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Artista:
                        </span>
                        <span className="font-semibold" data-testid="text-review-artist">{formData.artistName}</span>
                      </motion.div>
                      <motion.div 
                        className="flex items-center justify-between p-3 bg-background rounded-xl"
                        variants={itemVariants}
                      >
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Music className="w-4 h-4" />
                          Contenido:
                        </span>
                        <span className="font-semibold" data-testid="text-review-content">
                          {formData.contentTitle} ({formData.contentType})
                        </span>
                      </motion.div>
                      
                      {/* Badges sections */}
                      <motion.div className="space-y-3 mt-2" variants={itemVariants}>
                        <div className="p-3 bg-background rounded-xl">
                          <span className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
                            <Radio className="w-4 h-4" />
                            Tipos de Medios:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {formData.targetMediaTypes.map((type) => (
                              <Badge key={type} className="bg-primary/10 text-primary border-primary/30" data-testid={`badge-review-media-${type}`}>
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="p-3 bg-background rounded-xl">
                          <span className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
                            <Globe className="w-4 h-4" />
                            Países:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {formData.targetCountries.map((country) => (
                              <Badge key={country} variant="secondary" data-testid={`badge-review-country-${country}`}>
                                {country}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="p-3 bg-background rounded-xl">
                          <span className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
                            <Music className="w-4 h-4" />
                            Géneros:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {formData.targetGenres.map((genre) => (
                              <Badge key={genre} className="bg-purple-500/10 text-purple-600 border-purple-500/30" data-testid={`badge-review-genre-${genre}`}>
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="p-4 bg-background rounded-xl">
                          <span className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
                            <MessageSquare className="w-4 h-4" />
                            Mensaje:
                          </span>
                          <p className="text-sm leading-relaxed" data-testid="text-review-message">
                            {formData.pitchMessage}
                          </p>
                        </div>
                      </motion.div>
                    </motion.div>
                  </motion.div>

                  {/* Matching Contacts Section */}
                  <motion.div 
                    className="border-2 rounded-2xl p-5 bg-background/50"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold flex items-center gap-2 text-lg">
                        <Users className="w-5 h-5 text-primary" />
                        Contactos que coinciden con tu perfil
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => findContactsMutation.mutate()}
                          disabled={findContactsMutation.isPending}
                          className="gap-2"
                        >
                          {findContactsMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Target className="w-3 h-3" />
                          )}
                          Buscar Contactos
                        </Button>
                        {prConfig?.apify && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleExtractContacts}
                            disabled={isExtractingContacts || extractContactsMutation.isPending}
                            className="gap-2"
                          >
                            {isExtractingContacts ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Globe className="w-3 h-3" />
                            )}
                            Extraer de Web
                          </Button>
                        )}
                      </div>
                    </div>

                    {matchingContacts.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                          <span>{matchingContacts.length} contactos encontrados</span>
                          <span>{selectedContacts.length} seleccionados</span>
                        </div>
                        {matchingContacts.map((contact) => (
                          <div 
                            key={contact.id}
                            onClick={() => toggleContactSelection(contact.id)}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              selectedContacts.includes(contact.id)
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  selectedContacts.includes(contact.id) ? "bg-primary border-primary" : "border-muted-foreground"
                                }`}>
                                  {selectedContacts.includes(contact.id) && (
                                    <CheckCircle className="w-3 h-3 text-primary-foreground" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{contact.fullName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {contact.jobTitle} {contact.companyName ? `@ ${contact.companyName}` : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {contact.category}
                                </Badge>
                                {contact.country && (
                                  <Badge variant="secondary" className="text-xs">
                                    {contact.country}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <motion.div 
                        className="text-center py-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                        </motion.div>
                        <p className="text-muted-foreground">Haz clic en "Buscar Contactos" para encontrar medios que coincidan con tu target.</p>
                        {prConfig?.apify && (
                          <p className="text-sm text-muted-foreground mt-2">O usa "Extraer de Web" para encontrar nuevos contactos automáticamente.</p>
                        )}
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open('/contacts', '_blank')}
                            className="gap-2"
                          >
                            <Users className="w-4 h-4" />
                            Ver Base de Contactos Completa
                          </Button>
                        </motion.div>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Professional Email Preview */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold flex items-center gap-2 text-lg">
                        <Mail className="w-5 h-5 text-primary" />
                        Email Preview
                        <Badge variant="outline" className="ml-2 bg-gradient-to-r from-primary/10 to-purple-500/10">
                          Professional Template
                        </Badge>
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Template:</span>
                        <Select
                          value={formData.templateType}
                          onValueChange={(value) => setFormData({ ...formData, templateType: value })}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="artist_intro">Artist Introduction</SelectItem>
                            <SelectItem value="sync_opportunity">Sync Opportunity</SelectItem>
                            <SelectItem value="follow_up">Follow Up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <EmailPreview
                      artistName={formData.artistName}
                      artistImage={selectedArtistId && myArtists ? myArtists.find(a => a.id === selectedArtistId)?.profileImage || null : null}
                      artistBio={formData.artistBio}
                      genre={formData.targetGenres[0] || ''}
                      contentType={formData.contentType}
                      contentTitle={formData.contentTitle}
                      pitchMessage={formData.pitchMessage}
                      landingUrl={formData.artistProfileUrl}
                      templateType={formData.templateType}
                    />
                  </motion.div>

                  {/* What happens next */}
                  <motion.div 
                    className="bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border-2 border-primary/20 rounded-2xl p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                        <Rocket className="w-4 h-4 text-white" />
                      </div>
                      What Happens Next?
                    </h4>
                    <motion.div 
                      className="grid md:grid-cols-2 gap-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {[
                        { icon: Send, title: "Professional Emails", text: `${selectedContacts.length > 0 ? selectedContacts.length : 'Selected'} contacts will receive personalized emails` },
                        { icon: Sparkles, title: "AI Personalization", text: "Each email is tailored with your pitch and artist data" },
                        { icon: MessageSquare, title: "Response Tracking", text: "Get notified when media outlets respond" },
                        { icon: TrendingUp, title: "Real-time Analytics", text: "Track opens, replies, and interview bookings" }
                      ].map((item, i) => (
                        <motion.div 
                          key={i}
                          className="flex items-start gap-3 p-4 bg-background/50 rounded-xl border border-border/30"
                          variants={itemVariants}
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <item.icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm mb-1">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.text}</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                    
                    {/* Quick Links */}
                    <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('/contacts', '_blank')}
                        className="gap-2 text-xs"
                      >
                        <Users className="w-3 h-3" />
                        Manage Contacts
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/artist/${selectedArtistId && myArtists ? myArtists.find(a => a.id === selectedArtistId)?.slug : ''}`, '_blank')}
                        disabled={!selectedArtistId}
                        className="gap-2 text-xs"
                      >
                        <Globe className="w-3 h-3" />
                        View Artist Landing Page
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
                  </motion.div>
                </AnimatePresence>
                
                {/* Animated Navigation Buttons */}
                <motion.div 
                  className="flex gap-4 pt-6 mt-6 border-t border-border/50"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleWizardBack}
                      className="gap-2 px-6"
                      data-testid="button-wizard-back"
                    >
                      <ArrowRight className="w-4 h-4 rotate-180" />
                      {wizardStep === 1 ? "Cancelar" : "Atrás"}
                    </Button>
                  </motion.div>
                  
                  <motion.div
                    className="flex-1"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button
                      type="button"
                      onClick={handleWizardNext}
                      className="gap-2 w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
                      disabled={
                        (wizardStep === 1 && (!formData.title || !formData.artistName)) ||
                        (wizardStep === 2 && (!formData.contentTitle || !formData.contentUrl)) ||
                        (wizardStep === 3 && (formData.targetMediaTypes.length === 0 || formData.targetCountries.length === 0)) ||
                        (wizardStep === 4 && (!formData.pitchMessage || !formData.contactEmail)) ||
                        createCampaignMutation.isPending
                      }
                      data-testid="button-wizard-next"
                    >
                      {createCampaignMutation.isPending ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <Loader2 className="w-4 h-4" />
                          </motion.div>
                          Creando campaña...
                        </>
                      ) : wizardStep === 5 ? (
                        <>
                          <Rocket className="w-4 h-4" />
                          Lanzar Campaña
                          <Sparkles className="w-4 h-4 ml-1" />
                        </>
                      ) : (
                        <>
                          Siguiente
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeView === "campaign" && selectedCampaign && (
          <motion.div 
            key="campaign-view"
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div 
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveView("list");
                    setSelectedCampaign(null);
                  }}
                  className="gap-2"
                  data-testid="button-back-to-list"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Volver a campañas
                </Button>
              </motion.div>
            </motion.div>

            {isLoadingDetails ? (
              <motion.div 
                className="flex flex-col items-center justify-center py-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-8 h-8 text-primary" />
                </motion.div>
                <p className="mt-4 text-muted-foreground">Cargando detalles de la campaña...</p>
              </motion.div>
            ) : campaignDetails?.campaign ? (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card to-card/90">
                    {/* Top gradient bar */}
                    <div className="h-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
                    
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                          >
                            <CardTitle className="text-2xl md:text-3xl mb-2 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text" data-testid="text-campaign-detail-title">
                              {campaignDetails.campaign.title}
                            </CardTitle>
                          </motion.div>
                          <CardDescription className="flex items-center gap-2 text-base" data-testid="text-campaign-detail-content">
                            <Music className="w-4 h-4" />
                            {campaignDetails.campaign.contentTitle} • {campaignDetails.campaign.contentType}
                          </CardDescription>
                        </div>
                        <motion.div 
                          className="flex gap-3"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4, type: "spring" }}
                        >
                          {getStatusBadge(campaignDetails.campaign.status)}
                          {campaignDetails.campaign.status === "draft" && (
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button
                                size="sm"
                                onClick={() => activateCampaignMutation.mutate(campaignDetails.campaign.id)}
                                disabled={activateCampaignMutation.isPending}
                                className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30"
                                data-testid="button-activate-campaign"
                              >
                                {activateCampaignMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                                Activar
                              </Button>
                            </motion.div>
                          )}
                          {campaignDetails.campaign.status === "active" && (
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => pauseCampaignMutation.mutate(campaignDetails.campaign.id)}
                                disabled={pauseCampaignMutation.isPending}
                                className="gap-2"
                                data-testid="button-pause-campaign"
                              >
                                {pauseCampaignMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Pause className="w-4 h-4" />
                                )}
                                Pausar
                              </Button>
                            </motion.div>
                          )}
                        </motion.div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {/* Animated Stats Grid */}
                      <motion.div 
                        className="grid grid-cols-2 md:grid-cols-4 gap-4"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {[
                          { label: "Medios Contactados", value: campaignDetails.campaign.mediaContacted, icon: Send, color: "from-blue-500 to-cyan-500", bgColor: "bg-blue-500/10" },
                          { label: "Emails Abiertos", value: campaignDetails.campaign.emailsOpened, icon: Eye, color: "from-green-500 to-emerald-500", bgColor: "bg-green-500/10" },
                          { label: "Respuestas", value: campaignDetails.campaign.mediaReplied, icon: MessageSquare, color: "from-yellow-500 to-orange-500", bgColor: "bg-yellow-500/10" },
                          { label: "Entrevistas Agendadas", value: campaignDetails.campaign.interviewsBooked, icon: Star, color: "from-primary to-purple-500", bgColor: "bg-primary/10" }
                        ].map((stat, i) => (
                          <motion.div
                            key={stat.label}
                            className={`p-5 rounded-2xl ${stat.bgColor} border border-border/30`}
                            variants={itemVariants}
                            whileHover={{ scale: 1.02, y: -2 }}
                          >
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                                <stat.icon className="w-4 h-4 text-white" />
                              </div>
                              {stat.label}
                            </div>
                            <motion.div 
                              className="text-3xl md:text-4xl font-bold"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.3 + i * 0.1, type: "spring", stiffness: 200 }}
                              data-testid={`text-detail-${stat.label.toLowerCase().replace(' ', '-')}`}
                            >
                              <AnimatedCounter value={stat.value} />
                            </motion.div>
                          </motion.div>
                        ))}
                      </motion.div>

                    {campaignDetails.campaign.mediaContacted > 0 && (
                      <motion.div 
                        className="mt-8 space-y-6 p-6 rounded-2xl bg-muted/30 border border-border/30"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                      >
                        <h4 className="font-semibold flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-primary" />
                          Métricas de Rendimiento
                        </h4>
                        
                        <div className="space-y-5">
                          <div>
                            <div className="flex justify-between text-sm mb-3">
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <Eye className="w-4 h-4" />
                                Tasa de Apertura
                              </span>
                              <span className="font-bold text-lg text-green-500">
                                {Math.round((campaignDetails.campaign.emailsOpened / campaignDetails.campaign.mediaContacted) * 100)}%
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${(campaignDetails.campaign.emailsOpened / campaignDetails.campaign.mediaContacted) * 100}%` }}
                                transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                          
                          {campaignDetails.campaign.emailsOpened > 0 && (
                            <div>
                              <div className="flex justify-between text-sm mb-3">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                  <MessageSquare className="w-4 h-4" />
                                  Tasa de Conversión (Respuestas)
                                </span>
                                <span className="font-bold text-lg text-yellow-500">
                                  {Math.round((campaignDetails.campaign.mediaReplied / campaignDetails.campaign.emailsOpened) * 100)}%
                                </span>
                              </div>
                              <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-yellow-500 to-orange-400 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(campaignDetails.campaign.mediaReplied / campaignDetails.campaign.emailsOpened) * 100}%` }}
                                  transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
                </motion.div>

                {campaignDetails.events && campaignDetails.events.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Card className="overflow-hidden border-0 shadow-lg">
                      <div className="h-1 bg-gradient-to-r from-primary/50 via-purple-500/50 to-pink-500/50" />
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-primary" />
                          Actividad Reciente
                        </CardTitle>
                        <CardDescription>Últimas interacciones con medios</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <motion.div 
                          className="space-y-3"
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          {campaignDetails.events.map((event, index) => {
                            const Icon = getEventIcon(event.eventType);
                            return (
                              <motion.div 
                                key={event.id} 
                                className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-border/30"
                                variants={itemVariants}
                                whileHover={{ x: 5 }}
                                data-testid={`event-${event.id}`}
                              >
                                <motion.div 
                                  className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10"
                                  whileHover={{ scale: 1.1, rotate: 5 }}
                                >
                                  <Icon className="w-5 h-5 text-primary" />
                                </motion.div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold" data-testid={`text-event-media-${event.id}`}>
                                    {event.mediaName}
                                  </div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2" data-testid={`text-event-type-${event.id}`}>
                                    <Badge variant="secondary" className="text-xs">
                                      {getEventLabel(event.eventType)}
                                    </Badge>
                                  </div>
                                  {event.notes && (
                                    <div className="text-sm mt-2 text-muted-foreground" data-testid={`text-event-notes-${event.id}`}>
                                      {event.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">
                                  {new Date(event.createdAt).toLocaleDateString('es-ES', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </>
            ) : null}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
      </div>
    </PlanTierGuard>
  );
}
