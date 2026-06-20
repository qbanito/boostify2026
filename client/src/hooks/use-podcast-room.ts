/**
 * Hook: usePodcastRoom — Manages the full podcast room lifecycle
 * Connects Socket.io, WebRTC peers, and canvas compositor
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { connectPodcastSocket, disconnectPodcastSocket, getPodcastSocket } from '../lib/socket';
import { WebRTCManager } from '../lib/webrtc-manager';
import { CanvasCompositor, LayoutMode } from '../lib/canvas-compositor';

interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: 'host' | 'cohost' | 'guest' | 'viewer';
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
  messageType: 'chat' | 'question' | 'reaction' | 'system';
  timestamp: number;
}

interface UsePodcastRoomReturn {
  isConnected: boolean;
  participants: Participant[];
  messages: ChatMessage[];
  viewerCount: number;
  layout: LayoutMode;
  isLive: boolean;
  compositor: CanvasCompositor | null;
  joinRoom: (roomCode: string, userId: string, displayName: string, avatarUrl: string, role: string) => void;
  leaveRoom: () => void;
  sendMessage: (message: string, type?: string) => void;
  sendReaction: (emoji: string) => void;
  changeLayout: (layout: LayoutMode, focusId?: string) => void;
  goLive: () => void;
  endStream: () => void;
  muteParticipant: (socketId: string, muted: boolean) => void;
  emitOverlay: (type: string, text?: string, subtext?: string) => void;
  emitRecordingState: (action: 'start' | 'pause' | 'resume' | 'stop') => void;
}

export function usePodcastRoom(localStream: MediaStream | null): UsePodcastRoomReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [layout, setLayout] = useState<LayoutMode>('solo');
  const [isLive, setIsLive] = useState(false);

  const roomCodeRef = useRef<string>('');
  const connectedRef = useRef(false);
  const webrtcRef = useRef<WebRTCManager>(new WebRTCManager());
  const compositorRef = useRef<CanvasCompositor>(new CanvasCompositor(1280, 720));

  // Set local stream on WebRTC manager
  useEffect(() => {
    if (localStream) {
      webrtcRef.current.setLocalStream(localStream);
      compositorRef.current.addSource('local', 'You', localStream);
    }
  }, [localStream]);

  const joinRoom = useCallback((roomCode: string, userId: string, displayName: string, avatarUrl: string, role: string) => {
    roomCodeRef.current = roomCode;
    const socket = connectPodcastSocket();

    socket.emit('podcast:join', { roomCode, userId, displayName, avatarUrl, role });
    setIsConnected(true);
    connectedRef.current = true;

    // Setup WebRTC signaling via socket
    webrtcRef.current.setSendSignal((targetSocketId, signal, type) => {
      socket.emit('podcast:signal', { targetSocketId, signal, type });
    });

    webrtcRef.current.onRemoteStreamCallback((socketId, stream) => {
      setParticipants(prev => prev.map(p =>
        p.socketId === socketId ? { ...p, stream } : p
      ));
      const peer = webrtcRef.current.getPeer(socketId);
      if (peer) {
        compositorRef.current.addSource(socketId, peer.displayName, stream);
      }
    });

    webrtcRef.current.onPeerDisconnectedCallback((socketId) => {
      compositorRef.current.removeSource(socketId);
    });

    // ── Socket event handlers ──
    socket.on('podcast:room-state', (data: { participants: any[]; viewerCount: number }) => {
      setViewerCount(data.viewerCount);
      setParticipants(data.participants.map((p: any) => ({
        socketId: p.socketId || '',
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        role: p.role,
      })));
    });

    socket.on('podcast:participant-joined', async (data: any) => {
      setViewerCount(data.viewerCount);
      setParticipants(prev => {
        if (prev.find(p => p.socketId === data.socketId)) return prev;
        return [...prev, {
          socketId: data.socketId,
          userId: data.userId,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
          role: data.role,
        }];
      });
      // Create WebRTC offer to new participant (if not viewer)
      if (data.role !== 'viewer' && data.socketId !== socket.id) {
        await webrtcRef.current.createOffer(data.socketId, data.userId, data.displayName);
      }
    });

    socket.on('podcast:participant-left', (data: any) => {
      setViewerCount(data.viewerCount);
      setParticipants(prev => prev.filter(p => p.socketId !== data.socketId));
      webrtcRef.current.removePeer(data.socketId);
      compositorRef.current.removeSource(data.socketId);
    });

    socket.on('podcast:signal', async (data: any) => {
      const { fromSocketId, fromUserId, fromDisplayName, signal, type } = data;
      if (type === 'offer') {
        await webrtcRef.current.handleOffer(fromSocketId, fromUserId, fromDisplayName, signal);
      } else if (type === 'answer') {
        await webrtcRef.current.handleAnswer(fromSocketId, signal);
      } else if (type === 'ice-candidate') {
        await webrtcRef.current.handleIceCandidate(fromSocketId, signal);
      }
    });

    socket.on('podcast:chat', (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-200), msg]);
    });

    socket.on('podcast:layout', (data: { layout: LayoutMode; focusParticipantId?: string }) => {
      setLayout(data.layout);
      compositorRef.current.setLayout(data.layout, data.focusParticipantId);
    });

    socket.on('podcast:participant-muted', (data: any) => {
      setParticipants(prev => prev.map(p =>
        p.socketId === data.targetSocketId ? { ...p, isMuted: data.muted } : p
      ));
    });

    socket.on('podcast:muted-by-host', (data: { muted: boolean }) => {
      // Handle being muted by host — disable audio track
      if (localStream) {
        localStream.getAudioTracks().forEach(t => { t.enabled = !data.muted; });
      }
    });

    socket.on('podcast:goLive', () => {
      setIsLive(true);
    });

    socket.on('podcast:endStream', () => {
      setIsLive(false);
    });
  }, [localStream]);

  const leaveRoom = useCallback(() => {
    const socket = getPodcastSocket();
    socket.emit('podcast:leave');
    disconnectPodcastSocket();
    webrtcRef.current.destroy();
    compositorRef.current.destroy();
    setIsConnected(false);
    connectedRef.current = false;
    roomCodeRef.current = '';
    setParticipants([]);
    setMessages([]);
    setIsLive(false);
  }, []);

  const sendMessage = useCallback((message: string, type?: string) => {
    const socket = getPodcastSocket();
    socket.emit('podcast:chat', {
      roomCode: roomCodeRef.current,
      message,
      messageType: type || 'chat',
    });
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    const socket = getPodcastSocket();
    socket.emit('podcast:reaction', {
      roomCode: roomCodeRef.current,
      emoji,
    });
  }, []);

  const changeLayout = useCallback((newLayout: LayoutMode, focusId?: string) => {
    const socket = getPodcastSocket();
    socket.emit('podcast:layout', {
      roomCode: roomCodeRef.current,
      layout: newLayout,
      focusParticipantId: focusId,
    });
    setLayout(newLayout);
    compositorRef.current.setLayout(newLayout, focusId);
  }, []);

  const goLive = useCallback(() => {
    const socket = getPodcastSocket();
    socket.emit('podcast:goLive', { roomCode: roomCodeRef.current });
  }, []);

  const endStream = useCallback(() => {
    const socket = getPodcastSocket();
    socket.emit('podcast:endStream', { roomCode: roomCodeRef.current });
  }, []);

  const muteParticipant = useCallback((socketId: string, muted: boolean) => {
    const socket = getPodcastSocket();
    socket.emit('podcast:mute', {
      roomCode: roomCodeRef.current,
      targetSocketId: socketId,
      muted,
    });
  }, []);

  const emitOverlay = useCallback((type: string, text?: string, subtext?: string) => {
    const socket = getPodcastSocket();
    socket.emit('podcast:overlay', {
      roomCode: roomCodeRef.current,
      overlayType: type,
      text,
      subtext,
    });
  }, []);

  const emitRecordingState = useCallback((action: 'start' | 'pause' | 'resume' | 'stop') => {
    const socket = getPodcastSocket();
    socket.emit('podcast:recording', {
      roomCode: roomCodeRef.current,
      action,
    });
  }, []);

  // Cleanup on unmount — use ref to avoid stale closure
  useEffect(() => {
    return () => {
      if (connectedRef.current) {
        const socket = getPodcastSocket();
        socket.emit('podcast:leave');
        disconnectPodcastSocket();
        webrtcRef.current.destroy();
        compositorRef.current.destroy();
      }
    };
  }, []);

  return {
    isConnected,
    participants,
    messages,
    viewerCount,
    layout,
    isLive,
    compositor: compositorRef.current,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendReaction,
    changeLayout,
    goLive,
    endStream,
    muteParticipant,
    emitOverlay,
    emitRecordingState,
  };
}
