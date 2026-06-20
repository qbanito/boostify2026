/**
 * 🎬 CINEMATOGRAPHY INJECTION SERVICE
 * 
 * Inyecta los perfiles completos de Director+DP en cada escena,
 * proporcionando toda la información técnica cinematográfica para
 * generación de imágenes de nivel Hollywood.
 */

import {
  getDirectorDPProfile,
  getAllDirectorDPProfiles,
  getShotSpec,
  buildScenePrompt,
  getVariationEditPrompt,
  DEFAULT_PROFILE,
  getProfileOrDefault,
  DIRECTOR_DP_PAIRINGS,
  type DirectorDPProfile,
  type ShotSpec,
  type SceneWithCinematography,
} from '../data';

import { logger } from '../utils/logger';

// =============================================================================
// ENHANCED CINEMATIC SCENE INTERFACE
// =============================================================================

/**
 * Interface que extiende CinematicScene con toda la info del perfil Director+DP
 * Compatible con gemini-image-service
 */
export interface EnhancedCinematicScene {
  id: number;
  scene: string;
  camera: string;
  lighting: string;
  style: string;
  movement: string;
  // 🎤 LYRICS
  lyrics?: string;
  lyrics_segment?: string;
  lyric_connection?: string;
  narrative_context?: string;
  emotion?: string;
  // 🎬 DIRECTOR + DP (enhanced)
  director_name: string;
  dp_name: string;
  director_signature: string;
  color_grading: string;
  // 🎥 TECHNICAL CINEMATOGRAPHY
  shot_type: string;
  lens_mm: string;
  aperture: string;
  camera_height: string;
  camera_angle: string;
  depth_of_field: string;
  lighting_key: string;
  color_palette: string[];
  film_emulation: string;
  aspect_ratio: string;
  framing_notes: string;
  synergy_score: number;
  enhanced_prompt: string;
  // Variation support
  edit_prompt: string;
}

// =============================================================================
// SCENE ENHANCEMENT
// =============================================================================

/**
 * Tipos de escena mapeados a shot types del perfil
 */
const SCENE_TYPE_TO_SHOT: Record<string, keyof DirectorDPProfile['shot_library']> = {
  // Wide shots
  'establishing': 'wide_establishing',
  'wide': 'wide_establishing',
  'environment': 'wide_environment',
  'location': 'wide_establishing',
  'aerial': 'wide_establishing',
  
  // Medium shots
  'medium': 'medium_narrative',
  'narrative': 'medium_narrative',
  'dialogue': 'medium_narrative',
  'interaction': 'two_shot',
  'full': 'medium_full',
  
  // Close shots
  'close': 'close_up_emotional',
  'closeup': 'close_up_emotional',
  'close-up': 'close_up_emotional',
  'emotional': 'close_up_emotional',
  'intimate': 'close_up_emotional',
  'profile': 'close_up_profile',
  
  // Special shots
  'detail': 'detail_insert',
  'insert': 'detail_insert',
  'object': 'detail_insert',
  'extreme': 'extreme_close_up',
  'macro': 'extreme_close_up',
  'overhead': 'overhead_god_view',
  'god': 'overhead_god_view',
  'low': 'low_angle_power',
  'power': 'low_angle_power',
  'hero': 'low_angle_power',
  'high': 'high_angle_vulnerable',
  'vulnerable': 'high_angle_vulnerable',
  'dutch': 'dutch_angle_tension',
  'tilt': 'dutch_angle_tension',
  'pov': 'pov_subjective',
  'subjective': 'pov_subjective',
  'over-shoulder': 'over_shoulder',
  'ots': 'over_shoulder',
  
  // Performance
  'performance': 'medium_narrative',
  'singing': 'medium_close',
  'dancing': 'wide_environment',
  
  // Default
  'default': 'medium_narrative',
};

/**
 * Detecta el tipo de shot basándose en la descripción de la escena
 */
export function detectShotType(sceneDescription: string): keyof DirectorDPProfile['shot_library'] {
  const lowerDesc = sceneDescription.toLowerCase();
  
  // Buscar coincidencias en orden de especificidad
  for (const [keyword, shotType] of Object.entries(SCENE_TYPE_TO_SHOT)) {
    if (lowerDesc.includes(keyword)) {
      return shotType;
    }
  }
  
  // Heurísticas adicionales
  if (lowerDesc.includes('face') || lowerDesc.includes('eyes') || lowerDesc.includes('expression')) {
    return 'close_up_emotional';
  }
  
  if (lowerDesc.includes('full body') || lowerDesc.includes('standing') || lowerDesc.includes('walking')) {
    return 'medium_full';
  }
  
  if (lowerDesc.includes('hands') || lowerDesc.includes('fingers') || lowerDesc.includes('ring') || lowerDesc.includes('jewelry')) {
    return 'detail_insert';
  }
  
  if (lowerDesc.includes('two people') || lowerDesc.includes('together') || lowerDesc.includes('couple')) {
    return 'two_shot';
  }
  
  if (lowerDesc.includes('sky') || lowerDesc.includes('landscape') || lowerDesc.includes('city') || lowerDesc.includes('vast')) {
    return 'wide_establishing';
  }
  
  // Default para escenas de performance
  return 'medium_narrative';
}

// =============================================================================
// PROMPT ENHANCEMENT
// =============================================================================

interface SceneEnhancementInput {
  scene: string;                    // Descripción de la escena
  director_name?: string;           // Nombre del director seleccionado
  shot_type?: string;               // Tipo de shot (opcional, se auto-detecta)
  lyrics?: string;                  // Letras para esta escena
  emotion?: string;                 // Emoción dominante
  energy_level?: number;            // Nivel de energía 0-100
  subject_description?: string;     // Descripción del sujeto (artista)
}

interface EnhancedSceneOutput {
  // Prompt mejorado
  enhanced_prompt: string;
  
  // Datos del director
  director_name: string;
  dp_name: string;
  director_signature: string;
  
  // Datos técnicos
  shot_type: string;
  lens_mm: string;
  aperture: string;
  camera_height: string;
  camera_angle: string;
  movement: string;
  lighting_key: string;
  depth_of_field: string;
  
  // Color y estilo
  color_palette: string[];
  color_grading: {
    shadows: string;
    midtones: string;
    highlights: string;
    film_emulation: string;
  };
  
  // Negative prompt
  negative_prompt: string;
  
  // Edit prompt para variaciones
  edit_prompt: string;
  
  // Framing
  aspect_ratio: string;
  framing_notes: string;
  
  // Metadata
  profile_id: string;
  synergy_score: number;
}

/**
 * Mejora una escena con toda la información cinematográfica del perfil Director+DP
 */
export function enhanceSceneWithCinematography(
  input: SceneEnhancementInput
): EnhancedSceneOutput {
  // Obtener perfil (o default)
  const profile = getProfileOrDefault(input.director_name);
  
  // Detectar tipo de shot
  const shotType = input.shot_type 
    ? (SCENE_TYPE_TO_SHOT[input.shot_type] || detectShotType(input.scene))
    : detectShotType(input.scene);
  
  // Obtener especificaciones del shot
  const shotSpec = profile.shot_library[shotType];
  
  // Construir prompt mejorado
  const subjectDesc = input.subject_description || '{subject}';
  
  let enhancedPrompt = `${profile.ai_prompts.style_prefix}

${shotSpec.prompt_template.replace('{subject}', subjectDesc).replace('{scene_description}', input.scene).replace('{detail}', subjectDesc).replace('{object}', subjectDesc).replace('{subjects}', subjectDesc)}

`;

  // Agregar letras si están disponibles
  if (input.lyrics) {
    enhancedPrompt += `
🎤 LYRICS: "${input.lyrics}"
VISUAL CONNECTION: Capture the essence of these words in the imagery.
`;
  }
  
  // Agregar emoción si está disponible
  if (input.emotion) {
    enhancedPrompt += `
🎭 EMOTION: ${input.emotion}
`;
  }
  
  // Agregar notas técnicas
  enhancedPrompt += `
TECHNICAL SPECS:
- Lens: ${shotSpec.lens_mm} at ${shotSpec.aperture}
- Camera: ${shotSpec.camera_height}, ${shotSpec.camera_angle}
- Movement: ${shotSpec.movement}
- Lighting: ${shotSpec.lighting_key}
- Depth of Field: ${shotSpec.depth_of_field}
- Framing: ${shotSpec.framing}
- Aspect Ratio: ${profile.framing.aspect_ratio}

FILM LOOK: ${profile.color_grading.film_emulation}, ${profile.color_grading.grain.character} grain
`;

  // Negative prompt
  const negativePrompt = profile.ai_prompts.negative_prompt || '';
  
  return {
    enhanced_prompt: enhancedPrompt.trim(),
    
    director_name: profile.director.name,
    dp_name: profile.cinematographer.name,
    director_signature: profile.collaboration.combined_signature,
    
    shot_type: shotType,
    lens_mm: shotSpec.lens_mm,
    aperture: shotSpec.aperture,
    camera_height: shotSpec.camera_height,
    camera_angle: shotSpec.camera_angle,
    movement: shotSpec.movement,
    lighting_key: shotSpec.lighting_key,
    depth_of_field: shotSpec.depth_of_field,
    
    color_palette: profile.color_grading.primary_palette,
    color_grading: {
      shadows: `${profile.color_grading.shadows.hue} (${profile.color_grading.shadows.saturation})`,
      midtones: `${profile.color_grading.midtones.hue} (${profile.color_grading.midtones.saturation})`,
      highlights: `${profile.color_grading.highlights.hue} (${profile.color_grading.highlights.saturation})`,
      film_emulation: profile.color_grading.film_emulation,
    },
    
    negative_prompt: negativePrompt,
    edit_prompt: shotSpec.edit_prompt,
    
    aspect_ratio: profile.framing.aspect_ratio,
    framing_notes: `${profile.framing.symmetry.use ? 'Symmetry preferred' : 'Asymmetric composition'}, ${profile.framing.center_framing.use ? 'Center framing when ' + profile.framing.center_framing.when : 'Rule of thirds'}`,
    
    profile_id: profile.id,
    synergy_score: profile.collaboration.synergy_score,
  };
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

interface SceneInput {
  id: number;
  scene: string;
  lyrics?: string;
  emotion?: string;
  timestamp?: string;
  energy_level?: number;
}

/**
 * Mejora múltiples escenas con cinematografía
 */
export function enhanceMultipleScenesWithCinematography(
  scenes: SceneInput[],
  directorName: string,
  subjectDescription?: string
): EnhancedSceneOutput[] {
  const profile = getProfileOrDefault(directorName);
  
  logger.log(`🎬 Enhancing ${scenes.length} scenes with ${profile.director.name} + ${profile.cinematographer.name} cinematography`);
  
  return scenes.map((scene, index) => {
    const enhanced = enhanceSceneWithCinematography({
      scene: scene.scene,
      director_name: directorName,
      lyrics: scene.lyrics,
      emotion: scene.emotion,
      energy_level: scene.energy_level,
      subject_description: subjectDescription,
    });
    
    logger.log(`  📷 Scene ${scene.id}: ${enhanced.shot_type} | ${enhanced.lens_mm} | ${enhanced.lighting_key}`);
    
    return enhanced;
  });
}

// =============================================================================
// VARIATION GENERATION SUPPORT
// =============================================================================

/**
 * Obtiene los tipos de shot recomendados para variaciones basándose en el tipo original
 */
export function getVariationShotTypes(
  originalShotType: keyof DirectorDPProfile['shot_library'],
  profile: DirectorDPProfile
): Array<keyof DirectorDPProfile['shot_library']> {
  // Las variaciones configuradas en el perfil
  const configuredVariations = profile.variation_config.variation_types as Array<keyof DirectorDPProfile['shot_library']>;
  
  // Filtrar para no repetir el original
  return configuredVariations.filter(type => type !== originalShotType);
}

/**
 * Genera prompts de edición para variaciones de una escena master
 */
export function getVariationEditPrompts(
  masterSceneDescription: string,
  directorName: string
): Array<{ shot_type: string; edit_prompt: string }> {
  const profile = getProfileOrDefault(directorName);
  const originalShotType = detectShotType(masterSceneDescription);
  const variationTypes = getVariationShotTypes(originalShotType, profile);
  
  return variationTypes.map(shotType => ({
    shot_type: shotType,
    edit_prompt: profile.shot_library[shotType].edit_prompt,
  }));
}

// =============================================================================
// DIRECTOR MATCHING
// =============================================================================

/**
 * Recomienda el mejor Director+DP basándose en el género musical y mood
 */
export function recommendDirectorForGenre(
  genre: string,
  mood?: string
): DirectorDPProfile {
  const genreLower = genre.toLowerCase();
  const moodLower = mood?.toLowerCase() || '';
  
  // Mapeo de géneros a directores
  const genreMatches: Record<string, string[]> = {
    'hip-hop': ['Hype Williams', 'Spike Jonze'],
    'rap': ['Hype Williams', 'Quentin Tarantino'],
    'r&b': ['Hype Williams', 'Baz Luhrmann'],
    'pop': ['Spike Jonze', 'Michel Gondry', 'Edgar Wright'],
    'rock': ['David Fincher', 'Edgar Wright', 'Quentin Tarantino'],
    'indie': ['Michel Gondry', 'Spike Jonze', 'Wes Anderson'],
    'electronic': ['Michel Gondry', 'Denis Villeneuve', 'Edgar Wright'],
    'dance': ['Hype Williams', 'Edgar Wright', 'Baz Luhrmann'],
    'country': ['Christopher Nolan', 'Denis Villeneuve'],
    'jazz': ['David Fincher', 'Quentin Tarantino'],
    'soul': ['Spike Jonze', 'Baz Luhrmann'],
    'alternative': ['David Fincher', 'Michel Gondry'],
    'metal': ['David Fincher', 'Quentin Tarantino'],
    'classical': ['Denis Villeneuve', 'Christopher Nolan'],
    'reggaeton': ['Hype Williams', 'Baz Luhrmann'],
    'latin': ['Baz Luhrmann', 'Hype Williams'],
    'k-pop': ['Edgar Wright', 'Wes Anderson'],
  };
  
  // Mapeo de moods a directores
  const moodMatches: Record<string, string> = {
    'dark': 'David Fincher',
    'melancholy': 'Denis Villeneuve',
    'sad': 'Denis Villeneuve',
    'romantic': 'Baz Luhrmann',
    'love': 'Baz Luhrmann',
    'fun': 'Edgar Wright',
    'playful': 'Michel Gondry',
    'whimsical': 'Wes Anderson',
    'epic': 'Denis Villeneuve',
    'intense': 'Christopher Nolan',
    'nostalgic': 'Spike Jonze',
    'luxury': 'Hype Williams',
    'party': 'Hype Williams',
    'retro': 'Quentin Tarantino',
    'revenge': 'Quentin Tarantino',
    'quirky': 'Wes Anderson',
  };
  
  // Primero intentar por mood si hay match exacto
  if (moodLower && moodMatches[moodLower]) {
    const profile = getDirectorDPProfile(moodMatches[moodLower]);
    if (profile) {
      logger.log(`🎬 Director recomendado por mood (${mood}): ${profile.director.name}`);
      return profile;
    }
  }
  
  // Luego por género
  for (const [genreKey, directors] of Object.entries(genreMatches)) {
    if (genreLower.includes(genreKey)) {
      const profile = getDirectorDPProfile(directors[0]);
      if (profile) {
        logger.log(`🎬 Director recomendado por género (${genre}): ${profile.director.name}`);
        return profile;
      }
    }
  }
  
  // Default
  logger.log(`🎬 Director por defecto: ${DEFAULT_PROFILE.director.name}`);
  return DEFAULT_PROFILE;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  getDirectorDPProfile,
  getAllDirectorDPProfiles,
  getShotSpec,
  buildScenePrompt,
  getVariationEditPrompt,
  DEFAULT_PROFILE,
  getProfileOrDefault,
  DIRECTOR_DP_PAIRINGS,
};

export type {
  DirectorDPProfile,
  ShotSpec,
  SceneWithCinematography,
};

// =============================================================================
// MAIN INTEGRATION FUNCTION
// =============================================================================

interface BasicSceneInput {
  id: number;
  scene: string;
  camera?: string;
  lighting?: string;
  style?: string;
  movement?: string;
  lyrics?: string;
  lyrics_segment?: string;
  lyric_connection?: string;
  narrative_context?: string;
  emotion?: string;
}

/**
 * 🎬 FUNCIÓN PRINCIPAL DE INTEGRACIÓN
 * 
 * Toma una escena básica y la enriquece con toda la información cinematográfica
 * del perfil Director+DP, lista para ser usada por generateImageFromCinematicScene
 * 
 * @param scene - Escena básica con descripción
 * @param directorName - Nombre del director a usar
 * @param subjectDescription - Descripción del sujeto (artista)
 * @returns EnhancedCinematicScene lista para generación de imagen
 */
export function prepareSceneForImageGeneration(
  scene: BasicSceneInput,
  directorName: string,
  subjectDescription?: string
): EnhancedCinematicScene {
  // Obtener perfil Director+DP
  const profile = getProfileOrDefault(directorName);
  
  // Detectar tipo de shot
  const shotType = detectShotType(scene.scene);
  
  // Obtener specs del shot
  const shotSpec = profile.shot_library[shotType];
  
  // Construir el prompt mejorado
  const subjectDesc = subjectDescription || '{subject}';
  
  let enhancedPrompt = `${profile.ai_prompts.style_prefix}

${shotSpec.prompt_template.replace('{subject}', subjectDesc).replace('{scene_description}', scene.scene).replace('{detail}', subjectDesc).replace('{object}', subjectDesc).replace('{subjects}', subjectDesc)}
`;

  // Agregar letras si están disponibles
  if (scene.lyrics || scene.lyrics_segment) {
    enhancedPrompt += `
🎤 LYRICS: "${scene.lyrics || scene.lyrics_segment}"
VISUAL CONNECTION: Capture the essence of these words in the imagery.
`;
  }
  
  // Agregar emoción si está disponible
  if (scene.emotion) {
    enhancedPrompt += `
🎭 EMOTION: ${scene.emotion}
`;
  }
  
  // Agregar notas técnicas
  enhancedPrompt += `
TECHNICAL SPECS:
- Lens: ${shotSpec.lens_mm} at ${shotSpec.aperture}
- Camera: ${shotSpec.camera_height}, ${shotSpec.camera_angle}
- Movement: ${shotSpec.movement}
- Lighting: ${shotSpec.lighting_key}
- Depth of Field: ${shotSpec.depth_of_field}
- Framing: ${shotSpec.framing}
- Aspect Ratio: ${profile.framing.aspect_ratio}

FILM LOOK: ${profile.color_grading.film_emulation}, ${profile.color_grading.grain.character} grain
`;

  logger.log(`🎬 Prepared scene ${scene.id} with ${profile.director.name} + ${profile.cinematographer.name}`);
  logger.log(`📷 Shot: ${shotType} | Lens: ${shotSpec.lens_mm} | Aperture: ${shotSpec.aperture}`);
  
  return {
    id: scene.id,
    scene: scene.scene,
    camera: scene.camera || shotSpec.camera_angle,
    lighting: scene.lighting || shotSpec.lighting_key,
    style: scene.style || profile.collaboration.combined_signature,
    movement: scene.movement || shotSpec.movement,
    
    // Lyrics
    lyrics: scene.lyrics,
    lyrics_segment: scene.lyrics_segment,
    lyric_connection: scene.lyric_connection,
    narrative_context: scene.narrative_context,
    emotion: scene.emotion,
    
    // Director + DP
    director_name: profile.director.name,
    dp_name: profile.cinematographer.name,
    director_signature: profile.collaboration.combined_signature,
    color_grading: profile.color_grading.film_emulation,
    
    // Technical specs
    shot_type: shotType,
    lens_mm: shotSpec.lens_mm,
    aperture: shotSpec.aperture,
    camera_height: shotSpec.camera_height,
    camera_angle: shotSpec.camera_angle,
    depth_of_field: shotSpec.depth_of_field,
    lighting_key: shotSpec.lighting_key,
    color_palette: profile.color_grading.primary_palette,
    film_emulation: profile.color_grading.film_emulation,
    aspect_ratio: profile.framing.aspect_ratio,
    framing_notes: `${profile.framing.symmetry.use ? 'Symmetry preferred' : 'Asymmetric composition'}, ${profile.framing.center_framing.use ? 'Center framing when ' + profile.framing.center_framing.when : 'Rule of thirds'}`,
    synergy_score: profile.collaboration.synergy_score,
    enhanced_prompt: enhancedPrompt.trim(),
    
    // Variation support
    edit_prompt: shotSpec.edit_prompt,
  };
}

/**
 * Prepara múltiples escenas para generación de imagen
 */
export function prepareScenesForImageGeneration(
  scenes: BasicSceneInput[],
  directorName: string,
  subjectDescription?: string
): EnhancedCinematicScene[] {
  logger.log(`🎬 Preparing ${scenes.length} scenes with ${directorName} cinematography...`);
  
  return scenes.map(scene => 
    prepareSceneForImageGeneration(scene, directorName, subjectDescription)
  );
}
