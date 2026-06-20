/**
 * 🛡️ Artist Protection Layer
 *
 * Filters spam, detects scams, blocks exploitation, enforces thresholds.
 * Every incoming request passes through this layer before reaching an agent.
 */
import { db } from '../db';
import { agentGatewayConfig, agentExternalContacts, agentGatewayRequests, agentGatewayAuditLog } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

export interface ProtectionResult {
  allowed: boolean;
  reason?: string;
  riskFlags: string[];
  trustScore: number;
}

// Known spam patterns
const SPAM_PATTERNS = [
  /buy followers/i,
  /get rich quick/i,
  /nigerian prince/i,
  /click here now/i,
  /free promotion/i,
  /exposed\./i,
  /crypto.*guaranteed/i,
  /make \$?\d+.*per day/i,
  /act now.*limited/i,
];

// Suspicious email domains
const SUSPICIOUS_DOMAINS = [
  'tempmail.com', 'throwaway.email', 'guerrillamail.com',
  'mailinator.com', 'yopmail.com', 'trashmail.com',
];

/**
 * Run all protection checks on an incoming request.
 */
export async function runProtectionChecks(input: {
  artistId: number;
  senderEmail?: string;
  senderName?: string;
  senderCompany?: string;
  initialMessage?: string;
  intent: string;
}): Promise<ProtectionResult> {
  const riskFlags: string[] = [];
  let trustScore = 50;

  // 1. Load artist protection config
  const [config] = await db.select().from(agentGatewayConfig)
    .where(eq(agentGatewayConfig.artistId, input.artistId)).limit(1);

  const rules = (config?.protectionRules as Record<string, any>) || {};
  const minBudget = rules.min_budget_threshold || 100;
  const maxPerDay = rules.max_requests_per_sender_per_day || 5;

  // 2. Check for spam patterns in message
  if (input.initialMessage) {
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(input.initialMessage)) {
        riskFlags.push('spam_pattern_detected');
        trustScore -= 30;
        break;
      }
    }
  }

  // 3. Check suspicious email domains
  if (input.senderEmail) {
    const domain = input.senderEmail.split('@')[1]?.toLowerCase();
    if (domain && SUSPICIOUS_DOMAINS.includes(domain)) {
      riskFlags.push('suspicious_email_domain');
      trustScore -= 20;
    }
  }

  // 4. Check rate limiting (same sender, same day)
  if (input.senderEmail) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recentCount = await db.select({ count: sql<number>`count(*)` })
      .from(agentGatewayRequests)
      .where(and(
        eq(agentGatewayRequests.artistId, input.artistId),
        eq(agentGatewayRequests.senderEmail, input.senderEmail),
        sql`${agentGatewayRequests.createdAt} >= ${today.toISOString()}`,
      ));

    const count = recentCount[0]?.count || 0;
    if (count >= maxPerDay) {
      riskFlags.push('rate_limit_exceeded');
      trustScore -= 25;
    }
  }

  // 5. Check blocked contacts
  if (input.senderEmail) {
    const [contact] = await db.select().from(agentExternalContacts)
      .where(and(
        eq(agentExternalContacts.artistId, input.artistId),
        eq(agentExternalContacts.email, input.senderEmail),
      )).limit(1);

    if (contact) {
      trustScore = contact.trustScore;
      if (contact.trustScore < 20) {
        riskFlags.push('blocked_contact');
      }
      if (contact.totalRequests > 10 && contact.totalValue === 0) {
        riskFlags.push('repeat_non_converter');
        trustScore -= 10;
      }
    }
  }

  // 6. Check for missing critical info
  if (!input.senderName || input.senderName.trim().length < 2) {
    riskFlags.push('missing_sender_name');
    trustScore -= 10;
  }

  // 7. Check blocked keywords in rules
  const blockedKeywords: string[] = rules.blocked_keywords || [];
  if (input.initialMessage) {
    for (const keyword of blockedKeywords) {
      if (input.initialMessage.toLowerCase().includes(keyword.toLowerCase())) {
        riskFlags.push('blocked_keyword');
        trustScore -= 15;
        break;
      }
    }
  }

  // 8. Check blocked domains in rules
  const blockedDomains: string[] = rules.blocked_domains || [];
  if (input.senderEmail) {
    const domain = input.senderEmail.split('@')[1]?.toLowerCase();
    if (domain && blockedDomains.includes(domain)) {
      riskFlags.push('blocked_domain');
      trustScore -= 40;
    }
  }

  // Decision
  trustScore = Math.max(0, Math.min(100, trustScore));
  const allowed = trustScore >= 20 && !riskFlags.includes('blocked_contact') && !riskFlags.includes('blocked_domain');

  if (!allowed) {
    // Log the blocked attempt
    await db.insert(agentGatewayAuditLog).values({
      artistId: input.artistId,
      action: 'request_blocked',
      actorType: 'system',
      details: { riskFlags, trustScore, senderEmail: input.senderEmail },
    }).catch(() => {});
  }

  return { allowed, reason: allowed ? undefined : `Request blocked: ${riskFlags.join(', ')}`, riskFlags, trustScore };
}
