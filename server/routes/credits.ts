import express from 'express';
import Stripe from 'stripe';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { userCredits, creditTransactions, musicVideoProjects } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import {
  getUserBalance,
  chargeCredits,
  fulfillCreditCheckout,
  getUserCreditTier,
  getOperationCreditCost,
  canAfford,
  grantMonthlyCreditsIfDue,
} from '../services/credit-engine';
import {
  OPERATION_COSTS,
  CREDIT_PACKAGES,
  TIER_CREDIT_ALLOCATIONS,
  getFullPricingTable,
  type OperationType,
} from '../../shared/credit-pricing';
import { isAuthenticated } from '../middleware/clerk-auth';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing Stripe secret key');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-09-30.endive' as any,
});

const router = express.Router();

// Personal balances and all balance-changing endpoints must use the verified
// Clerk identity. Never trust an email supplied by the browser for credits.
router.use('/api/credits', isAuthenticated);

function authenticatedCreditEmail(req: express.Request, res: express.Response): string | null {
  const email = String((req as any).user?.email || '').trim().toLowerCase();
  if (!email) {
    res.status(401).json({ error: 'A verified account email is required.' });
    return null;
  }
  return email;
}

router.get('/api/credits/balance', async (req, res) => {
  try {
    const userEmail = authenticatedCreditEmail(req, res);
    if (!userEmail) return;

    // Self-healing monthly subscription credit grant (idempotent per billing period).
    let monthlyGrant: { granted: boolean; credits: number; plan: string } | null = null;
    try {
      monthlyGrant = await grantMonthlyCreditsIfDue(userEmail);
    } catch { /* non-fatal */ }

    const { credits, isAdmin } = await getUserBalance(userEmail);

    res.json({ credits, isAdmin, monthlyGrant });
  } catch (error: any) {
    console.error('Error fetching credits:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/credits/create-payment-intent', async (req, res) => {
  try {
    const email = authenticatedCreditEmail(req, res);
    if (!email) return;
    // Legacy music-video gate: keep it inside the same wallet and ledger.
    // Amount and grant are fixed server-side so the browser cannot mint credits.
    const tier = await getUserCreditTier(email);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 19900,
      currency: 'usd',
      receipt_email: email,
      metadata: { type: 'credit_purchase', userEmail: email, credits: '19900', packageId: 'music-video-199' , tier },
    });
    res.json({ clientSecret: paymentIntent.client_secret, credits: 19900, amountUsd: 199 });
  } catch (error: any) {
    console.error('Error creating credit PaymentIntent:', error);
    res.status(500).json({ error: 'Could not initialize secure payment.' });
  }
});

router.post('/api/credits/verify-payment', async (req, res) => {
  try {
    const email = authenticatedCreditEmail(req, res);
    if (!email) return;
    const { paymentIntentId } = req.body || {};
    if (typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
      return res.status(400).json({ error: 'Valid paymentIntentId is required.' });
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const metadata = paymentIntent.metadata || {};
    const credits = Number(metadata.credits);
    if (paymentIntent.status !== 'succeeded' || paymentIntent.currency !== 'usd' ||
        metadata.type !== 'credit_purchase' || metadata.packageId !== 'music-video-199' ||
        metadata.userEmail?.toLowerCase() !== email || credits !== 19900 || paymentIntent.amount !== 19900) {
      return res.status(400).json({ error: 'Payment could not be verified for this account.' });
    }
    const result = await fulfillCreditCheckout({
      userEmail: email,
      credits,
      packageId: metadata.packageId || 'credit-purchase',
      paymentIntentId,
      paidUsd: paymentIntent.amount_received / 100,
      tier: metadata.tier || 'free',
    });
    res.json(result);
  } catch (error: any) {
    console.error('Error verifying credit PaymentIntent:', error);
    res.status(500).json({ error: 'Could not verify payment. Contact support if your charge completed.' });
  }
});

// ============================================
// Stripe Checkout — buy a credit package (hosted checkout, recommended flow)
// ============================================
router.post('/api/credits/create-checkout-session', async (req, res) => {
  try {
    const email = authenticatedCreditEmail(req, res);
    if (!email) return;
    const { packageId, successUrl } = req.body || {};

    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: 'Invalid packageId' });

    const configuredBase = process.env.APP_BASE_URL || process.env.PRODUCTION_URL || 'https://boostify.app';
    const originHeader = req.headers.origin;
    let safeBase = configuredBase;
    if (originHeader) {
      try {
        const candidate = new URL(originHeader);
        const configured = new URL(configuredBase);
        if (candidate.origin === configured.origin || candidate.hostname === 'localhost' || candidate.hostname === '127.0.0.1') {
          safeBase = candidate.origin;
        }
      } catch { /* use the configured canonical app URL */ }
    }
    let returnBase = `${safeBase}/artist-profile`;
    if (typeof successUrl === 'string') {
      try {
        const requestedReturn = new URL(successUrl);
        if (requestedReturn.origin === safeBase && requestedReturn.protocol === new URL(safeBase).protocol) {
          returnBase = `${requestedReturn.origin}${requestedReturn.pathname}${requestedReturn.search}`;
        }
      } catch { /* default to artist profile */ }
    }
    const successWithSession = `${returnBase}${returnBase.includes('?') ? '&' : '?'}credits_session={CHECKOUT_SESSION_ID}`;
    const tier = await getUserCreditTier(email);

    const integrationSuffix = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
    const checkoutParams = {
      mode: 'payment',
      customer_email: email,
      client_reference_id: String((req as any).user?.clerkUserId || (req as any).user?.id || ''),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(pkg.priceUsd * 100),
            product_data: {
              name: `Boostify Credits — ${pkg.label} (${pkg.credits.toLocaleString()} credits)`,
              description: `One-time purchase of ${pkg.credits.toLocaleString()} Boostify AI credits.`,
            },
          },
        },
      ],
      metadata: {
        type: 'credit_purchase',
        userEmail: email,
        credits: String(pkg.credits),
        packageId: pkg.id,
        priceUsd: String(pkg.priceUsd),
        userId: String((req as any).user?.clerkUserId || (req as any).user?.id || ''),
        tier,
      },
      success_url: successWithSession,
      cancel_url: `${safeBase}/artist-profile?credits_purchase=cancelled`,
      integration_identifier: `boostify_artist_credits_${integrationSuffix}`,
    } as Stripe.Checkout.SessionCreateParams & { integration_identifier: string };
    const session = await stripe.checkout.sessions.create(checkoutParams as any);

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify a completed Checkout Session and credit the user (idempotent).
router.post('/api/credits/verify-checkout', async (req, res) => {
  try {
    const authenticatedEmail = authenticatedCreditEmail(req, res);
    if (!authenticatedEmail) return;
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed', paymentStatus: session.payment_status });
    }

    const md = session.metadata || {};
    if (md.type !== 'credit_purchase') {
      return res.status(400).json({ error: 'Not a credit purchase session' });
    }

    const email = md.userEmail;
    const pkg = CREDIT_PACKAGES.find((item) => item.id === md.packageId);
    const credits = pkg?.credits || 0;
    if (!email || email.toLowerCase() !== authenticatedEmail || !pkg || md.credits !== String(pkg.credits) ||
        session.amount_total !== Math.round(pkg.priceUsd * 100) || session.currency !== 'usd' ||
        session.mode !== 'payment' || session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Invalid session metadata' });
    }
    const result = await fulfillCreditCheckout({
      userEmail: authenticatedEmail,
      credits,
      packageId: pkg.id,
      sessionId,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
      paidUsd: session.amount_total / 100,
      tier: md.tier || 'free',
    });
    res.json(result);
  } catch (error: any) {
    console.error('Error verifying checkout:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/credits/deduct', async (req, res) => {
  try {
    const email = authenticatedCreditEmail(req, res);
    if (!email) return;
    const { amount, operationType, projectId, description } = req.body || {};
    const numericAmount = Number(amount);
    if (amount !== undefined && (!Number.isInteger(numericAmount) || numericAmount <= 0)) {
      return res.status(400).json({ error: 'amount must be a positive integer' });
    }

    // If operationType is provided, use smart credit engine
    if (operationType && OPERATION_COSTS[operationType as OperationType]) {
      const result = await chargeCredits(email, operationType as OperationType, {
        quantity: numericAmount || 1,
        description,
        projectId,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({
        success: true,
        creditsCharged: result.creditsCharged,
        remainingCredits: result.remainingBalance,
      });
    }

    // Legacy: direct amount deduction (backwards compatible)
    if (!numericAmount) {
      return res.status(400).json({ error: 'amount or operationType required' });
    }

    if (email === 'convoycubano@gmail.com') {
      return res.json({ success: true, remainingCredits: 999999 });
    }

    const [updated] = await db.update(userCredits)
      .set({ credits: sql`${userCredits.credits} - ${numericAmount}`, updatedAt: new Date() })
      .where(sql`${userCredits.userEmail} = ${email} AND ${userCredits.credits} >= ${numericAmount}`)
      .returning({ credits: userCredits.credits });
    if (!updated) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    await db.insert(creditTransactions).values({
      userEmail: email,
      amount: -numericAmount,
      type: 'deduction',
      description: description || `Deducted ${numericAmount} credits`,
      relatedProjectId: projectId,
    });

    res.json({ success: true, remainingCredits: updated.credits });
  } catch (error: any) {
    console.error('Error deducting credits:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/credits/transactions', async (req, res) => {
  try {
    const email = authenticatedCreditEmail(req, res);
    if (!email) return;

    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userEmail, email as string))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(50);

    res.json(transactions);
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NEW: Pre-check if user can afford an operation
// ============================================
router.get('/api/credits/can-afford', async (req, res) => {
  try {
    const email = authenticatedCreditEmail(req, res);
    if (!email) return;
    const operationType = req.query.operationType as string;
    const quantity = Number(req.query.quantity || 1);

    if (!operationType || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      return res.status(400).json({ error: 'operationType and a valid quantity (1–1000) are required' });
    }

    if (!OPERATION_COSTS[operationType as OperationType]) {
      return res.status(400).json({ error: `Unknown operation: ${operationType}` });
    }

    const result = await canAfford(email, operationType as OperationType, quantity);

    res.json(result);
  } catch (error: any) {
    console.error('Error checking affordability:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NEW: Get pricing for a specific operation
// ============================================
router.get('/api/credits/operation-cost', async (req, res) => {
  try {
    const email = authenticatedCreditEmail(req, res);
    if (!email) return;
    const operationType = req.query.operationType as string;

    if (!operationType || !OPERATION_COSTS[operationType as OperationType]) {
      return res.status(400).json({ error: 'Valid operationType is required' });
    }

    const quantity = Math.min(1000, Math.max(1, Number(req.query.quantity || 1)));
    if (!Number.isInteger(quantity)) return res.status(400).json({ error: 'quantity must be a positive integer' });
    const creditCost = await getOperationCreditCost(operationType as OperationType, quantity);
    const op = OPERATION_COSTS[operationType as OperationType];

    res.json({
      operationType,
      name: op.name,
      creditCost,
      userPriceUsd: Number((creditCost / 100).toFixed(2)),
      quantity,
      unit: op.unit,
      balance: (await getUserBalance(email)).credits,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NEW: Get all credit packages
// ============================================
router.get('/api/credits/packages', async (_req, res) => {
  res.json(CREDIT_PACKAGES);
});

// ============================================
// NEW: Get full pricing table (public, for UI)
// ============================================
router.get('/api/credits/pricing', async (_req, res) => {
  try {
    const { getGlobalMarkup } = await import('../services/credit-engine');
    const markup = await getGlobalMarkup();
    const table = await Promise.all(getFullPricingTable(markup).map(async (operation) => {
      const creditCost = await getOperationCreditCost(operation.type as OperationType);
      return {
        ...operation,
        // Honor admin overrides so displayed prices equal actual deductions.
        creditCost,
        userPriceUsd: Number((creditCost / 100).toFixed(2)),
      };
    }));
    
    res.json({
      markup,
      operations: table,
      packages: CREDIT_PACKAGES,
      tiers: TIER_CREDIT_ALLOCATIONS,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/projects/save', async (req, res) => {
  try {
    const projectData = req.body;

    if (!projectData.userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    const [project] = await db
      .insert(musicVideoProjects)
      .values(projectData)
      .returning();

    res.json(project);
  } catch (error: any) {
    console.error('Error saving project:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/projects/update', async (req, res) => {
  try {
    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const [project] = await db
      .update(musicVideoProjects)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(musicVideoProjects.id, id))
      .returning();

    res.json(project);
  } catch (error: any) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/projects/latest', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [project] = await db
      .select()
      .from(musicVideoProjects)
      .where(eq(musicVideoProjects.userEmail, email as string))
      .orderBy(desc(musicVideoProjects.createdAt))
      .limit(1);

    res.json(project || null);
  } catch (error: any) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [project] = await db
      .select()
      .from(musicVideoProjects)
      .where(eq(musicVideoProjects.id, parseInt(id)));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error: any) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
