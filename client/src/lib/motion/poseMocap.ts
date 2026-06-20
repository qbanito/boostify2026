// ─── Webcam MoCap (MediaPipe Pose → MocapFrame) ─────────────────────────────
// Turns a live webcam feed into a stream of MocapFrame bone directions using
// Google MediaPipe's BlazePose (Pose Landmarker, full-body 33 landmarks). The
// heavy WASM + model are fetched from the CDN on first use; everything runs
// on-device (no video ever leaves the browser).

import {
  FaceLandmarker,
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { HumanBone, MocapFrame } from "./liveRetarget";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// BlazePose world-landmark indices.
const L = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftIndex: 19,
  rightIndex: 20,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

type Vec3 = [number, number, number];

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function mid(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}
function norm(v: Vec3): Vec3 | null {
  const l = Math.hypot(v[0], v[1], v[2]);
  if (l < 1e-6) return null;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Convert a MediaPipe world landmark into "avatar space".
 * MediaPipe world coords: +x right, +y DOWN, +z toward camera. Three.js / our
 * avatar space is +y UP, +z toward viewer, so we flip Y and Z.
 *
 * NOTE: we do NOT negate X for the mirror. Negating a single axis flips the
 * coordinate system's handedness, which inverts every bone's twist and tears
 * the mesh. A selfie mirror is instead done by SWAPPING the left/right landmark
 * indices (see `mirrorIndex`), which keeps the space right-handed.
 */
function toAvatar(p: { x: number; y: number; z: number }): Vec3 {
  return [p.x, -p.y, -p.z];
}

// Left↔right landmark swap used to produce a natural selfie mirror without
// changing the coordinate handedness.
const MIRROR_INDEX: Record<number, number> = {
  [L.leftShoulder]: L.rightShoulder, [L.rightShoulder]: L.leftShoulder,
  [L.leftElbow]: L.rightElbow, [L.rightElbow]: L.leftElbow,
  [L.leftWrist]: L.rightWrist, [L.rightWrist]: L.leftWrist,
  [L.leftIndex]: L.rightIndex, [L.rightIndex]: L.leftIndex,
  [L.leftHip]: L.rightHip, [L.rightHip]: L.leftHip,
  [L.leftKnee]: L.rightKnee, [L.rightKnee]: L.leftKnee,
  [L.leftAnkle]: L.rightAnkle, [L.rightAnkle]: L.leftAnkle,
};

// ARKit-style blendshapes that are sided (…Left / …Right). When the selfie
// mirror is on we swap the side so the actor's expression maps to the matching
// side of the avatar.
function mirrorBlendshapeName(name: string): string {
  if (name.endsWith("Left")) return name.slice(0, -4) + "Right";
  if (name.endsWith("Right")) return name.slice(0, -5) + "Left";
  return name;
}

export interface MocapOptions {
  /** Selfie / front camera → mirror horizontally (default true). */
  mirror?: boolean;
  /** Minimum landmark visibility to trust a limb (default 0.5). */
  minVisibility?: number;
}

export class WebcamMocap {
  private landmarker: PoseLandmarker | null = null;
  private face: FaceLandmarker | null = null;
  private lastVideoTime = -1;
  private opts: Required<MocapOptions>;

  constructor(opts: MocapOptions = {}) {
    this.opts = {
      mirror: opts.mirror ?? true,
      minVisibility: opts.minVisibility ?? 0.6,
    };
  }

  setMirror(on: boolean): void {
    this.opts.mirror = on;
  }

  /** Load the WASM runtime + pose + face models. Safe to call once. */
  async init(): Promise<void> {
    if (this.landmarker) return;
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    // Face landmarker is optional — if it fails to load, body capture still
    // works. It outputs 52 ARKit-style blendshapes (jawOpen, mouthSmile,
    // eyeBlink, brows…) which drive the avatar's facial morph targets / jaw.
    try {
      this.face = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    } catch {
      this.face = null;
    }
  }

  get ready(): boolean {
    return !!this.landmarker;
  }

  /**
   * Detect a pose in the current video frame and convert it to a MocapFrame.
   * Returns null if no person is detected (or the frame hasn't advanced).
   */
  detect(video: HTMLVideoElement, nowMs: number): MocapFrame | null {
    if (!this.landmarker || video.readyState < 2) return null;
    if (video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = video.currentTime;

    let res: PoseLandmarkerResult;
    try {
      res = this.landmarker.detectForVideo(video, nowMs);
    } catch {
      return null;
    }
    const world = res.worldLandmarks?.[0];
    if (!world || world.length < 29) return null;

    const mir = this.opts.mirror;
    const minV = this.opts.minVisibility;
    // With mirror on, bone "leftX" should follow the actor's RIGHT side (so it
    // reads like a mirror) and the reflected geometry is recovered by negating
    // X. Swapping the index AND negating X together preserve handedness, so no
    // twist is introduced.
    const idx = (i: number) => (mir ? (MIRROR_INDEX[i] ?? i) : i);
    const ok = (i: number) => (world[idx(i)]?.visibility ?? 1) >= minV;
    const P = (i: number) => {
      const v = toAvatar(world[idx(i)]);
      if (mir) v[0] = -v[0];
      return v;
    };

    const dirs: Partial<Record<HumanBone, Vec3>> = {};
    const setDir = (bone: HumanBone, from: number, to: number) => {
      if (!ok(from) || !ok(to)) return;
      const d = norm(sub(P(to), P(from)));
      if (d) dirs[bone] = d;
    };

    // Arms.
    setDir("leftUpperArm", L.leftShoulder, L.leftElbow);
    setDir("leftLowerArm", L.leftElbow, L.leftWrist);
    setDir("rightUpperArm", L.rightShoulder, L.rightElbow);
    setDir("rightLowerArm", L.rightElbow, L.rightWrist);

    // Hands (wrist → index-finger base). Driving the hand bone makes it follow
    // the real wrist orientation instead of staying rigid while the forearm
    // swings — which is what makes a sleeve/cuff pinch and "stick" to the hand.
    setDir("leftHand", L.leftWrist, L.leftIndex);
    setDir("rightHand", L.rightWrist, L.rightIndex);

    // Legs.
    setDir("leftUpperLeg", L.leftHip, L.leftKnee);
    setDir("leftLowerLeg", L.leftKnee, L.leftAnkle);
    setDir("rightUpperLeg", L.rightHip, L.rightKnee);
    setDir("rightLowerLeg", L.rightKnee, L.rightAnkle);

    // Spine = hips center → shoulders center.
    if (ok(L.leftShoulder) && ok(L.rightShoulder) && ok(L.leftHip) && ok(L.rightHip)) {
      const shoulders = mid(P(L.leftShoulder), P(L.rightShoulder));
      const hips = mid(P(L.leftHip), P(L.rightHip));
      const d = norm(sub(shoulders, hips));
      if (d) dirs.spine = d;
    }

    // Head = shoulders center → nose.
    if (ok(L.nose) && ok(L.leftShoulder) && ok(L.rightShoulder)) {
      const shoulders = mid(P(L.leftShoulder), P(L.rightShoulder));
      const d = norm(sub(P(L.nose), shoulders));
      if (d) dirs.head = d;
    }

    if (Object.keys(dirs).length === 0) return null;

    // Face blendshapes (optional). Run the face model on the same frame and
    // collect the 52 ARKit weights, mirroring sided shapes when the selfie
    // mirror is on so they land on the correct side of the avatar.
    let face: Record<string, number> | undefined;
    if (this.face) {
      try {
        const fr = this.face.detectForVideo(video, nowMs);
        const cats = fr.faceBlendshapes?.[0]?.categories;
        if (cats && cats.length) {
          face = {};
          for (const c of cats) {
            const name = mir ? mirrorBlendshapeName(c.categoryName) : c.categoryName;
            face[name] = c.score;
          }
        }
      } catch {
        /* face detection failed this frame — body still streams */
      }
    }

    return { dirs, face, mouth: face?.jawOpen, t: Date.now() };
  }

  close(): void {
    try {
      this.landmarker?.close();
    } catch {
      /* ignore */
    }
    try {
      this.face?.close();
    } catch {
      /* ignore */
    }
    this.landmarker = null;
    this.face = null;
    this.lastVideoTime = -1;
  }
}
