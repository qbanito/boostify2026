/**
 * 🎬 Auto-Edit API Routes - Endpoints para edición automática de video musical
 * 
 * Endpoints:
 * - POST /api/auto-edit/generate-master - Genera JSON master con cortes perfectos
 * - POST /api/auto-edit/preview-cuts - Preview rápido de puntos de corte
 * - GET /api/auto-edit/genres - Lista géneros disponibles
 * - GET /api/auto-edit/genre/:genre - Info de un género específico
 * - GET /api/auto-edit/directors - Lista directores disponibles con sus estilos de edición
 * 
 * 🎥 INTEGRACIÓN DIRECTOR+DP:
 * Los estilos de edición de cada director influyen en:
 * - pace_modifier: Tempo de cortes (0.5 = rápido, 1.5 = lento)
 * - section_beat_overrides: Ritmo por sección
 * - hold_on_emotion: Si mantener más tiempo en close-ups emocionales
 * - beat_alignment: En qué beats cortar (downbeat, any_beat, etc.)
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { analyzeAudio, AudioAnalysisResult } from '../services/audio-analysis-service';
import { 
  generateMasterSceneJSON, 
  generateCutPointsOnly,
  calculateTimelineStats,
  convertToTimelineFormat,
  generateCutPointsWithDirector,
  applyDirectorEditingStyle,
  getDirectorEditingSummary,
  BeatGrid,
  CutPoint
} from '../services/auto-cut-engine';
import { 
  getEditingProfile, 
  getAvailableGenres,
  getGenreStyleDescription,
  getRecommendedSceneDuration,
  GENRE_PROFILES
} from '../services/genre-editing-profiles';
import { 
  getDirectorDPProfile, 
  getAllDirectorDPProfiles,
  getProfileOrDefault 
} from '../services/cinematography-service';

const router = Router();

// Cache simple en memoria para análisis de audio
const analysisCache = new Map<string, AudioAnalysisResult>();

/**
 * POST /api/auto-edit/generate-master
 * Genera el JSON master completo con escenas y variaciones de plano
 * 
 * Body:
 * - projectId: string (requerido)
 * - audioUrl: string (requerido) - URL del audio a analizar
 * - baseScenes: Array<{ id: string, imageUrl: string, section?: string }> (requerido)
 * - title?: string
 * - genre?: string - Override de género detectado
 * - mood?: string[] - Mood para ajustar perfil
 * - directorName?: string - Nombre del director para aplicar su estilo de edición
 * - generateVariations?: boolean - Si generar variaciones de plano (default: true)
 * - maxVariationsPerScene?: number (default: 4)
 */
router.post('/generate-master', async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      audioUrl,
      baseScenes,
      title,
      genre,
      mood,
      directorName,
      generateVariations = true,
      maxVariationsPerScene = 4
    } = req.body;

    // Validaciones
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    if (!audioUrl) {
      return res.status(400).json({ error: 'audioUrl is required' });
    }
    if (!baseScenes || !Array.isArray(baseScenes) || baseScenes.length === 0) {
      return res.status(400).json({ error: 'baseScenes array is required and must not be empty' });
    }

    // Obtener perfil de director si se especificó
    const directorProfile = directorName ? getDirectorDPProfile(directorName) : undefined;

    logger.log(`[AutoEdit] 🎬 Generando Master JSON para proyecto: ${projectId}`);
    logger.log(`[AutoEdit]    Audio URL: ${audioUrl.substring(0, 60)}...`);
    logger.log(`[AutoEdit]    Escenas base: ${baseScenes.length}`);
    logger.log(`[AutoEdit]    Género override: ${genre || 'auto-detect'}`);
    logger.log(`[AutoEdit]    Director: ${directorProfile?.director.name || 'default'}`);
    if (directorProfile?.editing_style) {
      logger.log(`[AutoEdit]    Pace modifier: ×${directorProfile.editing_style.pace_modifier}`);
    }

    // 1. Obtener o generar análisis de audio
    let analysis: AudioAnalysisResult;
    
    if (analysisCache.has(audioUrl)) {
      logger.log('[AutoEdit]    ✅ Usando análisis en cache');
      analysis = analysisCache.get(audioUrl)!;
    } else {
      logger.log('[AutoEdit]    🎵 Analizando audio con fal-ai...');
      analysis = await analyzeAudio(audioUrl);
      analysisCache.set(audioUrl, analysis);
    }

    // 2. Generar Master Scene JSON (con director si especificado)
    const masterJSON = await generateMasterSceneJSON(
      projectId,
      analysis,
      baseScenes,
      {
        title: title || 'Music Video',
        generateVariations,
        genre,
        mood: mood || [],
        directorProfile, // 🎬 Nuevo: pasar perfil de director
        variationOptions: {
          maxVariations: maxVariationsPerScene,
          minVariations: 1,
          includeOriginal: true
        }
      }
    );

    // 3. Calcular estadísticas
    const stats = calculateTimelineStats(masterJSON);

    // 4. Convertir a formato de timeline (para frontend)
    const timelineScenes = convertToTimelineFormat(masterJSON);

    logger.log(`[AutoEdit] ✅ Master JSON generado exitosamente`);
    logger.log(`[AutoEdit]    Escenas: ${masterJSON.totalScenes}`);
    logger.log(`[AutoEdit]    Variaciones totales: ${masterJSON.totalVariations}`);
    logger.log(`[AutoEdit]    Duración: ${Math.round(masterJSON.totalDuration / 1000)}s`);

    res.status(200).json({
      success: true,
      masterJSON,
      timelineScenes,
      stats,
      directorApplied: directorProfile ? {
        name: directorProfile.director.name,
        cinematographer: directorProfile.cinematographer.name,
        paceModifier: directorProfile.editing_style?.pace_modifier,
        editingSummary: getDirectorEditingSummary(directorProfile)
      } : null,
      audioAnalysis: {
        bpm: analysis.bpm,
        genre: analysis.genre,
        mood: analysis.mood,
        sectionsCount: analysis.sections.length,
        keyMomentsCount: analysis.keyMoments.length
      }
    });

  } catch (error: any) {
    logger.error('[AutoEdit] ❌ Error generando Master JSON:', error.message);
    res.status(500).json({
      error: 'Error generating master scene JSON',
      details: error.message
    });
  }
});

/**
 * POST /api/auto-edit/preview-cuts
 * Genera preview rápido de puntos de corte sin generar variaciones
 * Útil para mostrar al usuario antes de generar imágenes
 * 
 * Body:
 * - audioUrl: string (requerido)
 * - genre?: string - Override de género
 * - mood?: string[]
 */
router.post('/preview-cuts', async (req: Request, res: Response) => {
  try {
    const { audioUrl, genre, mood } = req.body;

    if (!audioUrl) {
      return res.status(400).json({ error: 'audioUrl is required' });
    }

    logger.log(`[AutoEdit] 🔍 Generando preview de cortes...`);

    // 1. Obtener o generar análisis de audio
    let analysis: AudioAnalysisResult;
    
    if (analysisCache.has(audioUrl)) {
      analysis = analysisCache.get(audioUrl)!;
    } else {
      analysis = await analyzeAudio(audioUrl);
      analysisCache.set(audioUrl, analysis);
    }

    // 2. Generar solo cut points (sin imágenes)
    const { beatGrid, cutPoints, profile } = generateCutPointsOnly(analysis, {
      genre,
      mood: mood || []
    });

    // 3. Agrupar cortes por sección para visualización
    const cutsBySection: Record<string, CutPoint[]> = {};
    cutPoints.forEach(cp => {
      if (!cutsBySection[cp.section]) {
        cutsBySection[cp.section] = [];
      }
      cutsBySection[cp.section].push(cp);
    });

    // 4. Calcular distribución
    const distribution = {
      bySection: Object.fromEntries(
        Object.entries(cutsBySection).map(([section, cuts]) => [section, cuts.length])
      ),
      byEnergy: cutPoints.reduce((acc, cp) => {
        acc[cp.energy] = (acc[cp.energy] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byTransition: cutPoints.reduce((acc, cp) => {
        acc[cp.transition] = (acc[cp.transition] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      keyMoments: cutPoints.filter(cp => cp.isKeyMoment).length
    };

    logger.log(`[AutoEdit] ✅ Preview generado: ${cutPoints.length} cortes`);

    res.status(200).json({
      success: true,
      preview: {
        bpm: beatGrid.bpm,
        beatDuration: beatGrid.beatDuration,
        totalBeats: beatGrid.totalBeats,
        totalDuration: beatGrid.totalDuration,
        totalCuts: cutPoints.length,
        avgCutDuration: Math.round(
          cutPoints.reduce((sum, cp) => sum + cp.duration, 0) / cutPoints.length
        ),
        profile: {
          genre: profile.genre,
          styleDescription: profile.styleDescription,
          energyMultiplier: profile.energyMultiplier
        },
        distribution
      },
      cutPoints: cutPoints.map(cp => ({
        time: cp.time,
        timeFormatted: formatTime(cp.time),
        beatIndex: cp.beatIndex,
        section: cp.section,
        duration: cp.duration,
        durationBeats: cp.durationBeats,
        transition: cp.transition,
        energy: cp.energy,
        isKeyMoment: cp.isKeyMoment,
        keyMomentType: cp.keyMomentType
      })),
      audioAnalysis: {
        bpm: analysis.bpm,
        key: analysis.key,
        genre: analysis.genre,
        mood: analysis.mood,
        sections: analysis.sections.map(s => ({
          type: s.type,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.duration,
          energy: s.energy
        })),
        keyMoments: analysis.keyMoments.map(km => ({
          timestamp: km.timestamp,
          type: km.type,
          intensity: km.intensity
        }))
      }
    });

  } catch (error: any) {
    logger.error('[AutoEdit] ❌ Error generando preview:', error.message);
    res.status(500).json({
      error: 'Error generating cut points preview',
      details: error.message
    });
  }
});

/**
 * GET /api/auto-edit/genres
 * Lista todos los géneros disponibles con sus descripciones
 */
router.get('/genres', (_req: Request, res: Response) => {
  const genres = getAvailableGenres().map(genre => ({
    id: genre,
    name: GENRE_PROFILES[genre].genre,
    aliases: GENRE_PROFILES[genre].aliases,
    styleDescription: GENRE_PROFILES[genre].styleDescription,
    energyMultiplier: GENRE_PROFILES[genre].energyMultiplier
  }));

  res.status(200).json({
    success: true,
    genres,
    count: genres.length
  });
});

/**
 * GET /api/auto-edit/genre/:genre
 * Obtiene información detallada de un género específico
 */
router.get('/genre/:genre', (req: Request, res: Response) => {
  const { genre } = req.params;
  
  try {
    const profile = getEditingProfile(genre, []);
    
    res.status(200).json({
      success: true,
      profile: {
        genre: profile.genre,
        aliases: profile.aliases,
        styleDescription: profile.styleDescription,
        energyMultiplier: profile.energyMultiplier,
        cutRules: profile.cutRules,
        transitionWeights: profile.transitionWeights,
        cutTriggerInstruments: profile.cutTriggerInstruments,
        shotVariations: {
          performance: profile.shotVariations.performance.map(s => ({
            type: s.type,
            weight: s.weight,
            durationRange: `${s.minDuration}-${s.maxDuration} beats`
          })),
          bRoll: profile.shotVariations.bRoll.map(s => ({
            type: s.type,
            weight: s.weight,
            durationRange: `${s.minDuration}-${s.maxDuration} beats`
          })),
          climax: profile.shotVariations.climax.map(s => ({
            type: s.type,
            weight: s.weight,
            durationRange: `${s.minDuration}-${s.maxDuration} beats`
          }))
        }
      }
    });
  } catch (error: any) {
    res.status(404).json({
      error: 'Genre not found',
      availableGenres: getAvailableGenres()
    });
  }
});

/**
 * POST /api/auto-edit/recommended-duration
 * Calcula la duración recomendada de escena para un género y sección
 * 
 * Body:
 * - genre: string
 * - section: string (intro, verse, chorus, etc.)
 * - bpm: number
 * - mood?: string[]
 */
router.post('/recommended-duration', (req: Request, res: Response) => {
  const { genre, section, bpm, mood } = req.body;

  if (!genre || !section || !bpm) {
    return res.status(400).json({ 
      error: 'genre, section, and bpm are required' 
    });
  }

  const recommendation = getRecommendedSceneDuration(
    genre, 
    section, 
    bpm, 
    mood || []
  );

  res.status(200).json({
    success: true,
    genre,
    section,
    bpm,
    recommendation: {
      beats: recommendation.beats,
      milliseconds: recommendation.milliseconds,
      seconds: Math.round(recommendation.milliseconds / 100) / 10
    }
  });
});

/**
 * POST /api/auto-edit/analyze-audio
 * Analiza un audio y cachea el resultado
 * 
 * Body:
 * - audioUrl: string
 */
router.post('/analyze-audio', async (req: Request, res: Response) => {
  try {
    const { audioUrl } = req.body;

    if (!audioUrl) {
      return res.status(400).json({ error: 'audioUrl is required' });
    }

    logger.log(`[AutoEdit] 🎵 Analizando audio...`);

    // Verificar cache
    if (analysisCache.has(audioUrl)) {
      logger.log('[AutoEdit] ✅ Retornando análisis en cache');
      const cached = analysisCache.get(audioUrl)!;
      return res.status(200).json({
        success: true,
        cached: true,
        analysis: cached
      });
    }

    // Analizar
    const analysis = await analyzeAudio(audioUrl);
    analysisCache.set(audioUrl, analysis);

    logger.log(`[AutoEdit] ✅ Audio analizado: ${analysis.bpm} BPM, ${analysis.genre}`);

    res.status(200).json({
      success: true,
      cached: false,
      analysis
    });

  } catch (error: any) {
    logger.error('[AutoEdit] ❌ Error analizando audio:', error.message);
    res.status(500).json({
      error: 'Error analyzing audio',
      details: error.message
    });
  }
});

/**
 * DELETE /api/auto-edit/cache
 * Limpia la cache de análisis de audio
 */
router.delete('/cache', (_req: Request, res: Response) => {
  const count = analysisCache.size;
  analysisCache.clear();
  
  res.status(200).json({
    success: true,
    message: `Cache cleared: ${count} entries removed`
  });
});

// =============================================================================
// DIRECTOR+DP EDITING STYLE ENDPOINTS
// =============================================================================

/**
 * GET /api/auto-edit/directors
 * Lista todos los directores disponibles con sus estilos de edición
 */
router.get('/directors', (_req: Request, res: Response) => {
  try {
    const profiles = getAllDirectorDPProfiles();
    
    const directors = profiles.map(profile => ({
      id: profile.id,
      director: profile.director.name,
      cinematographer: profile.cinematographer.name,
      editing_style: profile.editing_style ? {
        philosophy: profile.editing_style.philosophy,
        pace_modifier: profile.editing_style.pace_modifier,
        pace_description: getPaceDescription(profile.editing_style.pace_modifier),
        minimum_cut_duration: profile.editing_style.minimum_cut_duration,
        maximum_cut_duration: profile.editing_style.maximum_cut_duration,
        beat_alignment: profile.editing_style.beat_alignment,
        hold_on_emotion: profile.editing_style.hold_on_emotion,
        accelerate_on_energy: profile.editing_style.accelerate_on_energy
      } : null,
      best_for_genres: profile.collaboration.best_for_genres,
      visual_signature: profile.collaboration.combined_signature
    }));

    res.status(200).json({
      success: true,
      count: directors.length,
      directors
    });
  } catch (error: any) {
    logger.error('[AutoEdit] ❌ Error obteniendo directores:', error.message);
    res.status(500).json({
      error: 'Error getting directors',
      details: error.message
    });
  }
});

/**
 * GET /api/auto-edit/director/:name
 * Obtiene el perfil de edición de un director específico
 */
router.get('/director/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const profile = getDirectorDPProfile(name);

    if (!profile) {
      return res.status(404).json({
        error: 'Director not found',
        available: getAllDirectorDPProfiles().map(p => p.director.name)
      });
    }

    const summary = getDirectorEditingSummary(profile);

    res.status(200).json({
      success: true,
      director: {
        id: profile.id,
        name: profile.director.name,
        cinematographer: profile.cinematographer.name,
        visual_philosophy: profile.director.visual_philosophy,
        signature_techniques: profile.director.signature_techniques
      },
      editing_style: profile.editing_style,
      editing_summary: summary,
      best_for_genres: profile.collaboration.best_for_genres,
      synergy_score: profile.collaboration.synergy_score
    });
  } catch (error: any) {
    logger.error('[AutoEdit] ❌ Error obteniendo director:', error.message);
    res.status(500).json({
      error: 'Error getting director',
      details: error.message
    });
  }
});

/**
 * POST /api/auto-edit/preview-cuts-with-director
 * Preview de cortes con estilo de director aplicado
 */
router.post('/preview-cuts-with-director', async (req: Request, res: Response) => {
  try {
    const { audioUrl, genre, mood, directorName } = req.body;

    if (!audioUrl) {
      return res.status(400).json({ error: 'audioUrl is required' });
    }

    logger.log(`[AutoEdit] 🎬 Preview con director: ${directorName || 'default'}`);

    // 1. Obtener análisis de audio
    let analysis: AudioAnalysisResult;
    if (analysisCache.has(audioUrl)) {
      analysis = analysisCache.get(audioUrl)!;
    } else {
      analysis = await analyzeAudio(audioUrl);
      analysisCache.set(audioUrl, analysis);
    }

    // 2. Obtener perfil de director
    const directorProfile = directorName ? getDirectorDPProfile(directorName) : undefined;
    const genreProfile = getEditingProfile(genre || analysis.genre, mood || analysis.mood);

    // 3. Generar beat grid
    const { generateBeatGrid } = await import('../services/auto-cut-engine');
    const beatGrid = generateBeatGrid(analysis);

    // 4. Generar cut points CON estilo de director
    const cutPoints = generateCutPointsWithDirector(
      beatGrid,
      analysis,
      genreProfile,
      directorProfile
    );

    // 5. Comparar con cortes sin director (para mostrar diferencia)
    const { generateCutPoints } = await import('../services/auto-cut-engine');
    const cutPointsDefault = generateCutPoints(beatGrid, analysis, genreProfile);

    // 6. Calcular estadísticas comparativas
    const avgDurationWithDirector = cutPoints.reduce((sum, cp) => sum + cp.duration, 0) / cutPoints.length;
    const avgDurationDefault = cutPointsDefault.reduce((sum, cp) => sum + cp.duration, 0) / cutPointsDefault.length;

    res.status(200).json({
      success: true,
      directorApplied: directorProfile?.director.name || null,
      editingSummary: directorProfile ? getDirectorEditingSummary(directorProfile) : null,
      comparison: {
        withDirector: {
          totalCuts: cutPoints.length,
          avgDurationMs: Math.round(avgDurationWithDirector),
          avgDurationSeconds: (avgDurationWithDirector / 1000).toFixed(2)
        },
        withoutDirector: {
          totalCuts: cutPointsDefault.length,
          avgDurationMs: Math.round(avgDurationDefault),
          avgDurationSeconds: (avgDurationDefault / 1000).toFixed(2)
        },
        difference: {
          cutsDiff: cutPoints.length - cutPointsDefault.length,
          durationDiffPercent: Math.round(((avgDurationWithDirector - avgDurationDefault) / avgDurationDefault) * 100)
        }
      },
      cutPoints: cutPoints.slice(0, 20), // Solo primeros 20 para preview
      audioInfo: {
        bpm: analysis.bpm,
        genre: analysis.genre,
        duration: analysis.duration
      }
    });

  } catch (error: any) {
    logger.error('[AutoEdit] ❌ Error en preview con director:', error.message);
    res.status(500).json({
      error: 'Error generating preview with director',
      details: error.message
    });
  }
});

// ========== HELPERS ==========

function getPaceDescription(paceModifier: number): string {
  if (paceModifier < 0.6) return 'ULTRA-FAST (hyper-kinetic)';
  if (paceModifier < 0.8) return 'FAST (energetic)';
  if (paceModifier < 1.0) return 'SLIGHTLY FAST';
  if (paceModifier === 1.0) return 'PRECISE (metronomic)';
  if (paceModifier < 1.2) return 'SLIGHTLY SLOW';
  if (paceModifier < 1.4) return 'SLOW (contemplative)';
  return 'VERY SLOW (epic)';
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.round((ms % 1000) / 10);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}

export default router;
