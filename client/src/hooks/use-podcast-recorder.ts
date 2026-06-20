/**
 * Hook: usePodcastRecorder — Records the canvas compositor output using MediaRecorder API
 * Supports: video recording, audio-only, pause/resume, chunk collection, download, upload
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { CanvasCompositor } from '../lib/canvas-compositor';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  fileSize: number;
  chunks: number;
}

interface UsePodcastRecorderReturn {
  state: RecordingState;
  startRecording: (audioOnly?: boolean) => void;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  downloadRecording: (filename?: string) => void;
  getRecordingBlob: () => Blob | null;
  uploadRecording: (sessionId: number, userId: string) => Promise<{ recordingId: number; url: string } | null>;
}

export function usePodcastRecorder(
  compositor: CanvasCompositor | null,
  localStream: MediaStream | null
): UsePodcastRecorderReturn {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    fileSize: 0,
    chunks: 0,
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const getMimeType = (): string => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm';
  };

  const getAudioMimeType = (): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm';
  };

  const startRecording = useCallback((audioOnly = false) => {
    if (!compositor && !localStream) return;

    chunksRef.current = [];
    blobRef.current = null;

    let stream: MediaStream;

    if (audioOnly && localStream) {
      // Audio-only: just capture audio tracks
      const audioTracks = localStream.getAudioTracks();
      stream = new MediaStream(audioTracks);
    } else if (compositor) {
      // Full video: canvas output stream + local audio
      const canvasStream = compositor.getOutputStream(30);
      const tracks = [...canvasStream.getVideoTracks()];

      // Merge audio from local stream
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        tracks.push(...audioTracks);
      }
      stream = new MediaStream(tracks);
    } else {
      return;
    }

    const mimeType = audioOnly ? getAudioMimeType() : getMimeType();
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: audioOnly ? undefined : 4_000_000, // 4 Mbps for video
      audioBitsPerSecond: 192_000, // 192 kbps for audio
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        setState(prev => ({
          ...prev,
          chunks: chunksRef.current.length,
          fileSize: chunksRef.current.reduce((acc, c) => acc + c.size, 0),
        }));
      }
    };

    recorder.onstop = () => {
      blobRef.current = new Blob(chunksRef.current, { type: mimeType });
      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        fileSize: blobRef.current?.size || 0,
      }));
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    // Collect data every 1 second for smooth progress
    recorder.start(1000);
    recorderRef.current = recorder;
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;

    // Duration timer
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
      setState(prev => ({ ...prev, duration: Math.floor(elapsed / 1000) }));
    }, 500);

    setState({
      isRecording: true,
      isPaused: false,
      duration: 0,
      fileSize: 0,
      chunks: 0,
    });
  }, [compositor, localStream]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!recorderRef.current || recorderRef.current.state === 'inactive') {
        resolve(blobRef.current);
        return;
      }

      recorderRef.current.onstop = () => {
        const mimeType = recorderRef.current?.mimeType || 'video/webm';
        blobRef.current = new Blob(chunksRef.current, { type: mimeType });
        setState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          fileSize: blobRef.current?.size || 0,
        }));
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        resolve(blobRef.current);
      };

      recorderRef.current.stop();
    });
  }, []);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.pause();
      pausedAtRef.current = Date.now();
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'paused') {
      pausedDurationRef.current += Date.now() - pausedAtRef.current;
      recorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, []);

  const getRecordingBlob = useCallback((): Blob | null => {
    return blobRef.current;
  }, []);

  const downloadRecording = useCallback((filename?: string) => {
    const blob = blobRef.current;
    if (!blob) return;

    const ext = blob.type.includes('audio') ? 'webm' : 'webm';
    const name = filename || `podcast-recording-${Date.now()}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const uploadRecording = useCallback(async (
    sessionId: number,
    userId: string
  ): Promise<{ recordingId: number; url: string } | null> => {
    const blob = blobRef.current;
    if (!blob) return null;

    const formData = new FormData();
    const ext = blob.type.includes('audio') ? 'webm' : 'webm';
    formData.append('recording', blob, `recording-${sessionId}-${Date.now()}.${ext}`);
    formData.append('sessionId', String(sessionId));
    formData.append('userId', userId);
    formData.append('duration', String(state.duration));
    formData.append('mimeType', blob.type);
    formData.append('fileSize', String(blob.size));
    formData.append('recordingType', blob.type.includes('audio') ? 'audio_only' : 'video');

    const res = await fetch('/api/podcast-studio/recordings/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }, [state.duration]);

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
    getRecordingBlob,
    uploadRecording,
  };
}
