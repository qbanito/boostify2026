import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, Music, Disc, Sparkles, FileJson, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';

interface SongAnalysisViewerProps {
  songId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function SongAnalysisViewer({
  songId,
  open,
  onOpenChange,
}: SongAnalysisViewerProps) {
  const query = useQuery({
    queryKey: ['admin-song-analysis', 'detail', songId],
    enabled: open,
    queryFn: async () => {
      const r: any = await apiRequest(`/api/admin/song-analysis/songs/${songId}`, {
        method: 'GET',
      });
      return r as { ok: boolean; song: any; artist: any };
    },
  });

  const song = query.data?.song;
  const analysis = song?.analysisJson || null;
  const insights = analysis?.insights || null;
  const audio = analysis?.audio || null;
  const fal = analysis?.fal || null;

  const lyricsText = useMemo(() => {
    return audio?.transcription?.text || fal?.text || song?.lyrics || '';
  }, [audio, fal, song]);

  const segments: Array<{ start?: number; end?: number; text: string }> =
    audio?.transcription?.segments || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-slate-950 border-orange-500/30 text-white max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-orange-400" />
            {song?.title || `Song #${songId}`}
            {analysis?.pipelineVersion && (
              <Badge className="bg-slate-800 text-slate-300 text-xs">
                v{analysis.pipelineVersion}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading analysis…
          </div>
        ) : !song ? (
          <div className="p-8 text-center text-slate-400">Song not found.</div>
        ) : !analysis ? (
          <div className="p-8 text-center text-slate-400">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-yellow-400" />
            No analysis yet. Trigger one from the Analyzer panel.
          </div>
        ) : (
          <Tabs defaultValue="insights" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="bg-slate-900 border border-slate-800">
              <TabsTrigger value="insights">
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Insights
              </TabsTrigger>
              <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
              <TabsTrigger value="audio">
                <Disc className="h-3.5 w-3.5 mr-1" /> Audio
              </TabsTrigger>
              <TabsTrigger value="raw">
                <FileJson className="h-3.5 w-3.5 mr-1" /> Raw JSON
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-3 pr-3">
              <TabsContent value="insights" className="mt-0 space-y-4">
                {insights ? (
                  <>
                    <Section title="Summary">
                      <p className="text-sm text-slate-200">{insights.summary}</p>
                    </Section>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Section title="Themes">
                        <TagList items={insights.themes} color="orange" />
                      </Section>
                      <Section title="Mood">
                        <TagList items={insights.mood} color="purple" />
                      </Section>
                      <Section title="Target audience">
                        <p className="text-sm text-slate-300">{insights.targetAudience}</p>
                      </Section>
                      <Section title="Recommended platforms">
                        <TagList items={insights.recommendedPlatforms} color="cyan" />
                      </Section>
                    </div>
                    <Section title="Video concepts">
                      <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                        {insights.videoConcepts?.map((c: string, i: number) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </Section>
                    <Section title="Marketing angles">
                      <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                        {insights.marketingAngles?.map((c: string, i: number) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </Section>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Section title="Sync opportunities">
                        <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                          {insights.syncOpportunities?.map((c: string, i: number) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </Section>
                      <Section title="Hashtags">
                        <TagList items={insights.hashtags} color="pink" />
                      </Section>
                    </div>
                    <Section title="Emotional arc">
                      <p className="text-sm text-slate-300 whitespace-pre-line">
                        {insights.emotionalArc}
                      </p>
                    </Section>
                  </>
                ) : (
                  <p className="text-slate-400 text-sm">
                    Insights step did not return data. Check Raw JSON for errors.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="lyrics" className="mt-0 space-y-3">
                {segments.length > 0 ? (
                  <div className="space-y-1 text-sm">
                    {segments.map((seg, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-orange-400/60 font-mono text-xs w-16 flex-shrink-0">
                          {fmtTime(seg.start)}
                        </span>
                        <span className="text-slate-200">{seg.text}</span>
                      </div>
                    ))}
                  </div>
                ) : lyricsText ? (
                  <p className="text-slate-200 whitespace-pre-line text-sm leading-relaxed">
                    {lyricsText}
                  </p>
                ) : (
                  <p className="text-slate-400 text-sm">No lyrics extracted.</p>
                )}
              </TabsContent>

              <TabsContent value="audio" className="mt-0 space-y-3">
                {audio ? (
                  <div className="grid md:grid-cols-3 gap-3 text-sm">
                    <Stat label="BPM" value={audio.bpm ?? audio.tempo ?? '—'} />
                    <Stat label="Key" value={audio.key ?? '—'} />
                    <Stat label="Duration" value={fmtTime(audio.duration)} />
                    <Stat label="Energy" value={audio.energy ?? '—'} />
                    <Stat label="Mood" value={audio.mood ?? '—'} />
                    <Stat label="Genre" value={audio.genre ?? '—'} />
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No audio analysis available.</p>
                )}
                {audio?.sections?.length ? (
                  <Section title="Sections">
                    <div className="space-y-1 text-sm">
                      {audio.sections.map((s: any, i: number) => (
                        <div key={i} className="flex gap-3">
                          <span className="text-orange-400/60 font-mono text-xs w-20 flex-shrink-0">
                            {fmtTime(s.start)}–{fmtTime(s.end)}
                          </span>
                          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[10px]">
                            {s.type || s.label}
                          </Badge>
                          {s.description && (
                            <span className="text-slate-300 truncate">{s.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : null}
              </TabsContent>

              <TabsContent value="raw" className="mt-0">
                <pre className="text-[11px] text-slate-300 bg-slate-900 p-3 rounded border border-slate-800 overflow-x-auto leading-tight">
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-1.5">
        {title}
      </h4>
      {children}
    </div>
  );
}

function TagList({
  items,
  color,
}: {
  items?: string[];
  color: 'orange' | 'purple' | 'cyan' | 'pink';
}) {
  if (!items?.length) return <span className="text-slate-500 text-sm">—</span>;
  const cls: Record<string, string> = {
    orange: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    pink: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  };
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it, i) => (
        <Badge key={i} className={`${cls[color]} border text-[10px]`}>
          {it}
        </Badge>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-white truncate">
        {value === null || value === undefined || value === '' ? '—' : String(value)}
      </div>
    </div>
  );
}

function fmtTime(sec: any): string {
  const n = typeof sec === 'number' ? sec : parseFloat(sec);
  if (!Number.isFinite(n)) return '—';
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default SongAnalysisViewer;
