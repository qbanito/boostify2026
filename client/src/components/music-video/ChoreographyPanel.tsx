/**
 * 💃 ChoreographyPanel
 * Panel dentro de MotionSyncPanel para subir/grabar videos de coreografía
 * y aplicarlos a clips del timeline via DreamActor v2.
 *
 * Flujo:
 * 1. Artista graba/sube video de coreografía (3-30s)
 * 2. Selecciona preset y opciones de loop
 * 3. Selecciona clips destino
 * 4. DreamActor v2 transfiere movimiento a la imagen del clip
 * 5. Opcionalmente agrega lipsync con PixVerse
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Upload, Camera, Play, Square, RotateCcw, Check,
  Loader2, Sparkles, Music2, Repeat, FlipHorizontal2,
  ChevronDown, X, Scissors, Video, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimelineClip } from '@/interfaces/timeline';
import { ClipType } from '@/interfaces/timeline';

// ============================================
// TYPES
// ============================================

interface ChoreographyPreset {
  id: string;
  label: string;
  description: string;
}

const PRESETS: ChoreographyPreset[] = [
  { id: 'head-bop',  label: 'Head Bop',  description: 'Movimiento rítmico de cabeza' },
  { id: 'sway',      label: 'Sway',      description: 'Balanceo suave del cuerpo' },
  { id: 'full-body', label: 'Full Body',  description: 'Coreografía cuerpo completo' },
  { id: 'arms-wave', label: 'Arms Wave',  description: 'Movimiento de brazos' },
  { id: 'hip-hop',   label: 'Hip Hop',    description: 'Pasos estilo hip-hop' },
  { id: 'latin',     label: 'Latin',      description: 'Salsa, reggaeton' },
  { id: 'custom',    label: 'Custom',     description: 'Tu propia coreografía' },
];

type PanelState = 'idle' | 'recording' | 'uploading' | 'ready' | 'generating' | 'done' | 'error';

interface ChoreographyPanelProps {
  clips: TimelineClip[];
  onUpdateClip: (clipId: number, updates: Partial<TimelineClip>) => void;
  audioPreviewUrl?: string;
}

// ============================================
// COMPONENT
// ============================================

export function ChoreographyPanel({ clips, onUpdateClip, audioPreviewUrl }: ChoreographyPanelProps) {
  // State
  const [state, setState] = useState<PanelState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Video source
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Options
  const [preset, setPreset] = useState('custom');
  const [showPresets, setShowPresets] = useState(false);
  const [mirrorLoop, setMirrorLoop] = useState(false);
  const [addLipsync, setAddLipsync] = useState(false);
  const [loopRange, setLoopRange] = useState<[number, number]>([0, 100]); // % of video

  // Clip selection
  const [selectedClipIds, setSelectedClipIds] = useState<Set<number>>(new Set());

  // Generation tracking
  const [generatingClipId, setGeneratingClipId] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [results, setResults] = useState<Map<number, string>>(new Map()); // clipId → videoUrl

  // Filter to image clips only
  const imageClips = clips.filter(c => (c.imageUrl || c.url || c.thumbnailUrl) && c.type !== ClipType.AUDIO);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, []);

  // ==========================================
  // RECORD VIDEO
  // ==========================================

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setErrorMsg('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoPreviewUrl(url);
        setState('ready');
        stopStream();
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      setState('recording');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 100);
      }, 100);

    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo acceder a la cámara');
      setState('error');
    }
  }, [stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // ==========================================
  // UPLOAD FILE
  // ==========================================

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setErrorMsg('Solo se permiten archivos de video');
      setState('error');
      return;
    }

    setVideoBlob(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    setState('ready');
    setErrorMsg('');
  }, []);

  // ==========================================
  // UPLOAD TO SERVER
  // ==========================================

  const uploadVideo = useCallback(async (): Promise<string | null> => {
    if (!videoBlob) return null;
    if (uploadedUrl) return uploadedUrl; // Already uploaded

    setState('uploading');
    try {
      const formData = new FormData();
      formData.append('video', videoBlob, 'choreography.webm');
      formData.append('userEmail', 'user@boostify.com'); // TODO: get from auth

      const res = await fetch('/api/choreography/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      setUploadedUrl(data.videoUrl);
      return data.videoUrl;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error subiendo video');
      setState('error');
      return null;
    }
  }, [videoBlob, uploadedUrl]);

  // ==========================================
  // GENERATE CHOREOGRAPHY
  // ==========================================

  const generateChoreography = useCallback(async () => {
    if (selectedClipIds.size === 0) return;
    setErrorMsg('');

    // First upload if needed
    const choreoUrl = await uploadVideo();
    if (!choreoUrl) return;

    setState('generating');
    setGenerationProgress(0);

    const clipIds = Array.from(selectedClipIds);
    const newResults = new Map(results);
    let completed = 0;

    for (const clipId of clipIds) {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) continue;

      const artistImageUrl = clip.imageUrl || clip.url || clip.thumbnailUrl;
      if (!artistImageUrl) continue;

      setGeneratingClipId(clipId);

      try {
        const res = await fetch('/api/choreography/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            choreographyVideoUrl: choreoUrl,
            artistImageUrl,
            clipDuration: clip.duration || 5,
            mirrorLoop,
            preset,
            addLipsync: addLipsync && !!audioPreviewUrl,
            audioUrl: addLipsync ? audioPreviewUrl : undefined
          })
        });

        const data = await res.json();

        if (data.success && data.videoUrl) {
          newResults.set(clipId, data.videoUrl);

          // Update clip metadata
          onUpdateClip(clipId, {
            videoUrl: data.videoUrl,
            metadata: {
              ...(clip.metadata || {}),
              choreography: {
                drivingVideoUrl: choreoUrl,
                preset,
                mirrorLoop,
                lipsync: addLipsync,
                generatedAt: new Date().toISOString()
              }
            }
          });
        }
      } catch (err: any) {
        console.error(`Choreography failed for clip ${clipId}:`, err);
      }

      completed++;
      setGenerationProgress(Math.round((completed / clipIds.length) * 100));
    }

    setResults(newResults);
    setGeneratingClipId(null);
    setState('done');
  }, [selectedClipIds, uploadVideo, clips, mirrorLoop, preset, addLipsync, audioPreviewUrl, onUpdateClip, results]);

  // ==========================================
  // CLIP SELECTION
  // ==========================================

  const toggleClip = useCallback((id: number) => {
    setSelectedClipIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedClipIds(new Set(imageClips.map(c => c.id)));
  }, [imageClips]);

  // ==========================================
  // RESET
  // ==========================================

  const reset = useCallback(() => {
    stopStream();
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoBlob(null);
    setVideoPreviewUrl(null);
    setUploadedUrl(null);
    setState('idle');
    setErrorMsg('');
    setRecordingTime(0);
    setResults(new Map());
    setGeneratingClipId(null);
    setGenerationProgress(0);
  }, [stopStream, videoPreviewUrl]);

  // ==========================================
  // HELPERS
  // ==========================================

  const currentPreset = PRESETS.find(p => p.id === preset) || PRESETS[6];
  const formatSec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-[#2a1540] flex items-center justify-center">
          <Music2 size={12} className="text-purple-400" />
        </div>
        <span className="text-xs font-bold text-white">Coreografía</span>
        <Badge className="bg-[#2a1540] text-purple-300 border-[#442266] text-[8px] px-1.5 py-0">
          DreamActor v2
        </Badge>
      </div>

      {/* Video capture area */}
      <div className="relative w-full rounded-lg overflow-hidden border border-[#2a2a40] bg-black" style={{ aspectRatio: '9/16', maxHeight: 280 }}>
        {/* Idle: Show upload/record options */}
        {state === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <Video size={32} className="text-[#444466]" />
            <span className="text-[11px] text-[#666688] text-center">
              Graba o sube un video corto de coreografía (3-30s)
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={startRecording}
                className="h-8 text-[10px] bg-purple-600 hover:bg-purple-700 gap-1.5"
              >
                <Camera size={12} /> Grabar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-[10px] border-[#333355] gap-1.5"
              >
                <Upload size={12} /> Subir Video
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Recording: Live camera feed */}
        {state === 'recording' && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600 rounded-full px-2.5 py-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-[10px] text-white font-bold">{formatSec(recordingTime)}</span>
            </div>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <Button
                onClick={stopRecording}
                className="h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 p-0"
              >
                <Square size={16} className="text-white" />
              </Button>
            </div>
          </>
        )}

        {/* Preview: Show recorded/uploaded video */}
        {(state === 'ready' || state === 'uploading' || state === 'generating' || state === 'done') && videoPreviewUrl && (
          <>
            <video
              src={videoPreviewUrl}
              className="w-full h-full object-cover"
              loop
              autoPlay
              muted
              playsInline
            />
            {state === 'uploading' && (
              <div className="absolute inset-0 bg-[#0d0d1a] bg-opacity-80 flex flex-col items-center justify-center">
                <Loader2 size={24} className="text-purple-400 animate-spin mb-2" />
                <span className="text-[10px] text-[#8888aa]">Subiendo video...</span>
              </div>
            )}
            {state === 'generating' && (
              <div className="absolute inset-0 bg-[#0d0d1a] bg-opacity-80 flex flex-col items-center justify-center">
                <Loader2 size={24} className="text-purple-400 animate-spin mb-2" />
                <span className="text-[10px] text-[#8888aa]">
                  Generando... {generationProgress}%
                </span>
                <div className="w-32 h-1 bg-[#1a1a30] rounded-full mt-2">
                  <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${generationProgress}%` }} />
                </div>
              </div>
            )}
            {/* Reset button */}
            <button
              onClick={reset}
              className="absolute top-2 right-2 w-6 h-6 rounded-md bg-[#111122] flex items-center justify-center hover:bg-[#1a1a2e]"
            >
              <X size={12} className="text-[#8888aa]" />
            </button>
          </>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <AlertCircle size={24} className="text-red-400" />
            <span className="text-[10px] text-red-300 text-center">{errorMsg}</span>
            <Button size="sm" onClick={reset} className="h-7 text-[9px] gap-1">
              <RotateCcw size={10} /> Reintentar
            </Button>
          </div>
        )}
      </div>

      {/* Preset selector */}
      {(state === 'ready' || state === 'done') && (
        <div>
          <span className="text-[10px] font-bold text-[#8888aa] uppercase tracking-wider">Preset</span>
          <div className="relative mt-1">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#1a1a30] border border-[#333355] hover:border-[#5544aa] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-purple-400" />
                <span className="text-xs font-semibold text-white">{currentPreset.label}</span>
              </div>
              <ChevronDown size={12} className={cn('text-[#8888aa] transition-transform', showPresets && 'rotate-180')} />
            </button>

            {showPresets && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[#333355] bg-[#141428] shadow-lg z-10 overflow-hidden">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPreset(p.id); setShowPresets(false); }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors border-b border-[#1e1e35] last:border-b-0',
                      preset === p.id ? 'bg-[#1a2240]' : 'hover:bg-[#1a1a32]'
                    )}
                  >
                    <div>
                      <div className={cn('text-[11px] font-semibold', preset === p.id ? 'text-purple-300' : 'text-white')}>{p.label}</div>
                      <div className="text-[9px] text-[#777799]">{p.description}</div>
                    </div>
                    {preset === p.id && <Check size={12} className="text-purple-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Options */}
      {(state === 'ready' || state === 'done') && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-[#8888aa] uppercase tracking-wider">Opciones</span>

          {/* Mirror loop toggle */}
          <button
            onClick={() => setMirrorLoop(!mirrorLoop)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors',
              mirrorLoop ? 'bg-[#1a2240] border border-[#334488]' : 'bg-[#13132a] border border-[#2a2a40]'
            )}
          >
            <FlipHorizontal2 size={14} className={mirrorLoop ? 'text-purple-300' : 'text-[#666688]'} />
            <div className="text-left flex-1">
              <div className={cn('text-[11px] font-medium', mirrorLoop ? 'text-white' : 'text-[#8888aa]')}>Mirror Loop</div>
              <div className="text-[9px] text-[#666688]">Ping-pong para transición suave</div>
            </div>
            <div className={cn('w-4 h-4 rounded border flex items-center justify-center',
              mirrorLoop ? 'bg-purple-500 border-purple-500' : 'border-[#444466]'
            )}>
              {mirrorLoop && <Check size={10} className="text-white" />}
            </div>
          </button>

          {/* Lipsync toggle */}
          {audioPreviewUrl && (
            <button
              onClick={() => setAddLipsync(!addLipsync)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors',
                addLipsync ? 'bg-[#1a2240] border border-[#334488]' : 'bg-[#13132a] border border-[#2a2a40]'
              )}
            >
              <Music2 size={14} className={addLipsync ? 'text-purple-300' : 'text-[#666688]'} />
              <div className="text-left flex-1">
                <div className={cn('text-[11px] font-medium', addLipsync ? 'text-white' : 'text-[#8888aa]')}>+ Lip Sync</div>
                <div className="text-[9px] text-[#666688]">Sincronizar labios con audio (PixVerse)</div>
              </div>
              <div className={cn('w-4 h-4 rounded border flex items-center justify-center',
                addLipsync ? 'bg-purple-500 border-purple-500' : 'border-[#444466]'
              )}>
                {addLipsync && <Check size={10} className="text-white" />}
              </div>
            </button>
          )}
        </div>
      )}

      {/* Clip selector */}
      {(state === 'ready' || state === 'done') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#8888aa] uppercase tracking-wider">
              Clips ({selectedClipIds.size}/{imageClips.length})
            </span>
            <button onClick={selectAll} className="text-[9px] text-purple-400 hover:text-purple-300">
              Seleccionar todos
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 max-h-[140px] overflow-y-auto">
            {imageClips.map((clip, idx) => {
              const isSelected = selectedClipIds.has(clip.id);
              const hasResult = results.has(clip.id);
              const isCurrentlyGenerating = generatingClipId === clip.id;
              const imgUrl = clip.imageUrl || clip.url || clip.thumbnailUrl;
              return (
                <button
                  key={clip.id}
                  onClick={() => toggleClip(clip.id)}
                  className={cn(
                    'relative rounded-md overflow-hidden border-2 transition-all',
                    isSelected
                      ? 'border-purple-500 ring-1 ring-purple-500/30'
                      : 'border-transparent hover:border-[#333355]'
                  )}
                >
                  <div className="aspect-video bg-[#111122]">
                    {imgUrl && <img src={imgUrl} alt={`Clip ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="absolute top-0.5 left-0.5 bg-[#111122] rounded px-1 py-0.5">
                    <span className="text-[7px] font-bold text-[#8888aa]">#{idx + 1}</span>
                  </div>
                  {isSelected && (
                    <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-purple-500 rounded-full flex items-center justify-center">
                      <Check size={8} className="text-white" />
                    </div>
                  )}
                  {hasResult && (
                    <div className="absolute bottom-0.5 right-0.5">
                      <Sparkles size={8} className="text-green-400" />
                    </div>
                  )}
                  {isCurrentlyGenerating && (
                    <div className="absolute inset-0 bg-[#0d0d1a] bg-opacity-70 flex items-center justify-center">
                      <Loader2 size={12} className="text-purple-400 animate-spin" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Generate button */}
      {state === 'ready' && (
        <Button
          onClick={generateChoreography}
          disabled={selectedClipIds.size === 0}
          className="w-full h-9 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold text-xs gap-2 disabled:opacity-50"
        >
          <Sparkles size={14} />
          Aplicar Coreografía ({selectedClipIds.size} clips)
        </Button>
      )}

      {/* Done state */}
      {state === 'done' && (
        <div className="rounded-lg border border-green-800 bg-[#0a1a10] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Check size={14} className="text-green-400" />
            <span className="text-[11px] font-bold text-green-300">Coreografía aplicada</span>
          </div>
          <p className="text-[10px] text-[#668866]">
            {results.size} clip(s) actualizados con motion transfer vía DreamActor v2.
            {addLipsync && ' + Lip Sync vía PixVerse.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={reset}
            className="mt-2 h-7 text-[9px] border-green-800 text-green-400 gap-1"
          >
            <RotateCcw size={10} /> Nueva Coreografía
          </Button>
        </div>
      )}

      {/* Info */}
      {state === 'idle' && (
        <div className="rounded-lg border border-[#1e1e35] bg-[#111122] p-3">
          <div className="text-[10px] text-[#666688] space-y-1">
            <p className="font-semibold text-[#8888aa]">¿Cómo funciona?</p>
            <p>1. Graba un video corto bailando (3-30s)</p>
            <p>2. El video se usa como "driving video" para transferir tus movimientos</p>
            <p>3. DreamActor v2 aplica tu coreografía a la imagen del artista AI</p>
            <p>4. Opcionalmente agrega lip-sync con PixVerse</p>
            <p className="text-[#555577] mt-1">💡 Loops cortos (3-5s) funcionan mejor para repetir en la música</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChoreographyPanel;
