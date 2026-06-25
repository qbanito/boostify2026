import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Video, Square, RotateCcw, CheckCircle, Loader2, Music, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';

interface PerformanceCaptureRecorderProps {
  artistId: string | number;
  /** URL de la canción a reproducir mientras se graba (para que el artista cante con el tema). */
  songAudioUrl?: string;
  /** Imagen de look (micrófono) seleccionada — se muestra como referencia de pose. */
  lookImageUrl?: string;
  /** Segundos máximos de grabación. */
  maxSeconds?: number;
  accent?: string;
  /** URL del clip ya subido (controlado por el padre). */
  value?: string;
  onRecorded: (url: string | undefined) => void;
}

const MAX_DEFAULT = 30;

/**
 * Graba un clip corto desde la webcam (vídeo + audio) mientras suena la canción, y lo
 * sube a Firebase para usarlo como reference video de Seedance r2v: el modelo transfiere
 * la actuación real (timing, movimiento de cabeza, forma de la boca) a la imagen de look.
 */
export const PerformanceCaptureRecorder: React.FC<PerformanceCaptureRecorderProps> = ({
  artistId,
  songAudioUrl,
  lookImageUrl,
  maxSeconds = MAX_DEFAULT,
  accent = '#ec4899',
  value,
  onRecorded,
}) => {
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const songAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'ready' | 'denied'>('idle');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
  }, []);

  const stopSong = useCallback(() => {
    if (songAudioRef.current) {
      songAudioRef.current.pause();
      songAudioRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    stopStream();
    stopSong();
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
  }, [stopStream, stopSong, localPreviewUrl]);

  const enableCamera = useCallback(async () => {
    setError(undefined);
    setPermissionState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 854 }, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.muted = true;
        await liveVideoRef.current.play().catch(() => {});
      }
      setPermissionState('ready');
    } catch (e: any) {
      setPermissionState('denied');
      setError(e?.name === 'NotAllowedError' ? 'Permiso de cámara denegado.' : (e?.message || 'No se pudo abrir la cámara.'));
    }
  }, []);

  const pickMimeType = (): string => {
    const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
    }
    return 'video/webm';
  };

  const uploadClip = useCallback(async (blob: Blob, mimeType: string) => {
    setUploading(true);
    setError(undefined);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const res = await apiRequest('POST', `/api/promo-clips/${artistId}/upload-recording`, {
        dataUrl,
        contentType: mimeType,
      });
      if (!res?.success || !res.url) throw new Error(res?.error || 'Fallo al subir el clip');
      onRecorded(res.url);
    } catch (e: any) {
      setError(e?.message || 'Fallo al subir la grabación');
      onRecorded(undefined);
    } finally {
      setUploading(false);
    }
  }, [artistId, onRecorded]);

  const stopRecording = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    stopSong();
    setRecording(false);
  }, [stopSong]);

  const startRecording = useCallback(async () => {
    if (!streamRef.current) { await enableCamera(); }
    const stream = streamRef.current;
    if (!stream) return;
    setError(undefined);
    if (localPreviewUrl) { URL.revokeObjectURL(localPreviewUrl); setLocalPreviewUrl(undefined); }
    onRecorded(undefined);
    chunksRef.current = [];
    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_200_000 });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const previewUrl = URL.createObjectURL(blob);
      setLocalPreviewUrl(previewUrl);
      void uploadClip(blob, mimeType);
    };

    // Play the song so the artist sings along.
    if (songAudioUrl) {
      const audio = new Audio(songAudioUrl);
      audio.crossOrigin = 'anonymous';
      songAudioRef.current = audio;
      audio.play().catch(() => {/* autoplay may need a gesture; recording still works */});
    }

    recorder.start();
    setRecording(true);
    setElapsed(0);
    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      setElapsed(Math.min(maxSeconds, Math.round((Date.now() - startedAt) / 1000)));
    }, 250);
    autoStopRef.current = setTimeout(() => stopRecording(), maxSeconds * 1000);
  }, [enableCamera, localPreviewUrl, maxSeconds, onRecorded, songAudioUrl, stopRecording, uploadClip]);

  const reset = useCallback(() => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(undefined);
    onRecorded(undefined);
    setElapsed(0);
    setError(undefined);
  }, [localPreviewUrl, onRecorded]);

  const previewSrc = localPreviewUrl || value;
  const showLive = permissionState === 'ready' && !previewSrc;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.025)', border: `1.5px solid ${value ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: value ? 'rgba(34,197,94,0.2)' : 'rgba(236,72,153,0.18)' }}>
            {value ? <CheckCircle size={13} style={{ color: '#22c55e' }} /> : <Video size={13} style={{ color: accent }} />}
          </div>
          <span className="text-sm font-bold">Performance Capture</span>
          {value && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: 'rgba(34,197,94,0.18)', color: '#86efac' }}>Ready</span>}
        </div>
        <span className="text-[11px] text-white/35">optional · max {maxSeconds}s</span>
      </div>

      <p className="text-[11px] leading-relaxed text-white/45">
        Record a clip singing along to the song. The AI (Seedance) will transfer your real performance —timing, head and mouth movement— onto the look image with the microphone.
      </p>

      <div className="grid grid-cols-[1fr] gap-3">
        <div className="relative rounded-xl overflow-hidden bg-black/60" style={{ aspectRatio: '9/16', maxHeight: 280, margin: '0 auto', width: '100%', maxWidth: 180 }}>
          {/* Live camera preview */}
          <video
            ref={liveVideoRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ display: showLive ? 'block' : 'none', transform: 'scaleX(-1)' }}
            playsInline
            muted
          />
          {/* Recorded clip preview */}
          {previewSrc && (
            <video src={previewSrc} className="absolute inset-0 w-full h-full object-cover" controls playsInline />
          )}
          {/* Idle / look reference overlay */}
          {!showLive && !previewSrc && (
            lookImageUrl ? (
              <img src={lookImageUrl} alt="Look reference" className="absolute inset-0 w-full h-full object-cover opacity-40" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Video size={28} className="text-white/20" />
              </div>
            )
          )}
          {/* Recording badge */}
          {recording && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/70">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-white tabular-nums">{elapsed}s / {maxSeconds}s</span>
            </div>
          )}
          {songAudioUrl && recording && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/70">
              <Music size={10} className="text-white/70" />
              <span className="text-[9px] text-white/70">Song playing</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-[11px] text-red-300 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {permissionState !== 'ready' && !previewSrc && (
          <button
            type="button"
            onClick={enableCamera}
            disabled={permissionState === 'requesting'}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#fff' }}
          >
            {permissionState === 'requesting' ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
            Open camera
          </button>
        )}

        {permissionState === 'ready' && !recording && !previewSrc && (
          <button
            type="button"
            onClick={startRecording}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition"
            style={{ background: accent, color: '#fff' }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white" />
            Grabar actuación
          </button>
        )}

        {recording && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition"
            style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}
          >
            <Square size={13} fill="currentColor" />
            Detener
          </button>
        )}

        {previewSrc && !uploading && (
          <button
            type="button"
            onClick={() => { reset(); if (permissionState !== 'ready') void enableCamera(); }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#fff' }}
          >
            <RotateCcw size={13} />
            Regrabar
          </button>
        )}

        {uploading && (
          <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
            <Loader2 size={14} className="animate-spin" />
            Subiendo clip…
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceCaptureRecorder;
