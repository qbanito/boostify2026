// ─── HoloSuit Adapter ───────────────────────────────────────────────────────────
// Handles the real protocol layer between HoloSuit Studio and Boostify.
// MVP1: Uses WebSocket mock. MVP2: Connect to real HoloSuit Custom Streaming.
//
// HoloSuit Studio Custom Streaming:
//   - Enable in HoloSuit Studio > Live Streaming > Custom
//   - Default UDP port: 14043
//   - WebSocket fallback: ws://localhost:14043
//   - Protocol: JSON or binary BVH frames

import type { HoloSuitMotionFrame, BodyPose, HandPose, FacePose, BoneTransform, BlendshapeValue } from '../../schemas/holostage/motionSource.schema';

export type HoloSuitProtocol = 'websocket' | 'udp_simulation' | 'mock';

export interface HoloSuitAdapterConfig {
  protocol: HoloSuitProtocol;
  ip: string;
  port: number;
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
  latencyCompensationMs: number;
}

export const DEFAULT_ADAPTER_CONFIG: HoloSuitAdapterConfig = {
  protocol: 'mock',
  ip: '127.0.0.1',
  port: 14043,
  reconnectIntervalMs: 3000,
  maxReconnectAttempts: 10,
  latencyCompensationMs: 40,
};

export type AdapterStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'receiving_body'
  | 'receiving_hands'
  | 'receiving_face'
  | 'unstable'
  | 'lost_signal'
  | 'fallback_active'
  | 'error';

export interface AdapterStats {
  fps: number;
  latencyMs: number;
  packetLoss: number;
  frameCount: number;
  lastFrameAt: number;
}

type FrameHandler = (frame: HoloSuitMotionFrame) => void;
type StatusHandler = (status: AdapterStatus, stats: AdapterStats) => void;

// ─── HoloSuit Adapter Class ─────────────────────────────────────────────────────

class HoloSuitAdapter {
  private config: HoloSuitAdapterConfig = { ...DEFAULT_ADAPTER_CONFIG };
  private status: AdapterStatus = 'disconnected';
  private stats: AdapterStats = { fps: 0, latencyMs: 0, packetLoss: 0, frameCount: 0, lastFrameAt: 0 };
  private frameHandlers: FrameHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private mockIntervalId: ReturnType<typeof setInterval> | null = null;
  private mockFrameId = 0;
  private fpsWindow: number[] = [];
  private lastFpsCalc = 0;

  // ─── Configuration ────────────────────────────────────────────────────────

  configure(config: Partial<HoloSuitAdapterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): HoloSuitAdapterConfig {
    return { ...this.config };
  }

  getStatus(): AdapterStatus {
    return this.status;
  }

  getStats(): AdapterStats {
    return { ...this.stats };
  }

  // ─── Connection ───────────────────────────────────────────────────────────

  connect(): void {
    if (this.status === 'connected' || this.status === 'connecting') return;

    if (this.config.protocol === 'mock' || this.config.protocol === 'udp_simulation') {
      this.startMock();
      return;
    }

    if (this.config.protocol === 'websocket') {
      this.connectWebSocket();
    }
  }

  disconnect(): void {
    this.clearMock();
    this.clearReconnect();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
    this.setStatus('disconnected');
  }

  // ─── Event Subscription ───────────────────────────────────────────────────

  onFrame(handler: FrameHandler): () => void {
    this.frameHandlers.push(handler);
    return () => { this.frameHandlers = this.frameHandlers.filter(h => h !== handler); };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return () => { this.statusHandlers = this.statusHandlers.filter(h => h !== handler); };
  }

  // ─── WebSocket Connection (MVP2) ──────────────────────────────────────────

  private connectWebSocket(): void {
    this.setStatus('connecting');
    const url = `ws://${this.config.ip}:${this.config.port}`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data as string);
          const frame = this.parseHoloSuitFrame(raw);
          this.dispatchFrame(frame);
          this.updateStatus(frame);
        } catch {
          // malformed frame — ignore
        }
      };

      this.socket.onerror = () => {
        this.setStatus('unstable');
      };

      this.socket.onclose = () => {
        this.socket = null;
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.setStatus('lost_signal');
          this.scheduleReconnect();
        } else {
          this.setStatus('fallback_active');
        }
      };
    } catch {
      this.setStatus('error');
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connectWebSocket();
    }, this.config.reconnectIntervalMs);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ─── Parse HoloSuit JSON frame ──────────────────────────────────────────────
  // HoloSuit Studio Custom Streaming sends JSON like:
  // { "scene": { "actors": [{ "name": "...", "body": [...], "meta": {...} }] } }

  private parseHoloSuitFrame(raw: Record<string, unknown>): HoloSuitMotionFrame {
    const now = performance.now();
    const scene = (raw['scene'] as Record<string, unknown>) ?? {};
    const actors = (scene['actors'] as unknown[]) ?? [];
    const actor = (actors[0] as Record<string, unknown>) ?? {};
    const bodyArr = (actor['body'] as unknown[]) ?? [];

    const bones: BoneTransform[] = (bodyArr as Array<Record<string, unknown>>).map((b) => ({
      bone: (b['name'] as string) ?? 'unknown',
      position: { x: 0, y: 0, z: 0 },
      rotation: {
        x: ((b['rotation'] as Record<string, number>) ?? {}).x ?? 0,
        y: ((b['rotation'] as Record<string, number>) ?? {}).y ?? 0,
        z: ((b['rotation'] as Record<string, number>) ?? {}).z ?? 0,
        w: ((b['rotation'] as Record<string, number>) ?? {}).w ?? 1,
      },
    }));

    const hipsTransform = bones.find(b => b.bone.toLowerCase().includes('hip'));

    return {
      frameId: this.mockFrameId++,
      timestamp: now / 1000,
      body: {
        bones,
        rootPosition: hipsTransform?.position ?? { x: 0, y: 0, z: 0 },
        rootRotation: hipsTransform?.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
      },
      hands: { fingers: [], leftWrist: null, rightWrist: null },
      face: { blendshapes: [], headRotation: null },
      status: 'connected',
    };
  }

  // ─── Mock / Simulation ────────────────────────────────────────────────────

  private startMock(): void {
    this.clearMock();
    this.mockFrameId = 0;
    this.setStatus('connected');

    const fps = 60;
    this.mockIntervalId = setInterval(() => {
      const t = (this.mockFrameId * (1 / fps));
      const frame = this.generateMockFrame(t);
      this.dispatchFrame(frame);
      this.updateStatus(frame);
    }, Math.round(1000 / fps));
  }

  private clearMock(): void {
    if (this.mockIntervalId !== null) {
      clearInterval(this.mockIntervalId);
      this.mockIntervalId = null;
    }
  }

  private generateMockFrame(t: number): HoloSuitMotionFrame {
    const sin = Math.sin;
    const cos = Math.cos;

    // Simulate subtle idle sway + breathing
    const sway = sin(t * 0.8) * 0.04;
    const breath = sin(t * 1.2) * 0.015;

    const boneNames = [
      'Hips','Spine','Spine1','Spine2','Neck','Head',
      'LeftShoulder','LeftArm','LeftForeArm','LeftHand',
      'RightShoulder','RightArm','RightForeArm','RightHand',
      'LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase',
      'RightUpLeg','RightLeg','RightFoot','RightToeBase',
    ];

    const bones: BoneTransform[] = boneNames.map((bone) => {
      let rx = 0, ry = 0, rz = 0;
      if (bone === 'Hips')   { ry = sway; }
      if (bone === 'Spine')  { rz = breath; }
      if (bone === 'Spine2') { rz = breath * 0.5; }
      if (bone === 'LeftArm') { rz = -0.3 + sin(t * 0.9) * 0.05; }
      if (bone === 'RightArm') { rz = 0.3 - sin(t * 0.9) * 0.05; }
      if (bone === 'Head') { ry = sway * 0.5; rx = -0.05 + breath * 0.3; }

      // magnitude for w
      const mag = Math.sqrt(rx*rx + ry*ry + rz*rz);
      const w = cos(mag / 2);

      return {
        bone,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: rx * 0.5, y: ry * 0.5, z: rz * 0.5, w },
      };
    });

    // Mock face blendshapes
    const blendshapes: BlendshapeValue[] = [
      { name: 'jawOpen', value: Math.max(0, sin(t * 3.5) * 0.25) },
      { name: 'mouthSmileLeft', value: 0.3 + sin(t * 0.3) * 0.1 },
      { name: 'mouthSmileRight', value: 0.3 + sin(t * 0.3) * 0.1 },
      { name: 'eyeBlinkLeft', value: t % 4 < 0.12 ? 1 : 0 },
      { name: 'eyeBlinkRight', value: t % 4 < 0.12 ? 1 : 0 },
      { name: 'browInnerUp', value: Math.max(0, sin(t * 0.6) * 0.2) },
    ];

    // Mock hand fingers
    const fingerCurl = 0.3 + sin(t * 1.5) * 0.1;
    const fingers = ['thumb','index','middle','ring','pinky'].flatMap((f) => [
      { finger: `left_${f}`, curl: fingerCurl, splay: 0 },
      { finger: `right_${f}`, curl: fingerCurl, splay: 0 },
    ]);

    return {
      frameId: this.mockFrameId++,
      timestamp: t,
      body: {
        bones,
        rootPosition: { x: sway * 0.1, y: breath * 0.05, z: 0 },
        rootRotation: { x: 0, y: sway, z: 0, w: 1 },
      },
      hands: {
        fingers,
        leftWrist: null,
        rightWrist: null,
      },
      face: {
        blendshapes,
        headRotation: { x: -0.05 + breath * 0.3, y: sway * 0.5, z: 0, w: 1 },
      },
      status: 'connected',
    };
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private dispatchFrame(frame: HoloSuitMotionFrame): void {
    this.frameHandlers.forEach(h => h(frame));
  }

  private updateStatus(frame: HoloSuitMotionFrame): void {
    const now = performance.now();

    // Calculate FPS
    this.fpsWindow.push(now);
    if (this.fpsWindow.length > 120) this.fpsWindow.shift();
    if (now - this.lastFpsCalc > 500) {
      const elapsed = (this.fpsWindow[this.fpsWindow.length - 1] - this.fpsWindow[0]) / 1000;
      this.stats.fps = elapsed > 0 ? Math.round((this.fpsWindow.length - 1) / elapsed) : 0;
      this.lastFpsCalc = now;
    }

    const latency = now - (frame.timestamp * 1000);
    this.stats.latencyMs = Math.round(Math.max(0, latency - this.config.latencyCompensationMs));
    this.stats.frameCount++;
    this.stats.lastFrameAt = now;

    // Determine status from what we're receiving
    const hasBody = frame.body.bones.length > 0;
    const hasHands = frame.hands.fingers.length > 0;
    const hasFace = frame.face.blendshapes.length > 0;

    if (hasBody && hasHands && hasFace) {
      if (this.status !== 'receiving_face') this.setStatus('receiving_face');
    } else if (hasBody && hasHands) {
      if (this.status !== 'receiving_hands') this.setStatus('receiving_hands');
    } else if (hasBody) {
      if (this.status !== 'receiving_body') this.setStatus('receiving_body');
    } else {
      if (this.status !== 'connected') this.setStatus('connected');
    }
  }

  private setStatus(status: AdapterStatus): void {
    this.status = status;
    this.statusHandlers.forEach(h => h(status, { ...this.stats }));
  }
}

export const holosuitAdapter = new HoloSuitAdapter();
