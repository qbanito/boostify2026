import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { SignIn } from "@clerk/clerk-react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Sparkles,
  Music,
  BarChart3,
  Link2,
  Smartphone,
  Search,
  Check,
  ArrowRight,
  Star,
  Zap,
  ChevronDown,
  ChevronUp,
  Shield,
  Globe,
  Play,
  Headphones,
  TrendingUp,
  Users,
  Eye,
  MousePointerClick,
} from "lucide-react";
import { SiSpotify, SiYoutube, SiInstagram, SiTiktok, SiApplemusic, SiSoundcloud } from "react-icons/si";

const FAQ_ITEMS = [
  {
    question: "Is it really 100% free?",
    answer: "Yes! Your artist landing page is completely free forever. No hidden fees, no credit card required. We offer optional premium features for advanced users, but the core landing page is always free."
  },
  {
    question: "How long does it take to create my page?",
    answer: "About 60 seconds! Just enter your artist name and email, and we'll set up your professional page instantly. You can customize it anytime after."
  },
  {
    question: "Can I use my own domain?",
    answer: "Yes! Premium users can connect their own custom domain. Free users get a boostifymusic.com/artist/your-name URL which is already SEO-optimized."
  },
  {
    question: "What platforms can I connect?",
    answer: "Spotify, Apple Music, YouTube, SoundCloud, Instagram, TikTok, Twitter, and many more. All your links in one place."
  },
  {
    question: "Do I get analytics?",
    answer: "Yes! Track page views, click-through rates, and see where your fans are coming from. All included free."
  }
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "Professional Design",
    description: "Beautiful, mobile-optimized landing page in 60 seconds",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    gradient: "from-orange-500/20 to-orange-600/5",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "See who's visiting your page and track engagement metrics",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    gradient: "from-blue-500/20 to-blue-600/5",
  },
  {
    icon: Link2,
    title: "Smart Link-in-Bio",
    description: "One link for all your platforms, music and merch",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    gradient: "from-green-500/20 to-green-600/5",
  },
  {
    icon: Music,
    title: "Music Integration",
    description: "Embed Spotify, Apple Music, SoundCloud & more natively",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    gradient: "from-purple-500/20 to-purple-600/5",
  },
  {
    icon: Smartphone,
    title: "Mobile Optimized",
    description: "Looks perfect on any device, any screen size",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    gradient: "from-pink-500/20 to-pink-600/5",
  },
  {
    icon: Search,
    title: "SEO Ready",
    description: "Get found on Google with optimized metadata",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    gradient: "from-yellow-500/20 to-yellow-600/5",
  }
];

const TESTIMONIALS = [
  {
    quote: "Finally, a landing page built FOR musicians. My streams increased 40% after adding my Boostify link to my bio.",
    name: "Marcus Chen",
    role: "Hip-Hop Artist • LA",
    initials: "MC",
    color: "from-orange-500 to-red-500",
  },
  {
    quote: "I used to pay $12/month for Linktree. Boostify is free AND has music-specific features. No brainer.",
    name: "Sarah Williams",
    role: "Indie Pop • Nashville",
    initials: "SW",
    color: "from-pink-500 to-purple-500",
  },
  {
    quote: "The analytics helped me understand my audience. Now I know which songs to promote where.",
    name: "DJ Pulse",
    role: "Electronic • Miami",
    initials: "DP",
    color: "from-blue-500 to-cyan-500",
  }
];

const COMPARISON = [
  { feature: "Built for Musicians", boostify: true, linktree: false, carrd: false },
  { feature: "Free Forever", boostify: true, linktree: false, carrd: false },
  { feature: "Music Embeds", boostify: true, linktree: false, carrd: "paid" },
  { feature: "Analytics", boostify: true, linktree: "paid", carrd: false },
  { feature: "SEO Optimized", boostify: true, linktree: false, carrd: false },
  { feature: "Custom Domain", boostify: "premium", linktree: "paid", carrd: "paid" },
];

// Clerk inline CSS fix for social buttons - ensures uniform sizing
const CLERK_SOCIAL_FIX = `
  .cl-socialButtonsBlockButton { 
    height: 44px !important; 
    min-height: 44px !important; 
    max-height: 44px !important;
    display: flex !important; 
    align-items: center !important; 
    justify-content: center !important; 
    gap: 10px !important;
    padding: 0 12px !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }
  .cl-socialButtonsBlockButton img,
  .cl-socialButtonsProviderIcon,
  .cl-socialButtonsProviderIcon__google,
  .cl-socialButtonsProviderIcon__apple,
  .cl-socialButtonsProviderIcon__facebook {
    width: 20px !important;
    height: 20px !important;
    min-width: 20px !important;
    min-height: 20px !important;
    max-width: 20px !important;
    max-height: 20px !important;
    flex-shrink: 0 !important;
    object-fit: contain !important;
  }
  .cl-socialButtonsBlockButtonText {
    font-size: 14px !important;
    font-weight: 500 !important;
    line-height: 1 !important;
  }
  .cl-socialButtons {
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .cl-socialButtonsIconButton {
    width: 44px !important;
    height: 44px !important;
  }
  .cl-internal-b3fm6y { display: none !important; }
  .cl-footer { display: none !important; }
  .cl-footerAction { display: none !important; }
  .cl-rootBox, .cl-card, .cl-main, .cl-form {
    max-width: 100% !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  .cl-socialButtonsBlockButton {
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }
  .cl-socialButtons {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .cl-formButtonPrimary {
    max-width: 100% !important;
    width: 100% !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-sizing: border-box !important;
  }
  .cl-dividerRow {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .cl-alternativeMethods {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .cl-alternativeMethods button,
  .cl-alternativeMethodsBlockButton {
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
  .cl-identityPreview {
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }
  .cl-formFieldInput,
  .cl-formFieldRow,
  .cl-otpCodeField {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  /* Force all Clerk elements to respect container */
  .cl-rootBox *,
  .cl-card * {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
`;

export function ArtistLandingPage() {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // When a visitor clicks "Sign in" from an artist profile page, that page
  // stores the profile path in `auth_redirect_path`. Honor it so the user
  // lands back on the artist page after authenticating instead of the default
  // dashboard. Only artist-profile paths (/artist/...) are honored — a normal
  // login still goes to /my-artists.
  const [postAuthRedirect] = useState<string>(() => {
    try {
      const stored = localStorage.getItem("auth_redirect_path");
      if (stored && /^\/artist\/[^/]/.test(stored)) {
        // Consume it so a later, unrelated login doesn't reuse a stale value.
        localStorage.removeItem("auth_redirect_path");
        return stored;
      }
    } catch {
      /* localStorage unavailable */
    }
    return "/my-artists";
  });

  // Inject clerk fix styles
  useEffect(() => {
    const id = "clerk-social-fix";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = CLERK_SOCIAL_FIX;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ════════ HERO ════════ */}
      <section ref={heroRef} className="relative min-h-[100vh] md:min-h-[90vh] flex items-center overflow-hidden">
        {/* Layered background */}
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/assets/promos/REGGAETON.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500/15 via-transparent to-transparent" />
        </div>

        {/* Floating decorative elements */}
        <motion.div
          className="absolute top-20 right-[15%] w-72 h-72 bg-orange-500/8 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-32 left-[10%] w-48 h-48 bg-purple-500/10 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity }}
        />

        <motion.div className="relative w-full" style={{ opacity: heroOpacity }}>
          <div className="container mx-auto px-4 py-20 md:py-0">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20">
                {/* ── Left: Text ── */}
                <motion.div
                  className="flex-1 text-center lg:text-left min-w-0"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  {/* Animated badge */}
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/25 rounded-full text-orange-400 text-sm font-medium mb-8 backdrop-blur-sm"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                    </span>
                    Free Forever — No Credit Card
                  </motion.div>

                  <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] xl:text-6xl font-extrabold mb-6 leading-[1.1] tracking-tight">
                    Your Music Deserves
                    <br />
                    <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                      A Stage Online
                    </span>
                  </h1>

                  <p className="text-lg md:text-xl text-gray-300/90 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                    Build your <span className="text-white font-semibold">professional artist page</span> in 60 seconds.
                    All your music, links, merch, and analytics —
                    <span className="text-orange-400 font-medium"> completely free</span>.
                  </p>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 md:gap-8 justify-center lg:justify-start mb-8">
                    {[
                      { icon: Users, value: "5K+", label: "Artists" },
                      { icon: Eye, value: "2M+", label: "Views" },
                      { icon: MousePointerClick, value: "150K+", label: "Clicks" },
                    ].map((s, i) => (
                      <motion.div
                        key={s.label}
                        className="text-center"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                      >
                        <div className="flex items-center gap-1.5 justify-center mb-0.5">
                          <s.icon className="h-3.5 w-3.5 text-orange-500" />
                          <span className="text-xl font-bold text-white">{s.value}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 uppercase tracking-wider">{s.label}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Platform row */}
                  <motion.div
                    className="flex items-center gap-3 justify-center lg:justify-start"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                  >
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider mr-1">Works with</span>
                    {[
                      { Icon: SiSpotify, c: "text-green-500" },
                      { Icon: SiApplemusic, c: "text-pink-400" },
                      { Icon: SiYoutube, c: "text-red-500" },
                      { Icon: SiInstagram, c: "text-pink-500" },
                      { Icon: SiTiktok, c: "text-white" },
                      { Icon: SiSoundcloud, c: "text-orange-400" },
                    ].map(({ Icon, c }, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 0.65, scale: 1 }}
                        whileHover={{ opacity: 1, scale: 1.2 }}
                        transition={{ duration: 0.25, delay: 0.9 + i * 0.06 }}
                      >
                        <Icon className={`w-5 h-5 ${c}`} />
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>

                {/* ── Right: Sign-In Card ── */}
                <motion.div
                  className="w-full max-w-[340px] sm:max-w-[380px] flex-shrink-0 mx-auto lg:mx-0"
                  initial={{ opacity: 0, y: 30, rotateY: -5 }}
                  animate={{ opacity: 1, y: 0, rotateY: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                >
                  <div className="relative">
                    {/* Glow behind card */}
                    <div className="absolute -inset-3 bg-gradient-to-br from-orange-500/20 via-red-500/10 to-purple-500/15 rounded-3xl blur-xl" />

                    <Card className="relative bg-gray-950/90 border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/60 rounded-2xl overflow-hidden max-w-full">
                      {/* Accent bar */}
                      <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-red-500 to-purple-600" />

                      <div className="p-4 sm:p-5 overflow-hidden max-w-full">
                        {/* Header */}
                        <div className="text-center mb-5">
                          <motion.div
                            className="w-12 h-12 mx-auto bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-orange-500/20"
                            animate={{ rotate: [0, 3, -3, 0] }}
                            transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
                          >
                            <Music className="h-6 w-6 text-white" />
                          </motion.div>
                          <h2 className="text-lg font-bold text-white mb-0.5">Create Your Free Page</h2>
                          <p className="text-gray-400 text-xs">Sign up with Google or Email — takes 60 seconds</p>
                        </div>

                        {/* Clerk */}
                        <SignIn
                          appearance={{
                            variables: {
                              colorPrimary: "#f97316",
                              colorBackground: "transparent",
                              colorText: "#ffffff",
                              colorTextSecondary: "#9ca3af",
                              colorInputBackground: "#111827",
                              colorInputText: "#ffffff",
                              borderRadius: "0.75rem",
                              spacingUnit: "0.9rem",
                              fontSize: "0.875rem",
                            },
                            elements: {
                              rootBox: "mx-auto w-full max-w-full overflow-hidden [&_.cl-internal-b3fm6y]:hidden",
                              card: "bg-transparent shadow-none p-0 gap-2 w-full max-w-full overflow-hidden",
                              header: "hidden",
                              headerTitle: "hidden",
                              headerSubtitle: "hidden",
                              logoBox: "hidden",
                              logoImage: "hidden",
                              main: "gap-2 w-full max-w-full overflow-hidden",
                              form: "gap-2 w-full max-w-full overflow-hidden",
                              formFieldRow: "mb-1.5",
                              formFieldLabel: "text-gray-400 font-medium text-xs mb-1",
                              formFieldInput:
                                "bg-gray-900 border border-gray-700 text-white placeholder:text-gray-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 rounded-xl h-11 px-4 transition-all w-full text-sm",
                              formFieldInputShowPasswordButton: "text-gray-500 hover:text-white",
                              formButtonPrimary:
                                "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold shadow-lg shadow-orange-500/20 rounded-xl h-11 text-sm transition-all hover:shadow-orange-500/30 w-full",
                              footerAction: "hidden",
                              footer: "hidden",
                              footerActionLink: "text-orange-400 hover:text-orange-300",
                              socialButtons: "flex flex-col gap-2.5 w-full max-w-full overflow-hidden",
                              socialButtonsBlockButton:
                                "bg-gray-900/80 border border-gray-700 text-white hover:bg-gray-800 hover:border-gray-600 rounded-xl h-11 transition-all w-full max-w-full flex items-center justify-center gap-2.5 text-sm font-medium overflow-hidden box-border",
                              socialButtonsBlockButtonText: "text-gray-200 font-medium text-sm leading-none",
                              socialButtonsProviderIcon:
                                "w-5 h-5 min-w-[20px] min-h-[20px] max-w-[20px] max-h-[20px] flex-shrink-0",
                              socialButtonsBlockButtonArrow: "hidden",
                              socialButtonsIconButton:
                                "bg-gray-900/80 border border-gray-700 rounded-xl h-11 w-11 flex items-center justify-center hover:bg-gray-800 transition-all",
                              socialButtonsProviderIcon__apple:
                                "w-5 h-5 min-w-[20px] min-h-[20px] max-w-[20px] max-h-[20px]",
                              socialButtonsProviderIcon__facebook:
                                "w-5 h-5 min-w-[20px] min-h-[20px] max-w-[20px] max-h-[20px]",
                              socialButtonsProviderIcon__google:
                                "w-5 h-5 min-w-[20px] min-h-[20px] max-w-[20px] max-h-[20px]",
                              dividerRow: "my-2.5",
                              dividerLine: "bg-gray-800",
                              dividerText: "text-gray-600 text-[11px] px-3",
                              identityPreview: "bg-gray-900/80 border border-gray-700 rounded-xl",
                              identityPreviewText: "text-white",
                              identityPreviewEditButton: "text-orange-400 hover:text-orange-300",
                              otpCodeFieldInput: "bg-gray-900 border-gray-700 text-white rounded-lg",
                              alert: "bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl",
                              alertText: "text-red-400",
                              alternativeMethodsBlockButton:
                                "bg-gray-900/80 border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl w-full text-sm",
                            },
                            layout: {
                              socialButtonsPlacement: "top",
                              showOptionalFields: false,
                              socialButtonsVariant: "blockButton",
                            },
                          }}
                          routing="hash"
                          signUpUrl="/signup"
                          afterSignInUrl={postAuthRedirect}
                          afterSignUpUrl={postAuthRedirect}
                        />

                        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-800/60">
                          {[
                            { icon: Shield, text: "Secure" },
                            { icon: Zap, text: "Instant" },
                            { icon: Globe, text: "Free" },
                          ].map((b) => (
                            <div key={b.text} className="flex items-center gap-1 text-[10px] text-gray-500">
                              <b.icon className="h-3 w-3 text-gray-600" />
                              {b.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="h-6 w-6 text-gray-600" />
        </motion.div>
      </section>

      {/* ════════ SHOWCASE: Phone Preview + Info ════════ */}
      <section className="py-20 md:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black" />
        <div className="relative container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              {/* Phone mockup */}
              <motion.div
                className="relative flex-shrink-0"
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
              >
                <div className="relative w-[280px] md:w-[300px] mx-auto">
                  {/* Glow */}
                  <div className="absolute -inset-6 bg-gradient-to-br from-orange-500/20 to-purple-500/10 rounded-[3rem] blur-2xl" />
                  {/* Phone frame */}
                  <div className="relative bg-gray-900 rounded-[2.5rem] p-3 border border-gray-700/50 shadow-2xl">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-10" />
                    {/* Screen */}
                    <div className="rounded-[2rem] overflow-hidden bg-gradient-to-b from-gray-800 via-gray-900 to-black aspect-[9/19.5]">
                      <div className="p-5 pt-10 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-3 shadow-lg shadow-orange-500/30">
                          <Headphones className="h-10 w-10 text-white" />
                        </div>
                        <h4 className="text-white font-bold text-base mb-0.5">Alex Rivera</h4>
                        <p className="text-gray-400 text-[10px] mb-4">R&B / Soul • New York</p>
                        {/* Mini platform buttons */}
                        {[
                          { Icon: SiSpotify, label: "Listen on Spotify", bg: "bg-green-600" },
                          { Icon: SiApplemusic, label: "Apple Music", bg: "bg-pink-600" },
                          { Icon: SiYoutube, label: "Watch on YouTube", bg: "bg-red-600" },
                        ].map(({ Icon, label, bg }) => (
                          <div key={label} className={`${bg} w-full rounded-xl py-2 px-3 mb-2 flex items-center gap-2`}>
                            <Icon className="w-3.5 h-3.5 text-white" />
                            <span className="text-white text-[10px] font-medium">{label}</span>
                          </div>
                        ))}
                        {/* Mini stats */}
                        <div className="flex gap-4 mt-3">
                          {[
                            { v: "12K", l: "Fans" },
                            { v: "48K", l: "Streams" },
                            { v: "2.1K", l: "Clicks" },
                          ].map((s) => (
                            <div key={s.l} className="text-center">
                              <div className="text-white text-xs font-bold">{s.v}</div>
                              <div className="text-gray-500 text-[8px]">{s.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Info side */}
              <motion.div
                className="flex-1 text-center lg:text-left"
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.15 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-medium mb-5">
                  <Play className="h-3 w-3" />
                  See it in action
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 leading-tight">
                  One Page.<br />
                  <span className="text-orange-500">Every Platform.</span>
                </h2>
                <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto lg:mx-0">
                  Your fans are everywhere — Spotify, YouTube, Instagram, TikTok.
                  Give them one beautiful link that leads to everything.
                </p>
                <div className="space-y-4 max-w-md mx-auto lg:mx-0">
                  {[
                    { icon: Music, text: "Embed music players directly on your page" },
                    { icon: TrendingUp, text: "Track clicks, views, and fan engagement" },
                    { icon: Shield, text: "Your data stays yours — no third-party selling" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                    >
                      <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-4 w-4 text-orange-500" />
                      </div>
                      <span className="text-gray-300 text-sm">{item.text}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ FEATURES GRID ════════ */}
      <section className="py-20 md:py-28 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/5 via-transparent to-transparent" />
        <div className="relative container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">Stand Out</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Built specifically for independent musicians. Not another generic link-in-bio tool.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <Card className={`group relative bg-gray-900/50 border-gray-800/60 overflow-hidden hover:${feature.borderColor} transition-all duration-300 hover:shadow-lg hover:shadow-black/30 h-full`}>
                  {/* Subtle gradient glow on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  
                  <div className="relative p-6">
                    {/* Icon */}
                    <div className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ SOCIAL PROOF ════════ */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950/80 to-black" />
        {/* Decorative gradient strip */}
        <div className="absolute inset-y-0 right-0 w-1/3 opacity-[0.06] hidden lg:block bg-gradient-to-l from-orange-500/20 via-purple-500/10 to-transparent" />

        <div className="relative container mx-auto px-4">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Trusted by <span className="text-orange-500">5,000+</span> Artists
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              See what independent musicians are saying about Boostify
            </p>
          </motion.div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-14">
            {[
              { value: "5,000+", label: "Artists", icon: Users },
              { value: "2M+", label: "Page Views", icon: Eye },
              { value: "150K+", label: "Link Clicks", icon: MousePointerClick },
              { value: "4.9★", label: "Rating", icon: Star },
            ].map((stat, index) => (
              <motion.div
                key={index}
                className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 text-center backdrop-blur-sm"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <stat.icon className="h-4 w-4 text-orange-500 mx-auto mb-2" />
                <div className="text-2xl md:text-3xl font-bold text-white mb-0.5">{stat.value}</div>
                <div className="text-gray-500 text-xs">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-gray-900/40 border-gray-800/50 p-6 h-full hover:border-gray-700/50 transition-colors">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-orange-500 text-orange-500" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-5 text-sm leading-relaxed">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3 mt-auto">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {testimonial.initials}
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">{testimonial.name}</div>
                      <div className="text-gray-500 text-xs">{testimonial.role}</div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Platform logos */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <p className="text-gray-600 text-xs uppercase tracking-widest mb-5">Works with your favorite platforms</p>
            <div className="flex justify-center items-center gap-8 md:gap-12 flex-wrap">
              {[
                { Icon: SiSpotify, color: "text-green-500", label: "Spotify" },
                { Icon: SiApplemusic, color: "text-pink-400", label: "Apple Music" },
                { Icon: SiYoutube, color: "text-red-500", label: "YouTube" },
                { Icon: SiSoundcloud, color: "text-orange-400", label: "SoundCloud" },
                { Icon: SiInstagram, color: "text-pink-500", label: "Instagram" },
                { Icon: SiTiktok, color: "text-gray-300", label: "TikTok" },
              ].map(({ Icon, color, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-100 transition-all duration-300 hover:scale-110">
                  <Icon className={`w-7 h-7 ${color}`} />
                  <span className="text-[10px] text-gray-600 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════ COMPARISON TABLE ════════ */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Artists Choose <span className="text-orange-500">Boostify</span>
            </h2>
            <p className="text-gray-400">See how we compare to generic link-in-bio tools</p>
          </motion.div>

          <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-4 px-5 text-gray-400 font-medium text-sm">Feature</th>
                    <th className="text-center py-4 px-4 text-sm">
                      <span className="text-orange-500 font-bold">Boostify</span>
                    </th>
                    <th className="text-center py-4 px-4 text-gray-500 font-medium text-sm">Linktree</th>
                    <th className="text-center py-4 px-4 text-gray-500 font-medium text-sm">Carrd</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, index) => (
                    <tr key={index} className="border-b border-gray-800/40">
                      <td className="py-3.5 px-5 text-white text-sm">{row.feature}</td>
                      <td className="text-center py-3.5 px-4">
                        {row.boostify === true ? (
                          <div className="w-6 h-6 bg-green-500/15 rounded-full flex items-center justify-center mx-auto">
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          </div>
                        ) : row.boostify === "premium" ? (
                          <span className="text-[11px] text-orange-400 font-medium bg-orange-500/10 px-2 py-0.5 rounded-full">Premium</span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                      <td className="text-center py-3.5 px-4">
                        {row.linktree === true ? (
                          <Check className="h-4 w-4 text-green-500/60 mx-auto" />
                        ) : row.linktree === "paid" ? (
                          <span className="text-[11px] text-yellow-500/70 font-medium">$5/mo</span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                      <td className="text-center py-3.5 px-4">
                        {row.carrd === true ? (
                          <Check className="h-4 w-4 text-green-500/60 mx-auto" />
                        ) : row.carrd === "paid" ? (
                          <span className="text-[11px] text-yellow-500/70 font-medium">$9/mo</span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-orange-500/5">
                    <td className="py-4 px-5 font-bold text-white text-sm">Price</td>
                    <td className="text-center py-4 px-4">
                      <span className="text-green-400 font-bold text-lg">FREE</span>
                    </td>
                    <td className="text-center py-4 px-4 text-gray-500 text-sm">$5/mo</td>
                    <td className="text-center py-4 px-4 text-gray-500 text-sm">$9/mo</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════ FAQ ════════ */}
      <section className="py-20 md:py-28 bg-gray-950/50">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently Asked <span className="text-orange-500">Questions</span>
            </h2>
          </motion.div>

          <div className="max-w-2xl mx-auto space-y-3">
            {FAQ_ITEMS.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="bg-gray-900/40 border-gray-800/50 overflow-hidden cursor-pointer hover:border-gray-700/50 transition-colors"
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                >
                  <div className="p-5 flex items-center justify-between gap-3">
                    <h3 className="font-medium text-white text-sm">{faq.question}</h3>
                    <motion.div
                      animate={{ rotate: expandedFAQ === index ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    </motion.div>
                  </div>
                  {expandedFAQ === index && (
                    <motion.div
                      className="px-5 pb-5 text-gray-400 text-sm border-t border-gray-800/50 pt-4 leading-relaxed"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                    >
                      {faq.answer}
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="py-24 md:py-36 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-transparent to-purple-500/10" />
        </div>

        <div className="relative container mx-auto px-4 text-center">
          <motion.div
            className="max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-orange-500/25"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
            >
              <Zap className="h-8 w-8 text-white" />
            </motion.div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
              Ready to{" "}
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                Stand Out
              </span>
              ?
            </h2>
            <p className="text-xl text-gray-400 mb-10 leading-relaxed">
              Your professional artist page is waiting.
              <br className="hidden md:block" />
              Join 5,000+ artists already growing on Boostify.
            </p>

            <Button
              onClick={() =>
                document.querySelector(".cl-rootBox")?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className="h-14 px-10 text-lg font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all hover:scale-[1.02]"
            >
              Create My Free Page Now
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>

            <p className="mt-6 text-gray-600 text-sm flex items-center justify-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              No credit card required — Setup in 60 seconds — Free forever
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <div className="py-8 text-center border-t border-gray-800/50">
        <p className="text-gray-600 text-sm">
          © 2026 Boostify Music • Built for independent artists
        </p>
      </div>
    </div>
  );
}
