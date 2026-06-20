/**
 * Narrative Script Enricher
 * Sincroniza: Letra + Historia + Director + Artista → Script JSON coherente
 * 
 * Pipeline:
 * 1. Analizar letra y extraer temas narrativos
 * 2. Definir arco narrativo (acto 1, 2, 3, clímax, resolución)
 * 3. Crear guía artística (apariencia, vestuario, presencia)
 * 4. Mapear emociones por timestamp
 * 5. Enriquecer cada escena con contexto narrativo
 */

import { logger } from "../logger";
import type { MusicVideoScene, MusicVideoConcept } from "../../types/music-video-scene";
import type { DirectorProfile } from "../../data/directors/director-schema";
import { createDirectorDPTeam } from "./director-dp-pairing";
import { generateMotionDescriptor, type MotionDescriptorConfig } from "./motion-descriptor-generator";

export interface NarrativeContext {
  storyOverview: string;
  themes: string[];
  narrativeArc: {
    act1: string;
    act2: string;
    climax: string;
    resolution: string;
  };
  artistGuidelines: {
    appearance: string;
    wardrobe: string[];
    presence: string;
    emotionalJourney: string;
  };
  emotionalMap: Array<{
    timestamp: number;
    emotion: string;
    intensity: number;
    colorTone: string;
  }>;
}

/**
 * Enriquece el script JSON con contexto narrativo + cinematográfico + MOTION DESCRIPTORS
 */
export async function enrichScriptWithNarrative(
  lyrics: string,
  scenes: MusicVideoScene[],
  directorName: string,
  artistDescription: string,
  concept: MusicVideoConcept | null,
  audioDuration: number,
  directorProfile?: DirectorProfile,
  musicGenre?: string,
  bpm?: number
): Promise<MusicVideoScene[]> {
  try {
    logger.info("📖 Enriqueciendo script con contexto narrativo y cinematográfico...");

    // 1. Extraer temas de la letra
    const themes = extractThemesFromLyrics(lyrics);
    logger.info(`🎯 Temas extraídos: ${themes.join(", ")}`);

    // 2. Definir arco narrativo
    const narrativeArc = defineNarrativeArc(lyrics, themes, scenes.length);
    logger.info(`📈 Arco narrativo: ${narrativeArc.act1.substring(0, 50)}...`);

    // 3. Crear guía artística
    const artistGuidelines = createArtistGuidelines(
      artistDescription,
      concept?.main_wardrobe,
      concept?.story_concept
    );
    logger.info(`🎭 Guía artística: ${artistGuidelines.presence}`);

    // 4. Mapear emociones
    const emotionalMap = mapEmotionalJourney(lyrics, scenes, audioDuration);
    logger.info(`💔 Mapa emocional: ${emotionalMap.length} puntos mapeados`);

    // 5. 🆕 CREAR EQUIPO DIRECTOR + DP
    let dpTeam = null;
    if (directorProfile) {
      logger.info(`🎬 [DP] Creando equipo cinematográfico para ${directorProfile.name}...`);
      try {
        dpTeam = await createDirectorDPTeam(directorProfile);
        logger.info(`✅ [DP] Equipo: ${dpTeam.director.name} + ${dpTeam.cinematographer.name} (Sinergia: ${dpTeam.synergy_score}/100)`);
      } catch (dpError) {
        logger.warn('⚠️ [DP] Error creando equipo cinematográfico, continuando sin DP:', dpError);
      }
    }

    // 6. Enriquecer cada escena
    const enrichedScenes = scenes.map((scene, index) => {
      const emotionalContext = emotionalMap.find(
        (em) =>
          em.timestamp >= scene.start_time &&
          em.timestamp < scene.start_time + scene.duration
      );

      const theme = themes[index % themes.length];
      const relevantArcPhase = getArcPhaseForScene(scene.start_time, audioDuration, narrativeArc);

      // 🆕 Enriquecer con datos cinematográficos
      const enrichedScene: MusicVideoScene = {
        ...scene,
        narrative_context: `${relevantArcPhase} - ${theme}`,
        emotion: emotionalContext?.emotion || "cinematic",
        emotion_intensity: emotionalContext?.intensity || 0.5,
        color_tone: emotionalContext?.colorTone || "neutral",
        connection_to_lyrics: extractLyricsForScene(lyrics, scene),
        story_progression: relevantArcPhase,
        artist_presence_description: artistGuidelines.presence,
        wardrobe_suggestion: artistGuidelines.wardrobe[index % artistGuidelines.wardrobe.length],
        director_signature: `${directorName} style - ${concept?.story_concept || "cinematic narrative"}`,
      };

      // 🆕 AGREGAR MOTION DESCRIPTOR para video generation
      const motionConfig: MotionDescriptorConfig = {
        directorStyle: directorName,
        artistDescription,
        conceptMood: concept?.mood_progression,
        musicGenre
      };
      
      enrichedScene.motion_descriptor = generateMotionDescriptor(
        enrichedScene,
        motionConfig,
        bpm || 120,
        directorProfile
      );
      logger.info(`✅ [Motion] Descriptor agregado a escena ${enrichedScene.scene_id}`);

      // 🆕 Agregar capa cinematográfica si tenemos DP
      if (dpTeam) {
        enrichedScene.cinematography = {
          camera_format: dpTeam.scene_generation_mandate.camera_format,
          lens_manufacturer: dpTeam.cinematographer.camera_arsenal.lens_packages[0]?.manufacturer || "Panavision",
          lens_series: dpTeam.cinematographer.camera_arsenal.lens_packages[0]?.series || "Master Prime",
          focal_length: dpTeam.cinematographer.camera_arsenal.lens_packages[0]?.focal_lengths[Math.floor(Math.random() * 6)] || "35mm",
          aperture: "T1.3 - T2.8",
          film_stock_emulation: dpTeam.scene_generation_mandate.film_stock_emulation,
          grain_characteristics: dpTeam.cinematographer.camera_arsenal.film_stock_emulation[0]?.characteristics || "Fine grain",
          
          lighting_setup: {
            key_light: dpTeam.cinematographer.technical_specialties.lighting_approach.split(".")[0] || "Motivated practical",
            fill_ratio: "3:1 ratio for depth",
            practicals: ["Practicals integrated with key light"],
            color_temp_contrast: dpTeam.cinematographer.technical_specialties.color_science.split(".")[0] || "Warm/cool balance",
            technique_summary: dpTeam.cinematographer.signature_look.legendary_technique,
          },
          
          exposure_strategy: dpTeam.cinematographer.technical_specialties.exposure_philosophy,
          dynamic_range_utilization: "Full 14+ stops for maximum detail",
          dp_signature: dpTeam.cinematographer.name,
          dp_rationale: `${dpTeam.cinematographer.name} approach optimizes for ${theme} with ${emotionalContext?.emotion || 'cinematic'} emotional tone`,
        };

        enrichedScene.director_dp_context = {
          director_name: dpTeam.director.name,
          cinematographer_name: dpTeam.cinematographer.name,
          collaboration_intent: dpTeam.collaboration_philosophy,
          technical_mandates: dpTeam.cinematography_guidelines.must_haves.slice(0, 5),
          creative_priorities: dpTeam.cinematography_guidelines.emphasis.slice(0, 5),
        };
      }

      return enrichedScene;
    });

    logger.info("✅ Script enriquecido con narrativa y cinematografía");
    return enrichedScenes;
  } catch (error) {
    logger.error("❌ Error enriqueciendo script:", error);
    return scenes; // Fallback: return original scenes
  }
}

/**
 * Extrae temas principales de la letra
 */
function extractThemesFromLyrics(lyrics: string): string[] {
  const themes: Set<string> = new Set();

  // Palabras clave asociadas con temas
  const themePatterns: Record<string, string> = {
    love: "romantic, intimate, emotional connection",
    heartbreak: "sorrow, loss, melancholy",
    victory: "triumph, strength, empowerment",
    journey: "exploration, discovery, adventure",
    introspection: "self-reflection, vulnerability, honesty",
    rebellion: "defiance, independence, nonconformity",
    hope: "optimism, renewal, transformation",
    darkness: "mystery, shadow, danger",
  };

  const lyricsLower = lyrics.toLowerCase();
  for (const [keyword, theme] of Object.entries(themePatterns)) {
    if (lyricsLower.includes(keyword)) {
      themes.add(theme);
    }
  }

  // Si no hay temas detectados, usar defaults
  if (themes.size === 0) {
    return ["cinematic storytelling", "emotional journey", "visual metaphor"];
  }

  return Array.from(themes);
}

/**
 * Define el arco narrativo de la canción
 */
function defineNarrativeArc(
  lyrics: string,
  themes: string[],
  sceneCount: number
): Record<string, string> {
  const act1End = Math.round(sceneCount * 0.25);
  const act2End = Math.round(sceneCount * 0.7);

  return {
    act1: `Introduction and setup of the narrative world (scenes 1-${act1End}). Establishing the artist, location, and core emotion. Setting the tone with ${themes[0] || "cinematic storytelling"}.`,
    act2: `Development and rising action (scenes ${act1End + 1}-${act2End}). Deepening the narrative with ${themes[1] || "emotional journey"}. Building tension and visual complexity.`,
    climax: `Peak emotional and visual intensity (scenes ${act2End + 1}-${Math.round(sceneCount * 0.85)}). Maximum impact with ${themes[2] || "visual metaphor"}. Artist fully engaged in narrative.`,
    resolution: `Conclusion and denouement (final scenes). Resolving the narrative with reflection, acceptance, or transformation.`,
  };
}

/**
 * Crea guía artística basada en descripción y concepto
 */
function createArtistGuidelines(
  artistDescription: string,
  wardrobe?: {
    outfit_description: string;
    colors: string[];
    style: string;
    accessories?: string[];
  },
  storyContext?: string
): {
  appearance: string;
  wardrobe: string[];
  presence: string;
  emotionalJourney: string;
} {
  const appearance =
    artistDescription ||
    "Professional artist with commanding presence and emotional depth";
  const outfitDescription =
    wardrobe?.outfit_description ||
    "Sophisticated, stylish outfit that reflects the music's aesthetic";

  const wardrobeOptions = [
    wardrobe?.outfit_description || "Main outfit",
    `Variation: ${wardrobe?.colors?.[0] || "vibrant"} tones`,
    `Detailed focus: ${wardrobe?.accessories?.join(", ") || "accessories and details"}`,
    `Intimate moment: ${wardrobe?.style || "elegant"} but vulnerable`,
    "Performance energy: dynamic and expressive",
  ];

  return {
    appearance,
    wardrobe: wardrobeOptions,
    presence:
      storyContext && storyContext.toLowerCase().includes("intimate")
        ? "Close, introspective, connecting with camera and listener"
        : "Commanding, expressive, drawing viewer into the narrative",
    emotionalJourney:
      "Starting reflective, building intensity, reaching peak expression, then finding resolution",
  };
}

/**
 * Mapea la progresión emocional a través de la canción
 */
function mapEmotionalJourney(
  lyrics: string,
  scenes: MusicVideoScene[],
  audioDuration: number
): Array<{
  timestamp: number;
  emotion: string;
  intensity: number;
  colorTone: string;
}> {
  const emotionalMap: Array<{
    timestamp: number;
    emotion: string;
    intensity: number;
    colorTone: string;
  }> = [];

  const emotions = [
    { emotion: "mysterious", intensity: 0.5, colorTone: "cool blue" },
    { emotion: "building tension", intensity: 0.6, colorTone: "warm orange" },
    { emotion: "climactic energy", intensity: 0.9, colorTone: "intense red" },
    { emotion: "peak expression", intensity: 1.0, colorTone: "vibrant gold" },
    { emotion: "resolution", intensity: 0.7, colorTone: "soft white" },
    { emotion: "reflective", intensity: 0.4, colorTone: "cool purple" },
  ];

  const sceneCount = scenes.length;
  for (let i = 0; i < sceneCount; i++) {
    const percentThrough = i / sceneCount;
    const timestamp = scenes[i]?.start_time || (percentThrough * audioDuration);

    let emotionIndex = 0;
    if (percentThrough < 0.15) {
      emotionIndex = 0; // Mysterious intro
    } else if (percentThrough < 0.4) {
      emotionIndex = 1; // Building tension
    } else if (percentThrough < 0.7) {
      emotionIndex = 2; // Climactic
    } else if (percentThrough < 0.85) {
      emotionIndex = 3; // Peak
    } else if (percentThrough < 0.95) {
      emotionIndex = 4; // Resolution
    } else {
      emotionIndex = 5; // Reflective outro
    }

    const emot = emotions[emotionIndex];
    emotionalMap.push({
      timestamp,
      emotion: emot.emotion,
      intensity: emot.intensity + (Math.random() - 0.5) * 0.2, // Slight variation
      colorTone: emot.colorTone,
    });
  }

  return emotionalMap;
}

/**
 * Determina la fase del arco narrativo para una escena
 */
function getArcPhaseForScene(
  timestamp: number,
  totalDuration: number,
  arc: Record<string, string>
): string {
  const percentThrough = timestamp / totalDuration;

  if (percentThrough < 0.25) return "ACT 1 (Setup)";
  if (percentThrough < 0.7) return "ACT 2 (Development)";
  if (percentThrough < 0.85) return "CLIMAX (Peak)";
  return "RESOLUTION (Conclusion)";
}

/**
 * Extrae la porción de letra más relevante para una escena
 */
function extractLyricsForScene(lyrics: string, scene: MusicVideoScene): string {
  const lines = lyrics.split("\n").filter((l) => l.trim());
  const scenePercentage = scene.start_time / 
    (scene.start_time + scene.duration > 0 ? scene.start_time + scene.duration : 1);
  const lyricsIndex = Math.floor(scenePercentage * lines.length);

  const contextRange = 2;
  const start = Math.max(0, lyricsIndex - contextRange);
  const end = Math.min(lines.length, lyricsIndex + contextRange + 1);

  return lines
    .slice(start, end)
    .join(" ")
    .substring(0, 150);
}
