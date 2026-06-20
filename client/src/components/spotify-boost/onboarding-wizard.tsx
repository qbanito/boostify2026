import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useArtistProfile, type ArtistProfile } from "../../hooks/use-artist-profile";
import { useSpotifyConnection } from "../../hooks/use-spotify-connection";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { SiSpotify } from "react-icons/si";
import {
  X, Rocket, ChevronRight, ChevronLeft, User, Music, ImagePlus,
  Sparkles, Crown, CheckCircle, Chrome, Brain, TrendingUp, BarChart2,
  Plug, Zap, ArrowRight, Star, Play, Target, Wand2, Mail, Headphones,
  ListMusic, Radio, Mic2, AudioWaveform
} from "lucide-react";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (artistId: number, tab: string) => void;
}

const STEPS = [
  { id: "artist", title: "Choose Artist", icon: Music },
  { id: "goal", title: "Set Your Goal", icon: Target },
  { id: "tools", title: "Your Toolkit", icon: Wand2 },
  { id: "launch", title: "Launch", icon: Rocket },
];

type Goal = {
  id: string;
  title: string;
  description: string;
  icon: typeof Brain;
  color: string;
  tab: string;
  features: string[];
};

const GOALS: Goal[] = [
  {
    id: "streams",
    title: "Grow Streams",
    description: "Get more plays, saves, and algorithmic recommendations",
    icon: TrendingUp,
    color: "from-green-500 to-emerald-600",
    tab: "growth",
    features: ["Release Strategy", "Algorithm Hacking", "Save Rate Optimizer", "Discovery Mode"],
  },
  {
    id: "playlists",
    title: "Get Playlisted",
    description: "Find curators, generate pitches, and land playlist placements",
    icon: ListMusic,
    color: "from-emerald-500 to-teal-600",
    tab: "pitch",
    features: ["Curator Finder", "AI Pitch Generator", "Playlist Tracker", "Genre Matching"],
  },
  {
    id: "profile",
    title: "Optimize Profile",
    description: "Perfect your artist bio, track metadata, and SEO for discovery",
    icon: Brain,
    color: "from-teal-500 to-cyan-600",
    tab: "tools",
    features: ["Bio Optimizer", "Track SEO", "Genre Tags", "Canvas Generator"],
  },
  {
    id: "analyze",
    title: "Analyze Performance",
    description: "Deep stream analytics, listener demographics, and growth forecasts",
    icon: BarChart2,
    color: "from-cyan-500 to-blue-600",
    tab: "analytics",
    features: ["Stream Analytics", "Listener Demographics", "Growth Forecast", "Competitor Intel"],
  },
];

export function SpotifyOnboardingWizard({ open, onClose, onComplete }: OnboardingWizardProps) {
  const { allArtists, selectedArtist, selectArtist } = useArtistProfile();
  const sp = useSpotifyConnection();
  const [step, setStep] = useState(0);
  const [chosenArtist, setChosenArtist] = useState<ArtistProfile | null>(null);
  const [chosenGoal, setChosenGoal] = useState<Goal | null>(null);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (open) {
      setStep(0);
      setChosenArtist(selectedArtist || null);
      setChosenGoal(null);
      setDirection(1);
    }
  }, [open, selectedArtist]);

  const nextStep = () => {
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep(s => s + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };

  const handleComplete = () => {
    if (chosenArtist) selectArtist(chosenArtist.id);
    onComplete(chosenArtist?.id || 0, chosenGoal?.tab || "tools");
  };

  const canProceed = () => {
    if (step === 0) return !!chosenArtist;
    if (step === 1) return !!chosenGoal;
    return true;
  };

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
          >
            {/* Header Gradient — Spotify green */}
            <div className="relative h-28 shrink-0 bg-gradient-to-br from-green-600 via-emerald-500 to-green-400 overflow-hidden">
              <div className="absolute inset-0">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-white/30 rounded-full"
                    initial={{ x: Math.random() * 500, y: Math.random() * 120, opacity: 0 }}
                    animate={{
                      y: [Math.random() * 120, Math.random() * 120],
                      opacity: [0, 0.8, 0],
                    }}
                    transition={{
                      duration: 3 + Math.random() * 3,
                      repeat: Infinity,
                      delay: Math.random() * 2,
                    }}
                  />
                ))}
              </div>

              {/* Sound wave decoration */}
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[2px] h-8 px-12 opacity-20">
                {[...Array(40)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-white rounded-t-full"
                    animate={{
                      height: [4, 8 + Math.random() * 24, 4],
                    }}
                    transition={{
                      duration: 0.8 + Math.random() * 0.4,
                      repeat: Infinity,
                      delay: i * 0.05,
                    }}
                  />
                ))}
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex items-center gap-2">
                    <SiSpotify className="w-6 h-6 text-white" />
                    <span className="text-xl font-black text-white tracking-tight">Growth Suite</span>
                  </div>
                  <span className="text-white/80 text-xs font-medium">Let's set up your streaming growth engine</span>
                </motion.div>
              </div>

              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="flex items-center justify-between">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1.5 flex-1">
                    <motion.div
                      animate={{
                        scale: step === i ? 1.15 : 1,
                        backgroundColor: step > i ? "#22c55e" : step === i ? "#16a34a" : "transparent",
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                        step > i
                          ? "border-green-500"
                          : step === i
                          ? "border-green-600"
                          : "border-muted-foreground/20"
                      }`}
                    >
                      {step > i ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <s.icon className={`w-4 h-4 ${step === i ? "text-white" : "text-muted-foreground/40"}`} />
                      )}
                    </motion.div>
                    <span className={`text-[10px] font-semibold hidden sm:inline ${
                      step >= i ? "text-foreground" : "text-muted-foreground/40"
                    }`}>
                      {s.title}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                        step > i ? "bg-green-500" : "bg-muted-foreground/10"
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Content Area */}
            <div className="px-6 py-4 min-h-[320px] relative overflow-y-auto flex-1">
              <AnimatePresence mode="wait" custom={direction}>
                {/* Step 0: Choose Artist */}
                {step === 0 && (
                  <motion.div
                    key="step-0"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="text-center space-y-1">
                      <h2 className="text-lg font-bold">Choose Your Artist</h2>
                      <p className="text-xs text-muted-foreground">
                        Select which artist profile you want to grow on Spotify
                      </p>
                    </div>

                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                      {allArtists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-8 h-8 text-muted-foreground/40" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">No artist profiles yet</p>
                            <p className="text-xs text-muted-foreground">Create your artist profile first</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { onClose(); window.location.href = "/artist-setup"; }}
                          >
                            Create Profile <ArrowRight className="ml-1 w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        allArtists.map((artist, i) => (
                          <motion.button
                            key={artist.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            onClick={() => setChosenArtist(artist)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                              chosenArtist?.id === artist.id
                                ? "border-green-500 bg-green-500/5 shadow-lg shadow-green-500/10"
                                : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                            }`}
                          >
                            <div className="relative">
                              {artist.profileImage ? (
                                <img
                                  src={artist.profileImage}
                                  alt={artist.artistName || ""}
                                  className="w-12 h-12 rounded-full object-cover ring-2 ring-background"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center ring-2 ring-background">
                                  <span className="text-white font-bold text-lg">
                                    {(artist.artistName || "?")[0].toUpperCase()}
                                  </span>
                                </div>
                              )}
                              {chosenArtist?.id === artist.id && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                                >
                                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                                </motion.div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm truncate">{artist.artistName || "Unknown"}</span>
                                {artist.isAIGenerated && (
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">AI</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {artist.genre && (
                                  <span className="text-[10px] text-muted-foreground">{artist.genre}</span>
                                )}
                                {artist.spotifyUrl && (
                                  <span className="text-[10px] text-green-500 font-medium flex items-center gap-0.5">
                                    <SiSpotify className="w-2.5 h-2.5" /> Connected
                                  </span>
                                )}
                              </div>
                            </div>

                            <ChevronRight className={`w-4 h-4 transition-colors ${
                              chosenArtist?.id === artist.id ? "text-green-500" : "text-muted-foreground/30"
                            }`} />
                          </motion.button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 1: Set Goal */}
                {step === 1 && (
                  <motion.div
                    key="step-1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="text-center space-y-1">
                      <h2 className="text-lg font-bold">What's Your Goal?</h2>
                      <p className="text-xs text-muted-foreground">
                        Choose your primary focus for <span className="font-semibold text-foreground">{chosenArtist?.artistName}</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {GOALS.map((goal, i) => (
                        <motion.button
                          key={goal.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          onClick={() => setChosenGoal(goal)}
                          className={`relative p-4 rounded-2xl border-2 text-left transition-all group ${
                            chosenGoal?.id === goal.id
                              ? "border-transparent shadow-xl"
                              : "border-border hover:border-muted-foreground/20 hover:shadow-md"
                          }`}
                        >
                          {chosenGoal?.id === goal.id && (
                            <motion.div
                              layoutId="spotify-goal-glow"
                              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${goal.color} opacity-10`}
                            />
                          )}

                          <div className="relative space-y-2">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${goal.color} flex items-center justify-center shadow-lg`}>
                              <goal.icon className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="font-bold text-sm">{goal.title}</h3>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{goal.description}</p>

                            {chosenGoal?.id === goal.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="pt-2 space-y-1"
                              >
                                {goal.features.map(f => (
                                  <div key={f} className="flex items-center gap-1.5">
                                    <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                                    <span className="text-[10px] font-medium">{f}</span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </div>

                          {chosenGoal?.id === goal.id && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-2 right-2"
                            >
                              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${goal.color} flex items-center justify-center`}>
                                <CheckCircle className="w-4 h-4 text-white" />
                              </div>
                            </motion.div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Toolkit Overview */}
                {step === 2 && (
                  <motion.div
                    key="step-2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="text-center space-y-1">
                      <h2 className="text-lg font-bold">Your Streaming Toolkit</h2>
                      <p className="text-xs text-muted-foreground">
                        Here's what's ready for <span className="font-semibold text-foreground">{chosenArtist?.artistName}</span>
                      </p>
                    </div>

                    {/* Artist Card */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-green-400/5 border border-green-500/20">
                      {chosenArtist?.profileImage ? (
                        <img src={chosenArtist.profileImage} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                          <span className="text-white font-bold">{(chosenArtist?.artistName || "?")[0].toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <span className="text-sm font-semibold">{chosenArtist?.artistName}</span>
                        <div className="flex items-center gap-2">
                          {chosenArtist?.genre && <span className="text-[10px] text-muted-foreground">{chosenArtist.genre}</span>}
                          {sp.isConnected && sp.latestSnapshot && (
                            <span className="text-[10px] text-green-500">{sp.formatNumber(sp.latestSnapshot.monthlyListeners)} monthly listeners</span>
                          )}
                        </div>
                      </div>
                      <Badge className={`bg-gradient-to-r ${chosenGoal?.color || "from-green-500 to-emerald-600"} text-white text-[10px] border-0`}>
                        {chosenGoal?.title}
                      </Badge>
                    </div>

                    {/* Tools Grid */}
                    <div className="space-y-2">
                      {[
                        { icon: Plug, label: "Chrome Extension", desc: sp.isConnected ? "Connected — syncing Spotify data" : "Connect to sync your Spotify data", done: sp.isConnected, color: "text-green-500" },
                        { icon: Brain, label: "AI Tools Engine", desc: "Bio optimizer, SEO, playlist matcher & more", done: true, color: "text-emerald-500" },
                        { icon: Mail, label: "Pitch Generator", desc: "AI-powered curator pitches with personalization", done: true, color: "text-teal-500" },
                        { icon: TrendingUp, label: "Growth Planner", desc: "Release strategy, algorithm tips & audience growth", done: true, color: "text-cyan-500" },
                        { icon: BarChart2, label: "Stream Analytics", desc: "Listener demographics, forecasts & reports", done: true, color: "text-blue-500" },
                      ].map((tool, i) => (
                        <motion.div
                          key={tool.label}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <tool.icon className={`w-4 h-4 ${tool.color}`} />
                          </div>
                          <div className="flex-1">
                            <span className="text-xs font-semibold">{tool.label}</span>
                            <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
                          </div>
                          {tool.done ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-amber-400" />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Launch */}
                {step === 3 && (
                  <motion.div
                    key="step-3"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center text-center space-y-5 py-4"
                  >
                    {/* Animated Speaker/Music */}
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                      className="relative"
                    >
                      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-green-500 via-emerald-500 to-green-400 flex items-center justify-center shadow-2xl shadow-green-500/30">
                        <Headphones className="w-12 h-12 text-white" />
                      </div>
                      {/* Sound wave rings */}
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{
                            scale: [0.8, 1.4 + i * 0.3],
                            opacity: [0.6, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.5,
                          }}
                          className="absolute inset-0 rounded-3xl border-2 border-green-400"
                        />
                      ))}
                      {/* Sparkle particles */}
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={`sp-${i}`}
                          initial={{ scale: 0, x: 0, y: 0 }}
                          animate={{
                            scale: [0, 1, 0],
                            x: [0, (Math.random() - 0.5) * 100],
                            y: [0, (Math.random() - 0.5) * 100],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.3,
                          }}
                          className="absolute top-1/2 left-1/2"
                        >
                          <Star className="w-3 h-3 text-green-400 fill-green-400" />
                        </motion.div>
                      ))}
                    </motion.div>

                    <div className="space-y-2">
                      <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-xl font-black"
                      >
                        You're All Set!
                      </motion.h2>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="text-sm text-muted-foreground max-w-sm"
                      >
                        <span className="font-semibold text-foreground">{chosenArtist?.artistName}</span>'s
                        Spotify growth engine is ready. Let's{" "}
                        <span className="font-semibold bg-gradient-to-r from-green-500 to-emerald-400 bg-clip-text text-transparent">
                          {chosenGoal?.title.toLowerCase()}
                        </span>.
                      </motion.p>
                    </div>

                    {/* Quick Stats */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="grid grid-cols-3 gap-3 w-full max-w-sm"
                    >
                      {[
                        { label: "AI Tools", value: "5+", icon: Brain },
                        { label: "Pitch Templates", value: "10+", icon: Mail },
                        { label: "Analytics", value: "Real-time", icon: BarChart2 },
                      ].map((stat) => (
                        <div key={stat.label} className="p-2.5 rounded-xl bg-muted/50 border border-border/50 text-center">
                          <stat.icon className="w-4 h-4 mx-auto text-green-500 mb-1" />
                          <span className="text-sm font-bold block">{stat.value}</span>
                          <span className="text-[9px] text-muted-foreground">{stat.label}</span>
                        </div>
                      ))}
                    </motion.div>

                    {/* Launch Button */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.9 }}
                      className="w-full max-w-sm"
                    >
                      <Button
                        onClick={handleComplete}
                        className="w-full h-12 bg-gradient-to-r from-green-600 via-emerald-500 to-green-400 text-white font-bold text-base rounded-2xl shadow-xl shadow-green-500/30 hover:opacity-90 hover:scale-[1.02] transition-all"
                      >
                        <Play className="w-5 h-5 mr-2 fill-white" />
                        Launch Growth Engine
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Navigation */}
            {step < 3 && (
              <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={step === 0 ? onClose : prevStep}
                  className="text-xs gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {step === 0 ? "Cancel" : "Back"}
                </Button>

                <div className="flex items-center gap-1.5">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === step ? "w-6 bg-green-500" : i < step ? "w-1.5 bg-green-500" : "w-1.5 bg-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>

                <Button
                  size="sm"
                  disabled={!canProceed()}
                  onClick={nextStep}
                  className="text-xs gap-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl disabled:opacity-30"
                >
                  Continue <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
