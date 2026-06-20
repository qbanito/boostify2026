import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../hooks/use-auth";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  CheckCircle2, UserPlus, Music2, Sparkles, ArrowRight, Rocket,
  Zap, Video, Image, ShoppingBag, BarChart2, Brain, Mic2,
  Globe, Shield, Crown, TrendingUp, Star
} from "lucide-react";
import { SiSpotify, SiYoutube, SiInstagram, SiTiktok } from "react-icons/si";

const TOOLS = [
  {
    icon: SiInstagram,
    name: "Instagram Boost",
    desc: "AI-powered follower growth, engagement analytics, and automated posting strategies.",
    color: "from-[#833ab4] to-[#fd1d1d]",
    textColor: "text-pink-400",
    borderColor: "border-pink-500/20",
    bgColor: "bg-pink-500/5",
    href: "/instagram-boost",
    tag: "Standalone",
  },
  {
    icon: SiSpotify,
    name: "Spotify Growth Suite",
    desc: "Playlist pitching, stream optimization, and listener analytics for maximum reach.",
    color: "from-green-500 to-emerald-400",
    textColor: "text-green-400",
    borderColor: "border-green-500/20",
    bgColor: "bg-green-500/5",
    href: "/spotify",
    tag: "Standalone",
  },
  {
    icon: SiYoutube,
    name: "YouTube Boost",
    desc: "Video SEO, thumbnail optimization, and view growth strategies powered by AI.",
    color: "from-red-500 to-orange-400",
    textColor: "text-red-400",
    borderColor: "border-red-500/20",
    bgColor: "bg-red-500/5",
    href: "/youtube-views",
    tag: "Standalone",
  },
  {
    icon: Video,
    name: "Music Video Creator",
    desc: "Create professional music videos with AI-generated visuals and effects.",
    color: "from-violet-500 to-purple-400",
    textColor: "text-violet-400",
    borderColor: "border-violet-500/20",
    bgColor: "bg-violet-500/5",
    href: "/music-video-creator",
    tag: "Free",
  },
  {
    icon: Image,
    name: "AI Image Generator",
    desc: "Generate album covers, social posts, and promotional graphics instantly.",
    color: "from-cyan-500 to-blue-400",
    textColor: "text-cyan-400",
    borderColor: "border-cyan-500/20",
    bgColor: "bg-cyan-500/5",
    href: "/image-generator-simple",
    tag: "Free",
  },
  {
    icon: Music2,
    name: "AI Music Generator",
    desc: "Compose original beats, melodies, and full tracks with artificial intelligence.",
    color: "from-amber-500 to-yellow-400",
    textColor: "text-amber-400",
    borderColor: "border-amber-500/20",
    bgColor: "bg-amber-500/5",
    href: "/music-generator",
    tag: "Pro",
  },
  {
    icon: ShoppingBag,
    name: "Merch Store",
    desc: "Print-on-demand merchandise with your branding - zero upfront cost.",
    color: "from-rose-500 to-pink-400",
    textColor: "text-rose-400",
    borderColor: "border-rose-500/20",
    bgColor: "bg-rose-500/5",
    href: "/merchandise",
    tag: "Pro",
  },
  {
    icon: Mic2,
    name: "Live Podcast Studio",
    desc: "Record, stream, and distribute podcasts directly from your browser.",
    color: "from-indigo-500 to-blue-400",
    textColor: "text-indigo-400",
    borderColor: "border-indigo-500/20",
    bgColor: "bg-indigo-500/5",
    href: "/live-podcast-studio",
    tag: "Free",
  },
  {
    icon: Brain,
    name: "AI Agents",
    desc: "Autonomous AI agents that manage your social media, outreach, and growth 24/7.",
    color: "from-fuchsia-500 to-pink-400",
    textColor: "text-fuchsia-400",
    borderColor: "border-fuchsia-500/20",
    bgColor: "bg-fuchsia-500/5",
    href: "/ai-agents",
    tag: "Premium",
  },
];

const FEATURES = [
  { icon: Shield, text: "Free artist profile - no credit card required" },
  { icon: Zap, text: "Instant access to all free-tier tools" },
  { icon: Globe, text: "Public artist profile & store page" },
  { icon: TrendingUp, text: "Growth analytics & performance tracking" },
  { icon: Crown, text: "Upgrade anytime to unlock pro features" },
  { icon: Star, text: "Independent tools - pay only for what you need" },
];

const STEPS = [
  {
    num: "01",
    icon: UserPlus,
    title: "Create Account",
    desc: "Sign up with Google or email in seconds. Completely free.",
    color: "from-primary to-blue-400",
  },
  {
    num: "02",
    icon: Music2,
    title: "Build Your Profile",
    desc: "Add your artist name, bio, genre, links, and profile images.",
    color: "from-violet-500 to-purple-400",
  },
  {
    num: "03",
    icon: Rocket,
    title: "Launch & Grow",
    desc: "Start using Instagram, Spotify, YouTube Boost and 20+ AI tools.",
    color: "from-amber-500 to-orange-400",
  },
];

export default function ArtistSetupPage() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 space-y-12">

        {/* ── Hero Section ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-violet-600/10 to-amber-500/10 border border-primary/20 p-6 sm:p-10"
        >
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-primary/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-violet-500/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-center">
            <div className="flex-1 space-y-5 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Free Artist Onboarding</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Your Music Career{" "}
                <span className="bg-gradient-to-r from-primary via-violet-400 to-amber-400 bg-clip-text text-transparent">
                  Starts Here
                </span>
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto lg:mx-0">
                Create your free artist profile in under 2 minutes. Get instant access to AI-powered growth tools for Instagram, Spotify, YouTube, and more.
              </p>

              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                {!isAuthenticated ? (
                  <Link href="/auth">
                    <Button size="lg" className="bg-gradient-to-r from-primary to-violet-600 text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:opacity-90 transition-all hover:scale-105">
                      <Rocket className="mr-2 h-4 w-4" />
                      Create Free Profile
                    </Button>
                  </Link>
                ) : (
                  <Link href="/my-artist">
                    <Button size="lg" className="bg-gradient-to-r from-primary to-violet-600 text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:opacity-90 transition-all hover:scale-105">
                      <Rocket className="mr-2 h-4 w-4" />
                      Go to My Profile
                    </Button>
                  </Link>
                )}
                <Link href="#tools">
                  <Button size="lg" variant="outline" className="rounded-xl font-semibold">
                    Explore Tools
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {user?.email && (
                <p className="text-xs text-muted-foreground">
                  Signed in as {user.email}
                </p>
              )}
            </div>

            {/* Right: Platform Icons Grid */}
            <div className="flex-shrink-0 w-full lg:w-auto">
              <div className="grid grid-cols-2 gap-3 max-w-[220px] mx-auto">
                {[
                  { Icon: SiInstagram, bg: "from-[#833ab4] to-[#fd1d1d]", label: "Instagram" },
                  { Icon: SiSpotify, bg: "from-green-500 to-emerald-400", label: "Spotify" },
                  { Icon: SiYoutube, bg: "from-red-500 to-orange-400", label: "YouTube" },
                  { Icon: SiTiktok, bg: "from-cyan-400 to-pink-400", label: "TikTok" },
                ].map(({ Icon, bg, label }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-br ${bg} shadow-lg`}
                  >
                    <Icon className="w-7 h-7 text-white" />
                    <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">{label}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── How It Works ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-6"
        >
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black">How It Works</h2>
            <p className="text-sm text-muted-foreground">Get started in 3 simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
              >
                <Card className="relative p-6 h-full border-border/50 hover:border-primary/30 transition-colors group overflow-hidden">
                  <div className="absolute top-3 right-3 text-4xl font-black text-muted-foreground/10 group-hover:text-primary/10 transition-colors">
                    {step.num}
                  </div>
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} mb-4`}>
                    <step.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Tools Showcase ── */}
        <motion.section
          id="tools"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 mx-auto">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">20+ AI Tools</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Grow
              </span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              From social media growth to music creation, merchandise, and analytics - all in one platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOOLS.map((tool, i) => (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * i }}
              >
                <Link href={tool.href}>
                  <Card className={`p-5 h-full ${tool.borderColor} ${tool.bgColor} hover:scale-[1.02] transition-all cursor-pointer group`}>
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-lg`}>
                        <tool.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-sm truncate">{tool.name}</h3>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              tool.tag === "Standalone"
                                ? "border-green-500/40 text-green-400 bg-green-500/10"
                                : tool.tag === "Free"
                                ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                                : tool.tag === "Pro"
                                ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                                : "border-purple-500/40 text-purple-400 bg-purple-500/10"
                            }`}
                          >
                            {tool.tag}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                      <span>Open tool</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Features & Benefits ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="p-6 sm:p-8 border-primary/15 bg-gradient-to-br from-primary/5 via-background to-violet-500/5">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1 space-y-5">
                <div>
                  <h2 className="text-2xl font-black mb-2">Why Artists Choose Boostify</h2>
                  <p className="text-sm text-muted-foreground">
                    Join thousands of independent artists using AI to accelerate their career.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FEATURES.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <f.icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats column */}
              <div className="flex-shrink-0 flex flex-row lg:flex-col gap-4 justify-center">
                {[
                  { value: "20+", label: "AI Tools" },
                  { value: "$0", label: "To Start" },
                  { value: "3", label: "Platforms" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-4 rounded-xl bg-background border border-border/50 min-w-[90px]">
                    <div className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
                      {stat.value}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.section>

        {/* ── CTA Section ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center space-y-5"
        >
          <h2 className="text-2xl sm:text-3xl font-black">
            Ready to{" "}
            <span className="bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
              Get Started?
            </span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Create your free artist profile and start using Boostify's AI tools today. No credit card needed.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            {!isAuthenticated ? (
              <Link href="/auth">
                <Button size="lg" className="bg-gradient-to-r from-primary to-violet-600 text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:opacity-90 transition-all hover:scale-105">
                  <Rocket className="mr-2 h-4 w-4" />
                  Create Free Profile
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/my-artist">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-violet-600 text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:opacity-90 transition-all hover:scale-105">
                    <Music2 className="mr-2 h-4 w-4" />
                    Edit My Profile
                  </Button>
                </Link>
                <Link href="/my-artists">
                  <Button size="lg" variant="outline" className="rounded-xl font-semibold">
                    View My Artists
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span>100% Free</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </motion.section>

      </main>
    </div>
  );
}
