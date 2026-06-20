/**
 * 🎵 Audio Analysis API Routes
 * 
 * Endpoints para análisis de audio que se integran con el flujo de generación de video.
 * El análisis se ejecuta automáticamente cuando se sube audio o genera el script.
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { 
  analyzeAudio, 
  generateEditingRecommendations,
  AudioAnalysisResult,
  EditingRecommendations 
} from '../services/audio-analysis-service';

const router = Router();

// Cache simple en memoria para evitar re-análisis
const analysisCache = new Map<string, AudioAnalysisResult>();

/**
 * POST /api/audio-analysis/analyze
 * Analiza un archivo de audio y devuelve la estructura musical completa
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { audioUrl, projectId, forceRefresh } = req.body;

    if (!audioUrl) {
      return res.status(400).json({ error: 'audioUrl is required' });
    }

    logger.log(`[AudioAnalysis API] 🎵 Analizando audio para proyecto: ${projectId || 'sin ID'}`);

    // Verificar cache
    const cacheKey = projectId || audioUrl;
    if (!forceRefresh && analysisCache.has(cacheKey)) {
      logger.log('[AudioAnalysis API] 📦 Devolviendo análisis desde cache');
      const cached = analysisCache.get(cacheKey)!;
      return res.json({
        success: true,
        analysis: cached,
        recommendations: generateEditingRecommendations(cached),
        fromCache: true,
      });
    }

    // Ejecutar análisis
    const analysis = await analyzeAudio(audioUrl);
    
    // Guardar en cache
    analysisCache.set(cacheKey, analysis);
    
    // Generar recomendaciones de edición
    const recommendations = generateEditingRecommendations(analysis);

    logger.log(`[AudioAnalysis API] ✅ Análisis completado:
      - BPM: ${analysis.bpm}
      - Secciones: ${analysis.sections.length}
      - Key Moments: ${analysis.keyMoments.length}
    `);

    res.json({
      success: true,
      analysis,
      recommendations,
      fromCache: false,
    });

  } catch (error: any) {
    logger.error('[AudioAnalysis API] ❌ Error:', error.message);
    res.status(500).json({
      error: 'Error analyzing audio',
      details: error.message,
    });
  }
});

/**
 * POST /api/audio-analysis/enrich-script
 * Enriquece un script de video con información del análisis de audio
 * 
 * Recibe: { script, audioAnalysis } o { script, audioUrl }
 * Devuelve: Script enriquecido con timestamps basados en beats
 */
router.post('/enrich-script', async (req: Request, res: Response) => {
  try {
    const { script, audioAnalysis, audioUrl } = req.body;

    if (!script || !script.scenes) {
      return res.status(400).json({ error: 'script with scenes is required' });
    }

    // Obtener o generar análisis de audio
    let analysis: AudioAnalysisResult;
    if (audioAnalysis) {
      analysis = audioAnalysis;
    } else if (audioUrl) {
      const cacheKey = audioUrl;
      if (analysisCache.has(cacheKey)) {
        analysis = analysisCache.get(cacheKey)!;
      } else {
        analysis = await analyzeAudio(audioUrl);
        analysisCache.set(cacheKey, analysis);
      }
    } else {
      return res.status(400).json({ error: 'audioAnalysis or audioUrl is required' });
    }

    logger.log(`[AudioAnalysis API] 🎬 Enriqueciendo script con ${script.scenes.length} escenas`);

    // Enriquecer cada escena con información musical
    const enrichedScenes = enrichScriptWithAudio(script.scenes, analysis);
    
    const enrichedScript = {
      ...script,
      audioAnalysis: {
        bpm: analysis.bpm,
        key: analysis.key,
        duration: analysis.duration,
        sectionsCount: analysis.sections.length,
      },
      scenes: enrichedScenes,
    };

    logger.log('[AudioAnalysis API] ✅ Script enriquecido correctamente');

    res.json({
      success: true,
      script: enrichedScript,
      audioSections: analysis.sections,
    });

  } catch (error: any) {
    logger.error('[AudioAnalysis API] ❌ Error enriching script:', error.message);
    res.status(500).json({
      error: 'Error enriching script',
      details: error.message,
    });
  }
});

/**
 * GET /api/audio-analysis/beats/:projectId
 * Obtiene solo los beats y puntos de corte para el timeline
 */
router.get('/beats/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const analysis = analysisCache.get(projectId);
    if (!analysis) {
      return res.status(404).json({ error: 'No analysis found for this project' });
    }

    res.json({
      success: true,
      beats: analysis.beats,
      downbeats: analysis.downbeats,
      bpm: analysis.bpm,
      sections: analysis.sections.map(s => ({
        type: s.type,
        startTime: s.startTime,
        endTime: s.endTime,
        energy: s.energy,
      })),
    });

  } catch (error: any) {
    logger.error('[AudioAnalysis API] ❌ Error getting beats:', error.message);
    res.status(500).json({
      error: 'Error getting beats',
      details: error.message,
    });
  }
});

/**
 * POST /api/audio-analysis/snap-to-beat
 * Ajusta un timestamp al beat más cercano
 */
router.post('/snap-to-beat', async (req: Request, res: Response) => {
  try {
    const { timestamp, projectId, audioUrl, threshold } = req.body;

    if (timestamp === undefined) {
      return res.status(400).json({ error: 'timestamp is required' });
    }

    const cacheKey = projectId || audioUrl;
    const analysis = analysisCache.get(cacheKey);
    
    if (!analysis) {
      return res.status(404).json({ error: 'No analysis found. Analyze audio first.' });
    }

    const { snapToBeat, getNearestBeat } = await import('../services/audio-analysis-service');
    const snappedTime = snapToBeat(analysis, timestamp, threshold || 0.2);
    const nearestBeat = getNearestBeat(analysis, timestamp);

    res.json({
      success: true,
      originalTime: timestamp,
      snappedTime,
      nearestBeat,
      wasSnapped: snappedTime !== timestamp,
    });

  } catch (error: any) {
    logger.error('[AudioAnalysis API] ❌ Error snapping to beat:', error.message);
    res.status(500).json({
      error: 'Error snapping to beat',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/audio-analysis/cache/:projectId
 * Limpia el cache de un proyecto específico
 */
router.delete('/cache/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    if (analysisCache.has(projectId)) {
      analysisCache.delete(projectId);
      logger.log(`[AudioAnalysis API] 🗑️ Cache eliminado para: ${projectId}`);
    }

    res.json({ success: true, message: 'Cache cleared' });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== FUNCIONES DE ENRIQUECIMIENTO ==========

interface EnrichedScene {
  // Campos originales del script
  [key: string]: any;
  
  // Campos añadidos por el análisis
  audioSection?: string;
  audioEnergy?: string;
  beatAlignedStart?: number;
  beatAlignedEnd?: number;
  suggestedTransition?: string;
  dominantInstrument?: string | null;
  isKeyMoment?: boolean;
  keyMomentType?: string;
}

/**
 * Enriquece las escenas del script con información del análisis de audio
 */
function enrichScriptWithAudio(scenes: any[], analysis: AudioAnalysisResult): EnrichedScene[] {
  const { 
    getSectionAt, 
    getDominantInstrumentAt, 
    snapToBeat 
  } = require('../services/audio-analysis-service');
  
  const recommendations = generateEditingRecommendations(analysis);
  
  return scenes.map((scene, index) => {
    const startTime = scene.start_time || scene.startTime || (index * 3);
    const endTime = scene.end_time || scene.endTime || (startTime + (scene.duration || 3));
    
    // Obtener sección musical
    const section = getSectionAt(analysis, startTime);
    
    // Snap a beats
    const beatAlignedStart = snapToBeat(analysis, startTime);
    const beatAlignedEnd = snapToBeat(analysis, endTime);
    
    // Obtener instrumento dominante
    const dominantInstrument = getDominantInstrumentAt(analysis, startTime);
    
    // Verificar si es un key moment
    const keyMoment = analysis.keyMoments.find(
      km => Math.abs(km.timestamp - startTime) < 1.0
    );
    
    // Determinar transición recomendada
    const energy = section?.energy || 'medium';
    const suggestedTransition = recommendations.transitionsByEnergy[energy] || 'crossfade';
    
    // Calcular duración recomendada basada en sección
    const sectionType = section?.type || 'verse';
    const beatsPerScene = recommendations.sceneDurationBySection[sectionType] || 2;
    const recommendedDuration = (60 / analysis.bpm) * beatsPerScene;
    
    return {
      ...scene,
      // Timestamps alineados a beats
      start_time: beatAlignedStart,
      end_time: beatAlignedEnd,
      beatAlignedStart,
      beatAlignedEnd,
      
      // Información de sección musical
      audioSection: section?.type || 'unknown',
      audioEnergy: energy,
      
      // Recomendaciones de edición
      suggestedTransition,
      suggestedDuration: recommendedDuration,
      
      // Instrumento destacado (para matching con músicos)
      dominantInstrument,
      
      // Key moments
      isKeyMoment: !!keyMoment,
      keyMomentType: keyMoment?.type,
      keyMomentEffect: keyMoment?.suggestedEffect,
      
      // Metadata adicional
      bpm: analysis.bpm,
      beatsInScene: Math.round((beatAlignedEnd - beatAlignedStart) / (60 / analysis.bpm)),
    };
  });
}

export default router;
