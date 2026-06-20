import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db as drizzleDb } from '../db';
import { db as firebaseDb } from '../firebase';
import { SpotifyBoostLimits } from '../db/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const router = Router();

// Initialize Stripe with the secret key
const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeKey!, {
  apiVersion: '2025-01-27.acacia' as any,
});

/**
 * Get Spotify Boost usage limits for the current user
 */
router.get('/limits', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Fetch user subscription data
    const userSnap = await firebaseDb.collection('users').doc(userId).get();
    const userData = userSnap.data();

    // Determine plan based on subscription
    const plan = userData?.subscription || 'free';

    // Fetch limits from the database
    const limits = await drizzleDb.select().from(SpotifyBoostLimits).where(eq(SpotifyBoostLimits.plan, plan)).first();

    if (!limits) {
      return res.status(404).json({ success: false, message: 'Limits not found for the current plan' });
    }

    res.json({ success: true, limits });
  } catch (error: any) {
    console.error('Error fetching Spotify Boost limits:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching Spotify Boost limits'
    });
  }
});

/**
 * Webhook handler for Stripe events related to Spotify Boost Pro
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const planId = subscription.items.data[0].price.id;

      // Handle spotify_boost_pro specific events
      if (['price_spotify_boost_pro_monthly', 'price_spotify_boost_pro_quarterly', 'price_spotify_boost_pro_annual'].includes(planId)) {
        console.log(`Handling spotify_boost_pro event for customer: ${customerId}`);
        // Additional logic for spotify_boost_pro can be added here
      }

      // Update user subscription in Firestore
      try {
        const userSnap = await firebaseDb.collection('users').where('stripeCustomerId', '==', customerId).get();
        if (!userSnap.empty) {
          const userDoc = userSnap.docs[0];
          await userDoc.ref.update({
            subscription: planId,
            subscriptionStatus: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          });
        }
      } catch (error) {
        console.error('Error updating user subscription:', error);
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
});

export default router;
