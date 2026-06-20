import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/use-auth";
import { useLocation as useWouterLocation } from "wouter";
import { useToast } from "../hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";
import { doc, setDoc, collection } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db as firebaseDb, storage as firebaseStorage } from "../firebase";

// UI Components
import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

// Icons
import {
  Building2, Music2, Globe, Users, Sparkles, DollarSign, ArrowRight, ArrowLeft,
  Check, X, Loader2, BarChart2, Shield, Zap, Music, Award, Megaphone,
  Radio, Bot, Crown, Star, TrendingUp, Lock, Headphones, Disc3, FileText,
  Send, Eye, Clock, Rocket, PartyPopper, Package, Layers, Settings,
  LayoutDashboard, Image, Wand2, Calendar, Film, CloudUpload, RefreshCw, Trash2, Upload,
} from "lucide-react";
import { SiSpotify, SiApplemusic, SiYoutube, SiTiktok, SiInstagram } from "react-icons/si";

const heroVideo = "/assets/promos/ROCK.mp4";

// ============================================================================
// Types
// ============================================================================
type BillingCycle = "monthly" | "annual";

interface LicensePlan {
  id: string;
  name: string;
  price: { monthly: number; annual: number };
  artistLimit: string;
  users: string;
  popular?: boolean;
  enterprise?: boolean;
  features: string[];
  highlight?: string;
}

interface CatalogArtist {
  id: number;
  name: string;
  genre: string;
  type: "real" | "virtual";
  streams: number;
  revenue: number;
  status: "active" | "draft" | "pending";
  image: string;
  color: string;
}

interface LabelStat {
  label: string;
  value: string | number;
  icon: any;
  change?: string;
}

// ============================================================================
// Constants
// ============================================================================
const LICENSE_PLANS: LicensePlan[] = [
  {
    id: "label_starter",
    name: "Label Starter",
    price: { monthly: 299, annual: 239 },
    artistLimit: "10",
    users: "1 admin",
    features: [
      "10 artists (real + virtual)",
      "Basic distribution to 50+ DSPs",
      "Monthly analytics reports",
      "AI-generated artist profiles",
      "Standard support",
      "Basic CRM (100 contacts)",
      "1 admin user",
    ],
  },
  {
    id: "label_pro",
    name: "Label Pro",
    price: { monthly: 799, annual: 639 },
    artistLimit: "50",
    users: "5 users",
    popular: true,
    highlight: "Most Popular",
    features: [
      "50 artists (real + virtual)",
      "Priority distribution to 150+ DSPs",
      "Real-time analytics dashboard",
      "AI marketing campaigns",
      "Full CRM system (unlimited)",
      "5 team users with roles",
      "API access for integrations",
      "Custom release strategies",
      "Playlist pitching tools",
      "Revenue split management",
    ],
  },
  {
    id: "label_enterprise",
    name: "Label Enterprise",
    price: { monthly: 2499, annual: 1999 },
    artistLimit: "Unlimited",
    users: "Unlimited",
    enterprise: true,
    highlight: "White Label",
    features: [
      "Unlimited artists",
      "White-label platform",
      "Dedicated account manager",
      "Custom API & webhooks",
      "Revenue sharing dashboard",
      "Unlimited team users",
      "Priority 24/7 support",
      "Custom branding & domain",
      "Advanced royalty tracking",
      "Smart contract integration",
      "Bulk distribution tools",
      "Executive reporting suite",
    ],
  },
];

const PLATFORM_PARTNERS = [
  { name: "Spotify", icon: SiSpotify, color: "#1DB954" },
  { name: "Apple Music", icon: SiApplemusic, color: "#FC3C44" },
  { name: "YouTube Music", icon: SiYoutube, color: "#FF0000" },
  { name: "TikTok", icon: SiTiktok, color: "#000000" },
  { name: "Instagram", icon: SiInstagram, color: "#E4405F" },
];

const VALUE_PROPS = [
  { icon: Bot, title: "AI Artist Generation", desc: "Create unlimited virtual artists with unique personalities, music styles, and visual identities powered by AI.", gradient: "from-purple-500/20 to-violet-500/10", iconColor: "text-purple-500" },
  { icon: Globe, title: "Global Distribution", desc: "Distribute to 150+ DSPs worldwide. Automated release scheduling, playlist pitching, and delivery tracking.", gradient: "from-blue-500/20 to-cyan-500/10", iconColor: "text-blue-500" },
  { icon: Megaphone, title: "Marketing Automation", desc: "AI-powered campaigns across Instagram, YouTube, and TikTok. Smart budgeting and audience targeting.", gradient: "from-orange-500/20 to-amber-500/10", iconColor: "text-orange-500" },
  { icon: Shield, title: "Rights & Royalties", desc: "Smart contract integration, automated royalty splits, and full IP protection for your entire catalog.", gradient: "from-emerald-500/20 to-green-500/10", iconColor: "text-emerald-500" },
];

const LABEL_SERVICES = [
  { icon: Disc3, title: "Catalog Management", desc: "Manage real & AI artists in one place" },
  { icon: BarChart2, title: "Analytics Suite", desc: "Real-time performance across all DSPs" },
  { icon: Users, title: "CRM & Outreach", desc: "Industry contacts and pipeline management" },
  { icon: FileText, title: "Contract Generator", desc: "Automated licensing and distribution deals" },
  { icon: Headphones, title: "A&R Intelligence", desc: "AI-powered talent scouting and trend analysis" },
  { icon: DollarSign, title: "Revenue Dashboard", desc: "Track royalties, splits, and payouts" },
  { icon: Rocket, title: "Release Planner", desc: "Strategic scheduling with market analysis" },
  { icon: Settings, title: "White-Label Tools", desc: "Custom branding for your label platform" },
];

const DEMO_CATALOG: CatalogArtist[] = [
  { id: 1, name: "Nova Eclipse", genre: "Electronic", type: "virtual", streams: 1250000, revenue: 4875, status: "active", image: "https://api.dicebear.com/9.x/glass/svg?seed=NovaEclipse&backgroundColor=f97316", color: "from-purple-600 to-violet-900" },
  { id: 2, name: "Jade Rivers", genre: "R&B", type: "real", streams: 890000, revenue: 3470, status: "active", image: "https://api.dicebear.com/9.x/glass/svg?seed=JadeRivers&backgroundColor=10b981", color: "from-emerald-600 to-teal-900" },
  { id: 3, name: "Cipher Beat", genre: "Hip-Hop", type: "virtual", streams: 2100000, revenue: 8190, status: "active", image: "https://api.dicebear.com/9.x/glass/svg?seed=CipherBeat&backgroundColor=ef4444", color: "from-red-600 to-orange-900" },
  { id: 4, name: "Luna Frost", genre: "Pop", type: "virtual", streams: 670000, revenue: 2613, status: "draft", image: "https://api.dicebear.com/9.x/glass/svg?seed=LunaFrost&backgroundColor=3b82f6", color: "from-blue-500 to-indigo-900" },
  { id: 5, name: "Marcus Cole", genre: "Jazz", type: "real", streams: 320000, revenue: 1248, status: "active", image: "https://api.dicebear.com/9.x/glass/svg?seed=MarcusCole&backgroundColor=a855f7", color: "from-amber-600 to-yellow-900" },
  { id: 6, name: "Stellar Waves", genre: "Ambient", type: "virtual", streams: 450000, revenue: 1755, status: "pending", image: "https://api.dicebear.com/9.x/glass/svg?seed=StellarWaves&backgroundColor=06b6d4", color: "from-cyan-600 to-blue-900" },
];

const GRADIENT_COLORS = [
  "from-purple-600 to-violet-900",
  "from-emerald-600 to-teal-900",
  "from-red-600 to-orange-900",
  "from-blue-500 to-indigo-900",
  "from-amber-600 to-yellow-900",
  "from-cyan-600 to-blue-900",
  "from-pink-600 to-rose-900",
  "from-orange-500 to-red-900",
];

// ============================================================================
// Wizard Constants (Label Creator)
// ============================================================================
interface LabelTypeOption { id: string; name: string; description: string; }
interface GenreOption { id: string; name: string; }
interface PlatformOption { id: string; name: string; icon: React.ReactNode; }
interface PlanOption { id: string; name: string; artistCount: number; price: number; features: string[]; popular?: boolean; }
interface ArtistPreview { id: string; name: string; genre?: string; imagePrompt?: string; }
interface RecordLabelConfig { id: string; name: string; type: string; genre: string; platforms: string[]; artistCount: number; artists: ArtistPreview[]; logoUrl?: string; userId: string; createdAt: Date; }

const LABEL_TYPES: LabelTypeOption[] = [
  { id: "indie", name: "Indie Label", description: "Focus on niche genres and emerging artists with authentic creative direction" },
  { id: "major", name: "Major Label", description: "Mainstream commercial approach with wide distribution and high-budget productions" },
  { id: "personal", name: "Personal Label", description: "Dedicated to your own projects with complete creative control" },
];

const GENRE_OPTIONS: GenreOption[] = [
  { id: "pop", name: "Pop" }, { id: "rock", name: "Rock" }, { id: "hiphop", name: "Hip-Hop" },
  { id: "electronic", name: "Electronic" }, { id: "rnb", name: "R&B" }, { id: "jazz", name: "Jazz" },
  { id: "classical", name: "Classical" }, { id: "country", name: "Country" }, { id: "latin", name: "Latin" },
];

const WIZARD_PLANS: PlanOption[] = [
  { id: "creator", name: "Elevate", artistCount: 3, price: 49.99, features: ["3 AI-generated artists", "Basic strategic planning", "PR Starter Kit", "Spotify Growth Engine", "Content Studio"] },
  { id: "professional", name: "Amplify", artistCount: 5, price: 89.99, popular: true, features: ["5 AI-generated artists", "Advanced release strategies", "AI Music Studio", "Career Manager Suite", "Pro Analytics Engine", "Premium Merch Hub"] },
  { id: "enterprise", name: "Dominate", artistCount: 10, price: 149.99, features: ["10 AI-generated artists", "Virtual Label Empire", "AI Agent Suite (Unlimited)", "Enterprise Analytics", "VIP Support (24/7)", "International Expansion", "Web3 & Blockchain Access"] },
];

const CREATION_STAGES = [
  { title: "Setup AI Music Engine", description: "Configuring AI algorithms for music composition" },
  { title: "Video Generation Framework", description: "Setting up AI-powered video creation" },
  { title: "AI Artist Generation", description: "Creating virtual artists with GPT-based personalities" },
  { title: "CRM Integration", description: "Configuring contact management system" },
  { title: "Analytics Dashboard", description: "Setting up performance tracking" },
  { title: "Digital Rights Management", description: "Implementing IP protection" },
  { title: "Distribution Network", description: "Connecting to global streaming platforms" },
  { title: "Finalizing Launch", description: "Last touches before launch" },
];

function generateArtistNames(genre: string, count: number): ArtistPreview[] {
  const prefixes: Record<string, string[]> = {
    pop: ["Crystal", "Echo", "Stellar", "Neon", "Pulse", "Nova", "Aura", "Luna"],
    rock: ["Thunder", "Raven", "Midnight", "Storm", "Savage", "Rebel", "Chaos", "Vortex"],
    hiphop: ["Young", "Lil", "MC", "DJ", "King", "Queen", "Dr.", "Professor"],
    electronic: ["Cyber", "Digital", "Binary", "Circuit", "Synth", "Pixel", "Vector", "Quantum"],
    rnb: ["Silk", "Velvet", "Soul", "Rhythm", "Harmony", "Melody", "Divine", "Royal"],
    jazz: ["Blue", "Smooth", "Midnight", "Brass", "Sax", "Rhythm", "Cool", "Mellow"],
    classical: ["Maestro", "Virtuoso", "Aria", "Symphony", "Opus", "Concerto", "Harmony", "Allegro"],
    country: ["Whiskey", "Dusty", "Desert", "Texas", "Wild", "Southern", "Ranch", "Prairie"],
    latin: ["Ritmo", "Fuego", "Salsa", "Latino", "Sol", "Alma", "Corazón", "Vida"],
  };
  const suffixes: Record<string, string[]> = {
    pop: ["Star", "Wave", "Glow", "Dream", "Heart", "Voice", "Shine", "Spark"],
    rock: ["Blade", "Fury", "Rage", "Fist", "Axe", "Fire", "Wolf", "Riff"],
    hiphop: ["Money", "Cash", "Flow", "Beats", "Hustler", "Lyric", "Rhyme", "Style"],
    electronic: ["Pulse", "Wave", "Byte", "Code", "Matrix", "Grid", "Glitch", "Techno"],
    rnb: ["Love", "Groove", "Vibe", "Feel", "Smooth", "Heartbreak", "Passion", "Mood"],
    jazz: ["Notes", "Tone", "Groove", "Soul", "Blues", "Rhythm", "Swing", "Improv"],
    classical: ["Sonata", "Quartet", "Ensemble", "Philharmonic", "Orchestra", "Chamber", "Strings", "Piano"],
    country: ["Road", "Trail", "Heart", "Boots", "Sunset", "Horizon", "Creek", "Valley"],
    latin: ["Caliente", "Ritmo", "Noche", "Estrella", "Sabor", "Pasión", "Fiesta", "Sol"],
  };
  const gp = prefixes[genre] || prefixes.pop;
  const gs = suffixes[genre] || suffixes.pop;
  return Array.from({ length: count }, () => {
    const p = gp[Math.floor(Math.random() * gp.length)];
    const s = gs[Math.floor(Math.random() * gs.length)];
    const name = Math.random() > 0.3 ? `${p} ${s}` : p;
    return { id: uuidv4(), name, genre, imagePrompt: `${genre} music artist ${name} professional portrait, high quality` };
  });
}

// ============================================================================
// Pricing Modal
// ============================================================================
function LabelLicensingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [billing, setBilling] = useState<BillingCycle>("annual");
  const { toast } = useToast();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed inset-0 z-[1001] flex items-center justify-center p-3 sm:p-6"
            onClick={(e) => e.target === e.currentTarget && onClose()}
          >
            <div className="bg-card border-2 border-orange-500/30 rounded-2xl shadow-2xl shadow-orange-500/10 w-full max-w-4xl max-h-[92dvh] overflow-y-auto">

              {/* Header */}
              <div className="relative bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 p-5 sm:p-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="absolute top-3 right-3 text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg sm:text-xl">Enterprise Label Licensing</h2>
                    <p className="text-white/80 text-xs sm:text-sm">Scale beyond Dominate — full white-label technology platform</p>
                  </div>
                </div>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1"
                >
                  <PartyPopper className="w-4 h-4 text-amber-200" />
                  <span className="text-white font-semibold text-xs">Launch Pricing — Save 20% Annually</span>
                </motion.div>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-5">

                {/* Billing toggle */}
                <div className="flex items-center justify-center gap-3">
                  <span className={`text-sm font-medium ${billing === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
                  <button
                    onClick={() => setBilling(billing === "monthly" ? "annual" : "monthly")}
                    className={`relative w-14 h-7 rounded-full transition-colors ${billing === "annual" ? "bg-orange-500" : "bg-muted"}`}
                  >
                    <motion.div
                      className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md"
                      animate={{ left: billing === "annual" ? "calc(100% - 1.625rem)" : "0.125rem" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                  <span className={`text-sm font-medium ${billing === "annual" ? "text-foreground" : "text-muted-foreground"}`}>Annual</span>
                  {billing === "annual" && (
                    <Badge className="bg-green-500/20 text-green-400 text-[10px] border-green-500/30">Save 20%</Badge>
                  )}
                </div>

                {/* Plans grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {LICENSE_PLANS.map((plan, idx) => (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className={`relative rounded-xl border-2 p-5 transition-all ${
                        plan.popular ? "border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/10"
                        : plan.enterprise ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border"
                      }`}
                    >
                      {plan.highlight && (
                        <Badge className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2.5 py-0.5 border-0 font-semibold ${
                          plan.popular ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                          : "bg-gradient-to-r from-amber-400 to-yellow-500 text-black"
                        }`}>
                          {plan.highlight}
                        </Badge>
                      )}

                      <div className="text-center mb-4 pt-1">
                        <h3 className="font-bold text-base">{plan.name}</h3>
                        <div className="flex items-baseline justify-center gap-1 mt-2">
                          {billing === "annual" && (
                            <span className="text-sm text-muted-foreground line-through">${plan.price.monthly}</span>
                          )}
                          <span className={`text-3xl font-black ${
                            plan.popular ? "bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent" : "text-foreground"
                          }`}>
                            ${plan.price[billing]}
                          </span>
                          <span className="text-xs text-muted-foreground">/mo</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>{plan.artistLimit} artists • {plan.users}</span>
                        </div>
                      </div>

                      <ul className="space-y-2 mb-5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-xs">
                            <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${plan.popular ? "text-orange-500" : "text-green-500"}`} />
                            <span className="text-foreground">{f}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className={`w-full text-xs font-bold rounded-lg relative overflow-hidden ${
                          plan.popular
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:opacity-90"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                        onClick={() => toast({ title: "Coming Soon!", description: `${plan.name} licensing will be available soon. We'll notify you when it launches.` })}
                      >
                        <Lock className="w-3 h-3 mr-1.5" />
                        Coming Soon
                        <Badge className="absolute -top-1 -right-1 bg-orange-600 text-white text-[8px] px-1 py-0 border-0 animate-pulse">Q2 2026</Badge>
                      </Button>
                    </motion.div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex flex-col items-center gap-2 pt-2">
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure payment</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Cancel anytime</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Instant setup</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">All plans include a 14-day free trial. No credit card required.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Main Page
// ============================================================================
export default function VirtualRecordLabelPage() {
  const { user, userSubscription } = useAuth();
  const { toast } = useToast();
  const [, setAuthLocation] = useWouterLocation();
  const queryClient = useQueryClient();
  const PAID_PLANS = ['creator', 'professional', 'enterprise', 'artist', 'premium'];
  const isPaidUser = userSubscription && PAID_PLANS.includes(userSubscription);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  // ─── Wizard State (Create Label) ───
  const [wizardStep, setWizardStep] = useState(1);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState(0);
  const [labelConfig, setLabelConfig] = useState<Partial<RecordLabelConfig>>({
    name: "", type: "", genre: "", platforms: [], artistCount: 3, artists: [],
  });

  const wizardPlatforms: PlatformOption[] = [
    { id: "spotify", name: "Spotify", icon: <SiSpotify className="h-4 w-4" /> },
    { id: "apple", name: "Apple Music", icon: <SiApplemusic className="h-4 w-4" /> },
    { id: "youtube", name: "YouTube", icon: <SiYoutube className="h-4 w-4" /> },
    { id: "tiktok", name: "TikTok", icon: <SiTiktok className="h-4 w-4" /> },
    { id: "instagram", name: "Instagram", icon: <SiInstagram className="h-4 w-4" /> },
  ];

  const togglePlatform = (pid: string) => {
    setLabelConfig(prev => {
      const cur = prev.platforms || [];
      return { ...prev, platforms: cur.includes(pid) ? cur.filter(id => id !== pid) : [...cur, pid] };
    });
  };

  const handleGenreChange = (genre: string) => {
    setLabelConfig(prev => ({ ...prev, genre, artists: generateArtistNames(genre, prev.artistCount || 3) }));
  };

  const handlePlanChange = (planId: string) => {
    const plan = WIZARD_PLANS.find(p => p.id === planId);
    if (plan) setLabelConfig(prev => ({ ...prev, artistCount: plan.artistCount }));
  };

  const generateLogo = async () => {
    if (!labelConfig.name || !labelConfig.genre) {
      toast({ title: "Missing information", description: "Fill in label name and genre first.", variant: "destructive" });
      return;
    }
    setIsGeneratingLogo(true);
    try {
      const labelTypeName = LABEL_TYPES.find(t => t.id === labelConfig.type)?.name || 'Record Label';
      const genreName = GENRE_OPTIONS.find(g => g.id === labelConfig.genre)?.name || labelConfig.genre;
      const prompt = `Professional record label logo for "${labelConfig.name}", a ${genreName} ${labelTypeName.toLowerCase()}. Modern minimalist vector design, bold typography, iconic emblem mark, clean geometric shapes, premium music industry branding, centered composition on solid dark background, high contrast, no text artifacts, suitable as profile avatar.`;
      const res = await fetch('/api/fal/nano-banana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio: '1:1',
          numImages: 1,
          userEmail: user?.email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const errMsg = data?.error || data?.details?.detail || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      const url = data.imageUrl || data.images?.[0]?.url;
      if (!url) throw new Error('No image returned by AI service');
      setLabelConfig(prev => ({ ...prev, logoUrl: url }));
      toast({ title: "Logo generated!", description: `Generated in ${data.processingTime?.toFixed(1) || '?'}s` });
    } catch (err) {
      logger.error('[VRL] Logo generation failed:', err);
      toast({
        title: "Could not generate logo",
        description: err instanceof Error ? err.message : "Try again or upload your own logo.",
        variant: "destructive",
      });
    }
    finally { setIsGeneratingLogo(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!user) {
      toast({ title: "Please log in first", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image (PNG, JPG, SVG, WEBP).", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 5 MB.", variant: "destructive" });
      return;
    }
    setIsGeneratingLogo(true);
    try {
      const path = `record_labels/${user.id}/logo_${Date.now()}_${file.name}`;
      const sref = storageRef(firebaseStorage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      setLabelConfig(prev => ({ ...prev, logoUrl: url }));
      toast({ title: "Logo uploaded!" });
    } catch (err) {
      logger.error('[VRL] Logo upload failed:', err);
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : 'Try again.', variant: "destructive" });
    } finally {
      setIsGeneratingLogo(false);
    }
  };

  const removeLogo = () => {
    setLabelConfig(prev => ({ ...prev, logoUrl: undefined }));
  };

  const createRecordLabel = async () => {
    if (!user) { toast({ title: "Please log in first", variant: "destructive" }); return; }
    if (!labelConfig.name || !labelConfig.type || !labelConfig.genre || !(labelConfig.platforms?.length)) { toast({ title: "Complete all fields", variant: "destructive" }); return; }
    setIsCreatingLabel(true); setShowProgress(true); setProgress(0); setProgressStage(0);
    try {
      const recordLabelId = uuidv4();
      const updateProgress = (stage: number, target: number) => new Promise<void>(resolve => {
        setProgressStage(stage);
        const interval = setInterval(() => { setProgress(prev => { if (prev >= target) { clearInterval(interval); resolve(); return prev; } return prev + 1; }); }, 30);
      });
      for (let i = 0; i < 4; i++) { await updateProgress(i, Math.round(((i + 1) / 8) * 40)); await new Promise(r => setTimeout(r, 1200)); }
      setProgressStage(4);
      const generatedIds: number[] = [];
      for (let i = 0; i < (labelConfig.artistCount || 3); i++) {
        const a = labelConfig.artists?.[i];
        if (a) {
          try {
            const res = await fetch('/api/artist-generator/generate-artist/secure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: a.name, genre: labelConfig.genre, imagePrompt: a.imagePrompt, recordLabelId }) });
            if (res.ok) { const d = await res.json(); generatedIds.push(d.postgresId); }
          } catch (e) { logger.error(`Error generating artist ${a.name}:`, e); }
        }
        setProgress(40 + Math.round((i + 1) / (labelConfig.artistCount || 3) * 30));
      }
      for (let i = 5; i < 8; i++) { await updateProgress(i, Math.round(((i + 1) / 8) * 100)); await new Promise(r => setTimeout(r, 1200)); }
      await setDoc(doc(collection(firebaseDb, "record_labels"), recordLabelId), { id: recordLabelId, name: labelConfig.name, type: labelConfig.type, genre: labelConfig.genre, platforms: labelConfig.platforms, artistCount: labelConfig.artistCount, logoUrl: labelConfig.logoUrl, userId: user.id, generatedArtistIds: generatedIds, createdAt: new Date().toISOString() });
      toast({ title: "Record Label Created!", description: `${generatedIds.length} AI artists generated!` });
      // Refrescar listas para que el catálogo muestre los nuevos artistas inmediatamente
      queryClient.invalidateQueries({ queryKey: ["/api/virtual-label/my-artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artist/my-artists"] });
      setShowProgress(false); setWizardStep(5);
    } catch (e) { logger.error("Error creating label:", e); toast({ title: "Error", variant: "destructive" }); setShowProgress(false); }
    finally { setIsCreatingLabel(false); }
  };

  const { data: myVirtualArtists, isLoading: artistsLoading } = useQuery<any[]>({
    queryKey: ["/api/virtual-label/my-artists"],
    enabled: !!user,
  });

  // Also fetch from /api/artist/my-artists for richer data
  const { data: myArtistsData } = useQuery<any>({
    queryKey: ["/api/artist/my-artists"],
    enabled: !!user,
  });

  // Merge real DB artists into catalog-ready format
  const dbArtists: CatalogArtist[] = (() => {
    const allDbArtists: any[] = [];

    // Add virtual-label artists
    if (myVirtualArtists?.length) {
      allDbArtists.push(...myVirtualArtists);
    }

    // Add artists from /api/artist/my-artists
    if (myArtistsData?.currentArtist) {
      const existing = allDbArtists.find((a: any) => a.id === myArtistsData.currentArtist.id);
      if (!existing) allDbArtists.push(myArtistsData.currentArtist);
    }
    if (myArtistsData?.aiArtists?.length) {
      for (const ai of myArtistsData.aiArtists) {
        const existing = allDbArtists.find((a: any) => a.id === ai.id);
        if (!existing) allDbArtists.push(ai);
      }
    }

    return allDbArtists.map((a: any, i: number) => ({
      id: a.id || i + 100,
      name: a.artistName || a.username || a.firstName || "Unknown Artist",
      genre: a.genre || (a.genres?.length ? a.genres[0] : "Music"),
      type: (a.isAIGenerated ? "virtual" : "real") as "real" | "virtual",
      streams: 0,
      revenue: 0,
      status: "active" as const,
      image: a.profileImage || a.profileImageUrl || a.coverImage || "",
      color: GRADIENT_COLORS[i % GRADIENT_COLORS.length],
    }));
  })();

  // Use DB artists if available, otherwise show demo catalog
  const catalogArtists = dbArtists.length > 0 ? dbArtists : DEMO_CATALOG;

  const handleWaitlist = () => {
    if (!waitlistEmail.trim()) return;
    setWaitlistSubmitted(true);
    toast({ title: "You're on the list!", description: "We'll notify you when Label Licensing launches." });
  };

  const stats: LabelStat[] = [
    { label: "Labels Active", value: "127", icon: Building2, change: "+12%" },
    { label: "Artists Managed", value: "2,450+", icon: Users, change: "+28%" },
    { label: "Tracks Distributed", value: "18K+", icon: Music2, change: "+45%" },
    { label: "Revenue Generated", value: "$1.2M", icon: DollarSign, change: "+62%" },
  ];

  // Auth guard - redirect if not logged in or not on a paid plan
  useEffect(() => {
    if (!user || (userSubscription !== undefined && userSubscription !== null && !isPaidUser) || (user && userSubscription === null)) {
      setAuthLocation('/auth');
    }
  }, [user, isPaidUser, userSubscription, setAuthLocation]);

  if (!user || !isPaidUser) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="bg-zinc-900/50 border-orange-500/20 p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">{!user ? 'Authentication Required' : 'Paid Plan Required'}</h2>
          <p className="text-white/70 mb-6">{!user ? 'You need to be logged in to access Virtual Record Label.' : 'Virtual Record Label is available on Creator plans and above.'}</p>
          <Button onClick={() => setAuthLocation('/auth')} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">Sign In / Upgrade</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Header />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative w-full min-h-[92vh] -mt-14 sm:-mt-16 overflow-hidden flex flex-col">
        {/* Video Background */}
        <div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('/images/music_industry_abstract_art.png')` }} />
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" poster="/images/music_industry_abstract_art.png">
          <source src={heroVideo} type="video/mp4" />
        </video>

        {/* Multi-layer overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-orange-950/40 via-transparent to-amber-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,146,60,0.12),transparent_60%)]" />

        {/* Animated floating icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[
            { Icon: Music2, x: "10%", y: "20%", delay: 0, size: "w-6 h-6" },
            { Icon: Disc3, x: "85%", y: "15%", delay: 1.5, size: "w-8 h-8" },
            { Icon: Headphones, x: "75%", y: "65%", delay: 3, size: "w-5 h-5" },
            { Icon: Radio, x: "15%", y: "70%", delay: 2, size: "w-7 h-7" },
            { Icon: Star, x: "90%", y: "40%", delay: 0.8, size: "w-4 h-4" },
            { Icon: Globe, x: "50%", y: "12%", delay: 2.5, size: "w-5 h-5" },
          ].map(({ Icon, x, y, delay, size }, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{ left: x, top: y }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: [0, 0.15, 0.08, 0.15, 0], y: [20, -20, 20] }}
              transition={{ duration: 8, delay, repeat: Infinity, ease: "easeInOut" }}
            >
              <Icon className={`${size} text-orange-400/30`} />
            </motion.div>
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center pt-20 sm:pt-24">
          <div className="container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* Left — Text */}
              <div className="max-w-2xl">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 bg-orange-500/15 backdrop-blur-md border border-orange-500/25 rounded-full px-4 py-1.5 mb-5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                  </span>
                  <span className="text-orange-300 text-sm font-medium">B2B Label Licensing Platform</span>
                </motion.div>

                <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 drop-shadow-lg"
                    style={{ backgroundSize: '200% 100%', animation: 'shimmer 4s ease-in-out infinite' }}>
                    License The Future
                  </span>
                  <br />
                  <span className="text-white/90 text-[0.75em]">of Music Technology</span>
                </motion.h1>

                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}
                  className="mt-5 text-base sm:text-lg md:text-xl text-white/60 max-w-xl leading-relaxed">
                  Boostify becomes your technology partner — powering your label with <span className="text-orange-400 font-medium">AI artist generation</span>, <span className="text-amber-400 font-medium">global distribution</span>, and <span className="text-orange-300 font-medium">marketing automation</span> under your brand.
                </motion.p>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-3 mt-8">
                  <Button onClick={() => setPricingOpen(true)} size="lg"
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-7 py-6 rounded-xl shadow-xl shadow-orange-500/30 text-base transition-all hover:scale-[1.02] hover:shadow-orange-500/40">
                    <Crown className="w-5 h-5 mr-2" /> View Licensing Plans <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button variant="outline" size="lg"
                    className="border-white/20 text-white hover:bg-white/10 px-7 py-6 rounded-xl backdrop-blur-sm text-base transition-all hover:border-orange-500/40"
                    onClick={() => setActiveTab("catalog")}>
                    <Eye className="w-5 h-5 mr-2" /> Explore Catalog
                  </Button>
                </motion.div>

                {/* Trust badges */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                  className="flex items-center gap-5 mt-8 text-xs text-white/40">
                  <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-green-400/60" /> Secure Platform</span>
                  <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400/60" /> Instant Setup</span>
                  <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-blue-400/60" /> 150+ DSPs</span>
                </motion.div>
              </div>

              {/* Right — Floating Stats Dashboard Preview */}
              <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
                className="hidden lg:block">
                <div className="relative">
                  {/* Glow */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-orange-500/10 rounded-3xl blur-2xl" />

                  {/* Main card */}
                  <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">Label Dashboard</p>
                          <p className="text-white/40 text-[10px]">Real-time overview</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-green-400">Live</span>
                      </div>
                    </div>

                    {/* Mini stats */}
                    <div className="grid grid-cols-2 gap-3">
                      {stats.map((stat, i) => (
                        <motion.div key={stat.label}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-orange-500/20 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <stat.icon className="h-3.5 w-3.5 text-orange-400" />
                            <p className="text-[10px] text-white/50 truncate">{stat.label}</p>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <h4 className="text-lg font-black text-white">{stat.value}</h4>
                            {stat.change && <span className="text-[10px] text-green-400 font-semibold">{stat.change}</span>}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Mini chart */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-white/50">Revenue Trend</span>
                        <TrendingUp className="w-3 h-3 text-green-400" />
                      </div>
                      <div className="h-12 flex items-end gap-1">
                        {[30, 45, 35, 60, 55, 70, 65, 80, 75, 90, 85, 95].map((h, i) => (
                          <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }}
                            transition={{ delay: 0.8 + i * 0.04, duration: 0.4 }}
                            className="flex-1 rounded-t-sm bg-gradient-to-t from-orange-500/80 to-amber-400/60" />
                        ))}
                      </div>
                    </div>

                    {/* Mini activity */}
                    <div className="space-y-2">
                      {[
                        { text: "Nova Eclipse — Single released", time: "2h ago", color: "text-purple-400" },
                        { text: "Cipher Beat — 500K milestone", time: "5h ago", color: "text-green-400" },
                        { text: "Royalty payout — $1,240", time: "1d ago", color: "text-amber-400" },
                      ].map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 1.2 + i * 0.1 }}
                          className="flex items-center gap-2 py-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${item.color.replace('text-', 'bg-')}`} />
                          <span className="text-[10px] text-white/60 truncate flex-1">{item.text}</span>
                          <span className="text-[9px] text-white/30">{item.time}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Mobile stats (shown below hero text on small screens) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10 lg:hidden">
              {stats.map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
                  <Card className="p-3 border-orange-500/20 bg-black/30 backdrop-blur-md shadow-lg">
                    <div className="flex items-center gap-3">
                      <stat.icon className="h-5 w-5 text-orange-500 shrink-0" />
                      <div>
                        <p className="text-xs text-white/50">{stat.label}</p>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{stat.value}</h3>
                          {stat.change && <span className="text-[10px] text-green-400 font-semibold">{stat.change}</span>}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Shimmer animation */}
        <style>{`
          @keyframes shimmer {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
      </section>

      {/* ═══════════ PARTNER BAR ═══════════ */}
      <div className="border-y border-white/5 bg-black/30 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-amber-500/5" />
        <div className="container mx-auto px-4 py-5 relative">
          <div className="flex items-center justify-center gap-6 sm:gap-10 flex-wrap">
            <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-semibold">Distribute to</span>
            {PLATFORM_PARTNERS.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 * i }}
                className="flex items-center gap-2 text-white/30 hover:text-white/70 transition-colors duration-300 group">
                <p.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium hidden sm:inline">{p.name}</span>
              </motion.div>
            ))}
            <span className="text-[10px] text-white/20 font-medium">+ 145 more</span>
          </div>
        </div>
      </div>

      {/* ═══════════ TABS ═══════════ */}
      <div className="sticky top-14 sm:top-16 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2.5 scrollbar-hide">
            {[
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "create", label: "Create Label", icon: Building2 },
              { id: "catalog", label: "Artist Catalog", icon: Users },
              { id: "services", label: "Services", icon: Package },
              { id: "dashboard", label: "Label Dashboard", icon: BarChart2 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25"
                    : "text-white/40 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="container mx-auto px-4 py-8 flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

            {/* ──── OVERVIEW ──── */}
            {activeTab === "overview" && (
              <div className="space-y-16">
                {/* Value Props */}
                <section>
                  <div className="text-center mb-10">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
                      <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Platform Capabilities</span>
                    </motion.div>
                    <h2 className="text-3xl sm:text-4xl font-black mb-3">Everything Your Label Needs</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-base">Boostify becomes your technology partner — powering your label with AI, distribution, and marketing tools under your brand.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {VALUE_PROPS.map((prop, i) => (
                      <motion.div key={prop.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                        <Card className={`relative p-6 bg-gradient-to-br ${prop.gradient} border-white/5 hover:border-orange-500/30 transition-all duration-300 group cursor-pointer overflow-hidden`}>
                          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-500/5 to-transparent rounded-bl-full" />
                          <div className="relative flex gap-5">
                            <div className="p-3.5 bg-black/20 backdrop-blur-sm rounded-xl border border-white/5 shrink-0 group-hover:scale-110 group-hover:border-orange-500/20 transition-all duration-300 h-fit">
                              <prop.icon className={`w-7 h-7 ${prop.iconColor}`} />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg mb-2 group-hover:text-orange-400 transition-colors">{prop.title}</h3>
                              <p className="text-sm text-muted-foreground leading-relaxed">{prop.desc}</p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </section>

                {/* How It Works */}
                <section>
                  <div className="text-center mb-10">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
                      <Rocket className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Getting Started</span>
                    </motion.div>
                    <h2 className="text-3xl sm:text-4xl font-black mb-3">How Label Licensing Works</h2>
                    <p className="text-muted-foreground text-base">Three steps to power your record label with Boostify</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                    {/* Connection line */}
                    <div className="hidden md:block absolute top-1/2 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-orange-500/30 via-orange-500/50 to-orange-500/30 -translate-y-4" />
                    {[
                      { step: "01", title: "Choose Your Plan", desc: "Start with Elevate (3 artists), Amplify (5 artists), or Dominate (10 artists). Scale as your label grows.", icon: Crown },
                      { step: "02", title: "Build Your Catalog", desc: "Import real artists or create AI-generated virtual artists. Manage everything from one unified dashboard.", icon: Layers },
                      { step: "03", title: "Distribute & Earn", desc: "Distribute to 150+ DSPs globally, run AI marketing campaigns, and track revenue in real-time.", icon: Rocket },
                    ].map((item, i) => (
                      <motion.div key={item.step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.15 }}>
                        <Card className="relative p-7 border-white/5 hover:border-orange-500/30 transition-all duration-300 overflow-hidden group text-center bg-black/20">
                          {/* Step number background */}
                          <div className="absolute -top-3 -right-3 text-7xl font-black text-orange-500/[0.04] group-hover:text-orange-500/[0.08] transition-colors select-none">{item.step}</div>
                          <div className="relative">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-5 group-hover:from-orange-500/30 group-hover:to-amber-500/20 group-hover:scale-110 transition-all duration-300">
                              <item.icon className="w-7 h-7 text-orange-500" />
                            </div>
                            <div className="text-xs font-bold text-orange-500 mb-2 tracking-wider">STEP {item.step}</div>
                            <h3 className="font-bold text-lg mb-3">{item.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </section>

                {/* CTA */}
                <section>
                  <Card className="relative p-10 overflow-hidden border-orange-500/20">
                    {/* Background effects */}
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-orange-500/10" />
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />

                    <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                      <div>
                        <div className="inline-flex items-center gap-2 bg-orange-500/20 rounded-full px-3 py-1 mb-4">
                          <PartyPopper className="w-3.5 h-3.5 text-orange-400" />
                          <span className="text-xs font-semibold text-orange-300">Launch Pricing</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black mb-3">Ready to Build Your Label?</h3>
                        <p className="text-muted-foreground text-base">Label creation starts at <span className="text-orange-500 font-bold text-lg">$49.99/mo</span> with the Elevate plan. Enterprise licensing from <span className="text-amber-400 font-bold">$299/mo</span>.</p>
                        <div className="flex items-center gap-5 mt-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> Up to 10 AI Artists</span>
                          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> Cancel anytime</span>
                          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> Global distribution</span>
                        </div>
                      </div>
                      <div className="flex gap-3 shrink-0">
                        <Button onClick={() => setActiveTab("create")} size="lg"
                          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-8 py-6 rounded-xl shadow-xl shadow-orange-500/30 text-base transition-all hover:scale-[1.02]">
                          <Building2 className="w-5 h-5 mr-2" /> Create Your Label <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                        <Button onClick={() => setPricingOpen(true)} size="lg" variant="outline"
                          className="border-orange-500/30 hover:border-orange-500/50 hover:bg-orange-500/5 text-white font-bold px-6 py-6 rounded-xl text-base transition-all">
                          <Crown className="w-5 h-5 mr-2" /> Enterprise Plans
                        </Button>
                      </div>
                    </div>
                  </Card>
                </section>

                {/* Waitlist */}
                <section>
                  <Card className="relative p-10 overflow-hidden border-orange-500/20 bg-gradient-to-br from-black/40 to-orange-500/5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.06),transparent_70%)]" />
                    <div className="relative text-center max-w-lg mx-auto">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-5">
                        <Send className="w-7 h-7 text-orange-500" />
                      </div>
                      <h3 className="text-2xl font-black mb-3">Join the Waitlist</h3>
                      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">Be the first to know when Label Licensing launches. Early subscribers get <span className="text-orange-400 font-medium">exclusive pricing</span>.</p>
                      {waitlistSubmitted ? (
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex items-center justify-center gap-2 text-green-400 font-semibold text-lg">
                          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-400" />
                          </div>
                          You're on the list! We'll be in touch.
                        </motion.div>
                      ) : (
                        <div className="flex gap-2 max-w-md mx-auto">
                          <Input type="email" placeholder="your@label.com" value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)}
                            className="flex-1 border-orange-500/20 focus:border-orange-500 bg-black/30 backdrop-blur-sm h-12" />
                          <Button onClick={handleWaitlist} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shrink-0 h-12 px-6 font-bold">
                            <Send className="w-4 h-4 mr-2" /> Join
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </section>
              </div>
            )}

            {/* ──── CREATE LABEL (Wizard) ──── */}
            {activeTab === "create" && (
              <div className="max-w-4xl mx-auto space-y-8">

                {/* Progress Overlay */}
                {showProgress && (
                  <motion.div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <motion.div className="bg-card w-full max-w-md rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl border border-orange-500/20" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                      <div className="text-center space-y-3">
                        <div className="w-20 h-20 bg-orange-500/10 rounded-full mx-auto flex items-center justify-center"><Loader2 className="h-10 w-10 text-orange-500 animate-spin" /></div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-amber-500">Creating Your Record Label</h2>
                        <p className="text-muted-foreground text-sm">Please wait while we set up your professional music platform.</p>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between text-sm"><span>Progress</span><span className="font-bold text-orange-500">{progress}%</span></div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500" animate={{ width: `${progress}%` }} />
                        </div>
                        <div className="rounded-xl p-4 bg-orange-500/5 border border-orange-500/10">
                          <h3 className="font-semibold">{CREATION_STAGES[progressStage]?.title}</h3>
                          <p className="text-sm text-muted-foreground">{CREATION_STAGES[progressStage]?.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {/* Step Progress Bar */}
                <div className="relative bg-black/30 backdrop-blur-sm border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-2">
                    {["Label Type", "Genre & Platforms", "Plan", "Review", "Done"].map((s, i) => (
                      <div key={s} className="flex-1 flex flex-col items-center gap-1.5 relative">
                        {i > 0 && (
                          <div className={`absolute top-4 -left-1/2 w-full h-0.5 ${wizardStep > i ? "bg-gradient-to-r from-orange-500 to-amber-500" : "bg-white/5"}`} />
                        )}
                        <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${wizardStep > i + 1 ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25" : wizardStep === i + 1 ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-orange-500/20" : "bg-white/5 border border-white/10 text-white/30"}`}>
                          {wizardStep > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
                        </div>
                        <span className={`text-[10px] text-center font-medium ${wizardStep >= i + 1 ? "text-orange-400" : "text-white/30"}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 1: Label Type */}
                {wizardStep === 1 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="text-center">
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
                        <Building2 className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Step 1</span>
                      </motion.div>
                      <h2 className="text-2xl font-bold mb-2">Choose Your Label Type</h2>
                      <p className="text-muted-foreground">Select the type of record label you want to create</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {LABEL_TYPES.map((type, i) => (
                        <motion.div key={type.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                          <Card className={`relative p-6 cursor-pointer transition-all duration-300 hover:shadow-lg bg-black/20 border-white/5 overflow-hidden group ${labelConfig.type === type.id ? "border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/10" : "hover:border-orange-500/30"}`}
                            onClick={() => setLabelConfig(prev => ({ ...prev, type: type.id }))}>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-orange-500/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 ${labelConfig.type === type.id ? "bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20" : "bg-white/5 border border-white/10 group-hover:border-orange-500/20"}`}>
                                <Building2 className={`h-6 w-6 transition-colors duration-300 ${labelConfig.type === type.id ? "text-orange-500" : "text-white/40 group-hover:text-orange-500"}`} />
                              </div>
                              <h3 className="text-lg font-bold group-hover:text-orange-400 transition-colors">{type.name}</h3>
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{type.description}</p>
                              {labelConfig.type === type.id && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-3 flex justify-end">
                                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full p-1 shadow-lg shadow-orange-500/30"><Check className="h-4 w-4" /></div>
                                </motion.div>
                              )}
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="label-name" className="text-sm font-medium">Record Label Name</Label>
                        <Input id="label-name" placeholder="Enter your label name" value={labelConfig.name} onChange={(e) => setLabelConfig(prev => ({ ...prev, name: e.target.value }))}
                          className="h-12 bg-black/30 border-white/10 focus:border-orange-500 backdrop-blur-sm" />
                      </div>
                      <div className="flex items-end">
                        <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]" disabled={!labelConfig.type || !labelConfig.name} onClick={() => setWizardStep(2)}>
                          Continue <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Genre & Platforms */}
                {wizardStep === 2 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="text-center">
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
                        <Music2 className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Step 2</span>
                      </motion.div>
                      <h2 className="text-2xl font-bold mb-2">Select Genre & Platforms</h2>
                      <p className="text-muted-foreground">Choose your music genre and distribution platforms</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Card className="p-6 bg-black/20 border-white/5 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <Music className="w-4 h-4 text-orange-500" />
                          </div>
                          <Label className="font-bold">Music Genre</Label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {GENRE_OPTIONS.map((g) => (
                            <Button key={g.id} variant="outline" className={`h-11 transition-all duration-300 border-white/10 ${labelConfig.genre === g.id ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/20" : "bg-white/5 hover:border-orange-500/30 hover:bg-orange-500/5"}`}
                              onClick={() => handleGenreChange(g.id)}>{g.name}</Button>
                          ))}
                        </div>
                      </Card>
                      <Card className="p-6 bg-black/20 border-white/5 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <Globe className="w-4 h-4 text-orange-500" />
                          </div>
                          <Label className="font-bold">Distribution Platforms</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {wizardPlatforms.map((p) => (
                            <Button key={p.id} variant="outline" className={`h-11 flex items-center gap-2 transition-all duration-300 border-white/10 ${(labelConfig.platforms || []).includes(p.id) ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/20" : "bg-white/5 hover:border-orange-500/30 hover:bg-orange-500/5"}`}
                              onClick={() => togglePlatform(p.id)}>{p.icon}{p.name}</Button>
                          ))}
                        </div>
                      </Card>
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" className="border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5" onClick={() => setWizardStep(1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
                      <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl px-8 shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]" disabled={!labelConfig.genre || !(labelConfig.platforms?.length)} onClick={() => setWizardStep(3)}>
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Plan */}
                {wizardStep === 3 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="text-center">
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
                        <Crown className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Step 3</span>
                      </motion.div>
                      <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
                      <p className="text-muted-foreground">Select the plan that fits your label ambition</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {WIZARD_PLANS.map((plan, i) => (
                        <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                          <Card className={`relative p-6 transition-all duration-300 cursor-pointer bg-black/20 border-white/5 overflow-hidden group h-full ${labelConfig.artistCount === plan.artistCount ? "border-orange-500 bg-orange-500/5 shadow-xl shadow-orange-500/15" : "hover:border-orange-500/30 hover:shadow-lg"} ${plan.popular ? "md:-translate-y-2" : ""}`}
                            onClick={() => handlePlanChange(plan.id)}>
                            {plan.popular && (
                              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
                            )}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-500/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            {plan.popular && <Badge className="absolute -top-0.5 right-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] border-0 font-bold shadow-lg shadow-orange-500/30">Most Popular</Badge>}
                            <div className="relative">
                              <h3 className="text-xl font-bold mb-1 group-hover:text-orange-400 transition-colors">{plan.name}</h3>
                              <div className="flex items-baseline gap-1 mb-5">
                                <span className={`text-3xl font-black ${plan.popular ? "bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent" : ""}`}>${plan.price}</span>
                                <span className="text-white/40 text-sm">/month</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm mb-4 p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/10">
                                <Users className="h-4 w-4 text-orange-500" />
                                <span className="font-semibold">{plan.artistCount} AI Artists</span>
                              </div>
                              <ul className="space-y-2.5 mb-5">
                                {plan.features.map((f, fi) => (
                                  <li key={fi} className="flex items-start gap-2 text-xs">
                                    <Check className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                                    <span className="text-white/70">{f}</span>
                                  </li>
                                ))}
                              </ul>
                              <Button className={`w-full text-sm font-bold rounded-lg transition-all duration-300 ${labelConfig.artistCount === plan.artistCount ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20" : "bg-white/5 border border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5"}`}
                                onClick={() => handlePlanChange(plan.id)}>
                                {labelConfig.artistCount === plan.artistCount ? <><Check className="w-4 h-4 mr-1" /> Selected</> : "Select Plan"}
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" className="border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5" onClick={() => setWizardStep(2)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
                      <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl px-8 shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]" disabled={!labelConfig.artistCount} onClick={() => setWizardStep(4)}>
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Review & Create */}
                {wizardStep === 4 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="text-center">
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
                        <Eye className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Step 4</span>
                      </motion.div>
                      <h2 className="text-2xl font-bold mb-2">Review & Confirm</h2>
                      <p className="text-muted-foreground">Review your Virtual Record Label details before launch</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="md:col-span-2 p-6 bg-black/20 border-white/5">
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                          <div className="shrink-0 w-32">
                            <div className="relative group">
                              {labelConfig.logoUrl ? (
                                <>
                                  <img src={labelConfig.logoUrl} alt={labelConfig.name} className="w-32 h-32 rounded-xl object-cover border border-white/10 shadow-lg" />
                                  <button
                                    type="button"
                                    onClick={removeLogo}
                                    title="Remove logo"
                                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-zinc-900 border border-white/20 hover:border-red-500/50 hover:bg-red-500/10 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                  </button>
                                </>
                              ) : (
                                <div className="w-32 h-32 bg-gradient-to-br from-orange-500/10 to-amber-500/5 rounded-xl flex items-center justify-center border border-orange-500/10">
                                  <Building2 className="h-10 w-10 text-orange-500" />
                                </div>
                              )}
                            </div>
                            <Button variant="outline" size="sm" className="mt-2.5 w-full text-xs border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5" onClick={generateLogo} disabled={isGeneratingLogo}>
                              {isGeneratingLogo ? (
                                <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generating...</>
                              ) : labelConfig.logoUrl ? (
                                <><RefreshCw className="mr-1 h-3 w-3" />Regenerate</>
                              ) : (
                                <><Wand2 className="mr-1 h-3 w-3" />AI Logo</>
                              )}
                            </Button>
                            <label className="mt-1.5 w-full inline-flex items-center justify-center gap-1 text-xs h-8 px-3 rounded-md border border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5 cursor-pointer transition-colors">
                              <Upload className="h-3 w-3" />
                              Upload
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                className="hidden"
                                onChange={handleLogoUpload}
                                disabled={isGeneratingLogo}
                              />
                            </label>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-2xl font-bold">{labelConfig.name || "Your Record Label"}</h3>
                            <p className="text-muted-foreground mb-4">{LABEL_TYPES.find(t => t.id === labelConfig.type)?.name}</p>
                            <div className="space-y-3 text-sm">
                              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5">
                                <Music className="w-4 h-4 text-orange-500 shrink-0" />
                                <span className="text-white/50">Genre:</span> <span className="font-medium">{GENRE_OPTIONS.find(g => g.id === labelConfig.genre)?.name}</span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                  <Globe className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-white/50">Platforms:</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 ml-7">
                                  {(labelConfig.platforms || []).map(pid => {
                                    const p = wizardPlatforms.find(x => x.id === pid);
                                    return <Badge key={pid} variant="outline" className="flex items-center gap-1 border-orange-500/20 bg-orange-500/5 text-orange-300">{p?.icon}{p?.name}</Badge>;
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5">
                                <Users className="w-4 h-4 text-orange-500 shrink-0" />
                                <span className="text-white/50">AI Artists:</span> <span className="font-medium">{labelConfig.artistCount}</span>
                                <span className="text-white/30 text-xs ml-auto">{WIZARD_PLANS.find(p => p.artistCount === labelConfig.artistCount)?.name} Plan</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {(labelConfig.artists?.length || 0) > 0 && (
                          <div className="mt-5 pt-4 border-t border-white/5">
                            <h4 className="font-semibold mb-3 flex items-center gap-2"><Bot className="w-4 h-4 text-orange-500" /> Generated Artists</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {labelConfig.artists?.map((a) => (
                                <div key={a.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-orange-500/20 transition-colors">
                                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500/15 to-amber-500/10 rounded-full flex items-center justify-center"><Music2 className="h-4 w-4 text-orange-500" /></div>
                                  <span className="text-sm font-medium truncate">{a.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                      <Card className="p-6 bg-black/20 border-white/5">
                        <h3 className="font-semibold mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-orange-500" /> Label Integrations</h3>
                        <div className="space-y-3">
                          {[
                            { icon: Wand2, title: "AI Marketing Assistant", desc: "Personalized strategies" },
                            { icon: Calendar, title: "Release Automation", desc: "Scheduled publishing" },
                            { icon: BarChart2, title: "Analytics Dashboard", desc: "Performance tracking" },
                            { icon: Globe, title: "Global Distribution", desc: "Multi-platform support" },
                          ].map((int) => (
                            <div key={int.title} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-orange-500/20 transition-colors group">
                              <div className="w-9 h-9 bg-gradient-to-br from-orange-500/15 to-amber-500/10 rounded-lg flex items-center justify-center group-hover:from-orange-500/25 group-hover:to-amber-500/15 transition-all"><int.icon className="h-4 w-4 text-orange-500" /></div>
                              <div><p className="font-medium text-sm">{int.title}</p><p className="text-xs text-white/40">{int.desc}</p></div>
                            </div>
                          ))}
                        </div>
                        <Button className="w-full mt-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]" onClick={createRecordLabel} disabled={isCreatingLabel}>
                          {isCreatingLabel ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : <><Building2 className="mr-2 h-4 w-4" />Create My Virtual Record Label<Bot className="ml-2 h-4 w-4" /></>}
                        </Button>
                      </Card>
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" className="border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5" onClick={() => setWizardStep(3)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
                      <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl px-8 shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]" onClick={createRecordLabel} disabled={isCreatingLabel}>
                        {isCreatingLabel ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : <><Building2 className="mr-2 h-4 w-4" />Create Label<Bot className="ml-2 h-4 w-4" /></>}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Success */}
                {wizardStep === 5 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 py-8">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 flex items-center justify-center mx-auto shadow-xl shadow-green-500/20">
                      <Check className="h-12 w-12 text-green-400" />
                    </motion.div>
                    <div>
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-4">
                        <PartyPopper className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400 text-xs font-semibold uppercase tracking-wider">Label Created</span>
                      </motion.div>
                      <h2 className="text-3xl font-black mb-3">Your Virtual Record Label is Ready!</h2>
                      <p className="text-muted-foreground max-w-lg mx-auto text-base">Congratulations! <span className="text-orange-400 font-semibold">{labelConfig.name}</span> is now live. Explore your AI-generated artists and start managing your label empire.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                      <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]" onClick={() => setActiveTab("catalog")}>
                        <Users className="mr-2 h-5 w-5" /> View Artist Catalog
                      </Button>
                      <Button variant="outline" className="border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5 px-8 py-3 rounded-xl" onClick={() => setActiveTab("dashboard")}>
                        <BarChart2 className="mr-2 h-5 w-5" /> Label Dashboard
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* ──── CATALOG ──── */}
            {activeTab === "catalog" && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
                    <Users className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Roster</span>
                  </motion.div>
                  <h2 className="text-3xl sm:text-4xl font-black mb-3">Artist Catalog</h2>
                  <p className="text-muted-foreground text-base max-w-xl mx-auto">Manage real and AI-generated artists in your label roster</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Filters */}
                  <div className="flex gap-2 flex-wrap">
                    {["All", "Real", "Virtual", "Active", "Draft"].map((filter, i) => (
                      <motion.div key={filter} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <Badge variant="outline" className={`cursor-pointer transition-all duration-300 px-3 py-1.5 ${filter === "All" ? "bg-gradient-to-r from-orange-500/15 to-amber-500/10 border-orange-500/30 text-orange-400 shadow-sm shadow-orange-500/10" : "bg-white/5 border-white/10 hover:bg-orange-500/5 hover:border-orange-500/20 text-white/50 hover:text-orange-400"}`}>
                          {filter}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                  <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02]" onClick={() => toast({ title: "Coming Soon", description: "Artist catalog management launching Q2 2026" })}>
                    <Bot className="w-4 h-4 mr-2" /> Add AI Artist
                  </Button>
                </div>

                {/* Grid */}
                {artistsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    <span className="ml-3 text-muted-foreground">Loading artists from database...</span>
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {catalogArtists.map((artist, i) => (
                    <motion.div key={artist.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="overflow-hidden hover:shadow-xl hover:border-orange-500/30 transition-all duration-300 group cursor-pointer bg-black/20 border-white/5">
                        <div className={`aspect-[4/3] relative bg-gradient-to-br ${artist.color} overflow-hidden`}>
                          {artist.image ? (
                            <img
                              src={artist.image}
                              alt={artist.name}
                              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                                <span className="text-3xl font-black text-white/60">{artist.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute bottom-3 left-3">
                            <p className="text-white font-bold text-lg drop-shadow-lg">{artist.name}</p>
                            <p className="text-white/70 text-xs">{artist.genre}</p>
                          </div>
                          <div className="absolute top-2 right-2">
                            <Badge className={`text-[10px] backdrop-blur-md ${artist.type === "virtual" ? "bg-purple-500/30 text-purple-200 border-purple-400/40" : "bg-blue-500/30 text-blue-200 border-blue-400/40"}`}>
                              {artist.type === "virtual" ? <><Bot className="w-2.5 h-2.5 mr-1" />AI</> : "Real"}
                            </Badge>
                          </div>
                          <div className="absolute top-2 left-2">
                            <Badge className={`text-[10px] backdrop-blur-md ${artist.status === "active" ? "bg-green-500/30 text-green-200 border-green-400/40" : artist.status === "draft" ? "bg-yellow-500/30 text-yellow-200 border-yellow-400/40" : "bg-white/10 text-white/70 border-white/20"}`}>
                              {artist.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between pt-1">
                            <div className="text-xs flex items-center gap-1.5"><Headphones className="w-3 h-3 text-orange-500" /><span className="text-white/40">Streams: </span><span className="font-semibold">{(artist.streams / 1000).toFixed(0)}K</span></div>
                            <div className="text-xs flex items-center gap-1.5"><DollarSign className="w-3 h-3 text-green-400" /><span className="text-white/40">Revenue: </span><span className="font-semibold text-green-400">${artist.revenue.toLocaleString()}</span></div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}

                  {/* Add Card */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="overflow-hidden border-dashed border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 cursor-pointer group h-full flex items-center justify-center min-h-[280px] bg-black/10"
                      onClick={() => toast({ title: "Coming Soon", description: "Add artists to your catalog when Label Licensing launches." })}>
                      <div className="text-center p-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-500/10 border border-orange-500/10 flex items-center justify-center mx-auto mb-4 group-hover:from-orange-500/25 group-hover:to-amber-500/15 group-hover:scale-110 transition-all duration-300">
                          <Users className="w-7 h-7 text-orange-500" />
                        </div>
                        <p className="font-bold text-sm group-hover:text-orange-400 transition-colors">Add Artist</p>
                        <p className="text-xs text-white/40 mt-1">Real or AI-generated</p>
                      </div>
                    </Card>
                  </motion.div>
                </div>
                )}

                {/* Source indicator */}
                {dbArtists.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span>Connected to database — Showing {dbArtists.length} artist{dbArtists.length !== 1 ? 's' : ''} from your label</span>
                  </div>
                )}
                {dbArtists.length === 0 && !artistsLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span>Showing demo catalog — Sign in and generate AI artists to see your real roster</span>
                  </div>
                )}
              </div>
            )}

            {/* ──── SERVICES ──── */}
            {activeTab === "services" && (
              <div className="space-y-10">
                <div className="text-center">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
                    <Package className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Full Suite</span>
                  </motion.div>
                  <h2 className="text-3xl sm:text-4xl font-black mb-3">Label Services Suite</h2>
                  <p className="text-muted-foreground max-w-xl mx-auto text-base">Every tool your label needs — available from Elevate plan. Enterprise features with Dominate.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {LABEL_SERVICES.map((service, i) => (
                    <motion.div key={service.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="p-5 border-white/5 hover:border-orange-500/30 transition-all duration-300 group cursor-pointer h-full bg-black/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-orange-500/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500/15 to-amber-500/10 border border-orange-500/10 flex items-center justify-center mb-3 group-hover:from-orange-500/25 group-hover:to-amber-500/15 group-hover:scale-105 transition-all duration-300">
                            <service.icon className="w-5 h-5 text-orange-500" />
                          </div>
                          <h3 className="font-bold text-sm mb-1.5 group-hover:text-orange-400 transition-colors">{service.title}</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">{service.desc}</p>
                          <div className="mt-3 pt-3 border-t border-white/5">
                            <Badge variant="outline" className="text-[10px] border-orange-500/20 text-orange-400/80 bg-orange-500/5">
                              <Lock className="w-2.5 h-2.5 mr-1" /> Coming Soon
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Button onClick={() => setActiveTab("create")} size="lg"
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-8 py-6 rounded-xl shadow-xl shadow-orange-500/30 text-base transition-all hover:scale-[1.02]">
                    <Building2 className="w-5 h-5 mr-2" /> Start Building Your Label <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button onClick={() => setPricingOpen(true)} size="lg" variant="outline"
                    className="border-orange-500/30 hover:border-orange-500/50 hover:bg-orange-500/5 text-white font-bold px-8 py-6 rounded-xl text-base transition-all">
                    <Crown className="w-5 h-5 mr-2" /> Enterprise Licensing Plans
                  </Button>
                </div>
              </div>
            )}

            {/* ──── DASHBOARD ──── */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
                    <BarChart2 className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Analytics</span>
                  </motion.div>
                  <h2 className="text-3xl sm:text-4xl font-black mb-3">Label Dashboard</h2>
                  <p className="text-muted-foreground text-base">Real-time insights for your record label operations</p>
                  <Badge className="mt-3 bg-orange-500/10 text-orange-400 border-orange-500/20">
                    <Lock className="w-3 h-3 mr-1" /> Preview — Full access from Elevate plan ($49.99/mo)
                  </Badge>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { title: "Total Revenue", value: "$22,151", change: "+18%", icon: DollarSign },
                    { title: "Active Artists", value: "6", change: "+2", icon: Users },
                    { title: "Pending Releases", value: "3", change: "This week", icon: Disc3 },
                    { title: "Plan Tier", value: "Amplify", change: "Active", icon: Crown },
                  ].map((kpi, i) => (
                    <motion.div key={kpi.title} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
                      <Card className="p-4 border-white/5 bg-black/20 relative overflow-hidden group hover:border-orange-500/20 transition-all duration-300">
                        <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-orange-500/5 group-hover:bg-orange-500/10 transition-colors" />
                        <kpi.icon className="w-5 h-5 text-orange-500 mb-2" />
                        <p className="text-xs text-white/40">{kpi.title}</p>
                        <p className="text-2xl font-black mt-1">{kpi.value}</p>
                        <p className="text-xs text-green-400 mt-1 font-medium">{kpi.change}</p>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="p-6 border-white/5 bg-black/20">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-500" /> Revenue Trend</h3>
                    <div className="h-48 flex items-end gap-2">
                      {[30, 45, 35, 60, 55, 70, 65, 80, 75, 90, 85, 95].map((h, i) => (
                        <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                          className="flex-1 rounded-t-sm bg-gradient-to-t from-orange-500 to-amber-500 opacity-80" />
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                      <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                    </div>
                  </Card>

                  <Card className="p-6 border-white/5 bg-black/20">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-orange-500" /> Streams by Artist</h3>
                    <div className="space-y-3">
                      {DEMO_CATALOG.filter(a => a.status === "active").map((artist) => (
                        <div key={artist.id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{artist.name}</span>
                            <span className="text-muted-foreground">{(artist.streams / 1000000).toFixed(1)}M</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(artist.streams / 2100000) * 100}%` }} transition={{ delay: 0.5, duration: 0.8 }}
                              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Activity Feed */}
                <Card className="p-6 border-white/5 bg-black/20">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><Radio className="w-4 h-4 text-orange-500" /> Recent Activity</h3>
                  <div className="space-y-3">
                    {[
                      { action: "Nova Eclipse — New single submitted for review", time: "2 hours ago", icon: Music },
                      { action: "Cipher Beat — 500K streams milestone", time: "5 hours ago", icon: Award },
                      { action: "Jade Rivers — Royalty payment processed ($1,240)", time: "1 day ago", icon: DollarSign },
                      { action: "Luna Frost — AI profile generated successfully", time: "2 days ago", icon: Bot },
                      { action: "Distribution confirmed — Apple Music, Spotify, YouTube", time: "3 days ago", icon: Globe },
                    ].map((activity, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-orange-500/5 transition-colors border border-transparent hover:border-orange-500/10">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/15 to-amber-500/10 flex items-center justify-center shrink-0">
                          <activity.icon className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{activity.action}</p>
                          <p className="text-xs text-white/30">{activity.time}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>

                {/* Dashboard Upgrade CTA */}
                <Card className="relative p-6 overflow-hidden border-orange-500/20 bg-gradient-to-r from-black/40 via-orange-500/5 to-black/40">
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl" />
                  <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-lg mb-1">Unlock Full Dashboard</h4>
                      <p className="text-sm text-white/40">Start from <span className="text-orange-400 font-semibold">Elevate ($49.99/mo)</span> with 3 AI artists, or go <span className="text-amber-400 font-semibold">Dominate ($149.99/mo)</span> for 10 artists + full label empire.</p>
                    </div>
                    <Button onClick={() => setActiveTab("create")} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl px-6 shadow-lg shadow-orange-500/20 shrink-0 transition-all hover:scale-[1.02]">
                      <Building2 className="w-4 h-4 mr-2" /> Create Label
                    </Button>
                  </div>
                </Card>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pricing Modal */}
      <LabelLicensingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </div>
  );
}
