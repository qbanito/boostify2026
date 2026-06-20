/**
 * Socket.io Server — Real-time communication for Live Podcast Studio
 * Handles: signaling, chat, reactions, layout changes, viewer counts
 */
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

// Track active rooms: roomCode → Set of socket IDs
const activeRooms = new Map<string, Set<string>>();
// Track viewer counts per room
const viewerCounts = new Map<string, number>();

export function initSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST']
    },
    path: '/socket.io',
    // Solo WebSocket — el fallback HTTP polling generaba ~1 req/s por cliente y saturaba memoria en Render
    transports: ['websocket']
  });

  // Podcast Studio namespace
  const podcastNs = io.of('/podcast');

  podcastNs.on('connection', (socket: Socket) => {
    console.log(`🎙️ [Podcast] Socket connected: ${socket.id}`);

    // ── JOIN ROOM ──
    socket.on('podcast:join', (data: {
      roomCode: string;
      userId: string;
      displayName: string;
      avatarUrl?: string;
      role: 'host' | 'cohost' | 'guest' | 'viewer';
    }) => {
      const { roomCode, userId, displayName, avatarUrl, role } = data;
      socket.join(roomCode);

      // Track active sockets in room
      if (!activeRooms.has(roomCode)) {
        activeRooms.set(roomCode, new Set());
      }
      activeRooms.get(roomCode)!.add(socket.id);

      // Update viewer count
      const count = activeRooms.get(roomCode)!.size;
      viewerCounts.set(roomCode, count);

      // Store user info on socket
      (socket as any).userData = { roomCode, userId, displayName, avatarUrl, role };

      // Notify room about new participant
      podcastNs.to(roomCode).emit('podcast:participant-joined', {
        socketId: socket.id,
        userId,
        displayName,
        avatarUrl,
        role,
        viewerCount: count
      });

      // Send current room state to the new participant
      const roomSockets = Array.from(activeRooms.get(roomCode) || []);
      const participants = roomSockets
        .map(sid => {
          const s = podcastNs.sockets.get(sid);
          return s ? (s as any).userData : null;
        })
        .filter(Boolean);

      socket.emit('podcast:room-state', {
        participants,
        viewerCount: count
      });

      console.log(`🎙️ [Podcast] ${displayName} (${role}) joined room ${roomCode} — ${count} in room`);
    });

    // ── LEAVE ROOM ──
    socket.on('podcast:leave', () => {
      handleDisconnect(socket, podcastNs);
    });

    // ── WEBRTC SIGNALING ──
    socket.on('podcast:signal', (data: {
      targetSocketId: string;
      signal: any; // SDP offer/answer or ICE candidate
      type: 'offer' | 'answer' | 'ice-candidate';
    }) => {
      const { targetSocketId, signal, type } = data;
      const userData = (socket as any).userData;
      podcastNs.to(targetSocketId).emit('podcast:signal', {
        fromSocketId: socket.id,
        fromUserId: userData?.userId,
        fromDisplayName: userData?.displayName,
        signal,
        type
      });
    });

    // ── CHAT MESSAGE ──
    socket.on('podcast:chat', (data: {
      roomCode: string;
      message: string;
      messageType?: 'chat' | 'question' | 'reaction' | 'system';
    }) => {
      const userData = (socket as any).userData;
      if (!userData) return;

      podcastNs.to(data.roomCode).emit('podcast:chat', {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: userData.userId,
        displayName: userData.displayName,
        avatarUrl: userData.avatarUrl,
        message: data.message,
        messageType: data.messageType || 'chat',
        timestamp: Date.now()
      });
    });

    // ── REACTIONS ──
    socket.on('podcast:reaction', (data: {
      roomCode: string;
      emoji: string;
    }) => {
      const userData = (socket as any).userData;
      if (!userData) return;

      podcastNs.to(data.roomCode).emit('podcast:reaction', {
        userId: userData.userId,
        displayName: userData.displayName,
        emoji: data.emoji,
        timestamp: Date.now()
      });
    });

    // ── LAYOUT CHANGE (host only) ──
    socket.on('podcast:layout', (data: {
      roomCode: string;
      layout: 'solo' | 'split' | 'grid' | 'pip' | 'interview';
      focusParticipantId?: string;
    }) => {
      const userData = (socket as any).userData;
      if (!userData || (userData.role !== 'host' && userData.role !== 'cohost')) return;

      podcastNs.to(data.roomCode).emit('podcast:layout', {
        layout: data.layout,
        focusParticipantId: data.focusParticipantId,
        changedBy: userData.displayName
      });
    });

    // ── MUTE PARTICIPANT (host only) ──
    socket.on('podcast:mute', (data: {
      roomCode: string;
      targetSocketId: string;
      muted: boolean;
    }) => {
      const userData = (socket as any).userData;
      if (!userData || userData.role !== 'host') return;

      podcastNs.to(data.targetSocketId).emit('podcast:muted-by-host', {
        muted: data.muted
      });
      podcastNs.to(data.roomCode).emit('podcast:participant-muted', {
        targetSocketId: data.targetSocketId,
        muted: data.muted
      });
    });

    // ── GO LIVE ──
    socket.on('podcast:goLive', (data: { roomCode: string }) => {
      const userData = (socket as any).userData;
      if (!userData || userData.role !== 'host') return;

      podcastNs.to(data.roomCode).emit('podcast:goLive', {
        startedAt: Date.now()
      });
      console.log(`🔴 [Podcast] Room ${data.roomCode} is now LIVE`);
    });

    // ── END STREAM ──
    socket.on('podcast:endStream', (data: { roomCode: string }) => {
      const userData = (socket as any).userData;
      if (!userData || userData.role !== 'host') return;

      podcastNs.to(data.roomCode).emit('podcast:endStream', {
        endedAt: Date.now()
      });
      console.log(`⏹️ [Podcast] Room ${data.roomCode} stream ended`);
    });

    // ── POLL ──
    socket.on('podcast:poll', (data: {
      roomCode: string;
      action: 'create' | 'vote';
      poll?: { question: string; options: string[] };
      pollId?: string;
      optionIndex?: number;
    }) => {
      const userData = (socket as any).userData;
      if (!userData) return;

      if (data.action === 'create' && (userData.role === 'host' || userData.role === 'cohost')) {
        podcastNs.to(data.roomCode).emit('podcast:poll', {
          action: 'created',
          pollId: `poll_${Date.now()}`,
          question: data.poll?.question,
          options: data.poll?.options?.map(o => ({ text: o, votes: 0 })),
          createdBy: userData.displayName
        });
      } else if (data.action === 'vote') {
        podcastNs.to(data.roomCode).emit('podcast:poll', {
          action: 'vote',
          pollId: data.pollId,
          optionIndex: data.optionIndex,
          votedBy: userData.displayName
        });
      }
    });

    // ── RECORDING STATE (host only) ──
    socket.on('podcast:recording', (data: {
      roomCode: string;
      action: 'start' | 'pause' | 'resume' | 'stop';
    }) => {
      const userData = (socket as any).userData;
      if (!userData || userData.role !== 'host') return;

      podcastNs.to(data.roomCode).emit('podcast:recording', {
        action: data.action,
        timestamp: Date.now(),
        startedBy: userData.displayName
      });
      console.log(`🎬 [Podcast] Room ${data.roomCode} recording: ${data.action}`);
    });

    // ── SOUND BOARD (host/cohost — play sound effects to room) ──
    socket.on('podcast:soundboard', (data: {
      roomCode: string;
      soundId: string;
      soundName: string;
    }) => {
      const userData = (socket as any).userData;
      if (!userData || (userData.role !== 'host' && userData.role !== 'cohost')) return;

      podcastNs.to(data.roomCode).emit('podcast:soundboard', {
        soundId: data.soundId,
        soundName: data.soundName,
        playedBy: userData.displayName,
        timestamp: Date.now()
      });
    });

    // ── LOWER THIRD (host/cohost — overlay text) ──
    socket.on('podcast:overlay', (data: {
      roomCode: string;
      overlayType: 'lower-third' | 'ticker' | 'clear';
      text?: string;
      subtext?: string;
    }) => {
      const userData = (socket as any).userData;
      if (!userData || (userData.role !== 'host' && userData.role !== 'cohost')) return;

      podcastNs.to(data.roomCode).emit('podcast:overlay', {
        overlayType: data.overlayType,
        text: data.text,
        subtext: data.subtext,
        changedBy: userData.displayName
      });
    });

    // ── DISCONNECT ──
    socket.on('disconnect', () => {
      handleDisconnect(socket, podcastNs);
    });
  });

  console.log('🔌 Socket.io initialized with /podcast namespace');
  return io;
}

function handleDisconnect(socket: Socket, ns: any) {
  const userData = (socket as any).userData;
  if (!userData) return;

  const { roomCode, userId, displayName, role } = userData;
  socket.leave(roomCode);

  // Remove from active rooms
  const roomSet = activeRooms.get(roomCode);
  if (roomSet) {
    roomSet.delete(socket.id);
    const count = roomSet.size;
    viewerCounts.set(roomCode, count);

    if (count === 0) {
      activeRooms.delete(roomCode);
      viewerCounts.delete(roomCode);
    }

    // Notify room
    ns.to(roomCode).emit('podcast:participant-left', {
      socketId: socket.id,
      userId,
      displayName,
      role,
      viewerCount: count
    });
  }

  console.log(`🎙️ [Podcast] ${displayName} disconnected from ${roomCode}`);
}

export function getIO(): Server | null {
  return io;
}

export function getRoomViewerCount(roomCode: string): number {
  return viewerCounts.get(roomCode) || 0;
}
