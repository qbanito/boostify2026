import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, Calendar, Users, Music2, Loader2,
  Globe, Star, Building2, Ticket, TrendingUp, Mic2
} from "lucide-react";

export function TourIntelligenceTab() {
  const { toast } = useToast();
  const [festivals, setFestivals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [genreFilter, setGenreFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");

  // Opening Acts
  const [artistIdInput, setArtistIdInput] = useState("");
  const [openingActs, setOpeningActs] = useState<any[]>([]);
  const [strategicActs, setStrategicActs] = useState<any[]>([]);
  const [loadingActs, setLoadingActs] = useState(false);

  useEffect(() => {
    loadUpcomingFestivals();
  }, []);

  const loadUpcomingFestivals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tour-intel/festivals/upcoming?limit=20");
      const data = await res.json();
      if (data.success) setFestivals(data.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const searchFestivals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (genreFilter) params.set("genre", genreFilter);
      if (countryFilter) params.set("country", countryFilter);
      if (nameFilter) params.set("name", nameFilter);
      const res = await fetch(`/api/tour-intel/festivals/search?${params}`);
      const data = await res.json();
      if (data.success) setFestivals(data.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const loadOpeningActs = async () => {
    if (!artistIdInput.trim()) {
      toast({ title: "Enter a Spotify Artist ID", variant: "destructive" });
      return;
    }
    setLoadingActs(true);
    try {
      const [localRes, stratRes] = await Promise.all([
        fetch(`/api/tour-intel/opening-acts/local/${artistIdInput}?country=US`).then(r => r.json()),
        fetch(`/api/tour-intel/opening-acts/strategic/${artistIdInput}`).then(r => r.json()),
      ]);
      if (localRes.success) setOpeningActs(localRes.data || []);
      if (stratRes.success) setStrategicActs(stratRes.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoadingActs(false);
  };

  const tierColor = (tier: string) => {
    if (tier === "major") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (tier === "mid-level") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Festival Search */}
      <Card className="bg-card/50 border-purple-500/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="w-4 h-4 text-purple-400" />
            Festival Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-4">
            <Input placeholder="Genre (rock, electronic...)" value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)} className="bg-background/50" />
            <Input placeholder="Country code (US, MX...)" value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)} className="bg-background/50" />
            <Input placeholder="Festival name..." value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchFestivals()} className="bg-background/50" />
            <Button onClick={searchFestivals} className="bg-purple-600 hover:bg-purple-700">
              <Search className="w-4 h-4 mr-1" /> Search
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadUpcomingFestivals} className="text-xs">
              <Calendar className="w-3 h-3 mr-1" /> Show Upcoming
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Festivals Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      ) : festivals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {festivals.map((fest) => (
            <motion.div key={fest.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-card/50 border-border hover:border-purple-500/30 transition-all h-full">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm">{fest.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {fest.location}, {fest.country}
                      </p>
                    </div>
                    <Badge className={`text-[10px] ${tierColor(fest.tier)}`}>{fest.tier}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {fest.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {fest.estimatedAttendance?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {fest.genres?.map((g: string) => (
                      <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>
                    ))}
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${
                    fest.status === "confirmed" ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"
                  }`}>
                    {fest.status}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">No festivals found. Try different filters.</div>
      )}

      {/* Opening Acts Discovery */}
      <Card className="bg-card/50 border-orange-500/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-orange-400" />
            Opening Act Discovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input placeholder="Spotify Artist ID (e.g., 4q3ewBCX7sLwd24euuV69X)..."
              value={artistIdInput} onChange={(e) => setArtistIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadOpeningActs()} className="bg-background/50" />
            <Button onClick={loadOpeningActs} disabled={loadingActs} className="bg-orange-600 hover:bg-orange-700">
              {loadingActs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Find</span>
            </Button>
          </div>

          {loadingActs && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
            </div>
          )}

          <AnimatePresence>
            {(openingActs.length > 0 || strategicActs.length > 0) && !loadingActs && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* Local Opening Acts */}
                {openingActs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" /> Local Opening Acts
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {openingActs.slice(0, 6).map((act: any) => (
                        <div key={act.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-blue-500/30 transition bg-background/30">
                          {act.imageUrl ? (
                            <img src={act.imageUrl} alt={act.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <Music2 className="w-5 h-5 text-blue-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{act.name}</p>
                            <p className="text-[11px] text-muted-foreground">{act.followers?.toLocaleString()} followers · {act.careerStage}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">{act.matchScore}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strategic Opening Acts */}
                {strategicActs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-green-400" /> Strategic (High-Growth) Acts
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {strategicActs.slice(0, 6).map((act: any) => (
                        <div key={act.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-green-500/30 transition bg-background/30">
                          {act.imageUrl ? (
                            <img src={act.imageUrl} alt={act.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                              <Music2 className="w-5 h-5 text-green-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{act.name}</p>
                            <p className="text-[11px] text-muted-foreground">{act.followers?.toLocaleString()} followers · {act.careerStage}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">{act.growthPotential}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
