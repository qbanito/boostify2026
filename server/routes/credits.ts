import express from 'express';
import Stripe from 'stripe';
import { db } from '../db';
import { userCredits, creditTransactions, musicVideoProjects } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  getUserBalance,
  chargeCredits,
  addCredits,
  getOperationCreditCost,
  canAfford,
  grantMonthlyCreditsIfDue,
} from '../services/credit-engine';
import {
  OPERATION_COSTS,
  CREDIT_PACKAGES,
  TIER_CREDIT_ALLOCATIONS,
  DEFAULT_MARKUP_MULTIPLIER,
  getFullPricingTable,
  type OperationType,
} from '../../shared/credit-pricing';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing Stripe secret key');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

const router = express.Router();

router.get('/api/credits/balance', async (req, res) => {
  try {
    const userEmail = req.query.email as string;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

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
    const { email, amount = 199 } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: {
        userEmail: email,
        credits: amount.toString(),
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/credits/verify-payment', async (req, res) => {
  try {
    const { paymentIntentId, email, tier } = req.body;

    if (!paymentIntentId || !email) {
      return res.status(400).json({ error: 'Payment intent ID and email are required' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    const credits = parseInt(paymentIntent.metadata.credits || '0');
    if (credits <= 0) {
      return res.status(400).json({ error: 'Invalid credit amount' });
    }

    const result = await addCredits(
      email,
      credits,
      'purchase',
      `Purchased ${credits} credits`,
      { stripePaymentIntentId: paymentIntentId, tier: tier || 'free' }
    );

    res.json({ success: true, credits, newBalance: result.newBalance });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Stripe Checkout — buy a credit package (hosted checkout, recommended flow)
// ============================================
router.post('/api/credits/create-checkout-session', async (req, res) => {
  try {
    const { email, packageId, tier, successUrl, cancelUrl } = req.body || {};

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: 'Invalid packageId' });

    const origin =
      (req.headers.origin as string) ||
      (req.headers.referer ? new URL(req.headers.referer as string).origin : '') ||
      process.env.APP_BASE_URL ||
      'https://boostify.app';

    // Return the user to wherever they launched checkout from, appending the session id.
    const returnBase = (successUrl || origin).split('#')[0];
    const successWithSession = `${returnBase}${returnBase.includes('?') ? '&' : '?'}credits_session={CHECKOUT_SESSION_ID}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
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
        tier: tier || 'free',
      },
      success_url: successWithSession,
      cancel_url: cancelUrl || origin,
    });

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify a completed Checkout Session and credit the user (idempotent).
router.post('/api/credits/verify-checkout', async (req, res) => {
  try {
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
    const credits = parseInt(md.credits || '0', 10);
    const priceUsd = parseFloat(md.priceUsd || '0');
    if (!email || credits <= 0) {
      return res.status(400).json({ error: 'Invalid session metadata' });
    }

    // Idempotency: bail if we already credited this checkout session.
    const [already] = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.stripeCheckoutSessionId, sessionId))
      .limit(1);
    if (already) {
      const bal = await getUserBalance(email);
      return res.json({ success: true, alreadyProcessed: true, credits, newBalance: bal.credits });
    }

    const result = await addCredits(
      email,
      credits,
      'purchase',
      `Purchased ${credits.toLocaleString()} credits (${md.packageId})`,
      {
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
        tier: md.tier || 'free',
        paidUsd: priceUsd,
        markup: DEFAULT_MARKUP_MULTIPLIER,
      }
    );

    // Tag a marker transaction with the checkout session id for idempotency.
    await db.insert(creditTransactions).values({
      userEmail: email,
      amount: 0,
      type: 'purchase',
      description: `Checkout session ${sessionId} settled`,
      stripeCheckoutSessionId: sessionId,
    });

    res.json({ success: true, credits, newBalance: result.newBalance });
  } catch (error: any) {
    console.error('Error verifying checkout:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/credits/deduct', async (req, res) => {
  try {
    const { email, amount, operationType, projectId, description } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // If operationType is provided, use smart credit engine
    if (operationType && OPERATION_COSTS[operationType as OperationType]) {
      const result = await chargeCredits(email, operationType as OperationType, {
        quantity: amount || 1,
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
    if (!amount) {
      return res.status(400).json({ error: 'amount or operationType required' });
    }

    if (email === 'convoycubano@gmail.com') {
      return res.json({ success: true, remainingCredits: 999999 });
    }

    const [userCredit] = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.userEmail, email));

    if (!userCredit || userCredit.credits < amount) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    await db
      .update(userCredits)
      .set({ 
        credits: userCredit.credits - amount,
        updatedAt: new Date()
      })
      .where(eq(userCredits.userEmail, email));

    await db.insert(creditTransactions).values({
      userEmail: email,
      amount: -amount,
      type: 'deduction',
      description: description || `Deducted ${amount} credits`,
      relatedProjectId: projectId,
    });

    res.json({ success: true, remainingCredits: userCredit.credits - amount });
  } catch (error: any) {
    console.error('Error deducting credits:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/credits/transactions', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

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
    const email = req.query.email as string;
    const operationType = req.query.operationType as string;
    const quantity = parseInt(req.query.quantity as string) || 1;

    if (!email || !operationType) {
      return res.status(400).json({ error: 'email and operationType are required' });
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
    const operationType = req.query.operationType as string;

    if (!operationType || !OPERATION_COSTS[operationType as OperationType]) {
      return res.status(400).json({ error: 'Valid operationType is required' });
    }

    const creditCost = await getOperationCreditCost(operationType as OperationType);
    const op = OPERATION_COSTS[operationType as OperationType];

    res.json({
      operationType,
      name: op.name,
      creditCost,
      userPriceUsd: (creditCost / 100).toFixed(2),
      unit: op.unit,
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
    const table = getFullPricingTable(markup);
    
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
