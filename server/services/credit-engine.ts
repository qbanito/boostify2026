/**
 * BOOSTIFY Credit Engine Service
 * ================================
 * Central service for ALL credit operations:
 * - Check balance before operations
 * - Deduct credits after successful API calls
 * - Get pricing (from DB override or fallback to config)
 * - Admin markup management
 * 
 * 1 credit = $0.01 USD
 */

import { db } from '../db';
import {
  userCredits,
  creditTransactions,
  adminPricingConfig,
  adminGlobalSettings,
  subscriptionCreditGrants,
  subscriptions,
  users,
} from '../db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import {
  OPERATION_COSTS,
  DEFAULT_MARKUP_MULTIPLIER,
  CREDITS_PER_DOLLAR,
  TIER_CREDIT_ALLOCATIONS,
  type OperationType,
} from '../../shared/credit-pricing';
import { reserveFromPurchase, recordProviderSpend } from './treasury-engine';

const ADMIN_EMAIL = 'convoycubano@gmail.com';

// In-memory cache for pricing (refreshed every 5 min)
let pricingCache: Map<string, { creditCost: number; markup: number }> | null = null;
let pricingCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================
// PRICING RESOLUTION
// ============================================

/**
 * Get the global markup multiplier from admin settings (cached)
 */
let globalMarkupCache: number | null = null;
let globalMarkupCacheTime = 0;

export async function getGlobalMarkup(): Promise<number> {
  const now = Date.now();
  if (globalMarkupCache !== null && now - globalMarkupCacheTime < CACHE_TTL_MS) {
    return globalMarkupCache;
  }
  
  try {
    const [setting] = await db
      .select()
      .from(adminGlobalSettings)
      .where(eq(adminGlobalSettings.settingKey, 'default_markup_multiplier'));
    
    if (setting) {
      globalMarkupCache = parseFloat(setting.settingValue);
      globalMarkupCacheTime = now;
      return globalMarkupCache;
    }
  } catch (e) {
    // Table may not exist yet — use default
  }

  globalMarkupCache = DEFAULT_MARKUP_MULTIPLIER;
  globalMarkupCacheTime = now;
  return DEFAULT_MARKUP_MULTIPLIER;
}

/**
 * Load all admin pricing overrides into cache
 */
async function loadPricingCache(): Promise<Map<string, { creditCost: number; markup: number }>> {
  const now = Date.now();
  if (pricingCache && now - pricingCacheTime < CACHE_TTL_MS) {
    return pricingCache;
  }

  const cache = new Map<string, { creditCost: number; markup: number }>();
  
  try {
    const overrides = await db.select().from(adminPricingConfig);
    for (const row of overrides) {
      if (row.isActive) {
        cache.set(row.operationType, {
          creditCost: row.creditCost,
          markup: parseFloat(row.markupMultiplier as string),
        });
      }
    }
  } catch (e) {
    // Table may not exist yet
  }

  pricingCache = cache;
  pricingCacheTime = now;
  return cache;
}

/**
 * Invalidate the pricing cache (call after admin updates)
 */
export function invalidatePricingCache(): void {
  pricingCache = null;
  pricingCacheTime = 0;
  globalMarkupCache = null;
  globalMarkupCacheTime = 0;
}

/**
 * Get credit cost for an operation.
 * Priority: DB override > shared config with global markup
 */
export async function getOperationCreditCost(
  operationType: OperationType,
  quantity: number = 1
): Promise<number> {
  // Check DB overrides first
  const cache = await loadPricingCache();
  const override = cache.get(operationType);
  
  if (override) {
    return override.creditCost * quantity;
  }

  // Fallback to config with global markup
  const op = OPERATION_COSTS[operationType];
  if (!op) {
    console.warn(`⚠️ Unknown operation type: ${operationType}, charging 0 credits`);
    return 0;
  }

  const markup = await getGlobalMarkup();
  return Math.ceil(op.internalCostUsd * markup * CREDITS_PER_DOLLAR) * quantity;
}

/**
 * Get credit cost from raw USD (for dynamic/variable costs)
 */
export async function getCreditCostFromUsd(internalCostUsd: number): Promise<number> {
  const markup = await getGlobalMarkup();
  return Math.ceil(internalCostUsd * markup * CREDITS_PER_DOLLAR);
}

// ============================================
// BALANCE OPERATIONS
// ============================================

/**
 * Get user's current credit balance
 */
export async function getUserBalance(userEmail: string): Promise<{
  credits: number;
  isAdmin: boolean;
}> {
  if (userEmail === ADMIN_EMAIL) {
    return { credits: 999999, isAdmin: true };
  }

  const [record] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userEmail, userEmail));

  if (!record) {
    // Auto-create with 0 credits
    const [newRecord] = await db
      .insert(userCredits)
      .values({ userEmail, credits: 0 })
      .returning();
    return { credits: newRecord.credits, isAdmin: false };
  }

  return { credits: record.credits, isAdmin: false };
}

/**
 * Check if user can afford an operation
 */
export async function canAfford(
  userEmail: string,
  operationType: OperationType,
  quantity: number = 1
): Promise<{
  allowed: boolean;
  currentBalance: number;
  requiredCredits: number;
  isAdmin: boolean;
}> {
  const { credits, isAdmin } = await getUserBalance(userEmail);

  if (isAdmin) {
    return { allowed: true, currentBalance: credits, requiredCredits: 0, isAdmin: true };
  }

  const required = await getOperationCreditCost(operationType, quantity);

  return {
    allowed: credits >= required,
    currentBalance: credits,
    requiredCredits: required,
    isAdmin: false,
  };
}

/**
 * Check if user can afford a raw USD cost
 */
export async function canAffordUsd(
  userEmail: string,
  internalCostUsd: number
): Promise<{
  allowed: boolean;
  currentBalance: number;
  requiredCredits: number;
  isAdmin: boolean;
}> {
  const { credits, isAdmin } = await getUserBalance(userEmail);

  if (isAdmin) {
    return { allowed: true, currentBalance: credits, requiredCredits: 0, isAdmin: true };
  }

  const required = await getCreditCostFromUsd(internalCostUsd);

  return {
    allowed: credits >= required,
    currentBalance: credits,
    requiredCredits: required,
    isAdmin: false,
  };
}

// ============================================
// DEDUCTION / CHARGE
// ============================================

export interface ChargeResult {
  success: boolean;
  creditsCharged: number;
  remainingBalance: number;
  transactionId?: number;
  error?: string;
}

/**
 * Charge credits for a completed operation.
 * Call AFTER the API call succeeds.
 */
export async function chargeCredits(
  userEmail: string,
  operationType: OperationType,
  options: {
    quantity?: number;
    description?: string;
    projectId?: number;
    metadata?: Record<string, any>;
  } = {}
): Promise<ChargeResult> {
  const { quantity = 1, description, projectId, metadata } = options;

  // Admin bypass
  if (userEmail === ADMIN_EMAIL) {
    return { success: true, creditsCharged: 0, remainingBalance: 999999 };
  }

  const creditsToCharge = await getOperationCreditCost(operationType, quantity);

  if (creditsToCharge <= 0) {
    return { success: true, creditsCharged: 0, remainingBalance: 0 };
  }

  // Atomic deduction
  const [updated] = await db
    .update(userCredits)
    .set({
      credits: sql`${userCredits.credits} - ${creditsToCharge}`,
      updatedAt: new Date(),
    })
    .where(
      sql`${userCredits.userEmail} = ${userEmail} AND ${userCredits.credits} >= ${creditsToCharge}`
    )
    .returning();

  if (!updated) {
    const balance = await getUserBalance(userEmail);
    return {
      success: false,
      creditsCharged: 0,
      remainingBalance: balance.credits,
      error: `Insufficient credits. Need ${creditsToCharge}, have ${balance.credits}`,
    };
  }

  // Log transaction
  const op = OPERATION_COSTS[operationType];
  const [tx] = await db
    .insert(creditTransactions)
    .values({
      userEmail,
      amount: -creditsToCharge,
      type: 'deduction',
      description: description || `${op?.name || operationType} (x${quantity})`,
      relatedProjectId: projectId,
    })
    .returning();

  console.log(`💳 Charged ${creditsToCharge} credits from ${userEmail} for ${operationType} — balance: ${updated.credits}`);

  // Record the real provider spend against the treasury reserve (best-effort).
  const opCost = (op?.internalCostUsd || 0) * quantity;
  if (opCost > 0) {
    void recordProviderSpend(opCost, { operationType, source: operationType, refId: tx?.id ? String(tx.id) : undefined });
  }

  return {
    success: true,
    creditsCharged: creditsToCharge,
    remainingBalance: updated.credits,
    transactionId: tx?.id,
  };
}

/**
 * Charge credits based on raw USD cost (for dynamic pricing)
 */
export async function chargeCreditsFromUsd(
  userEmail: string,
  internalCostUsd: number,
  description: string,
  options: {
    projectId?: number;
    metadata?: Record<string, any>;
  } = {}
): Promise<ChargeResult> {
  if (userEmail === ADMIN_EMAIL) {
    return { success: true, creditsCharged: 0, remainingBalance: 999999 };
  }

  const creditsToCharge = await getCreditCostFromUsd(internalCostUsd);

  if (creditsToCharge <= 0) {
    return { success: true, creditsCharged: 0, remainingBalance: 0 };
  }

  const [updated] = await db
    .update(userCredits)
    .set({
      credits: sql`${userCredits.credits} - ${creditsToCharge}`,
      updatedAt: new Date(),
    })
    .where(
      sql`${userCredits.userEmail} = ${userEmail} AND ${userCredits.credits} >= ${creditsToCharge}`
    )
    .returning();

  if (!updated) {
    const balance = await getUserBalance(userEmail);
    return {
      success: false,
      creditsCharged: 0,
      remainingBalance: balance.credits,
      error: `Insufficient credits. Need ${creditsToCharge}, have ${balance.credits}`,
    };
  }

  const [tx] = await db
    .insert(creditTransactions)
    .values({
      userEmail,
      amount: -creditsToCharge,
      type: 'deduction',
      description,
      relatedProjectId: options.projectId,
    })
    .returning();

  console.log(`💳 Charged ${creditsToCharge} credits ($${internalCostUsd.toFixed(4)} internal) from ${userEmail} — balance: ${updated.credits}`);

  // Record the real provider spend against the treasury reserve (best-effort).
  if (internalCostUsd > 0) {
    void recordProviderSpend(internalCostUsd, {
      provider: options.metadata?.provider,
      source: description,
      refId: tx?.id ? String(tx.id) : undefined,
    });
  }

  return {
    success: true,
    creditsCharged: creditsToCharge,
    remainingBalance: updated.credits,
    transactionId: tx?.id,
  };
}

/**
 * Add credits to user account (purchases, bonuses, refunds)
 */
export async function addCredits(
  userEmail: string,
  credits: number,
  type: 'purchase' | 'bonus' | 'refund' | 'subscription',
  description: string,
  options: {
    stripePaymentIntentId?: string;
    tier?: string;
    paidUsd?: number;   // real money the user paid (purchases) → drives treasury reserve
    markup?: number;    // markup applied at purchase time
  } = {}
): Promise<{ success: boolean; newBalance: number }> {
  // Ensure user exists
  const [existing] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userEmail, userEmail));

  if (existing) {
    await db
      .update(userCredits)
      .set({
        credits: sql`${userCredits.credits} + ${credits}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userEmail, userEmail));
  } else {
    await db
      .insert(userCredits)
      .values({ userEmail, credits });
  }

  // Apply tier bonus on purchases
  let bonusCredits = 0;
  if (type === 'purchase' && options.tier) {
    const tierConfig = TIER_CREDIT_ALLOCATIONS[options.tier];
    if (tierConfig && tierConfig.bonusCreditsOnPurchase > 0) {
      bonusCredits = Math.floor(credits * tierConfig.bonusCreditsOnPurchase / 100);
      if (bonusCredits > 0) {
        await db
          .update(userCredits)
          .set({
            credits: sql`${userCredits.credits} + ${bonusCredits}`,
            updatedAt: new Date(),
          })
          .where(eq(userCredits.userEmail, userEmail));
      }
    }
  }

  // Log transactions
  await db.insert(creditTransactions).values({
    userEmail,
    amount: credits,
    type: type === 'subscription' ? 'bonus' : type,
    description,
    stripePaymentIntentId: options.stripePaymentIntentId,
  });

  if (bonusCredits > 0) {
    await db.insert(creditTransactions).values({
      userEmail,
      amount: bonusCredits,
      type: 'bonus',
      description: `Tier bonus (${options.tier}) — ${TIER_CREDIT_ALLOCATIONS[options.tier]?.bonusCreditsOnPurchase}% extra`,
    });
  }

  const [updated] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userEmail, userEmail));

  // On real purchases, reserve the provider-funding share into the treasury (best-effort).
  if (type === 'purchase' && options.paidUsd && options.paidUsd > 0) {
    const markup = options.markup || (await getGlobalMarkup());
    void reserveFromPurchase(options.paidUsd, markup, options.stripePaymentIntentId);
  }

  return { success: true, newBalance: updated?.credits || 0 };
}

// ============================================
// SUBSCRIPTION MONTHLY CREDIT GRANTS
// ============================================

// Map subscription plan enum → credit tier key in TIER_CREDIT_ALLOCATIONS.
const PLAN_TO_TIER: Record<string, string> = {
  free: 'free',
  artist: 'artist',
  basic: 'artist',
  creator: 'creator',
  pro: 'professional',
  professional: 'professional',
  premium: 'enterprise',
  enterprise: 'enterprise',
};

/**
 * Grant the user's monthly credit allotment for their current billing period,
 * exactly once. Lazy/idempotent — safe to call on every balance read; the unique
 * (user_email, period_key) index prevents double grants. Monthly credits are
 * NON-accumulable: each period gets its own allotment keyed by period.
 */
export async function grantMonthlyCreditsIfDue(userEmail: string): Promise<{ granted: boolean; credits: number; plan: string }> {
  if (!userEmail || userEmail === ADMIN_EMAIL) {
    return { granted: false, credits: 0, plan: 'admin' };
  }

  try {
    // Resolve plan from the user's active subscription (fallback to free tier).
    let plan = 'free';
    let periodKey = new Date().toISOString().slice(0, 7); // 'YYYY-MM' for free/no-sub

    const [userRow] = await db.select().from(users).where(eq(users.email, userEmail));
    if (userRow) {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, userRow.id), eq(subscriptions.status, 'active')))
        .orderBy(desc(subscriptions.currentPeriodEnd))
        .limit(1);
      if (sub) {
        plan = PLAN_TO_TIER[sub.plan] || 'free';
        // Use the Stripe billing-period start so the key rolls exactly with billing.
        periodKey = sub.currentPeriodStart
          ? new Date(sub.currentPeriodStart).toISOString().slice(0, 10)
          : (sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString().slice(0, 10) : periodKey);
      }
    }

    const tier = TIER_CREDIT_ALLOCATIONS[plan];
    const monthlyCredits = tier?.monthlyCredits || 0;
    if (monthlyCredits <= 0) return { granted: false, credits: 0, plan };

    // Idempotent insert — unique index blocks a second grant for the same period.
    try {
      await db.insert(subscriptionCreditGrants).values({
        userEmail,
        plan,
        periodKey,
        creditsGranted: monthlyCredits,
      });
    } catch (e) {
      // Already granted for this period.
      return { granted: false, credits: 0, plan };
    }

    await addCredits(
      userEmail,
      monthlyCredits,
      'subscription',
      `Monthly ${plan} plan credits (${periodKey})`,
    );

    console.log(`🎁 Granted ${monthlyCredits} monthly ${plan} credits to ${userEmail} (${periodKey})`);
    return { granted: true, credits: monthlyCredits, plan };
  } catch (e) {
    console.warn('[credits] grantMonthlyCreditsIfDue failed (non-fatal):', (e as Error)?.message);
    return { granted: false, credits: 0, plan: 'free' };
  }
}

// ============================================
// ADMIN: PRICING MANAGEMENT
// ============================================

/**
 * Update global markup multiplier
 */
export async function setGlobalMarkup(
  multiplier: number,
  adminEmail: string
): Promise<void> {
  const existing = await db
    .select()
    .from(adminGlobalSettings)
    .where(eq(adminGlobalSettings.settingKey, 'default_markup_multiplier'));

  if (existing.length > 0) {
    await db
      .update(adminGlobalSettings)
      .set({
        settingValue: multiplier.toString(),
        updatedBy: adminEmail,
        updatedAt: new Date(),
      })
      .where(eq(adminGlobalSettings.settingKey, 'default_markup_multiplier'));
  } else {
    await db.insert(adminGlobalSettings).values({
      settingKey: 'default_markup_multiplier',
      settingValue: multiplier.toString(),
      description: 'Global markup multiplier for all operations (default 5x)',
      updatedBy: adminEmail,
    });
  }

  invalidatePricingCache();
}

/**
 * Set per-operation pricing override
 */
export async function setOperationPricing(
  operationType: string,
  markupMultiplier: number,
  adminEmail: string
): Promise<void> {
  const op = OPERATION_COSTS[operationType as OperationType];
  if (!op) throw new Error(`Unknown operation: ${operationType}`);

  const creditCost = Math.ceil(op.internalCostUsd * markupMultiplier * CREDITS_PER_DOLLAR);

  const [existing] = await db
    .select()
    .from(adminPricingConfig)
    .where(eq(adminPricingConfig.operationType, operationType));

  if (existing) {
    await db
      .update(adminPricingConfig)
      .set({
        markupMultiplier: markupMultiplier.toString(),
        creditCost,
        internalCostUsd: op.internalCostUsd.toString(),
        updatedBy: adminEmail,
        updatedAt: new Date(),
      })
      .where(eq(adminPricingConfig.operationType, operationType));
  } else {
    await db.insert(adminPricingConfig).values({
      operationType,
      category: op.category,
      internalCostUsd: op.internalCostUsd.toString(),
      markupMultiplier: markupMultiplier.toString(),
      creditCost,
      isActive: true,
      updatedBy: adminEmail,
    });
  }

  invalidatePricingCache();
}

/**
 * Seed DB with all operations from config (run on first setup)
 */
export async function seedPricingConfig(adminEmail: string): Promise<number> {
  const markup = await getGlobalMarkup();
  let count = 0;

  for (const [type, op] of Object.entries(OPERATION_COSTS)) {
    const [existing] = await db
      .select()
      .from(adminPricingConfig)
      .where(eq(adminPricingConfig.operationType, type));

    if (!existing) {
      await db.insert(adminPricingConfig).values({
        operationType: type,
        category: op.category,
        internalCostUsd: op.internalCostUsd.toString(),
        markupMultiplier: markup.toString(),
        creditCost: Math.ceil(op.internalCostUsd * markup * CREDITS_PER_DOLLAR),
        isActive: true,
        updatedBy: adminEmail,
      });
      count++;
    }
  }

  return count;
}
