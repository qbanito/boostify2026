/**
 * Fan Monetization — pay-what-you-want catalog unlock
 *
 * Model:
 *  - 30s preview free for every locked song.
 *  - 1 free single per artist (songs.isSingle) plays in full.
 *  - Fan pays $5+ (pay-what-you-want) to unlock the artist's ENTIRE catalog.
 *  - Fan can alternatively subscribe for $20/month (full catalog while active).
 *  - Admins and the artist owner get unlimited access (no paywall).
 *  - Earnings credited to the artist's internal wallet (85% artist / 15% Boostify).
 *
 * Mounted at /api/artist (see server/routes.ts). Endpoints:
 *  - GET  /:artistId/access            → access state for the current viewer
 *  - POST /:artistId/unlock-checkout   → Stripe PWYW checkout (authenticated)
 *  - POST /:artistId/subscription-checkout → Stripe monthly checkout ($20/mo)
 */
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import { artistAccessUnlocks, explicitSubscriptions, songs, users } from '../../db/schema';
import { isAdminEmail, PRODUCTION_URL } from '../../shared/constants';
import { authenticate } from '../middleware/auth';

const router = Router();

const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey
  ? new Stripe(stripeKey, {
      apiVersion: '2025-01-27.acacia' as any,
    })
  : null;

export const PREVIEW_SECONDS = 30;
export const MIN_UNLOCK_CENTS = 100; // $1.00 minimum catalog price
export const MONTHLY_CATALOG_SUB_CENTS = 2000; // $20.00 / month
const DEFAULT_CATALOG_SETTINGS = { enabled: true, priceCents: 500 };
const MIN_CATALOG_PRICE_CENTS = 100;
const MAX_CATALOG_PRICE_CENTS = 500000;

function readCatalogSettings(masterJson: unknown) {
  const saved = (masterJson as any)?.fanMonetization;
  const priceCents = Number(saved?.priceCents);
  return {
    enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : DEFAULT_CATALOG_SETTINGS.enabled,
    priceCents: Number.isInteger(priceCents) && priceCents >= MIN_CATALOG_PRICE_CENTS && priceCents <= MAX_CATALOG_PRICE_CENTS
      ? priceCents
      : DEFAULT_CATALOG_SETTINGS.priceCents,
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) return null;
  return email;
}

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.PRODUCTION_URL || PRODUCTION_URL;
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  }
  return 'http://localhost:5000';
}

/** Resolve the viewer's integer PG id (Clerk string ids → null). */
function resolvePgUserId(user: any): number | null {
  if (!user || user.id == null) return null;
  const n = Number(user.id);
  return Number.isInteger(n) ? n : null;
}

/** Admin or the artist's owner (direct owner or creator via generatedBy). */
async function isOwnerOrAdmin(pgUserId: number | null, artistId: number, email?: string | null): Promise<boolean> {
  if (email && isAdminEmail(email)) return true;
  if (pgUserId && pgUserId === artistId) return true;
  if (!pgUserId) return false;
  const [artist] = await db
    .select({ generatedBy: users.generatedBy })
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);
  return artist?.generatedBy != null && Number(artist.generatedBy) === pgUserId;
}

/** Does this fan have an active unlock for the artist (by user id or email)? */
export async function hasActiveUnlock(
  artistId: number,
  fanUserId: number | null,
  fanEmail?: string | null,
): Promise<boolean> {
  const ors: any[] = [];
  if (fanUserId) ors.push(eq(artistAccessUnlocks.fanUserId, fanUserId));
  if (fanEmail) ors.push(eq(artistAccessUnlocks.fanEmail, fanEmail));
  if (ors.length === 0) return false;
  const [row] = await db
    .select({ id: artistAccessUnlocks.id })
    .from(artistAccessUnlocks)
    .where(
      and(
        eq(artistAccessUnlocks.artistId, artistId),
        eq(artistAccessUnlocks.status, 'active'),
        ors.length === 1 ? ors[0] : or(...ors),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Does this fan have an active monthly catalog subscription for this artist?
 * We store this in explicit_subscriptions to avoid introducing a new table.
 */
export async function hasActiveCatalogSubscription(
  artistId: number,
  fanUserId: number | null,
): Promise<boolean> {
  if (!fanUserId) return false;
  const now = new Date();
  const [row] = await db
    .select({ id: explicitSubscriptions.id })
    .from(explicitSubscriptions)
    .where(
      and(
        eq(explicitSubscriptions.artistId, artistId),
        eq(explicitSubscriptions.subscriberId, fanUserId),
        eq(explicitSubscriptions.plan, 'monthly'),
        eq(explicitSubscriptions.status, 'active'),
        or(isNull(explicitSubscriptions.currentPeriodEnd), gt(explicitSubscriptions.currentPeriodEnd, now)),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Smart monthly album messaging:
 * - AI artists: monthly album is guaranteed.
 * - Human artists: monthly album is provided when available.
 */
async function buildCatalogBenefits(artistId: number) {
  const [artist] = await db
    .select({ isAIGenerated: users.isAIGenerated })
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);

  const isAIArtist = !!artist?.isAIGenerated;
  if (isAIArtist) {
    return {
      monthlyAlbumMode: 'guaranteed' as const,
      monthlyAlbumMessage: 'AI artist: includes 1 new album every month.',
      bonusPerksMessage: 'Extra fan benefits are included whenever available.',
    };
  }

  // Lightweight signal for human artists: do they release frequently enough?
  const recentWindow = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const recentTracks = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.userId, artistId), gt(songs.createdAt, recentWindow)));
  const hasStrongMonthlyCadence = recentTracks.length >= 6;

  return {
    monthlyAlbumMode: hasStrongMonthlyCadence ? ('likely' as const) : ('when_available' as const),
    monthlyAlbumMessage: hasStrongMonthlyCadence
      ? 'Human artist: monthly album is likely based on current release cadence.'
      : 'Human artist: monthly album is provided when available.',
    bonusPerksMessage: 'Extra fan benefits are included whenever available.',
  };
}

/**
 * GET /api/artist/:artistId/access
 * Public — returns the access state for the current viewer.
 * Anonymous visitors get { hasAccess:false, previewSeconds:30 }.
 */
router.get('/:artistId/access', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const user = (req as any).user;
    const pgUserId = resolvePgUserId(user);
    const email = normalizeEmail(user?.email || req.query?.fanEmail) || null;

    let unlimited = false;
    if (user) {
      unlimited = await isOwnerOrAdmin(pgUserId, artistId, email);
    }

    let lifetimeUnlocked = false;
    let subscriptionActive = false;
    if (!unlimited && (pgUserId || email)) {
      lifetimeUnlocked = await hasActiveUnlock(artistId, pgUserId, email);
      if (!lifetimeUnlocked) {
        subscriptionActive = await hasActiveCatalogSubscription(artistId, pgUserId);
      }
    }

    const [artistRow] = await db.select({ masterJson: users.masterJson }).from(users).where(eq(users.id, artistId)).limit(1);
    const catalogSettings = readCatalogSettings(artistRow?.masterJson);
    const benefits = await buildCatalogBenefits(artistId);
    const unlocked = lifetimeUnlocked || subscriptionActive;
    const accessType = unlimited ? 'owner' : lifetimeUnlocked ? 'lifetime' : subscriptionActive ? 'subscription' : 'none';

    return res.json({
      unlimited,
      lifetimeUnlocked,
      subscriptionActive,
      unlocked,
      hasAccess: !catalogSettings.enabled || unlimited || unlocked,
      monetizationEnabled: catalogSettings.enabled,
      catalogPriceCents: catalogSettings.priceCents,
      accessType,
      previewSeconds: PREVIEW_SECONDS,
      minUnlockCents: MIN_UNLOCK_CENTS,
      monthlyCatalogSubCents: MONTHLY_CATALOG_SUB_CENTS,
      benefits,
    });
  } catch (err: any) {
    console.error('❌ [fan-access] error:', err);
    return res.status(500).json({ error: 'Failed to resolve access', details: err?.message });
  }
});

/**
 * PUT /api/artist/:artistId/monetization-settings
 * Artist-owner-only switch and fixed one-time price for full-catalog access.
 */
router.put('/:artistId/monetization-settings', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (!Number.isInteger(artistId) || artistId <= 0) return res.status(400).json({ error: 'Invalid artist id' });
    const enabled = req.body?.enabled;
    const priceCents = Math.round(Number(req.body?.priceCents));
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });
    if (!Number.isInteger(priceCents) || priceCents < MIN_CATALOG_PRICE_CENTS || priceCents > MAX_CATALOG_PRICE_CENTS) {
      return res.status(400).json({ error: `Price must be between $${(MIN_CATALOG_PRICE_CENTS / 100).toFixed(2)} and $${(MAX_CATALOG_PRICE_CENTS / 100).toFixed(2)}` });
    }

    const actor = (req as any).user;
    if (!actor) return res.status(401).json({ error: 'Authentication required' });
    const numericActorId = Number(actor.id);
    const actorConditions: any[] = [];
    const actorUid = String(actor.uid || actor.clerkId || '');
    if (actorUid) actorConditions.push(eq(users.clerkId, actorUid), eq(users.username, actorUid));
    if (Number.isInteger(numericActorId) && numericActorId > 0) actorConditions.push(eq(users.id, numericActorId));
    const [target, actorRow] = await Promise.all([
      db.select({ id: users.id, generatedBy: users.generatedBy, masterJson: users.masterJson }).from(users).where(eq(users.id, artistId)).limit(1).then(rows => rows[0]),
      actorConditions.length ? db.select({ id: users.id }).from(users).where(or(...actorConditions)).limit(1).then(rows => rows[0]) : Promise.resolve(undefined),
    ]);
    if (!target) return res.status(404).json({ error: 'Artist not found' });
    const admin = actor.email && isAdminEmail(actor.email);
    if (!admin && (!actorRow || (actorRow.id !== target.id && actorRow.id !== target.generatedBy))) {
      return res.status(403).json({ error: 'Only this artist or its creator can manage monetization' });
    }

    const currentMasterJson = target.masterJson && typeof target.masterJson === 'object' ? target.masterJson as Record<string, any> : {};
    const updatedMasterJson = {
      ...currentMasterJson,
      fanMonetization: { enabled, priceCents },
    };
    await db.update(users).set({ masterJson: updatedMasterJson as any, updatedAt: new Date() }).where(eq(users.id, artistId));
    return res.json({ success: true, settings: { enabled, priceCents } });
  } catch (err: any) {
    console.error('[fan-monetization] settings update failed:', err);
    return res.status(500).json({ error: 'Failed to save monetization settings' });
  }
});

/**
 * POST /api/artist/:artistId/unlock-checkout
 * Creates a Stripe pay-what-you-want checkout session (logged-in OR guest).
 * Body: { returnPath?: string, fanEmail?: string }; price comes from artist settings.
 */
router.post('/:artistId/unlock-checkout', async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const user = (req as any).user;
    const fallbackEmail = normalizeEmail(req.body?.fanEmail);
    const fanEmail = normalizeEmail(user?.email) || fallbackEmail;
    if (!fanEmail) return res.status(400).json({ error: 'Valid fanEmail is required' });

    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const [artist] = await db
      .select({ artistName: users.artistName, realName: users.realName, username: users.username, masterJson: users.masterJson })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    const catalogSettings = readCatalogSettings(artist.masterJson);
    if (!catalogSettings.enabled) return res.status(409).json({ error: 'This artist is currently sharing the full catalog for free' });

    const pgUserId = resolvePgUserId(user);

    // Already has access? Don't charge again.
    if (await hasActiveUnlock(artistId, pgUserId, fanEmail)) {
      return res.status(409).json({ error: 'You already have access to this catalog', alreadyUnlocked: true });
    }

    const artistName = (artist.artistName || artist.realName || artist.username || 'this artist').toString();
    const returnPath = typeof req.body?.returnPath === 'string' && req.body.returnPath.startsWith('/')
      ? req.body.returnPath
      : '/';
    const baseUrl = getBaseUrl();
    const sep = returnPath.includes('?') ? '&' : '?';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: fanEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Unlock ${artistName} — full catalog`,
              description: 'Lifetime access to this artist\'s complete catalog. 85% goes directly to the artist.',
            },
            unit_amount: catalogSettings.priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}${returnPath}${sep}unlock=success`,
      cancel_url: `${baseUrl}${returnPath}${sep}unlock=cancelled`,
      metadata: {
        type: 'artist_unlock',
        artistId: String(artistId),
        fanUserId: pgUserId ? String(pgUserId) : '',
        fanEmail,
        amountCents: String(catalogSettings.priceCents),
      },
    });

    return res.json({ success: true, url: session.url });
  } catch (err: any) {
    console.error('❌ [unlock-checkout] error:', err);
    return res.status(500).json({ error: 'Failed to create checkout', details: err?.message });
  }
});

/**
 * POST /api/artist/:artistId/subscription-checkout
 * Creates a $20/mo Stripe subscription checkout for this artist's catalog.
 * Requires authenticated user so access can be managed by user id.
 */
router.post('/:artistId/subscription-checkout', async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const user = (req as any).user;
    const pgUserId = resolvePgUserId(user);
    if (!pgUserId) {
      return res.status(401).json({ error: 'Login required for monthly subscription' });
    }

    const fanEmail = normalizeEmail(user?.email);
    if (!fanEmail) return res.status(400).json({ error: 'Valid account email is required' });

    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    // Owner/admin already has unlimited access.
    if (await isOwnerOrAdmin(pgUserId, artistId, fanEmail)) {
      return res.status(409).json({ error: 'You already have full access', alreadyUnlocked: true });
    }

    // If they already bought lifetime unlock, don't subscribe unnecessarily.
    if (await hasActiveUnlock(artistId, pgUserId, fanEmail)) {
      return res.status(409).json({ error: 'You already have lifetime access for this artist', alreadyUnlocked: true });
    }

    if (await hasActiveCatalogSubscription(artistId, pgUserId)) {
      return res.status(409).json({ error: 'You already have an active monthly subscription', alreadySubscribed: true });
    }

    const [artist] = await db
      .select({ artistName: users.artistName, realName: users.realName, username: users.username, masterJson: users.masterJson })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    const catalogSettings = readCatalogSettings(artist.masterJson);
    if (!catalogSettings.enabled) return res.status(409).json({ error: 'This artist is currently sharing the full catalog for free' });

    const artistName = (artist.artistName || artist.realName || artist.username || 'this artist').toString();

    const [fan] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, pgUserId))
      .limit(1);

    let customerId = fan?.stripeCustomerId || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: fanEmail,
        metadata: { pgUserId: String(pgUserId) },
      });
      customerId = customer.id;
      await db.update(users).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(users.id, pgUserId));
    }

    const returnPath = typeof req.body?.returnPath === 'string' && req.body.returnPath.startsWith('/')
      ? req.body.returnPath
      : '/';
    const baseUrl = getBaseUrl();
    const sep = returnPath.includes('?') ? '&' : '?';

    const metadata = {
      type: 'artist_catalog_subscription',
      artistId: String(artistId),
      fanUserId: String(pgUserId),
      fanEmail,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: MONTHLY_CATALOG_SUB_CENTS,
            recurring: { interval: 'month' },
            product_data: {
              name: `${artistName} — monthly fan membership`,
              description: 'Access all songs in full + monthly album drop when available + extra fan benefits when available.',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}${returnPath}${sep}unlock=success&plan=monthly`,
      cancel_url: `${baseUrl}${returnPath}${sep}unlock=cancelled&plan=monthly`,
      metadata,
      subscription_data: { metadata },
    });

    return res.json({ success: true, url: session.url });
  } catch (err: any) {
    console.error('❌ [subscription-checkout] error:', err);
    return res.status(500).json({ error: 'Failed to create monthly subscription checkout', details: err?.message });
  }
});

export default router;
