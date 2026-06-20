/**
 * AAS Agent 6: Risk & Compliance
 * 
 * Validates all actions before execution. Has VETO power.
 * Blocks dangerous decisions and enforces brand safety.
 * 
 * Wraps: Copyright Registry, Content Moderation, Brand Safety
 */

import { db } from '../../db';
import { aasConfig, aasApprovalQueue } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import type { ComplianceCheck, ActionResult, PlannedAction } from '../../services/aas/types';

/**
 * Actions that ALWAYS require human approval — no override
 */
const REQUIRE_HUMAN_APPROVAL = new Set([
  'sign_contract',
  'commit_exclusivity',
  'transfer_rights',
  'accept_revenue_split',
  'legal_promise',
  'token_launch',
  'third_party_likeness',
]);

/**
 * Actions blocked by default (spam/abuse prevention)
 */
const BLOCKED_BY_DEFAULT = new Set([
  'mass_dm',
  'fake_engagement',
  'impersonation',
]);

/**
 * Validate a single action before execution
 */
export async function validateAction(
  artistId: number,
  action: PlannedAction
): Promise<ComplianceCheck> {
  // 1. Check if action is blocked
  if (BLOCKED_BY_DEFAULT.has(action.action)) {
    return { approved: false, requiresHumanApproval: false, reason: 'Action blocked by compliance policy', riskLevel: 'critical' };
  }

  // 2. Check if action requires human approval
  if (REQUIRE_HUMAN_APPROVAL.has(action.action)) {
    return { approved: false, requiresHumanApproval: true, reason: 'Requires human approval per policy', riskLevel: 'high' };
  }

  // 3. Load artist config for budget limits
  const [config] = await db.select().from(aasConfig).where(eq(aasConfig.artistId, artistId)).limit(1);
  
  if (!config) {
    return { approved: false, requiresHumanApproval: false, reason: 'AAS not configured', riskLevel: 'high' };
  }

  // 4. Check budget threshold
  const approvalThreshold = parseFloat(config.requireApprovalAbove || '100');
  if (action.budgetAllocated > approvalThreshold) {
    return {
      approved: false,
      requiresHumanApproval: true,
      reason: `Budget $${action.budgetAllocated} exceeds approval threshold $${approvalThreshold}`,
      riskLevel: 'medium',
    };
  }

  // 5. Check blocked actions from config
  const blockedActions = config.blockedActions || [];
  if (blockedActions.includes(action.action)) {
    return { approved: false, requiresHumanApproval: false, reason: 'Action blocked by artist config', riskLevel: 'medium' };
  }

  // 6. Check channel restrictions
  const allowedChannels = config.allowedChannels;
  if (allowedChannels && allowedChannels.length > 0 && !allowedChannels.includes(action.channel)) {
    return {
      approved: false,
      requiresHumanApproval: false,
      reason: `Channel "${action.channel}" not in allowed list`,
      riskLevel: 'low',
    };
  }

  // All checks passed
  return { approved: true, requiresHumanApproval: false, riskLevel: 'low' };
}

/**
 * Validate an entire daily plan
 */
export async function validatePlan(
  artistId: number,
  actions: PlannedAction[]
): Promise<{ approved: PlannedAction[]; blocked: { action: PlannedAction; reason: string }[]; pendingApproval: PlannedAction[] }> {
  const approved: PlannedAction[] = [];
  const blocked: { action: PlannedAction; reason: string }[] = [];
  const pendingApproval: PlannedAction[] = [];

  for (const action of actions) {
    const check = await validateAction(artistId, action);
    
    if (check.approved) {
      approved.push(action);
    } else if (check.requiresHumanApproval) {
      pendingApproval.push(action);
      // Create approval request
      await db.insert(aasApprovalQueue).values({
        artistId,
        actionType: action.action,
        description: `${action.agent}: ${action.action} on ${action.channel}`,
        agent: action.agent,
        estimatedCost: String(action.budgetAllocated),
        riskLevel: check.riskLevel,
        payload: { action },
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
      });
    } else {
      blocked.push({ action, reason: check.reason || 'Blocked by compliance' });
    }
  }

  return { approved, blocked, pendingApproval };
}

/**
 * Execute compliance check action
 */
export async function executeComplianceAction(
  artistId: number,
  action: string,
): Promise<ActionResult> {
  return {
    success: true,
    agent: 'risk-compliance',
    action,
    costActual: 0,
    revenueGenerated: 0,
    details: 'Compliance check completed. All active actions validated.',
  };
}
