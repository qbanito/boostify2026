import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useState, Suspense, lazy, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useArtistProfile } from "../hooks/use-artist-profile";
import { useInstagramConnection } from "../hooks/use-instagram-connection";
import { useIgBoostLimits } from "../hooks/use-ig-boost-limits";
import { useInstagramBoostLimits } from "../hooks/use-instagram-boost-limits";
import { useToast } from "../hooks/use-toast";
import { ArtistSelector } from "../components/promotion/artist-selector";
import { SubscriptionBanner } from "../components/instagram-boost/subscription-banner";
import { UsageBadge } from "../components/instagram-boost/usage-badge";
import { IgBoostPricing } from "../components/instagram-boost/ig-boost-pricing";
import { motion, AnimatePresence } from "framer-motion";
import { SiInstagram } from "react-icons/si";
import { InstagramExtensionSyncTab } from "../components/instagram-boost/extension-sync-tab";
import { InstagramAiChat } from "../components/instagram-boost/ai-chat";
import { HelpGuideModal } from "../components/instagram-boost/help-guide-modal";
import { OnboardingWizard } from "../components/instagram-boost/onboarding-wizard";
import { PageDiagnosticPanel } from "../components/admin/page-diagnostic-panel";
import { AiToolsTab } from "../components/instagram-boost/ai-tools-tab";
import { GrowthTab } from "../components/instagram-boost/growth-tab";
import { ReportsTab } from "../components/instagram-boost/reports-tab";
import { ContentCreateTab } from "../components/instagram-boost/content-create-tab";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Brain, ImagePlus, TrendingUp, BarChart2,
  Sparkles, Rocket, CheckCircle, HelpCircle,
  Zap, Plug, Download, Chrome, ArrowRight, Shield, ExternalLink, Crown,
  Send, Video, Image, Heart, MessageCircle, Eye, RefreshCw, Loader2,
  Share2, Link2, Globe, Calendar, Clock, CalendarClock, Star
} from "lucide-react";

const InstagramAnimationPlayer = lazy(() =>
  import("../components/remotion/InstagramAnimationPlayer").then(mod => ({ default: mod.InstagramAnimationPlayer }))
);

export default function InstagramBoostPage() {
  const { user, userSubscription, isAdmin } = useAuth();
  const { selectedArtist, getInstagramData } = useArtistProfile();
  const ig = useInstagramConnection();
  const boost = useIgBoostLimits();
  const dailyCap = useInstagramBoostLimits();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("extension");
  const [helpOpen, setHelpOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // ─── Direct Publish State (Instagram Graph API) ────────────
  const [publishImageUrl, setPublishImageUrl] = useState("");
  const [publishCaption, setPublishCaption] = useState("");
  const [publishHashtags, setPublishHashtags] = useState("");
  const [publishType, setPublishType] = useState<"image" | "reel">("image");
  const [publishing, setPublishing] = useState(false);

  // ─── Library (promo videos) ───────────────────────────────
  const [promoVideos, setPromoVideos] = useState<Array<{ url: string; source: string; label: string; thumbnail?: string }>>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // ─── Scheduled Posts ────────────────────────────────────
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  // ─── Instagram Graph API Analytics ────────────────────
  const [igApiMedia, setIgApiMedia] = useState<any[]>([]);
  const [igApiLoading, setIgApiLoading] = useState(false);

  // Load media + scheduled on tab open
  useEffect(() => {
    if (activeTab === 'publish' && selectedArtist?.id) {
      loadScheduledPosts();
      loadPromoVideos();
      loadIgApiMedia();
    }
  }, [activeTab, selectedArtist?.id]);

  const loadPromoVideos = async () => {
    if (!selectedArtist?.id) return;
    setVideosLoading(true);
    try {
      const res = await fetch(`/api/ads-campaigns/${selectedArtist.id}/creatives/videos`, { credentials: 'include' });
      const data = await res.json();
      setPromoVideos(data.videos || []);
    } catch { /* ignore */ }
    finally { setVideosLoading(false); }
  };

  const loadScheduledPosts = async () => {
    if (!selectedArtist?.id) return;
    setScheduledLoading(true);
    try {
      const res = await fetch(`/api/ads-campaigns/${selectedArtist.id}/schedule`, { credentials: 'include' });
      const data = await res.json();
      setScheduledPosts(data.posts || []);
    } catch { /* ignore */ }
    finally { setScheduledLoading(false); }
  };

  const loadIgApiMedia = async () => {
    if (!selectedArtist?.id) return;
    setIgApiLoading(true);
    try {
      const res = await fetch(`/api/ads-campaigns/${selectedArtist.id}/analytics/instagram`, { credentials: 'include' });
      const data = await res.json();
      setIgApiMedia(data.media || []);
    } catch { /* ignore */ }
    finally { setIgApiLoading(false); }
  };

  const publishToInstagram = async () => {
    if (!publishImageUrl) { toast({ title: 'Paste an image/video URL first', variant: 'destructive' }); return; }
    setPublishing(true);
    try {
      const res = await fetch(`/api/ads-campaigns/${selectedArtist?.id}/publish/instagram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          imageUrl: publishType === 'image' ? publishImageUrl : undefined,
          videoUrl: publishType === 'reel' ? publishImageUrl : undefined,
          mediaType: publishType === 'reel' ? 'REELS' : 'IMAGE',
          caption: `${publishCaption}${publishHashtags ? '\n\n' + publishHashtags : ''}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: '📸 Published to Instagram!', description: `Media ID: ${data.mediaId}` });
        setPublishImageUrl(''); setPublishCaption(''); setPublishHashtags('');
        loadIgApiMedia();
      } else {
        toast({ title: 'Publish failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setPublishing(false); }
  };

  const schedulePost = async () => {
    if (!publishImageUrl || !scheduleDate) {
      toast({ title: 'Fill in URL and scheduled date', variant: 'destructive' }); return;
    }
    try {
      const res = await fetch(`/api/ads-campaigns/${selectedArtist?.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platform: 'instagram',
          mediaType: publishType,
          imageUrl: publishType === 'image' ? publishImageUrl : undefined,
          videoUrl: publishType === 'reel' ? publishImageUrl : undefined,
          mediaUrl: publishImageUrl,
          caption: `${publishCaption}${publishHashtags ? '\n\n' + publishHashtags : ''}`,
          scheduledAt: scheduleDate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: '🗓️ Post scheduled!' });
        setPublishImageUrl(''); setPublishCaption(''); setPublishHashtags(''); setScheduleDate('');
        loadScheduledPosts();
      } else {
        toast({ title: 'Schedule failed', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const cancelScheduled = async (postId: string) => {
    try {
      await fetch(`/api/ads-campaigns/${selectedArtist?.id}/schedule/${postId}`, {
        method: 'DELETE', credentials: 'include'
      });
      setScheduledPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: 'Scheduled post cancelled' });
    } catch {
      toast({ title: 'Error cancelling post', variant: 'destructive' });
    }
  };

  const isConnected = ig.isConnected;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-20">
        <div className="flex-1 max-w-6xl mx-auto space-y-5 sm:space-y-6 p-3 sm:p-6 lg:p-8 pt-4 sm:pt-6">

          {/* Inline Subscription Banner (free users) */}
          <SubscriptionBanner
            show={boost.showBanner}
            onDismiss={boost.dismissBanner}
            onOpenPricing={() => setPricingOpen(true)}
            plan={boost.plan}
            usage={boost.usage}
          />

          {/* --- Hero ---------------------------- */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#833ab4]/10 via-[#fd1d1d]/10 to-[#fcb045]/10 border border-primary/20 p-4 sm:p-6"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#833ab4]/15 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[#fd1d1d]/15 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row gap-6 items-center">
              {/* Left: Text */}
              <div className="flex-1 space-y-3 text-center lg:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#833ab4]/20 to-[#fd1d1d]/20 border border-[#fd1d1d]/30">
                  <Zap className="w-3 h-3 text-[#fcb045]" />
                  <span className="text-[11px] font-semibold">AI-Powered Growth</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight">
                  <span className="text-foreground">Instagram </span>
                  <span className="bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] bg-clip-text text-transparent">
                    Growth Suite
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-md mx-auto lg:mx-0">
                  Create content, grow your audience, and manage everything from one place.
                </p>
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-bold rounded-xl shadow-lg shadow-[#fd1d1d]/20 hover:opacity-90 transition-all hover:scale-105"
                    onClick={() => setWizardOpen(true)}
                  >
                    <Rocket className="mr-1.5 h-4 w-4" /> Start Growing
                  </Button>
                  {boost.isFreePlan && (
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all"
                      onClick={() => setPricingOpen(true)}
                    >
                      <Crown className="mr-1.5 h-4 w-4" /> Go Pro — $12/mo
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setHelpOpen(true)}>
                    <HelpCircle className="mr-1.5 h-4 w-4" /> How It Works
                  </Button>
                  {isFinite(dailyCap.limit) && (
                    <button
                      type="button"
                      onClick={() => dailyCap.remaining === 0 && setPricingOpen(true)}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                        dailyCap.remaining === 0
                          ? "bg-red-500/10 border-red-500/40 text-red-300 hover:bg-red-500/20 cursor-pointer"
                          : "bg-white/5 border-white/10 text-muted-foreground"
                      }`}
                      title={`Tier: ${dailyCap.tier} \u2014 daily cap: ${dailyCap.limit}`}
                      aria-label="Daily Instagram Boost actions"
                    >
                      <Zap className="w-3 h-3" />
                      {dailyCap.remaining}/{dailyCap.limit} today
                    </button>
                  )}
                </div>
              </div>

              {/* Right: Animation */}
              <div className="w-full lg:w-[300px] shrink-0">
                <Suspense fallback={
                  <div className="w-full h-[200px] rounded-2xl bg-gradient-to-br from-[#833ab4]/15 to-[#fcb045]/15 animate-pulse flex items-center justify-center">
                    <SiInstagram className="w-10 h-10 text-[#fd1d1d] animate-bounce" />
                  </div>
                }>
                  <InstagramAnimationPlayer width="100%" height={200} autoPlay loop className="w-full rounded-2xl" />
                </Suspense>
              </div>
            </div>
          </motion.div>

          {/* --- Extension CTA Banner ----------- */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className={`p-3 sm:p-4 border-2 transition-colors ${isConnected
              ? "border-green-500/30 bg-green-500/5"
              : "border-[#833ab4]/30 bg-gradient-to-r from-[#833ab4]/5 via-[#fd1d1d]/5 to-[#fcb045]/5"
            }`}>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isConnected ? "bg-green-500/10" : "bg-gradient-to-br from-[#833ab4]/15 to-[#fd1d1d]/15"
                }`}>
                  {isConnected
                    ? <CheckCircle className="w-6 h-6 text-green-500" />
                    : <Chrome className="w-6 h-6 text-[#833ab4]" />
                  }
                </div>

                {/* Text */}
                <div className="flex-1 text-center sm:text-left">
                  {isConnected ? (
                    <>
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <span className="font-semibold text-sm text-green-600">Connected</span>
                        {ig.connection?.instagramUsername && (
                          <Badge variant="secondary" className="text-xs">@{ig.connection.instagramUsername}</Badge>
                        )}
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ig.latestSnapshot ? `${ig.formatNumber(ig.latestSnapshot.followers)} followers · ${ig.latestSnapshot.engagementRate}% engagement` : "Syncing data..."} · Synced {ig.connection?.lastSyncAt ? new Date(ig.connection.lastSyncAt).toLocaleDateString() : "recently"}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <span className="font-semibold text-sm">Connect Chrome Extension</span>
                        <Badge className="bg-[#fd1d1d]/10 text-[#fd1d1d] border-[#fd1d1d]/20 text-[10px]">REQUIRED</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Install the extension to sync your Instagram data, extract profiles, and execute AI actions directly.
                      </p>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {isConnected ? (
                    <Button size="sm" variant="outline" className="text-xs h-8 rounded-lg" onClick={() => setActiveTab("extension")}>
                      <Plug className="w-3.5 h-3.5 mr-1" /> Manage
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white text-xs h-8 rounded-lg hover:opacity-90"
                        onClick={() => setActiveTab("extension")}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> Install Extension
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* --- Artist Selector (compact) ------ */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <SiInstagram className="w-4 h-4 text-[#fd1d1d]" />
              <span className="text-sm font-semibold">Artist Profile</span>
            </div>
            <ArtistSelector label="" />
          </div>

          {/* --- Tabs ------------------- */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex justify-center overflow-x-auto">
              <TabsList className="inline-flex p-1 bg-card/80 backdrop-blur-sm border border-border rounded-xl gap-0.5">
                {[
                  { value: "extension", icon: Plug, label: "Connect" },
                  { value: "publish", icon: Send, label: "Publish" },
                  { value: "tools", icon: Brain, label: "Tools", category: "aiTools" as const },
                  { value: "create", icon: ImagePlus, label: "Create", category: "create" as const },
                  { value: "growth", icon: TrendingUp, label: "Growth", category: "growth" as const },
                  { value: "analytics", icon: BarChart2, label: "Analytics", category: "analytics" as const },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#833ab4] data-[state=active]:to-[#fd1d1d] data-[state=active]:text-white px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all gap-1.5"
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.category && boost.isFreePlan && (
                      <span className="hidden sm:inline-flex w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Plan info bar for free users */}
            {boost.isFreePlan && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-3 flex-wrap"
              >
                <Badge variant="outline" className="text-xs gap-1.5 bg-gradient-to-r from-[#833ab4]/5 to-[#fd1d1d]/5 border-[#833ab4]/20">
                  <Sparkles className="w-3 h-3 text-[#833ab4]" />
                  Free Plan — Try all tools with daily limits
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-6 gap-1 text-[#833ab4] hover:text-[#fd1d1d]"
                  onClick={() => window.location.href = '/pricing'}
                >
                  <Crown className="w-3 h-3" /> Upgrade for unlimited
                </Button>
              </motion.div>
            )}

            <TabsContent value="extension">
              <InstagramExtensionSyncTab />
            </TabsContent>

            {/* ══════════════════════════════════════════════════
                PUBLISH TAB — Instagram Graph API direct publish
            ══════════════════════════════════════════════════ */}
            <TabsContent value="publish">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                {/* Post Now card */}
                <Card className="p-4 sm:p-5 border border-[#fd1d1d]/20 bg-gradient-to-br from-[#833ab4]/5 to-transparent">
                  <div className="flex items-center gap-2 mb-4">
                    <Send className="w-5 h-5 text-[#fd1d1d]" />
                    <h3 className="font-bold text-lg">Publish to Instagram</h3>
                    <Badge className="bg-[#833ab4]/10 text-[#833ab4] border-[#833ab4]/20 text-[10px]">GRAPH API</Badge>
                  </div>

                  {!selectedArtist?.id ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Select an artist profile above to publish</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Media type selector */}
                      <div className="flex gap-2">
                        {(['image', 'reel'] as const).map(t => (
                          <button key={t} onClick={() => setPublishType(t)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                            style={{
                              background: publishType === t ? 'rgba(253,29,29,0.1)' : 'rgba(255,255,255,0.03)',
                              border: `1.5px solid ${publishType === t ? '#fd1d1d55' : 'rgba(255,255,255,0.08)'}`,
                              color: publishType === t ? '#fd1d1d' : undefined,
                            }}>
                            {t === 'image' ? <Image className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                            {t === 'image' ? 'Image / Carousel' : 'Reel (Video)'}
                          </button>
                        ))}
                      </div>

                      {/* Image/video URL */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                          {publishType === 'image' ? 'IMAGE URL' : 'VIDEO URL'} <span className="text-[#fd1d1d]">*</span>
                        </label>
                        <Input
                          placeholder={publishType === 'image' ? 'https://... (publicly accessible .jpg/.png)' : 'https://... (direct .mp4 URL)'}
                          value={publishImageUrl}
                          onChange={(e) => setPublishImageUrl(e.target.value)}
                          className="bg-background/50 font-mono text-xs"
                        />
                      </div>

                      {/* Library quick-pick */}
                      {publishType === 'reel' && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">OR PICK FROM PROMO LIBRARY</label>
                            <button onClick={loadPromoVideos} className="text-[10px] text-[#833ab4] hover:underline flex items-center gap-0.5">
                              <RefreshCw className="w-2.5 h-2.5" /> Refresh
                            </button>
                          </div>
                          {videosLoading ? (
                            <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[#833ab4]" /></div>
                          ) : promoVideos.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-3 rounded-xl border border-border/40">No promo videos yet — generate them in the Cinematic Promo Engine</p>
                          ) : (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                              {promoVideos.map((v, i) => (
                                <button key={i} onClick={() => setPublishImageUrl(v.url)}
                                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all"
                                  style={{
                                    background: publishImageUrl === v.url ? 'rgba(131,58,180,0.08)' : 'rgba(255,255,255,0.02)',
                                    border: `1.5px solid ${publishImageUrl === v.url ? '#833ab455' : 'rgba(255,255,255,0.06)'}`,
                                  }}>
                                  {v.thumbnail ? (
                                    <img src={v.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-[#833ab4]/15 flex items-center justify-center shrink-0">
                                      <Video className="w-3.5 h-3.5 text-[#833ab4]" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{v.label}</p>
                                    <p className="text-[10px] text-muted-foreground">{v.source}</p>
                                  </div>
                                  {publishImageUrl === v.url && <CheckCircle className="w-3.5 h-3.5 text-[#833ab4] shrink-0" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Caption */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">CAPTION</label>
                        <Textarea
                          placeholder="Write your Instagram caption... (max 2200 chars)"
                          value={publishCaption}
                          onChange={(e) => setPublishCaption(e.target.value)}
                          maxLength={2200}
                          rows={3}
                          className="bg-background/50 resize-none"
                        />
                      </div>

                      {/* Hashtags + Schedule */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">HASHTAGS</label>
                          <Input
                            placeholder="#music #newartist #fyp"
                            value={publishHashtags}
                            onChange={(e) => setPublishHashtags(e.target.value)}
                            className="bg-background/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">SCHEDULE FOR LATER (optional)</label>
                          <Input
                            type="datetime-local"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="bg-background/50"
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          className="flex-1 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-bold rounded-xl hover:opacity-90"
                          onClick={publishToInstagram}
                          disabled={publishing || !publishImageUrl}
                        >
                          {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                          {publishing ? 'Publishing...' : 'Publish Now'}
                        </Button>
                        {scheduleDate && (
                          <Button
                            variant="outline"
                            className="flex-1 rounded-xl"
                            onClick={schedulePost}
                          >
                            <CalendarClock className="w-4 h-4 mr-2" /> Schedule Post
                          </Button>
                        )}
                      </div>

                      <p className="text-[10px] text-muted-foreground text-center">
                        Requires Meta <strong>facebookAccessToken</strong> + <strong>instagramAccountId</strong> in artist credentials. Configure in Ads Campaign Manager → Connect tab.
                      </p>
                    </div>
                  )}
                </Card>

                {/* Scheduled Posts */}
                <Card className="p-4 border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-[#833ab4]" />
                      <h4 className="font-semibold text-sm">Scheduled Posts</h4>
                    </div>
                    <button onClick={loadScheduledPosts} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <RefreshCw className={`w-3 h-3 ${scheduledLoading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                  </div>
                  {scheduledLoading ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#833ab4]" /></div>
                  ) : scheduledPosts.filter(p => p.platform === 'instagram').length === 0 ? (
                    <div className="text-center py-6">
                      <Clock className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground">No scheduled Instagram posts yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {scheduledPosts.filter(p => p.platform === 'instagram').map((post) => (
                        <div key={post.id} className="flex items-start gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge variant="secondary" className="text-[10px]">{post.mediaType}</Badge>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" /> {new Date(post.scheduledAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
                          </div>
                          <button onClick={() => cancelScheduled(post.id)}
                            className="text-[10px] text-red-400 hover:text-red-300 shrink-0 mt-0.5">Cancel</button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Instagram Graph API — Recent Media */}
                <Card className="p-4 border border-[#fd1d1d]/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-[#fd1d1d]" />
                      <h4 className="font-semibold text-sm">Recent Media (Graph API)</h4>
                    </div>
                    <button onClick={loadIgApiMedia} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <RefreshCw className={`w-3 h-3 ${igApiLoading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                  </div>
                  {igApiLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-[#fd1d1d]" /></div>
                  ) : igApiMedia.length === 0 ? (
                    <div className="text-center py-6">
                      <SiInstagram className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground">No media fetched yet. Media will appear here after credentials are connected.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {igApiMedia.slice(0, 8).map((m: any) => (
                        <div key={m.id} className="rounded-xl overflow-hidden border border-border/50 bg-card/50 group">
                          {m.thumbnail_url || m.media_url ? (
                            <img
                              src={m.thumbnail_url || m.media_url}
                              alt={m.caption?.slice(0, 30) || ''}
                              className="w-full h-24 object-cover group-hover:opacity-80 transition-opacity"
                            />
                          ) : (
                            <div className="w-full h-24 bg-[#fd1d1d]/5 flex items-center justify-center">
                              <SiInstagram className="w-6 h-6 text-[#fd1d1d]/20" />
                            </div>
                          )}
                          <div className="p-2">
                            <div className="flex gap-2 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" /> {(m.like_count || 0).toLocaleString()}</span>
                              <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> {(m.comments_count || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

              </motion.div>
            </TabsContent>

            <TabsContent value="tools">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#833ab4]" /> AI Tools
                  </h3>
                  <UsageBadge
                    remaining={boost.getRemaining('aiTools')}
                    display={boost.getUsageDisplay('aiTools')}
                    category="aiTools"
                    plan={boost.plan}
                  />
                </div>
                <AiToolsTab
                  artistId={selectedArtist?.id}
                  selectedArtist={selectedArtist}
                  getInstagramData={getInstagramData}
                />
              </div>
            </TabsContent>

            <TabsContent value="create">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ImagePlus className="w-4 h-4 text-[#fd1d1d]" /> Content Creator
                  </h3>
                  <UsageBadge
                    remaining={boost.getRemaining('create')}
                    display={boost.getUsageDisplay('create')}
                    category="create"
                    plan={boost.plan}
                  />
                </div>
                <ContentCreateTab artistId={selectedArtist?.id} selectedArtist={selectedArtist} />
              </div>
            </TabsContent>

            <TabsContent value="growth">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#fcb045]" /> Growth Tools
                  </h3>
                  <UsageBadge
                    remaining={boost.getRemaining('growth')}
                    display={boost.getUsageDisplay('growth')}
                    category="growth"
                    plan={boost.plan}
                  />
                </div>
                <GrowthTab artistId={selectedArtist?.id} />
              </div>
            </TabsContent>

            <TabsContent value="analytics">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-[#E1306C]" /> Analytics
                  </h3>
                  <UsageBadge
                    remaining={boost.getRemaining('analytics')}
                    display={boost.getUsageDisplay('analytics')}
                    category="analytics"
                    plan={boost.plan}
                  />
                </div>
                <ReportsTab artistId={selectedArtist?.id} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Floating AI Chat */}
      <InstagramAiChat />
      <HelpGuideModal open={helpOpen} onOpenChange={setHelpOpen} />



      {/* Standalone IG Boost Pro Pricing Modal */}
      <IgBoostPricing open={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={(artistId, tab) => {
          setWizardOpen(false);
          setActiveTab(tab);
        }}
      />

      {/* Admin Diagnostic Panel */}
      {isAdmin && <PageDiagnosticPanel pageId="ig-boost" />}
    </div>
  );
}
