import { Router, Request, Response } from 'express';
import { pool } from '../db';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth';
import { generateImageWithGPTImage1, editImageWithGPTImage1 } from '../services/fal-service';
import { loadBrandProfile } from '../services/artist-brand-profile';
import { storage } from '../firebase';
import {
  sendSupplierEmail,
  buildSupplierOrderEmail,
  buildSupplierMessageEmail,
  buildSupplierQuoteEmail,
  SUPPLIER_COPY_EMAIL,
} from '../services/smart-merch-supplier-email';
import {
  sendFanCampaignEmail,
  buildCampaignEmail,
} from '../services/smart-merch-crm-email';
import OpenAI from 'openai';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any });
const BASE_URL = process.env.PRODUCTION_URL || 'http://localhost:5000';

// ── Business model ──────────────────────────────────────────────────────────
// 'boostify_managed'  → Boostify diseña, produce y entrega: el artista recibe el
//                       30% del profit (configurable por admin), Boostify el 70%.
// 'artist_uploaded'   → El artista sube su propio producto: Boostify cobra una
//                       comisión de gestión del 30%, el artista recibe el 70%.
const DEFAULT_MANAGED_ARTIST_PCT = 30;
const SELF_UPLOAD_ARTIST_PCT = 70; // Boostify charges a 30% management commission
const CONTRACT_VERSION = '2026-06-smart-merch-v1';

async function q(text: string, params: unknown[] = []) {
  return pool.query(text, params);
}

function userPgId(user: any): number {
  return Number(user?.pgId ?? user?.id ?? 0);
}

/**
 * True when the authenticated user may manage this artist's store: the artist
 * account itself, a platform admin, OR the creator of an AI-generated artist
 * (users.generated_by === userPgId). The last case is essential because
 * AI artists have their own pgId, distinct from the owner who created them.
 */
async function isOwnerOrAdmin(user: any, artistId: number): Promise<boolean> {
  if (!user) return false;
  if (!!user.isAdmin) return true;
  const uid = userPgId(user);
  if (uid > 0 && Number(artistId) === uid) return true;
  if (uid > 0) {
    try {
      const r = await q(`SELECT generated_by FROM users WHERE id = $1`, [Number(artistId)]);
      if (r.rows[0] && Number(r.rows[0].generated_by) === uid) return true;
    } catch {
      // DB unavailable → deny by ownership, admin already handled above
    }
  }
  return false;
}

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildSerialCode(artistId: number, productId: number, serialNumber: number): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SM-${artistId}-${productId}-${String(serialNumber).padStart(6, '0')}-${rand}`;
}

function normalizeManagementType(value: unknown): 'boostify_managed' | 'artist_uploaded' {
  return value === 'artist_uploaded' ? 'artist_uploaded' : 'boostify_managed';
}

/**
 * Resolves the profit split for a product based on its management model.
 * Boostify-managed → artist share read from admin config (default 30%).
 * Artist-uploaded  → fixed 70% artist / 30% Boostify commission.
 */
async function resolveSplit(
  artistId: number,
  managementType: 'boostify_managed' | 'artist_uploaded'
): Promise<{ artistPct: number; platformPct: number }> {
  if (managementType === 'artist_uploaded') {
    return { artistPct: SELF_UPLOAD_ARTIST_PCT, platformPct: 100 - SELF_UPLOAD_ARTIST_PCT };
  }
  const cfg = await q(`SELECT artist_profit_pct FROM smart_merch_admin_config WHERE artist_id = $1`, [artistId]);
  const artistPct = Math.min(90, Math.max(0, toNum(cfg.rows[0]?.artist_profit_pct, DEFAULT_MANAGED_ARTIST_PCT)));
  return { artistPct, platformPct: 100 - artistPct };
}

async function getSettingsRow(artistId: number): Promise<any | null> {
  const r = await q(`SELECT * FROM smart_merch_settings WHERE artist_id = $1`, [artistId]);
  return r.rows[0] || null;
}

async function isContractAccepted(artistId: number): Promise<boolean> {
  const s = await getSettingsRow(artistId);
  return !!s?.contract_accepted;
}

/**
 * Collects the artist's visual identity (photo + master logo + brand colors) so
 * product/hero imagery can be generated coherently with the artist's brand.
 */
async function getArtistBrandRefs(artistId: number): Promise<{
  artistName: string;
  genre: string;
  references: string[];
  colors: { primary: string; secondary: string; accent: string } | null;
}> {
  try {
    const brand = await loadBrandProfile(artistId);
    const refs = [
      brand?.referenceImages?.artistPhoto,
      brand?.referenceImages?.masterLogo,
      ...(brand?.referenceImages?.additional || []),
    ].filter((u): u is string => !!u && !u.includes('placeholder'));
    return {
      artistName: brand?.artistName || 'Artist',
      genre: brand?.genre || '',
      references: Array.from(new Set(refs)).slice(0, 3),
      colors: brand?.brandColors || null,
    };
  } catch {
    return { artistName: 'Artist', genre: '', references: [], colors: null };
  }
}

// Public list (published products)
router.get('/:artistId(\\d+)', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  try {
    const [productsR, settings] = await Promise.all([
      q(
        `SELECT id, artist_id, title, description, category, image_url, gallery,
                supplier_name, estimated_lead_days, currency, presale_price,
                min_presale_units, max_presale_units, sold_units,
                artist_profit_pct, platform_profit_pct, management_type,
                nfc_enabled, qr_enabled, unlock_type,
                is_example, status, is_published, fulfillment_unlocked,
                linked_event_id, fulfillment_provider, unlock_payload,
                created_at, updated_at
         FROM smart_merch_products
         WHERE artist_id = $1 AND is_published = true AND status <> 'archived'
         ORDER BY created_at DESC`,
        [artistId]
      ),
      getSettingsRow(artistId),
    ]);
    return res.json({
      products: productsR.rows,
      heroImageUrl: settings?.hero_image_url || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Owner manage view
router.get('/:artistId(\\d+)/manage', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const [productsR, summaryR, suppliersR, cfgR, settings] = await Promise.all([
      q(
        `SELECT * FROM smart_merch_products
         WHERE artist_id = $1 AND status <> 'archived'
         ORDER BY created_at DESC`,
        [artistId]
      ),
      q(
        `SELECT
           COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_orders,
           COALESCE(SUM(quantity) FILTER (WHERE payment_status = 'paid'), 0) AS paid_units,
           COALESCE(SUM(subtotal) FILTER (WHERE payment_status = 'paid'), 0) AS gross_revenue,
           COALESCE(SUM(artist_profit_amount) FILTER (WHERE payment_status = 'paid'), 0) AS artist_profit,
           COALESCE(SUM(platform_profit_amount) FILTER (WHERE payment_status = 'paid'), 0) AS platform_profit
         FROM smart_merch_orders
         WHERE artist_id = $1`,
        [artistId]
      ),
      q(
        `SELECT * FROM smart_merch_suppliers WHERE artist_id = $1 AND is_active = true ORDER BY created_at DESC`,
        [artistId]
      ),
      q(`SELECT artist_profit_pct FROM smart_merch_admin_config WHERE artist_id = $1`, [artistId]),
      getSettingsRow(artistId),
    ]);

    return res.json({
      products: productsR.rows,
      summary: summaryR.rows[0] || null,
      suppliers: suppliersR.rows,
      config: {
        artistProfitPct: toNum(cfgR.rows[0]?.artist_profit_pct, DEFAULT_MANAGED_ARTIST_PCT),
        managedArtistPct: toNum(cfgR.rows[0]?.artist_profit_pct, DEFAULT_MANAGED_ARTIST_PCT),
        selfUploadArtistPct: SELF_UPLOAD_ARTIST_PCT,
        contractVersion: CONTRACT_VERSION,
      },
      heroImageUrl: settings?.hero_image_url || null,
      contract: {
        accepted: !!settings?.contract_accepted,
        version: settings?.contract_version || null,
        currentVersion: CONTRACT_VERSION,
        upToDate: !!settings?.contract_accepted && settings?.contract_version === CONTRACT_VERSION,
        acceptedAt: settings?.contract_accepted_at || null,
        signerName: settings?.contract_signer_name || null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create product (owner)
router.post('/', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const {
    artistId,
    title,
    description,
    category = 'wearable',
    imageUrl,
    gallery = [],
    supplierName,
    supplierSku,
    supplierCostUnit,
    estimatedLeadDays = 21,
    currency = 'usd',
    presalePrice,
    minPresaleUnits = 50,
    maxPresaleUnits,
    nfcEnabled = true,
    qrEnabled = true,
    unlockType = 'exclusive-content',
    unlockPayload = {},
    isExample = false,
    managementType = 'boostify_managed',
    linkedEventId = null,
    fulfillmentProvider = null,
  } = req.body;

  if (!artistId || !title || presalePrice == null) {
    return res.status(400).json({ error: 'artistId, title and presalePrice are required' });
  }
  if (!(await isOwnerOrAdmin(user, Number(artistId)))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // The Smart Merch agreement must be signed before listing products.
    if (!isExample && !(await isContractAccepted(Number(artistId)))) {
      return res.status(412).json({ error: 'contract_required', message: 'Debes aceptar el contrato Smart Merch antes de publicar productos.' });
    }

    const mType = normalizeManagementType(managementType);
    const { artistPct, platformPct } = await resolveSplit(Number(artistId), mType);

    const { rows } = await q(
      `INSERT INTO smart_merch_products (
         artist_id, title, description, category, image_url, gallery,
         supplier_name, supplier_sku, supplier_cost_unit, estimated_lead_days,
         currency, presale_price, min_presale_units, max_presale_units,
         artist_profit_pct, platform_profit_pct, management_type,
         nfc_enabled, qr_enabled, unlock_type, unlock_payload,
         linked_event_id, fulfillment_provider,
         is_example, is_published, status
       ) VALUES (
         $1,$2,$3,$4,$5,$6,
         $7,$8,$9,$10,
         $11,$12,$13,$14,
         $15,$16,$17,
         $18,$19,$20,$21,
         $22,$23,
         $24,false,'draft'
       ) RETURNING *`,
      [
        Number(artistId),
        String(title).trim(),
        description || null,
        category,
        imageUrl || null,
        JSON.stringify(Array.isArray(gallery) ? gallery : []),
        supplierName || null,
        supplierSku || null,
        supplierCostUnit != null ? toNum(supplierCostUnit) : null,
        Math.max(1, Math.round(toNum(estimatedLeadDays, 21))),
        currency,
        toNum(presalePrice),
        Math.max(1, Math.round(toNum(minPresaleUnits, 50))),
        maxPresaleUnits != null ? Math.max(1, Math.round(toNum(maxPresaleUnits))) : null,
        artistPct,
        platformPct,
        mType,
        !!nfcEnabled,
        !!qrEnabled,
        unlockType,
        JSON.stringify(unlockPayload || {}),
        linkedEventId != null ? Math.round(toNum(linkedEventId)) || null : null,
        fulfillmentProvider || null,
        !!isExample,
      ]
    );

    return res.json({ product: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const UPDATABLE: Record<string, string> = {
  title: 'title',
  description: 'description',
  category: 'category',
  imageUrl: 'image_url',
  gallery: 'gallery',
  supplierName: 'supplier_name',
  supplierSku: 'supplier_sku',
  supplierCostUnit: 'supplier_cost_unit',
  estimatedLeadDays: 'estimated_lead_days',
  currency: 'currency',
  presalePrice: 'presale_price',
  minPresaleUnits: 'min_presale_units',
  maxPresaleUnits: 'max_presale_units',
  nfcEnabled: 'nfc_enabled',
  qrEnabled: 'qr_enabled',
  unlockType: 'unlock_type',
  unlockPayload: 'unlock_payload',
  linkedEventId: 'linked_event_id',
  fulfillmentProvider: 'fulfillment_provider',
};

router.put('/:productId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existingR = await q(`SELECT * FROM smart_merch_products WHERE id = $1`, [productId]);
    const existing = existingR.rows[0];
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    if (!(await isOwnerOrAdmin(user, Number(existing.artist_id)))) return res.status(403).json({ error: 'Forbidden' });

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const [k, col] of Object.entries(UPDATABLE)) {
      if (req.body[k] === undefined) continue;
      let v: unknown = req.body[k];
      if (k === 'gallery' || k === 'unlockPayload') v = JSON.stringify(v || (k === 'gallery' ? [] : {}));
      if (k === 'supplierCostUnit' || k === 'presalePrice') v = toNum(v);
      if (k === 'minPresaleUnits' || k === 'maxPresaleUnits' || k === 'estimatedLeadDays') v = Math.max(1, Math.round(toNum(v, 1)));
      sets.push(`${col} = $${idx++}`);
      vals.push(v);
    }

    // Switching management model recomputes the profit split server-side.
    if (req.body.managementType !== undefined) {
      const mType = normalizeManagementType(req.body.managementType);
      const { artistPct, platformPct } = await resolveSplit(Number(existing.artist_id), mType);
      sets.push(`management_type = $${idx++}`); vals.push(mType);
      sets.push(`artist_profit_pct = $${idx++}`); vals.push(artistPct);
      sets.push(`platform_profit_pct = $${idx++}`); vals.push(platformPct);
    }

    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    sets.push(`updated_at = NOW()`);

    vals.push(productId);

    const updated = await q(
      `UPDATE smart_merch_products SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return res.json({ product: updated.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:productId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const existingR = await q(`SELECT * FROM smart_merch_products WHERE id = $1`, [productId]);
    const existing = existingR.rows[0];
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    if (!(await isOwnerOrAdmin(user, Number(existing.artist_id)))) return res.status(403).json({ error: 'Forbidden' });

    await q(`UPDATE smart_merch_products SET status = 'archived', is_published = false, updated_at = NOW() WHERE id = $1`, [productId]);
    return res.json({ archived: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:productId(\\d+)/publish', authenticate, async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existingR = await q(`SELECT * FROM smart_merch_products WHERE id = $1`, [productId]);
    const product = existingR.rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!(await isOwnerOrAdmin(user, Number(product.artist_id)))) return res.status(403).json({ error: 'Forbidden' });
    if (product.presale_price == null) return res.status(400).json({ error: 'presalePrice is required' });
    if (toNum(product.min_presale_units) < 1) return res.status(400).json({ error: 'minPresaleUnits must be >= 1' });
    if (!(await isContractAccepted(Number(product.artist_id)))) {
      return res.status(412).json({ error: 'contract_required', message: 'Debes aceptar el contrato Smart Merch antes de publicar productos.' });
    }

    const updated = await q(
      `UPDATE smart_merch_products
       SET is_published = true, status = 'presale_live', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [productId]
    );

    return res.json({ product: updated.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Suppliers / fulfillment providers ───────────────────────────────────────
/**
 * Curated directory of fulfillment & manufacturing providers the artist can
 * connect. Works in manual mode today (the artist sends orders by hand) and is
 * API-ready for future automated fulfillment.
 */
const SUPPLIER_CATALOG = [
  { key: 'printful', name: 'Printful', kind: 'print-on-demand', website: 'https://www.printful.com', regions: ['US', 'EU', 'Global'], apiReady: true, note: 'Apparel, posters & accessories, automated POD.' },
  { key: 'printify', name: 'Printify', kind: 'print-on-demand', website: 'https://printify.com', regions: ['US', 'EU', 'Global'], apiReady: true, note: 'Large POD network, competitive pricing.' },
  { key: 'gelato', name: 'Gelato', kind: 'print-on-demand', website: 'https://www.gelato.com', regions: ['Global'], apiReady: true, note: 'Local production in 32+ countries.' },
  { key: 'gooten', name: 'Gooten', kind: 'print-on-demand', website: 'https://www.gooten.com', regions: ['US', 'Global'], apiReady: true, note: 'POD with wide catalog & fulfillment API.' },
  { key: 'shineon', name: 'ShineOn', kind: 'jewelry', website: 'https://www.shineon.com', regions: ['US', 'Global'], apiReady: false, note: 'Custom jewelry & accessories on demand.' },
  { key: 'alibaba', name: 'Alibaba (manual sourcing)', kind: 'manufacturing', website: 'https://www.alibaba.com', regions: ['Global'], apiReady: false, note: 'Bulk manufacturing & custom sourcing.' },
  { key: 'nfc-factory', name: 'NFC Tag Manufacturer', kind: 'nfc', website: '', regions: ['Global'], apiReady: false, note: 'NFC wristbands, cards, chips & encoding.' },
  { key: 'vinyl-press', name: 'Vinyl Pressing Plant', kind: 'vinyl', website: '', regions: ['US', 'EU'], apiReady: false, note: 'Limited vinyl pressing & packaging.' },
  { key: 'custom', name: 'Custom Supplier', kind: 'custom', website: '', regions: [], apiReady: false, note: 'Any other manufacturer you work with.' },
];

// Public provider catalog (used by the connect UI)
router.get('/suppliers/catalog', (_req: Request, res: Response) => {
  return res.json({ providers: SUPPLIER_CATALOG });
});

// ── Per-product supplier directory ──────────────────────────────────────────
// A curated directory of real manufacturing / fulfillment partners with public
// contact emails, grouped by product category. Each product gets at least 3
// matching suppliers the artist can reach out to (RFQ) directly from the UI.
// Emails are the suppliers' public sales/support addresses and remain editable
// before sending. Everything is in English.
interface DirectorySupplier {
  name: string;
  email: string;
  website: string;
  kind: string;
  regions: string[];
  moq: string;
  leadDays: string;
  note: string;
}

const SUPPLIER_DIRECTORY: Record<string, DirectorySupplier[]> = {
  wearable: [
    { name: 'Printful', email: 'support@printful.com', website: 'https://www.printful.com', kind: 'Print-on-demand apparel', regions: ['US', 'EU', 'Global'], moq: 'No MOQ (1+)', leadDays: '2–7 days', note: 'Premium DTG & embroidery, automated fulfillment, global facilities.' },
    { name: 'Printify', email: 'merchant.support@printify.com', website: 'https://printify.com', kind: 'Print-on-demand network', regions: ['US', 'EU', 'Global'], moq: 'No MOQ (1+)', leadDays: '2–7 days', note: 'Largest POD network with competitive pricing across many print partners.' },
    { name: 'Apliiq', email: 'support@apliiq.com', website: 'https://www.apliiq.com', kind: 'Premium custom apparel', regions: ['US'], moq: 'No MOQ (1+)', leadDays: '5–10 days', note: 'Private-label fashion, custom dyeing, woven labels, relabeling.' },
    { name: 'SPOD (Spreadshirt)', email: 'service@spod.com', website: 'https://www.spod.com', kind: 'Print-on-demand apparel', regions: ['US', 'EU'], moq: 'No MOQ (1+)', leadDays: '48h production', note: 'Fast 48-hour production, broad apparel catalog.' },
  ],
  accessory: [
    { name: 'Printful', email: 'support@printful.com', website: 'https://www.printful.com', kind: 'Hats, bags, phone cases', regions: ['US', 'EU', 'Global'], moq: 'No MOQ (1+)', leadDays: '2–7 days', note: 'Embroidered caps, tote bags, phone cases and more on demand.' },
    { name: 'Gelato', email: 'support@gelato.com', website: 'https://www.gelato.com', kind: 'Local production network', regions: ['Global (32+ countries)'], moq: 'No MOQ (1+)', leadDays: '2–6 days', note: 'Produces locally in 32+ countries to cut shipping time & cost.' },
    { name: 'Gooten', email: 'support@gooten.com', website: 'https://www.gooten.com', kind: 'Accessories & home goods', regions: ['US', 'Global'], moq: 'No MOQ (1+)', leadDays: '3–8 days', note: 'Wide accessory catalog with a robust fulfillment API.' },
    { name: 'GS-JJ', email: 'service@gs-jj.com', website: 'https://www.gs-jj.com', kind: 'Custom pins, patches, keychains', regions: ['US', 'Global'], moq: '50–100 units', leadDays: '2–3 weeks', note: 'Enamel pins, embroidered patches, keychains and lanyards.' },
  ],
  collectible: [
    { name: 'GS-JJ', email: 'service@gs-jj.com', website: 'https://www.gs-jj.com', kind: 'Pins, coins, medallions', regions: ['US', 'Global'], moq: '50–100 units', leadDays: '2–3 weeks', note: 'Custom enamel pins, challenge coins and collectible medallions.' },
    { name: 'GoToTags', email: 'sales@gototags.com', website: 'https://gototags.com', kind: 'NFC tags & encoding', regions: ['US', 'Global'], moq: '100 units', leadDays: '1–2 weeks', note: 'NFC chips, cards & encoding for tap-to-unlock collectibles.' },
    { name: 'Seritag', email: 'info@seritag.com', website: 'https://seritag.com', kind: 'NFC products', regions: ['EU', 'Global'], moq: '50 units', leadDays: '1–2 weeks', note: 'Custom-printed NFC tags & wristbands, reliable encoding.' },
    { name: 'Alibaba sourcing', email: '', website: 'https://www.alibaba.com', kind: 'Bulk custom manufacturing', regions: ['Global'], moq: 'Varies (often 100+)', leadDays: '3–6 weeks', note: 'Source custom figurines/collectibles directly from manufacturers (contact via platform).' },
  ],
  vinyl: [
    { name: 'United Record Pressing', email: 'sales@urpressing.com', website: 'https://www.urpressing.com', kind: 'Vinyl pressing plant', regions: ['US'], moq: '100–500 units', leadDays: '8–14 weeks', note: 'Largest US vinyl pressing plant, full packaging services.' },
    { name: 'GZ Media', email: 'sales@gzmedia.com', website: 'https://www.gzvinyl.com', kind: 'Vinyl pressing plant', regions: ['EU', 'Global'], moq: '100–300 units', leadDays: '6–12 weeks', note: 'World’s largest vinyl manufacturer, color & special editions.' },
    { name: 'Furnace Record Pressing', email: 'info@furnacemfg.com', website: 'https://www.furnacerecordpressing.com', kind: 'Vinyl pressing plant', regions: ['US'], moq: '100–500 units', leadDays: '10–14 weeks', note: 'Boutique pressing & premium packaging for indie artists.' },
    { name: 'Quality Record Pressings', email: 'info@qualityrecordpressings.com', website: 'https://qualityrecordpressings.com', kind: 'Audiophile pressing', regions: ['US'], moq: '300+ units', leadDays: '8–12 weeks', note: 'Audiophile-grade pressings on premium vinyl.' },
  ],
  poster: [
    { name: 'Printful', email: 'support@printful.com', website: 'https://www.printful.com', kind: 'Posters & wall art', regions: ['US', 'EU', 'Global'], moq: 'No MOQ (1+)', leadDays: '2–7 days', note: 'Posters, framed prints and canvas on demand.' },
    { name: 'Gelato', email: 'support@gelato.com', website: 'https://www.gelato.com', kind: 'Posters & fine-art prints', regions: ['Global'], moq: 'No MOQ (1+)', leadDays: '2–6 days', note: 'Local printing of posters & fine-art prints worldwide.' },
    { name: 'CatPrint', email: 'support@catprint.com', website: 'https://www.catprint.com', kind: 'Offset & digital print', regions: ['US'], moq: 'Low (25+)', leadDays: '3–7 days', note: 'High-quality digital printing for posters and art cards.' },
    { name: 'PrintPlace', email: 'sales@printplace.com', website: 'https://www.printplace.com', kind: 'Bulk poster printing', regions: ['US'], moq: 'Bulk (50+)', leadDays: '4–8 days', note: 'Cost-effective bulk posters & promo prints.' },
  ],
  other: [
    { name: 'Printify', email: 'merchant.support@printify.com', website: 'https://printify.com', kind: 'Print-on-demand network', regions: ['US', 'EU', 'Global'], moq: 'No MOQ (1+)', leadDays: '2–7 days', note: 'Broadest catalog covering most merch categories.' },
    { name: 'Gelato', email: 'support@gelato.com', website: 'https://www.gelato.com', kind: 'Local production network', regions: ['Global'], moq: 'No MOQ (1+)', leadDays: '2–6 days', note: 'Local production in 32+ countries for fast global delivery.' },
    { name: 'Gooten', email: 'support@gooten.com', website: 'https://www.gooten.com', kind: 'Print-on-demand & fulfillment', regions: ['US', 'Global'], moq: 'No MOQ (1+)', leadDays: '3–8 days', note: 'Versatile catalog with strong fulfillment API.' },
    { name: 'Alibaba sourcing', email: '', website: 'https://www.alibaba.com', kind: 'Bulk custom manufacturing', regions: ['Global'], moq: 'Varies (often 100+)', leadDays: '3–6 weeks', note: 'Source any custom product directly from manufacturers (contact via platform).' },
  ],
};

// Map a product's category to a directory bucket.
function directoryBucketFor(category?: string | null): keyof typeof SUPPLIER_DIRECTORY {
  const c = String(category || '').toLowerCase();
  if (c.includes('wear') || c.includes('apparel') || c.includes('shirt') || c.includes('hoodie') || c.includes('cloth')) return 'wearable';
  if (c.includes('vinyl') || c.includes('record')) return 'vinyl';
  if (c.includes('poster') || c.includes('print') || c.includes('art')) return 'poster';
  if (c.includes('access') || c.includes('hat') || c.includes('cap') || c.includes('bag')) return 'accessory';
  if (c.includes('collect') || c.includes('nfc') || c.includes('pin') || c.includes('figure')) return 'collectible';
  return 'other';
}

// Full supplier directory (all categories, flattened) for the module-level
// "Recommended suppliers" panel. Public — same as the provider catalog.
router.get('/suppliers/directory', (_req: Request, res: Response) => {
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const [category, list] of Object.entries(SUPPLIER_DIRECTORY)) {
    for (const s of list) {
      const dedupeKey = `${s.name}|${category}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ ...s, category });
    }
  }
  return res.json({ copyEmail: SUPPLIER_COPY_EMAIL, suppliers: out });
});

// Suggested suppliers for a specific product (>=3 matched by category).
router.get('/:artistId(\\d+)/products/:productId(\\d+)/suppliers/suggested', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const productId = parseInt(req.params.productId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { rows } = await q(
      `SELECT id, title, category, image_url, min_presale_units, presale_price, currency, supplier_cost_unit
       FROM smart_merch_products WHERE id = $1 AND artist_id = $2`,
      [productId, artistId]
    );
    const product = rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const bucket = directoryBucketFor(product.category);
    const suppliers = SUPPLIER_DIRECTORY[bucket] || SUPPLIER_DIRECTORY.other;
    return res.json({ category: bucket, copyEmail: SUPPLIER_COPY_EMAIL, suppliers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Send a Request-for-Quote (RFQ) to a directory supplier for a product.
// Delivered via Resend → Brevo; a copy is CC'd to the operator and supplier
// replies are routed back to them (SUPPLIER_COPY_EMAIL, default convoycubano@gmail.com).
router.post('/:artistId(\\d+)/products/:productId(\\d+)/suppliers/contact', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const productId = parseInt(req.params.productId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  const { supplierName, supplierEmail, message, estimatedQuantity } = req.body || {};
  const toEmail = String(supplierEmail || '').trim();
  if (!toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return res.status(400).json({ error: 'A valid supplier email is required' });
  }

  try {
    const { rows } = await q(
      `SELECT p.id, p.title, p.category, p.image_url, p.min_presale_units, p.supplier_cost_unit, p.currency,
              COALESCE(u.artist_name, u.username) AS artist_name
       FROM smart_merch_products p
       LEFT JOIN users u ON u.id = p.artist_id
       WHERE p.id = $1 AND p.artist_id = $2`,
      [productId, artistId]
    );
    const product = rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const qty = estimatedQuantity != null ? Math.max(1, parseInt(String(estimatedQuantity), 10) || 0) : (Number(product.min_presale_units) || null);
    const built = buildSupplierQuoteEmail({
      supplierName: supplierName || 'team',
      productTitle: product.title,
      category: product.category,
      estimatedQuantity: qty,
      targetPrice: product.supplier_cost_unit != null ? toNum(product.supplier_cost_unit) : null,
      currency: product.currency || 'usd',
      artistName: product.artist_name || null,
      productImageUrl: product.image_url || null,
      extraNotes: message ? String(message) : null,
    });

    // Reply-to + CC the operator so every supplier response is copied to them.
    const result = await sendSupplierEmail(toEmail, built.subject, built.html, {
      cc: SUPPLIER_COPY_EMAIL,
      replyTo: SUPPLIER_COPY_EMAIL,
    });

    if (!result.success) {
      return res.status(502).json({ error: result.error || 'Email could not be sent' });
    }
    return res.json({ sent: true, provider: result.provider, copyEmail: SUPPLIER_COPY_EMAIL });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Connect / add a supplier
router.post('/:artistId(\\d+)/suppliers', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  const {
    supplierName, providerKey, contactName, contactEmail, contactPhone,
    regions = [], notes, fulfillmentMode = 'manual', website, apiKey,
  } = req.body;

  // Resolve from the catalog when a known provider key is connected.
  const catalogEntry = SUPPLIER_CATALOG.find((p) => p.key === providerKey);
  const resolvedName = supplierName || catalogEntry?.name;
  if (!resolvedName) return res.status(400).json({ error: 'supplierName or providerKey is required' });

  try {
    const inserted = await q(
      `INSERT INTO smart_merch_suppliers (
         artist_id, supplier_name, provider_key, contact_name, contact_email, contact_phone,
         regions, notes, fulfillment_mode, website, api_connected
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        artistId,
        resolvedName,
        providerKey || null,
        contactName || null,
        contactEmail || null,
        contactPhone || null,
        JSON.stringify(regions.length ? regions : (catalogEntry?.regions || [])),
        notes || catalogEntry?.note || null,
        fulfillmentMode === 'api' ? 'api' : 'manual',
        website || catalogEntry?.website || null,
        !!(apiKey && String(apiKey).trim()),
      ]
    );
    return res.json({ supplier: inserted.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Remove (deactivate) a connected supplier
router.delete('/:artistId(\\d+)/suppliers/:supplierId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const supplierId = parseInt(req.params.supplierId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    await q(`UPDATE smart_merch_suppliers SET is_active = false, updated_at = NOW() WHERE id = $1 AND artist_id = $2`, [supplierId, artistId]);
    return res.json({ removed: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Artist's published concert events (to link a product to a show — ticket ↔ merch ecosystem)
router.get('/:artistId(\\d+)/events', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { rows } = await q(
      `SELECT id, title, status, starts_at, venue, location
       FROM concert_events
       WHERE artist_id = $1 AND status IN ('draft','published','live')
       ORDER BY COALESCE(starts_at, created_at) DESC
       LIMIT 50`,
      [artistId]
    );
    return res.json({ events: rows });
  } catch (err: any) {
    // concert_events may not exist in some environments — degrade gracefully
    return res.json({ events: [] });
  }
});
/**
 * The full Boostify Smart Merch catalog of interactive products. Each item maps
 * to a valid DB category/unlock_type and carries a brand-aware image prompt.
 * `imagePrompt(name, styleLine)` builds an on-brand product-photography prompt.
 */
const SMART_MERCH_CATALOG: Array<{
  title: string;
  category: 'wearable' | 'collectible' | 'vinyl' | 'poster' | 'accessory' | 'other';
  unlockType: 'exclusive-content' | 'discount' | 'fan-club' | 'vip-message' | 'download' | 'other';
  price: number;
  minUnits: number;
  story: string;
  reward: string;
  imagePrompt: (name: string, styleLine: string) => string;
}> = [
  { title: 'NFC Bracelet', category: 'accessory', unlockType: 'exclusive-content', price: 29, minUnits: 100,
    story: 'A tap-to-unlock NFC wristband that opens the artist\'s private digital universe.',
    reward: 'Unreleased track + private fan community access',
    imagePrompt: (n, s) => `Premium NFC silicone-and-metal wristband bracelet for ${n}, subtle embedded smart chip, ${s}, isolated luxury product shot on dark studio background, dramatic lighting, no text` },
  { title: 'Metallic NFC Card', category: 'accessory', unlockType: 'exclusive-content', price: 39, minUnits: 80,
    story: 'A black metal collectible card with an NFC chip that links to the artist\'s digital vault.',
    reward: 'Digital ownership certificate + backstage gallery',
    imagePrompt: (n, s) => `Black anodized metal collectible NFC card for ${n}, engraved logo, embedded smart chip, ${s}, premium macro product photography, reflective surface, no text` },
  { title: 'Smart Vinyl', category: 'vinyl', unlockType: 'download', price: 58, minUnits: 50,
    story: 'A limited vinyl record with a QR unlock card for the hi-res digital album and bonus tracks.',
    reward: 'Hi-res digital album + bonus tracks download',
    imagePrompt: (n, s) => `Limited edition smart vinyl record with metallic sleeve and QR unlock card for ${n}, ${s}, premium product mockup, studio lighting, no watermark, no text` },
  { title: 'AR Poster', category: 'poster', unlockType: 'exclusive-content', price: 34, minUnits: 60,
    story: 'A premium poster that comes alive with augmented reality when scanned.',
    reward: 'AR experience + animated cover art',
    imagePrompt: (n, s) => `Premium augmented-reality concert poster for ${n} on a wall, glowing AR scan marker, ${s}, cinematic product photography, no text` },
  { title: 'Album Perfume', category: 'other', unlockType: 'fan-club', price: 64, minUnits: 70,
    story: 'A signature fragrance inspired by the album, with an NFC cap that unlocks a fan-club tier.',
    reward: 'Fan-club membership + scented album story',
    imagePrompt: (n, s) => `Luxury album-concept perfume bottle for ${n}, elegant glass flacon with NFC cap, ${s}, high-end fragrance product photography, soft studio light, no text` },
  { title: 'Concept Candle', category: 'other', unlockType: 'exclusive-content', price: 32, minUnits: 80,
    story: 'A scented concept candle whose QR seal plays an exclusive ambient track while it burns.',
    reward: 'Exclusive ambient track + listening ritual',
    imagePrompt: (n, s) => `Premium concept scented candle in a matte vessel for ${n}, QR seal on the lid, ${s}, cozy luxury product photography, warm lighting, no text` },
  { title: 'Collectible Figure', category: 'collectible', unlockType: 'exclusive-content', price: 89, minUnits: 40,
    story: 'A numbered collectible figure of the artist with an NFC base linking to a 3D digital twin.',
    reward: '3D digital twin + numbered certificate',
    imagePrompt: (n, s) => `Highly detailed collectible vinyl art figure of musician ${n} on an NFC display base, numbered edition, ${s}, premium toy product photography, no text` },
  { title: 'Fan Passport', category: 'collectible', unlockType: 'fan-club', price: 24, minUnits: 120,
    story: 'A physical fan passport that stamps every show and unlocks fan-club levels via QR.',
    reward: 'Fan-club levels + event stamps + presale access',
    imagePrompt: (n, s) => `Premium embossed fan passport booklet for ${n} with QR seal and gold foil, ${s}, flat lay product photography, no text` },
  { title: 'Artist Coin', category: 'collectible', unlockType: 'vip-message', price: 49, minUnits: 60,
    story: 'A minted artist coin with an NFC core that delivers a personal VIP voice message.',
    reward: 'Personal VIP voice message + collector status',
    imagePrompt: (n, s) => `Minted commemorative metal artist coin for ${n}, engraved relief, embedded NFC core, ${s}, macro luxury product photography on velvet, no text` },
  { title: 'Digital Key', category: 'accessory', unlockType: 'download', price: 27, minUnits: 100,
    story: 'A keychain digital key that unlocks a private download vault of stems and demos.',
    reward: 'Private vault: stems, demos, alternate versions',
    imagePrompt: (n, s) => `Sleek metal keychain digital key with embedded smart chip for ${n}, ${s}, premium accessory product photography, dark reflective surface, no text` },
  { title: 'Mystery Box', category: 'collectible', unlockType: 'exclusive-content', price: 99, minUnits: 50,
    story: 'A curated mystery box of physical artifacts, each item activating digital surprises.',
    reward: 'Surprise physical items + stacked digital unlocks',
    imagePrompt: (n, s) => `Luxury matte black mystery box for ${n} with foil logo, slightly open revealing glow, ${s}, premium unboxing product photography, no text` },
  { title: 'Digital Memory Necklace', category: 'accessory', unlockType: 'exclusive-content', price: 54, minUnits: 70,
    story: 'A pendant necklace with NFC memory that stores a private message and unreleased song.',
    reward: 'Private message + unreleased song memory',
    imagePrompt: (n, s) => `Elegant pendant necklace with embedded NFC memory chip for ${n}, ${s}, premium jewelry product photography, soft reflective light, no text` },
  { title: 'Smart Patch', category: 'accessory', unlockType: 'discount', price: 19, minUnits: 150,
    story: 'An iron-on smart patch that unlocks store discounts and limited drops when tapped.',
    reward: 'Store discounts + early access to limited drops',
    imagePrompt: (n, s) => `Embroidered iron-on smart patch with subtle NFC thread for ${n}, ${s}, premium textile product macro photography, no text` },
  { title: 'Music Lamp', category: 'other', unlockType: 'exclusive-content', price: 74, minUnits: 50,
    story: 'A reactive music lamp that syncs to the artist\'s tracks and unlocks light shows via QR.',
    reward: 'Synced light shows + ambient exclusive mixes',
    imagePrompt: (n, s) => `Modern reactive music lamp glowing in brand colors for ${n}, minimalist design, QR on base, ${s}, premium tech product photography, dark room, no text` },
  { title: 'Smart Tee (Print-on-Demand)', category: 'wearable', unlockType: 'exclusive-content', price: 44, minUnits: 80,
    story: 'A print-on-demand tee with an NFC tag connecting the wearer to exclusive content.',
    reward: 'Exclusive content + behind-the-scenes clips',
    imagePrompt: (n, s) => `Premium print-on-demand t-shirt mockup for ${n} with subtle NFC neck tag, ${s}, ecommerce apparel product photography on neutral background, no text` },
];

/**
 * Background image generation: fills in product images a few at a time so the
 * request returns instantly with the full catalog, then images appear as they
 * finish (the client polls /manage). Best-effort — a failed image leaves the
 * row intact (regenerate later via the per-product button).
 */
async function generateCatalogImages(
  items: Array<{ id: number; prompt: string }>,
  references: string[],
): Promise<void> {
  const BATCH = 3;
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async ({ id, prompt }) => {
        try {
          const ai = references.length
            ? await editImageWithGPTImage1(references, prompt, { size: '1024x1024', quality: 'high', outputFolder: 'smart-merch' })
            : await generateImageWithGPTImage1(prompt, { size: '1024x1024', quality: 'high' });
          if (ai.success && ai.imageUrl) {
            await q(`UPDATE smart_merch_products SET image_url = $1, updated_at = NOW() WHERE id = $2`, [ai.imageUrl, id]);
          }
        } catch {
          // leave row without image; regenerate later
        }
      })
    );
  }
}

router.post('/:artistId(\\d+)/generate-examples', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  const { artistName = 'Artist', style = 'futuristic luxury', force = false } = req.body || {};

  try {
    if (force) {
      await q(`DELETE FROM smart_merch_products WHERE artist_id = $1 AND is_example = true AND status = 'draft'`, [artistId]);
    }

    // Pull the artist's visual identity for coherent, on-brand mockups.
    const brand = await getArtistBrandRefs(artistId);
    const displayName = brand.artistName && brand.artistName !== 'Artist' ? brand.artistName : artistName;
    const palette = brand.colors
      ? `brand palette ${brand.colors.primary}/${brand.colors.secondary}/${brand.colors.accent}`
      : '';
    const styleLine = [style, palette, brand.genre ? `${brand.genre} aesthetic` : ''].filter(Boolean).join(', ');

    const { artistPct, platformPct } = await resolveSplit(artistId, 'boostify_managed');

    // 1) Insert all 15 catalog rows immediately (no images yet) so the full
    //    store appears instantly.
    const generated: any[] = [];
    for (const t of SMART_MERCH_CATALOG) {
      const row = await q(
        `INSERT INTO smart_merch_products (
           artist_id, title, description, category, image_url,
           currency, presale_price, min_presale_units,
           artist_profit_pct, platform_profit_pct, management_type,
           nfc_enabled, qr_enabled, unlock_type, unlock_payload,
           is_example, is_published, status
         ) VALUES (
           $1,$2,$3,$4,NULL,
           'usd',$5,$6,
           $7,$8,'boostify_managed',
           true,true,$9,$10,
           true,false,'draft'
         ) RETURNING *`,
        [
          artistId,
          t.title,
          t.story,
          t.category,
          t.price,
          t.minUnits,
          artistPct,
          platformPct,
          t.unlockType,
          JSON.stringify({
            headline: `${displayName} Smart Unlock`,
            reward: t.reward,
            source: 'openai-example',
          }),
        ]
      );
      generated.push(row.rows[0]);
    }

    // 2) Generate the product images in the background (batched).
    const imageJobs = generated.map((row, idx) => ({
      id: row.id,
      prompt: SMART_MERCH_CATALOG[idx].imagePrompt(displayName, styleLine),
    }));
    void generateCatalogImages(imageJobs, brand.references);

    return res.json({ products: generated, generatingImages: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── AI imagery + contract ────────────────────────────────────────────────────

/**
 * Generate (or regenerate) a single product's image using the artist's identity
 * (photo + master logo + brand colors) as a reference for an on-brand result.
 * POST /api/smart-merch/products/:productId/generate-image
 */
router.post('/products/:productId(\\d+)/generate-image', authenticate, async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existingR = await q(`SELECT * FROM smart_merch_products WHERE id = $1`, [productId]);
    const product = existingR.rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!(await isOwnerOrAdmin(user, Number(product.artist_id)))) return res.status(403).json({ error: 'Forbidden' });

    const brand = await getArtistBrandRefs(Number(product.artist_id));
    const palette = brand.colors
      ? `brand palette ${brand.colors.primary}/${brand.colors.secondary}/${brand.colors.accent}`
      : '';
    const smart = [
      product.nfc_enabled ? 'embedded NFC smart tag' : '',
      product.qr_enabled ? 'QR unlock card' : '',
    ].filter(Boolean).join(' and ');

    const extraPrompt = String(req.body?.prompt || '').trim();
    const prompt = [
      `Premium e-commerce product photograph of "${product.title}"`,
      `for the artist ${brand.artistName}`,
      product.category ? `category: ${product.category}` : '',
      smart ? `featuring ${smart}` : '',
      palette,
      brand.genre ? `${brand.genre} luxury aesthetic` : 'luxury aesthetic',
      'studio lighting, clean background, hyper-detailed, centered, no text, no watermark, no logo text',
      extraPrompt,
    ].filter(Boolean).join(', ');

    const ai = brand.references.length
      ? await editImageWithGPTImage1(brand.references, prompt, { size: '1024x1024', quality: 'high', outputFolder: 'smart-merch' })
      : await generateImageWithGPTImage1(prompt, { size: '1024x1024', quality: 'high' });

    if (!ai.success || !ai.imageUrl) {
      return res.status(502).json({ error: ai.error || 'Image generation failed' });
    }

    const updated = await q(
      `UPDATE smart_merch_products SET image_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [ai.imageUrl, productId]
    );

    return res.json({ product: updated.rows[0], imageUrl: ai.imageUrl, usedReference: brand.references.length > 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Upload a product image for artist-owned (non-AI) products. Accepts a base64
 * data URL in `image` and stores it in Firebase Storage, returning a public URL.
 * POST /api/smart-merch/products/:productId/upload-image
 */
router.post('/products/:productId(\\d+)/upload-image', authenticate, async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existingR = await q(`SELECT * FROM smart_merch_products WHERE id = $1`, [productId]);
    const product = existingR.rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!(await isOwnerOrAdmin(user, Number(product.artist_id)))) return res.status(403).json({ error: 'Forbidden' });

    const dataUrl = String(req.body?.image || '').trim();
    const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'A base64 image data URL is required' });

    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'Image too large (max 8MB)' });

    const ext = (mimeType.split('/')[1] || 'png').replace('+xml', '');
    const fileName = `smart-merch-uploads/${product.artist_id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType: mimeType }, public: true, validation: false });
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;

    const updated = await q(
      `UPDATE smart_merch_products SET image_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [imageUrl, productId]
    );
    return res.json({ product: updated.rows[0], imageUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Generate an AI hero/cover banner for the Smart Merch storefront,
 * blending the Boostify identity with the artist's brand and the smart-product story.
 * POST /api/smart-merch/:artistId/hero-image/generate
 */
router.post('/:artistId(\\d+)/hero-image/generate', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const brand = await getArtistBrandRefs(artistId);
    const palette = brand.colors
      ? `brand colors ${brand.colors.primary}, ${brand.colors.secondary} and ${brand.colors.accent}`
      : 'electric magenta, violet and cyan';

    const prompt = [
      'Cinematic luxury hero banner for "BOOSTIFY SMART MERCH ENGINE", a futuristic smart-merchandise storefront',
      `for the artist ${brand.artistName}`,
      'showcasing premium physical products with embedded NFC smart tags and QR unlock cards floating in a high-tech boutique',
      'holographic light, glowing NFC/QR icons, premium packaging, tech-luxury editorial style',
      palette,
      brand.genre ? `${brand.genre} mood` : '',
      'wide cinematic composition, dramatic studio lighting, ultra detailed, no text, no words, no watermark',
    ].filter(Boolean).join(', ');

    const ai = brand.references.length
      ? await editImageWithGPTImage1(brand.references, prompt, { size: '1536x1024', quality: 'high', outputFolder: 'smart-merch-hero' })
      : await generateImageWithGPTImage1(prompt, { size: '1536x1024', quality: 'high' });

    if (!ai.success || !ai.imageUrl) {
      return res.status(502).json({ error: ai.error || 'Hero generation failed' });
    }

    await q(
      `INSERT INTO smart_merch_settings (artist_id, hero_image_url, hero_prompt, hero_generated_at, updated_at)
       VALUES ($1,$2,$3,NOW(),NOW())
       ON CONFLICT (artist_id)
       DO UPDATE SET hero_image_url = EXCLUDED.hero_image_url,
                     hero_prompt = EXCLUDED.hero_prompt,
                     hero_generated_at = NOW(),
                     updated_at = NOW()`,
      [artistId, ai.imageUrl, prompt]
    );

    return res.json({ heroImageUrl: ai.imageUrl, usedReference: brand.references.length > 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Smart Merch agreement text (transparent fee terms) + acceptance status.
 * GET  /api/smart-merch/:artistId/contract
 */
router.get('/:artistId(\\d+)/contract', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const [settings, cfg] = await Promise.all([
      getSettingsRow(artistId),
      q(`SELECT artist_profit_pct FROM smart_merch_admin_config WHERE artist_id = $1`, [artistId]),
    ]);
    const managedArtistPct = toNum(cfg.rows[0]?.artist_profit_pct, DEFAULT_MANAGED_ARTIST_PCT);

    return res.json({
      version: CONTRACT_VERSION,
      accepted: !!settings?.contract_accepted,
      acceptedVersion: settings?.contract_version || null,
      upToDate: !!settings?.contract_accepted && settings?.contract_version === CONTRACT_VERSION,
      acceptedAt: settings?.contract_accepted_at || null,
      signerName: settings?.contract_signer_name || null,
      terms: {
        managedArtistPct,
        managedPlatformPct: 100 - managedArtistPct,
        selfUploadArtistPct: SELF_UPLOAD_ARTIST_PCT,
        selfUploadCommissionPct: 100 - SELF_UPLOAD_ARTIST_PCT,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Accept the Smart Merch agreement (records signer + version + timestamp + IP).
 * POST /api/smart-merch/:artistId/contract/accept  { signerName, signerEmail }
 */
router.post('/:artistId(\\d+)/contract/accept', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  const signerName = String(req.body?.signerName || '').trim();
  const signerEmail = String(req.body?.signerEmail || '').trim();
  if (!signerName) return res.status(400).json({ error: 'signerName is required' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

  try {
    await q(
      `INSERT INTO smart_merch_settings (
         artist_id, contract_accepted, contract_version, contract_accepted_at,
         contract_signer_name, contract_signer_email, contract_signer_ip, updated_at
       ) VALUES ($1, true, $2, NOW(), $3, $4, $5, NOW())
       ON CONFLICT (artist_id)
       DO UPDATE SET contract_accepted = true,
                     contract_version = EXCLUDED.contract_version,
                     contract_accepted_at = NOW(),
                     contract_signer_name = EXCLUDED.contract_signer_name,
                     contract_signer_email = EXCLUDED.contract_signer_email,
                     contract_signer_ip = EXCLUDED.contract_signer_ip,
                     updated_at = NOW()`,
      [artistId, CONTRACT_VERSION, signerName, signerEmail || null, ip]
    );

    return res.json({ accepted: true, version: CONTRACT_VERSION, signerName });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Buyer checkout (public)
router.post('/products/:productId(\\d+)/checkout', async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId, 10);
  const { buyerName, buyerEmail, quantity = 1 } = req.body || {};
  const qty = Math.max(1, Math.min(20, Math.round(toNum(quantity, 1))));

  if (!buyerName || !buyerEmail) {
    return res.status(400).json({ error: 'buyerName and buyerEmail are required' });
  }

  try {
    const productR = await q(
      `SELECT * FROM smart_merch_products
       WHERE id = $1 AND is_published = true AND status = 'presale_live'`,
      [productId]
    );
    const product = productR.rows[0];
    if (!product) return res.status(404).json({ error: 'Product not available in pre-sale' });

    const maxUnits = product.max_presale_units != null ? Number(product.max_presale_units) : null;
    if (maxUnits != null && Number(product.sold_units || 0) >= maxUnits) {
      return res.status(409).json({ error: 'Pre-sale cap reached' });
    }

    const unitPrice = toNum(product.presale_price);
    const subtotal = unitPrice * qty;
    const artistPct = toNum(product.artist_profit_pct, 30) / 100;
    const platformPct = toNum(product.platform_profit_pct, 70) / 100;

    const orderR = await q(
      `INSERT INTO smart_merch_orders (
         artist_id, product_id, buyer_name, buyer_email, quantity,
         unit_price, subtotal, artist_profit_amount, platform_profit_amount,
         payment_status, shipping_status
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,$9,
         'pending','pending_threshold'
       ) RETURNING *`,
      [
        Number(product.artist_id),
        productId,
        buyerName,
        buyerEmail,
        qty,
        unitPrice,
        subtotal,
        subtotal * artistPct,
        subtotal * platformPct,
      ]
    );
    const order = orderR.rows[0];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: buyerEmail,
      metadata: {
        type: 'smart_merch_order',
        orderId: String(order.id),
        productId: String(productId),
        artistId: String(product.artist_id),
        quantity: String(qty),
      },
      line_items: [
        {
          price_data: {
            currency: product.currency || 'usd',
            product_data: {
              name: `${product.title} (Pre-sale)`,
              description: `Ships when pre-sale reaches ${product.min_presale_units} units`,
              images: product.image_url ? [product.image_url] : [],
            },
            unit_amount: Math.round(unitPrice * 100),
          },
          quantity: qty,
        },
      ],
      success_url: `${BASE_URL}/product-success?smart_merch=1&product=${productId}`,
      cancel_url: `${BASE_URL}/product-cancelled?smart_merch=1&product=${productId}`,
    });

    await q(`UPDATE smart_merch_orders SET stripe_session_id = $1 WHERE id = $2`, [session.id, order.id]);

    return res.json({ checkoutUrl: session.url, orderId: order.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:artistId(\\d+)/orders', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { rows } = await q(
      `SELECT o.*, p.title AS product_title
       FROM smart_merch_orders o
       JOIN smart_merch_products p ON p.id = o.product_id
       WHERE o.artist_id = $1
       ORDER BY o.created_at DESC`,
      [artistId]
    );
    return res.json({ orders: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:artistId(\\d+)/analytics', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const [summaryR, productsR] = await Promise.all([
      q(
        `SELECT
           COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_orders,
           COALESCE(SUM(quantity) FILTER (WHERE payment_status = 'paid'), 0) AS units_sold,
           COALESCE(SUM(subtotal) FILTER (WHERE payment_status = 'paid'), 0) AS gross_revenue,
           COALESCE(SUM(artist_profit_amount) FILTER (WHERE payment_status = 'paid'), 0) AS artist_profit,
           COALESCE(SUM(platform_profit_amount) FILTER (WHERE payment_status = 'paid'), 0) AS platform_profit
         FROM smart_merch_orders WHERE artist_id = $1`,
        [artistId]
      ),
      q(
        `SELECT id, title, sold_units, min_presale_units, fulfillment_unlocked, status
         FROM smart_merch_products
         WHERE artist_id = $1 AND status <> 'archived'
         ORDER BY sold_units DESC, created_at DESC`,
        [artistId]
      ),
    ]);

    return res.json({ summary: summaryR.rows[0], products: productsR.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Buyer ↔ artist messaging — UNIFIED with the Concert/Ticket inbox ─────────
// Smart Merch reuses concert_threads / concert_messages so an artist sees ONE
// conversation list across ticket buyers and merch buyers (one ecosystem).
// Threads are keyed by (artistId, buyerEmail, concertId NULL for merch-only).

/** Find or create a merch thread (concertId NULL) for an (artist, buyer). */
async function getOrCreateMerchThread(
  artistId: number,
  buyerEmail: string,
  buyerName: string | null,
  eventId: number | null,
): Promise<number> {
  const existing = await q(
    `SELECT id FROM concert_threads
     WHERE artist_id = $1 AND lower(buyer_email) = lower($2)
       AND (${eventId ? 'concert_id = $3' : 'concert_id IS NULL'})
     ORDER BY id DESC LIMIT 1`,
    eventId ? [artistId, buyerEmail, eventId] : [artistId, buyerEmail]
  );
  if (existing.rows[0]) return Number(existing.rows[0].id);

  const created = await q(
    `INSERT INTO concert_threads (concert_id, artist_id, buyer_email, buyer_name, subject, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'open',NOW(),NOW()) RETURNING id`,
    [eventId, artistId, buyerEmail, buyerName, 'Smart Merch']
  );
  return Number(created.rows[0].id);
}

/** Append a message and refresh the thread preview + unread counters. */
async function appendThreadMessage(
  threadId: number,
  senderRole: 'buyer' | 'artist' | 'system',
  body: string,
): Promise<void> {
  await q(
    `INSERT INTO concert_messages (thread_id, sender_role, body, created_at)
     VALUES ($1,$2,$3,NOW())`,
    [threadId, senderRole, body]
  );
  const unreadCol = senderRole === 'artist' ? 'buyer_unread' : 'artist_unread';
  await q(
    `UPDATE concert_threads
     SET last_message_preview = $2, last_message_at = NOW(), updated_at = NOW(),
         ${unreadCol} = ${unreadCol} + 1
     WHERE id = $1`,
    [threadId, body.slice(0, 140)]
  );
}

// Buyer sends a message (email identity, no login required)
router.post('/:artistId(\\d+)/contact', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const buyerEmail = String(req.body?.buyerEmail || req.body?.email || '').trim();
  const buyerName = String(req.body?.buyerName || req.body?.name || '').trim() || null;
  const body = String(req.body?.message || req.body?.body || '').trim();
  const eventId = req.body?.eventId ? Math.round(toNum(req.body.eventId)) || null : null;

  if (!buyerEmail || !body) return res.status(400).json({ error: 'email and message are required' });

  try {
    const threadId = await getOrCreateMerchThread(artistId, buyerEmail, buyerName, eventId);
    await appendThreadMessage(threadId, 'buyer', body);
    return res.json({ success: true, threadId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Buyer fetches their own thread + messages by email
router.get('/:artistId(\\d+)/thread', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const email = String(req.query.email || '').trim();
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    const threadR = await q(
      `SELECT * FROM concert_threads
       WHERE artist_id = $1 AND lower(buyer_email) = lower($2)
       ORDER BY updated_at DESC LIMIT 1`,
      [artistId, email]
    );
    const thread = threadR.rows[0];
    if (!thread) return res.json({ thread: null, messages: [] });

    const msgs = await q(
      `SELECT id, sender_role, body, created_at FROM concert_messages WHERE thread_id = $1 ORDER BY id ASC`,
      [thread.id]
    );
    await q(`UPDATE concert_threads SET buyer_unread = 0 WHERE id = $1`, [thread.id]);
    return res.json({ thread, messages: msgs.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Owner unified inbox (ticket + merch threads)
router.get('/:artistId(\\d+)/messages', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { rows } = await q(
      `SELECT t.id, t.concert_id, t.buyer_email, t.buyer_name, t.subject,
              t.last_message_preview, t.last_message_at, t.artist_unread, t.status,
              CASE WHEN t.concert_id IS NULL THEN 'merch' ELSE 'event' END AS source,
              e.title AS event_title
       FROM concert_threads t
       LEFT JOIN concert_events e ON e.id = t.concert_id
       WHERE t.artist_id = $1
       ORDER BY COALESCE(t.last_message_at, t.updated_at) DESC
       LIMIT 100`,
      [artistId]
    );
    return res.json({ threads: rows });
  } catch (err: any) {
    return res.json({ threads: [] });
  }
});

// Owner opens a single thread (marks artist-unread as read)
router.get('/:artistId(\\d+)/messages/:threadId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const threadId = parseInt(req.params.threadId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const threadR = await q(`SELECT * FROM concert_threads WHERE id = $1 AND artist_id = $2`, [threadId, artistId]);
    const thread = threadR.rows[0];
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const msgs = await q(
      `SELECT id, sender_role, body, created_at FROM concert_messages WHERE thread_id = $1 ORDER BY id ASC`,
      [threadId]
    );
    await q(`UPDATE concert_threads SET artist_unread = 0 WHERE id = $1`, [threadId]);
    return res.json({ thread, messages: msgs.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Owner replies to a thread
router.post('/:artistId(\\d+)/messages/:threadId(\\d+)/reply', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const threadId = parseInt(req.params.threadId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  const body = String(req.body?.message || req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'message is required' });

  try {
    const owns = await q(`SELECT id FROM concert_threads WHERE id = $1 AND artist_id = $2`, [threadId, artistId]);
    if (!owns.rows[0]) return res.status(404).json({ error: 'Thread not found' });
    await appendThreadMessage(threadId, 'artist', body);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Artist payouts — transparent earnings → payout ledger ────────────────────
/** Available balance = paid artist profit − (already paid or in-flight payouts). */
async function getPayoutBalance(artistId: number): Promise<{
  lifetimeEarned: number;
  paidOut: number;
  pending: number;
  available: number;
  currency: string;
}> {
  const earnR = await q(
    `SELECT COALESCE(SUM(artist_profit_amount) FILTER (WHERE payment_status = 'paid'), 0) AS earned
     FROM smart_merch_orders WHERE artist_id = $1`,
    [artistId]
  );
  const payR = await q(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS paid,
       COALESCE(SUM(amount) FILTER (WHERE status IN ('requested','approved')), 0) AS pending
     FROM smart_merch_payouts WHERE artist_id = $1`,
    [artistId]
  );
  const lifetimeEarned = toNum(earnR.rows[0]?.earned);
  const paidOut = toNum(payR.rows[0]?.paid);
  const pending = toNum(payR.rows[0]?.pending);
  const available = Math.max(0, lifetimeEarned - paidOut - pending);
  return { lifetimeEarned, paidOut, pending, available, currency: 'usd' };
}

// Owner payout dashboard: balance + method + history
router.get('/:artistId(\\d+)/payouts', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const [balance, settings, history] = await Promise.all([
      getPayoutBalance(artistId),
      getSettingsRow(artistId),
      q(`SELECT * FROM smart_merch_payouts WHERE artist_id = $1 ORDER BY requested_at DESC LIMIT 50`, [artistId]),
    ]);
    return res.json({
      balance,
      method: {
        payoutMethod: settings?.payout_method || null,
        payoutAccount: settings?.payout_account || null,
      },
      payouts: history.rows,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Owner sets/updates payout method
router.put('/:artistId(\\d+)/payout-method', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  const method = String(req.body?.payoutMethod || '').trim().toLowerCase();
  const account = String(req.body?.payoutAccount || '').trim();
  const allowed = ['paypal', 'bank', 'stripe', 'wise'];
  if (method && !allowed.includes(method)) return res.status(400).json({ error: 'Unsupported payout method' });

  try {
    await q(
      `INSERT INTO smart_merch_settings (artist_id, payout_method, payout_account, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (artist_id)
       DO UPDATE SET payout_method = EXCLUDED.payout_method,
                     payout_account = EXCLUDED.payout_account,
                     updated_at = NOW()`,
      [artistId, method || null, account || null]
    );
    return res.json({ success: true, payoutMethod: method || null, payoutAccount: account || null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Owner requests a payout of the available balance (or a chosen amount)
router.post('/:artistId(\\d+)/payouts/request', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const [balance, settings] = await Promise.all([getPayoutBalance(artistId), getSettingsRow(artistId)]);
    if (!settings?.payout_method || !settings?.payout_account) {
      return res.status(412).json({ error: 'payout_method_required', message: 'Set a payout method before requesting a payout.' });
    }
    const requested = req.body?.amount != null ? toNum(req.body.amount) : balance.available;
    const amount = Math.min(balance.available, Math.max(0, requested));
    const MIN_PAYOUT = 20;
    if (amount < MIN_PAYOUT) {
      return res.status(400).json({ error: 'below_minimum', message: `Minimum payout is $${MIN_PAYOUT}. Available: $${balance.available.toFixed(2)}.` });
    }

    const inserted = await q(
      `INSERT INTO smart_merch_payouts (artist_id, amount, currency, method, account, status, requested_by)
       VALUES ($1,$2,$3,$4,$5,'requested',$6) RETURNING *`,
      [artistId, amount, balance.currency, settings.payout_method, settings.payout_account, userPgId(user) || null]
    );
    return res.json({ payout: inserted.rows[0], balance: await getPayoutBalance(artistId) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin: list pending payouts across artists
router.get('/admin/payouts', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!user.isAdmin) return res.status(403).json({ error: 'Admin only' });

  try {
    const { rows } = await q(
      `SELECT p.*, u.username AS artist_username
       FROM smart_merch_payouts p
       LEFT JOIN users u ON u.id = p.artist_id
       WHERE p.status IN ('requested','approved')
       ORDER BY p.requested_at ASC`,
      []
    );
    return res.json({ payouts: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin: mark a payout as paid (or rejected)
router.post('/admin/payouts/:payoutId(\\d+)/settle', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!user.isAdmin) return res.status(403).json({ error: 'Admin only' });

  const payoutId = parseInt(req.params.payoutId, 10);
  const status = req.body?.status === 'rejected' ? 'rejected' : 'paid';
  const reference = String(req.body?.reference || '').trim() || null;
  const notes = String(req.body?.notes || '').trim() || null;

  try {
    const updated = await q(
      `UPDATE smart_merch_payouts
       SET status = $2, reference = $3, notes = $4, processed_by = $5,
           processed_at = NOW(), paid_at = CASE WHEN $2 = 'paid' THEN NOW() ELSE paid_at END
       WHERE id = $1 RETURNING *`,
      [payoutId, status, reference, notes, userPgId(user) || null]
    );
    const payout = updated.rows[0];
    if (!payout) return res.status(404).json({ error: 'Payout not found' });

    if (status === 'paid') {
      await q(
        `UPDATE smart_merch_settings SET total_paid_out = total_paid_out + $2, updated_at = NOW()
         WHERE artist_id = $1`,
        [payout.artist_id, toNum(payout.amount)]
      );
    }
    return res.json({ payout });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin: configurable artist share (default 30)
router.get('/admin/artist/:artistId(\\d+)/commission', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!user.isAdmin) return res.status(403).json({ error: 'Admin only' });

  const artistId = parseInt(req.params.artistId, 10);
  try {
    const cfg = await q(`SELECT artist_profit_pct FROM smart_merch_admin_config WHERE artist_id = $1`, [artistId]);
    return res.json({ artistId, artistProfitPct: toNum(cfg.rows[0]?.artist_profit_pct, 30) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/admin/artist/:artistId(\\d+)/commission', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!user.isAdmin) return res.status(403).json({ error: 'Admin only' });

  const artistId = parseInt(req.params.artistId, 10);
  const artistProfitPct = Math.min(90, Math.max(0, toNum(req.body?.artistProfitPct, 30)));

  try {
    await q(
      `INSERT INTO smart_merch_admin_config (artist_id, artist_profit_pct, updated_by_user_id, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (artist_id)
       DO UPDATE SET artist_profit_pct = EXCLUDED.artist_profit_pct,
                     updated_by_user_id = EXCLUDED.updated_by_user_id,
                     updated_at = NOW()`,
      [artistId, artistProfitPct, userPgId(user) || null]
    );

    // Keep product split synchronized for active/draft products
    await q(
      `UPDATE smart_merch_products
       SET artist_profit_pct = $1,
           platform_profit_pct = (100 - $1),
           updated_at = NOW()
       WHERE artist_id = $2 AND status IN ('draft','presale_live','presale_closed','fulfillment_ready')`,
      [artistProfitPct, artistId]
    );

    return res.json({ artistId, artistProfitPct, platformProfitPct: 100 - artistProfitPct });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Activation verification (public read)
router.get('/activate/:artistId(\\d+)/:productId(\\d+)/:serialId', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const productId = parseInt(req.params.productId, 10);
  const serialId = String(req.params.serialId || '').trim();

  try {
    const serialR = await q(
      `SELECT s.*, p.title AS product_title, p.unlock_type, p.unlock_payload
       FROM smart_merch_serials s
       JOIN smart_merch_products p ON p.id = s.product_id
       WHERE s.artist_id = $1 AND s.product_id = $2 AND s.serial_code = $3
       LIMIT 1`,
      [artistId, productId, serialId]
    );

    const serial = serialR.rows[0];
    if (!serial) return res.status(404).json({ error: 'Activation serial not found' });

    return res.json({
      serial: {
        serialCode: serial.serial_code,
        isActivated: !!serial.is_activated,
        activatedAt: serial.activated_at,
      },
      unlock: {
        productTitle: serial.product_title,
        unlockType: serial.unlock_type,
        payload: serial.unlock_payload || {},
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Activation consume (public write)
router.post('/activate/:artistId(\\d+)/:productId(\\d+)/:serialId', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const productId = parseInt(req.params.productId, 10);
  const serialId = String(req.params.serialId || '').trim();
  const { fanName, fanEmail } = req.body || {};

  try {
    const updated = await q(
      `UPDATE smart_merch_serials
       SET is_activated = true,
           activated_at = COALESCE(activated_at, NOW()),
           activated_by_name = COALESCE(activated_by_name, $4),
           activated_by_email = COALESCE(activated_by_email, $5),
           updated_at = NOW()
       WHERE artist_id = $1 AND product_id = $2 AND serial_code = $3
       RETURNING *`,
      [artistId, productId, serialId, fanName || null, fanEmail || null]
    );

    const serial = updated.rows[0];
    if (!serial) return res.status(404).json({ error: 'Activation serial not found' });

    return res.json({ activated: true, serialCode: serial.serial_code, activatedAt: serial.activated_at });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Stripe webhook (raw body route mounted in server/index.ts)
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_SMART_MERCH_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret!);
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      if (meta.type !== 'smart_merch_order') return res.json({ received: true });

      const orderId = parseInt(String(meta.orderId || '0'), 10);
      const productId = parseInt(String(meta.productId || '0'), 10);
      const qty = parseInt(String(meta.quantity || '1'), 10) || 1;
      if (!orderId || !productId) return res.json({ received: true });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const orderR = await client.query(
          `UPDATE smart_merch_orders
           SET payment_status = 'paid', paid_at = NOW()
           WHERE id = $1 AND stripe_session_id = $2 AND payment_status = 'pending'
           RETURNING *`,
          [orderId, session.id]
        );
        const order = orderR.rows[0];
        if (!order) {
          await client.query('COMMIT');
          return res.json({ received: true });
        }

        const productR = await client.query(
          `UPDATE smart_merch_products
           SET sold_units = sold_units + $2,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [productId, qty]
        );
        const product = productR.rows[0];

        const nextSoldUnits = toNum(product?.sold_units);
        const minUnits = toNum(product?.min_presale_units, 1);
        const reached = nextSoldUnits >= minUnits;

        if (reached) {
          await client.query(
            `UPDATE smart_merch_products
             SET fulfillment_unlocked = true,
                 fulfillment_unlocked_at = COALESCE(fulfillment_unlocked_at, NOW()),
                 status = CASE WHEN status = 'presale_live' THEN 'fulfillment_ready' ELSE status END,
                 updated_at = NOW()
             WHERE id = $1`,
            [productId]
          );

          await client.query(
            `UPDATE smart_merch_orders
             SET shipping_status = 'ready_to_ship'
             WHERE product_id = $1 AND payment_status = 'paid' AND shipping_status = 'pending_threshold'`,
            [productId]
          );
        }

        const serialStart = toNum(product?.sold_units) - qty + 1;
        for (let i = 0; i < qty; i++) {
          const serialNumber = serialStart + i;
          const serialCode = buildSerialCode(toNum(order.artist_id), productId, serialNumber);
          const activationUrl = `${BASE_URL}/activate/${order.artist_id}/${productId}/${serialCode}`;
          const qrPayload = activationUrl;

          await client.query(
            `INSERT INTO smart_merch_serials (
               order_id, product_id, artist_id, serial_number, serial_code, qr_payload, activation_url
             ) VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (serial_code) DO NOTHING`,
            [orderId, productId, toNum(order.artist_id), serialNumber, serialCode, qrPayload, activationUrl]
          );
        }

        await client.query('COMMIT');

        // Tie the merch buyer into the unified ticket/merch inbox with a system receipt.
        if (order?.buyer_email) {
          try {
            const linkedEventId = product?.linked_event_id ? Number(product.linked_event_id) : null;
            const threadId = await getOrCreateMerchThread(
              toNum(order.artist_id),
              String(order.buyer_email),
              order.buyer_name ? String(order.buyer_name) : null,
              linkedEventId
            );
            const title = product?.title || 'your Smart Merch item';
            await appendThreadMessage(
              threadId,
              'system',
              `✅ Order confirmed: ${qty}× "${title}". You'll get updates here as your order moves to fulfillment and ships.`
            );
          } catch (msgErr) {
            console.error('[smart-merch] failed to post order system message', msgErr);
          }
        }

        // Route the paid order directly to its assigned supplier (fire-and-forget).
        routeOrderToSupplier(orderId)
          .then((r) => {
            if (r.routed) console.log(`[smart-merch] order ${orderId} routed to supplier`);
            else console.log(`[smart-merch] order ${orderId} not routed: ${r.reason}`);
          })
          .catch((e) => console.error('[smart-merch] order routing error', e));
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      await q(
        `UPDATE smart_merch_orders
         SET payment_status = 'expired', shipping_status = 'cancelled'
         WHERE stripe_session_id = $1 AND payment_status = 'pending'`,
        [session.id]
      );
    }

    return res.json({ received: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN-ONLY — Supplier network: directory, order routing & messaging
// Only platform admins (user.isAdmin) can see or operate any of this.
// ════════════════════════════════════════════════════════════════════════════

function isPlatformAdmin(user: any): boolean {
  return !!user && !!user.isAdmin;
}

/**
 * Curated seed of real, recommended fulfillment & manufacturing providers
 * (with links) the admin can one-click import into the directory.
 */
const GLOBAL_SUPPLIER_SEED = [
  { name: 'Printful', providerKey: 'printful', category: 'print-on-demand', website: 'https://www.printful.com', orderEmail: '', regions: ['US', 'EU', 'Global'], productCategories: ['wearable', 'poster', 'accessory'], apiReady: true, notes: 'Automated POD: apparel, hoodies, hats, posters, mugs & accessories. Strong API + warehousing.' },
  { name: 'Printify', providerKey: 'printify', category: 'print-on-demand', website: 'https://printify.com', orderEmail: '', regions: ['US', 'EU', 'Global'], productCategories: ['wearable', 'accessory', 'poster'], apiReady: true, notes: 'Large POD network with competitive pricing and a robust fulfillment API.' },
  { name: 'Gelato', providerKey: 'gelato', category: 'print-on-demand', website: 'https://www.gelato.com', orderEmail: '', regions: ['Global'], productCategories: ['wearable', 'poster', 'accessory'], apiReady: true, notes: 'Local production in 32+ countries — fast, low-carbon global shipping.' },
  { name: 'Gooten', providerKey: 'gooten', category: 'print-on-demand', website: 'https://www.gooten.com', orderEmail: '', regions: ['US', 'Global'], productCategories: ['wearable', 'poster', 'accessory'], apiReady: true, notes: 'Wide POD catalog with fulfillment API and global routing.' },
  { name: 'ShineOn', providerKey: 'shineon', category: 'jewelry', website: 'https://www.shineon.com', orderEmail: '', regions: ['US', 'Global'], productCategories: ['accessory', 'collectible'], apiReady: false, notes: 'Custom on-demand jewelry, necklaces & premium accessories.' },
  { name: 'Sticker Mule', providerKey: 'stickermule', category: 'stickers-packaging', website: 'https://www.stickermule.com', orderEmail: '', regions: ['US', 'EU', 'Global'], productCategories: ['collectible', 'accessory'], apiReady: false, notes: 'Custom stickers, packaging, magnets & promo items.' },
  { name: 'Qrates', providerKey: 'qrates', category: 'vinyl', website: 'https://qrates.com', orderEmail: '', regions: ['Global'], productCategories: ['vinyl', 'collectible'], apiReady: false, notes: 'Vinyl pressing on demand & crowdfunded vinyl campaigns.' },
  { name: 'Seritag (NFC)', providerKey: 'seritag', category: 'nfc', website: 'https://seritag.com', orderEmail: '', regions: ['UK', 'EU', 'Global'], productCategories: ['collectible', 'accessory', 'wearable'], apiReady: false, notes: 'NFC tags, chips & encoding for smart-merch activations.' },
  { name: 'Alibaba (bulk sourcing)', providerKey: 'alibaba', category: 'manufacturing', website: 'https://www.alibaba.com', orderEmail: '', regions: ['Global'], productCategories: ['collectible', 'accessory', 'other', 'wearable'], apiReady: false, notes: 'Bulk manufacturing & custom sourcing for larger runs.' },
];

/** Resolve which global supplier should fulfill an order's product. */
async function getSupplierForOrder(productId: number): Promise<any | null> {
  const assigned = await q(
    `SELECT s.* FROM smart_merch_products p
     JOIN smart_merch_global_suppliers s ON s.id = p.assigned_supplier_id
     WHERE p.id = $1 AND s.is_active = true`,
    [productId]
  );
  if (assigned.rows[0]?.id) return assigned.rows[0];

  const prod = await q(`SELECT fulfillment_provider FROM smart_merch_products WHERE id = $1`, [productId]);
  const key = prod.rows[0]?.fulfillment_provider;
  if (!key) return null;
  const byKey = await q(
    `SELECT * FROM smart_merch_global_suppliers WHERE provider_key = $1 AND is_active = true ORDER BY id ASC LIMIT 1`,
    [key]
  );
  return byKey.rows[0] || null;
}

/** Create (or reuse the open) admin↔supplier thread. */
async function getOrCreateSupplierThread(
  supplierId: number,
  subject: string | null,
  relatedOrderId: number | null,
): Promise<number> {
  if (!relatedOrderId) {
    const open = await q(
      `SELECT id FROM smart_merch_supplier_threads
       WHERE supplier_id = $1 AND status = 'open' AND related_order_id IS NULL
       ORDER BY id DESC LIMIT 1`,
      [supplierId]
    );
    if (open.rows[0]) return Number(open.rows[0].id);
  }
  const created = await q(
    `INSERT INTO smart_merch_supplier_threads (supplier_id, subject, related_order_id, status, created_at, updated_at)
     VALUES ($1,$2,$3,'open',NOW(),NOW()) RETURNING id`,
    [supplierId, subject || 'Supplier conversation', relatedOrderId]
  );
  return Number(created.rows[0].id);
}

/** Append a supplier message + refresh thread preview/unread counters. */
async function appendSupplierMessage(
  threadId: number,
  senderRole: 'admin' | 'supplier' | 'system',
  body: string,
  emailProvider?: string | null,
  emailMessageId?: string | null,
): Promise<void> {
  await q(
    `INSERT INTO smart_merch_supplier_messages (thread_id, sender_role, body, email_provider, email_message_id, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    [threadId, senderRole, body, emailProvider || null, emailMessageId || null]
  );
  const unreadCol = senderRole === 'supplier' ? 'admin_unread' : 'supplier_unread';
  await q(
    `UPDATE smart_merch_supplier_threads
     SET last_message_preview = $2, last_message_at = NOW(), updated_at = NOW(),
         ${unreadCol} = ${unreadCol} + 1
     WHERE id = $1`,
    [threadId, body.slice(0, 140)]
  );
}

/**
 * Dispatch a paid order directly to its assigned supplier by email and record
 * the route. Safe to call fire-and-forget — never throws.
 */
async function routeOrderToSupplier(orderId: number): Promise<{ routed: boolean; reason?: string }> {
  try {
    const orderR = await q(`SELECT * FROM smart_merch_orders WHERE id = $1`, [orderId]);
    const order = orderR.rows[0];
    if (!order) return { routed: false, reason: 'order not found' };

    // Don't double-send.
    const existing = await q(
      `SELECT id FROM smart_merch_order_routes WHERE order_id = $1 AND status IN ('sent','acknowledged','shipped') LIMIT 1`,
      [orderId]
    );
    if (existing.rows[0]) return { routed: false, reason: 'already routed' };

    const productR = await q(`SELECT * FROM smart_merch_products WHERE id = $1`, [order.product_id]);
    const product = productR.rows[0];
    const supplier = await getSupplierForOrder(Number(order.product_id));
    if (!supplier) return { routed: false, reason: 'no supplier assigned' };

    const supplierEmail = String(supplier.order_email || supplier.contact_email || '').trim();
    if (!supplierEmail) return { routed: false, reason: 'supplier has no email' };

    const { subject, html } = buildSupplierOrderEmail({
      supplierName: supplier.name,
      orderId,
      productTitle: product?.title || 'Smart Merch product',
      productSku: product?.supplier_sku || null,
      quantity: toNum(order.quantity, 1),
      unitPrice: toNum(order.unit_price),
      currency: product?.currency || 'usd',
      buyerName: order.buyer_name || null,
      artistName: null,
      managementNote: 'This order was routed automatically by the Boostify Smart Merch Engine.',
    });

    const sent = await sendSupplierEmail(supplierEmail, subject, html);

    await q(
      `INSERT INTO smart_merch_order_routes (order_id, product_id, supplier_id, status, email_provider, email_message_id, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        orderId,
        Number(order.product_id),
        Number(supplier.id),
        sent.success ? 'sent' : 'failed',
        sent.provider || null,
        sent.messageId || null,
        sent.success ? null : sent.error || 'send failed',
      ]
    );

    if (sent.success) {
      const threadId = await getOrCreateSupplierThread(Number(supplier.id), `Order SM-${orderId}`, orderId);
      await appendSupplierMessage(
        threadId,
        'system',
        `📦 Order SM-${orderId} dispatched: ${toNum(order.quantity, 1)}× "${product?.title || 'product'}".`,
        sent.provider,
        sent.messageId
      );
      return { routed: true };
    }
    return { routed: false, reason: sent.error };
  } catch (err: any) {
    console.error('[smart-merch] routeOrderToSupplier failed', err);
    return { routed: false, reason: err.message };
  }
}

// ── Admin: curated catalog (recommended providers with links) ────────────────
router.get('/admin/suppliers/catalog', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  return res.json({ catalog: GLOBAL_SUPPLIER_SEED });
});

// ── Admin: list directory ────────────────────────────────────────────────────
router.get('/admin/suppliers', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows } = await q(
      `SELECT s.*,
              (SELECT COUNT(*) FROM smart_merch_products p WHERE p.assigned_supplier_id = s.id) AS assigned_products,
              (SELECT COUNT(*) FROM smart_merch_order_routes r WHERE r.supplier_id = s.id) AS routed_orders,
              (SELECT COALESCE(SUM(admin_unread),0) FROM smart_merch_supplier_threads t WHERE t.supplier_id = s.id) AS unread
       FROM smart_merch_global_suppliers s
       ORDER BY s.is_active DESC, s.name ASC`
    );
    return res.json({ suppliers: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: seed directory from curated catalog ───────────────────────────────
router.post('/admin/suppliers/seed', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  try {
    let inserted = 0;
    for (const s of GLOBAL_SUPPLIER_SEED) {
      const exists = await q(`SELECT id FROM smart_merch_global_suppliers WHERE provider_key = $1 LIMIT 1`, [s.providerKey]);
      if (exists.rows[0]) continue;
      await q(
        `INSERT INTO smart_merch_global_suppliers
           (name, provider_key, category, website, order_email, regions, product_categories, api_ready, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          s.name, s.providerKey, s.category, s.website, s.orderEmail || null,
          JSON.stringify(s.regions), JSON.stringify(s.productCategories), s.apiReady, s.notes,
          userPgId(user) || null,
        ]
      );
      inserted++;
    }
    const { rows } = await q(`SELECT * FROM smart_merch_global_suppliers ORDER BY is_active DESC, name ASC`);
    return res.json({ inserted, suppliers: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: create supplier ───────────────────────────────────────────────────
router.post('/admin/suppliers', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });

  const {
    name, providerKey, category, website, orderEmail, contactName, contactPhone,
    regions = [], productCategories = [], apiReady = false, notes,
  } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const inserted = await q(
      `INSERT INTO smart_merch_global_suppliers
         (name, provider_key, category, website, order_email, contact_name, contact_phone,
          regions, product_categories, api_ready, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        String(name).trim(), providerKey || null, category || null, website || null,
        orderEmail || null, contactName || null, contactPhone || null,
        JSON.stringify(Array.isArray(regions) ? regions : []),
        JSON.stringify(Array.isArray(productCategories) ? productCategories : []),
        !!apiReady, notes || null, userPgId(user) || null,
      ]
    );
    return res.json({ supplier: inserted.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: update supplier ───────────────────────────────────────────────────
const SUPPLIER_UPDATABLE: Record<string, string> = {
  name: 'name', providerKey: 'provider_key', category: 'category', website: 'website',
  orderEmail: 'order_email', contactName: 'contact_name', contactPhone: 'contact_phone',
  notes: 'notes', isActive: 'is_active', apiReady: 'api_ready', apiConnected: 'api_connected',
};
router.put('/admin/suppliers/:supplierId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });

  const supplierId = parseInt(req.params.supplierId, 10);
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(SUPPLIER_UPDATABLE)) {
    if (req.body[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      vals.push(req.body[key]);
    }
  }
  if (req.body.regions !== undefined) {
    sets.push(`regions = $${i++}`);
    vals.push(JSON.stringify(Array.isArray(req.body.regions) ? req.body.regions : []));
  }
  if (req.body.productCategories !== undefined) {
    sets.push(`product_categories = $${i++}`);
    vals.push(JSON.stringify(Array.isArray(req.body.productCategories) ? req.body.productCategories : []));
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  try {
    vals.push(supplierId);
    const updated = await q(
      `UPDATE smart_merch_global_suppliers SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!updated.rows[0]) return res.status(404).json({ error: 'Supplier not found' });
    return res.json({ supplier: updated.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: deactivate supplier ───────────────────────────────────────────────
router.delete('/admin/suppliers/:supplierId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  const supplierId = parseInt(req.params.supplierId, 10);
  try {
    await q(`UPDATE smart_merch_global_suppliers SET is_active = false, updated_at = NOW() WHERE id = $1`, [supplierId]);
    return res.json({ removed: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: list all products (to assign suppliers) ───────────────────────────
router.get('/admin/products', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows } = await q(
      `SELECT p.id, p.artist_id, p.title, p.category, p.status, p.image_url,
              p.fulfillment_provider, p.assigned_supplier_id,
              s.name AS supplier_name,
              u.username AS artist_username
       FROM smart_merch_products p
       LEFT JOIN smart_merch_global_suppliers s ON s.id = p.assigned_supplier_id
       LEFT JOIN users u ON u.id = p.artist_id
       WHERE p.status <> 'archived'
       ORDER BY p.created_at DESC
       LIMIT 300`
    );
    return res.json({ products: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: assign a supplier to a product ────────────────────────────────────
router.put('/admin/products/:productId(\\d+)/supplier', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  const productId = parseInt(req.params.productId, 10);
  const supplierId = req.body?.supplierId ? parseInt(String(req.body.supplierId), 10) : null;
  try {
    const updated = await q(
      `UPDATE smart_merch_products SET assigned_supplier_id = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, assigned_supplier_id`,
      [supplierId, productId]
    );
    if (!updated.rows[0]) return res.status(404).json({ error: 'Product not found' });
    return res.json({ productId, supplierId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: list orders + routing status ──────────────────────────────────────
router.get('/admin/orders', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows } = await q(
      `SELECT o.id, o.product_id, o.buyer_name, o.buyer_email, o.quantity, o.unit_price,
              o.subtotal, o.payment_status, o.shipping_status, o.paid_at, o.created_at,
              p.title AS product_title, p.assigned_supplier_id,
              s.name AS supplier_name, s.order_email AS supplier_email,
              r.status AS route_status, r.email_provider AS route_provider, r.sent_at AS route_sent_at
       FROM smart_merch_orders o
       LEFT JOIN smart_merch_products p ON p.id = o.product_id
       LEFT JOIN smart_merch_global_suppliers s ON s.id = p.assigned_supplier_id
       LEFT JOIN LATERAL (
         SELECT status, email_provider, sent_at FROM smart_merch_order_routes
         WHERE order_id = o.id ORDER BY id DESC LIMIT 1
       ) r ON true
       ORDER BY o.created_at DESC
       LIMIT 200`
    );
    return res.json({ orders: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: (re)route an order to its supplier ────────────────────────────────
router.post('/admin/orders/:orderId(\\d+)/route', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  const orderId = parseInt(req.params.orderId, 10);
  try {
    if (req.body?.force) {
      // Allow a manual resend by clearing prior successful routes.
      await q(`UPDATE smart_merch_order_routes SET status = 'failed', updated_at = NOW() WHERE order_id = $1`, [orderId]);
    }
    const result = await routeOrderToSupplier(orderId);
    if (!result.routed) return res.status(400).json({ error: result.reason || 'Could not route order' });
    return res.json({ routed: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: supplier message threads ──────────────────────────────────────────
router.get('/admin/supplier-threads', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows } = await q(
      `SELECT t.*, s.name AS supplier_name, s.order_email AS supplier_email
       FROM smart_merch_supplier_threads t
       JOIN smart_merch_global_suppliers s ON s.id = t.supplier_id
       ORDER BY COALESCE(t.last_message_at, t.updated_at) DESC
       LIMIT 100`
    );
    return res.json({ threads: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: open a single thread ──────────────────────────────────────────────
router.get('/admin/supplier-threads/:threadId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });
  const threadId = parseInt(req.params.threadId, 10);
  try {
    const threadR = await q(
      `SELECT t.*, s.name AS supplier_name, s.order_email AS supplier_email
       FROM smart_merch_supplier_threads t
       JOIN smart_merch_global_suppliers s ON s.id = t.supplier_id
       WHERE t.id = $1`,
      [threadId]
    );
    const thread = threadR.rows[0];
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const msgs = await q(
      `SELECT id, sender_role, body, email_provider, created_at
       FROM smart_merch_supplier_messages WHERE thread_id = $1 ORDER BY id ASC`,
      [threadId]
    );
    await q(`UPDATE smart_merch_supplier_threads SET admin_unread = 0 WHERE id = $1`, [threadId]);
    return res.json({ thread, messages: msgs.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: start/send a message to a supplier (Resend) ───────────────────────
router.post('/admin/suppliers/:supplierId(\\d+)/message', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });

  const supplierId = parseInt(req.params.supplierId, 10);
  const subject = String(req.body?.subject || '').trim() || 'Message from Boostify Smart Merch';
  const body = String(req.body?.message || req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'message is required' });

  try {
    const supR = await q(`SELECT * FROM smart_merch_global_suppliers WHERE id = $1`, [supplierId]);
    const supplier = supR.rows[0];
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const toEmail = String(supplier.order_email || supplier.contact_email || '').trim();
    const threadId = await getOrCreateSupplierThread(supplierId, subject, null);

    let emailResult: { success: boolean; provider?: string; messageId?: string; error?: string } = { success: false, error: 'no email on file' };
    if (toEmail) {
      const { subject: emSubject, html } = buildSupplierMessageEmail(supplier.name, subject, body);
      emailResult = await sendSupplierEmail(toEmail, emSubject, html);
    }
    await appendSupplierMessage(threadId, 'admin', body, emailResult.provider, emailResult.messageId);

    return res.json({ success: true, threadId, emailDelivered: emailResult.success, emailError: emailResult.success ? undefined : emailResult.error });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: reply within an existing thread ───────────────────────────────────
router.post('/admin/supplier-threads/:threadId(\\d+)/reply', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user)) return res.status(403).json({ error: 'Admin only' });

  const threadId = parseInt(req.params.threadId, 10);
  const body = String(req.body?.message || req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'message is required' });

  try {
    const tR = await q(
      `SELECT t.*, s.name AS supplier_name, s.order_email AS supplier_email, s.contact_email
       FROM smart_merch_supplier_threads t
       JOIN smart_merch_global_suppliers s ON s.id = t.supplier_id
       WHERE t.id = $1`,
      [threadId]
    );
    const thread = tR.rows[0];
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const toEmail = String(thread.supplier_email || thread.contact_email || '').trim();
    let emailResult: { success: boolean; provider?: string; messageId?: string; error?: string } = { success: false, error: 'no email on file' };
    if (toEmail) {
      const { subject, html } = buildSupplierMessageEmail(thread.supplier_name, thread.subject || 'Re: Boostify Smart Merch', body);
      emailResult = await sendSupplierEmail(toEmail, subject, html);
    }
    await appendSupplierMessage(threadId, 'admin', body, emailResult.provider, emailResult.messageId);
    return res.json({ success: true, emailDelivered: emailResult.success, emailError: emailResult.success ? undefined : emailResult.error });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FAN CRM & SMART CAMPAIGNS (artist owner)
//
// Connects Smart Merch to the concert ticketing module: the artist markets a
// product to the fans who bought tickets to their shows (or to past merch
// buyers), with AI-drafted copy and delivery through Resend.
// ═══════════════════════════════════════════════════════════════════════════

interface FanRecipient {
  email: string;
  name: string | null;
  source: 'ticket' | 'merch';
  concertId: number | null;
}

/** Loads the artist's public name + slug (for the from-name and store CTA). */
async function getArtistMeta(artistId: number): Promise<{ name: string; slug: string | null }> {
  try {
    const r = await q(`SELECT artist_name, username, slug FROM users WHERE id = $1`, [artistId]);
    const row = r.rows[0] || {};
    return { name: row.artist_name || row.username || 'Artist', slug: row.slug || row.username || null };
  } catch {
    return { name: 'Artist', slug: null };
  }
}

/**
 * Resolves the de-duplicated list of fan recipients for a campaign audience.
 *  - all_ticket_buyers → everyone who completed a ticket order for the artist
 *  - specific_event    → ticket buyers of one concert (requires concertId)
 *  - merch_buyers      → fans who paid for a Smart Merch product
 *  - all_fans          → union of ticket + merch buyers
 */
async function resolveCampaignAudience(
  artistId: number,
  audience: string,
  concertId: number | null
): Promise<FanRecipient[]> {
  const byEmail = new Map<string, FanRecipient>();

  const addTicketBuyers = async (cid: number | null) => {
    try {
      const params: unknown[] = [artistId];
      let where = `artist_id = $1 AND status = 'completed' AND buyer_email IS NOT NULL AND buyer_email <> ''`;
      if (cid != null) { params.push(cid); where += ` AND concert_id = $2`; }
      const { rows } = await q(
        `SELECT buyer_email, buyer_name, concert_id, created_at
           FROM concert_orders
          WHERE ${where}
          ORDER BY created_at DESC`,
        params
      );
      for (const r of rows) {
        const key = String(r.buyer_email).trim().toLowerCase();
        if (!key || byEmail.has(key)) continue;
        byEmail.set(key, { email: String(r.buyer_email).trim(), name: r.buyer_name || null, source: 'ticket', concertId: r.concert_id ?? null });
      }
    } catch {
      // concert_orders may be unavailable — degrade to empty
    }
  };

  const addMerchBuyers = async () => {
    try {
      const { rows } = await q(
        `SELECT buyer_email, buyer_name, created_at
           FROM smart_merch_orders
          WHERE artist_id = $1 AND payment_status = 'paid' AND buyer_email IS NOT NULL AND buyer_email <> ''
          ORDER BY created_at DESC`,
        [artistId]
      );
      for (const r of rows) {
        const key = String(r.buyer_email).trim().toLowerCase();
        if (!key || byEmail.has(key)) continue;
        byEmail.set(key, { email: String(r.buyer_email).trim(), name: r.buyer_name || null, source: 'merch', concertId: null });
      }
    } catch {
      // ignore
    }
  };

  if (audience === 'merch_buyers') {
    await addMerchBuyers();
  } else if (audience === 'specific_event') {
    await addTicketBuyers(concertId);
  } else if (audience === 'all_fans') {
    await addTicketBuyers(null);
    await addMerchBuyers();
  } else {
    // default: all_ticket_buyers
    await addTicketBuyers(null);
  }

  return Array.from(byEmail.values());
}

// ── CRM audience overview (segment sizes) ────────────────────────────────────
router.get('/:artistId(\\d+)/crm/audience', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const [ticketTotalR, merchTotalR, byEventR] = await Promise.all([
      q(`SELECT COUNT(DISTINCT LOWER(buyer_email)) AS c
           FROM concert_orders
          WHERE artist_id = $1 AND status = 'completed' AND buyer_email IS NOT NULL AND buyer_email <> ''`, [artistId])
        .catch(() => ({ rows: [{ c: 0 }] })),
      q(`SELECT COUNT(DISTINCT LOWER(buyer_email)) AS c
           FROM smart_merch_orders
          WHERE artist_id = $1 AND payment_status = 'paid' AND buyer_email IS NOT NULL AND buyer_email <> ''`, [artistId])
        .catch(() => ({ rows: [{ c: 0 }] })),
      q(`SELECT o.concert_id, e.title,
                COUNT(DISTINCT LOWER(o.buyer_email)) AS fans
           FROM concert_orders o
           LEFT JOIN concert_events e ON e.id = o.concert_id
          WHERE o.artist_id = $1 AND o.status = 'completed' AND o.buyer_email IS NOT NULL AND o.buyer_email <> ''
          GROUP BY o.concert_id, e.title
          ORDER BY fans DESC`, [artistId])
        .catch(() => ({ rows: [] })),
    ]);

    return res.json({
      ticketBuyers: Number(ticketTotalR.rows[0]?.c || 0),
      merchBuyers: Number(merchTotalR.rows[0]?.c || 0),
      byEvent: byEventR.rows.map((r: any) => ({
        concertId: r.concert_id,
        title: r.title || 'Show',
        fans: Number(r.fans || 0),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── List campaigns ───────────────────────────────────────────────────────────
router.get('/:artistId(\\d+)/crm/campaigns', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { rows } = await q(
      `SELECT c.*, p.title AS product_title, p.image_url AS product_image, e.title AS event_title
         FROM smart_merch_campaigns c
         LEFT JOIN smart_merch_products p ON p.id = c.product_id
         LEFT JOIN concert_events e ON e.id = c.concert_id
        WHERE c.artist_id = $1
        ORDER BY c.created_at DESC
        LIMIT 100`,
      [artistId]
    );
    return res.json({ campaigns: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Campaign detail + recipients ─────────────────────────────────────────────
router.get('/:artistId(\\d+)/crm/campaigns/:campaignId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const campaignId = parseInt(req.params.campaignId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const cR = await q(`SELECT * FROM smart_merch_campaigns WHERE id = $1 AND artist_id = $2`, [campaignId, artistId]);
    const campaign = cR.rows[0];
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const rR = await q(
      `SELECT id, email, name, source, status, email_provider, error, created_at
         FROM smart_merch_campaign_recipients WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 500`,
      [campaignId]
    );
    return res.json({ campaign, recipients: rR.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── AI draft campaign copy ───────────────────────────────────────────────────
router.post('/:artistId(\\d+)/crm/ai-draft', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  const productId = req.body?.productId ? Number(req.body.productId) : null;
  const concertId = req.body?.concertId ? Number(req.body.concertId) : null;
  const audience = String(req.body?.audience || 'all_ticket_buyers');
  const tone = String(req.body?.tone || 'energetic, personal, exclusive').slice(0, 120);

  try {
    const meta = await getArtistMeta(artistId);
    let product: any = null;
    if (productId) {
      const pR = await q(`SELECT title, description, presale_price, currency FROM smart_merch_products WHERE id = $1 AND artist_id = $2`, [productId, artistId]);
      product = pR.rows[0] || null;
    }
    let eventTitle: string | null = null;
    if (concertId) {
      const eR = await q(`SELECT title FROM concert_events WHERE id = $1`, [concertId]).catch(() => ({ rows: [] }));
      eventTitle = eR.rows[0]?.title || null;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Graceful template fallback when OpenAI is unavailable
      const headline = product ? `Get the ${product.title} before it's gone` : `Exclusive drop for ${meta.name} fans`;
      const message = `Thanks for being part of the ${meta.name} family${eventTitle ? ` at ${eventTitle}` : ''}!\n\nWe just opened a limited pre-order${product ? ` for the ${product.title}` : ''}. As one of our fans you get first access — grab yours before we hit the production cap.\n\nSee you soon.`;
      return res.json({ subject: headline, message, source: 'template' });
    }

    const openai = new OpenAI({ apiKey });
    const prompt = `You are a music-merch marketing copywriter for the artist "${meta.name}".
Write a short promotional EMAIL to fans who ${audience === 'merch_buyers' ? 'previously bought merch' : eventTitle ? `attended the show "${eventTitle}"` : 'bought concert tickets'}.
Goal: drive pre-orders of this Smart Merch product.
Tone: ${tone}.
${product ? `Product: "${product.title}". Description: ${product.description || 'interactive smart merch with NFC/QR unlock'}. Price: ${product.currency || 'usd'} ${product.presale_price}.` : 'Promote the artist store generally.'}
Return STRICT JSON: {"subject": string (max 60 chars, no emojis in subject), "message": string (2-4 short paragraphs, plain text, no markdown, may use line breaks)}.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 500,
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const subject = String(parsed.subject || (product ? `Get the ${product.title}` : `Exclusive ${meta.name} drop`)).slice(0, 120);
    const message = String(parsed.message || '').slice(0, 2000) || `Thanks for supporting ${meta.name}! Check out our latest drop.`;
    return res.json({ subject, message, source: 'openai' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Create a campaign (draft) ────────────────────────────────────────────────
router.post('/:artistId(\\d+)/crm/campaigns', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  const name = String(req.body?.name || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  const audience = String(req.body?.audience || 'all_ticket_buyers');
  const productId = req.body?.productId ? Number(req.body.productId) : null;
  const concertId = req.body?.concertId ? Number(req.body.concertId) : null;
  const discountCode = req.body?.discountCode ? String(req.body.discountCode).trim().slice(0, 64) : null;

  if (!name || !subject || !message) return res.status(400).json({ error: 'name, subject and message are required' });

  try {
    // Pre-compute the audience size so the artist sees the reach before sending.
    const recipients = await resolveCampaignAudience(artistId, audience, concertId);
    const { rows } = await q(
      `INSERT INTO smart_merch_campaigns
         (artist_id, name, product_id, concert_id, audience, subject, message, discount_code, status, recipients_count, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10)
       RETURNING *`,
      [artistId, name, productId, concertId, audience, subject, message, discountCode, recipients.length, userPgId(user)]
    );
    return res.json({ campaign: rows[0], audienceSize: recipients.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Delete a campaign ────────────────────────────────────────────────────────
router.delete('/:artistId(\\d+)/crm/campaigns/:campaignId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const campaignId = parseInt(req.params.campaignId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    await q(`DELETE FROM smart_merch_campaigns WHERE id = $1 AND artist_id = $2`, [campaignId, artistId]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Send a campaign to its fan audience (Resend) ─────────────────────────────
router.post('/:artistId(\\d+)/crm/campaigns/:campaignId(\\d+)/send', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const campaignId = parseInt(req.params.campaignId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isOwnerOrAdmin(user, artistId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const cR = await q(`SELECT * FROM smart_merch_campaigns WHERE id = $1 AND artist_id = $2`, [campaignId, artistId]);
    const campaign = cR.rows[0];
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status === 'sending') return res.status(409).json({ error: 'Campaign is already sending' });
    if (campaign.status === 'sent') return res.status(409).json({ error: 'Campaign was already sent' });

    const recipients = await resolveCampaignAudience(artistId, campaign.audience, campaign.concert_id);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No fans match this audience yet. Sell some tickets or merch first.' });
    }

    const meta = await getArtistMeta(artistId);
    const brand = await getArtistBrandRefs(artistId);
    const accent = brand.colors?.accent || brand.colors?.primary || '#db2777';

    let product: any = null;
    if (campaign.product_id) {
      const pR = await q(`SELECT id, title, image_url, presale_price, currency FROM smart_merch_products WHERE id = $1`, [campaign.product_id]);
      product = pR.rows[0] || null;
    }
    let eventTitle: string | null = null;
    if (campaign.concert_id) {
      const eR = await q(`SELECT title FROM concert_events WHERE id = $1`, [campaign.concert_id]).catch(() => ({ rows: [] }));
      eventTitle = eR.rows[0]?.title || null;
    }

    const storeUrl = meta.slug
      ? `${BASE_URL.replace(/\/$/, '')}/artist/${meta.slug}#smart-merch`
      : `${BASE_URL.replace(/\/$/, '')}`;
    const productPrice = product ? `${(product.currency || 'usd').toLowerCase() === 'eur' ? '€' : '$'}${Number(product.presale_price || 0).toLocaleString()}` : undefined;

    await q(`UPDATE smart_merch_campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1`, [campaignId]);
    // Clear any previous recipient rows (in case of a re-send after failure).
    await q(`DELETE FROM smart_merch_campaign_recipients WHERE campaign_id = $1`, [campaignId]);

    let sent = 0;
    let failed = 0;
    // Send sequentially to stay within provider rate limits.
    for (const fan of recipients) {
      const html = buildCampaignEmail({
        artistName: meta.name,
        fanName: fan.name || undefined,
        headline: campaign.subject,
        body: campaign.message,
        productTitle: product?.title,
        productImageUrl: product?.image_url || undefined,
        productPrice,
        ctaUrl: storeUrl,
        ctaLabel: product ? 'Get yours now' : 'Visit the store',
        discountCode: campaign.discount_code || undefined,
        eventTitle: fan.source === 'ticket' ? eventTitle || undefined : undefined,
        accentColor: accent,
      });
      const result = await sendFanCampaignEmail(fan.email, campaign.subject, html, meta.name);
      if (result.success) sent++; else failed++;
      await q(
        `INSERT INTO smart_merch_campaign_recipients
           (campaign_id, email, name, source, concert_id, status, email_provider, email_message_id, error)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [campaignId, fan.email, fan.name, fan.source, fan.concertId, result.success ? 'sent' : 'failed', result.provider || null, result.messageId || null, result.success ? null : (result.error || 'send failed')]
      );
    }

    const finalStatus = sent > 0 ? 'sent' : 'failed';
    await q(
      `UPDATE smart_merch_campaigns
          SET status = $1, sent_count = $2, failed_count = $3, recipients_count = $4, sent_at = NOW(), updated_at = NOW()
        WHERE id = $5`,
      [finalStatus, sent, failed, recipients.length, campaignId]
    );

    return res.json({ success: sent > 0, sent, failed, total: recipients.length, status: finalStatus });
  } catch (err: any) {
    await q(`UPDATE smart_merch_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1`, [campaignId]).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
});

export default router;
