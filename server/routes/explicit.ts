/**
 * Boostify Exclusive Content API routes
 * Content CRUD, subscriptions, purchases, tips, AI generation, chat
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import Stripe from 'stripe';
import { db } from '../db';
import { storage as firebaseStorage } from '../firebase';
import {
  explicitSettings, explicitContent, explicitSubscriptions,
  explicitPurchases, explicitChatMessages, explicitAiGenerations,
  explicitTips, explicitSubscriptionPayments, users,
} from '../db/schema';
import { eq, and, desc, asc, or, sql } from 'drizzle-orm';
import {
  generateExplicitImage, generateExplicitVideoFromImage,
  generateExplicitVideoFromText, getModelCost, EXPLICIT_FAL_MODELS, EXPLICIT_IMAGE_MODELS,
} from '../services/explicit-ai-service';
import { rateLimitAiGen } from '../middleware/rate-limit';

const router = Router();

// Stripe payments and creator payouts
const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2026-09-30.endive' as any }) : null;
const APP_BASE_URL = process.env.PRODUCTION_URL || process.env.APP_BASE_URL || process.env.PUBLIC_URL || 'https://boostifymusic.com';
const configuredPlatformFeePercent = Number(process.env.EXCLUSIVE_CONTENT_PLATFORM_FEE_PERCENT || 0);
const EXPLICIT_PLATFORM_FEE_PERCENT = Number.isFinite(configuredPlatformFeePercent)
  ? Math.min(30, Math.max(0, configuredPlatformFeePercent))
  : 0;

async function retrieveConnectAccount(accountId: string): Promise<any> {
  if (!stripe) throw new Error('Stripe is not configured.');
  const response = await stripe.rawRequest('GET', `/v2/core/accounts/${encodeURIComponent(accountId)}?include[]=configuration.recipient`);
  return response.data as any;
}

function hasTransferCapability(account: any): boolean {
  return account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === 'active';
}

async function ensureArtistPayoutAccount(artistId: number): Promise<{ accountId: string; account: any }> {
  if (!stripe) throw new Error('Stripe is not configured.');
  const [settings] = await db.select().from(explicitSettings)
    .where(eq(explicitSettings.artistId, artistId)).limit(1);
  const [artist] = await db.select({ name: users.artistName, first: users.firstName, email: users.email, country: users.country })
    .from(users).where(eq(users.id, artistId)).limit(1);
  if (!artist) throw new Error('Artist account not found.');

  let accountId = settings?.stripeConnectAccountId || null;
  let account: any;
  if (!accountId) {
    const countryName = String(artist.country || 'US').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const countryCode = /^[A-Z]{2}$/.test(countryName)
      ? countryName
      : ({
          'UNITED STATES': 'US', 'UNITED STATES OF AMERICA': 'US', CANADA: 'CA', 'UNITED KINGDOM': 'GB',
          MEXICO: 'MX', COLOMBIA: 'CO', BRAZIL: 'BR', BRASIL: 'BR', SPAIN: 'ES', ESPANA: 'ES',
          ARGENTINA: 'AR', CHILE: 'CL', FRANCE: 'FR', GERMANY: 'DE', AUSTRALIA: 'AU', JAPAN: 'JP',
          'PUERTO RICO': 'PR', ITALY: 'IT', ITALIA: 'IT', NETHERLANDS: 'NL', PORTUGAL: 'PT',
        } as Record<string, string>)[countryName];
    if (!countryCode) throw new Error('Add a supported two-letter country code to the artist profile before connecting Stripe.');
    const created = await stripe.rawRequest('POST', '/v2/core/accounts', {
      contact_email: artist.email || undefined,
      display_name: artist.name || artist.first || 'Boostify creator',
      identity: { country: countryCode, entity_type: 'individual' },
      dashboard: 'express',
      defaults: { responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      include: ['configuration.recipient', 'identity', 'requirements', 'defaults'],
    });
    account = created.data as any;
    accountId = account?.id;
    if (!accountId) throw new Error('Stripe did not return a connected account.');
    await db.insert(explicitSettings).values({
      artistId,
      stripeConnectAccountId: accountId,
      stripeConnectReady: false,
    }).onConflictDoUpdate({
      target: explicitSettings.artistId,
      set: { stripeConnectAccountId: accountId, stripeConnectReady: false, updatedAt: new Date() },
    });
  } else {
    account = await retrieveConnectAccount(accountId);
  }
  return { accountId, account };
}

const chatRateBuckets = new Map<number, { count: number; resetAt: number }>();
const CHAT_RATE_LIMIT = 30;
const CHAT_RATE_WINDOW_MS = 60_000;
function chatRateLimited(userId: number): boolean {
  const now = Date.now();
  const bucket = chatRateBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    chatRateBuckets.set(userId, { count: 1, resetAt: now + CHAT_RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > CHAT_RATE_LIMIT;
}

// Multer for file uploads (memory, 100MB max, image/video/audio only)
const explicitUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image|video|audio)\//i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

// POST /connect/onboarding-link - create or resume an artist's Stripe payout setup.
router.post('/connect/onboarding-link', async (req: Request, res: Response) => {
  try {
    const artistId = await getUserPgId(req);
    if (!artistId) return res.status(401).json({ error: 'Not authenticated' });
    const { accountId, account } = await ensureArtistPayoutAccount(artistId);
    const ready = hasTransferCapability(account);
    if (ready) {
      await db.update(explicitSettings).set({ stripeConnectReady: true, updatedAt: new Date() })
        .where(eq(explicitSettings.artistId, artistId));
      return res.json({ ready: true });
    }

    const [artist] = await db.select({ slug: users.slug }).from(users).where(eq(users.id, artistId)).limit(1);
    const returnUrl = `${APP_BASE_URL}/artist/${encodeURIComponent(artist?.slug || String(artistId))}?exclusive_connect=complete`;
    const link = await stripe!.rawRequest('POST', '/v2/core/account_links', {
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          return_url: returnUrl,
          refresh_url: `${returnUrl}&refresh=1`,
          collection_options: { fields: 'eventually_due' },
        },
      },
    });
    const url = (link.data as any)?.url;
    if (!url) return res.status(502).json({ error: 'Stripe did not return an onboarding link.' });
    res.json({ ready: false, url });
  } catch (error: any) {
    console.error('[explicit] Stripe Connect onboarding failed:', error);
    res.status(502).json({ error: error?.message || 'Could not create Stripe onboarding link.' });
  }
});

// GET /connect/status - check payout capability in Stripe Accounts v2.
router.get('/connect/status', async (req: Request, res: Response) => {
  try {
    const artistId = await getUserPgId(req);
    if (!artistId) return res.status(401).json({ error: 'Not authenticated' });
    const [settings] = await db.select().from(explicitSettings)
      .where(eq(explicitSettings.artistId, artistId)).limit(1);
    if (!settings?.stripeConnectAccountId || !stripe) {
      return res.json({ ready: false, connected: !!settings?.stripeConnectAccountId });
    }
    const account = await retrieveConnectAccount(settings.stripeConnectAccountId);
    const ready = hasTransferCapability(account);
    await db.update(explicitSettings).set({ stripeConnectReady: ready, updatedAt: new Date() })
      .where(eq(explicitSettings.artistId, artistId));
    res.json({ ready, connected: true });
  } catch (error: any) {
    res.status(502).json({ error: error?.message || 'Could not read Stripe payout status.' });
  }
});

// POST /checkout/session - payment amounts and recipients are selected server-side.
router.post('/checkout/session', async (req: Request, res: Response) => {
  try {
    const buyerId = await getUserPgId(req);
    if (!buyerId) return res.status(401).json({ error: 'Not authenticated' });
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured.' });

    const { artistId: rawArtistId, kind, plan, contentId, amount } = req.body || {};
    const artistId = await resolveArtistId(rawArtistId);
    if (!artistId) return res.status(404).json({ error: 'Artist not found.' });
    if (artistId === buyerId) return res.status(400).json({ error: 'You cannot purchase your own creator content.' });

    const [settings] = await db.select().from(explicitSettings)
      .where(eq(explicitSettings.artistId, artistId)).limit(1);
    if (!settings?.enabled) return res.status(409).json({ error: 'This creator is not accepting Exclusive Content payments right now.' });

    const { accountId, account } = await ensureArtistPayoutAccount(artistId);
    if (!hasTransferCapability(account)) {
      await db.update(explicitSettings).set({ stripeConnectReady: false, updatedAt: new Date() })
        .where(eq(explicitSettings.artistId, artistId));
      return res.status(409).json({ error: 'This creator has not completed Stripe payout onboarding yet.' });
    }
    await db.update(explicitSettings).set({ stripeConnectReady: true, updatedAt: new Date() })
      .where(eq(explicitSettings.artistId, artistId));

    const [artist] = await db.select({ name: users.artistName, slug: users.slug })
      .from(users).where(eq(users.id, artistId)).limit(1);
    let unitAmount: number;
    let productName: string;
    let mode: 'payment' | 'subscription';
    const metadata: Record<string, string> = {
      type: 'exclusive_content',
      kind: String(kind || ''),
      buyerId: String(buyerId),
      artistId: String(artistId),
    };
    let linePrice: any;
    if (kind === 'subscription') {
      if (plan !== 'monthly' && plan !== 'yearly') return res.status(400).json({ error: 'Select a valid subscription plan.' });
      const configuredPrice = plan === 'monthly' ? settings?.monthlyPrice : settings?.yearlyPrice;
      unitAmount = Math.round(Number(configuredPrice) * 100);
      if (!Number.isInteger(unitAmount) || unitAmount < 500 || unitAmount > 1000000) {
        return res.status(400).json({ error: 'Creator subscription price must be between $5 and $10,000.' });
      }
      productName = `${artist?.name || 'Creator'} - Exclusive ${plan} membership`;
      mode = 'subscription';
      metadata.plan = plan;
      linePrice = {
        currency: 'usd',
        product_data: { name: productName },
        unit_amount: unitAmount,
        recurring: { interval: plan === 'monthly' ? 'month' : 'year' },
      };
    } else if (kind === 'purchase') {
      const parsedContentId = Number(contentId);
      if (!Number.isInteger(parsedContentId) || parsedContentId <= 0) return res.status(400).json({ error: 'A valid content item is required.' });
      const [content] = await db.select().from(explicitContent)
        .where(and(eq(explicitContent.id, parsedContentId), eq(explicitContent.artistId, artistId), eq(explicitContent.isActive, true))).limit(1);
      if (!content) return res.status(404).json({ error: 'Content item not found.' });
      if (!content.isPaywalled) return res.status(400).json({ error: 'This content item is already available for free.' });
      const configuredPrice = content.singlePurchasePrice || settings?.singleContentPrice;
      unitAmount = Math.round(Number(configuredPrice) * 100);
      if (!Number.isInteger(unitAmount) || unitAmount < 50 || unitAmount > 1000000) return res.status(400).json({ error: 'This content item has an invalid purchase price.' });
      productName = `${artist?.name || 'Creator'} - ${content.title}`;
      mode = 'payment';
      metadata.contentId = String(content.id);
      linePrice = { currency: 'usd', product_data: { name: productName }, unit_amount: unitAmount };
    } else if (kind === 'tip') {
      unitAmount = Math.round(Number(amount) * 100);
      if (!Number.isInteger(unitAmount) || unitAmount < 100 || unitAmount > 1000000) return res.status(400).json({ error: 'Tip amount must be between $1 and $10,000.' });
      productName = `Tip for ${artist?.name || 'creator'}`;
      mode = 'payment';
      metadata.message = String(req.body.message || '').slice(0, 500);
      linePrice = { currency: 'usd', product_data: { name: productName }, unit_amount: unitAmount };
    } else {
      return res.status(400).json({ error: 'Unsupported checkout type.' });
    }

    const feeAmount = Math.round(unitAmount * EXPLICIT_PLATFORM_FEE_PERCENT / 100);
    const returnPath = `/artist/${encodeURIComponent(artist?.slug || String(artistId))}`;
    const integrationSuffix = Array.from({ length: 8 }, () => 'abcdefghijklmnopqrstuvwxyz'[crypto.randomInt(26)]).join('');
    const sessionParams: any = {
      mode,
      line_items: [{ price_data: linePrice, quantity: 1 }],
      success_url: `${APP_BASE_URL}${returnPath}?exclusive_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_BASE_URL}${returnPath}?exclusive_checkout=cancelled`,
      client_reference_id: String(buyerId),
      metadata,
      integration_identifier: `boostify-exclusive-${integrationSuffix}`,
    };
    if (mode === 'payment') {
      sessionParams.payment_intent_data = {
        transfer_data: { destination: accountId },
        application_fee_amount: feeAmount,
        metadata,
      };
    } else {
      sessionParams.subscription_data = {
        transfer_data: { destination: accountId },
        application_fee_percent: EXPLICIT_PLATFORM_FEE_PERCENT,
        metadata,
      };
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) return res.status(502).json({ error: 'Stripe did not return a checkout URL.' });
    res.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('[explicit] checkout session creation failed:', error);
    res.status(502).json({ error: error?.message || 'Could not start checkout.' });
  }
});

// ─── Auth helper — resolves Clerk/Firebase string ID to PG integer ───
async function getUserPgId(req: Request): Promise<number | null> {
  const clerkId = (req as any).auth?.userId;
  if (clerkId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (u) return u.id;
  }
  const rawId = (req as any).user?.id;
  if (!rawId) return null;
  const numId = Number(rawId);
  if (!isNaN(numId) && numId > 0) return numId;
  const [u] = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.clerkId, String(rawId)), eq(users.firestoreId, String(rawId))))
    .limit(1);
  return u?.id || null;
}

async function resolveArtistId(raw: string | number): Promise<number | null> {
  const numId = Number(raw);
  if (!isNaN(numId) && numId > 0) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, numId)).limit(1);
    if (u) return u.id;
  }
  const [u] = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.clerkId, String(raw)), eq(users.firestoreId, String(raw))))
    .limit(1);
  return u?.id || null;
}

async function resolvePrivateMediaUrl(value?: string | null): Promise<string | null> {
  if (!value) return null;
  if (!firebaseStorage) return value.startsWith('private://') ? null : value;
  const bucket = firebaseStorage.bucket();
  const bucketPrefix = `https://storage.googleapis.com/${bucket.name}/`;
  const objectPath = value.startsWith('private://')
    ? value.slice('private://'.length)
    : value.startsWith(bucketPrefix)
      ? decodeURIComponent(value.slice(bucketPrefix.length).split('?')[0])
      : null;
  if (!objectPath || !objectPath.startsWith('explicit-content/')) return value;
  const file = bucket.file(objectPath);
  if (!value.startsWith('private://')) {
    try { await file.makePrivate(); } catch (error: any) {
      console.warn('[explicit] could not make legacy media private:', error?.message || error);
    }
  }
  const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
  return signedUrl;
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════

// GET /settings/:artistId — Get explicit settings for an artist
router.get('/settings/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req.params.artistId);
    if (!artistId) return res.status(404).json({ error: 'Artist not found' });

    const [settings] = await db.select().from(explicitSettings)
      .where(eq(explicitSettings.artistId, artistId)).limit(1);

    if (!settings) return res.json({ enabled: false, artistId, stripeConnectReady: false });
    const { stripeConnectAccountId: _privateAccountId, ...publicSettings } = settings;
    res.json(publicSettings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /settings — Update explicit settings (owner only)
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { monthlyPrice, yearlyPrice, singleContentPrice, welcomeMessage,
      contentCategories, chatEnabled, aiGenerationEnabled, watermarkEnabled, enabled } = req.body;

    const isPriceValid = (value: unknown, minimum: number) => {
      const price = Number(value);
      return Number.isFinite(price) && price >= minimum && price <= 10000;
    };
    if (!isPriceValid(monthlyPrice, 5) || !isPriceValid(yearlyPrice, 5) || !isPriceValid(singleContentPrice, 0.5)) {
      return res.status(400).json({ error: 'Monthly/yearly prices must be $5–$10,000 and single-item prices $0.50–$10,000.' });
    }

    const [existing] = await db.select().from(explicitSettings)
      .where(eq(explicitSettings.artistId, userId)).limit(1);

    if (existing) {
      const [updated] = await db.update(explicitSettings)
        .set({
          enabled, monthlyPrice, yearlyPrice, singleContentPrice,
          welcomeMessage, contentCategories, chatEnabled, aiGenerationEnabled,
          watermarkEnabled, updatedAt: new Date(),
        })
        .where(eq(explicitSettings.artistId, userId))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(explicitSettings).values({
      artistId: userId, enabled, monthlyPrice, yearlyPrice, singleContentPrice,
      welcomeMessage, contentCategories, chatEnabled, aiGenerationEnabled, watermarkEnabled,
    }).returning();
    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// CONTENT CRUD
// ═══════════════════════════════════════════════════════════════════

// GET /content/:artistId — List content for an artist (blurred if not subscribed)
router.get('/content/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = await resolveArtistId(req.params.artistId);
    if (!artistId) return res.status(404).json({ error: 'Artist not found' });

    const userId = await getUserPgId(req);
    const isOwner = userId === artistId;

    // Check subscription
    let hasAccess = isOwner;
    if (!isOwner && userId) {
      const [sub] = await db.select().from(explicitSubscriptions)
        .where(and(
          eq(explicitSubscriptions.subscriberId, userId),
          eq(explicitSubscriptions.artistId, artistId),
          eq(explicitSubscriptions.status, 'active'),
        )).limit(1);
      if (sub) hasAccess = true;
    }

    const items = await db.select().from(explicitContent)
      .where(and(
        eq(explicitContent.artistId, artistId),
        eq(explicitContent.isActive, true),
      ))
      .orderBy(desc(explicitContent.createdAt));

    // Check individual purchases separately so bought posts unlock without
    // granting a subscription to every other item.
    let purchasedIds: number[] = [];
    if (!isOwner && userId && !hasAccess) {
      const purchases = await db.select({ contentId: explicitPurchases.contentId })
        .from(explicitPurchases)
        .where(and(
          eq(explicitPurchases.buyerId, userId),
          eq(explicitPurchases.artistId, artistId),
          eq(explicitPurchases.status, 'completed'),
        ));
      purchasedIds = purchases.map(p => p.contentId);
    }

    const result = await Promise.all(items.map(async item => {
      const purchased = isOwner || purchasedIds.includes(item.id);
      const locked = item.isPaywalled && !hasAccess && !purchased;
      if (locked) {
        const previewUrl = await resolvePrivateMediaUrl(item.blurredPreviewUrl);
        return {
          id: item.id,
          type: item.type,
          title: item.title,
          description: item.description,
          category: item.category,
          thumbnailUrl: previewUrl,
          blurredPreviewUrl: previewUrl,
          isPaywalled: true,
          singlePurchasePrice: item.singlePurchasePrice,
          viewCount: item.viewCount,
          likeCount: item.likeCount,
          createdAt: item.createdAt,
          locked: true,
          purchased: false,
        };
      }
      return {
        ...item,
        mediaUrl: await resolvePrivateMediaUrl(item.mediaUrl),
        thumbnailUrl: await resolvePrivateMediaUrl(item.thumbnailUrl),
        blurredPreviewUrl: await resolvePrivateMediaUrl(item.blurredPreviewUrl),
        locked: false,
        purchased,
      };
    }));

    res.json({ items: result, hasAccess });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/upload — Upload a media file to Firebase Storage (owner only)
// Returns a short-lived signed preview and a private storage path for publishing.
router.post('/content/upload', explicitUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided (field name must be "file")' });

    // Per-artist library quota (protects storage from abuse)
    const MAX_CONTENT_ITEMS = 500;
    const [{ count: itemCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(explicitContent)
      .where(eq(explicitContent.artistId, userId));
    if (Number(itemCount) >= MAX_CONTENT_ITEMS) {
      return res.status(429).json({ error: `Content library limit reached (${MAX_CONTENT_ITEMS} items). Delete old items first.` });
    }

    if (!firebaseStorage) {
      return res.status(503).json({ error: 'Firebase Storage not configured on server' });
    }

    const mime = file.mimetype || 'application/octet-stream';
    const kind: 'image' | 'video' | 'audio' | 'other' =
      mime.startsWith('image/') ? 'image' :
      mime.startsWith('video/') ? 'video' :
      mime.startsWith('audio/') ? 'audio' : 'other';

    const ext = (file.originalname.includes('.')
      ? file.originalname.split('.').pop()
      : mime.split('/')[1] || 'bin'
    )!.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';

    const safeBase = (file.originalname || 'file')
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w\-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'file';

    const objectPath = `explicit-content/${userId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase}.${ext}`;

    const bucket = firebaseStorage.bucket();
    const fbFile = bucket.file(objectPath);
    await fbFile.save(file.buffer, {
      contentType: mime,
      resumable: false,
      metadata: {
        cacheControl: 'private, max-age=900, no-transform',
        metadata: {
          uploadedBy: String(userId),
          originalName: String(file.originalname).slice(0, 200),
          kind,
        },
      },
    });
    const [signedUrl] = await fbFile.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
    const mediaPath = `private://${objectPath}`;

    return res.json({
      success: true,
      mediaUrl: signedUrl,
      mediaPath,
      thumbnailUrl: kind === 'image' ? signedUrl : undefined,
      kind,
      mime,
      size: file.size,
      path: objectPath,
    });
  } catch (error: any) {
    console.error('[explicit] upload error:', error);
    return res.status(500).json({ error: error?.message || 'Upload failed' });
  }
});

// POST /content — Upload new content (owner only)
router.post('/content', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { type, title, description, category, mediaUrl, mediaPath, thumbnailUrl,
      blurredPreviewUrl, isPaywalled, singlePurchasePrice } = req.body;

    if (!type || !title || !mediaUrl) {
      return res.status(400).json({ error: 'type, title, and mediaUrl are required' });
    }

    const privatePath = typeof mediaPath === 'string' && mediaPath.startsWith(`private://explicit-content/${userId}/`)
      ? mediaPath
      : mediaUrl;
    const privateThumbnailPath = privatePath.startsWith('private://') && (thumbnailUrl === mediaUrl || !thumbnailUrl)
      ? privatePath
      : thumbnailUrl;
    const [content] = await db.insert(explicitContent).values({
      artistId: userId, type, title, description, category,
      mediaUrl: privatePath, thumbnailUrl: privateThumbnailPath, blurredPreviewUrl,
      isPaywalled: isPaywalled ?? true, singlePurchasePrice,
    }).returning();

    res.json(content);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /content/:id — Delete content (owner only)
// Query: ?hard=true to permanently remove DB row + Firebase object (default = soft).
router.delete('/content/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const contentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(contentId) || contentId <= 0) {
      return res.status(400).json({ error: 'Invalid content id' });
    }

    const [item] = await db.select().from(explicitContent)
      .where(and(eq(explicitContent.id, contentId), eq(explicitContent.artistId, userId)))
      .limit(1);

    if (!item) return res.status(404).json({ error: 'Content not found or not yours' });

    const hard = String(req.query.hard || '').toLowerCase() === 'true';

    if (hard) {
      // Best-effort delete of Firebase object if it lives in our bucket
      try {
        if (firebaseStorage && item.mediaUrl) {
          const bucket = firebaseStorage.bucket();
          const prefix = `https://storage.googleapis.com/${bucket.name}/`;
          if (item.mediaUrl.startsWith('private://')) {
            await bucket.file(item.mediaUrl.slice('private://'.length)).delete({ ignoreNotFound: true });
          } else if (item.mediaUrl.startsWith(prefix)) {
            const objectPath = decodeURI(item.mediaUrl.slice(prefix.length).split('?')[0]);
            await bucket.file(objectPath).delete({ ignoreNotFound: true });
          }
        }
      } catch (storageErr: any) {
        console.warn('[explicit] storage delete warning:', storageErr?.message || storageErr);
      }
      await db.delete(explicitContent).where(eq(explicitContent.id, contentId));
      return res.json({ success: true, hardDeleted: true });
    }

    await db.update(explicitContent)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(explicitContent.id, contentId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('[explicit] delete error:', error);
    res.status(500).json({ error: error?.message || 'Delete failed' });
  }
});

// PATCH /content/:id — Edit content metadata (owner only)
router.patch('/content/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const contentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(contentId) || contentId <= 0) {
      return res.status(400).json({ error: 'Invalid content id' });
    }

    const [item] = await db.select().from(explicitContent)
      .where(and(eq(explicitContent.id, contentId), eq(explicitContent.artistId, userId)))
      .limit(1);
    if (!item) return res.status(404).json({ error: 'Content not found or not yours' });

    const { title, description, category, mediaUrl, thumbnailUrl, isPaywalled, singlePurchasePrice, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof title === 'string' && title.trim()) updates.title = title.trim();
    if (typeof description === 'string') updates.description = description;
    if (typeof category === 'string') updates.category = category;
    if (typeof mediaUrl === 'string' && mediaUrl.trim()) updates.mediaUrl = mediaUrl.trim();
    if (typeof thumbnailUrl === 'string') updates.thumbnailUrl = thumbnailUrl;
    if (typeof isPaywalled === 'boolean') updates.isPaywalled = isPaywalled;
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (singlePurchasePrice !== undefined) {
      updates.singlePurchasePrice = singlePurchasePrice === null || singlePurchasePrice === ''
        ? null : String(singlePurchasePrice);
    }

    const [updated] = await db.update(explicitContent)
      .set(updates)
      .where(eq(explicitContent.id, contentId))
      .returning();

    res.json({ success: true, content: updated });
  } catch (error: any) {
    console.error('[explicit] edit error:', error);
    res.status(500).json({ error: error?.message || 'Edit failed' });
  }
});


// ═══════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════

// GET /subscription/check/:artistId — Check if current user is subscribed
router.get('/subscription/check/:artistId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.json({ subscribed: false });

    const artistId = await resolveArtistId(req.params.artistId);
    if (!artistId) return res.status(404).json({ error: 'Artist not found' });

    if (userId === artistId) return res.json({ subscribed: true, isOwner: true });

    const [sub] = await db.select().from(explicitSubscriptions)
      .where(and(
        eq(explicitSubscriptions.subscriberId, userId),
        eq(explicitSubscriptions.artistId, artistId),
        eq(explicitSubscriptions.status, 'active'),
      )).limit(1);

    res.json({
      subscribed: !!sub,
      subscription: sub || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Paid access is granted only by signed Stripe Checkout webhooks.
router.post('/subscription/create', (_req: Request, res: Response) => res.status(410).json({ error: 'Use the secure Stripe Checkout flow.' }));

// PURCHASES (single content)
// ═══════════════════════════════════════════════════════════════════

// Paid access is granted only by signed Stripe Checkout webhooks.
router.post('/purchase', (_req: Request, res: Response) => res.status(410).json({ error: 'Use the secure Stripe Checkout flow.' }));

// TIPS
// ═══════════════════════════════════════════════════════════════════

// Paid access is granted only by signed Stripe Checkout webhooks.
router.post('/tip', (_req: Request, res: Response) => res.status(410).json({ error: 'Use the secure Stripe Checkout flow.' }));

// CHAT
// ═══════════════════════════════════════════════════════════════════

// GET /chat/:artistId — Get chat messages (subscriber or owner only)
router.get('/chat/:artistId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const artistId = await resolveArtistId(req.params.artistId);
    if (!artistId) return res.status(404).json({ error: 'Artist not found' });

    const isOwner = userId === artistId;

    // Verify subscription if not owner
    if (!isOwner) {
      const [sub] = await db.select().from(explicitSubscriptions)
        .where(and(
          eq(explicitSubscriptions.subscriberId, userId),
          eq(explicitSubscriptions.artistId, artistId),
          eq(explicitSubscriptions.status, 'active'),
        )).limit(1);
      if (!sub) return res.status(403).json({ error: 'Subscription required for chat' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let messages;
    if (isOwner) {
      // Owner sees all messages in their chat
      messages = await db.select().from(explicitChatMessages)
        .where(eq(explicitChatMessages.artistId, artistId))
        .orderBy(desc(explicitChatMessages.createdAt))
        .limit(limit).offset(offset);
    } else {
      // Subscriber sees only their conversation with the artist
      messages = await db.select().from(explicitChatMessages)
        .where(and(
          eq(explicitChatMessages.artistId, artistId),
          or(
            and(eq(explicitChatMessages.senderId, userId), eq(explicitChatMessages.receiverId, artistId)),
            and(eq(explicitChatMessages.senderId, artistId), eq(explicitChatMessages.receiverId, userId)),
          ),
        ))
        .orderBy(desc(explicitChatMessages.createdAt))
        .limit(limit).offset(offset);
    }

    res.json(messages.reverse());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /chat/:artistId — Send a chat message
router.post('/chat/:artistId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const artistId = await resolveArtistId(req.params.artistId);
    if (!artistId) return res.status(404).json({ error: 'Artist not found' });

    if (chatRateLimited(userId)) {
      return res.status(429).json({ error: 'Too many messages — slow down (max 30/min)' });
    }

    const isOwner = userId === artistId;

    // Subscriber check (unless owner)
    if (!isOwner) {
      const [sub] = await db.select().from(explicitSubscriptions)
        .where(and(
          eq(explicitSubscriptions.subscriberId, userId),
          eq(explicitSubscriptions.artistId, artistId),
          eq(explicitSubscriptions.status, 'active'),
        )).limit(1);
      if (!sub) return res.status(403).json({ error: 'Subscription required for chat' });
    }

    const { message, mediaUrl, mediaType, tipAmount, receiverId } = req.body;
    if (!message && !mediaUrl) {
      return res.status(400).json({ error: 'message or mediaUrl required' });
    }

    // Determine receiver
    let actualReceiverId: number;
    if (isOwner && receiverId) {
      const resolved = await resolveArtistId(receiverId);
      if (!resolved) return res.status(404).json({ error: 'Receiver not found' });
      actualReceiverId = resolved;
    } else {
      actualReceiverId = artistId;
    }

    const [msg] = await db.insert(explicitChatMessages).values({
      senderId: userId,
      receiverId: actualReceiverId,
      artistId,
      message: message || '',
      mediaUrl, mediaType,
      tipAmount: tipAmount ? String(tipAmount) : null,
    }).returning();

    res.json(msg);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// AI GENERATION
// ═══════════════════════════════════════════════════════════════════

// GET /ai/generations — List user's AI generations
router.get('/ai/generations', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const generations = await db.select().from(explicitAiGenerations)
      .where(eq(explicitAiGenerations.artistId, userId))
      .orderBy(desc(explicitAiGenerations.createdAt))
      .limit(50);

    res.json(await Promise.all(generations.map(async generation => ({
      ...generation,
      resultUrl: await resolvePrivateMediaUrl(generation.resultUrl),
      thumbnailUrl: await resolvePrivateMediaUrl(generation.thumbnailUrl),
    }))));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /ai/generate-image — Generate an explicit image
router.post('/ai/generate-image', rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { prompt, negativePrompt, model, imageSize, numImages, guidanceScale, loraUrl, loraScale } = req.body;
    let { referenceImageUrl } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const selectedModel = model || EXPLICIT_FAL_MODELS.IMAGE_NANO_BANANA_21;
    if (!(EXPLICIT_IMAGE_MODELS as readonly string[]).includes(selectedModel)) {
      return res.status(400).json({ error: 'Unsupported image model. Choose one of the available creator studio models.' });
    }

    // Use the artist profile photo as an optional likeness reference when no
    // explicit reference was uploaded.
    if (!referenceImageUrl) {
      const [artist] = await db.select({ p1: users.profileImageUrl, p2: users.profileImage })
        .from(users).where(eq(users.id, userId)).limit(1);
      referenceImageUrl = artist?.p1 || artist?.p2 || undefined;
    }

    // Create generation record. Keep costs unknown when fal bills in account-specific units.
    const selectedModelCost = getModelCost(selectedModel, numImages);
    const [gen] = await db.insert(explicitAiGenerations).values({
      artistId: userId, type: 'image', model: selectedModel, prompt,
      negativePrompt, parameters: { imageSize, numImages, guidanceScale, loraUrl, loraScale, referenceImageUrl },
      costUsd: selectedModelCost === null ? null : String(selectedModelCost), status: 'processing',
    }).returning();

    // Generate with supported fal image models and safe model fallbacks.
    const result = await generateExplicitImage({
      prompt, negativePrompt, model: selectedModel,
      imageSize, numImages, guidanceScale, loraUrl, loraScale,
      referenceImageUrl, artistId: userId,
    });

    if (result.success && result.images && result.images.length > 0) {
      const [updated] = await db.update(explicitAiGenerations)
        .set({
          resultUrl: result.images[0].storagePath || result.images[0].url,
          thumbnailUrl: result.images[0].storagePath || result.images[0].url,
          model: result.model || selectedModel,
          costUsd: getModelCost(result.model || selectedModel, numImages) === null ? null : String(getModelCost(result.model || selectedModel, numImages)),
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(explicitAiGenerations.id, gen.id))
        .returning();
      return res.json({ ...updated, allImages: result.images });
    }

    await db.update(explicitAiGenerations)
      .set({ status: 'failed', errorMessage: result.error })
      .where(eq(explicitAiGenerations.id, gen.id));

    res.status(502).json({
      error: result.error || 'Generation failed',
      generationId: gen.id,
      model: selectedModel,
      hint: 'Check that FAL_KEY is configured and available on the server.',
    });
  } catch (error: any) {
    console.error('[explicit] generate-image error:', error);
    res.status(500).json({ error: error?.message || 'Generation failed' });
  }
});

// POST /ai/generate-video — Generate an explicit video
router.post('/ai/generate-video', rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { prompt, negativePrompt, imageUrl, numFrames, frameRate } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const isFromImage = !!imageUrl;
    const model = isFromImage ? EXPLICIT_FAL_MODELS.VIDEO_FROM_IMAGE : EXPLICIT_FAL_MODELS.VIDEO_FROM_TEXT;

    const videoCost = getModelCost(model);
    const [gen] = await db.insert(explicitAiGenerations).values({
      artistId: userId, type: 'video', model, prompt, negativePrompt,
      parameters: { imageUrl, numFrames, frameRate },
      costUsd: videoCost === null ? null : String(videoCost), status: 'processing',
    }).returning();

    const result = isFromImage
      ? await generateExplicitVideoFromImage({ prompt, imageUrl, negativePrompt, numFrames, frameRate })
      : await generateExplicitVideoFromText({ prompt, negativePrompt, numFrames, frameRate });

    if (result.success && result.video) {
      const [updated] = await db.update(explicitAiGenerations)
        .set({
          resultUrl: result.video.url,
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(explicitAiGenerations.id, gen.id))
        .returning();
      return res.json(updated);
    }

    await db.update(explicitAiGenerations)
      .set({ status: 'failed', errorMessage: result.error })
      .where(eq(explicitAiGenerations.id, gen.id));

    res.status(500).json({ error: result.error || 'Video generation failed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /ai/publish/:generationId — Publish AI generation as content
router.post('/ai/publish/:generationId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const genId = parseInt(req.params.generationId);
    const [gen] = await db.select().from(explicitAiGenerations)
      .where(and(eq(explicitAiGenerations.id, genId), eq(explicitAiGenerations.artistId, userId)))
      .limit(1);

    if (!gen || gen.status !== 'completed' || !gen.resultUrl) {
      return res.status(404).json({ error: 'Generation not found or not completed' });
    }

    const { title, description, category, isPaywalled, singlePurchasePrice } = req.body;

    const [content] = await db.insert(explicitContent).values({
      artistId: userId,
      type: 'ai_generated',
      title: title || `AI ${gen.type} - ${new Date().toLocaleDateString()}`,
      description, category,
      mediaUrl: gen.resultUrl,
      thumbnailUrl: gen.thumbnailUrl,
      isPaywalled: isPaywalled ?? true,
      singlePurchasePrice,
      aiModel: gen.model,
      aiPrompt: gen.prompt,
    }).returning();

    await db.update(explicitAiGenerations)
      .set({ publishedAsContentId: content.id })
      .where(eq(explicitAiGenerations.id, genId));

    res.json(content);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// EARNINGS / ANALYTICS
// ═══════════════════════════════════════════════════════════════════

// GET /earnings/:artistId — Get earnings summary for an artist
router.get('/earnings/:artistId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const artistId = await resolveArtistId(req.params.artistId);
    if (!artistId || userId !== artistId) return res.status(403).json({ error: 'Not authorized' });

    // Subscription count
    const [subCount] = await db.select({ count: sql<number>`count(*)` })
      .from(explicitSubscriptions)
      .where(and(eq(explicitSubscriptions.artistId, artistId), eq(explicitSubscriptions.status, 'active')));

    // Total purchases revenue
    const [purchaseRevenue] = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
      .from(explicitPurchases)
      .where(and(eq(explicitPurchases.artistId, artistId), eq(explicitPurchases.status, 'completed')));

    // Total tips revenue
    const [tipRevenue] = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
      .from(explicitTips)
      .where(and(eq(explicitTips.artistId, artistId), eq(explicitTips.status, 'completed')));

    const [subscriptionRevenue] = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
      .from(explicitSubscriptionPayments)
      .where(eq(explicitSubscriptionPayments.artistId, artistId));

    // Content count
    const [contentCount] = await db.select({ count: sql<number>`count(*)` })
      .from(explicitContent)
      .where(and(eq(explicitContent.artistId, artistId), eq(explicitContent.isActive, true)));

    // AI generation costs
    const [aiCosts] = await db.select({ total: sql<string>`coalesce(sum(cost_usd::numeric), 0)` })
      .from(explicitAiGenerations)
      .where(and(eq(explicitAiGenerations.artistId, artistId), eq(explicitAiGenerations.status, 'completed')));

    res.json({
      activeSubscribers: Number(subCount?.count) || 0,
      purchaseRevenue: parseFloat(purchaseRevenue?.total || '0'),
      tipRevenue: parseFloat(tipRevenue?.total || '0'),
      subscriptionRevenue: parseFloat(subscriptionRevenue?.total || '0'),
      totalRevenue: parseFloat(subscriptionRevenue?.total || '0') + parseFloat(purchaseRevenue?.total || '0') + parseFloat(tipRevenue?.total || '0'),
      contentCount: Number(contentCount?.count) || 0,
      aiGenerationCosts: parseFloat(aiCosts?.total || '0'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stripe is the source of truth: only signed Checkout webhooks grant paid access.
router.post('/webhook', async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_EXPLICIT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];
  if (!stripe || !webhookSecret || !signature || !Buffer.isBuffer(req.body)) {
    return res.status(400).send('Stripe webhook is not configured correctly.');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error: any) {
    return res.status(400).send(`Invalid Stripe signature: ${error.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      if (metadata.type !== 'exclusive_content') return res.json({ received: true });

      const buyerId = Number(metadata.buyerId);
      const artistId = Number(metadata.artistId);
      if (!Number.isInteger(buyerId) || !Number.isInteger(artistId) || buyerId === artistId) {
        return res.status(400).send('Checkout metadata is invalid.');
      }
      if (session.client_reference_id !== String(buyerId)) return res.status(400).send('Checkout buyer does not match session reference.');

      if (metadata.kind === 'subscription' && session.mode === 'subscription' && session.subscription) {
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (!['active', 'trialing'].includes(subscription.status)) return res.json({ received: true, pending: true });
        if (subscription.metadata?.buyerId !== String(buyerId) || subscription.metadata?.artistId !== String(artistId)) {
          return res.status(400).send('Stripe subscription metadata does not match checkout.');
        }
        const plan = metadata.plan === 'yearly' ? 'yearly' : metadata.plan === 'monthly' ? 'monthly' : null;
        if (!plan) return res.status(400).send('Subscription plan metadata is invalid.');
        const [existing] = await db.select({ id: explicitSubscriptions.id }).from(explicitSubscriptions)
          .where(eq(explicitSubscriptions.stripeCheckoutSessionId, session.id)).limit(1);
        if (!existing) {
          const periodStart = (subscription as any).current_period_start;
          const periodEnd = (subscription as any).current_period_end;
          await db.update(explicitSubscriptions)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(and(
              eq(explicitSubscriptions.subscriberId, buyerId),
              eq(explicitSubscriptions.artistId, artistId),
              eq(explicitSubscriptions.status, 'active'),
            ));
          await db.insert(explicitSubscriptions).values({
            subscriberId: buyerId,
            artistId,
            plan,
            status: 'active',
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
            stripeCheckoutSessionId: session.id,
            currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
          }).onConflictDoNothing();
        }
      } else if ((metadata.kind === 'purchase' || metadata.kind === 'tip') && session.mode === 'payment') {
        if (session.payment_status !== 'paid') return res.json({ received: true, pending: true });
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        const total = Number(session.amount_total);
        if (!paymentIntentId || !Number.isInteger(total) || total <= 0 || session.currency !== 'usd') {
          return res.status(400).send('Checkout payment details are invalid.');
        }
        if (metadata.kind === 'purchase') {
          const contentId = Number(metadata.contentId);
          const [content] = await db.select().from(explicitContent)
            .where(and(eq(explicitContent.id, contentId), eq(explicitContent.artistId, artistId))).limit(1);
          if (!content) return res.status(400).send('Purchased content does not belong to the artist.');
          await db.insert(explicitPurchases).values({
            buyerId, artistId, contentId,
            amount: (total / 100).toFixed(2),
            currency: session.currency,
            stripePaymentIntentId: paymentIntentId,
            stripeCheckoutSessionId: session.id,
            status: 'completed',
          }).onConflictDoNothing();
        } else {
          await db.insert(explicitTips).values({
            tipperId: buyerId, artistId,
            amount: (total / 100).toFixed(2),
            currency: session.currency,
            message: metadata.message || null,
            stripePaymentIntentId: paymentIntentId,
            stripeCheckoutSessionId: session.id,
            status: 'completed',
          }).onConflictDoNothing();
        }
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const status = subscription.status === 'active' || subscription.status === 'trialing'
        ? 'active'
        : subscription.status === 'past_due' || subscription.status === 'unpaid'
          ? 'past_due'
          : 'cancelled';
      const periodStart = (subscription as any).current_period_start;
      const periodEnd = (subscription as any).current_period_end;
      await db.update(explicitSubscriptions).set({
        status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
        updatedAt: new Date(),
      }).where(eq(explicitSubscriptions.stripeSubscriptionId, subscription.id));
    }

    if (event.type === 'invoice.paid') {
      const invoice: any = event.data.object;
      const stripeSubscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.parent?.subscription_details?.subscription;
      if (stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(String(stripeSubscriptionId));
        const buyerId = Number(subscription.metadata?.buyerId);
        const artistId = Number(subscription.metadata?.artistId);
        const amountPaid = Number(invoice.amount_paid);
        if (subscription.metadata?.type === 'exclusive_content' && Number.isInteger(buyerId) && buyerId > 0 && Number.isInteger(artistId) && artistId > 0 && amountPaid > 0 && invoice.currency === 'usd') {
          await db.insert(explicitSubscriptionPayments).values({
            stripeInvoiceId: String(invoice.id),
            stripeSubscriptionId: String(stripeSubscriptionId),
            buyerId,
            artistId,
            amount: (amountPaid / 100).toFixed(2),
            currency: 'usd',
          }).onConflictDoNothing();
        }
      }
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.error('[explicit] Stripe webhook fulfillment failed:', error);
    return res.status(500).send('Webhook fulfillment failed.');
  }
});

export default router;
