// ─── Retargeting Engine ───────────────────────────────────────────────────────
// Maps HoloSuit motion data bone names to Character Creator rig bone names.

import type { HoloSuitMotionFrame, BoneTransform } from '../../schemas/holostage/motionSource.schema';
import type { CharacterRig, RigBoneMapping } from '../../schemas/holostage/characterRig.schema';

export interface RetargetedPose {
  bones: Map<string, { rx: number; ry: number; rz: number; rw: number }>;
  rootOffset: { x: number; y: number; z: number };
}

/**
 * Applies HoloSuit bone data to character rig using the bone mappings.
 */
export function retargetFrame(frame: HoloSuitMotionFrame, rig: CharacterRig): RetargetedPose {
  const bones = new Map<string, { rx: number; ry: number; rz: number; rw: number }>();

  for (const mapping of rig.boneMappings) {
    const sourceBone = frame.body.bones.find(
      b => b.bone.toLowerCase() === mapping.holosuitBone.toLowerCase()
    );
    if (!sourceBone) continue;

    const r = sourceBone.rotation;
    const offset = mapping.offsetRotation;

    bones.set(mapping.characterBone, {
      rx: (mapping.invertX ? -r.x : r.x) + offset.x,
      ry: (mapping.invertY ? -r.y : r.y) + offset.y,
      rz: (mapping.invertZ ? -r.z : r.z) + offset.z,
      rw: r.w,
    });
  }

  return {
    bones,
    rootOffset: {
      x: frame.body.rootPosition.x * rig.scaleMultiplier,
      y: frame.body.rootPosition.y * rig.scaleMultiplier,
      z: frame.body.rootPosition.z * rig.scaleMultiplier,
    },
  };
}

/**
 * Blends two retargeted poses by a factor (0 = a, 1 = b).
 */
export function blendPoses(a: RetargetedPose, b: RetargetedPose, t: number): RetargetedPose {
  const bones = new Map<string, { rx: number; ry: number; rz: number; rw: number }>();
  const allBones = new Set([...a.bones.keys(), ...b.bones.keys()]);

  for (const bone of allBones) {
    const ba = a.bones.get(bone) ?? { rx: 0, ry: 0, rz: 0, rw: 1 };
    const bb = b.bones.get(bone) ?? { rx: 0, ry: 0, rz: 0, rw: 1 };
    bones.set(bone, {
      rx: ba.rx + (bb.rx - ba.rx) * t,
      ry: ba.ry + (bb.ry - ba.ry) * t,
      rz: ba.rz + (bb.rz - ba.rz) * t,
      rw: ba.rw + (bb.rw - ba.rw) * t,
    });
  }

  return {
    bones,
    rootOffset: {
      x: a.rootOffset.x + (b.rootOffset.x - a.rootOffset.x) * t,
      y: a.rootOffset.y + (b.rootOffset.y - a.rootOffset.y) * t,
      z: a.rootOffset.z + (b.rootOffset.z - a.rootOffset.z) * t,
    },
  };
}
