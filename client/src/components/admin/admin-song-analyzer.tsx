import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Music,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Eye,
  Rocket,
  Search,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';
import { SongAnalysisViewer } from './song-analysis-viewer';
import { PromoteSongModal } from './promote-song-modal';

interface AdminSongRow {
  id: number;
  userId: number;
  title: string;
  genre: string | null;
  mood: string | null;
  coverArt: string | null;
  audioUrl: string;
  analysisStatus: 'pending' | 'processing' | 'ready' | 'failed' | null;
  analyzedAt: string | null;
  analysisError: string | null;
  createdAt: string;
  artistName: string | null;
  artistEmail: string | null;
}

const STATUS_META: Record<
  string,
  { label: string; cls: string; icon: any }
> = {
  ready: {
    label: 'Ready',
    cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    icon: CheckCircle2,
  },
  processing: {
    label: 'Analyzing…',
    cls: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    icon: Loader2,
  },
  pending: {
    label: 'Pending',
    cls: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
    icon: Clock,
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-500/20 text-red-300 border border-red-500/30',
    icon: XCircle,
  },
  none: {
    label: 'Not analyzed',
    cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
    icon: AlertCircle,
  },
};

type StatusFilter = 'all' | 'analyzed' | 'pending' | 'failed' | 'processing';

export function AdminSongAnalyzer() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewerSongId, setViewerSongId] = useState<number | null>(null);
  const [promoteSongId, setPromoteSongId] = useState<number | null>(null);
  const PAGE_SIZE = 50;

  // Debounce search → server
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const listQuery = useQuery({
    queryKey: ['admin-song-analysis', 'list', statusFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set('q', debouncedSearch);
      const r = await apiRequest(
        `/api/admin/song-analysis/songs?${params.toString()}`,
        { method: 'GET' },
      );
      return r as {
        ok: boolean;
        count: number;
        songs: AdminSongRow[];
        hasMore?: boolean;
      };
    },
    refetchInterval: (q) => {
      const data = q.state.data as { songs?: AdminSongRow[] } | undefined;
      const anyProcessing = (data?.songs || []).some(
        (s) => s.analysisStatus === 'processing',
      );
      return anyProcessing ? 4000 : false;
    },
    placeholderData: (prev) => prev, // keep old rows visible while typing
  });

  const analyzeMutation = useMutation({
    mutationFn: async (vars: { songId: number; force?: boolean }) => {
      return apiRequest(`/api/admin/song-analysis/songs/${vars.songId}/analyze`, {
        method: 'POST',
        data: { force: vars.force === true },
      });
    },
    onSuccess: (data: any, vars) => {
      const cached = data?.cached;
      toast({
        title: cached ? 'Already analyzed' : 'Analysis queued',
        description: cached
          ? 'Using cached result. Use Regenerate to force re-analysis.'
          : `Song #${vars.songId} is being analyzed in the background. This usually takes 1–2 minutes.`,
      });
      qc.invalidateQueries({ queryKey: ['admin-song-analysis', 'list'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Analysis failed',
        description: err?.message || 'Could not trigger analysis',
        variant: 'destructive',
      });
    },
  });

  const songs = listQuery.data?.songs || [];
  const filtered = songs; // server already filtered + searched

  const counts = useMemo(() => {
    const c = { ready: 0, processing: 0, pending: 0, failed: 0, none: 0 };
    for (const s of songs) {
      const k = (s.analysisStatus || 'none') as keyof typeof c;
      if (k in c) c[k]++;
    }
    return c;
  }, [songs]);

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/40 border-orange-500/20">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Music className="h-5 w-5 text-orange-400" />
              Song Analyzer
              <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/30">
                AI · Whisper + GPT-4o
              </Badge>
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => listQuery.refetch()}
              disabled={listQuery.isFetching}
              className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1 ${listQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            {(['all', 'analyzed', 'processing', 'pending', 'failed'] as const).map(
              (f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={statusFilter === f ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(f)}
                  className={
                    statusFilter === f
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'border-slate-700 text-slate-300'
                  }
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ),
            )}
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> {counts.ready} ready
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-400" /> {counts.processing} processing
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-400" /> {counts.failed} failed
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-500" /> {counts.none + counts.pending} queue
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search by title, artist or genre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-950 border-slate-800 text-white"
            />
          </div>

          <ScrollArea className="h-[60vh] rounded-md border border-slate-800">
            <div className="divide-y divide-slate-800">
              {listQuery.isLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading songs…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No songs match the current filter.
                </div>
              ) : (
                filtered.map((song) => {
                  const statusKey = (song.analysisStatus || 'none') as keyof typeof STATUS_META;
                  const meta = STATUS_META[statusKey] || STATUS_META.none;
                  const Icon = meta.icon;
                  const isProcessing = song.analysisStatus === 'processing';
                  const isReady = song.analysisStatus === 'ready';
                  return (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-800/30"
                    >
                      <div className="h-10 w-10 rounded bg-slate-800 overflow-hidden flex-shrink-0">
                        {song.coverArt ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={song.coverArt}
                            alt={song.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Music className="h-5 w-5 text-slate-500 m-auto mt-2.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">
                          {song.title}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {song.artistName || song.artistEmail || `User #${song.userId}`}
                          {song.genre ? ` · ${song.genre}` : ''}
                        </div>
                      </div>
                      <Badge className={meta.cls + ' flex items-center gap-1'}>
                        <Icon
                          className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`}
                        />
                        {meta.label}
                      </Badge>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewerSongId(song.id)}
                          disabled={!isReady}
                          title={isReady ? 'View analysis' : 'Analyze first to view JSON'}
                          className="text-slate-300 hover:text-white"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            analyzeMutation.mutate({ songId: song.id, force: isReady })
                          }
                          disabled={isProcessing || analyzeMutation.isPending}
                          title={isReady ? 'Regenerate analysis' : 'Analyze this song'}
                          className="text-orange-300 hover:text-orange-200"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setPromoteSongId(song.id)}
                          disabled={!isReady}
                          title={isReady ? 'Promote with AI' : 'Analyze first'}
                          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 h-7 text-xs"
                        >
                          <Rocket className="h-3 w-3 mr-1" />
                          Promote
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {viewerSongId !== null && (
        <SongAnalysisViewer
          songId={viewerSongId}
          open={true}
          onOpenChange={(o) => !o && setViewerSongId(null)}
        />
      )}
      {promoteSongId !== null && (
        <PromoteSongModal
          songId={promoteSongId}
          open={true}
          onOpenChange={(o) => !o && setPromoteSongId(null)}
        />
      )}
    </div>
  );
}

export default AdminSongAnalyzer;
