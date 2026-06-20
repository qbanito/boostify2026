// ─── Motion Source Schema (HoloSuit / MoCap) ───────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface BoneTransform {
  bone: string;
  position: Vec3;
  rotation: Quaternion;
}

export interface BodyPose {
  timestamp: number;
  bones: BoneTransform[];
  rootPosition: Vec3;
  velocity: number;   // m/s total body speed
  confidence: number; // 0-1
}

export interface FingerPose {
  finger: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
  joints: Quaternion[];  // proximal, medial, distal
  curl: number;          // 0-1
  spread: number;        // 0-1
}

export interface HandPose {
  left: {
    wrist: Quaternion;
    fingers: FingerPose[];
    position: Vec3;
    active: boolean;
  };
  right: {
    wrist: Quaternion;
    fingers: FingerPose[];
    position: Vec3;
    active: boolean;
  };
}

export interface BlendshapeValue {
  name: string;
  value: number;  // 0-1
}

export interface FacePose {
  headRotation: Quaternion;
  headPosition: Vec3;
  blendshapes: BlendshapeValue[];
  eyeGazeLeft: Vec3;
  eyeGazeRight: Vec3;
  confidence: number;
}

export interface HoloSuitMotionFrame {
  frameId: number;
  timestamp: number;
  actorName?: string;   // HoloSuit actor name from Custom Streaming JSON
  source?: 'smartsuit' | 'phone' | 'simulation' | 'file';
  body: BodyPose | null;
  hands: HandPose | null;
  face: FacePose | null;
}

// ─── HoloSuit Hardware Status ────────────────────────────────────────────────
// Mirrors data from HoloSuitNotificationsAssemblyDefinition.dll

export interface HoloSuitSensorStatus {
  sensorId: string;        // e.g. 'Hip', 'Chest', 'LeftHand'
  placement: string;       // human-readable placement label
  batteryPercent: number;  // 0–100
  signalStrength: number;  // 0–100 (RSSI normalized)
  connected: boolean;
  lastSeenMs: number;      // ms since last packet
}

export type HoloSuitNotificationType =
  | 'battery_low'
  | 'battery_critical'
  | 'signal_weak'
  | 'sensor_lost'
  | 'sensor_reconnected'
  | 'calibration_needed'
  | 'recording_started'
  | 'recording_stopped';

export interface HoloSuitNotification {
  id: string;
  type: HoloSuitNotificationType;
  message: string;
  sensorId?: string;
  actorName?: string;
  timestamp: number;
  dismissed: boolean;
}

// ─── Multi-Actor ──────────────────────────────────────────────────────────────
// HoloSuit Studio supports N actors (suits) streaming simultaneously via
// teamsharing-mqtt.dll / teamsharing-websocket.dll

export interface HoloSuitActorInfo {
  actorName: string;
  hasBody: boolean;
  hasFace: boolean;
  hasHands: boolean;
  lastFrameMs: number;  // Date.now() timestamp of last received frame
  frameRate: number;    // measured FPS
  isActive: boolean;
}

export interface HoloSuitConfig {
  streamingEnabled: boolean;
  host: string;
  port: number;
  localApiPort?: number;              // Nancy HTTP API port (default 14053)
  protocol: 'udp' | 'websocket';
  actorName: string;
  selectedActorName?: string | null;  // null = use first actor in stream
  fps: number;
  simulationMode: boolean;
  simulationIntensity: number;        // 0-1 how much the mock moves
  // ── Capture channel toggles ────────────────────────────────────────────────
  captureBody: boolean;
  captureHands: boolean;
  captureFace: boolean;
  // ── Connection resilience ─────────────────────────────────────────────────
  reconnectIntervalMs?: number;       // default 3000
  maxReconnectAttempts?: number;      // default 10, 0 = infinite
  autoReconnect?: boolean;
}

export const DEFAULT_HOLOSUIT_CONFIG: HoloSuitConfig = {
  streamingEnabled: false,
  host: '127.0.0.1',
  port: 14043,
  localApiPort: 14053,
  protocol: 'udp',
  actorName: 'BoostifyActor',
  selectedActorName: null,
  fps: 60,
  simulationMode: true,
  simulationIntensity: 0.5,
  captureBody: true,
  captureHands: false,
  captureFace: false,
  reconnectIntervalMs: 3000,
  maxReconnectAttempts: 10,
  autoReconnect: true,
};
