/**
 * 🛡️ Gateway Engine — Core routing, classification, and orchestration
 *
 * Routes incoming requests to the appropriate agent, manages conversations,
 * handles scoring, protection, and approval workflows.
 * Phase 2+3: Full agent team, protection layer, email notifications.
 */
import { randomUUID } from 'crypto';
import { db } from '../db';
import {
  agentGatewayConfig, artistAgents, agentGatewayRequests,
  agentGatewayMessages, agentApprovalQueue, agentGatewayAuditLog,
  agentExternalContacts, users,
} from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { callAI, type ChatMessage } from '../utils/smart-ai';

import { BaseGatewayAgent, type AgentContext, type AgentResponse } from './gateway-agents/base-agent';
import { FanRelationsAgent } from './gateway-agents/fan-relations-agent';
import { BookingAgent } from './gateway-agents/booking-agent';
import { LicensingAgent } from './gateway-agents/licensing-agent';
import { BrandDealsAgent } from './gateway-agents/brand-deals-agent';
import { CollaborationAgent } from './gateway-agents/collaboration-agent';
import { PressAgent } from './gateway-agents/press-agent';
import { ManagerAgent } from './gateway-agents/manager-agent';
import { LegalGuardAgent } from './gateway-agents/legal-guard-agent';
import { FinanceAgent } from './gateway-agents/finance-agent';
import { runProtectionChecks } from './gateway-protection';
import {
  notifyOwnerNewOpportunity,
  notifySenderConfirmation,
  notifyOwnerApprovalNeeded,
  notifySenderApproved,
  notifySenderRejected,
  sendConversationSummary,
  type GatewayEmailData,
} from './gateway-email';

// ─── Agent Registry ────────────────────────────────────────────────────────

const agentRegistry: Record<string, () => BaseGatewayAgent> = {
  fan_relations: () => new FanRelationsAgent(),
  booking: () => new BookingAgent(),
  licensing: () => new LicensingAgent(),
  brand_deals: () => new BrandDealsAgent(),
  collaboration: () => new CollaborationAgent(),
  press: () => new PressAgent(),
  manager: () => new ManagerAgent(),
  legal_guard: () => new LegalGuardAgent(),
  finance: () => new FinanceAgent(),
};

// ─── Intent Classification ─────────────────────────────────────────────────

const INTENT_MAP: Record<string, { agentType: string; senderType: string }> = {
  'book': { agentType: 'booking', senderType: 'promoter' },
  'booking': { agentType: 'booking', senderType: 'promoter' },
  'event': { agentType: 'booking', senderType: 'promoter' },
  'show': { agentType: 'booking', senderType: 'promoter' },
  'license': { agentType: 'licensing', senderType: 'supervisor' },
  'licensing': { agentType: 'licensing', senderType: 'supervisor' },
  'sync': { agentType: 'licensing', senderType: 'supervisor' },
  'brand': { agentType: 'brand_deals', senderType: 'brand' },
  'partnership': { agentType: 'brand_deals', senderType: 'brand' },
  'endorsement': { agentType: 'brand_deals', senderType: 'brand' },
  'collaborate': { agentType: 'collaboration', senderType: 'producer' },
  'collaboration': { agentType: 'collaboration', senderType: 'producer' },
  'feature': { agentType: 'collaboration', senderType: 'producer' },
  'press': { agentType: 'press', senderType: 'press' },
  'interview': { agentType: 'press', senderType: 'press' },
  'media': { agentType: 'press', senderType: 'press' },
  'fan': { agentType: 'fan_relations', senderType: 'fan' },
  'message': { agentType: 'fan_relations', senderType: 'fan' },
  'hello': { agentType: 'fan_relations', senderType: 'fan' },
  'hi': { agentType: 'fan_relations', senderType: 'fan' },
};

export function classifyIntent(intent: string): { agentType: string; senderType: string } {
  const normalized = intent.toLowerCase().trim();
  // Direct match
  if (INTENT_MAP[normalized]) return INTENT_MAP[normalized];
  // Partial match
  for (const [key, value] of Object.entries(INTENT_MAP)) {
    if (normalized.includes(key)) return value;
  }
  // Default to fan relations
  return { agentType: 'fan_relations', senderType: 'other' };
}

// ─── Seed Default Agents ───────────────────────────────────────────────────

const DEFAULT_AGENTS = [
  {
    agentType: 'fan_relations' as const,
    name: 'Fan Relations Agent',
    description: 'Handles fan messages, community interactions, and general inquiries.',
    systemPrompt: 'You are the Fan Relations Agent. Be warm, friendly, and professional. Answer questions about the artist, provide links to music and merch, and handle fan mail. Redirect business inquiries to the appropriate agent.',
    authorityLevel: 1,
  },
  {
    agentType: 'booking' as const,
    name: 'Booking Agent',
    description: 'Handles event bookings, shows, and appearances.',
    systemPrompt: 'You are the Booking Agent. Collect event details (date, city, venue, budget, attendance, type) and evaluate the booking opportunity. Be professional and businesslike.',
    authorityLevel: 3,
  },
  {
    agentType: 'licensing' as const,
    name: 'Licensing Agent',
    description: 'Handles music licensing and sync placement requests.',
    systemPrompt: 'You are the Licensing Agent. Collect licensing details (song, usage type, territory, duration, budget, platforms, exclusivity) and evaluate the opportunity. Be knowledgeable about music licensing.',
    authorityLevel: 3,
  },
  {
    agentType: 'brand_deals' as const,
    name: 'Brand Deals Agent',
    description: 'Handles brand partnerships and endorsement requests.',
    systemPrompt: 'You are the Brand Deals Agent. Collect brand details (company, campaign, budget, territory, duration, deliverables) and evaluate the partnership opportunity.',
    authorityLevel: 3,
  },
  {
    agentType: 'collaboration' as const,
    name: 'Collaboration Agent',
    description: 'Handles producer and artist collaboration requests.',
    systemPrompt: 'You are the Collaboration Agent. Collect collaboration details (collaborator info, genre, split terms, timeline) and evaluate the opportunity.',
    authorityLevel: 2,
  },
  {
    agentType: 'press' as const,
    name: 'Press Agent',
    description: 'Handles media requests, interviews, and press features.',
    systemPrompt: 'You are the Press Agent. Collect press details (publication, type, audience, deadline, topic) and evaluate the media opportunity.',
    authorityLevel: 2,
  },
  {
    agentType: 'manager' as const,
    name: 'Manager Agent',
    description: 'Chief of Staff — routes requests and oversees other agents.',
    systemPrompt: 'You are the Manager Agent. You oversee all other agents and handle escalated requests. Make strategic recommendations.',
    authorityLevel: 4,
  },
  {
    agentType: 'legal_guard' as const,
    name: 'Legal Guard Agent',
    description: 'Protects the artist\'s legal interests and reviews contracts.',
    systemPrompt: 'You are the Legal Guard Agent. Review contract terms, flag potentially abusive clauses, and protect the artist\'s rights.',
    authorityLevel: 4,
  },
  {
    agentType: 'finance' as const,
    name: 'Finance Agent',
    description: 'Evaluates financial aspects of opportunities.',
    systemPrompt: 'You are the Finance Agent. Evaluate budget adequacy, compare offers to market rates, and recommend pricing strategies.',
    authorityLevel: 4,
  },
];

export async function seedDefaultAgents(artistId: number): Promise<void> {
  const existing = await db.select().from(artistAgents).where(eq(artistAgents.artistId, artistId));
  if (existing.length > 0) return;

  for (const agent of DEFAULT_AGENTS) {
    await db.insert(artistAgents).values({
      artistId,
      agentType: agent.agentType,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      authorityLevel: agent.authorityLevel,
      isActive: true,
    });
  }
  logger.info('[GatewayEngine] seeded default agents', { artistId });
}

export async function seedDefaultConfig(artistId: number): Promise<void> {
  const existing = await db.select().from(agentGatewayConfig).where(eq(agentGatewayConfig.artistId, artistId));
  if (existing.length > 0) return;

  await db.insert(agentGatewayConfig).values({
    artistId,
    communicationMode: 'agents_only',
    gatewayEnabled: true,
    autoReplyEnabled: true,
    welcomeMessage: 'All communication is managed by the artist\'s AI agent team. Choose your request type to get started.',
    humanApprovalRules: {
      required_for: ['contracts', 'brand_usage', 'exclusive_rights', 'payments_above_500', 'media_interviews'],
      auto_approve_below_amount: 200,
    },
    protectionRules: {
      min_budget_threshold: 100,
      max_requests_per_sender_per_day: 5,
      require_email_verification: false,
    },
  });
  logger.info('[GatewayEngine] seeded default config', { artistId });
}

// ─── Start Conversation ────────────────────────────────────────────────────

export interface StartConversationInput {
  artistId: number;
  intent: string;
  senderName?: string;
  senderEmail?: string;
  senderCompany?: string;
  senderType?: string;
  senderClerkId?: string;
  initialMessage?: string;
}

export interface StartConversationResult {
  conversationId: string;
  agentType: string;
  agentName: string;
  welcomeMessage: string;
  requiredFields: BaseGatewayAgent['requiredFields'];
  requestId: number;
}

export async function startConversation(input: StartConversationInput): Promise<StartConversationResult> {
  // Ensure agents and config exist
  await seedDefaultConfig(input.artistId);
  await seedDefaultAgents(input.artistId);

  // Get artist info
  const [artist] = await db.select().from(users).where(eq(users.id, input.artistId)).limit(1);
  if (!artist) throw new Error(`Artist ${input.artistId} not found`);

  const artistName = (artist as any).artistName || (artist as any).username || 'Artist';

  // ── Protection Layer ──
  const protection = await runProtectionChecks({
    artistId: input.artistId,
    senderEmail: input.senderEmail,
    senderName: input.senderName,
    senderCompany: input.senderCompany,
    initialMessage: input.initialMessage,
    intent: input.intent,
  });

  if (!protection.allowed) {
    throw new Error(protection.reason || 'Request blocked by protection layer');
  }

  // Classify intent
  const classification = classifyIntent(input.intent);
  const agentType = classification.agentType;
  const senderType = input.senderType || classification.senderType;

  // Create request
  const conversationId = `conv_${randomUUID().slice(0, 12)}`;

  const [request] = await db.insert(agentGatewayRequests).values({
    artistId: input.artistId,
    agentType,
    conversationId,
    senderType: senderType as any,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    senderCompany: input.senderCompany,
    senderClerkId: input.senderClerkId,
    intent: input.intent,
    status: 'new',
    metadata: { protectionFlags: protection.riskFlags, trustScore: protection.trustScore },
  }).returning();

  // Save initial message if provided
  if (input.initialMessage) {
    await db.insert(agentGatewayMessages).values({
      requestId: request.id,
      conversationId,
      role: 'user',
      content: input.initialMessage,
    });
  }

  // Get agent instance
  const agentFactory = agentRegistry[agentType];
  const agent = agentFactory ? agentFactory() : agentRegistry['fan_relations']();

  // Generate welcome message
  const ctx: AgentContext = {
    artistId: input.artistId,
    artistName,
    artistGenre: (artist as any).genre,
    artistBio: (artist as any).biography,
    conversationHistory: input.initialMessage
      ? [{ role: 'user', content: input.initialMessage }]
      : [],
    collectedData: {},
    senderInfo: {
      name: input.senderName,
      email: input.senderEmail,
      company: input.senderCompany,
      type: senderType,
    },
  };

  const welcomeMsg = input.initialMessage
    ? `Hello ${input.senderName || 'there'}! I'm the ${agent.agentName} for ${artistName}. ${agent.description}\n\nI see you've already shared some information. Let me review it and ask any follow-up questions.`
    : `Hello ${input.senderName || 'there'}! I'm the ${agent.agentName} for ${artistName}. ${agent.description}\n\nTo get started, I'll need some information about your request. Let me ask you a few questions.`;

  // Save agent welcome message
  await db.insert(agentGatewayMessages).values({
    requestId: request.id,
    conversationId,
    role: 'agent',
    agentType,
    content: welcomeMsg,
    action: 'info_request',
  });

  // Update request status
  await db.update(agentGatewayRequests)
    .set({ status: 'collecting_info', updatedAt: new Date() })
    .where(eq(agentGatewayRequests.id, request.id));

  // Audit log
  await db.insert(agentGatewayAuditLog).values({
    artistId: input.artistId,
    requestId: request.id,
    action: 'conversation_started',
    actorType: 'system',
    details: { agentType, senderType, intent: input.intent, trustScore: protection.trustScore },
  });

  // Update or create external contact
  if (input.senderEmail) {
    const [existing] = await db.select().from(agentExternalContacts)
      .where(and(
        eq(agentExternalContacts.artistId, input.artistId),
        eq(agentExternalContacts.email, input.senderEmail),
      )).limit(1);

    if (existing) {
      await db.update(agentExternalContacts)
        .set({ totalRequests: existing.totalRequests + 1, updatedAt: new Date() })
        .where(eq(agentExternalContacts.id, existing.id));
    } else {
      await db.insert(agentExternalContacts).values({
        artistId: input.artistId,
        name: input.senderName || 'Unknown',
        email: input.senderEmail,
        company: input.senderCompany,
        contactType: senderType as any,
        totalRequests: 1,
      });
    }
  }

  // ── Email Notifications (fire-and-forget) ──
  const ownerEmail = (artist as any).email || '';
  const emailData: GatewayEmailData = {
    artistName,
    artistId: input.artistId,
    ownerEmail,
    agentType,
    conversationId,
    senderName: input.senderName || 'Unknown',
    senderEmail: input.senderEmail || '',
    senderCompany: input.senderCompany,
    intent: input.intent,
    messagePreview: input.initialMessage,
  };

  // Notify artist owner about new opportunity (skip for fan messages)
  if (agentType !== 'fan_relations') {
    notifyOwnerNewOpportunity(emailData).catch(err =>
      logger.warn('[GatewayEngine] owner notification email failed', { error: err?.message })
    );
  }

  // Send confirmation to sender
  if (input.senderEmail) {
    notifySenderConfirmation(emailData).catch(err =>
      logger.warn('[GatewayEngine] sender confirmation email failed', { error: err?.message })
    );
  }

  return {
    conversationId,
    agentType,
    agentName: agent.agentName,
    welcomeMessage: welcomeMsg,
    requiredFields: agent.requiredFields,
    requestId: request.id,
  };
}

// ─── Send Message ──────────────────────────────────────────────────────────

export interface SendMessageInput {
  conversationId: string;
  content: string;
}

export interface SendMessageResult {
  message: AgentResponse;
  requestId: number;
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  // Get the request
  const [request] = await db.select().from(agentGatewayRequests)
    .where(eq(agentGatewayRequests.conversationId, input.conversationId))
    .limit(1);
  if (!request) throw new Error('Conversation not found');

  // Save user message
  await db.insert(agentGatewayMessages).values({
    requestId: request.id,
    conversationId: input.conversationId,
    role: 'user',
    content: input.content,
  });

  // Get conversation history
  const messages = await db.select().from(agentGatewayMessages)
    .where(eq(agentGatewayMessages.conversationId, input.conversationId))
    .orderBy(agentGatewayMessages.createdAt);

  const history: ChatMessage[] = messages.map(m => ({
    role: (m.role === 'agent' ? 'assistant' : m.role) as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // Get artist info
  const [artist] = await db.select().from(users).where(eq(users.id, request.artistId)).limit(1);

  // Get agent
  const agentFactory = agentRegistry[request.agentType];
  const agent = agentFactory ? agentFactory() : agentRegistry['fan_relations']();

  // Build context
  const ctx: AgentContext = {
    artistId: request.artistId,
    artistName: (artist as any)?.artistName || (artist as any)?.username || 'Artist',
    artistGenre: (artist as any)?.genre,
    artistBio: (artist as any)?.biography,
    conversationHistory: history,
    collectedData: (request.collectedData as Record<string, any>) || {},
    senderInfo: {
      name: request.senderName || undefined,
      email: request.senderEmail || undefined,
      company: request.senderCompany || undefined,
      type: request.senderType,
    },
  };

  // Process message through agent
  const response = await agent.processMessage(ctx);

  // Update collected data
  if (response.collectedUpdates) {
    const merged = { ...ctx.collectedData, ...response.collectedUpdates };
    await db.update(agentGatewayRequests)
      .set({ collectedData: merged, updatedAt: new Date() })
      .where(eq(agentGatewayRequests.id, request.id));
  }

  // Update request with scoring
  const updates: any = { updatedAt: new Date() };
  if (response.opportunityScore !== undefined) updates.opportunityScore = response.opportunityScore;
  if (response.riskLevel) updates.riskLevel = response.riskLevel;
  if (response.requiresHumanApproval !== undefined) updates.requiresHumanApproval = response.requiresHumanApproval;
  if (response.estimatedValueMin) updates.estimatedValueMin = String(response.estimatedValueMin);
  if (response.estimatedValueMax) updates.estimatedValueMax = String(response.estimatedValueMax);
  if (response.recommendation) updates.agentRecommendation = response.recommendation;

  // Update status based on action
  if (response.action === 'info_request') updates.status = 'collecting_info';
  else if (response.action === 'qualification') updates.status = 'qualified';
  else if (response.action === 'negotiation') updates.status = 'negotiating';
  else if (response.action === 'approval_request') {
    updates.status = 'pending_approval';
    // Create approval queue entry
    await db.insert(agentApprovalQueue).values({
      requestId: request.id,
      artistId: request.artistId,
      approvalType: 'custom',
      agentRecommendation: response.recommendation || 'Requires human review',
      agentProposedAction: response.action,
      riskAssessment: { riskLevel: response.riskLevel, score: response.opportunityScore },
      status: 'pending',
    });

    // Send approval-needed email to owner
    const artistName = (artist as any)?.artistName || (artist as any)?.username || 'Artist';
    const ownerEmail = (artist as any)?.email || '';
    notifyOwnerApprovalNeeded({
      artistName,
      artistId: request.artistId,
      ownerEmail,
      agentType: request.agentType,
      conversationId: input.conversationId,
      senderName: request.senderName || 'Unknown',
      senderEmail: request.senderEmail || '',
      senderCompany: request.senderCompany || undefined,
      intent: request.intent,
      opportunityScore: response.opportunityScore,
      riskLevel: response.riskLevel,
      estimatedValueMin: response.estimatedValueMin,
      estimatedValueMax: response.estimatedValueMax,
      agentRecommendation: response.recommendation,
      approvalType: 'custom',
    }).catch(err =>
      logger.warn('[GatewayEngine] approval email failed', { error: err?.message })
    );
  }

  await db.update(agentGatewayRequests)
    .set(updates)
    .where(eq(agentGatewayRequests.id, request.id));

  // Save agent response
  await db.insert(agentGatewayMessages).values({
    requestId: request.id,
    conversationId: input.conversationId,
    role: 'agent',
    agentType: request.agentType,
    content: response.message,
    action: response.action,
    structuredData: response.structuredData,
  });

  // Audit log
  await db.insert(agentGatewayAuditLog).values({
    artistId: request.artistId,
    requestId: request.id,
    action: `agent_response:${response.action}`,
    actorType: 'agent',
    actorDetail: request.agentType,
    details: { score: response.opportunityScore, risk: response.riskLevel },
  });

  // ── Send conversation summary to owner after significant events ──
  // Send summary when: qualification, negotiation, or every 5 messages
  const shouldSendSummary =
    response.action === 'qualification' ||
    response.action === 'negotiation' ||
    response.action === 'approval_request' ||
    messages.length % 5 === 0;

  if (shouldSendSummary && artist) {
    const ownerEmail = (artist as any).email || '';
    if (ownerEmail) {
      const mergedData = response.collectedUpdates
        ? { ...(request.collectedData as Record<string, any> || {}), ...response.collectedUpdates }
        : (request.collectedData as Record<string, any> || {});

      sendConversationSummary({
        artistName: (artist as any)?.artistName || (artist as any)?.username || 'Artist',
        artistId: request.artistId,
        ownerEmail,
        agentType: request.agentType,
        conversationId: input.conversationId,
        senderName: request.senderName || 'Unknown',
        senderEmail: request.senderEmail || '',
        senderCompany: request.senderCompany || undefined,
        intent: request.intent,
        status: updates.status || request.status,
        opportunityScore: response.opportunityScore || request.opportunityScore || undefined,
        riskLevel: response.riskLevel || request.riskLevel,
        estimatedValueMin: response.estimatedValueMin || (request.estimatedValueMin ? parseFloat(request.estimatedValueMin) : undefined),
        estimatedValueMax: response.estimatedValueMax || (request.estimatedValueMax ? parseFloat(request.estimatedValueMax) : undefined),
        agentRecommendation: response.recommendation || request.agentRecommendation || undefined,
        messageCount: messages.length + 1,
        lastMessage: input.content,
        collectedData: mergedData,
      }).catch(err =>
        logger.warn('[GatewayEngine] conversation summary email failed', { error: err?.message })
      );
    }
  }

  return { message: response, requestId: request.id };
}

// ─── Get Conversation ──────────────────────────────────────────────────────

export async function getConversation(conversationId: string) {
  const [request] = await db.select().from(agentGatewayRequests)
    .where(eq(agentGatewayRequests.conversationId, conversationId))
    .limit(1);
  if (!request) return null;

  const messages = await db.select().from(agentGatewayMessages)
    .where(eq(agentGatewayMessages.conversationId, conversationId))
    .orderBy(agentGatewayMessages.createdAt);

  return { request, messages };
}

// ─── Owner Console: List Requests ──────────────────────────────────────────

export async function listRequests(artistId: number, status?: string, limit = 20) {
  const conditions = [eq(agentGatewayRequests.artistId, artistId)];
  if (status) conditions.push(eq(agentGatewayRequests.status, status as any));

  const rows = await db.select().from(agentGatewayRequests)
    .where(and(...conditions))
    .orderBy(desc(agentGatewayRequests.createdAt))
    .limit(limit);

  return rows;
}

// ─── Owner Console: Approve / Reject ───────────────────────────────────────

export async function approveRequest(requestId: number, artistId: number, note?: string, conditions?: Record<string, any>) {
  const [request] = await db.select().from(agentGatewayRequests)
    .where(and(eq(agentGatewayRequests.id, requestId), eq(agentGatewayRequests.artistId, artistId)))
    .limit(1);
  if (!request) throw new Error('Request not found');

  await db.update(agentGatewayRequests)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(agentGatewayRequests.id, requestId));

  // Update approval queue
  await db.update(agentApprovalQueue)
    .set({ status: 'approved', decisionNote: note, decidedAt: new Date() })
    .where(eq(agentApprovalQueue.requestId, requestId));

  // Send system message
  await db.insert(agentGatewayMessages).values({
    requestId,
    conversationId: request.conversationId,
    role: 'system',
    content: `This opportunity has been approved by the artist's team.${note ? ` Note: ${note}` : ''}`,
    action: 'executed',
  });

  // Audit log
  await db.insert(agentGatewayAuditLog).values({
    artistId,
    requestId,
    action: 'request_approved',
    actorType: 'human',
    details: { note, conditions },
  });

  // ── Email: notify sender of approval ──
  const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
  const artistName = (artist as any)?.artistName || (artist as any)?.username || 'Artist';
  if (request.senderEmail) {
    notifySenderApproved({
      artistName,
      artistId,
      agentType: request.agentType,
      conversationId: request.conversationId,
      senderName: request.senderName || 'Unknown',
      senderEmail: request.senderEmail,
      senderCompany: request.senderCompany || undefined,
      intent: request.intent,
      note,
    }).catch(err =>
      logger.warn('[GatewayEngine] approval email to sender failed', { error: err?.message })
    );
  }

  return { ok: true };
}

export async function rejectRequest(requestId: number, artistId: number, note?: string) {
  const [request] = await db.select().from(agentGatewayRequests)
    .where(and(eq(agentGatewayRequests.id, requestId), eq(agentGatewayRequests.artistId, artistId)))
    .limit(1);
  if (!request) throw new Error('Request not found');

  await db.update(agentGatewayRequests)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(agentGatewayRequests.id, requestId));

  await db.update(agentApprovalQueue)
    .set({ status: 'rejected', decisionNote: note, decidedAt: new Date() })
    .where(eq(agentApprovalQueue.requestId, requestId));

  await db.insert(agentGatewayMessages).values({
    requestId,
    conversationId: request.conversationId,
    role: 'system',
    content: `Thank you for your interest. After careful review, we are unable to proceed with this request at this time.${note ? ` ${note}` : ''}`,
    action: 'rejection',
  });

  await db.insert(agentGatewayAuditLog).values({
    artistId,
    requestId,
    action: 'request_rejected',
    actorType: 'human',
    details: { note },
  });

  // ── Email: notify sender of rejection ──
  const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
  const artistName = (artist as any)?.artistName || (artist as any)?.username || 'Artist';
  if (request.senderEmail) {
    notifySenderRejected({
      artistName,
      artistId,
      agentType: request.agentType,
      conversationId: request.conversationId,
      senderName: request.senderName || 'Unknown',
      senderEmail: request.senderEmail,
      senderCompany: request.senderCompany || undefined,
      intent: request.intent,
      note,
    }).catch(err =>
      logger.warn('[GatewayEngine] rejection email to sender failed', { error: err?.message })
    );
  }

  return { ok: true };
}

// ─── Owner Console: Get Config ─────────────────────────────────────────────

export async function getConfig(artistId: number) {
  await seedDefaultConfig(artistId);
  const [config] = await db.select().from(agentGatewayConfig)
    .where(eq(agentGatewayConfig.artistId, artistId)).limit(1);
  return config;
}

export async function updateConfig(artistId: number, updates: Partial<typeof agentGatewayConfig.$inferInsert>) {
  await db.update(agentGatewayConfig)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(agentGatewayConfig.artistId, artistId));
}

// ─── Owner Console: List Agents ────────────────────────────────────────────

export async function listAgents(artistId: number) {
  await seedDefaultAgents(artistId);
  return db.select().from(artistAgents)
    .where(eq(artistAgents.artistId, artistId))
    .orderBy(artistAgents.agentType);
}

// ─── Owner Console: Pending Approvals ──────────────────────────────────────

export async function listPendingApprovals(artistId: number) {
  return db.select().from(agentApprovalQueue)
    .where(and(
      eq(agentApprovalQueue.artistId, artistId),
      eq(agentApprovalQueue.status, 'pending'),
    ))
    .orderBy(desc(agentApprovalQueue.createdAt));
}

// ─── Owner Console: Stats ──────────────────────────────────────────────────

export async function getStats(artistId: number) {
  const all = await db.select().from(agentGatewayRequests)
    .where(eq(agentGatewayRequests.artistId, artistId));

  const byStatus: Record<string, number> = {};
  const byAgent: Record<string, number> = {};
  let totalValue = 0;

  for (const r of all) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byAgent[r.agentType] = (byAgent[r.agentType] || 0) + 1;
    if (r.estimatedValueMax) totalValue += parseFloat(r.estimatedValueMax);
  }

  return {
    totalRequests: all.length,
    byStatus,
    byAgent,
    pipelineValue: totalValue,
    pendingApprovals: byStatus['pending_approval'] || 0,
  };
}
