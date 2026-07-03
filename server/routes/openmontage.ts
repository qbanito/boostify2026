/**
 * OpenMontage sidecar proxy — Fase 2 de la integración OpenMontage
 *
 * Boostify NO ejecuta código de OpenMontage (AGPL-3.0) en su proceso. En su
 * lugar, este router habla por HTTP con un microservicio sidecar opcional
 * (ver openmontage-service/README.md) que envuelve las tools deterministas de
 * OpenMontage en su propio contenedor.
 *
 * Config por env:
 *  - OPENMONTAGE_SERVICE_URL   p.ej. https://openmontage-svc.onrender.com
 *  - OPENMONTAGE_SERVICE_TOKEN token compartido (header x-om-token)
 *
 * Sin configurar → todos los endpoints degradan a 503 con mensaje claro.
 * Los artefactos JSON que devuelva el sidecar (edit_decisions / scene_plan /
 * asset_manifest) se importan al timeline con el importador de la Fase 1.
 */
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { isAuthenticated } from '../middleware/clerk-auth';
import { logger } from '../utils/logger';

const router = Router();

const SERVICE_URL = (process.env.OPENMONTAGE_SERVICE_URL || '').replace(/\/+$/, '');
const SERVICE_TOKEN = process.env.OPENMONTAGE_SERVICE_TOKEN || '';

function serviceHeaders() {
  return SERVICE_TOKEN ? { 'x-om-token': SERVICE_TOKEN } : {};
}

function notConfigured(res: Response) {
  return res.status(503).json({
    success: false,
    configured: false,
    error: 'OpenMontage service no configurado. Define OPENMONTAGE_SERVICE_URL (ver openmontage-service/README.md).',
  });
}

/** Estado del sidecar (público para el editor: decide si mostrar la opción) */
router.get('/status', async (_req: Request, res: Response) => {
  if (!SERVICE_URL) {
    return res.json({ success: true, configured: false, healthy: false });
  }
  try {
    const r = await axios.get(`${SERVICE_URL}/health`, { headers: serviceHeaders(), timeout: 5000 });
    res.json({ success: true, configured: true, healthy: r.status === 200, info: r.data || null });
  } catch {
    res.json({ success: true, configured: true, healthy: false });
  }
});

/**
 * Lanza un job en el sidecar. Body: { tool: string, params: object }
 * Tools deterministas soportadas por el sidecar (whitelist en el propio
 * sidecar): p.ej. 'slideshow_risk', 'video_probe', 'scene_detect'.
 */
router.post('/jobs', isAuthenticated, async (req: Request, res: Response) => {
  if (!SERVICE_URL) return notConfigured(res);
  try {
    const tool = String(req.body?.tool || '').trim();
    const params = req.body?.params && typeof req.body.params === 'object' ? req.body.params : {};
    if (!tool || !/^[a-z0-9_-]{2,64}$/i.test(tool)) {
      return res.status(400).json({ success: false, error: 'tool inválida' });
    }

    const r = await axios.post(
      `${SERVICE_URL}/jobs`,
      { tool, params },
      { headers: serviceHeaders(), timeout: 20_000 }
    );

    // NOTA créditos: las tools actuales del sidecar son de ANÁLISIS (baratas,
    // sin proveedor de pago) → sin cargo. Cuando se expongan tools generativas
    // añadir aquí chargeCredits(email, '<operation>') tras el submit exitoso.

    res.status(r.status).json({ success: true, ...r.data });
  } catch (err: any) {
    const status = err?.response?.status;
    logger.warn?.('[OpenMontage] job submit failed:', err?.message || err);
    res.status(status && status < 500 ? status : 502).json({
      success: false,
      error: err?.response?.data?.error || 'El servicio OpenMontage no respondió',
    });
  }
});

/** Consulta estado/resultado de un job. El resultado puede incluir artefactos
 *  JSON (edit_decisions/scene_plan/asset_manifest) importables en el timeline. */
router.get('/jobs/:jobId', isAuthenticated, async (req: Request, res: Response) => {
  if (!SERVICE_URL) return notConfigured(res);
  try {
    const jobId = String(req.params.jobId || '');
    if (!/^[a-z0-9-]{4,64}$/i.test(jobId)) {
      return res.status(400).json({ success: false, error: 'jobId inválido' });
    }
    const r = await axios.get(`${SERVICE_URL}/jobs/${encodeURIComponent(jobId)}`, {
      headers: serviceHeaders(),
      timeout: 15_000,
    });
    res.status(r.status).json({ success: true, ...r.data });
  } catch (err: any) {
    const status = err?.response?.status;
    res.status(status && status < 500 ? status : 502).json({
      success: false,
      error: err?.response?.data?.error || 'El servicio OpenMontage no respondió',
    });
  }
});

export default router;
