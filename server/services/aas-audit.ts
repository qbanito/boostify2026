/**
 * AAS audit + persistence utilities.
 * Reuses the existing `audit_log` table so we don't need new migrations.
 *
 * Action namespaces:
 *  - aas.agent.run       — Agent invocation (details: { status, startedAt, finishedAt, error, durationMs })
 *  - aas.sequence.config — Sequence channel config snapshot (details: { channels })
 */

import { db } from '../db';
import { auditLog } from '../db/schema';
import { sql, desc, and, eq } from 'drizzle-orm';

export type AgentRunStatus = 'running' | 'success' | 'error';

export async function recordAgentRun(params: {
  agentId: string;
  actorEmail?: string | null;
  status: AgentRunStatus;
  startedAt: Date;
  finishedAt?: Date | null;
  error?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    const durationMs = params.finishedAt ? params.finishedAt.getTime() - params.startedAt.getTime() : null;
    await db.insert(auditLog).values({
      action: 'aas.agent.run',
      actorEmail: params.actorEmail ?? null,
      targetType: 'agent',
      targetId: params.agentId,
      severity: params.status === 'error' ? 'error' : 'info',
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      details: {
        status: params.status,
        startedAt: params.startedAt.toISOString(),
        finishedAt: params.finishedAt?.toISOString() ?? null,
        durationMs,
        error: params.error ?? null,
      },
    });
  } catch (err) {
    console.error('[AAS Audit] recordAgentRun failed:', err);
  }
}

export async function getRecentAgentRuns(limit = 50) {
  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'aas.agent.run'))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
    return rows;
  } catch (err) {
    console.error('[AAS Audit] getRecentAgentRuns failed:', err);
    return [];
  }
}

export async function getLatestAgentRunPerAgent() {
  try {
    const res = await db.execute(sql`
      SELECT DISTINCT ON (target_id)
        target_id as agent_id,
        details,
        created_at
      FROM audit_log
      WHERE action = 'aas.agent.run'
      ORDER BY target_id, created_at DESC
    `);
    return res.rows as any[];
  } catch (err) {
    console.error('[AAS Audit] getLatestAgentRunPerAgent failed:', err);
    return [];
  }
}

export interface SequenceConfigChannels {
  email?: boolean;
  instagram?: boolean;
  tiktok?: boolean;
  whatsapp?: boolean;
  followup?: boolean;
  [key: string]: boolean | undefined;
}

export async function saveSequenceConfig(params: {
  actorEmail?: string | null;
  channels: SequenceConfigChannels;
  ip?: string | null;
}) {
  try {
    await db.insert(auditLog).values({
      action: 'aas.sequence.config',
      actorEmail: params.actorEmail ?? null,
      targetType: 'sequence',
      targetId: 'default',
      severity: 'info',
      ip: params.ip ?? null,
      details: { channels: params.channels },
    });
  } catch (err) {
    console.error('[AAS Audit] saveSequenceConfig failed:', err);
  }
}

export async function getSequenceConfig(): Promise<SequenceConfigChannels | null> {
  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, 'aas.sequence.config'),
          eq(auditLog.targetId, 'default'),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const latest = rows[0];
    if (!latest) return null;
    const details = (latest.details as any) || {};
    return details.channels || null;
  } catch (err) {
    console.error('[AAS Audit] getSequenceConfig failed:', err);
    return null;
  }
}

// ─── Workspace settings ─────────────────────────────────────────────

export interface WorkspaceSettings {
  adminEmails?: string[];
  discoveryCadenceHours?: number;
  defaultChannels?: string[];
  auditRetentionDays?: number;
  notifications?: {
    email?: boolean;
    inApp?: boolean;
    slackWebhook?: string | null;
  };
  updatedAt?: string;
  updatedBy?: string | null;
}

export async function saveWorkspaceSettings(params: {
  actorEmail?: string | null;
  settings: WorkspaceSettings;
  ip?: string | null;
}) {
  try {
    const settings: WorkspaceSettings = {
      ...params.settings,
      updatedAt: new Date().toISOString(),
      updatedBy: params.actorEmail ?? null,
    };
    await db.insert(auditLog).values({
      action: 'aas.settings.workspace',
      actorEmail: params.actorEmail ?? null,
      targetType: 'settings',
      targetId: 'workspace',
      severity: 'info',
      ip: params.ip ?? null,
      details: { settings },
    });
    return settings;
  } catch (err) {
    console.error('[AAS Audit] saveWorkspaceSettings failed:', err);
    throw err;
  }
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, 'aas.settings.workspace'),
          eq(auditLog.targetId, 'workspace'),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const latest = rows[0];
    if (!latest) return null;
    const details = (latest.details as any) || {};
    return details.settings || null;
  } catch (err) {
    console.error('[AAS Audit] getWorkspaceSettings failed:', err);
    return null;
  }
}

// ─── Automation workflows ───────────────────────────────────────────

export type AutomationTrigger =
  | 'new_high_score_artist'
  | 'email_opened'
  | 'email_clicked'
  | 'email_replied'
  | 'onboarding_completed'
  | 'status_changed_to_responded'
  | 'status_changed_to_won';

export type AutomationAction =
  | 'send_sequence'
  | 'create_landing'
  | 'notify_team'
  | 'add_tag'
  | 'move_pipeline_stage'
  | 'enrich_images';

export interface AutomationWorkflow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  triggerConfig?: Record<string, any>;
  action: AutomationAction;
  actionConfig?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string | null;
  runCount?: number;
  lastRunAt?: string | null;
}

export async function saveAutomationWorkflows(params: {
  actorEmail?: string | null;
  workflows: AutomationWorkflow[];
  ip?: string | null;
}) {
  try {
    await db.insert(auditLog).values({
      action: 'aas.automation.workflows',
      actorEmail: params.actorEmail ?? null,
      targetType: 'automation',
      targetId: 'workspace',
      severity: 'info',
      ip: params.ip ?? null,
      details: { workflows: params.workflows },
    });
    return params.workflows;
  } catch (err) {
    console.error('[AAS Audit] saveAutomationWorkflows failed:', err);
    throw err;
  }
}

export async function getAutomationWorkflows(): Promise<AutomationWorkflow[]> {
  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, 'aas.automation.workflows'),
          eq(auditLog.targetId, 'workspace'),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const latest = rows[0];
    if (!latest) return [];
    const details = (latest.details as any) || {};
    return Array.isArray(details.workflows) ? details.workflows : [];
  } catch (err) {
    console.error('[AAS Audit] getAutomationWorkflows failed:', err);
    return [];
  }
}

export async function recordAutomationRun(params: {
  workflowId: string;
  trigger: string;
  status: 'success' | 'error' | 'skipped';
  contactId?: number | null;
  error?: string | null;
  details?: Record<string, any>;
}) {
  try {
    await db.insert(auditLog).values({
      action: 'aas.automation.run',
      targetType: 'automation',
      targetId: params.workflowId,
      severity: params.status === 'error' ? 'error' : 'info',
      details: {
        trigger: params.trigger,
        status: params.status,
        contactId: params.contactId ?? null,
        error: params.error ?? null,
        ...params.details,
      },
    });
  } catch (err) {
    console.error('[AAS Audit] recordAutomationRun failed:', err);
  }
}

export async function getAutomationRuns(workflowId?: string, limit = 50) {
  try {
    const rows = workflowId
      ? await db
          .select()
          .from(auditLog)
          .where(
            and(
              eq(auditLog.action, 'aas.automation.run'),
              eq(auditLog.targetId, workflowId),
            ),
          )
          .orderBy(desc(auditLog.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(auditLog)
          .where(eq(auditLog.action, 'aas.automation.run'))
          .orderBy(desc(auditLog.createdAt))
          .limit(limit);
    return rows;
  } catch (err) {
    console.error('[AAS Audit] getAutomationRuns failed:', err);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// Inbound email messages (replies) — Resend / Brevo inbound webhooks
// action: aas.inbox.inbound
// ──────────────────────────────────────────────────────────────

export interface InboundMessage {
  provider: 'resend' | 'brevo' | 'unknown';
  fromEmail: string;
  fromName?: string | null;
  toEmail?: string | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  contactId?: number | null;
  receivedAt: string; // ISO
  raw?: Record<string, any> | null;
}

export async function recordInboundMessage(msg: InboundMessage) {
  try {
    await db.insert(auditLog).values({
      action: 'aas.inbox.inbound',
      actorEmail: msg.fromEmail,
      targetType: 'inbox',
      targetId: msg.messageId ?? `${msg.provider}:${Date.now()}`,
      severity: 'info',
      details: msg as any,
    });
  } catch (err) {
    console.error('[AAS Audit] recordInboundMessage failed:', err);
  }
}

export async function getInboundMessages(limit = 50) {
  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'aas.inbox.inbound'))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
    return rows;
  } catch (err) {
    console.error('[AAS Audit] getInboundMessages failed:', err);
    return [];
  }
}
