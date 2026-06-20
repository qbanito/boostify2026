import { db } from '../db';
import { auditLog } from '@db/schema';
import type { Request } from 'express';

type Severity = 'info' | 'warn' | 'error' | 'critical';

interface AuditEntry {
  action: string;
  actorId?: number;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  severity?: Severity;
}

/**
 * Log a security-relevant action to the audit_log table.
 * Fire-and-forget — never throws, never blocks the caller.
 */
export function audit(entry: AuditEntry): void {
  db.insert(auditLog)
    .values({
      action: entry.action,
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      details: entry.details ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      severity: entry.severity ?? 'info',
    })
    .then(() => {})
    .catch((err) => {
      console.error('[audit-logger] Failed to write audit log:', err.message);
    });
}

/**
 * Helper: extract audit context from an Express request.
 */
export function auditFromReq(req: Request): Pick<AuditEntry, 'actorId' | 'actorEmail' | 'ip' | 'userAgent'> {
  const user = req.user as any;
  return {
    actorId: user?.id ? Number(user.id) : undefined,
    actorEmail: user?.email ?? undefined,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || undefined,
    userAgent: req.headers['user-agent'] ?? undefined,
  };
}
