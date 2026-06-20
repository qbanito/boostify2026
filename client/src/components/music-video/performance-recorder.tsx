/**
 * 🎤 Performance Recorder Component
 * Graba al artista cantando/performeando su canción para motion transfer
 * 
 * FLUJO:
 * 1. Accede a la cámara (frontal por defecto)
 * 2. Reproduce el audio de la canción como guía
 * 3. Graba video + audio del artista sincronizado
 * 4. Preview y opción de re-grabar
 * 5. Retorna el Blob del video grabado
 * 
 * INTEGRACIÓN:
 * - Usado en Step 3 (opcional) del CreativeOnboardingModal
 * - El video grabado se sube a Firebase y se usa como driving video para DreamActor v2
 * - Se segmenta por timestamps cuando el pipeline procesa clips PERFORMANCE
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logger } from "../../lib/logger";
import { 
  Video, Camera, Mic, MicOff, Play, Square, RotateCcw, 
  Check, AlertCircle, Loader2, Monitor, Smartphone
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PerformanceRecorderProps {
  /** Audio file to play as guide while recording */
  audioFile: File;
  /** Artist name for UI display */
  artistName: string;
  /** Song name for UI display */
  songName: string;
  /** Called when recording is complete and approved */
  onRecordingComplete: (videoBlob: Blob) => void;
  /** Called when user wants to skip this step */
  onSkip: () => void;
}

type RecordingState = 'idle' | 'preparing' | 'countdown' | 'recording' | 'preview' | 'error';

export function PerformanceRecorder({
  audioFile,
  artistName,
  songName,
  onRecordingComplete,
  onSkip
}: PerformanceRecorderProps) {
  // Recording states
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [countdown, setCountdown] = useState(3);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Create audio URL from file
  useEffect(() => {
    const url = URL.createObjectURL(audioFile);
    audioUrlRef.current = url;
    
    // Get audio duration
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(audio.duration);
      logger.info(`🎵 [RECORDER] Audio duration: ${audio.duration.toFixed(1)}s`);
    });
    
    return () => {
      URL.revokeObjectURL(url);
      audioUrlRef.current = null;
    };
  }, [audioFile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const initCamera = useCallback(async () => {
    try {
      setRecordingState('preparing');
      setErrorMessage('');

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true // Capture mic audio too for potential use
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Mute preview to avoid echo
        await videoRef.current.play();
      }

      setRecordingState('idle');
      logger.info('📹 [RECORDER] Camera initialized successfully');
    } catch (err: any) {
      logger.error('❌ [RECORDER] Camera access failed:', err);
      setHasPermission(false);
      setRecordingState('error');
      
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Camera access denied. Please allow camera permissions and try again.');
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('No camera found. Please connect a camera and try again.');
      } else {
        setErrorMessage(`Camera error: ${err.message}`);
      }
    }
  }, [facingMode]);

  // Initialize camera on mount
  useEffect(() => {
    initCamera();
    return () => stopStream();
  }, [facingMode]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    // Start countdown
    setRecordingState('countdown');
    let count = 3;
    setCountdown(count);

    countdownRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        beginActualRecording();
      }
    }, 1000);
  }, []);

  const beginActualRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setRecordingDuration(0);
    setRecordingState('recording');

    // Determine supported MIME type
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/mp4')
          ? 'video/mp4'
          : 'video/webm';

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      
      // Create preview URL
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setRecordingState('preview');
      
      logger.info(`✅ [RECORDER] Recording complete: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000); // Collect data every second

    // Start audio playback as guide
    if (audioUrlRef.current) {
      const audio = new Audio(audioUrlRef.current);
      audio.volume = 0.7;
      audio.play().catch(err => {
        logger.warn('⚠️ [RECORDER] Audio playback failed:', err);
      });
      audioRef.current = audio;

      // Auto-stop when audio ends
      audio.addEventListener('ended', () => {
        stopRecording();
      });
    }

    // Timer for recording duration
    timerRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    logger.info('🔴 [RECORDER] Recording started');
  }, [previewUrl]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    logger.info('⏹️ [RECORDER] Recording stopped');
  }, []);

  const handleReRecord = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedBlob(null);
    setRecordingDuration(0);
    setRecordingState('idle');
    
    // Re-init camera
    initCamera();
  }, [previewUrl, initCamera]);

  const handleConfirm = useCallback(() => {
    if (recordedBlob) {
      onRecordingComplete(recordedBlob);
    }
  }, [recordedBlob, onRecordingComplete]);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card className="bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-red-500/20 p-3 rounded-lg">
              <Video className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Performance Recording</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Record yourself performing to <strong>"{songName}"</strong>. 
                The AI will use your movements and expressions to create realistic performance clips.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                  <Camera className="h-3 w-3 mr-1" />
                  Motion Transfer
                </Badge>
                <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">
                  <Mic className="h-3 w-3 mr-1" />
                  Lip-sync
                </Badge>
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                  Optional
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            Tips for the best results
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-1.5">
              <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Good lighting on your face</span>
            </div>
            <div className="flex items-start gap-1.5">
              <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Face the camera directly</span>
            </div>
            <div className="flex items-start gap-1.5">
              <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Sing or lip-sync naturally</span>
            </div>
            <div className="flex items-start gap-1.5">
              <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Move with expression</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Camera Preview / Recording Area */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video border-2 border-muted">
        <AnimatePresence mode="wait">
          {/* Error State */}
          {recordingState === 'error' && (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center"
            >
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-sm mb-4">{errorMessage}</p>
              <Button variant="outline" size="sm" onClick={initCamera}>
                <RotateCcw className="h-4 w-4 mr-2" /> Retry
              </Button>
            </motion.div>
          )}

          {/* Preparing State */}
          {recordingState === 'preparing' && (
            <motion.div 
              key="preparing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white"
            >
              <Loader2 className="h-10 w-10 animate-spin text-orange-500 mb-3" />
              <p className="text-sm">Initializing camera...</p>
            </motion.div>
          )}

          {/* Countdown Overlay */}
          {recordingState === 'countdown' && (
            <motion.div 
              key="countdown"
              className="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
            >
              <motion.div
                key={countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="text-8xl font-bold text-white drop-shadow-lg"
              >
                {countdown}
              </motion.div>
            </motion.div>
          )}

          {/* Recording Indicator */}
          {recordingState === 'recording' && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                REC {formatTime(recordingDuration)}
              </div>
              {audioDuration > 0 && (
                <div className="bg-black/60 text-white px-2 py-1 rounded-full text-xs">
                  / {formatTime(Math.ceil(audioDuration))}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* Live Camera Feed */}
        {recordingState !== 'preview' && recordingState !== 'error' && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        )}

        {/* Preview Playback */}
        {recordingState === 'preview' && previewUrl && (
          <video
            ref={previewVideoRef}
            src={previewUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        {/* Camera Flip Button */}
        {(recordingState === 'idle' || recordingState === 'countdown') && (
          <button
            onClick={toggleCamera}
            className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
            title="Switch camera"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {recordingState === 'idle' && hasPermission && (
          <Button
            onClick={startRecording}
            size="lg"
            className="bg-red-500 hover:bg-red-600 text-white px-8 py-6 text-lg rounded-full"
          >
            <div className="w-4 h-4 rounded-full bg-white mr-3" />
            Start Recording
          </Button>
        )}

        {(recordingState === 'recording' || recordingState === 'countdown') && (
          <Button
            onClick={stopRecording}
            size="lg"
            variant="destructive"
            className="px-8 py-6 text-lg rounded-full"
            disabled={recordingState === 'countdown'}
          >
            <Square className="h-5 w-5 mr-2 fill-current" />
            Stop
          </Button>
        )}

        {recordingState === 'preview' && (
          <>
            <Button
              onClick={handleReRecord}
              variant="outline"
              size="lg"
              className="px-6"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Re-record
            </Button>
            <Button
              onClick={handleConfirm}
              size="lg"
              className="bg-green-500 hover:bg-green-600 text-white px-8"
            >
              <Check className="h-5 w-5 mr-2" />
              Use This Recording
            </Button>
          </>
        )}
      </div>

      {/* Recording Info */}
      {recordedBlob && recordingState === 'preview' && (
        <div className="text-center text-sm text-muted-foreground">
          Duration: {formatTime(recordingDuration)} • 
          Size: {(recordedBlob.size / 1024 / 1024).toFixed(1)} MB
        </div>
      )}
    </div>
  );
}
