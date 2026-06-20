import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { 
  Plug, RefreshCw, Zap, Copy, CheckCircle, AlertTriangle, 
  ArrowUpRight, Clock, Users, Eye, TrendingUp, 
  Loader2, Activity, Chrome, ExternalLink,
  Shield, Wifi, Instagram, Hash, Sparkles,
  Brain, Target, Lightbulb, Send, Bot,
  Download, UserSearch, MapPin, MessageSquare, Heart, Search, X,
  Play, Square, FileDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../../hooks/use-toast";
import { useAuth } from "../../hooks/use-auth";
import { useMutation } from "@tanstack/react-query";

// Extension install path — points to local dev build
const EXTENSION_DEV_PATH = "boostify-instagram-extension/dist";

interface ExtConnection {
  id: number;
  extensionId: string;
  instagramUsername: string | null;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
}

interface ExtSnapshot {
  id: number;
  followers: number;
  following: number;
  postsCount: number;
  engagementRate: string;
  avgLikes: number;
  avgComments: number;
  snapshotAt: string;
}

interface PendingAction {
  id: number;
  actionType: string;
  payload: any;
  status: string;
  priority: string;
  generatedBy: string;
  createdAt: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  post_caption: "Post Caption",
  update_bio: "Update Bio",
  schedule_post: "Schedule Post",
  reply_comment: "Reply to Comment",
  follow_user: "Follow User",
  use_hashtags: "Use Hashtags",
  post_story: "Post Story",
  post_reel: "Post Reel",
};

export function InstagramExtensionSyncTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ExtConnection | null>(null);
  const [snapshots, setSnapshots] = useState<ExtSnapshot[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [connectToken, setConnectToken] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [newActionType, setNewActionType] = useState("post_caption");
  const [newActionPayload, setNewActionPayload] = useState("");
  const [creatingAction, setCreatingAction] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);

  // Extraction state
  type ExtractType = 'followers' | 'following' | 'hashtag' | 'location' | 'commenters' | 'likers';
  const [extractType, setExtractType] = useState<ExtractType>('followers');
  const [extractQuery, setExtractQuery] = useState('');
  const [extractSortMode, setExtractSortMode] = useState<'recent' | 'rank'>('recent');
  const [extractMaxUsers, setExtractMaxUsers] = useState(500);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractResults, setExtractResults] = useState<any[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showExtractPanel, setShowExtractPanel] = useState(false);

  const userId = user?.id;

  // AI Analysis mutation — uses OpenClaw agent
  const analysisMutation = useMutation({
    mutationFn: async () => {
      const snap = snapshots[0];
      const response = await fetch('/api/instagram/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: snap
            ? `Analyze my Instagram account. I have ${snap.followers} followers, ${snap.following} following, ${snap.postsCount} posts, ${Number(snap.engagementRate || 0).toFixed(2)}% engagement rate, avg ${snap.avgLikes} likes and ${snap.avgComments} comments per post. Give me a quick audit with 5 specific action items to grow faster.`
            : 'Give me 5 actionable tips to grow my Instagram as a music artist.',
          tabContext: 'extension',
        }),
      });
      if (!response.ok) throw new Error('Failed to get analysis');
      return response.json();
    },
    onSuccess: (data) => {
      setAiInsights(data.response);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Could not generate AI analysis', variant: 'destructive' });
    },
  });

  // Smart action mutation — generates AI-powered action for the extension
  const smartActionMutation = useMutation({
    mutationFn: async (actionType: string) => {
      const prompts: Record<string, string> = {
        caption: 'Generate a viral Instagram caption for a music artist post. Keep it under 150 words with emojis and a call to action.',
        hashtags: 'Generate 30 optimized hashtags for a music artist. Mix popular (1M+), medium (100K-1M) and niche (<100K) tags. Return them as a single line separated by spaces.',
        bio: 'Write 3 optimized Instagram bio options for a music artist. Each should be under 150 characters, include a call to action and use relevant emojis.',
        reels_idea: 'Suggest 3 trending Reel ideas for a music artist that could go viral right now. Include the concept, trending audio suggestion, and hooks.',
      };
      const response = await fetch('/api/instagram/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: prompts[actionType] || prompts.caption, tabContext: 'extension' }),
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      return { type: actionType, content: data.response };
    },
    onSuccess: (data) => {
      // Auto-create the pending action for the extension to execute
      if (connection) {
        const typeMap: Record<string, string> = { caption: 'post_caption', hashtags: 'use_hashtags', bio: 'update_bio', reels_idea: 'post_reel' };
        fetch("/api/instagram-ext/create-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: connection.id,
            actionType: typeMap[data.type] || 'post_caption',
            payload: { text: data.content, generatedBy: 'ai' },
            priority: "medium",
            generatedBy: "openclaw-ai",
          }),
        }).then(() => loadData());
      }
      toast({ title: 'AI Action Created', description: 'The extension will execute it on the next sync.' });
    },
  });

  // Extraction — communicates with the Chrome extension via postMessage
  const startExtraction = useCallback(async () => {
    setExtracting(true);
    setExtractProgress(0);
    setExtractResults([]);
    setExtractError(null);

    try {
      // Send extraction command to the extension via chrome.runtime (externally_connectable)
      // For web app → extension communication, we use a server-side relay
      const res = await fetch('/api/instagram-ext/create-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          connectionId: connection?.id,
          actionType: 'use_hashtags', // Reuse existing type as carrier
          payload: {
            __extraction: true,
            extractType,
            query: extractQuery || undefined,
            sortMode: extractSortMode,
            maxUsers: extractMaxUsers,
          },
          generatedBy: 'extraction-tool',
          priority: 1,
        }),
      });

      if (!res.ok) throw new Error('Failed to start extraction');

      toast({
        title: 'Extraction Started',
        description: `The extension will extract ${extractType} data on the next sync. Open Instagram in Chrome to begin.`,
      });

      // Poll for results (the extension saves them back via save-extraction endpoint)
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        if (attempts > 120) { // 2 min timeout
          clearInterval(pollInterval);
          setExtracting(false);
          setExtractError('Extraction timed out. Make sure the extension is active on Instagram.');
          return;
        }

        try {
          const checkRes = await fetch(`/api/instagram-ext/web/extractions?userId=${userId}`);
          if (checkRes.ok) {
            const data = await checkRes.json();
            if (data.extractions?.length > 0) {
              const latest = data.extractions[0];
              if (new Date(latest.createdAt).getTime() > Date.now() - 120000) {
                clearInterval(pollInterval);
                setExtractResults(latest.users || []);
                setExtractProgress(latest.totalCount || latest.users?.length || 0);
                setExtracting(false);
                toast({
                  title: 'Extraction Complete',
                  description: `${latest.totalCount} users extracted successfully.`,
                });
              }
            }
          }
        } catch {}
      }, 1000);

    } catch (err: any) {
      setExtracting(false);
      setExtractError(err.message);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [extractType, extractQuery, extractSortMode, extractMaxUsers, userId, connection, toast]);

  const exportExtractedUsers = useCallback((format: 'csv' | 'json') => {
    if (extractResults.length === 0) return;

    let content: string;
    let mimeType: string;
    let ext: string;

    if (format === 'csv') {
      const headers = 'Username,Display Name,Verified,Source,Source Query,Extracted At';
      const rows = extractResults.map(u =>
        `${u.username},"${(u.displayName || '').replace(/"/g, '""')}",${u.isVerified},${u.source},"${(u.sourceQuery || '').replace(/"/g, '""')}",${u.extractedAt}`
      );
      content = [headers, ...rows].join('\n');
      mimeType = 'text/csv';
      ext = 'csv';
    } else {
      content = JSON.stringify(extractResults, null, 2);
      mimeType = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boostify-${extractType}-${extractQuery || 'extract'}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [extractResults, extractType, extractQuery]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const statusRes = await fetch(`/api/instagram-ext/status/${userId}`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        if (data.connections?.length > 0) {
          const conn = data.connections[0];
          setConnection(conn);

          // Load snapshots
          try {
            const snapRes = await fetch(`/api/instagram-ext/snapshots/${conn.id}`);
            if (snapRes.ok) {
              const snapData = await snapRes.json();
              setSnapshots(snapData.snapshots || []);
            }
          } catch {}

          // Load pending actions
          try {
            const actRes = await fetch(`/api/instagram-ext/pending-actions?connectionId=${conn.id}`);
            if (actRes.ok) {
              const actData = await actRes.json();
              setPendingActions(actData.actions || []);
            }
          } catch {}
        } else {
          setConnection(null);
        }
      }
    } catch (err) {
      console.error("Failed to load extension data:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateToken = async () => {
    if (!userId) {
      toast({ title: "Error", description: "You must be signed in first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/instagram-ext/generate-connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const token = data.connectToken || data.token;
      if (!token) throw new Error("No token returned");
      setConnectToken(token);
      toast({ title: "Token Generated", description: "Copy the token and paste it in the extension popup." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate token", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyToken = () => {
    if (connectToken) {
      navigator.clipboard.writeText(connectToken);
      toast({ title: "Copied!", description: "Token copied to clipboard" });
    }
  };

  const handleCreateAction = async () => {
    if (!connection) return;
    setCreatingAction(true);
    try {
      let payload: any = {};
      try { payload = newActionPayload ? JSON.parse(newActionPayload) : {}; } catch { payload = { text: newActionPayload }; }

      const res = await fetch("/api/instagram-ext/create-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: connection.id,
          actionType: newActionType,
          payload,
          priority: "medium",
          generatedBy: "dashboard",
        }),
      });
      if (!res.ok) throw new Error("Failed to create action");
      toast({ title: "Action Created", description: "The extension will execute it on the next sync." });
      setNewActionPayload("");
      await loadData();
    } catch {
      toast({ title: "Error", description: "Failed to create the action", variant: "destructive" });
    } finally {
      setCreatingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-card border border-border backdrop-blur-sm flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin w-8 h-8 text-pink-400" />
      </div>
    );
  }

  const latestSnapshot = snapshots[0];

  return (
    <div className="space-y-6">
      {/* Hero Download Card */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="relative bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] p-6 sm:p-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-50" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <Instagram className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Boostify Instagram Extension</h2>
                  <p className="text-pink-100 text-xs">Chrome Extension v1.0.0</p>
                </div>
              </div>
              <p className="text-white/90 text-sm max-w-xl mb-3">
                Connect your Instagram account with Boostify. AI generates captions, hashtags, and optimizations — the extension applies them directly to Instagram.
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-white/80">
                <span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5" /> Auto Sync</span>
                <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI Tools</span>
                <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Secure</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {connection ? (
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/30">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-white font-semibold text-sm">Connected</span>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="bg-white text-[#833ab4] hover:bg-pink-50 font-bold px-6 py-5 rounded-xl shadow-lg"
                  onClick={() => window.open("chrome://extensions", "_blank")}
                >
                  <Chrome className="w-5 h-5 mr-2" />
                  Install Extension
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Installation Steps — only show if not connected */}
      {!connection && (
        <div className="p-5 rounded-2xl bg-card border border-border">
          <h4 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-pink-400" />
            Setup in 3 Steps
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InstallStepCard
              step={1}
              icon={<Chrome className="w-5 h-5" />}
              title="Load Extension"
              description='Open chrome://extensions, enable Developer Mode, click "Load unpacked" and select the boostify-instagram-extension/dist folder'
              color="purple"
            />
            <InstallStepCard
              step={2}
              icon={<Zap className="w-5 h-5" />}
              title="Generate Token"
              description="Click the button below to generate a connection token, then copy it"
              color="pink"
            />
            <InstallStepCard
              step={3}
              icon={<Plug className="w-5 h-5" />}
              title="Connect"
              description="Open Instagram in your browser, then open the extension popup, paste the token and click Connect"
              color="orange"
            />
          </div>
        </div>
      )}

      {/* Instagram Open Requirement Banner — always visible */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#833ab4]/10 via-[#fd1d1d]/10 to-[#fcb045]/10 border border-[#833ab4]/30 flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-[#833ab4] to-[#fd1d1d] rounded-xl shrink-0">
          <Instagram className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-foreground flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#833ab4]/20 text-[#833ab4] text-[10px] font-bold uppercase tracking-wide">Required</span>
            Keep Instagram open in your browser
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            The extension needs an active Instagram tab to sync your data, extract profiles, and execute actions.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90 shrink-0"
          onClick={() => window.open('https://www.instagram.com/', '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-1.5" />
          Open Instagram
        </Button>
      </div>

      {/* Connection Section */}
      <div className="p-6 rounded-2xl bg-card border border-border backdrop-blur-sm">
        <div className="flex items-center gap-5 mb-6">
          <div className="p-4 bg-gradient-to-br from-[#833ab4]/20 to-pink-500/10 rounded-2xl border border-pink-500/10">
            <Plug className="h-8 w-8 text-pink-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">Connection Status</h3>
            <p className="text-muted-foreground">
              Connect your Chrome extension with your Boostify account
            </p>
          </div>
          <Button onClick={loadData} variant="outline" className="ml-auto" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {connection ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-lg mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <div className="flex-1">
                <p className="font-semibold text-green-400">✅ Extension Connected</p>
                <p className="text-sm text-muted-foreground">
                  @{connection.instagramUsername || 'unknown'}
                  {" · "}ID: {connection.extensionId.slice(0, 16)}…
                </p>
              </div>
              <div className="text-right">
                {connection.lastSyncAt && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {timeAgo(connection.lastSyncAt)}
                  </p>
                )}
                <Badge variant="outline" className="border-green-500/30 text-green-400">
                  {connection.status}
                </Badge>
              </div>
            </div>

            {/* Latest Stats */}
            {latestSnapshot && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <StatCard icon={<Users className="w-4 h-4 text-purple-400" />} label="Followers" value={formatNumber(latestSnapshot.followers)} />
                <StatCard icon={<Eye className="w-4 h-4 text-blue-400" />} label="Following" value={formatNumber(latestSnapshot.following)} />
                <StatCard icon={<Instagram className="w-4 h-4 text-pink-400" />} label="Posts" value={formatNumber(latestSnapshot.postsCount)} />
                <StatCard icon={<TrendingUp className="w-4 h-4 text-green-400" />} label="Engagement" value={`${Number(latestSnapshot.engagementRate || 0).toFixed(2)}%`} />
              </div>
            )}

            {/* AI-Powered Insights */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-[#833ab4]/10 to-[#fd1d1d]/10 border border-[#833ab4]/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[#833ab4]" />
                  <h4 className="font-bold text-sm">AI Growth Analysis</h4>
                  <Badge variant="outline" className="border-[#833ab4]/30 text-[#833ab4] text-[10px]">Powered by OpenClaw</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={analysisMutation.isPending}
                  onClick={() => analysisMutation.mutate()}
                  className="border-[#833ab4]/30 hover:bg-[#833ab4]/10 text-xs"
                >
                  {analysisMutation.isPending ? <Loader2 className="animate-spin w-3 h-3 mr-1" /> : <Brain className="w-3 h-3 mr-1" />}
                  {aiInsights ? 'Refresh Analysis' : 'Analyze My Account'}
                </Button>
              </div>

              {aiInsights ? (
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed max-h-[300px] overflow-y-auto pr-2">
                  {aiInsights}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70">
                  Click "Analyze My Account" to get personalized growth recommendations based on your Instagram data.
                </p>
              )}
            </div>

            {/* Smart AI Actions */}
            <div className="mt-4">
              <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[#fcb045]" />
                Quick AI Actions
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { key: 'caption', icon: Send, label: 'Generate Caption', color: '#833ab4' },
                  { key: 'hashtags', icon: Hash, label: 'Generate Hashtags', color: '#fd1d1d' },
                  { key: 'bio', icon: Target, label: 'Optimize Bio', color: '#fcb045' },
                  { key: 'reels_idea', icon: Sparkles, label: 'Reel Ideas', color: '#E1306C' },
                ].map((action) => (
                  <Button
                    key={action.key}
                    variant="outline"
                    size="sm"
                    disabled={smartActionMutation.isPending}
                    onClick={() => smartActionMutation.mutate(action.key)}
                    className="border-border hover:border-[#833ab4]/40 hover:bg-[#833ab4]/5 text-xs h-auto py-2.5 flex flex-col items-center gap-1"
                  >
                    {smartActionMutation.isPending && smartActionMutation.variables === action.key
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <action.icon className="w-4 h-4" style={{ color: action.color }} />
                    }
                    {action.label}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                AI-generated content is automatically queued as a pending action for the extension to execute.
              </p>
            </div>

            {/* Data Extraction Tool */}
            <div className="mt-4 p-4 rounded-xl bg-card border border-border">
              <button
                onClick={() => setShowExtractPanel(!showExtractPanel)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <UserSearch className="w-5 h-5 text-blue-400" />
                  <h4 className="font-bold text-sm">Data Extraction Tool</h4>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[10px]">
                    IGEmail Alternative
                  </Badge>
                </div>
                <motion.div animate={{ rotate: showExtractPanel ? 180 : 0 }}>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showExtractPanel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-4">
                      {/* Instagram requirement for extraction */}
                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <Instagram className="w-4 h-4 text-amber-500 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          <strong className="text-amber-400">Instagram must be open</strong> in another tab. The extension scrapes data directly from the Instagram page.
                          {' '}<a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="text-[#833ab4] underline hover:text-pink-400">Open Instagram →</a>
                        </p>
                      </div>

                      {/* Extract Type Selector */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">1. Select Extract Type</label>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            { type: 'followers' as ExtractType, icon: Users, label: 'Followers', color: 'purple' },
                            { type: 'following' as ExtractType, icon: UserSearch, label: 'Following', color: 'blue' },
                            { type: 'hashtag' as ExtractType, icon: Hash, label: 'Hashtag', color: 'pink' },
                            { type: 'location' as ExtractType, icon: MapPin, label: 'Location', color: 'green' },
                            { type: 'commenters' as ExtractType, icon: MessageSquare, label: 'Comment', color: 'orange' },
                            { type: 'likers' as ExtractType, icon: Heart, label: 'Like', color: 'red' },
                          ]).map((opt) => (
                            <button
                              key={opt.type}
                              onClick={() => setExtractType(opt.type)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                extractType === opt.type
                                  ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                                  : 'bg-background border-border text-muted-foreground hover:border-blue-500/40'
                              }`}
                            >
                              <opt.icon className="w-3.5 h-3.5" />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Query Input (for hashtag, location, likers, commenters) */}
                      {['hashtag', 'location', 'likers', 'commenters'].includes(extractType) && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">
                            2. Enter {extractType === 'hashtag' ? 'Instagram Hashtag' : extractType === 'location' ? 'Location URL' : 'Post URL'}
                          </label>
                          <div className="relative">
                            {extractType === 'hashtag' && (
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            )}
                            <Input
                              value={extractQuery}
                              onChange={(e) => setExtractQuery(e.target.value)}
                              placeholder={
                                extractType === 'hashtag' ? 'e.g. music, hiphop, trap' :
                                extractType === 'location' ? 'e.g. https://instagram.com/explore/locations/...' :
                                'e.g. https://instagram.com/p/...'
                              }
                              className={extractType === 'hashtag' ? 'pl-9' : ''}
                            />
                          </div>
                        </div>
                      )}

                      {/* Sort Mode (for hashtag) */}
                      {extractType === 'hashtag' && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">3. Sort By</label>
                          <div className="flex gap-0 border border-border rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExtractSortMode('recent')}
                              className={`flex-1 py-2 text-xs font-bold transition-all ${
                                extractSortMode === 'recent'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-background text-muted-foreground hover:bg-muted/50'
                              }`}
                            >
                              Recent
                            </button>
                            <button
                              onClick={() => setExtractSortMode('rank')}
                              className={`flex-1 py-2 text-xs font-bold transition-all ${
                                extractSortMode === 'rank'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-background text-muted-foreground hover:bg-muted/50'
                              }`}
                            >
                              Rank
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Max Users */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">
                          Max Users to Extract
                        </label>
                        <div className="flex gap-1.5">
                          {[100, 250, 500, 1000].map((n) => (
                            <button
                              key={n}
                              onClick={() => setExtractMaxUsers(n)}
                              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                extractMaxUsers === n
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-background border-border text-muted-foreground hover:border-blue-500/40'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Extract Button */}
                      <Button
                        onClick={startExtraction}
                        disabled={extracting || (['hashtag', 'location'].includes(extractType) && !extractQuery)}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-5 rounded-xl shadow-lg"
                      >
                        {extracting ? (
                          <>
                            <Loader2 className="animate-spin w-5 h-5 mr-2" />
                            Extracting... {extractProgress > 0 && `(${extractProgress})`}
                          </>
                        ) : (
                          <>
                            <Play className="w-5 h-5 mr-2" />
                            EXTRACT
                          </>
                        )}
                      </Button>

                      {/* Progress Bar */}
                      {extracting && (
                        <div className="space-y-1">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                              initial={{ width: '0%' }}
                              animate={{ width: `${Math.min((extractProgress / extractMaxUsers) * 100, 100)}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center">
                            {extractProgress} / {extractMaxUsers} users · Open Instagram in Chrome for the extension to work
                          </p>
                        </div>
                      )}

                      {/* Error */}
                      {extractError && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          {extractError}
                        </div>
                      )}

                      {/* Results */}
                      {extractResults.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-sm font-bold text-green-400">
                                {extractResults.length} users extracted
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => exportExtractedUsers('csv')} className="text-xs h-7">
                                <FileDown className="w-3 h-3 mr-1" /> CSV
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => exportExtractedUsers('json')} className="text-xs h-7">
                                <FileDown className="w-3 h-3 mr-1" /> JSON
                              </Button>
                            </div>
                          </div>

                          {/* User Preview */}
                          <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                            {extractResults.slice(0, 50).map((user: any, i: number) => (
                              <div key={user.username || i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border text-xs">
                                <span className="w-5 text-muted-foreground/50 text-right shrink-0">{i + 1}</span>
                                {user.profilePicUrl ? (
                                  <img src={user.profilePicUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                    <Users className="w-3 h-3 text-muted-foreground" />
                                  </div>
                                )}
                                <a
                                  href={`https://instagram.com/${user.username}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-foreground hover:text-blue-400 transition-colors"
                                >
                                  @{user.username}
                                </a>
                                {user.isVerified && <CheckCircle className="w-3 h-3 text-blue-400" />}
                                <span className="text-muted-foreground/60 truncate flex-1">{user.displayName}</span>
                              </div>
                            ))}
                            {extractResults.length > 50 && (
                              <p className="text-[10px] text-muted-foreground text-center py-1">
                                Showing 50 of {extractResults.length} — Export to see all
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <p className="font-semibold text-amber-400">Extension not connected</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Generate a connection token and paste it in the Chrome extension popup to link your account.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Token Generation — Always Visible */}
      <div className="p-6 rounded-2xl bg-card border border-border backdrop-blur-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-gradient-to-br from-[#833ab4]/20 to-[#fd1d1d]/20 rounded-xl">
            <Zap className="h-6 w-6 text-[#fd1d1d]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground">
              {connection ? 'Reconnect / New Token' : 'Connect Extension'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {connection
                ? 'Generate a new token to reconnect with updated profile data'
                : 'Generate a token, copy it, and paste it in the Chrome extension popup'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Step-by-step mini guide */}
          {!connectToken && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">Generate Token</p>
                  <p className="text-xs text-muted-foreground">Click the button below</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-r from-[#fd1d1d] to-[#fcb045] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">Copy Token</p>
                  <p className="text-xs text-muted-foreground">Click copy to clipboard</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-r from-[#fcb045] to-green-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">Paste in Extension</p>
                  <p className="text-xs text-muted-foreground">Open extension popup → paste token → connect</p>
                </div>
              </div>
            </div>
          )}

          {/* Reminder to open Instagram */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-400">Make sure Instagram is open</p>
              <p className="text-xs text-muted-foreground">Open <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="text-[#833ab4] underline hover:text-pink-400 font-medium">instagram.com</a> in a browser tab <strong>before</strong> connecting. The extension needs it to detect your account.</p>
            </div>
          </div>

          <Button
            onClick={handleGenerateToken}
            disabled={generating}
            size="lg"
            className="w-full sm:w-auto bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white shadow-lg shadow-[#fd1d1d]/20 rounded-xl font-bold text-base px-8 py-6 transition-all duration-300 hover:scale-[1.02]"
          >
            {generating ? <Loader2 className="animate-spin mr-2 w-5 h-5" /> : <Zap className="mr-2 w-5 h-5" />}
            {connection ? 'Generate New Token' : 'Generate Connection Token'}
          </Button>

          <AnimatePresence>
            {connectToken && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-5 bg-gradient-to-br from-green-500/5 to-[#833ab4]/5 border-2 border-green-500/30 rounded-xl"
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <p className="text-sm font-bold text-green-400">Token Generated Successfully!</p>
                  <Badge className="ml-auto bg-amber-500/20 border-amber-500/30 text-amber-400 text-[10px]">
                    Expires in 10 min
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background px-4 py-3 rounded-lg text-sm font-mono truncate select-all border border-border">
                    {connectToken}
                  </code>
                  <Button
                    size="lg"
                    onClick={copyToken}
                    className="shrink-0 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold px-6"
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy
                  </Button>
                </div>
                <div className="mt-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <p className="text-xs text-blue-400 flex items-start gap-2">
                    <ArrowUpRight className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Next:</strong> Click the Boostify extension icon in Chrome toolbar → 
                      go to Home tab → paste this token in the connection field → click Connect. 
                      Then navigate to Instagram.
                    </span>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Action (only if connected) */}
      {connection && (
        <div className="p-6 rounded-2xl bg-card border border-border backdrop-blur-sm">
          <h4 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-400" />
            Send Action to Extension
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            Create an action that the extension will execute directly within Instagram.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <select
              value={newActionType}
              onChange={(e) => setNewActionType(e.target.value)}
              className="bg-background border rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Input
              placeholder='Content (text or JSON)'
              value={newActionPayload}
              onChange={(e) => setNewActionPayload(e.target.value)}
            />
          </div>
          <Button
            onClick={handleCreateAction}
            disabled={creatingAction}
            className="bg-gradient-to-r from-[#833ab4] to-[#fcb045] hover:opacity-90 text-white shadow-[0_0_25px_rgba(131,58,180,0.25)] rounded-xl font-semibold transition-all duration-300"
          >
            {creatingAction ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <ArrowUpRight className="mr-2 w-4 h-4" />}
            Create Action
          </Button>

          {/* Pending Actions */}
          {pendingActions.length > 0 && (
            <div className="mt-4 space-y-2">
              <h5 className="text-sm font-semibold text-muted-foreground">Pending Actions</h5>
              {pendingActions.slice(0, 5).map((action) => (
                <div key={action.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{ACTION_TYPE_LABELS[action.actionType] || action.actionType}</span>
                    <Badge variant="outline" className={
                      action.status === 'pending' ? 'border-yellow-500/30 text-yellow-400' :
                      action.status === 'completed' ? 'border-green-500/30 text-green-400' :
                      'border-red-500/30 text-red-400'
                    }>
                      {action.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground/70">{timeAgo(action.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard
          icon={<Sparkles className="w-6 h-6 text-pink-400" />}
          title="AI Captions & Hashtags"
          description="Generate optimized captions and hashtags directly from the Instagram side panel"
        />
        <FeatureCard
          icon={<TrendingUp className="w-6 h-6 text-purple-400" />}
          title="Stats Sync"
          description="Followers, engagement and post metrics synced automatically every 5 minutes"
        />
        <FeatureCard
          icon={<Clock className="w-6 h-6 text-orange-400" />}
          title="Best Time & Bio"
          description="Discover when to post and optimize your bio with AI to maximize your growth"
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-muted/30 border border-border">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function InstallStepCard({ step, icon, title, description, color }: { 
  step: number; icon: React.ReactNode; title: string; description: string; color: string 
}) {
  const colors: Record<string, string> = {
    purple: "from-purple-500/10 to-purple-500/5 border-purple-500/20",
    pink: "from-pink-500/10 to-pink-500/5 border-pink-500/20",
    orange: "from-orange-500/10 to-orange-500/5 border-orange-500/20",
  };
  const stepColors: Record<string, string> = {
    purple: "bg-purple-500 text-white",
    pink: "bg-pink-500 text-white",
    orange: "bg-orange-500 text-white",
  };
  return (
    <div className={`relative p-4 rounded-xl bg-gradient-to-b ${colors[color] || colors.purple} border transition-all hover:scale-[1.02]`}>
      <div className={`absolute -top-3 -left-2 w-7 h-7 rounded-full ${stepColors[color] || stepColors.purple} text-xs font-bold flex items-center justify-center shadow-lg`}>
        {step}
      </div>
      <div className="mt-1 mb-2 opacity-70">{icon}</div>
      <h5 className="font-semibold text-sm mb-1">{title}</h5>
      <p className="text-xs text-muted-foreground/80 leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border backdrop-blur-sm hover:border-pink-500/20 transition-all duration-300 hover:shadow-[0_0_20px_rgba(225,48,108,0.1)]">
      <div className="mb-3">{icon}</div>
      <h5 className="font-semibold text-sm mb-1">{title}</h5>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
