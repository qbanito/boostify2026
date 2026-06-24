/**
 * server/routes/vinyl-editions.ts
 *
 * Vinyl Limited Edition Token System — Boostify × Diggers Factory
 *
 * Endpoints:
 *   GET  /api/vinyl-editions/:artistId                  List published editions
 *   GET  /api/vinyl-editions/detail/:editionId          Single edition + token map
 *   POST /api/vinyl-editions                            Create edition draft (auth)
 *   PUT  /api/vinyl-editions/:editionId                 Update edition (auth/owner)
 *   POST /api/vinyl-editions/:editionId/generate-cover  AI cover via FAL FLUX (auth)
 *   POST /api/vinyl-editions/:editionId/publish         Publish + mint tokens (auth)
 *   POST /api/vinyl-editions/:editionId/checkout        Buy a token (Stripe)
 *   POST /api/vinyl-editions/:editionId/tokens/:num/list  List token for resale (auth)
 *   GET  /api/vinyl-editions/:editionId/market          Market value history
 *   GET  /api/vinyl-editions/my-tokens/:userId          User's token collection
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import Stripe from 'stripe';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { storage } from '../firebase';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any });

const FAL_KEY = process.env.FAL_API_KEY || process.env.FAL_KEY || '';
const BASE_URL = process.env.PRODUCTION_URL || 'http://localhost:5000';

async function q(text: string, params: unknown[] = []) {
  const res = await pool.query(text, params);
  return res;
}

// ─── Rarity label helper ─────────────────────────────────────────────────────
function rarityFromSize(size: number): string {
  if (size <= 100) return 'unique';
  if (size <= 300) return 'rare';
  return 'limited';
}

// ─── GET /api/vinyl-editions/:artistId ──────────────────────────────────────
router.get('/:artistId(\\d+)', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  try {
    const { rows } = await q(
      `SELECT e.*,
              COUNT(t.id) FILTER (WHERE t.payment_status = 'paid') AS tokens_sold,
              COUNT(t.id) FILTER (WHERE t.is_listed_for_sale = true) AS tokens_on_market
       FROM vinyl_editions e
       LEFT JOIN vinyl_edition_tokens t ON t.edition_id = e.id
       WHERE e.artist_id = $1 AND e.is_published = true
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [artistId]
    );
    return res.json({ editions: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vinyl-editions/detail/:editionId ──────────────────────────────
router.get('/detail/:editionId(\\d+)', async (req: Request, res: Response) => {
  const id = parseInt(req.params.editionId, 10);
  try {
    const { rows: [edition] } = await q(`SELECT * FROM vinyl_editions WHERE id = $1`, [id]);
    if (!edition) return res.status(404).json({ error: 'Edition not found' });

    const { rows: tokens } = await q(
      `SELECT token_number, serial_label, payment_status, is_listed_for_sale,
              list_price, current_value, holder_name, shipping_status
       FROM vinyl_edition_tokens WHERE edition_id = $1 ORDER BY token_number`,
      [id]
    );

    const { rows: txs } = await q(
      `SELECT price, created_at, transaction_type
       FROM vinyl_token_transactions WHERE edition_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    return res.json({ edition, tokens, priceHistory: txs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vinyl-editions — Create draft ────────────────────────────────
router.post('/', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const {
    artistId,
    title,
    subtitle,
    description,
    editionSize = 100,
    mintPrice,
    shippingFlatRate = 14,
    vinylFormat = '12',
    vinylType = '1LP',
    vinylColor = 'black',
    vinylWeight = '180g',
    vinylSpeed = '33RPM',
    sleeveType = 'color',
    printFinish = 'gloss',
    innerSleeve = 'white',
    withShrink = true,
    withBarcode = true,
    includeMastering = false,
    tracklistJson = [],
    copyrightConfirmed = false,
    copyrightOrg,
    catalogNumber,
    tokenSymbol,
    appreciationNotes,
    saleStart,
    saleEnd,
  } = req.body;

  if (!artistId || !title) return res.status(400).json({ error: 'artistId and title are required' });
  if (!copyrightConfirmed) return res.status(400).json({ error: 'copyright_confirmed is required' });

  const size = parseInt(String(editionSize)) || 100;
  const rarity = rarityFromSize(size);
  const price = parseFloat(String(mintPrice)) || (size === 100 ? 65 : size === 300 ? 45 : 35);

  try {
    const { rows: [edition] } = await q(
      `INSERT INTO vinyl_editions (
        artist_id, title, subtitle, description,
        edition_size, mint_price, shipping_flat_rate,
        vinyl_format, vinyl_type, vinyl_color, vinyl_weight, vinyl_speed,
        sleeve_type, print_finish, inner_sleeve, with_shrink, with_barcode,
        include_mastering, tracklist_json, copyright_confirmed, copyright_org,
        catalog_number, token_symbol, appreciation_notes, rarity_tier,
        sale_start, sale_end, status
       ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,'draft'
       ) RETURNING *`,
      [
        artistId, title, subtitle || null, description || null,
        size, price, parseFloat(String(shippingFlatRate)),
        vinylFormat, vinylType, vinylColor, vinylWeight, vinylSpeed,
        sleeveType, printFinish, innerSleeve, withShrink, withBarcode,
        includeMastering, JSON.stringify(tracklistJson), copyrightConfirmed, copyrightOrg || null,
        catalogNumber || null, tokenSymbol || null, appreciationNotes || null, rarity,
        saleStart || null, saleEnd || null,
      ]
    );
    return res.status(201).json({ edition });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/vinyl-editions/:editionId — Update (owner only) ───────────────
router.put('/:editionId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const id = parseInt(req.params.editionId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const updates = req.body;

  // Ownership check
  try {
    const { rows: [existing] } = await q(`SELECT artist_id FROM vinyl_editions WHERE id = $1`, [id]);
    if (!existing) return res.status(404).json({ error: 'Edition not found' });
    if (existing.artist_id !== user.pgId && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }

  // Build SET clause dynamically from allowed keys
  const allowed = [
    'title','subtitle','description','cover_image_1000','cover_image_back',
    'vinyl_color','vinyl_weight','sleeve_type','print_finish','inner_sleeve',
    'with_shrink','with_barcode','include_mastering','tracklist_json',
    'mint_price','shipping_flat_rate','appreciation_notes','token_symbol',
    'catalog_number','sale_start','sale_end','diggers_quote_ref','diggers_project_url',
    'current_market_value','status',
  ];
  const setClauses: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    const camel = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    const val = updates[key] !== undefined ? updates[key] : updates[camel];
    if (val !== undefined) {
      setClauses.push(`${key} = $${idx++}`);
      vals.push(key === 'tracklist_json' ? JSON.stringify(val) : val);
    }
  }
  if (!setClauses.length) return res.status(400).json({ error: 'No fields to update' });
  setClauses.push(`updated_at = NOW()`);
  vals.push(id);

  try {
    const { rows: [edition] } = await q(
      `UPDATE vinyl_editions SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!edition) return res.status(404).json({ error: 'Edition not found' });
    return res.json({ edition });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vinyl-editions/:editionId/generate-cover ─────────────────────
// Generates 1000x1000 vinyl cover art via FAL FLUX Pro Kontext
router.post('/:editionId(\\d+)/generate-cover', authenticate, async (req: Request, res: Response) => {
  const editionId = parseInt(req.params.editionId, 10);
  const { prompt, style = 'cinematic', referenceImageUrl } = req.body;

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });
  if (!FAL_KEY) return res.status(503).json({ error: 'FAL_API_KEY not configured' });

  try {
    const { rows: [edition] } = await q(`SELECT * FROM vinyl_editions WHERE id = $1`, [editionId]);
    if (!edition) return res.status(404).json({ error: 'Edition not found' });

    const artistName = edition.title.split(' ')[0];
    const fullPrompt = `Vinyl record album cover art, 1000x1000 square format, ${style} style. 
Artist: ${artistName}. Album: "${edition.title}". 
${prompt}. 
Professional music artwork, high-end collectible limited edition vinyl, museum quality print, 
perfect for 12-inch record sleeve, extremely detailed, editorial photography style, 
masterpiece visual art.`;

    // Use FAL FLUX Pro Kontext text-to-image (best quality 1:1)
    const model = referenceImageUrl
      ? 'fal-ai/flux-pro/kontext'
      : 'fal-ai/flux-pro/kontext/text-to-image';

    const payload: Record<string, unknown> = {
      prompt: fullPrompt,
      image_size: 'square_hd', // 1024x1024 — closest to 1000x1000
      num_images: 1,
      output_format: 'jpeg',
      guidance_scale: 3.5,
    };
    if (referenceImageUrl) payload.image_url = referenceImageUrl;

    const falRes = await axios.post(
      `https://fal.run/${model}`,
      payload,
      {
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );

    const imageUrl = falRes.data?.images?.[0]?.url || falRes.data?.image?.url;
    if (!imageUrl) return res.status(500).json({ error: 'FAL returned no image' });

    // Save the generated cover URL + prompt into the edition
    await q(
      `UPDATE vinyl_editions SET cover_image_1000 = $1, ai_cover_prompt = $2, ai_cover_model = $3, updated_at = NOW() WHERE id = $4`,
      [imageUrl, prompt, model, editionId]
    );

    return res.json({ imageUrl, prompt: fullPrompt, model });
  } catch (err: any) {
    console.error('[vinyl-editions] generate-cover error:', err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// ─── POST /api/vinyl-editions/:editionId/publish ────────────────────────────
// Publishes the edition and mints all numbered tokens
router.post('/:editionId(\\d+)/publish', authenticate, async (req: Request, res: Response) => {
  const editionId = parseInt(req.params.editionId, 10);

  try {
    const { rows: [edition] } = await q(`SELECT * FROM vinyl_editions WHERE id = $1`, [editionId]);
    if (!edition) return res.status(404).json({ error: 'Edition not found' });
    if (edition.status !== 'draft' && edition.status !== 'presale') {
      return res.status(400).json({ error: `Cannot publish edition in status: ${edition.status}` });
    }
    if (!edition.cover_image_1000) {
      return res.status(400).json({ error: 'Cover image is required before publishing' });
    }

    const size = edition.edition_size;
    const symbol = edition.token_symbol || edition.catalog_number || `BFYE${editionId}`;

    // Mint all tokens in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let n = 1; n <= size; n++) {
        const serial = `${String(n).padStart(3, '0')}/${size}`;
        await client.query(
          `INSERT INTO vinyl_edition_tokens (edition_id, token_number, serial_label, current_value)
           VALUES ($1, $2, $3, $4) ON CONFLICT (edition_id, token_number) DO NOTHING`,
          [editionId, n, serial, edition.mint_price]
        );
      }
      await client.query(
        `UPDATE vinyl_editions
         SET status = 'live', is_published = true, tokens_minted = $1, updated_at = NOW()
         WHERE id = $2`,
        [size, editionId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const { rows: [updated] } = await q(`SELECT * FROM vinyl_editions WHERE id = $1`, [editionId]);
    return res.json({ edition: updated, tokensCreated: size });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vinyl-editions/:editionId/checkout ───────────────────────────
// Creates Stripe Checkout to purchase the next available token
router.post('/:editionId(\\d+)/checkout', async (req: Request, res: Response) => {
  const editionId = parseInt(req.params.editionId, 10);
  const { buyerEmail, buyerName, specificToken } = req.body;
  if (!buyerEmail || !buyerName) return res.status(400).json({ error: 'buyerEmail and buyerName are required' });

  try {
    const { rows: [edition] } = await q(
      `SELECT * FROM vinyl_editions WHERE id = $1 AND status = 'live' AND is_published = true`,
      [editionId]
    );
    if (!edition) return res.status(404).json({ error: 'Edition not available' });

    // Atomically reserve the next available token (or a specific one) to avoid
    // two buyers being sold the same copy. FOR UPDATE SKIP LOCKED lets concurrent
    // checkouts each grab a different available row instead of blocking/colliding.
    const client = await pool.connect();
    let token: any;
    try {
      await client.query('BEGIN');
      let tokenQuery = `SELECT * FROM vinyl_edition_tokens
                        WHERE edition_id = $1 AND payment_status = 'available'`;
      const tokenParams: unknown[] = [editionId];
      if (specificToken) {
        tokenQuery += ` AND token_number = $2`;
        tokenParams.push(specificToken);
      } else {
        tokenQuery += ` ORDER BY token_number ASC`;
      }
      tokenQuery += ` FOR UPDATE SKIP LOCKED LIMIT 1`;
      const { rows: [picked] } = await client.query(tokenQuery, tokenParams);
      if (!picked) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'No tokens available' });
      }
      token = picked;
      // Reserve immediately so the row is no longer "available" once committed.
      await client.query(
        `UPDATE vinyl_edition_tokens
         SET payment_status = 'pending', holder_name = $1, holder_email = $2, updated_at = NOW()
         WHERE id = $3`,
        [buyerName, buyerEmail, token.id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const price = parseFloat(edition.mint_price);
    const shipping = parseFloat(edition.shipping_flat_rate);
    const totalCents = Math.round((price + shipping) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: buyerEmail,
      metadata: {
        editionId: String(editionId),
        tokenNumber: String(token.token_number),
        buyerName,
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${edition.title} — Token #${token.serial_label}`,
              description: `Limited Edition Vinyl • ${edition.rarity_tier === 'unique' ? '100' : edition.rarity_tier === 'rare' ? '300' : '500'} copies worldwide • ${edition.vinyl_format}" ${edition.vinyl_color}`,
              images: edition.cover_image_1000 ? [edition.cover_image_1000] : [],
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Shipping & Handling' },
            unit_amount: Math.round(shipping * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${BASE_URL}/universe/${edition.artist_id}?vinyl_token=success&token=${token.token_number}`,
      cancel_url: `${BASE_URL}/universe/${edition.artist_id}?vinyl_token=cancelled`,
    });

    // Persist the Stripe session id on the reserved token so the webhook can
    // confirm it and so we can release it if the checkout expires.
    await q(
      `UPDATE vinyl_edition_tokens SET stripe_session_id = $1, updated_at = NOW() WHERE id = $2`,
      [session.id, token.id]
    );

    return res.json({ checkoutUrl: session.url, tokenNumber: token.token_number, serialLabel: token.serial_label });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vinyl-editions/webhook (Stripe) ──────────────────────────────
// Confirms token purchases. The raw body for this route is mounted in
// server/index.ts (express.raw before the global json parser) so the Stripe
// signature can be verified.
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_VINYL_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret!);
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const editionId = parseInt(meta.editionId, 10);
      const tokenNumber = parseInt(meta.tokenNumber, 10);
      if (!editionId || !tokenNumber) return res.json({ received: true });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Atomically confirm the token. Idempotent: only the 'pending' row for
        // this session transitions to 'paid', so duplicate webhook deliveries
        // are no-ops.
        const { rows: [token] } = await client.query(
          `UPDATE vinyl_edition_tokens t
           SET payment_status = 'paid',
               purchase_price = e.mint_price,
               purchased_at = NOW(),
               current_value = e.mint_price,
               updated_at = NOW()
           FROM vinyl_editions e
           WHERE t.edition_id = $1
             AND t.token_number = $2
             AND t.edition_id = e.id
             AND t.payment_status = 'pending'
             AND t.stripe_session_id = $3
           RETURNING t.id, t.token_number, e.mint_price`,
          [editionId, tokenNumber, session.id]
        );

        if (token) {
          await client.query(
            `INSERT INTO vinyl_token_transactions
               (edition_id, token_id, token_number, transaction_type, price, note)
             VALUES ($1, $2, $3, 'mint', $4, 'Primary sale via Stripe Checkout')`,
            [editionId, token.id, token.token_number, token.mint_price]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else if (event.type === 'checkout.session.expired') {
      // Release the reserved token so it returns to the available pool.
      const session = event.data.object as Stripe.Checkout.Session;
      await q(
        `UPDATE vinyl_edition_tokens
         SET payment_status = 'available', holder_name = NULL, holder_email = NULL,
             stripe_session_id = NULL, updated_at = NOW()
         WHERE stripe_session_id = $1 AND payment_status = 'pending'`,
        [session.id]
      );
    }

    return res.json({ received: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vinyl-editions/:editionId/generate-product-image ─────────────
// Generates a premium vinyl product photography mockup using FAL FLUX Pro Kontext
router.post('/:editionId(\\d+)/generate-product-image', authenticate, async (req: Request, res: Response) => {
  const editionId = parseInt(req.params.editionId, 10);
  if (!FAL_KEY) return res.status(503).json({ error: 'FAL_API_KEY not configured' });

  try {
    const { rows: [edition] } = await q(`SELECT * FROM vinyl_editions WHERE id = $1`, [editionId]);
    if (!edition) return res.status(404).json({ error: 'Edition not found' });
    if (!edition.cover_image_1000) return res.status(400).json({ error: 'Cover image required first' });

    const tracklist = (edition.tracklist_json || []) as Array<{ side: string; track: number; title: string }>;
    const sides = ['A', 'B'];
    const tracklistLines = sides.flatMap(side =>
      tracklist.filter(t => t.side === side).slice(0, 4).map(t => `${side}${t.track}. ${t.title}`)
    ).slice(0, 8).join(' • ');

    const rarityDetail = edition.rarity_tier === 'unique'
      ? 'gold foil serial number stamp, premium matte sleeve, luxury limited edition collectible'
      : edition.rarity_tier === 'rare'
      ? 'embossed typography, satin sleeve finish, numbered collector edition'
      : 'premium card sleeve, hand-numbered edition';

    const prompt = `Ultra-premium vinyl record product photography, professional studio product shot. 12-inch vinyl record album sleeve for "${edition.title}"${edition.subtitle ? ` — ${edition.subtitle}` : ''}, album cover art prominently displayed on the sleeve, the black vinyl disc partially pulled out of the sleeve revealing vinyl grooves and center label, ${rarityDetail}. Museum-quality studio lighting with dramatic cinematic shadows, pure white seamless background, luxury goods advertising photography, razor-sharp focus, editorial magazine spread quality, extremely photorealistic, hyper-detailed product shot. The sleeve label clearly reads "${edition.title}"${tracklistLines ? `. Tracklist visible on sleeve back: ${tracklistLines}` : ''}.`;

    const falRes = await axios.post(
      'https://fal.run/fal-ai/flux-pro/kontext',
      {
        prompt,
        image_url: edition.cover_image_1000,
        image_size: 'square_hd',
        num_images: 1,
        output_format: 'jpeg',
        guidance_scale: 3.5,
      },
      {
        headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
        timeout: 120000,
      }
    );

    const imageUrl = falRes.data?.images?.[0]?.url || falRes.data?.image?.url;
    if (!imageUrl) return res.status(500).json({ error: 'FAL returned no image' });

    return res.json({ imageUrl });
  } catch (err: any) {
    console.error('[vinyl-editions] generate-product-image error:', err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// ─── POST /api/vinyl-editions/:editionId/generate-promo-video ────────────────
// Queues a 5s 720p 9:16 promo video via Seedance 2.0 Fast Reference-to-Video
router.post('/:editionId(\\d+)/generate-promo-video', authenticate, async (req: Request, res: Response) => {
  const editionId = parseInt(req.params.editionId, 10);
  const { artistPhotoUrl } = req.body;
  if (!FAL_KEY) return res.status(503).json({ error: 'FAL_API_KEY not configured' });

  try {
    const { rows: [edition] } = await q(`SELECT * FROM vinyl_editions WHERE id = $1`, [editionId]);
    if (!edition) return res.status(404).json({ error: 'Edition not found' });
    if (!edition.cover_image_1000) return res.status(400).json({ error: 'Cover image required first' });

    const imageUrls: string[] = [edition.cover_image_1000];
    if (artistPhotoUrl && typeof artistPhotoUrl === 'string') imageUrls.push(artistPhotoUrl);

    const hasArtist = imageUrls.length > 1;
    const rarityLabel = edition.rarity_tier === 'unique' ? 'UNIQUE EDITION — 100 COPIES' : edition.rarity_tier === 'rare' ? 'RARE EDITION — 300 COPIES' : 'LIMITED EDITION — 500 COPIES';

    const prompt = hasArtist
      ? `Cinematic premium vinyl record advertisement, luxury music product reveal. ${edition.title} album. The artist holds a 12-inch vinyl record with both hands, gazing into the camera with confidence, slow cinematic push-in, the vinyl record disc catches ambient studio light creating rainbow iridescent grooves reflection, dramatic moody background lighting, shallow depth of field, luxury brand commercial quality, slow motion, vertical 9:16 format, premium feel. Lower third text overlay: "${edition.title}" — ${rarityLabel}.`
      : `Cinematic premium vinyl record advertisement, luxury music product reveal. ${edition.title} album. A turntable needle gently drops onto a spinning vinyl record in slow motion, the grooves catch studio light creating rainbow iridescence, the album cover "${edition.title}" slides elegantly into frame, dramatic luxury product photography lighting, shallow depth of field, premium music ad, vertical 9:16 format. Lower third text overlay: "${edition.title}" — ${rarityLabel}.`;

    const submitRes = await axios.post(
      'https://queue.fal.run/bytedance/seedance-2.0/fast/reference-to-video',
      {
        prompt,
        image_urls: imageUrls,
        resolution: '720p',
        duration: '5',
        aspect_ratio: '9:16',
        generate_audio: false,
        negative_prompt: 'blur, distort, low quality, static, frozen, morphing, deformed, text errors, watermark',
      },
      {
        headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    const requestId: string = submitRes.data?.request_id;
    if (!requestId) return res.status(500).json({ error: 'FAL queue did not return request_id' });

    return res.json({
      requestId,
      statusUrl: submitRes.data?.status_url || '',
      resultUrl: submitRes.data?.response_url || '',
    });
  } catch (err: any) {
    console.error('[vinyl-editions] generate-promo-video error:', err.response?.data || err.message);
    const status = err?.response?.status;
    if (status === 403) return res.status(503).json({ error: 'FAL balance depleted — recharge at fal.ai/dashboard/billing' });
    return res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// ─── GET /api/vinyl-editions/poll-fal/:requestId ────────────────────────────
// Polls FAL queue for promo video generation status
router.get('/poll-fal/:requestId', authenticate, async (req: Request, res: Response) => {
  const { requestId } = req.params;
  const { statusUrl, resultUrl } = req.query as { statusUrl?: string; resultUrl?: string };
  if (!FAL_KEY) return res.status(503).json({ error: 'FAL_API_KEY not configured' });

  const model = 'bytedance/seedance-2.0/fast/reference-to-video';
  const sUrl = statusUrl || `https://queue.fal.run/${model}/requests/${requestId}/status`;
  const rUrl = resultUrl || `https://queue.fal.run/${model}/requests/${requestId}`;

  try {
    const statusRes = await axios.get(sUrl, {
      headers: { Authorization: `Key ${FAL_KEY}` },
      timeout: 10000,
    });

    const falStatus: string = statusRes.data?.status || '';

    if (falStatus === 'COMPLETED') {
      const resultRes = await axios.get(rUrl, {
        headers: { Authorization: `Key ${FAL_KEY}` },
        timeout: 15000,
      });
      const videoUrl =
        resultRes.data?.video?.url ||
        resultRes.data?.outputs?.[0]?.url ||
        resultRes.data?.url ||
        '';
      if (!videoUrl) return res.status(500).json({ error: 'FAL completed but no video URL found' });
      return res.json({ status: 'completed', videoUrl });
    }

    if (falStatus === 'FAILED' || falStatus === 'ERROR') {
      return res.json({ status: 'failed', error: statusRes.data?.error || 'Generation failed' });
    }

    const logs: any[] = statusRes.data?.logs || [];
    return res.json({ status: 'processing', progress: logs.length, logs: logs.slice(-3) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vinyl-editions/:editionId/tokens/:num/list ───────────────────
// Token holder lists their token for resale
router.post('/:editionId(\\d+)/tokens/:num(\\d+)/list', authenticate, async (req: Request, res: Response) => {
  const editionId = parseInt(req.params.editionId, 10);
  const tokenNum = parseInt(req.params.num, 10);
  const { listPrice } = req.body;
  const user = (req as any).user;

  if (!listPrice || parseFloat(String(listPrice)) <= 0) {
    return res.status(400).json({ error: 'listPrice must be positive' });
  }

  try {
    const { rows: [token] } = await q(
      `SELECT * FROM vinyl_edition_tokens WHERE edition_id = $1 AND token_number = $2`,
      [editionId, tokenNum]
    );
    if (!token) return res.status(404).json({ error: 'Token not found' });
    if (token.owner_user_id !== user.pgId && token.holder_email !== user.email) {
      return res.status(403).json({ error: 'You do not own this token' });
    }

    await q(
      `UPDATE vinyl_edition_tokens SET is_listed_for_sale = true, list_price = $1, listed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [parseFloat(String(listPrice)), token.id]
    );

    return res.json({ success: true, tokenNumber: tokenNum, listPrice });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vinyl-editions/:editionId/market ──────────────────────────────
router.get('/:editionId(\\d+)/market', async (req: Request, res: Response) => {
  const editionId = parseInt(req.params.editionId, 10);
  try {
    const { rows: edition } = await q(`SELECT * FROM vinyl_editions WHERE id = $1`, [editionId]);
    if (!edition.length) return res.status(404).json({ error: 'Edition not found' });

    const { rows: priceHistory } = await q(
      `SELECT price, created_at, transaction_type FROM vinyl_token_transactions
       WHERE edition_id = $1 ORDER BY created_at ASC`,
      [editionId]
    );

    const { rows: listed } = await q(
      `SELECT token_number, serial_label, list_price, listed_at
       FROM vinyl_edition_tokens WHERE edition_id = $1 AND is_listed_for_sale = true
       ORDER BY list_price ASC`,
      [editionId]
    );

    const { rows: stats } = await q(
      `SELECT
         COUNT(*) FILTER (WHERE payment_status = 'paid') AS sold,
         COUNT(*) FILTER (WHERE payment_status = 'available') AS available,
         COUNT(*) FILTER (WHERE is_listed_for_sale = true) AS on_market,
         AVG(purchase_price) FILTER (WHERE payment_status = 'paid') AS avg_sale_price,
         MAX(purchase_price) FILTER (WHERE payment_status = 'paid') AS max_sale_price
       FROM vinyl_edition_tokens WHERE edition_id = $1`,
      [editionId]
    );

    return res.json({
      edition: edition[0],
      priceHistory,
      listedTokens: listed,
      stats: stats[0],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vinyl-editions/my-tokens/:userId ──────────────────────────────
router.get('/my-tokens/:userId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  try {
    const { rows } = await q(
      `SELECT t.*, e.title, e.subtitle, e.cover_image_1000, e.artist_id, e.mint_price,
              e.current_market_value, e.vinyl_color, e.vinyl_format, e.rarity_tier, e.edition_size
       FROM vinyl_edition_tokens t
       JOIN vinyl_editions e ON e.id = t.edition_id
       WHERE t.owner_user_id = $1
       ORDER BY t.purchased_at DESC`,
      [userId]
    );
    return res.json({ tokens: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vinyl-editions/admin/:artistId — All editions (including drafts)
router.get('/admin/:artistId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  try {
    const { rows } = await q(
      `SELECT e.*,
              COUNT(t.id) FILTER (WHERE t.payment_status = 'paid') AS tokens_sold,
              COUNT(t.id) FILTER (WHERE t.payment_status = 'available') AS tokens_available
       FROM vinyl_editions e
       LEFT JOIN vinyl_edition_tokens t ON t.edition_id = e.id
       WHERE e.artist_id = $1
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [artistId]
    );
    return res.json({ editions: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
