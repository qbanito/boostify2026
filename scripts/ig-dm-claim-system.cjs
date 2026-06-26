#!/usr/bin/env node
/**
 * Instagram DM Claim System — controlled outreach for email-less leads
 * ════════════════════════════════════════════════════════════════════
 *
 * MANY potential clients have NO email but DO have Instagram. The play:
 *   1. Import the IG leads (Apify "Instagram profile/email scraper" CSV).
 *   2. Auto-build a pre-built, CLAIMABLE artist profile for each (reuses the
 *      same Claim Loop the email funnel uses: users.isAIGenerated=true + a
 *      signed /claim?token=… link that resolves by slug+userId — NO email
 *      required).
 *   3. Produce a ready-to-send "DM pack" per lead: the personalized image
 *      (their own IG photo, which is also their pre-built profile picture),
 *      the claim link, and the DM copy (ES + EN).
 *   4. Export everything to a CSV so the DMs are sent **controlled /
 *      semi-manually** (you or a VA paste them in Instagram).
 *
 * ⚠️  SAFETY: this tool does NOT auto-send Instagram DMs. Instagram has no
 *     official cold-DM API and bulk-automating DMs violates its ToS and gets
 *     accounts banned fast. This generates everything you need to send the
 *     DMs by hand / with a human in the loop ("dm controlados").
 *
 * Dry-run by default. Pass --commit to write to the DB / export files.
 *
 * Subcommands
 * ───────────
 *   import   --file=<path.csv> [--source=name] [--commit]
 *              Parse an Apify IG CSV and upsert leads into instagram_leads.
 *
 *   generate [--limit=N] [--lang=es|en|both] [--commit]
 *              For each lead without a profile yet: create the claimable
 *              profile, mint the claim link, build DM copy, export a CSV.
 *
 *   status     Counts by dm_status + a few sample rows.
 *
 *   mark-sent  --handle=<h>  (or --file=<csv with a `handle` column>) [--commit]
 *              Flag leads as DM'd so they're not exported again.
 *
 * Env: DATABASE_URL or SUPABASE_CONNECTION_STRING (Neon Postgres).
 *      JWT_SECRET / SESSION_SECRET (same chain the server uses to verify).
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// ─── Config ──────────────────────────────────────────────────────────────────
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://www.boostifymusic.com';
const JWT_SECRET =
  process.env.JWT_SECRET || process.env.SESSION_SECRET || 'boostify-activation-2026';
const CONN =
  process.env.DATABASE_URL || process.env.SUPABASE_CONNECTION_STRING || '';

// ─── Args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const SUBCOMMAND = (argv[0] && !argv[0].startsWith('--') ? argv[0] : 'help');
const args = argv.reduce((acc, a) => {
  if (!a.startsWith('--')) return acc;
  const [k, v] = a.replace(/^--/, '').split('=');
  acc[k] = v === undefined ? true : v;
  return acc;
}, {});

const COMMIT = args.commit === true || args.commit === 'true';
const DRY = !COMMIT;
const LIMIT = parseInt(args.limit || '0', 10); // 0 = all
const LANG = (args.lang || 'both').toLowerCase();

function log(...a) { console.log(...a); }
function tag() { return DRY ? '[DRY-RUN]' : '[COMMIT]'; }

// ─── DB ──────────────────────────────────────────────────────────────────────
function makePool() {
  if (!CONN) {
    console.error('❌ Missing DATABASE_URL / SUPABASE_CONNECTION_STRING');
    process.exit(1);
  }
  return new Pool({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
}

async function ensureSchema(pool) {
  // instagram_leads — dedicated channel for IG-sourced, often email-less leads.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instagram_leads (
      id                SERIAL PRIMARY KEY,
      handle            TEXT UNIQUE NOT NULL,
      profile_url       TEXT,
      full_name         TEXT,
      profile_image_url TEXT,
      bio               TEXT,
      followers         INTEGER,
      email             TEXT,
      source            TEXT DEFAULT 'instagram_apify',
      user_id           INTEGER,
      slug              TEXT,
      claim_url         TEXT,
      dm_text_es        TEXT,
      dm_text_en        TEXT,
      dm_status         TEXT DEFAULT 'new',
      raw               JSONB,
      imported_at       TIMESTAMPTZ DEFAULT NOW(),
      generated_at      TIMESTAMPTZ,
      sent_at           TIMESTAMPTZ,
      claimed_at        TIMESTAMPTZ
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_instagram_leads_status ON instagram_leads(dm_status)`
  );
}

// ─── CSV parsing (RFC-4180-ish: quotes, embedded commas/newlines) ────────────
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  text = text.replace(/^\uFEFF/, ''); // strip BOM
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((c) => (c || '').trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

// Find the first present value among header aliases (case-insensitive contains).
function pick(rowObj, aliases) {
  const keys = Object.keys(rowObj);
  for (const alias of aliases) {
    const k = keys.find((kk) => kk.toLowerCase() === alias.toLowerCase());
    if (k && rowObj[k]) return rowObj[k];
  }
  for (const alias of aliases) {
    const k = keys.find((kk) => kk.toLowerCase().includes(alias.toLowerCase()));
    if (k && rowObj[k]) return rowObj[k];
  }
  return '';
}

function normHandle(raw) {
  if (!raw) return '';
  let h = String(raw).trim();
  // full URL → take last path segment
  const m = h.match(/instagram\.com\/([^/?#]+)/i);
  if (m) h = m[1];
  h = h.replace(/^@/, '').replace(/\/+$/, '').trim().toLowerCase();
  // reject obviously-invalid
  if (!/^[a-z0-9._]{1,40}$/.test(h)) return '';
  if (['p', 'reel', 'reels', 'explore', 'stories', 'tv'].includes(h)) return '';
  return h;
}

function toInt(v) {
  if (!v) return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function extractLead(rowObj) {
  const handle = normHandle(
    pick(rowObj, ['username', 'handle', 'ownerUsername', 'profileUrl', 'profile url', 'url', 'inputUrl'])
  );
  if (!handle) return null;
  const fullName = pick(rowObj, ['fullName', 'full name', 'name', 'ownerFullName', 'displayName']) || handle;
  const profileImageUrl = pick(rowObj, ['profilePicUrl', 'profilePicUrlHD', 'profile pic', 'profileImage', 'imageUrl', 'avatar']);
  const bio = pick(rowObj, ['biography', 'bio', 'description']);
  const email = pick(rowObj, ['email', 'publicEmail', 'businessEmail', 'e-mail']).toLowerCase() || null;
  const followers = toInt(pick(rowObj, ['followersCount', 'followers', 'followerscount']));
  const profileUrl = pick(rowObj, ['profileUrl', 'profile url', 'url', 'inputUrl']) || `https://instagram.com/${handle}`;
  return {
    handle,
    fullName,
    profileImageUrl: profileImageUrl || null,
    bio: bio ? bio.slice(0, 800) : null,
    email: email && email.includes('@') ? email : null,
    followers,
    profileUrl,
    raw: rowObj,
  };
}

// ─── Slug ────────────────────────────────────────────────────────────────────
function baseSlug(name, handle) {
  let s = (name || handle || 'artist')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  if (!s) s = `ig-${handle}`.replace(/[^a-z0-9-]/g, '').slice(0, 50);
  return s;
}

async function uniqueSlug(pool, name, handle) {
  let base = baseSlug(name, handle);
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await pool.query('SELECT 1 FROM users WHERE slug=$1 LIMIT 1', [slug]);
    if (!rows.length) return slug;
    n += 1;
    slug = `${base}-${n}`.slice(0, 60);
    if (n > 50) return `${base}-${Date.now().toString(36)}`;
  }
}

// ─── Claim link (matches server verifyMagicLink: type 'artist_activation') ────
function mintClaimUrl({ slug, userId, handle, name }) {
  const token = jwt.sign(
    { type: 'artist_activation', s: slug, uid: userId, ig: handle, n: name },
    JWT_SECRET,
    { expiresIn: '90d' }
  );
  return `${PLATFORM_URL}/claim?token=${token}`;
}

// ─── DM copy ─────────────────────────────────────────────────────────────────
function dmCopy(name, claimUrl) {
  const first = (name || '').split(' ')[0] || 'artista';
  const firstEn = (name || '').split(' ')[0] || 'there';
  const es =
    `Hola ${first} 👋 En Boostify Music te armamos un perfil de artista profesional ` +
    `con tu música, videos e imagen — listo y gratis. Es tuyo, solo recl\u00e1malo en 1 clic 👇\n` +
    `${claimUrl}\n\n` +
    `(Te mando tu portada aqu\u00ed mismo 🎵)`;
  const en =
    `Hey ${firstEn} 👋 We built you a pro artist profile on Boostify Music — music, ` +
    `videos & visuals, ready and free. It's yours, just claim it in 1 tap 👇\n` +
    `${claimUrl}\n\n` +
    `(Sending your cover art right here 🎵)`;
  return { es, en };
}

// ─── CSV writer ──────────────────────────────────────────────────────────────
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeExport(rows) {
  const dir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = path.join(dir, `ig-dm-outreach-${stamp}.csv`);
  const headers = ['handle', 'full_name', 'profile_url', 'image_to_attach', 'claim_url', 'dm_text_es', 'dm_text_en'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.handle, r.full_name, r.profile_url, r.image_to_attach,
      r.claim_url, r.dm_text_es, r.dm_text_en,
    ].map(csvCell).join(','));
  }
  fs.writeFileSync(file, lines.join('\n'), 'utf-8');
  return file;
}

// ═════════════════════════════════════════════════════════════════════════════
// Subcommands
// ═════════════════════════════════════════════════════════════════════════════

async function cmdImport(pool) {
  const file = args.file;
  if (!file) { console.error('❌ --file=<path.csv> required'); process.exit(1); }
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  if (!fs.existsSync(abs)) { console.error(`❌ Not found: ${abs}`); process.exit(1); }
  const source = args.source || 'instagram_apify';

  const rows = parseCSV(fs.readFileSync(abs, 'utf-8'));
  log(`📥 ${tag()} ${rows.length} CSV rows from ${path.basename(abs)} (source=${source})`);

  let valid = 0, invalid = 0, inserted = 0, updated = 0;
  const seen = new Set();
  for (const r of rows) {
    const lead = extractLead(r);
    if (!lead) { invalid++; continue; }
    if (seen.has(lead.handle)) continue;
    seen.add(lead.handle);
    valid++;

    if (DRY) {
      if (valid <= 5) log(`   • @${lead.handle.padEnd(22)} ${lead.fullName}${lead.email ? '  <'+lead.email+'>' : ''}`);
      continue;
    }
    const res = await pool.query(
      `INSERT INTO instagram_leads (handle, profile_url, full_name, profile_image_url, bio, followers, email, source, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (handle) DO UPDATE SET
         full_name = COALESCE(EXCLUDED.full_name, instagram_leads.full_name),
         profile_image_url = COALESCE(EXCLUDED.profile_image_url, instagram_leads.profile_image_url),
         bio = COALESCE(EXCLUDED.bio, instagram_leads.bio),
         followers = COALESCE(EXCLUDED.followers, instagram_leads.followers),
         email = COALESCE(EXCLUDED.email, instagram_leads.email)
       RETURNING (xmax = 0) AS inserted`,
      [lead.handle, lead.profileUrl, lead.fullName, lead.profileImageUrl, lead.bio,
       lead.followers, lead.email, source, JSON.stringify(lead.raw)]
    );
    if (res.rows[0].inserted) inserted++; else updated++;
  }

  log(`\n✅ ${tag()} valid=${valid} invalid=${invalid}` +
      (DRY ? `  (run with --commit to write)` : `  inserted=${inserted} updated=${updated}`));
}

async function cmdGenerate(pool) {
  const limitSql = LIMIT > 0 ? `LIMIT ${LIMIT}` : '';
  const { rows: leads } = await pool.query(
    `SELECT * FROM instagram_leads
      WHERE user_id IS NULL AND dm_status IN ('new')
      ORDER BY COALESCE(followers,0) DESC, id ASC ${limitSql}`
  );
  log(`🛠  ${tag()} ${leads.length} leads to turn into claimable profiles + DM packs`);

  const exportRows = [];
  let created = 0;
  for (const lead of leads) {
    const slug = DRY ? baseSlug(lead.full_name, lead.handle) : await uniqueSlug(pool, lead.full_name, lead.handle);

    if (DRY) {
      const claimUrl = mintClaimUrl({ slug, userId: 0, handle: lead.handle, name: lead.full_name });
      const dm = dmCopy(lead.full_name, claimUrl);
      exportRows.push({
        handle: lead.handle, full_name: lead.full_name, profile_url: lead.profile_url,
        image_to_attach: lead.profile_image_url || '(none)', claim_url: claimUrl,
        dm_text_es: dm.es, dm_text_en: dm.en,
      });
      if (created < 3) {
        log(`\n   ── @${lead.handle} → /artist/${slug}`);
        log(`      claim: ${claimUrl.slice(0, 78)}…`);
        log(`      DM ES: ${dm.es.split('\n')[0]}`);
      }
      created++;
      continue;
    }

    // 1. create the pre-built, claimable artist profile (email-less is fine —
    //    claim resolves by slug+userId).
    const ins = await pool.query(
      `INSERT INTO users (role, artist_name, slug, first_name, last_name, biography,
                          profile_image, instagram_handle, is_ai_generated, page_mode,
                          created_at, updated_at)
       VALUES ('artist',$1,$2,$3,$4,$5,$6,$7,true,'artist',NOW(),NOW())
       RETURNING id`,
      [
        lead.full_name, slug,
        (lead.full_name || '').split(' ')[0] || null,
        (lead.full_name || '').split(' ').slice(1).join(' ') || null,
        lead.bio || null,
        lead.profile_image_url || null,
        lead.handle,
      ]
    );
    const userId = ins.rows[0].id;
    const claimUrl = mintClaimUrl({ slug, userId, handle: lead.handle, name: lead.full_name });
    const dm = dmCopy(lead.full_name, claimUrl);

    await pool.query(
      `UPDATE instagram_leads
          SET user_id=$1, slug=$2, claim_url=$3, dm_text_es=$4, dm_text_en=$5,
              dm_status='ready', generated_at=NOW()
        WHERE id=$6`,
      [userId, slug, claimUrl, dm.es, dm.en, lead.id]
    );

    exportRows.push({
      handle: lead.handle, full_name: lead.full_name, profile_url: lead.profile_url,
      image_to_attach: lead.profile_image_url || '(none)', claim_url: claimUrl,
      dm_text_es: LANG === 'en' ? '' : dm.es,
      dm_text_en: LANG === 'es' ? '' : dm.en,
    });
    created++;
  }

  if (exportRows.length) {
    const file = writeExport(exportRows);
    log(`\n📦 ${tag()} ${created} packs → ${path.relative(process.cwd(), file)}`);
  } else {
    log(`\n(no leads pending — import some first or all already generated)`);
  }
  if (DRY) log(`   Run with --commit to create profiles + persist claim links.`);
}

async function cmdStatus(pool) {
  const { rows } = await pool.query(
    `SELECT dm_status, COUNT(*)::int n FROM instagram_leads GROUP BY dm_status ORDER BY n DESC`
  );
  const total = rows.reduce((s, r) => s + r.n, 0);
  log(`📊 instagram_leads — ${total} total`);
  for (const r of rows) log(`   ${String(r.dm_status).padEnd(10)} ${r.n}`);
  const { rows: sample } = await pool.query(
    `SELECT handle, full_name, dm_status, slug FROM instagram_leads ORDER BY id DESC LIMIT 5`
  );
  if (sample.length) {
    log(`\n   recent:`);
    for (const s of sample) log(`   • @${s.handle.padEnd(20)} ${s.dm_status.padEnd(8)} ${s.slug || ''}`);
  }
}

async function cmdMarkSent(pool) {
  let handles = [];
  if (args.handle) handles = [normHandle(args.handle)];
  else if (args.file) {
    const abs = path.isAbsolute(args.file) ? args.file : path.join(process.cwd(), args.file);
    const rows = parseCSV(fs.readFileSync(abs, 'utf-8'));
    handles = rows.map((r) => normHandle(pick(r, ['handle', 'username', 'url']))).filter(Boolean);
  } else { console.error('❌ --handle=<h> or --file=<csv> required'); process.exit(1); }
  handles = [...new Set(handles.filter(Boolean))];
  log(`✉️  ${tag()} mark ${handles.length} lead(s) as sent`);
  if (DRY) { handles.slice(0, 10).forEach((h) => log(`   • @${h}`)); return; }
  const res = await pool.query(
    `UPDATE instagram_leads SET dm_status='sent', sent_at=NOW()
      WHERE handle = ANY($1) AND dm_status IN ('ready','new') RETURNING handle`,
    [handles]
  );
  log(`   updated ${res.rowCount}`);
}

function cmdHelp() {
  log(`Instagram DM Claim System — controlled outreach for email-less leads

Usage:
  node scripts/ig-dm-claim-system.cjs <import|generate|status|mark-sent> [flags]

  import   --file=leads.csv [--source=name] [--commit]
  generate [--limit=N] [--lang=es|en|both] [--commit]
  status
  mark-sent --handle=@user | --file=sent.csv [--commit]

Dry-run by default; add --commit to write. ⚠️ Does NOT auto-send DMs (ToS-safe).`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  if (SUBCOMMAND === 'help' || args.help) { cmdHelp(); return; }
  const pool = makePool();
  try {
    // Idempotent + non-destructive; needed so generate/status can read the table.
    await ensureSchema(pool);
    switch (SUBCOMMAND) {
      case 'import': await cmdImport(pool); break;
      case 'generate': await cmdGenerate(pool); break;
      case 'status': await cmdStatus(pool); break;
      case 'mark-sent': await cmdMarkSent(pool); break;
      default: cmdHelp();
    }
  } catch (err) {
    console.error('❌', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
