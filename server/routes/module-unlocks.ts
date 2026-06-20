/**
 * Module Unlocks — one-time platform module purchases (lifetime access)
 *
 * Mounted at /api/modules (see server/routes.ts). Endpoints:
 *  - GET  /catalog                       → public module catalog + prices
 *  - GET  /access                        → the current user's unlocked keys
 *  - POST /:moduleKey/unlock-checkout    → Stripe checkout (authenticated)
 *
 * Boostify keeps 100% of module unlocks (no artist split).
 */
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { isAdminEmail, PRODUCTION_URL } from '../../shared/constants';
import {
  MODULE_CATALOG,
  ALL_ACCESS_PASS,
  ALL_ACCESS_KEY,
  getModule,
  getUnlockPriceCents,
  isValidModuleKey,
} from '../../shared/module-catalog';
import { getUnlockedModuleKeys } from '../services/module-unlock-service';

const router = Router();

const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey
  ? new Stripe(stripeKey, {
      apiVersion: '2025-01-27.acacia' as any,
    })
  : null;

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.PRODUCTION_URL || PRODUCTION_URL;
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  }
  return 'http://localhost:5000';
}

function resolvePgUserId(user: any): number | null {
  if (!user || user.id == null) return null;
  const n = Number(user.id);
  return Number.isInteger(n) ? n : null;
}

/**
 * GET /api/modules/catalog
 * Public — the unlockable modules + the all-access pass.
 */
router.get('/catalog', (_req: Request, res: Response) => {
  res.json({ modules: MODULE_CATALOG, allAccess: ALL_ACCESS_PASS });
});

/**
 * GET /api/modules/access
 * Returns the current user's unlocked module keys (empty for anonymous).
 * `isAdmin` short-circuits the client gate to full access.
 */
router.get('/access', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const pgUserId = resolvePgUserId(user);
    const isAdmin = !!(user?.email && isAdminEmail(user.email));

    let unlockedKeys: string[] = [];
    if (pgUserId) {
      unlockedKeys = await getUnlockedModuleKeys(pgUserId);
    }

    res.json({
      unlockedKeys,
      allAccess: unlockedKeys.includes(ALL_ACCESS_KEY),
      isAdmin,
    });
  } catch (err: any) {
    console.error('❌ [module-access] error:', err);
    res.status(500).json({ error: 'Failed to resolve module access', details: err?.message });
  }
});

/**
 * POST /api/modules/:moduleKey/unlock-checkout
 * Authenticated — creates a Stripe checkout for a one-time module unlock.
 * Body: { returnPath?: string }
 */
router.post('/:moduleKey/unlock-checkout', async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const user = (req as any).user;
    if (!user || !user.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const moduleKey = req.params.moduleKey;
    if (!isValidModuleKey(moduleKey)) {
      return res.status(400).json({ error: 'Unknown module' });
    }

    const pgUserId = resolvePgUserId(user);
    if (!pgUserId) {
      return res.status(400).json({ error: 'Could not resolve your account' });
    }

    // Already unlocked (directly or via all-access)? Don't charge again.
    const owned = await getUnlockedModuleKeys(pgUserId);
    if (owned.includes(ALL_ACCESS_KEY) || owned.includes(moduleKey)) {
      return res.status(409).json({ error: 'You already own this module', alreadyUnlocked: true });
    }

    const priceCents = getUnlockPriceCents(moduleKey);
    if (!priceCents) {
      return res.status(400).json({ error: 'Module is not purchasable' });
    }

    const mod = getModule(moduleKey);
    const name = moduleKey === ALL_ACCESS_KEY ? ALL_ACCESS_PASS.name : mod?.name || moduleKey;
    const description =
      moduleKey === ALL_ACCESS_KEY ? ALL_ACCESS_PASS.description : mod?.description || 'Lifetime module access';

    const returnPath =
      typeof req.body?.returnPath === 'string' && req.body.returnPath.startsWith('/')
        ? req.body.returnPath
        : mod?.route || '/pricing';
    const baseUrl = getBaseUrl();
    const sep = returnPath.includes('?') ? '&' : '?';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Unlock: ${name}`,
              description: `${description} · Lifetime access`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}${returnPath}${sep}unlocked=${encodeURIComponent(moduleKey)}`,
      cancel_url: `${baseUrl}${returnPath}${sep}unlock=cancelled`,
      metadata: {
        type: 'module_unlock',
        moduleKey,
        userId: String(pgUserId),
        userEmail: user.email,
      },
    });

    res.json({ success: true, url: session.url });
  } catch (err: any) {
    console.error('❌ [module-unlock-checkout] error:', err);
    res.status(500).json({ error: 'Failed to create checkout', details: err?.message });
  }
});

export default router;
