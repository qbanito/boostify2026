import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Crown, Rocket, Instagram, Youtube, Music2, ArrowRight, Sparkles, Zap,
  HelpCircle, ChevronLeft, CheckCircle2, Star, TrendingUp, Users, BarChart2,
  FileText, Hash, Globe, ChevronRight, Megaphone, Play, BookOpen,
} from "lucide-react";
import { Link } from "wouter";

interface PromoteModalProps {
  open: boolean;
  onClose: () => void;
  artistName: string;
  accentColor?: string;
}

/* ─── Platform definitions ─── */
const platforms = [
  {
    id: "instagram",
    name: "Instagram Boost",
    tagline: "Grow your audience & go viral",
    description: "AI-powered growth, content creation, hashtag optimization & audience extraction",
    href: "/instagram-boost",
    icon: Instagram,
    gradient: "from-[#833AB4] via-[#FD1D1D] to-[#F77737]",
    gradientBg: "from-purple-600/20 via-red-500/10 to-orange-500/10",
    glow: "rgba(131,58,180,0.2)",
    border: "rgba(131,58,180,0.35)",
    badgeColor: "text-purple-300 bg-purple-500/15 border-purple-500/25",
    features: ["AI Captions & Hashtags", "Follower Analytics", "Content Calendar"],
    stat: { value: "3×", label: "avg reach" },
  },
  {
    id: "youtube",
    name: "YouTube Boost",
    tagline: "Rank higher, grow faster",
    description: "SEO optimization, thumbnail AI, view analytics & channel growth strategies",
    href: "/youtube-views",
    icon: Youtube,
    gradient: "from-[#FF0000] via-[#CC0000] to-[#990000]",
    gradientBg: "from-red-600/20 via-red-500/10 to-transparent",
    glow: "rgba(255,0,0,0.15)",
    border: "rgba(255,0,0,0.3)",
    badgeColor: "text-red-300 bg-red-500/15 border-red-500/25",
    features: ["Video SEO Tools", "Thumbnail Generator", "Audience Insights"],
    stat: { value: "5×", label: "more views" },
  },
  {
    id: "spotify",
    name: "Spotify Boost",
    tagline: "Land playlists, grow streams",
    description: "Playlist pitching, stream analytics, listener demographics & release strategy",
    href: "/spotify",
    icon: Music2,
    gradient: "from-[#1DB954] via-[#1AA34A] to-[#168D40]",
    gradientBg: "from-green-600/20 via-green-500/10 to-transparent",
    glow: "rgba(29,185,84,0.15)",
    border: "rgba(29,185,84,0.3)",
    badgeColor: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
    features: ["Playlist Pitching", "Stream Analytics", "Release Planner"],
    stat: { value: "10×", label: "stream boost" },
  },
];

/* ─── Guide content ─── */
const guideItems = [
  {
    icon: Crown,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    title: "Premium Tools Badge",
    description: "This badge confirms you have access to all AI-powered promotion tools included in your Boostify subscription. No extra charges — everything is bundled.",
  },
  {
    icon: Instagram,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    title: "Instagram Boost",
    description: "Opens Boostify's Instagram growth suite. You'll find an AI caption writer, hashtag optimizer, audience extractor, and automated posting schedule — all tailored to your artist persona.",
  },
  {
    icon: Youtube,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    title: "YouTube Boost",
    description: "Access YouTube SEO tools that rank your videos higher. Generate click-worthy thumbnails with AI, get keyword suggestions, and track audience retention data in one dashboard.",
  },
  {
    icon: Music2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    title: "Spotify Boost",
    description: "Submit your releases for playlist pitching, analyze your listener demographics, and plan future drops. The release planner suggests optimal dates based on your genre trends.",
  },
  {
    icon: TrendingUp,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    title: "Growth Stats (3×, 5×, 10×)",
    description: "These are average improvement multipliers reported by artists using Boostify's promotion tools compared to organic growth alone. Results vary based on engagement and budget.",
  },
  {
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    title: "AI Features (Captions, Hashtags, SEO…)",
    description: "Every platform card lists AI features included. These are real tools inside each section — click a card to navigate directly to that tool's full page and start using it immediately.",
  },
  {
    icon: ArrowRight,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    title: "Arrow / Navigation",
    description: "Clicking any platform card closes this modal and takes you directly to that promotion section. You can always return by clicking 'Promote' on your artist profile again.",
  },
];

/* ─── Sub-components ─── */
function GuidePanelFull({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      key="guide"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="absolute inset-0 z-10 flex flex-col bg-[#0d0d18] rounded-3xl overflow-hidden"
    >
      {/* Guide header */}
      <div className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-white/70" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white">How It Works</h2>
          <p className="text-xs text-white/35 mt-0.5">Guide to every element in the Promote panel</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
          <BookOpen className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wide">Docs</span>
        </div>
      </div>

      {/* Guide items */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
        {guideItems.map((item, idx) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className={`flex gap-3 p-3.5 rounded-2xl border ${item.border} bg-white/2`}
          >
            <div className={`shrink-0 w-9 h-9 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold mb-1 ${item.color}`}>{item.title}</p>
              <p className="text-xs text-white/50 leading-relaxed">{item.description}</p>
            </div>
          </motion.div>
        ))}

        {/* Bottom tip */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-orange-500/8 border border-orange-500/20">
          <Sparkles className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-orange-300 mb-1">Pro Tip</p>
            <p className="text-xs text-white/45 leading-relaxed">
              Start with the platform where your audience already engages most — then expand using Boostify's cross-platform analytics to identify where your next growth opportunity is.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main component ─── */
export function PromoteModal({ open, onClose, artistName, accentColor = "#8B5CF6" }: PromoteModalProps) {
  const [hoveredPlatform, setHoveredPlatform] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-50"
            onClick={onClose}
          />

          {/* Modal wrapper */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
          >
            {/* Card shell */}
            <div className="relative w-full sm:max-w-[420px] overflow-hidden
              rounded-t-[28px] sm:rounded-3xl
              border-t sm:border border-white/8
              bg-[#0d0d18]
              shadow-[0_0_80px_rgba(0,0,0,0.7)]
              max-h-[94dvh] sm:max-h-none
              flex flex-col"
            >
              {/* Ambient glow layers */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-inherit">
                <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full blur-[100px] opacity-25"
                  style={{ background: accentColor }} />
                <div className="absolute -bottom-40 -left-24 w-80 h-80 rounded-full bg-purple-700/15 blur-[120px]" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
              </div>

              {/* Mobile drag handle */}
              <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              {/* AnimatePresence for guide slide */}
              <div className="relative flex-1 flex flex-col overflow-hidden">
                <AnimatePresence mode="wait">
                  {showGuide ? (
                    <GuidePanelFull key="guide" onBack={() => setShowGuide(false)} />
                  ) : (
                    <motion.div
                      key="main"
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ type: "spring", damping: 28, stiffness: 280 }}
                      className="flex-1 flex flex-col"
                    >
                      {/* ── Header ── */}
                      <div className="relative shrink-0 px-5 pt-5 pb-4">
                        {/* Close + Guide row */}
                        <div className="flex items-center justify-between mb-5">
                          {/* Guide button */}
                          <button
                            onClick={() => setShowGuide(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-cyan-500/15 border border-white/8 hover:border-cyan-500/30 transition-all group"
                          >
                            <HelpCircle className="w-3.5 h-3.5 text-white/40 group-hover:text-cyan-400 transition-colors" />
                            <span className="text-xs text-white/40 group-hover:text-cyan-300 transition-colors font-medium">How it works</span>
                            <ChevronRight className="w-3 h-3 text-white/25 group-hover:text-cyan-400 transition-colors" />
                          </button>

                          {/* Close */}
                          <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/8 transition-colors"
                          >
                            <X className="w-4 h-4 text-white/50" />
                          </button>
                        </div>

                        {/* Premium badge */}
                        <div className="flex justify-center mb-4">
                          <motion.div
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", delay: 0.1 }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30"
                          >
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[11px] font-bold text-amber-300 tracking-widest uppercase">Premium Tools</span>
                          </motion.div>
                        </div>

                        {/* Title */}
                        <div className="text-center">
                          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                            Promote Your Music
                          </h2>
                          <p className="mt-2 text-sm text-white/45 max-w-[280px] mx-auto leading-relaxed">
                            Boost{" "}
                            <span className="text-white/80 font-semibold">{artistName}</span>{" "}
                            across every major platform with AI
                          </p>
                        </div>
                      </div>

                      {/* ── Platform Cards ── */}
                      <div className="relative px-4 pb-4 space-y-2.5 overflow-y-auto">
                        {platforms.map((platform, index) => (
                          <motion.div
                            key={platform.id}
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 + index * 0.07, type: "spring", damping: 22 }}
                          >
                            <Link href={platform.href}>
                              <motion.button
                                onHoverStart={() => setHoveredPlatform(platform.id)}
                                onHoverEnd={() => setHoveredPlatform(null)}
                                whileHover={{ scale: 1.012 }}
                                whileTap={{ scale: 0.975 }}
                                onClick={onClose}
                                className="w-full group relative overflow-hidden rounded-2xl border text-left transition-all duration-300"
                                style={{
                                  borderColor: hoveredPlatform === platform.id ? platform.border : "rgba(255,255,255,0.07)",
                                  background: hoveredPlatform === platform.id
                                    ? `radial-gradient(ellipse at 20% 50%, ${platform.glow}, transparent 70%)`
                                    : "rgba(255,255,255,0.025)",
                                }}
                              >
                                <div className="relative flex items-center gap-3.5 p-4">
                                  {/* Platform icon */}
                                  <div className={`shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-lg`}>
                                    <platform.icon className="w-6 h-6 text-white" />
                                  </div>

                                  {/* Center content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="font-bold text-white text-sm">{platform.name}</h3>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${platform.badgeColor}`}>
                                        {platform.stat.value} {platform.stat.label}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-white/40 mt-0.5 leading-snug">{platform.tagline}</p>
                                    {/* Feature pills */}
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {platform.features.map((f) => (
                                        <span key={f}
                                          className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/6">
                                          <CheckCircle2 className="w-2 h-2 opacity-60" /> {f}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Arrow */}
                                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-white/12 transition-colors">
                                    <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
                                  </div>
                                </div>

                                {/* Hover gradient strip */}
                                <div className={`absolute inset-0 bg-gradient-to-r ${platform.gradient} opacity-0 group-hover:opacity-[0.05] transition-opacity pointer-events-none`} />
                              </motion.button>
                            </Link>
                          </motion.div>
                        ))}
                      </div>

                      {/* ── Footer ── */}
                      <div className="shrink-0 px-5 pb-5 pt-2">
                        <div className="flex items-center justify-center gap-1.5 text-white/25 text-[11px]">
                          <Sparkles className="w-3 h-3" />
                          <span>All tools included with your Boostify subscription</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
