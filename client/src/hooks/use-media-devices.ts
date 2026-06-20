/**
 * Hook: useMediaDevices — Enumerates cameras/mics, manages local stream
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface UseMediaDevicesReturn {
  localStream: MediaStream | null;
  videoDevices: MediaDeviceInfo[];
  audioDevices: MediaDeviceInfo[];
  selectedVideoDevice: string;
  selectedAudioDevice: string;
  setSelectedVideoDevice: (id: string) => void;
  setSelectedAudioDevice: (id: string) => void;
  isMuted: boolean;
  isCameraOff: boolean;
  toggleMute: () => void;
  toggleCamera: () => void;
  isScreenSharing: boolean;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  error: string | null;
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const initializedRef = useRef(false);

  // Enumerate devices
  useEffect(() => {
    async function enumerate() {
      try {
        // Must request permission first to get labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        setVideoDevices(
          devices
            .filter(d => d.kind === 'videoinput')
            .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}`, kind: d.kind }))
        );
        setAudioDevices(
          devices
            .filter(d => d.kind === 'audioinput')
            .map(d => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 5)}`, kind: d.kind }))
        );

        // Use this stream as the initial one
        setLocalStream(tempStream);
        cameraStreamRef.current = tempStream;

        // Set initial selections (skip switchStream on first set via initializedRef)
        const videoTrack = tempStream.getVideoTracks()[0];
        const audioTrack = tempStream.getAudioTracks()[0];
        if (videoTrack) setSelectedVideoDevice(videoTrack.getSettings().deviceId || '');
        if (audioTrack) setSelectedAudioDevice(audioTrack.getSettings().deviceId || '');

        // Mark initialized after setting initial device IDs
        // The useEffect below will skip switchStream on this first set
        requestAnimationFrame(() => { initializedRef.current = true; });
      } catch (err: any) {
        setError(err.message || 'Failed to access camera/microphone');
      }
    }
    enumerate();

    return () => {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Switch devices
  const switchStream = useCallback(async (videoId?: string, audioId?: string) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: videoId ? { deviceId: { exact: videoId } } : true,
        audio: audioId ? { deviceId: { exact: audioId } } : true,
      };
      
      // Stop old tracks
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;

      // Preserve mute/camera state
      stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
      stream.getVideoTracks().forEach(t => { t.enabled = !isCameraOff; });

      setLocalStream(stream);
    } catch (err: any) {
      setError(err.message);
    }
  }, [isMuted, isCameraOff]);

  useEffect(() => {
    if (!initializedRef.current) return; // Skip the initial set from enumerate
    if (selectedVideoDevice || selectedAudioDevice) {
      switchStream(selectedVideoDevice || undefined, selectedAudioDevice || undefined);
    }
  }, [selectedVideoDevice, selectedAudioDevice, switchStream]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  }, [localStream, isMuted]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.enabled = isCameraOff; });
      setIsCameraOff(!isCameraOff);
    }
  }, [localStream, isCameraOff]);

  const startScreenShare = useCallback(async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screen;
      setIsScreenSharing(true);

      // Combine screen video with mic audio
      const audioTrack = localStream?.getAudioTracks()[0];
      const combined = new MediaStream([
        screen.getVideoTracks()[0],
        ...(audioTrack ? [audioTrack] : []),
      ]);
      setLocalStream(combined);

      // When screen share stops
      screen.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    }
  }, [localStream]);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
    // Restore camera
    if (cameraStreamRef.current) {
      setLocalStream(cameraStreamRef.current);
    }
  }, []);

  return {
    localStream,
    videoDevices,
    audioDevices,
    selectedVideoDevice,
    selectedAudioDevice,
    setSelectedVideoDevice,
    setSelectedAudioDevice,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    error,
  };
}
