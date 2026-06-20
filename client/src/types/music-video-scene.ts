/**
 * Tipos unificados para el sistema de generación de videos musicales con IA
 * 
 * Este archivo define el schema completo que se comparte entre:
 * - Generación de script (openrouter.fixed.ts)
 * - Generación de imágenes (gemini-image.ts)
 * - Timeline editor (TimelineEditor.tsx)
 */

/**
 * Tipos de planos cinematográficos completos
 * Basados en nomenclatura estándar de la industria
 */
export enum ShotType {
  // Extreme Close-up - Plano extremadamente cerrado
  ECU = 'ECU',
  
  // Close-up - Primer plano
  CU = 'CU',
  
  // Medium Close-up - Plano medio cerrado
  MCU = 'MCU',
  
  // Medium Shot - Plano medio
  MS = 'MS',
  
  // Medium Wide Shot - Plano medio abierto
  MWS = 'MWS',
  
  // Long Shot - Plano largo
  LS = 'LS',
  
  // Wide Shot - Plano general
  WS = 'WS',
  
  // Extreme Wide Shot - Plano extremadamente abierto
  EWS = 'EWS',
  
  // Over-the-shoulder - Por encima del hombro
  OTS = 'OTS',
  
  // Point of View - Punto de vista
  POV = 'POV',
  
  // High Angle - Ángulo alto
  HIGH = 'HIGH',
  
  // Low Angle - Ángulo bajo
  LOW = 'LOW',
  
  // Dutch Angle - Ángulo holandés
  DUTCH = 'DUTCH'
}

/**
 * Rol de la escena en el video musical
 * 50% debe ser performance y 50% debe ser b-roll
 */
export enum SceneRole {
  // Artista performing (cantando, tocando instrumento, etc.)
  PERFORMANCE = 'performance',
  
  // B-roll (escenas de historia, ambiente, escenarios, etc.)
  BROLL = 'b-roll'
}

/**
 * Tipos de movimiento de cámara
 */
export enum CameraMovement {
  STATIC = 'static',
  PAN = 'pan',
  TILT = 'tilt',
  DOLLY = 'dolly',
  ZOOM = 'zoom',
  HANDHELD = 'handheld',
  STEADICAM = 'steadicam',
  CRANE = 'crane',
  DRONE = 'drone',
  TRACKING = 'tracking'
}

/**
 * Tipos de lentes cinematográficos
 */
export enum LensType {
  ULTRA_WIDE = '14mm',
  WIDE = '24mm',
  STANDARD = '35mm',
  PORTRAIT = '50mm',
  TELEPHOTO = '85mm',
  LONG_TELEPHOTO = '135mm'
}

/**
 * Estilos visuales
 */
export enum VisualStyle {
  CINEMATIC = 'cinematic',
  VIBRANT = 'vibrant',
  MUTED = 'muted',
  HIGH_CONTRAST = 'high-contrast',
  MOODY = 'moody',
  WARM = 'warm',
  COOL = 'cool',
  SATURATED = 'saturated',
  DESATURATED = 'desaturated'
}

/**
 * Tipos de iluminación
 */
export enum LightingType {
  NATURAL = 'natural',
  STUDIO = 'studio',
  DRAMATIC = 'dramatic',
  SOFT = 'soft',
  HARD = 'hard',
  MIXED = 'mixed',
  GOLDEN_HOUR = 'golden-hour',
  BLUE_HOUR = 'blue-hour',
  NEON = 'neon'
}

/**
 * Sección musical (para referencia, no se muestra en timeline)
 */
export enum MusicSection {
  INTRO = 'intro',
  VERSE = 'verse',
  PRE_CHORUS = 'pre-chorus',
  CHORUS = 'chorus',
  BRIDGE = 'bridge',
  OUTRO = 'outro',
  BREAKDOWN = 'breakdown'
}

/**
 * Schema principal de una escena de video musical
 * Este es el tipo unificado que se usa en todo el sistema
 */
export interface MusicVideoScene {
  // Identificadores
  scene_id: string;                    // ID único de la escena (ej: "scene-1")
  
  // Temporalidad (sincronizada con beats de la música)
  start_time: number;                  // Tiempo de inicio en segundos
  duration: number;                    // Duración en segundos
  beat_index?: number;                 // Índice del beat donde inicia
  
  // Rol y tipo de plano
  role: SceneRole;                     // 'performance' o 'b-roll'
  shot_type: ShotType;                 // ECU, CU, MS, LS, etc.
  
  // Configuración de cámara
  camera_movement: CameraMovement;     // Tipo de movimiento
  lens: LensType;                      // Lente usado
  
  // Estilo visual
  visual_style: VisualStyle;           // Estilo visual general
  lighting: LightingType;              // Tipo de iluminación
  color_temperature?: string;          // Temperatura de color (ej: "3200K", "5600K")
  
  // Descripción de la escena
  description: string;                 // Descripción detallada para generación de imagen
  location?: string;                   // Ubicación/escenario
  
  // Letra de la canción
  lyrics_segment?: string;             // Porción de la letra que se canta en esta escena
  
  // Vestuario y apariencia del artista (para consistencia visual)
  wardrobe?: {
    outfit_description: string;        // Descripción completa del vestuario
    colors: string[];                  // Colores principales del outfit
    style: string;                     // Estilo general (casual, formal, urbano, etc.)
    accessories?: string[];            // Accesorios (joyas, gafas, sombreros, etc.)
    hair_makeup?: string;              // Peinado y maquillaje
  };
  
  // Referencias visuales para consistencia
  visual_references?: {
    reference_scene_ids?: string[];    // IDs de escenas previas para mantener consistencia
    key_visual_elements?: string[];    // Elementos visuales clave a mantener
    color_continuity?: string;         // Paleta de colores para mantener continuidad
  };
  
  // Sección musical (solo para referencia interna)
  music_section: MusicSection;         // Intro, Verse, Chorus, etc.
  
  // Estado de generación
  image_url?: string;                  // URL de la imagen generada
  status?: 'pending' | 'generating' | 'completed' | 'error';
  
  // 🆕 Master Scene Variations
  isMasterScene?: boolean;             // True si es escena maestro
  masterSceneId?: string | null;       // ID de escena maestro (null si es master)
  shotVariation?: {                    // Parámetros de variación de composición
    type: "wide" | "medium" | "closeup" | "detail";
    depthOfField: "shallow" | "moderate" | "deep";
    cameraAngle: "neutral" | "low" | "high" | "diagonal";
    framingShift: number;
    zoomLevel: number;
  };
  
  // 🆕 Contexto Narrativo Enriquecido
  narrative_context?: string;          // Contexto narrativo de la escena
  emotion?: string;                    // Emoción dominante
  emotion_intensity?: number;          // Intensidad 0-1
  color_tone?: string;                 // Tono de color recomendado
  connection_to_lyrics?: string;       // Conexión explícita con la letra
  story_progression?: string;          // Fase del arco narrativo
  artist_presence_description?: string; // Cómo debe estar presente el artista
  wardrobe_suggestion?: string;        // Sugerencia de vestuario/apariencia
  director_signature?: string;         // Firma/estilo del director
  
  // 🆕 Cinematography Layer (Director of Photography)
  cinematography?: {
    camera_format: string;             // "Alexa 65", "Panavision System LF", etc.
    lens_manufacturer: string;         // "Panavision", "Zeiss", "Cooke"
    lens_series: string;               // "Master Prime", "Anamorphic/i"
    focal_length: string;              // "32mm", "50mm", etc.
    aperture: string;                  // "T1.3", "T2.8"
    film_stock_emulation: string;      // "Kodak Vision3 500T", etc.
    grain_characteristics: string;     // "Fine", "Medium", "Coarse"
    
    lighting_setup: {
      key_light: string;               // Type and intensity
      fill_ratio: string;              // Light ratio philosophy
      practicals: string[];            // Practical light sources
      color_temp_contrast: string;     // Warm/cool balance
      technique_summary: string;       // Overall approach
    };
    
    exposure_strategy: string;         // DP's exposure philosophy
    dynamic_range_utilization: string; // How to use full DR
    
    // DP rationale
    dp_signature: string;              // Which DP style is being honored
    dp_rationale: string;              // Why these choices for this scene
  };
  
  // Director-DP Collaboration Context
  director_dp_context?: {
    director_name: string;
    cinematographer_name: string;
    collaboration_intent: string;      // How they work together
    technical_mandates: string[];      // Non-negotiable technical requirements
    creative_priorities: string[];     // What matters most for this scene
  };
  
  // 🆕 MOTION DESCRIPTOR LAYER - Para video generation con movimientos
  motion_descriptor?: {
    performance_type: "singing" | "dancing" | "talking" | "reacting" | "instrumental" | "ambient";
    camera_distance: "close-up" | "medium" | "wide" | "extreme-wide";
    emotion_intensity: number;
    movement_intensity: number;
    head_movement: "static" | "subtle" | "moderate" | "dynamic";
    body_movement: "static" | "subtle" | "moderate" | "dynamic" | "dance";
    hand_gestures: "none" | "minimal" | "expressive" | "choreographed";
    eye_direction: "camera" | "away" | "moving" | "interactive";
    duration_seconds: number;
    fps: number;
    bpm?: number;
    beat_sync: boolean;
    emotion: string;
    motion_complexity: "minimal" | "moderate" | "high" | "cinematic";
    fal_prompt: string;
    generation_hints: string[];
  };

  // 🆕 Video generation (instead of static image)
  video_url?: string;                // URL del video generado por FAL
  video_status?: 'pending' | 'generating' | 'completed' | 'error'; // Video gen status

  // Metadatos adicionales
  metadata?: {
    generation_prompt?: string;        // Prompt usado para generar la imagen/video
    generation_timestamp?: number;     // Timestamp de generación
    error_message?: string;            // Mensaje de error si falla
    reference_images?: string[];       // URLs de imágenes usadas como referencia
    video_generation_model?: string;   // FAL model usado (runway-gen2, stable-video, etc)
  };
}

/**
 * Configuración para generación del script completo
 */
export interface ScriptGenerationConfig {
  // Audio
  audio_duration: number;              // Duración del audio en segundos
  audio_transcription: string;         // Transcripción del audio
  
  // Configuración de escenas
  target_scene_count?: number;         // Número objetivo de escenas (default: basado en beats)
  scene_duration_range?: {             // Rango de duración por escena
    min: number;
    max: number;
  };
  
  // Balance de roles
  performance_ratio?: number;          // Ratio de performance vs b-roll (default: 0.5 = 50%)
  
  // Beats detectados
  beats?: Array<{
    time: number;
    strength: number;
  }>;
  
  // Personalización del artista
  artist_description?: string;         // Descripción del artista
  artist_style?: string;               // Estilo del artista
  
  // Referencias visuales
  visual_references?: string[];        // Referencias de estilo visual
  
  // Restricciones
  constraints?: {
    max_consecutive_same_shot?: number;  // Máximo de shots consecutivos del mismo tipo
    required_shot_types?: ShotType[];    // Tipos de shots que deben incluirse
    forbidden_shot_types?: ShotType[];   // Tipos de shots a evitar
  };
}

/**
 * Concepto visual y narrativo del video musical
 */
export interface MusicVideoConcept {
  // Historia y narrativa
  story_concept: string;                // Concepto narrativo general del video
  visual_theme: string;                 // Tema visual principal
  mood_progression: string;             // Cómo evoluciona el mood a través del video
  
  // Vestuario principal del artista
  main_wardrobe: {
    outfit_description: string;         // Descripción del outfit principal
    colors: string[];                   // Paleta de colores del vestuario
    style: string;                      // Estilo general (urban, elegant, casual, etc.)
    accessories: string[];              // Accesorios principales
    hair_makeup: string;                // Peinado y maquillaje base
  };
  
  // Locaciones y ambientes
  locations: Array<{
    name: string;                       // Nombre de la locación
    description: string;                // Descripción detallada
    mood: string;                       // Mood de esta locación
    scenes_usage: string;               // Cuándo/cómo se usa esta locación
  }>;
  
  // Paleta de colores general
  color_palette: {
    primary_colors: string[];           // Colores principales
    accent_colors: string[];            // Colores de acento
    mood_colors: string;                // Descripción del mood de colores
  };
  
  // Elementos visuales recurrentes
  recurring_visual_elements: string[];  // Elementos que aparecen múltiples veces
  
  // Transiciones narrativas clave
  key_narrative_moments: Array<{
    timestamp: string;                  // Momento aproximado
    description: string;                // Qué sucede
  }>;
}

/**
 * Resultado completo de la generación de script
 */
export interface MusicVideoScript {
  // Metadatos del script
  id: string;
  title: string;
  duration: number;
  scene_count: number;
  
  // Concepto visual y narrativo (nuevo)
  concept?: MusicVideoConcept;
  
  // Escenas generadas
  scenes: MusicVideoScene[];
  
  // Estadísticas
  stats: {
    performance_count: number;
    broll_count: number;
    performance_ratio: number;
    shot_type_distribution: Record<ShotType, number>;
  };
  
  // Información de generación
  generated_at: number;
  generation_config: ScriptGenerationConfig;
}

/**
 * Resultado de generación batch de imágenes
 */
export interface BatchImageGenerationResult {
  success: boolean;
  scenes: MusicVideoScene[];  // Escenas con image_url poblado
  failed_scenes?: string[];   // IDs de escenas que fallaron
  error?: string;
}

/**
 * Validador de balance 50/50 ESTRICTO
 * Requiere exactamente mitad performance y mitad b-roll
 */
export function validateSceneBalance(scenes: MusicVideoScene[]): {
  valid: boolean;
  performance_ratio: number;
  message: string;
} {
  const total = scenes.length;
  const performance_count = scenes.filter(s => s.role === SceneRole.PERFORMANCE).length;
  const broll_count = scenes.filter(s => s.role === SceneRole.BROLL).length;
  const performance_ratio = performance_count / total;
  
  // Balance ESTRICTO: exactamente 50/50 (con tolerancia de 1 escena para números impares)
  const expected_count = Math.floor(total / 2);
  const valid = Math.abs(performance_count - expected_count) <= (total % 2);
  
  return {
    valid,
    performance_ratio,
    message: valid 
      ? `✅ Balance 50/50: ${performance_count} performance, ${broll_count} b-roll${total % 2 === 1 ? ' (1 escena de tolerancia para total impar)' : ''}`
      : `❌ Balance incorrecto: ${performance_count} performance, ${broll_count} b-roll (debe ser ${expected_count}/${total - expected_count}${total % 2 === 1 ? ' ±1' : ''})`
  };
}

/**
 * 🔧 NEW: Validador de letras en escenas
 * Verifica que las escenas tengan letras asignadas correctamente
 */
export function validateLyricsInScenes(scenes: MusicVideoScene[], fullLyrics?: string): {
  valid: boolean;
  scenesWithLyrics: number;
  scenesWithoutLyrics: number;
  coveragePercent: number;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Contar escenas con y sin letras
  const withLyrics = scenes.filter(s => 
    s.lyrics_segment && s.lyrics_segment.trim().length > 3
  );
  const withoutLyrics = scenes.filter(s => 
    !s.lyrics_segment || s.lyrics_segment.trim().length <= 3
  );
  
  const coveragePercent = (withLyrics.length / scenes.length) * 100;
  
  // Verificar escenas PERFORMANCE sin letras (crítico)
  const performanceWithoutLyrics = scenes.filter(s => 
    s.role === SceneRole.PERFORMANCE && 
    (!s.lyrics_segment || s.lyrics_segment.trim().length <= 3)
  );
  
  if (performanceWithoutLyrics.length > 0) {
    errors.push(`🔴 ${performanceWithoutLyrics.length} escenas PERFORMANCE sin letras asignadas`);
  }
  
  // Verificar si hay letras duplicadas exactas
  const lyricsMap = new Map<string, number>();
  withLyrics.forEach(s => {
    const normalized = s.lyrics_segment?.toLowerCase().trim() || '';
    lyricsMap.set(normalized, (lyricsMap.get(normalized) || 0) + 1);
  });
  
  const duplicates = Array.from(lyricsMap.entries())
    .filter(([_, count]) => count > 2);
  
  if (duplicates.length > 0) {
    warnings.push(`⚠️ ${duplicates.length} fragmentos de letra repetidos más de 2 veces`);
  }
  
  // Verificar cobertura mínima
  if (coveragePercent < 50) {
    errors.push(`🔴 Solo ${coveragePercent.toFixed(0)}% de las escenas tienen letras (mínimo 50%)`);
  } else if (coveragePercent < 75) {
    warnings.push(`⚠️ ${coveragePercent.toFixed(0)}% de cobertura de letras (recomendado 75%+)`);
  }
  
  // Verificar que la letra completa esté cubierta (si se proporciona)
  if (fullLyrics && fullLyrics.trim().length > 20) {
    const fullLyricsNormalized = fullLyrics.toLowerCase().replace(/\[.*?\]/g, '').trim();
    const coveredLyrics = withLyrics.map(s => s.lyrics_segment?.toLowerCase().trim() || '').join(' ');
    
    const fullWords = new Set(fullLyricsNormalized.split(/\s+/).filter(w => w.length > 2));
    const coveredWords = new Set(coveredLyrics.split(/\s+/).filter(w => w.length > 2));
    
    const missingWords = Array.from(fullWords).filter(w => !coveredWords.has(w));
    const missedPercent = (missingWords.length / fullWords.size) * 100;
    
    if (missedPercent > 30) {
      warnings.push(`⚠️ ~${missedPercent.toFixed(0)}% de la letra original no está asignada a escenas`);
    }
  }
  
  return {
    valid: errors.length === 0,
    scenesWithLyrics: withLyrics.length,
    scenesWithoutLyrics: withoutLyrics.length,
    coveragePercent,
    warnings,
    errors
  };
}

/**
 * Generador de shot_type variado
 * Asegura que no haya muchos shots consecutivos del mismo tipo
 */
export function generateVariedShotSequence(
  count: number,
  maxConsecutive: number = 2
): ShotType[] {
  const allShots = Object.values(ShotType);
  const sequence: ShotType[] = [];
  let consecutiveCount = 0;
  let lastShot: ShotType | null = null;
  
  for (let i = 0; i < count; i++) {
    let shot: ShotType;
    
    if (lastShot && consecutiveCount >= maxConsecutive) {
      // Forzar un shot diferente
      const available = allShots.filter(s => s !== lastShot);
      shot = available[Math.floor(Math.random() * available.length)];
    } else {
      // Shot aleatorio
      shot = allShots[Math.floor(Math.random() * allShots.length)];
    }
    
    if (shot === lastShot) {
      consecutiveCount++;
    } else {
      consecutiveCount = 1;
      lastShot = shot;
    }
    
    sequence.push(shot);
  }
  
  return sequence;
}

/**
 * Helper para convertir MusicVideoScene a TimelineClip
 */
export function sceneToTimelineClip(scene: MusicVideoScene, layerId: number): any {
  return {
    id: scene.scene_id,
    layerId,
    type: 'image' as const,
    start: scene.start_time,
    duration: scene.duration,
    // Buscar URL en todos los campos posibles para compatibilidad
    url: scene.image_url || (scene as any).generatedImage || (scene as any).publicUrl || (scene as any).firebaseUrl || (scene as any).imageUrl || undefined,
    title: `${scene.shot_type} - ${scene.role}`,
    metadata: {
      scene_id: scene.scene_id,
      shot_type: scene.shot_type,
      role: scene.role,
      music_section: scene.music_section,
      camera_movement: scene.camera_movement,
      lens: scene.lens,
      visual_style: scene.visual_style,
      lighting: scene.lighting
    },
    generated: true,
    generatedImage: true
  };
}
