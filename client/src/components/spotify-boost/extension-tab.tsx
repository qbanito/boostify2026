import React, { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useAuth } from "../../hooks/use-auth";
import { useSpotifyConnection } from "../../hooks/use-spotify-connection";
import { useToast } from "../../hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { SiSpotify } from "react-icons/si";
import { Plug, RefreshCw, Copy, Check, Download, ExternalLink, ChevronDown, ChevronUp, Music2, Users, TrendingUp, Globe, Headphones, Disc } from "lucide-react";

export function SpotifyExtensionTab() {
  const { user } = useAuth();
  const { connection, latestSnapshot, snapshots, isConnected, isLoading, pendingActions, formatNumber, refresh } = useSpotifyConnection();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [showExtract, setShowExtract] = useState(false);
  const [extractType, setExtractType] = useState("playlist_followers");
  const [extractQuery, setExtractQuery] = useState("");

  const genToken = useMutation({
    mutationFn: async () => {
      if (!user?.id || user.id === 0) {
        throw new Error("You must be signed in first. Please refresh the page.");
      }
      const res = await fetch("/api/spotify-ext/generate-connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      const tk = data.token || data.connectToken;
      if (!tk) {
        toast({ title: "Error", description: "No token returned from server", variant: "destructive" });
        return;
      }
      setToken(tk);
      setShowToken(true);
      toast({ title: "Token Generated", description: "Paste it in the Spotify extension popup." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to generate token", variant: "destructive" });
    },
  });

  const stats = [
    { label: "Monthly Listeners", value: formatNumber(connection?.monthlyListeners || latestSnapshot?.monthlyListeners || 0), icon: Headphones, color: "text-green-400" },
    { label: "Followers", value: formatNumber(connection?.followers || latestSnapshot?.followers || 0), icon: Users, color: "text-blue-400" },
    { label: "Total Streams", value: formatNumber(connection?.totalStreams || latestSnapshot?.totalStreams || 0), icon: TrendingUp, color: "text-purple-400" },
    { label: "Playlists", value: formatNumber(connection?.playlistCount || latestSnapshot?.playlistCount || 0), icon: Disc, color: "text-pink-400" },
  ];

  const extractTypes = [
    { id: "playlist_followers", label: "Playlist Followers", icon: "📋", desc: "Extract users following a playlist" },
    { id: "artist_listeners", label: "Artist Listeners", icon: "🎵", desc: "Extract listeners of an artist" },
    { id: "track_savers", label: "Track Savers", icon: "💾", desc: "Extract users who saved a track" },
    { id: "playlist_curators", label: "Playlist Curators", icon: "🎧", desc: "Find curators by genre" },
  ];

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Spotify Open Requirement */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <SiSpotify className="w-5 h-5 text-green-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Keep <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">Spotify</a> open in your browser for the extension to work.</p>
        </div>
        <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition">
          Open Spotify
        </a>
      </div>

      {/* Connection Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isConnected ? "bg-green-500/20" : "bg-muted"}`}>
              {isConnected ? <SiSpotify className="w-5 h-5 text-green-500" /> : <Plug className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-semibold text-sm">{isConnected ? "Extension Connected" : "Connect Extension"}</p>
              {isConnected && connection?.spotifyUsername && (
                <p className="text-xs text-muted-foreground">@{connection.spotifyUsername} · Last sync: {connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : "Never"}</p>
              )}
            </div>
          </div>
          {isConnected && <Button variant="ghost" size="sm" onClick={refresh}><RefreshCw className="w-4 h-4" /></Button>}
        </div>

        {/* Stats Grid */}
        {isConnected && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {stats.map((s) => (
              <div key={s.label} className="p-3 rounded-lg bg-muted/50 text-center">
                <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Token Generation */}
        <Card className="p-4 border-dashed">
          <h4 className="text-sm font-semibold mb-2">{isConnected ? "Reconnect / New Token" : "Generate Connection Token"}</h4>
          <ol className="text-xs text-muted-foreground space-y-1 mb-3">
            <li>1. Install the Boostify Spotify extension in Chrome</li>
            <li>2. Open Spotify in your browser</li>
            <li>3. Generate a token below and paste it in the extension popup</li>
          </ol>
          <Button size="sm" onClick={() => genToken.mutate()} disabled={genToken.isPending}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white">
            {genToken.isPending ? "Generating..." : "Generate Connection Token"}
          </Button>
          <AnimatePresence>
            {showToken && token && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Input value={token} readOnly className="text-xs font-mono" />
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </Card>

      {/* Data Extraction */}
      {isConnected && (
        <Card className="p-4">
          <button onClick={() => setShowExtract(!showExtract)} className="flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-green-400" />
              <span className="font-semibold text-sm">Data Extraction Tool</span>
              <Badge variant="secondary" className="text-xs">PRO</Badge>
            </div>
            {showExtract ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showExtract && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-4 space-y-3 overflow-hidden">
                <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                  <SiSpotify className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-muted-foreground">Spotify must be open in another tab for extraction.</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {extractTypes.map((et) => (
                    <button key={et.id} onClick={() => setExtractType(et.id)}
                      className={`p-3 rounded-lg border text-left transition ${extractType === et.id ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/50"}`}>
                      <span className="text-lg">{et.icon}</span>
                      <p className="text-xs font-semibold mt-1">{et.label}</p>
                      <p className="text-[10px] text-muted-foreground">{et.desc}</p>
                    </button>
                  ))}
                </div>
                <Input placeholder="Playlist URL, Artist name, or Genre..." value={extractQuery} onChange={(e) => setExtractQuery(e.target.value)} />
                <Button size="sm" className="w-full bg-green-600 text-white" disabled={!extractQuery}>
                  Extract Data
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}
    </div>
  );
}
