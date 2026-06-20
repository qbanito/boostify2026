/**
 * 📬 EMAIL SMART ROUTER
 * 
 * Manages daily send limits across all email providers:
 *   - Brevo:     300/day limit  → safe max = 200  (leaves 100 buffer)
 *   - Resend x4: 100/day each  → safe max =  70  (leaves 30 buffer)
 * 
 * Rotates between Resend accounts automatically.
 * Tracks sends in Supabase `email_daily_limits` table.
 * Always sets reply-to: convoycubano@gmail.com
 */

const REPLY_TO = 'convoycubano@gmail.com';

const PROVIDERS = {
  // Brevo — used for industry/investor domain (boostifymusic.com)
  BREVO: {
    key: 'BREVO',
    type: 'brevo',
    dailyLimit: 300,
    safeMax: 200,
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
    safeMax: 70,
    envVar: 'RESEND_API_ARTISTS_1',
    fromEmail: 'info@boostifymusic.site',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.site',
  },
  ARTISTS_2: {
    key: 'ARTISTS_2',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 70,
    envVar: 'RESEND_API_ARTISTS_2',
    fromEmail: 'info@boostifymusic.space',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.space',
  },
  ARTISTS_3: {
    key: 'ARTISTS_3',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 70,
    envVar: 'RESEND_API_ARTISTS_3',
    fromEmail: 'info@boostifymusic.sbs',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.sbs',
  },
  ARTISTS_4: {
    key: 'ARTISTS_4',
    type: 'resend',
    dailyLimit: 100,
    safeMax: 70,
    envVar: 'RESEND_API_ARTISTS_4',
    fromEmail: 'info@boostifymusic.online',
    fromName: 'Alex from Boostify',
    domain: 'boostifymusic.online',
  },
};

/**
 * Returns the best available Resend provider for artist emails.
 * Rotates automatically based on daily send count (picks lowest used).
 * @param {object} pool - pg Pool instance (for tracking)
 * @returns {{ provider, apiKey, fromEmail, fromName, remainingToday }}
 */
async function getBestArtistProvider(pool) {
  const resendKeys = ['ARTISTS_1', 'ARTISTS_2', 'ARTISTS_3', 'ARTISTS_4'];
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
  const remaining = p.safeMax - (counts[best] || 0);
  console.log(`📬 Resend router → ${best} (${counts[best] || 0}/${p.safeMax} used today, ${remaining} remaining)`);
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
  const remaining = PROVIDERS.BREVO.safeMax - sent;
  console.log(`📬 Brevo quota → ${sent}/${PROVIDERS.BREVO.safeMax} used today (${remaining} remaining)`);
  return { remainingToday: Math.max(remaining, 0) };
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

module.exports = {
  REPLY_TO,
  PROVIDERS,
  getBestArtistProvider,
  getBrevoQuota,
  recordSends,
  sendWithBrevo,
  sendWithResend,
};
