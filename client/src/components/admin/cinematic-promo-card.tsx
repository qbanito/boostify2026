/**
 * 🎬 CinematicPromoCard
 *
 * Plug-in card for the Promote Song modal that exposes the new
 * Promote Engine pipeline:
 *   1) Train (or check) the artist's personal LoRA
 *   2) Generate 3 distinct promo packs (cinematic / editorial / street)
 *      using flux-pro/kontext + the artist's trained character.
 *
 * All endpoints live under /api/promote-engine.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Loader2,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Film,
  Video,
  Mic,
  Play,
  Upload,
  Music,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';
import { storage } from '../../firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

interface Props {
  songId: number;
  artistId: number | null | undefined;
}

interface LoraRow {
  id: number;
  artistId: number;
  loraUrl?: string | null;
  triggerWord: string;
  status: 'pending' | 'training' | 'ready' | 'failed';
  trainingJobId?: string | null;
  referenceImages?: string[] | null;
  errorMessage?: string | null;
  createdAt?: string;
  trainedAt?: string | null;
}

interface PackResult {
  packId: string;
  styleId: string;
  styleLabel: string;
  hookLine: string;
  imageUrl: string;
  prompt: string;
  assetId: number;
  hookVideoAssetId?: number;
  hookVideoUrl?: string;
  spokenPromoAssetId?: number;
  spokenPromoUrl?: string;
  mixedPromoAssetId?: number;
  mixedPromoUrl?: string;
}

interface StylePreset {
  id: string;
  label: string;
  description: string;
}

const DEFAULT_STYLES = ['cinematic', 'editorial_photography', 'street_documentary'];

export function CinematicPromoCard({ songId, artistId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(DEFAULT_STYLES);
  const [mixingProfile, setMixingProfile] = useState<'VOICE_FOCUSED' | 'BALANCED' | 'MUSIC_FOCUSED' | 'FULL_SONG'>('BALANCED');
  const [packs, setPacks] = useState<PackResult[]>([]);

  // Style catalog
  const stylesQ = useQuery({
    queryKey: ['promote-engine', 'styles'],
    queryFn: async () =>
      (await apiRequest('/api/promote-engine/styles', { method: 'GET' })) as {
        ok: boolean;
        styles: StylePreset[];
      },
  });

  // LoRA status (polls every 6s while training)
  const loraQ = useQuery({
    queryKey: ['promote-engine', 'lora-status', artistId],
    enabled: !!artistId,
    refetchInterval: (q) => {
      const data = q.state.data as { lora?: LoraRow } | undefined;
      return data?.lora?.status === 'training' ? 6000 : false;
    },
    queryFn: async () =>
      (await apiRequest(`/api/promote-engine/artist-style/${artistId}/status`, {
        method: 'GET',
      })) as { ok: boolean; lora: LoraRow | null },
  });

  const lora = loraQ.data?.lora || null;

  const bootstrapM = useMutation({
    mutationFn: async () => {
      const r: any = await apiRequest(
        `/api/promote-engine/artist-style/${artistId}/auto-bootstrap`,
        { method: 'POST' },
      );
      return r;
    },
    onSuccess: async () => {
      toast({
        title: 'Style training started',
        description: '6 reference images created · LoRA training queued',
      });
      await qc.invalidateQueries({ queryKey: ['promote-engine', 'lora-status', artistId] });
    },
    onError: (err: any) =>
      toast({
        title: 'Bootstrap failed',
        description: err?.message || 'Pipeline error',
        variant: 'destructive',
      }),
  });

  const trainM = useMutation({
    mutationFn: async () => {
      const r: any = await apiRequest(
        `/api/promote-engine/artist-style/${artistId}/train`,
        { method: 'POST' },
      );
      return r;
    },
    onSuccess: async () => {
      toast({ title: 'Training submitted to FAL' });
      await qc.invalidateQueries({ queryKey: ['promote-engine', 'lora-status', artistId] });
    },
    onError: (err: any) =>
      toast({
        title: 'Train failed',
        description: err?.message || 'FAL error',
        variant: 'destructive',
      }),
  });

  const uploadRefsM = useMutation({
    mutationFn: async (files: File[]) => {
      if (!artistId) throw new Error('Missing artistId');
      const uploadedUrls = await Promise.all(
        files.map(async (file, index) => {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
          const storageRef = ref(
            storage,
            `promote-engine/artist-loras/${artistId}/refs/${Date.now()}_${index}_${safeName}`,
          );
          const snapshot = await uploadBytes(storageRef, file);
          return getDownloadURL(snapshot.ref);
        }),
      );

      const response: any = await apiRequest(
        `/api/promote-engine/artist-style/${artistId}/upload-references`,
        {
          method: 'POST',
          data: { imageUrls: uploadedUrls },
        },
      );
      return response as { ok: boolean; lora: LoraRow };
    },
    onSuccess: async () => {
      toast({
        title: 'References uploaded',
        description: 'Your images were merged with the artist profile image for training.',
      });
      await qc.invalidateQueries({ queryKey: ['promote-engine', 'lora-status', artistId] });
      // AUTO-TRIGGER: start training immediately after upload
      setTimeout(() => {
        trainM.mutate();
      }, 500);
    },
    onError: (err: any) =>
      toast({
        title: 'Reference upload failed',
        description: err?.message || 'Could not upload reference images',
        variant: 'destructive',
      }),
  });

  const packM = useMutation({
    mutationFn: async () => {
      const r: any = await apiRequest(
        `/api/promote-engine/song/${songId}/generate-pack`,
        {
          method: 'POST',
          data: {
            styles: selectedStyles,
            aspectRatio: '4:5',
            allowNoLora: !lora || lora.status !== 'ready',
          },
        },
      );
      return r as { ok: boolean; packs: PackResult[] };
    },
    onSuccess: (data) => {
      setPacks(data.packs || []);
      toast({ title: `${data.packs?.length || 0} promo packs ready` });
    },
    onError: (err: any) =>
      toast({
        title: 'Generation failed',
        description: err?.message || 'Pipeline error',
        variant: 'destructive',
      }),
  });

  const [busyAsset, setBusyAsset] = useState<{ id: number; kind: 'video' | 'spoken' } | null>(null);

  const hookVideoM = useMutation({
    mutationFn: async (vars: { assetId: number; tier?: 'standard' | 'pro' | '4k' }) => {
      setBusyAsset({ id: vars.assetId, kind: 'video' });
      const r: any = await apiRequest(
        `/api/promote-engine/asset/${vars.assetId}/hook-video`,
        { method: 'POST', data: { tier: vars.tier || 'standard' } },
      );
      return r as { ok: boolean; videoUrl: string; assetId: number };
    },
    onSuccess: (data, vars) => {
      setPacks((prev) =>
        prev.map((p) =>
          p.assetId === vars.assetId
            ? { ...p, hookVideoUrl: data.videoUrl, hookVideoAssetId: data.assetId }
            : p,
        ),
      );
      toast({ title: 'Hook video ready' });
    },
    onError: (err: any) =>
      toast({
        title: 'Hook video failed',
        description: err?.message || 'Kling error',
        variant: 'destructive',
      }),
    onSettled: () => setBusyAsset(null),
  });

  const spokenM = useMutation({
    mutationFn: async (vars: { assetId: number; voiceId?: string; audioUrl?: string }) => {
      setBusyAsset({ id: vars.assetId, kind: 'spoken' });
      const r: any = await apiRequest(
        `/api/promote-engine/asset/${vars.assetId}/spoken-promo`,
        {
          method: 'POST',
          data: {
            voiceId: vars.voiceId,
            audioUrl: vars.audioUrl,
          },
        },
      );
      return r as { ok: boolean; videoUrl: string; assetId: number };
    },
    onSuccess: (data, vars) => {
      setPacks((prev) =>
        prev.map((p) =>
          p.assetId === vars.assetId
            ? { ...p, spokenPromoUrl: data.videoUrl, spokenPromoAssetId: data.assetId }
            : p,
        ),
      );
      toast({ title: 'Spoken promo ready' });
    },
    onError: (err: any) =>
      toast({
        title: 'Spoken promo failed',
        description: err?.message || 'HeyGen error',
        variant: 'destructive',
      }),
    onSettled: () => setBusyAsset(null),
  });

  const mixAudioM = useMutation({
    mutationFn: async (vars: { packAssetId: number; videoAssetId: number }) => {
      setBusyAsset({ id: vars.packAssetId, kind: 'spoken' });
      const r: any = await apiRequest(
        `/api/promote-engine/asset/${vars.videoAssetId}/mix-with-audio`,
        {
          method: 'POST',
          data: {
            profile: mixingProfile,
            clipStrategy: 'best-section',
            clipDuration: 10,
          },
        },
      );
      return r as { ok: boolean; assetId: number; videoUrl: string };
    },
    onSuccess: (data, vars) => {
      setPacks((prev) =>
        prev.map((p) =>
          p.assetId === vars.packAssetId
            ? { ...p, mixedPromoUrl: data.videoUrl, mixedPromoAssetId: data.assetId }
            : p,
        ),
      );
      toast({ title: 'Mixed promo ready (voice + song)' });
    },
    onError: (err: any) =>
      toast({
        title: 'Audio mix failed',
        description: err?.message || 'Could not mix song audio into promo video',
        variant: 'destructive',
      }),
    onSettled: () => setBusyAsset(null),
  });

  // AUTO-GENERATE: When training completes, auto-generate packs
  React.useEffect(() => {
    if (lora?.status === 'ready' && !packM.isPending && packs.length === 0) {
      setTimeout(() => {
        packM.mutate();
      }, 1000);
    }
  }, [lora?.status]);

  // AUTO-GENERATE: When packs are ready, auto-generate hook videos
  React.useEffect(() => {
    if (packs.length > 0) {
      packs.forEach((pack) => {
        if (!pack.hookVideoUrl && busyAsset?.id !== pack.assetId) {
          setTimeout(() => {
            hookVideoM.mutate({ assetId: pack.assetId, tier: 'standard' });
          }, 2000);
        }
      });
    }
  }, [packs]);

  const styleCatalog = stylesQ.data?.styles || [];
  const refsCount = lora?.referenceImages?.length || 0;

  const statusBadge = useMemo(() => {
    if (!artistId) return null;
    if (loraQ.isLoading) {
      return (
        <Badge className="bg-slate-700 text-slate-200 text-[10px]">
          <Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading
        </Badge>
      );
    }
    if (!lora) {
      return (
        <Badge className="bg-slate-700/60 text-slate-300 border-slate-600 text-[10px]">
          No style trained yet
        </Badge>
      );
    }
    switch (lora.status) {
      case 'ready':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Style ready · {lora.triggerWord}
          </Badge>
        );
      case 'training':
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
            <Loader2 className="h-3 w-3 animate-spin mr-1" /> Training LoRA…
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px]">
            <AlertTriangle className="h-3 w-3 mr-1" /> Training failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-700/60 text-slate-300 border-slate-600 text-[10px]">
            {refsCount} references · pending training
          </Badge>
        );
    }
  }, [artistId, loraQ.isLoading, lora, refsCount]);

  if (!artistId) {
    return (
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5 text-sm text-slate-500">
        Cinematic Promo unavailable: this song has no Postgres artistId yet.
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 sm:p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-fuchsia-500/20 shrink-0">
            <Film className="h-4 w-4 text-fuchsia-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Cinematic Promo Engine</h3>
            <p className="text-xs text-slate-500">AI-generated visual identity for your release</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              qc.invalidateQueries({ queryKey: ['promote-engine', 'lora-status', artistId] })
            }
            className="text-slate-500 hover:text-white h-7 w-7 p-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[{ n: 1, label: 'Artist Style' }, { n: 2, label: 'Generate Packs' }].map(({ n, label }, idx) => {
          const isActive = (n === 1 && (!packs.length)) || (n === 2 && packs.length > 0);
          const isDone = n === 1 && packs.length > 0;
          return (
            <React.Fragment key={n}>
              <div className="flex items-center gap-1.5">
                <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-colors ${
                  isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-slate-500'
                }`}>
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : n}
                </div>
                <span className={`text-xs font-medium ${isActive || isDone ? 'text-white' : 'text-slate-600'}`}>{label}</span>
              </div>
              {idx === 0 && (
                <div className={`flex-1 h-px max-w-8 ${packs.length > 0 ? 'bg-emerald-500' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Error message */}
      {lora?.errorMessage && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
          {lora.errorMessage}
        </div>
      )}

      {/* Reference thumbnails */}
      {lora?.referenceImages && lora.referenceImages.length > 0 && (
        <div className="grid grid-cols-6 gap-1.5">
          {lora.referenceImages.slice(0, 6).map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-fuchsia-500/50 transition-colors"
            >
              <img src={url} alt={`ref-${i}`} className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}

      {/* STEP 1 — train style */}
      <div className="space-y-3">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Step 1 — Artist Style</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files || []).slice(0, 6);
            if (files.length === 0) return;
            uploadRefsM.mutate(files);
            event.currentTarget.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadRefsM.isPending}
            className="border-white/15 text-slate-300 hover:border-fuchsia-500/40 hover:text-fuchsia-200 h-9"
          >
            {uploadRefsM.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1" />
            )}
            Upload reference images
          </Button>
          {(!lora || lora.status === 'failed') && (
            <Button
              size="sm"
              onClick={() => bootstrapM.mutate()}
              disabled={bootstrapM.isPending}
              className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white h-9"
            >
              {bootstrapM.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Bootstrapping…
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5 mr-1" /> Auto-train style from profile
                </>
              )}
            </Button>
          )}
          {lora && lora.status === 'pending' && refsCount >= 4 && (
            <Button
              size="sm"
              onClick={() => trainM.mutate()}
              disabled={trainM.isPending}
              className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white"
            >
              {trainM.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1" />
              )}
              Submit training ({refsCount} refs)
            </Button>
          )}
          {lora && lora.status === 'ready' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => bootstrapM.mutate()}
              disabled={bootstrapM.isPending}
              className="border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-500/10"
            >
              {bootstrapM.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              Re-train style
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-600">
          Upload reference images or auto-generate from your artist profile.
        </p>
      </div>

      {/* STEP 2 — generate packs */}
      <div className="space-y-3">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Step 2 — Generate Promo Packs</p>
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Audio mix profile</p>
          <div className="flex flex-wrap gap-1.5">
            {(['VOICE_FOCUSED', 'BALANCED', 'MUSIC_FOCUSED', 'FULL_SONG'] as const).map((p) => {
              const labels: Record<string, string> = {
                VOICE_FOCUSED: 'Voice 75%',
                BALANCED: 'Balanced',
                MUSIC_FOCUSED: 'Music 70%',
                FULL_SONG: 'Full Song',
              };
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMixingProfile(p)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    mixingProfile === p
                      ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {styleCatalog.map((s) => {
            const active = selectedStyles.includes(s.id);
            return (
              <button
                type="button"
                key={s.id}
                onClick={() =>
                  setSelectedStyles((prev) =>
                    prev.includes(s.id)
                      ? prev.filter((x) => x !== s.id)
                      : prev.length >= 3
                        ? [...prev.slice(1), s.id]
                        : [...prev, s.id],
                  )
                }
                title={s.description}
                className={`text-[10px] px-2 py-1 rounded border transition ${
                  active
                    ? 'bg-fuchsia-500/30 border-fuchsia-400 text-fuchsia-100'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <Button
          size="sm"
          onClick={() => packM.mutate()}
          disabled={packM.isPending || selectedStyles.length === 0}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {packM.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Generating {selectedStyles.length} packs…
            </>
          ) : (
            <>
              <ImageIcon className="h-3.5 w-3.5 mr-1" /> Generate {selectedStyles.length} promo packs
            </>
          )}
        </Button>
        {(!lora || lora.status !== 'ready') && (
          <p className="text-[10px] text-amber-300/80">
            Tip: training the style first gives consistent character across all packs.
          </p>
        )}
      </div>

      {/* Generated packs */}
      {packs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/5">
          {packs.map((p) => {
            const videoBusy = busyAsset?.id === p.assetId && busyAsset.kind === 'video';
            const spokenBusy = busyAsset?.id === p.assetId && busyAsset.kind === 'spoken';
            const selectedVideoAssetId = p.spokenPromoAssetId || p.hookVideoAssetId;
            const mixBusy = mixAudioM.isPending && busyAsset?.id === p.assetId;
            return (
              <div
                key={p.assetId}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col hover:border-fuchsia-500/30 transition-colors"
              >
                <a href={p.imageUrl} target="_blank" rel="noreferrer" className="block">
                  {p.mixedPromoUrl || p.hookVideoUrl || p.spokenPromoUrl ? (
                    <video
                      src={p.mixedPromoUrl || p.hookVideoUrl || p.spokenPromoUrl}
                      poster={p.imageUrl}
                      className="w-full aspect-[4/5] object-cover"
                      controls
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={p.imageUrl}
                      alt={p.styleLabel}
                      className="w-full aspect-[4/5] object-cover"
                    />
                  )}
                </a>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/30 text-xs font-medium truncate">
                      {p.styleLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {p.hookLine}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/10 text-slate-300 hover:border-fuchsia-500/40 hover:text-fuchsia-200 gap-1"
                      onClick={() => hookVideoM.mutate({ assetId: p.assetId, tier: 'standard' })}
                      disabled={videoBusy || !!p.hookVideoUrl}
                      title="Generate Kling hook video from this image"
                    >
                      {videoBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : p.hookVideoUrl ? <Play className="h-3 w-3 text-emerald-400" /> : <Video className="h-3 w-3" />}
                      {!videoBusy && !p.hookVideoUrl ? 'Video' : ''}
                      {p.hookVideoUrl && !videoBusy ? 'Video ✓' : ''}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/10 text-slate-300 hover:border-fuchsia-500/40 hover:text-fuchsia-200 gap-1"
                      onClick={() => {
                        const audioUrl = window.prompt('Paste a TTS audio URL (mp3/wav). Leave empty to use default voice.');
                        if (audioUrl === null) return;
                        spokenM.mutate({ assetId: p.assetId, audioUrl: audioUrl || undefined });
                      }}
                      disabled={spokenBusy || !!p.spokenPromoUrl}
                      title="Generate spoken promo (talking head)"
                    >
                      {spokenBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : p.spokenPromoUrl ? <Play className="h-3 w-3 text-emerald-400" /> : <Mic className="h-3 w-3" />}
                      {!spokenBusy && !p.spokenPromoUrl ? 'Talk' : ''}
                      {p.spokenPromoUrl && !spokenBusy ? 'Talk ✓' : ''}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/10 text-slate-300 hover:border-fuchsia-500/40 hover:text-fuchsia-200 gap-1"
                      onClick={() => {
                        if (!selectedVideoAssetId) return;
                        mixAudioM.mutate({ packAssetId: p.assetId, videoAssetId: selectedVideoAssetId });
                      }}
                      disabled={mixBusy || !selectedVideoAssetId || !!p.mixedPromoUrl}
                      title="Mix song audio with promo video"
                    >
                      {mixBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : p.mixedPromoUrl ? <Play className="h-3 w-3 text-emerald-400" /> : <Music className="h-3 w-3" />}
                      {!mixBusy && !p.mixedPromoUrl ? 'Mix' : ''}
                      {p.mixedPromoUrl && !mixBusy ? 'Mix ✓' : ''}
                    </Button>
                  </div>
                  {p.mixedPromoUrl && (
                    <a href={p.mixedPromoUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300 truncate block">
                      ↗ Open mixed promo
                    </a>
                  )}
                  {p.spokenPromoUrl && (
                    <a href={p.spokenPromoUrl} target="_blank" rel="noreferrer" className="text-xs text-fuchsia-400 hover:text-fuchsia-300 truncate block">
                      ↗ Open spoken promo
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CinematicPromoCard;
