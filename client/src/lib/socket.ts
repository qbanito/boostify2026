/**
 * Socket.io Client — Singleton for real-time podcast studio communication
 */
import { io, Socket } from 'socket.io-client';

let podcastSocket: Socket | null = null;

export function getPodcastSocket(): Socket {
  if (!podcastSocket) {
    const baseUrl = window.location.origin;
    podcastSocket = io(`${baseUrl}/podcast`, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    podcastSocket.on('connect', () => {
      console.log('🎙️ Podcast socket connected:', podcastSocket?.id);
    });

    podcastSocket.on('disconnect', (reason) => {
      console.log('🎙️ Podcast socket disconnected:', reason);
    });

    podcastSocket.on('connect_error', (err) => {
      console.error('🎙️ Podcast socket error:', err.message);
    });
  }

  return podcastSocket;
}

export function connectPodcastSocket(): Socket {
  const socket = getPodcastSocket();
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectPodcastSocket(): void {
  if (podcastSocket?.connected) {
    podcastSocket.disconnect();
  }
}
