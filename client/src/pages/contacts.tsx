import { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Header } from "../components/layout/header";
import { useUser } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, UserPlus, Users, FileSpreadsheet, Loader2, Mail, Building2, Phone, X, 
  Send, Search, Filter, Globe, Briefcase, Eye, MousePointerClick, MessageSquare,
  ChevronLeft, ChevronRight, LayoutTemplate, Zap, Target, CheckCircle2, Sparkles,
  Music, Play, ArrowRight, Rocket, Star, Heart, Ticket, Clapperboard
} from "lucide-react";
import { TourIntelligenceTab } from "../components/contacts/tour-intelligence-tab";
import { PublishingHubTab } from "../components/contacts/publishing-hub-tab";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { db, auth } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "../hooks/use-toast";
import { Progress } from "../components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";

// Types for Industry Contacts
interface IndustryContact {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  jobTitle?: string;
  headline?: string;
  seniorityLevel?: string;
  industry?: string;
  companyName?: string;
  companyWebsite?: string;
  companySize?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedin?: string;
  category?: string;
  status?: string;
  emailsSent?: number;
  opensCount?: number;
  clicksCount?: number;
  lastContactedAt?: string;
}

interface QuotaInfo {
  remaining: number;
  sent: number;
  limit: number;
}

interface ContactStats {
  total: number;
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

// Category labels for display
const categoryLabels: Record<string, string> = {
  record_label: "🎵 Record Labels",
  publishing: "📝 Publishing",
  radio: "📻 Radio",
  tv: "📺 TV/Film",
  sync: "🎬 Sync/Licensing",
  studio: "🎙️ Studios",
  streaming: "📱 Streaming",
  live_events: "🎤 Live Events",
  pr_marketing: "📢 PR/Marketing",
  distribution: "📦 Distribution",
  other: "📁 Other"
};

// Status colors
const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  queued: "bg-yellow-500/20 text-yellow-400",
  contacted: "bg-purple-500/20 text-purple-400",
  opened: "bg-green-500/20 text-green-400",
  clicked: "bg-emerald-500/20 text-emerald-400",
  responded: "bg-teal-500/20 text-teal-400",
  not_interested: "bg-gray-500/20 text-gray-400",
  deal_in_progress: "bg-orange-500/20 text-orange-400",
  unsubscribed: "bg-red-500/20 text-red-400",
  bounced: "bg-red-500/20 text-red-400"
};

// Animated How It Works Component
function HowItWorksAnimation({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  
  const steps = [
    {
      id: 1,
      title: "Select Your Artist",
      description: "Choose the artist profile you want to promote",
      icon: Music,
      color: "from-purple-500 to-violet-600",
      bgColor: "bg-purple-500/10",
      illustration: (
        <div className="relative w-full h-32 md:h-40 flex items-center justify-center">
          <motion.div 
            className="absolute w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30"
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Music className="w-10 h-10 md:w-12 md:h-12 text-white" />
          </motion.div>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full bg-purple-400"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                x: Math.cos(i * 2.1) * 60,
                y: Math.sin(i * 2.1) * 60
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                delay: i * 0.3 
              }}
            />
          ))}
        </div>
      )
    },
    {
      id: 2,
      title: "Preview Your Email",
      description: "See exactly how your personalized email will look",
      icon: Eye,
      color: "from-green-500 to-emerald-600",
      bgColor: "bg-green-500/10",
      illustration: (
        <div className="relative w-full h-32 md:h-40 flex items-center justify-center">
          <motion.div 
            className="relative w-48 md:w-56 h-28 md:h-32 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 overflow-hidden shadow-xl"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            {/* Email header */}
            <div className="h-6 bg-gradient-to-r from-green-500/20 to-emerald-500/20 flex items-center px-2 gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            {/* Email content lines */}
            <div className="p-2 space-y-1.5">
              <motion.div 
                className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded w-3/4"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <div className="h-1.5 bg-gray-700 rounded w-full" />
              <div className="h-1.5 bg-gray-700 rounded w-5/6" />
              <div className="h-1.5 bg-gray-700 rounded w-4/6" />
            </div>
            {/* Sparkle effect */}
            <motion.div
              className="absolute top-2 right-2"
              animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Sparkles className="w-4 h-4 text-green-400" />
            </motion.div>
          </motion.div>
        </div>
      )
    },
    {
      id: 3,
      title: "Select Industry Contacts",
      description: "Choose from 700+ verified music industry professionals",
      icon: Users,
      color: "from-blue-500 to-cyan-600",
      bgColor: "bg-blue-500/10",
      illustration: (
        <div className="relative w-full h-32 md:h-40 flex items-center justify-center">
          <div className="flex gap-2 md:gap-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-14 h-16 md:w-16 md:h-20 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex flex-col items-center justify-center gap-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  scale: currentStep === 2 ? [1, 1.05, 1] : 1
                }}
                transition={{ delay: i * 0.2, duration: 0.5 }}
              >
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400" />
                <div className="w-8 md:w-10 h-1 bg-gray-600 rounded" />
                <motion.div 
                  className="w-4 h-4 rounded border-2 border-blue-500 flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, delay: 1 + i * 0.2 }}
                >
                  {i < 2 && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "Send & Track",
      description: "Launch your campaign with daily limits to protect your reputation",
      icon: Rocket,
      color: "from-pink-500 to-rose-600",
      bgColor: "bg-pink-500/10",
      illustration: (
        <div className="relative w-full h-32 md:h-40 flex items-center justify-center overflow-hidden">
          <motion.div
            className="relative"
            animate={{ 
              x: [0, 100, 100],
              y: [0, -50, -50],
              opacity: [1, 1, 0]
            }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          >
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/30">
              <Send className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
          </motion.div>
          {/* Trail particles */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-pink-400"
              animate={{
                x: [-20 + i * 15, 80 + i * 15],
                y: [10 - i * 5, -40 - i * 5],
                opacity: [0, 1, 0],
                scale: [0, 1, 0]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                delay: i * 0.1 + 0.2,
                repeatDelay: 1
              }}
            />
          ))}
          {/* Success checkmark */}
          <motion.div
            className="absolute right-4 md:right-8 top-4"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ delay: 1.5, duration: 0.5, repeat: Infinity, repeatDelay: 2.5 }}
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
          </motion.div>
        </div>
      )
    }
  ];
  
  // Auto-advance steps
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, steps.length]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg md:max-w-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-pink-500/20" />
          <motion.div
            className="absolute w-96 h-96 rounded-full bg-purple-500/10 blur-3xl"
            animate={{
              x: [-100, 100, -100],
              y: [-50, 50, -50]
            }}
            transition={{ duration: 10, repeat: Infinity }}
          />
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-800/80 flex items-center justify-center hover:bg-gray-700 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
        
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 mb-4"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">How It Works</span>
          </motion.div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Industry Outreach Made Easy
          </h2>
          <p className="text-gray-400 text-sm md:text-base">
            Connect with labels, publishers & sync opportunities in 4 simple steps
          </p>
        </div>
        
        {/* Step Content */}
        <div className="relative px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              {/* Step illustration */}
              <div className={`mx-auto mb-6 rounded-2xl ${steps[currentStep].bgColor} p-4`}>
                {steps[currentStep].illustration}
              </div>
              
              {/* Step info */}
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${steps[currentStep].color} mb-4 shadow-lg`}>
                {(() => {
                  const Icon = steps[currentStep].icon;
                  return <Icon className="w-6 h-6 text-white" />;
                })()}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Step {steps[currentStep].id}: {steps[currentStep].title}
              </h3>
              <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto">
                {steps[currentStep].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Step indicators */}
        <div className="flex justify-center gap-2 pb-4">
          {steps.map((step, i) => (
            <button
              key={step.id}
              onClick={() => {
                setCurrentStep(i);
                setIsAutoPlaying(false);
              }}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i === currentStep 
                  ? `bg-gradient-to-r ${step.color} w-8` 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentStep(prev => (prev - 1 + steps.length) % steps.length);
              setIsAutoPlaying(false);
            }}
            className="text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className={isAutoPlaying ? 'text-purple-400' : 'text-gray-400'}
          >
            {isAutoPlaying ? '⏸ Pause' : '▶ Play'}
          </Button>
          
          {currentStep === steps.length - 1 ? (
            <Button
              onClick={onClose}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              Get Started
              <Rocket className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentStep(prev => (prev + 1) % steps.length);
                setIsAutoPlaying(false);
              }}
              className="text-gray-400 hover:text-white"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ContactsPage() {
  const { toast } = useToast();
  const { isSignedIn, isLoaded, user } = useUser();
  const { userSubscription } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Tab state
  const [activeTab, setActiveTab] = useState("industry");
  
  // How it works animation state
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  
  // Industry contacts state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<number | null>(null);
  
  // Dialog states
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Redirect to auth if not signed in or not on a paid plan
  const PAID_PLANS = ['creator', 'professional', 'enterprise', 'artist', 'premium'];
  const isPaidUser = userSubscription && PAID_PLANS.includes(userSubscription);
  useEffect(() => {
    if (isLoaded && (!isSignedIn || (isSignedIn && userSubscription !== undefined && !isPaidUser))) {
      setLocation("/auth");
    }
  }, [isLoaded, isSignedIn, isPaidUser, setLocation]);

  // Debounce the search box so we issue one request after typing settles,
  // not one request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset to the first page whenever the active filters change.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, categoryFilter, statusFilter]);

  // Fetch industry contacts
  const { data: contactsData, isLoading: isLoadingContacts } = useQuery({
    queryKey: ["industry-contacts", currentPage, debouncedSearch, categoryFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(categoryFilter !== "all" && { category: categoryFilter }),
        ...(statusFilter !== "all" && { status: statusFilter })
      });

      return apiRequest(`/api/outreach/contacts?${params.toString()}`, "GET");
    },
    enabled: isSignedIn
  });

  // Fetch quota
  const { data: quota } = useQuery<QuotaInfo>({
    queryKey: ["outreach-quota"],
    queryFn: async () => {
      return apiRequest("/api/outreach/quota", "GET");
    },
    enabled: isSignedIn,
    refetchInterval: 30000
  });

  // Fetch stats
  const { data: stats } = useQuery<ContactStats>({
    queryKey: ["contacts-stats"],
    queryFn: async () => {
      return apiRequest("/api/outreach/contacts/stats", "GET");
    },
    enabled: isSignedIn
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ["filter-options"],
    queryFn: async () => {
      return apiRequest("/api/outreach/contacts/filters", "GET");
    },
    enabled: isSignedIn
  });

  // Fetch default templates
  const { data: defaultTemplates } = useQuery({
    queryKey: ["default-templates"],
    queryFn: async () => {
      return apiRequest("/api/outreach/templates/defaults", "GET");
    },
    enabled: isSignedIn
  });

  // Fetch user's artists - use the new outreach endpoint
  const { data: myArtists, isLoading: isLoadingArtists } = useQuery({
    queryKey: ["outreach-my-artists"],
    queryFn: async () => {
      try {
        return await apiRequest("/api/outreach/my-artists", "GET");
      } catch {
        return [];
      }
    },
    enabled: isSignedIn
  });

  // State for email preview
  const [previewArtistId, setPreviewArtistId] = useState<number | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Send batch mutation
  const sendBatchMutation = useMutation({
    mutationFn: async ({ contactIds, artistId }: { contactIds: number[]; artistId?: number }) => {
      return apiRequest("/api/outreach/send-batch", "POST", { contactIds, artistId });
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Sent! 🎉",
        description: `Sent: ${data.sent}, Failed: ${data.failed}, Queued for tomorrow: ${data.queued}`
      });
      queryClient.invalidateQueries({ queryKey: ["industry-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-quota"] });
      setSelectedContacts([]);
      setIsSendDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send batch",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Apply template
  const applyTemplate = (type: string) => {
    if (!defaultTemplates) return;
    const template = defaultTemplates[type];
    if (template) {
      setEmailSubject(template.subject);
      setEmailBody(template.bodyHtml);
      setIsTemplateDialogOpen(false);
      toast({
        title: "Template Applied",
        description: `Using "${type.replace('_', ' ')}" template`
      });
    }
  };

  // Toggle contact selection
  const toggleContactSelection = (id: number) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Select all on current page
  const selectAllOnPage = () => {
    if (!contactsData?.contacts) return;
    const pageIds = contactsData.contacts.map((c: IndustryContact) => c.id);
    setSelectedContacts(prev => {
      const allSelected = pageIds.every((id: number) => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !pageIds.includes(id));
      }
      return [...new Set([...prev, ...pageIds])];
    });
  };

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isSignedIn) return null;

  const contacts: IndustryContact[] = contactsData?.contacts || [];
  const pagination = contactsData?.pagination;

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <Header />
      
      {/* How It Works Animation Modal */}
      <AnimatePresence>
        {showHowItWorks && (
          <HowItWorksAnimation onClose={() => setShowHowItWorks(false)} />
        )}
      </AnimatePresence>
      
      <main className="flex-1 pb-16 sm:pb-0 overflow-x-hidden">
        <ScrollArea className="flex-1">
          <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6 lg:mb-8">
              {/* Title Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">
                      Industry Contacts
                    </h1>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHowItWorks(true)}
                      className="group border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/10 h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
                    >
                      <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-purple-400" />
                      <span className="text-purple-400 hidden sm:inline">How it Works</span>
                      <span className="text-purple-400 sm:hidden">?</span>
                    </Button>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {stats?.total?.toLocaleString() || 0} contacts • Labels, publishers & sync
                  </p>
                </div>
              </div>
              
              {/* Quota Display - Responsive */}
              <Card className="p-3 sm:p-4 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/30 w-full sm:w-auto sm:self-start">
                <div className="flex items-center justify-around sm:justify-start gap-3 sm:gap-4">
                  <div className="text-center">
                    <p className="text-lg sm:text-2xl font-bold text-purple-400">{quota?.remaining || 0}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Left Today</p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-purple-500/30" />
                  <div className="text-center">
                    <p className="text-lg sm:text-2xl font-bold text-pink-400">{quota?.sent || 0}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Sent</p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-purple-500/30" />
                  <div className="text-center">
                    <p className="text-lg sm:text-2xl font-bold text-green-400">{quota?.limit || 20}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Limit</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
              {stats?.byStatus?.slice(0, 4).map(stat => (
                <Card key={stat.status} className="p-2.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-sm text-muted-foreground capitalize truncate">{stat.status?.replace('_', ' ')}</p>
                      <p className="text-lg sm:text-2xl font-bold">{stat.count}</p>
                    </div>
                    <Badge className={`${statusColors[stat.status] || "bg-gray-500/20"} flex-shrink-0 p-1 sm:p-1.5`}>
                      {stat.status === 'opened' && <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                      {stat.status === 'clicked' && <MousePointerClick className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                      {stat.status === 'responded' && <MessageSquare className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                      {stat.status === 'contacted' && <Mail className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
              <div className="overflow-x-auto scrollbar-hide -mx-3 sm:-mx-4 px-3 sm:px-4 sm:mx-0 sm:px-0">
                <TabsList className="bg-background border inline-flex w-auto min-w-full sm:min-w-0">
                  <TabsTrigger value="industry" className="data-[state=active]:bg-purple-500/20 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none">
                    <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">Industry</span>
                    <span className="xs:hidden">DB</span>
                  </TabsTrigger>
                  <TabsTrigger value="email-preview" className="data-[state=active]:bg-green-500/20 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none">
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Email Preview</span>
                    <span className="sm:hidden">Preview</span>
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="data-[state=active]:bg-pink-500/20 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none">
                    <LayoutTemplate className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Templates</span>
                    <span className="sm:hidden">Email</span>
                  </TabsTrigger>
                  <TabsTrigger value="my-contacts" className="data-[state=active]:bg-orange-500/20 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">My Contacts</span>
                    <span className="sm:hidden">Mine</span>
                  </TabsTrigger>
                  <TabsTrigger value="tour" className="data-[state=active]:bg-cyan-500/20 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none">
                    <Ticket className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Tour Intel</span>
                    <span className="sm:hidden">Tour</span>
                  </TabsTrigger>
                  <TabsTrigger value="publishing" className="data-[state=active]:bg-amber-500/20 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none">
                    <Clapperboard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Publishing Hub</span>
                    <span className="sm:hidden">Sync</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Email Preview Tab - Shows artists and their email templates */}
              <TabsContent value="email-preview" className="space-y-4 sm:space-y-6">
                <Card className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                    Artist Email Templates
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
                    Select an artist to preview their personalized email template.
                  </p>
                  
                  {/* Artist Selection Grid */}
                  {isLoadingArtists ? (
                    <div className="flex items-center justify-center py-6 sm:py-8">
                      <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-green-500" />
                    </div>
                  ) : !myArtists || myArtists.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                      <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-2 sm:mb-3" />
                      <p className="text-muted-foreground text-sm sm:text-base">No artists found</p>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">Create an artist to generate templates</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="mt-3 sm:mt-4"
                        onClick={() => setLocation('/my-artists')}
                      >
                        Go to My Artists
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {myArtists.map((artist: any) => (
                        <Card 
                          key={artist.id} 
                          className={`p-3 sm:p-4 cursor-pointer transition-all hover:border-green-500/50 ${
                            previewArtistId === artist.id ? 'border-green-500 bg-green-500/5' : ''
                          }`}
                          onClick={() => setPreviewArtistId(artist.id)}
                        >
                          <div className="flex items-center gap-3 sm:gap-4">
                            {artist.profileImage ? (
                              <img 
                                src={artist.profileImage} 
                                alt={artist.name}
                                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-purple-500/50 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-lg sm:text-xl font-bold flex-shrink-0">
                                {artist.name?.charAt(0) || 'A'}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold truncate text-sm sm:text-base">{artist.name || 'Unnamed'}</h4>
                              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                {artist.genres?.join(', ') || 'Music'}
                              </p>
                              {artist.isAIGenerated && (
                                <Badge className="mt-1 bg-purple-500/20 text-purple-400 text-[10px] sm:text-xs px-1.5">AI</Badge>
                              )}
                            </div>
                            {previewArtistId === artist.id && (
                              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {/* Preview Button */}
                  {previewArtistId && (
                    <div className="mt-6 flex justify-center">
                      <Button 
                        className="bg-gradient-to-r from-green-600 to-emerald-600"
                        onClick={() => setShowEmailPreview(true)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Email for Selected Artist
                      </Button>
                    </div>
                  )}
                </Card>
                
                {/* Email Preview Iframe */}
                {showEmailPreview && previewArtistId && (
                  <Card className="overflow-hidden">
                    <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-muted/50 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                        <span className="font-semibold text-sm sm:text-base truncate">Email Preview</span>
                      </div>
                      <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
                          onClick={() => window.open(`/api/outreach/artist-preview/${previewArtistId}`, '_blank')}
                        >
                          <Target className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">New Tab</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 sm:h-8 px-2"
                          onClick={() => setShowEmailPreview(false)}
                        >
                          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                    <iframe 
                      src={`/api/outreach/artist-preview/${previewArtistId}`}
                      className="w-full h-[400px] sm:h-[500px] lg:h-[700px] border-0"
                      title="Email Preview"
                    />
                  </Card>
                )}
              </TabsContent>

              {/* Industry Database Tab */}
              <TabsContent value="industry" className="space-y-3 sm:space-y-4">
                {/* Filters & Actions Bar */}
                <div className="flex flex-col gap-3">
                  {/* Search and Filters Row */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        aria-label="Search industry contacts"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-full text-sm h-9"
                      />
                    </div>
                    
                    {/* Filters Row */}
                    <div className="flex gap-2">
                      {/* Category Filter */}
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-full sm:w-40 h-9 text-xs sm:text-sm" aria-label="Filter by category">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {Object.entries(categoryLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Status Filter */}
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-32 h-9 text-xs sm:text-sm" aria-label="Filter by status">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="queued">Queued</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="opened">Opened</SelectItem>
                          <SelectItem value="clicked">Clicked</SelectItem>
                          <SelectItem value="responded">Responded</SelectItem>
                          <SelectItem value="deal_in_progress">Deal in Progress</SelectItem>
                          <SelectItem value="not_interested">Not Interested</SelectItem>
                          <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                          <SelectItem value="bounced">Bounced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Actions Row */}
                  <div className="flex gap-2 justify-between sm:justify-end">
                    {selectedContacts.length > 0 && (
                      <Button
                        onClick={() => setIsSendDialogOpen(true)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
                        disabled={!quota || quota.remaining === 0}
                        size="sm"
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Send ({selectedContacts.length})
                      </Button>
                    )}
                    <Button variant="outline" onClick={selectAllOnPage} size="sm" className="text-xs sm:text-sm h-8 sm:h-9">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      {contacts.every(c => selectedContacts.includes(c.id)) ? "Deselect" : "Select All"}
                    </Button>
                  </div>
                </div>

                {/* Contacts Table */}
                {isLoadingContacts ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  </div>
                ) : contacts.length === 0 ? (
                  <Card className="p-8 sm:p-12 text-center">
                    <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground" />
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-semibold">No Contacts Found</h3>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Try adjusting your filters
                    </p>
                  </Card>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-3">
                      {contacts.map((contact) => (
                        <Card 
                          key={contact.id} 
                          className={`p-3 ${
                            selectedContacts.includes(contact.id) ? "border-purple-500 bg-purple-500/5" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox 
                              checked={selectedContacts.includes(contact.id)}
                              onCheckedChange={() => toggleContactSelection(contact.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{contact.fullName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{contact.jobTitle}</p>
                                  <p className="text-xs text-purple-400 truncate">{contact.email || contact.personalEmail}</p>
                                </div>
                                <Badge className={`${statusColors[contact.status || "new"]} text-[10px] flex-shrink-0`}>
                                  {contact.status?.replace('_', ' ')}
                                </Badge>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] px-1.5">
                                    {contact.companyName || 'Unknown'}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Mail className="h-2.5 w-2.5" />{contact.emailsSent || 0}
                                    <Eye className="h-2.5 w-2.5 ml-1" />{contact.opensCount || 0}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  onClick={() => {
                                    setSelectedContacts([contact.id]);
                                    setIsSendDialogOpen(true);
                                  }}
                                  disabled={!quota || quota.remaining === 0 || !contact.email && !contact.personalEmail}
                                >
                                  <Send className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                    
                    {/* Desktop Table View */}
                    <Card className="overflow-hidden hidden sm:block">
                      <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="p-3 text-left w-10">
                              <Checkbox 
                                checked={contacts.every(c => selectedContacts.includes(c.id))}
                                onCheckedChange={selectAllOnPage}
                              />
                            </th>
                            <th className="p-3 text-left">Contact</th>
                            <th className="p-3 text-left">Company</th>
                            <th className="p-3 text-left">Category</th>
                            <th className="p-3 text-left">Status</th>
                            <th className="p-3 text-left">Stats</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contacts.map((contact) => (
                            <tr 
                              key={contact.id} 
                              className={`border-t hover:bg-muted/30 transition-colors ${
                                selectedContacts.includes(contact.id) ? "bg-purple-500/10" : ""
                              }`}
                            >
                              <td className="p-3">
                                <Checkbox 
                                  checked={selectedContacts.includes(contact.id)}
                                  onCheckedChange={() => toggleContactSelection(contact.id)}
                                />
                              </td>
                              <td className="p-3">
                                <div>
                                  <p className="font-medium">{contact.fullName}</p>
                                  <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>
                                  <p className="text-xs text-purple-400">{contact.email || contact.personalEmail}</p>
                                </div>
                              </td>
                              <td className="p-3">
                                <div>
                                  <p className="font-medium">{contact.companyName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {contact.city}{contact.country ? `, ${contact.country}` : ""}
                                  </p>
                                </div>
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className="text-xs">
                                  {categoryLabels[contact.category || "other"] || contact.category}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <Badge className={statusColors[contact.status || "new"]}>
                                  {contact.status?.replace('_', ' ')}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-3 text-xs text-muted-foreground">
                                  <span title="Emails Sent">
                                    <Mail className="h-3 w-3 inline mr-1" />
                                    {contact.emailsSent || 0}
                                  </span>
                                  <span title="Opens">
                                    <Eye className="h-3 w-3 inline mr-1" />
                                    {contact.opensCount || 0}
                                  </span>
                                  <span title="Clicks">
                                    <MousePointerClick className="h-3 w-3 inline mr-1" />
                                    {contact.clicksCount || 0}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedContacts([contact.id]);
                                    setIsSendDialogOpen(true);
                                  }}
                                  disabled={!quota || quota.remaining === 0 || !contact.email && !contact.personalEmail}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Send
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between p-3 sm:p-4 border-t">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          <span className="hidden sm:inline">Page {pagination.page} of {pagination.totalPages} • </span>
                          {pagination.total} contacts
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={currentPage >= pagination.totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                  </>
                )}
              </TabsContent>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {/* Artist Introduction Template */}
                  <Card className="p-4 sm:p-6 hover:border-purple-500/50 transition-colors cursor-pointer" onClick={() => applyTemplate('artist_intro')}>
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3 sm:mb-4">
                      <Target className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                    </div>
                    <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Artist Introduction</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Professional intro for labels and publishers.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 sm:mt-4 w-full text-xs sm:text-sm">Use Template</Button>
                  </Card>
                  
                  {/* Sync Opportunity Template */}
                  <Card className="p-4 sm:p-6 hover:border-pink-500/50 transition-colors cursor-pointer" onClick={() => applyTemplate('sync_opportunity')}>
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-pink-500/20 flex items-center justify-center mb-3 sm:mb-4">
                      <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-pink-400" />
                    </div>
                    <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Sync Opportunity</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      For music supervisors and sync licensing.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 sm:mt-4 w-full text-xs sm:text-sm">Use Template</Button>
                  </Card>
                  
                  {/* Follow Up Template */}
                  <Card className="p-4 sm:p-6 hover:border-orange-500/50 transition-colors cursor-pointer" onClick={() => applyTemplate('follow_up')}>
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-3 sm:mb-4">
                      <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" />
                    </div>
                    <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Follow Up</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      For contacts who haven't responded.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 sm:mt-4 w-full text-xs sm:text-sm">Use Template</Button>
                  </Card>
                </div>
                
                {/* Custom Template Editor */}
                <Card className="p-4 sm:p-6">
                  <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Custom Email</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <Label className="text-xs sm:text-sm">Subject Line</Label>
                      <Input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="🎵 Introducing {{artist_name}}"
                        className="mt-1 text-sm"
                      />
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        Variables: artist_name, contact_name, company_name
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Email Body</Label>
                      <Textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Hi {{contact_name}},&#10;&#10;I wanted to introduce..."
                        className="min-h-[120px] sm:min-h-[200px] font-mono text-xs sm:text-sm mt-1"
                      />
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* My Contacts Tab (Original) */}
              <TabsContent value="my-contacts">
                <Card className="p-6 sm:p-8 text-center">
                  <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-semibold">Personal Contacts</h3>
                  <p className="text-muted-foreground mt-2 text-xs sm:text-sm">
                    Your manually added contacts and imports.
                  </p>
                  <Button className="mt-3 sm:mt-4 bg-orange-500 hover:bg-orange-600" size="sm">
                    <UserPlus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Add Contact
                  </Button>
                </Card>
              </TabsContent>

              {/* Tour Intelligence Tab */}
              <TabsContent value="tour">
                <TourIntelligenceTab />
              </TabsContent>

              {/* Publishing & Sync Hub Tab */}
              <TabsContent value="publishing">
                <PublishingHubTab />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </main>

      {/* Send Email Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Send Outreach Email</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Send to {selectedContacts.length} selected contact(s)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
            {/* Select Artist */}
            <div>
              <Label className="text-xs sm:text-sm">Select Artist</Label>
              <Select value={selectedArtist?.toString() || ""} onValueChange={(v) => setSelectedArtist(parseInt(v))}>
                <SelectTrigger className="mt-1 text-sm">
                  <SelectValue placeholder="Choose an artist..." />
                </SelectTrigger>
                <SelectContent>
                  {myArtists?.map((artist: any) => (
                    <SelectItem key={artist.id} value={artist.id.toString()}>
                      {artist.artistName || artist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Template Selection */}
            <div>
              <Label className="text-xs sm:text-sm">Template</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => applyTemplate('artist_intro')} className="text-xs h-8">
                  Intro
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyTemplate('sync_opportunity')} className="text-xs h-8">
                  Sync
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyTemplate('follow_up')} className="text-xs h-8">
                  Follow Up
                </Button>
              </div>
            </div>
            
            {/* Preview */}
            {emailSubject && (
              <div className="p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                <p className="text-xs sm:text-sm font-medium truncate">Subject: {emailSubject.substring(0, 50)}...</p>
              </div>
            )}
            
            {/* Quota Warning */}
            {quota && quota.remaining < selectedContacts.length && (
              <div className="p-2.5 sm:p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <p className="text-xs sm:text-sm text-yellow-400">
                  ⚠️ Only {quota.remaining} emails left. {selectedContacts.length - quota.remaining} queued for tomorrow.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 sm:gap-3">
            <Button variant="outline" size="sm" onClick={() => setIsSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => sendBatchMutation.mutate({ 
                contactIds: selectedContacts, 
                artistId: selectedArtist || undefined 
              })}
              disabled={sendBatchMutation.isPending || !quota || quota.remaining === 0}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {sendBatchMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              Send {Math.min(selectedContacts.length, quota?.remaining || 0)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
