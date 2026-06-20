/**
 * Email Engine — provisions role-based alias addresses for an artist.
 * Default mode: aliases under a configurable catch-all domain
 * (env: AIAPS_EMAIL_DOMAIN, default "artists.boostify.com").
 *
 * Real SMTP/provider integration (SendGrid/Postmark/Google Workspace)
 * is layered behind the `provider` field — this module only creates the
 * logical record + marks it verified if the catch-all strategy is used.
 */
import { pool } from './db';
import { recomputeReadiness } from './readiness';

const DOMAIN = process.env.AIAPS_EMAIL_DOMAIN || 'artists.boostify.com';
const ROLES: Array<'primary' | 'recovery' | 'backup' | 'press'> = [
  'primary',
  'recovery',
  'backup',
  'press',
];

function slug(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

export interface EmailProvisionOptions {
  provider?: string;
  roles?: typeof ROLES;
}

export async function provisionEmails(
  artistId: string,
  stageName: string,
  opts: EmailProvisionOptions = {},
): Promise<Array<{ role: string; address: string; status: string }>> {
  const base = slug(stageName) || artistId.toLowerCase();
  const roles = opts.roles || ROLES;
  const provider = opts.provider || 'catch_all';
  const addresses: Record<string, string> = {
    primary: `${base}@${DOMAIN}`,
    recovery: `recovery+${base}@${DOMAIN}`,
    backup: `backup+${base}@${DOMAIN}`,
    press: `press+${base}@${DOMAIN}`,
  };

  const out: Array<{ role: string; address: string; status: string }> = [];
  for (const role of roles) {
    const address = addresses[role];
    if (!address) continue;
    // Catch-all domains are self-verified. Real SMTP providers would be pending.
    const status = provider === 'catch_all' ? 'verified' : 'pending';
    const verifiedAt = status === 'verified' ? new Date() : null;
    try {
      await pool.query(
        `INSERT INTO aiaps_email_assets (artist_id, role, address, provider, status, verified_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [artistId, role, address, provider, status, verifiedAt],
      );
      out.push({ role, address, status });
    } catch {
      /* ignore duplicates */
    }
  }
  await recomputeReadiness(artistId);
  return out;
}

/**
 * Detect an OTP code in an email body. Heuristic regex.
 */
export function extractOtpFromEmail(
  subject: string,
  body: string,
): { code: string; platform: string } | null {
  const text = `${subject}\n${body}`;
  const platformMatch = text.match(/(instagram|tiktok|facebook|x|twitter|youtube|threads|spotify|soundcloud)/i);
  const codeMatch = text.match(/\b(\d{4,8})\b/) || text.match(/code[:\s]+([A-Z0-9]{4,10})/i);
  if (!codeMatch) return null;
  return {
    code: codeMatch[1],
    platform: (platformMatch?.[1] || 'unknown').toLowerCase(),
  };
}
