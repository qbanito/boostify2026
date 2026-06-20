// ─── CC4 Workflow Bridge ──────────────────────────────────────────────────────
// Orchestrates the full HoloSuit → CC4 → iClone → Boostify pipeline:
//   1. Receives HoloSuit streaming frame (live UDP/WS or offline .srec)
//   2. Retargets HoloSuit bones → CC4 RL_* bone names
//   3. Applies iClone motion mask filtering (e.g. only upper body)
//   4. Outputs CC4 pose as JSON-ready pose data for HologramRenderer
//
// Data sources:
//   - cc4BoneMapping.ts — real bone names from CC4 Default.ini
//   - holosuitStreamingProtocol.ts — official HoloSuit streaming JSON format
//   - iClone IkControllerPresets.ini — HIK IDs
//   - iClone EffectorStateChangeMap.ini — bone chain traversal order

import {
  CC4_BODY_MAPPING, CC4_FINGER_MAPPING, ICLONE_MOTION_MASKS,
  holosuitToCC4, getCC4BonesByMask, CC4_AVATAR_UIDS, CC4_BONE_UID,
  type CC4MotionPart,
} from './cc4BoneMapping';

import {
  type HoloSuitStreamingFrame, type HoloSuitActor, type HoloSuitQuaternion,
  type HoloSuitVector3, parseHoloSuitFrame, getFirstActor, getBoneRotation,
} from './holosuitStreamingProtocol';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CC4Pose {
  avatarUid: string;        // e.g. "RL_CC3_Plus"
  boneUid: string;          // "RL_Motion_Bone"
  timestamp: number;
  frameIndex: number;
  bones: Record<string, CC4BoneTransform>;
  fingers?: Record<string, CC4BoneTransform>;
  face?: CC4FaceBlendshapes;
}

export interface CC4BoneTransform {
  rotation: HoloSuitQuaternion;
  position?: HoloSuitVector3;
}

export interface CC4FaceBlendshapes {
  jawOpen?: number;
  mouthSmileLeft?: number;
  mouthSmileRight?: number;
  eyeBlinkLeft?: number;
  eyeBlinkRight?: number;
  browInnerUp?: number;
  tongueOut?: number;
  [key: string]: number | undefined;
}

export type WorkflowMaskPreset = keyof typeof ICLONE_MOTION_MASKS;

export interface CC4WorkflowConfig {
  avatarUid: string;
  maskPreset: WorkflowMaskPreset;
  includeFingers: boolean;
  includeFace: boolean;
  smoothingFactor: number;  // 0–1 (0 = raw, 1 = max smooth)
  scaleMultiplier: number;  // character scale from calibration
  applyTPoseOffset: boolean; // apply arm-open preset offset (A-Pose → T-Pose)
}

export const DEFAULT_WORKFLOW_CONFIG: CC4WorkflowConfig = {
  avatarUid: CC4_AVATAR_UIDS.CC3_Plus,
  maskPreset: 'FullBody',
  includeFingers: true,
  includeFace: true,
  smoothingFactor: 0.3,
  scaleMultiplier: 1.0,
  applyTPoseOffset: false,
};

// ─── Quaternion Math ──────────────────────────────────────────────────────────

function slerpQuat(
  a: HoloSuitQuaternion,
  b: HoloSuitQuaternion,
  t: number
): HoloSuitQuaternion {
  let dot = a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w;
  // Ensure shortest path
  const bFlipped = dot < 0
    ? { x: -b.x, y: -b.y, z: -b.z, w: -b.w }
    : b;
  dot = Math.abs(dot);
  if (dot > 0.9995) {
    // Linear interpolation for nearly identical quaternions
    const r = {
      x: a.x + t*(bFlipped.x - a.x),
      y: a.y + t*(bFlipped.y - a.y),
      z: a.z + t*(bFlipped.z - a.z),
      w: a.w + t*(bFlipped.w - a.w),
    };
    const len = Math.sqrt(r.x*r.x + r.y*r.y + r.z*r.z + r.w*r.w);
    return { x: r.x/len, y: r.y/len, z: r.z/len, w: r.w/len };
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const s1 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const s2 = sinTheta / sinTheta0;
  return {
    x: s1*a.x + s2*bFlipped.x,
    y: s1*a.y + s2*bFlipped.y,
    z: s1*a.z + s2*bFlipped.z,
    w: s1*a.w + s2*bFlipped.w,
  };
}

const IDENTITY_QUAT: HoloSuitQuaternion = { x: 0, y: 0, z: 0, w: 1 };

// ─── CC4 Workflow Bridge ──────────────────────────────────────────────────────

class CC4WorkflowBridge {
  private config: CC4WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };
  private lastPose: CC4Pose | null = null;
  private frameIndex = 0;
  private listeners: Array<(pose: CC4Pose) => void> = [];

  // Allowed bones after applying mask filter
  private allowedCC4Bones: Set<string> = new Set();

  configure(config: Partial<CC4WorkflowConfig>): void {
    this.config = { ...this.config, ...config };
    this.rebuildMask();
  }

  private rebuildMask(): void {
    const bones = getCC4BonesByMask(this.config.maskPreset);
    this.allowedCC4Bones = new Set(bones);
  }

  onPose(cb: (pose: CC4Pose) => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  // ─── Process a raw HoloSuit JSON frame ────────────────────────────────────

  processRawFrame(rawJson: unknown): CC4Pose | null {
    const frame = parseHoloSuitFrame(rawJson);
    if (!frame) return null;
    const actor = getFirstActor(frame);
    if (!actor) return null;
    return this.processActor(actor, frame.timestamp);
  }

  processActor(actor: HoloSuitActor, timestamp?: number): CC4Pose {
    const pose: CC4Pose = {
      avatarUid: this.config.avatarUid,
      boneUid: CC4_BONE_UID,
      timestamp: timestamp ?? Date.now(),
      frameIndex: ++this.frameIndex,
      bones: {},
      fingers: this.config.includeFingers ? {} : undefined,
      face: this.config.includeFace ? this.extractFace(actor) : undefined,
    };

    // ── Body bones ──
    for (const mapping of CC4_BODY_MAPPING) {
      if (!this.allowedCC4Bones.has(mapping.cc4Bone)) continue;

      const rRot = getBoneRotation(actor, mapping.holosuitBone);
      const rawRotation = rRot ?? IDENTITY_QUAT;

      // Apply smoothing (SLERP toward last frame's rotation)
      let rotation = rawRotation;
      if (this.lastPose && this.config.smoothingFactor > 0) {
        const prev = this.lastPose.bones[mapping.cc4Bone]?.rotation ?? IDENTITY_QUAT;
        rotation = slerpQuat(rawRotation, prev, this.config.smoothingFactor);
      }

      pose.bones[mapping.cc4Bone] = { rotation };
    }

    // ── Finger bones ──
    if (this.config.includeFingers && pose.fingers) {
      for (const fMapping of CC4_FINGER_MAPPING) {
        const handBones = fMapping.side === 'left' ? actor.leftHand : actor.rightHand;
        if (!handBones) continue;
        const bone = handBones.find(b => b.name === fMapping.holosuitBone);
        if (bone) {
          pose.fingers![fMapping.cc4Bone] = { rotation: bone.rotation };
        }
      }
    }

    this.lastPose = pose;

    // Emit to listeners
    for (const l of this.listeners) l(pose);

    return pose;
  }

  private extractFace(actor: HoloSuitActor): CC4FaceBlendshapes | undefined {
    if (!actor.face) return undefined;
    const f = actor.face;
    return {
      jawOpen:         f.jawOpen,
      mouthSmileLeft:  f.mouthSmileLeft,
      mouthSmileRight: f.mouthSmileRight,
      eyeBlinkLeft:    f.eyeBlinkLeft,
      eyeBlinkRight:   f.eyeBlinkRight,
      browInnerUp:     f.browInnerUp,
      tongueOut:       f.tongueOut,
      eyeLookDownLeft: f.eyeLookDownLeft,
      eyeLookDownRight:f.eyeLookDownRight,
    };
  }

  getLastPose(): CC4Pose | null {
    return this.lastPose;
  }

  reset(): void {
    this.lastPose = null;
    this.frameIndex = 0;
  }

  getConfig(): CC4WorkflowConfig {
    return { ...this.config };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const cc4WorkflowBridge = new CC4WorkflowBridge();

// ─── CC4 Character Templates ──────────────────────────────────────────────────
// Pre-built character rig configs based on CC4 avatar presets

export const CC4_CHARACTER_TEMPLATES = {
  CC3Plus_Default: {
    avatarUid: CC4_AVATAR_UIDS.CC3_Plus,
    boneUid: CC4_BONE_UID,
    displayName: 'Character Creator 4 — CC3+ Standard',
    tPoseArmOffset: 0,   // degrees — T-Pose
    scaleMultiplier: 1.0,
    hasFingers: true,
    hasFace: true,
    exportFormats: ['FBX', 'GLB', 'USD', 'OBJ'] as const,
  },
  CC3Plus_APose: {
    avatarUid: CC4_AVATAR_UIDS.CC3_Plus,
    boneUid: CC4_BONE_UID,
    displayName: 'CC4 CC3+ — A-Pose (arms 20° open)',
    tPoseArmOffset: 20,  // degrees — matches ArmOpen.ini: RL_L_UpperArm="0,0,20"
    scaleMultiplier: 1.0,
    hasFingers: true,
    hasFace: true,
    exportFormats: ['FBX', 'GLB'] as const,
  },
  G3_Standard: {
    avatarUid: CC4_AVATAR_UIDS.G3_Standard,
    boneUid: CC4_BONE_UID,
    displayName: 'Character Creator 4 — G3 Standard',
    tPoseArmOffset: 0,
    scaleMultiplier: 1.0,
    hasFingers: true,
    hasFace: true,
    exportFormats: ['FBX', 'GLB'] as const,
  },
} as const;

export type CC4TemplateName = keyof typeof CC4_CHARACTER_TEMPLATES;

// ─── Workflow Pipeline Steps ──────────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  tool: 'holosuit' | 'cc4' | 'iclone' | 'boostify';
  duration?: number; // ms
}

export function buildWorkflowSteps(includeIClone: boolean): WorkflowStep[] {
  const steps: WorkflowStep[] = [
    {
      id: 'holosuit-connect',
      name: 'HoloSuit Studio',
      description: 'Connect to HoloSuit Pro streaming (UDP 14043)',
      status: 'pending',
      tool: 'holosuit',
    },
    {
      id: 'retarget-cc4',
      name: 'Retarget → CC4',
      description: 'Map HoloSuit bones to RL_CC3_Plus rig (53 bones)',
      status: 'pending',
      tool: 'cc4',
    },
  ];

  if (includeIClone) {
    steps.push({
      id: 'iclone-export',
      name: 'iClone 8 Export',
      description: 'Apply motion mask, bake animation, export GLB',
      status: 'pending',
      tool: 'iclone',
    });
  }

  steps.push({
    id: 'boostify-load',
    name: 'Boostify HoloStage',
    description: 'Load character + live pose into HologramRenderer',
    status: 'pending',
    tool: 'boostify',
  });

  return steps;
}
