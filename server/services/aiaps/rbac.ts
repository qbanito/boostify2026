/**
 * AIAPS RBAC — operators with roles + allowed scopes.
 * Role hierarchy:
 *   superadmin > compliance > operator > manager > auditor
 * superadmin has all permissions. Others are restricted by `allowed_platforms`
 * and `allowed_artists`.
 */
import { pool } from './db';

export type Role = 'superadmin' | 'compliance' | 'operator' | 'manager' | 'auditor';
export const ROLES: Role[] = ['superadmin', 'compliance', 'operator', 'manager', 'auditor'];

export const PERMISSIONS: Record<Role, string[]> = {
  superadmin: ['*'],
  compliance: ['read', 'compliance.review', 'incidents.resolve', 'vault.read'],
  operator: [
    'read',
    'artists.create',
    'identity.generate',
    'usernames.generate',
    'emails.provision',
    'phones.purchase',
    'accounts.provision',
    'accounts.transition',
    'warmup.generate',
    'warmup.advance',
    'jobs.claim',
    'jobs.report',
    'verifications.ack',
  ],
  manager: ['read', 'artists.create', 'identity.generate'],
  auditor: ['read'],
};

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiaps_operators (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255),
      role VARCHAR(32) NOT NULL DEFAULT 'auditor',
      allowed_platforms JSONB,
      allowed_artists JSONB,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_operators_role ON aiaps_operators(role);
  `);
  ensured = true;
}

export async function upsertOperator(
  email: string,
  data: Partial<{
    role: Role;
    display_name: string;
    allowed_platforms: string[];
    allowed_artists: string[];
    active: boolean;
  }>,
): Promise<any> {
  await ensureTable();
  const { rows } = await pool.query(
    `INSERT INTO aiaps_operators (email, display_name, role, allowed_platforms, allowed_artists, active)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,TRUE))
     ON CONFLICT (email) DO UPDATE SET
       display_name = COALESCE(EXCLUDED.display_name, aiaps_operators.display_name),
       role = COALESCE(EXCLUDED.role, aiaps_operators.role),
       allowed_platforms = COALESCE(EXCLUDED.allowed_platforms, aiaps_operators.allowed_platforms),
       allowed_artists = COALESCE(EXCLUDED.allowed_artists, aiaps_operators.allowed_artists),
       active = COALESCE(EXCLUDED.active, aiaps_operators.active),
       updated_at = NOW()
     RETURNING *`,
    [
      email,
      data.display_name || null,
      data.role || null,
      data.allowed_platforms ? JSON.stringify(data.allowed_platforms) : null,
      data.allowed_artists ? JSON.stringify(data.allowed_artists) : null,
      data.active,
    ],
  );
  return rows[0];
}

export async function listOperators(): Promise<any[]> {
  await ensureTable();
  const { rows } = await pool.query(
    `SELECT * FROM aiaps_operators ORDER BY role, email`,
  );
  return rows;
}

export async function getOperatorByEmail(email: string): Promise<any | null> {
  await ensureTable();
  const { rows } = await pool.query('SELECT * FROM aiaps_operators WHERE email=$1', [email]);
  return rows[0] || null;
}

export function hasPermission(role: Role | undefined, perm: string): boolean {
  if (!role) return false;
  const perms = PERMISSIONS[role] || [];
  if (perms.includes('*')) return true;
  return perms.includes(perm);
}

/**
 * Express middleware factory — requires an operator with a given permission.
 * Falls back to requireAdmin (already applied upstream) if no operator record
 * exists but user is admin (superadmin-by-proxy).
 */
export function requirePermission(perm: string) {
  return async (req: any, res: any, next: any) => {
    try {
      // If upstream already marked superadmin, allow
      if (req?.adminUser?.isSuperAdmin || req?.user?.isSuperAdmin) return next();
      const email = req?.user?.email || req?.adminUser?.email;
      if (!email) return res.status(403).json({ ok: false, error: 'forbidden' });
      const op = await getOperatorByEmail(email);
      if (!op || !op.active) return res.status(403).json({ ok: false, error: 'not_an_operator' });
      if (!hasPermission(op.role as Role, perm)) {
        return res.status(403).json({ ok: false, error: 'insufficient_permissions', required: perm });
      }
      (req as any).operator = op;
      next();
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  };
}
