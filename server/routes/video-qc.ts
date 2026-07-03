/**
 * Video QC — quality gate post-render con ffprobe
 *
 * POST /api/video-qc/probe { videoUrl } → metadata + checks de calidad.
 * Usa el binario ffprobe (ya presente en el entorno: ver promo-audio-mixer).
 * Sin costo de créditos (es un check, no generación).
 */
import { Router, Request, Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { isAuthenticated } from '../middleware/clerk-auth';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);
const router = Router();

/** Anti-SSRF: solo https/http públicos, nunca hosts internos/privados. */
function isSafeMediaUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^\[?(::1|fe80:|fc00:|fd00:)/i.test(host)
  ) {
    return false;
  }
  return true;
}

router.post('/probe', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const videoUrl = String(req.body?.videoUrl || '').trim();
    if (!videoUrl) return res.status(400).json({ success: false, error: 'videoUrl requerido' });
    if (videoUrl.length > 2048 || !isSafeMediaUrl(videoUrl)) {
      return res.status(400).json({ success: false, error: 'URL no permitida' });
    }

    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoUrl,
      ],
      { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 }
    );

    const data = JSON.parse(stdout || '{}');
    const streams: any[] = Array.isArray(data.streams) ? data.streams : [];
    const video = streams.find((s) => s.codec_type === 'video');
    const audio = streams.find((s) => s.codec_type === 'audio');

    const durationSec = parseFloat(data.format?.duration || video?.duration || '0') || 0;
    const width = Number(video?.width) || 0;
    const height = Number(video?.height) || 0;
    let fps = 0;
    if (video?.avg_frame_rate && video.avg_frame_rate !== '0/0') {
      const [n, d] = String(video.avg_frame_rate).split('/').map(Number);
      if (n && d) fps = Math.round((n / d) * 100) / 100;
    }
    const bitrate = Number(data.format?.bit_rate) || 0;

    const checks = [
      { label: 'Duración válida (>1s)', pass: durationSec > 1 },
      { label: 'Resolución HD (≥720p)', pass: Math.min(width, height) >= 720 || Math.max(width, height) >= 1280 },
      { label: 'Framerate estable (≥23fps)', pass: fps >= 23 },
      { label: 'Pista de audio presente', pass: !!audio },
      { label: 'Bitrate razonable (≥1 Mbps)', pass: bitrate >= 1_000_000 || bitrate === 0 },
    ];

    res.json({
      success: true,
      probe: {
        durationSec,
        width,
        height,
        fps,
        bitrate,
        videoCodec: video?.codec_name || null,
        audioCodec: audio?.codec_name || null,
        hasAudio: !!audio,
        checks,
        passed: checks.every((c) => c.pass),
      },
    });
  } catch (err: any) {
    logger.warn?.('[VideoQC] probe failed:', err?.message || err);
    res.status(422).json({
      success: false,
      error: 'No se pudo analizar el video (URL inaccesible o formato no soportado)',
    });
  }
});

export default router;
