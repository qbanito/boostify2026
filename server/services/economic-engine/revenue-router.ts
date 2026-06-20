/**
 * REVENUE ROUTER — Income Interception & Classification
 * Intercepts all artist income from Layer 2 and funnels into Treasury Vault
 */

import { db } from '../../db';
import { 
  artistTreasuryVault, treasuryTransactions, artistEconomicProfile,
  economicEngineConfig
} from '../../../db/schema';
import { eq } from 'drizzle-orm';
import type { DistributionMatrix, VaultBalances } from './types';
import { MODE_DISTRIBUTIONS, DEFAULT_DEFI_SPLIT } from './types';

/**
 * Process incoming revenue for an artist
 * Centralizes in vault then distributes across buckets
 */
export async function processIncome(
  artistId: number, amount: number, source: string
): Promise<{ success: boolean; distribution: VaultBalances }> {
  
  if (amount <= 0) return { success: false, distribution: zeroBuckets() };

  // Check if engine is enabled for this artist
  const [profile] = await db.select().from(artistEconomicProfile)
    .where(eq(artistEconomicProfile.artistId, artistId));

  if (!profile?.isEnabled) {
    return { success: false, distribution: zeroBuckets() };
  }

  // Get distribution matrix (custom or mode-based)
  const matrix = profile.distributionMatrix || MODE_DISTRIBUTIONS[profile.operatingMode || 'stable'];

  // Calculate distribution
  const distribution: VaultBalances = {
    operation: (amount * matrix.operation) / 100,
    reserve: (amount * matrix.reserve) / 100,
    growth: (amount * matrix.growth) / 100,
    defi: (amount * matrix.defi) / 100,
    boostifyFee: (amount * matrix.boostifyFee) / 100,
  };

  // Ensure vault exists
  await ensureVaultExists(artistId);

  // Get current vault state for balance tracking
  const [vaultBefore] = await db.select().from(artistTreasuryVault)
    .where(eq(artistTreasuryVault.artistId, artistId));

  const balanceBefore = {
    operation: vaultBefore?.operationBalance || '0',
    reserve: vaultBefore?.reserveBalance || '0',
    growth: vaultBefore?.growthBalance || '0',
    defi: vaultBefore?.defiBalance || '0',
    boostifyFee: vaultBefore?.boostifyFeeBalance || '0',
  };

  // Update vault balances atomically
  await db.update(artistTreasuryVault).set({
    operationBalance: String(parseFloat(vaultBefore?.operationBalance || '0') + distribution.operation),
    reserveBalance: String(parseFloat(vaultBefore?.reserveBalance || '0') + distribution.reserve),
    growthBalance: String(parseFloat(vaultBefore?.growthBalance || '0') + distribution.growth),
    defiBalance: String(parseFloat(vaultBefore?.defiBalance || '0') + distribution.defi),
    boostifyFeeBalance: String(parseFloat(vaultBefore?.boostifyFeeBalance || '0') + distribution.boostifyFee),
    totalDeposited: String(parseFloat(vaultBefore?.totalDeposited || '0') + amount),
    updatedAt: new Date(),
  }).where(eq(artistTreasuryVault.artistId, artistId));

  // Get updated state
  const [vaultAfter] = await db.select().from(artistTreasuryVault)
    .where(eq(artistTreasuryVault.artistId, artistId));

  const balanceAfter = {
    operation: vaultAfter?.operationBalance || '0',
    reserve: vaultAfter?.reserveBalance || '0',
    growth: vaultAfter?.growthBalance || '0',
    defi: vaultAfter?.defiBalance || '0',
    boostifyFee: vaultAfter?.boostifyFeeBalance || '0',
  };

  // Log the deposit transaction
  await db.insert(treasuryTransactions).values({
    artistId,
    transactionType: 'income_deposit',
    amount: String(amount),
    balanceBefore,
    balanceAfter,
    description: `Income deposit from ${source}: $${amount.toFixed(2)} distributed as ${profile.operatingMode} mode`,
    triggeredBy: 'system',
    metadata: { source, distribution, mode: profile.operatingMode },
  });

  // Log individual bucket distributions
  for (const [bucket, bucketAmount] of Object.entries(distribution) as [string, number][]) {
    if (bucketAmount > 0) {
      await db.insert(treasuryTransactions).values({
        artistId,
        transactionType: 'bucket_distribution',
        toBucket: bucket as any,
        amount: String(bucketAmount),
        description: `${bucket}: $${bucketAmount.toFixed(2)} (${matrix[bucket as keyof DistributionMatrix]}%)`,
        triggeredBy: 'system',
      });
    }
  }

  console.log(`💰 [RevenueRouter] Artist ${artistId}: $${amount.toFixed(2)} distributed — Op:$${distribution.operation.toFixed(0)} Res:$${distribution.reserve.toFixed(0)} Grw:$${distribution.growth.toFixed(0)} DeFi:$${distribution.defi.toFixed(0)} Fee:$${distribution.boostifyFee.toFixed(0)}`);

  return { success: true, distribution };
}

/**
 * Ensure the treasury vault exists for an artist
 */
export async function ensureVaultExists(artistId: number) {
  const [existing] = await db.select().from(artistTreasuryVault)
    .where(eq(artistTreasuryVault.artistId, artistId));

  if (!existing) {
    await db.insert(artistTreasuryVault).values({ artistId });
  }
}

function zeroBuckets(): VaultBalances {
  return { operation: 0, reserve: 0, growth: 0, defi: 0, boostifyFee: 0 };
}

/**
 * Get current vault state for an artist
 */
export async function getVaultState(artistId: number) {
  const [vault] = await db.select().from(artistTreasuryVault)
    .where(eq(artistTreasuryVault.artistId, artistId));
  return vault;
}
