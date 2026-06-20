/**
 * Live Podcast Studio — Main page
 * Three phases: Setup → Live Room → Publish
 * Recording engine (MediaRecorder), audio processing (Web Audio), episode publishing
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from '../components/layout/header';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../hooks/use-toast';
import { useMediaDevices } from '../hooks/use-media-devices';
import { usePodcastRoom } from '../hooks/use-podcast-room';
import { usePodcastRecorder } from '../hooks/use-podcast-recorder';
import { AudioProcessor, type AudioLevels } from '../lib/audio-processor';
import { StudioSetup, SessionConfig } from '../components/podcast-studio/studio-setup';
import { StudioRoom } from '../components/podcast-studio/studio-room';
import { EpisodePublisher, type EpisodeData } from '../components/podcast-studio/episode-publisher';
import {
  Radio, ArrowLeft, ListMusic
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { getPodcastSocket } from '../lib/socket';

export default function LivePodcastStudioPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<'setup' | 'room' | 'publish'>('setup');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [sessionSettings, setSessionSettings] = useState<any>(null);

  // Media devices
  const media = useMediaDevices();

  // Podcast room connection
  const room = usePodcastRoom(media.localStream);

  // Audio processor refs (declared before recorder so processedStream is available)
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({ peak: 0, rms: 0, clipping: false });
  const levelsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recording engine — use processed audio stream when available, fallback to raw
  const recorderAudioStream = processedStreamRef.current || media.localStream;
  const recorder = usePodcastRecorder(room.compositor, recorderAudioStream);

  // Initialize audio processor when local stream is available
  useEffect(() => {
    if (media.localStream && phase === 'room') {
      try {
        const processor = new AudioProcessor();
        // getProcessedStream initializes the audio chain and returns processed stream
        const processed = processor.getProcessedStream(media.localStream);
        audioProcessorRef.current = processor;
        processedStreamRef.current = processed;

        // Poll audio levels ~30fps
        levelsIntervalRef.current = setInterval(() => {
          if (audioProcessorRef.current) {
            setAudioLevels(audioProcessorRef.current.getLevels());
          }
        }, 33);
      } catch {
        // Audio processing not critical — continue without it
      }
    }

    return () => {
      if (levelsIntervalRef.current) clearInterval(levelsIntervalRef.current);
      if (audioProcessorRef.current) {
        audioProcessorRef.current.cleanup();
        audioProcessorRef.current = null;
        processedStreamRef.current = null;
      }
    };
  }, [media.localStream, phase]);

  // Auto-record if session settings have autoRecord enabled
  const autoRecordTriggeredRef = useRef(false);
  useEffect(() => {
    if (phase === 'room' && sessionSettings?.autoRecord && !autoRecordTriggeredRef.current && room.compositor) {
      autoRecordTriggeredRef.current = true;
      // Small delay to let compositor initialize
      const timer = setTimeout(() => {
        recorder.startRecording(false);
        room.emitRecordingState('start');
        toast({ title: '🎬 Auto-recording started' });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, sessionSettings, room.compositor]);

  // Soundboard — listen for incoming sounds from other participants
  const [incomingSound, setIncomingSound] = useState<{ soundId: string; soundName: string; playedBy: string } | null>(null);
  useEffect(() => {
    if (phase !== 'room') return;
    const socket = getPodcastSocket();
    const handler = (data: { soundId: string; soundName: string; playedBy: string }) => {
      setIncomingSound(data);
      setTimeout(() => setIncomingSound(null), 3000);
    };
    socket.on('podcast:soundboard', handler);
    return () => { socket.off('podcast:soundboard', handler); };
  }, [phase]);

  const handlePlaySound = useCallback((soundId: string, soundName: string) => {
    const socket = getPodcastSocket();
    socket.emit('podcast:soundboard', {
      roomCode,
      soundId,
      soundName,
    });
  }, [roomCode]);

  const handleStartSession = useCallback(async (config: SessionConfig) => {
    if (!user) {
      toast({ title: 'Please log in', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/podcast-studio/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: String(user.id),
          title: config.title,
          description: config.description,
          sessionType: config.sessionType,
          layout: config.layout,
          maxParticipants: config.maxParticipants,
          settings: config.settings,
        }),
      });

      if (!res.ok) throw new Error('Failed to create session');
      const session = await res.json();

      setSessionId(session.id);
      setSessionTitle(session.title);
      setSessionDescription(config.description || '');
      setRoomCode(session.roomCode);
      setSessionSettings(config.settings || null);

      room.joinRoom(
        session.roomCode,
        String(user.id),
        user.username || user.email || 'Host',
        '',
        'host'
      );

      setPhase('room');
      toast({ title: 'Studio room created!', description: `Room code: ${session.roomCode}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [user, room, toast]);

  const handleGoLive = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch(`/api/podcast-studio/sessions/${sessionId}/go-live`, { method: 'POST' });
      room.goLive();
      toast({ title: '🔴 You are LIVE!' });
    } catch (err: any) {
      toast({ title: 'Error going live', description: err.message, variant: 'destructive' });
    }
  }, [sessionId, room, toast]);

  const handleEndStream = useCallback(async () => {
    if (!sessionId) return;
    const msg = recorder.state.isRecording
      ? 'You are still recording. End the stream and stop recording?'
      : 'End the live stream for all viewers?';
    if (!window.confirm(msg)) return;
    try {
      if (recorder.state.isRecording) {
        await recorder.stopRecording();
        room.emitRecordingState('stop');
      }
      await fetch(`/api/podcast-studio/sessions/${sessionId}/end`, { method: 'POST' });
      room.endStream();
      toast({ title: 'Stream ended' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [sessionId, room, recorder, toast]);

  const handleLeaveRoom = useCallback(() => {
    if (recorder.state.isRecording) {
      if (!window.confirm('You are recording. Leave room and stop recording?')) return;
      recorder.stopRecording();
      room.emitRecordingState('stop');
    } else if (room.isLive) {
      if (!window.confirm('You are LIVE. Leaving will end the stream for viewers. Continue?')) return;
    }
    room.leaveRoom();
    setPhase('setup');
    setSessionId(null);
    setRoomCode('');
  }, [room, recorder]);

  // Recording handlers — sync state to server via socket
  const handleStartRecording = useCallback((audioOnly?: boolean) => {
    recorder.startRecording(audioOnly);
    room.emitRecordingState('start');
    if (sessionId) {
      fetch(`/api/podcast-studio/sessions/${sessionId}/recording-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRecording: true }),
      }).catch(() => {});
    }
    toast({ title: audioOnly ? '🎙️ Audio recording started' : '🎬 Recording started' });
  }, [recorder, room, sessionId, toast]);

  const handleStopRecording = useCallback(async () => {
    const blob = await recorder.stopRecording();
    room.emitRecordingState('stop');
    if (sessionId) {
      fetch(`/api/podcast-studio/sessions/${sessionId}/recording-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRecording: false }),
      }).catch(() => {});
    }
    if (blob) {
      toast({ title: '✅ Recording stopped', description: 'Ready to publish or download' });
    }
  }, [recorder, room, sessionId, toast]);

  const handlePauseRecording = useCallback(() => {
    recorder.pauseRecording();
    room.emitRecordingState('pause');
  }, [recorder, room]);

  const handleResumeRecording = useCallback(() => {
    recorder.resumeRecording();
    room.emitRecordingState('resume');
  }, [recorder, room]);

  const handleDownloadRecording = useCallback(() => {
    recorder.downloadRecording(sessionTitle || 'podcast-recording');
  }, [recorder, sessionTitle]);

  const handlePublishRecording = useCallback(() => {
    // Transition to publish phase
    setPhase('publish');
  }, []);

  const handlePublishEpisode = useCallback(async (episodeData: EpisodeData) => {
    if (!user || !sessionId) return;
    setIsPublishing(true);

    try {
      // Step 1: Upload the recording
      const uploadResult = await recorder.uploadRecording(sessionId, String(user.id));
      if (!uploadResult) throw new Error('Failed to upload recording');

      // Step 2: Create the episode
      const episodeRes = await fetch('/api/podcast-studio/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: String(user.id),
          recordingId: uploadResult.recordingId,
          sessionId,
          title: episodeData.title,
          description: episodeData.description,
          showNotes: episodeData.showNotes,
          tags: episodeData.tags,
          category: episodeData.category,
          episodeNumber: episodeData.episodeNumber,
          seasonNumber: episodeData.seasonNumber,
          language: episodeData.language,
          explicit: episodeData.explicit,
          chapters: episodeData.chapters,
          audioUrl: uploadResult.url,
          duration: recorder.state.duration,
          fileSize: recorder.state.fileSize,
        }),
      });

      if (!episodeRes.ok) throw new Error('Failed to create episode');
      const episode = await episodeRes.json();

      // Step 3: Publish if requested
      if (episodeData.publishNow) {
        await fetch(`/api/podcast-studio/episodes/${episode.id}/publish`, { method: 'POST' });
        toast({ title: '🎉 Episode Published!', description: `"${episodeData.title}" is now live` });
      } else {
        toast({ title: '📝 Draft Saved', description: `"${episodeData.title}" saved as draft` });
      }

      // Return to setup
      setPhase('setup');
      setSessionId(null);
      setRoomCode('');
    } catch (err: any) {
      toast({ title: 'Publish Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  }, [user, sessionId, recorder, toast]);

  const handleUpdateOverlay = useCallback((type: string, text?: string, subtext?: string) => {
    room.emitOverlay(type, text, subtext);
  }, [room]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/boostify-tv')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Boostify TV
            </Button>
            <div className="h-6 w-px bg-gray-700" />
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radio className="w-6 h-6 text-purple-400" />
              Live Podcast Studio
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/podcast-episodes')}
              className="text-xs border-gray-600 text-gray-300 hover:text-white"
            >
              <ListMusic className="w-4 h-4 mr-1" /> My Episodes
            </Button>
            {phase === 'room' && room.isLive && (
              <Badge className="bg-red-600 text-white animate-pulse">LIVE</Badge>
            )}
            {phase === 'room' && recorder.state.isRecording && (
              <Badge className="bg-red-500 text-white animate-pulse">REC</Badge>
            )}
          </div>
          {media.error && (
            <Badge variant="outline" className="text-red-400 border-red-400">
              {media.error}
            </Badge>
          )}
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={phase === 'room' ? 'h-[calc(100vh-180px)]' : ''}
          >
            {phase === 'setup' && (
              <StudioSetup
                videoDevices={media.videoDevices}
                audioDevices={media.audioDevices}
                selectedVideoDevice={media.selectedVideoDevice}
                selectedAudioDevice={media.selectedAudioDevice}
                onSelectVideoDevice={media.setSelectedVideoDevice}
                onSelectAudioDevice={media.setSelectedAudioDevice}
                isMuted={media.isMuted}
                isCameraOff={media.isCameraOff}
                onToggleMute={media.toggleMute}
                onToggleCamera={media.toggleCamera}
                localStream={media.localStream}
                onStartSession={handleStartSession}
              />
            )}

            {phase === 'room' && (
              <StudioRoom
                sessionTitle={sessionTitle}
                roomCode={roomCode}
                isLive={room.isLive}
                layout={room.layout}
                participants={room.participants}
                messages={room.messages}
                viewerCount={room.viewerCount}
                localStream={media.localStream}
                compositor={room.compositor}
                isMuted={media.isMuted}
                isCameraOff={media.isCameraOff}
                isScreenSharing={media.isScreenSharing}
                recordingState={recorder.state}
                audioLevels={audioLevels}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                onPauseRecording={handlePauseRecording}
                onResumeRecording={handleResumeRecording}
                onDownloadRecording={handleDownloadRecording}
                onPublishRecording={handlePublishRecording}
                onToggleMute={media.toggleMute}
                onToggleCamera={media.toggleCamera}
                onStartScreenShare={media.startScreenShare}
                onStopScreenShare={media.stopScreenShare}
                onSendMessage={room.sendMessage}
                onSendReaction={room.sendReaction}
                onChangeLayout={room.changeLayout}
                onGoLive={handleGoLive}
                onEndStream={handleEndStream}
                onMuteParticipant={room.muteParticipant}
                onLeaveRoom={handleLeaveRoom}
                onUpdateOverlay={handleUpdateOverlay}
                onPlaySound={handlePlaySound}
                incomingSound={incomingSound}
              />
            )}

            {phase === 'publish' && (
              <EpisodePublisher
                sessionTitle={sessionTitle}
                sessionDescription={sessionDescription}
                recordingDuration={recorder.state.duration}
                recordingSize={recorder.state.fileSize}
                onPublish={handlePublishEpisode}
                onBack={() => setPhase('room')}
                isUploading={isPublishing}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
