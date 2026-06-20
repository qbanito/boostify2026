/**
 * Boostify Explicit — API Routes
 * Content CRUD, subscriptions, purchases, tips, AI generation, chat
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../db';
import { storage as firebaseStorage } from '../firebase';
import {
  explicitSettings, explicitContent, explicitSubscriptions,
  explicitPurchases, explicitChatMessages, explicitAiGenerations,
  explicitTips, users,
} from '../db/schema';
import { eq, and, desc, asc, or, sql } from 'drizzle-orm';
import {
  generateExplicitImage, generateExplicitVideoFromImage,
  generateExplicitVideoFromText, getModelCost, EXPLICIT_FAL_MODELS,
} from '../services/explicit-ai-service';
import { rateLimitAiGen } from '../middleware/rate-limit';

const router = Router();

// ─── Multer for file uploads (memory, 100MB max, image/video/audio only) ───
const explicitUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image|video|audio)\//i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
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

    res.json(settings || { enabled: false, artistId });
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

    // If no access, return blurred previews only
    if (!hasAccess) {
      const blurred = items.map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        category: item.category,
        thumbnailUrl: item.blurredPreviewUrl || item.thumbnailUrl,
        isPaywalled: item.isPaywalled,
        singlePurchasePrice: item.singlePurchasePrice,
        viewCount: item.viewCount,
        likeCount: item.likeCount,
        createdAt: item.createdAt,
        locked: true,
      }));
      return res.json({ items: blurred, hasAccess: false });
    }

    // Check individual purchases for non-subscribed users
    let purchasedIds: number[] = [];
    if (!isOwner && userId) {
      const purchases = await db.select({ contentId: explicitPurchases.contentId })
        .from(explicitPurchases)
        .where(and(
          eq(explicitPurchases.buyerId, userId),
          eq(explicitPurchases.artistId, artistId),
          eq(explicitPurchases.status, 'completed'),
        ));
      purchasedIds = purchases.map(p => p.contentId);
    }

    const result = items.map(item => ({
      ...item,
      locked: false,
      purchased: isOwner || purchasedIds.includes(item.id),
    }));

    res.json({ items: result, hasAccess: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /content/upload — Upload a media file to Firebase Storage (owner only)
// Returns a public URL the client can pass to POST /content as mediaUrl.
router.post('/content/upload', explicitUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided (field name must be "file")' });

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
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          uploadedBy: String(userId),
          originalName: String(file.originalname).slice(0, 200),
          kind,
        },
      },
    });
    await fbFile.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(objectPath)}`;

    return res.json({
      success: true,
      mediaUrl: publicUrl,
      thumbnailUrl: kind === 'image' ? publicUrl : undefined,
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

    const { type, title, description, category, mediaUrl, thumbnailUrl,
      blurredPreviewUrl, isPaywalled, singlePurchasePrice } = req.body;

    if (!type || !title || !mediaUrl) {
      return res.status(400).json({ error: 'type, title, and mediaUrl are required' });
    }

    const [content] = await db.insert(explicitContent).values({
      artistId: userId, type, title, description, category,
      mediaUrl, thumbnailUrl, blurredPreviewUrl,
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
          if (item.mediaUrl.startsWith(prefix)) {
            const objectPath = decodeURI(item.mediaUrl.slice(prefix.length));
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

// POST /subscription/create — Create a subscription (after Stripe payment)
router.post('/subscription/create', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { artistId: rawArtistId, plan, stripeSubscriptionId, stripeCustomerId } = req.body;
    const artistId = await resolveArtistId(rawArtistId);
    if (!artistId) return res.status(404).json({ error: 'Artist not found' });

    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'Valid plan required (monthly/yearly)' });
    }

    // Deactivate existing subscription if any
    await db.update(explicitSubscriptions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(explicitSubscriptions.subscriberId, userId),
        eq(explicitSubscriptions.artistId, artistId),
        eq(explicitSubscriptions.status, 'active'),
      ));

    const now = new Date();
    const periodEnd = new Date(now);
    if (plan === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    const [sub] = await db.insert(explicitSubscriptions).values({
      subscriberId: userId, artistId, plan, status: 'active',
      stripeSubscriptionId, stripeCustomerId,
      currentPeriodStart: now, currentPeriodEnd: periodEnd,
    }).returning();

    res.json(sub);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PURCHASES (single content)
// ═══════════════════════════════════════════════════════════════════

// POST /purchase — Purchase a single piece of content
router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { contentId, stripePaymentIntentId } = req.body;
    if (!contentId) return res.status(400).json({ error: 'contentId required' });

    const [content] = await db.select().from(explicitContent)
      .where(eq(explicitContent.id, contentId)).limit(1);
    if (!content) return res.status(404).json({ error: 'Content not found' });

    const [purchase] = await db.insert(explicitPurchases).values({
      buyerId: userId,
      contentId: content.id,
      artistId: content.artistId,
      amount: content.singlePurchasePrice || '4.99',
      stripePaymentIntentId,
      status: 'completed',
    }).returning();

    res.json(purchase);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// TIPS
// ═══════════════════════════════════════════════════════════════════

// POST /tip — Send a tip to an artist
router.post('/tip', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { artistId: rawArtistId, amount, message, contentId, chatMessageId, stripePaymentIntentId } = req.body;
    const artistId = await resolveArtistId(rawArtistId);
    if (!artistId) return res.status(404).json({ error: 'Artist not found' });

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    const [tip] = await db.insert(explicitTips).values({
      tipperId: userId, artistId, amount: String(amount), message,
      contentId: contentId || null, chatMessageId: chatMessageId || null,
      stripePaymentIntentId, status: 'completed',
    }).returning();

    res.json(tip);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
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

    res.json(generations);
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

    const selectedModel = model || EXPLICIT_FAL_MODELS.REALISTIC_UNCENSORED;

    // For likeness, auto-fall back to the artist's profile photo if no reference given.
    if (selectedModel === EXPLICIT_FAL_MODELS.ARTIST_LIKENESS && !referenceImageUrl) {
      const [artist] = await db.select({ p1: users.profileImageUrl, p2: users.profileImage })
        .from(users).where(eq(users.id, userId)).limit(1);
      referenceImageUrl = artist?.p1 || artist?.p2 || undefined;
      if (!referenceImageUrl) {
        return res.status(400).json({ error: 'Artist Likeness necesita una foto de referencia. Sube una foto del artista o configura tu foto de perfil.' });
      }
    }

    // Create generation record
    const [gen] = await db.insert(explicitAiGenerations).values({
      artistId: userId, type: 'image', model: selectedModel, prompt,
      negativePrompt, parameters: { imageSize, numImages, guidanceScale, loraUrl, loraScale, referenceImageUrl },
      costUsd: String(getModelCost(selectedModel)), status: 'processing',
    }).returning();

    // Generate (uncensored providers with auto-fallback + Firebase persistence)
    const result = await generateExplicitImage({
      prompt, negativePrompt, model: selectedModel,
      imageSize, numImages, guidanceScale, loraUrl, loraScale,
      referenceImageUrl, artistId: userId,
    });

    if (result.success && result.images && result.images.length > 0) {
      const [updated] = await db.update(explicitAiGenerations)
        .set({
          resultUrl: result.images[0].url,
          thumbnailUrl: result.images[0].url,
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
      hint: 'If using FHDR, the HuggingFace model may be cold-starting (try again in ~60s) or set HUGGINGFACE_TOKEN. Otherwise verify FAL_API_KEY.',
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

    const [gen] = await db.insert(explicitAiGenerations).values({
      artistId: userId, type: 'video', model, prompt, negativePrompt,
      parameters: { imageUrl, numFrames, frameRate },
      costUsd: String(getModelCost(model)), status: 'processing',
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
      totalRevenue: parseFloat(purchaseRevenue?.total || '0') + parseFloat(tipRevenue?.total || '0'),
      contentCount: Number(contentCount?.count) || 0,
      aiGenerationCosts: parseFloat(aiCosts?.total || '0'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
