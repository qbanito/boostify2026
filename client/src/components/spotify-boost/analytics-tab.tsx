import React, { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAuth } from "../../hooks/use-auth";
import { useSpotifyConnection } from "../../hooks/use-spotify-connection";
import { useToast } from "../../hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { SiSpotify } from "react-icons/si";
import { BarChart2, TrendingUp, Globe, Headphones, Sparkles, Loader2, Copy, Check, Users, Disc, Music2 } from "lucide-react";

interface Props { artistId?: number; artistName?: string; genre?: string; }

const REPORTS = [
  { id: "full-audit", label: "Full Account Audit", icon: BarChart2, desc: "Complete analysis with score and recommendations", color: "text-green-400" },
  { id: "growth-forecast", label: "Growth Forecast", icon: TrendingUp, desc: "30/60/90 day predictions based on current trajectory", color: "text-blue-400" },
  { id: "competitor-analysis", label: "Competitor Analysis", icon: Users, desc: "Compare with similar artists in your genre", color: "text-purple-400" },
  { id: "playlist-impact", label: "Playlist Impact", icon: Disc, desc: "Which playlists drive the most streams", color: "text-pink-400" },
];

export function SpotifyAnalyticsTab({ artistId, artistName, genre }: Props) {
  const { user } = useAuth();
  const { connection, latestSnapshot, snapshots, isConnected, formatNumber } = useSpotifyConnection();
  const { toast } = useToast();
  const [result, setResult] = useState<any>(null);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const exec = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch("/api/spotify/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: reportId, params: { artistId: artistId || user?.id, artistName, genre } }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data, reportId) => { setResult(data); setActiveReport(reportId); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const stats = [
    { label: "Monthly Listeners", value: formatNumber(connection?.monthlyListeners || latestSnapshot?.monthlyListeners || 0), icon: Headphones, color: "text-green-400", delta: snapshots.length >= 2 ? (snapshots[0]?.monthlyListeners || 0) - (snapshots[1]?.monthlyListeners || 0) : 0 },
    { label: "Followers", value: formatNumber(connection?.followers || latestSnapshot?.followers || 0), icon: Users, color: "text-blue-400", delta: snapshots.length >= 2 ? (snapshots[0]?.followers || 0) - (snapshots[1]?.followers || 0) : 0 },
    { label: "Total Streams", value: formatNumber(connection?.totalStreams || latestSnapshot?.totalStreams || 0), icon: TrendingUp, color: "text-purple-400", delta: 0 },
    { label: "Playlists", value: formatNumber(connection?.playlistCount || latestSnapshot?.playlistCount || 0), icon: Disc, color: "text-pink-400", delta: 0 },
  ];

  // Simple bar chart from snapshot data
  const chartData = [...snapshots].reverse().slice(-10);

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            {s.delta !== 0 && (
              <p className={`text-xs font-medium ${s.delta > 0 ? "text-green-400" : "text-red-400"}`}>
                {s.delta > 0 ? "+" : ""}{formatNumber(s.delta)}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Listeners Chart */}
      {chartData.length > 1 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-green-400" />
            Monthly Listeners History
          </h3>
          <div className="flex items-end gap-1 h-32">
            {chartData.map((snap, i) => {
              const maxVal = Math.max(...chartData.map(s => s.monthlyListeners || 1));
              const height = Math.max(8, ((snap.monthlyListeners || 0) / maxVal) * 100);
              return (
                <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${height}%` }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300 }}
                  className="flex-1 bg-gradient-to-t from-green-600 to-green-400 rounded-t group relative cursor-pointer">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-xs px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                    {formatNumber(snap.monthlyListeners || 0)}
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="flex gap-1 mt-1">
            {chartData.map((snap, i) => (
              <p key={i} className="flex-1 text-[9px] text-muted-foreground text-center truncate">
                {new Date(snap.snapshotAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* AI Reports */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REPORTS.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <r.icon className={`w-5 h-5 ${r.color}`} />
              <span className="text-sm font-semibold">{r.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{r.desc}</p>
            <Button size="sm" variant="outline" onClick={() => exec.mutate(r.id)}
              disabled={exec.isPending && activeReport === r.id} className="w-full text-xs">
              {exec.isPending && activeReport === r.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> :
                <Sparkles className="w-3 h-3 mr-1 text-green-400" />}
              Generate Report
            </Button>
          </Card>
        ))}
      </div>

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 relative">
            <Button variant="ghost" size="sm" className="absolute top-2 right-2"
              onClick={() => { navigator.clipboard.writeText(typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
            <h4 className="text-sm font-semibold mb-2"><Sparkles className="w-4 h-4 inline text-green-400 mr-1" />AI Report</h4>
            <pre className="text-xs whitespace-pre-wrap max-h-96 overflow-y-auto pr-8">
              {typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2)}
            </pre>
          </Card>
        </motion.div>
      )}

      {/* Not connected hint */}
      {!isConnected && (
        <div className="text-center py-4 text-muted-foreground">
          <SiSpotify className="w-6 h-6 mx-auto mb-2 text-green-400" />
          <p className="text-sm">Connect your Spotify extension for real analytics data</p>
        </div>
      )}
    </div>
  );
}
