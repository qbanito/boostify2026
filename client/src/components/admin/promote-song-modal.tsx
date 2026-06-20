import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import {
  Rocket,
  Image as ImageIcon,
  Video,
  Captions,
  Megaphone,
  Hash,
  Loader2,
  Copy,
  CheckCircle2,
  Sparkles,
  Flame,
  BarChart2,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';
import { CinematicPromoCard } from './cinematic-promo-card';
import { ChallengeEngineCard } from './challenge-engine-card';

interface PromoteSongModalProps {
  songId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface CaptionItem {
  platform: string;
  caption: string;
  hashtags: string[];
}

export function PromoteSongModal({
  songId,
  open,
  onOpenChange,
}: PromoteSongModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'engines' | 'content' | 'cover'>('engines');
  const [coverPrompt, setCoverPrompt] = useState('');
  const [generatedCovers, setGeneratedCovers] = useState<
    Array<{ url: string; provider?: string; prompt: string }>
  >([]);
  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['admin-song-analysis', 'detail', songId],
    enabled: open,
    queryFn: async () =>
      (await apiRequest(`/api/admin/song-analysis/songs/${songId}`, {
        method: 'GET',
      })) as { ok: boolean; song: any },
  });

  const promoPrompts = useQuery({
    queryKey: ['admin-song-analysis', 'promo-prompts', songId],
    enabled: open,
    queryFn: async () =>
      (await apiRequest(
        `/api/admin/song-analysis/songs/${songId}/promo-prompts`,
        { method: 'POST' },
      )) as { ok: boolean; prompts: any },
  });

  const song = detail.data?.song;
  const songArtist = (detail.data as any)?.artist;
  const insights = song?.analysisJson?.insights;
  const prompts = promoPrompts.data?.prompts;
  const postgresArtistId = Number(
    song?.userId ?? song?.artistId ?? songArtist?.id ?? 0,
  ) || undefined;
  const insightThemes = [
    ...((insights?.themes as string[] | undefined) || []),
    ...((insights?.mood as string[] | undefined) || []),
  ].slice(0, 8);
  const marketingAngles = (insights?.marketingAngles as string[] | undefined) || [];
  const syncOpportunities = (insights?.syncOpportunities as string[] | undefined) || [];
  const insightHashtags = (insights?.hashtags as string[] | undefined) || [];

  const coverMutation = useMutation({
    mutationFn: async (vars: { prompt?: string; aspectRatio?: string }) => {
      const r: any = await apiRequest(
        `/api/admin/song-analysis/songs/${songId}/cover`,
        { method: 'POST', data: vars },
      );
      return r as { ok: boolean; imageUrl: string; provider: string; prompt: string };
    },
    onSuccess: (data) => {
      if (data?.imageUrl) {
        setGeneratedCovers((prev) => [
          { url: data.imageUrl, provider: data.provider, prompt: data.prompt },
          ...prev,
        ]);
        toast({
          title: 'Cover generated',
          description: `via ${data.provider || 'AI'}`,
        });
      }
    },
    onError: (err: any) =>
      toast({
        title: 'Cover generation failed',
        description: err?.message || 'Provider error',
        variant: 'destructive',
      }),
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const r: any = await apiRequest(
        `/api/admin/song-analysis/songs/${songId}/analyze`,
        { method: 'POST' },
      );
      return r as { ok: boolean; song: any };
    },
    onSuccess: async () => {
      toast({ title: 'Analysis complete' });
      await queryClient.invalidateQueries({
        queryKey: ['admin-song-analysis', 'detail', songId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['admin-song-analysis', 'promo-prompts', songId],
      });
    },
    onError: (err: any) =>
      toast({
        title: 'Analyzer failed',
        description: err?.message || 'Pipeline error',
        variant: 'destructive',
      }),
  });

  const captionsMutation = useMutation({
    mutationFn: async () => {
      const r: any = await apiRequest(
        `/api/admin/song-analysis/songs/${songId}/captions`,
        {
          method: 'POST',
          data: {
            platforms: ['instagram', 'tiktok', 'twitter', 'youtube_shorts', 'facebook'],
          },
        },
      );
      return r as { ok: boolean; captions: CaptionItem[] };
    },
    onSuccess: (data) => {
      setCaptions(data?.captions || []);
      toast({ title: `${data.captions?.length || 0} captions generated` });
    },
    onError: (err: any) =>
      toast({
        title: 'Captions failed',
        description: err?.message || 'OpenAI error',
        variant: 'destructive',
      }),
  });

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const TABS = [
    { id: 'engines' as const, label: 'AI Engines', icon: Rocket },
    { id: 'content' as const, label: 'Smart Content', icon: Sparkles },
    { id: 'cover' as const, label: 'Cover Art', icon: ImageIcon },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[100vw] sm:w-[95vw] h-[100dvh] sm:h-[92vh] bg-[#0a0a0f] border-orange-500/20 text-white overflow-hidden flex flex-col p-0 rounded-none sm:rounded-xl"
      >
        {/* ── Header ── */}
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 pb-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-white flex-wrap">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/20 shrink-0">
                  <Rocket className="h-4 w-4 text-orange-400" />
                </div>
                <span className="truncate">{song?.title || `Song #${songId}`}</span>
                <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30 text-[10px] font-semibold uppercase tracking-wide">
                  Promote
                </Badge>
              </DialogTitle>
              {song && (
                <p className="text-xs text-slate-500 mt-1 ml-11">
                  {song.genre ? `${song.genre} · ` : ''}{song.releaseDate ? new Date(song.releaseDate).getFullYear() : ''}
                  {postgresArtistId ? ` · Artist #${postgresArtistId}` : ''}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── Tab Nav ── */}
        <div className="shrink-0 px-4 sm:px-6 pt-3 pb-0 border-b border-white/5">
          <div className="flex gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-all ${
                  activeTab === id
                    ? 'text-orange-300 bg-orange-500/10'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {activeTab === id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {detail.isLoading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading song data…
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 sm:px-6 py-5 space-y-4">

              {/* ── TAB: AI ENGINES ── */}
              {activeTab === 'engines' && (
                <div className="space-y-4">
                  <CinematicPromoCard songId={songId} artistId={postgresArtistId} />
                  <ChallengeEngineCard
                    songId={songId}
                    artistId={postgresArtistId}
                    songTitle={song?.title}
                  />
                </div>
              )}

              {/* ── TAB: SMART CONTENT ── */}
              {activeTab === 'content' && (
                <div className="space-y-4">
                  {/* Analyzer */}
                  <SectionCard title="Song Insights" icon={Sparkles} accent="yellow">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-xs text-slate-400">
                        {insights
                          ? 'AI-powered mood, themes, and marketing intelligence for this track.'
                          : 'Run the analyzer to generate mood, themes, and auto-prompts.'}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => analyzeMutation.mutate()}
                        disabled={analyzeMutation.isPending}
                        className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs px-3 shrink-0"
                      >
                        {analyzeMutation.isPending ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Analyzing…</>
                        ) : (
                          <><Sparkles className="h-3 w-3 mr-1.5" />{insights ? 'Re-analyze' : 'Run Analyzer'}</>
                        )}
                      </Button>
                    </div>
                    {insights ? (
                      <div className="space-y-3 pt-1">
                        <p className="text-sm text-slate-200 leading-relaxed">{insights.summary}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {insightThemes.map((t: string, i: number) => (
                            <Badge key={i} className="bg-orange-500/15 text-orange-300 border-orange-500/30 text-xs">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </SectionCard>

                  {/* Social Captions */}
                  <SectionCard title="Social Captions" icon={Captions} accent="cyan">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-xs text-slate-400">
                        {captions.length > 0
                          ? `${captions.length} captions ready across all platforms.`
                          : 'Generate platform-ready captions for Instagram, TikTok, YouTube Shorts and more.'}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => captionsMutation.mutate()}
                        disabled={captionsMutation.isPending}
                        className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs px-3 shrink-0"
                      >
                        {captionsMutation.isPending ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Generating…</>
                        ) : (
                          <><Sparkles className="h-3 w-3 mr-1.5" />Generate captions</>
                        )}
                      </Button>
                    </div>
                    {captions.length > 0 && (
                      <div className="space-y-2.5 pt-2">
                        {captions.map((c, i) => {
                          const text = `${c.caption}${c.hashtags?.length ? '\n\n' + c.hashtags.map((h) => (h.startsWith('#') ? h : '#' + h)).join(' ') : ''}`;
                          const key = `cap-${i}`;
                          return (
                            <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs font-medium uppercase tracking-wide">
                                  {c.platform}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copy(text, key)}
                                  className="text-slate-400 hover:text-white h-7 w-7 p-0"
                                >
                                  {copiedKey === key ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                              <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">{c.caption}</p>
                              {c.hashtags?.length ? (
                                <div className="flex flex-wrap gap-1 mt-2.5">
                                  {c.hashtags.map((h, hi) => (
                                    <Badge key={hi} className="bg-pink-500/15 text-pink-300 border-pink-500/30 text-xs">
                                      {h.startsWith('#') ? h : '#' + h}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>

                  {/* Marketing / Sync grid */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <SectionCard title="Marketing Angles" icon={Megaphone} compact>
                      {marketingAngles.length > 0 ? (
                        <ul className="space-y-1.5">
                          {marketingAngles.map((m: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                              {m}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">Run Song Insights to populate.</p>
                      )}
                    </SectionCard>
                    <SectionCard title="Sync Opportunities" icon={BarChart2} compact>
                      {syncOpportunities.length > 0 ? (
                        <ul className="space-y-1.5">
                          {syncOpportunities.map((m: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                              {m}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">Run Song Insights to populate.</p>
                      )}
                    </SectionCard>
                  </div>

                  {/* Hashtags */}
                  <SectionCard title="Recommended Hashtags" icon={Hash} compact>
                    {insightHashtags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {insightHashtags.map((h: string, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => copy(h.startsWith('#') ? h : '#' + h, `tag-${i}`)}
                            className="inline-flex items-center gap-1 bg-pink-500/15 text-pink-300 border border-pink-500/30 text-xs px-2 py-1 rounded-full hover:bg-pink-500/25 transition-colors"
                          >
                            {copiedKey === `tag-${i}` ? <CheckCircle2 className="h-3 w-3" /> : null}
                            {h.startsWith('#') ? h : '#' + h}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Run Song Insights to populate hashtags.</p>
                    )}
                  </SectionCard>

                  {/* Video Concepts */}
                  {(prompts?.imagePrompts || []).length > 0 && (
                    <SectionCard title="Video Concepts" icon={Video}>
                      <div className="space-y-2.5">
                        {(prompts.imagePrompts as { concept: string; prompt: string }[]).map((p, i) => {
                          const key = `vc-${i}`;
                          return (
                            <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-medium text-orange-300 truncate">{p.concept}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copy(p.prompt, key)}
                                  className="text-slate-400 hover:text-white h-7 w-7 p-0 shrink-0"
                                >
                                  {copiedKey === key ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">{p.prompt}</p>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>
                  )}
                </div>
              )}

              {/* ── TAB: COVER ART ── */}
              {activeTab === 'cover' && (
                <div className="space-y-4">
                  <SectionCard title="AI Cover Generator" icon={ImageIcon} accent="purple">
                    <Textarea
                      value={coverPrompt}
                      onChange={(e) => setCoverPrompt(e.target.value)}
                      placeholder="Optional custom prompt. Leave empty to auto-generate from song insights."
                      className="bg-white/5 border-white/10 text-white text-sm min-h-[72px] resize-none placeholder:text-slate-600"
                    />
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(['1:1', '9:16', '16:9', '4:5'] as const).map((ar) => (
                        <Button
                          key={ar}
                          size="sm"
                          variant="outline"
                          disabled={coverMutation.isPending}
                          onClick={() => coverMutation.mutate({ prompt: coverPrompt || undefined, aspectRatio: ar })}
                          className="border-white/15 text-slate-300 hover:border-orange-500/50 hover:text-white h-9 text-xs gap-1.5"
                        >
                          {coverMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                          )}
                          {ar}
                        </Button>
                      ))}
                    </div>
                  </SectionCard>

                  {generatedCovers.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {generatedCovers.map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative block rounded-lg overflow-hidden border border-white/10 hover:border-orange-500/40 transition-colors"
                        >
                          <img
                            src={c.url}
                            alt="Generated cover"
                            className="w-full aspect-square object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <Badge className="absolute top-2 right-2 bg-black/70 text-white text-[10px] border-0">
                            {c.provider || 'AI'}
                          </Badge>
                        </a>
                      ))}
                    </div>
                  )}

                  {generatedCovers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/10 rounded-xl">
                      <ImageIcon className="h-10 w-10 text-slate-700 mb-3" />
                      <p className="text-sm text-slate-500">No covers generated yet.</p>
                      <p className="text-xs text-slate-600 mt-1">Choose an aspect ratio above to generate.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  compact,
  accent = 'orange',
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  compact?: boolean;
  accent?: 'orange' | 'yellow' | 'cyan' | 'purple' | 'pink';
}) {
  const accentMap: Record<string, string> = {
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    pink: 'text-pink-400',
  };
  return (
    <div className={`bg-white/[0.03] border border-white/8 rounded-xl ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'} space-y-3`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${accentMap[accent]}`} />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default PromoteSongModal;
