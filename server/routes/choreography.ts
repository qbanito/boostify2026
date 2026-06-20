/**
 * 💃 Choreography API Routes
 * Endpoints para subir videos de coreografía y aplicar motion transfer
 * a las imágenes del artista usando DreamActor v2.
 *
 * POST /api/choreography/upload     — Sube video de coreografía
 * POST /api/choreography/apply      — Aplica coreografía a imagen (DreamActor v2)
 * POST /api/choreography/apply-audio — Fallback con audio (OmniHuman v1.5)
 * GET  /api/choreography/status/:id — Consulta estado de generación
 * GET  /api/choreography/presets    — Lista presets disponibles
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import {
  uploadChoreographyVideo,
  applyChoreography,
  generateAudioDrivenChoreography,
  checkDreamActorStatus,
  CHOREOGRAPHY_PRESETS,
  animateArtist,
  MOTION_TEMPLATES,
  selectMotionTemplate,
} from '../services/choreography-service';

const router = express.Router();

// Multer: max 100MB video, store in temp dir
const upload = multer({
  dest: 'uploads/choreography/',
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// ============================================
// GET /presets — List available choreography presets
// ============================================
router.get('/presets', (_req: Request, res: Response) => {
  res.json({ success: true, presets: CHOREOGRAPHY_PRESETS });
});

// ============================================
// POST /upload — Upload choreography video to Firebase
// ============================================
router.post('/upload', upload.single('video'), async (req: Request, res: Response) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const userEmail = req.body.userEmail || 'anonymous';
    const videoBuffer = fs.readFileSync(req.file.path);
    const contentType = req.file.mimetype || 'video/webm';

    const result = await uploadChoreographyVideo(videoBuffer, userEmail, contentType);

    // Clean up temp file
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error: any) {
    // Clean up on error
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error('❌ [CHOREO-ROUTE] Upload error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /apply — Apply choreography via DreamActor v2
// ============================================
router.post('/apply', async (req: Request, res: Response) => {
  try {
    const {
      choreographyVideoUrl,
      artistImageUrl,
      clipDuration,
      loopStart,
      loopEnd,
      mirrorLoop,
      preset,
      addLipsync,
      audioUrl
    } = req.body;

    if (!choreographyVideoUrl || !artistImageUrl) {
      return res.status(400).json({
        success: false,
        error: 'choreographyVideoUrl and artistImageUrl are required'
      });
    }

    const result = await applyChoreography({
      choreographyVideoUrl,
      artistImageUrl,
      clipDuration: clipDuration || 5,
      loopStart,
      loopEnd,
      mirrorLoop,
      preset,
      addLipsync,
      audioUrl
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error('❌ [CHOREO-ROUTE] Apply error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /apply-audio — Fallback: OmniHuman audio-driven
// ============================================
router.post('/apply-audio', async (req: Request, res: Response) => {
  try {
    const { artistImageUrl, audioUrl, preset, resolution } = req.body;

    if (!artistImageUrl || !audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'artistImageUrl and audioUrl are required'
      });
    }

    const result = await generateAudioDrivenChoreography(
      artistImageUrl,
      audioUrl,
      preset,
      resolution || '720p'
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error('❌ [CHOREO-ROUTE] Audio apply error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /status/:requestId — Check DreamActor status
// ============================================
router.get('/status/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({ success: false, error: 'requestId is required' });
    }

    const result = await checkDreamActorStatus(requestId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('❌ [CHOREO-ROUTE] Status error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /motion-templates — List motion templates by genre
// ============================================
router.get('/motion-templates', (_req: Request, res: Response) => {
  res.json({ success: true, templates: MOTION_TEMPLATES });
});

// ============================================
// GET /motion-templates/:genre — Get best template for genre
// ============================================
router.get('/motion-templates/:genre', (req: Request, res: Response) => {
  const template = selectMotionTemplate(req.params.genre);
  res.json({ success: true, template });
});

// ============================================
// POST /animate — Smart animate: auto-selects best model + template
// Chain: DreamActor v2 → DreamActor M2.0 → OmniHuman
// ============================================
router.post('/animate', async (req: Request, res: Response) => {
  try {
    const { artistImageUrl, drivingVideoUrl, audioUrl, genre, preset, addLipsync } = req.body;

    if (!artistImageUrl) {
      return res.status(400).json({
        success: false,
        error: 'artistImageUrl is required',
      });
    }

    if (!drivingVideoUrl && !genre && !audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'Provide at least one of: drivingVideoUrl, genre (for auto-template), or audioUrl (for audio-driven)',
      });
    }

    const result = await animateArtist({
      artistImageUrl,
      drivingVideoUrl,
      audioUrl,
      genre,
      preset,
      addLipsync,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error('❌ [CHOREO-ROUTE] Animate error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
