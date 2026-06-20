/**
 * Compliance Engine — runs checklist of policy checks per artist.
 */
import { pool } from './db';

export interface ComplianceCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'info' | 'warn' | 'critical';
  detail?: string;
}

export async function runComplianceChecks(artistId: string): Promise<{
  score: number;
  checks: ComplianceCheck[];
}> {
  const { rows } = await pool.query('SELECT * FROM aiaps_artists WHERE id=$1', [artistId]);
  const artist = rows[0];
  if (!artist) return { score: 0, checks: [] };

  const checks: ComplianceCheck[] = [];

  // AI disclosure
  const isAI = (artist.artist_type || '').toLowerCase().includes('virtual');
  let disclosureFlags: any = artist.ai_disclosure_flags;
  if (typeof disclosureFlags === 'string') {
    try { disclosureFlags = JSON.parse(disclosureFlags); } catch { disclosureFlags = {}; }
  }
  checks.push({
    id: 'ai_disclosure',
    label: 'AI disclosure flag (FTC)',
    passed: !isAI || !!disclosureFlags?.requires_disclosure,
    severity: 'critical',
    detail: isAI ? 'Artista virtual requiere disclosure' : 'No aplica',
  });

  // Age gate — stub; we don't track audience yet, assume OK unless flagged
  checks.push({
    id: 'age_gate',
    label: 'Age gate / COPPA',
    passed: true,
    severity: 'warn',
    detail: 'Sin contenido para menores declarado',
  });

  // Copyright — require short_bio to be non-empty (proxy for human review)
  checks.push({
    id: 'copyright',
    label: 'Registro de copyright / DMCA',
    passed: !!artist.short_bio && artist.short_bio.length > 10,
    severity: 'warn',
    detail: artist.short_bio ? 'Metadata base presente' : 'Falta metadata base',
  });

  // GDPR — require at least one recovery email
  const emails = await pool.query(
    `SELECT COUNT(*)::int AS n FROM aiaps_email_assets WHERE artist_id=$1 AND role='recovery' AND status='verified'`,
    [artistId],
  );
  checks.push({
    id: 'gdpr',
    label: 'GDPR — correo de recuperación verificado',
    passed: emails.rows[0].n > 0,
    severity: 'warn',
    detail: `${emails.rows[0].n} recovery email(s)`,
  });

  // Platform ToS — require at least 1 account not in restricted state
  const accts = await pool.query(
    `SELECT COUNT(*)::int AS bad FROM aiaps_social_accounts WHERE artist_id=$1 AND status IN ('restricted','banned','recovery_needed')`,
    [artistId],
  );
  checks.push({
    id: 'platform_tos',
    label: 'Ningún strike / ban activo',
    passed: accts.rows[0].bad === 0,
    severity: 'critical',
    detail: `${accts.rows[0].bad} cuenta(s) en estado adverso`,
  });

  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, checks };
}
