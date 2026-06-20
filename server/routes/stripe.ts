import { Router, Request, Response } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth';
import { db as drizzleDb } from '../db';
import { db as firebaseDb } from '../firebase';
import { bookings, payments } from '../db/schema';
import { eq } from 'drizzle-orm';
import { NotificationTemplates } from '../utils/notifications';
import { 
  STRIPE_PRICE_IDS, 
  PRICE_ID_TO_PLAN, 
  PRODUCTION_URL,
  isAdminEmail,
  normalizePlanName,
  IG_BOOST_PRICE_ID_TO_PLAN
} from '../../shared/constants';
import { sendNotificationEmail } from '../services/brevo-email-service';

const router = Router();

// Initialize Stripe with the production secret key
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeKey!, {
  apiVersion: '2025-01-27.acacia' as any, // Use the latest API version
});

console.log('🔑 Using Stripe key:', stripeKey ? (stripeKey.startsWith('sk_test_') ? '⚠️  TEST MODE (sk_test_)' : '✅ LIVE MODE') : '❌ NOT FOUND');

/**
 * Base URL for Stripe redirects
 * Uses PRODUCTION_URL from shared/constants.ts
 */
const getBaseUrl = () => {
  // Always use the production domain for Stripe redirects
  const productionUrl = process.env.PRODUCTION_URL || PRODUCTION_URL;
  
  if (process.env.NODE_ENV === 'production') {
    return productionUrl;
  }
  
  // In development, use the production URL for testing
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    return `https://${domains[0]}`;
  }
  
  // Fallback to localhost
  return 'http://localhost:5000';
};

const BASE_URL = getBaseUrl();
console.log('🔗 Stripe BASE_URL configured:', BASE_URL);

/**
 * MUSIC VIDEO PRICING - STANDALONE PRODUCT
 * Videos are sold separately from subscriptions (BASIC/PRO/PREMIUM)
 * Each video tier is ONE payment for video generation only
 */
interface TierConfig {
  name: string;
  price: number;
  videoModel: string;
  resolution: string;
  images: number;
  videos: number;
  lipsyncClips: number;
  regenerations: number;
  features: string[];
}

const MUSIC_VIDEO_TIERS: Record<string, TierConfig> = {
  essential: {
    name: 'ESSENTIAL',
    price: 99,
    videoModel: 'standard',
    resolution: '720p',
    images: 40,
    videos: 40,
    lipsyncClips: 15,
    regenerations: 1,
    features: [
      '40 unique AI-generated scenes',
      '720p HD quality',
      'Lip-sync on 15 close-up shots',
      'No watermark',
      'MP4 download',
      '1 free regeneration'
    ]
  },
  gold: {
    name: 'GOLD',
    price: 149,
    videoModel: 'professional',
    resolution: '1080p',
    images: 40,
    videos: 40,
    lipsyncClips: 15,
    regenerations: 2,
    features: [
      '40 unique AI-generated scenes',
      '1080p Full HD quality',
      'Professional-grade video model',
      'Lip-sync on 15 close-up shots',
      'No watermark',
      'HD download',
      '2 free regenerations',
      'Email support'
    ]
  },
  platinum: {
    name: 'PLATINUM',
    price: 249,
    videoModel: 'professional_plus',
    resolution: '1080p',
    images: 40,
    videos: 40,
    lipsyncClips: 40,
    regenerations: 3,
    features: [
      '40 unique AI-generated scenes',
      '1080p Full HD quality',
      'Premium video model',
      'Lip-sync on ALL 40 clips',
      'No watermark',
      'HD download',
      'Automatic color grading',
      '3 free regenerations',
      'Priority chat support'
    ]
  },
  diamond: {
    name: 'DIAMOND',
    price: 399,
    videoModel: 'premium_4k',
    resolution: '4K',
    images: 60,
    videos: 60,
    lipsyncClips: 60,
    regenerations: -1,
    features: [
      '60 unique AI-generated scenes (extended video)',
      '4K Ultra HD quality',
      'Premium video model + 4K upscaling',
      'Lip-sync on ALL 60 clips',
      '3 alternative visual concepts',
      'Director AI: 5 cinematic styles',
      'Professional color grading',
      'UNLIMITED regenerations (30 days)',
      'Multi-format export',
      '10x priority generation',
      'Dedicated account manager',
      '24/7 support',
      '🎁 First month Boostify ENTERPRISE free ($149.99 value)',
      'ENTERPRISE profile with custom domain',
      'UNLIMITED contact database',
      'Premium smart cards with analytics',
      'PRO booking calendar with payments',
      'Full merchandise store + fulfillment',
      'ALL tools UNLIMITED',
      'Multi-channel tracking',
      'Content Calendar AI',
      'Auto-optimization engine',
      'API access',
      'White-label options'
    ]
  }
};

/**
 * Mapping of plans to Stripe price IDs
 * IMPORTANT: These IDs must match pricing.tsx and webhook-stripe.ts
 * 
 * UNIFIED Naming (5-tier system):
 * - UI Names: Discover, Artist, Elevate, Amplify, Dominate
 * - DB Names: free, artist, creator, professional, enterprise
 * - Legacy Names (deprecated): basic, pro, premium
 */
const PLAN_PRICE_IDS: Record<string, { monthly: string; yearly: string }> = {
  // Artist = artist (NEW $19.99/mo tier)
  'artist': { 
    monthly: 'price_1TIhw72LyFplWimfqmZYMwUv', 
    yearly: 'price_1TIhw72LyFplWimfcpPISLbE' 
  },
  
  // Elevate = creator
  'elevate': { 
    monthly: 'price_1R0lay2LyFplWimfQxUL6Hn0', 
    yearly: 'price_1Sei7X2LyFplWimfMgbnJvPM' 
  },
  'creator': { 
    monthly: 'price_1R0lay2LyFplWimfQxUL6Hn0', 
    yearly: 'price_1Sei7X2LyFplWimfMgbnJvPM' 
  },
  'basic': { 
    monthly: 'price_1R0lay2LyFplWimfQxUL6Hn0', 
    yearly: 'price_1Sei7X2LyFplWimfMgbnJvPM' 
  },
  
  // Amplify = professional
  'amplify': { 
    monthly: 'price_1R0laz2LyFplWimfsBd5ASoa', 
    yearly: 'price_1Sei7X2LyFplWimfL1qscrKR' 
  },
  'professional': { 
    monthly: 'price_1R0laz2LyFplWimfsBd5ASoa', 
    yearly: 'price_1Sei7X2LyFplWimfL1qscrKR' 
  },
  'pro': { 
    monthly: 'price_1R0laz2LyFplWimfsBd5ASoa', 
    yearly: 'price_1Sei7X2LyFplWimfL1qscrKR' 
  },
  
  // Dominate = enterprise
  'dominate': { 
    monthly: 'price_1Sei8R2LyFplWimfXK8dAE06', 
    yearly: 'price_1Sei8R2LyFplWimf15fDEJDL' 
  },
  'enterprise': { 
    monthly: 'price_1Sei8R2LyFplWimfXK8dAE06', 
    yearly: 'price_1Sei8R2LyFplWimf15fDEJDL' 
  },
  'premium': { 
    monthly: 'price_1Sei8R2LyFplWimfXK8dAE06', 
    yearly: 'price_1Sei8R2LyFplWimf15fDEJDL' 
  }
};

/**
 * Mapping of price IDs to plan names (DB names)
 */
const PRICE_ID_TO_PLAN: Record<string, string> = {
  // Artist
  'price_1TIhw72LyFplWimfqmZYMwUv': 'artist',
  'price_1TIhw72LyFplWimfcpPISLbE': 'artist',
  // Monthly
  'price_1R0lay2LyFplWimfQxUL6Hn0': 'creator',
  'price_1R0laz2LyFplWimfsBd5ASoa': 'professional',
  'price_1Sei8R2LyFplWimfXK8dAE06': 'enterprise',
  // Yearly
  'price_1Sei7X2LyFplWimfMgbnJvPM': 'creator',
  'price_1Sei7X2LyFplWimfL1qscrKR': 'professional',
  'price_1Sei8R2LyFplWimf15fDEJDL': 'enterprise',
  // Legacy
  'price_1R0lb12LyFplWimf7JpMynKA': 'enterprise',
  // Instagram Boost Standalone
  'price_ig_boost_pro_monthly': 'ig_boost_pro',
  'price_ig_boost_pro_quarterly': 'ig_boost_pro',
  'price_ig_boost_pro_annual': 'ig_boost_pro',
  // Spotify Boost Standalone
  'price_spotify_boost_pro_monthly': 'spotify_boost_pro',
  'price_spotify_boost_pro_quarterly': 'spotify_boost_pro',
  'price_spotify_boost_pro_annual': 'spotify_boost_pro',
  // YouTube Boost Standalone
  'price_youtube_boost_pro_monthly': 'youtube_boost_pro',
  'price_youtube_boost_pro_quarterly': 'youtube_boost_pro',
  'price_youtube_boost_pro_annual': 'youtube_boost_pro',
};

/**
 * Music Video Bundle Price IDs (to be created in Stripe)
 * These are one-time payment bundles that include video + 1 month free subscription
 */
const MUSIC_VIDEO_BUNDLE_PRICE_IDS = {
  'essential': 'price_music_video_essential_99',
  'gold': 'price_music_video_gold_149',
  'platinum': 'price_music_video_platinum_249',
  'diamond': 'price_music_video_diamond_399'
};

/**
 * Subscription-only Price IDs (recurring monthly, for after free trial)
 */
const SUBSCRIPTION_PRICE_IDS = {
  'starter': 'price_subscription_starter_1999',
  'creator': 'price_subscription_creator_5999',
  'pro': 'price_subscription_pro_9999',
  'enterprise': 'price_subscription_enterprise_14999'
};

/**
 * Collection where available products are stored
 */
const PRODUCTS_COLLECTION = 'products';

/**
 * Collection where product purchases are stored
 */
const PRODUCT_PURCHASES_COLLECTION = 'product_purchases';

/**
 * Standalone Boost subscriptions (YouTube / Spotify / Instagram).
 * These are sold directly via dynamic price_data (no pre-created Stripe price IDs)
 * so the modal works out of the box without requiring Stripe Dashboard setup.
 */
const BOOST_STANDALONE_CONFIG: Record<string, { unit_amount: number; interval: 'month' | 'year'; interval_count: number; product_name: string; plan: string; product: string }> = {
  // YouTube Boost Pro
  'price_youtube_boost_pro_monthly':   { unit_amount: 1900,  interval: 'month', interval_count: 1, product_name: 'YouTube Boost Pro — Monthly',   plan: 'youtube_boost_pro', product: 'youtube_boost' },
  'price_youtube_boost_pro_quarterly': { unit_amount: 4800,  interval: 'month', interval_count: 3, product_name: 'YouTube Boost Pro — Quarterly', plan: 'youtube_boost_pro', product: 'youtube_boost' },
  'price_youtube_boost_pro_annual':    { unit_amount: 14400, interval: 'year',  interval_count: 1, product_name: 'YouTube Boost Pro — Annual',    plan: 'youtube_boost_pro', product: 'youtube_boost' },
  // Spotify Boost Pro
  'price_spotify_boost_pro_monthly':   { unit_amount: 1900,  interval: 'month', interval_count: 1, product_name: 'Spotify Boost Pro — Monthly',   plan: 'spotify_boost_pro', product: 'spotify_boost' },
  'price_spotify_boost_pro_quarterly': { unit_amount: 4800,  interval: 'month', interval_count: 3, product_name: 'Spotify Boost Pro — Quarterly', plan: 'spotify_boost_pro', product: 'spotify_boost' },
  'price_spotify_boost_pro_annual':    { unit_amount: 14400, interval: 'year',  interval_count: 1, product_name: 'Spotify Boost Pro — Annual',    plan: 'spotify_boost_pro', product: 'spotify_boost' },
  // Instagram Boost Pro
  'price_ig_boost_pro_monthly':        { unit_amount: 1900,  interval: 'month', interval_count: 1, product_name: 'Instagram Boost Pro — Monthly',   plan: 'ig_boost_pro', product: 'ig_boost_pro' },
  'price_ig_boost_pro_quarterly':      { unit_amount: 4800,  interval: 'month', interval_count: 3, product_name: 'Instagram Boost Pro — Quarterly', plan: 'ig_boost_pro', product: 'ig_boost_pro' },
  'price_ig_boost_pro_annual':         { unit_amount: 14400, interval: 'year',  interval_count: 1, product_name: 'Instagram Boost Pro — Annual',    plan: 'ig_boost_pro', product: 'ig_boost_pro' },
};

/**
 * Create a checkout session for a new subscription
 * PUBLIC ENDPOINT - no authentication required
 */
router.post('/create-subscription', async (req: Request, res: Response) => {
  try {
    // Accept both priceId and planId for greater compatibility
    const { priceId, planId, product, interval } = req.body;
    
    // Use the ID that comes, prioritizing priceId (sent from the client)
    const selectedId = priceId || planId;

    if (!selectedId) {
      return res.status(400).json({ success: false, message: 'Plan or price not specified' });
    }

    // Determine the actual Stripe price ID to use
    let priceToUse: string;
    let planKey: string;

    // Check if selectedId is a known plan name (e.g. 'artist', 'creator', 'elevate')
    const planPrices = PLAN_PRICE_IDS[selectedId as keyof typeof PLAN_PRICE_IDS];
    if (planPrices) {
      // It's a plan name — resolve to the correct interval price ID
      const billingInterval = interval === 'yearly' ? 'yearly' : 'monthly';
      priceToUse = planPrices[billingInterval];
      planKey = selectedId;
    } else {
      // It's a direct Stripe price ID (e.g. 'price_1R0lay2LyFplWimf...')
      priceToUse = selectedId;
      planKey = PRICE_ID_TO_PLAN[selectedId as keyof typeof PRICE_ID_TO_PLAN] || 'custom';
    }

    // ─── Standalone Boost subscriptions (YouTube / Spotify / IG) ───
    // These use dynamic price_data so they work without pre-created Stripe prices.
    const boostConfig = BOOST_STANDALONE_CONFIG[priceToUse];
    if (boostConfig) {
      let boostSuccessUrl: string;
      let boostCancelUrl: string;
      if (boostConfig.product === 'ig_boost_pro') {
        boostSuccessUrl = `${BASE_URL}/instagram-boost?payment=success&session_id={CHECKOUT_SESSION_ID}`;
        boostCancelUrl  = `${BASE_URL}/instagram-boost?payment=cancelled`;
      } else if (boostConfig.product === 'spotify_boost') {
        boostSuccessUrl = `${BASE_URL}/spotify?payment=success&session_id={CHECKOUT_SESSION_ID}`;
        boostCancelUrl  = `${BASE_URL}/spotify?payment=cancelled`;
      } else {
        boostSuccessUrl = `${BASE_URL}/youtube-views?payment=success&session_id={CHECKOUT_SESSION_ID}`;
        boostCancelUrl  = `${BASE_URL}/youtube-views?payment=cancelled`;
      }

      const boostSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: boostConfig.product_name },
              unit_amount: boostConfig.unit_amount,
              recurring: {
                interval: boostConfig.interval,
                interval_count: boostConfig.interval_count,
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: boostSuccessUrl,
        cancel_url: boostCancelUrl,
        allow_promotion_codes: true,
        metadata: {
          planId: boostConfig.plan,
          product: boostConfig.product,
          billingKey: priceToUse,
        },
        subscription_data: {
          metadata: {
            planId: boostConfig.plan,
            product: boostConfig.product,
            billingKey: priceToUse,
          },
        },
      });

      return res.json({ success: true, url: boostSession.url });
    }

    if (!priceToUse || priceToUse.includes('placeholder')) {
      return res.status(400).json({ 
        success: false, 
        message: 'This plan is not yet available for purchase. Please contact support.' 
      });
    }

    // Determine success URL based on product type
    let successUrl: string;
    let cancelUrl: string;
    if (product === 'ig_boost_pro') {
      successUrl = `${BASE_URL}/instagram-boost?payment=success&session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl = `${BASE_URL}/instagram-boost?payment=cancelled`;
    } else if (product === 'spotify_boost') {
      successUrl = `${BASE_URL}/spotify?payment=success&session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl = `${BASE_URL}/spotify?payment=cancelled`;
    } else if (product === 'youtube_boost') {
      successUrl = `${BASE_URL}/youtube-views?payment=success&session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl = `${BASE_URL}/youtube-views?payment=cancelled`;
    } else {
      successUrl = `${BASE_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl = `${BASE_URL}/subscription/cancelled`;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceToUse,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        planId: planKey,
        product: product || 'suite',
      },
      subscription_data: {
        metadata: {
          planId: planKey,
          product: product || 'suite',
        }
      }
    });
    
    res.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating checkout session'
    });
  }
});

/**
 * Create a one-time checkout session for the AI Video Course
 * PUBLIC ENDPOINT - no authentication required
 */
router.post('/create-course-checkout', async (req: Request, res: Response) => {
  try {
    const { courseId, amount } = req.body;

    if (!courseId || !amount || amount !== 29900) {
      return res.status(400).json({ success: false, message: 'Invalid course or amount' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Curso: Crea Videos Musicales con IA',
              description: 'Pre-sale — Acceso completo al curso + bonus 1-on-1 + 50 prompts + certificado',
              images: [],
            },
            unit_amount: 29900, // $299.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${BASE_URL}/video-service?course=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/video-service?course=cancelled`,
      metadata: {
        product: 'ai_video_course',
        courseId,
      },
    });

    res.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error('Error creating course checkout:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating course checkout',
    });
  }
});

/**
 * Get the subscription status of the current user
 */
router.get('/subscription-status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    // Get user information from Firestore
    const userSnap = await firebaseDb.collection('users').doc(userId).get();
    const userData = userSnap.data();
    
    // If the user doesn't have a customerId, they don't have a subscription
    if (!userData?.stripeCustomerId) {
      return res.json({
        id: null,
        plan: null,
        currentPlan: 'free',
        status: null,
        active: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        priceId: null
      });
    }
    
    // Search for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: userData.stripeCustomerId,
      status: 'active',
      expand: ['data.default_payment_method']
    });
    
    // If there are no active subscriptions, return free plan
    if (subscriptions.data.length === 0) {
      return res.json({
        id: null,
        plan: null,
        currentPlan: 'free',
        status: null,
        active: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        priceId: null
      });
    }
    
    // Get the first active subscription
    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;
    const plan = PRICE_ID_TO_PLAN[priceId as keyof typeof PRICE_ID_TO_PLAN] || 'free';
    
    // Return subscription information
    res.json({
      id: subscription.id,
      plan: subscription.items.data[0].price.nickname || plan,
      currentPlan: plan,
      status: subscription.status,
      active: subscription.status === 'active',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      priceId
    });
  } catch (error: any) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error getting subscription status'
    });
  }
});

/**
 * Cancel the current subscription
 */
router.post('/cancel-subscription', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    // Get user information from Firestore
    const userSnap = await firebaseDb.collection('users').doc(userId).get();
    const userData = userSnap.data();
    
    // If the user doesn't have a customerId, they don't have a subscription to cancel
    if (!userData?.stripeCustomerId) {
      return res.status(400).json({ success: false, message: 'No active subscription' });
    }
    
    // Search for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: userData.stripeCustomerId,
      status: 'active'
    });
    
    // If there are no active subscriptions, there's nothing to cancel
    if (subscriptions.data.length === 0) {
      return res.status(400).json({ success: false, message: 'No active subscription' });
    }
    
    // Get the first active subscription
    const subscription = subscriptions.data[0];
    
    // Cancel the subscription at the end of the current period
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true
    });
    
    res.json({ success: true, message: 'Subscription will be canceled at the end of the current period' });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error canceling subscription'
    });
  }
});

// Add a new route for handling Stripe webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!sig || !endpointSecret) {
      throw new Error('Webhook signature or secret not configured');
    }

    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`⚠️  Webhook signature verification failed.`, message);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  try {
    switch (event.type) {
      // ─── Checkout completed (new subscription purchase) ──────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const product = session.metadata?.product;

        console.log(`🔔 Checkout completed: session=${session.id}, product=${product}`);

        if (product === 'ig_boost_pro') {
          await handleIgBoostCheckout(session);
        } else if (product === 'spotify_boost_pro') {
          await handleSpotifyBoostCheckout(session);
        }
        break;
      }

      // ─── Subscription lifecycle events ───────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const product = subscription.metadata?.product;

        if (product === 'ig_boost_pro') {
          await handleIgBoostSubscriptionUpdate(subscription, event.type);
        } else if (product === 'spotify_boost_pro') {
          await handleSpotifyBoostSubscriptionUpdate(subscription, event.type);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const product = subscription.metadata?.product;

        if (product === 'ig_boost_pro') {
          await handleIgBoostSubscriptionCanceled(subscription);
        } else if (product === 'spotify_boost_pro') {
          await handleSpotifyBoostSubscriptionCanceled(subscription);
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown webhook handler error';
    console.error(`❌ Webhook handler error for ${event.type}:`, message);
    // Still return 200 so Stripe doesn't retry endlessly
  }

  res.json({ received: true });
});

// ─── IG Boost Pro Webhook Handlers ─────────────────────────────

async function handleIgBoostCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const customerEmail = session.customer_details?.email || session.customer_email;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!customerId || !subscriptionId) {
    console.error('❌ [ig_boost] Missing customer or subscription ID in checkout session');
    return;
  }

  console.log(`🟣 [ig_boost] Processing checkout: customer=${customerId}, sub=${subscriptionId}`);

  // Retrieve full subscription from Stripe for period dates
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id || '';
  const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';
  const amount = subscription.items.data[0]?.price?.unit_amount || 0;

  const now = new Date();
  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  // 1. Write subscription record to Firestore
  const subscriptionDoc = {
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    customerEmail: customerEmail || '',
    product: 'ig_boost_pro',
    plan: 'ig_boost_pro',
    tier: 'pro',
    status: 'active',
    priceId,
    interval: interval === 'year' ? 'annual' : interval === 'month' ? 'monthly' : 'quarterly',
    amount: amount / 100,
    currency: subscription.currency || 'usd',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await firebaseDb.collection('subscriptions').add(subscriptionDoc);
  console.log(`✅ [ig_boost] Subscription record created: ${docRef.id}`);

  // 2. Update user's subscription status in Firestore (keyed by customerEmail or customerId)
  if (customerEmail) {
    const usersSnap = await firebaseDb.collection('users')
      .where('email', '==', customerEmail)
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      const userDoc = usersSnap.docs[0];
      await userDoc.ref.set({
        igBoostTier: 'pro',
        igBoostSubscriptionId: subscriptionId,
        igBoostPeriodEnd: periodEnd,
        stripeCustomerId: customerId,
        updatedAt: now,
      }, { merge: true });
      console.log(`✅ [ig_boost] User ${userDoc.id} updated to pro tier`);
    }

    // Also update user_subscriptions collection for backward compat
    await firebaseDb.collection('user_subscriptions').doc(customerEmail).set({
      ig_boost_pro: {
        active: true,
        tier: 'pro',
        subscriptionId,
        periodEnd: periodEnd,
      },
      updatedAt: now,
    }, { merge: true });
  }

  // 3. Log event for analytics
  await firebaseDb.collection('subscription_events').add({
    event: 'ig_boost_pro_activated',
    product: 'ig_boost_pro',
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    customerEmail: customerEmail || '',
    priceId,
    amount: amount / 100,
    interval: subscriptionDoc.interval,
    timestamp: now,
  });
  console.log(`📊 [ig_boost] Analytics event logged`);

  // 4. Send confirmation email via Brevo
  if (customerEmail) {
    try {
      await sendNotificationEmail(
        customerEmail,
        '🎉 Instagram Boost Pro Activated!',
        'Welcome to Instagram Boost Pro! 🚀',
        `Your Instagram Boost Pro subscription is now active! You have unlimited access to all AI tools, content creation, growth features, and analytics.<br><br>
        <strong>Plan:</strong> Instagram Boost Pro<br>
        <strong>Amount:</strong> $${(amount / 100).toFixed(2)}/${interval}<br>
        <strong>Next billing:</strong> ${periodEnd.toLocaleDateString()}<br><br>
        Start growing your Instagram presence now!`,
        'Open Instagram Boost',
        `${PRODUCTION_URL || 'https://boostifymusic.com'}/instagram-boost`
      );
      console.log(`📧 [ig_boost] Confirmation email sent to ${customerEmail}`);
    } catch (emailErr) {
      console.error(`⚠️ [ig_boost] Email send failed (non-critical):`, emailErr);
    }
  }
}

async function handleIgBoostSubscriptionUpdate(subscription: Stripe.Subscription, eventType: string): Promise<void> {
  const subscriptionId = subscription.id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const status = subscription.status;
  const periodEnd = new Date(subscription.current_period_end * 1000);

  console.log(`🔄 [ig_boost] Subscription ${eventType}: sub=${subscriptionId}, status=${status}`);

  // Update Firestore subscription record
  const subsSnap = await firebaseDb.collection('subscriptions')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!subsSnap.empty) {
    const isActive = status === 'active' || status === 'trialing';
    await subsSnap.docs[0].ref.update({
      status,
      tier: isActive ? 'pro' : 'free',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    });
  }

  // Update user record
  if (customerId) {
    const usersSnap = await firebaseDb.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      const isActive = status === 'active' || status === 'trialing';
      await usersSnap.docs[0].ref.update({
        igBoostTier: isActive ? 'pro' : 'free',
        igBoostPeriodEnd: periodEnd,
        updatedAt: new Date(),
      });
    }
  }

  // Log analytics event
  await firebaseDb.collection('subscription_events').add({
    event: `ig_boost_pro_${eventType.split('.').pop()}`,
    product: 'ig_boost_pro',
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId || '',
    status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    periodEnd,
    timestamp: new Date(),
  });
}

async function handleIgBoostSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
  const subscriptionId = subscription.id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

  console.log(`🔴 [ig_boost] Subscription canceled: sub=${subscriptionId}`);

  // Update Firestore subscription to canceled
  const subsSnap = await firebaseDb.collection('subscriptions')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!subsSnap.empty) {
    await subsSnap.docs[0].ref.update({
      status: 'cancelled',
      tier: 'free',
      updatedAt: new Date(),
    });
  }

  // Revert user to free tier
  let customerEmail: string | undefined;
  if (customerId) {
    const usersSnap = await firebaseDb.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      customerEmail = usersSnap.docs[0].data().email;
      await usersSnap.docs[0].ref.update({
        igBoostTier: 'free',
        igBoostSubscriptionId: null,
        updatedAt: new Date(),
      });
      console.log(`✅ [ig_boost] User reverted to free tier`);
    }
  }

  // Update user_subscriptions
  if (customerEmail) {
    await firebaseDb.collection('user_subscriptions').doc(customerEmail).set({
      ig_boost_pro: { active: false, tier: 'free' },
      updatedAt: new Date(),
    }, { merge: true });
  }

  // Log analytics
  await firebaseDb.collection('subscription_events').add({
    event: 'ig_boost_pro_canceled',
    product: 'ig_boost_pro',
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId || '',
    timestamp: new Date(),
  });

  // Send cancellation email
  if (customerEmail) {
    try {
      await sendNotificationEmail(
        customerEmail,
        'Instagram Boost Pro — Subscription Ended',
        'Your Instagram Boost Pro subscription has ended',
        `Your Instagram Boost Pro access has been deactivated. You're now on the free tier with limited daily actions.<br><br>
        You can resubscribe at any time to regain full access to all features.`,
        'Resubscribe Now',
        `${PRODUCTION_URL || 'https://boostifymusic.com'}/instagram-boost`
      );
    } catch (emailErr) {
      console.error(`⚠️ [ig_boost] Cancellation email failed:`, emailErr);
    }
  }
}

// ─── Spotify Boost Pro Webhook Handlers ────────────────────────

async function handleSpotifyBoostCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const customerEmail = session.customer_details?.email || session.customer_email;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!customerId || !subscriptionId) {
    console.error('❌ [spotify_boost] Missing customer or subscription ID in checkout session');
    return;
  }

  console.log(`🟢 [spotify_boost] Processing checkout: customer=${customerId}, sub=${subscriptionId}`);

  // Retrieve full subscription from Stripe for period dates
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id || '';
  const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';
  const amount = subscription.items.data[0]?.price?.unit_amount || 0;

  const now = new Date();
  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  // 1. Write subscription record to Firestore
  const subscriptionDoc = {
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    customerEmail: customerEmail || '',
    product: 'spotify_boost_pro',
    plan: 'spotify_boost_pro',
    tier: 'pro',
    status: 'active',
    priceId,
    interval: interval === 'year' ? 'annual' : interval === 'month' ? 'monthly' : 'quarterly',
    amount: amount / 100,
    currency: subscription.currency || 'usd',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await firebaseDb.collection('subscriptions').add(subscriptionDoc);
  console.log(`✅ [spotify_boost] Subscription record created: ${docRef.id}`);

  // 2. Update user's subscription status in Firestore
  if (customerEmail) {
    const usersSnap = await firebaseDb.collection('users')
      .where('email', '==', customerEmail)
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      const userDoc = usersSnap.docs[0];
      await userDoc.ref.set({
        spotifyBoostTier: 'pro',
        spotifyBoostSubscriptionId: subscriptionId,
        spotifyBoostExpiry: periodEnd,
        stripeCustomerId: customerId,
        updatedAt: now,
      }, { merge: true });
      console.log(`✅ [spotify_boost] User ${userDoc.id} updated to pro tier`);
    }

    // Also update user_subscriptions collection for backward compat
    await firebaseDb.collection('user_subscriptions').doc(customerEmail).set({
      spotify_boost_pro: {
        active: true,
        tier: 'pro',
        subscriptionId,
        periodEnd: periodEnd,
      },
      updatedAt: now,
    }, { merge: true });
  }

  // 3. Log event for analytics
  await firebaseDb.collection('subscription_events').add({
    event: 'spotify_boost_pro_activated',
    product: 'spotify_boost_pro',
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    customerEmail: customerEmail || '',
    priceId,
    amount: amount / 100,
    interval: subscriptionDoc.interval,
    timestamp: now,
  });
  console.log(`📊 [spotify_boost] Analytics event logged`);

  // 4. Send welcome email via Brevo
  if (customerEmail) {
    try {
      await sendNotificationEmail(
        customerEmail,
        '🎉 Spotify Boost Pro Activated!',
        'Welcome to Spotify Boost Pro! 🚀',
        `Your Spotify Boost Pro subscription is now active! You have unlimited access to all AI tools, playlist pitching, growth features, and analytics.<br><br>
        <strong>Plan:</strong> Spotify Boost Pro<br>
        <strong>Amount:</strong> $${(amount / 100).toFixed(2)}/${interval}<br>
        <strong>Next billing:</strong> ${periodEnd.toLocaleDateString()}<br><br>
        Start growing your Spotify streams now!`,
        'Open Spotify Growth Suite',
        `${PRODUCTION_URL || 'https://boostifymusic.com'}/spotify`
      );
      console.log(`📧 [spotify_boost] Welcome email sent to ${customerEmail}`);
    } catch (emailErr) {
      console.error(`⚠️ [spotify_boost] Email send failed (non-critical):`, emailErr);
    }
  }
}

async function handleSpotifyBoostSubscriptionUpdate(subscription: Stripe.Subscription, eventType: string): Promise<void> {
  const subscriptionId = subscription.id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const status = subscription.status;
  const periodEnd = new Date(subscription.current_period_end * 1000);

  console.log(`🔄 [spotify_boost] Subscription ${eventType}: sub=${subscriptionId}, status=${status}`);

  // Update Firestore subscription record
  const subsSnap = await firebaseDb.collection('subscriptions')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!subsSnap.empty) {
    const isActive = status === 'active' || status === 'trialing';
    await subsSnap.docs[0].ref.update({
      status,
      tier: isActive ? 'pro' : 'free',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    });
  }

  // Update user record
  if (customerId) {
    const usersSnap = await firebaseDb.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      const isActive = status === 'active' || status === 'trialing';
      await usersSnap.docs[0].ref.update({
        spotifyBoostTier: isActive ? 'pro' : 'free',
        spotifyBoostExpiry: periodEnd,
        updatedAt: new Date(),
      });
    }
  }

  // Log analytics event
  await firebaseDb.collection('subscription_events').add({
    event: `spotify_boost_pro_${eventType.split('.').pop()}`,
    product: 'spotify_boost_pro',
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId || '',
    status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    periodEnd,
    timestamp: new Date(),
  });
}

async function handleSpotifyBoostSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
  const subscriptionId = subscription.id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

  console.log(`🔴 [spotify_boost] Subscription canceled: sub=${subscriptionId}`);

  // Update Firestore subscription to canceled
  const subsSnap = await firebaseDb.collection('subscriptions')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!subsSnap.empty) {
    await subsSnap.docs[0].ref.update({
      status: 'cancelled',
      tier: 'free',
      updatedAt: new Date(),
    });
  }

  // Revert user to free tier
  let customerEmail: string | undefined;
  if (customerId) {
    const usersSnap = await firebaseDb.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      customerEmail = usersSnap.docs[0].data().email;
      await usersSnap.docs[0].ref.update({
        spotifyBoostTier: 'free',
        spotifyBoostSubscriptionId: null,
        spotifyBoostExpiry: null,
        updatedAt: new Date(),
      });
      console.log(`✅ [spotify_boost] User reverted to free tier`);
    }
  }

  // Update user_subscriptions
  if (customerEmail) {
    await firebaseDb.collection('user_subscriptions').doc(customerEmail).set({
      spotify_boost_pro: { active: false, tier: 'free' },
      updatedAt: new Date(),
    }, { merge: true });
  }

  // Log analytics
  await firebaseDb.collection('subscription_events').add({
    event: 'spotify_boost_pro_canceled',
    product: 'spotify_boost_pro',
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId || '',
    timestamp: new Date(),
  });

  // Send cancellation email
  if (customerEmail) {
    try {
      await sendNotificationEmail(
        customerEmail,
        'Spotify Boost Pro — Subscription Ended',
        'Your Spotify Boost Pro subscription has ended',
        `Your Spotify Boost Pro access has been deactivated. You're now on the free tier with limited daily actions.<br><br>
        You can resubscribe at any time to regain full access to all features.`,
        'Resubscribe Now',
        `${PRODUCTION_URL || 'https://boostifymusic.com'}/spotify`
      );
    } catch (emailErr) {
      console.error(`⚠️ [spotify_boost] Cancellation email failed:`, emailErr);
    }
  }
}

export default router;
