import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, TrendingUp, Globe, Users, BarChart3, MapPin,
  Loader2, ArrowUp, ArrowDown, Minus, Trophy, Target,
  Sparkles, Music2
} from "lucide-react";

interface ArtistResult {
  id: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  followers: number;
  popularity: number;
  matchScore: number;
}

export function SpotifyIntelligenceTab({ artistId }: { artistId?: string }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ArtistResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(artistId || null);
  const [stats, setStats] = useState<any>(null);
  const [geo, setGeo] = useState<any>(null);
  const [growth, setGrowth] = useState<any>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [career, setCareer] = useState<any>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

  const searchArtist = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/artist-intel/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) setSearchResults(data.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSearching(false);
  };

  const selectArtist = async (id: string) => {
    setSelectedId(id);
    setLoadingSection("all");
    try {
      const [statsRes, geoRes, growthRes, similarRes, compRes, careerRes] = await Promise.all([
        fetch(`/api/artist-intel/${id}/stats`).then(r => r.json()),
        fetch(`/api/artist-intel/${id}/geographic`).then(r => r.json()),
        fetch(`/api/artist-intel/${id}/growth`).then(r => r.json()),
        fetch(`/api/artist-intel/${id}/similar`).then(r => r.json()),
        fetch(`/api/artist-intel/${id}/competitors`).then(r => r.json()),
        fetch(`/api/artist-intel/${id}/career-stage`).then(r => r.json()),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (geoRes.success) setGeo(geoRes.data);
      if (growthRes.success) setGrowth(growthRes.data);
      if (similarRes.success) setSimilar(similarRes.data || []);
      if (compRes.success) setCompetitors(compRes.data || []);
      if (careerRes.success) setCareer(careerRes.data);
    } catch (e: any) {
      toast({ title: "Error loading intelligence", description: e.message, variant: "destructive" });
    }
    setLoadingSection(null);
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "accelerating") return <ArrowUp className="w-4 h-4 text-green-400" />;
    if (trend === "decelerating" || trend === "declining") return <ArrowDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-yellow-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card className="bg-card/50 border-green-500/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-green-400" />
            Artist Intelligence Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search any artist (e.g., Bad Bunny, Taylor Swift)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchArtist()}
              className="bg-background/50"
            />
            <Button onClick={searchArtist} disabled={searching} className="bg-green-600 hover:bg-green-700">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {searchResults.slice(0, 6).map((a) => (
                <button
                  key={a.id}
                  onClick={() => selectArtist(a.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    selectedId === a.id ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/30 hover:bg-card/80"
                  }`}
                >
                  {a.imageUrl ? (
                    <img src={a.imageUrl} alt={a.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Music2 className="w-5 h-5 text-green-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.followers?.toLocaleString()} followers</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{a.matchScore}%</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {loadingSection === "all" && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-green-400" />
          <span className="text-sm text-muted-foreground">Loading intelligence data...</span>
        </div>
      )}

      <AnimatePresence>
        {selectedId && !loadingSection && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Career Stage + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {career && (
                <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
                  <CardContent className="pt-6 text-center">
                    <Trophy className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">Career Stage</p>
                    <p className="text-xl font-bold text-green-400">{career.stage}</p>
                    <p className="text-xs text-muted-foreground mt-2">Popularity: {career.popularity}/100</p>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${career.popularity}%` }} />
                    </div>
                  </CardContent>
                </Card>
              )}
              {stats?.spotify && (
                <Card className="bg-card/50 border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-green-400" />
                      <p className="text-xs font-medium text-muted-foreground">Spotify Stats</p>
                    </div>
                    <p className="text-2xl font-bold">{stats.spotify.followers?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                    <p className="text-lg font-semibold mt-2">{stats.spotify.popularity}/100</p>
                    <p className="text-xs text-muted-foreground">Popularity Score</p>
                  </CardContent>
                </Card>
              )}
              {stats?.youtube && (
                <Card className="bg-card/50 border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-red-400" />
                      <p className="text-xs font-medium text-muted-foreground">YouTube Stats</p>
                    </div>
                    <p className="text-2xl font-bold">{stats.youtube.subscribers?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Subscribers</p>
                    <p className="text-lg font-semibold mt-2">{stats.youtube.totalViews?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Views</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Growth Analysis */}
            {growth && (
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Growth Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <TrendIcon trend={growth.trend} />
                      <p className="text-sm font-medium mt-1 capitalize">{growth.trend}</p>
                      <p className="text-xs text-muted-foreground">Trend</p>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold">{growth.estimatedMonthlyGrowth?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Monthly Growth</p>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold">{growth.growthRate?.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Growth Rate</p>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <p className="text-lg font-bold">{growth.period}d</p>
                      <p className="text-xs text-muted-foreground">Period</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Geographic Data */}
            {geo && (
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    Geographic Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground mb-3 font-medium">Top Countries</p>
                      <div className="space-y-2">
                        {geo.topCountries?.slice(0, 5).map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3 text-blue-400" />
                              <span className="text-sm">{c.country}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-800 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${c.percentage}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{c.percentage}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-3 font-medium">Top Cities</p>
                      <div className="space-y-2">
                        {geo.topCities?.slice(0, 5).map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm">{c.city}</span>
                            <span className="text-xs text-muted-foreground">{c.estimatedListeners?.toLocaleString()} listeners</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Similar Artists + Competitors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {similar.length > 0 && (
                <Card className="bg-card/50 border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      Similar Artists
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {similar.slice(0, 6).map((a: any) => (
                        <button key={a.id} onClick={() => selectArtist(a.id)}
                          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-background/50 transition text-left">
                          {a.imageUrl ? (
                            <img src={a.imageUrl} alt={a.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-500/20" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{a.name}</p>
                            <p className="text-[11px] text-muted-foreground">{a.genres?.slice(0, 2).join(", ")}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{a.overlapScore}%</Badge>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {competitors.length > 0 && (
                <Card className="bg-card/50 border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4 text-orange-400" />
                      Genre Competitors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {competitors.slice(0, 6).map((a: any) => (
                        <button key={a.id} onClick={() => selectArtist(a.id)}
                          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-background/50 transition text-left">
                          {a.imageUrl ? (
                            <img src={a.imageUrl} alt={a.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-orange-500/20" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{a.name}</p>
                            <p className="text-[11px] text-muted-foreground">{a.followers?.toLocaleString()} followers · {a.marketPosition}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{a.popularity}/100</Badge>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
