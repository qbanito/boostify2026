/**
 * 🛡️ Artist Agent Gateway — REST API
 *
 * Mount: /api/agent-gateway
 *
 * Public endpoints (no auth):
 *  - GET  /:artistId/config          → public gateway config
 *  - GET  /:artistId/agents          → list active agents (public info)
 *  - POST /:artistId/start           → start a new conversation
 *  - POST /:conversationId/message   → send message in conversation
 *  - GET  /:conversationId/messages  → get conversation history
 *  - GET  /status/:conversationId    → check request status
 *
 * Owner endpoints (auth + ownership):
 *  - GET  /:artistId/console/requests              → list all requests
 *  - GET  /:artistId/console/request/:requestId    → full request detail
 *  - POST /:artistId/console/approve/:requestId    → approve
 *  - POST /:artistId/console/reject/:requestId     → reject
 *  - PUT  /:artistId/console/config                → update config
 *  - GET  /:artistId/console/agents                → list agents
 *  - GET  /:artistId/console/approvals             → pending approvals
 *  - GET  /:artistId/console/stats                 → pipeline stats
 */
import { Router, type Request, type Response } from 'express';
import { isAuthenticated } from '../middleware/clerk-auth';
import { logger } from '../utils/logger';
import { db } from '../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import {
  startConversation,
  sendMessage,
  getConversation,
  listRequests,
  approveRequest,
  rejectRequest,
  getConfig,
  updateConfig,
  listAgents,
  listPendingApprovals,
  getStats,
} from '../services/gateway-engine';

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseArtistId(req: Request): number {
  const id = parseInt(req.params.artistId, 10);
  if (!Number.isFinite(id)) throw new Error('Invalid artistId');
  return id;
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: GET /:artistId/config
// ─────────────────────────────────────────────────────────────────────────
router.get('/:artistId/config', async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const config = await getConfig(artistId);
    // Return only public-facing config
    res.json({
      ok: true,
      config: {
        communicationMode: config?.communicationMode || 'agents_only',
        gatewayEnabled: config?.gatewayEnabled ?? true,
        welcomeMessage: config?.welcomeMessage,
        publicEmailVisible: config?.publicEmailVisible ?? false,
      },
    });
  } catch (err: any) {
    logger.error('[AgentGateway] GET config failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: GET /:artistId/agents
// ─────────────────────────────────────────────────────────────────────────
router.get('/:artistId/agents', async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const agents = await listAgents(artistId);
    // Return only public info
    const publicAgents = agents.filter(a => a.isActive).map(a => ({
      agentType: a.agentType,
      name: a.name,
      description: a.description,
    }));
    res.json({ ok: true, agents: publicAgents });
  } catch (err: any) {
    logger.error('[AgentGateway] GET agents failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /:artistId/start
// ─────────────────────────────────────────────────────────────────────────
router.post('/:artistId/start', async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const { intent, senderName, senderEmail, senderCompany, senderType, initialMessage } = req.body || {};

    if (!intent) {
      return res.status(400).json({ ok: false, error: 'intent is required' });
    }

    // Resolve clerk user id if logged in
    const clerkUserId = (req as any).auth?.userId || (req as any).user?.clerkUserId || null;

    const result = await startConversation({
      artistId,
      intent,
      senderName,
      senderEmail,
      senderCompany,
      senderType,
      senderClerkId: clerkUserId,
      initialMessage,
    });

    res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.error('[AgentGateway] POST start failed', { error: err?.message });
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /:conversationId/message
// ─────────────────────────────────────────────────────────────────────────
router.post('/:conversationId/message', async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId;
    const { content } = req.body || {};

    if (!content) {
      return res.status(400).json({ ok: false, error: 'content is required' });
    }

    const result = await sendMessage({ conversationId, content });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.error('[AgentGateway] POST message failed', { error: err?.message });
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: GET /:conversationId/messages
// ─────────────────────────────────────────────────────────────────────────
router.get('/:conversationId/messages', async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId;
    const result = await getConversation(conversationId);
    if (!result) return res.status(404).json({ ok: false, error: 'Conversation not found' });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.error('[AgentGateway] GET messages failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: GET /status/:conversationId
// ─────────────────────────────────────────────────────────────────────────
router.get('/status/:conversationId', async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId;
    const result = await getConversation(conversationId);
    if (!result) return res.status(404).json({ ok: false, error: 'Conversation not found' });
    const { request } = result;
    res.json({
      ok: true,
      status: request.status,
      opportunityScore: request.opportunityScore,
      riskLevel: request.riskLevel,
      agentRecommendation: request.agentRecommendation,
      lastActivity: request.updatedAt,
    });
  } catch (err: any) {
    logger.error('[AgentGateway] GET status failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: GET /:artistId/console/requests
// ─────────────────────────────────────────────────────────────────────────
router.get('/:artistId/console/requests', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const requests = await listRequests(artistId, status, limit);
    res.json({ ok: true, requests });
  } catch (err: any) {
    logger.error('[AgentGateway] GET console/requests failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: POST /:artistId/console/approve/:requestId
// ─────────────────────────────────────────────────────────────────────────
router.post('/:artistId/console/approve/:requestId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const requestId = parseInt(req.params.requestId, 10);
    const { note, conditions } = req.body || {};
    const result = await approveRequest(requestId, artistId, note, conditions);
    res.json(result);
  } catch (err: any) {
    logger.error('[AgentGateway] POST approve failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: POST /:artistId/console/reject/:requestId
// ─────────────────────────────────────────────────────────────────────────
router.post('/:artistId/console/reject/:requestId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const requestId = parseInt(req.params.requestId, 10);
    const { note } = req.body || {};
    const result = await rejectRequest(requestId, artistId, note);
    res.json(result);
  } catch (err: any) {
    logger.error('[AgentGateway] POST reject failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: PUT /:artistId/console/config
// ─────────────────────────────────────────────────────────────────────────
router.put('/:artistId/console/config', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    await updateConfig(artistId, req.body);
    const config = await getConfig(artistId);
    res.json({ ok: true, config });
  } catch (err: any) {
    logger.error('[AgentGateway] PUT config failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: GET /:artistId/console/agents
// ─────────────────────────────────────────────────────────────────────────
router.get('/:artistId/console/agents', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const agents = await listAgents(artistId);
    res.json({ ok: true, agents });
  } catch (err: any) {
    logger.error('[AgentGateway] GET console/agents failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: GET /:artistId/console/approvals
// ─────────────────────────────────────────────────────────────────────────
router.get('/:artistId/console/approvals', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const approvals = await listPendingApprovals(artistId);
    res.json({ ok: true, approvals });
  } catch (err: any) {
    logger.error('[AgentGateway] GET console/approvals failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: GET /:artistId/console/stats
// ─────────────────────────────────────────────────────────────────────────
router.get('/:artistId/console/stats', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const stats = await getStats(artistId);
    res.json({ ok: true, stats });
  } catch (err: any) {
    logger.error('[AgentGateway] GET console/stats failed', { error: err?.message });
    res.status(400).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: POST /:artistId/console/test-email — verify email configuration
// ─────────────────────────────────────────────────────────────────────────
router.post('/:artistId/console/test-email', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const { testEmail } = req.body || {};
    if (!testEmail) {
      return res.status(400).json({ ok: false, error: 'testEmail is required' });
    }

    const { sendConversationSummary } = await import('../services/gateway-email');
    const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
    const artistName = (artist as any)?.artistName || (artist as any)?.username || 'Artist';

    const result = await sendConversationSummary({
      artistName,
      artistId,
      ownerEmail: testEmail,
      agentType: 'manager',
      conversationId: 'test-conv-001',
      senderName: 'Test Sender',
      senderEmail: testEmail,
      senderCompany: 'Test Company',
      intent: 'brand_collaboration',
      status: 'qualified',
      opportunityScore: 85,
      riskLevel: 'low',
      estimatedValueMin: 5000,
      estimatedValueMax: 15000,
      agentRecommendation: 'This is a test email to verify the gateway email system is working correctly.',
      messageCount: 3,
      lastMessage: 'This is a test message to verify email delivery.',
      collectedData: { budget: '$10,000', territory: 'Worldwide', duration: '6 months' },
    });

    res.json({ ok: true, result });
  } catch (err: any) {
    logger.error('[AgentGateway] POST test-email failed', { error: err?.message });
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: POST /:artistId/console/send-summary/:conversationId
// Manually trigger a conversation summary email
// ─────────────────────────────────────────────────────────────────────────
router.post('/:artistId/console/send-summary/:conversationId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const conversationId = req.params.conversationId;

    const { sendConversationSummary } = await import('../services/gateway-email');
    const { getConversation } = await import('../services/gateway-engine');

    const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
    if (!artist) return res.status(404).json({ ok: false, error: 'Artist not found' });

    const ownerEmail = (artist as any).email;
    if (!ownerEmail) return res.status(400).json({ ok: false, error: 'Artist has no email configured' });

    const convo = await getConversation(conversationId);
    if (!convo) return res.status(404).json({ ok: false, error: 'Conversation not found' });

    const { request, messages } = convo;
    const lastMsg = messages[messages.length - 1];

    const result = await sendConversationSummary({
      artistName: (artist as any).artistName || (artist as any).username || 'Artist',
      artistId,
      ownerEmail,
      agentType: request.agentType,
      conversationId,
      senderName: request.senderName || 'Unknown',
      senderEmail: request.senderEmail || '',
      senderCompany: request.senderCompany || undefined,
      intent: request.intent,
      status: request.status,
      opportunityScore: request.opportunityScore || undefined,
      riskLevel: request.riskLevel,
      estimatedValueMin: request.estimatedValueMin ? parseFloat(request.estimatedValueMin) : undefined,
      estimatedValueMax: request.estimatedValueMax ? parseFloat(request.estimatedValueMax) : undefined,
      agentRecommendation: request.agentRecommendation || undefined,
      messageCount: messages.length,
      lastMessage: lastMsg?.content || '',
      collectedData: (request.collectedData as Record<string, any>) || {},
    });

    res.json({ ok: true, result });
  } catch (err: any) {
    logger.error('[AgentGateway] POST send-summary failed', { error: err?.message });
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OWNER: GET /:artistId/console/email-diagnostics — check email config
// ─────────────────────────────────────────────────────────────────────────
router.get('/:artistId/console/email-diagnostics', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseArtistId(req);
    const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);

    const brevoKey = process.env.BREVO_API_KEY || '';
    const resendKey = process.env.RESEND_API_KEY || '';

    res.json({
      ok: true,
      diagnostics: {
        brevoConfigured: !!brevoKey,
        brevoKeyLength: brevoKey.length,
        resendConfigured: !!resendKey,
        resendKeyLength: resendKey.length,
        artistEmail: (artist as any)?.email || null,
        artistName: (artist as any)?.artistName || (artist as any)?.username || null,
        verifiedSender: 'info@boostifymusic.com',
        agentRoutingEmails: {
          booking: 'booking@boostifymusic.com',
          deals: 'deals@boostifymusic.com',
          licensing: 'licensing@boostifymusic.com',
          press: 'press@boostifymusic.com',
          collab: 'collab@boostifymusic.com',
          manager: 'manager@boostifymusic.com',
          gateway: 'gateway@boostifymusic.com',
        },
      },
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message });
  }
});

export default router;
