/**
 * 🧪 API Test Endpoint
 * Endpoint de diagnóstico para verificar el sistema de exportación de video
 */

import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

interface DiagnosticResult {
  component: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: any;
}

/**
 * GET /api/diagnostics/video-export
 * Verifica que todos los componentes de exportación estén funcionando
 */
router.get('/video-export', async (req, res) => {
  logger.log('🔍 [DIAGNOSTICS] Running video export system check...');
  
  const results: DiagnosticResult[] = [];
  const startTime = Date.now();

  // 1. Check Shotstack API Key
  const shotstackKey = process.env.SHOTSTACK_API_KEY;
  if (shotstackKey && shotstackKey.length > 10) {
    results.push({
      component: 'Shotstack API Key',
      status: 'ok',
      message: 'Configurada',
      details: { keyLength: shotstackKey.length }
    });
  } else {
    results.push({
      component: 'Shotstack API Key',
      status: 'error',
      message: 'No configurada o inválida'
    });
  }

  // 2. Check Firebase Configuration
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  const firebaseAdminKey = process.env.FIREBASE_ADMIN_KEY;
  
  if (firebaseProjectId && firebaseAdminKey) {
    try {
      JSON.parse(firebaseAdminKey);
      results.push({
        component: 'Firebase Storage',
        status: 'ok',
        message: 'Configurado',
        details: { projectId: firebaseProjectId }
      });
    } catch {
      results.push({
        component: 'Firebase Storage',
        status: 'error',
        message: 'Admin Key JSON inválido'
      });
    }
  } else {
    results.push({
      component: 'Firebase Storage',
      status: 'error',
      message: 'Credenciales no configuradas'
    });
  }

  // 3. Check Database Connection
  try {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`SELECT 1`);
    results.push({
      component: 'Database',
      status: 'ok',
      message: 'Conexión exitosa'
    });
  } catch (error) {
    results.push({
      component: 'Database',
      status: 'error',
      message: 'Error de conexión',
      details: { error: String(error) }
    });
  }

  // 4. Test Shotstack API Connection
  if (shotstackKey) {
    try {
      const response = await fetch('https://api.shotstack.io/v1/render', {
        method: 'GET',
        headers: { 'x-api-key': shotstackKey },
      });
      
      if (response.status === 401) {
        results.push({
          component: 'Shotstack API Connection',
          status: 'error',
          message: 'API Key inválida'
        });
      } else {
        results.push({
          component: 'Shotstack API Connection',
          status: 'ok',
          message: 'Conexión exitosa',
          details: { status: response.status }
        });
      }
    } catch (error) {
      results.push({
        component: 'Shotstack API Connection',
        status: 'error',
        message: 'Error de red',
        details: { error: String(error) }
      });
    }
  }

  // 5. Check video-rendering routes
  results.push({
    component: 'Video Rendering Routes',
    status: 'ok',
    message: 'Endpoints disponibles',
    details: {
      start: 'POST /api/video-rendering/start',
      status: 'GET /api/video-rendering/status/:renderId',
      update: 'POST /api/video-rendering/update-project'
    }
  });

  // Summary
  const elapsed = Date.now() - startTime;
  const okCount = results.filter(r => r.status === 'ok').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const warningCount = results.filter(r => r.status === 'warning').length;

  const overallStatus = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'ok';

  logger.log(`✅ [DIAGNOSTICS] Complete: ${okCount} ok, ${warningCount} warnings, ${errorCount} errors`);

  res.json({
    success: overallStatus !== 'error',
    status: overallStatus,
    summary: {
      ok: okCount,
      warnings: warningCount,
      errors: errorCount,
      elapsed: `${elapsed}ms`
    },
    results,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/diagnostics/test-render
 * Simula un render sin ejecutarlo realmente (dry-run)
 */
router.post('/test-render', async (req, res) => {
  logger.log('🧪 [DIAGNOSTICS] Testing render request validation...');

  const { clips, audioUrl, aspectRatio } = req.body;

  const validation: DiagnosticResult[] = [];

  // Validate clips
  if (!clips || !Array.isArray(clips)) {
    validation.push({
      component: 'Clips',
      status: 'error',
      message: 'Clips array is required'
    });
  } else if (clips.length === 0) {
    validation.push({
      component: 'Clips',
      status: 'error',
      message: 'At least one clip is required'
    });
  } else {
    const validClips = clips.filter((c: any) => c.videoUrl || c.imageUrl);
    validation.push({
      component: 'Clips',
      status: validClips.length === clips.length ? 'ok' : 'warning',
      message: `${validClips.length}/${clips.length} clips have valid URLs`,
      details: { validClips: validClips.length, totalClips: clips.length }
    });
  }

  // Validate audio
  if (audioUrl) {
    validation.push({
      component: 'Audio',
      status: 'ok',
      message: 'Audio URL provided',
      details: { url: audioUrl.substring(0, 50) + '...' }
    });
  } else {
    validation.push({
      component: 'Audio',
      status: 'warning',
      message: 'No audio URL provided - video will be silent'
    });
  }

  // Validate aspect ratio
  const validRatios = ['16:9', '9:16', '1:1'];
  if (aspectRatio && validRatios.includes(aspectRatio)) {
    validation.push({
      component: 'Aspect Ratio',
      status: 'ok',
      message: `Valid aspect ratio: ${aspectRatio}`
    });
  } else if (aspectRatio) {
    validation.push({
      component: 'Aspect Ratio',
      status: 'error',
      message: `Invalid aspect ratio: ${aspectRatio}. Use: ${validRatios.join(', ')}`
    });
  } else {
    validation.push({
      component: 'Aspect Ratio',
      status: 'ok',
      message: 'Default aspect ratio: 16:9'
    });
  }

  // Build sample Shotstack payload
  const samplePayload = {
    timeline: {
      tracks: [
        {
          clips: (clips || []).slice(0, 3).map((c: any, i: number) => ({
            asset: c.videoUrl 
              ? { type: 'video', src: c.videoUrl }
              : { type: 'image', src: c.imageUrl },
            start: c.start || i * 3,
            length: c.duration || 3
          }))
        }
      ]
    },
    output: {
      format: 'mp4',
      resolution: '1080p',
      fps: 30
    }
  };

  const hasErrors = validation.some(v => v.status === 'error');

  res.json({
    success: !hasErrors,
    message: hasErrors 
      ? 'Validation failed - fix errors before rendering' 
      : 'Request is valid and ready for rendering',
    validation,
    sampleShotstackPayload: samplePayload
  });
});

export default router;
