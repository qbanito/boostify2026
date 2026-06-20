/**
 * ECONOMIC ENGINE API ROUTES
 * Admin controls + artist vault queries + agent management
 * + Real operations: blockchain status, market data, token ops, community
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  economicEngineConfig, artistEconomicProfile, artistTreasuryVault,
  treasuryTransactions, defiPositions, defiAgentActions,
  riskEngineState, economicEngineAuditLog, users
} from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAdminEmail } from '../../shared/constants';
import { requireAdmin } from '../middleware/require-admin';
import { 
  runEconomicCycle, processEconomicEngineTick, 
  calculateKPIs, simulateDistribution, getEngineStatus 
} from '../services/economic-engine/economic-brain';
import { processIncome } from '../services/economic-engine/revenue-router';
import { forceMode } from '../services/economic-engine/risk-engine';
import { clearShieldVeto } from '../services/economic-engine/shield-node';
import { distributeProfits, rebalanceVault } from '../services/economic-engine/profit-distributor';
import { getConfigStatus, isConfigured as blockchainConfigured } from '../services/economic-engine/blockchain-provider';
import { getWalletManager } from '../services/economic-engine/wallet-manager';
import { getMarketIntelligence } from '../services/economic-engine/market-intelligence';
import { getTokenOperations, getListingStrategy } from '../services/economic-engine/token-operations';
import { getCommunityManager } from '../services/economic-engine/community-bots';
import { getSecurityChecker } from '../services/economic-engine/defi-adapters';
import { buildInstitutionalKPIReport } from '../services/economic-engine/portfolio-analytics';
import {
  backtestStrategy, compareStrategies, walkForwardOptimize, validateMarketHunterParams,
} from '../services/economic-engine/strategy-backtester';
import { getMacroRiskSignal } from '../services/economic-engine/macro-intelligence';

const router = Router();

// ============================================
// MIDDLEWARE: Admin check — uses canonical requireAdmin from middleware/require-admin
// ============================================

function getAdminId(req: Request): number {
  return (req as any).user?.id || (req as any).auth?.userId || 0;
}

// Resolve numeric user ID from Clerk auth string or numeric ID
async function resolveNumericUserId(req: Request): Promise<number | null> {
  const raw = (req as any).user?.id || (req as any).auth?.userId;
  if (!raw) return null;
  if (typeof raw === 'number') return raw;
  // Clerk sends string ID like "user_xxx" — resolve from DB
  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.clerkId, String(raw))).limit(1);
  return user?.id ?? null;
}

// ============================================
// ADMIN: Global Configuration
// ============================================

/** GET /admin/global-config — Get global engine config */
router.get('/admin/global-config', requireAdmin, async (req, res) => {
  try {
    let [config] = await db.select().from(economicEngineConfig).limit(1);
    if (!config) {
      // Seed default config
      [config] = await db.insert(economicEngineConfig).values({
        isGloballyEnabled: false,
      }).returning();
    }
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /admin/global-config — Update global config */
router.patch('/admin/global-config', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    let [config] = await db.select().from(economicEngineConfig).limit(1);
    
    if (!config) {
      [config] = await db.insert(economicEngineConfig).values({
        ...updates,
        updatedBy: getAdminId(req),
      }).returning();
    } else {
      [config] = await db.update(economicEngineConfig)
        .set({ ...updates, updatedAt: new Date(), updatedBy: getAdminId(req) })
        .where(eq(economicEngineConfig.id, config.id))
        .returning();
    }

    // Log the toggle if global enabled state changed
    if (updates.isGloballyEnabled !== undefined) {
      await db.insert(economicEngineAuditLog).values({
        actorId: getAdminId(req),
        actorType: 'admin',
        action: 'global_toggle',
        description: `Global engine ${updates.isGloballyEnabled ? 'ENABLED' : 'DISABLED'}`,
        newState: { isGloballyEnabled: updates.isGloballyEnabled },
      });
    }

    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADMIN: Artist Management
// ============================================

/** GET /admin/artists — List all artists with engine state */
router.get('/admin/artists', requireAdmin, async (req, res) => {
  try {
    const artists = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      profileImageUrl: users.profileImageUrl,
      engineEnabled: artistEconomicProfile.isEnabled,
      operatingMode: artistEconomicProfile.operatingMode,
      defiEnabled: artistEconomicProfile.defiEnabled,
      enabledAt: artistEconomicProfile.enabledAt,
      lastCycleAt: artistEconomicProfile.lastCycleAt,
      operationBalance: artistTreasuryVault.operationBalance,
      reserveBalance: artistTreasuryVault.reserveBalance,
      growthBalance: artistTreasuryVault.growthBalance,
      defiBalance: artistTreasuryVault.defiBalance,
      totalDeposited: artistTreasuryVault.totalDeposited,
      totalDefiProfit: artistTreasuryVault.totalDefiProfit,
      shieldVetoActive: riskEngineState.shieldVetoActive,
      healthScore: riskEngineState.healthScore,
    })
    .from(users)
    .leftJoin(artistEconomicProfile, eq(users.id, artistEconomicProfile.artistId))
    .leftJoin(artistTreasuryVault, eq(users.id, artistTreasuryVault.artistId))
    .leftJoin(riskEngineState, eq(users.id, riskEngineState.artistId))
    .where(eq(users.role, 'artist'))
    .orderBy(desc(artistEconomicProfile.isEnabled));

    res.json({ success: true, artists });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /admin/toggle/:artistId — Enable/disable engine for an artist */
router.post('/admin/toggle/:artistId', requireAdmin, async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const userId = await resolveNumericUserId(req);

    // Verify the artist exists in users table
    const [artistExists] = await db.select({ id: users.id }).from(users)
      .where(eq(users.id, artistId)).limit(1);
    if (!artistExists) {
      return res.status(404).json({ success: false, message: `Artist ${artistId} not found in users table` });
    }

    const [existing] = await db.select().from(artistEconomicProfile)
      .where(eq(artistEconomicProfile.artistId, artistId));

    const newState = !existing?.isEnabled;

    if (existing) {
      await db.update(artistEconomicProfile).set({
        isEnabled: newState,
        // When activating, also turn on DeFi so Flow Maker + Alpha Hunter
        // run alongside Capital Keeper. Without this, $10 vaults barely
        // move (~2.5% APY on Capital Keeper alone).
        ...(newState ? { defiEnabled: true } : {}),
        enabledBy: newState ? (userId || artistId) : undefined,
        enabledAt: newState ? new Date() : undefined,
      }).where(eq(artistEconomicProfile.artistId, artistId));
    } else {
      await db.insert(artistEconomicProfile).values({
        artistId,
        isEnabled: true,
        defiEnabled: true,
        enabledBy: userId || artistId,
        enabledAt: new Date(),
      });
      // Also create vault
      await db.insert(artistTreasuryVault).values({ artistId })
        .onConflictDoNothing();
      // Also create risk engine state
      await db.insert(riskEngineState).values({ artistId })
        .onConflictDoNothing();
    }

    // Audit log — skip if no valid userId to avoid FK error
    if (userId || artistId) {
      await db.insert(economicEngineAuditLog).values({
        artistId,
        actorId: userId || artistId,
        actorType: 'admin',
        action: newState ? 'engine_enabled' : 'engine_disabled',
        description: `Economic Engine ${newState ? 'activated' : 'deactivated'} for artist ${artistId}`,
      }).catch(() => {}); // Non-critical, don't fail the toggle
    }

    res.json({ success: true, isEnabled: newState, artistId });
  } catch (error: any) {
    console.error('[EconomicEngine] Toggle error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /admin/toggle-day-trading/:artistId — Opt-in/out of Market Hunter (day trading) */
router.post('/admin/toggle-day-trading/:artistId', requireAdmin, async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const userId = await resolveNumericUserId(req);

    const [existing] = await db.select().from(artistEconomicProfile)
      .where(eq(artistEconomicProfile.artistId, artistId));
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Economic profile not found. Activate the engine first.' });
    }

    const newState = !(existing as any).dayTradingEnabled;

    await db.update(artistEconomicProfile).set({
      dayTradingEnabled: newState,
      // Ensure DeFi must be enabled for day trading to actually run
      ...(newState ? { defiEnabled: true } : {}),
    } as any).where(eq(artistEconomicProfile.artistId, artistId));

    await db.insert(economicEngineAuditLog).values({
      artistId,
      actorId: userId || artistId,
      actorType: 'admin',
      action: newState ? 'day_trading_enabled' : 'day_trading_disabled',
      description: `Day trading (Market Hunter) ${newState ? 'activated' : 'deactivated'} for artist ${artistId}`,
    }).catch(() => {});

    res.json({ success: true, dayTradingEnabled: newState, artistId });
  } catch (error: any) {
    console.error('[EconomicEngine] Day trading toggle error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /admin/batch-toggle — Enable/disable for multiple artists */
router.post('/admin/batch-toggle', requireAdmin, async (req, res) => {
  try {
    const { artistIds, enable } = req.body;
    const adminId = getAdminId(req);
    const results = [];

    for (const artistId of artistIds) {
      const [existing] = await db.select().from(artistEconomicProfile)
        .where(eq(artistEconomicProfile.artistId, artistId));

      if (existing) {
        await db.update(artistEconomicProfile).set({
          isEnabled: enable,
          enabledBy: enable ? adminId : undefined,
          enabledAt: enable ? new Date() : undefined,
        }).where(eq(artistEconomicProfile.artistId, artistId));
      } else if (enable) {
        await db.insert(artistEconomicProfile).values({
          artistId,
          isEnabled: true,
          enabledBy: adminId,
          enabledAt: new Date(),
        });
        await db.insert(artistTreasuryVault).values({ artistId }).onConflictDoNothing();
      }

      results.push({ artistId, isEnabled: enable });
    }

    await db.insert(economicEngineAuditLog).values({
      actorId: adminId,
      actorType: 'admin',
      action: enable ? 'engine_enabled' : 'engine_disabled',
      description: `Batch ${enable ? 'enable' : 'disable'}: ${artistIds.length} artists`,
      newState: { artistIds, enable },
    });

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /admin/set-mode/:artistId — Force operating mode */
router.patch('/admin/set-mode/:artistId', requireAdmin, async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const { mode, reason } = req.body;
    const adminId = getAdminId(req);

    const result = await forceMode(artistId, mode, adminId, reason || 'Admin override');
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /admin/set-distribution/:artistId — Custom distribution % */
router.patch('/admin/set-distribution/:artistId', requireAdmin, async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const { distributionMatrix, defiSplit } = req.body;
    const adminId = getAdminId(req);

    // Validate percentages sum to 100
    if (distributionMatrix) {
      const total = Object.values(distributionMatrix).reduce((s: number, v: any) => s + v, 0);
      if (Math.abs(total - 100) > 0.01) {
        return res.status(400).json({ success: false, message: `Distribution must sum to 100%, got ${total}%` });
      }
    }
    if (defiSplit) {
      const total = Object.values(defiSplit).reduce((s: number, v: any) => s + v, 0);
      if (Math.abs(total - 100) > 0.01) {
        return res.status(400).json({ success: false, message: `DeFi split must sum to 100%, got ${total}%` });
      }
    }

    const updateData: any = {};
    if (distributionMatrix) updateData.distributionMatrix = distributionMatrix;
    if (defiSplit) updateData.defiSplit = defiSplit;

    await db.update(artistEconomicProfile)
      .set(updateData)
      .where(eq(artistEconomicProfile.artistId, artistId));

    await db.insert(economicEngineAuditLog).values({
      artistId,
      actorId: adminId,
      actorType: 'admin',
      action: 'distribution_updated',
      newState: updateData,
      description: 'Custom distribution/split updated',
    });

    res.json({ success: true, updated: updateData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /admin/risk-override/:artistId — Clear Shield veto */
router.post('/admin/risk-override/:artistId', requireAdmin, async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const adminId = getAdminId(req);
    await clearShieldVeto(artistId, adminId);
    res.json({ success: true, message: 'Shield veto cleared' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /admin/audit-log — Full audit trail */
router.get('/admin/audit-log', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await db.select().from(economicEngineAuditLog)
      .orderBy(desc(economicEngineAuditLog.createdAt))
      .limit(limit);
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ARTIST VAULT & STATUS
// ============================================

/** GET /vault/:artistId — Vault balances */
router.get('/vault/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const [vault] = await db.select().from(artistTreasuryVault)
      .where(eq(artistTreasuryVault.artistId, artistId));
    res.json({ success: true, vault: vault || null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /positions/:artistId — Active DeFi positions */
router.get('/positions/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const positions = await db.select().from(defiPositions)
      .where(and(eq(defiPositions.artistId, artistId), eq(defiPositions.status, 'active')))
      .orderBy(desc(defiPositions.openedAt));
    res.json({ success: true, positions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /agents/:artistId/actions — Agent action history */
router.get('/agents/:artistId/actions', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const limit = parseInt(req.query.limit as string) || 50;
    const actions = await db.select().from(defiAgentActions)
      .where(eq(defiAgentActions.artistId, artistId))
      .orderBy(desc(defiAgentActions.createdAt))
      .limit(limit);
    res.json({ success: true, actions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /agents/:artistId/status — Agent status summary */
router.get('/agents/:artistId/status', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const status = await getEngineStatus(artistId);
    const cfg = getConfigStatus();
    res.json({
      success: true,
      ...status,
      // Surface real-vs-simulation telemetry to the profile dashboard so
      // users can tell whether on-chain ops are wired up via Render env vars.
      realMode: {
        walletConfigured: cfg.walletConfigured,
        alchemyConfigured: cfg.alchemyConfigured,
        active: blockchainConfigured(),
        network: cfg.network,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /risk/:artistId — Risk engine state */
router.get('/risk/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const [state] = await db.select().from(riskEngineState)
      .where(eq(riskEngineState.artistId, artistId));
    res.json({ success: true, riskState: state || null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// OPERATIONS
// ============================================

/** POST /simulate/:artistId — Simulate distribution */
router.post('/simulate/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const { amount } = req.body;
    const result = await simulateDistribution(artistId, amount);
    res.json({ success: true, simulation: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /run-cycle/:artistId — Manual cycle trigger */
router.post('/run-cycle/:artistId', requireAdmin, async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const result = await runEconomicCycle(artistId);
    
    await db.insert(economicEngineAuditLog).values({
      artistId,
      actorId: getAdminId(req),
      actorType: 'admin',
      action: 'cycle_executed',
      description: `Manual cycle: mode=${result?.mode}, actions=${result?.agentActions.length}`,
    });

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /cascade/:artistId — Manual profit cascade */
router.post('/cascade/:artistId', requireAdmin, async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const { amount } = req.body;
    const result = await distributeProfits(artistId, amount);
    res.json({ success: true, distribution: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /rebalance/:artistId — Manual rebalance */
router.post('/rebalance/:artistId', requireAdmin, async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const messages = await rebalanceVault(artistId, getAdminId(req));
    res.json({ success: true, messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /kpis/:artistId — KPI dashboard */
router.get('/kpis/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const kpis = await calculateKPIs(artistId);
    res.json({ success: true, kpis });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /transactions/:artistId — Treasury transaction history */
router.get('/transactions/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await db.select().from(treasuryTransactions)
      .where(eq(treasuryTransactions.artistId, artistId))
      .orderBy(desc(treasuryTransactions.createdAt))
      .limit(limit);
    res.json({ success: true, transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// BLOCKCHAIN & REAL OPERATIONS (Layer 3 Real Mode)
// ============================================

/** GET /blockchain/status — Blockchain + wallet configuration status */
router.get('/blockchain/status', requireAdmin, async (req, res) => {
  try {
    const status = getConfigStatus();
    const intel = getMarketIntelligence();
    const systemStatus = intel.getSystemStatus();
    res.json({ success: true, ...systemStatus });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /blockchain/balances — Real on-chain wallet balances */
router.get('/blockchain/balances', requireAdmin, async (req, res) => {
  try {
    if (!blockchainConfigured()) {
      return res.json({ success: true, mode: 'not_configured', balances: null });
    }
    const wallet = getWalletManager();
    const balances = await wallet.getWalletBalances();
    res.json({ success: true, mode: 'real', balances });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// MARKET DATA & INTELLIGENCE
// ============================================

/** GET /market/snapshot — Full market intelligence report */
router.get('/market/snapshot', requireAdmin, async (req, res) => {
  try {
    const intel = getMarketIntelligence();
    const report = await intel.generateReport();
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /market/yields — Available yield opportunities */
router.get('/market/yields', requireAdmin, async (req, res) => {
  try {
    const intel = getMarketIntelligence();
    const yields = await intel.getYieldOpportunities();
    res.json({ success: true, yields });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// TOKEN OPERATIONS (BTF)
// ============================================

/** GET /token/info — BTF token info */
router.get('/token/info', requireAdmin, async (req, res) => {
  try {
    const ops = getTokenOperations();
    const info = await ops.getTokenInfo();
    res.json({ success: true, token: info });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /token/pool — BTF pool data from DEXs */
router.get('/token/pool', requireAdmin, async (req, res) => {
  try {
    const ops = getTokenOperations();
    const pool = await ops.getPoolData();
    res.json({ success: true, pool });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /token/audit — Security audit for BTF or any token */
router.get('/token/audit', requireAdmin, async (req, res) => {
  try {
    const address = req.query.address as string;
    if (!address) {
      return res.status(400).json({ success: false, message: 'Token address required' });
    }
    const ops = getTokenOperations();
    const audit = await ops.auditToken(address);
    res.json({ success: true, audit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /token/metrics — BTF token metrics dashboard */
router.get('/token/metrics', requireAdmin, async (req, res) => {
  try {
    const ops = getTokenOperations();
    const metrics = await ops.getMetrics();
    res.json({ success: true, metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /token/listings — Exchange listing strategy & progress */
router.get('/token/listings', requireAdmin, async (req, res) => {
  try {
    const listings = getListingStrategy();
    res.json({ success: true, listings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// COMMUNITY MANAGEMENT
// ============================================

/** GET /community/status — Community bots status */
router.get('/community/status', requireAdmin, async (req, res) => {
  try {
    const community = getCommunityManager();
    const status = community.getStatus();
    res.json({ success: true, community: status });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /community/alert — Send alert to all channels */
router.post('/community/alert', requireAdmin, async (req, res) => {
  try {
    const { title, message, severity } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message required' });
    }
    const community = getCommunityManager();
    await community.broadcastAlert({ title, message, severity: severity || 'info' });
    res.json({ success: true, message: 'Alert broadcast sent' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /community/price-update — Send price update to all channels */
router.post('/community/price-update', requireAdmin, async (req, res) => {
  try {
    const { token, price, change24h, volume24h } = req.body;
    const community = getCommunityManager();
    await community.broadcastPriceUpdate({ token, price, change24h, volume24h });
    res.json({ success: true, message: 'Price update broadcast sent' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SECURITY
// ============================================

/** GET /security/check/:address — Check token security via GoPlus */
router.get('/security/check/:address', requireAdmin, async (req, res) => {
  try {
    const address = req.params.address;
    const checker = getSecurityChecker();
    const result = await checker.checkTokenSecurity(address);
    res.json({ success: true, security: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// WALLET FUNDING (MetaMask integration)
// ============================================

/** GET /wallet/treasury-address — Get platform treasury wallet address for MetaMask transfers */
router.get('/wallet/treasury-address', async (req, res) => {
  try {
    const configStatus = getConfigStatus();
    // Treasury address: explicit env var, or derive from private key
    let treasuryAddress = process.env.TREASURY_WALLET_ADDRESS || '';
    if (!treasuryAddress) {
      const privKey = process.env.PLATFORM_PRIVATE_KEY || process.env.TREASURY_WALLET_PRIVATE_KEY;
      if (privKey) {
        try {
          const { ethers } = await import('ethers');
          const wallet = new ethers.Wallet(privKey);
          treasuryAddress = wallet.address;
        } catch (e) {
          console.warn('Failed to derive treasury address from private key');
        }
      }
    }
    res.json({
      success: true,
      address: treasuryAddress,
      network: 'Polygon Mainnet',
      chainId: 137,
      configured: !!treasuryAddress,
      acceptedTokens: [
        { symbol: 'MATIC', address: 'native', decimals: 18 },
        { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
        { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      ],
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /wallet/record-deposit/:artistId — Record a MetaMask deposit after on-chain confirmation */
router.post('/wallet/record-deposit/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const { txHash, amount, token, senderAddress } = req.body;

    if (!txHash || !amount || !token || !senderAddress) {
      return res.status(400).json({ success: false, message: 'Missing txHash, amount, token, or senderAddress' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Check artist exists
    const [artist] = await db.select({ id: users.id }).from(users)
      .where(eq(users.id, artistId)).limit(1);
    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist not found' });
    }

    // Get or create vault
    let [vault] = await db.select().from(artistTreasuryVault)
      .where(eq(artistTreasuryVault.artistId, artistId));
    if (!vault) {
      [vault] = await db.insert(artistTreasuryVault).values({ artistId }).returning();
    }

    // Distribute deposit according to engine config
    let [config] = await db.select().from(economicEngineConfig).limit(1);
    const dist = (config?.defaultDistribution as any) || { operation: 35, reserve: 20, growth: 20, defi: 20, boostifyFee: 5 };
    const afterFee = numericAmount * (1 - (dist.boostifyFee || 5) / 100);
    const totalParts = dist.operation + dist.reserve + dist.growth + dist.defi;

    const opAdd = (afterFee * dist.operation / totalParts);
    const resAdd = (afterFee * dist.reserve / totalParts);
    const growAdd = (afterFee * dist.growth / totalParts);
    const defiAdd = (afterFee * dist.defi / totalParts);

    // Update vault balances
    await db.update(artistTreasuryVault).set({
      operationBalance: sql`${artistTreasuryVault.operationBalance} + ${opAdd.toFixed(2)}`,
      reserveBalance: sql`${artistTreasuryVault.reserveBalance} + ${resAdd.toFixed(2)}`,
      growthBalance: sql`${artistTreasuryVault.growthBalance} + ${growAdd.toFixed(2)}`,
      defiBalance: sql`${artistTreasuryVault.defiBalance} + ${defiAdd.toFixed(2)}`,
      totalDeposited: sql`${artistTreasuryVault.totalDeposited} + ${numericAmount.toFixed(2)}`,
      updatedAt: new Date(),
    }).where(eq(artistTreasuryVault.artistId, artistId));

    // Record transaction
    await db.insert(treasuryTransactions).values({
      artistId,
      transactionType: 'income_deposit',
      amount: numericAmount.toFixed(2),
      description: `MetaMask deposit: ${numericAmount} ${token} from ${senderAddress.slice(0, 8)}...${senderAddress.slice(-4)} (tx: ${txHash.slice(0, 10)}...)`,
      triggeredBy: 'system',
      metadata: { txHash, token, senderAddress, network: 'polygon', distribution: { operation: opAdd, reserve: resAdd, growth: growAdd, defi: defiAdd, fee: numericAmount - afterFee } },
    });

    // Audit log
    await db.insert(economicEngineAuditLog).values({
      artistId,
      actorId: artistId,
      actorType: 'system',
      action: 'wallet_deposit',
      description: `MetaMask deposit: $${numericAmount.toFixed(2)} ${token}`,
      newState: { txHash, amount: numericAmount, token },
    });

    res.json({
      success: true,
      deposit: {
        amount: numericAmount,
        afterFee,
        distribution: { operation: opAdd, reserve: resAdd, growth: growAdd, defi: defiAdd },
        fee: numericAmount - afterFee,
        txHash,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// STRIPE CHECKOUT — Direct card deposit to vault
// ============================================

import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.TESTING_STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as any }) : null;

const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.PRODUCTION_URL || 'https://boostifymusic.com';
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
};

/** POST /wallet/create-checkout/:artistId — Create Stripe Checkout for vault deposit */
router.post('/wallet/create-checkout/:artistId', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe not configured' });
    }

    const artistId = parseInt(req.params.artistId);
    const { amount } = req.body;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 5 || numericAmount > 10000) {
      return res.status(400).json({ success: false, message: 'Amount must be between $5 and $10,000' });
    }

    // Verify artist exists
    const [artist] = await db.select({ id: users.id, username: users.username })
      .from(users).where(eq(users.id, artistId)).limit(1);
    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist not found' });
    }

    const baseUrl = getBaseUrl();
    const unitAmount = Math.round(numericAmount * 100); // cents

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Economic Engine — Vault Deposit',
            description: `Fund your artist vault with $${numericAmount.toFixed(2)} USD`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${baseUrl}/artist/${artistId}?vault_deposit=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/artist/${artistId}?vault_deposit=cancelled`,
      metadata: {
        type: 'vault_deposit',
        artistId: String(artistId),
        amount: String(numericAmount),
      },
    });

    res.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error('Error creating vault checkout:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create checkout session' });
  }
});

/** POST /wallet/confirm-checkout — Confirm Stripe checkout and credit vault (called by webhook or client) */
router.post('/wallet/confirm-checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe not configured' });
    }

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Missing sessionId' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Payment not completed' });
    }

    if (session.metadata?.type !== 'vault_deposit') {
      return res.status(400).json({ success: false, message: 'Invalid session type' });
    }

    const artistId = parseInt(session.metadata.artistId);
    const numericAmount = parseFloat(session.metadata.amount);

    if (isNaN(artistId) || isNaN(numericAmount)) {
      return res.status(400).json({ success: false, message: 'Invalid session metadata' });
    }

    // Prevent double-processing: check if this session was already recorded
    const existingTx = await db.select({ id: treasuryTransactions.id })
      .from(treasuryTransactions)
      .where(sql`${treasuryTransactions.metadata}->>'stripeSessionId' = ${sessionId}`)
      .limit(1);

    if (existingTx.length > 0) {
      return res.json({ success: true, message: 'Already processed', alreadyProcessed: true });
    }

    // Get or create vault
    let [vault] = await db.select().from(artistTreasuryVault)
      .where(eq(artistTreasuryVault.artistId, artistId));
    if (!vault) {
      [vault] = await db.insert(artistTreasuryVault).values({ artistId }).returning();
    }

    // Distribute deposit
    let [config] = await db.select().from(economicEngineConfig).limit(1);
    const dist = (config?.defaultDistribution as any) || { operation: 35, reserve: 20, growth: 20, defi: 20, boostifyFee: 5 };
    const afterFee = numericAmount * (1 - (dist.boostifyFee || 5) / 100);
    const totalParts = dist.operation + dist.reserve + dist.growth + dist.defi;

    const opAdd = (afterFee * dist.operation / totalParts);
    const resAdd = (afterFee * dist.reserve / totalParts);
    const growAdd = (afterFee * dist.growth / totalParts);
    const defiAdd = (afterFee * dist.defi / totalParts);

    await db.update(artistTreasuryVault).set({
      operationBalance: sql`${artistTreasuryVault.operationBalance} + ${opAdd.toFixed(2)}`,
      reserveBalance: sql`${artistTreasuryVault.reserveBalance} + ${resAdd.toFixed(2)}`,
      growthBalance: sql`${artistTreasuryVault.growthBalance} + ${growAdd.toFixed(2)}`,
      defiBalance: sql`${artistTreasuryVault.defiBalance} + ${defiAdd.toFixed(2)}`,
      totalDeposited: sql`${artistTreasuryVault.totalDeposited} + ${numericAmount.toFixed(2)}`,
      updatedAt: new Date(),
    }).where(eq(artistTreasuryVault.artistId, artistId));

    await db.insert(treasuryTransactions).values({
      artistId,
      transactionType: 'income_deposit',
      amount: numericAmount.toFixed(2),
      description: `Stripe card deposit: $${numericAmount.toFixed(2)} USD (session: ${sessionId.slice(0, 16)}...)`,
      triggeredBy: 'system',
      metadata: { stripeSessionId: sessionId, paymentMethod: 'card', distribution: { operation: opAdd, reserve: resAdd, growth: growAdd, defi: defiAdd, fee: numericAmount - afterFee } },
    });

    await db.insert(economicEngineAuditLog).values({
      artistId,
      actorId: artistId,
      actorType: 'system',
      action: 'wallet_deposit',
      description: `Stripe card deposit: $${numericAmount.toFixed(2)} USD`,
      newState: { stripeSessionId: sessionId, amount: numericAmount, method: 'card' },
    });

    res.json({
      success: true,
      deposit: {
        amount: numericAmount,
        afterFee,
        distribution: { operation: opAdd, reserve: resAdd, growth: growAdd, defi: defiAdd },
        fee: numericAmount - afterFee,
      },
    });
  } catch (error: any) {
    console.error('Error confirming vault checkout:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

// ============================================
// V2 INTELLIGENCE ENDPOINTS
// ============================================

/** GET /api/economic-engine/:artistId/analytics — Institutional KPI report */
router.get('/:artistId/analytics', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ success: false, message: 'Invalid artistId' });
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const kpis = await buildInstitutionalKPIReport(artistId);
    res.json({ success: true, kpis });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/economic-engine/:artistId/backtest — Validate artist's current Market Hunter params */
router.get('/:artistId/backtest', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ success: false, message: 'Invalid artistId' });
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const validation = await validateMarketHunterParams(artistId);
    res.json({ success: true, validation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/economic-engine/:artistId/backtest — Run custom backtest */
router.post('/:artistId/backtest', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ success: false, message: 'Invalid artistId' });
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const {
      coingeckoId, symbol, strategy, periodDays,
      stopLossPct, takeProfitPct, allocationUsd,
    } = req.body;

    if (!coingeckoId || !strategy || !periodDays) {
      return res.status(400).json({ success: false, message: 'Missing required fields: coingeckoId, strategy, periodDays' });
    }

    const result = await backtestStrategy({
      coingeckoId,
      symbol: symbol || coingeckoId,
      strategy,
      periodDays,
      stopLossPct: stopLossPct ?? 0.03,
      takeProfitPct: takeProfitPct ?? 0.05,
      allocationUsd: allocationUsd ?? 1000,
    });

    res.json({ success: true, backtest: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/economic-engine/:artistId/macro — Real-time macro risk signal */
router.get('/:artistId/macro', async (req: Request, res: Response) => {
  try {
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const signal = await getMacroRiskSignal();
    res.json({ success: true, macro: signal ?? { level: 30, factors: ['Macro data unavailable'], riskLabel: 'moderate', recommendedMode: null } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/economic-engine/:artistId/optimize — Walk-forward strategy optimization */
router.post('/:artistId/optimize', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ success: false, message: 'Invalid artistId' });
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { coingeckoId, symbol, strategy, periodDays, inSamplePct } = req.body;
    if (!coingeckoId || !strategy) {
      return res.status(400).json({ success: false, message: 'Missing required fields: coingeckoId, strategy' });
    }

    const result = await walkForwardOptimize({
      coingeckoId,
      symbol: symbol || coingeckoId,
      strategy,
      periodDays: periodDays ?? 180,
      inSamplePct: inSamplePct ?? 0.7,
    });

    res.json({ success: true, optimization: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/economic-engine/:artistId/compare-strategies — Compare all strategies on an asset */
router.get('/:artistId/compare-strategies', async (req: Request, res: Response) => {
  try {
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { coingeckoId, symbol, periodDays } = req.query as Record<string, string>;
    if (!coingeckoId) return res.status(400).json({ success: false, message: 'Missing coingeckoId' });

    const comparisons = await compareStrategies(
      coingeckoId,
      symbol || coingeckoId,
      (parseInt(periodDays ?? '180') as 90 | 180 | 365) || 180,
    );

    res.json({ success: true, comparisons });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
