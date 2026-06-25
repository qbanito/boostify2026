/**
 * 📬 EMAIL SMART ROUTER
 * 
 * Healthy GLOBAL daily ceiling across ALL providers: 600 emails/day
 * (override per-run with env DAILY_SEND_TARGET). The router rotates intelligently,
 * always picking the least-used domain so every account stays warm and far below
 * its hard cap. Per-account safe maxes:
 *   - Brevo (boostifymusic.com):        300/day hard → safe 120
 *   - Resend FREE x6 (established):      100/day hard → safe  60 each
 *   - Resend PAID x5 (new, warming up):  paid acct   → safe  40 each
 * 
 * Tracks sends in `email_daily_limits` table (shared by every GitHub Action).
 * Always sets reply-to: convoycubano@gmail.com (so all client replies land there).
 */

const REPLY_TO = 'convoycubano@gmail.com';

// 🎯 Global healthy daily ceiling across ALL providers (Resend + Brevo combined).
// Intelligent rotation keeps every domain warm and well under its hard cap.
const GLOBAL_DAILY_TARGET = parseInt(process.env.DAILY_SEND_TARGET || '600', 10);

const PROVIDERS = {
  // Brevo — used for industry/investor domain (boostifymusic.com)
  BREVO: {
    key: 'BREVO',
    type: 'brevo',
    dailyLimit: 300,
    safeMax: 120,
    envVar: 'BREVO_API_KEY',
    fromEmail: 'info@boostifymusic.com',
    fromName: 'Alex from Boostify',
    investorsEmail: 'investors@boostifymusic.com',
    artistsEmail: 'artists@boostifymusic.com',
  },
  // Resend accounts — used for artist warmup/sequences
  ARTISTS_1: {
    key: 'ARTISTS_1',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 60,
    envVar: 'RESEND_API_ARTISTS_1',
    fromEmail: 'info@boostifymusic.site',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.site',
  },
  ARTISTS_2: {
    key: 'ARTISTS_2',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 60,
    envVar: 'RESEND_API_ARTISTS_2',
    fromEmail: 'info@boostifymusic.space',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.space',
  },
  ARTISTS_3: {
    key: 'ARTISTS_3',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 60,
    envVar: 'RESEND_API_ARTISTS_3',
    fromEmail: 'info@boostifymusic.sbs',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.sbs',
  },
  ARTISTS_4: {
    key: 'ARTISTS_4',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 60,
    envVar: 'RESEND_API_ARTISTS_4',
    fromEmail: 'info@boostifymusic.online',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.online',
  },
  ARTISTS_5: {
    key: 'ARTISTS_5',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 60,
    envVar: 'RESEND_API_ARTISTS_5',
    fromEmail: 'info@boostifymusica.space',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusica.space',
  },
  ARTISTS_6: {
    key: 'ARTISTS_6',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 60,
    envVar: 'RESEND_API_ARTISTS_6',
    fromEmail: 'info@boostifymusica.site',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusica.site',
  },
  ARTISTS_7: {
    key: 'ARTISTS_7',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 40,
    envVar: 'RESEND_API_ARTISTS_7',
    fromEmail: 'info@boostifymusicusa.sbs',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusicusa.sbs',
  },
  ARTISTS_8: {
    key: 'ARTISTS_8',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 40,
    envVar: 'RESEND_API_ARTISTS_8',
    fromEmail: 'info@boostifymusicusa.space',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusicusa.space',
  },
  ARTISTS_9: {
    key: 'ARTISTS_9',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 40,
    envVar: 'RESEND_API_ARTISTS_9',
    fromEmail: 'info@boostifymusicusa.online',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusicusa.online',
  },
  ARTISTS_10: {
    key: 'ARTISTS_10',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 40,
    envVar: 'RESEND_API_ARTISTS_10',
    fromEmail: 'info@boostifymusic.shop',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.shop',
  },
  ARTISTS_11: {
    key: 'ARTISTS_11',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 40,
    envVar: 'RESEND_API_ARTISTS_11',
    fromEmail: 'info@boostifymusic.xyz',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.xyz',
  },
};

/**
 * Total emails sent across ALL providers today (for the global daily ceiling).
 * @param {object} pool - pg Pool instance
 * @returns {Promise<number>}
 */
async function getGlobalSentToday(pool) {
  const today = new Date().toISOString().slice(0, 10);
  let client;
  try {
    client = await pool.connect();
    const res = await client.query(
      `SELECT COALESCE(SUM(sent), 0) AS total FROM email_daily_limits WHERE date = $1`,
      [today]
    );
    return parseInt(res.rows[0]?.total || 0, 10);
  } catch (e) {
    return 0;
  } finally {
    if (client) client.release();
  }
}

/**
 * Remaining emails allowed today under the GLOBAL ceiling (across every provider).
 * @param {object} pool - pg Pool instance
 * @returns {Promise<{ sentToday: number, target: number, remaining: number }>}
 */
async function getDailyBudget(pool) {
  const sentToday = await getGlobalSentToday(pool);
  return { sentToday, target: GLOBAL_DAILY_TARGET, remaining: Math.max(GLOBAL_DAILY_TARGET - sentToday, 0) };
}

/**
 * Returns the best available Resend provider for artist emails.
 * Rotates automatically based on daily send count (picks lowest used).
 * @param {object} pool - pg Pool instance (for tracking)
 * @returns {{ provider, apiKey, fromEmail, fromName, remainingToday }}
 */
async function getBestArtistProvider(pool) {
  const resendKeys = ['ARTISTS_1', 'ARTISTS_2', 'ARTISTS_3', 'ARTISTS_4', 'ARTISTS_5', 'ARTISTS_6', 'ARTISTS_7', 'ARTISTS_8', 'ARTISTS_9', 'ARTISTS_10', 'ARTISTS_11'];
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let client;

  // Try to get counts from DB; fall back to 0 if table doesn't exist
  let counts = {};
  try {
    client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_daily_limits (
        provider TEXT NOT NULL,
        date DATE NOT NULL,
        sent INTEGER DEFAULT 0,
        PRIMARY KEY (provider, date)
      )
    `);
    const res = await client.query(
      `SELECT provider, sent FROM email_daily_limits WHERE date = $1 AND provider = ANY($2)`,
      [today, resendKeys]
    );
    for (const row of res.rows) counts[row.provider] = parseInt(row.sent);
  } catch (e) {
    console.warn('⚠️  Could not query email_daily_limits:', e.message);
  } finally {
    if (client) client.release();
  }

  // Pick provider with lowest sent count that still has capacity
  let best = null;
  let bestSent = Infinity;
  for (const key of resendKeys) {
    const apiKey = process.env[PROVIDERS[key].envVar];
    if (!apiKey) continue;
    const sent = counts[key] || 0;
    if (sent < PROVIDERS[key].safeMax && sent < bestSent) {
      best = key;
      bestSent = sent;
    }
  }

  if (!best) {
    // All accounts at limit — fall back to ARTISTS_1 anyway (GitHub Actions runs in parallel with different secrets)
    best = resendKeys.find(k => !!process.env[PROVIDERS[k].envVar]) || 'ARTISTS_1';
    console.warn('⚠️  All Resend accounts may be at limit — using ' + best);
  }

  const p = PROVIDERS[best];
  const accountRemaining = p.safeMax - (counts[best] || 0);
  const globalSent = await getGlobalSentToday(pool);
  const globalRemaining = Math.max(GLOBAL_DAILY_TARGET - globalSent, 0);
  const remaining = Math.max(0, Math.min(accountRemaining, globalRemaining));
  console.log(`📬 Resend router → ${best} (acct ${counts[best] || 0}/${p.safeMax}, global ${globalSent}/${GLOBAL_DAILY_TARGET}) → ${remaining} left`);
  return {
    provider: best,
    apiKey: process.env[p.envVar],
    fromEmail: p.fromEmail,
    fromName: p.fromName,
    remainingToday: remaining,
  };
}

/**
 * Returns available Brevo quota for today.
 * @param {object} pool - pg Pool instance
 * @returns {{ remainingToday }}
 */
async function getBrevoQuota(pool) {
  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;
  let client;
  try {
    client = await pool.connect();
    const res = await client.query(
      `SELECT sent FROM email_daily_limits WHERE provider = 'BREVO' AND date = $1`,
      [today]
    );
    sent = res.rows[0] ? parseInt(res.rows[0].sent) : 0;
  } catch (e) {
    console.warn('⚠️  Could not check Brevo quota:', e.message);
  } finally {
    if (client) client.release();
  }
  const accountRemaining = PROVIDERS.BREVO.safeMax - sent;
  const globalSent = await getGlobalSentToday(pool);
  const globalRemaining = Math.max(GLOBAL_DAILY_TARGET - globalSent, 0);
  const remaining = Math.max(0, Math.min(accountRemaining, globalRemaining));
  console.log(`📬 Brevo quota → acct ${sent}/${PROVIDERS.BREVO.safeMax}, global ${globalSent}/${GLOBAL_DAILY_TARGET} → ${remaining} remaining`);
  return { remainingToday: remaining };
}

/**
 * Records N emails sent for a given provider in today's tally.
 * @param {object} pool - pg Pool instance
 * @param {string} providerKey - e.g. 'BREVO', 'ARTISTS_1'
 * @param {number} count - number of emails sent
 */
async function recordSends(pool, providerKey, count) {
  if (!count || count <= 0) return;
  const today = new Date().toISOString().slice(0, 10);
  let client;
  try {
    client = await pool.connect();
    await client.query(`
      INSERT INTO email_daily_limits (provider, date, sent)
      VALUES ($1, $2, $3)
      ON CONFLICT (provider, date)
      DO UPDATE SET sent = email_daily_limits.sent + $3
    `, [providerKey, today, count]);
  } catch (e) {
    console.warn('⚠️  Could not record sends:', e.message);
  } finally {
    if (client) client.release();
  }
}

/**
 * Send via Brevo with reply-to = convoycubano@gmail.com
 * @param {{ to, subject, html, fromEmail, fromName }} params
 * @returns {{ messageId, error }}
 */
async function sendWithBrevo({ to, subject, html, fromEmail, fromName }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { messageId: null, error: 'BREVO_API_KEY not set' };
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        replyTo: { email: REPLY_TO },
        subject,
        htmlContent: html,
      }),
    });
    const result = await response.json();
    if (result.messageId) return { messageId: result.messageId, error: null };
    return { messageId: null, error: result.message || JSON.stringify(result) };
  } catch (e) {
    return { messageId: null, error: e.message };
  }
}

/**
 * Send via Resend with reply-to = convoycubano@gmail.com
 * @param {{ to, subject, html, apiKey, fromEmail, fromName }} params
 * @returns {{ messageId, error }}
 */
async function sendWithResend({ to, subject, html, apiKey, fromEmail, fromName }) {
  if (!apiKey) return { messageId: null, error: 'Resend API key not set' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        reply_to: REPLY_TO,
        subject,
        html,
      }),
    });
    const result = await response.json();
    if (result.id) return { messageId: result.id, error: null };
    return { messageId: null, error: result.message || result.name || JSON.stringify(result) };
  } catch (e) {
    return { messageId: null, error: e.message };
  }
}

/**
 * 📇 RESILIENT RECIPIENT FETCH
 *
 * The original campaigns queried a `leads` + `lead_status` CRM (Supabase).
 * That table no longer exists on the consolidated DB — the real outreach
 * audience lives in `music_industry_contacts`. This helper queries that table
 * with a lead-compatible shape so all senders keep working.
 *
 * @param {object} pool - pg Pool
 * @param {{ audience?: 'all'|'artists'|'industry'|'investors', limit?: number, cooldownDays?: number }} opts
 * @returns {Promise<Array>} rows: { id, email, first_name, last_name, name, company_name, job_title, industry, country, source, last_email_at, emails_sent, status_id }
 */
async function fetchContacts(pool, { audience = 'all', limit = 40, cooldownDays = 4 } = {}) {
  const client = await pool.connect();
  try {
    let filter = '';
    if (audience === 'industry') {
      filter = `AND (job_title IS NOT NULL OR seniority_level IS NOT NULL OR company_name IS NOT NULL)`;
    } else if (audience === 'investors') {
      filter = `AND (LOWER(COALESCE(industry,'') || ' ' || COALESCE(job_title,'') || ' ' || COALESCE(category,'') || ' ' || COALESCE(keywords,'')) ~ 'invest|venture|capital|angel|fund')`;
    } else if (audience === 'artists') {
      filter = `AND (industry IS NULL OR LOWER(COALESCE(industry,'') || ' ' || COALESCE(category,'') || ' ' || COALESCE(keywords,'')) ~ 'music|artist|entertain|record|label|sound|audio')`;
    }
    const res = await client.query(`
      SELECT id, email, first_name, last_name,
             full_name AS name, company_name, job_title, industry, country, city, state,
             import_source AS source,
             last_contacted_at AS last_email_at,
             COALESCE(emails_sent, 0) AS emails_sent,
             NULL::int AS status_id
      FROM music_industry_contacts
      WHERE email IS NOT NULL AND email <> ''
        AND COALESCE(status, '') NOT IN ('unsubscribed', 'bounced', 'invalid', 'complained')
        AND COALESCE(email_status, '') NOT IN ('invalid', 'bounced', 'unsubscribed')
        AND (last_contacted_at IS NULL OR last_contacted_at < NOW() - ($2 || ' days')::interval)
        ${filter}
      ORDER BY RANDOM()
      LIMIT $1
    `, [limit, String(cooldownDays)]);
    return res.rows;
  } finally {
    client.release();
  }
}

/**
 * Best-effort: mark a contact as emailed so cooldown + counters stay accurate.
 * Silently ignores any error (counters are non-critical).
 */
async function markContacted(pool, contactId) {
  if (!contactId) return;
  try {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE music_industry_contacts
           SET last_contacted_at = NOW(),
               emails_sent = COALESCE(emails_sent, 0) + 1,
               status = CASE WHEN COALESCE(status,'') IN ('', 'new', 'imported') THEN 'contacted' ELSE status END
         WHERE id = $1`,
        [contactId]
      );
    } finally {
      client.release();
    }
  } catch (_) { /* best effort */ }
}

/** True when a pg error means "relation/column does not exist" (legacy leads schema). */
function isMissingRelation(err) {
  return !!err && (err.code === '42P01' || err.code === '42703');
}

module.exports = {
  REPLY_TO,
  GLOBAL_DAILY_TARGET,
  PROVIDERS,
  getBestArtistProvider,
  getBrevoQuota,
  getGlobalSentToday,
  getDailyBudget,
  recordSends,
  sendWithBrevo,
  sendWithResend,
  fetchContacts,
  markContacted,
  isMissingRelation,
};
