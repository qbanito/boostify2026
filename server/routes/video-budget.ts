/**
 * BOOSTIFY Video Budget API Routes
 * Handles budget calculation, Stripe payment, and generation unlock
 */
import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { db } from '../db';
import { videoBudgets } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { calculateVideoBudget, type BudgetConfig } from '../../shared/video-budget-calculator';

// Admin emails - must match client/src/hooks/use-auth.ts
const ADMIN_EMAILS = ['convoycubano@gmail.com'];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia' as any,
});

const router = Router();

/**
 * POST /api/video-budget/calculate
 * Calculate budget for a video project (no payment, just preview)
 */
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const config: BudgetConfig = req.body;
    
    if (!config.songDurationSec || !config.videoModelId) {
      return res.status(400).json({ error: 'songDurationSec and videoModelId are required' });
    }
    
    const budget = calculateVideoBudget(config);
    res.json({ success: true, budget });
  } catch (error: any) {
    console.error('[VideoBudget] Calculate error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video-budget/create-payment
 * Create a Stripe PaymentIntent and save budget record
 */
router.post('/create-payment', async (req: Request, res: Response) => {
  try {
    const { 
      config, 
      userEmail, 
      userId,
      songTitle,
      projectId 
    } = req.body;
    
    if (!userEmail || !config) {
      return res.status(400).json({ error: 'userEmail and config are required' });
    }
    
    const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());
    const budget = calculateVideoBudget(config);
    
    // Admin bypass — create record with admin_bypass status
    if (isAdmin) {
      const [record] = await db.insert(videoBudgets).values({
        projectId: projectId || null,
        userEmail,
        userId: userId || null,
        songTitle: songTitle || null,
        songDuration: Math.round(config.songDurationSec),
        numClips: budget.numClips,
        clipDuration: Math.round(config.clipDurationSec),
        videoModel: config.videoModelId,
        imageModel: config.imageModelId,
        resolution: config.resolution || '1080p',
        includesLipsync: config.includesLipsync,
        includesMotion: config.includesMotion,
        includesMicrocuts: config.includesMicrocuts,
        costBreakdown: budget.costBreakdown,
        internalCost: budget.internalCost.toString(),
        markupMultiplier: budget.markupMultiplier.toString(),
        userPrice: '0.00',
        paymentStatus: 'admin_bypass',
        contractAccepted: true,
        contractSignature: 'ADMIN BYPASS',
        contractTimestamp: new Date(),
        adminBypass: true,
        generationStatus: 'not_started',
      }).returning();
      
      return res.json({
        success: true,
        budgetId: record.id,
        adminBypass: true,
        budget,
      });
    }
    
    // Normal user — create Stripe PaymentIntent
    const amountCents = Math.round(budget.displayPrice * 100);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: {
        type: 'video_budget',
        userEmail,
        songTitle: songTitle || 'Unknown',
        videoModel: config.videoModelId,
        numClips: budget.numClips.toString(),
        internalCost: budget.internalCost.toString(),
        displayPrice: budget.displayPrice.toString(),
      },
    });
    
    // Save budget record
    const [record] = await db.insert(videoBudgets).values({
      projectId: projectId || null,
      userEmail,
      userId: userId || null,
      songTitle: songTitle || null,
      songDuration: Math.round(config.songDurationSec),
      numClips: budget.numClips,
      clipDuration: Math.round(config.clipDurationSec),
      videoModel: config.videoModelId,
      imageModel: config.imageModelId,
      resolution: config.resolution || '1080p',
      includesLipsync: config.includesLipsync,
      includesMotion: config.includesMotion,
      includesMicrocuts: config.includesMicrocuts,
      costBreakdown: budget.costBreakdown,
      internalCost: budget.internalCost.toString(),
      markupMultiplier: budget.markupMultiplier.toString(),
      userPrice: budget.displayPrice.toString(),
      stripePaymentIntentId: paymentIntent.id,
      stripeClientSecret: paymentIntent.client_secret,
      paymentStatus: 'pending',
      generationStatus: 'not_started',
    }).returning();
    
    res.json({
      success: true,
      budgetId: record.id,
      clientSecret: paymentIntent.client_secret,
      budget,
      adminBypass: false,
    });
  } catch (error: any) {
    console.error('[VideoBudget] Create payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video-budget/verify-payment
 * Verify Stripe payment and unlock generation
 */
router.post('/verify-payment', async (req: Request, res: Response) => {
  try {
    const { budgetId, paymentIntentId } = req.body;
    
    if (!budgetId) {
      return res.status(400).json({ error: 'budgetId is required' });
    }
    
    const [record] = await db.select().from(videoBudgets).where(eq(videoBudgets.id, budgetId));
    
    if (!record) {
      return res.status(404).json({ error: 'Budget record not found' });
    }
    
    // Admin bypass — already approved
    if (record.adminBypass) {
      return res.json({ success: true, status: 'admin_bypass', unlocked: true });
    }
    
    // Verify with Stripe
    const piId = paymentIntentId || record.stripePaymentIntentId;
    if (!piId) {
      return res.status(400).json({ error: 'No payment intent ID' });
    }
    
    const paymentIntent = await stripe.paymentIntents.retrieve(piId);
    
    if (paymentIntent.status === 'succeeded') {
      await db.update(videoBudgets)
        .set({ 
          paymentStatus: 'paid', 
          updatedAt: new Date() 
        })
        .where(eq(videoBudgets.id, budgetId));
      
      return res.json({ success: true, status: 'paid', unlocked: true });
    }
    
    res.json({ success: false, status: paymentIntent.status, unlocked: false });
  } catch (error: any) {
    console.error('[VideoBudget] Verify payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video-budget/admin-bypass
 * Admin closes modal and proceeds without payment
 */
router.post('/admin-bypass', async (req: Request, res: Response) => {
  try {
    const { budgetId, userEmail } = req.body;
    
    if (!ADMIN_EMAILS.includes((userEmail || '').toLowerCase())) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    if (budgetId) {
      await db.update(videoBudgets)
        .set({ 
          paymentStatus: 'admin_bypass', 
          adminBypass: true,
          contractAccepted: true,
          contractSignature: 'ADMIN BYPASS',
          contractTimestamp: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(videoBudgets.id, budgetId));
    }
    
    res.json({ success: true, unlocked: true });
  } catch (error: any) {
    console.error('[VideoBudget] Admin bypass error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video-budget/sign-contract
 * Accept contract terms
 */
router.post('/sign-contract', async (req: Request, res: Response) => {
  try {
    const { budgetId, signature } = req.body;
    
    if (!budgetId || !signature) {
      return res.status(400).json({ error: 'budgetId and signature are required' });
    }
    
    await db.update(videoBudgets)
      .set({
        contractAccepted: true,
        contractSignature: signature,
        contractTimestamp: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoBudgets.id, budgetId));
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[VideoBudget] Sign contract error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/video-budget/check/:projectId
 * Check if a project has an approved budget
 */
router.get('/check/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const userEmail = req.query.email as string;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'email query param required' });
    }
    
    // Admin always has access
    if (ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
      return res.json({ approved: true, adminBypass: true });
    }
    
    const [budget] = await db.select()
      .from(videoBudgets)
      .where(
        and(
          eq(videoBudgets.userEmail, userEmail),
          eq(videoBudgets.paymentStatus, 'paid')
        )
      )
      .orderBy(desc(videoBudgets.createdAt))
      .limit(1);
    
    res.json({ 
      approved: !!budget, 
      budgetId: budget?.id,
      adminBypass: false,
    });
  } catch (error: any) {
    console.error('[VideoBudget] Check error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video-budget/update-generation
 * Update generation progress
 */
router.post('/update-generation', async (req: Request, res: Response) => {
  try {
    const { budgetId, status, clipsGenerated } = req.body;
    
    await db.update(videoBudgets)
      .set({
        generationStatus: status,
        clipsGenerated: clipsGenerated || 0,
        updatedAt: new Date(),
      })
      .where(eq(videoBudgets.id, budgetId));
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[VideoBudget] Update generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
