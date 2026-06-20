/**
 * Musician Messaging API (Producer Tools)
 * --------------------------------------------------------------
 * Unified messaging hub between a client (producer/artist) and a
 * musician, including:
 *   • Conversations list / create
 *   • Message history + send (text / audio / file attachments)
 *   • Contract / service-quote creation + accept / reject
 *   • Unread counters + read receipts
 *
 * Permissions
 *   — A conversation is readable/writable by its clientUser and the
 *     musician's linked user (musician.userId). Admin emails bypass.
 *   — For musicians imported WITHOUT a linked users row, messages
 *     from the musician side are posted by the platform on their
 *     behalf (senderRole='musician', senderUserId=null). The owner
 *     of the musician entry (musicians.userId) can always write as
 *     the musician.
 */

import { Router } from 'express';
import { db } from '../db';
import {
  musicianConversations,
  musicianMessages,
  musicianServiceContracts,
  musicians,
  bookings,
  users,
} from '../../db/schema';
import { and, desc, eq, or } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/clerk-auth';
import { isAdminEmail } from '../../shared/constants';

const router = Router();

// ── Utilities ──────────────────────────────────────────────────────
async function resolvePgUserId(clerkUserId: string): Promise<number | null> {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  return u?.id ?? null;
}

async function getConversationAndRole(conversationId: number, pgUserId: number, userEmail?: string) {
  const [conv] = await db
    .select()
    .from(musicianConversations)
    .where(eq(musicianConversations.id, conversationId))
    .limit(1);
  if (!conv) return null;

  const [musician] = await db
    .select({ userId: musicians.userId })
    .from(musicians)
    .where(eq(musicians.id, conv.musicianId))
    .limit(1);

  const isAdmin = userEmail ? isAdminEmail(userEmail) : false;
  const isClient = conv.clientUserId === pgUserId;
  const isMusicianOwner =
    (conv.musicianUserId && conv.musicianUserId === pgUserId) ||
    (musician?.userId && musician.userId === pgUserId);

  if (!isClient && !isMusicianOwner && !isAdmin) return null;

  const role: 'client' | 'musician' =
    isClient ? 'client' : isMusicianOwner ? 'musician' : 'client';

  return { conv, role, isAdmin };
}

// ── Routes ─────────────────────────────────────────────────────────

/**
 * GET /api/musician-messaging/conversations
 * Returns both "as client" and "as musician" conversations.
 */
router.get('/conversations', isAuthenticated, async (req, res) => {
  try {
    const clerkUserId = (req as any).user?.id as string;
    const pgUserId = await resolvePgUserId(clerkUserId);
    if (!pgUserId) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: musicianConversations.id,
        clientUserId: musicianConversations.clientUserId,
        musicianId: musicianConversations.musicianId,
        musicianUserId: musicianConversations.musicianUserId,
        bookingId: musicianConversations.bookingId,
        subject: musicianConversations.subject,
        status: musicianConversations.status,
        lastMessagePreview: musicianConversations.lastMessagePreview,
        lastMessageAt: musicianConversations.lastMessageAt,
        clientUnreadCount: musicianConversations.clientUnreadCount,
        musicianUnreadCount: musicianConversations.musicianUnreadCount,
        createdAt: musicianConversations.createdAt,
        updatedAt: musicianConversations.updatedAt,
        musicianName: musicians.name,
        musicianPhoto: musicians.photo,
        musicianInstrument: musicians.instrument,
      })
      .from(musicianConversations)
      .leftJoin(musicians, eq(musicians.id, musicianConversations.musicianId))
      .where(
        or(
          eq(musicianConversations.clientUserId, pgUserId),
          eq(musicianConversations.musicianUserId, pgUserId),
        ),
      )
      .orderBy(desc(musicianConversations.lastMessageAt));

    return res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('[musician-messaging] list conversations failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to load conversations' });
  }
});

/**
 * POST /api/musician-messaging/conversations
 * Body: { musicianId, subject?, bookingId?, initialMessage? }
 * Creates or reuses an open conversation between the caller and the musician.
 */
router.post('/conversations', isAuthenticated, async (req, res) => {
  try {
    const clerkUserId = (req as any).user?.id as string;
    const pgUserId = await resolvePgUserId(clerkUserId);
    if (!pgUserId) return res.status(401).json({ success: false, error: 'User not found' });

    const { musicianId, subject, bookingId, initialMessage } = req.body || {};
    const musicianIdNum = Number(musicianId);
    if (!musicianIdNum) return res.status(400).json({ success: false, error: 'musicianId is required' });

    const [musician] = await db
      .select({ id: musicians.id, userId: musicians.userId })
      .from(musicians)
      .where(eq(musicians.id, musicianIdNum))
      .limit(1);
    if (!musician) return res.status(404).json({ success: false, error: 'Musician not found' });

    // Reuse an existing open conversation between this client and musician if present
    const [existing] = await db
      .select()
      .from(musicianConversations)
      .where(
        and(
          eq(musicianConversations.clientUserId, pgUserId),
          eq(musicianConversations.musicianId, musicianIdNum),
        ),
      )
      .limit(1);

    let conv = existing;
    if (!conv) {
      const [created] = await db
        .insert(musicianConversations)
        .values({
          clientUserId: pgUserId,
          musicianId: musicianIdNum,
          musicianUserId: musician.userId || null,
          bookingId: bookingId ? Number(bookingId) : null,
          subject: subject || null,
          status: 'open',
        })
        .returning();
      conv = created;
    } else if (subject && !conv.subject) {
      const [updated] = await db
        .update(musicianConversations)
        .set({ subject, updatedAt: new Date() })
        .where(eq(musicianConversations.id, conv.id))
        .returning();
      conv = updated;
    }

    // Optional initial message
    if (initialMessage && typeof initialMessage === 'string' && initialMessage.trim().length > 0) {
      const preview = initialMessage.slice(0, 140);
      const [msg] = await db
        .insert(musicianMessages)
        .values({
          conversationId: conv.id,
          senderRole: 'client',
          senderUserId: pgUserId,
          type: 'text',
          body: initialMessage.trim(),
          readByClient: true,
          readByMusician: false,
        })
        .returning();
      await db
        .update(musicianConversations)
        .set({
          lastMessagePreview: preview,
          lastMessageAt: new Date(),
          musicianUnreadCount: (conv.musicianUnreadCount || 0) + 1,
          status: 'awaiting_musician',
          updatedAt: new Date(),
        })
        .where(eq(musicianConversations.id, conv.id));
      return res.status(201).json({ success: true, conversation: conv, message: msg });
    }

    return res.status(200).json({ success: true, conversation: conv });
  } catch (err: any) {
    console.error('[musician-messaging] create conversation failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create conversation' });
  }
});

/**
 * GET /api/musician-messaging/conversations/:id/messages
 */
router.get('/conversations/:id/messages', isAuthenticated, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    if (!conversationId) return res.status(400).json({ success: false, error: 'Invalid conversation id' });

    const clerkUserId = (req as any).user?.id as string;
    const userEmail = (req as any).user?.email as string | undefined;
    const pgUserId = await resolvePgUserId(clerkUserId);
    if (!pgUserId) return res.status(401).json({ success: false, error: 'User not found' });

    const access = await getConversationAndRole(conversationId, pgUserId, userEmail);
    if (!access) return res.status(403).json({ success: false, error: 'Not authorized' });

    const messages = await db
      .select()
      .from(musicianMessages)
      .where(eq(musicianMessages.conversationId, conversationId))
      .orderBy(musicianMessages.createdAt);

    const contracts = await db
      .select()
      .from(musicianServiceContracts)
      .where(eq(musicianServiceContracts.conversationId, conversationId))
      .orderBy(desc(musicianServiceContracts.createdAt));

    // Mark as read for the caller's role
    const readField = access.role === 'client'
      ? { clientUnreadCount: 0 }
      : { musicianUnreadCount: 0 };
    await db.update(musicianConversations).set({ ...readField, updatedAt: new Date() }).where(eq(musicianConversations.id, conversationId));

    // Flip read flag on unread messages from the other side
    if (access.role === 'client') {
      await db.update(musicianMessages)
        .set({ readByClient: true })
        .where(and(eq(musicianMessages.conversationId, conversationId), eq(musicianMessages.readByClient, false)));
    } else {
      await db.update(musicianMessages)
        .set({ readByMusician: true })
        .where(and(eq(musicianMessages.conversationId, conversationId), eq(musicianMessages.readByMusician, false)));
    }

    return res.json({
      success: true,
      conversation: access.conv,
      role: access.role,
      messages,
      contracts,
    });
  } catch (err: any) {
    console.error('[musician-messaging] fetch messages failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch messages' });
  }
});

/**
 * POST /api/musician-messaging/conversations/:id/messages
 * Body: { body, type?, attachments?, metadata? }
 */
router.post('/conversations/:id/messages', isAuthenticated, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    if (!conversationId) return res.status(400).json({ success: false, error: 'Invalid conversation id' });

    const clerkUserId = (req as any).user?.id as string;
    const userEmail = (req as any).user?.email as string | undefined;
    const pgUserId = await resolvePgUserId(clerkUserId);
    if (!pgUserId) return res.status(401).json({ success: false, error: 'User not found' });

    const access = await getConversationAndRole(conversationId, pgUserId, userEmail);
    if (!access) return res.status(403).json({ success: false, error: 'Not authorized' });

    const { body, type = 'text', attachments, metadata } = req.body || {};
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'body is required' });
    }
    if (body.length > 10000) {
      return res.status(400).json({ success: false, error: 'Message too long (max 10000 chars)' });
    }

    const role = access.role;
    const preview = body.slice(0, 140);

    const [msg] = await db
      .insert(musicianMessages)
      .values({
        conversationId,
        senderRole: role,
        senderUserId: pgUserId,
        type,
        body: body.trim(),
        attachments: Array.isArray(attachments) ? attachments : null,
        metadata: metadata || null,
        readByClient: role === 'client',
        readByMusician: role === 'musician',
      })
      .returning();

    const updates: Record<string, any> = {
      lastMessagePreview: preview,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    };
    if (role === 'client') {
      updates.musicianUnreadCount = (access.conv.musicianUnreadCount || 0) + 1;
      updates.status = 'awaiting_musician';
    } else {
      updates.clientUnreadCount = (access.conv.clientUnreadCount || 0) + 1;
      updates.status = 'awaiting_client';
    }
    await db.update(musicianConversations).set(updates).where(eq(musicianConversations.id, conversationId));

    return res.status(201).json({ success: true, message: msg });
  } catch (err: any) {
    console.error('[musician-messaging] send message failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to send message' });
  }
});

/**
 * POST /api/musician-messaging/conversations/:id/contracts
 * Create a service contract inside a conversation (sent state).
 * Body: { title, summary?, terms?, priceAmount, priceCurrency? }
 */
router.post('/conversations/:id/contracts', isAuthenticated, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    if (!conversationId) return res.status(400).json({ success: false, error: 'Invalid conversation id' });

    const clerkUserId = (req as any).user?.id as string;
    const userEmail = (req as any).user?.email as string | undefined;
    const pgUserId = await resolvePgUserId(clerkUserId);
    if (!pgUserId) return res.status(401).json({ success: false, error: 'User not found' });

    const access = await getConversationAndRole(conversationId, pgUserId, userEmail);
    if (!access) return res.status(403).json({ success: false, error: 'Not authorized' });

    const { title, summary, terms, priceAmount, priceCurrency = 'usd' } = req.body || {};
    if (!title || typeof title !== 'string') return res.status(400).json({ success: false, error: 'title is required' });
    const price = Number(priceAmount);
    if (!price || price <= 0) return res.status(400).json({ success: false, error: 'priceAmount must be > 0' });

    const [contract] = await db
      .insert(musicianServiceContracts)
      .values({
        conversationId,
        title,
        summary: summary || null,
        terms: terms && typeof terms === 'object' ? terms : null,
        priceAmount: price.toFixed(2),
        priceCurrency,
        status: 'sent',
        sentAt: new Date(),
      })
      .returning();

    // Auto-post a message representing the contract so it shows up inline
    const preview = `📝 Contract: ${title} — $${price}`;
    await db.insert(musicianMessages).values({
      conversationId,
      senderRole: access.role,
      senderUserId: pgUserId,
      type: 'contract',
      body: preview,
      metadata: { contractId: contract.id },
      readByClient: access.role === 'client',
      readByMusician: access.role === 'musician',
    });
    await db.update(musicianConversations).set({
      lastMessagePreview: preview,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
      clientUnreadCount: access.role === 'musician' ? (access.conv.clientUnreadCount || 0) + 1 : access.conv.clientUnreadCount,
      musicianUnreadCount: access.role === 'client' ? (access.conv.musicianUnreadCount || 0) + 1 : access.conv.musicianUnreadCount,
      status: access.role === 'client' ? 'awaiting_musician' : 'awaiting_client',
    }).where(eq(musicianConversations.id, conversationId));

    return res.status(201).json({ success: true, contract });
  } catch (err: any) {
    console.error('[musician-messaging] create contract failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create contract' });
  }
});

/**
 * POST /api/musician-messaging/contracts/:id/accept
 * POST /api/musician-messaging/contracts/:id/reject
 */
router.post('/contracts/:id/:action', isAuthenticated, async (req, res) => {
  try {
    const contractId = Number(req.params.id);
    const action = req.params.action;
    if (!contractId || !['accept', 'reject', 'complete'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }

    const clerkUserId = (req as any).user?.id as string;
    const userEmail = (req as any).user?.email as string | undefined;
    const pgUserId = await resolvePgUserId(clerkUserId);
    if (!pgUserId) return res.status(401).json({ success: false, error: 'User not found' });

    const [contract] = await db
      .select()
      .from(musicianServiceContracts)
      .where(eq(musicianServiceContracts.id, contractId))
      .limit(1);
    if (!contract) return res.status(404).json({ success: false, error: 'Contract not found' });

    const access = await getConversationAndRole(contract.conversationId, pgUserId, userEmail);
    if (!access) return res.status(403).json({ success: false, error: 'Not authorized' });

    const patch: Record<string, any> = { updatedAt: new Date() };
    const now = new Date();
    if (action === 'accept') {
      patch.status = 'accepted';
      patch.acceptedAt = now;
      patch.acceptedByUserId = pgUserId;
    } else if (action === 'reject') {
      patch.status = 'rejected';
      patch.rejectedAt = now;
    } else if (action === 'complete') {
      patch.status = 'completed';
      patch.completedAt = now;
    }
    const [updated] = await db
      .update(musicianServiceContracts)
      .set(patch)
      .where(eq(musicianServiceContracts.id, contractId))
      .returning();

    const eventBody = action === 'accept'
      ? `✅ Contract accepted: ${contract.title}`
      : action === 'reject'
        ? `❌ Contract rejected: ${contract.title}`
        : `🎉 Contract completed: ${contract.title}`;
    await db.insert(musicianMessages).values({
      conversationId: contract.conversationId,
      senderRole: 'system',
      senderUserId: pgUserId,
      type: 'system_event',
      body: eventBody,
      metadata: { contractId, action },
      readByClient: true,
      readByMusician: true,
    });
    await db.update(musicianConversations).set({
      lastMessagePreview: eventBody,
      lastMessageAt: now,
      updatedAt: now,
    }).where(eq(musicianConversations.id, contract.conversationId));

    return res.json({ success: true, contract: updated });
  } catch (err: any) {
    console.error('[musician-messaging] contract action failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Contract action failed' });
  }
});

/**
 * GET /api/musician-messaging/unread-count — quick badge
 */
router.get('/unread-count', isAuthenticated, async (req, res) => {
  try {
    const clerkUserId = (req as any).user?.id as string;
    const pgUserId = await resolvePgUserId(clerkUserId);
    if (!pgUserId) return res.json({ success: true, total: 0 });

    const rows = await db
      .select({
        clientUnreadCount: musicianConversations.clientUnreadCount,
        musicianUnreadCount: musicianConversations.musicianUnreadCount,
        clientUserId: musicianConversations.clientUserId,
        musicianUserId: musicianConversations.musicianUserId,
      })
      .from(musicianConversations)
      .where(
        or(
          eq(musicianConversations.clientUserId, pgUserId),
          eq(musicianConversations.musicianUserId, pgUserId),
        ),
      );
    const total = rows.reduce((acc, r) => {
      if (r.clientUserId === pgUserId) return acc + (r.clientUnreadCount || 0);
      if (r.musicianUserId === pgUserId) return acc + (r.musicianUnreadCount || 0);
      return acc;
    }, 0);
    return res.json({ success: true, total });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to count unread' });
  }
});

export default router;
