/**
 * PROFIT DISTRIBUTOR — Cascade Recycling of DeFi Profits
 * Ensures gains strengthen the artist over time
 * Cascade: 40% Reserve → 30% Growth → 20% Reinvest DeFi → 10% Performance Fee
 */

import { db } from '../../db';
import { 
  artistTreasuryVault, treasuryTransactions, economicEngineConfig,
  economicEngineAuditLog
} from '../../../db/schema';
import { eq } from 'drizzle-orm';
import type { ProfitCascade } from './types';
import { DEFAULT_PROFIT_CASCADE } from './types';

/**
 * Distribute net DeFi profits through the cascade
 */
export async function distributeProfits(artistId: number, netProfit: number): Promise<{
  reserve: number;
  growth: number;
  reinvestDefi: number;
  performanceFee: number;
}> {
  if (netProfit <= 0) return { reserve: 0, growth: 0, reinvestDefi: 0, performanceFee: 0 };

  // Load cascade config
  const [config] = await db.select().from(economicEngineConfig).limit(1);
  const cascade = config?.profitCascade || DEFAULT_PROFIT_CASCADE;

  const distribution = {
    reserve: (netProfit * cascade.reserve) / 100,
    growth: (netProfit * cascade.growth) / 100,
    reinvestDefi: (netProfit * cascade.reinvestDefi) / 100,
    performanceFee: (netProfit * cascade.performanceFee) / 100,
  };

  // Get current vault
  const [vault] = await db.select().from(artistTreasuryVault)
    .where(eq(artistTreasuryVault.artistId, artistId));

  if (!vault) return distribution;

  // Apply cascade to vault
  await db.update(artistTreasuryVault).set({
    reserveBalance: String(parseFloat(vault.reserveBalance) + distribution.reserve),
    growthBalance: String(parseFloat(vault.growthBalance) + distribution.growth),
    defiBalance: String(parseFloat(vault.defiBalance) + distribution.reinvestDefi),
    boostifyFeeBalance: String(parseFloat(vault.boostifyFeeBalance) + distribution.performanceFee),
    updatedAt: new Date(),
  }).where(eq(artistTreasuryVault.artistId, artistId));

  // Log cascade transaction
  await db.insert(treasuryTransactions).values({
    artistId,
    transactionType: 'profit_cascade',
    amount: String(netProfit),
    description: `Profit cascade: $${netProfit.toFixed(2)} → Reserve:$${distribution.reserve.toFixed(0)} Growth:$${distribution.growth.toFixed(0)} DeFi:$${distribution.reinvestDefi.toFixed(0)} Fee:$${distribution.performanceFee.toFixed(0)}`,
    triggeredBy: 'economic_brain',
    metadata: { cascade, distribution },
  });

  await db.insert(economicEngineAuditLog).values({
    artistId,
    actorType: 'economic_brain',
    action: 'profit_cascaded',
    description: `Net profit $${netProfit.toFixed(2)} distributed through cascade`,
    newState: distribution,
  });

  console.log(`💰 [ProfitDistributor] Artist ${artistId}: $${netProfit.toFixed(2)} cascaded — Res:$${distribution.reserve.toFixed(0)} Grw:$${distribution.growth.toFixed(0)} DeFi:$${distribution.reinvestDefi.toFixed(0)} Fee:$${distribution.performanceFee.toFixed(0)}`);

  return distribution;
}

/**
 * REBALANCE ENGINE — Enforce the 5 mandates
 */
export async function rebalanceVault(artistId: number, adminId?: number): Promise<string[]> {
  const messages: string[] = [];

  const [vault] = await db.select().from(artistTreasuryVault)
    .where(eq(artistTreasuryVault.artistId, artistId));
  
  if (!vault) {
    messages.push('No vault found for artist');
    return messages;
  }

  const [config] = await db.select().from(economicEngineConfig).limit(1);
  const minReserveMonths = config?.minReserveMonths || 3;

  const opBalance = parseFloat(vault.operationBalance);
  const reserveBalance = parseFloat(vault.reserveBalance);
  const growthBalance = parseFloat(vault.growthBalance);
  const defiBalance = parseFloat(vault.defiBalance);
  const total = opBalance + reserveBalance + growthBalance + defiBalance;

  // MANDATE #1: Inviolability of Reserve — at least enough for min months
  // (This is enforced by mode transitions in risk-engine)
  if (reserveBalance < total * 0.15) {
    messages.push(`Reserve below 15% of total — may trigger survival mode`);
  }

  // MANDATE #2: Segregation of Risk — Alpha Hunter never touches Reserve or Operation
  // (This is enforced in alpha-hunter.ts)
  messages.push('Risk segregation: Alpha Hunter isolated from Reserve/Operation');

  // MANDATE #3: Shield Veto enforcement
  // (Handled by shield-node.ts)

  // MANDATE #4: Liquidity priority — check Capital Keeper availability
  messages.push(`Liquidity available: Operation $${opBalance.toFixed(0)} + Reserve $${reserveBalance.toFixed(0)}`);

  // Log rebalance
  await db.insert(treasuryTransactions).values({
    artistId,
    transactionType: 'rebalance',
    amount: '0',
    description: `Manual rebalance audit: ${messages.join('; ')}`,
    triggeredBy: adminId ? 'admin' : 'system',
  });

  if (adminId) {
    await db.insert(economicEngineAuditLog).values({
      artistId,
      actorId: adminId,
      actorType: 'admin',
      action: 'manual_rebalance',
      description: messages.join('; '),
    });
  }

  return messages;
}
