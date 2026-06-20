import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { useInstagramConnection } from "../../hooks/use-instagram-connection";
import { useConversionTracking, type ConversionProductKey } from "../../hooks/use-conversion-tracking";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, MessageCircle, Heart, Users, Plus, FileText,
  Image, Video, Zap, Send, Eye, CheckCircle, Loader2,
  Clock, TrendingUp, Instagram, ArrowRight, Sparkles,
  RefreshCw, Play, Hash, Target, AlertCircle, Plug
} from "lucide-react";

// ─── Execution Pipeline Animation ─────────────────────────

interface PipelineStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "waiting" | "active" | "done" | "error";
}

function ExecutionPipeline({ steps, visible }: { steps: PipelineStep[]; visible: boolean }) {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-xl border border-[#833ab4]/30 bg-gradient-to-r from-[#833ab4]/5 to-[#fd1d1d]/5 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-[#fcb045]" />
        <span className="text-sm font-semibold">Executing Action</span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1 shrink-0">
            <motion.div
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{
                scale: step.status === "active" ? 1.1 : 1,
                opacity: step.status === "waiting" ? 0.4 : 1,
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                step.status === "done" ? "bg-green-500/10 text-green-600 border border-green-500/20" :
                step.status === "active" ? "bg-[#833ab4]/10 text-[#833ab4] border border-[#833ab4]/30 ring-2 ring-[#833ab4]/20" :
                step.status === "error" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                "bg-muted/30 text-muted-foreground border border-border"
              }`}
            >
              {step.status === "active" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : step.status === "done" ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                step.icon
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </motion.div>
            {i < steps.length - 1 && (
              <ArrowRight className={`w-3 h-3 shrink-0 ${step.status === "done" ? "text-green-500" : "text-muted-foreground/30"}`} />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Action Result Card ─────────────────────────────────────

function ActionResultCard({ result, onQueue, queueing }: {
  result: any;
  onQueue: (type: string, payload: any) => void;
  queueing: boolean;
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!result) return null;

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Handle captions
  if (result.captions) {
    return (
      <div className="space-y-2.5">
        {result.captions.map((c: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-border bg-card p-3 space-y-2 hover:border-[#833ab4]/30 transition-colors"
          >
            <p className="text-sm leading-relaxed">{c.text}</p>
            {c.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {c.hashtags.slice(0, 6).map((h: string, j: number) => (
                  <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">{h.startsWith("#") ? h : `#${h}`}</Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              {c.engagementScore && (
                <Badge variant="outline" className="text-[10px] gap-0.5">
                  <TrendingUp className="w-3 h-3" />{c.engagementScore}%
                </Badge>
              )}
              <div className="flex-1" />
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                onClick={() => copyText(c.text + (c.hashtags ? "\n\n" + c.hashtags.join(" ") : ""), i)}>
                {copiedIdx === i ? <CheckCircle className="w-3 h-3 text-green-500" /> : <FileText className="w-3 h-3" />}
                Copy
              </Button>
              <Button size="sm" disabled={queueing}
                className="h-7 text-xs gap-1 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90"
                onClick={() => onQueue("post_caption", { caption: c.text, hashtags: c.hashtags })}>
                {queueing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Instagram className="w-3 h-3" />}
                Queue
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // Handle hashtags
  if (result.groups || result.recommended_set) {
    const allTags = [...(result.groups?.high_volume || []), ...(result.groups?.medium_volume || []), ...(result.groups?.low_volume || [])];
    const recommended = result.recommended_set || allTags;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {recommended.map((h: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5">{h.startsWith("#") ? h : `#${h}`}</Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
            onClick={() => copyText(recommended.join(" "), 99)}>
            {copiedIdx === 99 ? <CheckCircle className="w-3 h-3 text-green-500" /> : <FileText className="w-3 h-3" />} Copy All
          </Button>
          <Button size="sm" disabled={queueing}
            className="h-7 text-xs gap-1 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90"
            onClick={() => onQueue("use_hashtags", { hashtags: recommended })}>
            {queueing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Instagram className="w-3 h-3" />} Queue
          </Button>
        </div>
      </div>
    );
  }

  // Handle content ideas
  if (result.ideas) {
    return (
      <div className="space-y-2">
        {result.ideas.map((idea: any, i: number) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#833ab4]/20 to-[#fcb045]/20 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-sm font-medium">{idea.title}</span>
                {idea.format && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{idea.format}</Badge>}
                {idea.bestDay && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{idea.bestDay}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{idea.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // Handle best times
  if (result.bestTimes) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {result.bestTimes.map((t: any, i: number) => (
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
    );
  }

  // Handle audit
  if (result.score != null || result.strengths || result.weaknesses) {
    return (
      <div className="space-y-3">
        {result.score != null && (
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-black ${result.score >= 80 ? "text-green-500" : result.score >= 50 ? "text-yellow-500" : "text-red-500"}`}>
              {result.score}/100
            </div>
            {result.grade && <Badge variant="outline" className="text-sm">{result.grade}</Badge>}
          </div>
        )}
        {result.strengths?.length > 0 && (
          <div>
            <span className="text-xs font-medium text-green-500">Strengths</span>
            <ul className="mt-1 space-y-1">{result.strengths.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-xs"><CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />{s}</li>
            ))}</ul>
          </div>
        )}
        {result.weaknesses?.length > 0 && (
          <div>
            <span className="text-xs font-medium text-red-400">Weaknesses</span>
            <ul className="mt-1 space-y-1">{result.weaknesses.map((w: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-xs"><AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{w}</li>
            ))}</ul>
          </div>
        )}
        {result.quickWins?.length > 0 && (
          <div className="pt-2 border-t border-border">
            <span className="text-xs font-medium text-[#fcb045]">Quick Wins</span>
            <div className="grid gap-1.5 mt-1">{result.quickWins.map((q: any, i: number) => (
              <div key={i} className="flex items-center gap-2 rounded border border-[#fcb045]/20 bg-[#fcb045]/5 p-2 text-xs">
                <Zap className="w-3 h-3 text-[#fcb045] shrink-0" />
                <span className="flex-1">{typeof q === "string" ? q : q.action}</span>
              </div>
            ))}</div>
          </div>
        )}
      </div>
    );
  }

  // Handle reels
  if (result.reels) {
    return (
      <div className="space-y-2">
        {result.reels.map((r: any, i: number) => (
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
    );
  }

  // Fallback
  if (typeof result === "string") return <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{result}</pre>;
  return <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3 max-h-40 overflow-y-auto">{JSON.stringify(result, null, 2)}</pre>;
}

// ─── Not Connected Banner ───────────────────────────────────

function NotConnectedBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
    >
      <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
        <Plug className="w-6 h-6 text-yellow-500" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-yellow-600">Connect Your Instagram Account</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Install the Boostify Chrome Extension and sync your Instagram to unlock real data.
          Go to the <strong>Extension</strong> tab to connect.
        </p>
      </div>
      <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs shrink-0">
        <AlertCircle className="w-3 h-3 mr-1" /> Not Connected
      </Badge>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface CommunityTabProps {
  artistId?: number;
}

export function CommunityTab({ artistId }: CommunityTabProps) {
  const { toast } = useToast();
  const ig = useInstagramConnection();
  const conversionTracker = useConversionTracking();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<any>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [showPipeline, setShowPipeline] = useState(false);

  // Map community-tab action ids → conversion funnel product keys.
  const ACTION_PRODUCT_MAP: Record<string, ConversionProductKey> = {
    captions: "ai_caption",
    hashtags: "ai_hashtags",
    ideas: "content_carousel",
    reels: "content_image",
    timing: "profile_extraction",
    audit: "account_audit",
  };

  const runPipeline = async (
    actionName: string,
    action: string,
    params: Record<string, any>,
  ) => {
    setActiveAction(actionName);
    setActionResult(null);

    // Conversion tracking — click + action on launch.
    const productKey = ACTION_PRODUCT_MAP[actionName];
    if (productKey) {
      conversionTracker.track(productKey, "clicks");
      conversionTracker.track(productKey, "actions");
    }

    const steps: PipelineStep[] = [
      { id: "analyze", label: "Analyzing", icon: <Eye className="w-3 h-3" />, status: "waiting" },
      { id: "generate", label: "Generating", icon: <Sparkles className="w-3 h-3" />, status: "waiting" },
      { id: "review", label: "Ready", icon: <CheckCircle className="w-3 h-3" />, status: "waiting" },
    ];

    setPipelineSteps(steps);
    setShowPipeline(true);

    // Step 1
    setPipelineSteps(s => s.map(st => st.id === "analyze" ? { ...st, status: "active" } : st));
    await new Promise(r => setTimeout(r, 500));
    setPipelineSteps(s => s.map(st => st.id === "analyze" ? { ...st, status: "done" } : st));

    // Step 2
    setPipelineSteps(s => s.map(st => st.id === "generate" ? { ...st, status: "active" } : st));

    try {
      const result = await ig.executeAiAction.mutateAsync({
        action,
        inputParams: { ...params, artistId },
        autoQueue: false,
      });

      setPipelineSteps(s => s.map(st => st.id === "generate" ? { ...st, status: "done" } : st));

      // Step 3
      setPipelineSteps(s => s.map(st => st.id === "review" ? { ...st, status: "active" } : st));
      await new Promise(r => setTimeout(r, 300));
      setPipelineSteps(s => s.map(st => st.id === "review" ? { ...st, status: "done" } : st));

      setActionResult(result.data || result);
      if (productKey) conversionTracker.track(productKey, "conversions");
      setTimeout(() => setShowPipeline(false), 1500);
    } catch (err: any) {
      setPipelineSteps(s => s.map(st => st.status === "active" ? { ...st, status: "error" } : st));
      toast({ title: "Action Failed", description: err.message, variant: "destructive" });
      setTimeout(() => setShowPipeline(false), 3000);
    }
  };

  const isExecuting = ig.executeAiAction.isPending;

  const quickActions = [
    { id: "captions", icon: <FileText className="w-4 h-4" />, label: "Generate Captions", desc: "5 viral captions ready to post", color: "#833ab4", action: "generate_captions", params: { count: 5, tone: "engaging" } },
    { id: "hashtags", icon: <Hash className="w-4 h-4" />, label: "Smart Hashtags", desc: "30 optimized hashtags", color: "#fd1d1d", action: "generate_hashtags", params: { count: 30 } },
    { id: "ideas", icon: <Sparkles className="w-4 h-4" />, label: "Content Ideas", desc: "Week of content planned", color: "#fcb045", action: "generate_content_ideas", params: { count: 7 } },
    { id: "reels", icon: <Play className="w-4 h-4" />, label: "Reel Ideas", desc: "Trending reel concepts", color: "#E1306C", action: "reels_ideas", params: {} },
    { id: "timing", icon: <Clock className="w-4 h-4" />, label: "Best Times", desc: "Optimal posting schedule", color: "#405DE6", action: "analyze_best_times", params: {} },
    { id: "audit", icon: <Target className="w-4 h-4" />, label: "Full Audit", desc: "Complete profile analysis", color: "#7232BD", action: "full_audit", params: {} },
  ];

  return (
    <div className="space-y-5">
      {!ig.isConnected && <NotConnectedBanner />}

      {/* Real Instagram Stats */}
      {ig.latestSnapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Followers", value: ig.formatNumber(ig.latestSnapshot.followers), icon: Users, color: "text-[#833ab4]", bg: "bg-[#833ab4]/10" },
            { label: "Engagement", value: `${Number(ig.latestSnapshot.engagementRate || 0).toFixed(2)}%`, icon: Heart, color: "text-[#fd1d1d]", bg: "bg-[#fd1d1d]/10" },
            { label: "Avg Likes", value: ig.formatNumber(ig.latestSnapshot.avgLikes), icon: TrendingUp, color: "text-[#fcb045]", bg: "bg-[#fcb045]/10" },
            { label: "Posts", value: ig.formatNumber(ig.latestSnapshot.postsCount), icon: Image, color: "text-[#405DE6]", bg: "bg-[#405DE6]/10" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="p-3 sm:p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black">{stat.value}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* AI Action Grid */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#fcb045]" />
              AI Actions
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ig.isConnected ? "Generates content and queues it to your Chrome extension" : "Generate content — connect extension to auto-apply"}
            </p>
          </div>
          {ig.isConnected && (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
              <CheckCircle className="w-3 h-3 mr-1" /> Live
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {quickActions.map((qa, i) => (
            <motion.button
              key={qa.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              disabled={isExecuting}
              onClick={() => runPipeline(qa.id, qa.action, qa.params)}
              className={`relative p-3 sm:p-4 rounded-xl border text-left transition-all overflow-hidden group ${
                activeAction === qa.id && isExecuting
                  ? "border-[#833ab4]/50 bg-[#833ab4]/5 ring-2 ring-[#833ab4]/20"
                  : "border-border hover:border-primary/30 bg-card"
              }`}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${qa.color}10 0%, transparent 70%)` }} />
              <div className="relative z-10">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${qa.color}15` }}>
                  {activeAction === qa.id && isExecuting ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: qa.color }} />
                  ) : (
                    <div style={{ color: qa.color }}>{qa.icon}</div>
                  )}
                </div>
                <h4 className="text-sm font-semibold">{qa.label}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">{qa.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </Card>

      {/* Execution Pipeline */}
      <AnimatePresence>
        <ExecutionPipeline steps={pipelineSteps} visible={showPipeline} />
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {actionResult && !isExecuting && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold">Results Ready</span>
                  {ig.isConnected && <Badge variant="outline" className="text-[10px] gap-0.5 text-[#833ab4] border-[#833ab4]/20"><Instagram className="w-3 h-3" /> Click Queue to send to extension</Badge>}
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActionResult(null)}>Clear</Button>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                <ActionResultCard
                  result={actionResult}
                  onQueue={(type, payload) => ig.queueAction.mutate({ actionType: type, payload })}
                  queueing={ig.queueAction.isPending}
                />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Prompt */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-[#833ab4]" />
          Ask Anything
        </h3>
        <div className="space-y-2">
          <Textarea
            placeholder="E.g. Write a caption for my new single dropping Friday..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="text-sm min-h-[60px] max-h-[120px] bg-background/50"
            disabled={isExecuting}
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={!customPrompt.trim() || isExecuting}
              className="h-8 text-xs gap-1.5 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90"
              onClick={() => runPipeline("custom", "generate_captions", { customPrompt: customPrompt.trim() })}>
              {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Generate
            </Button>
          </div>
        </div>
      </Card>

      {/* Pending Actions Queue */}
      {ig.pendingActions.length > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#fcb045]" />
              Pending Actions
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{ig.pendingActions.length}</Badge>
            </h3>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => ig.refresh()}>
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {ig.pendingActions.slice(0, 5).map((action, i) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:border-[#fcb045]/30 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  action.status === "pending" ? "bg-[#fcb045]/10" : action.status === "sent" ? "bg-blue-500/10" : "bg-green-500/10"
                }`}>
                  {action.status === "pending" ? <Clock className="w-4 h-4 text-[#fcb045]" /> :
                   action.status === "sent" ? <Send className="w-4 h-4 text-blue-500" /> :
                   <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium">
                    {action.actionType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {typeof action.payload === "object"
                      ? (action.payload.caption || action.payload.text || JSON.stringify(action.payload)).substring(0, 60) + "..."
                      : String(action.payload).substring(0, 60)}
                  </p>
                </div>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${
                  action.status === "pending" ? "text-[#fcb045] border-[#fcb045]/30" :
                  action.status === "sent" ? "text-blue-500 border-blue-500/30" :
                  "text-green-500 border-green-500/30"
                }`}>
                  {action.status}
                </Badge>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!ig.latestSnapshot && !actionResult && ig.pendingActions.length === 0 && !isExecuting && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#833ab4]/20 via-[#fd1d1d]/20 to-[#fcb045]/20 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-[#fd1d1d]" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Start Creating Content</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Use the AI actions above to generate captions, hashtags, content ideas, and more.
            Connect your Instagram extension to auto-queue content for posting.
          </p>
        </Card>
      )}
    </div>
  );
}
