import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "../ui/dialog";
import { Button } from "../ui/button";
import {
  Layers, User, DollarSign, Cpu, Shield, TrendingUp,
  Music2, Palette, Store, BarChart3, Wallet, ArrowDownUp,
  Brain, Zap, ChevronRight, ChevronLeft, Sparkles, X,
  CheckCircle2, Lock, ArrowDown, PieChart, Gauge, ShieldCheck,
  Eye, EyeOff
} from "lucide-react";

interface HowBoostifyWorksProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ═══════════════════════════════════════
   ANIMATED ARCHITECTURE DIAGRAM
   ═══════════════════════════════════════ */
function LayerArchitectureDiagram({ onLayerClick }: { onLayerClick: (i: number) => void }) {
  const layers = [
    { label: "Layer 1 — ArtistCore", sub: "Identity & Brand Engine", gradient: "from-cyan-500 to-blue-600", icon: User, tag: "VISIBLE", tagClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", delay: 0.1 },
    { label: "Layer 2 — RevenueRouter", sub: "Income & Growth Engine", gradient: "from-emerald-500 to-green-600", icon: DollarSign, tag: "VISIBLE", tagClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", delay: 0.25 },
    { label: "Layer 3 — Economic Engine", sub: "Autonomous Optimization", gradient: "from-orange-500 to-amber-600", icon: Cpu, tag: "AUTO", tagClass: "bg-orange-500/20 text-orange-300 border-orange-500/30", delay: 0.4 },
  ];

  return (
    <div className="relative mb-6">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/30 via-emerald-500/30 to-orange-500/30 -translate-x-1/2 z-0" />
      <div className="relative z-10 space-y-1">
        {layers.map((layer, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: layer.delay, duration: 0.5, ease: "easeOut" }}
            onClick={() => onLayerClick(i + 1)}
            className="w-full group"
          >
            <div className="relative flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 hover:bg-white/[0.05] hover:border-white/15 transition-all">
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${layer.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity`} />
              <div className={`relative w-11 h-11 rounded-xl bg-gradient-to-br ${layer.gradient} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>
                <layer.icon className="w-5 h-5 text-white" />
              </div>
              <div className="relative flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-semibold truncate">{layer.label}</p>
                  {layer.tag === "AUTO" ? <EyeOff className="w-3 h-3 text-orange-400/60 shrink-0" /> : <Eye className="w-3 h-3 text-emerald-400/60 shrink-0" />}
                </div>
                <p className="text-white/40 text-xs truncate">{layer.sub}</p>
              </div>
              <ChevronRight className="relative w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
              <span className={`absolute -top-1.5 -right-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${layer.tagClass}`}>{layer.tag}</span>
            </div>
            {i < layers.length - 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: layer.delay + 0.15 }} className="flex justify-center py-1">
                <ArrowDown className="w-3.5 h-3.5 text-white/15" />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   STAT BADGES
   ═══════════════════════════════════════ */
function StatBadge({ value, label, gradient }: { value: string; label: string; gradient: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className={`text-lg font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{value}</span>
      <span className="text-[10px] text-white/40 leading-tight text-center">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════
   FLOW DIAGRAM — Horizontal pipeline
   ═══════════════════════════════════════ */
function FlowDiagram({ items, gradient }: { items: { label: string; pct?: string }[]; gradient: string }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div className={`h-1.5 rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${Math.max(28, parseFloat(item.pct || "25"))}px` }} />
            <span className="text-[9px] text-white/50 whitespace-nowrap">{item.label}</span>
            {item.pct && <span className={`text-[10px] font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{item.pct}</span>}
          </div>
          {i < items.length - 1 && <ChevronRight className="w-3 h-3 text-white/15 mx-0.5 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════
   DISTRIBUTION RING — Revenue buckets
   ═══════════════════════════════════════ */
function DistributionRing({ segments }: { segments: { label: string; pct: number; color: string }[] }) {
  let cumulative = 0;
  const total = segments.reduce((s, seg) => s + seg.pct, 0);
  const circumference = 2 * Math.PI * 42;

  return (
    <div className="flex items-center gap-4 mb-5">
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {segments.map((seg, i) => {
            const offset = (cumulative / total) * circumference;
            const length = (seg.pct / total) * circumference;
            cumulative += seg.pct;
            return (
              <circle key={i} cx="50" cy="50" r="42" fill="none" stroke={seg.color} strokeWidth="6" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="round" className="opacity-80" />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <PieChart className="w-5 h-5 text-white/30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-[10px] text-white/50 truncate">{seg.label}</span>
            <span className="text-[10px] text-white/70 font-bold ml-auto">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MODE PILLS — Operating modes
   ═══════════════════════════════════════ */
function ModePills({ modes, activeIndex }: { modes: { name: string; color: string; desc: string }[]; activeIndex: number }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {modes.map((mode, i) => (
        <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: i === activeIndex ? 1.05 : 1 }} transition={{ delay: i * 0.06 }}
          className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${i === activeIndex ? "border-white/20 bg-white/[0.06]" : "border-white/[0.06] bg-white/[0.02]"}`}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: mode.color }} />
          <div>
            <p className="text-[10px] text-white font-semibold leading-none">{mode.name}</p>
            <p className="text-[8px] text-white/40 leading-tight mt-0.5">{mode.desc}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════
   LAYER DATA — Enhanced content
   ═══════════════════════════════════════ */
const layerData = [
  {
    id: "overview",
    title: "How Boostify Works",
    subtitle: "A 3-Layer Intelligent Architecture",
    description: "Boostify is built on a proprietary 3-layer architecture. Each layer works autonomously — powered by AI — to handle everything from your brand identity to revenue optimization. Together, they form the most advanced artist management system ever built.",
    icon: Layers,
    gradient: "from-violet-600 via-purple-600 to-indigo-600",
    glowColor: "shadow-purple-500/20",
    stats: [{ value: "24/7", label: "Autonomous" }, { value: "3", label: "AI Layers" }, { value: "∞", label: "Scalable" }],
    features: [],
  },
  {
    id: "layer1",
    title: "Layer 1 — ArtistCore",
    subtitle: "Your Digital Identity Engine",
    description: "The foundation. ArtistCore builds and manages your complete digital presence — visual brand, music distribution, merch, and fan analytics. It's the DNA of your artist brand, always evolving with AI.",
    icon: User,
    gradient: "from-cyan-500 via-blue-500 to-indigo-500",
    glowColor: "shadow-blue-500/20",
    stats: [{ value: "10+", label: "Platforms" }, { value: "AI", label: "Powered" }, { value: "Real-time", label: "Analytics" }],
    flow: [{ label: "Profile", pct: "100" }, { label: "Music", pct: "80" }, { label: "Merch", pct: "60" }, { label: "Analytics", pct: "90" }],
    features: [
      { icon: Music2, label: "Music Distribution", desc: "Upload, distribute, and sync across Spotify, Apple Music, YouTube, TikTok, and all major platforms automatically" },
      { icon: Palette, label: "AI Visual Identity", desc: "AI-generated album covers, press kits, social media content, and brand assets that evolve with your style" },
      { icon: Store, label: "Merchandise & Store", desc: "Print-on-demand merch with AI designs, digital products, and a personalized artist storefront" },
      { icon: BarChart3, label: "Audience Intelligence", desc: "Deep analytics — who your fans are, where they are, what resonates, and predictive growth insights" },
    ],
  },
  {
    id: "layer2",
    title: "Layer 2 — RevenueRouter",
    subtitle: "Your Income Growth Engine",
    description: "Every dollar that flows through your career passes through RevenueRouter. It tracks, categorizes, and intelligently distributes your income across operations, growth, and reserves. You see clean dashboards — the engine works invisibly.",
    icon: DollarSign,
    gradient: "from-emerald-500 via-green-500 to-teal-500",
    glowColor: "shadow-green-500/20",
    stats: [{ value: "5", label: "Buckets" }, { value: "Auto", label: "Distribution" }, { value: "Safe", label: "Reserves" }],
    distribution: [
      { label: "Operations", pct: 35, color: "#3b82f6" },
      { label: "Reserve", pct: 20, color: "#10b981" },
      { label: "Growth", pct: 20, color: "#8b5cf6" },
      { label: "Optimization", pct: 20, color: "#f59e0b" },
      { label: "Platform Fee", pct: 5, color: "#6b7280" },
    ],
    features: [
      { icon: Wallet, label: "Smart Wallet", desc: "Unified wallet that tracks all income: streams, sales, bookings, collaborations, and brand deals in real-time" },
      { icon: ArrowDownUp, label: "Auto Distribution", desc: "Income is automatically allocated into 5 intelligent buckets — operations, reserve, growth, optimization, and platform fee" },
      { icon: TrendingUp, label: "Growth Campaigns", desc: "AI-driven marketing: PR campaigns, social growth strategies, and influencer outreach calibrated to your budget" },
      { icon: Shield, label: "Financial Safety Net", desc: "Automatic emergency reserve building ensures you always have 3+ months of runway, even during slow periods" },
    ],
  },
  {
    id: "layer3",
    title: "Layer 3 — Economic Engine",
    subtitle: "Autonomous Financial Optimization",
    description: "The invisible brain. Using advanced algorithms, it continuously evaluates your financial health, adapts its strategy across 5 operating modes, and optimizes resource allocation — all without you lifting a finger.",
    icon: Cpu,
    gradient: "from-orange-500 via-amber-500 to-yellow-500",
    glowColor: "shadow-amber-500/20",
    stats: [{ value: "5", label: "AI Modes" }, { value: "4", label: "Agents" }, { value: "Auto", label: "Protected" }],
    modes: [
      { name: "Survival", color: "#ef4444", desc: "Max protection" },
      { name: "Stable", color: "#22c55e", desc: "Balanced (default)" },
      { name: "Expansion", color: "#3b82f6", desc: "Accelerated growth" },
      { name: "Aggressive", color: "#a855f7", desc: "Max optimization" },
      { name: "Defense", color: "#eab308", desc: "Circuit breaker" },
    ],
    features: [
      { icon: Brain, label: "AI Financial Brain", desc: "Central orchestrator (CFO Autónomo) that evaluates health, triggers mode transitions, and coordinates all agents" },
      { icon: ShieldCheck, label: "Shield Node", desc: "Real-time risk monitor with veto power and circuit breaker — can freeze everything if drawdown exceeds limits" },
      { icon: Gauge, label: "Smart Allocation", desc: "Automatically distributes surplus across 4 specialized agents: Capital Keeper, Flow Maker, Alpha Hunter, Shield Node" },
      { icon: Lock, label: "Always Protected", desc: "Operational funds and emergency reserves are NEVER at risk. Only surplus growth capital is optimized" },
    ],
  },
];

/* ═══════════════════════════════════════
   MAIN MODAL COMPONENT
   ═══════════════════════════════════════ */
export function HowBoostifyWorks({ open, onOpenChange }: HowBoostifyWorksProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeMode] = useState(1);
  const current = layerData[activeSlide];

  const next = () => setActiveSlide((p) => Math.min(p + 1, layerData.length - 1));
  const prev = () => setActiveSlide((p) => Math.max(p - 1, 0));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setActiveSlide(0); }}>
      <DialogContent className="max-w-[680px] p-0 overflow-hidden border-0 bg-transparent shadow-none [&>button]:hidden">
        <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl">
          {/* Animated background */}
          <motion.div key={current.id + "-bg"} initial={{ opacity: 0 }} animate={{ opacity: 0.08 }} transition={{ duration: 0.5 }} className={`absolute inset-0 bg-gradient-to-br ${current.gradient}`} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/[0.04] via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 40L40 0' stroke='%23fff' stroke-width='0.5'/%3E%3C/svg%3E\")", backgroundSize: "40px 40px" }} />

          {/* Close */}
          <button onClick={() => onOpenChange(false)} className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all backdrop-blur-sm">
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="relative z-10 p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div key={current.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35, ease: "easeOut" }}>
                {/* Header */}
                <div className="flex items-center gap-4 mb-2">
                  <motion.div initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200 }}
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${current.gradient} flex items-center justify-center shadow-xl ${current.glowColor}`}>
                    <current.icon className="w-7 h-7 text-white" />
                  </motion.div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{current.title}</h2>
                    <p className={`text-xs sm:text-sm font-medium bg-gradient-to-r ${current.gradient} bg-clip-text text-transparent`}>{current.subtitle}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex gap-1 mb-5">
                  {layerData.map((_, i) => (
                    <button key={i} onClick={() => setActiveSlide(i)}
                      className={`h-0.5 rounded-full transition-all duration-500 ${i === activeSlide ? `flex-[3] bg-gradient-to-r ${current.gradient}` : i < activeSlide ? "flex-1 bg-white/20" : "flex-1 bg-white/[0.07]"}`} />
                  ))}
                </div>

                <p className="text-white/55 text-sm leading-relaxed mb-5">{current.description}</p>

                {/* Stats */}
                {current.stats && (
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {current.stats.map((s, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                        <StatBadge value={s.value} label={s.label} gradient={current.gradient} />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* OVERVIEW — architecture diagram */}
                {activeSlide === 0 && <LayerArchitectureDiagram onLayerClick={setActiveSlide} />}

                {/* LAYER 1 — flow */}
                {activeSlide === 1 && "flow" in current && (current as any).flow && <FlowDiagram items={(current as any).flow} gradient={current.gradient} />}

                {/* LAYER 2 — distribution ring */}
                {activeSlide === 2 && "distribution" in current && (current as any).distribution && <DistributionRing segments={(current as any).distribution} />}

                {/* LAYER 3 — mode pills */}
                {activeSlide === 3 && "modes" in current && (current as any).modes && <ModePills modes={(current as any).modes} activeIndex={activeMode} />}

                {/* Feature cards */}
                {current.features.length > 0 && (
                  <div className="space-y-2.5 mb-6">
                    {current.features.map((f, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.07 }}
                        className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5 hover:bg-white/[0.04] hover:border-white/10 transition-all">
                        <div className={`w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br ${current.gradient} opacity-80 flex items-center justify-center group-hover:opacity-100 group-hover:scale-105 transition-all`}>
                          <f.icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-[13px] font-semibold">{f.label}</p>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/50 shrink-0" />
                          </div>
                          <p className="text-white/45 text-[11px] leading-relaxed mt-0.5">{f.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {layerData.map((_, i) => (
                        <button key={i} onClick={() => setActiveSlide(i)}
                          className={`rounded-full transition-all duration-300 ${i === activeSlide ? `w-6 h-2 bg-gradient-to-r ${current.gradient}` : "w-2 h-2 bg-white/15 hover:bg-white/30"}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-white/25">{activeSlide + 1}/{layerData.length}</span>
                  </div>
                  <div className="flex gap-2">
                    {activeSlide > 0 && (
                      <Button onClick={prev} variant="ghost" size="sm" className="text-white/50 hover:text-white hover:bg-white/10 rounded-xl gap-1 text-xs h-8">
                        <ChevronLeft className="w-3.5 h-3.5" /> Back
                      </Button>
                    )}
                    {activeSlide < layerData.length - 1 ? (
                      <Button onClick={next} size="sm" className={`bg-gradient-to-r ${current.gradient} text-white rounded-xl gap-1 text-xs border-0 hover:opacity-90 h-8 shadow-lg`}>
                        {activeSlide === 0 ? "Explore Layers" : "Next Layer"} <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button onClick={() => { onOpenChange(false); setActiveSlide(0); }} size="sm" className={`bg-gradient-to-r ${current.gradient} text-white rounded-xl gap-1 text-xs border-0 hover:opacity-90 h-8 shadow-lg`}>
                        <Sparkles className="w-3.5 h-3.5" /> Got it!
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
