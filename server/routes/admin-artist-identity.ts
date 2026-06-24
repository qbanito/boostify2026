/**
 * Boostify Artist Identity & Account Provisioning System (AIAPS)
 * ---------------------------------------------------------------
 * Admin-only API that powers the /admin/artist-identity dashboard.
 *
 * Modules: Identity Engine, Username Engine, Email & Recovery,
 * Phone Asset Manager, Provisioning Console, OTP/Verification Inbox,
 * Security Vault (metadata only), Profile Config, Warm-up Engine,
 * Account Health Monitor, Compliance, Audit, Extensions.
 *
 * Tables are bootstrapped lazily on first request (CREATE IF NOT EXISTS).
 * Secrets (passwords, recovery codes, tokens) are NEVER stored here —
 * this service only keeps metadata + pointers. The real vault lives
 * behind the Secret Vault layer (see `vault_ref` columns).
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../db';
import { requireAdmin } from '../middleware/require-admin';
import { generateIdentity, applyIdentity } from '../services/aiaps/identity-engine';
import { generateHandles, scoreHandle, probeAvailability, persistCandidates } from '../services/aiaps/username-engine';
import { provisionEmails } from '../services/aiaps/email-engine';
import { purchasePhone, releasePhone } from '../services/aiaps/phone-engine';
import { generateWarmupTasks, advanceTask } from '../services/aiaps/warmup-engine';
import { snapshotHealth, autoCreateIncidents } from '../services/aiaps/health-engine';
import { recomputeReadiness } from '../services/aiaps/readiness';
import { runComplianceChecks } from '../services/aiaps/compliance';
import { provisionAccount, transitionAccount, ACCOUNT_STATES } from '../services/aiaps/provisioning-engine';
import { vaultPut, vaultReveal, vaultList } from '../services/aiaps/vault';
import { listAdapters } from '../services/aiaps/adapters';
import { logAudit, auditFromReq } from '../services/aiaps/audit';
import { enqueueJob, claimJob, reportJob, listJobs, jobStats } from '../services/aiaps/job-queue';
import { upsertOperator, listOperators } from '../services/aiaps/rbac';
import { generateArtistImages } from '../services/aiaps/image-engine';
import { runDiagnostic } from '../services/aiaps/diagnostic';

const router = Router();

let bootstrapped = false;
async function ensureTables() {
  if (bootstrapped) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiaps_artists (
      id VARCHAR(64) PRIMARY KEY,
      stage_name VARCHAR(255) NOT NULL,
      internal_owner VARCHAR(255),
      artist_type VARCHAR(64),
      primary_language VARCHAR(64),
      secondary_languages JSONB,
      country VARCHAR(128),
      city VARCHAR(128),
      genre_primary VARCHAR(64),
      genre_secondary JSONB,
      visual_style VARCHAR(128),
      aesthetic_keywords JSONB,
      brand_voice TEXT,
      audience_type VARCHAR(128),
      target_markets JSONB,
      short_bio TEXT,
      long_bio TEXT,
      slogan VARCHAR(255),
      tagline VARCHAR(255),
      legal_notes TEXT,
      ai_disclosure_flags JSONB,
      link_hub VARCHAR(512),
      landing_page_url VARCHAR(512),
      profile_image_url VARCHAR(512),
      banner_url VARCHAR(512),
      media_assets JSONB,
      readiness_score INTEGER DEFAULT 0,
      launch_status VARCHAR(64) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS aiaps_social_accounts (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(64) NOT NULL,
      platform VARCHAR(32) NOT NULL,
      username VARCHAR(128),
      status VARCHAR(48) DEFAULT 'draft',
      email_asset_id INTEGER,
      phone_asset_id INTEGER,
      vault_ref VARCHAR(256),
      profile_url VARCHAR(512),
      last_event_at TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_social_artist ON aiaps_social_accounts(artist_id);
    CREATE INDEX IF NOT EXISTS idx_aiaps_social_platform ON aiaps_social_accounts(platform);

    CREATE TABLE IF NOT EXISTS aiaps_username_candidates (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(64) NOT NULL,
      platform VARCHAR(32),
      handle VARCHAR(128) NOT NULL,
      score INTEGER DEFAULT 0,
      availability VARCHAR(32) DEFAULT 'unknown',
      conflicts JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_usernames_artist ON aiaps_username_candidates(artist_id);

    CREATE TABLE IF NOT EXISTS aiaps_email_assets (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(64) NOT NULL,
      role VARCHAR(32) NOT NULL,
      address VARCHAR(255) NOT NULL,
      provider VARCHAR(64),
      status VARCHAR(32) DEFAULT 'pending',
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_email_artist ON aiaps_email_assets(artist_id);

    CREATE TABLE IF NOT EXISTS aiaps_phone_assets (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(64),
      number VARCHAR(32) NOT NULL,
      provider VARCHAR(64),
      country VARCHAR(64),
      purpose VARCHAR(64),
      platforms JSONB,
      cost_cents INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_phone_artist ON aiaps_phone_assets(artist_id);

    CREATE TABLE IF NOT EXISTS aiaps_verification_events (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(64),
      platform VARCHAR(32),
      channel VARCHAR(16),
      subject VARCHAR(255),
      code VARCHAR(64),
      received_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP,
      status VARCHAR(32) DEFAULT 'new',
      operator VARCHAR(128)
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_verif_artist ON aiaps_verification_events(artist_id);

    CREATE TABLE IF NOT EXISTS aiaps_warmup_tasks (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(64) NOT NULL,
      platform VARCHAR(32),
      phase INTEGER DEFAULT 1,
      action VARCHAR(128),
      status VARCHAR(32) DEFAULT 'pending',
      priority VARCHAR(16) DEFAULT 'normal',
      risk VARCHAR(16) DEFAULT 'low',
      scheduled_at TIMESTAMP,
      completed_at TIMESTAMP,
      result JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_warmup_artist ON aiaps_warmup_tasks(artist_id);

    CREATE TABLE IF NOT EXISTS aiaps_health_reports (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(64) NOT NULL,
      platform VARCHAR(32),
      health_score INTEGER DEFAULT 100,
      status VARCHAR(32) DEFAULT 'healthy',
      alerts JSONB,
      recommendations JSONB,
      reported_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_health_artist ON aiaps_health_reports(artist_id);

    CREATE TABLE IF NOT EXISTS aiaps_incidents (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(64),
      platform VARCHAR(32),
      severity VARCHAR(16) DEFAULT 'warn',
      title VARCHAR(255),
      description TEXT,
      status VARCHAR(32) DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_inc_artist ON aiaps_incidents(artist_id);
  `);
  bootstrapped = true;
}

// ---------------------------------------------------------------------------
// Platform catalog — initial + future extensions
// ---------------------------------------------------------------------------
const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', enabled: true },
  { id: 'tiktok', name: 'TikTok', enabled: true },
  { id: 'youtube', name: 'YouTube', enabled: false },
  { id: 'x', name: 'X / Twitter', enabled: false },
  { id: 'facebook', name: 'Facebook', enabled: false },
  { id: 'spotify', name: 'Spotify for Artists', enabled: false },
  { id: 'soundcloud', name: 'SoundCloud', enabled: false },
  { id: 'threads', name: 'Threads', enabled: false },
  { id: 'discord', name: 'Discord', enabled: false },
  { id: 'telegram', name: 'Telegram', enabled: false },
];

// Flow steps shown on the dashboard master flow strip
const FLOW_STEPS = [
  { n: 1, id: 'create', label: 'Crear Artista', icon: 'user' },
  { n: 2, id: 'identity', label: 'Identity Package', icon: 'fingerprint' },
  { n: 3, id: 'usernames', label: 'Usernames', icon: 'at' },
  { n: 4, id: 'email', label: 'Email & Recovery', icon: 'mail' },
  { n: 5, id: 'phone', label: 'Phone Asset', icon: 'phone' },
  { n: 6, id: 'assets', label: 'Bios & Assets', icon: 'image' },
  { n: 7, id: 'accounts', label: 'Cuentas por Plataforma', icon: 'grid' },
  { n: 8, id: 'provision', label: 'Provisión', icon: 'rocket' },
  { n: 9, id: 'verify', label: 'Verificación', icon: 'shield' },
  { n: 10, id: 'profile', label: 'Perfil Inicial', icon: 'user-check' },
  { n: 11, id: 'secured', label: 'Secured', icon: 'lock' },
  { n: 12, id: 'warmup', label: 'Warm-up', icon: 'flame' },
  { n: 13, id: 'monitor', label: 'Monitoreo', icon: 'activity' },
  { n: 14, id: 'active', label: 'Active', icon: 'check' },
];

const MODULES = [
  { id: 'identity', name: 'Identity Engine', desc: 'Genera identidad completa del artista', icon: 'fingerprint' },
  { id: 'username', name: 'Username Engine', desc: 'Genera y rankea usernames', icon: 'at' },
  { id: 'email', name: 'Email Engine', desc: 'Crea y administra correos', icon: 'mail' },
  { id: 'phone', name: 'Phone Manager', desc: 'Gestiona números y verificación', icon: 'phone' },
  { id: 'provisioning', name: 'Provisioning Console', desc: 'Gestiona flujo de creación', icon: 'rocket' },
  { id: 'inbox', name: 'Verification Inbox', desc: 'Recibe y organiza códigos OTP', icon: 'inbox' },
  { id: 'vault', name: 'Security Vault', desc: 'Almacena secretos de forma segura', icon: 'lock' },
  { id: 'warmup', name: 'Warm-up Engine', desc: 'Programa y ejecuta calentamiento', icon: 'flame' },
  { id: 'health', name: 'Health Monitor', desc: 'Monitorea salud y restricciones', icon: 'heart-pulse' },
  { id: 'compliance', name: 'Compliance', desc: 'Cumplimiento y políticas', icon: 'shield-check' },
  { id: 'audit', name: 'Audit Logs', desc: 'Registra todas las acciones', icon: 'scroll' },
  { id: 'extensions', name: 'Extensions', desc: 'Nuevas plataformas y configuraciones', icon: 'puzzle' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getOrSeedFeaturedArtist() {
  const { rows } = await pool.query(
    `SELECT * FROM aiaps_artists ORDER BY updated_at DESC LIMIT 1`,
  );
  if (rows.length) return rows[0];

  // Seed a demo artist matching the reference mockup (LUNA VANTA)
  const seed = {
    id: 'BTF_0001',
    stage_name: 'LUNA VANTA',
    internal_owner: 'Boostify',
    artist_type: 'Artista Virtual',
    primary_language: 'Español',
    secondary_languages: JSON.stringify(['Inglés']),
    country: 'Estados Unidos',
    city: 'Los Angeles',
    genre_primary: 'Dark Pop',
    genre_secondary: JSON.stringify(['Electronic', 'Cinematic']),
    visual_style: 'dark-pop cinematic',
    aesthetic_keywords: JSON.stringify(['futuristic', 'mystical', 'bold']),
    brand_voice: 'dark-pop cinematic',
    audience_type: 'Gen Z → Millennial',
    target_markets: JSON.stringify(['US', 'LATAM', 'España']),
    short_bio:
      'Cantante y compositora explorando la oscuridad, la belleza y la emoción a través de la música.',
    long_bio:
      'LUNA VANTA es un proyecto audiovisual nacido en el ecosistema Boostify. Fusiona dark-pop cinemático con narrativas visuales de alto impacto.',
    slogan: 'Light from the dark.',
    tagline: 'Dark-pop. Cinematic.',
    link_hub: 'link.boostify.com/lunavanta',
    landing_page_url: 'https://boostifymusic.com/artist/luna-vanta',
    readiness_score: 92,
    launch_status: 'identity_ready',
  };
  const cols = Object.keys(seed);
  const vals = Object.values(seed);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
  await pool.query(
    `INSERT INTO aiaps_artists (${cols.join(',')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
    vals,
  );

  // Seed social accounts
  const accts: Array<[string, string, string]> = [
    ['instagram', 'lunavanta', 'profile_configured'],
    ['tiktok', '@lunavanta.music', 'verification_pending'],
    ['youtube', 'Luna Vanta', 'pending_signup'],
    ['x', '@lunavanta_official', 'pending'],
    ['spotify', 'Luna Vanta', 'pending'],
  ];
  for (const [platform, username, status] of accts) {
    await pool.query(
      `INSERT INTO aiaps_social_accounts (artist_id, platform, username, status) VALUES ($1,$2,$3,$4)`,
      [seed.id, platform, username, status],
    );
  }

  // Seed usernames
  const unames: Array<[string, number]> = [
    ['lunavanta', 98],
    ['lunavanta.music', 96],
    ['officiallunavanta', 92],
  ];
  for (const [h, s] of unames) {
    await pool.query(
      `INSERT INTO aiaps_username_candidates (artist_id, handle, score) VALUES ($1,$2,$3)`,
      [seed.id, h, s],
    );
  }

  // Seed emails
  await pool.query(
    `INSERT INTO aiaps_email_assets (artist_id, role, address, status) VALUES
      ($1,'primary','lunavanta@artists.boostify.com','verified'),
      ($1,'recovery','recovery+lunavanta@boostify.com','verified')`,
    [seed.id],
  );

  // Seed phone
  await pool.query(
    `INSERT INTO aiaps_phone_assets (artist_id, number, provider, country, purpose, platforms, active)
     VALUES ($1,'+1 (305) 555-0147','twilio','USA','verification',$2,TRUE)`,
    [seed.id, JSON.stringify(['instagram', 'tiktok'])],
  );

  // Seed warmup (phase 2)
  const warmup = [
    [2, 'instagram', 'Publicaciones iniciales', 'completed'],
    [2, 'instagram', 'Seguimiento ligero', 'completed'],
    [2, 'instagram', 'Interacción mínima', 'completed'],
    [2, 'instagram', 'Contenido temático', 'in_progress'],
    [2, 'instagram', 'Colaboraciones internas', 'pending'],
  ];
  for (const [phase, platform, action, status] of warmup) {
    await pool.query(
      `INSERT INTO aiaps_warmup_tasks (artist_id, platform, phase, action, status) VALUES ($1,$2,$3,$4,$5)`,
      [seed.id, platform, phase, action, status],
    );
  }

  // Seed incidents / alerts
  await pool.query(
    `INSERT INTO aiaps_incidents (artist_id, platform, severity, title) VALUES
      ($1,'tiktok','warn','Verificación pendiente'),
      ($1,'instagram','info','Sin actividad 48h')`,
    [seed.id],
  );

  // Seed verification inbox
  await pool.query(
    `INSERT INTO aiaps_verification_events (artist_id, platform, channel, subject, code, status) VALUES
      ($1,'tiktok','sms','TikTok - Código de verificación','842731','new'),
      ($1,'instagram','email','Instagram - Confirm your email','156892','new'),
      ($1,'boostify','email','Boostify - Recovery Code','983441','new')`,
    [seed.id],
  );

  const { rows: r2 } = await pool.query(
    `SELECT * FROM aiaps_artists WHERE id = $1`,
    [seed.id],
  );
  return r2[0];
}

function relTime(d: Date | string | null): string {
  if (!d) return '';
  const t = typeof d === 'string' ? new Date(d) : d;
  const s = Math.max(1, Math.floor((Date.now() - t.getTime()) / 1000));
  if (s < 60) return `Hace ${s}s`;
  if (s < 3600) return `Hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `Hace ${Math.floor(s / 3600)}h`;
  return `Hace ${Math.floor(s / 86400)}d`;
}

// ---------------------------------------------------------------------------
// Middleware (admin only)
// ---------------------------------------------------------------------------
router.use(async (req, res, next) => {
  try { await ensureTables(); } catch (err) {
    console.error('[AIAPS] bootstrap failed', err);
  }
  return (requireAdmin as any)(req, res, next);
});

// ---------------------------------------------------------------------------
// GET /overview — powers the main dashboard
// ---------------------------------------------------------------------------
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const artist = await getOrSeedFeaturedArtist();
    const aid = artist.id;

    const [accountsQ, usernamesQ, emailsQ, phonesQ, warmupQ, incidentsQ, verifQ, countsQ] =
      await Promise.all([
        pool.query(
          `SELECT platform, username, status FROM aiaps_social_accounts WHERE artist_id=$1 ORDER BY id ASC`,
          [aid],
        ),
        pool.query(
          `SELECT handle, score FROM aiaps_username_candidates WHERE artist_id=$1 ORDER BY score DESC LIMIT 6`,
          [aid],
        ),
        pool.query(
          `SELECT role, address, status FROM aiaps_email_assets WHERE artist_id=$1 ORDER BY id ASC`,
          [aid],
        ),
        pool.query(
          `SELECT number, provider, country, active FROM aiaps_phone_assets WHERE artist_id=$1 ORDER BY id ASC LIMIT 1`,
          [aid],
        ),
        pool.query(
          `SELECT phase, action, status FROM aiaps_warmup_tasks WHERE artist_id=$1 ORDER BY id ASC`,
          [aid],
        ),
        pool.query(
          `SELECT id, platform, severity, title, created_at FROM aiaps_incidents WHERE artist_id=$1 AND status='open' ORDER BY created_at DESC LIMIT 10`,
          [aid],
        ),
        pool.query(
          `SELECT id, platform, subject, code, received_at, status FROM aiaps_verification_events WHERE artist_id=$1 ORDER BY received_at DESC LIMIT 20`,
          [aid],
        ),
        pool.query(
          `SELECT
             (SELECT COUNT(*) FROM aiaps_artists)::int AS artists,
             (SELECT COUNT(*) FROM aiaps_social_accounts)::int AS accounts,
             (SELECT COUNT(*) FROM aiaps_verification_events WHERE status='new')::int AS verifications_pending,
             (SELECT COUNT(*) FROM aiaps_incidents WHERE status='open')::int AS incidents_open`,
        ),
      ]);

    const accounts = accountsQ.rows;
    const usernames = usernamesQ.rows;
    const emails = emailsQ.rows;
    const phone = phonesQ.rows[0] || null;
    const warmup = warmupQ.rows;
    const incidents = incidentsQ.rows.map((i) => ({
      ...i,
      time: relTime(i.created_at),
    }));
    const verifications = verifQ.rows.map((v) => ({
      ...v,
      time: relTime(v.received_at),
    }));
    const counts = countsQ.rows[0];

    // Health summary (derived)
    const total = accounts.length || 1;
    const healthy = accounts.filter((a) => ['active', 'profile_configured', 'secured'].includes(a.status)).length;
    const warning = accounts.filter((a) => ['verification_pending', 'otp_required', 'warming'].includes(a.status)).length;
    const risk = accounts.filter((a) => ['restricted', 'recovery_needed'].includes(a.status)).length;
    const inactive = accounts.filter((a) => ['pending', 'pending_signup', 'draft', 'archived'].includes(a.status)).length;
    const healthScore = Math.round(
      ((healthy * 100 + warning * 70 + inactive * 50 + risk * 10) / (total * 100)) * 100,
    );

    // Warm-up progress
    const warmDone = warmup.filter((t) => t.status === 'completed').length;
    const warmTotal = warmup.length || 1;
    const warmPct = Math.round((warmDone / warmTotal) * 100);
    const warmPhase = warmup[0]?.phase || 1;

    res.json({
      ok: true,
      artist,
      accounts,
      usernames,
      emails,
      phone,
      warmup,
      incidents,
      verifications,
      counts,
      health: {
        score: healthScore,
        healthy,
        warning,
        risk,
        inactive,
      },
      warmupProgress: {
        phase: warmPhase,
        percent: warmPct,
      },
      platforms: PLATFORMS,
      flow: FLOW_STEPS,
      modules: MODULES,
      providers: {
        twilio: !!process.env.TWILIO_ACCOUNT_SID,
        sendgrid: !!process.env.SENDGRID_API_KEY,
        brevo: !!process.env.BREVO_API_KEY,
        resend: !!process.env.RESEND_API_KEY,
        firestore: !!process.env.FIREBASE_PROJECT_ID,
        openai: !!process.env.OPENAI_API_KEY,
        cloudinary: !!process.env.CLOUDINARY_URL,
      },
    });
  } catch (err: any) {
    console.error('[AIAPS] /overview failed', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /artists — list artists
// ---------------------------------------------------------------------------
router.get('/artists', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, stage_name, country, genre_primary, launch_status, readiness_score, updated_at
       FROM aiaps_artists ORDER BY updated_at DESC LIMIT 200`,
    );
    res.json({ ok: true, items: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /artists/:id — full identity package + related assets
router.get('/artists/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const [a, accts, uns, emails, phones, warmup] = await Promise.all([
      pool.query(`SELECT * FROM aiaps_artists WHERE id=$1`, [id]),
      pool.query(`SELECT * FROM aiaps_social_accounts WHERE artist_id=$1`, [id]),
      pool.query(`SELECT * FROM aiaps_username_candidates WHERE artist_id=$1 ORDER BY score DESC`, [id]),
      pool.query(`SELECT * FROM aiaps_email_assets WHERE artist_id=$1`, [id]),
      pool.query(`SELECT * FROM aiaps_phone_assets WHERE artist_id=$1`, [id]),
      pool.query(`SELECT * FROM aiaps_warmup_tasks WHERE artist_id=$1 ORDER BY id`, [id]),
    ]);
    if (!a.rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({
      ok: true,
      artist: a.rows[0],
      accounts: accts.rows,
      usernames: uns.rows,
      emails: emails.rows,
      phones: phones.rows,
      warmup: warmup.rows,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Simple sub-collection listers (for full admin sidebar navigation)
// ---------------------------------------------------------------------------
const listers: Record<string, string> = {
  'social-accounts': 'SELECT * FROM aiaps_social_accounts ORDER BY id DESC LIMIT 500',
  'usernames': 'SELECT * FROM aiaps_username_candidates ORDER BY score DESC LIMIT 500',
  'emails': 'SELECT * FROM aiaps_email_assets ORDER BY id DESC LIMIT 500',
  'phones': 'SELECT * FROM aiaps_phone_assets ORDER BY id DESC LIMIT 500',
  'verifications': 'SELECT * FROM aiaps_verification_events ORDER BY received_at DESC LIMIT 500',
  'warmup': 'SELECT * FROM aiaps_warmup_tasks ORDER BY id DESC LIMIT 500',
  'health': 'SELECT * FROM aiaps_health_reports ORDER BY reported_at DESC LIMIT 500',
  'incidents': 'SELECT * FROM aiaps_incidents ORDER BY created_at DESC LIMIT 500',
};
for (const [key, sql] of Object.entries(listers)) {
  router.get(`/${key}`, async (_req, res) => {
    try {
      const { rows } = await pool.query(sql);
      res.json({ ok: true, items: rows });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

// ---------------------------------------------------------------------------
// POST /artists — create a new artist identity (minimal intake)
// ---------------------------------------------------------------------------
router.post('/artists', async (req: Request, res: Response) => {
  try {
    const { id, stage_name, country, genre_primary, short_bio } = req.body || {};
    if (!id || !stage_name) {
      return res.status(400).json({ ok: false, error: 'id + stage_name required' });
    }
    await pool.query(
      `INSERT INTO aiaps_artists (id, stage_name, country, genre_primary, short_bio)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         stage_name=EXCLUDED.stage_name,
         country=EXCLUDED.country,
         genre_primary=EXCLUDED.genre_primary,
         short_bio=EXCLUDED.short_bio,
         updated_at=NOW()`,
      [id, stage_name, country || null, genre_primary || null, short_bio || null],
    );
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /verifications/:id/ack — mark an OTP event as handled
// ---------------------------------------------------------------------------
router.post('/verifications/:id/ack', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(
      `UPDATE aiaps_verification_events SET status='used' WHERE id=$1`,
      [id],
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /incidents/:id/resolve
// ---------------------------------------------------------------------------
router.post('/incidents/:id/resolve', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(
      `UPDATE aiaps_incidents SET status='resolved', resolved_at=NOW() WHERE id=$1`,
      [id],
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /audit — recent audit_log entries (best-effort, table may not exist)
// ---------------------------------------------------------------------------
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
    const { rows } = await pool.query(
      `SELECT id, action, actor_email AS "actorEmail", target_type AS "targetType", target_id AS "targetId",
              ip, severity, created_at AS "createdAt"
       FROM audit_log ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    res.json({ ok: true, items: rows });
  } catch (err: any) {
    // audit_log may not exist yet in fresh deployments
    res.json({ ok: true, items: [], note: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /platforms — catalog
// ---------------------------------------------------------------------------
router.get('/platforms', (_req, res) => {
  res.json({ ok: true, platforms: PLATFORMS, adapters: listAdapters().map((a) => ({ platform: a.platform, enabled: a.enabled, capabilities: a.capabilities })) });
});

// ===========================================================================
// ACTION ENDPOINTS — execute real work
// ===========================================================================

// ---- Identity generation --------------------------------------------------
router.post('/artists/:id/generate-identity', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { rows } = await pool.query('SELECT * FROM aiaps_artists WHERE id=$1', [id]);
    const a = rows[0];
    if (!a) return res.status(404).json({ ok: false, error: 'not_found' });
    const identity = await generateIdentity({
      stage_name: a.stage_name,
      genre_primary: a.genre_primary,
      country: a.country,
      city: a.city,
      visual_style: a.visual_style,
      audience_type: a.audience_type,
      artist_type: a.artist_type,
      primary_language: a.primary_language,
    });
    await applyIdentity(id, identity);
    await logAudit({ action: 'aiaps.identity.generated', targetType: 'artist', targetId: id, ...auditFromReq(req) });
    res.json({ ok: true, identity });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Username generation + availability ----------------------------------
router.post('/artists/:id/generate-usernames', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { rows } = await pool.query('SELECT stage_name FROM aiaps_artists WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    const handles = generateHandles(rows[0].stage_name);
    const platforms: string[] = Array.isArray(req.body?.platforms) && req.body.platforms.length
      ? req.body.platforms
      : ['instagram', 'tiktok'];
    const probeLimit = Math.min(8, handles.length);
    const candidates: Array<{ handle: string; score: number; platform: string; availability: string }> = [];
    for (const platform of platforms) {
      for (let i = 0; i < probeLimit; i++) {
        const h = handles[i];
        const avail = await probeAvailability(h, platform);
        candidates.push({ handle: h, score: scoreHandle(h, rows[0].stage_name), platform, availability: avail });
      }
    }
    const inserted = await persistCandidates(id, candidates);
    await logAudit({ action: 'aiaps.usernames.generated', targetType: 'artist', targetId: id, ...auditFromReq(req), meta: { inserted, platforms } });
    res.json({ ok: true, candidates, inserted });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Email provisioning ---------------------------------------------------
router.post('/artists/:id/provision-emails', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { rows } = await pool.query('SELECT stage_name FROM aiaps_artists WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    const created = await provisionEmails(id, rows[0].stage_name, { provider: req.body?.provider });
    await logAudit({ action: 'aiaps.emails.provisioned', targetType: 'artist', targetId: id, ...auditFromReq(req), meta: { count: created.length } });
    res.json({ ok: true, created });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Phone purchase / release --------------------------------------------
router.post('/artists/:id/purchase-phone', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await purchasePhone(id, {
      country: req.body?.country,
      areaCode: req.body?.areaCode,
      purpose: req.body?.purpose,
      platforms: req.body?.platforms,
    });
    await logAudit({ action: 'aiaps.phone.purchased', targetType: 'artist', targetId: id, ...auditFromReq(req), meta: result });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/phones/:id/release', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = await releasePhone(id);
    await logAudit({ action: 'aiaps.phone.released', targetType: 'phone', targetId: id, ...auditFromReq(req) });
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Provisioning state machine ------------------------------------------
router.post('/artists/:id/provision-account', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { platform, username } = req.body || {};
    if (!platform) return res.status(400).json({ ok: false, error: 'platform required' });
    const result = await provisionAccount(id, platform, { username });
    await logAudit({ action: 'aiaps.account.provisioned', targetType: 'social_account', targetId: result.id, ...auditFromReq(req), meta: { platform } });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/social-accounts/:id/transition', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { to } = req.body || {};
    if (!ACCOUNT_STATES.includes(to)) return res.status(400).json({ ok: false, error: 'invalid_state' });
    const result = await transitionAccount(id, to);
    await logAudit({ action: 'aiaps.account.transition', targetType: 'social_account', targetId: id, ...auditFromReq(req), meta: result });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Warm-up -------------------------------------------------------------
router.post('/artists/:id/warmup/generate', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const platform = req.body?.platform || 'instagram';
    const phase = parseInt(req.body?.phase || '1', 10);
    const n = await generateWarmupTasks(id, platform, phase);
    await logAudit({ action: 'aiaps.warmup.generated', targetType: 'artist', targetId: id, ...auditFromReq(req), meta: { platform, phase, n } });
    res.json({ ok: true, inserted: n });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/warmup/:id/advance', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, result } = req.body || {};
    if (!['in_progress', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'invalid_status' });
    }
    await advanceTask(id, status, result);
    await logAudit({ action: 'aiaps.warmup.advance', targetType: 'warmup_task', targetId: id, ...auditFromReq(req), meta: { status } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Health --------------------------------------------------------------
router.post('/health/snapshot', async (req: Request, res: Response) => {
  try {
    const artistId = req.body?.artist_id;
    const written = await snapshotHealth(artistId);
    const incidents = await autoCreateIncidents();
    await logAudit({ action: 'aiaps.health.snapshot', ...auditFromReq(req), meta: { written, incidents } });
    res.json({ ok: true, written, incidents });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Readiness -----------------------------------------------------------
router.post('/artists/:id/recompute-readiness', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const score = await recomputeReadiness(id);
    res.json({ ok: true, score });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Compliance ----------------------------------------------------------
router.get('/artists/:id/compliance', async (req: Request, res: Response) => {
  try {
    const result = await runComplianceChecks(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Vault ---------------------------------------------------------------
router.post('/vault/put', async (req: Request, res: Response) => {
  try {
    const { artist_id, kind, label, plaintext } = req.body || {};
    if (!kind || !label || !plaintext) return res.status(400).json({ ok: false, error: 'kind/label/plaintext required' });
    const ref = await vaultPut(artist_id || null, kind, label, plaintext);
    await logAudit({ action: 'aiaps.vault.put', targetType: 'vault', targetId: ref, ...auditFromReq(req), meta: { kind, label } });
    res.json({ ok: true, ref });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/vault', async (req: Request, res: Response) => {
  try {
    const items = await vaultList(req.query.artist_id ? String(req.query.artist_id) : undefined);
    res.json({ ok: true, items });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/vault/reveal', async (req: Request, res: Response) => {
  try {
    const { ref } = req.body || {};
    if (!ref) return res.status(400).json({ ok: false, error: 'ref required' });
    const plaintext = await vaultReveal(ref);
    await logAudit({
      action: 'aiaps.vault.reveal',
      targetType: 'vault',
      targetId: ref,
      severity: 'warn',
      ...auditFromReq(req),
    });
    res.json({ ok: !!plaintext, plaintext });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Image generation ----------------------------------------------------
router.post('/artists/:id/generate-images', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const specs = Array.isArray(req.body?.specs) && req.body.specs.length
      ? req.body.specs
      : [{ kind: 'profile' }, { kind: 'banner' }];
    const result = await generateArtistImages(id, specs);
    await logAudit({ action: 'aiaps.images.generated', targetType: 'artist', targetId: id, ...auditFromReq(req), meta: { count: result.length } });
    res.json({ ok: true, images: result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Bulk: generate images for every artist missing a profile or banner.
router.post('/artists/generate-missing-images', async (req: Request, res: Response) => {
  try {
    const { pool } = await import('../services/aiaps/db');
    const { rows } = await pool.query(
      `SELECT id, profile_image_url, banner_url FROM aiaps_artists
       WHERE profile_image_url IS NULL OR banner_url IS NULL`,
    );
    const results: any[] = [];
    for (const a of rows) {
      const specs: any[] = [];
      if (!a.profile_image_url) specs.push({ kind: 'profile' });
      if (!a.banner_url) specs.push({ kind: 'banner' });
      try {
        const out = await generateArtistImages(a.id, specs);
        results.push({ id: a.id, ok: true, count: out.length });
      } catch (err: any) {
        results.push({ id: a.id, ok: false, error: err.message });
      }
    }
    await logAudit({ action: 'aiaps.images.bulk_generated', targetType: 'artists', ...auditFromReq(req), meta: { processed: results.length } });
    res.json({ ok: true, processed: results.length, results });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Operators (RBAC) ----------------------------------------------------
router.get('/operators', async (_req: Request, res: Response) => {
  try {
    const items = await listOperators();
    res.json({ ok: true, items });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/operators', async (req: Request, res: Response) => {
  try {
    const { email, role, display_name, allowed_platforms, allowed_artists, active } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: 'email required' });
    const op = await upsertOperator(email, { role, display_name, allowed_platforms, allowed_artists, active });
    await logAudit({ action: 'aiaps.operator.upsert', targetType: 'operator', targetId: op.id, ...auditFromReq(req), meta: { email, role } });
    res.json({ ok: true, operator: op });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Job queue (bridge to Chrome extension / worker) ---------------------
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const items = await listJobs({
      status: req.query.status ? String(req.query.status) : undefined,
      kind: req.query.kind ? String(req.query.kind) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 100,
    });
    const stats = await jobStats();
    res.json({ ok: true, items, stats });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/jobs', async (req: Request, res: Response) => {
  try {
    const { kind, platform, artist_id, account_id, payload, priority, maxAttempts } = req.body || {};
    if (!kind) return res.status(400).json({ ok: false, error: 'kind required' });
    const id = await enqueueJob({ kind, platform, artistId: artist_id, accountId: account_id, payload, priority, maxAttempts });
    await logAudit({ action: 'aiaps.job.enqueued', targetType: 'job', targetId: id, ...auditFromReq(req), meta: { kind, platform } });
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/jobs/claim', async (req: Request, res: Response) => {
  try {
    const { worker_id, kinds, platforms } = req.body || {};
    if (!worker_id) return res.status(400).json({ ok: false, error: 'worker_id required' });
    const job = await claimJob(worker_id, { kinds, platforms });
    res.json({ ok: true, job });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/jobs/:id/report', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { worker_id, ok, data, error } = req.body || {};
    if (!worker_id) return res.status(400).json({ ok: false, error: 'worker_id required' });
    const applied = await reportJob(id, worker_id, { ok: !!ok, data, error });
    await logAudit({ action: 'aiaps.job.reported', targetType: 'job', targetId: id, ...auditFromReq(req), severity: ok ? 'info' : 'warn' });
    res.json({ ok: applied });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- System diagnostic ---------------------------------------------------
router.get('/diagnostic', async (_req: Request, res: Response) => {
  try {
    const report = await runDiagnostic();
    res.json({ ok: true, ...report });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
