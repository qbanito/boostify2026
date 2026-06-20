import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";
import { motion } from "framer-motion";
import {
  BarChart3, Music2, Loader2, ListMusic, Globe, TrendingUp,
  Search, Crown, Disc3, Hash
} from "lucide-react";

interface ChartInfo {
  slug: string;
  name: string;
  platform: string;
  country: string;
}

interface ChartTrack {
  position: number;
  name: string;
  artist: string;
  popularity: number;
  albumImage?: string;
}

interface RawChartEntry {
  position: number;
  trackName?: string;
  artistName?: string;
  spotifyId?: string;
  streams?: number;
  change?: number;
  imageUrl?: string;
}

export function ChartsIntelligenceTab() {
  const { toast } = useToast();
  const [charts, setCharts] = useState<ChartInfo[]>([]);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [chartTracks, setChartTracks] = useState<ChartTrack[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [searchingPlaylists, setSearchingPlaylists] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<"all" | "spotify" | "apple">("all");

  useEffect(() => {
    loadAvailableCharts();
  }, []);

  const loadAvailableCharts = async () => {
    setLoadingCharts(true);
    try {
      const res = await fetch("/api/music-intel/charts/available");
      const data = await res.json();
      if (data.success) setCharts(data.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoadingCharts(false);
  };

  const loadChart = async (slug: string) => {
    setSelectedChart(slug);
    setLoadingTracks(true);
    try {
      const res = await fetch(`/api/music-intel/charts/ranking/${slug}`);
      const data = await res.json();
      if (data.success) {
        // Backend returns `data.data` as a direct array of ChartEntry
        // (shape: { position, trackName, artistName, imageUrl, ... }).
        // Older shape may have been { tracks: [...] } — support both defensively.
        const raw: RawChartEntry[] = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.data?.tracks)
            ? data.data.tracks
            : [];
        const mapped: ChartTrack[] = raw.map((t, i) => ({
          position: t.position ?? i + 1,
          name: t.trackName || 'Unknown',
          artist: t.artistName || 'Unknown',
          // Apple/Spotify entries don't include a true popularity score in this
          // endpoint — approximate from position so the progress bar renders.
          popularity: Math.max(0, 100 - (t.position ?? i + 1)),
          albumImage: t.imageUrl,
        }));
        setChartTracks(mapped);
      }
    } catch (e: any) {
      toast({ title: "Error loading chart", description: e.message, variant: "destructive" });
    }
    setLoadingTracks(false);
  };

  const searchPlaylists = async () => {
    if (!playlistSearch.trim()) return;
    setSearchingPlaylists(true);
    try {
      const res = await fetch(`/api/music-intel/playlists/search?genre=${encodeURIComponent(playlistSearch)}`);
      const data = await res.json();
      if (data.success) setPlaylists(data.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSearchingPlaylists(false);
  };

  const countryFlag = (code: string) => {
    const flags: Record<string, string> = {
      Global: "🌍", US: "🇺🇸", MX: "🇲🇽", ES: "🇪🇸", GB: "🇬🇧",
      BR: "🇧🇷", DE: "🇩🇪", FR: "🇫🇷", CO: "🇨🇴", AR: "🇦🇷",
    };
    return flags[code] || "🎵";
  };

  return (
    <div className="space-y-6">
      {/* Charts Grid */}
      <Card className="bg-card/30 border-orange-500/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="w-4 h-4 text-orange-400" />
            Global Charts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Platform Filter */}
          <div className="flex items-center gap-2 mb-3">
            {([
              { id: "all", label: "All" },
              { id: "spotify", label: "Spotify" },
              { id: "apple", label: "Apple Music" },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPlatformFilter(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  platformFilter === opt.id
                    ? "border-orange-500 bg-orange-500/10 text-orange-300"
                    : "border-border text-muted-foreground hover:border-orange-500/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {charts.filter(c => platformFilter === "all" || c.platform === platformFilter).length} charts
            </span>
          </div>
          {loadingCharts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {charts
                .filter(c => platformFilter === "all" || c.platform === platformFilter)
                .map((chart) => (
                <button key={chart.slug} onClick={() => loadChart(chart.slug)}
                  className={`relative p-3 rounded-lg border text-center transition-all ${
                    selectedChart === chart.slug
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-border hover:border-orange-500/30 hover:bg-card/80"
                  }`}>
                  <span
                    className={`absolute top-1 right-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                      chart.platform === "apple"
                        ? "bg-pink-500/15 text-pink-300"
                        : "bg-green-500/15 text-green-300"
                    }`}
                  >
                    {chart.platform === "apple" ? "Apple" : "Spotify"}
                  </span>
                  <span className="text-xl block mb-1">{countryFlag(chart.country)}</span>
                  <p className="text-xs font-medium truncate">{chart.name}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart Ranking */}
      {selectedChart && (
        <Card className="bg-card/30 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-400" />
              {charts.find(c => c.slug === selectedChart)?.name || selectedChart}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTracks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
              </div>
            ) : (
              <div className="space-y-1">
                {chartTracks.slice(0, 50).map((track, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition">
                    <span className={`text-sm font-bold w-6 text-right ${i < 3 ? "text-orange-400" : "text-muted-foreground"}`}>
                      {track.position}
                    </span>
                    {track.albumImage ? (
                      <img src={track.albumImage} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-orange-500/10 flex items-center justify-center">
                        <Music2 className="w-4 h-4 text-orange-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{track.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-800 rounded-full h-1.5 hidden sm:block">
                        <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${track.popularity}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-6 text-right">{track.popularity}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Playlist Search */}
      <Card className="bg-card/30 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-green-400" />
            Playlist Discovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input placeholder="Search by genre (e.g., lofi, reggaeton, indie)..."
              value={playlistSearch} onChange={(e) => setPlaylistSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPlaylists()} className="bg-background/50" />
            <Button onClick={searchPlaylists} disabled={searchingPlaylists} className="bg-green-600 hover:bg-green-700">
              {searchingPlaylists ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {playlists.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {playlists.slice(0, 12).map((pl: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-green-500/30 transition bg-background/30">
                  {pl.imageUrl ? (
                    <img src={pl.imageUrl} alt={pl.name} className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-green-500/10 flex items-center justify-center">
                      <ListMusic className="w-6 h-6 text-green-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pl.name}</p>
                    <p className="text-[11px] text-muted-foreground">{pl.owner} · {pl.totalTracks} tracks</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
