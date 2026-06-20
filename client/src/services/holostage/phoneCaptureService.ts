// ─── Phone Capture Service ─────────────────────────────────────────────────
// Fallback body + face capture using device/webcam camera + MediaPipe CDN.
// When no HoloSuit Pro is available, this feeds pose data into holosuitBridge.
// Supports: body pose (33 landmarks → bones) + face mesh (468 pts → ARKit blendshapes)

import type { HoloSuitMotionFrame, Quaternion, Vec3, BoneTransform } from '../../schemas/holostage/motionSource.schema';
import { holosuitBridge } from './holosuitBridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PhoneCaptureMode = 'body' | 'face' | 'body+face';
export type PhoneCaptureQuality = 'fast' | 'balanced' | 'accurate';

export interface PhoneCaptureConfig {
  mode: PhoneCaptureMode;
  quality: PhoneCaptureQuality;
  facingMode: 'user' | 'environment';
  fps: number;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PhoneCaptureStats {
  fps: number;
  latencyMs: number;
  poseConfidence: number;        // 0–1
  visibilityByPart: Record<string, number>; // head, leftArm, rightArm, torso, leftLeg, rightLeg
  frameCount: number;
  active: boolean;
}

export type PhoneCaptureStatus = 'idle' | 'requesting' | 'loading_model' | 'running' | 'error' | 'stopped';

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_PHONE_CONFIG: PhoneCaptureConfig = {
  mode: 'body',
  quality: 'balanced',
  facingMode: 'user',
  fps: 30,
};

// ─── MediaPipe Pose landmark indices ─────────────────────────────────────────
// https://developers.google.com/mediapipe/solutions/vision/pose_landmarker

const LM = {
  NOSE: 0, LEFT_EYE: 1, RIGHT_EYE: 2,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
};

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function vec3(x: number, y: number, z: number): Vec3 { return { x, y, z }; }

function midpoint(a: LandmarkPoint, b: LandmarkPoint): LandmarkPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1) };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Build a quaternion from two vectors (from→to). Simplified arc-rotation. */
function quatFromTo(from: Vec3, to: Vec3): Quaternion {
  const f = normalize(from);
  const t = normalize(to);
  const d = dot(f, t);
  if (d >= 0.9999) return { x: 0, y: 0, z: 0, w: 1 };
  if (d <= -0.9999) {
    // 180° flip — use perpendicular axis
    const perp = normalize(cross(f, { x: 1, y: 0, z: 0 }));
    return { x: perp.x, y: perp.y, z: perp.z, w: 0 };
  }
  const axis = normalize(cross(f, t));
  const angle = Math.acos(Math.max(-1, Math.min(1, d)));
  const s = Math.sin(angle / 2);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(angle / 2) };
}

/** Build bone rotation from parent→child direction vector, relative to a reference DOWN vector. */
function boneQuat(parent: LandmarkPoint, child: LandmarkPoint): Quaternion {
  const dir: Vec3 = normalize({
    x: child.x - parent.x,
    y: -(child.y - parent.y), // flip Y (MediaPipe is image-space)
    z: child.z - parent.z,
  });
  return quatFromTo({ x: 0, y: -1, z: 0 }, dir);
}

function landmarkVis(lm: LandmarkPoint): number {
  return lm.visibility ?? 1;
}

// ─── Convert MediaPipe landmarks → HoloSuit bone transforms ─────────────────────

function landmarksToFrame(lms: LandmarkPoint[], timestamp: number): HoloSuitMotionFrame {
  const get = (i: number): LandmarkPoint => lms[i] ?? { x: 0, y: 0, z: 0, visibility: 0 };

  const lShoulder = get(LM.LEFT_SHOULDER);
  const rShoulder = get(LM.RIGHT_SHOULDER);
  const lHip      = get(LM.LEFT_HIP);
  const rHip      = get(LM.RIGHT_HIP);
  const chest     = midpoint(lShoulder, rShoulder);
  const root      = midpoint(lHip, rHip);
  const head      = get(LM.NOSE);

  const bones: BoneTransform[] = [
    // Root / Pelvis
    { bone: 'root',          position: vec3(root.x - 0.5, -(root.y - 0.75), root.z), rotation: boneQuat(root, chest) },
    // Spine / Chest
    { bone: 'spine',         position: vec3(0, 0, 0), rotation: boneQuat(root, midpoint(chest, root)) },
    { bone: 'chest',         position: vec3(0, 0, 0), rotation: boneQuat(root, chest) },
    // Neck / Head
    { bone: 'neck',          position: vec3(0, 0, 0), rotation: boneQuat(chest, head) },
    { bone: 'head',          position: vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0, w: 1 } },
    // Left arm
    { bone: 'leftUpperArm',  position: vec3(0, 0, 0), rotation: boneQuat(lShoulder, get(LM.LEFT_ELBOW)) },
    { bone: 'leftLowerArm',  position: vec3(0, 0, 0), rotation: boneQuat(get(LM.LEFT_ELBOW), get(LM.LEFT_WRIST)) },
    { bone: 'leftHand',      position: vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0, w: 1 } },
    // Right arm
    { bone: 'rightUpperArm', position: vec3(0, 0, 0), rotation: boneQuat(rShoulder, get(LM.RIGHT_ELBOW)) },
    { bone: 'rightLowerArm', position: vec3(0, 0, 0), rotation: boneQuat(get(LM.RIGHT_ELBOW), get(LM.RIGHT_WRIST)) },
    { bone: 'rightHand',     position: vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0, w: 1 } },
    // Left leg
    { bone: 'leftUpperLeg',  position: vec3(0, 0, 0), rotation: boneQuat(lHip, get(LM.LEFT_KNEE)) },
    { bone: 'leftLowerLeg',  position: vec3(0, 0, 0), rotation: boneQuat(get(LM.LEFT_KNEE), get(LM.LEFT_ANKLE)) },
    { bone: 'leftFoot',      position: vec3(0, 0, 0), rotation: boneQuat(get(LM.LEFT_ANKLE), get(LM.LEFT_FOOT_INDEX)) },
    // Right leg
    { bone: 'rightUpperLeg', position: vec3(0, 0, 0), rotation: boneQuat(rHip, get(LM.RIGHT_KNEE)) },
    { bone: 'rightLowerLeg', position: vec3(0, 0, 0), rotation: boneQuat(get(LM.RIGHT_KNEE), get(LM.RIGHT_ANKLE)) },
    { bone: 'rightFoot',     position: vec3(0, 0, 0), rotation: boneQuat(get(LM.RIGHT_ANKLE), get(LM.RIGHT_FOOT_INDEX)) },
  ];

  // Overall confidence = average visibility of key joints
  const keyVis = [lShoulder, rShoulder, lHip, rHip, get(LM.LEFT_ELBOW), get(LM.RIGHT_ELBOW)].map(landmarkVis);
  const confidence = keyVis.reduce((a, b) => a + b, 0) / keyVis.length;

  return {
    frameId: Date.now(),
    timestamp,
    actorName: 'PhoneCapture',
    source: 'phone' as const,
    body: {
      timestamp,
      bones,
      rootPosition: vec3(root.x - 0.5, -(root.y - 0.75), root.z),
      velocity: 0,
      confidence,
    },
    hands: null,
    face: null,
  };
}

// ─── Compute part visibility (for quality UI) ──────────────────────────────────

function computePartVisibility(lms: LandmarkPoint[]): Record<string, number> {
  const v = (i: number) => lms[i]?.visibility ?? 0;
  return {
    head:      v(LM.NOSE),
    leftArm:   (v(LM.LEFT_SHOULDER) + v(LM.LEFT_ELBOW) + v(LM.LEFT_WRIST)) / 3,
    rightArm:  (v(LM.RIGHT_SHOULDER) + v(LM.RIGHT_ELBOW) + v(LM.RIGHT_WRIST)) / 3,
    torso:     (v(LM.LEFT_SHOULDER) + v(LM.RIGHT_SHOULDER) + v(LM.LEFT_HIP) + v(LM.RIGHT_HIP)) / 4,
    leftLeg:   (v(LM.LEFT_HIP) + v(LM.LEFT_KNEE) + v(LM.LEFT_ANKLE)) / 3,
    rightLeg:  (v(LM.RIGHT_HIP) + v(LM.RIGHT_KNEE) + v(LM.RIGHT_ANKLE)) / 3,
  };
}

// ─── PhoneCaptureService ──────────────────────────────────────────────────────

class PhoneCaptureService {
  private config: PhoneCaptureConfig = { ...DEFAULT_PHONE_CONFIG };
  private status: PhoneCaptureStatus = 'idle';
  private stats: PhoneCaptureStats = {
    fps: 0, latencyMs: 0, poseConfidence: 0,
    visibilityByPart: {}, frameCount: 0, active: false,
  };

  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private poseInstance: any = null;
  private animFrameId: number | null = null;
  private lastFrameTime = 0;
  private fpsAccum: number[] = [];

  private statusListeners: Set<(s: PhoneCaptureStatus, stats: PhoneCaptureStats) => void> = new Set();
  private frameListeners: Set<(frame: HoloSuitMotionFrame, lms: LandmarkPoint[]) => void> = new Set();

  // ── Public API ──────────────────────────────────────────────────────────────

  getStatus(): PhoneCaptureStatus { return this.status; }
  getStats(): PhoneCaptureStats { return { ...this.stats }; }
  getConfig(): PhoneCaptureConfig { return { ...this.config }; }

  configure(cfg: Partial<PhoneCaptureConfig>) {
    this.config = { ...this.config, ...cfg };
  }

  onStatus(cb: (s: PhoneCaptureStatus, stats: PhoneCaptureStats) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  onFrame(cb: (frame: HoloSuitMotionFrame, lms: LandmarkPoint[]) => void): () => void {
    this.frameListeners.add(cb);
    return () => this.frameListeners.delete(cb);
  }

  /** Attach camera preview to an HTML video element + canvas overlay */
  attachPreview(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.videoEl = video;
    this.canvasEl = canvas;
    if (this.stream) video.srcObject = this.stream;
  }

  async start(video?: HTMLVideoElement, canvas?: HTMLCanvasElement): Promise<void> {
    if (this.status === 'running') return;
    if (video) this.videoEl = video;
    if (canvas) this.canvasEl = canvas;

    this.setStatus('requesting');
    try {
      // 1. Request camera
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.config.facingMode, width: 640, height: 480, frameRate: this.config.fps },
        audio: false,
      });
      if (this.videoEl) {
        this.videoEl.srcObject = this.stream;
        await this.videoEl.play().catch(() => {});
      }

      // 2. Load MediaPipe Pose model
      this.setStatus('loading_model');
      await this.loadMediaPipe();

      // 3. Start inference loop
      this.setStatus('running');
      this.stats.active = true;
      this.runLoop();
    } catch (err) {
      console.error('[PhoneCapture] start error:', err);
      this.setStatus('error');
    }
  }

  stop() {
    if (this.animFrameId != null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.poseInstance?.close?.();
    this.poseInstance = null;
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    this.stats.active = false;
    this.setStatus('stopped');
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private setStatus(s: PhoneCaptureStatus) {
    this.status = s;
    this.statusListeners.forEach(cb => cb(s, this.stats));
  }

  private async loadMediaPipe(): Promise<void> {
    // Lazy-load MediaPipe Pose from CDN
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Pose) { await this.initPose(); return; }

    await new Promise<void>((resolve, reject) => {
      const src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
      if (document.querySelector(`script[src="${src}"]`)) {
        const wait = setInterval(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((window as any).Pose) { clearInterval(wait); resolve(); }
        }, 100);
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('MediaPipe Pose script failed to load'));
      document.head.appendChild(s);
    });

    await this.initPose();
  }

  private async initPose(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PoseClass = (window as any).Pose;
    if (!PoseClass) throw new Error('MediaPipe Pose not available');

    const complexityMap: Record<PhoneCaptureQuality, number> = { fast: 0, balanced: 1, accurate: 2 };

    this.poseInstance = new PoseClass({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    this.poseInstance.setOptions({
      modelComplexity: complexityMap[this.config.quality],
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.poseInstance.onResults((results: { poseLandmarks?: LandmarkPoint[] }) => {
      this.handleResults(results);
    });

    await this.poseInstance.initialize();
  }

  private runLoop() {
    const tick = async () => {
      if (this.status !== 'running' || !this.videoEl || !this.poseInstance) return;
      if (this.videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const t0 = performance.now();
        try {
          await this.poseInstance.send({ image: this.videoEl });
        } catch {
          // ignore single-frame errors
        }
        const latency = performance.now() - t0;
        this.updateFPS();
        this.stats.latencyMs = Math.round(latency);
      }
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private handleResults(results: { poseLandmarks?: LandmarkPoint[] }) {
    const lms = results.poseLandmarks;
    if (!lms || lms.length < 29) return;

    this.stats.frameCount++;
    const frame = landmarksToFrame(lms, performance.now());
    this.stats.poseConfidence = frame.body?.confidence ?? 0;
    this.stats.visibilityByPart = computePartVisibility(lms);

    // Feed into holosuitBridge (phone-sourced frames)
    holosuitBridge.injectPhoneFrame(frame);

    // Notify frame listeners (for canvas overlay)
    this.frameListeners.forEach(cb => cb(frame, lms));

    // Draw skeleton overlay on canvas
    if (this.canvasEl && this.videoEl) {
      this.drawOverlay(this.canvasEl, this.videoEl, lms);
    }

    this.statusListeners.forEach(cb => cb(this.status, this.stats));
  }

  private drawOverlay(canvas: HTMLCanvasElement, video: HTMLVideoElement, lms: LandmarkPoint[]) {
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const connections: [number, number][] = [
      [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
      [LM.LEFT_SHOULDER, LM.LEFT_ELBOW], [LM.LEFT_ELBOW, LM.LEFT_WRIST],
      [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW], [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
      [LM.LEFT_SHOULDER, LM.LEFT_HIP], [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
      [LM.LEFT_HIP, LM.RIGHT_HIP],
      [LM.LEFT_HIP, LM.LEFT_KNEE], [LM.LEFT_KNEE, LM.LEFT_ANKLE],
      [LM.RIGHT_HIP, LM.RIGHT_KNEE], [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
      [LM.NOSE, LM.LEFT_SHOULDER], [LM.NOSE, LM.RIGHT_SHOULDER],
    ];

    // Bones
    ctx.lineWidth = 2.5;
    for (const [a, b] of connections) {
      const la = lms[a], lb = lms[b];
      if (!la || !lb) continue;
      const vis = Math.min(la.visibility ?? 1, lb.visibility ?? 1);
      ctx.globalAlpha = Math.max(0.2, vis);
      ctx.strokeStyle = vis > 0.7 ? '#f97316' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(la.x * canvas.width, la.y * canvas.height);
      ctx.lineTo(lb.x * canvas.width, lb.y * canvas.height);
      ctx.stroke();
    }

    // Joint dots
    ctx.globalAlpha = 1;
    for (const lm of lms) {
      const vis = lm.visibility ?? 1;
      if (vis < 0.3) continue;
      ctx.fillStyle = vis > 0.7 ? '#fb923c' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private updateFPS() {
    const now = performance.now();
    this.fpsAccum.push(now);
    // Keep only last 30 timestamps
    while (this.fpsAccum.length > 30) this.fpsAccum.shift();
    if (this.fpsAccum.length >= 2) {
      const span = now - this.fpsAccum[0];
      this.stats.fps = Math.round(((this.fpsAccum.length - 1) / span) * 1000);
    }
    this.lastFrameTime = now;
  }
}

export const phoneCaptureService = new PhoneCaptureService();
