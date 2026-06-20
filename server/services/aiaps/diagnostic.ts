/**
 * System diagnostic — self-test for the whole AIAPS stack.
 * Verifies: tables, providers, required envs, endpoints health,
 * job queue status, audit table reachable, vault reachable.
 */
import { pool } from './db';
import { jobStats } from './job-queue';
import { listOperators } from './rbac';
import { vaultList } from './vault';

export interface DiagnosticReport {
  ok: boolean;
  score: number; // 0-100
  checks: Array<{ id: string; label: string; ok: boolean; detail?: string; severity: 'info' | 'warn' | 'critical' }>;
  providers: Record<string, boolean>;
  tables: Record<string, number | 'missing'>;
  jobs: Record<string, number>;
  timestamp: string;
}

const REQUIRED_TABLES = [
  'aiaps_artists',
  'aiaps_social_accounts',
  'aiaps_username_candidates',
  'aiaps_email_assets',
  'aiaps_phone_assets',
  'aiaps_verification_events',
  'aiaps_warmup_tasks',
  'aiaps_health_reports',
  'aiaps_incidents',
  'aiaps_jobs',
  'aiaps_vault_secrets',
  'aiaps_operators',
  'audit_log',
];

export async function runDiagnostic(): Promise<DiagnosticReport> {
  const checks: DiagnosticReport['checks'] = [];
  const tables: Record<string, number | 'missing'> = {};

  // Ensure late-bootstrapped tables exist before counting
  try { await jobStats(); } catch { /* ignore */ }
  try { await listOperators(); } catch { /* ignore */ }
  try { await vaultList(); } catch { /* ignore */ }

  // 1. Check tables
  for (const t of REQUIRED_TABLES) {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
      tables[t] = rows[0].n;
      checks.push({ id: `table.${t}`, label: `Tabla ${t}`, ok: true, detail: `${rows[0].n} filas`, severity: 'info' });
    } catch (err: any) {
      tables[t] = 'missing';
      const critical = ['aiaps_artists', 'aiaps_social_accounts'].includes(t);
      checks.push({
        id: `table.${t}`,
        label: `Tabla ${t}`,
        ok: false,
        detail: 'No existe (se creará en primer request)',
        severity: critical ? 'critical' : 'warn',
      });
    }
  }

  // 2. Providers
  const providers: Record<string, boolean> = {
    openai: !!process.env.OPENAI_API_KEY,
    twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    sendgrid: !!process.env.SENDGRID_API_KEY,
    resend: !!process.env.RESEND_API_KEY,
    firestore: !!process.env.FIREBASE_PROJECT_ID,
    cloudinary: !!process.env.CLOUDINARY_URL,
    database: !!process.env.DATABASE_URL,
    vault_key: !!process.env.AIAPS_VAULT_KEY,
  };
  for (const [k, v] of Object.entries(providers)) {
    const sev: 'info' | 'warn' | 'critical' =
      k === 'database' ? 'critical' : k === 'vault_key' ? 'warn' : 'info';
    checks.push({
      id: `provider.${k}`,
      label: `Proveedor ${k}`,
      ok: v || sev === 'info',
      detail: v ? 'Configurado' : 'No configurado',
      severity: sev,
    });
  }

  // 3. Jobs
  let jobs: Record<string, number> = { queued: 0, claimed: 0, succeeded: 0, failed: 0 };
  try {
    jobs = await jobStats();
    checks.push({
      id: 'jobs',
      label: 'Cola de jobs',
      ok: true,
      detail: `queued=${jobs.queued}, running=${jobs.claimed}, ok=${jobs.succeeded}, failed=${jobs.failed}`,
      severity: 'info',
    });
  } catch (err: any) {
    checks.push({ id: 'jobs', label: 'Cola de jobs', ok: false, detail: err.message, severity: 'warn' });
  }

  // 4. Orphaned incidents vs resolutions
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM aiaps_incidents WHERE status='open' AND created_at < NOW() - INTERVAL '7 days'`,
    );
    checks.push({
      id: 'stale_incidents',
      label: 'Incidentes abiertos > 7 días',
      ok: rows[0].n === 0,
      detail: `${rows[0].n} incidente(s)`,
      severity: rows[0].n > 0 ? 'warn' : 'info',
    });
  } catch { /* table may not exist yet */ }

  // 5. Verification events pending
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM aiaps_verification_events WHERE status='new'`,
    );
    checks.push({
      id: 'pending_verifications',
      label: 'OTPs sin atender',
      ok: rows[0].n < 50,
      detail: `${rows[0].n} pendiente(s)`,
      severity: rows[0].n > 50 ? 'warn' : 'info',
    });
  } catch { /* ignore */ }

  // 6. Public webhook URL configured
  checks.push({
    id: 'public_url',
    label: 'PUBLIC_URL para webhooks',
    ok: !!process.env.PUBLIC_URL,
    detail: process.env.PUBLIC_URL || 'no configurado (webhooks requieren URL pública)',
    severity: process.env.PUBLIC_URL ? 'info' : 'warn',
  });

  const critical = checks.filter((c) => c.severity === 'critical' && !c.ok).length;
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    ok: critical === 0,
    score,
    checks,
    providers,
    tables,
    jobs,
    timestamp: new Date().toISOString(),
  };
}
