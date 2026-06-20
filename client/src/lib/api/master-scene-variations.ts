/**
 * Master Scene Variations System
 * Genera múltiples cortes/ángulos de una escena master manteniendo coherencia visual
 * 
 * Concepto: Una "hero shot" generada se usa como referencia para crear 3-4 variaciones
 * automáticas (wide, medium, closeup, detail) usando FAL image-to-image
 */

import { logger } from "../logger";
import type { MusicVideoScene, SceneRole } from "../../types/music-video-scene";

export interface ShotVariation {
  type: "wide" | "medium" | "closeup" | "detail";
  depthOfField: "shallow" | "moderate" | "deep";
  cameraAngle: "neutral" | "low" | "high" | "diagonal";
  framingShift: number;
  zoomLevel: number;
}

export interface MasterVariationResult {
  success: boolean;
  sceneId: string;
  masterImageUrl: string;
  variations: Array<{
    variationType: string;
    imageUrl: string;
    prompt: string;
  }>;
  error?: string;
}

/**
 * Detecta escenas maestro: performance con closeups
 * Selecciona aleatoriamente ~40% para ser maestro
 */
export function detectMasterScenes(scenes: MusicVideoScene[]): string[] {
  const masterCandidates = scenes.filter(s => {
    const isPerformance = s.role === "performance";
    const isCloseup = ["cu", "ecu", "mcu"].some(t => s.shot_type.toLowerCase().includes(t));
    return isPerformance && isCloseup;
  });

  // Seleccionar aleatoriamente ~40% para ser maestro
  const masterScenes = masterCandidates.filter(() => Math.random() > 0.6);
  logger.info(
    `🎬 Master Scene Detection: ${masterScenes.length}/${masterCandidates.length} scenes selected as master`
  );
  return masterScenes.map(s => s.scene_id);
}

/**
 * Genera variaciones de composición para una escena maestro
 */
export function generateVariationsForMasterScene(
  masterSceneId: string,
  count: number = 3
): ShotVariation[] {
  const variations: ShotVariation[] = [];
  const types: ("wide" | "medium" | "closeup" | "detail")[] = [
    "wide",
    "medium",
    "closeup",
    "detail",
  ];
  const angles: ("neutral" | "low" | "high" | "diagonal")[] = [
    "neutral",
    "low",
    "high",
    "diagonal",
  ];
  const dofs: ("shallow" | "moderate" | "deep")[] = [
    "shallow",
    "moderate",
    "deep",
  ];

  for (let i = 0; i < Math.min(count, types.length); i++) {
    variations.push({
      type: types[i % types.length],
      depthOfField: dofs[Math.floor(Math.random() * dofs.length)],
      cameraAngle: angles[Math.floor(Math.random() * angles.length)],
      framingShift: (Math.random() - 0.5) * 2,
      zoomLevel: 0.7 + Math.random() * 1.3,
    });
  }

  return variations;
}

/**
 * Genera prompts únicos para cada variación
 */
function generateVariationPrompt(
  corePrompt: string,
  variation: ShotVariation
): string {
  const shotDescriptions: Record<string, string> = {
    wide: "wide establishing shot showing full scene and environment",
    medium: "medium shot from waist up with good context",
    closeup: "tight close-up of face and emotional expression",
    detail: "ultra-tight detail shot emphasizing eyes and emotion",
  };

  const angleDescriptions: Record<string, string> = {
    neutral: "straight neutral angle",
    low: "shot from below looking upward, power angle",
    high: "shot from above, intimate and vulnerable perspective",
    diagonal: "dynamic diagonal composition",
  };

  const dofDescriptions: Record<string, string> = {
    shallow:
      "shallow depth of field with soft blurred background bokeh",
    moderate: "moderate depth of field, clear foreground and background",
    deep: "deep depth of field, sharp throughout scene",
  };

  return `${corePrompt}

VARIATION SPECIFICATIONS:
Shot Type: ${shotDescriptions[variation.type]}
Camera Angle: ${angleDescriptions[variation.cameraAngle]}
Depth of Field: ${dofDescriptions[variation.depthOfField]}
Framing: ${variation.framingShift > 0 ? "right-aligned" : "left-aligned"} composition
Zoom Level: ${variation.zoomLevel.toFixed(1)}x

CRITICAL: Maintain EXACT same performer, location, lighting, outfit, and mood as reference.
Only vary: camera angle, framing, zoom, depth of field.`;
}

/**
 * Genera una variación usando FAL image-to-image
 */
async function generateVariationFromMaster(
  masterImageUrl: string,
  corePrompt: string,
  variation: ShotVariation
): Promise<string | null> {
  try {
    const FAL_API_KEY = import.meta.env.VITE_FAL_API_KEY;
    if (!FAL_API_KEY) {
      logger.warn("⚠️ FAL_API_KEY not configured for variations");
      return masterImageUrl;
    }

    const prompt = generateVariationPrompt(corePrompt, variation);

    logger.info(
      `📸 FAL variation generation: ${variation.type} ${variation.cameraAngle} angle`
    );

    const response = await fetch(
      "https://queue.fal.run/fal-ai/image-to-image",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: masterImageUrl,
          prompt: prompt,
          guidance_scale: 15,
          num_inference_steps: 30,
          strength: 0.6,
          negative_prompt:
            "Different person, different location, different lighting, changes to appearance",
        }),
      }
    );

    if (!response.ok) {
      logger.warn("⚠️ FAL variation failed, returning master");
      return masterImageUrl;
    }

    const data = await response.json();
    const requestId = data.request_id;

    // Poll para resultado
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 5000));

      const statusRes = await fetch(
        `https://queue.fal.run/fal-ai/image-to-image/requests/${requestId}/status`,
        { headers: { Authorization: `Key ${FAL_API_KEY}` } }
      );

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      if (statusData.status === "COMPLETED") {
        const resultRes = await fetch(
          `https://queue.fal.run/fal-ai/image-to-image/requests/${requestId}`,
          { headers: { Authorization: `Key ${FAL_API_KEY}` } }
        );
        const resultData = await resultRes.json();
        const variationUrl = resultData.output?.image?.url;

        if (variationUrl) {
          logger.info(`✅ Variation generated: ${variation.type}`);
          return variationUrl;
        }
      }

      if (statusData.status === "FAILED") {
        logger.warn("⚠️ FAL variation generation failed");
        return masterImageUrl;
      }
    }

    logger.warn("⚠️ FAL variation timeout");
    return masterImageUrl;
  } catch (error) {
    logger.error("❌ Variation generation error:", error);
    return masterImageUrl;
  }
}

/**
 * Procesa variaciones para múltiples escenas maestro
 */
export async function batchGenerateMasterVariations(
  script: MusicVideoScene[],
  masterImageUrls: Map<string, string>,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<Map<string, MusicVideoScene[]>> {
  const masterSceneIds = detectMasterScenes(script);
  const scenesWithVariations = new Map<string, MusicVideoScene[]>();

  let processed = 0;
  for (const masterId of masterSceneIds) {
    const masterScene = script.find((s) => s.scene_id === masterId);
    const masterImageUrl = masterImageUrls.get(masterId);

    if (!masterScene || !masterImageUrl) {
      logger.warn(`⚠️ Master scene ${masterId} missing image URL`);
      continue;
    }

    onProgress?.(processed, masterSceneIds.length, `Generating variations for ${masterId}`);

    const variations = generateVariationsForMasterScene(masterId, 3);
    const variationScenes: MusicVideoScene[] = [];

    for (let vIdx = 0; vIdx < variations.length; vIdx++) {
      const variation = variations[vIdx];
      const variationUrl = await generateVariationFromMaster(
        masterImageUrl,
        masterScene.description,
        variation
      );

      const variationScene: MusicVideoScene = {
        ...masterScene,
        scene_id: `${masterId}-var-${vIdx + 1}`,
        masterSceneId: masterId,
        isMasterScene: false,
        shotVariation: variation,
        description: `[Variation ${vIdx + 1}] ${masterScene.description}`,
        image_url: variationUrl || masterImageUrl,
      };

      variationScenes.push(variationScene);
    }

    scenesWithVariations.set(masterId, variationScenes);
    processed++;
  }

  onProgress?.(masterSceneIds.length, masterSceneIds.length, "Variations complete");
  logger.info(
    `✅ Master variations generated: ${scenesWithVariations.size} master scenes with variations`
  );
  return scenesWithVariations;
}

/**
 * Mezcla escenas maestro con variaciones en orden aleatorio
 * 70% maestro, 30% variaciones para realismo cinematográfico
 */
export function blendMasterAndVariations(
  originalScenes: MusicVideoScene[],
  scenesWithVariations: Map<string, MusicVideoScene[]>
): MusicVideoScene[] {
  return originalScenes.map((scene) => {
    const variations = scenesWithVariations.get(scene.scene_id);

    if (!variations || variations.length === 0) {
      return scene;
    }

    // 70% maestro, 30% variaciones
    if (Math.random() < 0.7) {
      return scene;
    }

    const selectedVariation =
      variations[Math.floor(Math.random() * variations.length)];
    logger.info(
      `🎬 Selected variation: ${selectedVariation.scene_id} (${selectedVariation.shotVariation?.type})`
    );
    return selectedVariation;
  });
}
