/**
 * Boostify · Artist Financial Enablement
 * 
 * Landing page for artist financial infrastructure services.
 * Financial services are provided by Omnia and its specialized partners.
 * Boostify does not provide tax, legal, or lending services directly.
 * 
 * Orange Boostify palette — animated with Framer Motion
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, useInView, useScroll, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { Header } from "../components/layout/header";
import { useToast } from "../hooks/use-toast";
import { 
  ArrowRight, CheckCircle2, XCircle, Zap, Building2, CreditCard, 
  TrendingUp, Shield, Eye, DollarSign, BarChart3, Sparkles,
  ChevronRight, Star, Users, Target, Lock, Globe, Loader2,
  Flame, Rocket, Crown, ArrowUpRight, Music, Mic2, Wallet, Quote,
  Calculator, PiggyBank, LineChart, Calendar, ImageIcon, RefreshCw, Wand2
} from "lucide-react";

// ============================================================
// AI-GENERATED MARKETING IMAGES
// Cached URLs returned by /api/financial-enablement/images.
// While loading, fall back to high-quality Unsplash placeholders
// so the page never looks broken.
// ============================================================

const FALLBACK_IMAGES: Record<string, string> = {
  hero_mobile: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=90",
  showcase_create: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=1000&q=90",
  showcase_structure: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=900&q=90",
  showcase_scale: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&q=90",
  banner_concert: "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?w=1800&q=90",
  calculator_visual: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=90",
  testimonial_marcus: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&q=85",
  testimonial_sofia: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&q=85",
  testimonial_damien: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&q=85",
};

function useFinancialImages() {
  const [images, setImages] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/financial-enablement/images")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.images) return;
        setImages(data.images);
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getImage = useMemo(
    () => (slot: keyof typeof FALLBACK_IMAGES) => images[slot] || FALLBACK_IMAGES[slot],
    [images]
  );

  return { getImage, images, loaded, refresh };
}

// ============================================================
// SCROLL PROGRESS BAR
// ============================================================

function ImageSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-white/[0.03] ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-shimmer bg-[length:200%_100%]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <ImageIcon size={24} className="text-white/10" />
      </div>
    </div>
  );
}

// ============================================================
// AI IMAGE GENERATOR BUTTON (admin trigger)
// ============================================================

function AIImageGeneratorButton({ onGenerated }: { onGenerated: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const { toast } = useToast();

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress("Generating images with Flux Pro Kontext...");
    try {
      const res = await fetch("/api/financial-enablement/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const data = await res.json();
      if (data.success) {
        setProgress(`Generated ${data.generated} images`);
        toast({
          title: `AI Images Generated`,
          description: `${data.generated} images created with Flux Pro Kontext. ${data.failed > 0 ? `${data.failed} failed.` : ''}`,
        });
        onGenerated();
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (err: any) {
      toast({
        title: "Generation failed",
        description: err.message,
        variant: "destructive",
      });
      setProgress("");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 2 }}
    >
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/90 border border-orange-500/40 hover:border-orange-500/70 text-orange-400 text-xs font-semibold transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed"
        title="Generate AI images with Flux Pro Kontext"
      >
        {generating ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>{progress || "Generating..."}</span>
          </>
        ) : (
          <>
            <Wand2 size={14} />
            <span>Gen AI Images</span>
          </>
        )}
      </button>
    </motion.div>
  );
}

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 20 });
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] origin-left z-[60] bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500"
      style={{ scaleX }}
    />
  );
}

// ============================================================
// FINANCIAL HEALTH CALCULATOR
// Interactive widget — artist enters monthly income, sees
// recommended tier + projected tax savings + capital readiness.
// ============================================================

function FinancialCalculator({
  imageUrl,
  onPickTier,
}: {
  imageUrl: string;
  onPickTier: (id: string) => void;
}) {
  const [income, setIncome] = useState(2500);

  const annualIncome = income * 12;
  // Heuristic projections (illustrative, not legal/tax advice)
  const projectedTaxSavings = Math.round(annualIncome * 0.18);
  const projectedCreditUnlock = income < 1500 ? 5000 : income < 5000 ? 15000 : income < 10000 ? 35000 : 75000;
  const recommendedTier =
    income < 1500
      ? { id: "readiness", name: "Financial Readiness", price: "$99" }
      : income < 5000
        ? { id: "business", name: "Artist Business Setup", price: "$299" }
        : { id: "growth", name: "Growth & Capital", price: "$49/mo" };
  const healthScore = Math.min(98, Math.round(20 + Math.log10(income + 1) * 22));

  return (
    <section className="py-14 sm:py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/[0.06] to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto">
        <motion.div className="text-center mb-10 sm:mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-5">
            <Calculator size={14} className="text-orange-400" />
            <span className="text-xs font-medium text-orange-300 tracking-wide uppercase">Free · 30 sec</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight">
            See your{" "}
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              financial potential
            </span>
          </h2>
          <p className="text-white/40 text-sm sm:text-base max-w-xl mx-auto">
            Move the slider to your average monthly income and see what's possible.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="grid lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-8 items-stretch"
        >
          {/* Left: Slider + KPIs */}
          <div className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm p-6 sm:p-8 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Monthly artist income</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                    ${income.toLocaleString()}
                  </span>
                  <span className="text-white/30 text-sm">/ month</span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <PiggyBank size={16} className="text-orange-400" />
                <div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wide leading-none">Health score</div>
                  <div className="text-orange-300 font-bold text-lg leading-tight">{healthScore}<span className="text-white/30 text-xs">/100</span></div>
                </div>
              </div>
            </div>

            <input
              type="range"
              min={300}
              max={20000}
              step={100}
              value={income}
              onChange={(e) => setIncome(Number(e.target.value))}
              className="w-full appearance-none h-2 rounded-full bg-white/10 outline-none cursor-pointer accent-orange-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-orange-400 [&::-webkit-slider-thumb]:to-amber-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-orange-500/40 [&::-webkit-slider-thumb]:cursor-grab [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-orange-400 [&::-moz-range-thumb]:border-0"
              aria-label="Monthly artist income"
            />
            <div className="flex justify-between text-[10px] text-white/25 mt-2 mb-7">
              <span>$300</span>
              <span>$5K</span>
              <span>$10K</span>
              <span>$20K+</span>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {[
                {
                  icon: DollarSign,
                  label: "Annual revenue",
                  value: `$${annualIncome.toLocaleString()}`,
                  color: "text-orange-300",
                },
                {
                  icon: Shield,
                  label: "Tax savings/yr",
                  value: `$${projectedTaxSavings.toLocaleString()}`,
                  color: "text-amber-300",
                },
                {
                  icon: CreditCard,
                  label: "Credit unlock",
                  value: `$${projectedCreditUnlock.toLocaleString()}`,
                  color: "text-orange-400",
                },
              ].map((kpi, i) => (
                <motion.div key={i}
                  className="p-3 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <kpi.icon size={14} className={`${kpi.color} mb-1.5`} />
                  <div className={`text-base sm:text-lg font-bold ${kpi.color} leading-tight`}>
                    <AnimatedCounter target={parseInt(kpi.value.replace(/[^0-9]/g, "")) || 0} prefix="$" />
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-white/40 mt-1">{kpi.label}</div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 text-[10px] text-white/25">
              * Estimates based on US averages for independent artists. Actual outcomes depend on jurisdiction, structure and personal factors. Not legal or tax advice.
            </div>
          </div>

          {/* Right: Recommendation card with AI image */}
          <motion.div
            className="relative rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-950/40 via-black to-black overflow-hidden flex flex-col"
            whileHover={{ y: -4 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative h-48 sm:h-56 overflow-hidden">
              <img src={imageUrl} alt="Your financial future" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur border border-orange-500/30">
                <Sparkles size={11} className="text-orange-400" />
                <span className="text-[10px] uppercase tracking-wider text-orange-300 font-semibold">Recommended for you</span>
              </div>
            </div>
            <div className="p-6 sm:p-7 flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={recommendedTier.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-white/40 text-xs uppercase tracking-wide mb-1">Best fit</div>
                  <h3 className="text-2xl sm:text-3xl font-bold mb-1">{recommendedTier.name}</h3>
                  <div className="text-orange-400 font-semibold text-lg mb-5">{recommendedTier.price}</div>
                </motion.div>
              </AnimatePresence>

              <ul className="space-y-2.5 mb-6 flex-1">
                {[
                  "Personalized financial roadmap",
                  "Tax-ready structure",
                  "Capital & credit readiness",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-white/65">
                    <CheckCircle2 size={15} className="text-orange-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onPickTier(recommendedTier.id)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-bold text-sm transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                Start with this plan
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================

// ============================================================
// ANIMATED BACKGROUND: floating orbs + grid
// ============================================================

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Dark gradient base */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-950/30 via-black to-black" />
      
      {/* Large ambient orbs */}
      <motion.div
        className="absolute top-10 left-1/4 w-[600px] h-[600px] rounded-full bg-orange-500/8 blur-[150px]"
        animate={{ 
          x: [0, 40, -20, 0], 
          y: [0, -30, 20, 0],
          scale: [1, 1.1, 0.95, 1] 
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-500/6 blur-[120px]"
        animate={{ 
          x: [0, -30, 20, 0], 
          y: [0, 20, -30, 0],
          scale: [1, 0.95, 1.1, 1] 
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-orange-600/5 blur-[100px]"
        animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      
      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-orange-400/30"
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -40, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.7,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// FLOATING DASHBOARD MOCK — Hero Visual (v2)
// ============================================================

function FloatingDashboardMock() {
  const [revenue, setRevenue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let v = 0;
    const timer = setInterval(() => {
      v += 920;
      if (v >= 24750) { setRevenue(24750); clearInterval(timer); }
      else setRevenue(v);
    }, 16);
    return () => clearInterval(timer);
  }, [isInView]);

  return (
    <div ref={ref} className="relative w-full">
      {/* Glow */}
      <div className="absolute -inset-8 bg-orange-500/5 rounded-3xl blur-2xl -z-10" />

      {/* Main card */}
      <motion.div
        className="relative bg-gray-950/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 shadow-2xl shadow-black/60"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        {/* Top gradient line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent rounded-t-2xl" />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">Monthly Revenue</p>
            <div className="flex items-baseline gap-0.5">
              <span className="text-white/30 text-xl font-light">$</span>
              <span className="text-5xl font-black text-white tabular-nums leading-none">
                {revenue.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <ArrowUpRight size={12} className="text-green-400" />
            <span className="text-green-400 text-xs font-bold">+247%</span>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-1.5 h-16 mb-2">
          {[30, 48, 38, 62, 52, 75, 100].map((h, i) => (
            <motion.div
              key={i}
              className={`flex-1 rounded-t-sm ${
                i === 6 ? 'bg-orange-500' : 'bg-orange-500/25'
              }`}
              style={{ height: `${h}%`, transformOrigin: 'bottom' }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.45, delay: 0.75 + i * 0.07, ease: 'easeOut' }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-white/20 mb-5">
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map(m => (
            <span key={m}>{m}</span>
          ))}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Business Score', value: '94', sub: '/100', color: 'text-orange-400', bg: 'bg-orange-500/[0.08]' },
            { label: 'Tax Status',     value: 'Active', sub: '✓ Filed', color: 'text-green-400',  bg: 'bg-green-500/[0.08]' },
            { label: 'Credit Tier',   value: 'Gold',   sub: '★★★',    color: 'text-amber-400',  bg: 'bg-amber-500/[0.08]' },
          ].map((m, i) => (
            <motion.div
              key={i}
              className={`${m.bg} border border-white/[0.05] rounded-xl p-3 text-center`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + i * 0.1 }}
            >
              <p className="text-white/25 text-[9px] uppercase tracking-wider mb-1">{m.label}</p>
              <p className={`font-black text-sm ${m.color}`}>{m.value}</p>
              <p className="text-white/20 text-[9px] mt-0.5">{m.sub}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Floating pill — left */}
      <motion.div
        className="absolute -left-8 top-12 bg-gray-900/95 backdrop-blur border border-white/[0.08] rounded-xl p-3 shadow-xl"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.3 }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <DollarSign size={15} className="text-orange-400" />
          </div>
          <div>
            <p className="text-white/25 text-[9px] uppercase tracking-wide">Structured</p>
            <p className="text-white text-base font-black">$12K</p>
          </div>
        </div>
      </motion.div>

      {/* Floating pill — right */}
      <motion.div
        className="absolute -right-6 bottom-16 bg-gray-900/95 backdrop-blur border border-white/[0.08] rounded-xl p-3 shadow-xl"
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.5 }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={15} className="text-green-400" />
          </div>
          <div>
            <p className="text-white/25 text-[9px] uppercase tracking-wide">Capital</p>
            <p className="text-green-400 text-base font-black">Approved</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================
// INFRASTRUCTURE ILLUSTRATION — Omnia section
// ============================================================

function InfrastructureIllustration() {
  return (
    <motion.div
      className="relative w-28 h-28 mx-auto mb-8"
      initial={{ scale: 0.7, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 180, damping: 15 }}
    >
      {/* Pulse rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border border-orange-500/15"
          animate={{
            scale: [1 + i * 0.2, 1.4 + i * 0.2, 1 + i * 0.2],
            opacity: [0.6, 0.1, 0.6],
          }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5, ease: 'easeInOut' }}
        />
      ))}
      {/* Core */}
      <div className="absolute inset-8 rounded-full bg-gradient-to-br from-orange-600/40 to-amber-500/20 border border-orange-500/40 flex items-center justify-center shadow-lg shadow-orange-500/20">
        <Shield size={24} className="text-orange-400" />
      </div>
      {/* Orbiting dots */}
      {[0, 72, 144, 216, 288].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const r = 44;
        return (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-orange-500/40 border border-orange-500/60"
            style={{
              top: `calc(50% + ${Math.sin(rad) * r}px - 4px)`,
              left: `calc(50% + ${Math.cos(rad) * r}px - 4px)`,
            }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
          />
        );
      })}
    </motion.div>
  );
}

// ============================================================
// ANIMATED COUNTER
// ============================================================

function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ============================================================
// PRICING TIERS (with Stripe amounts)
// ============================================================

const TIERS = [
  {
    id: "readiness",
    name: "Financial Readiness",
    price: 99,
    displayPrice: "$99",
    priceMax: "$149",
    type: "one-time",
    mode: "payment" as const,
    bgColor: "bg-orange-500/10",
    textColor: "text-orange-400",
    icon: Eye,
    features: [
      "Financial diagnosis",
      "Structure recommendation",
      "Personal roadmap",
      "Enablement system access",
    ],
    cta: "Start Here",
    popular: false,
    description: "Financial Readiness package — diagnosis, structure recommendation, and roadmap",
  },
  {
    id: "business",
    name: "Artist Business Setup",
    price: 299,
    displayPrice: "$299",
    priceMax: "$499",
    type: "one-time",
    mode: "payment" as const,
    bgColor: "bg-orange-500/15",
    textColor: "text-orange-300",
    icon: Building2,
    features: [
      "Formal business structure",
      "Income organization",
      "Tax preparation",
      "Credit foundation setup",
    ],
    cta: "Get Structured",
    popular: true,
    description: "Artist Business Setup — formal structure, income organization, tax prep, and credit foundation",
  },
  {
    id: "growth",
    name: "Growth & Capital",
    price: 49,
    displayPrice: "$49",
    priceMax: "$99",
    type: "/month",
    mode: "subscription" as const,
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
    icon: TrendingUp,
    features: [
      "Continuous monitoring",
      "Quarterly adjustments",
      "Capital preparation",
      "Partner coordination",
    ],
    cta: "Scale Up",
    popular: false,
    description: "Growth & Capital monthly — monitoring, adjustments, capital prep, and partner coordination",
  },
];

// ============================================================
// STEPS
// ============================================================

const STEPS = [
  {
    num: "01",
    title: "Create & Monetize",
    desc: "You create and monetize with Boostify",
    icon: Music,
  },
  {
    num: "02", 
    title: "Get Identified",
    desc: "Boostify identifies when you're ready for financial structuring",
    icon: Target,
  },
  {
    num: "03",
    title: "Get Connected",
    desc: "You're connected to Omnia's financial infrastructure",
    icon: Globe,
  },
  {
    num: "04",
    title: "Secure Delivery",
    desc: "Services are delivered outside the platform, securely",
    icon: Lock,
  },
];

// ============================================================
// SERVICES
// ============================================================

const SERVICES = [
  { icon: DollarSign, title: "Income Structuring", desc: "Organize how you get paid as an artist or brand" },
  { icon: Building2, title: "Business Setup Guidance", desc: "From individual to company-ready" },
  { icon: BarChart3, title: "Tax Readiness", desc: "Preparation, not confusion" },
  { icon: CreditCard, title: "Credit & Capital Readiness", desc: "Build the profile banks and partners expect" },
  { icon: TrendingUp, title: "Long-term Financial Clarity", desc: "Know where you stand, always" },
];

// ============================================================
// STATS
// ============================================================

const STATS = [
  { value: 1200, suffix: "+", label: "Artists Enabled" },
  { value: 3, suffix: "M+", prefix: "$", label: "Revenue Structured" },
  { value: 98, suffix: "%", label: "Satisfaction Rate" },
];

// ============================================================
// TESTIMONIALS
// ============================================================

const TESTIMONIALS = [
  {
    name: "Marcus Rivera",
    role: "Independent Rapper · Los Angeles",
    text: "Before Boostify, I had no idea how to structure my streaming income. Now I have an LLC, clean books, and my credit score hit 740.",
    metric: "+$18K/yr structured",
    metricColor: "text-orange-400",
    avatarSlot: "testimonial_marcus",
  },
  {
    name: "Sofia Chen",
    role: "Producer & Songwriter · New York",
    text: "I went from random PayPal payments to a proper business account with quarterly tax planning. It felt like unlocking a new level.",
    metric: "Business score: 94/100",
    metricColor: "text-green-400",
    avatarSlot: "testimonial_sofia",
  },
  {
    name: "Damien Brooks",
    role: "Singer-Songwriter · Atlanta",
    text: "The Capital Readiness program got me approved for a $25K business line of credit. That money funded my album and first real tour.",
    metric: "$25K credit line approved",
    metricColor: "text-amber-400",
    avatarSlot: "testimonial_damien",
  },
];

// ============================================================
// ANIMATION VARIANTS
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

// ============================================================
// COMPONENT
// ============================================================

export default function FinancialEnablementPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const { toast } = useToast();
  const { getImage, loaded, refresh } = useFinancialImages();
  const isAdmin = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1';

  const scrollToTier = (tierId: string) => {
    const el = document.getElementById(`tier-${tierId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // brief highlight pulse
      el.classList.add("ring-2", "ring-orange-500/60");
      setTimeout(() => el.classList.remove("ring-2", "ring-orange-500/60"), 1500);
    } else {
      const pricing = document.getElementById("pricing");
      pricing?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Stripe checkout handler — uses the existing /api/stripe/create-product-payment endpoint
  const handleCheckout = async (tier: typeof TIERS[number]) => {
    setLoadingTier(tier.id);
    try {
      const response = await fetch('/api/stripe/create-product-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: `financial-enablement-${tier.id}`,
          productType: 'financial_enablement',
          amount: tier.price,
          name: `Boostify Financial Enablement — ${tier.name}`,
        }),
      });

      const data = await response.json();

      if (data.success && data.url) {
        window.location.href = data.url;
      } else if (data.alreadyPurchased) {
        toast({
          title: "Already purchased",
          description: "You've already purchased this plan. Check your email for details.",
        });
      } else {
        throw new Error(data.message || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <ScrollProgressBar />
      <Header />

      {/* Admin: AI image generation button (visible with ?admin=1) */}
      {isAdmin && <AIImageGeneratorButton onGenerated={refresh} />}

      {/* ===== 1. HERO ===== */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <HeroBackground />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-16 w-full">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Copy */}
            <motion.div initial="hidden" animate="visible" variants={containerVariants}>
              <motion.div variants={itemVariants}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-8"
              >
                <Flame size={14} className="text-orange-400" />
                <span className="text-xs font-medium text-orange-300 tracking-wide uppercase">
                  Artist Financial Enablement
                </span>
              </motion.div>

              <motion.h1 variants={itemVariants}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.08] mb-4 sm:mb-6"
              >
                Turn your art into{" "}
                <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                  a real business.
                </span>
              </motion.h1>

              <motion.p variants={itemVariants}
                className="text-base sm:text-lg md:text-xl text-white/50 max-w-xl mb-6 sm:mb-10 leading-relaxed"
              >
                Structure, protect, and scale your income — beyond music and visuals. 
                Built for artists who are serious about their future.
              </motion.p>

              <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
                <a href="#pricing"
                  className="group inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-bold text-base sm:text-lg transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02]"
                >
                  Get Financially Ready
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </a>
                <a href="#how-it-works"
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-xl border border-white/10 hover:border-orange-500/30 text-white/70 hover:text-white font-medium transition-all duration-300 hover:bg-white/[0.03]"
                >
                  How it works
                  <ChevronRight size={16} />
                </a>
              </motion.div>

              {/* Trust badges */}
              <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 sm:gap-6 mt-12 text-white/30 text-xs">
                <div className="flex items-center gap-1.5">
                  <Shield size={14} className="text-orange-500/50" />
                  <span>Secure & Compliant</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <Wallet size={14} className="text-orange-500/50" />
                  <span>Stripe Checkout</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <Star size={14} className="text-orange-500/50" />
                  <span>Powered by Omnia</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right: Image (mobile) + Chart (desktop) */}
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
            >
              {/* Mobile/Tablet: Artist lifestyle image */}
              <div className="block lg:hidden mt-4">
                <div className="relative rounded-2xl overflow-hidden aspect-[16/10] max-w-lg mx-auto shadow-2xl shadow-orange-500/10">
                  {!loaded && <ImageSkeleton className="absolute inset-0 rounded-2xl" />}
                  <img 
                    src={getImage("hero_mobile")} 
                    alt="Artist producing music"
                    className={`w-full h-full object-cover transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    loading="eager"
                    onLoad={() => {}}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
                  {/* Floating badge */}
                  <motion.div 
                    className="absolute bottom-4 left-4 right-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      <span className="text-orange-400 text-sm font-bold">+247% Revenue Growth</span>
                    </div>
                    <p className="text-white/50 text-xs">Average artist improvement after enablement</p>
                  </motion.div>
                  {/* AI badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-orange-500/20">
                    <Sparkles size={10} className="text-orange-400" />
                    <span className="text-[10px] text-orange-300 font-medium">Flux AI</span>
                  </div>
                </div>
              </div>

              {/* Desktop: Dashboard Mock */}
              <div className="hidden lg:block">
                <div className="relative px-10 py-4">
                  <FloatingDashboardMock />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="relative py-12 border-y border-white/[0.04]">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-950/10 via-transparent to-orange-950/10" />
        <div className="relative max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-3 sm:gap-8">
            {STATS.map((stat, i) => (
              <motion.div key={i} className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-1">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix || ""} />
                </div>
                <p className="text-white/30 text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INTERACTIVE FINANCIAL CALCULATOR ===== */}
      <FinancialCalculator imageUrl={getImage("calculator_visual")} onPickTier={scrollToTier} />

      {/* ===== 2. THE PROBLEM ===== */}
      <section className="py-14 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-14"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Most artists make money.{" "}
              <span className="text-white/30">Few build stability.</span>
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">Sound familiar? You're not alone.</p>
          </motion.div>

          <motion.div className="grid sm:grid-cols-2 gap-4"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants}
          >
            {[
              { text: "You earn, but taxes are unclear", emoji: "💸" },
              { text: "You get paid, but don't build credit", emoji: "💳" },
              { text: "You grow, but everything is informal", emoji: "📄" },
              { text: "You create value, but can't access capital", emoji: "🏦" },
            ].map((problem, i) => (
              <motion.div key={i} variants={itemVariants}
                className="group flex items-start gap-4 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-red-500/20 transition-all duration-300 hover:bg-red-500/[0.02]"
              >
                <div className="text-2xl flex-shrink-0">{problem.emoji}</div>
                <div>
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center mb-3">
                    <XCircle size={16} className="text-red-400" />
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{problem.text}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== 3. THE PROMISE ===== */}
      <section className="py-14 sm:py-24 px-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-orange-500/5 rounded-full blur-[100px]" />
        
        <motion.div className="relative max-w-4xl mx-auto text-center"
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
        >
          <motion.div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-8"
            whileHover={{ scale: 1.05 }}
          >
            <Rocket size={14} className="text-orange-400" />
            <span className="text-xs font-medium text-orange-300 tracking-wide uppercase">Our Promise</span>
          </motion.div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight">
            We help artists operate like{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              real companies.
            </span>
          </h2>
          <p className="text-white/40 text-lg max-w-2xl mx-auto leading-relaxed">
            Boostify connects you with the infrastructure needed to formalize 
            your career — from income organization to financial readiness.
          </p>
        </motion.div>
      </section>

      {/* ===== VISUAL SHOWCASE ===== */}
      <section className="py-8 sm:py-14 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <motion.div 
            className="flex items-center justify-between mb-5 sm:mb-7"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-white/30 text-xs uppercase tracking-widest">Your financial journey</p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
              <Sparkles size={10} className="text-orange-400" />
              <span className="text-[10px] text-orange-300 font-medium tracking-wide">AI-powered visuals</span>
            </div>
          </motion.div>

          <motion.div 
            className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants}
          >
            {[
              { slot: "showcase_create", alt: "Artist performing live on stage", label: "Create", sublabel: "Your art, your stage", span: "col-span-2 md:col-span-1" },
              { slot: "showcase_structure", alt: "Financial planning on laptop", label: "Structure", sublabel: "Organize your income", span: "" },
              { slot: "showcase_scale", alt: "Business growth analytics", label: "Scale", sublabel: "Grow with confidence", span: "" },
            ].map((img, i) => (
              <motion.div key={i} variants={itemVariants}
                className={`relative rounded-2xl overflow-hidden aspect-[3/2] group cursor-default ${img.span}`}
                whileHover={{ scale: 1.01, transition: { duration: 0.3 } }}
              >
                {!loaded && <ImageSkeleton className="absolute inset-0" />}
                <img 
                  src={getImage(img.slot as any)} 
                  alt={img.alt} 
                  className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
                  loading="lazy" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                  <span className="block text-xs sm:text-sm font-bold text-orange-400 tracking-wide uppercase">{img.label}</span>
                  <span className="block text-white/50 text-[10px] sm:text-xs mt-0.5">{img.sublabel}</span>
                </div>
                {/* Number */}
                <div className="absolute top-3 right-3 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-orange-400">{i + 1}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== 4. WHAT YOU GET ===== */}
      <section className="py-14 sm:py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto">
          <motion.div className="text-center mb-14"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">What you get</h2>
            <p className="text-white/40 text-sm">Infrastructure, not promises.</p>
          </motion.div>

          <motion.div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants}
          >
            {SERVICES.map((service, i) => (
              <motion.div key={i} variants={itemVariants}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="group relative p-7 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-orange-500/20 transition-all duration-300 overflow-hidden"
              >
                {/* Top glow on hover */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/0 group-hover:via-orange-500/50 to-transparent transition-all duration-500" />
                
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/15 to-amber-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <service.icon size={22} className="text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-orange-300 transition-colors">{service.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{service.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== 5. HOW IT WORKS ===== */}
      <section id="how-it-works" className="py-14 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-16"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">How it works</h2>
            <p className="text-white/40 text-sm">Four simple steps to financial structure.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <motion.div key={i} className="relative group"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
              >
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <motion.div 
                    className="hidden lg:block absolute top-14 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.2, duration: 0.8 }}
                    style={{ originX: 0 }}
                  >
                    <div className="w-full h-full bg-gradient-to-r from-orange-500/30 to-orange-500/5" />
                  </motion.div>
                )}
                
                <div className="text-center">
                  <motion.div className="relative w-28 h-28 mx-auto mb-6"
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-500/5 group-hover:from-orange-500/25 group-hover:to-amber-500/10 transition-all duration-300" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <step.icon size={30} className="text-orange-400" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-xs font-bold text-black shadow-lg shadow-orange-500/30">
                      {step.num}
                    </div>
                  </motion.div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 6. PRICING ===== */}
      <section id="pricing" className="py-14 sm:py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/10 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-orange-500/5 rounded-full blur-[150px]" />
        
        <div className="relative max-w-6xl mx-auto">
          <motion.div className="text-center mb-16"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
              <Crown size={14} className="text-orange-400" />
              <span className="text-xs font-medium text-orange-300 tracking-wide uppercase">Pricing</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">Choose your level</h2>
            <p className="text-white/40 text-sm">Start where you are. Scale when you're ready.</p>
          </motion.div>

          <motion.div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants}
          >
            {TIERS.map((tier) => (
              <motion.div key={tier.id} id={`tier-${tier.id}`} variants={scaleIn}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className={`relative rounded-2xl border ${
                  tier.popular ? "border-orange-500/50" : "border-white/[0.08]"
                } bg-white/[0.02] overflow-hidden transition-all duration-300 hover:bg-white/[0.04] ${
                  tier.popular ? "shadow-lg shadow-orange-500/10" : ""
                }`}
              >
                {tier.popular && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
                )}
                {tier.popular && (
                  <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-orange-500/10 rounded-full blur-[60px]" />
                )}

                <div className="relative p-7">
                  {tier.popular && (
                    <motion.div 
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[10px] font-semibold uppercase tracking-wider mb-4"
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Star size={10} /> Most Popular
                    </motion.div>
                  )}

                  <div className={`w-12 h-12 rounded-xl ${tier.bgColor} flex items-center justify-center mb-5`}>
                    <tier.icon size={22} className={tier.textColor} />
                  </div>

                  <h3 className="text-xl font-bold mb-2">{tier.name}</h3>

                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                      {tier.displayPrice}
                    </span>
                    <span className="text-white/25 text-sm">– {tier.priceMax}</span>
                  </div>
                  <p className="text-white/25 text-xs mb-7">{tier.type}</p>

                  <div className="space-y-3.5 mb-8">
                    {tier.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <CheckCircle2 size={15} className={tier.textColor} />
                        <span className="text-sm text-white/60">{f}</span>
                      </div>
                    ))}
                  </div>

                  <motion.button
                    onClick={() => handleCheckout(tier)}
                    disabled={loadingTier !== null}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                      tier.popular
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black shadow-lg shadow-orange-500/20"
                        : "bg-white/[0.06] hover:bg-white/[0.1] text-white/80 border border-white/[0.08] hover:border-orange-500/20"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loadingTier === tier.id ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {tier.cta}
                        <ChevronRight size={14} />
                      </>
                    )}
                  </motion.button>

                  <p className="text-white/15 text-[10px] text-center mt-3">
                    Secure checkout via Stripe
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Pricing summary table */}
          <motion.div className="mt-14 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden backdrop-blur-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[380px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left p-4 text-white/40 font-medium">Level</th>
                    <th className="text-left p-4 text-white/40 font-medium">Price</th>
                    <th className="text-left p-4 text-white/40 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/[0.04] hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 text-white/70">Financial Readiness</td>
                    <td className="p-4 text-orange-400 font-medium">$99 – $149</td>
                    <td className="p-4 text-white/40">One-time</td>
                  </tr>
                  <tr className="border-b border-white/[0.04] hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 text-white/70">Business Setup</td>
                    <td className="p-4 text-orange-300 font-medium">$299 – $499</td>
                    <td className="p-4 text-white/40">One-time</td>
                  </tr>
                  <tr className="border-b border-white/[0.04] hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 text-white/70">Growth & Capital</td>
                    <td className="p-4 text-amber-400 font-medium">$49 – $99</td>
                    <td className="p-4 text-white/40">Monthly</td>
                  </tr>
                  <tr className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 text-white/30 text-xs">Backend Services</td>
                    <td className="p-4 text-white/20 text-xs">Variable</td>
                    <td className="p-4 text-white/20 text-xs">Via Omnia</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== 7. WHO IS THIS FOR ===== */}
      <section className="py-14 sm:py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div className="text-center mb-14"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl font-bold">Is this for you?</h2>
          </motion.div>

          <motion.div className="grid md:grid-cols-2 gap-6"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants}
          >
            {/* For */}
            <motion.div variants={itemVariants}
              className="p-8 rounded-2xl bg-orange-500/[0.03] border border-orange-500/[0.12] hover:border-orange-500/25 transition-all duration-300"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-orange-400" />
                </div>
                For artists who:
              </h3>
              <div className="space-y-4">
                {[
                  "Generate income from their art",
                  "Want to grow long-term",
                  "Want to stop improvising",
                  "Are ready to invest in themselves",
                ].map((item, i) => (
                  <motion.div key={i} className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                  >
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-400 to-amber-400" />
                    <span className="text-white/60 text-sm">{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Not for */}
            <motion.div variants={itemVariants}
              className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-300"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
                  <XCircle size={20} className="text-white/30" />
                </div>
                <span className="text-white/50">Not for:</span>
              </h3>
              <div className="space-y-4">
                {[
                  "Hobbyists with no revenue",
                  "Quick-money seekers",
                  "People looking for guarantees",
                  "Those not ready to commit",
                ].map((item, i) => (
                  <motion.div key={i} className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                    <span className="text-white/30 text-sm">{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== AI VISUAL GALLERY ===== */}
      <section className="py-14 sm:py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent pointer-events-none" />
        <div className="relative max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-orange-400" />
                <span className="text-xs font-medium text-orange-300 uppercase tracking-widest">AI-Generated · Flux Pro Kontext</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold">See your world, transformed</h2>
            </div>
            <p className="text-white/30 text-sm max-w-xs text-left sm:text-right">
              Every visual is AI-generated exclusively for Boostify artists
            </p>
          </motion.div>

          {/* Gallery grid: 2 large + 1 tall on the right */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants}
          >
            {/* Left col: 2 stacked */}
            <div className="col-span-1 md:col-span-1 flex flex-col gap-3 sm:gap-4">
              {[
                { slot: "showcase_structure", alt: "Financial structure", label: "Structure" },
                { slot: "calculator_visual", alt: "Financial dashboard", label: "Visualize" },
              ].map((img, i) => (
                <motion.div key={i} variants={itemVariants}
                  className="relative rounded-xl overflow-hidden aspect-square group"
                  whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
                >
                  {!loaded && <ImageSkeleton className="absolute inset-0" />}
                  <img
                    src={getImage(img.slot as any)}
                    alt={img.alt}
                    className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">{img.label}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Center: large feature image */}
            <motion.div variants={itemVariants}
              className="col-span-1 relative rounded-xl overflow-hidden group"
              style={{ minHeight: "320px" }}
              whileHover={{ scale: 1.01, transition: { duration: 0.3 } }}
            >
              {!loaded && <ImageSkeleton className="absolute inset-0" />}
              <img
                src={getImage("showcase_create")}
                alt="Artist on stage"
                className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <p className="text-white font-bold text-base sm:text-xl leading-tight">Create.<br />Structure.<br />Scale.</p>
                <p className="text-orange-400 text-xs mt-1 font-medium">Your full journey</p>
              </div>
              {/* AI badge */}
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-orange-500/30">
                <Wand2 size={9} className="text-orange-400" />
                <span className="text-[9px] text-orange-300 font-medium">Flux AI</span>
              </div>
            </motion.div>

            {/* Right: scale image */}
            <motion.div variants={itemVariants}
              className="col-span-1 hidden md:block relative rounded-xl overflow-hidden group"
              style={{ minHeight: "320px" }}
              whileHover={{ scale: 1.01, transition: { duration: 0.3 } }}
            >
              {!loaded && <ImageSkeleton className="absolute inset-0" />}
              <img
                src={getImage("showcase_scale")}
                alt="Growth and scale"
                className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wide block mb-1">Scale</span>
                <p className="text-white/60 text-xs leading-relaxed">Unlimited growth for independent artists</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-14 sm:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/[0.08] to-transparent" />
        <div className="relative max-w-6xl mx-auto">
          <motion.div className="text-center mb-14"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
              <Star size={14} className="text-orange-400" />
              <span className="text-xs font-medium text-orange-300 tracking-wide uppercase">Success Stories</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Artists who took control</h2>
            <p className="text-white/40 text-sm">Real results. Real artists.</p>
          </motion.div>

          <motion.div className="grid md:grid-cols-3 gap-6"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants}
          >
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={i} variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="relative p-7 rounded-2xl bg-white/[0.02] border border-white/[0.07] hover:border-orange-500/20 transition-all duration-300 overflow-hidden group flex flex-col"
              >
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/0 group-hover:via-orange-500/40 to-transparent transition-all duration-500" />

                <Quote size={22} className="text-orange-500/25 mb-5 flex-shrink-0" />

                <p className="text-white/50 text-sm leading-relaxed mb-5 flex-1">
                  "{t.text}"
                </p>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] mb-6 self-start">
                  <TrendingUp size={12} className={t.metricColor} />
                  <span className={`text-xs font-bold ${t.metricColor}`}>{t.metric}</span>
                </div>

                <div className="flex items-center gap-3 pt-5 border-t border-white/[0.06]">
                  <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-orange-500/30 flex-shrink-0">
                    {!loaded && <ImageSkeleton className="absolute inset-0 rounded-full" />}
                    <img
                      src={getImage(t.avatarSlot as any)}
                      alt={t.name}
                      className={`w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-white/30 text-xs">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== VISUAL BANNER ===== */}
      <section className="relative overflow-hidden">
        <motion.div 
          className="relative h-56 sm:h-80 md:h-96"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
        >
          {!loaded && <ImageSkeleton className="absolute inset-0" />}
          <motion.img 
            src={getImage("banner_concert")} 
            alt="Concert audience with lights"
            className={`w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700`}
            loading="lazy"
            style={{ objectPosition: "center 30%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-black" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
          <div className="absolute inset-0 bg-orange-500/8" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-4">
            <motion.div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur border border-orange-500/30"
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles size={12} className="text-orange-400" />
              <span className="text-xs text-orange-300 font-medium">1,200+ artists already enrolled</span>
            </motion.div>
            <motion.p 
              className="text-xl sm:text-2xl md:text-4xl font-bold text-center max-w-2xl leading-tight"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Your art deserves{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                financial power.
              </span>
            </motion.p>
            <motion.a
              href="#pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-bold text-sm transition-all duration-300 shadow-lg shadow-orange-500/30"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Start Now
              <ArrowRight size={16} />
            </motion.a>
          </div>
        </motion.div>
      </section>

      {/* ===== 8. POWERED BY OMNIA ===== */}
      <section className="py-14 sm:py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent" />
        <motion.div className="relative max-w-3xl mx-auto text-center"
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
        >
          <InfrastructureIllustration />
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
            <Shield size={14} className="text-white/30" />
            <span className="text-xs text-white/30 tracking-wide">Operated by Third-party Partners</span>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Powered by <span className="text-orange-400">Omnia</span> Financial Infrastructure
          </h2>
          <p className="text-white/35 text-sm leading-relaxed max-w-xl mx-auto mb-10">
            Financial services are provided by Omnia and its specialized partners.
            Boostify does not provide tax, legal, or lending services directly.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-white/25 text-sm">
            {["Clarity", "Trust", "Compliance"].map((item, i) => (
              <motion.div key={i} className="flex items-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.15 }}
              >
                <CheckCircle2 size={16} className="text-orange-500/50" />
                <span>{item}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ===== 9. FINAL CTA ===== */}
      <section className="py-16 sm:py-28 px-4 relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-500/8 rounded-full blur-[120px]" />
        
        <motion.div className="relative max-w-3xl mx-auto text-center"
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
        >
          <motion.div
            className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Mic2 size={32} className="text-orange-400" />
          </motion.div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Ready to operate like{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              a professional?
            </span>
          </h2>
          <p className="text-white/35 text-lg mb-10 max-w-lg mx-auto">
            Join 1,200+ artists who've already taken control of their financial future.
          </p>

          <motion.a href="#pricing"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-bold text-lg transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
          >
            Start Financial Enablement
            <ArrowRight size={20} />
          </motion.a>
        </motion.div>
      </section>

      {/* ===== FOOTER LEGAL ===== */}
      <footer className="py-8 px-4 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-white/15 text-xs leading-relaxed">
            Boostify is a creative technology platform. Financial, tax, and capital services 
            are provided by third-party partners through Omnia. No financial outcomes are guaranteed.
            All payments are securely processed through Stripe.
          </p>
        </div>
      </footer>
    </div>
  );
}
