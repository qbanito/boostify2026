/**
 * OpenClaw Admin Routes
 * 
 * Provides admin endpoints to enable/disable OpenClaw,
 * check its status, start/stop the gateway, and invoke adapters.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { getOpenClawGateway } from '../services/openclaw-gateway';
import { OPENCLAW_ADAPTERS, AdapterName } from '../services/openclaw-adapters';
import { requireAdmin } from '../middleware/require-admin';

const router = Router();

// ─── Admin Guard ────────────────────────────────────────────────────
// All OpenClaw routes are already mounted after Clerk auth in server/index.ts.
// requireAdmin adds admin-email check (401 if unauthenticated, 403 if not admin).
router.use(requireAdmin);

// GET /api/admin/openclaw/status — Get current OpenClaw status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const gateway = getOpenClawGateway();
    res.json({ success: true, status: gateway.status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/openclaw/toggle — Enable/disable OpenClaw
router.post('/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }

    const gateway = getOpenClawGateway();

    if (enabled) {
      await gateway.enable();
      console.log('[Admin] OpenClaw ENABLED');
    } else {
      await gateway.disable();
      console.log('[Admin] OpenClaw DISABLED');
    }

    res.json({ success: true, status: gateway.status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/openclaw/start — Start the gateway process
router.post('/start', async (_req: Request, res: Response) => {
  try {
    const gateway = getOpenClawGateway();
    const status = await gateway.start();
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/openclaw/stop — Stop the gateway process
router.post('/stop', async (_req: Request, res: Response) => {
  try {
    const gateway = getOpenClawGateway();
    await gateway.stop();
    res.json({ success: true, status: gateway.status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/openclaw/health — Health check
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const gateway = getOpenClawGateway();
    const health = await gateway.healthCheck();
    res.json({ success: true, ...health });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/openclaw/message — Send a message to OpenClaw agent
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    // Basic input sanitization to prevent prompt injection
    const sanitized = message.slice(0, 2000).replace(/[<>]/g, '');
    
    const gateway = getOpenClawGateway();
    const result = await gateway.sendMessage(sanitized, sessionId);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/openclaw/adapter/:name — Invoke a specific adapter
router.post('/adapter/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    if (!(name in OPENCLAW_ADAPTERS)) {
      return res.status(404).json({ success: false, error: `Unknown adapter: ${name}` });
    }

    const adapterFn = OPENCLAW_ADAPTERS[name as AdapterName];
    const result = await adapterFn(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/openclaw/adapters — List available adapters
router.get('/adapters', (_req: Request, res: Response) => {
  res.json({
    success: true,
    adapters: Object.keys(OPENCLAW_ADAPTERS),
  });
});

export default router;
