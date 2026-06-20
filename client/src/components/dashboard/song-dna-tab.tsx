import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Music2, Loader2, Headphones, BarChart3, Users,
  Target, TrendingUp, MapPin, Sparkles, Library, Save,
  Trash2, ExternalLink, Award, Share2, Flame,
} from "lucide-react";

type Analysis = {
  id: number;
  spotifyTrackId: string;
  title: string;
  artistName: string | null;
  albumName: string | null;
  imageUrl: string | null;
  mood: string | null;
  updatedAt: string;
};

export function SongDNATab({ artistId }: { artistId?: string }) {
  const { toast } = useToast();
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [resolving, setResolving] = useState(false);

  const [songId, setSongId] = useState<string | null>(null);
  const [resolvedArtistSpotifyId, setResolvedArtistSpotifyId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [audioFeatures, setAudioFeatures] = useState<any>(null);
  const [demographics, setDemographics] = useState<any>(null);
  const [marketPotential, setMarketPotential] = useState<any>(null);
  const [hitPotential, setHitPotential] = useState<any>(null);
  const [crossPlatform, setCrossPlatform] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [loadingHit, setLoadingHit] = useState(false);
  const [loadingXP, setLoadingXP] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marketCity, setMarketCity] = useState("Miami");
  const [marketCountry, setMarketCountry] = useState("US");

  const [saved, setSaved] = useState<Analysis[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  // ── Load saved analyses on mount ────────────────────────────────────────
  const loadSaved = async () => {
    try {
      const res = await fetch("/api/song-dna/saved", { credentials: "include" });
      const data = await res.json();
      if (data.success) setSaved(data.analyses || []);
    } catch { /* silent */ }
  };
  useEffect(() => { loadSaved(); }, []);

  const resetAnalysisState = () => {
    setMetadata(null); setPerformance(null); setAudioFeatures(null);
    setDemographics(null); setMarketPotential(null); setHitPotential(null);
    setCrossPlatform(null); setResolvedArtistSpotifyId(null);
  };

  // ── Resolve a song by title/artist via Spotify ─────────────────────────
  const resolveSong = async () => {
    if (!searchTitle.trim()) return;
    setResolving(true);
    resetAnalysisState();
    try {
      const res = await fetch("/api/song-intel/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: searchTitle, artistName: searchArtist || undefined }),
      });
      const data = await res.json();
      if (data.success && data.data?.spotifyId) {
        const id = data.data.spotifyId;
        setSongId(id);
        await loadSongData(id);
      } else {
        toast({ title: "Song not found", description: "Try a different title or artist", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setResolving(false);
  };

  // ── Load core song data (metadata, performance, audio features) ────────
  const loadSongData = async (id: string) => {
    setLoading(true);
    try {
      const [metaRes, perfRes, featRes] = await Promise.all([
        fetch(`/api/song-intel/${id}/metadata`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/song-intel/${id}/performance`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/song-intel/${id}/audio-features`, { credentials: "include" }).then(r => r.json()),
      ]);
      if (metaRes.success) setMetadata(metaRes.data);
      if (perfRes.success) setPerformance(perfRes.data);
      if (featRes.success) setAudioFeatures(featRes.data);

      // Derive an artist Spotify ID from metadata if possible
      const aId = artistId || metaRes.data?.artistId || null;
      if (aId) {
        setResolvedArtistSpotifyId(aId);
        const demoRes = await fetch(`/api/song-intel/demographics/${aId}`, { credentials: "include" }).then(r => r.json());
        if (demoRes.success) setDemographics(demoRes.data);
      }
    } catch (e: any) {
      toast({ title: "Error loading song data", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  // ── Hit Potential ──────────────────────────────────────────────────────
  const loadHitPotential = async () => {
    if (!songId) return;
    setLoadingHit(true);
    try {
      const res = await fetch(`/api/song-intel/${songId}/hit-potential`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setHitPotential(data.data);
      else toast({ title: "Hit analysis unavailable", description: data.error || "", variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoadingHit(false);
  };

  // ── Cross-Platform Matching ────────────────────────────────────────────
  const loadCrossPlatform = async () => {
    if (!metadata) return;
    setLoadingXP(true);
    try {
      const res = await fetch(`/api/song-intel/cross-platform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isrc: metadata.isrc,
          spotifyId: songId,
          title: metadata.title,
          artistName: metadata.artistName,
        }),
      });
      const data = await res.json();
      if (data.success) setCrossPlatform(data.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoadingXP(false);
  };

  // ── Market Potential ───────────────────────────────────────────────────
  const loadMarketPotential = async () => {
    const aId = resolvedArtistSpotifyId || artistId;
    if (!aId) {
      toast({ title: "No artist ID", description: "Market analysis needs a Spotify artist ID", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(
        `/api/song-intel/market-potential/${aId}?city=${encodeURIComponent(marketCity)}&country=${marketCountry}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (data.success) setMarketPotential(data.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // ── Save to user library ───────────────────────────────────────────────
  const saveAnalysis = async () => {
    if (!songId || !metadata) return;
    setSaving(true);
    try {
      const res = await fetch("/api/song-dna/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          spotifyTrackId: songId,
          title: metadata.title,
          artistName: metadata.artistName,
          albumName: metadata.albumName,
          isrc: metadata.isrc,
          imageUrl: metadata.imageUrl,
          previewUrl: metadata.previewUrl,
          durationMs: metadata.durationMs,
          explicit: metadata.explicit,
          mood: metadata.mood,
          genres: metadata.genres || [],
          audioFeatures,
          performance,
          demographics,
          marketPotential,
          hitPotential,
          crossPlatform,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: data.updated ? "Analysis updated" : "Analysis saved", description: metadata.title });
        await loadSaved();
      } else {
        toast({ title: "Save failed", description: data.error || "", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const deleteSaved = async (id: number) => {
    try {
      const res = await fetch(`/api/song-dna/saved/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setSaved(prev => prev.filter(a => a.id !== id));
        toast({ title: "Removed from library" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const openSaved = async (a: Analysis) => {
    try {
      const res = await fetch(`/api/song-dna/saved/${a.id}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        const x = data.analysis;
        setSongId(x.spotifyTrackId);
        setMetadata({
          title: x.title,
          artistName: x.artistName,
          albumName: x.albumName,
          isrc: x.isrc,
          imageUrl: x.imageUrl,
          previewUrl: x.previewUrl,
          durationMs: x.durationMs,
          explicit: x.explicit,
          mood: x.mood,
          genres: x.genres,
        });
        setAudioFeatures(x.audioFeatures);
        setPerformance(x.performance);
        setDemographics(x.demographics);
        setMarketPotential(x.marketPotential);
        setHitPotential(x.hitPotential);
        setCrossPlatform(x.crossPlatform);
        setShowLibrary(false);
      }
    } catch (e: any) {
      toast({ title: "Error loading analysis", description: e.message, variant: "destructive" });
    }
  };

  // ── Small UI helpers ───────────────────────────────────────────────────
  const FeatureBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );

  const gradeColor = (g: string) =>
    g === "S" ? "text-fuchsia-400" :
    g === "A" ? "text-emerald-400" :
    g === "B" ? "text-green-400" :
    g === "C" ? "text-yellow-400" :
    g === "D" ? "text-orange-400" : "text-red-400";

  return (
    <div className="space-y-6">
      {/* ═════ SEARCH + LIBRARY ═════ */}
      <Card className="bg-black/20 border-white/5">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-orange-400" />
            Song DNA Analyzer
          </CardTitle>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowLibrary(v => !v)}
            className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10 text-xs h-8"
          >
            <Library className="w-3.5 h-3.5 mr-1" />
            My Library ({saved.length})
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              placeholder="Song title..."
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resolveSong()}
              className="bg-background/50"
            />
            <Input
              placeholder="Artist (optional)..."
              value={searchArtist}
              onChange={(e) => setSearchArtist(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resolveSong()}
              className="bg-background/50"
            />
            <Button onClick={resolveSong} disabled={resolving} className="bg-orange-600 hover:bg-orange-700">
              {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Analyze</span>
            </Button>
          </div>

          <AnimatePresence>
            {showLibrary && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-white/5">
                  {saved.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No saved analyses yet. Analyze a song and hit Save.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {saved.map(a => (
                        <div
                          key={a.id}
                          className="group flex items-center gap-2 p-2 rounded-lg bg-background/40 border border-white/5 hover:border-orange-500/30 transition-all"
                        >
                          <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => openSaved(a)}>
                            {a.imageUrl ? (
                              <img src={a.imageUrl} alt={a.title} className="w-9 h-9 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                <Music2 className="w-4 h-4 text-orange-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{a.title}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{a.artistName || ""}</p>
                            </div>
                          </button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); deleteSaved(a.id); }}
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          <span className="text-sm text-muted-foreground">Analyzing song DNA...</span>
        </div>
      )}

      <AnimatePresence>
        {songId && !loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* ── SONG HEADER + SAVE ── */}
            {metadata && (
              <Card className="bg-gradient-to-br from-orange-500/5 to-amber-500/5 border-orange-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    {metadata.imageUrl ? (
                      <img src={metadata.imageUrl} alt={metadata.title} className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Music2 className="w-8 h-8 text-orange-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold truncate">{metadata.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {metadata.artistName}{metadata.albumName ? ` · ${metadata.albumName}` : ""}
                      </p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {metadata.mood && <Badge variant="outline" className="text-[10px]">{metadata.mood}</Badge>}
                        {audioFeatures?.keyName && <Badge variant="outline" className="text-[10px]">{audioFeatures.keyName}</Badge>}
                        {audioFeatures?.tempo && <Badge variant="outline" className="text-[10px]">{Math.round(audioFeatures.tempo)} BPM</Badge>}
                        {metadata.isrc && <Badge variant="outline" className="text-[10px]">ISRC {metadata.isrc}</Badge>}
                        {metadata.explicit && <Badge variant="outline" className="text-[10px] text-red-300 border-red-500/30">Explicit</Badge>}
                      </div>
                    </div>
                    <Button
                      onClick={saveAnalysis} disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                      size="sm"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span className="ml-1">Save</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── AUDIO FEATURES ── */}
            {audioFeatures && (
              <Card className="bg-black/20 border-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-purple-400" />
                    Audio DNA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FeatureBar label="Danceability" value={audioFeatures.danceability || 0} color="bg-green-500" />
                    <FeatureBar label="Energy" value={audioFeatures.energy || 0} color="bg-red-500" />
                    <FeatureBar label="Valence (Mood)" value={audioFeatures.valence || 0} color="bg-yellow-500" />
                    <FeatureBar label="Acousticness" value={audioFeatures.acousticness || 0} color="bg-blue-500" />
                    <FeatureBar label="Instrumentalness" value={audioFeatures.instrumentalness || 0} color="bg-indigo-500" />
                    <FeatureBar label="Speechiness" value={audioFeatures.speechiness || 0} color="bg-pink-500" />
                    <FeatureBar label="Liveness" value={audioFeatures.liveness || 0} color="bg-teal-500" />
                    <FeatureBar label="Loudness" value={Math.min(1, ((audioFeatures.loudness || -60) + 60) / 60) || 0} color="bg-orange-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold">{audioFeatures.keyName || "—"}</p>
                      <p className="text-xs text-muted-foreground">Key</p>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold">{Math.round(audioFeatures.tempo || 0)}</p>
                      <p className="text-xs text-muted-foreground">BPM</p>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold">{audioFeatures.timeSignature || 4}/4</p>
                      <p className="text-xs text-muted-foreground">Time Sig</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── PERFORMANCE + DEMOGRAPHICS ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {performance && (
                <Card className="bg-black/20 border-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-green-400" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center p-4 bg-background/50 rounded-lg">
                      <p className="text-3xl font-bold text-green-400">{performance.spotifyPopularity ?? performance.popularity ?? 0}/100</p>
                      <p className="text-xs text-muted-foreground mt-1">Spotify Popularity</p>
                    </div>
                    {performance.estimatedStreams != null && (
                      <div className="text-center p-3 bg-background/50 rounded-lg">
                        <p className="text-xl font-bold">{Number(performance.estimatedStreams).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Estimated Streams</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {demographics && (
                <Card className="bg-black/20 border-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      Audience Demographics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {demographics.ageDistribution && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Age Distribution</p>
                        <div className="space-y-1">
                          {Object.entries(demographics.ageDistribution).map(([age, pct]: [string, any]) => (
                            <div key={age} className="flex items-center gap-2">
                              <span className="text-xs w-12 text-muted-foreground">{age}</span>
                              <div className="flex-1 bg-gray-800 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs w-8 text-right">{pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {demographics.topCountries && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Top Markets</p>
                        <div className="flex flex-wrap gap-1.5">
                          {demographics.topCountries.slice(0, 5).map((c: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              <MapPin className="w-2.5 h-2.5 mr-1" />{c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── HIT POTENTIAL ── */}
            <Card className="bg-black/20 border-white/5">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="w-4 h-4 text-fuchsia-400" />
                  Hit Potential
                </CardTitle>
                <Button
                  onClick={loadHitPotential}
                  disabled={loadingHit}
                  size="sm"
                  className="bg-fuchsia-600 hover:bg-fuchsia-700 text-xs h-8"
                >
                  {loadingHit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span className="ml-1">{hitPotential ? "Re-analyze" : "Analyze"}</span>
                </Button>
              </CardHeader>
              <CardContent>
                {!hitPotential ? (
                  <p className="text-xs text-muted-foreground">Click Analyze to compute a multi-factor hit score.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-orange-500/10 border border-fuchsia-500/30 flex flex-col items-center justify-center">
                        <p className={`text-4xl font-black ${gradeColor(hitPotential.grade || "C")}`}>{hitPotential.grade || "–"}</p>
                        <p className="text-[10px] text-muted-foreground">Grade</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-3xl font-bold">{hitPotential.score ?? 0}<span className="text-lg text-muted-foreground">/100</span></p>
                        <p className="text-xs text-muted-foreground mt-1">Weighted hit score</p>
                      </div>
                      {hitPotential.tier && (
                        <Badge className="bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30">
                          <Award className="w-3 h-3 mr-1" /> {hitPotential.tier}
                        </Badge>
                      )}
                    </div>

                    {hitPotential.breakdown && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(hitPotential.breakdown).map(([k, v]: [string, any]) => (
                          <div key={k} className="p-2 rounded-lg bg-background/40 border border-white/5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] capitalize text-muted-foreground">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="text-[11px] font-bold">{typeof v === 'number' ? v : (v?.score ?? '—')}</span>
                            </div>
                            {typeof v === 'number' && (
                              <div className="w-full bg-gray-800 rounded-full h-1.5">
                                <div className="bg-fuchsia-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, v)}%` }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {Array.isArray(hitPotential.recommendations) && hitPotential.recommendations.length > 0 && (
                      <div className="p-3 rounded-lg bg-background/40 border border-fuchsia-500/15">
                        <p className="text-xs font-semibold mb-2 text-fuchsia-300">Recommendations</p>
                        <ul className="space-y-1">
                          {hitPotential.recommendations.map((r: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground flex gap-2">
                              <span className="text-fuchsia-400">•</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── CROSS-PLATFORM MATCH ── */}
            <Card className="bg-black/20 border-white/5">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-cyan-400" />
                  Cross-Platform Presence
                </CardTitle>
                <Button
                  onClick={loadCrossPlatform}
                  disabled={loadingXP || !metadata}
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-700 text-xs h-8"
                >
                  {loadingXP ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span className="ml-1">{crossPlatform ? "Refresh" : "Match"}</span>
                </Button>
              </CardHeader>
              <CardContent>
                {!crossPlatform ? (
                  <p className="text-xs text-muted-foreground">Find this song across Spotify, Apple Music, Deezer, MusicBrainz, and YouTube.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Object.entries(crossPlatform).map(([platform, info]: [string, any]) => {
                      if (!info) return null;
                      const url = info.url || info.link || info.href;
                      const id = info.id || info.mbid || info.trackId || info.videoId;
                      const title = info.title || info.name;
                      return (
                        <div key={platform} className="p-3 rounded-lg bg-background/40 border border-white/5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold capitalize text-cyan-300">{platform}</span>
                            {url && (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {title && <p className="text-[11px] truncate">{title}</p>}
                          {id && <p className="text-[10px] text-muted-foreground truncate">{String(id)}</p>}
                          {!title && !id && <p className="text-[10px] text-muted-foreground">No match</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── MARKET POTENTIAL ── */}
            <Card className="bg-black/20 border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  Market Potential Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <Input placeholder="City..." value={marketCity} onChange={(e) => setMarketCity(e.target.value)} className="bg-background/50 max-w-[200px]" />
                  <Input placeholder="Country code..." value={marketCountry} onChange={(e) => setMarketCountry(e.target.value)} className="bg-background/50 max-w-[100px]" />
                  <Button onClick={loadMarketPotential} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <TrendingUp className="w-4 h-4 mr-1" /> Analyze
                  </Button>
                </div>
                {marketPotential && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold text-emerald-400">{marketPotential.totalAddressableMarket?.toLocaleString?.() ?? marketPotential.totalAddressableMarket ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">TAM</p>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold">{typeof marketPotential.currentPenetration === 'number' ? marketPotential.currentPenetration.toFixed(1) + '%' : '—'}</p>
                      <p className="text-xs text-muted-foreground">Penetration</p>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold text-yellow-400">{marketPotential.growthGap?.toLocaleString?.() ?? marketPotential.growthGap ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Growth Gap</p>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold capitalize">{marketPotential.recommendation ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Recommendation</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
