import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";
import { useInstagramConnection } from "../../hooks/use-instagram-connection";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, TrendingUp, Calendar, Hash, Target,
  MessageCircle, Sparkles, Send, Loader2, CheckCircle,
  Zap, ArrowRight, Copy, Clock, Heart, Play,
  RefreshCw, Eye, Search, AlertCircle, Plug, ChevronDown
} from "lucide-react";

interface GrowthTabProps {
  artistId?: number;
}

// ─── Section Component ──────────────────────────

function GrowthSection({ title, icon: Icon, badge, children, defaultOpen = false }: {
  title: string;
  icon: any;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden border-border/60">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#833ab4]/15 to-[#fd1d1d]/15 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-[#833ab4]" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
          {badge && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{badge}</Badge>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Action Button ──────────────────────────

function ActionButton({ label, icon: Icon, loading, onClick, variant = "default" }: {
  label: string;
  icon: any;
  loading?: boolean;
  onClick: () => void;
  variant?: "default" | "gradient";
}) {
  return (
    <Button
      size="sm"
      variant={variant === "gradient" ? "default" : "outline"}
      className={variant === "gradient"
        ? "bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90 text-xs"
        : "text-xs"
      }
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Icon className="w-3.5 h-3.5 mr-1.5" />}
      {label}
    </Button>
  );
}

export function GrowthTab({ artistId }: GrowthTabProps) {
  const { toast } = useToast();
  const ig = useInstagramConnection();
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [dmTarget, setDmTarget] = useState("");

  const executeAction = async (action: string, extra?: any) => {
    setLoading(action);
    try {
      const res = await fetch("/api/instagram/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, artistId, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(prev => ({ ...prev, [action]: data.result }));
        toast({ title: "Done", description: `${action} completed` });
      } else {
        toast({ title: "Error", description: data.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!" });
  };

  if (!ig.isConnected) {
    return (
      <Card className="p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#833ab4]/15 to-[#fd1d1d]/15 flex items-center justify-center">
          <Plug className="w-8 h-8 text-[#833ab4]" />
        </div>
        <h3 className="text-lg font-bold">Connect Instagram First</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Install the Chrome extension and connect your Instagram account to unlock growth tools.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats Overview */}
      {ig.latestSnapshot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Followers", value: ig.formatNumber(ig.latestSnapshot.followers), icon: Users, color: "#833ab4" },
            { label: "Engagement", value: ig.latestSnapshot.engagementRate + "%", icon: Heart, color: "#fd1d1d" },
            { label: "Avg Likes", value: ig.formatNumber(ig.latestSnapshot.avgLikes), icon: TrendingUp, color: "#fcb045" },
            { label: "Posts", value: ig.formatNumber(ig.latestSnapshot.postsCount), icon: Calendar, color: "#E1306C" },
          ].map(s => (
            <Card key={s.label} className="p-3 text-center">
              <s.icon className="w-4 h-4 mx-auto mb-1" style={{ color: s.color }} />
              <div className="text-lg font-black">{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* 1. Content Strategy */}
      <GrowthSection title="Content Strategy" icon={Calendar} badge="ENGAGEMENT" defaultOpen={true}>
        <p className="text-xs text-muted-foreground">AI-powered posting plan based on your account data.</p>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="Weekly Plan" icon={Calendar} loading={loading === "content-plan"} onClick={() => executeAction("content-plan")} variant="gradient" />
          <ActionButton label="Best Times" icon={Clock} loading={loading === "best-times"} onClick={() => executeAction("best-times")} />
          <ActionButton label="Reel Ideas" icon={Play} loading={loading === "reel-ideas"} onClick={() => executeAction("reel-ideas")} />
          <ActionButton label="Trending Topics" icon={TrendingUp} loading={loading === "trending"} onClick={() => executeAction("trending")} />
        </div>
        <ResultDisplay result={results["content-plan"] || results["best-times"] || results["reel-ideas"] || results["trending"]} onCopy={copyText} />
      </GrowthSection>

      {/* 2. Hashtag Strategy */}
      <GrowthSection title="Hashtag Strategy" icon={Hash} badge="REACH">
        <p className="text-xs text-muted-foreground">Optimized hashtag sets to maximize your post reach.</p>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="Generate 30 Tags" icon={Hash} loading={loading === "generate-hashtags"} onClick={() => executeAction("generate-hashtags")} variant="gradient" />
          <ActionButton label="Niche Tags" icon={Target} loading={loading === "niche-hashtags"} onClick={() => executeAction("niche-hashtags")} />
          <ActionButton label="Banned Check" icon={AlertCircle} loading={loading === "banned-check"} onClick={() => executeAction("banned-check")} />
        </div>
        <ResultDisplay result={results["generate-hashtags"] || results["niche-hashtags"] || results["banned-check"]} onCopy={copyText} />
      </GrowthSection>

      {/* 3. Audience Growth */}
      <GrowthSection title="Audience Growth" icon={UserPlus} badge="GROWTH">
        <p className="text-xs text-muted-foreground">Strategies to grow your followers organically.</p>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="Growth Plan" icon={TrendingUp} loading={loading === "growth-plan"} onClick={() => executeAction("growth-plan")} variant="gradient" />
          <ActionButton label="Engagement Tips" icon={Heart} loading={loading === "engagement-tips"} onClick={() => executeAction("engagement-tips")} />
          <ActionButton label="Reply Templates" icon={MessageCircle} loading={loading === "reply-templates"} onClick={() => executeAction("reply-templates")} />
        </div>
        <ResultDisplay result={results["growth-plan"] || results["engagement-tips"] || results["reply-templates"]} onCopy={copyText} />
      </GrowthSection>

      {/* 4. Influencer Outreach */}
      <GrowthSection title="Influencer Outreach" icon={Users} badge="COLLABS">
        <p className="text-xs text-muted-foreground">Find and connect with influencers in your niche.</p>
        <div className="flex items-center gap-2 mb-2">
          <Input
            value={dmTarget}
            onChange={e => setDmTarget(e.target.value)}
            placeholder="@username to collaborate with"
            className="text-xs h-8"
          />
          <ActionButton
            label="Write DM"
            icon={Send}
            loading={loading === "write-dm"}
            onClick={() => executeAction("write-dm", { target: dmTarget })}
            variant="gradient"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="Find Collabs" icon={Search} loading={loading === "find-collabs"} onClick={() => executeAction("find-collabs")} />
          <ActionButton label="Campaign Plan" icon={Target} loading={loading === "campaign-plan"} onClick={() => executeAction("campaign-plan")} />
        </div>
        <ResultDisplay result={results["write-dm"] || results["find-collabs"] || results["campaign-plan"]} onCopy={copyText} />
      </GrowthSection>

      {/* 5. Full Account Audit */}
      <GrowthSection title="Account Audit" icon={Eye} badge="ANALYTICS">
        <p className="text-xs text-muted-foreground">Complete analysis of your Instagram profile and performance.</p>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="Full Audit" icon={Sparkles} loading={loading === "full-audit"} onClick={() => executeAction("full-audit")} variant="gradient" />
          <ActionButton label="Competitor Analysis" icon={Users} loading={loading === "competitor-analysis"} onClick={() => executeAction("competitor-analysis")} />
          <ActionButton label="30-Day Forecast" icon={TrendingUp} loading={loading === "forecast"} onClick={() => executeAction("forecast")} />
        </div>
        <ResultDisplay result={results["full-audit"] || results["competitor-analysis"] || results["forecast"]} onCopy={copyText} />
      </GrowthSection>
    </div>
  );
}

// ─── Result Display Component ──────────────────────────

function ResultDisplay({ result, onCopy }: { result?: any; onCopy: (text: string) => void }) {
  if (!result) return null;

  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);

  // Try to parse structured results
  if (typeof result === "object" && result !== null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 space-y-2"
      >
        {/* Captions */}
        {result.captions && Array.isArray(result.captions) && (
          <div className="space-y-2">
            {result.captions.map((c: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                <p className="text-sm">{c.text || c.caption || c}</p>
                {c.hashtags && <p className="text-xs text-muted-foreground">{c.hashtags}</p>}
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => onCopy(c.text || c.caption || String(c))}>
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Hashtags */}
        {result.hashtags && Array.isArray(result.hashtags) && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {result.hashtags.map((tag: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs cursor-pointer hover:bg-[#833ab4]/10" onClick={() => onCopy(tag)}>
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </Badge>
              ))}
            </div>
            <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => onCopy(result.hashtags.join(" "))}>
              <Copy className="w-3 h-3 mr-1" /> Copy All
            </Button>
          </div>
        )}

        {/* Score / Audit */}
        {result.score !== undefined && (
          <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-2">
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-black ${result.score >= 70 ? "text-green-500" : result.score >= 40 ? "text-yellow-500" : "text-red-500"}`}>
                {result.score}/100
              </div>
              <span className="text-sm text-muted-foreground">Profile Score</span>
            </div>
            {result.strengths && (
              <div>
                <span className="text-xs font-semibold text-green-600">Strengths:</span>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {result.strengths.map((s: string, i: number) => (
                    <li key={i} className="flex items-start gap-1"><CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.weaknesses && (
              <div>
                <span className="text-xs font-semibold text-red-500">Improve:</span>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {result.weaknesses.map((w: string, i: number) => (
                    <li key={i} className="flex items-start gap-1"><AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* DM / Text block */}
        {result.dm && (
          <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-2">
            <p className="text-sm whitespace-pre-wrap">{result.dm}</p>
            <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => onCopy(result.dm)}>
              <Copy className="w-3 h-3 mr-1" /> Copy DM
            </Button>
          </div>
        )}

        {/* Generic text / tips */}
        {result.tips && Array.isArray(result.tips) && (
          <div className="space-y-1.5">
            {result.tips.map((tip: string, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/40">
                <Sparkles className="w-3.5 h-3.5 text-[#fcb045] mt-0.5 shrink-0" />
                <p className="text-xs">{tip}</p>
              </div>
            ))}
          </div>
        )}

        {/* Fallback: raw object */}
        {!result.captions && !result.hashtags && !result.score && !result.dm && !result.tips && (
          <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
            <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{text}</pre>
            <Button size="sm" variant="ghost" className="text-xs h-6 px-2 mt-2" onClick={() => onCopy(text)}>
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
          </div>
        )}
      </motion.div>
    );
  }

  // Plain text result
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
      <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
        <p className="text-sm whitespace-pre-wrap">{text}</p>
        <Button size="sm" variant="ghost" className="text-xs h-6 px-2 mt-2" onClick={() => onCopy(text)}>
          <Copy className="w-3 h-3 mr-1" /> Copy
        </Button>
      </div>
    </motion.div>
  );
}
