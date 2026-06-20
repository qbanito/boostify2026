/**
 * StudioRoom — Professional live studio room with recording, overlays, audio metering
 * Features: recording controls, audio level meters, overlay panel, soundboard, full chat
 */
import React, { useRef, useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Radio, Square, Users, MessageSquare,
  Send, Copy, Settings, Download, Pause, Play,
  Circle, StopCircle, Upload, Type, Sliders,
  Volume2, VolumeX, Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Soundboard } from './soundboard';
import type { LayoutMode } from '../../lib/canvas-compositor';
import type { CanvasCompositor } from '../../lib/canvas-compositor';
import type { RecordingState } from '../../hooks/use-podcast-recorder';
import type { AudioLevels } from '../../lib/audio-processor';

interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  stream?: MediaStream;
  isMuted?: boolean;
  isCameraOff?: boolean;
}

interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  message: string;
  messageType: string;
  timestamp: number;
}

interface StudioRoomProps {
  sessionTitle: string;
  roomCode: string;
  isLive: boolean;
  layout: LayoutMode;
  participants: Participant[];
  messages: ChatMessage[];
  viewerCount: number;
  localStream: MediaStream | null;
  compositor: CanvasCompositor | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  // Recording
  recordingState: RecordingState;
  audioLevels: AudioLevels;
  onStartRecording: (audioOnly?: boolean) => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onDownloadRecording: () => void;
  onPublishRecording: () => void;
  // Media
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onSendMessage: (msg: string, type?: string) => void;
  onSendReaction: (emoji: string) => void;
  onChangeLayout: (layout: LayoutMode, focusId?: string) => void;
  onGoLive: () => void;
  onEndStream: () => void;
  onMuteParticipant: (socketId: string, muted: boolean) => void;
  onLeaveRoom: () => void;
  onUpdateOverlay?: (type: string, text?: string, subtext?: string) => void;
  onPlaySound?: (soundId: string, soundName: string) => void;
  incomingSound?: { soundId: string; soundName: string; playedBy: string } | null;
}

export function StudioRoom({
  sessionTitle,
  roomCode,
  isLive,
  layout,
  participants,
  messages,
  viewerCount,
  localStream,
  compositor,
  isMuted,
  isCameraOff,
  isScreenSharing,
  recordingState,
  audioLevels,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onDownloadRecording,
  onPublishRecording,
  onToggleMute,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onSendMessage,
  onSendReaction,
  onChangeLayout,
  onGoLive,
  onEndStream,
  onMuteParticipant,
  onLeaveRoom,
  onUpdateOverlay,
  onPlaySound,
  incomingSound,
}: StudioRoomProps) {
  const [chatInput, setChatInput] = useState('');
  const [activePanel, setActivePanel] = useState<'chat' | 'settings' | 'sounds' | null>('chat');
  const [liveDuration, setLiveDuration] = useState(0);
  const [lowerThirdText, setLowerThirdText] = useState('');
  const [lowerThirdSub, setLowerThirdSub] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const canvasPreviewRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Attach canvas to preview
  useEffect(() => {
    if (compositor && canvasPreviewRef.current) {
      const canvas = compositor.getCanvas();
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'contain';
      canvasPreviewRef.current.innerHTML = '';
      canvasPreviewRef.current.appendChild(canvas);
    }
  }, [compositor]);

  // Local video preview
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Live timer
  useEffect(() => {
    if (!isLive) { setLiveDuration(0); return; }
    const interval = setInterval(() => setLiveDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleSend = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  const applyOverlay = () => {
    if (compositor && lowerThirdText) {
      compositor.setOverlay({
        showLowerThirds: true,
        lowerThirdText,
        lowerThirdSubtext: lowerThirdSub || undefined,
      });
      onUpdateOverlay?.('lower-third', lowerThirdText, lowerThirdSub);
    }
  };

  const clearOverlay = () => {
    if (compositor) {
      compositor.setOverlay({ showLowerThirds: false, lowerThirdText: undefined, lowerThirdSubtext: undefined, tickerText: undefined });
      onUpdateOverlay?.('clear');
    }
    setLowerThirdText('');
    setLowerThirdSub('');
  };

  const reactionEmojis = ['🔥', '❤️', '👏', '🎉', '😂', '🤯', '🎵', '💯'];

  const layoutOptions: { value: LayoutMode; label: string; icon: string }[] = [
    { value: 'solo', label: 'Solo', icon: '🎤' },
    { value: 'split', label: 'Split', icon: '👥' },
    { value: 'grid', label: 'Grid', icon: '⊞' },
    { value: 'pip', label: 'PiP', icon: '📌' },
    { value: 'interview', label: 'Interview', icon: '🎙️' },
  ];

  const getLevelColor = (level: number) => {
    if (level > 0.9) return 'bg-red-500';
    if (level > 0.7) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/60 rounded-xl border border-gray-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white truncate max-w-[220px]">{sessionTitle}</h2>
          {isLive && (
            <Badge className="bg-red-600 text-white animate-pulse flex items-center gap-1 text-xs">
              <Radio className="w-3 h-3" /> LIVE {fmt(liveDuration)}
            </Badge>
          )}
          {recordingState.isRecording && (
            <Badge className="bg-red-700 text-white flex items-center gap-1 text-xs">
              <Circle className="w-2 h-2 fill-current animate-pulse" /> REC {fmt(recordingState.duration)}
            </Badge>
          )}
          {!isLive && !recordingState.isRecording && (
            <Badge variant="outline" className="text-gray-400 text-xs">Setup</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Audio level meter */}
          <div className="flex items-center gap-1.5 mr-2">
            <Volume2 className="w-3 h-3 text-gray-400" />
            <div className="flex gap-px items-end h-4">
              {Array.from({ length: 12 }).map((_, i) => {
                const threshold = (i + 1) / 12;
                const active = audioLevels.peak >= threshold;
                return (
                  <div
                    key={i}
                    className={`w-1 rounded-sm transition-all duration-75 ${
                      active
                        ? i >= 10 ? 'bg-red-500' : i >= 8 ? 'bg-yellow-400' : 'bg-green-400'
                        : 'bg-gray-700'
                    }`}
                    style={{ height: `${4 + i * 1}px` }}
                  />
                );
              })}
            </div>
            {audioLevels.clipping && <span className="text-[9px] text-red-400 font-bold">CLIP</span>}
          </div>
          <Badge variant="outline" className="text-gray-400 flex items-center gap-1 text-xs">
            <Users className="w-3 h-3" /> {viewerCount}
          </Badge>
          <Button size="sm" variant="ghost" onClick={copyRoomCode} className="text-[11px] text-gray-400 h-6 px-2">
            <Copy className="w-3 h-3 mr-1" /> {roomCode}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Canvas + Controls */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Canvas preview */}
          <Card className="flex-1 bg-black border-gray-800 overflow-hidden relative">
            <div ref={canvasPreviewRef} className="w-full h-full" />
            {recordingState.isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${recordingState.isPaused ? 'bg-yellow-500' : 'bg-red-600 animate-pulse'}`} />
                <span className="text-xs text-white bg-black/70 px-2 py-0.5 rounded font-mono">
                  {recordingState.isPaused ? 'PAUSED' : 'REC'} {fmt(recordingState.duration)}
                </span>
              </div>
            )}
          </Card>

          {/* Participant thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <div className="flex-shrink-0 w-28 h-20 rounded-lg overflow-hidden border-2 border-purple-500 relative">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {isCameraOff && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <VideoOff className="w-5 h-5 text-gray-500" />
                </div>
              )}
              <span className="absolute bottom-0.5 left-1 text-[9px] text-white bg-black/60 px-1 rounded">You</span>
              {isMuted && <MicOff className="absolute top-0.5 right-0.5 w-3 h-3 text-red-400" />}
            </div>
            {participants.filter(p => p.role !== 'viewer').map(p => (
              <ParticipantThumbnail
                key={p.socketId}
                participant={p}
                onMute={(muted) => onMuteParticipant(p.socketId, muted)}
              />
            ))}
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between bg-gray-900/80 rounded-xl px-3 py-2 border border-gray-800 flex-wrap gap-2">
            {/* Media controls */}
            <div className="flex gap-1.5">
              <Button size="sm" variant={isMuted ? 'destructive' : 'secondary'} onClick={onToggleMute} className="rounded-full w-9 h-9 p-0" title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant={isCameraOff ? 'destructive' : 'secondary'} onClick={onToggleCamera} className="rounded-full w-9 h-9 p-0">
                {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant={isScreenSharing ? 'default' : 'secondary'} onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare} className="rounded-full w-9 h-9 p-0">
                {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </Button>
            </div>

            {/* Recording controls */}
            <div className="flex items-center gap-1.5">
              {!recordingState.isRecording ? (
                <>
                  <Button size="sm" onClick={() => onStartRecording(false)} className="bg-red-700 hover:bg-red-800 text-white text-xs h-8 px-3">
                    <Circle className="w-3 h-3 mr-1 fill-current" /> Record
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onStartRecording(true)} className="text-xs h-8 px-2 border-gray-600">
                    <Headphones className="w-3 h-3 mr-1" /> Audio
                  </Button>
                </>
              ) : (
                <>
                  {recordingState.isPaused ? (
                    <Button size="sm" onClick={onResumeRecording} className="bg-green-700 hover:bg-green-800 text-white text-xs h-8 px-3">
                      <Play className="w-3 h-3 mr-1" /> Resume
                    </Button>
                  ) : (
                    <Button size="sm" onClick={onPauseRecording} className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs h-8 px-3">
                      <Pause className="w-3 h-3 mr-1" /> Pause
                    </Button>
                  )}
                  <Button size="sm" onClick={onStopRecording} variant="destructive" className="text-xs h-8 px-3">
                    <StopCircle className="w-3 h-3 mr-1" /> Stop
                  </Button>
                </>
              )}
              {!recordingState.isRecording && recordingState.fileSize > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={onDownloadRecording} className="text-xs h-8 px-2 border-gray-600" title="Download">
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button size="sm" onClick={onPublishRecording} className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 px-3">
                    <Upload className="w-3 h-3 mr-1" /> Publish
                  </Button>
                </>
              )}
            </div>

            {/* Layout switcher */}
            <div className="flex gap-1 bg-gray-800/50 rounded-lg p-0.5">
              {layoutOptions.map(l => (
                <Button
                  key={l.value}
                  size="sm"
                  variant={layout === l.value ? 'default' : 'ghost'}
                  onClick={() => onChangeLayout(l.value)}
                  className={`text-xs h-7 px-2 ${layout === l.value ? 'bg-purple-600 shadow-md shadow-purple-600/30' : ''}`}
                >
                  <span className="mr-1">{l.icon}</span> {l.label}
                </Button>
              ))}
            </div>

            {/* Live / End / Leave */}
            <div className="flex gap-1.5">
              {!isLive ? (
                <Button onClick={onGoLive} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 px-4" size="sm">
                  <Radio className="w-4 h-4 mr-1" /> Go Live
                </Button>
              ) : (
                <Button onClick={onEndStream} variant="destructive" size="sm" className="text-xs h-8 px-3">
                  <Square className="w-3 h-3 mr-1" /> End
                </Button>
              )}
              <Button onClick={onLeaveRoom} variant="ghost" size="sm" className="text-red-400 hover:text-red-300 h-8 w-8 p-0">
                <PhoneOff className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2">
          {/* Panel tabs */}
          <div className="flex bg-gray-900/60 rounded-lg p-0.5 border border-gray-800">
            <button
              onClick={() => setActivePanel(activePanel === 'chat' ? null : 'chat')}
              className={`flex-1 text-xs py-1.5 rounded transition-all flex items-center justify-center gap-1 ${
                activePanel === 'chat' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3 h-3" /> Chat
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}
              className={`flex-1 text-xs py-1.5 rounded transition-all flex items-center justify-center gap-1 ${
                activePanel === 'settings' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3 h-3" /> Controls
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'sounds' ? null : 'sounds')}
              className={`flex-1 text-xs py-1.5 rounded transition-all flex items-center justify-center gap-1 ${
                activePanel === 'sounds' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              🎛️ Sounds
            </button>
          </div>

          {/* Chat Panel */}
          {activePanel === 'chat' && (
            <Card className="flex-1 flex flex-col bg-gray-900/50 border-gray-800">
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-1.5">
                  <AnimatePresence>
                    {messages.map(msg => (
                      <motion.div key={msg.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-xs">
                        {msg.messageType === 'reaction' ? (
                          <span className="text-lg">{msg.message}</span>
                        ) : (
                          <>
                            <span className="font-semibold text-purple-400">{msg.displayName}</span>
                            <span className="text-gray-300 ml-1">{msg.message}</span>
                          </>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="px-2 py-1 flex gap-1 border-t border-gray-800 flex-wrap">
                {reactionEmojis.map(emoji => (
                  <button key={emoji} onClick={() => onSendReaction(emoji)} className="text-sm hover:scale-125 transition-transform active:scale-90">
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-gray-800 flex gap-1">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..."
                  className="bg-gray-800 border-gray-700 text-xs h-8"
                />
                <Button size="sm" onClick={handleSend} className="h-8 w-8 p-0 bg-purple-600 hover:bg-purple-700">
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          )}

          {/* Controls / Settings Panel */}
          {activePanel === 'settings' && (
            <Card className="flex-1 flex flex-col bg-gray-900/50 border-gray-800 overflow-y-auto">
              <div className="p-3 space-y-4">
                {/* Lower Third / Overlays */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1"><Type className="w-3 h-3" /> Lower Third</h4>
                  <Input value={lowerThirdText} onChange={e => setLowerThirdText(e.target.value)} placeholder="Main text..." className="bg-gray-800 border-gray-700 text-xs h-7" />
                  <Input value={lowerThirdSub} onChange={e => setLowerThirdSub(e.target.value)} placeholder="Subtext..." className="bg-gray-800 border-gray-700 text-xs h-7" />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={applyOverlay} className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs h-7">Show</Button>
                    <Button size="sm" variant="outline" onClick={clearOverlay} className="flex-1 text-xs h-7 border-gray-600">Clear</Button>
                  </div>
                </div>

                {/* Participants list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1"><Users className="w-3 h-3" /> Participants ({participants.length})</h4>
                  <div className="space-y-1">
                    {participants.filter(p => p.role !== 'viewer').map(p => (
                      <div key={p.socketId} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-purple-500/30 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                            {p.displayName[0]?.toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs text-white">{p.displayName}</span>
                            <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">{p.role}</Badge>
                          </div>
                        </div>
                        <button onClick={() => onMuteParticipant(p.socketId, !p.isMuted)} className="p-1 hover:bg-gray-700 rounded">
                          {p.isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-gray-400" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audio Levels */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1"><Volume2 className="w-3 h-3" /> Audio Levels</h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-8">Peak</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div className={`h-full ${getLevelColor(audioLevels.peak)} rounded-full`} animate={{ width: `${Math.min(audioLevels.peak * 100, 100)}%` }} transition={{ duration: 0.05 }} />
                      </div>
                      <span className="text-[10px] text-gray-500 w-10 text-right font-mono">{(audioLevels.peak * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-8">RMS</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-blue-500 rounded-full" animate={{ width: `${Math.min(audioLevels.rms * 100, 100)}%` }} transition={{ duration: 0.05 }} />
                      </div>
                      <span className="text-[10px] text-gray-500 w-10 text-right font-mono">{(audioLevels.rms * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* Session Info */}
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-gray-300">Session Info</h4>
                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    <p>Room: {roomCode}</p>
                    <p>Layout: {layout}</p>
                    <p>Status: {isLive ? 'LIVE' : recordingState.isRecording ? 'Recording' : 'Setup'}</p>
                    {recordingState.isRecording && <p>Duration: {fmt(recordingState.duration)}</p>}
                    {recordingState.fileSize > 0 && <p>Size: {formatBytes(recordingState.fileSize)}</p>}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activePanel === 'sounds' && (
            <Card className="flex-1 flex flex-col bg-gray-900/50 border-gray-800 overflow-y-auto">
              <div className="p-3">
                <Soundboard
                  onPlaySound={(soundId, soundName) => onPlaySound?.(soundId, soundName)}
                  incomingSound={incomingSound}
                />
              </div>
            </Card>
          )}

          {!activePanel && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500 text-xs">
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="ghost" onClick={() => setActivePanel('chat')}><MessageSquare className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setActivePanel('settings')}><Settings className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Participant Thumbnail ──
function ParticipantThumbnail({ participant, onMute }: { participant: Participant; onMute: (muted: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="flex-shrink-0 w-28 h-20 rounded-lg overflow-hidden border border-gray-700 relative group">
      {participant.stream ? (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
          <span className="text-xl">{participant.displayName[0]?.toUpperCase()}</span>
        </div>
      )}
      <span className="absolute bottom-0.5 left-1 text-[9px] text-white bg-black/60 px-1 rounded truncate max-w-[90%]">
        {participant.displayName}
      </span>
      {participant.isMuted && <MicOff className="absolute top-0.5 right-0.5 w-3 h-3 text-red-400" />}
      {/* Mute button on hover */}
      <button
        onClick={() => onMute(!participant.isMuted)}
        className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-0.5"
      >
        {participant.isMuted ? <MicOff className="w-3 h-3 text-red-400" /> : <Mic className="w-3 h-3 text-white" />}
      </button>
    </div>
  );
}
