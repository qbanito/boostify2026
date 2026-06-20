// ─── Face Blendshape Mapper ───────────────────────────────────────────────────
// Maps HoloSuit face capture blendshapes to Character Creator ARKit blendshapes.

import type { FacePose, BlendshapeValue } from '../../schemas/holostage/motionSource.schema';

// Mapping: HoloSuit name → CC/ARKit name + multiplier
const BLENDSHAPE_MAP: { holosuit: string; arkit: string; multiplier: number }[] = [
  { holosuit: 'eyeBlinkLeft',     arkit: 'eyeBlinkLeft',     multiplier: 1.0 },
  { holosuit: 'eyeBlinkRight',    arkit: 'eyeBlinkRight',    multiplier: 1.0 },
  { holosuit: 'eyeWideLeft',      arkit: 'eyeWideLeft',      multiplier: 0.8 },
  { holosuit: 'eyeWideRight',     arkit: 'eyeWideRight',     multiplier: 0.8 },
  { holosuit: 'mouthSmileLeft',   arkit: 'mouthSmileLeft',   multiplier: 1.0 },
  { holosuit: 'mouthSmileRight',  arkit: 'mouthSmileRight',  multiplier: 1.0 },
  { holosuit: 'mouthFrownLeft',   arkit: 'mouthFrownLeft',   multiplier: 0.9 },
  { holosuit: 'mouthFrownRight',  arkit: 'mouthFrownRight',  multiplier: 0.9 },
  { holosuit: 'jawOpen',          arkit: 'jawOpen',          multiplier: 1.1 },
  { holosuit: 'browRaiseLeft',    arkit: 'browInnerUp',      multiplier: 0.7 },
  { holosuit: 'browRaiseRight',   arkit: 'browInnerUp',      multiplier: 0.7 },
  { holosuit: 'browLowerLeft',    arkit: 'browDownLeft',     multiplier: 0.9 },
  { holosuit: 'browLowerRight',   arkit: 'browDownRight',    multiplier: 0.9 },
  { holosuit: 'noseSneerLeft',    arkit: 'noseSneerLeft',    multiplier: 1.0 },
  { holosuit: 'noseSneerRight',   arkit: 'noseSneerRight',   multiplier: 1.0 },
  { holosuit: 'cheekPuffLeft',    arkit: 'cheekPuff',        multiplier: 0.5 },
  { holosuit: 'cheekPuffRight',   arkit: 'cheekPuff',        multiplier: 0.5 },
];

/**
 * Converts HoloSuit face pose blendshapes to ARKit-compatible values for CC4.
 */
export function mapFaceBlendshapes(facePose: FacePose): BlendshapeValue[] {
  const output: BlendshapeValue[] = [];
  const inputMap = new Map<string, number>(
    facePose.blendshapes.map(b => [b.name, b.value])
  );

  for (const mapping of BLENDSHAPE_MAP) {
    const value = inputMap.get(mapping.holosuit) ?? 0;
    const mapped = Math.min(1, value * mapping.multiplier);
    const existing = output.find(b => b.name === mapping.arkit);
    if (existing) {
      existing.value = Math.max(existing.value, mapped);
    } else {
      output.push({ name: mapping.arkit, value: mapped });
    }
  }

  return output;
}

/**
 * Applies a smoothing filter to prevent jitter (exponential moving average).
 */
export function smoothBlendshapes(
  current: BlendshapeValue[],
  previous: BlendshapeValue[],
  alpha = 0.7
): BlendshapeValue[] {
  const prevMap = new Map<string, number>(previous.map(b => [b.name, b.value]));
  return current.map(b => ({
    name: b.name,
    value: b.value * alpha + (prevMap.get(b.name) ?? 0) * (1 - alpha),
  }));
}
