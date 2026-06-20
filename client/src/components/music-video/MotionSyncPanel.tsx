/**
 * MotionSyncPanel — Captura de movimiento con cámara + sensores del teléfono
 * Graba video desde la cámara del dispositivo mientras captura datos de giroscopio/acelerómetro
 * para convertirlos en instrucciones de cámara para la generación de video AI
 *
 * FLUJO:
 * 1. Accede a la cámara (frontal o trasera)
 * 2. Muestra preview en vivo del video
 * 3. Al grabar: captura video (MediaRecorder) + sensores simultáneamente
 * 4. Preview del video grabado + análisis de movimiento
 * 5. Aplica movimiento a clips seleccionados (metadata + video blob opcional)
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  X, Smartphone, Camera, Play, Square, RotateCcw, Check,
  AlertCircle, Loader2, Maximize2, Minimize2, Video,
  ChevronDown, ChevronUp, Waves, Move, Eye,
  CircleDot, Pause, SwitchCamera, VideoOff,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { ChoreographyPanel } from './ChoreographyPanel';
import type { TimelineClip } from '@/interfaces/timeline';

// ============================================
// TYPES
// ============================================
export interface MotionKeyframe {
  time: number;
  alpha: number;   // Z rotation (0-360) → PAN
  beta: number;    // X rotation (-180 to 180) → TILT
  gamma: number;   // Y rotation (-90 to 90) → ROLL
  ax: number;      // acceleration X → lateral
  ay: number;      // acceleration Y → vertical
  az: number;      // acceleration Z → depth (ZOOM)
}

export interface CapturedMotion {
  keyframes: MotionKeyframe[];
  duration: number;
  fps: number;
  dominantMovement: string;
  intensity: number;
  smoothness: number;
  promptDescription: string;
  videoBlob?: Blob;
  videoUrl?: string;
}

interface MotionSyncPanelProps {
  open: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  onUpdateClip: (clipId: number, updates: Partial<TimelineClip>) => void;
  audioPreviewUrl?: string;
  initialTab?: 'motion' | 'choreography';
}

type RecordingState = 'idle' | 'requesting-permission' | 'countdown' | 'recording' | 'preview' | 'error';
type CameraState = 'none' | 'initializing' | 'ready' | 'error';

interface LiveSensorData {
  alpha: number;
  beta: number;
  gamma: number;
  ax: number;
  ay: number;
  az: number;
}

// ============================================
// HELPERS
// ============================================
function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function analyzeMotion(keyframes: MotionKeyframe[]): Omit<CapturedMotion, 'keyframes' | 'fps'> {
  if (keyframes.length < 2) {
    return { duration: 0, dominantMovement: 'static', intensity: 0, smoothness: 1, promptDescription: 'Static camera, no movement' };
  }

  const duration = keyframes[keyframes.length - 1].time - keyframes[0].time;

  // Calculate deltas
  let totalPan = 0, totalTilt = 0, totalZoom = 0, totalRoll = 0;
  let jitterSum = 0;

  for (let i = 1; i < keyframes.length; i++) {
    const prev = keyframes[i - 1];
    const curr = keyframes[i];
    let dAlpha = curr.alpha - prev.alpha;
    if (dAlpha > 180) dAlpha -= 360;
    if (dAlpha < -180) dAlpha += 360;
    totalPan += dAlpha;
    totalTilt += (curr.beta - prev.beta);
    totalRoll += (curr.gamma - prev.gamma);
    totalZoom += curr.az - prev.az;

    // Jitter = sum of acceleration magnitude changes
    if (i > 1) {
      const prevPrev = keyframes[i - 2];
      const prevDAx = prev.ax - prevPrev.ax;
      const currDAx = curr.ax - prev.ax;
      jitterSum += Math.abs(currDAx - prevDAx);
    }
  }

  const absPan = Math.abs(totalPan);
  const absTilt = Math.abs(totalTilt);
  const absZoom = Math.abs(totalZoom);
  const absRoll = Math.abs(totalRoll);
  const maxMovement = Math.max(absPan, absTilt, absZoom, absRoll, 0.01);

  // Determine dominant movement
  let dominantMovement = 'static';
  const parts: string[] = [];

  if (absPan > 15) {
    dominantMovement = totalPan > 0 ? 'pan-right' : 'pan-left';
    parts.push(`${totalPan > 0 ? 'pan right' : 'pan left'}`);
  }
  if (absTilt > 10) {
    if (!parts.length) dominantMovement = totalTilt > 0 ? 'tilt-down' : 'tilt-up';
    parts.push(`${totalTilt > 0 ? 'tilt down' : 'tilt up'}`);
  }
  if (absZoom > 5) {
    if (!parts.length) dominantMovement = totalZoom > 0 ? 'zoom-out' : 'zoom-in';
    parts.push(`${totalZoom > 0 ? 'push back' : 'push forward'}`);
  }
  if (absRoll > 8) {
    parts.push('slight dutch angle');
  }

  // Intensity (0-1) based on total movement magnitude
  const rawIntensity = (absPan + absTilt + absZoom * 2) / (duration / 1000 + 1);
  const intensity = clamp(rawIntensity / 60, 0, 1);

  // Smoothness (0-1) — inverse of jitter
  const avgJitter = jitterSum / Math.max(keyframes.length - 2, 1);
  const smoothness = clamp(1 - (avgJitter / 10), 0, 1);

  // Build prompt description
  const speed = intensity < 0.3 ? 'slow' : intensity < 0.6 ? 'moderate' : 'dynamic';
  const smoothAdj = smoothness > 0.6 ? 'smooth' : smoothness > 0.3 ? 'natural' : 'handheld';

  let promptDescription: string;
  if (parts.length === 0) {
    promptDescription = 'Static camera, no movement';
    dominantMovement = 'static';
  } else {
    promptDescription = `${smoothAdj} ${speed} ${parts.join(' with ')}`;
    promptDescription = promptDescription.charAt(0).toUpperCase() + promptDescription.slice(1);
  }

  return { duration, dominantMovement, intensity, smoothness, promptDescription };
}

// ============================================
// SENSOR METER COMPONENT
// ============================================
const SensorMeter: React.FC<{ label: string; value: number; max: number; color: string }> = ({ label, value, max, color }) => {
  const pct = clamp(Math.abs(value) / max * 100, 0, 100);
  const isNeg = value < 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-white/40 w-10 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
        <div className="absolute inset-0 flex">
          <div className="w-1/2" />
          <div className="w-px h-full bg-white/10" />
          <div className="w-1/2" />
        </div>
        <div
          className={`h-full rounded-full transition-all duration-75 ${color}`}
          style={{
            width: `${pct / 2}%`,
            marginLeft: isNeg ? `${50 - pct / 2}%` : '50%',
          }}
        />
      </div>
      <span className="text-[8px] text-white/30 w-8 font-mono">{value.toFixed(1)}</span>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export function MotionSyncPanel({ open, onClose, clips, onUpdateClip, audioPreviewUrl, initialTab }: MotionSyncPanelProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'motion' | 'choreography'>(initialTab || 'motion');

  // Sync tab when opened from context menu
  useEffect(() => {
    if (open && initialTab) setActiveTab(initialTab);
  }, [open, initialTab]);

  // State
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [countdown, setCountdown] = useState(3);
  const [sensorSupported, setSensorSupported] = useState<boolean | null>(null);
  const [liveSensor, setLiveSensor] = useState<LiveSensorData>({ alpha: 0, beta: 0, gamma: 0, ax: 0, ay: 0, az: 0 });
  const [capturedMotion, setCapturedMotion] = useState<CapturedMotion | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showManualMode, setShowManualMode] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Camera state
  const [cameraState, setCameraState] = useState<CameraState>('none');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState('');

  // Manual mode sliders (desktop fallback)
  const [manualPan, setManualPan] = useState(0);
  const [manualTilt, setManualTilt] = useState(0);
  const [manualZoom, setManualZoom] = useState(0);
  const [manualIntensity, setManualIntensity] = useState(50);

  // Refs
  const keyframesRef = useRef<MotionKeyframe[]>([]);
  const startTimeRef = useRef<number>(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const orientationRef = useRef<LiveSensorData>({ alpha: 0, beta: 0, gamma: 0, ax: 0, ay: 0, az: 0 });
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Image clips from layer 1
  const imageClips = useMemo(() => {
    return clips
      .filter(c => c.layerId === 1 && (c.imageUrl || c.url))
      .sort((a, b) => a.start - b.start);
  }, [clips]);

  // Select first clip by default
  useEffect(() => {
    if (imageClips.length > 0 && selectedClipIds.size === 0) {
      setSelectedClipIds(new Set([imageClips[0].id]));
    }
  }, [imageClips]);

  // Check sensor support on mount
  useEffect(() => {
    if (!open) return;
    const hasMotion = 'DeviceMotionEvent' in window;
    const hasOrientation = 'DeviceOrientationEvent' in window;
    setSensorSupported(hasMotion && hasOrientation);
    if (!hasMotion || !hasOrientation) {
      setShowManualMode(true);
    }
  }, [open]);

  // ── Camera functions ──
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
  }, []);

  const initCamera = useCallback(async () => {
    try {
      setCameraState('initializing');
      setCameraError('');

      // Check if getUserMedia is available
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('error');
        setCameraError('Cámara no disponible en este navegador. Usa modo manual.');
        setShowManualMode(true);
        return;
      }

      // Stop previous stream if any
      stopStream();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false, // We don't need mic audio for motion capture
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setCameraState('ready');
      logger.info(`📹 [MotionSync] Camera initialized (${facingMode})`);
    } catch (err: any) {
      logger.error('❌ [MotionSync] Camera access failed:', err);
      setCameraState('error');

      if (err.name === 'NotAllowedError') {
        setCameraError('Permiso de cámara denegado. Permite el acceso e intenta de nuevo.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No se encontró cámara. Conecta una cámara o usa modo manual.');
      } else if (err.name === 'NotReadableError') {
        setCameraError('La cámara está en uso por otra aplicación.');
      } else {
        setCameraError(`Error de cámara: ${err.message}`);
      }
      setShowManualMode(true);
    }
  }, [facingMode, stopStream]);

  // Initialize camera when panel opens (not in manual mode)
  useEffect(() => {
    if (open && !showManualMode) {
      initCamera();
    }
    return () => {
      if (!open) stopStream();
    };
  }, [open, facingMode]);

  // Flip camera
  const flipCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  // Cleanup on unmount/close
  useEffect(() => {
    return () => {
      stopRecording();
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Sensor handlers ──
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    orientationRef.current = {
      ...orientationRef.current,
      alpha: e.alpha || 0,
      beta: e.beta || 0,
      gamma: e.gamma || 0,
    };
    setLiveSensor(prev => ({
      ...prev,
      alpha: e.alpha || 0,
      beta: e.beta || 0,
      gamma: e.gamma || 0,
    }));
  }, []);

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity;
    if (acc) {
      orientationRef.current = {
        ...orientationRef.current,
        ax: acc.x || 0,
        ay: acc.y || 0,
        az: acc.z || 0,
      };
      setLiveSensor(prev => ({
        ...prev,
        ax: acc.x || 0,
        ay: acc.y || 0,
        az: acc.z || 0,
      }));
    }
  }, []);

  // ── Request permissions (iOS 13+) ──
  const requestPermissions = useCallback(async () => {
    setRecordingState('requesting-permission');
    try {
      // iOS 13+ requires explicit permission request
      const DME = DeviceMotionEvent as any;
      const DOE = DeviceOrientationEvent as any;
      if (typeof DME.requestPermission === 'function') {
        const motionPerm = await DME.requestPermission();
        if (motionPerm !== 'granted') throw new Error('Motion permission denied');
      }
      if (typeof DOE.requestPermission === 'function') {
        const orientPerm = await DOE.requestPermission();
        if (orientPerm !== 'granted') throw new Error('Orientation permission denied');
      }
      return true;
    } catch (err: any) {
      logger.error('[MotionSync] Permission error:', err);
      setErrorMessage(err.message || 'No se pudieron obtener permisos del sensor');
      setRecordingState('error');
      setShowManualMode(true);
      return false;
    }
  }, []);

  // ── Start recording ──
  const startRecording = useCallback(async () => {
    // Request permissions first
    if (sensorSupported && !showManualMode) {
      const granted = await requestPermissions();
      if (!granted) return;
    }

    // Countdown
    setRecordingState('countdown');
    setCountdown(3);
    let c = 3;
    countdownTimerRef.current = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        beginCapture();
      }
    }, 1000);
  }, [sensorSupported, showManualMode, requestPermissions]);

  const beginCapture = useCallback(() => {
    setRecordingState('recording');
    keyframesRef.current = [];
    startTimeRef.current = Date.now();
    setRecordingDuration(0);
    chunksRef.current = [];

    // Start listening to sensors
    if (sensorSupported && !showManualMode) {
      window.addEventListener('deviceorientation', handleOrientation);
      window.addEventListener('devicemotion', handleMotion);
    }

    // Start MediaRecorder if camera is active
    if (streamRef.current && cameraState === 'ready') {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : 'video/webm';

      try {
        const recorder = new MediaRecorder(streamRef.current, {
          mimeType,
          videoBitsPerSecond: 2500000,
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            setRecordedBlob(blob);

            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            logger.info(`✅ [MotionSync] Video recorded: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        logger.info('🔴 [MotionSync] MediaRecorder started');
      } catch (err) {
        logger.warn('⚠️ [MotionSync] MediaRecorder failed, continuing with sensors only:', err);
      }
    }

    // Capture sensor data at 30fps
    captureIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      if (showManualMode) {
        keyframesRef.current.push({
          time: elapsed,
          alpha: manualPan * 3.6,
          beta: manualTilt * 1.8,
          gamma: 0,
          ax: 0,
          ay: 0,
          az: manualZoom * 0.1,
        });
      } else {
        keyframesRef.current.push({
          time: elapsed,
          ...orientationRef.current,
        });
      }

      setRecordingDuration(elapsed);
    }, 33); // ~30fps

    // Play audio guide if available
    if (audioPreviewUrl) {
      try {
        const audio = new Audio(audioPreviewUrl);
        audio.volume = 0.5;
        audio.play().catch(() => {});
        audioRef.current = audio;
      } catch {}
    }

    // Recording timer (update display)
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration(Date.now() - startTimeRef.current);
    }, 100);
  }, [sensorSupported, showManualMode, handleOrientation, handleMotion, audioPreviewUrl, manualPan, manualTilt, manualZoom, cameraState, previewUrl]);

  const stopRecording = useCallback(() => {
    // Clear intervals
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    captureIntervalRef.current = null;
    recordingTimerRef.current = null;
    countdownTimerRef.current = null;

    // Remove listeners
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', handleMotion);

    // Stop audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Stop MediaRecorder (will trigger onstop → sets blob + previewUrl)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }

    // Process keyframes
    const kf = keyframesRef.current;
    if (kf.length > 5) {
      const analysis = analyzeMotion(kf);
      setCapturedMotion({
        keyframes: kf,
        fps: 30,
        ...analysis,
        videoBlob: recordedBlob || undefined,
        videoUrl: previewUrl || undefined,
      });
      setRecordingState('preview');
    } else {
      setRecordingState('idle');
    }
  }, [handleOrientation, handleMotion, recordedBlob, previewUrl]);

  const resetRecording = useCallback(() => {
    setCapturedMotion(null);
    keyframesRef.current = [];
    setRecordingState('idle');
    setRecordingDuration(0);
    setRecordedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    chunksRef.current = [];
  }, [previewUrl]);

  // ── Apply to clips ──
  const applyMotion = useCallback(async () => {
    if (!capturedMotion) return;
    setIsApplying(true);

    // Persist the recorded reference video so it survives reset and lives with the clip
    let motionReferenceVideoUrl: string | undefined;
    const blob = capturedMotion.videoBlob || recordedBlob;
    if (blob && blob.size > 0) {
      try {
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const form = new FormData();
        form.append('file', blob, `motion-sync.${ext}`);
        const res = await fetch('/api/upload/temp-video', { method: 'POST', body: form });
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data.url) {
            motionReferenceVideoUrl = data.url as string;
            logger.info(`[MotionSync] Reference video uploaded: ${motionReferenceVideoUrl}`);
          }
        } else {
          logger.warn(`[MotionSync] Reference video upload failed (${res.status}) — applying analysis only`);
        }
      } catch (err) {
        logger.warn('[MotionSync] Reference video upload error — applying analysis only:', err);
      }
    }

    const intensityWord = capturedMotion.intensity > 0.6 ? 'strong dynamic'
      : capturedMotion.intensity > 0.3 ? 'moderate' : 'subtle';

    selectedClipIds.forEach(clipId => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;

      onUpdateClip(clipId, {
        metadata: {
          ...clip.metadata,
          capturedMotion: {
            dominantMovement: capturedMotion.dominantMovement,
            intensity: capturedMotion.intensity,
            smoothness: capturedMotion.smoothness,
            promptDescription: capturedMotion.promptDescription,
            duration: capturedMotion.duration,
            keyframeCount: capturedMotion.keyframes.length,
          },
          cameraMovement: capturedMotion.dominantMovement,
          motionIntensity: capturedMotion.intensity,
          motionPromptSuffix: `${capturedMotion.promptDescription}, ${intensityWord} camera motion`,
          ...(motionReferenceVideoUrl ? { motionReferenceVideoUrl } : {}),
          motionSyncApplied: true,
          motionSyncAt: new Date().toISOString(),
        },
      });
    });

    logger.info(`[MotionSync] Applied motion to ${selectedClipIds.size} clips: ${capturedMotion.promptDescription}`);
    setIsApplying(false);
    resetRecording();
  }, [capturedMotion, selectedClipIds, clips, onUpdateClip, resetRecording, recordedBlob]);

  // ── Apply manual mode ──
  const applyManualMotion = useCallback(() => {
    const parts: string[] = [];
    if (Math.abs(manualPan) > 10) parts.push(manualPan > 0 ? 'pan right' : 'pan left');
    if (Math.abs(manualTilt) > 10) parts.push(manualTilt > 0 ? 'tilt down' : 'tilt up');
    if (Math.abs(manualZoom) > 10) parts.push(manualZoom > 0 ? 'zoom in' : 'zoom out');

    const intensity = manualIntensity / 100;
    const speed = intensity < 0.3 ? 'slow' : intensity < 0.6 ? 'moderate' : 'dynamic';
    const promptDescription = parts.length > 0
      ? `Smooth ${speed} ${parts.join(' with ')}`
      : 'Static camera, no movement';
    const dominantMovement = parts.length > 0 ? parts[0].replace(' ', '-') : 'static';

    selectedClipIds.forEach(clipId => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;

      onUpdateClip(clipId, {
        metadata: {
          ...clip.metadata,
          cameraMovement: dominantMovement,
          motionIntensity: intensity,
          motionPromptSuffix: promptDescription,
          motionSyncApplied: true,
          motionSyncAt: new Date().toISOString(),
        },
      });
    });

    logger.info(`[MotionSync] Applied manual motion to ${selectedClipIds.size} clips: ${promptDescription}`);
  }, [manualPan, manualTilt, manualZoom, manualIntensity, selectedClipIds, clips, onUpdateClip]);

  // Toggle clip selection
  const toggleClipSelection = useCallback((clipId: number) => {
    setSelectedClipIds(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }, []);

  const selectAllClips = useCallback(() => {
    setSelectedClipIds(new Set(imageClips.map(c => c.id)));
  }, [imageClips]);

  if (!open) return null;

  const selectedClip = imageClips.find(c => selectedClipIds.has(c.id)) || imageClips[0];
  const selectedImageUrl = selectedClip?.imageUrl || selectedClip?.url || selectedClip?.thumbnailUrl;
  const showCameraFeed = !showManualMode && cameraState !== 'none';
  const isPreviewingVideo = recordingState === 'preview' && previewUrl;

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-50 flex flex-col border-l border-white/10 bg-[#0d0d1a]/98 backdrop-blur-xl shadow-2xl shadow-black/60"
      style={{ width: isFullscreen ? '100%' : '440px', maxWidth: '100vw' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-rose-400" />
          <span className="text-sm font-semibold text-white">Motion Sync</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-rose-500/30 text-rose-400">
            {cameraState === 'ready' ? '📹 Cámara activa' : sensorSupported ? 'Sensores' : 'Manual'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setIsFullscreen(!isFullscreen)} className="h-6 w-6 p-0 text-white/40 hover:text-white/70">
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-6 w-6 p-0 text-white/40 hover:text-white/70">
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('motion')}
          className={`flex-1 px-3 py-2 text-[11px] font-semibold transition-colors ${
            activeTab === 'motion'
              ? 'text-rose-400 border-b-2 border-rose-400 bg-rose-500/5'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          📱 Movimiento
        </button>
        <button
          onClick={() => setActiveTab('choreography')}
          className={`flex-1 px-3 py-2 text-[11px] font-semibold transition-colors ${
            activeTab === 'choreography'
              ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          💃 Coreografía
        </button>
      </div>

      {/* Main content */}
      {activeTab === 'motion' ? (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Camera / Video Preview Area */}
        <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black" style={{ aspectRatio: '16/9' }}>
          {/* Live camera feed */}
          {!isPreviewingVideo && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraState !== 'ready' ? 'hidden' : ''}`}
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          )}

          {/* Recorded video preview */}
          {isPreviewingVideo && (
            <video
              ref={previewVideoRef}
              src={previewUrl}
              controls
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          )}

          {/* Camera initializing state */}
          {!isPreviewingVideo && cameraState === 'initializing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
              <Loader2 size={28} className="text-rose-400 animate-spin mb-2" />
              <span className="text-[11px] text-white/60">Iniciando cámara...</span>
            </div>
          )}

          {/* Camera error / no camera state */}
          {!isPreviewingVideo && (cameraState === 'error' || cameraState === 'none') && !showManualMode && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-2">
              <VideoOff size={28} className="text-white/20" />
              <span className="text-[11px] text-white/40">{cameraError || 'Cámara no iniciada'}</span>
              <Button size="sm" onClick={initCamera} className="h-7 text-[10px] bg-rose-600 hover:bg-rose-700 gap-1">
                <Camera size={12} /> Conectar Cámara
              </Button>
            </div>
          )}

          {/* Manual mode fallback: show selected clip image */}
          {!isPreviewingVideo && showManualMode && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90">
              {selectedImageUrl ? (
                <img src={selectedImageUrl} alt="Scene" className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Move size={32} className="text-white/15" />
                  <span className="text-[11px] text-white/30">Modo Manual</span>
                </div>
              )}
            </div>
          )}

          {/* Recording indicator */}
          {recordingState === 'recording' && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600/90 rounded-full px-2.5 py-1 shadow-lg">
              <CircleDot size={10} className="text-white animate-pulse" />
              <span className="text-[10px] text-white font-bold">{formatTime(recordingDuration)}</span>
            </div>
          )}

          {/* Countdown overlay */}
          {recordingState === 'countdown' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <span className="text-6xl font-bold text-white animate-pulse">{countdown}</span>
            </div>
          )}

          {/* Camera controls overlay (top-left) */}
          {!isPreviewingVideo && cameraState === 'ready' && recordingState !== 'recording' && (
            <div className="absolute top-3 left-3 flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={flipCamera}
                className="h-7 w-7 p-0 bg-black/50 hover:bg-black/70 rounded-full"
                title={facingMode === 'user' ? 'Cámara trasera' : 'Cámara frontal'}
              >
                <SwitchCamera size={14} className="text-white" />
              </Button>
            </div>
          )}

          {/* Motion overlay during preview */}
          {isPreviewingVideo && capturedMotion && (
            <div className="absolute bottom-3 left-3 bg-black/60 rounded-lg px-2 py-1">
              <div className="flex items-center gap-1.5">
                <Move size={10} className="text-rose-400" />
                <span className="text-[9px] text-white/80 font-medium">{capturedMotion.dominantMovement}</span>
              </div>
            </div>
          )}
        </div>

        {/* Live sensor data (during recording or idle) */}
        {!isPreviewingVideo && (
          <div className="space-y-1.5">
            <div className="text-[9px] text-white/30 uppercase tracking-wide font-medium mb-1">Sensor Data</div>
            <SensorMeter label="Pan" value={liveSensor.alpha > 180 ? liveSensor.alpha - 360 : liveSensor.alpha} max={180} color="bg-rose-500" />
            <SensorMeter label="Tilt" value={liveSensor.beta} max={90} color="bg-amber-500" />
            <SensorMeter label="Roll" value={liveSensor.gamma} max={45} color="bg-violet-500" />
            <SensorMeter label="Zoom" value={liveSensor.az} max={15} color="bg-cyan-500" />
          </div>
        )}

        {/* Recording controls */}
        <div className="flex items-center gap-2">
          {recordingState === 'idle' && (
            <>
              <Button
                onClick={showManualMode ? () => beginCapture() : startRecording}
                className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                <CircleDot size={14} /> {cameraState === 'ready' ? 'Grabar Video + Movimiento' : 'Grabar Movimiento'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const next = !showManualMode;
                  setShowManualMode(next);
                  if (!next && cameraState !== 'ready') initCamera();
                }}
                className="h-9 px-3 text-[10px] border-white/10 gap-1"
                title={showManualMode ? 'Usar cámara + sensores' : 'Modo manual'}
              >
                {showManualMode ? <Camera size={12} /> : <Move size={12} />}
                {showManualMode ? 'Cámara' : 'Manual'}
              </Button>
            </>
          )}
          {recordingState === 'recording' && (
            <Button onClick={stopRecording} className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white gap-2">
              <Square size={14} /> Detener ({formatTime(recordingDuration)})
            </Button>
          )}
          {recordingState === 'countdown' && (
            <div className="flex-1 h-9 flex items-center justify-center text-white/60">
              <Loader2 size={14} className="animate-spin mr-2" />
              Preparando... {countdown}
            </div>
          )}
          {recordingState === 'requesting-permission' && (
            <div className="flex-1 h-9 flex items-center justify-center text-white/60">
              <Loader2 size={14} className="animate-spin mr-2" />
              Solicitando permisos...
            </div>
          )}
          {recordingState === 'preview' && (
            <>
              <Button onClick={applyMotion} className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white gap-2" disabled={selectedClipIds.size === 0 || isApplying}>
                {isApplying ? (
                  <><Loader2 size={14} className="animate-spin" /> Guardando referencia...</>
                ) : (
                  <><Check size={14} /> Aplicar ({selectedClipIds.size} clips)</>
                )}
              </Button>
              <Button variant="outline" onClick={resetRecording} disabled={isApplying} className="h-9 px-3 border-white/10 gap-1">
                <RotateCcw size={12} /> Reset
              </Button>
            </>
          )}
          {recordingState === 'error' && (
            <>
              <div className="flex-1 flex items-center gap-2 text-red-400 text-[11px]">
                <AlertCircle size={14} /> {errorMessage}
              </div>
              <Button variant="outline" onClick={resetRecording} className="h-9 px-3 border-white/10">
                <RotateCcw size={12} />
              </Button>
            </>
          )}
        </div>

        {/* Captured motion analysis */}
        {capturedMotion && recordingState === 'preview' && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-rose-400 uppercase tracking-wide font-medium">Análisis de Movimiento</div>
              {recordedBlob && (
                <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-green-500/30 text-green-400 gap-1">
                  <Video size={8} /> {(recordedBlob.size / 1024 / 1024).toFixed(1)}MB
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-white/40">Movimiento:</span>
                <Badge variant="outline" className="ml-1 text-[9px] border-rose-500/30 text-rose-300">
                  {capturedMotion.dominantMovement}
                </Badge>
              </div>
              <div>
                <span className="text-white/40">Duración:</span>
                <span className="text-white/70 ml-1">{formatTime(capturedMotion.duration)}</span>
              </div>
              <div>
                <span className="text-white/40">Intensidad:</span>
                <div className="inline-block w-16 h-1.5 bg-white/10 rounded-full ml-1 align-middle">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${capturedMotion.intensity * 100}%` }} />
                </div>
              </div>
              <div>
                <span className="text-white/40">Suavidad:</span>
                <div className="inline-block w-16 h-1.5 bg-white/10 rounded-full ml-1 align-middle">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${capturedMotion.smoothness * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-1 p-2 rounded bg-black/30 border border-white/5">
              <div className="text-[8px] text-white/25 uppercase mb-0.5">Prompt de cámara</div>
              <p className="text-[11px] text-white/70 italic">"{capturedMotion.promptDescription}"</p>
            </div>
          </div>
        )}

        {/* Manual mode controls */}
        {showManualMode && recordingState !== 'preview' && (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Modo Manual</div>
              {sensorSupported && (
                <button onClick={() => setShowManualMode(false)} className="text-[9px] text-rose-400 hover:text-rose-300">
                  Usar sensores →
                </button>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/50">Pan (Izq/Der)</span>
                  <span className="text-[9px] text-white/30 font-mono">{manualPan}</span>
                </div>
                <Slider
                  value={[manualPan]}
                  min={-100}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setManualPan(v)}
                  className="h-1.5"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/50">Tilt (Arr/Ab)</span>
                  <span className="text-[9px] text-white/30 font-mono">{manualTilt}</span>
                </div>
                <Slider
                  value={[manualTilt]}
                  min={-100}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setManualTilt(v)}
                  className="h-1.5"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/50">Zoom</span>
                  <span className="text-[9px] text-white/30 font-mono">{manualZoom}</span>
                </div>
                <Slider
                  value={[manualZoom]}
                  min={-100}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setManualZoom(v)}
                  className="h-1.5"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/50">Intensidad</span>
                  <span className="text-[9px] text-white/30 font-mono">{manualIntensity}%</span>
                </div>
                <Slider
                  value={[manualIntensity]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setManualIntensity(v)}
                  className="h-1.5"
                />
              </div>
            </div>
            <Button
              onClick={applyManualMotion}
              disabled={selectedClipIds.size === 0}
              className="w-full h-8 bg-rose-600 hover:bg-rose-700 text-white text-[11px] gap-2"
            >
              <Check size={12} /> Aplicar Movimiento Manual ({selectedClipIds.size} clips)
            </Button>
          </div>
        )}

        {/* Clip selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Clips a aplicar</span>
            <button onClick={selectAllClips} className="text-[9px] text-rose-400 hover:text-rose-300">
              Seleccionar todos
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto">
            {imageClips.map((clip, idx) => {
              const isSelected = selectedClipIds.has(clip.id);
              const hasMotion = clip.metadata?.motionSyncApplied;
              const imgUrl = clip.imageUrl || clip.url || clip.thumbnailUrl;
              return (
                <button
                  key={clip.id}
                  onClick={() => toggleClipSelection(clip.id)}
                  className={`relative rounded-md overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-rose-500 ring-1 ring-rose-500/30'
                      : 'border-transparent hover:border-white/20'
                  }`}
                >
                  <div className="aspect-video bg-white/5">
                    {imgUrl && (
                      <img src={imgUrl} alt={`Clip ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="absolute top-0.5 left-0.5 bg-black/70 rounded px-1 py-0.5">
                    <span className="text-[7px] font-bold text-white/80">#{idx + 1}</span>
                  </div>
                  {isSelected && (
                    <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-rose-500 rounded-full flex items-center justify-center">
                      <Check size={8} className="text-white" />
                    </div>
                  )}
                  {hasMotion && (
                    <div className="absolute bottom-0.5 right-0.5">
                      <Waves size={8} className="text-green-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-1.5">Instrucciones</div>
          <div className="text-[11px] text-white/50 space-y-1 leading-relaxed">
            {showManualMode ? (
              <>
                <p>Usa los sliders para definir el movimiento de cámara:</p>
                <p>• <strong className="text-white/70">Pan</strong>: Movimiento horizontal (izquierda/derecha)</p>
                <p>• <strong className="text-white/70">Tilt</strong>: Movimiento vertical (arriba/abajo)</p>
                <p>• <strong className="text-white/70">Zoom</strong>: Acercar o alejar la cámara</p>
                <p>• <strong className="text-white/70">Intensidad</strong>: Velocidad del movimiento</p>
              </>
            ) : (
              <>
                <p>📹 Conecta tu cámara y mueve el dispositivo como un camarógrafo:</p>
                <p>• <strong className="text-white/70">Cámara</strong>: Se graba video en vivo para referencia</p>
                <p>• <strong className="text-white/70">Pan</strong>: Gira izquierda/derecha con el teléfono</p>
                <p>• <strong className="text-white/70">Tilt</strong>: Inclina arriba/abajo</p>
                <p>• <strong className="text-white/70">Zoom</strong>: Acerca/aleja del cuerpo</p>
                <p>• <strong className="text-white/70">Audio</strong>: Se reproduce como guía de tiempo</p>
                <p className="text-white/30 text-[10px] mt-1">💡 Usa el botón 🔄 para alternar cámara frontal/trasera</p>
              </>
            )}
          </div>
        </div>
      </div>
      ) : (
      /* Choreography tab */
      <div className="flex-1 overflow-y-auto p-4">
        <ChoreographyPanel
          clips={clips}
          onUpdateClip={onUpdateClip}
          audioPreviewUrl={audioPreviewUrl}
        />
      </div>
      )}
    </div>
  );
}

export default MotionSyncPanel;
