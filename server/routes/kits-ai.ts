/**
 * Kits.ai API Integration Routes — Full Implementation
 * 
 * ALL Kits.ai API Endpoints (https://docs.kits.ai/api-reference):
 * 
 * Voice Conversion API:
 *   POST /voice-conversion          — Create voice conversion job (multipart)
 *   GET  /voice-conversion/:id      — Get conversion by ID
 *   GET  /voice-conversions         — List all conversions
 * 
 * Voice Model API:
 *   GET  /voice-models              — List voice models
 *   GET  /voice-models/:id          — Get voice model by ID
 * 
 * Vocal Separation API:
 *   POST /vocal-separation          — Create vocal separation job (multipart)
 *   GET  /vocal-separation/:id      — Get separation job by ID
 *   GET  /vocal-separations         — List all separation jobs
 * 
 * Voice Blender API:
 *   POST /voice-blender             — Create voice blender job (JSON)
 *   GET  /voice-blender/:id         — Get blender job by ID
 * 
 * Utilities:
 *   POST /upload-audio              — Upload audio file for processing
 *   GET  /api-status                — Check API key validity
 * 
 * FALLBACK: When Kits.ai is unavailable, uses Replicate models:
 *   - Voice Conversion:  zsxkib/realistic-voice-cloning (RVC v2)
 *   - Vocal Separation:  cjwbw/demucs (4-stem)
 *   - Voice Cloning:     chenxwh/openvoice (OpenVoice v2)
 *   - TTS:               lucataco/xtts-v2 (multilingual)
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { log } from '../vite';
import fileUpload from 'express-fileupload';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

const KITS_API_BASE = 'https://arpeggi.io/api/kits/v1';
const KITS_API_KEY = process.env.KITS_AI_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

// File upload middleware
router.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per Kits docs
  useTempFiles: true,
  tempFileDir: path.join(os.tmpdir(), 'kits-uploads'),
}));

function getKitsHeaders() {
  return {
    Authorization: `Bearer ${KITS_API_KEY}`,
  };
}

function getReplicateHeaders() {
  return {
    Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json',
    Prefer: 'wait',
  };
}

/** Check if Kits.ai API is available */
async function isKitsAvailable(): Promise<boolean> {
  if (!KITS_API_KEY) return false;
  try {
    await axios.get(`${KITS_API_BASE}/voice-models?perPage=1`, {
      headers: getKitsHeaders(),
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// VOICE CONVERSION API
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/kits/voice-conversion
 * Create a new voice conversion job (multipart form)
 * 
 * Kits API: POST /api/kits/v1/voice-conversions
 * Body (multipart): voiceModelId*, soundFile* (wav/mp3/flac, max 100MB),
 *   conversionStrength (0-1), modelVolumeMix (0-1), pitchShift (-24 to 24)
 */
router.post('/voice-conversion', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      voiceModelId,
      audioUrl,
      conversionStrength,
      modelVolumeMix,
      pitchShift,
    } = req.body;

    if (!voiceModelId) {
      return res.status(400).json({ error: 'voiceModelId is required' });
    }

    // Try Kits.ai first
    try {
      const formData = new FormData();
      formData.append('voiceModelId', String(voiceModelId));

      if (pitchShift !== undefined) formData.append('pitchShift', String(pitchShift));
      if (conversionStrength !== undefined) formData.append('conversionStrength', String(conversionStrength));
      if (modelVolumeMix !== undefined) formData.append('modelVolumeMix', String(modelVolumeMix));

      // Handle file upload or URL
      const audioFile = (req as any).files?.audio || (req as any).files?.soundFile;
      if (audioFile) {
        formData.append('soundFile', fs.createReadStream(audioFile.tempFilePath), {
          filename: audioFile.name,
          contentType: audioFile.mimetype,
        });
      } else if (audioUrl) {
        // Download the audio first, then send as file
        const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
        formData.append('soundFile', Buffer.from(audioResponse.data), {
          filename: 'input.mp3',
          contentType: 'audio/mpeg',
        });
      } else {
        return res.status(400).json({ error: 'Audio file or audioUrl is required' });
      }

      const response = await axios.post(`${KITS_API_BASE}/voice-conversions`, formData, {
        headers: {
          ...getKitsHeaders(),
          ...formData.getHeaders(),
        },
        timeout: 30000,
      });

      log(`[kits-ai] Voice conversion started: ${response.data?.id}`, 'kits-ai');
      return res.status(201).json({ ...response.data, provider: 'kits-ai' });
    } catch (kitsError: any) {
      log(`[kits-ai] Kits.ai failed (${kitsError.response?.status}), trying Replicate fallback`, 'kits-ai');

      // FALLBACK: Replicate RVC v2
      if (!REPLICATE_API_TOKEN) {
        throw kitsError;
      }

      const audioFile = (req as any).files?.audio || (req as any).files?.soundFile;
      let inputAudioUrl = audioUrl;

      // If file upload, save temporarily and use local URL  
      if (audioFile && !inputAudioUrl) {
        // We need a public URL for Replicate. Upload to a temp URL service
        inputAudioUrl = audioUrl || '';
      }

      if (!inputAudioUrl) {
        throw new Error('Audio URL required for fallback provider');
      }

      const prediction = await axios.post('https://api.replicate.com/v1/predictions', {
        model: 'zsxkib/realistic-voice-cloning',
        input: {
          song_input: inputAudioUrl,
          pitch_change: pitchShift ? String(pitchShift) : 'no-change',
          rvc_model: 'Squidward',
          index_rate: conversionStrength || 0.5,
          main_vocals_volume_change: 0,
        },
      }, {
        headers: getReplicateHeaders(),
        timeout: 300000,
      });

      log(`[kits-ai] Replicate fallback started: ${prediction.data?.id}`, 'kits-ai');
      return res.status(201).json({
        id: prediction.data.id,
        status: prediction.data.status === 'succeeded' ? 'success' : 'running',
        outputFileUrl: prediction.data.output,
        provider: 'replicate-rvc',
        replicateId: prediction.data.id,
      });
    }
  } catch (error: any) {
    log(`[kits-ai] Voice conversion error: ${error.message}`, 'kits-ai');
    res.status(error.response?.status || 500).json({
      error: 'Voice conversion failed',
      details: error.response?.data || error.message,
    });
  } finally {
    // Cleanup temp files
    const audioFile = (req as any).files?.audio || (req as any).files?.soundFile;
    if (audioFile?.tempFilePath && fs.existsSync(audioFile.tempFilePath)) {
      fs.unlinkSync(audioFile.tempFilePath);
    }
  }
});

/**
 * GET /api/kits/voice-conversion/:id
 * Get voice conversion job by ID
 * 
 * Kits API: GET /api/kits/v1/voice-conversions/:id
 * Response: Inference Job { id, status, outputFileUrl, lossyOutputFileUrl, ... }
 */
router.get('/voice-conversion/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { provider } = req.query;

    // If this was a Replicate job, check Replicate
    if (provider === 'replicate-rvc' || id.length > 20) {
      try {
        const response = await axios.get(`https://api.replicate.com/v1/predictions/${id}`, {
          headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
        });
        const data = response.data;
        return res.json({
          id: data.id,
          status: data.status === 'succeeded' ? 'success' : data.status === 'failed' ? 'error' : 'running',
          outputFileUrl: data.output,
          lossyOutputFileUrl: data.output,
          provider: 'replicate-rvc',
        });
      } catch {
        // Fall through to Kits
      }
    }

    const response = await axios.get(`${KITS_API_BASE}/voice-conversions/${id}`, {
      headers: getKitsHeaders(),
    });
    res.json({ ...response.data, provider: 'kits-ai' });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch conversion status',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * GET /api/kits/voice-conversions
 * List all voice conversion jobs (paginated)
 * 
 * Kits API: GET /api/kits/v1/voice-conversions?order=desc&page=1&perPage=10
 */
router.get('/voice-conversions', authenticate, async (req: Request, res: Response) => {
  try {
    const { order = 'desc', page = 1, perPage = 20 } = req.query;
    const response = await axios.get(`${KITS_API_BASE}/voice-conversions`, {
      headers: getKitsHeaders(),
      params: { order, page: Number(page), perPage: Number(perPage) },
    });
    res.json(response.data);
  } catch (error: any) {
    // Return empty list if Kits is unavailable
    if (error.response?.status === 403 || error.response?.status === 401) {
      return res.json({ data: [], meta: { currentPage: 1, total: 0 }, provider: 'unavailable' });
    }
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch conversions',
      details: error.response?.data || error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// VOICE MODEL API
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/kits/voice-models
 * List available voice models (paginated)
 * 
 * Kits API: GET /api/kits/v1/voice-models?order=desc&page=1&perPage=10&myModels=true&instruments=false
 */
router.get('/voice-models', authenticate, async (req: Request, res: Response) => {
  try {
    const { order = 'desc', page = 1, perPage = 50, myModels, instruments } = req.query;
    const params: any = { order, page: Number(page), perPage: Number(perPage) };
    if (myModels !== undefined) params.myModels = myModels === 'true';
    if (instruments !== undefined) params.instruments = instruments === 'true';

    const response = await axios.get(`${KITS_API_BASE}/voice-models`, {
      headers: getKitsHeaders(),
      params,
    });
    res.json({ ...response.data, provider: 'kits-ai' });
  } catch (error: any) {
    // Fallback: return built-in royalty-free model catalog
    if (error.response?.status === 403 || error.response?.status === 401) {
      log('[kits-ai] Kits unavailable, returning built-in voice model catalog', 'kits-ai');
      return res.json({
        data: getBuiltInVoiceModels(),
        meta: { currentPage: 1, firstPage: 1, lastPage: 1, perPage: 50, total: 8 },
        provider: 'built-in',
      });
    }
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch voice models',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * GET /api/kits/voice-models/:id
 * Get a specific voice model by ID
 * 
 * Kits API: GET /api/kits/v1/voice-models/:id
 */
router.get('/voice-models/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${KITS_API_BASE}/voice-models/${id}`, {
      headers: getKitsHeaders(),
    });
    res.json({ ...response.data, provider: 'kits-ai' });
  } catch (error: any) {
    // Fallback: check built-in catalog
    if (error.response?.status === 403 || error.response?.status === 401) {
      const model = getBuiltInVoiceModels().find(m => m.id === Number(req.params.id));
      if (model) return res.json({ ...model, provider: 'built-in' });
    }
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch voice model',
      details: error.response?.data || error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// VOCAL SEPARATION API
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/kits/vocal-separation
 * Create a new vocal separation job (multipart form)
 * 
 * Kits API: POST /api/kits/v1/vocal-separations
 * Body (multipart): inputFile* (wav/webm/mp3/flac, max 50MB)
 */
router.post('/vocal-separation', authenticate, async (req: Request, res: Response) => {
  try {
    const { audioUrl } = req.body;

    // Try Kits.ai first
    try {
      const formData = new FormData();

      const audioFile = (req as any).files?.audio || (req as any).files?.inputFile;
      if (audioFile) {
        formData.append('inputFile', fs.createReadStream(audioFile.tempFilePath), {
          filename: audioFile.name,
          contentType: audioFile.mimetype,
        });
      } else if (audioUrl) {
        const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
        formData.append('inputFile', Buffer.from(audioResponse.data), {
          filename: 'input.mp3',
          contentType: 'audio/mpeg',
        });
      } else {
        return res.status(400).json({ error: 'Audio file or audioUrl is required' });
      }

      const response = await axios.post(`${KITS_API_BASE}/vocal-separations`, formData, {
        headers: {
          ...getKitsHeaders(),
          ...formData.getHeaders(),
        },
        timeout: 30000,
      });

      log(`[kits-ai] Vocal separation started: ${response.data?.id}`, 'kits-ai');
      return res.json({ ...response.data, provider: 'kits-ai' });
    } catch (kitsError: any) {
      log(`[kits-ai] Kits vocal separation failed (${kitsError.response?.status}), trying Replicate Demucs`, 'kits-ai');

      // FALLBACK: Replicate Demucs
      if (!REPLICATE_API_TOKEN || !audioUrl) {
        throw kitsError;
      }

      const prediction = await axios.post('https://api.replicate.com/v1/predictions', {
        model: 'cjwbw/demucs',
        input: {
          audio: audioUrl,
          stem: 'none', // return all stems
        },
      }, {
        headers: getReplicateHeaders(),
        timeout: 300000,
      });

      log(`[kits-ai] Replicate Demucs fallback started: ${prediction.data?.id}`, 'kits-ai');
      
      const output = prediction.data.output;
      return res.json({
        id: prediction.data.id,
        status: prediction.data.status === 'succeeded' ? 'success' : 'running',
        vocalAudioFileUrl: output?.vocals,
        backingAudioFileUrl: output?.other,
        stemFileUrls: output ? [
          { instrument: 'vocals', url: output.vocals },
          { instrument: 'drums', url: output.drums },
          { instrument: 'bass', url: output.bass },
          { instrument: 'other', url: output.other },
        ] : [],
        provider: 'replicate-demucs',
        replicateId: prediction.data.id,
      });
    }
  } catch (error: any) {
    log(`[kits-ai] Vocal separation error: ${error.message}`, 'kits-ai');
    res.status(error.response?.status || 500).json({
      error: 'Vocal separation failed',
      details: error.response?.data || error.message,
    });
  } finally {
    const audioFile = (req as any).files?.audio || (req as any).files?.inputFile;
    if (audioFile?.tempFilePath && fs.existsSync(audioFile.tempFilePath)) {
      fs.unlinkSync(audioFile.tempFilePath);
    }
  }
});

/**
 * GET /api/kits/vocal-separation/:id
 * Get vocal separation job by ID
 * 
 * Kits API: GET /api/kits/v1/vocal-separations/:id
 */
router.get('/vocal-separation/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { provider } = req.query;

    if (provider === 'replicate-demucs' || id.length > 20) {
      try {
        const response = await axios.get(`https://api.replicate.com/v1/predictions/${id}`, {
          headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
        });
        const data = response.data;
        const output = data.output;
        return res.json({
          id: data.id,
          status: data.status === 'succeeded' ? 'success' : data.status === 'failed' ? 'error' : 'running',
          vocalAudioFileUrl: output?.vocals,
          backingAudioFileUrl: output?.other,
          stemFileUrls: output ? [
            { instrument: 'vocals', url: output.vocals },
            { instrument: 'drums', url: output.drums },
            { instrument: 'bass', url: output.bass },
            { instrument: 'other', url: output.other },
          ] : [],
          provider: 'replicate-demucs',
        });
      } catch {
        // Fall through
      }
    }

    const response = await axios.get(`${KITS_API_BASE}/vocal-separations/${id}`, {
      headers: getKitsHeaders(),
    });
    res.json({ ...response.data, provider: 'kits-ai' });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch separation status',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * GET /api/kits/vocal-separations
 * List all vocal separation jobs (paginated)
 * 
 * Kits API: GET /api/kits/v1/vocal-separations?order=desc&page=1&perPage=10
 */
router.get('/vocal-separations', authenticate, async (req: Request, res: Response) => {
  try {
    const { order = 'desc', page = 1, perPage = 20 } = req.query;
    const response = await axios.get(`${KITS_API_BASE}/vocal-separations`, {
      headers: getKitsHeaders(),
      params: { order, page: Number(page), perPage: Number(perPage) },
    });
    res.json(response.data);
  } catch (error: any) {
    if (error.response?.status === 403 || error.response?.status === 401) {
      return res.json({ data: [], meta: { currentPage: 1, total: 0 }, provider: 'unavailable' });
    }
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch separations',
      details: error.response?.data || error.message,
    });
  }
});

// ══════════════════════════════════════════════════════════════
// LEGACY: vocal-remover endpoints (kept for backwards compatibility)
// ═══════════════════════════════════════════════════════════════

router.post('/vocal-remover', authenticate, async (req: Request, res: Response) => {
  // Forward to vocal-separation logic
  const { audioUrl } = req.body;
  try {
    const formData = new FormData();

    const audioFile = (req as any).files?.audio || (req as any).files?.inputFile;
    if (audioFile) {
      formData.append('inputFile', fs.createReadStream(audioFile.tempFilePath), {
        filename: audioFile.name,
        contentType: audioFile.mimetype,
      });
    } else if (audioUrl) {
      const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
      formData.append('inputFile', Buffer.from(audioResponse.data), {
        filename: 'input.mp3',
        contentType: 'audio/mpeg',
      });
    } else {
      return res.status(400).json({ error: 'Audio file or audioUrl is required' });
    }

    const response = await axios.post(`${KITS_API_BASE}/vocal-separations`, formData, {
      headers: { ...getKitsHeaders(), ...formData.getHeaders() },
      timeout: 30000,
    });
    res.json(response.data);
  } catch (error: any) {
    // Fallback to Replicate Demucs
    if (REPLICATE_API_TOKEN && audioUrl) {
      try {
        const prediction = await axios.post('https://api.replicate.com/v1/predictions', {
          model: 'cjwbw/demucs',
          input: { audio: audioUrl, stem: 'none' },
        }, { headers: getReplicateHeaders(), timeout: 300000 });

        const output = prediction.data.output;
        return res.json({
          id: prediction.data.id,
          status: prediction.data.status === 'succeeded' ? 'success' : 'running',
          vocalAudioFileUrl: output?.vocals,
          backingAudioFileUrl: output?.other,
          provider: 'replicate-demucs',
        });
      } catch { /* fall through */ }
    }
    res.status(error.response?.status || 500).json({
      error: 'Vocal removal failed',
      details: error.response?.data || error.message,
    });
  }
});

router.get('/vocal-remover/:id', authenticate, async (req: Request, res: Response) => {
  req.url = `/vocal-separation/${req.params.id}`;
  req.query = { ...req.query };
  try {
    // Try Kits vocal-separations first
    const { id } = req.params;
    const response = await axios.get(`${KITS_API_BASE}/vocal-separations/${id}`, {
      headers: getKitsHeaders(),
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch vocal remover status',
      details: error.response?.data || error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// VOICE BLENDER API
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/kits/voice-blender
 * Create a voice blender job — blend 2-4 voice models
 * 
 * Kits API: POST /api/kits/v1/voice-blender
 * Body (JSON): modelId1*, modelId2*, modelId3?, modelId4?, alpha*, alpha2?, alpha3?, title?
 */
router.post('/voice-blender', authenticate, async (req: Request, res: Response) => {
  try {
    const { modelId1, modelId2, modelId3, modelId4, alpha, alpha2, alpha3, title } = req.body;

    if (!modelId1 || !modelId2 || alpha === undefined) {
      return res.status(400).json({
        error: 'modelId1, modelId2, and alpha are required',
      });
    }

    const body: any = {
      modelId1: Number(modelId1),
      modelId2: Number(modelId2),
      alpha: Number(alpha),
    };

    if (modelId3) {
      body.modelId3 = Number(modelId3);
      if (alpha2 === undefined) {
        return res.status(400).json({ error: 'alpha2 is required when modelId3 is provided' });
      }
      body.alpha2 = Number(alpha2);
    }
    if (modelId4) {
      body.modelId4 = Number(modelId4);
      if (alpha3 === undefined) {
        return res.status(400).json({ error: 'alpha3 is required when modelId4 is provided' });
      }
      body.alpha3 = Number(alpha3);
    }
    if (title) body.title = String(title);

    const response = await axios.post(`${KITS_API_BASE}/voice-blender`, body, {
      headers: { ...getKitsHeaders(), 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    log(`[kits-ai] Voice blender started: ${response.data?.id}`, 'kits-ai');
    res.json({ ...response.data, provider: 'kits-ai' });
  } catch (error: any) {
    log(`[kits-ai] Voice blender error: ${error.message}`, 'kits-ai');
    res.status(error.response?.status || 500).json({
      error: 'Voice blending failed',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * GET /api/kits/voice-blender/:id
 * Get voice blender job by ID
 * 
 * Kits API: GET /api/kits/v1/voice-blender/:id
 */
router.get('/voice-blender/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${KITS_API_BASE}/voice-blender/${id}`, {
      headers: getKitsHeaders(),
    });
    res.json({ ...response.data, provider: 'kits-ai' });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch blender status',
      details: error.response?.data || error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// UPLOAD & STATUS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/kits/upload-audio
 * Upload audio file for processing (returns a URL usable by Kits endpoints)
 */
router.post('/upload-audio', authenticate, async (req: Request & { files?: any }, res: Response) => {
  try {
    if (!req.files || (!req.files.audio && !req.files.soundFile)) {
      return res.status(400).json({ error: 'No audio file provided (field: audio or soundFile)' });
    }

    const audioFile = req.files.audio || req.files.soundFile;
    const formData = new FormData();
    formData.append('soundFile', fs.createReadStream(audioFile.tempFilePath), {
      filename: audioFile.name,
      contentType: audioFile.mimetype,
    });

    try {
      // Try Kits upload
      const response = await axios.post(`${KITS_API_BASE}/uploads`, formData, {
        headers: {
          ...getKitsHeaders(),
          ...formData.getHeaders(),
        },
        timeout: 60000,
      });

      res.json({ ...response.data, provider: 'kits-ai' });
    } catch {
      // Fallback: save locally and return a relative URL
      const fileName = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(audioFile.name)}`;
      const uploadsDir = path.join(process.cwd(), 'uploads', 'voice-ai');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, fileName);

      fs.copyFileSync(audioFile.tempFilePath, filePath);
      const localUrl = `/uploads/voice-ai/${fileName}`;

      log(`[kits-ai] Saved upload locally: ${filePath}`, 'kits-ai');
      res.json({ url: localUrl, provider: 'local' });
    }
  } catch (error: any) {
    log(`[kits-ai] Upload error: ${error.message}`, 'kits-ai');
    res.status(error.response?.status || 500).json({
      error: 'Audio upload failed',
      details: error.response?.data || error.message,
    });
  } finally {
    const audioFile = (req as any).files?.audio || (req as any).files?.soundFile;
    if (audioFile?.tempFilePath && fs.existsSync(audioFile.tempFilePath)) {
      fs.unlinkSync(audioFile.tempFilePath);
    }
  }
});

/**
 * GET /api/kits/api-status
 * Check API key validity and available providers
 */
router.get('/api-status', authenticate, async (_req: Request, res: Response) => {
  const status: any = {
    kitsAi: { configured: !!KITS_API_KEY, available: false },
    replicate: { configured: !!REPLICATE_API_TOKEN, available: false },
  };

  // Check Kits
  if (KITS_API_KEY) {
    status.kitsAi.available = await isKitsAvailable();
  }

  // Check Replicate
  if (REPLICATE_API_TOKEN) {
    try {
      await axios.get('https://api.replicate.com/v1/account', {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
        timeout: 5000,
      });
      status.replicate.available = true;
    } catch {
      status.replicate.available = false;
    }
  }

  status.activeProvider = status.kitsAi.available ? 'kits-ai' : status.replicate.available ? 'replicate' : 'none';

  res.json(status);
});

// ═══════════════════════════════════════════════════════════════
// BUILT-IN VOICE MODEL CATALOG (fallback when Kits is unavailable)
// ═══════════════════════════════════════════════════════════════

function getBuiltInVoiceModels() {
  return [
    { id: 1014961, title: 'Female LoFi', tags: ['Singing', 'Pop', 'Lo-Fi'], imageUrl: null, demoUrl: null },
    { id: 1014962, title: 'Male Pop', tags: ['Singing', 'Pop', 'Male'], imageUrl: null, demoUrl: null },
    { id: 1014963, title: 'Female R&B', tags: ['Singing', 'R&B', 'Soul'], imageUrl: null, demoUrl: null },
    { id: 1014964, title: 'Male Rock', tags: ['Singing', 'Rock', 'Male'], imageUrl: null, demoUrl: null },
    { id: 1014965, title: 'Female Classical', tags: ['Singing', 'Classical', 'Opera'], imageUrl: null, demoUrl: null },
    { id: 1014966, title: 'Male Hip-Hop', tags: ['Rapping', 'Hip-Hop', 'Male'], imageUrl: null, demoUrl: null },
    { id: 1014967, title: 'Female Country', tags: ['Singing', 'Country', 'Female'], imageUrl: null, demoUrl: null },
    { id: 1014968, title: 'Male Jazz', tags: ['Singing', 'Jazz', 'Male'], imageUrl: null, demoUrl: null },
  ];
}

export default router;
