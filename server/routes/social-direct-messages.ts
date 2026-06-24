/**
 * Social Network — Direct Messages backend
 * ----------------------------------------------------------------
 * Real DM persistence so conversations actually round-trip between
 * users. Replaces the previous localStorage-only client component.
 *
 * Endpoints (mounted under /api/social/dm):
 *   GET  /conversations               → list of conversations + last msg
 *   GET  /conversations/:partnerId    → messages with one partner
 *   POST /messages                    → send { recipientId, content }
 *   POST /conversations/:partnerId/read → mark partner thread read
 *   GET  /unread-count                → integer
 *
 * All routes require `authenticate` so we trust `req.user.id`.
 *
 * The single `social_direct_messages` table is bootstrapped lazily on
 * first request (CREATE IF NOT EXISTS), matching the AIAPS pattern
 * already used by other modules in this codebase.
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

let bootstrapped = false;
async function ensureTable(): Promise<void> {
  if (bootstrapped) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_direct_messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id VARCHAR(128) NOT NULL,
      sender_id VARCHAR(64) NOT NULL,
      sender_name VARCHAR(255),
      sender_avatar TEXT,
      recipient_id VARCHAR(64) NOT NULL,
      recipient_name VARCHAR(255),
      recipient_avatar TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_sdm_convo_created ON social_direct_messages (conversation_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sdm_recipient_unread ON social_direct_messages (recipient_id) WHERE read_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_sdm_sender ON social_direct_messages (sender_id, created_at DESC);
  `);
  bootstrapped = true;
}

function makeConvoId(a: string, b: string): string {
  return [String(a), String(b)].sort().join(':');
}

function rowToMsg(r: any) {
  return {
    id: String(r.id),
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderName: r.sender_name || '',
    senderAvatar: r.sender_avatar || null,
    recipientId: r.recipient_id,
    recipientName: r.recipient_name || '',
    recipientAvatar: r.recipient_avatar || null,
    content: r.content,
    createdAt: new Date(r.created_at).getTime(),
    read: !!r.read_at,
    readAt: r.read_at ? new Date(r.read_at).getTime() : null,
  };
}

// ─── List conversations for current user ─────────────────────────
router.get('/conversations', authenticate, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const myId = String(req.user!.id);
    // Last message per conversation + unread count, joined.
    const { rows } = await pool.query(
      `
      WITH ranked AS (
        SELECT m.*,
          ROW_NUMBER() OVER (PARTITION BY m.conversation_id ORDER BY m.created_at DESC) AS rn
        FROM social_direct_messages m
        WHERE m.sender_id = $1 OR m.recipient_id = $1
      ),
      unread AS (
        SELECT conversation_id, COUNT(*)::int AS unread_count
        FROM social_direct_messages
        WHERE recipient_id = $1 AND read_at IS NULL
        GROUP BY conversation_id
      )
      SELECT r.*, COALESCE(u.unread_count, 0) AS unread_count
      FROM ranked r
      LEFT JOIN unread u ON u.conversation_id = r.conversation_id
      WHERE r.rn = 1
      ORDER BY r.created_at DESC
      LIMIT 200
      `,
      [myId],
    );

    const conversations = rows.map((r: any) => {
      const partnerId = r.sender_id === myId ? r.recipient_id : r.sender_id;
      const partnerName = r.sender_id === myId ? (r.recipient_name || '') : (r.sender_name || '');
      const partnerAvatar = r.sender_id === myId ? r.recipient_avatar : r.sender_avatar;
      return {
        id: r.conversation_id,
        partnerId,
        partnerName,
        partnerAvatar: partnerAvatar || null,
        lastMessage: r.content,
        lastMessageAt: new Date(r.created_at).getTime(),
        unreadCount: r.unread_count || 0,
      };
    });

    res.json({ conversations });
  } catch (err: any) {
    console.error('[DM] /conversations error:', err);
    res.status(500).json({ error: err?.message || 'Failed to load conversations' });
  }
});

// ─── Messages with a single partner ───────────────────────────────
router.get('/conversations/:partnerId', authenticate, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const myId = String(req.user!.id);
    const partnerId = String(req.params.partnerId);
    const convoId = makeConvoId(myId, partnerId);

    const { rows } = await pool.query(
      `SELECT * FROM social_direct_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 500`,
      [convoId],
    );

    res.json({ conversationId: convoId, messages: rows.map(rowToMsg) });
  } catch (err: any) {
    console.error('[DM] /conversations/:partnerId error:', err);
    res.status(500).json({ error: err?.message || 'Failed to load messages' });
  }
});

// ─── Send a message ───────────────────────────────────────────────
router.post('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const myId = String(req.user!.id);
    const myName = (req as any).user?.artistName || (req as any).user?.firstName || (req as any).user?.email?.split('@')[0] || '';
    const myAvatar = (req as any).user?.profileImage || (req as any).user?.profileImageUrl || null;

    const {
      recipientId,
      recipientName,
      recipientAvatar,
      content,
      senderName,
      senderAvatar,
    } = req.body || {};

    if (!recipientId || !content) {
      return res.status(400).json({ error: 'recipientId and content are required' });
    }
    const text = String(content).trim();
    if (!text) {
      return res.status(400).json({ error: 'content cannot be empty' });
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: 'content too long (max 4000)' });
    }
    const partnerId = String(recipientId);
    if (partnerId === myId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    const convoId = makeConvoId(myId, partnerId);
    const { rows } = await pool.query(
      `INSERT INTO social_direct_messages
        (conversation_id, sender_id, sender_name, sender_avatar,
         recipient_id, recipient_name, recipient_avatar, content)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        convoId,
        myId,
        senderName || myName || null,
        senderAvatar || myAvatar || null,
        partnerId,
        recipientName || null,
        recipientAvatar || null,
        text,
      ],
    );

    res.json({ message: rowToMsg(rows[0]) });
  } catch (err: any) {
    console.error('[DM] POST /messages error:', err);
    res.status(500).json({ error: err?.message || 'Failed to send message' });
  }
});

// ─── Mark a partner thread as read ────────────────────────────────
router.post('/conversations/:partnerId/read', authenticate, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const myId = String(req.user!.id);
    const partnerId = String(req.params.partnerId);
    const convoId = makeConvoId(myId, partnerId);

    const { rowCount } = await pool.query(
      `UPDATE social_direct_messages
         SET read_at = NOW()
       WHERE conversation_id = $1
         AND recipient_id = $2
         AND read_at IS NULL`,
      [convoId, myId],
    );
    res.json({ success: true, marked: rowCount || 0 });
  } catch (err: any) {
    console.error('[DM] /read error:', err);
    res.status(500).json({ error: err?.message || 'Failed to mark read' });
  }
});

// ─── Total unread count ───────────────────────────────────────────
router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const myId = String(req.user!.id);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
         FROM social_direct_messages
        WHERE recipient_id = $1 AND read_at IS NULL`,
      [myId],
    );
    res.json({ count: rows[0]?.count || 0 });
  } catch (err: any) {
    console.error('[DM] /unread-count error:', err);
    res.status(500).json({ error: err?.message || 'Failed to load unread count' });
  }
});

export default router;
