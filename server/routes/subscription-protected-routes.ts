import { Router, Request, Response, Express } from 'express';
import { authenticate } from '../middleware/auth';
import { 
  requireSubscription, 
  requireBasic, 
  requirePro, 
  requirePremium 
} from '../middleware/subscription-check';

const router = Router();

/**
 * Setup subscription protected routes
 * @param app Express application
 */
export function setupSubscriptionRoutes(app: Express) {
  // Mount the subscription-protected routes
  app.use('/api/subscription', router);
  
  console.log('✅ Subscription-protected routes are registered');
}

/**
 * Test route - Free (available to all)
 * This route is available to all users regardless of subscription status
 */
router.get('/free-feature', authenticate, requireSubscription('free'), 
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'This is a free feature available to all users',
      feature: 'Free Feature',
      subscription: req.user?.subscription
    });
  }
);

/**
 * Test route - Basic (requires at least Basic subscription)
 * This route is available to users with Basic, Pro, or Premium subscription
 */
router.get('/basic-feature', authenticate, requireBasic, 
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'This is a basic feature available to Basic, Pro, and Premium subscribers',
      feature: 'Basic Feature',
      subscription: req.user?.subscription
    });
  }
);

/**
 * Test route - Pro (requires at least Pro subscription)
 * This route is available to users with Pro or Premium subscription
 */
router.get('/pro-feature', authenticate, requirePro, 
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'This is a pro feature available to Pro and Premium subscribers',
      feature: 'Pro Feature',
      subscription: req.user?.subscription
    });
  }
);

/**
 * Test route - Premium (requires Premium subscription)
 * This route is available only to users with Premium subscription
 */
router.get('/premium-feature', authenticate, requirePremium, 
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'This is a premium feature available only to Premium subscribers',
      feature: 'Premium Feature',
      subscription: req.user?.subscription
    });
  }
);

/**
 * Get subscription tier information
 * Lists all available subscription tiers with their prices and features
 */
router.get('/tiers', 
  async (req: Request, res: Response) => {
    // Define the subscription tiers
    const tiers = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        priceId: null,
        features: [
          'Limited access to AI tools',
          'Basic music lessons',
          'Public artist profile',
          'Limited song uploads'
        ]
      },
      {
        id: 'basic',
        name: 'Basic',
        price: 59.99,
        priceId: process.env.STRIPE_PRICE_BASIC || 'price_basic',
        features: [
          'All free features',
          'Enhanced AI tools',
          'Intermediate music lessons',
          'Moderate song uploads',
          'Basic analytics'
        ]
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 99.99,
        priceId: process.env.STRIPE_PRICE_PRO || 'price_pro',
        features: [
          'All basic features',
          'Advanced AI tools',
          'Advanced music lessons',
          'Priority support',
          'Enhanced analytics',
          'Marketing tools'
        ]
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 149.99,
        priceId: process.env.STRIPE_PRICE_PREMIUM || 'price_premium',
        features: [
          'All pro features',
          'Unlimited AI generation',
          'Master class lessons',
          'Dedicated support',
          'Advanced marketing tools',
          'Promotion opportunities',
          'Exclusive industry access'
        ]
      }
    ];
    
    res.json(tiers);
  }
);

/**
 * Check current subscription access level
 * Returns the current subscription tier and what features the user has access to
 */
router.get('/access-check', authenticate, 
  async (req: Request, res: Response) => {
    const subscription = req.user?.subscription;
    
    // Determine the subscription level
    let level = 'free';
    
    if (subscription?.active) {
      level = subscription.plan;
    }
    
    // Is admin?
    const isAdmin = req.user?.isAdmin === true || req.user?.email === 'convoycubano@gmail.com';
    
    res.json({
      success: true,
      subscription: subscription,
      level: level,
      isAdmin: isAdmin,
      access: {
        free: true,
        basic: level === 'basic' || level === 'pro' || level === 'premium' || isAdmin,
        pro: level === 'pro' || level === 'premium' || isAdmin,
        premium: level === 'premium' || isAdmin
      }
    });
  }
);

export default router;