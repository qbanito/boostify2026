import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";

export interface SpotifyConnection {
  id: number;
  userId: number;
  spotifyUsername: string | null;
  monthlyListeners: number;
  followers: number;
  totalStreams: number;
  playlistCount: number;
  topCities: any[];
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface SpotifySnapshot {
  id: number;
  connectionId: number;
  monthlyListeners: number;
  followers: number;
  totalStreams: number;
  topTracks: any[];
  topCities: any[];
  playlistCount: number;
  snapshotAt: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function useSpotifyConnection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const userId = user?.id;

  const { data: connData, isLoading: connLoading } = useQuery({
    queryKey: ["/api/spotify-ext/status", userId],
    queryFn: async () => {
      const res = await fetch(`/api/spotify-ext/status/${userId}`);
      if (!res.ok) return { connections: [] };
      return res.json();
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const connection: SpotifyConnection | null = connData?.connections?.[0] || connData?.connection || null;

  const { data: snapData, isLoading: snapLoading } = useQuery({
    queryKey: ["/api/spotify-ext/snapshots", connection?.id],
    queryFn: async () => {
      const res = await fetch(`/api/spotify-ext/snapshots/${connection!.id}`);
      if (!res.ok) return { snapshots: [] };
      return res.json();
    },
    enabled: !!connection?.id,
    staleTime: 30_000,
  });

  const snapshots: SpotifySnapshot[] = snapData?.snapshots || [];
  const latestSnapshot = snapshots[0] || null;

  const { data: actData, isLoading: actLoading } = useQuery({
    queryKey: ["/api/spotify-ext/pending-actions", connection?.id],
    queryFn: async () => {
      const res = await fetch(`/api/spotify-ext/pending-actions?connectionId=${connection!.id}`);
      if (!res.ok) return { actions: [] };
      return res.json();
    },
    enabled: !!connection?.id,
    staleTime: 15_000,
  });

  const pendingActions = actData?.actions || [];

  const queueAction = useMutation({
    mutationFn: async (params: { actionType: string; payload: any; priority?: number }) => {
      if (!connection) throw new Error("No Spotify connection");
      const res = await fetch("/api/spotify-ext/create-action", {
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
      qc.invalidateQueries({ queryKey: ["/api/spotify-ext/pending-actions"] });
      toast({ title: "Queued to Extension", description: "Action will execute on next sync." });
    },
  });

  const executeAiAction = useMutation({
    mutationFn: async (params: { action: string; inputParams?: Record<string, any> }) => {
      const res = await fetch("/api/spotify/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: params.action,
          params: { ...params.inputParams, artistId: userId },
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
      qc.invalidateQueries({ queryKey: ["/api/spotify-ext/status"] });
      qc.invalidateQueries({ queryKey: ["/api/spotify-ext/snapshots"] });
      qc.invalidateQueries({ queryKey: ["/api/spotify-ext/pending-actions"] });
    },
  };
}
