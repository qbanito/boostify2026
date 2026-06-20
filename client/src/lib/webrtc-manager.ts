/**
 * WebRTC Manager — Manages peer connections for the Live Podcast Studio
 * Uses mesh topology (P2P connections between all participants, max 6)
 */

export interface PeerConnection {
  socketId: string;
  userId: string;
  displayName: string;
  connection: RTCPeerConnection;
  remoteStream: MediaStream | null;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private peers: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private onRemoteStream: ((socketId: string, stream: MediaStream) => void) | null = null;
  private onPeerDisconnected: ((socketId: string) => void) | null = null;
  private sendSignal: ((targetSocketId: string, signal: any, type: 'offer' | 'answer' | 'ice-candidate') => void) | null = null;

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    // Update all existing peer connections with new tracks
    this.peers.forEach((peer) => {
      const senders = peer.connection.getSenders();
      stream.getTracks().forEach((track) => {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          peer.connection.addTrack(track, stream);
        }
      });
    });
  }

  onRemoteStreamCallback(cb: (socketId: string, stream: MediaStream) => void) {
    this.onRemoteStream = cb;
  }

  onPeerDisconnectedCallback(cb: (socketId: string) => void) {
    this.onPeerDisconnected = cb;
  }

  setSendSignal(cb: (targetSocketId: string, signal: any, type: 'offer' | 'answer' | 'ice-candidate') => void) {
    this.sendSignal = cb;
  }

  async createOffer(socketId: string, userId: string, displayName: string): Promise<void> {
    const pc = this.createPeerConnection(socketId, userId, displayName);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendSignal?.(socketId, offer, 'offer');
  }

  async handleOffer(socketId: string, userId: string, displayName: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.createPeerConnection(socketId, userId, displayName);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.sendSignal?.(socketId, answer, 'answer');
  }

  async handleAnswer(socketId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(socketId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private createPeerConnection(socketId: string, userId: string, displayName: string): RTCPeerConnection {
    // Close existing connection if any
    const existing = this.peers.get(socketId);
    if (existing) {
      existing.connection.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    const peerData: PeerConnection = {
      socketId,
      userId,
      displayName,
      connection: pc,
      remoteStream: null,
    };

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal?.(socketId, event.candidate.toJSON(), 'ice-candidate');
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        peerData.remoteStream = stream;
        this.onRemoteStream?.(socketId, stream);
      }
    };

    // Handle disconnection
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(socketId);
      }
    };

    this.peers.set(socketId, peerData);
    return pc;
  }

  removePeer(socketId: string): void {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(socketId);
      this.onPeerDisconnected?.(socketId);
    }
  }

  getPeer(socketId: string): PeerConnection | undefined {
    return this.peers.get(socketId);
  }

  getAllPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  destroy(): void {
    this.peers.forEach((peer) => {
      peer.connection.close();
    });
    this.peers.clear();
    this.localStream = null;
  }
}
