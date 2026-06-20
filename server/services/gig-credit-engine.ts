/**
 * BOOSTIFY Gig Credit Engine
 * ============================
 * Core service for gig marketplace credits.
 * 1 gig credit = $1 USD
 */

import { db } from '../db';
import {
  gigCredits,
  gigCreditTransactions,
  gigCreditRewards,
  gigAutoMessages,
} from '../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import {
  calculateApplicationCost,
  calculateCommission,
  CREDIT_REWARDS,
} from '../../shared/gig-credit-pricing';

// ── Balance Operations ──

export async function getGigCreditBalance(userId: number): Promise<number> {
  const [row] = await db
    .select({ balance: gigCredits.balance })
    .from(gigCredits)
    .where(eq(gigCredits.userId, userId));

  return row?.balance ?? 0;
}

export async function getGigCreditAccount(userId: number) {
  const [row] = await db
    .select()
    .from(gigCredits)
    .where(eq(gigCredits.userId, userId));

  if (!row) {
    // Auto-create account
    const [created] = await db
      .insert(gigCredits)
      .values({ userId, balance: 0 })
      .onConflictDoNothing()
      .returning();

    if (created) return created;

    // Race condition: read again
    const [existing] = await db
      .select()
      .from(gigCredits)
      .where(eq(gigCredits.userId, userId));
    return existing ?? { userId, balance: 0, totalPurchased: 0, totalSpent: 0, totalEarned: 0 };
  }

  return row;
}

// ── Add Credits (purchase, bonus, referral) ──

export async function addGigCredits(
  userId: number,
  amount: number,
  type: "purchase" | "bonus" | "referral" | "promo" | "refund",
  description: string,
  metadata?: {
    stripePaymentIntentId?: string;
    stripeCheckoutSessionId?: string;
    serviceRequestId?: number;
    bidId?: number;
  }
): Promise<{ newBalance: number }> {
  // Ensure account exists
  await getGigCreditAccount(userId);

  const updateField = type === "purchase" ? "totalPurchased" : "totalEarned";

  // Update balance
  const [updated] = await db
    .update(gigCredits)
    .set({
      balance: sql`${gigCredits.balance} + ${amount}`,
      [updateField]: sql`${gigCredits[updateField]} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(gigCredits.userId, userId))
    .returning();

  // Log transaction
  await db.insert(gigCreditTransactions).values({
    userId,
    amount,
    type,
    description,
    balanceAfter: updated.balance,
    stripePaymentIntentId: metadata?.stripePaymentIntentId,
    stripeCheckoutSessionId: metadata?.stripeCheckoutSessionId,
    serviceRequestId: metadata?.serviceRequestId,
    bidId: metadata?.bidId,
  });

  return { newBalance: updated.balance };
}

// ── Spend Credits (application) ──

export async function spendGigCredits(
  userId: number,
  amount: number,
  description: string,
  metadata?: {
    serviceRequestId?: number;
    bidId?: number;
  }
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const account = await getGigCreditAccount(userId);

  if (account.balance < amount) {
    return {
      success: false,
      newBalance: account.balance,
      error: `Insufficient credits. Need ${amount}, have ${account.balance}.`,
    };
  }

  const [updated] = await db
    .update(gigCredits)
    .set({
      balance: sql`${gigCredits.balance} - ${amount}`,
      totalSpent: sql`${gigCredits.totalSpent} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(gigCredits.userId, userId),
      sql`${gigCredits.balance} >= ${amount}` // Prevent negative
    ))
    .returning();

  if (!updated) {
    return { success: false, newBalance: account.balance, error: "Insufficient credits (race condition)." };
  }

  // Log transaction
  await db.insert(gigCreditTransactions).values({
    userId,
    amount: -amount,
    type: "application",
    description,
    balanceAfter: updated.balance,
    serviceRequestId: metadata?.serviceRequestId,
    bidId: metadata?.bidId,
  });

  return { success: true, newBalance: updated.balance };
}

// ── Can Afford Check ──

export async function canAffordGigApplication(
  userId: number,
  jobBudgetUsd: number
): Promise<{ canAfford: boolean; cost: number; balance: number }> {
  const cost = calculateApplicationCost(jobBudgetUsd);
  const balance = await getGigCreditBalance(userId);
  return { canAfford: balance >= cost, cost, balance };
}

// ── Reward Claiming ──

export async function claimCreditReward(
  userId: number,
  rewardType: string
): Promise<{ success: boolean; creditsAwarded: number; newBalance: number; error?: string }> {
  const reward = CREDIT_REWARDS.find(r => r.type === rewardType);
  if (!reward) {
    return { success: false, creditsAwarded: 0, newBalance: 0, error: "Unknown reward type." };
  }

  // Check if already claimed (for one-time rewards)
  if (reward.oneTime) {
    const [existing] = await db
      .select()
      .from(gigCreditRewards)
      .where(and(
        eq(gigCreditRewards.userId, userId),
        eq(gigCreditRewards.rewardType, rewardType as any)
      ));

    if (existing) {
      return { success: false, creditsAwarded: 0, newBalance: 0, error: "Reward already claimed." };
    }
  }

  // Record reward
  await db.insert(gigCreditRewards).values({
    userId,
    rewardType: rewardType as any,
    creditsAwarded: reward.credits,
  });

  // Add credits
  const { newBalance } = await addGigCredits(
    userId,
    reward.credits,
    "bonus",
    `🎁 ${reward.title}: ${reward.description}`
  );

  return { success: true, creditsAwarded: reward.credits, newBalance };
}

// ── Get Claimed Rewards ──

export async function getClaimedRewards(userId: number): Promise<string[]> {
  const rewards = await db
    .select({ rewardType: gigCreditRewards.rewardType })
    .from(gigCreditRewards)
    .where(eq(gigCreditRewards.userId, userId));

  return rewards.map(r => r.rewardType);
}

// ── Commission Calculation (for service completion) ──

export { calculateApplicationCost, calculateCommission };

// ── Send Auto Message ──

export async function sendGigAutoMessage(
  userId: number,
  type: string,
  title: string,
  content: string,
  metadata?: Record<string, any>,
  actionUrl?: string,
  actionLabel?: string,
) {
  await db.insert(gigAutoMessages).values({
    userId,
    type,
    title,
    content,
    metadata: metadata ?? null,
    actionUrl,
    actionLabel,
  });
}

// ── Send Gig Proposal to Matching Musicians ──

export async function sendGigProposals(
  serviceRequestId: number,
  title: string,
  instrument: string,
  budget: string,
  city: string,
) {
  // Import musicians table here to avoid circular deps
  const { musicians } = await import('../db/schema');
  const { ilike, or } = await import('drizzle-orm');

  // Find musicians matching the instrument
  const matchingMusicians = await db
    .select({ userId: musicians.userId })
    .from(musicians)
    .where(or(
      ilike(musicians.category, `%${instrument}%`),
      ilike(musicians.instrument, `%${instrument}%`),
    ))
    .limit(50);

  // Send proposal to each
  for (const m of matchingMusicians) {
    if (!m.userId) continue;
    await sendGigAutoMessage(
      m.userId,
      "gig_proposal",
      `🎯 New Gig: ${title}`,
      `A client in ${city} needs a ${instrument} player. Budget: $${budget}. Apply now to land this gig!`,
      { serviceRequestId, instrument, budget, city },
      `/producer-tools?tab=map&request=${serviceRequestId}`,
      "View & Apply",
    );
  }
}
