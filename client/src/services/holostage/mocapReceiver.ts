// ─── MoCap Receiver (stub for MVP2) ──────────────────────────────────────────
// In MVP1: proxies to holosuitBridge simulation.
// In MVP2: opens a WebSocket/UDP socket to receive real HoloSuit Custom Streaming.

import type { HoloSuitMotionFrame } from '../../schemas/holostage/motionSource.schema';

export interface ReceiverStatus {
  connected: boolean;
  mode: 'simulation' | 'live';
  framesReceived: number;
  droppedFrames: number;
  latencyMs: number;
  lastFrameTime: number;
}

type FrameHandler = (frame: HoloSuitMotionFrame) => void;

class MocapReceiver {
  private status: ReceiverStatus = {
    connected: false,
    mode: 'simulation',
    framesReceived: 0,
    droppedFrames: 0,
    latencyMs: 0,
    lastFrameTime: 0,
  };
  private handlers: FrameHandler[] = [];
  private ws: WebSocket | null = null;

  // ─── MVP1: Simulation mode ────────────────────────────────────────────────
  // (holosuitBridge calls onFrame which is forwarded here)

  receiveSimulatedFrame(frame: HoloSuitMotionFrame): void {
    this.status.framesReceived++;
    this.status.lastFrameTime = Date.now();
    this.handlers.forEach(h => h(frame));
  }

  // ─── MVP2: Live WebSocket receiver (stub) ─────────────────────────────────

  async connectLive(wsUrl: string): Promise<boolean> {
    // TODO MVP2: Connect to Boostify HoloSuit Bridge WebSocket relay
    // ws://localhost:14043/holosuit-stream
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onmessage = (event) => {
        try {
          const frame: HoloSuitMotionFrame = JSON.parse(event.data);
          this.status.framesReceived++;
          this.status.lastFrameTime = Date.now();
          this.handlers.forEach(h => h(frame));
        } catch {
          this.status.droppedFrames++;
        }
      };
      this.ws.onopen = () => {
        this.status.connected = true;
        this.status.mode = 'live';
      };
      this.ws.onclose = () => {
        this.status.connected = false;
      };
      return true;
    } catch {
      return false;
    }
  }

  disconnectLive(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status.connected = false;
    this.status.mode = 'simulation';
  }

  onFrame(handler: FrameHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }

  getStatus(): ReceiverStatus {
    return { ...this.status };
  }
}

export const mocapReceiver = new MocapReceiver();
