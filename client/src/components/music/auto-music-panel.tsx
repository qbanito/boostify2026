/**
 * Music Auto-Pilot Panel
 *
 * Active (not passive) music generation: the artist schedules automatic
 * creation of new music — weekly single, monthly album, etc. — using their
 * EXISTING songs as creative references (genre, mood, themes, lyrical DNA).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import {
  Loader2, Wand2, Trash2, Play, CalendarClock, Disc3, Music,
  CheckCircle2, XCircle, RefreshCw, Sparkles, Plus,
} from 'lucide-react';

type Cadence = 'daily' | 'weekly' | 'biweekly' | 'monthly';
type ReleaseType = 'single' | 'ep' | 'album';

interface AutoSchedule {
  id: number;
  enabled: boolean;
  cadence: Cadence;
  releaseType: ReleaseType;
  songsPerRun: number;
  referenceSongIds: number[] | null;
  styleNotes: string | null;
  autoPublish: boolean;
  generateCover: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
}

interface AutoRun {
  id: number;
  scheduleId: number;
  status: 'running' | 'completed' | 'partial' | 'failed';
  releaseType: string | null;
  songIds: number[] | null;
  releaseId: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface CatalogSong {
  id: number;
  title: string;
  genre: string | null;
  mood: string | null;
  coverArt: string | null;
}

const CADENCE_OPTIONS: { id: Cadence; label: string; hint: string }[] = [
  { id: 'daily', label: 'Daily', hint: 'Every day' },
  { id: 'weekly', label: 'Weekly', hint: 'New single every week' },
  { id: 'biweekly', label: 'Biweekly', hint: 'Every 2 weeks' },
  { id: 'monthly', label: 'Monthly', hint: 'Monthly album/EP' },
];

const TYPE_OPTIONS: { id: ReleaseType; label: string; defaultSongs: number }[] = [
  { id: 'single', label: 'Single', defaultSongs: 1 },
  { id: 'ep', label: 'EP', defaultSongs: 4 },
  { id: 'album', label: 'Album', defaultSongs: 8 },
];

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AutoMusicPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Data ──
  const { data: schedData, isLoading } = useQuery({
    queryKey: ['music-auto-schedules'],
    queryFn: () => apiRequest('GET', '/api/music-auto/schedules'),
    refetchInterval: (q: any) => {
      const runs: AutoRun[] = q?.state?.data?.runs || [];
      return runs.some(r => r.status === 'running') ? 10_000 : false;
    },
  });
  const { data: songsData } = useQuery({
    queryKey: ['music-auto-my-songs'],
    queryFn: () => apiRequest('GET', '/api/music-auto/my-songs'),
  });

  const schedules: AutoSchedule[] = schedData?.schedules || [];
  const runs: AutoRun[] = schedData?.runs || [];
  const catalog: CatalogSong[] = songsData?.songs || [];

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [cadence, setCadence] = useState<Cadence>('weekly');
  const [releaseType, setReleaseType] = useState<ReleaseType>('single');
  const [songsPerRun, setSongsPerRun] = useState(1);
  const [styleNotes, setStyleNotes] = useState('');
  const [autoPublish, setAutoPublish] = useState(true);
  const [generateCover, setGenerateCover] = useState(true);
  const [refIds, setRefIds] = useState<number[]>([]);

  const resetForm = () => {
    setEditingId(null);
    setCadence('weekly');
    setReleaseType('single');
    setSongsPerRun(1);
    setStyleNotes('');
    setAutoPublish(true);
    setGenerateCover(true);
    setRefIds([]);
  };

  const openEdit = (s: AutoSchedule) => {
    setEditingId(s.id);
    setCadence(s.cadence);
    setReleaseType(s.releaseType);
    setSongsPerRun(s.songsPerRun);
    setStyleNotes(s.styleNotes || '');
    setAutoPublish(s.autoPublish);
    setGenerateCover(s.generateCover);
    setRefIds(s.referenceSongIds || []);
    setShowForm(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['music-auto-schedules'] });

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/music-auto/schedules', {
        id: editingId || undefined,
        cadence,
        releaseType,
        songsPerRun,
        referenceSongIds: refIds,
        styleNotes: styleNotes.trim() || null,
        autoPublish,
        generateCover,
        enabled: true,
      }),
    onSuccess: () => {
      toast({ title: '✅ Auto-Pilot saved', description: 'Your music will now generate itself on schedule.' });
      setShowForm(false);
      resetForm();
      invalidate();
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e?.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (s: AutoSchedule) =>
      apiRequest('POST', '/api/music-auto/schedules', {
        id: s.id,
        cadence: s.cadence,
        releaseType: s.releaseType,
        songsPerRun: s.songsPerRun,
        referenceSongIds: s.referenceSongIds || [],
        styleNotes: s.styleNotes,
        autoPublish: s.autoPublish,
        generateCover: s.generateCover,
        enabled: !s.enabled,
      }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: 'Update failed', description: e?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/music-auto/schedules/${id}`),
    onSuccess: () => {
      toast({ title: 'Schedule deleted' });
      invalidate();
    },
    onError: (e: any) => toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' }),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/music-auto/schedules/${id}/run-now`),
    onSuccess: () => {
      toast({ title: '🎵 Generation started', description: 'New songs will appear in your profile in a few minutes.' });
      invalidate();
    },
    onError: (e: any) => toast({ title: 'Run failed', description: e?.message, variant: 'destructive' }),
  });

  const toggleRef = (id: number) =>
    setRefIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const statusBadge = (status: string | null) => {
    if (status === 'running') return <span className="inline-flex items-center gap-1 text-amber-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Running</span>;
    if (status === 'completed') return <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
    if (status === 'partial') return <span className="inline-flex items-center gap-1 text-yellow-400 text-xs"><CheckCircle2 className="w-3 h-3" /> Partial</span>;
    if (status === 'failed') return <span className="inline-flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3 h-3" /> Failed</span>;
    return <span className="text-white/30 text-xs">Never run</span>;
  };

  return (
    <div className="space-y-8">
      {/* ── Existing schedules ── */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-white/40 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading schedules…</div>
      ) : schedules.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-3" />
          <h3 className="text-white font-semibold text-lg mb-1">Your music, on auto-pilot</h3>
          <p className="text-white/40 text-sm max-w-md mx-auto mb-5">
            Schedule a weekly single or a monthly album. New songs are generated automatically
            using your existing tracks as creative references — same DNA, fresh music.
          </p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-purple-600 hover:bg-purple-500 text-white">
            <Wand2 className="w-4 h-4 mr-2" /> Create Auto-Pilot Schedule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => (
            <div key={s.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${s.enabled ? 'bg-purple-500/20 border-purple-500/30' : 'bg-white/[0.04] border-white/[0.08]'}`}>
                    {s.releaseType === 'single' ? <Music className={`w-5 h-5 ${s.enabled ? 'text-purple-400' : 'text-white/30'}`} /> : <Disc3 className={`w-5 h-5 ${s.enabled ? 'text-purple-400' : 'text-white/30'}`} />}
                  </div>
                  <div>
                    <div className="text-white font-medium capitalize">
                      {s.cadence} {s.releaseType} <span className="text-white/40 font-normal">· {s.songsPerRun} song{s.songsPerRun > 1 ? 's' : ''}/run</span>
                    </div>
                    <div className="text-white/40 text-xs flex items-center gap-2 mt-0.5">
                      <CalendarClock className="w-3 h-3" /> Next: {fmtDate(s.nextRunAt)} · Last: {fmtDate(s.lastRunAt)} · {statusBadge(s.lastRunStatus)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="border-white/10 text-white/70 hover:text-white"
                    onClick={() => runNowMutation.mutate(s.id)}
                    disabled={runNowMutation.isPending || s.lastRunStatus === 'running'}>
                    {s.lastRunStatus === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    <span className="ml-1.5">Run Now</span>
                  </Button>
                  <Button size="sm" variant="outline" className="border-white/10 text-white/70 hover:text-white" onClick={() => openEdit(s)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline"
                    className={`border-white/10 ${s.enabled ? 'text-emerald-400' : 'text-white/40'}`}
                    onClick={() => toggleMutation.mutate(s)} disabled={toggleMutation.isPending}>
                    {s.enabled ? 'ON' : 'OFF'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400/60 hover:text-red-400"
                    onClick={() => { if (confirm('Delete this schedule?')) deleteMutation.mutate(s.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {s.lastError && s.lastRunStatus === 'failed' && (
                <div className="mt-3 text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {s.lastError}
                </div>
              )}
            </div>
          ))}
          {!showForm && (
            <Button variant="outline" className="border-white/10 text-white/60 hover:text-white w-full"
              onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add another schedule
            </Button>
          )}
        </div>
      )}

      {/* ── Create / edit form ── */}
      {showForm && (
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-6 space-y-6">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-purple-400" />
            {editingId ? 'Edit schedule' : 'New Auto-Pilot schedule'}
          </h3>

          {/* Cadence */}
          <div>
            <div className="text-white/50 text-xs uppercase tracking-wider mb-2">Frequency</div>
            <div className="flex flex-wrap gap-2">
              {CADENCE_OPTIONS.map(c => (
                <button key={c.id} onClick={() => setCadence(c.id)}
                  className={`px-4 py-2 rounded-xl text-sm border transition-all ${cadence === c.id ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white'}`}>
                  <div className="font-medium">{c.label}</div>
                  <div className="text-[10px] opacity-60">{c.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Release type */}
          <div>
            <div className="text-white/50 text-xs uppercase tracking-wider mb-2">Release type</div>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map(t => (
                <button key={t.id}
                  onClick={() => { setReleaseType(t.id); setSongsPerRun(t.defaultSongs); }}
                  className={`px-4 py-2 rounded-xl text-sm border transition-all ${releaseType === t.id ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white'}`}>
                  {t.label} <span className="opacity-60">({t.defaultSongs} song{t.defaultSongs > 1 ? 's' : ''})</span>
                </button>
              ))}
              <div className="flex items-center gap-2 ml-2">
                <span className="text-white/40 text-xs">Songs per run:</span>
                <input type="number" min={1} max={10} value={songsPerRun}
                  onChange={e => setSongsPerRun(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1.5 text-white text-sm text-center" />
              </div>
            </div>
          </div>

          {/* Reference songs */}
          <div>
            <div className="text-white/50 text-xs uppercase tracking-wider mb-2">
              Reference songs <span className="normal-case text-white/30">— leave empty to use your latest tracks automatically</span>
            </div>
            {catalog.length === 0 ? (
              <div className="text-white/30 text-sm">No published songs in your catalog yet — your first songs will become the references.</div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
                {catalog.map(song => (
                  <button key={song.id} onClick={() => toggleRef(song.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-all ${refIds.includes(song.id) ? 'bg-purple-600/80 border-purple-500 text-white' : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white'}`}>
                    {song.coverArt && <img src={song.coverArt} alt="" className="w-5 h-5 rounded object-cover" />}
                    {song.title}
                    {song.genre && <span className="opacity-50">· {song.genre}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Style notes */}
          <div>
            <div className="text-white/50 text-xs uppercase tracking-wider mb-2">Creative direction (optional)</div>
            <textarea value={styleNotes} onChange={e => setStyleNotes(e.target.value)} rows={2}
              placeholder="e.g. More uptempo than my last EP, summer vibes, feature darker synths…"
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 resize-none" />
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
              <input type="checkbox" checked={autoPublish} onChange={e => setAutoPublish(e.target.checked)} className="accent-purple-500" />
              Auto-publish to profile
            </label>
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
              <input type="checkbox" checked={generateCover} onChange={e => setGenerateCover(e.target.checked)} className="accent-purple-500" />
              Generate cover art
            </label>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="bg-purple-600 hover:bg-purple-500 text-white">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {editingId ? 'Save changes' : 'Activate Auto-Pilot'}
            </Button>
            <Button variant="ghost" className="text-white/40 hover:text-white" onClick={() => { setShowForm(false); resetForm(); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Run history ── */}
      {runs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white/60 text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Recent runs
            </h3>
          </div>
          <div className="space-y-2">
            {runs.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-3">
                  {statusBadge(r.status)}
                  <span className="text-white/60 text-sm capitalize">{r.releaseType || 'single'}</span>
                  {r.songIds && r.songIds.length > 0 && (
                    <span className="text-white/30 text-xs">{r.songIds.length} song{r.songIds.length > 1 ? 's' : ''} created</span>
                  )}
                  {r.releaseId && <span className="text-purple-400/70 text-xs">· packaged as release #{r.releaseId}</span>}
                </div>
                <span className="text-white/25 text-xs">{fmtDate(r.startedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
