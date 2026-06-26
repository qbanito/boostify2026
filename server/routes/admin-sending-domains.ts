/**
 * Admin — Sending Domains (one-click cold-email domain provisioning)
 * ═══════════════════════════════════════════════════════════════════
 * One button in the admin provisions a brand-new cold-outreach sending
 * domain end-to-end and wires it into the email workflow:
 *
 *   1. Buys the domain on Hostinger (cheap TLD, $0.99 first year).
 *   2. Registers it in Resend under the paid account.
 *   3. Writes the DKIM / SPF / MX records into the Hostinger DNS zone
 *      (keeps any existing A / CNAME records — overwrite is per name+type).
 *   4. Triggers Resend verification.
 *   5. Persists it to `outreach_sending_domains` (DB) so the outreach pool
 *      picks it up automatically — no .env edit, no restart, works on Render.
 *
 * The domain stays `pending` until Resend marks it verified (DNS propagation,
 * minutes–hours). Hitting "Check" flips it to `active` and adds it to the
 * live sending rotation via refreshOutreachPool().
 *
 * Mounted at /api/admin/sending-domains (requireAdmin).
 */

import { Router, type Request, type Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { requireAdmin } from '../middleware/require-admin';
import { refreshOutreachPool, outreachPoolSize } from '../services/artist-activation/outreach-email';

const router = Router();
router.use(requireAdmin);

const HOSTINGER_BASE = 'https://developers.hostinger.com/api';
const RESEND_BASE = 'https://api.resend.com';

// Supported cheap TLDs → Hostinger purchase item + TLD-specific WHOIS profile.
const TLD_CONFIG: Record<string, { itemId: string; whoisProfile: number }> = {
  store:   { itemId: 'hostingercom-domain-store-usd-1y',   whoisProfile: 14867010 },
  website: { itemId: 'hostingercom-domain-website-usd-1y', whoisProfile: 14867011 },
  fun:     { itemId: 'hostingercom-domain-fun-usd-1y',     whoisProfile: 14867012 },
  uno:     { itemId: 'hostingercom-domain-uno-usd-1y',     whoisProfile: 14867013 },
};

const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function hostingerKey(): string { return process.env.HOSTINGER_API_KEY || ''; }
function paymentMethodId(): number { return Number(process.env.HOSTINGER_PAYMENT_METHOD_ID || 42753085); }

// The Resend account key new domains are registered under. Prefer an explicit
// env var, else the paid account in RESEND_OUTREACH_POOL, else RESEND_API_KEY.
function resendProvisionKey(): string {
  if (process.env.RESEND_PROVISION_KEY) return process.env.RESEND_PROVISION_KEY;
  try {
    const pool = JSON.parse(process.env.RESEND_OUTREACH_POOL || '[]');
    if (Array.isArray(pool) && pool.length) {
      const paid = pool.find((p: any) => String(p?.from || '').includes('boostifymusicusa.online'))
        || pool.find((p: any) => String(p?.key || '').startsWith('re_i8Xz8Wo4'))
        || pool[pool.length - 1];
      if (paid?.key) return paid.key;
    }
  } catch { /* ignore */ }
  return process.env.RESEND_API_KEY || '';
}

async function ensureSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS outreach_sending_domains (
      id                SERIAL PRIMARY KEY,
      domain            TEXT UNIQUE NOT NULL,
      from_email        TEXT NOT NULL,
      reply_to          TEXT,
      api_key           TEXT NOT NULL,
      resend_domain_id  TEXT,
      status            TEXT NOT NULL DEFAULT 'pending',
      hostinger_bought  BOOLEAN DEFAULT false,
      dns_written       BOOLEAN DEFAULT false,
      verified_at       TIMESTAMPTZ,
      last_error        TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )`);
}

function rows(res: any): any[] { return res?.rows || res || []; }

// ─── Hostinger helpers ───────────────────────────────────────────────────────
async function buyDomain(domain: string, tld: string): Promise<{ ok: boolean; status: number; body: string }> {
  const cfg = TLD_CONFIG[tld];
  const body = {
    domain,
    item_id: cfg.itemId,
    payment_method_id: paymentMethodId(),
    domain_contacts: {
      owner_id: cfg.whoisProfile, admin_id: cfg.whoisProfile,
      billing_id: cfg.whoisProfile, tech_id: cfg.whoisProfile,
    },
  };
  const r = await fetch(`${HOSTINGER_BASE}/domains/v1/portfolio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hostingerKey()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, body: text };
}

async function writeDns(domain: string, records: any[]): Promise<{ ok: boolean; status: number; body: string }> {
  const zone = records.map((rec) => {
    if (rec.type === 'MX') {
      return { name: rec.name, type: 'MX', ttl: 3600, records: [{ content: `${rec.priority ?? 10} ${rec.value}` }] };
    }
    return { name: rec.name, type: rec.type, ttl: 3600, records: [{ content: rec.value }] };
  });
  const r = await fetch(`${HOSTINGER_BASE}/dns/v1/zones/${domain}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${hostingerKey()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ overwrite: true, zone }),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, body: text };
}

// ─── Resend helpers ──────────────────────────────────────────────────────────
async function resendAddDomain(domain: string, key: string): Promise<any> {
  const r = await fetch(`${RESEND_BASE}/domains`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: domain, region: 'us-east-1' }),
  });
  return r.json();
}

async function resendGetDomain(id: string, key: string): Promise<any> {
  const r = await fetch(`${RESEND_BASE}/domains/${id}`, { headers: { Authorization: `Bearer ${key}` } });
  return r.json();
}

async function resendVerify(id: string, key: string): Promise<number> {
  const r = await fetch(`${RESEND_BASE}/domains/${id}/verify`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } });
  return r.status;
}

// ─── GET / — list provisioned domains + pool size ───────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    await ensureSchema();
    const list = rows(await db.execute(sql`
      SELECT id, domain, from_email, status, resend_domain_id, hostinger_bought, dns_written,
             verified_at, last_error, created_at
      FROM outreach_sending_domains ORDER BY created_at DESC`));
    const supported = Object.keys(TLD_CONFIG);
    res.json({ success: true, domains: list, poolSize: outreachPoolSize(), supportedTlds: supported });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'list failed' });
  }
});

// ─── POST /provision — full one-click provisioning ──────────────────────────
router.post('/provision', async (req: Request, res: Response) => {
  const domain = String(req.body?.domain || '').trim().toLowerCase();
  const skipBuy = req.body?.skipBuy === true; // for domains already owned
  try {
    if (!DOMAIN_RE.test(domain)) {
      return res.status(400).json({ success: false, error: 'Dominio inválido' });
    }
    const tld = domain.split('.').pop() as string;
    if (!TLD_CONFIG[tld]) {
      return res.status(400).json({ success: false, error: `TLD .${tld} no soportado. Usa: ${Object.keys(TLD_CONFIG).join(', ')}` });
    }
    if (!hostingerKey()) return res.status(500).json({ success: false, error: 'HOSTINGER_API_KEY no configurada' });
    const key = resendProvisionKey();
    if (!key) return res.status(500).json({ success: false, error: 'No hay clave de Resend para provisionar' });

    await ensureSchema();
    const existing = rows(await db.execute(sql`SELECT id, status FROM outreach_sending_domains WHERE domain = ${domain}`));
    if (existing.length && existing[0].status === 'active') {
      return res.status(409).json({ success: false, error: 'Ese dominio ya está activo en el workflow' });
    }

    const fromEmail = `artists@${domain}`;
    const replyTo = 'info@boostifymusic.com';

    // Upsert a provisioning row.
    await db.execute(sql`
      INSERT INTO outreach_sending_domains (domain, from_email, reply_to, api_key, status)
      VALUES (${domain}, ${fromEmail}, ${replyTo}, ${key}, 'provisioning')
      ON CONFLICT (domain) DO UPDATE SET status = 'provisioning', last_error = NULL`);

    // 1. Buy on Hostinger (unless caller says it's already owned).
    let bought = skipBuy;
    if (!skipBuy) {
      const buy = await buyDomain(domain, tld);
      if (!buy.ok) {
        // Already-owned domains return a 4xx we can treat as success.
        const alreadyOwned = /already|owned|exists/i.test(buy.body) && buy.status !== 402;
        if (!alreadyOwned) {
          const friendly = (buy.status === 402 || buy.status === 422)
            ? 'Pago rechazado por el banco (bloqueo anti-fraude de la tarjeta). Autoriza el cargo de Hostinger con tu banco y reintenta.'
            : `Compra falló (HTTP ${buy.status})`;
          await db.execute(sql`UPDATE outreach_sending_domains SET status = 'failed', last_error = ${friendly} WHERE domain = ${domain}`);
          return res.status(buy.status === 402 ? 402 : 400).json({ success: false, step: 'buy', error: friendly, detail: buy.body.slice(0, 300) });
        }
        bought = true;
      } else {
        bought = true;
      }
    }
    await db.execute(sql`UPDATE outreach_sending_domains SET hostinger_bought = ${bought} WHERE domain = ${domain}`);

    // 2. Register in Resend → get DNS records.
    const dom = await resendAddDomain(domain, key);
    let resendId: string | undefined = dom?.id;
    let records: any[] = dom?.records || [];
    // Already in Resend → fetch its id+records by listing.
    if (!resendId && /already|exist/i.test(dom?.message || '')) {
      const listed = await (await fetch(`${RESEND_BASE}/domains`, { headers: { Authorization: `Bearer ${key}` } })).json();
      const match = (listed?.data || []).find((d: any) => d.name === domain);
      if (match?.id) {
        resendId = match.id;
        const full = await resendGetDomain(resendId!, key);
        records = full?.records || [];
      }
    }
    if (!resendId || !records.length) {
      const err = dom?.message || 'Resend no devolvió registros DNS';
      await db.execute(sql`UPDATE outreach_sending_domains SET status = 'failed', last_error = ${err} WHERE domain = ${domain}`);
      return res.status(400).json({ success: false, step: 'resend', error: err });
    }

    // 3. Write DNS (DKIM/SPF/MX) — keeps existing A/CNAME.
    const dns = await writeDns(domain, records);
    if (!dns.ok) {
      await db.execute(sql`UPDATE outreach_sending_domains SET resend_domain_id = ${resendId}, status = 'failed', last_error = ${`DNS HTTP ${dns.status}`} WHERE domain = ${domain}`);
      return res.status(400).json({ success: false, step: 'dns', error: `Escritura DNS falló (HTTP ${dns.status})`, detail: dns.body.slice(0, 200), resendId });
    }

    // 4. Trigger verification (async on Resend's side).
    await resendVerify(resendId, key);

    // 5. Persist pending (becomes active on the next successful check).
    await db.execute(sql`
      UPDATE outreach_sending_domains
      SET resend_domain_id = ${resendId}, dns_written = true, status = 'pending', last_error = NULL
      WHERE domain = ${domain}`);

    res.json({
      success: true,
      domain, fromEmail, resendId,
      status: 'pending',
      message: 'Dominio comprado, DNS escrito y verificación disparada. Verifica en unos minutos para activarlo en los envíos.',
    });
  } catch (e: any) {
    await ensureSchema().catch(() => {});
    await db.execute(sql`UPDATE outreach_sending_domains SET status = 'failed', last_error = ${String(e?.message || e).slice(0, 280)} WHERE domain = ${domain}`).catch(() => {});
    res.status(500).json({ success: false, error: e?.message || 'provision failed' });
  }
});

// ─── POST /:id/check — poll Resend verify, activate when verified ───────────
router.post('/:id/check', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id);
    const found = rows(await db.execute(sql`SELECT * FROM outreach_sending_domains WHERE id = ${id}`));
    if (!found.length) return res.status(404).json({ success: false, error: 'No encontrado' });
    const row = found[0];
    if (!row.resend_domain_id) return res.status(400).json({ success: false, error: 'Aún sin registrar en Resend' });

    const st = await resendGetDomain(row.resend_domain_id, row.api_key);
    const verified = st?.status === 'verified';
    if (verified && row.status !== 'active') {
      await db.execute(sql`UPDATE outreach_sending_domains SET status = 'active', verified_at = NOW(), last_error = NULL WHERE id = ${id}`);
      const size = await refreshOutreachPool();
      return res.json({ success: true, status: 'active', resendStatus: st?.status, poolSize: size, activated: true });
    }
    // Re-trigger verify if still pending (nudges Resend to re-check DNS).
    if (!verified) await resendVerify(row.resend_domain_id, row.api_key);
    res.json({ success: true, status: row.status, resendStatus: st?.status, activated: false });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'check failed' });
  }
});

// ─── POST /:id/pause | /:id/resume — toggle a domain in/out of rotation ─────
router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id);
    await db.execute(sql`UPDATE outreach_sending_domains SET status = 'paused' WHERE id = ${id} AND status = 'active'`);
    const size = await refreshOutreachPool();
    res.json({ success: true, poolSize: size });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'pause failed' });
  }
});

router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id);
    await db.execute(sql`UPDATE outreach_sending_domains SET status = 'active' WHERE id = ${id} AND status = 'paused'`);
    const size = await refreshOutreachPool();
    res.json({ success: true, poolSize: size });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'resume failed' });
  }
});

export default router;
