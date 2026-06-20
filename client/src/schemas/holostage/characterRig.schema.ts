// ─── Character Rig Schema ─────────────────────────────────────────────────────

export type RigBone =
  | 'Hips' | 'Spine' | 'Spine1' | 'Spine2' | 'Neck' | 'Head'
  | 'LeftShoulder' | 'LeftArm' | 'LeftForeArm' | 'LeftHand'
  | 'RightShoulder' | 'RightArm' | 'RightForeArm' | 'RightHand'
  | 'LeftUpLeg' | 'LeftLeg' | 'LeftFoot' | 'LeftToeBase'
  | 'RightUpLeg' | 'RightLeg' | 'RightFoot' | 'RightToeBase';

export interface RigBoneMapping {
  holosuitBone: string;        // HoloSuit bone name
  characterBone: string;     // Character Creator bone name
  invertX: boolean;
  invertY: boolean;
  invertZ: boolean;
  offsetRotation: { x: number; y: number; z: number };
  weight: number;            // 0-1 blend weight
}

export interface CharacterRig {
  id: string;
  characterId: string;
  rigType: 'humanoid' | 'custom';
  boneMappings: RigBoneMapping[];
  rootBone: string;
  scaleMultiplier: number;
  handMappingEnabled: boolean;
  faceMappingEnabled: boolean;
  iKEnabled: boolean;
  footIK: boolean;
  handIK: boolean;
  // ── Calibration fields (written by CharacterCalibration) ──────────────────
  heightOffset?: number;           // meters, -0.5 to +0.5
  armLengthMultiplier?: number;    // 0.9 to 1.1
  legLengthMultiplier?: number;    // 0.9 to 1.1
  hipOffset?: number;              // -0.2 to +0.2
  neckOffset?: number;             // -0.1 to +0.1
  footOffset?: number;             // -0.1 to +0.1
  spineOffset?: number;            // -0.1 to +0.1
  smoothingFactor?: number;        // 0 to 1
  latencyCompensationMs?: number;  // 0 to 250
  rootMotionEnabled?: boolean;
}

export const DEFAULT_HUMANOID_MAPPING: RigBoneMapping[] = [
  { holosuitBone: 'hip', characterBone: 'Hips', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'spine', characterBone: 'Spine', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'chest', characterBone: 'Spine2', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'neck', characterBone: 'Neck', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'head', characterBone: 'Head', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'left_upper_arm', characterBone: 'LeftArm', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'left_lower_arm', characterBone: 'LeftForeArm', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'right_upper_arm', characterBone: 'RightArm', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'right_lower_arm', characterBone: 'RightForeArm', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'left_thigh', characterBone: 'LeftUpLeg', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'left_shin', characterBone: 'LeftLeg', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'right_thigh', characterBone: 'RightUpLeg', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
  { holosuitBone: 'right_shin', characterBone: 'RightLeg', invertX: false, invertY: false, invertZ: false, offsetRotation: { x: 0, y: 0, z: 0 }, weight: 1.0 },
];
