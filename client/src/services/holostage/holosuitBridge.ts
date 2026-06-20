// ─── HoloSuit Bridge (Mock + MVP2 ready) ───────────────────────────────────────
// Simulates HoloSuit Studio Custom Streaming data for MVP1.
// In MVP2, replace the simulation with a real WebSocket/UDP receiver.

import type {
  HoloSuitMotionFrame, BodyPose, HandPose, FacePose, BoneTransform, BlendshapeValue,
  HoloSuitSensorStatus, HoloSuitNotification, HoloSuitNotificationType, HoloSuitActorInfo,
} from '../../schemas/holostage/motionSource.schema';

type FrameCallback = (frame: HoloSuitMotionFrame) => void;
type NotificationCallback = (notification: HoloSuitNotification) => void;

// Sensor placements modeled after HoloSuit Pro 19-sensor layout
const SIMULATED_SENSORS: { id: string; label: string }[] = [
  { id: 'Hip',          label: 'Hip'        },
  { id: 'Chest',        label: 'Chest'      },
  { id: 'Head',         label: 'Head'       },
  { id: 'LeftUpperArm', label: 'L.UpperArm' },
  { id: 'RightUpperArm',label: 'R.UpperArm' },
  { id: 'LeftHand',     label: 'L.Hand'     },
  { id: 'RightHand',    label: 'R.Hand'     },
  { id: 'LeftFoot',     label: 'L.Foot'     },
  { id: 'RightFoot',    label: 'R.Foot'     },
];

class HoloSuitBridge {
  private callbacks: FrameCallback[] = [];
  private notificationCallbacks: NotificationCallback[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private frameId = 0;
  private simulationIntensity = 0.5;
  private fps = 30;
  private connected = false;

  // ─── Multi-Actor ──────────────────────────────────────────────────────────
  private actors: HoloSuitActorInfo[] = [];
  private selectedActorName: string | null = null;

  // ─── Sensor State ─────────────────────────────────────────────────────────
  private sensors: HoloSuitSensorStatus[] = [];
  private sensorBatteries: number[] = [];  // per-sensor battery %
  private notifications: HoloSuitNotification[] = [];
  private notifIdCounter = 0;
  private lastNotifTime: Partial<Record<string, number>> = {}; // rate-limit

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  startSimulation(fps = 30, intensity = 0.5): void {
    this.fps = fps;
    this.simulationIntensity = intensity;
    this.connected = true;
    this.initSensors();
    this.initActors();
    this.intervalId = setInterval(() => {
      const frame = this.generateSimulatedFrame();
      this.callbacks.forEach(cb => cb(frame));
      this.tickSensors();
    }, Math.round(1000 / fps));
  }

  stopSimulation(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.connected = false;
    this.actors = [];
    this.sensors = [];
    this.sensorBatteries = [];
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ─── Frame Subscription ───────────────────────────────────────────────────

  onFrame(cb: FrameCallback): () => void {
    this.callbacks.push(cb);
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== cb);
    };
  }

  // ─── Phone Capture Injection ──────────────────────────────────────────────
  // Receives frames from phoneCaptureService (WebRTC + MediaPipe) when no
  // HoloSuit is connected, and broadcasts them to all subscribers as if they
  // came from a live HoloSuit actor.

  injectPhoneFrame(frame: HoloSuitMotionFrame): void {
    // Mark source + ensure actor exists
    const actorName = frame.actorName ?? 'PhoneCapture';
    const existing = this.actors.find(a => a.actorName === actorName);
    if (!existing) {
      this.actors.push({
        actorName,
        hasBody:  !!frame.body,
        hasFace:  !!frame.face,
        hasHands: !!frame.hands,
        lastFrameMs: Date.now(),
        frameRate: 30,
        isActive: true,
      });
    } else {
      existing.lastFrameMs = Date.now();
      existing.isActive = true;
    }
    // Broadcast to all frame listeners
    this.callbacks.forEach(cb => cb(frame));
  }

  // ─── Notification Subscription ────────────────────────────────────────────

  onNotification(cb: NotificationCallback): () => void {
    this.notificationCallbacks.push(cb);
    return () => {
      this.notificationCallbacks = this.notificationCallbacks.filter(c => c !== cb);
    };
  }

  getNotifications(): HoloSuitNotification[] {
    return [...this.notifications];
  }

  dismissNotification(id: string): void {
    this.notifications = this.notifications.map(n =>
      n.id === id ? { ...n, dismissed: true } : n,
    );
  }

  // ─── Multi-Actor ──────────────────────────────────────────────────────────

  getActors(): HoloSuitActorInfo[] {
    return [...this.actors];
  }

  addActor(actor: HoloSuitActorInfo): void {
    if (this.actors.some(a => a.actorName === actor.actorName)) return;
    this.actors.push(actor);
  }

  removeActor(actorName: string): void {
    this.actors = this.actors.filter(a => a.actorName !== actorName);
    if (this.selectedActorName === actorName) this.selectedActorName = null;
  }

  updateActor(actorName: string, update: Partial<HoloSuitActorInfo>): void {
    const idx = this.actors.findIndex(a => a.actorName === actorName);
    if (idx !== -1) {
      this.actors[idx] = { ...this.actors[idx], ...update };
    }
  }

  selectActor(name: string | null): void {
    this.selectedActorName = name;
  }

  getSelectedActorName(): string | null {
    return this.selectedActorName;
  }

  // ─── Sensor Status ────────────────────────────────────────────────────────

  getSensorStatuses(): HoloSuitSensorStatus[] {
    return [...this.sensors];
  }

  // ─── Simulation ───────────────────────────────────────────────────────────

  private initSensors(): void {
    // Start with slightly varied battery levels (85–100%) for realism
    this.sensorBatteries = SIMULATED_SENSORS.map((_, i) => 92 - i * 1.5);
    this.sensors = SIMULATED_SENSORS.map((s, i) => ({
      sensorId: s.id,
      placement: s.label,
      batteryPercent: this.sensorBatteries[i],
      signalStrength: 88 + Math.random() * 12,
      connected: true,
      lastSeenMs: 0,
    }));
  }

  private initActors(): void {
    // Actor 'C2J' from DefaultRecordings srec_meta actorName field
    this.actors = [
      {
        actorName: 'C2J',
        hasBody: true,
        hasFace: true,
        hasHands: true,
        lastFrameMs: Date.now(),
        frameRate: this.fps,
        isActive: true,
      },
      {
        actorName: 'Demo_02',
        hasBody: true,
        hasFace: false,
        hasHands: false,
        lastFrameMs: Date.now(),
        frameRate: this.fps,
        isActive: true,
      },
    ];
    // Default: select first actor
    if (!this.selectedActorName) this.selectedActorName = 'C2J';
  }

  private tickSensors(): void {
    const now = Date.now();
    // Drain battery ~0.002% per frame (visible in UI without being annoying)
    this.sensorBatteries = this.sensorBatteries.map(b => Math.max(0, b - 0.002));

    this.sensors = SIMULATED_SENSORS.map((s, i) => {
      const battery = this.sensorBatteries[i];
      // Signal oscillates per-sensor with unique phase
      const signal = Math.min(100, Math.max(10,
        72 + Math.sin(now / 4000 + i * 1.3) * 22,
      ));
      const sensor: HoloSuitSensorStatus = {
        sensorId: s.id,
        placement: s.label,
        batteryPercent: battery,
        signalStrength: signal,
        connected: true,
        lastSeenMs: 0,
      };

      // Emit battery notifications (rate-limited: once per type per sensor)
      const battLowKey = `batt_low_${s.id}`;
      const battCritKey = `batt_crit_${s.id}`;
      const sigKey = `sig_${s.id}`;

      if (battery < 15 && !this.lastNotifTime[battCritKey]) {
        this.lastNotifTime[battCritKey] = now;
        this.emitNotification('battery_critical', `Sensor ${s.label}: battery critical (${battery.toFixed(0)}%)`, s.id);
      } else if (battery < 30 && !this.lastNotifTime[battLowKey]) {
        this.lastNotifTime[battLowKey] = now;
        this.emitNotification('battery_low', `Sensor ${s.label}: battery low (${battery.toFixed(0)}%)`, s.id);
      }
      if (signal < 25 && (!this.lastNotifTime[sigKey] || now - this.lastNotifTime[sigKey] > 10000)) {
        this.lastNotifTime[sigKey] = now;
        this.emitNotification('signal_weak', `Sensor ${s.label}: weak signal (${signal.toFixed(0)}%)`, s.id);
      }

      return sensor;
    });

    // Update actor frame rates
    this.actors = this.actors.map(a => ({ ...a, lastFrameMs: now, frameRate: this.fps }));
  }

  private emitNotification(
    type: HoloSuitNotificationType,
    message: string,
    sensorId?: string,
  ): void {
    const notif: HoloSuitNotification = {
      id: `notif_${++this.notifIdCounter}`,
      type,
      message,
      sensorId,
      actorName: this.selectedActorName ?? undefined,
      timestamp: Date.now(),
      dismissed: false,
    };
    this.notifications = [notif, ...this.notifications].slice(0, 50);
    this.notificationCallbacks.forEach(cb => cb(notif));
  }

  private generateSimulatedFrame(): HoloSuitMotionFrame {
    const t = (this.frameId++ * (1 / this.fps));
    const k = this.simulationIntensity;

    return {
      frameId: this.frameId,
      timestamp: t,
      actorName: this.selectedActorName ?? 'C2J',
      body: this.simulateBody(t, k),
      hands: this.simulateHands(t, k),
      face: this.simulateFace(t, k),
    };
  }

  private simulateBody(t: number, k: number): BodyPose {
    const sway = Math.sin(t * 0.8) * k * 0.05;
    const bob = Math.sin(t * 1.6) * k * 0.03;

    const bones: BoneTransform[] = [
      { bone: 'Hips', position: { x: sway, y: bob, z: 0 }, rotation: { x: 0, y: sway * 0.3, z: 0, w: 1 } },
      { bone: 'Spine', position: { x: 0, y: 0, z: 0 }, rotation: { x: -sway * 0.2, y: sway * 0.1, z: 0, w: 1 } },
      { bone: 'Chest', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: sway * 0.15, z: 0, w: 1 } },
      { bone: 'Head', position: { x: 0, y: 0, z: 0 }, rotation: { x: Math.sin(t * 0.5) * k * 0.05, y: sway * 0.2, z: 0, w: 1 } },
      { bone: 'LeftArm', position: { x: 0, y: 0, z: 0 }, rotation: { x: Math.sin(t * 1.2) * k * 0.15, y: 0, z: Math.PI / 6, w: 1 } },
      { bone: 'RightArm', position: { x: 0, y: 0, z: 0 }, rotation: { x: Math.sin(t * 1.2 + 0.5) * k * 0.15, y: 0, z: -Math.PI / 6, w: 1 } },
    ];

    return {
      timestamp: t,
      bones,
      rootPosition: { x: sway * 0.1, y: 0, z: 0 },
      velocity: Math.abs(sway) * 0.5,
      confidence: 0.95,
    };
  }

  private simulateHands(t: number, k: number): HandPose {
    const curl = (Math.sin(t * 2) * 0.5 + 0.5) * k;
    return {
      left: {
        wrist: { x: 0, y: Math.sin(t) * k * 0.1, z: 0, w: 1 },
        fingers: ['thumb', 'index', 'middle', 'ring', 'pinky'].map(finger => ({
          finger: finger as HandPose['left']['fingers'][0]['finger'],
          joints: [
            { x: 0, y: curl * 0.3, z: 0, w: 1 },
            { x: 0, y: curl * 0.5, z: 0, w: 1 },
            { x: 0, y: curl * 0.7, z: 0, w: 1 },
          ],
          curl,
          spread: Math.random() * 0.1 * k,
        })),
        position: { x: -0.25, y: 0.9, z: 0.1 },
        active: true,
      },
      right: {
        wrist: { x: 0, y: -Math.sin(t) * k * 0.1, z: 0, w: 1 },
        fingers: ['thumb', 'index', 'middle', 'ring', 'pinky'].map(finger => ({
          finger: finger as HandPose['left']['fingers'][0]['finger'],
          joints: [
            { x: 0, y: curl * 0.3, z: 0, w: 1 },
            { x: 0, y: curl * 0.5, z: 0, w: 1 },
            { x: 0, y: curl * 0.7, z: 0, w: 1 },
          ],
          curl,
          spread: Math.random() * 0.1 * k,
        })),
        position: { x: 0.25, y: 0.9, z: 0.1 },
        active: true,
      },
    };
  }

  private simulateFace(t: number, k: number): FacePose {
    const blink = t % 4 < 0.15 ? 1 : 0;
    const smile = (Math.sin(t * 0.3) * 0.5 + 0.5) * k * 0.6;

    const blendshapes: BlendshapeValue[] = [
      { name: 'eyeBlinkLeft', value: blink },
      { name: 'eyeBlinkRight', value: blink },
      { name: 'mouthSmileLeft', value: smile },
      { name: 'mouthSmileRight', value: smile },
      { name: 'browRaiseLeft', value: Math.sin(t * 0.7) * 0.3 * k },
      { name: 'browRaiseRight', value: Math.sin(t * 0.7 + 0.2) * 0.3 * k },
      { name: 'jawOpen', value: Math.abs(Math.sin(t * 1.5)) * k * 0.2 },
    ];

    return {
      headRotation: { x: Math.sin(t * 0.4) * k * 0.08, y: Math.sin(t * 0.5) * k * 0.12, z: 0, w: 1 },
      headPosition: { x: 0, y: 1.7, z: 0 },
      blendshapes,
      eyeGazeLeft: { x: Math.sin(t * 1.1) * 0.2, y: 0, z: 1 },
      eyeGazeRight: { x: Math.sin(t * 1.1) * 0.2, y: 0, z: 1 },
      confidence: 0.92,
    };
  }
}

// Singleton instance
export const holosuitBridge = new HoloSuitBridge();
