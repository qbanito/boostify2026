// ─── HoloSuit Studio Custom Streaming Protocol ─────────────────────────────────
// Official HoloSuit Studio WebSocket/UDP JSON streaming format.
// Matches the actor format used in DefaultRecordings/*.srec_meta files
// and the HoloSuit Custom Streaming API.
//
// HoloSuit Studio Custom Streaming settings:
//   Port: 14043 (default UDP)
//   Format: JSON
//   Actor name format: from srec_meta field "actorName" (e.g. "C2J")

// ─── Quaternion / Vector types ───────────────────────────────────────────────

export interface HoloSuitQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface HoloSuitVector3 {
  x: number;
  y: number;
  z: number;
}

// ─── Body Bone ───────────────────────────────────────────────────────────────
// Body bones present in HoloSuit HoloSuit Pro streaming JSON.
// The "name" field matches HoloSuit Studio bone names exactly.

export type HoloSuitBodyBoneName =
  | 'Hip' | 'Spine' | 'Chest' | 'Neck' | 'Head'
  | 'LeftShoulder' | 'LeftUpperArm' | 'LeftLowerArm' | 'LeftHand'
  | 'RightShoulder' | 'RightUpperArm' | 'RightLowerArm' | 'RightHand'
  | 'LeftUpperLeg' | 'LeftLowerLeg' | 'LeftFoot' | 'LeftToe'
  | 'RightUpperLeg' | 'RightLowerLeg' | 'RightFoot' | 'RightToe';

// 20 body bones — HoloSuit Pro sends all 20 in every frame
export const HOLOSUIT_BODY_BONES: HoloSuitBodyBoneName[] = [
  'Hip', 'Spine', 'Chest', 'Neck', 'Head',
  'LeftShoulder', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand',
  'RightShoulder', 'RightUpperArm', 'RightLowerArm', 'RightHand',
  'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'LeftToe',
  'RightUpperLeg', 'RightLowerLeg', 'RightFoot', 'RightToe',
];

export interface HoloSuitBodyBone {
  name: HoloSuitBodyBoneName;
  position: HoloSuitVector3;   // World-space position (meters)
  rotation: HoloSuitQuaternion; // Quaternion rotation (w is last in HoloSuit JSON)
}

// ─── Hand Bones ──────────────────────────────────────────────────────────────
// HoloSuit Glove Pro streaming — 15 bones per hand (5 fingers × 3 phalanges)

export type HoloSuitHandBoneSuffix = 'Meta' | 'Proximal' | 'Distal';
export type HoloSuitFingerName = 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky';

export interface HoloSuitHandBone {
  name: string; // e.g. "LeftThumbMeta", "RightIndexProximal"
  rotation: HoloSuitQuaternion;
}

export interface HoloSuitHandData {
  leftHand?: {
    wrist: HoloSuitQuaternion;
    fingers: HoloSuitHandBone[];
  };
  rightHand?: {
    wrist: HoloSuitQuaternion;
    fingers: HoloSuitHandBone[];
  };
}

// ─── Face Blendshapes ────────────────────────────────────────────────────────
// HoloSuit FaceCapAR / Visage Face Tracker blendshapes
// File: StreamingAssets/Visage Tracker/ — Apple ARKit 52 blendshapes

export interface HoloSuitFaceData {
  // Eye blinks
  eyeBlinkLeft?: number;
  eyeBlinkRight?: number;
  eyeLookDownLeft?: number;
  eyeLookDownRight?: number;
  eyeLookInLeft?: number;
  eyeLookInRight?: number;
  eyeLookOutLeft?: number;
  eyeLookOutRight?: number;
  eyeLookUpLeft?: number;
  eyeLookUpRight?: number;
  eyeSquintLeft?: number;
  eyeSquintRight?: number;
  eyeWideLeft?: number;
  eyeWideRight?: number;
  // Jaw
  jawForward?: number;
  jawLeft?: number;
  jawOpen?: number;
  jawRight?: number;
  // Mouth
  mouthClose?: number;
  mouthDimpleLeft?: number;
  mouthDimpleRight?: number;
  mouthFrownLeft?: number;
  mouthFrownRight?: number;
  mouthFunnel?: number;
  mouthLeft?: number;
  mouthLowerDownLeft?: number;
  mouthLowerDownRight?: number;
  mouthPressLeft?: number;
  mouthPressRight?: number;
  mouthPucker?: number;
  mouthRight?: number;
  mouthRollLower?: number;
  mouthRollUpper?: number;
  mouthShrugLower?: number;
  mouthShrugUpper?: number;
  mouthSmileLeft?: number;
  mouthSmileRight?: number;
  mouthStretchLeft?: number;
  mouthStretchRight?: number;
  mouthUpperUpLeft?: number;
  mouthUpperUpRight?: number;
  // Brow
  browDownLeft?: number;
  browDownRight?: number;
  browInnerUp?: number;
  browOuterUpLeft?: number;
  browOuterUpRight?: number;
  // Cheek
  cheekPuff?: number;
  cheekSquintLeft?: number;
  cheekSquintRight?: number;
  // Nose
  noseSneerLeft?: number;
  noseSneerRight?: number;
  // Tongue
  tongueOut?: number;
}

// ─── Actor ────────────────────────────────────────────────────────────────────
// One actor = one performer tracked by the system
// From srec_meta: actorName field = "C2J" (HoloSuit actor name)

export interface HoloSuitActor {
  name: string;               // Actor name as set in HoloSuit Studio (e.g. "C2J")
  body: HoloSuitBodyBone[];     // 20 body bones from HoloSuit Pro
  leftHand?: HoloSuitHandBone[]; // 15 hand bones (Glove Pro left)
  rightHand?: HoloSuitHandBone[]; // 15 hand bones (Glove Pro right)
  face?: HoloSuitFaceData;       // ARKit 52 blendshapes (FaceCapAR / Visage)
  timestamp?: number;           // Unix timestamp ms
}

// ─── Prop ─────────────────────────────────────────────────────────────────────

export interface HoloSuitProp {
  name: string;
  position: HoloSuitVector3;
  rotation: HoloSuitQuaternion;
}

// ─── Root Streaming Frame ─────────────────────────────────────────────────────
// This is the exact JSON object HoloSuit Studio sends on each streaming frame
// over UDP port 14043 (Custom Streaming, JSON format).

export interface HoloSuitStreamingFrame {
  scene: {
    actors: HoloSuitActor[];
    props: HoloSuitProp[];
  };
  timestamp?: number;
  version?: number;
}

// ─── Recording Metadata ───────────────────────────────────────────────────────
// Format discovered from DefaultRecordings/*.srec_meta binary text format
// Recording files: SingingIntoMicrophone_FaceCap.srec_meta etc.

export interface HoloSuitBezierFrame {
  time: number;   // Time in seconds
  value: number;  // Value (0 or 1 for boolean gates; float for other curves)
}

export interface HoloSuitRecordingFilter {
  filterType: string;  // e.g. "GaitPhaseLockFilter"
  actorName: string;   // e.g. "C2J"
  active: boolean;
  curves: HoloSuitBezierFrame[][];
}

export interface HoloSuitRecordingMeta {
  filename: string;
  actorName?: string;
  hasBody: boolean;
  hasFace: boolean;
  hasHands: boolean;
  filters: HoloSuitRecordingFilter[];
  regions: unknown[];
}

// ─── Available HoloSuit Recording Names (DefaultRecordings) ─────────────────────
// Files discovered in: StreamingAssets/Studio/DefaultRecordings/

export const HOLOSUIT_DEFAULT_RECORDINGS = [
  { name: 'AngryFan',              hasFace: false, category: 'acting'   },
  { name: 'BowAndArrow',           hasFace: false, category: 'sports'   },
  { name: 'CastingExpelliarmus',   hasFace: true,  category: 'fantasy'  },
  { name: 'ConjuringDemon',        hasFace: true,  category: 'fantasy'  },
  { name: 'CountToFive',           hasFace: true,  category: 'speech'   },
  { name: 'Gunslinger',            hasFace: false, category: 'action'   },
  { name: 'HelloNiceToMeetYou',    hasFace: false, category: 'social'   },
  { name: 'MartialArtKata',        hasFace: false, category: 'martial'  },
  { name: 'PlayingAirPiano',       hasFace: false, category: 'music'    },
  { name: 'SingingIntoMicrophone', hasFace: true,  category: 'music'    },  // Perfect for Boostify!
  { name: 'SingingOpera',          hasFace: true,  category: 'music'    },  // Perfect for Boostify!
  { name: 'SummoningMagic',        hasFace: false, category: 'fantasy'  },
  { name: 'UsingComputer',         hasFace: false, category: 'everyday' },
] as const;

export type HoloSuitDefaultRecordingName = typeof HOLOSUIT_DEFAULT_RECORDINGS[number]['name'];

// ─── Stream parse helper ──────────────────────────────────────────────────────

export function parseHoloSuitFrame(json: unknown): HoloSuitStreamingFrame | null {
  if (!json || typeof json !== 'object') return null;
  const raw = json as Record<string, unknown>;
  if (!raw.scene || typeof raw.scene !== 'object') return null;
  const scene = raw.scene as Record<string, unknown>;
  if (!Array.isArray(scene.actors)) return null;
  return raw as HoloSuitStreamingFrame;
}

export function getFirstActor(frame: HoloSuitStreamingFrame): HoloSuitActor | null {
  return frame.scene.actors[0] ?? null;
}

export function getActorByName(frame: HoloSuitStreamingFrame, name: string): HoloSuitActor | null {
  return frame.scene.actors.find(a => a.name === name) ?? null;
}

export function getBoneRotation(actor: HoloSuitActor, boneName: string): HoloSuitQuaternion | null {
  const bone = actor.body.find(b => b.name === boneName);
  return bone?.rotation ?? null;
}

export function getBonePosition(actor: HoloSuitActor, boneName: string): HoloSuitVector3 | null {
  const bone = actor.body.find(b => b.name === boneName);
  return bone?.position ?? null;
}

// ─── HoloSuit Studio Network Config ─────────────────────────────────────────────
// Default values for HoloSuit Studio Custom Streaming setup

export const HOLOSUIT_STREAMING_DEFAULTS = {
  udpPort: 14043,
  websocketPort: 14043,
  protocol: 'JSON' as const,
  format: 'Custom Streaming',
  multicastAddress: null,
  // From StreamingAssets/Studio/Settings — advanced.txt (empty = use defaults)
  sendRate: 60,  // fps
  coordinateSystem: 'Y-up Right-handed',
};
