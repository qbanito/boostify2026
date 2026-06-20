import React, { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { SiSpotify } from "react-icons/si";
import { Search, Mail, Send, Sparkles, Copy, Check, Loader2, Users, ChevronDown, ChevronUp, ListMusic, Star, ExternalLink } from "lucide-react";

interface Props { artistId?: number; artistName?: string; genre?: string; }

export function SpotifyPitchTab({ artistId, artistName, genre }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchGenre, setSearchGenre] = useState(genre || "");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCurator, setSelectedCurator] = useState<any>(null);
  const [pitchTrack, setPitchTrack] = useState("");
  const [pitchMessage, setPitchMessage] = useState("");
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPitch, setShowPitch] = useState(false);

  // Search curators
  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/spotify/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "find-curators", params: { genre: searchGenre, artistId: artistId || user?.id } }),
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    onSuccess: (data) => {
      const curators = data.result?.curators || data.result || [];
      setSearchResults(Array.isArray(curators) ? curators : []);
    },
  });

  // Generate pitch
  const pitchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/spotify/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "generate-pitch",
          params: {
            artistId: artistId || user?.id,
            artistName,
            genre,
            trackName: pitchTrack,
            curatorName: selectedCurator?.name || "",
            playlistName: selectedCurator?.playlist || "",
            additionalContext: pitchMessage,
          },
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedPitch(typeof data.result === "string" ? data.result : data.result?.pitch || JSON.stringify(data.result));
    },
  });

  return (
    <div className="space-y-4">
      {/* Artist Context */}
      {artistName && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/10">
          <SiSpotify className="w-4 h-4 text-green-500" />
          <span className="text-xs font-medium">{artistName}</span>
          {genre && <Badge variant="outline" className="text-[10px]">{genre}</Badge>}
          <Badge variant="secondary" className="text-[10px] ml-auto">Pitch Mode</Badge>
        </div>
      )}

      {/* Curator Search */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-green-400" />
          Find Playlist Curators
        </h3>
        <div className="flex gap-2">
          <Input placeholder="Genre (e.g. indie pop, lo-fi hip hop)" value={searchGenre} onChange={(e) => setSearchGenre(e.target.value)} className="flex-1" />
          <Button onClick={() => searchMutation.mutate()} disabled={searchMutation.isPending || !searchGenre} size="sm"
            className="bg-green-600 text-white">
            {searchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </div>

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map((curator: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => { setSelectedCurator(curator); setShowPitch(true); }}
                className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-3 ${
                  selectedCurator === curator ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/40"
                }`}>
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <ListMusic className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{curator.name || curator.playlist || `Curator ${i + 1}`}</p>
                  <p className="text-xs text-muted-foreground truncate">{curator.playlist || curator.genre || searchGenre}</p>
                </div>
                <div className="text-right shrink-0">
                  {curator.followers && <p className="text-xs font-medium">{curator.followers} followers</p>}
                  <div className="flex items-center gap-1">{[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-3 h-3 ${s <= (curator.matchScore || 3) ? "text-yellow-400 fill-yellow-400" : "text-muted"}`} />
                  ))}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Pitch Generator */}
      <Card className="p-4">
        <button onClick={() => setShowPitch(!showPitch)} className="flex items-center justify-between w-full text-left">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-green-400" />
            <span className="font-semibold text-sm">AI Pitch Generator</span>
            <Badge variant="secondary" className="text-xs"><Sparkles className="w-3 h-3 mr-1" />AI</Badge>
          </div>
          {showPitch ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {showPitch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-4 space-y-3 overflow-hidden">
              {selectedCurator && (
                <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10 flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-green-400" />
                  <span className="text-xs">Pitching to: <strong>{selectedCurator.name || selectedCurator.playlist}</strong></span>
                </div>
              )}
              <Input placeholder="Track name you're pitching" value={pitchTrack} onChange={(e) => setPitchTrack(e.target.value)} />
              <Textarea placeholder="Additional context (optional) — e.g. recent achievements, similar artists..." value={pitchMessage} onChange={(e) => setPitchMessage(e.target.value)} rows={3} />
              <Button onClick={() => pitchMutation.mutate()} disabled={pitchMutation.isPending || !pitchTrack}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                {pitchMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating Pitch...</> : <>Generate AI Pitch</>}
              </Button>

              {generatedPitch && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-lg bg-muted/50 border relative">
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2"
                    onClick={() => { navigator.clipboard.writeText(generatedPitch); setCopied(true); setTimeout(() => setCopied(false), 2000); toast({ title: "Copied!" }); }}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <pre className="text-xs whitespace-pre-wrap pr-8 max-h-60 overflow-y-auto">{generatedPitch}</pre>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
