import { useState, useEffect, Suspense, lazy } from "react";
import { Header } from "../components/layout/header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAuth } from "../hooks/use-auth";
import { useArtistProfile } from "../hooks/use-artist-profile";
import { useSpotifyConnection } from "../hooks/use-spotify-connection";
import { useSpotifyBoostLimits } from "../hooks/use-spotify-boost-limits";
import { useToast } from "../hooks/use-toast";
import { ArtistSelector } from "../components/promotion/artist-selector";
import { SpotifySubscriptionBanner } from "../components/spotify-boost/subscription-banner";
import { SpotifyPricing } from "../components/spotify-boost/spotify-pricing";
import { SpotifyAiChat } from "../components/spotify-boost/ai-chat";
import { SpotifyOnboardingWizard } from "../components/spotify-boost/onboarding-wizard";
import { SpotifyExtensionTab } from "../components/spotify-boost/extension-tab";
import { SpotifyToolsTab } from "../components/spotify-boost/tools-tab";
import { SpotifyPitchTab } from "../components/spotify-boost/pitch-tab";
import { SpotifyGrowthTab } from "../components/spotify-boost/growth-tab";
import { SpotifyAnalyticsTab } from "../components/spotify-boost/analytics-tab";
import { SpotifyIntelligenceTab } from "../components/spotify-boost/intelligence-tab";
import { PageDiagnosticPanel } from "../components/admin/page-diagnostic-panel";
import { motion } from "framer-motion";
import { SiSpotify } from "react-icons/si";
import {
  Zap, Rocket, Plug, Wrench, Mail, TrendingUp, BarChart2,
  Sparkles, Crown, CheckCircle, Chrome, Download, Brain
} from "lucide-react";

const SpotifyAnimationPlayer = lazy(() =>
  import("../components/remotion/SpotifyAnimationPlayer").then(mod => ({ default: mod.SpotifyAnimationPlayer }))
);

export default function SpotifyPage() {
  const { user, userSubscription, isAdmin } = useAuth();
  const { selectedArtist, getSpotifyData } = useArtistProfile();
  const sp = useSpotifyConnection();
  const boost = useSpotifyBoostLimits();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("extension");
  const [pricingOpen, setPricingOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const isConnected = sp.isConnected;

  // Dynamic month/year for the limited-time offer badge so it never goes stale
  const offerLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Build live KPI tiles from the latest extension snapshot
  const snap = sp.latestSnapshot;
  const prevSnap = sp.snapshots && sp.snapshots.length > 1 ? sp.snapshots[1] : null;
  const computeDelta = (curr?: number, prev?: number) => {
    if (!curr || !prev || prev === 0) return null;
    const diff = curr - prev;
    if (diff === 0) return null;
    const pct = Math.round((diff / prev) * 100);
    return { diff, pct, positive: diff > 0 };
  };
  const kpis = snap
    ? [
        { label: 'Monthly Listeners', value: snap.monthlyListeners, delta: computeDelta(snap.monthlyListeners, prevSnap?.monthlyListeners), accent: 'from-green-500 to-emerald-400' },
        { label: 'Followers', value: snap.followers, delta: computeDelta(snap.followers, prevSnap?.followers), accent: 'from-emerald-500 to-teal-400' },
        { label: 'Total Streams', value: snap.totalStreams, delta: computeDelta(snap.totalStreams, prevSnap?.totalStreams), accent: 'from-lime-500 to-green-400' },
      ]
    : [];

  // Handle payment success/cancelled redirect from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success') {
      toast({ title: '🎉 Welcome to Spotify Boost Pro!', description: 'Your subscription is active. Enjoy unlimited tools!' });
      window.history.replaceState({}, '', '/spotify');
    } else if (payment === 'cancelled') {
      toast({ title: 'Payment cancelled', description: 'You can upgrade anytime.', variant: 'destructive' });
      window.history.replaceState({}, '', '/spotify');
    }
  }, [toast]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-20">
        <div className="flex-1 max-w-6xl mx-auto space-y-5 sm:space-y-6 p-3 sm:p-6 lg:p-8 pt-4 sm:pt-6">

          {/* --- Hero --- */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600/10 via-emerald-600/10 to-green-500/10 border border-green-500/20 p-4 sm:p-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -left-24 w-72 h-72 bg-green-500/15 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10 flex flex-col lg:flex-row gap-6 items-center">
              <div className="flex-1 space-y-3 text-center lg:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                  <Zap className="w-3 h-3 text-green-400" />
                  <span className="text-[11px] font-semibold">AI-Powered Growth</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight">
                  <span className="text-foreground">Spotify </span>
                  <span className="bg-gradient-to-r from-green-500 to-emerald-400 bg-clip-text text-transparent">
                    Growth Suite
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-md mx-auto lg:mx-0">
                  Standalone tool — no full suite required. Grow your streams, find playlists, pitch curators, and manage everything from one place.
                </p>
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start items-center">
                  <Button size="sm"
                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 hover:opacity-90 transition-all hover:scale-105"
                    onClick={() => setWizardOpen(true)}>
                    <Rocket className="mr-1.5 h-4 w-4" /> Start Growing
                  </Button>
                  {boost.isFreePlan && (
                    <Button size="sm"
                      className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all"
                      onClick={() => setPricingOpen(true)}>
                      <Crown className="mr-1.5 h-4 w-4" /> Go Pro - $12/mo
                    </Button>
                  )}
                  <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-medium">Limited Time Offer ({offerLabel})</span>
                </div>
              </div>
              <div className="w-full lg:w-[300px] shrink-0">
                <Suspense fallback={
                  <div className="w-full h-[200px] rounded-2xl bg-gradient-to-br from-green-500/15 to-emerald-500/15 animate-pulse flex items-center justify-center">
                    <SiSpotify className="w-10 h-10 text-green-500 animate-bounce" />
                  </div>
                }>
                  <SpotifyAnimationPlayer width="100%" height={200} autoPlay loop className="w-full rounded-2xl" />
                </Suspense>
              </div>
            </div>
          </motion.div>

          {/* --- Extension CTA Banner --- */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <div className={`p-3 sm:p-4 rounded-xl border-2 transition-colors ${isConnected
              ? "border-green-500/30 bg-green-500/5"
              : "border-green-600/30 bg-gradient-to-r from-green-600/5 to-emerald-500/5"
            }`}>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isConnected ? "bg-green-500/10" : "bg-green-600/15"
                }`}>
                  {isConnected
                    ? <CheckCircle className="w-6 h-6 text-green-500" />
                    : <Chrome className="w-6 h-6 text-green-500" />
                  }
                </div>
                <div className="flex-1 text-center sm:text-left">
                  {isConnected ? (
                    <>
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <span className="font-semibold text-sm text-green-600">Connected</span>
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sp.latestSnapshot ? `${sp.formatNumber(sp.latestSnapshot.monthlyListeners)} listeners · ${sp.formatNumber(sp.latestSnapshot.followers)} followers` : "Syncing data..."}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <span className="font-semibold text-sm">Connect Chrome Extension</span>
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">REQUIRED</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Install the extension to sync your Spotify data and execute AI actions directly.
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isConnected ? (
                    <Button size="sm" variant="outline" className="text-xs h-8 rounded-lg" onClick={() => setActiveTab("extension")}>
                      <Plug className="w-3.5 h-3.5 mr-1" /> Manage
                    </Button>
                  ) : (
                    <Button size="sm" className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs h-8 rounded-lg hover:opacity-90"
                      onClick={() => setActiveTab("extension")}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Install Extension
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* --- Artist Selector --- */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <SiSpotify className="w-4 h-4 text-green-500" />
              <span className="text-sm font-semibold">Artist Profile</span>
            </div>
            <ArtistSelector label="" />
          </div>

          {/* --- Live KPI Strip (only when extension is connected) --- */}
          {isConnected && kpis.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="grid grid-cols-3 gap-2 sm:gap-3"
            >
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="relative overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3 sm:p-4"
                >
                  <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${kpi.accent}`} />
                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    {kpi.label}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-lg sm:text-2xl font-black text-foreground">
                      {sp.formatNumber(kpi.value)}
                    </span>
                    {kpi.delta && (
                      <span
                        className={`text-[10px] sm:text-xs font-semibold inline-flex items-center gap-0.5 ${
                          kpi.delta.positive ? 'text-green-500' : 'text-red-400'
                        }`}
                      >
                        {kpi.delta.positive ? '▲' : '▼'} {Math.abs(kpi.delta.pct)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* --- Subscription Banner --- */}
          <SpotifySubscriptionBanner onUpgrade={() => setPricingOpen(true)} />

          {/* --- 6 Tabs (Connect / Tools / Pitch / Growth / Analytics / Intel) --- */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="sticky top-16 z-30 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 bg-background/85 backdrop-blur-md">
              <div className="flex justify-center">
                <TabsList className="inline-flex p-1 bg-card/80 backdrop-blur-sm border border-border rounded-xl gap-0.5 max-w-full overflow-x-auto no-scrollbar">
                  {[
                    { value: "extension", icon: Plug, label: "Connect" },
                    { value: "tools", icon: Wrench, label: "Tools" },
                    { value: "pitch", icon: Mail, label: "Pitch" },
                    { value: "growth", icon: TrendingUp, label: "Growth" },
                    { value: "analytics", icon: BarChart2, label: "Analytics" },
                    { value: "intelligence", icon: Brain, label: "Intel" },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      aria-label={tab.label}
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-green-600/20 px-2.5 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-sm font-semibold rounded-lg transition-all gap-1.5 whitespace-nowrap"
                    >
                      <tab.icon className="w-4 h-4 shrink-0" />
                      <span>{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            {/* Free plan info */}
            {boost.isFreePlan && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 flex-wrap">
                <Badge variant="outline" className="text-xs gap-1.5 bg-green-500/5 border-green-500/20">
                  <Sparkles className="w-3 h-3 text-green-500" />
                  Free Plan - Try all tools with daily limits
                </Badge>
                <Button size="sm" variant="ghost" className="text-xs h-6 gap-1 text-green-500 hover:text-green-400"
                  onClick={() => setPricingOpen(true)}>
                  <Crown className="w-3 h-3" /> Upgrade for unlimited
                </Button>
              </motion.div>
            )}

            <TabsContent value="extension">
              <SpotifyExtensionTab />
            </TabsContent>

            <TabsContent value="tools">
              <SpotifyToolsTab artistId={selectedArtist?.id} selectedArtist={selectedArtist} getSpotifyData={getSpotifyData} />
            </TabsContent>

            <TabsContent value="pitch">
              <SpotifyPitchTab artistId={selectedArtist?.id} selectedArtist={selectedArtist} getSpotifyData={getSpotifyData} />
            </TabsContent>

            <TabsContent value="growth">
              <SpotifyGrowthTab artistId={selectedArtist?.id} />
            </TabsContent>

            <TabsContent value="analytics">
              <SpotifyAnalyticsTab artistId={selectedArtist?.id} />
            </TabsContent>

            <TabsContent value="intelligence">
              <SpotifyIntelligenceTab artistId={selectedArtist?.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Floating AI Chat — gives users instant Spotify growth advice from any tab */}
        {user && <SpotifyAiChat />}
      </main>

      {/* Floating AI Chat */}
      <SpotifyAiChat />

      {/* Onboarding Wizard */}
      <SpotifyOnboardingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={(artistId, tab) => {
          setWizardOpen(false);
          setActiveTab(tab);
        }}
      />

      {/* Standalone Spotify Boost Pro Pricing Modal */}
      <SpotifyPricing open={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* Admin Diagnostic Panel */}
      {isAdmin && <PageDiagnosticPanel pageId="spotify-boost" />}
    </div>
  );
}
