/**
 * Provisioning Engine — state machine for social account lifecycle.
 * Handles transitions: draft → identity_ready → pending_signup →
 * verification_pending → profile_configured → secured → warming → active.
 *
 * Does NOT execute real signups — those live in platform adapters
 * (extension or Playwright). This engine coordinates state + emits
 * audit events + creates linked assets (email/phone) automatically.
 */
import { pool } from './db';
import { provisionEmails } from './email-engine';
import { purchasePhone } from './phone-engine';
import { generateWarmupTasks } from './warmup-engine';
import { recomputeReadiness } from './readiness';
import { enqueueJob } from './job-queue';

export const ACCOUNT_STATES = [
  'draft',
  'identity_ready',
  'pending_signup',
  'verification_pending',
  'profile_configured',
  'secured',
  'warming',
  'active',
  'restricted',
  'recovery_needed',
  'archived',
  'banned',
] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];

const TRANSITIONS: Record<string, string[]> = {
  draft: ['identity_ready', 'archived'],
  identity_ready: ['pending_signup', 'archived'],
  pending_signup: ['verification_pending', 'restricted', 'archived'],
  verification_pending: ['profile_configured', 'recovery_needed', 'restricted'],
  profile_configured: ['secured', 'restricted'],
  secured: ['warming', 'restricted'],
  warming: ['active', 'restricted', 'recovery_needed'],
  active: ['restricted', 'recovery_needed', 'archived'],
  restricted: ['recovery_needed', 'archived', 'active'],
  recovery_needed: ['secured', 'archived', 'banned'],
  archived: [],
  banned: [],
};

export async function provisionAccount(
  artistId: string,
  platform: string,
  options: { username?: string } = {},
): Promise<{ id: number; status: string }> {
  // Ensure email + phone exist for this artist
  const { rows: artistRows } = await pool.query('SELECT stage_name FROM aiaps_artists WHERE id=$1', [artistId]);
  const stageName = artistRows[0]?.stage_name || artistId;

  const existingEmail = await pool.query(
    `SELECT id FROM aiaps_email_assets WHERE artist_id=$1 LIMIT 1`,
    [artistId],
  );
  if (!existingEmail.rows.length) {
    await provisionEmails(artistId, stageName);
  }

  const existingPhone = await pool.query(
    `SELECT id FROM aiaps_phone_assets WHERE artist_id=$1 AND active=TRUE LIMIT 1`,
    [artistId],
  );
  if (!existingPhone.rows.length) {
    await purchasePhone(artistId, { platforms: [platform] });
  }

  // Get asset ids
  const [emailRow] = (await pool.query(
    `SELECT id FROM aiaps_email_assets WHERE artist_id=$1 ORDER BY id LIMIT 1`,
    [artistId],
  )).rows;
  const [phoneRow] = (await pool.query(
    `SELECT id FROM aiaps_phone_assets WHERE artist_id=$1 AND active=TRUE ORDER BY id LIMIT 1`,
    [artistId],
  )).rows;

  const { rows } = await pool.query(
    `INSERT INTO aiaps_social_accounts (artist_id, platform, username, email_asset_id, phone_asset_id, status)
     VALUES ($1,$2,$3,$4,$5,'identity_ready') RETURNING id, status`,
    [artistId, platform, options.username || null, emailRow?.id || null, phoneRow?.id || null],
  );
  await recomputeReadiness(artistId);
  return rows[0];
}

export async function transitionAccount(
  accountId: number,
  toState: AccountState,
): Promise<{ from: string; to: string; valid: boolean }> {
  const { rows } = await pool.query('SELECT * FROM aiaps_social_accounts WHERE id=$1', [accountId]);
  const acct = rows[0];
  if (!acct) throw new Error('account_not_found');
  const from = acct.status;
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(toState)) {
    return { from, to: toState, valid: false };
  }
  await pool.query(
    `UPDATE aiaps_social_accounts SET status=$2, last_event_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [accountId, toState],
  );

  // Side effects
  if (toState === 'pending_signup' && acct.artist_id) {
    await enqueueJob({
      kind: 'signup',
      platform: acct.platform,
      artistId: acct.artist_id,
      accountId,
      payload: { username: acct.username, email: acct.email_ref, phone: acct.phone_ref },
      priority: 7,
    });
  }
  if (toState === 'verification_pending' && acct.artist_id) {
    await enqueueJob({
      kind: 'verify',
      platform: acct.platform,
      artistId: acct.artist_id,
      accountId,
      payload: { username: acct.username },
      priority: 8,
    });
  }
  if (toState === 'profile_configured' && acct.artist_id) {
    await enqueueJob({
      kind: 'configure_profile',
      platform: acct.platform,
      artistId: acct.artist_id,
      accountId,
      payload: { username: acct.username },
      priority: 6,
    });
  }
  if (toState === 'warming' && acct.artist_id) {
    await generateWarmupTasks(acct.artist_id, acct.platform, 1);
  }

  if (acct.artist_id) await recomputeReadiness(acct.artist_id);
  return { from, to: toState, valid: true };
}
