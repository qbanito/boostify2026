import { Request, Response, NextFunction } from 'express';
import { AuthUser } from './auth';
import { isAdminEmail } from '../../shared/constants';
import { db } from '../db';
import { userRoles } from '../db/schema';
import { eq } from 'drizzle-orm';

// Soporta AMBAS nomenclaturas para compatibilidad:
// - Nueva: free, creator, professional, enterprise  
// - Legacy: free, basic, pro, premium
type SubscriptionPlan = 'free' | 'artist' | 'basic' | 'pro' | 'premium' | 'creator' | 'professional' | 'enterprise';

// Mapeo de nomenclatura para normalizar planes
const PLAN_MAPPING: Record<string, string> = {
  'basic': 'creator',
  'pro': 'professional',
  'premium': 'enterprise',
  'free': 'free',
  'artist': 'artist',
  'creator': 'creator',
  'professional': 'professional',
  'enterprise': 'enterprise'
};

/**
 * Helper to check if user has tester role (full platform access)
 */
async function isUserTester(userId: number): Promise<boolean> {
  try {
    const roleCheck = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);
    
    return roleCheck.length > 0 && roleCheck[0].role === 'tester';
  } catch (error) {
    console.error('[isUserTester] Error checking tester role:', error);
    return false;
  }
}

/**
 * Middleware to check if a user has a specific subscription plan or higher
 * Soporta ambas nomenclaturas (legacy y nueva)
 * Also grants full access to users with 'tester' role
 * 
 * @param requiredPlan The minimum subscription plan required
 * @returns Middleware function that checks the user's subscription
 */
export function requireSubscription(requiredPlan: SubscriptionPlan = 'free') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If no authentication, deny access
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      // Admin users always have access (by role or by email)
      if (req.user.isAdmin === true || isAdminEmail(req.user.email)) {
        return next();
      }

      // Check if user has tester role (full platform access)
      const user = req.user as AuthUser;
      if (user.id) {
        const isTester = await isUserTester(user.id);
        if (isTester) {
          console.log(`🧪 [Subscription] Tester access granted for user ${user.id}`);
          return next();
        }
      }

      // Get user subscription information
      const subscription = user.subscription;

      // If no subscription info, assign free plan
      if (!subscription) {
        if (requiredPlan === 'free') {
          return next();
        } else {
          return res.status(403).json({
            success: false,
            message: 'Subscription required',
            requiredPlan: requiredPlan,
            currentPlan: 'free'
          });
        }
      }

      // Check if subscription is active
      if (!subscription.active) {
        if (requiredPlan === 'free') {
          return next();
        } else {
          return res.status(403).json({
            success: false,
            message: 'Active subscription required',
            requiredPlan: requiredPlan,
            currentPlan: 'free'
          });
        }
      }

      // Map subscription plans to numeric values (usando nomenclatura normalizada)
      const planValues: Record<string, number> = {
        'free': 0,
        'artist': 1,
        'creator': 2,
        'basic': 2,      // Legacy alias
        'professional': 3,
        'pro': 3,        // Legacy alias
        'enterprise': 4,
        'premium': 4     // Legacy alias
      };

      // Normalizar planes
      const normalizedUserPlan = PLAN_MAPPING[subscription.plan] || subscription.plan;
      const normalizedRequiredPlan = PLAN_MAPPING[requiredPlan] || requiredPlan;
      
      const userPlanValue = planValues[normalizedUserPlan] || 0;
      const requiredPlanValue = planValues[normalizedRequiredPlan] || 0;

      // Check if user's plan meets or exceeds the required plan
      if (userPlanValue >= requiredPlanValue) {
        return next();
      } else {
        return res.status(403).json({
          success: false,
          message: 'Higher subscription plan required',
          requiredPlan: requiredPlan,
          currentPlan: subscription.plan
        });
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Server error during subscription check',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

// Export handlers for premium features (shortcuts)
export const requirePremium = requireSubscription('premium');
export const requireEnterprise = requireSubscription('enterprise');
export const requireProfessional = requireSubscription('professional');
export const requireCreator = requireSubscription('creator');

// Export a handler for pro features (shorthand for requireSubscription('pro'))
export const requirePro = requireSubscription('pro');

// Export a handler for basic features (shorthand for requireSubscription('basic'))
export const requireBasic = requireSubscription('basic');
