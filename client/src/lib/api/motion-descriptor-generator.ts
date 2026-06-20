/**
 * Motion Descriptor Generator
 * Genera descriptores de movimiento enriquecidos para video generation en FAL
 * Coordina: Director style + Scene + Emoción + Performance + BPM
 */

import { logger } from "../logger";
import type { MusicVideoScene, SceneRole } from "../../types/music-video-scene";
import type { DirectorProfile } from "../../data/directors/director-schema";

export interface MotionDescriptor {
  // Tipo de performance
  performance_type: "singing" | "dancing" | "talking" | "reacting" | "instrumental" | "ambient";
  
  // Distancia de cámara (afecta movimiento)
  camera_distance: "close-up" | "medium" | "wide" | "extreme-wide";
  
  // Intensidad emocional y de movimiento
  emotion_intensity: number;      // 0-1: subtle to intense
  movement_intensity: number;     // 0-1: still to explosive
  
  // Detalles de movimiento
  head_movement: "static" | "subtle" | "moderate" | "dynamic";
  body_movement: "static" | "subtle" | "moderate" | "dynamic" | "dance";
  hand_gestures: "none" | "minimal" | "expressive" | "choreographed";
  eye_direction: "camera" | "away" | "moving" | "interactive";
  
  // Tipo de performance específico
  singing_style?: {
    mouth_articulation: "natural" | "exaggerated" | "subtle";
    breath_timing: boolean;
    vocal_intensity: "breathy" | "moderate" | "powerful";
  };
  
  dancing_style?: {
    choreography_level: "freestyle" | "groovy" | "structured" | "complex";
    hip_movement: number;      // 0-1
    arm_extension: number;     // 0-1
    footwork_complexity: "simple" | "moderate" | "complex";
  };
  
  // Timing y sincronización
  duration_seconds: number;
  fps: number;                  // 24 or 30
  bpm?: number;                 // BPM de música para sincronización
  beat_sync: boolean;           // Si debe sincronizar con beats
  
  // Context narrativo
  emotion: string;              // passionate, subtle, joyful, melancholic, etc.
  narrative_context: string;    // Qué está pasando en la historia
  
  // Technical generation params
  motion_complexity: "minimal" | "moderate" | "high" | "cinematic";
  camera_movement_with_subject: boolean; // Si la cámara sigue al sujeto
  environmental_interaction: boolean;    // Si interactúa con ambiente
  
  // Output para FAL
  fal_prompt: string;           // Prompt enriquecido para FAL video gen
  generation_hints: string[];   // Tips adicionales
}

export interface MotionDescriptorConfig {
  directorStyle?: string;
  artistDescription?: string;
  conceptMood?: string;
  musicGenre?: string;
}

/**
 * Genera Motion Descriptor basado en escena + contexto
 */
export function generateMotionDescriptor(
  scene: MusicVideoScene,
  config: MotionDescriptorConfig,
  bpm: number = 120,
  directorProfile?: DirectorProfile
): MotionDescriptor {
  
  logger.info(`🎬 [Motion] Generando descriptor para ${scene.shot_type} - ${scene.role}`);

  // Determinar tipo de performance
  const performanceType = determinePerformanceType(scene, config);
  
  // Distancia de cámara basada en shot type
  const cameraDistance = mapShotToCameraDistance(scene.shot_type);
  
  // Intensidad emocional
  const emotionIntensity = scene.emotion_intensity || 0.5;
  const movementIntensity = calculateMovementIntensity(scene, emotionIntensity, performanceType);
  
  // Movimiento específico
  const motionDetails = generateMotionDetails(
    performanceType,
    emotionIntensity,
    movementIntensity,
    cameraDistance,
    config
  );
  
  // Generar prompt para FAL
  const falPrompt = buildFalVideoPrompt(
    scene,
    performanceType,
    motionDetails,
    bpm,
    config,
    directorProfile
  );
  
  const descriptor: MotionDescriptor = {
    performance_type: performanceType,
    camera_distance: cameraDistance,
    emotion_intensity: emotionIntensity,
    movement_intensity: movementIntensity,
    head_movement: motionDetails.headMovement,
    body_movement: motionDetails.bodyMovement,
    hand_gestures: motionDetails.handGestures,
    eye_direction: motionDetails.eyeDirection,
    singing_style: motionDetails.singingStyle,
    dancing_style: motionDetails.dancingStyle,
    duration_seconds: scene.duration,
    fps: 24,
    bpm,
    beat_sync: performanceType !== "ambient",
    emotion: scene.emotion || "neutral",
    narrative_context: scene.narrative_context || scene.description,
    motion_complexity: calculateMotionComplexity(movementIntensity),
    camera_movement_with_subject: scene.camera_movement !== "static",
    environmental_interaction: scene.role === "b-roll",
    fal_prompt: falPrompt,
    generation_hints: generateHints(scene, performanceType, motionDetails, config)
  };

  logger.info(`✅ [Motion] Descriptor generado: ${descriptor.emotion} (intensity: ${emotionIntensity})`);
  return descriptor;
}

/**
 * Determina tipo de performance basado en escena y contexto
 */
function determinePerformanceType(
  scene: MusicVideoScene,
  config: MotionDescriptorConfig
): "singing" | "dancing" | "talking" | "reacting" | "instrumental" | "ambient" {
  
  // Si es performance role y tiene lyrics
  if (scene.role === "performance") {
    if (scene.lyrics_segment) {
      return "singing";
    }
    
    // Check por keywords en descripción
    const desc = scene.description.toLowerCase();
    if (desc.includes("dance") || desc.includes("dancing")) return "dancing";
    if (desc.includes("instrument") || desc.includes("playing")) return "instrumental";
    if (desc.includes("talk") || desc.includes("speak")) return "talking";
    
    return "singing"; // Default para performance
  }
  
  // B-roll es ambient o reacting
  return scene.emotion_intensity && scene.emotion_intensity > 0.6 ? "reacting" : "ambient";
}

/**
 * Mapea shot type a camera distance
 */
function mapShotToCameraDistance(
  shotType: string
): "close-up" | "medium" | "wide" | "extreme-wide" {
  const shotLower = shotType.toLowerCase();
  
  if (shotLower.includes("ecu") || shotLower.includes("cu")) return "close-up";
  if (shotLower.includes("mcu")) return "close-up";
  if (shotLower.includes("ms") || shotLower.includes("mws")) return "medium";
  if (shotLower.includes("ls")) return "wide";
  if (shotLower.includes("ews") || shotLower.includes("ws")) return "extreme-wide";
  
  return "medium"; // default
}

/**
 * Calcula intensidad de movimiento
 */
function calculateMovementIntensity(
  scene: MusicVideoScene,
  emotionIntensity: number,
  performanceType: string
): number {
  let baseIntensity = emotionIntensity;
  
  // Performance types añaden movimiento
  if (performanceType === "dancing") baseIntensity = Math.min(1, baseIntensity + 0.3);
  if (performanceType === "singing") baseIntensity = Math.min(1, baseIntensity + 0.1);
  
  // Camera movement añade dinamismo visual
  if (scene.camera_movement !== "static") {
    baseIntensity = Math.min(1, baseIntensity + 0.15);
  }
  
  return baseIntensity;
}

interface MotionDetails {
  headMovement: "static" | "subtle" | "moderate" | "dynamic";
  bodyMovement: "static" | "subtle" | "moderate" | "dynamic" | "dance";
  handGestures: "none" | "minimal" | "expressive" | "choreographed";
  eyeDirection: "camera" | "away" | "moving" | "interactive";
  singingStyle?: {
    mouth_articulation: "natural" | "exaggerated" | "subtle";
    breath_timing: boolean;
    vocal_intensity: "breathy" | "moderate" | "powerful";
  };
  dancingStyle?: {
    choreography_level: "freestyle" | "groovy" | "structured" | "complex";
    hip_movement: number;
    arm_extension: number;
    footwork_complexity: "simple" | "moderate" | "complex";
  };
}

/**
 * Genera detalles específicos de movimiento
 */
function generateMotionDetails(
  performanceType: string,
  emotionIntensity: number,
  movementIntensity: number,
  cameraDistance: string,
  config: MotionDescriptorConfig
): MotionDetails {
  
  // Head movement basado en intensidad
  const headMovement = movementIntensity > 0.7 ? "dynamic" : 
                       movementIntensity > 0.5 ? "moderate" :
                       movementIntensity > 0.2 ? "subtle" : "static";
  
  // Body movement basado en tipo de performance
  let bodyMovement: "static" | "subtle" | "moderate" | "dynamic" | "dance" = "static";
  if (performanceType === "dancing") bodyMovement = "dance";
  else if (performanceType === "singing") bodyMovement = movementIntensity > 0.5 ? "moderate" : "subtle";
  else if (performanceType === "reacting") bodyMovement = movementIntensity > 0.6 ? "dynamic" : "moderate";
  
  // Hand gestures
  const handGestures = performanceType === "dancing" ? "choreographed" :
                      performanceType === "singing" ? "expressive" :
                      emotionIntensity > 0.6 ? "expressive" : "minimal";
  
  // Eye direction (close-ups miran a cámara)
  const eyeDirection = cameraDistance === "close-up" ? "camera" :
                      emotionIntensity > 0.7 ? "interactive" : "moving";
  
  const details: MotionDetails = {
    headMovement,
    bodyMovement,
    handGestures,
    eyeDirection,
  };
  
  // Singing style si es canto
  if (performanceType === "singing") {
    details.singingStyle = {
      mouth_articulation: emotionIntensity > 0.7 ? "exaggerated" : "natural",
      breath_timing: true,
      vocal_intensity: emotionIntensity > 0.7 ? "powerful" : 
                      emotionIntensity > 0.4 ? "moderate" : "breathy"
    };
  }
  
  // Dancing style si es baile
  if (performanceType === "dancing") {
    details.dancingStyle = {
      choreography_level: movementIntensity > 0.8 ? "complex" :
                         movementIntensity > 0.6 ? "structured" : "groovy",
      hip_movement: movementIntensity,
      arm_extension: emotionIntensity,
      footwork_complexity: movementIntensity > 0.7 ? "complex" : "moderate"
    };
  }
  
  return details;
}

/**
 * Calcula complejidad del movimiento
 */
function calculateMotionComplexity(
  movementIntensity: number
): "minimal" | "moderate" | "high" | "cinematic" {
  if (movementIntensity > 0.8) return "cinematic";
  if (movementIntensity > 0.6) return "high";
  if (movementIntensity > 0.3) return "moderate";
  return "minimal";
}

/**
 * Construye prompt enriquecido para FAL video generation
 */
function buildFalVideoPrompt(
  scene: MusicVideoScene,
  performanceType: string,
  motionDetails: MotionDetails,
  bpm: number,
  config: MotionDescriptorConfig,
  directorProfile?: DirectorProfile
): string {
  
  let prompt = `Video: ${scene.duration}s at 24fps, ${scene.visual_style} cinematography\n`;
  
  // Base description
  prompt += `${scene.description}\n`;
  
  // Performance details
  if (performanceType === "singing") {
    const singingStyle = motionDetails.singingStyle!;
    prompt += `\nPerformance: Artist singing with ${singingStyle.vocal_intensity} vocals\n`;
    prompt += `- Mouth: ${singingStyle.mouth_articulation} articulation, natural breathing\n`;
    prompt += `- Head: ${motionDetails.headMovement} movements, ${motionDetails.eyeDirection}\n`;
    prompt += `- Body: ${motionDetails.bodyMovement} natural movement\n`;
    prompt += `- Hands: ${motionDetails.handGestures} expression\n`;
  } else if (performanceType === "dancing") {
    const dancingStyle = motionDetails.dancingStyle!;
    prompt += `\nPerformance: Dynamic dancing with ${dancingStyle.choreography_level} choreography\n`;
    prompt += `- Hip movement: ${Math.round(dancingStyle.hip_movement * 100)}% intensity\n`;
    prompt += `- Arm extension: ${Math.round(dancingStyle.arm_extension * 100)}% range\n`;
    prompt += `- Footwork: ${dancingStyle.footwork_complexity}, BPM synced at ${bpm}\n`;
  } else if (performanceType === "talking") {
    prompt += `\nPerformance: Person talking naturally\n`;
    prompt += `- Expression: ${motionDetails.eyeDirection}\n`;
    prompt += `- Gestures: ${motionDetails.handGestures}\n`;
  }
  
  // Emotional direction
  if (scene.emotion) {
    prompt += `\nEmotion: ${scene.emotion} (intensity ${Math.round(scene.emotion_intensity! * 100)}%)\n`;
  }
  
  // Camera and cinematography
  if (scene.cinematography) {
    prompt += `\nCinematography: ${scene.cinematography.camera_format}, `;
    prompt += `${scene.cinematography.lens_manufacturer} ${scene.cinematography.lens_series}, `;
    prompt += `${scene.cinematography.film_stock_emulation}\n`;
  }
  
  // Director style
  if (directorProfile) {
    prompt += `\nDirector Style: ${directorProfile.visual_style?.description || directorProfile.name}\n`;
  }
  
  // Lighting
  if (scene.lighting) {
    prompt += `Lighting: ${scene.lighting}\n`;
  }
  
  // Color and mood
  if (scene.color_tone) {
    prompt += `Color Tone: ${scene.color_tone}\n`;
  }
  
  // Music sync hint
  if (performanceType !== "ambient" && bpm) {
    prompt += `\nMusic Sync: Movements synchronized to ${bpm} BPM, natural flow\n`;
  }
  
  return prompt;
}

/**
 * Genera hints adicionales para la generación
 */
function generateHints(
  scene: MusicVideoScene,
  performanceType: string,
  motionDetails: MotionDetails,
  config: MotionDescriptorConfig
): string[] {
  const hints: string[] = [];
  
  // Performance hints
  if (performanceType === "singing") {
    hints.push("Mouth stays visible and articulate");
    hints.push("Natural breath patterns, no unnatural pauses");
    if (motionDetails.singingStyle?.vocal_intensity === "powerful") {
      hints.push("Emotional intensity in facial expression");
    }
  }
  
  if (performanceType === "dancing") {
    hints.push("Smooth continuous movement, no jerks");
    hints.push("All limbs move together in choreographed flow");
  }
  
  // Camera hints
  if (scene.camera_movement !== "static") {
    hints.push(`Camera ${scene.camera_movement.toLowerCase()} follows subject smoothly`);
  }
  
  // Quality hints
  hints.push("Professional production quality");
  hints.push("Consistent lighting throughout");
  hints.push("No artifacts or jittering");
  
  // Genre-specific
  if (config.musicGenre) {
    if (config.musicGenre.includes("hip-hop")) {
      hints.push("Rhythmic movement, on-beat animations");
    } else if (config.musicGenre.includes("rock")) {
      hints.push("Energetic, powerful movements");
    } else if (config.musicGenre.includes("pop")) {
      hints.push("Smooth, catchy movements");
    } else if (config.musicGenre.includes("soul")) {
      hints.push("Emotional, soulful expression");
    }
  }
  
  return hints;
}
