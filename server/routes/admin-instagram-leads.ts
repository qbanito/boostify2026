/**
 * Admin — Instagram Leads → claimable artist profiles
 * ════════════════════════════════════════════════════
 * Upload an Apify Instagram CSV, auto-build a pre-built (claimable) artist
 * profile for each lead (biography, image, handle…), and produce a "DM pack"
 * (claim link + image + ES/EN copy) for CONTROLLED, semi-manual outreach.
 *
 * ⚠️ Does NOT auto-send Instagram DMs (Instagram has no cold-DM API; bulk
 *    automation violates ToS). It generates everything for a human to send.
 *
 * Mounted at /api/admin/instagram-leads (requireAdmin).
 */

import { Router, type Request, type Response } from 'express';
import axios from 'axios';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { storage } from '../firebase';
import { requireAdmin } from '../middleware/require-admin';
import { generateClaimLink } from '../services/artist-activation/activation-tracker';
import { sendNotificationEmail } from '../services/brevo-email-service';
import { trackEvent } from '../services/artist-activation/activation-tracker';
import { buildClaimEmail, sendOutreachEmail } from '../services/artist-activation/outreach-email';

const router = Router();
router.use(requireAdmin);

// ─── Image mirroring ─────────────────────────────────────────────────────────
// Instagram CDN URLs (scontent-*.cdninstagram.com) block hotlinking from other
// domains (403) and carry signed tokens that EXPIRE. Stored as-is they fail to
// render on the profile/claim page. So we download the image once and re-host
// it on Firebase Storage (permanent, CORS-friendly). Returns the original URL
// as a safe fallback if anything goes wrong.
async function mirrorImageToFirebase(srcUrl: string | null | undefined, handle: string): Promise<string | null> {
  if (!srcUrl || typeof srcUrl !== 'string' || !/^https?:\/\//i.test(srcUrl)) return srcUrl || null;
  // Already on Firebase → nothing to do.
  if (/firebasestorage\.googleapis\.com/i.test(srcUrl)) return srcUrl;
  try {
    const dl = await axios.get<ArrayBuffer>(srcUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
      maxContentLength: 15 * 1024 * 1024,
    });
    const buffer = Buffer.from(dl.data);
    if (!buffer.length) return srcUrl;
    const contentType = (dl.headers['content-type'] as string) || 'image/jpeg';
    const ext = (contentType.split('/')[1] || 'jpg').split(';')[0];
    const safeHandle = (handle || 'lead').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'lead';
    const fileName = `instagram-leads/${safeHandle}_${Date.now()}.${ext}`;
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType }, validation: false });
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
  } catch (e: any) {
    console.warn(`[IGLeads] mirrorImageToFirebase failed for @${handle}:`, e?.message || e);
    return srcUrl; // fall back to original; better than nothing
  }
}

// ─── Schema (idempotent) ─────────────────────────────────────────────────────
let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await db.execute(sql`
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
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_instagram_leads_status ON instagram_leads(dm_status)`);
  await db.execute(sql`ALTER TABLE instagram_leads ADD COLUMN IF NOT EXISTS dm_lang TEXT DEFAULT 'en'`);
  schemaReady = true;
}

// ─── CSV parsing (RFC-4180-ish) ──────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
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

function pick(rowObj: Record<string, string>, aliases: string[]): string {
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

function normHandle(raw: string): string {
  if (!raw) return '';
  let h = String(raw).trim();
  const m = h.match(/instagram\.com\/([^/?#]+)/i);
  if (m) h = m[1];
  h = h.replace(/^@/, '').replace(/\/+$/, '').trim().toLowerCase();
  if (!/^[a-z0-9._]{1,40}$/.test(h)) return '';
  if (['p', 'reel', 'reels', 'explore', 'stories', 'tv'].includes(h)) return '';
  return h;
}

function toInt(v: string): number | null {
  if (!v) return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

interface IgLead {
  handle: string; fullName: string; profileImageUrl: string | null;
  bio: string | null; email: string | null; followers: number | null;
  profileUrl: string; raw: Record<string, string>;
}

function extractLead(rowObj: Record<string, string>): IgLead | null {
  const handle = normHandle(
    pick(rowObj, ['username', 'handle', 'ownerUsername', 'profileUrl', 'profile url', 'url', 'inputUrl'])
  );
  if (!handle) return null;
  const fullName = pick(rowObj, ['fullName', 'full name', 'name', 'ownerFullName', 'displayName']) || handle;
  const profileImageUrl = pick(rowObj, ['profilePicUrl', 'profilePicUrlHD', 'profile pic', 'profileImage', 'imageUrl', 'avatar']);
  const bio = pick(rowObj, ['biography', 'bio', 'description']);
  const emailRaw = pick(rowObj, ['email', 'publicEmail', 'businessEmail', 'e-mail']).toLowerCase();
  const followers = toInt(pick(rowObj, ['followersCount', 'followers', 'followerscount']));
  const profileUrl = pick(rowObj, ['profileUrl', 'profile url', 'url', 'inputUrl']) || `https://instagram.com/${handle}`;
  return {
    handle, fullName,
    profileImageUrl: profileImageUrl || null,
    bio: bio ? bio.slice(0, 800) : null,
    email: emailRaw && emailRaw.includes('@') ? emailRaw : null,
    followers, profileUrl, raw: rowObj,
  };
}

// ─── Slug ────────────────────────────────────────────────────────────────────
function baseSlug(name: string, handle: string): string {
  let s = (name || handle || 'artist')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  if (!s) s = `ig-${handle}`.replace(/[^a-z0-9-]/g, '').slice(0, 50);
  return s;
}

async function uniqueSlug(name: string, handle: string): Promise<string> {
  const base = baseSlug(name, handle);
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await db.execute(sql`SELECT 1 FROM users WHERE slug = ${slug} LIMIT 1`);
    if (!rows.length) return slug;
    n += 1;
    slug = `${base}-${n}`.slice(0, 60);
    if (n > 50) return `${base}-${Date.now().toString(36)}`;
  }
}

// ─── DM copy ─────────────────────────────────────────────────────────────────
export type DmVariant = 'launch' | 'exclusive' | 'direct';

// Lightweight ES/EN detector from the artist bio (+ name). Defaults to English
// when there is no clear Spanish signal, so unknown/empty bios stay safe.
export function detectLang(...texts: (string | null | undefined)[]): 'es' | 'en' {
  const text = ` ${texts.filter(Boolean).join(' ').toLowerCase()} `;
  if (!text.trim()) return 'en';
  if (/[ñ¿¡]/.test(text)) return 'es';
  const esWords = [' el ', ' la ', ' los ', ' las ', ' de ', ' del ', ' que ', ' con ', ' por ', ' para ', ' una ', ' mi ', ' tu ', ' su ', ' soy ', ' como ', ' más ', ' música', ' artista', ' cantante', ' compositor', ' productor', ' amor ', ' vida ', ' aquí', ' gracias', ' nuevo', ' nueva', ' sueño', ' canción', ' canciones', ' desde '];
  const enWords = [' the ', ' and ', ' of ', ' to ', ' for ', ' with ', ' my ', ' your ', ' you ', " i'm ", ' music ', ' artist ', ' singer ', ' songwriter ', ' producer ', ' love ', ' life ', ' new ', ' dream ', ' song ', ' songs ', ' from '];
  let es = 0, en = 0;
  for (const w of esWords) if (text.includes(w)) es++;
  for (const w of enWords) if (text.includes(w)) en++;
  if (/[áéíóú]/.test(text)) es++;
  return es > en ? 'es' : 'en';
}

export const DM_VARIANT_LABELS: Record<DmVariant, string> = {
  launch: 'Lanzamiento (intriga + reservado)',
  exclusive: 'Exclusivo (invitación curada)',
  direct: 'Directo (corto y al grano)',
};

function dmCopy(name: string, claimUrl: string, variant: DmVariant = 'launch') {
  const first = (name || '').split(' ')[0] || 'artista';
  const firstEn = (name || '').split(' ')[0] || 'there';

  if (variant === 'exclusive') {
    const es =
      `${first}, te escribo porque estamos seleccionando a mano a un grupo pequeño de artistas 🎧\n\n` +
      `Boostify Music es la primera red social + plataforma SOLO para la música — sin algoritmo, sin ruido, ` +
      `solo artistas, industria y fans reales. Estamos abriendo de a poco, por invitación.\n\n` +
      `Te reservamos un lugar. Actívalo gratis aquí 👇\n${claimUrl}\n\n` +
      `(Te paso un adelanto de tu perfil 🎵)`;
    const en =
      `${firstEn}, reaching out because we're hand-picking a small group of artists 🎧\n\n` +
      `Boostify Music is the first social network + platform built ONLY for music — no algorithm, no noise, ` +
      `just artists, industry and real fans. We're opening slowly, invite-only.\n\n` +
      `We saved you a spot. Activate it free here 👇\n${claimUrl}\n\n` +
      `(Sending a preview of your profile 🎵)`;
    return { es, en };
  }

  if (variant === 'direct') {
    const es =
      `${first} 👋 Estamos lanzando Boostify Music, la primera red social solo para artistas y la industria musical.\n\n` +
      `Te dejé un lugar reservado — actívalo gratis en 1 clic 👇\n${claimUrl}`;
    const en =
      `${firstEn} 👋 We're launching Boostify Music, the first social network just for artists and the music industry.\n\n` +
      `Saved you a spot — activate it free in 1 tap 👇\n${claimUrl}`;
    return { es, en };
  }

  // 'launch' (default)
  const es =
    `${first}, se viene algo nuevo para los que vivimos de la música 🎧\n\n` +
    `Boostify Music — la primera red social + plataforma SOLO para artistas y la industria musical. ` +
    `Sin pelear contra el algoritmo ni competir con memes: solo música, fans reales y herramientas para vivir de tu arte.\n\n` +
    `Estás en la primera ola de artistas seleccionados y tu lugar ya está reservado 👇\n` +
    `${claimUrl}\n\n` +
    `(Te mando un adelanto de tu perfil aquí mismo 🎵)`;
  const en =
    `${firstEn}, something new is coming for those of us who live off music 🎧\n\n` +
    `Boostify Music — the first social network + platform built ONLY for artists and the music industry. ` +
    `No fighting the algorithm, no competing with memes: just music, real fans and tools to actually live off your art.\n\n` +
    `You're in the first wave of selected artists and your spot is already reserved 👇\n` +
    `${claimUrl}\n\n` +
    `(Sending a preview of your profile right here 🎵)`;
  return { es, en };
}

// ═════════════════════════════════════════════════════════════════════════════
// Routes
// ═════════════════════════════════════════════════════════════════════════════

// POST /import-csv  { csvContent, source? }
router.post('/import-csv', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const csvContent = typeof req.body?.csvContent === 'string' ? req.body.csvContent : '';
    const source = (typeof req.body?.source === 'string' && req.body.source) || 'instagram_apify';
    if (!csvContent.trim()) return res.status(400).json({ success: false, message: 'CSV vacío' });

    const rows = parseCSV(csvContent);
    let valid = 0, invalid = 0, inserted = 0, updated = 0;
    const seen = new Set<string>();
    for (const r of rows) {
      const lead = extractLead(r);
      if (!lead) { invalid++; continue; }
      if (seen.has(lead.handle)) continue;
      seen.add(lead.handle);
      valid++;
      const result = await db.execute(sql`
        INSERT INTO instagram_leads (handle, profile_url, full_name, profile_image_url, bio, followers, email, source, raw)
        VALUES (${lead.handle}, ${lead.profileUrl}, ${lead.fullName}, ${lead.profileImageUrl}, ${lead.bio},
                ${lead.followers}, ${lead.email}, ${source}, ${JSON.stringify(lead.raw)}::jsonb)
        ON CONFLICT (handle) DO UPDATE SET
          full_name = COALESCE(EXCLUDED.full_name, instagram_leads.full_name),
          profile_image_url = COALESCE(EXCLUDED.profile_image_url, instagram_leads.profile_image_url),
          bio = COALESCE(EXCLUDED.bio, instagram_leads.bio),
          followers = COALESCE(EXCLUDED.followers, instagram_leads.followers),
          email = COALESCE(EXCLUDED.email, instagram_leads.email)
        RETURNING (xmax = 0) AS inserted
      `);
      if ((result.rows[0] as any)?.inserted) inserted++; else updated++;
    }
    res.json({ success: true, total: rows.length, valid, invalid, inserted, updated });
  } catch (err: any) {
    console.error('[IGLeads] import error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error al importar' });
  }
});

// ─── Bridge: Artist Hunter (music_industry_contacts) → instagram_leads ───────
// The discovery engine packs the IG handle into `keywords` as `ig:<handle>` and
// stores the bio inside `master_json.identity.bio`. We pull every discovered
// contact that has an IG handle into the leads pipeline (dm_status 'new') so the
// existing /generate flow can build a claimable profile + DM for it.
function igHandleFromKeywords(keywords: string | null): string {
  if (!keywords) return '';
  const m = keywords.match(/(?:^|,)\s*ig:([^,]+)/i);
  return m ? normHandle(m[1]) : '';
}
function followersFromKeywords(keywords: string | null): number | null {
  if (!keywords) return null;
  const m = keywords.match(/followers:(\d+)/i);
  return m ? toInt(m[1]) : null;
}

async function ingestFromDiscovery(limit = 200): Promise<{ scanned: number; inserted: number; skipped: number }> {
  await ensureSchema();
  const scanLimit = Math.max(1, Math.min(limit * 4 + 100, 4000));
  const { rows } = await db.execute(sql`
    SELECT id, full_name, profile_image_url, keywords, email,
           master_json->'identity'->'bio'->>'medium' AS bio_medium,
           master_json->'identity'->'bio'->>'short'  AS bio_short,
           master_json->'platforms'->'instagram'->>'handle' AS mj_handle
      FROM music_industry_contacts
     WHERE keywords ILIKE '%ig:%'
     ORDER BY created_at DESC
     LIMIT ${scanLimit}
  `);
  let scanned = 0, inserted = 0, skipped = 0;
  const seen = new Set<string>();
  for (const c of rows as any[]) {
    if (inserted >= limit) break;
    scanned++;
    const handle = igHandleFromKeywords(c.keywords) || normHandle(c.mj_handle || '');
    if (!handle || seen.has(handle)) { skipped++; continue; }
    seen.add(handle);
    const bio = (c.bio_medium || c.bio_short || null) as string | null;
    const followers = followersFromKeywords(c.keywords);
    const profileUrl = `https://www.instagram.com/${handle}/`;
    const result = await db.execute(sql`
      INSERT INTO instagram_leads (handle, profile_url, full_name, profile_image_url, bio, followers, email, source, raw)
      VALUES (${handle}, ${profileUrl}, ${c.full_name || handle}, ${c.profile_image_url || null}, ${bio},
              ${followers}, ${c.email || null}, 'artist_hunter', ${JSON.stringify({ contactId: c.id, fromHunter: true })}::jsonb)
      ON CONFLICT (handle) DO NOTHING
      RETURNING id
    `);
    if (result.rows.length) inserted++; else skipped++;
  }
  return { scanned, inserted, skipped };
}

// POST /ingest-discovery { limit? } — pull Hunter-discovered IG artists into leads
router.post('/ingest-discovery', async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.body?.limit, 10) || 300, 1000));
    const out = await ingestFromDiscovery(limit);
    res.json({ success: true, ...out });
  } catch (err: any) {
    console.error('[IGLeads] ingest-discovery error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error al importar del Hunter' });
  }
});

// GET /discovery-available — how many Hunter contacts carry an IG handle
router.get('/discovery-available', async (_req: Request, res: Response) => {
  try {
    await ensureSchema();
    const { rows } = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM music_industry_contacts WHERE keywords ILIKE '%ig:%') AS with_ig,
        (SELECT COUNT(*) FROM instagram_leads WHERE source = 'artist_hunter')      AS imported
    `);
    const r: any = rows[0] || {};
    res.json({ success: true, withIg: Number(r.with_ig || 0), imported: Number(r.imported || 0) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Scheduler: auto-bridge Hunter → leads (runs in background) ──────────────
let bridgeInterval: ReturnType<typeof setInterval> | null = null;
export function startLeadBridgeScheduler() {
  if (bridgeInterval) return;
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const run = async () => {
    try {
      const out = await ingestFromDiscovery(500);
      if (out.inserted) console.log(`🔗 [IGLeads] bridge: +${out.inserted} leads from Hunter (scanned ${out.scanned})`);
    } catch (err: any) {
      console.error('[IGLeads] bridge scheduler error:', err?.message || err);
    }
  };
  setTimeout(run, 3 * 60 * 1000); // first pass 3 min after boot
  bridgeInterval = setInterval(run, TWO_HOURS);
  console.log('🔗 [IGLeads] Hunter→leads bridge scheduler started (every 2h)');
}

// POST /generate  { limit?, lang? } — build claimable profiles + DM packs
router.post('/generate', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const limit = Math.max(0, Math.min(parseInt(req.body?.limit, 10) || 200, 1000));
    const lang = (req.body?.lang || 'both').toString().toLowerCase();
    const variant: DmVariant = (['launch', 'exclusive', 'direct'].includes(req.body?.variant) ? req.body.variant : 'launch') as DmVariant;
    const limitSql = limit > 0 ? sql`LIMIT ${limit}` : sql``;

    const { rows: leads } = await db.execute(sql`
      SELECT * FROM instagram_leads
       WHERE user_id IS NULL AND dm_status = 'new'
       ORDER BY COALESCE(followers, 0) DESC, id ASC ${limitSql}
    `);

    const packs: any[] = [];
    let created = 0, failed = 0;
    for (const lead of leads as any[]) {
      try {
        const slug = await uniqueSlug(lead.full_name, lead.handle);
        const firstName = (lead.full_name || '').split(' ')[0] || null;
        const lastName = (lead.full_name || '').split(' ').slice(1).join(' ') || null;

        // Re-host the Instagram CDN image on Firebase so it renders on the
        // profile + claim page (IG CDN blocks hotlinking / URLs expire).
        const hostedImage = await mirrorImageToFirebase(lead.profile_image_url, lead.handle);

        const [newArtist] = await db.insert(users).values({
          role: 'artist',
          artistName: lead.full_name,
          slug,
          firstName,
          lastName,
          biography: lead.bio || null,
          profileImage: hostedImage || null,
          instagramHandle: lead.handle,
          isAIGenerated: true,
          pageMode: 'artist',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any).returning({ id: users.id, slug: users.slug });

        const claimUrl = generateClaimLink({
          contactId: 0,
          email: lead.email || '',
          name: lead.full_name || '',
          slug: newArtist.slug || slug,
          userId: newArtist.id,
          instagramHandle: lead.handle,
        });
        const dm = dmCopy(lead.full_name, claimUrl, variant);
        const dmLang = detectLang(lead.bio, lead.full_name);

        await db.execute(sql`
          UPDATE instagram_leads
             SET user_id = ${newArtist.id}, slug = ${newArtist.slug || slug}, claim_url = ${claimUrl},
                 profile_image_url = ${hostedImage || lead.profile_image_url || null},
                 dm_text_es = ${dm.es}, dm_text_en = ${dm.en}, dm_lang = ${dmLang}, dm_status = 'ready', generated_at = NOW()
           WHERE id = ${lead.id}
        `);

        packs.push({
          handle: lead.handle, fullName: lead.full_name, profileUrl: lead.profile_url,
          imageUrl: hostedImage || lead.profile_image_url, slug: newArtist.slug || slug, claimUrl,
          dmEs: lang === 'en' ? '' : dm.es,
          dmEn: lang === 'es' ? '' : dm.en,
        });
        created++;
      } catch (e: any) {
        failed++;
        console.error('[IGLeads] generate row error:', e.message);
      }
    }
    res.json({ success: true, created, failed, packs });
  } catch (err: any) {
    console.error('[IGLeads] generate error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error al generar' });
  }
});

// POST /refresh-images { limit? }
// Re-host Instagram CDN images that were stored as-is on already-generated
// profiles (they 403 / expire). Updates both the lead row and the linked user.
router.post('/refresh-images', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const limit = Math.max(1, Math.min(parseInt(req.body?.limit, 10) || 500, 1000));
    const { rows: leads } = await db.execute(sql`
      SELECT id, handle, user_id, profile_image_url FROM instagram_leads
       WHERE profile_image_url IS NOT NULL
         AND profile_image_url NOT LIKE '%firebasestorage.googleapis.com%'
       ORDER BY id ASC
       LIMIT ${limit}
    `);
    let updated = 0, failed = 0, skipped = 0;
    for (const lead of leads as any[]) {
      try {
        const hosted = await mirrorImageToFirebase(lead.profile_image_url, lead.handle);
        if (!hosted || hosted === lead.profile_image_url) { failed++; continue; }
        await db.execute(sql`UPDATE instagram_leads SET profile_image_url = ${hosted} WHERE id = ${lead.id}`);
        if (lead.user_id) {
          await db.execute(sql`UPDATE users SET profile_image = ${hosted}, updated_at = NOW() WHERE id = ${lead.user_id}`);
        }
        updated++;
      } catch (e: any) {
        failed++;
        console.error('[IGLeads] refresh-images row error:', e?.message);
      }
    }
    res.json({ success: true, total: (leads as any[]).length, updated, failed, skipped });
  } catch (err: any) {
    console.error('[IGLeads] refresh-images error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error al refrescar imágenes' });
  }
});

// GET /dm-variants — list available DM angles (for the UI selector).
router.get('/dm-variants', (_req: Request, res: Response) => {
  res.json({
    success: true,
    variants: (Object.keys(DM_VARIANT_LABELS) as DmVariant[]).map((key) => ({ key, label: DM_VARIANT_LABELS[key] })),
  });
});

// POST /refresh-dm { variant } — re-apply a DM angle to every generated lead
// (A/B testing: switch all ready leads to a different copy variant).
router.post('/refresh-dm', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const variant: DmVariant = (['launch', 'exclusive', 'direct'].includes(req.body?.variant) ? req.body.variant : 'launch') as DmVariant;
    const { rows: leads } = await db.execute(sql`
      SELECT id, full_name, bio, claim_url FROM instagram_leads WHERE claim_url IS NOT NULL
    `);
    let updated = 0;
    for (const lead of leads as any[]) {
      const dm = dmCopy(lead.full_name, lead.claim_url, variant);
      const dmLang = detectLang(lead.bio, lead.full_name);
      await db.execute(sql`
        UPDATE instagram_leads SET dm_text_es = ${dm.es}, dm_text_en = ${dm.en}, dm_lang = ${dmLang} WHERE id = ${lead.id}
      `);
      updated++;
    }
    res.json({ success: true, variant, updated });
  } catch (err: any) {
    console.error('[IGLeads] refresh-dm error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error al refrescar copy' });
  }
});

// GET /stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    await ensureSchema();
    const { rows } = await db.execute(sql`
      SELECT dm_status, COUNT(*)::int AS n FROM instagram_leads GROUP BY dm_status
    `);
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of rows as any[]) { byStatus[r.dm_status] = r.n; total += r.n; }
    res.json({
      success: true, total,
      new: byStatus.new || 0, ready: byStatus.ready || 0,
      sent: byStatus.sent || 0, claimed: byStatus.claimed || 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /funnel — end-to-end conversion funnel for the IG-leads pipeline.
// Stages are CUMULATIVE (each downstream stage is a subset of the prior one):
//   imported → generated (DM built) → sent (DM delivered) → claimed (account activated)
// dm_status is a single state machine ('new'→'ready'→'sent'→'claimed'), so we
// roll the counts forward. Also returns a per-source breakdown.
router.get('/funnel', async (_req: Request, res: Response) => {
  try {
    await ensureSchema();
    const { rows } = await db.execute(sql`
      SELECT
        COUNT(*)::int                                                          AS imported,
        COUNT(*) FILTER (WHERE dm_status IN ('ready','sent','claimed'))::int   AS generated,
        COUNT(*) FILTER (WHERE dm_status IN ('sent','claimed'))::int           AS sent,
        COUNT(*) FILTER (WHERE dm_status = 'claimed')::int                     AS claimed
      FROM instagram_leads
    `);
    const f: any = rows[0] || {};
    const imported = Number(f.imported || 0);
    const generated = Number(f.generated || 0);
    const sent = Number(f.sent || 0);
    const claimed = Number(f.claimed || 0);

    const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

    const { rows: srcRows } = await db.execute(sql`
      SELECT source,
        COUNT(*)::int                                                          AS imported,
        COUNT(*) FILTER (WHERE dm_status IN ('sent','claimed'))::int           AS sent,
        COUNT(*) FILTER (WHERE dm_status = 'claimed')::int                     AS claimed
      FROM instagram_leads
      GROUP BY source
      ORDER BY imported DESC
    `);

    res.json({
      success: true,
      stages: [
        { key: 'imported',  label: 'Importados',     count: imported,  pctOfTop: 100,                      convFromPrev: 100 },
        { key: 'generated', label: 'DM generado',    count: generated, pctOfTop: rate(generated, imported), convFromPrev: rate(generated, imported) },
        { key: 'sent',      label: 'DM enviado',      count: sent,      pctOfTop: rate(sent, imported),      convFromPrev: rate(sent, generated) },
        { key: 'claimed',   label: 'Reclamado',       count: claimed,   pctOfTop: rate(claimed, imported),   convFromPrev: rate(claimed, sent) },
      ],
      overallConversion: rate(claimed, imported),
      bySource: (srcRows as any[]).map((r) => ({
        source: r.source || 'unknown',
        imported: Number(r.imported || 0),
        sent: Number(r.sent || 0),
        claimed: Number(r.claimed || 0),
        claimRate: rate(Number(r.claimed || 0), Number(r.sent || 0)),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /list?status=&limit=
router.get('/list', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : null;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
    const where = status ? sql`WHERE dm_status = ${status}` : sql``;
    const { rows } = await db.execute(sql`
      SELECT id, handle, full_name, profile_url, profile_image_url, followers,
             email, slug, claim_url, dm_text_es, dm_text_en, dm_lang, dm_status, user_id
        FROM instagram_leads ${where}
       ORDER BY COALESCE(followers, 0) DESC, id DESC
       LIMIT ${limit}
    `);
    res.json({ success: true, leads: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /mark-sent  { handles: string[] }
router.post('/mark-sent', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const handles = Array.isArray(req.body?.handles)
      ? req.body.handles.map((h: string) => normHandle(h)).filter(Boolean)
      : [];
    if (!handles.length) return res.status(400).json({ success: false, message: 'handles requerido' });
    const list = sql.join(handles.map((h: string) => sql`${h}`), sql`, `);
    const result = await db.execute(sql`
      UPDATE instagram_leads SET dm_status = 'sent', sent_at = NOW()
       WHERE handle IN (${list}) AND dm_status IN ('ready', 'new')
       RETURNING handle
    `);
    res.json({ success: true, updated: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Email outreach copy (claim email for leads that DO have an email) ────────
function claimEmailCopy(name: string, lang: 'es' | 'en') {
  const first = (name || '').trim().split(/\s+/)[0] || (lang === 'es' ? 'artista' : 'there');
  if (lang === 'es') {
    return {
      subject: `${first}, tu perfil de artista en Boostify ya está listo 🎵`,
      title: 'Tu perfil te está esperando',
      message:
        `Te reservamos un perfil de artista en Boostify con tu nombre y tu imagen. ` +
        `Actívalo gratis en 1 clic y empieza a publicar tu música, vender merch y conectar con tus fans — ` +
        `sin costo y sin compromiso.`,
      cta: 'Activar mi perfil gratis',
    };
  }
  return {
    subject: `${first}, your Boostify artist profile is ready 🎵`,
    title: 'Your profile is waiting for you',
    message:
      `We saved you an artist profile on Boostify with your name and image. ` +
      `Activate it free in 1 tap and start publishing your music, selling merch and connecting with your fans — ` +
      `no cost, no strings attached.`,
    cta: 'Activate my profile free',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /send-emails  { limit?, status? } — send the claim email to leads that
// HAVE an email + a generated claim link. Closes the "0 sent" funnel gap for the
// ~37% of IG leads that came with an email. Marks them dm_status='sent'.
router.post('/send-emails', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const limit = Math.min(Math.max(parseInt(req.body?.limit, 10) || 50, 1), 300);
    const { rows } = await db.execute(sql`
      SELECT id, handle, full_name, email, claim_url, profile_image_url,
             COALESCE(dm_lang, 'en') AS dm_lang, user_id
        FROM instagram_leads
       WHERE email IS NOT NULL AND email <> ''
         AND claim_url IS NOT NULL
         AND dm_status IN ('ready', 'new')
       ORDER BY COALESCE(followers, 0) DESC
       LIMIT ${limit}
    `);

    let sent = 0, failed = 0, skipped = 0;
    const byProvider: Record<string, number> = {};
    const byDomain: Record<string, number> = {};
    const errors: Array<{ email: string; error?: string }> = [];
    for (const r of rows as any[]) {
      const email = String(r.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) { skipped++; continue; }
      const lang: 'es' | 'en' = r.dm_lang === 'es' ? 'es' : 'en';
      // Branded claim email sent via the verified Resend multi-domain pool
      // (rotates FROM across many authenticated domains), Brevo fallback.
      const { subject, html } = buildClaimEmail({
        name: r.full_name,
        lang,
        claimUrl: r.claim_url,
        imageUrl: r.profile_image_url,
      });
      try {
        const result = await sendOutreachEmail(email, subject, html);
        if (result?.success) {
          sent++;
          byProvider[result.provider || 'unknown'] = (byProvider[result.provider || 'unknown'] || 0) + 1;
          if (result.from) { const dom = result.from.split('@')[1] || result.from; byDomain[dom] = (byDomain[dom] || 0) + 1; }
          await db.execute(sql`
            UPDATE instagram_leads SET dm_status = 'sent', sent_at = NOW()
             WHERE id = ${r.id} AND dm_status IN ('ready', 'new')
          `);
          // Best-effort: surface in the email funnel too.
          trackEvent(email, 'email_sent', { via: 'ig_leads_outreach', handle: r.handle, provider: result.provider }, undefined, r.user_id || undefined).catch(() => {});
        } else {
          failed++;
          errors.push({ email, error: result?.error });
          // Permanently invalid recipient (bad TLD / malformed) → take it out of
          // the emailable pool so we don't retry it on every batch.
          if (/invalid .*to|to.*field|not valid in to|email.*format/i.test(result?.error || '')) {
            await db.execute(sql`UPDATE instagram_leads SET dm_status = 'invalid_email' WHERE id = ${r.id}`).catch(() => {});
          }
        }
      } catch (e: any) {
        failed++;
        errors.push({ email, error: e?.message || 'exception' });
      }
    }

    res.json({ success: true, sent, failed, skipped, attempted: rows.length, byProvider, byDomain, errors: errors.slice(0, 20) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /email-available — how many leads can be emailed right now.
router.get('/email-available', async (_req: Request, res: Response) => {
  try {
    await ensureSchema();
    const { rows } = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '' AND claim_url IS NOT NULL AND dm_status IN ('ready','new'))::int AS emailable,
        COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '')::int AS with_email
      FROM instagram_leads
    `);
    const r: any = rows[0] || {};
    res.json({ success: true, emailable: Number(r.emailable || 0), withEmail: Number(r.with_email || 0) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /export?status=ready — CSV download of DM packs
router.get('/export', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : 'ready';
    const { rows } = await db.execute(sql`
      SELECT handle, full_name, profile_url, profile_image_url, claim_url, dm_text_es, dm_text_en, dm_lang
        FROM instagram_leads WHERE dm_status = ${status} AND claim_url IS NOT NULL
       ORDER BY COALESCE(followers, 0) DESC
    `);
    const cell = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['handle', 'full_name', 'profile_url', 'image_to_attach', 'claim_url', 'dm_lang', 'recommended_dm', 'dm_text_es', 'dm_text_en'];
    const lines = [headers.join(',')];
    for (const r of rows as any[]) {
      const recommended = r.dm_lang === 'es' ? r.dm_text_es : r.dm_text_en;
      lines.push([r.handle, r.full_name, r.profile_url, r.profile_image_url, r.claim_url, r.dm_lang, recommended, r.dm_text_es, r.dm_text_en]
        .map(cell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ig-dm-outreach-${Date.now()}.csv"`);
    res.send(lines.join('\n'));
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
