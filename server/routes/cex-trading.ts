/**
 * CEX TRADING API ROUTES
 * Per-artist exchange key management + funding rate scanner + arb position control.
 *
 * Auth model:
 *  • Admin routes: requireAdmin middleware
 *  • Artist routes: authenticated user can only access their own data
 *
 * ⚠️ RISK NOTICE: These endpoints control real money trading operations.
 *   All trading is performed at the artist's own risk with their own exchange accounts.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/require-admin';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import {
  SUPPORTED_EXCHANGES, verifyConnection,
  type SupportedExchangeId,
} from '../services/economic-engine/exchange-connector';
import {
  saveExchangeKeys, getArtistExchangeConfigs,
  deactivateExchangeKey, markKeyVerified, loadExchangeCredentials,
} from '../services/economic-engine/exchange-key-vault';
import {
  runFundingRateScan, getLastScanResults, getLastOpportunities,
  getLastScanTime, getFundingRateHistory, getTopOpportunities,
} from '../services/economic-engine/funding-scanner';
import {
  executeFundingArbCycle, forceClosePosition, getArtistPositions,
} from '../services/economic-engine/funding-arb-agent';
import { artistEconomicProfile } from '../../db/schema';

const router = Router();

// ─── Helper: resolve artist ID from authenticated request ─────────────────

async function resolveArtistId(req: Request): Promise<number | null> {
  const raw = (req as any).user?.id || (req as any).auth?.userId;
  if (!raw) return null;
  if (typeof raw === 'number') return raw;
  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.clerkId, String(raw))).limit(1);
  return user?.id ?? null;
}

// ─── PUBLIC: List supported exchanges ────────────────────────────────────

/** GET /api/cex/exchanges — List all supported exchanges with info (no auth needed) */
router.get('/exchanges', (_req: Request, res: Response) => {
  const list = Object.entries(SUPPORTED_EXCHANGES).map(([id, info]) => ({
    id,
    ...info,
  }));
  res.json({ success: true, exchanges: list });
});

// ─── ARTIST: Exchange key management ─────────────────────────────────────

/** GET /api/cex/keys — Get configured exchanges for the authenticated artist */
router.get('/keys', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req);
    if (!artistId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const configs = await getArtistExchangeConfigs(artistId);
    // Never return encrypted key data
    res.json({ success: true, configs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** POST /api/cex/keys — Save API keys for an exchange */
router.post('/keys', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req);
    if (!artistId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { exchangeId, apiKey, apiSecret, passphrase, isTestnet, label } = req.body;

    if (!exchangeId || !apiKey || !apiSecret) {
      return res.status(400).json({ success: false, message: 'exchangeId, apiKey, and apiSecret are required' });
    }

    if (!SUPPORTED_EXCHANGES[exchangeId as SupportedExchangeId]) {
      return res.status(400).json({ success: false, message: `Unsupported exchange: ${exchangeId}` });
    }

    // OKX (and Bitget) require a passphrase set when creating the API key.
    if (exchangeId === 'okx' && !passphrase) {
      return res.status(400).json({ success: false, message: 'OKX requires a passphrase (the one you set when creating the API key)' });
    }

    const id = await saveExchangeKeys({
      artistId,
      exchangeId: exchangeId as SupportedExchangeId,
      label: label || undefined,
      apiKey,
      apiSecret,
      passphrase: passphrase || undefined,
      isTestnet: isTestnet !== false, // default to testnet for safety
    });

    res.json({ success: true, id, message: 'API keys saved and encrypted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** POST /api/cex/keys/:id/verify — Test that a saved key works */
router.post('/keys/:id/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req);
    if (!artistId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const keyId = parseInt(req.params.id);
    // Load configs to find exchange + testnet flag for this key
    const configs = await getArtistExchangeConfigs(artistId);
    const config = configs.find((c) => c.id === keyId);
    if (!config) return res.status(404).json({ success: false, message: 'Key not found' });

    const creds = await loadExchangeCredentials(artistId, config.exchangeId as SupportedExchangeId, config.isTestnet);
    if (!creds) return res.status(404).json({ success: false, message: 'Failed to load credentials' });

    const result = await verifyConnection(artistId, creds);

    if (result.success) {
      await markKeyVerified(keyId);
    }

    res.json({ success: result.success, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** DELETE /api/cex/keys/:id — Remove (deactivate) an exchange key */
router.delete('/keys/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req);
    if (!artistId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const keyId = parseInt(req.params.id);
    await deactivateExchangeKey(keyId, artistId);
    res.json({ success: true, message: 'Exchange key removed' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

// ─── ARTIST: Positions ────────────────────────────────────────────────────

/** GET /api/cex/positions — Get all arb positions for the authenticated artist */
router.get('/positions', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req);
    if (!artistId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const positions = await getArtistPositions(artistId);
    res.json({ success: true, positions });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** POST /api/cex/positions/:id/close — Force close a position */
router.post('/positions/:id/close', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req);
    if (!artistId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const positionId = parseInt(req.params.id);
    const result = await forceClosePosition(artistId, positionId, 'Manual close by artist');
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

// ─── ARTIST: Funding Scanner (read-only) ─────────────────────────────────

/** GET /api/cex/funding-rates — Get last scan results */
router.get('/funding-rates', authenticate, async (_req: Request, res: Response) => {
  try {
    const results = getLastScanResults();
    const scanTime = getLastScanTime();
    res.json({ success: true, results, scannedAt: scanTime });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** GET /api/cex/opportunities — Get detected arbitrage opportunities */
router.get('/opportunities', authenticate, async (_req: Request, res: Response) => {
  try {
    const opportunities = getLastOpportunities();
    res.json({ success: true, opportunities });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** GET /api/cex/funding-history — Get funding rate history for a symbol */
router.get('/funding-history', authenticate, async (req: Request, res: Response) => {
  try {
    const { exchangeId, symbol, limit } = req.query;
    if (!exchangeId || !symbol) {
      return res.status(400).json({ success: false, message: 'exchangeId and symbol are required' });
    }
    const history = await getFundingRateHistory(
      String(exchangeId), String(symbol), limit ? parseInt(String(limit)) : 48
    );
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

// ─── ADMIN: Scanner control ───────────────────────────────────────────────

/** POST /api/cex/toggle-engine — Enable / disable auto arb cycle in economic brain */
router.post('/toggle-engine', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req);
    if (!artistId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: '`enabled` boolean required' });
    }

    await db.update(artistEconomicProfile)
      .set({ cexTradingEnabled: enabled } as any)
      .where(eq(artistEconomicProfile.artistId, artistId));

    res.json({ success: true, cexTradingEnabled: enabled });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** GET /api/cex/engine-status — Get auto-arb enabled state */
router.get('/engine-status', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req);
    if (!artistId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const [profile] = await db.select({ cexTradingEnabled: (artistEconomicProfile as any).cexTradingEnabled })
      .from(artistEconomicProfile)
      .where(eq(artistEconomicProfile.artistId, artistId))
      .limit(1);

    res.json({ success: true, cexTradingEnabled: profile?.cexTradingEnabled ?? false });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** POST /api/cex/admin/scan — Trigger a manual funding rate scan */
router.post('/admin/scan', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const results = await runFundingRateScan();
    const opportunities = getLastOpportunities();
    res.json({
      success: true,
      scanned: results.length,
      opportunities: opportunities.length,
      topOpportunities: opportunities.slice(0, 5),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** GET /api/cex/admin/top-opportunities — Get top opportunities from DB */
router.get('/admin/top-opportunities', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 20;
    const opportunities = await getTopOpportunities(limit);
    res.json({ success: true, opportunities });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** POST /api/cex/admin/arb-cycle/:artistId — Manually trigger an arb cycle for an artist */
router.post('/admin/arb-cycle/:artistId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const allocationUsd = parseFloat(req.body.allocationUsd ?? '500');
    const results = await executeFundingArbCycle(artistId, allocationUsd);
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/** POST /api/cex/admin/positions/:id/close — Admin force close any position */
router.post('/admin/positions/:id/close', requireAdmin, async (req: Request, res: Response) => {
  try {
    const positionId = parseInt(req.params.id);
    const { artistId, reason } = req.body;
    if (!artistId) return res.status(400).json({ success: false, message: 'artistId required' });
    const result = await forceClosePosition(parseInt(artistId), positionId, reason || 'Admin force close');
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

export default router;
