/* eslint-disable react/no-unknown-property */
/**
 * HologramStageViewer — react-three-fiber 3D stage for artist hologram characters.
 *
 * Capabilities the old <model-viewer> couldn't do:
 *   • Custom GLSL holographic shader (fresnel rim glow, scanlines, flicker)
 *   • Material modes: Solid / Hologram / Wireframe
 *   • Selectable backgrounds/environments + reflective grid floor + particles + fog
 *   • Bloom post-processing for the neon glow
 *   • Plays Mixamo animations from a GLB **or** an FBX (with-skin) directly
 *   • Animation clip selector
 *
 * Loads a Draco-compressed GLB (useGLTF with draco enabled) or an FBX (FBXLoader).
 */
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Grid,
  Bounds,
  useBounds,
  useGLTF,
  useAnimations,
  Sparkles,
  Html,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useLoader } from "@react-three/fiber";
import { FBXLoader, SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { LiveRetargeter, type MocapFrame } from "../../lib/motion/liveRetarget";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MaterialMode = "solid" | "hologram" | "ghost" | "wireframe";

export interface MaterialParams {
  metalness: number;     // 0..1
  roughness: number;     // 0..1
  emissive: number;      // 0..2 emissive intensity
}

export interface AvatarTransform {
  posY: number;       // vertical offset (height on stage)
  rotationY: number;  // manual yaw in radians
  scale: number;      // uniform scale multiplier
}

export const DEFAULT_TRANSFORM: AvatarTransform = { posY: 0, rotationY: 0, scale: 1 };

// Sentinel for the "Off" entry in the Anim selector: stops the baked clip so the
// procedural Motion (Sway/Bounce/Sing) + lip-sync fully drive the avatar instead
// of being overridden by the model's baked root/body animation.
export const NO_CLIP = "__none__";

// ─── Performance / "singing" procedural motion ─────────────────────────────────
// Layered on top of any played clip (or a static model) so the character feels
// alive on stage. Drives the whole avatar group — works regardless of skeleton.

export type PerformanceMode = "off" | "sway" | "bounce" | "sing";

export const PERFORMANCE_MODES: { id: PerformanceMode; label: string }[] = [
  { id: "off", label: "Still" },
  { id: "sway", label: "Sway" },
  { id: "bounce", label: "Bounce" },
  { id: "sing", label: "Sing" },
];

// ─── Captured motion timeline (from an AI singing video) ───────────────────────
// High-level, per-frame performance signals extracted server-side from a video
// of the artist singing. Replayed on the avatar (synced to the song) so the
// motion is the artist's REAL performance style, not just a generic sine wave.

export interface MotionFrame {
  t: number;       // seconds from clip start
  energy: number;  // overall body motion 0..1
  headBob: number; // vertical head motion 0..1
  swayX: number;   // left/right weight shift -1..1
  armLift: number; // arm gesture motion 0..1
  leanX: number;   // forward/back lean -1..1
}

export interface MotionTimeline {
  fps: number;
  duration: number;
  frameCount: number;
  avgEnergy: number;
  frames: MotionFrame[];
}

interface PerfOffsets {
  bobY: number;
  swayX: number;
  leanX: number;
  swayZ: number;
  yaw: number;
  /** Arm gesture amount 0..1 (only set when replaying a captured timeline). */
  armLift?: number;
}

const ZERO_PERF: PerfOffsets = { bobY: 0, swayX: 0, leanX: 0, swayZ: 0, yaw: 0 };

// ─── Live audio levels (drives lip-sync + beat-reactive performance) ───────────
// A mutable ref is shared from the audio analyser into the R3F render loop so the
// avatar reacts to the real song WITHOUT triggering React re-renders every frame.

export interface AudioLevels {
  level: number; // overall loudness 0..1
  low: number;   // bass / kick (beat) 0..1
  mid: number;   // vocals / instruments 0..1 → mouth
  high: number;  // hats / air 0..1
}

const SILENT_AUDIO: AudioLevels = { level: 0, low: 0, mid: 0, high: 0 };

function computePerformance(mode: PerformanceMode, intensity: number, t: number): PerfOffsets {
  const k = intensity;
  switch (mode) {
    case "sway":
      return {
        bobY: 0,
        swayX: Math.sin(t * 1.1) * 0.05 * k,
        leanX: 0,
        swayZ: Math.sin(t * 1.1) * 0.04 * k,
        yaw: Math.sin(t * 0.55) * 0.12 * k,
      };
    case "bounce": {
      const b = Math.abs(Math.sin(t * 2.2));
      return {
        bobY: b * 0.12 * k,
        swayX: Math.sin(t * 1.1) * 0.03 * k,
        leanX: 0,
        swayZ: 0,
        yaw: 0,
      };
    }
    case "sing": {
      // Mix of breathing bob + gentle weight-shift sway + subtle lean → "performing".
      const bob = Math.sin(t * 2.0) * 0.045 * k + Math.sin(t * 4.0) * 0.015 * k;
      return {
        bobY: bob,
        swayX: Math.sin(t * 0.9) * 0.04 * k,
        leanX: Math.sin(t * 1.3) * 0.03 * k,
        swayZ: Math.sin(t * 0.9) * 0.03 * k,
        yaw: Math.sin(t * 0.7) * 0.1 * k,
      };
    }
    default:
      return ZERO_PERF;
  }
}

/**
 * Sample a captured motion timeline at time `t` (seconds), looping over its
 * duration, and convert the high-level signals into the same PerfOffsets the
 * avatar group consumes. `intensity` scales the whole performance (0..~1.6).
 * Linearly interpolates between the two nearest frames for smooth playback.
 */
function sampleMotionTimeline(tl: MotionTimeline, t: number, intensity: number): PerfOffsets {
  const frames = tl.frames;
  const n = frames.length;
  if (n === 0 || tl.duration <= 0) return ZERO_PERF;
  const lt = ((t % tl.duration) + tl.duration) % tl.duration; // wrapped time
  // Frames are evenly spaced at 1/fps; find the bracketing pair.
  const fpos = lt * tl.fps;
  const i0 = Math.min(n - 1, Math.floor(fpos));
  const i1 = Math.min(n - 1, i0 + 1);
  const f = fpos - i0;
  const a = frames[i0];
  const b = frames[i1];
  const lerp = (x: number, y: number) => x + (y - x) * f;
  const energy = lerp(a.energy, b.energy);
  const headBob = lerp(a.headBob, b.headBob);
  const swayX = lerp(a.swayX, b.swayX);
  const armLift = lerp(a.armLift, b.armLift);
  const leanX = lerp(a.leanX, b.leanX);
  const k = intensity;
  // Map captured signals → body offsets (tuned to read as a stage performance).
  return {
    bobY: headBob * 0.11 * k + energy * 0.03 * k,
    swayX: swayX * 0.09 * k,
    leanX: leanX * 0.06 * k,
    swayZ: swayX * 0.05 * k,
    yaw: swayX * 0.18 * k,
    armLift: armLift * k,
  };
}


export interface HologramEnvironment {
  id: string;
  label: string;
  preset: "studio" | "city" | "night" | "warehouse" | "sunset" | "dawn" | "apartment" | "lobby" | "park" | "forest";
  background: string; // canvas/page background gradient
  fog: string | null;
  grid: boolean;
  gridColor: string;
  sparkles: boolean;
  accent: string;
  /** Image-based-lighting intensity that hits the model's PBR materials (0..2). */
  envIntensity?: number;
  /** Render a reflective floor under the avatar. */
  reflectiveFloor?: boolean;
  /**
   * 3D stage rig style — drives volumetric light beams, a performance riser,
   * a back LED halo and starfields so each venue feels like a real live show.
   */
  stageStyle?: "concert" | "club" | "lab" | "void" | "cosmic" | "studio" | "daylight";
  /** Secondary beam/halo color (defaults to gridColor / accent). */
  beamColor?: string;
}

export const HOLOGRAM_ENVIRONMENTS: HologramEnvironment[] = [
  {
    id: "black",
    label: "Black Void",
    preset: "night",
    background: "#000000",
    fog: "#000000",
    grid: false,
    gridColor: "#00f5ff",
    sparkles: false,
    accent: "#00f5ff",
    envIntensity: 0.5,
    stageStyle: "void",
  },
  {
    id: "cyber",
    label: "Cyber Grid",
    preset: "night",
    background: "radial-gradient(circle at 50% 40%, #0a1024 0%, #02030a 70%)",
    fog: "#05070f",
    grid: true,
    gridColor: "#00f5ff",
    sparkles: true,
    accent: "#00f5ff",
    envIntensity: 0.7,
    reflectiveFloor: true,
    stageStyle: "club",
    beamColor: "#19d3ff",
  },
  {
    id: "arena",
    label: "Arena",
    preset: "warehouse",
    background: "radial-gradient(circle at 50% 30%, #1a1030 0%, #06040d 70%)",
    fog: "#0a0618",
    grid: true,
    gridColor: "#a855f7",
    sparkles: true,
    accent: "#a855f7",
    envIntensity: 0.9,
    reflectiveFloor: true,
    stageStyle: "concert",
    beamColor: "#d39bff",
  },
  {
    id: "studio",
    label: "Studio",
    preset: "studio",
    background: "linear-gradient(180deg, #1c1c22 0%, #0a0a0d 100%)",
    fog: null,
    grid: false,
    gridColor: "#888888",
    sparkles: false,
    accent: "#ffffff",
    envIntensity: 1.2,
    stageStyle: "studio",
  },
  {
    id: "sunset",
    label: "Sunset Stage",
    preset: "sunset",
    background: "linear-gradient(180deg, #2a1530 0%, #0d0610 100%)",
    fog: "#1a0e1f",
    grid: true,
    gridColor: "#ff6ad5",
    sparkles: true,
    accent: "#ff6ad5",
    envIntensity: 1.0,
    reflectiveFloor: true,
    stageStyle: "concert",
    beamColor: "#ffa552",
  },
  {
    id: "club",
    label: "Neon Club",
    preset: "night",
    background: "radial-gradient(circle at 50% 55%, #2a0a3a 0%, #07020e 75%)",
    fog: "#120420",
    grid: true,
    gridColor: "#ff2d95",
    sparkles: true,
    accent: "#ff2d95",
    envIntensity: 0.8,
    reflectiveFloor: true,
    stageStyle: "club",
    beamColor: "#7c5cff",
  },
  {
    id: "galaxy",
    label: "Galaxy",
    preset: "night",
    background: "radial-gradient(circle at 50% 35%, #0d0b3a 0%, #020108 75%)",
    fog: "#050418",
    grid: false,
    gridColor: "#7c5cff",
    sparkles: true,
    accent: "#7c5cff",
    envIntensity: 0.6,
    stageStyle: "cosmic",
  },
  {
    id: "lab",
    label: "Holo Lab",
    preset: "lobby",
    background: "radial-gradient(circle at 50% 40%, #04201f 0%, #01080a 75%)",
    fog: "#03100f",
    grid: true,
    gridColor: "#2dffd5",
    sparkles: false,
    accent: "#2dffd5",
    envIntensity: 1.1,
    reflectiveFloor: true,
    stageStyle: "lab",
  },
  {
    id: "daylight",
    label: "Daylight",
    preset: "park",
    background: "linear-gradient(180deg, #2a3650 0%, #0e141f 100%)",
    fog: null,
    grid: false,
    gridColor: "#aaccff",
    sparkles: false,
    accent: "#aaccff",
    envIntensity: 1.4,
    stageStyle: "daylight",
  },
];

// ─── Holographic shader material ──────────────────────────────────────────────

function makeHologramMaterial(colorA: string, colorB: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uOpacity: { value: 1.0 },
      uScan: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uOpacity;
      uniform float uScan;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      void main() {
        float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.2);
        vec3 col = mix(uColorA, uColorB, fres);
        float scan = sin(vWorldPos.y * 90.0 - uTime * 6.0) * 0.5 + 0.5;
        scan = mix(1.0, scan, uScan * 0.6);
        float flicker = 0.92 + 0.08 * sin(uTime * 35.0);
        float alpha = clamp(fres + 0.22, 0.0, 1.0) * uOpacity * scan * flicker;
        col *= (0.55 + fres * 1.6);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/**
 * TEXTURED hologram: clones the model's real PBR material and injects a fresnel
 * rim glow + animated scanlines into the emissive output. The albedo/normal/PBR
 * maps are preserved (the artist's real look) while gaining the holo aesthetic.
 */
function makeTexturedHologram(
  orig: THREE.Material,
  colorA: string,
  colorB: string,
  params: MaterialParams,
): { material: THREE.Material; uniforms: { uTime: { value: number } } } {
  const mat = (orig.clone() as THREE.MeshStandardMaterial);
  const uTime = { value: 0 };

  // Base PBR tuning so the holo glow reads well.
  if ("metalness" in mat) mat.metalness = params.metalness;
  if ("roughness" in mat) mat.roughness = params.roughness;
  mat.transparent = true;
  mat.emissive = new THREE.Color(colorA);
  mat.emissiveIntensity = Math.max(0.15, params.emissive * 0.5);

  const uRimA = { value: new THREE.Color(colorA) };
  const uRimB = { value: new THREE.Color(colorB) };
  const uGlow = { value: Math.max(0.4, params.emissive) };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uRimA = uRimA;
    shader.uniforms.uRimB = uRimB;
    shader.uniforms.uGlow = uGlow;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform float uTime;
         uniform vec3 uRimA;
         uniform vec3 uRimB;
         uniform float uGlow;
         void main() {`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         {
           vec3 vd = normalize(vViewPosition);
           float fres = pow(1.0 - abs(dot(normalize(normal), vd)), 2.5);
           vec3 rim = mix(uRimA, uRimB, fres);
           float scan = sin(vViewPosition.y * 38.0 - uTime * 5.0) * 0.5 + 0.5;
           float flicker = 0.94 + 0.06 * sin(uTime * 30.0);
           totalEmissiveRadiance += rim * (fres * 1.6 * uGlow + scan * 0.08) * flicker;
         }`,
      );
  };
  mat.needsUpdate = true;

  return { material: mat, uniforms: { uTime } };
}

// ─── Model (handles material modes + animations) ──────────────────────────────

interface ModelProps {
  object: THREE.Object3D;
  animations: THREE.AnimationClip[];
  materialMode: MaterialMode;
  activeClip: string | null;
  colorA: string;
  colorB: string;
  params: MaterialParams;
  transform: AvatarTransform;
  envIntensity: number;
  fadeDuration: number;
  performance: PerformanceMode;
  perfIntensity: number;
  /** Captured motion timeline (from an AI singing video) — replayed when set. */
  motionTimeline?: MotionTimeline | null;
  /** Live song playback time (seconds) so motion replay stays synced to audio. */
  songTimeRef?: React.MutableRefObject<number>;
  /** An immersive 360° environment owns the IBL → boost env reflections for realism. */
  immersive?: boolean;
  /** Vertical offset to align avatar + stage to the painted floor of a 360° world. */
  stageY?: number;
  audioLevels?: React.MutableRefObject<AudioLevels>;
  singing?: boolean;
  onClips?: (names: string[]) => void;
  /** Live Link: latest received MoCap frame (applied to the rig each tick). */
  mocapFrameRef?: React.MutableRefObject<MocapFrame | null>;
  /** Whether live mocap is currently driving the avatar. */
  liveActive?: boolean;
  /** Solid mode: keep the model's ORIGINAL authored PBR (no metal/rough/glow
   * override) for a clean realistic look until the user tweaks a slider. */
  preserveOriginalPBR?: boolean;
}

function Model({ object, animations, materialMode, activeClip, colorA, colorB, params, transform, envIntensity, fadeDuration, performance, perfIntensity, motionTimeline, songTimeRef, immersive, stageY = 0, audioLevels, singing, onClips, mocapFrameRef, liveActive = false, preserveOriginalPBR = false }: ModelProps) {
  const group = useRef<THREE.Group>(null);
  // Shader-based materials that need uTime animated each frame.
  const timedMats = useRef<{ uniforms: { uTime: { value: number } } }[]>([]);
  // Every material WE create, so we can dispose them on mode change (avoid GPU leaks).
  const ownedMats = useRef<THREE.Material[]>([]);
  const prevAction = useRef<THREE.AnimationAction | null>(null);

  // Lip-sync target discovered on the loaded model (morph target > jaw bone > head bone).
  const mouthRef = useRef<{
    kind: "morph" | "jaw" | "head" | null;
    mesh?: THREE.Mesh;
    morphIndex?: number;
    bone?: THREE.Object3D;
    restX?: number;
    cur: number;
  }>({ kind: null, cur: 0 });

  // Upper-arm / shoulder bones (if the model is rigged) so captured arm-gesture
  // energy can lift the arms during a performance. restZ holds the bind-pose
  // rotation so motion is applied relatively and is fully reversible.
  const armBonesRef = useRef<{
    left?: { bone: THREE.Object3D; restZ: number };
    right?: { bone: THREE.Object3D; restZ: number };
    cur: number;
  }>({ cur: 0 });

  // Clone so we never mutate the cached loader result.
  // SkeletonUtils.clone properly re-binds skinned meshes (Mixamo FBX/animated GLB),
  // which a plain object.clone(true) does not.
  const scene = useMemo(() => SkeletonUtils.clone(object), [object]);

  // Ground the avatar to the floor + enable real shadow casting (Unreal-style):
  //  • offset the model so its lowest point (feet) sits exactly at y=0, so it
  //    stands ON the stage instead of floating/sinking.
  //  • every mesh casts AND receives shadows so the key light grounds it with a
  //    real contact shadow on the floor and self-shadows the body.
  useEffect(() => {
    scene.position.set(0, 0, 0);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    if (Number.isFinite(box.min.y)) scene.position.y = -box.min.y;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  const { actions, names } = useAnimations(animations, group);

  // Report clip names once.
  useEffect(() => {
    onClips?.(names);
  }, [names, onClips]);

  // Discover a lip-sync target on the model. Preference order:
  //   1) facial morph target (ARKit/VRM viseme: mouthOpen / jawOpen / viseme_aa / aa)
  //   2) a "jaw" bone (rotate to open the mouth)
  //   3) a "head" bone (subtle vocal nod when no real jaw exists)
  useEffect(() => {
    let target: typeof mouthRef.current = { kind: null, cur: 0 };
    const MOUTH_MORPH = /mouth.?open|jaw.?open|viseme.?aa|vrc\.v_aa|^aa$|mouth_a|jawopen/i;

    scene.traverse((o) => {
      if (target.kind === "morph") return;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const dict = mesh.morphTargetDictionary;
        const key = Object.keys(dict).find((k) => MOUTH_MORPH.test(k));
        if (key != null) target = { kind: "morph", mesh, morphIndex: dict[key], cur: 0 };
      }
    });
    if (target.kind == null) {
      scene.traverse((o) => {
        if (target.kind) return;
        if ((o as THREE.Bone).isBone && /jaw/i.test(o.name)) {
          target = { kind: "jaw", bone: o, restX: o.rotation.x, cur: 0 };
        }
      });
    }
    if (target.kind == null) {
      scene.traverse((o) => {
        if (target.kind) return;
        if ((o as THREE.Bone).isBone && /head/i.test(o.name)) {
          target = { kind: "head", bone: o, restX: o.rotation.x, cur: 0 };
        }
      });
    }
    mouthRef.current = target;
  }, [scene]);

  // Discover upper-arm bones for gesture playback. Mixamo/standard rigs name
  // them like "LeftArm"/"RightArm" or "mixamorigLeftArm"; we also accept
  // "shoulder"/"upperarm" variants. Optional — unrigged models simply skip it.
  useEffect(() => {
    let left: { bone: THREE.Object3D; restZ: number } | undefined;
    let right: { bone: THREE.Object3D; restZ: number } | undefined;
    const LEFT_ARM = /(left).*(upperarm|shoulder)|left_?arm$|leftarm|l_?upperarm|mixamorig.*leftarm/i;
    const RIGHT_ARM = /(right).*(upperarm|shoulder)|right_?arm$|rightarm|r_?upperarm|mixamorig.*rightarm/i;
    scene.traverse((o) => {
      if (!(o as THREE.Bone).isBone) return;
      const name = o.name;
      if (!left && LEFT_ARM.test(name) && !/fore/i.test(name)) left = { bone: o, restZ: o.rotation.z };
      else if (!right && RIGHT_ARM.test(name) && !/fore/i.test(name)) right = { bone: o, restZ: o.rotation.z };
    });
    armBonesRef.current = { left, right, cur: 0 };
  }, [scene]);

  // Live Link retargeter — binds to this skeleton so streamed MoCap frames can
  // drive the bones directly (webcam / suit → avatar, Rokoko-style).
  const retargeter = useRef<LiveRetargeter | null>(null);
  if (!retargeter.current) retargeter.current = new LiveRetargeter();
  useEffect(() => {
    retargeter.current?.bind(scene);
    return () => retargeter.current?.reset();
  }, [scene]);

  // While Live Link drives the skeleton, hard-stop every baked action so the
  // animation mixer can't write over the bones the retargeter is controlling
  // (a lingering crossfade fights the stream and warps the mesh). Then RE-BIND
  // so the retargeter snapshots the clean bind pose as "rest" — binding while a
  // clip was still playing would capture an animated frame and tear the mesh.
  useEffect(() => {
    if (!liveActive) return;
    Object.values(actions).forEach((a) => a?.stop());
    prevAction.current = null;
    retargeter.current?.bind(scene);
  }, [liveActive, actions, scene]);

  // Play the active clip with a smooth crossfade from the previous one.
  useEffect(() => {
    const fade = Math.max(0.05, fadeDuration);

    // "Off" → stop the baked clip so procedural Motion/Sing + lip-sync own the body.
    if (activeClip === NO_CLIP) {
      Object.values(actions).forEach((a) => a?.fadeOut(fade));
      if (prevAction.current) {
        prevAction.current.fadeOut(fade);
        prevAction.current = null;
      }
      return;
    }

    const target = activeClip || names[0];
    if (!target || !actions[target]) return;
    const next = actions[target]!;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).fadeIn(fade).play();
    if (prevAction.current && prevAction.current !== next) {
      // Synchronised crossfade keeps limbs aligned while switching clips.
      prevAction.current.crossFadeTo(next, fade, true);
      prevAction.current.fadeOut(fade);
    }
    prevAction.current = next;
    return () => {
      next.fadeOut(Math.min(0.3, fade));
    };
  }, [actions, names, activeClip, fadeDuration]);

  // Apply material mode + live PBR params.
  useEffect(() => {
    // Dispose materials we created on the previous pass.
    for (const m of ownedMats.current) m.dispose();
    ownedMats.current = [];
    timedMats.current = [];

    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      // Stash the original material once (deep clone so live tweaks are reversible).
      if (!mesh.userData.__origMat) {
        const m = mesh.material as THREE.Material | THREE.Material[];
        mesh.userData.__origMat = Array.isArray(m) ? m.map((x) => x.clone()) : m.clone();
      }
      const orig = mesh.userData.__origMat as THREE.Material | THREE.Material[];

      const applyStdParams = (mat: THREE.Material) => {
        const std = mat as THREE.MeshStandardMaterial;
        // Clean default: keep the model's ORIGINAL authored metalness/roughness and
        // kill any emissive glow ("luz que se desprende de la ropa") so the avatar
        // shows its real cloth/skin textures. Only override once the user tweaks a
        // slider (preserveOriginalPBR=false).
        if (preserveOriginalPBR && materialMode === "solid") {
          if ("emissiveIntensity" in std) std.emissiveIntensity = 0;
        } else {
          if ("metalness" in std) std.metalness = params.metalness;
          if ("roughness" in std) std.roughness = params.roughness;
          if ("emissiveIntensity" in std) std.emissiveIntensity = params.emissive;
        }
        // Inside a 360° world the panorama is the only realistic light source, so
        // crank env reflections/IBL response; otherwise honour the user's slider.
        if ("envMapIntensity" in std) std.envMapIntensity = immersive ? Math.max(envIntensity, 1.25) : envIntensity;
        // Crisp textures at grazing angles (boots, faces, fabric weave).
        const sharpen = (tex: THREE.Texture | null) => {
          if (tex) {
            tex.anisotropy = 8;
            tex.needsUpdate = true;
          }
        };
        sharpen(std.map);
        sharpen(std.normalMap);
        sharpen(std.roughnessMap);
        sharpen(std.metalnessMap);
        sharpen(std.emissiveMap);
        std.needsUpdate = true;
      };

      if (materialMode === "solid") {
        // Respect the original textures/PBR, but allow live metalness/rough/emissive.
        const next = Array.isArray(orig) ? orig.map((x) => x.clone()) : orig.clone();
        if (Array.isArray(next)) next.forEach(applyStdParams);
        else applyStdParams(next);
        if (Array.isArray(next)) ownedMats.current.push(...next);
        else ownedMats.current.push(next);
        mesh.material = next;
      } else if (materialMode === "wireframe") {
        const wf = new THREE.MeshBasicMaterial({
          color: new THREE.Color(colorA),
          wireframe: true,
          transparent: true,
          opacity: 0.6,
        });
        ownedMats.current.push(wf);
        mesh.material = wf;
      } else if (materialMode === "hologram") {
        // TEXTURED hologram: keep the albedo/PBR textures but inject a fresnel rim
        // glow + scanlines on top, so the artist's real look is preserved.
        const base = Array.isArray(orig) ? orig[0] : orig;
        const holo = makeTexturedHologram(base, colorA, colorB, params);
        ownedMats.current.push(holo.material);
        timedMats.current.push(holo);
        mesh.material = holo.material;
      } else {
        // GHOST: pure additive fresnel shader (see-through neon, no textures).
        const mat = makeHologramMaterial(colorA, colorB);
        ownedMats.current.push(mat);
        timedMats.current.push(mat as any);
        mesh.material = mat;
      }
    });
  }, [scene, materialMode, colorA, colorB, params.metalness, params.roughness, params.emissive, envIntensity, immersive, preserveOriginalPBR]);

  // Animate all shader-driven materials + procedural performance motion.
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    for (const m of timedMats.current) m.uniforms.uTime.value = t;

    // Live audio → beat-reactive body + mouth. Falls back to a procedural mouth
    // when a song is playing but the analyser is silent (cross-origin / not wired).
    const a = audioLevels?.current ?? SILENT_AUDIO;
    let vocal = a.mid > 0 ? a.mid : a.level;
    if (singing && vocal < 0.02) {
      // Analyser returned silence (tainted audio) → keep the mouth "singing".
      vocal = (Math.sin(t * 7.5) * 0.5 + 0.5) * 0.5 * (0.6 + Math.sin(t * 2.3) * 0.4);
    }
    const beat = singing ? a.low : 0;

    // Smooth the mouth so it doesn't jitter on every FFT frame.
    const m = mouthRef.current;
    const targetOpen = singing ? Math.min(1, vocal * 1.5) : 0;
    m.cur += (targetOpen - m.cur) * Math.min(1, delta * 18);
    if (m.kind === "morph" && m.mesh?.morphTargetInfluences && m.morphIndex != null) {
      m.mesh.morphTargetInfluences[m.morphIndex] = m.cur;
    } else if (m.kind === "jaw" && m.bone) {
      m.bone.rotation.x = (m.restX ?? 0) + m.cur * 0.4;
    } else if (m.kind === "head" && m.bone) {
      // No real jaw → subtle vocal nod so the head still "performs".
      m.bone.rotation.x = (m.restX ?? 0) + m.cur * 0.08;
    }

    const g = group.current;
    if (g) {
      // Audio energy amplifies the procedural performance + adds a beat bounce.
      const eff = perfIntensity * (1 + (singing ? a.level * 1.6 : 0));
      // When a captured motion timeline exists AND we're "performing" (singing),
      // replay the artist's real motion synced to the song; otherwise fall back
      // to the built-in procedural performance modes.
      let p: PerfOffsets;
      if (liveActive) {
        // Live Link owns the body — no procedural sway/bob fighting the stream.
        p = ZERO_PERF;
      } else if (motionTimeline && motionTimeline.frames.length > 1 && singing) {
        // Sync to the song's playback time when available, else the render clock.
        const songT = songTimeRef?.current;
        const playT = songT != null && songT > 0 ? songT : t;
        p = sampleMotionTimeline(motionTimeline, playT, eff);
      } else {
        p = performance === "off" ? ZERO_PERF : computePerformance(performance, eff, t);
      }
      g.position.set(p.swayX, transform.posY + stageY + p.bobY + beat * 0.06, 0);
      g.rotation.set(p.leanX, transform.rotationY + p.yaw, p.swayZ);
      g.scale.setScalar(transform.scale * (1 + beat * 0.015));

      // Arm-gesture playback (only when the rig exposes arm bones + we have a
      // captured armLift signal). Smoothed so gestures ease in/out.
      const arms = armBonesRef.current;
      if (!liveActive && p.armLift != null && (arms.left || arms.right)) {
        arms.cur += (p.armLift - arms.cur) * Math.min(1, delta * 8);
        const lift = arms.cur * 0.6; // radians of outward raise at full energy
        if (arms.left) arms.left.bone.rotation.z = arms.left.restZ + lift;
        if (arms.right) arms.right.bone.rotation.z = arms.right.restZ - lift;
      }
    }

    // ── Live Link: stream-driven skeleton (webcam / mocap suit → avatar) ──
    // Runs LAST so it overrides baked clips + procedural gestures. When the
    // stream stops we ease bones back to the rest pose instead of snapping.
    const rt = retargeter.current;
    if (rt?.isBound) {
      if (liveActive) {
        const frame = mocapFrameRef?.current ?? null;
        // A calibration frame snapshots the actor's neutral pose, then drives.
        if (frame?.calibrate) {
          rt.calibrate(frame);
          frame.calibrate = false; // consume so we only calibrate once
        }
        rt.apply(frame, Math.min(1, delta * 14));
      } else if (mocapFrameRef) {
        // Only relax if we were ever driving (cheap no-op once at rest).
        rt.relax(Math.min(1, delta * 6));
      }
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

// ─── Loaders (GLB via useGLTF+draco, FBX via FBXLoader) ────────────────────────

function GLBModel(props: Omit<ModelProps, "object" | "animations"> & { src: string }) {
  const { src, ...rest } = props;
  const gltf = useGLTF(src, true); // draco enabled
  return <Model object={gltf.scene} animations={gltf.animations} {...rest} />;
}

function FBXModel(props: Omit<ModelProps, "object" | "animations"> & { src: string }) {
  const { src, ...rest } = props;
  const fbx = useLoader(FBXLoader, src);
  return <Model object={fbx} animations={fbx.animations} {...rest} />;
}

// ─── Auto-fit on first load ───────────────────────────────────────────────────

function FitOnLoad({ deps }: { deps: any[] }) {
  const api = useBounds();
  useEffect(() => {
    const id = setTimeout(() => api?.refresh().clip().fit(), 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return null;
}

function Loader({ onTimeout }: { onTimeout?: () => void }) {
  // The model is fetched + Draco-decoded inside Suspense. On flaky mobile
  // networks or when the Draco WASM decoder is slow/blocked (common in prod on
  // iOS Safari), that promise can hang and the fallback would otherwise show
  // "LOADING 3D…" forever. A watchdog surfaces a retry instead of an infinite spin.
  useEffect(() => {
    if (!onTimeout) return;
    const id = window.setTimeout(onTimeout, 25000);
    return () => window.clearTimeout(id);
  }, [onTimeout]);
  return (
    <Html center>
      <div style={{ color: "#00f5ff", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
        LOADING 3D…
      </div>
    </Html>
  );
}

// ─── Stage rig: volumetric light beams, riser, LED halo, starfield ────────────
// A coherent live-show set per environment. Beams + halo pulse with the song's
// beat so the venue performs with the artist. All additive/transparent so bloom
// makes it glow; kept light enough to survive mobile GPUs (skipped on lowPower).

type StageStyle = NonNullable<HologramEnvironment["stageStyle"]>;

interface BeamLayout {
  count: number;   // number of beams
  spread: number;  // radius of the beam ring around the avatar
  len: number;     // beam length (truss → floor)
  radius: number;  // beam cone base radius
  arc: number;     // angular spread (2π = full ring, <2π = fan)
  bias: number;    // push the fan toward the back (−1..0)
  tilt: number;    // inward lean
  truss: number;   // truss height
}

const STAGE_BEAMS: Partial<Record<StageStyle, BeamLayout>> = {
  void:    { count: 1, spread: 0.01, len: 11, radius: 1.6, arc: 0, bias: 0, tilt: 0, truss: 8 },
  concert: { count: 6, spread: 4.4, len: 9.5, radius: 0.95, arc: Math.PI * 1.25, bias: -0.35, tilt: 0.16, truss: 7.2 },
  club:    { count: 8, spread: 4.0, len: 9, radius: 0.7, arc: Math.PI * 2, bias: 0, tilt: 0.22, truss: 7 },
  lab:     { count: 4, spread: 3.6, len: 8.5, radius: 0.6, arc: Math.PI * 1.1, bias: -0.4, tilt: 0.14, truss: 7 },
};

/** Soft radial sprite texture for halos / glows (generated once, no network). */
function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface StageRigProps {
  env: HologramEnvironment;
  audioLevels?: React.MutableRefObject<AudioLevels>;
  singing?: boolean;
  lowPower?: boolean;
  /** Inside a real 360° world: hide the physical riser + back halo (the panorama
      already has its own ground/backdrop) and keep only subtle volumetric light. */
  immersive?: boolean;
}

function StageRig({ env, audioLevels, singing, lowPower = false, immersive = false }: StageRigProps) {
  const style = (env.stageStyle ?? "studio") as StageStyle;
  const accent = env.accent;
  const beamColor = env.beamColor ?? env.gridColor ?? env.accent;

  const trussRef = useRef<THREE.Group>(null);
  const beamMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const beamLights = useRef<(THREE.SpotLight | null)[]>([]);
  const haloMat = useRef<THREE.MeshBasicMaterial | null>(null);
  const rimMat = useRef<THREE.MeshStandardMaterial | null>(null);
  const glowTex = useMemo(makeGlowTexture, []);

  // Beam descriptors (position + orientation + color) computed per style.
  const beams = useMemo(() => {
    // Inside a real 360° world the volumetric beams + their wash spotlights
    // are dropped entirely: the panorama HDRI is the light source, so stage
    // cones would read as fake projected spots fighting the environment.
    if (immersive) return [];
    const layout = STAGE_BEAMS[style];
    if (!layout) return [];
    let count = layout.count;
    if (lowPower) count = Math.min(count, 3); // protect weak GPUs
    const out: { pos: [number, number, number]; quat: [number, number, number, number]; color: THREE.Color; radius: number; len: number }[] = [];
    const palette = [accent, beamColor, "#ffffff"];
    for (let i = 0; i < count; i++) {
      const a =
        count === 1
          ? 0
          : layout.arc >= Math.PI * 2
            ? (i / count) * Math.PI * 2
            : -layout.arc / 2 + (i / (count - 1)) * layout.arc;
      const x = Math.sin(a) * layout.spread;
      const z = Math.cos(a) * layout.spread * (1 + layout.bias) + layout.bias * 1.5;
      // Tilt the beam inward about the tangent axis so the pool lands near center.
      const tangent = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(tangent, layout.tilt);
      out.push({
        pos: [x, layout.truss, z],
        quat: [q.x, q.y, q.z, q.w],
        color: new THREE.Color(palette[i % palette.length]),
        radius: layout.radius,
        len: layout.len,
      });
    }
    return out;
  }, [style, accent, beamColor, lowPower, immersive]);

  const hasPlatform = !immersive && (style === "concert" || style === "club" || style === "lab" || style === "void");
  const hasHalo = !immersive && (style === "concert" || style === "club" || style === "lab");
  const isCosmic = style === "cosmic";

  // Audio-reactive pulsing of beams, lights, halo + slow truss sweep.
  useFrame((state, delta) => {
    const a = audioLevels?.current ?? SILENT_AUDIO;
    const beat = singing ? a.low : 0;
    const energy = singing ? a.level : 0;
    const t = state.clock.elapsedTime;

    if (trussRef.current) {
      // Gentle continuous sweep, livelier while the song plays.
      trussRef.current.rotation.y += delta * (0.06 + energy * 0.25);
    }
    beamMats.current.forEach((m, i) => {
      if (!m) return;
      const flick = 0.5 + Math.sin(t * 3 + i * 1.7) * 0.12;
      m.opacity = Math.min(0.5, (0.1 + flick * 0.1) * (1 + beat * 1.6));
    });
    beamLights.current.forEach((l, i) => {
      if (!l) return;
      const flick = 0.6 + Math.sin(t * 2.4 + i * 2.1) * 0.2;
      l.intensity = (lowPower ? 1.2 : 2.2) * flick * (1 + beat * 1.8);
    });
    if (haloMat.current) haloMat.current.opacity = 0.35 + beat * 0.5 + Math.sin(t * 1.5) * 0.05;
    if (rimMat.current) rimMat.current.emissiveIntensity = 1.4 + beat * 2.4;
  });

  return (
    <group>
      {/* ── Volumetric beams + their wash spotlights (on a rotating truss) ── */}
      {beams.length > 0 && (
        <group ref={trussRef}>
          {beams.map((b, i) => (
            <group key={i} position={b.pos} quaternion={b.quat}>
              {/* Glowing cone (wide at the floor, narrow at the truss). */}
              <mesh position={[0, -b.len / 2, 0]} renderOrder={2}>
                <coneGeometry args={[b.radius, b.len, 28, 1, true]} />
                <meshBasicMaterial
                  ref={(m) => m && (beamMats.current[i] = m)}
                  color={b.color}
                  transparent
                  opacity={0.16}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                />
              </mesh>
              {/* Source flare at the truss. */}
              <sprite position={[0, 0, 0]} scale={[b.radius * 1.4, b.radius * 1.4, 1]}>
                <spriteMaterial map={glowTex} color={b.color} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
              </sprite>
            </group>
          ))}
        </group>
      )}

      {/* ── Performance riser under the avatar ── */}
      {hasPlatform && (
        <group position={[0, 0, 0]}>
          <mesh position={[0, -0.12, 0]} receiveShadow>
            <cylinderGeometry args={[2.2, 2.45, 0.24, 64]} />
            <meshStandardMaterial color={0x0b0b12} metalness={0.7} roughness={0.4} envMapIntensity={0.6} />
          </mesh>
          {/* Emissive rim ring (bloom turns it into an LED edge). */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.25, 0.05, 16, 96]} />
            <meshStandardMaterial
              ref={(m) => (rimMat.current = m)}
              color={accent}
              emissive={accent}
              emissiveIntensity={1.6}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}

      {/* ── Back LED halo (vertical glowing ring behind the artist) ── */}
      {hasHalo && (
        <mesh position={[0, 2.6, -3.2]} renderOrder={-1}>
          <ringGeometry args={[2.4, 3.4, 80]} />
          <meshBasicMaterial
            ref={(m) => (haloMat.current = m)}
            color={beamColor}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* ── Cosmic starfield: dense far stars + a soft nebula glow ── */}
      {isCosmic && (
        <>
          {!lowPower && (
            <Sparkles count={220} scale={[26, 18, 26]} size={2} speed={0.12} color="#ffffff" opacity={0.9} />
          )}
          <Sparkles count={90} scale={[14, 10, 14]} size={5} speed={0.2} color={accent} opacity={0.7} />
          <sprite position={[0, 3, -6]} scale={[18, 12, 1]}>
            <spriteMaterial map={glowTex} color={accent} transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </>
      )}
    </group>
  );
}

// ─── Immersive depth world ──────────────────────────────────────────────────
// Converts an equirectangular panorama + its depth map into a REAL 3D mesh
// (not just an HDRI skybox): the depth is sampled on the CPU and used to
// displace the vertices of a high-subdivision sphere along their normals,
// reconstructing the scene's geometry — ground, walls, structures — as an
// actual model. Because the geometry lives on the CPU it is ray-castable, so
// the avatar can be anchored to the reconstructed floor.
function DepthStageMesh({
  colorUrl,
  depthUrl,
  lowPower = false,
  meshRef,
  displaceScale = 16,
  onReady,
}: {
  colorUrl: string;
  depthUrl: string;
  lowPower?: boolean;
  meshRef?: React.MutableRefObject<THREE.Mesh | null>;
  displaceScale?: number;
  onReady?: () => void;
}) {
  const colorTex = useLoader(THREE.TextureLoader, colorUrl);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const BASE_R = 34;

  // Build the displaced (reconstructed) geometry from the depth map on the CPU.
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const w = 320;
      const h = 160;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const seg = lowPower ? 110 : 200;
      const geo = new THREE.SphereGeometry(BASE_R, seg, Math.floor(seg / 2));
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i);
        const vv = uv.getY(i);
        // Mirror U to match the BackSide-rendered (mirrored) panorama texture.
        const px = Math.min(w - 1, Math.max(0, Math.floor((1 - u) * (w - 1))));
        const py = Math.min(h - 1, Math.max(0, Math.floor((1 - vv) * (h - 1))));
        const lum =
          (0.299 * data[(py * w + px) * 4] +
            0.587 * data[(py * w + px) * 4 + 1] +
            0.114 * data[(py * w + px) * 4 + 2]) /
          255; // bright = near
        v.fromBufferAttribute(pos, i).normalize();
        // Pull near (bright) regions inward toward the viewer → real relief.
        const r = BASE_R - lum * displaceScale;
        pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      if (!cancelled) {
        setGeometry(geo);
        onReady?.();
      }
    };
    img.onerror = () => {};
    img.src = depthUrl;
    return () => {
      cancelled = true;
    };
  }, [depthUrl, lowPower, displaceScale]);

  const material = useMemo(() => {
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.wrapS = THREE.RepeatWrapping;
    colorTex.repeat.x = -1; // mirror so the panorama reads correctly from inside
    return new THREE.MeshStandardMaterial({
      map: colorTex,
      emissive: 0xffffff,
      emissiveMap: colorTex,
      emissiveIntensity: 0.8,
      roughness: 1,
      metalness: 0,
      side: THREE.BackSide,
      toneMapped: true,
    });
  }, [colorTex]);

  useEffect(
    () => () => {
      material.dispose();
      geometry?.dispose();
    },
    [material, geometry],
  );

  if (!geometry) return null;
  return <mesh ref={meshRef as any} geometry={geometry} material={material} />;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

interface SceneProps {
  src: string;
  format: "glb" | "fbx";
  env: HologramEnvironment;
  materialMode: MaterialMode;
  activeClip: string | null;
  autoRotate: boolean;
  bloom: boolean;
  exposure: number;
  params: MaterialParams;
  transform: AvatarTransform;
  envIntensity: number;
  fadeDuration: number;
  performance: PerformanceMode;
  perfIntensity: number;
  /** Captured motion timeline (from an AI singing video) — replayed when set. */
  motionTimeline?: MotionTimeline | null;
  /** Live song playback time (seconds) so motion replay stays synced to audio. */
  songTimeRef?: React.MutableRefObject<number>;
  backdropUrl: string | null;
  environmentUrl?: string | null;
  environmentDepthUrl?: string | null;
  /** Floor alignment for immersive worlds: vertical offset + riser toggle/size. */
  stageY?: number;
  showRiser?: boolean;
  riserScale?: number;
  colorA: string;
  colorB: string;
  audioLevels?: React.MutableRefObject<AudioLevels>;
  singing?: boolean;
  /** Mobile / weak GPU: drop the heaviest effects so the WebGL context survives. */
  lowPower?: boolean;
  onClips: (names: string[]) => void;
  /** Fired when the model takes too long to load/decode (watchdog timeout). */
  onModelTimeout?: () => void;
  /** Live Link: latest received MoCap frame + whether it's driving the avatar. */
  mocapFrameRef?: React.MutableRefObject<MocapFrame | null>;
  liveActive?: boolean;
  /** Solid mode: keep the original authored PBR (clean look) until user tweaks. */
  preserveOriginalPBR?: boolean;
}

function Scene({
  src,
  format,
  env,
  materialMode,
  activeClip,
  autoRotate,
  bloom,
  exposure,
  params,
  transform,
  envIntensity,
  fadeDuration,
  performance,
  perfIntensity,
  motionTimeline,
  songTimeRef,
  backdropUrl,
  environmentUrl,
  environmentDepthUrl,
  stageY = 0,
  showRiser = true,
  riserScale = 1,
  colorA,
  colorB,
  audioLevels,
  singing,
  lowPower = false,
  onClips,
  onModelTimeout,
  mocapFrameRef,
  liveActive = false,
  preserveOriginalPBR = false,
}: SceneProps) {
  const { scene: threeScene, gl } = useThree();
  const immersive = !!environmentUrl;
  // When a depth map exists we build a real parallax world from a displaced
  // inverted sphere instead of a flat (infinite-distance) skybox.
  const hasDepthWorld = immersive && !!environmentDepthUrl;
  // The reconstructed stage mesh — shared so the avatar can ray-cast onto it.
  const worldMeshRef = useRef<THREE.Mesh | null>(null);

  // Coherent environment lighting (Unreal-style): sample the panorama's real
  // colors so the avatar's fill/key lights match the world — warm under a
  // sunset, magenta in a neon club, cool blue in deep space. We read a tiny
  // downscaled copy: top band = sky/key tone, bottom band = bounce/ground tone.
  const [envTint, setEnvTint] = useState<{ sky: string; ground: string; lum: number } | null>(null);
  useEffect(() => {
    if (!environmentUrl) {
      setEnvTint(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 16;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 32, 16);
        const avg = (data: Uint8ClampedArray) => {
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
          }
          return [r / n, g / n, b / n] as const;
        };
        const [sr, sg, sb] = avg(ctx.getImageData(0, 0, 32, 8).data);
        const [gr, gg, gb] = avg(ctx.getImageData(0, 8, 32, 8).data);
        const lum = (0.299 * sr + 0.587 * sg + 0.114 * sb) / 255;
        setEnvTint({
          sky: `rgb(${sr | 0},${sg | 0},${sb | 0})`,
          ground: `rgb(${gr | 0},${gg | 0},${gb | 0})`,
          lum,
        });
      } catch {
        setEnvTint(null);
      }
    };
    img.onerror = () => !cancelled && setEnvTint(null);
    img.src = environmentUrl;
    return () => {
      cancelled = true;
    };
  }, [environmentUrl]);

  useEffect(() => {
    threeScene.fog = env.fog ? new THREE.FogExp2(new THREE.Color(env.fog).getHex(), 0.06) : null;
  }, [threeScene, env.fog]);

  // ── Immersive 360° environment: AI panorama → equirectangular skybox + IBL ──
  // This is the "image becomes a real 3D world" step: the panorama wraps the
  // whole scene AND lights/reflects on the avatar via scene.environment.
  useEffect(() => {
    let cancelled = false;
    if (!environmentUrl) {
      if (threeScene.environment instanceof THREE.Texture) threeScene.environment.dispose();
      threeScene.environment = null;
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      environmentUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        const oldBg = threeScene.background;
        const oldEnv = threeScene.environment;
        // Always use the panorama for image-based lighting/reflections.
        // Skybox background only when there's NO depth world (the displaced
        // sphere becomes the visible world otherwise).
        threeScene.background = hasDepthWorld ? null : tex;
        threeScene.environment = tex;
        if (oldBg instanceof THREE.Texture && oldBg !== tex) oldBg.dispose();
        if (oldEnv instanceof THREE.Texture && oldEnv !== tex) oldEnv.dispose();
      },
      undefined,
      () => {
        if (!cancelled) {
          threeScene.background = null;
          threeScene.environment = null;
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [threeScene, environmentUrl, hasDepthWorld]);

  // Load the chosen generated scene image as a full-screen 3D backdrop.
  // Skipped while an immersive 360° environment owns scene.background.
  useEffect(() => {
    let cancelled = false;
    const prev = threeScene.background;
    if (immersive) return;
    if (!backdropUrl) {
      threeScene.background = null;
      if (prev instanceof THREE.Texture) prev.dispose();
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      backdropUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        const old = threeScene.background;
        threeScene.background = tex;
        if (old instanceof THREE.Texture) old.dispose();
      },
      undefined,
      () => {
        if (!cancelled) threeScene.background = null;
      },
    );
    return () => {
      cancelled = true;
    };
  }, [threeScene, backdropUrl, immersive]);


  // Color-correct rendering so textures keep their real tones under bloom.
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = exposure;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl, exposure]);

  const ModelCmp = format === "fbx" ? FBXModel : GLBModel;

  return (
    <>
      {immersive ? (
        <>
          {/* Environment-driven lighting only: the panorama HDRI provides the
              image-based illumination (IBL) and the soft ambient/hemi fills take
              its real sky/ground tones. NO hard spotlights — the light reads as
              the world's own incidence instead of stage cones on the floor. */}
          <ambientLight intensity={0.42 + (envTint?.lum ?? 0.45) * 0.3} color={envTint?.sky ?? "#ffffff"} />
          <hemisphereLight
            args={[
              new THREE.Color(envTint?.sky ?? "#ffffff").getHex(),
              new THREE.Color(envTint?.ground ?? "#202840").getHex(),
              0.9,
            ]}
          />
          {/* Soft directional KEY tinted by the sky — a wide, penumbra-free
              wash that gives the body shape + a grounded contact shadow WITHOUT
              the visible circular cone a spotlight projects. */}
          <directionalLight
            position={[-2.5, 6, 3]}
            intensity={0.7 + (envTint?.lum ?? 0.5) * 0.8}
            color={envTint?.sky ?? "#ffffff"}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.022}
            shadow-radius={6}
            shadow-camera-near={0.5}
            shadow-camera-far={32}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
          />
          {/* Soft opposite fill picks up the ground bounce color so shadows aren't black. */}
          <directionalLight position={[3, 3.5, -2.5]} intensity={0.4} color={envTint?.ground ?? env.accent} />
        </>
      ) : (
        <>
          {/* Incidence-based studio lighting (no hard spotlight cones): a soft
              ambient + sky/ground hemisphere fill + two wide penumbra-free
              directional washes tinted by the stage palette. Reads as natural
              light incidence on the avatar instead of projected stage spots. */}
          <ambientLight intensity={0.5} color={colorA} />
          <hemisphereLight
            args={[new THREE.Color(colorA).getHex(), new THREE.Color(env.accent).getHex(), 0.85]}
          />
          {/* Soft KEY wash (gives body + a grounded contact shadow, no cone). */}
          <directionalLight
            position={[-3, 6, 4]}
            intensity={1.1}
            color={colorA}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.022}
            shadow-radius={6}
            shadow-camera-near={0.5}
            shadow-camera-far={32}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
          />
          {/* Opposite fill so shadows aren't black. */}
          <directionalLight position={[3.5, 3.5, -2.5]} intensity={0.55} color={colorB} />
        </>
      )}

      {/* Live-show stage rig: volumetric beams, riser, LED halo, starfield.
          Inside a real 360° world the riser + halo are hidden and beams thinned
          out so the rig complements the panorama instead of fighting it. */}
      <StageRig env={env} audioLevels={audioLevels} singing={singing} lowPower={lowPower || immersive} immersive={immersive} />

      {/* Real 3D stage model: the panorama + depth are reconstructed into an
          actual ray-castable mesh (ground, structures) — not just an HDRI
          skybox — so the avatar can be anchored to the reconstructed floor. */}
      {hasDepthWorld && environmentUrl && environmentDepthUrl && (
        <SilentBoundary>
          <Suspense fallback={null}>
            <DepthStageMesh
              colorUrl={environmentUrl}
              depthUrl={environmentDepthUrl}
              lowPower={lowPower}
              meshRef={worldMeshRef}
            />
          </Suspense>
        </SilentBoundary>
      )}

      {/* Remote-CDN HDR — isolated so a failed fetch can't crash the avatar.
          Skipped when an immersive 360° environment provides the IBL itself. */}
      {!immersive && (
        <SilentBoundary>
          <Suspense fallback={null}>
            <Environment preset={env.preset} />
          </Suspense>
        </SilentBoundary>
      )}

      <Suspense fallback={<Loader onTimeout={onModelTimeout} />}>
        <Bounds fit clip observe margin={1.15}>
          <ModelCmp
            src={src}
            materialMode={materialMode}
            activeClip={activeClip}
            colorA={colorA}
            colorB={colorB}
            params={params}
            transform={transform}
            envIntensity={envIntensity}
            fadeDuration={fadeDuration}
            performance={performance}
            perfIntensity={perfIntensity}
            motionTimeline={motionTimeline}
            songTimeRef={songTimeRef}
            immersive={immersive}
            stageY={stageY}
            audioLevels={audioLevels}
            singing={singing}
            onClips={onClips}
            mocapFrameRef={mocapFrameRef}
            liveActive={liveActive}
            preserveOriginalPBR={preserveOriginalPBR}
          />
          <FitOnLoad deps={[src, format]} />
        </Bounds>
      </Suspense>

      {/* Flat reflective floor + grid break the 360° illusion, so they're hidden
          while an immersive world (which has its own ground) is active. */}
      {!immersive && env.reflectiveFloor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow renderOrder={0}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial
            color={env.fog ? new THREE.Color(env.fog).getHex() : 0x05070f}
            metalness={0.85}
            roughness={0.35}
            envMapIntensity={envIntensity}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      )}

      {!immersive && env.grid && (
        <Grid
          position={[0, 0.0, 0]}
          args={[30, 30]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor={env.gridColor}
          sectionSize={2.5}
          sectionThickness={1.2}
          sectionColor={env.gridColor}
          fadeDistance={26}
          fadeStrength={1.5}
          infiniteGrid
        />
      )}

      {/* Real shadow-catcher floor: a transparent plane that only renders where
          the key light's shadow falls, so the avatar drops a true grounded
          shadow on the stage (Unreal-style contact), without a visible slab. */}
      {immersive && !lowPower && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001 + stageY, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial transparent opacity={0.5} />
        </mesh>
      )}

      {/* Polished circular stage riser: gives the avatar a real surface to stand
          on inside the panorama (so it doesn't float over the crowd), and its
          glossy top reflects the world for a coherent, grounded look. Use the
          "Floor" slider to drop it onto the painted stage of each world, or the
          "Riser" toggle to hide it when a world's own floor already aligns. */}
      {immersive && showRiser && (
        <group position={[0, -0.06 + stageY, 0]} scale={[riserScale, 1, riserScale]}>
          <mesh receiveShadow>
            <cylinderGeometry args={[2.6, 2.75, 0.12, 64]} />
            <meshStandardMaterial
              color={"#0a0c14"}
              metalness={0.85}
              roughness={0.28}
              envMapIntensity={Math.max(envIntensity, 1.4)}
            />
          </mesh>
          {/* Subtle emissive rim so the stage edge catches the eye. */}
          <mesh position={[0, 0.061, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.5, 2.62, 64]} />
            <meshBasicMaterial color={envTint?.sky ?? env.accent} transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* Neutral, soft contact shadow anchors the avatar to the ground in any world. */}
      <ContactShadows
        position={[0, stageY, 0]}
        opacity={immersive ? 0.65 : 0.5}
        scale={immersive ? 9 : 12}
        blur={immersive ? 2.8 : 2.4}
        far={5}
        color={immersive ? "#000000" : env.accent}
      />

      {env.sparkles && !lowPower && (
        <Sparkles count={60} scale={[8, 6, 8]} size={3} speed={0.3} color={env.accent} opacity={0.5} />
      )}

      <OrbitControls
        makeDefault
        autoRotate={autoRotate}
        autoRotateSpeed={1.2}
        enablePan={false}
        minDistance={1.5}
        maxDistance={14}
        maxPolarAngle={Math.PI / 1.8}
      />

      {bloom && (
        <EffectComposer multisampling={lowPower ? 0 : 8}>
          <Bloom
            intensity={materialMode === "ghost" ? 1.2 : materialMode === "hologram" ? 0.9 : 0.5}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur={!lowPower}
          />
          <Vignette eskil={false} offset={0.2} darkness={0.7} />
        </EffectComposer>
      )}
    </>
  );
}

// ─── Error boundary (catches GLB/FBX load failures) ───────────────────────────

class ViewerErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[HologramStageViewer] model load/render error:", err);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/** Shared failure UI (load error OR watchdog timeout): poster + retry. */
function FailOverlay({ poster, onRetry }: { poster?: string; onRetry?: () => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", textAlign: "center", padding: 20, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}>
      {poster && <img src={poster} alt="" style={{ maxHeight: "55%", borderRadius: 12, opacity: 0.55 }} />}
      <p style={{ fontSize: 13, fontWeight: 700 }}>Couldn&apos;t load the 3D model</p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>Check your connection and try again.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{ marginTop: 4, padding: "8px 18px", borderRadius: 999, fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: "#001016", background: "#00f5ff", border: "none", cursor: "pointer", boxShadow: "0 0 18px rgba(0,245,255,0.4)" }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Silent boundary for non-critical scene extras (e.g. the drei <Environment>
 * HDR, which is fetched from a remote CDN). If that fetch fails — common on
 * mobile networks or when a CSP/CDN blocks the asset — we must NOT let it crash
 * the whole Canvas. On failure we render the optional fallback (default null)
 * so the avatar keeps rendering with the manual lights.
 */
class SilentBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[HologramStageViewer] optional scene asset failed (ignored):", err);
  }
  render() {
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children;
  }
}

// ─── Public viewer ────────────────────────────────────────────────────────────

/** Reactive viewport check so the control bar can adapt to phones/tablets. */
function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

/**
 * Web-Audio analyser for the artist's song. Exposes a mutable `levels` ref the
 * R3F loop reads each frame (no re-renders), plus play/pause + load-local-file.
 * The audio graph is built lazily on the first user gesture (autoplay policy).
 */
function useSongAnalyser() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const levels = useRef<AudioLevels>({ ...SILENT_AUDIO });
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  const ensureGraph = React.useCallback(() => {
    const el = audioRef.current;
    if (!el || ctxRef.current) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const srcNode = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.82;
      srcNode.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    } catch {
      /* createMediaElementSource throws if called twice — ignore */
    }
  }, []);

  // Continuous analysis loop → fills the levels ref.
  useEffect(() => {
    const loop = () => {
      const analyser = analyserRef.current;
      const data = dataRef.current;
      if (analyser && data) {
        analyser.getByteFrequencyData(data as any);
        const n = data.length;
        const band = (a: number, b: number) => {
          let s = 0;
          for (let i = a; i < b; i++) s += data[i];
          return s / (b - a) / 255;
        };
        const low = band(0, Math.max(1, Math.floor(n * 0.08)));
        const mid = band(Math.floor(n * 0.08), Math.floor(n * 0.4));
        const high = band(Math.floor(n * 0.4), n);
        const level = Math.min(1, low * 0.55 + mid * 0.95 + high * 0.5);
        levels.current = { level, low, mid, high };
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const toggle = React.useCallback(async () => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    ensureGraph();
    if (ctxRef.current?.state === "suspended") await ctxRef.current.resume();
    if (el.paused) {
      try {
        await el.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [ensureGraph]);

  const loadFile = React.useCallback((file: File) => {
    const el = audioRef.current;
    if (!el) return;
    if (el.src?.startsWith("blob:")) URL.revokeObjectURL(el.src);
    el.src = URL.createObjectURL(file);
    el.crossOrigin = "anonymous";
    setReady(true);
  }, []);

  return { audioRef, levels, playing, ready, setReady, setPlaying, toggle, loadFile };
}

export interface HologramStageViewerProps {
  src: string;                // GLB or FBX url (animated takes priority if provided)
  format?: "glb" | "fbx";
  className?: string;
  style?: React.CSSProperties;
  /** Hide the built-in control bar (when the parent renders its own). */
  hideControls?: boolean;
  /** Compact mode: only tiny essential controls (for small preview boxes / mobile). */
  compact?: boolean;
  colorA?: string;
  colorB?: string;
  /** Poster image shown while the model loads (e.g. the A-pose source image). */
  poster?: string;
  /** Generated showcase scene images usable as a 3D stage backdrop. */
  backgrounds?: string[];
  /** Generated 360° equirectangular panoramas → immersive 3D worlds (skybox + IBL). */
  environments?: { url: string; label?: string; depthUrl?: string | null }[];
  /** Artist song URL — when set, the avatar lip-syncs & dances to the real track. */
  audioSrc?: string;
  /** Display name for the loaded song. */
  songTitle?: string;
  /** Captured singing-motion timeline (from the AI performance video). When set
   *  and a song is playing, the avatar replays the artist's real motion. */
  motionTimeline?: MotionTimeline | null;
  /** Force the captured motion timeline to play immediately, without needing the
   *  song to be playing (used for previewing a performance as an animation). */
  autoplayMotion?: boolean;
  /** Live Link: when set, the viewer connects to `/ws/holostage` in this room
   *  (artistId) and drives the avatar from streamed MoCap frames (webcam/suit). */
  liveLinkRoom?: string | number;
}

export default function HologramStageViewer({
  src,
  format = "glb",
  className,
  style,
  hideControls = false,
  compact = false,
  colorA = "#00f5ff",
  colorB = "#a855f7",
  poster,
  backgrounds = [],
  environments = [],
  audioSrc,
  songTitle,
  motionTimeline,
  autoplayMotion = false,
  liveLinkRoom,
}: HologramStageViewerProps) {
  const [envId, setEnvId] = useState<string>("studio");
  const [materialMode, setMaterialMode] = useState<MaterialMode>("solid");
  const [autoRotate, setAutoRotate] = useState(false);
  const [bloom] = useState(true);
  const [exposure, setExposure] = useState(1.1);
  const [params, setParams] = useState<MaterialParams>({ metalness: 0.2, roughness: 0.7, emissive: 0 });
  // Until the user tweaks a Metal/Rough/Glow slider, solid mode keeps the model's
  // ORIGINAL authored PBR so the default avatar looks clean + realistic (no glow).
  const [paramsTouched, setParamsTouched] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clips, setClips] = useState<string[]>([]);
  // Default to NO baked clip so the avatar stands still + centered on load
  // (an auto-played clip made it jitter / "dar saltitos"). The user can pick a
  // clip or a Motion mode from the controls.
  const [activeClip, setActiveClip] = useState<string | null>(NO_CLIP);
  const [transform, setTransform] = useState<AvatarTransform>(DEFAULT_TRANSFORM);
  const [envIntensity, setEnvIntensity] = useState(0.7);
  const [fadeDuration, setFadeDuration] = useState(0.4);
  const [performance, setPerformance] = useState<PerformanceMode>("off");
  const [perfIntensity, setPerfIntensity] = useState(0.8);
  const [backdropIdx, setBackdropIdx] = useState<number>(-1); // -1 = none
  const [worldIdx, setWorldIdx] = useState<number>(-1); // -1 = procedural rig (no immersive env)
  // Floor alignment for immersive worlds: drop the avatar + stage riser onto the
  // painted stage of each panorama (its floor height varies per image).
  const [stageY, setStageY] = useState(0);
  const [showRiser, setShowRiser] = useState(true);
  const [riserScale, setRiserScale] = useState(1);

  // Model-load failure handling: a thrown decode error (ErrorBoundary) OR a
  // watchdog timeout both surface a poster + Retry instead of an endless spinner.
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    setLoadFailed(false);
  }, [src, retryKey]);
  const retryLoad = React.useCallback(() => {
    // Drop the cached (failed) GLTF so the remount re-fetches + re-decodes.
    try {
      (useGLTF as unknown as { clear?: (u: string) => void }).clear?.(src);
    } catch {
      /* ignore */
    }
    setRetryKey((k) => k + 1);
  }, [src]);

  const isMobile = useIsMobile();
  const { audioRef, levels, playing, ready, setReady, toggle, loadFile } = useSongAnalyser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Mobile sizing fix ─────────────────────────────────────────────────────
  // R3F's internal ResizeObserver can miss the initial size of a container that
  // derives its height from `aspect-ratio` (very common on phones) — the
  // <canvas> then sticks at its default 300×150 and the avatar appears blank /
  // tiny. We observe the container ourselves and nudge R3F to re-measure
  // whenever the box actually changes size.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last = -1;
    const ro = new ResizeObserver(() => {
      const sig = el.clientWidth * 100000 + el.clientHeight;
      if (sig === last) return;
      last = sig;
      // R3F listens to window 'resize' and recomputes the canvas size from its
      // parent — this corrects the stuck 300×150 canvas without a feedback loop
      // (dispatching resize does not change the container's own box).
      window.dispatchEvent(new Event("resize"));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Live Link receiver ──────────────────────────────────────────────────
  // When a room is provided, open a read-only socket to the HoloStage gateway
  // and store the latest MoCap frame; the Model applies it to the rig each tick.
  const mocapFrameRef = useRef<MocapFrame | null>(null);
  const [liveActive, setLiveActive] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  useEffect(() => {
    if (liveLinkRoom == null || typeof window === "undefined") return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const params = new URLSearchParams({ role: "operator", artistId: String(liveLinkRoom), showId: "livelink", label: "stage-viewer" });
    const url = `${proto}://${window.location.host}/ws/holostage?${params.toString()}`;
    let ws: WebSocket | null = null;
    let closed = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const markIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setLiveActive(false), 1500);
    };
    const open = () => {
      if (closed) return;
      try { ws = new WebSocket(url); } catch { return; }
      ws.onopen = () => setLiveConnected(true);
      ws.onmessage = (ev) => {
        let msg: { type?: string; frame?: MocapFrame } | null = null;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg || (msg.type !== "mocap" && msg.type !== "livelink") || !msg.frame) return;
        mocapFrameRef.current = msg.frame;
        setLiveActive(true);
        markIdle();
      };
      ws.onclose = () => {
        setLiveConnected(false);
        setLiveActive(false);
        if (!closed) setTimeout(open, 1500);
      };
      ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
    };
    open();
    return () => {
      closed = true;
      if (idleTimer) clearTimeout(idleTimer);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [liveLinkRoom]);

  // Adopt a provided song URL.
  useEffect(() => {
    const el = audioRef.current;
    if (el && audioSrc) {
      el.crossOrigin = "anonymous";
      if (el.src !== audioSrc) el.src = audioSrc;
      setReady(true);
    }
  }, [audioSrc, audioRef, setReady]);

  // Live song playback time → shared with the render loop so captured motion
  // replay stays locked to the actual audio position (and pauses with it).
  const songTimeRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      songTimeRef.current = el && !el.paused ? el.currentTime : songTimeRef.current;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioRef]);

  const environmentUrl = worldIdx >= 0 ? environments[worldIdx]?.url ?? null : null;
  const environmentDepthUrl = worldIdx >= 0 ? environments[worldIdx]?.depthUrl ?? null : null;
  // An immersive 360° world owns the background, so the flat backdrop is suppressed.
  const backdropUrl = !environmentUrl && backdropIdx >= 0 ? backgrounds[backdropIdx] ?? null : null;

  const env = useMemo(
    () => HOLOGRAM_ENVIRONMENTS.find((e) => e.id === envId) || HOLOGRAM_ENVIRONMENTS[1],
    [envId],
  );

  // Adopt each stage's recommended IBL intensity when it changes.
  useEffect(() => {
    setEnvIntensity(env.envIntensity ?? 0.7);
  }, [env]);

  const handleClips = React.useCallback((names: string[]) => {
    setClips(names);
    // Keep the avatar static by default (NO_CLIP) instead of auto-playing the
    // first baked clip, which caused the constant jitter.
    setActiveClip((prev) => prev ?? NO_CLIP);
  }, []);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", ...style }} ref={rootRef}>
      <div style={{ position: "absolute", inset: 0, background: env.background }}>
        <ViewerErrorBoundary
          key={retryKey}
          fallback={<FailOverlay poster={poster} onRetry={retryLoad} />}
        >
          <Canvas
            shadows={!isMobile}
            dpr={isMobile ? 1 : [1, 2]}
            resize={{ offsetSize: true }}
            frameloop="always"
            style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
            gl={{
              antialias: !isMobile,
              alpha: true,
              // preserveDrawingBuffer is heavy and triggers context loss on iOS Safari.
              preserveDrawingBuffer: !isMobile,
              // "high-performance" makes the browser hand out a discrete-GPU
              // context; on phones (and when several WebGL pages are open) that
              // request is often refused/dropped → the avatar never shows. The
              // default power profile reuses the shared mobile GPU reliably.
              powerPreference: isMobile ? "default" : "high-performance",
              failIfMajorPerformanceCaveat: false,
            }}
            camera={{ position: [0, 1.2, 4.5], fov: 38 }}
            onCreated={({ gl, invalidate }) => {
              // Soft, Unreal-style shadows (percentage-closer filtering).
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
              const canvas = gl.domElement;
              // Recover gracefully if the mobile GPU drops the WebGL context.
              canvas.addEventListener(
                "webglcontextlost",
                (e) => {
                  e.preventDefault();
                  console.warn("[HologramStageViewer] WebGL context lost — will restore.");
                },
                false,
              );
              // When the GPU hands the context back, force R3F to redraw so the
              // avatar reappears instead of staying on a blank/frozen canvas.
              canvas.addEventListener(
                "webglcontextrestored",
                () => {
                  console.warn("[HologramStageViewer] WebGL context restored — redrawing.");
                  try { invalidate(); } catch { /* ignore */ }
                  window.dispatchEvent(new Event("resize"));
                },
                false,
              );
            }}
          >
            <Scene
              src={src}
              format={format}
              env={env}
              materialMode={materialMode}
              activeClip={liveActive ? NO_CLIP : activeClip}
              autoRotate={autoRotate}
              bloom={bloom}
              exposure={exposure}
              params={params}
              transform={transform}
              envIntensity={envIntensity}
              fadeDuration={fadeDuration}
              performance={performance}
              perfIntensity={perfIntensity}
              motionTimeline={motionTimeline}
              songTimeRef={songTimeRef}
              backdropUrl={backdropUrl}
              environmentUrl={environmentUrl}
              environmentDepthUrl={environmentDepthUrl}
              stageY={stageY}
              showRiser={showRiser}
              riserScale={riserScale}
              colorA={colorA}
              colorB={colorB}
              audioLevels={levels}
              singing={playing || autoplayMotion}
              lowPower={isMobile}
              onClips={handleClips}
              onModelTimeout={() => setLoadFailed(true)}
              mocapFrameRef={mocapFrameRef}
              liveActive={liveActive}
              preserveOriginalPBR={!paramsTouched}
            />
          </Canvas>
        </ViewerErrorBoundary>
        {loadFailed && <FailOverlay poster={poster} onRetry={retryLoad} />}
      </div>

      {/* Live Link status pill */}
      {liveLinkRoom != null && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: liveActive ? "#06140d" : "#fff",
            background: liveActive ? "#22ff9b" : liveConnected ? "rgba(0,245,255,0.18)" : "rgba(255,255,255,0.12)",
            border: `1px solid ${liveActive ? "#22ff9b" : "rgba(255,255,255,0.25)"}`,
            backdropFilter: "blur(6px)",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: liveActive ? "#06140d" : liveConnected ? "#00f5ff" : "#888",
              animation: liveActive ? "pulse 1s infinite" : undefined,
            }}
          />
          {liveActive ? "Live Link · ON AIR" : liveConnected ? "Live Link · ready" : "Live Link · waiting"}
        </div>
      )}

      {/* Hidden audio element — the analyser taps this for lip-sync + beat motion. */}
      <audio ref={audioRef} crossOrigin="anonymous" preload="none" loop style={{ display: "none" }} />

      {/* Now-playing pill */}
      {playing && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 12px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            border: `1px solid ${env.accent}55`,
            backdropFilter: "blur(8px)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            maxWidth: "80%",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: env.accent, boxShadow: `0 0 8px ${env.accent}`, flexShrink: 0 }} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {songTitle ? `Singing · ${songTitle}` : "Singing live"}
          </span>
        </div>
      )}

      {!hideControls && !compact && (
        <>
          {showAdvanced && (
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: isMobile ? 60 : 70,
                display: "flex",
                flexWrap: "wrap",
                gap: isMobile ? 10 : 14,
                alignItems: "center",
                padding: isMobile ? "10px 12px" : "12px 14px",
                borderRadius: 14,
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(10px)",
                maxHeight: "55%",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <Slider label="Exposure" min={0.4} max={2} step={0.05} value={exposure} onChange={setExposure} accent={env.accent} />
              <Slider label="Metal" min={0} max={1} step={0.02} value={params.metalness} onChange={(v) => { setParamsTouched(true); setParams((p) => ({ ...p, metalness: v })); }} accent={env.accent} />
              <Slider label="Rough" min={0} max={1} step={0.02} value={params.roughness} onChange={(v) => { setParamsTouched(true); setParams((p) => ({ ...p, roughness: v })); }} accent={env.accent} />
              <Slider label="Glow" min={0} max={2} step={0.05} value={params.emissive} onChange={(v) => { setParamsTouched(true); setParams((p) => ({ ...p, emissive: v })); }} accent={env.accent} />
              <Slider label="Light" min={0} max={2} step={0.05} value={envIntensity} onChange={setEnvIntensity} accent={env.accent} />
              <Slider label="Height" min={-1.5} max={1.5} step={0.02} value={transform.posY} onChange={(v) => setTransform((t) => ({ ...t, posY: v }))} accent={env.accent} />
              <Slider label="Turn" min={-Math.PI} max={Math.PI} step={0.02} value={transform.rotationY} onChange={(v) => setTransform((t) => ({ ...t, rotationY: v }))} accent={env.accent} />
              <Slider label="Scale" min={0.4} max={2.2} step={0.02} value={transform.scale} onChange={(v) => setTransform((t) => ({ ...t, scale: v }))} accent={env.accent} />
              <Slider label="Blend" min={0.05} max={1.5} step={0.05} value={fadeDuration} onChange={setFadeDuration} accent={env.accent} />
              <Slider label="Energy" min={0} max={1.6} step={0.05} value={perfIntensity} onChange={setPerfIntensity} accent={env.accent} />
              {environmentUrl && (
                <>
                  <Slider label="Floor" min={-4} max={2} step={0.05} value={stageY} onChange={setStageY} accent={env.accent} />
                  <Slider label="Stage" min={0.4} max={2.5} step={0.05} value={riserScale} onChange={setRiserScale} accent={env.accent} />
                  <button
                    onClick={() => setShowRiser((s) => !s)}
                    title="Show/hide the stage riser"
                    style={{
                      alignSelf: "flex-end",
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "#fff",
                      background: showRiser ? `${env.accent}33` : "rgba(255,255,255,0.08)",
                      border: `1px solid ${showRiser ? env.accent : "rgba(255,255,255,0.12)"}`,
                      cursor: "pointer",
                    }}
                  >
                    {showRiser ? "Riser: on" : "Riser: off"}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setTransform(DEFAULT_TRANSFORM);
                  setStageY(0);
                  setRiserScale(1);
                }}
                title="Reset avatar position, rotation, scale & floor alignment"
                style={{
                  alignSelf: "flex-end",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "#fff",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                }}
              >
                Reset pose
              </button>
            </div>
          )}

          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              display: "flex",
              flexWrap: isMobile ? "nowrap" : "wrap",
              gap: 8,
              alignItems: "center",
              padding: isMobile ? "8px 10px" : "10px 12px",
              borderRadius: 14,
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
              overflowX: isMobile ? "auto" : "hidden",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {/* Material mode */}
            <SegGroup
              label="Look"
              options={[
                { id: "solid", label: "Solid" },
                { id: "hologram", label: "Holo" },
                { id: "ghost", label: "Ghost" },
                { id: "wireframe", label: "Wire" },
              ]}
              value={materialMode}
              onChange={(v) => setMaterialMode(v as MaterialMode)}
              accent={env.accent}
            />

            {/* Environment */}
            <SegGroup
              label="Stage"
              options={HOLOGRAM_ENVIRONMENTS.map((e) => ({ id: e.id, label: e.label }))}
              value={envId}
              onChange={setEnvId}
              accent={env.accent}
            />

            {/* Immersive 360° AI worlds (equirectangular skybox + IBL) */}
            {environments.length > 0 && (
              <SegGroup
                label="World"
                options={[
                  { id: "-1", label: "Studio" },
                  ...environments.slice(0, 8).map((e, i) => ({ id: String(i), label: e.label || `World ${i + 1}` })),
                ]}
                value={String(worldIdx)}
                onChange={(v) => setWorldIdx(parseInt(v, 10))}
                accent={env.accent}
              />
            )}

            {/* Animations */}
            {clips.length > 0 && (
              <SegGroup
                label="Anim"
                options={[
                  { id: NO_CLIP, label: "Off" },
                  ...clips.slice(0, 6).map((c) => ({ id: c, label: c.length > 12 ? c.slice(0, 12) + "…" : c })),
                ]}
                value={activeClip || clips[0]}
                onChange={setActiveClip}
                accent={env.accent}
              />
            )}

            {/* Performance / singing motion */}
            <SegGroup
              label="Motion"
              options={PERFORMANCE_MODES}
              value={performance}
              onChange={(v) => setPerformance(v as PerformanceMode)}
              accent={env.accent}
            />

            {/* Generated scene backdrops */}
            {backgrounds.length > 0 && (
              <SegGroup
                label="Backdrop"
                options={[
                  { id: "-1", label: "None" },
                  ...backgrounds.slice(0, 6).map((_, i) => ({ id: String(i), label: `Scene ${i + 1}` })),
                ]}
                value={String(backdropIdx)}
                onChange={(v) => setBackdropIdx(parseInt(v, 10))}
                accent={env.accent}
              />
            )}

            <div style={{ marginLeft: isMobile ? 0 : "auto", display: "flex", gap: 6, flexShrink: 0 }}>
              {/* Sing-to-the-song: lip-sync + beat-reactive performance */}
              <button
                onClick={() => {
                  if (ready) toggle();
                  else fileInputRef.current?.click();
                }}
                title={ready ? (playing ? "Pause song" : "Sing to the song") : "Load a song to make the avatar sing"}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: playing ? "#000" : "#fff",
                  background: playing ? env.accent : "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {ready ? (playing ? "❚❚ Singing" : "♪ Sing") : "♪ Load song"}
              </button>
              {ready && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Load a different song"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    cursor: "pointer",
                  }}
                >
                  ⇄
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    loadFile(f);
                    setTimeout(() => toggle(), 60);
                  }
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => setShowAdvanced((s) => !s)}
                title="Material & exposure tuning"
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: showAdvanced ? "#000" : "#fff",
                  background: showAdvanced ? env.accent : "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                }}
              >
                Tune
              </button>
              <button
                onClick={() => setAutoRotate((r) => !r)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: autoRotate ? "#000" : "#fff",
                  background: autoRotate ? env.accent : "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                }}
              >
                {autoRotate ? "Rotating" : "Rotate"}
              </button>
            </div>
          </div>
        </>
      )}

      {!hideControls && compact && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 10,
            display: "flex",
            justifyContent: "center",
            gap: 6,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 4,
              borderRadius: 999,
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(10px)",
              pointerEvents: "auto",
            }}
          >
            <button
              onClick={() => setAutoRotate((r) => !r)}
              title={autoRotate ? "Pause rotation (drag to rotate)" : "Auto-rotate"}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.3,
                color: autoRotate ? "#000" : "#fff",
                background: autoRotate ? env.accent : "rgba(255,255,255,0.08)",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {autoRotate ? "◐ Rotating" : "▷ Rotate"}
            </button>
            <button
              onClick={() => setMaterialMode((m) => (m === "hologram" ? "solid" : "hologram"))}
              title="Toggle holographic look"
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.3,
                color: materialMode === "hologram" ? "#000" : "#fff",
                background: materialMode === "hologram" ? env.accent : "rgba(255,255,255,0.08)",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ✦ Holo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small segmented control ──────────────────────────────────────────────────

function SegGroup({
  label,
  options,
  value,
  onChange,
  accent,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 8, background: "rgba(255,255,255,0.05)", flexShrink: 0 }}>
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                flexShrink: 0,
                color: active ? "#000" : "rgba(255,255,255,0.7)",
                background: active ? accent : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slider control ───────────────────────────────────────────────────────────

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  accent,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 110 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: accent }}>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: accent, height: 4, cursor: "pointer" }}
      />
    </div>
  );
}
