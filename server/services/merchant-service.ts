/**
 * BOOSTIFY — Google Merchant Center (Content API for Shopping v2.1)
 *
 * Conecta la cuenta de Google Merchant Center del artista por OAuth y empuja el
 * catálogo de la tienda (smart_merch_products) directamente a Merchant Center
 * para venderlo en YouTube Shopping y Google Shopping — sin que el artista tenga
 * que pegar un feed a mano.
 *
 * Reutiliza el MISMO cliente OAuth de Google que YouTube (GOOGLE_CLIENT_ID/SECRET)
 * pero con el scope `content` y su propia tabla de tokens + redirect URI.
 *
 * Requisitos en Google Cloud (una vez):
 *   - Habilitar "Content API for Shopping" en el proyecto.
 *   - Añadir el scope https://www.googleapis.com/auth/content al consent screen.
 *   - Registrar el redirect URI <baseUrl>/api/merchant/callback en el cliente OAuth.
 * Si falta algo, cada función degrada con un error claro.
 */

import crypto from 'crypto';
import { pool } from '../db';
import { loadFeed, type FeedProduct } from '../routes/youtube-shopping';

const CONTENT_SCOPE = 'https://www.googleapis.com/auth/content';

// País / idioma del feed en Merchant Center (configurable).
const TARGET_COUNTRY = process.env.MERCHANT_TARGET_COUNTRY || 'US';
const CONTENT_LANGUAGE = process.env.MERCHANT_CONTENT_LANGUAGE || 'en';

const STATE_SECRET =
  process.env.SESSION_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  process.env.YOUTUBE_CLIENT_SECRET ||
  'boostify-merchant-oauth-state';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || '';
  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}`;
  const redirectUri =
    process.env.GOOGLE_MERCHANT_REDIRECT ||
    `${baseUrl.replace(/\/$/, '')}/api/merchant/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function isMerchantConfigured(): boolean {
  const { clientId, clientSecret } = getConfig();
  return Boolean(clientId && clientSecret);
}

async function getOAuthClient(): Promise<any> {
  const { google } = await import('googleapis');
  const { clientId, clientSecret, redirectUri } = getConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ── Signed state (CSRF) carrying the user id + artist id ──────────────────────
function signState(userId: number, artistId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, aid: artistId, n: crypto.randomBytes(8).toString('hex'), t: Date.now() }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyState(state: string): { uid: number; aid: number } | null {
  const [payload, sig] = (state || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return typeof obj.uid === 'number' ? { uid: obj.uid, aid: Number(obj.aid) || 0 } : null;
  } catch {
    return null;
  }
}

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS merchant_connections (
      id                SERIAL PRIMARY KEY,
      user_id           INTEGER UNIQUE,
      access_token      TEXT,
      refresh_token     TEXT,
      token_expires_at  TIMESTAMPTZ,
      merchant_id       TEXT,
      merchant_name     TEXT,
      scopes            TEXT,
      last_synced_at    TIMESTAMPTZ,
      last_sync_summary JSONB,
      is_active         BOOLEAN DEFAULT true,
      created_at        TIMESTAMPTZ DEFAULT now(),
      updated_at        TIMESTAMPTZ DEFAULT now()
    )
  `);
}

function gErr(e: any): string {
  const apiErr = e?.response?.data?.error;
  const reason = apiErr?.errors?.[0]?.reason;
  const msg = apiErr?.message || e?.message || 'unknown error';
  return reason ? `${reason}: ${msg}` : msg;
}

export async function getMerchantAuthUrl(userId: number, artistId: number): Promise<string> {
  if (!isMerchantConfigured()) {
    throw new Error('Google OAuth no está configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
  }
  const oauth2 = await getOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [CONTENT_SCOPE],
    state: signState(userId, artistId),
  });
}

/** Exchange the OAuth code, auto-detect the merchant id and persist tokens. */
export async function exchangeMerchantCode(
  code: string,
  state: string,
): Promise<{ userId: number; artistId: number; merchantId: string; merchantName: string }> {
  const st = verifyState(state);
  if (!st) throw new Error('Invalid OAuth state');

  const oauth2 = await getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const { google } = await import('googleapis');
  const content = google.content({ version: 'v2.1', auth: oauth2 });

  // Auto-detecta la(s) cuenta(s) de Merchant Center a las que el usuario accede.
  let merchantId = '';
  try {
    const info = await content.accounts.authinfo();
    const ids = (info.data.accountIdentifiers || []) as any[];
    const first = ids[0] || {};
    merchantId = String(first.merchantId || first.aggregatorId || '');
  } catch (e: any) {
    throw new Error(
      `No se pudo leer la cuenta de Merchant Center (¿Content API habilitada y cuenta creada?): ${gErr(e)}`,
    );
  }
  if (!merchantId) {
    throw new Error('La cuenta de Google no tiene acceso a ninguna cuenta de Google Merchant Center. Crea una primero.');
  }

  let merchantName = '';
  try {
    const acc = await content.accounts.get({ merchantId, accountId: merchantId } as any);
    merchantName = acc.data.name || '';
  } catch {
    /* best-effort */
  }

  await ensureTable();
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  await pool.query(
    `INSERT INTO merchant_connections
       (user_id, access_token, refresh_token, token_expires_at, merchant_id, merchant_name, scopes, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, now())
     ON CONFLICT (user_id) DO UPDATE SET
       access_token     = EXCLUDED.access_token,
       refresh_token    = COALESCE(EXCLUDED.refresh_token, merchant_connections.refresh_token),
       token_expires_at = EXCLUDED.token_expires_at,
       merchant_id      = EXCLUDED.merchant_id,
       merchant_name    = EXCLUDED.merchant_name,
       scopes           = EXCLUDED.scopes,
       is_active        = true,
       updated_at       = now()`,
    [st.uid, tokens.access_token || '', tokens.refresh_token || null, expiresAt, merchantId, merchantName, CONTENT_SCOPE],
  );

  return { userId: st.uid, artistId: st.aid, merchantId, merchantName };
}

export interface MerchantConnectionInfo {
  isActive: boolean;
  merchantId: string;
  merchantName: string;
  scopes: string;
  lastSyncedAt: Date | null;
  lastSyncSummary: any;
  tokenExpiresAt: Date | null;
  createdAt: Date | null;
}

export async function getMerchantConnection(userId: number): Promise<MerchantConnectionInfo | null> {
  await ensureTable();
  const r = await pool.query('SELECT * FROM merchant_connections WHERE user_id = $1 LIMIT 1', [userId]);
  const row = r.rows[0];
  if (!row || !row.is_active) return null;
  return {
    isActive: row.is_active,
    merchantId: row.merchant_id || '',
    merchantName: row.merchant_name || '',
    scopes: row.scopes || '',
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : null,
    lastSyncSummary: row.last_sync_summary || null,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

export async function disconnectMerchant(userId: number): Promise<void> {
  await ensureTable();
  await pool.query('DELETE FROM merchant_connections WHERE user_id = $1', [userId]);
}

async function getValidMerchantToken(userId: number): Promise<string | null> {
  await ensureTable();
  const r = await pool.query(
    'SELECT * FROM merchant_connections WHERE user_id = $1 AND is_active = true LIMIT 1',
    [userId],
  );
  const row = r.rows[0];
  if (!row) return null;

  const expMs = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  const stillValid = expMs && expMs - Date.now() > 60_000;
  if (stillValid && row.access_token) return row.access_token;
  if (!row.refresh_token) return row.access_token || null;

  const oauth2 = await getOAuthClient();
  oauth2.setCredentials({ refresh_token: row.refresh_token });
  const { credentials } = await oauth2.refreshAccessToken();
  const newToken = credentials.access_token || '';
  const newExp = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
  await pool.query(
    'UPDATE merchant_connections SET access_token = $1, token_expires_at = $2, updated_at = now() WHERE user_id = $3',
    [newToken, newExp, userId],
  );
  return newToken || row.access_token || null;
}

// Construye el recurso "product" de la Content API a partir del producto del feed.
function buildProductResource(p: FeedProduct): any {
  const [value, currency] = (p.price || '').split(/\s+/);
  return {
    offerId: String(p.id),
    title: p.title,
    description: p.description,
    link: p.link,
    imageLink: p.imageLink,
    contentLanguage: CONTENT_LANGUAGE,
    targetCountry: TARGET_COUNTRY,
    feedLabel: TARGET_COUNTRY,
    channel: 'online',
    availability: p.availability || 'in_stock',
    condition: p.condition || 'new',
    brand: p.brand,
    price: { value: value || '0.00', currency: currency || 'USD' },
    identifierExists: false,
    ...(p.category ? { productTypes: [p.category] } : {}),
  };
}

export interface SyncResult {
  configured: boolean;
  connected: boolean;
  merchantId?: string;
  sent: number;
  inserted: number;
  failed: number;
  errors: { offerId: string; error: string }[];
}

/** Empuja los productos publicados del artista a Merchant Center (custombatch insert). */
export async function syncProductsToMerchant(userId: number, artistId: number): Promise<SyncResult> {
  if (!isMerchantConfigured()) {
    return { configured: false, connected: false, sent: 0, inserted: 0, failed: 0, errors: [] };
  }
  const conn = await getMerchantConnection(userId);
  const token = await getValidMerchantToken(userId);
  if (!conn || !token) {
    return { configured: true, connected: false, sent: 0, inserted: 0, failed: 0, errors: [] };
  }
  const merchantId = conn.merchantId;

  const feed = await loadFeed(artistId);
  const products = feed?.products || [];
  if (!products.length) {
    return { configured: true, connected: true, merchantId, sent: 0, inserted: 0, failed: 0, errors: [] };
  }

  const { google } = await import('googleapis');
  const oauth2 = await getOAuthClient();
  oauth2.setCredentials({ access_token: token });
  const content = google.content({ version: 'v2.1', auth: oauth2 });

  const errors: { offerId: string; error: string }[] = [];
  let inserted = 0;

  // custombatch en lotes de 50 para no exceder límites de la API.
  const CHUNK = 50;
  for (let i = 0; i < products.length; i += CHUNK) {
    const slice = products.slice(i, i + CHUNK);
    const entries = slice.map((p, idx) => ({
      batchId: i + idx + 1,
      merchantId,
      method: 'insert',
      product: buildProductResource(p),
    }));
    try {
      const resp = await content.products.custombatch({ requestBody: { entries } as any });
      for (const e of (resp.data.entries || []) as any[]) {
        if (e.errors) {
          const offerId = String(e.product?.offerId ?? e.batchId ?? '');
          errors.push({ offerId, error: e.errors?.errors?.[0]?.message || 'insert error' });
        } else {
          inserted++;
        }
      }
    } catch (e: any) {
      // Falla todo el lote (p.ej. Content API no habilitada) → registra error por item.
      for (const p of slice) errors.push({ offerId: String(p.id), error: gErr(e) });
    }
  }

  const summary = { sent: products.length, inserted, failed: errors.length, at: new Date().toISOString() };
  await pool.query(
    'UPDATE merchant_connections SET last_synced_at = now(), last_sync_summary = $2, updated_at = now() WHERE user_id = $1',
    [userId, JSON.stringify(summary)],
  );

  return {
    configured: true,
    connected: true,
    merchantId,
    sent: products.length,
    inserted,
    failed: errors.length,
    errors: errors.slice(0, 20),
  };
}

export interface MerchantStatus {
  configured: boolean;
  connected: boolean;
  merchantId?: string;
  merchantName?: string;
  productCount: number;
  active: number;
  pending: number;
  disapproved: number;
  lastSyncedAt: Date | null;
  lastSyncSummary: any;
}

/** Estado de la cuenta + cuántos productos están activos / pendientes / rechazados. */
export async function getMerchantStatus(userId: number): Promise<MerchantStatus> {
  const base: MerchantStatus = {
    configured: isMerchantConfigured(),
    connected: false,
    productCount: 0,
    active: 0,
    pending: 0,
    disapproved: 0,
    lastSyncedAt: null,
    lastSyncSummary: null,
  };
  if (!base.configured) return base;
  const conn = await getMerchantConnection(userId);
  const token = await getValidMerchantToken(userId);
  if (!conn || !token) return base;

  base.connected = true;
  base.merchantId = conn.merchantId;
  base.merchantName = conn.merchantName;
  base.lastSyncedAt = conn.lastSyncedAt;
  base.lastSyncSummary = conn.lastSyncSummary;

  try {
    const { google } = await import('googleapis');
    const oauth2 = await getOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const content = google.content({ version: 'v2.1', auth: oauth2 });
    const r = await content.productstatuses.list({ merchantId: conn.merchantId, maxResults: 250 } as any);
    const items = (r.data.resources || []) as any[];
    base.productCount = items.length;
    for (const it of items) {
      const dest = (it.destinationStatuses || []).find((d: any) => d.destination === 'Shopping') || (it.destinationStatuses || [])[0];
      const status = String(dest?.status || '').toLowerCase();
      if (status === 'approved') base.active++;
      else if (status === 'disapproved') base.disapproved++;
      else base.pending++;
    }
  } catch {
    /* productstatuses best-effort (cuenta recién creada puede no tener nada) */
  }
  return base;
}
