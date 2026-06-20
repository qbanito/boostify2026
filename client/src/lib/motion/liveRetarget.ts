// ─── Live Link retargeter ──────────────────────────────────────────────────
// Drives a loaded humanoid GLB/FBX skeleton from a stream of MoCap frames —
// the same idea as Rokoko Studio → Unreal Live Link, but fully in the browser.
//
// A MoCap frame carries unit-length WORLD-space direction vectors for each
// tracked bone (in "avatar space": +x right, +y up, +z toward the viewer). The
// retargeter, at bind time, records each bone's rest world orientation + the
// rest direction toward its child joint. Each incoming frame it computes the
// rotation that turns the rest direction into the streamed target direction and
// applies it to the bone (converted into the bone's local space), slerping for
// smoothness. Works on any rig because bones are matched by flexible name
// patterns (Mixamo, Tripo, Ready Player Me, VRM, …) and motion is relative to
// the bind pose, so it never depends on a specific skeleton scale or layout.

import * as THREE from "three";

/** Standard humanoid bones we can drive from a webcam / suit. */
export type HumanBone =
  | "spine"
  | "head"
  | "leftUpperArm"
  | "leftLowerArm"
  | "rightUpperArm"
  | "rightLowerArm"
  | "leftHand"
  | "rightHand"
  | "leftUpperLeg"
  | "leftLowerLeg"
  | "rightUpperLeg"
  | "rightLowerLeg";

export const HUMAN_BONES: HumanBone[] = [
  "spine",
  "head",
  "leftUpperArm",
  "leftLowerArm",
  "rightUpperArm",
  "rightLowerArm",
  "leftHand",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "rightUpperLeg",
  "rightLowerLeg",
];

/** A single motion-capture frame streamed over the gateway. */
export interface MocapFrame {
  /** Unit world-space direction (avatar space) each bone should point along. */
  dirs: Partial<Record<HumanBone, [number, number, number]>>;
  /** Optional body yaw (radians) so the whole avatar can turn with the actor. */
  rootYaw?: number;
  /** Optional mouth-open 0..1 (face capture). */
  mouth?: number;
  /** Optional ARKit-style face blendshape weights (0..1) keyed by name, e.g.
   *  { jawOpen, mouthSmileLeft, eyeBlinkRight, browInnerUp, … }. Drives the
   *  avatar's facial morph targets (and a jaw bone as a fallback). */
  face?: Record<string, number>;
  /** When true, the receiver snapshots this frame as the actor's neutral pose
   *  (T/A-pose calibration) instead of driving the avatar with it. */
  calibrate?: boolean;
  /** Capture-side frame timestamp (ms). */
  t?: number;
}

// Bone-name matchers. The first capturing pattern that matches (and is NOT
// excluded) wins. Ordered roughly specific → generic.
const BONE_PATTERNS: Record<HumanBone, { match: RegExp; exclude?: RegExp }> = {
  spine: { match: /spine_?0?1?$|spine$|chest|^spine\b|mixamorig.*spine/i, exclude: /spine2|spine3|upper/i },
  head: { match: /head$|mixamorig.*head/i, exclude: /headtop|end/i },
  leftUpperArm: { match: /left.*arm$|leftarm$|left_?upperarm|upper_?arm.*l$|l_?upperarm|mixamorig.*leftarm/i, exclude: /fore|lower|hand|roll/i },
  leftLowerArm: { match: /left.*forearm|leftforearm|lower_?arm.*l$|l_?lowerarm|left_?lowerarm|mixamorig.*leftforearm/i, exclude: /hand|roll/i },
  rightUpperArm: { match: /right.*arm$|rightarm$|right_?upperarm|upper_?arm.*r$|r_?upperarm|mixamorig.*rightarm/i, exclude: /fore|lower|hand|roll/i },
  rightLowerArm: { match: /right.*forearm|rightforearm|lower_?arm.*r$|r_?lowerarm|right_?lowerarm|mixamorig.*rightforearm/i, exclude: /hand|roll/i },
  leftHand: { match: /lefthand$|left_?hand$|hand.*l$|l_?hand$|mixamorig.*lefthand$/i, exclude: /thumb|index|middle|ring|pinky|finger|end|roll/i },
  rightHand: { match: /righthand$|right_?hand$|hand.*r$|r_?hand$|mixamorig.*righthand$/i, exclude: /thumb|index|middle|ring|pinky|finger|end|roll/i },
  leftUpperLeg: { match: /left.*upleg|leftupleg|left_?upperleg|upper_?leg.*l$|l_?upleg|l_?thigh|left.*thigh|mixamorig.*leftupleg/i, exclude: /lower|toe|foot|roll/i },
  leftLowerLeg: { match: /left.*leg$|leftleg$|left_?lowerleg|lower_?leg.*l$|l_?calf|left.*calf|left.*shin|mixamorig.*leftleg/i, exclude: /up|toe|foot|roll/i },
  rightUpperLeg: { match: /right.*upleg|rightupleg|right_?upperleg|upper_?leg.*r$|r_?upleg|r_?thigh|right.*thigh|mixamorig.*rightupleg/i, exclude: /lower|toe|foot|roll/i },
  rightLowerLeg: { match: /right.*leg$|rightleg$|right_?lowerleg|lower_?leg.*r$|r_?calf|right.*calf|right.*shin|mixamorig.*rightleg/i, exclude: /up|toe|foot|roll/i },
};

// Apply order: parents before children so a child reads its parent's *current*
// world orientation (which we just set).
//
// NOTE: the SPINE is intentionally NOT driven from a single front-facing webcam.
// Re-orienting the spine rotates the whole upper body (every arm/head child
// inherits it), and BlazePose's torso depth is too noisy to do this cleanly —
// that was the main cause of the avatar "melting". We keep the torso anchored
// and drive the limbs + head, which reads as stable and natural. (Spine is
// still located at bind time and can be re-enabled with proper depth/IK.)
const APPLY_ORDER: HumanBone[] = [
  "head",
  "leftUpperArm",
  "rightUpperArm",
  "leftUpperLeg",
  "rightUpperLeg",
  "leftLowerArm",
  "rightLowerArm",
  "leftHand",
  "rightHand",
  "leftLowerLeg",
  "rightLowerLeg",
];

interface BoundBone {
  bone: THREE.Bone;
  /** Bone's world quaternion captured at bind (rest pose). */
  restWorldQuat: THREE.Quaternion;
  /** Bone's local quaternion captured at bind (rest pose). */
  restLocalQuat: THREE.Quaternion;
  /** World-space unit direction toward the child joint at bind. */
  restDir: THREE.Vector3;
  /** The actor's neutral-pose direction for this bone (calibration). Defaults to
   *  restDir; replaced by `calibrate()` so motion is measured RELATIVE to the
   *  actor's real neutral, removing the constant offset between the avatar's
   *  bind pose and the performer's standing pose. */
  calibDir: THREE.Vector3;
}

// Which child joint defines each bone's "aim" direction.
const CHILD_BONE: Partial<Record<HumanBone, HumanBone>> = {
  spine: "head",
  leftUpperArm: "leftLowerArm",
  rightUpperArm: "rightLowerArm",
  leftUpperLeg: "leftLowerLeg",
  rightUpperLeg: "rightLowerLeg",
};

// Normalize a morph-target / blendshape name for fuzzy matching across rigs
// (RPM/ARKit use "jawOpen"; others use "Jaw_Open", "viseme_aa", …).
function normMorph(n: string): string {
  return n.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// A few cross-rig aliases so one streamed shape can drive differently named
// morphs (jawOpen is by far the most commonly renamed one).
const FACE_ALIASES: Record<string, string[]> = {
  jawopen: ["mouthopen", "aa", "visemeaa", "vaa"],
};

// Maximum rotation (radians) the streamed aim may bend a bone away from its
// rest pose. Caps prevent the mesh from tearing when a noisy / mis-detected
// landmark produces a wild target direction. The torso & head move little; the
// limbs swing wide. (setFromUnitVectors already yields the *shortest* arc, so
// clamping its angle keeps the pose anatomically plausible — no flips.)
const MAX_BEND: Record<HumanBone, number> = {
  spine: 0.45,          // ~26° — subtle torso lean only, never follow the head hard
  head: 0.7,            // ~40°
  leftUpperArm: 2.7,
  rightUpperArm: 2.7,
  leftLowerArm: 2.6,
  rightLowerArm: 2.6,
  leftHand: 1.2,        // ~69° — wrist follow only, kept tight (finger landmarks are noisy)
  rightHand: 1.2,
  leftUpperLeg: 1.9,
  rightUpperLeg: 1.9,
  leftLowerLeg: 2.4,
  rightLowerLeg: 2.4,
};


export class LiveRetargeter {
  private bones = new Map<HumanBone, BoundBone>();
  private root: THREE.Object3D | null = null;
  private bound = false;

  // Face capture targets (discovered at bind time).
  private morphEntries: { influences: number[]; index: number; key: string }[] = [];
  private jawBone: THREE.Bone | null = null;
  private jawRest = new THREE.Quaternion();
  private _jawEuler = new THREE.Euler();
  private _jawDelta = new THREE.Quaternion();
  private faceCapable = false;

  // Scratch objects (avoid per-frame allocation).
  private _tmpA = new THREE.Vector3();
  private _tmpB = new THREE.Vector3();
  private _delta = new THREE.Quaternion();
  private _desired = new THREE.Quaternion();
  private _parentInv = new THREE.Quaternion();
  private _targetLocal = new THREE.Quaternion();
  private _wq = new THREE.Quaternion();
  private _identity = new THREE.Quaternion();

  get isBound(): boolean {
    return this.bound;
  }

  /** True when the bound model has facial morph targets or a jaw bone. */
  get supportsFace(): boolean {
    return this.faceCapable;
  }

  /** Locate the humanoid bones on `root` and snapshot the rest pose. */
  bind(root: THREE.Object3D): boolean {
    this.root = root;
    this.bones.clear();

    // CRITICAL: reset every skinned mesh to its actual bind pose before we
    // snapshot "rest". The model's baked clip is usually playing when bind()
    // first runs, so without this we'd capture a random animated frame as the
    // neutral — and every streamed rotation would then be applied from the
    // wrong base, tearing the mesh. skeleton.pose() applies the inverse bind
    // matrices, restoring the exact pose the skin was painted in.
    root.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh && sm.skeleton) {
        try { sm.skeleton.pose(); } catch { /* ignore */ }
      }
    });

    root.updateWorldMatrix(true, true);

    const found = new Map<HumanBone, THREE.Bone>();
    for (const key of HUMAN_BONES) {
      const { match, exclude } = BONE_PATTERNS[key];
      let best: THREE.Bone | undefined;
      root.traverse((o) => {
        if (best) return;
        const b = o as THREE.Bone;
        if (!b.isBone) return;
        if (exclude && exclude.test(b.name)) return;
        if (match.test(b.name)) best = b;
      });
      if (best) found.set(key, best);
    }

    // Need at least both upper arms OR both upper legs to be useful.
    const hasArms = found.has("leftUpperArm") && found.has("rightUpperArm");
    const hasLegs = found.has("leftUpperLeg") && found.has("rightUpperLeg");
    if (!hasArms && !hasLegs) {
      this.bound = false;
      return false;
    }

    const childWorldPos = new THREE.Vector3();
    const boneWorldPos = new THREE.Vector3();
    for (const [key, bone] of found) {
      const restWorldQuat = bone.getWorldQuaternion(new THREE.Quaternion());
      const restLocalQuat = bone.quaternion.clone();

      // Rest direction = bone → its child joint, in world space.
      const childKey = CHILD_BONE[key];
      let childObj: THREE.Object3D | undefined = childKey ? found.get(childKey) : undefined;
      if (!childObj) {
        // Fall back to the first child Bone in the hierarchy.
        childObj = bone.children.find((c) => (c as THREE.Bone).isBone);
      }
      bone.getWorldPosition(boneWorldPos);
      const restDir = new THREE.Vector3();
      if (childObj) {
        childObj.getWorldPosition(childWorldPos);
        restDir.subVectors(childWorldPos, boneWorldPos);
      }
      if (restDir.lengthSq() < 1e-8) {
        // No child joint to aim at: head points up, limbs hang down.
        restDir.set(0, key === "head" ? 1 : -1, 0);
      }
      restDir.normalize();

      // calibDir starts equal to the avatar's rest aim; `calibrate()` later
      // overwrites it with the performer's measured neutral direction.
      this.bones.set(key, { bone, restWorldQuat, restLocalQuat, restDir, calibDir: restDir.clone() });
    }

    // ── Face capture targets ──────────────────────────────────────────────
    // Collect every morph target (blendshape) on the model and a jaw bone, so
    // streamed ARKit weights can drive the avatar's expression / mouth. Many
    // game-style meshes have neither — face capture then simply no-ops.
    this.morphEntries = [];
    this.jawBone = null;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      const dict = (m as any).morphTargetDictionary as Record<string, number> | undefined;
      const infl = (m as any).morphTargetInfluences as number[] | undefined;
      if (dict && infl) {
        for (const name in dict) {
          this.morphEntries.push({ influences: infl, index: dict[name], key: normMorph(name) });
        }
      }
      if (!this.jawBone) {
        const b = o as THREE.Bone;
        if (b.isBone && /jaw/i.test(b.name) && !/end/i.test(b.name)) {
          this.jawBone = b;
          this.jawRest.copy(b.quaternion);
        }
      }
    });

    this.faceCapable = this.morphEntries.length > 0 || !!this.jawBone;
    // eslint-disable-next-line no-console
    console.info(
      `[LiveRetarget] bound bones=${this.bones.size} morphTargets=${this.morphEntries.length} jawBone=${this.jawBone ? "yes" : "no"} → face ${this.faceCapable ? "ENABLED" : "not supported by this model"}`,
    );

    this.bound = this.bones.size > 0;
    return this.bound;
  }

  /**
   * Snapshot the actor's current pose as the neutral reference. Call this while
   * the performer stands in a relaxed pose (matching how the avatar was built —
   * usually A-pose). Afterwards, motion is measured relative to THIS pose, so a
   * relaxed actor leaves the avatar in its clean bind pose (no drift/offset).
   */
  calibrate(frame: MocapFrame | null | undefined): void {
    if (!this.bound || !frame || !frame.dirs) return;
    for (const [key, bound] of this.bones) {
      const dir = frame.dirs[key];
      if (!dir) continue;
      const v = this._tmpA.set(dir[0], dir[1], dir[2]);
      if (v.lengthSq() < 1e-8) continue;
      bound.calibDir.copy(v).normalize();
    }
  }

  /** Forget any calibration → motion is measured against the avatar's bind pose. */
  clearCalibration(): void {
    for (const bound of this.bones.values()) bound.calibDir.copy(bound.restDir);
  }

  /** Apply a frame. `smoothing` 0..1 = how much to move toward the target this tick. */
  apply(frame: MocapFrame | null | undefined, smoothing = 0.35): void {
    if (!this.bound || !frame || !frame.dirs) return;
    const s = THREE.MathUtils.clamp(smoothing, 0.02, 1);
    // Bones that lost tracking this frame ease back to rest instead of freezing
    // in the last (possibly bad) pose.
    const relaxS = s * 0.4;

    for (const key of APPLY_ORDER) {
      const bound = this.bones.get(key);
      if (!bound) continue;
      const dir = frame.dirs[key];
      if (!dir) {
        bound.bone.quaternion.slerp(bound.restLocalQuat, relaxS);
        bound.bone.updateWorldMatrix(false, false);
        continue;
      }

      const target = this._tmpA.set(dir[0], dir[1], dir[2]);
      if (target.lengthSq() < 1e-8) continue;
      target.normalize();

      // World rotation that turns the rest aim into the streamed aim. This is
      // always the SHORTEST arc, so it never introduces twist around the bone
      // axis — the source of the "melting" mesh. The source is the performer's
      // CALIBRATED neutral direction so the avatar sits clean when you relax.
      this._delta.setFromUnitVectors(this._tmpB.copy(bound.calibDir), target);

      // Clamp the correction angle so a noisy landmark can't tear the mesh.
      const maxBend = MAX_BEND[key];
      // q.w = cos(theta/2); guard the domain before acos.
      const half = Math.acos(THREE.MathUtils.clamp(Math.abs(this._delta.w), -1, 1));
      const angle = 2 * half;
      if (angle > maxBend) {
        // Re-slerp from identity toward the full delta by the allowed fraction.
        this._delta.slerp(this._identity, 1 - maxBend / angle);
      }

      // Desired world orientation for this bone.
      this._desired.copy(this._delta).multiply(bound.restWorldQuat);

      // Convert to local space using the parent's CURRENT world orientation
      // (parents are processed earlier in APPLY_ORDER, so this is up to date).
      const parent = bound.bone.parent;
      if (parent) {
        parent.getWorldQuaternion(this._parentInv).invert();
        this._targetLocal.copy(this._parentInv).multiply(this._desired);
      } else {
        this._targetLocal.copy(this._desired);
      }

      bound.bone.quaternion.slerp(this._targetLocal, s);
      bound.bone.updateWorldMatrix(false, false);
    }

    // Facial expression / mouth.
    this.applyFace(frame.face, s);
  }

  /** Drive morph targets + a jaw bone from ARKit-style blendshape weights. */
  private applyFace(face: Record<string, number> | undefined, smoothing: number): void {
    if (!this.morphEntries.length && !this.jawBone) return;
    const s = THREE.MathUtils.clamp(smoothing, 0.02, 1);

    // Build a normalized weight lookup (with a couple of common aliases). When
    // no face data arrives, every weight is 0 so expressions ease back to rest.
    const weights = new Map<string, number>();
    if (face) {
      for (const name in face) {
        const v = face[name];
        const k = normMorph(name);
        weights.set(k, Math.max(weights.get(k) ?? 0, v));
        const aliases = FACE_ALIASES[k];
        if (aliases) for (const a of aliases) weights.set(a, Math.max(weights.get(a) ?? 0, v));
      }
    }

    // Morph targets: ease each toward its streamed weight (untouched → 0).
    for (const e of this.morphEntries) {
      const target = weights.get(e.key) ?? 0;
      e.influences[e.index] += (target - e.influences[e.index]) * s;
    }

    // Jaw bone fallback (rigs with no mouth blendshape but a jaw joint).
    if (this.jawBone) {
      const open = weights.get("jawopen") ?? 0;
      this._jawEuler.set(open * 0.42, 0, 0); // open downward ~24° max
      this._jawDelta.setFromEuler(this._jawEuler);
      this._wq.copy(this.jawRest).multiply(this._jawDelta);
      this.jawBone.quaternion.slerp(this._wq, s);
    }
  }

  /** Ease every driven bone back toward its rest pose (when live link stops). */
  relax(smoothing = 0.12): void {
    if (!this.bound) return;
    const s = THREE.MathUtils.clamp(smoothing, 0.02, 1);
    for (const bound of this.bones.values()) {
      bound.bone.quaternion.slerp(bound.restLocalQuat, s);
    }
    // Ease the face back to neutral too.
    this.applyFace(undefined, s);
  }

  /** Snap every driven bone exactly back to rest + release references. */
  reset(): void {
    for (const bound of this.bones.values()) {
      bound.bone.quaternion.copy(bound.restLocalQuat);
    }
    for (const e of this.morphEntries) e.influences[e.index] = 0;
    if (this.jawBone) this.jawBone.quaternion.copy(this.jawRest);
    this.morphEntries = [];
    this.jawBone = null;
    this.bones.clear();
    this.root = null;
    this.bound = false;
  }
}
