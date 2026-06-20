import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";

export interface IgConnection {
  id: number;
  extensionId: string;
  instagramUsername: string | null;
  displayName: string | null;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface IgSnapshot {
  id: number;
  followers: number;
  following: number;
  postsCount: number;
  engagementRate: string;
  avgLikes: number;
  avgComments: number;
  bio: string;
  isVerified: boolean;
  recentPosts: any[];
  topHashtags: string[];
  snapshotAt: string;
}

export interface IgPendingAction {
  id: number;
  actionType: string;
  payload: any;
  status: string;
  priority: string;
  generatedBy: string;
  createdAt: string;
  resultMessage?: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function useInstagramConnection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const userId = user?.id;

  // Fetch active connection
  const { data: connData, isLoading: connLoading } = useQuery({
    queryKey: ["/api/instagram-ext/status", userId],
    queryFn: async () => {
      const res = await fetch(`/api/instagram-ext/status/${userId}`);
      if (!res.ok) return { connections: [] };
      return res.json();
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const connection: IgConnection | null = connData?.connections?.[0] || null;

  // Fetch snapshots
  const { data: snapData, isLoading: snapLoading } = useQuery({
    queryKey: ["/api/instagram-ext/snapshots", connection?.id],
    queryFn: async () => {
      const res = await fetch(`/api/instagram-ext/snapshots/${connection!.id}`);
      if (!res.ok) return { snapshots: [] };
      return res.json();
    },
    enabled: !!connection?.id,
    staleTime: 30_000,
  });

  const snapshots: IgSnapshot[] = snapData?.snapshots || [];
  const latestSnapshot = snapshots[0] || null;

  // Fetch pending actions
  const { data: actData, isLoading: actLoading } = useQuery({
    queryKey: ["/api/instagram-ext/pending-actions", connection?.id],
    queryFn: async () => {
      const res = await fetch(`/api/instagram-ext/pending-actions?connectionId=${connection!.id}`);
      if (!res.ok) return { actions: [] };
      return res.json();
    },
    enabled: !!connection?.id,
    staleTime: 15_000,
  });

  const pendingActions: IgPendingAction[] = actData?.actions || [];

  // Queue an action to the extension
  const queueAction = useMutation({
    mutationFn: async (params: { actionType: string; payload: any; priority?: number }) => {
      if (!connection) throw new Error("No Instagram connection");
      const res = await fetch("/api/instagram-ext/create-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId,
          connectionId: connection.id,
          actionType: params.actionType,
          payload: { ...params.payload, source: "ai-agent" },
          generatedBy: "ai-agent",
          priority: params.priority || 3,
        }),
      });
      if (!res.ok) throw new Error("Failed to queue action");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/instagram-ext/pending-actions"] });
      toast({ title: "Queued to Extension", description: "Action will execute on next extension sync." });
    },
    onError: () => {
      toast({ title: "Queue Failed", description: "Could not send to extension. Is it connected?", variant: "destructive" });
    },
  });

  // Execute an AI action and optionally queue the result
  const executeAiAction = useMutation({
    mutationFn: async (params: { action: string; inputParams?: Record<string, any>; autoQueue?: boolean }) => {
      const res = await fetch("/api/instagram/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: params.action,
          params: { ...params.inputParams, artistId: userId },
          autoQueue: params.autoQueue || false,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Action failed");
      return res.json();
    },
  });

  return {
    userId,
    connection,
    snapshots,
    latestSnapshot,
    pendingActions,
    isConnected: !!connection && connection.status === "active",
    isLoading: connLoading || snapLoading || actLoading,
    queueAction,
    executeAiAction,
    formatNumber,
    refresh: () => {
      qc.invalidateQueries({ queryKey: ["/api/instagram-ext/status"] });
      qc.invalidateQueries({ queryKey: ["/api/instagram-ext/snapshots"] });
      qc.invalidateQueries({ queryKey: ["/api/instagram-ext/pending-actions"] });
    },
  };
}
