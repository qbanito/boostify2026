import React, { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { SiSpotify } from "react-icons/si";
import { Headphones, Target, ListMusic, TrendingUp, Sparkles, Copy, Check, Loader2, Music2 } from "lucide-react";

interface Props { artistId?: number; artistName?: string; genre?: string; }

const TOOLS = [
  { id: "listeners-predictor", label: "Listeners Predictor", icon: Headphones, desc: "Predict monthly listeners growth", color: "text-green-400",
    fields: [{ key: "currentListeners", label: "Current Monthly Listeners", type: "number", placeholder: "e.g. 5000" },
             { key: "targetListeners", label: "Target Listeners", type: "number", placeholder: "e.g. 50000" }] },
  { id: "playlist-matcher", label: "Playlist Matcher", icon: ListMusic, desc: "Find playlists that match your sound", color: "text-blue-400",
    fields: [{ key: "trackName", label: "Track Name", placeholder: "Your song title" },
             { key: "mood", label: "Mood / Vibe", placeholder: "e.g. chill, energetic, dark" }] },
  { id: "seo-optimizer", label: "SEO Optimizer", icon: Target, desc: "Optimize metadata for discoverability", color: "text-purple-400",
    fields: [{ key: "trackName", label: "Track Name", placeholder: "Your song title" },
             { key: "description", label: "Current Description", placeholder: "Current track or artist description" }] },
  { id: "bio-generator", label: "Bio Generator", icon: Music2, desc: "Write the perfect Spotify artist bio", color: "text-pink-400",
    fields: [{ key: "highlights", label: "Highlights / Achievements", placeholder: "e.g. 1M streams, toured with..." }] },
  { id: "release-planner", label: "Release Planner", icon: TrendingUp, desc: "Plan your next release for max impact", color: "text-amber-400",
    fields: [{ key: "trackName", label: "Track Name", placeholder: "Upcoming release title" },
             { key: "releaseDate", label: "Release Date", type: "date" }] },
];

export function SpotifyToolsTab({ artistId, artistName, genre }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const exec = useMutation({
    mutationFn: async (toolId: string) => {
      const tool = TOOLS.find(t => t.id === toolId);
      if (!tool) throw new Error("Tool not found");
      const res = await fetch("/api/spotify/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: toolId,
          params: { ...inputs, artistId: artistId || user?.id, artistName, genre },
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      return res.json();
    },
    onSuccess: (data) => setResult(data),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const tool = TOOLS.find(t => t.id === activeTool);

  return (
    <div className="space-y-4">
      {/* Tool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map((t) => (
          <motion.button key={t.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => { setActiveTool(t.id); setResult(null); }}
            className={`p-4 rounded-xl border text-left transition ${activeTool === t.id ? "border-green-500 bg-green-500/10 ring-1 ring-green-500/30" : "border-border hover:border-green-500/40"}`}>
            <div className="flex items-center gap-2 mb-2">
              <t.icon className={`w-5 h-5 ${t.color}`} />
              <span className="font-semibold text-sm">{t.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t.desc}</p>
          </motion.button>
        ))}
      </div>

      {/* Active Tool Panel */}
      <AnimatePresence mode="wait">
        {tool && (
          <motion.div key={tool.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <tool.icon className={`w-5 h-5 ${tool.color}`} />
                <h3 className="font-semibold">{tool.label}</h3>
                <Badge variant="secondary" className="text-xs ml-auto"><Sparkles className="w-3 h-3 mr-1" />AI Powered</Badge>
              </div>

              {artistName && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                  <SiSpotify className="w-4 h-4 text-green-500" />
                  <span className="text-xs">{artistName}</span>
                  {genre && <Badge variant="outline" className="text-[10px]">{genre}</Badge>}
                </div>
              )}

              <div className="space-y-3 mb-4">
                {tool.fields.map((f) => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                    {f.key === "description" ? (
                      <Textarea placeholder={f.placeholder} value={inputs[f.key] || ""} onChange={(e) => setInputs(p => ({ ...p, [f.key]: e.target.value }))} rows={3} />
                    ) : (
                      <Input type={f.type || "text"} placeholder={f.placeholder} value={inputs[f.key] || ""}
                        onChange={(e) => setInputs(p => ({ ...p, [f.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={() => exec.mutate(tool.id)} disabled={exec.isPending}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                {exec.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <>Generate with AI</>}
              </Button>

              {/* Results */}
              {result && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-4 rounded-lg bg-muted/50 border relative">
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2"
                    onClick={() => { navigator.clipboard.writeText(typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <pre className="text-xs whitespace-pre-wrap max-h-80 overflow-y-auto pr-8">
                    {typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2)}
                  </pre>
                </motion.div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!activeTool && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p className="text-sm">Select a tool above to get started</p>
        </div>
      )}
    </div>
  );
}
