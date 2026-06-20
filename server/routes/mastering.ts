/**
 * AI Audio Mastering Suite — FAL-powered endpoints
 *
 * FAL models used:
 *   fal-ai/demucs            — Stem separation (vocals / drums / bass / other)
 *   fal-ai/stable-audio      — Text-to-audio / beat generation
 *   fal-ai/f5-tts            — TTS with voice cloning from reference audio
 *   fal-ai/wizper            — Whisper-v3 transcription with word timestamps
 *
 * All endpoints accept an `audioUrl` (HTTPS) from Firebase Storage.
 * Files uploaded by the frontend go to Firebase first, then the URL is
 * forwarded to these endpoints.
 */

import { Router, Request, Response } from 'express';

const router = Router();

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || '';

// ─── helpers ────────────────────────────────────────────────────────────────

function falHeaders() {
  return {
    Authorization: `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function falPost(model: string, body: Record<string, unknown>) {
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: falHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => 'unknown error');
    throw new Error(`FAL ${model} error ${res.status}: ${txt}`);
  }
  return res.json();
}

// ─── POST /api/mastering/separate-stems ──────────────────────────────────────
// Uses fal-ai/demucs to split audio into up to 4 stems.
// Body: { audioUrl: string, model?: "htdemucs" | "htdemucs_ft" | "mdx_extra" }
// Returns: { vocals, drums, bass, other } (each with .url)
router.post('/separate-stems', async (req: Request, res: Response) => {
  try {
    const { audioUrl, model = 'htdemucs' } = req.body;
    if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' });
    if (!FAL_KEY)  return res.status(500).json({ error: 'FAL_KEY not configured' });

    console.log(`🎚️  Stem separation started (${model}): ${audioUrl}`);

    const data = await falPost('fal-ai/demucs', {
      audio_url: audioUrl,
      model,
    });

    // fal-ai/demucs returns { stems: { vocals: {url}, drums: {url}, bass: {url}, other: {url} } }
    const stems = data?.stems || data;
    console.log('✅ Stem separation done');
    res.json({
      success: true,
      stems: {
        vocals:       stems?.vocals?.url  || stems?.vocals  || null,
        drums:        stems?.drums?.url   || stems?.drums   || null,
        bass:         stems?.bass?.url    || stems?.bass    || null,
        other:        stems?.other?.url   || stems?.other   || null,
        accompaniment: stems?.accompaniment?.url || null,
      },
    });
  } catch (err: any) {
    console.error('❌ separate-stems error:', err.message);
    res.status(500).json({ error: 'Stem separation failed', details: err.message });
  }
});

// ─── POST /api/mastering/transcribe ──────────────────────────────────────────
// Uses fal-ai/wizper (Whisper Large v3) to transcribe audio with timestamps.
// Body: { audioUrl: string, language?: string, task?: "transcribe" | "translate" }
// Returns: { text, chunks: [{ text, timestamp: [start, end] }] }
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioUrl, language, task = 'transcribe' } = req.body;
    if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' });
    if (!FAL_KEY)  return res.status(500).json({ error: 'FAL_KEY not configured' });

    console.log(`📝 Transcribing audio: ${audioUrl}`);

    const body: Record<string, unknown> = { audio_url: audioUrl, task };
    if (language) body.language = language;

    const data = await falPost('fal-ai/wizper', body);

    console.log('✅ Transcription done');
    res.json({
      success: true,
      text:   data?.text   || '',
      chunks: data?.chunks || [],
    });
  } catch (err: any) {
    console.error('❌ transcribe error:', err.message);
    res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

// ─── POST /api/mastering/generate-beat ──────────────────────────────────────
// Uses fal-ai/stable-audio to generate music/beats from a text prompt.
// Body: { prompt: string, seconds?: number, steps?: number }
// Returns: { audioUrl }
router.post('/generate-beat', async (req: Request, res: Response) => {
  try {
    const { prompt, seconds = 30, steps = 100 } = req.body;
    if (!prompt)  return res.status(400).json({ error: 'prompt is required' });
    if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

    const safeSeconds = Math.max(5, Math.min(90, Number(seconds) || 30));
    const safeSteps   = Math.max(50, Math.min(200, Number(steps)   || 100));

    console.log(`🥁 Generating beat: "${prompt.slice(0, 60)}…"`);

    const data = await falPost('fal-ai/stable-audio', {
      prompt,
      seconds_start: 0,
      seconds_total: safeSeconds,
      steps: safeSteps,
    });

    // fal-ai/stable-audio returns { audio_file: { url } }
    const audioUrl = data?.audio_file?.url || data?.audio?.url || data?.url || null;
    if (!audioUrl) throw new Error('No audio URL in FAL response');

    console.log(`✅ Beat generated: ${audioUrl}`);
    res.json({ success: true, audioUrl, prompt, seconds: safeSeconds });
  } catch (err: any) {
    console.error('❌ generate-beat error:', err.message);
    res.status(500).json({ error: 'Beat generation failed', details: err.message });
  }
});

// ─── POST /api/mastering/clone-voice ─────────────────────────────────────────
// Uses fal-ai/f5-tts to synthesize text using a reference voice.
// Body: { refAudioUrl: string, refText?: string, genText: string, modelType? }
// Returns: { audioUrl }
router.post('/clone-voice', async (req: Request, res: Response) => {
  try {
    const { refAudioUrl, refText = '', genText, modelType = 'F5-TTS' } = req.body;
    if (!refAudioUrl) return res.status(400).json({ error: 'refAudioUrl is required' });
    if (!genText)     return res.status(400).json({ error: 'genText is required' });
    if (!FAL_KEY)     return res.status(500).json({ error: 'FAL_KEY not configured' });

    const safeText = String(genText).slice(0, 1000);

    console.log(`🎤 Cloning voice for: "${safeText.slice(0, 60)}…"`);

    const data = await falPost('fal-ai/f5-tts', {
      gen_text:      safeText,
      ref_audio_url: refAudioUrl,
      ref_text:      refText,
      model_type:    modelType,
    });

    // fal-ai/f5-tts returns { audio_url: { url } } or { audio: { url } }
    const audioUrl = data?.audio_url?.url || data?.audio?.url || data?.url || null;
    if (!audioUrl) throw new Error('No audio URL in FAL response');

    console.log(`✅ Voice cloned: ${audioUrl}`);
    res.json({ success: true, audioUrl });
  } catch (err: any) {
    console.error('❌ clone-voice error:', err.message);
    res.status(500).json({ error: 'Voice cloning failed', details: err.message });
  }
});

// ─── GET /api/mastering/status ───────────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    fal: { configured: !!FAL_KEY },
    models: {
      stemSeparation:  'fal-ai/demucs',
      transcription:   'fal-ai/wizper',
      beatGeneration:  'fal-ai/stable-audio',
      voiceClone:      'fal-ai/f5-tts',
    },
  });
});

export default router;
