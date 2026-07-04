/**
 * BOOSTIFY — YouTube Channel SEO Widgets
 *
 * Real-time SEO cockpit for the artist's ACTUAL YouTube channel. Uses the same
 * OAuth connection the upload flow uses (/api/auth/youtube) and the Channel
 * SEO Engine (/api/youtube-seo) to:
 *   1. Channel Health widget — real subs/views/videos + channel SEO score
 *   2. Video SEO Monitor — every upload scored, worst first, with issues
 *   3. One-click AI Fix — GLM-5.2 audit → APPLY to YouTube in real time
 *   4. Channel Keywords Optimizer — brandingSettings update on the live channel
 *
 * `compact` renders the condensed artist-profile-module version.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { SiYoutube } from "react-icons/si";
import {
  Loader2, Gauge, Wand2, CheckCircle, AlertTriangle, ExternalLink,
  RefreshCw, Sparkles, Eye, ThumbsUp, MessageSquare, Users, Video,
  ArrowUpRight, Tags, X,
} from "lucide-react";

const YT_RED = "#ff0033";

interface SeoCheck { id: string; label: string; pass?: boolean; tip: string }
interface OverviewRes {
  success: boolean;
  connected: boolean;
  channel?: {
    id: string; title: string; thumbnailUrl: string; customUrl: string;
    subscribers: number; totalViews: number; videoCount: number;
    keywords: string; description: string; canManageChannel: boolean;
  };
  seo?: { score: number; checks: SeoCheck[] };
}
interface SeoVideo {
  id: string; title: string; description: string; tags: string[];
  thumbnailUrl: string; publishedAt: string;
  views: number; likes: number; comments: number;
  seoScore: number; issues: { id: string; label: string; tip: string }[];
}
interface VideoSuggestion {
  title: string; description: string; tags: string[];
  reasoning: string; expectedImpact: string;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

const scoreColor = (s: number) => (s >= 75 ? "#22c55e" : s >= 50 ? "#eab308" : "#ef4444");

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={scoreColor(score)} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (circ * score) / 100}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
        {score}
      </span>
    </div>
  );
}

export function ChannelSeoWidgets({
  artistName,
  genre,
  compact = false,
}: {
  artistName?: string;
  genre?: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<(VideoSuggestion & { videoId: string; videoTitle: string }) | null>(null);
  const [channelAudit, setChannelAudit] = useState<{ keywords: string; description: string; reasoning: string } | null>(null);
  const [channelAuditing, setChannelAuditing] = useState(false);
  const [channelApplying, setChannelApplying] = useState(false);

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<OverviewRes>({
    queryKey: ["yt-seo-overview"],
    queryFn: async () => {
      const r = await fetch("/api/youtube-seo/overview", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load channel overview");
      return r.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  const connected = !!overview?.connected;

  const { data: videosData, isLoading: videosLoading } = useQuery<{ success: boolean; videos: SeoVideo[] }>({
    queryKey: ["yt-seo-videos"],
    queryFn: async () => {
      const r = await fetch(`/api/youtube-seo/videos?max=${compact ? 6 : 15}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load videos");
      return r.json();
    },
    enabled: connected,
    staleTime: 60_000,
    retry: 1,
  });

  const videos = videosData?.videos || [];
  const shownVideos = compact ? videos.slice(0, 3) : videos;

  const connectYoutube = async () => {
    setConnecting(true);
    try {
      const r = await fetch("/api/auth/youtube/connect", { credentials: "include" });
      const data = await r.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || "YouTube OAuth not configured");
      }
    } catch (e: any) {
      toast({ title: "Could not start YouTube connection", description: e.message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const auditVideo = async (v: SeoVideo) => {
    setAuditingId(v.id);
    setSuggestion(null);
    try {
      const r = await fetch("/api/youtube-seo/audit-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ videoId: v.id, artistName, genre }),
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || "Audit failed");
      setSuggestion({ ...data.suggestion, videoId: v.id, videoTitle: v.title });
    } catch (e: any) {
      toast({ title: "AI audit failed", description: e.message, variant: "destructive" });
    } finally {
      setAuditingId(null);
    }
  };

  const applyVideoFix = async () => {
    if (!suggestion) return;
    setApplyingId(suggestion.videoId);
    try {
      const r = await fetch("/api/youtube-seo/apply-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          videoId: suggestion.videoId,
          title: suggestion.title,
          description: suggestion.description,
          tags: suggestion.tags,
        }),
      });
      const data = await r.json();
      if (!data.applied) throw new Error(data.error || "Apply failed");
      toast({
        title: "Applied to your YouTube channel ✅",
        description: `New SEO score: ${data.newScore ?? "—"}/100 — live on YouTube now.`,
      });
      setSuggestion(null);
      qc.invalidateQueries({ queryKey: ["yt-seo-videos"] });
    } catch (e: any) {
      toast({ title: "Could not apply changes", description: e.message, variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  };

  const auditChannel = async () => {
    setChannelAuditing(true);
    setChannelAudit(null);
    try {
      const r = await fetch("/api/youtube-seo/audit-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ artistName, genre }),
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || "Audit failed");
      setChannelAudit(data.suggestion);
    } catch (e: any) {
      toast({ title: "Channel audit failed", description: e.message, variant: "destructive" });
    } finally {
      setChannelAuditing(false);
    }
  };

  const applyChannelFix = async () => {
    if (!channelAudit) return;
    setChannelApplying(true);
    try {
      const r = await fetch("/api/youtube-seo/apply-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keywords: channelAudit.keywords, description: channelAudit.description }),
      });
      const data = await r.json();
      if (!data.applied) throw new Error(data.error || "Apply failed");
      toast({ title: "Channel branding updated ✅", description: "Keywords & description are live on YouTube." });
      setChannelAudit(null);
      refetchOverview();
    } catch (e: any) {
      toast({ title: "Could not update channel", description: e.message, variant: "destructive" });
    } finally {
      setChannelApplying(false);
    }
  };

  // ── Not connected state ────────────────────────────────────────────────────
  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center space-y-3">
        <SiYoutube className="w-10 h-10 mx-auto" style={{ color: YT_RED }} />
        <p className="text-sm font-semibold text-white">Connect your YouTube channel</p>
        <p className="text-xs text-white/50 max-w-sm mx-auto">
          Same connection used for uploading videos — unlocks real channel stats, live SEO monitoring
          and one-click fixes applied directly to your channel.
        </p>
        <Button onClick={connectYoutube} disabled={connecting} className="gap-2 text-white" style={{ background: YT_RED }}>
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SiYoutube className="w-4 h-4" />}
          Connect YouTube
        </Button>
      </div>
    );
  }

  const ch = overview!.channel!;
  const seo = overview!.seo!;

  return (
    <div className="space-y-4">
      {/* ── WIDGET 1: Channel Health ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          {ch.thumbnailUrl ? (
            <img src={ch.thumbnailUrl} alt={ch.title} className="w-11 h-11 rounded-full object-cover shrink-0" />
          ) : (
            <SiYoutube className="w-9 h-9 shrink-0" style={{ color: YT_RED }} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{ch.title}</p>
            <p className="text-[11px] text-white/50 truncate">{ch.customUrl || "Live channel data · YouTube Data API"}</p>
          </div>
          <ScoreRing score={seo.score} size={compact ? 52 : 64} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { icon: Users, label: "Subscribers", value: fmt(ch.subscribers) },
            { icon: Eye, label: "Total views", value: fmt(ch.totalViews) },
            { icon: Video, label: "Videos", value: fmt(ch.videoCount) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
              <s.icon className="w-3.5 h-3.5 mx-auto mb-1 text-white/40" />
              <p className="text-sm font-bold text-white leading-none">{s.value}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        {!compact && (
          <div className="mt-3 space-y-1">
            {seo.checks.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-xs">
                {c.pass ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <span className={c.pass ? "text-white/60" : "text-white/80"}>
                  {c.label}
                  {!c.pass && <span className="block text-[11px] text-white/40">{c.tip}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── WIDGET 2: Channel Keywords Optimizer (full mode) ── */}
      {!compact && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Tags className="w-4 h-4" style={{ color: YT_RED }} />
            <h4 className="text-sm font-semibold text-white">Channel Keywords Optimizer</h4>
            <Button
              size="sm" onClick={auditChannel} disabled={channelAuditing}
              className="ml-auto h-7 gap-1.5 text-xs text-white" style={{ background: YT_RED }}
            >
              {channelAuditing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              AI Audit
            </Button>
          </div>
          <p className="text-xs text-white/50 mb-2">
            Current keywords: {ch.keywords ? <span className="text-white/70">{ch.keywords.slice(0, 140)}{ch.keywords.length > 140 ? "…" : ""}</span> : <span className="text-amber-400">none set — costing you search visibility</span>}
          </p>
          {channelAudit && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Suggested keywords</p>
              <Textarea
                value={channelAudit.keywords}
                onChange={(e) => setChannelAudit({ ...channelAudit, keywords: e.target.value })}
                className="text-xs min-h-[60px]"
              />
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Suggested description</p>
              <Textarea
                value={channelAudit.description}
                onChange={(e) => setChannelAudit({ ...channelAudit, description: e.target.value })}
                className="text-xs min-h-[90px]"
              />
              <p className="text-[11px] text-white/50 italic">{channelAudit.reasoning}</p>
              {!ch.canManageChannel && (
                <p className="text-[11px] text-amber-400">
                  Your connection is missing the channel-management permission — reconnect YouTube to enable applying.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm" onClick={applyChannelFix} disabled={channelApplying || !ch.canManageChannel}
                  className="h-8 gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500"
                >
                  {channelApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  Apply to channel
                </Button>
                <Button size="sm" variant="outline" onClick={() => setChannelAudit(null)} className="h-8 text-xs">
                  Discard
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── WIDGET 3: Video SEO Monitor ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4" style={{ color: YT_RED }} />
          <h4 className="text-sm font-semibold text-white">Video SEO Monitor</h4>
          <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">
            {videos.length} videos · worst first
          </Badge>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["yt-seo-videos"] })}
            className="ml-auto text-white/40 hover:text-white/80 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        {videosLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>
        ) : shownVideos.length === 0 ? (
          <p className="text-sm text-white/50 text-center py-4">No uploads found on this channel yet.</p>
        ) : (
          <div className="space-y-2">
            {shownVideos.map((v) => (
              <div key={v.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-3">
                  {v.thumbnailUrl && (
                    <img src={v.thumbnailUrl} alt={v.title} className="w-16 h-9 rounded-md object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{v.title}</p>
                    <p className="text-[10px] text-white/40 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{fmt(v.views)}</span>
                      <span className="flex items-center gap-0.5"><ThumbsUp className="w-2.5 h-2.5" />{fmt(v.likes)}</span>
                      <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" />{fmt(v.comments)}</span>
                      <span>{v.tags.length} tags</span>
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-lg shrink-0"
                    style={{ color: scoreColor(v.seoScore), background: `${scoreColor(v.seoScore)}1a` }}
                  >
                    {v.seoScore}
                  </span>
                  <Button
                    size="sm" onClick={() => auditVideo(v)} disabled={auditingId === v.id}
                    className="h-7 gap-1 text-[11px] text-white shrink-0" style={{ background: YT_RED }}
                  >
                    {auditingId === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    AI Fix
                  </Button>
                </div>
                {!compact && v.issues.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {v.issues.map((i) => (
                      <span key={i.id} title={i.tip} className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {i.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {compact && videos.length > 3 && (
          <Button
            size="sm" variant="outline" className="w-full mt-2 h-8 gap-1.5 text-xs"
            onClick={() => (window.location.href = "/youtube-views?tab=channel-seo")}
          >
            <ArrowUpRight className="w-3 h-3" /> Open full SEO cockpit ({videos.length} videos)
          </Button>
        )}
      </div>

      {/* ── AI Fix review & real-time apply panel ── */}
      {suggestion && (
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: `${YT_RED}55`, background: `${YT_RED}0d` }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: YT_RED }} />
            <h4 className="text-sm font-semibold text-white truncate flex-1">AI Fix — {suggestion.videoTitle}</h4>
            <button onClick={() => setSuggestion(null)} className="text-white/40 hover:text-white" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Optimized title</p>
            <Input
              value={suggestion.title}
              onChange={(e) => setSuggestion({ ...suggestion, title: e.target.value })}
              className="text-sm"
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Optimized description</p>
            <Textarea
              value={suggestion.description}
              onChange={(e) => setSuggestion({ ...suggestion, description: e.target.value })}
              className="text-xs min-h-[120px]"
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Tags ({suggestion.tags.length})</p>
            <div className="flex flex-wrap gap-1">
              {suggestion.tags.map((t, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/70 border border-white/10">{t}</span>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-white/50 italic">
            {suggestion.reasoning} {suggestion.expectedImpact && <span className="text-emerald-400 not-italic font-semibold">· {suggestion.expectedImpact}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={applyVideoFix} disabled={applyingId === suggestion.videoId}
              className="gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500 h-9"
            >
              {applyingId === suggestion.videoId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Apply to YouTube now
            </Button>
            <Button
              variant="outline" className="gap-1.5 text-xs h-9"
              onClick={() => window.open(`https://www.youtube.com/watch?v=${suggestion.videoId}`, "_blank")}
            >
              <ExternalLink className="w-3.5 h-3.5" /> View video
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
