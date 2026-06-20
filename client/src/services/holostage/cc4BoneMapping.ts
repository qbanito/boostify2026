// ─── CC4 Bone Mapping ─────────────────────────────────────────────────────────
// Extracted directly from:
//   C:\Program Files\Reallusion\Character Creator 4\Program\Bone\AvatarProportionPreset\Default.ini
//   AvatarUid=RL_CC3_Plus  |  BoneUid=RL_Motion_Bone
//
// Maps HoloSuit HoloSuit Pro streaming bone names → CC4/iClone RL_* bone names.
// Also exports full canonical CC4 bone list for retargeting validation.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CC4BoneMapping {
  holosuitBone: string;      // HoloSuit Studio Custom Streaming bone name
  cc4Bone: string;         // Reallusion Character Creator 4 RL_* bone name
  icloneHikId?: number;    // iClone HIK effector ID (from IkControllerPresets.ini)
  icloneEffectorName?: string; // iClone HIK effector human name
  motionPart?: CC4MotionPart;  // iClone MaskPresets.ini part group
  side?: 'left' | 'right' | 'center';
  isRequired: boolean;
}

// Motion mask parts from iClone 8 MaskPresets.ini
export type CC4MotionPart =
  | 'Head' | 'Torso'
  | 'LeftArm' | 'RightArm'
  | 'LeftHand' | 'RightHand'
  | 'LeftFingers' | 'RightFingers'
  | 'LeftLeg' | 'RightLeg';

// iClone motion mask presets (MaskPresets.ini)
export const ICLONE_MOTION_MASKS: Record<string, CC4MotionPart[]> = {
  TopPreset:    ['Head', 'Torso', 'LeftArm', 'RightArm', 'LeftHand', 'RightHand', 'LeftFingers', 'RightFingers'],
  BottomPreset: ['LeftLeg', 'RightLeg'],
  BodyPreset:   ['Head', 'Torso', 'LeftLeg', 'RightLeg'],
  ArmPreset:    ['LeftArm', 'RightArm', 'LeftHand', 'RightHand', 'LeftFingers', 'RightFingers'],
  FingerPreset: ['LeftFingers', 'RightFingers'],
  FullBody:     ['Head', 'Torso', 'LeftArm', 'RightArm', 'LeftHand', 'RightHand',
                 'LeftFingers', 'RightFingers', 'LeftLeg', 'RightLeg'],
};

// ─── Main Body Mapping ────────────────────────────────────────────────────────
// HoloSuit bone order matches the Custom Streaming JSON body array.
// iClone HIK IDs from IkControllerPresets.ini.

export const CC4_BODY_MAPPING: CC4BoneMapping[] = [
  // ── Core spine ──
  { holosuitBone: 'Hip',            cc4Bone: 'RL_Hips',        icloneHikId: 1,  icloneEffectorName: 'Hips',        motionPart: 'Torso',  side: 'center', isRequired: true  },
  { holosuitBone: 'Spine',          cc4Bone: 'RL_Waist',       icloneHikId: 23, icloneEffectorName: 'Spine01',     motionPart: 'Torso',  side: 'center', isRequired: true  },
  { holosuitBone: 'Chest',          cc4Bone: 'RL_Chest',       icloneHikId: 24, icloneEffectorName: 'Spine02',     motionPart: 'Torso',  side: 'center', isRequired: true  },
  { holosuitBone: 'Neck',           cc4Bone: 'RL_Neck',        icloneHikId: 20, icloneEffectorName: 'Neck',        motionPart: 'Head',   side: 'center', isRequired: true  },
  { holosuitBone: 'Head',           cc4Bone: 'RL_Head',        icloneHikId: 15, icloneEffectorName: 'Head',        motionPart: 'Head',   side: 'center', isRequired: true  },

  // ── Left arm ──
  { holosuitBone: 'LeftShoulder',   cc4Bone: 'RL_L_Clavicle',  icloneHikId: 18, icloneEffectorName: 'LeftShoulder', motionPart: 'LeftArm',  side: 'left', isRequired: true  },
  { holosuitBone: 'LeftUpperArm',   cc4Bone: 'RL_L_UpperArm',  icloneHikId: 9,  icloneEffectorName: 'LeftArm',      motionPart: 'LeftArm',  side: 'left', isRequired: true  },
  { holosuitBone: 'LeftLowerArm',   cc4Bone: 'RL_L_Forearm',   icloneHikId: 10, icloneEffectorName: 'LeftForeArm',  motionPart: 'LeftArm',  side: 'left', isRequired: true  },
  { holosuitBone: 'LeftHand',       cc4Bone: 'RL_L_Hand',      icloneHikId: 11, icloneEffectorName: 'LeftHand',     motionPart: 'LeftHand', side: 'left', isRequired: true  },

  // ── Right arm ──
  { holosuitBone: 'RightShoulder',  cc4Bone: 'RL_R_Clavicle',  icloneHikId: 19, icloneEffectorName: 'RightShoulder', motionPart: 'RightArm',  side: 'right', isRequired: true  },
  { holosuitBone: 'RightUpperArm',  cc4Bone: 'RL_R_UpperArm',  icloneHikId: 12, icloneEffectorName: 'RightArm',      motionPart: 'RightArm',  side: 'right', isRequired: true  },
  { holosuitBone: 'RightLowerArm',  cc4Bone: 'RL_R_Forearm',   icloneHikId: 13, icloneEffectorName: 'RightForeArm',  motionPart: 'RightArm',  side: 'right', isRequired: true  },
  { holosuitBone: 'RightHand',      cc4Bone: 'RL_R_Hand',      icloneHikId: 14, icloneEffectorName: 'RightHand',     motionPart: 'RightHand', side: 'right', isRequired: true  },

  // ── Left leg ──
  { holosuitBone: 'LeftUpperLeg',   cc4Bone: 'RL_L_Thigh',     icloneHikId: 2,  icloneEffectorName: 'LeftUpLeg',  motionPart: 'LeftLeg',  side: 'left', isRequired: true  },
  { holosuitBone: 'LeftLowerLeg',   cc4Bone: 'RL_L_Calf',      icloneHikId: 3,  icloneEffectorName: 'LeftLeg',    motionPart: 'LeftLeg',  side: 'left', isRequired: true  },
  { holosuitBone: 'LeftFoot',       cc4Bone: 'RL_L_Foot',      icloneHikId: 4,  icloneEffectorName: 'LeftFoot',   motionPart: 'LeftLeg',  side: 'left', isRequired: true  },
  { holosuitBone: 'LeftToe',        cc4Bone: 'RL_L_Toe',       icloneHikId: 26, icloneEffectorName: 'LeftToeBase', motionPart: 'LeftLeg', side: 'left', isRequired: false },

  // ── Right leg ──
  { holosuitBone: 'RightUpperLeg',  cc4Bone: 'RL_R_Thigh',     icloneHikId: 5,  icloneEffectorName: 'RightUpLeg', motionPart: 'RightLeg',  side: 'right', isRequired: true  },
  { holosuitBone: 'RightLowerLeg',  cc4Bone: 'RL_R_Calf',      icloneHikId: 6,  icloneEffectorName: 'RightLeg',   motionPart: 'RightLeg',  side: 'right', isRequired: true  },
  { holosuitBone: 'RightFoot',      cc4Bone: 'RL_R_Foot',      icloneHikId: 7,  icloneEffectorName: 'RightFoot',  motionPart: 'RightLeg',  side: 'right', isRequired: true  },
  { holosuitBone: 'RightToe',       cc4Bone: 'RL_R_Toe',       icloneHikId: 27, icloneEffectorName: 'RightToeBase', motionPart: 'RightLeg', side: 'right', isRequired: false },
];

// ─── Finger Mapping ───────────────────────────────────────────────────────────
// CC4 finger naming: RL_L_Finger{fingerIndex}{phalangeIndex}
//   fingerIndex: 0=Thumb, 1=Index, 2=Middle, 3=Ring, 4=Pinky
//   phalangeIndex: 0=Metacarpal, 1=Proximal, 2=Distal
// HoloSuit hand streaming bone names follow HoloSuit Pro hand module format.

export interface CC4FingerBoneMapping {
  holosuitBone: string;
  cc4Bone: string;
  finger: 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky';
  phalange: 'Metacarpal' | 'Proximal' | 'Distal';
  side: 'left' | 'right';
  fingerIdx: number;
  phalangeIdx: number;
}

function buildFingerMappings(): CC4FingerBoneMapping[] {
  const fingers = [
    { name: 'Thumb',  idx: 0, holosuitLeft: 'LeftThumb',  holosuitRight: 'RightThumb'  },
    { name: 'Index',  idx: 1, holosuitLeft: 'LeftIndex',  holosuitRight: 'RightIndex'  },
    { name: 'Middle', idx: 2, holosuitLeft: 'LeftMiddle', holosuitRight: 'RightMiddle' },
    { name: 'Ring',   idx: 3, holosuitLeft: 'LeftRing',   holosuitRight: 'RightRing'   },
    { name: 'Pinky',  idx: 4, holosuitLeft: 'LeftPinky',  holosuitRight: 'RightPinky'  },
  ] as const;

  const phalanges = [
    { name: 'Metacarpal', idx: 0, suffix: 'Meta'     },
    { name: 'Proximal',   idx: 1, suffix: 'Proximal' },
    { name: 'Distal',     idx: 2, suffix: 'Distal'   },
  ] as const;

  const result: CC4FingerBoneMapping[] = [];
  for (const finger of fingers) {
    for (const phalange of phalanges) {
      result.push({
        holosuitBone: `${finger.holosuitLeft}${phalange.suffix}`,
        cc4Bone: `RL_L_Finger${finger.idx}${phalange.idx}`,
        finger: finger.name,
        phalange: phalange.name,
        side: 'left',
        fingerIdx: finger.idx,
        phalangeIdx: phalange.idx,
      });
      result.push({
        holosuitBone: `${finger.holosuitRight}${phalange.suffix}`,
        cc4Bone: `RL_R_Finger${finger.idx}${phalange.idx}`,
        finger: finger.name,
        phalange: phalange.name,
        side: 'right',
        fingerIdx: finger.idx,
        phalangeIdx: phalange.idx,
      });
    }
  }
  return result;
}

export const CC4_FINGER_MAPPING = buildFingerMappings();

// ─── All CC4 Bones (canonical complete set from Default.ini) ─────────────────

export const CC4_ALL_BONES = [
  // Core
  'RL_Head', 'RL_Neck', 'RL_Chest', 'RL_Waist', 'RL_Hips',
  // Clavicles
  'RL_L_Clavicle', 'RL_R_Clavicle',
  // Arms
  'RL_L_UpperArm', 'RL_R_UpperArm',
  'RL_L_Forearm',  'RL_R_Forearm',
  'RL_L_Hand',     'RL_R_Hand',
  // Legs
  'RL_L_Thigh', 'RL_R_Thigh',
  'RL_L_Calf',  'RL_R_Calf',
  'RL_L_Foot',  'RL_R_Foot',
  'RL_L_Toe',   'RL_R_Toe',
  // Right fingers (as in Default.ini)
  'RL_R_Finger00', 'RL_R_Finger01', 'RL_R_Finger02',
  'RL_R_Finger10', 'RL_R_Finger11', 'RL_R_Finger12',
  'RL_R_Finger20', 'RL_R_Finger21', 'RL_R_Finger22',
  'RL_R_Finger30', 'RL_R_Finger31', 'RL_R_Finger32',
  'RL_R_Finger40', 'RL_R_Finger41', 'RL_R_Finger42',
  // Left fingers
  'RL_L_Finger00', 'RL_L_Finger01', 'RL_L_Finger02',
  'RL_L_Finger10', 'RL_L_Finger11', 'RL_L_Finger12',
  'RL_L_Finger20', 'RL_L_Finger21', 'RL_L_Finger22',
  'RL_L_Finger30', 'RL_L_Finger31', 'RL_L_Finger32',
  'RL_L_Finger40', 'RL_L_Finger41', 'RL_L_Finger42',
] as const;

export type CC4BoneName = typeof CC4_ALL_BONES[number];

// ─── CC4 Avatar UIDs ──────────────────────────────────────────────────────────
// From AvatarProportionPreset/Default.ini — Uid section

export const CC4_AVATAR_UIDS = {
  CC3_Plus:     'RL_CC3_Plus',        // Standard CC4 character (CC3+ rig)
  CC4_Standard: 'RL_CC4_Standard',    // CC4 standard
  G3_Standard:  'RL_CharacterCreator_Base_Std_G3',
  G6_Standard:  'RL_G6_Standard_Series',
} as const;

export const CC4_BONE_UID = 'RL_Motion_Bone';

// ─── CC4 Arm Presets ─────────────────────────────────────────────────────────
// From AvatarProportionPreset/*.ini — UpperArm rotations for each pose preset

export const CC4_ARM_PRESETS: Record<string, { RL_L_UpperArm: string; RL_R_UpperArm: string }> = {
  Default:         { RL_L_UpperArm: '0,0,0',   RL_R_UpperArm: '0,0,0'    },  // T-Pose
  ArmOpen:         { RL_L_UpperArm: '0,0,20',  RL_R_UpperArm: '0,0,-20'  },  // Arms slightly open (A-Pose)
  ArmClose:        { RL_L_UpperArm: '0,0,0',   RL_R_UpperArm: '0,0,0'    },
  ShoulderDown_01: { RL_L_UpperArm: '0,0,0',   RL_R_UpperArm: '0,0,0'    },
  Fat_ShoulderUp_01: { RL_L_UpperArm: '0,0,0', RL_R_UpperArm: '0,0,0'   },
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

const HOLOSUIT_TO_CC4_MAP = new Map<string, string>(
  CC4_BODY_MAPPING.map(m => [m.holosuitBone, m.cc4Bone])
);

const CC4_TO_HOLOSUIT_MAP = new Map<string, string>(
  CC4_BODY_MAPPING.map(m => [m.cc4Bone, m.holosuitBone])
);

export function holosuitToCC4(holosuitBone: string): string | undefined {
  return HOLOSUIT_TO_CC4_MAP.get(holosuitBone);
}

export function cc4ToHoloSuit(cc4Bone: string): string | undefined {
  return CC4_TO_HOLOSUIT_MAP.get(cc4Bone);
}

export function getCC4BonesByMotionPart(part: CC4MotionPart): string[] {
  return CC4_BODY_MAPPING.filter(m => m.motionPart === part).map(m => m.cc4Bone);
}

export function getCC4BonesByMask(maskName: keyof typeof ICLONE_MOTION_MASKS): string[] {
  const parts = ICLONE_MOTION_MASKS[maskName] ?? [];
  const bones: string[] = [];
  for (const part of parts) {
    bones.push(...getCC4BonesByMotionPart(part));
  }
  return bones;
}

// ─── iClone Bone Traversal Chain ─────────────────────────────────────────────
// From iClone 8: Resource/ICMotion/EffectorStateChangeMap.ini
// Up/Down defines the UI keyboard traversal order — also useful for FK chain ordering.

export const ICLONE_BONE_TRAVERSAL_CHAIN = [
  'Head', 'Neck', 'ChestOrigin', 'Hip',
  'RightShoulder', 'RightElbow', 'RightHand',
  'LeftShoulder', 'LeftElbow', 'LeftHand',
  'RightHip', 'RightKnee', 'RightFoot', 'RightToe',
  'LeftHip', 'LeftKnee', 'LeftFoot', 'LeftToe',
] as const;
