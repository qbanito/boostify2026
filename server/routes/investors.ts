import { Router, Request } from 'express';
import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import Stripe from 'stripe';
import axios from 'axios';
import { isAuthenticated, ClerkAuthUser } from '../middleware/clerk-auth';

const router = Router();

// Extend Express Request type
interface AuthRequest extends Request {
  user?: ClerkAuthUser;
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
});

// Make.com webhook URL
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/hfnbfse1q9gtm71xeamn5p5tj48fyv8x';

// Validation schema for investor registration
const investorSchema = z.object({
  fullName: z.string().min(2, { message: "Full name is required" }),
  email: z.string().email({ message: "Valid email is required" }),
  phone: z.string().min(1, { message: "Phone is required" }),
  country: z.string().min(2, { message: "Country is required" }),
  investmentAmount: z.number().min(1, { message: "Investment amount is required" }),
  investorType: z.enum(["individual", "corporate", "institutional"]),
  riskTolerance: z.enum(["low", "medium", "high"]),
  investmentGoals: z.string().min(1, { message: "Investment goals are required" }),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: "You must accept the terms and conditions"
  })
});

// Route to register a new investor
router.post('/register', isAuthenticated, async (req: AuthRequest, res) => {
  try {
    // Validate the request body
    const validationResult = investorSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.format()
      });
    }
    
    const investorData = {
      ...validationResult.data,
      userId: req.user.uid,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    
    // Save to Firestore
    const docRef = await db.collection('investors').add(investorData);
    
    console.log("New investor registered with ID:", docRef.id);
    
    // Send data to Make.com webhook
    try {
      await axios.post(MAKE_WEBHOOK_URL, {
        investorId: docRef.id,
        userId: req.user.uid,
        fullName: validationResult.data.fullName,
        email: validationResult.data.email,
        phone: validationResult.data.phone,
        country: validationResult.data.country,
        investmentAmount: validationResult.data.investmentAmount,
        investmentGoals: validationResult.data.investmentGoals,
        riskTolerance: validationResult.data.riskTolerance,
        investorType: validationResult.data.investorType,
        termsAccepted: validationResult.data.termsAccepted,
        status: "pending",
        registrationDate: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log("Webhook notification sent to Make.com successfully");
    } catch (webhookError: any) {
      console.error('Failed to send webhook to Make.com:', webhookError.message);
      // Continue execution even if webhook fails
    }
    
    return res.status(201).json({ 
      success: true, 
      message: 'Investor registration successful',
      id: docRef.id
    });
    
  } catch (error: any) {
    console.error('Error registering investor:', error);
    return res.status(500).json({ 
      error: 'Failed to register investor',
      details: error.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/investors/me
 * Get current investor data
 */
router.get('/me', isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.clerkUserId;

    const investorSnapshot = await db.collection('investors')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (investorSnapshot.empty) {
      return res.status(404).json({ 
        success: false, 
        message: 'Inversor no encontrado',
        registered: false
      });
    }

    const investorDoc = investorSnapshot.docs[0];
    const investorData = investorDoc.data();

    // Get investor's investments
    const investmentsSnapshot = await db.collection('investments')
      .where('investorId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const investments = investmentsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate stats
    const totalInvested = investments.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
    const totalReturns = investments.reduce((sum: number, inv: any) => sum + (inv.totalReturns || 0), 0);
    const currentValue = totalInvested + totalReturns;

    return res.status(200).json({
      success: true,
      data: {
        id: investorDoc.id,
        ...investorData,
        registered: true,
        stats: {
          totalInvested,
          totalReturns,
          currentValue,
          investmentCount: investments.length
        },
        investments
      }
    });

  } catch (error: any) {
    console.error('Error getting investor data:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener datos del inversor' 
    });
  }
});

/**
 * POST /api/investors/investment/create-checkout
 * Create Stripe checkout session for investment
 */
router.post('/investment/create-checkout', isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.clerkUserId;
    const { amount, planType, duration } = req.body;

    // Validate investor is registered
    const investorSnapshot = await db.collection('investors')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (investorSnapshot.empty) {
      return res.status(403).json({ 
        success: false, 
        message: 'Debes registrarte como inversor primero' 
      });
    }

    const investorData = investorSnapshot.docs[0].data();

    if (investorData?.status !== 'approved' && investorData?.status !== 'pending') {
      return res.status(403).json({ 
        success: false, 
        message: 'Tu cuenta de inversor está pendiente de aprobación' 
      });
    }

    // Minimum investment validation
    if (amount < 2000) {
      return res.status(400).json({ 
        success: false, 
        message: 'La inversión mínima es de $2,000 USD' 
      });
    }

    // Calculate return rate based on amount
    let returnRate = 0.04; // 4% default
    if (amount >= 10000) returnRate = 0.06; // 6%
    else if (amount >= 5000) returnRate = 0.05; // 5%

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Boostify Investment - ${planType || 'Standard'} Plan`,
              description: `Investment for ${duration || 12} months with ${(returnRate * 100).toFixed(0)}% monthly returns`,
            },
            unit_amount: amount * 100, // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.PRODUCTION_URL || 'https://boostifymusic.com'}/investors-dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.PRODUCTION_URL || 'https://boostifymusic.com'}/investors-dashboard?canceled=true`,
      metadata: {
        userId,
        investorId: userId,
        amount: amount.toString(),
        planType: planType || 'standard',
        duration: (duration || 12).toString(),
        returnRate: returnRate.toString(),
        type: 'investment'
      }
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al crear sesión de pago' 
    });
  }
});

/**
 * GET /api/investors/stats
 * Get global investment statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const investmentsSnapshot = await db.collection('investments')
      .where('status', '==', 'active')
      .get();

    const totalInvestments = investmentsSnapshot.size;
    const totalCapital = investmentsSnapshot.docs.reduce((sum: number, doc: any) => {
      const data = doc.data();
      return sum + (data.amount || 0);
    }, 0);

    const totalReturns = investmentsSnapshot.docs.reduce((sum: number, doc: any) => {
      const data = doc.data();
      return sum + (data.totalReturns || 0);
    }, 0);

    const investorsSnapshot = await db.collection('investors').get();
    const totalInvestors = investorsSnapshot.size;

    return res.status(200).json({
      success: true,
      data: {
        totalInvestments,
        totalInvestors,
        totalCapital,
        totalReturns,
        currentValue: totalCapital + totalReturns
      }
    });

  } catch (error: any) {
    console.error('Error getting stats:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estadísticas' 
    });
  }
});

export default router;