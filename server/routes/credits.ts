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
} from '../services/credit-engine';
import {
  OPERATION_COSTS,
  CREDIT_PACKAGES,
  TIER_CREDIT_ALLOCATIONS,
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

    const { credits, isAdmin } = await getUserBalance(userEmail);

    res.json({ credits, isAdmin });
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
