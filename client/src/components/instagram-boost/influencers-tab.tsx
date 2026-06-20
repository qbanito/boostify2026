import { useState } from "react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { useInstagramConnection } from "../../hooks/use-instagram-connection";
import { useConversionTracking, type ConversionProductKey } from "../../hooks/use-conversion-tracking";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, UserPlus, User, MessageCircle, Users,
  Loader2, FileText, Send, CheckCircle, Sparkles,
  ArrowRight, Eye, Zap, Instagram, TrendingUp,
  Clock, Target, AlertCircle, Plug, Copy
} from "lucide-react";

interface InfluencersTabProps {
  artistId?: number;
}

export function InfluencersTab({ artistId }: InfluencersTabProps) {
  const { toast } = useToast();
  const ig = useInstagramConnection();
  const conversionTracker = useConversionTracking();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<any>(null);
  const [dmTarget, setDmTarget] = useState("");
  const [dmResult, setDmResult] = useState("");
  const [copied, setCopied] = useState(false);

  const [pipelineSteps, setPipelineSteps] = useState<Array<{ id: string; label: string; status: "waiting" | "active" | "done" | "error" }>>([]);
  const [showPipeline, setShowPipeline] = useState(false);

  // Influencer actions all feed the collab / DM funnel rows.
  const ACTION_PRODUCT_MAP: Record<string, ConversionProductKey> = {
    find: "growth_collab",
    strategy: "growth_collab",
    negotiate: "growth_collab",
    audit: "account_audit",
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
      { id: "generate", label: "Generating", status: "waiting" as const },
      { id: "ready", label: "Ready", status: "waiting" as const },
    ];
    setPipelineSteps(steps);
    setShowPipeline(true);

    setPipelineSteps(s => s.map(st => st.id === "analyze" ? { ...st, status: "active" as const } : st));
    await new Promise(r => setTimeout(r, 500));
    setPipelineSteps(s => s.map(st => st.id === "analyze" ? { ...st, status: "done" as const } : st));
    setPipelineSteps(s => s.map(st => st.id === "generate" ? { ...st, status: "active" as const } : st));

    try {
      const result = await ig.executeAiAction.mutateAsync({
        action,
        inputParams: { ...params, artistId },
        autoQueue: false,
      });
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

  const generateDM = async () => {
    if (!dmTarget.trim()) return;
    setActiveAction("dm");
    conversionTracker.track("growth_dm", "clicks");
    conversionTracker.track("growth_dm", "actions");
    try {
      const result = await ig.executeAiAction.mutateAsync({
        action: "generate_captions",
        inputParams: {
          customPrompt: `Write a professional collaboration DM to send to @${dmTarget} on Instagram. I'm a music artist looking to collaborate. Make it personal, short (under 100 words), and include a clear call to action. Don't be too formal.`,
          artistId,
        },
      });
      const text = result.data?.captions?.[0]?.text || result.data?.response || JSON.stringify(result.data);
      setDmResult(text);
      conversionTracker.track("growth_dm", "conversions");
    } catch {
      toast({ title: "Failed", description: "Could not generate DM", variant: "destructive" });
    }
    setActiveAction(null);
  };

  const isExecuting = ig.executeAiAction.isPending;

  const actions = [
    { id: "find", icon: <Search className="w-4 h-4" />, label: "Find Collaborators", desc: "AI finds matching creators", color: "#833ab4", action: "generate_content_ideas", params: { customPrompt: "Find 10 Instagram influencers/creators I should collaborate with as a music artist. For each: name format, niche, follower range, why they'd be a good match, and a specific collab idea. Return as structured list." } },
    { id: "strategy", icon: <Target className="w-4 h-4" />, label: "Collab Strategy", desc: "Plan your outreach campaign", color: "#fd1d1d", action: "generate_content_ideas", params: { customPrompt: "Create a 30-day influencer outreach strategy for a music artist on Instagram. Include: how many DMs per day, what to say, follow-up timing, types of collaborations to propose, and how to track results." } },
    { id: "negotiate", icon: <MessageCircle className="w-4 h-4" />, label: "Negotiate Terms", desc: "Get negotiation templates", color: "#fcb045", action: "generate_content_ideas", params: { customPrompt: "Give me 5 negotiation templates for Instagram collaborations as a music artist. Cover: free collabs, paid partnerships, music features, shoutout exchanges, and content creation deals. Include pricing ranges and what to ask for." } },
    { id: "audit", icon: <Eye className="w-4 h-4" />, label: "Network Audit", desc: "Analyze your connections", color: "#405DE6", action: "full_audit", params: { customPrompt: "Audit my Instagram network and collaborations potential." } },
  ];

  return (
    <div className="space-y-5">
      {!ig.isConnected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
            <Plug className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-600">Connect Instagram for Better Results</h3>
            <p className="text-xs text-muted-foreground mt-0.5">AI recommendations improve with real account data. Go to <strong>Extension</strong> tab to connect.</p>
          </div>
        </motion.div>
      )}

      {/* Action Grid */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#833ab4]" />
            Influencer Tools
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">AI-powered tools to find, connect, and collaborate with creators</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {actions.map((a, i) => (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              disabled={isExecuting}
              onClick={() => runAction(a.id, a.action, a.params)}
              className={`relative p-3 sm:p-4 rounded-xl border text-left transition-all overflow-hidden group ${
                activeAction === a.id && isExecuting ? "border-[#833ab4]/50 bg-[#833ab4]/5 ring-2 ring-[#833ab4]/20" : "border-border hover:border-primary/30 bg-card"
              }`}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${a.color}10 0%, transparent 70%)` }} />
              <div className="relative z-10">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${a.color}15` }}>
                  {activeAction === a.id && isExecuting ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: a.color }} /> : <div style={{ color: a.color }}>{a.icon}</div>}
                </div>
                <h4 className="text-sm font-semibold">{a.label}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">{a.desc}</p>
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
                  {step.status === "active" ? <Loader2 className="w-3 h-3 animate-spin" /> :
                   step.status === "done" ? <CheckCircle className="w-3 h-3" /> :
                   <Sparkles className="w-3 h-3" />}
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
                  <span className="text-sm font-semibold">Results</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActionResult(null)}>Clear</Button>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {actionResult.ideas ? (
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
                ) : typeof actionResult === "string" ? (
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{actionResult}</pre>
                ) : (
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3">{JSON.stringify(actionResult, null, 2)}</pre>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DM Generator */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Send className="h-4 w-4 text-[#fd1d1d]" />
          AI Outreach DM Generator
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Enter a creator's username and we'll write a personalized collaboration DM</p>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input
              value={dmTarget}
              onChange={(e) => setDmTarget(e.target.value)}
              placeholder="username"
              className="pl-7 text-sm h-9"
              disabled={isExecuting}
            />
          </div>
          <Button size="sm" disabled={!dmTarget.trim() || isExecuting}
            className="h-9 px-4 gap-1.5 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90"
            onClick={generateDM}>
            {activeAction === "dm" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate DM
          </Button>
        </div>

        <AnimatePresence>
          {dmResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-lg border border-[#833ab4]/20 bg-[#833ab4]/5 p-3 space-y-2">
              <p className="text-sm leading-relaxed">{dmResult}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => { navigator.clipboard.writeText(dmResult); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                  {copied ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} Copy DM
                </Button>
                {ig.isConnected && (
                  <Button size="sm" className="h-7 text-xs gap-1 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90"
                    onClick={() => ig.queueAction.mutate({ actionType: "send_dm", payload: { target: dmTarget, message: dmResult } })}>
                    <Instagram className="w-3 h-3" /> Queue DM
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
