import { Button } from "../components/ui/button";
import { logger } from "../lib/logger";
import { Input } from "../components/ui/input";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useArtistProfile } from "../hooks/use-artist-profile";
import { ArtistSelector } from "../components/promotion/artist-selector";
import { useToast } from "../hooks/use-toast";
import { PlanTierGuard } from "../components/youtube-views/plan-tier-guard";
import { 
  Loader2, Play, TrendingUp, Home, Key, Video, MessageSquare, 
  Eye, Database, Brain, FileText, Sparkles, CheckCircle, 
  AlertTriangle, Copy, X, Star, Lightbulb, Target, Award,
  Image, Search, TrendingDown, Scissors, Users, Calendar,
  Gauge, Code, Plug, RefreshCw, Zap, ArrowUpRight, Download, Crown
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { SiYoutube } from "react-icons/si";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Users2 } from "lucide-react";
import { Header } from "../components/layout/header";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { ExtraServicesSection } from "../components/services/extra-services-section";
import { ExtensionSyncTab } from "../components/youtube-views/extension-sync-tab";
import { YoutubePricing } from "../components/youtube-views/youtube-pricing";
import { YouTubeSubscriptionBanner } from "../components/youtube-views/subscription-banner";
import { PageDiagnosticPanel } from "../components/admin/page-diagnostic-panel";

// Chrome Web Store URL — update EXTENSION_ID after publishing
const CHROME_WEBSTORE_URL = "https://chromewebstore.google.com/detail/boostify-youtube-sync/EXTENSION_ID_HERE";

// Types
interface PreLaunchResult {
  score: number;
  prediction: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  estimatedViews: {
    '7days': number;
    '30days': number;
  };
  remaining: number;
}

interface Keyword {
  keyword: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relevance: number;
  estimatedSearches: number;
  competition: 'low' | 'medium' | 'high';
}

interface TitleAnalysis {
  score: number;
  ctrScore: number;
  seoScore: number;
  emotionalScore: number;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  improvedTitles: string[];
  remaining: number;
}

interface VideoIdea {
  title: string;
  description: string;
  targetAudience: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedViews: number;
  keywords: string[];
  hook: string;
}

// PHASE 2 Types
interface ThumbnailResult {
  imageUrl: string;
  prompt: string;
  ctrScore: number;
  suggestedText: string;
  reason: string;
}

interface CompetitorAnalysis {
  channelName: string;
  avgViews: number;
  topPerformingTopics: string[];
  uploadFrequency: string;
  bestUploadDays: string[];
  bestUploadTime: string;
  contentGaps: string[];
  strengths: string[];
  weaknesses: string[];
  insights: string[];
}

interface Trend {
  topic: string;
  confidence: number;
  timeToAct: string;
  risingKeywords: string[];
  competitionLevel: 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high';
  reason: string;
}

interface ShortClip {
  startTime: string;
  endTime: string;
  duration: number;
  viralScore: number;
  reason: string;
  hook: string;
  suggestedTitle: string;
  tags: string[];
}

// PHASE 3 Types
interface TrackedChannel {
  id: string;
  channelName: string;
  channelUrl: string;
  metrics: {
    totalVideos: number;
    totalViews: number;
    subscribers: number;
    avgViews: number;
  };
}

interface CalendarVideo {
  day: string;
  date: string;
  title: string;
  description: string;
  keywords: string[];
  uploadTime: string;
  scriptOutline: string[];
  thumbnailConcept: string;
  estimatedViews: number;
}

interface CalendarWeek {
  weekNumber: number;
  videos: CalendarVideo[];
}

interface OptimizationAction {
  action: string;
  impact: 'high' | 'medium' | 'low';
  urgency: string;
  reason: string;
}

interface ApiKey {
  id: string;
  apiKey: string;
  createdAt: any;
  isActive: boolean;
  usageCount: number;
  rateLimit: number;
}

export default function YoutubeViewsPage() {
  const { user, isAdmin, userSubscription } = useAuth();
  const { toast } = useToast();
  const { selectedArtist, getYouTubeData } = useArtistProfile();
  const [activeTab, setActiveTab] = useState("pre-launch");
  const [pricingOpen, setPricingOpen] = useState(false);
  
  // Pre-Launch Score states
  const [preLaunchTitle, setPreLaunchTitle] = useState("");
  const [preLaunchDescription, setPreLaunchDescription] = useState("");
  const [preLaunchNiche, setPreLaunchNiche] = useState("");
  const [preLaunchKeywords, setPreLaunchKeywords] = useState("");
  const [preLaunchLoading, setPreLaunchLoading] = useState(false);
  const [preLaunchResult, setPreLaunchResult] = useState<PreLaunchResult | null>(null);
  
  // Keywords Generator states
  const [keywordTopic, setKeywordTopic] = useState("");
  const [keywordNiche, setKeywordNiche] = useState("");
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [generatedKeywords, setGeneratedKeywords] = useState<Keyword[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  
  // Title Analyzer states
  const [titleToAnalyze, setTitleToAnalyze] = useState("");
  const [titleNiche, setTitleNiche] = useState("");
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleResult, setTitleResult] = useState<TitleAnalysis | null>(null);
  
  // Content Ideas states
  const [contentNiche, setContentNiche] = useState("");
  const [contentIdeasCount, setContentIdeasCount] = useState(5);
  const [contentLoading, setContentLoading] = useState(false);
  const [videoIdeas, setVideoIdeas] = useState<VideoIdea[]>([]);
  const [contentGaps, setContentGaps] = useState<string[]>([]);
  const [trendingSubtopics, setTrendingSubtopics] = useState<string[]>([]);

  // Sync artist profile data when selected artist changes
  useEffect(() => {
    const ytData = getYouTubeData();
    if (ytData && selectedArtist) {
      // Always update niche fields with artist's genre when artist changes
      if (ytData.genres.length > 0) {
        const genre = ytData.genres[0];
        setPreLaunchNiche(genre);
        setKeywordNiche(genre);
        setTitleNiche(genre);
        setContentNiche(genre);
        setThumbnailNiche(genre);
        setTrendNiche(genre);
        setCalendarNiche(genre);
      }
      // Set artist name as keyword topic suggestion
      if (ytData.artistName) {
        setKeywordTopic(`${ytData.artistName} music`);
      }
    }
  }, [selectedArtist?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success') {
      toast({
        title: 'Welcome to YouTube Boost Pro!',
        description: 'Your standalone subscription is active.',
      });
      window.history.replaceState({}, '', '/youtube-views');
    } else if (payment === 'cancelled') {
      toast({
        title: 'Payment cancelled',
        description: 'You can upgrade anytime.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/youtube-views');
    }
  }, [toast]);

  // PHASE 2 - Thumbnail Generator states
  const [thumbnailTitle, setThumbnailTitle] = useState("");
  const [thumbnailStyle, setThumbnailStyle] = useState("modern");
  const [thumbnailNiche, setThumbnailNiche] = useState("");
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [thumbnails, setThumbnails] = useState<ThumbnailResult[]>([]);

  // PHASE 2 - Competitor Analysis states
  const [competitorChannel, setCompetitorChannel] = useState("");
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorData, setCompetitorData] = useState<CompetitorAnalysis | null>(null);

  // PHASE 2 - Trend Predictor states
  const [trendNiche, setTrendNiche] = useState("");
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trends, setTrends] = useState<Trend[]>([]);

  // PHASE 2 - Transcript Extractor states
  const [transcriptUrl, setTranscriptUrl] = useState("");
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [shortClips, setShortClips] = useState<ShortClip[]>([]);

  // PHASE 3 - Multi-Channel Tracking states
  const [newChannelUrl, setNewChannelUrl] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [trackedChannels, setTrackedChannels] = useState<TrackedChannel[]>([]);
  const [channelAnalytics, setChannelAnalytics] = useState<any>(null);

  // PHASE 3 - Content Calendar states
  const [calendarNiche, setCalendarNiche] = useState("");
  const [calendarGoals, setCalendarGoals] = useState("");
  const [videosPerWeek, setVideosPerWeek] = useState(3);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarWeeks, setCalendarWeeks] = useState<CalendarWeek[]>([]);

  // PHASE 3 - Auto-Optimization states
  const [optVideoUrl, setOptVideoUrl] = useState("");
  const [optLoading, setOptLoading] = useState(false);
  const [optResult, setOptResult] = useState<any>(null);

  // PHASE 3 - API Access states
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiLoading, setApiLoading] = useState(false);

  // 1. PRE-LAUNCH SCORE
  const handlePreLaunchScore = async () => {
    if (!preLaunchTitle || !preLaunchNiche) {
      toast({
        title: "Missing Information",
        description: "Please provide both title and niche",
        variant: "destructive"
      });
      return;
    }

    setPreLaunchLoading(true);
    setPreLaunchResult(null);

    try {
      const response = await fetch('/api/youtube/pre-launch-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: preLaunchTitle,
          description: preLaunchDescription,
          keywords: preLaunchKeywords,
          niche: preLaunchNiche
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      setPreLaunchResult(data);
      toast({
        title: "Analysis Complete!",
        description: `Your video scored ${data.score}/100`,
      });
    } catch (error: any) {
      logger.error('Pre-launch error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze video concept",
        variant: "destructive"
      });
    } finally {
      setPreLaunchLoading(false);
    }
  };

  // 2. KEYWORDS GENERATOR
  const handleGenerateKeywords = async () => {
    if (!keywordTopic) {
      toast({
        title: "Missing Information",
        description: "Please provide a topic",
        variant: "destructive"
      });
      return;
    }

    setKeywordsLoading(true);
    setGeneratedKeywords([]);

    try {
      const response = await fetch('/api/youtube/generate-keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          topic: keywordTopic,
          niche: keywordNiche
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate keywords');
      }

      setGeneratedKeywords(data.keywords);
      setTrendingTags(data.trendingTags);
      toast({
        title: "Keywords Generated!",
        description: `Found ${data.keywords.length} optimized keywords`,
      });
    } catch (error: any) {
      logger.error('Keywords error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate keywords",
        variant: "destructive"
      });
    } finally {
      setKeywordsLoading(false);
    }
  };

  // 3. TITLE ANALYZER
  const handleAnalyzeTitle = async () => {
    if (!titleToAnalyze) {
      toast({
        title: "Missing Information",
        description: "Please provide a title to analyze",
        variant: "destructive"
      });
      return;
    }

    setTitleLoading(true);
    setTitleResult(null);

    try {
      const response = await fetch('/api/youtube/analyze-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: titleToAnalyze,
          niche: titleNiche
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze title');
      }

      setTitleResult(data);
      toast({
        title: "Title Analyzed!",
        description: `Your title scored ${data.score}/100`,
      });
    } catch (error: any) {
      logger.error('Title analysis error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze title",
        variant: "destructive"
      });
    } finally {
      setTitleLoading(false);
    }
  };

  // 4. CONTENT IDEAS GENERATOR
  const handleGenerateContentIdeas = async () => {
    if (!contentNiche) {
      toast({
        title: "Missing Information",
        description: "Please provide a niche",
        variant: "destructive"
      });
      return;
    }

    setContentLoading(true);
    setVideoIdeas([]);

    try {
      const response = await fetch('/api/youtube/content-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          niche: contentNiche,
          count: contentIdeasCount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate ideas');
      }

      setVideoIdeas(data.videoIdeas);
      setContentGaps(data.contentGaps);
      setTrendingSubtopics(data.trendingSubtopics);
      toast({
        title: "Ideas Generated!",
        description: `Found ${data.videoIdeas.length} video ideas`,
      });
    } catch (error: any) {
      logger.error('Content ideas error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate content ideas",
        variant: "destructive"
      });
    } finally {
      setContentLoading(false);
    }
  };

  // PHASE 2 HANDLERS

  // 5. THUMBNAIL GENERATOR
  const handleGenerateThumbnails = async () => {
    if (!thumbnailTitle || !thumbnailNiche) {
      toast({
        title: "Missing Information",
        description: "Please provide title and niche",
        variant: "destructive"
      });
      return;
    }

    setThumbnailLoading(true);
    setThumbnails([]);

    try {
      const response = await fetch('/api/youtube/generate-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: thumbnailTitle,
          style: thumbnailStyle,
          niche: thumbnailNiche
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate thumbnails');
      }

      setThumbnails(data.thumbnails);
      toast({
        title: "Thumbnails Generated!",
        description: `Created ${data.thumbnails.length} AI thumbnails`,
      });
    } catch (error: any) {
      logger.error('Thumbnail generation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate thumbnails",
        variant: "destructive"
      });
    } finally {
      setThumbnailLoading(false);
    }
  };

  // 6. COMPETITOR ANALYSIS
  const handleCompetitorAnalysis = async () => {
    if (!competitorChannel) {
      toast({
        title: "Missing Information",
        description: "Please provide a competitor channel name",
        variant: "destructive"
      });
      return;
    }

    setCompetitorLoading(true);
    setCompetitorData(null);

    try {
      const response = await fetch('/api/youtube/analyze-competitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          channelName: competitorChannel
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze competitor');
      }

      setCompetitorData(data);
      toast({
        title: "Analysis Complete!",
        description: `Analyzed ${data.channelName}'s strategy`,
      });
    } catch (error: any) {
      logger.error('Competitor analysis error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze competitor",
        variant: "destructive"
      });
    } finally {
      setCompetitorLoading(false);
    }
  };

  // 7. TREND PREDICTOR
  const handlePredictTrends = async () => {
    if (!trendNiche) {
      toast({
        title: "Missing Information",
        description: "Please provide a niche",
        variant: "destructive"
      });
      return;
    }

    setTrendsLoading(true);
    setTrends([]);

    try {
      const response = await fetch('/api/youtube/predict-trends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          niche: trendNiche
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to predict trends');
      }

      setTrends(data.trends);
      toast({
        title: "Trends Detected!",
        description: `Found ${data.trends.length} emerging trends`,
      });
    } catch (error: any) {
      logger.error('Trend prediction error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to predict trends",
        variant: "destructive"
      });
    } finally {
      setTrendsLoading(false);
    }
  };

  // 8. TRANSCRIPT EXTRACTOR
  const handleExtractTranscript = async () => {
    if (!transcriptUrl) {
      toast({
        title: "Missing Information",
        description: "Please provide a video URL",
        variant: "destructive"
      });
      return;
    }

    setTranscriptLoading(true);
    setShortClips([]);

    try {
      const response = await fetch('/api/youtube/extract-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          videoUrl: transcriptUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract transcript');
      }

      setShortClips(data.shortsOpportunities);
      toast({
        title: "Shorts Clips Found!",
        description: `Identified ${data.shortsOpportunities.length} viral moments`,
      });
    } catch (error: any) {
      logger.error('Transcript extraction error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to extract transcript",
        variant: "destructive"
      });
    } finally {
      setTranscriptLoading(false);
    }
  };

  // PHASE 3 HANDLERS

  // 9. MULTI-CHANNEL TRACKING
  const handleAddChannel = async () => {
    if (!newChannelUrl || !newChannelName) {
      toast({
        title: "Missing Information",
        description: "Please provide channel URL and name",
        variant: "destructive"
      });
      return;
    }

    setChannelsLoading(true);

    try {
      const response = await fetch('/api/youtube/track-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'add',
          channelUrl: newChannelUrl,
          channelName: newChannelName
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add channel');
      }

      toast({
        title: "Channel Added!",
        description: `Now tracking ${newChannelName}`,
      });
      setNewChannelUrl("");
      setNewChannelName("");
      loadTrackedChannels();
    } catch (error: any) {
      logger.error('Add channel error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add channel",
        variant: "destructive"
      });
    } finally {
      setChannelsLoading(false);
    }
  };

  const loadTrackedChannels = async () => {
    try {
      const response = await fetch('/api/youtube/track-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ action: 'list' })
      });

      const data = await response.json();
      if (response.ok) {
        setTrackedChannels(data.channels || []);
      }
    } catch (error) {
      logger.error('Load channels error:', error);
    }
  };

  const loadChannelAnalytics = async () => {
    try {
      const response = await fetch('/api/youtube/multi-channel-analytics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok) {
        setChannelAnalytics(data);
      }
    } catch (error) {
      logger.error('Load analytics error:', error);
    }
  };

  // 10. CONTENT CALENDAR
  const handleGenerateCalendar = async () => {
    if (!calendarNiche) {
      toast({
        title: "Missing Information",
        description: "Please provide a niche",
        variant: "destructive"
      });
      return;
    }

    setCalendarLoading(true);
    setCalendarWeeks([]);

    try {
      const response = await fetch('/api/youtube/generate-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          niche: calendarNiche,
          goals: calendarGoals,
          videosPerWeek: videosPerWeek
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate calendar');
      }

      setCalendarWeeks(data.weeks);
      toast({
        title: "Calendar Generated!",
        description: `Created ${data.totalVideos} video plan`,
      });
    } catch (error: any) {
      logger.error('Calendar generation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate calendar",
        variant: "destructive"
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  // 11. AUTO-OPTIMIZATION
  const handleCheckOptimization = async () => {
    if (!optVideoUrl) {
      toast({
        title: "Missing Information",
        description: "Please provide a video URL",
        variant: "destructive"
      });
      return;
    }

    setOptLoading(true);
    setOptResult(null);

    try {
      const response = await fetch('/api/youtube/check-optimization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          videoUrl: optVideoUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check optimization');
      }

      setOptResult(data);
      toast({
        title: "Optimization Check Complete!",
        description: `Performance score: ${data.performanceScore}/100`,
      });
    } catch (error: any) {
      logger.error('Optimization check error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to check optimization",
        variant: "destructive"
      });
    } finally {
      setOptLoading(false);
    }
  };

  // 12. API ACCESS
  const handleGenerateApiKey = async () => {
    setApiLoading(true);

    try {
      const response = await fetch('/api/youtube/api-key/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate API key');
      }

      toast({
        title: "API Key Generated!",
        description: "Your new API key is ready to use",
      });
      loadApiKeys();
    } catch (error: any) {
      logger.error('API key generation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate API key",
        variant: "destructive"
      });
    } finally {
      setApiLoading(false);
    }
  };

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/youtube/api-keys', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok) {
        setApiKeys(data.keys || []);
      }
    } catch (error) {
      logger.error('Load API keys error:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard",
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-500 bg-green-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'hard': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <Header />
      <main className="flex-1 space-y-0 p-0">
        {/* HERO SECTION - Glassmorphism + Particles */}
        <div className="relative w-full overflow-hidden bg-gradient-to-b from-[#0a0a0f] via-[#0d0d18] to-[#0a0a0f]">
          {/* Animated Background Orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
              animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[-10%] right-[10%] w-[500px] h-[500px] bg-orange-500/8 rounded-full blur-[120px]"
            />
            <motion.div 
              animate={{ x: [0, -20, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-[-10%] left-[5%] w-[400px] h-[400px] bg-orange-600/6 rounded-full blur-[100px]"
            />
            <motion.div 
              animate={{ x: [0, 15, 0], y: [0, -15, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute top-[30%] left-[40%] w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[80px]"
            />
            {/* Grid pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.01)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black_40%,transparent_100%)]" />
          </div>

          <div className="relative container mx-auto py-16 md:py-28 px-4 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center max-w-5xl mx-auto"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-orange-500/5 border border-orange-500/15 mb-8 backdrop-blur-xl"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                </span>
                <span className="text-sm font-medium text-orange-300/90">12 AI-Powered Tools for YouTube Success</span>
              </motion.div>

              {/* Main Heading */}
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.7 }}
                className="text-5xl md:text-8xl font-bold mb-8 leading-[0.95] tracking-tight"
              >
                <span className="text-white">Grow Your</span>
                <br />
                <span className="text-white">YouTube Channel </span>
                <span className="relative">
                  <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                    10x Faster
                  </span>
                  <motion.span 
                    className="absolute -bottom-2 left-0 right-0 h-[3px] bg-gradient-to-r from-orange-500/0 via-orange-500 to-orange-500/0 rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1.2, duration: 0.8 }}
                  />
                </span>
              </motion.h1>

              {/* Subheading */}
              <motion.p 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="text-lg md:text-2xl text-white/40 mb-10 max-w-3xl mx-auto font-light leading-relaxed"
              >
                Standalone tool - no full suite required. Advanced AI analytics, competitor insights, and content optimization in one place.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.5 }}
                className="mb-8"
              >
                <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/20 text-[11px] px-3 py-1 rounded-full font-medium">
                  Limited Time Offer (Apr 2026)
                </span>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
              >
                <Button
                  size="lg"
                  className="relative group bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:shadow-[0_0_50px_rgba(249,115,22,0.5)] text-base px-10 py-6 rounded-2xl transition-all duration-300 border-0"
                  onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Free Analysis
                  <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </Button>
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08] hover:border-white/20 text-white text-base px-10 py-6 rounded-2xl transition-all duration-300"
                  >
                    <Home className="w-5 h-5 mr-2" />
                    Go to Dashboard
                  </Button>
                </Link>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all"
                  onClick={() => setPricingOpen(true)}
                >
                  <Crown className="w-5 h-5 mr-2" />
                  Go Pro - $12/mo
                </Button>
              </motion.div>

              {/* Stats Grid - Glassmorphism */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {[
                  { value: "12", label: "AI Tools", delay: 0.8 },
                  { value: "3", label: "Tiers", delay: 0.9 },
                  { value: "24/7", label: "Monitoring", delay: 1.0 },
                  { value: "∞", label: "Enterprise", delay: 1.1 },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: stat.delay, duration: 0.5 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className="relative group p-5 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/[0.06] hover:border-orange-500/20 transition-all duration-500"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative">
                      <div className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-orange-400 to-amber-400 bg-clip-text text-transparent mb-1">{stat.value}</div>
                      <div className="text-sm text-white/30">{stat.label}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* FEATURE SHOWCASE - Glass Cards */}
        <div className="bg-[#0a0a0f] px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="container mx-auto pb-12"
          >
            <div className="grid md:grid-cols-3 gap-5 mb-16">
              {[
                { icon: Brain, title: "AI-Powered Insights", description: "Advanced algorithms analyze millions of data points to give you actionable insights", gradient: "from-violet-500 to-purple-600" },
                { icon: TrendingUp, title: "Predict Trends Early", description: "Detect emerging trends before they explode and stay ahead of the competition", gradient: "from-orange-500 to-amber-500" },
                { icon: Users, title: "Multi-Channel Management", description: "Manage unlimited channels with enterprise-grade analytics and automation", gradient: "from-emerald-500 to-teal-500" },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -6, scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="relative overflow-hidden p-7 bg-white/[0.02] backdrop-blur-sm border-white/[0.06] hover:border-white/[0.12] transition-all duration-500 rounded-2xl group h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:shadow-xl transition-shadow duration-500`}>
                        <feature.icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
                      <p className="text-white/35 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* CHROME EXTENSION - PROMINENT INSTALL SECTION */}
        <div className="bg-[#0a0a0f] px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="container mx-auto pb-12"
          >
            <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-[#0d1a14] to-[#0a0a0f]">
              {/* Glow effects */}
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-green-500/8 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black_20%,transparent_100%)]" />
              
              <div className="relative z-10 p-8 md:p-12 lg:p-16">
                <div className="flex flex-col lg:flex-row lg:items-center gap-10">
                  {/* Left content */}
                  <div className="flex-1 space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-sm font-medium text-emerald-300">Chrome Extension v1.0</span>
                    </div>
                    
                    <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight">
                      Boostify <span className="bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">YouTube Extension</span>
                    </h2>
                    
                    <p className="text-lg text-white/40 max-w-xl leading-relaxed">
                      Sincroniza tu canal en tiempo real, obtén SEO automático, alertas de tendencias 
                      y analíticas directamente dentro de YouTube Studio.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-3">
                      {[
                        { icon: Zap, text: "Auto-SEO" },
                        { icon: TrendingUp, text: "Sync en Vivo" },
                        { icon: Eye, text: "Analíticas In-Page" },
                        { icon: Target, text: "Optimización 24/7" },
                      ].map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-sm text-white/60">
                          <f.icon className="w-3.5 h-3.5 text-emerald-400" />
                          {f.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right - Install from Chrome Web Store */}
                  <div className="lg:w-[420px] space-y-5">
                    {/* Chrome Web Store button */}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        size="lg"
                        className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-bold text-lg px-8 py-7 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.4)] transition-all duration-300"
                        onClick={() => window.open(CHROME_WEBSTORE_URL, '_blank')}
                      >
                        <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 6.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM3.6 7.1L7.475 12 3.6 16.9A9.953 9.953 0 012 12c0-1.79.59-3.44 1.6-4.9zM12 2c2.136 0 4.1.67 5.72 1.81L13.838 9.5a5.48 5.48 0 00-3.676 0L6.28 3.81A9.95 9.95 0 0112 2zm5.72 18.19A9.95 9.95 0 0112 22a9.95 9.95 0 01-5.72-1.81L10.162 14.5a5.48 5.48 0 003.676 0l3.882 5.69z"/></svg>
                        Añadir a Chrome — Gratis
                      </Button>
                    </motion.div>
                    <p className="text-center text-white/30 text-xs">
                      Instalación directa desde Chrome Web Store · 1 clic
                    </p>

                    {/* Benefits */}
                    <div className="space-y-3">
                      {[
                        { icon: CheckCircle, text: "Instalación con 1 clic desde Chrome Web Store", color: "text-emerald-400" },
                        { icon: RefreshCw, text: "Actualizaciones automáticas incluidas", color: "text-blue-400" },
                        { icon: Zap, text: "Auto-SEO y alertas de tendencias", color: "text-violet-400" },
                        { icon: Eye, text: "Analíticas en vivo dentro de YouTube", color: "text-amber-400" },
                      ].map((s, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <s.icon className={`w-5 h-5 shrink-0 ${s.color}`} />
                          <span className="text-sm text-white/50">{s.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* TOOLS SECTION */}
        <div className="bg-[#0a0a0f] px-4 md:px-8">
          <motion.div
            id="tools"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="container mx-auto"
          ></motion.div>

          <div className="container mx-auto">
            {/* Artist Selector - Glassmorphism */}
            <div className="mb-8 p-5 rounded-2xl bg-white/[0.02] backdrop-blur-lg border border-white/[0.06]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <SiYoutube className="w-5 h-5 text-orange-400" />
                    Promocionar YouTube
                  </h3>
                  <p className="text-sm text-white/30">
                    Los datos se sincronizarán con el perfil del artista seleccionado
                  </p>
                </div>
                <ArtistSelector 
                  label="Artista"
                  onArtistChange={() => {
                    // Reset results when artist changes
                    setPreLaunchResult(null);
                    setTitleResult(null);
                    setVideoIdeas([]);
                    setGeneratedKeywords([]);
                  }}
                />
              </div>
            </div>

            {/* Subscription Banner */}
            <YouTubeSubscriptionBanner onUpgrade={() => setPricingOpen(true)} />

            <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-8">
              {/* Chrome Extension Banner - Refined */}
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600/80 via-green-600/80 to-teal-600/80 border border-white/10 px-6 py-4 backdrop-blur-xl">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:30px_30px]" />
                  <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/10">
                        <Plug className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm">
                          🚀 Boostify Chrome Extension disponible
                        </p>
                        <p className="text-green-100/70 text-xs truncate">
                          Sincroniza YouTube en tiempo real · SEO automático · Análisis en vivo
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => window.open(CHROME_WEBSTORE_URL, '_blank')}
                        className="flex items-center gap-1.5 bg-white text-green-700 hover:bg-green-50 font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] duration-300"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Añadir a Chrome
                      </button>
                      <button
                        onClick={() => setActiveTab('extension')}
                        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-all backdrop-blur-sm border border-white/10 duration-300"
                      >
                        Conectar →
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Tab Navigation - Modern Pill Design */}
              <div className="p-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
                <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1.5 h-auto bg-transparent p-1">
                  {/* PHASE 1 - CREATOR */}
                  <TabsTrigger value="pre-launch" data-testid="tab-pre-launch" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Target className="w-4 h-4 mr-1.5" />
                    Pre-Launch
                  </TabsTrigger>
                  <TabsTrigger value="keywords" data-testid="tab-keywords" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Key className="w-4 h-4 mr-1.5" />
                    Keywords
                  </TabsTrigger>
                  <TabsTrigger value="title" data-testid="tab-title" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <FileText className="w-4 h-4 mr-1.5" />
                    Title
                  </TabsTrigger>
                  <TabsTrigger value="content" data-testid="tab-content" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Lightbulb className="w-4 h-4 mr-1.5" />
                    Ideas
                  </TabsTrigger>
                  
                  {/* PHASE 2 - PRO */}
                  <TabsTrigger value="thumbnail" data-testid="tab-thumbnail" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Image className="w-4 h-4 mr-1.5" />
                    Thumbnail
                  </TabsTrigger>
                  <TabsTrigger value="competitor" data-testid="tab-competitor" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Search className="w-4 h-4 mr-1.5" />
                    Competitor
                  </TabsTrigger>
                  <TabsTrigger value="trends" data-testid="tab-trends" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <TrendingUp className="w-4 h-4 mr-1.5" />
                    Trends
                  </TabsTrigger>
                  <TabsTrigger value="transcript" data-testid="tab-transcript" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Scissors className="w-4 h-4 mr-1.5" />
                    Shorts
                  </TabsTrigger>

                  {/* PHASE 3 - ENTERPRISE */}
                  <TabsTrigger value="channels" data-testid="tab-channels" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Users className="w-4 h-4 mr-1.5" />
                    Channels
                  </TabsTrigger>
                  <TabsTrigger value="calendar" data-testid="tab-calendar" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    Calendar
                  </TabsTrigger>
                  <TabsTrigger value="optimization" data-testid="tab-optimization" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Gauge className="w-4 h-4 mr-1.5" />
                    Optimize
                  </TabsTrigger>
                  <TabsTrigger value="api" data-testid="tab-api" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Code className="w-4 h-4 mr-1.5" />
                    API
                  </TabsTrigger>
                  <TabsTrigger value="extension" data-testid="tab-extension" className="rounded-xl py-2.5 text-white/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all duration-300 hover:text-white/60 hover:bg-white/[0.04]">
                    <Plug className="w-4 h-4 mr-1.5" />
                    Extension
                  </TabsTrigger>
                </TabsList>
              </div>

            {/* PRE-LAUNCH SCORE TAB - BASIC */}
            <TabsContent value="pre-launch">
              <PlanTierGuard 
                requiredPlan="basic" 
                userSubscription={userSubscription} 
                featureName="Pre-Launch Success Predictor"
                isAdmin={isAdmin}
              >
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-2xl border border-orange-500/10">
                    <Target className="h-8 w-8 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Pre-Launch Success Predictor</h3>
                    <p className="text-white/35">
                      Predict video success before publishing with Boostify AI
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Video Title *</label>
                    <Input
                      data-testid="input-pre-launch-title"
                      placeholder="Enter your video title..."
                      value={preLaunchTitle}
                      onChange={(e) => setPreLaunchTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Niche/Category *</label>
                    <Input
                      data-testid="input-pre-launch-niche"
                      placeholder="e.g., Gaming, Tech Reviews, Cooking..."
                      value={preLaunchNiche}
                      onChange={(e) => setPreLaunchNiche(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Description (Optional)</label>
                    <Textarea
                      data-testid="input-pre-launch-description"
                      placeholder="Brief description of your video..."
                      value={preLaunchDescription}
                      onChange={(e) => setPreLaunchDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Keywords (Optional)</label>
                    <Input
                      data-testid="input-pre-launch-keywords"
                      placeholder="keyword1, keyword2, keyword3..."
                      value={preLaunchKeywords}
                      onChange={(e) => setPreLaunchKeywords(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-analyze-pre-launch"
                    onClick={handlePreLaunchScore}
                    disabled={preLaunchLoading || !preLaunchTitle || !preLaunchNiche}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_0_25px_rgba(249,115,22,0.25)] hover:shadow-[0_0_35px_rgba(249,115,22,0.4)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {preLaunchLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing with Boostify AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Analyze Video Concept
                      </>
                    )}
                  </Button>
                </div>

                {preLaunchResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 mt-6 p-6 border border-white/[0.06] rounded-2xl bg-white/[0.02] backdrop-blur-sm"
                  >
                    <div className="text-center">
                      <h4 className="text-lg font-semibold mb-2 text-white">Success Score</h4>
                      <div className={`text-6xl font-bold ${getScoreColor(preLaunchResult.score)}`}>
                        {preLaunchResult.score}/100
                      </div>
                      <p className="text-white/35 mt-2">{preLaunchResult.prediction}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Strengths
                        </h5>
                        <ul className="space-y-1">
                          {preLaunchResult.strengths.map((strength, idx) => (
                            <li key={idx} className="text-sm text-white/35 flex items-start gap-2">
                              <span className="text-green-500 mt-0.5">•</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-semibold mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          Weaknesses
                        </h5>
                        <ul className="space-y-1">
                          {preLaunchResult.weaknesses.map((weakness, idx) => (
                            <li key={idx} className="text-sm text-white/35 flex items-start gap-2">
                              <span className="text-yellow-500 mt-0.5">•</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-semibold mb-2">Recommendations</h5>
                      <div className="space-y-2">
                        {preLaunchResult.recommendations.map((rec, idx) => (
                          <div key={idx} className="p-3 bg-orange-500/[0.05] border border-orange-500/10 rounded-xl text-sm">
                            <span className="text-orange-400 font-semibold mr-2">{idx + 1}.</span>
                            {rec}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-white/[0.06]">
                      <div className="text-center p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                        <p className="text-sm text-white/35 mb-1">Estimated Views (7 days)</p>
                        <p className="text-2xl font-bold text-orange-400">
                          {preLaunchResult.estimatedViews['7days'].toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                        <p className="text-sm text-white/35 mb-1">Estimated Views (30 days)</p>
                        <p className="text-2xl font-bold text-orange-400">
                          {preLaunchResult.estimatedViews['30days'].toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
                </div>
                </motion.div>
              </PlanTierGuard>
            </TabsContent>

            {/* KEYWORDS GENERATOR TAB - BASIC */}
            <TabsContent value="keywords">
              <PlanTierGuard 
                requiredPlan="basic" 
                userSubscription={userSubscription} 
                featureName="AI Keywords Generator"
                isAdmin={isAdmin}
              >
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-2xl border border-orange-500/10">
                    <Key className="h-8 w-8 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">AI Keywords Generator</h3>
                    <p className="text-white/35">
                      Discover optimized keywords based on trending YouTube data
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Topic *</label>
                    <Input
                      data-testid="input-keyword-topic"
                      placeholder="What is your video about?"
                      value={keywordTopic}
                      onChange={(e) => setKeywordTopic(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Niche (Optional)</label>
                    <Input
                      data-testid="input-keyword-niche"
                      placeholder="e.g., Tech, Gaming, Lifestyle..."
                      value={keywordNiche}
                      onChange={(e) => setKeywordNiche(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-generate-keywords"
                    onClick={handleGenerateKeywords}
                    disabled={keywordsLoading || !keywordTopic}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_0_25px_rgba(249,115,22,0.25)] hover:shadow-[0_0_35px_rgba(249,115,22,0.4)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {keywordsLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating Keywords with AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate Keywords
                      </>
                    )}
                  </Button>
                </div>

                {generatedKeywords.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <h4 className="font-semibold mb-4">Optimized Keywords ({generatedKeywords.length})</h4>
                      <div className="space-y-2">
                        {generatedKeywords.map((kw, idx) => (
                          <div key={idx} className="p-4 border border-white/[0.06] rounded-2xl hover:bg-white/[0.04] transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="font-medium text-white">{kw.keyword}</span>
                                  <Badge className={getDifficultyColor(kw.difficulty)}>
                                    {kw.difficulty}
                                  </Badge>
                                  <Badge variant="outline">{kw.competition} competition</Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-white/35">
                                  <span>Relevance: {kw.relevance}/10</span>
                                  <span>~{kw.estimatedSearches.toLocaleString()} searches/month</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(kw.keyword)}
                                data-testid={`button-copy-keyword-${idx}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {trendingTags.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-4">Trending Tags in Niche</h4>
                        <div className="flex flex-wrap gap-2">
                          {trendingTags.map((tag, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="cursor-pointer hover:bg-orange-500/20"
                              onClick={() => copyToClipboard(tag)}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                </div>
                </motion.div>
              </PlanTierGuard>
            </TabsContent>

            {/* TITLE ANALYZER TAB - BASIC */}
            <TabsContent value="title">
              <PlanTierGuard 
                requiredPlan="basic" 
                userSubscription={userSubscription} 
                featureName="Title Analyzer"
                isAdmin={isAdmin}
              >
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-2xl border border-orange-500/10">
                    <FileText className="h-8 w-8 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Title Analyzer</h3>
                    <p className="text-white/35">
                      Optimize your video title for maximum clicks and SEO
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Video Title *</label>
                    <Input
                      data-testid="input-title-analyze"
                      placeholder="Enter your video title..."
                      value={titleToAnalyze}
                      onChange={(e) => setTitleToAnalyze(e.target.value)}
                    />
                    <p className="text-xs text-white/30 mt-1">
                      {titleToAnalyze.length} characters (ideal: 50-70)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Niche (Optional)</label>
                    <Input
                      data-testid="input-title-niche"
                      placeholder="e.g., Gaming, Tech, Cooking..."
                      value={titleNiche}
                      onChange={(e) => setTitleNiche(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-analyze-title"
                    onClick={handleAnalyzeTitle}
                    disabled={titleLoading || !titleToAnalyze}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_0_25px_rgba(249,115,22,0.25)] hover:shadow-[0_0_35px_rgba(249,115,22,0.4)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {titleLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing Title...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Analyze Title
                      </>
                    )}
                  </Button>
                </div>

                {titleResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="text-center p-4 border border-white/[0.06] rounded-2xl bg-white/[0.02]">
                        <p className="text-sm text-white/35 mb-1">Overall Score</p>
                        <p className={`text-3xl font-bold ${getScoreColor(titleResult.score)}`}>
                          {titleResult.score}
                        </p>
                      </div>
                      <div className="text-center p-4 border border-white/[0.06] rounded-2xl bg-white/[0.02]">
                        <p className="text-sm text-white/35 mb-1">CTR Score</p>
                        <p className={`text-3xl font-bold ${getScoreColor(titleResult.ctrScore)}`}>
                          {titleResult.ctrScore}
                        </p>
                      </div>
                      <div className="text-center p-4 border border-white/[0.06] rounded-2xl bg-white/[0.02]">
                        <p className="text-sm text-white/35 mb-1">SEO Score</p>
                        <p className={`text-3xl font-bold ${getScoreColor(titleResult.seoScore)}`}>
                          {titleResult.seoScore}
                        </p>
                      </div>
                      <div className="text-center p-4 border border-white/[0.06] rounded-2xl bg-white/[0.02]">
                        <p className="text-sm text-white/35 mb-1">Emotional</p>
                        <p className={`text-3xl font-bold ${getScoreColor(titleResult.emotionalScore)}`}>
                          {titleResult.emotionalScore}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold mb-2 text-green-500">What Works</h5>
                        <ul className="space-y-1">
                          {titleResult.strengths.map((str, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              {str}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-semibold mb-2 text-yellow-500">Needs Improvement</h5>
                        <ul className="space-y-1">
                          {titleResult.issues.map((issue, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-semibold mb-2">Suggestions</h5>
                      <div className="space-y-2">
                        {titleResult.suggestions.map((sug, idx) => (
                          <div key={idx} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm">
                            {sug}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-semibold mb-2">Alternative Titles</h5>
                      <div className="space-y-2">
                        {titleResult.improvedTitles.map((title, idx) => (
                          <div key={idx} className="p-4 border border-white/[0.06] rounded-2xl hover:bg-white/[0.04] transition-colors">
                            <div className="flex items-center justify-between">
                              <span className="flex-1 text-white">{title}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(title)}
                                data-testid={`button-copy-title-${idx}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                </div>
              </motion.div>
              </PlanTierGuard>
            </TabsContent>

            {/* CONTENT IDEAS TAB - BASIC */}
            <TabsContent value="content">
              <PlanTierGuard 
                requiredPlan="basic" 
                userSubscription={userSubscription} 
                featureName="Content Ideas Generator"
                isAdmin={isAdmin}
              >
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-2xl border border-orange-500/10">
                    <Lightbulb className="h-8 w-8 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Content Ideas Generator</h3>
                    <p className="text-white/35">
                      Discover untapped video opportunities in your niche
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Niche *</label>
                    <Input
                      data-testid="input-content-niche"
                      placeholder="e.g., Tech Tutorials, Cooking, Fitness..."
                      value={contentNiche}
                      onChange={(e) => setContentNiche(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Number of Ideas</label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={contentIdeasCount}
                      onChange={(e) => setContentIdeasCount(parseInt(e.target.value) || 5)}
                    />
                  </div>
                  <Button
                    data-testid="button-generate-content-ideas"
                    onClick={handleGenerateContentIdeas}
                    disabled={contentLoading || !contentNiche}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_0_25px_rgba(249,115,22,0.25)] hover:shadow-[0_0_35px_rgba(249,115,22,0.4)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {contentLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing Content Gaps...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate Video Ideas
                      </>
                    )}
                  </Button>
                </div>

                {videoIdeas.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {contentGaps.length > 0 && (
                      <div className="p-4 bg-amber-500/[0.05] border border-amber-500/15 rounded-2xl">
                        <h5 className="font-semibold mb-2 text-amber-400">Content Gaps Discovered</h5>
                        <div className="space-y-1">
                          {contentGaps.map((gap, idx) => (
                            <p key={idx} className="text-sm">• {gap}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {trendingSubtopics.length > 0 && (
                      <div>
                        <h5 className="font-semibold mb-2">Trending Subtopics</h5>
                        <div className="flex flex-wrap gap-2">
                          {trendingSubtopics.map((topic, idx) => (
                            <Badge key={idx} variant="secondary">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h5 className="font-semibold mb-4">Video Ideas ({videoIdeas.length})</h5>
                      <div className="space-y-4">
                        {videoIdeas.map((idea, idx) => (
                          <div key={idx} className="p-6 border border-white/[0.06] rounded-2xl hover:bg-white/[0.04] transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <h6 className="font-semibold text-lg flex-1 text-white">{idea.title}</h6>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(idea.title)}
                                data-testid={`button-copy-idea-${idx}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-white/35 mb-4">{idea.description}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              <Badge className={getDifficultyColor(idea.difficulty)}>
                                {idea.difficulty}
                              </Badge>
                              <Badge variant="outline">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                ~{idea.estimatedViews.toLocaleString()} views
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <p className="text-white/35 mb-1">
                                <span className="font-medium text-white/50">Target Audience:</span> {idea.targetAudience}
                              </p>
                              <p className="text-white/35 mb-2">
                                <span className="font-medium text-white/50">Opening Hook:</span> "{idea.hook}"
                              </p>
                              <p className="font-medium mb-1">Keywords:</p>
                              <div className="flex flex-wrap gap-1">
                                {idea.keywords.map((kw, kidx) => (
                                  <Badge key={kidx} variant="secondary" className="text-xs">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              </motion.div>
              </PlanTierGuard>
            </TabsContent>

            {/* PHASE 2 - THUMBNAIL GENERATOR TAB */}
            <TabsContent value="thumbnail">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-pink-500/20 to-rose-500/10 rounded-2xl border border-pink-500/10">
                    <Image className="h-8 w-8 text-pink-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">AI Thumbnail Generator</h3>
                    <p className="text-white/35">Generate eye-catching thumbnails with Boostify AI — PRO Feature</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Video Title *</label>
                    <Input
                      placeholder="Enter your video title..."
                      value={thumbnailTitle}
                      onChange={(e) => setThumbnailTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Niche *</label>
                    <Input
                      placeholder="e.g., Gaming, Tech, Cooking..."
                      value={thumbnailNiche}
                      onChange={(e) => setThumbnailNiche(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Style</label>
                    <select
                      className="w-full p-3 rounded-xl border border-white/[0.08] bg-white/[0.05] text-white"
                      value={thumbnailStyle}
                      onChange={(e) => setThumbnailStyle(e.target.value)}
                    >
                      <option value="modern">Modern</option>
                      <option value="dramatic">Dramatic</option>
                      <option value="minimalist">Minimalist</option>
                      <option value="colorful">Colorful</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleGenerateThumbnails}
                    disabled={thumbnailLoading}
                    className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-[0_0_25px_rgba(236,72,153,0.25)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {thumbnailLoading ? <Loader2 className="animate-spin mr-2" /> : <Image className="mr-2" />}
                    Generate Thumbnails
                  </Button>
                </div>

                {thumbnails.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h4 className="text-lg font-semibold mb-4">Generated Thumbnails ({thumbnails.length})</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      {thumbnails.map((thumb, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                          <img src={thumb.imageUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-48 object-cover rounded-xl mb-3" />
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">CTR Score:</span>
                              <span className={getScoreColor(thumb.ctrScore)}>{thumb.ctrScore}/100</span>
                            </div>
                            <p className="text-sm text-white"><strong>Text:</strong> {thumb.suggestedText}</p>
                            <p className="text-sm text-white/35">{thumb.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
              </motion.div>
            </TabsContent>

            {/* PHASE 2 - COMPETITOR ANALYSIS TAB */}
            <TabsContent value="competitor">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-2xl border border-blue-500/10">
                    <Search className="h-8 w-8 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Competitor Deep Analysis</h3>
                    <p className="text-white/35">Analyze competitor strategy — PRO Feature</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Competitor Channel Name *</label>
                    <Input
                      placeholder="e.g., MrBeast, PewDiePie..."
                      value={competitorChannel}
                      onChange={(e) => setCompetitorChannel(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleCompetitorAnalysis}
                    disabled={competitorLoading}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-[0_0_25px_rgba(59,130,246,0.25)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {competitorLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Search className="mr-2 h-5 w-5" />}
                    Analyze Competitor
                  </Button>
                </div>

                {competitorData && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                          <p className="text-white/35 text-sm">Avg Views</p>
                          <p className="text-2xl font-bold text-blue-400">{competitorData.avgViews.toLocaleString()}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                          <p className="text-white/35 text-sm">Upload Frequency</p>
                          <p className="text-2xl font-bold text-white">{competitorData.uploadFrequency}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                          <p className="text-white/35 text-sm">Best Time</p>
                          <p className="text-2xl font-bold text-white">{competitorData.bestUploadTime}</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Top Topics</h4>
                        <div className="flex flex-wrap gap-2">
                          {competitorData.topPerformingTopics.map((topic, idx) => (
                            <Badge key={idx} variant="secondary">{topic}</Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Content Gaps (Your Opportunities)</h4>
                        <ul className="space-y-2">
                          {competitorData.contentGaps.map((gap, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Lightbulb className="w-4 h-4 text-blue-400 mt-1" />
                              <span>{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Strategic Insights</h4>
                        <ul className="space-y-2">
                          {competitorData.insights.map((insight, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              </motion.div>
            </TabsContent>

            {/* PHASE 2 - TREND PREDICTOR TAB */}
            <TabsContent value="trends">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl border border-emerald-500/10">
                    <TrendingUp className="h-8 w-8 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Trend Predictor</h3>
                    <p className="text-white/35">Detect trends BEFORE they explode — PRO Feature</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Your Niche *</label>
                    <Input
                      placeholder="e.g., Gaming, Tech, Fitness..."
                      value={trendNiche}
                      onChange={(e) => setTrendNiche(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handlePredictTrends}
                    disabled={trendsLoading}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-[0_0_25px_rgba(16,185,129,0.25)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {trendsLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <TrendingUp className="mr-2 h-5 w-5" />}
                    Predict Trends
                  </Button>
                </div>

                {trends.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h4 className="text-lg font-semibold mb-4">Emerging Trends ({trends.length})</h4>
                    <div className="space-y-4">
                      {trends.map((trend, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h5 className="font-semibold text-lg text-white">{trend.topic}</h5>
                              <p className="text-sm text-white/35 mt-1">{trend.reason}</p>
                            </div>
                            <Badge className={trend.urgency === 'high' ? 'bg-red-500' : trend.urgency === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}>
                              {trend.urgency} urgency
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-sm text-white/35">Confidence</p>
                              <p className="font-semibold text-emerald-400">{trend.confidence}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-white/35">Time to Act</p>
                              <p className="font-semibold text-white">{trend.timeToAct}</p>
                            </div>
                            <div>
                              <p className="text-sm text-white/35">Competition</p>
                              <Badge variant="outline">{trend.competitionLevel}</Badge>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-2">Rising Keywords:</p>
                            <div className="flex flex-wrap gap-2">
                              {trend.risingKeywords.map((kw, kidx) => (
                                <Badge key={kidx} variant="secondary">{kw}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
              </motion.div>
            </TabsContent>

            {/* PHASE 2 - TRANSCRIPT EXTRACTOR TAB */}
            <TabsContent value="transcript">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-violet-500/20 to-purple-500/10 rounded-2xl border border-violet-500/10">
                    <Scissors className="h-8 w-8 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Shorts Clip Extractor</h3>
                    <p className="text-white/35">Find viral moments for Shorts — PRO Feature</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Video URL *</label>
                    <Input
                      placeholder="https://youtube.com/watch?v=..."
                      value={transcriptUrl}
                      onChange={(e) => setTranscriptUrl(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleExtractTranscript}
                    disabled={transcriptLoading}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-[0_0_25px_rgba(139,92,246,0.25)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {transcriptLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Scissors className="mr-2 h-5 w-5" />}
                    Extract Shorts Clips
                  </Button>
                </div>

                {shortClips.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h4 className="text-lg font-semibold mb-4">Viral Shorts Opportunities ({shortClips.length})</h4>
                    <div className="space-y-4">
                      {shortClips.map((clip, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h5 className="font-semibold text-white">{clip.suggestedTitle}</h5>
                              <p className="text-sm text-white/35">
                                {clip.startTime} - {clip.endTime} ({clip.duration}s)
                              </p>
                            </div>
                            <Badge className={clip.viralScore >= 80 ? 'bg-green-500' : clip.viralScore >= 60 ? 'bg-yellow-500' : 'bg-gray-500'}>
                              {clip.viralScore}% viral
                            </Badge>
                          </div>
                          <p className="text-sm mb-3 text-white"><strong>Hook:</strong> "{clip.hook}"</p>
                          <p className="text-sm text-white/35 mb-3">{clip.reason}</p>
                          <div className="flex flex-wrap gap-1">
                            {clip.tags.map((tag, tidx) => (
                              <Badge key={tidx} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
              </motion.div>
            </TabsContent>

            {/* PHASE 3 - MULTI-CHANNEL TRACKING TAB */}
            <TabsContent value="channels">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-violet-500/20 to-indigo-500/10 rounded-2xl border border-violet-500/10">
                    <Users className="h-8 w-8 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Multi-Channel Tracking</h3>
                    <p className="text-white/35">Manage multiple channels — ENTERPRISE Feature</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white/60">Channel Name *</label>
                      <Input
                        placeholder="e.g., Tech Channel"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white/60">Channel URL *</label>
                      <Input
                        placeholder="https://youtube.com/@channel"
                        value={newChannelUrl}
                        onChange={(e) => setNewChannelUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddChannel}
                    disabled={channelsLoading}
                    className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white shadow-[0_0_25px_rgba(139,92,246,0.25)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {channelsLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Users className="mr-2 h-5 w-5" />}
                    Add Channel
                  </Button>
                </div>

                <div className="space-y-4">
                  <Button onClick={loadTrackedChannels} variant="outline" className="w-full border-white/[0.1] hover:bg-white/[0.05]">
                    <Eye className="mr-2 w-4 h-4" />
                    Load Tracked Channels
                  </Button>
                  {trackedChannels.length > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {trackedChannels.map((channel) => (
                        <div key={channel.id} className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                          <h5 className="font-semibold mb-2 text-white">{channel.channelName}</h5>
                          <div className="space-y-1 text-sm text-white/35">
                            <p>Videos: {channel.metrics?.totalVideos || 0}</p>
                            <p>Views: {(channel.metrics?.totalViews || 0).toLocaleString()}</p>
                            <p>Subscribers: {(channel.metrics?.subscribers || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </motion.div>
            </TabsContent>

            {/* PHASE 3 - CONTENT CALENDAR TAB */}
            <TabsContent value="calendar">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-violet-500/20 to-purple-500/10 rounded-2xl border border-violet-500/10">
                    <Calendar className="h-8 w-8 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">AI Content Calendar</h3>
                    <p className="text-white/35">Generate 30-day plan — ENTERPRISE Feature</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Niche *</label>
                    <Input
                      placeholder="e.g., Tech Reviews"
                      value={calendarNiche}
                      onChange={(e) => setCalendarNiche(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Goals (Optional)</label>
                    <Textarea
                      placeholder="e.g., Grow to 100k subs, increase engagement..."
                      value={calendarGoals}
                      onChange={(e) => setCalendarGoals(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Videos per Week</label>
                    <Input
                      type="number"
                      min="1"
                      max="7"
                      value={videosPerWeek}
                      onChange={(e) => setVideosPerWeek(parseInt(e.target.value))}
                    />
                  </div>
                  <Button
                    onClick={handleGenerateCalendar}
                    disabled={calendarLoading}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-[0_0_25px_rgba(139,92,246,0.25)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {calendarLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Calendar className="mr-2 h-5 w-5" />}
                    Generate Calendar
                  </Button>
                </div>

                {calendarWeeks.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h4 className="text-lg font-semibold mb-4">Your 30-Day Plan</h4>
                    <div className="space-y-6">
                      {calendarWeeks.map((week) => (
                        <div key={week.weekNumber} className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                          <h5 className="font-semibold mb-3 text-white">Week {week.weekNumber}</h5>
                          <div className="space-y-3">
                            {week.videos.map((video, idx) => (
                              <div key={idx} className="border-l-4 border-violet-500 pl-4">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-medium text-white">{video.title}</p>
                                  <Badge variant="outline">{video.day}</Badge>
                                </div>
                                <p className="text-sm text-white/35 mb-2">{video.description}</p>
                                <div className="flex flex-wrap gap-2 text-xs text-white/30">
                                  <span>📅 {video.uploadTime}</span>
                                  <span>👁️ ~{video.estimatedViews.toLocaleString()} views</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
              </motion.div>
            </TabsContent>

            {/* PHASE 3 - AUTO-OPTIMIZATION TAB */}
            <TabsContent value="optimization">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-violet-500/20 to-purple-500/10 rounded-2xl border border-violet-500/10">
                    <Gauge className="h-8 w-8 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Auto-Optimization Engine</h3>
                    <p className="text-white/35">24/7 Performance Monitoring — ENTERPRISE Feature</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/60">Video URL *</label>
                    <Input
                      placeholder="https://youtube.com/watch?v=..."
                      value={optVideoUrl}
                      onChange={(e) => setOptVideoUrl(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleCheckOptimization}
                    disabled={optLoading}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-[0_0_25px_rgba(139,92,246,0.25)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {optLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Gauge className="mr-2 h-5 w-5" />}
                    Check Performance
                  </Button>
                </div>

                {optResult && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 to-violet-500/[0.03] border-violet-500/15">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-white/35">Performance Score</p>
                            <p className="text-4xl font-bold text-violet-400">{optResult.performanceScore}/100</p>
                          </div>
                          <Badge className={optResult.status === 'exceeding' ? 'bg-green-500' : optResult.status === 'on-track' ? 'bg-blue-500' : 'bg-red-500'}>
                            {optResult.status}
                          </Badge>
                        </div>
                      </div>

                      {optResult.criticalIssues && optResult.criticalIssues.length > 0 && (
                        <div>
                          <h5 className="font-semibold mb-2 text-red-500">Critical Issues</h5>
                          <ul className="space-y-1">
                            {optResult.criticalIssues.map((issue: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500 mt-1" />
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {optResult.optimizations && optResult.optimizations.length > 0 && (
                        <div>
                          <h5 className="font-semibold mb-3">Optimization Actions</h5>
                          <div className="space-y-3">
                            {optResult.optimizations.map((opt: OptimizationAction, idx: number) => (
                              <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                                <div className="flex items-start justify-between mb-2">
                                  <p className="font-medium text-white">{opt.action}</p>
                                  <div className="flex gap-2">
                                    <Badge variant={opt.impact === 'high' ? 'default' : 'outline'}>{opt.impact} impact</Badge>
                                    <Badge variant="secondary">{opt.urgency}</Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-white/35">{opt.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {optResult.predictedImprovement && (
                        <div className="p-4 rounded-2xl bg-green-500/[0.05] border-green-500/15">
                          <p className="text-sm text-white/35">Predicted Improvement</p>
                          <p className="text-xl font-bold text-green-400">{optResult.predictedImprovement}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
              </motion.div>
            </TabsContent>

            {/* PHASE 3 - API ACCESS TAB */}
            <TabsContent value="api">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="p-8 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="p-4 bg-gradient-to-br from-violet-500/20 to-purple-500/10 rounded-2xl border border-violet-500/10">
                    <Code className="h-8 w-8 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">API Access</h3>
                    <p className="text-white/35">External Integration — ENTERPRISE Feature</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <Button
                    onClick={handleGenerateApiKey}
                    disabled={apiLoading}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-[0_0_25px_rgba(139,92,246,0.25)] rounded-xl py-6 text-base font-semibold transition-all duration-300"
                  >
                    {apiLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Code className="mr-2 h-5 w-5" />}
                    Generate New API Key
                  </Button>
                  <Button onClick={loadApiKeys} variant="outline" className="w-full border-white/[0.1] hover:bg-white/[0.05]">
                    <Eye className="mr-2 w-4 h-4" />
                    Load My API Keys
                  </Button>
                </div>

                {apiKeys.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h4 className="text-lg font-semibold mb-4">Your API Keys ({apiKeys.length})</h4>
                    <div className="space-y-3">
                      {apiKeys.map((key) => (
                        <div key={key.id} className="p-4 rounded-2xl bg-white/[0.02] border-white/[0.06]">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-mono bg-white/[0.05] border border-white/[0.08] px-3 py-1 rounded-lg text-white/70">{key.apiKey.substring(0, 40)}...</p>
                            <Button size="sm" variant="outline" className="border-white/[0.1]" onClick={() => copyToClipboard(key.apiKey)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between text-sm text-white/35">
                            <span>Usage: {key.usageCount.toLocaleString()} / {key.rateLimit.toLocaleString()}</span>
                            <Badge variant={key.isActive ? 'default' : 'secondary'}>
                              {key.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                      <h5 className="font-semibold mb-2 text-white">API Documentation</h5>
                      <p className="text-sm text-white/35 mb-3">
                        Include your API key in the Authorization header:
                      </p>
                      <pre className="bg-black/30 border border-white/[0.06] p-3 rounded-xl text-xs overflow-x-auto text-white/70">
{`curl -X POST https://boostify.com/api/youtube/pre-launch-score \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "My Video", "niche": "Gaming"}'`}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </div>
              </motion.div>
            </TabsContent>

            {/* EXTENSION SYNC TAB */}
            <TabsContent value="extension">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <ExtensionSyncTab />
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
        </div>

        {/* SERVICES WITHOUT SUBSCRIPTION - ALWAYS VISIBLE */}
        <div className="container mx-auto py-16 border-t border-white/[0.06]">
          <div className="mb-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-8"
            >
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                  Growth Tools Suite
                </h2>
              </div>
              <p className="text-lg text-white/40 max-w-2xl mx-auto">
                Everything you need to dominate YouTube, from pre-launch analysis to enterprise automation.
              </p>
            </motion.div>
            <ExtraServicesSection
              category="youtube_boost"
              title="YouTube Boost Services"
              description="Expert services to grow your YouTube channel, from SEO optimization to viral promotion strategies"
            />
          </div>
        </div>
      </main>

      <YoutubePricing open={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* Admin Diagnostic Panel */}
      {isAdmin && <PageDiagnosticPanel pageId="youtube-boost" />}
    </div>
  );
}
