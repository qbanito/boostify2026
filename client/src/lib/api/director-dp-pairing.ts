/**
 * Director + DP Pairing System
 * Integra el Director con su Cinematógrafo para crear firma visual coherente
 */

import { logger } from "../logger";
import type { DirectorProfile } from "../../data/directors/director-schema";
import type { CinematographerProfile } from "../../data/cinematographers/cinematographer-schema";
import { getOptimalDPForDirector } from "../../data/cinematographers";

export interface DirectorDPPair {
  director: DirectorProfile;
  cinematographer: CinematographerProfile;
  synergy_score: number;
  collaboration_philosophy: string;
  combined_visual_signature: {
    visual_identity: string;
    technical_approach: string;
    narrative_style: string;
    color_language: string;
  };
  scene_generation_mandate: {
    camera_format: string;
    lens_package: string;
    film_stock_emulation: string;
    lighting_philosophy: string;
    color_grading_approach: string;
    frame_rate: string;
  };
  cinematography_guidelines: {
    must_haves: string[];
    avoid: string[];
    emphasis: string[];
  };
}

/**
 * Crea un equipo Director + DP con sinergia optimizada
 */
export async function createDirectorDPTeam(
  director: DirectorProfile
): Promise<DirectorDPPair> {
  try {
    logger.info(`🎬 [DP PAIRING] Creando equipo para ${director.name}...`);

    // Obtener DP óptimo
    const cinematographer = getOptimalDPForDirector(director.id);

    if (!cinematographer) {
      logger.warn(
        `⚠️ [DP PAIRING] No hay DP asignado para ${director.id}, usando defaults`
      );
      // Fallback a primer cinematógrafo disponible
      const { JANUSZ_KAMINSKI } = await import("../../data/cinematographers");
      return createPairingFromProfiles(director, JANUSZ_KAMINSKI);
    }

    return createPairingFromProfiles(director, cinematographer);
  } catch (error) {
    logger.error("❌ [DP PAIRING] Error creando equipo:", error);
    throw error;
  }
}

/**
 * Crea el pairing con análisis profundo de sinergia
 */
function createPairingFromProfiles(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): DirectorDPPair {
  // Calcular score de sinergia (0-100)
  const synergy_score = calculateSynergyScore(director, cinematographer);

  // Generar filosofía de colaboración
  const collaboration_philosophy = generateCollaborationPhilosophy(
    director,
    cinematographer
  );

  // Combinación de firma visual
  const combined_visual_signature = {
    visual_identity: `${director.visual_style.description} executed through ${cinematographer.signature_look.description}`,
    technical_approach: `${director.camera_preferences.shot_composition} with ${cinematographer.technical_specialties.lighting_approach}`,
    narrative_style: `${director.storytelling.narrative_approach} visualized through ${cinematographer.signature_look.key_characteristic}`,
    color_language: `${director.visual_style.color_palette.mood} with ${cinematographer.technical_specialties.color_science}`,
  };

  // Mandatos de escena
  const scene_generation_mandate = {
    camera_format: selectCameraFormat(director, cinematographer),
    lens_package: selectLensPackage(director, cinematographer),
    film_stock_emulation: selectFilmStock(director, cinematographer),
    lighting_philosophy: combineLightingPhilosophy(director, cinematographer),
    color_grading_approach: combineColorGrading(director, cinematographer),
    frame_rate: "24fps para coherencia narrativa",
  };

  // Guías cinematográficas
  const cinematography_guidelines = {
    must_haves: combineMustHaves(director, cinematographer),
    avoid: combineAvoid(director, cinematographer),
    emphasis: combineEmphasis(director, cinematographer),
  };

  logger.info(
    `✅ [DP PAIRING] Equipo creado: ${director.name} + ${cinematographer.name} (Sinergia: ${synergy_score}/100)`
  );

  return {
    director,
    cinematographer,
    synergy_score,
    collaboration_philosophy,
    combined_visual_signature,
    scene_generation_mandate,
    cinematography_guidelines,
  };
}

/**
 * Calcula score de sinergia entre director y DP
 */
function calculateSynergyScore(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): number {
  let score = 50; // Base score

  // Analizar compatibilidad de géneros
  const directorGenres =
    director.storytelling.preferred_themes || [];
  const dpGenres = cinematographer.director_collaboration.best_for_genres || [];

  const genreOverlap = directorGenres.filter((g) =>
    dpGenres.some((dg) => dg.toLowerCase().includes(g.toLowerCase()))
  ).length;

  score += genreOverlap * 5;

  // Compatibilidad de color
  const directorColors = director.visual_style.color_palette.primary_colors || [];
  const dpColors =
    cinematographer.technical_specialties.color_science || "";

  if (
    directorColors.some((c) =>
      dpColors.toLowerCase().includes(c.toLowerCase())
    )
  ) {
    score += 10;
  }

  // Compatibilidad de enfoque narrativo
  if (
    director.storytelling.symbolism_level.toLowerCase() ===
    "high"
  ) {
    if (
      cinematographer.signature_look.key_characteristic.toLowerCase().includes("psychology")
    ) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

/**
 * Genera filosofía de colaboración
 */
function generateCollaborationPhilosophy(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string {
  return `${director.name} dirige la narrativa emocional mientras ${cinematographer.name} la ejecuta a través de ${cinematographer.technical_specialties.lighting_approach.substring(0, 50)}... Ambos buscan ${combined_theme(director, cinematographer)}.`;
}

function combined_theme(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string {
  return "coherencia visual que sirve la verdad emocional de la historia";
}

/**
 * Selecciona formato de cámara óptimo
 */
function selectCameraFormat(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string {
  // Buscar si director prefiere anamorphic
  const isAnamorphic =
    director.camera_preferences.aspect_ratio?.includes("2.39") ||
    director.camera_preferences.aspect_ratio?.includes("anamorphic");

  if (isAnamorphic) {
    return cinematographer.camera_arsenal.primary_cameras
      .filter((c) => c.format.includes("anamorphic"))
      .map((c) => c.name)
      .join(" or ")[0] || "Panavision Millennium XL";
  }

  return cinematographer.camera_arsenal.primary_cameras[0]?.name || "Alexa 65";
}

/**
 * Selecciona paquete de lentes
 */
function selectLensPackage(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string {
  const preferredManufacturer = director.camera_preferences.favorite_lenses?.[0]
    ?.split(" ")[0] || "Panavision";

  const lensPackage = cinematographer.camera_arsenal.lens_packages.find((lp) =>
    lp.manufacturer.toLowerCase().includes(preferredManufacturer.toLowerCase())
  );

  return lensPackage
    ? `${lensPackage.manufacturer} ${lensPackage.series}`
    : "Panavision Master Primes";
}

/**
 * Selecciona emulación de película
 */
function selectFilmStock(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string {
  const isWarm = director.visual_style.color_palette.mood
    ?.toLowerCase()
    .includes("warm");
  const stock = cinematographer.camera_arsenal.film_stock_emulation.find(
    (fs) =>
      isWarm
        ? fs.characteristics.toLowerCase().includes("warm")
        : fs.characteristics.toLowerCase().includes("cool")
  );

  return stock?.name || "Kodak Vision3 500T";
}

/**
 * Combina filosofía de iluminación
 */
function combineLightingPhilosophy(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string {
  return `${director.visual_style.signature_techniques?.[0] || "Dynamic lighting"} combined with ${cinematographer.technical_specialties.lighting_approach.substring(0, 60)}...`;
}

/**
 * Combina enfoque de color
 */
function combineColorGrading(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string {
  const directorMood = director.visual_style.color_palette.mood || "cinematic";
  const dpColor = cinematographer.technical_specialties.color_science;
  return `${directorMood} aesthetic using ${dpColor} color science`;
}

/**
 * Combina must-haves
 */
function combineMustHaves(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string[] {
  return [
    ...(director.ai_generation_notes?.key_priorities || []),
    ...(cinematographer.generation_priorities.must_have_characteristics || []),
  ].slice(0, 10);
}

/**
 * Combina avoid-list
 */
function combineAvoid(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string[] {
  return [
    ...(director.ai_generation_notes?.avoid || []),
    ...(cinematographer.generation_priorities.avoid || []),
  ].slice(0, 10);
}

/**
 * Combina emphasis
 */
function combineEmphasis(
  director: DirectorProfile,
  cinematographer: CinematographerProfile
): string[] {
  return [
    ...(director.ai_generation_notes?.emphasis || []),
    ...(cinematographer.generation_priorities.emphasis_on || []),
  ].slice(0, 10);
}
