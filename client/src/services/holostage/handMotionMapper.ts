// ─── Hand Motion Mapper ───────────────────────────────────────────────────────
// Converts HoloSuit hand pose data to character finger joint rotations.

import type { HandPose, FingerPose } from '../../schemas/holostage/motionSource.schema';

export interface FingerJointAngles {
  finger: string;
  proximal: number;   // degrees
  medial: number;
  distal: number;
}

export interface MappedHandPose {
  leftFingers: FingerJointAngles[];
  rightFingers: FingerJointAngles[];
  leftWristRot: { x: number; y: number; z: number };
  rightWristRot: { x: number; y: number; z: number };
}

function mapFingerToAngles(finger: FingerPose): FingerJointAngles {
  const RAD_TO_DEG = 180 / Math.PI;
  return {
    finger: finger.finger,
    proximal: finger.joints[0] ? finger.joints[0].y * RAD_TO_DEG * 90 : 0,
    medial:   finger.joints[1] ? finger.joints[1].y * RAD_TO_DEG * 90 : 0,
    distal:   finger.joints[2] ? finger.joints[2].y * RAD_TO_DEG * 90 : 0,
  };
}

export function mapHandPose(handPose: HandPose): MappedHandPose {
  const leftWrist = handPose.left.wrist;
  const rightWrist = handPose.right.wrist;
  const RAD_TO_DEG = 180 / Math.PI;

  return {
    leftFingers:  handPose.left.fingers.map(mapFingerToAngles),
    rightFingers: handPose.right.fingers.map(mapFingerToAngles),
    leftWristRot: {
      x: leftWrist.x * RAD_TO_DEG,
      y: leftWrist.y * RAD_TO_DEG,
      z: leftWrist.z * RAD_TO_DEG,
    },
    rightWristRot: {
      x: rightWrist.x * RAD_TO_DEG,
      y: rightWrist.y * RAD_TO_DEG,
      z: rightWrist.z * RAD_TO_DEG,
    },
  };
}

/**
 * Returns a simple gesture label from hand curl values.
 */
export function detectGesture(hand: HandPose['left']): string {
  if (!hand.active) return 'inactive';
  const avgCurl = hand.fingers.reduce((s, f) => s + f.curl, 0) / hand.fingers.length;
  const thumbCurl = hand.fingers.find(f => f.finger === 'thumb')?.curl ?? 0;

  if (avgCurl < 0.2) return 'open_hand';
  if (avgCurl > 0.7) return 'fist';
  if (thumbCurl < 0.2 && avgCurl > 0.5) return 'thumbs_up';
  return 'neutral';
}
