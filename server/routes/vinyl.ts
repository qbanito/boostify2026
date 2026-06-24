import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth';
import { db as pgDb } from '../db';
import { users } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { sendNotificationEmail } from '../services/brevo-email-service';
import { generateVinylArtwork, type ArtworkTrack } from '../services/vinyl-artwork-service';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia' as any,
});

const BASE_URL = process.env.PRODUCTION_URL || 'http://localhost:5000';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Raw SQL helper — vinyl tables are not yet in Drizzle schema so we use raw pg */
async function vinylQuery(sql_: string, params: unknown[] = []) {
  // Access the underlying pg Pool via drizzle's session
  const result = await (pgDb as any).execute(sql`${sql_}`) as any;
  return result;
}

// Use the underlying pool directly since vinyl tables are added via migration
import { pool } from '../db';

async function q(text: string, params: unknown[] = []) {
  const res = await pool.query(text, params);
  return res;
}

// ─── GET /api/vinyl/:artistId/campaigns ─────────────────────────────────────
router.get('/:artistId/campaigns', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artistId' });

  try {
    const { rows } = await q(
      `SELECT * FROM vinyl_campaigns
       WHERE artist_id = $1 AND is_published = true
       ORDER BY created_at DESC`,
      [artistId]
    );
    return res.json({ campaigns: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vinyl/campaigns/:id ───────────────────────────────────────────
router.get('/campaigns/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const { rows } = await q(
      `SELECT vc.*,
              (SELECT COUNT(*) FROM vinyl_preorders vp WHERE vp.campaign_id = vc.id AND vp.status != 'cancelled') AS total_orders
       FROM vinyl_campaigns vc WHERE vc.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found' });
    return res.json({ campaign: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vinyl/campaigns (create) ─────────────────────────────────────
router.post('/campaigns', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const {
    artistId,
    title,
    subtitle,
    coverImage1000,
    coverImageBack,
    tracklistJson,
    vinylFormat = '12',
    vinylType = '1LP',
    vinylColor = 'black',
    vinylWeight = '140g',
    vinylSpeed = '33RPM',
    sleeveType = 'color',
    printFinish = 'gloss',
    innerSleeve = 'white',
    numbered = 'none',
    withInsert = 'none',
    withShrink = false,
    withBarcode = true,
    includeMastering = false,
    diggersQuoteRef,
    diggersProjectUrl,
    productionCostTotal,
    minimumUnits = 100,
    maxUnits = 300,
    shippingFlatRate = 12.00,
    copyrightOrg,
    copyrightConfirmed = false,
    campaignEnd,
    // Auto-generated Boostify print artwork (optional)
    printFrontUrl,
    printBackUrl,
    bookPagesJson,
    artworkProvider,
  } = req.body;
  // Validate required fields
  if (!title || !coverImage1000 || !productionCostTotal || !artistId) {
    return res.status(400).json({ error: 'Missing required fields: title, coverImage1000, productionCostTotal, artistId' });
  }
  if (!copyrightConfirmed) {
    return res.status(400).json({ error: 'You must confirm copyright ownership' });
  }

  const costTotal = parseFloat(productionCostTotal);
  const minUnits = parseInt(minimumUnits, 10) || 100;
  const unitCost = parseFloat((costTotal / minUnits).toFixed(2));
  const sellPrice = parseFloat((unitCost * 2).toFixed(2));

  try {
    const { rows } = await q(
      `INSERT INTO vinyl_campaigns (
         artist_id, title, subtitle, cover_image_1000, cover_image_back, tracklist_json,
         vinyl_format, vinyl_type, vinyl_color, vinyl_weight, vinyl_speed,
         sleeve_type, print_finish, inner_sleeve, numbered, with_insert,
         with_shrink, with_barcode, include_mastering,
         diggers_quote_ref, diggers_project_url,
         production_cost_total, minimum_units, max_units, unit_cost, sell_price,
         shipping_flat_rate, copyright_org, copyright_confirmed, campaign_end,
         print_front_url, print_back_url, book_pages_json, artwork_provider
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
       RETURNING *`,
      [
        artistId, title, subtitle || null, coverImage1000, coverImageBack || null,
        JSON.stringify(tracklistJson || []),
        vinylFormat, vinylType, vinylColor, vinylWeight, vinylSpeed,
        sleeveType, printFinish, innerSleeve, numbered, withInsert,
        withShrink, withBarcode, includeMastering,
        diggersQuoteRef || null, diggersProjectUrl || null,
        costTotal, minUnits, maxUnits, unitCost, sellPrice,
        parseFloat(shippingFlatRate), copyrightOrg || null, copyrightConfirmed,
        campaignEnd || null,
        printFrontUrl || null, printBackUrl || null,
        JSON.stringify(bookPagesJson || []), artworkProvider || null,
      ]
    );
    return res.status(201).json({ campaign: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Artwork helpers ────────────────────────────────────────────────────────
const isHttp = (u: any): u is string => typeof u === 'string' && /^https?:\/\//i.test(u);

/** Gathers everything needed to auto-generate vinyl artwork for an artist. */
async function gatherArtworkContext(artistId: number, body: any) {
  // Artist identity
  const aRes = await q(
    `SELECT artist_name, genre, profile_image, profile_image_url, cover_image, master_json
       FROM users WHERE id = $1`,
    [artistId]
  );
  if (!aRes.rows.length) return null;
  const u = aRes.rows[0];
  const artistName = u.artist_name || body.artistName || 'Artist';
  const genre = u.genre || undefined;

  // Songs → tracklist + lyrics + cover gallery
  let songRows: any[] = [];
  try {
    const sRes = await q(
      `SELECT title, duration, cover_art, lyrics FROM songs
        WHERE user_id = $1 AND is_published = true
        ORDER BY created_at DESC LIMIT 40`,
      [artistId]
    );
    songRows = sRes.rows;
  } catch { /* songs optional */ }

  // Derive tracklist from request, else from the artist's songs
  const bodyTracks: ArtworkTrack[] = Array.isArray(body.tracklist) ? body.tracklist.filter((t: any) => t?.title) : [];
  let tracklist: ArtworkTrack[] = bodyTracks.length
    ? bodyTracks
    : songRows.slice(0, 12).map((s, i) => ({
        side: i < 6 ? 'A' : 'B',
        track: (i < 6 ? i : i - 6) + 1,
        title: s.title,
        duration: s.duration || undefined,
      }));
  if (!tracklist.length) tracklist = [{ side: 'A', track: 1, title: body.title || artistName }];

  const lyricsByTitle: Record<string, string> = {};
  songRows.forEach((s) => { if (s.title && s.lyrics) lyricsByTitle[s.title] = s.lyrics; });

  // Gallery for the booklet (song covers → social images → master design → portraits)
  const gallery: string[] = [];
  songRows.forEach((s) => { if (isHttp(s.cover_art)) gallery.push(s.cover_art); });
  try {
    const socRes = await q(
      `SELECT media_urls FROM ai_social_posts
        WHERE artist_id = $1 AND content_type = 'image'
        ORDER BY created_at DESC LIMIT 30`,
      [artistId]
    );
    socRes.rows.forEach((r: any) => (Array.isArray(r.media_urls) ? r.media_urls : []).forEach((m: any) => { if (isHttp(m)) gallery.push(m); }));
  } catch { /* social posts optional */ }

  const master = u.master_json || {};
  const masterUrl = master?.masterDesignUrl || master?.branding?.masterDesignUrl || master?.designPack?.masterDesignUrl;
  [masterUrl, u.cover_image, u.profile_image, u.profile_image_url].forEach((p) => { if (isHttp(p)) gallery.push(p); });
  const dedupGallery = Array.from(new Set(gallery));

  // Best base art for the front cover
  const baseArtUrl = isHttp(masterUrl) ? masterUrl
    : songRows.find((s) => isHttp(s.cover_art))?.cover_art
    || (isHttp(u.cover_image) ? u.cover_image : undefined)
    || (isHttp(u.profile_image) ? u.profile_image : undefined);

  return { artistName, genre, tracklist, lyricsByTitle, gallery: dedupGallery, baseArtUrl };
}

// ─── POST /api/vinyl/:artistId/generate-artwork ─────────────────────────────
// Owner-only. Auto-generates print-ready vinyl artwork (front + back + booklet)
// at 12" / 300 DPI, with song titles, credits and "Created by Boostify".
router.post('/:artistId/generate-artwork', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const artistId = parseInt(req.params.artistId, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artistId' });

  const { title, subtitle, accentColor, includeBook = true } = req.body;

  try {
    const ctx = await gatherArtworkContext(artistId, req.body);
    if (!ctx) return res.status(404).json({ error: 'Artist not found' });

    const albumTitle = (title && String(title).trim()) || `${ctx.artistName} — LP`;

    const result = await generateVinylArtwork({
      artistId,
      artistName: ctx.artistName,
      albumTitle,
      subtitle: subtitle || undefined,
      genre: ctx.genre,
      accentColor: accentColor || undefined,
      tracklist: ctx.tracklist,
      galleryImages: ctx.gallery,
      baseArtUrl: ctx.baseArtUrl,
      lyricsByTitle: ctx.lyricsByTitle,
      includeBook: includeBook !== false,
      generateAi: true,
    });

    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[vinyl] generate-artwork failed:', err?.message);
    return res.status(500).json({ error: err.message || 'Artwork generation failed' });
  }
});

// ─── POST /api/vinyl/campaigns/:id/generate-artwork ─────────────────────────
// Re-generate (or first-time generate) artwork for an EXISTING campaign and
// persist the URLs onto the campaign row.
router.post('/campaigns/:id/generate-artwork', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const cRes = await q(`SELECT * FROM vinyl_campaigns WHERE id = $1`, [id]);
    if (!cRes.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = cRes.rows[0];
    const artistId = campaign.artist_id;

    const ctx = await gatherArtworkContext(artistId, {
      ...req.body,
      tracklist: req.body.tracklist || campaign.tracklist_json,
    });
    if (!ctx) return res.status(404).json({ error: 'Artist not found' });

    const result = await generateVinylArtwork({
      artistId,
      artistName: ctx.artistName,
      albumTitle: campaign.title,
      subtitle: campaign.subtitle || undefined,
      genre: ctx.genre,
      accentColor: req.body.accentColor || undefined,
      tracklist: (Array.isArray(campaign.tracklist_json) && campaign.tracklist_json.length ? campaign.tracklist_json : ctx.tracklist) as ArtworkTrack[],
      galleryImages: ctx.gallery,
      baseArtUrl: ctx.baseArtUrl,
      lyricsByTitle: ctx.lyricsByTitle,
      includeBook: req.body.includeBook !== false,
      generateAi: true,
    });

    const { rows } = await q(
      `UPDATE vinyl_campaigns
          SET cover_image_1000 = $1, cover_image_back = $2,
              print_front_url = $1, print_back_url = $2,
              book_pages_json = $3, artwork_provider = $4,
              artwork_meta = $5, updated_at = NOW()
        WHERE id = $6
        RETURNING *`,
      [result.frontUrl, result.backUrl, JSON.stringify(result.bookPages), result.provider, JSON.stringify(result.meta), id]
    );

    return res.json({ success: true, campaign: rows[0], ...result });
  } catch (err: any) {
    console.error('[vinyl] campaign generate-artwork failed:', err?.message);
    return res.status(500).json({ error: err.message || 'Artwork generation failed' });
  }
});

// ─── POST /api/vinyl/campaigns/:id/checkout ─────────────────────────────────
// Creates a Stripe Checkout Session with manual capture (authorize-and-hold)
router.post('/campaigns/:id/checkout', async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id, 10);
  if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid id' });

  const { quantity = 1, buyerEmail, buyerName, shippingAddress } = req.body;
  if (!buyerEmail || !buyerName) {
    return res.status(400).json({ error: 'buyerEmail and buyerName are required' });
  }

  try {
    // Load campaign
    const { rows } = await q(
      `SELECT * FROM vinyl_campaigns WHERE id = $1 AND campaign_status = 'active' AND is_published = true`,
      [campaignId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found or inactive' });
    const campaign = rows[0];

    const qty = Math.max(1, parseInt(quantity, 10));
    const unitPrice = parseFloat(campaign.sell_price);
    const shipping = parseFloat(campaign.shipping_flat_rate);
    const totalCents = Math.round((unitPrice * qty + shipping) * 100);

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: buyerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${campaign.title} — Vinyl Pre-Order`,
              description: `${campaign.vinyl_format}" ${campaign.vinyl_type} ${campaign.vinyl_color} — ${campaign.vinyl_speed}`,
              images: [campaign.cover_image_1000],
            },
            unit_amount: Math.round(unitPrice * 100),
          },
          quantity: qty,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Shipping' },
            unit_amount: Math.round(shipping * 100),
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        capture_method: 'manual', // hold funds until 100 units reached
        metadata: {
          campaignId: String(campaignId),
          buyerEmail,
          buyerName,
          quantity: String(qty),
        },
      },
      metadata: {
        campaignId: String(campaignId),
        buyerEmail,
        buyerName,
        quantity: String(qty),
        shippingAddress: JSON.stringify(shippingAddress || {}),
      },
      success_url: `${BASE_URL}/vinyl-success?session_id={CHECKOUT_SESSION_ID}&campaignId=${campaignId}`,
      cancel_url: `${BASE_URL}/artist/${campaign.artist_id}?section=vinyl-records`,
    });

    return res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vinyl/webhook (Stripe) ───────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_VINYL_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret!);
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};
    const campaignId = parseInt(meta.campaignId, 10);
    const qty = parseInt(meta.quantity || '1', 10);
    const shipping = JSON.parse(meta.shippingAddress || '{}');
    const paymentIntentId = session.payment_intent as string;

    try {
      // Insert pre-order record
      await q(
        `INSERT INTO vinyl_preorders (
           campaign_id, artist_id, buyer_clerk_id, buyer_email, buyer_name,
           quantity, unit_price, total_price,
           stripe_payment_intent_id, stripe_payment_status, stripe_session_id,
           shipping_name, shipping_address_line1, shipping_city,
           shipping_state, shipping_postal_code, shipping_country, status
         )
         SELECT $1, c.artist_id, $2, $3, $4, $5, c.sell_price,
                c.sell_price * $5,
                $6, 'authorized', $7,
                $8, $9, $10, $11, $12,
                COALESCE($13, 'US'), 'confirmed'
         FROM vinyl_campaigns c WHERE c.id = $1`,
        [
          campaignId,
          meta.buyerClerkId || null, meta.buyerEmail, meta.buyerName,
          qty, paymentIntentId, session.id,
          shipping.name || meta.buyerName,
          shipping.line1 || null, shipping.city || null,
          shipping.state || null, shipping.postal_code || null,
          shipping.country || 'US',
        ]
      );

      // Update campaign counter and check if goal reached
      const { rows } = await q(
        `UPDATE vinyl_campaigns
         SET current_units = current_units + $1, updated_at = NOW()
         WHERE id = $2
         RETURNING current_units, minimum_units, artist_id, title`,
        [qty, campaignId]
      );
      const camp = rows[0];

      if (camp && parseInt(camp.current_units) >= parseInt(camp.minimum_units)) {
        // Goal reached — mark campaign and notify artist
        await q(
          `UPDATE vinyl_campaigns SET campaign_status = 'goal_reached', updated_at = NOW() WHERE id = $1`,
          [campaignId]
        );

        // Fetch artist email
        const artistRes = await pgDb.select({ email: users.email } as any)
          .from(users)
          .where(eq(users.id, camp.artist_id))
          .limit(1) as any[];

        const artistEmail = artistRes?.[0]?.email;
        if (artistEmail) {
          await sendNotificationEmail({
            to: artistEmail,
            subject: `🎉 ¡Tu vinilo "${camp.title}" alcanzó ${camp.minimum_units} pre-órdenes!`,
            html: `
              <h2>¡Felicidades! 🎉</h2>
              <p>Tu campaña de vinilo <strong>${camp.title}</strong> ha alcanzado el mínimo de <strong>${camp.minimum_units} unidades</strong>.</p>
              <p>Entra a tu perfil en Boostify para descargar el <strong>Fulfillment Report</strong> y enviarlo a Diggers Factory.</p>
              <a href="${BASE_URL}/artist/${camp.artist_id}?section=vinyl-records" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">Ver campaña</a>
            `,
          });
        }
      }
    } catch (err: any) {
      console.error('Vinyl webhook error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.json({ received: true });
});

// ─── GET /api/vinyl/campaigns/:id/orders ────────────────────────────────────
router.get('/campaigns/:id/orders', authenticate, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const { rows: campaign } = await q(
      `SELECT artist_id FROM vinyl_campaigns WHERE id = $1`, [id]
    );
    if (!campaign.length) return res.status(404).json({ error: 'Not found' });

    const user = (req as any).user;
    if (campaign[0].artist_id !== user?.pgId && !user?.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await q(
      `SELECT * FROM vinyl_preorders WHERE campaign_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return res.json({ orders: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vinyl/campaigns/:id/fulfill ──────────────────────────────────
// Generates the Diggers Factory fulfillment report + captures all Stripe payments
router.post('/campaigns/:id/fulfill', authenticate, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const { rows: campRows } = await q(
      `SELECT * FROM vinyl_campaigns WHERE id = $1`, [id]
    );
    if (!campRows.length) return res.status(404).json({ error: 'Not found' });
    const camp = campRows[0];

    const user = (req as any).user;
    if (camp.artist_id !== user?.pgId && !user?.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Load all confirmed pre-orders
    const { rows: orders } = await q(
      `SELECT * FROM vinyl_preorders WHERE campaign_id = $1 AND status = 'confirmed' AND stripe_payment_status = 'authorized'`,
      [id]
    );

    if (!orders.length) {
      return res.status(400).json({ error: 'No confirmed orders to fulfill' });
    }

    // Capture all Stripe PaymentIntents
    const captureResults: { id: number; success: boolean; error?: string }[] = [];
    for (const order of orders) {
      if (!order.stripe_payment_intent_id) continue;
      try {
        await stripe.paymentIntents.capture(order.stripe_payment_intent_id);
        await q(
          `UPDATE vinyl_preorders SET stripe_payment_status = 'captured', updated_at = NOW() WHERE id = $1`,
          [order.id]
        );
        captureResults.push({ id: order.id, success: true });
      } catch (stripeErr: any) {
        captureResults.push({ id: order.id, success: false, error: stripeErr.message });
      }
    }

    // Build fulfillment report
    const report = {
      generatedAt: new Date().toISOString(),
      campaign: {
        id: camp.id,
        title: camp.title,
        subtitle: camp.subtitle,
        format: camp.vinyl_format + '"',
        type: camp.vinyl_type,
        color: camp.vinyl_color,
        weight: camp.vinyl_weight,
        speed: camp.vinyl_speed,
        sleeve: camp.sleeve_type,
        printFinish: camp.print_finish,
        innerSleeve: camp.inner_sleeve,
        numbered: camp.numbered,
        insert: camp.with_insert,
        shrink: camp.with_shrink,
        barcode: camp.with_barcode,
        mastering: camp.include_mastering,
        tracklist: camp.tracklist_json,
        coverImage1000: camp.cover_image_1000,
        diggersQuoteRef: camp.diggers_quote_ref,
        diggersProjectUrl: camp.diggers_project_url,
      },
      totalUnits: orders.reduce((sum: number, o: any) => sum + o.quantity, 0),
      orders: orders.map((o: any) => ({
        orderId: o.id,
        buyerName: o.buyer_name,
        buyerEmail: o.buyer_email,
        quantity: o.quantity,
        shippingAddress: {
          name: o.shipping_name,
          line1: o.shipping_address_line1,
          line2: o.shipping_address_line2,
          city: o.shipping_city,
          state: o.shipping_state,
          postalCode: o.shipping_postal_code,
          country: o.shipping_country,
        },
      })),
      captureResults,
    };

    // Save report + update campaign status
    await q(
      `UPDATE vinyl_campaigns
       SET campaign_status = 'fulfilled', fulfillment_sent_at = NOW(), fulfillment_report = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(report), id]
    );

    return res.json({ report, message: 'Fulfillment report generated. Submit to Diggers Factory.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vinyl/:artistId/campaigns/all — All campaigns incl. drafts (owner)
router.get('/:artistId/campaigns/all', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artistId' });

  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { rows } = await q(
      `SELECT vc.*,
              (SELECT COUNT(*) FROM vinyl_preorders vp WHERE vp.campaign_id = vc.id AND vp.status != 'cancelled') AS total_orders
       FROM vinyl_campaigns vc
       WHERE vc.artist_id = $1
       ORDER BY vc.created_at DESC`,
      [artistId]
    );
    return res.json({ campaigns: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/vinyl/campaigns/:id ─────────────────────────────────────────
router.patch('/campaigns/:id', authenticate, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const {
    title, subtitle, sellPrice, shippingFlatRate,
    campaignStatus, campaignEnd, isPublished,
    diggersProjectUrl, diggersQuoteRef,
    coverImage1000, coverImageBack, tracklistJson,
  } = req.body;

  try {
    // Verify ownership
    const { rows: campRows } = await q(`SELECT artist_id FROM vinyl_campaigns WHERE id = $1`, [id]);
    if (!campRows.length) return res.status(404).json({ error: 'Campaign not found' });
    const user = (req as any).user;
    if (campRows[0].artist_id !== user?.pgId && !user?.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const setClauses: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (title !== undefined) { setClauses.push(`title = $${i++}`); vals.push(title); }
    if (subtitle !== undefined) { setClauses.push(`subtitle = $${i++}`); vals.push(subtitle); }
    if (sellPrice !== undefined) { setClauses.push(`sell_price = $${i++}`); vals.push(parseFloat(String(sellPrice))); }
    if (shippingFlatRate !== undefined) { setClauses.push(`shipping_flat_rate = $${i++}`); vals.push(parseFloat(String(shippingFlatRate))); }
    if (campaignStatus !== undefined) { setClauses.push(`campaign_status = $${i++}`); vals.push(campaignStatus); }
    if (campaignEnd !== undefined) { setClauses.push(`campaign_end = $${i++}`); vals.push(campaignEnd || null); }
    if (isPublished !== undefined) { setClauses.push(`is_published = $${i++}`); vals.push(isPublished); }
    if (diggersProjectUrl !== undefined) { setClauses.push(`diggers_project_url = $${i++}`); vals.push(diggersProjectUrl); }
    if (diggersQuoteRef !== undefined) { setClauses.push(`diggers_quote_ref = $${i++}`); vals.push(diggersQuoteRef); }
    if (coverImage1000 !== undefined) { setClauses.push(`cover_image_1000 = $${i++}`); vals.push(coverImage1000 || null); }
    if (coverImageBack !== undefined) { setClauses.push(`cover_image_back = $${i++}`); vals.push(coverImageBack || null); }
    if (tracklistJson !== undefined) {
      setClauses.push(`tracklist_json = $${i++}`);
      vals.push(JSON.stringify(Array.isArray(tracklistJson) ? tracklistJson : []));
    }

    if (!setClauses.length) return res.status(400).json({ error: 'Nothing to update' });
    setClauses.push(`updated_at = NOW()`);
    vals.push(id);

    const { rows } = await q(
      `UPDATE vinyl_campaigns SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return res.json({ campaign: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
