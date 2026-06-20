/**
 * 🔧 Auto-Cut Engine - Motor de cortes perfectos sincronizados con música
 * 
 * Genera un JSON master con:
 * - Beat Grid: Grilla temporal precisa de todos los beats
 * - Cut Points: Puntos de corte alineados a beats según género
 * - Scene JSON: Escenas con duraciones perfectas y variaciones de plano
 * - Director+DP Integration: Modifica el ritmo de edición según el estilo del director
 * 
 * El resultado es un timeline listo para usar con cortes que
 * caen exactamente en los beats de la música, ajustados por
 * la visión cinematográfica del director seleccionado.
 */

import { logger } from '../utils/logger';
import { 
  AudioAnalysisResult, 
  AudioSection, 
  KeyMoment 
} from './audio-analysis-service';
import { 
  GenreEditingProfile, 
  getEditingProfile,
  mapSectionToCutRuleKey
} from './genre-editing-profiles';
import { 
  generateShotVariations, 
  GeneratedVariation,
  VariationGenerationOptions 
} from './shot-variation-engine';
import { DirectorDPProfile, DirectorEditingStyle } from '../data/types/cinematography';

// ========== INTERFACES ==========

export interface Beat {
  index: number;
  time: number;          // ms desde inicio
  isDownbeat: boolean;   // Primer beat del compás (1 de cada 4)
  section: string;       // intro, verse, chorus, etc.
  energy: string;        // low, medium, high, peak
}

export interface Bar {
  index: number;
  startBeat: number;
  endBeat: number;
  startTime: number;     // ms
  endTime: number;       // ms
  section: string;
}

export interface BeatGrid {
  bpm: number;
  beatDuration: number;  // ms por beat
  totalBeats: number;
  totalDuration: number; // ms
  beats: Beat[];
  bars: Bar[];
}

export interface CutPoint {
  index: number;
  time: number;           // ms exacto del corte
  beatIndex: number;      // En qué beat cae
  section: string;        // Sección musical
  duration: number;       // ms hasta siguiente corte
  durationBeats: number;  // Beats hasta siguiente corte
  transition: 'cut' | 'fade' | 'crossfade' | 'flash' | 'zoom' | 'glitch' | 'shake' | 'dissolve';
  energy: string;         // Nivel de energía
  isKeyMoment: boolean;   // Si coincide con drop/climax
  keyMomentType?: string; // Tipo de momento clave
}

export interface MasterSceneVariation {
  id: string;
  imageUrl: string;
  shotType: string;
  startTime: number;     // ms
  endTime: number;       // ms
  duration: number;      // ms
  beatStart: number;
  beatEnd: number;
}

export interface MasterScene {
  id: string;
  sceneNumber: number;
  startTime: number;       // ms, alineado a beat
  endTime: number;
  duration: number;        // ms
  beatStart: number;
  beatEnd: number;
  section: string;
  energy: string;
  transition: string;
  isKeyMoment: boolean;
  baseImageUrl: string;
  variations: MasterSceneVariation[];
}

export interface MasterSceneJSON {
  projectId: string;
  title: string;
  bpm: number;
  beatDuration: number;
  genre: string;
  genreProfile: string;
  totalDuration: number;  // ms
  totalScenes: number;
  totalVariations: number;
  generatedAt: string;
  scenes: MasterScene[];
}

// ========== BEAT GRID GENERATOR ==========

/**
 * Genera una grilla temporal precisa de todos los beats de la canción
 */
export function generateBeatGrid(analysis: AudioAnalysisResult): BeatGrid {
  const { bpm, duration, sections, beats: rawBeats, downbeats } = analysis;
  
  const beatDuration = 60000 / bpm; // ms por beat
  const totalDurationMs = duration * 1000;
  const totalBeats = Math.ceil(totalDurationMs / beatDuration);
  
  logger.log(`[BeatGrid] 🎵 Generando grid: ${bpm} BPM, ${totalBeats} beats, ${Math.round(beatDuration)}ms/beat`);
  
  const beats: Beat[] = [];
  
  for (let i = 0; i < totalBeats; i++) {
    const time = i * beatDuration;
    const section = getSectionAtTime(time, sections);
    const energy = getEnergyAtTime(time, sections, analysis.keyMoments);
    
    // Usar downbeats del análisis si existen, sino calcular (cada 4 beats)
    const isDownbeat = downbeats?.length > 0
      ? downbeats.some(db => Math.abs(db * 1000 - time) < beatDuration / 2)
      : i % 4 === 0;
    
    beats.push({
      index: i,
      time: time,
      isDownbeat: isDownbeat,
      section: section?.type || 'unknown',
      energy: energy
    });
  }
  
  // Generar compases (bars) - grupos de 4 beats
  const bars: Bar[] = [];
  for (let i = 0; i < totalBeats; i += 4) {
    const startBeat = beats[i];
    const endBeatIndex = Math.min(i + 3, totalBeats - 1);
    const endBeat = beats[endBeatIndex];
    
    bars.push({
      index: Math.floor(i / 4),
      startBeat: i,
      endBeat: Math.min(i + 4, totalBeats),
      startTime: startBeat.time,
      endTime: endBeat.time + beatDuration,
      section: startBeat.section
    });
  }
  
  logger.log(`[BeatGrid] ✅ Grid generado: ${beats.length} beats, ${bars.length} compases`);
  
  return { 
    bpm, 
    beatDuration, 
    totalBeats,
    totalDuration: totalDurationMs,
    beats, 
    bars 
  };
}

/**
 * Obtiene la sección musical en un tiempo dado
 */
function getSectionAtTime(timeMs: number, sections: AudioSection[]): AudioSection | undefined {
  return sections.find(s => 
    timeMs >= s.startTime * 1000 && timeMs < s.endTime * 1000
  );
}

/**
 * Obtiene el nivel de energía en un tiempo dado
 */
function getEnergyAtTime(
  timeMs: number, 
  sections: AudioSection[], 
  keyMoments: KeyMoment[]
): string {
  // Primero revisar key moments (más específico)
  const nearKeyMoment = keyMoments.find(km => 
    Math.abs(km.timestamp * 1000 - timeMs) < 2000 // 2 segundos de ventana
  );
  
  if (nearKeyMoment) {
    if (nearKeyMoment.intensity >= 8) return 'peak';
    if (nearKeyMoment.intensity >= 6) return 'high';
  }
  
  // Luego revisar sección
  const section = getSectionAtTime(timeMs, sections);
  if (section) {
    return section.energy;
  }
  
  return 'medium';
}

// ========== CUT POINTS GENERATOR ==========

/**
 * Genera los puntos exactos de corte basados en género y análisis
 */
export function generateCutPoints(
  beatGrid: BeatGrid,
  analysis: AudioAnalysisResult,
  profile: GenreEditingProfile
): CutPoint[] {
  const { beats, beatDuration } = beatGrid;
  const { sections, keyMoments } = analysis;
  const cutPoints: CutPoint[] = [];
  
  let currentBeat = 0;
  let cutIndex = 0;
  
  logger.log(`[CutPoints] 🎬 Generando puntos de corte con perfil "${profile.genre}"`);
  
  while (currentBeat < beats.length) {
    const beat = beats[currentBeat];
    const section = beat.section;
    const energy = beat.energy;
    
    // Obtener reglas de corte para esta sección
    const sectionKey = mapSectionToCutRuleKey(section);
    const cutRule = profile.cutRules[sectionKey] || profile.cutRules.verse;
    
    // Ajustar beats por corte según energía
    let beatsPerCut = cutRule.beatsPerCut;
    
    // Multiplicador de energía del género
    beatsPerCut = beatsPerCut / profile.energyMultiplier;
    
    // Ajustes adicionales por nivel de energía
    if (energy === 'peak') {
      beatsPerCut = Math.max(0.25, beatsPerCut * 0.5);  // Muy rápido
    } else if (energy === 'high') {
      beatsPerCut = Math.max(0.5, beatsPerCut * 0.75);  // Rápido
    } else if (energy === 'low') {
      beatsPerCut = beatsPerCut * 1.5;  // Más lento
    }
    
    // Verificar si hay key moment cerca
    const keyMoment = keyMoments.find(km => 
      Math.abs(km.timestamp * 1000 - beat.time) < beatDuration * 2
    );
    
    let transition: CutPoint['transition'] = cutRule.transition;
    let isKeyMoment = false;
    let keyMomentType: string | undefined;
    
    if (keyMoment) {
      isKeyMoment = true;
      keyMomentType = keyMoment.type;
      
      // Forzar corte más rápido en key moments
      beatsPerCut = Math.min(beatsPerCut, 1);
      
      // Usar transición sugerida por el momento
      if (keyMoment.suggestedEffect) {
        const effectToTransition: Record<string, CutPoint['transition']> = {
          'flash': 'flash',
          'zoom_in': 'zoom',
          'zoom_out': 'zoom',
          'shake': 'shake',
          'glitch': 'glitch',
          'slow_motion': 'crossfade',
          'fast_cuts': 'cut'
        };
        transition = effectToTransition[keyMoment.suggestedEffect] || transition;
      }
    }
    
    // Redondear a beats enteros o medios
    const durationBeats = Math.max(0.25, Math.round(beatsPerCut * 4) / 4);
    const durationMs = durationBeats * beatDuration;
    
    cutPoints.push({
      index: cutIndex,
      time: beat.time,
      beatIndex: currentBeat,
      section: section,
      duration: durationMs,
      durationBeats: durationBeats,
      transition: transition,
      energy: energy,
      isKeyMoment: isKeyMoment,
      keyMomentType: keyMomentType
    });
    
    currentBeat += Math.ceil(durationBeats);
    cutIndex++;
  }
  
  logger.log(`[CutPoints] ✅ Generados ${cutPoints.length} puntos de corte`);
  
  // Log distribución
  const sectionCounts: Record<string, number> = {};
  cutPoints.forEach(cp => {
    sectionCounts[cp.section] = (sectionCounts[cp.section] || 0) + 1;
  });
  logger.log(`[CutPoints]    Distribución por sección:`, sectionCounts);
  
  return cutPoints;
}

// ========== MASTER JSON GENERATOR ==========

/**
 * FUNCIÓN PRINCIPAL: Genera el JSON Master con escenas y variaciones
 * 
 * 🎬 INTEGRACIÓN DIRECTOR+DP:
 * Si se pasa directorProfile, se usará generateCutPointsWithDirector
 * para aplicar el estilo de edición del director al ritmo de cortes.
 */
export async function generateMasterSceneJSON(
  projectId: string,
  analysis: AudioAnalysisResult,
  baseScenes: Array<{ 
    id: string;
    imageUrl: string; 
    section?: string;
  }>,
  options: {
    title?: string;
    generateVariations?: boolean;
    variationOptions?: VariationGenerationOptions;
    genre?: string;          // Override de género
    mood?: string[];         // Mood para selección de perfil
    directorProfile?: DirectorDPProfile; // 🎬 Perfil de director para estilo de edición
  } = {}
): Promise<MasterSceneJSON> {
  
  const {
    title = 'Music Video',
    generateVariations = true,
    variationOptions = {},
    genre,
    mood = [],
    directorProfile
  } = options;

  logger.log(`[MasterJSON] 🎬 Generando Master Scene JSON para proyecto: ${projectId}`);
  logger.log(`[MasterJSON]    Escenas base: ${baseScenes.length}`);
  logger.log(`[MasterJSON]    Generar variaciones: ${generateVariations}`);
  if (directorProfile) {
    logger.log(`[MasterJSON]    🎥 Director: ${directorProfile.director.name} + ${directorProfile.cinematographer.name}`);
    logger.log(`[MasterJSON]    📊 Pace modifier: ×${directorProfile.editing_style?.pace_modifier || 1.0}`);
  }

  // 1. Obtener perfil de edición por género
  const detectedGenre = genre || analysis.genre || 'pop';
  const detectedMood = mood.length > 0 ? mood : analysis.mood || [];
  const profile = getEditingProfile(detectedGenre, detectedMood);
  
  logger.log(`[MasterJSON]    Perfil de género: ${profile.genre}`);
  logger.log(`[MasterJSON]    Estilo: ${profile.styleDescription}`);

  // 2. Generar Beat Grid
  const beatGrid = generateBeatGrid(analysis);
  
  // 3. Generar Cut Points (CON o SIN director)
  let cutPoints: CutPoint[];
  if (directorProfile) {
    // 🎬 Usar estilo de edición del director
    cutPoints = generateCutPointsWithDirector(beatGrid, analysis, profile, directorProfile);
    logger.log(`[MasterJSON]    ✅ Aplicado estilo de edición de ${directorProfile.director.name}`);
  } else {
    // Estilo por defecto basado solo en género
    cutPoints = generateCutPoints(beatGrid, analysis, profile);
  }

  // 4. Crear escenas con variaciones
  const scenes: MasterScene[] = [];
  let sceneIndex = 0;
  let totalVariations = 0;
  
  for (const cutPoint of cutPoints) {
    // Seleccionar imagen base (rotar entre las disponibles)
    const baseScene = baseScenes[sceneIndex % baseScenes.length];
    
    // Generar variaciones de plano si está habilitado
    let variations: MasterSceneVariation[] = [];
    
    if (generateVariations && cutPoint.durationBeats >= 0.5) {
      try {
        const shotVariations = await generateShotVariations(
          baseScene.imageUrl,
          cutPoint.section,
          cutPoint.energy,
          profile,
          cutPoint.durationBeats,
          beatGrid.beatDuration,
          {
            maxVariations: 4,
            minVariations: 1,
            includeOriginal: true,
            ...variationOptions
          }
        );
        
        let variationStartTime = cutPoint.time;
        let variationIndex = 0;
        
        variations = shotVariations.map(v => {
          const result: MasterSceneVariation = {
            id: `scene_${sceneIndex + 1}_var_${variationIndex + 1}`,
            imageUrl: v.imageUrl,
            shotType: v.type,
            startTime: variationStartTime,
            endTime: variationStartTime + v.durationMs,
            duration: v.durationMs,
            beatStart: cutPoint.beatIndex + v.beatStart,
            beatEnd: cutPoint.beatIndex + v.beatEnd
          };
          variationStartTime += v.durationMs;
          variationIndex++;
          return result;
        });
        
        totalVariations += variations.length;
      } catch (error: any) {
        logger.warn(`[MasterJSON] ⚠️ Error generando variaciones para escena ${sceneIndex + 1}: ${error.message}`);
        // Fallback: usar imagen original
        variations = [{
          id: `scene_${sceneIndex + 1}_var_1`,
          imageUrl: baseScene.imageUrl,
          shotType: 'original',
          startTime: cutPoint.time,
          endTime: cutPoint.time + cutPoint.duration,
          duration: cutPoint.duration,
          beatStart: cutPoint.beatIndex,
          beatEnd: cutPoint.beatIndex + cutPoint.durationBeats
        }];
        totalVariations += 1;
      }
    } else {
      // Sin variaciones, usar imagen original
      variations = [{
        id: `scene_${sceneIndex + 1}_var_1`,
        imageUrl: baseScene.imageUrl,
        shotType: 'original',
        startTime: cutPoint.time,
        endTime: cutPoint.time + cutPoint.duration,
        duration: cutPoint.duration,
        beatStart: cutPoint.beatIndex,
        beatEnd: cutPoint.beatIndex + cutPoint.durationBeats
      }];
      totalVariations += 1;
    }
    
    scenes.push({
      id: `scene_${sceneIndex + 1}`,
      sceneNumber: sceneIndex + 1,
      startTime: cutPoint.time,
      endTime: cutPoint.time + cutPoint.duration,
      duration: cutPoint.duration,
      beatStart: cutPoint.beatIndex,
      beatEnd: cutPoint.beatIndex + cutPoint.durationBeats,
      section: cutPoint.section,
      energy: cutPoint.energy,
      transition: cutPoint.transition,
      isKeyMoment: cutPoint.isKeyMoment,
      baseImageUrl: baseScene.imageUrl,
      variations: variations
    });
    
    sceneIndex++;
    
    // Log progreso cada 10 escenas
    if (sceneIndex % 10 === 0) {
      logger.log(`[MasterJSON]    Procesadas ${sceneIndex}/${cutPoints.length} escenas...`);
    }
  }

  const masterJSON: MasterSceneJSON = {
    projectId,
    title,
    bpm: beatGrid.bpm,
    beatDuration: beatGrid.beatDuration,
    genre: detectedGenre,
    genreProfile: profile.genre,
    totalDuration: beatGrid.totalDuration,
    totalScenes: scenes.length,
    totalVariations: totalVariations,
    generatedAt: new Date().toISOString(),
    scenes
  };

  logger.log(`[MasterJSON] ✅ Master JSON generado:`);
  logger.log(`[MasterJSON]    Total escenas: ${scenes.length}`);
  logger.log(`[MasterJSON]    Total variaciones: ${totalVariations}`);
  logger.log(`[MasterJSON]    Duración: ${Math.round(beatGrid.totalDuration / 1000)}s`);

  return masterJSON;
}

/**
 * Genera solo los cut points sin variaciones de imagen
 * (útil para preview rápido)
 */
export function generateCutPointsOnly(
  analysis: AudioAnalysisResult,
  options: {
    genre?: string;
    mood?: string[];
  } = {}
): { beatGrid: BeatGrid; cutPoints: CutPoint[]; profile: GenreEditingProfile } {
  
  const { genre, mood = [] } = options;
  const detectedGenre = genre || analysis.genre || 'pop';
  const profile = getEditingProfile(detectedGenre, mood);
  const beatGrid = generateBeatGrid(analysis);
  const cutPoints = generateCutPoints(beatGrid, analysis, profile);
  
  return { beatGrid, cutPoints, profile };
}

/**
 * Calcula estadísticas del timeline
 */
export function calculateTimelineStats(masterJSON: MasterSceneJSON): {
  avgSceneDuration: number;
  avgVariationsPerScene: number;
  sectionDistribution: Record<string, number>;
  energyDistribution: Record<string, number>;
  keyMomentsCount: number;
  transitionCounts: Record<string, number>;
} {
  const scenes = masterJSON.scenes;
  
  const avgSceneDuration = scenes.reduce((sum, s) => sum + s.duration, 0) / scenes.length;
  const avgVariationsPerScene = masterJSON.totalVariations / masterJSON.totalScenes;
  
  const sectionDistribution: Record<string, number> = {};
  const energyDistribution: Record<string, number> = {};
  const transitionCounts: Record<string, number> = {};
  let keyMomentsCount = 0;
  
  scenes.forEach(scene => {
    sectionDistribution[scene.section] = (sectionDistribution[scene.section] || 0) + 1;
    energyDistribution[scene.energy] = (energyDistribution[scene.energy] || 0) + 1;
    transitionCounts[scene.transition] = (transitionCounts[scene.transition] || 0) + 1;
    if (scene.isKeyMoment) keyMomentsCount++;
  });
  
  return {
    avgSceneDuration: Math.round(avgSceneDuration),
    avgVariationsPerScene: Math.round(avgVariationsPerScene * 10) / 10,
    sectionDistribution,
    energyDistribution,
    keyMomentsCount,
    transitionCounts
  };
}

/**
 * Convierte MasterSceneJSON al formato esperado por el timeline del frontend
 */
export function convertToTimelineFormat(masterJSON: MasterSceneJSON): Array<{
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  imageUrl: string;
  section: string;
  transition: string;
  beatInfo: {
    beatStart: number;
    beatEnd: number;
    bpm: number;
  };
  variations: Array<{
    id: string;
    imageUrl: string;
    shotType: string;
    startTime: number;
    duration: number;
  }>;
}> {
  return masterJSON.scenes.map(scene => ({
    id: scene.id,
    startTime: scene.startTime / 1000, // Convertir a segundos
    endTime: scene.endTime / 1000,
    duration: scene.duration / 1000,
    imageUrl: scene.baseImageUrl,
    section: scene.section,
    transition: scene.transition,
    beatInfo: {
      beatStart: scene.beatStart,
      beatEnd: scene.beatEnd,
      bpm: masterJSON.bpm
    },
    variations: scene.variations.map(v => ({
      id: v.id,
      imageUrl: v.imageUrl,
      shotType: v.shotType,
      startTime: v.startTime / 1000,
      duration: v.duration / 1000
    }))
  }));
}

// ========== DIRECTOR+DP EDITING INTEGRATION ==========

/**
 * 🎬 Apply Director's editing style to cut duration calculations
 * 
 * This function modifies the beatsPerCut based on the director's editing philosophy:
 * - Spike Jonze: Patient, breathing edits → slower cuts
 * - Edgar Wright: Hyper-kinetic → much faster cuts  
 * - Villeneuve: Epic contemplation → very slow cuts
 * - Hype Williams: Hip-hop energy → fast luxury cuts
 * etc.
 */
export function applyDirectorEditingStyle(
  baseBeatsPerCut: number,
  section: string,
  energy: string,
  isEmotionalMoment: boolean,
  directorProfile?: DirectorDPProfile
): {
  modifiedBeatsPerCut: number;
  transitionOverride?: string;
  beatAlignment: 'downbeat' | 'any_beat' | 'half_beat' | 'off_beat';
} {
  // If no director profile, return base values
  if (!directorProfile?.editing_style) {
    return {
      modifiedBeatsPerCut: baseBeatsPerCut,
      beatAlignment: 'downbeat'
    };
  }

  const style = directorProfile.editing_style;
  let modifiedBeats = baseBeatsPerCut;

  // 1. Apply pace_modifier (global tempo adjustment)
  //    pace_modifier > 1 = slower cuts
  //    pace_modifier < 1 = faster cuts
  modifiedBeats = modifiedBeats * style.pace_modifier;

  // 2. Apply section-specific overrides
  const sectionKey = section.toLowerCase() as keyof typeof style.section_beat_overrides;
  if (style.section_beat_overrides?.[sectionKey]) {
    modifiedBeats = modifiedBeats * style.section_beat_overrides[sectionKey];
  }

  // 3. Apply hold_on_emotion (extend duration for emotional close-ups)
  if (style.hold_on_emotion && isEmotionalMoment && style.emotion_hold_multiplier) {
    modifiedBeats = modifiedBeats * style.emotion_hold_multiplier;
    logger.log(`[DirectorStyle] 💭 ${directorProfile.director.name}: Holding on emotional moment (×${style.emotion_hold_multiplier})`);
  }

  // 4. Apply energy acceleration (speed up on high energy)
  if (style.accelerate_on_energy && (energy === 'high' || energy === 'peak')) {
    const acceleration = style.energy_acceleration || 0.7;
    modifiedBeats = modifiedBeats * acceleration;
    logger.log(`[DirectorStyle] ⚡ ${directorProfile.director.name}: Energy acceleration (×${acceleration})`);
  }

  // 5. Enforce minimum/maximum duration limits
  const beatDurationEstimate = 500; // ~120 BPM average
  const minBeats = (style.minimum_cut_duration * 1000) / beatDurationEstimate;
  const maxBeats = (style.maximum_cut_duration * 1000) / beatDurationEstimate;
  
  modifiedBeats = Math.max(minBeats, Math.min(maxBeats, modifiedBeats));

  // 6. Get transition preference for this section
  const transitionOverride = style.transition_preferences?.[sectionKey];

  logger.log(`[DirectorStyle] 🎬 ${directorProfile.director.name}: ${section} | Base ${baseBeatsPerCut.toFixed(2)} → Modified ${modifiedBeats.toFixed(2)} beats/cut`);

  return {
    modifiedBeatsPerCut: modifiedBeats,
    transitionOverride,
    beatAlignment: style.beat_alignment || 'downbeat'
  };
}

/**
 * 🎬 Generate cut points with Director+DP influence
 * 
 * Extended version of generateCutPoints that incorporates the
 * director's editing philosophy into the cut timing.
 */
export function generateCutPointsWithDirector(
  beatGrid: BeatGrid,
  analysis: AudioAnalysisResult,
  profile: GenreEditingProfile,
  directorProfile?: DirectorDPProfile
): CutPoint[] {
  const { beats, beatDuration } = beatGrid;
  const { sections, keyMoments } = analysis;
  const cutPoints: CutPoint[] = [];

  let currentBeat = 0;
  let cutIndex = 0;

  const directorName = directorProfile?.director.name || 'Default';
  logger.log(`[CutPoints] 🎬 Generating cuts with genre "${profile.genre}" + Director "${directorName}"`);

  while (currentBeat < beats.length) {
    const beat = beats[currentBeat];
    const section = beat.section;
    const energy = beat.energy;

    // Get base cut rules from genre profile
    const sectionKey = mapSectionToCutRuleKey(section);
    const cutRule = profile.cutRules[sectionKey] || profile.cutRules.verse;
    
    // Start with genre beatsPerCut
    let beatsPerCut = cutRule.beatsPerCut / profile.energyMultiplier;

    // Apply basic energy adjustments
    if (energy === 'peak') {
      beatsPerCut = Math.max(0.25, beatsPerCut * 0.5);
    } else if (energy === 'high') {
      beatsPerCut = Math.max(0.5, beatsPerCut * 0.75);
    } else if (energy === 'low') {
      beatsPerCut = beatsPerCut * 1.5;
    }

    // Check for key moments
    const keyMoment = keyMoments.find(km => 
      Math.abs(km.timestamp * 1000 - beat.time) < beatDuration * 2
    );

    let transition: CutPoint['transition'] = cutRule.transition;
    let isKeyMoment = false;
    let keyMomentType: string | undefined;
    let isEmotionalMoment = false;

    if (keyMoment) {
      isKeyMoment = true;
      keyMomentType = keyMoment.type;
      
      // Check if it's an emotional moment (for director hold logic)
      isEmotionalMoment = ['emotional', 'bridge', 'breakdown', 'quiet'].includes(keyMoment.type);

      // Force faster cuts on key moments (unless director overrides)
      if (!directorProfile?.editing_style?.hold_on_emotion || !isEmotionalMoment) {
        beatsPerCut = Math.min(beatsPerCut, 1);
      }

      // Map effect to transition
      if (keyMoment.suggestedEffect) {
        const effectToTransition: Record<string, CutPoint['transition']> = {
          'flash': 'flash',
          'zoom_in': 'zoom',
          'zoom_out': 'zoom',
          'shake': 'shake',
          'glitch': 'glitch',
          'slow_motion': 'crossfade',
          'fast_cuts': 'cut'
        };
        transition = effectToTransition[keyMoment.suggestedEffect] || transition;
      }
    }

    // 🎬 APPLY DIRECTOR'S EDITING STYLE
    const directorAdjustment = applyDirectorEditingStyle(
      beatsPerCut,
      section,
      energy,
      isEmotionalMoment,
      directorProfile
    );

    beatsPerCut = directorAdjustment.modifiedBeatsPerCut;

    // Director can override transition for section
    if (directorAdjustment.transitionOverride) {
      const transitionMap: Record<string, CutPoint['transition']> = {
        'cut': 'cut',
        'fade': 'fade',
        'crossfade': 'crossfade',
        'flash': 'flash',
        'dissolve': 'crossfade',
        'smash': 'cut',
        'whip': 'cut',
        'iris': 'fade',
        'chapter_card': 'fade',
        'wipe': 'fade',
        'match_cut': 'cut',
        'crash_zoom': 'zoom'
      };
      transition = transitionMap[directorAdjustment.transitionOverride] || transition;
    }

    // Round to beat alignment based on director preference
    let durationBeats: number;
    switch (directorAdjustment.beatAlignment) {
      case 'half_beat':
        durationBeats = Math.max(0.5, Math.round(beatsPerCut * 2) / 2);
        break;
      case 'any_beat':
        durationBeats = Math.max(0.25, Math.round(beatsPerCut * 4) / 4);
        break;
      case 'off_beat':
        // Offset by half beat for cosmic/jazz timing
        durationBeats = Math.max(0.5, Math.round(beatsPerCut * 2) / 2 + 0.25);
        break;
      case 'downbeat':
      default:
        durationBeats = Math.max(1, Math.round(beatsPerCut));
        break;
    }

    const durationMs = durationBeats * beatDuration;

    cutPoints.push({
      index: cutIndex,
      time: beat.time,
      beatIndex: currentBeat,
      section: section,
      duration: durationMs,
      durationBeats: durationBeats,
      transition: transition,
      energy: energy,
      isKeyMoment: isKeyMoment,
      keyMomentType: keyMomentType
    });

    currentBeat += Math.max(1, Math.floor(durationBeats));
    cutIndex++;
  }

  logger.log(`[CutPoints] ✅ Generated ${cutPoints.length} cut points with ${directorName} editing style`);
  return cutPoints;
}

/**
 * 🎬 Get the visual summary of director's editing approach
 */
export function getDirectorEditingSummary(directorProfile?: DirectorDPProfile): string {
  if (!directorProfile?.editing_style) {
    return 'Default editing style - genre-based pacing';
  }

  const style = directorProfile.editing_style;
  const pace = style.pace_modifier;
  
  let paceDescription: string;
  if (pace < 0.6) paceDescription = 'ULTRA-FAST (hyper-kinetic)';
  else if (pace < 0.8) paceDescription = 'FAST (energetic)';
  else if (pace < 1.0) paceDescription = 'SLIGHTLY FAST';
  else if (pace === 1.0) paceDescription = 'PRECISE (metronomic)';
  else if (pace < 1.2) paceDescription = 'SLIGHTLY SLOW';
  else if (pace < 1.4) paceDescription = 'SLOW (contemplative)';
  else paceDescription = 'VERY SLOW (epic)';

  return `
🎬 ${directorProfile.director.name} + ${directorProfile.cinematographer.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Philosophy: "${style.philosophy}"
⏱️  Pacing: ${paceDescription} (×${pace})
⏭️  Cut Range: ${style.minimum_cut_duration}s - ${style.maximum_cut_duration}s
🎯 Beat Alignment: ${style.beat_alignment}
💭 Hold on Emotion: ${style.hold_on_emotion ? `Yes (×${style.emotion_hold_multiplier})` : 'No'}
⚡ Energy Acceleration: ${style.accelerate_on_energy ? `Yes (×${style.energy_acceleration})` : 'No'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}

