/**
 * Audit helper for AIAPS.
 * Writes to the shared `audit_log` table (created on-demand).
 * Fails gracefully — never breaks the caller.
 */
import { pool } from './db';

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        action VARCHAR(128) NOT NULL,
        actor_email VARCHAR(255),
        actor_id VARCHAR(128),
        target_type VARCHAR(64),
        target_id VARCHAR(128),
        ip VARCHAR(64),
        severity VARCHAR(16) DEFAULT 'info',
        meta JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
    `);
    ensured = true;
  } catch {
    /* tolerate */
  }
}

export interface AuditEntry {
  action: string;
  actorEmail?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string | number;
  ip?: string;
  severity?: 'info' | 'warn' | 'critical';
  meta?: Record<string, any>;
}

export async function logAudit(e: AuditEntry): Promise<void> {
  try {
    await ensureTable();
    await pool.query(
      `INSERT INTO audit_log (action, actor_email, actor_id, target_type, target_id, ip, severity, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        e.action,
        e.actorEmail || null,
        e.actorId || null,
        e.targetType || null,
        e.targetId != null ? String(e.targetId) : null,
        e.ip || null,
        e.severity || 'info',
        e.meta ? JSON.stringify(e.meta) : null,
      ],
    );
  } catch (err: any) {
    console.warn('[AIAPS audit] failed:', err.message);
  }
}

export function auditFromReq(req: any): Pick<AuditEntry, 'actorEmail' | 'actorId' | 'ip'> {
  return {
    actorEmail: req?.user?.email || req?.adminUser?.email,
    actorId: req?.user?.id || req?.adminUser?.id,
    ip: req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress,
  };
}
