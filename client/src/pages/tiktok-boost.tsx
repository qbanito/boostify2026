import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useArtistProfile } from "../hooks/use-artist-profile";
import { ArtistSelector } from "../components/promotion/artist-selector";
import { useToast } from "../hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { SiTiktok } from "react-icons/si";
import {
  Brain, Sparkles, TrendingUp, BarChart2, Music2,
  Rocket, Crown, HelpCircle, Zap, Video,
  Scissors, Hash, Clock, Target, Wand2,
  Copy, CheckCircle, Loader2, Play, Eye,
  ThumbsUp, MessageSquare, Share2, Star,
  Lightbulb, RefreshCw, ArrowRight, Download,
  Flame, Users, Calendar, FileText, Link2, Send,
  UserCheck, ExternalLink, Heart, MessageCircle, Globe
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────
interface ReelScript {
  hook: string;
  scenes: { timestamp: string; visual: string; text: string; audio: string }[];
  caption: string;
  hashtags: string[];
  music: string;
  duration: string;
  viralScore: number;
}

interface TrendAnalysis {
  trend: string;
  category: string;
  velocity: "rising" | "peaked" | "declining";
  confidence: number;
  hashtags: string[];
  suggestedAngles: string[];
  bestPostTime: string;
  estimatedReach: string;
}

interface CaptionResult {
  caption: string;
  hashtags: string[];
  hook: string;
  cta: string;
  style: string;
  engagementScore: number;
}

interface ContentCalendarDay {
  day: string;
  time: string;
  concept: string;
  hook: string;
  sound: string;
  hashtags: string[];
  format: string;
  estimatedViews: string;
}

interface ViralAnalysis {
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  optimalLength: string;
  bestPostTimes: string[];
  hashtagStrategy: string[];
  soundRecommendation: string;
  estimatedReach: { min: number; max: number };
}

// ─── TikTok Brand Colors ────────────────────────────────
const TK = {
  primary: "#00f2ea",   // cyan
  secondary: "#ff0050", // red-pink
  dark: "#010101",
  gradient: "from-[#00f2ea] via-[#ff0050] to-[#7c3aed]",
  gradientSoft: "from-[#00f2ea]/10 via-[#ff0050]/10 to-[#7c3aed]/10",
};

export default function TikTokBoostPage() {
  const { user, isAdmin, userSubscription } = useAuth();
  const { selectedArtist } = useArtistProfile();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("account");
  const [copied, setCopied] = useState<string | null>(null);

  // ─── Reel Script Creator State ─────────────────────────
  const [reelTopic, setReelTopic] = useState("");
  const [reelStyle, setReelStyle] = useState("trending");
  const [reelDuration, setReelDuration] = useState("30");
  const [reelLoading, setReelLoading] = useState(false);
  const [reelResult, setReelResult] = useState<ReelScript | null>(null);

  // ─── Trend Scanner State ──────────────────────────────
  const [trendNiche, setTrendNiche] = useState("");
  const [trendLoading, setTrendLoading] = useState(false);
  const [trends, setTrends] = useState<TrendAnalysis[]>([]);

  // ─── Caption & Hashtag Generator State ─────────────────
  const [captionTopic, setCaptionTopic] = useState("");
  const [captionStyle, setCaptionStyle] = useState("engaging");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captions, setCaptions] = useState<CaptionResult[]>([]);

  // ─── Content Calendar State ───────────────────────────
  const [calendarNiche, setCalendarNiche] = useState("");
  const [calendarDays, setCalendarDays] = useState("7");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendar, setCalendar] = useState<ContentCalendarDay[]>([]);

  // ─── Viral Score Analyzer State ───────────────────────
  const [viralDescription, setViralDescription] = useState("");
  const [viralHashtags, setViralHashtags] = useState("");
  const [viralLoading, setViralLoading] = useState(false);
  const [viralResult, setViralResult] = useState<ViralAnalysis | null>(null);

  // ─── TikTok Account State (OAuth) ─────────────────────
  const [tiktokConn, setTiktokConn] = useState<any>(null);
  const [connLoading, setConnLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // ─── TikTok Publish State ──────────────────────────────
  const [promoVideos, setPromoVideos] = useState<Array<{ url: string; source: string; label: string; thumbnail?: string }>>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [publishCaption, setPublishCaption] = useState("");
  const [publishHashtags, setPublishHashtags] = useState("");
  const [publishPrivacy, setPublishPrivacy] = useState("SELF_ONLY");
  const [selectedVideoUrl, setSelectedVideoUrl] = useState("");
  const [publishing, setPublishing] = useState(false);

  // ─── TikTok Stats State ────────────────────────────────
  const [tiktokVideos, setTiktokVideos] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // ─── Load TikTok connection on mount ──────────────────
  useEffect(() => { loadTiktokConn(); }, []);

  const loadTiktokConn = async () => {
    setConnLoading(true);
    try {
      const res = await fetch("/api/auth/tiktok/connection", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const connection = data.connection || data.data || null;
        setTiktokConn(connection?.connected || connection?.isActive ? { ...connection, isActive: connection.isActive ?? connection.connected } : null);
      }
    } catch { /* not connected */ }
    finally { setConnLoading(false); }
  };

  const connectTikTok = async () => {
    try {
      const res = await fetch("/api/auth/tiktok/connect", { credentials: "include" });
      const data = await res.json();
      const authUrl = data.authUrl || data.data?.authUrl;
      if (authUrl) window.location.href = authUrl;
      else throw new Error(data.error || "TikTok did not return an authorization URL");
    } catch {
      toast({ title: "Error", description: "Could not initiate TikTok login", variant: "destructive" });
    }
  };

  const disconnectTikTok = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/auth/tiktok/disconnect", { method: "DELETE", credentials: "include" });
      setTiktokConn(null);
      setTiktokVideos([]);
      toast({ title: "TikTok disconnected" });
    } catch {
      toast({ title: "Error disconnecting", variant: "destructive" });
    } finally { setDisconnecting(false); }
  };

  const loadPromoVideos = async () => {
    if (!selectedArtist?.id) return;
    setVideosLoading(true);
    try {
      const res = await fetch(`/api/ads-campaigns/${selectedArtist.id}/creatives/videos`, { credentials: "include" });
      const data = await res.json();
      setPromoVideos(data.videos || []);
    } catch { /* ignore */ }
    finally { setVideosLoading(false); }
  };

  const publishToTikTok = async () => {
    if (!selectedVideoUrl) { toast({ title: "Select a video first", variant: "destructive" }); return; }
    setPublishing(true);
    try {
      const res = await fetch(`/api/ads-campaigns/${selectedArtist?.id}/publish/tiktok`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ videoUrl: selectedVideoUrl, caption: publishCaption, hashtags: publishHashtags, privacy: publishPrivacy }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "🎵 Video submitted to TikTok!", description: `Publish ID: ${data.publishId} — processing...` });
        setPublishCaption(""); setPublishHashtags(""); setSelectedVideoUrl("");
      } else {
        toast({ title: "Publish failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setPublishing(false); }
  };

  const loadTiktokStats = async () => {
    if (!selectedArtist?.id) return;
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/ads-campaigns/${selectedArtist.id}/analytics/tiktok`, { credentials: "include" });
      const data = await res.json();
      if (data.videos) setTiktokVideos(data.videos);
    } catch { /* TikTok not connected */ }
    finally { setStatsLoading(false); }
  };

  // ─── Helper: Copy to Clipboard ─────────────────────────
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  // ─── API Calls ─────────────────────────────────────────
  const generateReelScript = async () => {
    if (!reelTopic.trim()) return toast({ title: "Enter a topic", variant: "destructive" });
    setReelLoading(true);
    try {
      const res = await fetch("/api/tiktok/tiktok-reel-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: reelTopic,
          style: reelStyle,
          duration: reelDuration,
          artistName: selectedArtist?.artistName || selectedArtist?.name,
          genre: selectedArtist?.genre,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate script");
      const data = await res.json();
      setReelResult(data);
    } catch (err) {
      toast({ title: "Error", description: "Could not generate reel script. Try again.", variant: "destructive" });
    } finally {
      setReelLoading(false);
    }
  };

  const scanTrends = async () => {
    if (!trendNiche.trim()) return toast({ title: "Enter a niche", variant: "destructive" });
    setTrendLoading(true);
    try {
      const res = await fetch("/api/tiktok/tiktok-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: trendNiche,
          artistName: selectedArtist?.artistName || selectedArtist?.name,
        }),
      });
      if (!res.ok) throw new Error("Failed to scan trends");
      const data = await res.json();
      setTrends(data.trends || []);
    } catch (err) {
      toast({ title: "Error", description: "Could not scan trends. Try again.", variant: "destructive" });
    } finally {
      setTrendLoading(false);
    }
  };

  const generateCaptions = async () => {
    if (!captionTopic.trim()) return toast({ title: "Enter a topic", variant: "destructive" });
    setCaptionLoading(true);
    try {
      const res = await fetch("/api/tiktok/tiktok-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: captionTopic,
          style: captionStyle,
          artistName: selectedArtist?.artistName || selectedArtist?.name,
          genre: selectedArtist?.genre,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate captions");
      const data = await res.json();
      setCaptions(data.captions || []);
    } catch (err) {
      toast({ title: "Error", description: "Could not generate captions. Try again.", variant: "destructive" });
    } finally {
      setCaptionLoading(false);
    }
  };

  const generateCalendar = async () => {
    if (!calendarNiche.trim()) return toast({ title: "Enter a niche", variant: "destructive" });
    setCalendarLoading(true);
    try {
      const res = await fetch("/api/tiktok/tiktok-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: calendarNiche,
          days: parseInt(calendarDays),
          artistName: selectedArtist?.artistName || selectedArtist?.name,
          genre: selectedArtist?.genre,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate calendar");
      const data = await res.json();
      setCalendar(data.calendar || []);
    } catch (err) {
      toast({ title: "Error", description: "Could not generate calendar. Try again.", variant: "destructive" });
    } finally {
      setCalendarLoading(false);
    }
  };

  const analyzeViralPotential = async () => {
    if (!viralDescription.trim()) return toast({ title: "Describe your video", variant: "destructive" });
    setViralLoading(true);
    try {
      const res = await fetch("/api/tiktok/tiktok-viral-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: viralDescription,
          hashtags: viralHashtags,
          artistName: selectedArtist?.artistName || selectedArtist?.name,
          genre: selectedArtist?.genre,
        }),
      });
      if (!res.ok) throw new Error("Failed to analyze");
      const data = await res.json();
      setViralResult(data);
    } catch (err) {
      toast({ title: "Error", description: "Could not analyze viral potential. Try again.", variant: "destructive" });
    } finally {
      setViralLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-20">
        <div className="flex-1 max-w-6xl mx-auto space-y-5 sm:space-y-6 p-3 sm:p-6 lg:p-8 pt-4 sm:pt-6">

          {/* ─── Hero ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${TK.gradientSoft} border border-[#00f2ea]/20 p-4 sm:p-6`}
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#00f2ea]/15 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[#ff0050]/15 rounded-full blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#7c3aed]/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row gap-6 items-center">
              <div className="flex-1 space-y-3 text-center lg:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#00f2ea]/20 to-[#ff0050]/20 border border-[#00f2ea]/30">
                  <Zap className="w-3 h-3 text-[#00f2ea]" />
                  <span className="text-[11px] font-semibold">AI-Powered TikTok Growth</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight">
                  <span className="text-foreground">TikTok </span>
                  <span className={`bg-gradient-to-r ${TK.gradient} bg-clip-text text-transparent`}>
                    Growth Suite
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-md mx-auto lg:mx-0">
                  Create viral reels, discover trends, optimize captions, and blow up your TikTok presence with AI.
                </p>
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  <Button
                    size="sm"
                    className={`bg-gradient-to-r ${TK.gradient} text-white font-bold rounded-xl shadow-lg shadow-[#ff0050]/20 hover:opacity-90 transition-all hover:scale-105`}
                    onClick={() => setActiveTab("reel-creator")}
                  >
                    <Rocket className="mr-1.5 h-4 w-4" /> Create Reel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-[#00f2ea] to-[#7c3aed] text-white font-bold rounded-xl shadow-lg shadow-[#00f2ea]/20 hover:opacity-90 transition-all hover:scale-105"
                    onClick={() => setActiveTab("trends")}
                  >
                    <TrendingUp className="mr-1.5 h-4 w-4" /> Scan Trends
                  </Button>
                </div>
              </div>

              {/* Right: TikTok Logo Animation */}
              <div className="w-full lg:w-[280px] shrink-0">
                <div className="w-full h-[200px] rounded-2xl bg-gradient-to-br from-[#00f2ea]/10 via-black/40 to-[#ff0050]/10 border border-[#00f2ea]/10 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,242,234,0.08),transparent_70%)]" />
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <SiTiktok className="w-20 h-20 text-white drop-shadow-[0_0_30px_rgba(0,242,234,0.4)]" />
                  </motion.div>
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                    {[
                      { icon: Eye, label: "Views", value: "10K+" },
                      { icon: ThumbsUp, label: "Likes", value: "5K+" },
                      { icon: Share2, label: "Shares", value: "2K+" },
                    ].map((stat, i) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.15 }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10"
                      >
                        <stat.icon className="w-3 h-3 text-[#00f2ea]" />
                        <span className="text-[10px] font-bold text-white">{stat.value}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ─── TikTok Account Connection Banner ──────── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className={`p-3 sm:p-4 border-2 transition-colors ${
              tiktokConn?.isActive
                ? 'border-[#00f2ea]/30 bg-[#00f2ea]/5'
                : 'border-[#ff0050]/30 bg-gradient-to-r from-[#ff0050]/5 to-[#00f2ea]/5'
            }`}>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  tiktokConn?.isActive ? 'bg-[#00f2ea]/10' : 'bg-[#ff0050]/10'
                }`}>
                  {tiktokConn?.isActive
                    ? <CheckCircle className="w-6 h-6 text-[#00f2ea]" />
                    : <SiTiktok className="w-6 h-6 text-[#ff0050]" />
                  }
                </div>
                <div className="flex-1 text-center sm:text-left">
                  {tiktokConn?.isActive ? (
                    <>
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <span className="font-semibold text-sm text-[#00f2ea]">TikTok Connected</span>
                        {tiktokConn.displayName && <Badge variant="secondary" className="text-xs">@{tiktokConn.displayName}</Badge>}
                        <span className="w-2 h-2 rounded-full bg-[#00f2ea] animate-pulse" />
                      </div>
                      <p className="text-xs text-muted-foreground">OAuth account linked — you can post videos and view analytics</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <span className="font-semibold text-sm">Connect Your TikTok Account</span>
                        <Badge className="bg-[#ff0050]/10 text-[#ff0050] border-[#ff0050]/20 text-[10px]">REQUIRED TO POST</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Link your TikTok to publish videos directly and view organic analytics</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tiktokConn?.isActive ? (
                    <>
                      <Button size="sm" variant="outline" className="text-xs h-8 rounded-lg" onClick={() => { setActiveTab('account'); loadTiktokStats(); }}>
                        <BarChart2 className="w-3.5 h-3.5 mr-1" /> Stats
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-8 rounded-lg text-red-400 hover:text-red-300" onClick={disconnectTikTok} disabled={disconnecting}>
                        {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Disconnect'}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm"
                      className="bg-gradient-to-r from-[#010101] to-[#ff0050] text-white text-xs h-8 rounded-lg hover:opacity-90 border border-[#00f2ea]/30"
                      onClick={connectTikTok} disabled={connLoading}>
                      {connLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <SiTiktok className="w-3 h-3 mr-1" />}
                      Connect TikTok
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* ─── 5 Feature Cards Overview ──────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3"
          >
            {[
              { icon: Video, label: "Reel Creator", desc: "AI scripts & storyboards", color: "#ff0050", tab: "reel-creator" },
              { icon: TrendingUp, label: "Trend Scanner", desc: "Discover viral trends", color: "#00f2ea", tab: "trends" },
              { icon: Hash, label: "Captions & Tags", desc: "Optimized copy & hashtags", color: "#7c3aed", tab: "captions" },
              { icon: Calendar, label: "Content Planner", desc: "7-day posting calendar", color: "#ff0050", tab: "calendar" },
              { icon: Flame, label: "Viral Score", desc: "Predict viral potential", color: "#00f2ea", tab: "viral" },
            ].map((feature) => (
              <motion.button
                key={feature.tab}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveTab(feature.tab)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  activeTab === feature.tab
                    ? "border-[" + feature.color + "]/40 bg-[" + feature.color + "]/5 shadow-md"
                    : "border-border/50 bg-card/50 hover:border-[#00f2ea]/20"
                }`}
                style={activeTab === feature.tab ? { borderColor: `${feature.color}40`, backgroundColor: `${feature.color}08` } : {}}
              >
                <feature.icon className="w-5 h-5 mb-1.5" style={{ color: feature.color }} />
                <div className="font-semibold text-xs">{feature.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{feature.desc}</div>
              </motion.button>
            ))}
          </motion.div>

          {/* ─── Artist Selector ──────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <SiTiktok className="w-4 h-4 text-[#00f2ea]" />
              <span className="text-sm font-semibold">Artist Profile</span>
            </div>
            <ArtistSelector label="" />
          </div>

          {/* ─── Tabs ─────────────────────────────────── */}
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v);
            if (v === 'publish' && promoVideos.length === 0) loadPromoVideos();
            if (v === 'account') loadTiktokStats();
          }} className="space-y-4">
            <div className="flex justify-center overflow-x-auto">
              <TabsList className="inline-flex p-1 bg-card/80 backdrop-blur-sm border border-border rounded-xl gap-0.5">
                {[
                  { value: "account", icon: UserCheck, label: "Account" },
                  { value: "publish", icon: Send, label: "Publish" },
                  { value: "reel-creator", icon: Video, label: "Reel" },
                  { value: "trends", icon: TrendingUp, label: "Trends" },
                  { value: "captions", icon: Hash, label: "Captions" },
                  { value: "calendar", icon: Calendar, label: "Planner" },
                  { value: "viral", icon: Flame, label: "Viral" },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={`data-[state=active]:bg-gradient-to-r data-[state=active]:${TK.gradient} data-[state=active]:text-white px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all gap-1.5`}
                    style={activeTab === tab.value ? { background: "linear-gradient(to right, #00f2ea, #ff0050, #7c3aed)" } : {}}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ═══════════════════════════════════════════
                TAB 0: ACCOUNT — TikTok OAuth + Stats
            ═══════════════════════════════════════════ */}
            <TabsContent value="account">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                {/* Connection Card */}
                <Card className={`p-5 border-2 ${
                  tiktokConn?.isActive ? 'border-[#00f2ea]/30 bg-[#00f2ea]/5' : 'border-border'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #010101, #ff0050)' }}>
                      <SiTiktok className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold">TikTok Account</h3>
                      <p className="text-xs text-muted-foreground">OAuth Login Kit v2 — publish videos &amp; view analytics</p>
                    </div>
                    {tiktokConn?.isActive && <Badge className="ml-auto bg-[#00f2ea]/10 text-[#00f2ea] border-[#00f2ea]/20">● Connected</Badge>}
                  </div>

                  {tiktokConn?.isActive ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Username', value: tiktokConn.displayName ? `@${tiktokConn.displayName}` : '—' },
                          { label: 'Scopes', value: tiktokConn.scopes?.split(',').length > 1 ? `${tiktokConn.scopes?.split(',').length} permissions` : tiktokConn.scopes || '—' },
                          { label: 'Token expires', value: tiktokConn.tokenExpiresAt ? new Date(tiktokConn.tokenExpiresAt).toLocaleDateString() : 'Never' },
                          { label: 'Connected', value: tiktokConn.createdAt ? new Date(tiktokConn.createdAt).toLocaleDateString() : '—' },
                        ].map(f => (
                          <div key={f.label} className="p-3 rounded-xl bg-background/50 border border-border">
                            <p className="text-[10px] text-muted-foreground">{f.label}</p>
                            <p className="text-sm font-semibold mt-0.5">{f.value}</p>
                          </div>
                        ))}
                      </div>
                      {tiktokConn.avatarUrl && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-background/30 border border-border">
                          <img src={tiktokConn.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                          <div>
                            <p className="font-semibold text-sm">{tiktokConn.displayName}</p>
                            {tiktokConn.profileDeepLink && (
                              <a href={tiktokConn.profileDeepLink} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00f2ea] flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> View Profile
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                      <Button variant="outline" size="sm" className="text-red-400 border-red-400/30 hover:bg-red-400/10" onClick={disconnectTikTok} disabled={disconnecting}>
                        {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                        Disconnect TikTok
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-3">
                      <SiTiktok className="w-12 h-12 mx-auto text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Connect your TikTok account to enable direct video publishing and view your organic stats</p>
                      <ul className="text-xs text-muted-foreground/60 space-y-1">
                        <li>✓ Publish videos directly from Boostify</li>
                        <li>✓ Schedule content for optimal times</li>
                        <li>✓ View views, likes, comments, shares</li>
                      </ul>
                      <Button
                        className="bg-gradient-to-r from-[#010101] to-[#ff0050] text-white font-bold rounded-xl border border-[#00f2ea]/30 hover:opacity-90"
                        onClick={connectTikTok} disabled={connLoading}>
                        {connLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <SiTiktok className="w-4 h-4 mr-2" />}
                        Connect TikTok Account
                      </Button>
                    </div>
                  )}
                </Card>

                {/* Video Stats */}
                {tiktokConn?.isActive && (
                  <Card className="p-4 border border-[#00f2ea]/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-[#00f2ea]" />
                        <h4 className="font-semibold text-sm">Your TikTok Videos</h4>
                      </div>
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={loadTiktokStats} disabled={statsLoading}>
                        <RefreshCw className={`w-3 h-3 mr-1 ${statsLoading ? 'animate-spin' : ''}`} /> Refresh
                      </Button>
                    </div>

                    {statsLoading ? (
                      <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#00f2ea]" /></div>
                    ) : tiktokVideos.length === 0 ? (
                      <div className="text-center py-8">
                        <Video className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                        <p className="text-xs text-muted-foreground">No videos yet. Publish your first TikTok from the Publish tab.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {tiktokVideos.map((v: any) => (
                          <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50 hover:border-[#00f2ea]/20 transition-colors">
                            {v.cover_image_url && <img src={v.cover_image_url} alt="" className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{v.title || 'Untitled'}</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" /> {(v.view_count || 0).toLocaleString()}</span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" /> {(v.like_count || 0).toLocaleString()}</span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> {(v.comment_count || 0).toLocaleString()}</span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Share2 className="w-2.5 h-2.5" /> {(v.share_count || 0).toLocaleString()}</span>
                              </div>
                            </div>
                            {v.share_url && (
                              <a href={v.share_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-[#00f2ea]" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </motion.div>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB: PUBLISH — Post video to TikTok
            ═══════════════════════════════════════════ */}
            <TabsContent value="publish">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                {!tiktokConn?.isActive ? (
                  <Card className="p-8 text-center border border-[#ff0050]/20">
                    <SiTiktok className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
                    <p className="font-semibold mb-1">Connect TikTok first</p>
                    <p className="text-sm text-muted-foreground mb-4">You need to connect your TikTok account before publishing videos</p>
                    <Button className="bg-gradient-to-r from-[#010101] to-[#ff0050] text-white font-bold rounded-xl" onClick={connectTikTok}>
                      <SiTiktok className="w-4 h-4 mr-2" /> Connect Account
                    </Button>
                  </Card>
                ) : (
                  <Card className="p-4 sm:p-5 border border-[#ff0050]/20 bg-gradient-to-br from-[#ff0050]/5 to-transparent">
                    <div className="flex items-center gap-2 mb-4">
                      <Send className="w-5 h-5 text-[#ff0050]" />
                      <h3 className="font-bold text-lg">Publish to TikTok</h3>
                      <Badge className="bg-[#00f2ea]/10 text-[#00f2ea] border-[#00f2ea]/20 text-[10px]">
                        @{tiktokConn.displayName}
                      </Badge>
                    </div>

                    {/* Video from library */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-muted-foreground">SELECT VIDEO FROM LIBRARY</label>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={loadPromoVideos} disabled={videosLoading}>
                          <RefreshCw className={`w-3 h-3 mr-1 ${videosLoading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                      </div>

                      {!selectedArtist?.id ? (
                        <p className="text-xs text-muted-foreground p-3 rounded-xl border border-border/50">Select an artist profile above to load your video library</p>
                      ) : videosLoading ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#00f2ea]" /></div>
                      ) : promoVideos.length === 0 ? (
                        <div className="text-center py-6 rounded-xl border border-border/50">
                          <Video className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                          <p className="text-xs text-muted-foreground">No promo videos found. Generate videos in the Cinematic Promo Engine or paste a URL below.</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {promoVideos.map((v, i) => (
                            <button key={i} onClick={() => setSelectedVideoUrl(v.url)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all"
                              style={{
                                background: selectedVideoUrl === v.url ? 'rgba(0,242,234,0.08)' : 'rgba(255,255,255,0.03)',
                                border: `1.5px solid ${selectedVideoUrl === v.url ? '#00f2ea55' : 'rgba(255,255,255,0.08)'}`,
                              }}>
                              {v.thumbnail ? (
                                <img src={v.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[#ff0050]/15">
                                  <Video className="w-4 h-4 text-[#ff0050]" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{v.label}</p>
                                <p className="text-[10px] text-muted-foreground">{v.source}</p>
                              </div>
                              {selectedVideoUrl === v.url && <CheckCircle className="w-4 h-4 text-[#00f2ea] shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Or paste URL */}
                    <div className="mb-4">
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">OR PASTE VIDEO URL</label>
                      <Input
                        placeholder="https://... (direct video file URL)"
                        value={selectedVideoUrl}
                        onChange={(e) => setSelectedVideoUrl(e.target.value)}
                        className="bg-background/50 font-mono text-xs"
                      />
                    </div>

                    {/* Caption */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">CAPTION</label>
                      <Textarea
                        placeholder="Write a caption for your TikTok (max 2200 chars)..."
                        value={publishCaption}
                        onChange={(e) => setPublishCaption(e.target.value)}
                        maxLength={2200}
                        rows={3}
                        className="bg-background/50 resize-none"
                      />
                    </div>

                    {/* Hashtags + Privacy */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">HASHTAGS</label>
                        <Input
                          placeholder="#music #newtrack #fyp"
                          value={publishHashtags}
                          onChange={(e) => setPublishHashtags(e.target.value)}
                          className="bg-background/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">PRIVACY</label>
                        <select
                          value={publishPrivacy}
                          onChange={(e) => setPublishPrivacy(e.target.value)}
                          className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm"
                        >
                          <option value="PUBLIC_TO_EVERYONE">🌍 Public</option>
                          <option value="MUTUAL_FOLLOW_FRIENDS">👥 Friends</option>
                          <option value="SELF_ONLY">🔒 Only me (test)</option>
                        </select>
                      </div>
                    </div>

                    {/* TikTok note */}
                    <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(0,242,234,0.06)', border: '1px solid rgba(0,242,234,0.15)' }}>
                      <p className="text-xs text-[#00f2ea]/80">📌 TikTok requires <strong>video.publish</strong> scope. If you get an error, the scope may still be under review by TikTok. Use <strong>Only me</strong> privacy to test.</p>
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-[#010101] via-[#ff0050] to-[#00f2ea] text-white font-bold rounded-xl hover:opacity-90"
                      onClick={publishToTikTok}
                      disabled={publishing || !selectedVideoUrl}
                    >
                      {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      {publishing ? 'Publishing to TikTok...' : 'Publish Now'}
                    </Button>
                  </Card>
                )}
              </motion.div>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB 1: REEL SCRIPT CREATOR
            ═══════════════════════════════════════════ */}
            <TabsContent value="reel-creator">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Card className="p-4 sm:p-6 border border-[#ff0050]/20 bg-gradient-to-br from-[#ff0050]/5 to-transparent">
                  <div className="flex items-center gap-2 mb-4">
                    <Video className="w-5 h-5 text-[#ff0050]" />
                    <h3 className="font-bold text-lg">AI Reel Script Creator</h3>
                    <Badge className="bg-[#ff0050]/10 text-[#ff0050] border-[#ff0050]/20 text-[10px]">AI</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate complete TikTok reel scripts with hooks, scene-by-scene breakdowns, captions, hashtags, and music suggestions.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Video Topic / Idea</label>
                      <Input
                        placeholder="e.g., Behind the scenes of recording my new single"
                        value={reelTopic}
                        onChange={(e) => setReelTopic(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Style</label>
                        <select
                          value={reelStyle}
                          onChange={(e) => setReelStyle(e.target.value)}
                          className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm"
                        >
                          <option value="trending">Trending</option>
                          <option value="storytelling">Storytelling</option>
                          <option value="educational">Educational</option>
                          <option value="comedy">Comedy</option>
                          <option value="aesthetic">Aesthetic</option>
                          <option value="challenge">Challenge</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration</label>
                        <select
                          value={reelDuration}
                          onChange={(e) => setReelDuration(e.target.value)}
                          className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm"
                        >
                          <option value="15">15 seconds</option>
                          <option value="30">30 seconds</option>
                          <option value="60">60 seconds</option>
                          <option value="90">90 seconds</option>
                          <option value="180">3 minutes</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <Button
                    className={`mt-4 w-full sm:w-auto bg-gradient-to-r ${TK.gradient} text-white font-bold rounded-xl hover:opacity-90`}
                    onClick={generateReelScript}
                    disabled={reelLoading}
                  >
                    {reelLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                    Generate Reel Script
                  </Button>
                </Card>

                {/* Reel Script Result */}
                <AnimatePresence>
                  {reelResult && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Card className="p-4 sm:p-6 border border-[#00f2ea]/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-[#00f2ea]" />
                            <h4 className="font-bold">Your Reel Script</h4>
                          </div>
                          <Badge className="bg-gradient-to-r from-[#00f2ea]/10 to-[#ff0050]/10 text-[#00f2ea] border-[#00f2ea]/20">
                            <Flame className="w-3 h-3 mr-1" /> Viral Score: {reelResult.viralScore}/100
                          </Badge>
                        </div>

                        {/* Hook */}
                        <div className="p-3 rounded-xl bg-[#ff0050]/5 border border-[#ff0050]/20">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-[#ff0050]">🎣 HOOK (First 3 seconds)</span>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(reelResult.hook, "Hook")}>
                              {copied === "Hook" ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                          <p className="text-sm font-medium">{reelResult.hook}</p>
                        </div>

                        {/* Scene Breakdown */}
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-muted-foreground">📹 SCENE BREAKDOWN</span>
                          {reelResult.scenes.map((scene, i) => (
                            <div key={i} className="p-3 rounded-lg bg-card/50 border border-border/50 grid grid-cols-[60px_1fr] gap-3">
                              <div className="text-center">
                                <div className="text-xs font-mono text-[#00f2ea] font-bold">{scene.timestamp}</div>
                                <Clock className="w-3 h-3 text-muted-foreground mx-auto mt-1" />
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs"><span className="font-semibold text-[#ff0050]">Visual:</span> {scene.visual}</div>
                                <div className="text-xs"><span className="font-semibold text-[#00f2ea]">Text:</span> {scene.text}</div>
                                <div className="text-xs"><span className="font-semibold text-[#7c3aed]">Audio:</span> {scene.audio}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Caption */}
                        <div className="p-3 rounded-xl bg-[#7c3aed]/5 border border-[#7c3aed]/20">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-[#7c3aed]">📝 CAPTION</span>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(reelResult.caption, "Caption")}>
                              {copied === "Caption" ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                          <p className="text-sm">{reelResult.caption}</p>
                        </div>

                        {/* Hashtags */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-muted-foreground"># HASHTAGS</span>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(reelResult.hashtags.join(" "), "Hashtags")}>
                              {copied === "Hashtags" ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {reelResult.hashtags.map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-[#00f2ea]/10 text-[#00f2ea] border-[#00f2ea]/20">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Music Suggestion */}
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#ff0050]/5 border border-[#ff0050]/10">
                          <Music2 className="w-4 h-4 text-[#ff0050]" />
                          <span className="text-xs"><span className="font-semibold">Suggested Sound:</span> {reelResult.music}</span>
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB 2: TREND SCANNER
            ═══════════════════════════════════════════ */}
            <TabsContent value="trends">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Card className="p-4 sm:p-6 border border-[#00f2ea]/20 bg-gradient-to-br from-[#00f2ea]/5 to-transparent">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-[#00f2ea]" />
                    <h3 className="font-bold text-lg">TikTok Trend Scanner</h3>
                    <Badge className="bg-[#00f2ea]/10 text-[#00f2ea] border-[#00f2ea]/20 text-[10px]">LIVE</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Discover trending sounds, hashtags, and content formats in your niche. Get AI-powered suggestions to ride the wave.
                  </p>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Your niche (e.g., hip-hop, indie music, R&B artist)"
                      value={trendNiche}
                      onChange={(e) => setTrendNiche(e.target.value)}
                      className="bg-background/50 flex-1"
                    />
                    <Button
                      className="bg-gradient-to-r from-[#00f2ea] to-[#7c3aed] text-white font-bold rounded-xl hover:opacity-90"
                      onClick={scanTrends}
                      disabled={trendLoading}
                    >
                      {trendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                      <span className="hidden sm:inline ml-2">Scan</span>
                    </Button>
                  </div>
                </Card>

                {/* Trend Results */}
                <AnimatePresence>
                  {trends.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {trends.map((trend, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <Card className="p-4 border border-border/50 hover:border-[#00f2ea]/30 transition-colors h-full">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-bold text-sm">{trend.trend}</h4>
                                <Badge variant="outline" className="text-[10px] mt-1">{trend.category}</Badge>
                              </div>
                              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                trend.velocity === "rising" ? "bg-green-500/10 text-green-500" :
                                trend.velocity === "peaked" ? "bg-amber-500/10 text-amber-500" :
                                "bg-red-500/10 text-red-500"
                              }`}>
                                {trend.velocity === "rising" ? "🚀 Rising" : trend.velocity === "peaked" ? "📈 Peaked" : "📉 Declining"}
                              </div>
                            </div>

                            <div className="mb-2">
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Confidence</span>
                                <span>{trend.confidence}%</span>
                              </div>
                              <Progress value={trend.confidence} className="h-1.5" />
                            </div>

                            <div className="flex flex-wrap gap-1 mb-2">
                              {trend.hashtags.slice(0, 4).map((tag, j) => (
                                <Badge key={j} variant="secondary" className="text-[9px] bg-[#00f2ea]/10 text-[#00f2ea]">{tag}</Badge>
                              ))}
                            </div>

                            <div className="text-[10px] text-muted-foreground space-y-1">
                              <div><Clock className="w-3 h-3 inline mr-1" /> Best time: {trend.bestPostTime}</div>
                              <div><Target className="w-3 h-3 inline mr-1" /> Est. reach: {trend.estimatedReach}</div>
                            </div>

                            {trend.suggestedAngles.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/30">
                                <span className="text-[10px] font-semibold text-[#ff0050]">Suggested Angles:</span>
                                <ul className="mt-1 space-y-0.5">
                                  {trend.suggestedAngles.slice(0, 2).map((angle, k) => (
                                    <li key={k} className="text-[10px] text-muted-foreground flex items-start gap-1">
                                      <Lightbulb className="w-3 h-3 text-[#ff0050] shrink-0 mt-0.5" /> {angle}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB 3: CAPTION & HASHTAG GENERATOR
            ═══════════════════════════════════════════ */}
            <TabsContent value="captions">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Card className="p-4 sm:p-6 border border-[#7c3aed]/20 bg-gradient-to-br from-[#7c3aed]/5 to-transparent">
                  <div className="flex items-center gap-2 mb-4">
                    <Hash className="w-5 h-5 text-[#7c3aed]" />
                    <h3 className="font-bold text-lg">Caption & Hashtag Generator</h3>
                    <Badge className="bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]/20 text-[10px]">AI</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate scroll-stopping captions with optimized hashtags, hooks, and CTAs tailored for TikTok's algorithm.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">What's your video about?</label>
                      <Input
                        placeholder="e.g., Dropping my new track this Friday"
                        value={captionTopic}
                        onChange={(e) => setCaptionTopic(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Tone / Style</label>
                      <select
                        value={captionStyle}
                        onChange={(e) => setCaptionStyle(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm"
                      >
                        <option value="engaging">Engaging</option>
                        <option value="funny">Funny / Gen-Z</option>
                        <option value="mysterious">Mysterious</option>
                        <option value="professional">Professional</option>
                        <option value="storytelling">Storytelling</option>
                        <option value="controversial">Controversial (hot take)</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    className="mt-4 w-full sm:w-auto bg-gradient-to-r from-[#7c3aed] to-[#ff0050] text-white font-bold rounded-xl hover:opacity-90"
                    onClick={generateCaptions}
                    disabled={captionLoading}
                  >
                    {captionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Generate Captions
                  </Button>
                </Card>

                {/* Caption Results */}
                <AnimatePresence>
                  {captions.length > 0 && (
                    <div className="space-y-3">
                      {captions.map((cap, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <Card className="p-4 border border-border/50 hover:border-[#7c3aed]/30 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant="outline" className="text-[10px]">{cap.style}</Badge>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">Engagement:</span>
                                <span className="text-xs font-bold text-[#00f2ea]">{cap.engagementScore}/100</span>
                              </div>
                            </div>

                            {/* Hook */}
                            <div className="p-2 rounded-lg bg-[#ff0050]/5 border border-[#ff0050]/10 mb-2">
                              <span className="text-[10px] font-bold text-[#ff0050]">Hook:</span>
                              <p className="text-xs mt-0.5">{cap.hook}</p>
                            </div>

                            {/* Caption */}
                            <p className="text-sm mb-2">{cap.caption}</p>

                            {/* CTA */}
                            <div className="p-2 rounded-lg bg-[#00f2ea]/5 border border-[#00f2ea]/10 mb-3">
                              <span className="text-[10px] font-bold text-[#00f2ea]">CTA:</span>
                              <p className="text-xs mt-0.5">{cap.cta}</p>
                            </div>

                            {/* Hashtags */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              {cap.hashtags.map((tag, j) => (
                                <Badge key={j} variant="secondary" className="text-[9px] bg-[#7c3aed]/10 text-[#7c3aed]">{tag}</Badge>
                              ))}
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7"
                              onClick={() => copyToClipboard(`${cap.hook}\n\n${cap.caption}\n\n${cap.cta}\n\n${cap.hashtags.join(" ")}`, `Caption ${i + 1}`)}
                            >
                              {copied === `Caption ${i + 1}` ? <CheckCircle className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                              Copy All
                            </Button>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB 4: CONTENT CALENDAR PLANNER
            ═══════════════════════════════════════════ */}
            <TabsContent value="calendar">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Card className="p-4 sm:p-6 border border-[#ff0050]/20 bg-gradient-to-br from-[#ff0050]/5 to-transparent">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-[#ff0050]" />
                    <h3 className="font-bold text-lg">Content Calendar Planner</h3>
                    <Badge className="bg-[#ff0050]/10 text-[#ff0050] border-[#ff0050]/20 text-[10px]">AI</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate a complete posting schedule with video concepts, hooks, sounds, and optimal posting times.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Your Niche / Genre</label>
                      <Input
                        placeholder="e.g., Latin trap, indie pop, beatmaking"
                        value={calendarNiche}
                        onChange={(e) => setCalendarNiche(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Days to Plan</label>
                      <select
                        value={calendarDays}
                        onChange={(e) => setCalendarDays(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm"
                      >
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    className={`mt-4 w-full sm:w-auto bg-gradient-to-r ${TK.gradient} text-white font-bold rounded-xl hover:opacity-90`}
                    onClick={generateCalendar}
                    disabled={calendarLoading}
                  >
                    {calendarLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
                    Generate Calendar
                  </Button>
                </Card>

                {/* Calendar Results */}
                <AnimatePresence>
                  {calendar.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between px-1">
                        <h4 className="font-bold text-sm flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-[#ff0050]" /> Your Posting Calendar
                        </h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => copyToClipboard(
                            calendar.map(d => `${d.day} ${d.time}\n${d.concept}\nHook: ${d.hook}\nSound: ${d.sound}\n${d.hashtags.join(" ")}`).join("\n\n---\n\n"),
                            "Full Calendar"
                          )}
                        >
                          {copied === "Full Calendar" ? <CheckCircle className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          Copy All
                        </Button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {calendar.map((day, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <Card className="p-3 border border-border/50 h-full hover:border-[#ff0050]/20 transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-[#00f2ea]">{day.day}</span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {day.time}
                                </span>
                              </div>
                              <h5 className="text-sm font-semibold mb-1">{day.concept}</h5>
                              <div className="text-[10px] text-[#ff0050] font-medium mb-1">🎣 {day.hook}</div>
                              <div className="text-[10px] text-muted-foreground mb-2">
                                <Music2 className="w-3 h-3 inline mr-1" /> {day.sound}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {day.hashtags.slice(0, 3).map((tag, j) => (
                                  <Badge key={j} variant="secondary" className="text-[8px] bg-[#7c3aed]/10 text-[#7c3aed]">{tag}</Badge>
                                ))}
                              </div>
                              <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
                                <Badge variant="outline" className="text-[9px]">{day.format}</Badge>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Eye className="w-3 h-3" /> {day.estimatedViews}
                                </span>
                              </div>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB 5: VIRAL SCORE ANALYZER
            ═══════════════════════════════════════════ */}
            <TabsContent value="viral">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Card className="p-4 sm:p-6 border border-[#00f2ea]/20 bg-gradient-to-br from-[#00f2ea]/5 to-transparent">
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="w-5 h-5 text-[#00f2ea]" />
                    <h3 className="font-bold text-lg">Viral Score Analyzer</h3>
                    <Badge className="bg-[#00f2ea]/10 text-[#00f2ea] border-[#00f2ea]/20 text-[10px]">BETA</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Describe your TikTok video idea and get a viral potential score with actionable optimization tips.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Describe Your Video</label>
                      <Textarea
                        placeholder="e.g., A 30 second video showing the transformation from writing lyrics in a notebook to performing them live on stage, with a popular trending sound"
                        value={viralDescription}
                        onChange={(e) => setViralDescription(e.target.value)}
                        className="bg-background/50 min-h-[80px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned Hashtags (optional)</label>
                      <Input
                        placeholder="#fyp #music #newartist #viral"
                        value={viralHashtags}
                        onChange={(e) => setViralHashtags(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                  </div>

                  <Button
                    className="mt-4 w-full sm:w-auto bg-gradient-to-r from-[#00f2ea] to-[#ff0050] text-white font-bold rounded-xl hover:opacity-90"
                    onClick={analyzeViralPotential}
                    disabled={viralLoading}
                  >
                    {viralLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Flame className="w-4 h-4 mr-2" />}
                    Analyze Viral Potential
                  </Button>
                </Card>

                {/* Viral Score Result */}
                <AnimatePresence>
                  {viralResult && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Card className="p-4 sm:p-6 border border-[#00f2ea]/20 space-y-4">
                        {/* Score Ring */}
                        <div className="flex items-center gap-6 p-4 rounded-xl bg-gradient-to-r from-[#00f2ea]/5 to-[#ff0050]/5 border border-[#00f2ea]/10">
                          <div className="relative w-24 h-24 shrink-0">
                            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-border" strokeWidth="8" />
                              <circle
                                cx="50" cy="50" r="42" fill="none"
                                stroke={viralResult.score >= 70 ? "#00f2ea" : viralResult.score >= 40 ? "#ff0050" : "#ef4444"}
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={`${viralResult.score * 2.64} 264`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-2xl font-black">{viralResult.score}</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-lg mb-1">
                              {viralResult.score >= 80 ? "🔥 High Viral Potential!" :
                               viralResult.score >= 60 ? "📈 Good Potential" :
                               viralResult.score >= 40 ? "⚡ Moderate Potential" :
                               "💡 Needs Optimization"}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Estimated reach: {viralResult.estimatedReach.min.toLocaleString()} — {viralResult.estimatedReach.max.toLocaleString()} views
                            </p>
                          </div>
                        </div>

                        {/* Strengths & Weaknesses */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                            <span className="text-xs font-bold text-green-500 flex items-center gap-1 mb-2">
                              <CheckCircle className="w-3 h-3" /> Strengths
                            </span>
                            <ul className="space-y-1">
                              {viralResult.strengths.map((s, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                  <span className="text-green-500 mt-0.5">✓</span> {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                            <span className="text-xs font-bold text-red-500 flex items-center gap-1 mb-2">
                              <Target className="w-3 h-3" /> Weaknesses
                            </span>
                            <ul className="space-y-1">
                              {viralResult.weaknesses.map((w, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                  <span className="text-red-500 mt-0.5">✗</span> {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Improvements */}
                        <div className="p-3 rounded-xl bg-[#7c3aed]/5 border border-[#7c3aed]/20">
                          <span className="text-xs font-bold text-[#7c3aed] flex items-center gap-1 mb-2">
                            <Lightbulb className="w-3 h-3" /> Recommended Improvements
                          </span>
                          <ul className="space-y-1.5">
                            {viralResult.improvements.map((imp, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <ArrowRight className="w-3 h-3 text-[#7c3aed] shrink-0 mt-0.5" /> {imp}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Quick Tips Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="p-2 rounded-lg bg-card/50 border border-border/50 text-center">
                            <Clock className="w-4 h-4 text-[#00f2ea] mx-auto mb-1" />
                            <div className="text-[10px] text-muted-foreground">Optimal Length</div>
                            <div className="text-xs font-bold">{viralResult.optimalLength}</div>
                          </div>
                          <div className="p-2 rounded-lg bg-card/50 border border-border/50 text-center">
                            <Music2 className="w-4 h-4 text-[#ff0050] mx-auto mb-1" />
                            <div className="text-[10px] text-muted-foreground">Sound</div>
                            <div className="text-xs font-bold truncate">{viralResult.soundRecommendation?.[0] || "Trending"}</div>
                          </div>
                          <div className="p-2 rounded-lg bg-card/50 border border-border/50 text-center">
                            <Clock className="w-4 h-4 text-[#7c3aed] mx-auto mb-1" />
                            <div className="text-[10px] text-muted-foreground">Best Time</div>
                            <div className="text-xs font-bold">{viralResult.bestPostTimes?.[0] || "7-9PM"}</div>
                          </div>
                          <div className="p-2 rounded-lg bg-card/50 border border-border/50 text-center">
                            <Hash className="w-4 h-4 text-[#00f2ea] mx-auto mb-1" />
                            <div className="text-[10px] text-muted-foreground">Hashtag Strategy</div>
                            <div className="text-xs font-bold">{viralResult.hashtagStrategy?.length || 0} tags</div>
                          </div>
                        </div>

                        {/* Hashtag Strategy */}
                        {viralResult.hashtagStrategy && viralResult.hashtagStrategy.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-muted-foreground"># OPTIMIZED HASHTAGS</span>
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(viralResult.hashtagStrategy.join(" "), "Viral Hashtags")}>
                                {copied === "Viral Hashtags" ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {viralResult.hashtagStrategy.map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs bg-[#00f2ea]/10 text-[#00f2ea] border-[#00f2ea]/20">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </TabsContent>

          </Tabs>
        </div>
      </main>
    </div>
  );
}
