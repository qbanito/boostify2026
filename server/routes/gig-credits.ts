/**
 * BOOSTIFY Gig Credits API Routes
 * ==================================
 * Endpoints for gig credit management:
 * - Balance & transactions
 * - Stripe Checkout for credit purchases
 * - Application cost calculation
 * - Reward claiming
 * - Auto-messages inbox
 */

import express from 'express';
import Stripe from 'stripe';
import { db } from '../db';
import {
  gigCredits,
  gigCreditTransactions,
  gigCreditPackages,
  gigAutoMessages,
  serviceBids,
  serviceRequests,
} from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import {
  getGigCreditBalance,
  getGigCreditAccount,
  addGigCredits,
  spendGigCredits,
  canAffordGigApplication,
  claimCreditReward,
  getClaimedRewards,
  calculateApplicationCost,
  calculateCommission,
  sendGigAutoMessage,
} from '../services/gig-credit-engine';
import {
  GIG_CREDIT_PACKAGES,
  CREDIT_REWARDS,
} from '../../shared/gig-credit-pricing';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

const router = express.Router();

function getUserId(req: express.Request): number | null {
  const user = (req as any).user;
  return user?.id || user?.uid || null;
}

// ════════════════════════════════════════
// BALANCE & ACCOUNT
// ════════════════════════════════════════

/** GET /api/gig-credits/balance — Get current balance + account stats */
router.get('/balance', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const account = await getGigCreditAccount(userId);
    res.json(account);
  } catch (error: any) {
    console.error('Error fetching gig credit balance:', error);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/gig-credits/transactions — Transaction history */
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await db
      .select()
      .from(gigCreditTransactions)
      .where(eq(gigCreditTransactions.userId, userId))
      .orderBy(desc(gigCreditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(transactions);
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// CREDIT PACKAGES & PRICING
// ════════════════════════════════════════

/** GET /api/gig-credits/packages — Available credit packages */
router.get('/packages', (_req, res) => {
  res.json(GIG_CREDIT_PACKAGES);
});

/** GET /api/gig-credits/application-cost?budget=200 — Cost to apply */
router.get('/application-cost', (req, res) => {
  const budget = parseFloat(req.query.budget as string);
  if (isNaN(budget) || budget <= 0) {
    return res.status(400).json({ error: 'Valid budget required' });
  }
  const cost = calculateApplicationCost(budget);
  res.json({ budget, cost, formula: '5% of budget (min 1, max 50)' });
});

// ════════════════════════════════════════
// STRIPE CHECKOUT FOR CREDITS
// ════════════════════════════════════════

/** POST /api/gig-credits/checkout — Create Stripe Checkout Session */
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { packageId } = req.body;
    const pkg = GIG_CREDIT_PACKAGES.find(p => p.id === packageId);

    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package' });
    }

    const totalCredits = pkg.credits + pkg.bonusCredits;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${pkg.name} — ${totalCredits} Gig Credits`,
              description: `${pkg.credits} credits${pkg.bonusCredits > 0 ? ` + ${pkg.bonusCredits} bonus` : ''} for applying to music gigs`,
              images: ['https://boostify.live/logo.png'],
            },
            unit_amount: Math.round(pkg.priceUsd * 100), // cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin || 'https://boostify.live'}/producer-tools?tab=map&credits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'https://boostify.live'}/producer-tools?tab=map&credits=cancelled`,
      metadata: {
        type: 'gig_credits',
        userId: userId.toString(),
        packageId: pkg.id,
        credits: totalCredits.toString(),
        baseCredits: pkg.credits.toString(),
        bonusCredits: pkg.bonusCredits.toString(),
      },
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/gig-credits/verify-checkout — Verify & fulfill after Stripe redirect */
router.post('/verify-checkout', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Session ID required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Prevent double-fulfillment
    const [existing] = await db
      .select()
      .from(gigCreditTransactions)
      .where(eq(gigCreditTransactions.stripeCheckoutSessionId, sessionId));

    if (existing) {
      const balance = await getGigCreditBalance(userId);
      return res.json({ success: true, alreadyFulfilled: true, balance });
    }

    const totalCredits = parseInt(session.metadata?.credits || '0');
    if (totalCredits <= 0) {
      return res.status(400).json({ error: 'Invalid credit amount' });
    }

    const metaUserId = parseInt(session.metadata?.userId || '0');
    if (metaUserId !== userId) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }

    const result = await addGigCredits(
      userId,
      totalCredits,
      'purchase',
      `Purchased ${totalCredits} gig credits (${session.metadata?.packageId})`,
      { stripeCheckoutSessionId: sessionId }
    );

    // Send welcome message
    await sendGigAutoMessage(
      userId,
      'credit_purchase',
      '💰 Credits Added!',
      `${totalCredits} gig credits have been added to your account. You're ready to apply for gigs!`,
      { credits: totalCredits, packageId: session.metadata?.packageId },
      '/producer-tools?tab=map',
      'Browse Gigs',
    );

    res.json({ success: true, credits: totalCredits, newBalance: result.newBalance });
  } catch (error: any) {
    console.error('Error verifying checkout:', error);
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// APPLICATION (Spend Credits)
// ════════════════════════════════════════

/** POST /api/gig-credits/apply — Apply to a gig (deducts credits, creates bid) */
router.post('/apply', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { serviceRequestId, amount, message, estimatedDelivery } = req.body;

    if (!serviceRequestId || !amount || !message) {
      return res.status(400).json({ error: 'serviceRequestId, amount, and message are required' });
    }

    // Get the service request to calculate credit cost
    const [request] = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, serviceRequestId));

    if (!request) {
      return res.status(404).json({ error: 'Service request not found' });
    }

    if (request.status !== 'open') {
      return res.status(400).json({ error: 'This gig is no longer accepting applications' });
    }

    // Prevent self-bidding
    if (request.userId === userId) {
      return res.status(400).json({ error: 'Cannot apply to your own gig' });
    }

    // Check if already bid
    const [existingBid] = await db
      .select()
      .from(serviceBids)
      .where(and(
        eq(serviceBids.serviceRequestId, serviceRequestId),
        eq(serviceBids.userId, userId)
      ));

    if (existingBid) {
      return res.status(400).json({ error: 'You already applied to this gig' });
    }

    // Calculate credit cost based on job budget
    const jobBudget = parseFloat(request.budgetMax);
    const creditCost = calculateApplicationCost(jobBudget);

    // Deduct credits
    const spendResult = await spendGigCredits(
      userId,
      creditCost,
      `Applied to: ${request.title} ($${jobBudget} budget) — ${creditCost} credits`,
      { serviceRequestId }
    );

    if (!spendResult.success) {
      return res.status(400).json({
        error: 'Insufficient credits',
        needed: creditCost,
        balance: spendResult.newBalance,
        message: spendResult.error,
      });
    }

    // Create the bid
    const [bid] = await db
      .insert(serviceBids)
      .values({
        serviceRequestId,
        userId,
        musicianId: userId, // Will be resolved to proper musician ID if available
        amount: amount.toString(),
        message,
        estimatedDelivery: estimatedDelivery || null,
      })
      .returning();

    // Update bid count on service request
    await db
      .update(serviceRequests)
      .set({ totalBids: sql`${serviceRequests.totalBids} + 1` })
      .where(eq(serviceRequests.id, serviceRequestId));

    // Update transaction with bid reference
    await db
      .update(gigCreditTransactions)
      .set({ bidId: bid.id })
      .where(and(
        eq(gigCreditTransactions.userId, userId),
        eq(gigCreditTransactions.serviceRequestId, serviceRequestId),
        eq(gigCreditTransactions.type, 'application')
      ));

    res.json({
      success: true,
      bid,
      creditsCharged: creditCost,
      newBalance: spendResult.newBalance,
    });
  } catch (error: any) {
    console.error('Error applying to gig:', error);
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// REWARDS (Free Credits)
// ════════════════════════════════════════

/** GET /api/gig-credits/rewards — Available rewards and claim status */
router.get('/rewards', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const claimed = await getClaimedRewards(userId);

    const rewards = CREDIT_REWARDS.map(r => ({
      ...r,
      claimed: claimed.includes(r.type),
      canClaim: !r.oneTime || !claimed.includes(r.type),
    }));

    res.json(rewards);
  } catch (error: any) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/gig-credits/rewards/claim — Claim a reward */
router.post('/rewards/claim', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { rewardType } = req.body;
    if (!rewardType) return res.status(400).json({ error: 'rewardType is required' });

    const result = await claimCreditReward(userId, rewardType);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error claiming reward:', error);
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// MESSAGING (Auto Messages Inbox)
// ════════════════════════════════════════

/** GET /api/gig-credits/messages — Auto messages inbox */
router.get('/messages', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const messages = await db
      .select()
      .from(gigAutoMessages)
      .where(eq(gigAutoMessages.userId, userId))
      .orderBy(desc(gigAutoMessages.createdAt))
      .limit(limit);

    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/gig-credits/messages/unread-count */
router.get('/messages/unread-count', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gigAutoMessages)
      .where(and(
        eq(gigAutoMessages.userId, userId),
        eq(gigAutoMessages.read, false)
      ));

    res.json({ unread: result?.count ?? 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** PATCH /api/gig-credits/messages/:id/read — Mark message as read */
router.patch('/messages/:id/read', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const id = parseInt(req.params.id);
    await db
      .update(gigAutoMessages)
      .set({ read: true })
      .where(and(
        eq(gigAutoMessages.id, id),
        eq(gigAutoMessages.userId, userId)
      ));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** PATCH /api/gig-credits/messages/read-all — Mark all as read */
router.patch('/messages/read-all', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await db
      .update(gigAutoMessages)
      .set({ read: true })
      .where(and(
        eq(gigAutoMessages.userId, userId),
        eq(gigAutoMessages.read, false)
      ));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// COMMISSION (20% on service completion)
// ════════════════════════════════════════

/** POST /api/gig-credits/complete-service — Mark service as complete, apply 20% commission */
router.post('/complete-service', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { serviceRequestId, bidId } = req.body;

    // Get the bid
    const [bid] = await db
      .select()
      .from(serviceBids)
      .where(eq(serviceBids.id, bidId));

    if (!bid) return res.status(404).json({ error: 'Bid not found' });

    // Get the service request
    const [request] = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, serviceRequestId));

    if (!request) return res.status(404).json({ error: 'Service request not found' });

    // Only the request owner can complete
    if (request.userId !== userId) {
      return res.status(403).json({ error: 'Only the client can mark a service as complete' });
    }

    const serviceAmount = parseFloat(bid.amount);
    const { platformFee, musicianPayout } = calculateCommission(serviceAmount);

    // Update request status
    await db
      .update(serviceRequests)
      .set({
        status: 'completed',
        selectedBidId: bidId,
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.id, serviceRequestId));

    // Update bid status
    await db
      .update(serviceBids)
      .set({
        status: 'accepted',
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(serviceBids.id, bidId));

    res.json({
      success: true,
      totalAmount: serviceAmount,
      platformFee,
      musicianPayout,
      commissionRate: '20%',
    });
  } catch (error: any) {
    console.error('Error completing service:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
