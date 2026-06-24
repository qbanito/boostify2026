/**
 * server/routes/art-gallery.ts
 *
 * Art Gallery / Auction Module — Galería de Arte para artistas visuales
 * (cuadros, pinturas, esculturas, arte digital, artes plásticas).
 *
 * Tres modos de venta:
 *   - fixed     : precio fijo, compra directa de la obra original (1/1) vía Stripe
 *   - auction   : subasta con contador (cuenta regresiva) + pujas; el ganador paga al cierre
 *   - tokenized : ediciones numeradas vendidas con tokens (mint atómico, como vinyl_editions)
 *
 * Endpoints:
 *   GET  /api/art-gallery/:artistId                    Lista obras publicadas del artista
 *   GET  /api/art-gallery/detail/:artworkId            Obra + pujas + tokens + historial
 *   POST /api/art-gallery                              Crea obra (auth, owner)
 *   PUT  /api/art-gallery/:artworkId                   Actualiza obra (auth, owner)
 *   DELETE /api/art-gallery/:artworkId                 Archiva/borra obra (auth, owner)
 *   POST /api/art-gallery/:artworkId/publish           Publica (subasta/precio fijo/mint tokens)
 *   POST /api/art-gallery/:artworkId/generate-image    Genera imagen IA opcional (auth, FAL)
 *   POST /api/art-gallery/:artworkId/bid               Registra una puja en la subasta (público)
 *   POST /api/art-gallery/:artworkId/settle            Cierra subasta y devuelve link de pago (auth)
 *   POST /api/art-gallery/:artworkId/buy               Compra directa / buy-now / pago ganador (Stripe)
 *   POST /api/art-gallery/:artworkId/buy-token         Compra un token de la edición (Stripe)
 *   GET  /api/art-gallery/:artistId/sales              Dashboard de ventas del owner (auth)
 *   GET  /api/art-gallery/my-collection/:userId        Colección del coleccionista
 *   POST /api/art-gallery/webhook                      Webhook de Stripe (raw body)
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import Stripe from 'stripe';
import axios from 'axios';
import { authenticate } from '../middleware/auth';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any });

const FAL_KEY = process.env.FAL_API_KEY || process.env.FAL_KEY || process.env.FAL_AI_KEY || '';
const BASE_URL = process.env.PRODUCTION_URL || 'http://localhost:5000';

async function q(text: string, params: unknown[] = []) {
  return pool.query(text, params);
}

/** Resolve the authenticated user's numeric PG id (middleware sets .id, some paths .pgId). */
function userPgId(user: any): number {
  return Number(user?.pgId ?? user?.id ?? 0);
}

/**
 * True when the user may manage this artist: the artist account itself, an admin,
 * or the creator of an AI-generated artist (users.generated_by === userPgId).
 * AI artists own a distinct pgId from the user who created them, so identity
 * equality alone is not enough.
 */
async function canManageArtist(user: any, artistId: number): Promise<boolean> {
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

/** Owner-or-admin guard for an artwork row (async: resolves AI-artist ownership). */
async function ownsArtwork(user: any, artwork: { artist_id: number }): Promise<boolean> {
  return canManageArtist(user, Number(artwork.artist_id));
}

// ─── GET /api/art-gallery/:artistId — published artworks for an artist ────────
router.get('/:artistId(\\d+)', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  try {
    const { rows } = await q(
      `SELECT a.*,
              COUNT(t.id) FILTER (WHERE t.payment_status = 'paid')      AS tokens_sold,
              COUNT(t.id) FILTER (WHERE t.payment_status = 'available')  AS tokens_available
       FROM art_artworks a
       LEFT JOIN art_tokens t ON t.artwork_id = a.id
       WHERE a.artist_id = $1 AND a.is_published = true AND a.status <> 'archived'
       GROUP BY a.id
       ORDER BY a.featured DESC, a.created_at DESC`,
      [artistId]
    );
    return res.json({ artworks: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/art-gallery/detail/:artworkId — full detail ────────────────────
router.get('/detail/:artworkId(\\d+)', async (req: Request, res: Response) => {
  const id = parseInt(req.params.artworkId, 10);
  try {
    const { rows: [artwork] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    if (!artwork) return res.status(404).json({ error: 'Artwork not found' });

    // Bump views (best effort, non-blocking semantics)
    q(`UPDATE art_artworks SET views = views + 1 WHERE id = $1`, [id]).catch(() => {});

    const { rows: bids } = await q(
      `SELECT id, bidder_name, amount, status, created_at
       FROM art_bids WHERE artwork_id = $1 ORDER BY amount DESC, created_at DESC LIMIT 25`,
      [id]
    );
    const { rows: tokens } = await q(
      `SELECT token_number, serial_label, payment_status, is_listed_for_sale, list_price,
              current_value, holder_name
       FROM art_tokens WHERE artwork_id = $1 ORDER BY token_number`,
      [id]
    );
    const { rows: history } = await q(
      `SELECT transaction_type, price, buyer_name, created_at
       FROM art_transactions WHERE artwork_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    return res.json({ artwork, bids, tokens, priceHistory: history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/art-gallery — create artwork (owner) ──────────────────────────
router.post('/', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const {
    artistId,
    title,
    description,
    category = 'painting',
    medium,
    dimensions,
    yearCreated,
    isOriginal = true,
    imageUrl,
    extraImages = [],
    saleMode = 'fixed',
    currency = 'usd',
    // fixed
    price,
    // auction
    startingPrice,
    reservePrice,
    minIncrement = 10,
    buyNowPrice,
    auctionStart,
    auctionEnd,
    // tokenized
    editionSize = 1,
    tokenPrice,
    tokenSymbol,
    shippingFlatRate = 0,
    tags = [],
  } = req.body;

  if (!artistId) return res.status(400).json({ error: 'artistId is required' });
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (!['fixed', 'auction', 'tokenized'].includes(saleMode)) {
    return res.status(400).json({ error: 'invalid saleMode' });
  }
  // Only the owner artist or an admin may create under this artistId
  if (Number(artistId) !== userPgId(user) && !user.isAdmin) {
    return res.status(403).json({ error: 'You can only create artworks for your own profile' });
  }

  try {
    const { rows: [artwork] } = await q(
      `INSERT INTO art_artworks (
         artist_id, title, description, category, medium, dimensions, year_created,
         is_original, image_url, extra_images, sale_mode, currency,
         price, starting_price, reserve_price, min_increment, buy_now_price,
         auction_start, auction_end, current_bid, edition_size, token_price,
         token_symbol, shipping_flat_rate, tags, status
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
         $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,'draft'
       ) RETURNING *`,
      [
        Number(artistId), title, description || null, category, medium || null,
        dimensions || null, yearCreated ? Number(yearCreated) : null, !!isOriginal,
        imageUrl, JSON.stringify(extraImages || []), saleMode, currency,
        price != null ? Number(price) : null,
        startingPrice != null ? Number(startingPrice) : null,
        reservePrice != null ? Number(reservePrice) : null,
        Number(minIncrement) || 10,
        buyNowPrice != null ? Number(buyNowPrice) : null,
        auctionStart ? new Date(auctionStart) : null,
        auctionEnd ? new Date(auctionEnd) : null,
        startingPrice != null ? Number(startingPrice) : null, // seed current_bid at starting price
        Number(editionSize) || 1,
        tokenPrice != null ? Number(tokenPrice) : null,
        tokenSymbol || null,
        Number(shippingFlatRate) || 0,
        JSON.stringify(tags || []),
      ]
    );
    return res.json({ artwork });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/art-gallery/:artworkId — update (owner) ─────────────────────────
const UPDATABLE: Record<string, string> = {
  title: 'title', description: 'description', category: 'category', medium: 'medium',
  dimensions: 'dimensions', yearCreated: 'year_created', isOriginal: 'is_original',
  imageUrl: 'image_url', extraImages: 'extra_images', saleMode: 'sale_mode',
  currency: 'currency', price: 'price', startingPrice: 'starting_price',
  reservePrice: 'reserve_price', minIncrement: 'min_increment', buyNowPrice: 'buy_now_price',
  auctionStart: 'auction_start', auctionEnd: 'auction_end', editionSize: 'edition_size',
  tokenPrice: 'token_price', tokenSymbol: 'token_symbol', shippingFlatRate: 'shipping_flat_rate',
  featured: 'featured', tags: 'tags',
};

router.put('/:artworkId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const id = parseInt(req.params.artworkId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { rows: [existing] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    if (!existing) return res.status(404).json({ error: 'Artwork not found' });
    if (!(await ownsArtwork(user, existing))) return res.status(403).json({ error: 'Forbidden' });

    const setClauses: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries(UPDATABLE)) {
      if (req.body[key] === undefined) continue;
      let v: unknown = req.body[key];
      if (key === 'extraImages' || key === 'tags') v = JSON.stringify(v || []);
      else if (key === 'auctionStart' || key === 'auctionEnd') v = v ? new Date(v as string) : null;
      setClauses.push(`${col} = $${idx++}`);
      vals.push(v);
    }
    if (!setClauses.length) return res.status(400).json({ error: 'No fields to update' });
    setClauses.push(`updated_at = NOW()`);
    vals.push(id);

    const { rows: [artwork] } = await q(
      `UPDATE art_artworks SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return res.json({ artwork });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/art-gallery/:artworkId — archive (owner) ────────────────────
router.delete('/:artworkId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const id = parseInt(req.params.artworkId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows: [existing] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    if (!existing) return res.status(404).json({ error: 'Artwork not found' });
    if (!(await ownsArtwork(user, existing))) return res.status(403).json({ error: 'Forbidden' });

    const soldTokens = await q(
      `SELECT 1 FROM art_tokens WHERE artwork_id = $1 AND payment_status = 'paid' LIMIT 1`, [id]
    );
    if (soldTokens.rows.length || existing.is_sold) {
      // Has real sales — only archive, never hard-delete sold records
      await q(`UPDATE art_artworks SET status = 'archived', is_published = false, updated_at = NOW() WHERE id = $1`, [id]);
      return res.json({ archived: true });
    }
    await q(`DELETE FROM art_artworks WHERE id = $1`, [id]);
    return res.json({ deleted: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/art-gallery/:artworkId/publish — go live ──────────────────────
router.post('/:artworkId(\\d+)/publish', authenticate, async (req: Request, res: Response) => {
  const id = parseInt(req.params.artworkId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { rows: [art] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    if (!art) return res.status(404).json({ error: 'Artwork not found' });
    if (!(await ownsArtwork(user, art))) return res.status(403).json({ error: 'Forbidden' });
    if (!art.image_url) return res.status(400).json({ error: 'Image is required before publishing' });

    if (art.sale_mode === 'fixed') {
      if (art.price == null) return res.status(400).json({ error: 'price is required for fixed sale' });
      await q(
        `UPDATE art_artworks SET status='live', is_published=true, buy_payment_status='available', updated_at=NOW() WHERE id=$1`,
        [id]
      );
    } else if (art.sale_mode === 'auction') {
      if (art.starting_price == null) return res.status(400).json({ error: 'startingPrice is required for auction' });
      if (!art.auction_end) return res.status(400).json({ error: 'auctionEnd is required for auction' });
      if (new Date(art.auction_end).getTime() <= Date.now()) {
        return res.status(400).json({ error: 'auctionEnd must be in the future' });
      }
      await q(
        `UPDATE art_artworks
         SET status='live', is_published=true,
             auction_start = COALESCE(auction_start, NOW()),
             current_bid = COALESCE(current_bid, starting_price),
             auction_settled = false, updated_at=NOW()
         WHERE id=$1`,
        [id]
      );
    } else if (art.sale_mode === 'tokenized') {
      if (art.token_price == null) return res.status(400).json({ error: 'tokenPrice is required for tokenized sale' });
      const size = Math.max(1, Number(art.edition_size) || 1);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (let n = 1; n <= size; n++) {
          const serial = `${String(n).padStart(3, '0')}/${size}`;
          await client.query(
            `INSERT INTO art_tokens (artwork_id, artist_id, token_number, serial_label, current_value)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT (artwork_id, token_number) DO NOTHING`,
            [id, art.artist_id, n, serial, art.token_price]
          );
        }
        await client.query(
          `UPDATE art_artworks SET status='live', is_published=true, tokens_minted=$1, updated_at=NOW() WHERE id=$2`,
          [size, id]
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const { rows: [updated] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    return res.json({ artwork: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/art-gallery/:artworkId/generate-image — optional AI art ───────
router.post('/:artworkId(\\d+)/generate-image', authenticate, async (req: Request, res: Response) => {
  const id = parseInt(req.params.artworkId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { prompt, style = 'fine art' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });
  if (!FAL_KEY) return res.status(503).json({ error: 'FAL_API_KEY not configured' });

  try {
    const { rows: [art] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    if (!art) return res.status(404).json({ error: 'Artwork not found' });
    if (!(await ownsArtwork(user, art))) return res.status(403).json({ error: 'Forbidden' });

    const fullPrompt = `Fine art ${art.category || 'painting'}, museum gallery quality, ${style} style. ${prompt}. Masterpiece, gallery exhibition piece, rich texture, professional art photography of the artwork, highly detailed, no text, no watermark.`;
    const falRes = await axios.post(
      'https://fal.run/fal-ai/flux-pro/kontext/text-to-image',
      { prompt: fullPrompt, image_size: 'square_hd', num_images: 1, output_format: 'jpeg', guidance_scale: 3.5 },
      { headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' }, timeout: 120000 }
    );
    const imageUrl = falRes.data?.images?.[0]?.url || falRes.data?.image?.url;
    if (!imageUrl) return res.status(500).json({ error: 'FAL returned no image' });

    await q(
      `UPDATE art_artworks SET image_url = $1, ai_prompt = $2, ai_model = $3, updated_at = NOW() WHERE id = $4`,
      [imageUrl, prompt, 'fal-ai/flux-pro/kontext/text-to-image', id]
    );
    return res.json({ imageUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// ─── POST /api/art-gallery/:artworkId/bid — place a bid (public) ─────────────
router.post('/:artworkId(\\d+)/bid', async (req: Request, res: Response) => {
  const id = parseInt(req.params.artworkId, 10);
  const { bidderName, bidderEmail, amount } = req.body;
  if (!bidderName) return res.status(400).json({ error: 'bidderName is required' });
  const bidAmount = Number(amount);
  if (!bidAmount || bidAmount <= 0) return res.status(400).json({ error: 'A valid bid amount is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the artwork row so concurrent bids are serialized
    const { rows: [art] } = await client.query(
      `SELECT * FROM art_artworks WHERE id = $1 FOR UPDATE`, [id]
    );
    if (!art) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Artwork not found' }); }
    if (art.sale_mode !== 'auction') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'This artwork is not an auction' }); }
    if (art.status !== 'live' || !art.is_published) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Auction is not live' }); }
    if (!art.auction_end || new Date(art.auction_end).getTime() <= Date.now()) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Auction has ended' });
    }

    const currentBid = art.current_bid != null ? Number(art.current_bid) : Number(art.starting_price || 0);
    const increment = Number(art.min_increment) || 1;
    const hasBids = (art.bid_count || 0) > 0;
    const minRequired = hasBids ? currentBid + increment : currentBid;
    if (bidAmount < minRequired) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Bid must be at least ${minRequired}`, minRequired });
    }

    // Mark previous active bids as outbid
    await client.query(`UPDATE art_bids SET status = 'outbid' WHERE artwork_id = $1 AND status = 'active'`, [id]);
    // Insert the new top bid
    await client.query(
      `INSERT INTO art_bids (artwork_id, artist_id, bidder_name, bidder_email, amount, status)
       VALUES ($1,$2,$3,$4,$5,'active')`,
      [id, art.artist_id, bidderName, bidderEmail || null, bidAmount]
    );
    // Update artwork with the new high bid
    await client.query(
      `UPDATE art_artworks
       SET current_bid = $1, current_bidder_name = $2, current_bidder_email = $3,
           bid_count = bid_count + 1, updated_at = NOW()
       WHERE id = $4`,
      [bidAmount, bidderName, bidderEmail || null, id]
    );
    await client.query(
      `INSERT INTO art_transactions (artwork_id, artist_id, transaction_type, buyer_name, price, note)
       VALUES ($1,$2,'bid',$3,$4,'Auction bid placed')`,
      [id, art.artist_id, bidderName, bidAmount]
    );
    await client.query('COMMIT');

    const { rows: [updated] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    return res.json({ artwork: updated, yourBid: bidAmount });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/art-gallery/:artworkId/settle — close auction & pick winner ────
router.post('/:artworkId(\\d+)/settle', authenticate, async (req: Request, res: Response) => {
  const id = parseInt(req.params.artworkId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows: [art] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    if (!art) return res.status(404).json({ error: 'Artwork not found' });
    if (!(await ownsArtwork(user, art))) return res.status(403).json({ error: 'Forbidden' });
    if (art.sale_mode !== 'auction') return res.status(400).json({ error: 'Not an auction' });
    if (art.auction_settled) return res.status(400).json({ error: 'Auction already settled' });

    const reserveMet = art.reserve_price == null || Number(art.current_bid) >= Number(art.reserve_price);
    const hasWinner = (art.bid_count || 0) > 0 && reserveMet;

    if (hasWinner) {
      await q(
        `UPDATE art_artworks
         SET status='ended', auction_settled=true,
             winner_name = current_bidder_name, winner_email = current_bidder_email,
             winner_payment_status = 'unpaid', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
      await q(`UPDATE art_bids SET status = 'won' WHERE artwork_id = $1 AND status = 'active'`, [id]);
    } else {
      await q(
        `UPDATE art_artworks SET status='ended', auction_settled=true, updated_at=NOW() WHERE id=$1`,
        [id]
      );
    }
    const { rows: [updated] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    return res.json({ artwork: updated, winner: hasWinner ? updated.winner_name : null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/art-gallery/:artworkId/buy — direct sale / buy-now / winner pay ─
router.post('/:artworkId(\\d+)/buy', async (req: Request, res: Response) => {
  const id = parseInt(req.params.artworkId, 10);
  const { buyerName, buyerEmail } = req.body;
  if (!buyerEmail || !buyerName) return res.status(400).json({ error: 'buyerName and buyerEmail are required' });

  try {
    const { rows: [art] } = await q(`SELECT * FROM art_artworks WHERE id = $1`, [id]);
    if (!art) return res.status(404).json({ error: 'Artwork not found' });
    if (!art.is_published) return res.status(400).json({ error: 'Artwork not available' });

    // Determine the price + intent for this purchase
    let amount = 0;
    let kind: 'fixed' | 'buy_now' | 'auction_win' = 'fixed';
    if (art.sale_mode === 'fixed') {
      if (art.is_sold || art.buy_payment_status === 'paid') return res.status(409).json({ error: 'Already sold' });
      if (art.price == null) return res.status(400).json({ error: 'No price set' });
      amount = Number(art.price);
      kind = 'fixed';
    } else if (art.sale_mode === 'auction') {
      const winnerEmail = (art.winner_email || '').toLowerCase();
      if (art.auction_settled && winnerEmail && winnerEmail === String(buyerEmail).toLowerCase()) {
        // Winner settling their won auction
        if (art.winner_payment_status === 'paid') return res.status(409).json({ error: 'Already paid' });
        amount = Number(art.current_bid);
        kind = 'auction_win';
      } else if (!art.auction_settled && art.buy_now_price != null) {
        // Buy-now ends the auction immediately
        amount = Number(art.buy_now_price);
        kind = 'buy_now';
      } else {
        return res.status(400).json({ error: 'Auction is live — place a bid instead' });
      }
    } else {
      return res.status(400).json({ error: 'Tokenized artworks are bought per token' });
    }

    const shipping = Number(art.shipping_flat_rate) || 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: art.currency || 'usd',
          product_data: {
            name: `${art.title}${art.medium ? ` — ${art.medium}` : ''}`,
            description: `${art.category || 'artwork'}${art.dimensions ? ` • ${art.dimensions}` : ''}${art.is_original ? ' • Original 1/1' : ''}`,
            images: art.image_url ? [art.image_url] : [],
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ];
    if (shipping > 0) {
      lineItems.push({
        price_data: { currency: art.currency || 'usd', product_data: { name: 'Shipping & Handling' }, unit_amount: Math.round(shipping * 100) },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: buyerEmail,
      metadata: { type: 'art_sale', artworkId: String(id), kind, buyerName },
      line_items: lineItems,
      success_url: `${BASE_URL}/universe/${art.artist_id}?art=success&artwork=${id}`,
      cancel_url: `${BASE_URL}/universe/${art.artist_id}?art=cancelled`,
    });

    // Reserve the artwork while the checkout is open
    if (kind === 'fixed' || kind === 'buy_now') {
      await q(
        `UPDATE art_artworks SET buy_payment_status='pending', buy_stripe_session_id=$1,
                sold_to_name=$2, updated_at=NOW() WHERE id=$3`,
        [session.id, buyerName, id]
      );
    } else if (kind === 'auction_win') {
      await q(
        `UPDATE art_artworks SET winner_payment_status='pending', winner_stripe_session_id=$1, updated_at=NOW() WHERE id=$2`,
        [session.id, id]
      );
    }

    return res.json({ checkoutUrl: session.url, amount, kind });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/art-gallery/:artworkId/buy-token — buy one token (Stripe) ──────
router.post('/:artworkId(\\d+)/buy-token', async (req: Request, res: Response) => {
  const id = parseInt(req.params.artworkId, 10);
  const { buyerName, buyerEmail, specificToken } = req.body;
  if (!buyerEmail || !buyerName) return res.status(400).json({ error: 'buyerName and buyerEmail are required' });

  try {
    const { rows: [art] } = await q(
      `SELECT * FROM art_artworks WHERE id = $1 AND status='live' AND is_published=true AND sale_mode='tokenized'`,
      [id]
    );
    if (!art) return res.status(404).json({ error: 'Tokenized edition not available' });

    // Atomically reserve the next available token
    const client = await pool.connect();
    let token: any;
    try {
      await client.query('BEGIN');
      let tq = `SELECT * FROM art_tokens WHERE artwork_id = $1 AND payment_status = 'available'`;
      const tp: unknown[] = [id];
      if (specificToken) { tq += ` AND token_number = $2`; tp.push(specificToken); }
      else { tq += ` ORDER BY token_number ASC`; }
      tq += ` FOR UPDATE SKIP LOCKED LIMIT 1`;
      const { rows: [picked] } = await client.query(tq, tp);
      if (!picked) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'No tokens available' }); }
      token = picked;
      await client.query(
        `UPDATE art_tokens SET payment_status='pending', holder_name=$1, holder_email=$2, updated_at=NOW() WHERE id=$3`,
        [buyerName, buyerEmail, token.id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const price = Number(art.token_price);
    const shipping = Number(art.shipping_flat_rate) || 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: art.currency || 'usd',
          product_data: {
            name: `${art.title} — Token #${token.serial_label}`,
            description: `Limited art edition • ${art.edition_size} pieces${art.medium ? ` • ${art.medium}` : ''}`,
            images: art.image_url ? [art.image_url] : [],
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      },
    ];
    if (shipping > 0) {
      lineItems.push({
        price_data: { currency: art.currency || 'usd', product_data: { name: 'Shipping & Handling' }, unit_amount: Math.round(shipping * 100) },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: buyerEmail,
      metadata: { type: 'art_token', artworkId: String(id), tokenNumber: String(token.token_number), buyerName },
      line_items: lineItems,
      success_url: `${BASE_URL}/universe/${art.artist_id}?art_token=success&token=${token.token_number}`,
      cancel_url: `${BASE_URL}/universe/${art.artist_id}?art_token=cancelled`,
    });

    await q(`UPDATE art_tokens SET stripe_session_id=$1, updated_at=NOW() WHERE id=$2`, [session.id, token.id]);
    return res.json({ checkoutUrl: session.url, tokenNumber: token.token_number, serialLabel: token.serial_label });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/art-gallery/:artistId/sales — owner sales dashboard ─────────────
router.get('/:artistId(\\d+)/sales', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await canManageArtist(user, artistId))) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows: [summary] } = await q(
      `SELECT
         COUNT(*) FILTER (WHERE is_sold OR buy_payment_status='paid')               AS pieces_sold,
         COALESCE(SUM(sold_price) FILTER (WHERE buy_payment_status='paid'),0)        AS fixed_revenue,
         COUNT(*) FILTER (WHERE sale_mode='auction' AND winner_payment_status='paid') AS auctions_won
       FROM art_artworks WHERE artist_id = $1`,
      [artistId]
    );
    const { rows: tokenRev } = await q(
      `SELECT COALESCE(SUM(purchase_price),0) AS token_revenue, COUNT(*) AS tokens_sold
       FROM art_tokens WHERE artist_id = $1 AND payment_status='paid'`,
      [artistId]
    );
    const { rows: recent } = await q(
      `SELECT t.transaction_type, t.price, t.buyer_name, t.created_at, a.title
       FROM art_transactions t JOIN art_artworks a ON a.id = t.artwork_id
       WHERE t.artist_id = $1 AND t.transaction_type <> 'bid'
       ORDER BY t.created_at DESC LIMIT 20`,
      [artistId]
    );
    return res.json({ summary, tokens: tokenRev[0], recent });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/art-gallery/:artistId/manage — owner list incl. drafts ─────────
router.get('/:artistId(\\d+)/manage', authenticate, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await canManageArtist(user, artistId))) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows } = await q(
      `SELECT a.*,
              COUNT(t.id) FILTER (WHERE t.payment_status = 'paid')      AS tokens_sold,
              COUNT(t.id) FILTER (WHERE t.payment_status = 'available')  AS tokens_available
       FROM art_artworks a
       LEFT JOIN art_tokens t ON t.artwork_id = a.id
       WHERE a.artist_id = $1 AND a.status <> 'archived'
       GROUP BY a.id
       ORDER BY a.created_at DESC`,
      [artistId]
    );
    return res.json({ artworks: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/art-gallery/my-collection/:userId — collector view ─────────────
router.get('/my-collection/:userId(\\d+)', authenticate, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (userId !== userPgId(user) && !user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows: tokens } = await q(
      `SELECT tk.*, a.title, a.image_url, a.category, a.medium
       FROM art_tokens tk JOIN art_artworks a ON a.id = tk.artwork_id
       WHERE tk.owner_user_id = $1 AND tk.payment_status='paid'
       ORDER BY tk.purchased_at DESC`,
      [userId]
    );
    return res.json({ tokens });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/art-gallery/webhook — Stripe (raw body, mounted in index.ts) ──
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_ART_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

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

      if (meta.type === 'art_sale') {
        const artworkId = parseInt(meta.artworkId, 10);
        const kind = meta.kind;
        const buyerName = meta.buyerName || null;
        if (!artworkId) return res.json({ received: true });

        if (kind === 'fixed' || kind === 'buy_now') {
          const { rows: [art] } = await q(
            `UPDATE art_artworks
             SET is_sold=true, status='sold', buy_payment_status='paid',
                 sold_price = CASE WHEN sale_mode='auction' THEN buy_now_price ELSE price END,
                 sold_at=NOW(), sold_to_name=$2, auction_settled = (sale_mode='auction'), updated_at=NOW()
             WHERE id=$1 AND buy_stripe_session_id=$3 AND buy_payment_status='pending'
             RETURNING id, COALESCE(buy_now_price, price) AS amount, artist_id`,
            [artworkId, buyerName, session.id]
          );
          if (art) {
            await q(
              `INSERT INTO art_transactions (artwork_id, artist_id, transaction_type, buyer_name, price, note)
               VALUES ($1,$2,'sale',$3,$4,'Direct sale via Stripe Checkout')`,
              [artworkId, art.artist_id, buyerName, art.amount]
            );
          }
        } else if (kind === 'auction_win') {
          const { rows: [art] } = await q(
            `UPDATE art_artworks
             SET status='sold', winner_payment_status='paid', is_sold=true,
                 sold_price=current_bid, sold_at=NOW(), sold_to_name=winner_name, updated_at=NOW()
             WHERE id=$1 AND winner_stripe_session_id=$2 AND winner_payment_status='pending'
             RETURNING id, current_bid AS amount, artist_id`,
            [artworkId, session.id]
          );
          if (art) {
            await q(
              `INSERT INTO art_transactions (artwork_id, artist_id, transaction_type, buyer_name, price, note)
               VALUES ($1,$2,'auction_win',$3,$4,'Auction settled via Stripe Checkout')`,
              [artworkId, art.artist_id, buyerName, art.amount]
            );
          }
        }
      } else if (meta.type === 'art_token') {
        const artworkId = parseInt(meta.artworkId, 10);
        const tokenNumber = parseInt(meta.tokenNumber, 10);
        const buyerName = meta.buyerName || null;
        if (!artworkId || !tokenNumber) return res.json({ received: true });

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const { rows: [token] } = await client.query(
            `UPDATE art_tokens t
             SET payment_status='paid', purchase_price=a.token_price, purchased_at=NOW(),
                 current_value=a.token_price, updated_at=NOW()
             FROM art_artworks a
             WHERE t.artwork_id=$1 AND t.token_number=$2 AND t.artwork_id=a.id
               AND t.payment_status='pending' AND t.stripe_session_id=$3
             RETURNING t.id, t.token_number, a.token_price`,
            [artworkId, tokenNumber, session.id]
          );
          if (token) {
            await client.query(
              `INSERT INTO art_transactions (artwork_id, token_id, artist_id, transaction_type, buyer_name, price, note)
               VALUES ($1,$2,(SELECT artist_id FROM art_artworks WHERE id=$1),'mint',$3,$4,'Token sale via Stripe Checkout')`,
              [artworkId, token.id, buyerName, token.token_price]
            );
            // Mark edition sold out if all tokens are paid
            await client.query(
              `UPDATE art_artworks SET status='sold', updated_at=NOW()
               WHERE id=$1 AND NOT EXISTS (
                 SELECT 1 FROM art_tokens WHERE artwork_id=$1 AND payment_status <> 'paid'
               )`,
              [artworkId]
            );
          }
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      // Release reserved fixed/buy-now artwork
      await q(
        `UPDATE art_artworks SET buy_payment_status='available', buy_stripe_session_id=NULL, sold_to_name=NULL, updated_at=NOW()
         WHERE buy_stripe_session_id=$1 AND buy_payment_status='pending'`,
        [session.id]
      );
      // Release reserved auction-winner payment
      await q(
        `UPDATE art_artworks SET winner_payment_status='unpaid', winner_stripe_session_id=NULL, updated_at=NOW()
         WHERE winner_stripe_session_id=$1 AND winner_payment_status='pending'`,
        [session.id]
      );
      // Release reserved token
      await q(
        `UPDATE art_tokens SET payment_status='available', holder_name=NULL, holder_email=NULL, stripe_session_id=NULL, updated_at=NOW()
         WHERE stripe_session_id=$1 AND payment_status='pending'`,
        [session.id]
      );
    }

    return res.json({ received: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
