/**
 * VideoGenerationModal — Quick modal to generate video from a clip
 * 
 * Shows clip image preview, prompt, model selector, and generates
 * video directly using Grok or Kling APIs without budget gate.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Video, Loader2, CheckCircle2, Zap, Film, Sparkles, Play, AlertCircle, Smartphone } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { TimelineClip } from '@/interfaces/timeline';

// ── Model definitions ──────────────────────────────────────────────────────

type VideoModel =
  | 'grok'
  | 'kling-o1-pro'
  | 'kling-o1-standard'
  | 'kling-v2.1-pro'
  | 'kling-v2.1-standard'
  | 'pixverse-v6'
  | 'pixverse-v6-pro'
  | 'pixverse-c1'
  | 'pixverse-sora-2'
  | 'pixverse-veo-3.1-fast'
  | 'pixverse-seedance-2.0-fast';

const MODELS: { id: VideoModel; label: string; icon: string; speed: string; quality: string; maxDuration: number; group: string }[] = [
  // ── Kling / Grok ──
  { id: 'grok',              label: 'Grok Imagine Video (xAI)',  icon: '⚡', speed: '~30s',  quality: 'High',      maxDuration: 6,  group: 'Standard' },
  { id: 'kling-v2.1-pro',    label: 'Kling v2.1 Pro',           icon: '🔥', speed: '~60s',  quality: 'Very High', maxDuration: 10, group: 'Standard' },
  { id: 'kling-v2.1-standard',label: 'Kling v2.1 Standard',     icon: '✨', speed: '~45s',  quality: 'Good',      maxDuration: 10, group: 'Standard' },
  { id: 'kling-o1-pro',      label: 'Kling O1 Pro',             icon: '🎬', speed: '~90s',  quality: 'Ultra',     maxDuration: 10, group: 'Standard' },
  { id: 'kling-o1-standard', label: 'Kling O1 Standard',        icon: '🎥', speed: '~60s',  quality: 'High',      maxDuration: 10, group: 'Standard' },
  // ── PixVerse ──
  { id: 'pixverse-v6',              label: 'PixVerse V6',              icon: '🎯', speed: '~60s',  quality: 'High',       maxDuration: 8,  group: 'PixVerse' },
  { id: 'pixverse-v6-pro',          label: 'PixVerse V6 Pro',          icon: '🌟', speed: '~90s',  quality: 'Very High',  maxDuration: 8,  group: 'PixVerse' },
  { id: 'pixverse-c1',              label: 'PixVerse C1 (fast)',       icon: '⚡', speed: '~30s',  quality: 'Good',       maxDuration: 5,  group: 'PixVerse' },
  { id: 'pixverse-sora-2',          label: 'Sora 2 via PixVerse',     icon: '🚀', speed: '~120s', quality: 'Ultra',      maxDuration: 10, group: 'PixVerse' },
  { id: 'pixverse-veo-3.1-fast',    label: 'Veo 3.1 Fast (Google)',   icon: '🎥', speed: '~60s',  quality: 'High',       maxDuration: 8,  group: 'PixVerse' },
  { id: 'pixverse-seedance-2.0-fast',label:'Seedance 2.0 Fast',       icon: '🌱', speed: '~45s',  quality: 'Good',       maxDuration: 5,  group: 'PixVerse' },
];

const KLING_MODEL_MAP: Record<string, string> = {
  'kling-o1-pro': 'o1-pro-i2v',
  'kling-o1-standard': 'o1-standard-i2v',
  'kling-v2.1-pro': 'v2.1-pro-i2v',
  'kling-v2.1-standard': 'v2.1-standard-i2v',
};

// Map from VideoModal model id → PixVerse API model name
const PIXVERSE_MODEL_MAP: Record<string, string> = {
  'pixverse-v6':               'v6',
  'pixverse-v6-pro':           'v6',           // v6 with enhanced prompt
  'pixverse-c1':               'pixverse-c1',
  'pixverse-sora-2':           'sora-2',
  'pixverse-veo-3.1-fast':     'veo-3.1-fast',
  'pixverse-seedance-2.0-fast':'seedance-2.0-fast',
};

const isPixVerseMode = (m: VideoModel) => m.startsWith('pixverse-');

// ── Props ──────────────────────────────────────────────────────────────────

interface VideoGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: TimelineClip;
  aspectRatio: string;
  onVideoGenerated: (clipId: number, videoUrl: string, metadata: Record<string, any>) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function VideoGenerationModal({ isOpen, onClose, clip, aspectRatio, onVideoGenerated }: VideoGenerationModalProps) {
  const { toast } = useToast();
  const [model, setModel] = useState<VideoModel>('grok');
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'polling' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const imageUrl = clip.imageUrl || clip.url || clip.thumbnailUrl || '';
  const selectedModel = MODELS.find(m => m.id === model)!;

  // Initialize prompt from clip metadata
  useEffect(() => {
    if (isOpen) {
      const clipPrompt = clip.metadata?.imagePrompt || clip.metadata?.scene_description || clip.title || '';
      // Motion Sync: use the captured camera-motion description if available
      const motionClause = clip.metadata?.motionPromptSuffix
        || (clip.metadata?.cameraMovement ? String(clip.metadata.cameraMovement).replace(/-/g, ' ') : '')
        || 'smooth camera movement';
      setPrompt(clipPrompt + (clipPrompt ? ', ' : '') + `cinematic motion, ${motionClause}, professional music video style`);
      setStatus('idle');
      setProgress(0);
      setErrorMsg('');
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, clip]);

  const handleGenerate = useCallback(async () => {
    if (!imageUrl) {
      toast({ title: 'Sin imagen', description: 'El clip necesita una imagen para generar video', variant: 'destructive' });
      return;
    }

    setStatus('generating');
    setProgress(10);
    setErrorMsg('');

    const duration = Math.min(clip.duration || 6, selectedModel.maxDuration);

    try {
      if (model === 'grok') {
        // ── Grok: synchronous ──
        setProgress(30);
        const res = await fetch('/api/fal/grok-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl, prompt, duration, resolution: '720p', aspectRatio }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Grok video generation failed');
        }

        const data = await res.json();
        if (!data.videoUrl) throw new Error('No video URL returned');

        setProgress(100);
        setStatus('done');
        onVideoGenerated(clip.id, data.videoUrl, {
          videoUrl: data.videoUrl,
          videoGeneratedAt: new Date().toISOString(),
          hasVideo: true,
          generatedWith: 'grok-imagine-video',
          motionPrompt: prompt,
          videoDuration: data.duration,
          videoWidth: data.width,
          videoHeight: data.height,
        });
        toast({ title: '✅ Video generado', description: `Video creado con ${selectedModel.label}` });

      } else if (isPixVerseMode(model)) {
        // ── PixVerse: start task → poll status ──
        setProgress(15);
        const pixverseModel = PIXVERSE_MODEL_MAP[model] ?? 'v6';
        const res = await fetch('/api/fal/pixverse-video/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            prompt,
            model: pixverseModel,
            duration: Math.min(clip.duration || 5, selectedModel.maxDuration),
            aspectRatio,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'PixVerse video generation failed');
        }

        const data = await res.json();
        if (!data.taskId) throw new Error('No task ID returned from PixVerse');

        // Poll with exponential backoff
        setStatus('polling');
        setProgress(25);
        let attempts = 0;
        let pollDelay = 8000;
        const maxAttempts = 40;

        const doPoll = async () => {
          attempts++;
          try {
            const pollRes = await fetch(`/api/fal/pixverse-video/${data.taskId}`);
            const pollData = await pollRes.json();
            const pct = Math.min(25 + Math.round((attempts / maxAttempts) * 70), 95);
            setProgress(pct);

            if (pollData.status === 'completed' && pollData.videoUrl) {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setProgress(100);
              setStatus('done');
              onVideoGenerated(clip.id, pollData.videoUrl, {
                videoUrl: pollData.videoUrl,
                videoGeneratedAt: new Date().toISOString(),
                hasVideo: true,
                generatedWith: model,
                motionPrompt: prompt,
              });
              toast({ title: '✅ Video generado', description: `Video creado con ${selectedModel.label}` });
            } else if (pollData.status === 'failed' || attempts >= maxAttempts) {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              throw new Error(pollData.error || 'PixVerse timeout — generación tardó demasiado');
            } else {
              // Exponential backoff: 8s → 12s → 18s → max 30s
              pollDelay = Math.min(pollDelay * 1.5, 30000);
              pollingRef.current = setTimeout(doPoll, pollDelay) as unknown as ReturnType<typeof setInterval>;
            }
          } catch (err) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setStatus('error');
            setErrorMsg(err instanceof Error ? err.message : 'Error de polling PixVerse');
          }
        };
        pollingRef.current = setTimeout(doPoll, pollDelay) as unknown as ReturnType<typeof setInterval>;

      } else {
        // ── Kling: async with polling ──
        setProgress(15);
        const klingModel = KLING_MODEL_MAP[model];
        const res = await fetch('/api/fal/kling-video/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            prompt,
            duration: duration <= 5 ? '5' : '10',
            aspectRatio,
            model: klingModel,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Kling video generation failed');
        }

        const data = await res.json();

        if (data.videoUrl) {
          // Immediate result
          setProgress(100);
          setStatus('done');
          onVideoGenerated(clip.id, data.videoUrl, {
            videoUrl: data.videoUrl,
            videoGeneratedAt: new Date().toISOString(),
            hasVideo: true,
            generatedWith: model,
            motionPrompt: prompt,
          });
          toast({ title: '✅ Video generado', description: `Video creado con ${selectedModel.label}` });
        } else if (data.requestId) {
          // Start polling
          setStatus('polling');
          setProgress(25);
          let attempts = 0;
          const maxAttempts = 120;

          pollingRef.current = setInterval(async () => {
            attempts++;
            try {
              const pollRes = await fetch(`/api/fal/kling-video/${data.requestId}?model=${klingModel}`);
              const pollData = await pollRes.json();
              const pct = Math.min(25 + Math.round((attempts / maxAttempts) * 70), 95);
              setProgress(pct);

              if (pollData.status === 'completed' && pollData.videoUrl) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                pollingRef.current = null;
                setProgress(100);
                setStatus('done');
                onVideoGenerated(clip.id, pollData.videoUrl, {
                  videoUrl: pollData.videoUrl,
                  videoGeneratedAt: new Date().toISOString(),
                  hasVideo: true,
                  generatedWith: model,
                  motionPrompt: prompt,
                });
                toast({ title: '✅ Video generado', description: `Video creado con ${selectedModel.label}` });
              } else if (pollData.status === 'failed' || attempts >= maxAttempts) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                pollingRef.current = null;
                throw new Error(pollData.error || 'Timeout — generación tardó demasiado');
              }
            } catch (err) {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setStatus('error');
              setErrorMsg(err instanceof Error ? err.message : 'Error de polling');
            }
          }, 5000);
        } else {
          throw new Error('No video URL or request ID returned');
        }
      }
    } catch (err) {
      logger.error('❌ [VideoGen] Error:', err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
      toast({ title: 'Error generando video', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' });
    }
  }, [model, prompt, imageUrl, clip, aspectRatio, selectedModel, onVideoGenerated, toast]);

  const isWorking = status === 'generating' || status === 'polling';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isWorking) onClose(); }}>
      <DialogContent className="max-w-lg bg-neutral-950 border-white/10 text-white p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Video size={16} className="text-orange-400" />
            Generar Video — Clip {clip.id}
          </DialogTitle>
        </DialogHeader>

        {/* Image Preview */}
        <div className="px-4 pb-3">
          <div className="relative rounded-lg overflow-hidden bg-black/50 border border-white/5" style={{ maxHeight: 180 }}>
            {imageUrl ? (
              <img src={imageUrl} alt="Preview" className="w-full object-contain" style={{ maxHeight: 180 }} />
            ) : (
              <div className="flex items-center justify-center h-32 text-white/30 text-xs">Sin imagen</div>
            )}
            <Badge className="absolute bottom-2 right-2 bg-black/70 text-white/80 text-[9px] border-0">
              {clip.title || `Escena ${clip.id}`}
            </Badge>
          </div>
        </div>

        {/* Model Selector */}
        <div className="px-4 pb-3">
          <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">Modelo de IA</label>
          <Select value={model} onValueChange={(v) => setModel(v as VideoModel)} disabled={isWorking}>
            <SelectTrigger className="bg-neutral-900 border-white/10 text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-white/10">
              <div className="px-2 py-1 text-[9px] text-white/30 uppercase tracking-wider">Standard</div>
              {MODELS.filter(m => m.group === 'Standard').map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                    <span className="text-white/30 ml-auto">{m.speed} · {m.quality}</span>
                  </span>
                </SelectItem>
              ))}
              <div className="px-2 py-1 text-[9px] text-purple-400/60 uppercase tracking-wider mt-1">PixVerse ✨</div>
              {MODELS.filter(m => m.group === 'PixVerse').map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                    <span className="text-purple-400/50 ml-auto">{m.speed} · {m.quality}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prompt */}
        <div className="px-4 pb-3">
          <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">Prompt de movimiento</label>
          {clip.metadata?.motionSyncApplied && (
            <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-rose-400">
              <Smartphone size={11} />
              <span>Motion Sync aplicado: {clip.metadata?.cameraMovement || 'movimiento capturado'}</span>
            </div>
          )}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isWorking}
            className="bg-neutral-900 border-white/10 text-xs min-h-[60px] resize-none"
            placeholder="Describe el movimiento deseado..."
          />
        </div>

        {/* Progress / Status */}
        {isWorking && (
          <div className="px-4 pb-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-orange-400">
              <Loader2 size={14} className="animate-spin" />
              <span>{status === 'polling' ? 'Procesando en servidor...' : 'Generando video...'}</span>
              <span className="ml-auto text-white/40">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {status === 'done' && (
          <div className="px-4 pb-3 flex items-center gap-2 text-xs text-green-400">
            <CheckCircle2 size={14} />
            <span>Video generado exitosamente</span>
          </div>
        )}

        {status === 'error' && (
          <div className="px-4 pb-3 flex items-center gap-2 text-xs text-red-400">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2 justify-end bg-neutral-900/50">
          <div className="mr-auto flex items-center gap-2 text-[10px] text-white/30">
            <Film size={12} />
            <span>{selectedModel.speed} · {selectedModel.quality}</span>
          </div>
          {status === 'done' ? (
            <Button size="sm" onClick={onClose} className="bg-green-600 hover:bg-green-700 text-xs h-8 gap-1.5">
              <CheckCircle2 size={13} />
              Cerrar
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={onClose} disabled={isWorking} className="text-xs h-8 text-white/50">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isWorking || !imageUrl}
                className="bg-orange-600 hover:bg-orange-700 text-xs h-8 gap-1.5"
              >
                {isWorking ? (
                  <><Loader2 size={13} className="animate-spin" /> Generando...</>
                ) : (
                  <><Zap size={13} /> Generar Video</>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
