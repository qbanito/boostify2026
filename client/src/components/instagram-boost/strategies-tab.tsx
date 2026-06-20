import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { useInstagramConnection } from "../../hooks/use-instagram-connection";
import { useConversionTracking, type ConversionProductKey } from "../../hooks/use-conversion-tracking";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Hash, Clock, TrendingUp, Loader2,
  CheckCircle, ArrowRight, Eye, Zap, Target,
  BarChart2, Calendar, Lightbulb, Instagram, Plug,
  AlertCircle, RefreshCw, FileText, Play
} from "lucide-react";

interface StrategiesTabProps {
  artistId?: number;
}

export function StrategiesTab({ artistId }: StrategiesTabProps) {
  const { toast } = useToast();
  const ig = useInstagramConnection();
  const conversionTracker = useConversionTracking();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<any>(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<Array<{ id: string; label: string; status: "waiting" | "active" | "done" | "error" }>>([]);

  // Map strategy cards → conversion funnel rows.
  const ACTION_PRODUCT_MAP: Record<string, ConversionProductKey> = {
    "content-mix": "content_carousel",
    "hashtag-strategy": "ai_hashtags",
    "growth-30": "growth_collab",
    viral: "content_image",
    posting: "profile_extraction",
    competitor: "account_audit",
  };

  const runAction = async (id: string, action: string, params: Record<string, any>) => {
    setActiveAction(id);
    setActionResult(null);

    const productKey = ACTION_PRODUCT_MAP[id];
    if (productKey) {
      conversionTracker.track(productKey, "clicks");
      conversionTracker.track(productKey, "actions");
    }
    const steps = [
      { id: "analyze", label: "Analyzing", status: "waiting" as const },
      { id: "generate", label: "Building Strategy", status: "waiting" as const },
      { id: "ready", label: "Ready", status: "waiting" as const },
    ];
    setPipelineSteps(steps);
    setShowPipeline(true);

    setPipelineSteps(s => s.map(st => st.id === "analyze" ? { ...st, status: "active" as const } : st));
    await new Promise(r => setTimeout(r, 500));
    setPipelineSteps(s => s.map(st => st.id === "analyze" ? { ...st, status: "done" as const } : st));
    setPipelineSteps(s => s.map(st => st.id === "generate" ? { ...st, status: "active" as const } : st));

    try {
      const result = await ig.executeAiAction.mutateAsync({ action, inputParams: { ...params, artistId }, autoQueue: false });
      setPipelineSteps(s => s.map(st => st.id === "generate" ? { ...st, status: "done" as const } : st));
      setPipelineSteps(s => s.map(st => st.id === "ready" ? { ...st, status: "active" as const } : st));
      await new Promise(r => setTimeout(r, 300));
      setPipelineSteps(s => s.map(st => st.id === "ready" ? { ...st, status: "done" as const } : st));
      setActionResult(result.data || result);
      if (productKey) conversionTracker.track(productKey, "conversions");
      setTimeout(() => setShowPipeline(false), 1500);
    } catch (err: any) {
      setPipelineSteps(s => s.map(st => st.status === ("active" as const) ? { ...st, status: "error" as const } : st));
      toast({ title: "Failed", description: err.message, variant: "destructive" });
      setTimeout(() => setShowPipeline(false), 3000);
    }
  };

  const isExecuting = ig.executeAiAction.isPending;

  const strategies = [
    { id: "content-mix", icon: <BarChart2 className="w-4 h-4" />, label: "Content Mix Optimizer", desc: "Find your ideal post type ratio", color: "#833ab4", action: "generate_content_ideas", params: { customPrompt: "Analyze the ideal content mix for a music artist on Instagram. Give me the optimal percentage split between: Reels, Carousels, Single Posts, Stories, Lives, and Collab posts. For each type include: best frequency per week, best times, and expected engagement rate. Return as structured data." } },
    { id: "hashtag-strategy", icon: <Hash className="w-4 h-4" />, label: "Hashtag Strategy", desc: "Full hashtag system by category", color: "#fd1d1d", action: "generate_hashtags", params: { count: 30 } },
    { id: "growth-30", icon: <TrendingUp className="w-4 h-4" />, label: "30-Day Growth Plan", desc: "Week-by-week action plan", color: "#fcb045", action: "growth_plan", params: {} },
    { id: "viral", icon: <Play className="w-4 h-4" />, label: "Viral Reel Formula", desc: "Trending hooks and formats", color: "#E1306C", action: "reels_ideas", params: {} },
    { id: "posting", icon: <Clock className="w-4 h-4" />, label: "Posting Schedule", desc: "AI-optimized times for your audience", color: "#405DE6", action: "analyze_best_times", params: {} },
    { id: "competitor", icon: <Eye className="w-4 h-4" />, label: "Competitor Analysis", desc: "Learn from similar artists", color: "#7232BD", action: "full_audit", params: { customPrompt: "Do a competitor analysis for a music artist on Instagram. Identify what top music artists (10K-100K followers) are doing right. Cover: content types, posting frequency, engagement tactics, hashtag strategies, bio optimization, and Story usage. Give me actionable takeaways I can implement today." } },
  ];

  return (
    <div className="space-y-5">
      {!ig.isConnected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0"><Plug className="w-6 h-6 text-yellow-500" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-600">Connect for Personalized Strategies</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Strategies are more accurate with your real Instagram data. Go to <strong>Extension</strong> tab.</p>
          </div>
        </motion.div>
      )}

      {/* Stats if connected */}
      {ig.latestSnapshot && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Followers", value: ig.formatNumber(ig.latestSnapshot.followers), color: "text-[#833ab4]", bg: "bg-[#833ab4]/10", icon: TrendingUp },
            { label: "Engagement", value: `${Number(ig.latestSnapshot.engagementRate || 0).toFixed(2)}%`, color: "text-[#fd1d1d]", bg: "bg-[#fd1d1d]/10", icon: Target },
            { label: "Posts", value: ig.formatNumber(ig.latestSnapshot.postsCount), color: "text-[#fcb045]", bg: "bg-[#fcb045]/10", icon: FileText },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="p-3 sm:p-4">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div className="text-xl font-black">{s.value}</div>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Strategy Grid */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#fcb045]" />
            Growth Strategies
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">AI-powered strategies customized for your account</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {strategies.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              disabled={isExecuting}
              onClick={() => runAction(s.id, s.action, s.params)}
              className={`relative p-3 sm:p-4 rounded-xl border text-left transition-all overflow-hidden group ${
                activeAction === s.id && isExecuting ? "border-[#833ab4]/50 bg-[#833ab4]/5 ring-2 ring-[#833ab4]/20" : "border-border hover:border-primary/30 bg-card"
              }`}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${s.color}10 0%, transparent 70%)` }} />
              <div className="relative z-10">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${s.color}15` }}>
                  {activeAction === s.id && isExecuting ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: s.color }} /> : <div style={{ color: s.color }}>{s.icon}</div>}
                </div>
                <h4 className="text-sm font-semibold">{s.label}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </Card>

      {/* Pipeline */}
      {showPipeline && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-[#833ab4]/30 bg-gradient-to-r from-[#833ab4]/5 to-[#fd1d1d]/5 p-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {pipelineSteps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  step.status === "done" ? "bg-green-500/10 text-green-600 border border-green-500/20" :
                  step.status === "active" ? "bg-[#833ab4]/10 text-[#833ab4] border border-[#833ab4]/30 ring-2 ring-[#833ab4]/20" :
                  step.status === "error" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                  "bg-muted/30 text-muted-foreground border border-border"
                }`}>
                  {step.status === "active" ? <Loader2 className="w-3 h-3 animate-spin" /> : step.status === "done" ? <CheckCircle className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < pipelineSteps.length - 1 && <ArrowRight className={`w-3 h-3 shrink-0 ${step.status === "done" ? "text-green-500" : "text-muted-foreground/30"}`} />}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {actionResult && !isExecuting && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold">Strategy Results</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActionResult(null)}>Clear</Button>
              </div>
              <div className="max-h-[500px] overflow-y-auto space-y-3">
                {/* Hashtags */}
                {(actionResult.groups || actionResult.recommended_set) && (
                  <div className="space-y-2">
                    {actionResult.recommended_set?.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-[#833ab4]">Recommended Set</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {actionResult.recommended_set.map((h: string, i: number) => (
                            <Badge key={i} className="text-xs px-2 py-0.5 bg-[#833ab4]/10 text-[#833ab4] border-[#833ab4]/20">{h}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {Object.entries(actionResult.groups || {}).map(([group, tags]: [string, any]) => (
                      <div key={group}>
                        <span className="text-xs font-medium text-muted-foreground capitalize">{group.replace(/_/g, " ")}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.map((t: string, i: number) => <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5">{t}</Badge>)}
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-2"
                      onClick={() => { const all = actionResult.recommended_set || []; navigator.clipboard.writeText(all.join(" ")); toast({ title: "Copied!" }); }}>
                      <FileText className="w-3 h-3" /> Copy All
                    </Button>
                  </div>
                )}

                {/* Best Times */}
                {actionResult.bestTimes && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {actionResult.bestTimes.map((t: any, i: number) => (
                      <div key={i} className="rounded-lg border border-green-500/20 bg-green-500/5 p-2.5 text-center space-y-1">
                        <span className="text-xs font-bold">{t.day}</span>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {t.times?.map((time: string, j: number) => (
                            <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600">{time}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Growth Plan */}
                {actionResult.plan && (
                  <div className="space-y-2">
                    {Object.entries(actionResult.plan).map(([week, wd]: [string, any]) => (
                      <div key={week} className="rounded-lg border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase text-muted-foreground">{week.replace(/(\d)/, " $1")}</span>
                          {wd.theme && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{wd.theme}</Badge>}
                        </div>
                        <div className="space-y-1">{wd.tasks?.map((task: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="w-8 font-medium text-muted-foreground">{task.day}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{task.type}</Badge>
                            <span className="flex-1">{task.action}</span>
                          </div>
                        ))}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reels */}
                {actionResult.reels && (
                  <div className="space-y-2">
                    {actionResult.reels.map((r: any, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                        className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[#fd1d1d]/10 flex items-center justify-center text-xs font-bold text-[#fd1d1d]">{i + 1}</div>
                          <span className="text-sm font-medium">{r.title}</span>
                        </div>
                        {r.hook && <p className="text-xs"><span className="font-medium text-[#fcb045]">Hook:</span> {r.hook}</p>}
                        {r.concept && <p className="text-xs text-muted-foreground">{r.concept}</p>}
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Content Ideas */}
                {actionResult.ideas && (
                  <div className="space-y-2">
                    {actionResult.ideas.map((idea: any, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                        className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#833ab4]/20 to-[#fcb045]/20 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{idea.title}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{idea.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Audit */}
                {(actionResult.score != null || actionResult.strengths) && (
                  <div className="space-y-2">
                    {actionResult.score != null && (
                      <div className={`text-2xl font-black ${actionResult.score >= 80 ? "text-green-500" : actionResult.score >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                        {actionResult.score}/100
                      </div>
                    )}
                    {actionResult.strengths?.map((s: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs"><CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />{s}</div>
                    ))}
                    {actionResult.weaknesses?.map((w: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs"><AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{w}</div>
                    ))}
                    {actionResult.quickWins?.map((q: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 rounded border border-[#fcb045]/20 bg-[#fcb045]/5 p-2 text-xs">
                        <Zap className="w-3 h-3 text-[#fcb045] shrink-0" />
                        <span>{typeof q === "string" ? q : q.action}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fallback */}
                {!actionResult.groups && !actionResult.bestTimes && !actionResult.plan && !actionResult.reels && !actionResult.ideas && actionResult.score == null && !actionResult.strengths && (
                  typeof actionResult === "string"
                    ? <pre className="text-sm whitespace-pre-wrap font-sans">{actionResult}</pre>
                    : <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3">{JSON.stringify(actionResult, null, 2)}</pre>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
