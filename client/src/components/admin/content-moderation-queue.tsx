/**
 * ContentModerationQueue — Admin panel component for Boostify Content Moderation
 *
 * Polls /api/admin/moderation/stats + /api/admin/moderation/queue on mount.
 * Allows admins to:
 *  - View all flagged content (posts, comments, profile bios)
 *  - Filter by status and content type
 *  - Approve (allow content to stand) or Remove (take down content)
 *  - Dismiss entries from the queue
 *
 * Design: dark theme, orange-500/red accents, slate backgrounds.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Trash2,
  MessageSquare, User, FileText, RefreshCw, Filter,
  Loader2, Eye, Clock, TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types (mirror server/routes/content-moderation.ts) ──────────────────────

type ContentType = "post" | "comment" | "profile";
type Status = "pending" | "approved" | "removed";

interface FlaggedItem {
  id: string;
  contentType: ContentType;
  contentId: string | number;
  authorId: string | number;
  authorName?: string;
  text: string;
  categories: string[];
  categoryScores: Record<string, number>;
  maxScore: number;
  flaggedAt: number;
  status: Status;
  reviewedAt?: number;
  reviewedBy?: string;
}

interface ModerationStats {
  total: number;
  pending: number;
  approved: number;
  removed: number;
  today: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.9) return "text-red-400";
  if (score >= 0.7) return "text-orange-400";
  if (score >= 0.5) return "text-yellow-400";
  return "text-green-400";
}

function scoreBg(score: number): string {
  if (score >= 0.9) return "bg-red-500/20 text-red-300 border-red-500/30";
  if (score >= 0.7) return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  if (score >= 0.5) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  return "bg-green-500/20 text-green-300 border-green-500/30";
}

function contentTypeIcon(ct: ContentType) {
  if (ct === "post")    return <FileText className="h-4 w-4 text-blue-400" />;
  if (ct === "comment") return <MessageSquare className="h-4 w-4 text-purple-400" />;
  return <User className="h-4 w-4 text-orange-400" />;
}

function statusBadge(status: Status) {
  if (status === "pending")  return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 text-[10px]">Pending</Badge>;
  if (status === "approved") return <Badge className="bg-green-500/20 text-green-300 border-green-500/40 text-[10px]">Approved</Badge>;
  return <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]">Removed</Badge>;
}

function formatCategory(cat: string): string {
  return cat.replace(/[/_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, gradient, color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  color: string;
}) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} border-slate-700/50`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-slate-400 text-xs">{label}</p>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Queue Item Row ───────────────────────────────────────────────────────────

function QueueItemRow({
  item,
  onAction,
}: {
  item: FlaggedItem;
  onAction: (id: string, action: "approved" | "removed" | "dismiss") => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const act = async (action: "approved" | "removed" | "dismiss") => {
    setLoading(action);
    await onAction(item.id, action);
    setLoading(null);
  };

  const topCategories = item.categories.slice(0, 3);

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
      item.status === "pending"
        ? "bg-slate-900/60 border-slate-700/50 hover:border-slate-600/50"
        : "bg-slate-900/30 border-slate-800/30 opacity-70"
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {contentTypeIcon(item.contentType)}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-white capitalize">{item.contentType}</span>
              <span className="text-[10px] text-slate-500">#{item.contentId}</span>
              {statusBadge(item.status)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              by {item.authorName ?? `User ${item.authorId}`} ·{" "}
              {formatDistanceToNow(new Date(item.flaggedAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs font-bold ${scoreColor(item.maxScore)}`}>
            {(item.maxScore * 100).toFixed(0)}% risk
          </span>

          {item.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act("approved")}
                disabled={!!loading}
                className="h-7 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                title="Approve — keep content"
              >
                {loading === "approved" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act("removed")}
                disabled={!!loading}
                className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                title="Remove — take down content"
              >
                {loading === "removed" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => act("dismiss")}
            disabled={!!loading}
            className="h-7 px-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
            title="Dismiss from queue"
          >
            {loading === "dismiss" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 px-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
            title="Expand content"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Flagged categories */}
      <div className="flex flex-wrap gap-1.5">
        {topCategories.map((cat) => (
          <span
            key={cat}
            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
              scoreBg(item.categoryScores[cat] ?? item.maxScore)
            }`}
          >
            {formatCategory(cat)}
          </span>
        ))}
        {item.categories.length > 3 && (
          <span className="text-[10px] text-slate-500">+{item.categories.length - 3} more</span>
        )}
      </div>

      {/* Content preview */}
      {!expanded ? (
        <p className="text-sm text-slate-300 line-clamp-2 bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/30">
          {item.text}
        </p>
      ) : (
        <pre className="text-sm text-slate-200 whitespace-pre-wrap bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/30 max-h-48 overflow-y-auto font-sans">
          {item.text}
        </pre>
      )}

      {/* Score breakdown (expanded) */}
      {expanded && Object.keys(item.categoryScores).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {Object.entries(item.categoryScores)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([cat, score]) => (
              <div key={cat} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-2 py-1">
                <span className="text-[10px] text-slate-400 truncate">{formatCategory(cat)}</span>
                <span className={`text-[10px] font-bold ml-1 flex-shrink-0 ${scoreColor(score)}`}>
                  {(score * 100).toFixed(1)}%
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Reviewed info */}
      {item.reviewedAt && item.reviewedBy && (
        <p className="text-[10px] text-slate-500">
          Reviewed by {item.reviewedBy} · {formatDistanceToNow(new Date(item.reviewedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContentModerationQueue() {
  const { toast } = useToast();

  const [stats, setStats]       = useState<ModerationStats | null>(null);
  const [items, setItems]       = useState<FlaggedItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [typeFilter, setTypeFilter]     = useState<ContentType | "all">("all");
  const [search, setSearch]     = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, queueRes] = await Promise.all([
        apiRequest({ url: "/api/admin/moderation/stats",  method: "GET" }),
        apiRequest({ url: "/api/admin/moderation/queue",  method: "GET" }),
      ]) as [ModerationStats, { items: FlaggedItem[] }];

      setStats(statsRes);
      setItems(queueRes.items ?? []);
    } catch (err: any) {
      toast({ title: "Failed to load moderation queue", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = useCallback(
    async (id: string, action: "approved" | "removed" | "dismiss") => {
      try {
        if (action === "dismiss") {
          await apiRequest({ url: `/api/admin/moderation/queue/${id}`, method: "DELETE" });
          setItems((prev) => prev.filter((i) => i.id !== id));
          if (stats) setStats({ ...stats, total: stats.total - 1 });
        } else {
          const updated = await apiRequest({
            url: `/api/admin/moderation/queue/${id}`,
            method: "PATCH",
            body: { status: action, reviewedBy: "admin" },
          }) as FlaggedItem;

          setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));

          // Update stats counters
          if (stats) {
            const old = items.find((i) => i.id === id);
            const newStats = { ...stats };
            if (old?.status === "pending") newStats.pending = Math.max(0, newStats.pending - 1);
            if (action === "approved") newStats.approved += 1;
            else newStats.removed += 1;
            setStats(newStats);
          }

          toast({
            title: action === "approved" ? "Content approved" : "Content removed",
            description: action === "approved"
              ? "The content will remain visible."
              : "The content has been marked for removal.",
          });
        }
      } catch (err: any) {
        toast({ title: "Action failed", description: err?.message, variant: "destructive" });
      }
    },
    [items, stats, toast],
  );

  // ── Filters ──
  const filtered = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (typeFilter !== "all" && item.contentType !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.text.toLowerCase().includes(q) ||
        (item.authorName ?? "").toLowerCase().includes(q) ||
        item.categories.some((c) => c.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30">
            <Shield className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Content Moderation</h2>
            <p className="text-xs text-slate-400">AI-powered safety — OpenAI Moderation API</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchData}
          disabled={loading}
          className="border-slate-600 hover:bg-slate-800 text-slate-300 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Flagged Today"  value={stats.today}    icon={AlertTriangle} gradient="from-red-500/15 to-orange-500/15"  color="text-red-400"    />
          <StatCard label="Pending Review" value={stats.pending}  icon={Clock}         gradient="from-yellow-500/15 to-amber-500/15" color="text-yellow-400" />
          <StatCard label="Approved"       value={stats.approved} icon={CheckCircle}   gradient="from-green-500/15 to-emerald-500/15" color="text-green-400" />
          <StatCard label="Removed"        value={stats.removed}  icon={XCircle}       gradient="from-slate-500/15 to-slate-600/15"  color="text-slate-400" />
        </div>
      )}

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search content, author, category…"
                className="pl-8 bg-slate-800/60 border-slate-600 h-8 text-xs"
              />
            </div>

            {/* Status filter */}
            <div className="flex gap-1">
              {(["all", "pending", "approved", "removed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors capitalize ${
                    statusFilter === s
                      ? "bg-orange-500 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div className="flex gap-1">
              {(["all", "post", "comment", "profile"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors capitalize ${
                    typeFilter === t
                      ? "bg-orange-500 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
            <span className="text-sm text-slate-400">Loading moderation queue…</span>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-slate-900/40 border-slate-700/30">
            <CardContent className="pt-12 pb-12 flex flex-col items-center gap-4">
              <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
                <Shield className="h-10 w-10 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold mb-1">
                  {items.length === 0 ? "Queue is empty" : "No results match your filters"}
                </p>
                <p className="text-sm text-slate-400">
                  {items.length === 0
                    ? "No content has been flagged yet. The AI moderation system is actively monitoring."
                    : "Try adjusting the status or type filters."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Showing {filtered.length} of {items.length} flagged item{items.length !== 1 ? "s" : ""}
            </p>
            {filtered.map((item) => (
              <QueueItemRow key={item.id} item={item} onAction={handleAction} />
            ))}
          </>
        )}
      </div>

      {/* Info footer */}
      <Card className="bg-slate-900/30 border-slate-700/20">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 space-y-1">
              <p className="font-medium text-slate-300">How AI Moderation Works</p>
              <p>
                Every post, comment, and profile bio is sent to OpenAI's{" "}
                <span className="text-orange-400">omni-moderation-latest</span> model before being
                saved. Content with a toxicity score &gt; 50% or that triggers any safety category
                is auto-flagged here for admin review.
              </p>
              <p>
                Set <code className="text-orange-300">ADMIN_MODERATION_WEBHOOK_URL</code> in your
                environment to receive instant notifications when content is flagged.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
