import React, { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, Sparkles, Copy, Check, TrendingUp, Calendar, Headphones, Target, Music2 } from "lucide-react";

interface Props { artistId?: number; artistName?: string; genre?: string; }

const SECTIONS = [
  { id: "release", label: "Release Strategy", icon: Calendar, color: "text-green-400",
    actions: [
      { id: "release-plan", label: "30-Day Release Plan", desc: "Pre & post-release checklist" },
      { id: "pre-save-strategy", label: "Pre-Save Campaign", desc: "Maximize day-1 streams" },
      { id: "release-radar", label: "Release Radar Tips", desc: "Get picked by algorithmic playlists" },
    ] },
  { id: "playlisting", label: "Playlist Strategy", icon: Music2, color: "text-blue-400",
    actions: [
      { id: "playlist-strategy", label: "Playlisting Roadmap", desc: "Editorial + algorithmic + user" },
      { id: "playlist-pitch-tips", label: "Pitch Best Practices", desc: "What curators look for" },
      { id: "discover-weekly", label: "Discover Weekly Tips", desc: "Optimize for algorithm picks" },
    ] },
  { id: "audience", label: "Audience Growth", icon: TrendingUp, color: "text-purple-400",
    actions: [
      { id: "growth-plan", label: "Growth Plan", desc: "Tailored strategy for your level" },
      { id: "listener-retention", label: "Retention Strategy", desc: "Keep listeners coming back" },
      { id: "cross-promo", label: "Cross-Promotion", desc: "Leverage other platforms" },
    ] },
  { id: "optimization", label: "Profile Optimization", icon: Target, color: "text-pink-400",
    actions: [
      { id: "profile-audit", label: "Profile Audit", desc: "Full analysis with action items" },
      { id: "metadata-seo", label: "Metadata & SEO", desc: "Genre tags, descriptions, credits" },
      { id: "canvas-tips", label: "Canvas & Visuals", desc: "Make your tracks stand out" },
    ] },
  { id: "analytics", label: "Data & Analytics", icon: Headphones, color: "text-amber-400",
    actions: [
      { id: "listener-insights", label: "Listener Insights", desc: "Who's listening and where" },
      { id: "benchmark", label: "Benchmark Analysis", desc: "Compare with similar artists" },
      { id: "trend-analysis", label: "Trend Analysis", desc: "What's working in your genre" },
    ] },
];

export function SpotifyGrowthTab({ artistId, artistName, genre }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [openSections, setOpenSections] = useState<string[]>(["release"]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const toggle = (id: string) => setOpenSections(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  const exec = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await fetch("/api/spotify/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: actionId, params: { artistId: artistId || user?.id, artistName, genre } }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data, actionId) => { setResult(data); setActiveAction(actionId); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      {SECTIONS.map((section) => (
        <Card key={section.id} className="overflow-hidden">
          <button onClick={() => toggle(section.id)} className="flex items-center justify-between w-full p-4 text-left">
            <div className="flex items-center gap-2">
              <section.icon className={`w-5 h-5 ${section.color}`} />
              <span className="font-semibold text-sm">{section.label}</span>
              <Badge variant="secondary" className="text-[10px]">{section.actions.length} actions</Badge>
            </div>
            {openSections.includes(section.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {openSections.includes(section.id) && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 space-y-2">
                  {section.actions.map((action) => (
                    <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-green-500/40 transition">
                      <div>
                        <p className="text-sm font-medium">{action.label}</p>
                        <p className="text-xs text-muted-foreground">{action.desc}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => exec.mutate(action.id)}
                        disabled={exec.isPending && activeAction === action.id}
                        className="shrink-0 text-xs">
                        {exec.isPending && activeAction === action.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                          <><Sparkles className="w-3 h-3 mr-1 text-green-400" />Run</>}
                      </Button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ))}

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 relative">
            <Button variant="ghost" size="sm" className="absolute top-2 right-2"
              onClick={() => { navigator.clipboard.writeText(typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-green-400" /> AI Result</h4>
            <pre className="text-xs whitespace-pre-wrap max-h-80 overflow-y-auto pr-8">
              {typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2)}
            </pre>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
