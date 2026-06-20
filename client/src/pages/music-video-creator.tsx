import { useState, useEffect, useMemo } from "react";
import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Video, Users, Star, Wand2, Bot, CloudCog, Edit, Sparkles, ArrowRight, Monitor, Apple, Download, Play, Zap, Film, Palette, Music, Crown, ChevronRight, Lock, Clapperboard, Layers, Mic2, Check } from "lucide-react";
import { DirectorsList } from "../components/music-video/directors-list";
import { MusicVideoAI } from "../components/music-video/music-video-ai";
import { MotionDNASection } from "../components/music-video/motion-dna-section";
import { motion } from "framer-motion";
import { Link, useSearch } from "wouter";
import type { DirectorProfile } from "../data/directors";
import { useAuth } from "../hooks/use-auth";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { isAdminEmail } from "../../../shared/constants";

// Interface for pre-filled data from artist profile
interface PreFilledData {
  artistName?: string;
  artistId?: number; // PostgreSQL ID del artista existente
  songName?: string;
  songId?: string;
  audioUrl?: string;
  coverArt?: string;
  images?: string[];
}

// Plan access check
const PLAN_HIERARCHY: Record<string, number> = {
  free: 0, artist: 1, creator: 2, professional: 3, enterprise: 4,
};
const LEGACY_MAP: Record<string, string> = {
  basic: "creator", Basic: "creator", pro: "professional", Pro: "professional",
  premium: "enterprise", Premium: "enterprise",
};
function resolvePlan(plan: string): string {
  return LEGACY_MAP[plan] || (plan in PLAN_HIERARCHY ? plan : "free");
}

export default function MusicVideoCreator() {
  const [activeTab, setActiveTab] = useState<'directors' | 'ai' | 'editor'>('ai');
  const [selectedDirector, setSelectedDirector] = useState<DirectorProfile | null>(null);
  const { user, userSubscription } = useAuth();
  const isAdmin = user?.email ? isAdminEmail(user.email) : false;
  const searchString = useSearch();
  
  const resolvedUser = resolvePlan(userSubscription || "free");
  const hasAccess = isAdmin || PLAN_HIERARCHY[resolvedUser] >= PLAN_HIERARCHY["enterprise"];

  // Parse URL parameters for pre-filled data from artist profile
  const preFilledData = useMemo<PreFilledData>(() => {
    console.log('🔍 [URL] Raw search string:', searchString);
    const params = new URLSearchParams(searchString);
    const artistIdRaw = params.get('artistId');
    const data = {
      artistName: params.get('artist') || undefined,
      artistId: artistIdRaw ? parseInt(artistIdRaw) : undefined,
      songName: params.get('song') || undefined,
      songId: params.get('songId') || undefined,
      audioUrl: params.get('audioUrl') || undefined,
      coverArt: params.get('coverArt') || undefined,
      images: params.get('images') ? params.get('images')!.split(',') : undefined
    };
    console.log('🎵 [URL] Parsed preFilledData:', data);
    return data;
  }, [searchString]);

  const handleDirectorSelected = (director: DirectorProfile) => {
    setSelectedDirector(director);
    setActiveTab('ai');
  };

  if (!hasAccess) {
    return <MusicVideoLockedPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col">
        <HeroSection />
        <ContentSection 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          selectedDirector={selectedDirector}
          onDirectorSelected={handleDirectorSelected}
          preFilledData={preFilledData}
        />
        <MotionDNASection />
      </main>
    </div>
  );
}

// ─── LOCKED PAGE (upsell experience) ────────────────────────────────────────

const VIDEO_STYLES = [
  { name: "Cinematic", gradient: "from-orange-500 to-red-600", icon: Film, desc: "Dramatic visuals with cinematic color grading" },
  { name: "Abstract Art", gradient: "from-purple-500 to-pink-600", icon: Palette, desc: "AI-generated artistic visual interpretations" },
  { name: "Performance", gradient: "from-blue-500 to-cyan-500", icon: Mic2, desc: "Dynamic performance-style video editing" },
  { name: "Lyric Video", gradient: "from-emerald-500 to-teal-500", icon: Music, desc: "Animated typography synced to your music" },
  { name: "Storyboard", gradient: "from-amber-500 to-orange-600", icon: Clapperboard, desc: "Narrative-driven visual storytelling" },
  { name: "Multi-Layer", gradient: "from-rose-500 to-violet-600", icon: Layers, desc: "Complex multi-layered visual compositions" },
];

const CAPABILITY_FEATURES = [
  {
    icon: Wand2,
    title: "AI Video Generation",
    description: "Upload your song and images — our AI creates a fully produced music video in minutes",
    gradient: "from-orange-500 to-pink-500",
  },
  {
    icon: Users,
    title: "Professional Directors",
    description: "Collaborate with experienced music video directors who bring your vision to life",
    gradient: "from-blue-500 to-purple-500",
  },
  {
    icon: Sparkles,
    title: "MotionDNA Technology",
    description: "Our proprietary system analyzes your music's DNA to generate perfectly synced visuals",
    gradient: "from-emerald-500 to-cyan-500",
  },
  {
    icon: Film,
    title: "Multiple Visual Styles",
    description: "Choose from cinematic, abstract, performance, lyric and narrative video styles",
    gradient: "from-rose-500 to-orange-500",
  },
  {
    icon: CloudCog,
    title: "Cloud Rendering",
    description: "Render in up to 4K resolution with professional-grade cloud processing power",
    gradient: "from-violet-500 to-blue-500",
  },
  {
    icon: Edit,
    title: "Built-in Editor",
    description: "Fine-tune your video with our timeline editor — trim, reorder, add effects",
    gradient: "from-amber-500 to-red-500",
  },
];

const AVAILABLE_PLANS = [
  { name: "Elevate", price: "$49.99", monthly: true, highlight: false, features: ["Music Video Creator", "500 Credits/month", "AI Video (Basic)"] },
  { name: "Amplify", price: "$89.99", monthly: true, highlight: false, features: ["Advanced AI Studio", "2,000 Credits/month", "50 Creative Canvas"] },
  { name: "Dominate", price: "$149.99", monthly: true, highlight: true, features: ["Unlimited Video Studio", "10,000 Credits/month", "Premium everything"] },
];

const MusicVideoLockedPage = () => {
  const { toast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const startUnlockCheckout = async () => {
    try {
      setCheckoutLoading(true);
      const returnPath = window.location.pathname + window.location.search;
      const response: any = await apiRequest({
        url: '/api/modules/music-video-creator/unlock-checkout',
        method: 'POST',
        data: { returnPath },
      });

      if (response?.url) {
        window.location.href = response.url;
        return;
      }

      throw new Error(response?.error || 'No se pudo iniciar el checkout de Stripe');
    } catch (error: any) {
      const message = error?.message || 'Inténtalo de nuevo.';
      if (message.toLowerCase().includes('authentication') || message.toLowerCase().includes('401')) {
        toast({ title: 'Inicia sesión', description: 'Necesitas una cuenta para desbloquear.', variant: 'destructive' });
        window.location.href = '/auth';
      } else {
        toast({ title: 'No se pudo iniciar el pago', description: message, variant: 'destructive' });
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
  <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
    <Header />

    {/* ── HERO ────────────────────────────────── */}
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background video */}
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      >
        <source src="/assets/promos/REGGAETON.mp4" type="video/mp4" />
      </video>

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-black/70 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(249,115,22,0.08)_0%,_transparent_70%)]" />

      {/* Animated grid lines */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 container mx-auto px-4 text-center max-w-5xl">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-orange-400/90 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5">
            <Lock className="h-3 w-3" />
            Premium Feature
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-[1.1] mb-4 sm:mb-6"
        >
          AI Music Video{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500">
            Studio
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-base sm:text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-8 leading-relaxed"
        >
          Transform your tracks into stunning visual experiences. Upload your song, choose a style, 
          and let AI create a professional music video — or collaborate with real directors.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10"
        >
          <Button
            size="lg"
            onClick={startUnlockCheckout}
            disabled={checkoutLoading}
            className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 text-white px-8 py-6 text-base shadow-2xl shadow-orange-600/30 hover:shadow-orange-600/50 transition-all group"
          >
            {checkoutLoading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Crown className="h-5 w-5 mr-2" />
            )}
            Unlock $49
            <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Link href="/pricing">
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white/80 hover:bg-white/10 px-8 py-6 text-base"
            >
              View All Plans
            </Button>
          </Link>
        </motion.div>

        {/* Floating preview — fake editor UI */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="relative max-w-3xl mx-auto"
        >
          <div className="relative rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/50">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-[11px] text-white/30 ml-2 font-mono">Boostify AI Video Studio</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-medium">4K</div>
                <div className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">AI Ready</div>
              </div>
            </div>
            {/* Content area — video style grid */}
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {VIDEO_STYLES.map((style, i) => (
                  <motion.div
                    key={style.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                    className="group relative aspect-video rounded-lg overflow-hidden cursor-default"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-80 group-hover:opacity-100 transition-opacity`} />
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="relative z-10 flex flex-col items-center justify-center h-full gap-1.5">
                      <style.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-lg" />
                      <span className="text-[10px] sm:text-xs font-bold text-white tracking-wide drop-shadow">{style.name}</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="h-3.5 w-3.5 text-white ml-0.5" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              {/* Fake timeline */}
              <div className="mt-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center">
                  <Play className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <div className="flex-1 h-8 rounded bg-white/5 overflow-hidden flex items-center px-2">
                  <div className="flex gap-[2px] w-full h-4">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${30 + Math.random() * 70}%`,
                          background: `linear-gradient(to top, rgba(249,115,22,${0.3 + Math.random() * 0.5}), rgba(236,72,153,${0.3 + Math.random() * 0.5}))`,
                          alignSelf: 'flex-end',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-white/30 font-mono w-12 text-right">3:42</span>
              </div>
            </div>
            {/* Lock overlay */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-500/30">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <p className="text-sm font-semibold text-white">Upgrade to unlock</p>
                <p className="text-xs text-white/50 mt-1">Available from Elevate plan</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>

    {/* ── CAPABILITIES ───────────────────────── */}
    <section className="relative py-16 sm:py-24">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16"
        >
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-orange-400/80 mb-3 block">
            What You'll Unlock
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Everything You Need to Create{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">
              Stunning Videos
            </span>
          </h2>
          <p className="text-white/50 max-w-xl mx-auto text-sm sm:text-base">
            Professional-grade music video creation powered by AI and human talent
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {CAPABILITY_FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-all duration-300"
            >
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300`} />
              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── DEMO SHOWCASE ──────────────────────── */}
    <DemoVideosShowcase />

    {/* ── HOW IT WORKS ─────────────────────── */}
    <section className="relative py-16 sm:py-24 border-t border-white/5">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Three Steps to Your Video
          </h2>
          <p className="text-white/50 max-w-lg mx-auto text-sm sm:text-base">
            From upload to final cut in minutes — not weeks
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {[
            { step: "01", title: "Upload Your Track", desc: "Drop your song file and reference images. Our AI analyzes the beat, mood, and energy.", icon: Music, color: "from-orange-500/20 to-orange-500/5", border: "border-orange-500/20", iconColor: "text-orange-400" },
            { step: "02", title: "Choose Your Style", desc: "Pick from 6+ visual styles — cinematic, abstract, performance, lyric, and more.", icon: Palette, color: "from-pink-500/20 to-pink-500/5", border: "border-pink-500/20", iconColor: "text-pink-400" },
            { step: "03", title: "Generate & Edit", desc: "AI creates your video. Use the timeline editor to fine-tune every detail.", icon: Play, color: "from-purple-500/20 to-purple-500/5", border: "border-purple-500/20", iconColor: "text-purple-400" },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              {i < 2 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/10 to-transparent" />
              )}
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${item.color} border ${item.border} flex items-center justify-center mx-auto mb-5`}>
                <item.icon className={`h-8 w-8 ${item.iconColor}`} />
              </div>
              <div className="text-xs font-bold text-orange-400/60 tracking-widest uppercase mb-2">
                Step {item.step}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── PLANS THAT INCLUDE THIS ─────────── */}
    <section className="relative py-16 sm:py-24 border-t border-white/5">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Choose Your Plan
          </h2>
          <p className="text-white/50 max-w-lg mx-auto text-sm sm:text-base">
            Music Video Creator is available on these plans
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {AVAILABLE_PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border p-6 sm:p-8 text-center transition-all
                ${plan.highlight
                  ? 'border-orange-500/40 bg-gradient-to-b from-orange-500/[0.08] to-transparent shadow-xl shadow-orange-500/10'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-1 rounded-full">
                    Recommended
                  </span>
                </div>
              )}
              <h3 className={`text-xl font-bold mb-1 ${plan.highlight ? 'text-orange-400' : 'text-white'}`}>
                {plan.name}
              </h3>
              <div className="flex items-baseline justify-center gap-1 mb-5">
                <span className="text-3xl sm:text-4xl font-extrabold text-white">{plan.price}</span>
                <span className="text-sm text-white/40">/mo</span>
              </div>
              <ul className="space-y-3 mb-6 text-left">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                    <Zap className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/pricing">
                <Button
                  className={`w-full ${plan.highlight
                    ? 'bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                  }`}
                >
                  {plan.highlight ? 'Get Started' : 'See Plan'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── FINAL CTA ───────────────────────── */}
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 via-pink-600/10 to-purple-600/10" />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      <div className="relative z-10 container mx-auto px-4 text-center max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
            Ready to Create Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">
              First Music Video?
            </span>
          </h2>
          <p className="text-white/50 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            Join thousands of artists who are already creating professional music videos with Boostify's AI-powered studio.
          </p>
          <Button
            size="lg"
            onClick={startUnlockCheckout}
            disabled={checkoutLoading}
            className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 text-white px-10 py-7 text-lg shadow-2xl shadow-orange-600/30 hover:shadow-orange-600/50 transition-all group"
          >
            {checkoutLoading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Crown className="h-5 w-5 mr-2" />
            )}
            Unlock $49
            <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </div>
    </section>
  </div>
  );
};

// ─── DEMO VIDEOS SHOWCASE ──────────────────────────────────────────────────

const DEMO_VIDEOS = [
  { src: "/assets/promos/MUSIC_VIDEOS_DEMOS/kling_la_camara_4142.mp4", title: "La Cámara", style: "Cinematic", gradient: "from-orange-500 to-red-600" },
  { src: "/assets/promos/MUSIC_VIDEOS_DEMOS/kling_demo_661.mp4", title: "Neon Dreams", style: "Abstract Art", gradient: "from-purple-500 to-pink-600" },
  { src: "/assets/promos/MUSIC_VIDEOS_DEMOS/kling_demo_672.mp4", title: "Electric Pulse", style: "Performance", gradient: "from-blue-500 to-cyan-500" },
  { src: "/assets/promos/MUSIC_VIDEOS_DEMOS/kling_demo_691.mp4", title: "Urban Flow", style: "Multi-Layer", gradient: "from-rose-500 to-violet-600" },
  { src: "/assets/promos/MUSIC_VIDEOS_DEMOS/kling_demo_728.mp4", title: "Night Vision", style: "Storyboard", gradient: "from-amber-500 to-orange-600" },
  { src: "/assets/promos/MUSIC_VIDEOS_DEMOS/REGGAETON.mp4", title: "Reggaeton Heat", style: "Cinematic", gradient: "from-emerald-500 to-teal-500" },
  { src: "/assets/promos/MUSIC_VIDEOS_DEMOS/ROCK.mp4", title: "Rock Anthem", style: "Performance", gradient: "from-red-500 to-orange-600" },
];

const DemoVideoCard = ({ video, index }: { video: typeof DEMO_VIDEOS[0]; index: number }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="group relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black/40 hover:border-orange-500/30 transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPlaying(false); }}
    >
      <div className="relative aspect-[9/16] sm:aspect-video overflow-hidden">
        <video
          className="w-full h-full object-cover"
          src={video.src}
          muted
          loop
          playsInline
          autoPlay={isHovered}
          ref={(el) => {
            if (el) {
              if (isHovered) el.play().catch(() => {});
              else { el.pause(); el.currentTime = 0; }
            }
          }}
        />
        {/* Dark overlay when not hovered */}
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100'}`} />
        
        {/* Gradient border glow on hover */}
        <div className={`absolute inset-0 rounded-2xl transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          style={{ boxShadow: 'inset 0 0 30px rgba(249,115,22,0.15)' }} />

        {/* Play button overlay */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100'}`}>
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
            <Play className="h-6 w-6 text-white ml-0.5" />
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-10">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">{video.title}</h4>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-gradient-to-r ${video.gradient} text-white mt-1`}>
                {video.style}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              <Film className="h-3 w-3" />
              AI Generated
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const DemoVideosShowcase = () => (
  <section className="relative py-16 sm:py-24 border-t border-white/5 overflow-hidden">
    {/* Subtle background glow */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.04),transparent_70%)]" />
    
    <div className="container mx-auto px-4 max-w-7xl relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12 sm:mb-16"
      >
        <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-orange-400/90 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
          <Play className="h-3 w-3" />
          Real AI Output
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
          See What Our AI{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500">
            Actually Creates
          </span>
        </h2>
        <p className="text-white/50 max-w-xl mx-auto text-sm sm:text-base">
          100% AI-generated music videos — no templates, no stock footage. Every frame is unique.
        </p>
      </motion.div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {DEMO_VIDEOS.map((video, i) => (
          <DemoVideoCard key={video.src} video={video} index={i} />
        ))}
      </div>

      {/* CTA below demos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mt-10 sm:mt-14"
      >
        <p className="text-white/40 text-sm mb-4">
          Ready to create your own? Upgrade to start generating.
        </p>
        <Link href="/pricing">
          <Button
            size="lg"
            className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 text-white px-8 py-6 text-base shadow-2xl shadow-orange-600/30 hover:shadow-orange-600/50 transition-all group"
          >
            <Crown className="h-5 w-5 mr-2" />
            Create Your Music Video
            <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </motion.div>
    </div>
  </section>
);

// ─── ACTUAL PAGE (unlocked) ─────────────────────────────────────────────────

const HeroSection = () => (
  <div className="relative w-full overflow-hidden">
    {/* Background video */}
    <video
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover opacity-70"
    >
      <source src="/background-video.mp4" type="video/mp4" />
    </video>

    {/* Gradient overlays */}
    <div className="absolute inset-0 bg-gradient-to-b from-background via-black/50 to-background" />
    <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />

    {/* Content — pt-24 clears the sticky header */}
    <div className="relative z-10 container mx-auto px-4 pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
        
        {/* Title block */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-3"
        >
          <span className="inline-block text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-orange-400/80 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5">
            AI-Powered Music Video Studio
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white leading-tight">
            Bring Your Music{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-orange-400">
              to Life
            </span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
            Transform your music into stunning visuals with AI-powered technology 
            or collaborate with professional directors
          </p>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link href="/motion-dna">
            <Button
              size="lg"
              className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white px-6 sm:px-8 py-5 sm:py-6 shadow-2xl shadow-orange-600/40 hover:shadow-orange-600/60 transition-all group text-sm sm:text-base"
              data-testid="button-motion-dna"
            >
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-pulse" />
              Discover MotionDNA — Q2 2026
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        {/* Desktop Download Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="pt-4 border-t border-white/10"
        >
          <p className="text-[11px] text-white/40 uppercase tracking-widest mb-3 font-medium">
            Desktop App — Synced with your Boostify account
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
                href="https://github.com/convoycubano1-glitch/boostify_music/releases/download/v1.0.0/Boostify-Timeline-1.0.0-Setup.exe"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 hover:border-orange-500/50 rounded-xl text-white text-sm font-medium transition-all group backdrop-blur-sm"
            >
              <Monitor className="h-4 w-4 text-orange-400" />
              <span>Descargar para PC</span>
              <Download className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-y-0.5 transition-all" />
            </a>
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-white/5 border border-white/8 rounded-xl text-white/30 text-sm cursor-default select-none">
              <Apple className="h-4 w-4" />
              <span>Mac — Coming Soon</span>
            </div>
          </div>
          <p className="text-[10px] text-white/25 mt-2.5">
            v1.0.0 · Windows 10+ · Projects sync automatically with boostifymusic.com
          </p>
        </motion.div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-8 sm:mt-12 max-w-3xl mx-auto">
        {featuresData.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 hover:border-orange-500/30 transition-all group"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                <feature.icon className="h-5 w-5 text-orange-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
              <p className="text-xs text-white/50 leading-relaxed">{feature.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

const featuresData = [
  {
    icon: Star,
    title: "Professional Directors",
    description: "Connect with experienced music video directors who understand your vision",
  },
  {
    icon: Wand2,
    title: "AI-Powered Creation",
    description: "Generate unique video concepts and storyboards using cutting-edge AI technology",
  },
  {
    icon: CloudCog,
    title: "Seamless Workflow",
    description: "From concept to final cut, manage your entire music video production process",
  },
];

// ─── WORKFLOW WIZARD ──────────────────────────────────────────────────────────

const WizardSteps = ({
  activeTab,
  selectedDirector,
  onTabChange,
}: {
  activeTab: 'directors' | 'ai' | 'editor';
  selectedDirector: DirectorProfile | null;
  onTabChange: (tab: 'directors' | 'ai' | 'editor') => void;
}) => {
  const steps = [
    { id: 'directors' as const, label: 'Choose Director', sublabel: 'Optional', icon: Users },
    { id: 'ai' as const, label: 'AI Creation', sublabel: 'Generate scenes', icon: Bot },
    { id: 'editor' as const, label: 'Edit & Export', sublabel: 'Fine-tune', icon: Edit },
  ];

  const activeIndex = steps.findIndex(s => s.id === activeTab);

  const getState = (idx: number, stepId: string) => {
    if (stepId === 'directors' && selectedDirector !== null) return 'completed';
    if (idx < activeIndex) return 'completed';
    if (idx === activeIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="w-full max-w-lg mx-auto mb-5 sm:mb-7 px-2">
      <div className="flex items-center justify-center">
        {steps.map((step, idx) => {
          const state = getState(idx, step.id);
          const isClickable = idx <= activeIndex + 1;
          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => isClickable && onTabChange(step.id)}
                disabled={!isClickable}
                className={`flex flex-col items-center gap-1.5 group transition-all duration-200 ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <div
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                    state === 'completed'
                      ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                      : state === 'active'
                      ? 'bg-orange-500/20 border-2 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/30'
                      : 'bg-white/5 border-2 border-white/10 text-white/25'
                  }`}
                >
                  {state === 'completed' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                  {state === 'active' && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-orange-500" />
                  )}
                </div>
                <div className="text-center hidden sm:block">
                  <div
                    className={`text-[10px] font-semibold leading-none ${
                      state === 'active'
                        ? 'text-orange-400'
                        : state === 'completed'
                        ? 'text-emerald-400'
                        : 'text-white/25'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className={`text-[9px] mt-0.5 ${
                    state !== 'upcoming' ? 'text-white/25' : 'text-white/15'
                  }`}>
                    {step.sublabel}
                  </div>
                </div>
              </button>
              {idx < steps.length - 1 && (
                <div
                  className={`mx-2 sm:mx-4 transition-all duration-500 ${
                    getState(idx, step.id) === 'completed'
                      ? 'w-10 sm:w-16 h-px bg-gradient-to-r from-emerald-500/60 to-orange-400/40'
                      : 'w-10 sm:w-16 h-px bg-white/10'
                  }`}
                  style={{ marginBottom: '20px' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ContentSectionProps {
  activeTab: 'directors' | 'ai' | 'editor';
  setActiveTab: (tab: 'directors' | 'ai' | 'editor') => void;
  selectedDirector: DirectorProfile | null;
  onDirectorSelected: (director: DirectorProfile) => void;
  preFilledData?: PreFilledData;
}

const ContentSection = ({ activeTab, setActiveTab, selectedDirector, onDirectorSelected, preFilledData }: ContentSectionProps) => (
  <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-12 flex-1">
    <div className="flex flex-col items-center mb-4 sm:mb-8 text-center">
      {/* Workflow Wizard */}
      <WizardSteps
        activeTab={activeTab}
        selectedDirector={selectedDirector}
        onTabChange={setActiveTab}
      />
      <h2 className="text-lg sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-4">Choose Your Creation Path</h2>
      <p className="text-xs sm:text-sm md:text-base text-muted-foreground max-w-xl mb-4 sm:mb-6 px-2 sm:px-4">
        Choose a director for style inspiration, generate your video with AI, then fine-tune in the editor
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 w-full sm:w-auto">
        <Button
          variant={activeTab === 'ai' ? 'default' : 'outline'}
          onClick={() => setActiveTab('ai')}
          className={`w-full sm:w-auto min-h-[40px] sm:min-h-[44px] text-sm sm:text-base py-1 px-3 sm:py-2 sm:px-4 ${
            activeTab === 'ai' 
              ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/30' 
              : 'border-orange-500/50 hover:bg-orange-500/10'
          }`}
          size="default"
        >
          <Bot className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="whitespace-nowrap">AI Video Creation</span>
        </Button>
        <Button
          variant={activeTab === 'directors' ? 'default' : 'outline'}
          onClick={() => setActiveTab('directors')}
          className="w-full sm:w-auto min-h-[40px] sm:min-h-[44px] text-sm sm:text-base py-1 px-3 sm:py-2 sm:px-4"
          size="default"
        >
          <Users className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="whitespace-nowrap">Work with Directors</span>
        </Button>
        <Link href="/professional-editor">
          <Button
            variant={activeTab === 'editor' ? 'default' : 'outline'}
            className="w-full sm:w-auto min-h-[40px] sm:min-h-[44px] text-sm sm:text-base py-1 px-3 sm:py-2 sm:px-4"
            size="default"
          >
            <Video className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="whitespace-nowrap">Gallery</span>
          </Button>
        </Link>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:gap-6 max-w-[1200px] mx-auto">
      {/* Main content area - Only showing content for active tab */}
      <div className="w-full">
        {activeTab === 'directors' ? (
          <DirectorsList onDirectorSelected={onDirectorSelected} />
        ) : (
          <MusicVideoAI 
            preSelectedDirector={selectedDirector}
            preFilledArtistName={preFilledData?.artistName}
            preFilledArtistId={preFilledData?.artistId}
            preFilledSongName={preFilledData?.songName}
            preFilledAudioUrl={preFilledData?.audioUrl}
            preFilledCoverArt={preFilledData?.coverArt}
            preFilledImages={preFilledData?.images}
          />
        )}
      </div>

      {/* Pro Tip: MotionSync feature callout */}
      {activeTab === 'ai' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="max-w-[1200px] mx-auto w-full"
        >
          <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-500/5 via-pink-500/5 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
              <Mic2 className="h-5 w-5 text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-white">🎥 MotionSync — Your Phone as Director</span>
                <span className="text-[9px] font-bold tracking-widest uppercase text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5">
                  PRO FEATURE
                </span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                After generating scenes, open the <strong className="text-white/70">Timeline Editor</strong> → click the{' '}
                <strong className="text-rose-400">MotionSync</strong> button to record real camera movements from your phone's
                gyroscope — pan, tilt, orbit — and apply them to your AI clips.
              </p>
            </div>
            <Link href="/professional-editor">
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs"
              >
                Open Editor
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  </div>
);